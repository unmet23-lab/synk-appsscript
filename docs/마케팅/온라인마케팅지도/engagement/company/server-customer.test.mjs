import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { createCompanyApp } from './server.mjs';
import { createCustomerComputerState } from './public/customer-computer-state.mjs';
import { createComputerInterpretation } from '../../../../../experiences/atlas-lab/interpretation.mjs';
import { createComputerConsultation } from '../../../../../experiences/atlas-lab/consultation.mjs';
import Interpretation from '../../../../../atlas/interpretation.js';
import Ask from '../../../../../atlas/ask.js';
import content from '../../../맞춤도구/computer/content.js';
import rules from '../../../맞춤도구/computer/rules.js';

const origin='https://company.example.test',issuer='https://identity.example.test';
const firstId='11111111-1111-4111-8111-111111111111',secondId='22222222-2222-4222-8222-222222222222';
const sessionId='33333333-3333-4333-8333-333333333333',source='현재 램은 16GB입니다.';
const endpoint='/api/customer/computer-interpretation';
const input=()=>({id:randomUUID(),requestId:'customer-fixture',sourceId:'customer-source',revision:1,text:source});
const document={version:1,text:source,answers:{'current.ram':'16'}};
const config={accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_synthetic_fixture',issuer,clientId:'customer-browser-fixture',redirectUri:origin+'/api/customer/synk-id/callback'};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const providerResponse=()=>Response.json({model:'gpt-6-luna',status:'completed',usage:{input_tokens:1000,output_tokens:100,total_tokens:1100},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({proposals:[{field:'current.ram',value:'16',subject:'self',stance:'current',evidence:[{quote:source,occurrence:1}]}],held:[]})}]}]});
async function fixture(t,{configured=true,ai=true,provider=async()=>providerResponse()}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-customer-api-'));
  const env=ai?{SYNK_COMPUTER_AI_ENABLED:'1',SYNK_COMPUTER_AI_MODEL:'gpt-6-luna',SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS:'3000',SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD:'125000',SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD:'500000',SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD:'10000',SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD:'250000',SYNK_COMPUTER_AI_CUSTOMER_ENABLED:'1',SYNK_COMPUTER_AI_CUSTOMER_DAILY_REQUESTS:'2',SYNK_COMPUTER_AI_CUSTOMER_DAILY_MICRO_USD:'20000',OPENAI_API_KEY:'synthetic-provider-key-never-sent'}:{};
  const f={directory,env,stamp:Date.parse('2026-10-08T12:00:00Z'),centralStatus:200,active:true,centralCalls:[],providerCalls:[],nextCentral:null,nextRefresh:null,refreshCount:0};
  function token(id){return 'synthetic.'+Buffer.from(JSON.stringify({iss:issuer+'/auth/v1',sub:id,session_id:sessionId,client_id:config.clientId,iat:Math.floor(f.stamp/1000)-1,exp:Math.floor((f.stamp+3600_000)/1000)})).toString('base64url')+'.fixture';}
  async function identityFetch(url,init){
    f.centralCalls.push({url:String(url),...init});
    if(String(url).endsWith('/oauth/token')){
      const body=new URLSearchParams(init.body),refresh=body.get('grant_type')==='refresh_token';
      if(refresh)f.refreshCount++;
      const id=refresh?body.get('refresh_token').split(':')[1]:body.get('code');
      if(refresh&&f.nextRefresh){const gate=f.nextRefresh;f.nextRefresh=null;gate.entered.resolve();await gate.release.promise;}
      return Response.json({access_token:token(id),refresh_token:'synthetic-refresh:'+id+':'+f.refreshCount,token_type:'bearer'});
    }
    if(String(url).includes('/logout?scope=local'))return new Response(null,{status:204});
    if(init.method==='POST')return Response.json({ok:true,current:true});
    if(f.nextCentral){const next=f.nextCentral;f.nextCentral=null;next.resolve();}
    if(f.centralStatus!==200)return new Response(null,{status:f.centralStatus});
    const claims=JSON.parse(Buffer.from(init.headers.Authorization.split('.')[1],'base64url'));
    return Response.json({ok:true,account:{synk_user_id:claims.sub,status:f.active?'active':'suspended',profile:{display_name:claims.sub===firstId?'첫 고객':'다른 고객'}},sessions:[{id:sessionId,current:true,revoked:false,product:'platform'}]});
  }
  const options={dataDir:directory,port:0,origin,allowTestHost:true,schedule:false,synkIdentityConfig:null,
    synkCustomerIdentityConfig:configured?config:null,synkCustomerIdentityFetch:identityFetch,synkCustomerIdentityNow:()=>f.stamp,
    clock:()=>new Date(f.stamp).toISOString(),computerAIEnv:name=>env[name],computerAIFetch:async(...args)=>{f.providerCalls.push(args);return provider(...args);},
    messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  const start=async()=>{f.app=createCompanyApp(options);const address=await f.app.start();f.base=`http://127.0.0.1:${address.port}`;};
  await start();
  f.staff=f.app.store.createUser({name:'합성 직원',email:'staff@customer.example.test',role:'admin'});
  f.staffToken=f.app.store.mint('session',f.staff.id,{csrfToken:'synthetic-staff-csrf'},10);
  t.after(async()=>{await f.app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-customer-api-'));await rm(directory,{recursive:true,force:true});});
  f.restart=async()=>{await f.app.stop();await start();};
  f.client=()=>{
    const jar=new Map();
    return {jar,csrf:'',cookie(){return [...jar].map(([key,value])=>key+'='+value).join('; ');},async request(path,{body,method=body===undefined?'GET':'POST',headers={}}={}){
      const res=await fetch(f.base+path,{method,redirect:'manual',headers:{Cookie:this.cookie(),...(method==='POST'?{'Content-Type':'application/json',Origin:origin,'X-CSRF-Token':this.csrf}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
      for(const row of res.headers.getSetCookie()){const pair=row.split(';')[0],index=pair.indexOf('='),name=pair.slice(0,index),value=pair.slice(index+1);if(value)jar.set(name,value);else jar.delete(name);}
      const raw=await res.text(),data=res.headers.get('content-type')?.includes('application/json')&&raw?JSON.parse(raw):null;
      if(data?.csrfToken)this.csrf=data.csrfToken;
      return {status:res.status,headers:res.headers,data,text:raw};
    },async login(id=firstId){
      const start=await this.request('/api/customer/synk-id/start',{body:{}});assert.equal(start.status,200);
      const state=new URL(start.data.authorizationUrl).searchParams.get('state');
      const callback=await this.request('/api/customer/synk-id/callback?'+new URLSearchParams({state,code:id}));assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'/consultation/');
      const me=await this.request('/api/customer/me');assert.equal(me.status,200);assert.equal(me.data.authenticated,true);return me;
    }};
  };
  f.slowBody=async(client,path,payload)=>{
    const raw=JSON.stringify(payload),entered=defer();f.nextCentral=entered;
    let finish;const response=new Promise((resolveResponse,reject)=>{
      const req=http.request(f.base+path,{method:'POST',headers:{Cookie:client.cookie(),Origin:origin,'X-CSRF-Token':client.csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const text=Buffer.concat(chunks).toString();resolveResponse({status:res.statusCode,data:JSON.parse(text)});});});
      req.on('error',reject);req.write(raw.slice(0,1));finish=()=>req.end(raw.slice(1));
    });
    await entered.promise;return {finish,response};
  };
  return f;
}

test('incomplete cloud preparation is rejected before Store or messenger files are created and originals remain intact',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-customer-preflight-'));
  t.after(async()=>{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-customer-preflight-'));await rm(directory,{recursive:true,force:true});});
  const marker='synthetic restore still awaiting acceptance\n',original=Buffer.from('synthetic original backup manifest\n');
  await writeFile(join(directory,'PREPARATION_INCOMPLETE'),marker);await writeFile(join(directory,'original-manifest.txt'),original);
  let unexpectedApp;
  try{assert.throws(()=>{unexpectedApp=createCompanyApp({dataDir:directory,port:0,origin,schedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null});},/복구 검증을 마치지 않은 데이터/);}
  finally{await unexpectedApp?.stop();}
  assert.deepEqual((await readdir(directory)).sort(),['PREPARATION_INCOMPLETE','original-manifest.txt']);
  assert.equal(await readFile(join(directory,'PREPARATION_INCOMPLETE'),'utf8'),marker);assert.deepEqual(await readFile(join(directory,'original-manifest.txt')),original);
});

test('requireExistingData rejects an empty directory without creating SQLite, keys or a messenger directory',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-customer-preflight-'));
  t.after(async()=>{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-customer-preflight-'));await rm(directory,{recursive:true,force:true});});
  assert.deepEqual(await readdir(directory),[]);
  let unexpectedApp;
  try{assert.throws(()=>{unexpectedApp=createCompanyApp({dataDir:directory,requireExistingData:true,port:0,origin,schedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null});},/빈 데이터로 시작하지 않습니다/);}
  finally{await unexpectedApp?.stop();}
  assert.deepEqual(await readdir(directory),[]);
});

test('unconfigured customer login stays unavailable and leaves company authentication intact',async t=>{
  const f=await fixture(t,{configured:false}),anonymous=f.client();
  const me=await anonymous.request('/api/customer/me');assert.equal(me.status,200);assert.equal(me.data.authenticated,false);assert.equal(me.data.loginAvailable,false);assert.equal(me.data.user,null);
  assert.equal((await anonymous.request('/api/customer/synk-id/start',{body:{}})).status,503);
  assert.equal((await anonymous.request('/api/customer/computer-draft')).status,401);
  assert.equal((await anonymous.request('/api/me',{headers:{Cookie:'synk_company_session='+f.staffToken}})).data.user.id,f.staff.id);
  assert.equal(f.centralCalls.length,0);assert.equal(f.providerCalls.length,0);
});

test('staff, anonymous and customer sessions cannot cross company/customer boundaries',async t=>{
  const f=await fixture(t),customer=f.client(),anonymous=f.client(),staff=f.client();staff.jar.set('synk_company_session',f.staffToken);staff.csrf='synthetic-staff-csrf';
  const beforeUsers=f.app.store.all('users').length,beforeTokens=f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens').get().n;
  for(const client of [anonymous,staff]){
    assert.equal((await client.request('/api/customer/me')).data.authenticated,false);
    assert.equal((await client.request('/api/customer/computer-draft')).status,401);
    assert.equal((await client.request(endpoint,{body:input()})).status,401);
  }
  await customer.login();const employeeMe=await customer.request('/api/me');assert.equal(employeeMe.status,200);assert.equal(employeeMe.data.user,null);assert.equal(employeeMe.data.csrfToken,undefined);
  assert.equal((await customer.request('/api/bootstrap')).status,401);assert.equal((await customer.request('/messenger/api/bootstrap')).status,401);
  const staffAi=await customer.request('/api/computer-interpretation',{body:input()});assert.equal(staffAi.status,403);
  assert.equal(f.app.store.all('users').length,beforeUsers);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM tokens').get().n,beforeTokens);
  assert.equal(f.providerCalls.length,0);
});

test('customer login and isolated encrypted drafts survive restart without reauthentication or extended expiry',async t=>{
  const f=await fixture(t),first=f.client(),other=f.client();await first.login();await other.login(secondId);
  const cookie=first.jar.get('synk_customer_session'),csrf=first.csrf,rowsBefore=f.app.store.db.prepare('SELECT session_hash,expires_at FROM customer_identity_sessions ORDER BY session_hash').all();
  assert.equal((await first.request('/api/customer/computer-draft',{body:{baseRevision:0,document}})).data.revision,1);
  assert.equal((await other.request('/api/customer/computer-draft')).data.status,'empty');
  assert.equal((await other.request('/api/customer/computer-draft',{body:{baseRevision:0,document,userId:'synk:'+firstId}})).status,400);
  assert.ok(!JSON.stringify(f.app.store.all('customerComputerDrafts')).includes(source));
  await f.restart();const restored=await first.request('/api/customer/me');assert.equal(restored.data.authenticated,true);assert.equal(restored.data.user.id,'synk:'+firstId);
  assert.equal(first.jar.get('synk_customer_session'),cookie);assert.equal(restored.data.csrfToken,csrf);
  assert.deepEqual(f.app.store.db.prepare('SELECT session_hash,expires_at FROM customer_identity_sessions ORDER BY session_hash').all(),rowsBefore);
  assert.deepEqual((await first.request('/api/customer/computer-draft')).data.document,document);
  assert.equal((await first.request('/api/customer/computer-draft',{body:{baseRevision:0,document}})).status,409);
  assert.equal((await first.request('/api/customer/computer-draft/delete',{body:{baseRevision:1}})).data.status,'deleted');
  assert.equal((await first.request('/api/customer/computer-draft',{body:{baseRevision:1,document}})).status,409);
  assert.equal((await other.request('/api/customer/computer-draft')).data.status,'empty');
  assert.equal((await other.request('/api/customer/me')).data.user.id,'synk:'+secondId);
});

test('browser raw-text draft saves over HTTP and restores after restart without inventing confirmed conditions',async t=>{
  const state=()=>createCustomerComputerState({createInterpretation:createComputerInterpretation,createConsultation:createComputerConsultation,Interpretation,Ask,content,rules});
  const f=await fixture(t,{ai:false}),client=f.client(),browser=state();await client.login();
  const raw='컴퓨터를 알아보는 중이에요. 아직 용도는 고르지 않았어요.';
  browser.text(raw);const original=browser.serialize();
  assert.deepEqual(original,{version:1,text:raw,answers:{uses:[]}});
  const saved=await client.request('/api/customer/computer-draft',{body:{baseRevision:0,document:original}});
  assert.equal(saved.status,200);assert.equal(saved.data.revision,1);assert.deepEqual(saved.data.document,original);
  const cookie=client.jar.get('synk_customer_session'),csrf=client.csrf;await f.restart();
  const reloaded=await client.request('/api/customer/computer-draft'),secondDevice=state();
  assert.equal(reloaded.status,200);assert.equal(reloaded.data.revision,1);secondDevice.restore(reloaded.data.document);
  assert.equal(client.jar.get('synk_customer_session'),cookie);assert.equal((await client.request('/api/customer/me')).data.csrfToken,csrf);
  assert.deepEqual(secondDevice.serialize(),original);assert.deepEqual(secondDevice.snapshot().source.manual,{});
  assert.equal(secondDevice.snapshot().result,null);assert.equal(secondDevice.snapshot().source.proposals.length,0);
  // Clearing a previously selected use must also remain saveable and unanswered.
  secondDevice.manual('uses',['web']);secondDevice.manual('uses',[]);
  const cleared=await client.request('/api/customer/computer-draft',{body:{baseRevision:1,document:secondDevice.serialize()}});
  assert.equal(cleared.status,200);assert.equal(cleared.data.revision,2);
  const thirdDevice=state();thirdDevice.restore(cleared.data.document);
  assert.deepEqual(thirdDevice.serialize(),original);assert.deepEqual(thirdDevice.snapshot().source.manual,{});
  for(const answers of [{uses:'web'},{uses:['invented']},{uses:['web','web']},{uses:[],localai:[]}]){
    assert.equal((await client.request('/api/customer/computer-draft',{body:{baseRevision:2,document:{...original,answers}}})).status,400);
  }
  assert.equal((await client.request('/api/customer/computer-draft')).data.revision,2);
  assert.equal(f.providerCalls.length,0);
});

test('customer CSRF, Origin, strict body and body size gates run before writes or provider dispatch',async t=>{
  const f=await fixture(t),client=f.client();await client.login();
  for(const headers of [{'X-CSRF-Token':'wrong'},{Origin:'https://attacker.example.test'}]){
    assert.equal((await client.request('/api/customer/computer-draft',{body:{baseRevision:0,document},headers})).status,403);
    assert.equal((await client.request(endpoint,{body:input(),headers})).status,403);
  }
  assert.equal((await client.request('/api/customer/synk-id/start',{body:{next:'https://attacker.example.test'}})).status,400);
  assert.equal((await client.request('/api/customer/computer-draft',{body:{baseRevision:0,document:{...document,text:'x'.repeat(33000)}}})).status,413);
  assert.equal((await client.request('/api/customer/computer-draft?owner=someone')).status,400);
  assert.equal(f.app.store.all('customerComputerDrafts').length,0);assert.equal(f.providerCalls.length,0);
});

test('central revocation before a request prevents draft access and paid dispatch',async t=>{
  const f=await fixture(t),client=f.client();await client.login();f.centralStatus=401;
  assert.equal((await client.request(endpoint,{body:input()})).status,401);
  assert.equal((await client.request('/api/customer/computer-draft')).status,401);
  assert.equal((await client.request('/api/customer/me')).data.authenticated,false);assert.equal(f.providerCalls.length,0);
});

test('central revocation while a POST body is pending is checked before draft writes or paid dispatch',async t=>{
  for(const path of [endpoint,'/api/customer/computer-draft']){
    const f=await fixture(t),client=f.client();await client.login();
    const pending=await f.slowBody(client,path,path===endpoint?input():{baseRevision:0,document});f.centralStatus=401;pending.finish();
    assert.equal((await pending.response).status,401);assert.equal(f.providerCalls.length,0);assert.equal(f.app.store.all('customerComputerDrafts').length,0);
  }
});

test('logout while a POST body is pending prevents later writes and does not restore the session',async t=>{
  const f=await fixture(t),client=f.client();await client.login();
  const pending=await f.slowBody(client,'/api/customer/computer-draft',{baseRevision:0,document});
  assert.equal((await client.request('/api/customer/logout',{body:{}})).status,200);pending.finish();
  assert.equal((await pending.response).status,401);assert.equal(f.app.store.all('customerComputerDrafts').length,0);assert.equal((await client.request('/api/customer/me')).data.authenticated,false);
});

test('refresh rotation during a slow request preserves the same customer without duplicate provider dispatch',async t=>{
  const f=await fixture(t),client=f.client();await client.login();
  const pending=await f.slowBody(client,endpoint,input());f.stamp+=3590_000;pending.finish();
  assert.equal((await pending.response).status,200);assert.equal(f.refreshCount,1);assert.equal(f.providerCalls.length,1);
  const me=await client.request('/api/customer/me');assert.equal(me.data.user.id,'synk:'+firstId);assert.equal(me.data.ai.usage.requestsUsed,1);
});

test('provider response is withheld after concurrent customer logout while incurred cost stays recorded',async t=>{
  const gate=defer(),entered=defer(),f=await fixture(t,{provider:async()=>{entered.resolve();await gate.promise;return providerResponse();}}),client=f.client();await client.login();
  const pending=client.request(endpoint,{body:input()});await entered.promise;
  assert.equal((await client.request('/api/customer/logout',{body:{}})).status,200);gate.resolve();
  const result=await pending;assert.equal(result.status,401);assert.equal(result.data.proposals,undefined);assert.equal(f.providerCalls.length,1);
  const row=f.app.store.all('computerAIRequests')[0];assert.equal(row.userId,'synk:'+firstId);assert.equal(row.status,'completed');assert.ok(row.accountedMicroUSD>0);
});

test('provider response is withheld after remote account revocation during inference',async t=>{
  const gate=defer(),entered=defer(),f=await fixture(t,{provider:async()=>{entered.resolve();await gate.promise;return providerResponse();}}),client=f.client();await client.login();
  const pending=client.request(endpoint,{body:input()});await entered.promise;f.centralStatus=401;gate.resolve();
  const result=await pending;assert.equal(result.status,401);assert.equal(result.data.proposals,undefined);assert.equal((await client.request('/api/customer/me')).data.authenticated,false);assert.equal(f.providerCalls.length,1);
});

test('provider outage blocks access but customer local logout still succeeds',async t=>{
  const f=await fixture(t),client=f.client();await client.login();f.centralStatus=503;
  assert.equal((await client.request('/api/customer/computer-draft')).status,503);
  const logout=await client.request('/api/customer/logout',{body:{}});assert.equal(logout.status,200);assert.equal(logout.data.localSignedOut,true);assert.equal(client.jar.has('synk_customer_session'),false);
  assert.equal((await client.request('/api/customer/me')).data.authenticated,false);assert.equal(f.providerCalls.length,0);
});

test('customer quota persists through response deletion and reauthentication while other customers stay independent',async t=>{
  const f=await fixture(t),first=f.client(),other=f.client();await first.login();
  assert.equal((await first.request(endpoint,{body:input()})).status,200);assert.equal((await first.request(endpoint,{body:input()})).status,200);
  assert.equal((await first.request(endpoint+'/delete',{body:{}})).status,200);await first.request('/api/customer/logout',{body:{}});await first.login();
  assert.equal((await first.request(endpoint,{body:input()})).status,429);
  await other.login(secondId);assert.equal((await other.request(endpoint,{body:input()})).status,200);assert.equal(f.providerCalls.length,3);
  const rows=f.app.store.all('computerAIRequests');assert.equal(rows.filter(row=>row.userId==='synk:'+firstId).length,2);assert.equal(rows.filter(row=>row.userId==='synk:'+secondId).length,1);
});

test('restored customer sessions recheck central identity on every request and preserve recovery from an outage',async t=>{
  const f=await fixture(t),client=f.client();await client.login();
  await client.request('/api/customer/computer-draft',{body:{baseRevision:0,document}});
  const cookie=client.jar.get('synk_customer_session'),csrf=client.csrf;
  const checks=()=>f.centralCalls.filter(call=>call.url===config.accountApiUrl&&(call.method||'GET')==='GET').length;
  await f.restart();f.centralStatus=503;
  for(const path of ['/api/customer/me','/api/customer/computer-draft'])assert.equal((await client.request(path)).status,503);
  assert.equal((await client.request(endpoint,{body:input()})).status,503);assert.equal(f.providerCalls.length,0);
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM customer_identity_sessions').get().n,1);
  await f.restart();assert.equal((await client.request('/api/customer/me')).status,503);
  f.centralStatus=200;
  const before=checks(),restored=await client.request('/api/customer/me');assert.equal(restored.data.authenticated,true);assert.equal(checks(),before+1);
  assert.equal(restored.data.csrfToken,csrf);assert.equal(client.jar.get('synk_customer_session'),cookie);
  assert.deepEqual((await client.request('/api/customer/computer-draft')).data.document,document);assert.equal(checks(),before+2);
  assert.equal((await client.request('/api/customer/computer-interpretation')).status,200);assert.equal(checks(),before+3);
  assert.equal(f.providerCalls.length,0);
});

test('central rejection after restart removes the persisted customer session without revival',async t=>{
  for(const mode of ['revoked','suspended'])await t.test(mode,async t=>{
    const f=await fixture(t),client=f.client();await client.login();const cookie=client.jar.get('synk_customer_session');
    await f.restart();if(mode==='revoked')f.centralStatus=401;else f.active=false;
    assert.equal((await client.request('/api/customer/me')).data.authenticated,false);
    assert.equal((await client.request('/api/customer/computer-draft')).status,401);
    assert.equal((await client.request(endpoint,{body:input()})).status,401);
    assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM customer_identity_sessions').get().n,0);
    f.centralStatus=200;f.active=true;await f.restart();client.jar.set('synk_customer_session',cookie);
    const before=f.centralCalls.length;assert.equal((await client.request('/api/customer/me')).data.authenticated,false);assert.equal(f.centralCalls.length,before);
    assert.equal(f.providerCalls.length,0);
  });
});

test('restart and refreshed access do not extend the original eight-hour customer session',async t=>{
  const f=await fixture(t),client=f.client();await client.login();
  const cookie=client.jar.get('synk_customer_session'),csrf=client.csrf,expiry=f.app.store.db.prepare('SELECT expires_at FROM customer_identity_sessions').get().expires_at;
  f.stamp+=8*3600_000-60_000;await f.restart();
  const restored=await client.request('/api/customer/me');assert.equal(restored.data.authenticated,true);assert.equal(restored.data.csrfToken,csrf);assert.equal(f.refreshCount,1);
  assert.equal(client.jar.get('synk_customer_session'),cookie);assert.equal(f.app.store.db.prepare('SELECT expires_at FROM customer_identity_sessions').get().expires_at,expiry);
  f.stamp+=60_000;const before=f.centralCalls.length;await f.restart();
  assert.equal((await client.request('/api/customer/me')).data.authenticated,false);assert.equal((await client.request('/api/customer/computer-draft')).status,401);
  assert.equal(f.centralCalls.length,before);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM customer_identity_sessions').get().n,0);
  assert.equal(f.providerCalls.length,0);
});

test('restored customer sessions retain quota and never become employee sessions',async t=>{
  const f=await fixture(t),first=f.client(),other=f.client(),staff=f.client();await first.login();await other.login(secondId);
  staff.jar.set('synk_company_session',f.staffToken);staff.csrf='synthetic-staff-csrf';
  assert.equal((await first.request(endpoint,{body:input()})).status,200);assert.equal((await first.request(endpoint,{body:input()})).status,200);
  const users=f.app.store.all('users'),tokens=f.app.store.db.prepare('SELECT * FROM tokens ORDER BY hash').all();
  await f.restart();
  assert.equal((await first.request('/api/me')).data.user,null);assert.equal((await first.request('/api/bootstrap')).status,401);
  assert.equal((await first.request('/messenger/api/bootstrap')).status,401);assert.equal((await first.request('/api/computer-interpretation',{body:input()})).status,403);
  assert.equal((await staff.request('/api/customer/me')).data.authenticated,false);assert.equal((await staff.request('/api/customer/computer-draft')).status,401);
  assert.equal((await staff.request('/api/me')).data.user.id,f.staff.id);
  assert.equal((await first.request('/api/customer/me')).data.ai.usage.requestsUsed,2);assert.equal((await first.request(endpoint,{body:input()})).status,429);
  assert.equal((await other.request('/api/customer/me')).data.ai.usage.requestsUsed,0);assert.equal((await other.request(endpoint,{body:input()})).status,200);
  assert.equal(f.providerCalls.length,3);assert.deepEqual(f.app.store.all('users'),users);assert.deepEqual(f.app.store.db.prepare('SELECT * FROM tokens ORDER BY hash').all(),tokens);
});

test('logout after restart removes persisted credentials even while identity checks are unavailable',async t=>{
  const f=await fixture(t),client=f.client();await client.login();const cookie=client.jar.get('synk_customer_session');
  await f.restart();f.centralStatus=503;
  assert.equal((await client.request('/api/customer/me')).status,503);
  assert.equal((await client.request('/api/customer/logout',{body:{},headers:{'X-CSRF-Token':'wrong'}})).status,403);
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM customer_identity_sessions').get().n,1);
  const logout=await client.request('/api/customer/logout',{body:{}});assert.equal(logout.status,200);assert.equal(logout.data.localSignedOut,true);
  assert.equal(client.jar.has('synk_customer_session'),false);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM customer_identity_sessions').get().n,0);
  await f.restart();f.centralStatus=200;client.jar.set('synk_customer_session',cookie);
  assert.equal((await client.request('/api/customer/me')).data.authenticated,false);assert.equal(f.providerCalls.length,0);
});

test('graceful shutdown drains a customer refresh and the next process uses the rotated credential',async t=>{
  const f=await fixture(t),client=f.client();await client.login();const cookie=client.jar.get('synk_customer_session'),csrf=client.csrf;
  const gate={entered:defer(),release:defer()};f.nextRefresh=gate;t.after(()=>gate.release.resolve());
  f.stamp+=3590_000;const request=client.request('/api/customer/me');await gate.entered.promise;
  const stopping=f.app.stop();gate.release.resolve();await request;await stopping;await f.restart();
  const restored=await client.request('/api/customer/me');assert.equal(restored.data.authenticated,true);assert.equal(restored.data.csrfToken,csrf);
  assert.equal(client.jar.get('synk_customer_session'),cookie);assert.equal(f.refreshCount,1);
  f.stamp+=3590_000;assert.equal((await client.request('/api/customer/me')).data.authenticated,true);assert.equal(f.refreshCount,2);
  const refreshes=f.centralCalls.filter(call=>call.url.endsWith('/oauth/token')&&new URLSearchParams(call.body).get('grant_type')==='refresh_token');
  assert.deepEqual(refreshes.map(call=>new URLSearchParams(call.body).get('refresh_token')),['synthetic-refresh:'+firstId+':0','synthetic-refresh:'+firstId+':1']);
  assert.equal(f.providerCalls.length,0);
});

test('customer logout body completed during shutdown deletes the persistent session before Store closes',async t=>{
  const f=await fixture(t),client=f.client();await client.login();const cookie=client.jar.get('synk_customer_session');
  const accepted=new Promise(resolve=>f.app.server.once('request',resolve));let req;
  const response=new Promise((resolve,reject)=>{
    req=http.request(f.base+'/api/customer/logout',{method:'POST',headers:{Cookie:client.cookie(),Origin:origin,'X-CSRF-Token':client.csrf,'Content-Type':'application/json','Content-Length':2}},res=>{
      let raw='';res.setEncoding('utf8');res.on('data',part=>raw+=part);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(raw)}));
    });req.on('error',reject);req.write('{');
  });
  await accepted;const stopping=f.app.stop();req.end('}');
  const ended=await response;assert.equal(ended.status,200);assert.equal(ended.data.localSignedOut,true);assert.equal(ended.data.serverRevoked,true);
  await stopping;await f.restart();client.jar.set('synk_customer_session',cookie);
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM customer_identity_sessions').get().n,0);
  assert.equal((await client.request('/api/customer/me')).data.authenticated,false);assert.equal((await client.request('/api/customer/computer-draft')).status,401);
  assert.equal(f.providerCalls.length,0);
});
