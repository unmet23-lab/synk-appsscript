import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createCompanyApp } from './server.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-next-action-'));
  let time = '2026-11-09T01:00:00.000Z';
  const app = createCompanyApp({ dataDir: directory, port: 0, allowTestHost: true, schedule: false, workNotificationsEnabled: false, webPushEnabled: false, channelCollectionEnabled: false, clock: () => time,
    synkIdentityConfig: null, synkCustomerIdentityConfig: null, teachingConfig: null,
    messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) },
  });
  t.after(async () => { await app.stop(); const target = resolve(directory); assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.split(sep).at(-1).startsWith('synk-next-action-')); await rm(target, { recursive: true, force: true }); });
  const address = await app.start(), base = 'http://127.0.0.1:' + address.port;
  const users = Object.fromEntries([['admin', 'admin'], ['member', 'member'], ['peer', 'member'], ['viewer', 'viewer']].map(([id, role]) => [id, app.store.createUser({ name: '합성 ' + id, email: id + '@example.test', role })]));
  const tokens = Object.fromEntries(Object.entries(users).map(([key, user]) => [key, app.store.mint('session', user.id, { csrfToken: 'csrf-' + key }, 60)]));
  async function raw(user, path, body, extra = {}, method = body === undefined ? 'GET' : 'POST') {
    return fetch(base + path, { method, headers: { Cookie: 'synk_company_session=' + tokens[user], Origin: app.origin, 'X-CSRF-Token': 'csrf-' + user, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  }
  async function json(user, path, body, status = 200, extra) { const response = await raw(user, path, body, extra), result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result; }
  const boot = {}; for (const user of Object.keys(users)) boot[user] = await json(user, '/messenger/api/bootstrap');
  const ask = (user, options = {}) => json(user, '/api/assistant', { intent: 'next-action', ...options });
  return { app, users, boot, raw, json, ask, setTime: value => { time = value; } };
}
async function makeTask(f, { privateRoom = false, assignee = 'member', title = '합성 다음 업무', dueDate = '2026-11-09' } = {}) {
  const room = privateRoom ? (await f.json('admin', '/messenger/api/channels', { name: 'PRIVATE-NEXT-ACTION', category: 'project' }, 201)).channel : f.boot.admin.channels.find(row => row.systemKey === 'social');
  const message = (await f.json('admin', '/messenger/api/channels/' + room.id + '/messages', { body: title }, 201)).message;
  const task = (await f.json('admin', '/messenger/api/messages/' + message.id + '/task', { assigneeId: f.boot[assignee].user.id, title, dueDate, stage: 'requested' }, 201)).task;
  return { room, message, task };
}
const snapshot = f => JSON.stringify({
  messenger: Object.fromEntries(['message_tasks', 'messages', 'notifications', 'productivity_events', 'productivity_reads'].map(table => [table, f.app.messenger.db.prepare('SELECT * FROM ' + table).all()])),
  company: Object.fromEntries(['clientProjects', 'clientTaskRechecks', 'socialPosts', 'socialPublishJobs'].map(kind => [kind, f.app.store.all(kind)])),
});

test('my next action includes my SHIFT and PATH work and opens the exact current record', async t => {
  const f = await fixture(t);
  const memberships = [{ company: 'SHIFT', role: 'manager' }, { company: 'PATH', role: 'counselor' }];
  function assign(actor, roles) {
    const user = f.users[actor];
    f.app.store.put('users', user.id, { ...user, workspaceProfile: { version: 1, revision: 1, memberships: roles, duties: [] } });
  }
  assign('member', memberships);
  assign('peer', [{ company: 'SHIFT', role: 'instructor' }]);
  const add = async (actor, company, title, date) =>
    (await f.json(actor, '/api/company-work/' + company, { title, date, status: 'open' }, 201)).item;
  const lecture = await add('member', 'SHIFT', '다음 수업 준비', '2026-11-09');
  const consultation = await add('member', 'PATH', '정착 상담', '2026-11-10');
  const other = await add('peer', 'SHIFT', '동료의 강의', '2026-11-08');
  const mine = await f.json('member', '/api/company-work/mine');
  assert.deepEqual(mine.items.map(row => row.id), [lecture.id, consultation.id]);
  assert.deepEqual(mine.items.map(row => row.date), ['2026-11-09', '2026-11-10']);
  assert.equal(mine.items.some(row => Object.hasOwn(row, 'note')), false);
  assert.equal((await f.raw('anonymous', '/api/company-work/mine')).status, 401);
  assert.deepEqual((await f.json('admin', '/api/company-work/mine')).items, []);
  const spoken = await f.json('member', '/api/assistant', { message: '오늘 처리할 업무가 뭐야?' });
  assert.equal(spoken.data.todayCount, 1);
  assert.equal(spoken.data.pendingCount, 1);
  assert.match(spoken.text, /다음 수업 준비/);
  assert.doesNotMatch(spoken.text, /동료의 강의/);
  const data = (await f.ask('member')).data;
  assert.equal(data.status, 'ready');
  assert.deepEqual(Object.keys(data.coverage).sort(), ['lectures', 'messenger', 'path']);
  assert.deepEqual(data.today.map(row => row.sourceId), [lecture.id]);
  assert.equal(data.next.sourceId, lecture.id);
  assert.equal(data.next.due.value, '2026-11-09');
  assert.equal(data.next.action.href, '/?tab=lectures&workId=' + lecture.id);
  const otherSchedule = data.alternatives.find(row => row.sourceId === consultation.id);
  assert.equal(otherSchedule.due.value, '2026-11-10');
  assert.equal(otherSchedule.action.href, '/?tab=path&workId=' + consultation.id);
  assert.equal(data.totalCount, 2);
  assert.doesNotMatch(JSON.stringify(data), new RegExp(other.id));
  assert.equal((await f.ask('member', { exclusions: [data.next.key] })).data.next.sourceId, consultation.id);
  await f.json('member', '/api/company-work/SHIFT/' + lecture.id, { title: lecture.title, date: lecture.date, status: 'done', revision: lecture.revision });
  assert.equal((await f.ask('member', { candidateKey: data.next.key })).data.candidateCheck.status, 'missing');
  const remaining = (await f.ask('member')).data.next;
  assign('member', memberships.slice(0, 1));
  const afterReassignment = (await f.ask('member', { candidateKey: remaining.key })).data;
  assert.equal(afterReassignment.candidateCheck.status, 'missing');
  assert.doesNotMatch(JSON.stringify(afterReassignment), new RegExp(consultation.id));
  assert.deepEqual((await f.json('member', '/api/company-work/mine')).items, []);
  assign('member', [{ company: 'SHIFT', role: 'automation' }]);
  const withoutSchedules = (await f.ask('member')).data;
  assert.equal(withoutSchedules.status, 'empty');
  assert.deepEqual(Object.keys(withoutSchedules.coverage), ['messenger']);
  assert.deepEqual((await f.json('member', '/api/company-work/mine')).companies, []);
});

test('real assistant endpoint recommends authorized work, confirms skipped candidates and leaves workflow and notifications unchanged', async t => {
  const f = await fixture(t), { task } = await makeTask(f);
  await makeTask(f, { privateRoom: true, assignee: 'admin', title: 'PRIVATE-SOURCE-NOT-FOR-MEMBER' });
  const before = snapshot(f), response = await f.ask('member', { userId: f.users.admin.id, scope: 'all' });
  assert.equal(response.intent, 'next-action'); assert.equal(response.data.status, 'ready'); assert.equal(response.data.generatedAt, '2026-11-09T01:00:00.000Z'); assert.equal(response.data.next.sourceId, task.id); assert.equal(response.data.totalCount, 1);
  assert.doesNotMatch(JSON.stringify(response), /PRIVATE-SOURCE-NOT-FOR-MEMBER/);
  const key = response.data.next.key, skipped = await f.ask('member', { exclusions: [key], candidateKey: key });
  assert.equal(skipped.data.status, 'empty'); assert.equal(skipped.data.totalCount, 1); assert.equal(skipped.data.excludedCount, 1); assert.equal(skipped.data.candidateCheck.status, 'confirmed');
  assert.equal(snapshot(f), before);
  assert.equal((await f.ask('peer')).data.totalCount, 0); assert.equal((await f.ask('viewer')).data.totalCount, 0);
});

test('revalidation observes task edits, completion and room revocation through the real source', async t => {
  const f = await fixture(t), { task, message, room } = await makeTask(f), first = (await f.ask('member')).data.next;
  const patch = async body => {
    const response = await f.raw('member', '/messenger/api/messages/' + message.id + '/task', body, {}, 'PATCH');
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data.task;
  };
  let current = await patch({ revision: task.revision, stage: 'accepted' });
  const check = await f.ask('member', { candidateKey: first.key }); assert.equal(check.data.candidateCheck.status, 'changed');
  const second = check.data.candidateCheck.candidate;
  current = await patch({ revision: current.revision, stage: 'done' }); assert.equal(current.stage, 'done');
  assert.equal((await f.ask('member', { candidateKey: second.key })).data.candidateCheck.status, 'missing');
  // A fresh source becomes inaccessible without leaking it in the confirmation.
  const another = await makeTask(f, { title: '권한 철회 전 업무' }), third = (await f.ask('member')).data.next;
  f.app.messenger.db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run(room.id, f.boot.member.user.id);
  const revoked = await f.ask('member', { candidateKey: third.key }); assert.equal(revoked.data.candidateCheck.status, 'missing'); assert.doesNotMatch(JSON.stringify(revoked), /권한 철회 전 업무/); assert.ok(another.task.id);
});

test('editing a source message or its workspace reference invalidates confirmation and skips with the same task revision', async t => {
  const f = await fixture(t), { task, message } = await makeTask(f), first = (await f.ask('member')).data.next;
  const patch = async body => {
    const response = await f.raw('admin', '/messenger/api/messages/' + message.id, body, {}, 'PATCH');
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); assert.equal(data.message.task.revision, task.revision); return data.message;
  };
  await patch({ body: '요청 본문만 수정한 합성 업무' });
  const changed = (await f.ask('member', { candidateKey: first.key, exclusions: [first.key] })).data;
  assert.equal(changed.candidateCheck.status, 'changed'); assert.equal(changed.excludedCount, 0); assert.equal(changed.next.sourceId, task.id);
  const second = changed.next;
  await patch({ body: '요청 본문만 수정한 합성 업무', workspaceLink: { title: '새 참고 현황', url: '/#view=history&section=mine' } });
  const linked = (await f.ask('member', { candidateKey: second.key, exclusions: [second.key] })).data;
  assert.equal(linked.candidateCheck.status, 'changed'); assert.equal(linked.excludedCount, 0); assert.notEqual(linked.next.key, second.key);
  // Saving the same semantic content again is not a new recommendation.
  await patch({ body: '요청 본문만 수정한 합성 업무' });
  const stable = (await f.ask('member', { candidateKey: linked.next.key, exclusions: [linked.next.key] })).data;
  assert.equal(stable.candidateCheck.status, 'confirmed'); assert.equal(stable.excludedCount, 1); assert.equal(stable.next, null);
});

test('customer deferred work is omitted until its semantic source changes; empty mutation actions do not suppress actionable links', async t => {
  const f = await fixture(t);
  const project = (await f.json('admin', '/api/client-projects', { title: '합성 고객 연락', customerName: '합성 고객', ownerId: f.users.member.id, summary: '일정 확인', nextStep: '내일 일정 확인', nextContactDate: '2026-11-09' }, 201)).project;
  const first = await f.ask('member'); assert.equal(first.data.next.source, 'client'); assert.match(first.data.next.action.href, /followUp=1/);
  const workflow = await f.json('member', '/api/client-workflow'), row = workflow.todayItems.find(item => item.projectId === project.id && item.kind === 'follow_up');
  await f.json('member', '/api/client-workflow/recheck', { action: 'defer', itemId: row.id, date: '2026-11-11', fingerprint: workflow.rechecks[row.id].fingerprint });
  assert.equal((await f.ask('member')).data.totalCount, 0);
  f.setTime('2026-11-10T01:00:00.000Z');
  const overdue = await f.ask('member'); assert.equal(overdue.data.next.sourceId, row.id); assert.equal(overdue.data.next.reasons[0].code, 'due_overdue');
});

test('failed source confirmation remains unverified and normal authentication, CSRF and input limits apply', async t => {
  const f = await fixture(t); await makeTask(f);
  const first = await f.ask('member'), key = first.data.next.key, original = f.app.messenger.productivityOverview;
  f.app.messenger.productivityOverview = () => { throw new Error('fixture source unavailable'); };
  const failed = await f.ask('member', { candidateKey: key }); assert.equal(failed.data.status, 'partial'); assert.equal(failed.data.candidateCheck.status, 'unverified'); assert.equal(failed.data.next, null);
  f.app.messenger.productivityOverview = original;
  assert.equal((await f.raw('member', '/api/assistant', { intent: 'next-action' }, { 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal((await f.raw('member', '/api/assistant', { intent: 'next-action', exclusions: Array(101).fill(key) })).status, 400);
  f.app.store.put('users', f.users.member.id, { ...f.users.member, active: false });
  // The existing write-request guard rejects a revoked session before routing.
  assert.equal((await f.raw('member', '/api/assistant', { intent: 'next-action' })).status, 403);
});
