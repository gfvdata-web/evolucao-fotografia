// Painel de padrões (pure; v2.1, decision 0018). Crosses what the user marked (sharpness, main
// problem) and the site's verdict with one dimension at a time (ISO, speed margin, lens,
// aperture, light, place, subject: core/pattern-bands.js).
//
// Every share comes with its n and a 95% Wilson interval; below MIN_N photos in a band the share
// is not given at all ("poucas fotos (n)", rule 4). Each count carries the grid filter that
// selects exactly the photos it counts (same matchesFilter as the grid).
import { PROBLEMS, isRated } from './rating.js';
import { matchesFilter, scopeOf } from './photo-filter.js';
import { verdictOfPhoto } from './dashboard.js';
import { RATING_LABELS } from './glossary.js';
import { UNREAD, bandKeys, bandLabel, dimensionOf } from './pattern-bands.js';

/** Fewer photos than this in a band: no percentage (roadmap v2.1: ≥ 10 rated photos per band). */
export const MIN_N = 10;

/**
 * Wilson score interval for k successes in n trials (95% by default). Better than ±1.96·√(p(1−p)/n)
 * with few photos or shares near 0% or 100%, where the plain formula leaves the 0–1 range.
 * @returns {{low:number, high:number}|null} null when n = 0
 */
export function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

const SYMPTOMS = PROBLEMS.filter((p) => p !== 'none' && p !== 'other');

/**
 * What is counted in each band. `rated`: only photos with sharpness + main problem (decision
 * 0012); otherwise every photo in the band. `hit(photo, verdict)` says whether it counts.
 * `filter`: the grid filter of the hits (null when the grid has no such filter).
 */
export const MEASURES = [
  {
    key: 'sharp', label: 'Nitidez 4 ou 5', who: 'você marcou', rated: true,
    hit: (p) => p.rating.sharpness >= 4, filter: null,
  },
  ...SYMPTOMS.map((k) => ({
    key: k, label: RATING_LABELS.problem[k], who: 'você marcou', rated: true,
    hit: (p) => p.rating.problem === k, filter: { problem: k },
  })),
  {
    key: 'site_problem', label: 'Com problema', who: 'o site disse', rated: false,
    hit: (_p, verdict) => verdict === 'problem', filter: { verdict: 'problem' },
  },
];
export const measureOf = (key) => MEASURES.find((m) => m.key === key) || null;

/**
 * @param {object[]} photos photo documents
 * @param {{session_id?, from?, to?}} scope only the session and the period are used
 * @param {string} dimKey key of core/pattern-bands.js DIMENSIONS
 * @param {string} measureKey key of MEASURES
 * @param {(photo) => string} verdictOf verdict without the user's rating (as in the Painel)
 * @returns {{dimension, measure, total, rated, rows: object[]}}
 */
export function buildPatterns(photos, scope, dimKey, measureKey, verdictOf = verdictOfPhoto) {
  const dim = dimensionOf(dimKey);
  const measure = measureOf(measureKey);
  if (!dim || !measure) throw new Error(`unknown dimension or measure: ${dimKey}/${measureKey}`);
  const sc = scopeOf({ session_id: null, from: null, to: null, ...scope });
  const rows = new Map(bandKeys(dim).map((b) => [b, { n: 0, k: 0, sharp_sum: 0, sharp_n: 0 }]));
  let total = 0;
  let rated = 0;
  for (const photo of photos) {
    if (!matchesFilter(photo, null, sc)) continue;
    total += 1;
    const isR = isRated(photo);
    if (isR) rated += 1;
    if (measure.rated && !isR) continue;
    const row = rows.get(dim.bandOf(photo));
    if (!row) continue;
    row.n += 1;
    if (measure.hit(photo, measure.rated ? null : verdictOf(photo))) row.k += 1;
    if (isR) { row.sharp_sum += photo.rating.sharpness; row.sharp_n += 1; }
  }
  const base = { ...sc, ...(measure.rated ? { rated: true } : {}) };
  const out = [];
  for (const [band, r] of rows) {
    if (band === UNREAD && !r.n) continue;
    const enough = r.n >= MIN_N;
    const bandFilter = { ...base, [dim.key]: band };
    out.push({
      band,
      label: bandLabel(dim, band),
      n: r.n,
      k: r.k,
      enough,
      share: enough ? r.k / r.n : null,
      interval: enough ? wilson(r.k, r.n) : null,
      mean_sharpness: r.sharp_n ? r.sharp_sum / r.sharp_n : null,
      sharpness_n: r.sharp_n,
      n_filter: bandFilter,
      k_filter: measure.filter ? { ...bandFilter, ...measure.filter } : null,
    });
  }
  return { dimension: dim, measure, total, rated, rows: out };
}
