'use strict';
// Only this explicit public shell is cached. Never cache projects, invitations,
// API responses, uploaded media or navigation URLs carrying query parameters.
// v23(11-03): 모델 목소리 단계를 거뒀다 — 목소리 mp3는 처음부터 이 목록에 없었고, 바뀐 캐스팅 모듈을 새로 받게 판만 올린다.
// v24(11-03): 아이돌 두 팀 여덟 명(F08~F11 · M07~M10)을 모델 고르기에 더했다.
const CACHE = 'synk-pulse-shell-v24-idol-teams-20261103';
const BASE = '/pulse-app/';
const FILES = ['production.css','preview.css','production-ui.mjs','production-context.mjs','deliverables-view.mjs','feedback-rounds-view.mjs','preview-view.mjs','animatic-player.mjs','index.html','app.css','casting.css','casting-view.mjs','casting-catalog.mjs','films-view.mjs','assets/casting/m01.webp','assets/casting/f01.webp','assets/casting/f02.webp','assets/casting/f03.webp','assets/casting/m02.webp','assets/casting/m03.webp','app.mjs','views.mjs','strategy-view.mjs','kickoff-view.mjs','changes-view.mjs','scene-requests-view.mjs','schedule-view.mjs','demo.mjs','api.mjs','live.mjs','push.mjs','install.mjs','manifest.webmanifest','assets/brand-pulse.webp','assets/SUIT.woff2','assets/InterTight.woff2','assets/SYNKLatin-Regular.woff2','assets/SYNKLatin-SemiBold.woff2','assets/SYNKLatin-Bold.woff2','assets/DMMono.ttf','assets/stage/hero-camera.webp','assets/stage/stage-strategy.webp','assets/stage/stage-direction.webp','assets/stage/stage-concepts.webp','assets/stage/stage-storyboard.webp','assets/stage/stage-review.webp','assets/stage/stage-history.webp','icons/icon-192.png','icons/icon-512.png'].map(name=>BASE+name);
FILES.push(BASE+'assets/casting/f04.webp');
// 11-02 캐스팅북 뒤 여섯 명(모델 고르기의 대표 사진)도 셸에 둔다.
for(const id of ['f05','m04','f06','f07','m05','m06'])FILES.push(BASE+'assets/casting/'+id+'.webp');
// 11-03 아이돌 두 팀 여덟 명도 셸에 둔다.
for(const id of ['f08','f09','f10','f11','m07','m08','m09','m10'])FILES.push(BASE+'assets/casting/'+id+'.webp');
const ALLOWED = new Set(FILES);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('synk-pulse-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.search||(!ALLOWED.has(url.pathname)&&url.pathname!==BASE))return;
  if(url.pathname===BASE){event.respondWith(fetch(req).catch(()=>caches.match(BASE+'index.html')));return;}
  event.respondWith(fetch(req).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}return response;}).catch(()=>caches.match(req)));
});
