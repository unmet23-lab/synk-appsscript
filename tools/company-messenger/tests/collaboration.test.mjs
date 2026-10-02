import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { createMessenger } from '../server.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-collaboration-'));
  const driveStorage = { active: async () => null, status: async () => ({ provider: 'local' }) };
  let app, url;
  async function start() { app = createMessenger({ dataDir: dir, port: 0, driveStorage }); url = (await app.listen()).url; }
  await start();
  const fx = { get db() { return app.db; }, get url() { return url; }, async restart(edit) { await app.close(); if (edit) { const db = new DatabaseSync(join(dir, 'messenger.sqlite')); try { db.exec('PRAGMA foreign_keys=ON'); edit(db); } finally { db.close(); } } await start(); } };
  function client() {
    let cookie = '';
    return { async request(path, method = 'GET', body, status = 200, extra = {}) {
      const bytes = body instanceof Uint8Array;
      const response = await fetch(url + path, { method, headers: { Cookie: cookie, ...(method === 'GET' ? {} : { Origin: url }), ...(body === undefined ? {} : { 'Content-Type': bytes ? 'application/octet-stream' : 'application/json' }), ...extra }, body: body === undefined ? undefined : bytes ? body : JSON.stringify(body), signal: AbortSignal.timeout(6000) });
      const next = response.headers.getSetCookie().find(row => row.startsWith('synk_messenger_session=')); if (next) cookie = next.split(';')[0];
      const value = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(value)}`); return value;
    } };
  }
  const owner = client();
  const boot = await owner.request('/api/setup', 'POST', { workspaceName: '격리된 시험', name: '관리자', username: 'owner', password: 'long-fixture-password' }, 201);
  const makeMember = async name => { const invite = await owner.request('/api/invites', 'POST', {}, 201), person = client(); const data = await person.request('/api/join', 'POST', { name, username: name, password: 'long-fixture-password', code: invite.code }, 201); return { client: person, user: data.user }; };
  fx.owner = { client: owner, user: boot.user }; fx.member = await makeMember('member'); fx.other = await makeMember('other');
  fx.social = boot.channels.find(room => room.systemKey === 'social').id; fx.notice = boot.channels.find(room => room.systemKey === 'announcements').id;
  fx.send = async (person, room, body, extras = {}) => (await person.client.request(`/api/channels/${room}/messages`, 'POST', { body, ...extras }, 201)).message;
  t.after(async () => { await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-collaboration-')); await rm(dir, { recursive: true, force: true }); });
  return fx;
}

test('mentions, replies and DMs notify only recipients; reads are explicit and room mute/all are applied', async t => {
  const f = await fixture(t);
  const plain = await f.send(f.owner, f.social, '일반 대화');
  assert.equal((await f.member.client.request('/api/notifications')).items.length, 0);
  const mention = await f.send(f.owner, f.social, '크루를 호출합니다', { mentionIds: [f.member.user.id] });
  assert.equal(mention.mentions[0].id, f.member.user.id);
  let inbox = await f.member.client.request('/api/notifications'); assert.equal(inbox.unreadCount, 1); assert.equal(inbox.items[0].kind, 'mention');
  assert.equal((await f.member.client.request('/api/notifications')).unreadCount, 1, 'GET must not mark notifications read');
  await f.other.client.request(`/api/notifications/${inbox.items[0].id}/read`, 'POST', {}, 404);
  await f.member.client.request(`/api/notifications/${inbox.items[0].id}/read`, 'POST', {});
  assert.equal((await f.member.client.request('/api/notifications')).unreadCount, 0);
  await f.send(f.member, f.social, '원문 답글', { replyToId: plain.id });
  assert.equal((await f.owner.client.request('/api/notifications')).items[0].kind, 'reply');
  const dm = (await f.owner.client.request('/api/dms', 'POST', { userId: f.member.user.id }, 201)).channel;
  await f.send(f.owner, dm.id, '둘만의 대화'); assert.equal((await f.member.client.request('/api/notifications')).items[0].kind, 'dm');
  await f.owner.client.request(`/api/channels/${dm.id}/messages`, 'POST', { body: '타인 멘션', mentionIds: [f.other.user.id] }, 404);
  await f.member.client.request(`/api/channels/${f.social}/notifications`, 'PATCH', { mode: 'mute' });
  const prior = (await f.member.client.request('/api/notifications')).items.length;
  await f.send(f.owner, f.social, '알림 없음', { mentionIds: [f.member.user.id] });
  assert.equal((await f.member.client.request('/api/notifications')).items.length, prior);
  await f.member.client.request(`/api/channels/${f.social}/notifications`, 'PATCH', { mode: 'all' });
  await f.send(f.owner, f.social, '전체 알림'); assert.equal((await f.member.client.request('/api/notifications')).items[0].kind, 'message');
  await f.member.client.request('/api/notifications/read-all', 'POST', {}); assert.equal((await f.member.client.request('/api/notifications')).unreadCount, 0);
});

test('announcement acknowledgement is explicit, idempotent and reset by editing the announcement', async t => {
  const f = await fixture(t), message = await f.send(f.owner, f.notice, '필독 안내');
  assert.equal(message.ackRequired, true); assert.equal(message.acknowledged, false);
  await f.member.client.request(`/api/channels/${f.notice}/read`, 'POST', { messageId: message.id });
  let list = await f.member.client.request(`/api/messages/${message.id}/acks`); assert.equal(list.acknowledged.length, 0); assert.equal(list.pending.length, 3);
  await f.member.client.request(`/api/messages/${message.id}/ack`, 'POST', {});
  const first = await f.member.client.request(`/api/messages/${message.id}/acks`);
  await f.member.client.request(`/api/messages/${message.id}/ack`, 'POST', {});
  assert.deepEqual((await f.member.client.request(`/api/messages/${message.id}/acks`)).acknowledged, first.acknowledged);
  await f.owner.client.request(`/api/messages/${message.id}`, 'PATCH', { body: '수정한 필독 안내' });
  list = await f.owner.client.request(`/api/messages/${message.id}/acks`); assert.equal(list.acknowledged.length, 0);
  const chat = await f.send(f.member, f.social, '일반 메시지');
  await f.member.client.request(`/api/messages/${chat.id}/ack`, 'POST', {}, 400);
  await f.member.client.request(`/api/channels/${f.social}/messages`, 'POST', { body: '가짜 공지', ackRequired: true }, 400);
});

test('tasks restrict assignments and changes, keep original message links and notify the assignee', async t => {
  const f = await fixture(t), message = await f.send(f.member, f.social, '자료 정리');
  const created = (await f.member.client.request(`/api/messages/${message.id}/task`, 'POST', { assigneeId: f.other.user.id, dueDate: '2026-10-02', title: '참고 자료 정리' }, 201)).task;
  assert.equal(created.canManage, true); assert.equal(created.messageId, message.id);
  const list = await f.other.client.request('/api/tasks?scope=mine'); assert.equal(list.tasks.length, 1); assert.equal(list.tasks[0].message.body, '자료 정리');
  assert.equal((await f.other.client.request('/api/notifications')).items[0].kind, 'task');
  const changed = (await f.other.client.request(`/api/messages/${message.id}/task`, 'PATCH', { status: 'done' })).task; assert.equal(changed.status, 'done');
  assert.equal((await f.member.client.request('/api/notifications')).items[0].kind, 'task');
  const dm = (await f.owner.client.request('/api/dms', 'POST', { userId: f.member.user.id }, 201)).channel, secret = await f.send(f.owner, dm.id, '비공개 업무');
  await f.owner.client.request(`/api/messages/${secret.id}/task`, 'POST', { assigneeId: f.other.user.id }, 400);
  await f.other.client.request(`/api/messages/${secret.id}/task`, 'POST', { assigneeId: f.other.user.id }, 404);
  await f.other.client.request('/api/tasks?scope=channel&channelId=' + dm.id, 'GET', undefined, 404);
  await f.member.client.request(`/api/messages/${message.id}/task`, 'PATCH', { dueDate: '2026-02-30' }, 400);
});

test('workspace cards alone can be sent, normalize safely and reject credentials and foreign destinations', async t => {
  const f = await fixture(t);
  const message = await f.send(f.owner, f.social, '', { workspaceLink: { title: '전체 추이', url: `${f.url}/#view=history&section=mine` } });
  assert.deepEqual(message.workspaceLink, { title: '전체 추이', url: '/#view=history&section=mine', kind: 'report' });
  await f.owner.client.request(`/api/messages/${message.id}`, 'PATCH', { body: '설명 추가' });
  assert.equal((await f.member.client.request(`/api/messages/${message.id}`)).message.workspaceLink.title, '전체 추이');
  for (const url of ['https://evil.invalid/?tab=overview', '/?tab=overview&token=secret', '/api/storage', '/#view=content&section=plan&draftId=unverified', '/?tab=overview&tab=history']) {
    await f.owner.client.request(`/api/channels/${f.social}/messages`, 'POST', { body: '차단 대상', workspaceLink: { title: '링크', url } }, url.includes('draftId') ? 403 : 400);
  }
});

