'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, createLearningSync, KEY } = require('../atlas/game-learning');
const { SYNC_KEY, sameEvent } = require('../atlas/learning-sync');
const Atlas = require('../atlas/engine');
const { POLICY } = require('../atlas/learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const copy = value => JSON.parse(JSON.stringify(value));
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
const disk = () => { const values = new Map();return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };

test('a recovered gap can be recovered again after the same ID is lost later',async t=>{
 const storage=disk(),accountKey='sync.repeated-loss',events=[];let recover=false,scans=0;
 storage.setItem(SYNC_KEY+'.'+accountKey,JSON.stringify({version:2,accountKey,revision:1,cursor:2,complete:true,acknowledged:['lost.event'],pending:[],missing:[]}));
 const port={scope:'account',accountKey,events:()=>events,partial:()=>false,subscribe:()=>()=>{},markComplete(){},importEvents:found=>{if(!recover)return{added:0,skipped:['lost.event']};events.push(...found);return{added:found.length,skipped:[]};}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey,revision:1,storage,auto:false,maxAttempts:1,transport:{get:async({after})=>{if(after===0)scans++;return{events:after===0?[{id:'lost.event'}]:[],cursor:2,hasMore:false,revision:1};},post:async body=>({accepted:body.events.map(e=>e.id),revision:1})}});t.after(()=>sync.stop());
 assert.equal((await sync.start()).code,'INCOMPLETE_HISTORY');events.push({id:'lost.event'});assert.equal((await sync.flush()).phase,'synced');const previous=scans;events.length=0;recover=true;
 assert.equal((await sync.flush()).phase,'synced');assert.ok(scans>previous);assert.deepEqual(events.map(e=>e.id),['lost.event']);
});

for (const auto of [false, true]) test(`a bounded pull without an active automatic runner reports incomplete history (auto=${auto})`, async t => {
 const events=[],accountKey='account.manual-pages',port={scope:'account',accountKey,events:()=>events,partial:()=>false,subscribe:()=>()=>{},markComplete(){},importEvents:rows=>{events.push(...rows);return {added:rows.length};}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey,revision:1,storage:disk(),auto,maxPages:1,transport:{post:async()=>{throw Error('Read-only scan must not upload');},get:async({after})=>({events:after===0?[{id:'first.page'}]:[],cursor:after===0?1:2,hasMore:after===0,revision:1})}});t.after(()=>sync.stop());
 const first=await sync.pull();assert.equal(first.phase,'offline');assert.equal(first.code,'INCOMPLETE_HISTORY');assert.equal(first.complete,false);
 const next=await sync.pull();assert.equal(next.phase,'synced');assert.equal(next.code,null);assert.equal(next.complete,true);assert.deepEqual(events.map(e=>e.id),['first.page']);
});
test('manual bounded recovery reports its pause and resumes the saved recovery cursor',async t=>{
 const storage=disk(),events=[],after=[],accountKey='account.manual-recovery',event={id:'lost.event'};
 storage.setItem(SYNC_KEY+'.'+accountKey,JSON.stringify({version:2,accountKey,revision:1,cursor:2,complete:true,acknowledged:[event.id],pending:[],missing:[],recoveryCursor:0}));
 const port={scope:'account',accountKey,events:()=>events,partial:()=>false,subscribe:()=>()=>{},markComplete(){},importEvents:rows=>{if(after.at(-1)===0)return{added:0,skipped:rows.map(e=>e.id)};events.push(...rows);return{added:rows.length};}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey,revision:1,storage,auto:false,maxPages:1,transport:{post:async()=>{throw Error('Read-only recovery must not upload');},get:async args=>{after.push(args.after);return{events:args.after<2?[event]:[],cursor:args.after===0?1:2,hasMore:args.after===0,revision:1};}}});t.after(()=>sync.stop());
 const first=await sync.start();assert.equal(first.phase,'offline');assert.equal(first.code,'INCOMPLETE_HISTORY');assert.equal(first.complete,false);assert.equal(JSON.parse(storage.getItem(SYNC_KEY+'.'+accountKey)).recoveryCursor,1);
 const next=await sync.pull();assert.equal(next.phase,'synced');assert.equal(next.complete,true);assert.deepEqual(after,[2,0,2,1]);assert.deepEqual(events,[event]);
});

