import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { createMessenger } from '../server.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-direct-task-'));
  const people = ['admin', 'worker', 'reviewer', 'viewer', 'peer'].map(key => ({ id: 'company-' + key, name: key, role: key === 'admin' ? 'admin' : key === 'viewer' ? 'viewer' : 'member', active: true }));
  const origin = 'http://workspace.example.test';
  const integration = { origin, listUsers: () => people, listTeams: () => [], authenticate(req) {
    const key = /^qa=([^;]+)$/.exec(req.headers.cookie || '')?.[1], person = people.find(row => row.id === 'company-' + key && row.active);
    return person ? { companyUserId: person.id, role: person.role, canWrite: person.role !== 'viewer', canManage: person.role === 'admin', csrfToken: 'csrf-' + key, token: 'session-' + key } : null;
  } };
  let app, server, url;
  async function start() {
    app = createMessenger({ dataDir: directory, port: 0, backgroundJobsEnabled: false, integration, driveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } });
    await app.startMounted(); server = createServer(app.handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); url = 'http://127.0.0.1:' + server.address().port;
  }
  async function stop() { await app.close(); server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
  await start();
  const controllers = [];
  t.after(async () => { controllers.forEach(controller => controller.abort()); await stop(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true }); });
  const f = { people, origin, get db() { return app.db; }, get url() { return url; },
    async raw(key, path, body, extra = {}) { return fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { Host: 'workspace.example.test', Cookie: 'qa=' + key, Origin: origin, 'X-CSRF-Token': 'csrf-' + key, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }); },
    async json(key, path, body, status = 200, extra) { const response = await f.raw(key, path, body, extra), value = await response.json(); assert.equal(response.status, status, path + ': ' + JSON.stringify(value)); return value; },
    async restart() { await stop(); await start(); },
    async events(key) { const controller = new AbortController(); controllers.push(controller); const response = await fetch(url + '/api/events', { headers: { Host: 'workspace.example.test', Cookie: 'qa=' + key, Origin: origin }, signal: controller.signal }); const reader = response.body.getReader(), events = []; const first = await reader.read(); events.push(new TextDecoder().decode(first.value)); const pump = (async () => { try { while (true) { const chunk = await reader.read(); if (chunk.done) break; events.push(new TextDecoder().decode(chunk.value)); } } catch {} })(); return { events, stop: () => controller.abort(), pump }; },
    counts() { return Object.fromEntries(['messages', 'message_tasks', 'notifications', 'productivity_events', 'message_send_requests'].map(table => [table, f.db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n])); },
  };
  f.boot = Object.fromEntries(await Promise.all(['admin', 'worker', 'reviewer', 'viewer', 'peer'].map(async key => [key, await f.json(key, '/api/bootstrap')])));
  f.room = f.boot.admin.channels.find(row => row.systemKey === 'social').id;
  f.payload = (overrides = {}) => ({ requestId: randomUUID(), channelId: f.room, title: '캐러셀 만들기', body: '표지와 본문 3장을 만들고 390px에서 확인해 주세요.', assigneeId: f.boot.worker.user.id, reviewerId: f.boot.reviewer.user.id, dueDate: '2026-10-10', ...overrides });
  return f;
}

test('authoritative creation options preserve personal notes and filter posting authority per room', async t => {
  const f = await fixture(t), admin = await f.json('admin', '/api/tasks/create-options'), worker = await f.json('worker', '/api/tasks/create-options');
  assert.match(admin.date, /^\d{4}-\d{2}-\d{2}$/);
  const self = worker.channels.find(row => row.kind === 'self'); assert.equal(self.name, '나에게'); assert.deepEqual(self.taskAssignees.map(row => row.id), [f.boot.worker.user.id]);
  const announcements = admin.channels.find(row => row.systemKey === 'announcements'); assert.deepEqual(announcements.taskAssignees.map(row => row.id), [f.boot.admin.user.id]);
  assert.ok(!worker.channels.some(row => row.systemKey === 'announcements')); assert.ok(!worker.channels.some(row => row.kind === 'self' && row.id !== self.id));
  assert.ok(worker.channels.find(row => row.id === f.room).taskAssignees.every(row => row.companyRole !== 'viewer'));
  assert.deepEqual((await f.json('viewer', '/api/tasks/create-options')).channels, []);
});

