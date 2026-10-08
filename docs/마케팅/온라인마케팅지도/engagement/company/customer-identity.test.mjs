import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Store } from './store.mjs';
import { customerIdentityConfig, createCustomerIdentity } from './customer-identity.mjs';

const origin='https://company.example.test',issuer='https://identity.example.test';
const callbackPath='/api/customer/synk-id/callback';
const id='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222';
const sessionId='33333333-3333-4333-8333-333333333333';
const env={SYNK_ID_CUSTOMER_ACCOUNT_API_URL:issuer+'/functions/v1/synk-account',SYNK_ID_CUSTOMER_PUBLISHABLE_KEY:'sb_publishable_synthetic_fixture',SYNK_ID_CUSTOMER_SUPABASE_URL:issuer,SYNK_ID_CUSTOMER_CLIENT_ID:'customer-browser-fixture',SYNK_ID_CUSTOMER_REDIRECT_URI:origin+callbackPath};
const config=customerIdentityConfig(env);
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function responseSink(){const headers=new Map();return {setHeader:(name,value)=>headers.set(name.toLowerCase(),value),getHeader:name=>headers.get(name.toLowerCase())};}
function cookieValues(res){return (res.getHeader('Set-Cookie')||[]).map(row=>row.split(';')[0]);}
function fixture(t,options={}){
  let stamp=Date.parse('2026-10-08T00:00:00Z'),centralStatus=200,active=true,accountId=id;
  let claimOverrides={},currentSessions=[{id:sessionId,current:true,revoked:false,product:'platform'}],nextRefresh=0;
  const calls=[],jar=new Map();
  const token=(extra={})=>'synthetic.'+Buffer.from(JSON.stringify({iss:issuer+'/auth/v1',client_id:config.clientId,sub:id,session_id:sessionId,iat:Math.floor(stamp/1000)-1,exp:Math.floor((stamp+3600_000)/1000),...claimOverrides,...extra})).toString('base64url')+'.fixture';
  const fetcher=async(url,init)=>{
    calls.push({url:String(url),...init});
    if(options.fetcher){const result=await options.fetcher(String(url),init);if(result)return result;}
    if(String(url).endsWith('/oauth/token'))return Response.json({access_token:token(),refresh_token:'synthetic-refresh-token-'+(++nextRefresh),token_type:'bearer'});
    if(String(url).includes('/logout?scope=local'))return new Response(null,{status:204});
    if(init.method==='POST')return Response.json({ok:true,current:true});
    if(centralStatus!==200)return new Response(null,{status:centralStatus});
    return Response.json({ok:true,account:{synk_user_id:accountId,status:active?'active':'suspended',profile:{display_name:'상담 고객'}},sessions:currentSessions});
  };
  const directory=mkdtempSync(join(tmpdir(),'synk-customer-identity-'));
  let store=null,identity=null;
  const start=(overrides={})=>{store=new Store(directory);identity=createCustomerIdentity({store,origin,config:options.disabled?null:config,fetch:fetcher,now:()=>stamp,...overrides});};
  const stop=async()=>{if(identity){await identity.close();identity.dispose();identity=null;}if(store){store.close();store=null;}};
  t.after(async()=>{await stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('synk-customer-identity-'));rmSync(directory,{recursive:true,force:true});});
  start();
  function request(extra={}){return {headers:{origin,cookie:[...jar].map(([key,value])=>key+'='+value).join('; '),...extra},socket:{remoteAddress:'127.0.0.1'}};}
  function apply(res){for(const pair of cookieValues(res)){const index=pair.indexOf('='),key=pair.slice(0,index),value=pair.slice(index+1);if(value)jar.set(key,value);else jar.delete(key);}}
  function begin(){const res=responseSink(),result=identity.start(request(),res);apply(res);return {url:new URL(result.authorizationUrl),result,res};}
  async function complete(beginning){const res=responseSink(),url=new URL(config.redirectUri);url.search=new URLSearchParams({state:beginning.url.searchParams.get('state'),code:'synthetic-one-time-code'});const result=await identity.callback(request(),res,url);apply(res);return {result,res,url};}
  return {get identity(){return identity;},get store(){return store;},directory,calls,jar,request,apply,begin,complete,token,advance:ms=>stamp+=ms,setStatus:value=>centralStatus=value,setActive:value=>active=value,setAccount:value=>accountId=value,setClaims:value=>claimOverrides=value,setSessions:value=>currentSessions=value,async restart(overrides={}){await stop();start(overrides);},async login(){return complete(begin());}};
}