test('an exhausted recovery scan preserves an acknowledged gap and refuses complete history',async()=>{
 const storage=disk(),complete=[],key=SYNC_KEY+'.account.gap';storage.setItem(key,JSON.stringify({version:2,accountKey:'account.gap',revision:1,cursor:2,complete:true,acknowledged:['lost.event'],pending:[],missing:[],recoveryCursor:0}));
 const port={scope:'account',accountKey:'account.gap',events:()=>[],partial:()=>false,subscribe:()=>()=>{},markComplete:v=>complete.push(v),importEvents:()=>({added:0})},transport={get:async()=>({events:[],cursor:2,hasMore:false,revision:1}),post:async()=>{throw Error('A gap must not upload');}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey:'account.gap',revision:1,storage,transport,auto:false,maxAttempts:1});
 const result=await sync.start();assert.equal(result.phase,'offline');assert.equal(result.code,'INCOMPLETE_HISTORY');assert.equal(complete.at(-1),false);
 assert.deepEqual(JSON.parse(storage.getItem(key)).missing,['lost.event']);assert.equal(JSON.parse(storage.getItem(key)).recoveryCursor,0);sync.stop();
});
test('a known exhausted gap is not rescanned on every flush and new work still uploads',async()=>{
 const storage=disk(),accountKey='account.gap-cached',key=SYNC_KEY+'.'+accountKey,events=[],sent=[];let recovery=0;
 storage.setItem(key,JSON.stringify({version:2,accountKey,revision:1,cursor:2,complete:true,acknowledged:['lost.event'],pending:[],missing:[],recoveryCursor:0}));
 const port={scope:'account',accountKey,events:()=>events,partial:()=>false,subscribe:()=>()=>{},markComplete(){},importEvents:()=>({added:0})},transport={get:async({after})=>{if(after===0)recovery++;return{events:[],cursor:2,hasMore:false,revision:1};},post:async({events})=>{sent.push(...events.map(e=>e.id));return{accepted:events.map(e=>e.id),revision:1};}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey,revision:1,storage,transport,auto:false,maxAttempts:1});
 try{assert.equal((await sync.start()).code,'INCOMPLETE_HISTORY');assert.equal(recovery,1);await sync.flush();assert.equal(recovery,1);events.push({id:'fresh.event'});const next=await sync.flush();assert.deepEqual(sent,['fresh.event']);assert.equal(next.queued,0);assert.equal(next.complete,false);assert.equal(recovery,1);await sync.retry();assert.equal(recovery,2,'explicit retry can recheck a repaired server');events.length=0;await sync.flush();assert.equal(recovery,3,'a newly missing event triggers a new scan');assert.deepEqual(new Set(JSON.parse(storage.getItem(key)).missing),new Set(['lost.event','fresh.event']));}finally{sync.stop();}
});
const error = (code, revision = 1) => Object.assign(new Error(code), { code, revision });
test('a fresh append during a delayed successful recovery is uploaded without another user action',async t=>{
 const storage=disk(),accountKey='account.late-recovery',events=[],sent=[];let notify,resolve,recovering=false;
 storage.setItem(SYNC_KEY+'.'+accountKey,JSON.stringify({version:2,accountKey,revision:1,cursor:2,complete:true,acknowledged:['lost.event'],pending:[],missing:[],recoveryCursor:0}));
 const port={scope:'account',accountKey,events:()=>events,partial:()=>false,subscribe:fn=>(notify=fn,()=>{}),markComplete(){},importEvents:found=>{events.push(...found);return{added:found.length,skipped:[]};}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey,revision:1,storage,maxAttempts:1,transport:{get:async({after})=>after===0?(recovering=true,await new Promise(done=>{resolve=done;})):{events:[],cursor:2,hasMore:false,revision:1},post:async body=>{sent.push(...body.events.map(e=>e.id));return{accepted:body.events.map(e=>e.id),revision:1};}}});t.after(()=>sync.stop());
 const first=sync.start();for(let i=0;i<100&&!recovering;i++)await new Promise(r=>setTimeout(r,1));assert.ok(recovering);events.push({id:'fresh.event'});notify({kind:'append'});await new Promise(r=>setTimeout(r,5));resolve({events:[{id:'lost.event'}],cursor:2,hasMore:false,revision:1});await first;for(let i=0;i<100&&!sent.length;i++)await new Promise(r=>setTimeout(r,1));assert.deepEqual(sent,['fresh.event']);assert.equal(sync.status().phase,'synced');assert.equal(sync.status().queued,0);
});
test('new evidence automatically uploads after a recovery gap already reported offline',async t=>{
 const storage=disk(),accountKey='account.offline-gap',events=[],sent=[];let notify;
 storage.setItem(SYNC_KEY+'.'+accountKey,JSON.stringify({version:2,accountKey,revision:1,cursor:2,complete:true,acknowledged:['lost.event'],pending:[],missing:[],recoveryCursor:0}));
 const port={scope:'account',accountKey,events:()=>events,partial:()=>false,subscribe:fn=>(notify=fn,()=>{}),markComplete(){},importEvents:()=>({added:0})};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey,revision:1,storage,maxAttempts:1,transport:{get:async()=>({events:[],cursor:2,hasMore:false,revision:1}),post:async body=>{sent.push(...body.events.map(e=>e.id));return{accepted:body.events.map(e=>e.id),revision:1};}}});t.after(()=>sync.stop());assert.equal((await sync.start()).code,'INCOMPLETE_HISTORY');events.push({id:'fresh.event'});notify({kind:'append'});for(let i=0;i<100&&!sent.length;i++)await new Promise(r=>setTimeout(r,1));assert.deepEqual(sent,['fresh.event']);assert.deepEqual(JSON.parse(storage.getItem(SYNC_KEY+'.'+accountKey)).missing,['lost.event']);
});
test('an exactly full final upload batch is acknowledged as synced',async t=>{
 const storage=disk(),accountKey='account.exact-batch',events=[{id:'fresh.event'}],port={scope:'account',accountKey,events:()=>events,partial:()=>false,subscribe:()=>()=>{},markComplete(){},importEvents:()=>({added:0})};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey,revision:1,storage,auto:false,maxPages:1,transport:{get:async()=>({events:[],cursor:0,hasMore:false,revision:1}),post:async body=>({accepted:body.events.map(e=>e.id),revision:1})}});t.after(()=>sync.stop());const result=await sync.start();assert.equal(result.phase,'synced');assert.equal(result.code,null);assert.equal(result.queued,0);
});
test('new queued evidence uploads even while an older acknowledged gap cannot be recovered',async()=>{
 const storage=disk(),key=SYNC_KEY+'.account.recover-upload',fresh={id:'fresh.event'},sent=[];
 storage.setItem(key,JSON.stringify({version:2,accountKey:'account.recover-upload',revision:1,cursor:2,complete:true,acknowledged:['lost.event'],pending:[],missing:[],recoveryCursor:0}));
 const port={scope:'account',accountKey:'account.recover-upload',events:()=>[fresh],partial:()=>false,subscribe:()=>()=>{},markComplete(){},importEvents:()=>({added:0,skipped:['lost.event']})};
 const transport={get:async({after})=>({events:after===0?[{id:'lost.event'}]:[],cursor:2,hasMore:false,revision:1}),post:async body=>{sent.push(...body.events.map(event=>event.id));return{accepted:body.events.map(event=>event.id),revision:1};}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey:'account.recover-upload',revision:1,storage,transport,auto:false,maxAttempts:1});
 const result=await sync.start();assert.deepEqual(sent,['fresh.event']);assert.equal(result.code,'INCOMPLETE_HISTORY');assert.equal(result.phase,'offline');assert.equal(result.queued,0);assert.deepEqual(JSON.parse(storage.getItem(key)).missing,['lost.event']);sync.stop();
});
test('a recovered response cannot clear a gap when the local importer skips it',async()=>{
 const storage=disk(),complete=[],key=SYNC_KEY+'.account.skipped',event={id:'lost.event'};
 storage.setItem(key,JSON.stringify({version:2,accountKey:'account.skipped',revision:1,cursor:2,complete:true,acknowledged:[event.id],pending:[],missing:[],recoveryCursor:0}));
 const port={scope:'account',accountKey:'account.skipped',events:()=>[],partial:()=>false,subscribe:()=>()=>{},markComplete:v=>complete.push(v),importEvents:()=>({added:0,skipped:[event.id]})};
 const transport={get:async({after})=>({events:after===0?[event]:[],cursor:2,hasMore:false,revision:1}),post:async()=>{throw Error('A missing event must not upload');}};
 const sync=createLearningSync({adapter:{syncPort:port},accountKey:'account.skipped',revision:1,storage,transport,auto:false,maxAttempts:1});
 const result=await sync.start();assert.equal(result.phase,'offline');assert.equal(result.code,'INCOMPLETE_HISTORY');assert.equal(complete.at(-1),false);
 assert.deepEqual(JSON.parse(storage.getItem(key)).missing,[event.id]);sync.stop();
});
function server({ pageSize = 100, partial = false } = {}) {
  const s = { revision: 1, enabled: true, offline: false, log: [], gets: [], posts: [], lostAck: false };
  const check = revision => { if (s.offline) throw new Error('offline');if (!s.enabled) throw error('LEARNING_DISABLED', s.revision);if (revision !== s.revision) throw error('REVISION_CONFLICT', s.revision); };
  s.get = async ({ after, revision }) => {
    s.gets.push(after);check(revision);const events = copy(s.log.slice(after, after + pageSize));
    return { events, cursor: after + events.length, hasMore: after + events.length < s.log.length, revision: s.revision };
  };
  s.post = async ({ revision, events }) => {
    s.posts.push(copy(events));check(revision);
    const accepted = partial ? events.slice(0, Math.max(1, Math.floor(events.length / 2))) : events;
    const combined = copy(s.log);
    for (const event of accepted) {
      const prior = combined.find(e => e.id === event.id);
      if (prior && !sameEvent(prior, event)) throw error('EVENT_CONFLICT');
      if (!prior) combined.push(copy(event));
    }
    Atlas.createSession({ scope, events: combined });s.log = combined;
    if (s.lostAck) { s.lostAck = false;throw new Error('ack lost'); }
    return { accepted: accepted.map(e => e.id), revision: s.revision };
  };
  return s;
}
function client(s, { storage = disk(), accountKey = 'account.a', revision = 1, options = {}, gameId = 'test-game' } = {}) {
  const adapter = createGame({ gameId, map, storage, storageScope: 'account', accountKey, historyComplete: false });
  const sync = createLearningSync({ adapter, accountKey, revision, storage, transport: s, auto: false,
    maxAttempts: 3, backoffMs: [0], sleep: async () => {}, ...options });
  const answer = (id = `item.${Date.now()}.${Math.random().toString(36).slice(2)}`) => {
    const pid = adapter.present({ id, itemKey: id, familyKey: id, skillId: 'ko.reading.detail', difficulty: 1,
      responseFormat: 'single-choice', modality: 'reading', audioRequired: false, confounded: false });
    return adapter.answer(pid, { correct: true, assessable: true });
  };
  return { adapter, sync, storage, answer };
}