test('search combines author, inclusive KST dates, attachment type and privacy before pagination', async t => {
  const f = await fixture(t);
  const file = (await f.owner.client.request(`/api/channels/${f.social}/files`, 'POST', Buffer.from('test'), 201, { 'X-File-Name': encodeURIComponent('자료.pdf') })).file;
  const a = await f.send(f.owner, f.social, '일치하는 검색', { fileIds: [file.id] });
  const b = await f.send(f.owner, f.social, '일치하는 두 번째');
  const c = await f.send(f.member, f.social, '다른 작성자');
  f.db.prepare('UPDATE messages SET created_at=? WHERE id=?').run('2026-09-29T15:00:00.000Z', a.id);
  f.db.prepare('UPDATE messages SET created_at=? WHERE id=?').run('2026-09-30T14:59:59.999Z', b.id);
  f.db.prepare('UPDATE messages SET created_at=? WHERE id=?').run('2026-09-30T15:00:00.000Z', c.id);
  const query = `/api/search?from=2026-09-30&to=2026-09-30&authorId=${f.owner.user.id}`;
  const page = await f.member.client.request(query + '&limit=1'); assert.equal(page.messages[0].id, b.id); assert.equal(page.hasMore, true);
  assert.equal((await f.member.client.request(query + '&limit=1&offset=1')).messages[0].id, a.id);
  assert.deepEqual((await f.member.client.request(query + '&fileType=document')).messages.map(row => row.id), [a.id]);
  assert.equal((await f.member.client.request('/api/search?q=never')).messages.length, 0);
  await f.member.client.request('/api/search?from=2026-10-01&to=2026-09-01', 'GET', undefined, 400);
  await f.member.client.request('/api/search?from=2026-02-30', 'GET', undefined, 400);
  const dm = (await f.owner.client.request('/api/dms', 'POST', { userId: f.other.user.id }, 201)).channel;
  await f.send(f.owner, dm.id, '비공개문구'); assert.equal((await f.member.client.request('/api/search?q=비공개문구')).messages.length, 0);
});

