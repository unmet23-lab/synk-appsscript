'use strict';
// Only this explicit public shell is cached. Never cache projects, invitations,
// API responses, uploaded media or navigation URLs carrying query parameters.
// v23(11-03): 모델 목소리 단계를 거뒀다 — 목소리 mp3는 처음부터 이 목록에 없었고, 바뀐 캐스팅 모듈을 새로 받게 판만 올린다.
// v24(11-03): 아이돌 두 팀 여덟 명(F08~F11 · M07~M10)을 모델 고르기에 더했다.
// v25(11-04): 첫 화면 소개글과 완성작 둘을 더했다 — 영상과 표지는 이 목록에 없고, 바뀐 화면 모듈을 새로 받게 판만 올린다.
// v26(11-04): 의뢰 흐름 — 첫 화면 · 의뢰서 · 고객 방 · 1차안 · 내부 확인 모듈과 슬레이트 판 스타일.
// v27(11-05): 시사실 판 — 첫 화면 · 의뢰서 · 고객 방 · 1차안 · 영상 확인 · 납품을 다시 그렸다. 첫 화면은 film.css만 싣고, 옛 CSS는 직원 화면과 프로젝트를 열 때 읽는다(목록에는 그대로 둔다). 쇼릴 영상은 이 목록에 없다.
// v28(11-05 밤): 다음 판 — 첫 화면 값 줄을 의뢰서로만, 의뢰서 이전 · 다음 차례, 받은 링크 폼 닫기, 쇼릴 이름을 프레임에 맞춤. 목록은 그대로이고 바뀐 화면 모듈을 새로 받게 판만 올린다.
// v30(11-06): 대표작 이름을 「霜の肌理」로 바꿨다 — 그림 · 영상은 같은 이름에 바이트만 바뀌고 목록은 그대로다. 바뀐 화면 모듈 · film.css를 새로 받게 판만 올린다.
// v31(11-09): 다국어 · 전용 인물 판 1 — 번역 틀 i18n.mjs · 영어 사전 i18n/en.mjs(영어를 처음 쓸 때 읽는다) · 모델 판단 casting-choice.mjs를 더했다. 한국어 화면은 그대로다.
// v32(11-09): 작품 최신화 — 완성 광고 목록 · 첫 화면 쇼릴 3판(포스터 둘은 같은 이름에 바이트만 바뀜) · 의뢰서 업종 그림. 목록은 그대로이고 바뀐 모듈 · 쇼릴 포스터를 새로 받게 판만 올린다.
// v33(11-09): 다국어 판 2 — 언어 메뉴 locale-menu.mjs를 더했다. 손님 화면 글이 번역 틀을 지나고, 한국어 화면은 그대로다.
// v34(11-09): 쇼릴 새 판 — 영상 둘과 포스터 둘이 같은 이름에 바이트만 바뀐다(자르지 않는 판, 1920×1200 · 1080×1920). 목록은 그대로이고 포스터를 새로 받게 판만 올린다.
// v35(11-10): 첫 화면 5쪽 그림 새 판(shard.webp 2520×2016)과 제목 새 문구 — 같은 회사 판 59로 나갔다.
// v36(11-10): 「만드는 사람」 이력 맨 앞에 서울로 당선 줄, 세로 창에서 그 글 묶음을 아래 그늘 위로. 목록은 그대로이고 바뀐 film-home.mjs · i18n/en.mjs · film.css를 새로 받게 판만 올린다.
// v37(11-10): 판매 전 고침 판 4 — 결제 차례 카드 · 메일 코드로 다시 열기 · 끝 상태 · 예시 프로젝트의 「방향 고르기」 · 「결제」 장면. 목록은 그대로이고 바뀐 화면 모듈 · film.css · app.css · slate-screens.css · i18n/en.mjs를 새로 받게 판만 올린다.
// v38(11-10): 큰 모니터(창 폭 약 2414 넘음)에서 첫 화면 3쪽 「이렇게 만들어요」 인물 그림 칸을 1400px로 묶었다(2560×1440 화면배율 1.55 → 1.46). 목록은 그대로이고 바뀐 film.css를 새로 받게 판만 올린다.
// v39(11-10): 고객 전용 인물 판 3 — 고객 방 인물 카드 모듈 persona-view.mjs를 더했다. 의뢰서 · 고객 방 · 내부 확인 모듈과 film.css · slate-screens.css · i18n/en.mjs도 바뀌었다. 스위치가 꺼져 있으면 화면은 그대로다.
// v40(11-10): PULSE 인물 판 4 — 손님 「내 모델」 화면 모듈 my-models.mjs를 더했다(스위치 myModels가 켜진 뒤 처음 열 때 읽는다). 고객 방 「내 모델로 모아 두기」 · 의뢰서 내 모델 고름 · 상태 줄 판 4 몫으로
// app.mjs · api.mjs · film-home.mjs · film-views.mjs · persona-view.mjs · request-*.mjs · room-view.mjs · views.mjs · film.css · slate-screens.css · i18n/en.mjs도 바뀌었다. 직원 「고객 브랜드」 화면 모듈은 직원 화면이라 목록에 넣지 않는다.
// v41(11-11): 첫 방문 무게 — 고객 앱 글꼴을 글자 조각으로 나눴다(tools/build-pulse-fonts.py, SUIT → SYNK Sans 조각 넷 · 명조 조각 셋).
// 미리 받는 목록에는 첫 화면이 쓰는 조각(라틴 · 첫 글자 · 화면 글자, 명조 기호 · 화면 글자)만 두고, 통째 글꼴 둘(직원 화면 app.css의 SUIT ·
// 옛 명조)과 나머지 조각은 받을 때 담는 목록(RUNTIME)으로 옮겼다. 등록도 문서 load 뒤 쉴 때로 늦췄다(app.mjs) — 첫 방문의 셸 받기가
// 의뢰서 · 첫 화면과 대역을 나누지 않게. film.css · film-home.mjs · app.mjs · index.html도 바뀌었다.
// v42(11-11): PULSE 고객 인물 보관 규칙 — 보관 동의 칸(12개월 · 지우는 날 · 백업 13개월 · 오래 두는 별도 보관 사본 제외) · 다시 쓰기 꺼진 카드의 「지우는 날」 ·
// 의뢰서 맞춤 인물 안내로 my-models.mjs · request-flow.mjs · brand-desk-view.mjs · i18n/en.mjs가 바뀌었다(판 4 설계 11-4).
const CACHE = 'synk-pulse-shell-v42-retention-20261111';
const BASE = '/pulse-app/';
const FILES = ['production.css','preview.css','production-ui.mjs','production-context.mjs','deliverables-view.mjs','feedback-rounds-view.mjs','preview-view.mjs','animatic-player.mjs','index.html','app.css','casting.css','casting-view.mjs','casting-catalog.mjs','films-view.mjs','assets/casting/m01.webp','assets/casting/f01.webp','assets/casting/f02.webp','assets/casting/f03.webp','assets/casting/m02.webp','assets/casting/m03.webp','app.mjs','views.mjs','strategy-view.mjs','kickoff-view.mjs','changes-view.mjs','scene-requests-view.mjs','schedule-view.mjs','demo.mjs','api.mjs','live.mjs','push.mjs','install.mjs','manifest.webmanifest','assets/brand-pulse.webp','assets/InterTight.woff2','assets/SYNKLatin-Regular.woff2','assets/SYNKLatin-SemiBold.woff2','assets/SYNKLatin-Bold.woff2','assets/DMMono.ttf','assets/stage/hero-camera.webp','assets/stage/stage-strategy.webp','assets/stage/stage-direction.webp','assets/stage/stage-concepts.webp','assets/stage/stage-storyboard.webp','assets/stage/stage-review.webp','assets/stage/stage-history.webp','icons/icon-192.png','icons/icon-512.png'].map(name=>BASE+name);
FILES.push(BASE+'assets/casting/f04.webp');
// 11-02 캐스팅북 뒤 여섯 명(모델 고르기의 대표 사진)도 셸에 둔다.
for(const id of ['f05','m04','f06','f07','m05','m06'])FILES.push(BASE+'assets/casting/'+id+'.webp');
// 11-03 아이돌 두 팀 여덟 명도 셸에 둔다.
for(const id of ['f08','f09','f10','f11','m07','m08','m09','m10'])FILES.push(BASE+'assets/casting/'+id+'.webp');
FILES.push(BASE+'motion.mjs',BASE+'request-data.mjs',BASE+'request-flow.mjs',BASE+'request-backend.mjs',BASE+'film-views.mjs',BASE+'room-view.mjs',BASE+'demo-film.mjs',BASE+'slate.css',BASE+'slate-screens.css',BASE+'slate-legacy.css',BASE+'assets/request/logo-paper.webp');
FILES.push(BASE+'film.css',BASE+'film-legacy.css',BASE+'film-home.mjs',BASE+'film-review.mjs',BASE+'assets/request/reel-wide-poster.webp',BASE+'assets/request/reel-tall-poster.webp');
for(const name of ['SYNKSans-pulse-latin','SYNKSans-pulse-first','SYNKSans-pulse-ui','NotoSerifKR-300-sym','NotoSerifKR-300-ui'])FILES.push(BASE+'assets/'+name+'.woff2');
FILES.push(BASE+'i18n.mjs',BASE+'i18n/en.mjs',BASE+'casting-choice.mjs',BASE+'locale-menu.mjs');
FILES.push(BASE+'persona-view.mjs');
FILES.push(BASE+'my-models.mjs');
// 미리 받지 않고, 화면이 받을 때 담아 두는 파일(그 뒤로는 끊겨도 그대로 쓴다).
const RUNTIME = ['assets/SUIT.woff2','assets/NotoSerifKR-300.woff2','assets/SYNKSans-pulse-rest.woff2','assets/NotoSerifKR-300-rest.woff2'].map(name=>BASE+name);
const ALLOWED = new Set([...FILES,...RUNTIME]);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('synk-pulse-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.search||(!ALLOWED.has(url.pathname)&&url.pathname!==BASE))return;
  if(url.pathname===BASE){event.respondWith(fetch(req).catch(()=>caches.match(BASE+'index.html')));return;}
  event.respondWith(fetch(req).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}return response;}).catch(()=>caches.match(req)));
});
