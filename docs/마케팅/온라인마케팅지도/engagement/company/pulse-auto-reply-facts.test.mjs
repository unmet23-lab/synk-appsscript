// PULSE 운영 조각 5(2026-11-12, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S3 「24시간 — 자동 안내」 · 8절 P1 「자동 안내를 풀기만 함」):
// 자동 안내의 사실 묶음이 의뢰 흐름을 안다 — 프로젝트 단계(「접수」 · 「협의」) 대신 고객 방과 같은 규칙으로 만든 지금 차례, 결제 상태(요청 취소와 확인한 결제의 취소를 가름),
// 받으실 날(고객 방 의뢰서 칸과 같은 글), 남은 수정, 올린 작업 소식. 재료는 손님 보기뿐 — 결제 이력 · 취소 까닭 · 주문 번호 · 실수령 · 소식 초안 · 거둔 소식은 들지 않는다.
// 서버는 화면 파일을 가져오지 않으므로(정적 묶음 정책) 서버 쪽 규칙(pulse-room-facts.mjs)이 고객 방 함수 · 실제로 그린 글과 상태마다 같은지 여기서 견준다.
// 시각은 한국 시간. 키가 없어 운영에서는 꺼진 채 올라간다(켜는 것은 키를 붙여 넣은 뒤).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {pulseAutoReplyFacts,PULSE_AUTO_REPLY_SYSTEM} from './pulse-auto-reply.mjs';
import {customerRoomFacts,roomPayHow,ROOM_PACKAGES} from './pulse-room-facts.mjs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {roomModel,roomState,ROOM_STAGES}=await import('./public/pulse-app/room-view.mjs');
const {roomView}=await import('./public/pulse-app/film-views.mjs');
const {emptyAnswers,PACKAGES,pkgOf}=await import('./public/pulse-app/request-data.mjs');

