// v0.4: what goes to the Drive (layout, pending work, merge rules) and the
// REST client, against the in-memory fake Drive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionDoc, desiredAssets, historyName, historyToPrune, mergeTombstones, newer, photoPending, photoWork,
  readSessionDoc, sessionFolderName, spaceStatus,
} from '../../site/js/core/drive-layout.js';
import { DEFAULT_SETTINGS } from '../../site/js/core/settings.js';
import { newPhotoRecord, newVariant, SCHEMA_VERSION } from '../../site/js/core/model.js';
import { createDriveClient, AuthError, NoSessionError, propsQuery, CHUNK } from '../../site/js/drive/api.js';
import { createFakeDrive, fakeFetch } from '../lib/fake-drive.mjs';

function photo() {
  const r = newPhotoRecord({ id: '012345678901-20261010T143012.45-IMG_0001', matchKey: 'k', now: '2026-10-10T18:00:00Z' });
  r.preview = { width: 10, height: 10, from_variant: 'jpeg-web' };
  const j = newVariant({ kind: 'jpeg', source: 'web', file: { name: 'IMG_0001.JPG', size: 100 }, key: 'jpeg-web' });
  j.metadata_status = 'complete';
  j.analysis = { analyzed_at: 'a1', af: { rect: {} }, uniform: { rect: {} } };
  const c = newVariant({ kind: 'cr3', source: 'web', file: { name: 'IMG_0001.CR3', size: 300 }, key: 'cr3-web' });
  c.metadata_status = 'complete';
  r.variants.push(j, c);
  r.capture.gps = { lat: -19.9, lon: -43.9 };
  return r;
}

test('pastas: nome legível com data, nome e id curto; fotos sem sessão à parte', () => {
  assert.equal(sessionFolderName({ id: 'ses-20261010-k3x9ab', name: 'Parque Ibirapuera / tarde', date: '2026-10-10' }), '2026-10-10_Parque-Ibirapuera-tarde_k3x9ab');
  assert.equal(sessionFolderName({ id: 'ses-semdata-aaaaaa', name: 'Ação!', date: null }), 'sem-data_Acao_aaaaaa');
  assert.equal(sessionFolderName(null), '_sem_sessao');
});

test('arquivos de cada foto seguem as configurações (JPEG sim, CR3 não por padrão)', () => {
  const keys = desiredAssets(photo(), DEFAULT_SETTINGS).map((a) => a.key);
  assert.deepEqual(keys, ['preview', 'metadata/jpeg-web', 'crop/jpeg-web/af', 'crop/jpeg-web/uniform', 'original/jpeg-web', 'metadata/cr3-web']);
  const withCr3 = desiredAssets(photo(), { ...DEFAULT_SETTINGS, keep_cr3: true, keep_jpeg: false }).map((a) => a.key);
  assert.ok(withCr3.includes('original/cr3-web'));
  assert.ok(!withCr3.includes('original/jpeg-web'));
  const orig = desiredAssets(photo(), DEFAULT_SETTINGS).find((a) => a.key === 'original/jpeg-web');
  assert.equal(orig.name, 'IMG_0001__jpeg-web.JPG');
  assert.equal(orig.folder, 'originais');
});

test('pendências: nova, enviada, avaliada depois, recortes refeitos, mudou de sessão', () => {
  const r = photo();
  assert.equal(photoPending(r, null, DEFAULT_SETTINGS), true);
  const assets = Object.fromEntries(desiredAssets(r, DEFAULT_SETTINGS).map((a) => [a.key, { id: `id-${a.key}`, sig: a.sig }]));
  const synced = { updated_at: r.updated_at, session_id: null, folder_session: 'none', assets };
  assert.equal(photoPending(r, synced, DEFAULT_SETTINGS), false);
  assert.equal(photoWork({ ...r, updated_at: 'depois' }, synced, DEFAULT_SETTINGS).record, true);
  const recrop = structuredClone(r);
  recrop.variants[0].analysis.analyzed_at = 'a2';
  assert.deepEqual(photoWork(recrop, synced, DEFAULT_SETTINGS).upload.map((a) => a.key), ['crop/jpeg-web/af', 'crop/jpeg-web/uniform']);
  const moved = { ...r, session_id: 'ses-1' };
  const w = photoWork(moved, synced, DEFAULT_SETTINGS);
  assert.equal(w.move, true);
  assert.equal(w.record, true);
  // Turning the GPS setting on sends originals and metadata again (now with location).
  assert.deepEqual(photoWork(r, synced, { ...DEFAULT_SETTINGS, keep_gps: true }).upload.map((a) => a.key).sort(),
    ['metadata/cr3-web', 'metadata/jpeg-web', 'original/jpeg-web']);
});

