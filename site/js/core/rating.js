// Rating of a photo by the user (pure). Values are stored as English keys and
// translated on screen (RATING_LABELS in glossary.js). See docs/MODELO-DE-DADOS.md.
//
// A photo counts as rated once it has a category: that is the judgement the
// later pattern analysis (V2) crosses with the settings and indicators.

export const CATEGORIES = ['sharp', 'noise', 'shake', 'out_of_focus', 'pixelated_upload', 'other'];
export const LIGHTS = ['harsh_sun', 'shade', 'overcast', 'indoor', 'night'];
export const SUBJECTS = ['still', 'moving'];
export const SCORES = [1, 2, 3, 4, 5];
export const NOTE_MAX = 2000;

const ALLOWED = { category: CATEGORIES, light: LIGHTS, subject: SUBJECTS, score: SCORES };

export function emptyRating() {
  return { category: null, score: null, light: null, subject: null, note: '', rated_at: null };
}

export const isRated = (photo) => Boolean(photo?.rating?.category);

/**
 * Applies a partial change to a rating and returns a new object. `null`
 * clears a field. Unknown fields or values throw, so a bug in a screen can
 * never store a value the analysis would not understand.
 * @param {object|null} current
 * @param {{category?, score?, light?, subject?, note?}} patch
 */
export function applyRatingPatch(current, patch, now) {
  const out = { ...emptyRating(), ...(current || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'note') {
      if (value !== null && typeof value !== 'string') throw new Error('nota livre precisa ser texto');
      out.note = (value || '').slice(0, NOTE_MAX);
    } else if (ALLOWED[key]) {
      if (value !== null && !ALLOWED[key].includes(value)) throw new Error(`valor inválido para ${key}: ${value}`);
      out[key] = value;
    } else {
      throw new Error(`campo de avaliação desconhecido: ${key}`);
    }
  }
  const empty = !out.category && !out.score && !out.light && !out.subject && !out.note.trim();
  if (empty) return null;
  out.rated_at = now;
  return out;
}

/** Light and subject of the closest earlier photo that has them (for "same as previous"). */
export function previousContext(photos, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const r = photos[i]?.rating;
    if (r && (r.light || r.subject)) return { light: r.light, subject: r.subject };
  }
  return null;
}

/** Count of rated photos and of each category. */
export function ratingSummary(photos) {
  const by_category = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  let rated = 0;
  for (const p of photos) {
    if (!isRated(p)) continue;
    rated += 1;
    by_category[p.rating.category] += 1;
  }
  return { total: photos.length, rated, by_category };
}
