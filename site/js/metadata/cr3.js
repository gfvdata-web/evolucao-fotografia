// Canon CR3 container helpers (ISO-BMFF). Works on a Blob/File and reads only
// the box headers it needs, never the whole 30 MB file.
//
// CR3 layout used here: moov → trak[0] → mdia → minf → stbl → {stsz, co64|stco}
// points at the first track sample, which is a full-size JPEG rendered by the
// camera (6240×4160 on the EOS RP). It is *camera-processed* (same pipeline as
// the camera JPEG); a neutral RAW rendering needs the desktop importer.

async function readBytes(blob, offset, length) {
  return new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
}

const fourcc = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/** Reads the header of the box at `offset`. Returns null past the end. */
async function boxAt(blob, offset, end) {
  if (offset + 8 > end) return null;
  const h = await readBytes(blob, offset, 16);
  const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
  let size = dv.getUint32(0);
  const type = fourcc(h, 4);
  let header = 8;
  if (size === 1) { size = Number(dv.getBigUint64(8)); header = 16; } else if (size === 0) size = end - offset;
  if (size < header || offset + size > end) throw new Error(`Caixa CR3 inválida: ${type} em ${offset}`);
  return { type, offset, size, header, bodyStart: offset + header, end: offset + size };
}

async function children(blob, parent) {
  const out = [];
  let o = parent.bodyStart;
  while (o < parent.end) {
    const b = await boxAt(blob, o, parent.end);
    if (!b) break;
    out.push(b);
    o = b.end;
  }
  return out;
}

/** True when the first bytes are an ISO-BMFF ftyp with Canon's "crx " brand. */
export function isCr3Header(bytes) {
  return bytes.length >= 12 && fourcc(bytes, 4) === 'ftyp' && fourcc(bytes, 8) === 'crx ';
}

/**
 * Locates the full-size JPEG of the first track.
 * @returns {Promise<{offset: number, length: number}|null>}
 */
export async function findEmbeddedJpeg(blob) {
  if (!isCr3Header(await readBytes(blob, 0, 12))) return null;
  const root = { bodyStart: 0, end: blob.size };
  const top = await children(blob, root);
  const moov = top.find((b) => b.type === 'moov');
  if (!moov) return null;
  const trak = (await children(blob, moov)).find((b) => b.type === 'trak');
  if (!trak) return null;

  // Walk down the container chain to stbl.
  let node = trak;
  for (const name of ['mdia', 'minf', 'stbl']) {
    node = (await children(blob, node)).find((b) => b.type === name);
    if (!node) return null;
  }
  const stbl = await children(blob, node);
  const stsz = stbl.find((b) => b.type === 'stsz');
  const co = stbl.find((b) => b.type === 'co64' || b.type === 'stco');
  if (!stsz || !co) return null;

  const sz = await readBytes(blob, stsz.bodyStart, 16);
  const szv = new DataView(sz.buffer, sz.byteOffset, sz.byteLength);
  let length = szv.getUint32(4); // fixed sample size
  if (length === 0) length = szv.getUint32(12); // first entry of the table

  const cb = await readBytes(blob, co.bodyStart, 16);
  const cv = new DataView(cb.buffer, cb.byteOffset, cb.byteLength);
  const offset = co.type === 'co64' ? Number(cv.getBigUint64(8)) : cv.getUint32(8);

  if (offset + length > blob.size) return null;
  const soi = await readBytes(blob, offset, 3);
  if (soi[0] !== 0xff || soi[1] !== 0xd8 || soi[2] !== 0xff) return null;
  return { offset, length };
}

/** Blob of the embedded JPEG, or null when the file has none. */
export async function embeddedJpegBlob(blob) {
  const loc = await findEmbeddedJpeg(blob);
  return loc ? blob.slice(loc.offset, loc.offset + loc.length, 'image/jpeg') : null;
}
