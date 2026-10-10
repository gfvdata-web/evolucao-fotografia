// Stable photo identifiers derived from EXIF (pure functions, no I/O).
//
// id        = <serial>-<YYYYMMDDTHHMMSS[.ss]>-<BASENAME>
//             e.g. 012345678901-20261010T143012.45-IMG_0001
// match_key = <YYYYMMDDTHHMMSS[.ss]>-<BASENAME>
//
// The match key ignores the serial so a file whose serial was stripped on the
// way (e.g. by a transfer app) still pairs with the CR3/JPEG of the same shot.
// Once a record exists its id never changes; new variants attach to it.

/** "2026:10:10 14:30:12.45-03:00" | "2026-10-10T14:30:12" → "20261010T143012.45" */
export function compactDateTime(value) {
  if (!value) return null;
  const m = String(value).match(/(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, sub] = m;
  return `${y}${mo}${d}T${h}${mi}${s}${sub ? `.${sub}` : ''}`;
}

/** "IMG_0001.JPG" → "IMG_0001" (upper case, extension removed, unsafe chars replaced). */
export function baseName(fileName) {
  const noExt = String(fileName).replace(/\.[^.]+$/, '');
  return noExt.toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');
}

/**
 * @param {{serial?: string|null, datetime?: string|null, fileName: string}} p
 * @returns {{id: string|null, matchKey: string|null}} null when there is no capture date.
 */
export function photoIdentity({ serial, datetime, fileName }) {
  const when = compactDateTime(datetime);
  if (!when) return { id: null, matchKey: null };
  const base = baseName(fileName);
  const who = serial ? String(serial).replace(/[^A-Za-z0-9]/g, '') : 'semserie';
  return { id: `${who}-${when}-${base}`, matchKey: `${when}-${base}` };
}

/** Provisional id for files without a capture date: hash of size + first 256 KB. */
export async function provisionalId(file) {
  const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const sizeBytes = new TextEncoder().encode(String(file.size));
  const data = new Uint8Array(head.length + sizeBytes.length);
  data.set(head); data.set(sizeBytes, head.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const hex = [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `semexif-${hex}-${baseName(file.name)}`;
}
