import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { NATIVE_ENTRY_IDENTITY } from './entry-destinations.mjs';

const origin='https://company.example.test',issuer=NATIVE_ENTRY_IDENTITY.issuer;
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const subject='44444444-4444-4444-8444-444444444444',sessionId='33333333-3333-4333-8333-333333333333';
const native='/api/native/entry/destinations',web='/api/customer/entry/destinations';
const config={issuer,accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_synthetic_fixture',clientId:'customer-browser-fixture',redirectUri:origin+'/api/customer/synk-id/callback'};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function fixture(t,{staffIdentity=false}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-entry-http-'));
  const f={directory,stamp:Date.parse('2026-11-15T00:00:00Z'),centralStatus:200,externalAttempts:0,calls:[],gate:null};
  const token=(clientId,owner=id,extra={})=>'synthetic.'+Buffer.from(JSON.stringify({iss:issuer+'/auth/v1',client_id:clientId,sub:subject,
    session_id:sessionId,iat:Math.floor(f.stamp/1000)-1,exp:Math.floor(f.stamp/1000)+3600,fixtureOwner:owner,...extra})).toString('base64url')+'.fixture';
  async function identityFetch(url,init){
    const value=String(url);assert.ok([config.accountApiUrl,issuer+'/auth/v1/oauth/token',issuer+'/auth/v1/logout?scope=local'].includes(value));
    f.calls.push({url:value,method:init.method||'GET'});
    if(value.endsWith('/oauth/token')){const form=new URLSearchParams(init.body);return Response.json({access_token:token(config.clientId,form.get('code')||id),refresh_token:'synthetic-refresh-token',token_type:'bearer'});}
    if(init.method==='POST'||value.includes('/logout?scope=local'))return Response.json({ok:true,current:true,refreshRevoked:true});
    if(f.gate){const gate=f.gate;f.gate=null;gate.entered.resolve();await gate.release.promise;}
    const access=init.headers.Authorization.slice(7);
    if(!access.endsWith('.fixture'))return new Response(null,{status:401});
    if(f.centralStatus!==200)return new Response(null,{status:f.centralStatus});
    const claims=JSON.parse(Buffer.from(access.split('.')[1],'base64url'));
    return Response.json({ok:true,account:{synk_user_id:claims.fixtureOwner,status:'active'},sessions:[{id:sessionId,current:true,revoked:false,product:'platform'}]});
  }
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{f.externalAttempts++;throw Error('Network disabled in entry HTTP fixture');};
  let app;
  t.after(async()=>{try{if(app)await app.stop();}finally{globalThis.fetch=originalFetch;assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('synk-entry-http-'));await rm(directory,{recursive:true,force:true});}assert.equal(f.externalAttempts,0);});
  app=createCompanyApp({dataDir:directory,messengerDataDir:join(directory,'messenger'),port:0,host:'127.0.0.1',origin,allowTestHost:true,
    platformUrl:origin+'/platform/',schedule:false,workNotificationsEnabled:false,deviceNotificationsEnabled:false,
    synkIdentityConfig:staffIdentity?{accountApiUrl:config.accountApiUrl,publishableKey:config.publishableKey}:null,
    synkIdentityVerifier:async value=>{
      assert.equal(value,'fixture-staff-synk-session');
      f.staffChecks=(f.staffChecks||0)+1;
      return {synkUserId:id,expiresAt:f.stamp+3600_000};
    },synkIdentityNow:()=>f.stamp,
    teachingConfig:null,synkCustomerIdentityConfig:config,synkCustomerIdentityFetch:identityFetch,
    synkEntryIdentityFetch:identityFetch,synkCustomerIdentityNow:()=>f.stamp,messengerIdentityLinks:[],
    messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  const jar=new Map();
  const request=async(path,{input,method=input===undefined?'GET':'POST',bearer,cookie=true,originHeader=origin,raw,headers={}}={})=>{
    const response=await originalFetch(base+path,{method,redirect:'manual',signal:AbortSignal.timeout(6000),headers:{
      ...(input===undefined&&raw===undefined?{}:{'Content-Type':'application/json'}),...(originHeader?{Origin:originHeader}:{}),
      ...(cookie?{Cookie:[...jar].map(([key,value])=>key+'='+value).join('; ')}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{}),...headers},
      ...(raw!==undefined?{body:raw}:input===undefined?{}:{body:JSON.stringify(input)})});
    for(const row of response.headers.getSetCookie()){const [pair]=row.split(';'),index=pair.indexOf('=');if(pair.slice(index+1))jar.set(pair.slice(0,index),pair.slice(index+1));else jar.delete(pair.slice(0,index));}
    const text=await response.text();return {status:response.status,headers:response.headers,text,data:text&&response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):null};
  };
  const snapshot=()=>JSON.stringify(app.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>{
    assert.match(name,/^[A-Za-z_][A-Za-z0-9_]*$/);return [name,app.store.db.prepare('SELECT * FROM '+name+' ORDER BY 1').all()];}));
  const login=async(owner=id)=>{const start=await request('/api/customer/synk-id/start',{input:{}});assert.equal(start.status,200);const state=new URL(start.data.authorizationUrl).searchParams.get('state');
    assert.equal((await request('/api/customer/synk-id/callback?'+new URLSearchParams({state,code:owner}))).status,302);};
  app.store.put('users','staff',{id:'staff',name:'Synthetic staff',active:true,role:'member'});
  app.store.db.prepare('INSERT INTO synk_identity_links VALUES (?,?,?,?)').run(id,'staff','revision','2026-11-15T00:00:00Z');
  app.store.put('pulseFeatureSettings','main',{myModels:true});
  app.store.put('customerWorkspaces','brand',{id:'brand',status:'active',members:[{synkUserId:id,role:'member'}]});
  return Object.assign(f,{app,request,login,snapshot,jar,token:(owner=id,extra={})=>token(NATIVE_ENTRY_IDENTITY.clientId,owner,extra)});
}

