// v1.0: device performance averages and the grid thumbnail (key, never synced nor backed up).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addSample, emptyPerf, formatMs, normalizePerf, perfRows, PERF_WINDOW,
} from '../../site/js/core/perf.js';
import { blobKey } from '../../site/js/storage/photos-repo.js';
import { isThumbKey } from '../../site/js/pipeline/backup.js';
import { desiredAssets } from '../../site/js/core/drive-layout.js';
import { DEFAULT_SETTINGS } from '../../site/js/core/settings.js';
import { newPhotoRecord, newVariant } from '../../site/js/core/model.js';

test('média corrente: soma de amostras, ignora inválidas e não altera o original', () => {
  const p0 = emptyPerf();
  const p1 = addSample(p0, 'preview', 100);
  const p2 = addSample(p1, 'preview', 300);
  assert.equal(p0.preview.n, 0);
  assert.equal(p2.preview.n, 2);
  assert.equal(p2.preview.mean_ms, 200);
  assert.equal(addSample(p2, 'preview', NaN).preview.n, 2);
  assert.equal(addSample(p2, 'preview', -5).preview.n, 2);
  assert.equal(addSample(p2, 'nada', 5).preview.n, 2);
  assert.equal(p2.analysis.n, 0);
});

test('média corrente: depois da janela vira média móvel e acompanha o aparelho', () => {
  let p = { analysis: { n: PERF_WINDOW, mean_ms: 1000 } };
  p = addSample(p, 'analysis', 2000);
  assert.equal(p.analysis.n, PERF_WINDOW);
  assert.ok(p.analysis.mean_ms > 1000 && p.analysis.mean_ms < 1010);
});

test('normalizePerf descarta registro malformado', () => {
  const p = normalizePerf({ preview: { n: 'x', mean_ms: 5 }, metadata: { n: 3, mean_ms: 120 }, analysis: null });
  assert.equal(p.preview.n, 0);
  assert.deepEqual(p.metadata, { n: 3, mean_ms: 120 });
  assert.deepEqual(normalizePerf(undefined), emptyPerf());
});

test('texto em pt-BR: sem medida pede para enviar fotos; com medida mostra média e contagem', () => {
  const vazio = perfRows(emptyPerf());
  assert.equal(vazio.length, 3);
  assert.ok(vazio.every((r) => r.text === 'ainda sem medidas: envie algumas fotos'));
  let p = addSample(emptyPerf(), 'analysis', 2400);
  const [meta, , analise] = perfRows(p);
  assert.equal(analise.text, '2,4 s por foto (média de 1 foto)');
  assert.match(meta.text, /sem medidas/);
  p = addSample(p, 'analysis', 2400);
  assert.match(perfRows(p)[2].text, /média de 2 fotos/);
  assert.equal(formatMs(850.4), '850 ms');
  assert.equal(formatMs(1000), '1,0 s');
});

test('chave da miniatura: <id>/thumb, dentro do prefixo apagado com a foto', () => {
  assert.equal(blobKey.thumb('abc'), 'abc/thumb');
  assert.ok(blobKey.thumb('abc').startsWith('abc/'));
  assert.notEqual(blobKey.thumb('abc'), blobKey.preview('abc'));
});

test('miniatura não vai ao backup', () => {
  assert.equal(isThumbKey(blobKey.thumb('abc')), true);
  assert.equal(isThumbKey(blobKey.preview('abc')), false);
  assert.equal(isThumbKey(blobKey.crop('abc', 'jpeg-web', 'af')), false);
});

test('miniatura não vai ao Drive: nenhum arquivo desejado vem dela', () => {
  const r = newPhotoRecord({ id: '012345678901-20261010T143012.45-IMG_0001', matchKey: 'k', now: '2026-10-10T18:00:00Z' });
  r.preview = { width: 10, height: 10, from_variant: 'jpeg-web' };
  const v = newVariant({ kind: 'jpeg', source: 'web', file: { name: 'IMG_0001.JPG', size: 100 }, key: 'jpeg-web' });
  v.metadata_status = 'complete';
  v.analysis = { analyzed_at: 'a1', af: { rect: {} }, uniform: { rect: {} } };
  r.variants.push(v);
  const assets = desiredAssets(r, { ...DEFAULT_SETTINGS, keep_cr3: true });
  assert.ok(assets.length > 1);
  assert.ok(assets.every((a) => !/thumb|miniatura/i.test(`${a.key} ${a.folder} ${a.name} ${a.source.kind}`)));
  assert.ok(assets.some((a) => a.key === 'preview'));
});
