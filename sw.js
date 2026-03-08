// Service Worker (offline-first for local assets)

const CACHE_VERSION = 'v1.7.18-custom1';
const CACHE_NAME = `ephone-cache-${CACHE_VERSION}`;

// Cache only local assets so the site works fully offline.
const URLS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './custom_import.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',

  // Vendor libs (local)
  './_vendor/dexie.min.js',
  './_vendor/html2canvas.min.js__ed46bfb3ee1c1b39.js',
  './_vendor/pp.js__8b0e951cd4c39a1f.js',
  './_vendor/StreamSaver.min.js__3ae1f6c5f77509c7.js',
  './_vendor/jszip.min.js__bd0b6a1bcd41db0d.js',
  './_vendor/browser-image-compression.js__290298fba20caa74.js',
  './_vendor/Tone.js__fdaf3a074a4cdf3a.js',
  './_vendor/mammoth.browser.min.js__c9b4f17ec76c3795.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // cache.addAll() fails the whole install if *any* URL 404s.
        // This can happen on GitHub Pages if an upload is incomplete.
        // So we cache what we can and continue.
        const results = await Promise.allSettled(
          URLS_TO_CACHE.map((u) => cache.add(u))
        );
        const failed = results
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r.status === 'rejected')
          .map(({ i }) => URLS_TO_CACHE[i]);
        if (failed.length) console.warn('[SW] cache skipped (missing):', failed);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          // Best-effort runtime cache for same-origin requests
          try {
            const url = new URL(event.request.url);
            if (url.origin === self.location.origin) {
              const respClone = resp.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
            }
          } catch {}
          return resp;
        });
    })
  );
});
