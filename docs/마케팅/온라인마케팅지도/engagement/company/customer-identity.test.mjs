import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
function fixture(options={}){
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
  const identity=createCustomerIdentity({origin,config:options.disabled?null:config,fetch:fetcher,now:()=>stamp});
  function request(extra={}){return {headers:{origin,cookie:[...jar].map(([key,value])=>key+'='+value).join('; '),...extra},socket:{remoteAddress:'127.0.0.1'}};}
  function apply(res){for(const pair of cookieValues(res)){const index=pair.indexOf('='),key=pair.slice(0,index),value=pair.slice(index+1);if(value)jar.set(key,value);else jar.delete(key);}}
  function begin(){const res=responseSink(),result=identity.start(request(),res);apply(res);return {url:new URL(result.authorizationUrl),result,res};}
  async function complete(beginning){const res=responseSink(),url=new URL(config.redirectUri);url.search=new URLSearchParams({state:beginning.url.searchParams.get('state'),code:'synthetic-one-time-code'});const result=await identity.callback(request(),res,url);apply(res);return {result,res,url};}
  return {identity,calls,jar,request,apply,begin,complete,token,advance:ms=>stamp+=ms,setStatus:value=>centralStatus=value,setActive:value=>active=value,setAccount:value=>accountId=value,setClaims:value=>claimOverrides=value,setSessions:value=>currentSessions=value,async login(){return complete(begin());}};
}

test('customer configuration is independent and fails closed for incomplete or employee settings',()=>{
  assert.equal(customerIdentityConfig({}),null);
  assert.equal(customerIdentityConfig({SYNK_ID_MESSENGER_CLIENT_ID:'employee'}),null);
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_CLIENT_ID:''}));
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_MESSENGER_CLIENT_ID:env.SYNK_ID_CUSTOMER_CLIENT_ID}));
  for(const key of ['sb_secret_hidden',`x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`,'not-a-public-key'])assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_PUBLISHABLE_KEY:key}));
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_ACCOUNT_API_URL:'https://other.example.test/functions/v1/synk-account'}));
  assert.throws(()=>customerIdentityConfig({...env,SYNK_ID_CUSTOMER_REDIRECT_URI:origin+'/api/synk-id/callback'}));
  assert.throws(()=>createCustomerIdentity({origin,config:{...config,product:'messenger'}}));
  assert.throws(()=>createCustomerIdentity({origin:'https://other.example.test',config}));
});

test('missing registration settings keep customer login closed without making a remote request',async()=>{
  const f=fixture({disabled:true});assert.equal(f.identity.status().enabled,false);
  assert.equal(await f.identity.authenticate(f.request()),null);
  assert.throws(()=>f.begin(),{status:503,code:'CUSTOMER_NOT_CONFIGURED'});assert.equal(f.calls.length,0);
});

