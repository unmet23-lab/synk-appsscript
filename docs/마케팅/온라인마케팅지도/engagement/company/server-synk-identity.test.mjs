import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';
import { createCompanyApp } from './server.mjs';
import { synkIdentityConfig, createSynkIdentity } from './synk-identity.mjs';

const password='fixture-company-password-2026';
const ids={one:'11111111-1111-4111-8111-111111111111',two:'22222222-2222-4222-8222-222222222222'};
const access={one:'synthetic-access-one-not-for-operation',two:'synthetic-access-two-not-for-operation'};
async function fixture(t,{enabled=true,browser=false,verify,fetcher,webPushEnabled=false}={}){
  const dir=await mkdtemp(join(tmpdir(),'synk-id-company-'));let stamp=Date.now(),rejected=false;const sent=[];
  const verifier=verify===false?null:verify|| (async value=>{if(rejected)throw Object.assign(Error('revoked'),{status:401});return {synkUserId:value===access.one?ids.one:ids.two,expiresAt:stamp+3600_000};});
  const options={dataDir:dir,port:0,allowTestHost:true,schedule:false,synkIdentityConfig:enabled?{accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'fixture-public',issuer:browser?'https://identity.example.test':null,clientId:browser?'messenger-browser':null}:null,synkIdentityVerifier:verifier,synkIdentityFetch:fetcher,synkIdentityNow:()=>stamp,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  if(webPushEnabled)Object.assign(options,{webPushEnabled:true,origin:'https://workspace.example.test',clock:()=>new Date(stamp).toISOString(),webPushSend:async value=>{assert.equal(await value.authorize(),true);sent.push(value);return {statusCode:201};}});
  let app=createCompanyApp(options),address=await app.start();
  t.after(async()=>{await app.stop();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});});
  const staff=app.store.createUser({name:'회사 크루',email:'same@example.test',password,role:'member'});
  const admin=app.store.createUser({name:'회사 관리자',email:'admin@example.test',password,role:'admin'});
  const fx={get app(){return app;},get base(){return `http://127.0.0.1:${address.port}`;},directory:dir,sent,staff,admin,advance:ms=>stamp+=ms,revoke:()=>{rejected=true;},async restart(changes={}){await app.stop();Object.assign(options,changes);app=createCompanyApp(options);address=await app.start();},client(){
    const jar=new Map();return {jar,csrf:'',async request(path,{body,token,origin=app.origin,csrf=this.csrf,method=body===undefined?'GET':'POST'}={}){
      const headers={Cookie:[...jar].map(([key,value])=>key+'='+value).join('; ')};
      if(method==='POST'){headers.Origin=origin;headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;}
      if(token)headers.Authorization='Bearer '+token;
      const response=await fetch(`http://127.0.0.1:${address.port}`+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
      for(const c of response.headers.getSetCookie()){const [name,value]=c.split(';')[0].split('=');if(value)jar.set(name,value);else jar.delete(name);}
      const data=await response.json().catch(()=>null);if(data?.csrfToken)this.csrf=data.csrfToken;return {status:response.status,data,headers:response.headers};
    },async login(user=staff){return this.request('/api/login',{body:{email:user.email,password}});},async challenge(action='login',extra={}){return this.request('/api/synk-id/challenge',{body:{action,...extra}});},async exchange(challenge,token=access.one){return this.request('/api/synk-id/exchange',{token,body:{challenge,confirm:true}});},async link(user=staff,value=access.one){await this.login(user);const begun=await this.challenge('link',{currentPassword:password,confirm:true});assert.equal(begun.status,200);return this.exchange(begun.data.challenge,value);}};
  }};return fx;
}

test('missing public configuration closes SYNK login without changing existing company authentication',async t=>{
  const f=await fixture(t,{enabled:false}),c=f.client();assert.equal((await c.request('/api/synk-id/status')).data.enabled,false);assert.equal((await c.challenge()).status,503);assert.equal((await c.login()).status,200);assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);
});
test('company password, CSRF and explicit confirmation are required even for administrators',async t=>{
  const f=await fixture(t),c=f.client();await c.login(f.admin);
  assert.equal((await c.request('/api/synk-id/challenge',{csrf:'wrong',body:{action:'link',currentPassword:password,confirm:true}})).status,403);
  assert.equal((await c.challenge('link',{currentPassword:'wrong-password',confirm:true})).status,403);
  assert.equal((await c.challenge('link',{currentPassword:password})).status,400);
  f.app.store.put('users',f.admin.id,{...f.admin,passwordHash:null});assert.equal((await c.challenge('link',{confirm:true})).status,409);
});
test('verified stable SYNK ID needs explicit employee link; matching email or school roles never create a company account',async t=>{
  const f=await fixture(t),c=f.client(),begin=await c.challenge();const rejected=await c.exchange(begin.data.challenge);assert.equal(rejected.status,403);assert.equal(rejected.data.code,'SYNK_NOT_LINKED');assert.equal(f.app.store.all('users').length,2);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM synk_identity_links').get().n,0);
});
test('explicit link and later login share the existing employee while no bearer is written into SQLite',async t=>{
  const f=await fixture(t),c=f.client();const linked=await c.link();assert.equal(linked.status,200);assert.equal(linked.data.user.id,f.staff.id);assert.equal(linked.data.sessionHash,undefined);assert.equal((await c.request('/api/synk-id/status')).data.session,'synk');
  await c.request('/api/logout',{body:{}});const next=f.client(),begin=await next.challenge();assert.equal((await next.exchange(begin.data.challenge)).data.user.id,f.staff.id);
  const saved=JSON.stringify(f.app.store.db.prepare('SELECT * FROM tokens').all())+JSON.stringify(f.app.store.db.prepare('SELECT * FROM documents').all())+JSON.stringify(f.app.store.db.prepare('SELECT * FROM credentials').all());assert.ok(!saved.includes(access.one));assert.equal((await next.request('/messenger/api/bootstrap')).status,200);
});
test('flow cookie, same origin and one-time challenge prevent login CSRF and replay',async t=>{
  const f=await fixture(t),owner=f.client();await owner.link();const c=f.client(),begin=await c.challenge(),other=f.client();assert.equal((await other.exchange(begin.data.challenge)).status,403);
  assert.equal((await c.request('/api/synk-id/exchange',{origin:'https://other.example.test',token:access.one,body:{challenge:begin.data.challenge,confirm:true}})).status,403);
  assert.equal((await c.exchange(begin.data.challenge)).status,200);assert.equal((await c.exchange(begin.data.challenge)).status,403);
});
test('SYNK ID cannot link to two company users or silently switch an existing company identity',async t=>{
  const f=await fixture(t),first=f.client(),second=f.client();await first.link();assert.equal((await second.link(f.admin)).status,409);
  const begin=await second.challenge();assert.equal((await second.exchange(begin.data.challenge)).status,409);
  assert.equal((await second.request('/api/me')).data.user.id,f.admin.id);
});
test('platform account expectation accepts only a UUID on login and never creates or changes an employee link',async t=>{
  const f=await fixture(t),c=f.client();await c.login();
  for(const expectedAccountId of [null,'',ids.one+' ',[],{},'not-an-account']){
    const result=await c.challenge('login',{expectedAccountId});assert.equal(result.status,400);assert.equal(result.data.code,'SYNK_EXPECTED_ACCOUNT');
  }
  for(const action of ['link','unlink']){
    const result=await c.challenge(action,{expectedAccountId:ids.one,currentPassword:password,confirm:true});assert.equal(result.status,400);assert.equal(result.data.code,'SYNK_EXPECTED_ACCOUNT');
  }
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_links').get().n,0);
  assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);
});

