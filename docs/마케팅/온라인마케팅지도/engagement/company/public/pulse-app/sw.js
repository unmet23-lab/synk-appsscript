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
// v41(11-11): 첫 방문 무게 — 고객 앱 글꼴을 글자 조각으로 나눴다(저장소의 글꼴 조각 도구가 만든다 — SUIT → SYNK Sans 조각 넷 · 명조 조각 셋).
// 미리 받는 목록에는 첫 화면이 쓰는 조각(라틴 · 첫 글자 · 화면 글자, 명조 기호 · 화면 글자)만 두고, 통째 글꼴 둘(직원 화면 app.css의 SUIT ·
// 옛 명조)과 나머지 조각은 받을 때 담는 목록(RUNTIME)으로 옮겼다. 등록도 문서 load 뒤 쉴 때로 늦췄다(app.mjs) — 첫 방문의 셸 받기가
// 의뢰서 · 첫 화면과 대역을 나누지 않게. film.css · film-home.mjs · app.mjs · index.html도 바뀌었다.
// v42(11-11): PULSE 고객 인물 보관 규칙 — 보관 동의 칸(12개월 · 지우는 날 · 백업 13개월 · 오래 두는 별도 보관 사본 제외) · 다시 쓰기 꺼진 카드의 「지우는 날」 ·
// 의뢰서 맞춤 인물 안내로 my-models.mjs · request-flow.mjs · 직원 「고객 브랜드」 화면 모듈 · i18n/en.mjs가 바뀌었다(판 4 설계 11-4).
// v43(11-11): 접수 멈춤 안내 — 첫 화면 「광고 의뢰하기」 자리에 쉬는 안내를 그리는 film-home.mjs · app.mjs · views.mjs · api.mjs · request-backend.mjs · film.css · app.css · i18n/en.mjs가 바뀌었다.
// 목록은 그대로이고 바뀐 화면 모듈을 새로 받게 판만 올린다. 접수 상태(/pulse/api/availability)는 API라 담지 않는다.
// v44(11-11): 운영 조각 2 — 일지의 결제 요청 · 확인 · 취소 줄과 영상 단계의 「수정 n회 중 k회 남았어요」로 room-view.mjs · feedback-rounds-view.mjs · i18n/en.mjs가 바뀌었다.
// v45(11-12): PULSE 스위치를 켜기 전 후속(첫 방문 무게 v41 · 보관 규칙 v42 · 접수 멈춤 v43 · 결제 일지 v44 위) — 첫 기다림 글을 이 기기의 언어로 먼저 바꾸는 boot-locale.js(고전 스크립트, CSP script-src 'self')를 더했다.
// 영어 첫 화면 제목 · 글꼴 B(assets/NotoSerifDisplay-Light-latin.woff2), 끊긴 채 다시 열면 마지막으로 정한 언어로 · 「동작 시안」 용어 · 내 모델 로그아웃 403 · 닫힌 다시 쓰기 방의 「내 모델 열기」 · 실패한 파일 「다시 올리기」로 app.mjs · film-views.mjs · persona-view.mjs · my-models.mjs · request-flow.mjs · i18n/en.mjs · index.html도 바뀌었다.
// v46(11-12): 운영 조각 4 작업 소식 — 일지의 소식 줄(그림 · 「작업 중인 화면이에요」) · 「말만 보기」 거르개 · 저희 차례 큰 그림 칸의 소식 그림 · 직원 「작업 소식」 칸으로
// room-view.mjs · film-views.mjs · app.mjs · views.mjs · 내부 확인 모듈 · film.css · slate-screens.css · i18n/en.mjs가 바뀌었다. 목록은 그대로이고 판만 올린다.
// v47(11-12): 만료 · 삭제 운영 시험 P3(작업 소식 v46 위) — 내 모델 카드의 삭제 요청 상태 한 줄로 my-models.mjs · i18n/en.mjs가 바뀌었다(목록은 그대로).
// v48(11-12): 운영 조각 4 화면 최종 검수 반영 — 예시 일지의 「말만 보기」 · 인물 차례 방의 큰 그림 칸 · 거른 채 「봤다」 · 켜진 단추 높이 · 휴대폰 「소식 보기」 누를 높이로
// demo-film.mjs · film-views.mjs · room-view.mjs · app.mjs · 내부 확인 모듈 · film.css · slate-screens.css가 바뀌었다(v47 위). 목록은 그대로이고 판만 올린다.
// v49(11-12): 사진 상품의 옷 · 머리(작업 소식 화면 검수 반영 v48 위) — 모델 제안 카드의 옷 · 머리 두 줄 · 일지 · 내부 확인 화면의 한 줄 · 사진 상품 머리글로 film-views.mjs · room-view.mjs · app.mjs · views.mjs ·
// 내부 확인 모듈 · film.css · i18n/en.mjs가 바뀌었다. 목록은 그대로이고 판만 올린다.
// v50(11-12): 운영 조각 4 화면 후속 FA1 — 「말만 보기」를 켠 채 「봤다」가 숨은 소식 앞에서 멈추고 알림 짝짓기는 늘 돌게 room-view.mjs · app.mjs가 바뀌었다(v49 위). 목록은 그대로이고 판만 올린다.
// v51(11-12): 사진 상품의 말(v50 위) — 머리 단계 줄 「사진 · 납품」 · 첫 장이 도착한 방 · 첫 장 화면의 크레딧과 안내 · 담당자 방향 칸의 옷 · 머리 줄로 film-views.mjs · room-view.mjs · app.mjs · film.css · i18n/en.mjs가 바뀌었다.
// 목록은 그대로이고 판만 올린다.
// v52(11-12): 운영 조각 4 후속 FA1 — 「말만 보기」를 켠 채 「봤다」가 숨은 담당자 줄 앞에서 멈추고 · 알림 짝짓기는 늘 · 읽음 요청을 겹쳐 보내지 않게
// room-view.mjs · app.mjs가 바뀌었다(v51 위). 목록은 그대로이고 판만 올린다.
// v53(11-12): 맞춤 인물 90일 시계(판 4 설계 11-6) — 손님 차례 카드의 지우는 날 · 지운 뒤 한 줄 · 내 모델 보관 대기 카드의 날짜 · 두 의뢰서 공통 보관 문장으로 persona-view.mjs · film-views.mjs · room-view.mjs ·
// my-models.mjs · request-flow.mjs · views.mjs · 내부 확인 모듈 · i18n/en.mjs가 바뀌었다(v52 위). 목록은 그대로이고 판만 올린다.
// v54(11-12): 사진 상품의 확인 · 납품(v53 위) — 사진이 도착한 뒤의 화면(꼬리표 「사진 확인」 · 의견 칸에 시계 없음 · 방 큰 그림 칸에 도착한 사진 · 납품 · 끝맺음 글)으로
// views.mjs · film-views.mjs · room-view.mjs · feedback-rounds-view.mjs · app.mjs · film-legacy.css · i18n/en.mjs가 바뀌었다. 목록은 그대로이고 판만 올린다.
// v55(11-13): 사진 상품의 사진 판(v54 위) — 사진이 자기 비율로 서고 누르면 크게 보며, 완성 사진 다섯 장은 빈 칸 없이 놓이고, 영어 판의 「최종본」 줄과 설치 안내가 사진 말을 쓴다.
// views.mjs · film-views.mjs · film-review.mjs · feedback-rounds-view.mjs · install.mjs · app.mjs · film.css · film-legacy.css · i18n/en.mjs가 바뀌었다. 목록은 그대로이고 판만 올린다.
// v56(11-13): 사진 크게 보기 창에서 사진을 누르면 키워 밀어 보고, 사진을 못 불러왔을 때 단추의 이름 · 커서를 맞춘다(v55 위 — views.mjs · app.mjs · film-legacy.css · i18n/en.mjs). 목록은 그대로이고 판만 올린다.
// v57(11-13): 직원 작업실 다시 짓기(B안 「제작 보드」, v56 위) — 직원 머리 띠 · 첫 화면 보드 · 쉬기 칸으로 views.mjs · room-view.mjs · app.mjs가 바뀌고 직원 화면만 싣는 staff.css를 목록에 더했다.
// v58(11-13): 의뢰서 탭(v57 위) — 느낌 화면의 「웃음으로 퍼지게」 · 과감함, 전할 말 화면의 꼭 붙일 표시, 모델 화면의 목소리, 준비물의 소리 파일 칸으로
// request-data.mjs · request-flow.mjs · film.css · i18n/en.mjs가 바뀌었다. 목록은 그대로이고 판만 올린다(예시 영상 · 그림은 화면이 받을 때 받는다).
// v59(11-13): 받으실 날 고치기(운영 조각 6-A, v58 위) — 직원 결제 칸의 「받으실 날 고치기」 창, 손님 방의 받으실 날 줄 · 일지 줄로
// views.mjs · 직원 결제 칸 모듈(목록 밖) · room-view.mjs · app.mjs · i18n/en.mjs가 바뀌었다. 목록은 그대로이고 판만 올린다.
// v60(11-14): 의뢰서 탭 화면 검수 뒤 고침(v59 위) — 사진 상품에는 목소리 · 소리 파일 칸을 그리지 않고, 좁은 화면의 고지 문구 자리가 밑줄 글과 겹치지 않으며,
// 영어의 표시 · 심의 낱말을 맞췄다(request-data.mjs · request-flow.mjs · film.css · i18n/en.mjs). 목록은 그대로이고 판만 올린다.
// v61(11-14): 의뢰서 글 두 곳(v60 위) — 권리 동의 줄에 「음악」, 첫 화면 약속 줄에 「웃음으로 퍼지게」(request-flow.mjs · film-home.mjs · i18n/en.mjs). 목록은 그대로이고 판만 올린다.
// v62(11-14): 제작 자리 · 대기(운영 조각 6-B, v61 위) — 첫 화면의 「예약이 찼어요」, 의뢰서 첫 질문 · 결제 카드 · 방향 제안의 자리 한 줄, 직원 첫 화면의 자리 칸 · 결제 창 경고로
// app.mjs · views.mjs · film-home.mjs · request-flow.mjs · room-view.mjs · film-views.mjs · api.mjs · film.css · staff.css · i18n/en.mjs · 글꼴 조각(와 목록 밖의 직원 결제 칸 모듈)이 바뀌었다. 목록은 그대로이고 판만 올린다.
const CACHE = 'synk-pulse-shell-v62-seats-20261114';
const BASE = '/pulse-app/';
const FILES = ['production.css','preview.css','production-ui.mjs','production-context.mjs','deliverables-view.mjs','feedback-rounds-view.mjs','preview-view.mjs','animatic-player.mjs','index.html','app.css','casting.css','casting-view.mjs','casting-catalog.mjs','films-view.mjs','assets/casting/m01.webp','assets/casting/f01.webp','assets/casting/f02.webp','assets/casting/f03.webp','assets/casting/m02.webp','assets/casting/m03.webp','app.mjs','views.mjs','strategy-view.mjs','kickoff-view.mjs','changes-view.mjs','scene-requests-view.mjs','schedule-view.mjs','demo.mjs','api.mjs','live.mjs','push.mjs','install.mjs','manifest.webmanifest','assets/brand-pulse.webp','assets/InterTight.woff2','assets/SYNKLatin-Regular.woff2','assets/SYNKLatin-SemiBold.woff2','assets/SYNKLatin-Bold.woff2','assets/DMMono.ttf','assets/stage/hero-camera.webp','assets/stage/stage-strategy.webp','assets/stage/stage-direction.webp','assets/stage/stage-concepts.webp','assets/stage/stage-storyboard.webp','assets/stage/stage-review.webp','assets/stage/stage-history.webp','icons/icon-192.png','icons/icon-512.png'].map(name=>BASE+name);
FILES.push(BASE+'assets/casting/f04.webp');
// 11-02 캐스팅북 뒤 여섯 명(모델 고르기의 대표 사진)도 셸에 둔다.
for(const id of ['f05','m04','f06','f07','m05','m06'])FILES.push(BASE+'assets/casting/'+id+'.webp');
// 11-03 아이돌 두 팀 여덟 명도 셸에 둔다.
for(const id of ['f08','f09','f10','f11','m07','m08','m09','m10'])FILES.push(BASE+'assets/casting/'+id+'.webp');
FILES.push(BASE+'motion.mjs',BASE+'request-data.mjs',BASE+'request-flow.mjs',BASE+'request-backend.mjs',BASE+'film-views.mjs',BASE+'room-view.mjs',BASE+'demo-film.mjs',BASE+'slate.css',BASE+'slate-screens.css',BASE+'slate-legacy.css',BASE+'staff.css',BASE+'assets/request/logo-paper.webp');
FILES.push(BASE+'film.css',BASE+'film-legacy.css',BASE+'film-home.mjs',BASE+'film-review.mjs',BASE+'assets/request/reel-wide-poster.webp',BASE+'assets/request/reel-tall-poster.webp');
for(const name of ['SYNKSans-pulse-latin','SYNKSans-pulse-first','SYNKSans-pulse-ui','NotoSerifKR-300-sym','NotoSerifKR-300-ui'])FILES.push(BASE+'assets/'+name+'.woff2');
FILES.push(BASE+'i18n.mjs',BASE+'i18n/en.mjs',BASE+'casting-choice.mjs',BASE+'locale-menu.mjs');
FILES.push(BASE+'persona-view.mjs');
FILES.push(BASE+'my-models.mjs');
FILES.push(BASE+'boot-locale.js');
// 미리 받지 않고, 화면이 받을 때 담아 두는 파일(그 뒤로는 끊겨도 그대로 쓴다). 영어 제목 글꼴 B(15KB, 11-11)는 아래 따로 더한다 — 영어 화면에서만 받는다.
const RUNTIME = ['assets/SUIT.woff2','assets/NotoSerifKR-300.woff2','assets/SYNKSans-pulse-rest.woff2','assets/NotoSerifKR-300-rest.woff2'].map(name=>BASE+name);
RUNTIME.push(BASE+'assets/NotoSerifDisplay-Light-latin.woff2');
const ALLOWED = new Set([...FILES,...RUNTIME]);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('synk-pulse-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.search||(!ALLOWED.has(url.pathname)&&url.pathname!==BASE))return;
  if(url.pathname===BASE){event.respondWith(fetch(req).catch(()=>caches.match(BASE+'index.html')));return;}
  event.respondWith(fetch(req).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}return response;}).catch(()=>caches.match(req)));
});