test('PKCE is server-side and customer cookies never expose tokens or employee credentials',async()=>{
  const f=fixture(),start=f.begin();
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

test('origin, flow cookie, expiry and one-time state prevent cross-browser login and replay',async()=>{
  const f=fixture();assert.throws(()=>f.identity.start(f.request({origin:'https://attacker.example.test'}),responseSink()),{status:403});
  const start=f.begin(),url=new URL(config.redirectUri+'?state='+start.url.searchParams.get('state')+'&code=fixture');
  await assert.rejects(f.identity.callback(f.request({cookie:''}),responseSink(),url),{status:403});
  await f.complete(start);await assert.rejects(f.identity.callback(f.request(),responseSink(),url),{status:403});
  const expired=f.begin();f.advance(5*60_000);await assert.rejects(f.complete(expired),{status:403});
});

test('callback rejects ambiguous queries and a different callback origin',async()=>{
  const f=fixture(),start=f.begin(),state=start.url.searchParams.get('state');
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
  for(const [name,prepare]of Object.entries(scenarios))await t.test(name,async()=>{const f=fixture();prepare(f);await assert.rejects(f.login(),{status:401});assert.equal(f.jar.has('synk_customer_session'),false);assert.equal(await f.identity.authenticate(f.request()),null);});
});

test('every protected request rechecks central identity and staff cookies cannot authenticate a customer',async()=>{
  const f=fixture();await f.login();const before=f.calls.length;
  const first=await f.identity.authenticate(f.request()),second=await f.identity.authenticate(f.request());
  assert.equal(f.calls.length,before+2);assert.equal(first.user,second.user);
  assert.equal(await f.identity.authenticate(f.request({cookie:'synk_company_session='+f.jar.get('synk_customer_session')})),null);
  assert.equal(await f.identity.authenticate(f.request({cookie:'synk_customer_session='+f.jar.get('synk_customer_session')+'; synk_customer_session='+f.jar.get('synk_customer_session')})),null);
});

test('object identity and CSRF prevent forged customer privileges and cross-origin writes',async()=>{
  const f=fixture();await f.login();const auth=await f.identity.authenticate(f.request());
  assert.ok(f.identity.isCurrent(auth));assert.ok(f.identity.isCurrentUser(auth.user));
  assert.equal(f.identity.isCurrent({...auth}),false);assert.equal(f.identity.isCurrentUser({...auth.user}),false);
  assert.equal(f.identity.isCurrentUser({id:'synk:'+id}),false);
  assert.throws(()=>f.identity.requireCsrf(f.request({'x-csrf-token':'wrong'}),auth),{status:403});
  assert.throws(()=>f.identity.requireCsrf(f.request({'x-csrf-token':'가'.repeat(43)}),auth),{status:403});
  assert.throws(()=>f.identity.requireCsrf(f.request({origin:'https://other.example.test','x-csrf-token':auth.csrfToken}),auth),{status:403});
  f.identity.requireCsrf(f.request({'x-csrf-token':auth.csrfToken}),auth);
});

test('revocation and a central account switch invalidate earlier authorization objects immediately',async()=>{
  for(const mutate of [f=>f.setStatus(401),f=>f.setActive(false),f=>f.setAccount(otherId)]){
    const f=fixture();await f.login();const auth=await f.identity.authenticate(f.request());mutate(f);
    assert.equal(await f.identity.authenticate(f.request()),null);assert.equal(f.identity.isCurrent(auth),false);assert.equal(f.identity.isCurrentUser(auth.user),false);
  }
});

test('temporary central failure blocks customer access and can recover only after a new check',async()=>{
  const f=fixture();await f.login();const auth=await f.identity.authenticate(f.request());f.setStatus(503);
  await assert.rejects(f.identity.authenticate(f.request()),{status:503,retryable:true});assert.equal(f.identity.isCurrent(auth),false);assert.equal(f.identity.isCurrentUser(auth.user),false);
  f.setStatus(200);assert.equal((await f.identity.authenticate(f.request())).user,auth.user);assert.ok(f.identity.isCurrent(auth));
});

test('refresh rotation survives a failed central check without replaying the consumed refresh token',async()=>{
  const f=fixture();await f.login();f.advance(3590_000);f.setStatus(503);
  await assert.rejects(f.identity.authenticate(f.request()),{status:503});
  const refreshCalls=()=>f.calls.filter(call=>call.body&&new URLSearchParams(call.body).get('grant_type')==='refresh_token');
  assert.equal(refreshCalls().length,1);assert.equal(new URLSearchParams(refreshCalls()[0].body).get('refresh_token'),'synthetic-refresh-token-1');
  f.setStatus(200);assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls().length,1);
  f.advance(3590_000);assert.ok(await f.identity.authenticate(f.request()));assert.equal(refreshCalls().length,2);assert.equal(new URLSearchParams(refreshCalls()[1].body).get('refresh_token'),'synthetic-refresh-token-2');
});

test('concurrent refresh requests share rotation and each receives the same unforgeable customer identity',async()=>{
  const gate=defer(),entered=defer();
  const f=fixture({fetcher:async(url,init)=>{if(url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){entered.resolve();await gate.promise;}}});
  await f.login();f.advance(3590_000);const a=f.identity.authenticate(f.request());await entered.promise;const b=f.identity.authenticate(f.request());gate.resolve();
  const [first,second]=await Promise.all([a,b]);assert.equal(first.user,second.user);
  assert.equal(f.calls.filter(call=>call.body&&new URLSearchParams(call.body).get('grant_type')==='refresh_token').length,1);
});

test('logout requires customer CSRF and removes privileges before remote revoke completes',async()=>{
  const gate=defer(),entered=defer();const f=fixture({fetcher:async(url,init)=>{if(url===config.accountApiUrl&&init.method==='POST'){entered.resolve();await gate.promise;}}});
  await f.login();const auth=await f.identity.authenticate(f.request());
  await assert.rejects(f.identity.logout(f.request(),responseSink()),{status:403});assert.ok(f.identity.isCurrent(auth));
  const res=responseSink(),pending=f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),res);await entered.promise;
  assert.equal(f.identity.isCurrent(auth),false);assert.equal(f.identity.isCurrentUser(auth.user),false);assert.equal(await f.identity.authenticate(f.request()),null);
  gate.resolve();const result=await pending;assert.equal(result.serverRevoked,true);assert.equal(result.localSignedOut,true);
  const revoke=f.calls.find(call=>call.url===config.accountApiUrl&&call.method==='POST');assert.deepEqual(JSON.parse(revoke.body),{action:'revoke-session',session_id:sessionId});
  assert.ok(f.calls.some(call=>call.url===issuer+'/auth/v1/logout?scope=local'));
  assert.ok(res.getHeader('Set-Cookie').every(row=>row.includes('Max-Age=0')));
});