test('verified same-account login promotes a legacy company session without changing its employee or role',async t=>{
  const account='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const f=await fixture(t,{verify:async()=>({synkUserId:account,expiresAt:Date.now()+3600_000})}),c=f.client();await c.link();await c.login();
  const priorCookie=c.jar.get('synk_company_session'),priorLinks=f.app.store.db.prepare('SELECT * FROM synk_identity_links').all();
  const status=(await c.request('/api/synk-id/status')).data;assert.equal(status.session,'company');assert.equal(status.synkUserId,null);assert.equal(status.linked,true);
  const begin=await c.challenge('login',{expectedAccountId:account.toUpperCase()}),result=await c.exchange(begin.data.challenge);
  assert.equal(result.status,200);assert.equal(result.data.user.id,f.staff.id);assert.equal(result.data.user.role,f.staff.role);
  assert.notEqual(c.jar.get('synk_company_session'),priorCookie);assert.deepEqual(f.app.store.db.prepare('SELECT * FROM synk_identity_links').all(),priorLinks);
  assert.equal((await c.request('/api/synk-id/status')).data.synkUserId,account);
});

test('exchange cannot replace the account expectation fixed by the starting challenge',async t=>{
  const f=await fixture(t),owner=f.client(),c=f.client();await owner.link();await c.login(f.admin);
  const cookie=c.jar.get('synk_company_session'),links=f.app.store.db.prepare('SELECT * FROM synk_identity_links').all(),tokens=f.app.store.db.prepare('SELECT * FROM tokens ORDER BY hash').all();
  for(const override of [undefined,ids.one]){
    const begin=await c.challenge('login',{expectedAccountId:ids.two});
    const result=await c.request('/api/synk-id/exchange',{token:access.one,body:{challenge:begin.data.challenge,confirm:true,...(override?{expectedAccountId:override}:{})}});
    assert.equal(result.status,409);assert.equal(result.data.code,'SYNK_PLATFORM_ACCOUNT_MISMATCH');
    assert.equal(c.jar.get('synk_company_session'),cookie);assert.equal((await c.request('/api/me')).data.user.id,f.admin.id);
  }
  assert.deepEqual(f.app.store.db.prepare('SELECT * FROM synk_identity_links').all(),links);assert.deepEqual(f.app.store.db.prepare('SELECT * FROM tokens ORDER BY hash').all(),tokens);
});

test('a matching platform account does not silently replace a different existing company user',async t=>{
  const f=await fixture(t),owner=f.client(),c=f.client();await owner.link();await c.login(f.admin);
  const cookie=c.jar.get('synk_company_session'),links=f.app.store.db.prepare('SELECT * FROM synk_identity_links').all();
  const begin=await c.challenge('login',{expectedAccountId:ids.one}),result=await c.exchange(begin.data.challenge);
  assert.equal(result.status,409);assert.equal(result.data.code,'SYNK_ACCOUNT_CHANGED');assert.equal(c.jar.get('synk_company_session'),cookie);
  const me=(await c.request('/api/me')).data;assert.equal(me.user.id,f.admin.id);assert.equal(me.user.role,f.admin.role);
  assert.deepEqual(f.app.store.db.prepare('SELECT * FROM synk_identity_links').all(),links);
});

test('wrong-account browser callback rejects before session or link writes and leaves the previous company session intact',async t=>{
  let exchanged=0;const f=await fixture(t,{browser:true,fetcher:async()=>{exchanged++;return {ok:true,json:async()=>({access_token:access.two})};}}),owner=f.client(),c=f.client();await owner.link();await c.login(f.admin);
  const cookie=c.jar.get('synk_company_session'),links=f.app.store.db.prepare('SELECT * FROM synk_identity_links').all(),tokens=f.app.store.db.prepare('SELECT * FROM tokens ORDER BY hash').all();
  const start=await c.request('/api/synk-id/start',{body:{action:'login',expectedAccountId:ids.one}}),authorization=new URL(start.data.authorizationUrl);
  assert.equal(authorization.searchParams.has('expectedAccountId'),false);assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  const callback='/api/synk-id/callback?state='+authorization.searchParams.get('state')+'&code=synthetic-code';
  assert.match((await c.request(callback+'&expectedAccountId='+ids.two)).headers.get('location'),/synkError=SYNK_CALLBACK/);assert.equal(exchanged,0);
  const result=await c.request(callback);assert.match(result.headers.get('location'),/synkError=SYNK_PLATFORM_ACCOUNT_MISMATCH/);assert.equal(exchanged,1);
  assert.equal(c.jar.get('synk_company_session'),cookie);assert.equal((await c.request('/api/me')).data.user.id,f.admin.id);
  assert.deepEqual(f.app.store.db.prepare('SELECT * FROM synk_identity_links').all(),links);assert.deepEqual(f.app.store.db.prepare('SELECT * FROM tokens ORDER BY hash').all(),tokens);
  assert.match((await c.request(callback)).headers.get('location'),/synkError=SYNK_FLOW/);assert.equal(exchanged,1);
});

