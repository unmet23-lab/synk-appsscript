import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { createSocialPublishingProvider } from './social-publishing-provider.mjs';

async function credentialFixture(t,handler){
  const directory=await mkdtemp(join(tmpdir(),'synk-credential-renewal-'));let getCredentials,at=Date.now(),calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(new URL(url).origin,'https://oauth2.googleapis.com');calls++;return handler(url,options,calls);});
  const options={dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>new Date(at).toISOString(),socialProviderFactory:input=>{getCredentials=input.getCredentials;return createSocialPublishingProvider(input);}};
  let app=createCompanyApp(options);t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const user={id:'connector',name:'Synthetic connector',email:'connector@example.test',role:'admin',active:true},channel={id:'renewal',platform:'youtube',active:true,ownerIds:[user.id],connectionVersion:1};
  const credentials={accessToken:'synthetic-old-access',refreshToken:'synthetic-refresh',expiresAt:new Date(at-60000).toISOString(),scope:'granted',accountId:'synthetic-account',connectedBy:user.id};
  app.store.put('users',user.id,user);app.store.put('channels',channel.id,channel);app.store.setSecret('provider:youtube',{clientId:'synthetic-client',clientSecret:'synthetic-client-secret'});app.store.setSecret('channel:'+channel.id,credentials);
  return {get app(){return app;},channel,credentials,user,get:()=>getCredentials(channel),calls:()=>calls,advance:ms=>at+=ms,restart:async()=>{await app.stop();app=createCompanyApp(options);}};
}

test('concurrent collectors, health checks and publishers share one credential refresh',async t=>{
  let release;const hold=new Promise(resolve=>release=resolve);
  const f=await credentialFixture(t,async()=>{await hold;return {ok:true,status:200,json:async()=>({access_token:'synthetic-rotated',expires_in:3600})};});
  const tasks=Array.from({length:3},()=>f.get());release();const results=await Promise.all(tasks);
  assert.equal(f.calls(),1);assert.ok(results.every(value=>value.accessToken==='synthetic-rotated'));
  const saved=f.app.store.secret('channel:'+f.channel.id);assert.equal(saved.refreshToken,f.credentials.refreshToken);assert.equal(saved.scope,'granted');assert.equal(saved.accountId,'synthetic-account');
  await f.get();assert.equal(f.calls(),1);
});

test('a newer secret cannot be overwritten by an older in-flight refresh even in the same channel version',async t=>{
  let release,began;const hold=new Promise(resolve=>release=resolve),started=new Promise(resolve=>began=resolve);
  const f=await credentialFixture(t,async()=>{began();await hold;return {ok:true,status:200,json:async()=>({access_token:'stale-result',expires_in:3600})};});
  const result=f.get();await started;const newer={...f.credentials,accessToken:'newly-reconnected',refreshToken:'new-refresh',expiresAt:new Date(Date.now()+3600000).toISOString()};
  f.app.store.setSecret('channel:'+f.channel.id,newer);release();await assert.rejects(result,{code:'CONNECTION_CHANGED'});
  assert.deepEqual(f.app.store.secret('channel:'+f.channel.id),newer);
});

test('revoked access is checked before asking the provider to refresh',async t=>{
  const f=await credentialFixture(t,async()=>({ok:true,status:200,json:async()=>({access_token:'must-not-request',expires_in:3600})}));
  f.app.store.put('users',f.user.id,{...f.user,active:false});await assert.rejects(f.get(),{code:'CONNECTION_OWNER_INACTIVE'});assert.equal(f.calls(),0);
  assert.deepEqual(f.app.store.secret('channel:'+f.channel.id),f.credentials);
});

test('refresh outages retain credentials and back off across callers and a server restart',async t=>{
  const f=await credentialFixture(t,async()=>({ok:false,status:503}));
  await assert.rejects(f.get(),{code:'oauth_unavailable'});await assert.rejects(f.get(),{code:'oauth_unavailable'});assert.equal(f.calls(),1);
  assert.deepEqual(f.app.store.secret('channel:'+f.channel.id),f.credentials);await f.restart();await assert.rejects(f.get(),{code:'oauth_unavailable'});assert.equal(f.calls(),1);
  f.advance(15*60000);await assert.rejects(f.get(),{code:'oauth_unavailable'});assert.equal(f.calls(),2);
  f.app.store.setSecret('channel:'+f.channel.id,{...f.credentials,refreshToken:'new-authorized-refresh'});await assert.rejects(f.get(),{code:'oauth_unavailable'});assert.equal(f.calls(),3);
});

