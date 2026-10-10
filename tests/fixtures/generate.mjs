// Generates the synthetic test fixtures into tests/fixtures/generated/.
// Nothing here comes from a real photo: pixels are a procedural pattern and all
// metadata is written by the tests themselves (see specs.mjs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jpegJs from 'jpeg-js';
import { buildTiff, insertExif } from './lib/tiff-writer.mjs';
import { buildCr3 } from './lib/cr3-writer.mjs';
import {
  fullTree, noMakerNoteTree, ifd0Entries, exifEntries, gpsEntries, canonMakerNoteEntries,
} from './specs.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'generated');

/** Procedural test pattern: gradient + checkerboard, so decoders have real edges. */
export function patternJpeg(width, height, quality = 90) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const check = ((x >> 3) + (y >> 3)) % 2 ? 40 : 0;
      data[i] = Math.round((x / width) * 200) + check;
      data[i + 1] = Math.round((y / height) * 200) + check;
      data[i + 2] = 120;
      data[i + 3] = 255;
    }
  }
  return new Uint8Array(jpegJs.encode({ data, width, height }, quality).data);
}

export function generateAll() {
  mkdirSync(OUT, { recursive: true });
  const base = patternJpeg(96, 64);
  const files = {
    'IMG_0001.JPG': insertExif(base, buildTiff(fullTree())),
    'IMG_0002_sem_makernote.JPG': insertExif(base, buildTiff(noMakerNoteTree())),
    'IMG_0003_sem_exif.JPG': base,
    'IMG_0001.CR3': buildCr3({
      cmt1: buildTiff(ifd0Entries()),
      cmt2: buildTiff(exifEntries({ withMakerNote: false })),
      cmt3: buildTiff(canonMakerNoteEntries()),
      cmt4: buildTiff(gpsEntries()),
      jpeg: patternJpeg(120, 80),
    }),
    'anotacoes.txt': new TextEncoder().encode('arquivo que não é foto'),
  };
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(OUT, name), bytes);
  return Object.keys(files).map((n) => join(OUT, n));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const written = generateAll();
  console.log(`fixtures: ${written.length} arquivos em ${OUT}`);
}
