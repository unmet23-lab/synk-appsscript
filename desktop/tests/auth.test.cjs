'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {configuration}=require('../src/auth-config.cjs'),{createTokenStore}=require('../src/auth-store.cjs'),{createAuthService}=require('../src/auth-service.cjs'),{requestSpec}=require('../src/account-requests.cjs'),{trustedEntry,assertSender}=require('../src/security.cjs'),{createCompanyRequests}=require('../src/company-requests.cjs');
async function waitFor(fn){for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}assert.fail('Timed out waiting for synthetic auth state');}
async function listen(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return server.address().port;}
const close=server=>new Promise(r=>{server.closeAllConnections();server.close(r);});
const secure={isEncryptionAvailable:()=>true,encryptString:text=>{const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.alloc(32,7),Buffer.alloc(12,9));return Buffer.concat([cipher.update(text),cipher.final(),cipher.getAuthTag()]);},decryptString:data=>{const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.alloc(32,7),Buffer.alloc(12,9));decipher.setAuthTag(data.subarray(-16));return Buffer.concat([decipher.update(data.subarray(0,-16)),decipher.final()]).toString();}};
async function fixture(t,{product='platform',secureStorage=secure,openFail=false}={}){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'synk-auth-test-'));const portProbe=http.createServer(),callbackPort=await listen(portProbe);await close(portProbe);
  let opened,clock=1000000,serial=0,codeCount=0,refreshCount=0,logoutCount=0,delayToken=null,tokenStatus=200,wrongSubject=false,accountStatus=200,userStatus=200,nonJson=false,accountPayload={account:{synk_user_id:'stable-synthetic-id',status:'active',profile:{display_name:'합성 계정'}},memberships:[],entitlements:[]};const requests=[],codes=new Map(),active=new Set(),userResponses=[],accountResponses=[],classroomResponses=[],fortuneResponses=[],careResponses=[],personalResponses=[],playResponses=[];
  const server=http.createServer(async(req,res)=>{
    const u=new URL(req.url,'http://127.0.0.1');let body='';for await(const chunk of req)body+=chunk;
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};requests.push({path:u.pathname,query:Object.fromEntries(u.searchParams),method:req.method,headers:req.headers,body});
    if(u.pathname==='/auth/v1/oauth/authorize'){const code='synthetic-code-'+codes.size;codes.set(code,{challenge:u.searchParams.get('code_challenge'),client:u.searchParams.get('client_id'),redirect:u.searchParams.get('redirect_uri')});const target=new URL(u.searchParams.get('redirect_uri'));target.search=new URLSearchParams({code,state:u.searchParams.get('state')});res.writeHead(302,{Location:target.href});res.end();return;}
    if(u.pathname==='/auth/v1/oauth/token'){
      const values=new URLSearchParams(body);if(values.get('grant_type')==='authorization_code'){codeCount++;const stored=codes.get(values.get('code'));if(!stored||stored.challenge!==crypto.createHash('sha256').update(values.get('code_verifier')).digest('base64url')||stored.client!==values.get('client_id')||stored.redirect!==values.get('redirect_uri'))return reply(400,{error:'invalid_grant'});codes.delete(values.get('code'));}else{refreshCount++;if(!active.has(values.get('refresh_token')))return reply(400,{error:'invalid_grant'});active.delete(values.get('refresh_token'));}
      if(delayToken)await delayToken;if(tokenStatus!==200)return reply(tokenStatus,{error:'synthetic_failure'});serial++;active.add('synthetic-refresh-'+serial);reply(200,{token_type:'bearer',access_token:'synthetic-access-'+serial,refresh_token:'synthetic-refresh-'+serial,expires_in:3600});return;
    }
    if(u.pathname==='/auth/v1/user'){const queued=userResponses.shift();if(queued){await queued.wait;return reply(queued.status??200,queued.data??{id:'synthetic-auth-user'});}if(nonJson&&userStatus!==200){res.writeHead(userStatus);res.end('<html>Temporary unavailable</html>');return;}return reply(userStatus,{id:wrongSubject?'different-user':'synthetic-auth-user'});}
    if(u.pathname==='/auth/v1/logout'){logoutCount++;active.clear();res.writeHead(204);res.end();return;}
    if(u.pathname==='/functions/v1/synk-account'){
      if(nonJson&&accountStatus!==200){res.writeHead(accountStatus);res.end('<html>Temporary unavailable</html>');return;}
      if(body&&JSON.parse(body).action==='revoke-session')return reply(200,{ok:true,current:true});
      const queued=accountResponses.shift();if(queued){await queued.wait;if(queued.disconnect){res.destroy();return;}return reply(queued.status??200,queued.data);}
      return reply(accountStatus,accountStatus===200?{ok:true,...accountPayload,sessions:[{id:'00000000-0000-4000-8000-000000000001',current:true,revoked:false}],access_token:'must-be-redacted'}:{ok:false,error:{code:accountStatus===503?'UNAVAILABLE':'SESSION_REVOKED'}});
    }
    if(u.pathname==='/functions/v1/synk-learning')return reply(200,{ok:true,events:[],cursor:0,revision:1});
    if(u.pathname==='/functions/v1/synk-play'){const queued=playResponses.shift();if(queued){await queued.wait;return reply(queued.status??200,queued.data);}return reply(200,{ok:true,scope:'synk-play',accountId:accountPayload.account.synk_user_id,revision:0,state:{wallet:{version:1},records:{},imported:false},nested:{access_token:'must-not-reach-renderer',refresh_token:'must-not-reach-renderer'}});}
    if(u.pathname==='/functions/v1/synk-care'){const queued=careResponses.shift();if(queued){await queued.wait;return reply(queued.status??200,queued.data);}return reply(200,{ok:true,scope:'synk-care',accountId:accountPayload.account.synk_user_id,revision:0,updatedAt:null,state:null,nested:{access_token:'must-not-reach-renderer',refresh_token:'must-not-reach-renderer'}});}
    if(u.pathname==='/functions/v1/synk-personal'){const queued=personalResponses.shift();if(queued){await queued.wait;return reply(queued.status??200,queued.data);}return reply(200,{ok:true,scope:'synk-personal',resource:product,accountId:accountPayload.account.synk_user_id,revision:0,updatedAt:null,state:null,nested:{access_token:'must-not-reach-renderer',refresh_token:'must-not-reach-renderer'}});}
    if(u.pathname==='/functions/v1/synk-fortune'){const queued=fortuneResponses.shift();if(queued){await queued.wait;return reply(queued.status??200,queued.data);}return reply(200,{ok:true,account:{synk_user_id:'stable-synthetic-id'},revision:0,state:{version:1,profile:null,preferences:{mode:'western',signId:null},entries:[]},nested:{access_token:'must-not-reach-renderer',refresh_token:'must-not-reach-renderer'}});}
    if(u.pathname.startsWith('/functions/v1/synk-classroom/api/')){const queued=classroomResponses.shift();if(queued){await queued.wait;return reply(queued.status??200,queued.data);}return reply(200,{ok:true,classes:[],nested:{access_token:'must-not-reach-renderer',refresh_token:'must-not-reach-renderer'}});}
    reply(404,{ok:false});
  });
  const serverPort=await listen(server),origin='http://127.0.0.1:'+serverPort,raw={version:1,supabaseUrl:origin,accountApiUrl:origin,supabasePublishableKey:'sb_publishable_synthetic',clients:{[product]:{clientId:'synthetic-client-'+product,redirectUri:`http://127.0.0.1:${callbackPort}/synk/oauth/${product}/callback`}}};
  const config=configuration(raw,product,'development');const store=()=>createTokenStore({directory,safeStorage:secureStorage,scope:product,configFingerprint:config.fingerprint,platform:'win32'});const services=[];
  const create=()=>{const service=createAuthService({config,store:store(),now:()=>clock,openExternal:async url=>{if(openFail)throw Error('SYNTHETIC_OPEN_FAILED');opened=url;},timeoutMs:3000});services.push(service);return service;};
  const service=create();t.after(async()=>{for(const s of services)s.dispose();await close(server);await fs.rm(directory,{recursive:true,force:true});});
  return {service,create,store,config,raw,directory,requests,get opened(){return opened;},get codeCount(){return codeCount;},get refreshCount(){return refreshCount;},get logoutCount(){return logoutCount;},setClock:value=>{clock=value;},delay:promise=>{delayToken=promise;},tokenStatus:value=>{tokenStatus=value;},wrongSubject:()=>{wrongSubject=true;},accountStatus:value=>{accountStatus=value;},accountPayload:value=>{accountPayload={...accountPayload,...value};},queueUser:value=>userResponses.push(value),queueAccount:value=>accountResponses.push(value),queueClassroom:value=>classroomResponses.push(value),queueFortune:value=>fortuneResponses.push(value),queueCare:value=>careResponses.push(value),queuePersonal:value=>personalResponses.push(value),queuePlay:value=>playResponses.push(value),userStatus:value=>{userStatus=value;},nonJson:()=>{nonJson=true;},async login(){await service.initialize();await service.signIn();const response=await fetch(opened);assert.equal(response.status,200);await waitFor(()=>service.status().signedIn);}};
}