test('customer configuration is independent and fails closed for incomplete or employee settings',t=>{
  const f=fixture(t);
  assert.equal(customerIdentityConfig({}),null);
  assert.equal(customerIdentityConfig({SYNK_ID_MESSENGER_CLIENT_ID:'employee'}),null);
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_CLIENT_ID:''}));
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_MESSENGER_CLIENT_ID:env.SYNK_ID_CUSTOMER_CLIENT_ID}));
  for(const key of ['sb_secret_hidden',`x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`,'not-a-public-key'])assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_PUBLISHABLE_KEY:key}));
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_ACCOUNT_API_URL:'https://other.example.test/functions/v1/synk-account'}));
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_REDIRECT_URI:origin+'/api/synk-id/callback'}));
  assert.throws(()=>createCustomerIdentity({store:f.store,origin,config:{...config,product:'messenger'}}));
  assert.throws(()=>createCustomerIdentity({store:f.store,origin:'https://other.example.test',config}));
});

test('missing registration settings keep customer login closed without making a remote request',async t=>{
  const f=fixture(t,{disabled:true});assert.equal(f.identity.status().enabled,false);
  assert.equal(await f.identity.authenticate(f.request()),null);
  assert.throws(()=>f.begin(),{status:503,code:'CUSTOMER_NOT_CONFIGURED'});assert.equal(f.calls.length,0);
});

test('PKCE is server-side and customer cookies never expose tokens or employee credentials',async t=>{
  const f=fixture(t),start=f.begin();
  assert.equal(start.url.searchParams.get('client_id'),config.clientId);
  assert.equal(start.url.searchParams.get('redirect_uri'),config.redirectUri);
  assert.equal(start.url.searchParams.get('code_challenge_method'),'S256');
  assert.match(start.res.getHeader('Set-Cookie')[0],/^synk_customer_flow=.*HttpOnly; SameSite=Lax; Path=\/api\/customer; Max-Age=300; Secure$/);
  const completed=await f.complete(start),body=new URLSearchParams(f.calls[0].body);
  assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'),start.url.searchParams.get('code_challenge'));
  assert.equal(body.get('redirect_uri'),config.redirectUri);assert.equal(body.get('grant_type'),'authorization_code');
  assert.equal(f.calls[1].headers['X-SYNK-Product'],'platform');assert.equal(f.calls[1].headers['X-SYNK-Contract'],'1');
  assert.equal(completed.result.user.id,'synk:'+id);assert.equal(completed.result.user.kind,'customer');assert.equal(completed.result.user.name,'상담 고객');
  assert.ok(!JSON.stringify(completed.result).includes('synthetic-refresh'));
  assert.ok(!completed.res.getHeader('Set-Cookie').join().includes('synthetic.'));
  assert.match(completed.res.getHeader('Set-Cookie')[0],/^synk_customer_session=/);
});

test('origin, flow cookie, expiry and one-time state prevent cross-browser login and replay',async t=>{
  const f=fixture(t);assert.throws(()=>f.identity.start(f.request({origin:'https://attacker.example.test'}),responseSink()),{status:403});
  const start=f.begin(),url=new URL(config.redirectUri+'?state='+start.url.searchParams.get('state')+'&code=fixture');
  await assert.rejects(f.identity.callback(f.request({cookie:''}),responseSink(),url),{status:403});
  await f.complete(start);await assert.rejects(f.identity.callback(f.request(),responseSink(),url),{status:403});
  const expired=f.begin();f.advance(5*60_000);await assert.rejects(f.complete(expired),{status:403});
});

