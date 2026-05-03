// Maddy's Memories service worker
// Strategy: stale-while-revalidate for same-origin GET; offline fallback to index.html.

const VERSION = 'mm-v4';
const SHELL = ['/', '/index.html', '/manifest.json', '/maddy-avatar.jpg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Don't intercept API calls or third-party requests
  if (url.origin !== self.location.origin) return;

  // For navigation requests: try network, fall back to cached index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // For everything else: stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
