import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request as httpRequest} from 'node:http';
import {EventEmitter} from 'node:events';
import {createDecipheriv,createECDH,hkdfSync,randomBytes,randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {hash} from './store.mjs';
import {createPushSender} from '../../../../../tools/company-messenger/web-push-service.mjs';

const endpoint='https://fcm.googleapis.com/fcm/send/SYNTHETIC-CAPABILITY';
// 통화는 합성 LiveKit 대역으로만 켠다(실제 키·방 없음). 통화 시계는 회사 시계와 같게 둔다.
// send를 주면 기록한 뒤 그 송신기로 넘긴다(없으면 바로 201).
async function fixture(t,{enabled=true,voice=null,send=null}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-device-http-'));
  let app,base,at=new Date().toISOString();const sent=[],users={},tokens={};
  async function start(){
    app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,origin:'https://workspace.example.test',webPushEnabled:enabled,clock:()=>at,webPushSend:async value=>{sent.push(value);return send?send(value):{statusCode:201};},...(voice?{messengerVoice:{enabled:true,e2eeRequired:false,automaticSweep:false,now:()=>Date.parse(at),...voice}}:{})});
    const address=await app.start();base='http://127.0.0.1:'+address.port;
  }
  await start();
  for(const [name,role]of [['owner','member'],['other','member'],['viewer','viewer']]){
    users[name]=app.store.createUser({name,email:name+'@push.example.test',role});
    tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'push-csrf'},10);
  }
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  async function request(path,{user='owner',body,method=body===undefined?'GET':'POST',headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(method==='GET'?{}:{Origin:app.origin,'X-CSRF-Token':'push-csrf','Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();return {status:response.status,headers:response.headers,text,data:response.headers.get('content-type')?.includes('application/json')&&text?JSON.parse(text):null};
  }
  const register=(user='owner',url=endpoint)=>request('/api/device-notifications',{user,body:{subscription:{endpoint:url},label:'합성 기기'}});
  return {get app(){return app},get base(){return base},sent,users,tokens,request,register,advance(){at=new Date(Date.parse(at)+1000).toISOString();},async restart(){await app.stop();await start();}};
}

test('push defaults off without creating VAPID credentials and exposes no registration or transport',async t=>{
  const f=await fixture(t,{enabled:false});
  const state=await f.request('/api/device-notifications');assert.equal(state.status,200);assert.equal(state.data.configured,false);assert.equal(state.data.publicKey,null);assert.equal(state.data.defaultEnabled,false);
  assert.equal(f.app.store.secret('device-web-push-vapid'),null);assert.equal((await f.register()).status,503);
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,0);
});

test('explicit push opt-in stays available while unrelated background jobs are paused',async t=>{
  const previous=process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
  process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';
  try{
    const f=await fixture(t),state=await f.request('/api/device-notifications');
    assert.equal(state.data.configured,true);assert.equal(state.data.defaultEnabled,false);assert.equal((await f.register()).status,201);
    const key=state.data.publicKey;assert.ok(key);await f.restart();
    assert.equal((await f.request('/api/device-notifications')).data.publicKey,key);
    await f.app.deviceNotifications.tick();assert.equal(f.sent.length,0);
  }finally{if(previous===undefined)delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=previous;}
});

test('device HTTP uses staff session, origin, CSRF and owner deletion while viewer may opt in',async t=>{
  const f=await fixture(t);assert.equal((await f.request('/api/device-notifications',{user:null})).status,401);
  for(const headers of [{Origin:'https://evil.example'},{Origin:''},{'X-CSRF-Token':'bad'}])assert.equal((await f.request('/api/device-notifications',{body:{subscription:{endpoint}},headers})).status,403);
  assert.equal((await f.request('/api/device-notifications?anything=1')).status,400);
  const registered=await f.register('viewer');assert.equal(registered.status,201);assert.equal(registered.data.subscription.currentSession,true);
  const path='/api/device-notifications/'+registered.data.subscription.id;
  assert.equal((await f.request(path,{user:'other',method:'DELETE'})).status,404);
  assert.equal((await f.request(path,{user:'viewer',method:'DELETE',headers:{'X-CSRF-Token':'bad'}})).status,403);
  assert.equal((await f.request(path,{user:'viewer',method:'DELETE'})).status,200);
  const pulse=f.app.store.mint('pulse-session',null,{csrf:'pulse-only'},10);
  assert.equal((await f.request('/api/device-notifications',{user:null,headers:{Cookie:'synk_pulse_session='+pulse}})).status,401);
  assert.equal(f.sent.length,0);
});

test('encrypted VAPID identity and safe subscription metadata survive company restart',async t=>{
  const f=await fixture(t),first=await f.request('/api/device-notifications');
  const registration=await f.register();assert.equal(registration.status,201);
  const secret=f.app.store.secret('device-web-push-vapid');assert.equal(first.data.publicKey,secret.publicKey);
  const stored=f.app.store.db.prepare("SELECT ciphertext FROM credentials WHERE id='device-web-push-vapid'").get();assert.equal(stored.ciphertext.includes(secret.privateKey),false);
  const state=await f.request('/api/device-notifications');assert.equal(state.data.subscriptions[0].endpointHash,hash(endpoint));assert.doesNotMatch(state.text,/SYNTHETIC-CAPABILITY|session_hash|privateKey|p256dh/);
  assert.equal(state.text.includes(secret.privateKey),false);await f.restart();
  const next=await f.request('/api/device-notifications');assert.equal(next.data.publicKey,first.data.publicKey);assert.equal(next.data.subscriptions[0].id,registration.data.subscription.id);
  for(const path of ['/device-notifications.js','/device-notifications.css','/notification-sw.js'])assert.equal((await f.request(path,{user:null})).status,200);
});

test('actual customer support event reaches staff push once, stays unread, and logout revokes its device',async t=>{
  const f=await fixture(t);await f.register();f.advance();
  const project=await f.request('/api/client-projects',{body:{title:'합성 푸시 업무',customerName:'합성 고객',summary:'PRIVATE TASK TEXT'}});assert.equal(project.status,201);
  const invite=await f.request('/api/client-projects/'+project.data.project.id+'/invite',{body:{revision:project.data.project.revision}});assert.equal(invite.status,200);
  const opened=await f.request('/pulse/api/open',{user:null,body:{invite:invite.data.invite}});assert.equal(opened.status,200);
  const customerCookie=opened.headers.get('set-cookie').split(';')[0];
  const support=await f.request('/pulse/api/action',{user:null,body:{revision:opened.data.project.revision,action:'support',text:'PRIVATE CUSTOMER TEXT'},headers:{Cookie:customerCookie,'X-Pulse-CSRF':opened.data.csrf}});assert.equal(support.status,200);
  const original=f.app.messenger.notificationsForCompanyUser(f.users.owner.id);assert.equal(original.length,1);assert.equal(original[0].unread,true);
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);assert.doesNotMatch(JSON.stringify(f.sent),/PRIVATE CUSTOMER TEXT|PRIVATE TASK TEXT|합성 고객/);
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);assert.equal(f.app.messenger.notificationsForCompanyUser(f.users.owner.id)[0].unread,true);
  await f.restart();await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);
  const logout=await f.request('/api/logout',{body:{}});assert.equal(logout.status,200);
  const row=f.app.store.db.prepare('SELECT enabled,endpoint FROM web_push_subscriptions').get();assert.equal(row.enabled,0);assert.equal(row.endpoint,null);
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);assert.equal((await f.request('/api/device-notifications')).status,401);
});

