// v0.5.0: physics of the exposure and lens profiles (pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ev100, isoFor, shutterFor, shutterAtMost, shutterAtLeast, isoAtLeast, apertureAtLeast, depthOfField, airyDiskUm, stops,
} from '../../site/js/core/exposure.js';
import { lensFor, maxApertureOf, tableMaxAperture } from '../../site/js/core/lens-profiles.js';
import { approx } from './helpers.mjs';

test('EV a ISO 100: f/16, 1/100 s, ISO 100 ≈ 14,6 (sol); ISO alto desconta', () => {
  assert.ok(approx(ev100(16, 1 / 100, 100), Math.log2(25600), 1e-9));
  assert.ok(approx(ev100(1.8, 1 / 500, 12800), Math.log2(3.24 * 500) - 7, 1e-9));
});

test('ISO e velocidade que expõem a mesma cena (ida e volta)', () => {
  const ev = 12;
  const iso = isoFor(ev, 8, 1 / 640);
  assert.ok(approx(ev100(8, 1 / 640, iso), ev, 1e-9));
  assert.ok(approx(shutterFor(ev, 8, iso), 1 / 640, 1e-12));
});

test('escalas de 1/3 de ponto: arredonda sem subexpor nem passar da referência', () => {
  assert.equal(shutterAtMost(1 / 600), 1 / 640);
  assert.equal(shutterAtMost(1 / 50), 1 / 50);
  assert.equal(shutterAtLeast(1 / 600), 1 / 500);
  assert.equal(isoAtLeast(917), 1000);
  assert.equal(isoAtLeast(100), 100);
  assert.equal(isoAtLeast(1e6), 40000);
  assert.equal(apertureAtLeast(1.834), 1.8);
  assert.equal(apertureAtLeast(5.66), 5.6);
  assert.equal(apertureAtLeast(5.19), 5);
  assert.ok(approx(stops(100, 400), 2, 1e-9));
});

test('profundidade de campo: 50 mm f/1,8 a 1,14 m ≈ 5 cm; a 50 m chega ao infinito', () => {
  const d = depthOfField(50, 1.8, 1.14);
  assert.ok(d.total_m > 0.04 && d.total_m < 0.06, String(d.total_m));
  assert.ok(approx(d.hyperfocal_m, 46.35, 0.1)); // ExifTool deu 46,3 m na F02 (f/1,8)
  assert.equal(depthOfField(50, 1.8, 50).far_m, null);
});

test('difração: disco de Airy em f/16 ≈ 21 µm', () => {
  assert.ok(approx(airyDiskUm(16), 21.47, 0.01));
});

test('lentes: abertura máxima lida do arquivo vence a tabela; tabela interpola o zoom', () => {
  const rf75 = lensFor('RF75-300mm F4-5.6');
  assert.equal(rf75.stabilized, false);
  assert.ok(approx(tableMaxAperture(rf75, 205), 5.19, 0.1)); // amostra T05: 5,19 gravado pela câmera
  assert.equal(tableMaxAperture(rf75, 300), 5.66);
  assert.equal(tableMaxAperture(rf75, 75), 4);
  assert.deepEqual(maxApertureOf({ lens: { model: 'RF75-300mm F4-5.6', focal_length_mm: 300, max_aperture: 5.6 } }), { value: 5.6, source: 'file' });
  assert.equal(maxApertureOf({ lens: { model: 'RF75-300mm F4-5.6', focal_length_mm: 300, max_aperture: null } }).source, 'table');
  assert.equal(maxApertureOf({ lens: { model: 'EF-S 18-55', focal_length_mm: 18, max_aperture: null } }), null);
  assert.equal(lensFor('RF50mm F1.8 STM').max_aperture[0][1], 1.8);
});