test('status exposes an account only for the currently verified SYNK session, never a legacy link or unverified restart',async t=>{
  const f=await fixture(t),c=f.client();assert.equal((await c.request('/api/synk-id/status')).data.synkUserId,null);
  await c.link();assert.equal((await c.request('/api/synk-id/status')).data.synkUserId,ids.one);
  await f.restart();assert.equal((await c.request('/api/synk-id/status')).data.synkUserId,null);
  await c.request('/api/me');assert.equal((await c.request('/api/synk-id/status')).data.synkUserId,ids.one);
  await c.login();const legacy=(await c.request('/api/synk-id/status')).data;assert.equal(legacy.linked,true);assert.equal(legacy.synkUserId,null);
});

test('deactivation during central verification blocks linking and session issuance',async t=>{
  let release,started;const waiting=new Promise(r=>release=r),began=new Promise(r=>started=r);
  const f=await fixture(t,{verify:async()=>{started();await waiting;return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();await c.login();const begin=await c.challenge('link',{currentPassword:password,confirm:true}),pending=c.exchange(begin.data.challenge);await began;f.app.store.put('users',f.staff.id,{...f.staff,active:false});release();assert.equal((await pending).status,409);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM synk_identity_links').get().n,0);
});
test('central revocation invalidates SYNK sessions while company password sessions survive restart',async t=>{
  const f=await fixture(t),c=f.client();await c.link();f.revoke();f.advance(31_000);assert.equal((await c.request('/api/me')).data.user,null);assert.equal((await c.request('/messenger/api/bootstrap')).status,401);
  const local=f.client();await local.login();await f.restart();assert.equal((await local.request('/api/me')).data.user.id,f.staff.id);
});
test('SYNK-derived session survives restart with the same cookie and CSRF after fresh central verification',async t=>{
  let checks=0;const f=await fixture(t,{verify:async()=>{checks++;return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();await c.link();const cookie=c.jar.get('synk_company_session'),csrf=c.csrf,before=checks;await f.restart();assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.equal(checks,before+1);assert.equal(c.jar.get('synk_company_session'),cookie);assert.equal(c.csrf,csrf);assert.equal((await c.request('/api/synk-id/renew',{token:access.one,body:{}})).status,200);
});

test('paused background jobs retain periodic SYNK session revocation checks and cancel them on stop',async t=>{
  const previous=process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
  process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';
  t.after(()=>{if(previous===undefined)delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=previous;});
  const registered=[],original=globalThis.setInterval;
  t.mock.method(globalThis,'setInterval',(callback,ms,...args)=>{const handle=original(callback,ms,...args);registered.push({callback,ms,handle});return handle;});
  const f=await fixture(t),c=f.client();await c.link();
  assert.deepEqual(registered.map(row=>row.ms),[15000],'identity checks remain; collection/outbox/reminder intervals are absent');
  const tokensBefore=f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens').get().n;
  f.revoke();f.advance(31_000);await registered[0].callback();
  assert.ok(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens').get().n<tokensBefore,'timer itself revokes the session before any HTTP request');
  assert.equal((await c.request('/api/me')).data.user,null);
  assert.equal((await c.request('/messenger/api/bootstrap')).status,401);
  const local=f.client();assert.equal((await local.login()).status,200);
  await f.app.stop();assert.ok(registered.every(row=>row.handle._destroyed));
});
test('temporary identity outage denies access without deleting the company session and recovers after revalidation',async t=>{
  let unavailable=false;const f=await fixture(t,{verify:async()=>{if(unavailable)throw Object.assign(Error('busy'),{status:503});return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();await c.link();const before=f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE purpose=\'session\'').get().n;
  unavailable=true;f.advance(31_000);const denied=await c.request('/api/me');assert.equal(denied.status,503);assert.equal(denied.data.code,'SYNK_IDENTITY_UNAVAILABLE');assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE purpose=\'session\'').get().n,before);assert.equal((await c.request('/messenger/api/bootstrap')).status,503);
  unavailable=false;assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.equal((await c.request('/messenger/api/bootstrap')).status,200);
});

async function supportNotification(f,staff,text){
  const project=await staff.request('/api/client-projects',{body:{title:'합성 신원 검증 업무',customerName:'합성 고객',summary:'Synthetic identity recovery fixture'}});assert.equal(project.status,201);
  const invited=await staff.request('/api/client-projects/'+project.data.project.id+'/invite',{body:{revision:project.data.project.revision}});assert.equal(invited.status,200);
  const customer=f.client(),opened=await customer.request('/pulse/api/open',{body:{invite:invited.data.invite}});assert.equal(opened.status,200);
  const response=await fetch(f.base+'/pulse/api/action',{method:'POST',headers:{Cookie:[...customer.jar].map(([key,value])=>key+'='+value).join('; '),Origin:f.app.origin,'Content-Type':'application/json','X-Pulse-CSRF':opened.data.csrf},body:JSON.stringify({revision:opened.data.project.revision,action:'support',text})});
  assert.equal(response.status,200);await response.json();
}

test('temporary SYNK verification outage preserves device subscription and resumes push with the same subscription',async t=>{
  let unavailable=false;
  const f=await fixture(t,{webPushEnabled:true,verify:async()=>{if(unavailable)throw Object.assign(Error('busy'),{status:503});return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();
  assert.equal((await c.link()).status,200);
  const endpoint='https://fcm.googleapis.com/fcm/send/SYNTHETIC-IDENTITY-RECOVERY';
  const registered=await c.request('/api/device-notifications',{body:{subscription:{endpoint},label:'합성 신원 복구 기기'}});assert.equal(registered.status,201);
  const id=registered.data.subscription.id,read=()=>f.app.store.db.prepare('SELECT id,enabled,endpoint FROM web_push_subscriptions WHERE id=?').get(id);
  f.advance(1000);await supportNotification(f,c,'PRIVATE outage fixture');
  unavailable=true;f.advance(31_000);await f.app.deviceNotifications.tick();
  assert.equal(f.sent.length,0,'unverified identity must not reach the push provider');
  assert.deepEqual({...read()},{id,enabled:1,endpoint},'temporary verification failure must preserve the existing device capability');
  assert.equal((await c.request('/api/device-notifications')).status,503);
  assert.equal((await c.request('/api/device-notifications',{body:{subscription:{endpoint},label:'재등록 금지'}})).status,503);
  assert.deepEqual({...read()},{id,enabled:1,endpoint});
  unavailable=false;await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1,'the queued source resumes without registering the browser again');
  const restored=await c.request('/api/device-notifications');assert.equal(restored.status,200);assert.equal(restored.data.subscriptions[0].id,id);assert.equal(restored.data.subscriptions[0].enabled,true);
  f.advance(1000);await supportNotification(f,c,'PRIVATE recovered fixture');await f.app.deviceNotifications.tick();assert.equal(f.sent.length,2);
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,2,'repeated checks must not duplicate the recovered notifications');
  assert.deepEqual({...read()},{id,enabled:1,endpoint});assert.equal(f.app.store.db.prepare("SELECT count(*) AS n FROM web_push_queue WHERE subscription_id=? AND state='accepted'").get(id).n,2);
  assert.doesNotMatch(JSON.stringify(f.sent),/PRIVATE|합성 고객/);
});

test('stopping while SYNK device verification is pending preserves the subscription without sending',async t=>{
  let hold=false,release,announce;const held=new Promise(resolve=>release=resolve),started=new Promise(resolve=>announce=resolve);
  const f=await fixture(t,{webPushEnabled:true,verify:async()=>{if(hold){announce();await held;}return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();
  t.after(()=>release());assert.equal((await c.link()).status,200);
  const endpoint='https://fcm.googleapis.com/fcm/send/SYNTHETIC-IDENTITY-STOP';
  const registered=await c.request('/api/device-notifications',{body:{subscription:{endpoint}}});assert.equal(registered.status,201);
  hold=true;f.advance(31_000);const checking=f.app.deviceNotifications.tick();await started;
  const stopping=f.app.stop();release();await checking;await stopping;
  assert.equal(f.sent.length,0);
  const db=new DatabaseSync(join(f.directory,'company.sqlite'),{readOnly:true});
  try{assert.deepEqual({...db.prepare('SELECT id,enabled,endpoint FROM web_push_subscriptions WHERE id=?').get(registered.data.subscription.id)},{id:registered.data.subscription.id,enabled:1,endpoint},'shutdown is inconclusive, not a permanent subscription revocation');}finally{db.close();}
});
test('renewal preserves the linked identity and unlink requires that same SYNK ID plus company reauthentication',async t=>{
  const f=await fixture(t),c=f.client();await c.link();assert.equal((await c.request('/api/synk-id/renew',{token:access.two,body:{}})).status,409);assert.equal((await c.request('/api/synk-id/renew',{token:access.one,body:{}})).status,200);
  let begin=await c.challenge('unlink',{currentPassword:password,confirm:true});assert.equal((await c.exchange(begin.data.challenge,access.two)).status,403);
  begin=await c.challenge('unlink',{currentPassword:password,confirm:true});assert.equal((await c.exchange(begin.data.challenge)).status,200);assert.equal((await c.request('/api/synk-id/status')).data.linked,false);assert.equal((await c.request('/api/synk-id/status')).data.session,'company');
});
test('browser OAuth keeps PKCE and access token server-side and binds callback to the starting browser',async t=>{
  let request;const f=await fixture(t,{browser:true,fetcher:async(url,options)=>{request={url:String(url),options};return {ok:true,json:async()=>({access_token:access.one})};}}),c=f.client();await c.login();const begin=await c.request('/api/synk-id/start',{body:{action:'link',currentPassword:password,confirm:true}});assert.equal(begin.status,200);const authorization=new URL(begin.data.authorizationUrl);assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');assert.ok(!JSON.stringify(begin.data).includes('verifier'));
  const callback='/api/synk-id/callback?state='+authorization.searchParams.get('state')+'&code=synthetic-code';const other=f.client();assert.match((await other.request(callback)).headers.get('location'),/synkError=/);
  for(const suffix of ['&state=duplicate','&code=duplicate','&error=denied','&redirect=https://evil.example.test/'])assert.match((await c.request(callback+suffix)).headers.get('location'),/synkError=/);
  assert.equal(request,undefined);
  const result=await c.request(callback);assert.equal(result.status,302);assert.match(result.headers.get('location'),/synkConnected=1/);assert.equal(request.url,'https://identity.example.test/auth/v1/oauth/token');const body=new URLSearchParams(request.options.body);assert.ok(body.get('code_verifier'));assert.equal(body.get('redirect_uri'),f.app.origin+'/api/synk-id/callback');assert.equal((await c.request('/api/synk-id/status')).data.linked,true);assert.match((await c.request(callback)).headers.get('location'),/synkError=/);
});
test('mobile manifest keeps its identity and revalidates public assets while authentication remains uncached',async t=>{
  const f=await fixture(t),c=f.client(),manifest=await c.request('/manifest.webmanifest');assert.equal(manifest.status,200);assert.equal(manifest.data.id,'/?app=synk-messenger');assert.equal(manifest.data.start_url,'/?tab=messenger');assert.equal(manifest.headers.get('cache-control'),'public, max-age=0, must-revalidate');assert.ok(manifest.headers.get('etag'));assert.equal((await c.request('/messenger-icon.png')).status,200);assert.equal((await c.request('/synk-id.env.example')).status,404);
  for(const path of ['/','/api/me','/api/synk-id/status']){const response=await c.request(path);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('etag'),null);}
});
test('central response must explicitly be ok and active; temporary HTTP status is retryable',async t=>{
  let httpStatus=200,payload={ok:true,account:{synk_user_id:ids.one,status:'active'}};
  const f=await fixture(t,{verify:false,fetcher:async()=>({ok:httpStatus===200,status:httpStatus,json:async()=>payload})}),c=f.client();
  const jwt='header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';assert.equal((await c.link(f.staff,jwt)).status,200);
  f.advance(31_000);httpStatus=429;assert.equal((await c.request('/api/me')).status,503);httpStatus=200;assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);
  f.advance(31_000);payload={account:{synk_user_id:ids.one,status:'active'}};assert.equal((await c.request('/api/me')).data.user,null);
});
test('central revocation disconnects an already open messenger stream',async t=>{
  const f=await fixture(t),c=f.client();await c.link();const controller=new AbortController();t.after(()=>controller.abort());
  const response=await fetch(f.base+'/messenger/api/events',{headers:{Cookie:[...c.jar].map(([key,value])=>key+'='+value).join('; ')},signal:controller.signal});assert.equal(response.status,200);
  const ended=response.text();f.revoke();f.advance(31_000);assert.equal((await c.request('/api/me')).data.user,null);
  let timeout;await Promise.race([ended,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('stream remained open')),3000);})]).finally(()=>clearTimeout(timeout));
});
test('public settings reject secret keys and insecure identity endpoints',()=>{
  assert.equal(synkIdentityConfig({}),null);assert.throws(()=>synkIdentityConfig({SYNK_ID_ACCOUNT_API_URL:'http://localhost/',SYNK_ID_PUBLISHABLE_KEY:'fixture'}));assert.throws(()=>synkIdentityConfig({SYNK_ID_ACCOUNT_API_URL:'https://identity.example.test/',SYNK_ID_PUBLISHABLE_KEY:'sb_secret_bad'}));
});
test('a fragment in a callback request is rejected before any token exchange',async t=>{
  const f=await fixture(t),service=createSynkIdentity({store:f.app.store,origin:f.app.origin,config:{issuer:'https://identity.example.test'},fetch:async()=>assert.fail('must not call token endpoint')});
  await assert.rejects(service.callback({headers:{}},{},new URL(f.app.origin+'/api/synk-id/callback?state=test&code=test#fragment'),()=>null,()=>{}),error=>error.code==='SYNK_CALLBACK');service.close();
});

async function browserLink(c){
  await c.login();const start=await c.request('/api/synk-id/start',{body:{action:'link',currentPassword:password,confirm:true}}),state=new URL(start.data.authorizationUrl).searchParams.get('state');
  assert.match((await c.request('/api/synk-id/callback?state='+state+'&code=synthetic-code')).headers.get('location'),/synkConnected=1/);assert.equal((await c.request('/api/me')).status,200);
}
test('browser rotates encrypted refresh, survives verification outage, and keeps omitted refresh values',async t=>{
  const stamp=Date.now(),requests=[];let count=0,outage=false;const first='browser-access-initial',next='browser-access-rotated';
  const f=await fixture(t,{browser:true,verify:async value=>{if(outage&&value===next)throw Object.assign(Error('busy'),{status:503});return {synkUserId:ids.one,expiresAt:stamp+(value===first?3600_000:count<=1?7200_000:10800_000)};},fetcher:async(url,options)=>{const values=new URLSearchParams(options.body);if(values.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:first,refresh_token:'browser-refresh-original'})};requests.push(values.get('refresh_token'));count++;return {ok:true,json:async()=>({access_token:next,...(count===1?{refresh_token:'browser-refresh-rotated'}:{})})};}}),c=f.client();await browserLink(c);
  f.advance(3550_000);outage=true;assert.equal((await c.request('/api/me')).status,503);assert.equal(count,1);outage=false;assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.equal(count,1);
  f.advance(3600_000);assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);f.advance(3600_000);assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.deepEqual(requests,['browser-refresh-original','browser-refresh-rotated','browser-refresh-rotated']);
  const rows=JSON.stringify(f.app.store.db.prepare('SELECT * FROM tokens').all());assert.doesNotMatch(rows,/browser-(access|refresh)/);
});
test('concurrent browser requests perform one refresh and cannot revive a logged out company session',async t=>{
  const stamp=Date.now();let release,announce,count=0;const held=new Promise(r=>release=r),started=new Promise(r=>announce=r);
  const f=await fixture(t,{browser:true,verify:async value=>({synkUserId:ids.one,expiresAt:stamp+(value==='browser-access-initial'?3600_000:7200_000)}),fetcher:async(url,options)=>{const values=new URLSearchParams(options.body);if(values.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:'browser-access-initial',refresh_token:'browser-refresh-1'})};if(values.get('grant_type')==='refresh_token'){count++;announce();await held;return {ok:true,json:async()=>({access_token:'browser-access-next',refresh_token:'browser-refresh-2'})};}return {ok:false,status:503};}}),c=f.client();await browserLink(c);f.advance(3550_000);
  const one=c.request('/api/me');await started;const two=c.request('/api/me');await new Promise(r=>setTimeout(r,20));assert.equal(count,1);const ended=await c.request('/api/logout',{body:{}});assert.equal(ended.status,200);assert.equal(ended.data.localSignedOut,true);assert.equal(ended.data.serverRevoked,false);assert.equal(f.app.store.db.prepare("SELECT COUNT(*) AS n FROM tokens WHERE purpose='session'").get().n,0);release();assert.equal((await one).data.user,null);assert.equal((await two).data.user,null);assert.equal(count,1);assert.equal((await c.request('/messenger/api/bootstrap')).status,401);
});
test('browser refresh rejects identity switches, changed link revisions and actual credential revocation',async t=>{
  for(const mode of ['identity','revision','revoked']){
    const stamp=Date.now();let refreshing=false;let f;
    f=await fixture(t,{browser:true,verify:async()=>({synkUserId:refreshing&&mode==='identity'?ids.two:ids.one,expiresAt:stamp+(refreshing?7200_000:3600_000)}),fetcher:async(url,options)=>{const values=new URLSearchParams(options.body);if(values.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:access.one,refresh_token:'browser-refresh-initial'})};refreshing=true;if(mode==='revision')f.app.store.db.prepare('UPDATE synk_identity_links SET revision=? WHERE company_user_id=?').run('replaced-link',f.staff.id);return mode==='revoked'?{ok:false,status:401}:{ok:true,json:async()=>({access_token:access.one,refresh_token:'browser-refresh-next'})};}});const c=f.client();await browserLink(c);f.advance(3550_000);assert.equal((await c.request('/api/me')).data.user,null);assert.equal((await c.request('/messenger/api/bootstrap')).status,401);
  }
});
test('browser logout removes local access during an identity outage and reports only local-scope revocation results',async t=>{
  let unavailable=false;const requests=[],jwt='header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
  const f=await fixture(t,{browser:true,verify:false,fetcher:async(url,options)=>{
    const value=String(url);if(value.endsWith('/oauth/token'))return {ok:true,json:async()=>({access_token:jwt,refresh_token:'browser-private-refresh'})};
    if(options.method==='POST'){requests.push({url:value,body:options.body});return {ok:false,status:503};}
    return {ok:!unavailable,status:unavailable?503:200,json:async()=>({ok:true,account:{synk_user_id:ids.one,status:'active'},sessions:[{id:'synthetic-current-session',current:true,revoked:false}]})};
  }}),c=f.client();await browserLink(c);const oldCookie=c.jar.get('synk_company_session');unavailable=true;f.advance(31_000);assert.equal((await c.request('/api/me')).status,503);assert.equal((await c.request('/api/logout',{csrf:'wrong',body:{}})).status,403);
  const result=await c.request('/api/logout',{body:{}});assert.equal(result.status,200);assert.equal(result.data.ok,true);assert.equal(result.data.localSignedOut,true);assert.equal(result.data.serverRevoked,false);assert.equal(c.jar.has('synk_company_session'),false);assert.equal(requests.length,2);assert.deepEqual(JSON.parse(requests[0].body),{action:'revoke-session',session_id:'synthetic-current-session'});assert.equal(new URL(requests[1].url).searchParams.get('scope'),'local');assert.doesNotMatch(JSON.stringify(result.data),/private-refresh|synthetic-current-session/);
  c.jar.set('synk_company_session',oldCookie);assert.equal((await c.request('/api/me')).data.user,null);
});
test('expired unverified candidates and malformed access responses retain the latest rotated refresh for retry',async t=>{
  const stamp=Date.now(),jwt=seconds=>'header.'+Buffer.from(JSON.stringify({exp:Math.floor(stamp/1000)+seconds})).toString('base64url')+'.synthetic';let count=0,outage=true;const seen=[];
  const f=await fixture(t,{browser:true,verify:async value=>{if(outage&&value===jwt(3600))throw Object.assign(Error('busy'),{status:503});return {synkUserId:ids.one,expiresAt:JSON.parse(Buffer.from(value.split('.')[1],'base64url')).exp*1000};},fetcher:async(url,options)=>{const values=new URLSearchParams(options.body);if(values.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:jwt(3590),refresh_token:'refresh-1'})};seen.push(values.get('refresh_token'));count++;return {ok:true,json:async()=>({access_token:count===1?jwt(3600):count===2?'bad':jwt(7200),refresh_token:'refresh-'+(count+1)})};}}),c=f.client();await browserLink(c);f.advance(3550_000);assert.equal((await c.request('/api/me')).status,503);f.advance(60_000);assert.equal((await c.request('/api/me')).status,503);outage=false;assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.deepEqual(seen,['refresh-1','refresh-2','refresh-3']);
});

