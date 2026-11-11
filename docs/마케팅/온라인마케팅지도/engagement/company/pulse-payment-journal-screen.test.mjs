// PULSE 운영 조각 2-A(2026-11-11, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S1 「함께 메우는 빈칸」 ① ②) — 화면 쪽 약속.
// ① 일지에 결제 요청 · 확인 · 취소 줄: 서버의 paymentTrail(종류 · 때 · 값 · 받으실 날뿐)로, 옛 서버(칸 없음)는 지금 결제 상태의 때로 그린다.
// ② 영상 단계에 「수정 n회 중 k회 남았어요」를 시안을 보는 동안 늘 — 세는 법은 의견 보내기 확인 창과 같다(보낸 의견 묶음 하나가 한 회).
// 서버 쪽(손님 보기 허용 목록)은 pulse-presale-server.test.mjs 「결제 줄」 시험이 본다. 실제 그림(1440 · 390 넘침)은 브라우저 확인이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {journalModel}=await import('./public/pulse-app/room-view.mjs');
const {journalView}=await import('./public/pulse-app/film-views.mjs');
const {feedbackRoundsColumn}=await import('./public/pulse-app/feedback-rounds-view.mjs');
const {setLocale}=await import('./public/pulse-app/i18n.mjs');
const {emptyAnswers}=await import('./public/pulse-app/request-data.mjs');

const T=hour=>new Date(Date.UTC(2026,10,12,hour)).toISOString();
const project=(request={},extra={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'planning',revision:3,versions:[],messages:[],requestFlow:true,
  studio:{assets:[],scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:false,maxItems:20,nextNumber:1},
    request:{status:'confirmed',number:'P-2026-ABCD',submittedAt:T(0),confirmedAt:T(1),confirmedBy:'김하늘',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],rounds:[],...request}},...extra});
const pay=j=>j.items.filter(item=>item.id.startsWith('p:'));
// 다시 요청한 결제: 요청 → (24시간 무응답) 취소 → 다시 요청 → 확인. 서버가 내리는 꼴 그대로.
const TRAIL=[{kind:'requested',at:T(2),amount:290000},{kind:'cancelled',at:T(3),amount:290000},{kind:'requested',at:T(4),amount:300000},{kind:'confirmed',at:T(5),amount:300000,dueDate:'2026-11-22'}];

test('일지 결제 줄: 다시 요청해도 앞 요청 · 취소 줄이 남고, 새 것이 위, 줄마다 담당자 이름 · 값 · 받으실 날',()=>{
  const j=journalModel(project({payment:{status:'confirmed',requestedAt:T(4),confirmedAt:T(5),amount:300000,dueDate:'2026-11-22'},paymentTrail:TRAIL}));
  const lines=pay(j);
  assert.deepEqual(lines.map(line=>line.what),['결제를 확인했어요 · 받으실 날 11월 22일','크몽 결제 요청을 보냈어요 · 30만원','결제 요청을 취소했어요','크몽 결제 요청을 보냈어요 · 29만원']);
  assert.ok(lines.every(line=>line.who==='staff'&&line.name==='김하늘'&&line.kind==='event'),'담당자가 한 일 — 이름은 이 프로젝트의 담당자(손님 보기에는 결제한 담당자 이름이 없다)');
  assert.ok(lines.every(line=>line.go===null),'결제가 끝났으면 결제 카드로 가는 줄이 없다');
  assert.equal(new Set(j.items.map(item=>item.id)).size,j.items.length,'줄 id가 겹치지 않는다');
  const refunded=pay(journalModel(project({payment:{status:'cancelled',requestedAt:T(4),confirmedAt:T(5),cancelledAt:T(6),amount:300000},paymentTrail:[...TRAIL,{kind:'cancelled',at:T(6),amount:300000}]})));
  assert.deepEqual(refunded.slice(0,3).map(line=>line.what),['결제를 취소했어요','결제를 확인했어요 · 받으실 날 11월 22일','크몽 결제 요청을 보냈어요 · 30만원'],'확인한 결제의 취소(환불)는 결제 취소, 앞의 요청 취소는 결제 요청 취소');
  assert.equal(refunded[3].what,'결제 요청을 취소했어요');
  // 다른 줄 사이 제자리(때 순서): 의뢰서 확인(T1)보다 위.
  const ids=j.items.map(item=>item.id);
  assert.ok(ids.indexOf('q:ok')>ids.indexOf('p:requested:'+T(2)));
  assert.equal(j.latestAt,Date.parse(T(5)),'결제 확인도 「새 소식」으로 센다');
});

