import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {hash} from './store.mjs';

const endpoint='https://fcm.googleapis.com/fcm/send/SYNTHETIC-CAPABILITY';
// 통화는 합성 LiveKit 대역으로만 켠다(실제 키·방 없음). 통화 시계는 회사 시계와 같게 둔다.
async function fixture(t,{enabled=true,voice=null}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-device-http-'));
  let app,base,at=new Date().toISOString();const sent=[],users={},tokens={};
  async function start(){
    app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,origin:'https://workspace.example.test',webPushEnabled:enabled,clock:()=>at,webPushSend:async value=>{sent.push(value);return {statusCode:201};},...(voice?{messengerVoice:{enabled:true,e2eeRequired:false,automaticSweep:false,now:()=>Date.parse(at),...voice}}:{})});
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

test('a call invitation wakes the invited device at once with high urgency inside the 45-second invitation',async t=>{
  const media=new Map(),provider={serverUrl:'wss://fixture.livekit.cloud',async createRoom(){},
    issueToken(room,identity){media.set(room,[...(media.get(room)||[]),{identity,sid:'PA_'+identity,state:'ACTIVE',tracks:[]}]);return {token:'synthetic-media-'+identity,expiresAt:new Date(Date.now()+60000).toISOString()};},
    async listParticipants(room){return media.get(room)||[];},verifyWebhook(){throw Object.assign(new Error('invalid'),{status:401,publicMessage:'invalid'});},async removeParticipant(){}};
  const f=await fixture(t,{voice:{provider}});assert.equal((await f.register('other')).status,201);f.advance();
  const recipient=(await f.request('/messenger/api/bootstrap',{user:'other'})).data.user.id;
  const room=(await f.request('/messenger/api/channels',{body:{name:'합성 통화방',category:'project',memberIds:[recipient]}})).data.channel;
  assert.equal((await f.request('/messenger/api/channels/'+room.id+'/voice/join',{body:{requestId:randomUUID()}})).status,200);
  const invited=await f.request('/messenger/api/channels/'+room.id+'/voice/invitations',{body:{requestId:randomUUID(),recipientId:recipient}});
  assert.equal(invited.status,201);assert.equal(invited.data.invitation.state,'pending');
  // 손으로 tick하지 않는다. 30초 주기도 이 시험 안에는 오지 않는다 — 초대가 스스로 깨운 전송만 기다린다.
  for(let i=0;i<300&&!f.sent.length;i++)await new Promise(done=>setTimeout(done,10));
  assert.equal(f.sent.length,1);assert.equal(f.sent[0].urgency,'high');assert.equal(f.sent[0].topic,'synk-company-calls');assert.equal(f.sent[0].ttl,45);
  assert.doesNotMatch(JSON.stringify(f.sent),/합성 통화방|synthetic-media/);
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);
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
