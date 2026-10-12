// Google sign-in with the token model of Google Identity Services (decision
// 0005): an access token valid for 1 hour, no refresh token, no server.
//
// The token lives only in memory. Renewal needs a user gesture (the browser
// blocks popups otherwise), so `renewOnGesture()` is called from a global tap
// listener: when the token is missing or about to expire and the user had
// connected before, the next tap asks Google for a new one without a prompt.
// If that fails, the state becomes "reconnect" and the Drive screen shows the
// button.
import { GOOGLE_CLIENT_ID } from '../config.js';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const RENEW_MARGIN_MS = 5 * 60 * 1000;
const CONNECTED_KEY = 'ef.drive.connected'; // remembers that the user connected once (no token stored)

export const authEvents = new EventTarget();
export const auth = {
  token: null,
  expiresAt: 0,
  /** 'unconfigured' | 'disconnected' | 'connecting' | 'connected' | 'reconnect' */
  state: GOOGLE_CLIENT_ID ? 'disconnected' : 'unconfigured',
  error: null,
};

const emit = () => authEvents.dispatchEvent(new Event('change'));
const set = (patch) => { Object.assign(auth, patch); emit(); };

function remembered() {
  try { return localStorage.getItem(CONNECTED_KEY) === '1'; } catch { return false; }
}
function remember(on) {
  try { if (on) localStorage.setItem(CONNECTED_KEY, '1'); else localStorage.removeItem(CONNECTED_KEY); } catch { /* private mode */ }
}
if (auth.state === 'disconnected' && remembered()) auth.state = 'reconnect';

let gisPromise = null;
function loadGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error('não foi possível carregar o login do Google (sem internet?)')); };
    document.head.append(s);
  });
  return gisPromise;
}

let client = null;
let pending = null; // {resolve, reject} of the request in flight

function tokenClient() {
  client ??= google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: (r) => {
      const p = pending;
      pending = null;
      if (r.error || !r.access_token) {
        set({ state: 'reconnect', error: r.error_description || r.error || 'login recusado' });
        p?.reject(new Error(auth.error));
        return;
      }
      remember(true);
      set({ token: r.access_token, expiresAt: Date.now() + Number(r.expires_in || 3600) * 1000, state: 'connected', error: null });
      p?.resolve(r.access_token);
    },
    error_callback: (e) => {
      const p = pending;
      pending = null;
      set({ state: 'reconnect', error: e?.type === 'popup_closed' ? 'janela de login fechada' : (e?.message || 'login não concluído') });
      p?.reject(new Error(auth.error));
    },
  });
  return client;
}

/**
 * Asks Google for a token. Must run inside a tap handler. `silent` = no
 * consent screen when the account already agreed (renewal).
 */
export function requestToken({ silent = false } = {}) {
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('Drive não configurado neste app'));
  if (pending) return pending.promise;
  set({ state: 'connecting', error: null });
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  pending = { resolve, reject, promise };
  // GIS is loaded ahead (preloadAuth), so the popup opens within the tap.
  const go = () => tokenClient().requestAccessToken({ prompt: silent ? '' : 'consent' });
  if (globalThis.google?.accounts?.oauth2) go();
  else loadGis().then(go, (e) => { pending = null; set({ state: 'reconnect', error: e.message }); reject(e); });
  return promise;
}

/** Loads the Google script in advance when the user connected before. */
export function preloadAuth() {
  if (GOOGLE_CLIENT_ID && remembered()) loadGis().catch(() => {});
}

export const tokenValid = () => Boolean(auth.token) && Date.now() < auth.expiresAt - 30_000;
export const tokenExpiring = () => !auth.token || Date.now() > auth.expiresAt - RENEW_MARGIN_MS;

/** Current token, or null (never opens a window: renewal waits for a tap). */
export async function getToken() {
  return tokenValid() ? auth.token : null;
}

/** Marks the token as rejected by the Drive (401). */
export function tokenRejected() {
  set({ token: null, expiresAt: 0, state: 'reconnect' });
}

/**
 * Called on every tap: renews silently when the user connected before and
 * the token is missing or near the end. `wanted()` = there is Drive work.
 */
export function renewOnGesture(wanted) {
  if (!GOOGLE_CLIENT_ID || pending || auth.state === 'connecting') return;
  if (!remembered() || !tokenExpiring() || !wanted()) return;
  if (auth.state === 'reconnect' && auth.error) return; // a silent try already failed: wait for the button
  requestToken({ silent: true }).catch(() => {});
}

export function disconnect() {
  const t = auth.token;
  remember(false);
  set({ token: null, expiresAt: 0, state: GOOGLE_CLIENT_ID ? 'disconnected' : 'unconfigured', error: null });
  if (t && globalThis.google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(t, () => {});
}
