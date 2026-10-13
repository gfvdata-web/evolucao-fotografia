// Grid thumbnails (~400 px). Derived from the stored preview, never from the
// original, so it works for old photos and for photos that came from the Drive.
// Local cache only: rebuilt on demand, not synced, not in the backup.
import * as repo from '../storage/photos-repo.js';
import { makeThumb } from '../media/media-client.js';

const inFlight = new Map();

async function build(photoId) {
  const cached = await repo.getBlob(repo.blobKey.thumb(photoId));
  if (cached) return cached;
  const preview = await repo.getBlob(repo.blobKey.preview(photoId));
  if (!preview) return null;
  const { thumbBlob } = await makeThumb(preview);
  await repo.putBlob(repo.blobKey.thumb(photoId), thumbBlob);
  return thumbBlob;
}

/** The thumbnail blob of a photo (generated and stored on first use); null without a preview. */
export function getThumb(photoId) {
  if (!inFlight.has(photoId)) {
    const p = build(photoId).finally(() => inFlight.delete(photoId));
    inFlight.set(photoId, p);
  }
  return inFlight.get(photoId);
}