const KEY='sk-ant-api03-'+'f'.repeat(40);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const ANSWERS={name:'오미톡 오미자 스파클링',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝나고 목마른 20대',oneThing:'한 캔에 맛이 다섯 번 바뀐다',action:'buy',screenText:'다섯 가지 맛, 톡.',avoid:[],win:'story',refs:[],models:[],modelChoice:'ask',date:'',dateFree:true,approver:'one',contactName:'김합성',company:'합성 음료',email:'buyer@pulse-synthetic.test',phone:'',consent:true,rights:true,slots:{}};
const factsOf=call=>{const block=call.body.messages[0].content[0].text;assert.match(block,/^프로젝트 사실\(JSON\):\n/);return JSON.parse(block.slice(block.indexOf('\n')+1));};
const kst=iso=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,16).replace('T',' ');

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-auto-reply-facts-'));let offset=0;const calls=[];
  const clock=()=>new Date(Date.now()+offset).toISOString();
  const fakeFetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return {ok:true,status:200,text:async()=>JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({decision:'answer',reply:'지금 화면에 보이는 대로 진행하고 있어요.',handoffReason:'none'})}],usage:{input_tokens:2000,output_tokens:300}})};};
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3,clock,pulseAutoReplyFetch:fakeFetch};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const admin=app.store.createUser({name:'관리자',email:'founder@pulse-synthetic.test',role:'admin'});
  const token=app.store.mint('session',admin.id,{csrfToken:'staff-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  const remember=response=>{for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}};
  const parse=async response=>{let data=null;try{data=JSON.parse(await response.text());}catch{}return {status:response.status,data};};
  const call=async(path,{body,csrf=''}={})=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});remember(response);return parse(response);};
  const staff=async(path,{body,raw,headers={}}={})=>parse(await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}));
  const draft=(await call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await call('/pulse/api/request/submit',{body:{answers:ANSWERS},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const id=sent.data.projectId;let row=null;
  const act=async(body,expected=200)=>{row=(await staff('/api/client-projects/'+id+'/studio')).data.project;const result=await staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,...body}});assert.equal(result.status,expected,JSON.stringify(result.data));if(expected===200)row=result.data.project;return result;};
  const room=async()=>(await call('/pulse/api/project')).data;
  const customerAct=async body=>{const state=await room();const result=await call('/pulse/api/studio',{body:{revision:state.project.revision,...body},csrf:state.csrf});assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};
  const upload=async(name,purpose='')=>{row=(await staff('/api/client-projects/'+id+'/studio')).data.project;const result=await staff(`/api/client-projects/${id}/studio/media`,{raw:png,headers:{'Content-Type':'image/png','X-File-Name':encodeURIComponent(name),'X-Project-Revision':String(row.revision),...(purpose?{'X-Studio-Purpose':purpose}:{})}});assert.equal(result.status,201,JSON.stringify(result.data));row=result.data.project;return result.data.asset.id;};
  // 손님이 묻고, 자동 안내가 한 번 돈다. 그때 모델에 간 사실과 그 순간 손님 화면(고객 방)이 보인 차례를 함께 돌려준다.
  const ask=async text=>{
    offset+=60000;const state=await room();
    const asked=await call('/pulse/api/action',{body:{action:'support',text},csrf:state.csrf});assert.equal(asked.status,200,JSON.stringify(asked.data));
    offset+=1000;const before=calls.length;assert.deepEqual(await app.pulseAutoReply.tick(),{handled:1});assert.equal(calls.length,before+1,'문의 하나에 호출 하나');
    const screen=(await room()).project;
    return {facts:factsOf(calls.at(-1)),raw:calls.at(-1).body.messages[0].content[0].text,screen,model:roomModel(screen),shown:screenOf(screen),html:unescape(roomView(roomModel(screen),{bar:false}))};
  };
  const enable=async()=>{const saved=await staff('/api/settings/pulse-auto-reply',{body:{apiKey:KEY,enabled:true}});assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.enabled,true);};
  return {app,staff,act,room,customerAct,upload,ask,enable,clock,advance:ms=>{offset+=ms;},get row(){return row;}};
}
const scene=(extra={})=>({action:'save_scene',title:'컷 1',description:'벤치 위 캔',narration:'',screenText:'',duration:3,visibility:'customer',...extra});
// 고객 방이 실제로 그리는 것(roomModel → roomView): 차례 표시 · 제목 · 왼쪽 글 · 단계 · 의뢰서 칸의 받으실 날 · 정한 수정 횟수(feedback-rounds-view.mjs와 같은 셈).
const unescape=html=>html.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
function screenOf(p){
  const m=roomModel(p),html=roomView(m,{bar:false}),stage=ROOM_STAGES.find(item=>item.id===m.stage),r=p.studio?.request||{},proposed=r.directionProposal?.revisions;
  const pick=re=>{const found=html.match(re);assert.ok(found,'고객 방에 '+re);return unescape(found[1]);};
  return {state:roomState(p),stage:`${stage.no} ${stage.name}`,turn:{'is-you':'you','is-done':'done','':'us'}[pick(/<p class="sx-kicker sx-turn"><i class="([^"]*)"/)],
    title:pick(/<h1 class="sx-display" data-room-title>([\s\S]*?)<\/h1>/),text:pick(/<p class="sx-body sx-room-lead" data-room-in>([\s\S]*?)<\/p>/),
    due:m.brief.find(([key])=>key==='받으실 날')?.[1]||'',revisions:Number.isSafeInteger(proposed)?proposed:pkgOf(r.answers||{})?.revisions??null};
}
const TURNS={you:'고객 차례',us:'제작팀 차례',done:'끝남 — 고객이 완성본을 받았다고 확인함'};
// 손님 화면이 보이는 차례 · 받으실 날과 사실이 같은 글인지(근거가 하나).
function sameAsScreen(got){
  const {facts,shown}=got;
  assert.equal(facts.의뢰.지금.화면제목,shown.title);assert.equal(facts.의뢰.지금.화면안내,shown.text);assert.equal(facts.의뢰.지금.단계,shown.stage);
  assert.equal(facts.의뢰.지금.차례,TURNS[shown.turn]);
  assert.ok(shown.due,'고객 방 의뢰서 칸에 받으실 날이 있다');assert.equal(facts.의뢰.받으실날,shown.due);
  // 의뢰 흐름에는 프로젝트 단계 · 프로젝트 전달일 · 맨 위 다음 할 일이 없다(근거가 둘이 되지 않게).
  for(const key of ['단계','합의한전달일','고객이지금확인할일'])assert.equal(Object.hasOwn(facts.프로젝트,key),false,key);
}

