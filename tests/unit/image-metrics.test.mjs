import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  luminance, laplacianVariance, noiseSigma, mean, findUniformBlock, blurEffect, histogramStats, signature,
} from '../../site/js/core/image-metrics.js';

// Deterministic pseudo-random Gaussian noise (Box–Muller over a small LCG).
function rng(seed = 42) {
  let s = seed >>> 0;
  const u = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 1) / 4294967297; };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}

const flat = (w, h, v = 128) => new Float32Array(w * h).fill(v);
function withNoise(lum, sigma, seed) {
  const g = rng(seed);
  return lum.map((v) => v + sigma * g());
}
function checker(w, h, cell = 4, lo = 60, hi = 190) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = ((x / cell | 0) + (y / cell | 0)) % 2 ? hi : lo;
  return out;
}
function boxBlur(lum, w, h) {
  const out = new Float32Array(lum.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0; let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx; const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += lum[yy * w + xx]; n++; }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

test('luminância usa os pesos do JPEG (Rec. 601)', () => {
  const rgba = Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 100, 100, 100, 255]);
  const y = luminance(rgba, 4, 1);
  assert.ok(Math.abs(y[0] - 76.245) < 0.01);
  assert.ok(Math.abs(y[1] - 149.685) < 0.01);
  assert.ok(Math.abs(y[3] - 100) < 0.01);
  assert.equal(mean(Float32Array.from([1, 2, 3])), 2);
});

test('nitidez: imagem lisa = 0; textura alta; desfocada menor que a original', () => {
  assert.equal(laplacianVariance(flat(64, 64), 64, 64), 0);
  const sharp = checker(64, 64);
  const blurred = boxBlur(sharp, 64, 64);
  const vs = laplacianVariance(sharp, 64, 64);
  const vb = laplacianVariance(blurred, 64, 64);
  assert.ok(vs > 1000);
  assert.ok(vb < vs / 2, `desfocada ${vb} deveria ser bem menor que ${vs}`);
  assert.equal(laplacianVariance(flat(2, 2), 2, 2), null);
});

test('ruído: estimador de Immerkær recupera o desvio conhecido (±10%)', () => {
  for (const sigma of [2, 5, 10]) {
    const est = noiseSigma(withNoise(flat(256, 256), sigma, sigma), 256, 256);
    assert.ok(Math.abs(est - sigma) / sigma < 0.1, `sigma ${sigma}: estimado ${est}`);
  }
  assert.equal(noiseSigma(flat(64, 64), 64, 64), 0);
});

test('ruído: um degradê suave não é confundido com ruído', () => {
  const w = 128; const h = 128;
  const ramp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ramp[y * w + x] = 40 + x + y * 0.5;
  assert.ok(noiseSigma(ramp, w, h) < 0.01);
});

test('área uniforme: encontra a região lisa e ignora a texturizada', () => {
  const w = 200; const h = 120;
  const img = checker(w, h);
  for (let y = 70; y < 115; y++) for (let x = 130; x < 195; x++) img[y * w + x] = 128; // flat patch
  const found = findUniformBlock(img, w, h, 30);
  assert.ok(found.x >= 125 && found.x + found.size <= 200, `x=${found.x}`);
  assert.ok(found.y >= 65 && found.y + found.size <= 120, `y=${found.y}`);
  assert.ok(found.gradient < 1);
});

test('área uniforme: ignora áreas estouradas ou escuras demais', () => {
  const w = 100; const h = 100;
  const img = withNoise(flat(w, h, 128), 3, 7);
  for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) img[y * w + x] = 255; // clipped, perfectly flat
  for (let y = 50; y < 100; y++) for (let x = 50; x < 100; x++) img[y * w + x] = 215; // near-white, flat
  const found = findUniformBlock(img, w, h, 20);
  assert.ok(!(found.x < 45 && found.y < 45), 'escolheu a área estourada');
  assert.ok(!(found.x > 50 && found.y > 50), 'escolheu a área quase branca (a curva do JPEG achata o ruído)');
  assert.equal(findUniformBlock(flat(10, 10), 10, 10, 20), null);
});

// v0.5.0 -----------------------------------------------------------------

/** Horizontal box blur of `len` px (a sideways camera shake). */
function motionX(lum, w, h, len) {
  const out = new Float32Array(lum.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = 0; k < len; k++) s += lum[y * w + Math.min(w - 1, x + k)];
      out[y * w + x] = s / len;
    }
  }
  return out;
}

/** Random 2×2 blocks (a fine natural-like texture; a periodic checker fools the re-blur). */
function texture(w, h, seed = 7) {
  let st = seed;
  const u = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  const bw = Math.ceil(w / 2);
  const blocks = Array.from({ length: bw * Math.ceil(h / 2) }, () => 40 + 170 * u());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = blocks[(y >> 1) * bw + (x >> 1)];
  return out;
}

test('desfoque (Crété-Roffet): nítida perto de 0, borrada mais alta, plana sem detalhe', () => {
  const w = 96; const h = 96;
  const sharp = blurEffect(texture(w, h), w, h);
  let soft = texture(w, h);
  for (let i = 0; i < 3; i++) soft = boxBlur(soft, w, h);
  const blurred = blurEffect(soft, w, h);
  assert.ok(sharp.blur < 0.15, `nítida ${sharp.blur}`);
  assert.ok(blurred.blur > sharp.blur + 0.15, `${blurred.blur} × ${sharp.blur}`);
  assert.ok(sharp.detail > 10);
  assert.ok(blurEffect(flat(w, h), w, h).detail < 0.01);
  assert.equal(blurEffect(flat(8, 8), 8, 8), null);
});

test('desfoque por eixo: arrasto horizontal borra mais o eixo x', () => {
  const w = 96; const h = 96;
  const b = blurEffect(motionX(texture(w, h), w, h, 9), w, h);
  assert.ok(b.x > b.y + 0.2, `x ${b.x} y ${b.y}`);
});

test('histograma: estouro em qualquer canal, sombras pretas e percentis', () => {
  const w = 10; const h = 10;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (i < 20) { rgba[p] = 120; rgba[p + 1] = 160; rgba[p + 2] = 255; } // sky blown in blue only
    else if (i < 30) { rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; }
    else { rgba[p] = 100; rgba[p + 1] = 100; rgba[p + 2] = 100; }
    rgba[p + 3] = 255;
  }
  const s = histogramStats(rgba, w, h);
  assert.equal(s.clip_high, 0.2);
  assert.equal(s.clip_low, 0.1);
  assert.equal(s.p50, 100);
  assert.equal(s.bins.length, 64);
  assert.ok(Math.abs(s.bins.reduce((a, b) => a + b, 0) - 1) < 0.001);
});

test('assinatura 8×8: brilho por região e cor média', () => {
  const w = 16; const h = 16;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4; const v = y < 8 ? 200 : 40;
    rgba[p] = v; rgba[p + 1] = v; rgba[p + 2] = v; rgba[p + 3] = 255;
  }
  const s = signature(rgba, w, h);
  assert.equal(s.grid.length, 64);
  assert.equal(s.grid[0], 200);
  assert.equal(s.grid[63], 40);
  assert.deepEqual(s.rgb, [120, 120, 120]);
});
