import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomModel,deskModel} from './public/pulse-app/room-view.mjs';
import {directionView,roomView} from './public/pulse-app/film-views.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';

// 메일 알림의 화면 약속: 서버가 켜졌다고 준 때만 메일 말이 나오고, 주소는 가린 채로. 담당자 화면에는 연결 · 순간별 상태와 주소 고치기.
globalThis.location??=new URL('http://localhost/pulse-app/');
const option=(id,name,extra={})=>({id,name,sentence:`${name} 한 문장`,flow:[{at:'0:00',text:'처음'},{at:'0:05',text:'끝'}],why:'왜',assetId:'img-'+id,recommended:false,...extra});
const open={round:1,status:'open',lead:'두 방향으로 나눴어요.',options:[option('a','아니, 잠깐',{recommended:true}),option('b','톡')],modelId:'M06',price:390000,dueDate:'2026-11-17',revisions:2};
function project({direction=null,status='confirmed',mail,rounds=[]}={}){
  return {id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',versions:[],messages:[],requestFlow:true,contact:'김손님 · buyer@example.com',...(mail?{mail}:{}),studio:{assets:[{id:'img-a',mimeType:'image/jpeg',fileName:'a.jpg',url:'/x/a'},{id:'img-b',mimeType:'image/jpeg',fileName:'b.jpg',url:'/x/b'}],scenes:[],strategy:{revision:1,data:{}},request:{status,number:'P-2026-ABCD',submittedAt:'2026-11-07T03:00:00.000Z',confirmedAt:'2026-11-07T04:00:00.000Z',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15',modelChoice:'ask'},files:[],asks:[],notes:[],rounds,...(direction?{directionProposal:direction}:{})}}};
}
const on={mailOn:true,mailTo:'b***@example.com'};
const desk=p=>deskView({...deskModel(p),queue:[]});

test('손님 화면: 메일이 꺼져 있으면 메일 말이 없고, 켜져 있으면 저희 차례 글과 방향 화면에 가린 주소 한 줄',()=>{
  const offRoom=roomView(roomModel(project())),offDirection=directionView(roomModel(project({direction:open})));
  assert.doesNotMatch(offRoom+offDirection,/메일/);
  assert.equal(roomModel(project({mail:{mailOn:false,mailTo:null}})).mail,'');
  // 다음 손님 차례가 실제 메일 순간일 때만, 무엇이 오는지와 함께(서버 pulseMailMoment와 같은 약속)
  assert.match(roomView(roomModel(project({mail:on}))),/글 콘티가 오면 메일\(b\*\*\*@example\.com\)로도 알려 드려요\./);
  assert.match(roomView(roomModel(project({mail:on,status:'submitted'}))),/방향 제안이 오면 메일\(b\*\*\*@example\.com\)로도 알려 드려요\./);
  const scriptOk={round:1,kind:'script',approvedAt:'x',sentAt:'x',scenes:[]};
  assert.match(roomView(roomModel(project({mail:on,rounds:[{round:1,kind:'script',feedbackAt:'x',changes:1,sentAt:'x',scenes:[]}]}))),/고친 글 콘티가 오면 메일/);
  for(const rounds of [[scriptOk],[scriptOk,{round:2,kind:'images',feedbackAt:'x',changes:1,sentAt:'x',scenes:[]}]])assert.doesNotMatch(roomView(roomModel(project({mail:on,rounds}))),/메일/,'장면 이미지 둘째 판부터는 메일이 없다');
  const direction=directionView(roomModel(project({direction:open,mail:on})));
  assert.match(direction,/<dt>알림<\/dt><dd>글 콘티가 오면 메일\(b\*\*\*@example\.com\)로도 알려 드려요<\/dd>/);
  assert.doesNotMatch(direction,/차례가 오면/,'손님 차례 화면에는 저희 차례 줄을 붙이지 않는다');
  assert.doesNotMatch(roomView(roomModel(project({mail:{mailOn:true,mailTo:'<img src=x>'}}))),/<img src=x>/);
});

test('담당자 화면: 연결 · 받는 곳 · 순간마다 마지막 상태, 주소 고치기 · 메일 끄기 폼',()=>{
  const mail={connection:'on',recipient:'set',email:'new@example.com',override:true,mailOff:false,customerChanged:false,moments:{direction_proposed:{state:'sent',reason:null,at:'2026-11-08T05:02:00.000Z'},draft_ready:{state:'skipped',reason:'read',at:'x'},preview_ready:{state:'unknown',reason:'relay_unknown',at:'x'},final_ready:{state:'failed',reason:'to',at:'x'}}};
  const html=desk(project({mail}));
  assert.match(html,/메일 알림 · 담당자가 고친 주소로 보내요/);
  assert.match(html,/방향 제안 · Gmail에 넘김 11\/8 14:02/);
  assert.match(html,/글 콘티 · 안 보냄 · 앱에서 먼저 보셨어요/);
  assert.match(html,/영상 확인 · 보냈는지 확인 못 함 · 직접 연락해 주세요/);
  assert.match(html,/납품 · 실패 · 직접 연락해 주세요/);
  assert.match(html,/<form data-form="desk-contact"><label><span>알림 메일 주소<\/span><input type="email" name="email" value="new@example\.com"/);
  assert.match(desk(project({mail:{...mail,connection:'broken',moments:{}}})),/메일 알림 · 연결 끊김 · 관리자 설정에서 다시 연결/);
  assert.match(desk(project({mail:{...mail,recipient:'mail_off',mailOff:true}})),/이 의뢰는 껐어요[\s\S]*name="mailOff" checked/);
  assert.doesNotMatch(desk(project({mail:{...mail,customerChanged:true,override:false,connection:'broken'}})),/그 주소로 보내요/);
  assert.match(desk(project({mail:{...mail,customerChanged:true,override:false}})),/손님이 의뢰서 주소를 고쳐서 그 주소로 보내요/);
  assert.doesNotMatch(desk(project()),/desk-mail/,'메일 상태가 없으면 줄도 없다');
});
