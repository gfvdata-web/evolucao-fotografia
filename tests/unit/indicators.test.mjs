import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolutionOfVariant, metadataOfVariant, shakeRisk, chainComparison, chainOrder, primaryVariant,
  buildIndicators, needsAnalysis, METRICS_VERSION, isCropMode, sceneLight,
} from '../../site/js/core/indicators.js';
import { matchSizes, PROFILES } from '../../site/js/core/camera-profiles.js';
import { newPhotoRecord, newVariant, emptyCapture, refreshRecord, SCHEMA_VERSION } from '../../site/js/core/model.js';
import { migrate } from '../../site/js/core/migrations.js';
import { afCenterForDisplay, displayToSource, regionAround } from '../../site/js/core/af-geometry.js';

const RP = 'Canon EOS RP';
function variant({ key = 'jpeg-web', kind = 'jpeg', w, h, exifW = null, exifH = null, size = 1000, model = RP, status = 'complete', missing = [] }) {
  const v = newVariant({ kind, source: 'web', file: { name: `${key}.JPG`, size, type: '', lastModified: 0 }, key });
  v.pixels = { width: w, height: h, decoded_from: 'jpeg' };
  v.capture = emptyCapture();
  v.capture.camera.model = model;
  v.capture.datetime_original = '2026-10-10T10:00:00';
  v.capture.image.exif_width = exifW;
  v.capture.image.exif_height = exifH;
  v.metadata_status = status;
  v.missing = missing;
  return v;
}

test('perfil EOS RP: todos os tamanhos da especificação, inclusive retrato', () => {
  assert.equal(PROFILES[RP].sizes.length, 17);
  assert.equal(matchSizes(PROFILES[RP], 4160, 6240)[0].label, 'L 3:2');
  assert.equal(matchSizes(PROFILES[RP], 3888, 2592)[0].crop_mode, true);
  assert.deepEqual(matchSizes(PROFILES[RP], 2048, 1365), []);
});

test('resolução: tamanho máximo da câmera', () => {
  const r = resolutionOfVariant(variant({ w: 6240, h: 4160, exifW: 6240, exifH: 4160 }));
  assert.equal(r.status, 'ok');
  assert.equal(r.kind, 'native');
});

test('resolução: proporções 16:9 e 1:1 também são tamanho máximo', () => {
  assert.equal(resolutionOfVariant(variant({ w: 6240, h: 3504 })).kind, 'native');
  assert.equal(resolutionOfVariant(variant({ w: 4160, h: 4160 })).kind, 'native');
});

test('resolução: S2 escolhido na câmera não é perda no caminho', () => {
  const r = resolutionOfVariant(variant({ w: 2400, h: 1600, exifW: 2400, exifH: 1600 }));
  assert.equal(r.status, 'info');
  assert.equal(r.kind, 'camera_size');
  assert.match(r.text, /Não é perda no caminho/);
});

test('resolução: modo recorte 1,6x', () => {
  const v = variant({ w: 3888, h: 2592 });
  assert.equal(resolutionOfVariant(v).kind, 'crop_mode');
  assert.equal(isCropMode(v), true);
});

test('resolução: menor que o declarado no EXIF = reduzida no caminho', () => {
  const r = resolutionOfVariant(variant({ w: 2048, h: 1365, exifW: 6240, exifH: 4160 }));
  assert.equal(r.status, 'alert');
  assert.equal(r.kind, 'path_reduced');
  assert.ok(Math.abs(r.fraction - (2048 * 1365) / (6240 * 4160)) < 1e-9);
  assert.match(r.text, /reduzida em algum ponto do caminho/);
});

test('resolução: sem EXIF de tamanho, mas fora da tabela da câmera = reduzida', () => {
  const r = resolutionOfVariant(variant({ w: 1920, h: 1280 }));
  assert.equal(r.kind, 'path_reduced');
});

test('resolução: câmera sem perfil só informa', () => {
  assert.equal(resolutionOfVariant(variant({ w: 4000, h: 3000, model: 'Outra' })).status, 'unknown');
});

