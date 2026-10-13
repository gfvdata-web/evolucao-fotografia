// Photo records in the local cache. Every read goes through migrate(), so old
// records are upgraded transparently.
import * as idb from './idb.js';
import { migrate } from '../core/migrations.js';

const upgrade = (r) => (r ? migrate(r) : r);

export async function getPhoto(id) {
  return upgrade(await idb.get('photos', id));
}

export async function findByMatchKey(matchKey) {
  if (!matchKey) return null;
  const [hit] = await idb.getByIndex('photos', 'match_key', matchKey);
  return upgrade(hit) || null;
}

/** All photos, newest capture first (photos without date go last). */
export async function listPhotos() {
  const all = (await idb.getAll('photos')).map(upgrade);
  return all.sort((a, b) => {
    const da = a.capture?.datetime_original || '';
    const db = b.capture?.datetime_original || '';
    if (da !== db) return db.localeCompare(da);
    return (b.added_at || '').localeCompare(a.added_at || '');
  });
}

export const blobKey = {
  original: (photoId, variantKey) => `${photoId}/original/${variantKey}`,
  preview: (photoId) => `${photoId}/preview`,
  /** ~400 px grid thumbnail derived from the preview; local cache only (never synced nor backed up) */
  thumb: (photoId) => `${photoId}/thumb`,
  /** 100% crop (PNG) of one variant; which = 'af' | 'uniform' */
  crop: (photoId, variantKey, which) => `${photoId}/crop/${variantKey}/${which}`,
};

export async function savePhoto(record, { blobs = [], rawMetadata = [], dropBlobs = [] } = {}) {
  await idb.write([
    { store: 'photos', value: record },
    ...blobs.map(({ key, blob }) => ({ store: 'blobs', key, value: blob })),
    ...dropBlobs.map((key) => ({ store: 'blobs', delete: key })),
    ...rawMetadata.map(({ key, json }) => ({ store: 'raw_metadata', key, value: json })),
  ]);
}

export const getBlob = (key) => idb.get('blobs', key);
export const putBlob = (key, blob) => idb.write([{ store: 'blobs', key, value: blob }]);
export const getRawMetadata = (photoId, variantKey) => idb.get('raw_metadata', `${photoId}/${variantKey}`);

export async function deletePhoto(id) {
  await idb.write([{ store: 'photos', delete: id }, { store: 'sync', delete: `photo/${id}` }]);
  await idb.deletePrefix('blobs', `${id}/`);
  await idb.deletePrefix('raw_metadata', `${id}/`);
}
