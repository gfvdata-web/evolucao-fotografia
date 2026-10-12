// Full reader (ExifTool WebAssembly) against the synthetic fixtures. Runs the
// real engine, so it also guards the vendored build (needs "npm run vendor").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWithExifTool } from '../../site/js/metadata/exiftool-engine.js';
import { fromExifTool, exifToolVersion, countTags } from '../../site/js/metadata/normalize.js';
import { missingFields } from '../../site/js/core/model.js';
import { EXPECTED } from '../fixtures/specs.mjs';
import { fixtureFile, loadWasmFromDisk, approx } from './helpers.mjs';

const loadWasm = loadWasmFromDisk();
const read = (name) => readWithExifTool(fixtureFile(name), { loadWasm });

test('JPEG da câmera: todos os campos, inclusive MakerNotes Canon', async () => {
  const json = await read('IMG_0001.JPG');
  assert.match(exifToolVersion(json), /^exiftool@13\./);
  const c = fromExifTool(json);
  assert.deepEqual(missingFields(c), []);
  assert.equal(c.datetime_original, '2026-10-10T14:30:12.45-03:00');
  assert.equal(c.camera.serial, EXPECTED.serial);
  assert.equal(c.lens.model, EXPECTED.lens);
  assert.ok(approx(c.exposure.shutter_s, EXPECTED.shutter));
  assert.ok(approx(c.exposure.ev_comp, EXPECTED.evComp));
  assert.equal(c.exposure.metering, 'Evaluative');
  assert.equal(c.focus.af_mode, 'One-shot AF');
  assert.equal(c.focus.af_area_mode, 'Single-point AF');
  assert.equal(c.drive_mode, 'Single-frame Shooting');
  assert.equal(c.picture_style, 'Standard');
  assert.equal(c.noise_reduction.high_iso, 'Standard');
  assert.equal(c.noise_reduction.long_exposure, 'Auto');
  assert.equal(c.image.quality, 'RAW');
  assert.equal(c.image.canon_image_size, 'Large');
  assert.ok(approx(c.gps.lat, EXPECTED.gps.lat, 1e-3));
});

test('ponto de AF: posição relativa ao centro, Y para cima (EOS); zeros que sobram descartados', async () => {
  const c = fromExifTool(await read('IMG_0001.JPG'));
  const af = c.focus.af_point;
  const { af: exp } = EXPECTED;
  assert.equal(af.af_image_width, exp.imageWidth);
  assert.equal(af.af_image_height, exp.imageHeight);
  assert.equal(af.y_axis, 'up');
  assert.deepEqual(af.areas, [{ x: exp.x, y: exp.y, w: exp.width, h: exp.height }]);
  assert.deepEqual(af.in_focus, [0]);
});

test('CR3: lê metadados e MakerNotes dos blocos CMT', async () => {
  const json = await read('IMG_0001.CR3');
  assert.equal(json['File:FileType']?.val, 'CR3');
  const c = fromExifTool(json);
  assert.deepEqual(missingFields(c), []);
  assert.equal(c.camera.model, EXPECTED.model);
  assert.equal(c.focus.af_area_mode, 'Single-point AF');
});

test('JPEG sem MakerNote: só os campos Canon faltam', async () => {
  const c = fromExifTool(await read('IMG_0002_sem_makernote.JPG'));
  assert.deepEqual(missingFields(c), [
    'focus.af_mode', 'focus.af_area_mode', 'focus.af_point', 'drive_mode', 'picture_style',
    'noise_reduction.high_iso', 'noise_reduction.long_exposure',
  ]);
  assert.equal(c.exposure.metering, 'Multi-segment');
  assert.equal(c.gps, null);
});

test('JPEG sem EXIF: nada lido, sem erro', async () => {
  const c = fromExifTool(await read('IMG_0003_sem_exif.JPG'));
  assert.equal(c.datetime_original, null);
  assert.equal(c.camera.model, null);
});

test('cadeia: o arquivo do tablet tem menos campos e perdeu os dados Canon', async () => {
  const card = await read('cartao/IMG_0011.JPG');
  const tablet = await read('tablet/IMG_0011.JPG');
  assert.ok(countTags(card) > countTags(tablet) + 30, `${countTags(card)} × ${countTags(tablet)}`);
  const c = fromExifTool(card);
  assert.equal(c.image.canon_image_size, 'Small 2');
  assert.equal(c.image.exif_width, 2400);
  assert.equal(fromExifTool(tablet).focus.af_mode, null);
});

test('foto lenta: velocidade 1/15 s lida com exatidão', async () => {
  const c = fromExifTool(await read('IMG_0010.JPG'));
  assert.ok(approx(c.exposure.shutter_s, 1 / 15));
});

test('A+ (Cena Inteligente Auto) não vira Programa: o MakerNote separa os dois', async () => {
  const auto = fromExifTool(await read('IMG_0012.JPG'));
  assert.equal(auto.exposure.program, 'Scene Intelligent Auto');
  const av = fromExifTool(await read('IMG_0001.JPG'));
  assert.equal(av.exposure.program, 'Aperture-priority AE');
});
