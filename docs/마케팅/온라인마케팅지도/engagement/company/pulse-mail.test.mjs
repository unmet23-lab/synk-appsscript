import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {Store} from './store.mjs';
import {createPulseMailService,pulseMailActed,pulseMailCompose,pulseMailMoment,pulseMailRecipient,pulseMailRelayKey,PULSE_MAIL_OUTBOX,PULSE_MAIL_SECRET} from './pulse-mail.mjs';

const RELAY='https://script.google.com/macros/s/AKfycbTESTrelay0123456789abcdef/exec';
const relaySource=await readFile(new URL('./pulse-mail-relay/relay.gs',import.meta.url),'utf8');
const answer=json=>({status:200,headers:{get:()=>null},body:{cancel:async()=>{}},text:async()=>JSON.stringify(json)});
const signed=bytes=>[...bytes].map(b=>b>127?b-256:b);

// 실제 relay.gs를 vm에서 돌리는 가짜 Apps Script 웹 앱 — POST는 302로 답 주소를 주고, GET이 그 답을 돌려준다.
function appsScript(getNow){
  const props=new Map(),sent=[];let pending=null;
  const ctx={BigInt,JSON,Math,Number,String,Date:class extends Date{static now(){return getNow();}},isFinite,parseInt,
    Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},base64Decode:v=>signed(Buffer.from(v,'base64')),computeDigest:(_,v)=>signed(createHash('sha256').update(v,'utf8').digest()),formatDate:d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10).replaceAll('-','')},
    PropertiesService:{getScriptProperties:()=>({getProperty:n=>props.has(n)?props.get(n):null,setProperty:(n,v)=>props.set(n,String(v)),deleteProperty:n=>props.delete(n),getProperties:()=>Object.fromEntries(props)})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>sent.push(JSON.parse(JSON.stringify(m)))},
    ContentService:{MimeType:{JSON:1},createTextOutput:text=>({text,setMimeType(){return this;}})}};
  vm.createContext(ctx);vm.runInContext(relaySource,ctx);
  const respond=(status,body,headers={})=>({status,headers:{get:name=>headers[name.toLowerCase()]??null},body:{cancel:async()=>{}},text:async()=>body});
  return {props,sent,
    async fetch(url,init){
      const href=String(url);
      if(init.method==='POST'){assert.equal(href,RELAY);assert.equal(init.redirect,'manual');pending=ctx.doPost({postData:{contents:init.body}}).text;return respond(302,'',{location:'https://script.googleusercontent.com/macros/echo?user_content_key=abc'});}
      assert.match(href,/^https:\/\/script\.googleusercontent\.com\/macros\/echo/);const body=pending;pending=null;return respond(200,body);
    }};
}