test('append-only events converge on another device through advancing pages without changing evidence', async () => {
  const s = server({ pageSize: 2 }), a = client(s);await a.sync.start();a.answer('original');
  const source = a.adapter.events();assert.equal((await a.sync.flush()).queued, 0);assert.deepEqual(s.log, source);
  assert.ok(s.posts.every(batch => Array.isArray(batch) && batch.every(e => typeof e.type === 'string')));
  const b = client(s, { gameId: 'second-game' });await b.sync.start();
  assert.deepEqual(b.adapter.events(), source);assert.equal(b.adapter.summary().independent, 1);
  assert.equal(b.sync.status().cursor, source.length);assert.equal(b.sync.status().queued, 0);
  assert.equal(s.posts.length, 1);assert.equal(source.find(e => e.type === 'decision.made').candidateSnapshot[0].learning.policy, POLICY.version);
  a.sync.stop();b.sync.stop();
});

test('lost acknowledgement retries identical event IDs and bodies without replacing the server log', async () => {
  const s = server(), c = client(s);await c.sync.start();c.answer();s.lostAck = true;
  await c.sync.flush();assert.equal(c.sync.status().queued, 0);assert.equal(s.posts.length, 2);
  assert.deepEqual(s.posts[0], s.posts[1]);assert.equal(s.log.length, c.adapter.events().length);c.sync.stop();
});

