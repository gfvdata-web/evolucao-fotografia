// Physics of the exposure (pure): light in EV, the camera's 1/3-stop scales,
// the ISO a combination needs, depth of field and diffraction.
// EV here is always "EV at ISO 100": log2(N² / t) − log2(ISO / 100).

/** Shutter times of the EOS RP in 1/3 stops (seconds), fastest first. */
export const SHUTTER_SCALE = [
  1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600, 1 / 1250, 1 / 1000,
  1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250, 1 / 200, 1 / 160, 1 / 125, 1 / 100, 1 / 80,
  1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 13, 1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4,
  0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30,
];

/** f-numbers in 1/3 stops. */
export const APERTURE_SCALE = [
  1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16,
  18, 20, 22, 25, 29, 32, 36, 40,
];

/** ISO speeds in 1/3 stops (EOS RP: 100 to 40000 without expansion). */
export const ISO_SCALE = [
  100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000,
  6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000,
];

export const ev100 = (aperture, shutter, iso) => Math.log2((aperture * aperture) / shutter) - Math.log2(iso / 100);

/** ISO that exposes a scene of `ev` correctly at aperture/shutter (not rounded). */
export const isoFor = (ev, aperture, shutter) => 100 * 2 ** (Math.log2((aperture * aperture) / shutter) - ev);

/** Shutter time that exposes a scene of `ev` correctly at aperture/iso (not rounded). */
export const shutterFor = (ev, aperture, iso) => (aperture * aperture) / 2 ** (ev + Math.log2(iso / 100));

const TOL = 1.04; // values that differ by less than ~1/20 stop count as equal

/** Slowest standard time that is at least as fast as `t` (e.g. 1/290 → 1/320). */
export function shutterAtMost(t) {
  const fits = SHUTTER_SCALE.filter((s) => s <= t * TOL);
  return fits.length ? fits[fits.length - 1] : SHUTTER_SCALE[0];
}

/** Fastest standard time that is at most as fast as `t` (e.g. 1/290 → 1/250). */
export function shutterAtLeast(t) {
  return SHUTTER_SCALE.find((s) => s * TOL >= t) ?? SHUTTER_SCALE[SHUTTER_SCALE.length - 1];
}

/** Smallest standard ISO at or above `iso` (never underexposes); clamped to the scale. */
export function isoAtLeast(iso) {
  return ISO_SCALE.find((s) => s * TOL >= iso) ?? ISO_SCALE[ISO_SCALE.length - 1];
}

/** Nearest standard f-number at or above `n` (never wider than asked). */
export function apertureAtLeast(n) {
  return APERTURE_SCALE.find((s) => s * TOL >= n) ?? APERTURE_SCALE[APERTURE_SCALE.length - 1];
}

/** Difference in stops between two values of the same kind (log2 b/a for times and ISO). */
export const stops = (a, b) => Math.log2(b / a);
export const apertureStops = (a, b) => 2 * Math.log2(b / a);

/**
 * Depth of field (thin lens, circle of confusion `coc` mm; 0.03 = full frame).
 * @returns {{near_m:number, far_m:number|null, total_m:number|null, hyperfocal_m:number}}
 */
export function depthOfField(focalMm, aperture, distanceM, coc = 0.03) {
  const f = focalMm;
  const s = distanceM * 1000;
  const H = (f * f) / (aperture * coc) + f;
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s < H ? (s * (H - f)) / (H - s) : null;
  return {
    near_m: near / 1000,
    far_m: far === null ? null : far / 1000,
    total_m: far === null ? null : (far - near) / 1000,
    hyperfocal_m: H / 1000,
  };
}

/** Airy disk diameter (µm) at f-number `n` for green light (550 nm). */
export const airyDiskUm = (n) => 2.44 * 0.55 * n;
