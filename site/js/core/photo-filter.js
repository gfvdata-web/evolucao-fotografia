// Photo filters shared by the grid ("#/fotos?...") and the Painel (pure; decision 0016, item 4).
// The Painel builds its links with gridHref() and counts with the same matchesFilter(), so a
// number on the Painel and the photos in the filtered grid can never disagree.
//
// Hash query keys (Portuguese, like the rest of the hash):
//   sessao=<id>|sem-sessao   nitidez=1..5   problema=<key>   veredito=good|usable|problem|unknown
//   avaliada=0|1             de=AAAA-MM-DD  ate=AAAA-MM-DD   (period: capture day, inclusive)
//   iso= margem= lente= abertura= ev= onde= luz= assunto=  bands of the Painel de padrões
//                            (v2.1; band keys in core/pattern-bands.js, "unread" included)
// `nitidez` and `problema` only match rated photos (sharpness + main problem, decision 0012).
import { PROBLEMS, SHARPNESS, isRated } from './rating.js';
import { captureDate } from './sessions.js';
import { DIMENSIONS, isBand } from './pattern-bands.js';

export const NO_SESSION = 'sem-sessao';
export const VERDICTS = ['good', 'usable', 'problem', 'unknown'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Empty filter. The band of each dimension of the Painel de padrões sits under its hash key. */
export const emptyFilter = () => ({
  session_id: null, from: null, to: null, sharpness: null, problem: null, verdict: null, rated: null,
  ...Object.fromEntries(DIMENSIONS.map((d) => [d.key, null])),
});

export const isFilterEmpty = (f) => Object.values(f).every((v) => v === null);

/** Parses "nitidez=2&sessao=x" (with or without "?"); invalid values are dropped. */
export function parseFilterQuery(query) {
  const f = emptyFilter();
  const p = new URLSearchParams(String(query || '').replace(/^\?/, ''));
  const sessao = p.get('sessao');
  if (sessao) f.session_id = sessao;
  const sharp = Number(p.get('nitidez'));
  if (SHARPNESS.includes(sharp)) f.sharpness = sharp;
  if (PROBLEMS.includes(p.get('problema'))) f.problem = p.get('problema');
  if (VERDICTS.includes(p.get('veredito'))) f.verdict = p.get('veredito');
  if (p.get('avaliada') === '1') f.rated = true;
  if (p.get('avaliada') === '0') f.rated = false;
  if (DATE_RE.test(p.get('de') || '')) f.from = p.get('de');
  if (DATE_RE.test(p.get('ate') || '')) f.to = p.get('ate');
  for (const d of DIMENSIONS) if (isBand(d.key, p.get(d.key))) f[d.key] = p.get(d.key);
  return f;
}

/** Filter from a location hash ("#/fotos?nitidez=2" → filter). */
export const parseFilterHash = (hash) => parseFilterQuery(String(hash || '').split('?')[1] || '');

/** Filter → "nitidez=2&sessao=x" (no "?"; empty string for an empty filter). */
export function filterQuery(f) {
  const p = new URLSearchParams();
  if (f.session_id) p.set('sessao', f.session_id);
  if (f.sharpness !== null) p.set('nitidez', String(f.sharpness));
  if (f.problem) p.set('problema', f.problem);
  if (f.verdict) p.set('veredito', f.verdict);
  if (f.rated !== null) p.set('avaliada', f.rated ? '1' : '0');
  if (f.from) p.set('de', f.from);
  if (f.to) p.set('ate', f.to);
  for (const d of DIMENSIONS) if (f[d.key]) p.set(d.key, f[d.key]);
  return p.toString();
}

/** Link to a screen with a filter: hrefFor('#/fotos', f) → "#/fotos?nitidez=2". */
export function hrefFor(base, f) {
  const q = filterQuery(f);
  return q ? `${base}?${q}` : base;
}

/** Link to the filtered grid. */
export const gridHref = (f) => hrefFor('#/fotos', f);

/** Only the session and the period (what the Painel's own controls set). */
export const scopeOf = (f) => ({ ...emptyFilter(), session_id: f.session_id, from: f.from, to: f.to });

/** @param verdict verdict of the diagnosis of `photo` (diagnosePhoto(photo).verdict) */
export function matchesFilter(photo, verdict, f) {
  if (f.session_id) {
    if (f.session_id === NO_SESSION ? photo.session_id : photo.session_id !== f.session_id) return false;
  }
  if (f.from || f.to) {
    const day = captureDate(photo);
    if (!day || (f.from && day < f.from) || (f.to && day > f.to)) return false;
  }
  const rated = isRated(photo);
  if (f.rated !== null && rated !== f.rated) return false;
  if (f.sharpness !== null && !(rated && photo.rating.sharpness === f.sharpness)) return false;
  if (f.problem && !(rated && photo.rating.problem === f.problem)) return false;
  if (f.verdict && verdict !== f.verdict) return false;
  for (const d of DIMENSIONS) if (f[d.key] && d.bandOf(photo) !== f[d.key]) return false;
  return true;
}

/**
 * Photos that pass the filter. `verdictOf(photo)` is only called when the filter uses the
 * verdict (the diagnosis is not free); pass the grid's own function.
 */
export function applyFilter(photos, f, verdictOf) {
  const needVerdict = Boolean(f.verdict);
  return photos.filter((p) => matchesFilter(p, needVerdict ? verdictOf(p) : null, f));
}
