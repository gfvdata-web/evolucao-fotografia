// Quick EXIF read with exifr: standard tags only, in a few milliseconds, so the
// photo sheet appears immediately while ExifTool reads the MakerNotes.
import exifr from '../../vendor/exifr.mjs';
import { EXIFR_OPTIONS, fromExifr } from './normalize.js';

/** Engine label stored with each variant (a unit test keeps it equal to package.json). */
export const QUICK_ENGINE = 'exifr@7.1.3';

// The EXIF segment (APP1) of a JPEG is at most 64 KB and sits at the start of
// the file, so reading only the head is enough and avoids loading 8+ MB.
const HEAD_BYTES = 192 * 1024;

/** @returns {Promise<{capture: object, raw: object|null}>} empty capture when nothing is readable. */
export async function readQuickMetadata(file) {
  let raw = null;
  try {
    const head = await file.slice(0, HEAD_BYTES).arrayBuffer();
    raw = (await exifr.parse(head, EXIFR_OPTIONS)) || null;
  } catch {
    raw = null; // no EXIF or unsupported: the full reader still runs
  }
  return { capture: fromExifr(raw), raw };
}
