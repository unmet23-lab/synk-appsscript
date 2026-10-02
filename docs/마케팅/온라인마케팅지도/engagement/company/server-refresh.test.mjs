import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';

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
