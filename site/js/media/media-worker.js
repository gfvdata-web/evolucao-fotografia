// Module worker for pixel work: previews, 100% crops and pixel metrics.
// Everything that touches full-resolution pixels runs here, off the UI thread.
import { embeddedJpegBlob } from '../metadata/cr3.js';
import { displayToSource } from '../core/af-geometry.js';
import { luminance, laplacianVariance, noiseSigma, mean, findUniformBlock } from '../core/image-metrics.js';
import { jpegSummary } from '../core/jpeg-quality.js';

const PREVIEW_LONG_EDGE = 2048;
const PREVIEW_QUALITY = 0.85;
const SEARCH_LONG_EDGE = 600; // downscaled copy used to find the uniform area
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

async function previewOf(file, kind, orientation) {
  const img = await decode(file, kind, orientation);
  const scale = Math.min(1, PREVIEW_LONG_EDGE / Math.max(img.width, img.height));
  const pw = Math.max(1, Math.round(img.width * scale));
  const ph = Math.max(1, Math.round(img.height * scale));
  const { canvas } = drawOriented(img, pw, ph);
  img.bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: PREVIEW_QUALITY });
  return {
    width: img.width, height: img.height, previewBlob: blob, previewWidth: pw, previewHeight: ph,
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
    blob: await canvas.convertToBlob({ type: 'image/png' }),
  };
}

/** Finds the most uniform area; returns a normalized display rect of ~sizePx at full resolution. */
function autoUniformRect(img, sizePx) {
  const scale = Math.min(1, SEARCH_LONG_EDGE / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const { ctx } = drawOriented(img, sw, sh);
  const lum = luminance(ctx.getImageData(0, 0, sw, sh).data, sw, sh);
  const found = findUniformBlock(lum, sw, sh, Math.max(4, sizePx * scale));
  if (!found) return null;
  return { x: found.x / sw, y: found.y / sh, w: found.size / sw, h: found.size / sh };
}

/**
 * @param {object} p
 * @param {{x,y,w,h}} p.afRect normalized display rect of the focus crop
 * @param {{x,y,w,h}|null} p.uniformRect fixed rect, or null to search automatically
 * @param {number} p.uniformPx crop size used by the automatic search
 */
async function analyze({ file, kind, orientation, afRect, uniformRect, uniformPx }) {
  const img = await decode(file, kind, orientation);
  try {
    const head = new Uint8Array(await img.source.slice(0, HEADER_BYTES).arrayBuffer());
    const jpeg = jpegSummary(head);
    const uRect = uniformRect || autoUniformRect(img, uniformPx);
    const af = await cropAndMeasure(img, afRect);
    const uniform = uRect ? await cropAndMeasure(img, uRect) : null;
    return { width: img.width, height: img.height, jpeg, af, uniform, uniformAuto: !uniformRect };
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
      else if (type === 'analyze') data = await analyze(args);
      else throw new Error(`pedido desconhecido: ${type}`);
      self.postMessage({ id, ok: true, data });
    } catch (err) {
      self.postMessage({ id, ok: false, error: String(err?.message || err) });
    }
  });
};