test('restored identity outage blocks HTTP and push, then preserves the same device, consent and VAPID key',async t=>{
  let outage=false,checks=0;
  const f=await fixture(t,{webPushEnabled:true,verify:async()=>{checks++;if(outage)throw Object.assign(Error('busy'),{status:503});return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();
  await c.link();const endpoint='https://fcm.googleapis.com/fcm/send/SYNTHETIC-RESTART';
  const registered=await c.request('/api/device-notifications',{body:{subscription:{endpoint},label:'합성 재시작 기기'}}),id=registered.data.subscription.id;
  const oldCookie=c.jar.get('synk_company_session'),oldCsrf=c.csrf,key=await readFile(join(f.directory,'encryption.key')),vapid=f.app.store.secret('device-web-push-vapid');
  const expiry=f.app.store.db.prepare("SELECT expiresAt FROM tokens WHERE purpose='session'").get().expiresAt;
  f.advance(1000);await supportNotification(f,c,'PRIVATE restart notification');const before=checks;outage=true;await f.restart();await f.app.deviceNotifications.tick();
  assert.ok(checks>before,'startup push must freshly verify the restored identity');assert.equal(f.sent.length,0);
  assert.equal((await c.request('/api/me')).status,503);assert.equal((await c.request('/api/device-notifications')).status,503);
  assert.deepEqual({...f.app.store.db.prepare('SELECT id,enabled,endpoint FROM web_push_subscriptions WHERE id=?').get(id)},{id,enabled:1,endpoint});
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,1);
  outage=false;await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);
  assert.equal(c.jar.get('synk_company_session'),oldCookie);assert.equal(c.csrf,oldCsrf);
  assert.equal((await c.request('/api/device-notifications')).data.subscriptions[0].id,id);
  assert.deepEqual(await readFile(join(f.directory,'encryption.key')),key);assert.deepEqual(f.app.store.secret('device-web-push-vapid'),vapid);
  assert.equal(f.app.store.db.prepare("SELECT expiresAt FROM tokens WHERE purpose='session'").get().expiresAt,expiry,'restart does not extend the seven-day company session');
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);assert.doesNotMatch(JSON.stringify(f.sent),/PRIVATE/);
});