async function staffLogin(f){
  const challenge=await f.request('/api/synk-id/challenge',{input:{action:'login'}});
  assert.equal(challenge.status,200);
  const exchange=await f.request('/api/synk-id/exchange',{input:{challenge:challenge.data.challenge,confirm:true},bearer:'fixture-staff-synk-session'});
  assert.equal(exchange.status,200);
  assert.equal((await f.request('/api/me')).data.synkUserId,id);
}

test('web entry accepts the current linked employee session without customer login or new privileges',async t=>{
  const f=await fixture(t,{staffIdentity:true});await staffLogin(f);
  const query=expectedAccountId=>f.request(web,{originHeader:'https://synk.im',input:{expectedAccountId}});
  const before=f.snapshot(),cookies=[...f.jar];
  const response=await query(id);
  assert.equal(response.status,200);assert.equal(response.data.workspace.state,'assigned');
  assert.equal(response.data.pulse.state,'assigned');assert.deepEqual(response.headers.getSetCookie(),[]);
  assert.equal((await query(other)).status,409);
  assert.equal((await f.request(native,{input:{expectedAccountId:id}})).status,401);
  assert.equal(f.snapshot(),before);assert.deepEqual([...f.jar],cookies);
  await f.login();assert.equal((await query(id)).status,200);
  await f.login(other);
  for(const who of [id,other]){
    const result=await query(who);assert.equal(result.status,409);assert.equal(result.data.error.code,'ACCOUNT_MISMATCH');
    assert.deepEqual(result.headers.getSetCookie(),[]);
  }
});

test('web entry drops a linked employee session invalidated during the customer check',async t=>{
  const f=await fixture(t,{staffIdentity:true});await staffLogin(f);await f.login();
  const gate={entered:defer(),release:defer()};f.gate=gate;
  const pending=f.request(web,{input:{expectedAccountId:id}});
  await Promise.race([gate.entered.promise,pending.then(r=>assert.fail('entry finished before customer validation: '+r.status))]);
  try{f.app.store.db.prepare("DELETE FROM tokens WHERE purpose='session' AND userId=?").run('staff');}
  finally{gate.release.resolve();}
  const result=await pending;assert.equal(result.status,401);assert.equal(result.data.error.code,'LOGIN_REQUIRED');
});

