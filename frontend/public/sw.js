// MufYard Service Worker — Network-First with Cache Fallback
const CACHE_NAME = 'mufyard-v2-cache-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './favicon.ico',
  './manifest.json'
];

// Install: Pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests entirely (let browser handle them)
  if (event.request.method !== 'GET') return;

  // Skip cross-origin API requests — don't intercept backend calls
  if (url.origin !== self.location.origin) return;

  // Skip WebSocket upgrade requests
  if (event.request.headers.get('Upgrade') === 'websocket') return;

  // BYPASS: Skip Service Worker for Radio Streams and Audio
  if (
    url.pathname.includes('.mp3') || 
    url.pathname.includes('.aac') || 
    url.pathname.includes('icecast') || 
    url.pathname.includes('radio') ||
    url.port === '8000' || url.port === '8100' || url.port === '8200'
  ) {
    return;
  }

  // Network-First Strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the successful fresh response
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // CRITICAL FIX: Always return a valid Response, never undefined
          return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});
