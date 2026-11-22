import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
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
  const fx={get app(){return app;},get base(){return `http://127.0.0.1:${address.port}`;},directory:dir,sent,staff,admin,advance:ms=>stamp+=ms,get now(){return stamp;},revoke:()=>{rejected=true;},async restart(changes={}){await app.stop();Object.assign(options,changes);app=createCompanyApp(options);address=await app.start();},client(){
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

test('status names the SYNK ID login email from the centrally accepted token only to that verified SYNK session',async t=>{
  const payload={ok:true,account:{synk_user_id:ids.one,status:'active'}};
  const f=await fixture(t,{verify:false,fetcher:async()=>({ok:true,status:200,json:async()=>payload})}),c=f.client(),legacy=f.client();
  const token=claims=>'header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,...claims})).toString('base64url')+'.synthetic';
  assert.equal((await c.request('/api/synk-id/status')).data.loginEmail,null);
  assert.equal((await c.link(f.staff,token({email:'Founder@Example.test'}))).status,200);
  assert.equal((await c.request('/api/synk-id/status')).data.loginEmail,'founder@example.test');
  const db=new DatabaseSync(join(f.directory,'company.sqlite'),{readOnly:true});let row;try{row=db.prepare('SELECT ciphertext FROM synk_identity_sessions').all();}finally{db.close();}
  assert.equal(row.length,1);assert.doesNotMatch(row[0].ciphertext,/founder@example/i);
  await f.restart();assert.equal((await c.request('/api/synk-id/status')).data.loginEmail,null);
  await c.request('/api/me');assert.equal((await c.request('/api/synk-id/status')).data.loginEmail,'founder@example.test');
  await legacy.login();const company=(await legacy.request('/api/synk-id/status')).data;assert.equal(company.session,'company');assert.equal(company.loginEmail,null);
});
test('a token without a usable email claim names nobody and keeps the session working',async t=>{
  const f=await fixture(t,{verify:false,fetcher:async()=>({ok:true,status:200,json:async()=>({ok:true,account:{synk_user_id:ids.one,status:'active'}})})}),c=f.client();
  const jwt='header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,email:'not an email'})).toString('base64url')+'.synthetic';
  assert.equal((await c.link(f.staff,jwt)).status,200);const status=(await c.request('/api/synk-id/status')).data;
  assert.equal(status.synkUserId,ids.one);assert.equal(status.loginEmail,null);assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);
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

async function supportNotification(f,staff,text,{deferPush=true,beforeAction=()=>{}}={}){
  // These recovery fixtures need an undelivered source at the outage boundary.
  // Production also drains on change, before this HTTP response arrives; pause
  // only that scheduler entry, then exercise the real tick after the boundary.
  const tick=f.app.deviceNotifications.tick;
  if(deferPush)f.app.deviceNotifications.tick=async()=>{};
  try{
    const project=await staff.request('/api/client-projects',{body:{title:'합성 신원 검증 업무',customerName:'합성 고객',summary:'Synthetic identity recovery fixture'}});assert.equal(project.status,201);
    const invited=await staff.request('/api/client-projects/'+project.data.project.id+'/invite',{body:{revision:project.data.project.revision}});assert.equal(invited.status,200);
    const customer=f.client(),opened=await customer.request('/pulse/api/open',{body:{invite:invited.data.invite}});assert.equal(opened.status,200);
    await beforeAction();
    const response=await fetch(f.base+'/pulse/api/action',{method:'POST',headers:{Cookie:[...customer.jar].map(([key,value])=>key+'='+value).join('; '),Origin:f.app.origin,'Content-Type':'application/json','X-Pulse-CSRF':opened.data.csrf},body:JSON.stringify({revision:opened.data.project.revision,action:'support',text})});
    assert.equal(response.status,200);await response.json();
  }finally{if(deferPush)f.app.deviceNotifications.tick=tick;}
}

test('immediate customer event revalidates an unavailable identity before reaching the push provider',async t=>{
  let unavailable=false,failedChecks=0;
  const f=await fixture(t,{webPushEnabled:true,verify:async()=>{if(unavailable){failedChecks++;throw Object.assign(Error('busy'),{status:503});}return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();
  assert.equal((await c.link()).status,200);
  const registered=await c.request('/api/device-notifications',{body:{subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/SYNTHETIC-IMMEDIATE-OUTAGE'}}});assert.equal(registered.status,201);
  await supportNotification(f,c,'PRIVATE immediate outage source',{deferPush:false,beforeAction(){unavailable=true;f.advance(31_000);}});
  assert.ok(failedChecks>0,'the immediate change path must ask the identity verifier before a manual tick');assert.equal(f.sent.length,0,'immediate delivery cannot bypass the identity outage');
  await f.app.deviceNotifications.tick();assert.equal(f.sent.length,0,'manual delivery cannot bypass the identity outage');
  assert.equal(f.app.store.db.prepare('SELECT enabled FROM web_push_subscriptions WHERE id=?').get(registered.data.subscription.id).enabled,1);
  unavailable=false;await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);await f.app.deviceNotifications.tick();assert.equal(f.sent.length,1);
});

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
  // 다시 로그인에 쓰는 SYNK ID 포털 주소는 기본 synk.im/id이고, 바꿀 때도 외부 HTTPS 주소만 받는다.
  const browserEnv={SYNK_ID_ACCOUNT_API_URL:'https://identity.example.test/functions/v1/synk-account',SYNK_ID_PUBLISHABLE_KEY:'fixture-public',SYNK_ID_SUPABASE_URL:'https://identity.example.test',SYNK_ID_MESSENGER_CLIENT_ID:'messenger-browser'};
  assert.equal(synkIdentityConfig(browserEnv).portalUrl,'https://synk.im/id/');
  assert.equal(synkIdentityConfig({...browserEnv,SYNK_ID_PORTAL_URL:'https://portal.example.test/id/'}).portalUrl,'https://portal.example.test/id/');
  for(const bad of ['http://synk.im/id/','https://localhost/id/','https://synk.im/id/?next=x','https://user:pw@synk.im/id/','not a url'])assert.throws(()=>synkIdentityConfig({...browserEnv,SYNK_ID_PORTAL_URL:bad}),undefined,bad);
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
// 2026-10-23 로그인 되찾기: 비밀번호를 바꿔도 지금 SYNK 세션은 그대로(데스크톱 갱신이 이어진다), 재설정 링크는 SYNK 연결을 남긴다.
test('saving a password in a SYNK ID session keeps that same SYNK session, so desktop renewal goes on',async t=>{
  const f=await fixture(t),c=f.client();await c.link();const cookie=c.jar.get('synk_company_session'),csrf=c.csrf,other=f.client();await other.login();
  const saved=await c.request('/api/account/password',{body:{oldPassword:password,password:'synk-session-new-password'}});
  assert.equal(saved.status,200);assert.equal(c.jar.get('synk_company_session'),cookie);assert.equal(c.csrf,csrf);
  const status=(await c.request('/api/synk-id/status')).data;assert.equal(status.session,'synk');assert.equal(status.linked,true);
  assert.equal((await c.request('/api/synk-id/renew',{token:access.one,body:{}})).status,200);assert.equal((await c.request('/messenger/api/bootstrap')).status,200);
  assert.equal((await other.request('/api/me')).data.user,null);assert.equal((await f.client().login()).status,401);
});
test('a reset link keeps the SYNK ID link, ends the SYNK session too, and Google·SYNK ID still signs in',async t=>{
  const f=await fixture(t),c=f.client();await c.link();const a=f.client();await a.login(f.admin);
  const made=await a.request(`/api/members/${f.staff.id}/password-reset`,{body:{}});assert.equal(made.status,201);
  const token=new URL(made.data.resetUrl).hash.slice('#reset='.length);
  assert.equal((await f.client().request('/api/password-reset',{body:{token,password:'after-reset-password'}})).status,200);
  assert.equal((await c.request('/api/me')).data.user,null);
  const next=f.client(),begin=await next.challenge();assert.equal((await next.exchange(begin.data.challenge)).data.user.id,f.staff.id);assert.equal((await next.request('/api/synk-id/status')).data.linked,true);
});
test('after a restart a restored SYNK session without a password still sets the first password and stays a SYNK session',async t=>{
  const f=await fixture(t),c=f.client();await c.link();f.app.store.put('users',f.staff.id,{...f.app.store.get('users',f.staff.id),passwordHash:null});
  await f.restart();assert.equal((await c.request('/api/account/password',{body:{password:'first-after-restart'}})).status,200);assert.equal((await c.request('/api/synk-id/status')).data.session,'synk');
  assert.equal((await f.client().request('/api/login',{body:{email:f.staff.email,password:'first-after-restart'}})).status,200);
});

test('admin member directory pages local members, merges only verified identities and separates central authority',async t=>{
  let calls=0, hold, entered, mockResponse;
  const name='중앙 합성 회원';
  const f=await fixture(t,{fetcher:async(url,init)=>{
    calls++;assert.equal(init.headers.Authorization,'Bearer '+access.one);
    assert.deepEqual(JSON.parse(init.body),{action:'admin-member-directory',q:'검색',page:1,status:'all'});
    if(entered){entered();await hold;}
    if(mockResponse)return mockResponse();
    return Response.json({ok:true,total:1,pageSize:25,page:1,rows:[{id:ids.two,name,loginId:'central@example.test',status:'active',createdAt:'2026-01-01T00:00:00Z',privateField:'omit'}]});
  }});
  const local='/api/admin/member-directory/workspace',global='/api/admin/member-directory/synk';
  const post=(client,path,body={})=>client.request(path,{body});
  const c=f.client(),member=f.client(),query={q:'검색'};
  await c.login(f.admin);await member.login(f.staff);
  assert.equal((await post(member,local)).status,403);
  assert.equal((await post(c,global,query)).status,403);assert.equal(calls,0);
  assert.equal((await c.request(local,{csrf:'invalid',body:{}})).status,403);
  assert.equal((await post(c,local,{page:0})).status,400);
  assert.equal((await post(c,local,{q:'%_'})).data.total,0);
  assert.equal((await post(c,local,{q:'staff:'})).data.total,0);
  assert.equal((await post(c,local,{q:f.staff.id.slice(0,8)})).data.rows[0].staffId,f.staff.id);
  const unlinked=(await post(c,local,{q:f.staff.id})).data.rows[0];
  assert.equal(unlinked.id,f.staff.id);
  assert.deepEqual(unlinked.brands,[]);
  for(const q of [unlinked.id,'staff:'+f.staff.id])assert.equal((await post(c,local,{q})).data.rows[0].staffId,f.staff.id);
  await c.link(f.admin);
  const store=f.app.store;
  store.put('customerWorkspaces','brand-1',{name:'합성 브랜드',status:'active',members:[
    {synkUserId:ids.one,displayName:'다른 표시명',role:'admin'},{synkUserId:ids.two,displayName:f.admin.name,role:'member'}]});
  store.put('users',f.staff.id,{...f.staff,workspaceProfile:'legacy-invalid'});
  assert.equal((await post(c,local,{company:'LAB'})).data.total,0);
  assert.equal((await post(c,local,{status:'active',type:'staff',company:'PULSE'})).data.total,0);
  assert.equal((await post(c,local,{status:'active',type:'customer',company:'PULSE'})).data.total,2);
  store.put('users',f.staff.id,{...f.staff,workspaceProfile:{memberships:[{company:'LAB',role:'teacher'}],duties:[]}});
  assert.deepEqual((await post(c,local,{type:'staff',company:'LAB'})).data.rows.map(row=>row.staffId),[f.staff.id]);
  // This member can still use an active brand after their staff access ends.
  store.db.prepare('INSERT INTO synk_identity_links VALUES(?,?,?,?)').run(ids.two,f.staff.id,'test',new Date().toISOString());
  store.put('users',f.staff.id,{...store.get('users',f.staff.id),active:false});
  assert.equal((await post(c,local,{q:ids.two,type:'staff',status:'disabled'})).data.rows[0].status,'disabled');
  assert.equal((await post(c,local,{q:ids.two,type:'customer',status:'active'})).data.rows[0].status,'active');
  assert.equal((await post(c,local,{q:ids.two,status:'disabled'})).data.total,0);
  store.db.prepare('DELETE FROM synk_identity_links WHERE synk_user_id=?').run(ids.two);
  store.put('customerWorkspaces','invalid-identity',{name:'Invalid',status:'active',members:[{synkUserId:'z'.repeat(36),displayName:'잘못된 식별자',role:'member'}]});
  assert.equal((await post(c,local,{q:'잘못된 식별자'})).data.total,0);
  store.put('customerWorkspaces','legacy-brand',{name:'Legacy',members:[{synkUserId:'33333333-3333-4333-8333-333333333333',displayName:'Legacy client',role:'member'}]});
  assert.equal((await post(c,local,{q:'Legacy client',type:'customer'})).data.rows[0].status,'disabled');
  const clients=(await post(c,local,{type:'customer',q:f.admin.name})).data;
  assert.equal(clients.total,2);
  const both=clients.rows.find(row=>row.staffId===f.admin.id);
  assert.equal(both.brands[0].name,'합성 브랜드');assert.equal(both.id,ids.one);
  assert.equal(JSON.stringify(clients).includes('passwordHash'),false);
  store.put('customerWorkspaces','brand-2',{name:'가람 브랜드',status:'archived',members:[
    {synkUserId:ids.one,displayName:'다른 표시명',role:'member'}]});
  const staffOnly=(await post(c,local,{type:'staff',q:'다른 표시명'})).data;
  assert.equal(staffOnly.total,1);assert.equal(staffOnly.rows[0].id,ids.one);
  assert.deepEqual(staffOnly.rows[0].brands,[
    {name:'가람 브랜드',role:'member',status:'archived'},
    {name:'합성 브랜드',role:'admin',status:'active'},
  ]);
  const found=(await post(c,global,query)).data;
  assert.equal(found.rows[0].name,name);assert.equal(found.rows[0].privateField,undefined);
  for(let i=0;i<29;i++)store.put('users','directory-test-'+i,{id:'directory-test-'+i,name:'동명',active:true,email:'member'+i+'@example.test',role:'member'});
  const page1=(await post(c,local,{q:'동명'})).data,page2=(await post(c,local,{q:'동명',page:2})).data;
  assert.equal(page1.total,29);assert.equal(page1.rows.length,25);assert.equal(page2.rows.length,4);
  assert.equal(new Set([...page1.rows,...page2.rows].map(row=>row.id)).size,29);
  for(const code of [401,403,503]){
    mockResponse=()=>new Response(null,{status:code});
    const response=await post(c,global,query);
    assert.equal(response.status,code===503?503:403);assert.equal(response.data.rows,undefined);
  }
  const validRow={id:ids.one,name,loginId:'',status:'active',createdAt:'2026-01-01T00:00:00Z'};
  const validPage={ok:true,pageSize:25,page:1,total:1,rows:[validRow]};
  mockResponse=()=>Response.json(validPage);
  assert.equal((await post(c,global,query)).status,200);
  for(const invalid of [{page:2},{total:26,rows:Array(26).fill(validRow)},{total:0},{total:2},{total:1,rows:[]},{rows:[{...validRow,status:'bogus'}]}]){
    mockResponse=()=>Response.json({...validPage,...invalid});
    assert.equal((await post(c,global,query)).status,503);
  }
  mockResponse=null;
  let release;
  hold=new Promise(resolve=>{release=resolve;});
  const started=new Promise(resolve=>{entered=resolve;});
  const pending=post(c,global,query);
  await Promise.race([started,pending.then(result=>assert.fail('Central request ended early: '+result.status))]);
  store.put('users',f.admin.id,{...store.get('users',f.admin.id),role:'member'});
  release();assert.equal((await pending).status,403);
});

// 관리자 직접부여(설계 2 · 4 · 6절): 15분 대화형 로그인, 시작 링크 세션, 중앙 호출 callAdminGrants.
// 중앙 응답 꼴은 SYNK-talk lib/synk-account-admin-grants.js(31a8e8f5)와 같다.
const grantsPath='/api/admin/synk-grants';
const classId='44444444-4444-4444-8444-444444444444',requestA='55555555-5555-4555-8555-555555555555';
const classRow={id:classId,classKey:'test-evening',displayName:'시험 저녁반',active:true,test:true,seasonless:true,teachers:1,learners:3,openRows:0,createdAt:'2026-11-21T10:00:00.123456+00:00'};
const classView={id:classId,classKey:'test-evening',displayName:'시험 저녁반',active:true,test:true};
const page=(rows=[],total=rows.length)=>Response.json({ok:true,op:'classes.list',total,page:1,pageSize:25,rows});
const applied=(body,data)=>Response.json({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',...data});
// 중앙 admin-reauth-claim(관리자 브라우저 로그인의 교환 직후)은 calls와 따로 claims에 모은다. 기본 답은 bound:true · loginAt 지금이다.
async function grantsFixture(t,central=()=>page()){
  const calls=[],claims=[],tokenCalls=[];let gate=null,f=null;
  const control={claim:()=>Response.json({ok:true,bound:true,loginAt:new Date(f.now).toISOString()}),refreshToken:null};
  f=await fixture(t,{browser:true,fetcher:async(url,init)=>{
    if(String(url).endsWith('/oauth/token')){tokenCalls.push(new URLSearchParams(init.body).get('grant_type'));return Response.json({access_token:init.body.includes('second-code')?access.two:access.one,...(control.refreshToken?{refresh_token:control.refreshToken}:{})});}
    const body=JSON.parse(init.body);
    if(body.action==='admin-reauth-claim'){claims.push({url:String(url),headers:init.headers,body});return control.claim(body,init);}
    calls.push({url:String(url),headers:init.headers,body});
    if(gate){const current=gate;gate=null;current.enter();await current.released;}
    return central(body,init);
  }});
  const holdNext=()=>{let enter,release;const started=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});gate={enter,released};return {started,release};};
  return {f,calls,holdNext,claims,control,tokenCalls};
}
// 브라우저 SYNK ID 로그인(대화형)으로 세션을 만든다. 먼저 회사 비밀번호 + 교환으로 SYNK ID를 연결해 둔다.
async function interactive(c,{expected=ids.one,code='synthetic-code'}={}){
  const start=await c.request('/api/synk-id/start',{body:{action:'login',expectedAccountId:expected,returnTo:'admin'}});
  assert.equal(start.status,200);
  const state=new URL(start.data.authorizationUrl).searchParams.get('state');
  const back=await c.request('/api/synk-id/callback?state='+state+'&code='+code);
  assert.equal(back.status,302);assert.equal(back.headers.get('location'),'/?tab=admin&synkConnected=1');
  const me=await c.request('/api/me');assert.equal(me.status,200);return me;
}
const listBody={op:'classes.list',q:'',active:'all',page:1};
const createBody=(requestId=requestA)=>({op:'class.create',classKey:'test-evening',displayName:'시험 저녁반',test:true,requestId,confirm:true});
const created=body=>applied(body,{class:{...classView,extra:'omit'}});

test('grants route needs an administrator, CSRF, same origin, a SYNK session and never a launch session',async t=>{
  const {f,calls}=await grantsFixture(t);
  const member=f.client();await member.login(f.staff);
  assert.equal((await member.request(grantsPath,{body:listBody})).status,403);
  const password=f.client();await password.login(f.admin);
  const company=await password.request(grantsPath,{body:listBody});assert.equal(company.status,403);assert.equal(company.data.code,'SYNK_LOGIN_REQUIRED');
  const launch=f.client(),launched=await launch.request('/api/launch',{body:{token:f.app.store.mint('launch',f.admin.id,{},5)}});
  assert.equal(launched.status,200);assert.ok(f.app.store.db.prepare("SELECT body FROM tokens WHERE purpose='session' AND userId=?").all(f.admin.id).some(row=>JSON.parse(row.body).via==='launch'));
  const fromLaunch=await launch.request(grantsPath,{body:listBody});assert.equal(fromLaunch.status,403);assert.equal(fromLaunch.data.code,'SYNK_LOGIN_REQUIRED');
  assert.equal((await launch.request(grantsPath,{body:createBody()})).status,403);
  const c=f.client();await c.link(f.admin);
  assert.equal((await c.request(grantsPath,{csrf:'wrong',body:listBody})).status,403);
  assert.equal((await c.request(grantsPath,{csrf:'',body:listBody})).status,403);
  assert.equal((await c.request(grantsPath,{origin:'https://other.example.test',body:listBody})).status,403);
  assert.equal((await c.request(grantsPath+'?op=classes.list',{body:listBody})).status,403);
  assert.equal((await c.request(grantsPath,{body:listBody,method:'POST'})).status,200);
  assert.equal(calls.length,1);assert.deepEqual(calls[0].body,{action:'admin-workspace-grants',op:'classes.list',q:'',active:'all',page:1});
});

test('only a browser SYNK ID login within 15 minutes opens writes; renew, refresh, exchange and restart never raise it',async t=>{
  const {f,calls}=await grantsFixture(t,body=>body.op==='class.create'?created(body):page());
  const c=f.client();await c.link(f.admin);
  assert.equal((await c.request('/api/synk-id/status')).data.reauthNeeded,true);
  const exchanged=await c.request(grantsPath,{body:createBody()});assert.equal(exchanged.status,409);assert.equal(exchanged.data.code,'REAUTH_REQUIRED');
  assert.equal(calls.length,0);
  assert.equal((await c.request(grantsPath,{body:listBody})).status,200,'reads do not need a recent login');
  await interactive(c);
  assert.equal((await c.request('/api/synk-id/status')).data.reauthNeeded,false);
  const ok=await c.request(grantsPath,{body:createBody()});assert.equal(ok.status,200);
  assert.deepEqual(ok.data,{ok:true,op:'class.create',requestId:requestA,outcome:'applied',class:classView});
  const sent=calls.at(-1);
  assert.deepEqual(sent.body,{action:'admin-workspace-grants',op:'class.create',classKey:'test-evening',displayName:'시험 저녁반',test:true,requestId:requestA,confirm:true});
  assert.equal(sent.headers.Authorization,'Bearer '+access.one);assert.equal(sent.headers.apikey,'fixture-public');assert.equal(sent.headers['X-SYNK-Product'],'messenger');assert.equal(sent.headers['X-SYNK-Contract'],'1');
  f.advance(15*60_000-1000);
  assert.equal((await c.request(grantsPath,{body:createBody('66666666-6666-4666-8666-666666666666')})).status,200);
  f.advance(2000);
  assert.equal((await c.request('/api/synk-id/status')).data.reauthNeeded,true);
  const late=await c.request(grantsPath,{body:createBody('77777777-7777-4777-8777-777777777777')});assert.equal(late.status,409);assert.equal(late.data.code,'REAUTH_REQUIRED');
  // 자동 갱신(renew)은 이전 값을 이어 받기만 한다.
  assert.equal((await c.request('/api/synk-id/renew',{token:access.one,body:{}})).status,200);
  assert.equal((await c.request(grantsPath,{body:createBody('77777777-7777-4777-8777-777777777777')})).data.code,'REAUTH_REQUIRED');
  await interactive(c);
  assert.equal((await c.request(grantsPath,{body:createBody('88888888-8888-4888-8888-888888888888')})).status,200);
  // 다시 켜면 저장하지 않은 interactiveAt은 사라진다.
  await f.restart();
  assert.equal((await c.request('/api/me')).data.user.id,f.admin.id);
  assert.equal((await c.request('/api/synk-id/status')).data.reauthNeeded,true);
  assert.equal((await c.request(grantsPath,{body:createBody('99999999-9999-4999-8999-999999999999')})).data.code,'REAUTH_REQUIRED');
  // 데스크톱 교환으로 다시 로그인해도 대화형으로 치지 않는다.
  const other=f.client(),begin=await other.challenge('login',{expectedAccountId:ids.one});assert.equal((await other.exchange(begin.data.challenge)).status,200);
  assert.equal((await other.request(grantsPath,{body:createBody('99999999-9999-4999-8999-999999999999')})).data.code,'REAUTH_REQUIRED');
});

// Fable 설계 검토(.tmp/admin-grants-20261121/설계검토_재확인과_권한쓰기_Fable.md) 회사 서버 시험 20 · 21 · 22.
test('an administrator browser login claims the re-login with the new token, code and verifier, and interactiveAt is the central loginAt',async t=>{
  const {f,claims,control}=await grantsFixture(t,body=>body.op==='class.create'?created(body):page());
  const c=f.client();await c.link(f.admin);
  const start=await c.request('/api/synk-id/start',{body:{action:'login',expectedAccountId:ids.one,returnTo:'admin'}}),authorize=new URL(start.data.authorizationUrl);
  control.claim=()=>Response.json({ok:true,bound:true,loginAt:new Date(f.now-14*60_000).toISOString()});
  const back=await c.request('/api/synk-id/callback?state='+authorize.searchParams.get('state')+'&code=synthetic-code');
  assert.equal(back.status,302);assert.equal((await c.request('/api/me')).data.user.id,f.admin.id);
  assert.equal(claims.length,1);const [claim]=claims;
  assert.equal(claim.url,'https://identity.example.test/functions/v1/synk-account');
  assert.equal(claim.headers.Authorization,'Bearer '+access.one,'the claim uses the new Messenger token');
  assert.equal(claim.headers['X-SYNK-Product'],'messenger');assert.equal(claim.headers['X-SYNK-Contract'],'1');
  assert.deepEqual(Object.keys(claim.body).sort(),['action','code','codeVerifier']);
  assert.equal(claim.body.action,'admin-reauth-claim');assert.equal(claim.body.code,'synthetic-code');
  assert.equal(createHash('sha256').update(claim.body.codeVerifier).digest('base64url'),authorize.searchParams.get('code_challenge'),'the verifier matches the challenge of this login');
  assert.equal((await c.request(grantsPath,{body:createBody()})).status,200,'a login 14 minutes ago is still recent');
  f.advance(61_000);
  assert.equal((await c.request(grantsPath,{body:createBody('66666666-6666-4666-8666-666666666666')})).data.code,'REAUTH_REQUIRED','the window counts from the central loginAt, not from the callback');
  // 미래 쪽 1분 안의 loginAt은 지금으로 적는다.
  control.claim=()=>Response.json({ok:true,bound:true,loginAt:new Date(f.now+30_000).toISOString()});
  await interactive(c);
  assert.equal((await c.request(grantsPath,{body:createBody('77777777-7777-4777-8777-777777777777')})).status,200);
  // 관리자가 아닌 직원의 브라우저 로그인은 claim을 부르지 않는다(그 세션은 쓰기와 ④에 들어갈 수 없다).
  const member=f.client();await member.link(f.staff,access.two);
  const before=claims.length;await interactive(member,{expected:ids.two,code:'second-code'});
  assert.equal(claims.length,before);
});

test('without a bound claim the login still finishes, but writes and promotion need a SYNK ID re-login',async t=>{
  const {f,claims,control}=await grantsFixture(t,body=>body.op==='class.create'?created(body):page());
  await f.restart();assert.equal(f.app.store.get('settings','workspaceOwner').userId,f.admin.id);
  const cases=[
    ['unbound',()=>Response.json({ok:true,bound:false})],
    ['refused',()=>Response.json({ok:false,error:{code:'REAUTH_UNAVAILABLE'}},{status:503})],
    ['timeout',()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});}],
    ['not json',()=>new Response('not json',{status:200})],
    ['stale',()=>Response.json({ok:true,bound:true,loginAt:new Date(f.now-16*60_000).toISOString()})],
    ['future',()=>Response.json({ok:true,bound:true,loginAt:new Date(f.now+5*60_000).toISOString()})],
    ['no loginAt',()=>Response.json({ok:true,bound:true})],
  ];
  for(const [label,reply] of cases){
    control.claim=reply;const before=claims.length;
    const c=f.client();await c.link(f.admin);
    const me=await interactive(c);assert.equal(me.data.user.id,f.admin.id,label+': the login itself succeeds');
    assert.equal(claims.length,before+1,label);
    assert.equal((await c.request('/api/synk-id/status')).data.reauthNeeded,true,label);
    const write=await c.request(grantsPath,{body:createBody()});assert.equal(write.status,409,label);assert.equal(write.data.code,'REAUTH_REQUIRED',label);
    const promote=await c.request(`/api/members/${f.staff.id}/admin-role`,{body:{admin:true,expectedRole:'member',confirm:true}});
    assert.equal(promote.status,409,label);assert.equal(promote.data.code,'REAUTH_REQUIRED',label+': promotion trusts the same interactiveAt');
  }
  assert.equal(f.app.store.get('users',f.staff.id).role,'member');
});

test('desktop exchange, renew, automatic refresh and restart restore never call the claim',async t=>{
  const {f,claims,control,tokenCalls}=await grantsFixture(t);
  const c=f.client();await c.link(f.admin);
  assert.equal(claims.length,0,'exchange');
  assert.equal((await c.request('/api/synk-id/renew',{token:access.one,body:{}})).status,200);
  assert.equal(claims.length,0,'renew');
  control.refreshToken='synthetic-refresh-token';
  const browser=f.client();await browser.link(f.admin);await interactive(browser);
  assert.equal(claims.length,1,'only the browser login claims');
  f.advance(3600_000-30_000);
  assert.equal((await browser.request('/api/me')).data.user.id,f.admin.id);
  assert.ok(tokenCalls.includes('refresh_token'),'the browser session was refreshed');
  await f.restart();
  assert.equal((await browser.request('/api/me')).data.user.id,f.admin.id);assert.equal((await c.request('/api/me')).data.user.id,f.admin.id);
  f.advance(31_000);await browser.request('/api/me');
  assert.equal(claims.length,1,'refresh, restart restore and checks never claim');
  assert.equal((await browser.request('/api/synk-id/status')).data.reauthNeeded,true,'a restart forgets interactiveAt');
});

test('a write the central function applied while the session needed a fresh check is recorded and comes back as result unknown',async t=>{
  const {f,holdNext}=await grantsFixture(t,body=>applied(body,{classId,staffId:ids.two,role:'teacher',change:'assigned'}));
  await f.restart();
  const c=f.client();await c.link(f.admin);await interactive(c);
  const add={op:'teacher.add',classId,synkUserId:ids.two,requestId:'cccccccc-cccc-4ccc-8ccc-000000000001',confirm:true};
  // 중앙이 답하는 사이 회사 세션 확인이 오래돼(30초) 재확인이 필요해진다.
  const held=holdNext();const pending=c.request(grantsPath,{body:add});
  await held.started;f.advance(31_000);held.release();
  const unknown=await pending;
  assert.equal(unknown.status,503);assert.equal(unknown.data.code,'GRANTS_UNCONFIRMED');assert.equal(unknown.data.retryable,true);
  assert.equal(unknown.data.staffId,undefined,'the result is not handed to the session');
  let rows=f.app.store.all('audit').filter(row=>row.action==='synk-grant'&&row.requestId===add.requestId);
  assert.deepEqual(rows.map(row=>[row.result,row.outcome]),[['ok','applied']],'the company record says applied, not refused');
  assert.ok(f.app.store.all('ownerAlerts').some(row=>row.text.includes('선생님 넣기를 했어요')));
  assert.ok(!f.app.store.all('ownerAlerts').some(row=>row.text.includes('거절')));
  // 같은 requestId로 다시 확인하면 중앙 재전송 답을 받고, 기록은 하나다.
  const again=await c.request(grantsPath,{body:add});assert.equal(again.status,200);
  rows=f.app.store.all('audit').filter(row=>row.action==='synk-grant'&&row.requestId===add.requestId);
  assert.equal(rows.length,1);
});

test('the re-login button starts a real SYNK ID login through the portal and comes back through the same callback',async t=>{
  const {f}=await grantsFixture(t,body=>body.op==='class.create'?created(body):page());
  const c=f.client();await c.link(f.admin);
  const begin={action:'login',expectedAccountId:ids.one,returnTo:'admin',reauth:true},start=(client,body,options={})=>client.request('/api/synk-id/start',{body,...options});
  const password=f.client();await password.login(f.admin);
  assert.equal((await start(password,begin)).status,400,'a company password session cannot ask for a SYNK ID re-login');
  assert.equal((await start(f.client(),begin)).status,400,'nobody signed in cannot ask for a re-login');
  for(const bad of [{...begin,reauth:'yes'},{...begin,reauth:false},{...begin,expectedAccountId:ids.two},{action:'login',returnTo:'admin',reauth:true},{...begin,action:'link'}])
    assert.equal((await start(c,bad)).status,400,JSON.stringify(bad));
  assert.equal((await start(c,begin,{origin:'https://other.example.test'})).status,403);
  const plain=new URL((await start(c,{action:'login',expectedAccountId:ids.one,returnTo:'admin'})).data.authorizationUrl);
  assert.equal(plain.origin+plain.pathname,'https://identity.example.test/auth/v1/oauth/authorize','an ordinary login is not wrapped');
  const started=await start(c,begin);assert.equal(started.status,200);
  const portal=new URL(started.data.authorizationUrl);
  assert.equal(portal.origin+portal.pathname,'https://synk.im/id/');assert.deepEqual([...portal.searchParams.keys()],['reauth','next']);assert.equal(portal.searchParams.get('reauth'),'1');
  const next=new URL(portal.searchParams.get('next'));
  assert.equal(next.origin+next.pathname,'https://identity.example.test/auth/v1/oauth/authorize');
  assert.equal(next.searchParams.get('client_id'),'messenger-browser');assert.equal(next.searchParams.get('redirect_uri'),f.app.origin+'/api/synk-id/callback');
  // 포털이 실제 로그인을 받고 next로 보내면 같은 콜백으로 돌아오고, 그때부터 15분 동안 쓰기가 열린다.
  const back=await c.request('/api/synk-id/callback?state='+next.searchParams.get('state')+'&code=synthetic-code');
  assert.equal(back.status,302);assert.equal(back.headers.get('location'),'/?tab=admin&synkConnected=1');
  assert.equal((await c.request('/api/me')).status,200);
  assert.equal((await c.request('/api/synk-id/status')).data.reauthNeeded,false);
  const written=await c.request(grantsPath,{body:createBody()});assert.equal(written.status,200,JSON.stringify(written.data));
});

test('grant requests accept only each operation\'s keys, explicit confirmation and the server allowlist',async t=>{
  const {f,calls}=await grantsFixture(t,()=>Response.json({ok:true,rows:[]}));
  const c=f.client();await c.link(f.admin);await interactive(c);
  const synkUserId=ids.two,soon=days=>new Date(Date.now()+days*86400000).toISOString();
  for(const body of [{},{op:'unknown'},{op:'classes.list',page:1},{...listBody,active:true},{...listBody,q:'x'.repeat(81)},{...listBody,page:0},{...listBody,extra:1},{op:'class.people',classId:'not-a-uuid'},
    {...createBody(),classKey:'Upper Case'},{...createBody(),classKey:'-starts-with-dash'},{...createBody(),test:false},{...createBody(),displayName:' 앞 공백'},{...createBody(),requestId:'not-a-uuid'},
    {op:'learner.add',classId,synkUserId,requestId:requestA,confirm:true,learnerName:'x'},{op:'audit.list',days:31},
    {op:'toString'},{op:'constructor'},{op:'__proto__'},{op:'hasOwnProperty'},{op:'valueOf',requestId:requestA,confirm:true}])assert.equal((await c.request(grantsPath,{body})).data.code,'INVALID_GRANT_REQUEST',JSON.stringify(body));
  const unconfirmed=await c.request(grantsPath,{body:{...createBody(),confirm:'yes'}});assert.equal(unconfirmed.status,400);assert.equal(unconfirmed.data.code,'CONFIRM_REQUIRED');
  for(const capability of ['admin.member-directory','admin.workspace-grants','admin.workspace-staff']){
    const denied=await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'platform',capability,requestId:requestA,confirm:true}});
    assert.equal(denied.status,403);assert.equal(denied.data.code,'CAPABILITY_NOT_ALLOWED');
  }
  // 마을 체험은 학습 확인 때 자동으로 주므로 주기 · 거두기 모두 막고 까닭을 말한다(중앙 1e7685f7 GA4).
  for(const op of ['entitlement.grant','entitlement.revoke']){
    const trial=await c.request(grantsPath,{body:{op,synkUserId,product:'world',capability:'town.access.trial',...(op==='entitlement.grant'?{validUntil:soon(1)}:{}),requestId:requestA,confirm:true}});
    assert.equal(trial.status,403,op);assert.equal(trial.data.code,'CAPABILITY_NOT_ALLOWED',op);assert.equal(trial.data.error,'마을 체험은 학습 확인 때 자동으로 주어져 여기서 주거나 거둘 수 없어요.');
  }
  for(const capability of ['town.access.subscription','town.entry.topik1'])assert.equal((await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'world',capability,validUntil:soon(1),requestId:requestA,confirm:true}})).data.code,'CAPABILITY_NOT_ALLOWED');
  for(const validUntil of [null,soon(200),soon(-1),'2026-12-01',new Date(Date.now()+30_000).toISOString()])
    assert.equal((await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'world',capability:'practice.plus',...(validUntil===undefined?{}:{validUntil}),requestId:requestA,confirm:true}})).data.code,'INVALID_VALID_UNTIL',String(validUntil));
  assert.equal((await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'world',capability:'practice.plus',requestId:requestA,confirm:true}})).data.code,'INVALID_VALID_UNTIL','WORLD needs an expiry');
  // 달력에 없는 날과 시각은 Date가 다음 날로 넘기기 전에 막는다(중앙과 같다).
  const year=new Date().getUTCFullYear()+1;
  for(const validUntil of [`${year}-02-30T14:59:59.000Z`,`${year}-04-31T14:59:59Z`,`${year}-01-10T24:00:00Z`,`${year}-01-10T12:00:60Z`,`${year}-13-01T00:00:00Z`,`${year}-01-10T12:00:00+15:00`]){
    const refused=await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'platform',capability:'library.teacher',validUntil,requestId:requestA,confirm:true}});
    assert.equal(refused.data.code,'INVALID_VALID_UNTIL',validUntil);assert.match(refused.data.error,/달력에 있는 날짜/);
  }
  assert.equal((await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'platform',capability:'library.teacher',validUntil:soon(-1),requestId:requestA,confirm:true}})).data.code,'INVALID_VALID_UNTIL','a library expiry must lie ahead');
  assert.equal(calls.length,0,'rejected input never reaches the central function');
  const grant={op:'entitlement.grant',synkUserId:synkUserId.toUpperCase(),product:'world',capability:'practice.plus',validUntil:soon(30),requestId:requestA.toUpperCase(),confirm:true};
  await c.request(grantsPath,{body:grant});
  assert.deepEqual(calls[0].body,{action:'admin-workspace-grants',op:'entitlement.grant',synkUserId,product:'world',capability:'practice.plus',validUntil:grant.validUntil,requestId:requestA,confirm:true});
  await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'platform',capability:'library.teacher',validUntil:soon(400),requestId:requestA,confirm:true}});
  assert.equal(calls[1].body.capability,'library.teacher','a library expiry may lie beyond six months');
  await c.request(grantsPath,{body:{op:'entitlement.grant',synkUserId,product:'platform',capability:'library.teacher',requestId:requestA,confirm:true}});
  assert.equal(Object.hasOwn(calls[2].body,'validUntil'),false,'an omitted expiry stays omitted');
  await c.request(grantsPath,{body:{op:'audit.list'}});assert.deepEqual(calls[3].body,{action:'admin-workspace-grants',op:'audit.list'},'audit days default centrally to 7');
});

