import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createCollaborationService } from '../collaboration-service.mjs';

function fixture(t) {
  const db = new DatabaseSync(':memory:'), stamp = '2026-10-09T00:00:00.000Z';
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,role TEXT,company_role TEXT,active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE channels(id TEXT PRIMARY KEY,system_key TEXT,deleted_at TEXT);
    CREATE TABLE memberships(channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(channel_id,user_id));
    CREATE TABLE messages(id INTEGER PRIMARY KEY AUTOINCREMENT,channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),body TEXT,created_at TEXT,edited_at TEXT,reply_to_id INTEGER);`);
  const check = (value, status, message) => { if (!value) throw Object.assign(new Error(message), { status }); };
  const members = () => db.prepare('SELECT * FROM users WHERE active=1').all().map(row => ({ id: row.id, name: row.name, role: row.role, companyRole: row.company_role }));
  const requireChannel = (userId, room) => { const row = db.prepare('SELECT c.* FROM channels c JOIN memberships m ON m.channel_id=c.id WHERE c.id=? AND m.user_id=? AND c.deleted_at IS NULL').get(room, userId); check(row && members().some(user => user.id === userId), 404, '대화방 확인'); return row; };
  const requirePosting = (userId, room) => { const row = requireChannel(userId, room); check(members().find(user => user.id === userId)?.role !== 'viewer', 403, '작성 권한 확인'); return row; };
  const requireMessage = (id, userId) => { const row = db.prepare('SELECT * FROM messages WHERE id=?').get(id); check(row, 404, '메시지 확인'); requireChannel(userId, row.channel_id); return row; };
  const service = createCollaborationService({ db, assert: check, textField: (value, label, max, min = 0) => { check(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max, 400, label); return value.trim(); }, now: () => stamp,
    transaction: fn => { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } },
    members, requireChannel, requirePosting, requireMessage, messageShape: row => ({ id: String(row.id), channelId: row.channel_id, body: row.body }), publish() {}, origin: () => 'http://fixture.test', resolveLink: value => value.workspaceLink, backgroundJobsEnabled: false });
  for (const [id, role, companyRole] of [['admin', 'owner', null], ['companyadmin', 'member', 'admin'], ['manager', 'member', 'manager'], ['requester', 'member', null], ['worker', 'member', null], ['reviewer', 'member', null], ['replacement', 'member', null], ['outsider', 'member', null]]) db.prepare('INSERT INTO users(id,name,role,company_role) VALUES(?,?,?,?)').run(id, id, role, companyRole);
  db.prepare('INSERT INTO channels(id) VALUES(?)').run('room');
  for (const person of members()) db.prepare('INSERT INTO memberships VALUES(?,?)').run('room', person.id);
  t.after(() => db.close());
  const f = {
    db, productivity: service.productivity,
    send(userId, body = '제출한 결과물') { return String(db.prepare('INSERT INTO messages(channel_id,user_id,body,created_at) VALUES(?,?,?,?)').run('room', userId, body, stamp).lastInsertRowid); },
    patch(task, userId, body) { return f.productivity.upsertTask({ messageId: task.messageId, userId, body: { revision: task.revision, ...body } }).task; },
    task(stage, creator = 'requester') {
      const messageId = f.send(creator, '보존할 요청 원문');
      let task = f.productivity.upsertTask({ messageId, userId: creator, method: 'POST', body: { title: '보존할 업무 제목', assigneeId: 'worker', reviewerId: 'reviewer', dueDate: '2026-10-10' } }).task;
      if (stage === 'requested') return task;
      task = f.patch(task, 'worker', { stage: 'accepted' }); if (stage === 'accepted') return task;
      task = f.patch(task, 'worker', { stage: 'doing', resultMessageId: f.send('worker') }); if (stage === 'doing') return task;
      task = f.patch(task, 'worker', { stage: 'review' }); if (stage === 'review') return task;
      return f.patch(task, 'reviewer', { stage });
    },
    makeUnavailable(userId, reason) {
      if (reason === 'departed') db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run('room', userId);
      else if (reason === 'viewer') db.prepare('UPDATE users SET role=? WHERE id=?').run('viewer', userId);
      else db.prepare('UPDATE users SET active=0 WHERE id=?').run(userId);
    },
  };
  return f;
}
const status = expected => error => error.status === expected;
const row = (f, task) => f.db.prepare('SELECT * FROM message_tasks WHERE id=?').get(task.id);
const preserved = value => { const { reviewer_id, revision, updated_at, ...rest } = value; return rest; };

for (const stage of ['requested', 'accepted', 'doing', 'changes', 'review']) {
  for (const reason of ['departed', 'viewer', 'disabled']) {
    test(`${stage}: ${reason} reviewer blocks impossible transitions and requester can preserve the task while replacing them`, t => {
      const f = fixture(t), task = f.task(stage), before = row(f, task);
      assert.equal(task.reviewerUnavailable, false); assert.equal(task.canReassignReviewer, false);
      f.makeUnavailable('reviewer', reason);
      const worker = f.productivity.getTask(task.messageId, 'worker'), requester = f.productivity.getTask(task.messageId, 'requester');
      assert.equal(worker.reviewerUnavailable, true); assert.equal(worker.canReassignReviewer, false); assert.deepEqual(worker.allowedStages, []);
      assert.equal(requester.canReassignReviewer, true); assert.equal(requester.reviewer?.name ?? null, reason === 'disabled' ? null : 'reviewer');
      assert.deepEqual(f.productivity.workday('requester').today.groups.recovery.map(item => item.id), [task.id]);
      assert.equal(f.productivity.workday('requester').remaining.counts.waiting, 0);
      assert.throws(() => f.patch(task, 'worker', { stage: stage === 'requested' ? 'accepted' : stage === 'accepted' ? 'doing' : stage === 'review' ? 'done' : 'review' }), status(400));
      assert.throws(() => f.patch(task, 'worker', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
      const next = f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement' });
      assert.deepEqual(preserved(row(f, next)), preserved(before)); assert.equal(next.revision, task.revision + 1); assert.equal(next.reviewerId, 'replacement');
      assert.equal(next.reviewerUnavailable, false); assert.equal(next.canReassignReviewer, false);
      const event = f.productivity.catchUp('requester').events.at(-1); assert.equal(event.kind, 'task_reviewer_reassigned'); assert.deepEqual(event.changes, { from: 'reviewer', to: 'replacement', reason: 'reviewer_unavailable' });
    });
  }
}

test('reviewer preflight preserves authority, optimistic revision and all metadata boundaries', t => {
  const f = fixture(t), task = f.task('doing'), before = row(f, task); f.makeUnavailable('reviewer', 'departed');
  for (const userId of ['admin', 'companyadmin', 'requester']) assert.equal(f.productivity.getTask(task.messageId, userId).canReassignReviewer, true);
  for (const userId of ['worker', 'outsider', 'manager']) { assert.equal(f.productivity.getTask(task.messageId, userId).canReassignReviewer, false); assert.throws(() => f.patch(task, userId, { reassignReviewer: true, reviewerId: 'replacement' }), status(403)); }
  assert.throws(() => f.patch(task, 'admin', { reassignReviewer: true, reviewerId: 'worker' }), status(400));
  assert.throws(() => f.patch(task, 'admin', { reassignReviewer: true, reviewerId: null }), status(400));
  for (const body of [{ stage: 'accepted' }, { title: '변경된 제목' }, { assigneeId: 'outsider' }, { dueDate: '2026-10-11' }, { resultMessageId: null }]) assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement', ...body }), status(409));
  assert.deepEqual(row(f, task), before);
  const next = f.patch(task, 'companyadmin', { reassignReviewer: true, reviewerId: 'replacement' });
  assert.equal(next.stage, 'doing'); assert.equal(next.resultMessageId, task.resultMessageId);
  assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement' }), status(409));
  assert.throws(() => f.patch(next, 'worker', { stage: 'done' }), status(403));
});

for (const [person, reason, expected] of [['requester', 'viewer', 403], ['requester', 'disabled', 404], ['admin', 'departed', 404], ['replacement', 'viewer', 400], ['replacement', 'disabled', 400], ['replacement', 'departed', 400]]) {
  test(`preflight replacement requires current posting rights for ${person} after ${reason}`, t => {
    const f = fixture(t), task = f.task('accepted'); f.makeUnavailable('reviewer', 'disabled'); f.makeUnavailable(person, reason);
    const actor = person === 'replacement' ? 'requester' : person;
    assert.throws(() => f.patch(task, actor, { reassignReviewer: true, reviewerId: 'replacement' }), status(expected));
  });
}

test('an assignee who is also requester or administrator cannot replace a reviewer to self-approve', t => {
  const f = fixture(t), task = f.task('doing', 'worker'); f.makeUnavailable('reviewer', 'disabled');
  f.db.prepare('UPDATE users SET company_role=? WHERE id=?').run('admin', 'worker');
  assert.equal(f.productivity.getTask(task.messageId, 'worker').canReassignReviewer, false);
  assert.throws(() => f.patch(task, 'worker', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
  assert.throws(() => f.patch(task, 'worker', { reviewerId: null, stage: 'done' }), status(403));
});

for (const reason of ['departed', 'viewer', 'disabled']) {
  test(`an unavailable assignee (${reason}) is explicit and cannot advertise reviewer replacement that the unchanged-assignee patch rejects`, t => {
    const f = fixture(t), task = f.task('accepted'); f.makeUnavailable('reviewer', 'disabled'); f.makeUnavailable('worker', reason);
    const requester = f.productivity.getTask(task.messageId, 'requester');
    assert.equal(requester.assigneeUnavailable, true); assert.equal(requester.assignee?.name ?? null, reason === 'disabled' ? null : 'worker');
    assert.equal(requester.canReassignReviewer, false); assert.deepEqual(requester.allowedStages, []);
    assert.equal(f.productivity.workday('requester').today.counts.recovery, 0);
    assert.throws(() => f.patch(task, 'requester', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
  });
}

test('completed task history never becomes reviewer recovery and review cannot change its assignee', t => {
  const f = fixture(t), review = f.task('review');
  assert.throws(() => f.patch(review, 'requester', { assigneeId: 'outsider' }), status(409));
  const done = f.patch(review, 'reviewer', { stage: 'done' }); f.makeUnavailable('reviewer', 'disabled');
  assert.equal(f.productivity.getTask(done.messageId, 'requester').canReassignReviewer, false);
  assert.deepEqual(f.productivity.getTask(done.messageId, 'requester').allowedStages, []);
  assert.equal(f.productivity.workday('requester').today.total, 0);
  assert.throws(() => f.patch(done, 'requester', { reassignReviewer: true, reviewerId: 'replacement' }), status(403));
});

for (const [person, reason] of [['reviewer', 'departed'], ['worker', 'viewer']]) {
  test(`completed task does not offer reopening when ${person} is ${reason}`, t => {
    const f = fixture(t), done = f.task('done'), before = row(f, done); f.makeUnavailable(person, reason);
    for (const actor of ['requester', 'admin', 'companyadmin']) {
      const view = f.productivity.getTask(done.messageId, actor);
      assert.deepEqual(view.allowedStages, []); assert.equal(view.canReassignReviewer, false);
      assert.throws(() => f.patch(done, actor, { stage: 'doing' }), status(400));
    }
    assert.deepEqual(row(f, done), before); assert.equal(f.productivity.workday('requester').today.total, 0);
  });
}
