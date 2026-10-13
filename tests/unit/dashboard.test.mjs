// v1.0: Painel (beta) — contagens, filtros por sessão/período e a tabela "o site disse × você marcou"
// (core/dashboard.js, core/photo-filter.js; decisão 0016, item 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPhotoRecord } from '../../site/js/core/model.js';
import { buildDashboard, isDisagreement, verdictOfPhoto } from '../../site/js/core/dashboard.js';
import {
  applyFilter, emptyFilter, filterQuery, gridHref, isFilterEmpty, matchesFilter, parseFilterHash, parseFilterQuery,
} from '../../site/js/core/photo-filter.js';
import { diagnosePhoto } from '../../site/js/core/diagnosis.js';
import { DASHBOARD_LABELS } from '../../site/js/core/glossary.js';

/** Photo with session, capture day, rating {s, p} and a verdict stub (id → verdict). */
const verdicts = {};
let n = 0;
function photo({ session = 'A', day = '2026-10-10', s = null, p = null, verdict = 'good' } = {}) {
  n += 1;
  const rec = newPhotoRecord({ id: `p${n}`, matchKey: `k${n}`, now: 't' });
  rec.session_id = session;
  rec.capture.datetime_original = day ? `${day}T10:00:00` : null;
  rec.rating = s || p ? { sharpness: s, problem: p, place: null, light: null, subject: null, note: '', rated_at: 't' } : null;
  verdicts[rec.id] = verdict;
  return rec;
}
const verdictOf = (x) => verdicts[x.id];

const PHOTOS = [
  photo({ session: 'A', day: '2026-10-10', s: 5, p: 'none', verdict: 'good' }),
  photo({ session: 'A', day: '2026-10-10', s: 1, p: 'soft', verdict: 'good' }), // discordância
  photo({ session: 'A', day: '2026-10-11', s: 2, p: 'motion_blur', verdict: 'problem' }),
  photo({ session: 'A', day: '2026-10-11', s: 4, p: 'none', verdict: 'problem' }), // discordância
  photo({ session: 'B', day: '2026-10-12', s: 3, p: null, verdict: 'usable' }), // meia avaliação = não avaliada
  photo({ session: 'B', day: '2026-10-12', verdict: 'unknown' }),
  photo({ session: null, day: null, verdict: 'good' }),
];

test('painel: totais, avaliadas × não avaliadas e contagens por nitidez, problema e veredito', () => {
  const d = buildDashboard(PHOTOS, {}, verdictOf);
  assert.equal(d.total, 7);
  assert.equal(d.rated, 4);
  assert.equal(d.unrated, 3); // sem nota, só nitidez sem problema, e sem nada
  assert.deepEqual(d.by_sharpness, { 1: 1, 2: 1, 3: 0, 4: 1, 5: 1 });
  assert.equal(d.by_problem.none, 2);
  assert.equal(d.by_problem.soft, 1);
  assert.equal(d.by_problem.motion_blur, 1);
  assert.equal(d.by_problem.grain, 0);
  assert.deepEqual(d.by_verdict, { good: 3, usable: 1, problem: 2, unknown: 1 });
  // soma das categorias = total (nada some, nada é inventado)
  assert.equal(Object.values(d.by_verdict).reduce((a, b) => a + b, 0), d.total);
  assert.equal(Object.values(d.by_sharpness).reduce((a, b) => a + b, 0), d.rated);
});

test('painel: tabela "o site disse × você marcou" com a coluna "não avaliada" e as discordâncias', () => {
  const d = buildDashboard(PHOTOS, {}, verdictOf);
  assert.deepEqual(d.matrix.good, { 1: 1, 2: 0, 3: 0, 4: 0, 5: 1, unrated: 1, total: 3 });
  assert.deepEqual(d.matrix.problem, { 1: 0, 2: 1, 3: 0, 4: 1, 5: 0, unrated: 0, total: 2 });
  assert.deepEqual(d.matrix.usable, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unrated: 1, total: 1 });
  assert.deepEqual(d.matrix.unknown, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unrated: 1, total: 1 });
  assert.equal(d.disagreements, 2); // Boa + nitidez 1; Com problema + nitidez 4
  assert.equal(isDisagreement('good', 2), true);
  assert.equal(isDisagreement('good', 3), false);
  assert.equal(isDisagreement('problem', 4), true);
  assert.equal(isDisagreement('problem', 3), false);
  assert.equal(isDisagreement('usable', 1), false);
  assert.equal(isDisagreement('unknown', 1), false); // sem diagnóstico não discorda de nada
  assert.equal(isDisagreement('good', null), false);
});

