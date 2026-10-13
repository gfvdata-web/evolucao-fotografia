// v0.6 (decisão 0015): pacote do importador, versão "RAW sem processamento"
// e a etapa sensor na comparação entre versões.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  packageRoots, readPackageDoc, neutralVariant, ingestOrder, NEUTRAL_KEY, PACKAGE_KIND,
} from '../../site/js/core/package-format.js';
import {
  chainComparison, chainOrder, detailOf, needsAnalysis, primaryVariant, sensorStep, METRICS_VERSION, THRESHOLDS,
} from '../../site/js/core/indicators.js';
import { newPhotoRecord, newVariant, emptyCapture, refreshRecord, RAW_NEUTRAL } from '../../site/js/core/model.js';
import { desiredAssets } from '../../site/js/core/drive-layout.js';
import { DEFAULT_SETTINGS, keepsOriginal } from '../../site/js/core/settings.js';

const EXAMPLE = JSON.parse(readFileSync(new URL('../../importador/tests/pacote-exemplo.json', import.meta.url), 'utf8'));

function analysis({ lap, sigma, luma = 120 }) {
  return {
    metrics_version: METRICS_VERSION, analyzed_at: '2026-10-13T00:00:00Z',
    af: { rect: { x: 0.4, y: 0.4, w: 0.08, h: 0.12 }, px: { w: 512, h: 512 }, laplacian_var: lap, sigma: 1, mean_luma: luma },
    uniform: { rect: { x: 0.1, y: 0.1, w: 0.04, h: 0.06 }, px: { w: 256, h: 256 }, laplacian_var: 2, sigma, mean_luma: luma },
    whole: null,
  };
}

function shot({ jpegPx = [6240, 4160], neutralPx = [6240, 4160], jpeg = { lap: 140, sigma: 0.25 }, raw = { lap: 100, sigma: 1.2 } } = {}) {
  const r = newPhotoRecord({ id: 'p1', matchKey: 'k1', now: '2026-10-13T00:00:00Z' });
  const capture = emptyCapture();
  capture.camera.model = 'Canon EOS RP';
  capture.noise_reduction.high_iso = 'Low';
  capture.picture_style = 'Standard';
  const j = newVariant({ kind: 'jpeg', source: 'importer', key: 'jpeg-importer', file: { name: 'IMG_0001.JPG', size: 9e6 } });
  j.pixels = { width: jpegPx[0], height: jpegPx[1], decoded_from: 'jpeg' };
  Object.assign(j, { capture, metadata_status: 'complete', missing: [], analysis: analysis(jpeg) });
  const c = newVariant({ kind: 'cr3', source: 'importer', key: 'cr3-importer', file: { name: 'IMG_0001.CR3', size: 3e7 } });
  c.pixels = { width: 6240, height: 4160, decoded_from: 'cr3-embedded-jpeg' };
  Object.assign(c, { capture: structuredClone(capture), metadata_status: 'complete', missing: [], analysis: analysis({ lap: 130, sigma: 0.05 }) });
  const n = neutralVariant({
    neutral: { file: 'neutro/IMG_0001.png', from: 'originais/IMG_0001.CR3', render: { width: neutralPx[0], height: neutralPx[1], tone_curve: 'camera_jpeg', tone_matched_to: 'IMG_0001.JPG' } },
    engines: { libraw: '0.22.1', rawpy: '0.27.1' }, cr3Variant: c, size: 27e6,
  });
  n.analysis = raw ? analysis(raw) : null;
  r.variants = [j, c, n];
  refreshRecord(r, '2026-10-13T00:00:00Z');
  return r;
}