test('central answers are shape-checked, unknown fields dropped and error codes passed to the screen',async t=>{
  let reply;
  const {f,calls,holdNext}=await grantsFixture(t,(body,init)=>reply(body,init));
  const c=f.client();await c.link(f.admin);await interactive(c);
  const post=body=>c.request(grantsPath,{body});
  reply=()=>page([{...classRow,secret:'omit'}]);
  const listed=await post(listBody);assert.equal(listed.status,200);assert.deepEqual(listed.data,{ok:true,op:'classes.list',total:1,page:1,pageSize:25,rows:[classRow]});
  for(const bad of [{total:2,rows:[classRow]},{page:2,rows:[classRow]},{rows:[{...classRow,id:'x'}]},{rows:[{...classRow,teachers:-1}]},{op:'class.people'},{ok:false}]){
    reply=()=>Response.json({ok:true,op:'classes.list',total:1,page:1,pageSize:25,rows:[classRow],...bad});const response=await post(listBody);
    assert.equal(response.status,503,JSON.stringify(bad));assert.equal(response.data.code,'GRANTS_UNAVAILABLE');assert.equal(response.data.retryable,true);
  }
  const teacher={staffId:ids.two,synkUserId:ids.two,name:'합성 교사',role:'teacher',active:true,assignedAt:'2026-11-21T01:00:00.000Z',email:'omit@example.test'};
  const learner={learnerId:requestA,studentCode:'SYNK-1043',active:true,linked:false,synkUserId:null,accountStatus:null,name:null,enrolledAt:null,test:true,transcript:'omit'};
  reply=()=>Response.json({ok:true,op:'class.people',class:{...classView,createdAt:'2026-11-21T10:00:00+00:00'},teachers:[teacher],learners:[learner]});
  const people=await post({op:'class.people',classId});assert.equal(people.status,200);
  assert.equal(JSON.stringify(people.data).includes('omit'),false);assert.equal(people.data.learners[0].studentCode,'SYNK-1043');assert.equal(people.data.learners[0].linked,false);
  reply=()=>Response.json({ok:true,op:'audit.list',days:7,rows:[{id:'17',at:'2026-11-21T01:00:00.000Z',op:'learner.add',outcome:'rejected',code:'CLASS_NOT_FOUND',actorSynkUserId:ids.one,targetSynkUserId:ids.two,classId,learnerId:null,staffId:null,entitlementRef:null}]});
  assert.equal((await post({op:'audit.list',days:7})).data.rows[0].code,'CLASS_NOT_FOUND');
  reply=()=>Response.json({ok:true,op:'entitlements.list',synkUserId:ids.two,rows:[{product:'world',capability:'practice.plus',source:'billing',validFrom:null,validUntil:null,revokedAt:null,active:true,editable:false}]});
  const listedEnts=(await post({op:'entitlements.list',synkUserId:ids.two})).data;
  assert.equal(listedEnts.choices.length,8);assert.ok(!listedEnts.choices.some(row=>row.capability==='town.access.trial'),'the trial is never offered');
  assert.deepEqual(listedEnts.viewOnly.map(row=>row.capability),['town.access.trial']);
  // 중앙이 이 도구 밖 권한을 CAPABILITY_NOT_ALLOWED로 거절해도 같은 까닭을 말한다.
  reply=()=>Response.json({ok:false,error:{code:'CAPABILITY_NOT_ALLOWED'}},{status:403});
  const centralRefused=await post({op:'entitlement.revoke',synkUserId:ids.two,product:'platform',capability:'library.teacher',requestId:'55555555-5555-4555-8555-0000000000d1',confirm:true});
  assert.equal(centralRefused.status,403);assert.equal(centralRefused.data.code,'CAPABILITY_NOT_ALLOWED');assert.equal(centralRefused.data.error,'여기서 주거나 거둘 수 없는 권한이에요.');
  const add={op:'learner.add',classId,synkUserId:ids.two,requestId:requestA,confirm:true};
  reply=body=>applied(body,{classId,learnerId:requestA,studentCode:'SYNK-1044',change:'moved',fromClassId:ids.one,sharing:{enabled:false,revision:'3'}});
  const moved=await post({...add,move:true});assert.equal(moved.status,200);assert.equal(moved.data.change,'moved');assert.equal(moved.data.fromClassId,ids.one);
  reply=body=>Response.json({ok:true,op:body.op,requestId:body.requestId,outcome:'duplicate',classId,learnerId:requestA,studentCode:'SYNK-1044',change:'none',replayed:true});
  const replay=await post(add);assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);
  // 반이 비어 있던 명부 줄을 같은 번호로 넣으면 change는 assigned다(82eecb2f).
  reply=body=>applied(body,{classId,learnerId:requestA,studentCode:'SYNK-1043',change:'assigned'});
  const assigned=await post({...add,requestId:'55555555-5555-4555-8555-0000000000a1'});assert.equal(assigned.status,200);assert.equal(assigned.data.change,'assigned');
  for(const bad of [{requestId:ids.one},{outcome:'created'},{change:'invented'},{op:'learner.remove'}]){
    reply=body=>applied(body,{classId,learnerId:requestA,studentCode:null,change:'created',...bad});assert.equal((await post(add)).status,503,JSON.stringify(bad));
  }
  const cases=[
    [401,{code:'REAUTH_REQUIRED'},409,'REAUTH_REQUIRED'],
    [401,{code:'AUTH_REQUIRED'},403,'GRANTS_FORBIDDEN'],
    [403,{code:'GRANTS_FORBIDDEN'},403,'GRANTS_FORBIDDEN'],
    [403,{code:'PRODUCT_FORBIDDEN'},403,'GRANTS_FORBIDDEN'],
    [409,{code:'ACCOUNT_ALREADY_ENROLLED',classId,className:'옛 오전반',email:'omit'},409,'ACCOUNT_ALREADY_ENROLLED'],
    [409,{code:'REQUEST_CONFLICT'},409,'REQUEST_CONFLICT'],
    [409,{code:'CLASS_INACTIVE'},409,'CLASS_INACTIVE'],
    [409,{code:'TARGET_CHANGED'},409,'TARGET_CHANGED'],
    [409,{code:'STAFF_INACTIVE'},409,'STAFF_INACTIVE'],
    [429,{code:'DAILY_LIMIT',limit:5},429,'DAILY_LIMIT'],
    [404,{code:'LEARNER_NOT_FOUND'},404,'LEARNER_NOT_FOUND'],
    [400,{code:'INVALID_GRANT_REQUEST'},400,'INVALID_GRANT_REQUEST'],
    [426,{code:'CONTRACT_UNSUPPORTED'},503,'CONTRACT_UNSUPPORTED'],
    [409,{code:'lowercase bad'},503,'GRANTS_UNAVAILABLE'],
    [500,{code:'INTERNAL'},503,'GRANTS_UNAVAILABLE'],
    [503,{code:'GRANTS_UNAVAILABLE'},503,'GRANTS_UNAVAILABLE'],
  ];
  for(const [status,error,expected,code] of cases){
    reply=()=>Response.json({ok:false,error},{status});const response=await post(add);
    assert.equal(response.status,expected,code);assert.equal(response.data.code,code);
    if(code==='ACCOUNT_ALREADY_ENROLLED')assert.deepEqual(response.data.details,{classId,className:'옛 오전반'});
    if(code==='DAILY_LIMIT'){assert.deepEqual(response.data.details,{limit:5});assert.match(response.data.error,/5번까지/);}
    if(code==='REAUTH_REQUIRED')assert.deepEqual(response.data.details,{source:'central'});
  }
  reply=()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});};
  const timedOut=await post(add);assert.equal(timedOut.status,503);assert.equal(timedOut.data.retryable,true);
  reply=()=>new Response('not json',{status:200});assert.equal((await post(add)).status,503);
  const rejected=f.app.store.all('audit').filter(row=>row.action==='synk-grant'&&row.result!=='ok');
  assert.ok(rejected.length>=10);assert.ok(rejected.every(row=>!JSON.stringify(row).includes('@')));
  assert.equal(new Set(rejected.map(row=>row.result)).size,rejected.length,'one request number keeps one row per outcome');
  assert.ok(!rejected.some(row=>row.result==='REAUTH_REQUIRED'),'a central re-login request is not an administrator action');
  // 반 재전송은 지금 이름을 싣고(없어진 반이면 null), 원장 줄 빼기는 닫지 않고 unassigned다.
  const setActive=requestId=>({op:'class.setActive',classId,active:true,requestId,confirm:true});
  reply=body=>Response.json({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',class:{...classView,displayName:'지금 이름'},replayed:true});
  const renamed=await post(setActive('55555555-5555-4555-8555-0000000000b1'));assert.equal(renamed.status,200);assert.equal(renamed.data.class.displayName,'지금 이름');assert.equal(renamed.data.replayed,true);
  reply=body=>Response.json({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',class:{...classView,displayName:null},replayed:true});
  assert.equal((await post(setActive('55555555-5555-4555-8555-0000000000b2'))).data.class.displayName,null);
  reply=body=>applied(body,{classId,staffId:ids.two,change:'unassigned',invitesRemoved:0});
  assert.equal((await post({op:'teacher.remove',classId,staffId:ids.two,requestId:'55555555-5555-4555-8555-0000000000b3',confirm:true})).data.change,'unassigned');
  // ENTITLEMENT_NOT_EDITABLE은 주기와 거두기 모두에서 나고, 화면 문장은 op마다 다르다. ENTITLEMENT_CONFLICT는 반영하지 못한 경우다.
  const ent=(op,requestId)=>({op,synkUserId:ids.two,product:'platform',capability:'library.teacher',requestId,confirm:true});
  reply=()=>Response.json({ok:false,error:{code:'ENTITLEMENT_NOT_EDITABLE'}},{status:409});
  const grantRefused=await post(ent('entitlement.grant','55555555-5555-4555-8555-0000000000c1'));
  assert.equal(grantRefused.status,409);assert.equal(grantRefused.data.code,'ENTITLEMENT_NOT_EDITABLE');assert.match(grantRefused.data.error,/여기서 줄 수 없어요/);
  const revokeRefused=await post(ent('entitlement.revoke','55555555-5555-4555-8555-0000000000c2'));
  assert.equal(revokeRefused.data.code,'ENTITLEMENT_NOT_EDITABLE');assert.match(revokeRefused.data.error,/여기서 거둘 수 없어요/);
  reply=()=>Response.json({ok:false,error:{code:'ENTITLEMENT_CONFLICT'}},{status:409});
  assert.match((await post(ent('entitlement.grant','55555555-5555-4555-8555-0000000000c3'))).data.error,/반영하지 못했어요/);
  // 응답 사이에 회사 역할이 바뀌면 결과를 넘기지 않는다.
  const held=holdNext();
  reply=()=>page([classRow]);
  const pending=post(listBody);
  await held.started;assert.equal(calls.at(-1).body.op,'classes.list');
  f.app.store.put('users',f.admin.id,{...f.app.store.get('users',f.admin.id),role:'member'});held.release();
  const changed=await pending;assert.equal(changed.status,403);assert.equal(changed.data.rows,undefined);
});

test('company daily limits, audit rows, replays and owner alerts follow each write',async t=>{
  const seen=new Set();
  const {f,calls}=await grantsFixture(t,body=>{const replayed=seen.has(body.requestId);seen.add(body.requestId);return Response.json({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',classId,staffId:ids.two,role:'teacher',change:'assigned',...(replayed?{replayed:true}:{})});});
  await f.restart();
  assert.equal(f.app.store.get('settings','workspaceOwner').userId,f.admin.id,'boot records the only active administrator as owner');
  const c=f.client();await c.link(f.admin);await interactive(c);
  const teacher=index=>({op:'teacher.add',classId,synkUserId:ids.two,requestId:`aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12,'0')}`,confirm:true});
  for(let i=1;i<=5;i++)assert.equal((await c.request(grantsPath,{body:teacher(i)})).status,200);
  const limited=await c.request(grantsPath,{body:teacher(6)});assert.equal(limited.status,429);assert.equal(limited.data.code,'DAILY_LIMIT');
  assert.equal(calls.length,5,'the company limit stops before the central call');
  const replay=await c.request(grantsPath,{body:teacher(3)});assert.equal(replay.status,200,'the same request may be resent');assert.equal(replay.data.replayed,true);
  const rows=f.app.store.all('audit').filter(row=>row.action==='synk-grant');
  assert.equal(rows.filter(row=>row.result==='ok').length,5,'a replay is not written twice');
  assert.ok(rows.filter(row=>row.result==='ok').every(row=>row.outcome==='applied'&&row.change==='assigned'));
  assert.equal(rows.filter(row=>row.result==='DAILY_LIMIT').length,1);
  assert.deepEqual(Object.keys(rows[0].targets).sort(),['classId','entitlement','learnerId','staffId','synkUserId']);
  const alerts=f.app.store.all('ownerAlerts');
  assert.equal(alerts.length,6);assert.ok(alerts.every(row=>row.ownerId===f.admin.id));
  assert.ok(alerts.some(row=>row.text.includes('선생님 넣기를 했어요'))&&alerts.some(row=>row.text.includes('까닭: 오늘 할 수 있는 횟수를 다 썼어요.')));
  assert.ok(alerts.every(row=>!/DAILY_LIMIT|[A-Z]{4,}_[A-Z]/.test(row.text)),'owner alerts never show internal codes');
  const notifications=(await c.request('/messenger/api/notifications')).data;
  const mine=(notifications?.items||[]).filter(row=>row.kind==='admin_grant');
  assert.equal(mine.length,6);assert.ok(mine.every(row=>row.href==='/?tab=admin'&&!row.readAt));
  assert.equal((await c.request('/messenger/api/notifications/'+encodeURIComponent(mine[0].id)+'/read',{body:{}})).status,200);
  assert.ok(f.app.store.get('ownerAlerts',mine[0].id.slice('owner-alert:'.length)).readAt);
  const staff=f.client();await staff.login(f.staff);
  assert.equal(((await staff.request('/messenger/api/notifications')).data?.items||[]).filter(row=>row.kind==='admin_grant').length,0,'only the owner sees administrator alerts');
  // 이미 되어 있던 일(duplicate)은 상한에 세지 않는다.
  for(const row of f.app.store.all('audit').filter(item=>item.action==='synk-grant'&&item.result==='ok').slice(0,1))f.app.store.put('audit',row.id,{...row,outcome:'duplicate'});
  assert.equal((await c.request(grantsPath,{body:teacher(8)})).status,200,'a duplicate does not use the daily limit');
  // 회사 상한은 회사 시계로 최근 24시간을 센다. 기록 시각을 25시간 앞으로 옮기면 다시 열린다.
  for(const row of f.app.store.all('audit').filter(item=>item.action==='synk-grant'))f.app.store.put('audit',row.id,{...row,at:new Date(Date.now()-25*3600_000).toISOString()});
  assert.equal((await c.request(grantsPath,{body:teacher(7)})).status,200,'the limit counts the last 24 hours');
});

test('a write whose answer was lost is recorded once it is confirmed with the same request number, and owner alerts read plainly',async t=>{
  let mode='lost';const applied=new Set();
  const {f}=await grantsFixture(t,body=>{
    const replayed=applied.has(body.requestId);applied.add(body.requestId);
    if(mode==='lost')throw Object.assign(new Error('timeout'),{name:'TimeoutError'});
    if(mode==='refuse')return Response.json({ok:false,error:{code:'ENTITLEMENT_NOT_EDITABLE'}},{status:409});
    if(body.op==='entitlement.grant')return Response.json({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',synkUserId:body.synkUserId,entitlement:{product:body.product,capability:body.capability,validUntil:body.validUntil,revokedAt:null,active:true},change:'granted',...(replayed?{replayed:true}:{})});
    return Response.json({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',classId,staffId:ids.two,role:'teacher',change:'assigned',...(replayed?{replayed:true}:{})});
  });
  await f.restart();
  const c=f.client();await c.link(f.admin);await interactive(c);
  const add={op:'teacher.add',classId,synkUserId:ids.two,requestId:'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',confirm:true};
  const lost=await c.request(grantsPath,{body:add});assert.equal(lost.status,503);assert.equal(lost.data.code,'GRANTS_UNAVAILABLE');
  assert.equal((await c.request(grantsPath,{body:add})).status,503,'a second lost answer adds nothing new');
  mode='ok';
  const confirmed=await c.request(grantsPath,{body:add});assert.equal(confirmed.status,200);assert.equal(confirmed.data.replayed,true);
  assert.equal((await c.request(grantsPath,{body:add})).status,200);
  const rows=f.app.store.all('audit').filter(row=>row.action==='synk-grant'&&row.requestId===add.requestId);
  assert.deepEqual(rows.map(row=>row.result).sort(),['GRANTS_UNAVAILABLE','ok'],'the confirmed write is recorded once, after the lost answer');
  assert.equal(rows.find(row=>row.result==='ok').outcome,'applied');
  let alerts=f.app.store.all('ownerAlerts');
  assert.equal(alerts.length,2);
  assert.ok(alerts.some(row=>row.text.includes('선생님 넣기 요청은 결과를 확인하지 못했어요')&&row.text.includes('이미 반영됐을 수도 있어요')));
  assert.ok(alerts.some(row=>row.text.includes('선생님 넣기를 했어요')));
  assert.ok(alerts.every(row=>!row.text.includes('거절됐어요')&&!row.text.includes('GRANTS_UNAVAILABLE')));
  // 이름의 제어 · 방향 글자는 빼고 긴 이름은 줄인다. 이용 권한은 화면의 이름으로 적는다.
  f.app.store.put('users',f.admin.id,{...f.app.store.get('users',f.admin.id),name:'관리자'+String.fromCharCode(0x202e)+'<b>'+'가'.repeat(60)});
  const grant={op:'entitlement.grant',synkUserId:ids.two,product:'world',capability:'practice.plus',validUntil:new Date(Date.now()+30*86400000).toISOString(),requestId:'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',confirm:true};
  assert.equal((await c.request(grantsPath,{body:grant})).status,200);
  alerts=f.app.store.all('ownerAlerts');const text=alerts.find(row=>row.text.includes('이용 권한 주기')).text;
  assert.ok(text.includes('(WORLD 연습 더하기)'),text);assert.ok(!text.includes('world.practice.plus'));
  assert.ok(!text.includes(String.fromCharCode(0x202e)));
  assert.equal(text.split(' 님')[0],'관리자<b>'+'가'.repeat(33)+'…','a long name is cut to 40 characters');
  // 거절 까닭은 op에 맞는 첫 문장이다(주기의 ENTITLEMENT_NOT_EDITABLE).
  mode='refuse';
  assert.equal((await c.request(grantsPath,{body:{...grant,requestId:'bbbbbbbb-bbbb-4bbb-8bbb-000000000003'}})).status,409);
  assert.ok(f.app.store.all('ownerAlerts').some(row=>row.text.includes('이용 권한 주기 요청이 거절됐어요 (WORLD 연습 더하기). 까닭: 같은 권한이 결제나 운영에서 준 줄로 있어 여기서 줄 수 없어요.')));
});

test('a promoted administrator\'s SYNK ID is refused by the central grants and member directory',async t=>{
  const {f}=await grantsFixture(t,(body,init)=>init.headers.Authorization==='Bearer '+access.two?Response.json({ok:false,error:{code:body.action==='admin-member-directory'?'DIRECTORY_FORBIDDEN':'GRANTS_FORBIDDEN'}},{status:403}):page());
  const second=f.app.store.createUser({name:'올린 관리자',email:'second-admin@example.test',password,role:'admin'});
  const c=f.client();await c.link(second,access.two);await interactive(c,{expected:ids.two,code:'second-code'});
  const grants=await c.request(grantsPath,{body:listBody});assert.equal(grants.status,403);assert.equal(grants.data.code,'GRANTS_FORBIDDEN');
  assert.equal((await c.request('/api/admin/member-directory/synk',{body:{q:'',page:1,status:'all'}})).status,403);
});
