'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const {generateKeyPairSync, createHash, sign} = require('node:crypto');
const {once} = require('node:events');
const {createChatGPTConnection} = require('../src/chatgpt-connection.cjs');

const issuer = 'https://auth.openai.com';
const metadata = {issuer, authorization_endpoint: issuer + '/api/accounts/authorize', token_endpoint: issuer + '/api/accounts/oauth/token', jwks_uri: issuer + '/.well-known/jwks.json', id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['none']};
const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'fixture-rsa', alg: 'RS256', use: 'sig'};
const hash = input => createHash('sha256').update(input).digest('base64url');
const store = {isEncryptionAvailable: () => true, encryptString: text => Buffer.from(text).map(b => b ^ 0x5e), decryptString: blob => Buffer.from(blob).map(b => b ^ 0x5e).toString('utf8')};
const json = value => new Response(JSON.stringify(value), {headers: {'content-type':'application/json'}});
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const member = {owner:'test-member-one', generation:4};
function token(claims, header = {alg:'RS256', kid:jwk.kid}) {
  const payload = b64(header) + '.' + b64(claims);
  return payload + '.' + sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url');
}
async function freePort() {
  const server = http.createServer();
  server.listen(0,'127.0.0.1'); await once(server, 'listening');
  const {port} = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function fixture(t) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'solio-oidc-'));
  const registration = {issuer, clientId:'oaiapp_soliosynthetic', redirectUri:'http://127.0.0.1:' + await freePort() + '/solio/openai/callback', tokenEndpointAuthMethod:'none'};
  const f = {member, urls:[], requests:[], clock:Date.now(), meta:metadata, jwks:{keys:[jwk]}, mutate:claims=>claims, openError:false, exchange:null, subject:'fixture-subject-A', registration};
  const options = {
    registration, userData, safeStorage:store, session:()=>f.member, now:()=>f.clock,
    openExternal: async link => { if (f.openError) throw Error('NO_BROWSER'); f.urls.push(new URL(link)); },
    fetcher: async (input, options) => {
      const url = String(input); f.requests.push(url); assert.equal(options.redirect,'error');
      if (url === issuer+'/.well-known/openid-configuration') return json(f.meta);
      if (url === metadata.jwks_uri) return json(f.jwks);
      assert.equal(url, metadata.token_endpoint); assert.equal(options.method,'POST');
      const body = new URLSearchParams(options.body);
      assert.equal(body.get('grant_type'),'authorization_code'); assert.equal(body.get('client_id'), registration.clientId);
      assert.equal(body.get('redirect_uri'),registration.redirectUri); assert.equal(body.has('client_secret'),false);
      assert.equal(body.get('code'),'fixture-code'); const current = f.urls.at(-1);
      assert.equal(hash(body.get('code_verifier')),current.searchParams.get('code_challenge'));
      if (f.exchange) await f.exchange();
      const seconds = Math.floor(f.clock/1000);
      const claims = f.mutate({sub:f.subject,iss:issuer,aud:registration.clientId,nonce:current.searchParams.get('nonce'),exp:seconds+300,iat:seconds});
      return json({id_token:token(claims), ...(f.extraTokens ? {access_token:'DO_NOT_SAVE_ACCESS',refresh_token:'DO_NOT_SAVE_REFRESH'} : {})});
    }
  };
  const instances=[];
  f.create=(overrides={})=>{const conn=createChatGPTConnection({...options,...overrides});instances.push(conn);return conn;};
  f.conn=f.create(); f.userData=userData;
  f.callback=(overrides={})=>{
    const url=new URL(registration.redirectUri);
    url.searchParams.set('state',f.urls.at(-1).searchParams.get('state'));
    url.searchParams.set('code','fixture-code');
    for(const [k,v] of Object.entries(overrides)){if(v===null)url.searchParams.delete(k);else url.searchParams.set(k,v);}
    return fetch(url,{redirect:'error'});
  };
  t.after(()=>{for(const conn of instances)conn.close();fs.rmSync(userData,{recursive:true,force:true});});
  return f;
}
test('unregistered public build cannot open a browser, access a mailbox, or start a worker',async t=>{
  const f=await fixture(t);const c=f.create({registration:require('../src/chatgpt-partner.json')});
  assert.equal(c.status().state,'pending-approval');
  await c.connect();assert.equal(c.status().state,'pending-approval');assert.deepEqual(f.requests,[]);assert.deepEqual(f.urls,[]);
  const {enabled}=require('../src/office-task-runtime.cjs');
  for(const mode of ['development','release']) assert.equal(enabled({packaged:true,mode,clientId:'platform',platform:'win32',smoke:false}),false);
});
test('real loopback, PKCE and a signed identity-only response; restart, member change and unlink',async t=>{
  const f=await fixture(t); const c=f.conn;
  assert.equal(c.status().state,'disconnected');
  assert.equal((await c.connect()).state,'connecting');
  const auth=f.urls[0];
  assert.equal(auth.origin+auth.pathname, metadata.authorization_endpoint);
  assert.equal(auth.searchParams.get('scope'),'openid');
  assert.equal(auth.searchParams.get('response_type'),'code');
  assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
  assert.equal(auth.searchParams.get('redirect_uri'),f.registration.redirectUri);
  assert.ok(auth.searchParams.get('state').length>=40 && auth.searchParams.get('nonce').length>=40);
  assert.notEqual(auth.searchParams.get('nonce'),auth.searchParams.get('state'));
  assert.equal((await c.connect()).state,'connecting'); assert.equal(f.urls.length,1);
  assert.equal((await f.callback({state:'wrong'})).status,400);
  assert.equal((await f.callback()).status,200);
  const state=c.status();assert.equal(state.state,'connected');assert.ok(Number.isFinite(state.verifiedAt));
  assert.doesNotMatch(JSON.stringify(state),/fixture-subject|id_token|@|access_token|refresh_token/);
  const again=f.create();assert.equal(again.status().state,'connected');
  f.member={owner:'test-member-two',generation:5};again.accountChanged();assert.equal(again.status().state,'disconnected');
  f.member={...member,generation:6};again.accountChanged();assert.equal(again.status().state,'connected');
  f.clock+=31*86400000;assert.equal(again.status().state,'recheck');
  await again.disconnect();assert.equal(again.status().state,'disconnected');
});
test('cancel, consent denial, bad browser, occupied callback and account change are recoverable',async t=>{
  const f=await fixture(t);const c=f.conn;
  f.openError=true;assert.equal((await c.connect()).ok,false);assert.equal(c.status().state,'disconnected');f.openError=false;
  const blocker=http.createServer();blocker.listen(Number(new URL(f.registration.redirectUri).port),'127.0.0.1');await once(blocker,'listening');
  try {assert.equal((await c.connect()).ok,false);} finally {await new Promise(r=>blocker.close(r));}
  await c.connect();await c.cancel();assert.equal(c.status().state,'disconnected');
  await c.connect();await f.callback({code:null,error:'access_denied'});assert.equal(c.status().state,'disconnected');
  await c.connect();f.member={owner:'test-member-two',generation:7};c.accountChanged();assert.equal(c.status().state,'disconnected');
  assert.equal(f.requests.includes(metadata.token_endpoint),false);
});
test('late token exchange cannot re-create a binding after disconnect or switch',async t=>{
  for(const action of ['disconnect','switch']){
    const f=await fixture(t);const c=f.conn;
    const started=Promise.withResolvers(),allow=Promise.withResolvers();
    f.exchange=async()=>{started.resolve();await allow.promise;};
    await c.connect();const callback=f.callback().catch(()=>null);await started.promise;
    if(action==='switch'){f.member={owner:'test-member-two',generation:9};c.accountChanged();} else await c.disconnect();
    allow.resolve();await callback;assert.equal(c.status().state,'disconnected');
    f.member={...member,generation:10};c.accountChanged();assert.equal(c.status().state,'disconnected');
  }
});
test('discovery endpoints, public registration and local OS encryption fail closed',async t=>{
  const f=await fixture(t);const c=f.conn;
  f.meta={...metadata,token_endpoint:'https://elsewhere.invalid/token'};await c.connect();assert.equal(f.urls.length,0);assert.equal(f.requests.every(x=>x.startsWith(issuer+'/')),true);
  f.meta={...metadata,authorization_endpoint:'blob:'+issuer+'/uuid'};await c.connect();assert.equal(f.urls.length,0);
  f.meta=metadata;const before=f.requests.length;
  for(const registration of [{...f.registration,clientId:'dynamic_agent_client'},{...f.registration,redirectUri:'http://example.org/callback'},{...f.registration,clientSecret:'forbidden'},{...f.registration,tokenEndpointAuthMethod:'client_secret_post'}]){
    const bad=f.create({registration});assert.equal((await bad.connect()).state,'pending-approval');assert.equal(f.requests.length,before);
  }
  const c2=f.create({safeStorage:{...store,isEncryptionAvailable:()=>false}});assert.equal((await c2.connect()).state,'storage-error');assert.equal(f.requests.length,before);assert.equal(f.urls.length,0);
});
test('invalid signed claims and signing keys never create a link',async t=>{
  const changes=[
    v=>({...v,iss:'https://elsewhere.invalid'}),v=>({...v,aud:'other'}),
    v=>({...v,aud:[v.aud,'other']}),v=>({...v,aud:[v.aud,'other'],azp:v.aud}),v=>({...v,azp:'other'}),
    v=>({...v,exp:v.iat-120}),v=>({...v,iat:v.iat+1000}),v=>({...v,sub:''}),v=>({...v,nonce:'other'})];
  for(const mutate of changes){
    const f=await fixture(t);f.mutate=mutate;await f.conn.connect();assert.notEqual((await f.callback()).status,200);assert.equal(f.conn.status().state,'disconnected');
  }
  const f=await fixture(t);f.jwks={keys:[{...jwk,kid:'another'}]};
  await f.conn.connect();assert.notEqual((await f.callback()).status,200);assert.equal(f.conn.status().state,'disconnected');
});
test('an existing owner binding cannot silently change subject; token values are never persisted',async t=>{
  const f=await fixture(t);f.extraTokens=true;const c=f.conn;
  await c.connect();await f.callback();f.clock+=31*86400000;f.subject='fixture-subject-B';
  await c.connect();assert.notEqual((await f.callback()).status,200);assert.equal(c.status().state,'recheck');
  const dir=fs.readdirSync(f.userData,{recursive:true,withFileTypes:true}).filter(x=>x.isFile());assert.equal(dir.length,1);
  const content=fs.readFileSync(path.join(dir[0].parentPath,dir[0].name));assert.doesNotMatch(content.toString(),/fixture-subject|DO_NOT_SAVE/);
  assert.doesNotMatch(store.decryptString(content),/DO_NOT_SAVE|id_token|access_token|refresh_token|fixture-subject-B/);
});
test('callback validates the host, unique parameters, timeout and a single authorization code',async t=>{
  const f=await fixture(t), c=f.conn;
  await c.connect();
  const u=new URL(f.registration.redirectUri), state=f.urls.at(-1).searchParams.get('state');
  u.searchParams.set('state',state);u.searchParams.set('code','fixture-code');
  const bad=await new Promise((resolve,reject)=>{
    const req=http.get(u,{headers:{Host:'unrelated.invalid'}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);
  });
  assert.equal(bad,400);
  u.searchParams.append('code','duplicate');assert.equal((await fetch(u)).status,400);
  const started=Promise.withResolvers(),allow=Promise.withResolvers();
  f.exchange=async()=>{started.resolve();await allow.promise;};
  const first=f.callback();await started.promise;
  const next=await f.callback().then(res=>res.status).catch(()=>410);assert.notEqual(next,200);
  allow.resolve();assert.equal((await first).status,200);
  assert.equal(f.requests.filter(url=>url===metadata.token_endpoint).length,1);
  await c.disconnect();
  const second=f.create({timeoutMs:80});assert.equal((await second.connect()).state,'connecting');await new Promise(r=>setTimeout(r,140));
  assert.equal(second.status().state,'disconnected');assert.equal(second.status().code,'TIMEOUT');
  assert.equal(await f.callback().then(r=>r.status).catch(()=>410),410);
});
test('a signed-out owner has no user-scoped state or launch; a damaged encrypted record can be removed',async t=>{
  const f=await fixture(t);f.member=null;await f.conn.connect();assert.equal(f.urls.length,0);
  f.member={...member};await f.conn.connect();await f.callback();
  const file=fs.readdirSync(f.userData,{withFileTypes:true,recursive:true}).find(x=>x.isFile());
  fs.writeFileSync(path.join(file.parentPath,file.name),'invalid envelope');
  assert.equal(f.conn.status().state,'disconnected');
  assert.equal((await f.conn.connect()).state,'connecting');assert.equal((await f.callback()).status,200);
});
test('key rotation retries one key set and expanded claims convey no plan grant',async t=>{
  const f=await fixture(t);
  let reads=0;
  Object.defineProperty(f,'jwks',{get:()=>({keys:[++reads===1?{...jwk,kid:'retired'}:jwk]})});
  f.extraTokens=true;f.mutate=v=>({...v,azp:f.registration.clientId,aud:[f.registration.clientId],plan:'pro',scope:'offline_access'});
  await f.conn.connect();assert.equal((await f.callback()).status,200);assert.equal(reads,2);
  assert.equal(f.conn.status().state,'connected');assert.equal(f.conn.status().planUse,false);
});
test('a copied encrypted member record is rejected and interrupted writes do not replace the prior connection',async t=>{
  const f=await fixture(t), c=f.conn;await c.connect();await f.callback();
  const [entry]=fs.readdirSync(f.userData,{recursive:true,withFileTypes:true}).filter(x=>x.isFile());
  const ownerA=path.join(entry.parentPath,entry.name), original=fs.readFileSync(ownerA);
  fs.writeFileSync(ownerA+'.pending','interrupted');assert.equal(f.create().status().state,'connected');assert.equal(fs.existsSync(ownerA+'.pending'),false);
  f.member={owner:'test-member-two',generation:40};c.accountChanged();await c.connect();await f.callback();
  const other=fs.readdirSync(entry.parentPath).find(n=>n!==entry.name);fs.copyFileSync(ownerA,path.join(entry.parentPath,other));
  assert.equal(c.status().state,'disconnected');assert.equal((await c.connect()).state,'connecting');assert.equal((await f.callback()).status,200);
  assert.deepEqual(fs.readFileSync(ownerA),original);
});
test('expiry is measured after downloading the signing keys',async t=>{
  const f=await fixture(t);
  f.mutate=v=>({...v,exp:v.iat+4});
  Object.defineProperty(f,'jwks',{get:()=>{f.clock+=12000;return {keys:[jwk]};}});
  await f.conn.connect();assert.notEqual((await f.callback()).status,200);assert.equal(f.conn.status().state,'disconnected');
});
test('small local clock skew can sign in, and a provider outage can be retried',async t=>{
  const f=await fixture(t);f.mutate=v=>({...v,iat:v.iat+12,exp:v.exp+12});
  await f.conn.connect();assert.equal((await f.callback()).status,200);await f.conn.disconnect();
  f.exchange=()=>{throw Error('provider offline');};
  await f.conn.connect();assert.notEqual((await f.callback()).status,200);assert.equal(f.conn.status().code,'NETWORK');
  f.exchange=null;
  assert.equal((await f.conn.connect()).state,'connecting');assert.equal((await f.callback()).status,200);
  assert.equal(f.conn.status().state,'connected');
});

