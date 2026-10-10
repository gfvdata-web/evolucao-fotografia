// Quick reader (exifr) against the synthetic fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readQuickMetadata, QUICK_ENGINE } from '../../site/js/metadata/quick.js';
import { isoFromExif } from '../../site/js/metadata/normalize.js';
import { missingFields, MAKERNOTE_FIELDS } from '../../site/js/core/model.js';
import { EXPECTED } from '../fixtures/specs.mjs';
import { ROOT, fixtureFile, approx } from './helpers.mjs';

test('isoFromExif junta data, subsegundos e fuso', () => {
  assert.equal(isoFromExif('2026:10:10 14:30:12', '45', '-03:00'), '2026-10-10T14:30:12.45-03:00');
  assert.equal(isoFromExif('2026:10:10 14:30:12', null, null), '2026-10-10T14:30:12');
  assert.equal(isoFromExif('2026:10:10 14:30:12.07+01:00', '99', '-03:00'), '2026-10-10T14:30:12.07+01:00');
  assert.equal(isoFromExif(null), null);
});

test('leitura rápida do JPEG da câmera: dados EXIF padrão', async () => {
  const { capture } = await readQuickMetadata(fixtureFile('IMG_0001.JPG'));
  assert.equal(capture.datetime_original, '2026-10-10T14:30:12.45-03:00');
  assert.equal(capture.camera.model, EXPECTED.model);
  assert.equal(capture.camera.serial, EXPECTED.serial);
  assert.equal(capture.lens.model, EXPECTED.lens);
  assert.ok(approx(capture.exposure.shutter_s, EXPECTED.shutter));
  assert.equal(capture.exposure.aperture, EXPECTED.aperture);
  assert.equal(capture.exposure.iso, EXPECTED.iso);
  assert.ok(approx(capture.exposure.ev_comp, EXPECTED.evComp));
  assert.equal(capture.exposure.program, 'Aperture-priority AE');
  assert.equal(capture.lens.focal_length_mm, EXPECTED.focal);
  assert.equal(capture.image.exif_width, EXPECTED.exifWidth);
  assert.ok(approx(capture.gps.lat, EXPECTED.gps.lat, 1e-3));
  assert.ok(approx(capture.gps.lon, EXPECTED.gps.lon, 1e-3));
});

test('leitura rápida não tem MakerNotes: só esses campos ficam faltando', async () => {
  const { capture } = await readQuickMetadata(fixtureFile('IMG_0001.JPG'));
  const missing = missingFields(capture);
  assert.ok(missing.length > 0);
  for (const f of missing) assert.ok(MAKERNOTE_FIELDS.has(f), `campo inesperado ausente: ${f}`);
});

test('JPEG sem EXIF: captura vazia, sem erro', async () => {
  const { capture, raw } = await readQuickMetadata(fixtureFile('IMG_0003_sem_exif.JPG'));
  assert.equal(raw, null);
  assert.equal(capture.datetime_original, null);
});

test('versão do exifr registrada na foto é a instalada', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(QUICK_ENGINE, `exifr@${pkg.dependencies.exifr}`);
});
