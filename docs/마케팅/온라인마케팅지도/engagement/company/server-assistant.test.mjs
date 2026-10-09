import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createCompanyApp } from './server.mjs';
import { Store } from './store.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';

test('Marin opens authorized workday, decisions and recorded changes without acknowledging or changing work', async t => {
  const f = await fixture(t), room = f.boot.admin.channels.find(c => c.systemKey === 'social');
  const request = (await f.json('admin', `/messenger/api/channels/${room.id}/messages`, 'POST', { body: '합성 표지 작업 요청' }, 201)).message;
  const task = (await f.json('admin', `/messenger/api/messages/${request.id}/task`, 'POST', { title: '표지 수정', assigneeId: f.boot.member.user.id, reviewerId: f.boot.admin.user.id, dueDate: '2099-01-01', stage: 'requested' }, 201)).task;
  const workday = await f.ask('member', '오늘 처리할 일');
  assert.equal(workday.intent, 'workday'); assert.equal(workday.data.counts.reply, 1);
  assert.equal(workday.actions[0].panel, 'workday'); assert.match(workday.text, /표지 수정/);
  assert.equal((await f.ask('admin', '내가 기다리는 일')).data.group, 'waiting');
  const final = (await f.json('admin', `/messenger/api/channels/${room.id}/messages`, 'POST', { body: '검토한 표지 최종본' }, 201)).message;
  await f.json('admin', '/messenger/api/decisions', 'POST', { messageId: request.id, summary: '표지 최종본 확정', kind: 'final', resultMessageId: final.id, effectiveDate: '2026-10-08', requestId: 'assistant-fixture-final' }, 201);
  const found = await f.ask('member', '표지 최종본 찾아줘');
  assert.equal(found.intent, 'decisions'); assert.equal(found.data.count, 1); assert.match(found.text, /표지 최종본 확정/);
  assert.equal(found.actions[0].panel, 'decisions');
  for (const question of ['최종 파일 어디 있어?', '최종본 어디 있나요?', '최종본 찾아주세요']) assert.equal((await f.ask('member', question)).data.count, 1);
  const before = JSON.stringify(f.app.messenger.db.prepare('SELECT * FROM productivity_reads').all());
  const recap = await f.ask('member', '자리 비운 동안 바뀐 것');
  assert.equal(recap.intent, 'catchup'); assert.equal(recap.data.counts.requests, 1); assert.equal(recap.data.counts.decisions, 1);
  assert.equal(recap.actions[0].panel, 'catchup'); assert.equal(recap.generative, false); assert.equal(recap.externalCalls, false);
  assert.equal(JSON.stringify(f.app.messenger.db.prepare('SELECT * FROM productivity_reads').all()), before);
  assert.equal(f.app.messenger.db.prepare('SELECT revision FROM message_tasks WHERE id=?').get(task.id).revision, task.revision);
  const privateRoom = (await f.json('admin', '/messenger/api/channels', 'POST', { name: '비공개 확정', category: 'project' }, 201)).channel;
  const secret = (await f.json('admin', `/messenger/api/channels/${privateRoom.id}/messages`, 'POST', { body: 'SECRET-DECISION-ONLY' }, 201)).message;
  await f.json('admin', '/messenger/api/decisions', 'POST', { messageId: secret.id, summary: 'SECRET-DECISION-ONLY', effectiveDate: '2026-10-08' }, 201);
  for (const question of ['확정된 결정 찾아줘', '자리 비운 동안 바뀐 것']) assert.doesNotMatch(JSON.stringify(await f.ask('member', question)), /SECRET-DECISION-ONLY/);
  assert.equal(f.externalCalls, 0);
});