const voiceProvider=()=>{const media=new Map();return {serverUrl:'wss://fixture.livekit.cloud',async createRoom(){},
  issueToken(room,identity){media.set(room,[...(media.get(room)||[]),{identity,sid:'PA_'+identity,state:'ACTIVE',tracks:[]}]);return {token:'synthetic-media-'+identity,expiresAt:new Date(Date.now()+60000).toISOString()};},
  async listParticipants(room){return media.get(room)||[];},verifyWebhook(){throw Object.assign(new Error('invalid'),{status:401,publicMessage:'invalid'});},async removeParticipant(){}};};
// owner가 other와 같은 방에서 통화에 들어가 other를 부른다.
async function inviteOther(f){
  const recipient=(await f.request('/messenger/api/bootstrap',{user:'other'})).data.user.id;
  const room=(await f.request('/messenger/api/channels',{body:{name:'합성 통화방',category:'project',memberIds:[recipient]}})).data.channel;
  assert.equal((await f.request('/messenger/api/channels/'+room.id+'/voice/join',{body:{requestId:randomUUID()}})).status,200);
  const invited=await f.request('/messenger/api/channels/'+room.id+'/voice/invitations',{body:{requestId:randomUUID(),recipientId:recipient}});
  assert.equal(invited.status,201);assert.equal(invited.data.invitation.state,'pending');
  return {recipient,room};
}
const waitFor=async ready=>{for(let i=0;i<300&&!ready();i++)await new Promise(done=>setTimeout(done,10));};

test('a call invitation wakes the invited device at once with high urgency inside the 45-second invitation',async t=>{
  const f=await fixture(t,{voice:{provider:voiceProvider()}});assert.equal((await f.register('other')).status,201);f.advance();
  await inviteOther(f);
  // 손으로 tick하지 않는다. 30초 주기도 이 시험 안에는 오지 않는다 — 초대가 스스로 깨운 전송만 기다린다.
  await waitFor(()=>f.sent.length);
  assert.equal(f.sent.length,1);assert.equal(f.sent[0].urgency,'high');assert.equal(f.sent[0].topic,'synk-company-calls');assert.equal(f.sent[0].ttl,45);
  // 열쇠 없이 등록한 기기에는 통화 표시를 싣지 못해 빈 본문으로 깨운다.
  assert.equal(f.sent[0].kind,'call');assert.equal(f.sent[0].keys,null);
  assert.doesNotMatch(JSON.stringify(f.sent),/합성 통화방|synthetic-media/);
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);
});

