import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createCompanyApp} from './server.mjs';
import {PULSE_MAIL_SECRET} from './pulse-mail.mjs';

// 판 2 메일 알림을 실제 회사 서버 길로: 관리자 설정 · 연결 확인 · 방향 제안 → 함 → 중계(relay.gs를 vm으로) · 담당자 주소 고치기 · 손님 보기 가림.
const RELAY='https://script.google.com/macros/s/AKfycbSERVERtest0123456789ab/exec';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const answers={name:'오미톡 오미자 스파클링',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝나고 목마른 20대',oneThing:'한 캔에 맛이 다섯 번 바뀐다',action:'buy',screenText:'다섯 가지 맛, 톡.',avoid:[],win:'story',refs:[],models:[],modelChoice:'ask',date:'',dateFree:true,approver:'one',contactName:'김합성',company:'합성 음료',email:'buyer@pulse-synthetic.test',phone:'',consent:true,rights:true,slots:{}};
const relaySource=await readFile(new URL('./pulse-mail-relay/relay.gs',import.meta.url),'utf8');
const signed=bytes=>[...bytes].map(b=>b>127?b-256:b);

function relay(getNow){
  const props=new Map(),sent=[];let answer=null;
  const ctx={BigInt,JSON,Math,Number,String,isFinite,parseInt,Date:class extends Date{static now(){return getNow();}},
    Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},base64Decode:v=>signed(Buffer.from(v,'base64')),computeDigest:(_,v)=>signed(createHash('sha256').update(v,'utf8').digest()),formatDate:d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10).replaceAll('-','')},
    PropertiesService:{getScriptProperties:()=>({getProperty:n=>props.has(n)?props.get(n):null,setProperty:(n,v)=>props.set(n,String(v)),deleteProperty:n=>props.delete(n),getProperties:()=>Object.fromEntries(props)})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>sent.push(JSON.parse(JSON.stringify(m)))},
    ContentService:{MimeType:{JSON:1},createTextOutput:text=>({text,setMimeType(){return this;}})}};
  vm.createContext(ctx);vm.runInContext(relaySource,ctx);
  const respond=(status,body,headers={})=>({status,headers:{get:name=>headers[name.toLowerCase()]??null},body:{cancel:async()=>{}},text:async()=>body});
  return {props,sent,fetch:async(url,init)=>{if(init.method==='POST'){assert.equal(String(url),RELAY);answer=ctx.doPost({postData:{contents:init.body}}).text;return respond(302,'',{location:'https://script.googleusercontent.com/macros/echo?user_content_key=k'});}const body=answer;answer=null;return respond(200,body);}};
}

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-mail-server-'));let offset=0;
  const clock=()=>new Date(Date.now()+offset).toISOString(),fake=relay(()=>Date.now()+offset);
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3,clock,pulseMailFetch:fake.fetch};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const admin=app.store.createUser({name:'관리자',email:'founder@pulse-synthetic.test',role:'admin'}),member=app.store.createUser({name:'담당',email:'member@pulse-synthetic.test',role:'member'});
  const tokens={admin:app.store.mint('session',admin.id,{csrfToken:'staff-csrf'},120),member:app.store.mint('session',member.id,{csrfToken:'staff-csrf'},120)};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  const remember=response=>{for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}};
  const parse=async response=>{let data=null;try{data=JSON.parse(await response.text());}catch{}return {status:response.status,data};};
  const call=async(path,{body,csrf=''}={})=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});remember(response);return parse(response);};
  const staff=async(path,{body,raw,headers={},as='admin'}={})=>parse(await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens[as],'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}));
  return {app,call,staff,fake,advance:minutes=>{offset+=minutes*60000;}};
}