test('metadados por arquivo: completo, sem MakerNotes, sem EXIF, em leitura', () => {
  assert.equal(metadataOfVariant(variant({ w: 1, h: 1 })).kind, 'complete');
  const noCanon = variant({ w: 1, h: 1, missing: ['focus.af_mode', 'focus.af_area_mode', 'focus.af_point', 'drive_mode', 'picture_style', 'noise_reduction.high_iso', 'noise_reduction.long_exposure'] });
  assert.equal(metadataOfVariant(noCanon).kind, 'makernotes_missing');
  const noExif = variant({ w: 1, h: 1 });
  noExif.capture.datetime_original = null; noExif.capture.camera.model = null;
  assert.equal(metadataOfVariant(noExif).kind, 'exif_missing');
  assert.equal(metadataOfVariant(variant({ w: 1, h: 1, status: 'quick' })).status, 'unknown');
});

test('tremido: referência 1/distância focal, sem estabilização', () => {
  const cap = (t, f) => { const c = emptyCapture(); c.exposure.shutter_s = t; c.lens.focal_length_mm = f; return c; };
  assert.equal(shakeRisk(cap(1 / 250, 50)).status, 'ok');
  assert.equal(shakeRisk(cap(1 / 50, 50)).status, 'ok'); // exactly the reference
  assert.equal(shakeRisk(cap(1 / 30, 50)).status, 'attention');
  const slow = shakeRisk(cap(1 / 15, 50));
  assert.equal(slow.status, 'alert');
  assert.match(slow.text, /3,3× mais lenta que a referência 1\/50 s/);
  assert.equal(shakeRisk(cap(1 / 100, 300)).status, 'alert'); // 3× at 300 mm
  assert.equal(shakeRisk(cap(1 / 60, 50), true).status, 'attention'); // crop: 80 mm equivalent
  assert.equal(shakeRisk(emptyCapture()).status, 'unknown');
});

function chainPhoto() {
  const p = newPhotoRecord({ id: 'p', matchKey: 'k', now: 't' });
  const card = variant({ key: 'jpeg-web', w: 2400, h: 1600, exifW: 2400, exifH: 1600, size: 466_000 });
  card.tag_count = 120;
  card.analysis = { metrics_version: METRICS_VERSION, jpeg: { quality_estimate: 95, sampling: '4:2:2' }, af: { laplacian_var: 900 }, uniform: { sigma: 1.2 } };
  const tab = variant({ key: 'jpeg-web-2', w: 1200, h: 800, exifW: 2400, exifH: 1600, size: 55_000,
    missing: ['focus.af_mode', 'focus.af_area_mode', 'focus.af_point', 'drive_mode', 'picture_style', 'noise_reduction.high_iso', 'noise_reduction.long_exposure'] });
  tab.tag_count = 40;
  tab.analysis = { metrics_version: METRICS_VERSION, jpeg: { quality_estimate: 70, sampling: '4:2:0' }, af: { laplacian_var: 300 }, uniform: { sigma: 2 } };
  p.variants.push(tab, card); // stored order does not matter
  refreshRecord(p, 't');
  return p;
}

test('cadeia: ordena da versão mais completa para a menos completa', () => {
  const p = chainPhoto();
  assert.deepEqual(chainOrder(p).map((v) => v.key), ['jpeg-web', 'jpeg-web-2']);
  assert.equal(primaryVariant(p).key, 'jpeg-web');
});

test('cadeia: aponta pixels, compressão, cor, MakerNotes e campos perdidos', () => {
  const c = chainComparison(chainPhoto());
  assert.equal(c.status, 'alert');
  const kinds = c.steps[0].findings.map((f) => f.kind);
  assert.deepEqual(kinds, ['pixels', 'quality', 'sampling', 'makernotes', 'tags']);
  assert.match(c.steps[0].findings[0].text, /3,8 MP → 1,0 MP \(−75%\)/);
  assert.match(c.steps[0].findings[1].text, /95 → 70/);
});

test('cadeia: nitidez só é comparada em versões de mesma resolução', () => {
  const p = chainPhoto();
  const c = chainComparison(p);
  assert.ok(!c.steps[0].findings.some((f) => f.kind === 'sharpness'));
  p.variants[0].pixels = { width: 2400, height: 1600 }; // same size, lower sharpness
  const c2 = chainComparison(p);
  assert.ok(c2.steps[0].findings.some((f) => f.kind === 'sharpness'));
});

test('cadeia: uma versão só não gera comparação', () => {
  const p = newPhotoRecord({ id: 'p', matchKey: 'k', now: 't' });
  p.variants.push(variant({ w: 6240, h: 4160 }));
  assert.equal(chainComparison(p), null);
});

