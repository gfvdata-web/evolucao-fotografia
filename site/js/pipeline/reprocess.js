// Reprocessing (v2.0, decision 0017): measures again, with the current
// METRICS_VERSION, every photo (of a session or all) whose measures are older.
// One photo at a time, through the analysis queue (pipeline/analyze.js):
//   original stored here  → measured from it
//   original on the Drive → downloaded, measured and discarded (never stored)
//   no original           → keeps the old measures and is listed with the reason
// No state of its own: what was redone leaves the plan, so running again
// after a pause, a closed tab or a failure continues from where it stopped.
import { analyzeNow } from './analyze.js';
import { downloadFile, driveReady } from './sync.js';
import { hasOldMeasures, reprocessPlan } from '../core/reprocess.js';
import * as repo from '../storage/photos-repo.js';
import * as syncRepo from '../storage/sync-repo.js';

export const reprocessEvents = new EventTarget();
export const reprocessStatus = {
  /** 'idle' | 'running' | 'pausing' */
  state: 'idle',
  session_id: null,
  /** { done, total, current } while running */
  progress: null,
  /** last run: { done, redone, not_redone: [{photo_id, name, reasons: [text keys]}], paused } */
  result: null,
};
const set = (patch) => { Object.assign(reprocessStatus, patch); reprocessEvents.dispatchEvent(new Event('change')); };

/** Plan for a session (or all photos with sessionId null), read from this device. */
export async function planReprocess(sessionId = null) {
  const [photos, sync] = await Promise.all([repo.listPhotos(), syncRepo.allSync()]);
  const local = new Set();
  for (const p of photos) {
    for (const v of p.variants) if (await repo.getBlob(repo.blobKey.original(p.id, v.key))) local.add(`${p.id}/${v.key}`);
  }
  return reprocessPlan(photos, {
    sessionId,
    hasLocal: (id, key) => local.has(`${id}/${key}`),
    syncState: (id) => sync.get(`photo/${id}`),
    driveConnected: driveReady(),
  });
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not supported or refused: the run continues */ }
}

const nameOf = (photo) => photo?.variants[0]?.file.name || photo?.id || '';

/** Stops after the photo being measured now. */
export function pauseReprocess() {
  if (reprocessStatus.state === 'running') set({ state: 'pausing' });
}

/**
 * Runs the plan of a session (or all, with null). Resolves with the result.
 * Only one run at a time: a second call returns the running one.
 */
let running = null;
export function startReprocess(sessionId = null) {
  if (running) return running;
  running = (async () => {
    const plan = await planReprocess(sessionId);
    set({ state: 'running', session_id: sessionId, progress: { done: 0, total: plan.total, current: null }, result: null });
    keepAwake(true);
    const notRedone = [];
    let done = 0;
    let redone = 0;
    for (const item of plan.items) {
      if (reprocessStatus.state === 'pausing') break;
      const photo = await repo.getPhoto(item.photo_id);
      if (!photo) { done += 1; continue; }
      set({ progress: { done, total: plan.total, current: nameOf(photo) } });
      const reasons = item.missing.map((m) => m.reason);
      const originals = new Map();
      for (const d of item.downloads) {
        try { originals.set(d.variant, await downloadFile(d.id)); } catch { reasons.push('download'); }
      }
      let out = { measured: [], errors: [] };
      try { out = await analyzeNow(item.photo_id, { originals }); } catch { reasons.push('failed'); }
      originals.clear(); // downloaded originals are measured and discarded
      if (out.errors.length) reasons.push('failed');
      const fresh = await repo.getPhoto(item.photo_id);
      const stillStale = fresh && hasOldMeasures(fresh);
      if (stillStale || reasons.length) {
        notRedone.push({ photo_id: item.photo_id, name: nameOf(photo), reasons: [...new Set(reasons.length ? reasons : ['failed'])] });
      } else redone += 1;
      done += 1;
      set({ progress: { done, total: plan.total, current: null } });
    }
    const paused = reprocessStatus.state === 'pausing';
    set({ state: 'idle', progress: null, result: { total: plan.total, done, redone, not_redone: notRedone, paused } });
    return reprocessStatus.result;
  })().catch((e) => {
    console.error('reprocessamento falhou', e);
    set({ state: 'idle', progress: null, result: { total: 0, done: 0, redone: 0, not_redone: [], paused: false, error: e.message } });
    return reprocessStatus.result;
  }).finally(() => { running = null; keepAwake(false); });
  return running;
}

