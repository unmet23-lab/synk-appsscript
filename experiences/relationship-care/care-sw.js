'use strict';
// This worker never caches pages, account tokens, people, conversations or schedules.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (payload?.type !== 'synk-care-digest') return;
  event.waitUntil(self.registration.showNotification('SYNK 플레저', {
    body: '오늘 챙길 일이 있어요. 수첩에서 확인해 주세요.',
    icon: new URL('assets/sticker-envelope.webp', self.registration.scope).href,
    tag: 'synk-care-daily', renotify: false,
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL(self.registration.scope);
  if (destination.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => { try { const url = new URL(client.url); return url.origin === destination.origin && url.pathname === destination.pathname; } catch { return false; } });
    if (existing) return existing.focus();
    return self.clients.openWindow(destination.href);
  })());
});
