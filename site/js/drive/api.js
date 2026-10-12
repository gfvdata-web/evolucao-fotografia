// Thin Google Drive v3 client (REST over fetch, no Google library).
// `fetchImpl` and `getToken` are injected so the tests can use a fake Drive.
//
// Small files (JSON, previews, crops) go in one multipart request; originals
// use a resumable upload in 8 MB chunks, whose session URL survives a reload
// (the Drive keeps it for a week), so an interrupted upload continues where
// it stopped.

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB, as the Drive requires
export const FILE_FIELDS = 'id,name,mimeType,size,parents,appProperties,modifiedTime,trashed';

/** The token expired or was revoked: the user has to reconnect. */
export class AuthError extends Error {
  constructor(message = 'conexão com o Drive expirou') { super(message); this.name = 'AuthError'; }
}
/** The browser could not read the resumable session address (CORS). */
export class NoSessionError extends Error {
  constructor() { super('Drive não devolveu o endereço do envio'); this.name = 'NoSessionError'; }
}
/** The Drive is out of space, or the account has no quota left. */
export class QuotaError extends Error {
  constructor(message = 'sem espaço no Google Drive') { super(message); this.name = 'QuotaError'; }
}

/** Drive query for files with these appProperties (values are escaped). */
export function propsQuery(props, extra = 'trashed = false') {
  const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const parts = Object.entries(props).map(([k, v]) => `appProperties has { key='${esc(k)}' and value='${esc(v)}' }`);
  return [...parts, extra].filter(Boolean).join(' and ');
}

