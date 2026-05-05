// Cache-first service worker. Single user, small asset set.
// Hand-rolled rather than Workbox: see docs/adr/002-service-worker.md.

const CACHE_VERSION = 'exerciseapp-v13';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './src/app.js',
  './src/regime.js',
  './src/defaultRegime.js',
  './src/defaultImages.js',
  './src/schema.js',
  './src/session.js',
  './src/ui.js',
  './src/db.js',
  './src/log.js',
  './src/export.js',
  './src/regimePanel.js',
  './src/images.js',
  './vendor/dexie.mjs',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/exercises/arm-circles.png',
  './assets/exercises/band-external-rotations.png',
  './assets/exercises/bear-crawl.png',
  './assets/exercises/bodyweight-squats.png',
  './assets/exercises/brisk-walk.png',
  './assets/exercises/dead-hang.png',
  './assets/exercises/easy-run.png',
  './assets/exercises/inverted-rows.png',
  './assets/exercises/negative-chin-ups.png',
  './assets/exercises/push-ups.png',
  './assets/exercises/run-with-pickups.png',
  './assets/exercises/scapular-pulls.png',
  './assets/exercises/walking-lunges.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        // Cache same-origin successful GETs opportunistically.
        if (response.ok && new URL(req.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
