import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {teachingServiceConfig,createTeachingService} from './teaching-service.mjs';

const userId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222';
const issuer='https://identity.example.test',clientId='teacher-browser';
const config={issuer,clientId,accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_fixture_2026'};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function fixture(t,{enabled=true}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-teaching-service-'));let stamp=Date.now(),identityStatus=200,hold=null,holdAt=null,tokenIndex=0;
  const calls=[],tokenValues=[];
  const token=(overrides={})=>{const payload={iss:issuer+'/auth/v1',client_id:clientId,exp:Math.floor((stamp+3600000)/1000),...overrides};return 'synthetic.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.signature-'+(++tokenIndex);};
  async function fetcher(target,options={}){
    const url=new URL(target),headers=options.headers||{};calls.push({url:url.href,headers,method:options.method||'GET',body:options.body});
    if(url.pathname==='/auth/v1/oauth/token'){
      if(holdAt==='token'){const wait=hold;holdAt=null;await wait.promise;}
      const access=token();tokenValues.push(access);return response({access_token:access,refresh_token:'synthetic-refresh-credential-'+tokenIndex,token_type:'Bearer'});
    }
    if(url.pathname==='/auth/v1/logout')return response({ok:true});
    assert.equal(headers['X-SYNK-Product'],'world');
    if(url.pathname==='/functions/v1/synk-account'){
      if(options.method==='POST')return response({ok:true});
      if(holdAt==='account'){const wait=hold;holdAt=null;await wait.promise;}
      if(identityStatus!==200)return response({ok:false},identityStatus);
      return response({ok:true,account:{status:'active',synk_user_id:userId},sessions:[{id:sessionId,current:true,revoked:false,product:'world'}]});
    }
    if(url.pathname==='/functions/v1/synk-classroom/api/classes'){if(holdAt==='classes'){const wait=hold;holdAt=null;await wait.promise;}return response({ok:true,mode:'account-linked',classes:[{id:'teacher-class',name:'담당 수업',role:'teacher'},{id:'learner-class',name:'학생 수업',role:'learner'}]});}
    if(url.pathname==='/functions/v1/synk-classroom/api/workspace')return response({ok:true,mode:'account-linked',classes:[{id:'teacher-class',name:'담당 수업',learners:[]}],content:[],assignments:[],observations:[]});
    if(url.pathname.startsWith('/functions/v1/synk-classroom/api/'))return response({ok:true,record:{...JSON.parse(options.body||'{}')}});
    throw Error('Unexpected fixture URL: '+url.href);
  }
  const options={dataDir:directory,port:0,allowTestHost:true,schedule:false,teachingConfig:enabled?config:null,teachingFetch:fetcher,teachingNow:()=>stamp,synkIdentityConfig:null,customerIdentityConfig:null,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  let app=createCompanyApp(options),address=await app.start();
  t.after(async()=>{await app.stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));await rm(directory,{recursive:true,force:true});});
  const f={get app(){return app;},get base(){return 'http://127.0.0.1:'+address.port;},calls,tokenValues,advance:ms=>stamp+=ms,identity:status=>identityStatus=status,hold(where){hold=deferred();holdAt=where;return hold;},async restart(){await app.stop();app=createCompanyApp(options);address=await app.start();},client(){
    const jar=new Map();return {jar,csrf:'',async request(path,{body,csrf=this.csrf,origin=app.origin,method=body===undefined?'GET':'POST'}={}){
      const headers={Cookie:[...jar].map(([name,value])=>name+'='+value).join('; ')};if(method==='POST'){headers.Origin=origin;headers['Content-Type']='application/json';headers['X-CSRF-Token']=csrf;}
      const res=await fetch(f.base+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
      for(const c of res.headers.getSetCookie()){const [name,value]=c.split(';')[0].split('=');if(value)jar.set(name,value);else jar.delete(name);}
      const data=await res.json().catch(()=>null);if(data?.csrfToken)this.csrf=data.csrfToken;return {status:res.status,data,headers:res.headers};
    },async begin(){await this.request('/api/teaching/status');const result=await this.request('/api/teaching/start',{body:{}});assert.equal(result.status,200);const url=new URL(result.data.authorizationUrl);return '/api/teaching/callback?state='+url.searchParams.get('state')+'&code=synthetic-code';},async login(){const callback=await this.begin();const result=await this.request(callback);assert.equal(result.status,302);assert.match(result.headers.get('location'),/teachingConnected=1/);return this.request('/api/teaching/status');}};
  }};return f;
}

