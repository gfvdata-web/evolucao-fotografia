// v2.1: Painel de padrões — faixas, intervalo de Wilson, mínimo de fotos e a garantia de que cada
// número do Painel abre na grade exatamente as fotos que ele conta (core/patterns.js,
// core/pattern-bands.js, core/photo-filter.js; decisão 0018).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPhotoRecord } from '../../site/js/core/model.js';
import { MIN_N, MEASURES, buildPatterns, wilson } from '../../site/js/core/patterns.js';
import { DIMENSIONS, UNREAD, bandLabel, dimensionOf, isBand } from '../../site/js/core/pattern-bands.js';
import { applyFilter, filterQuery, parseFilterQuery } from '../../site/js/core/photo-filter.js';

let n = 0;
const verdicts = {};
/** Photo with exposure, lens, rating and a verdict stub. */
function photo({
  iso = 100, shutter = 1 / 250, aperture = 4, focal = 50, model = 'RF50mm F1.8 STM', ev = 11,
  s = null, p = null, place = null, light = null, subject = null, session = 'A', day = '2026-10-10', verdict = 'good',
} = {}) {
  n += 1;
  const rec = newPhotoRecord({ id: `p${n}`, matchKey: `k${n}`, now: 't' });
  rec.session_id = session;
  const c = rec.capture;
  c.datetime_original = `${day}T10:00:00`;
  Object.assign(c.exposure, { iso, shutter_s: shutter, aperture, measured_ev: ev });
  Object.assign(c.lens, { model, focal_length_mm: focal });
  rec.rating = s || p || place ? { sharpness: s, problem: p, place, light, subject, note: '', rated_at: 't' } : null;
  verdicts[rec.id] = verdict;
  return rec;
}
const verdictOf = (x) => verdicts[x.id];
const band = (key, ph) => dimensionOf(key).bandOf(ph);

test('wilson: valores conhecidos, extremos dentro de 0–100% e n = 0', () => {
  const w = wilson(5, 10);
  assert.ok(Math.abs(w.low - 0.2366) < 1e-3 && Math.abs(w.high - 0.7634) < 1e-3);
  const zero = wilson(0, 10);
  assert.equal(zero.low, 0);
  assert.ok(Math.abs(zero.high - 0.2775) < 1e-3);
  const all = wilson(10, 10);
  assert.equal(all.high, 1);
  assert.ok(Math.abs(all.low - 0.7225) < 1e-3);
  assert.equal(wilson(0, 0), null);
});

test('faixas: bordas de ISO, margem de velocidade, abertura, lente e luz', () => {
  assert.equal(band('iso', photo({ iso: 400 })), 'low');
  assert.equal(band('iso', photo({ iso: 500 })), 'mid');
  assert.equal(band('iso', photo({ iso: 1600 })), 'mid');
  assert.equal(band('iso', photo({ iso: 6400 })), 'high');
  assert.equal(band('iso', photo({ iso: 8000 })), 'very_high');
  // 50 mm: referência 1/50 s.
  assert.equal(band('margem', photo({ shutter: 1 / 100 })), 'ample'); // 2× exatos
  assert.equal(band('margem', photo({ shutter: 1 / 60 })), 'tight');
  assert.equal(band('margem', photo({ shutter: 1 / 50 })), 'tight'); // igual à referência
  assert.equal(band('margem', photo({ shutter: 1 / 30 })), 'below');
  assert.equal(band('abertura', photo({ aperture: 1.8 })), 'wide');
  assert.equal(band('abertura', photo({ aperture: 2.83 })), 'wide'); // f/2.8 gravado arredondado
  assert.equal(band('abertura', photo({ aperture: 5.66 })), 'mid');
  assert.equal(band('abertura', photo({ aperture: 11.3 })), 'closed');
  assert.equal(band('abertura', photo({ aperture: 16 })), 'very_closed');
  assert.equal(band('lente', photo()), 'RF50mm F1.8 STM');
  assert.equal(band('lente', photo({ model: 'EF 24-105' })), 'other');
  assert.equal(band('ev', photo({ ev: 15 })), 'sun');
  assert.equal(band('ev', photo({ ev: 6 })), 'indoor');
  assert.equal(band('onde', photo({ s: 4, p: 'none', place: 'outdoor' })), 'outdoor');
});

test('regra 5: campo não lido ou não marcado vai para "não lido", nunca para um valor plausível', () => {
  assert.equal(band('iso', photo({ iso: null })), UNREAD);
  assert.equal(band('margem', photo({ shutter: null })), UNREAD);
  assert.equal(band('abertura', photo({ aperture: null })), UNREAD);
  assert.equal(band('lente', photo({ model: null })), UNREAD);
  assert.equal(band('onde', photo({ s: 4, p: 'none' })), UNREAD);
  for (const d of DIMENSIONS) assert.ok(bandLabel(d, UNREAD).length > 0, d.key);
  assert.equal(bandLabel(dimensionOf('iso'), 'low'), 'ISO até 400');
});