test('web entry revalidates employee identity after its check interval',async t=>{
  const f=await fixture(t,{staffIdentity:true});await staffLogin(f);
  const checks=f.staffChecks;
  f.stamp+=40_000;
  const result=await f.request(web,{input:{expectedAccountId:id}});
  assert.equal(result.status,200);assert.equal(f.staffChecks,checks+1);
});

test('an employee credential already expired before entry does not block the current customer',async t=>{
  const f=await fixture(t,{staffIdentity:true});await staffLogin(f);
  f.stamp+=3600_001;await f.login(other);
  const result=await f.request(web,{input:{expectedAccountId:other}});
  assert.equal(result.status,200);assert.equal(result.data.workspace.state,'unassigned');
  assert.deepEqual(result.headers.getSetCookie(),[]);
});

test('valid dual sessions stay current when the staff check interval elapses during customer authentication',async t=>{
  const f=await fixture(t,{staffIdentity:true});await staffLogin(f);await f.login();
  f.stamp+=29_900;
  const gate={entered:defer(),release:defer()};f.gate=gate;
  const pending=f.request(web,{input:{expectedAccountId:id}});
  await Promise.race([gate.entered.promise,pending.then(r=>assert.fail('entry finished before customer validation: '+r.status))]);
  f.stamp+=300;gate.release.resolve();
  const result=await pending;assert.equal(result.status,200);assert.equal(result.data.workspace.state,'assigned');
});

test('a local employee login with no SYNK session cannot assert a web entry identity',async t=>{
  const f=await fixture(t,{staffIdentity:true});
  f.jar.set('synk_company_session',f.app.store.mint('session','staff',{csrfToken:'test-csrf'},10));
  const r=await f.request(web,{input:{expectedAccountId:id}});assert.equal(r.status,401);
  assert.equal(r.data.error.code,'LOGIN_REQUIRED');assert.deepEqual(r.headers.getSetCookie(),[]);
});

test('real HTTP native and customer reads preserve company records and cookies while returning the same own assignments',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot(),cookies=[...f.jar];
  const a=await f.request(native,{input:{expectedAccountId:id},bearer:f.token(),cookie:false,originHeader:null});
  const b=await f.request(web,{input:{expectedAccountId:id}});
  for(const r of [a,b]){assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);assert.deepEqual(r.headers.getSetCookie(),[]);}
  assert.deepEqual(a.data,b.data);assert.deepEqual(a.data,{version:1,accountMatch:true,workspace:{state:'assigned',destination:'/'},pulse:{state:'assigned',destination:'/pulse-app/'}});
  assert.equal(f.snapshot(),before);assert.deepEqual([...f.jar],cookies);
});

test('real HTTP rejects forged, wrong-client, wrong-account and cookie-only native requests without granting assignments',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot();
  const cases=[{options:{bearer:f.token().replace(/fixture$/,'forged')},status:401,code:'AUTH_REQUIRED'},
    {options:{bearer:f.token(id,{client_id:config.clientId})},status:403,code:'CLIENT_FORBIDDEN'},
    {options:{bearer:f.token(other)},status:409,code:'ACCOUNT_MISMATCH'},
    {options:{},status:401,code:'AUTH_REQUIRED'}];
  for(const c of cases){const r=await f.request(native,{input:{expectedAccountId:id},...c.options});assert.equal(r.status,c.status);assert.deepEqual(r.data,{error:{code:c.code,retryable:false}});assert.deepEqual(r.headers.getSetCookie(),[]);}
  assert.equal(f.snapshot(),before);
  assert.equal((await f.request(web,{input:{expectedAccountId:other}})).status,409);
  assert.equal((await f.request(web,{input:{expectedAccountId:id},originHeader:'https://untrusted.example'})).status,403);
  assert.equal((await f.request(native,{method:'POST',bearer:f.token(),raw:JSON.stringify({expectedAccountId:id,padding:'x'.repeat(1100)})})).status,413);
});

