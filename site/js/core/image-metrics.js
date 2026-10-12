// Pixel metrics on luminance arrays (pure; used inside the media worker and
// by unit tests). Values are RELATIVE: they compare photos taken with the same
// camera, and are calibrated against the user's ratings over time.

/** RGBA (ImageData.data) → luminance 0..255 (Rec. 601 weights, like JPEG's Y). */
export function luminance(rgba, width, height) {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
  return out;
}

export function mean(lum) {
  let s = 0;
  for (let i = 0; i < lum.length; i++) s += lum[i];
  return lum.length ? s / lum.length : 0;
}

/**
 * Sharpness: variance of the 4-neighbour Laplacian. Higher = more fine detail
 * / edge contrast. Depends on the scene, so compare like with like.
 */
export function laplacianVariance(lum, width, height) {
  if (width < 3 || height < 3) return null;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const v = lum[i - width] + lum[i + width] + lum[i - 1] + lum[i + 1] - 4 * lum[i];
      sum += v; sumSq += v * v; n++;
    }
  }
  const m = sum / n;
  return sumSq / n - m * m;
}

/**
 * Noise: Immerkær's fast noise variance estimation (1996). Returns the
 * standard deviation of the noise in luminance levels (0..255). The 3×3 mask
 * cancels smooth gradients and edges largely, so it works on near-uniform areas.
 */
export function noiseSigma(lum, width, height) {
  if (width < 3 || height < 3) return null;
  let acc = 0;
  for (let y = 1; y < height - 1; y++) {
    const r0 = (y - 1) * width; const r1 = y * width; const r2 = (y + 1) * width;
    for (let x = 1; x < width - 1; x++) {
      const v = lum[r0 + x - 1] - 2 * lum[r0 + x] + lum[r0 + x + 1]
        - 2 * lum[r1 + x - 1] + 4 * lum[r1 + x] - 2 * lum[r1 + x + 1]
        + lum[r2 + x - 1] - 2 * lum[r2 + x] + lum[r2 + x + 1];
      acc += Math.abs(v);
    }
  }
  return Math.sqrt(Math.PI / 2) * acc / (6 * (width - 2) * (height - 2));
}

/**
 * Finds the most uniform square block of `block` px in a (downscaled) image:
 * lowest mean absolute gradient among mid-tone blocks, ignoring a border.
 * Near-white areas are skipped: in the EOS RP samples the JPEG tone curve
 * flattened the noise there about 10× (same photo: 0.03 at brightness 220,
 * 0.25 at 151), so they would hide the noise level of the photo.
 * @returns {{x:number, y:number, size:number, gradient:number, mean:number}|null} in input pixels
 */
export function findUniformBlock(lum, width, height, block, { border = 0.05, minLuma = 30, maxLuma = 200 } = {}) {
  const size = Math.max(4, Math.floor(block));
  if (width < size + 2 || height < size + 2) return null;
  const step = Math.max(2, Math.floor(size / 2));
  const x0 = Math.floor(width * border);
  const y0 = Math.floor(height * border);
  const x1 = width - size - x0;
  const y1 = height - size - y0;
  let best = null;
  for (let by = y0; by <= Math.max(y0, y1); by += step) {
    for (let bx = x0; bx <= Math.max(x0, x1); bx += step) {
      let g = 0; let s = 0; let n = 0;
      for (let y = by; y < by + size - 1 && y < height - 1; y++) {
        const row = y * width;
        for (let x = bx; x < bx + size - 1 && x < width - 1; x++) {
          const i = row + x;
          g += Math.abs(lum[i + 1] - lum[i]) + Math.abs(lum[i + width] - lum[i]);
          s += lum[i]; n++;
        }
      }
      if (!n) continue;
      const m = s / n;
      if (m < minLuma || m > maxLuma) continue;
      const grad = g / n;
      if (!best || grad < best.gradient) best = { x: bx, y: by, size, gradient: grad, mean: m };
    }
  }
  return best;
}
