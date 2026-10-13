// Module worker for pixel work: previews, 100% crops and pixel metrics.
// Everything that touches full-resolution pixels runs here, off the UI thread.
import { embeddedJpegBlob } from '../metadata/cr3.js';
import { displayToSource } from '../core/af-geometry.js';
import {
  luminance, laplacianVariance, noiseSigma, mean, findUniformBlock, blurEffect, histogramStats, signature,
} from '../core/image-metrics.js';
import { jpegSummary } from '../core/jpeg-quality.js';

const PREVIEW_LONG_EDGE = 2048;
const PREVIEW_QUALITY = 0.85;
const THUMB_LONG_EDGE = 400; // grid thumbnail, derived from the preview
const THUMB_QUALITY = 0.8;
const SEARCH_LONG_EDGE = 600; // downscaled copy: uniform-area search, histogram, signature
const TILE_PX = 256; // 100% tiles spread over the photo (sharpness elsewhere than the focus)
const HEADER_BYTES = 256 * 1024;

/**
 * Decodes the image as displayed. A JPEG carries its own EXIF orientation
 * (applied by createImageBitmap); the JPEG embedded in a CR3 has none, so the
 * CR3's orientation is passed in and applied here (`turn`).
 */
async function decode(file, kind, orientation) {
  const source = kind === 'cr3' ? await embeddedJpegBlob(file) : file;
  if (!source) throw new Error('não há JPEG embutido neste CR3');
  const bitmap = await createImageBitmap(source);
  const turn = kind === 'cr3' ? orientation || 1 : 1;
  const sideways = turn === 6 || turn === 8;
  return {
    source, bitmap, turn,
    width: sideways ? bitmap.height : bitmap.width, // displayed size
    height: sideways ? bitmap.width : bitmap.height,
  };
}

/** Draws (part of) the bitmap into a canvas of dw×dh in display orientation. */
function drawOriented(img, dw, dh, src = null) {
  const canvas = new OffscreenCanvas(dw, dh);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  const { turn } = img;
  if (turn === 3) ctx.setTransform(-1, 0, 0, -1, dw, dh);
  else if (turn === 6) ctx.setTransform(0, 1, -1, 0, dw, 0);
  else if (turn === 8) ctx.setTransform(0, -1, 1, 0, 0, dh);
  const sideways = turn === 6 || turn === 8;
  const [w, h] = sideways ? [dh, dw] : [dw, dh];
  if (src) ctx.drawImage(img.bitmap, src.x, src.y, src.w, src.h, 0, 0, w, h);
  else ctx.drawImage(img.bitmap, 0, 0, w, h);
  return { canvas, ctx };
}

/** JPEG thumbnail (long edge ~400 px) of an already oriented canvas or bitmap. */
async function thumbOf(source, sw, sh) {
  const scale = Math.min(1, THUMB_LONG_EDGE / Math.max(sw, sh));
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  const canvas = new OffscreenCanvas(tw, th);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, tw, th);
  return { thumbBlob: await canvas.convertToBlob({ type: 'image/jpeg', quality: THUMB_QUALITY }), thumbWidth: tw, thumbHeight: th };
}

/** Thumbnail from a stored preview (JPEG already in display orientation). */
async function thumbFromPreview(blob) {
  const bitmap = await createImageBitmap(blob);
  try { return await thumbOf(bitmap, bitmap.width, bitmap.height); } finally { bitmap.close(); }
}

async function previewOf(file, kind, orientation) {
  const img = await decode(file, kind, orientation);
  const scale = Math.min(1, PREVIEW_LONG_EDGE / Math.max(img.width, img.height));
  const pw = Math.max(1, Math.round(img.width * scale));
  const ph = Math.max(1, Math.round(img.height * scale));
  const { canvas } = drawOriented(img, pw, ph);
  img.bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: PREVIEW_QUALITY });
  const { thumbBlob } = await thumbOf(canvas, pw, ph);
  return {
    width: img.width, height: img.height, previewBlob: blob, previewWidth: pw, previewHeight: ph, thumbBlob,
    decodedFrom: kind === 'cr3' ? 'cr3-embedded-jpeg' : 'jpeg',
  };
}

/** Normalized display rect → integer rect in the stored (unrotated) bitmap. */
function sourceRect(rect, img) {
  const corners = [[rect.x, rect.y], [rect.x + rect.w, rect.y + rect.h]].map(([u, v]) => displayToSource(u, v, img.turn));
  const us = corners.map((c) => c[0]); const vs = corners.map((c) => c[1]);
  const bw = img.bitmap.width; const bh = img.bitmap.height;
  const x = Math.max(0, Math.round(Math.min(...us) * bw));
  const y = Math.max(0, Math.round(Math.min(...vs) * bh));
  const w = Math.max(1, Math.min(bw - x, Math.round((Math.max(...us) - Math.min(...us)) * bw)));
  const h = Math.max(1, Math.min(bh - y, Math.round((Math.max(...vs) - Math.min(...vs)) * bh)));
  return { x, y, w, h };
}

