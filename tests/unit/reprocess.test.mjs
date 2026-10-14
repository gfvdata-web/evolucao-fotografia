// v2.0: reprocessing plan (core/reprocess.js) — which photos have old measures and
// where each original comes from (this device, the Drive or nowhere).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reprocessPlan, staleCount, stalePhotos, staleVariants } from '../../site/js/core/reprocess.js';
import { METRICS_VERSION } from '../../site/js/core/indicators.js';

const OLD = METRICS_VERSION - 1;
const variant = (key, { version = METRICS_VERSION, analysis = true, transient = false, size = 1000 } = {}) => ({
  key, kind: key.startsWith('cr3') ? 'cr3' : 'jpeg', file: { name: `${key}.JPG`, size },
  pixels: { width: 6240, height: 4160 }, transient,
  analysis: analysis ? { metrics_version: version, analyzed_at: '2026-10-01T00:00:00Z' } : null,
});
const photo = (id, variants, session_id = 's1') => ({ id, session_id, variants });

const env = (over = {}) => ({
  hasLocal: () => false, syncState: () => undefined, driveConnected: true, ...over,
});

test('medidas antigas: só versões medidas com métricas anteriores; não medida ainda não conta', () => {
  const p = photo('a', [variant('jpeg-web', { version: OLD }), variant('cr3', { analysis: false })]);
  assert.deepEqual(staleVariants(p).map((v) => v.key), ['jpeg-web']);
  assert.equal(staleCount([photo('b', [variant('jpeg-web', { analysis: false })])]), 0);
  assert.equal(staleCount([photo('c', [variant('jpeg-web')])]), 0);
});

test('RAW sem processamento (transitório) nunca entra: a imagem inteira não existe mais', () => {
  const p = photo('a', [variant('jpeg-web'), variant('raw-neutral', { version: OLD, transient: true })]);
  assert.equal(staleCount([p]), 0);
});

test('filtro por sessão', () => {
  const photos = [photo('a', [variant('j', { version: OLD })], 's1'), photo('b', [variant('j', { version: OLD })], 's2'),
    photo('c', [variant('j', { version: OLD })], null)];
  assert.deepEqual(stalePhotos(photos, 's2').map((p) => p.id), ['b']);
  assert.equal(staleCount(photos), 3);
});

test('plano: original aqui, no Drive (com bytes) ou ausente, com o motivo', () => {
  const photos = [
    photo('here', [variant('jpeg-web', { version: OLD })]),
    photo('drive', [variant('jpeg-web', { version: OLD }), variant('cr3', { version: OLD })]),
    photo('none', [variant('jpeg-web', { version: OLD })]),
    photo('ok', [variant('jpeg-web')]),
  ];
  const sync = {
    drive: { assets: { 'original/jpeg-web': { id: 'f1', size: 8e6 }, 'original/cr3': { id: 'f2', size: 3e7 } } },
    none: { assets: { 'original/jpeg-web': { id: null, size: 0 } } },
  };
  const plan = reprocessPlan(photos, env({ hasLocal: (id) => id === 'here', syncState: (id) => sync[id] }));
  assert.equal(plan.total, 3);
  assert.deepEqual([plan.local, plan.drive, plan.missing], [1, 1, 1]);
  assert.equal(plan.download_bytes, 3.8e7);
  const byId = Object.fromEntries(plan.items.map((i) => [i.photo_id, i]));
  assert.deepEqual(byId.drive.downloads.map((d) => d.id), ['f1', 'f2']);
  assert.deepEqual(byId.none.missing, [{ variant: 'jpeg-web', reason: 'not_saved' }]);
});

test('plano: Drive desconectado não baixa nada e diz o motivo', () => {
  const photos = [photo('d', [variant('jpeg-web', { version: OLD })])];
  const plan = reprocessPlan(photos, env({ driveConnected: false, syncState: () => ({ assets: { 'original/jpeg-web': { id: 'f1', size: 5 } } }) }));
  assert.equal(plan.download_bytes, 0);
  assert.deepEqual(plan.items[0].missing, [{ variant: 'jpeg-web', reason: 'no_drive' }]);
});

test('plano: tamanho do arquivo como reserva quando o Drive não guardou o tamanho', () => {
  const photos = [photo('d', [variant('jpeg-web', { version: OLD, size: 1234 })])];
  const plan = reprocessPlan(photos, env({ syncState: () => ({ assets: { 'original/jpeg-web': { id: 'f1' } } }) }));
  assert.equal(plan.download_bytes, 1234);
});