test('실제 회사 서버 길: 방향을 고른 뒤 → 결제 차례 → 결제 요청 → 요청 취소 → 다시 요청 · 확인 → 작업 소식까지, 자동 안내 사실이 고객 방과 같은 차례 · 결제 · 받으실 날 · 수정 · 소식을 안다',async t=>{
  const f=await fixture(t);
  await f.act({action:'request_confirm'});
  const a=await f.upload('a.png'),b=await f.upload('b.png'),day=new Date(Date.parse(f.clock())+9*3600000);day.setUTCDate(day.getUTCDate()+10);
  const option=(assetId,name)=>({name,sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고'}],why:'대사로 풀려요.',assetId,recommended:name==='아니, 잠깐'});
  await f.act({action:'propose_direction',lead:'두 방향으로 나눴어요.',options:[option(a,'아니, 잠깐'),option(b,'톡')],modelId:'M06',price:290000,dueDate:day.toISOString().slice(0,10),revisions:2});
  await f.customerAct({action:'answer_direction',optionId:(await f.room()).project.studio.request.directionProposal.options[0].id});
  await f.enable();

  // ① 방향을 고른 뒤(1차안 준비): 제작팀 차례 · 결제 전 · 방향 제안에 적힌 날 · 정한 수정 2회.
  const chosen=await f.ask('다음엔 뭐가 와요?');
  assert.equal(chosen.model.state,'prepare');sameAsScreen(chosen);
  assert.equal(chosen.facts.의뢰.지금.화면제목,'이 방향으로 정했어요');assert.equal(chosen.facts.의뢰.지금.단계,'03 1차안');assert.equal(chosen.facts.의뢰.지금.차례,'제작팀 차례');
  assert.match(chosen.facts.의뢰.받으실날,/방향 제안에 적힌 날/);
  assert.equal(chosen.facts.의뢰.결제.상태,'아직 결제 전이에요. 글 콘티를 확인하신 뒤 크몽 결제를 안내해 드려요.');
  assert.deepEqual([chosen.facts.의뢰.수정.정한횟수,chosen.facts.의뢰.수정.쓴횟수,chosen.facts.의뢰.수정.남은횟수],[2,0,2]);
  assert.equal(chosen.facts.의뢰.상품,'15초 영상 · 한 편');
  assert.match(chosen.facts.오늘,/^\d{4}-\d{2}-\d{2} \([일월화수목금토]\)$/);assert.equal(chosen.facts.오늘.slice(0,10),kst(f.clock()).slice(0,10),'오늘은 서버 시계의 한국 날짜');
  assert.doesNotMatch(chosen.raw,/"단계":"(접수|협의)"/,'프로젝트 단계를 근거로 넘기지 않는다');

  // ② 글 콘티를 확인 → 결제 차례(요청 전) → 결제 요청.
  await f.act(scene());await f.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});await f.customerAct({action:'approve_draft',round:1});
  const paying=await f.ask('결제는 어떻게 해요?');
  assert.equal(paying.model.state,'pay');sameAsScreen(paying);
  assert.equal(paying.facts.의뢰.지금.화면제목,'글 콘티를 확인해 주셨어요');assert.equal(paying.facts.의뢰.지금.차례,'고객 차례');
  assert.match(paying.facts.의뢰.결제.상태,/^결제할 차례예요/);assert.equal(paying.facts.의뢰.받으실날,'결제한 날부터 10일');
  // 결제하는 법 · 접수 번호(조각 5 보강): 고객 방 결제 카드에 보이는 글 · 번호 그대로.
  assert.ok(paying.html.includes(paying.facts.의뢰.결제.방법),'결제 방법 = 결제 카드 「결제 · 취소 · 증빙」 글');assert.match(paying.facts.의뢰.결제.방법,/「문의하기」로 접수 번호를 보내 주시면/);
  assert.equal(paying.facts.의뢰.접수번호,paying.screen.studio.request.number);assert.match(paying.facts.의뢰.접수번호,/^P-[0-9]{4}-[0-9A-F]{4}$/);assert.ok(paying.html.includes(paying.facts.의뢰.접수번호),'결제 카드에 보이는 번호');
  await f.act({action:'payment_request',amount:290000});
  const requested=await f.ask('결제 요청 받았어요. 이제 뭐 하면 돼요?');
  sameAsScreen(requested);
  assert.equal(requested.facts.의뢰.지금.화면제목,'크몽에서 결제해 주세요');
  assert.equal(requested.facts.의뢰.결제.상태,'크몽 결제 요청을 보냈고, 아직 결제 확인 전이에요.');assert.equal(requested.facts.의뢰.결제.금액,'290,000원');
  assert.equal(requested.facts.의뢰.결제.요청한때,kst(f.row.studio.request.payment.requestedAt));
  // 앞 문의(이번에 답하는 문의가 아닌 것)는 대화 기록에 한국 시간으로.
  const earlier=(await f.room()).project.messages.find(m=>m.text==='결제는 어떻게 해요?');
  assert.equal(requested.facts.최근대화.find(m=>m.text==='결제는 어떻게 해요?').at,kst(earlier.at));

  // ③ 요청 취소(낸 돈 없음) — 취소 까닭은 사실에 없다.
  await f.act({action:'payment_cancel',note:'크몽 요청이 24시간 지나 닫힘 SECRET-CANCEL-NOTE'});
  const cancelled=await f.ask('결제가 취소됐다고 떠요');
  sameAsScreen(cancelled);
  assert.equal(cancelled.facts.의뢰.지금.화면제목,'결제가 취소됐어요');
  assert.equal(cancelled.facts.의뢰.결제.상태,'결제 요청을 취소했어요. 결제된 돈은 없어요.');assert.equal(cancelled.facts.의뢰.결제.금액,undefined);

  // ④ 다시 요청 · 확인(주문 번호 · 실수령) → 장면 이미지 준비, 결제 확인 때 정한 날.
  await f.act({action:'payment_request',amount:300000});
  await f.act({action:'payment_confirm',ref:'KM-SECRET-REF',net:240000});
  // 작업 소식: 올린 것 하나 · 초안 하나 · 올렸다 거둔 것 하나.
  const shot=await f.upload('비공개-작업화면.png','progress');
  await f.act({action:'progress_save',text:'장면 이미지를 그리고 있어요. POSTED-NEWS',stage:'draft',assets:[shot]});
  await f.act({action:'progress_post',id:f.row.studio.request.progress[0].id});
  await f.act({action:'progress_save',text:'다음 컷 손 모양 SECRET-DRAFT-TEXT'});
  await f.act({action:'progress_save',text:'곧 거둘 소식 WITHDRAWN-NEWS'});
  const gone=f.row.studio.request.progress.find(item=>item.text.includes('WITHDRAWN-NEWS')).id;
  await f.act({action:'progress_post',id:gone});await f.act({action:'progress_withdraw',id:gone});
  const paid=await f.ask('결제했는데 언제 받을 수 있어요?');
  assert.equal(paid.model.state,'prepare-images');sameAsScreen(paid);
  assert.equal(paid.facts.의뢰.지금.화면제목,'결제를 확인했어요');assert.equal(paid.facts.의뢰.지금.차례,'제작팀 차례');
  assert.equal(paid.facts.의뢰.결제.상태,'결제를 확인했어요.');assert.equal(paid.facts.의뢰.결제.금액,'300,000원');
  assert.match(paid.facts.의뢰.받으실날,/결제 확인 때 정한 날/);
  assert.equal(paid.facts.의뢰.결제.확인한때,kst(f.row.studio.request.payment.confirmedAt));assert.equal(paid.facts.의뢰.결제.방법,undefined,'결제를 확인한 뒤에는 결제하는 법을 넣지 않는다');
  assert.deepEqual(paid.facts.의뢰.작업소식.map(item=>[item.단계,item.그림,item.글]),[['1차안','1장','장면 이미지를 그리고 있어요. POSTED-NEWS']]);
  // 손님 보기 밖의 것은 어디에도 없다: 결제 이력 · 취소 까닭 · 주문 번호 · 실수령 · 소식 초안 · 거둔 소식 · 직원이 올린 파일 이름.
  const leak=paid.raw.match(/SECRET-CANCEL-NOTE|KM-SECRET-REF|240,?000|SECRET-DRAFT-TEXT|WITHDRAWN-NEWS|비공개-작업화면|paymentLog|"net"|"ref"|requestedBy|confirmedBy|cancelledBy/);
  assert.equal(leak,null,leak?paid.raw.slice(Math.max(0,leak.index-120),leak.index+120):'');

  // ⑤ 확인한 결제를 취소(환불)하면 요청 취소와 다른 말.
  await f.act({action:'payment_cancel',note:'전액 환불 SECRET-REFUND-NOTE'});
  const refunded=await f.ask('환불됐나요?');
  assert.equal(refunded.facts.의뢰.결제.상태,'확인했던 결제를 취소했어요. 환불과 다시 진행은 담당자가 안내해요.');assert.equal(refunded.facts.의뢰.결제.금액,'300,000원');
  assert.doesNotMatch(refunded.raw,/SECRET-REFUND-NOTE/);
});

