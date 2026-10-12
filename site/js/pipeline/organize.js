// Sessions and ratings: every change to a photo record goes through the same
// per-shot lock as ingestion and analysis, so a rating tapped while the
// background analysis runs is never overwritten by it (and vice versa).
import * as repo from '../storage/photos-repo.js';
import * as sessionsRepo from '../storage/sessions-repo.js';
import { applyRatingPatch } from '../core/rating.js';
import { applySessionPatch, newSession, sessionId } from '../core/sessions.js';
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
  for (const id of photoIds) await updatePhoto(id, (r) => { r.session_id = targetSessionId; });
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

/** Deletes the session only; its photos stay on the device, without a session. */
export async function deleteSession(id) {
  const photos = await repo.listPhotos();
  await assignPhotos(photos.filter((p) => p.session_id === id).map((p) => p.id), null);
  await sessionsRepo.deleteSessionRecord(id);
  notifySessionsChanged();
}
