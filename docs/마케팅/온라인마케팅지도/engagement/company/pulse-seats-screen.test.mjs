// PULSE 운영 조각 6-B(2026-11-13, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2 「정원 · 예약」) — 화면 · 메일 쪽 약속.
// 손님: 대기까지 차면 첫 화면의 「광고 의뢰하기」 자리에 「지금은 예약이 찼어요」, 제작 자리가 찬 동안은 의뢰서 첫 질문 · 결제 카드에 「결제 안내는 ○일쯤」 한 줄,
// 날짜 없이 굳힌 방향 제안은 「결제한 날부터 N일」(방 · 자동 답 사실 · 메일이 같은 말). 직원: 첫 화면 자리 한 줄 · 자리 고치기 칸, 결제 칸 자리 줄 · 창 경고, 방향 창의 빈 날.
// 서버 쪽(자리 세기 · 설정 길 · 시작 409 · 날짜 없는 제안 굳히기)은 pulse-seats.test.mjs · pulse-presale-server.test.mjs 「운영 조각 6-B」가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pulseMailCompose} from './pulse-mail.mjs';
import {customerRoomFacts} from './pulse-room-facts.mjs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {entryView,applyEntryIntake}=await import('./public/pulse-app/film-home.mjs');
const {roomModel,directionModel,deskModel}=await import('./public/pulse-app/room-view.mjs');
const {roomView,directionView}=await import('./public/pulse-app/film-views.mjs');
const {deskView}=await import('./public/pulse-app/desk-view.mjs');
const {picker,welcome,dialogContent}=await import('./public/pulse-app/views.mjs');
const {seatText}=await import('./public/pulse-app/request-flow.mjs');
const {setLocale}=await import('./public/pulse-app/i18n.mjs');
const {emptyAnswers}=await import('./public/pulse-app/request-data.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
// 날짜는 올해로 잡는다(해가 다르면 「2027년 …」이 붙는다 — 시험이 해 바뀜에 흔들리지 않게).
const YEAR=new Date().getFullYear(),D=(m,d)=>`${YEAR}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

const FULL={state:'full',kinds:['video','photo'],noticeDate:''};
const slots=html=>[...html.matchAll(/<div class="sx-paused" data-paused( data-paused-works)? data-in tabindex="-1" data-key="([^"]*)"( hidden)?>(.*?)<\/div>/gs)].map(m=>({works:!!m[1],key:m[2].replaceAll('&quot;','"'),hidden:!!m[3],inner:m[4]}));
const starts=html=>[...html.matchAll(/<button type="button" class="sx-go is-solid[^"]*" data-entry="start" data-in( hidden)?>/g)].map(m=>!!m[1]);

test('첫 화면: 대기까지 차면 「광고 의뢰하기」 두 자리에 「지금은 예약이 찼어요」가 서고 단추는 숨는다 — 담당자 글 없이, 날짜를 알면 그 무렵',()=>{
  const html=entryView({paused:FULL}),[one,end]=slots(html);
  assert.deepEqual(starts(html),[true,true]);
  for(const slot of [one,end]){
    assert.equal(slot.hidden,false);
    assert.match(slot.inner,/<p class="sx-paused-head">지금은 예약이 찼어요<\/p><p class="sx-small">자리가 나면 이 화면에서 바로 시작하실 수 있어요\.<\/p>/);
    assert.doesNotMatch(slot.inner,/sx-paused-note/);
  }
  assert.match(one.inner,/data-entry="works"/,'1쪽 안내에는 완성 광고 보기');
  assert.deepEqual(JSON.parse(one.key),['full','','ko']);
  const dated=slots(entryView({paused:{...FULL,noticeDate:D(11,20)}}))[0];
  assert.match(dated.inner,/<p class="sx-small">11월 20일쯤 자리가 나요\. 그때 이 화면에서 바로 시작하실 수 있어요\.<\/p>/,'요일 없이 「○월 ○일쯤」');
  assert.deepEqual(JSON.parse(dated.key),['full',D(11,20),'ko']);
  assert.match(slots(entryView({paused:{...FULL,noticeDate:'2026-02-30'}}))[0].inner,/자리가 나면 이 화면에서/,'달력에 없는 날은 날짜 없이');
  // 쓰던 의뢰서가 있으면 이어 쓰기 단추가 선다(보내기는 받는다).
  assert.deepEqual(starts(entryView({paused:FULL,resume:true})),[false,false]);
  // 앱의 첫 화면: full이면 안내, queue면 단추 그대로(의뢰서는 받는다 — 한 줄은 의뢰서 첫 질문에).
  assert.deepEqual(starts(welcome({intake:FULL})),[true,true]);
  assert.deepEqual(starts(welcome({intake:{state:'queue',kinds:['video'],noticeDate:''}})),[false,false]);
});

test('이미 그려진 첫 화면: 쉬는 안내에서 「예약이 찼어요」로 바뀌면 다시 그리고 단추는 숨은 채, 같은 상태는 다시 쓰지 않는다',()=>{
  const slot={hidden:true,writes:0,html:'',hasAttribute:()=>true,set innerHTML(value){this.writes++;this.html=value;}},button={hidden:false},say={textContent:''};
  const state={resume:false,paused:{state:'paused',until:'',note:'',noteEn:''},key:null},parts={starts:[button],notes:[],slots:[slot],say};
  applyEntryIntake(parts,state);assert.match(slot.html,/지금은 잠시 접수를 쉬어요/);
  state.paused=FULL;applyEntryIntake(parts,state);
  assert.equal(slot.writes,2);assert.match(slot.html,/지금은 예약이 찼어요/);assert.equal(button.hidden,true);
  assert.equal(say.textContent,'지금은 예약이 찼어요. 자리가 나면 이 화면에서 바로 시작하실 수 있어요.','화면 읽기에 한 번 알린다');
  applyEntryIntake(parts,state);assert.equal(slot.writes,2,'같은 상태는 다시 쓰지 않는다');
});

test('의뢰서 첫 질문의 한 줄: 찬 종류 · 결제 안내 무렵(모르면 「자리가 나는 대로」) — 앱이 공개 상태로 정해 넘기고, 대기까지 찼고 쓰던 초안이 없으면 의뢰서를 열지 않는다',()=>{
  assert.equal(seatText({kinds:['video'],noticeDate:''}),'지금은 영상 제작 자리가 차 있어요. 의뢰서는 그대로 받고, 결제 안내는 자리가 나는 대로 드려요.');
  assert.equal(seatText({kinds:['photo'],noticeDate:''}),'지금은 사진 제작 자리가 차 있어요. 의뢰서는 그대로 받고, 결제 안내는 자리가 나는 대로 드려요.');
  assert.equal(seatText({kinds:['video','photo'],noticeDate:D(11,20)}),'지금은 제작 자리가 차 있어요. 의뢰서는 그대로 받고, 결제 안내는 11월 20일쯤 드려요.');
  const flow=read('request-flow.mjs'),app=read('app.mjs');
  assert.ok(flow.includes("if(index===seatAt&&backend.seat)(form.querySelector('.sx-q-lead')||form.querySelector('[data-title]'))?.insertAdjacentHTML('afterend',"),'열어 처음 서는 질문에만, 안내 글 아래');
  assert.ok(app.includes("backend.seat=intake?.state==='queue'||intake?.state==='full'?{kinds:intake.kinds,noticeDate:intake.noticeDate}:null;"));
  assert.match(app,/if\(intake\?\.state==='full'&&!backend\.hasDraft\)\{if\(backend\.features\)await applyLocale\(backend\.features\);s\.intake=intake;s\.requestResume=false;.*?throw new PulseError\(t\('지금은 예약이 찼어요\. 자리가 나면 이 화면에서 다시 받아요\.'\),409,'SYNK_PULSE_INTAKE_FULL'\);\}/);
  // 공개 응답 읽기: 찬 종류는 video · photo만, 날짜는 YYYY-MM-DD만(다른 값은 빈 글자).
  assert.ok(app.includes("if(result?.state==='queue'||result?.state==='full')return {state:result.state,kinds:(Array.isArray(result.kinds)?result.kinds:[]).filter(kind=>kind==='video'||kind==='photo'),noticeDate:typeof result.noticeDate==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(result.noticeDate)?result.noticeDate:''};"));
  assert.match(read('film.css'),/\.sx-q-seat\{/);
});

test('첫 화면 · 의뢰서 한 줄 · 영어: 고정 문장은 영어로, 한글 없음, 날짜는 요일 없이',async()=>{
  await setLocale('en');
  try{
    const [one]=slots(entryView({paused:{...FULL,noticeDate:D(11,20)}}));
    assert.match(one.inner,/<p class="sx-paused-head">We’re fully booked right now<\/p><p class="sx-small">A spot should open up around Nov 20\. Once it does, you can start right here\.<\/p>/);
    assert.doesNotMatch(text(one.inner),/[가-힣]/);
    assert.match(slots(entryView({paused:FULL}))[0].inner,/Once a spot opens up, you can start right here\./);
    assert.equal(seatText({kinds:['photo'],noticeDate:''}),'Our photo production schedule is full right now. You can still send your brief, and payment details will follow as soon as a spot opens up.');
    assert.equal(seatText({kinds:['video','photo'],noticeDate:D(11,20)}),'Our production schedule is full right now. You can still send your brief, and payment details will follow around Nov 20.');
  }finally{await setLocale('ko');}
});

const T=hour=>new Date(Date.UTC(2026,10,12,hour)).toISOString();
const proposal=(extra={})=>({round:1,status:'open',lead:'',options:[{id:'o1',name:'아니, 잠깐',sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고'}],why:'',assetId:'',recommended:true},{id:'o2',name:'톡',sentence:'한 모금에 톡.',flow:[{at:'0:00',text:'캔을 따고'}],why:'',assetId:''}],modelId:'M06',price:290000,revisions:2,dueDate:'',seat:'queue',...extra});
const project=(request={},extra={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'request',revision:3,versions:[],messages:[],requestFlow:true,
  studio:{assets:[],scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:false,maxItems:20,nextNumber:1},
    request:{status:'confirmed',number:'P-2026-ABCD',submittedAt:T(0),confirmedAt:T(1),confirmedBy:'김하늘',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],rounds:[],paymentFlow:true,...request}},...extra});
const dueRow=p=>roomModel(p).brief.find(([key])=>String(key).includes('받으실 날'))?.[1];

const WAIT={seat:{state:'queue',noticeDate:''}};
test('방향 제안 · 고객 방: 자리가 모자란 때 날짜 없이 굳힌 제안은 「결제한 날부터 N일」과(지금도 자리를 기다릴 때만) 결제 안내가 미뤄진다는 말 — 방 · 자동 답 사실이 같은 줄',()=>{
  const p=project({directionProposal:proposal()},WAIT);
  const d=directionModel(p);assert.equal(d.due,'결제한 날부터 10일');assert.equal(d.queued,true);assert.equal(d.seatNote,true);
  const html=directionView(roomModel(p));
  assert.match(html,/<dl class="sx-dp-kv is-queued">/,'긴 받으실 날은 가운데 칸만 줄을 바꾼다(film.css)');
  assert.match(html,/<dd class="sx-serif">결제한 날부터 10일<\/dd>/);
  assert.match(html,/<p class="sx-small sx-dp-seat">제작 자리가 차 있어 결제 안내는 자리가 나는 대로 드려요\.<\/p>/);
  assert.equal(dueRow(p),'결제한 날부터 10일 · 결제 안내는 자리가 나는 대로 드려요');
  assert.equal(customerRoomFacts(p).due,dueRow(p),'자동 답 사실(pulse-room-facts)도 같은 줄');
  // 6-B 카본 A1: 굳힌 뒤 자리가 났으면(서버가 seat를 안 실음) 기간은 그대로 「결제한 날부터 N일」, 「결제 안내는 자리가 나는 대로」 말은 없다 — 방 · 자동 답 사실 같은 줄.
  const opened=project({directionProposal:proposal()});
  assert.equal(directionModel(opened).due,'결제한 날부터 10일');assert.equal(directionModel(opened).seatNote,false);
  const openedHtml=directionView(roomModel(opened));
  assert.match(openedHtml,/<dl class="sx-dp-kv is-queued">/,'줄 바꿈 칸은 굳힌 값으로');assert.doesNotMatch(openedHtml,/sx-dp-seat/);
  assert.equal(dueRow(opened),'결제한 날부터 10일');assert.equal(customerRoomFacts(opened).due,'결제한 날부터 10일');
  // 자리가 나서 결제 차례가 되면 머리 글 「이제 크몽에서 결제해 주세요」와 어긋나는 말이 같은 방에 없다.
  const payNow=roomView(roomModel(project({scriptApprovedAt:T(3),directionProposal:proposal({status:'chosen',chosenId:'o1'})})));
  assert.match(text(payNow),/이제 크몽에서 결제해 주세요/);assert.doesNotMatch(text(payNow),/결제 안내는 자리가 나는 대로|sx-dp-seat|sx-pay-seat/);
  // 날짜를 적어 보낸 제안 · 굳힘 없는 옛 제안은 그대로.
  const dated=project({directionProposal:proposal({dueDate:'2026-12-01',seat:undefined})});
  assert.equal(directionModel(dated).due,'12월 1일');assert.equal(directionModel(dated).queued,false);assert.doesNotMatch(directionView(roomModel(dated)),/sx-dp-seat|is-queued/);
  assert.equal(dueRow(dated),'12월 1일 · 방향 제안에 적힌 날');
  assert.equal(directionModel(project({directionProposal:proposal({seat:undefined})})).queued,false,'굳힘이 없으면 빈 날이어도 자리 말을 하지 않는다');
});

test('결제 카드: 서버가 이 건에 자리 대기(project.seat)를 실을 때만 「결제 안내는 ○일쯤」 한 줄 — 결제 요청을 보낸 뒤 · 자리가 나면 없다',()=>{
  const paying=(extra={},request={})=>roomModel(project({scriptApprovedAt:T(3),directionProposal:proposal({status:'chosen',chosenId:'o1',dueDate:'2026-11-24',seat:undefined}),...request},extra));
  const line=html=>html.match(/<p class="sx-small sx-pay-seat" data-seat>([^<]*)<\/p>/)?.[1]||'';
  const dated=paying({seat:{state:'queue',noticeDate:'2026-11-20'}});
  assert.equal(dated.state,'pay');
  // 머리 글도 같은 뜻 — 「이제 크몽에서 결제해 주세요」가 아니라 결제 요청이 자리가 나는 대로 온다는 말.
  assert.match(text(roomView(dated)),/지금은 제작 자리가 차 있어 결제 요청은 자리가 나는 대로 보내 드려요\. 그 전에 크몽에서 「문의하기」로 접수 번호를 보내 두시면 바로 이어져요\./);
  assert.doesNotMatch(text(roomView(dated)),/이제 크몽에서 결제해 주세요/);
  assert.match(text(roomView(paying())),/이제 크몽에서 결제해 주세요/,'자리가 있으면 그대로');
  assert.equal(line(roomView(dated)),'지금은 제작 자리가 차 있어요. 결제 안내는 11월 20일쯤 드려요.');
  assert.equal(line(roomView(paying({seat:{state:'queue',noticeDate:''}}))),'지금은 제작 자리가 차 있어요. 결제 안내는 자리가 나는 대로 드려요.');
  assert.equal(line(roomView(paying())),'','자리가 있으면 없다');
  assert.equal(line(roomView(paying({seat:{state:'queue',noticeDate:''}},{payment:{status:'requested',requestedAt:T(4),amount:290000}}))),'','결제 요청을 보낸 뒤에는 없다');
});

test('고객 방 · 영어: 날짜 없이 굳힌 제안의 받으실 날 · 결제 카드 줄도 영어',async()=>{
  await setLocale('en');
  try{
    const p=project({directionProposal:proposal()},WAIT);
    assert.equal(directionModel(p).due,'10 days after payment');
    assert.equal(roomModel(p).brief.map(([,value])=>value).find(value=>/after payment/.test(value)),'10 days after payment · payment details will follow as soon as a spot opens up');
    assert.match(directionView(roomModel(p)),/Our production schedule is full, so we’ll send payment details as soon as a spot opens up\./);
    const pay=roomView(roomModel(project({scriptApprovedAt:T(3),directionProposal:proposal({status:'chosen',chosenId:'o1',dueDate:'2026-11-24',seat:undefined})},{seat:{state:'queue',noticeDate:'2026-11-20'}})));
    assert.match(pay,/<p class="sx-small sx-pay-seat" data-seat>Our production schedule is full right now\. We’ll send payment details around Nov 20\.<\/p>/);
  }finally{await setLocale('ko');}
});

test('방향 제안 메일: 날짜 없이 굳힌 제안이면 결제 안내가 미뤄진다는 한 줄(영어도), 날짜가 있으면 없다',()=>{
  const row=dp=>({studio:{request:{answers:{name:'오미톡',package:'s15'},directionProposal:dp}}});
  const ko=pulseMailCompose(row(proposal()),'direction_proposed');
  assert.match(ko.body,/\n지금은 제작 자리가 차 있어 결제 안내는 자리가 나는 대로 드려요\. 기간은 결제한 날부터 세요\.\n/);
  assert.doesNotMatch(ko.body,/확인을 기다리는 날만큼/,'날짜가 없으니 늦어진다는 말도 없다');
  const en=pulseMailCompose(row(proposal()),'direction_proposed','en');
  assert.match(en.body,/\nOur production schedule is full right now, so we’ll send payment details as soon as a spot opens up\. The timeline starts on the day you pay\.\n/);
  const dated=pulseMailCompose(row(proposal({dueDate:'2026-12-01',seat:undefined})),'direction_proposed');
  assert.doesNotMatch(dated.body,/제작 자리/);assert.match(dated.body,/받으실 날\(12월 1일\)/);
  assert.doesNotMatch(pulseMailCompose(row(proposal()),'draft_ready').body,/제작 자리/,'다른 순간에는 붙이지 않는다');
});

const SEATS={video:{state:'queue',used:3,total:3,waiting:1},photo:{state:'open',used:1,total:5,waiting:0},queue:{used:1,total:6}};
const INTAKE={state:'open',open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:'',reopened:'',seats:{video:3,photo:5,queue:6},held:[{id:'h1',kind:'photo',note:'도담 건'}],seatsNow:SEATS,canEdit:true};
const base={mode:'staff',user:{id:'u1',name:'담당자'},workspace:{projects:[],canWrite:true}};

test('직원 첫 화면: 큰 숫자 아래 자리 한 줄(종류마다 제작 중/자리 · 대기), 관리자만 「자리 고치기」, 칸에는 자리 수 셋 · 잡은 자리 풀기 · 더하기',()=>{
  assert.doesNotMatch(picker({...base,staffIntake:{...INTAKE,seatsNow:undefined}}),/data-seats/,'자리 몫을 모르는 서버면 없다');
  const home=picker({...base,staffIntake:INTAKE});
  assert.match(text(home),/제작 자리 · 영상 3\/3 찼어요\(대기로 받는 중\) · 사진 1\/5 · 대기 1\/6 · 손으로 잡은 자리 1/);
  assert.match(home,/data-action="seats-sheet"/);assert.doesNotMatch(home,/data-form="pulse-seats"/);
  assert.doesNotMatch(picker({...base,staffIntake:{...INTAKE,canEdit:false}}),/seats-sheet/,'크루에게는 숫자만');
  assert.doesNotMatch(picker({...base,staffIntake:{...INTAKE,canEdit:false},seatsSheet:true}),/data-form="pulse-seats"/,'크루는 칸을 열 수 없다');
  const sheet=picker({...base,staffIntake:INTAKE,seatsSheet:true});
  for(const [name,value] of [['video','3'],['photo','5'],['queue','6']]){
    const input=sheet.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))[0];
    assert.match(input,/type="number"/);assert.match(input,/min="0" max="50" step="1"/);assert.match(input,/required/);assert.match(input,new RegExp(`value="${value}"`));
  }
  assert.match(sheet,/data-form="pulse-held"/);assert.match(sheet,/<select name="kind"><option value="video">영상<\/option><option value="photo">사진<\/option><\/select>/);
  assert.match(sheet,/data-action="seat-held-remove" data-id="h1" data-mutate>풀기<\/button>/);
  assert.match(sheet,/<input[^>]*name="note"[^>]*maxlength="80"/);
  assert.doesNotMatch(sheet,/data-action="seats-sheet"/,'칸을 연 동안은 여는 단추가 없다');
  assert.match(text(picker({...base,staffIntake:{...INTAKE,seatsNow:{...SEATS,video:{state:'full',used:3,total:3,waiting:6},queue:{used:6,total:6}}}})),/영상 3\/3 대기까지 찼어요/);
  // 연결: 자리 수 저장은 칸을 닫고, 잡은 자리 더하기 · 풀기는 칸을 연 채 둔다. 다른 화면으로 가면 칸은 닫힌다.
  const app=read('app.mjs');
  assert.ok(app.includes("if(type==='pulse-seats'){await seatsSave('seats',{video:Number(values.video),photo:Number(values.photo),queue:Number(values.queue)},"));
  assert.ok(app.includes("{form,close:true});return;}"));
  assert.ok(app.includes("if(action==='seat-held-remove'){void seatsSave('held',{remove:id},"));
  assert.ok(app.includes("const staffIntakeKey=intake=>JSON.stringify([intake?.state,intake?.pausedUntil,intake?.pauseNote,intake?.pauseNoteEn,intake?.reopened,intake?.canEdit,intake?.seats,intake?.held,intake?.seatsNow]);"),'자리 숫자가 바뀌면 화면으로 돌아올 때 다시 그린다');
  assert.match(read('staff.css'),/html\.is-staff \.staff-seats\{/);
});

test('직원 결제 칸 · 창: 결제 전이면 이 건 종류의 자리 줄, 차례를 기다리는 건은 손님 화면 말까지 · 결제 요청 · 확인 창에 경고(막지 않음)',()=>{
  const desk=(extra,request={})=>deskView({...deskModel(project({scriptApprovedAt:T(3),...request},extra)),queue:[]},{bar:false});
  assert.match(desk({seat:{state:'queue',noticeDate:''},seats:SEATS}),/<p class="desk-at desk-seat is-wait">제작 자리 영상 3\/3 · 대기 1\/6 · 이 건은 자리 차례를 기다려요\(손님 화면: 결제 안내 자리가 나는 대로\)<\/p>/);
  // 6-B 카본 A2: 날은 손님 결제 카드 줄과 같은 꼴(요일 · 연도 없이), 결제 요청을 보낸 뒤에는 손님 화면 말 대신 「결제 요청은 보냄」.
  assert.match(desk({seat:{state:'queue',noticeDate:'2026-11-20'},seats:SEATS}),/이 건은 자리 차례를 기다려요\(손님 화면: 결제 안내 11월 20일쯤\)<\/p>/);
  assert.match(desk({seat:{state:'queue',noticeDate:''},seats:SEATS},{payment:{status:'requested',requestedAt:T(4),amount:290000}}),/이 건은 자리 차례를 기다려요\(결제 요청은 보냄\)<\/p>/);
  assert.deepEqual(deskModel(project({},{seat:{state:'queue',noticeDate:'2026-11-05'}})).seat,{noticeDate:'2026-11-05',when:'11월 5일쯤'});
  assert.equal(deskModel(project({},{seat:{state:'queue',noticeDate:'깨진 날'}})).seat.when,'자리가 나는 대로');
  assert.match(desk({seats:SEATS}),/<p class="desk-at desk-seat">제작 자리 영상 3\/3 · 대기 1\/6<\/p>/);
  assert.match(desk({seats:SEATS},{answers:{...emptyAnswers(),name:'오미톡',package:'photo'}}),/제작 자리 사진 1\/5/,'사진 건은 사진 자리');
  assert.doesNotMatch(desk({seats:SEATS},{payment:{status:'confirmed',confirmedAt:T(4),amount:290000,dueDate:'2026-12-01'}}),/desk-seat/,'결제 확인 뒤에는 없다');
  assert.doesNotMatch(desk({}),/desk-seat/,'자리 표를 모르는 서버');
  // 결제 요청 창: 자리 경고를 띄웠을 때만 확인 표시(overSeat)를 함께 보낸다 — 서버는 자리 대기 건에 이 확인이 있어야 받는다(서버 검수 GA1).
  assert.match(dialogContent('desk-pay-request',{number:'P',amount:290000,seatWarn:'이 건은 아직'}),/<p class="form-note desk-seat-warn" role="note">이 건은 아직<\/p><form data-form="desk-pay-request"><input type="hidden" name="overSeat" value="1">/);
  assert.doesNotMatch(dialogContent('desk-pay-request',{number:'P',amount:290000}),/overSeat/,'경고가 없으면 확인도 없다');
  assert.doesNotMatch(dialogContent('desk-pay-confirm',{seatWarn:'이 건은 아직'}),/overSeat/,'결제 확인은 경고만');
  assert.ok(read('app.mjs').includes(",over=values.overSeat==='1';await mutate(()=>studioAction('payment_request',{amount,...(over?{overSeat:true}:{})})"));
  assert.match(dialogContent('desk-pay-confirm',{seatWarn:'이 건은 아직'}),/desk-seat-warn" role="note">이 건은 아직<\/p><form data-form="desk-pay-confirm">/);
  assert.doesNotMatch(dialogContent('desk-pay-confirm',{}),/desk-seat-warn/);
  // 요청 · 확인 창에만, 막지 않고 경고만 — 창마다 그 동작에 맞는 말(6-B 카본 A2: 확인 창은 손님에게 보내는 창이 아니다), 손님 화면 말은 결제 카드 줄 그대로(조사는 「줄이」).
  const app=read('app.mjs');
  assert.ok(app.includes("...(model.seat&&action==='desk-pay-request'?{seatWarn:model.payment?.status==='requested'?")&&app.includes(":`이 건은 아직 제작 자리 차례가 아니에요(${seatCount(s.project)}). 손님 화면에는 「결제 안내는 ${model.seat.when} 드려요」 줄이 떠 있어요. 그래도 보내면 자리 수를 넘겨 받아요.`}"));
  assert.ok(app.includes(":model.seat&&action==='desk-pay-confirm'?{seatWarn:`이 건은 아직 제작 자리 차례가 아니에요(${seatCount(s.project)}). 결제를 확인하면 자리 수를 넘겨 제작을 시작해요.`}:{})"));
});

test('직원 방향 창: 이 건이 자리 차례를 기다리면 받으실 날을 비워 보낼 수 있고(새 제안의 기본도 빈 날), 아니면 지금처럼 필수',()=>{
  const date=html=>html.match(/<input[^>]*name="dueDate"[^>]*>/)[0];
  const plain=dialogContent('desk-direction',{round:1,models:[],price:290000,dueDate:'2026-11-24',revisions:2});
  assert.match(date(plain),/required/);assert.doesNotMatch(plain,/desk-seat-warn/);
  const seat=dialogContent('desk-direction',{round:1,models:[],price:290000,dueDate:'',revisions:2,seatUndated:true,seat:'제작 자리가 차 있어요(영상 3/3 · 대기 1/6).'});
  assert.doesNotMatch(date(seat),/required/);assert.match(date(seat),/value=""/);
  assert.match(seat,/받으실 날 · 비워 두면 「결제한 날부터 며칠」로 보내요/);assert.match(seat,/desk-seat-warn" role="note">제작 자리가 차 있어요/);
  // 6-B 화면 Fable F1: 기간이 정해지지 않은 구성(기업 · 추천)은 대기여도 받으실 날이 필수 — 비운 채 굳히면 손님 받으실 날 칸이 빈다.
  const corp=dialogContent('desk-direction',{round:1,models:[],price:290000,dueDate:'2026-11-28',revisions:2,seat:'제작 자리가 차 있어요(영상 3/3 · 대기 1/6). 이 구성은 기간이 정해져 있지 않아 받으실 날을 꼭 적어 주세요.'});
  assert.match(date(corp),/required/);assert.doesNotMatch(corp,/비워 두면/);assert.match(corp,/desk-seat-warn" role="note">제작 자리가 차 있어요\(영상 3\/3 · 대기 1\/6\)\. 이 구성은 기간이 정해져 있지 않아/);
  const app=read('app.mjs');
  assert.ok(app.includes("dueDate:s.project.seat&&pkg?.days?'':today.toISOString().slice(0,10),revisions:pkg?.revisions??3})"),'기간이 있는 구성의 새 제안만 기본 날을 비운다');
  assert.ok(app.includes("...(s.project.seat&&pkg?.days?{seatUndated:true,seat:`제작 자리가 차 있어요(${seatCount(s.project)}). 받으실 날을 비우고 보내면 손님에게 「결제한 날부터 ${pkg.days}일 · 결제 안내는 자리가 나는 대로」로 보여요. 날짜를 적으면 그 날로 약속해요.`}:s.project.seat?{seat:`제작 자리가 차 있어요(${seatCount(s.project)}). 이 구성은 기간이 정해져 있지 않아 받으실 날을 꼭 적어 주세요.`}:{}),"));
  assert.doesNotMatch(app,/'며칠'\}일/,'「며칠일」 같은 말이 없다');
});

test('6-B 화면 Fable F2 · F3 · F4 · F5: 쓰던 의뢰서는 연 단계에 자리 한 줄 · 낡은 자리로 409면 프로젝트를 다시 읽음 · 요청을 보낸 뒤 다시 적는 창의 말 · 잡은 자리 메모 필수',()=>{
  const flow=read('request-flow.mjs'),app=read('app.mjs');
  assert.ok(flow.includes('const seatAt=index;')&&flow.includes("if(index===seatAt&&backend.seat)(form.querySelector('.sx-q-lead')"),'이번에 열어 처음 서는 단계(쓰던 의뢰서는 저장된 단계)');
  assert.ok(app.includes(".catch(async error=>{if(error?.code==='SYNK_PULSE_SEAT_WAIT'&&s.project)await loadProject(s.project.id).catch(()=>{});throw error;})"),'자리 확인 409만(판 번호 충돌 409는 아님 — 다시 검수 P3) 다시 읽어 창을 다시 열면 경고가 선다');
  assert.ok(app.includes("seatWarn:model.payment?.status==='requested'?`이 건은 아직 제작 자리 차례가 아니에요(${seatCount(s.project)}). 결제 요청은 이미 보냈어요 — 다시 적어도 자리 수를 넘겨 받아요.`:"),'요청을 보낸 뒤에는 손님 화면 줄 말을 하지 않는다');
  const sheet=picker({...base,staffIntake:INTAKE,seatsSheet:true});
  assert.match(sheet,/<input[^>]*name="note"[^>]*required/);assert.match(sheet,/메모\(꼭\) · 직원만 봐요/);
});

test('6-A 뒤 손질(Fable F1 · F2): 같은 날이면 창 안 알림(뒤 알림 칸은 대화상자에 가린다) · 납품 · 보관한 건에는 「받으실 날 고치기」가 없다',()=>{
  assert.ok(read('app.mjs').includes("showMutationError('지금 받으실 날과 같아요. 바꿀 날을 골라 주세요.');form.querySelector('[name=dueDate]')?.focus();return;"));
  const confirmed={status:'confirmed',requestedAt:T(2),confirmedAt:T(3),amount:290000,dueDate:'2026-12-02'};
  const desk=stage=>deskView({...deskModel(project({payment:confirmed,dueChange:true},{stage})),queue:[]},{bar:false});
  assert.match(desk('producing'),/data-action="desk-due"/);
  for(const stage of ['delivered','archived'])assert.doesNotMatch(desk(stage),/desk-due/,stage);
});