test('junção: vence o updated_at mais novo; empate não muda nada', () => {
  assert.equal(newer({ updated_at: '2' }, { updated_at: '3' }), 'remote');
  assert.equal(newer({ updated_at: '3' }, { updated_at: '2' }), 'local');
  assert.equal(newer({ updated_at: '3' }, { updated_at: '3' }), 'same');
  assert.equal(newer(null, { updated_at: '1' }), 'remote');
  assert.deepEqual(mergeTombstones([{ id: 'a', at: '1' }], [{ id: 'a', at: '2' }, { id: 'b', at: '1' }]),
    [{ id: 'a', at: '2' }, { id: 'b', at: '1' }]);
});

test('sessao.json: registros sem GPS por padrão, com ids dos arquivos; leitura valida', () => {
  const r = photo();
  const states = new Map([[r.id, { assets: { preview: { id: 'x', sig: 'jpeg-web' } } }]]);
  const doc = buildSessionDoc({ session: null, photos: [r], states, deleted: [{ id: 'z', at: '1' }], settings: DEFAULT_SETTINGS, appVersion: '0.4.0', now: 'n' });
  assert.equal(doc.kind, 'efsessao');
  assert.equal(doc.schema_version, SCHEMA_VERSION);
  assert.equal(doc.photos[0].capture.gps, null);
  assert.equal(r.capture.gps.lat, -19.9, 'o registro local não muda');
  const kept = buildSessionDoc({ session: null, photos: [r], states, deleted: [], settings: { ...DEFAULT_SETTINGS, keep_gps: true }, appVersion: '0.4.0', now: 'n' });
  assert.equal(kept.photos[0].capture.gps.lat, -19.9);
  const back = readSessionDoc(JSON.parse(JSON.stringify(doc)));
  assert.equal(back.photos[0].record.id, r.id);
  assert.equal(back.photos[0].record.drive_assets, undefined);
  assert.equal(back.photos[0].assets.preview.id, 'x');
  assert.deepEqual(back.deleted, [{ id: 'z', at: '1' }]);
  assert.throws(() => readSessionDoc({ kind: 'outro' }), /inválido/);
  assert.throws(() => readSessionDoc({ ...doc, schema_version: SCHEMA_VERSION + 1 }), /mais nova/);
});

test('histórico: mantém as N cópias mais novas', () => {
  const files = ['2026-10-01', '2026-10-03', '2026-10-02'].map((d) => ({ id: d, name: historyName(`${d}T10:00:00.000Z`) }));
  assert.deepEqual(historyToPrune(files, 2).map((f) => f.id), ['2026-10-01']);
  assert.deepEqual(historyToPrune(files, 0).length, 3);
  assert.match(historyName('2026-10-12T18:30:00.000Z'), /^sessao_2026-10-12T18-30-00-000Z\.json$/);
});

test('espaço: avisa perto do limite e bloqueia ao passar', () => {
  const gb = 1024 ** 3;
  assert.equal(spaceStatus(10 * gb, 100).status, 'ok');
  assert.equal(spaceStatus(95 * gb, 100).status, 'attention');
  assert.equal(spaceStatus(99 * gb, 100, 2 * gb).status, 'alert');
});

// ------------------------------------------------------------- REST client

const client = (drive, token = 'tk') => createDriveClient({ fetchImpl: fakeFetch(drive), getToken: async () => token });