test('platform account expectation reuses verified matching identity and blocks another account before API access',async t=>{
  const f=await fixture(t,{product:'messenger'});f.service.bindPlatform({status:'signed-in',accountId:'stable-synthetic-id',generation:'platform:1'});await f.login();
  assert.equal(f.service.status().account.synk_user_id,'stable-synthetic-id');
  f.service.bindPlatform({status:'signed-in',accountId:'different-platform-id',generation:'platform:2'});
  assert.equal(f.service.status().signedIn,false);assert.equal(f.service.status().account,null);
  const count=f.requests.length;await assert.rejects(f.service.getAccessToken(),{code:'AUTH_CHANGED'});assert.equal(f.requests.length,count);
});
test('fresh OAuth cannot expose a browser account different from the platform expectation',async t=>{
  const f=await fixture(t,{product:'world'});f.service.bindPlatform({status:'signed-in',accountId:'another-account',generation:'platform:1'});
  await f.service.initialize();await f.service.signIn();assert.equal((await fetch(f.opened)).status,200);await waitFor(()=>f.service.status().error);
  assert.equal(f.service.status().signedIn,false);assert.equal(f.service.status().account,null);
  for(let n=0;n<100&&await f.store().load();n++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(await f.store().load(),null);
});

test('temporary metadata failure preserves pending OAuth and completes its original callback',async t=>{
  const {createSuiteFollower}=require('../src/suite-session.cjs'),f=await fixture(t,{product:'messenger'});
  let record={status:'signed-in',accountId:'stable-synthetic-id',generation:'platform:1',updatedAt:1000};
  const follower=createSuiteFollower({store:{read:()=>record},auth:f.service,now:()=>1000,schedule:()=>1,unschedule(){}});t.after(()=>follower.dispose());
  await follower.start();const first=f.opened;assert.equal(f.service.status().status,'signing-in');
  record={...record,status:'checking',accountId:null};await follower.refresh();assert.equal(f.service.status().signedIn,false);
  record={...record,status:'signed-in',accountId:'stable-synthetic-id'};await follower.refresh();assert.equal(f.opened,first);
  assert.equal((await fetch(f.opened)).status,200);await waitFor(()=>f.service.status().signedIn);assert.equal(f.codeCount,1);
});

test('platform exit retains verified app access; unreadable selection masks it without clearing its vault',async t=>{
  const {createSuiteFollower}=require('../src/suite-session.cjs'),f=await fixture(t,{product:'world'});await f.login();
  let unavailable=false;const record={status:'signed-in',accountId:'stable-synthetic-id',generation:'platform:1',updatedAt:1000};
  const follower=createSuiteFollower({store:{read:()=>{if(unavailable)throw Error('temporary storage failure');return record;}},auth:f.service,schedule:()=>1,unschedule(){}});t.after(()=>follower.dispose());
  await follower.start();assert.equal(f.service.status().signedIn,true);const saved=await f.store().load();
  await follower.refresh();assert.equal(await f.service.getAccessToken(),'synthetic-access-1');
  unavailable=true;await follower.refresh();assert.equal(f.service.status().signedIn,false);await assert.rejects(f.service.getAccessToken(),{code:'AUTH_SERVER_UNAVAILABLE'});assert.deepEqual(await f.store().load(),saved);
  unavailable=false;await follower.refresh();assert.equal(f.service.status().signedIn,true);assert.equal(f.codeCount,1);
});
test('platform logout fences an in-flight account response and prevents another OAuth prompt',async t=>{
  const f=await fixture(t);f.service.bindPlatform({status:'signed-in',accountId:'stable-synthetic-id',generation:'platform:1'});await f.login();let release;
  f.queueAccount({wait:new Promise(resolve=>{release=resolve;}),data:{ok:true,account:{synk_user_id:'stable-synthetic-id',profile:{display_name:'old private name'}},memberships:[],entitlements:[]}});
  const count=f.requests.length,pending=f.service.accountRequest('load');await waitFor(()=>f.requests.length>count);
  f.service.bindPlatform({status:'signed-out',generation:'platform:2'});release();const result=await pending;
  assert.equal(result.ok,false);assert.equal(result.account,undefined);assert.equal(f.service.status().signedIn,false);assert.equal(f.service.status().account,null);
  await assert.rejects(f.service.signIn(),{code:'PLATFORM_AUTH_REQUIRED'});
});

test('platform refresh and exit do not interrupt a child refresh-token rotation or reopen OAuth',async t=>{
  const {suiteKey,createSuitePublisher,createSuiteFollower}=require('../src/suite-session.cjs'),f=await fixture(t,{product:'world'});await f.login();
  let saved=null;const publisher=createSuitePublisher({store:{read:()=>saved,write:value=>{saved=value;}},key:suiteKey(f.config,'development')});
  publisher.publish(f.service.status());const follower=createSuiteFollower({store:{read:()=>saved},auth:f.service,schedule:()=>1,unschedule(){}});t.after(()=>{publisher.dispose();follower.dispose();});await follower.start();
  let release;f.delay(new Promise(resolve=>{release=resolve;}));f.setClock(4_600_001);const refreshed=f.service.getAccessToken();await waitFor(()=>f.refreshCount===1);
  publisher.publish({status:'restoring',signedIn:false,sessionGeneration:1});await follower.refresh();publisher.dispose();await follower.refresh();release();
  assert.equal(await refreshed,'synthetic-access-2');assert.equal(f.service.status().signedIn,true);assert.equal(f.codeCount,1);assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-2');
});

test('temporary metadata read failure does not discard an already rotated refresh token',async t=>{
  const {createSuiteFollower}=require('../src/suite-session.cjs'),f=await fixture(t,{product:'world'});await f.login();
  let unreadable=false;const chosen={status:'signed-in',accountId:'stable-synthetic-id',generation:'platform:1'};
  const follower=createSuiteFollower({store:{read:()=>{if(unreadable)throw Error('temporary read failure');return chosen;}},auth:f.service,schedule:()=>1,unschedule(){}});t.after(()=>follower.dispose());await follower.start();
  let release;f.delay(new Promise(resolve=>{release=resolve;}));f.setClock(4_600_001);const refreshing=f.service.getAccessToken();const rejected=assert.rejects(refreshing,error=>error.retryable===true);await waitFor(()=>f.refreshCount===1);
  unreadable=true;await follower.refresh();release();await rejected;
  assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-2');assert.equal(f.service.status().signedIn,false);
  unreadable=false;await follower.refresh();assert.equal(await f.service.getAccessToken(),'synthetic-access-2');assert.equal(f.codeCount,1);assert.equal(f.refreshCount,1);
});
test('platform temporary verification hides identity but restores the same app session without a fresh OAuth grant',async t=>{
  const f=await fixture(t);f.service.bindPlatform({status:'signed-in',accountId:'stable-synthetic-id',generation:'platform:1'});await f.login();const codeCount=f.codeCount;
  f.service.bindPlatform({status:'checking',generation:'platform:1'});assert.equal(f.service.status().account,null);await assert.rejects(f.service.getAccessToken(),{code:'AUTH_SERVER_UNAVAILABLE'});
  f.service.bindPlatform({status:'signed-in',accountId:'stable-synthetic-id',generation:'platform:1'});assert.equal(f.service.status().signedIn,true);assert.equal((await f.service.accountRequest('load')).ok,true);assert.equal(f.codeCount,codeCount);
});
test('personal apps reuse real PKCE, main-held tokens and fixed per-client data resources',async t=>{
  for(const product of ['path','rehearsal','family-album']){
    const f=await fixture(t,{product});await f.login();assert.equal(f.config.product,'platform');assert.equal(f.config.clientKey,product);
    const loaded=await f.service.accountRequest('personalLoad');assert.equal(loaded.ok,true);assert.deepEqual(loaded.nested,{});
    assert.equal((await f.service.accountRequest('personalSave',{expected_revision:0,state:{version:1}})).ok,true);
    assert.equal((await f.service.accountRequest('personalDelete',{expected_revision:1})).ok,true);
    const calls=f.requests.filter(call=>call.path==='/functions/v1/synk-personal');assert.deepEqual(calls[0].query,{resource:product});assert.equal(JSON.parse(calls[1].body).resource,product);
    for(const call of calls){assert.equal(call.headers.authorization,'Bearer synthetic-access-1');assert.equal(call.headers['x-synk-product'],'platform');}
    for(const operation of ['setLearning','careLoad','fortuneGet','classroom','revokeAll'])assert.equal((await f.service.accountRequest(operation,{})).error.code,'INVALID_REQUEST');
    assert.equal((await f.service.accountRequest('personalLoad',{resource:'care'})).error.code,'INVALID_REQUEST');
    assert.doesNotMatch(JSON.stringify({loaded,status:f.service.status()}),/synthetic-access|synthetic-refresh|must-not-reach-renderer/);
  }
});

test('personal transport rotates once, preserves CAS and rejects wrong resource or account responses',async t=>{
  const f=await fixture(t,{product:'path'});await f.login();f.queuePersonal({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});
  assert.equal((await f.service.accountRequest('personalLoad')).ok,true);assert.equal(f.refreshCount,1);
  f.queuePersonal({status:409,data:{ok:false,error:{code:'REVISION_CONFLICT'},revision:8}});const conflict=await f.service.accountRequest('personalDelete',{expected_revision:0});assert.equal(conflict.revision,8);assert.equal(conflict.error.status,409);
  for(const patch of [{resource:'family-album'},{accountId:'someone-else'}]){
    if(!f.service.status().signedIn)await f.login();f.queuePersonal({data:{ok:true,scope:'synk-personal',resource:'path',accountId:'stable-synthetic-id',revision:0,state:null,...patch}});
    assert.equal((await f.service.accountRequest('personalLoad')).ok,false);assert.equal(f.service.status().signedIn,false);
  }
});

test('native personal API preserves only a missing original UUID for targeted retry',async t=>{
  const f=await fixture(t,{product:'family-album'});await f.login();const assetId='22222222-2222-4222-8222-222222222222';
  for(const [code,id,expected] of [['ASSET_NOT_FOUND',assetId,assetId],['ASSET_NOT_CONFIRMED',assetId,assetId],['ASSET_NOT_FOUND','private/not-an-id',undefined],['MEDIA_QUOTA_EXCEEDED',assetId,undefined]]){
    f.queuePersonal({status:404,data:{ok:false,error:{code,assetId:id,details:'private provider details'}}});
    const result=await f.service.accountRequest('personalSave',{expected_revision:0,state:{version:1}});
    assert.equal(result.error.code,code);assert.equal(result.error.assetId,expected);assert.equal(result.error.details,undefined);
  }
});

test('logout fences a delayed personal document before it reaches the renderer',async t=>{
  const f=await fixture(t,{product:'rehearsal'});await f.login();let release;
  f.queuePersonal({wait:new Promise(resolve=>{release=resolve;}),data:{ok:true,scope:'synk-personal',resource:'rehearsal',accountId:'stable-synthetic-id',revision:0,state:{private:'previous account'}}});
  const pending=f.service.accountRequest('personalLoad');await waitFor(()=>f.requests.some(call=>call.path==='/functions/v1/synk-personal'));await f.service.signOut();release();
  const response=await pending;assert.equal(response.ok,false);assert.equal(response.state,undefined);
});

test('care uses canonical PKCE and main-only credentials for its fixed account state route',async t=>{
  const f=await fixture(t,{product:'care'}),state={version:1,people:[],events:[],drafts:[],completions:[]};
  assert.equal((await f.service.accountRequest('careLoad')).error.code,'AUTH_REQUIRED');
  await f.login();assert.equal(f.config.product,'platform');assert.equal(f.config.clientKey,'care');
  const result=await f.service.accountRequest('careLoad');assert.equal(result.ok,true);assert.deepEqual(result.nested,{});
  assert.equal((await f.service.accountRequest('careSave',{expected_revision:0,state})).ok,true);
  assert.equal((await f.service.accountRequest('careDelete',{expected_revision:1})).ok,true);
  const calls=f.requests.filter(request=>request.path==='/functions/v1/synk-care');assert.equal(calls.length,3);
  assert.deepEqual(JSON.parse(calls[1].body),{action:'save',expected_revision:0,state});
  assert.deepEqual(JSON.parse(calls[2].body),{action:'delete',expected_revision:1});
  for(const call of calls){assert.equal(call.headers.authorization,'Bearer synthetic-access-1');assert.equal(call.headers['x-synk-product'],'platform');assert.equal(call.headers['x-synk-contract'],'1');}
  for(const operation of ['requestDeletion','setLearning','memoryGet','classroom','fortuneGet','revokeAll'])assert.equal((await f.service.accountRequest(operation,{})).error.code,'INVALID_REQUEST');
  assert.doesNotMatch(JSON.stringify({status:f.service.status(),result}),/synthetic-access|synthetic-refresh|must-not-reach-renderer|code_verifier/);
});

test('care refresh retries once and preserves CAS conflicts without replacing account state',async t=>{
  const f=await fixture(t,{product:'care'});await f.login();f.queueCare({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});
  assert.equal((await f.service.accountRequest('careLoad')).ok,true);assert.equal(f.refreshCount,1);
  const calls=f.requests.filter(request=>request.path==='/functions/v1/synk-care');assert.equal(calls[0].headers.authorization,'Bearer synthetic-access-1');assert.equal(calls[1].headers.authorization,'Bearer synthetic-access-2');
  f.queueCare({status:409,data:{ok:false,error:{code:'REVISION_CONFLICT'},revision:8}});
  const conflict=await f.service.accountRequest('careDelete',{expected_revision:1});assert.equal(conflict.error.code,'REVISION_CONFLICT');assert.equal(conflict.error.status,409);assert.equal(conflict.revision,8);assert.equal(f.service.status().signedIn,true);
});

test('care cannot deliver a mismatched account response or finish a read after logout',async t=>{
  const f=await fixture(t,{product:'care'});await f.login();
  f.queueCare({data:{ok:true,scope:'synk-care',accountId:'another-account',revision:1,state:{private:'other owner'}}});
  const wrong=await f.service.accountRequest('careLoad');assert.equal(wrong.ok,false);assert.equal(wrong.state,undefined);assert.equal(f.service.status().signedIn,false);
  await f.login();let release;
  f.queueCare({wait:new Promise(resolve=>{release=resolve;}),data:{ok:true,scope:'synk-care',accountId:'stable-synthetic-id',revision:1,state:{private:'old account'}}});
  const pending=f.service.accountRequest('careLoad');await waitFor(()=>f.requests.filter(request=>request.path==='/functions/v1/synk-care').length===2);await f.service.signOut();release();
  const late=await pending;assert.equal(late.ok,false);assert.equal(late.state,undefined);assert.equal(f.service.status().signedIn,false);
});

test('fortune native OAuth owns its token while account storage uses the platform product and fixed routes',async t=>{
  const f=await fixture(t,{product:'fortune'});await f.login();
  assert.equal(f.config.clientKey,'fortune');assert.equal(f.config.product,'platform');assert.equal(new URL(f.opened).searchParams.get('client_id'),'synthetic-client-fortune');
  const state={version:1,profile:{birthDate:'2000-01-07',birthTime:null,calendar:'solar',timeZone:'Asia/Seoul'},preferences:{mode:'korean',signId:null},entries:[]};
  const read=await f.service.accountRequest('fortuneGet',{});assert.equal(read.ok,true);assert.deepEqual(read.nested,{});
  assert.equal((await f.service.accountRequest('fortunePut',{expected_revision:0,state})).ok,true);
  assert.equal((await f.service.accountRequest('fortuneDelete',{expected_revision:1})).ok,true);
  const requests=f.requests.filter(row=>row.path==='/functions/v1/synk-fortune');assert.equal(requests.length,3);
  assert.deepEqual(requests.map(row=>row.method),['GET','POST','POST']);assert.deepEqual(JSON.parse(requests[1].body),{action:'save',expected_revision:0,state});assert.deepEqual(JSON.parse(requests[2].body),{action:'delete',expected_revision:1});
  for(const row of requests){assert.equal(row.headers['x-synk-product'],'platform');assert.equal(row.headers.authorization,'Bearer synthetic-access-1');}
  assert.doesNotMatch(JSON.stringify(f.service.status()),/synthetic-access|synthetic-refresh/);
});

test('fortune account transport refreshes once, keeps revision conflicts and fences a response after logout',async t=>{
  const f=await fixture(t,{product:'fortune'});await f.login();f.queueFortune({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});
  assert.equal((await f.service.accountRequest('fortuneGet')).ok,true);assert.equal(f.refreshCount,1);
  f.queueFortune({status:409,data:{ok:false,error:{code:'REVISION_CONFLICT'},revision:8}});
  const conflict=await f.service.accountRequest('fortuneDelete',{expected_revision:0});assert.equal(conflict.error.code,'REVISION_CONFLICT');assert.equal(conflict.revision,8);
  let release;f.queueFortune({wait:new Promise(resolve=>{release=resolve;}),data:{ok:true,state:{private:'prior account'}}});
  const waiting=f.service.accountRequest('fortuneGet');await waitFor(()=>f.requests.filter(row=>row.path==='/functions/v1/synk-fortune').length===4);await f.service.signOut();release();
  const result=await waiting;assert.equal(result.ok,false);assert.equal(result.state,undefined);assert.equal(f.service.status().signedIn,false);
});

test('classroom requests use main credentials, product identity and class URL without exposing tokens',async t=>{
  for(const product of ['world','platform']){const f=await fixture(t,{product});await f.login();
    const response=await f.service.accountRequest('classroom',{operation:'learningPost',classId:'class-one',body:{runId:'run-one',revision:2,events:[]}});
    assert.equal(response.ok,true);assert.deepEqual(response.nested,{});
    const request=f.requests.find(r=>r.path==='/functions/v1/synk-classroom/api/world/learning');
    assert.equal(request.method,'POST');assert.deepEqual(request.query,{classId:'class-one'});assert.equal(request.headers.authorization,'Bearer synthetic-access-1');assert.equal(request.headers['x-synk-product'],product);assert.equal(request.headers['x-synk-contract'],'1');assert.deepEqual(JSON.parse(request.body),{runId:'run-one',revision:2,events:[]});
  }
});
test('teacher enrollment code survives the real native HTTP transport but credentials do not',async t=>{
  const f=await fixture(t,{product:'world'});await f.login();
  f.queueClassroom({data:{ok:true,invite:{token:'a'.repeat(32),access_token:'synthetic'},nested:{token:'synthetic',refresh_token:'synthetic'}}});
  const result=await f.service.accountRequest('classroom',{operation:'enrollmentInvite',classId:'class-one',body:{learnerId:'learner-one'}});
  assert.equal(result.invite.token,'a'.repeat(32));assert.equal(result.invite.access_token,undefined);assert.deepEqual(result.nested,{});
});
test('WORLD memory and Atlas use native account credentials and Messenger cannot dispatch them',async t=>{
  const f=await fixture(t,{product:'world'});await f.login();
  assert.equal((await f.service.accountRequest('memoryGet',{revision:2})).ok,true);
  assert.equal((await f.service.accountRequest('memoryPost',{revision:2,entries:[]})).ok,true);
  assert.equal((await f.service.accountRequest('atlasSummary',{})).ok,true);
  const reads=f.requests.filter(r=>r.path==='/functions/v1/synk-learning');assert.equal(reads.length,2);
  assert.deepEqual(reads[0].query,{view:'memory',revision:'2'});assert.deepEqual(JSON.parse(reads[1].body),{revision:2,memory:[]});
  for(const row of reads){assert.equal(row.headers['x-synk-product'],'world');assert.equal(row.headers.authorization,'Bearer synthetic-access-1');}
  assert.equal(f.requests.some(r=>r.path==='/functions/v1/synk-account'&&r.query.view==='atlas'),true);
  const m=await fixture(t,{product:'messenger'});await m.login();
  for(const [operation,params]of [['memoryGet',{revision:2}],['memoryPost',{revision:2,entries:[]}],['atlasSummary',{}]])assert.equal((await m.service.accountRequest(operation,params)).error.code,'INVALID_REQUEST');
});
test('classroom calls require login and cannot turn Messenger or injected IPC into a classroom caller',async t=>{
  const f=await fixture(t);assert.equal((await f.service.accountRequest('classroom',{operation:'classes'})).error.code,'AUTH_REQUIRED');
  await f.login();assert.equal((await f.service.accountRequest('classroom',{operation:'classes',url:'https://evil.invalid'})).error.code,'INVALID_REQUEST');assert.equal(f.requests.some(r=>r.path.includes('synk-classroom')),false);
  const messenger=await fixture(t,{product:'messenger'});await messenger.login();assert.equal((await messenger.service.accountRequest('classroom',{operation:'classes'})).error.code,'INVALID_REQUEST');assert.equal(messenger.requests.some(r=>r.path.includes('synk-classroom')),false);
});
test('classroom transport refreshes a rejected token once and preserves scope and conflict information',async t=>{
  const f=await fixture(t,{product:'world'});await f.login();f.queueClassroom({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});
  assert.equal((await f.service.accountRequest('classroom',{operation:'student',classId:'a'})).ok,true);assert.equal(f.refreshCount,1);
  const requests=f.requests.filter(r=>r.path.includes('synk-classroom'));assert.equal(requests.length,2);assert.equal(requests[0].headers.authorization,'Bearer synthetic-access-1');assert.equal(requests[1].headers.authorization,'Bearer synthetic-access-2');for(const request of requests)assert.deepEqual(request.query,{classId:'a'});
  f.queueClassroom({status:409,data:{ok:false,error:{code:'REVISION_CONFLICT'},revision:8}});const conflict=await f.service.accountRequest('classroom',{operation:'startRun',classId:'a',body:{}});assert.equal(conflict.error.code,'REVISION_CONFLICT');assert.equal(conflict.error.status,409);assert.equal(conflict.revision,8);assert.equal(f.service.status().signedIn,true);
});
test('logout fences delayed classroom data and transport errors do not fabricate success',async t=>{
  const f=await fixture(t);await f.login();f.queueClassroom({status:503,data:{ok:false,error:{code:'CLASSROOM_UNAVAILABLE'}}});const unavailable=await f.service.accountRequest('classroom',{operation:'classes'});assert.equal(unavailable.ok,false);assert.equal(unavailable.error.retryable,true);
  let release;f.queueClassroom({wait:new Promise(resolve=>{release=resolve;}),data:{ok:true,classes:['old-account']}});
  const waiting=f.service.accountRequest('classroom',{operation:'classes'});await waitFor(()=>f.requests.filter(r=>r.path.includes('synk-classroom')).length===2);await f.service.signOut();release();
  const result=await waiting;assert.equal(result.ok,false);assert.equal(result.classes,undefined);assert.equal(f.service.status().signedIn,false);
});
test('external-browser OAuth uses real HTTP callback, S256, state and public client; no tokens enter status',async t=>{
  const f=await fixture(t);await f.login();const url=new URL(f.opened);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('response_type'),'code');assert.equal(url.searchParams.get('state').length,43);assert.equal(f.codeCount,1);assert.equal(f.service.status().account.synk_user_id,'stable-synthetic-id');assert.doesNotMatch(JSON.stringify(f.service.status()),/synthetic-access|synthetic-refresh|code_verifier/);
  const load=await f.service.accountRequest('load');assert.equal(load.ok,true);assert.equal(load.access_token,undefined);assert.equal(f.requests.find(r=>r.path==='/functions/v1/synk-account').headers['x-synk-product'],'platform');
});
test('wrong state, duplicate state/code, wrong path and forged Host cannot consume callback',async t=>{
  const f=await fixture(t);await f.service.signIn();const start=new URL(f.opened),callback=new URL(f.config.redirectUri),state=start.searchParams.get('state');
  for(const query of [`?code=x&state=wrong`,`?code=x&state=${state}&state=${state}`,`?code=x&code=y&state=${state}`])assert.equal((await fetch(callback.href+query)).status,400);
  assert.equal((await fetch(callback.origin+'/bad?code=x&state='+state)).status,400);
  assert.equal(await new Promise(resolve=>{http.get(callback.href+'?code=x&state='+state,{headers:{Host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);});}),400);
  assert.equal(f.codeCount,0);assert.equal(f.service.status().status,'signing-in');await fetch(f.opened);await waitFor(()=>f.service.status().signedIn);assert.equal(f.codeCount,1);
  await assert.rejects(fetch(callback.href+'?code=x&state='+state));assert.equal(f.codeCount,1);
});
test('cancellation and expired callback close listener and never create a disk session',async t=>{
  const f=await fixture(t);await f.service.signIn();const old=f.config.redirectUri;assert.equal((await f.service.cancel()).error.code,'AUTH_CANCELLED');await assert.rejects(fetch(old+'?code=x&state=x'));
  await f.service.signIn();const state=new URL(f.opened).searchParams.get('state');f.setClock(1400000);assert.equal((await fetch(old+'?code=x&state='+state)).status,410);await waitFor(()=>f.service.status().status==='signed-out');assert.equal(f.codeCount,0);await assert.rejects(fs.stat(path.join(f.directory,'auth-session.enc')));
});
test('port collision or external browser launch failure returns a usable signed-out state',async t=>{
  const f=await fixture(t);const busy=http.createServer();await new Promise(r=>busy.listen(Number(new URL(f.config.redirectUri).port),'127.0.0.1',r));await assert.rejects(f.service.signIn(),{code:'CALLBACK_UNAVAILABLE'});await close(busy);assert.equal(f.service.status().status,'signed-out');
  const broken=await fixture(t,{openFail:true});await assert.rejects(broken.service.signIn(),{code:'AUTH_FAILED'});assert.equal(broken.service.status().status,'signed-out');
});
test('disk holds ciphertext only; restore rotates refresh token, verifies same subject and logout removes it',async t=>{
  const f=await fixture(t);await f.login();const file=path.join(f.directory,'auth-session.enc'),bytes=await fs.readFile(file);assert.equal(bytes.includes(Buffer.from('synthetic-refresh')),false);f.service.dispose();const restored=f.create();await restored.initialize();assert.equal(restored.status().signedIn,true);assert.equal(f.refreshCount,1);assert.equal((await restored.signOut()).serverRevoked,true);assert.equal(f.logoutCount,1);await assert.rejects(fs.stat(file));const again=f.create();await again.initialize();assert.equal(again.status().signedIn,false);
});
test('near expiry concurrent requests share one refresh and verify the restored subject',async t=>{
  const f=await fixture(t);await f.login();f.setClock(4590000);const results=await Promise.all([f.service.accountRequest('load'),f.service.accountRequest('load'),f.service.accountRequest('learningGet',{after:0,revision:1})]);assert.equal(results.every(r=>r.ok),true);assert.equal(f.refreshCount,1);
  f.wrongSubject();f.setClock(8180000);assert.equal((await f.service.accountRequest('load')).ok,false);assert.equal(f.service.status().signedIn,false);await assert.rejects(fs.stat(path.join(f.directory,'auth-session.enc')));
});
test('refresh invalid_grant drops stored session, while transient server failure preserves encrypted recovery',async t=>{
  const f=await fixture(t);await f.login();f.tokenStatus(503);f.setClock(4590000);assert.equal((await f.service.accountRequest('load')).error.retryable,true);assert.ok(await fs.stat(path.join(f.directory,'auth-session.enc')));
  f.tokenStatus(400);assert.equal((await f.service.accountRequest('load')).ok,false);assert.equal(f.service.status().signedIn,false);await assert.rejects(fs.stat(path.join(f.directory,'auth-session.enc')));
});
test('cancel during token exchange cannot resurrect a session after the response arrives',async t=>{
  const f=await fixture(t);let release;f.delay(new Promise(r=>{release=r;}));await f.service.signIn();await fetch(f.opened);await waitFor(()=>f.codeCount===1);await f.service.cancel();release();await new Promise(r=>setTimeout(r,30));assert.equal(f.service.status().signedIn,false);await assert.rejects(fs.stat(path.join(f.directory,'auth-session.enc')));
});
test('no encryption backend means no sign-in, token storage or plaintext fallback',async t=>{
  const f=await fixture(t,{secureStorage:{...secure,isEncryptionAvailable:()=>false}});await f.service.initialize();assert.equal(f.service.status().error.code,'SECURE_STORAGE_UNAVAILABLE');await assert.rejects(f.service.signIn(),{code:'SECURE_STORAGE_UNAVAILABLE'});assert.equal(f.opened,undefined);assert.deepEqual(await fs.readdir(f.directory),[]);
  const basic=createTokenStore({directory:f.directory,scope:'x',configFingerprint:'x',safeStorage:{...secure,getSelectedStorageBackend:()=> 'basic_text'},platform:'win32'});assert.equal(basic.available(),false);
});
test('encrypted store is bound to app and config; save followed by clear leaves no resurrection file',async t=>{
  const f=await fixture(t);await f.login();const other=createTokenStore({directory:f.directory,safeStorage:secure,scope:'other-app',configFingerprint:f.config.fingerprint,platform:'win32'});await assert.rejects(other.load(),/INVALID_TOKEN_STORE/);
  const store=f.store();await Promise.all([store.save({refreshToken:'synthetic-late',subject:'synthetic-auth-user'}),store.clear()]);assert.equal(await store.load(),null);
});
test('public config rejects secrets, shared client identities, release HTTP and imprecise callbacks',async t=>{
  const f=await fixture(t);for(const raw of [{...f.raw,client_secret:'forbidden'},{...f.raw,supabasePublishableKey:'sb_secret_no'},{...f.raw,clients:{platform:{...f.raw.clients.platform,redirectUri:f.config.redirectUri+'?x=1'}}},{...f.raw,clients:{platform:f.raw.clients.platform,world:{...f.raw.clients.platform,redirectUri:f.config.redirectUri.replace('/platform/','/world/')}}}])assert.throws(()=>configuration(raw,'platform','development'),{code:'AUTH_CONFIG_INVALID'});
  assert.throws(()=>configuration(f.raw,'platform','release'));assert.equal(configuration(null,'world','development'),null);
});
test('fixed account operation input rejects URL/header/action injection; messenger only uses own-account routes',async t=>{
  for(const [op,params]of [['load',{url:'https://evil.invalid'}],['revokeAll',{action:'profile-update'}],['learningGet',{after:-1,revision:1}],['exportPage',{after:'0'}],['fetch',{}]])assert.throws(()=>requestSpec(op,params),{code:'INVALID_REQUEST'});
  const f=await fixture(t,{product:'messenger'});await f.login();assert.equal((await f.service.accountRequest('load')).ok,true);assert.equal((await f.service.accountRequest('learningGet',{after:0,revision:1})).error.code,'INVALID_REQUEST');
});
test('platform account entry is exact; different product, duplicates, child frames and IdP portal cannot invoke auth',()=>{
  const entry='http://127.0.0.1:4280/synk-account/platform.html',good='http://127.0.0.1:4280/synk-account/client.html?product=platform';assert.equal(trustedEntry(good,entry,'platform'),true);
  for(const url of [good+'&product=platform',good.replace('product=platform','product=world'),good.replace('client.html?product=platform','index.html'),good+'&url=evil'])assert.equal(trustedEntry(url,entry,'platform'),false);
  const frame={url:good},contents={mainFrame:frame},window={isDestroyed:()=>false,webContents:contents};assert.doesNotThrow(()=>assertSender({sender:contents,senderFrame:frame},window,entry,'platform'));assert.throws(()=>assertSender({sender:contents,senderFrame:{url:good}},window,entry,'platform'));
});
test('company requests keep token in main and bind Origin, confirmation, CSRF and fixed cookie session fetch',async()=>{
  const calls=[],handler=createCompanyRequests({entry:'http://127.0.0.1:4191/?tab=messenger',clientId:'messenger',auth:{getAccessToken:async()=> 'synthetic-main-token'},session:{fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true,user:{name:'합성'},access_token:'hidden'}),{headers:{'Content-Type':'application/json'}});}}});
  assert.equal((await handler('challenge',{action:'link',currentPassword:'synthetic-password',csrfToken:'synthetic-csrf'})).ok,false);await handler('challenge',{action:'link',currentPassword:'synthetic-password',csrfToken:'synthetic-csrf',confirm:true});const result=await handler('exchange',{challenge:'synthetic-challenge',confirm:true});assert.equal(result.access_token,undefined);assert.equal(calls[1].options.headers.Authorization,'Bearer synthetic-main-token');assert.equal(calls[1].options.credentials,'include');assert.equal(calls[1].options.headers.Origin,'http://127.0.0.1:4191');assert.equal((await handler('exchange',{challenge:'x',confirm:true,url:'http://evil.invalid'})).ok,false);
});
test('rotated refresh is saved before user/account verification; 503 or 429 including HTML preserves recovery',async t=>{
  for(const step of ['user503','user429','account503','htmlUser503','htmlAccount503']){
    const f=await fixture(t);await f.login();if(step.toLowerCase().includes('user'))f.userStatus(step.includes('429')?429:503);else f.accountStatus(503);if(step.startsWith('html'))f.nonJson();f.setClock(4590000);
    const result=await f.service.accountRequest('load');assert.equal(result.error.retryable,true,step);assert.equal(f.service.status().signedIn,false,step);assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-2',step);
    f.userStatus(200);f.accountStatus(200);f.service.dispose();const restored=f.create();await restored.initialize();assert.equal(restored.status().signedIn,true,step);assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-3',step);
  }
});
test('current-session revocation immediately clears main state and encrypted recovery token',async t=>{
  const f=await fixture(t);await f.login();const generation=f.service.status().sessionGeneration;
  const result=await f.service.accountRequest('revokeSession',{session_id:'00000000-0000-4000-8000-000000000001'});assert.equal(result.current,true);assert.equal(f.service.status().signedIn,false);assert.ok(f.service.status().sessionGeneration>generation);assert.equal(await f.store().load(),null);
});
test('native account contract enforces server learning and profile limits',()=>{
  assert.throws(()=>requestSpec('learningPost',{revision:1,events:Array(257).fill({})}));assert.throws(()=>requestSpec('learningPost',{revision:1,events:[{content:'x'.repeat(262144)}]}));
  assert.throws(()=>requestSpec('updateProfile',{profile:{display_name:'x'.repeat(61)},expected_profile_revision:1}));
  assert.deepEqual(requestSpec('updateProfile',{profile:{locale:'ko',time_zone:'Asia/Seoul'},expected_profile_revision:1}).body.profile,{locale:'ko',time_zone:'Asia/Seoul'});
});
test('company HTTP denial is an error envelope instead of a successful exchange result',async()=>{
  const handler=createCompanyRequests({entry:'http://127.0.0.1:4191/?tab=messenger',clientId:'messenger',auth:{getAccessToken:async()=> 'synthetic-main-token'},session:{fetch:async()=>new Response(JSON.stringify({error:'직원 연결이 필요해요.',code:'SYNK_LINK_REQUIRED'}),{status:403})}});
  const result=await handler('exchange',{challenge:'synthetic-challenge',confirm:true});assert.equal(result.ok,false);assert.equal(result.error.code,'SYNK_LINK_REQUIRED');assert.equal(result.error.status,403);
});
test('verified account library is minimal, updates on reload, and clears during logout and a different login',async t=>{
  const f=await fixture(t);f.accountPayload({memberships:[{kind:'learner',role:'student',learner_id:'synthetic-learner'}]});await f.login();
  assert.deepEqual(f.service.status().library,{status:'ready',appIds:['world']});assert.equal('memberships' in f.service.status(),false);
  f.accountPayload({memberships:[{kind:'staff',role:'teacher',staff_id:'synthetic-teacher'}]});await f.service.accountRequest('load');assert.deepEqual(f.service.status().library.appIds,['teacher']);
  await f.service.signOut();assert.deepEqual(f.service.status().library,{status:'unavailable',appIds:[]});
  f.accountPayload({account:{synk_user_id:'another-synthetic-id',status:'active',profile:{display_name:'다른 합성 계정'}},memberships:[]});await f.login();assert.deepEqual(f.service.status().library,{status:'ready',appIds:[]});
});
test('library is removed on missing contract, failed account reload and restore verification failure',async t=>{
  const f=await fixture(t);f.accountPayload({entitlements:[{product:'platform',key:'library.messenger'}]});await f.login();assert.deepEqual(f.service.status().library.appIds,['messenger']);
  f.accountStatus(503);assert.equal((await f.service.accountRequest('load')).ok,false);assert.equal(f.service.status().signedIn,true);assert.deepEqual(f.service.status().library,{status:'unavailable',appIds:[]});
  f.accountStatus(200);f.accountPayload({entitlements:undefined});await f.service.accountRequest('load');assert.deepEqual(f.service.status().library,{status:'unavailable',appIds:[]});
  f.accountPayload({entitlements:[{product:'platform',key:'library.messenger'}]});await f.service.accountRequest('load');assert.deepEqual(f.service.status().library.appIds,['messenger']);
  f.service.dispose();f.userStatus(503);const restored=f.create();await restored.initialize();assert.deepEqual(restored.status().library,{status:'unavailable',appIds:[]});
});
test('expired menu rights are removed from status without trusting a renderer clock or cached array',async t=>{
  const f=await fixture(t);f.accountPayload({entitlements:[{product:'platform',key:'library.pulse',valid_until:new Date(1001000).toISOString()}]});await f.login();assert.deepEqual(f.service.status().library.appIds,['pulse']);
  const old=f.service.status();old.library.appIds.push('messenger');assert.deepEqual(f.service.status().library.appIds,['pulse']);
  f.setClock(1001000);assert.deepEqual(f.service.status().library,{status:'ready',appIds:[]});
});
test('a late old account load cannot restore entries removed by a newer server response',async t=>{
  const f=await fixture(t);await f.login();let release;const held=new Promise(r=>{release=r;});
  const account={synk_user_id:'stable-synthetic-id',status:'active',profile:{display_name:'합성 계정'}};
  f.queueAccount({wait:held,data:{ok:true,account,memberships:[{kind:'staff',role:'teacher',staff_id:'synthetic-staff'}],entitlements:[]}});
  const first=f.service.accountRequest('load');await waitFor(()=>f.requests.filter(r=>r.path==='/functions/v1/synk-account').length===2);assert.deepEqual(f.service.status().library,{status:'unavailable',appIds:[]});
  await f.service.accountRequest('load');assert.deepEqual(f.service.status().library,{status:'ready',appIds:[]});release();await first;assert.deepEqual(f.service.status().library,{status:'ready',appIds:[]});
});
test('an account ID change on a reload is rejected and cannot carry rights across identities',async t=>{
  const f=await fixture(t);f.accountPayload({memberships:[{kind:'learner',role:'student',learner_id:'synthetic'}]});await f.login();
  f.accountPayload({account:{synk_user_id:'unexpected-other-account',status:'active'},entitlements:[{product:'platform',key:'library.messenger'}]});
  assert.equal((await f.service.accountRequest('load')).error.code,'AUTH_REQUIRED');assert.equal(f.service.status().signedIn,false);assert.deepEqual(f.service.status().library,{status:'unavailable',appIds:[]});
});

