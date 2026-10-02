import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { synkIdentityConfig, createSynkIdentity } from './synk-identity.mjs';

const password='fixture-company-password-2026';
const ids={one:'11111111-1111-4111-8111-111111111111',two:'22222222-2222-4222-8222-222222222222'};
const access={one:'synthetic-access-one-not-for-operation',two:'synthetic-access-two-not-for-operation'};
async function fixture(t,{enabled=true,browser=false,verify,fetcher}={}){
  const dir=await mkdtemp(join(tmpdir(),'synk-id-company-'));let stamp=Date.now(),rejected=false;
  const verifier=verify===false?null:verify|| (async value=>{if(rejected)throw Object.assign(Error('revoked'),{status:401});return {synkUserId:value===access.one?ids.one:ids.two,expiresAt:stamp+3600_000};});
  const options={dataDir:dir,port:0,allowTestHost:true,schedule:false,synkIdentityConfig:enabled?{accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'fixture-public',issuer:browser?'https://identity.example.test':null,clientId:browser?'messenger-browser':null}:null,synkIdentityVerifier:verifier,synkIdentityFetch:fetcher,synkIdentityNow:()=>stamp,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  let app=createCompanyApp(options),address=await app.start();
  t.after(async()=>{await app.stop();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});});
  const staff=app.store.createUser({name:'회사 크루',email:'same@example.test',password,role:'member'});
  const admin=app.store.createUser({name:'회사 관리자',email:'admin@example.test',password,role:'admin'});
  const fx={get app(){return app;},get base(){return `http://127.0.0.1:${address.port}`;},staff,admin,advance:ms=>stamp+=ms,revoke:()=>{rejected=true;},async restart(){await app.stop();app=createCompanyApp(options);address=await app.start();},client(){
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
test('deactivation during central verification blocks linking and session issuance',async t=>{
  let release,started;const waiting=new Promise(r=>release=r),began=new Promise(r=>started=r);
  const f=await fixture(t,{verify:async()=>{started();await waiting;return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();await c.login();const begin=await c.challenge('link',{currentPassword:password,confirm:true}),pending=c.exchange(begin.data.challenge);await began;f.app.store.put('users',f.staff.id,{...f.staff,active:false});release();assert.equal((await pending).status,409);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM synk_identity_links').get().n,0);
});
test('central revocation and server restart invalidate SYNK sessions while company password sessions remain usable',async t=>{
  const f=await fixture(t),c=f.client();await c.link();f.revoke();f.advance(31_000);assert.equal((await c.request('/api/me')).data.user,null);assert.equal((await c.request('/messenger/api/bootstrap')).status,401);
  const local=f.client();await local.login();await f.restart();assert.equal((await local.request('/api/me')).data.user.id,f.staff.id);
});
test('SYNK-derived session does not survive restart without its in-memory token',async t=>{
  const f=await fixture(t),c=f.client();await c.link();await f.restart();assert.equal((await c.request('/api/me')).data.user,null);
});
test('temporary identity outage denies access without deleting the company session and recovers after revalidation',async t=>{
  let unavailable=false;const f=await fixture(t,{verify:async()=>{if(unavailable)throw Object.assign(Error('busy'),{status:503});return {synkUserId:ids.one,expiresAt:Date.now()+3600_000};}}),c=f.client();await c.link();const before=f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE purpose=\'session\'').get().n;
  unavailable=true;f.advance(31_000);const denied=await c.request('/api/me');assert.equal(denied.status,503);assert.equal(denied.data.code,'SYNK_IDENTITY_UNAVAILABLE');assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE purpose=\'session\'').get().n,before);assert.equal((await c.request('/messenger/api/bootstrap')).status,503);
  unavailable=false;assert.equal((await c.request('/api/me')).data.user.id,f.staff.id);assert.equal((await c.request('/messenger/api/bootstrap')).status,200);
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
test('browser rotates refresh in memory, survives verification outage, and keeps omitted refresh values',async t=>{
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
