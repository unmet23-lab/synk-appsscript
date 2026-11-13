// PULSE 운영 조각 6-A(2026-11-13, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2 「받으실 날 고치기」) — 화면 · 메일 쪽 약속.
// 손님: 일지에 「받으실 날을 ○로 다시 정했어요 · 까닭」 줄, 고객 방 「받으실 날」 줄은 「담당자가 다시 정한 날」, 메일은 새 날 + 까닭 문장.
// 직원: 확인한 결제에만 「받으실 날 고치기」(이 서버가 안다고 알릴 때만), 창은 날 · 까닭 넷 · 메모(직원만).
// 서버 쪽(동작 · 손님 보기 허용 목록 · 알림 · 메일 한 통)은 pulse-presale-server.test.mjs 「운영 조각 6-A」 시험이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pulseMailActed,pulseMailCompose,pulseMailMoment} from './pulse-mail.mjs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {journalModel,roomModel,deskModel}=await import('./public/pulse-app/room-view.mjs');
const {deskView}=await import('./public/pulse-app/desk-view.mjs');
const {dialogContent}=await import('./public/pulse-app/views.mjs');
const {setLocale}=await import('./public/pulse-app/i18n.mjs');
const {emptyAnswers}=await import('./public/pulse-app/request-data.mjs');

const T=hour=>new Date(Date.UTC(2026,10,12,hour)).toISOString();
const project=(request={},extra={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'producing',revision:3,versions:[],messages:[],requestFlow:true,
  studio:{assets:[],scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:false,maxItems:20,nextNumber:1},
    request:{status:'confirmed',number:'P-2026-ABCD',submittedAt:T(0),confirmedAt:T(1),confirmedBy:'김하늘',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],rounds:[],...request}},...extra});
const pay=j=>j.items.filter(item=>item.id.startsWith('p:'));
// 확인 → 받으실 날 고침(까닭 있음) → 또 고침(까닭 모름) → 고침(날을 읽을 수 없음 — 빠진다) → 환불.
const TRAIL=[{kind:'requested',at:T(2),amount:290000},{kind:'confirmed',at:T(3),amount:290000,dueDate:'2026-11-22'},
  {kind:'due_changed',at:T(4),from:'2026-11-22',dueDate:'2026-11-30',reason:'scope'},{kind:'due_changed',at:T(5),from:'2026-11-30',dueDate:'2026-12-02',reason:'later'},
  {kind:'due_changed',at:T(6),dueDate:'2026-13-40'},{kind:'cancelled',at:T(7),amount:290000}];
const confirmedPay={status:'confirmed',requestedAt:T(2),confirmedAt:T(3),amount:290000,dueDate:'2026-12-02',dueChangedAt:T(5)};

test('일지: 받으실 날 고침 줄은 새 날 · 까닭(모르는 까닭은 빼고), 날을 못 읽는 줄은 없고, 그 뒤 취소는 확인한 결제의 취소(환불)',()=>{
  const lines=pay(journalModel(project({payment:{...confirmedPay,status:'cancelled',cancelledAt:T(7)},paymentTrail:TRAIL})));
  assert.deepEqual(lines.map(line=>line.what),['결제를 취소했어요','받으실 날을 12월 2일로 다시 정했어요','받으실 날을 11월 30일로 다시 정했어요 · 고칠 범위가 바뀌어서','결제를 확인했어요 · 받으실 날 11월 22일','크몽 결제 요청을 보냈어요 · 29만원']);
  assert.ok(lines.every(line=>line.who==='staff'&&line.name==='김하늘'&&line.kind==='event'&&line.go===null));
  assert.equal(new Set(lines.map(line=>line.id)).size,lines.length,'줄 id가 겹치지 않는다');
  const why={waiting:'확인을 기다린 날만큼',scope:'고칠 범위가 바뀌어서',agreed:'말씀 나눈 날로',ours:'저희 쪽 사정으로'};
  for(const [reason,text] of Object.entries(why)){
    const [line]=pay(journalModel(project({payment:confirmedPay,paymentTrail:[{kind:'confirmed',at:T(3),dueDate:'2026-11-22'},{kind:'due_changed',at:T(4),dueDate:'2026-11-30',reason}]})));
    assert.equal(line.what,`받으실 날을 11월 30일로 다시 정했어요 · ${text}`,reason);
  }
});

