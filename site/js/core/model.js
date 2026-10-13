// Data model for a photo record (pure, no I/O). See docs/MODELO-DE-DADOS.md.
//
// One record = one shot. A shot may have several *variants*: the CR3, the JPEG
// written by the camera, the JPEG that arrived on the tablet after a transfer...
// Each variant keeps the metadata read from that exact file, so later versions
// can compare stages (camera → transfer → app) and find where quality was lost.

export const SCHEMA_VERSION = 7;

/** Fields the analysis needs. Order = display order of the "missing" list. */
export const EXPECTED_FIELDS = [
  'datetime_original', 'camera.model', 'camera.serial', 'lens.model', 'lens.focal_length_mm',
  'exposure.program', 'exposure.shutter_s', 'exposure.aperture', 'exposure.iso', 'exposure.ev_comp',
  'exposure.metering', 'focus.af_mode', 'focus.af_area_mode', 'focus.af_point', 'drive_mode',
  'picture_style', 'noise_reduction.high_iso', 'noise_reduction.long_exposure',
];

/** Fields only the Canon MakerNotes provide (need the full reader). */
export const MAKERNOTE_FIELDS = new Set([
  'focus.af_mode', 'focus.af_area_mode', 'focus.af_point', 'drive_mode', 'picture_style',
  'noise_reduction.high_iso', 'noise_reduction.long_exposure',
]);

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function emptyCapture() {
  return {
    datetime_original: null,
    camera: { make: null, model: null, serial: null, firmware: null },
    // max_aperture: widest f-number at the focal length used (Canon MakerNote).
    lens: { model: null, focal_length_mm: null, max_aperture: null },
    // measured_ev: scene light read by the camera meter, EV at ISO 100 (Canon
    // MeasuredEV); unlike the exposure used, it ignores the compensation.
    exposure: {
      program: null, shutter_s: null, aperture: null, iso: null, ev_comp: null, metering: null, measured_ev: null,
    },
    // distance: {near_m, far_m, far_infinite} focus distance range (Canon; RF 50 yes, RF 75-300 no).
    focus: { af_mode: null, af_area_mode: null, af_point: null, distance: null },
    drive_mode: null,
    picture_style: null,
    noise_reduction: { high_iso: null, long_exposure: null },
    image: {
      exif_width: null, exif_height: null, quality: null, canon_image_size: null, orientation: null,
    },
    white_balance: null,
    flash: null,
    gps: null,
  };
}

/** Lists expected fields that have no value. */
export function missingFields(capture) {
  return EXPECTED_FIELDS.filter((f) => {
    const v = getPath(capture, f);
    return v === null || v === undefined || v === '';
  });
}

/**
 * Merges captures field by field: the first non-empty value wins, so callers
 * pass captures ordered from most to least trusted.
 */
export function mergeCaptures(captures) {
  const out = emptyCapture();
  const walk = (target, sources) => {
    for (const key of Object.keys(target)) {
      const tv = target[key];
      if (tv && typeof tv === 'object' && !Array.isArray(tv)) {
        walk(tv, sources.map((s) => (s ? s[key] : undefined)));
      } else {
        const found = sources.find((s) => s && s[key] !== null && s[key] !== undefined && s[key] !== '');
        target[key] = found ? found[key] : null;
      }
    }
  };
  // af_point and gps start as null in emptyCapture(), so they are merged as
  // whole objects (never mixing x from one file with y from another).
  walk(out, captures);
  return out;
}

/**
 * Trust order of variants when merging: CR3 first, then camera JPEG, then the
 * rest. The neutral rendering (v0.6) has no metadata of its own (it repeats
 * its CR3's), so it comes last.
 */
export function variantRank(variant) {
  if (variant.kind === RAW_NEUTRAL) return 3;
  if (variant.kind === 'cr3') return 0;
  if (variant.metadata_status === 'complete' && !variant.missing?.some((f) => MAKERNOTE_FIELDS.has(f))) return 1;
  return 2;
}

export function newPhotoRecord({ id, matchKey, now }) {
  return {
    schema_version: SCHEMA_VERSION,
    id,
    match_key: matchKey,
    session_id: null, // core/sessions.js
    scene_id: null, // core/scenes.js (v0.5.1): null = automatic split
    added_at: now,
    updated_at: now,
    variants: [],
    capture: emptyCapture(),
    missing: [...EXPECTED_FIELDS],
    preview: null,
    // Areas chosen by tapping the preview (normalized centre) — null = automatic.
    crop_choice: { af: null, uniform: null },
    // Regions actually used for the 100% crops (normalized, on the displayed image).
    crops: null,
    indicators: null,
    rating: null, // core/rating.js: {sharpness, problem, place, light, subject, note, rated_at}
  };
}

/**
 * Neutral rendering of a CR3 made by the importer (v0.6, decision 0015): the
 * photo without the camera's noise reduction, sharpening and lens corrections.
 * The full image is measured once on the PC and then dropped (`transient`):
 * only its 100% crops and measures are kept and synced.
 */
export const RAW_NEUTRAL = 'raw_neutral';

/**
 * @param {object} p
 * @param {'jpeg'|'cr3'|'raw_neutral'} p.kind
 * @param {'web'|'importer'} p.source
 * @param {File} p.file
 */
export function newVariant({ kind, source, file, key }) {
  return {
    key,
    kind,
    source,
    file: { name: file.name, size: file.size, type: file.type || null, last_modified: file.lastModified || null },
    pixels: null, // decoded dimensions {width, height}
    metadata_status: 'pending', // pending → quick → complete | failed
    engines: [],
    capture: emptyCapture(),
    missing: [...EXPECTED_FIELDS],
    tag_count: null, // number of metadata fields ExifTool found in this file
    analysis: null, // pixels: JPEG header, 100% crops and metrics (pipeline/analyze.js)
    error: null,
  };
}

/** Recomputes the merged capture and missing list of a record from its variants. */
export function refreshRecord(record, now) {
  const ordered = [...record.variants].sort((a, b) => variantRank(a) - variantRank(b));
  record.capture = mergeCaptures(ordered.map((v) => v.capture));
  record.missing = missingFields(record.capture);
  record.updated_at = now;
  return record;
}
