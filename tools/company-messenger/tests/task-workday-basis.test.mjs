import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createCollaborationService } from '../collaboration-service.mjs';

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  let stamp = '2026-10-10T00:00:00.000Z', clockReads = 0, clockSequence = [];
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
  let service;
  const messageShape = (row, userId) => ({ id: String(row.id), channelId: row.channel_id, body: row.body, ...service.messageExtras(row, userId) });
  service = createCollaborationService({
    db, assert: check,
    textField: (value, label, max, min = 0) => {
      check(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max, 400, label);
      return value.trim();
    },
    now: () => { clockReads++; if (clockSequence.length) stamp = clockSequence.shift(); return stamp; },
    transaction: fn => {
      db.exec('BEGIN');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    members, requireChannel, requirePosting, requireMessage, messageShape,
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
    setTime(value) { stamp = value; clockSequence = []; clockReads = 0; },
    setClockSequence(values) { clockSequence = [...values]; clockReads = 0; },
    send(userId, body = '구체적인 요청과 완료 기준', room = 'room') {
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
    detail(task, userId = 'worker') { return messageShape(requireMessage(task.messageId, userId), userId).task; },
    workday(userId = 'worker') { return f.productivity.workday(userId); },
  };
  return f;
}

function basis(task, todayReasons = [], remainingReasons = [], date = '2026-10-10') {
  assert.deepEqual(task.workday, { date, todayReasons, remainingReasons });
}

function assertListMatchesDetails(f, userId = 'worker') {
  const work = f.workday(userId);
  for (const bundle of [work, work.today, work.remaining]) {
    for (const [reason, tasks] of Object.entries(bundle.groups)) {
      for (const task of tasks) {
        assert.deepEqual(task.workday, f.detail(task, userId).workday);
        assert.deepEqual(task.message.task.workday, task.workday, 'nested source task must use the same server date and user');
        if (bundle === work.today) assert.ok(task.workday.todayReasons.includes(reason));
        if (bundle === work.remaining) assert.ok(task.workday.remainingReasons.includes(reason));
      }
    }
  }
  return work;
}

test('future deadlines do not hide the response reason for new requests or requested changes', t => {
  const f = fixture(t), requested = f.create('requester', 'worker', { dueDate: '2026-10-13' });
  const reviewing = f.review('requester', 'worker', 'reviewer', { dueDate: '2026-10-13' });
  const changed = f.patch(reviewing, 'reviewer', { stage: 'changes' });
  basis(f.detail(requested), ['reply']);
  basis(f.detail(changed), ['reply']);
  const work = assertListMatchesDetails(f);
  assert.equal(work.today.counts.reply, 2);
  assert.equal(work.today.counts.due, 0);
  assert.equal(work.remaining.total, 0);
});

test('accepted future work and undated work preserve distinct remaining reasons', t => {
  const f = fixture(t), future = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-13' })), undated = f.doing(f.create());
  basis(f.detail(future), [], ['upcoming']);
  basis(f.detail(undated), [], ['undated']);
  const work = assertListMatchesDetails(f);
  assert.equal(work.today.total, 0);
  assert.deepEqual(work.remaining.counts, { upcoming: 1, undated: 1, waiting: 0 });
});

test('today and overdue accepted production both carry due while preserving their recorded dates', t => {
  const f = fixture(t), today = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-10' })), overdue = f.doing(f.create('requester', 'worker', { dueDate: '2026-10-09' }));
  basis(f.detail(today), ['due']);
  basis(f.detail(overdue), ['due']);
  assert.equal(f.detail(overdue).dueDate, '2026-10-09');
  const work = assertListMatchesDetails(f);
  assert.equal(work.today.total, 2);
  assert.deepEqual(work.today.groups.due.map(task => task.id), [overdue.id, today.id]);
});

test('one review record gives the reviewer an action and its assignee and requester a waiting reason', t => {
  const f = fixture(t), task = f.review();
  basis(f.detail(task, 'reviewer'), ['review']);
  basis(f.detail(task, 'worker'), [], ['waiting']);
  basis(f.detail(task, 'requester'), [], ['waiting']);
  basis(f.detail(task, 'other'));
  assert.equal(assertListMatchesDetails(f, 'reviewer').today.total, 1);
  assert.equal(assertListMatchesDetails(f, 'worker').today.total, 0);
  assert.equal(assertListMatchesDetails(f, 'requester').remaining.counts.waiting, 1);
  assert.equal(assertListMatchesDetails(f, 'other').remaining.total, 0);
});

test('a requester who also reviews receives review without an erroneous waiting reason', t => {
  const f = fixture(t), task = f.review('reviewer', 'worker', 'reviewer');
  basis(f.detail(task, 'reviewer'), ['review']);
  const work = assertListMatchesDetails(f, 'reviewer');
  assert.equal(work.groups.waiting.length, 1, 'legacy waiting contract remains unchanged');
  assert.equal(work.remaining.counts.waiting, 0);
});

test('completed records have no today or remaining reason for every role even after a reviewer departs', t => {
  const f = fixture(t), task = f.patch(f.review(), 'reviewer', { stage: 'done' });
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run('reviewer');
  for (const userId of ['worker', 'requester', 'admin', 'other']) {
    const detail = f.detail(task, userId);
    basis(detail);
    assert.equal(detail.stage, 'done');
    assert.ok(detail.resultMessageId);
    assert.equal(f.workday(userId).today.total, 0);
    assert.equal(f.workday(userId).remaining.total, 0);
  }
});

test('reviewer recovery is explained only to authorized requesters and admins, leaving assignee waiting intact', t => {
  const f = fixture(t), task = f.review('requester', 'worker', 'departed');
  f.db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run('room', 'departed');
  basis(f.detail(task, 'requester'), ['recovery']);
  basis(f.detail(task, 'admin'), ['recovery']);
  basis(f.detail(task, 'worker'), [], ['waiting']);
  basis(f.detail(task, 'other'));
  for (const userId of ['requester', 'admin', 'worker', 'other']) assertListMatchesDetails(f, userId);
});

test('reviewer recovery before submission does not claim that an assignee already submitted results', t => {
  const f = fixture(t), task = f.accepted(f.create('requester', 'worker', { reviewerId: 'departed', dueDate: '2026-10-13' }));
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run('departed');
  basis(f.detail(task, 'requester'), ['recovery']);
  basis(f.detail(task, 'worker'), [], ['upcoming']);
  assert.equal(f.detail(task, 'requester').resultMessageId, null);
  assert.equal(f.detail(task, 'worker').allowedStages.length, 0);
  assertListMatchesDetails(f, 'requester');
  assertListMatchesDetails(f, 'worker');
});

test('losing posting permission does not silently change the pre-existing day classification', t => {
  const f = fixture(t), task = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-10' }));
  f.db.prepare('UPDATE users SET role=? WHERE id=?').run('viewer', 'worker');
  const detail = f.detail(task);
  basis(detail, ['due']);
  assert.equal(detail.canManage, false);
  assert.equal(detail.assigneeUnavailable, true);
  assert.deepEqual(detail.allowedStages, []);
  assert.equal(assertListMatchesDetails(f).today.total, 1);
});

test('an inaccessible task does not leak its reason or appear in a workday', t => {
  const f = fixture(t), task = f.create('requester', 'worker', { dueDate: '2026-10-10' }, 'private');
  f.db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run('private', 'other');
  assert.equal(f.productivity.getTask(task.messageId, 'other'), null);
  assert.throws(() => f.detail(task, 'other'), { status: 404 });
  const work = f.workday('other');
  assert.equal(work.total, 0);
  assert.equal(work.today.total, 0);
  assert.equal(work.remaining.total, 0);
});

test('latest detail switches at server KST midnight without a client clock or persisted mutation', t => {
  const f = fixture(t), task = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-10' }));
  const beforeRow = f.db.prepare('SELECT * FROM message_tasks WHERE id=?').get(task.id);
  const beforeEvents = f.db.prepare('SELECT COUNT(*) AS count FROM productivity_events').get().count;
  f.setTime('2026-10-09T14:59:59.999Z');
  basis(f.detail(task), [], ['upcoming'], '2026-10-09');
  assert.equal(f.clockReads, 1);
  f.setTime('2026-10-09T15:00:00.000Z');
  basis(f.detail(task), ['due']);
  assert.equal(f.clockReads, 1);
  assert.deepEqual(f.db.prepare('SELECT * FROM message_tasks WHERE id=?').get(task.id), beforeRow);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM productivity_events').get().count, beforeEvents);
});

test('workday and nested message tasks use one captured server day even when the next clock read crosses midnight', t => {
  const f = fixture(t);
  f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-10' }));
  f.doing(f.create('requester', 'worker', { dueDate: '2026-10-10' }));
  f.create('requester', 'worker', { dueDate: '2026-10-13' });
  f.setClockSequence(['2026-10-09T14:59:59.999Z', '2026-10-09T15:00:00.000Z']);
  const work = f.workday();
  assert.equal(work.date, '2026-10-09');
  assert.equal(work.nextDayRefreshAfterMs, 1001);
  assert.equal(work.today.counts.reply, 1);
  assert.equal(work.today.counts.due, 0);
  assert.equal(work.remaining.counts.upcoming, 2);
  assert.equal(f.clockReads, 1);
  for (const bundle of [work, work.today, work.remaining]) {
    for (const tasks of Object.values(bundle.groups)) {
      for (const task of tasks) {
        assert.equal(task.workday.date, work.date);
        assert.deepEqual(task.message.task.workday, task.workday);
      }
    }
  }
  const task = work.remaining.groups.upcoming[0];
  basis(f.detail(task), ['due']);
  assert.equal(f.clockReads, 2, 'fresh detail must observe the next server day');
});

test('a failed nested source render restores the captured-date context for the next read', t => {
  const f = fixture(t), task = f.accepted(f.create('requester', 'worker', { dueDate: '2026-10-10' }));
  const row = f.db.prepare('SELECT * FROM message_tasks WHERE id=?').get(task.id);
  f.db.prepare('UPDATE messages SET workspace_link=? WHERE id=?').run('{invalid', task.messageId);
  f.setTime('2026-10-09T14:59:59.999Z');
  assert.throws(() => f.productivity.taskShape(row, 'worker', true), SyntaxError);
  f.db.prepare('UPDATE messages SET workspace_link=NULL WHERE id=?').run(task.messageId);
  f.setTime('2026-10-09T15:00:00.000Z');
  basis(f.detail(task), ['due']);
  assert.equal(f.clockReads, 1);
});