for (const change of ['disconnect', 'deactivate']) {
  test(`${change} during token refresh cannot restore credentials or collect data`, async t => {
    let release, began;
    const started = new Promise(resolve => { began = resolve; });
    const response = new Promise(resolve => { release = resolve; });
    const nativeFetch = globalThis.fetch;
    let collectorCalls = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (String(url) === 'https://oauth2.googleapis.com/token') {
        began();
        await response;
        return {ok:true, status:200, json:async()=>({access_token:'rotated-test-token', expires_in:3600})};
      }
      return nativeFetch(url, options);
    });
    const dir = await mkdtemp(join(tmpdir(), 'synk-refresh-race-'));
    const app = createCompanyApp({dataDir:dir, port:0, allowTestHost:true, schedule:false,
      collector:async()=>{collectorCalls++;return {channel:{externalId:'channel-test'},posts:[],coverage:{status:'complete'},warnings:[]};}});
    const address = await app.start(), base = `http://127.0.0.1:${address.port}`;
    t.after(async()=>{release();await app.stop();await rm(dir,{recursive:true,force:true});});
    const admin = app.store.createUser({name:'Admin',email:'admin@example.test',password:'valid-admin-password',role:'admin'});
    const staff = app.store.createUser({name:'Staff',email:'staff@example.test',password:'valid-staff-password'});
    const sessionToken = app.store.mint('session',admin.id,{csrfToken:'fixture-csrf'},10);
    const post = async (path,body) => {
      const res = await nativeFetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'fixture-csrf',Cookie:`synk_company_session=${sessionToken}`},body:JSON.stringify(body)});
      return {status:res.status,data:await res.json()};
    };
    const added = await post('/api/channels',{urls:'https://youtube.com/@company',ownerId:staff.id});
    assert.equal(added.status,201);
    const channel = added.data.added[0];
    app.store.setSecret('provider:youtube',{clientId:'fixture-client',clientSecret:'fixture-secret'});
    app.store.setSecret('channel:'+channel.id,{accessToken:'expired-test-token',refreshToken:'test-refresh-token',expiresAt:new Date(Date.now()-60000).toISOString(),connectedBy:staff.id});
    assert.equal((await post(`/api/channels/${channel.id}/collect`,{})).status,202);
    await started;
    assert.equal((await post(change==='disconnect'?`/api/channels/${channel.id}/disconnect`:`/api/members/${staff.id}/status`,change==='disconnect'?{}:{active:false})).status,200);
    assert.equal(app.store.secret('channel:'+channel.id),null);
    release();
    await app.waitForIdle();
    assert.equal(app.store.secret('channel:'+channel.id),null);
    assert.equal(collectorCalls,0);
    assert.equal(app.store.all('channelSnapshots').length,0);
    assert.equal(app.store.all('snapshots').length,0);
    assert.equal(app.store.all('runs')[0].status,'error');
  });
}

test('credentials are held back with a reason code a publisher can show',async()=>{
  const {credentialHoldReason}=await import('./server.mjs'),channel={connectionVersion:2};
  assert.equal(credentialHoldReason(null,channel,undefined)[0],'CHANNEL_INACTIVE');
  assert.equal(credentialHoldReason({active:true,collectionDisabled:true,connectionVersion:2},channel,undefined)[0],'COLLECTION_DISABLED');
  assert.equal(credentialHoldReason({active:true,connectionVersion:3},channel,undefined)[0],'CONNECTION_CHANGED');
  assert.equal(credentialHoldReason({active:true,connectionVersion:2},channel,{active:false})[0],'CONNECTION_OWNER_INACTIVE');
  assert.equal(credentialHoldReason({active:true,connectionVersion:2},channel,null)[0],'CONNECTION_OWNER_INACTIVE','a connector who no longer exists');
  assert.equal(credentialHoldReason({active:true,connectionVersion:2},channel,undefined),null,'no connector recorded');
  assert.equal(credentialHoldReason({active:true,connectionVersion:2},channel,{active:true}),null);
  for(const reason of [credentialHoldReason(null,channel),credentialHoldReason({active:true,connectionVersion:2},channel,{active:false})])assert.match(reason[1],/요\.$/);
});
