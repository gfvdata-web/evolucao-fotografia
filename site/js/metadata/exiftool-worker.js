// Module worker: reads full metadata (including Canon MakerNotes) with ExifTool.
// Requests are processed one at a time; the WebAssembly runtime is heavy.
import { readWithExifTool } from './exiftool-engine.js';

const wasmUrl = new URL('../../vendor/zeroperl.wasm', import.meta.url);
let chain = Promise.resolve();

self.onmessage = (event) => {
  const { id, file } = event.data;
  chain = chain.then(async () => {
    const started = performance.now();
    try {
      const data = await readWithExifTool(file, { loadWasm: () => fetch(wasmUrl) });
      self.postMessage({ id, ok: true, data, ms: Math.round(performance.now() - started) });
    } catch (err) {
      self.postMessage({ id, ok: false, error: String(err?.message || err) });
    }
  });
};