test('centrally revoked restored identity cannot use HTTP or send startup push',async t=>{
  const f=await fixture(t,{webPushEnabled:true}),c=f.client();await c.link();
  const registered=await c.request('/api/device-notifications',{body:{subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/SYNTHETIC-REVOKED-RESTART'}}});
  f.advance(1000);await supportNotification(f,c,'Synthetic revoked notification');f.revoke();await f.restart();await f.app.deviceNotifications.tick();
  assert.equal(f.sent.length,0);assert.equal((await c.request('/api/me')).data.user,null);
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,0);
  const row=f.app.store.db.prepare('SELECT enabled,endpoint FROM web_push_subscriptions WHERE id=?').get(registered.data.subscription.id);assert.equal(row.enabled,0);assert.equal(row.endpoint,null);
});

test('browser restart restores expired access through refresh without persisting plaintext credentials',async t=>{
  const stamp=Date.now(),seen=[];let checks=0;
  const first='SYNTHETIC-PRIVATE-ACCESS-INITIAL',next='SYNTHETIC-PRIVATE-ACCESS-ROTATED',refresh='SYNTHETIC-PRIVATE-REFRESH-INITIAL';
  const f=await fixture(t,{browser:true,verify:async value=>{checks++;return {synkUserId:ids.one,expiresAt:stamp+(value===first?3600_000:7200_000),currentSessionId:'fixture-central-session'};},fetcher:async(url,options)=>{
    const body=new URLSearchParams(options.body);if(body.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:first,refresh_token:refresh})};
    seen.push(body.get('refresh_token'));return {ok:true,json:async()=>({access_token:next,refresh_token:'SYNTHETIC-PRIVATE-REFRESH-ROTATED'})};
  }}),c=f.client();await browserLink(c);
  const saved=f.app.store.db.prepare('SELECT * FROM synk_identity_sessions').get();assert.equal(f.app.store.decrypt(saved.ciphertext).refreshToken,refresh);
  for(const file of ['company.sqlite','company.sqlite-wal']){const bytes=await readFile(join(f.directory,file));for(const secret of [first,refresh])assert.equal(bytes.includes(Buffer.from(secret)),false,file+' contains plaintext');}
  const before=checks;f.advance(3610_000);await f.restart();assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.equal(checks,before+1);assert.deepEqual(seen,[refresh]);
  const persisted=f.app.store.decrypt(f.app.store.db.prepare('SELECT ciphertext FROM synk_identity_sessions').get().ciphertext);assert.equal(persisted.accessToken,next);assert.equal(persisted.pendingAccessToken,null);
});