test('일지 · 영어: 담당자 이름 뒤 동사 문장, 까닭은 영어 구절, 한글 없음',async()=>{
  await setLocale('en');
  try{
    const lines=pay(journalModel(project({payment:{...confirmedPay,status:'cancelled',cancelledAt:T(7)},paymentTrail:TRAIL})));
    assert.deepEqual(lines.slice(0,3).map(line=>line.what),['cancelled the payment','set a new delivery date: Dec 2','set a new delivery date: Nov 30 · because the scope of the revisions changed']);
    for(const reason of ['waiting','agreed','ours']){
      const [line]=pay(journalModel(project({payment:confirmedPay,paymentTrail:[{kind:'due_changed',at:T(4),dueDate:'2026-11-30',reason}]})));
      assert.match(line.what,/^set a new delivery date: Nov 30 · [a-z]/,reason);assert.doesNotMatch(line.what,/[가-힣]/,reason);
    }
  }finally{await setLocale('ko');}
});

test('고객 방 「받으실 날」: 고친 결제는 「담당자가 다시 정한 날」, 고치지 않았으면 「결제 확인 때 정한 날」',async()=>{
  const dueRow=p=>roomModel(p).brief.find(([key])=>String(key).includes('받으실 날'))?.[1];
  assert.equal(dueRow(project({payment:confirmedPay})),'12월 2일 · 담당자가 다시 정한 날');
  assert.equal(dueRow(project({payment:{...confirmedPay,dueChangedAt:undefined}})),'12월 2일 · 결제 확인 때 정한 날');
  await setLocale('en');
  try{
    const row=roomModel(project({payment:confirmedPay})).brief.map(([,value])=>value).find(value=>/Dec 2/.test(value));
    assert.equal(row,'Dec 2 · new date set by your producer');
  }finally{await setLocale('ko');}
});

test('직원 결제 칸: 확인한 결제 · 이 서버가 알릴 때만 「받으실 날 고치기」, 고친 날에는 (다시 정함)',()=>{
  const desk=(payment,dueChange=true)=>deskView({...deskModel(project({payment,paymentFlow:true,...(dueChange?{dueChange:true}:{})})),queue:[]},{bar:false});
  assert.match(desk(confirmedPay),/data-action="desk-due"/);
  assert.match(desk(confirmedPay),/받으실 날 2026-12-02 \(다시 정함\)/);
  assert.doesNotMatch(desk(confirmedPay,false),/desk-due/,'옛 서버(dueChange 없음)에는 단추가 없다');
  assert.doesNotMatch(desk({status:'requested',requestedAt:T(2),amount:290000}),/desk-due/,'결제 확인 전에는 없다');
  assert.doesNotMatch(desk({status:'cancelled',requestedAt:T(2),cancelledAt:T(3),amount:290000}),/desk-due/,'취소한 결제에는 없다');
  assert.doesNotMatch(desk({...confirmedPay,dueChangedAt:undefined}),/다시 정함/);
});