test('direct creation stores source, task, ordinary/task alerts and original workflow together', async t => {
  const f = await fixture(t);
  f.db.prepare('INSERT INTO channel_notifications VALUES(?,?,?)').run(f.room, f.boot.peer.user.id, 'all');
  const created = await f.json('admin', '/api/tasks', f.payload(), 201);
  assert.equal(created.created, true); assert.equal(created.message.body, '표지와 본문 3장을 만들고 390px에서 확인해 주세요.');
  assert.equal(created.task.messageId, created.message.id); assert.equal(created.task.stage, 'requested'); assert.equal(created.task.revision, 1); assert.equal(created.task.createdBy.id, f.boot.admin.user.id);
  assert.deepEqual(f.counts(), { messages: 1, message_tasks: 1, notifications: 3, productivity_events: 1, message_send_requests: 1 });
  assert.ok((await f.json('worker', '/api/workday')).today.groups.reply.some(row => row.id === created.task.id));
  const next = await f.json('worker', '/api/messages/' + created.message.id + '/task', { revision: created.task.revision, stage: 'accepted' }); assert.equal(next.task.stage, 'accepted');
});

test('personal tasks remain private and accept an explicitly undated deadline', async t => {
  const f = await fixture(t), self = f.boot.worker.channels.find(row => row.kind === 'self');
  const created = await f.json('worker', '/api/tasks', f.payload({ channelId: self.id, assigneeId: f.boot.worker.user.id, reviewerId: null, dueDate: null }), 201);
  assert.equal(created.task.dueDate, null); assert.equal(created.task.reviewer, null); assert.equal(f.counts().notifications, 0);
  await f.json('peer', '/api/messages/' + created.message.id, undefined, 404);
  assert.equal((await f.json('peer', '/api/tasks?scope=all')).tasks.length, 0);
});

test('the same creation UUID replays across restart without repeating rows, alerts or stage changes', async t => {
  const f = await fixture(t), payload = f.payload(), created = await f.json('admin', '/api/tasks', payload, 201), counts = f.counts();
  const repeat = await f.json('admin', '/api/tasks', payload); assert.equal(repeat.created, false); assert.equal(repeat.message.id, created.message.id); assert.equal(repeat.task.id, created.task.id); assert.deepEqual(f.counts(), counts);
  await f.json('worker', '/api/messages/' + created.message.id + '/task', { revision: created.task.revision, stage: 'accepted' }); await f.restart();
  const resumed = await f.json('admin', '/api/tasks', payload); assert.equal(resumed.task.stage, 'accepted'); assert.equal(resumed.task.id, created.task.id);
});

test('concurrent identical creation requests produce one task and one receipt', async t => {
  const f = await fixture(t), payload = f.payload(), responses = await Promise.all([f.raw('admin', '/api/tasks', payload), f.raw('admin', '/api/tasks', payload)]), values = await Promise.all(responses.map(response => response.json()));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]); assert.equal(values[0].message.id, values[1].message.id); assert.equal(f.counts().message_tasks, 1); assert.equal(f.counts().message_send_requests, 1);
});

test('changed content, assignment or room cannot reuse a successful creation UUID', async t => {
  const f = await fixture(t), payload = f.payload(); await f.json('admin', '/api/tasks', payload, 201); const before = f.counts();
  for (const change of [{ body: '다른 원문' }, { title: '다른 제목' }, { dueDate: null }, { assigneeId: f.boot.reviewer.user.id, reviewerId: f.boot.worker.user.id }, { channelId: f.boot.admin.channels.find(row => row.kind === 'self').id }]) await f.json('admin', '/api/tasks', { ...payload, ...change }, 409);
  assert.deepEqual(f.counts(), before);
});

test('a deleted original is a tombstone rather than a new task on retry', async t => {
  const f = await fixture(t), payload = f.payload(), created = await f.json('admin', '/api/tasks', payload, 201);
  f.db.prepare('DELETE FROM messages WHERE id=?').run(created.message.id); await f.json('admin', '/api/tasks', payload, 410);
  assert.equal(f.counts().messages, 0); assert.equal(f.counts().message_tasks, 0); assert.equal(f.counts().message_send_requests, 1);
});

