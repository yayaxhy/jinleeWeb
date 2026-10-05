self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = typeof data.title === 'string' ? data.title : '点了么娱乐公会';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/DLMLOGO-512.png',
    badge: '/DLMLOGO-512.png',
    data: { url: typeof data.url === 'string' ? data.url : '/console' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/console';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.includes(url) && 'focus' in client) return client.focus();
    }
    return self.clients.openWindow(url);
  }));
});