test('an account load returning during token verification cannot discard the rotated recovery token',async t=>{
  const f=await fixture(t);await f.login();let releaseLoad,releaseUser;
  f.queueAccount({wait:new Promise(resolve=>{releaseLoad=resolve;}),data:{ok:true,account:{synk_user_id:'stable-synthetic-id',status:'active',profile:{display_name:'이전 이름'}},memberships:[{kind:'staff',role:'teacher',staff_id:'synthetic-staff'}],entitlements:[]}});
  const loading=f.service.accountRequest('load');await waitFor(()=>f.requests.filter(r=>r.path==='/functions/v1/synk-account').length===2);
  f.queueUser({wait:new Promise(resolve=>{releaseUser=resolve;})});
  f.queueClassroom({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});
  const refreshing=f.service.accountRequest('classroom',{operation:'classes'});await waitFor(()=>f.requests.filter(r=>r.path==='/auth/v1/user').length===2);
  assert.equal(f.service.status().status,'restoring');releaseLoad();assert.equal((await loading).ok,true);
  assert.equal(f.service.status().status,'restoring');assert.equal(f.service.status().account,null);assert.deepEqual(f.service.status().library,{status:'unavailable',appIds:[]});
  assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-2');releaseUser();assert.equal((await refreshing).ok,true);
  assert.equal(f.service.status().signedIn,true);assert.equal(f.service.status().account.display_name,'합성 계정');assert.deepEqual(f.service.status().library,{status:'ready',appIds:[]});
  assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-2');
});