test('padrões: só fotos avaliadas nas medidas da sua avaliação; < 10 fotos sem porcentagem', () => {
  const photos = [
    ...Array.from({ length: 12 }, (_, i) => photo({ iso: 3200, s: i < 3 ? 2 : 4, p: i < 3 ? 'grain' : 'none' })),
    ...Array.from({ length: 4 }, () => photo({ iso: 100, s: 5, p: 'none' })),
    photo({ iso: 3200 }), // não avaliada: fora das porcentagens
    photo({ iso: 3200, s: 3 }), // só nitidez: não avaliada (decisão 0012)
  ];
  const r = buildPatterns(photos, {}, 'iso', 'grain', verdictOf);
  assert.equal(r.total, 18);
  assert.equal(r.rated, 16);
  const high = r.rows.find((x) => x.band === 'high');
  assert.equal(high.n, 12);
  assert.equal(high.k, 3);
  assert.equal(high.enough, true);
  assert.equal(high.share, 0.25);
  assert.ok(high.interval.low < 0.25 && high.interval.high > 0.25);
  assert.ok(Math.abs(high.mean_sharpness - (3 * 2 + 9 * 4) / 12) < 1e-9);
  const low = r.rows.find((x) => x.band === 'low');
  assert.equal(low.n, 4);
  assert.equal(low.enough, false);
  assert.equal(low.share, null);
  assert.equal(low.interval, null);
  assert.equal(r.rows.some((x) => x.band === UNREAD), false); // vazia: não aparece
  assert.equal(MIN_N, 10);
});

test('padrões: cada número abre na grade exatamente as fotos que conta (n e acertos)', () => {
  const photos = [
    ...Array.from({ length: 11 }, (_, i) => photo({ shutter: 1 / 30, s: 2, p: i < 6 ? 'motion_blur' : 'soft', session: 'B', verdict: i < 8 ? 'problem' : 'usable' })),
    ...Array.from({ length: 5 }, () => photo({ shutter: 1 / 500, s: 5, p: 'none', session: 'B' })),
    photo({ shutter: 1 / 30, session: 'B', verdict: 'problem' }), // não avaliada
    photo({ shutter: 1 / 30, s: 1, p: 'motion_blur', session: 'C' }), // outra sessão
    photo({ shutter: null, s: 3, p: 'soft', session: 'B' }), // velocidade não lida
  ];
  for (const m of MEASURES) {
    const r = buildPatterns(photos, { session_id: 'B' }, 'margem', m.key, verdictOf);
    for (const row of r.rows) {
      // Ida e volta pelo hash, como faz o link do Painel.
      const nf = parseFilterQuery(filterQuery(row.n_filter));
      assert.equal(applyFilter(photos, nf, verdictOf).length, row.n, `${m.key}/${row.band} n`);
      if (row.k_filter) {
        const kf = parseFilterQuery(filterQuery(row.k_filter));
        assert.equal(applyFilter(photos, kf, verdictOf).length, row.k, `${m.key}/${row.band} k`);
      }
    }
  }
  const blur = buildPatterns(photos, { session_id: 'B' }, 'margem', 'motion_blur', verdictOf);
  assert.equal(blur.rows.find((x) => x.band === 'below').k, 6);
  assert.equal(blur.rows.find((x) => x.band === UNREAD).n, 1);
  // "O site disse": conta todas as fotos da faixa, avaliadas ou não.
  const site = buildPatterns(photos, { session_id: 'B' }, 'margem', 'site_problem', verdictOf);
  const below = site.rows.find((x) => x.band === 'below');
  assert.equal(below.n, 12);
  assert.equal(below.k, 9);
});

test('filtro da grade: chaves das faixas na ida e volta; valor inválido é descartado', () => {
  const f = parseFilterQuery('iso=high&margem=below&lente=RF50mm+F1.8+STM&ev=unread&assunto=moving&abertura=f2&luz=xx');
  assert.equal(f.iso, 'high');
  assert.equal(f.margem, 'below');
  assert.equal(f.lente, 'RF50mm F1.8 STM');
  assert.equal(f.ev, UNREAD);
  assert.equal(f.assunto, 'moving');
  assert.equal(f.abertura, null);
  assert.equal(f.luz, null);
  assert.deepEqual(parseFilterQuery(filterQuery(f)), f);
  assert.equal(isBand('iso', 'low'), true);
  assert.equal(isBand('iso', 'sun'), false);
  assert.equal(isBand('nada', 'low'), false);
});
