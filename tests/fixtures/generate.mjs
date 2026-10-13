// Generates the synthetic test fixtures into tests/fixtures/generated/.
// Nothing here comes from a real photo: pixels are a procedural pattern and all
// metadata is written by the tests themselves (see specs.mjs).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jpegJs from 'jpeg-js';
import { buildTiff, insertExif } from './lib/tiff-writer.mjs';
import { buildCr3 } from './lib/cr3-writer.mjs';
import { encodePng } from './lib/png-writer.mjs';
import {
  fullTree, noMakerNoteTree, ifd0Entries, exifEntries, gpsEntries, canonMakerNoteEntries, SHOTS, SCENE_SHOTS,
} from './specs.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'generated');

/** Raw RGBA of the procedural pattern (see patternJpeg). */
export function patternPixels(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Bottom-right quarter is a flat mid-grey area (for the uniform-area search).
      const flat = x >= width * 0.6 && y >= height * 0.6;
      const check = ((x >> 3) + (y >> 3)) % 2 ? 40 : 0;
      data[i] = flat ? 128 : Math.round((x / width) * 200) + check;
      data[i + 1] = flat ? 128 : Math.round((y / height) * 200) + check;
      data[i + 2] = flat ? 128 : 120;
      data[i + 3] = 255;
    }
  }
  return data;
}

/** v0.5.0: the pattern with the top 40% pure white (a blown sky, for the histogram). */
export function skyJpeg(width, height, quality = 92) {
  const data = patternPixels(width, height);
  for (let i = 0; i < width * Math.round(height * 0.4) * 4; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; }
  return new Uint8Array(jpegJs.encode({ data, width, height }, quality).data);
}

/** v0.5.1: the pattern smeared 11 px sideways (a shaken photo; blur ≈ 0.52 like F04/F06). */
export function smearJpeg(width, height, quality = 92) {
  const src = patternPixels(width, height);
  const out = Buffer.from(src);
  const L = 5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let k = -L; k <= L; k++) s += src[(y * width + Math.min(width - 1, Math.max(0, x + k))) * 4 + c];
        out[(y * width + x) * 4 + c] = Math.round(s / (2 * L + 1));
      }
    }
  }
  return new Uint8Array(jpegJs.encode({ data: out, width, height }, quality).data);
}

/** Procedural test pattern: gradient + checkerboard + flat area, so decoders have real edges. */
export function patternJpeg(width, height, quality = 90) {
  return new Uint8Array(jpegJs.encode({ data: patternPixels(width, height), width, height }, quality).data);
}

export function generateAll() {
  mkdirSync(join(OUT, 'cartao'), { recursive: true });
  mkdirSync(join(OUT, 'tablet'), { recursive: true });
  mkdirSync(join(OUT, 'cenas'), { recursive: true });
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
    // v0.2: JPEG S2 chosen in the camera (2400×1600), slow shutter.
    'IMG_0010.JPG': insertExif(patternJpeg(2400, 1600, 92), buildTiff(fullTree(SHOTS.small))),
    // v0.2: one shot in two versions — camera card vs. resized & recompressed on the tablet.
    'cartao/IMG_0011.JPG': insertExif(patternJpeg(2400, 1600, 95), buildTiff(fullTree(SHOTS.chain))),
    'tablet/IMG_0011.JPG': insertExif(patternJpeg(1200, 800, 70), buildTiff(noMakerNoteTree(SHOTS.chain))),
    // Shot in A+ (Scene Intelligent Auto).
    'IMG_0012.JPG': insertExif(base, buildTiff(fullTree(SHOTS.auto))),
    // v0.5.0: blown sky at 1/250 s, 50 mm, meter EV 9.5 (diagnosis: highlights).
    'IMG_0020_ceu.JPG': insertExif(skyJpeg(2400, 1600), buildTiff(fullTree(SHOTS.sky))),
  };
  const sharpS2 = patternJpeg(2400, 1600, 92);
  const smearS2 = smearJpeg(2400, 1600);
  for (const [name, s] of Object.entries(SCENE_SHOTS)) files[name] = insertExif(s.smear ? smearS2 : sharpS2, buildTiff(fullTree(s)));
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(OUT, name), bytes);
  return Object.keys(files).map((n) => join(OUT, n));
}