test('a pre-refresh load cannot overwrite the account and library verified with a new token',async t=>{
  const f=await fixture(t);await f.login();let releaseLoad;
  f.queueAccount({wait:new Promise(resolve=>{releaseLoad=resolve;}),data:{ok:true,account:{synk_user_id:'stable-synthetic-id',status:'active',profile:{display_name:'이전 이름'}},memberships:[{kind:'staff',role:'teacher',staff_id:'synthetic-staff'}],entitlements:[]}});
  const loading=f.service.accountRequest('load');await waitFor(()=>f.requests.filter(r=>r.path==='/functions/v1/synk-account').length===2);
  f.accountPayload({account:{synk_user_id:'stable-synthetic-id',status:'active',profile:{display_name:'갱신된 이름'}},entitlements:[{product:'platform',key:'library.messenger'}]});
  f.queueClassroom({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});assert.equal((await f.service.accountRequest('classroom',{operation:'classes'})).ok,true);
  releaseLoad();assert.equal((await loading).ok,true);assert.equal(f.service.status().signedIn,true);
  assert.equal(f.service.status().account.display_name,'갱신된 이름');assert.deepEqual(f.service.status().library,{status:'ready',appIds:['messenger']});
});

for(const response of [
  {name:'server failure',status:503,data:{ok:false,error:{code:'UNAVAILABLE'}}},
  {name:'session rejection',status:403,data:{ok:false,error:{code:'SESSION_REVOKED'}}},
  {name:'transport failure',disconnect:true},
])test(`a pre-refresh load ${response.name} cannot clear the newly verified session or library`,async t=>{
  const f=await fixture(t);await f.login();let releaseLoad;
  f.queueAccount({...response,wait:new Promise(resolve=>{releaseLoad=resolve;})});
  const loading=f.service.accountRequest('load');await waitFor(()=>f.requests.filter(r=>r.path==='/functions/v1/synk-account').length===2);
  f.accountPayload({account:{synk_user_id:'stable-synthetic-id',status:'active',profile:{display_name:'갱신된 이름'}},entitlements:[{product:'platform',key:'library.messenger'}]});
  f.queueClassroom({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});assert.equal((await f.service.accountRequest('classroom',{operation:'classes'})).ok,true);
  assert.deepEqual(f.service.status().library,{status:'ready',appIds:['messenger']});
  releaseLoad();const result=await loading;assert.equal(result.ok,false);assert.equal(result.error.code,'AUTH_CHANGED');
  assert.equal(f.service.status().signedIn,true);assert.equal(f.service.status().account.display_name,'갱신된 이름');
  assert.deepEqual(f.service.status().library,{status:'ready',appIds:['messenger']});
  assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-2');
});