test('indicadores completos e necessidade de recálculo por versão das métricas', () => {
  const p = chainPhoto();
  const ind = buildIndicators(p, 'agora');
  assert.equal(ind.metrics_version, METRICS_VERSION);
  assert.equal(ind.resolution.status, 'alert');
  assert.equal(ind.sharpness.value, 900);
  assert.equal(ind.noise.value, 1.2);
  assert.equal(ind.primary_variant, 'jpeg-web');
  assert.equal(needsAnalysis(p), false);
  p.variants[0].analysis.metrics_version = METRICS_VERSION - 1;
  assert.equal(needsAnalysis(p), true);
});

test('migração 1 → 2 acrescenta escolha de recortes e análise sem perder dados', () => {
  const v1 = {
    schema_version: 1, id: 'a', match_key: 'k', variants: [{ key: 'jpeg-web', kind: 'jpeg', pixels: { width: 1, height: 1 } }],
    capture: emptyCapture(), missing: [], indicators: null, rating: null,
  };
  const v2 = migrate(v1);
  assert.equal(v2.schema_version, SCHEMA_VERSION);
  assert.deepEqual(v2.crop_choice, { af: null, uniform: null });
  assert.equal(v2.crops, null);
  assert.equal(v2.variants[0].analysis, null);
  assert.equal(v2.variants[0].tag_count, null);
  assert.equal(v2.variants[0].kind, 'jpeg');
});

test('geometria: centro do AF, inversa da rotação e região recortada dentro da imagem', () => {
  const af = { af_image_width: 6000, af_image_height: 4000, y_axis: 'up', areas: [{ x: -1500, y: 1000, w: 600, h: 400 }], in_focus: [], selected: [] };
  const c = afCenterForDisplay(af, 1);
  assert.ok(Math.abs(c.cx - 0.25) < 1e-9 && Math.abs(c.cy - 0.25) < 1e-9);
  for (const o of [1, 3, 6, 8]) {
    // displayToSource must undo the display rotation used by afAreasForDisplay.
    const d = afCenterForDisplay(af, o);
    const [u, v] = displayToSource(d.cx, d.cy, o);
    assert.ok(Math.abs(u - 0.25) < 1e-9 && Math.abs(v - 0.25) < 1e-9, `orientação ${o}`);
  }
  const r = regionAround(0.99, 0.01, 512, 6240, 4160);
  assert.ok(r.x + r.w <= 1 && r.y >= 0);
  assert.ok(Math.abs(r.w - 512 / 6240) < 1e-12);
  assert.equal(afCenterForDisplay(null), null);
});

test('nitidez em ISO alto avisa que o ruído também conta; ruído com duas casas', () => {
  const p = chainPhoto();
  assert.doesNotMatch(buildIndicators(p).sharpness.text, /ruído também/);
  p.capture.exposure.iso = 12800;
  assert.match(buildIndicators(p).sharpness.text, /Em ISO 12800, o ruído também aumenta este número/);
  assert.match(buildIndicators(p).noise.text, /desvio de 1,20 níveis/);
});

test('luz da cena pela exposição: EV a ISO 100 e faixa de referência', () => {
  // The photo on the rating screen of 12/10/2026: f/1.8, 1/500 s, ISO 12800.
  const dim = sceneLight({ exposure: { aperture: 1.8, shutter_s: 1 / 500, iso: 12800 } });
  assert.equal(dim.status, 'info');
  assert.ok(Math.abs(dim.ev - 3.66) < 0.01);
  assert.equal(dim.band, 'dim');
  assert.equal(dim.text, 'Luz da cena (pela exposição): EV 3,7, pouca luz: interno escuro ou noite.');
  // Sunny 16: f/16, 1/100 s, ISO 100 ≈ EV 14,6.
  assert.equal(sceneLight({ exposure: { aperture: 16, shutter_s: 1 / 100, iso: 100 } }).band, 'sun');
  assert.equal(sceneLight({ exposure: { aperture: 4, shutter_s: 1 / 125, iso: 400 } }).band, 'bright');
  const neg = sceneLight({ exposure: { aperture: 1.8, shutter_s: 2, iso: 6400 } });
  assert.match(neg.text, /EV −5,3/);
});

test('luz da cena: campo ausente não vira valor plausível', () => {
  const r = sceneLight({ exposure: { aperture: 1.8, shutter_s: null, iso: null } });
  assert.equal(r.status, 'unknown');
  assert.equal(r.ev, null);
  assert.equal(r.text, 'Luz da cena não calculada: falta velocidade, ISO.');
  assert.equal(sceneLight(null).status, 'unknown');
});
