// Drive synchronisation (decision 0010). One run = pull, then push:
//
//   pull  indice.json (deleted sessions), config.json (settings) and every
//         sessao.json changed since the last run; per photo and per session
//         the newer updated_at wins. Photos that exist only on the Drive come
//         with their preview and crops.
//   push  for each session (and "_sem_sessao") with pending work: moves files
//         of photos that changed session, sends missing or outdated files
//         (originals per the settings, without GPS unless kept), copies the
//         previous sessao.json to _historico/ and writes the new one; then
//         trashes deleted photos and sessions and writes indice/config.json.
//
// Runs only while the app is open and connected (decision 0006). Changes
// made meanwhile stay pending locally; a 401 pauses the run until the user
// reconnects, an exceeded space limit holds back only the originals.
import { createDriveClient, AuthError, NoSessionError, QuotaError, propsQuery } from '../drive/api.js';
import { auth, authEvents, getToken, tokenRejected, tokenValid } from '../drive/auth.js';
import * as repo from '../storage/photos-repo.js';
import * as sessionsRepo from '../storage/sessions-repo.js';
import * as syncRepo from '../storage/sync-repo.js';
import { migrate, SESSION_MIGRATIONS } from '../core/migrations.js';
import {
  ROOT_NAME, NO_SESSION, SUBFOLDERS, buildIndexDoc, buildSessionDoc, desiredAssets, historyName,
  historyToPrune, mergeTombstones, newer, photoWork, readSessionDoc, sessionFolderName, spaceStatus, NewerDataError,
} from '../core/drive-layout.js';
import { stripGps, stripGpsTags } from '../core/gps-strip.js';
import { normalizeSettings } from '../core/settings.js';
import { APP_VERSION } from '../version.js';
import { announceUpdate } from './app-update.js';
import { photoEvents, notifyChanged, notifySessionsChanged, withLock, lockKeyOf } from './photo-events.js';

const JSON_MIME = 'application/json';
const SMALL_LIMIT = 5 * 1024 * 1024; // above this, resumable upload

export const syncEvents = new EventTarget();
export const syncStatus = {
  /** 'idle' | 'running' | 'paused' */
  state: 'idle',
  /** why paused: 'auth' | 'offline' | 'error' | null */
  reason: null,
  error: null,
  pending: 0,
  held_originals: 0, // originals waiting for space under the limit
  progress: null, // { done, total, current, sent, size }
  last_sync_at: null,
  usage: null, // { used, limit, ratio, status }
};
const emit = () => syncEvents.dispatchEvent(new Event('change'));
const set = (patch) => { Object.assign(syncStatus, patch); emit(); };

let drive = createDriveClient({ getToken });
/** Tests only: another fetch implementation. */
export function useDriveFetch(fetchImpl) { drive = createDriveClient({ fetchImpl, getToken }); }

const now = () => new Date().toISOString();
const groupKey = (photo) => photo.session_id || NO_SESSION;
const blobFromJson = (obj) => new Blob([JSON.stringify(obj, null, 1)], { type: JSON_MIME });

// ---------------------------------------------------------------- pending

/** Photos, sessions and deletions not yet on the Drive. */
export async function computePending() {
  const [photos, sessions, sync, settings] = await Promise.all([
    repo.listPhotos(), sessionsRepo.listSessions(), syncRepo.allSync(), syncRepo.getSettings(),
  ]);
  let n = 0;
  for (const p of photos) {
    const w = photoWork(p, sync.get(`photo/${p.id}`), settings);
    if (w.record || w.move || w.upload.length) n += 1;
  }
  for (const s of sessions) if (sync.get(`session/${s.id}`)?.updated_at !== s.updated_at) n += 1;
  n += (sync.get('trash') || []).length;
  const tomb = sync.get('tombstones');
  n += (tomb?.sessions || []).filter((t) => sync.get(`session/${t.id}`)?.folder_id).length;
  return n;
}

export async function refreshPending() {
  set({ pending: await computePending() });
  return syncStatus.pending;
}

// ---------------------------------------------------------------- folders

async function ensureRoot() {
  const f = (await syncRepo.getSync('folders')) || {};
  if (!f.root_id) {
    const [found] = await drive.list(propsQuery({ ef_kind: 'root' }));
    f.root_id = (found || await drive.createFolder(ROOT_NAME, null, { ef_kind: 'root' })).id;
    await syncRepo.putSync('folders', f);
  }
  return f;
}

