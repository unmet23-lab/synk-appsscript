// 의뢰 기록 90일 시계(판 4 설계 11-7, 11-18 유호님 「자율주행」 → (a) · Fable 5.2 설계 검토 「고쳐서 진행」 D1~D10 반영).
// 의뢰서를 낸 프로젝트(공개 의뢰서 · 방 안 의뢰서, 담당자 확인 전후)가 제작으로 이어지지 않은 채 90일 움직이지 않으면 76일째 담당자 예고 → 14일 뒤
// 손님 답 · 연락처 · 보낸 파일 · 대화를 지운다. 결제가 확인됐다가 취소된 의뢰는 결제 기록만 남긴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {requestClock,paymentEverConfirmed,stoppedNoticeDue,stoppedDeleteDue,kstDayEnd,kstToday} from './pulse-personas.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';

const DAY=86400000,isoOf=ms=>new Date(ms).toISOString(),endOf=ms=>kstDayEnd(kstToday(isoOf(ms)));
const afterDay=ms=>Date.parse(endOf(ms))+60000;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const answers=(extra={})=>({name:'오미톡 오미자 스파클링',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝나고 목마른 20대',oneThing:'한 캔에 맛이 다섯 번 바뀐다',action:'buy',screenText:'다섯 가지 맛, 톡.',avoid:['갈증 해소'],win:'impact',refs:[{url:'https://youtu.be/example',points:['카메라 · 속도'],why:''}],models:['M06'],date:'2026-11-21',approver:'one',contactName:'김합성',company:'합성 음료',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra});

test('시계 계산: 의뢰서(동의)가 있고 제작 신호가 없을 때만 · 결제는 이력으로(D1) · 붙잡는 인물의 움직임까지(D4) · 예고는 마지막 움직임 뒤의 것만',()=>{
  const t0=Date.parse('2026-11-18T03:00:00Z'),personas=[];
  const store={all:kind=>kind==='pulsePersonas'?personas:[]};
  const row=(request={},extra={})=>({id:'p1',updatedAt:isoOf(t0),versions:[],deliveryReceipts:[],closureHistory:[],studio:{request:{status:'submitted',consentAt:isoOf(t0),...request}},...extra});
  assert.equal(requestClock(store,row({consentAt:undefined}),isoOf(t0)),null,'동의 줄을 본 적 없는 프로젝트(담당자가 만든 것)는 시계 밖');
  assert.equal(requestClock(store,row({status:'retired'}),isoOf(t0)),null,'이미 지운 의뢰');
  for(const signal of [{approvedAt:isoOf(t0)},{payment:{status:'confirmed',confirmedAt:isoOf(t0)}}])assert.equal(requestClock(store,row(signal),isoOf(t0)),null,JSON.stringify(signal));
  for(const extra of [{versions:[{id:'v'}]},{deliveryReceipts:[{id:'r'}]},{closureHistory:[{id:'c'}]}])assert.equal(requestClock(store,row({},extra),isoOf(t0)),null,JSON.stringify(extra));
  const clock=requestClock(store,row(),isoOf(t0+DAY));
  assert.deepEqual(clock,{lastAt:isoOf(t0),clockAt:isoOf(t0+90*DAY),noticeFrom:isoOf(t0+76*DAY),noticed:false,noticeAt:null,deleteAt:endOf(t0+90*DAY)});
  assert.equal(stoppedNoticeDue(clock,isoOf(t0+76*DAY-1)),false);assert.equal(stoppedNoticeDue(requestClock(store,row(),isoOf(t0+76*DAY)),isoOf(t0+76*DAY)),true);
  // 예고 전이면 지우는 날 = max(90일, 지금 + 14일) — 배포 · 복원 직후의 옛 날짜도 예고 없이 지우지 않는다.
  assert.equal(requestClock(store,row(),isoOf(t0+300*DAY)).deleteAt,endOf(t0+314*DAY));
  // 예고가 마지막 움직임과 같은 밀리초면 예고가 아니다(움직임이 먼저인 것으로 본다).
  const same=requestClock(store,row({},{requestRetentionNotice:{at:isoOf(t0)}}),isoOf(t0+80*DAY));assert.equal(same.noticed,false);
  const sent=requestClock(store,row({},{requestRetentionNotice:{at:isoOf(t0+80*DAY)}}),isoOf(t0+80*DAY+1));
  assert.equal(sent.noticed,true);assert.equal(sent.deleteAt,endOf(t0+94*DAY),'늦게 나간 예고는 예고 + 14일을 다 채운다');
  assert.equal(stoppedDeleteDue(sent,isoOf(t0+94*DAY)),false,'보인 날이 끝나기 전에는 지우지 않는다');assert.equal(stoppedDeleteDue(sent,isoOf(afterDay(t0+94*DAY))),true);
  // D1: 확인 → 취소 → 다시 요청이면 payment에는 confirmedAt이 없지만 이력에 확인이 있다 — 지울 때 결제 기록을 남긴다.
  const log=[{kind:'requested',at:isoOf(t0)},{kind:'confirmed',at:isoOf(t0)},{kind:'cancelled',at:isoOf(t0),was:'confirmed'},{kind:'requested',at:isoOf(t0)}];
  const refunded=row({payment:{status:'requested',requestedAt:isoOf(t0)},paymentLog:log});
  assert.equal(paymentEverConfirmed(refunded.studio.request),true);assert.equal(requestClock(store,refunded,isoOf(t0)).keepPayment,true);
  assert.equal(paymentEverConfirmed({payment:{status:'cancelled',confirmedAt:isoOf(t0),cancelledAt:isoOf(t0)}}),true,'이력이 없는 옛 결제는 그때의 payment로');
  assert.equal(paymentEverConfirmed({payment:{status:'requested'}}),false);assert.equal(requestClock(store,row({payment:{status:'requested'}}),isoOf(t0)).keepPayment,undefined);
  // D4: 이 프로젝트를 붙잡는 인물(브랜드 없는 인물 · 열린 인물)이 더 늦게 움직였으면 그날부터.
  personas.push({id:'a',originProjectId:'p1',workspaceId:null,status:'ready',updatedAt:isoOf(t0+30*DAY)},{id:'b',originProjectId:'p1',workspaceId:'w',status:'ready',updatedAt:isoOf(t0+60*DAY)},{id:'c',originProjectId:'p2',workspaceId:null,status:'ready',updatedAt:isoOf(t0+70*DAY)});
  assert.equal(requestClock(store,row(),isoOf(t0)).lastAt,isoOf(t0+30*DAY),'브랜드에 묶여 정리된 인물 · 다른 프로젝트의 인물은 보지 않는다');
  personas.push({id:'d',originProjectId:'p1',workspaceId:null,status:'ready',updatedAt:'언젠가'});
  assert.deepEqual(requestClock(store,row(),isoOf(t0)),{unclear:'date'},'날짜를 못 읽으면 지우지 않는다');
  personas.length=0;
  assert.deepEqual(requestClock(store,row({},{updatedAt:'?'}),isoOf(t0)),{unclear:'date'});
});

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-request-clock-'));
  const f={directory,stamp:Date.parse('2026-11-18T03:00:00Z')};
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,
    pulseRequestFreeBytes:async()=>100*1024**3,clock:()=>new Date(f.stamp).toISOString()};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},6000);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  function remember(response){for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}}
  async function call(path,{body,raw,headers={},csrf=''}={}){
    const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});
    remember(response);const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data};
  }
  async function staff(path,{body}={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data};
  }
  // 공개 의뢰서 하나(파일 하나) — 프로젝트 id.
  f.send=async()=>{
    jar.clear();const draft=(await call('/pulse/api/request/start',{body:{}})).data.draft;
    const up=await call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':encodeURIComponent('front.png'),'X-Request-Slot':'front'}});assert.equal(up.status,201,JSON.stringify(up.data));
    const sent=await call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));return sent.data.projectId;
  };
  f.row=id=>app.store.get('clientProjects',id);
  f.put=(id,change)=>app.store.put('clientProjects',id,change(f.row(id)));
  // 공개 의뢰서 대기 줄을 떼어 담당자가 만든 프로젝트의 방 안 의뢰서처럼(옛 정리가 보지 않던 꼴).
  f.unlist=id=>{for(const line of app.store.all('pulseRequests').filter(item=>item.projectId===id))app.store.remove('pulseRequests',line.id);};
  f.sweep=options=>app.pulseRequests.retireUnconfirmed(options);
  f.media=()=>join(options.dataDir,'studio-media');
  Object.assign(f,{app,staff,owner,options});
  return f;
}

