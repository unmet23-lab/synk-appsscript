'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const publisher = require('../tools/lib/sns-publisher.js');
const { createRegistration, registerPublication, recordAndRegister, invokeTalk } = require('../tools/lib/sns-dm-registration.js');
const dirs = [];
afterEach(() => {
  for (const directory of dirs.splice(0)) {
    assert(path.resolve(directory).startsWith(path.resolve(publisher.REPO_ROOT, 'tmp') + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
const done = { ok: true, state: 'registered', routing_code: 'D0123', catchup_verified: true };
test('approved DM opening mode accepts existing text/resource choices and rejects any other mode before handoff',()=>{
  const f=fixture();
  const normalize=require('../tools/lib/sns-dm.js').normalizeDm;
  const value=JSON.parse(fs.readFileSync(path.join(f.dir,'01-test-instagram','원고.json'),'utf8')).dm;
  assert.equal(normalize({...value,opening_mode:'resource'}).opening_mode,'resource');
  assert.equal(normalize({...value,opening_mode:'text'}).opening_mode,'text');
  assert.throws(()=>normalize({...value,opening_mode:'unknown'}),/첫 메시지/);
});
function engine() {
  let status = null, stage = null;
  const handoff = { publication_hash: 'a'.repeat(64), post_url: 'https://www.instagram.com/p/Fixture/', campaign: { account_id: '100001', resource: { url: 'https://synk.im/builds/manual/' } } };
  const calls = [];
  const options = {
    readHandoff: () => structuredClone(handoff), invoke: async input => { calls.push(input); return done; },
    loadStatus: () => status, saveStatus: value => { status = structuredClone(value); },
    journalStage: () => stage, clock: () => '2026-10-20T01:00:00.000Z',
  };
  return { options, handoff, calls, run: () => createRegistration(options).run(), status: () => status, stage: value => { stage = value; } };
}
function fixture() {
  const base = path.join(publisher.REPO_ROOT, 'tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'sns-dm-auto-test-')); dirs.push(dir);
  const folder = path.join(dir, '01-test-instagram'); fs.mkdirSync(folder);
  const accounts = path.join(dir, 'accounts.json'), plan = path.join(dir, 'plan.json');
  const raw = { id: '01-test-instagram', platform: 'instagram', title: '확정 게시물', caption: '승인된 본문',
    dm: { account_id: '100001', title: '확정 자료', keyword: '자료', message: '승인된 자료입니다.', duration_mode: 'evergreen', ends_at: null,
      opening_mode: 'resource', resource: { kind: 'url', url: 'https://synk.im/builds/manual/', folder_id: 'fixture_post_folder', library_root: 'fixture_library_root' } } };
  fs.writeFileSync(accounts, JSON.stringify({ accounts: { 'test-instagram': { platform: 'instagram', handle: '@fixture', publisher: 'direct-after-connection', connection: 'fixture' } } }));
  fs.writeFileSync(path.join(folder, '원고.json'), JSON.stringify(raw));
  fs.writeFileSync(path.join(folder, 'upload-1.png'), 'synthetic image bytes');
  publisher.buildPlan({ root: dir, accountsFile: accounts, outputFile: plan });
  const approve = () => publisher.approvePlan(plan, ['01-test-instagram'], '게시·자료·문구 승인', { readCredentialImpl: () => null });
  const stateRoot = path.join(dir, 'private');
  return { dir, folder, plan, approve, stateRoot, item: '01-test-instagram', url: 'https://www.instagram.com/reel/Fixture/' };
}

test('approved browser receipt continues through registration, and replay does not register or publish again', async () => {
  const f = fixture(); f.approve(); let calls = 0;
  const options = { stateRoot: f.stateRoot, invoke: async input => { calls++; assert.equal(input.apply, true); return done; } };
  const first = await recordAndRegister(f.plan, f.item, f.url, '실제 게시 URL 확인', options);
  assert.equal(first.recorded, true); assert.equal(first.state, 'browser-published'); assert.equal(first.dm.state, 'registered');
  const receiptBefore = fs.readFileSync(first.resultFile, 'utf8');
  const second = await recordAndRegister(f.plan, f.item, f.url, '같은 게시 확인', options);
  assert.equal(second.dm.reused, true); assert.equal(calls, 1);
  assert.equal(fs.readFileSync(first.resultFile, 'utf8'), receiptBefore);
  assert.equal(fs.readdirSync(f.stateRoot).filter(name => name.endsWith('.lock')).length, 0);
});
test('unapproved, modified media, changed DM source or a different actual post never reaches registration', async t => {
  for (const kind of ['unapproved', 'media', 'dm', 'post']) await t.test(kind, async () => {
    const f = fixture(); if (kind !== 'unapproved') f.approve();
    if (kind === 'media') fs.appendFileSync(path.join(f.folder, 'upload-1.png'), 'changed');
    if (kind === 'dm') { const p = JSON.parse(fs.readFileSync(f.plan)); p.items[0].dm.resource.url = 'https://synk.im/changed/'; fs.writeFileSync(f.plan, JSON.stringify(p)); }
    if (kind === 'post') publisher.recordInstagramPublication(f.plan, f.item, 'https://www.instagram.com/p/Other/', '이전 게시 확인');
    let calls = 0;
    await assert.rejects(recordAndRegister(f.plan, f.item, f.url, '확인', { stateRoot: f.stateRoot, invoke: async () => { calls++; return done; } }));
    assert.equal(calls, 0);
  });
});
test('registration failure preserves successful publication and does not leak provider failure content', async () => {
  const f = fixture(); f.approve();
  const result = await recordAndRegister(f.plan, f.item, f.url, '확인', { stateRoot: f.stateRoot, invoke: async () => { throw Error('access_token=PRIVATE'); } });
  assert.equal(result.recorded, true); assert.equal(result.dm.state, 'needs_reconciliation');
  assert.equal(JSON.parse(fs.readFileSync(result.resultFile)).items[f.item].state, 'browser-published');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|access_token/);
  for (const file of fs.readdirSync(f.stateRoot)) assert.doesNotMatch(fs.readFileSync(path.join(f.stateRoot, file), 'utf8'), /PRIVATE|access_token/);
});
test('lost outcome is reconciled read-only and an absent remote row never authorizes a second write', async () => {
  const f = engine(); f.options.invoke = async input => { f.calls.push(input); if (input.apply) throw Error('disconnect'); return { ok: true, state: 'ready', registered: false }; };
  assert.equal((await f.run()).state, 'needs_reconciliation');
  assert.equal((await f.run()).state, 'needs_reconciliation');
  assert.deepEqual(f.calls, [{ apply: true }, { apply: false }]);
});
test('lost completion resumes only after exact remote registration is proved, then completes existing catch-up', async () => {
  const f = engine(); f.options.invoke = async input => { f.calls.push(input); throw Error('timeout'); };
  await f.run();
  f.options.invoke = async input => { f.calls.push(input); return input.apply ? done : { ok: true, state: 'ready', registered: true }; };
  assert.equal((await f.run()).state, 'registered');
  assert.deepEqual(f.calls, [{ apply: true }, { apply: false }, { apply: true }]);
});
test('interrupted Talk uploading journal forces reconciliation even if local status was lost', async () => {
  const f = engine(); f.stage('uploading'); f.options.invoke = async input => { f.calls.push(input); return { ok: true, state: 'ready', registered: false }; };
  assert.equal((await f.run()).state, 'needs_reconciliation');
  assert.deepEqual(f.calls, [{ apply: false }]);
});
test('known pending catch-up or sync resumes through the same CLI and only complete catch-up is success', async t => {
  for (const state of ['awaiting_sync', 'pending_catchup']) await t.test(state, async () => {
    const f = engine(); f.options.invoke = async input => { f.calls.push(input); return f.calls.length === 1 ? { ok: false, state } : done; };
    assert.equal((await f.run()).state, state); assert.equal((await f.run()).state, 'registered');
    assert.deepEqual(f.calls, [{ apply: true }, { apply: true }]);
  });
});
test('ambiguous success without catch-up confirmation is not a completed registration', async () => {
  const f = engine(); f.options.invoke = async () => ({ ok: true, state: 'registered', routing_code: 'D0123' });
  assert.equal((await f.run()).state, 'needs_reconciliation');
});
test('changing approval while reconciliation awaits stops before applying', async () => {
  const f = engine(); f.stage('uploading');
  f.options.invoke = async input => { f.calls.push(input); f.handoff.publication_hash = 'b'.repeat(64); return { ok: true, state: 'ready', registered: true }; };
  await assert.rejects(f.run(), /바뀌었습니다/); assert.deepEqual(f.calls, [{ apply: false }]);
});
test('same plan cannot have two concurrent registration processes', async () => {
  const f = fixture(); f.approve(); publisher.recordInstagramPublication(f.plan, f.item, f.url, '확인');
  let release, started;
  const wait = new Promise(resolve => { started = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const options = { stateRoot: f.stateRoot, invoke: async () => { started(); await hold; return done; } };
  const first = registerPublication(f.plan, f.item, options); await wait;
  const second = await registerPublication(f.plan, f.item, options);
  assert.equal(second.state, 'registration_locked'); release(); assert.equal((await first).state, 'registered');
});
test('dead-process lock recovery only inspects an unknown outcome and never repeats the write',async()=>{
  const f=fixture();f.approve();publisher.recordInstagramPublication(f.plan,f.item,f.url,'확인');
  await registerPublication(f.plan,f.item,{stateRoot:f.stateRoot,invoke:async()=>{throw Error('lost outcome');}});
  const name=fs.readdirSync(f.stateRoot).find(n=>n.endsWith('.status.json')).replace(/\.status\.json$/,'.lock');
  const lock=path.join(f.stateRoot,name);fs.writeFileSync(lock,JSON.stringify({pid:2147483647,startedAt:new Date().toISOString()}));
  // Even if its status write was lost, a dead owner's lock is an unknown outcome.
  fs.unlinkSync(path.join(f.stateRoot,name.replace(/\.lock$/,'.status.json')));
  const calls=[];const result=await registerPublication(f.plan,f.item,{stateRoot:f.stateRoot,invoke:async value=>{calls.push(value);return {ok:true,state:'ready',registered:false};}});
  assert.equal(result.state,'needs_reconciliation');assert.deepEqual(calls,[{apply:false}]);assert.equal(fs.existsSync(lock),false);
  const again=await registerPublication(f.plan,f.item,{stateRoot:f.stateRoot,invoke:async value=>{calls.push(value);return {ok:true,state:'ready',registered:false};}});
  assert.equal(again.state,'needs_reconciliation');assert.deepEqual(calls,[{apply:false},{apply:false}]);
});
test('legacy lock without a verifiable PID stays locked and reports its exact recovery location',async()=>{
  const f=fixture();f.approve();publisher.recordInstagramPublication(f.plan,f.item,f.url,'확인');
  await registerPublication(f.plan,f.item,{stateRoot:f.stateRoot,invoke:async()=>{throw Error('lost');}});
  const name=fs.readdirSync(f.stateRoot).find(n=>n.endsWith('.status.json')).replace(/\.status\.json$/,'.lock'),lock=path.join(f.stateRoot,name);
  fs.writeFileSync(lock,'');let calls=0;
  const result=await registerPublication(f.plan,f.item,{stateRoot:f.stateRoot,invoke:async()=>{calls++;return done;}});
  assert.equal(result.state,'registration_locked');assert.equal(result.lockPath,lock);assert.equal(calls,0);assert.equal(fs.readFileSync(lock,'utf8'),'');
});
test('child adapter calls the existing CLI without a shell and preserves literal paths', async () => {
  const f = fixture(), script = path.join(f.dir, 'CLI fixture $() &.cjs');
  fs.writeFileSync(script, "const a=process.argv.slice(2); if(!a.includes('--운영')||!a.includes('--apply')||!a.includes('fixture & $(literal)'))process.exit(9); console.error('private diagnostic'); console.log(JSON.stringify({ok:true,state:'registered',routing_code:'D0123',catchup_verified:true}));");
  assert.deepEqual(await invokeTalk({ script, publisherRoot: f.dir, planFile: f.plan, itemId: 'fixture & $(literal)', registry: path.join(f.dir, 'registry.json'), journal: path.join(f.dir, 'journal.json'), live: true }, { apply: true }), done);
});
