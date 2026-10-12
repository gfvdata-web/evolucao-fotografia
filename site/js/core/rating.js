// Rating of a photo by the user (pure). Values are stored as English keys and
// translated on screen (RATING_LABELS in glossary.js). See docs/MODELO-DE-DADOS.md
// and decision 0012.
//
// The user says what they SEE (sharpness and the main problem, as a symptom),
// never the cause: finding the cause is the job of the indicators. Place, light
// and subject are the context the camera cannot know.
//
// A photo counts as rated once it has both sharpness and a main problem
// ("none" included): that is the judgement the later pattern analysis (V2)
// crosses with the settings and indicators.

export const SHARPNESS = [1, 2, 3, 4, 5];
export const PROBLEMS = ['none', 'soft', 'missed_focus', 'motion_blur', 'grain', 'blocky', 'other'];
export const PLACES = ['indoor', 'outdoor'];
export const LIGHTS = ['strong', 'medium', 'weak'];
export const SUBJECTS = ['still', 'moving'];
export const NOTE_MAX = 2000;

/** Fields copied by "same as previous": the shooting context, not the judgement. */
export const CONTEXT_FIELDS = ['place', 'light', 'subject'];

const ALLOWED = { sharpness: SHARPNESS, problem: PROBLEMS, place: PLACES, light: LIGHTS, subject: SUBJECTS };

export function emptyRating() {
  return { sharpness: null, problem: null, place: null, light: null, subject: null, note: '', rated_at: null };
}

export const isComplete = (rating) => Boolean(rating?.sharpness && rating?.problem);
export const isRated = (photo) => isComplete(photo?.rating);

/**
 * Applies a partial change to a rating and returns a new object. `null`
 * clears a field. Unknown fields or values throw, so a bug in a screen can
 * never store a value the analysis would not understand.
 * @param {object|null} current
 * @param {{sharpness?, problem?, place?, light?, subject?, note?}} patch
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
  const empty = !Object.keys(ALLOWED).some((k) => out[k]) && !out.note.trim();
  if (empty) return null;
  out.rated_at = now;
  return out;
}

/** Context (place, light, subject) of the closest earlier photo that has any (for "same as previous"). */
export function previousContext(photos, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const r = photos[i]?.rating;
    if (r && CONTEXT_FIELDS.some((f) => r[f])) return Object.fromEntries(CONTEXT_FIELDS.map((f) => [f, r[f] ?? null]));
  }
  return null;
}

export const sameContext = (a, b) => CONTEXT_FIELDS.every((f) => (a?.[f] ?? null) === (b?.[f] ?? null));

/** Count of rated photos, of each main problem and the mean sharpness. */
export function ratingSummary(photos) {
  const by_problem = Object.fromEntries(PROBLEMS.map((c) => [c, 0]));
  let rated = 0;
  let sum = 0;
  for (const p of photos) {
    if (!isRated(p)) continue;
    rated += 1;
    sum += p.rating.sharpness;
    by_problem[p.rating.problem] += 1;
  }
  return { total: photos.length, rated, by_problem, mean_sharpness: rated ? sum / rated : null };
}
