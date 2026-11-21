// Minimal service worker: makes the card installable (PWA) and gives an
// offline fallback. Network-first so visitors never get stuck on old versions;
// the ?v= query strings in the page handle asset versioning.
const CACHE = 'tsubasa-card-v1';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok && new URL(e.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(e.request, res.clone());
      }
      return res;
    } catch (err) {
      const hit = await caches.match(e.request);
      return hit || Response.error();
    }
  })());
});
