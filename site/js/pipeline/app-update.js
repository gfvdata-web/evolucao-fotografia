// "There is a newer app": a device can stay open for days with an old copy of
// the app (the installed app on the tablet especially). When the data format
// changes, that copy stops syncing (it cannot read what the newer one wrote,
// and must not overwrite it). So the app checks the published version now and
// then, and the sync reports Drive data written by a newer version; both show
// a banner with "Atualizar agora".
import { APP_VERSION } from '../version.js';
import { isNewerVersion, parseAppVersion } from '../core/app-version.js';

const CHECK_EVERY_MS = 30 * 60 * 1000;

export const updateEvents = new EventTarget();
/** reason: "published" (a newer version is online) | "data" (the Drive has newer data) */
export const updateState = { version: null, reason: null };

export function announceUpdate(reason, version = null) {
  if (updateState.reason === 'data' && reason === 'published') updateState.version = version || updateState.version;
  else Object.assign(updateState, { reason, version: version || updateState.version });
  updateEvents.dispatchEvent(new Event('change'));
}

/** Reads the published version.js (never from a cache) and compares it with this copy. */
export async function checkForUpdate(fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(`js/version.js?check=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const published = parseAppVersion(await res.text());
    if (published && isNewerVersion(published, APP_VERSION)) announceUpdate('published', published);
    return published;
  } catch {
    return null; // offline: try again later
  }
}

let started = false;
export function startUpdateChecks() {
  if (started) return;
  started = true;
  checkForUpdate();
  setInterval(checkForUpdate, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
  addEventListener('online', () => checkForUpdate());
}