test('callback rejects ambiguous queries and a different callback origin',async t=>{
  const f=fixture(t),start=f.begin(),state=start.url.searchParams.get('state');
  for(const suffix of ['&state=other','&access_token=bad','&error=denied','#fragment'])await assert.rejects(f.identity.callback(f.request(),responseSink(),new URL(config.redirectUri+'?state='+state+'&code=fixture'+suffix)),{status:403});
  await assert.rejects(f.identity.callback(f.request(),responseSink(),new URL('https://other.example.test'+callbackPath+'?state='+state+'&code=fixture')),{status:403});
  assert.equal(f.calls.length,0);
});

test('central active account, current nonrevoked platform session and this exact OAuth client are mandatory',async t=>{
  const scenarios={
    inactive:f=>f.setActive(false),revoked:f=>f.setSessions([{id:sessionId,current:true,revoked:true,product:'platform'}]),
    missingCurrent:f=>f.setSessions([]),wrongProduct:f=>f.setSessions([{id:sessionId,current:true,revoked:false,product:'messenger'}]),
    wrongClient:f=>f.setClaims({client_id:'another-platform-client'}),missingClient:f=>f.setClaims({client_id:undefined}),
    wrongIssuer:f=>f.setClaims({iss:'https://other.example.test/auth/v1'}),expired:f=>f.setClaims({exp:1}),unauthorized:f=>f.setStatus(401),
  };
  for(const [name,prepare]of Object.entries(scenarios))await t.test(name,async t=>{const f=fixture(t);prepare(f);await assert.rejects(f.login(),{status:401});assert.equal(f.jar.has('synk_customer_session'),false);assert.equal(await f.identity.authenticate(f.request()),null);});
});

test('every protected request rechecks central identity and staff cookies cannot authenticate a customer',async t=>{
  const f=fixture(t);await f.login();const before=f.calls.length;
  const first=await f.identity.authenticate(f.request()),second=await f.identity.authenticate(f.request());
  assert.equal(f.calls.length,before+2);assert.equal(first.user,second.user);
  assert.equal(await f.identity.authenticate(f.request({cookie:'synk_company_session='+f.jar.get('synk_customer_session')})),null);
  assert.equal(await f.identity.authenticate(f.request({cookie:'synk_customer_session='+f.jar.get('synk_customer_session')+'; synk_customer_session='+f.jar.get('synk_customer_session')})),null);
});

test('object identity and CSRF prevent forged customer privileges and cross-origin writes',async t=>{
  const f=fixture(t);await f.login();const auth=await f.identity.authenticate(f.request());
  assert.ok(f.identity.isCurrent(auth));assert.ok(f.identity.isCurrentUser(auth.user));
  assert.equal(f.identity.isCurrent({...auth}),false);assert.equal(f.identity.isCurrentUser({...auth.user}),false);
  assert.equal(f.identity.isCurrentUser({id:'synk:'+id}),false);
  assert.throws(()=>f.identity.requireCsrf(f.request({'x-csrf-token':'wrong'}),auth),{status:403});
  assert.throws(()=>f.identity.requireCsrf(f.request({'x-csrf-token':'가'.repeat(43)}),auth),{status:403});
  assert.throws(()=>f.identity.requireCsrf(f.request({origin:'https://other.example.test','x-csrf-token':auth.csrfToken}),auth),{status:403});
  f.identity.requireCsrf(f.request({'x-csrf-token':auth.csrfToken}),auth);
});

test('revocation and a central account switch invalidate earlier authorization objects immediately',async t=>{
  for(const mutate of [f=>f.setStatus(401),f=>f.setActive(false),f=>f.setAccount(otherId)]){
    const f=fixture(t);await f.login();const auth=await f.identity.authenticate(f.request());mutate(f);
    assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(f.identity.isCurrent(auth),false);assert.equal(f.identity.isCurrentUser(auth.user),false);
  }
});