test('일지 결제 줄: 아직 열린 마지막 요청 줄만 결제 카드(고객 방)로 가고, 값이 없거나 받으실 날이 없으면 그 조각을 빼고 쓴다',()=>{
  const open=pay(journalModel(project({payment:{status:'requested',requestedAt:T(4),amount:300000},paymentTrail:TRAIL.slice(0,3)})));
  assert.deepEqual(open.map(line=>[line.what,line.go]),[['크몽 결제 요청을 보냈어요 · 30만원',{tab:'overview'}],['결제 요청을 취소했어요',null],['크몽 결제 요청을 보냈어요 · 29만원',null]]);
  const bare=pay(journalModel(project({payment:{status:'confirmed',confirmedAt:T(5)},paymentTrail:[{kind:'confirmed',at:T(5)}]})));
  assert.deepEqual(bare.map(line=>line.what),['결제를 확인했어요']);
  // 취소된 요청이 마지막이면 갈 곳이 없다.
  const cancelled=pay(journalModel(project({payment:{status:'cancelled',requestedAt:T(2),cancelledAt:T(3),amount:290000},paymentTrail:TRAIL.slice(0,2)})));
  assert.ok(cancelled.every(line=>line.go===null));
});

test('일지 결제 줄: 옛 서버(paymentTrail 없음)는 지금 결제 상태의 때로 그린다 — 깨지지 않고, 확인 때 바뀌었을 수 있는 값은 요청 줄에 붙이지 않는다',()=>{
  const requested=pay(journalModel(project({payment:{status:'requested',requestedAt:T(4),amount:300000}})));
  assert.deepEqual(requested.map(line=>[line.what,line.go]),[['크몽 결제 요청을 보냈어요 · 30만원',{tab:'overview'}]]);
  const confirmed=pay(journalModel(project({payment:{status:'confirmed',requestedAt:T(4),confirmedAt:T(5),amount:310000,dueDate:'2026-11-22'}})));
  assert.deepEqual(confirmed.map(line=>line.what),['결제를 확인했어요 · 받으실 날 11월 22일','크몽 결제 요청을 보냈어요']);
  const refunded=pay(journalModel(project({payment:{status:'cancelled',requestedAt:T(4),confirmedAt:T(5),cancelledAt:T(6),amount:300000}})));
  assert.deepEqual(refunded.map(line=>line.what),['결제를 취소했어요','결제를 확인했어요','크몽 결제 요청을 보냈어요']);
  const dropped=pay(journalModel(project({payment:{status:'cancelled',requestedAt:T(4),cancelledAt:T(6),amount:300000}})));
  assert.deepEqual(dropped.map(line=>line.what),['결제 요청을 취소했어요','크몽 결제 요청을 보냈어요 · 30만원'],'요청만 하고 취소한 결제(낸 돈 없음)는 결제 요청 취소 · 그 값이 요청한 값이다');
  // 결제가 없는 프로젝트 · 이상한 칸은 줄을 만들지 않고 깨지지 않는다.
  for(const request of [{},{payment:null},{payment:'x'},{paymentTrail:'x'},{paymentTrail:[null,{kind:'refunded',at:T(2)},{kind:'requested',at:'어제'},{kind:'requested'}]},{paymentTrail:[]}]){
    const j=journalModel(project(request));
    assert.deepEqual(pay(j),[],JSON.stringify(request));
    assert.doesNotMatch(JSON.stringify(j),/undefined|NaN/);
  }
  // 빈 목록(새 서버 · 결제 기록 없음)이면 결제 칸이 있어도 대신 그리지 않는다 — 서버가 준 목록이 정본이다.
  assert.deepEqual(pay(journalModel(project({payment:{status:'requested',requestedAt:T(4),amount:300000},paymentTrail:[]}))),[]);
});