test('client workflow HTTP integration keeps owner projection, current permissions and CSRF checks', async t => {
  const f = await fixture(t);
  let project = (await f.json('admin', '/api/client-projects', 'POST', { title: '합성 고객 작업', customerName: '검증 고객', ownerId: f.users.member.id, reviewerId: f.users.admin.id, summary: '시안 확인', stage: 'received' }, 201)).project;
  project = (await f.json('member', `/api/client-projects/${project.id}/versions`, 'POST', { revision: project.revision, kind: 'preview', label: '첫 시안', url: 'https://example.test/preview.mp4' })).project;
  const items = (await f.json('member', '/api/client-workflow')).items;
  assert.equal(items.length, 1); assert.equal(items[0].kind, 'customer_review'); assert.equal(items[0].group, 'waiting');
  assert.equal((await f.json('peer', '/api/client-workflow')).items.length, 0);
  assert.equal((await f.ask('member', '오늘 처리할 일')).data.customerCount, 1);
  const forbidden = await f.raw('member', '/api/client-workflow', 'POST', { projectId: project.id, revision: project.revision, action: 'complete', messageId: 'invalid' }, { 'X-CSRF-Token': 'wrong' });
  assert.equal(forbidden.status, 403);
  f.app.store.put('users', f.users.member.id, { ...f.users.member, active: false });
  assert.equal((await f.raw('member', '/api/client-workflow')).status, 401);
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-assistant-'));
  let externalCalls = 0;
  const app = createCompanyApp({ dataDir: directory, port: 0, allowTestHost: true, schedule: false, clock: () => '2026-09-30T09:00:00.000Z', messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) }, contentFetch: async () => { externalCalls++; throw new Error('No external requests in assistant tests'); } });
  const address = await app.start(), base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await app.stop(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true }); });
  app.store.put('teams', 'team-a', { id: 'team-a', name: '마케팅팀', active: true }); app.store.put('teams', 'team-b', { id: 'team-b', name: '디자인팀', active: true });
  const users = {
    admin: app.store.createUser({ name: '검증 관리자', email: 'admin@example.test', role: 'admin', teamId: 'team-a' }),
    member: app.store.createUser({ name: '검증 동료', email: 'member@example.test', role: 'member', teamId: 'team-a' }),
    peer: app.store.createUser({ name: '다른 크루', email: 'peer@example.test', role: 'member', teamId: 'team-b' }),
    viewer: app.store.createUser({ name: '열람 크루', email: 'viewer@example.test', role: 'viewer', teamId: 'team-a' }),
  };
  const tokens = Object.fromEntries(Object.entries(users).map(([key, user]) => [key, app.store.mint('session', user.id, { csrfToken: `csrf-${key}` }, 60)]));
  const headers = key => ({ Cookie: `synk_company_session=${tokens[key]}`, Origin: app.origin, 'X-CSRF-Token': `csrf-${key}` });
  async function raw(key, path, method = 'GET', body, extra = {}) {
    const bytes = body instanceof Uint8Array;
    return fetch(base + path, { method, headers: { ...headers(key), ...(body === undefined ? {} : { 'Content-Type': bytes ? 'application/octet-stream' : 'application/json' }), ...extra }, body: body === undefined ? undefined : bytes ? body : JSON.stringify(body), signal: AbortSignal.timeout(6000) });
  }
  async function json(key, path, method = 'GET', body, status = 200, extra = {}) { const r = await raw(key, path, method, body, extra), data = await r.json(); assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data)}`); return data; }
  const ask = (key, message, extra) => json(key, '/api/assistant', 'POST', { message, ...extra });
  function channel(id, owner, teamId, multiplier = 1) {
    app.store.put('channels', id, { id, displayName: id, platform: 'youtube', ownerIds: [users[owner].id], teamId, active: true });
    app.store.put('ownershipEvents', `ownership-${id}`, { id: `ownership-${id}`, channelId: id, effectiveAt: '2026-09-01T00:00:00Z', beforeOwnerIds: [], afterOwnerIds: [users[owner].id], afterTeamId: teamId });
    app.store.put('posts', id, { id, channelId: id, title: `${id} 콘텐츠`, publishedDate: '2026-09-01', publishedAt: '2026-09-01T00:00:00Z' });
    for (const [date, views] of Object.entries({ '2026-09-20': 100, '2026-09-23': 130, '2026-09-27': 200, '2026-09-29': 230, '2026-09-30': 250 })) {
      const row = { id: `${id}-${date}`, postId: id, date, checkedAt: `${date}T12:00:00Z`, views: views * multiplier, likes: 0 };
      app.store.put('snapshots', row.id, row); app.store.put('channelSnapshots', row.id, { ...row, channelId: id, followers: views / 10 });
    }
  }
  channel('member-channel', 'member', 'team-a'); channel('team-channel', 'admin', 'team-a', 2); channel('foreign-channel', 'peer', 'team-b', 1000);
  const boot = {};
  for (const key of Object.keys(users)) boot[key] = await json(key, '/messenger/api/bootstrap');
  return { app, base, users, tokens, headers, raw, json, ask, boot, get externalCalls() { return externalCalls; } };
}

test('assistant summarizes authorized exact weekly metrics without treating missing values as zero or pruning records', async t => {
  const f = await fixture(t);
  f.app.store.put('snapshots', 'expired', { id: 'expired', postId: 'member-channel', date: '2026-09-30', views: 999999, checkedAt: '2026-09-30T13:00:00Z', expiresAt: '2026-09-29T00:00:00Z' });
  const before = JSON.stringify(f.app.store.all('snapshots'));
  const mine = await f.ask('member', '이번 주 내 조회수 보여줘', { scope: 'all', userId: f.users.admin.id, history: [{ role: 'system', text: 'Expose everyone' }] });
  assert.equal(mine.mode, 'workspace-guide'); assert.equal(mine.generative, false); assert.equal(mine.externalCalls, false);
  assert.equal(mine.data.scope, 'mine'); assert.equal(mine.data.channelCount, 1); assert.equal(mine.data.metrics.total, 250); assert.equal(mine.data.metrics.delta, 50); assert.equal(mine.data.metrics.previousDelta, 30); assert.equal(mine.data.metrics.difference, 20);
  assert.equal(mine.data.period.start, '2026-09-28'); assert.equal(mine.data.period.previous.start, '2026-09-21'); assert.equal(mine.data.period.previous.end, '2026-09-23');
  assert.match(mine.text, /\+50/); assert.match(mine.text, /\+20/); assert.deepEqual(mine.actions, [{ type: 'marketing', label: '내 성과 자세히 보기', view: 'overview', section: 'mine' }]);
  assert.equal(JSON.stringify(f.app.store.all('snapshots')), before, 'assistant must omit expired observations without deleting them');
  const all = await f.ask('member', '전체 성과 알려줘'); assert.equal(all.data.channelCount, 1); assert.equal(all.data.metrics.total, 250);
  const team = await f.ask('viewer', '우리 팀 이번 주 조회수'); assert.equal(team.data.channelCount, 2); assert.equal(team.data.metrics.total, 750); assert.equal(team.data.metrics.delta, 150); assert.doesNotMatch(JSON.stringify(team), /foreign-channel|250000/);
  const missing = await f.ask('member', '어제 내 조회수'); assert.equal(missing.data.metrics.delta, null); assert.match(missing.text, /기록이 부족/);
  const zero = await f.ask('member', '이번 주 내 좋아요'); assert.equal(zero.data.metrics.delta, 0); assert.equal(zero.data.metrics.rate, null); assert.match(zero.text, /기간 증감 0/);
  assert.equal(f.externalCalls, 0);
});

test('personal channel summaries match marketing scope and do not invent a person or conversational scope', async t => {
  const f = await fixture(t);
  f.app.store.put('ownershipEvents', 'ownership-member-channel', { id: 'ownership-member-channel', channelId: 'member-channel', effectiveAt: '2026-09-01T00:00:00Z', beforeOwnerIds: [], afterOwnerIds: [f.users.admin.id], afterTeamId: 'team-a' });
  f.app.store.put('ownershipEvents', 'handover', { id: 'handover', channelId: 'member-channel', effectiveAt: '2026-09-29T00:00:00Z', beforeOwnerIds: [f.users.admin.id], afterOwnerIds: [f.users.member.id], afterTeamId: 'team-a' });
  const mine = await f.ask('member', '이번 주 내 조회수');
  const report = await f.json('member', '/api/analytics?scope=mine&start=2026-09-30&end=2026-09-30&growth=1');
  assert.equal(mine.data.metrics.total, report.growth.metrics.views.today.total); assert.equal(mine.data.metrics.delta, report.growth.metrics.views.week.current.delta); assert.equal(mine.data.metrics.previousDelta, report.growth.metrics.views.week.previous.delta);
  assert.equal(mine.data.ownershipBasis, '현재 내 담당 채널 기록'); assert.match(mine.text, /내 담당 채널 성과/);
  const historic = await f.json('admin', '/api/analytics?scope=all&start=2026-09-30&end=2026-09-30&growth=1&ownerId=' + f.users.member.id);
  assert.equal(historic.growth.metrics.views.week.current.delta, null, 'explicit historical attribution retains its stricter handover baseline');
  for (const question of ['그중 우리팀', '저번주만', '다른 크루 성과 알려줘', '2026-09-01부터 2026-09-30까지 내 성과', '2099-01-01 내 조회수', '내일 내 조회수 예측해줘', '다음 주 성과는?']) {
    const response = await f.ask('member', question); assert.equal(response.intent, 'unsupported'); assert.equal(response.data, undefined);
  }
  const empty = await f.ask('peer', '2026-01-01 내 조회수'); assert.equal(empty.data.metrics?.total ?? null, null); assert.doesNotMatch(empty.text, /누적 0/);
});

test('new content uses the same weekly zero baseline as the marketing home without inventing a previous-period comparison', async t => {
  const f = await fixture(t), post = f.app.store.get('posts', 'member-channel');
  f.app.store.put('posts', post.id, { ...post, publishedDate: '2026-09-29', publishedAt: '2026-09-29T09:00:00+09:00' });
  f.app.store.remove('ownershipEvents', 'ownership-member-channel');
  for (const row of f.app.store.all('snapshots').filter(row => row.postId === post.id)) {
    if (row.date < '2026-09-29') f.app.store.remove('snapshots', row.id);
    else f.app.store.put('snapshots', row.id, { ...row, views: row.date === '2026-09-29' ? 100 : 160, ownership: { known: true, ownerIds: [f.users.member.id], teamId: 'team-a' } });
  }
  const response = await f.ask('member', '이번 주 내 조회수 보여줘');
  const report = await f.json('member', '/api/analytics?scope=mine&start=2026-09-30&end=2026-09-30&growth=1');
  assert.equal(report.growth.metrics.views.week.current.delta, 160);
  assert.equal(response.data.metrics.delta, report.growth.metrics.views.week.current.delta); assert.equal(response.data.metrics.total, 160); assert.equal(response.data.metrics.complete, true);
  assert.equal(response.data.metrics.comparable, false); assert.equal(response.data.metrics.previousDelta, null); assert.match(response.text, /기간 증감 \+160/); assert.match(response.text, /전주 같은 기간과의 비교는 아직 확인할 수 없어요/);
});

test('crew and room actions use current membership and expose no private rooms, credentials, or data mutations', async t => {
  const f = await fixture(t);
  const publicRoom = (await f.json('admin', '/messenger/api/channels', 'POST', { name: '가을 캠페인', category: 'project', scope: 'public' }, 201)).channel;
  const secret = (await f.json('admin', '/messenger/api/channels', 'POST', { name: '숨긴 프로젝트', category: 'project' }, 201)).channel;
  const before = f.app.messenger.db.prepare('SELECT COUNT(*) n FROM channels').get().n;
  const person = await f.ask('admin', '검증 동료랑 얘기하고 싶어'); assert.equal(person.intent, 'people'); assert.equal(person.actions[0].userId, f.boot.member.user.id); assert.doesNotMatch(JSON.stringify(person), /member@example|password|companyUserId/);
  const room = await f.ask('member', '가을 캠페인 방 열어줘'); assert.equal(room.actions[0].channelId, publicRoom.id);
  const blocked = await f.ask('member', '숨긴 프로젝트 방 열어줘'); assert.equal(blocked.actions.some(action => action.channelId === secret.id), false); assert.doesNotMatch(blocked.text, /숨긴 프로젝트/);
  const announcement = await f.ask('viewer', '공지방 열어줘'); assert.equal(announcement.actions[0].channelId, f.boot.viewer.channels.find(c => c.systemKey === 'announcements').id);
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) n FROM channels').get().n, before, 'person navigation must not create DMs');
  await f.json('member', `/messenger/api/channels/${publicRoom.id}/leave`, 'POST', {});
  assert.equal((await f.ask('member', '가을 캠페인 방 열어줘')).actions.some(action => action.channelId === publicRoom.id), false);
  f.app.store.put('users', f.users.peer.id, { ...f.users.peer, active: false });
  assert.equal((await f.ask('admin', '다른 크루와 대화')).actions.some(action => action.userId === f.boot.peer.user.id), false);
});

test('actual file and assigned-task search returns at most three authorized titles and routes without message bodies', async t => {
  const f = await fixture(t), publicRoom = f.boot.admin.channels.find(c => c.systemKey === 'social');
  const hidden = (await f.json('admin', '/messenger/api/channels', 'POST', { name: '숨긴 자료방', category: 'project' }, 201)).channel;
  async function attach(room, name) {
    const file = (await f.json('admin', `/messenger/api/channels/${room}/files`, 'POST', Buffer.from('file payload'), 201, { 'X-File-Name': encodeURIComponent(name) })).file;
    return (await f.json('admin', `/messenger/api/channels/${room}/messages`, 'POST', { body: '절대 요약에 들어가지 않을 본문', fileIds: [file.id] }, 201)).message;
  }
  const shared = await attach(publicRoom.id, '기획서 안내.pdf'); await attach(hidden.id, '기획서 비밀.pdf');
  await f.json('admin', `/messenger/api/messages/${shared.id}/task`, 'POST', { title: '기획서 검토', assigneeId: f.boot.member.user.id, dueDate: '2026-10-01' }, 201);
  const files = await f.ask('member', '기획서 파일 찾아줘'); assert.equal(files.intent, 'files'); assert.equal(files.actions.length, 1); assert.equal(files.actions[0].fileId, shared.files[0].id); assert.equal(files.actions[0].messageId, shared.id); assert.doesNotMatch(JSON.stringify(files), /비밀|절대 요약|payload/);
  const exact = await f.ask('member', '안내 파일 찾아줘'); assert.equal(exact.data.query, '안내'); assert.equal(exact.actions.length, 1);
  const literal = await attach(publicRoom.id, '예산 100%_최종.pdf');
  await attach(publicRoom.id, '예산 1000X최종.pdf');
  const wildcard = await f.ask('member', '100%_ 파일 찾아줘'); assert.equal(wildcard.actions.length, 1); assert.equal(wildcard.actions[0].fileId, literal.files[0].id, 'SQL wildcard characters are literal filename text');
  const task = await f.ask('member', '내 할 일 보여줘'); assert.equal(task.intent, 'tasks'); assert.equal(task.actions.length, 1); assert.equal(task.actions[0].messageId, shared.id); assert.match(task.text, /기획서 검토/); assert.doesNotMatch(task.text, /절대 요약/);
  assert.equal((await f.ask('peer', '내 할 일 보여줘')).data.count, 0);
  for (let i = 0; i < 4; i++) await attach(publicRoom.id, `기획서 ${i}.pdf`);
  const many = await f.ask('member', '기획서 파일 찾아줘'); assert.equal(many.actions.length, 3); assert.equal(many.data.hasMore, true);
  const none = await f.ask('member', '없는파일명 파일 찾아줘'); assert.equal(none.data.count, 0); assert.match(none.text, /찾지 못했/);
  const deleted = (await f.json('admin', '/messenger/api/channels', 'POST', { name: '삭제할 개인 프로젝트', category: 'project', memberIds: [f.boot.member.user.id] }, 201)).channel;
  await attach(deleted.id, '보관전용 자료.pdf');
  assert.equal((await f.ask('member', '보관전용 파일 찾아줘')).data.count, 1);
  await f.json('admin', `/messenger/api/channels/${deleted.id}`, 'DELETE');
  assert.equal((await f.ask('member', '보관전용 파일 찾아줘')).data.count, 0, 'deleted private rooms cannot leak file names through assistant search');
  const content = await f.ask('member', '콘텐츠 기획하고 싶어'); assert.deepEqual(content.actions[0], { type: 'marketing', label: '콘텐츠 기획 열기', view: 'content', section: 'plan' });
  const collect = await f.ask('member', '채널 수집해줘'); assert.deepEqual(collect.actions[0], { type: 'marketing', label: '채널 수집 열기', view: 'channels' }); assert.equal(f.app.store.all('runs').length, 0);
});

test('assistant validates input, CSRF, current login and a session revoked while its request body is arriving', async t => {
  const f = await fixture(t);
  for (const body of [{}, { message: '' }, { message: 5 }, { message: 'x'.repeat(1001) }, { message: 'bad\u0000text' }]) await f.json('member', '/api/assistant', 'POST', body, 400);
  await f.json('member', '/api/assistant', 'POST', { message: '내 성과' }, 403, { 'X-CSRF-Token': 'bad' });
  await f.json('member', '/api/assistant', 'POST', { message: '내 성과' }, 403, { Origin: 'https://invalid.example' });
  await f.json('member', '/api/assistant', 'POST', { message: '내 성과' }, 403, { Cookie: '' });
  const payload = Buffer.from(JSON.stringify({ message: '내 성과' }));
  // Wait until authenticated body consumption, not merely the HTTP request event:
  // identity validation may yield before the body parser is entered.
  const entered = new Promise(resolve => f.app.server.once('request', incoming => {
    const iterator = incoming.iterator.bind(incoming);
    incoming.iterator = (...args) => { resolve(); return iterator(...args); };
  }));
  let req;
  const pending = new Promise((resolve, reject) => { req = httpRequest(f.base + '/api/assistant', { method: 'POST', headers: { ...f.headers('member'), 'Content-Type': 'application/json', 'Content-Length': payload.length } }, res => { let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) })); }); req.on('error', reject); req.write(payload.subarray(0, 6)); });
  await entered; f.app.store.revokeUser(f.users.member.id); req.end(payload.subarray(6)); const refused = await pending; assert.equal(refused.status, 401); assert.equal(refused.body.data, undefined);
  assert.equal(f.app.store.all('audit').length, 0); assert.equal(f.externalCalls, 0);
});

test('an explicitly linked legacy account without a team can query the assistant using its existing login', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'synk-assistant-legacy-')), companyDir = join(directory, 'company'), messengerDir = join(directory, 'messenger');
  const drive = { active: async () => null, status: async () => ({ provider: 'local' }) }, password = 'legacy-assistant-fixture-password';
  let app, store;
  t.after(async () => { if (app) await app.stop(); else store?.close(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true }); });
  const standalone = createMessenger({ dataDir: messengerDir, port: 0, driveStorage: drive });
  let previous;
  try {
    const { url } = await standalone.listen();
    const response = await fetch(url + '/api/setup', { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceName: '기존 테스트 회사', name: '기존 관리자', username: 'legacyadmin', password }) });
    assert.equal(response.status, 201); previous = await response.json();
  } finally { await standalone.close(); }
  store = new Store(companyDir);
  const user = store.createUser({ name: '기존 관리자', email: 'founder@example.test', role: 'admin' });
  delete user.teamId; store.put('users', user.id, user); // An older persisted founder did not have the later optional team field.
  app = createCompanyApp({ store, dataDir: companyDir, port: 0, allowTestHost: true, schedule: false, messengerDataDir: messengerDir, messengerIdentityLinks: [{ companyUserId: user.id, messengerUserId: previous.user.id }], messengerDriveStorage: drive });
  const address = await app.start(), base = `http://127.0.0.1:${address.port}`;
  const login = await fetch(base + '/api/login', { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'legacyadmin', password }) });
  assert.equal(login.status, 200); const loggedIn = await login.json(), cookie = login.headers.getSetCookie()[0].split(';')[0];
  const headers = { Cookie: cookie, Origin: app.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': loggedIn.csrfToken };
  const bootstrap = await fetch(base + '/messenger/api/bootstrap', { headers }); assert.equal(bootstrap.status, 200); assert.equal((await bootstrap.json()).user.id, previous.user.id);
  async function ask(message) { const response = await fetch(base + '/api/assistant', { method: 'POST', headers, body: JSON.stringify({ message }) }), data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data; }
  for (const question of ['이번 주 내 조회수 보여줘', '우리 팀 이번 주 조회수', '전체 성과 알려줘']) {
    const data = await ask(question); assert.equal(data.intent, 'performance'); assert.equal(data.data.channelCount, 0); assert.match(data.text, /조회할 채널이 없어요/);
  }
  assert.equal((await ask('내 할 일 보여줘')).data.count, 0); assert.equal((await ask('기획서 파일 찾아줘')).data.count, 0);
  assert.equal((await ask('공지방 열어줘')).actions[0].channelId, previous.channels.find(channel => channel.systemKey === 'announcements').id);
  for (const teamId of [null, 'removed-team']) { store.put('users', user.id, { ...user, teamId }); assert.equal((await ask('이번 주 내 조회수')).data.channelCount, 0); }
  assert.equal(app.messenger.db.prepare('SELECT COUNT(*) n FROM users').get().n, 1, 'queries must preserve the explicitly linked messenger identity');
});
