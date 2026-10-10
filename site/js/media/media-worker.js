// Module worker for pixel work. v0.1: decode the photo and build a preview.
// (v0.2 adds 100% crops and the sharpness / noise metrics here.)
import { embeddedJpegBlob } from '../metadata/cr3.js';

export const PREVIEW_LONG_EDGE = 2048;
const PREVIEW_QUALITY = 0.85;

/**
 * Builds the preview in display orientation. A JPEG carries its own EXIF
 * orientation (applied by createImageBitmap); the JPEG embedded in a CR3 has
 * none, so the CR3's orientation is passed in and applied here.
 */
async function previewOf(file, kind, orientation) {
  const source = kind === 'cr3' ? await embeddedJpegBlob(file) : file;
  if (!source) throw new Error('não há JPEG embutido neste CR3');
  const bitmap = await createImageBitmap(source);
  const turn = kind === 'cr3' ? orientation || 1 : 1;
  const sideways = turn === 6 || turn === 8;
  const width = sideways ? bitmap.height : bitmap.width;
  const height = sideways ? bitmap.width : bitmap.height;
  const scale = Math.min(1, PREVIEW_LONG_EDGE / Math.max(width, height));
  const pw = Math.max(1, Math.round(width * scale));
  const ph = Math.max(1, Math.round(height * scale));
  const canvas = new OffscreenCanvas(pw, ph);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (turn === 3) ctx.setTransform(-1, 0, 0, -1, pw, ph);
  else if (turn === 6) ctx.setTransform(0, 1, -1, 0, pw, 0);
  else if (turn === 8) ctx.setTransform(0, -1, 1, 0, 0, ph);
  const [dw, dh] = sideways ? [ph, pw] : [pw, ph];
  ctx.drawImage(bitmap, 0, 0, dw, dh);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: PREVIEW_QUALITY });
  return {
    width, height, previewBlob: blob, previewWidth: pw, previewHeight: ph,
    decodedFrom: kind === 'cr3' ? 'cr3-embedded-jpeg' : 'jpeg',
  };
}

let chain = Promise.resolve();
self.onmessage = (event) => {
  const { id, type, file, kind, orientation } = event.data;
  chain = chain.then(async () => {
    try {
      if (type !== 'preview') throw new Error(`pedido desconhecido: ${type}`);
      self.postMessage({ id, ok: true, data: await previewOf(file, kind, orientation) });
    } catch (err) {
      self.postMessage({ id, ok: false, error: String(err?.message || err) });
    }
  });
};
