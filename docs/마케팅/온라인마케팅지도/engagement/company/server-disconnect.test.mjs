import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';

async function fixture(t,collector){
  const dir=await mkdtemp(join(tmpdir(),'synk-disconnect-'));
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,collector});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(dir,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Admin',email:'admin@example.test',password:'valid-admin-password',role:'admin'});
  const session=app.store.mint('session',admin.id,{csrfToken:'fixture-csrf'},10);
  const call=async(path,body)=>{
    const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:`synk_company_session=${session}`,...(body===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'fixture-csrf'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return{status:res.status,data:await res.json()};
  };
  app.store.setSecret('provider:youtube',{apiKey:'global-public-test-key'});
  app.store.put('settings','company',{companyName:'Test',enabled:true,hourKst:0});
  return{app,call,admin};
}
const result=c=>({channel:{externalId:c.handle||c.id},posts:[],coverage:{status:'complete'},warnings:[]});

test('explicit disconnect overrides a global API key until a new connection is made',async t=>{
  let calls=0;
  const {app,call}=await fixture(t,async c=>{calls++;return result(c);});
  const c=(await call('/api/channels',{urls:'https://youtube.com/@company'})).data.added[0];
  assert.equal(c.connected,true);
  await call(`/api/channels/${c.id}/collect`,{});await app.waitForIdle();
  assert.equal(calls,1);
  assert.equal((await call(`/api/channels/${c.id}/disconnect`,{})).status,200);
  assert.equal((await call('/api/state')).data.channels[0].connected,false);
  assert.equal(app.store.all('channelSnapshots').length,0);
  app.store.put('channels',c.id,{...app.store.get('channels',c.id),lastAttemptAt:null});
  await app.scheduledTick();await app.waitForIdle();
  assert.equal(calls,1);
  assert.equal((await call(`/api/channels/${c.id}/collect`,{})).status,400);
  assert.deepEqual((await call('/api/collect',{})).data.runs,[]);
  await call(`/api/channels/${c.id}/connection`,{apiKey:'replacement-test-key'});
  assert.equal((await call('/api/state')).data.channels[0].connected,true);
  await call(`/api/channels/${c.id}/collect`,{});await app.waitForIdle();
  assert.equal(calls,2);
});

test('a queued collection rechecks disconnection before using the global API key',async t=>{
  let release,began;
  const started=new Promise(r=>{began=r;}),held=new Promise(r=>{release=r;});
  t.after(()=>release());
  const calls=[];
  const {app,call}=await fixture(t,async c=>{calls.push(c.id);began();await held;return result(c);});
  const channels=(await call('/api/channels',{urls:['https://youtube.com/@one','https://youtube.com/@two']})).data.added;
  await call('/api/collect',{});await started;
  await call(`/api/channels/${channels[1].id}/disconnect`,{});
  release();await app.waitForIdle();
  assert.deepEqual(calls,[channels[0].id]);
  assert.equal(app.store.all('channelSnapshots').some(s=>s.channelId===channels[1].id),false);
  assert.equal(app.store.get('channels',channels[1].id).status,'not-connected');
});

for(const change of ['deactivate']){
  test(`${change} revokes the departing connection owner and removes API data while preserving manual records`,async t=>{
    const {app,call,admin}=await fixture(t,async c=>result(c));
    const staff=app.store.createUser({name:'Staff',email:'staff@example.test',password:'valid-staff-password'});
    const c=(await call('/api/channels',{urls:'https://youtube.com/@shared',ownerId:staff.id})).data.added[0];
    app.store.setSecret('channel:'+c.id,{accessToken:'test-access',connectedBy:staff.id});
    app.store.put('posts','api-post',{id:'api-post',channelId:c.id,source:'api:youtube'});
    app.store.put('snapshots','api-snapshot',{id:'api-snapshot',postId:'api-post',source:'api:youtube'});
    app.store.put('channelSnapshots','api-channel',{id:'api-channel',channelId:c.id,source:'api:youtube'});
    app.store.put('posts','manual-post',{id:'manual-post',channelId:c.id,source:'manual-import'});
    const response=await call(change==='owners'?`/api/channels/${c.id}/owners`:`/api/members/${staff.id}/status`,change==='owners'?{userIds:[admin.id]}:{active:false});
    assert.equal(response.status,200);
    assert.equal(app.store.secret('channel:'+c.id),null);
    assert.equal((await call('/api/state')).data.channels[0].connected,false);
    assert.equal(app.store.get('channels',c.id).collectionDisabled,true);
    assert.equal(app.store.get('posts','api-post'),null);
    assert.equal(app.store.all('snapshots').length,0);
    assert.equal(app.store.all('channelSnapshots').length,0);
    assert.ok(app.store.get('posts','manual-post'));
  });
}
