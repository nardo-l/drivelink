// Push-only service worker. Existing home-screen installs keep the old app label until reinstall.
// It intentionally does not cache fetch responses,
// authenticated API calls, or user-specific application pages.
const LOTLE_CACHE_VERSION = 'lotle-runtime-v6';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => /^(drivelink|lotle)-runtime-/i.test(name) && name !== LOTLE_CACHE_VERSION)
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
