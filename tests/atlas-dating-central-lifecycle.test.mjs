import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
const require = createRequire(import.meta.url);
const { createLifecycleFixture } = require('../../SYNK-talk/tests/lib/account-lifecycle-fixture.js');
const { createAccountLifecycleDispatcher } = require('../../SYNK-talk/lib/synk-account-lifecycle.js');

test('real canonical purge SQL, outbox worker and product HTTP receiver erase together; a lost acknowledgment retries safely after restart', async t => {
  // Synthetic identities and isolated local databases only. No Supabase or model connection.
  const central = await createLifecycleFixture(); t.after(() => central.close());
  const a = await central.account(), b = await central.account(), secret = randomBytes(32).toString('hex');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-central-dating-')), databasePath = path.join(dir, 'account.sqlite');
  let server, origin;
  const start = async () => {
    server = createDatingServer({ mode: 'account', databasePath, verify: async token => ({ accountId: token }),
      lifecycle: { token: secret, issuer: 'synk-account', audience: 'atlas-dating' } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  };
  const close = async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); };
  await start(); t.after(async () => { await close(); assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('synk-central-dating-')); await fs.rm(dir, { recursive: true, force: true }); });
  const call = async (route, id, action) => {
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: action ? 'POST' : 'GET',
      headers: { Origin: origin, Authorization: `Bearer ${id}`, ...(action ? { 'Content-Type': 'application/json' } : {}) },
      ...(action ? { body: JSON.stringify(action) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const get = async id => { const r = await call('/state', id); assert.equal(r.status, 200); return r.body.view; };
  const act = async (id, action) => call('/action', id, { requestId: randomUUID(), expectedRevision: (await get(id)).revision, action });
  const ok = async (id, action) => { const r = await act(id, action); assert.equal(r.status, 200, JSON.stringify(r)); return r.body; };
  for (const [person, nickname] of [[a, '가상 A'], [b, '가상 B']]) {
    await ok(person.synk_user_id, { kind: 'profile', profile: { nickname, region: '가상 지역', intro: '합성 시험',
      values: { availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' }, required: [] } });
    await ok(person.synk_user_id, { kind: 'adult', declared: true });
    await ok(person.synk_user_id, { kind: 'consents', consents: { profilePublic: true, receiveInvitations: true, storePreferences: true } });
    for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' }))
      await ok(person.synk_user_id, { kind: 'discovery', action: { kind: 'set', field, value } });
  }
  const sent = await ok(a.synk_user_id, { kind: 'connect', targetAccountId: b.synk_user_id });
  const pairId = sent.result.pairId, pair = (await get(b.synk_user_id)).pairs.find(p => p.pairId === pairId);
  await ok(b.synk_user_id, { kind: 'introduction', pairId, expectedIntroductionRevision: pair.introduction.revision,
    action: { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' } });
  const request = await central.request(a.synk_user_id, { due: false });
  assert.equal((await central.purge(request)).status, 'waiting'); assert.equal(await central.queue(a.synk_user_id), undefined);
  assert.notEqual((await get(a.synk_user_id)).deleted, true);
  await central.sql`update engine.synk_data_requests set requested_at=${new Date(Date.now() - 8 * 86400000).toISOString()}::timestamptz where request_id=${request}::uuid`;
  assert.equal((await central.purge(request)).status, 'completed');
  let first = true, at = Date.now() + 1000; const packets = [];
  const dispatch = () => createAccountLifecycleDispatcher({ sql: central.sql, receiverUrl: origin + '/api/atlas-dating/lifecycle', token: secret,
    clock: () => new Date(at).toISOString(), fetchImpl: async (url, init) => {
      packets.push(JSON.parse(init.body)); const response = await fetch(url, init);
      if (first) { first = false; assert.equal(response.status, 200); await response.json(); throw new Error('synthetic acknowledgment loss after commit'); }
      return response;
    } });
  assert.equal((await dispatch().runOnce()).pending, 1); assert.equal((await central.queue(a.synk_user_id)).state, 'pending');
  const deleted = await get(a.synk_user_id); assert.equal(deleted.deleted, true);
  assert.equal((await act(a.synk_user_id, { kind: 'adult', declared: true })).status, 410);
  assert.equal((await get(b.synk_user_id)).candidates.some(p => p.id === a.synk_user_id), false);
  const inspect = () => { const db = createDatingStore({ path: databasePath, mode: 'account' });
    try { return db.transaction(tx => ({ account: tx.account(a.synk_user_id), pair: tx.pair(pairId), receipt: tx.lifecycleReceipt('synk-account', packets[0].eventId) })); }
    finally { db.close(); } };
  const erased = inspect(); assert.equal(erased.account.document, null); assert.equal(erased.pair.document, null); assert.equal(erased.pair.status, 'closed'); assert.ok(erased.receipt);
  await close(); await start(); at += 2000;
  assert.equal((await dispatch().runOnce()).delivered, 1); assert.equal((await central.queue(a.synk_user_id)).state, 'delivered');
  assert.deepEqual(packets[0], packets[1]); assert.deepEqual(inspect(), erased); assert.equal((await dispatch().runOnce()).claimed, 0);
  const page = await fetch(origin + '/atlas-lab/dating.html').then(r => r.text()); assert.equal(page.includes(secret), false);
});

test('canonical status transactions and the shared worker stop exposure without owner login, then require fresh consent before a new introduction', async t => {
  const central=await createLifecycleFixture({availability:true}); t.after(()=>central.close());
  const a=await central.account(), b=await central.account(), secret=randomBytes(32).toString('hex');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-central-availability-'));
  const server=createDatingServer({mode:'account',databasePath:path.join(dir,'account.sqlite'),verify:async token=>({accountId:token}),
    lifecycle:{token:secret,issuer:'synk-account',audience:'atlas-dating'}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-central-availability-')); await fs.rm(dir,{recursive:true,force:true});});
  const call=async(owner,action)=>{const r=await fetch(origin+'/api/atlas-dating/'+(action?'action':'state'),{method:action?'POST':'GET',
    headers:{Origin:origin,Authorization:`Bearer ${owner}`,...(action?{'Content-Type':'application/json'}:{})},...(action?{body:JSON.stringify(action)}:{})});return {status:r.status,...await r.json()};};
  const get=async owner=>{const r=await call(owner);assert.equal(r.status,200);return r.view;};
  const ok=async(owner,action)=>{const r=await call(owner,{requestId:randomUUID(),expectedRevision:(await get(owner)).revision,action});assert.equal(r.status,200,JSON.stringify(r));return r;};
  const worker=createAccountLifecycleDispatcher({sql:central.sql,receiverUrl:origin+'/api/atlas-dating/lifecycle',token:secret});
  for (const [person,nickname] of [[a,'가상 A'],[b,'가상 B']]) {
    const owner=person.synk_user_id;
    await ok(owner,{kind:'profile',profile:{nickname,region:'가상 지역',intro:'중앙 상태 합성 시험',values:{availability:'weekend','self.pace':'lead','self.plan':'planned'},required:[]}});
    await ok(owner,{kind:'adult',declared:true});
    await ok(owner,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
    for (const [field,value] of Object.entries({consent:true,availability:'weekend'})) await ok(owner,{kind:'discovery',action:{kind:'set',field,value}});
  }
  assert.equal((await worker.runOnce()).delivered,2);
  assert.equal((await get(a.synk_user_id)).consents.profilePublic,true,'initial active1 cannot retract an existing valid disclosure');
  const sent=await ok(a.synk_user_id,{kind:'connect',targetAccountId:b.synk_user_id}),pairId=sent.result.pairId;
  const intro=(await get(b.synk_user_id)).pairs.find(p=>p.pairId===pairId).introduction;
  await ok(b.synk_user_id,{kind:'introduction',pairId,expectedIntroductionRevision:intro.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'accept'}});
  const prior=(await get(a.synk_user_id)).discovery;
  await central.request(a.synk_user_id,{due:false}); assert.equal((await worker.runOnce()).delivered,1);
  const peerWhileHeld=await get(b.synk_user_id);
  assert.equal(peerWhileHeld.candidates.some(c=>c.accountId===a.synk_user_id),false);
  assert.equal(peerWhileHeld.pairs.find(p=>p.pairId===pairId).status,'closed');
  const masked=await get(a.synk_user_id);assert.equal(masked.centralAvailability.status,'deletion-requested');
  for (const key of ['profile','preferences','experience','consents','reports']) assert.equal(Object.hasOwn(masked,key),false,key);
  await central.sql`update engine.synk_accounts set status='active' where synk_user_id=${a.synk_user_id}::uuid`;
  assert.equal((await worker.runOnce()).delivered,1);
  const resumed=await get(a.synk_user_id);assert.equal(resumed.centralAvailability.resumeRequired,true);
  assert.equal(resumed.consents.profilePublic,false);assert.equal(resumed.consents.receiveInvitations,false);assert.equal(resumed.consents.storePreferences,true);
  assert.deepEqual(resumed.discovery.fields,prior.fields,'temporary central hold must preserve declared preference sources');
  assert.equal(resumed.pairs.find(p=>p.pairId===pairId).status,'closed');
  await ok(a.synk_user_id,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
  assert.equal((await get(a.synk_user_id)).centralAvailability.resumeRequired,false);
  assert.equal((await get(b.synk_user_id)).candidates.some(c=>c.accountId===a.synk_user_id),true);
  const closedIntro=(await get(a.synk_user_id)).pairs.find(p=>p.pairId===pairId).introduction;
  assert.equal(closedIntro.accepted,false); assert.equal(closedIntro.canReopen,true);
  await ok(a.synk_user_id,{kind:'introduction',pairId,expectedIntroductionRevision:closedIntro.revision,action:{kind:'reopen'}});
  const newSent=await ok(a.synk_user_id,{kind:'connect',targetAccountId:b.synk_user_id});
  assert.notEqual(newSent.result.pairId,pairId);assert.notEqual(newSent.result.introductionId,sent.result.introductionId);
  const newPair=(await get(b.synk_user_id)).pairs.find(p=>p.pairId===newSent.result.pairId);
  assert.equal(newPair.introduction.accepted,false,'public consent cannot revive old reciprocal acceptance');
  await central.sql`update engine.synk_accounts set status='disabled' where synk_user_id=${a.synk_user_id}::uuid`;
  assert.equal((await worker.runOnce()).delivered,1);
  assert.equal((await get(b.synk_user_id)).candidates.some(c=>c.accountId===a.synk_user_id),false);
  assert.equal((await central.sql`select count(*)::int as n from engine.synk_account_lifecycle`)[0].n,0,'temporary statuses cannot create final deletion events');
});