test('temporary central failure blocks customer access and can recover only after a new check',async t=>{
  const f=fixture(t);await f.login();const auth=await f.identity.authenticate(f.request());f.setStatus(503);
  await assert.rejects(f.identity.authenticate(f.request()),{status:503,retryable:true});assert.equal(f.identity.isCurrent(auth),false);assert.equal(f.identity.isCurrentUser(auth.user),false);
  f.setStatus(200);assert.equal((await f.identity.authenticate(f.request())).user,auth.user);assert.ok(f.identity.isCurrent(auth));
});

test('refresh rotation survives a failed central check without replaying the consumed refresh token',async t=>{
  const f=fixture(t);await f.login();f.advance(3590_000);f.setStatus(503);
  await assert.rejects(f.identity.authenticate(f.request()),{status:503});
  const refreshCalls=()=>f.calls.filter(call=>call.body&&new URLSearchParams(call.body).get('grant_type')==='refresh_token');
  assert.equal(refreshCalls().length,1);assert.equal(new URLSearchParams(refreshCalls()[0].body).get('refresh_token'),'synthetic-refresh-token-1');
  f.setStatus(200);assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls().length,1);
  f.advance(3590_000);assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls().length,2);assert.equal(new URLSearchParams(refreshCalls()[1].body).get('refresh_token'),'synthetic-refresh-token-2');
});

test('concurrent refresh requests share rotation and each receives the same unforgeable customer identity',async t=>{
  const gate=defer(),entered=defer();
  const f=fixture(t,{fetcher:async(url,init)=>{if(url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){entered.resolve();await gate.promise;}}});
  await f.login();f.advance(3590_000);const a=f.identity.authenticate(f.request());await entered.promise;const b=f.identity.authenticate(f.request());gate.resolve();
  const [first,second]=await Promise.all([a,b]);assert.equal(first.user,second.user);
  assert.equal(f.calls.filter(call=>call.body&&new URLSearchParams(call.body).get('grant_type')==='refresh_token').length,1);
});

test('logout requires customer CSRF and removes privileges before remote revoke completes',async t=>{
  const gate=defer(),entered=defer();const f=fixture(t,{fetcher:async(url,init)=>{if(url===config.accountApiUrl&&init.method==='POST'){entered.resolve();await gate.promise;}}});
  await f.login();const auth=await f.identity.authenticate(f.request());
  await assert.rejects(f.identity.logout(f.request(),responseSink()),{status:403});assert.ok(f.identity.isCurrent(auth));
  const res=responseSink(),pending=f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),res);await entered.promise;
  assert.equal(f.identity.isCurrent(auth),false);assert.equal(f.identity.isCurrentUser(auth.user),false);assert.equal(await f.identity.authenticate(f.request()),null);
  gate.resolve();const result=await pending;assert.equal(result.serverRevoked,true);assert.equal(result.localSignedOut,true);
  const revoke=f.calls.find(call=>call.url===config.accountApiUrl&&call.method==='POST');assert.deepEqual(JSON.parse(revoke.body),{action:'revoke-session',session_id:sessionId});
  assert.ok(f.calls.some(call=>call.url===issuer+'/auth/v1/logout?scope=local'));
  assert.ok(res.getHeader('Set-Cookie').every(row=>row.includes('Max-Age=0')));
});

test('logout during refresh does not resurrect a session and revokes the newly rotated bearer',async t=>{
  const gate=defer(),entered=defer();const f=fixture(t,{fetcher:async(url,init)=>{if(url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){entered.resolve();await gate.promise;}}});
  await f.login();const auth=await f.identity.authenticate(f.request()),oldBearer=f.calls.at(-1).headers.Authorization;f.advance(3590_000);
  const pending=f.identity.authenticate(f.request());await entered.promise;
  const logout=f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),responseSink());assert.equal(f.identity.isCurrent(auth),false);
  gate.resolve();assert.equal(await pending,null);assert.equal((await logout).serverRevoked,true);
  const revoke=f.calls.find(call=>call.method==='POST'&&call.url===config.accountApiUrl);assert.notEqual(revoke.headers.Authorization,oldBearer);assert.equal(await f.identity.authenticate(f.request()),null);
});