test('real customer logout during a pending entry read invalidates the old response',async t=>{
  const f=await fixture(t);await f.login();const me=await f.request('/api/customer/me');
  const gate={entered:defer(),release:defer()};f.gate=gate;
  const pending=f.request(web,{input:{expectedAccountId:id}});await gate.entered.promise;
  assert.ok(me.data.csrfToken);
  const logout=f.request('/api/customer/logout',{input:{},headers:{'X-CSRF-Token':me.data.csrfToken}});
  const count=()=>f.app.store.db.prepare('SELECT count(*) AS n FROM customer_identity_sessions').get().n;
  const deadline=performance.now()+2000;
  while(count()!==0&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));
  try{assert.equal(count(),0);}finally{gate.release.resolve();}
  const result=await pending;assert.equal(result.status,401);assert.equal(result.data.error.code,'LOGIN_REQUIRED');assert.equal((await logout).status,200);
});

test('real HTTP central outage stays unavailable and unrelated read does not create login state',async t=>{
  const f=await fixture(t);const before=f.snapshot();f.centralStatus=503;
  const r=await f.request(native,{input:{expectedAccountId:id},bearer:f.token(),cookie:false});
  assert.equal(r.status,503);assert.equal(r.data.error.code,'TEMPORARY_UNAVAILABLE');assert.equal(f.snapshot(),before);assert.deepEqual(r.headers.getSetCookie(),[]);
  assert.equal((await f.request(web,{input:{expectedAccountId:id},cookie:false})).status,401);
});

test('real HTTP JSON media types are case insensitive and still reject other types before authentication',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot(),cookies=[...f.jar];
  for(const type of ['Application/JSON','APPLICATION/JSON; charset=UTF-8','application/json; charset=utf-8']){
    const a=await f.request(native,{input:{expectedAccountId:id},bearer:f.token(),cookie:false,headers:{'Content-Type':type}});
    const b=await f.request(web,{input:{expectedAccountId:id},headers:{'Content-Type':type}});
    for(const result of [a,b]){assert.equal(result.status,200,type);assert.equal(result.data.accountMatch,true);assert.deepEqual(result.headers.getSetCookie(),[]);}
  }
  const calls=f.calls.length;
  for(const type of ['application/json-invalid','application/jsonx','application/problem+json','text/plain']){
    const result=await f.request(native,{input:{expectedAccountId:id},bearer:f.token(),cookie:false,headers:{'Content-Type':type}});
    assert.equal(result.status,400,type);assert.deepEqual(result.data,{error:{code:'INVALID_INPUT',retryable:false}});
  }
  assert.equal(f.calls.length,calls);assert.equal(f.snapshot(),before);assert.deepEqual([...f.jar],cookies);
});

test('real customer read pending during server stop is unavailable and preserves its login',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot(),cookies=[...f.jar],gate={entered:defer(),release:defer()};f.gate=gate;
  const pending=f.request(web,{input:{expectedAccountId:id}});await gate.entered.promise;
  const stopping=f.app.stop();
  try{
    await new Promise(setImmediate);
    assert.equal(f.app.store.db.prepare('SELECT count(*) AS n FROM customer_identity_sessions').get().n,1);
    assert.equal(f.snapshot(),before);
  }finally{gate.release.resolve();}
  const result=await pending;await stopping;
  assert.equal(result.status,503);assert.deepEqual(result.data,{error:{code:'TEMPORARY_UNAVAILABLE',retryable:true}});
  assert.deepEqual(result.headers.getSetCookie(),[]);assert.deepEqual([...f.jar],cookies);
});

test('real signed-in customer central outage is retryable and does not discard the login',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot(),cookies=[...f.jar],calls=f.calls.length;f.centralStatus=503;
  const result=await f.request(web,{input:{expectedAccountId:id}});
  assert.equal(f.calls.length,calls+1);assert.equal(result.status,503);
  assert.deepEqual(result.data,{error:{code:'TEMPORARY_UNAVAILABLE',retryable:true}});
  assert.deepEqual(result.headers.getSetCookie(),[]);assert.deepEqual([...f.jar],cookies);assert.equal(f.snapshot(),before);
  f.centralStatus=200;assert.equal((await f.request(web,{input:{expectedAccountId:id}})).status,200);
});

