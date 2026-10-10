// Main-thread side of the ExifTool worker: lazy start, request/response by id,
// a per-file timeout and a status other screens can show.
const TIMEOUT_MS = 180_000;

let worker = null;
let nextId = 1;
const pending = new Map();
const listeners = new Set();
export const exifToolStatus = { state: 'idle', lastMs: null, error: null, reads: 0 };

function setStatus(patch) {
  Object.assign(exifToolStatus, patch);
  for (const fn of listeners) fn({ ...exifToolStatus });
}

export function onExifToolStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./exiftool-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    clearTimeout(p.timer);
    if (data.ok) {
      setStatus({ state: pending.size ? 'busy' : 'ready', lastMs: data.ms, error: null, reads: exifToolStatus.reads + 1 });
      p.resolve(data.data);
    } else {
      setStatus({ state: pending.size ? 'busy' : 'ready', error: data.error });
      p.reject(new Error(data.error));
    }
  };
  worker.onerror = (e) => {
    const msg = e.message || 'falha ao iniciar o leitor completo';
    setStatus({ state: 'error', error: msg });
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(msg)); }
    pending.clear();
    worker = null;
  };
  return worker;
}

/** Full metadata of a file (ExifTool JSON). Rejects after TIMEOUT_MS. */
export function readFullMetadata(file) {
  const w = ensureWorker();
  const id = nextId++;
  setStatus({ state: exifToolStatus.reads === 0 ? 'loading' : 'busy' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('o leitor completo demorou demais para responder'));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, file });
  });
}