test('직원 창: 새 날(필수 · 지금 날로 채움) · 까닭 넷(손님에게 보일 문장을 함께 보임) · 메모(300자 · 직원만)',()=>{
  const html=dialogContent('desk-due',{dueDate:'2026-12-02'});
  assert.match(html,/data-form="desk-due"/);
  assert.match(html,/<input[^>]*name="dueDate"[^>]*>/);const date=html.match(/<input[^>]*name="dueDate"[^>]*>/)[0];
  assert.match(date,/type="date"/);assert.match(date,/value="2026-12-02"/);assert.match(date,/required/);
  // 카본 화면 검수 A1 · A3: 라디오 넷 — 모두 필수, 기본 선택 없음(고르지 않으면 못 보냄), 이름과 손님 문장은 두 줄.
  const radios=[...html.matchAll(/<input type="radio" name="reason" value="([a-z]+)"([^>]*)>/g)];
  assert.deepEqual(radios.map(match=>match[1]),['waiting','scope','agreed','ours']);
  assert.ok(radios.every(match=>/required/.test(match[2])&&!/checked/.test(match[2])),'필수 · 기본 선택 없음');
  assert.doesNotMatch(html,/<select name="reason"/);
  assert.match(html,/<b>손님 확인을 기다린 만큼<\/b><br>「확인을 기다린 날만큼 날을 옮겼어요\.」/);
  for(const sentence of ['확인을 기다린 날만큼 날을 옮겼어요.','고칠 범위가 바뀌어 날을 다시 잡았어요.','말씀 나눈 날로 맞췄어요.','저희 쪽 사정으로 날을 다시 잡았어요. 양해 부탁드려요.'])assert.ok(html.includes(sentence),sentence);
  const note=html.match(/<input[^>]*name="note"[^>]*>/)[0];assert.match(note,/maxlength="300"/);assert.doesNotMatch(note,/required/);
  assert.match(dialogContent('desk-due',{}),/정해지지 않음/,'받으실 날이 없던 결제(기업)');
});

test('메일: 새 날과 마지막 고침의 까닭 문장, 영어, 결제를 취소했으면 보내지 않음, 담당자 메모는 넣지 않음',()=>{
  const log=[{kind:'confirmed',at:T(3),dueDate:'2026-11-22'},{kind:'due_changed',at:T(4),from:'2026-11-22',dueDate:'2026-11-30',reason:'ours',note:'촬영 장비 고장 — 내부'}];
  const row={studio:{request:{answers:{name:'오미톡',contactName:'김합성'},payment:{status:'confirmed',dueDate:'2026-11-30',dueChangedAt:T(4)},paymentLog:log}}};
  assert.equal(pulseMailMoment(row,{type:'due_changed',id:'x'}),'due_changed');
  const ko=pulseMailCompose(row,'due_changed');
  assert.equal(ko.subject,'〔SYNK PULSE〕 오미톡 광고, 받으실 날이 바뀌었어요');
  assert.match(ko.body,/\n\n받으실 날을 11월 30일로 다시 정했어요\. 저희 쪽 사정으로 날을 다시 잡았어요\. 양해 부탁드려요\.\n다음 할 일: 따로 하실 일은 없어요\.\n\n/);
  assert.doesNotMatch(ko.body,/장비|내부|확인을 기다리는 날만큼/);
  const en=pulseMailCompose(row,'due_changed','en');
  assert.equal(en.subject,'[SYNK PULSE] Your 오미톡 ad: new delivery date');
  assert.match(en.body,/We’ve set a new delivery date: November 30\. We had to reschedule on our side\. Thank you for your understanding\./);
  assert.doesNotMatch(en.body.replace('김합성',''),/[가-힣]/);assert.match(en.body,/\nNext: there’s nothing you need to do\.\n\n/);
  // 까닭을 모르는 줄이면 까닭 문장 없이, 날을 못 읽으면 날 없이 앱으로.
  const unknown=pulseMailCompose({studio:{request:{answers:{},payment:{status:'confirmed',dueDate:'2026-11-30'},paymentLog:[{kind:'due_changed',at:T(4),dueDate:'2026-11-30',reason:'later'}]}}},'due_changed');
  assert.match(unknown.body,/받으실 날을 11월 30일로 다시 정했어요\.\n/);
  assert.match(pulseMailCompose({studio:{request:{answers:{},payment:{status:'confirmed'}}}},'due_changed').body,/담당자가 받으실 날을 다시 정했어요\. 바뀐 날은 앱에서 보실 수 있어요\./);
  assert.equal(pulseMailActed(row,'due_changed',{id:'x'}),false);
  assert.equal(pulseMailActed({studio:{request:{...row.studio.request,payment:{status:'cancelled',dueDate:'2026-11-30'}}}},'due_changed',{id:'x'}),true,'환불했으면 보내지 않는다');
  assert.equal(pulseMailActed({studio:{request:{...row.studio.request,payment:{status:'confirmed'}}}},'due_changed',{id:'x'}),true,'날이 없으면 보내지 않는다');
});

