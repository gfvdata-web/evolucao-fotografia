// Installable app (PWA): service worker for offline use, the browser's
// install prompt and persistent storage (the browser does not clear the
// photos when space runs low).

export const installEvents = new EventTarget();
let deferredPrompt = null;

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function installState() {
  return { installed: standalone(), canInstall: Boolean(deferredPrompt) };
}

export async function install() {
  if (!deferredPrompt) return;
  const p = deferredPrompt;
  deferredPrompt = null;
  await p.prompt();
  await p.userChoice.catch(() => null);
  installEvents.dispatchEvent(new Event('change'));
}

/** Asks once for persistent storage (granted silently by Chrome for installed or engaged sites). */
export async function askPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported */ }
}

export function startPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installEvents.dispatchEvent(new Event('change'));
  });
  addEventListener('appinstalled', () => { deferredPrompt = null; installEvents.dispatchEvent(new Event('change')); askPersistence(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('service worker não registrado', e));
  }
}