test('pacote: arquivos agrupados por pacote (pasta escolhida, pasta-mãe com vários, arquivos soltos)', () => {
  assert.deepEqual(packageRoots(['pacote.json', 'originais/A.JPG']).packages, [{ root: '', files: ['pacote.json', 'originais/A.JPG'] }]);
  const { packages, loose } = packageRoots([
    'Desktop/2026-10-12_cartao.efsessao/pacote.json', 'Desktop/2026-10-12_cartao.efsessao/neutro/A.png',
    'Desktop/2026-10-13_cartao.efsessao/pacote.json', 'Desktop/foto.JPG',
  ]);
  assert.deepEqual(packages.map((p) => [p.root, p.files]), [
    ['Desktop/2026-10-12_cartao.efsessao/', ['pacote.json', 'neutro/A.png']],
    ['Desktop/2026-10-13_cartao.efsessao/', ['pacote.json']],
  ]);
  assert.deepEqual(loose, ['Desktop/foto.JPG']);
});

test('pacote: o exemplo escrito pelo importador Python é lido pelo site', () => {
  assert.equal(EXAMPLE.kind, PACKAGE_KIND);
  const doc = readPackageDoc(EXAMPLE);
  assert.equal(doc.day, '2026-10-12');
  assert.equal(doc.shots.length, 2);
  assert.equal(doc.shots[0].neutral.render.width, 6240);
  assert.deepEqual(ingestOrder(doc.shots[0].files).map((f) => f.kind), ['jpeg', 'cr3']);
  assert.equal(doc.shots[1].neutral, null);
});

test('pacote: recusa outro tipo, formato mais novo e caminhos fora do pacote', () => {
  assert.throws(() => readPackageDoc({ ...EXAMPLE, kind: 'efsessao' }), /não é de um pacote do importador/);
  assert.throws(() => readPackageDoc({ ...EXAMPLE, format_version: 2 }), /versão mais nova do importador/);
  for (const file of ['../segredo.txt', 'originais/../../x', 'C:/Users/x.JPG', '/etc/passwd', 'originais/sub/x.JPG']) {
    const doc = structuredClone(EXAMPLE);
    doc.shots[0].files[0].file = file;
    assert.throws(() => readPackageDoc(doc), /arquivo inválido/, file);
  }
  const noSize = structuredClone(EXAMPLE);
  delete noSize.shots[0].neutral.render.width;
  assert.throws(() => readPackageDoc(noSize), /revelação inválida/);
});

test('versão RAW sem processamento: repete a captura do CR3, transitória, nunca vai inteira ao Drive', () => {
  const r = shot();
  const n = r.variants.find((v) => v.kind === RAW_NEUTRAL);
  assert.equal(n.key, NEUTRAL_KEY);
  assert.equal(n.from_variant, 'cr3-importer');
  assert.equal(n.transient, true);
  assert.equal(n.capture.noise_reduction.high_iso, 'Low');
  assert.deepEqual(n.engines, ['libraw@0.22.1', 'rawpy@0.27.1']);
  assert.equal(r.capture.picture_style, 'Standard'); // the merge still comes from the camera files
  assert.equal(keepsOriginal({ ...DEFAULT_SETTINGS, keep_jpeg: true, keep_cr3: true }, RAW_NEUTRAL), false);
  const assets = desiredAssets(r, { ...DEFAULT_SETTINGS, keep_cr3: true }).map((a) => a.key);
  assert.ok(assets.includes(`crop/${NEUTRAL_KEY}/af`) && assets.includes(`crop/${NEUTRAL_KEY}/uniform`));
  assert.ok(!assets.includes(`original/${NEUTRAL_KEY}`));
  assert.ok(!assets.includes(`metadata/${NEUTRAL_KEY}`));
  assert.ok(assets.includes('original/cr3-importer'));
});

test('versão principal continua o JPEG da câmera, mesmo com o RAW maior ou do mesmo tamanho', () => {
  assert.equal(primaryVariant(shot()).key, 'jpeg-importer');
  const reduced = shot({ jpegPx: [2048, 1365] });
  reduced.variants = reduced.variants.filter((v) => v.kind !== 'cr3');
  assert.equal(primaryVariant(reduced).key, 'jpeg-importer');
  const onlyRaw = shot();
  onlyRaw.variants = onlyRaw.variants.filter((v) => v.kind === RAW_NEUTRAL);
  assert.equal(primaryVariant(onlyRaw).key, NEUTRAL_KEY);
});