test('메일(GPT 검수 GA1 · GA2): 고친 뒤 환불 · 다시 확인한 결제에는 앞 고침 메일을 보내지 않고 까닭도 붙이지 않으며, 달력에 없는 날은 보내지 않고 다른 순간 조립도 안 깨진다',()=>{
  const at=hour=>new Date(Date.UTC(2026,10,13,hour)).toISOString();
  const log=[{kind:'confirmed',at:at(3),dueDate:'2026-11-22'},{kind:'due_changed',at:at(4),from:'2026-11-22',dueDate:'2026-11-30',reason:'ours'},{kind:'cancelled',at:at(5),was:'confirmed',note:'환불'},{kind:'requested',at:at(6),amount:290000},{kind:'confirmed',at:at(7),dueDate:'2026-11-23'}];
  const again={studio:{request:{answers:{name:'오미톡'},payment:{status:'confirmed',confirmedAt:at(7),dueDate:'2026-11-23'},paymentLog:log}}};
  assert.equal(pulseMailActed(again,'due_changed',{id:'x',createdAt:at(4)}),true,'다시 확인한 결제에는 고침이 없다');
  assert.equal(pulseMailActed(again,'due_changed',{id:'z',createdAt:at(9)}),true,'사건 때가 늦어도 지금 결제에 고침(고친 때 · 고침 줄)이 없으면 보내지 않는다');
  assert.doesNotMatch(pulseMailCompose(again,'due_changed').body,/저희 쪽 사정/,'앞 결제의 까닭을 붙이지 않는다');
  // 다시 확인한 결제에서 또 고쳤으면 그 고침은 보낸다 — 그 전 사건(앞 결제 때)은 보내지 않는다.
  const changed={studio:{request:{...again.studio.request,payment:{...again.studio.request.payment,dueDate:'2026-11-25',dueChangedAt:at(8)},paymentLog:[...log,{kind:'due_changed',at:at(8),from:'2026-11-23',dueDate:'2026-11-25',reason:'agreed'}]}}};
  assert.equal(pulseMailActed(changed,'due_changed',{id:'y',createdAt:at(8)}),false);
  assert.equal(pulseMailActed(changed,'due_changed',{id:'x',createdAt:at(4)}),true,'지금 결제 확인 전의 사건');
  assert.match(pulseMailCompose(changed,'due_changed').body,/받으실 날을 11월 25일로 다시 정했어요\. 말씀 나눈 날로 맞췄어요\./);
  // 달력에 없는 날: 보내지 않고, 조립은 날 없이(던지지 않음), 다른 순간 조립도 그대로.
  for(const dueDate of ['2026-13-40','2026-02-30']){
    const broken={studio:{request:{answers:{name:'오미톡'},payment:{status:'confirmed',confirmedAt:at(3),dueDate,dueChangedAt:at(4)},paymentLog:[log[0],{...log[1],dueDate}]}}};
    assert.equal(pulseMailActed(broken,'due_changed',{id:'x',createdAt:at(4)}),true,dueDate);
    assert.match(pulseMailCompose(broken,'due_changed').body,/담당자가 받으실 날을 다시 정했어요\. 바뀐 날은 앱에서 보실 수 있어요\./,dueDate);
    assert.match(pulseMailCompose(broken,'staff_reply').subject,/담당자가 답을 남겼어요/,dueDate);
  }
});

test('직원 창 보내기(카본 화면 검수 A2): 지금 받으실 날 그대로면 서버에 보내지 않고 날짜 칸으로 돌려보낸다(원문 검사)',async()=>{
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
  const at=source.indexOf("if(type==='desk-due')"),send=source.indexOf("studioAction('due_change'",at),same=source.indexOf("String(values.dueDate||'')===String(s.project?.studio?.request?.payment?.dueDate||'')",at);
  assert.ok(at>0&&same>at&&same<send,'같은 날 막기가 보내기 앞에 있다');
  assert.ok(source.slice(same,send).includes("form.querySelector('[name=dueDate]')?.focus();return;"),'날짜 칸으로 돌려보내고 멈춘다');
});