async function fixture(t,{stop=false}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-mail-'));const store=new Store(directory);
  let now='2026-11-08T03:00:00.000Z',service,override=null;const events=new Map(),calls=[];
  const clock=()=>now,ms=()=>Date.parse(now);
  const relay=appsScript(ms);
  t.after(async()=>{await service?.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const admin=store.createUser({name:'관리자',email:'founder@synk.im',role:'admin'}),member=store.createUser({name:'담당',email:'staff@pulse-mail.example',role:'member'});
  const fetchImpl=async(url,init)=>{calls.push({url:String(url),method:init.method,body:init.body?JSON.parse(init.body):null});if(override){const next=override(url,init,calls.length);if(next)return next;}return relay.fetch(url,init);};
  const logs=[];
  service=createPulseMailService({store,clock,fetchImpl,notificationsFor:row=>(events.get(row.id)||[]).filter(item=>!item.hidden).map(({hidden,...item})=>item),emergencyStop:()=>stop,log:entry=>logs.push(entry)});
  const project=(patch={})=>{const id=randomUUID(),row={id,title:'합성 프로젝트',stage:'planning',inviteHash:'hash',inviteRevision:1,updatedAt:now,studio:{request:{answers:{name:'오미톡',contactName:'김손님',email:'client@example.com',package:'standard'},rounds:[],directionProposal:{status:'open'}}},...patch};store.put('clientProjects',id,row);events.set(id,[]);return row;};
  const event=(row,type,extra={})=>{const item={id:`client:${row.id}:${events.get(row.id).length+1}:${type}:${extra.resource??'r'}`,type,createdAt:now,readAt:null,...extra};delete item.resource;events.get(row.id).push(item);return item;};
  const advance=minutes=>{now=new Date(ms()+minutes*60000).toISOString();};
  const connect=async()=>{service.configure(admin,{relayUrl:RELAY});relay.props.set('SERVER_KEY_N',store.secret(PULSE_MAIL_SECRET).n);await service.ping(admin);return service.configure(admin,{enabled:true});};
  const outbox=()=>store.all(PULSE_MAIL_OUTBOX).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  return {store,admin,member,relay,calls,logs,project,event,advance,connect,outbox,get service(){return service},set override(fn){override=fn;},get now(){return now;}};
}

test('메일 글: 제목 · 본문에 프로젝트 이름과 순간 줄, 줄바꿈 · 제어 문자 걷기, 열쇠 · 내부 번호 · 도구 이름 없음',()=>{
  const row={id:'p',inviteHash:'secret-hash',studio:{request:{answers:{name:'오미톡\r\nBcc: x@evil.test',contactName:'김\u0007손님',package:'standard'}}}};
  const {subject,body}=pulseMailCompose(row,'direction_proposed');
  assert.equal(subject,'〔SYNK PULSE〕 오미톡 Bcc: x@evil.test 광고, 방향을 골라 주세요');
  assert.doesNotMatch(subject+body,/[\r\u0007]|secret-hash|client:|Claude|GPT|Gemini|AI/);
  assert.match(body,/^김 손님님, SYNK PULSE입니다\.\n\n요청하신 내용은 그대로 두고/);
  assert.match(body,/https:\/\/workspace\.synk\.im\/pulse-app\/\n/);
  assert.match(pulseMailCompose({studio:{request:{answers:{package:'photo'}}}},'preview_ready').subject,/요청하신 광고 사진을 확인해 주세요$/);
  assert.match(pulseMailCompose({studio:{request:{answers:{}}}},'final_ready').body,/^안녕하세요, SYNK PULSE입니다/);
  for(const moment of ['draft_ready','preview_ready','final_ready'])assert.ok(pulseMailCompose(row,moment).subject.startsWith('〔SYNK PULSE〕 '));
});

test('메일 순간 · 받는 사람: 글 콘티는 script 판과 첫 판만, 담당자 주소가 앞서고 끄면 없음',()=>{
  const row={studio:{request:{answers:{email:'a@example.com'},rounds:[{round:1,kind:'images'},{round:2,kind:'images'},{round:3,kind:'script'}]}}};
  const draft=round=>pulseMailMoment(row,{type:'draft_ready',id:`client:p:9:draft_ready:${round}`});
  assert.deepEqual([draft(1),draft(2),draft(3),draft(4)],['draft_ready',null,'draft_ready',null]);
  assert.equal(pulseMailMoment(row,{type:'staff_reply',id:'x'}),null);
  assert.equal(pulseMailMoment(row,{type:'final_ready',id:'x'}),'final_ready');
  assert.deepEqual(pulseMailRecipient(row),{email:'a@example.com',reason:null});
  row.studio.request.contact={email:'b@example.com'};assert.equal(pulseMailRecipient(row).email,'b@example.com');
  row.studio.request.contact={email:'b@example.com',basedOn:'a@example.com'};assert.equal(pulseMailRecipient(row).email,'b@example.com');
  row.studio.request.answers.email='c@example.com';assert.equal(pulseMailRecipient(row).email,'c@example.com','손님이 그 뒤 고친 주소가 이긴다');row.studio.request.answers.email='a@example.com';
  row.studio.request.contact={email:'b@example.com',mailOff:true};assert.deepEqual(pulseMailRecipient(row),{email:null,reason:'mail_off'});
  assert.equal(pulseMailRecipient({studio:{request:{answers:{email:'Name <a@example.com>'}}}}).reason,'no_email');
  assert.equal(pulseMailRecipient({studio:{}}).reason,'not_request');
});

test('설정: 관리자만 · 중계 주소 꼴 · 연결 확인 뒤에만 켜짐 · 주소를 바꾸면 다시 끔',async t=>{
  const f=await fixture(t);
  assert.throws(()=>f.service.settings(f.member),error=>error.status===403);
  assert.throws(()=>f.service.configure(f.admin,{relayUrl:'https://evil.test/exec'}),/Apps Script 웹 앱 주소/);
  assert.throws(()=>f.service.configure(f.admin,{secret:'x'}),/입력 내용/);
  f.service.configure(f.admin,{relayUrl:RELAY});
  assert.throws(()=>f.service.configure(f.admin,{enabled:true}),error=>error.status===409);
  const state=f.service.settings(f.admin);
  assert.match(state.publicKeyN,/^[0-9a-f]{512}$/);assert.equal(state.enabled,false);assert.equal(JSON.stringify(state).includes('PRIVATE KEY'),false);
  const on=await f.connect();
  assert.equal(on.enabled,true);assert.equal(on.enabledAt,f.now);assert.equal(on.connection.state,'ok');
  const moved=f.service.configure(f.admin,{relayUrl:RELAY.replace('TEST','MOVE')});
  assert.equal(moved.enabled,false);assert.equal(moved.connection.state,'unknown');
});

test('보내기: 중계까지 서명 · 302 · 한 번만, 함에는 주소 · 제목이 없다',async t=>{
  const f=await fixture(t),row=f.project();
  f.event(row,'direction_proposed');                 // 켜기 전 사건은 보내지 않는다(물금)
  f.advance(1);await f.connect();f.advance(1);
  f.event(row,'direction_proposed');f.event(row,'staff_reply');
  assert.deepEqual(await f.service.tick(),{added:1,sent:0,removed:0});   // 3분 묶기 전
  f.advance(3);
  assert.equal((await f.service.tick()).sent,1);
  assert.equal(f.relay.sent.length,1);
  assert.equal(f.relay.sent[0].to,'client@example.com');assert.equal(f.relay.sent[0].subject,'〔SYNK PULSE〕 오미톡 광고, 방향을 골라 주세요');assert.equal(f.relay.sent[0].replyTo,'hello@synk.im');
  const [item]=f.outbox();
  assert.equal(item.state,'sent');assert.match(item.recipientHash,/^[0-9a-f]{32}$/);
  assert.equal(JSON.stringify(f.outbox()).includes('client@example.com'),false);assert.equal(JSON.stringify(f.outbox()).includes('방향을 골라'),false);
  assert.equal(JSON.stringify(f.logs).includes('client@example.com'),false);
  f.advance(5);await f.service.tick();assert.equal(f.relay.sent.length,1);
  assert.deepEqual(f.service.customerState(row),{mailOn:true,mailTo:'c***@example.com'});
  assert.equal(f.service.staffState(row).moments.direction_proposed.state,'sent');
});

test('묶기: 3분 안의 고친 제안 · 파일 여러 개는 한 통, 15분 상한, 보내 본 줄에는 더하지 않는다',async t=>{
  const f=await fixture(t),row=f.project();await f.connect();f.advance(1);
  f.event(row,'final_ready');f.advance(2);f.event(row,'final_ready');f.advance(2);f.event(row,'final_ready');await f.service.tick();
  assert.equal(f.outbox().length,1);assert.equal(f.outbox()[0].eventIds.length,3);assert.equal(f.relay.sent.length,0);
  for(let i=0;i<6;i++){f.advance(2);f.event(row,'final_ready');await f.service.tick();}
  assert.equal(f.relay.sent.length,1,'처음 사건 + 15분에 보냄');
  f.override=()=>{throw new Error('offline');};
  f.advance(1);f.event(row,'preview_ready');f.advance(3);await f.service.tick();
  const retrying=f.outbox().find(item=>item.moment==='preview_ready');assert.equal(retrying.state,'pending');assert.equal(retrying.attempts,1);
  f.event(row,'preview_ready');await f.service.tick();
  const previews=f.outbox().filter(item=>item.moment==='preview_ready');
  assert.equal(previews.length,2);assert.equal(previews[0].eventIds.length,1);
});

test('다시 보내기: 응답을 못 받아도 같은 열쇠라 한 통, 429 · 500은 1 · 5 · 15분 뒤, 네 번째 실패',async t=>{
  const f=await fixture(t),row=f.project();await f.connect();f.advance(1);
  // 중계에는 닿았는데 답 주소(GET)를 못 받음 → 다시 보내면 「이미 보냄」
  f.override=(url,init)=>init.method==='GET'?(()=>{throw new Error('reset');})():null;
  f.event(row,'preview_ready');f.advance(3);await f.service.tick();
  assert.equal(f.relay.sent.length,1);assert.equal(f.outbox()[0].state,'pending');assert.equal(f.outbox()[0].reason,'network');
  f.override=null;f.advance(1);await f.service.tick();
  assert.equal(f.outbox()[0].state,'sent');assert.equal(f.relay.sent.length,1,'중계가 같은 열쇠를 두 번 보내지 않음');
  const other=f.project();f.override=()=>({status:503,headers:{get:()=>null},body:{cancel:async()=>{}},text:async()=>'busy'});
  f.event(other,'final_ready');f.advance(3);await f.service.tick();
  const waits=[];for(const minutes of [1,5,15]){const before=f.outbox().find(item=>item.projectId===other.id);waits.push(Date.parse(before.nextAttemptAt)-Date.parse(f.now));f.advance(minutes);await f.service.tick();}
  assert.deepEqual(waits,[60000,300000,900000]);
  const done=f.outbox().find(item=>item.projectId===other.id);assert.equal(done.state,'failed');assert.equal(done.attempts,4);assert.equal(done.reason,'http_503');
});

test('연결 끊김: 로그인 화면 · 403 · 판 번호 다름이면 시도 안 태우고 함이 멈추고, 연결 확인으로 풀린다',async t=>{
  const f=await fixture(t),row=f.project();await f.connect();f.advance(1);
  f.override=()=>({status:200,headers:{get:()=>null},body:{cancel:async()=>{}},text:async()=>'<!doctype html><title>Sign in</title>'});
  f.event(row,'preview_ready');f.event(f.project(),'final_ready');f.advance(3);await f.service.tick();
  assert.equal(f.service.settings(f.admin).connection.state,'broken');assert.equal(f.service.settings(f.admin).connection.code,'not_json');
  assert.equal(f.outbox().filter(item=>item.attempts>0).length,0);assert.equal(f.calls.filter(call=>call.method==='POST').length,2,'ping 하나 + 첫 통 하나에서 멈춤');
  assert.equal(f.service.customerState(row).mailOn,false);assert.equal(f.service.staffState(row).connection,'broken');
  f.override=null;await f.service.ping(f.admin);f.advance(1);await f.service.tick();
  assert.equal(f.outbox().filter(item=>item.state==='sent').length,2);
  f.override=(url,init)=>init.method==='GET'?{status:200,headers:{get:()=>null},body:{cancel:async()=>{}},text:async()=>JSON.stringify({ok:true,status:'sent',version:2})}:null;
  f.event(row,'final_ready');f.advance(3);await f.service.tick();
  assert.equal(f.service.settings(f.admin).connection.code,'version');
  f.relay.props.set('SERVER_KEY_N','0'.repeat(512));f.override=null;
  assert.equal((await f.service.ping(f.admin)).connection.code,'signature');
});

test('건너뛰기: 앱에서 읽음 · 투영에서 사라짐 · 방향 이미 답함 · 주소 지움 · 담당자가 끔 · 보관',async t=>{
  const f=await fixture(t);await f.connect();f.advance(1);
  const read=f.project(),gone=f.project(),answered=f.project(),noMail=f.project(),off=f.project(),archived=f.project();
  f.event(read,'preview_ready').readAt=f.now;const hidden=f.event(gone,'preview_ready');f.event(answered,'direction_proposed');f.event(noMail,'final_ready');f.event(off,'final_ready');f.event(archived,'final_ready');
  await f.service.tick();
  hidden.hidden=true;
  f.store.put('clientProjects',answered.id,{...answered,studio:{request:{...answered.studio.request,directionProposal:{status:'chosen'}}}});
  f.store.put('clientProjects',noMail.id,{...noMail,studio:{request:{...noMail.studio.request,answers:{...noMail.studio.request.answers,email:''}}}});
  f.store.put('clientProjects',off.id,{...off,studio:{request:{...off.studio.request,contact:{mailOff:true}}}});
  f.store.put('clientProjects',archived.id,{...archived,stage:'archived'});
  f.advance(3);await f.service.tick();await f.service.tick();
  const reason=row=>f.outbox().find(item=>item.projectId===row.id);
  assert.deepEqual([read,gone,answered,noMail,off,archived].map(row=>[reason(row).state,reason(row).reason]),[['skipped','read'],['skipped','stale'],['skipped','acted'],['skipped','no_email'],['skipped','mail_off'],['skipped','archived']]);
  assert.equal(f.relay.sent.length,0);
  // 담당자가 주소를 고치면 보낼 때 새 주소로
  const moved=f.project({studio:{request:{answers:{name:'톡',email:'old@example.com'},rounds:[],contact:{email:'new@example.com'}}}});
  f.event(moved,'final_ready');f.advance(3);await f.service.tick();
  assert.equal(f.relay.sent.at(-1).to,'new@example.com');
});

test('중계 답: rejected(주소)는 실패, unknown은 다시 안 보냄, 하루 상한은 1시간 뒤',async t=>{
  const f=await fixture(t);await f.connect();f.advance(1);
  const bad=f.project({studio:{request:{answers:{email:'ok@example.com'},rounds:[],contact:{email:'ok@example.com'}}}});
  f.override=()=>answer({ok:false,status:'rejected',code:'to',version:1});
  f.event(bad,'final_ready');f.advance(3);await f.service.tick();
  assert.deepEqual([f.outbox()[0].state,f.outbox()[0].reason],['failed','to']);
  const maybe=f.project();f.override=()=>answer({ok:false,status:'unknown',code:'interrupted',version:1});
  f.event(maybe,'final_ready');f.advance(3);await f.service.tick();f.advance(30);f.override=null;await f.service.tick();
  const unknown=f.outbox().find(item=>item.projectId===maybe.id);assert.equal(unknown.state,'unknown');assert.equal(f.relay.sent.length,0);
  const capped=f.project();f.override=()=>answer({ok:false,status:'busy',code:'cap',version:1});
  f.event(capped,'final_ready');f.advance(3);await f.service.tick();
  const row=f.outbox().find(item=>item.projectId===capped.id);assert.equal(row.state,'pending');assert.equal(row.attempts,0);assert.equal(Date.parse(row.nextAttemptAt)-Date.parse(f.now),3600000);
});

test('한 번에 하나 · 5분 넘은 sending 되돌림 · 비상 정지 · 90일 정리',async t=>{
  const f=await fixture(t),row=f.project();await f.connect();f.advance(1);
  let release;const gate=new Promise(r=>{release=r;});
  f.override=(url,init)=>init.method==='POST'?gate.then(()=>f.relay.fetch(url,init)):null;
  f.event(row,'final_ready');f.advance(3);
  const first=f.service.tick();assert.deepEqual(await Promise.race([f.service.tick(),new Promise(r=>setTimeout(()=>r('waiting'),50))]),'waiting');
  release();await first;assert.equal(f.relay.sent.length,1);
  const stuck=f.project();f.event(stuck,'final_ready');f.advance(3);await f.service.fill(f.now);
  const item=f.outbox().find(entry=>entry.projectId===stuck.id);f.store.put(PULSE_MAIL_OUTBOX,item.id,{...item,state:'sending',sendingAt:f.now,attempts:1});
  f.advance(4);await f.service.tick();assert.equal(f.outbox().find(entry=>entry.projectId===stuck.id).state,'sending');
  f.advance(2);await f.service.tick();assert.equal(f.outbox().find(entry=>entry.projectId===stuck.id).state,'sent');
  f.advance(91*24*60);await f.service.tick();assert.equal(f.outbox().length,0);
  const halted=await fixture(t,{stop:true});const p=halted.project();await halted.connect();halted.advance(1);halted.event(p,'final_ready');halted.advance(3);
  assert.deepEqual(await halted.service.tick(),{added:0,sent:0,removed:0});assert.equal(halted.service.settings(halted.admin).emergencyStop,true);
});

test('이미 행동함: 글 콘티 의견 · 확인, 영상 승인 · 의견, 수령 확인, 방향 답',()=>{
  const row={studio:{request:{rounds:[{round:1,kind:'script',feedbackAt:'x'},{round:2,kind:'script'},{round:3,kind:'script',approvedAt:'y'}],directionProposal:{status:'open'}}},versions:[{id:'v1',approvedAt:'z'},{id:'v2'},{id:'v3'}],messages:[{author:'customer',versionId:'v3'}],deliveryReceipts:[{versionIds:['f1']}]};
  const draft=round=>pulseMailActed(row,'draft_ready',{id:'client:p:1:draft_ready:'+round});
  assert.deepEqual([draft(1),draft(2),draft(3)],[true,false,true]);
  assert.deepEqual(['v1','v2','v3'].map(versionId=>pulseMailActed(row,'preview_ready',{versionId})),[true,false,true]);
  assert.deepEqual(['f1','f2'].map(versionId=>pulseMailActed(row,'final_ready',{versionId})),[true,false]);
  assert.equal(pulseMailActed(row,'direction_proposed',{}),false);row.studio.request.directionProposal.status='chosen';assert.equal(pulseMailActed(row,'direction_proposed',{}),true);
});

test('48시간 지난 줄은 expired, 끊긴 연결은 10분 뒤 스스로 다시 확인, unknown은 10분 뒤 한 번 되묻는다',async t=>{
  const f=await fixture(t),row=f.project();await f.connect();f.advance(1);
  f.override=()=>{throw new Error('offline');};
  f.event(row,'final_ready');f.advance(3);await f.service.tick();
  f.override=null;f.advance(49*60);await f.service.tick();
  assert.deepEqual([f.outbox()[0].state,f.outbox()[0].reason],['skipped','expired']);assert.equal(f.relay.sent.length,0);
  // 끊김 → 관리자 손 없이 10분 뒤 ping이 통과하면 풀림
  f.override=()=>({status:404,headers:{get:()=>null},body:{cancel:async()=>{}},text:async()=>'<html>not found</html>'});
  const two=f.project();f.event(two,'final_ready');f.advance(3);await f.service.tick();
  assert.equal(f.service.settings(f.admin).connection.state,'broken');
  f.override=null;f.advance(5);await f.service.tick();assert.equal(f.service.settings(f.admin).connection.state,'broken','10분 전에는 다시 안 봄');
  f.advance(6);await f.service.tick();
  assert.equal(f.service.settings(f.admin).connection.state,'ok');assert.equal(f.outbox().find(item=>item.projectId===two.id).state,'sent');
  // unknown: 중계는 보냈는데 끝 기록 전에 실행이 죽은 것처럼 — 10분 뒤 status가 sent면 닫음
  const three=f.project();f.event(three,'final_ready');f.advance(3);
  f.override=(url,init)=>{if(init.method!=='POST')return null;const body=JSON.parse(init.body);if(body.op!=='send')return null;return f.relay.fetch(url,init).then(()=>answer({ok:false,status:'unknown',code:'interrupted',version:1}));};
  await f.service.tick();const pending=f.outbox().find(item=>item.projectId===three.id);
  assert.equal(pending.state,'unknown');assert.equal(f.relay.props.get('k:'+pulseMailRelayKey(pending.id)).startsWith('sent:'),true);
  f.override=null;f.advance(5);await f.service.tick();assert.equal(f.outbox().find(item=>item.projectId===three.id).state,'unknown');
  f.advance(6);await f.service.tick();
  const closed=f.outbox().find(item=>item.projectId===three.id);assert.deepEqual([closed.state,closed.reason],['sent','confirmed_later']);
  f.advance(20);await f.service.tick();assert.equal(f.relay.sent.filter(m=>m.subject.includes('최종 파일')).length,2,'되묻기는 보내지 않음');
});