test('pending verified-later access and rotated refresh survive restart during central outage',async t=>{
  const stamp=Date.now(),seen=[];let outage=false;
  const f=await fixture(t,{browser:true,verify:async value=>{if(outage&&value==='pending-access-next')throw Object.assign(Error('busy'),{status:503});return {synkUserId:ids.one,expiresAt:stamp+(value==='pending-access-first'?3600_000:7200_000)};},fetcher:async(url,options)=>{
    const body=new URLSearchParams(options.body);if(body.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:'pending-access-first',refresh_token:'pending-refresh-first'})};seen.push(body.get('refresh_token'));return {ok:true,json:async()=>({access_token:'pending-access-next',refresh_token:'pending-refresh-next'})};
  }}),c=f.client();await browserLink(c);f.advance(3550_000);outage=true;assert.equal((await c.request('/api/me')).status,503);
  await f.restart();assert.equal((await c.request('/api/me')).status,503);assert.deepEqual(seen,['pending-refresh-first']);
  const saved=f.app.store.decrypt(f.app.store.db.prepare('SELECT ciphertext FROM synk_identity_sessions').get().ciphertext);assert.equal(saved.pendingAccessToken,'pending-access-next');assert.equal(saved.refreshToken,'pending-refresh-next');
  outage=false;assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.deepEqual(seen,['pending-refresh-first'],'pending access is verified without rotating refresh again');
});

