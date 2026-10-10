// Builds a tiny synthetic Canon CR3 (ISO-BMFF) for tests. It mimics the parts of
// the real layout the app relies on: the Canon uuid box with CMT1..CMT4 TIFF
// blocks inside `moov`, and a first track whose single sample is a JPEG stored
// in `mdat` (located through stsz + co64). There is no real RAW data.
import { concat } from './tiff-writer.mjs';

export const CANON_UUID = '85c0b687820f11e08111f4ce462b6a48';

const enc = new TextEncoder();
const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const u64 = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n)); return b; };
const hex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));

export function box(type, ...payload) {
  const body = concat(payload);
  return concat([u32(8 + body.length), enc.encode(type), body]);
}
const fullBox = (type, ...payload) => box(type, new Uint8Array(4), ...payload);

/**
 * @param {object} p
 * @param {Uint8Array} p.cmt1 TIFF with IFD0 tags
 * @param {Uint8Array} p.cmt2 TIFF with Exif tags
 * @param {Uint8Array} p.cmt3 TIFF with Canon MakerNote tags
 * @param {Uint8Array} p.cmt4 TIFF with GPS tags
 * @param {Uint8Array} p.jpeg JPEG stored as the first track sample
 */
export function buildCr3({ cmt1, cmt2, cmt3, cmt4, jpeg }) {
  const ftyp = box('ftyp', enc.encode('crx '), u32(1), enc.encode('crx '), enc.encode('isom'));
  const canon = box('uuid', hex(CANON_UUID),
    box('CNCV', enc.encode('CanonCR3_001/01.09.00/00.00.00')),
    box('CMT1', cmt1), box('CMT2', cmt2), box('CMT3', cmt3), box('CMT4', cmt4));

  // The chunk offset depends on the final size of moov, so build it twice.
  const buildMoov = (offset) => {
    const stsd = fullBox('stsd', u32(1), box('CRAW', new Uint8Array(78)));
    const stsz = fullBox('stsz', u32(jpeg.length), u32(1));
    const co64 = fullBox('co64', u32(1), u64(offset));
    const trak = box('trak', box('mdia', box('minf', box('stbl', stsd, stsz, co64))));
    return box('moov', canon, trak);
  };
  const moovSize = buildMoov(0).length;
  const mdatHeader = 8;
  const jpegOffset = ftyp.length + moovSize + mdatHeader;
  return concat([ftyp, buildMoov(jpegOffset), box('mdat', jpeg)]);
}