/** Folder (and subfolders) of a session key; renames the folder when the session was renamed. */
async function ensureSessionFolder(folders, key, session) {
  const st = (await syncRepo.getSync(`session/${key}`)) || {};
  const name = sessionFolderName(session);
  if (!st.folder_id) {
    const [found] = await drive.list(propsQuery({ ef_kind: 'session', ef_session: key }));
    st.folder_id = (found || await drive.createFolder(name, folders.root_id, { ef_kind: 'session', ef_session: key })).id;
    st.folder_name = found ? found.name : name;
  }
  if (st.folder_name !== name) {
    await drive.update(st.folder_id, { name });
    st.folder_name = name;
  }
  st.subfolders ||= {};
  if (SUBFOLDERS.some((s) => !st.subfolders[s])) {
    const existing = await drive.list(propsQuery({ ef_kind: 'sub', ef_session: key }));
    for (const sub of SUBFOLDERS) {
      if (st.subfolders[sub]) continue;
      const hit = existing.find((e) => e.appProperties?.ef_sub === sub);
      st.subfolders[sub] = (hit || await drive.createFolder(sub, st.folder_id, { ef_kind: 'sub', ef_session: key, ef_sub: sub })).id;
    }
  }
  await syncRepo.putSync(`session/${key}`, st);
  return st;
}

// ---------------------------------------------------------------- pull

async function saveRemoteBlobs(record, assets) {
  const blobs = [];
  const get = async (assetKey, blobKey) => {
    const a = assets[assetKey];
    if (!a?.id || await repo.getBlob(blobKey)) return;
    try { blobs.push({ key: blobKey, blob: await drive.download(a.id) }); } catch (e) { if (e instanceof AuthError) throw e; }
  };
  await get('preview', repo.blobKey.preview(record.id));
  for (const v of record.variants) {
    for (const which of ['af', 'uniform']) await get(`crop/${v.key}/${which}`, repo.blobKey.crop(record.id, v.key, which));
  }
  return blobs;
}

async function mergeSessionDoc(key, parsed, tombstones) {
  let changed = false;
  if (parsed.session && !tombstones.sessions.some((t) => t.id === parsed.session.id)) {
    const remote = migrate(parsed.session, SESSION_MIGRATIONS);
    const local = await sessionsRepo.getSession(remote.id);
    if (newer(local, remote) === 'remote') {
      await sessionsRepo.saveSession(remote);
      const st = (await syncRepo.getSync(`session/${remote.id}`)) || {};
      await syncRepo.putSync(`session/${remote.id}`, { ...st, updated_at: remote.updated_at });
      changed = true;
    }
  }
  tombstones.photos = mergeTombstones(tombstones.photos, parsed.deleted);
  for (const t of parsed.deleted) {
    const local = await repo.getPhoto(t.id);
    if (local && String(local.updated_at) <= String(t.at)) { await repo.deletePhoto(t.id); notifyChanged(t.id); }
  }
  for (const { record: raw, assets } of parsed.photos) {
    if (tombstones.photos.some((t) => t.id === raw.id)) continue;
    const remote = migrate(raw);
    const local = await repo.getPhoto(remote.id);
    const decision = newer(local, remote);
    const lockKey = lockKeyOf(local || remote);
    const blobs = decision === 'remote' ? await saveRemoteBlobs(remote, assets) : [];
    await withLock(lockKey, async () => {
      const state = (await syncRepo.getSync(`photo/${remote.id}`)) || { assets: {} };
      const merged = { ...assets, ...state.assets }; // keep ids this device already knows
      if (decision === 'remote') {
        // Keep this device's GPS when the Drive copy had it removed.
        const fresh = await repo.getPhoto(remote.id);
        if (fresh?.capture?.gps && !remote.capture?.gps) remote.capture = { ...remote.capture, gps: fresh.capture.gps };
        await repo.savePhoto(remote, { blobs });
        await syncRepo.putSync(`photo/${remote.id}`, {
          updated_at: remote.updated_at, session_id: remote.session_id, folder_session: key, assets: merged,
        });
      } else {
        await syncRepo.putSync(`photo/${remote.id}`, { ...state, folder_session: state.folder_session || key, assets: merged });
      }
    });
    if (decision === 'remote') { notifyChanged(remote.id); changed = true; }
  }
  return changed;
}

