/// SparkTrack Progressive Web App Service Worker (v3)
/// Designed for Nigerian secondary schools and emerging African environments with intermittent connectivity.
/// Precaching app shell assets, Cache-First for static bundles, Network-First with offline fallback for navigation.

const CACHE_NAME = 'sparktrack-pwa-v3';
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// URLs that must never be served from the service worker cache
const BYPASS_PREFIXES = [
  '/api/',
  '/v1/',
  '/auth/v1/',
  '/rest/v1/',
  'supabase.co',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            fetch(url, { credentials: 'same-origin' }).then((res) => {
              if (res.ok) return cache.put(url, res);
            }),
          ),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept HTTP/HTTPS GET requests
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Bypass API, Supabase, and dynamic external requests
  if (BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix) || url.hostname.includes(prefix))) {
    return;
  }

  // Strategy A: Page Navigations (HTML Documents) -> Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlineFallback = await caches.match('/offline');
          if (offlineFallback) {
            return offlineFallback;
          }
          return caches.match('/');
        }),
    );
    return;
  }

  // Strategy B: Static Assets (_next/static, icons, fonts, CSS) -> Cache-First with Network Revalidation
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve cached asset immediately; revalidate in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse)).catch(() => {});
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        });
      }),
    );
    return;
  }

  // Strategy C: Default -> Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => caches.match(request)),
  );
});

// Communication channel with web client
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_NAME });
    }
  }
});
