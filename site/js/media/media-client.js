// Main-thread side of the media worker.
let worker = null;
let nextId = 1;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./media-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.ok) p.resolve(data.data); else p.reject(new Error(data.error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'falha no processamento da imagem'));
    pending.clear();
    worker = null;
  };
  return worker;
}

function request(type, args) {
  const w = ensureWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, type, ...args });
  });
}

/**
 * Decodes the photo and builds a preview (long edge 2048 px) in display
 * orientation. `orientation` (EXIF 1/3/6/8) is only used for CR3 files.
 * @returns {Promise<{width, height, previewBlob, previewWidth, previewHeight, decodedFrom}>}
 */
export const makePreview = (file, kind, orientation = 1) => request('preview', { file, kind, orientation });

/**
 * Full-resolution analysis: JPEG header, 100% crops (PNG) and their metrics.
 * Rects are normalized on the displayed image; uniformRect null = automatic search.
 */
export const analyzeImage = (file, kind, orientation, { afRect, uniformRect, uniformPx }) =>
  request('analyze', { file, kind, orientation, afRect, uniformRect, uniformPx });
