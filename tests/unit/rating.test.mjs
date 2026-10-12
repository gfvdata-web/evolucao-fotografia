import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRatingPatch, isRated, previousContext, ratingSummary, sameContext,
  PROBLEMS, PLACES, LIGHTS, SUBJECTS,
} from '../../site/js/core/rating.js';
import { RATING_LABELS, PROBLEM_HINTS, ratingText } from '../../site/js/core/glossary.js';

test('avaliação: campos aplicados aos poucos, com data da última mudança', () => {
  let r = applyRatingPatch(null, { sharpness: 4 }, 't1');
  assert.deepEqual(r, {
    sharpness: 4, problem: null, place: null, light: null, subject: null, note: '', rated_at: 't1',
  });
  r = applyRatingPatch(r, { problem: 'motion_blur', place: 'outdoor', light: 'weak' }, 't2');
  assert.equal(r.sharpness, 4);
  assert.equal(r.problem, 'motion_blur');
  assert.equal(r.place, 'outdoor');
  assert.equal(r.light, 'weak');
  assert.equal(r.rated_at, 't2');
});

test('avaliação: null limpa um campo; tudo vazio volta a "não avaliada"', () => {
  const r = applyRatingPatch(null, { problem: 'none' }, 't1');
  assert.equal(applyRatingPatch(r, { problem: null }, 't2'), null);
  const withNote = applyRatingPatch(r, { problem: null, note: 'vento' }, 't2');
  assert.equal(withNote.note, 'vento');
  assert.equal(applyRatingPatch(withNote, { note: '   ' }, 't3'), null);
});

test('avaliação: valores fora da lista são recusados, inclusive os da v0.3.0', () => {
  assert.throws(() => applyRatingPatch(null, { problem: 'blurry' }, 't'), /valor inválido/);
  assert.throws(() => applyRatingPatch(null, { sharpness: 6 }, 't'), /valor inválido/);
  assert.throws(() => applyRatingPatch(null, { sharpness: '3' }, 't'), /valor inválido/);
  assert.throws(() => applyRatingPatch(null, { light: 'harsh_sun' }, 't'), /valor inválido/);
  assert.throws(() => applyRatingPatch(null, { category: 'sharp' }, 't'), /desconhecido/);
  assert.throws(() => applyRatingPatch(null, { score: 3 }, 't'), /desconhecido/);
  assert.throws(() => applyRatingPatch(null, { note: 3 }, 't'), /texto/);
});

test('avaliada = nitidez e problema principal; resumo conta problemas e média da nitidez', () => {
  const photos = [
    { rating: { sharpness: 5, problem: 'none' } }, { rating: { sharpness: 2, problem: 'grain' } },
    { rating: { sharpness: 4, problem: 'none' } },
    { rating: { sharpness: 3, problem: null } }, { rating: { sharpness: null, problem: 'soft' } }, { rating: null },
  ];
  assert.equal(isRated(photos[3]), false);
  assert.equal(isRated(photos[4]), false);
  const s = ratingSummary(photos);
  assert.equal(s.total, 6);
  assert.equal(s.rated, 3);
  assert.equal(s.by_problem.none, 2);
  assert.equal(s.by_problem.grain, 1);
  assert.equal(s.by_problem.soft, 0);
  assert.equal(s.mean_sharpness, 11 / 3);
  assert.equal(ratingSummary([{ rating: null }]).mean_sharpness, null);
});

test('"igual à anterior": onde, luz e assunto da foto anterior mais próxima que tem algum', () => {
  const photos = [
    { rating: { place: 'outdoor', light: 'strong', subject: null } },
    { rating: { sharpness: 4, problem: 'none', place: null, light: null, subject: null } },
    { rating: null },
  ];
  assert.deepEqual(previousContext(photos, 2), { place: 'outdoor', light: 'strong', subject: null });
  assert.equal(previousContext(photos, 0), null);
  assert.equal(sameContext({ place: 'outdoor', light: 'strong', subject: null }, { place: 'outdoor', light: 'strong' }), true);
  assert.equal(sameContext({ place: 'outdoor' }, null), false);
});

test('todas as opções têm rótulo em pt-BR; resumo curto mostra o que faltou', () => {
  for (const c of PROBLEMS) { assert.ok(RATING_LABELS.problem[c]); assert.ok(PROBLEM_HINTS[c]); }
  for (const p of PLACES) assert.ok(RATING_LABELS.place[p]);
  for (const l of LIGHTS) assert.ok(RATING_LABELS.light[l]);
  for (const s of SUBJECTS) assert.ok(RATING_LABELS.subject[s]);
  assert.equal(ratingText({ sharpness: 4, problem: 'grain' }), 'Nitidez 4/5 · Granulada');
  assert.equal(ratingText({ sharpness: null, problem: 'blocky' }), 'nitidez não marcada · Quadriculada ao ampliar');
});
