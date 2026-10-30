self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'DriveLink';
  const options = {
    body: payload.body || 'You have an update from your dealership.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || { url: '/#/app/notifications' },
    tag: payload.tag || 'drivelink-notification',
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/app/notifications';
  const target = path.startsWith('/#') ? path : '/#' + path.replace(/^\//, '');
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) { await client.focus(); client.navigate(target); return; }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