test('logout can cancel an in-flight first login before it installs a customer session',async t=>{
  const gate=defer(),entered=defer();const f=fixture(t,{fetcher:async(url)=>{if(url.endsWith('/oauth/token')){entered.resolve();await gate.promise;}}});
  const start=f.begin(),pending=f.complete(start);await entered.promise;
  await f.identity.logout(f.request(),responseSink());gate.resolve();await assert.rejects(pending,{status:401});assert.equal(await f.identity.authenticate(f.request()),null);
});

test('logout remains local-successful during provider failure and never reports remote revoke success',async t=>{
  let offline=false;const f=fixture(t,{fetcher:async()=>{if(offline)throw Error('synthetic network failure');}});
  await f.login();const auth=await f.identity.authenticate(f.request());offline=true;
  const result=await f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),responseSink());assert.equal(result.localSignedOut,true);assert.equal(result.serverRevoked,false);assert.equal(f.identity.isCurrent(auth),false);
});

test('absolute customer expiry ends access and shutdown immediately blocks existing authorization',async t=>{
  const f=fixture(t);await f.login();const auth=await f.identity.authenticate(f.request());f.advance(8*3600_000);
  assert.equal(f.identity.isCurrentUser(auth.user),false);assert.equal(await f.identity.authenticate(f.request()),null);
  const next=fixture(t);await next.login();const current=await next.identity.authenticate(next.request());next.identity.close();assert.equal(next.identity.isCurrent(current),false);assert.equal(next.identity.isCurrentUser(current.user),false);assert.equal(await next.identity.authenticate(next.request()),null);assert.equal(next.identity.status().enabled,false);
});

const savedRows=f=>f.store.db.prepare('SELECT * FROM customer_identity_sessions').all();
const refreshCalls=f=>f.calls.filter(call=>call.body&&new URLSearchParams(call.body).get('grant_type')==='refresh_token');

test('restart restores the same cookie CSRF and absolute expiry only after fresh central verification',async t=>{
  const f=fixture(t);await f.login();const original=await f.identity.authenticate(f.request()),cookie=f.jar.get('synk_customer_session');
  const key=readFileSync(join(f.directory,'encryption.key')),rows=savedRows(f);assert.equal(rows.length,1);
  assert.equal(rows[0].session_hash,createHash('sha256').update(cookie).digest('hex'));
  const stored=JSON.stringify(rows);
  for(const secret of [cookie,original.csrfToken,'synthetic-refresh-token-1',f.calls.at(-1).headers.Authorization.slice(7),id,'상담 고객'])assert.ok(!stored.includes(secret));
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM tokens').get().n,0);assert.equal(f.store.all('users').length,0);
  const checks=f.calls.length;await f.restart();assert.equal(f.calls.length,checks,'loading encrypted state makes no external request');
  assert.equal(f.identity.isCurrent(original),false);assert.equal(f.identity.isCurrentUser(original.user),false);
  const restored=await f.identity.authenticate(f.request());assert.equal(f.calls.length,checks+1);
  assert.equal(f.jar.get('synk_customer_session'),cookie);assert.equal(restored.csrfToken,original.csrfToken);assert.equal(restored.expiresAt,original.expiresAt);
  assert.deepEqual(restored.user,original.user);assert.notEqual(restored.user,original.user);
  f.identity.requireCsrf(f.request({'x-csrf-token':original.csrfToken}),restored);
  assert.equal(f.identity.isCurrent({...restored}),false);assert.equal(f.identity.isCurrentUser({...restored.user}),false);
  assert.equal(await f.identity.authenticate(f.request({cookie:'synk_company_session='+cookie})),null);
  await f.identity.authenticate(f.request());assert.equal(f.calls.length,checks+2,'restoration does not introduce a timed authorization cache');
  assert.deepEqual(readFileSync(join(f.directory,'encryption.key')),key);
});

