// Pixel analysis of a photo: decides the crop regions, runs the media worker
// on every variant (the same part of the scene in all of them, so versions of
// the same shot can be compared) and stores crops + metrics + indicators.
//
// Region of the focus crop, in order of preference:
//   1. area tapped by the user on the preview (crop_choice.af)
//   2. AF area recorded by the camera (MakerNote)
//   3. image centre
// Uniform-area crop: tapped area, otherwise automatic search on the primary
// variant, reused for the others.
//
// Regions are sized in the primary variant (512 px at its full resolution)
// and mapped into each version's field of view: the JPEG inside a CR3 covers
// the whole sensor even when the camera JPEG is 16:9 (af-geometry.mapRegion).
// Taps and the stored crop boxes are in the preview's frame.
//
// Each analysis also re-derives the capture of every version from its stored
// ExifTool read, so normalizer fixes reach photos sent with older versions
// (e.g. v0.1 photos with 143 empty AF areas, or A+ shown as P).
import { analyzeImage } from '../media/media-client.js';
import {
  afCenterOnPreview, clampRegion, frameVariant, mapPoint, mapRegion, regionAround, variantField,
} from '../core/af-geometry.js';
import { buildIndicators, METRICS_VERSION, needsAnalysis, primaryVariant } from '../core/indicators.js';
import { missingFields, refreshRecord } from '../core/model.js';
import { fromExifTool } from '../metadata/normalize.js';
import * as repo from '../storage/photos-repo.js';
import { notifyChanged, withLock, lockKeyOf } from './photo-events.js';
import { recordTiming } from './perf.js';

export const AF_CROP_PX = 512;
export const UNIFORM_CROP_PX = 256;

let queue = Promise.resolve();
const queued = new Set();

const metadataSettled = (record) => record.variants.every((v) => v.metadata_status === 'complete' || v.metadata_status === 'failed');

/** Focus region in the primary's frame; `toPrimary` maps a point on the preview. */
function focusRegion(record, toPrimary, around) {
  const choice = record.crop_choice?.af;
  if (choice) return { rect: around(toPrimary(choice), AF_CROP_PX), source: 'manual' };
  const af = afCenterOnPreview(record);
  if (af) return { rect: around(toPrimary(af), AF_CROP_PX), source: 'makernote' };
  return { rect: around({ cx: 0.5, cy: 0.5 }, AF_CROP_PX), source: 'center' };
}

/**
 * Capture of each version re-read from its stored ExifTool output (key →
 * capture). The neutral RAW (v0.6) reads the output of the CR3 it came from.
 */
async function renormalized(record) {
  const out = new Map();
  for (const v of record.variants) {
    if (v.metadata_status !== 'complete') continue;
    const raw = await repo.getRawMetadata(record.id, v.from_variant || v.key);
    if (raw) out.set(v.key, fromExifTool(raw));
  }
  return out;
}

function applyCaptures(record, captures, now) {
  if (!captures.size) return;
  for (const v of record.variants) {
    const c = captures.get(v.key);
    if (c) { v.capture = c; v.missing = missingFields(c); }
  }
  refreshRecord(record, now);
}

/**
 * `originals` (variant key → Blob): originals that are not stored on this device
 * (downloaded from the Drive to reprocess, decision 0017). Measured like the stored
 * ones and never saved. Returns {measured, errors} (variant keys).
 */