// ── 손님 보기 꼴 그대로의 단위 시험(고객 방 시험 pulse-progress-screen.test.mjs의 project() 꼴) ──
const T=(hour,minute=0)=>new Date(Date.UTC(2026,10,12,hour,minute)).toISOString();
const N=n=>`bbbbbbbb-0000-4000-8000-${String(n).padStart(12,'0')}`;
const project=(request={},extra={})=>({id:'p1',title:'오미톡',customerName:'합성 음료',ownerName:'김하늘',stage:'planning',stageLabel:'협의',dueDate:'2026-12-01',nextStep:'',revision:3,versions:[],messages:[],
  studio:{assets:[],scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:false,maxItems:20,nextNumber:1},
    request:{status:'confirmed',number:'P-2026-ABCD',submittedAt:T(0),confirmedAt:T(1),confirmedBy:'김하늘',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],rounds:[],...request}},...extra});
const facts=(p,now=T(5))=>JSON.parse(pulseAutoReplyFacts(p,'',{now}));

test('사진 상품 · 결제 상태 · 끝난 의뢰: 고객 방 글 그대로, 결제 기록 없는 옛 제작 의뢰는 결제를 말하지 않는다',()=>{
  const photo=answers=>({...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'photo',...answers});
  // 사진 상품 결제 요청: 「나머지 장」 글(영상의 「장면 이미지」가 아니다).
  const sheet={round:1,kind:'images',sentAt:T(2),approvedAt:T(3)};
  const paying=facts(project({answers:photo(),rounds:[sheet],payment:{status:'requested',requestedAt:T(4),amount:99000}}));
  assert.equal(paying.의뢰.지금.화면안내,'크몽 메시지로 결제 요청을 보내 드렸어요. 결제가 확인되면 나머지 장을 만들어요.');
  assert.equal(paying.의뢰.상품,'사진 · 모델이 제품을 든 사진 5장');assert.equal(paying.의뢰.결제.금액,'99,000원');
  assert.equal(paying.의뢰.지금.화면안내,screenOf(project({answers:photo(),rounds:[{...sheet,scenes:[]}],payment:{status:'requested',requestedAt:T(4),amount:99000}})).text);
  // 사진 상품 결제 전: 「첫 장을 확인하신 뒤」.
  assert.match(facts(project({answers:photo()})).의뢰.결제.상태,/첫 장을 확인하신 뒤/);
  // 영상 결제 전은 글 콘티를 확인하기 전까지만(글 콘티 판이 와서 보는 중 · 고치는 중) — 결제 기록 없이 그 뒤로 간 옛 의뢰는 결제를 말하지 않는다(조각 5 끝 판 카본 A1).
  const script=(extra={})=>({round:1,kind:'script',sentAt:T(2),...extra}),images=(extra={})=>({round:2,kind:'images',sentAt:T(3),...extra});
  assert.match(facts(project({rounds:[script()]})).의뢰.결제.상태,/^아직 결제 전이에요/,'글 콘티를 보는 중');
  assert.match(facts(project({rounds:[script({feedbackAt:T(3)})]})).의뢰.결제.상태,/^아직 결제 전이에요/,'글 콘티를 고치는 중');
  for(const [name,request] of [['장면 이미지 판이 옴',{rounds:[script({approvedAt:T(3)}),images()],scriptApprovedAt:T(3)}],['장면 이미지를 고치는 중',{rounds:[script({approvedAt:T(3)}),images({feedbackAt:T(4)})],scriptApprovedAt:T(3)}],['글 콘티 확인 기록이 판에만 남은 옛 의뢰',{rounds:[script({approvedAt:T(3)})]}]]){
    const got=facts(project(request));assert.equal(got.의뢰.결제,undefined,name);assert.doesNotMatch(JSON.stringify(got),/아직 결제 전/,name);
  }
  // 결제 기록 없이 제작 중인 옛 의뢰: 결제 칸 없음(「결제 전」으로 짐작하지 않는다).
  const making=facts(project({approvedAt:T(3)},{stage:'producing'}));
  assert.equal(making.의뢰.지금.화면제목,'확인하신 컷으로 만들고 있어요');assert.equal(making.의뢰.결제,undefined);
  // 수령 확인까지 끝난 의뢰: 끝남.
  const done=facts(project({approvedAt:T(2)},{stage:'delivered',versions:[{id:'v9',kind:'final',label:'최종본',createdAt:T(3)}],closeout:{receipt:{confirmedAt:T(4)}}}));
  assert.equal(done.의뢰.지금.차례,'끝남 — 고객이 완성본을 받았다고 확인함');assert.equal(done.의뢰.지금.단계,'05 영상 · 납품');
  // 의뢰서가 없는 옛 프로젝트는 앞 판 그대로(프로젝트 단계 · 전달일 · 다음 할 일).
  const legacy=facts({title:'옛 프로젝트',stageLabel:'제작',dueDate:'2026-10-24',nextStep:'첫 시안을 보고 의견을 남겨 주세요.',versions:[],messages:[],studio:{}});
  assert.equal(legacy.프로젝트.단계,'제작');assert.equal(legacy.프로젝트.합의한전달일,'2026-10-24');assert.equal(legacy.의뢰,undefined);
});