test('a rejected old load cannot discard a replacement token while its identity verification is pending',async t=>{
  const f=await fixture(t);await f.login();let releaseLoad,releaseUser;
  f.queueAccount({wait:new Promise(resolve=>{releaseLoad=resolve;}),status:403,data:{ok:false,error:{code:'SESSION_REVOKED'}}});
  const loading=f.service.accountRequest('load');await waitFor(()=>f.requests.filter(r=>r.path==='/functions/v1/synk-account').length===2);
  f.queueUser({wait:new Promise(resolve=>{releaseUser=resolve;})});
  f.queueClassroom({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});
  const refreshing=f.service.accountRequest('classroom',{operation:'classes'});await waitFor(()=>f.requests.filter(r=>r.path==='/auth/v1/user').length===2);
  assert.equal(f.service.status().status,'restoring');assert.equal(f.service.status().account,null);
  releaseLoad();assert.equal((await loading).error.code,'AUTH_CHANGED');
  assert.equal(f.service.status().status,'restoring');assert.equal((await f.store().load()).refreshToken,'synthetic-refresh-2');
  releaseUser();assert.equal((await refreshing).ok,true);assert.equal(f.service.status().signedIn,true);
});

test('revocation of the currently held token still closes auth and removes encrypted recovery',async t=>{
  const f=await fixture(t);await f.login();
  f.queueAccount({status:403,data:{ok:false,error:{code:'SESSION_REVOKED'}}});
  assert.equal((await f.service.accountRequest('load')).error.code,'SESSION_REVOKED');
  assert.equal(f.service.status().signedIn,false);assert.deepEqual(f.service.status().library,{status:'unavailable',appIds:[]});
  assert.equal(await f.store().load(),null);
});