for (const [table, phase] of [['message_tasks', 'task insert'], ['message_send_requests', 'receipt insert after task and ordinary notifications']]) {
  test(`failed ${phase} rolls back every row and emits no SSE update`, async t => {
    const f = await fixture(t); f.db.prepare('INSERT INTO channel_notifications VALUES(?,?,?)').run(f.room, f.boot.peer.user.id, 'all');
    const stream = await f.events('worker'); const before = f.counts();
    f.db.exec(`CREATE TRIGGER reject_direct_task BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'synthetic fault'); END;`);
    await f.json('admin', '/api/tasks', f.payload(), 500); await new Promise(resolve => setTimeout(resolve, 40));
    assert.deepEqual(f.counts(), before); assert.ok(!stream.events.join('').includes('event: update'));
    stream.stop(); await stream.pump;
  });
}

test('invalid fields, ineligible crew and readonly actors never leave a source message', async t => {
  const f = await fixture(t), before = f.counts(), self = f.boot.worker.channels.find(row => row.kind === 'self');
  for (const change of [{ requestId: 'invalid' }, { title: '' }, { body: '' }, { title: 'x'.repeat(201) }, { body: 'x'.repeat(8001) }, { dueDate: '2026-02-30' }, { assigneeId: f.boot.viewer.user.id }, { reviewerId: f.boot.viewer.user.id }, { reviewerId: f.boot.worker.user.id }, { stage: 'done' }, { fileIds: [] }]) await f.json('admin', '/api/tasks', f.payload(change), 400);
  await f.json('admin', '/api/tasks', f.payload({ channelId: self.id }), 404);
  await f.json('viewer', '/api/tasks', f.payload(), 403);
  await f.json('worker', '/api/tasks', f.payload({ channelId: f.boot.admin.channels.find(row => row.systemKey === 'announcements').id }), 403);
  assert.deepEqual(f.counts(), before);
});

test('integrated mutations require the live CSRF, original company origin and session', async t => {
  const f = await fixture(t), before = f.counts();
  await f.json('admin', '/api/tasks', f.payload(), 403, { 'X-CSRF-Token': 'wrong' });
  await f.json('admin', '/api/tasks', f.payload(), 403, { Origin: 'https://outside.example.test' });
  await f.json('admin', '/api/tasks', f.payload(), 401, { Cookie: '' });
  assert.deepEqual(f.counts(), before);
});

test('creation rechecks selected crew after options become stale through departure or role revocation', async t => {
  const f = await fixture(t), project = (await f.json('admin', '/api/channels', { name: '선택한 프로젝트', category: 'project', scope: 'private', memberIds: [f.boot.worker.user.id, f.boot.reviewer.user.id] }, 201)).channel;
  const original = (await f.json('admin', '/api/tasks/create-options')).channels.find(row => row.id === project.id);
  assert.ok(original.taskAssignees.some(row => row.id === f.boot.worker.user.id));
  await f.json('worker', '/api/channels/' + project.id + '/leave', {});
  const before = f.counts();
  await f.json('admin', '/api/tasks', f.payload({ channelId: project.id }), 400);
  assert.ok(!(await f.json('admin', '/api/tasks/create-options')).channels.find(row => row.id === project.id).taskAssignees.some(row => row.id === f.boot.worker.user.id));
  f.people.find(row => row.id === 'company-reviewer').role = 'viewer';
  await f.json('admin', '/api/tasks', f.payload(), 400);
  assert.deepEqual(f.counts(), before);
});

test('a company session revoked while the request body arrives cannot commit the task', async t => {
  const f = await fixture(t), body = JSON.stringify(f.payload()), before = f.counts();
  const response = new Promise((resolve, reject) => {
    const request = httpRequest(f.url + '/api/tasks', { method: 'POST', headers: { Host: 'workspace.example.test', Cookie: 'qa=admin', Origin: f.origin, 'X-CSRF-Token': 'csrf-admin', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, reply => { reply.resume(); reply.on('end', () => resolve(reply.statusCode)); });
    request.on('error', reject); request.write(body.slice(0, 5)); setTimeout(() => { f.people.find(row => row.id === 'company-admin').active = false; request.end(body.slice(5)); }, 25);
  });
  assert.equal(await response, 401); assert.deepEqual(f.counts(), before);
});
