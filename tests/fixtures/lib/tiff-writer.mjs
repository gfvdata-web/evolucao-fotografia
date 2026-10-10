// Minimal little-endian TIFF/EXIF writer used ONLY to build synthetic test fixtures.
// It supports the handful of field types the fixtures need, nested sub-IFDs
// (Exif, GPS) and a Canon MakerNote IFD embedded as an UNDEFINED value whose
// offsets are relative to the TIFF header (Canon's layout).

export const T = { BYTE: 1, ASCII: 2, SHORT: 3, LONG: 4, RATIONAL: 5, UNDEFINED: 7, SSHORT: 8, SLONG: 9, SRATIONAL: 10 };
const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 8: 2, 9: 4, 10: 8 };

/** Entry helpers. */
export const ascii = (tag, s) => ({ tag, type: T.ASCII, value: s });
export const short = (tag, v) => ({ tag, type: T.SHORT, value: [].concat(v) });
export const sshort = (tag, v) => ({ tag, type: T.SSHORT, value: [].concat(v) });
export const long = (tag, v) => ({ tag, type: T.LONG, value: [].concat(v) });
export const slong = (tag, v) => ({ tag, type: T.SLONG, value: [].concat(v) });
/** rational(tag, [num, den], [num, den], ...) */
export const rational = (tag, ...pairs) => ({ tag, type: T.RATIONAL, value: pairs });
export const srational = (tag, ...pairs) => ({ tag, type: T.SRATIONAL, value: pairs });
export const undef = (tag, bytes) => ({ tag, type: T.UNDEFINED, value: bytes });
export const subIfd = (tag, entries) => ({ tag, type: T.LONG, subIfd: entries });
export const makerNote = (entries) => ({ tag: 0x927c, type: T.UNDEFINED, makerNoteIfd: entries });

function encodeValue(entry) {
  const { type, value } = entry;
  if (type === T.ASCII) {
    const bytes = new TextEncoder().encode(value + '\0');
    return { bytes, count: bytes.length };
  }
  if (type === T.UNDEFINED || type === T.BYTE) {
    const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
    return { bytes, count: bytes.length };
  }
  const n = value.length;
  const bytes = new Uint8Array(n * SIZE[type]);
  const dv = new DataView(bytes.buffer);
  value.forEach((v, i) => {
    const o = i * SIZE[type];
    if (type === T.SHORT) dv.setUint16(o, v, true);
    else if (type === T.SSHORT) dv.setInt16(o, v, true);
    else if (type === T.LONG) dv.setUint32(o, v, true);
    else if (type === T.SLONG) dv.setInt32(o, v, true);
    else if (type === T.RATIONAL) { dv.setUint32(o, v[0], true); dv.setUint32(o + 4, v[1], true); }
    else if (type === T.SRATIONAL) { dv.setInt32(o, v[0], true); dv.setInt32(o + 4, v[1], true); }
  });
  return { bytes, count: n };
}

/**
 * Serializes one IFD placed at absolute `offset` (relative to the TIFF header).
 * Returns the bytes of the IFD + its data area + any nested sub-IFDs.
 */
function serializeIfd(entries, offset) {
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);
  const headerLen = 2 + sorted.length * 12 + 4;
  const chunks = [];
  let cursor = offset + headerLen;
  const align = () => { if (cursor % 2) { chunks.push(new Uint8Array(1)); cursor += 1; } };
  const records = [];

  for (const e of sorted) {
    if (e.makerNoteIfd) {
      align();
      const at = cursor;
      const bytes = serializeIfd(e.makerNoteIfd, at);
      chunks.push(bytes); cursor += bytes.length;
      records.push({ tag: e.tag, type: T.UNDEFINED, count: bytes.length, ptr: at });
      continue;
    }
    if (e.subIfd) { records.push({ tag: e.tag, type: T.LONG, count: 1, sub: e.subIfd }); continue; }
    const { bytes, count } = encodeValue(e);
    if (bytes.length <= 4) {
      const inline = new Uint8Array(4); inline.set(bytes);
      records.push({ tag: e.tag, type: e.type, count, inline });
    } else {
      align();
      records.push({ tag: e.tag, type: e.type, count, ptr: cursor });
      chunks.push(bytes); cursor += bytes.length;
    }
  }
  // Sub-IFDs go after this IFD's data area.
  for (const r of records.filter((r) => r.sub)) {
    align();
    r.ptr = cursor;
    const bytes = serializeIfd(r.sub, cursor);
    chunks.push(bytes); cursor += bytes.length;
  }

  const head = new Uint8Array(headerLen);
  const dv = new DataView(head.buffer);
  dv.setUint16(0, records.length, true);
  records.forEach((r, i) => {
    const o = 2 + i * 12;
    dv.setUint16(o, r.tag, true);
    dv.setUint16(o + 2, r.type, true);
    dv.setUint32(o + 4, r.count, true);
    if (r.inline) head.set(r.inline, o + 8);
    else dv.setUint32(o + 8, r.ptr, true);
  });
  dv.setUint32(headerLen - 4, 0, true);
  return concat([head, ...chunks]);
}

/** Builds a complete little-endian TIFF stream whose first IFD holds `entries`. */
export function buildTiff(entries) {
  const header = Uint8Array.from([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]);
  return concat([header, serializeIfd(entries, 8)]);
}

/** Inserts an APP1 Exif segment right after the SOI marker of a JPEG. */
export function insertExif(jpeg, tiff) {
  const payload = concat([new TextEncoder().encode('Exif\0\0'), tiff]);
  const len = payload.length + 2;
  if (len > 0xffff) throw new Error('EXIF too large for a single APP1 segment');
  const seg = concat([Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff]), payload]);
  return concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);
}

export function concat(parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
