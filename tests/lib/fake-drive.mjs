// In-memory Google Drive v3 for the tests: the subset of the REST API the app
// uses (files list/create/update/copy/download, multipart and resumable
// uploads, about). Used through `fakeFetch` in unit tests and through
// Playwright's page.route in the end-to-end tests. Never talks to Google.

const DEC = new TextDecoder();
const ENC = new TextEncoder();
const latin1 = (bytes) => Buffer.from(bytes).toString('latin1');
const fromLatin1 = (s) => new Uint8Array(Buffer.from(s, 'latin1'));

export function createFakeDrive({ email = 'teste@example.com' } = {}) {
  const files = new Map();
  const uploads = new Map(); // upload_id → {meta, id?, total, received: Uint8Array[]}
  let seq = 0;
  let clock = Date.UTC(2026, 9, 12, 12, 0, 0);
  // hideHeaders: response headers the browser would not expose (simulates a CORS limit).
  const state = { rejectToken: false, requests: [], interruptUploadAfterChunks: null, hideHeaders: [] };

  const nextId = () => `f${(seq += 1).toString().padStart(4, '0')}`;
  const tick = () => new Date((clock += 1000)).toISOString();
  const view = (f) => ({
    id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, appProperties: f.appProperties,
    modifiedTime: f.modifiedTime, trashed: f.trashed, size: f.mimeType.endsWith('.folder') ? undefined : String(f.content.length),
  });
  const json = (status, obj, headers = {}) => ({ status, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(obj) });

  function create(meta, content = new Uint8Array()) {
    const f = {
      id: nextId(), name: meta.name || 'sem nome', mimeType: meta.mimeType || 'application/octet-stream',
      parents: meta.parents || [], appProperties: meta.appProperties || {}, trashed: false, content, modifiedTime: tick(),
    };
    files.set(f.id, f);
    return f;
  }

  function matches(f, q) {
    for (const [, k, v] of q.matchAll(/appProperties has \{ key='((?:\\.|[^'])*)' and value='((?:\\.|[^'])*)' \}/g)) {
      const un = (s) => s.replace(/\\(.)/g, '$1');
      if (f.appProperties?.[un(k)] !== un(v)) return false;
    }
    const parent = q.match(/'([^']+)' in parents/);
    if (parent && !f.parents.includes(parent[1])) return false;
    if (/trashed = false/.test(q) && f.trashed) return false;
    return true;
  }

  function parseMultipart(contentType, body) {
    const boundary = contentType.match(/boundary=([^;]+)/)[1];
    const parts = latin1(body).split(`--${boundary}`).slice(1, -1).map((p) => {
      const at = p.indexOf('\r\n\r\n');
      return p.slice(at + 4, p.length - 2); // drop the trailing \r\n
    });
    return { meta: JSON.parse(DEC.decode(fromLatin1(parts[0]))), content: fromLatin1(parts[1]) };
  }

  /** @param {{method: string, url: string, headers: object, body: Uint8Array|null}} req */
  function handle(req) {
    const r = route(req);
    for (const name of state.hideHeaders) delete r.headers?.[name];
    return r;
  }

  function route({ method, url, headers, body }) {
    const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const u = new URL(url);
    state.requests.push({ method, path: u.pathname, query: Object.fromEntries(u.searchParams) });
    if (state.rejectToken || !/^Bearer .+/.test(h.authorization || '')) return json(401, { error: { code: 401, message: 'Invalid Credentials' } });
    const path = u.pathname;
    const q = u.searchParams;
    const bodyJson = () => (body && body.length ? JSON.parse(DEC.decode(body)) : {});

    if (path === '/drive/v3/about') {
      const used = [...files.values()].reduce((s, f) => s + (f.trashed ? 0 : f.content.length), 0);
      return json(200, { user: { displayName: 'Teste', emailAddress: email }, storageQuota: { limit: String(15 * 1024 ** 3), usage: String(used) } });
    }
    if (path === '/drive/v3/files' && method === 'GET') {
      const list = [...files.values()].filter((f) => matches(f, q.get('q') || '')).map(view);
      return json(200, { files: list });
    }
    if (path === '/drive/v3/files' && method === 'POST') return json(200, view(create(bodyJson())));
    let m = path.match(/^\/drive\/v3\/files\/([^/]+)\/copy$/);
    if (m && method === 'POST') {
      const src = files.get(m[1]);
      if (!src) return json(404, { error: { code: 404 } });
      const meta = bodyJson();
      return json(200, view(create({ ...src, ...meta, mimeType: src.mimeType }, src.content.slice())));
    }
    m = path.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (m) {
      const f = files.get(m[1]);
      if (!f) return json(404, { error: { code: 404 } });
      if (method === 'GET' && q.get('alt') === 'media') return { status: 200, headers: { 'content-type': f.mimeType }, body: f.content };
      if (method === 'GET') return json(200, view(f));
      if (method === 'PATCH') {
        const meta = bodyJson();
        if (meta.name !== undefined) f.name = meta.name;
        if (meta.appProperties) f.appProperties = { ...f.appProperties, ...meta.appProperties };
        if (meta.trashed !== undefined) f.trashed = meta.trashed;
        if (q.get('addParents')) f.parents = [...new Set([...f.parents, ...q.get('addParents').split(',')])];
        if (q.get('removeParents')) f.parents = f.parents.filter((p) => !q.get('removeParents').split(',').includes(p));
        f.modifiedTime = tick();
        return json(200, view(f));
      }
    }
    // Uploads.
    m = path.match(/^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/);
    if (m && q.get('uploadType') === 'multipart') {
      const { meta, content } = parseMultipart(h['content-type'], body);
      if (m[1]) {
        const f = files.get(m[1]);
        if (!f) return json(404, { error: { code: 404 } });
        f.content = content;
        if (meta.name) f.name = meta.name;
        if (meta.appProperties) f.appProperties = { ...f.appProperties, ...meta.appProperties };
        f.modifiedTime = tick();
        return json(200, view(f));
      }
      return json(200, view(create(meta, content)));
    }
    if (m && q.get('uploadType') === 'resumable' && !q.get('upload_id')) {
      const uploadId = `u${(seq += 1)}`;
      uploads.set(uploadId, { meta: bodyJson(), id: m[1] || null, total: Number(h['x-upload-content-length'] || 0), received: [], chunks: 0 });
      return { status: 200, headers: { location: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${uploadId}` }, body: '' };
    }
    if (path === '/upload/drive/v3/files' && q.get('upload_id') && method === 'PUT') {
      const up = uploads.get(q.get('upload_id'));
      if (!up) return json(404, { error: { code: 404 } });
      const have = up.received.reduce((s, c) => s + c.length, 0);
      const range = h['content-range'] || '';
      const status308 = (n) => ({ status: 308, headers: n ? { range: `bytes=0-${n - 1}` } : {}, body: '' });
      if (/^bytes \*\//.test(range)) return status308(have);
      const [, from] = range.match(/^bytes (\d+)-(\d+)\/(\d+)$/) || [];
      if (Number(from) !== have) return status308(have);
      if (state.interruptUploadAfterChunks !== null && up.chunks >= state.interruptUploadAfterChunks) {
        state.interruptUploadAfterChunks = null;
        return json(503, { error: { code: 503, message: 'interrompido pelo teste' } });
      }
      up.received.push(body || new Uint8Array());
      up.chunks += 1;
      const total = have + (body?.length || 0);
      if (total < up.total) return status308(total);
      const content = new Uint8Array(total);
      let o = 0;
      for (const c of up.received) { content.set(c, o); o += c.length; }
      uploads.delete(q.get('upload_id'));
      if (up.id) {
        const f = files.get(up.id);
        f.content = content;
        f.modifiedTime = tick();
        return json(200, view(f));
      }
      return json(200, view(create(up.meta, content)));
    }
    return json(400, { error: { code: 400, message: `rota não simulada: ${method} ${path}` } });
  }

  // Helpers for assertions.
  const byProps = (props) => [...files.values()].filter((f) => !f.trashed && Object.entries(props).every(([k, v]) => f.appProperties?.[k] === v));
  const text = (f) => DEC.decode(f.content);
  const pathOf = (f) => {
    const names = [f.name];
    let p = files.get(f.parents[0]);
    while (p) { names.unshift(p.name); p = files.get(p.parents[0]); }
    return names.join('/');
  };

  return { files, state, handle, byProps, text, pathOf, create, encode: (s) => ENC.encode(s) };
}

/** fetch() that answers from a fake Drive (unit tests). */
export function fakeFetch(drive) {
  return async (url, init = {}) => {
    let body = null;
    if (init.body instanceof Blob) body = new Uint8Array(await init.body.arrayBuffer());
    else if (typeof init.body === 'string') body = new TextEncoder().encode(init.body);
    const r = drive.handle({ method: init.method || 'GET', url: String(url), headers: init.headers || {}, body });
    return new Response(r.status === 308 || r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
  };
}