async function pull(folders, tombstones) {
  let changed = false;
  // indice.json: sessions deleted on another device.
  const [indexFile] = await drive.list(propsQuery({ ef_kind: 'indice' }));
  if (indexFile) {
    folders.index_id = indexFile.id;
    if (indexFile.modifiedTime !== folders.index_modified) {
      const doc = await drive.downloadJson(indexFile.id);
      tombstones.sessions = mergeTombstones(tombstones.sessions, doc.deleted_sessions);
      for (const t of doc.deleted_sessions || []) {
        const local = await sessionsRepo.getSession(t.id);
        if (local && String(local.updated_at) <= String(t.at)) {
          for (const p of (await repo.listPhotos()).filter((x) => x.session_id === t.id)) {
            await withLock(lockKeyOf(p), async () => {
              const fresh = await repo.getPhoto(p.id);
              fresh.session_id = null;
              fresh.scene_id = null;
              fresh.updated_at = now();
              await repo.savePhoto(fresh);
            });
          }
          await sessionsRepo.deleteSessionRecord(t.id);
          changed = true;
        }
      }
      folders.index_modified = indexFile.modifiedTime;
    }
  }
  // config.json: settings changed on another device.
  const [configFile] = await drive.list(propsQuery({ ef_kind: 'config' }));
  if (configFile) {
    folders.config_id = configFile.id;
    if (configFile.modifiedTime !== folders.config_modified) {
      const doc = await drive.downloadJson(configFile.id);
      const localAt = await syncRepo.getSettingsUpdatedAt();
      if (doc.updated_at && String(doc.updated_at) > String(localAt || '')) {
        await syncRepo.saveSettings(normalizeSettings(doc.settings), doc.updated_at);
      }
      folders.config_modified = configFile.modifiedTime;
    }
  }
  // sessao.json of every session (changed since the last run).
  for (const file of await drive.list(propsQuery({ ef_kind: 'sessao' }))) {
    const key = file.appProperties?.ef_session;
    if (!key) continue;
    const st = (await syncRepo.getSync(`session/${key}`)) || {};
    if (st.doc_modified === file.modifiedTime && st.doc_id === file.id) continue;
    const parsed = readSessionDoc(await drive.downloadJson(file.id));
    if (await mergeSessionDoc(key, parsed, tombstones)) changed = true;
    const after = (await syncRepo.getSync(`session/${key}`)) || {};
    await syncRepo.putSync(`session/${key}`, { ...after, doc_id: file.id, doc_modified: file.modifiedTime });
  }
  await syncRepo.putSync('folders', folders);
  await syncRepo.putSync('tombstones', tombstones);
  if (changed) notifySessionsChanged();
}

// ---------------------------------------------------------------- push

async function assetContent(record, asset, settings) {
  const s = asset.source;
  if (s.kind === 'preview') return repo.getBlob(repo.blobKey.preview(record.id));
  if (s.kind === 'crop') return repo.getBlob(repo.blobKey.crop(record.id, s.variant, s.which));
  if (s.kind === 'metadata') {
    const json = await repo.getRawMetadata(record.id, s.variant);
    if (!json) return null;
    return blobFromJson(settings.keep_gps ? json : stripGpsTags(json));
  }
  const file = await repo.getBlob(repo.blobKey.original(record.id, s.variant));
  if (!file || settings.keep_gps) return file;
  const { bytes } = stripGps(await file.arrayBuffer());
  return new Blob([bytes], { type: asset.mime });
}

async function sendAsset(record, asset, content, key, sub, existingId, onProgress) {
  const f = {
    id: existingId, name: asset.name, parentId: sub, mimeType: asset.mime, content,
    appProperties: { ef_kind: 'asset', ef_session: key, ef_photo: record.id, ef_asset: asset.key },
  };
  if (content.size <= SMALL_LIMIT) return drive.uploadSmall(f);
  const uploadKey = `upload/${record.id}/${asset.key}`;
  const saved = await syncRepo.getSync(uploadKey);
  try {
    const file = await drive.uploadLarge(f, {
      sessionUrl: saved?.url || null,
      onSession: (url) => syncRepo.putSync(uploadKey, { url, at: now() }),
      onProgress,
    });
    await syncRepo.deleteSync(uploadKey);
    return file;
  } catch (e) {
    // Resumable address unreadable in this browser: one request, without resuming.
    if (e instanceof NoSessionError) return drive.uploadSmall(f);
    throw e;
  }
}