test('malformed refreshed access still saves the rotated refresh across restart',async t=>{
  const stamp=Date.now(),seen=[];
  const f=await fixture(t,{browser:true,verify:async value=>({synkUserId:ids.one,expiresAt:stamp+(value==='malformed-access-first'?3600_000:7200_000)}),fetcher:async(url,options)=>{
    const body=new URLSearchParams(options.body);if(body.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:'malformed-access-first',refresh_token:'malformed-refresh-first'})};seen.push(body.get('refresh_token'));return {ok:true,json:async()=>({access_token:seen.length===1?'bad':'malformed-access-next',refresh_token:'malformed-refresh-next'})};
  }}),c=f.client();await browserLink(c);f.advance(3550_000);assert.equal((await c.request('/api/me')).status,503);await f.restart();assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.deepEqual(seen,['malformed-refresh-first','malformed-refresh-next']);
});

test('copied or damaged encrypted sessions and changed issuer binding are rejected before central verification',async t=>{
  for(const mode of ['copied','damaged','configuration','revision','inactive','expired']){
    await t.test(mode,async t=>{
      let checks=0;const f=await fixture(t,{verify:async()=>{checks++;return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();await c.link();
      const saved=f.app.store.db.prepare('SELECT * FROM synk_identity_sessions').get();
      if(mode==='copied'){const second=f.client(),challenge=await second.challenge();await second.exchange(challenge.data.challenge);f.app.store.db.prepare('UPDATE synk_identity_sessions SET ciphertext=? WHERE session_hash<>?').run(saved.ciphertext,saved.session_hash);c.jar.clear();for(const pair of second.jar)c.jar.set(...pair);}
      if(mode==='damaged')f.app.store.db.prepare('UPDATE synk_identity_sessions SET ciphertext=?').run('corrupt');
      if(mode==='revision')f.app.store.db.prepare('UPDATE synk_identity_links SET revision=?').run('different-link');
      if(mode==='inactive')f.app.store.put('users',f.staff.id,{...f.staff,active:false});
      if(mode==='expired')f.app.store.db.prepare("UPDATE tokens SET expiresAt='2000-01-01T00:00:00.000Z' WHERE purpose='session'").run();
      const before=checks;await f.restart(mode==='configuration'?{synkIdentityConfig:{accountApiUrl:'https://other.example.test/functions/v1/synk-account',publishableKey:'other-public',issuer:null,clientId:null}}:{});
      assert.equal((await c.request('/api/me')).data.user,null);assert.equal(checks,before,'invalid binding must not contact the identity service');
      assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,mode==='copied'?1:0);
    });
  }
});

test('logout after restart revokes browser central session and removes encrypted credentials',async t=>{
  const requests=[];const f=await fixture(t,{browser:true,verify:async()=>({synkUserId:ids.one,expiresAt:Date.now()+3600_000,currentSessionId:'restored-central-session'}),fetcher:async(url,options)=>{
    if(String(url).endsWith('/oauth/token'))return {ok:true,json:async()=>({access_token:access.one,refresh_token:'restored-browser-refresh'})};requests.push({url:String(url),body:options.body});return {ok:true,json:async()=>({ok:true})};
  }}),c=f.client();await browserLink(c);const cookie=c.jar.get('synk_company_session');await f.restart();const result=await c.request('/api/logout',{body:{}});assert.equal(result.data.serverRevoked,true);
  assert.equal(requests.length,2);assert.equal(JSON.parse(requests[0].body).session_id,'restored-central-session');assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,0);
  await f.restart();c.jar.set('synk_company_session',cookie);assert.equal((await c.request('/api/me')).data.user,null);
});

test('company token revocation cascades and unlink after restart removes all SYNK sessions',async t=>{
  const f=await fixture(t),c=f.client();await c.link();const second=f.client(),begin=await second.challenge();await second.exchange(begin.data.challenge);
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,2);await f.restart();
  const unlink=await c.challenge('unlink',{currentPassword:password,confirm:true});assert.equal((await c.exchange(unlink.data.challenge)).status,200);
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,0);assert.equal((await second.request('/api/me')).data.user,null);
  await c.link();assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,1);f.app.store.revokeUser(f.staff.id);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,0);
  await f.restart();assert.equal((await c.request('/api/me')).data.user,null);
});