test('logout during refresh does not resurrect a session and revokes the newly rotated bearer',async()=>{
  const gate=defer(),entered=defer();const f=fixture({fetcher:async(url,init)=>{if(url.endsWith('/oauth/token')&&new URLSearchParams(init.body).get('grant_type')==='refresh_token'){entered.resolve();await gate.promise;}}});
  await f.login();const auth=await f.identity.authenticate(f.request()),oldBearer=f.calls.at(-1).headers.Authorization;f.advance(3590_000);
  const pending=f.identity.authenticate(f.request());await entered.promise;
  const logout=f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),responseSink());assert.equal(f.identity.isCurrent(auth),false);
  gate.resolve();assert.equal(await pending,null);assert.equal((await logout).serverRevoked,true);
  const revoke=f.calls.find(call=>call.method==='POST'&&call.url===config.accountApiUrl);assert.notEqual(revoke.headers.Authorization,oldBearer);assert.equal(await f.identity.authenticate(f.request()),null);
});

test('logout can cancel an in-flight first login before it installs a customer session',async()=>{
  const gate=defer(),entered=defer();const f=fixture({fetcher:async(url)=>{if(url.endsWith('/oauth/token')){entered.resolve();await gate.promise;}}});
  const start=f.begin(),pending=f.complete(start);await entered.promise;
  await f.identity.logout(f.request(),responseSink());gate.resolve();await assert.rejects(pending,{status:401});assert.equal(await f.identity.authenticate(f.request()),null);
});

test('logout remains local-successful during provider failure and never reports remote revoke success',async()=>{
  let offline=false;const f=fixture({fetcher:async()=>{if(offline)throw Error('synthetic network failure');}});
  await f.login();const auth=await f.identity.authenticate(f.request());offline=true;
  const result=await f.identity.logout(f.request({'x-csrf-token':auth.csrfToken}),responseSink());assert.equal(result.localSignedOut,true);assert.equal(result.serverRevoked,false);assert.equal(f.identity.isCurrent(auth),false);
});

test('memory session expiry and shutdown require a fresh login',async()=>{
  const f=fixture();await f.login();const auth=await f.identity.authenticate(f.request());f.advance(8*3600_000);
  assert.equal(f.identity.isCurrentUser(auth.user),false);assert.equal(await f.identity.authenticate(f.request()),null);
  const next=fixture();await next.login();const current=await next.identity.authenticate(next.request());next.identity.close();assert.equal(next.identity.isCurrent(current),false);assert.equal(next.identity.isCurrentUser(current.user),false);assert.equal(await next.identity.authenticate(next.request()),null);assert.equal(next.identity.status().enabled,false);
});