test('teacher client is optional and may never reuse a messenger or customer OAuth client',()=>{
  assert.equal(teachingServiceConfig({SYNK_ID_ACCOUNT_API_URL:'existing'}),null);
  assert.throws(()=>teachingServiceConfig({SYNK_ID_TEACHER_CLIENT_ID:'same',SYNK_ID_MESSENGER_CLIENT_ID:'same'}),/별도로/);
  assert.throws(()=>teachingServiceConfig({SYNK_ID_TEACHER_CLIENT_ID:'teacher'}),/공개 서버/);
});
test('unconfigured teaching status and fixed browser assets preserve company login boundaries',async t=>{
  const f=await fixture(t,{enabled:false}),c=f.client(),status=await c.request('/api/teaching/status');assert.equal(status.data.configured,false);assert.equal(status.data.status,'unconfigured');assert.equal((await c.request('/api/teaching/start',{body:{}})).status,503);
  assert.equal((await c.request('/api/state')).status,401);assert.equal(f.app.store.all('users').length,0);
  for(const path of ['/teacher-world/','/teacher-world/app.mjs','/teacher-world/assets/slab-cream-long.webp','/assets/wide-coral.webp'])assert.equal((await c.request(path)).status,200);
  const page=await c.request('/teacher-world/');assert.equal(page.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'self'/);
  const root=await c.request('/');assert.equal(root.headers.get('x-frame-options'),'DENY');assert.match(root.headers.get('content-security-policy'),/connect-src 'self'/);
  for(const path of ['/teacher-world/model.mjs','/teacher-world/assets/sources.json','/teaching-service.mjs','/teacher-world/../data/company.sqlite'])assert.equal((await c.request(path)).status,404);
});
test('PKCE, origin, CSRF, browser proof and one-use state protect a teacher-only login',async t=>{
  const f=await fixture(t),c=f.client();await c.request('/api/teaching/status');
  assert.equal((await c.request('/api/teaching/start',{body:{},csrf:'wrong'})).status,403);assert.equal((await c.request('/api/teaching/start',{body:{},origin:'https://other.example.test'})).status,403);assert.equal(f.calls.length,0);
  const callback=await c.begin(),other=f.client();assert.match((await other.request(callback)).headers.get('location'),/TEACHING_FLOW/);
  const savedCalls=f.calls.length;assert.match((await c.request(callback+'&extra=bad')).headers.get('location'),/TEACHING_CALLBACK/);assert.equal(f.calls.length,savedCalls);
  const logged=await c.request(callback);assert.match(logged.headers.get('location'),/teachingConnected=1/);assert.match((await c.request(callback)).headers.get('location'),/TEACHING_FLOW/);
  const status=await c.request('/api/teaching/status');assert.equal(status.data.signedIn,true);assert.equal(status.data.account.synk_user_id,userId);assert.ok(Number.isSafeInteger(status.data.sessionGeneration));
  assert.equal(c.jar.has('synk_company_session'),false);assert.equal(f.app.store.all('users').length,0);assert.equal((await c.request('/api/state')).status,401);assert.equal((await c.request('/messenger/api/bootstrap')).status,401);
  const tokenCall=f.calls.find(row=>row.url.endsWith('/auth/v1/oauth/token')),params=new URLSearchParams(tokenCall.body);assert.equal(params.get('grant_type'),'authorization_code');assert.equal(params.get('client_id'),clientId);assert.match(params.get('code_verifier'),/^[A-Za-z0-9_-]{43}$/);
  assert.ok(!JSON.stringify(status.data).includes(f.tokenValues[0]));assert.ok(!JSON.stringify(f.app.store.db.prepare('SELECT * FROM teaching_identity_sessions').all()).includes(f.tokenValues[0]));
  assert.ok(logged.headers.getSetCookie().filter(row=>row.startsWith('synk_teaching_session=')).every(row=>row.includes('HttpOnly')&&row.includes('Path=/api/teaching')));
});
test('teacher proxy only exposes assigned classes and rejects learner scopes and arbitrary APIs',async t=>{
  const f=await fixture(t),c=f.client();await c.login();const send=input=>c.request('/api/teaching/request',{body:input});
  const classes=await send({operation:'classes'});assert.deepEqual(classes.data.classes.map(row=>row.id),['teacher-class']);
  for(const operation of ['memoryGet','learningGet','account','student','submit','toString'])assert.equal((await send({operation})).status,403);
  assert.equal((await send({operation:'workspace',classId:'learner-class'})).status,403);
  assert.equal((await send({operation:'workspace',classId:'teacher-class',query:{}})).status,400);
  assert.equal((await send({operation:'assignments',classId:'teacher-class',body:{classId:'other'}})).status,400);
  assert.equal((await send({operation:'workspace',classId:'teacher-class'})).data.mode,'account-linked');
  assert.equal((await send({operation:'teacherOverview'})).status,200);assert.equal((await send({operation:'teacherOverview',classId:'teacher-class'})).status,400);
  assert.equal((await send({operation:'care',classId:'teacher-class'})).status,200);assert.equal((await send({operation:'careSave',classId:'teacher-class',body:{title:'학생 케어'}})).status,200);
  const result=await send({operation:'assignments',classId:'teacher-class',body:{title:'교사 과제'}});assert.equal(result.data.record.title,'교사 과제');
  assert.equal((await c.request('/api/teaching/request',{body:{operation:'classes'},csrf:'bad'})).status,403);
});
test('staff and teacher sessions coexist and logging out of either leaves the other authorization intact',async t=>{
  const f=await fixture(t),c=f.client(),password='teacher-staff-fixture-password';
  const staff=f.app.store.createUser({name:'회사 직원',email:'staff@example.test',password,role:'member'});
  const company=await c.request('/api/login',{body:{email:staff.email,password}});assert.equal(company.status,200);const companyCookie=c.jar.get('synk_company_session'),companyCsrf=company.data.csrfToken;
  await c.login();assert.equal(c.jar.get('synk_company_session'),companyCookie);assert.equal((await c.request('/api/state')).data.user.id,staff.id);
  assert.equal(f.app.store.all('users').length,1);assert.equal(f.app.store.db.prepare('SELECT count(*) n FROM synk_identity_links').get().n,0);
  await c.request('/api/teaching/logout',{body:{}});assert.equal((await c.request('/api/state')).data.user.id,staff.id);assert.equal(c.jar.get('synk_company_session'),companyCookie);
  await c.login();assert.equal((await c.request('/api/logout',{body:{},csrf:companyCsrf})).status,200);assert.equal((await c.request('/api/state')).status,401);assert.equal((await c.request('/api/teaching/status')).data.signedIn,true);
});
test('cancel and a new login attempt invalidate callbacks already waiting for token exchange',async t=>{
  const f=await fixture(t),c=f.client(),callback=await c.begin(),waiting=f.hold('token'),pending=c.request(callback);await new Promise(r=>setTimeout(r,40));
  assert.equal((await c.request('/api/teaching/cancel',{body:{}})).status,200);waiting.resolve();assert.match((await pending).headers.get('location'),/TEACHING_AUTH_REQUIRED/);assert.equal((await c.request('/api/teaching/status')).data.signedIn,false);
  const first=await c.begin(),waitingAgain=f.hold('token'),firstPending=c.request(first);await new Promise(r=>setTimeout(r,40));const second=await c.begin();waitingAgain.resolve();assert.match((await firstPending).headers.get('location'),/TEACHING_AUTH_REQUIRED/);
  assert.notEqual(first,second);assert.equal(f.app.store.db.prepare('SELECT count(*) n FROM teaching_identity_sessions').get().n,0);
  assert.match((await c.request(second)).headers.get('location'),/teachingConnected=1/);assert.equal((await c.request('/api/teaching/status')).data.signedIn,true);
});
test('encrypted teacher sessions survive restart, central outages and rotated refresh verification failures',async t=>{
  const f=await fixture(t),c=f.client(),signed=await c.login(),cookie=c.jar.get('synk_teaching_session');await f.restart();
  const restored=await c.request('/api/teaching/status');assert.equal(restored.data.signedIn,true);assert.equal(restored.data.sessionGeneration,signed.data.sessionGeneration);assert.equal(restored.data.csrfToken,signed.data.csrfToken);assert.equal(c.jar.get('synk_teaching_session'),cookie);
  f.advance(3550000);f.identity(503);const failure=await c.request('/api/teaching/status');assert.equal(failure.data.status,'restoring');assert.equal(failure.data.error.retryable,true);assert.equal(failure.data.signedIn,false);assert.deepEqual(failure.data.account,signed.data.account);assert.equal(failure.data.sessionGeneration,signed.data.sessionGeneration);assert.equal(failure.data.csrfToken,signed.data.csrfToken);
  assert.equal(f.app.store.db.prepare('SELECT count(*) n FROM teaching_identity_sessions').get().n,1);const row=f.app.store.db.prepare('SELECT ciphertext FROM teaching_identity_sessions').get(),entry=f.app.store.decrypt(row.ciphertext);assert.match(entry.refreshToken,/synthetic-refresh-credential-2/);assert.equal(entry.pendingAccessToken,f.tokenValues[1]);
  await f.restart();f.identity(200);assert.equal((await c.request('/api/teaching/status')).data.signedIn,true);
  f.identity(401);assert.equal((await c.request('/api/teaching/status')).data.signedIn,false);assert.equal(f.app.store.db.prepare('SELECT count(*) n FROM teaching_identity_sessions').get().n,0);
});
test('local teacher logout revokes only its world session and cannot resurrect after an in-flight refresh',async t=>{
  const f=await fixture(t),c=f.client();await c.login();f.advance(3550000);const wait=f.hold('token'),pending=c.request('/api/teaching/status');await new Promise(r=>setTimeout(r,40));const logout=c.request('/api/teaching/logout',{body:{}});await new Promise(r=>setTimeout(r,40));wait.resolve();await pending;
  const result=await logout;assert.equal(result.data.localSignedOut,true);assert.equal(result.data.serverRevoked,true);assert.equal((await c.request('/api/teaching/status')).data.signedIn,false);assert.equal(f.app.store.db.prepare('SELECT count(*) n FROM teaching_identity_sessions').get().n,0);
  const revoke=f.calls.find(row=>row.method==='POST'&&row.url.endsWith('/functions/v1/synk-account'));assert.equal(JSON.parse(revoke.body).session_id,sessionId);assert.equal(revoke.headers['X-SYNK-Product'],'world');
});

