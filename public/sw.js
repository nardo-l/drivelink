// Push-only service worker. Existing home-screen installs keep the old app label until reinstall.\n// It intentionally does not cache fetch responses,
// authenticated API calls, or user-specific application pages.
const LOTLE_CACHE_VERSION = 'lotle-runtime-v5';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.toLowerCase().startsWith('drivelink') && name !== LOTLE_CACHE_VERSION)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'New update';
  const options = {
    body: payload.body || 'You have an update from your dealership.',
    icon: '/icon.svg?v=lotle-5',
    badge: '/icon.svg?v=lotle-5',
    data: payload.data || { url: '/#/app/notifications' },
    tag: payload.tag || 'lotle-notification',
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/app/notifications';
  const target = path.startsWith('/#') ? path : '/#' + path;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) { await client.focus(); client.navigate(target); return; }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
