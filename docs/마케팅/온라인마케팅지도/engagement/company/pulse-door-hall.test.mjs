// 첫 화면 1쪽 문 판 + 복도 · 들어가는 순간(2026-11-24, 시안 A 「캐스팅 복도」). 설계: docs/디자인/PULSE고객앱_다시짓기_20261124/옮기기_설계.md.
// 실제 그림(1440 · 390 넘침 · 콘솔 오류 · 들어가는 순간의 장면)은 실제 서버 브라우저 확인이 본다. 여기서는 마크업 약속과 안전 장치를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {entryView}=await import('./public/pulse-app/film-home.mjs');
const {hallItems,hallView,inHall}=await import('./public/pulse-app/hall.mjs');
const {MOVING_MODELS,MODEL_FILM_BASE}=await import('./public/pulse-app/request-flow.mjs');
const {FINISHED_FILMS}=await import('./public/pulse-app/films-view.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const doorOf=html=>{const at=html.indexOf('<section class="sx-p is-door"');return html.slice(at,html.indexOf('</section>',at));};

test('1쪽은 문 판과 복도다 — 제목 하나, 다시 여는 양식 한 벌(앱이 찾는 속성 그대로), 링크 칸은 제 단추로 펼친다',()=>{
  const html=entryView({}),door=doorOf(html);
  assert.match(html,/<section class="sx-p is-door" data-i="0" data-layer="none">/);
  assert.deepEqual(html.match(/<h1\b[\s\S]*?<\/h1>/g),['<h1 class="sx-display sx-door-title" data-door-title>내 광고 방</h1>']);
  assert.ok(door.includes('의뢰서에 적은 메일만 넣으면 열려요. 가입도 비밀번호도 없어요.'));
  assert.equal((html.match(/data-form="mail-open"/g)||[]).length,1);assert.equal((html.match(/data-form="invite"/g)||[]).length,1);
  for(const attr of ['data-entry-mail','data-mail-step="email"','data-mail-step="code"','data-mail-step="pick"','data-mail-go','data-mail-help','data-action="mail-again"','name="website"'])assert.ok(door.includes(attr),attr);
  // 메일 양식은 처음부터 보이고(확인 중 표시만), 링크 칸은 접혀 있다가 단추로 펼친다.
  assert.match(door,/<form class="sx-invite-form sx-invite-mail" data-form="mail-open" data-entry-mail data-step="email" data-checking novalidate>/);
  assert.match(door,/aria-expanded="false" aria-controls="door-invite">담당자에게 받은 링크로 열기<\/button><form class="sx-invite-form" id="door-invite" data-form="invite" hidden>/);
  // 지금 할 일(코드 받기)만 면 단추, 처음 온 사람의 「광고 의뢰하기」는 판 아래 글 단추.
  assert.match(door,/<button type="submit" class="sx-go is-solid" data-mutate><span data-mail-go>코드 받기<\/span>/);
  assert.match(door,/<span class="sx-small" data-door-ask data-start-note>처음이세요\?<\/span><button type="button" class="sx-go sx-door-start" data-entry="start"><span data-start-label>광고 의뢰하기<\/span>/);
  assert.match(door,/<p class="sr" role="status" data-door-say><\/p>/,'들어가는 순간을 한 번 읽는 칸');
  // 오류가 있으면 알림이 양식 위에 서고 링크 칸이 펼쳐진다.
  const err=doorOf(entryView({entryError:{title:'초대 링크를 읽지 못했어요',text:'링크 전체를 붙여 넣어 주세요.'}}));
  assert.match(err,/<div class="sx-invite" data-entry-invite><div class="sx-invite-alert" role="alert"><strong>초대 링크를 읽지 못했어요<\/strong>/);
  assert.match(err,/aria-expanded="true" aria-controls="door-invite">[^<]+<\/button><form class="sx-invite-form" id="door-invite" data-form="invite" >/);
});

test('쓰던 의뢰서가 있으면 문 판 아래 말이 「쓰던 의뢰서가 있어요 · 이어 쓰기」로 바뀐다',()=>{
  const door=doorOf(entryView({resume:true}));
  assert.match(door,/<span class="sx-small" data-door-ask data-start-note>쓰던 의뢰서가 있어요<\/span><button type="button" class="sx-go sx-door-start" data-entry="start"><span data-start-label>쓰던 의뢰서 이어 쓰기<\/span>/);
  assert.ok(read('film-home.mjs').includes("$$('[data-door-ask]').forEach(node=>{node.textContent=doorAsk(resume);});"),'이미 그려진 화면도 따라 바뀐다');
});

test('복도: 캐스팅북 모델(실제 인물 없이) 사이에 세로 완성 광고, 그림 · 영상은 캐스팅북 주소, 세 벌 중 가운데 벌만 화면 읽기에',()=>{
  const items=hallItems(),models=items.filter(item=>item.kind==='model'),films=items.filter(item=>item.kind==='film');
  assert.deepEqual(models.map(item=>item.id).sort(),[...MOVING_MODELS].sort(),'움직이는 모델 스물 — M03 없음');
  assert.equal(inHall('M03'),false);assert.equal(inHall('F02'),true);
  assert.equal(models[0].id,'F02','하린부터');
  for(const item of models){assert.equal(item.still,`${MODEL_FILM_BASE}img/${item.id}/wall.webp`);assert.equal(item.walk,`${MODEL_FILM_BASE}video/${item.id}-loop.mp4`);}
  for(const item of films)assert.equal(FINISHED_FILMS.find(film=>film.id===item.id)?.orientation,'portrait',item.id);
  assert.ok(films.length>=5);
  const html=hallView(items),n=items.length;
  assert.equal((html.match(/class="sx-hall-strip /g)||[]).length,n*3);
  assert.equal((html.match(/ aria-hidden="true" aria-label=/g)||[]).length,n*2,'바깥 두 벌은 화면 읽기에서 뺀다');
  assert.equal((html.match(/data-hall-i="\d+" data-hall-id="[^"]+" tabindex="-1"/g)||[]).length,n*3,'Tab은 처음부터 띠에 걸리지 않고, 가운데 한 칸만 hall.mjs가 연다');
  const first=Number(html.match(/data-first="(\d+)"/)[1]);assert.ok(first>=n&&first<n*2,'가운데 벌에서 시작');
  assert.match(html,/<button type="button" class="sx-hall-hold sx-small" data-hall-hold>자동 넘김 멈추기<\/button>/,'저절로 넘기는 것을 멈출 수 있다(이름만 바뀐다 — 눌림 상태를 함께 바꾸면 화면 읽기가 뜻을 뒤집는다)');
  assert.doesNotMatch(html,/style=/,'style 속성 글자 없음(CSP)');
});

test('복도의 움직임: 손이 닿거나 초점이 안에 있거나 숨은 탭 · 움직임 줄이기면 넘기지 않고, 손을 올려도 띠를 옮기지 않는다',()=>{
  const hall=read('hall.mjs');
  assert.ok(hall.includes("const busy=()=>held||alone||gone||quiet()||document.hidden||reduced()||Date.now()<pause||(canHover()&&box.matches(':hover'))||!!box.querySelector(':focus-visible');"),'키보드 초점일 때만 멈춘다 — 누른 단추가 초점을 쥐어도 다시 넘어간다. 손을 올린 멈춤은 마우스 화면에서만(터치는 누른 뒤에도 :hover가 남는다)');
  assert.ok(hall.includes("if(box.querySelector(':focus-visible')&&document.activeElement!==holdButton)strip.focus({preventScroll:true});"),'저절로 넘길 때 초점을 끌고 다니지 않는다 — 키보드 초점일 때만 새 띠로 옮긴다');
  assert.ok(hall.includes("const canHover=()=>typeof matchMedia==='function'&&matchMedia('(hover:hover)').matches;"));
  assert.match(read('film.css'),/\.sx-models-m\{display:none\}/,'휴대폰용 「내 모델」은 넓은 화면에서 숨는다');
  assert.doesNotMatch(hall,/mouseenter|pointerenter/,'손을 올린다고 띠가 움직이지 않는다(큰 움직임 멀미)');
  assert.ok(hall.includes("if(alone||!['ArrowLeft','ArrowRight'].includes(event.key)||event.target===holdButton)return;"),'좌우 화살표는 복도 안에서만');
  const home=read('film-home.mjs');
  assert.ok(home.includes("const quiet=()=>hold||current!==0||!!screening;"),'1쪽 밖 · 상영 · 덮개 아래에서는 넘기지도 않는다');
  assert.ok(home.includes("still:()=>quiet()||reduced()||slowData()||!pageLoaded()"),'그때와 데이터 절약 · load 전에는 영상 없이');
  assert.ok(home.includes('linkForm.after(phone);'),'휴대폰 「내 모델」은 링크 칸 뒤');
  assert.match(read('film.css'),/\.sx-hall-track\.is-still,\.sx-hall-track\.is-still :is\(\.sx-hall-strip,\.sx-hall-tag\)\{transition:none\}/,'조용히 옮길 때 띠 폭 · 이름표 전환도 끈다');
  assert.ok(home.includes("const reelApi=mountReel($('[data-reel]'),{held:true});"),'쇼릴은 1쪽에서 받지 않는다');
  const css=read('film.css');
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\.sx-hall-track,\.sx-hall-strip,\.sx-hall-tag\{transition:none\}/);
});

test('들어가는 순간: 성공 경로에서만, 1.8초 안에 끝나고, 떼어지거나 숨은 탭 · 움직임 줄이기면 바로 끝나며, 기다린 뒤 요청을 다시 대조한다',()=>{
  const app=read('app.mjs'),home=read('film-home.mjs');
  assert.ok(app.includes("accept(result);s.entryError=null;if(entryHandle&&s.project){await Promise.all([entryHandle.arrive(arrivalModel(s.project),{title:s.project.title||''}),s.mode==='customer'?ensureLegacyCss():null]);if(requestEpoch!==epoch)return;}}booting=false;"));
  assert.ok(app.includes("return castingOf(r,p.studio?.strategy?.data?.castingSelection).modelId||r.directionProposal?.modelId||(r.modelProposal?.status==='open'?r.modelProposal.modelId:'')||'';"),'고른 모델 → 방향 제안 → 열린 모델 제안');
  assert.ok(home.includes("if(gone||!hallApi||!inHall(id)||reduced()||document.hidden){done();return;}"));
  assert.ok(home.includes("if(host.contains(document.activeElement))document.activeElement.blur?.();")&&home.includes("sections[0].scrollIntoView({behavior:'auto',block:'start'});"),'늘 1쪽 맨 위에서, 입력 초점을 떼고');
  assert.ok(home.includes("arriving?.();arriving=done;timer=setTimeout(done,1800);"));
  assert.ok(home.includes("screening?.close();reelApi.stop();hallApi?.stop();arriving?.();"),'떼어지면 기다림이 끝난다');
  // 메일로 열기 확인 결과는 문 판이 받는다(꺼지면 링크 칸을 편다).
  assert.ok(app.includes("entryHandle.mail?.(!!mailOpenAvailable);"));
  assert.ok(home.includes("box.hidden=!available;linkButton.hidden=!available;if(!available){showLink(true);"));
});