test('restoring reports the same identity and generation without authorizing classroom reads, and still permits local logout',async t=>{
  const f=await fixture(t),c=f.client(),signed=await c.login();await f.restart();f.identity(503);
  const state=await c.request('/api/teaching/status');assert.equal(state.data.signedIn,false);assert.equal(state.data.status,'restoring');assert.deepEqual(state.data.account,signed.data.account);assert.equal(state.data.sessionGeneration,signed.data.sessionGeneration);assert.equal(state.data.csrfToken,signed.data.csrfToken);
  const before=f.calls.filter(call=>call.url.includes('/synk-classroom/')).length;
  const blocked=await c.request('/api/teaching/request',{body:{operation:'classes'}});assert.equal(blocked.status,503);assert.equal(f.calls.filter(call=>call.url.includes('/synk-classroom/')).length,before);assert.equal(f.app.store.db.prepare('SELECT count(*) as n FROM teaching_identity_sessions').get().n,1);
  assert.equal((await c.request('/api/teaching/logout',{body:{}})).status,200);assert.equal((await c.request('/api/teaching/status')).data.signedIn,false);assert.equal(f.app.store.db.prepare('SELECT count(*) as n FROM teaching_identity_sessions').get().n,0);
});

test('anonymous status creation is rate limited before allocation while existing session/logout and later login remain usable',async t=>{
  const f=await fixture(t),signed=f.client();await signed.login();let limited=0;
  for(let i=0;i<80;i++){const r=await f.client().request('/api/teaching/status');if(r.status===429)limited++;else assert.equal(r.status,200);}
  assert.ok(limited>0);assert.equal((await signed.request('/api/teaching/status')).data.signedIn,true);assert.equal((await signed.request('/api/teaching/logout',{body:{}})).status,200);
  f.advance(60001);assert.equal((await f.client().login()).data.signedIn,true);
});

