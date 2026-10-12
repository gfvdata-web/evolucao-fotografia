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
 * Blur estimate of Crété-Roffet et al. (2007, "The blur effect: perception and
 * estimation with a new no-reference perceptual blur metric"): blurs the image
 * again with a 9-tap average along each axis and measures how much of the
 * neighbour variation survives. A sharp image loses a lot (value near 0), an
 * already blurred one loses little (near 1). Much less scene dependent than the
 * Laplacian variance, and computed per axis: a blur that is much stronger along
 * one axis (motion) shows up as a gap between `x` and `y`. A diagonal motion
 * blurs both axes and is not told apart from defocus.
 *
 * `detail` = mean absolute difference between neighbours (levels 0..255): below
 * ~1 the area is flat (sky, wall) and the blur value means nothing.
 * @returns {{blur:number, x:number, y:number, detail:number}|null}
 */
export function blurEffect(lum, width, height) {
  const R = 4; // 9 taps
  if (width < 2 * R + 3 || height < 2 * R + 3) return null;
  // Box blur along x and along y (edges clamped).
  const bx = new Float32Array(lum.length);
  const by = new Float32Array(lum.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += lum[row + Math.min(width - 1, Math.max(0, x + k))];
      bx[row + x] = s / (2 * R + 1);
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += lum[Math.min(height - 1, Math.max(0, y + k)) * width + x];
      by[y * width + x] = s / (2 * R + 1);
    }
  }
  let sFx = 0; let sVx = 0; let sFy = 0; let sVy = 0; let n = 0;
  for (let y = R + 1; y < height - R; y++) {
    const row = y * width;
    for (let x = R + 1; x < width - R; x++) {
      const i = row + x;
      const dFx = Math.abs(lum[i] - lum[i - 1]);
      const dBx = Math.abs(bx[i] - bx[i - 1]);
      const dFy = Math.abs(lum[i] - lum[i - width]);
      const dBy = Math.abs(by[i] - by[i - width]);
      sFx += dFx; sVx += Math.max(0, dFx - dBx);
      sFy += dFy; sVy += Math.max(0, dFy - dBy);
      n++;
    }
  }
  const bX = sFx > 0 ? (sFx - sVx) / sFx : 1;
  const bY = sFy > 0 ? (sFy - sVy) / sFy : 1;
  return { blur: Math.max(bX, bY), x: bX, y: bY, detail: (sFx + sFy) / (2 * n) };
}

/**
 * Luminance histogram and clipping of a (downscaled) RGBA image.
 * `clip_high` = share of pixels with some channel at 250 or more (blown in at
 * least one colour: a bright sky goes first in blue or red); `clip_low` =
 * luminance at 5 or less (black shadows). `p05`/`p50`/`p95` = luminance percentiles.
 * @returns {{bins:number[], mean:number, p05:number, p50:number, p95:number, clip_high:number, clip_low:number}}
 */
export function histogramStats(rgba, width, height, nBins = 64) {
  const counts = new Array(256).fill(0);
  let high = 0; let low = 0; let sum = 0;
  const n = width * height;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = rgba[p]; const g = rgba[p + 1]; const b = rgba[p + 2];
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    counts[y]++;
    sum += y;
    if (r >= 250 || g >= 250 || b >= 250) high++;
    if (y <= 5) low++;
  }
  const pct = (q) => {
    const target = q * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += counts[v]; if (acc >= target) return v; }
    return 255;
  };
  const bins = new Array(nBins).fill(0);
  for (let v = 0; v < 256; v++) bins[Math.floor((v * nBins) / 256)] += counts[v];
  return {
    bins: bins.map((c) => Math.round((c / (n || 1)) * 10000) / 10000),
    mean: n ? sum / n : 0,
    p05: pct(0.05), p50: pct(0.5), p95: pct(0.95),
    clip_high: n ? high / n : 0,
    clip_low: n ? low / n : 0,
  };
}

/**
 * Small fingerprint of a photo for comparing shots of the same scene: mean
 * luminance of an 8×8 grid and the mean colour. Input = downscaled RGBA.
 * @returns {{grid:number[], rgb:number[]}}
 */
export function signature(rgba, width, height, cells = 8) {
  const grid = new Array(cells * cells).fill(0);
  const cnt = new Array(cells * cells).fill(0);
  const rgb = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const cy = Math.min(cells - 1, Math.floor((y * cells) / height));
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const cx = Math.min(cells - 1, Math.floor((x * cells) / width));
      const k = cy * cells + cx;
      grid[k] += 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
      cnt[k]++;
      rgb[0] += rgba[p]; rgb[1] += rgba[p + 1]; rgb[2] += rgba[p + 2];
    }
  }
  const n = width * height || 1;
  return { grid: grid.map((s, k) => Math.round(cnt[k] ? s / cnt[k] : 0)), rgb: rgb.map((s) => Math.round(s / n)) };
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