test('일지 결제 줄: 그리면 줄마다 한 줄씩 서고, 열린 요청 줄만 「열기」가 붙는다',()=>{
  const html=journalView(journalModel(project({payment:{status:'requested',requestedAt:T(4),amount:300000},paymentTrail:TRAIL.slice(0,3)})),{all:true});
  for(const text of ['크몽 결제 요청을 보냈어요 · 30만원','결제 요청을 취소했어요','크몽 결제 요청을 보냈어요 · 29만원'])assert.ok(html.includes(text),text);
  assert.equal((html.match(/data-journal-go="overview"/g)||[]).length,1,'열린 요청 줄 하나만 결제 카드로 간다');
  assert.equal((journalView(journalModel(project({payment:{status:'requested',requestedAt:T(4),amount:300000},paymentTrail:TRAIL.slice(0,3)})),{all:true,here:{tab:'overview',versionId:''}}).match(/data-journal-go="overview"/g)||[]).length,0,'고객 방에서 보면 「지금 화면」');
  assert.doesNotMatch(html,/undefined|NaN/);
});

test('일지 결제 줄 · 영어: 담당자 이름 뒤에 서는 동사 문장, 값은 원화 표기, 날짜는 영어 달 이름',async()=>{
  await setLocale('en');
  try{
    const lines=pay(journalModel(project({payment:{status:'confirmed',requestedAt:T(4),confirmedAt:T(5),amount:300000,dueDate:'2026-11-22'},paymentTrail:TRAIL})));
    assert.deepEqual(lines.map(line=>line.what),['confirmed your payment · delivery on Nov 22','sent a payment request on Kmong · KRW 300,000','cancelled the payment request','sent a payment request on Kmong · KRW 290,000']);
    assert.equal(pay(journalModel(project({payment:{status:'confirmed',confirmedAt:T(5)},paymentTrail:[{kind:'confirmed',at:T(5)}]})))[0].what,'confirmed your payment','일지 문맥 — 결제 카드의 「Payment confirmed」와 다르다');
    assert.ok(lines.every(line=>!/[가-힣]/.test(line.what)));
    assert.equal(pay(journalModel(project({payment:{status:'cancelled',requestedAt:T(4),confirmedAt:T(5),cancelledAt:T(6),amount:300000},paymentTrail:[...TRAIL,{kind:'cancelled',at:T(6),amount:300000}]})))[0].what,'cancelled the payment','확인한 결제의 취소(환불)');
  }finally{await setLocale('ko');}
});

// ── 남은 수정 ──
const review=({revisions=2,rounds=0,canDraft=true,stage='review',direction=true,package:pkg='s15'}={})=>{
  const p=project({...(direction?{directionProposal:{round:1,status:'chosen',revisions,price:290000,dueDate:'2026-11-22',options:[]}}:{}),answers:{...emptyAnswers(),package:pkg,contactName:'김합성'}},{stage});
  p.studio.feedbackRounds={drafts:[],rounds:Array.from({length:rounds},(_,i)=>({id:'r'+i,number:i+1,versionId:'v'+i,versionLabel:(i+1)+'차',representativeName:'김합성',submittedAt:T(6+i),items:[]})),latestVersionId:'v9',latestVersionLabel:'3차',canDraft,maxItems:20,nextNumber:rounds+1};
  return feedbackRoundsColumn({project:p,versionId:''});
};
const leftLine=html=>(html.match(/<p class="sx-small sx-rounds-left" data-rounds-left>(.*?)<\/p>/)||[])[1]||null;