async function writeSessionDoc(key, session, folder, settings, tombstones) {
  const st = (await syncRepo.getSync(`session/${key}`)) || folder;
  const photos = (await repo.listPhotos()).filter((p) => groupKey(p) === key);
  const all = await syncRepo.allSync();
  const states = new Map(photos.map((p) => [p.id, all.get(`photo/${p.id}`)]));
  const at = now();
  if (st.doc_id && settings.history_versions > 0) {
    await drive.copy(st.doc_id, historyName(at), folder.subfolders._historico, { ef_kind: 'historico', ef_session: key });
    const copies = await drive.list(`'${folder.subfolders._historico}' in parents and trashed = false`, 'id,name');
    for (const old of historyToPrune(copies, settings.history_versions)) await drive.update(old.id, { trashed: true });
  }
  const doc = buildSessionDoc({ session, photos, states, deleted: tombstones.photos, settings, appVersion: APP_VERSION, now: at });
  const content = blobFromJson(doc);
  const file = st.doc_id
    ? await drive.uploadSmall({ id: st.doc_id, name: 'sessao.json', mimeType: JSON_MIME, content })
    : await drive.uploadSmall({
      name: 'sessao.json', parentId: folder.folder_id, mimeType: JSON_MIME, content,
      appProperties: { ef_kind: 'sessao', ef_session: key },
    });
  await syncRepo.putSync(`session/${key}`, {
    ...folder, ...((await syncRepo.getSync(`session/${key}`)) || {}),
    updated_at: session?.updated_at ?? null, doc_id: file.id, doc_modified: file.modifiedTime,
  });
}

async function updateUsage(settings) {
  const files = await drive.list('trashed = false', 'id,size');
  const used = files.reduce((s, f) => s + Number(f.size || 0), 0);
  const account = await drive.quota().catch((e) => { if (e instanceof AuthError) throw e; return null; });
  set({ usage: { ...spaceStatus(used, settings.drive_limit_gb), account } });
  return used;
}

/** Bytes still free in the Google account (Infinity when unlimited or unknown). */
const accountFree = () => {
  const a = syncStatus.usage?.account;
  return a?.limit ? a.limit - a.usage : Infinity;
};

