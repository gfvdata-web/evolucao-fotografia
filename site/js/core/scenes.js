// Scenes inside a session (pure; v0.5.1, decision 0014).
//
// A scene = shots of the same subject and light, usually a few minutes apart.
// The split is automatic (pause between shots, lens change, zoom jump, a
// different framing by the 8×8 signature) and the user can fix it by dragging
// a photo to another scene. A photo's `scene_id` is null while automatic;
// moving any photo "freezes" the session: every photo gets the id of the scene
// it is shown in, so the fix survives new photos and other devices. Photos
// that arrive later in a frozen session join the closest scene in time, or
// form new automatic scenes.
import { byCapture } from './sessions.js';

export const SCENE_LIMITS = {
  // A pause this long always starts a new scene.
  hard_gap_s: 15 * 60,
  // Signals that, two at a time, start a new scene.
  soft_gap_s: 2 * 60,
  focal_jump: 1.8, // ratio between consecutive focal lengths (e.g. 100 → 300 mm)
  // Framing distance (signatureDistance). 1st round: same scene 1–30 (T series,
  // bursts), new subject 38–78 (F04 78, F10 59, F03 56).
  signature_diff: 28,
  // A very different framing starts a new scene alone, after a short pause.
  signature_very: 45,
  // 30 s: in the F03 burst a frame 22 s after the previous one read 41.
  very_gap_s: 30,
  // Photos arriving in a frozen session join a scene within this time.
  join_gap_s: 5 * 60,
};

/** Camera clock as milliseconds (the offset is ignored: same camera, same clock). */
export function captureMs(photo) {
  const m = String(photo?.capture?.datetime_original || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) + (frac ? Math.round(Number(`0.${frac}`) * 1000) : 0);
}

const signatureOf = (photo) => {
  const key = photo.indicators?.primary_variant;
  const v = photo.variants?.find((x) => x.key === key) || photo.variants?.find((x) => x.analysis?.whole);
  return v?.analysis?.whole?.signature || null;
};

/**
 * Framing distance between two 8×8 signatures, in brightness levels: each
 * grid is taken relative to its own mean (a change of exposure alone is not a
 * new scene), plus the change of colour balance. Same framing ≈ 0–15.
 */
export function signatureDistance(a, b) {
  if (!a?.grid?.length || !b?.grid?.length || a.grid.length !== b.grid.length) return null;
  const mean = (g) => g.reduce((s, v) => s + v, 0) / g.length;
  const ma = mean(a.grid); const mb = mean(b.grid);
  // Scale both to the same mean brightness before comparing the layout.
  const ka = ma > 1 ? 128 / ma : 1; const kb = mb > 1 ? 128 / mb : 1;
  let d = 0;
  for (let i = 0; i < a.grid.length; i++) d += Math.abs(a.grid[i] * ka - b.grid[i] * kb);
  d /= a.grid.length;
  const chroma = (rgb) => { const s = rgb.reduce((x, y) => x + y, 0) || 1; return rgb.map((v) => v / s); };
  const ca = chroma(a.rgb || [1, 1, 1]); const cb = chroma(b.rgb || [1, 1, 1]);
  const dc = ca.reduce((s, v, i) => s + Math.abs(v - cb[i]), 0);
  return d + dc * 200;
}

/**
 * Why `b` starts a new scene after `a` (or null when it does not).
 * @returns {{reasons: string[], keys: string[]}|null}
 */
export function boundary(a, b, L = SCENE_LIMITS) {
  const ta = captureMs(a); const tb = captureMs(b);
  if ((ta === null) !== (tb === null)) return { keys: ['no_date'], reasons: ['sem data de captura'] };
  const gap = ta !== null && tb !== null ? (tb - ta) / 1000 : null;
  const la = a.capture?.lens?.model; const lb = b.capture?.lens?.model;
  if (gap !== null && gap >= L.hard_gap_s) return { keys: ['pause'], reasons: [`pausa de ${minutes(gap)}`] };
  if (la && lb && la !== lb) return { keys: ['lens'], reasons: [`troca de lente (${shortLens(la)} → ${shortLens(lb)})`] };
  const soft = [];
  if (gap !== null && gap >= L.soft_gap_s) soft.push(['pause', `pausa de ${minutes(gap)}`]);
  const fa = a.capture?.lens?.focal_length_mm; const fb = b.capture?.lens?.focal_length_mm;
  if (fa && fb && Math.max(fa, fb) / Math.min(fa, fb) >= L.focal_jump) soft.push(['zoom', `zoom de ${Math.round(fa)} para ${Math.round(fb)} mm`]);
  const sd = signatureDistance(signatureOf(a), signatureOf(b));
  if (sd !== null && sd >= L.signature_diff) soft.push(['framing', 'enquadramento diferente']);
  if (soft.length >= 2 || (sd !== null && sd >= L.signature_very && gap !== null && gap >= L.very_gap_s)) {
    return { keys: soft.map((s) => s[0]), reasons: soft.map((s) => s[1]) };
  }
  return null;
}