test('cadeia: o RAW vem primeiro e é comparado com o JPEG da câmera (etapa sensor)', () => {
  const r = shot();
  assert.deepEqual(chainOrder(r).map((v) => v.key), [NEUTRAL_KEY, 'cr3-importer', 'jpeg-importer']);
  const chain = chainComparison(r);
  assert.equal(chain.versions[0].kind, RAW_NEUTRAL);
  const [sensor, next] = chain.steps;
  assert.equal(sensor.sensor, true);
  assert.equal(sensor.from, NEUTRAL_KEY);
  assert.equal(sensor.to, 'jpeg-importer');
  assert.deepEqual(sensor.findings.map((f) => f.kind), ['noise_reduction', 'sharpening']);
  assert.match(sensor.findings[0].text, /1,20 → 0,25/);
  assert.match(sensor.findings[0].text, /redução de ruído em ISO alto: Baixa/);
  // detail without noise: 100 − 20 × 1,2² = 71 → 140 − 20 × 0,25² = 139
  assert.match(sensor.findings[1].text, /detalhe 71 → 139 .*\+95%, já sem o ruído/);
  assert.ok(sensor.findings.every((f) => f.severity === 'info'));
  assert.deepEqual([next.from, next.to], ['cr3-importer', 'jpeg-importer']); // the rest of the chain is unchanged
});

test('etapa sensor: ruído do RAW tirado da conta; ruído invisível (σ < 0,8) não vira achado', () => {
  // ISO 12800 like F08: the RAW's "sharpness" is mostly noise; removing it is not removing detail.
  const high = sensorStep(shot({ raw: { lap: 900, sigma: 6 }, jpeg: { lap: 200, sigma: 0.5 } }));
  assert.equal(detailOf({ sharpness: 900, noise_sigma: 6 }), 180);
  assert.deepEqual(high.findings.map((f) => f.kind), ['noise_reduction']); // 180 → 195: detail kept
  const iso100 = sensorStep(shot({ raw: { lap: 50, sigma: 0.6 }, jpeg: { lap: 120, sigma: 0.3 } }));
  assert.deepEqual(iso100.findings.map((f) => f.kind), ['sharpening']);
});

test('etapa sensor: detalhe apagado, nada relevante, brilho diferente, escala diferente', () => {
  const lost = sensorStep(shot({ jpeg: { lap: 60, sigma: 0.6 }, raw: { lap: 100, sigma: 0.6 } }));
  assert.deepEqual(lost.findings.map((f) => f.kind), ['detail_loss']);
  const same = sensorStep(shot({ jpeg: { lap: 105, sigma: 0.58 }, raw: { lap: 100, sigma: 0.6 } }));
  assert.deepEqual(same.findings, []);
  const r = shot({ jpeg: { lap: 105, sigma: 0.58, luma: 150 }, raw: { lap: 100, sigma: 0.6, luma: 120 } });
  assert.deepEqual(sensorStep(r).findings.map((f) => f.kind), ['brightness']);
  assert.ok(THRESHOLDS.sensor_luma_diff < 30);
  const reduced = shot({ jpegPx: [2048, 1365] });
  assert.equal(sensorStep(reduced).to, 'cr3-importer'); // with more pixels, the CR3 is the primary: same scale
  reduced.variants = reduced.variants.filter((v) => v.kind !== 'cr3');
  assert.deepEqual(sensorStep(reduced).findings.map((f) => f.kind), ['scale']);
  assert.equal(sensorStep(shot({ raw: null })), null); // not measured yet
});

test('análise: o RAW transitório é medido uma vez; versões novas das métricas não pedem o arquivo de volta', () => {
  const pending = shot({ raw: null });
  assert.equal(needsAnalysis(pending), true);
  const done = shot();
  assert.equal(needsAnalysis(done), false);
  done.variants.find((v) => v.kind === RAW_NEUTRAL).analysis.metrics_version = METRICS_VERSION - 1;
  assert.equal(needsAnalysis(done), false);
  done.variants.find((v) => v.kind === 'jpeg').analysis.metrics_version = METRICS_VERSION - 1;
  assert.equal(needsAnalysis(done), true);
});
