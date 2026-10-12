// JPEG encoding parameters read from the file header (pure): quantization
// tables, chroma subsampling and coding process. The quality estimate is the
// IJG/libjpeg-equivalent quality whose standard tables are closest to the
// file's tables. Cameras use their own tables, so read it as "comparable
// between versions of the same photo", not as the camera's quality menu.

// ITU-T T.81 Annex K standard tables, in natural (row-major) order.
const STD_LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const STD_CHROMA = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99,
  ...new Array(32).fill(99),
];
// DQT stores coefficients in zig-zag order; this maps zig-zag index → natural index.
const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

const SOF_NAMES = { 0xc0: 'baseline', 0xc1: 'extended', 0xc2: 'progressive', 0xc3: 'lossless' };

/**
 * Parses markers up to the first SOS.
 * @param {Uint8Array} bytes start of the JPEG (the header is usually < 100 KB)
 * @returns {{tables: Object<number, number[]>, process: string|null, width: number|null,
 *            height: number|null, sampling: string|null}|null} null if not a JPEG
 */
export function parseJpegHeader(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const tables = {};
  let process = null; let width = null; let height = null; let sampling = null;
  let o = 2;
  while (o + 4 <= bytes.length) {
    if (bytes[o] !== 0xff) { o++; continue; }
    const marker = bytes[o + 1];
    if (marker === 0xff) { o++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end
    const len = (bytes[o + 2] << 8) | bytes[o + 3];
    const seg = o + 4;
    const end = o + 2 + len;
    if (end > bytes.length) break;
    if (marker === 0xdb) {
      let p = seg;
      while (p < end) {
        const pq = bytes[p] >> 4; const tq = bytes[p] & 15; p++;
        const zz = [];
        for (let i = 0; i < 64; i++) {
          zz.push(pq ? (bytes[p] << 8) | bytes[p + 1] : bytes[p]);
          p += pq ? 2 : 1;
        }
        const natural = new Array(64);
        zz.forEach((v, i) => { natural[ZIGZAG[i]] = v; });
        tables[tq] = natural;
      }
    } else if (SOF_NAMES[marker]) {
      process = SOF_NAMES[marker];
      height = (bytes[seg + 1] << 8) | bytes[seg + 2];
      width = (bytes[seg + 3] << 8) | bytes[seg + 4];
      const nComp = bytes[seg + 5];
      if (nComp >= 3) {
        const hv = (c) => { const b = bytes[seg + 6 + c * 3 + 1]; return [b >> 4, b & 15]; };
        const [yh, yv] = hv(0); const [ch, cv] = hv(1);
        const rh = yh / ch; const rv = yv / cv;
        sampling = rh === 1 && rv === 1 ? '4:4:4' : rh === 2 && rv === 1 ? '4:2:2' : rh === 2 && rv === 2 ? '4:2:0' : `${yh}x${yv}/${ch}x${cv}`;
      } else if (nComp === 1) sampling = 'tons de cinza';
    }
    o = end;
  }
  return { tables, process, width, height, sampling };
}

function scaleFor(table, std) {
  let s = 0;
  for (let i = 0; i < 64; i++) s += (table[i] * 100) / std[i];
  return s / 64;
}
const qualityFromScale = (s) => Math.max(1, Math.min(100, Math.round(s <= 100 ? (200 - s) / 2 : 5000 / s)));

/** IJG-equivalent quality (1–100) from the luminance table (and chroma when present). */
export function estimateQuality(tables) {
  if (!tables?.[0]) return null;
  return qualityFromScale(scaleFor(tables[0], STD_LUMA));
}

export const estimateChromaQuality = (tables) => (tables?.[1] ? qualityFromScale(scaleFor(tables[1], STD_CHROMA)) : null);

/** Short fingerprint of the tables, to tell whether two files share encoder settings. */
export function tablesFingerprint(tables) {
  const keys = Object.keys(tables || {}).sort();
  if (!keys.length) return null;
  let h = 2166136261;
  for (const k of keys) for (const v of tables[k]) { h ^= v; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Everything the indicators need from a JPEG header. */
export function jpegSummary(bytes) {
  const hdr = parseJpegHeader(bytes);
  if (!hdr) return null;
  return {
    quality_estimate: estimateQuality(hdr.tables),
    chroma_quality_estimate: estimateChromaQuality(hdr.tables),
    sampling: hdr.sampling,
    process: hdr.process,
    width: hdr.width,
    height: hdr.height,
    tables_fingerprint: tablesFingerprint(hdr.tables),
  };
}