test('partial acknowledgement removes only accepted IDs and retries the remaining ordered events', async () => {
  const s = server({ partial: true }), c = client(s);await c.sync.start();c.answer();await c.sync.flush();
  assert.ok(s.posts.length > 1);assert.equal(c.sync.status().queued, 0);
  const firstAccepted = s.posts[0].slice(0, Math.floor(s.posts[0].length / 2)).map(e => e.id);
  assert.ok(s.posts[1].every(e => !firstAccepted.includes(e.id)));assert.deepEqual(s.log, c.adapter.events());c.sync.stop();
});

test('offline outbox survives closing and a new instance resumes without adopting guest storage', async () => {
  const s = server(), storage = disk(), a = client(s, { storage });await a.sync.start();a.answer('offline.item');
  const source = a.adapter.events();s.offline = true;await a.sync.flush();assert.equal(a.sync.status().phase, 'offline');
  assert.equal(JSON.parse(storage.getItem(`${SYNC_KEY}.account.a`)).pending.length, source.length);a.sync.stop();
  s.offline = false;const b = client(s, { storage });await b.sync.start();
  assert.deepEqual(s.log, source);assert.equal(b.sync.status().queued, 0);b.sync.stop();
  const guest = createGame({ gameId: 'guest', map, storage: disk() });
  assert.throws(() => createLearningSync({ adapter: guest, accountKey: 'account.a', revision: 1, storage: disk(), transport: s }), /authenticated account adapter/);
});

