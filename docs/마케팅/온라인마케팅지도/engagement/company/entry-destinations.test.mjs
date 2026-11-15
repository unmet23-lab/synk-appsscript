import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Store } from './store.mjs';
import { createSynkIdentity } from './synk-identity.mjs';
import { createWorkspaceService } from './pulse-workspaces.mjs';
import { createEntryDestinations, NATIVE_ENTRY_IDENTITY } from './entry-destinations.mjs';

const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const authSubject='44444444-4444-4444-8444-444444444444',sessionId='33333333-3333-4333-8333-333333333333';
const origin='https://company.example.test',native='/api/native/entry/destinations',web='/api/customer/entry/destinations';
const config={issuer:NATIVE_ENTRY_IDENTITY.issuer,accountApiUrl:NATIVE_ENTRY_IDENTITY.issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_synthetic_fixture',clientId:'customer-browser-fixture'};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(t,options={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-entry-destinations-')),store=new Store(directory);
  const identity=createSynkIdentity({store,origin,config:null});
  const f={store,stamp:Date.parse('2026-11-15T00:00:00Z'),myModels:true,featureError:false,status:200,accountId:id,active:true,
    sessions:[{id:sessionId,current:true,revoked:false,product:'platform'}],centralCalls:[],reads:[],webCurrent:true,webEnabled:true,webCalls:0,stopping:false,hook:null};
  const workspaces=createWorkspaceService({store,clientProjects:{},features:{read(){if(f.featureError)throw Error('synthetic storage failure');return {myModels:f.myModels};}}});
  const auth={user:{synkUserId:id}};
  const customerIdentity={status:()=>({enabled:f.webEnabled}),authenticate:async()=>{f.webCalls++;if(f.webHook)await f.webHook();return f.webAuth===null?null:auth;},isCurrent:value=>value===auth&&f.webCurrent};
  const token=(claims={})=>'synthetic.'+Buffer.from(JSON.stringify({iss:config.issuer+'/auth/v1',client_id:NATIVE_ENTRY_IDENTITY.clientId,sub:authSubject,session_id:sessionId,
    iat:Math.floor(f.stamp/1000)-1,exp:Math.floor(f.stamp/1000)+3600,...claims})).toString('base64url')+'.fixture';
  const route=createEntryDestinations({origin,customerIdentity,customerConfig:options.config===undefined?config:options.config,
    synkIdentity:{hasActiveCompanyAccount(value){f.reads.push(['company',value]);return identity.hasActiveCompanyAccount(value);}},
    pulseWorkspaces:{entryAssignment(value){f.reads.push(['pulse',value]);return workspaces.entryAssignment(value);}},now:()=>f.stamp,stopping:()=>f.stopping,
    fetch:async(url,init)=>{assert.equal(url,config.accountApiUrl);assert.equal(init.redirect,'error');assert.equal(init.headers['X-SYNK-Product'],'platform');
      f.centralCalls.push({url,init});if(f.hook)await f.hook();if(f.status!==200)return new Response(null,{status:f.status});
      if(f.rawResponse)return f.rawResponse();return Response.json({ok:true,account:{synk_user_id:f.accountId,status:f.active?'active':'disabled'},sessions:f.sessions});},
    body:async(req,limits)=>{assert.equal(limits.maxBytes,1024);if(req.bodyError)throw req.bodyError;return req.input;},
    send:(res,status,data)=>{res.status=status;res.data=data;}});
  t.after(async()=>{await identity.close();identity.dispose();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('synk-entry-destinations-'));rmSync(directory,{recursive:true,force:true});});
  const snapshot=()=>JSON.stringify(['documents','tokens','credentials','synk_identity_links','synk_identity_sessions'].map(table=>[table,store.db.prepare('SELECT * FROM '+table+' ORDER BY 1').all()]));
  const request=async({path=native,method='POST',claims={},bearer=token(claims),input={expectedAccountId:id},headers={},bodyError}={})=>{
    const res={headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=value;}};await route({method,input,bodyError,headers:{'content-type':'application/json',...(bearer===null?{}:{authorization:'Bearer '+bearer}),origin,...headers},socket:{remoteAddress:'127.0.0.1'}},res,new URL(path,origin));return res;
  };
  const employee=(active=true)=>{store.put('users','employee',{id:'employee',active,name:'Private name',email:'private@example.test'});store.db.prepare('INSERT OR REPLACE INTO synk_identity_links VALUES (?,?,?,?)').run(id,'employee','revision','2026-11-15T00:00:00Z');};
  const pulse=(member=id,status='active')=>store.put('customerWorkspaces','workspace',{id:'workspace',name:'Private project',status,members:[{synkUserId:member,role:'member'}]});
  return Object.assign(f,{token,request,snapshot,employee,pulse});
}

