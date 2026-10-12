import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRatingPatch, isRated, previousContext, ratingSummary, CATEGORIES, LIGHTS, SUBJECTS,
} from '../../site/js/core/rating.js';
import { RATING_LABELS, CATEGORY_HINTS } from '../../site/js/core/glossary.js';

test('avaliação: campos aplicados aos poucos, com data da última mudança', () => {
  let r = applyRatingPatch(null, { score: 4 }, 't1');
  assert.deepEqual(r, { category: null, score: 4, light: null, subject: null, note: '', rated_at: 't1' });
  r = applyRatingPatch(r, { category: 'shake', light: 'shade' }, 't2');
  assert.equal(r.score, 4);
  assert.equal(r.category, 'shake');
  assert.equal(r.light, 'shade');
  assert.equal(r.rated_at, 't2');
});

test('avaliação: null limpa um campo; tudo vazio volta a "não avaliada"', () => {
  const r = applyRatingPatch(null, { category: 'sharp' }, 't1');
  assert.equal(applyRatingPatch(r, { category: null }, 't2'), null);
  const withNote = applyRatingPatch(r, { category: null, note: 'vento' }, 't2');
  assert.equal(withNote.note, 'vento');
  assert.equal(applyRatingPatch(withNote, { note: '   ' }, 't3'), null);
});

test('avaliação: valores fora da lista são recusados', () => {
  assert.throws(() => applyRatingPatch(null, { category: 'blurry' }, 't'), /valor inválido/);
  assert.throws(() => applyRatingPatch(null, { score: 6 }, 't'), /valor inválido/);
  assert.throws(() => applyRatingPatch(null, { score: '3' }, 't'), /valor inválido/);
  assert.throws(() => applyRatingPatch(null, { mood: 'x' }, 't'), /desconhecido/);
  assert.throws(() => applyRatingPatch(null, { note: 3 }, 't'), /texto/);
});

test('avaliada = tem categoria; resumo conta cada categoria', () => {
  const photos = [
    { rating: { category: 'sharp' } }, { rating: { category: 'noise' } }, { rating: { category: 'sharp' } },
    { rating: { score: 3, category: null } }, { rating: null },
  ];
  assert.equal(isRated(photos[3]), false);
  const s = ratingSummary(photos);
  assert.equal(s.total, 5);
  assert.equal(s.rated, 3);
  assert.equal(s.by_category.sharp, 2);
  assert.equal(s.by_category.noise, 1);
  assert.equal(s.by_category.shake, 0);
});

test('"igual à anterior": luz e assunto da foto anterior mais próxima que os tem', () => {
  const photos = [
    { rating: { light: 'harsh_sun', subject: 'still' } },
    { rating: { category: 'sharp', light: null, subject: null } },
    { rating: null },
  ];
  assert.deepEqual(previousContext(photos, 2), { light: 'harsh_sun', subject: 'still' });
  assert.equal(previousContext(photos, 0), null);
});

test('todas as opções têm rótulo em pt-BR', () => {
  for (const c of CATEGORIES) { assert.ok(RATING_LABELS.category[c]); assert.ok(CATEGORY_HINTS[c]); }
  for (const l of LIGHTS) assert.ok(RATING_LABELS.light[l]);
  for (const s of SUBJECTS) assert.ok(RATING_LABELS.subject[s]);
});
