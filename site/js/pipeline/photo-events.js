// Shared by the ingestion and analysis pipelines: change notifications and
// per-shot locks around read-modify-write cycles of a photo record.

/** Fired with detail {id} whenever a stored photo changes. */
export const photoEvents = new EventTarget();
export const notifyChanged = (id) => photoEvents.dispatchEvent(new CustomEvent('changed', { detail: { id } }));

// The lock key is the match key (falls back to the id), so the JPEG and the CR3
// of the same shot share it even when their ids differ.
const locks = new Map();
export function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

export const lockKeyOf = (record) => record.match_key || record.id;
