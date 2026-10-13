// Painel (beta) numbers (pure; decision 0016, item 4). Counts photos by the user's rating
// (sharpness 1-5, main problem, rated x not rated) and by the site's verdict (core/diagnosis.js),
// and crosses the two: "o site disse x você marcou". No crossing with ISO, shutter or lens: V2.
//
// "Rated" is the definition of decision 0012 (sharpness AND main problem, core/rating.js).
// A photo whose verdict is "unknown" (not enough data) is its own category, never guessed.
import { PROBLEMS, SHARPNESS, isRated } from './rating.js';
import { VERDICTS, matchesFilter, scopeOf } from './photo-filter.js';
import { diagnosePhoto } from './diagnosis.js';

/**
 * What the SITE says about a photo: the verdict of core/diagnosis.js computed WITHOUT the user's
 * sharpness/problem judgement. With it, a rated photo's verdict is derived from the rating itself
 * (diagnosis.js: "none" + sharpness >= 4 = good...), and "o site disse x você marcou" would only
 * compare the user with himself. The shooting context (place, light, subject) is kept.
 * For rated photos this can differ from the chip on the grid, which includes the rating.
 */
export function verdictOfPhoto(photo) {
  const r = photo.rating;
  const blind = r && (r.sharpness || r.problem) ? { ...r, sharpness: null, problem: null } : r;
  return diagnosePhoto(blind === r ? photo : { ...photo, rating: blind }).verdict;
}

/**
 * The site and the user disagree: the site says "good" and the user marked sharpness 1-2, or the
 * site says "with problem" and the user marked 4-5.
 */
export function isDisagreement(verdict, sharpness) {
  if (!sharpness) return false;
  return (verdict === 'good' && sharpness <= 2) || (verdict === 'problem' && sharpness >= 4);
}

const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));

/**
 * @param {object[]} photos photo documents (storage/photos-repo.js)
 * @param {{session_id?, from?, to?}} filter only the session and the period are used here
 * @param {(photo) => string} verdictOf verdict of one photo (default: the diagnosis)
 */
export function buildDashboard(photos, filter = {}, verdictOf = verdictOfPhoto) {
  const scope = scopeOf({ session_id: null, from: null, to: null, ...filter });
  const out = {
    total: 0, rated: 0, unrated: 0, disagreements: 0,
    by_sharpness: zeros(SHARPNESS),
    by_problem: zeros(PROBLEMS),
    by_verdict: zeros(VERDICTS),
    matrix: Object.fromEntries(VERDICTS.map((v) => [v, { ...zeros(SHARPNESS), unrated: 0, total: 0 }])),
  };
  for (const photo of photos) {
    const verdict = verdictOf(photo);
    if (!matchesFilter(photo, verdict, scope)) continue;
    const v = VERDICTS.includes(verdict) ? verdict : 'unknown';
    const row = out.matrix[v];
    out.total += 1;
    out.by_verdict[v] += 1;
    row.total += 1;
    if (isRated(photo)) {
      const { sharpness, problem } = photo.rating;
      out.rated += 1;
      out.by_sharpness[sharpness] += 1;
      out.by_problem[problem] += 1;
      row[sharpness] += 1;
      if (isDisagreement(v, sharpness)) out.disagreements += 1;
    } else {
      out.unrated += 1;
      row.unrated += 1;
    }
  }
  return out;
}