test('saved messages and reminders remain private, survive restart, catch up once and disappear with source deletion', async t => {
  const f = await fixture(t), message = await f.send(f.owner, f.social, '나중에 확인');
  await f.member.client.request(`/api/messages/${message.id}/save`, 'POST', {});
  assert.equal((await f.member.client.request('/api/saved')).messages.length, 1); assert.equal((await f.other.client.request('/api/saved')).messages.length, 0);
  const reminder = (await f.member.client.request(`/api/messages/${message.id}/reminder`, 'PUT', { remindAt: new Date(Date.now() + 3600000).toISOString() })).reminder;
  assert.equal((await f.other.client.request('/api/reminders')).reminders.length, 0);
  await f.restart(db => db.prepare('UPDATE message_reminders SET remind_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z', reminder.id));
  let inbox = await f.member.client.request('/api/notifications'); assert.equal(inbox.items.filter(row => row.kind === 'reminder').length, 1); assert.equal(inbox.unreadCount, 1);
  assert.equal((await f.member.client.request('/api/reminders?status=due')).reminders.length, 1);
  await f.restart(); inbox = await f.member.client.request('/api/notifications'); assert.equal(inbox.items.length, 1); assert.equal(inbox.unreadCount, 1);
  await f.owner.client.request(`/api/messages/${message.id}`, 'PATCH', { body: '수정된 현재 원문' });
  assert.equal((await f.member.client.request('/api/notifications')).items[0].message.body, '수정된 현재 원문');
  await f.owner.client.request(`/api/messages/${message.id}`, 'DELETE');
  assert.equal((await f.member.client.request('/api/saved')).messages.length, 0);
  assert.equal((await f.member.client.request('/api/reminders')).reminders.length, 0);
  assert.equal((await f.member.client.request('/api/notifications')).items.length, 0);
});

test('company share authorization errors explain recovery without exposing external error text', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'synk-collaboration-'));
  let denied = null;
  const integration = {
    origin: 'http://127.0.0.1:0',
    listUsers: () => [{ id: 'company-admin', name: '합성 관리자', role: 'admin', active: true }],
    authenticate: () => ({ companyUserId: 'company-admin', role: 'admin', canWrite: true, canManage: true, csrfToken: 'synthetic-csrf', token: 'synthetic-session', parentOrigin: integration.origin }),
    resolveWorkspaceLink: ({ workspaceLink }) => { if (denied) throw denied; return workspaceLink; },
  };
  const app = createMessenger({ dataDir: dir, integration, driveStorage: { active: async () => null } });
  const server = createServer(app.handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  integration.origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); }); await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-collaboration-')); await rm(dir, { recursive: true, force: true }); });
  const state = await (await fetch(integration.origin + '/api/bootstrap')).json(), channel = state.channels.find(room => room.systemKey === 'social');
  async function request(path, method, body) { return fetch(integration.origin + path, { method, headers: { Origin: integration.origin, 'X-CSRF-Token': 'synthetic-csrf', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  const input = { body: '원래 메시지', workspaceLink: { title: '검토 요청', url: '/#view=content&section=plan&draftId=synthetic-draft' } };
  const initial = await request(`/api/channels/${channel.id}/messages`, 'POST', input), message = (await initial.json()).message;
  assert.equal(initial.status, 201);
  for (const status of [403, 404, 500]) {
    denied = Object.assign(new Error('upstream secret-token synthetic-private-title'), status === 500 ? {} : { status });
    for (const [path, method] of [[`/api/channels/${channel.id}/messages`, 'POST'], [`/api/messages/${message.id}`, 'PATCH']]) {
      const response = await request(path, method, { ...input, body: '허용되지 않은 수정' }), value = await response.json();
      assert.equal(response.status, status); assert.doesNotMatch(value.error, /secret-token|private-title|upstream/);
      if (status === 403) assert.match(value.error, /다른 크루나 대화방을 선택/);
      if (status === 404) assert.match(value.error, /기획을 다시 확인/);
      if (status === 500) assert.match(value.error, /처리 중 오류/);
    }
  }
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 1);
  assert.equal(app.db.prepare('SELECT body FROM messages WHERE id=?').get(message.id).body, '원래 메시지');
});
