// Ingestion of photos chosen on the upload screen.
//
// Per file: detect type → quick EXIF (JPEG) → stable id → decode + preview →
// store locally → full ExifTool read in the background (MakerNotes).
// A CR3 waits for ExifTool before being stored, because exifr cannot read it.
import { isCr3Header } from '../metadata/cr3.js';
import { readQuickMetadata, QUICK_ENGINE } from '../metadata/quick.js';
import { readFullMetadata } from '../metadata/exiftool-client.js';
import { fromExifTool, exifToolVersion } from '../metadata/normalize.js';
import { makePreview } from '../media/media-client.js';
import { photoIdentity, provisionalId } from '../core/ids.js';
import { newPhotoRecord, newVariant, refreshRecord, missingFields } from '../core/model.js';
import * as repo from '../storage/photos-repo.js';

/** Fired with detail {id} whenever a stored photo changes. */
export const photoEvents = new EventTarget();
const changed = (id) => photoEvents.dispatchEvent(new CustomEvent('changed', { detail: { id } }));

// Serializes read-modify-write cycles per shot. The lock key is the match key
// (falls back to the id), so the JPEG and the CR3 of the same shot share it even
// when their ids differ.
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

/** 'jpeg' | 'cr3' | null, by content (the extension and MIME type are unreliable on Android). */
export async function detectKind(file) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (isCr3Header(head)) return 'cr3';
  return null;
}

const now = () => new Date().toISOString();

function chooseVariantKey(record, kind, source, file) {
  const base = `${kind}-${source}`;
  const same = record.variants.filter((v) => v.key === base || v.key.startsWith(`${base}-`));
  if (same.some((v) => v.file.size === file.size && v.file.name === file.name)) return null; // duplicate
  return same.length ? `${base}-${same.length + 1}` : base;
}

function applyFull(variant, json) {
  variant.capture = fromExifTool(json);
  variant.missing = missingFields(variant.capture);
  variant.metadata_status = 'complete';
  variant.engines = [...new Set([...variant.engines, exifToolVersion(json)])];
  variant.error = null;
}

async function completeInBackground(lockKey, photoId, variantKey, file) {
  let json = null;
  let error = null;
  try { json = await readFullMetadata(file); } catch (e) { error = e.message; }
  await withLock(lockKey, async () => {
    const record = await repo.getPhoto(photoId);
    const variant = record?.variants.find((v) => v.key === variantKey);
    if (!variant) return;
    if (json) applyFull(variant, json);
    else { variant.metadata_status = 'failed'; variant.error = `leitura completa falhou: ${error}`; }
    refreshRecord(record, now());
    await repo.savePhoto(record, json ? { rawMetadata: [{ key: `${photoId}/${variantKey}`, json }] } : {});
  });
  changed(photoId);
}

/**
 * Ingests one file. Resolves when the photo is stored (the full metadata read
 * may still be running). Status values: stored | duplicate | unsupported | error.
 * @param {File} file
 * @param {(step: string) => void} [onStep] progress messages in pt-BR
 * @returns {Promise<{status: string, photoId?: string, message?: string, background?: Promise}>}
 */
export async function ingestFile(file, onStep = () => {}, source = 'web') {
  const kind = await detectKind(file);
  if (!kind) return { status: 'unsupported', message: 'não é JPEG nem CR3' };

  onStep('lendo dados da foto');
  let capture;
  let fullJson = null;
  let engines = [];
  if (kind === 'jpeg') {
    capture = (await readQuickMetadata(file)).capture;
    engines = [QUICK_ENGINE];
  }
  if (kind === 'cr3' || !capture?.datetime_original) {
    onStep('lendo metadados completos (pode levar alguns segundos)');
    try {
      fullJson = await readFullMetadata(file);
      capture = fromExifTool(fullJson);
      engines = [...engines, exifToolVersion(fullJson)];
    } catch (e) {
      if (kind === 'cr3') return { status: 'error', message: `não foi possível ler o CR3: ${e.message}` };
    }
  }

  const ident = photoIdentity({
    serial: capture.camera.serial, datetime: capture.datetime_original, fileName: file.name,
  });
  const id = ident.id || await provisionalId(file);

  onStep('gerando prévia');
  let pixels;
  try {
    pixels = await makePreview(file, kind, capture.image.orientation);
  } catch (e) {
    return { status: 'error', message: `não foi possível abrir a imagem: ${e.message}` };
  }

  let result;
  const lockKey = ident.matchKey || id;
  await withLock(lockKey, async () => {
    const existing = (await repo.getPhoto(id)) || (await repo.findByMatchKey(ident.matchKey));
    const record = existing || newPhotoRecord({ id, matchKey: ident.matchKey, now: now() });
    const variantKey = chooseVariantKey(record, kind, source, file);
    if (!variantKey) { result = { status: 'duplicate', photoId: record.id }; return; }

    const variant = newVariant({ kind, source, file, key: variantKey });
    variant.pixels = { width: pixels.width, height: pixels.height, decoded_from: pixels.decodedFrom };
    variant.engines = engines;
    if (fullJson) applyFull(variant, fullJson);
    else {
      variant.capture = capture;
      variant.missing = missingFields(capture);
      variant.metadata_status = 'quick';
    }
    record.variants.push(variant);

    const blobs = [{ key: repo.blobKey.original(record.id, variantKey), blob: file }];
    if (!record.preview) {
      record.preview = { width: pixels.previewWidth, height: pixels.previewHeight, from_variant: variantKey };
      blobs.push({ key: repo.blobKey.preview(record.id), blob: pixels.previewBlob });
    }
    refreshRecord(record, now());
    await repo.savePhoto(record, {
      blobs,
      rawMetadata: fullJson ? [{ key: `${record.id}/${variantKey}`, json: fullJson }] : [],
    });
    result = { status: 'stored', photoId: record.id, variantKey, needsFull: !fullJson };
  });

  if (result.status === 'stored') {
    changed(result.photoId);
    if (result.needsFull) result.background = completeInBackground(lockKey, result.photoId, result.variantKey, file);
  }
  return result;
}