async function push(folders, settings, tombstones) {
  const [photos, sessions, sync] = await Promise.all([repo.listPhotos(), sessionsRepo.listSessions(), syncRepo.allSync()]);
  const sessionsById = new Map(sessions.map((s) => [s.id, s]));
  const keyOf = (p) => (p.session_id && sessionsById.has(p.session_id) ? p.session_id : NO_SESSION);

  const work = new Map(); // photo id → work
  const groups = new Set();
  for (const p of photos) {
    const st = sync.get(`photo/${p.id}`);
    const w = photoWork({ ...p, session_id: keyOf(p) === NO_SESSION ? null : p.session_id }, st, settings);
    if (w.record || w.move || w.upload.length) {
      work.set(p.id, w);
      groups.add(keyOf(p));
      if (st?.folder_session) groups.add(st.folder_session); // the old folder's sessao.json must drop it
    }
  }
  for (const s of sessions) if (sync.get(`session/${s.id}`)?.updated_at !== s.updated_at) groups.add(s.id);
  const trash = sync.get('trash') || [];
  for (const t of trash) if (t.folder_session) groups.add(t.folder_session); // deleted photo: rewrite its sessao.json
  for (const k of [...groups]) if (k !== NO_SESSION && !sessionsById.has(k)) groups.delete(k); // deleted: trashed below

  let used = await updateUsage(settings);
  const limit = settings.drive_limit_gb * 1024 ** 3;
  const total = [...work.values()].reduce((n, w) => n + w.upload.length, 0);
  let done = 0;
  let held = 0;
  let spent = 0; // bytes sent in this run (the account's free space is read once per run)
  set({ progress: total ? { done, total, current: null, sent: 0, size: 0 } : null });

  // Groups whose photos have files to send first, so a photo's folder exists before it is moved there.
  for (const key of groups) {
    const session = key === NO_SESSION ? null : sessionsById.get(key);
    const folder = await ensureSessionFolder(folders, key, session);
    for (const p of photos.filter((x) => keyOf(x) === key && work.has(x.id))) {
      const w = work.get(p.id);
      await withLock(lockKeyOf(p), async () => {
        const record = await repo.getPhoto(p.id);
        if (!record) return;
        const state = (await syncRepo.getSync(`photo/${p.id}`)) || { assets: {} };
        state.assets ||= {};
        if (w.move) {
          const old = (await syncRepo.getSync(`session/${state.folder_session}`))?.subfolders || {};
          for (const a of desiredAssets(record, settings)) {
            const have = state.assets[a.key];
            if (!have?.id || !old[a.folder]) continue;
            await drive.update(have.id, {
              addParents: folder.subfolders[a.folder], removeParents: old[a.folder],
              appProperties: { ef_kind: 'asset', ef_session: key, ef_photo: record.id, ef_asset: a.key },
            });
          }
        }
        state.folder_session = key;
        await syncRepo.putSync(`photo/${p.id}`, state);
      });
      for (const asset of w.upload) {
        set({ progress: { done, total, current: asset.name, sent: 0, size: asset.size || 0 } });
        // Originals wait when they would pass the app's limit or the account's free space.
        if (asset.original && (used + (asset.size || 0) > limit || (asset.size || 0) > accountFree() - spent)) {
          held += 1; done += 1; continue;
        }
        const record = await repo.getPhoto(p.id);
        const content = record && await assetContent(record, asset, settings);
        if (!content) {
          // Not on this device (photo that came from another one): remember it, so it is not pending forever.
          await withLock(lockKeyOf(p), async () => {
            const st = (await syncRepo.getSync(`photo/${p.id}`)) || { assets: {} };
            st.assets = { ...(st.assets || {}), [asset.key]: { ...(st.assets?.[asset.key] || { id: null, size: 0 }), sig: asset.sig } };
            await syncRepo.putSync(`photo/${p.id}`, st);
          });
          done += 1;
          continue;
        }
        const state = (await syncRepo.getSync(`photo/${p.id}`)) || { assets: {} };
        const file = await sendAsset(record, asset, content, key, folder.subfolders[asset.folder], state.assets?.[asset.key]?.id,
          (sent) => set({ progress: { done, total, current: asset.name, sent, size: content.size } }));
        const delta = Number(file.size || content.size) - Number(state.assets?.[asset.key]?.size || 0);
        used += delta;
        spent += delta;
        await withLock(lockKeyOf(p), async () => {
          const st = (await syncRepo.getSync(`photo/${p.id}`)) || { assets: {} };
          st.assets = { ...(st.assets || {}), [asset.key]: { id: file.id, sig: asset.sig, size: Number(file.size || content.size) } };
          st.folder_session = key;
          await syncRepo.putSync(`photo/${p.id}`, st);
        });
        done += 1;
      }
      await withLock(lockKeyOf(p), async () => {
        const record = await repo.getPhoto(p.id);
        const st = (await syncRepo.getSync(`photo/${p.id}`)) || { assets: {} };
        if (record) await syncRepo.putSync(`photo/${p.id}`, { ...st, updated_at: record.updated_at, session_id: record.session_id, folder_session: key });
      });
    }
  }
  for (const key of groups) {
    const session = key === NO_SESSION ? null : sessionsById.get(key);
    const folder = (await syncRepo.getSync(`session/${key}`)) || await ensureSessionFolder(folders, key, session);
    await writeSessionDoc(key, session, folder, settings, tombstones);
  }

  // Deleted sessions: their photos were moved out above; the folder goes to the Drive trash.
  for (const t of tombstones.sessions) {
    const st = await syncRepo.getSync(`session/${t.id}`);
    if (!st?.folder_id) continue;
    await drive.update(st.folder_id, { trashed: true }).catch((e) => { if (e instanceof AuthError) throw e; });
    await syncRepo.deleteSync(`session/${t.id}`);
  }
  // Files of deleted photos (Drive trash: recoverable for 30 days).
  for (const t of trash) {
    for (const id of t.ids) await drive.update(id, { trashed: true }).catch((e) => { if (e instanceof AuthError) throw e; });
  }
  await syncRepo.putSync('trash', []);

  // indice.json and config.json.
  const index = blobFromJson(buildIndexDoc({ sessions, deletedSessions: tombstones.sessions, appVersion: APP_VERSION, now: now() }));
  const indexFile = folders.index_id
    ? await drive.uploadSmall({ id: folders.index_id, name: 'indice.json', mimeType: JSON_MIME, content: index })
    : await drive.uploadSmall({ name: 'indice.json', parentId: folders.root_id, mimeType: JSON_MIME, content: index, appProperties: { ef_kind: 'indice' } });
  folders.index_id = indexFile.id;
  folders.index_modified = indexFile.modifiedTime;
  const settingsAt = (await syncRepo.getSettingsUpdatedAt()) || null;
  if (!folders.config_id || folders.config_written !== settingsAt) {
    const cfg = blobFromJson({ schema_version: 1, kind: 'efconfig', updated_at: settingsAt, settings });
    const cfgFile = folders.config_id
      ? await drive.uploadSmall({ id: folders.config_id, name: 'config.json', mimeType: JSON_MIME, content: cfg })
      : await drive.uploadSmall({ name: 'config.json', parentId: folders.root_id, mimeType: JSON_MIME, content: cfg, appProperties: { ef_kind: 'config' } });
    folders.config_id = cfgFile.id;
    folders.config_modified = cfgFile.modifiedTime;
    folders.config_written = settingsAt;
  }
  await syncRepo.putSync('folders', folders);
  set({ held_originals: held, progress: null });
  await updateUsage(settings);
}