test('WORLD play uses the existing account token and fixed wallet/progress/import operations',async t=>{
  const f=await fixture(t,{product:'world'});await f.login();
  assert.equal((await f.service.accountRequest('playLoad')).ok,true);
  const id='00000000-0000-4000-8000-000000000001';
  for(const body of [{action:'wallet',id,method:'buyItem',args:['ship-keepsake-starbook']},{action:'progress',id,changes:[{key:'synk.word-magic.progress.v1',previous:null,value:'{}'}]},{action:'import',id,expected_revision:0,state:{wallet:{},records:{}}}]) assert.equal((await f.service.accountRequest('playMutate',body)).ok,true);
  const requests=f.requests.filter(row=>row.path==='/functions/v1/synk-play');assert.equal(requests.length,4);assert.equal(requests[0].method,'GET');
  for(const row of requests){assert.equal(row.headers.authorization,'Bearer synthetic-access-1');assert.equal(row.headers['x-synk-product'],'world');}
  assert.deepEqual((await f.service.accountRequest('playLoad')).nested,{});
  for(const [operation,params]of [['playLoad',{url:'https://example.invalid'}],['playMutate',{action:'wallet',id,method:'setCoins',args:[999]}],['playMutate',{action:'progress',id,changes:[{key:'x',previous:undefined,value:'{}'}]}]])assert.equal((await f.service.accountRequest(operation,params)).error.code,'INVALID_REQUEST');
  const platform=await fixture(t);await platform.login();assert.equal((await platform.service.accountRequest('playLoad')).error.code,'INVALID_REQUEST');
});

