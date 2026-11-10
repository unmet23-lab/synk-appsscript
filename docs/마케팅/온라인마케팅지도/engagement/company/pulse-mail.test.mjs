import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {Store} from './store.mjs';
import {createPulseMailService,pulseMailActed,pulseMailCompose,pulseMailMoment,pulseMailRecipient,pulseMailRelayKey,PULSE_MAIL_MOMENTS,PULSE_MAIL_OUTBOX,PULSE_MAIL_SECRET} from './pulse-mail.mjs';

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
  // 판 4: 메일의 앱 주소는 다시 열기 판을 연다(주소창에 메일 주소는 없다).
  assert.match(body,/https:\/\/workspace\.synk\.im\/pulse-app\/\?open=mail\n/);assert.match(body,/「메일로 다시 열기」/);
  assert.match(body,/\n다음 할 일: 마음에 드는 방향 하나를 골라 주세요/);
  assert.match(pulseMailCompose({studio:{request:{answers:{package:'photo'}}}},'preview_ready').subject,/요청하신 광고 사진을 확인해 주세요$/);
  assert.match(pulseMailCompose({studio:{request:{answers:{}}}},'final_ready').body,/^안녕하세요, SYNK PULSE입니다/);
  for(const moment of PULSE_MAIL_MOMENTS)assert.ok(pulseMailCompose(row,moment).subject.startsWith('〔SYNK PULSE〕 '),moment);
  // 접수 확인은 손님이 적은 글을 넣지 않는다(공개 의뢰서로 남의 주소에 임의 문장을 보내는 길이 되지 않게 — 판 4 Fable 설계 검토 2).
  const receipt=pulseMailCompose({...row,studio:{request:{...row.studio.request,number:'P-1110-AD6B'}}},'request_received');
  assert.equal(receipt.subject,'〔SYNK PULSE〕 의뢰를 받았어요 · P-1110-AD6B');assert.doesNotMatch(receipt.subject+receipt.body,/오미톡|Bcc|손님님|evil/);
  assert.match(receipt.body,/\n접수 번호: P-1110-AD6B\n/);assert.doesNotMatch(receipt.body,/[0-9A-F]예요/,'번호 끝 글자에 따라 받침이 갈리니 「예요」를 붙이지 않는다(11-10 운영 시험 주문)');assert.match(receipt.body,/의뢰하신 적이 없으면 이 메일은 지우셔도 돼요/);
  assert.equal(pulseMailCompose({studio:{request:{number:'P-1110-AD6B\nBcc',answers:{}}}},'request_received').subject,'〔SYNK PULSE〕 의뢰를 받았어요','꼴이 아닌 번호는 싣지 않는다');
  // 판 순간: 같은 종류의 앞 판이 있으면 「고친」, 결제 안내는 값 · 받으실 날 줄, 사진 첫 장은 사진 말.
  const rounds={studio:{request:{answers:{name:'오미톡'},rounds:[{round:1,kind:'script'},{round:2,kind:'script'},{round:3,kind:'images'}],directionProposal:{dueDate:'2026-11-20'}}}};
  assert.equal(pulseMailCompose(rounds,'draft_ready','ko',{id:'client:p:1:draft_ready:1'}).subject,'〔SYNK PULSE〕 오미톡 광고 글 콘티가 왔어요');
  assert.equal(pulseMailCompose(rounds,'draft_ready','ko',{id:'client:p:2:draft_ready:2'}).subject,'〔SYNK PULSE〕 오미톡 광고 고친 글 콘티가 왔어요');
  const images=pulseMailCompose(rounds,'images_ready','ko',{id:'client:p:3:draft_ready:3'});
  assert.equal(images.subject,'〔SYNK PULSE〕 오미톡 광고 장면 이미지가 왔어요');assert.match(images.body,/받으실 날\(11월 20일\)은 확인을 기다리는 날만큼 늦어져요\./);
  const paid={studio:{request:{answers:{name:'오미톡'},payment:{status:'requested',amount:290000},directionProposal:{dueDate:'2026-11-20'}}}};
  assert.match(pulseMailCompose(paid,'payment_requested').body,/결제 요청\(29만 원\)을 보내 드렸어요/);
  const confirmed={studio:{request:{answers:{name:'오미톡'},payment:{status:'confirmed',dueDate:'2026-11-24'},directionProposal:{dueDate:'2026-11-20'}}}};
  assert.match(pulseMailCompose(confirmed,'images_ready').body,/받으실 날\(11월 24일\)/,'결제 확인 때 정한 날이 방향 제안의 날을 대신한다');
  assert.equal(pulseMailCompose({studio:{request:{answers:{package:'photo'},rounds:[{round:1,kind:'images'}]}}},'images_ready','ko',{id:'client:p:1:draft_ready:1'}).subject,'〔SYNK PULSE〕 요청하신 광고 첫 장이 왔어요');
  assert.doesNotMatch(pulseMailCompose({studio:{request:{answers:{}}}},'final_ready').body,/받으실 날/,'납품 메일에는 기다림 줄이 없다');
});