// ---------------------------------------------------------------- runner

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not supported or refused: the run continues */ }
}

let running = null;
let again = false;

/** Runs a full sync now (or once more after the current run). */
export function syncNow() {
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again && syncStatus.state !== 'paused');
  })().finally(() => { running = null; keepAwake(false); });
  return running;
}

async function runOnce() {
  if (auth.state === 'unconfigured') return;
  if (!tokenValid()) { set({ state: 'paused', reason: 'auth' }); await refreshPending(); return; }
  if (navigator.onLine === false) { set({ state: 'paused', reason: 'offline' }); await refreshPending(); return; }
  set({ state: 'running', reason: null, error: null });
  keepAwake(true);
  try {
    const folders = await ensureRoot();
    const tombstones = await syncRepo.getTombstones();
    await pull(folders, tombstones);
    await push(folders, await syncRepo.getSettings(), tombstones);
    // Count what is left before saying "idle": changes made during the run are
    // pending, and when another run is queued the state stays "running".
    const pending = await computePending();
    set({ state: again ? 'running' : 'idle', last_sync_at: now(), progress: null, pending });
    return;
  } catch (e) {
    if (e instanceof AuthError) { tokenRejected(); set({ state: 'paused', reason: 'auth', progress: null }); }
    else if (e instanceof QuotaError) set({ state: 'paused', reason: 'error', error: 'O Google Drive está sem espaço.', progress: null });
    else if (e instanceof NewerDataError) {
      // Nothing is sent either: an old copy must not overwrite what a newer one wrote.
      set({ state: 'paused', reason: 'update', error: e.message, progress: null });
      announceUpdate('data');
    }
    else { console.error('sincronização falhou', e); set({ state: 'paused', reason: 'error', error: e.message, progress: null }); }
  }
  await refreshPending();
}

let timer = null;
/** Debounced sync after local changes; the pending count is updated right away. */
export function scheduleSync(delayMs = 2000) {
  refreshPending();
  clearTimeout(timer);
  timer = setTimeout(() => { if (tokenValid()) syncNow(); }, delayMs);
}

let started = false;
/** Wires the triggers once (app start). */
export function startSync() {
  if (started) return;
  started = true;
  const onChange = () => scheduleSync();
  photoEvents.addEventListener('changed', onChange);
  photoEvents.addEventListener('sessions', onChange);
  authEvents.addEventListener('change', () => { if (auth.state === 'connected') scheduleSync(0); emit(); });
  addEventListener('online', () => scheduleSync(0));
  addEventListener('offline', () => { if (syncStatus.state !== 'running') set({ state: 'paused', reason: 'offline' }); });
  document.addEventListener('visibilitychange', () => { if (running && document.visibilityState === 'visible') keepAwake(true); });
  refreshPending();
}
