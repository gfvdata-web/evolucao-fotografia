// Sessions and ratings: every change to a photo record goes through the same
// per-shot lock as ingestion and analysis, so a rating tapped while the
// background analysis runs is never overwritten by it (and vice versa).
import * as repo from '../storage/photos-repo.js';
import * as sessionsRepo from '../storage/sessions-repo.js';
import * as syncRepo from '../storage/sync-repo.js';
import { applySettingsPatch } from '../core/settings.js';
import { applyRatingPatch } from '../core/rating.js';
import { applySessionPatch, newSession, sessionId, sessionPhotos } from '../core/sessions.js';
import { planMove, sessionScenes } from '../core/scenes.js';
import { notifyChanged, notifySessionsChanged, withLock, lockKeyOf } from './photo-events.js';

const now = () => new Date().toISOString();

function randomSuffix() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => (b % 36).toString(36)).join('');
}

/** Read-modify-write of one photo under its lock; `change` mutates the fresh record. */
async function updatePhoto(photoId, change) {
  const record = await repo.getPhoto(photoId);
  if (!record) return null;
  let saved = null;
  await withLock(lockKeyOf(record), async () => {
    const fresh = await repo.getPhoto(photoId);
    if (!fresh) return;
    change(fresh);
    fresh.updated_at = now();
    await repo.savePhoto(fresh);
    saved = fresh;
  });
  if (saved) notifyChanged(photoId);
  return saved;
}

/** @param {{sharpness?, problem?, place?, light?, subject?, note?}} patch — null clears a field */
export function setRating(photoId, patch) {
  return updatePhoto(photoId, (r) => { r.rating = applyRatingPatch(r.rating, patch, now()); });
}

/** Moves photos to a session (or out of any session with null). */
export async function assignPhotos(photoIds, targetSessionId) {
  for (const id of photoIds) {
    await updatePhoto(id, (r) => {
      // A scene belongs to its session: in the new one the photo starts automatic.
      if (r.session_id !== targetSessionId) r.scene_id = null;
      r.session_id = targetSessionId;
    });
  }
  notifySessionsChanged();
}

const newSceneId = () => `cena-${randomSuffix()}`;

/**
 * Moves photos to another scene of their session (`target` = scene id, or
 * "__new"). The session's split is frozen first, so the other photos stay in
 * the scenes they were shown in (core/scenes.js, planMove).
 */
export async function movePhotosToScene(sessionIdValue, photoIds, target) {
  const photos = sessionPhotos(await repo.listPhotos(), sessionIdValue);
  const plan = planMove(sessionScenes(photos), photoIds, target, newSceneId);
  for (const [id, sceneId] of plan) await updatePhoto(id, (r) => { r.scene_id = sceneId; });
  notifySessionsChanged();
  return plan.size;
}

/** Back to the automatic split of the session's scenes. */
export async function resetScenes(sessionIdValue) {
  const photos = sessionPhotos(await repo.listPhotos(), sessionIdValue).filter((p) => p.scene_id);
  for (const p of photos) await updatePhoto(p.id, (r) => { r.scene_id = null; });
  notifySessionsChanged();
}

/** Creates a session, optionally with photos. Returns the session. */
export async function createSession({ name = null, date = null, photoIds = [] } = {}) {
  const session = newSession({ id: sessionId(date, randomSuffix()), name, date, now: now() });
  await sessionsRepo.saveSession(session);
  if (photoIds.length) await assignPhotos(photoIds, session.id);
  else notifySessionsChanged();
  return session;
}

export async function updateSession(id, patch) {
  const current = await sessionsRepo.getSession(id);
  if (!current) return null;
  const next = applySessionPatch(current, patch, now());
  await sessionsRepo.saveSession(next);
  notifySessionsChanged();
  return next;
}

/**
 * Deletes the session only; its photos stay, without a session. On the Drive
 * the photos' files move to _sem_sessao and the folder goes to the trash.
 */
export async function deleteSession(id) {
  const photos = await repo.listPhotos();
  await assignPhotos(photos.filter((p) => p.session_id === id).map((p) => p.id), null);
  await syncRepo.addTombstone('session', id, now());
  await sessionsRepo.deleteSessionRecord(id);
  notifySessionsChanged();
}

/**
 * Removes a photo from this device and, through the next sync, from the
 * Drive (its files go to the Drive trash) and from the other devices.
 */
export async function removePhoto(photoId) {
  const record = await repo.getPhoto(photoId);
  if (!record) return;
  await withLock(lockKeyOf(record), async () => {
    const state = await syncRepo.getSync(`photo/${photoId}`);
    const ids = Object.values(state?.assets || {}).map((a) => a.id).filter(Boolean);
    await syncRepo.addTrash({ photo_id: photoId, folder_session: state?.folder_session || null, ids });
    if (state) await syncRepo.addTombstone('photo', photoId, now());
    await repo.deletePhoto(photoId);
  });
  notifyChanged(photoId);
  notifySessionsChanged();
}

/** Changes settings (validated) and marks them for the Drive's config.json. */
export async function updateSettings(patch) {
  const next = applySettingsPatch(await syncRepo.getSettings(), patch);
  await syncRepo.saveSettings(next, now());
  notifySessionsChanged();
  return next;
}