test('남은 수정은 고객 화면과 같은 셈(방향 제안 횟수 → 없으면 패키지, 보낸 의견 묶음 하나가 한 번) — 다 쓰면 약속 문장까지',()=>{
  const rounds=n=>Array.from({length:n},(_,i)=>({id:'f'+i,number:i+1,submittedAt:T(2+i),items:[]}));
  const withRounds=(n,request={})=>{const p=project(request);p.studio.feedbackRounds.rounds=rounds(n);return facts(p);};
  assert.deepEqual(withRounds(1).의뢰.수정,{정한횟수:2,쓴횟수:1,남은횟수:1,세는법:'시안에 보낸 의견 묶음 하나가 한 번이에요.'},'패키지 15초는 2회');
  const used=withRounds(3,{directionProposal:{status:'chosen',revisions:3,options:[]}}).의뢰.수정;
  assert.equal(used.정한횟수,3,'방향 제안에 적힌 횟수가 먼저');assert.equal(used.남은횟수,0);assert.match(used.세는법,/다 썼어요/);assert.match(used.세는법,/합의와 다르게 만든 부분은 횟수와 상관없이 바로잡아요/);
  assert.equal(withRounds(5).의뢰.수정.남은횟수,0,'0 아래로 내려가지 않는다');
  // 정한 횟수가 없는 상품(기업)은 수정 칸이 없다.
  assert.equal(facts(project({answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'corp'}})).의뢰.수정,undefined);
});

