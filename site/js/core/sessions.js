// Sessions (pure): a named outing that groups photos. Photos point to their
// session through `session_id`; the session document holds only its own data.
// See docs/MODELO-DE-DADOS.md.
import { SCHEMA_VERSION, getPath } from './model.js';

/**
 * Parameters an experiment can vary. `field` = where the value is read on the
 * photo, so every photo of the session can show its value; null = not in the
 * file (e.g. the Camera Connect transfer setting), described by the user.
 */
export const EXPERIMENT_PARAMETERS = [
  { key: 'iso', field: 'exposure.iso' },
  { key: 'shutter', field: 'exposure.shutter_s' },
  { key: 'aperture', field: 'exposure.aperture' },
  { key: 'focal_length', field: 'lens.focal_length_mm' },
  { key: 'lens', field: 'lens.model' },
  { key: 'af_mode', field: 'focus.af_mode' },
  { key: 'af_area', field: 'focus.af_area_mode' },
  { key: 'drive_mode', field: 'drive_mode' },
  { key: 'transfer', field: null },
  { key: 'other', field: null },
];

export const experimentField = (parameter) => EXPERIMENT_PARAMETERS.find((p) => p.key === parameter)?.field || null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-10" + random suffix → "ses-20261010-k3x9ab" (no date: "ses-semdata-..."). */
export function sessionId(date, suffix) {
  return `ses-${date && DATE_RE.test(date) ? date.replaceAll('-', '') : 'semdata'}-${suffix}`;
}

/** "2026-10-10" → "10/10/2026" */
export function formatDate(date) {
  if (!date || !DATE_RE.test(date)) return null;
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export const defaultSessionName = (date) => (date ? `Sessão de ${formatDate(date)}` : 'Sessão sem data');

export function newSession({ id, name, date = null, now }) {
  return {
    schema_version: SCHEMA_VERSION,
    id,
    name: (name || defaultSessionName(date)).trim(),
    date: date && DATE_RE.test(date) ? date : null,
    location: '',
    notes: '',
    experiment: null, // { parameter, description } — one parameter varied on purpose
    created_at: now,
    updated_at: now,
  };
}

/**
 * Validated partial change of a session. Empty name falls back to the default;
 * experiment = null turns the marking off.
 */
export function applySessionPatch(session, patch, now) {
  const out = { ...session };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'name') out.name = String(value ?? '').trim().slice(0, 120);
    else if (key === 'date') {
      if (value && !DATE_RE.test(value)) throw new Error(`data inválida: ${value}`);
      out.date = value || null;
    } else if (key === 'location' || key === 'notes') out[key] = String(value ?? '').slice(0, 2000);
    else if (key === 'experiment') {
      if (value === null) out.experiment = null;
      else {
        if (!EXPERIMENT_PARAMETERS.some((p) => p.key === value.parameter)) throw new Error(`parâmetro inválido: ${value.parameter}`);
        out.experiment = { parameter: value.parameter, description: String(value.description ?? '').slice(0, 500) };
      }
    } else throw new Error(`campo de sessão desconhecido: ${key}`);
  }
  if (!out.name) out.name = defaultSessionName(out.date);
  out.updated_at = now;
  return out;
}

/** Calendar day of the capture as written by the camera clock ("YYYY-MM-DD"), or null. */
export function captureDate(photo) {
  const m = String(photo?.capture?.datetime_original || '').match(/^(\d{4}-\d{2}-\d{2})T/);
  return m ? m[1] : null;
}

/**
 * Photos without a session, grouped by capture day (newest first; photos
 * without a capture date last). Existing sessions of the same day are listed,
 * so the screen can offer "join" instead of "create".
 * @returns {{date: string|null, photo_ids: string[], sessions: object[]}[]}
 */
export function suggestGroups(photos, sessions = []) {
  const groups = new Map();
  for (const p of photos) {
    if (p.session_id) continue;
    const date = captureDate(p);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(p.id);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null) - (b === null) || String(b).localeCompare(String(a)))
    .map(([date, ids]) => ({
      date,
      photo_ids: ids,
      sessions: date ? sessions.filter((s) => s.date === date) : [],
    }));
}

/** Sessions newest first (by date, then creation). */
export function sortSessions(sessions) {
  return [...sessions].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))
    || String(b.created_at).localeCompare(String(a.created_at)));
}

/** Photos of a session in capture order (oldest first: the order they were taken). */
export function sessionPhotos(photos, sessionId) {
  return photos.filter((p) => p.session_id === sessionId).sort(byCapture);
}

export function byCapture(a, b) {
  const da = a.capture?.datetime_original || '';
  const db = b.capture?.datetime_original || '';
  if (da !== db) return (da === '') - (db === '') || da.localeCompare(db);
  return String(a.added_at || '').localeCompare(String(b.added_at || ''));
}

/** Value of the experiment parameter on a photo (raw, as stored), or null. */
export function experimentValue(photo, experiment) {
  const field = experiment && experimentField(experiment.parameter);
  if (!field) return null;
  const v = getPath(photo.capture, field);
  return v === undefined || v === '' ? null : v;
}
