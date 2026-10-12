// App entry: hash router and top navigation.
//   #/enviar        upload
//   #/sessoes       sessions and photos without a session
//   #/sessao/<id>   one session
//   #/avaliar/<escopo>[/<fotoId>]   rating (escopo = session id, sem-sessao, todas)
//   #/fotos         photo grid
//   #/foto/<id>     photo sheet
//   #/drive         Google Drive, settings, backup, install
//   #/sobre         about / diagnostics
import { uploadView } from './ui/views/upload.js';
import { photosView } from './ui/views/photos.js';
import { photoSheetView } from './ui/views/photo-sheet.js';
import { aboutView } from './ui/views/about.js';
import { sessionsView } from './ui/views/sessions.js';
import { sessionView } from './ui/views/session.js';
import { rateView } from './ui/views/rate.js';
import { driveView } from './ui/views/drive.js';
import { mountSyncBadge } from './ui/sync-badge.js';
import { startSync, syncStatus, scheduleSync } from './pipeline/sync.js';
import { preloadAuth, renewOnGesture } from './drive/auth.js';
import { startPwa, askPersistence } from './pwa.js';
import { photoEvents } from './pipeline/photo-events.js';
import { APP_VERSION } from './version.js';

const routes = [
  { pattern: /^#\/enviar$/, view: uploadView, nav: 'enviar' },
  { pattern: /^#\/sessoes$/, view: sessionsView, nav: 'sessoes' },
  { pattern: /^#\/sessao\/([^/]+)$/, view: (root, m) => sessionView(root, { id: decodeURIComponent(m[1]) }), nav: 'sessoes' },
  {
    pattern: /^#\/avaliar\/([^/]+)(?:\/(.+))?$/,
    view: (root, m) => rateView(root, { scope: decodeURIComponent(m[1]), photoId: m[2] ? decodeURIComponent(m[2]) : null }),
    nav: 'sessoes',
  },
  { pattern: /^#\/fotos$/, view: photosView, nav: 'fotos' },
  { pattern: /^#\/foto\/(.+)$/, view: (root, m) => photoSheetView(root, { id: decodeURIComponent(m[1]) }), nav: 'fotos' },
  { pattern: /^#\/drive$/, view: driveView, nav: 'drive' },
  { pattern: /^#\/sobre$/, view: aboutView, nav: 'sobre' },
];

const main = document.getElementById('app');
let cleanup = null;

function route() {
  const hash = location.hash || '#/enviar';
  const match = routes.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) { location.hash = '#/enviar'; return; }
  if (typeof cleanup === 'function') cleanup();
  main.replaceChildren();
  window.scrollTo(0, 0);
  cleanup = match.r.view(main, match.m);
  for (const a of document.querySelectorAll('[data-nav]')) {
    a.toggleAttribute('aria-current', a.dataset.nav === match.r.nav);
  }
}

document.getElementById('app-version').textContent = `v${APP_VERSION}`;
window.addEventListener('hashchange', route);
route();

// Drive: the sign-in is renewed on a tap (browsers block popups otherwise),
// only when there is something to send or nothing was synced in this visit.
startPwa();
startSync();
preloadAuth();
mountSyncBadge(document.getElementById('sync-badge'));
document.addEventListener('pointerdown', () => renewOnGesture(() => syncStatus.pending > 0 || !syncStatus.last_sync_at), { capture: true });
// The first stored photo asks the browser to keep the data (no prompt in Chrome).
photoEvents.addEventListener('changed', askPersistence, { once: true });
scheduleSync(1000);