test('남은 수정: 시안을 보는 동안 「수정 n회 중 k회 남았어요」가 늘 서고, 보낸 의견 묶음 하나가 한 회다',()=>{
  assert.equal(leftLine(review({rounds:0})),'수정 2회 중 2회 남았어요.');
  assert.equal(leftLine(review({rounds:1})),'수정 2회 중 1회 남았어요.');
  assert.equal(leftLine(review({revisions:3,rounds:1})),'수정 3회 중 2회 남았어요.');
  // 다 썼으면(넘겨 보냈어도) 0회 남음 대신 범위를 정한다는 말 — 확인 창의 「정한 수정 n회를 다 썼어요」와 같은 셈.
  for(const rounds of [2,3])assert.equal(leftLine(review({rounds})),'정한 수정 2회를 다 썼어요. 더 고칠 곳은 담당자와 범위를 정한 뒤 반영해요. 합의와 다르게 만든 부분은 횟수와 상관없이 바로잡아요.','셈은 그대로 — 다 쓴 자리에 제작 시작 때 약속을 잇는다(Fable 5.2 F1)');
  // 맨 위 한 줄 — 의견 칸보다 먼저.
  const html=review({rounds:1});assert.ok(html.indexOf('data-rounds-left')<html.indexOf('data-form="round-draft"'));
});

test('남은 수정: 정한 횟수가 없거나 의견을 모을 시안이 없으면 줄이 없다 · 방향 제안 없이 온 사진 상품은 패키지 횟수',()=>{
  assert.equal(leftLine(review({direction:false,package:'corp'})),null,'기업 · 상담(횟수 협의)');
  assert.equal(leftLine(review({direction:false,package:''})),null);
  assert.equal(leftLine(review({canDraft:false})),null,'시안을 승인했거나 시안이 없으면(의견을 못 모으면) 세지 않는다');
  assert.equal(leftLine(review({stage:'archived'})),null,'보관한 프로젝트');
  assert.equal(leftLine(review({direction:false,package:'photo'})),'수정 2회 중 2회 남았어요.','결제 카드와 같은 값(패키지 횟수)');
  assert.equal(leftLine(review({revisions:0})),null);
  // 옛 영상 확인 손님(의뢰서 없음)은 그대로.
  const p=project();delete p.studio.request;p.studio.feedbackRounds={drafts:[],rounds:[],latestVersionId:'v1',latestVersionLabel:'1차',canDraft:true,maxItems:20,nextNumber:1};
  assert.equal(leftLine(feedbackRoundsColumn({project:p,versionId:''})),null);
});

test('남은 수정: 확인 창의 횟수와 같은 정한 횟수를 쓴다(사진 상품 · 패키지 횟수까지)',()=>{
  const p=project({answers:{...emptyAnswers(),package:'photo',contactName:'김합성'}},{stage:'review'});
  p.studio.feedbackRounds={drafts:[{id:'d1',versionId:'v9',versionLabel:'1차',current:true,canSubmit:true,items:[{id:'i1',text:'더 밝게',seconds:2}]}],rounds:[],latestVersionId:'v9',latestVersionLabel:'1차',canDraft:true,maxItems:20,nextNumber:1};
  const html=feedbackRoundsColumn({project:p,versionId:''});
  assert.match(html,/수정 2회 중 1회째를 써요\./);assert.equal(leftLine(html),'수정 2회 중 2회 남았어요.');
});

test('남은 수정 · 영어',async()=>{
  await setLocale('en');
  try{
    assert.equal(leftLine(review({rounds:1})),'You have 1 of 2 revisions left.');
    assert.equal(leftLine(review({revisions:1,rounds:0})),'Your one revision is still available.','정한 횟수 1회 — 단수(카본 검수 A1)');
    assert.equal(leftLine(review({rounds:2})),'You have used your 2 agreed revisions. We will confirm the scope with you before making further changes. Anything that differs from what we agreed on will still be corrected, even with no revisions left.');
    assert.equal(leftLine(review({revisions:1,rounds:1})),'You have used your one agreed revision. We will confirm the scope with you before making further changes. Anything that differs from what we agreed on will still be corrected, even with no revisions left.');
  }finally{await setLocale('ko');}
});

