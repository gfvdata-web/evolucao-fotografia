// Minimal promise wrapper around IndexedDB (no dependencies).
//
// Stores (DB_VERSION 2):
//   photos        records (keyPath "id"), indexes: match_key, added_at, session_id (v2)
//   blobs         original files and previews, key "<photoId>/<what>"
//   raw_metadata  full ExifTool JSON per variant, key "<photoId>/<variantKey>"
//   meta          app key/value (settings, counters)
//   sessions      session documents (keyPath "id"), v2
export const DB_NAME = 'evolucao-fotografia';
export const DB_VERSION = 2;

function upgrade(db, oldVersion, tx) {
  if (oldVersion < 1) {
    const photos = db.createObjectStore('photos', { keyPath: 'id' });
    photos.createIndex('match_key', 'match_key', { unique: false });
    photos.createIndex('added_at', 'added_at', { unique: false });
    db.createObjectStore('blobs');
    db.createObjectStore('raw_metadata');
    db.createObjectStore('meta');
  }
  if (oldVersion < 2) {
    tx.objectStore('photos').createIndex('session_id', 'session_id', { unique: false });
    db.createObjectStore('sessions', { keyPath: 'id' });
  }
}

let dbPromise = null;

export function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion, req.transaction);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Banco local bloqueado por outra aba aberta. Feche as outras abas do app.'));
  });
  return dbPromise;
}

const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const txDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('transação cancelada'));
});

export async function get(store, key) {
  const db = await openDb();
  return done(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDb();
  return done(db.transaction(store).objectStore(store).getAll());
}

export async function getByIndex(store, index, value) {
  const db = await openDb();
  return done(db.transaction(store).objectStore(store).index(index).getAll(value));
}

/** Writes several stores atomically: ops = [{store, value, key?} | {store, delete: key}] */
export async function write(ops) {
  const db = await openDb();
  const stores = [...new Set(ops.map((o) => o.store))];
  const tx = db.transaction(stores, 'readwrite');
  for (const op of ops) {
    const s = tx.objectStore(op.store);
    if ('delete' in op) s.delete(op.delete);
    else if (op.key !== undefined) s.put(op.value, op.key);
    else s.put(op.value);
  }
  return txDone(tx);
}

/** Deletes every key starting with `prefix` in a store whose keys are strings. */
export async function deletePrefix(store, prefix) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(IDBKeyRange.bound(prefix, `${prefix}￿`));
  return txDone(tx);
}

export async function clearAll() {
  const db = await openDb();
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, 'readwrite');
  for (const n of names) tx.objectStore(n).clear();
  return txDone(tx);
}