test('painel: filtro por sessão e por período (dia de captura, inclusivo; sem data fica de fora)', () => {
  const a = buildDashboard(PHOTOS, { session_id: 'A' }, verdictOf);
  assert.equal(a.total, 4);
  assert.equal(a.rated, 4);
  const b = buildDashboard(PHOTOS, { session_id: 'B' }, verdictOf);
  assert.equal(b.total, 2);
  assert.equal(b.rated, 0);
  assert.equal(buildDashboard(PHOTOS, { session_id: 'sem-sessao' }, verdictOf).total, 1);
  const day11 = buildDashboard(PHOTOS, { from: '2026-10-11', to: '2026-10-11' }, verdictOf);
  assert.equal(day11.total, 2);
  assert.deepEqual(day11.by_verdict, { good: 0, usable: 0, problem: 2, unknown: 0 });
  assert.equal(buildDashboard(PHOTOS, { from: '2026-10-11' }, verdictOf).total, 4);
  assert.equal(buildDashboard(PHOTOS, { to: '2026-10-10' }, verdictOf).total, 2);
  assert.equal(buildDashboard(PHOTOS, { session_id: 'A', from: '2026-10-11' }, verdictOf).total, 2);
  assert.equal(buildDashboard([], {}, verdictOf).total, 0);
});

test('painel: foto sem dados para o diagnóstico fica em "Sem diagnóstico" (veredito real, sem simulação)', () => {
  const bare = newPhotoRecord({ id: 'x', matchKey: 'x', now: 't' });
  assert.equal(verdictOfPhoto(bare), 'unknown');
  const d = buildDashboard([bare]);
  assert.equal(d.by_verdict.unknown, 1);
  assert.equal(d.matrix.unknown.unrated, 1);
  assert.equal(DASHBOARD_LABELS.verdict.unknown, 'Sem diagnóstico');
});

test('painel: o veredito do site não vem da avaliação do usuário (senão a tabela compararia você consigo mesmo)', () => {
  const rec = newPhotoRecord({ id: 'y', matchKey: 'y', now: 't' });
  const rated = { ...rec, rating: { sharpness: 5, problem: 'none', place: null, light: null, subject: null, note: '', rated_at: 't' } };
  // O diagnóstico completo, com a avaliação, vira "Boa" (nitidez 5, nenhum problema)...
  assert.equal(diagnosePhoto(rated).verdict, 'good');
  // ...mas o veredito do Painel ignora a nitidez e o problema marcados.
  assert.equal(verdictOfPhoto(rated), 'unknown');
  assert.equal(verdictOfPhoto(rated), verdictOfPhoto(rec));
  const bad = { ...rec, rating: { ...rated.rating, sharpness: 1, problem: 'soft' } };
  assert.equal(verdictOfPhoto(bad), 'unknown');
});

test('filtro: o que o Painel conta é exatamente o que a grade filtrada mostra', () => {
  const d = buildDashboard(PHOTOS, { session_id: 'A' }, verdictOf);
  const scope = { ...emptyFilter(), session_id: 'A' };
  const count = (extra) => applyFilter(PHOTOS, { ...scope, ...extra }, verdictOf).length;
  for (const n of [1, 2, 3, 4, 5]) assert.equal(count({ sharpness: n }), d.by_sharpness[n]);
  for (const [problem, c] of Object.entries(d.by_problem)) assert.equal(count({ problem }), c);
  for (const [verdict, c] of Object.entries(d.by_verdict)) assert.equal(count({ verdict }), c);
  assert.equal(count({ rated: true }), d.rated);
  assert.equal(count({ rated: false }), d.unrated);
  for (const v of Object.keys(d.matrix)) {
    for (const n of [1, 2, 3, 4, 5]) assert.equal(count({ verdict: v, sharpness: n }), d.matrix[v][n]);
    assert.equal(count({ verdict: v, rated: false }), d.matrix[v].unrated);
  }
  // nitidez/problema só valem para fotos avaliadas (nitidez 3 sem problema não conta)
  assert.equal(applyFilter(PHOTOS, { ...emptyFilter(), sharpness: 3 }, verdictOf).length, 0);
});

test('filtro: ida e volta da hash; valores inválidos são ignorados', () => {
  const f = { ...emptyFilter(), session_id: 'ses-1', sharpness: 2, problem: 'soft', verdict: 'good', rated: true, from: '2026-10-01', to: '2026-10-31' };
  assert.deepEqual(parseFilterQuery(filterQuery(f)), f);
  assert.equal(gridHref(emptyFilter()), '#/fotos');
  assert.equal(gridHref({ ...emptyFilter(), sharpness: 2 }), '#/fotos?nitidez=2');
  assert.deepEqual(parseFilterHash('#/fotos?nitidez=2&avaliada=0'), { ...emptyFilter(), sharpness: 2, rated: false });
  assert.ok(isFilterEmpty(parseFilterHash('#/fotos')));
  assert.ok(isFilterEmpty(parseFilterHash('#/fotos?nitidez=9&problema=xx&veredito=otimo&de=ontem&avaliada=talvez')));
  assert.equal(matchesFilter(PHOTOS[0], 'good', emptyFilter()), true);
});
