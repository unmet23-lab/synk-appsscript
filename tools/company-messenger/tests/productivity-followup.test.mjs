import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createCollaborationService } from '../collaboration-service.mjs';

async function fixture(t, { backgroundJobsEnabled = true, workNotificationsEnabled } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-followup-'));
  let db, service, inTransaction = false, stamp = '2026-10-08T00:00:00.000Z';
  const events = [];
  const check = (condition, status, message) => { if (!condition) throw Object.assign(new Error(message), { status }); };
  const members = () => db.prepare('SELECT * FROM users WHERE active=1').all().map(row => ({ id: row.id, name: row.name, role: row.role, companyRole: row.role }));
  const requireChannel = (userId, channelId) => { const channel = db.prepare('SELECT c.* FROM channels c JOIN memberships m ON m.channel_id=c.id WHERE m.user_id=? AND c.id=? AND c.deleted_at IS NULL').get(userId, channelId); check(channel && members().some(user => user.id === userId), 404, '대화방을 찾을 수 없습니다.'); return channel; };
  const requirePosting = (userId, channelId) => { const channel = requireChannel(userId, channelId); check(members().find(user => user.id === userId)?.role !== 'viewer', 403, '작성 권한이 없습니다.'); return channel; };
  const requireMessage = (id, userId) => { const message = db.prepare('SELECT * FROM messages WHERE id=?').get(id); check(message, 404, '메시지를 찾을 수 없습니다.'); requireChannel(userId, message.channel_id); return message; };
  function open() {
    db = new DatabaseSync(join(directory, 'fixture.sqlite')); db.exec('PRAGMA foreign_keys=ON');
    db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT,role TEXT,active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS channels(id TEXT PRIMARY KEY,system_key TEXT,deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS memberships(channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(channel_id,user_id));
      CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),body TEXT,created_at TEXT,edited_at TEXT,reply_to_id INTEGER);`);
    service = createCollaborationService({ db, assert: check, textField: (value, label, max, min = 0) => { check(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max, 400, label); return value.trim(); }, now: () => stamp,
      transaction: fn => { db.exec('BEGIN'); inTransaction = true; try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } finally { inTransaction = false; } },
      members, requireChannel, requirePosting, requireMessage,
      messageShape: (row, userId) => ({ id: String(row.id), channelId: row.channel_id, body: row.body, ...service.messageExtras(row, userId) }),
      publish: (type, channelId, userId) => events.push({ type, channelId, userId }), origin: () => 'http://fixture.test', resolveLink: value => value.workspaceLink, backgroundJobsEnabled, workNotificationsEnabled });
  }
  open();
  for (const [id, role] of [['admin', 'owner'], ['requester', 'member'], ['worker', 'member'], ['reviewer', 'member'], ['replacement', 'member'], ['outsider', 'member']]) db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
  db.prepare('INSERT INTO channels(id) VALUES(?)').run('room'); db.prepare('INSERT INTO channels(id) VALUES(?)').run('other');
  for (const person of members()) db.prepare('INSERT INTO memberships VALUES(?,?)').run('room', person.id);
  db.prepare('INSERT INTO memberships VALUES(?,?)').run('other', 'admin');
  t.after(async () => { db.close(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.split(sep).at(-1).startsWith('synk-followup-')); await rm(directory, { recursive: true, force: true }); });
  const f = {
    get db() { return db; }, get service() { return service; }, get productivity() { return service.productivity; }, events,
    setTime: value => { stamp = value; }, restart: () => { db.close(); open(); }, get inTransaction() { return inTransaction; },
    send(userId, body = '확인할 메시지', room = 'room') { const result = db.prepare('INSERT INTO messages(channel_id,user_id,body,created_at) VALUES(?,?,?,?)').run(room, userId, body, stamp); return String(result.lastInsertRowid); },
    create(userId = 'requester', assigneeId = 'worker', body = {}) { const messageId = f.send(userId, body.title || '진행할 업무'); return f.productivity.upsertTask({ messageId, userId, method: 'POST', body: { assigneeId, ...body } }).task; },
    patch(task, userId, body) { return f.productivity.upsertTask({ messageId: task.messageId, userId, body: { revision: task.revision, ...body } }).task; },
    async api(userId, path, method = 'GET', body = {}) { let result; const handled = await service.handle({ p: path.split('?')[0], method, url: new URL(path, 'http://fixture.test'), user: { id: userId }, readBody: async () => body, respond: (status, value) => { result = { status, ...value }; } }); assert.equal(handled, true); return result; },
  };
  f.reviewTask = () => { let task = f.create('requester', 'worker', { reviewerId: 'reviewer' }); task = f.patch(task, 'worker', { stage: 'accepted' }); task = f.patch(task, 'worker', { stage: 'doing' }); const result = f.send('worker', '기존 검토 결과물'); return f.patch(task, 'worker', { stage: 'review', resultMessageId: result }); };
  return f;
}
const status = expected => error => error.status === expected;
const digests = inbox => inbox.items.filter(item => item.kind === 'due_digest');

test('a departed reviewer can be replaced by the present requester without changing the result or allowing self approval', async t => {
  const f = await fixture(t), task = f.reviewTask();
  assert.equal(task.reviewerUnavailable, false);
  assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
  f.db.prepare('DELETE FROM memberships WHERE user_id=? AND channel_id=?').run('reviewer', 'room');
  const view = f.productivity.getTask(task.messageId, 'requester');
  assert.equal(view.reviewerUnavailable, true); assert.equal(view.canReassignReviewer, true); assert.equal(view.reviewerId, 'reviewer');
  assert.equal(f.productivity.getTask(task.messageId, 'worker').canReassignReviewer, false);
  assert.throws(() => f.patch(task, 'worker', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
  assert.throws(() => f.patch(task, 'outsider', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
  assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'worker' }), status(400));
  assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement', stage: 'done' }), status(409));
  const next = f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement' });
  assert.equal(next.stage, 'review'); assert.equal(next.resultMessageId, task.resultMessageId); assert.equal(next.revision, task.revision + 1);
  assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement' }), status(409));
  const event = f.productivity.catchUp('requester').events.at(-1);
  assert.equal(event.kind, 'task_reviewer_reassigned'); assert.deepEqual(event.changes, { from: 'reviewer', to: 'replacement', reason: 'reviewer_unavailable' });
  assert.equal((await f.api('replacement', '/api/notifications')).items.some(item => item.kind === 'task' && item.message.id === task.messageId), true);
  assert.throws(() => f.patch(next, 'reviewer', { stage: 'done' }), status(404));
  assert.equal(f.patch(next, 'replacement', { stage: 'done' }).stage, 'done');
});

test('disabled or downgraded reviewers require current posting authority for recovery and new review survives restart', async t => {
  const f = await fixture(t), task = f.reviewTask();
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run('reviewer');
  assert.equal(f.productivity.getTask(task.messageId, 'requester').reviewer, null);
  f.db.prepare('UPDATE users SET role=? WHERE id=?').run('viewer', 'requester');
  assert.equal(f.productivity.getTask(task.messageId, 'requester').canReassignReviewer, false);
  assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
  f.db.prepare('DELETE FROM memberships WHERE user_id=? AND channel_id=?').run('admin', 'room');
  assert.throws(() => f.patch(task, 'admin', { reassignReviewer: true, reviewerId: 'replacement' }), status(404));
  f.db.prepare('INSERT INTO memberships VALUES(?,?)').run('room', 'admin');
  f.db.prepare('UPDATE users SET role=? WHERE id=?').run('viewer', 'replacement');
  assert.throws(() => f.patch(task, 'admin', { reassignReviewer: true, reviewerId: 'replacement' }), status(400));
  f.db.prepare('UPDATE users SET role=? WHERE id=?').run('member', 'replacement');
  const next = f.patch(task, 'admin', { reassignReviewer: true, reviewerId: 'replacement' });
  f.restart(); assert.equal(f.productivity.getTask(task.messageId, 'admin').reviewer.id, 'replacement');
  assert.equal(f.patch(next, 'replacement', { stage: 'changes' }).stage, 'changes');
});

test('KST weekday digests start at 09:00, include overdue tasks once, and persist deduplication across restart', async t => {
  const f = await fixture(t, { backgroundJobsEnabled: false, workNotificationsEnabled: true });
  f.setTime('2026-10-07T23:59:59.000Z');
  const today = f.create('requester', 'worker', { dueDate: '2026-10-08' }), overdue = f.create('requester', 'worker', { dueDate: '2026-10-07' });
  f.create('requester', 'worker', { dueDate: '2026-10-09' });
  assert.equal(digests(await f.api('worker', '/api/notifications')).length, 0);
  f.setTime('2026-10-08T00:00:00.000Z');
  let digest = digests(await f.api('worker', '/api/notifications'))[0];
  assert.equal(digest.digest.date, '2026-10-08'); assert.equal(digest.digest.taskCount, 2); assert.equal(digest.digest.overdueCount, 1);
  assert.deepEqual(digest.digest.tasks.map(task => task.id), [overdue.id, today.id]); assert.equal(digest.message, null);
  const emitted = f.events.filter(row => row.type === 'notification' && row.channelId === null && row.userId === 'worker').length;
  f.service.deliverReminders(); f.restart(); f.service.deliverReminders();
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM due_digests').get().n, 1);
  assert.equal(f.events.filter(row => row.type === 'notification' && row.channelId === null && row.userId === 'worker').length, emitted);
  assert.equal(digests(await f.api('worker', '/api/notifications'))[0].id, digest.id);
  await f.api('worker', `/api/notifications/${encodeURIComponent(digest.id)}/read`, 'POST');
  assert.ok(digests(await f.api('worker', '/api/notifications'))[0].readAt);
  assert.equal(digests(await f.api('worker', '/api/notifications?unread=1')).length, 0);
  assert.equal(f.productivity.getTask(today.messageId, 'worker').stage, 'requested');
});

test('weekend and off preferences are personal, defaults do not backfill absent days, and latest digest is the only repeated deadline item', async t => {
  const f = await fixture(t, { backgroundJobsEnabled: false, workNotificationsEnabled: true }); f.create('requester', 'worker', { dueDate: '2026-10-08' });
  assert.deepEqual(await f.api('worker', '/api/workday/notifications'), { status: 200, enabled: true, includeWeekends: false, schedulerEnabled: true });
  const first = digests(await f.api('worker', '/api/notifications'))[0];
  f.setTime('2026-10-10T00:00:00.000Z'); f.service.deliverReminders();
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM due_digests').get().n, 1);
  await f.api('worker', '/api/workday/notifications', 'PATCH', { includeWeekends: true });
  const weekend = digests(await f.api('worker', '/api/notifications'))[0];
  assert.equal(weekend.digest.date, '2026-10-10'); assert.notEqual(weekend.id, first.id);
  assert.equal(digests(await f.api('worker', '/api/notifications')).length, 1);
  await f.api('worker', '/api/workday/notifications', 'PATCH', { enabled: false });
  assert.equal(digests(await f.api('worker', '/api/notifications')).length, 0);
  f.setTime('2026-10-13T08:00:00.000Z'); f.service.deliverReminders();
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM due_digests').get().n, 2);
  await f.api('worker', '/api/workday/notifications', 'PATCH', { enabled: true, includeWeekends: false });
  const afterAbsence = digests(await f.api('worker', '/api/notifications'))[0];
  assert.equal(afterAbsence.digest.date, '2026-10-13'); assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM due_digests').get().n, 3);
  assert.equal((await f.api('requester', '/api/workday/notifications')).includeWeekends, false);
  await assert.rejects(f.api('worker', '/api/workday/notifications', 'PATCH', { enabled: 'false' }), status(400));
});

test('digest projection removes completed, reassigned, muted, archived and inaccessible tasks without losing surviving sources', async t => {
  const f = await fixture(t, { backgroundJobsEnabled: false, workNotificationsEnabled: true }), tasks = Array.from({ length: 5 }, (_, i) => f.create('requester', 'worker', { dueDate: '2026-10-08', title: '업무' + i }));
  const first = digests(await f.api('worker', '/api/notifications'))[0];
  f.db.prepare('DELETE FROM messages WHERE id=?').run(tasks[0].messageId);
  f.patch(tasks[1], 'worker', { status: 'done' });
  f.patch(tasks[2], 'requester', { assigneeId: 'replacement' });
  f.patch(tasks[3], 'requester', { dueDate: '2026-11-01' });
  const surviving = digests(await f.api('worker', '/api/notifications'))[0];
  assert.equal(surviving.id, first.id); assert.deepEqual(surviving.digest.tasks.map(task => task.id), [tasks[4].id]);
  await f.api('worker', '/api/channels/room/notifications', 'PATCH', { mode: 'mute' });
  assert.equal(digests(await f.api('worker', '/api/notifications')).length, 0);
  await f.api('worker', '/api/channels/room/notifications', 'PATCH', { mode: 'mentions' });
  f.db.prepare('UPDATE channels SET deleted_at=? WHERE id=?').run('2026-10-08T03:00:00Z', 'room');
  assert.equal(digests(await f.api('worker', '/api/notifications')).length, 0);
  f.db.prepare('UPDATE channels SET deleted_at=NULL WHERE id=?').run('room');
  f.db.prepare('DELETE FROM memberships WHERE user_id=? AND channel_id=?').run('worker', 'room');
  assert.equal(digests(await f.api('worker', '/api/notifications')).length, 0);
  await assert.rejects(f.api('worker', `/api/notifications/${encodeURIComponent(first.id)}/read`, 'POST'), status(404));
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM due_digests WHERE user_id=?').get('worker').n, 1);
});

test('background job opt-out suppresses due digests and leaves personal reminders pending through reads and restart', async t => {
  const f = await fixture(t, { backgroundJobsEnabled: false }), task = f.create('requester', 'worker', { dueDate: '2026-10-08' });
  await assert.rejects(f.api('worker', `/api/messages/${task.messageId}/reminder`, 'PUT', { remindAt: '2026-10-08T01:00:00Z' }), error => error.status === 503 && error.code === 'SYNK_WORK_NOTIFICATIONS_PAUSED');
  f.db.prepare('INSERT INTO message_reminders(id,message_id,user_id,remind_at,created_at) VALUES(?,?,?,?,?)').run('synthetic-restored-reminder', task.messageId, 'worker', '2026-10-08T01:00:00Z', '2026-10-08T00:00:00Z');
  f.setTime('2026-10-08T02:00:00Z'); f.service.deliverReminders();
  f.restart(); f.service.deliverReminders();
  const inbox = await f.api('worker', '/api/notifications');
  assert.equal(inbox.items.some(item => ['due_digest', 'reminder'].includes(item.kind)), false);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM due_digests').get().n, 0);
  assert.equal(f.db.prepare('SELECT delivered_at FROM message_reminders').get().delivered_at, null);
});

test('message, due and external alerts share ordered pagination, exact reads and read-all without a cross-database transaction', async t => {
  const f = await fixture(t); f.create('requester', 'worker', { dueDate: '2026-10-08' });
  let externalRead = null, externalVisible = true, allCalls = 0;
  f.service.setExternalNotifications({
    list(userId) { return userId === 'worker' && externalVisible ? [{ id: 'client:durable-1', kind: 'client_request', message: null, createdAt: '2026-10-08T01:00:00Z', readAt: externalRead, title: '고객 요청' }] : []; },
    read(userId, id) { assert.equal(f.inTransaction, false); assert.equal(userId, 'worker'); assert.equal(id, 'client:durable-1'); externalRead = '2026-10-08T02:00:00Z'; },
    readAll(userId) { assert.equal(f.inTransaction, false); allCalls++; if (userId === 'worker' && externalVisible) externalRead = '2026-10-08T02:00:00Z'; },
  });
  await assert.rejects(f.api('worker', '/api/notifications/%E0%A4%A/read', 'POST'), status(400));
  const page = await f.api('worker', '/api/notifications?limit=1');
  assert.equal(page.items[0].id, 'client:durable-1'); assert.equal(page.hasMore, true); assert.equal(page.unreadCount, 3);
  assert.equal(Object.hasOwn(page.items[0], '_source'), false);
  await f.api('worker', '/api/notifications/client%3Adurable-1/read', 'POST');
  assert.equal(f.service.unreadCount('worker'), 2);
  await assert.rejects(f.api('requester', '/api/notifications/client%3Adurable-1/read', 'POST'), status(404));
  await f.api('worker', '/api/notifications/read-all', 'POST');
  assert.equal(allCalls, 1); assert.equal(f.service.unreadCount('worker'), 0);
  externalVisible = false; await assert.rejects(f.api('worker', '/api/notifications/client%3Adurable-1/read', 'POST'), status(404));
});