test('distributed anonymous status cannot exhaust the proof cache for eight hours or evict an active login flow',async t=>{
  const f=await fixture(t),service=createTeachingService({store:f.app.store,origin:f.app.origin,config,fetch:async()=>{throw Error('No provider expected');},clientAddress:req=>req.testAddress});t.after(()=>service.dispose());
  const response=()=>{const headers=new Map();return {getHeader:name=>headers.get(name),setHeader:(name,value)=>headers.set(name,value),headers};};
  const firstReq={headers:{},testAddress:'synthetic-first'},firstRes=response(),first=await service.status(firstReq,firstRes);
  const cookies=firstRes.headers.get('Set-Cookie').map(row=>row.split(';')[0]).join('; '),protectedReq={testAddress:'synthetic-first',headers:{cookie:cookies,origin:f.app.origin,'x-csrf-token':first.csrfToken}};
  assert.ok(service.start(protectedReq,response()).authorizationUrl);
  for(let i=0;i<1010;i++)assert.equal((await service.status({headers:{},testAddress:'synthetic-'+i},response())).status,'signed-out');
  assert.equal((await service.status(protectedReq,response())).csrfToken,first.csrfToken);
  assert.ok(service.start(protectedReq,response()).authorizationUrl);
  assert.equal((await service.status({headers:{},testAddress:'synthetic-late'},response())).status,'signed-out');
});

