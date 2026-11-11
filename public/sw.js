// Lotlé service worker: preserve push delivery and cache only safe app shell assets.
const LOTLE_CACHE_VERSION = 'lotle-runtime-v7';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => /^(drivelink|lotle)-/i.test(name) && name !== LOTLE_CACHE_VERSION)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'Lotlé update';
  const options = {
    body: payload.body || 'You have a new update in Lotlé.',
    icon: '/icon.svg?v=lotle-6',
    badge: '/icon.svg?v=lotle-6',
    data: payload.data || { url: '/#/app/notifications' },
    tag: payload.tag || 'lotle-notification',
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const notificationIds = Array.isArray(data.notificationIds) ? data.notificationIds.join(',') : (data.notificationId || '');
  const path = data.url || '/app/notifications';
  const target = '/#/app/notifications?notificationIds=' + encodeURIComponent(notificationIds) + '&target=' + encodeURIComponent(path);
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) { await client.focus(); client.navigate(target); return; }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});


// Keep the dealer app installable while preserving the push handlers above.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|auth|functions|rest|storage)\//i.test(url.pathname) || /supabase|token|session|oauth/i.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === 'basic') {
          const cache = await caches.open(LOTLE_CACHE_VERSION);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cache = await caches.open(LOTLE_CACHE_VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    })());
  }
});
