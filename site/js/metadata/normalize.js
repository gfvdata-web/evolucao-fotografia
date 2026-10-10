// Converts the output of each metadata engine into the app's capture shape
// (see core/model.js). Pure functions: the engines run elsewhere.
//
// Enumerated values (focus mode, drive mode...) are kept as the English text
// produced by ExifTool; the UI translates them (core/glossary.js). exifr gives
// numeric codes for standard EXIF enums, mapped here to the same ExifTool text
// so both engines speak the same vocabulary.
import { emptyCapture } from '../core/model.js';

// Standard EXIF enums, using ExifTool's wording.
const EXIF_PROGRAM = {
  0: null, 1: 'Manual', 2: 'Program AE', 3: 'Aperture-priority AE', 4: 'Shutter speed priority AE',
  5: 'Creative (Slow speed)', 6: 'Action (High speed)', 7: 'Portrait', 8: 'Landscape', 9: 'Bulb',
};
const EXIF_METERING = {
  0: null, 1: 'Average', 2: 'Center-weighted average', 3: 'Spot', 4: 'Multi-spot',
  5: 'Multi-segment', 6: 'Partial', 255: 'Other',
};
const EXIF_WHITE_BALANCE = { 0: 'Auto', 1: 'Manual' };

const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v) => (v === undefined || v === null || v === '' ? null : String(v).trim() || null);

/**
 * "2026:10:10 14:30:12" + "45" + "-03:00" → "2026-10-10T14:30:12.45-03:00".
 * Keeps the local wall-clock time of the camera; the offset is appended only if known.
 */