test('closing preserves a live session identity both before and after a held status validation returns',async t=>{
  const f=await fixture(t),c=f.client(),signed=await c.login(),wait=f.hold('account'),pending=c.request('/api/teaching/status');await new Promise(r=>setTimeout(r,40));
  const stopping=f.app.stop();await new Promise(r=>setTimeout(r,40));const closing=await c.request('/api/teaching/status');
  assert.equal(closing.data.status,'restoring');assert.equal(closing.data.signedIn,false);assert.deepEqual(closing.data.account,signed.data.account);assert.equal(closing.data.sessionGeneration,signed.data.sessionGeneration);assert.equal(closing.data.error.status,503);
  wait.resolve();const late=await pending;assert.equal(late.data.status,'restoring');assert.deepEqual(late.data.account,signed.data.account);assert.equal(late.data.sessionGeneration,signed.data.sessionGeneration);await stopping;
});

test('a parallel status outage blocks an already-running classroom request with 503 while keeping the session',async t=>{
  const f=await fixture(t),c=f.client(),signed=await c.login(),wait=f.hold('classes'),pending=c.request('/api/teaching/request',{body:{operation:'classes'}});await new Promise(r=>setTimeout(r,40));
  f.identity(503);const blocked=await c.request('/api/teaching/status');assert.equal(blocked.data.status,'restoring');wait.resolve();assert.equal((await pending).status,503);
  assert.equal(f.app.store.db.prepare('SELECT count(*) as n FROM teaching_identity_sessions').get().n,1);f.identity(200);assert.equal((await c.request('/api/teaching/status')).data.sessionGeneration,signed.data.sessionGeneration);
});

test('closing while a classroom response is held returns 503 instead of a definitive sign-out',async t=>{
  const f=await fixture(t),c=f.client();await c.login();const wait=f.hold('classes'),pending=c.request('/api/teaching/request',{body:{operation:'classes'}});await new Promise(r=>setTimeout(r,40));
  const stopping=f.app.stop();await new Promise(r=>setTimeout(r,40));wait.resolve();assert.equal((await pending).status,503);await stopping;
});

test('unconfigured or absent-session logout is a safe no-op; a stored session still requires its CSRF proof',async t=>{
  const empty=await fixture(t,{enabled:false}),anon=empty.client();await anon.request('/api/teaching/status');const noop=await anon.request('/api/teaching/logout',{body:{}});assert.equal(noop.status,200);assert.equal(noop.data.localSignedOut,true);assert.equal(noop.data.serverRevoked,true);
  const f=await fixture(t),c=f.client();await c.login();const unconfigured=createTeachingService({store:f.app.store,origin:f.app.origin,config:null});t.after(()=>unconfigured.dispose());
  const req={headers:{origin:f.app.origin,cookie:[...c.jar].map(([key,value])=>key+'='+value).join('; '),'x-csrf-token':'arbitrary'}};
  await assert.rejects(unconfigured.logout(req,{setHeader(){}}),error=>error.status===403);assert.equal(f.app.store.db.prepare('SELECT count(*) as n FROM teaching_identity_sessions').get().n,1);
  assert.equal((await c.request('/api/teaching/logout',{body:{},csrf:'arbitrary'})).status,403);assert.equal(f.app.store.db.prepare('SELECT count(*) as n FROM teaching_identity_sessions').get().n,1);assert.equal((await c.request('/api/teaching/logout',{body:{}})).status,200);
});