test('의뢰서를 낸 프로젝트는 확인 전후 · 방 안 의뢰서 · 보관과 상관없이 76일째 예고(시작 회차도 예고만) → 14일 뒤 지움, 움직이면 다시 90일, 동의가 없는 프로젝트는 그대로',async t=>{
  const f=await fixture(t),{store}=f.app,start=f.stamp;
  const open=await f.send(),room=await f.send(),noConsent=await f.send(),refunded=await f.send(),archived=await f.send(),moved=await f.send();
  // room: 담당자가 확인한 뒤 멈춘 방 안 의뢰서 꼴 — 내부 메모 · 조건 · 인물 예고 기록 줄(인물 이름)과 곁 문서(권리 · 자료 사용 · 직원 초안 · 자동 안내)가 있다.
  f.unlist(room);
  f.put(room,row=>({...row,internalNotes:'김합성 님과 통화 — 다음 주 다시',terms:'15초 한 편',studio:{...row.studio,request:{...row.studio.request,status:'confirmed',confirmedAt:isoOf(start)}},
    history:[...row.history,{id:randomUUID(),actor:'system',action:'맞춤 인물 지우기 예고(제작으로 이어지지 않은 채 90일 동안 진행 없음)',at:isoOf(start),notice:'persona_retention',personaId:'gone',personaName:'김실명',deleteAt:isoOf(start)}]}));
  store.put('clientRights',room,{ciphertext:store.encrypt({projectId:room,note:'로고 권리 확인'})});
  store.put('clientMaterialUsage',room,{ciphertext:store.encrypt({projectId:room})});
  store.put('clientDrafts',f.owner.id+'|'+room+'|project',{schema:1,ownerId:f.owner.id,projectId:room,kind:'project',revision:1,status:'active',updatedAt:isoOf(start),ciphertext:store.encrypt({internalNotes:'초안'})});
  store.put('clientDrafts','other-staff|'+room+'|message',{schema:1,ownerId:'other-staff',projectId:room,kind:'message',revision:1,status:'active',updatedAt:isoOf(start),ciphertext:store.encrypt({text:'초안'})});
  store.put('pulseAutoReplies','reply-1',{id:'reply-1',projectId:room,messageId:'m',status:'skipped'});
  store.put('clientDrafts',f.owner.id+'|'+open+'|project',{schema:1,ownerId:f.owner.id,projectId:open,kind:'project',revision:1,status:'active',updatedAt:isoOf(start),ciphertext:'other-project'});
  // noConsent: 동의 줄을 본 적 없는 프로젝트(담당자가 만든 것) — 이 시계 밖.
  f.unlist(noConsent);f.put(noConsent,row=>({...row,studio:{...row.studio,request:(({consentAt,...rest})=>rest)(row.studio.request)}}));
  // refunded: 결제 확인 → 취소(환불) → 다시 요청 — 지금 payment에는 confirmedAt이 없다(D1).
  const log=[{kind:'requested',at:isoOf(start),by:'',amount:300000},{kind:'confirmed',at:isoOf(start),by:'',amount:300000},{kind:'cancelled',at:isoOf(start),by:'',was:'confirmed',amount:300000,note:'손님 사정으로 환불'},{kind:'requested',at:isoOf(start),by:'',amount:300000}];
  f.put(refunded,row=>({...row,studio:{...row.studio,request:{...row.studio.request,status:'confirmed',confirmedAt:isoOf(start),payment:{status:'requested',amount:300000,requestedAt:isoOf(start)},paymentLog:log}}}));
  f.put(archived,row=>({...row,stage:'archived'}));
  const files=await readdir(f.media());assert.equal(files.length,6);
  // 75일: 할 일 없음. 77일의 서버 시작 직후 회차: 예고만(동의가 있는 다섯).
  f.stamp=start+75*DAY;assert.deepEqual(await f.sweep(),{retired:0});
  f.stamp=start+77*DAY;assert.deepEqual(await f.sweep({startup:true}),{retired:0,requests:{noticed:5}});
  for(const id of [open,room,refunded,archived,moved]){
    const row=f.row(id);assert.equal(row.updatedAt,isoOf(start),'예고는 시계를 옮기지 않는다');assert.equal(row.requestRetentionNotice.deleteAt,endOf(start+91*DAY),'예고가 77일에 나갔으니 예고 + 14일');
    assert.equal(row.history.at(-1).notice,'request_retention');
  }
  assert.equal(f.row(noConsent).requestRetentionNotice,undefined,'동의가 없는 프로젝트는 예고도 없다');
  // 직원: 알림(보관한 프로젝트에서도) · 데스크 줄.
  const news=await f.staff('/api/client-projects/'+archived+'/news');assert.equal(news.status,200,JSON.stringify(news.data));
  const item=news.data.items.find(entry=>entry.type==='request_retention_notice');
  assert.ok(item,'보관한 프로젝트에서도 예고 알림');assert.equal(item.title,'의뢰 기록을 곧 지워요');assert.ok(item.text.includes(endOf(start+91*DAY).slice(0,10)),item.text);assert.match(item.href,/mode=staff.*tab=desk/);
  const studio=await f.staff('/api/client-projects/'+room+'/studio');assert.equal(studio.status,200,JSON.stringify(studio.data));
  assert.equal(studio.data.project.requestRetention.noticed,true);assert.equal(studio.data.project.requestRetention.deleteAt,endOf(start+91*DAY));
  assert.equal(studio.data.project.requestRetentionNotice,undefined,'저장된 예고 칸은 싣지 않는다(시계가 다시 계산한다)');
  const refundView=await f.staff('/api/client-projects/'+refunded+'/studio');assert.equal(refundView.data.project.requestRetention.keepPayment,true);
  const html=deskView({queue:[],brief:[],files:[],checks:[],number:'P-1',at:'',title:'의뢰',requestRetention:refundView.data.project.requestRetention});
  assert.match(html,/data-request-clock/);assert.ok(html.includes(endOf(start+91*DAY).slice(0,10)));assert.match(html,/결제 기록은 남겨요/);assert.match(html,/보관했으면 먼저 보관을 풀어/);
  assert.doesNotMatch(deskView({queue:[],brief:[],files:[],checks:[],number:'P-1',at:'',title:'의뢰',requestRetention:null}),/data-request-clock/);
  // 예고 뒤 움직임(직원 기록 한 줄): 예고가 풀리고 그날부터 다시 90일, 옛 예고 알림도 싣지 않는다(D3).
  f.stamp=start+80*DAY;
  const memo=await f.staff('/api/client-projects/'+moved+'/messages',{body:{revision:f.row(moved).revision,text:'손님과 일정 다시 잡는 중',visibility:'internal'}});assert.equal(memo.status,200,JSON.stringify(memo.data));
  assert.equal((await f.staff('/api/client-projects/'+moved+'/studio')).data.project.requestRetention,undefined,'예고가 풀리면 데스크 줄도 없다');
  assert.equal((await f.staff('/api/client-projects/'+moved+'/news')).data.items.some(entry=>entry.type==='request_retention_notice'),false,'움직인 뒤의 옛 예고는 싣지 않는다');
  // 보인 날(91일)이 끝나기 전에는 지우지 않는다. 끝난 뒤 첫 회차: 넷을 지운다.
  f.stamp=start+91*DAY;assert.deepEqual(await f.sweep(),{retired:0});
  f.stamp=afterDay(start+91*DAY);
  assert.deepEqual(await f.sweep(),{retired:4});
  const KEEP=['id','createdAt','revision','updatedAt','ownerId','reviewerId','teamId','history','notificationEvents','inviteRevision','receiptId','title','customerName','contact','summary','terms','nextStep','internalNotes','dueDate','nextContactDate','stage','inviteHash','inviteExpiresAt','versions','messages','studio'];
  for(const id of [open,room,refunded,archived]){
    const gone=f.row(id),text=JSON.stringify(gone);
    assert.deepEqual(Object.keys(gone).filter(key=>!KEEP.includes(key)),[],'남길 칸 밖의 칸이 없다');
    assert.equal(gone.stage,'archived');assert.equal(gone.studio.request.status,'retired');assert.equal(gone.studio.request.retiredAt,gone.updatedAt);assert.equal(gone.updatedAt,isoOf(f.stamp));
    for(const secret of ['김합성','buyer@pulse-synthetic.test','합성 음료','오미톡','김실명','로고 권리'])assert.equal(text.includes(secret),false,id+' '+secret);
    assert.equal(gone.inviteHash,null);assert.deepEqual(gone.messages,[]);assert.deepEqual(gone.studio.assets,[]);
  }
  const roomGone=f.row(room);
  assert.equal(roomGone.internalNotes,'');assert.equal(roomGone.terms,'');
  assert.ok(roomGone.history.some(entry=>entry.notice==='persona_retention'&&!('personaName' in entry)),'기록 줄은 남기고 인물 이름만 비운다(D8)');
  for(const kind of ['clientRights','clientMaterialUsage'])assert.equal(store.get(kind,room),null,kind);
  assert.equal(store.all('clientDrafts').filter(item=>item.projectId===room).length,0,'두 직원의 초안 모두(D5)');
  assert.equal(store.all('clientDrafts').filter(item=>item.projectId===open).length,0);
  assert.equal(store.get('pulseAutoReplies','reply-1'),null);
  // 결제가 확인됐다가 취소된 의뢰는 결제 기록만 남긴다(D7).
  const refundGone=f.row(refunded).studio.request;
  assert.deepEqual(refundGone.paymentLog,log);assert.equal(refundGone.payment.status,'requested');assert.deepEqual(refundGone.answers,{});
  // 동의가 없는 · 움직인 프로젝트는 그대로.
  assert.equal(f.row(noConsent).contact,'김합성 · buyer@pulse-synthetic.test');assert.equal(f.row(moved).contact,'김합성 · buyer@pulse-synthetic.test');
  assert.equal((await readdir(f.media())).length,2,'지운 넷의 파일만 지운다');
  // 지운 뒤에는 예고 알림을 싣지 않는다(보관 예외로 「지운 의뢰」에 남지 않게 — D3).
  assert.equal((await f.staff('/api/client-projects/'+archived+'/news')).data.items.some(entry=>entry.type==='request_retention_notice'),false);
  assert.equal((await f.staff('/api/client-projects/'+room+'/studio')).data.project.requestRetention,undefined);
  assert.equal(store.all('pulseRequests').filter(item=>[open,refunded,archived].includes(item.projectId)).length,0,'지운 의뢰의 대기 줄을 뗀다');
  assert.deepEqual(await f.sweep(),{retired:0},'다음 회차는 할 일 없음');
});

