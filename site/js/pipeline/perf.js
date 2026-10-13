// Stores the device timing averages (core/perf.js) in the local "meta" store.
// Local only: never goes to the Drive nor to the backup.
import * as idb from '../storage/idb.js';
import { normalizePerf, addSample } from '../core/perf.js';

const KEY = 'perf';
let chain = Promise.resolve();

export async function loadPerf() {
  return normalizePerf(await idb.get('meta', KEY));
}

/** Adds one timing sample; writes are serialized so concurrent photos do not lose samples. */
export function recordTiming(kind, ms) {
  chain = chain.then(async () => {
    const next = addSample(await loadPerf(), kind, ms);
    await idb.write([{ store: 'meta', key: KEY, value: next }]);
  }).catch(() => { /* a measure is never worth failing an upload */ });
  return chain;
}