test('a stopped account cannot apply an old pull response or acknowledge an old upload', async () => {
  const source = client(server());await source.sync.start();source.answer();const events = source.adapter.events();source.sync.stop();
  let resolvePull;
  const transport = { get: () => new Promise(resolve => { resolvePull = resolve; }), post: async () => assert.fail('stopped account uploaded') };
  const a = client(transport), request = a.sync.start();await Promise.resolve();a.sync.stop();
  resolvePull({ events, cursor: events.length, hasMore: false, revision: 1 });await request;
  assert.equal(a.adapter.events().length, 0);assert.equal(a.sync.status().cursor, 0);assert.equal(a.sync.status().phase, 'stopped');
  const s = server(), b = client(s);await b.sync.start();b.answer();let resolvePost;
  s.post = () => new Promise(resolve => { resolvePost = resolve; });
  const upload = b.sync.flush();while (!resolvePost) await new Promise(resolve => setImmediate(resolve));
  const queued = b.sync.status().queued;b.sync.stop();resolvePost({ accepted: b.adapter.events().map(e => e.id), revision: 1 });await upload;
  assert.equal(b.sync.status().queued, queued);assert.equal(b.sync.status().phase, 'stopped');
});

test('revision change, disabled consent and event conflict block retries and preserve the old outbox', async () => {
  for (const code of ['REVISION_CONFLICT', 'LEARNING_DISABLED', 'EVENT_CONFLICT']) {
    const s = server(), c = client(s);await c.sync.start();c.answer();let calls = 0;
    s.get = async () => { calls++;throw error(code, 2); };await c.sync.flush();
    assert.equal(c.sync.status().phase, 'blocked');assert.equal(c.sync.status().code, code);assert.equal(calls, 1);assert.ok(c.sync.status().queued > 0);
    assert.equal((await c.sync.retry()).code, code);assert.equal(calls, 1);c.sync.stop();
  }
});