test('a call push leaves the company server as the encrypted call marker and a mention push stays empty',async t=>{
  // 실제 송신기를 가짜 HTTPS 요청에 붙여, 푸시 사업자가 받을 머리말·본문 바이트를 그대로 본다.
  const wire=[],send=createPushSender({lookup:async()=>[{address:'142.250.1.1',family:4}],request(url,options,callback){
    const req=new EventEmitter();req.end=(...args)=>{wire.push({url:String(url),headers:options.headers,body:args[0]??null});callback({statusCode:201,headers:{},destroy(){}});};return req;
  }});
  const f=await fixture(t,{voice:{provider:voiceProvider()},send});
  // 브라우저가 구독과 함께 주는 열쇠(RFC 8291). 개인 쪽 열쇠로 브라우저처럼 푼다.
  const device=createECDH('prime256v1');device.generateKeys();const secret=randomBytes(16);
  const keys={p256dh:device.getPublicKey().toString('base64url'),auth:secret.toString('base64url')};
  const registered=await f.request('/api/device-notifications',{user:'other',body:{subscription:{endpoint,keys},label:'합성 기기'}});
  assert.equal(registered.status,201);assert.equal(registered.data.subscription.callAlerts,true);
  assert.equal(registered.text.includes(keys.auth)||registered.text.includes(keys.p256dh),false);
  f.advance();const {recipient,room}=await inviteOther(f);
  await waitFor(()=>wire.length);
  assert.equal(wire.length,1);assert.equal(wire[0].url,endpoint);
  assert.deepEqual([wire[0].headers.Urgency,wire[0].headers.Topic,wire[0].headers['Content-Encoding'],wire[0].headers['Content-Length']],['high','synk-company-calls','aes128gcm',String(wire[0].body.length)]);
  const body=wire[0].body,salt=body.subarray(0,16),sender=body.subarray(21,21+body[20]),record=body.subarray(21+body[20]);
  const derive=(ikm,salt,info,length)=>Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from(info),length));
  const ikm=derive(device.computeSecret(sender),secret,Buffer.concat([Buffer.from('WebPush: info\0'),device.getPublicKey(),sender]),32);
  const decipher=createDecipheriv('aes-128-gcm',derive(ikm,salt,'Content-Encoding: aes128gcm\0',16),derive(ikm,salt,'Content-Encoding: nonce\0',12));decipher.setAuthTag(record.subarray(-16));
  assert.equal(Buffer.concat([decipher.update(record.subarray(0,-16)),decipher.final()]).toString(),'{"kind":"call"}\u0002');
  // 같은 사람에게 온 멘션은 보통 깨우기다 — 빈 본문, normal, 원래 Topic.
  f.advance();assert.equal((await f.request('/messenger/api/channels/'+room.id+'/messages',{body:{body:'PRIVATE MENTION TEXT',mentionIds:[recipient]}})).status,201);
  await f.app.deviceNotifications.tick();
  assert.equal(wire.length,2);assert.deepEqual([wire[1].headers.Urgency,wire[1].headers.Topic,wire[1].headers['Content-Length'],wire[1].headers['Content-Encoding'],wire[1].body],['normal','synk-company-notifications','0',undefined,null]);
  assert.doesNotMatch(JSON.stringify(f.sent.map(({keys:_keys,...rest})=>rest)),/합성 통화방|PRIVATE MENTION TEXT|synthetic-media/);
});

test('deactivation or session expiry disables the linked device before any provider call',async t=>{
  const f=await fixture(t);await f.register();await f.register('other',endpoint+'-other');
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});
  f.app.store.db.prepare("UPDATE tokens SET expiresAt='2000-01-01T00:00:00.000Z' WHERE hash=?").run(hash(f.tokens.other));
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,0);
  assert.equal(f.app.store.db.prepare('SELECT count(*) AS n FROM web_push_subscriptions WHERE enabled=1').get().n,0);
  assert.equal((await f.request('/api/device-notifications')).status,401);
});

test('session revoked during streamed registration cannot bind a subscription',async t=>{
  const f=await fixture(t),body=JSON.stringify({subscription:{endpoint}});
  f.app.server.once('request',req=>req.once('data',()=>f.app.store.revokeUser(f.users.owner.id)));
  const status=await new Promise((resolveStatus,reject)=>{
    const req=httpRequest(f.base+'/api/device-notifications',{method:'POST',headers:{Cookie:'synk_company_session='+f.tokens.owner,Origin:f.app.origin,'X-CSRF-Token':'push-csrf','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{res.resume();res.on('end',()=>resolveStatus(res.statusCode));});
    req.on('error',reject);req.end(body);
  });
  assert.equal(status,401);assert.equal(f.app.store.db.prepare('SELECT count(*) AS n FROM web_push_subscriptions').get().n,0);assert.equal(f.sent.length,0);
});
