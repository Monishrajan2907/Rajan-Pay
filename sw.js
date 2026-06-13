/* ============================================
   RajanPay Service Worker
   Rajan Finance Pvt. Ltd.
   Enables offline-capable PWA behaviour
   ============================================ */

const CACHE_NAME = 'rajanpay-v1.0.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ===== INSTALL: Cache all assets =====
self.addEventListener('install', (event) => {
  console.log('[RajanPay SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[RajanPay SW] Caching app shell');
      // Cache local assets reliably; external CDN assets best-effort
      return cache.addAll([
        './',
        './index.html',
        './app.html',
        './style.css',
        './app.js',
        './manifest.json',
      ]).then(() => {
        // Best-effort cache for CDN resources
        return Promise.allSettled(
          ['https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'].map(url =>
            cache.add(url).catch(() => console.log(`[RajanPay SW] Skipped: ${url}`))
          )
        );
      });
    }).then(() => {
      console.log('[RajanPay SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// ===== ACTIVATE: Clean old caches =====
self.addEventListener('activate', (event) => {
  console.log('[RajanPay SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log(`[RajanPay SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[RajanPay SW] Now controlling all clients');
      return self.clients.claim();
    })
  );
});

// ===== FETCH: Cache-first with network fallback =====
self.addEventListener('fetch', (event) => {
  // Skip non-GET and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('googleapis.com/css')) {
    // Network-first for Google Fonts CSS (to get latest)
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first strategy for app shell
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache, update in background
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache: fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ===== PUSH NOTIFICATIONS (future-ready) =====
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'New update from RajanPay',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'RajanPay', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
