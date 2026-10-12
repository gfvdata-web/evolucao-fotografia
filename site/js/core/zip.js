// Minimal ZIP ("stored", no compression) for the .efbackup files (pure).
// Photos are already compressed, so storing is enough and keeps the code
// free of dependencies. The writer returns header bytes; the caller assembles
// [header, data, header, data, ..., central directory] as a Blob, so large
// files never need to be copied into one buffer. No ZIP64: up to 4 GB and
// 65 535 files per backup.

const ENC = new TextEncoder();
const DEC = new TextDecoder();
export const ZIP_MAX_BYTES = 0xffffffff;
export const ZIP_MAX_ENTRIES = 0xffff;

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }
  return CRC_TABLE;
}

/** CRC-32 of `bytes`, continuing from `crc` (pass the previous result to feed chunks). */
export function crc32(bytes, crc = 0) {
  const t = crcTable();
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i += 1) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// DOS date/time of 2026-01-01 00:00 (fixed: backups of the same data are identical).
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function header(size) {
  const b = new Uint8Array(size);
  return { b, dv: new DataView(b.buffer) };
}

/** Local file header for one entry. */
export function localHeader({ name, crc, size }) {
  const n = ENC.encode(name);
  const { b, dv } = header(30 + n.length);
  dv.setUint32(0, 0x04034b50, true);
  dv.setUint16(4, 20, true); // version needed
  dv.setUint16(6, 0x0800, true); // UTF-8 names
  dv.setUint16(8, 0, true); // stored
  dv.setUint16(10, DOS_TIME, true);
  dv.setUint16(12, DOS_DATE, true);
  dv.setUint32(14, crc, true);
  dv.setUint32(18, size, true);
  dv.setUint32(22, size, true);
  dv.setUint16(26, n.length, true);
  b.set(n, 30);
  return b;
}

/**
 * Central directory + end record for entries already written.
 * @param {{name: string, crc: number, size: number, offset: number}[]} entries
 * @param {number} cdOffset where the central directory starts
 */
export function centralDirectory(entries, cdOffset) {
  if (entries.length > ZIP_MAX_ENTRIES) throw new Error('backup com arquivos demais (limite de 65 535)');
  const parts = entries.map((e) => {
    const n = ENC.encode(e.name);
    const { b, dv } = header(46 + n.length);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, DOS_TIME, true);
    dv.setUint16(14, DOS_DATE, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.size, true);
    dv.setUint32(24, e.size, true);
    dv.setUint16(28, n.length, true);
    dv.setUint32(42, e.offset, true);
    b.set(n, 46);
    return b;
  });
  const cdSize = parts.reduce((s, p) => s + p.length, 0);
  if (cdOffset + cdSize > ZIP_MAX_BYTES) throw new Error('backup maior que 4 GB');
  const { b: end, dv } = header(22);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, entries.length, true);
  dv.setUint16(10, entries.length, true);
  dv.setUint32(12, cdSize, true);
  dv.setUint32(16, cdOffset, true);
  return [...parts, end];
}

/** Finds the end record in the last bytes of a file. */
export function parseEnd(tail, fileSize) {
  const dv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      const count = dv.getUint16(i + 10, true);
      const size = dv.getUint32(i + 12, true);
      const offset = dv.getUint32(i + 16, true);
      if (offset + size > fileSize) break;
      return { count, size, offset };
    }
  }
  throw new Error('não é um arquivo de backup válido (ZIP não reconhecido)');
}

/** Entries of the central directory: name, size, crc and where the local header starts. */
export function parseCentralDirectory(bytes, count) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let o = 0;
  for (let i = 0; i < count; i += 1) {
    if (dv.getUint32(o, true) !== 0x02014b50) throw new Error('backup corrompido (diretório do ZIP)');
    if (dv.getUint16(o + 10, true) !== 0) throw new Error('backup com arquivo comprimido: só backups deste app são aceitos');
    const nameLen = dv.getUint16(o + 28, true);
    const extraLen = dv.getUint16(o + 30, true);
    const commentLen = dv.getUint16(o + 32, true);
    out.push({
      name: DEC.decode(bytes.subarray(o + 46, o + 46 + nameLen)),
      crc: dv.getUint32(o + 16, true),
      size: dv.getUint32(o + 24, true),
      header_offset: dv.getUint32(o + 42, true),
    });
    o += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Offset of an entry's data, given the first 30 bytes of its local header. */
export function dataOffset(local30, headerOffset) {
  const dv = new DataView(local30.buffer, local30.byteOffset, local30.byteLength);
  if (dv.getUint32(0, true) !== 0x04034b50) throw new Error('backup corrompido (cabeçalho do arquivo)');
  return headerOffset + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
}
