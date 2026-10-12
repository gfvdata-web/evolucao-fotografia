// Camera profiles (pure data). Image sizes from Canon's official EOS RP
// specification (canon-europe.com/cameras/eos-rp/specifications). Widths and
// heights are landscape; portrait photos are compared with sides swapped.

export const PROFILES = {
  'Canon EOS RP': {
    native: { width: 6240, height: 4160 },
    crop_factor_crop_mode: 1.6,
    sizes: [
      { label: 'L 3:2', width: 6240, height: 4160, full: true, aspect: '3:2' },
      { label: 'M1 3:2', width: 4160, height: 2768, aspect: '3:2' },
      { label: 'S1 3:2', width: 3120, height: 2080, aspect: '3:2' },
      { label: 'S2 3:2 (ou S2 do recorte 1,6x)', width: 2400, height: 1600, aspect: '3:2' },
      { label: 'L recorte 1,6x', width: 3888, height: 2592, crop_mode: true, aspect: '3:2' },
      { label: 'L 4:3', width: 5536, height: 4160, full: true, aspect: '4:3' },
      { label: 'M1 4:3', width: 3680, height: 2768, aspect: '4:3' },
      { label: 'S1 4:3', width: 2768, height: 2080, aspect: '4:3' },
      { label: 'S2 4:3', width: 2112, height: 1600, aspect: '4:3' },
      { label: 'L 16:9', width: 6240, height: 3504, full: true, aspect: '16:9' },
      { label: 'M1 16:9', width: 4160, height: 2336, aspect: '16:9' },
      { label: 'S1 16:9', width: 3120, height: 1752, aspect: '16:9' },
      { label: 'S2 16:9', width: 2400, height: 1344, aspect: '16:9' },
      { label: 'L 1:1', width: 4160, height: 4160, full: true, aspect: '1:1' },
      { label: 'M1 1:1', width: 2768, height: 2768, aspect: '1:1' },
      { label: 'S1 1:1', width: 2080, height: 2080, aspect: '1:1' },
      { label: 'S2 1:1', width: 1600, height: 1600, aspect: '1:1' },
    ],
  },
};

export const profileFor = (model) => (model ? PROFILES[String(model).trim()] || null : null);

const landscape = (w, h) => (w >= h ? [w, h] : [h, w]);

/** Sizes of the profile matching w×h (±2 px), in either orientation. */
export function matchSizes(profile, width, height) {
  if (!profile || !width || !height) return [];
  const [w, h] = landscape(width, height);
  return profile.sizes.filter((s) => Math.abs(s.width - w) <= 2 && Math.abs(s.height - h) <= 2);
}

/**
 * Field of view of an image of width × height, in sensor pixels and in the
 * same orientation as the image: the L size of its proportion (an M or S JPEG
 * shows the same scene as the L), or the 1.6x crop area. The JPEG inside a CR3
 * covers the whole sensor even when the camera JPEG is 16:9, so versions of
 * one shot may show different parts of the scene. Null when unknown.
 */
export function sensorField(profile, width, height) {
  const m = matchSizes(profile, width, height)[0];
  if (!m) return null;
  const f = m.crop_mode ? m : profile.sizes.find((s) => s.full && s.aspect === m.aspect);
  if (!f) return null;
  return width >= height ? { width: f.width, height: f.height } : { width: f.height, height: f.width };
}