test('cliente: pastas, busca por appProperties, envio pequeno, mover, copiar e lixeira', async () => {
  const drive = createFakeDrive();
  const api = client(drive);
  const root = await api.createFolder('EvolucaoFotografia', null, { ef_kind: 'root' });
  const sub = await api.createFolder('previas', root.id, { ef_kind: 'sub', ef_sub: 'previas' });
  const [found] = await api.list(propsQuery({ ef_kind: 'root' }));
  assert.equal(found.id, root.id);
  const file = await api.uploadSmall({ name: 'a.json', parentId: root.id, mimeType: 'application/json', content: new Blob(['{"ação":1}']), appProperties: { ef_kind: 'indice' } });
  assert.deepEqual(await api.downloadJson(file.id), { ação: 1 });
  const replaced = await api.uploadSmall({ id: file.id, name: 'a.json', mimeType: 'application/json', content: new Blob(['{"b":2}']) });
  assert.equal(replaced.id, file.id);
  assert.deepEqual(await api.downloadJson(file.id), { b: 2 });
  await api.update(file.id, { addParents: sub.id, removeParents: root.id });
  assert.deepEqual(drive.files.get(file.id).parents, [sub.id]);
  const copy = await api.copy(file.id, 'copia.json', root.id, { ef_kind: 'historico' });
  assert.equal(drive.text(drive.files.get(copy.id)), '{"b":2}');
  await api.update(file.id, { trashed: true });
  assert.equal((await api.list(propsQuery({ ef_kind: 'indice' }))).length, 0);
  assert.match(propsQuery({ k: "it's" }), /value='it\\'s'/);
});

test('cliente: original grande em partes, retomado depois de uma interrupção', async () => {
  const drive = createFakeDrive();
  const api = client(drive);
  const size = CHUNK * 2 + 1234;
  const bytes = new Uint8Array(size).map((_, i) => i % 251);
  const content = new Blob([bytes]);
  let saved = null;
  drive.state.interruptUploadAfterChunks = 1;
  await assert.rejects(api.uploadLarge({ name: 'IMG.CR3', mimeType: 'image/x-canon-cr3', content }, { onSession: (u) => { saved = u; } }), /503/);
  assert.ok(saved, 'endereço do envio guardado para retomar');
  const progress = [];
  const file = await api.uploadLarge({ name: 'IMG.CR3', mimeType: 'image/x-canon-cr3', content }, { sessionUrl: saved, onProgress: (n) => progress.push(n) });
  assert.equal(Number(file.size), size);
  assert.deepEqual(Buffer.from(drive.files.get(file.id).content), Buffer.from(bytes));
  assert.equal(progress.at(-1), size);
  const puts = drive.state.requests.filter((r) => r.method === 'PUT');
  assert.equal(puts.length, 1 + 1 + 1 + 2, '1ª parte, parte interrompida, consulta de onde parou e as 2 partes restantes');
});

test('cliente: token recusado vira AuthError (o app pede para reconectar)', async () => {
  const drive = createFakeDrive();
  drive.state.rejectToken = true;
  await assert.rejects(client(drive).list('trashed = false'), AuthError);
  await assert.rejects(client(createFakeDrive(), null).list('trashed = false'), AuthError);
});

test('cliente: sem ler o cabeçalho Range, envia parte a parte sem recomeçar; sem Location, avisa', async () => {
  const drive = createFakeDrive();
  drive.state.hideHeaders = ['range'];
  const api = client(drive);
  const bytes = new Uint8Array(CHUNK * 2 + 10).map((_, i) => i % 7);
  const file = await api.uploadLarge({ name: 'x.CR3', mimeType: 'image/x-canon-cr3', content: new Blob([bytes]) });
  assert.deepEqual(Buffer.from(drive.files.get(file.id).content), Buffer.from(bytes));
  assert.equal(drive.state.requests.filter((r) => r.method === 'PUT').length, 3);
  // A saved session whose position cannot be read is replaced by a new one.
  let saved = null;
  drive.state.interruptUploadAfterChunks = 1;
  await assert.rejects(api.uploadLarge({ name: 'y.CR3', mimeType: 'image/x-canon-cr3', content: new Blob([bytes]) }, { onSession: (u) => { saved = u; } }));
  let fresh = null;
  const again = await api.uploadLarge({ name: 'y.CR3', mimeType: 'image/x-canon-cr3', content: new Blob([bytes]) }, { sessionUrl: saved, onSession: (u) => { fresh = u; } });
  assert.notEqual(fresh, saved);
  assert.deepEqual(Buffer.from(drive.files.get(again.id).content), Buffer.from(bytes));

  drive.state.hideHeaders = ['location'];
  await assert.rejects(api.uploadLarge({ name: 'z.CR3', mimeType: 'image/x-canon-cr3', content: new Blob([bytes]) }), NoSessionError);
});
