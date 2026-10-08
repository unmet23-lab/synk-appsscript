'use strict';
// No fetch handler and no cache: authenticated company content stays network-only.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  // Payload is intentionally unused. Lock screens must not reveal customer or chat data.
  event.waitUntil(self.registration.showNotification('SYNK',{
    body:'확인할 새 업무가 있어요',icon:'/messenger-icon.png',badge:'/messenger-icon.png',
    tag:'synk-work-notifications',renotify:false,data:{kind:'synk-work-notifications'}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>{try{const url=new URL(client.url);return url.origin===self.location.origin&&url.pathname==='/';}catch{return false;}});
    if(existing){await existing.focus();existing.postMessage({type:'synk:open-notifications'});return;}
    await self.clients.openWindow('/?tab=messenger&panel=notifications');
  })());
});
