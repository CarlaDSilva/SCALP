// Scalp Service Worker
const CACHE = 'scalp-v5';
const ASSETS = ['./index.html','./manifest.json','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting(); // activate new SW immediately
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// NETWORK-FIRST: always try to fetch the latest from the network.
// Only fall back to cache when offline. This guarantees the app
// updates by itself whenever you push a new version (no re-download).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // update cache with fresh copy
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// Best-effort local notifications (iOS may kill the SW, so not guaranteed)
let timers = {};
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'schedule') {
    if (timers[d.id]) clearTimeout(timers[d.id]);
    const delay = Math.max(0, d.at - Date.now());
    if (delay < 2147483647) {
      timers[d.id] = setTimeout(() => {
        self.registration.showNotification(d.title, {
          body: d.body, icon: './icon-192.png', badge: './icon-192.png', tag: d.id
        });
      }, delay);
    }
  }
  if (d.type === 'cancel' && timers[d.id]) { clearTimeout(timers[d.id]); delete timers[d.id]; }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(cl => {
    for (const c of cl) if ('focus' in c) return c.focus();
    if (self.clients.openWindow) return self.clients.openWindow('./index.html');
  }));
});
