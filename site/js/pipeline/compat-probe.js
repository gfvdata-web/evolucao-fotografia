// Runs the real browser-feature tests behind "Conferir compatibilidade" (About tab).
// Fast, no network, never asks the person for a permission. Each test has a short
// timeout and a try/catch; the result is { feature_id: true | false | 'unknown' }.
import { installState } from '../pwa.js';

const TIMEOUT_MS = 4000;

const withTimeout = (promise) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
]);

/** Runs `fn`; a thrown error or timeout counts as failure (false). */
async function check(fn) {
  try { return Boolean(await withTimeout(Promise.resolve().then(fn))); } catch { return false; }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ef-compat-probe');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('ef-compat-probe'); resolve(true); };
  });
}

/** A module worker that answers a message, built from a Blob so no extra file is needed. */
function moduleWorker() {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob(['export {}; self.onmessage = () => self.postMessage(1);'], { type: 'text/javascript' }));
    let w;
    try { w = new Worker(url, { type: 'module' }); } catch (e) { URL.revokeObjectURL(url); reject(e); return; }
    w.onmessage = () => { w.terminate(); URL.revokeObjectURL(url); resolve(true); };
    w.onerror = (e) => { w.terminate(); URL.revokeObjectURL(url); reject(e); };
    w.postMessage(0);
  });
}

async function webAssembly() {
  // Smallest valid module: magic number and version.
  const bytes = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
  return WebAssembly.validate(bytes) && (await WebAssembly.instantiate(bytes)) instanceof Object;
}

/** Tiny canvas → PNG → createImageBitmap with the orientation option the media worker uses. */
async function imageBitmap() {
  const canvas = new OffscreenCanvas(2, 2);
  canvas.getContext('2d').fillRect(0, 0, 2, 2);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const ok = bmp.width === 2 && bmp.height === 2;
  bmp.close?.();
  return ok;
}

async function offscreenCanvas() {
  const canvas = new OffscreenCanvas(4, 4);
  canvas.getContext('2d').fillRect(0, 0, 4, 4);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return blob.size > 0 && blob.type === 'image/jpeg';
}

async function sha256() {
  const d = await crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3]));
  return d.byteLength === 32;
}

/**
 * Opening about:blank only probes the pop-up blocker; it is closed at once. Must run
 * synchronously inside the tap (before any await), or the browser blocks it for lack of a gesture.
 */
function googlePopup() {
  let w = null;
  try { w = window.open('about:blank', '_blank'); } catch { return false; }
  if (!w) return false;
  try { w.close(); } catch { /* ignore */ }
  return true;
}

async function storageEstimate() {
  const e = await navigator.storage.estimate();
  return Number.isFinite(e?.quota);
}

/** Runs every test and returns { feature_id: true | false | 'unknown' }. Call it from a tap. */
export async function probeCompat() {
  const out = {};
  try { out.google_popup = googlePopup(); } catch { out.google_popup = 'unknown'; }
  const tests = {
    indexeddb: () => typeof indexedDB !== 'undefined' && openDatabase(),
    module_worker: () => typeof Worker !== 'undefined' && moduleWorker(),
    webassembly: () => typeof WebAssembly === 'object' && webAssembly(),
    image_bitmap: () => typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined' && imageBitmap(),
    offscreen_canvas: () => typeof OffscreenCanvas !== 'undefined' && offscreenCanvas(),
    crypto_subtle: () => Boolean(globalThis.crypto?.subtle) && sha256(),
    wake_lock: () => Boolean(navigator.wakeLock && typeof navigator.wakeLock.request === 'function'),
    storage_persist: () => typeof navigator.storage?.persist === 'function',
    storage_estimate: () => typeof navigator.storage?.estimate === 'function' && storageEstimate(),
    service_worker: () => 'serviceWorker' in navigator && location.protocol !== 'file:',
    folder_input: () => 'webkitdirectory' in document.createElement('input'),
    drag_folder: () => typeof DataTransferItem !== 'undefined' && typeof DataTransferItem.prototype.webkitGetAsEntry === 'function',
    intersection_observer: () => typeof IntersectionObserver === 'function',
  };
  for (const [id, fn] of Object.entries(tests)) out[id] = await check(fn);
  try {
    const s = installState();
    out.install_pwa = s.installed || s.canInstall ? true : 'unknown';
  } catch { out.install_pwa = 'unknown'; }
  // Dragging folders is a desktop thing: on a touch-only device its absence is not a failure.
  if (out.drag_folder === false && navigator.maxTouchPoints > 0) out.drag_folder = 'unknown';
  return out;
}
