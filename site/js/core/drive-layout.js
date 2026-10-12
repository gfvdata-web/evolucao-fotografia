// What goes to the Google Drive and where (pure). See docs/MODELO-DE-DADOS.md
// and decision 0010.
//
// EvolucaoFotografia/
// ├── indice.json        sessions + deleted sessions
// ├── config.json        settings shared by tablet and PC
// ├── _sem_sessao/       photos without a session (same layout as a session)
// └── <AAAA-MM-DD>_<nome>_<id curto>/
//     ├── sessao.json    session + its photo records + deleted photo ids
//     ├── _historico/    dated copies of sessao.json (last N)
//     ├── originais/  previas/  recortes/  metadados/
//
// Every file carries appProperties (ef_kind, ef_session, ef_photo, ef_asset),
// so the structure can be rebuilt from a Drive search if indice.json is lost.
// The app uses the drive.file scope: it only sees what it created.
import { SCHEMA_VERSION } from './model.js';
import { keepsOriginal } from './settings.js';
import { stripGpsRecord } from './gps-strip.js';

export const ROOT_NAME = 'EvolucaoFotografia';
export const NO_SESSION = 'none';
export const SUBFOLDERS = ['originais', 'previas', 'recortes', 'metadados', '_historico'];
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sessao';

/** Folder of a session ("2026-10-10_Parque_k3x9ab"), or "_sem_sessao". */
export function sessionFolderName(session) {
  if (!session) return '_sem_sessao';
  return `${session.date || 'sem-data'}_${slug(session.name)}_${session.id.slice(-6)}`;
}

const extOf = (name) => (name.match(/\.[A-Za-z0-9]{1,5}$/) || [''])[0];
const baseOf = (name) => name.replace(/\.[A-Za-z0-9]{1,5}$/, '');
const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '_');

/**
 * Files a photo should have on the Drive under these settings.
 * `sig` changes whenever the content must be sent again (e.g. new crops).
 * `source` tells the sync engine where the local content is.
 */
export function desiredAssets(record, settings) {
  const id = safe(record.id);
  const gps = settings.keep_gps ? 'gps' : 'nogps';
  const out = [];
  if (record.preview) {
    out.push({
      key: 'preview', folder: 'previas', name: `${id}.jpg`, mime: 'image/jpeg',
      sig: record.preview.from_variant, source: { kind: 'preview' },
    });
  }
  for (const v of record.variants) {
    const vk = safe(v.key);
    if (v.metadata_status === 'complete') {
      out.push({
        key: `metadata/${v.key}`, folder: 'metadados', name: `${id}__${vk}.json`, mime: 'application/json',
        sig: gps, source: { kind: 'metadata', variant: v.key },
      });
    }
    for (const which of ['af', 'uniform']) {
      if (v.analysis?.[which] && !v.analysis.error) {
        out.push({
          key: `crop/${v.key}/${which}`, folder: 'recortes', name: `${id}__${vk}__${which}.png`, mime: 'image/png',
          sig: v.analysis.analyzed_at, source: { kind: 'crop', variant: v.key, which },
        });
      }
    }
    if (keepsOriginal(settings, v.kind)) {
      out.push({
        key: `original/${v.key}`, folder: 'originais', name: `${safe(baseOf(v.file.name))}__${vk}${extOf(v.file.name)}`,
        mime: v.kind === 'cr3' ? 'image/x-canon-cr3' : 'image/jpeg', size: v.file.size, original: true,
        sig: gps, source: { kind: 'original', variant: v.key },
      });
    }
  }
  return out;
}

/**
 * What a photo still needs on the Drive. `state` = local sync state of the
 * photo: { updated_at, session_id, folder_session, assets: {key: {id, sig}} }.
 * @returns {{record: boolean, upload: object[], move: boolean}}
 */
export function photoWork(record, state, settings) {
  const assets = state?.assets || {};
  const upload = desiredAssets(record, settings).filter((a) => !assets[a.key] || assets[a.key].sig !== a.sig);
  const folder = record.session_id || NO_SESSION;
  return {
    record: !state || state.updated_at !== record.updated_at || state.session_id !== record.session_id,
    upload,
    move: Boolean(state?.folder_session) && state.folder_session !== folder && Object.keys(assets).length > 0,
  };
}

export const photoPending = (record, state, settings) => {
  const w = photoWork(record, state, settings);
  return w.record || w.move || w.upload.length > 0;
};

/** Newer `updated_at` wins; on a tie nothing changes. */
export function newer(local, remote) {
  if (!remote) return 'local';
  if (!local) return 'remote';
  const l = String(local.updated_at || '');
  const r = String(remote.updated_at || '');
  if (l === r) return 'same';
  return r > l ? 'remote' : 'local';
}

/** Union of tombstones ({id, at}), keeping the latest date per id. */
export function mergeTombstones(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const t of list || []) {
      if (!t?.id) continue;
      if (!map.has(t.id) || String(t.at) > String(map.get(t.id).at)) map.set(t.id, { id: t.id, at: t.at });
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Content of sessao.json. Photo records go as they are stored, plus
 * `drive_assets` (file ids, so another device can download them); without
 * GPS when the setting says so.
 */
export function buildSessionDoc({ session, photos, states, deleted, settings, appVersion, now }) {
  return {
    schema_version: SCHEMA_VERSION,
    kind: 'efsessao',
    app_version: appVersion,
    written_at: now,
    session: session || null,
    photos: photos.map((p) => ({
      ...(settings.keep_gps ? p : stripGpsRecord(p)),
      drive_assets: states.get(p.id)?.assets || {},
    })),
    deleted_photos: deleted || [],
  };
}

/** Validates a downloaded sessao.json; returns {session, photos: [{record, assets}], deleted}. */
export function readSessionDoc(doc) {
  if (!doc || doc.kind !== 'efsessao' || !Array.isArray(doc.photos)) throw new Error('sessao.json inválido');
  if (doc.schema_version > SCHEMA_VERSION) {
    throw new Error(`sessao.json de uma versão mais nova do app (${doc.schema_version}). Atualize a página.`);
  }
  return {
    session: doc.session || null,
    photos: doc.photos.map(({ drive_assets: assets, ...record }) => ({ record, assets: assets || {} })),
    deleted: doc.deleted_photos || [],
  };
}

export function buildIndexDoc({ sessions, deletedSessions, appVersion, now }) {
  return {
    schema_version: SCHEMA_VERSION,
    kind: 'efindice',
    app_version: appVersion,
    written_at: now,
    sessions: sessions.map((s) => ({ id: s.id, name: s.name, date: s.date, updated_at: s.updated_at })),
    deleted_sessions: deletedSessions || [],
  };
}

/** Name of a dated copy in _historico/ ("sessao_2026-10-12T18-30-00Z.json"). */
export const historyName = (now) => `sessao_${String(now).replace(/[:.]/g, '-')}.json`;

/** Which history copies to delete so only the newest `keep` remain. */
export function historyToPrune(files, keep) {
  const sorted = [...files].sort((a, b) => String(b.name).localeCompare(String(a.name)));
  return sorted.slice(keep);
}

/** Bytes → "12,3 GB" share of the limit. */
export function spaceStatus(usedBytes, limitGb, pendingBytes = 0) {
  const limit = limitGb * 1024 ** 3;
  const ratio = usedBytes / limit;
  return {
    used: usedBytes,
    limit,
    ratio,
    status: usedBytes + pendingBytes > limit ? 'alert' : ratio >= 0.9 ? 'attention' : 'ok',
  };
}
