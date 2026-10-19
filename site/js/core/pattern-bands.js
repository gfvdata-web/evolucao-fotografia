// Bands of the Painel de padrões (pure; v2.1, decision 0018). Each dimension puts a photo in one
// band; the Painel (core/patterns.js) counts by band and the grid filter (core/photo-filter.js)
// selects by the same function, so a number on the Painel and the filtered grid always agree.
//
// A field that was not read (or not marked by the user) goes to the band "unread": never to a
// plausible value (rule 5).
import { EV_BANDS, isCropMode, primaryVariant, shakeRisk } from './indicators.js';
import { LENSES, lensFor } from './lens-profiles.js';
import { sceneLightOf } from './diagnosis.js';
import { RATING_LABELS } from './glossary.js';
import { LIGHTS, PLACES, SUBJECTS } from './rating.js';

export const UNREAD = 'unread';

const exp = (photo) => photo.capture?.exposure || {};

/** Band by upper limits: [[max, key], ...] in ascending order; above the last → `rest`. */
const byLimit = (value, limits, rest) => {
  if (typeof value !== 'number' || !(value > 0)) return UNREAD;
  const hit = limits.find(([max]) => value <= max);
  return hit ? hit[1] : rest;
};

const fromRating = (field, keys) => (photo) => {
  const v = photo.rating?.[field];
  return keys.includes(v) ? v : UNREAD;
};

/**
 * key: hash query key of the grid filter (Portuguese, like the rest of the hash).
 * bands: [band key, label] in display order ("unread" is added at the end).
 * rating: the band comes from the user's marks, not from the camera.
 */
export const DIMENSIONS = [
  {
    key: 'iso', label: 'ISO', unread: 'ISO não lido',
    bands: [['low', 'ISO até 400'], ['mid', 'ISO 500 a 1600'], ['high', 'ISO 2000 a 6400'], ['very_high', 'ISO 8000 ou mais']],
    bandOf: (p) => byLimit(exp(p).iso, [[400, 'low'], [1600, 'mid'], [6400, 'high']], 'very_high'),
  },
  {
    key: 'margem', label: 'Margem de velocidade', unread: 'velocidade ou distância focal não lidas',
    note: 'Velocidade × referência de tremido sem estabilização (1/distância focal).',
    bands: [['ample', 'folga de 2× ou mais'], ['tight', 'folga entre 1× e 2×'], ['below', 'mais lenta que a referência']],
    bandOf: (p) => {
      const s = shakeRisk(p.capture, isCropMode(primaryVariant(p)));
      if (s.status === 'unknown') return UNREAD;
      return s.ratio <= 0.5 ? 'ample' : s.ratio <= 1 ? 'tight' : 'below';
    },
  },
  {
    key: 'lente', label: 'Lente', unread: 'lente não lida',
    bands: [...Object.entries(LENSES).map(([model, l]) => [model, l.short]), ['other', 'outra lente']],
    bandOf: (p) => {
      const model = p.capture?.lens?.model;
      if (!model) return UNREAD;
      return lensFor(model) ? String(model).trim() : 'other';
    },
  },
  {
    key: 'abertura', label: 'Abertura', unread: 'abertura não lida',
    bands: [['wide', 'f/1,8 a f/2,8'], ['mid', 'f/3,2 a f/5,6'], ['closed', 'f/6,3 a f/11'], ['very_closed', 'f/13 ou mais']],
    // 1/3-stop values are stored rounded (f/2.8 = 2.83, f/5.6 = 5.66, f/11 = 11.3): small tolerance.
    bandOf: (p) => byLimit(exp(p).aperture, [[2.9, 'wide'], [5.8, 'mid'], [11.6, 'closed']], 'very_closed'),
  },
  {
    key: 'ev', label: 'Luz medida', unread: 'luz da cena não calculada',
    note: 'Luz da cena em EV (fotômetro da câmera ou exposição usada).',
    bands: EV_BANDS.map((b) => [b.key, b.text]),
    bandOf: (p) => sceneLightOf(p).band || UNREAD,
  },
  {
    key: 'onde', label: 'Onde', rating: true, unread: 'não marcado',
    bands: PLACES.map((k) => [k, RATING_LABELS.place[k]]),
    bandOf: fromRating('place', PLACES),
  },
  {
    key: 'luz', label: 'Luz percebida', rating: true, unread: 'não marcada',
    bands: LIGHTS.map((k) => [k, RATING_LABELS.light[k]]),
    bandOf: fromRating('light', LIGHTS),
  },
  {
    key: 'assunto', label: 'Assunto', rating: true, unread: 'não marcado',
    bands: SUBJECTS.map((k) => [k, RATING_LABELS.subject[k]]),
    bandOf: fromRating('subject', SUBJECTS),
  },
];

export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key);
export const dimensionOf = (key) => DIMENSIONS.find((d) => d.key === key) || null;

/** Every band key of a dimension, "unread" last. */
export const bandKeys = (dim) => [...dim.bands.map(([k]) => k), UNREAD];

/** Label of a band ("ISO até 400"; "ISO não lido"). */
export function bandLabel(dim, band) {
  if (band === UNREAD) return dim.unread;
  return dim.bands.find(([k]) => k === band)?.[1] ?? band;
}

/** Is `band` a valid band of the dimension `key`? (for the hash parser) */
export const isBand = (key, band) => {
  const dim = dimensionOf(key);
  return Boolean(dim) && bandKeys(dim).includes(band);
};
