// Local Drive state (store "sync") and settings (store "meta"). Nothing here
// goes to the Drive as is; it records what was already sent, so the sync
// engine knows what is pending.
//   photo/<id>       { updated_at, session_id, folder_session, assets: {key: {id, sig, size}} }
//   session/<id>     { updated_at, folder_id, subfolders: {name: id}, doc_id, doc_modified }
//   folders          { root_id, index_id, config_id }
//   tombstones       { photos: [{id, at}], sessions: [{id, at}] }
//   trash            [{ photo_id, folder_session, ids: [Drive file ids] }] of deleted photos
//   upload/<photo>/<asset>   resumable session URL of an original being sent
import * as idb from './idb.js';
import { normalizeSettings } from '../core/settings.js';

export const getSync = (key) => idb.get('sync', key);
export const putSync = (key, value) => idb.write([{ store: 'sync', key, value }]);
export const deleteSync = (key) => idb.write([{ store: 'sync', delete: key }]);

/** All sync entries as a Map key → value. */
export async function allSync() {
  const db = await idb.openDb();
  return new Promise((resolve, reject) => {
    const out = new Map();
    const req = db.transaction('sync').objectStore('sync').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) { resolve(out); return; }
      out.set(c.key, c.value);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getTombstones() {
  return (await getSync('tombstones')) || { photos: [], sessions: [] };
}

/** Records that a photo or session was deleted here, so other devices delete it too. */
export async function addTombstone(kind, id, at) {
  const t = await getTombstones();
  const list = kind === 'photo' ? t.photos : t.sessions;
  if (!list.some((x) => x.id === id)) list.push({ id, at });
  await putSync('tombstones', t);
}

/** Records that a deleted photo's Drive files must go to the Drive trash. */
export async function addTrash(entry) {
  if (!entry.ids.length) return;
  const list = (await getSync('trash')) || [];
  list.push(entry);
  await putSync('trash', list);
}

export async function getSettings() {
  return normalizeSettings(await idb.get('meta', 'settings'));
}
export async function getSettingsUpdatedAt() {
  return (await idb.get('meta', 'settings'))?.updated_at || null;
}
/** Settings plus when they changed (the newer of tablet and PC wins). */
export const saveSettings = (settings, updatedAt) => idb.write([{
  store: 'meta', key: 'settings', value: { ...normalizeSettings(settings), updated_at: updatedAt },
}]);
