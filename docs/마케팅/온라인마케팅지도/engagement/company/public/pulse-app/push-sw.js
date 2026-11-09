'use strict';
// A separate registration for each role keeps customer and creator push
// subscriptions distinct. No fetch handler or cache.
// A push may carry a short title and body the server already wrote in the
// project's language ({"title","body"} — never names or note text). This worker
// cannot use the screen's translations, so it shows those words as they came and
// falls back to a fixed notice only when the push is empty or unreadable:
// Korean unless the screen registered this worker with lang=en (a customer whose
// screen is English). Korean customers keep the same address and the same words.
const params=new URL(self.location.href).searchParams,staff=params.get('mode')==='staff';
const FALLBACK=staff?'고객의 새 의견 또는 확인할 소식이 있어요.':params.get('lang')==='en'?'There’s a new update on your project.':'프로젝트에 확인할 새 소식이 있어요.';
const line=(value,max)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):'';
function words(event){
  let data=null;
  try{data=event.data?event.data.json():null;}catch{data=null;}
  return {title:line(data?.title,80)||'SYNK PULSE',body:line(data?.body,240)||FALLBACK};
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{const {title,body}=words(event);event.waitUntil(self.registration.showNotification(title,{
  body,
  icon:'/pulse-app/icons/icon-192.png',badge:'/pulse-app/icons/icon-192.png',
  tag:staff?'pulse-creator-updates':'pulse-client-updates',renotify:false
}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=clients.find(client=>{const url=new URL(client.url);return url.origin===self.location.origin&&url.pathname==='/pulse-app/'&&!url.searchParams.has('demo')&&(url.searchParams.get('mode')==='staff')===staff;});
  if(existing){await existing.focus();existing.postMessage({type:'pulse:open-notifications',mode:staff?'staff':'customer'});return;}
  await self.clients.openWindow('/pulse-app/'+(staff?'?mode=staff&notifications=1':'?notifications=1'));
})());});
