import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createCollaborationService } from '../collaboration-service.mjs';

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  let stamp = '2026-10-08T00:00:00.000Z', clockReads = 0;
  const check = (condition, status, message) => {
    if (!condition) throw Object.assign(new Error(message), { status });
  };
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,role TEXT,active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE channels(id TEXT PRIMARY KEY,system_key TEXT,deleted_at TEXT);
    CREATE TABLE memberships(channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(channel_id,user_id));
    CREATE TABLE messages(id INTEGER PRIMARY KEY AUTOINCREMENT,channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),body TEXT,created_at TEXT,edited_at TEXT,reply_to_id INTEGER);`);
  const members = () => db.prepare('SELECT * FROM users WHERE active=1').all().map(row => ({ id: row.id, name: row.name, role: row.role, companyRole: row.role }));
  const requireChannel = (userId, channelId) => {
    const channel = db.prepare('SELECT c.* FROM channels c JOIN memberships m ON m.channel_id=c.id WHERE m.user_id=? AND c.id=? AND c.deleted_at IS NULL').get(userId, channelId);
    check(channel && members().some(user => user.id === userId), 404, '대화방을 찾을 수 없습니다.');
    return channel;
  };
  const requirePosting = (userId, channelId) => {
    const channel = requireChannel(userId, channelId);
    check(members().find(user => user.id === userId)?.role !== 'viewer', 403, '작성 권한이 없습니다.');
    return channel;
  };
  const requireMessage = (id, userId) => {
    const message = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
    check(message, 404, '메시지를 찾을 수 없습니다.');
    requireChannel(userId, message.channel_id);
    return message;
  };
  const service = createCollaborationService({
    db, assert: check,
    textField: (value, label, max, min = 0) => {
      check(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max, 400, label);
      return value.trim();
    },
    now: () => { clockReads++; return stamp; },
    transaction: fn => {
      db.exec('BEGIN');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    members, requireChannel, requirePosting, requireMessage,
    messageShape: row => ({ id: String(row.id), channelId: row.channel_id, body: row.body }),
    publish() {}, origin: () => 'http://fixture.test', resolveLink: value => value.workspaceLink,
    backgroundJobsEnabled: false,
  });
  for (const [id, role] of [['admin', 'owner'], ['requester', 'member'], ['worker', 'member'], ['reviewer', 'member'], ['departed', 'member'], ['other', 'member']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
  }
  for (const room of ['room', 'private']) {
    db.prepare('INSERT INTO channels(id) VALUES(?)').run(room);
    for (const person of members()) db.prepare('INSERT INTO memberships VALUES(?,?)').run(room, person.id);
  }
  t.after(() => db.close());
  const f = {
    db, productivity: service.productivity,
    get clockReads() { return clockReads; },
    resetClockReads() { clockReads = 0; },
    setTime(value) { stamp = value; },
    send(userId, body = '작업 요청의 실제 원문', room = 'room') {
      return String(db.prepare('INSERT INTO messages(channel_id,user_id,body,created_at) VALUES(?,?,?,?)').run(room, userId, body, stamp).lastInsertRowid);
    },
    create(creator = 'requester', assignee = 'worker', body = {}, room = 'room') {
      const messageId = f.send(creator, body.title, room);
      return f.productivity.upsertTask({ messageId, userId: creator, method: 'POST', body: { assigneeId: assignee, ...body } }).task;
    },
    patch(task, userId, body) {
      return f.productivity.upsertTask({ messageId: task.messageId, userId, body: { revision: task.revision, ...body } }).task;
    },
    accepted(task) { return f.patch(task, task.assignee.id, { stage: 'accepted' }); },
    doing(task) { return f.patch(f.accepted(task), task.assignee.id, { stage: 'doing' }); },
    review(creator = 'requester', assignee = 'worker', reviewer = 'reviewer', body = {}) {
      const task = f.doing(f.create(creator, assignee, { reviewerId: reviewer, ...body }));
      return f.patch(task, assignee, { stage: 'review', resultMessageId: f.send(assignee, '제출한 결과물') });
    },
    workday(userId = 'worker') { return f.productivity.workday(userId); },
  };
  return f;
}

const ids = tasks => tasks.map(task => task.id);
const allIds = bundle => Object.values(bundle.groups).flat().map(task => task.id);

test('a completely empty workday is distinguishable from unfinished work without an action today', t => {
  const f = fixture(t), work = f.workday();
  assert.equal(work.date, '2026-10-08');
  assert.deepEqual(work.counts, { reply: 0, due: 0, review: 0, waiting: 0 });
  assert.equal(work.total, 0);
  assert.deepEqual(work.today.counts, { reply: 0, due: 0, review: 0, recovery: 0 });
  assert.deepEqual(work.remaining.counts, { upcoming: 0, undated: 0, waiting: 0 });
  assert.equal(work.today.total, 0);
  assert.equal(work.remaining.total, 0);
  assert.equal(work.openTotal, 0);
});

for (const [label, arrange, group, openTotal] of [
  ['future dated only', f => f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-09' })), 'upcoming', 1],
  ['undated only', f => f.doing(f.create()), 'undated', 1],
  ['requested from another crew only', f => f.create('worker', 'other'), 'waiting', 0],
  ['my delivery awaiting review only', f => f.review(), 'waiting', 1],
]) {
  test(`${label} reports no action today while preserving the remaining task`, t => {
    const f = fixture(t), task = arrange(f), work = f.workday();
    assert.equal(work.today.total, 0);
    assert.equal(work.remaining.total, 1);
    assert.deepEqual(ids(work.remaining.groups[group]), [task.id]);
    assert.equal(work.openTotal, openTotal);
    assert.equal(work.remaining.groups[group][0].message.body, '작업 요청의 실제 원문');
  });
}

test('new requests and requested changes require a response today even when their work deadline is in the future', t => {
  const f = fixture(t);
  const request = f.create('requester', 'worker', { dueDate: '2026-10-12' });
  const submitted = f.review('requester', 'worker', 'reviewer', { dueDate: '2026-10-13' });
  const changes = f.patch(submitted, 'reviewer', { stage: 'changes' });
  const work = f.workday();
  assert.deepEqual(new Set(ids(work.today.groups.reply)), new Set([request.id, changes.id]));
  assert.equal(work.today.total, 2);
  assert.equal(work.today.counts.due, 0);
  assert.equal(work.remaining.total, 0);
  assert.equal(work.openTotal, 2);
});

test('today counts separate responses from due production and do not count the same task twice', t => {
  const f = fixture(t);
  const request = f.create('requester', 'worker', { dueDate: '2026-10-07' });
  const submitted = f.review('requester', 'worker', 'reviewer', { dueDate: '2026-10-07' });
  const changes = f.patch(submitted, 'reviewer', { stage: 'changes' });
  const accepted = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-08' }));
  const reviewing = f.review('requester', 'worker', 'reviewer', { dueDate: '2026-10-06' });
  const work = f.workday();
  assert.deepEqual(new Set(ids(work.today.groups.reply)), new Set([request.id, changes.id]));
  assert.deepEqual(ids(work.today.groups.due), [accepted.id]);
  assert.equal(work.today.total, 3);
  assert.equal(new Set(allIds(work.today)).size, work.today.total);
  assert.deepEqual(ids(work.remaining.groups.waiting), [reviewing.id]);
  assert.equal(work.openTotal, 4);
  assert.equal(work.counts.reply, 2);
  assert.equal(work.counts.due, 4, 'legacy due group still includes due requested, changes and review tasks');
  assert.equal(work.counts.waiting, 1);
  assert.equal(work.total, 4, 'legacy totals still deduplicate overlapping groups');
});

test('a requester who must review their own request sees an action today instead of a waiting item', t => {
  const f = fixture(t), task = f.review('worker', 'other', 'worker'), work = f.workday();
  assert.deepEqual(ids(work.groups.waiting), [task.id], 'legacy waiting contract remains intact');
  assert.deepEqual(ids(work.today.groups.review), [task.id]);
  assert.equal(work.today.total, 1);
  assert.equal(work.remaining.counts.waiting, 0);
  assert.equal(work.openTotal, 0);
});

test('reviewer recovery is an action only for currently authorized requesters and administrators', t => {
  const f = fixture(t), task = f.review('requester', 'worker', 'departed');
  f.db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run('room', 'departed');
  for (const userId of ['requester', 'admin']) {
    const work = f.workday(userId);
    assert.deepEqual(ids(work.today.groups.recovery), [task.id]);
    assert.equal(work.today.groups.recovery[0].canReassignReviewer, true);
    assert.equal(work.today.total, 1);
    assert.equal(work.remaining.counts.waiting, 0);
  }
  const assignee = f.workday();
  assert.equal(assignee.today.counts.recovery, 0);
  assert.deepEqual(ids(assignee.remaining.groups.waiting), [task.id]);
  assert.equal(assignee.openTotal, 1);
  f.db.prepare('UPDATE users SET role=? WHERE id=?').run('viewer', 'requester');
  const viewer = f.workday('requester');
  assert.equal(viewer.today.counts.recovery, 0);
  assert.deepEqual(ids(viewer.remaining.groups.waiting), [task.id]);
});

test('finished tasks and inaccessible rooms are excluded from all new groups and totals', t => {
  const f = fixture(t);
  const visible = f.doing(f.create('requester', 'worker', { dueDate: '2026-10-08' }));
  const finished = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-08' }));
  f.patch(finished, 'worker', { stage: 'done' });
  const inaccessible = f.doing(f.create('requester', 'worker', { dueDate: '2026-10-08' }, 'private'));
  f.db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run('private', 'worker');
  const work = f.workday();
  assert.deepEqual(ids(work.today.groups.due), [visible.id]);
  assert.equal(work.today.total, 1);
  assert.equal(work.openTotal, 1);
  assert.equal(work.remaining.total, 0);
  assert.ok(!allIds(work.today).includes(finished.id));
  assert.ok(!allIds(work.today).includes(inaccessible.id));
  assert.equal(work.today.groups.due[0].canManage, true);
  assert.equal(work.today.groups.due[0].message.channelId, 'room');
});

test('assigned legacy tasks stay visible after the assignee becomes a viewer', t => {
  const f = fixture(t), task = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-08' }));
  f.db.prepare('UPDATE users SET role=? WHERE id=?').run('viewer', 'worker');
  const work = f.workday();
  assert.deepEqual(ids(work.today.groups.due), [task.id]);
  assert.equal(work.today.groups.due[0].canManage, false);
  assert.deepEqual(work.today.groups.due[0].allowedStages, []);
  assert.equal(work.openTotal, 1);
});

test('workday gives a server-relative midnight delay from one clock observation', t => {
  const f = fixture(t);
  for (const [stamp, date, delay] of [
    ['2026-10-08T14:59:59.000Z', '2026-10-08', 2000],
    ['2026-10-08T14:59:59.999Z', '2026-10-08', 1001],
    ['2026-10-08T15:00:00.000Z', '2026-10-09', 86401000],
    ['2026-10-08T20:00:00.000Z', '2026-10-09', 68401000],
  ]) {
    f.setTime(stamp); f.resetClockReads();
    const work = f.workday();
    assert.equal(work.serverNow, stamp); assert.equal(work.date, date);
    assert.equal(work.nextDayRefreshAfterMs, delay); assert.equal(f.clockReads, 1);
    assert.equal(new Date(Date.parse(stamp) + delay - 1000).toISOString().slice(11), '15:00:00.000Z');
    assert.ok(Number.isInteger(delay) && delay > 1000 && delay <= 86401000);
  }
});

test('today switches at midnight in Korea instead of midnight in UTC', t => {
  const f = fixture(t), task = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-09' }));
  f.setTime('2026-10-08T14:59:59.999Z');
  const before = f.workday();
  assert.equal(before.date, '2026-10-08');
  assert.equal(before.serverNow, '2026-10-08T14:59:59.999Z');
  assert.equal(before.nextDayRefreshAfterMs, 1001);
  assert.equal(before.today.total, 0);
  assert.deepEqual(ids(before.remaining.groups.upcoming), [task.id]);
  f.setTime('2026-10-08T15:00:00.000Z');
  const after = f.workday();
  assert.equal(after.date, '2026-10-09');
  assert.equal(after.serverNow, '2026-10-08T15:00:00.000Z');
  assert.equal(after.nextDayRefreshAfterMs, 86401000);
  assert.deepEqual(ids(after.today.groups.due), [task.id]);
  assert.equal(after.today.total, 1);
  assert.equal(after.remaining.counts.upcoming, 0);
});