test('작업 소식은 손님 보기의 올린 소식 최근 다섯(오래된 것부터), 단계 이름 · 그림은 장 수만 · 시각은 한국 시간 · 오늘은 한국 날짜와 요일',()=>{
  const progress=Array.from({length:7},(_,i)=>({id:N(i+1),at:T(1+i,30),...(i===6?{stage:'make'}:{}),text:'소식 '+(i+1),assets:i===6?[N(20),N(21),N(22),N(23),N(24)]:[]}));
  progress.push({id:N(9),at:'깨진 때',text:'읽을 수 없는 소식'},{id:N(10),at:T(9),text:'   '});
  const got=facts(project({progress:[...progress].reverse()}),T(16)).의뢰.작업소식;
  assert.deepEqual(got.map(item=>item.글),['소식 3','소식 4','소식 5','소식 6','소식 7']);
  assert.equal(got.at(-1).단계,'제작');assert.equal(got.at(-1).그림,'4장','그림은 넷까지');assert.equal(got[0].그림,undefined);
  assert.equal(got.at(-1).올린때,'2026-11-12 16:30','UTC 07:30 → 한국 16:30');
  assert.ok(got.every(item=>!Object.hasOwn(item,'id')&&!Object.hasOwn(item,'assets')));
  // 한국 날짜가 넘어가는 때: UTC 16:00 = 한국 다음 날 01:00(금요일).
  const late=facts(project({},{messages:[{id:'m1',author:'customer',action:'support',text:'앞 문의',at:T(15,40)}]}),T(16));
  assert.equal(late.오늘,'2026-11-13 (금)');assert.equal(late.최근대화[0].at,'2026-11-13 00:40');
  // 안쪽 칸의 시각도 한국 시간(조각 5 서버 검수 GA1) — 날짜만 있는 값은 그대로.
  const nested=project({},{closeout:{receipt:{confirmedAt:T(16)}},previewApproval:{dueDate:'2026-11-20'}});nested.studio.feedbackRounds.rounds=[{id:'f1',number:1,submittedAt:T(15,30),items:[]}];
  const nestedFacts=facts(nested,T(16));
  assert.equal(nestedFacts.수정의견정리.rounds[0].submittedAt,'2026-11-13 00:30');assert.equal(nestedFacts.마무리.receipt.confirmedAt,'2026-11-13 01:00');assert.equal(nestedFacts.시안확인.dueDate,'2026-11-20');
  assert.doesNotMatch(JSON.stringify(nestedFacts),/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/,'UTC 시각 글자가 남지 않는다');
  // 담당자 안내(고객 방 일지 머리에 고정된 글)는 「의뢰」 안으로.
  assert.equal(facts(project({},{nextStep:'로고 파일을 보내 주세요.'})).의뢰.담당자안내,'로고 파일을 보내 주세요.');
});