test('native and web share actual self assignments and disclose only fixed states without company writes',async t=>{
  const f=fixture(t);f.employee();f.pulse();const before=f.snapshot();
  const expected={version:1,accountMatch:true,workspace:{state:'assigned',destination:'/'},pulse:{state:'assigned',destination:'/pulse-app/'}};
  assert.deepEqual((await f.request()).data,expected);assert.deepEqual((await f.request({path:web})).data,expected);
  assert.equal(f.snapshot(),before);assert.deepEqual(f.reads,[['company',id],['pulse',id],['company',id],['pulse',id]]);
  assert.equal(f.centralCalls.length,1);assert.equal(f.webCalls,1);
});

test('the four assignment combinations and disabled PULSE remain distinct',async t=>{
  const f=fixture(t);const states=async()=>{const r=await f.request();assert.equal(r.status,200);return [r.data.workspace.state,r.data.pulse.state];};
  assert.deepEqual(await states(),['unassigned','unassigned']);f.employee();assert.deepEqual(await states(),['assigned','unassigned']);
  f.pulse();assert.deepEqual(await states(),['assigned','assigned']);f.employee(false);assert.deepEqual(await states(),['unassigned','assigned']);
  f.myModels=false;assert.deepEqual(await states(),['unassigned','unavailable']);
});

test('another member or inactive PULSE brand does not assign the caller; active legacy staff remains assigned',async t=>{
  const f=fixture(t);f.employee();f.pulse(other);
  assert.equal((await f.request()).data.pulse.state,'unassigned');f.pulse(id,'inactive');assert.equal((await f.request()).data.pulse.state,'unassigned');
  assert.equal((await f.request()).data.workspace.state,'assigned');
});

test('expected account mismatch reads neither assignment source and preserves all records',async t=>{
  const f=fixture(t);f.employee();f.pulse();const before=f.snapshot();
  for(const path of [native,web]){const r=await f.request({path,input:{expectedAccountId:other}});assert.equal(r.status,409);assert.equal(r.data.error.code,'ACCOUNT_MISMATCH');}
  assert.deepEqual(f.reads,[]);assert.equal(f.snapshot(),before);
});

test('native cookies cannot substitute a bearer and web bearer cannot substitute a customer session',async t=>{
  const f=fixture(t);assert.equal((await f.request({bearer:null,headers:{cookie:'synk_customer_session=synthetic'}})).status,401);
  f.webAuth=null;assert.equal((await f.request({path:web})).data.error.code,'LOGIN_REQUIRED');
  assert.equal(f.centralCalls.length,0);assert.deepEqual(f.reads,[]);
});

test('unaccepted and revoked bearers fail before claim trust or any assignment read',async t=>{
  const f=fixture(t);f.status=401;const token=f.token();const r=await f.request({bearer:token});
  assert.equal(r.status,401);assert.equal(r.data.error.code,'AUTH_REQUIRED');assert.deepEqual(f.reads,[]);assert.ok(!JSON.stringify(r).includes(token));
});

test('same-product browser and other native clients are forbidden after central acceptance',async t=>{
  const f=fixture(t);
  for(const client_id of ['platform-browser','customer-browser-fixture','care-native','path-native','messenger-native','']){
    const r=await f.request({claims:{client_id}});assert.equal(r.status,403);assert.equal(r.data.error.code,'CLIENT_FORBIDDEN');
  }
  assert.equal(f.centralCalls.length,6);assert.deepEqual(f.reads,[]);
});

test('issuer, expiry, subject, issue time and provider session claims fail closed',async t=>{
  const f=fixture(t);
  for(const claims of [{iss:'https://other.example/auth/v1'},{exp:Math.floor(f.stamp/1000)},{exp:'later'},{iat:Math.floor(f.stamp/1000)+61},{sub:'bad'},{session_id:'bad'}]){
    assert.equal((await f.request({claims})).status,401);
  }
  assert.deepEqual(f.reads,[]);
});

test('central current session must be single, live, well formed and platform scoped',async t=>{
  const f=fixture(t),current=f.sessions[0];
  for(const [sessions,status] of [[[],401],[[{...current,revoked:true}],401],[[current,{...current,id:other}],503],[[{...current,id:'bad'}],503],[[{...current,product:'messenger'}],403]]){
    f.sessions=sessions;assert.equal((await f.request()).status,status);
  }
  assert.deepEqual(f.reads,[]);
});