const portal='https://synk.im';
function assertPortalHeaders(result,{preflight=false}={}){
  assert.equal(result.headers.get('access-control-allow-origin'),portal);
  assert.equal(result.headers.get('access-control-allow-credentials'),'true');
  assert.equal(result.headers.get('vary'),'Origin');
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal(result.headers.get('x-content-type-options'),'nosniff');
  assert.equal(result.headers.get('x-frame-options'),'DENY');
  assert.equal(result.headers.get('referrer-policy'),'no-referrer');
  assert.match(result.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.deepEqual(result.headers.getSetCookie(),[]);
  assert.equal(result.headers.get('access-control-allow-methods'),preflight?'POST':null);
  assert.equal(result.headers.get('access-control-allow-headers'),preflight?'Content-Type':null);
  assert.equal(result.headers.get('access-control-allow-private-network'),null);
}
function assertNoCors(result){
  for(const name of ['access-control-allow-origin','access-control-allow-credentials','access-control-allow-methods','access-control-allow-headers'])assert.equal(result.headers.get(name),null,name);
  assert.deepEqual(result.headers.getSetCookie(),[]);
}

test('portal CORS preflight permits only the exact web assignment JSON POST without authentication or writes',async t=>{
  const f=await fixture(t),before=f.snapshot(),calls=f.calls.length;
  const result=await f.request(web,{method:'OPTIONS',cookie:false,originHeader:portal,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(result.status,204);assert.equal(result.text,'');assertPortalHeaders(result,{preflight:true});
  assert.equal(f.calls.length,calls);assert.equal(f.snapshot(),before);
});

test('portal CORS returns all own zero one and two assignment combinations with the existing customer cookie',async t=>{
  const f=await fixture(t);await f.login();const cookies=[...f.jar];
  for(const [workspace,pulse] of [[false,false],[true,false],[false,true],[true,true]]){
    f.app.store.put('users','staff',{id:'staff',name:'Synthetic staff',active:workspace,role:'member'});
    f.app.store.put('customerWorkspaces','brand',{id:'brand',status:'active',members:pulse?[{synkUserId:id,role:'member'}]:[]});
    const before=f.snapshot(),result=await f.request(web,{input:{expectedAccountId:id},originHeader:portal});
    assert.equal(result.status,200);assertPortalHeaders(result);
    assert.deepEqual(result.data,{version:1,accountMatch:true,workspace:{state:workspace?'assigned':'unassigned',destination:'/'},pulse:{state:pulse?'assigned':'unassigned',destination:'/pulse-app/'}});
    assert.equal(f.snapshot(),before);assert.deepEqual([...f.jar],cookies);
  }
});

test('portal CORS exposes safe authentication account input and outage errors without discarding customer state',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot(),cookies=[...f.jar];
  for(const scenario of [
    {options:{cookie:false},status:401,code:'LOGIN_REQUIRED',retryable:false},
    {options:{input:{expectedAccountId:other}},status:409,code:'ACCOUNT_MISMATCH',retryable:false},
    {options:{input:{expectedAccountId:'invalid'}},status:400,code:'INVALID_INPUT',retryable:false},
    {path:web+'?owner=ignored',options:{},status:400,code:'INVALID_INPUT',retryable:false},
    {options:{},centralStatus:503,status:503,code:'TEMPORARY_UNAVAILABLE',retryable:true},
  ]){
    f.centralStatus=scenario.centralStatus||200;
    const result=await f.request(scenario.path||web,{input:{expectedAccountId:id},originHeader:portal,...scenario.options});
    assert.equal(result.status,scenario.status);assertPortalHeaders(result);
    assert.deepEqual(result.data,{error:{code:scenario.code,retryable:scenario.retryable}});
    assert.equal(f.snapshot(),before);assert.deepEqual([...f.jar],cookies);
  }
});

test('portal CORS rate limit remains readable and performs no authentication or assignment write',async t=>{
  const f=await fixture(t),before=f.snapshot(),calls=f.calls.length;
  let result;
  for(let n=0;n<61;n++){
    result=await f.request(web,{input:{expectedAccountId:'invalid'},cookie:false,originHeader:portal});
    assert.equal(result.status,n<60?400:429);assertPortalHeaders(result);
  }
  assert.deepEqual(result.data,{error:{code:'RATE_LIMITED',retryable:true}});
  assert.equal(f.calls.length,calls);assert.equal(f.snapshot(),before);
});

test('portal CORS rejects lookalike origins and hostile preflights without granting any browser access',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot(),calls=f.calls.length,cookies=[...f.jar];
  const preflight={'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'};
  for(const originHeader of ['https://synk.im.evil.test','https://www.synk.im','http://synk.im','https://synk.im:444','https://synk.im/','null','https://other.example']){
    const result=await f.request(web,{input:{expectedAccountId:id},originHeader:originHeader});
    assert.equal(result.status,403);assertNoCors(result);
    const options=await f.request(web,{method:'OPTIONS',cookie:false,originHeader,headers:preflight});
    assert.equal(options.status,403);assertNoCors(options);
  }
  for(const scenario of [
    {headers:{...preflight,'Access-Control-Request-Method':'GET'}},
    {headers:{...preflight,'Access-Control-Request-Method':'post'}},
    {headers:{...preflight,'Access-Control-Request-Headers':'content-type, authorization'}},
    {headers:{...preflight,'Access-Control-Request-Headers':'content-type, content-type'}},
    {headers:{...preflight,'Access-Control-Request-Headers':'x-requested-with'}},
    {headers:{'Access-Control-Request-Method':'POST'}},
    {headers:{...preflight,'Access-Control-Request-Private-Network':'true'}},
    {path:web+'?owner=ignored',headers:preflight},
  ]){
    const result=await f.request(scenario.path||web,{method:'OPTIONS',cookie:false,originHeader:portal,headers:scenario.headers});
    assert.equal(result.status,400);assertNoCors(result);
  }
  assert.equal(f.calls.length,calls);assert.equal(f.snapshot(),before);assert.deepEqual([...f.jar],cookies);
});

test('portal CORS never applies to native entry or another customer endpoint',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot();
  const nativeRead=await f.request(native,{input:{expectedAccountId:id},bearer:f.token(),cookie:false,originHeader:portal});
  assert.equal(nativeRead.status,200);assertNoCors(nativeRead);
  const nativeOptions=await f.request(native,{method:'OPTIONS',cookie:false,originHeader:portal,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(nativeOptions.status,405);assertNoCors(nativeOptions);
  const otherEndpoint=await f.request('/api/customer/me',{cookie:false,originHeader:portal});
  assert.equal(otherEndpoint.status,200);assert.equal(otherEndpoint.data.authenticated,false);assertNoCors(otherEndpoint);
  assert.equal(f.snapshot(),before);
});

test('portal CORS shutdown during authentication returns readable unavailable without erasing a customer login',async t=>{
  const f=await fixture(t);await f.login();const before=f.snapshot(),cookies=[...f.jar],gate={entered:defer(),release:defer()};f.gate=gate;
  const pending=f.request(web,{input:{expectedAccountId:id},originHeader:portal});
  const entered=await Promise.race([gate.entered.promise.then(()=>true),pending.then(()=>false)]);
  assert.equal(entered,true,'the trusted portal request must reach customer authentication');
  const stopping=f.app.stop();
  try{await new Promise(setImmediate);assert.equal(f.app.store.db.prepare('SELECT count(*) AS n FROM customer_identity_sessions').get().n,1);assert.equal(f.snapshot(),before);}
  finally{gate.release.resolve();}
  const result=await pending;await stopping;
  assert.equal(result.status,503);assertPortalHeaders(result);
  assert.deepEqual(result.data,{error:{code:'TEMPORARY_UNAVAILABLE',retryable:true}});assert.deepEqual([...f.jar],cookies);
});
