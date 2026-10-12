'use strict';
// A separate registration for each role keeps customer and creator push
// subscriptions distinct. No fetch handler, cache, or private payload.
const staff=new URL(self.location.href).searchParams.get('mode')==='staff';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>event.waitUntil(self.registration.showNotification('SYNK PULSE',{
  body:staff?'고객의 새 의견 또는 확인할 소식이 있어요.':'프로젝트에 확인할 새 소식이 있어요.',
  icon:'/pulse-app/icons/icon-192.png',badge:'/pulse-app/icons/icon-192.png',
  tag:staff?'pulse-creator-updates':'pulse-client-updates',renotify:false
})));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=clients.find(client=>{const url=new URL(client.url);return url.origin===self.location.origin&&url.pathname==='/pulse-app/'&&!url.searchParams.has('demo')&&(url.searchParams.get('mode')==='staff')===staff;});
  if(existing){await existing.focus();existing.postMessage({type:'pulse:open-notifications',mode:staff?'staff':'customer'});return;}
  await self.clients.openWindow('/pulse-app/'+(staff?'?mode=staff&notifications=1':'?notifications=1'));
})());});
