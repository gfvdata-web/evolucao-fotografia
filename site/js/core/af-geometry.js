// Converts Canon AF areas (relative to the image centre, in AF coordinates,
// Y positive upwards for EOS bodies) into rectangles normalized to 0..1 over
// the image as displayed (after the EXIF orientation is applied), and maps
// regions between versions of one shot that cover different parts of the
// sensor (see sensorField). Pure.
import { profileFor, sensorField } from './camera-profiles.js';

/** Sensor-frame point (u, v in 0..1, v downwards) → displayed frame. */
function orientPoint(u, v, orientation) {
  switch (orientation) {
    case 3: return [1 - u, 1 - v]; // rotated 180°
    case 6: return [1 - v, u]; // rotate 90° clockwise to display
    case 8: return [v, 1 - u]; // rotate 270° clockwise to display
    default: return [u, v];
  }
}

/**
 * @param {object} afPoint capture.focus.af_point
 * @param {number|null} orientation EXIF orientation (1, 3, 6, 8)
 * @returns {Array<{left:number, top:number, width:number, height:number, inFocus:boolean, selected:boolean}>}
 */
export function afAreasForDisplay(afPoint, orientation = 1) {
  if (!afPoint?.areas?.length) return [];
  const W = afPoint.af_image_width;
  const H = afPoint.af_image_height;
  const ySign = afPoint.y_axis === 'down' ? 1 : -1;
  const rotated = orientation === 6 || orientation === 8;
  return afPoint.areas.map((a, i) => {
    const cu = 0.5 + a.x / W;
    const cv = 0.5 + (ySign * a.y) / H;
    const [du, dv] = orientPoint(cu, cv, orientation);
    const w = (a.w || 0) / W;
    const h = (a.h || 0) / H;
    const width = rotated ? h : w;
    const height = rotated ? w : h;
    return {
      left: du - width / 2, top: dv - height / 2, width, height,
      inFocus: afPoint.in_focus.includes(i), selected: afPoint.selected.includes(i),
    };
  });
}

/** Short pt-BR description of where the AF areas are, e.g. "à esquerda e acima do centro". */
export function describeAfPosition(afPoint) {
  if (!afPoint?.areas?.length) return null;
  const focus = afPoint.in_focus.length ? afPoint.in_focus.map((i) => afPoint.areas[i]).filter(Boolean) : afPoint.areas;
  const cx = focus.reduce((s, a) => s + a.x, 0) / focus.length / afPoint.af_image_width;
  const cy = focus.reduce((s, a) => s + a.y, 0) / focus.length / afPoint.af_image_height;
  const ySign = afPoint.y_axis === 'down' ? -1 : 1;
  const horiz = cx < -1 / 6 ? 'à esquerda' : cx > 1 / 6 ? 'à direita' : null;
  const vert = ySign * cy > 1 / 6 ? 'acima' : ySign * cy < -1 / 6 ? 'abaixo' : null;
  const n = afPoint.areas.length;
  const count = n === 1 ? '1 área' : `${n} áreas${afPoint.in_focus.length ? `, ${afPoint.in_focus.length} em foco` : ''}`;
  if (!horiz && !vert) return `${count}, no centro`;
  return `${count}, ${[horiz, vert].filter(Boolean).join(' e ')} do centro`;
}

/** Centre of AF areas (normalized 0..1): the areas in focus when reported, otherwise all. */
function centreOf(areas) {
  if (!areas.length) return null;
  const use = areas.some((a) => a.inFocus) ? areas.filter((a) => a.inFocus) : areas;
  const cx = use.reduce((s, a) => s + a.left + a.width / 2, 0) / use.length;
  const cy = use.reduce((s, a) => s + a.top + a.height / 2, 0) / use.length;
  return { cx: clamp01(cx), cy: clamp01(cy) };
}

/**
 * Centre of the AF area(s) on the displayed image, normalized 0..1.
 * @returns {{cx:number, cy:number}|null}
 */
export const afCenterForDisplay = (afPoint, orientation = 1) => centreOf(afAreasForDisplay(afPoint, orientation));

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ------------------------------------------------- versions with other fields

/** Field of view of a version (sensorField of its displayed pixels), or null. */
export function variantField(variant, model = null) {
  const px = variant?.pixels;
  if (!px?.width) return null;
  return sensorField(profileFor(variant.capture?.camera?.model || model), px.width, px.height);
}

/**
 * Normalized region in one version → the same part of the scene in another.
 * Fields are centred on the sensor and share its pixel scale. Without both
 * fields, the region keeps its relative position (e.g. a resized copy).
 */
export function mapRegion(rect, from, to) {
  if (!from || !to) return { ...rect };
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return { x: 0.5 + (rect.x - 0.5) * sx, y: 0.5 + (rect.y - 0.5) * sy, w: rect.w * sx, h: rect.h * sy };
}

export function mapPoint(p, from, to) {
  if (!from || !to) return { ...p };
  return { cx: clamp01(0.5 + (p.cx - 0.5) * (from.width / to.width)), cy: clamp01(0.5 + (p.cy - 0.5) * (from.height / to.height)) };
}

/** Keeps a normalized region inside the image (moving it, not shrinking it). */
export function clampRegion(r) {
  const w = Math.min(1, r.w);
  const h = Math.min(1, r.h);
  return { x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)), w, h };
}

/** Version shown as the preview: overlays and taps are in its frame. */
export function frameVariant(photo) {
  const withPx = photo.variants.filter((v) => v.pixels?.width);
  return withPx.find((v) => v.key === photo.preview?.from_variant) || withPx[0] || null;
}

/**
 * AF areas over the preview. Each version records the AF in its own frame
 * (the CR3 of a 16:9 shot in the whole sensor, the JPEG in the 16:9 part), so
 * the preview's own version is used when it has them, else one is mapped.
 */
export function afAreasOnPreview(photo) {
  const orientation = photo.capture?.image?.orientation || 1;
  const ref = frameVariant(photo);
  const hasAf = (v) => v?.capture?.focus?.af_point?.areas?.length;
  const src = hasAf(ref) ? ref : photo.variants.find(hasAf);
  if (!src) return afAreasForDisplay(photo.capture?.focus?.af_point, orientation);
  const model = photo.capture?.camera?.model;
  const from = variantField(src, model);
  const to = variantField(ref, model);
  return afAreasForDisplay(src.capture.focus.af_point, orientation).map((a) => {
    const r = mapRegion({ x: a.left, y: a.top, w: a.width, h: a.height }, from, to);
    return { ...a, left: r.x, top: r.y, width: r.w, height: r.h };
  });
}

/** Centre of the AF on the preview, normalized, or null. */
export const afCenterOnPreview = (photo) => centreOf(afAreasOnPreview(photo));

/** Inverse of the display rotation: displayed point (u, v) → point in the stored (unrotated) pixels. */
export function displayToSource(u, v, orientation) {
  switch (orientation) {
    case 3: return [1 - u, 1 - v];
    case 6: return [v, 1 - u];
    case 8: return [1 - v, u];
    default: return [u, v];
  }
}

/**
 * Square-ish region of `size` px (in an image of width × height) centred on
 * (cx, cy) normalized, clamped inside the image. Returns normalized x, y, w, h.
 */
export function regionAround(cx, cy, size, width, height) {
  const w = Math.min(1, size / width);
  const h = Math.min(1, size / height);
  const x = Math.min(1 - w, Math.max(0, cx - w / 2));
  const y = Math.min(1 - h, Math.max(0, cy - h / 2));
  return { x, y, w, h };
}