// 서버 규칙(pulse-room-facts.mjs)과 고객 방이 상태마다 같은가 — 화면 글 · 차례 규칙 · 받으실 날 · 패키지를 바꾸면 여기서 떨어진다(서버 쪽도 함께 고친다).
test('고객 방 일치: 상태 · 단계 · 차례 표시 · 제목 · 왼쪽 글 · 받으실 날 · 정한 수정 횟수가 고객 방이 실제로 그리는 것과 같다(모든 상태 · 사진 · 결제 갈래)',()=>{
  const photo={...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'photo'};
  const option=(id,name)=>({id,name,sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고'}],why:'대사로 풀려요.',assetId:'',recommended:false});
  const direction=(extra={})=>({round:1,at:T(1,30),status:'open',lead:'두 방향으로 나눴어요.',options:[option('o1','아니, 잠깐'),option('o2','톡')],modelId:'M06',price:290000,dueDate:'2026-11-24',revisions:3,...extra});   // 패키지(15초 2회)와 다른 횟수 — 방향 제안 것이 먼저
  const round=(kind,extra={})=>({round:1,kind,sentAt:T(2),scenes:[],...extra});
  const cases={
    '쓰는 중':project({status:'writing'}),
    '확인 중':project({status:'submitted',confirmedAt:undefined}),
    '확인 중 · 사진':project({status:'submitted',confirmedAt:undefined,answers:photo}),
    '되묻기':project({asks:[{id:'a1',label:'로고',status:'open',at:T(2)}]}),
    '방향 둘':project({directionProposal:direction()}),
    '방향 셋':project({directionProposal:direction({options:[option('o1','가'),option('o2','나'),option('o3','다')]})}),
    '방향 다시':project({directionProposal:direction({status:'declined',answeredAt:T(2)})}),
    '방향 둘째 판도 아님':project({directionProposal:direction({round:2,status:'declined',answeredAt:T(2)})}),
    '모델 제안':project({modelProposal:{modelId:'M06',status:'open',at:T(2)}}),
    '모델 제안 · 사진':project({answers:photo,modelProposal:{modelId:'M06',status:'open',at:T(2)}}),
    '1차안 준비':project({}),
    '방향 고른 뒤':project({directionProposal:direction({status:'chosen',chosenId:'o1',answeredAt:T(2)})}),
    '첫 장 준비 · 사진':project({answers:photo}),
    '글 콘티 옴':project({directionProposal:direction({status:'chosen',chosenId:'o1'}),rounds:[round('script')]}),
    '장면 이미지 옴':project({rounds:[round('script',{approvedAt:T(3)}),round('images',{round:2})],scriptApprovedAt:T(3),payment:{status:'confirmed',confirmedAt:T(3,30),dueDate:'2026-11-22'}}),
    '고치는 중':project({rounds:[round('script',{feedbackAt:T(3)})]}),
    '결제 차례(요청 전)':project({directionProposal:direction({status:'chosen',chosenId:'o1'}),rounds:[round('script',{approvedAt:T(3)})],scriptApprovedAt:T(3)}),
    '결제 요청':project({rounds:[round('script',{approvedAt:T(3)})],scriptApprovedAt:T(3),payment:{status:'requested',requestedAt:T(4),amount:290000}}),
    '결제 요청 · 사진':project({answers:photo,rounds:[round('images',{approvedAt:T(3)})],payment:{status:'requested',requestedAt:T(4),amount:99000}}),
    '결제 차례 · 사진':project({answers:photo,rounds:[round('images',{approvedAt:T(3)})]}),
    '결제 요청 취소':project({rounds:[round('script',{approvedAt:T(3)})],scriptApprovedAt:T(3),payment:{status:'cancelled',requestedAt:T(4),cancelledAt:T(5),amount:290000}}),
    '결제 확인':project({directionProposal:direction({status:'chosen',chosenId:'o1'}),rounds:[round('script',{approvedAt:T(3)})],scriptApprovedAt:T(3),payment:{status:'confirmed',requestedAt:T(4),confirmedAt:T(5),amount:290000,dueDate:'2026-11-22'}}),
    '제작':project({approvedAt:T(6),payment:{status:'confirmed',confirmedAt:T(5),dueDate:'2026-11-22'}},{stage:'producing'}),
    '제작 · 사진':project({answers:photo,approvedAt:T(6)},{stage:'producing'}),
    '영상 옴':project({approvedAt:T(6)},{stage:'review',versions:[{id:'v1',kind:'preview',label:'1차 시안',createdAt:T(7)}]}),
    '납품':project({approvedAt:T(6)},{stage:'delivered',versions:[{id:'v9',kind:'final',label:'최종본',createdAt:T(8),guide:'올릴 곳마다 파일이 있어요.'}]}),
    '수령 끝':project({approvedAt:T(6)},{stage:'delivered',versions:[{id:'v9',kind:'final',label:'최종본',createdAt:T(8),guide:'안내'}],closeout:{receipt:{confirmedAt:T(9)}}}),
    '기업 · 기간 협의':project({answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'corp'}}),
    '추천해 주세요':project({answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'ask'}}),
    '구성 안 고름':project({answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:''}}),
    '보내기 전':project({status:'writing',submittedAt:undefined}),
  };
  const states=new Set();
  for(const [name,p] of Object.entries(cases)){
    const server=customerRoomFacts(p),shown=screenOf(p);states.add(shown.state);
    assert.deepEqual({state:server.state,stage:server.stage,turn:server.turn,title:server.title,text:server.text,due:server.due,revisions:server.revisions},shown,name);
  }
  for(const state of ['write','check','ask','direction','redirect','model','prepare','prepare-images','script','images','revise','pay','make','review','deliver','done'])assert.ok(states.has(state),'다룬 상태: '+state);
  // 패키지: 서버 표 = 화면 표(이름 · 기간 · 수정 횟수 · 사진).
  assert.deepEqual(Object.keys(ROOM_PACKAGES).sort(),PACKAGES.map(item=>item.id).sort());
  for(const item of PACKAGES)assert.deepEqual(ROOM_PACKAGES[item.id],{label:item.label,title:item.title,...(item.days?{days:item.days}:{}),...(item.revisions?{revisions:item.revisions}:{}),...(item.photo?{photo:true}:{})},item.id);
  // 결제하는 법: 영상은 결제 카드 「결제 · 취소 · 증빙」의 결제 글 그대로, 사진은 결제 카드 세 걸음(사진 글)을 이은 것.
  assert.ok(unescape(roomView(roomModel(cases['결제 차례(요청 전)']),{bar:false})).includes(roomPayHow(false)));
  const photoPay=unescape(roomView(roomModel(cases['결제 차례 · 사진']),{bar:false}));
  for(const step of ['크몽 상품에서 「문의하기」로 접수 번호를 보내','같은 값 · 기간 · 수정 횟수로 결제 요청을 보내 드려요','결제하시면 확인한 뒤 나머지 장을 만들어요']){assert.ok(photoPay.includes(step),step);assert.ok(roomPayHow(true).includes(step),step);}
  assert.doesNotMatch(roomPayHow(true),/글 콘티|장면 이미지/,'사진 상품 결제 글에 영상 낱말이 없다');
  // 접수 번호: 고객 방 머리 · 결제 카드의 번호, 꼴이 다르면 넣지 않는다.
  assert.equal(customerRoomFacts(cases['결제 요청']).number,'P-2026-ABCD');assert.equal(customerRoomFacts(project({number:'<b>x</b>'})).number,'');
  // 의뢰서가 없는 프로젝트는 null.
  assert.equal(customerRoomFacts({studio:{}}),null);assert.equal(customerRoomFacts(null),null);
});

