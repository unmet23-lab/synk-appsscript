import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PACKAGES,termsOf,dueDay,revisionNote,briefRows,emptyAnswers,KINDS} from './public/pulse-app/request-data.mjs';
import {roomModel,deskChecks} from './public/pulse-app/room-view.mjs';
import {roomRail,roomView} from './public/pulse-app/film-views.mjs';

// 고객 앱 안쪽 재개발 판 1a(2026-11-07, docs/마케팅/PULSE_의뢰흐름_20261104/판1_설계.md): 기간 · 수정 한 줄, 뒷문, 작은 조각.
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');

test('every package shows the same days and revisions as the price table and the shop listing (decision 11-07)',()=>{
  const of=id=>PACKAGES.find(item=>item.id===id);
  assert.deepEqual(['s15','s30','s60','photo'].map(id=>[of(id).days,of(id).revisions]),[[10,2],[14,3],[21,3],[3,2]]);
  assert.equal(of('corp').days,undefined,'company campaigns are agreed case by case');
  assert.equal(termsOf(of('s15')),'10일 · 수정 2회','the count never breaks from its word');
  assert.equal(termsOf(of('corp')),'기간 · 수정 협의');assert.equal(termsOf(null),'');
  assert.match(revisionNote(of('s15')),/^영상이 나온 뒤 2번\. 글 콘티 · 장면 이미지 의견은 세지 않아요$/);
  assert.equal(revisionNote(of('photo')),'사진이 나온 뒤 2번. 첫 장으로 방향을 맞춘 뒤 나머지를 만들어요','photo orders have no script or scene stage (fable F2)');
  for(const item of PACKAGES)assert.ok(item.gets,`${item.id} says what the customer receives`);
});
test('the receiving day counts calendar days and rolls over months and years',()=>{
  const s15=PACKAGES.find(item=>item.id==='s15'),s60=PACKAGES.find(item=>item.id==='s60');
  assert.equal(dueDay(s15,new Date(2026,10,7)),'11월 17일');
  assert.equal(dueDay(s15,new Date(2026,10,25)),'12월 5일');
  assert.equal(dueDay(s60,new Date(2026,11,20)),'1월 10일');
  assert.equal(dueDay(PACKAGES.find(item=>item.id==='corp'),new Date(2026,10,7)),'');
  assert.equal(dueDay(s15,'not a date'),'');
});
test('the request form shows days and revisions next to the price and before sending, without promising a date it cannot keep',()=>{
  const flow=read('request-flow.mjs');
  assert.match(flow,/meta:`<span class="sx-small">\$\{price\(item\.price\)\}부터<\/span><span class="sx-small sx-row-terms">\$\{esc\(termsOf\(item\)\)\}<\/span>`/);
  assert.match(flow,/오늘 다 모이면 <b>\$\{esc\(dueDay\(pkg\)\)\}<\/b>이에요/,'only the check before sending names a day, and only on a condition');
  assert.match(flow,/\['받으실 날',pkg\?\.days\?`자료가 다 모인 날부터 \$\{pkg\.days\}일`/,'the receipt carries the rule, not a date');
  assert.match(flow,/data-cuts-line \$\{pkg\?'':'hidden'\}/,'no 「컷 0」 before a length is picked');
  assert.ok(flow.includes("['수정',pkg&&!pkg.days?'구성에 맞춰 함께 정해요':revisionNote(pkg)]"),'a company campaign receipt still says how revisions are agreed (argon A4)');
  const a={...emptyAnswers(),name:'오미톡',kind:'food',package:'s15'};
  assert.equal(briefRows(a).find(row=>row.key==='길이 · 구성').value,'15초 · 한 편 · 39만원부터 · 10일 · 수정 2회');
});
test('example model shots under a kind are labelled as examples, not as a chosen model',()=>{
  for(const kind of KINDS.filter(item=>/model-scene/.test(item.shot)))assert.match(kind.who,/^예시 장면 · /,kind.id);
});
const roomProject=(extra={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',versions:[],messages:[],requestFlow:true,studio:{assets:[],scenes:[],strategy:{revision:1,data:{},request:null,confirmation:null},request:{status:'submitted',number:'P-2026-ABCD',submittedAt:'2026-11-07T03:00:00.000Z',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],notes:[],rounds:[],...extra}}});
test('the room lists the receiving rule under length and price, and says the date comes with the direction',()=>{
  const brief=roomModel(roomProject()).brief,at=brief.findIndex(([key])=>key==='길이 · 구성');
  assert.deepEqual(brief[at+1],['받으실 날','자료가 다 모인 날부터 10일 · 날짜는 방향을 보내 드릴 때 알려 드려요']);
  assert.equal(roomModel(roomProject({submittedAt:''})).brief.some(([key])=>key==='받으실 날'),false,'a draft has no receiving line');
});
test('the room never sends its customer to the old strategy form, and the desk warns when one was requested',()=>{
  const views=read('views.mjs');
  assert.doesNotMatch(views,/title:'제작 설계를 확인해 주세요'/);
  assert.match(views,/const body=room&&s\.tab==='strategy'\?'':/);
  assert.match(views,/const body=overview\|\|films\|\|room&&s\.tab==='strategy'\?'':/);
  const p=roomProject();p.studio.strategy={revision:2,data:{},request:{strategyRevision:2},confirmation:null};
  assert.ok(deskChecks(p).some(item=>item.label==='고객 방에는 제작 설계 확인이 보이지 않아요'));
  assert.equal(deskChecks(roomProject()).some(item=>/제작 설계/.test(item.label)),false);
});
test('asking before any video keeps the room rail on the current stage and marks the question as where you are',()=>{
  const model=roomModel(roomProject()),rail=roomRail(model,{tab:'contact'});
  assert.match(rail,/class="sx-step is-now"  [^>]*data-room-go="check"/,'the stage stays lit without claiming to be the page');
  assert.equal(rail.split('aria-current="page"').length-1,1,'only the question is the current place (argon A1)');
  assert.match(rail,/class="is-now" aria-current="page" data-room-do="contact">담당자에게 묻기/);
  assert.doesNotMatch(roomRail(model),/data-room-do="contact" aria-current/);
  const views=read('views.mjs');
  assert.match(views,/\$\{isCustomerRoom\(s\)\?roomRail\(roomInfo\(s\),\{tab:'contact'\}\):stepsOf\(s,nextOf\(s\)\)\}/);
  const ask=views.slice(views.indexOf('function askRoom('),views.indexOf('function deliveryRoom('));
  assert.doesNotMatch(ask,/refresh/,'the question screen has no standing refresh link (live updates bring answers)');
  assert.match(roomView(model),/data-room-brief/);
});
test('pictures carry their words on a shade, not in a black box',()=>{
  const css=read('film.css');
  for(const rule of [/\.sx-q-cap\{[^}]*\}/,/\.sx-room-cap\{position:absolute[^}]*\}/,/\.sx-q-top-right\{[^}]*\}/])assert.doesNotMatch(css.match(rule)[0],/background:#000/);
  assert.match(css,/\.sx-q-screen::before\{content:'';[^}]*linear-gradient/);
  assert.match(css,/\.sx-room-screen\.sx-ask-thread::after\{display:none\}/,'the question thread is text, not a picture (argon A2)');
  assert.match(css,/\.sx-row\.is-on \.sx-row-meta \.sx-row-terms\{color:var\(--sx-dim\)\}/,'wins over the generic on-row colour (argon A3)');
  assert.match(css,/\.sx-room-screen::after\{content:'';[^}]*linear-gradient/);
  assert.match(css,/\.sx-q-progress,\.sx-q-parts\{display:none!important\}/,'one progress mark per screen');
  assert.match(css,/\.sx-rows\.is-tight\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);column-gap:18px\}/,'all six lengths sit above the next button on a low laptop (fable F1)');
  assert.match(css,/@media \(max-width:860px\)\{\.sx-q-screen::after\{content:'';[^}]*linear-gradient\(0deg/,'the phone credit under the picture gets its own shade (fable F3)');
  assert.match(css,/@media \(min-width:861px\) and \(max-height:760px\)\{\.sx-rows\.is-kinds\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
