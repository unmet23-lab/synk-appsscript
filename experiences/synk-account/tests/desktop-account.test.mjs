import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopAccountClient, createDesktopClassroomClient, authMessage } from '../src/desktop-account.mjs';
import { readFile } from 'node:fs/promises';

test('desktop account adapter sends fixed operations, never credentials or arbitrary URLs', async () => {
  const calls = [], client = createDesktopAccountClient({ product: 'world', guard() {}, bridge: { accountRequest: async (...args) => { calls.push(args);return { ok: true }; } } });
  await client.load();await client.setLearning(true, 3);await client.exportPage({ after: 9 });
  await client.learning.post({ revision: 3, events: [{ id: 'synthetic' }] });
  assert.deepEqual(calls, [['load', {}], ['setLearning', { enabled: true, expected_revision: 3 }], ['exportPage', { after: 9 }], ['learningPost', { revision: 3, events: [{ id: 'synthetic' }] }]]);
  assert.equal('getAccessToken' in client, false);
});
test('a logout or account switch fences a late desktop response and queued work', async () => {
  let active = true, resolve;
  const client = createDesktopAccountClient({ product: 'world', guard() { if (!active) throw Object.assign(new Error('changed'), { code: 'ACCOUNT_CHANGED' }); }, bridge: { accountRequest: () => new Promise(done => { resolve = done; }) } });
  const pending = client.load();active = false;resolve({ ok: true, account: { synk_user_id: 'previous' } });
  await assert.rejects(pending, { code: 'ACCOUNT_CHANGED' });
  await assert.rejects(client.learning.post({ revision: 1, events: [] }), { code: 'ACCOUNT_CHANGED' });
});

test('desktop memory uses the personal account revision and rejects late or aborted replies', async () => {
  const calls=[];let live=true,release;
  const client=createDesktopAccountClient({product:'world',guard(){if(!live)throw Object.assign(Error('changed'),{code:'ACCOUNT_CHANGED'});},bridge:{accountRequest:async(...args)=>{calls.push(args);return args[0]==='memoryGet'?new Promise(resolve=>{release=resolve;}):{ok:true};}}});
  const waiting=client.memory.get({revision:2});live=false;release({ok:true,revision:2,entries:[]});await assert.rejects(waiting,{code:'ACCOUNT_CHANGED'});
  await assert.rejects(client.memory.post({revision:2,entries:[]}),{code:'ACCOUNT_CHANGED'});
  live=true;await assert.rejects(client.memory.get({revision:2,signal:AbortSignal.abort()}),{code:'ABORTED'});
  await client.memory.post({revision:2,entries:[]});await client.atlasSummary();
  assert.deepEqual(calls,[['memoryGet',{revision:2}],['memoryPost',{revision:2,entries:[]}],['atlasSummary',{}]]);
});
test('desktop service rejection and cancellation preserve their meaning for offline learning', async () => {
  const client = createDesktopAccountClient({ product: 'world', guard() {}, bridge: { accountRequest: async () => ({ ok: false, error: { code: 'NETWORK', message: 'retry', retryable: true } }) } });
  await assert.rejects(client.load(), { code: 'NETWORK', retryable: true });
  await assert.rejects(client.learning.get({ after: 0, revision: 1, signal: AbortSignal.abort() }), { code: 'ABORTED' });
  assert.match(authMessage({ configured: true, status: 'signing-in' }), /브라우저/);
  assert.match(authMessage({ configured: false }), /준비/);
});
test('mobile home entries remain separate products with no authentication tokens or offline promise', async () => {
  const manifests = await Promise.all(['platform', 'world'].map(async id => JSON.parse(await readFile(new URL(`../${id}.webmanifest`, import.meta.url), 'utf8'))));
  assert.notEqual(manifests[0].id, manifests[1].id);
  assert.equal(manifests[0].start_url, './platform.html');assert.equal(manifests[1].start_url, './client.html?product=world');
  for (const manifest of manifests) { assert.equal(manifest.display, 'standalone');assert.equal(/token|session|code=/i.test(manifest.start_url), false); }
});

test('desktop classroom transport uses fixed main IPC with a scoped class and preserves run data',async()=>{
  const calls=[],request=createDesktopClassroomClient({product:'world',guard(){},bridge:{accountRequest:async(...args)=>{calls.push(args);return{ok:true,rows:[]};}}});
  await request('classes');await request('student',{classId:'class-a'});await request('learningPost',{classId:'class-a',body:{revision:2,runId:'run-a',events:[]}});
  assert.deepEqual(calls,[['classroom',{operation:'classes'}],['classroom',{operation:'student',classId:'class-a'}],['classroom',{operation:'learningPost',classId:'class-a',body:{revision:2,runId:'run-a',events:[]}}]]);
  assert.throws(()=>createDesktopClassroomClient({product:'messenger',guard(){},bridge:{accountRequest(){}}}));
});

test('desktop classroom rejects late identity changes, cancelled replies and preserves server conflicts',async()=>{
  let live=true,release;const guard=()=>{if(!live)throw Object.assign(Error('changed'),{code:'ACCOUNT_CHANGED'});};
  const request=createDesktopClassroomClient({product:'platform',guard,bridge:{accountRequest:()=>new Promise(resolve=>{release=resolve;})}});
  const waiting=request('workspace',{classId:'class-a'});live=false;release({ok:true,students:['old-account']});await assert.rejects(waiting,{code:'ACCOUNT_CHANGED'});
  live=true;const controller=new AbortController(),cancelled=request('student',{classId:'class-a'},{signal:controller.signal});controller.abort();release({ok:true});await assert.rejects(cancelled,{code:'ABORTED'});
  await assert.rejects(request('classes',{}, {signal:AbortSignal.abort()}),{code:'ABORTED'});
  const conflict=createDesktopClassroomClient({product:'world',guard,bridge:{accountRequest:async()=>({ok:false,error:{code:'REVISION_CONFLICT',message:'changed',status:409},revision:7})}});
  await assert.rejects(conflict('student',{classId:'class-a'}),{code:'REVISION_CONFLICT',status:409,revision:7});
});