test('서버 규칙 모듈은 화면 파일을 가져오지 않는다(정적 묶음 교체로 서버 동작이 바뀌지 않게)',async()=>{
  for(const file of ['pulse-room-facts.mjs','pulse-auto-reply.mjs']){
    const source=await readFile(new URL('./'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/from\s*['"]\.\/public\//,file);
  }
});

test('지시문: 「의뢰.…」 규칙은 「의뢰」가 있는 프로젝트 아래에만 — 의뢰서가 없는 옛 프로젝트는 프로젝트 단계 · 합의한 전달일 · 범위로 답한다(조각 5 끝 판 카본 A1)',()=>{
  const lines=PULSE_AUTO_REPLY_SYSTEM.split('\n'),start=lines.findIndex(line=>line.startsWith('- 「의뢰」가 있는 프로젝트'));
  assert.ok(start>0,'「의뢰」가 있는 프로젝트 줄');
  assert.ok(lines.some(line=>line.startsWith('- 「의뢰」가 없는 프로젝트')&&line.includes('합의한전달일')&&line.includes('제작범위와수정조건')),'옛 프로젝트 줄');
  lines.forEach((line,i)=>{if(line.includes('「의뢰.')&&!line.startsWith('5. '))assert.ok(i>start&&line.startsWith('  - '),'「의뢰」 아래가 아닌 줄: '+line);});
});
