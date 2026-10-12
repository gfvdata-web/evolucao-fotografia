import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, EXPECTED_FIELDS, emptyCapture, missingFields, mergeCaptures, newPhotoRecord,
  newVariant, refreshRecord,
} from '../../site/js/core/model.js';
import { migrate } from '../../site/js/core/migrations.js';

const file = (name, size = 10) => ({ name, size, type: '', lastModified: 0 });

test('captura vazia: todos os campos esperados aparecem como ausentes', () => {
  assert.deepEqual(missingFields(emptyCapture()), EXPECTED_FIELDS);
});

test('mergeCaptures: o primeiro valor não vazio vence, campo a campo', () => {
  const rich = emptyCapture();
  rich.focus.af_mode = 'One-shot AF';
  rich.exposure.iso = 400;
  const poor = emptyCapture();
  poor.exposure.iso = 800;
  poor.lens.model = 'RF50mm F1.8 STM';
  const merged = mergeCaptures([rich, poor]);
  assert.equal(merged.exposure.iso, 400);
  assert.equal(merged.focus.af_mode, 'One-shot AF');
  assert.equal(merged.lens.model, 'RF50mm F1.8 STM');
});

test('mergeCaptures: ponto de AF e GPS são copiados inteiros, nunca misturados', () => {
  const a = emptyCapture();
  a.focus.af_point = { areas: [{ x: 1, y: 2, w: 3, h: 4 }], af_image_width: 10, af_image_height: 10, in_focus: [], selected: [] };
  const b = emptyCapture();
  b.gps = { lat: 1, lon: 2 };
  const m = mergeCaptures([emptyCapture(), a, b]);
  assert.deepEqual(m.focus.af_point, a.focus.af_point);
  assert.deepEqual(m.gps, { lat: 1, lon: 2 });
});

test('refreshRecord: o CR3 tem prioridade sobre o JPEG transferido', () => {
  const r = newPhotoRecord({ id: 'x', matchKey: 'k', now: 't0' });
  assert.equal(r.schema_version, SCHEMA_VERSION);
  const jpeg = newVariant({ kind: 'jpeg', source: 'web', file: file('IMG_1.JPG'), key: 'jpeg-web' });
  jpeg.metadata_status = 'complete';
  jpeg.capture.exposure.iso = 100;
  jpeg.missing = ['focus.af_mode'];
  const cr3 = newVariant({ kind: 'cr3', source: 'web', file: file('IMG_1.CR3'), key: 'cr3-web' });
  cr3.capture.exposure.iso = 400;
  cr3.capture.focus.af_mode = 'AI Servo AF';
  r.variants.push(jpeg, cr3);
  refreshRecord(r, 't1');
  assert.equal(r.capture.exposure.iso, 400);
  assert.equal(r.capture.focus.af_mode, 'AI Servo AF');
  assert.equal(r.updated_at, 't1');
  assert.ok(!r.missing.includes('focus.af_mode'));
});

test('migrate: aplica as etapas em ordem até a versão atual', () => {
  const steps = {
    0: (d) => ({ ...d, a: 1 }),
    1: (d) => ({ ...d, b: d.a + 1 }),
  };
  const out = migrate({ x: true }, steps, 2);
  assert.deepEqual(out, { x: true, a: 1, b: 2, schema_version: 2 });
});

test('migrate: documento já atual não muda', () => {
  const doc = { schema_version: SCHEMA_VERSION, id: 'a' };
  assert.deepEqual(migrate(doc), doc);
});

test('migrate: recusa dados de uma versão mais nova do app', () => {
  assert.throws(() => migrate({ schema_version: SCHEMA_VERSION + 1 }), /mais novos/);
});

test('migração 2 → 3: foto da v0.2 ganha sessão e avaliação vazias', () => {
  const v2 = { schema_version: 2, id: 'a', variants: [], crop_choice: { af: null, uniform: null }, crops: null };
  const out = migrate(v2);
  assert.equal(out.schema_version, SCHEMA_VERSION);
  assert.equal(out.session_id, null);
  assert.equal(out.rating, null);
  assert.deepEqual(out.crop_choice, v2.crop_choice);
});

test('migração 1 → 3 em sequência mantém o que já existia', () => {
  const v1 = { schema_version: 1, id: 'a', session_id: null, rating: null, variants: [{ key: 'jpeg-web' }] };
  const out = migrate(v1);
  assert.deepEqual(out.variants, [{ tag_count: null, analysis: null, key: 'jpeg-web' }]);
  assert.equal(out.rating, null);
});

test('migração 3 → 4: avaliação da v0.3.0 mantém só o que tem o mesmo sentido', () => {
  const v3 = {
    schema_version: 3, id: 'a', session_id: 'ses-1', variants: [],
    rating: { category: 'shake', score: 4, light: 'harsh_sun', subject: 'moving', note: 'vento', rated_at: 't1' },
  };
  const out = migrate(v3);
  assert.equal(out.schema_version, SCHEMA_VERSION);
  assert.equal(out.session_id, 'ses-1');
  assert.deepEqual(out.rating, {
    sharpness: null, problem: 'motion_blur', place: 'outdoor', light: 'strong', subject: 'moving', note: 'vento', rated_at: 't1',
  });
  const map = (rating) => migrate({ schema_version: 3, id: 'a', rating }).rating;
  assert.equal(map({ category: 'sharp' }).problem, 'none');
  assert.equal(map({ category: 'noise' }).problem, 'grain');
  assert.equal(map({ category: 'pixelated_upload' }).problem, 'blocky');
  assert.deepEqual([map({ category: 'other', light: 'shade' }).place, map({ category: 'other', light: 'shade' }).light], ['outdoor', null]);
  assert.equal(map({ category: 'other', light: 'indoor' }).place, 'indoor');
  // Ambiguous in the new form: "fora de foco", the general score and "noite" are not guessed.
  assert.equal(map({ category: 'out_of_focus', score: 2, light: 'night' }), null);
  assert.equal(map(null), null);
});

test('migração de sessão 3 → 4 só acompanha a versão', async () => {
  const { SESSION_MIGRATIONS } = await import('../../site/js/core/migrations.js');
  const s = { schema_version: 3, id: 'ses-1', name: 'Parque' };
  assert.deepEqual(migrate(s, SESSION_MIGRATIONS), { ...s, schema_version: SCHEMA_VERSION });
});

test('migrate: falha clara quando falta uma etapa', () => {
  assert.throws(() => migrate({ schema_version: 0 }, {}, 1), /Falta a migração da versão 0/);
});