export function createDriveClient({ fetchImpl = (...a) => fetch(...a), getToken }) {
  async function call(url, { method = 'GET', headers = {}, body, raw = false } = {}) {
    const token = await getToken();
    if (!token) throw new AuthError('não conectado ao Drive');
    const res = await fetchImpl(url, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
    if (res.status === 401) throw new AuthError();
    if (res.status === 403 || res.status === 429) {
      const text = await res.text().catch(() => '');
      if (/storageQuotaExceeded|quotaExceeded/.test(text)) throw new QuotaError();
      throw new Error(`Drive recusou (${res.status}): ${text.slice(0, 200)}`);
    }
    if (raw) return res;
    if (!res.ok) throw new Error(`Drive respondeu ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
  }

  const json = (obj) => ({ 'Content-Type': 'application/json; charset=UTF-8', body: JSON.stringify(obj) });

  /** All files matching a query (follows pages). */
  async function list(q, fields = FILE_FIELDS) {
    const out = [];
    let pageToken = '';
    do {
      const params = new URLSearchParams({ q, fields: `nextPageToken,files(${fields})`, pageSize: '1000', spaces: 'drive' });
      if (pageToken) params.set('pageToken', pageToken);
      const r = await call(`${API}/files?${params}`);
      out.push(...(r.files || []));
      pageToken = r.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  async function createFolder(name, parentId, appProperties) {
    const { body } = json({ name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [], appProperties });
    return call(`${API}/files?fields=${FILE_FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body });
  }

  /** Changes name, appProperties, parents (move) or trashes a file. */
  async function update(id, { name, appProperties, trashed, addParents, removeParents } = {}) {
    const params = new URLSearchParams({ fields: FILE_FIELDS });
    if (addParents) params.set('addParents', addParents);
    if (removeParents) params.set('removeParents', removeParents);
    const meta = {};
    if (name !== undefined) meta.name = name;
    if (appProperties !== undefined) meta.appProperties = appProperties;
    if (trashed !== undefined) meta.trashed = trashed;
    const { body } = json(meta);
    return call(`${API}/files/${encodeURIComponent(id)}?${params}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body });
  }

  async function copy(id, name, parentId, appProperties) {
    const { body } = json({ name, parents: [parentId], appProperties });
    return call(`${API}/files/${encodeURIComponent(id)}/copy?fields=${FILE_FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body });
  }

  /**
   * Creates (no id) or replaces the content of (id) a small file in one request.
   * @param {{id?, name, parentId?, mimeType, appProperties?, content: Blob}} f
   */
  async function uploadSmall({ id, name, parentId, mimeType, appProperties, content }) {
    const boundary = `ef${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const meta = id ? { name, appProperties } : { name, mimeType, parents: parentId ? [parentId] : [], appProperties };
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, content, `\r\n--${boundary}--`,
    ]);
    const url = id
      ? `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=multipart&fields=${FILE_FIELDS}`
      : `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`;
    return call(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  }

  /** Starts a resumable upload and returns its session URL. */
  async function startResumable({ id, name, parentId, mimeType, appProperties, size }) {
    const meta = id ? { name, appProperties } : { name, mimeType, parents: parentId ? [parentId] : [], appProperties };
    const url = id
      ? `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=resumable&fields=${FILE_FIELDS}`
      : `${UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}`;
    const res = await call(url, {
      method: id ? 'PATCH' : 'POST', raw: true,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size) },
      body: JSON.stringify(meta),
    });
    if (!res.ok) throw new Error(`Drive não abriu o envio (${res.status})`);
    const location = res.headers.get('Location');
    if (!location) throw new NoSessionError();
    return location;
  }

  /** Bytes the Drive already has for a resumable session (null = session gone). */
  async function resumableOffset(sessionUrl, size) {
    const res = await call(sessionUrl, { method: 'PUT', raw: true, headers: { 'Content-Range': `bytes */${size}` } });
    if (res.status === 200 || res.status === 201) return { done: await res.json() };
    if (res.status === 308) {
      // Without a readable Range header the position is unknown: start a new session.
      const range = res.headers.get('Range');
      return range ? { offset: Number(range.split('-')[1]) + 1 } : { unknown: true };
    }
    if (res.status === 404 || res.status === 410) return null;
    throw new Error(`Drive respondeu ${res.status} ao retomar o envio`);
  }

  /**
   * Sends `content` through a resumable session, from where it stopped.
   * @param {(sent: number) => void} onProgress
   * @param {(url: string) => void|Promise} onSession called with the session URL (to persist it)
   */
  async function uploadLarge(f, { sessionUrl = null, onSession = () => {}, onProgress = () => {} } = {}) {
    const size = f.content.size;
    let url = sessionUrl;
    let offset = 0;
    if (url) {
      const st = await resumableOffset(url, size).catch(() => null);
      if (st?.done) { onProgress(size); return st.done; }
      if (st && !st.unknown) offset = st.offset; else url = null;
    }
    if (!url) {
      url = await startResumable({ ...f, size });
      await onSession(url);
    }
    for (;;) {
      const end = Math.min(offset + CHUNK, size);
      const res = await call(url, {
        method: 'PUT', raw: true,
        headers: { 'Content-Range': size ? `bytes ${offset}-${end - 1}/${size}` : 'bytes */0' },
        body: f.content.slice(offset, end),
      });
      if (res.status === 200 || res.status === 201) { onProgress(size); return res.json(); }
      if (res.status !== 308) throw new Error(`Drive respondeu ${res.status} no envio`);
      // The Drive says how much it has; if the header cannot be read, every full
      // chunk (a multiple of 256 KiB) counts as received.
      const range = res.headers.get('Range');
      offset = range ? Number(range.split('-')[1]) + 1 : end;
      onProgress(offset);
    }
  }

  async function download(id) {
    const res = await call(`${API}/files/${encodeURIComponent(id)}?alt=media`, { raw: true });
    if (!res.ok) throw new Error(`Drive respondeu ${res.status} ao baixar`);
    return res.blob();
  }

  const downloadJson = async (id) => JSON.parse(await (await download(id)).text());

  return { list, createFolder, update, copy, uploadSmall, uploadLarge, download, downloadJson };
}
