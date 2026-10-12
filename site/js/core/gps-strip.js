// Removes the GPS location from JPEG and CR3 files (pure, works on a copy of
// the bytes). Used before sending originals to the Drive when the "keep
// location" setting is off.
//
// The file keeps its size and structure: the GPS IFD is emptied (entry count
// 0) and every byte it pointed to is zeroed, so no coordinate is left behind
// and every other offset in the file stays valid.

const GPS_IFD_TAG = 0x8825;
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

/**
 * Wipes the GPS IFD of the TIFF structure that starts at `start`. With
 * `direct`, IFD0 itself is the GPS IFD (Canon's CMT4 block in a CR3).
 * @returns {boolean} true when a GPS IFD was found and wiped
 */
export function wipeTiffGps(bytes, start, end = bytes.length, { direct = false } = {}) {
  if (start + 8 > end) return false;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = String.fromCharCode(bytes[start], bytes[start + 1]);
  if (order !== 'II' && order !== 'MM') return false;
  const le = order === 'II';
  const u16 = (o) => dv.getUint16(start + o, le);
  const u32 = (o) => dv.getUint32(start + o, le);
  const inside = (o, n = 0) => o >= 0 && start + o + n <= end;

  const ifd0 = u32(4);
  if (!inside(ifd0, 2)) return false;
  let gps = direct ? ifd0 : null;
  for (let i = 0, n = direct ? 0 : u16(ifd0); i < n; i += 1) {
    const e = ifd0 + 2 + i * 12;
    if (!inside(e, 12)) break;
    if (u16(e) === GPS_IFD_TAG) gps = u32(e + 8);
  }
  if (gps === null || !inside(gps, 2)) return false;

  const count = u16(gps);
  for (let i = 0; i < count; i += 1) {
    const e = gps + 2 + i * 12;
    if (!inside(e, 12)) break;
    const size = (TYPE_SIZE[u16(e + 2)] || 1) * u32(e + 4);
    if (size > 4) {
      const at = u32(e + 8);
      if (inside(at, size)) bytes.fill(0, start + at, start + at + size);
    }
    bytes.fill(0, start + e, start + e + 12);
  }
  dv.setUint16(start + gps, 0, le); // empty IFD; the next-IFD pointer after it stays as it was
  return true;
}

/** JPEG: wipes the GPS of every Exif APP1 segment. Returns how many were wiped. */
export function stripGpsJpeg(bytes) {
  let wiped = 0;
  let o = 2;
  while (o + 4 <= bytes.length && bytes[o] === 0xff) {
    const marker = bytes[o + 1];
    if (marker === 0xda || marker === 0xd9) break; // image data starts
    const len = (bytes[o + 2] << 8) | bytes[o + 3];
    const isExif = marker === 0xe1 && String.fromCharCode(...bytes.subarray(o + 4, o + 10)) === 'Exif\0\0';
    if (isExif && wipeTiffGps(bytes, o + 10, o + 2 + len)) wiped += 1;
    o += 2 + len;
  }
  return wiped;
}

const fourcc = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/**
 * CR3: Canon keeps the GPS in the CMT4 box (moov → uuid → CMT4), a TIFF whose
 * IFD0 is the GPS IFD.
 * The embedded JPEG previews carry no GPS. Returns how many TIFFs were wiped.
 */
export function stripGpsCr3(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let wiped = 0;
  const walk = (from, to, depth) => {
    let o = from;
    while (o + 8 <= to) {
      let size = dv.getUint32(o);
      const type = fourcc(bytes, o + 4);
      let header = 8;
      if (size === 1) { size = Number(dv.getBigUint64(o + 8)); header = 16; } else if (size === 0) size = to - o;
      if (size < header || o + size > to) break;
      if (type === 'uuid') header += 16;
      if (type === 'CMT4' && wipeTiffGps(bytes, o + header, o + size, { direct: true })) wiped += 1;
      else if (depth < 3 && (type === 'moov' || type === 'uuid')) walk(o + header, o + size, depth + 1);
      o += size;
    }
  };
  walk(0, bytes.length, 0);
  return wiped;
}

/** Strips GPS from a JPEG or CR3 (by content). Returns a new Uint8Array and how many blocks were wiped. */
export function stripGps(input) {
  const bytes = new Uint8Array(input); // copy: the stored original is never changed
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, wiped: stripGpsJpeg(bytes) };
  if (fourcc(bytes, 4) === 'ftyp') return { bytes, wiped: stripGpsCr3(bytes) };
  return { bytes, wiped: 0 };
}

/** ExifTool JSON without any GPS tag (keys like "GPS:GPSLatitude", "Composite:GPSPosition"). */
export function stripGpsTags(json) {
  return Object.fromEntries(Object.entries(json || {}).filter(([k]) => !/(^|:)GPS/i.test(k)));
}

/** Photo record without location (capture of the shot and of every version). */
export function stripGpsRecord(record) {
  const clean = (c) => (c ? { ...c, gps: null } : c);
  return {
    ...record,
    capture: clean(record.capture),
    variants: (record.variants || []).map((v) => ({ ...v, capture: clean(v.capture) })),
  };
}