test('메일 순간 · 받는 사람: 판은 글 콘티 · 장면 이미지 순간으로 나뉘고(판 4), 담당자 주소가 앞서고 끄면 없음',()=>{
  const row={studio:{request:{answers:{email:'a@example.com'},rounds:[{round:1,kind:'images'},{round:2,kind:'images'},{round:3,kind:'script'}]}}};
  const draft=round=>pulseMailMoment(row,{type:'draft_ready',id:`client:p:9:draft_ready:${round}`});
  assert.deepEqual([draft(1),draft(2),draft(3),draft(4)],['images_ready','images_ready','draft_ready',null]);
  assert.equal(pulseMailMoment(row,{type:'staff_reply',id:'x'}),null);
  assert.equal(pulseMailMoment(row,{type:'request_asked',id:'x'}),'request_asked');assert.equal(pulseMailMoment(row,{type:'payment_requested',id:'x'}),'payment_requested');
  assert.equal(pulseMailMoment(row,{type:'request_received',id:'x'}),null,'접수 확인은 알림 사건으로 넣지 않는다(접수 때 함에 바로)');
  assert.equal(pulseMailMoment(row,{type:'payment_confirmed',id:'x'}),null,'결제 확인은 앱 안 알림만');
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
  assert.deepEqual(f.service.customerState(row),{mailOn:true,mailTo:'c***@example.com',moments:[...PULSE_MAIL_MOMENTS]});
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

test('GPT GA1: 담당자가 B로 고친 뒤 손님이 C로 바꾸면, 메일 끄기만 바꿔도 B가 되살아나지 않는다 · 의뢰서 주소 그대로면 고친 주소가 아니다',async()=>{
  const {applyRequestAction}=await import('./pulse-requests.mjs');
  const studio={request:{status:'submitted',answers:{contactName:'김',email:'a@example.com',phone:''},files:[],asks:[],notes:[],rounds:[]}},row={contact:''},stamp={at:'2026-11-08T00:00:00.000Z',authorName:'담당'};
  const act=input=>applyRequestAction({studio,row,input:{action:'request_contact',...input},staff:true,stamp});
  act({email:'b@example.com'});assert.equal(pulseMailRecipient({studio}).email,'b@example.com');assert.match(row.contact,/b@example\.com/);
  studio.request={...studio.request,answers:{...studio.request.answers,email:'c@example.com'}};
  assert.equal(pulseMailRecipient({studio}).email,'c@example.com');
  act({mailOff:false});
  assert.equal(pulseMailRecipient({studio}).email,'c@example.com','옛 보정 주소가 되살아나지 않는다');assert.equal(studio.request.contact.email,'');
  act({email:'C@example.com',mailOff:true});assert.equal(studio.request.contact.email,'','의뢰서 주소와 같으면 고친 주소로 치지 않는다');assert.equal(pulseMailRecipient({studio}).reason,'mail_off');
  assert.throws(()=>act({email:'not-mail'}),/이메일/);
  assert.throws(()=>applyRequestAction({studio,row,input:{action:'request_contact',mailOff:true},staff:false,stamp}),error=>error.status===403);
});

test('GPT GA2 · GA3 · GA4: 옛 주소 ping 답은 새 주소를 통과시키지 않고, 다시 켜면 그 전 줄은 안 보내고, 묶기 상한 뒤 사건은 새 줄',async t=>{
  const f=await fixture(t);
  // GA2
  f.service.configure(f.admin,{relayUrl:RELAY});f.relay.props.set('SERVER_KEY_N',f.store.secret(PULSE_MAIL_SECRET).n);
  let release;const gate=new Promise(r=>{release=r;});
  f.override=(url,init)=>init.method==='POST'?gate.then(()=>f.relay.fetch(url,init)):null;
  const pending=f.service.ping(f.admin);
  f.service.configure(f.admin,{relayUrl:RELAY.replace('TEST','OTHER')});
  release();await pending;
  assert.equal(f.service.settings(f.admin).connection.state,'unknown');
  assert.throws(()=>f.service.configure(f.admin,{enabled:true}),error=>error.status===409);
  // A → B → A로 돌아와도 옛 확인의 늦은 성공은 버리고, 같은 세대의 앞선 확인도 마지막 확인을 덮지 않는다(GPT 다시 검수)
  let releaseOld;const oldGate=new Promise(r=>{releaseOld=r;});
  f.service.configure(f.admin,{relayUrl:RELAY});
  f.override=(url,init)=>init.method==='POST'?oldGate.then(()=>answer({ok:true,status:'ok',version:1})):null;
  const old=f.service.ping(f.admin);
  f.service.configure(f.admin,{relayUrl:RELAY.replace('TEST','OTHER')});f.service.configure(f.admin,{relayUrl:RELAY});
  f.override=()=>answer({ok:false,status:'rejected',code:'no_key',version:1});
  assert.equal((await f.service.ping(f.admin)).connection.code,'no_key');
  releaseOld();await old;
  assert.equal(f.service.settings(f.admin).connection.state,'broken');
  assert.throws(()=>f.service.configure(f.admin,{enabled:true}),error=>error.status===409);
  let releaseFirst;const firstGate=new Promise(r=>{releaseFirst=r;});
  f.override=(url,init)=>init.method==='POST'?firstGate.then(()=>answer({ok:true,status:'ok',version:1})):null;
  const first=f.service.ping(f.admin);
  f.override=()=>answer({ok:false,status:'rejected',code:'signature',version:1});
  assert.equal((await f.service.ping(f.admin)).connection.code,'signature');
  releaseFirst();await first;
  assert.equal(f.service.settings(f.admin).connection.code,'signature','먼저 시작한 확인의 늦은 성공이 마지막 확인을 덮지 않는다');
  f.override=null;f.service.configure(f.admin,{relayUrl:RELAY});await f.connect();f.advance(1);
  // GA3
  const row=f.project();f.event(row,'final_ready');await f.service.fill(f.now);
  f.service.configure(f.admin,{enabled:false});f.advance(60);f.service.configure(f.admin,{enabled:true});f.advance(1);
  await f.service.tick();
  assert.deepEqual([f.outbox()[0].state,f.outbox()[0].reason],['skipped','before_on']);assert.equal(f.relay.sent.length,0);
  f.event(row,'final_ready');f.advance(3);await f.service.tick();assert.equal(f.relay.sent.length,1,'다시 켠 뒤 사건은 보낸다');
  // GA4
  const late=f.project();f.event(late,'preview_ready');await f.service.fill(f.now);
  f.advance(49*60);f.event(late,'preview_ready');f.advance(3);await f.service.tick();
  const rows=f.outbox().filter(item=>item.projectId===late.id);
  assert.equal(rows.length,2);assert.deepEqual(rows.map(item=>[item.state,item.reason]),[['skipped','expired'],['sent',null]]);
});
test('판 4 · 접수 확인: 함에 바로 들어가 30초 뒤 한 통, 손님이 적은 글 없음, 주소마다 하루 한 통 · 전체 하루 스무 통',async t=>{
  const f=await fixture(t);await f.connect();f.advance(1);
  const make=(number,email,extra={})=>f.project({studio:{request:{number,answers:{name:'오미톡',contactName:'김손님',email,package:'s15'},rounds:[],...extra}}});
  const row=make('P-1110-AAAA','client@example.com');
  const item=f.service.receipt(row.id);assert.equal(item.moment,'request_received');assert.equal(item.state,'pending');
  assert.equal(f.service.receipt(row.id),null,'같은 프로젝트는 한 줄');
  assert.equal(f.service.receipt(make('P-1110-BBBB','CLIENT@example.com').id),null,'같은 주소(대소문자 무시)는 하루 한 통');
  await f.service.tick();assert.equal(f.relay.sent.length,0,'30초 전');
  f.advance(1);await f.service.tick();
  assert.equal(f.relay.sent.length,1);assert.equal(f.relay.sent[0].subject,'〔SYNK PULSE〕 의뢰를 받았어요 · P-1110-AAAA');
  assert.doesNotMatch(f.relay.sent[0].body,/오미톡|김손님/);assert.equal(f.outbox()[0].state,'sent');
  for(let i=0;i<19;i++)assert.ok(f.service.receipt(make('P-1110-C'+String(i).padStart(3,'0'),`c${i}@example.com`).id),String(i));
  const late=make('P-1110-DDDD','late@example.com');
  assert.equal(f.service.receipt(late.id),null,'하루 스무 통을 넘으면 넣지 않는다(접수증이 같은 안내를 한다)');
  f.advance(24*60+1);assert.ok(f.service.receipt(late.id),'하루가 지나면 다시');
  // 보관 · 방 닫힘 · 주소 없음은 넣지 않는다
  assert.equal(f.service.receipt(f.project({stage:'archived'}).id),null);
  assert.equal(f.service.receipt(make('P-1110-EEEE','').id),null);
});
test('판 4 · 이미 함: 되묻기를 다 답함 · 결제 요청 뒤 확인 · 장면 이미지 판에 의견',()=>{
  const row={studio:{request:{asks:[{status:'answered'}],payment:{status:'requested'},rounds:[{round:1,kind:'images',feedbackAt:'2026-11-10T00:00:00.000Z'}]}}};
  assert.equal(pulseMailActed(row,'request_asked'),true);
  row.studio.request.asks.push({status:'open'});assert.equal(pulseMailActed(row,'request_asked'),false);
  assert.equal(pulseMailActed(row,'payment_requested'),false);
  row.studio.request.payment.status='confirmed';assert.equal(pulseMailActed(row,'payment_requested'),true);
  assert.equal(pulseMailActed(row,'images_ready',{id:'client:p:1:draft_ready:1'}),true);
  assert.equal(pulseMailActed({studio:{request:{rounds:[{round:1,kind:'images'}]}}},'images_ready',{id:'client:p:1:draft_ready:1'}),false);
});
test('판 4 · 함 밖 한 통(sendDirect · 다시 열기 코드): 꺼져 있으면 안 보내고, 켜지면 중계로, 같은 열쇠는 한 통, 함에 안 남음',async t=>{
  const f=await fixture(t),mail={key:'open:1',to:'client@example.com',subject:'〔SYNK PULSE〕 프로젝트 열기 코드 123456',body:'코드는 123456예요.'};
  assert.equal((await f.service.sendDirect(mail)).kind,'off');assert.equal(f.relay.sent.length,0);
  await f.connect();
  assert.equal((await f.service.sendDirect(mail)).kind,'sent');
  assert.equal((await f.service.sendDirect(mail)).kind,'sent','중계가 같은 열쇠를 duplicate로 답한다');
  assert.equal(f.relay.sent.length,1);assert.equal(f.outbox().length,0);
  assert.equal((await f.service.sendDirect({...mail,key:'open:2',to:'a, b@example.com'})).kind,'failed');
  assert.match(f.service.secretHash('x'),/^[0-9a-f]{64}$/);assert.notEqual(f.service.secretHash('x'),f.service.secretHash('y'));
  assert.equal(f.service.addressKey('Client@Example.com'),f.service.addressKey('client@example.com'));
});
test('판 4 GPT GA3: 접수 확인은 넣을 때의 주소로만 — 그사이 주소를 바꾸면 보내지 않는다',async t=>{
  const f=await fixture(t);await f.connect();f.advance(1);
  const row=f.project({studio:{request:{number:'P-1110-AAAA',answers:{email:'first@example.com'},rounds:[]}}});
  assert.ok(f.service.receipt(row.id));
  const live=f.store.get('clientProjects',row.id);f.store.put('clientProjects',row.id,{...live,studio:{...live.studio,request:{...live.studio.request,answers:{email:'other@example.com'}}}});
  f.advance(1);await f.service.tick();
  assert.equal(f.relay.sent.length,0);assert.equal(f.outbox()[0].state,'skipped');assert.equal(f.outbox()[0].reason,'changed');
});