/**
 * v0.6: a session package as the importer writes it (importador/package.py):
 * IMG_0030 = JPEG + CR3 + neutral rendering (PNG, the pattern with noise in the
 * flat area, as a RAW without the camera's noise reduction); IMG_0031 = JPEG
 * only, without the ExifTool JSON (the site reads the file itself). The JSON
 * comes from the real ExifTool-WASM (needs "npm run vendor").
 */
export async function generatePackage() {
  const { readWithExifTool } = await import('../../site/js/metadata/exiftool-engine.js');
  const { readFileSync } = await import('node:fs');
  const wasm = readFileSync(join(OUT, '..', '..', '..', 'site', 'vendor', 'zeroperl.wasm'));
  const root = join(OUT, 'pacote', '2026-10-11_teste.efsessao');
  rmSync(join(OUT, 'pacote'), { recursive: true, force: true });
  for (const d of ['originais', 'metadados', 'neutro']) mkdirSync(join(root, d), { recursive: true });
  const W = 2400;
  const H = 1600;
  const files = {
    'originais/IMG_0030.JPG': insertExif(patternJpeg(W, H, 95), buildTiff(fullTree(SHOTS.pkgRaw))),
    'originais/IMG_0030.CR3': buildCr3({
      cmt1: buildTiff(ifd0Entries()),
      cmt2: buildTiff(exifEntries({ withMakerNote: false, ...SHOTS.pkgRaw })),
      cmt3: buildTiff(canonMakerNoteEntries(SHOTS.pkgRaw)),
      cmt4: buildTiff(gpsEntries()),
      jpeg: patternJpeg(W, H, 80),
    }),
    'originais/IMG_0031.JPG': insertExif(patternJpeg(W, H, 95), buildTiff(fullTree(SHOTS.pkgJpeg))),
  };
  const raw = patternPixels(W, H);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < raw.length; i += 4) {
    const n = Math.round((rnd() + rnd() + rnd() - 1.5) * 8); // ≈ σ 4 levels of noise everywhere
    for (let c = 0; c < 3; c++) raw[i + c] = Math.max(0, Math.min(255, raw[i + c] + n));
  }
  files['neutro/IMG_0030.png'] = encodePng(raw, W, H);
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(root, name), bytes);

  const meta = {};
  for (const name of ['originais/IMG_0030.JPG', 'originais/IMG_0030.CR3']) {
    const base = name.slice(name.indexOf('/') + 1);
    const json = await readWithExifTool(new File([files[name]], base), { loadWasm: async () => new Response(wasm) });
    meta[name] = `metadados/${base}.json`;
    writeFileSync(join(root, meta[name]), JSON.stringify(json));
  }
  const fileEntry = (file, kind) => ({ file, kind, size: files[file].length, metadata: meta[file] ?? null });
  const doc = {
    kind: 'efpacote', format_version: 1, importer_version: '0.6.0', created_at: '2026-10-13T12:00:00+00:00',
    day: '2026-10-11', name: 'teste', engines: { libraw: '0.22.1', rawpy: '0.27.1', exiftool: '13.42' },
    shots: [
      {
        name: 'IMG_0030',
        files: [fileEntry('originais/IMG_0030.JPG', 'jpeg'), fileEntry('originais/IMG_0030.CR3', 'cr3')],
        neutral: {
          file: 'neutro/IMG_0030.png', from: 'originais/IMG_0030.CR3',
          render: {
            width: W, height: H, demosaic: 'AHD', white_balance: 'camera', color: 'sRGB', tone_curve: 'camera_jpeg', tone_matched_to: 'IMG_0030.JPG',
            noise_reduction: 'none', sharpening: 'none', lens_correction: 'none', frame: { x: 12, y: 12, width: W, height: H },
            frame_source: 'cr3_crop', flip: 0, median_luma: { neutral: 120, camera_jpeg: 120 },
          },
        },
        problems: [],
      },
      { name: 'IMG_0031', files: [fileEntry('originais/IMG_0031.JPG', 'jpeg')], neutral: null, problems: [] },
    ],
  };
  writeFileSync(join(root, 'pacote.json'), JSON.stringify(doc, null, 1));
  return Object.keys(files).length + 3;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const written = generateAll();
  const inPackage = await generatePackage();
  console.log(`fixtures: ${written.length} arquivos em ${OUT}, mais um pacote do importador com ${inPackage}`);
}