test('a refusal of a WORLD run’s entries that sending again cannot fix stops after one try and keeps the outbox', async () => {
  for (const code of ['EVENT_RUN_CONFLICT', 'EVENT_BEFORE_RUN', 'WRONG_RUN_CONTENT', 'FORBIDDEN']) {
    const s = server(), c = client(s);await c.sync.start();c.answer();let calls = 0;
    s.post = async () => { calls++;throw error(code); };await c.sync.flush();
    assert.equal(c.sync.status().phase, 'blocked');assert.equal(c.sync.status().code, code);assert.equal(calls, 1);assert.ok(c.sync.status().queued > 0);
    assert.equal((await c.sync.retry()).code, code);assert.equal(calls, 1);c.sync.stop();
  }
});

test('reusing an old consent store for a new revision is blocked before any network call', async () => {
  const s = server(), storage = disk(), a = client(s, { storage });await a.sync.start();a.answer();a.sync.stop();
  const before = storage.getItem(`${SYNC_KEY}.account.a`), calls = s.gets.length;
  const b = client(s, { storage, revision: 2 });await b.sync.start();
  assert.equal(b.sync.status().code, 'REVISION_CONFLICT');assert.equal(s.gets.length, calls);assert.equal(storage.getItem(`${SYNC_KEY}.account.a`), before);b.sync.stop();
});

test('stalled cursors, unsent acknowledgements and conflicting imported IDs cannot erase pending work', async () => {
  const c = client({ get: async () => ({ events: [], cursor: 0, hasMore: true, revision: 1 }), post: async () => assert.fail() });
  await c.sync.start();assert.equal(c.sync.status().code, 'INVALID_RESPONSE');c.sync.stop();
  const s = server(), d = client(s);await d.sync.start();d.answer();s.post = async () => ({ accepted: ['not.sent'], revision: 1 });
  await d.sync.flush();assert.equal(d.sync.status().code, 'INVALID_RESPONSE');assert.ok(d.sync.status().queued > 0);d.sync.stop();
  const source = d.adapter.events(), conflicting = copy(source);conflicting[0].policy = 'not-the-original-policy';
  assert.throws(() => d.adapter.syncPort.importEvents(conflicting), /conflicting/);assert.deepEqual(d.adapter.events(), source);
});

test('JSON property order is immaterial while duplicate raw event content remains exact', async () => {
  const s = server(), c = client(s);await c.sync.start();c.answer();const source = c.adapter.events();
  const reordered = source.map(event => Object.fromEntries(Object.entries(event).reverse()));
  assert.equal(c.adapter.syncPort.importEvents(reordered).added, 0);assert.deepEqual(c.adapter.events(), source);c.sync.stop();
});

test('empty or already imported pages do not rewrite durable learning history', async () => {
  const storage = disk(), s = server(), c = client(s, { storage });await c.sync.start();c.answer('stable.item');
  const source = c.adapter.events(), set = storage.setItem, writes = [];
  storage.setItem = (key, value) => { writes.push(key);return set(key, value); };
  assert.equal(c.adapter.syncPort.importEvents([]).added, 0);
  assert.equal(c.adapter.syncPort.importEvents(source).added, 0);
  assert.equal(writes.filter(key => key === `${KEY}.device`).length, 0);
  assert.deepEqual(c.adapter.events(), source);c.sync.stop();
});

test('a flush requested during a pull uploads pending history before resolving', async () => {
  const s = server(), c = client(s);await c.sync.start();c.answer('during.pull');
  let releasePull;
  const get = s.get;
  s.get = request => new Promise(resolve => { releasePull = async () => resolve(await get(request)); });
  const pulling = c.sync.pull();
  while (!releasePull) await new Promise(resolve => setImmediate(resolve));
  const flushing = c.sync.flush();
  assert.equal(pulling, flushing);
  await releasePull();
  const result = await flushing;
  assert.equal(result.phase, 'synced');assert.equal(result.queued, 0);
  assert.deepEqual(s.log, c.adapter.events());assert.equal(s.posts.length, 1);c.sync.stop();
});

