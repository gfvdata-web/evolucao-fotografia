// Reprocessing plan (v2.0, decision 0017): which photos have measures from an
// older METRICS_VERSION and where the original of each version that has to be
// measured again comes from — this device, the Drive (downloaded, measured and
// discarded) or nowhere. Pure: the caller says which originals are stored here
// and passes the sync state of each photo (Drive file ids and sizes).
import { METRICS_VERSION } from './indicators.js';

/**
 * Versions of a photo measured by an older METRICS_VERSION. Not yet measured
 * (photo still in the upload queue) is not "old": the analysis queue takes it.
 * The neutral RAW (transient, decision 0015) keeps its first measures: its full
 * image is gone, so it is never stale here.
 */
export function staleVariants(photo) {
  return photo.variants.filter((v) => v.pixels && !v.transient && v.analysis && v.analysis.metrics_version !== METRICS_VERSION);
}

export const hasOldMeasures = (photo) => staleVariants(photo).length > 0;

/** Photos with old measures (optionally only one session; null = all). */
export function stalePhotos(photos, sessionId = null) {
  return photos.filter((p) => (sessionId === null || (p.session_id || null) === sessionId) && hasOldMeasures(p));
}

export const staleCount = (photos, sessionId = null) => stalePhotos(photos, sessionId).length;

/**
 * Why a version cannot be measured again.
 *   no_drive   not on this device and the Drive is not connected
 *   not_saved  not on this device nor on the Drive (originals not sent)
 */
export const MISSING_REASONS = ['no_drive', 'not_saved'];

/**
 * @param {object[]} photos  all photos
 * @param {{sessionId?: string|null, hasLocal: (photoId, variantKey) => boolean,
 *          syncState: (photoId) => object|undefined, driveConnected: boolean}} env
 * @returns {{items: object[], total: number, local: number, drive: number, missing: number, download_bytes: number}}
 *   item = { photo_id, source: 'local'|'drive'|'missing', downloads: [{variant, id, size}], missing: [{variant, reason}] }
 *   A photo is 'missing' when one of its versions cannot be measured; the others are still
 *   measured (and the photo stays outdated, listed as such).
 */
export function reprocessPlan(photos, { sessionId = null, hasLocal, syncState, driveConnected }) {
  const items = [];
  for (const p of stalePhotos(photos, sessionId)) {
    const downloads = [];
    const missing = [];
    for (const v of staleVariants(p)) {
      if (hasLocal(p.id, v.key)) continue;
      const asset = syncState(p.id)?.assets?.[`original/${v.key}`];
      if (!asset?.id) missing.push({ variant: v.key, reason: 'not_saved' });
      else if (!driveConnected) missing.push({ variant: v.key, reason: 'no_drive' });
      else downloads.push({ variant: v.key, id: asset.id, size: Number(asset.size || v.file?.size || 0) });
    }
    const source = missing.length ? 'missing' : downloads.length ? 'drive' : 'local';
    items.push({ photo_id: p.id, source, downloads, missing });
  }
  const count = (s) => items.filter((i) => i.source === s).length;
  return {
    items,
    total: items.length,
    local: count('local'),
    drive: count('drive'),
    missing: count('missing'),
    download_bytes: items.reduce((n, i) => n + i.downloads.reduce((m, d) => m + d.size, 0), 0),
  };
}