async function run(photoId, force, originals = null) {
  const out = { measured: [], errors: [] };
  const record = await repo.getPhoto(photoId);
  if (!record || !metadataSettled(record)) return out; // re-triggered when the full read ends
  if (!force && !needsAnalysis(record)) return out;
  const captures = await renormalized(record);
  applyCaptures(record, captures, record.updated_at);
  const primary = primaryVariant(record);
  if (!primary) return out;

  const ref = frameVariant(record) || primary;
  const field = (v) => variantField(v, record.capture.camera.model);
  const toPrimary = (p) => mapPoint(p, field(ref), field(primary));
  const fromPrimary = (rect, v) => (rect ? clampRegion(mapRegion(rect, field(primary), field(v))) : null);
  const { width: W, height: H } = primary.pixels;
  const around = (p, size) => regionAround(p.cx, p.cy, size, W, H);
  const focus = focusRegion(record, toPrimary, around);
  const uChoice = record.crop_choice?.uniform;
  let uniform = uChoice ? { rect: around(toPrimary(uChoice), UNIFORM_CROP_PX), source: 'manual' } : null;

  // Primary first: it decides the automatic uniform area for the others.
  const ordered = [primary, ...record.variants.filter((v) => v !== primary)];
  const results = new Map();
  const tAnalysis = performance.now();
  for (const v of ordered) {
    const file = originals?.get(v.key) || await repo.getBlob(repo.blobKey.original(record.id, v.key));
    if (!file) continue;
    try {
      const r = await analyzeImage(file, v.kind, v.capture.image.orientation || record.capture.image.orientation || 1, {
        afRect: fromPrimary(focus.rect, v), uniformRect: fromPrimary(uniform?.rect, v), uniformPx: UNIFORM_CROP_PX,
        full: v === primary,
      });
      if (!uniform && r.uniform && v === primary) uniform = { rect: r.uniform.rect, source: 'auto' };
      results.set(v.key, r);
    } catch (e) {
      results.set(v.key, { error: e.message });
    }
  }
  // No original on this device (photo that came from the Drive or a backup
  // without originals): keep the analysis made where the photo was sent.
  if (!results.size) return out;
  for (const [key, r] of results) (r.error ? out.errors : out.measured).push(key);
  if ([...results.values()].some((r) => !r.error)) recordTiming('analysis', performance.now() - tAnalysis);

  const now = new Date().toISOString();
  await withLock(lockKeyOf(record), async () => {
    const fresh = await repo.getPhoto(photoId);
    if (!fresh) return;
    applyCaptures(fresh, captures, now);
    const blobs = [];
    for (const v of fresh.variants) {
      const r = results.get(v.key);
      if (!r) continue;
      if (r.error) {
        v.analysis = { metrics_version: METRICS_VERSION, analyzed_at: now, error: r.error };
        continue;
      }
      const strip = (c) => (c ? {
        rect: c.rect, px: c.px, laplacian_var: c.laplacian_var, sigma: c.sigma, mean_luma: c.mean_luma, blur: c.blur ?? null,
      } : null);
      v.analysis = {
        metrics_version: METRICS_VERSION,
        analyzed_at: now,
        decoded: { width: r.width, height: r.height },
        jpeg: r.jpeg,
        af: r.af ? { ...strip(r.af), source: focus.source } : null,
        uniform: r.uniform ? { ...strip(r.uniform), source: uniform?.source || 'auto' } : null,
        // Whole photo (primary version only): histogram, 8×8 signature, 100% tiles.
        whole: r.whole || null,
      };
      if (r.af) blobs.push({ key: repo.blobKey.crop(fresh.id, v.key, 'af'), blob: r.af.blob });
      if (r.uniform) blobs.push({ key: repo.blobKey.crop(fresh.id, v.key, 'uniform'), blob: r.uniform.blob });
    }
    fresh.crops = {
      primary_variant: primary.key,
      af: { rect: fromPrimary(focus.rect, ref), source: focus.source },
      uniform: uniform ? { rect: fromPrimary(uniform.rect, ref), source: uniform.source } : null,
    };
    fresh.indicators = buildIndicators(fresh, now);
    fresh.updated_at = now;
    // Transient versions (the neutral RAW, decision 0015): measured once, the
    // full image goes away; crops and measures stay and are synced.
    const dropBlobs = fresh.variants.filter((v) => v.transient && results.has(v.key))
      .map((v) => repo.blobKey.original(fresh.id, v.key));
    await repo.savePhoto(fresh, { blobs, dropBlobs });
  });
  notifyChanged(photoId);
  return out;
}

/**
 * Queues the analysis of a photo (one photo at a time: full-resolution decodes
 * are memory heavy on the tablet). Without `force`, does nothing when the
 * stored analysis is current.
 */
export function scheduleAnalysis(photoId, { force = false } = {}) {
  const key = `${photoId}|${force}`;
  if (queued.has(key)) return queue;
  queued.add(key);
  queue = queue.then(() => run(photoId, force)).catch((e) => console.error('análise falhou', e)).finally(() => queued.delete(key));
  return queue;
}

/**
 * Analyses one photo now, in the same one-at-a-time queue, and says what was
 * measured: {measured, errors} (variant keys). `originals` as in run().
 */
export function analyzeNow(photoId, { originals = null } = {}) {
  const job = queue.then(() => run(photoId, false, originals));
  queue = job.catch((e) => console.error('análise falhou', e));
  return job;
}

/**
 * Stores areas tapped on the preview (normalized centre, or null to go back
 * to automatic) and recomputes the crops of every version once.
 * @param {{af?: {cx,cy}|null, uniform?: {cx,cy}|null}} patch
 */
export async function setCropChoice(photoId, patch) {
  const record = await repo.getPhoto(photoId);
  if (!record) return;
  await withLock(lockKeyOf(record), async () => {
    const fresh = await repo.getPhoto(photoId);
    fresh.crop_choice = { ...(fresh.crop_choice || { af: null, uniform: null }), ...patch };
    fresh.updated_at = new Date().toISOString();
    await repo.savePhoto(fresh);
  });
  notifyChanged(photoId);
  return scheduleAnalysis(photoId, { force: true });
}

/** Re-analyses every stored photo whose metrics are missing or outdated. */
export async function analyzeAllStale() {
  const photos = await repo.listPhotos();
  const stale = photos.filter(needsAnalysis);
  for (const p of stale) scheduleAnalysis(p.id);
  await queue;
  return stale.length;
}