test('restored sessions remain encrypted during a central outage and recover without another login',async t=>{
  const f=fixture(t);await f.login();const original=await f.identity.authenticate(f.request());
  f.setStatus(503);await f.restart();await assert.rejects(f.identity.authenticate(f.request()),{status:503,retryable:true});
  assert.equal(savedRows(f).length,1);assert.equal(f.identity.isCurrentUser(original.user),false);
  await f.restart();await assert.rejects(f.identity.authenticate(f.request()),{status:503});assert.equal(savedRows(f).length,1);
  f.setStatus(200);const restored=await f.identity.authenticate(f.request());assert.equal(restored.csrfToken,original.csrfToken);assert.equal(restored.expiresAt,original.expiresAt);
});

test('central revocation or identity change after restart removes persisted access permanently',async t=>{
  for(const [name,mutate]of Object.entries({unauthorized:f=>f.setStatus(401),forbidden:f=>f.setStatus(403),inactive:f=>f.setActive(false),account:f=>f.setAccount(otherId),session:f=>f.setSessions([{id:sessionId,current:true,revoked:true,product:'platform'}])}))await t.test(name,async t=>{
    const f=fixture(t);await f.login();await f.restart();mutate(f);
    assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(savedRows(f).length,0);
    f.setStatus(200);f.setActive(true);f.setAccount(id);f.setSessions([{id:sessionId,current:true,revoked:false,product:'platform'}]);
    const calls=f.calls.length;await f.restart();assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(f.calls.length,calls);
  });
});

test('damaged copied or changed-configuration credentials are rejected without central requests',async t=>{
  for(const mode of ['damaged','copied','expiry-binding','client','public-key','issuer'])await t.test(mode,async t=>{
    const f=fixture(t);await f.login();let overrides={};
    if(mode==='damaged')f.store.db.prepare("UPDATE customer_identity_sessions SET ciphertext='not-valid-encrypted-data'").run();
    if(mode==='copied'){
      const copiedCookie='x'.repeat(43),copiedHash=createHash('sha256').update(copiedCookie).digest('hex');
      f.store.db.prepare('UPDATE customer_identity_sessions SET session_hash=?').run(copiedHash);f.jar.set('synk_customer_session',copiedCookie);
    }
    if(mode==='expiry-binding')f.store.db.prepare('UPDATE customer_identity_sessions SET expires_at=expires_at+60000').run();
    if(mode==='client')overrides={config:{...config,clientId:'other-customer-client'}};
    if(mode==='public-key')overrides={config:{...config,publishableKey:'sb_publishable_other_fixture'}};
    if(mode==='issuer')overrides={config:{...config,issuer:'https://other.example.test',accountApiUrl:'https://other.example.test/functions/v1/synk-account'}};
    const checks=f.calls.length;await f.restart(overrides);assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(f.calls.length,checks);assert.equal(savedRows(f).length,0);
  });
});

test('temporarily disabled customer login preserves credentials but grants no access before revalidation',async t=>{
  const f=fixture(t);await f.login();const auth=await f.identity.authenticate(f.request()),saved=savedRows(f)[0].ciphertext,checks=f.calls.length;
  await f.restart({config:null});assert.equal(f.identity.status().enabled,false);
  assert.equal(await f.identity.authenticate(f.request()),null);assert.throws(()=>f.begin(),{status:503});
  assert.equal(f.calls.length,checks);assert.equal(savedRows(f)[0].ciphertext,saved);
  f.setStatus(503);await f.restart();await assert.rejects(f.identity.authenticate(f.request()),{status:503});
  f.setStatus(200);const restored=await f.identity.authenticate(f.request());assert.equal(restored.csrfToken,auth.csrfToken);assert.equal(restored.expiresAt,auth.expiresAt);
});

test('unchanged credentials avoid encrypted database rewrites while every request verifies centrally',async t=>{
  const f=fixture(t);await f.login();const saved=savedRows(f)[0].ciphertext,checks=f.calls.length;
  for(let attempt=0;attempt<3;attempt++){assert.ok(await f.identity.authenticate(f.request()));assert.equal(savedRows(f)[0].ciphertext,saved);}
  assert.equal(f.calls.length,checks+3);await f.restart();assert.ok(await f.identity.authenticate(f.request()));
  assert.equal(f.calls.length,checks+4);assert.equal(savedRows(f)[0].ciphertext,saved);
});