test('메일 알림 · 회사 서버 길: 관리자만 켜고, 방향 제안 한 통이 중계로 나가고, 담당자 주소 고치기는 손님 보기에 안 보인다',async t=>{
  const f=await fixture(t);
  assert.equal((await f.staff('/api/settings/pulse-mail',{as:'member'})).status,403);
  const first=await f.staff('/api/settings/pulse-mail');assert.equal(first.status,200);assert.match(first.data.publicKeyN,/^[0-9a-f]{512}$/);assert.equal(first.data.enabled,false);
  assert.equal((await f.staff('/api/settings/pulse-mail',{body:{relayUrl:'https://evil.test/exec'}})).status,400);
  assert.equal((await f.staff('/api/settings/pulse-mail',{body:{relayUrl:RELAY}})).status,200);
  assert.equal((await f.staff('/api/settings/pulse-mail',{body:{enabled:true}})).status,409,'연결 확인 전에는 못 켬');
  f.fake.props.set('SERVER_KEY_N',f.app.store.secret(PULSE_MAIL_SECRET).n);
  assert.equal((await f.staff('/api/settings/pulse-mail/ping',{body:{}})).data.connection.state,'ok');
  const on=await f.staff('/api/settings/pulse-mail',{body:{enabled:true}});assert.equal(on.status,200);assert.equal(on.data.enabled,true);
  assert.deepEqual(f.app.store.all('audit').filter(row=>row.subject==='pulse-mail').map(row=>row.action).sort(),['pulse-mail-ping','pulse-mail-settings','pulse-mail-settings']);
  f.advance(1);

  // 의뢰 → 확인 → 방향 제안
  const draft=(await f.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await f.call('/pulse/api/request/submit',{body:{answers},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const id=sent.data.projectId;let row=(await f.staff('/api/client-projects/'+id+'/studio')).data.project;
  const act=async body=>{const result=await f.staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,...body}});assert.equal(result.status,200,JSON.stringify(result.data));row=result.data.project;return result;};
  const upload=async name=>{const result=await f.staff(`/api/client-projects/${id}/studio/media`,{raw:png,headers:{'Content-Type':'image/png','X-File-Name':name,'X-Project-Revision':String(row.revision)}});assert.equal(result.status,201,JSON.stringify(result.data));row=result.data.project;return result.data.asset?.id||row.studio.assets.at(-1).id;};
  await act({action:'request_confirm'});
  const a=await upload('a.png'),b=await upload('b.png');
  const kst=new Date(Date.now()+9*3600000);kst.setUTCDate(kst.getUTCDate()+10);
  const option=(assetId,extra={})=>({name:'아니, 잠깐',sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고 친구 폰 앞'},{at:'0:03',text:'한 모금마다 말이 바뀌어요'},{at:'0:11',text:'친구가 뺏어 마셔요'}],why:'「다섯 가지 맛」이 대사로 풀려요.',assetId,recommended:true,...extra});
  await act({action:'propose_direction',lead:'요청하신 대로 두고 두 방향으로 나눴어요.',options:[option(a),option(b,{name:'톡',sentence:'캔 따는 소리 한 번에 코트 전체가 멈춰요.',recommended:false})],modelId:'M06',price:390000,dueDate:kst.toISOString().slice(0,10),revisions:2});
  f.advance(1);assert.equal((await f.app.pulseMail.tick()).added,1);assert.equal(f.fake.sent.length,0,'3분 묶기 전');
  f.advance(3);await f.app.pulseMail.tick();
  assert.equal(f.fake.sent.length,1);assert.equal(f.fake.sent[0].to,'buyer@pulse-synthetic.test');
  assert.equal(f.fake.sent[0].subject,'〔SYNK PULSE〕 오미톡 오미자 스파클링 광고, 방향을 골라 주세요');assert.match(f.fake.sent[0].body,/^김합성님, SYNK PULSE입니다\./);
  row=(await f.staff('/api/client-projects/'+id+'/studio')).data.project;
  assert.equal(row.mail.moments.direction_proposed.state,'sent');assert.equal(row.mail.connection,'on');

  // 손님 보기: 켜짐 · 가린 주소, 담당자 연락 칸 없음
  let room=(await f.call('/pulse/api/project')).data;
  assert.deepEqual(room.project.mail,{mailOn:true,mailTo:'b***@pulse-synthetic.test'});
  // 담당자 주소 고치기: 직원만 · 주소 꼴 · 연락처 줄 함께, 손님 보기에는 contact 없음
  assert.equal((await f.staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,action:'request_contact',email:'not-mail'}})).status,400);
  assert.equal((await f.call('/pulse/api/studio',{body:{revision:room.project.revision,action:'request_contact',email:'x@pulse-synthetic.test'},csrf:room.csrf})).status,403);
  await act({action:'request_contact',email:'new@pulse-synthetic.test'});
  assert.equal(row.studio.request.contact.email,'new@pulse-synthetic.test');assert.equal(row.studio.request.contact.basedOn,'buyer@pulse-synthetic.test');
  assert.match(row.contact,/new@pulse-synthetic\.test/);assert.equal(row.mail.override,true);
  room=(await f.call('/pulse/api/project')).data;
  assert.equal(Object.hasOwn(room.project.studio.request,'contact'),false);assert.equal(JSON.stringify(room).includes('new@pulse-synthetic.test'),false);
  assert.equal(room.project.mail.mailTo,'n***@pulse-synthetic.test');
  await act({action:'request_contact',mailOff:true});
  room=(await f.call('/pulse/api/project')).data;assert.equal(room.project.mail.mailOn,false);
  // 담당자 주소 고치기는 손님 알림 사건을 만들지 않는다
  const events=f.app.store.get('clientProjects',id).notificationEvents.filter(event=>event.audiences?.includes('customer'));
  assert.deepEqual(events.map(event=>event.type),['direction_proposed']);
});