test('central inactive account, failures and malformed success never become unassigned',async t=>{
  const f=fixture(t);f.active=false;assert.equal((await f.request()).data.error.code,'ACCOUNT_UNAVAILABLE');f.active=true;
  for(const status of [403,429,500]){f.status=status;assert.equal((await f.request()).status,status===403?403:503);}
  f.status=200;f.rawResponse=()=>new Response('{bad');assert.equal((await f.request()).status,503);
  f.rawResponse=()=>Response.json({ok:true,account:{synk_user_id:id,status:'active'}});assert.equal((await f.request()).status,503);
  assert.deepEqual(f.reads,[]);
});

test('a token that expires while central validation is pending reads no assignments',async t=>{
  const f=fixture(t),entered=defer(),release=defer();f.hook=async()=>{entered.resolve();await release.promise;};
  const request=f.request({claims:{exp:Math.floor(f.stamp/1000)+1}});await entered.promise;f.stamp+=1001;release.resolve();
  assert.equal((await request).status,401);assert.deepEqual(f.reads,[]);
});

test('shutdown during central verification prevents late result and assignment reads',async t=>{
  const f=fixture(t),entered=defer(),release=defer();f.hook=async()=>{entered.resolve();await release.promise;};
  const request=f.request();await entered.promise;f.stopping=true;release.resolve();assert.equal((await request).status,503);assert.deepEqual(f.reads,[]);
});

test('web authentication replaced or logged out during validation cannot read assignments',async t=>{
  const f=fixture(t),entered=defer(),release=defer();f.webHook=async()=>{entered.resolve();await release.promise;};
  const request=f.request({path:web});await entered.promise;f.webCurrent=false;release.resolve();assert.equal((await request).status,401);assert.deepEqual(f.reads,[]);
});

test('broken employee links and PULSE storage failures remain unavailable without partial responses',async t=>{
  const f=fixture(t);f.employee();f.store.remove('users','employee');const before=f.snapshot();
  assert.equal((await f.request()).status,503);assert.equal(f.snapshot(),before);f.employee();f.featureError=true;
  const r=await f.request();assert.equal(r.status,503);assert.deepEqual(Object.keys(r.data),['error']);
});

test('method, query, extra keys and cross-origin web requests are rejected before authentication',async t=>{
  const f=fixture(t);
  for(const options of [{method:'GET'},{path:native+'?owner='+other},{headers:{'content-type':'application/json-invalid'}},{input:{expectedAccountId:id,clientId:'other'}},{input:[]},{input:{expectedAccountId:'bad'}},{path:web,headers:{origin:'https://other.example'}}])assert.ok((await f.request(options)).status>=400);
  assert.equal(f.centralCalls.length,0);assert.equal(f.webCalls,0);assert.deepEqual(f.reads,[]);
});

test('missing and other-project configuration cannot activate the native production profile',async t=>{
  for(const configValue of [null,{...config,issuer:'https://other.example'},{...config,publishableKey:'sb_secret_forbidden'}]){
    const f=fixture(t,{config:configValue});assert.equal((await f.request()).status,503);assert.equal(f.centralCalls.length,0);assert.deepEqual(f.reads,[]);
  }
});

test('malformed central account status is unavailable while defined inactive states remain forbidden',async t=>{
  const f=fixture(t),before=f.snapshot();
  for(const status of [undefined,null,false,0,{},[],'','suspended','unknown']){
    f.rawResponse=()=>Response.json({ok:true,account:{synk_user_id:id,...(status===undefined?{}:{status})},sessions:f.sessions});
    const result=await f.request();assert.equal(result.status,503,JSON.stringify(status)??'missing status');
    assert.deepEqual(result.data,{error:{code:'TEMPORARY_UNAVAILABLE',retryable:true}});
  }
  for(const status of ['deletion-requested','disabled','deleted']){
    f.rawResponse=()=>Response.json({ok:true,account:{synk_user_id:id,status},sessions:f.sessions});
    const result=await f.request();assert.equal(result.status,403,status);
    assert.deepEqual(result.data,{error:{code:'ACCOUNT_UNAVAILABLE',retryable:false}});
  }
  assert.deepEqual(f.reads,[]);assert.equal(f.snapshot(),before);
});

test('web identity closing during authentication is unavailable without reading assignments',async t=>{
  for(const stopping of [false,true]){
    const f=fixture(t),entered=defer(),release=defer(),before=f.snapshot();
    f.webHook=async()=>{entered.resolve();await release.promise;};
    const pending=f.request({path:web});await entered.promise;
    f.webEnabled=false;f.webAuth=null;f.stopping=stopping;release.resolve();
    const result=await pending;assert.equal(result.status,503);
    assert.deepEqual(result.data,{error:{code:'TEMPORARY_UNAVAILABLE',retryable:true}});
    assert.deepEqual(f.reads,[]);assert.equal(f.snapshot(),before);
  }
});
