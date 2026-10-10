// App entry: hash router and top navigation.
//   #/enviar        upload
//   #/fotos         photo grid
//   #/foto/<id>     photo sheet
//   #/sobre         about / diagnostics
import { uploadView } from './ui/views/upload.js';
import { photosView } from './ui/views/photos.js';
import { photoSheetView } from './ui/views/photo-sheet.js';
import { aboutView } from './ui/views/about.js';
import { APP_VERSION } from './version.js';

const routes = [
  { pattern: /^#\/enviar$/, view: uploadView, nav: 'enviar' },
  { pattern: /^#\/fotos$/, view: photosView, nav: 'fotos' },
  { pattern: /^#\/foto\/(.+)$/, view: (root, m) => photoSheetView(root, { id: decodeURIComponent(m[1]) }), nav: 'fotos' },
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