test('파일 지우기가 도중에 멈춘 지운 의뢰는 다음 보통 회차가 잇는다(D9) — 다른 문서가 가리키는 이름은 지우지 않는다',async t=>{
  const f=await fixture(t),{store}=f.app;
  const id=await f.send(),other=await f.send();
  const shared=f.row(other).studio.assets[0].diskName,orphan=randomUUID()+'.png';
  await writeFile(join(f.media(),orphan),png);
  // 문서 트랜잭션은 끝났고 파일은 남은 꼴: 지운 의뢰 + 남은 이름 목록(하나는 다른 의뢰가 아직 쓰는 이름).
  store.transaction(()=>f.app.clientProjects.retireRequestWithin(id,{request:{schemaVersion:1,number:'P-1',status:'retired',retiredAt:new Date(f.stamp).toISOString(),answers:{},files:[],asks:[],notes:[],rounds:[]}}));
  const mine=f.row(id).retirePendingUnlink;assert.equal(mine.length,1,'지운 의뢰의 파일 이름');
  f.put(id,row=>({...row,retirePendingUnlink:[...row.retirePendingUnlink,orphan,shared,'../escape.png']}));
  assert.deepEqual(await f.sweep({startup:true}),{retired:0},'시작 직후 회차는 잇지 않는다');
  for(const name of [...mine,orphan,shared])assert.ok(await stat(join(f.media(),name)));
  assert.deepEqual(await f.sweep(),{retired:0,requests:{resumed:1}});
  for(const name of [...mine,orphan])await assert.rejects(stat(join(f.media(),name)),name);
  assert.ok(await stat(join(f.media(),shared)),'다른 의뢰가 쓰는 파일은 그대로');
  assert.equal(f.row(id).retirePendingUnlink,undefined);
  assert.equal(f.row(other).studio.assets.length,1);
  assert.deepEqual(await f.sweep(),{retired:0});
});
