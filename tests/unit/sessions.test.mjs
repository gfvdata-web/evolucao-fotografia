import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySessionPatch, byCapture, captureDate, EXPERIMENT_PARAMETERS, experimentValue, formatDate, newSession,
  sessionId, sessionPhotos, sortSessions, suggestGroups,
} from '../../site/js/core/sessions.js';
import { EXPERIMENT_LABELS } from '../../site/js/core/glossary.js';
import { SCHEMA_VERSION, emptyCapture } from '../../site/js/core/model.js';

const photo = (id, datetime, session_id = null, exposure = {}) => {
  const capture = emptyCapture();
  capture.datetime_original = datetime;
  Object.assign(capture.exposure, exposure);
  return { id, session_id, capture, added_at: `add-${id}` };
};

test('dia da captura vem do relógio da câmera, sem converter fuso', () => {
  assert.equal(captureDate(photo('a', '2026-10-10T23:30:00-03:00')), '2026-10-10');
  assert.equal(captureDate(photo('b', null)), null);
});

test('sugestões: fotos sem sessão agrupadas por dia, mais recente primeiro, sem data por último', () => {
  const photos = [
    photo('a', '2026-10-10T14:00:00'), photo('b', '2026-10-11T08:00:00'), photo('c', null),
    photo('d', '2026-10-10T15:00:00'), photo('e', '2026-10-11T09:00:00', 'ses-x'),
  ];
  const sessions = [{ id: 'ses-1', date: '2026-10-10' }, { id: 'ses-2', date: '2026-10-12' }];
  const groups = suggestGroups(photos, sessions);
  assert.deepEqual(groups.map((g) => g.date), ['2026-10-11', '2026-10-10', null]);
  assert.deepEqual(groups[1].photo_ids, ['a', 'd']);
  assert.deepEqual(groups[1].sessions.map((s) => s.id), ['ses-1']);
  assert.deepEqual(groups[0].sessions, []);
  assert.deepEqual(groups[2].photo_ids, ['c']);
});

test('nova sessão: nome padrão pela data, versão do esquema e id com a data', () => {
  const s = newSession({ id: sessionId('2026-10-10', 'abc123'), date: '2026-10-10', now: 't0' });
  assert.equal(s.id, 'ses-20261010-abc123');
  assert.equal(s.name, 'Sessão de 10/10/2026');
  assert.equal(s.schema_version, SCHEMA_VERSION);
  assert.equal(s.experiment, null);
  assert.equal(sessionId(null, 'x'), 'ses-semdata-x');
  assert.equal(newSession({ id: 'y', now: 't' }).name, 'Sessão sem data');
});

test('edição: valida data e experimento; nome vazio volta ao padrão', () => {
  const s = newSession({ id: 'x', date: '2026-10-10', now: 't0' });
  const e = applySessionPatch(s, {
    name: '  Parque  ', location: 'Ibirapuera', experiment: { parameter: 'iso', description: '100 a 12800' },
  }, 't1');
  assert.equal(e.name, 'Parque');
  assert.deepEqual(e.experiment, { parameter: 'iso', description: '100 a 12800' });
  assert.equal(e.updated_at, 't1');
  assert.equal(applySessionPatch(e, { name: '' }, 't2').name, 'Sessão de 10/10/2026');
  assert.equal(applySessionPatch(e, { experiment: null }, 't2').experiment, null);
  assert.throws(() => applySessionPatch(s, { date: '10/10/2026' }, 't'), /data inválida/);
  assert.throws(() => applySessionPatch(s, { experiment: { parameter: 'cor' } }, 't'), /parâmetro inválido/);
  assert.throws(() => applySessionPatch(s, { owner: 'x' }, 't'), /desconhecido/);
});

test('fotos da sessão na ordem em que foram tiradas; sem data por último', () => {
  const photos = [
    photo('b', '2026-10-10T15:00:00', 's'), photo('n', null, 's'),
    photo('a', '2026-10-10T14:00:00', 's'), photo('z', '2026-10-10T13:00:00', 'outra'),
  ];
  assert.deepEqual(sessionPhotos(photos, 's').map((p) => p.id), ['a', 'b', 'n']);
  assert.ok(byCapture(photos[2], photos[0]) < 0);
});

test('sessões mais recentes primeiro', () => {
  const list = sortSessions([
    { id: 'a', date: '2026-10-01', created_at: '1' }, { id: 'b', date: '2026-10-12', created_at: '0' },
    { id: 'c', date: null, created_at: '2' },
  ]);
  assert.deepEqual(list.map((s) => s.id), ['b', 'a', 'c']);
});

test('valor do parâmetro do experimento em cada foto; ausente = null', () => {
  const p = photo('a', '2026-10-10T14:00:00', 's', { iso: 3200 });
  assert.equal(experimentValue(p, { parameter: 'iso' }), 3200);
  assert.equal(experimentValue(p, { parameter: 'aperture' }), null);
  assert.equal(experimentValue(p, { parameter: 'transfer' }), null);
  for (const x of EXPERIMENT_PARAMETERS) assert.ok(EXPERIMENT_LABELS[x.key], x.key);
  assert.equal(formatDate('2026-01-02'), '02/01/2026');
});