test('graceful shutdown drains an in-flight refresh and retains the rotated credential for restart',async t=>{
  const stamp=Date.now();let release,announce;const held=new Promise(r=>release=r),started=new Promise(r=>announce=r),seen=[];
  const f=await fixture(t,{browser:true,verify:async value=>({synkUserId:ids.one,expiresAt:stamp+(value==='drain-access-first'?3600_000:7200_000)}),fetcher:async(url,options)=>{
    const body=new URLSearchParams(options.body);if(body.get('grant_type')==='authorization_code')return {ok:true,json:async()=>({access_token:'drain-access-first',refresh_token:'drain-refresh-first'})};seen.push(body.get('refresh_token'));announce();await held;return {ok:true,json:async()=>({access_token:'drain-access-next',refresh_token:'drain-refresh-next'})};
  }}),c=f.client();t.after(()=>release());await browserLink(c);f.advance(3550_000);const pending=c.request('/api/me');await started;const stopping=f.app.stop();release();await pending;await stopping;await f.restart();
  assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.deepEqual(seen,['drain-refresh-first']);
  assert.equal(f.app.store.decrypt(f.app.store.db.prepare('SELECT ciphertext FROM synk_identity_sessions').get().ciphertext).refreshToken,'drain-refresh-next');
});

test('logout body completed during shutdown still deletes credentials and cannot revive access or push',async t=>{
  for(const browser of [false,true])await t.test(browser?'SYNK browser session':'company password session',async t=>{
    const central=[];const f=await fixture(t,{browser,webPushEnabled:true,verify:async()=>({synkUserId:ids.one,expiresAt:Date.now()+3600_000,currentSessionId:'shutdown-logout-central'}),fetcher:async(url,options)=>{
      if(String(url).endsWith('/oauth/token'))return {ok:true,json:async()=>({access_token:access.one,refresh_token:'shutdown-logout-refresh'})};central.push(String(url));return {ok:true,json:async()=>({ok:true})};
    }}),c=f.client();if(browser)await browserLink(c);else await c.login();
    const registered=await c.request('/api/device-notifications',{body:{subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/SYNTHETIC-SHUTDOWN-LOGOUT'}}});assert.equal(registered.status,201);
    const accepted=new Promise(resolve=>f.app.server.once('request',resolve));let req;
    const response=new Promise((resolve,reject)=>{req=httpRequest(f.base+'/api/logout',{method:'POST',headers:{Cookie:[...c.jar].map(([key,value])=>key+'='+value).join('; '),Origin:f.app.origin,'X-CSRF-Token':c.csrf,'Content-Type':'application/json','Content-Length':2}},res=>{let body='';res.setEncoding('utf8');res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(body)}));});req.on('error',reject);req.write('{');});
    await accepted;const stopping=f.app.stop();await new Promise(resolve=>setTimeout(resolve,30));req.end('}');
    const ended=await response;assert.equal(ended.status,200);assert.equal(ended.data.localSignedOut,true);if(browser){assert.equal(ended.data.serverRevoked,true);assert.equal(central.length,2);}
    await stopping;const db=new DatabaseSync(join(f.directory,'company.sqlite'),{readOnly:true});try{assert.equal(db.prepare("SELECT COUNT(*) n FROM tokens WHERE purpose='session'").get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM synk_identity_sessions').get().n,0);}finally{db.close();}
    await f.restart();assert.equal((await c.request('/api/me')).data.user,null);await f.app.deviceNotifications.tick();assert.equal(f.sent.length,0);
    const device=f.app.store.db.prepare('SELECT enabled,endpoint FROM web_push_subscriptions WHERE id=?').get(registered.data.subscription.id);assert.equal(device.enabled,0);assert.equal(device.endpoint,null);
  });
});