test('an empty pull repairs a stale disk snapshot before the account is reopened', async () => {
  const s = server(), storage = disk(), c = client(s, { storage });await c.sync.start();
  const pid = c.adapter.present({ id: 'late.tab', itemKey: 'late.tab', skillId: 'ko.reading.detail',
    difficulty: 1, modality: 'reading', responseFormat: 'single-choice' });
  const stale = storage.getItem(`${KEY}.device`);
  c.adapter.answer(pid, { correct: true, assessable: true });
  const source = c.adapter.events();
  storage.setItem(`${KEY}.device`, stale); // Another tab finishes its older write late.
  await c.sync.pull();
  assert.deepEqual(JSON.parse(storage.getItem(`${KEY}.device`)).events, source);
  c.sync.stop();
  const reopened = client(s, { storage });
  assert.equal((await reopened.sync.start()).phase, 'synced');
  assert.equal(reopened.sync.status().queued, 0);assert.deepEqual(s.log, source);reopened.sync.stop();
});

test('transient failures have bounded attempts and backoff and can be retried explicitly', async () => {
  const s = server(), delays = [], c = client(s, { options: { maxAttempts: 3, backoffMs: [10, 20], sleep: async ms => delays.push(ms) } });
  s.offline = true;await c.sync.start();assert.equal(s.gets.length, 3);assert.deepEqual(delays, [10, 20]);
  assert.equal(c.sync.status().phase, 'offline');s.offline = false;await c.sync.retry();assert.equal(c.sync.status().phase, 'synced');c.sync.stop();
});

test('a hanging transport times out within bounded retries', async () => {
  let calls = 0;const c = client({ get: () => { calls++;return new Promise(() => {}); }, post: async () => assert.fail() },
    { options: { maxAttempts: 2, timeoutMs: 5 } });
  await c.sync.start();assert.equal(calls, 2);assert.equal(c.sync.status().phase, 'offline');c.sync.stop();
});

test('account reset cannot masquerade as deleting remote records; device reset is unchanged', async () => {
  const s = server(), c = client(s);await c.sync.start();c.answer();await c.sync.flush();const before = copy(s.log);
  assert.throws(() => c.adapter.reset(), { code: 'ACCOUNT_RESET_REQUIRED' });assert.deepEqual(s.log, before);c.sync.stop();
  const guest = createGame({ gameId: 'guest', map, storage: disk() });assert.equal(guest.reset().independent, 0);
});

test('corrupt or unavailable outbox storage is preserved and prevents transmission', async () => {
  const storage = disk(), s = server();storage.setItem(`${SYNC_KEY}.account.a`, 'broken');
  const c = client(s, { storage });await c.sync.start();assert.equal(c.sync.status().code, 'STORAGE_ERROR');assert.equal(storage.getItem(`${SYNC_KEY}.account.a`), 'broken');assert.equal(s.gets.length, 0);c.sync.stop();
  const limited = disk(), d = client(s, { storage: limited });await d.sync.start();
  const set = limited.setItem;limited.setItem = (key, value) => { if (key.startsWith(SYNC_KEY)) throw new Error('quota');set(key, value); };
  d.answer();assert.equal(d.sync.status().code, 'STORAGE_ERROR');assert.ok(limited.getItem(`${KEY}.device`));d.sync.stop();
});

test('passing account options over a guest or another account store never adopts that history', async () => {
  const storage = disk(), guest = createGame({ gameId: 'guest', map, storage });
  const pid = guest.present({ id: 'guest.item', itemKey: 'guest.item', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1 });
  guest.answer(pid, { correct: true, assessable: true });const original = storage.getItem(`${KEY}.device`);
  const s = server(), adopted = client(s, { storage });await adopted.sync.start();
  assert.equal(adopted.sync.status().code, 'STORAGE_ERROR');assert.equal(adopted.adapter.summary().independent, 0);
  assert.equal(storage.getItem(`${KEY}.device`), original);assert.equal(s.posts.length, 0);adopted.sync.stop();
  const proper = client(s);await proper.sync.start();proper.answer();proper.sync.stop();
  const wrongAccount = client(s, { storage: proper.storage, accountKey: 'account.b' });await wrongAccount.sync.start();
  assert.equal(wrongAccount.sync.status().code, 'STORAGE_ERROR');assert.equal(wrongAccount.adapter.events().length, 0);wrongAccount.sync.stop();
});
