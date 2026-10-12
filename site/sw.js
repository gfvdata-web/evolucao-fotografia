// Service worker: lets the installed app open without internet.
//
// Same-origin GET requests only (Google sign-in, the Drive API and the visit
// counter always go to the network). Code and pages: network first, so an
// update is picked up on the next visit; the cached copy is used when offline
// or when the network takes more than 4 s. The ExifTool files (~7 MB) and
// icons: cache first. No list of files to keep in sync: whatever the app
// loaded once is available offline.
const CACHE = 'evolucao-fotografia-v1';
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const cacheFirst = (url) => /\/vendor\/|\/icons\//.test(url.pathname);

async function fromCache(req) {
  const cache = await caches.open(CACHE);
  return cache.match(req, { ignoreSearch: true });
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  network.catch(() => {}); // when the cache answered first, a later network failure is expected
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    return (await fromCache(req)) || await network;
  } catch {
    const cached = await fromCache(req);
    if (cached) return cached;
    throw new Error('sem internet e sem cópia guardada');
  }
}

async function cacheFirstThenNetwork(req) {
  const cached = await fromCache(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(cacheFirst(url) ? cacheFirstThenNetwork(req) : networkFirst(req));
});