// Fable 5.2 화면 최종(pulse-ops-s2a-screen-20261112): F3 확인 창의 짝 문장도 단수 · F4 결제 카드가 없는 방에는 「열기」 없음 · F5 값은 한 덩어리 · F1 확인 창에도 약속 문장.
test('확인 창: 다 쓴 뒤 보내는 의견에는 약속 문장이 잇고, 영어는 정한 횟수 1회면 단수',async()=>{
  const sheet=(revisions,rounds)=>{const p=project({directionProposal:{round:1,status:'chosen',revisions,options:[]},answers:{...emptyAnswers(),package:'s15',contactName:'김합성'}},{stage:'review'});
    p.studio.feedbackRounds={drafts:[{id:'d1',versionId:'v9',versionLabel:'3차',current:true,canSubmit:true,items:[{id:'i1',text:'더 밝게',seconds:2}]}],rounds:Array.from({length:rounds},(_,i)=>({id:'r'+i,number:i+1,versionId:'v'+i,versionLabel:(i+1)+'차',representativeName:'김합성',submittedAt:T(6+i),items:[]})),latestVersionId:'v9',latestVersionLabel:'3차',canDraft:true,maxItems:20,nextNumber:rounds+1};
    return feedbackRoundsColumn({project:p,versionId:''});};
  assert.match(sheet(2,2),/정한 수정 2회를 다 썼어요. 이번 의견은 담당자와 범위를 정한 뒤 반영해요. 합의와 다르게 만든 부분은 횟수와 상관없이 바로잡아요./);
  // 아직 횟수가 남은 판(맨 위 줄 · 확인 창 모두)에는 약속 문장이 없다 — 화면 어디에도(Fable 다시 검수 FA1: 앞 판의 단언은 늘 통과했다).
  assert.match(sheet(2,1),/수정 2회 중 2회째를 써요\./);assert.doesNotMatch(sheet(2,1),/바로잡아요/);
  assert.equal((sheet(2,2).match(/바로잡아요/g)||[]).length,2,'다 쓴 판은 맨 위 줄과 확인 창에 한 번씩');
  await setLocale('en');
  try{
    // 확인 창 문장은 끝(incorporating these notes)까지 묶는다 — 맨 위 줄(making further changes)이 대신 맞춰 주지 않게(FA1).
    assert.match(sheet(1,1),/You have used your one agreed revision\. We will confirm the scope with you before incorporating these notes\. Anything that differs/);
    assert.match(sheet(3,3),/You have used your 3 agreed revisions\. We will confirm the scope with you before incorporating these notes\. Anything that differs/);
    assert.doesNotMatch(sheet(1,1)+sheet(3,3),/all 1|agree the scope|used up|working these notes in|no matter how many/);
  }finally{await setLocale('ko');}
});

test('결제 줄의 「열기」는 고객 방에 결제 카드가 설 때만 — 되묻기가 열렸거나 시안이 온 방에는 없다',()=>{
  const requested={payment:{status:'requested',requestedAt:T(4),amount:300000},paymentTrail:TRAIL.slice(0,3)};
  assert.deepEqual(pay(journalModel(project(requested)))[0].go,{tab:'overview'});
  assert.equal(pay(journalModel(project({...requested,asks:[{id:'q1',label:'로고',status:'open',at:T(4)}]})))[0].go,null,'되묻기 차례(state ask)');
  assert.equal(pay(journalModel(project(requested,{versions:[{id:'v1',kind:'preview',label:'1차',createdAt:T(5)}]})))[0].go,null,'시안이 온 방(state review)');
});
