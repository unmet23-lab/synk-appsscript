import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createMessenger } from '../server.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-productivity-'));
  let app, url;
  async function start() { app = createMessenger({ dataDir: dir, port: 0, backgroundJobsEnabled: false, driveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } }); url = (await app.listen()).url; }
  await start();
  function client() {
    let cookie = '';
    return { async request(path, method = 'GET', body, status = 200) {
      const response = await fetch(url + path, { method, headers: { Cookie: cookie, ...(method === 'GET' ? {} : { Origin: url }), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const next = response.headers.getSetCookie().find(row => row.startsWith('synk_messenger_session=')); if (next) cookie = next.split(';')[0];
      const value = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(value)}`); return value;
    } };
  }
  const owner = client(), boot = await owner.request('/api/setup', 'POST', { workspaceName: '워크플로 시험', name: '관리자', username: 'owner', password: 'long-fixture-password' }, 201);
  owner.user = boot.user;
  async function member(name) { const invite = await owner.request('/api/invites', 'POST', {}, 201), person = client(); person.user = (await person.request('/api/join', 'POST', { name, username: name, password: 'long-fixture-password', code: invite.code }, 201)).user; return person; }
  const assignee = await member('assignee'), reviewer = await member('reviewer'), stranger = await member('stranger');
  const room = boot.channels.find(channel => channel.systemKey === 'social').id;
  t.after(async () => { await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-productivity-')); await rm(dir, { recursive: true, force: true }); });
  return { owner, assignee, reviewer, stranger, room, get db() { return app.db; },
    send: async (person, body, channel = room) => (await person.request(`/api/channels/${channel}/messages`, 'POST', { body }, 201)).message,
    restart: async () => { await app.close(); await start(); } };
}
const taskPath = message => `/api/messages/${message.id}/task`;

test('explicit request, acceptance, delivery, revision and reviewer approval drive personal workday without reads completing work', async t => {
  const f = await fixture(t), source = await f.send(f.owner, '영상 수정 요청');
  let task = (await f.owner.request(taskPath(source), 'POST', { assigneeId: f.assignee.user.id, reviewerId: f.reviewer.user.id, dueDate: '2020-01-01' }, 201)).task;
  assert.equal(task.stage, 'requested'); assert.equal(task.revision, 1);
  assert.equal((await f.assignee.request('/api/workday')).groups.reply[0].id, task.id);
  assert.equal((await f.owner.request('/api/workday')).groups.waiting[0].id, task.id);
  await f.assignee.request(`/api/channels/${f.room}/read`, 'POST', { messageId: source.id });
  assert.equal((await f.assignee.request('/api/workday')).groups.reply[0].stage, 'requested');
  await f.stranger.request(taskPath(source), 'PATCH', { stage: 'accepted', revision: task.revision }, 403);
  await f.owner.request(taskPath(source), 'PATCH', { stage: 'accepted', revision: task.revision }, 403);
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'accepted', revision: task.revision })).task;
  assert.equal((await f.assignee.request('/api/workday')).groups.reply.length, 0);
  assert.equal((await f.assignee.request('/api/workday')).groups.due.length, 1);
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'doing', revision: task.revision })).task;
  await f.assignee.request(taskPath(source), 'PATCH', { stage: 'review', revision: task.revision }, 400);
  const result = await f.send(f.assignee, '수정본 V1 / 영상 링크');
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'review', resultMessageId: result.id, revision: task.revision })).task;
  assert.equal(task.resultMessage.body, result.body);
  assert.equal((await f.reviewer.request('/api/workday')).groups.review[0].id, task.id);
  assert.equal((await f.assignee.request('/api/workday')).groups.waiting[0].id, task.id);
  await f.assignee.request(taskPath(source), 'PATCH', { stage: 'done', revision: task.revision }, 403);
  await f.owner.request(taskPath(source), 'PATCH', { stage: 'done', revision: task.revision }, 403);
  await f.assignee.request(taskPath(source), 'PATCH', { status: 'done', revision: task.revision }, 403);
  task = (await f.reviewer.request(taskPath(source), 'PATCH', { stage: 'changes', revision: task.revision })).task;
  const revised = await f.send(f.assignee, '수정본 V2');
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'review', resultMessageId: revised.id, revision: task.revision })).task;
  task = (await f.reviewer.request(taskPath(source), 'PATCH', { stage: 'done', revision: task.revision })).task;
  assert.equal(task.status, 'done'); assert.equal(task.resultMessageId, revised.id);
  const unreviewed = await f.send(f.assignee, '승인받지 않은 V3');
  await f.assignee.request(taskPath(source), 'PATCH', { resultMessageId: unreviewed.id, revision: task.revision }, 409);
  await f.assignee.request(`/api/messages/${revised.id}`, 'PATCH', { body: '승인받지 않은 URL' }, 409);
  await f.assignee.request(`/api/messages/${revised.id}`, 'DELETE', undefined, 409);
  for (const person of [f.owner, f.assignee, f.reviewer]) assert.equal((await person.request('/api/workday')).total, 0);
  await f.restart();
  assert.equal((await f.assignee.request(`/api/messages/${source.id}`)).message.task.stage, 'done');
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'doing', revision: task.revision })).task;
  await f.assignee.request(`/api/messages/${revised.id}`, 'PATCH', { body: '재개 뒤 수정' });
  assert.equal((await f.reviewer.request(`/api/messages/${source.id}`)).message.task.stage, 'doing');
});

test('concurrent changes reject stale revisions, duplicate no-op patches do not create events, and legacy tasks remain usable', async t => {
  const f = await fixture(t), source = await f.send(f.owner, '기한 경쟁');
  let task = (await f.owner.request(taskPath(source), 'POST', { assigneeId: f.assignee.user.id }, 201)).task;
  const outcomes = await Promise.allSettled([
    f.owner.request(taskPath(source), 'PATCH', { dueDate: '2026-10-10', revision: task.revision }),
    f.assignee.request(taskPath(source), 'PATCH', { stage: 'accepted', revision: task.revision }),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(outcomes.find(result => result.status === 'rejected').reason.message, /409/);
  task = (await f.owner.request(`/api/messages/${source.id}`)).message.task;
  const before = (await f.owner.request('/api/catch-up')).events.length;
  await f.owner.request(taskPath(source), 'PATCH', { title: task.title, revision: task.revision });
  assert.equal((await f.owner.request('/api/catch-up')).events.length, before);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM message_tasks WHERE message_id=?').get(source.id).n, 1);
  task = (await f.assignee.request(taskPath(source), 'PATCH', { status: 'done' })).task;
  assert.equal(task.stage, 'done');
  // Migrate a pre-workflow database rather than silently turning completed work into new requests.
  f.db.exec('ALTER TABLE message_tasks DROP COLUMN stage');
  await f.restart();
  assert.equal((await f.owner.request(`/api/messages/${source.id}`)).message.task.stage, 'done');
});

test('review result links require the same room and missing results cannot be approved', async t => {
  const f = await fixture(t), source = await f.send(f.owner, '검토할 작업');
  let task = (await f.owner.request(taskPath(source), 'POST', { assigneeId: f.assignee.user.id, reviewerId: f.reviewer.user.id }, 201)).task;
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'accepted', revision: task.revision })).task;
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'doing', revision: task.revision })).task;
  const dm = (await f.assignee.request('/api/dms', 'POST', { userId: f.owner.user.id }, 201)).channel;
  const secret = await f.send(f.assignee, '외부방 결과물', dm.id);
  await f.assignee.request(taskPath(source), 'PATCH', { stage: 'review', resultMessageId: secret.id, revision: task.revision }, 400);
  await f.assignee.request(taskPath(source), 'PATCH', { reviewerId: null, stage: 'done', revision: task.revision }, 403);
  const result = await f.send(f.assignee, '삭제 예정 결과물');
  await f.reviewer.request(taskPath(source), 'PATCH', { resultMessageId: result.id, revision: task.revision }, 403);
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'review', resultMessageId: result.id, revision: task.revision })).task;
  await f.assignee.request(`/api/messages/${result.id}`, 'PATCH', { body: '검토 중 결과 교체' }, 409);
  await f.assignee.request(`/api/messages/${result.id}`, 'DELETE', undefined, 409);
  // Also reject approval of a restored/externally damaged record with a missing result.
  f.db.prepare('DELETE FROM messages WHERE id=?').run(result.id);
  await f.reviewer.request(taskPath(source), 'PATCH', { stage: 'done', revision: task.revision }, 400);
  task = (await f.reviewer.request(taskPath(source), 'PATCH', { stage: 'changes', revision: task.revision })).task;
  assert.equal(task.resultMessageId, null);
  const selfSource = await f.send(f.assignee, '내가 요청하고 내가 하는 검토 필수 업무');
  const selfTask = (await f.assignee.request(taskPath(selfSource), 'POST', { assigneeId: f.assignee.user.id, reviewerId: f.reviewer.user.id }, 201)).task;
  await f.assignee.request(taskPath(selfSource), 'PATCH', { reviewerId: null, status: 'done', revision: selfTask.revision }, 403);
  const optional = await f.send(f.assignee, '처음에는 검토자를 정하지 않은 업무');
  let optionalTask = (await f.assignee.request(taskPath(optional), 'POST', { assigneeId: f.assignee.user.id }, 201)).task;
  optionalTask = (await f.assignee.request(taskPath(optional), 'PATCH', { reviewerId: f.reviewer.user.id, revision: optionalTask.revision })).task;
  assert.equal(optionalTask.reviewer.id, f.reviewer.user.id);
  await f.assignee.request(taskPath(optional), 'PATCH', { reviewerId: null, revision: optionalTask.revision }, 403);
});

test('decisions and final versions are explicit, idempotent, replaceable with provenance and cannot revive after successor deletion', async t => {
  const f = await fixture(t), source = await f.send(f.owner, '첫 번째 확정');
  const body = { messageId: source.id, summary: '출시일 10월 20일', effectiveDate: '2026-10-08', requestId: 'decision-first' };
  const first = (await f.owner.request('/api/decisions', 'POST', body, 201)).decision;
  assert.equal((await f.owner.request('/api/decisions', 'POST', body)).decision.id, first.id);
  await f.owner.request('/api/decisions', 'POST', { ...body, summary: '충돌한 내용' }, 409);
  const replacement = await f.send(f.owner, '출시일 변경 확정');
  await f.stranger.request('/api/decisions', 'POST', { messageId: replacement.id, summary: '타인이 대체', effectiveDate: '2026-10-09', replacesId: first.id }, 403);
  const second = (await f.owner.request('/api/decisions', 'POST', { messageId: replacement.id, summary: '출시일 10월 22일', effectiveDate: '2026-10-09', replacesId: first.id }, 201)).decision;
  const history = (await f.owner.request('/api/decisions?current=0')).decisions;
  assert.equal(history.find(row => row.id === first.id).replacedById, second.id);
  assert.equal((await f.owner.request(`/api/decisions/${first.id}`)).decision.isCurrent, false);
  assert.deepEqual((await f.owner.request('/api/decisions?q=출시일')).decisions.map(row => row.id), [second.id]);
  const final = (await f.owner.request('/api/decisions', 'POST', { messageId: source.id, summary: '최종 납품본', kind: 'final', resultMessageId: source.id, effectiveDate: '2026-10-08' }, 201)).decision;
  assert.equal(final.resultMessage.body, source.body);
  await f.owner.request(`/api/messages/${replacement.id}`, 'DELETE');
  assert.equal((await f.owner.request('/api/decisions?kind=decision')).decisions.length, 0);
  await f.restart();
  assert.equal((await f.owner.request(`/api/decisions/${first.id}`)).decision.isCurrent, false);
});

test('catch-up paginates visible evidence, never marks work done, remains read-only on GET and persists explicit acknowledgement', async t => {
  const f = await fixture(t), source = await f.send(f.owner, '원문 첫 제목');
  let task = (await f.owner.request(taskPath(source), 'POST', { assigneeId: f.assignee.user.id }, 201)).task;
  task = (await f.assignee.request(taskPath(source), 'PATCH', { stage: 'accepted', revision: task.revision })).task;
  await f.owner.request(taskPath(source), 'PATCH', { dueDate: '2026-10-09', revision: task.revision });
  await f.owner.request(`/api/messages/${source.id}`, 'PATCH', { body: '원문 현재 제목' });
  const dm = (await f.owner.request('/api/dms', 'POST', { userId: f.reviewer.user.id }, 201)).channel;
  const secret = await f.send(f.owner, '비밀 내용', dm.id);
  await f.owner.request(taskPath(secret), 'POST', { assigneeId: f.reviewer.user.id }, 201);
  const first = await f.assignee.request('/api/catch-up?limit=1');
  assert.equal(first.events.length, 1); assert.equal(first.hasMore, true); assert.equal(first.events[0].message.body, '원문 현재 제목');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM productivity_reads').get().n, 0);
  const next = await f.assignee.request('/api/catch-up?since=' + first.through);
  assert.equal(next.events.length, 2); assert.equal(next.events[1].kind, 'task_due');
  assert.equal(JSON.stringify(next).includes('비밀 내용'), false);
  const hidden = f.db.prepare('SELECT MAX(sequence) AS n FROM productivity_events').get().n;
  await f.assignee.request('/api/catch-up/read', 'POST', { through: hidden }, 400);
  await f.assignee.request('/api/catch-up/read', 'POST', { through: next.through });
  await f.assignee.request('/api/catch-up/read', 'POST', { through: first.through });
  assert.equal((await f.assignee.request('/api/catch-up')).events.length, 0);
  assert.equal((await f.assignee.request(`/api/messages/${source.id}`)).message.task.status, 'todo');
  await f.restart();
  assert.equal((await f.assignee.request('/api/catch-up')).since, next.through);
  await f.owner.request(`/api/messages/${source.id}`, 'DELETE');
  assert.equal((await f.assignee.request('/api/catch-up?since=0')).events.length, 0);
});

test('current final result messages cannot be edited or deleted until a new final explicitly replaces them', async t => {
  const f = await fixture(t), source = await f.send(f.owner, '최종본 확정 논의'), result = await f.send(f.assignee, '승인된 최종본 V1');
  const first = (await f.owner.request('/api/decisions', 'POST', { messageId: source.id, summary: '최종 납품 V1', kind: 'final', resultMessageId: result.id, effectiveDate: '2026-10-08' }, 201)).decision;
  await f.assignee.request(`/api/messages/${result.id}`, 'PATCH', { body: '승인하지 않은 V2로 교체' }, 409);
  await f.assignee.request(`/api/messages/${result.id}`, 'DELETE', undefined, 409);
  const nextResult = await f.send(f.assignee, '승인된 최종본 V2');
  await f.owner.request('/api/decisions', 'POST', { messageId: source.id, summary: '최종 납품 V2', kind: 'final', resultMessageId: nextResult.id, effectiveDate: '2026-10-08', replacesId: first.id }, 201);
  await f.assignee.request(`/api/messages/${result.id}`, 'PATCH', { body: '대체된 이전 파일 안내' });
  await f.assignee.request(`/api/messages/${result.id}`, 'DELETE');
  const current = (await f.owner.request('/api/decisions?kind=final')).decisions;
  assert.equal(current.length, 1); assert.equal(current[0].resultMessage.body, '승인된 최종본 V2');
  await f.assignee.request(`/api/messages/${nextResult.id}`, 'DELETE', undefined, 409);
});

test('leaving or archiving a project removes tasks, decisions and event bodies from every personal surface', async t => {
  const f = await fixture(t), room = (await f.owner.request('/api/channels', 'POST', { name: '비공개 프로젝트', description: '', category: 'project', scope: 'private', memberIds: [f.assignee.user.id] }, 201)).channel;
  const source = await f.send(f.owner, '나가면 보이지 않을 내용', room.id);
  await f.owner.request(taskPath(source), 'POST', { assigneeId: f.assignee.user.id }, 201);
  const decision = (await f.owner.request('/api/decisions', 'POST', { messageId: source.id, summary: '프로젝트 확정', effectiveDate: '2026-10-08' }, 201)).decision;
  assert.equal((await f.assignee.request('/api/workday')).total, 1);
  await f.assignee.request(`/api/channels/${room.id}/leave`, 'POST', {});
  assert.equal((await f.assignee.request('/api/workday')).total, 0);
  assert.equal((await f.assignee.request('/api/decisions')).decisions.length, 0);
  assert.equal((await f.assignee.request('/api/catch-up')).events.length, 0);
  await f.assignee.request(`/api/decisions/${decision.id}`, 'GET', undefined, 404);
  await f.owner.request(`/api/channels/${room.id}`, 'DELETE');
  assert.equal((await f.owner.request('/api/decisions')).decisions.length, 0);
  assert.equal((await f.owner.request('/api/catch-up')).events.length, 0);
});
