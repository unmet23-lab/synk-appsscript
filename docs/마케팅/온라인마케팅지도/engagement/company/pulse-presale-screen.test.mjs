import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomState,roomModel,deskQueue} from './public/pulse-app/room-view.mjs';

// 판 4 화면 검수(pulse-presale-screen-20261110) Fable 지적 여섯의 약속. 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_판매전_설계.md.
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const chosen={round:1,status:'chosen',chosenId:'a',options:[{id:'a',name:'아니, 잠깐',sentence:'한 문장',flow:[],why:''}],price:290000,dueDate:'2026-11-20',revisions:2};
function project({request={},versions=[],closeout=null,stage='received'}={}){
  return {id:'p1',title:'오미톡',ownerName:'김하늘',stage,versions,messages:[],requestFlow:true,...(closeout?{closeout}:{}),studio:{assets:[],scenes:[],strategy:{revision:1,data:{}},request:{status:'confirmed',number:'P-1110-ABCD',submittedAt:'2026-11-10T03:00:00.000Z',confirmedAt:'2026-11-10T04:00:00.000Z',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15',modelChoice:'ask'},files:[],asks:[],notes:[],rounds:[{round:1,kind:'script',scenes:[],sentAt:'2026-11-10T05:00:00.000Z',approvedAt:'2026-11-10T06:00:00.000Z'}],scriptApprovedAt:'2026-11-10T06:00:00.000Z',directionProposal:chosen,paymentFlow:true,...request}}};
}
const due=p=>roomModel(p).brief.find(([key])=>key==='받으실 날')?.[1];

test('F1: the day on the brief follows the payment — the period from payment while it waits, the day set at confirmation after',()=>{
  const paying=project();
  assert.equal(roomState(paying),'pay');
  assert.equal(due(paying),'결제한 날부터 10일','the same words as the payment card, not the proposal day');
  assert.equal(due(project({request:{payment:{status:'requested',requestedAt:'2026-11-10T07:00:00.000Z',amount:290000}}})),'결제한 날부터 10일');
  const paid=project({request:{payment:{status:'confirmed',confirmedAt:'2026-11-12T01:00:00.000Z',amount:290000,dueDate:'2026-11-22'},rounds:[{round:1,kind:'script',scenes:[],approvedAt:'x'},{round:2,kind:'images',scenes:[],sentAt:'y'}]}});
  assert.equal(due(paid),'11월 22일 · 결제 확인 때 정한 날','after confirmation the customer sees the day staff set, not the proposal day');
  assert.equal(due(project({request:{rounds:[],scriptApprovedAt:undefined}})),'11월 20일 · 방향 제안에 적힌 날','before the script is approved the proposal day stays');
});

test('F2: once receipt is confirmed the room screen still plays the customer’s own final, not the example',()=>{
  const final={id:'v9',kind:'final',label:'15초 최종본',media:{url:'/pulse/api/media/v9',mimeType:'video/mp4'}};
  const done=project({stage:'delivered',versions:[final],closeout:{receipt:{confirmedAt:'2026-11-20T01:00:00.000Z'}}});
  assert.equal(roomState(done),'done');
  assert.equal(roomModel(done).film?.src,'/pulse/api/media/v9');
});

test('F3: the staff list names the payment wait by its state',()=>{
  const row=p=>deskQueue([p])[0]?.state;
  assert.equal(row(project()),'결제 안내 중');
  assert.equal(row(project({request:{payment:{status:'requested',requestedAt:'t',amount:290000}}})),'크몽 결제 요청 보냄');
  assert.equal(row(project({request:{payment:{status:'cancelled',cancelledAt:'t'}}})),'결제 취소');
});

test('F4: picking “recommend” or “no model” swaps the big portrait for the business picture, on first paint and on change',()=>{
  const flow=read('request-flow.mjs');
  assert.match(flow,/const choiceShot=a=>a\.modelChoice==='custom'&&personaPhoto\(a\)\?\.src\|\|kindOf\(a\)\?\.shot\|\|still\('w-gift-sphere'\);/,'추천 · 사람 없이는 업종 그림 그대로(맞춤 인물만 판 3에서 인물 칸 사진이 먼저)');
  assert.match(flow,/<img data-portrait src="\$\{esc\(choiceText\(a\)\?choiceShot\(a\):bigScene\(lead\)\)\}"/);
  assert.match(flow,/if\(lead\)lead\.textContent=text\.caption;crossfade\(\$\('\[data-portrait\]'\),choiceShot\(a\)\);\}/);
});

test('F5 · F6: the refund notice and its tick ride with the consent the server records; past the agreed revisions the line says so',()=>{
  assert.match(read('app.mjs'),/\.\.\.\(terms\.terms\?\{note:t\('제작을 시작한 뒤에는[^']*'\),check:t\('이 안내를 확인했어요'\)\}:\{\}\)/);
  const rounds=read('feedback-rounds-view.mjs');
  assert.match(rounds,/data\.nextNumber>total\?t\('정한 수정 \{total\}회를 다 썼어요\. 이번 의견은 담당자와 범위를 정한 뒤 반영해요\.',\{total\}\):t\('수정 \{total\}회 중 \{used\}회째를 써요\.',\{total,used:data\.nextNumber\}\)/);
  assert.doesNotMatch(rounds,/Math\.min\(data\.nextNumber,total\)/);
});
