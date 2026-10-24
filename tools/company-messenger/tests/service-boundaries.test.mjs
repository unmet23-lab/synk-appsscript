import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMessenger } from '../server.mjs';
import { createServer } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initializeMessengerBaseSchema, initializeCollaborationSchema } from '../messenger-schema.mjs';
import { createUnitOfWork } from '../unit-of-work.mjs';
import { validateTaskTransition } from '../task-transition.mjs';
import { dispatchRequest, NOT_HANDLED } from '../routes/request-router.mjs';
import { createVoiceRoutes } from '../routes/voice.mjs';
import { createPublicAccountRoutes } from '../routes/public-account.mjs';
import { createMemberAccountRoutes } from '../routes/member-account.mjs';
import { createChannelsRoutes } from '../routes/channels.mjs';
import { createMessagesRoutes } from '../routes/messages.mjs';
import { createFilesRoutes } from '../routes/files.mjs';
import { createEventsRoutes } from '../routes/events.mjs';

const check = (ok, status, message) => { if (!ok) throw Object.assign(new Error(message), { status }); };

test('schema initialization upgrades legacy data once and preserves it on restart', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE channels(id TEXT PRIMARY KEY,system_key TEXT);
    CREATE TABLE messages(id INTEGER PRIMARY KEY,channel_id TEXT,user_id TEXT,body TEXT);
    CREATE TABLE message_tasks(id TEXT PRIMARY KEY,message_id INTEGER,assignee_id TEXT,creator_id TEXT,title TEXT,due_date TEXT,status TEXT,created_at TEXT,updated_at TEXT,revision INTEGER);
    INSERT INTO users VALUES('worker'); INSERT INTO channels VALUES('news','announcements');
    INSERT INTO messages VALUES(1,'news','worker','unchanged');
    INSERT INTO message_tasks VALUES('task',1,'worker','worker','legacy',NULL,'doing','before','before',4);`);
  initializeCollaborationSchema(db);
  assert.equal(db.prepare('SELECT ack_required FROM messages').get().ack_required, 1);
  const task = db.prepare('SELECT * FROM message_tasks').get();
  assert.equal(task.stage, 'doing'); assert.equal(task.revision, 4);
  db.exec("UPDATE message_tasks SET stage='review'; UPDATE messages SET ack_required=0;");
  initializeCollaborationSchema(db);
  assert.equal(db.prepare('SELECT stage FROM message_tasks').get().stage, 'review');
  assert.equal(db.prepare('SELECT ack_required FROM messages').get().ack_required, 0);
  assert.equal(db.prepare('SELECT body FROM messages').get().body, 'unchanged');
});

test('full schema bootstrap is idempotent and retains the same SQL definitions', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const options = { teamDescription: 'team', legacyTeamDescription: 'legacy' };
  initializeMessengerBaseSchema(db, options); initializeCollaborationSchema(db);
  const snapshot = () => db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').all();
  const before = snapshot(); initializeMessengerBaseSchema(db, options); initializeCollaborationSchema(db);
  assert.deepEqual(snapshot(), before);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

test('nested services publish after one commit; rollback discards all publications', () => {
  const log = [], transaction = work => { log.push('begin'); try { const result = work(); log.push('commit'); return result; } catch (error) { log.push('rollback'); throw error; } };
  const unit = createUnitOfWork(transaction);
  const saveChild = () => unit.run(({ afterCommit }) => { log.push('child'); afterCommit(() => log.push('notify')); });
  assert.equal(unit.run(({ afterCommit }) => { log.push('parent'); saveChild(); afterCommit(() => log.push('message')); return 42; }), 42);
  assert.deepEqual(log, ['begin','parent','child','commit','notify','message']);
  log.length = 0;
  assert.throws(() => unit.run(() => { saveChild(); throw Error('receipt failed'); }), /receipt failed/);
  assert.deepEqual(log, ['begin','child','rollback']);
  log.length = 0; saveChild(); assert.deepEqual(log, ['begin','child','commit','notify']);
});

test('publication failure never rolls back committed records and its owner can continue delivery', () => {
  const log = [], unit = createUnitOfWork(work => { const result = work(); log.push('committed'); return result; });
  assert.equal(unit.run(({ afterCommit }) => { afterCommit(() => { throw Error('offline'); }); afterCommit(() => log.push('second')); return 'saved'; }, { onPublishError: error => log.push(error.message) }), 'saved');
  assert.deepEqual(log, ['committed','offline','second']);
  assert.throws(() => unit.run(() => Promise.resolve()), /synchronous/);
  assert.throws(() => unit.run(() => { unit.run(() => Promise.resolve()); }), /synchronous/);
});

test('pure task policy protects review and closed results while retaining reviewer recovery', () => {
  const prior = { stage: 'review', assignee_id: 'worker', reviewer_id: 'away', creator_id: 'owner', title: 'task', due_date: null, result_message_id: 1 };
  const facts = { prior, next: { assigneeId: 'worker', reviewerId: 'new', title: 'task', dueDate: null, stage: 'review', result: { id: 1 } }, actor: { userId: 'owner', owner: true }, recovery: true, legacyStatus: false, allowedStages: [] };
  assert.doesNotThrow(() => validateTaskTransition(facts, check));
  assert.throws(() => validateTaskTransition({ ...facts, next: { ...facts.next, result: { id: 2 } } }, check), { status: 409 });
  assert.throws(() => validateTaskTransition({ ...facts, recovery: false }, check), { status: 409 });
  assert.throws(() => validateTaskTransition({ ...facts, actor: { userId: 'worker', owner: false } }, check), { status: 403 });
  assert.doesNotThrow(() => validateTaskTransition({ ...facts, recovery: false, next: { ...facts.next, reviewerId: 'away', stage: 'done' }, actor: { userId: 'away', owner: false }, allowedStages: ['done'] }, check));
});

test('router distinguishes streaming ownership from no match and retains declared precedence', async () => {
  const seen = [];
  assert.equal(await dispatchRequest({}, [() => { seen.push('miss'); return NOT_HANDLED; }, () => { seen.push('stream'); }, () => { seen.push('late'); }]), true);
  assert.deepEqual(seen, ['miss','stream']);
  assert.equal(await dispatchRequest({}, [() => NOT_HANDLED]), false);
});

test('a voice route consumes the revalidated actor after async provider work', async () => {
  let actor = { user: { id: 'old' }, auth: { token: 'old-token' } }, result;
  const route = createVoiceRoutes({ voiceService: { async sweep() {}, current(id, token) { return { id, token }; } }, requireChannel() {}, assert: check });
  const context = { p: '/api/voice/current', method: 'GET', get user() { return actor.user; }, get auth() { return actor.auth; }, revalidate() { actor = { user: { id: 'fresh' }, auth: { token: 'fresh-token' } }; }, respond(status, body) { result = { status, body }; } };
  await route(context);
  assert.deepEqual(result, { status: 200, body: { id: 'fresh', token: 'fresh-token' } });
});

test('legacy announcement adoption precedes acknowledgement backfill during startup', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'synk-schema-order-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const db = new DatabaseSync(join(dir, 'messenger.sqlite'));
  initializeMessengerBaseSchema(db, { teamDescription: 'team', legacyTeamDescription: 'legacy' });
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('owner','owner','Owner','owner','unused','2026-01-01');
  db.prepare('INSERT INTO channels(id,name,description,kind,created_at) VALUES(?,?,?,?,?)').run('old-news','공지사항','팀에 필요한 소식을 모아 두세요','channel','2026-01-01');
  db.prepare('INSERT INTO messages(channel_id,user_id,body,created_at) VALUES(?,?,?,?)').run('old-news','owner','legacy news','2026-01-01');
  db.close();
  const app = createMessenger({ dataDir: dir, port: 0, backgroundJobsEnabled: false, driveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } });
  try {
    assert.equal(app.db.prepare('SELECT system_key FROM channels WHERE id=?').get('old-news').system_key, 'announcements');
    assert.equal(app.db.prepare('SELECT ack_required FROM messages WHERE channel_id=?').get('old-news').ack_required, 1);
  } finally { await app.close(); }
});

test('route boundaries revalidate after an asynchronous miss before another feature writes', async () => {
  let revoked=false,writes=0;
  const context={p:'/api/channels/room',revalidate(){if(revoked)throw Object.assign(new Error('revoked'),{status:401});}};
  await assert.rejects(dispatchRequest(context,[async()=>{revoked=true;return NOT_HANDLED;},()=>{writes++;}]),{status:401});
  assert.equal(writes,0);
  assert.equal(await dispatchRequest({p:'/styles.css',revalidate(){throw Error('static requires no session');}},[()=>NOT_HANDLED]),false);
});

test('synchronous route misses do not yield or reread directory authentication', () => {
  let validations=0,writes=0;
  const context={p:'/api/channels',revalidate(){validations++;}};
  assert.equal(dispatchRequest(context,[()=>NOT_HANDLED,()=>NOT_HANDLED,()=>{writes++;}]),true);
  assert.equal(writes,1);assert.equal(validations,0);
  assert.equal(dispatchRequest(context,[()=>NOT_HANDLED]),false);
});

test('every feature route rejects an unmatched path synchronously', () => {
  const context={p:'/api/not-a-route',method:'GET'};
  for(const create of [createPublicAccountRoutes,createVoiceRoutes,createMemberAccountRoutes,createChannelsRoutes,createMessagesRoutes,createFilesRoutes,createEventsRoutes]){
    assert.equal(create({})(context),NOT_HANDLED,create.name);
  }
});

test('unsupported message and file methods finish with 404 without writes or extra authentication', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'synk-method-fallthrough-'));
  let authentications = 0, directoryReads = 0;
  const origin = 'http://workspace.example.test';
  const integration = { origin, listUsers() { directoryReads++; return [{ id: 'company-admin', name: 'Admin', role: 'admin', active: true }]; }, listTeams: () => [],
    authenticate() { authentications++; return { companyUserId: 'company-admin', role: 'admin', canWrite: true, canManage: true, csrfToken: 'fixture-csrf', token: 'fixture-session' }; } };
  const app = createMessenger({ dataDir: dir, port: 0, backgroundJobsEnabled: false, integration, driveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } });
  const server = createServer(app.handler);
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await app.close(); await rm(dir, { recursive: true, force: true }); });
  await app.startMounted(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = (method, path, body) => fetch('http://127.0.0.1:' + server.address().port + path, { method, headers: { Host: 'workspace.example.test', Origin: origin, 'X-CSRF-Token': 'fixture-csrf', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(2000) });
  const boot = await (await request('GET', '/api/bootstrap')).json(), room = boot.channels.find(row => row.systemKey === 'social').id;
  const sent = await request('POST', `/api/channels/${room}/messages`, { body: 'fixture message' }); assert.equal(sent.status, 201);
  const message = (await sent.json()).message;
  app.db.prepare('INSERT INTO files(id,channel_id,uploader_id,name,size,mime,disk_name,created_at) VALUES(?,?,?,?,?,?,?,?)').run('fixture-file', room, boot.user.id, 'fixture.txt', 1, 'text/plain', 'fixture.txt', '2026-10-24');
  const snapshot = () => Object.fromEntries(['messages', 'files', 'memberships', 'reactions', 'message_pins'].map(table => [table, app.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()]));
  const before = snapshot();
  for (const [method, path] of [['GET', `/api/channels/${room}/files`], ['GET', `/api/channels/${room}/read`], ['PUT', `/api/channels/${room}/messages`], ['POST', `/api/channels/${room}/pins`], ['POST', `/api/messages/${message.id}`], ['GET', `/api/messages/${message.id}/pin`], ['GET', `/api/messages/${message.id}/reactions`], ['POST', `/api/messages/${message.id}/replies`], ['PATCH', '/api/files/fixture-file'], ['HEAD', '/api/files/fixture-file']]) {
    const authBefore = authentications, directoryBefore = directoryReads;
    const response = await request(method, path); assert.equal(response.status, 404, method + ' ' + path); await response.text();
    assert.equal(authentications - authBefore, 3, method + ' authentication count');
    assert.equal(directoryReads - directoryBefore, 3, method + ' directory read count');
  }
  assert.deepEqual(snapshot(), before);
  const authBefore = authentications, response = await request('GET', `/api/channels/${room}/messages`);
  assert.equal(response.status, 200); assert.equal((await response.json()).messages[0].id, message.id);
  assert.equal(authentications - authBefore, 4);
});
