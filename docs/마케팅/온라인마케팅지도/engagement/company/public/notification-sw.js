'use strict';
// No fetch handler and no cache: authenticated company content stays network-only.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// The server's only push body is the encrypted marker {"kind":"call"}; anything else, or none, is ordinary work.
// Lock screens must not reveal who calls, customers or chat, so each kind has one fixed text (the call text: 10-20).
// A call also gets its own tag and renotify: a work notice already on screen would otherwise swallow it silently.
const WORK={body:'확인할 새 업무가 있어요',tag:'synk-work-notifications',renotify:false},CALL={body:'통화 초대가 왔어요',tag:'synk-call-invitations',renotify:true,vibrate:[300,150,300,150,300]};
function isCall(data){try{return data?.json()?.kind==='call';}catch{return false;}}
self.addEventListener('push',event=>{
  const style=isCall(event.data)?CALL:WORK;
  event.waitUntil(self.registration.showNotification('SYNK',{
    icon:'/messenger-icon.png',badge:'/messenger-icon.png',...style,data:{kind:style.tag}
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