function minutes(s) {
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 90 * 60) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1).replace('.', ',')} h`;
}
const shortLens = (m) => String(m).replace(/^RF/, 'RF ').replace(/mm.*$/, ' mm');

/** Automatic split of photos (any order) into groups, with the reason each group starts. */
export function autoSplit(photos, L = SCENE_LIMITS) {
  const sorted = [...photos].sort(byCapture);
  const groups = [];
  for (let i = 0; i < sorted.length; i++) {
    const cut = i === 0 ? null : boundary(sorted[i - 1], sorted[i], L);
    if (i === 0 || cut) groups.push({ photos: [], reasons: cut?.reasons || [] });
    groups[groups.length - 1].photos.push(sorted[i]);
  }
  return groups;
}

/**
 * Scenes of a session's photos, in capture order.
 * @returns {{id:string, auto:boolean, number:number, photos:object[], reasons:string[], start:string|null, end:string|null}[]}
 */
export function sessionScenes(photos, L = SCENE_LIMITS) {
  const fixed = photos.filter((p) => p.scene_id);
  const loose = photos.filter((p) => !p.scene_id);
  const byId = new Map();
  for (const p of fixed) {
    if (!byId.has(p.scene_id)) byId.set(p.scene_id, { id: p.scene_id, auto: false, photos: [], reasons: [] });
    byId.get(p.scene_id).photos.push(p);
  }
  const leftovers = [];
  for (const p of loose) {
    const t = captureMs(p);
    let best = null;
    if (t !== null) {
      for (const q of fixed) {
        const tq = captureMs(q);
        if (tq === null) continue;
        const sameLens = !p.capture?.lens?.model || !q.capture?.lens?.model || p.capture.lens.model === q.capture.lens.model;
        const dt = Math.abs(t - tq) / 1000;
        if (sameLens && dt <= L.join_gap_s && (!best || dt < best.dt)) best = { dt, id: q.scene_id };
      }
    }
    if (best) byId.get(best.id).photos.push(p); else leftovers.push(p);
  }
  const scenes = [...byId.values()];
  for (const g of autoSplit(leftovers, L)) {
    scenes.push({ id: `auto:${g.photos[0].id}`, auto: true, photos: g.photos, reasons: g.reasons });
  }
  for (const s of scenes) s.photos.sort(byCapture);
  // Scenes in order of their median shot: moving one photo (even the first of
  // the session) to another scene does not renumber the scenes.
  const median = (s) => {
    const ts = s.photos.map(captureMs).filter((t) => t !== null).sort((x, y) => x - y);
    return ts.length ? ts[Math.floor((ts.length - 1) / 2)] : Infinity;
  };
  scenes.sort((a, b) => median(a) - median(b) || byCapture(a.photos[0], b.photos[0]));
  // The reason a fixed scene starts: the boundary with the scene before it.
  scenes.forEach((s, i) => {
    s.number = i + 1;
    s.start = s.photos[0].capture?.datetime_original || null;
    s.end = s.photos[s.photos.length - 1].capture?.datetime_original || null;
    if (!s.auto && i > 0) s.reasons = boundary(scenes[i - 1].photos[scenes[i - 1].photos.length - 1], s.photos[0], L)?.reasons || [];
    if (i === 0) s.reasons = [];
  });
  return scenes;
}

/**
 * Scene ids to store after moving photos: every photo gets the id of the scene
 * it is in (automatic scenes get a new id), then the moved photos get the
 * target. `newId()` makes ids ("cena-xxxxxx"). Returns photo id → scene id,
 * only for photos whose scene_id changes.
 * @param {string} target scene id, or "__new" for a new scene
 */
export function planMove(scenes, photoIds, target, newId) {
  const ids = new Map();
  for (const s of scenes) {
    const id = s.auto ? newId() : s.id;
    for (const p of s.photos) ids.set(p.id, { id, before: p.scene_id || null });
  }
  let dest = target;
  if (target === '__new') dest = newId();
  else {
    const scene = scenes.find((s) => s.id === target);
    if (!scene) throw new Error(`cena desconhecida: ${target}`);
    dest = ids.get(scene.photos[0].id).id;
  }
  for (const pid of photoIds) if (ids.has(pid)) ids.get(pid).id = dest;
  const out = new Map();
  for (const [pid, { id, before }] of ids) if (id !== before) out.set(pid, id);
  return out;
}

/** True when the user has adjusted the scenes of these photos. */
export const scenesAdjusted = (photos) => photos.some((p) => p.scene_id);
