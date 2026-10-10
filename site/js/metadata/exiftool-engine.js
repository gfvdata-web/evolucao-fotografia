// Runs ExifTool (WebAssembly build) on one file and returns its JSON.
// Used inside the metadata worker in the browser and directly by unit tests.
import { parseMetadata } from '../../vendor/exiftool.mjs';

/** -l adds {val, num} per tag; -G1 prefixes tags with their group (IFD0, ExifIFD, Canon...). */
export const EXIFTOOL_ARGS = ['-json', '-l', '-G1'];

// The WebAssembly Perl loader picks its browser code path by testing for
// `window` and `document`, which do not exist inside a Web Worker.
function ensureBrowserGlobals() {
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
  if (typeof globalThis.document === 'undefined') globalThis.document = {};
}

/**
 * @param {File|Blob} file
 * @param {{loadWasm: () => Promise<Response>}} opts how to fetch zeroperl.wasm
 * @returns {Promise<object>} ExifTool JSON for the file ("Group:Tag" → {desc, val, num?})
 */
export async function readWithExifTool(file, { loadWasm }) {
  ensureBrowserGlobals();
  const named = file instanceof File ? file : new File([file], 'arquivo');
  const result = await parseMetadata(named, {
    args: EXIFTOOL_ARGS,
    fetch: () => loadWasm(),
    transform: (out) => JSON.parse(out),
  });
  if (!result.success) throw new Error(result.error || `ExifTool terminou com código ${result.exitCode}`);
  return result.data[0];
}