export function isoFromExif(datetime, subsec, offset) {
  if (!datetime) return null;
  const m = String(datetime).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-]\d{2}:\d{2}|Z)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, inlineSub, inlineOffset] = m;
  const sub = inlineSub ?? (subsec !== undefined && subsec !== null && subsec !== '' ? String(subsec) : null);
  const off = inlineOffset ?? strOrNull(offset);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sub ? `.${sub}` : ''}${off || ''}`;
}

/** Output of exifr.parse(file, EXIFR_OPTIONS) → capture. */
export const EXIFR_OPTIONS = {
  tiff: true, exif: true, gps: true, interop: false, ifd1: false,
  makerNote: false, userComment: false, xmp: false, icc: false, iptc: false, jfif: false,
  reviveValues: false, translateValues: false, translateKeys: true, mergeOutput: true,
};

export function fromExifr(raw) {
  const c = emptyCapture();
  if (!raw) return c;
  c.datetime_original = isoFromExif(raw.DateTimeOriginal, raw.SubSecTimeOriginal, raw.OffsetTimeOriginal);
  c.camera.make = strOrNull(raw.Make);
  c.camera.model = strOrNull(raw.Model);
  c.camera.serial = strOrNull(raw.SerialNumber ?? raw.BodySerialNumber);
  c.camera.firmware = strOrNull(raw.Software);
  c.lens.model = strOrNull(raw.LensModel);
  c.lens.focal_length_mm = numOrNull(raw.FocalLength);
  c.exposure.program = EXIF_PROGRAM[raw.ExposureProgram] ?? null;
  c.exposure.shutter_s = numOrNull(raw.ExposureTime);
  c.exposure.aperture = numOrNull(raw.FNumber);
  c.exposure.iso = numOrNull(Array.isArray(raw.ISO) ? raw.ISO[0] : raw.ISO);
  c.exposure.ev_comp = numOrNull(raw.ExposureCompensation);
  c.exposure.metering = EXIF_METERING[raw.MeteringMode] ?? null;
  c.image.exif_width = numOrNull(raw.ExifImageWidth);
  c.image.exif_height = numOrNull(raw.ExifImageHeight);
  c.image.orientation = numOrNull(raw.Orientation);
  c.white_balance = EXIF_WHITE_BALANCE[raw.WhiteBalance] ?? null;
  c.flash = typeof raw.Flash === 'number' ? ((raw.Flash & 1) ? 'Fired' : 'Off, Did not fire') : null;
  if (numOrNull(raw.latitude) !== null && numOrNull(raw.longitude) !== null) {
    c.gps = { lat: raw.latitude, lon: raw.longitude };
  }
  return c;
}

// ---------------------------------------------------------------------------
// ExifTool, called with ["-json", "-l", "-G1"]: keys are "Group:Tag" and each
// value is {desc, val, num?} (num only when it differs from the printed val).

const GROUP_PRIORITY = ['Composite', 'ExifIFD', 'IFD0', 'Canon', 'GPS', 'File', 'QuickTime'];

function makeLookup(json) {
  const byTag = new Map();
  for (const [key, entry] of Object.entries(json || {})) {
    const i = key.indexOf(':');
    if (i < 0) continue;
    const group = key.slice(0, i);
    const tag = key.slice(i + 1);
    const list = byTag.get(tag) || [];
    list.push({ group, entry });
    byTag.set(tag, list);
  }
  const rank = (g) => { const r = GROUP_PRIORITY.indexOf(g); return r < 0 ? 99 : r; };
  for (const list of byTag.values()) list.sort((a, b) => rank(a.group) - rank(b.group));
  const get = (tag, group) => {
    const list = byTag.get(tag);
    if (!list) return undefined;
    const hit = group ? list.find((x) => x.group === group) : list[0];
    return hit?.entry;
  };
  return {
    text: (tag, group) => { const e = get(tag, group); return e ? strOrNull(e.val) : null; },
    num: (tag, group) => {
      const e = get(tag, group);
      if (!e) return null;
      if (typeof e.num === 'number') return e.num;
      return typeof e.val === 'number' ? e.val : null;
    },
    raw: (tag, group) => get(tag, group),
  };
}

/** "1,3" | "0" | "(none)" | 5 → [1,3] | [0] | [] | [5] */
function intList(v) {
  if (v === null || v === undefined) return [];
  if (typeof v === 'number') return [v];
  return String(v).split(/[\s,]+/).map(Number).filter(Number.isFinite);
}

/**
 * Canon AF areas (AFInfo2). Positions are relative to the image centre in AF
 * coordinates, Y positive upwards (EOS). Converting to pixel coordinates is
 * done later, when the decoded image size and orientation are known.
 */
function canonAfPoint(L) {
  const xs = intList(L.raw('AFAreaXPositions', 'Canon')?.val);
  const ys = intList(L.raw('AFAreaYPositions', 'Canon')?.val);
  if (!xs.length || xs.length !== ys.length) return null;
  const ws = intList((L.raw('AFAreaWidths', 'Canon') || L.raw('AFAreaWidth', 'Canon'))?.val);
  const hs = intList((L.raw('AFAreaHeights', 'Canon') || L.raw('AFAreaHeight', 'Canon'))?.val);
  const areas = xs.map((x, i) => ({
    x, y: ys[i], w: ws[i] ?? ws[0] ?? null, h: hs[i] ?? hs[0] ?? null,
  }));
  const imageWidth = L.num('AFImageWidth', 'Canon');
  const imageHeight = L.num('AFImageHeight', 'Canon');
  if (!imageWidth || !imageHeight) return null;
  const inFocusRaw = L.raw('AFPointsInFocus', 'Canon')?.val;
  const selectedRaw = L.raw('AFPointsSelected', 'Canon')?.val;
  return {
    af_image_width: imageWidth,
    af_image_height: imageHeight,
    y_axis: 'up',
    areas,
    in_focus: intList(inFocusRaw),
    selected: intList(selectedRaw),
  };
}

export function fromExifTool(json) {
  const c = emptyCapture();
  if (!json) return c;
  const L = makeLookup(json);
  c.datetime_original = isoFromExif(
    L.text('SubSecDateTimeOriginal', 'Composite') ?? L.text('DateTimeOriginal', 'ExifIFD'),
    null,
    L.text('OffsetTimeOriginal', 'ExifIFD'),
  );
  c.camera.make = L.text('Make', 'IFD0');
  c.camera.model = L.text('Model', 'IFD0');
  c.camera.serial = L.text('SerialNumber', 'ExifIFD') ?? L.text('SerialNumber', 'Canon')
    ?? L.text('InternalSerialNumber', 'Canon');
  c.camera.firmware = L.text('FirmwareVersion', 'Canon') ?? L.text('Software', 'IFD0');
  c.lens.model = L.text('LensModel', 'ExifIFD') ?? L.text('LensModel', 'Canon');
  c.lens.focal_length_mm = L.num('FocalLength', 'ExifIFD');
  c.exposure.program = L.text('ExposureProgram', 'ExifIFD') ?? L.text('CanonExposureMode', 'Canon');
  c.exposure.shutter_s = L.num('ExposureTime', 'ExifIFD');
  c.exposure.aperture = L.num('FNumber', 'ExifIFD');
  c.exposure.iso = L.num('ISO', 'ExifIFD');
  c.exposure.ev_comp = L.num('ExposureCompensation', 'ExifIFD');
  c.exposure.metering = L.text('MeteringMode', 'Canon') ?? L.text('MeteringMode', 'ExifIFD');
  c.focus.af_mode = L.text('FocusMode', 'Canon');
  c.focus.af_area_mode = L.text('AFAreaMode', 'Canon');
  c.focus.af_point = canonAfPoint(L);
  c.drive_mode = L.text('DriveMode', 'Composite') ?? L.text('ContinuousDrive', 'Canon');
  c.picture_style = L.text('PictureStyle', 'Canon');
  c.noise_reduction.high_iso = L.text('HighISONoiseReduction', 'Canon');
  c.noise_reduction.long_exposure = L.text('LongExposureNoiseReduction', 'Canon')
    ?? L.text('LongExposureNoiseReduction2', 'Canon');
  c.image.exif_width = L.num('ExifImageWidth', 'ExifIFD');
  c.image.exif_height = L.num('ExifImageHeight', 'ExifIFD');
  c.image.quality = L.text('Quality', 'Canon');
  c.image.canon_image_size = L.text('CanonImageSize', 'Canon');
  c.image.orientation = L.num('Orientation', 'IFD0');
  c.white_balance = L.text('WhiteBalance', 'Canon') ?? L.text('WhiteBalance', 'ExifIFD');
  c.flash = L.text('Flash', 'ExifIFD');
  const lat = L.num('GPSLatitude', 'Composite');
  const lon = L.num('GPSLongitude', 'Composite');
  if (lat !== null && lon !== null) c.gps = { lat, lon };
  return c;
}

/** Engine label stored with each variant, e.g. "exiftool@13.42". */
export function exifToolVersion(json) {
  const v = json?.['ExifTool:ExifToolVersion'];
  return v ? `exiftool@${v.val}` : 'exiftool';
}