/** Crops at 100% (no resampling), measures it and encodes it as PNG (lossless). */
async function cropAndMeasure(img, rect) {
  const src = sourceRect(rect, img);
  const sideways = img.turn === 6 || img.turn === 8;
  const [dw, dh] = sideways ? [src.h, src.w] : [src.w, src.h];
  const { canvas, ctx } = drawOriented(img, dw, dh, src);
  const data = ctx.getImageData(0, 0, dw, dh).data;
  const lum = luminance(data, dw, dh);
  return {
    rect,
    px: { w: dw, h: dh },
    laplacian_var: laplacianVariance(lum, dw, dh),
    sigma: noiseSigma(lum, dw, dh),
    mean_luma: mean(lum),
    blur: blurEffect(lum, dw, dh),
    blob: await canvas.convertToBlob({ type: 'image/png' }),
  };
}

/** Downscaled copy of the whole photo (display orientation) as RGBA. */
function smallCopy(img) {
  const scale = Math.min(1, SEARCH_LONG_EDGE / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const { ctx } = drawOriented(img, sw, sh);
  return { scale, sw, sh, rgba: ctx.getImageData(0, 0, sw, sh).data };
}

/**
 * Grid of 100% tiles (4×3 in landscape, 3×4 in portrait), one in the centre of
 * each cell: blur and detail where the focus crop is not, to tell "missed the
 * focus" (sharp elsewhere) from "soft everywhere" (shake, lens, haze).
 */
function measureTiles(img) {
  const landscape = img.width >= img.height;
  const cols = landscape ? 4 : 3;
  const rows = landscape ? 3 : 4;
  const tw = Math.min(TILE_PX, img.width) / img.width;
  const th = Math.min(TILE_PX, img.height) / img.height;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rect = { x: (c + 0.5) / cols - tw / 2, y: (r + 0.5) / rows - th / 2, w: tw, h: th };
      const src = sourceRect(rect, img);
      const sideways = img.turn === 6 || img.turn === 8;
      const [dw, dh] = sideways ? [src.h, src.w] : [src.w, src.h];
      const { ctx } = drawOriented(img, dw, dh, src);
      const lum = luminance(ctx.getImageData(0, 0, dw, dh).data, dw, dh);
      out.push({ rect, col: c, row: r, blur: blurEffect(lum, dw, dh), laplacian_var: laplacianVariance(lum, dw, dh), mean_luma: mean(lum) });
    }
  }
  return out;
}

/** Finds the most uniform area; returns a normalized display rect of ~sizePx at full resolution. */
function autoUniformRect(small, sizePx) {
  const { scale, sw, sh } = small;
  const lum = luminance(small.rgba, sw, sh);
  const found = findUniformBlock(lum, sw, sh, Math.max(4, sizePx * scale));
  if (!found) return null;
  return { x: found.x / sw, y: found.y / sh, w: found.size / sw, h: found.size / sh };
}

/**
 * @param {object} p
 * @param {{x,y,w,h}} p.afRect normalized display rect of the focus crop
 * @param {{x,y,w,h}|null} p.uniformRect fixed rect, or null to search automatically
 * @param {number} p.uniformPx crop size used by the automatic search
 * @param {boolean} p.full also measure the whole photo (histogram, signature, tiles): primary version only
 */
async function analyze({ file, kind, orientation, afRect, uniformRect, uniformPx, full = false }) {
  const img = await decode(file, kind, orientation);
  try {
    const head = new Uint8Array(await img.source.slice(0, HEADER_BYTES).arrayBuffer());
    const jpeg = jpegSummary(head);
    const small = !uniformRect || full ? smallCopy(img) : null;
    const uRect = uniformRect || autoUniformRect(small, uniformPx);
    const af = await cropAndMeasure(img, afRect);
    const uniform = uRect ? await cropAndMeasure(img, uRect) : null;
    const whole = full ? {
      histogram: histogramStats(small.rgba, small.sw, small.sh),
      signature: signature(small.rgba, small.sw, small.sh),
      tiles: measureTiles(img),
    } : null;
    return { width: img.width, height: img.height, jpeg, af, uniform, uniformAuto: !uniformRect, whole };
  } finally {
    img.bitmap.close();
  }
}

let chain = Promise.resolve();
self.onmessage = (event) => {
  const { id, type, ...args } = event.data;
  chain = chain.then(async () => {
    try {
      let data;
      if (type === 'preview') data = await previewOf(args.file, args.kind, args.orientation);
      else if (type === 'thumb') data = await thumbFromPreview(args.file);
      else if (type === 'analyze') data = await analyze(args);
      else throw new Error(`pedido desconhecido: ${type}`);
      self.postMessage({ id, ok: true, data });
    } catch (err) {
      self.postMessage({ id, ok: false, error: String(err?.message || err) });
    }
  });
};