test('WORLD play refresh, conflict, owner mismatch and logout keep the native identity boundary',async t=>{
  const f=await fixture(t,{product:'world'});await f.login();f.queuePlay({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});
  assert.equal((await f.service.accountRequest('playLoad')).ok,true);assert.equal(f.refreshCount,1);
  f.queuePlay({status:409,data:{ok:false,error:{code:'REVISION_CONFLICT'},revision:8}});const conflict=await f.service.accountRequest('playLoad');assert.equal(conflict.error.code,'REVISION_CONFLICT');assert.equal(conflict.revision,8);
  let release;f.queuePlay({wait:new Promise(resolve=>{release=resolve;}),data:{ok:true,scope:'synk-play',accountId:'stable-synthetic-id',revision:0,state:{}}});
  const pending=f.service.accountRequest('playLoad');await waitFor(()=>f.requests.filter(row=>row.path==='/functions/v1/synk-play').length===4);await f.service.signOut();release();assert.equal((await pending).ok,false);
  await f.login();f.queuePlay({data:{ok:true,scope:'synk-play',accountId:'other-account',revision:0,state:{}}});const wrong=await f.service.accountRequest('playLoad');assert.equal(wrong.ok,false);assert.equal(wrong.state,undefined);assert.equal(f.service.status().signedIn,false);
});

test('WORLD gateway HTTP errors stay retryable while real account rejection codes are preserved',async t=>{
 const f=await fixture(t,{product:'world'});await f.login();
 for(const status of [429,500,502,503,504])for(const data of [null,{code:'BOOT_ERROR',message:'worker limit'}]){f.queuePlay({status,data});const result=await f.service.accountRequest('playLoad');assert.equal(result.error.code,'SERVICE_UNAVAILABLE');assert.equal(result.error.retryable,true);assert.equal(result.error.status,status);assert.equal(f.service.status().signedIn,true);}
 f.queuePlay({status:403,data:{ok:false,error:{code:'ACCOUNT_UNAVAILABLE'}}});const inactive=await f.service.accountRequest('playLoad');assert.equal(inactive.error.code,'ACCOUNT_UNAVAILABLE');assert.equal(inactive.error.retryable,false);
});