test('refresh and repeated restarts do not extend the original eight-hour customer session',async t=>{
  const f=fixture(t);await f.login();const original=await f.identity.authenticate(f.request());
  f.advance(7*3600_000+59*60_000);await f.restart();const fresh=await f.identity.authenticate(f.request());
  assert.equal(fresh.expiresAt,original.expiresAt);assert.equal(fresh.csrfToken,original.csrfToken);assert.equal(refreshCalls(f).length,1);
  f.advance(60_000);await f.restart();const checks=f.calls.length;
  assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(savedRows(f).length,0);assert.equal(f.calls.length,checks);
});

test('rotated refresh and pending access survive central outage and restart without replay',async t=>{
  const f=fixture(t);await f.login();f.advance(3590_000);f.setStatus(503);
  await assert.rejects(f.identity.authenticate(f.request()),{status:503});assert.equal(refreshCalls(f).length,1);
  const pending=f.store.decrypt(savedRows(f)[0].ciphertext);assert.equal(pending.refreshToken,'synthetic-refresh-token-2');assert.ok(pending.pendingAccessToken);
  await f.restart();await assert.rejects(f.identity.authenticate(f.request()),{status:503});assert.equal(refreshCalls(f).length,1);
  f.setStatus(200);assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls(f).length,1);
  f.advance(3590_000);await f.restart();assert.ok(await f.identity.authenticate(f.request()));
  assert.equal(new URLSearchParams(refreshCalls(f)[1].body).get('refresh_token'),'synthetic-refresh-token-2');
});

test('a malformed refreshed access cannot discard the newly rotated refresh across restart',async t=>{
  let malformed=true;
  const f=fixture(t,{fetcher:async(url,init)=>{
    if(malformed&&url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){
      malformed=false;return Response.json({access_token:'bad',refresh_token:'synthetic-rotated-refresh-after-malformed',token_type:'bearer'});
    }
  }});
  await f.login();f.advance(3590_000);await assert.rejects(f.identity.authenticate(f.request()),{status:503});
  assert.equal(f.store.decrypt(savedRows(f)[0].ciphertext).refreshToken,'synthetic-rotated-refresh-after-malformed');
  await f.restart();assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls(f).length,2);
  assert.equal(new URLSearchParams(refreshCalls(f)[1].body).get('refresh_token'),'synthetic-rotated-refresh-after-malformed');
});

test('a refreshed access without usable expiry preserves the rotated refresh and never authorizes',async t=>{
  const invalidAccess='synthetic.'+Buffer.from(JSON.stringify({iss:issuer+'/auth/v1',client_id:config.clientId})).toString('base64url')+'.fixture';
  let malformed=true;const f=fixture(t,{fetcher:async(url,init)=>{
    if(malformed&&url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){
      malformed=false;return Response.json({access_token:invalidAccess,refresh_token:'synthetic-rotated-refresh-missing-expiry',token_type:'bearer'});
    }
  }});
  await f.login();const auth=await f.identity.authenticate(f.request());f.advance(3590_000);
  await assert.rejects(f.identity.authenticate(f.request()),{status:503});assert.equal(f.identity.isCurrent(auth),false);
  assert.equal(f.store.decrypt(savedRows(f)[0].ciphertext).refreshToken,'synthetic-rotated-refresh-missing-expiry');
  assert.equal(f.calls.some(call=>call.url===config.accountApiUrl&&call.headers.Authorization==='Bearer '+invalidAccess),false);
  await f.restart();assert.ok(await f.identity.authenticate(f.request()));
  assert.equal(new URLSearchParams(refreshCalls(f)[1].body).get('refresh_token'),'synthetic-rotated-refresh-missing-expiry');
});

