// Local backup: everything the app keeps on this device in one .efbackup file
// (a ZIP without compression, core/zip.js), and the way back.
//
//   backup.json   settings, sessions, photo records, full ExifTool reads
//   blobs/<key>   previews and 100% crops; originals only when asked
//
// Importing merges like the Drive does: per photo and per session the newer
// updated_at wins, so importing an old backup never undoes newer ratings.
import * as idb from '../storage/idb.js';
import * as repo from '../storage/photos-repo.js';
import * as sessionsRepo from '../storage/sessions-repo.js';
import * as syncRepo from '../storage/sync-repo.js';
import { centralDirectory, crc32, dataOffset, localHeader, parseCentralDirectory, parseEnd, ZIP_MAX_BYTES } from '../core/zip.js';
import { migrate, SESSION_MIGRATIONS } from '../core/migrations.js';
import { newer } from '../core/drive-layout.js';
import { SCHEMA_VERSION } from '../core/model.js';
import { APP_VERSION } from '../version.js';
import { notifyChanged, notifySessionsChanged, withLock, lockKeyOf } from './photo-events.js';

export const BACKUP_FORMAT = 1;
const READ_CHUNK = 8 * 1024 * 1024;

async function crcOf(blob) {
  let crc = 0;
  for (let o = 0; o < blob.size; o += READ_CHUNK) crc = crc32(new Uint8Array(await blob.slice(o, o + READ_CHUNK).arrayBuffer()), crc);
  return crc;
}

async function blobKeys() {
  const db = await idb.openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('blobs').objectStore('blobs').getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Builds the backup file.
 * @param {{includeOriginals?: boolean, onProgress?: (done: number, total: number) => void}} opts
 * @returns {Promise<{blob: Blob, name: string, photos: number}>}
 */
export async function exportBackup({ includeOriginals = false, onProgress = () => {} } = {}) {
  const [photos, sessions, settings, settingsAt] = await Promise.all([
    repo.listPhotos(), sessionsRepo.listSessions(), syncRepo.getSettings(), syncRepo.getSettingsUpdatedAt(),
  ]);
  const raw = {};
  for (const p of photos) {
    for (const v of p.variants) {
      const json = await repo.getRawMetadata(p.id, v.key);
      if (json) raw[`${p.id}/${v.key}`] = json;
    }
  }
  const at = new Date().toISOString();
  const doc = {
    kind: 'efbackup', format_version: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, app_version: APP_VERSION,
    exported_at: at, settings: { ...settings, updated_at: settingsAt }, sessions, photos, raw_metadata: raw,
  };
  const ids = new Set(photos.map((p) => p.id));
  const keys = (await blobKeys()).filter((k) => ids.has(k.split('/')[0]) && (includeOriginals || !k.includes('/original/')));

  const parts = [];
  const entries = [];
  let offset = 0;
  const add = async (name, blob) => {
    const crc = await crcOf(blob);
    const head = localHeader({ name, crc, size: blob.size });
    entries.push({ name, crc, size: blob.size, offset });
    parts.push(head, blob);
    offset += head.length + blob.size;
    if (offset > ZIP_MAX_BYTES) throw new Error('backup maior que 4 GB: desmarque os originais');
  };
  await add('backup.json', new Blob([JSON.stringify(doc)], { type: 'application/json' }));
  for (let i = 0; i < keys.length; i += 1) {
    const blob = await repo.getBlob(keys[i]);
    if (blob) await add(`blobs/${encodeURIComponent(keys[i])}`, blob);
    onProgress(i + 1, keys.length);
  }
  parts.push(...centralDirectory(entries, offset));
  return {
    blob: new Blob(parts, { type: 'application/zip' }),
    name: `evolucao-fotografia-${at.slice(0, 10)}.efbackup`,
    photos: photos.length,
  };
}

/** Reads the ZIP directory of a backup file. */
async function openZip(file) {
  const tailLen = Math.min(file.size, 65_557);
  const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer());
  const end = parseEnd(tail, file.size);
  const cd = new Uint8Array(await file.slice(end.offset, end.offset + end.size).arrayBuffer());
  const entries = parseCentralDirectory(cd, end.count);
  const read = async (e) => {
    const local = new Uint8Array(await file.slice(e.header_offset, e.header_offset + 30).arrayBuffer());
    const start = dataOffset(local, e.header_offset);
    return file.slice(start, start + e.size);
  };
  return { entries: new Map(entries.map((e) => [e.name, e])), read };
}

/**
 * Restores a backup into this device, merging with what is here.
 * @returns {Promise<{photos_new: number, photos_updated: number, photos_kept: number, sessions_new: number, sessions_updated: number}>}
 */
export async function importBackup(file) {
  const zip = await openZip(file);
  const docEntry = zip.entries.get('backup.json');
  if (!docEntry) throw new Error('arquivo sem backup.json: não é um backup deste app');
  const doc = JSON.parse(await (await zip.read(docEntry)).text());
  if (doc.kind !== 'efbackup') throw new Error('não é um backup deste app');
  if (doc.format_version > BACKUP_FORMAT || doc.schema_version > SCHEMA_VERSION) {
    throw new Error('backup feito por uma versão mais nova do app. Atualize a página.');
  }
  const out = { photos_new: 0, photos_updated: 0, photos_kept: 0, sessions_new: 0, sessions_updated: 0 };

  for (const raw of doc.sessions || []) {
    const remote = migrate(raw, SESSION_MIGRATIONS);
    const local = await sessionsRepo.getSession(remote.id);
    if (newer(local, remote) === 'remote') {
      await sessionsRepo.saveSession(remote);
      out[local ? 'sessions_updated' : 'sessions_new'] += 1;
    }
  }

  const blobNames = [...zip.entries.keys()].filter((n) => n.startsWith('blobs/'));
  for (const raw of doc.photos || []) {
    const remote = migrate(raw);
    await withLock(lockKeyOf(remote), async () => {
      const local = await repo.getPhoto(remote.id);
      const decision = newer(local, remote);
      if (decision !== 'remote') { out.photos_kept += 1; return; }
      const blobs = [];
      for (const name of blobNames) {
        const key = decodeURIComponent(name.slice('blobs/'.length));
        if (key.startsWith(`${remote.id}/`)) blobs.push({ key, blob: await zip.read(zip.entries.get(name)) });
      }
      const rawMetadata = remote.variants
        .map((v) => ({ key: `${remote.id}/${v.key}`, json: doc.raw_metadata?.[`${remote.id}/${v.key}`] }))
        .filter((m) => m.json);
      await repo.savePhoto(remote, { blobs, rawMetadata });
      out[local ? 'photos_updated' : 'photos_new'] += 1;
    });
    notifyChanged(remote.id);
  }

  if (doc.settings?.updated_at && String(doc.settings.updated_at) > String((await syncRepo.getSettingsUpdatedAt()) || '')) {
    await syncRepo.saveSettings(doc.settings, doc.settings.updated_at);
  }
  notifySessionsChanged();
  return out;
}