test('expired pending access after an outage rotates the saved new refresh instead of replaying the old one',async t=>{
  const f=fixture(t);await f.login();f.advance(3590_000);f.setStatus(503);
  await assert.rejects(f.identity.authenticate(f.request()),{status:503});f.advance(3610_000);await f.restart();
  await assert.rejects(f.identity.authenticate(f.request()),{status:503});assert.equal(refreshCalls(f).length,2);
  assert.equal(new URLSearchParams(refreshCalls(f)[1].body).get('refresh_token'),'synthetic-refresh-token-2');
  f.setStatus(200);await f.restart();assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls(f).length,2);
});

test('logout of a restored session removes encrypted state even when central revocation is unavailable',async t=>{
  let offline=false;const f=fixture(t,{fetcher:async()=>{if(offline)throw Error('synthetic central outage');}});
  await f.login();const auth=await f.identity.authenticate(f.request());await f.restart();offline=true;
  await assert.rejects(f.identity.logout(f.request({'x-csrf-token':'wrong'}),responseSink()),{status:403});assert.equal(savedRows(f).length,1);
  const result=await f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),responseSink());
  assert.equal(result.localSignedOut,true);assert.equal(result.serverRevoked,false);assert.equal(savedRows(f).length,0);
  offline=false;await f.restart();assert.equal(await f.identity.authenticate(f.request()),null);
});

test('graceful close drains rotation while denying access and restores the new credential',async t=>{
  const gate=defer(),entered=defer();
  const f=fixture(t,{fetcher:async(url,init)=>{if(url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){entered.resolve();await gate.promise;}}});
  await f.login();const auth=await f.identity.authenticate(f.request());f.advance(3590_000);
  const pending=f.identity.authenticate(f.request());await entered.promise;let drained=false;
  const closing=f.identity.close().then(()=>{drained=true;});
  try{await Promise.resolve();assert.equal(drained,false);assert.equal(f.identity.isCurrent(auth),false);assert.equal(f.identity.isCurrentUser(auth.user),false);assert.equal(await f.identity.authenticate(f.request()),null);}finally{gate.resolve();}
  assert.equal(await pending,null);await closing;assert.equal(drained,true);
  assert.equal(f.store.decrypt(savedRows(f)[0].ciphertext).refreshToken,'synthetic-refresh-token-2');
  await f.restart();assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls(f).length,1);
});

test('logout during graceful close and refresh cannot resurrect persisted access',async t=>{
  const gate=defer(),entered=defer();
  const f=fixture(t,{fetcher:async(url,init)=>{if(url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){entered.resolve();await gate.promise;}}});
  await f.login();const auth=await f.identity.authenticate(f.request()),oldBearer=f.calls.at(-1).headers.Authorization;f.advance(3590_000);
  const pending=f.identity.authenticate(f.request());await entered.promise;const closing=f.identity.close();
  const logout=f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),responseSink());
  try{assert.equal(savedRows(f).length,0);}finally{gate.resolve();}
  assert.equal(await pending,null);await closing;assert.equal((await logout).serverRevoked,true);assert.equal(savedRows(f).length,0);
  assert.notEqual(f.calls.find(call=>call.url===config.accountApiUrl&&call.method==='POST').headers.Authorization,oldBearer);
  await f.restart();assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(savedRows(f).length,0);
});

test('logout after close but before dispose still removes the restored session permanently',async t=>{
  const f=fixture(t);await f.login();const auth=await f.identity.authenticate(f.request());await f.restart();await f.identity.close();
  const result=await f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),responseSink());
  assert.equal(result.localSignedOut,true);assert.equal(result.serverRevoked,true);assert.equal(savedRows(f).length,0);
  await f.restart();assert.equal(await f.identity.authenticate(f.request()),null);
});

test('a late OAuth callback after close cannot install persisted credentials',async t=>{
  const gate=defer(),entered=defer();const f=fixture(t,{fetcher:async(url)=>{if(url.endsWith('/oauth/token')){entered.resolve();await gate.promise;}}});
  const beginning=f.begin(),pending=f.complete(beginning);const rejected=assert.rejects(pending,{status:401});await entered.promise;
  const closing=f.identity.close();gate.resolve();await rejected;await closing;assert.equal(savedRows(f).length,0);
  await f.restart();assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(savedRows(f).length,0);
});
