import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request } from 'node:http';
import { Readable } from 'node:stream';
import { Store } from './store.mjs';
import { createCompanyApp } from './server.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';

const password = 'company-integration-test-password';
const localDrive = {
  active: async () => null,
  status: async () => ({ provider: 'local', activeConnectionId: null, connections: [], status: 'local', account: null, error: null, verifiedAt: null }),
  setActive: async id => { assert.equal(id, null); return localDrive.status(); },
  upload: async () => assert.fail('Tests must not access real Drive'),
  download: async () => assert.fail('Tests must not access real Drive'),
  trash: async () => assert.fail('Tests must not access real Drive'),
};

test('external messenger document navigation loads only the public shell while cross-site APIs and frames stay blocked', async t => {
  const fx = await fixture(t), visitor = await fx.client(null);
  const navigation = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
  // fetch sets Sec-Fetch-Mode: cors itself. Preserve the browser navigation
  // metadata with an actual HTTP request instead.
  const navigate = (path, headers) => new Promise((resolve, reject) => {
    const outgoing = request(new URL(path, fx.base), { headers }, incoming => {
      const chunks = [];
      incoming.on('data', chunk => chunks.push(chunk));
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, text: Buffer.concat(chunks).toString('utf8') }));
      incoming.on('error', reject);
    });
    outgoing.on('error', reject); outgoing.end();
  });
  const page = await navigate('/messenger/', navigation);
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /text\/html/);
  assert.match(page.text, /id="app"/);
  assert.equal((await navigate('/messenger/api/bootstrap', navigation)).status, 403);
  for (const headers of [
    { ...navigation, 'sec-fetch-dest': 'iframe' },
    { ...navigation, 'sec-fetch-mode': 'cors' },
    { ...navigation, Origin: 'https://unrelated.example.test' },
  ]) assert.equal((await navigate('/messenger/', headers)).status, 403);
  const employee = await fx.client();
  await employee.denied('/messenger/api/bootstrap', { headers: navigation }, 403);
  await employee.denied('/messenger/api/channels', { method: 'POST', body: { name: 'cross-site' }, headers: { ...navigation, Origin: fx.app.origin } }, 403);
});

test('platform preview navigation shares the configured entry without authorizing company or messenger access', async t => {
  const fx = await fixture(t);
  const visitor = await fx.client(null);
  const me = await visitor.json('/api/me');
  assert.equal(me.platformUrl, 'http://127.0.0.1:4280/synk-account/platform.html');
  assert.equal(me.user, null);
  await visitor.denied('/messenger/api/bootstrap', undefined, 401);
  const employee = await fx.client();
  const messenger = await employee.json('/messenger/api/bootstrap');
  assert.equal(messenger.platformUrl, me.platformUrl);
});

async function legacyWorkspace(dataDir) {
  const app = createMessenger({ dataDir, port: 0, driveStorage: localDrive });
  const { url } = await app.listen();
  try {
    const setup = await fetch(url + '/api/setup', { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceName: '기존 메신저', name: '중복 이름', username: 'legacyowner', password }) });
    assert.equal(setup.status, 201);
    const cookie = setup.headers.getSetCookie()[0].split(';', 1)[0];
    const state = await setup.json();
    const self = state.channels.find(c => c.kind === 'self');
    const channel = state.channels.find(c => c.kind === 'channel');
    const upload = await fetch(url + `/api/channels/${self.id}/files`, { method: 'POST', headers: { Origin: url, Cookie: cookie, 'X-File-Name': encodeURIComponent('이전 메모.txt'), 'Content-Type': 'application/octet-stream' }, body: Buffer.from('이전 첨부파일 원문') });
    const file = (await upload.json()).file;
    const send = await fetch(url + `/api/channels/${self.id}/messages`, { method: 'POST', headers: { Origin: url, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: '이전 계정의 비공개 메모', fileIds: [file.id] }) });
    const message = (await send.json()).message;
    const counts = app.db.prepare('SELECT (SELECT COUNT(*) FROM messages) AS messages,(SELECT COUNT(*) FROM files) AS files').get();
    return { user: state.user, self, channel, file, message, cookie, counts };
  } finally { await app.close(); }
}

async function fixture(t, { legacy = false, link = true, driveStorage = localDrive } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-company-messenger-test-'));
  const companyDir = join(dir, 'company');
  const messengerDir = join(dir, 'messenger');
  const previous = legacy ? await legacyWorkspace(messengerDir) : null;
  const store = new Store(companyDir);
  const users = {
    admin: store.createUser({ name: '중복 이름', email: 'admin@example.test', password, role: 'admin' }),
    otherAdmin: store.createUser({ name: '다른 관리자', email: 'other-admin@example.test', password, role: 'admin' }),
    member: store.createUser({ name: '담당자', email: 'member@example.test', password, role: 'member' }),
    peer: store.createUser({ name: '동료', email: 'peer@example.test', password, role: 'member' }),
    viewer: store.createUser({ name: '열람자', email: 'viewer@example.test', password, role: 'viewer' }),
  };
  const links = previous && link ? [{ companyUserId: users.admin.id, messengerUserId: previous.user.id }] : [];
  let app = createCompanyApp({ store, dataDir: companyDir, port: 0, allowTestHost: true, schedule: false, messengerDataDir: messengerDir, messengerIdentityLinks: links, messengerDriveStorage: driveStorage });
  let address = await app.start();
  const controllers = [];
  const pendingRequests = [];
  const fx = {
    dir, companyDir, messengerDir, users, previous,
    get app() { return app; },
    get base() { return `http://127.0.0.1:${address.port}`; },
    async restart() {
      controllers.forEach(controller => controller.abort());
      await app.stop();
      app = createCompanyApp({ dataDir: companyDir, port: 0, allowTestHost: true, schedule: false, messengerDataDir: messengerDir, messengerIdentityLinks: links, messengerDriveStorage: driveStorage });
      address = await app.start();
    },
    async client(user = users.admin) {
      const client = {
        cookie: '', csrf: '',
        async raw(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
          const allHeaders = { Cookie: client.cookie, ...(method === 'GET' ? {} : { Origin: app.origin, 'X-CSRF-Token': client.csrf }), ...headers };
          if (body !== undefined && !(body instanceof Uint8Array)) { body = JSON.stringify(body); allHeaders['Content-Type'] = 'application/json'; }
          const response = await fetch(fx.base + path, { method, headers: allHeaders, body, signal: AbortSignal.timeout(6000), ...rest });
          const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith('synk_company_session='));
          if (sessionCookie) client.cookie = sessionCookie.split(';', 1)[0];
          return response;
        },
        async json(path, options) {
          const response = await client.raw(path, options);
          const data = await response.json();
          assert.ok(response.ok, `${options?.method || 'GET'} ${path}: ${response.status} ${JSON.stringify(data)}`);
          if (data.csrfToken) client.csrf = data.csrfToken;
          return data;
        },
        async denied(path, options, expected) {
          const response = await client.raw(path, options);
          const data = await response.json();
          assert.ok(response.status >= 400 && response.status < 500, `${options?.method || 'GET'} ${path}: expected refusal, got ${response.status} ${JSON.stringify(data)}`);
          if (expected) assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
          return data;
        },
      };
      if (user) await client.json('/api/login', { method: 'POST', body: { email: user.email, password } });
      return client;
    },
    async events(client) {
      const controller = new AbortController();
      controllers.push(controller);
      const response = await client.raw('/messenger/api/events', { signal: controller.signal });
      assert.equal(response.status, 200);
      const events = [];
      let ended = false, buffer = '';
      const reading = (async () => {
        try {
          for await (const bytes of response.body) {
            buffer += Buffer.from(bytes).toString();
            let end;
            while ((end = buffer.indexOf('\n\n')) >= 0) {
              const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
              if (!frame.includes('event: update')) continue;
              const line = frame.split('\n').find(x => x.startsWith('data:'));
              if (line) events.push(JSON.parse(line.slice(5)));
            }
          }
        } catch (error) { if (!controller.signal.aborted) throw error; }
        finally { ended = true; }
      })();
      return { events, get ended() { return ended; }, async close() { controller.abort(); await reading; } };
    },
    async partial(client, path, body, { method = 'POST', headers = {} } = {}) {
      const wire = body instanceof Uint8Array ? Buffer.from(body) : Buffer.from(JSON.stringify(body));
      let req;
      let began;
      const started = new Promise(resolve => { began = resolve; });
      const original = app.store.readToken.bind(app.store);
      app.store.readToken = (...args) => { const result = original(...args); if (args[0] === client.cookie.split('=', 2)[1] && args[1] === 'session') began(); return result; };
      const finished = new Promise((resolve, reject) => {
        req = request(fx.base + path, { method, headers: { Cookie: client.cookie, Origin: app.origin, 'X-CSRF-Token': client.csrf, 'Content-Type': 'application/json', 'Content-Length': String(wire.length), ...headers } }, response => {
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('Partial request timed out')));
        req.write(wire.subarray(0, 1));
      });
      pendingRequests.push(req);
      await started;
      app.store.readToken = original;
      return { finish() { req.end(wire.subarray(1)); return finished; } };
    },
  };
  t.after(async () => {
    controllers.forEach(controller => controller.abort());
    pendingRequests.forEach(req => req.destroy());
    await app.stop();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-company-messenger-test-'));
    await rm(dir, { recursive: true, force: true });
  });
  return fx;
}

const send = (client, channelId, body, fileIds = []) => client.json(`/messenger/api/channels/${channelId}/messages`, { method: 'POST', body: { body, fileIds } });
const upload = (client, channelId, name = '통합 확인.html', data = '<script>not executable</script>') => client.json(`/messenger/api/channels/${channelId}/files`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) }, body: Buffer.from(data) });
const waitUntil = async (condition, message) => {
  const end = Date.now() + 3000;
  while (Date.now() < end) { if (await condition()) return; await new Promise(resolve => setTimeout(resolve, 15)); }
  assert.fail(message);
};

function seedTeams(fx) {
  const teams = [{ id: 'marketing-team', name: '마케팅팀', active: true }, { id: 'design-team', name: '디자인팀', active: true }];
  for (const team of teams) fx.app.store.put('teams', team.id, team);
  for (const key of ['member', 'peer', 'viewer']) fx.app.store.put('users', fx.users[key].id, { ...fx.app.store.get('users', fx.users[key].id), teamId: teams[0].id });
  fx.app.store.put('users', fx.users.otherAdmin.id, { ...fx.app.store.get('users', fx.users.otherAdmin.id), teamId: teams[1].id });
  return teams;
}

test('explicit company identity linking preserves legacy private history, attachments and cookies across restart', async t => {
  const fx = await fixture(t, { legacy: true });
  const admin = await fx.client();
  assert.match(admin.cookie, /^synk_company_session=/);
  assert.match(fx.previous.cookie, /^synk_messenger_session=/);
  const state = await admin.json('/messenger/api/bootstrap');
  assert.equal(state.user.id, fx.previous.user.id);
  assert.equal(state.integrated.companyUserId, fx.users.admin.id);
  assert.equal(state.integrated.csrfToken, admin.csrf);
  assert.equal(state.integrated.canWrite, true);
  assert.equal(state.integrated.canManage, true);
  const history = await admin.json(`/messenger/api/channels/${fx.previous.self.id}/messages`);
  assert.equal(history.messages[0].id, fx.previous.message.id);
  assert.equal(history.messages[0].body, '이전 계정의 비공개 메모');
  assert.equal(history.messages[0].files[0].url, `/messenger/api/files/${fx.previous.file.id}`);
  const file = await admin.raw(history.messages[0].files[0].url);
  assert.equal(await file.text(), '이전 첨부파일 원문');
  const companyId = (await admin.json('/api/me')).user.id;
  assert.equal(companyId, fx.users.admin.id);
  await fx.restart();
  const reloaded = await admin.json('/messenger/api/bootstrap');
  assert.equal(reloaded.user.id, fx.previous.user.id);
  assert.equal(reloaded.channels.filter(c => c.kind === 'self').length, 1);
  assert.equal((await admin.json(`/messenger/api/channels/${fx.previous.self.id}/messages`)).messages.length, 1);
  const guest = await fx.client(null);
  await guest.denied('/messenger/api/bootstrap', { headers: { Cookie: fx.previous.cookie } }, 401);
  // Company /api/me intentionally returns {user:null} for a signed-out visitor.
  assert.equal((await guest.json('/api/me', { headers: { Cookie: fx.previous.cookie } })).user, null);
});

test('matching names never link legacy users and a different company administrator cannot read private content', async t => {
  const fx = await fixture(t, { legacy: true, link: false });
  const admin = await fx.client();
  const sameName = await admin.json('/messenger/api/bootstrap');
  assert.notEqual(sameName.user.id, fx.previous.user.id);
  assert.equal(sameName.channels.some(c => c.id === fx.previous.self.id), false);
  await admin.denied(`/messenger/api/channels/${fx.previous.self.id}/messages`, undefined, 404);
  await admin.denied(`/messenger/api/files/${fx.previous.file.id}`, undefined, 404);
  const people = await Promise.all([fx.client(fx.users.member), fx.client(fx.users.peer), fx.client(fx.users.otherAdmin)]);
  const [member, peer, otherAdmin] = people;
  const peerState = await peer.json('/messenger/api/bootstrap');
  const { channel } = await member.json('/messenger/api/dms', { method: 'POST', body: { userId: peerState.user.id } });
  const file = (await upload(member, channel.id)).file;
  const message = (await send(member, channel.id, '비공개 DM 고유 문구', [file.id])).message;
  for (const privileged of [admin, otherAdmin]) {
    assert.equal((await privileged.json('/messenger/api/channels')).channels.some(c => c.id === channel.id), false);
    await privileged.denied(`/messenger/api/channels/${channel.id}/messages`, undefined, 404);
    await privileged.denied(`/messenger/api/files/${file.id}`, undefined, 404);
    await privileged.denied(`/messenger/api/messages/${message.id}`, { method: 'DELETE' }, 404);
    assert.equal((await privileged.json('/messenger/api/search?q=' + encodeURIComponent('비공개 DM 고유 문구'))).messages.length, 0);
    assert.equal((await privileged.json('/messenger/api/files')).files.some(f => f.id === file.id), false);
  }
});

test('an explicitly linked legacy login stops working after the company account receives its own password', async t => {
  const fx = await fixture(t, { legacy: true });
  const current = fx.app.store.get('users', fx.users.admin.id);
  fx.app.store.put('users', current.id, { ...current, passwordHash: null });
  const legacy = await fx.client(null);
  const loggedIn = await legacy.json('/api/login', { method: 'POST', body: { username: 'legacyowner', password } });
  assert.equal(loggedIn.user.id, fx.users.admin.id);
  assert.equal((await legacy.json('/messenger/api/bootstrap')).user.id, fx.previous.user.id);
  const replacement = 'replacement-company-password-only';
  await legacy.json('/api/account/password', { method: 'POST', body: { password: replacement } });
  await legacy.json('/api/logout', { method: 'POST', body: {} });
  await legacy.denied('/api/login', { method: 'POST', body: { username: 'legacyowner', password } }, 401);
  await legacy.denied('/api/login', { method: 'POST', body: { email: fx.users.admin.email, password } }, 401);
  assert.equal((await legacy.json('/api/login', { method: 'POST', body: { email: fx.users.admin.email, password: replacement } })).user.id, fx.users.admin.id);
});

test('viewer access is read-only while public read markers work and mutations require the shared CSRF token', async t => {
  const fx = await fixture(t);
  const admin = await fx.client();
  const ownerState = await admin.json('/messenger/api/bootstrap');
  const channel = ownerState.channels.find(c => c.kind === 'channel');
  const message = (await send(admin, channel.id, '열람자가 읽을 수 있는 공지')).message;
  const file = (await upload(admin, channel.id)).file;
  await send(admin, channel.id, '공유 자료', [file.id]);
  const viewer = await fx.client(fx.users.viewer);
  const state = await viewer.json('/messenger/api/bootstrap');
  assert.equal(state.integrated.role, 'viewer');
  assert.equal(state.integrated.canWrite, false);
  assert.equal(state.integrated.canManage, false);
  assert.equal((await viewer.json(`/messenger/api/channels/${channel.id}/messages`)).messages.length, 2);
  await viewer.json(`/messenger/api/channels/${channel.id}/read`, { method: 'POST', body: {} });
  const viewedFile = await viewer.raw(`/messenger/api/files/${file.id}`);
  assert.equal(viewedFile.status, 200);
  await viewedFile.arrayBuffer();
  await admin.json(`/messenger/api/messages/${message.id}/pin`, { method: 'POST', body: {} });
  assert.equal((await viewer.json(`/messenger/api/channels/${channel.id}/pins`)).messages[0].id, message.id);
  assert.equal((await viewer.json(`/messenger/api/messages/${message.id}/replies`)).parent.id, message.id);
  for (const [path, method, body] of [
    [`/messenger/api/channels/${channel.id}/messages`, 'POST', { body: 'no write' }],
    [`/messenger/api/channels/${channel.id}/messages`, 'POST', { body: 'no reply', replyToId: message.id }],
    ['/messenger/api/channels', 'POST', { name: 'no channel' }],
    [`/messenger/api/channels/${channel.id}`, 'PATCH', { category: 'project' }],
    ['/messenger/api/dms', 'POST', { userId: ownerState.user.id }],
    [`/messenger/api/messages/${message.id}/reactions`, 'POST', { emoji: '👍' }],
    [`/messenger/api/messages/${message.id}/pin`, 'POST', {}],
    [`/messenger/api/messages/${message.id}/pin`, 'DELETE', undefined],
    [`/messenger/api/messages/${message.id}`, 'PATCH', { body: 'no edit' }],
    [`/messenger/api/messages/${message.id}`, 'DELETE', undefined],
    ['/messenger/api/storage/drive/active', 'POST', { connectionId: null }],
  ]) await viewer.denied(path, { method, body }, 403);
  await viewer.denied(`/messenger/api/channels/${channel.id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'readonly.txt' }, body: Buffer.from('forbidden') }, 403);
  for (const headers of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': 'wrong' }, { Origin: 'https://attacker.example' }]) {
    await admin.denied(`/messenger/api/channels/${channel.id}/messages`, { method: 'POST', headers, body: { body: 'forged write' } }, 403);
    await admin.denied(`/messenger/api/messages/${message.id}/pin`, { method: 'DELETE', headers }, 403);
  }
  assert.equal((await admin.json(`/messenger/api/channels/${channel.id}/pins`)).messages.length, 1);
  assert.equal((await admin.json('/messenger/api/search?q=forged')).messages.length, 0);
  await admin.denied('/messenger/api/setup', { method: 'POST', body: { workspaceName: 'takeover', name: 'name', username: 'name', password } });
  await admin.denied('/messenger/api/login', { method: 'POST', body: { username: 'legacyowner', password } });
  await admin.denied('/messenger/api/join', { method: 'POST', body: { code: 'invented', name: 'name', username: 'name', password } });
  await admin.denied('/messenger/api/invites', { method: 'POST', body: {} });
});

test('logout and employee deactivation revoke both mounted reads and existing SSE streams', async t => {
  const fx = await fixture(t);
  const admin = await fx.client();
  const state = await admin.json('/messenger/api/bootstrap');
  const channel = state.channels.find(c => c.kind === 'channel');
  for (const operation of ['logout', 'deactivate']) {
    const member = await fx.client(fx.users.member);
    await member.json('/messenger/api/bootstrap');
    const stream = await fx.events(member);
    if (operation === 'logout') await member.json('/api/logout', { method: 'POST', body: {} });
    else await admin.json(`/api/members/${fx.users.member.id}/status`, { method: 'POST', body: { active: false } });
    const before = stream.events.length;
    await send(admin, channel.id, `revocation sentinel ${operation}`);
    await waitUntil(() => stream.ended, `${operation} must close the existing mounted event stream`);
    assert.equal(stream.events.length, before, 'a revoked session must not see later events');
    await member.denied('/messenger/api/bootstrap', undefined, 401);
    await member.denied(`/messenger/api/channels/${channel.id}/messages`, undefined, 401);
    await stream.close();
  }
});

test('deactivation after body reception begins cannot commit a message or attachment', async t => {
  const fx = await fixture(t);
  const admin = await fx.client();
  const state = await admin.json('/messenger/api/bootstrap');
  const channel = state.channels.find(c => c.systemKey === 'social');
  for (const operation of ['message', 'upload']) {
    if (operation === 'upload') await admin.json(`/api/members/${fx.users.member.id}/status`, { method: 'POST', body: { active: true } });
    const member = await fx.client(fx.users.member);
    await member.json('/messenger/api/bootstrap');
    const requestPath = `/messenger/api/channels/${channel.id}/${operation === 'message' ? 'messages' : 'files'}`;
    const partial = await fx.partial(member, requestPath, operation === 'message' ? { body: 'revoked pending body' } : Buffer.from('revoked upload body'), operation === 'message' ? {} : { headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'revoked.txt' } });
    await admin.json(`/api/members/${fx.users.member.id}/status`, { method: 'POST', body: { active: false } });
    const response = await partial.finish();
    assert.equal(response.status, 401, `${operation}: ${JSON.stringify(response.data)}`);
  }
  assert.equal((await admin.json('/messenger/api/search?q=revoked')).messages.length, 0);
  assert.equal((await admin.json('/messenger/api/files')).files.length, 0);
  assert.deepEqual(await readdir(join(fx.messengerDir, 'uploads')), []);
});

test('company announcements allow only admins to post while crew and viewers retain their correct read permissions', async t => {
  const fx = await fixture(t), admin = await fx.client();
  const managerUser = fx.app.store.createUser({ name: '합성 매니저', email: 'manager@example.test', password, role: 'manager' });
  const state = await admin.json('/messenger/api/bootstrap'), rooms = Object.fromEntries(state.channels.filter(room => room.systemKey).map(room => [room.systemKey, room]));
  assert.deepEqual(Object.keys(rooms).sort(), ['announcements', 'info', 'social']);
  assert.equal(rooms.announcements.canPost, true);
  const notice = (await send(admin, rooms.announcements.id, '관리자만 게시하는 공지')).message;
  const file = (await upload(admin, rooms.announcements.id, '공지 자료.txt', '전체 크루 열람 자료')).file;
  await send(admin, rooms.announcements.id, '공유 공지 첨부', [file.id]);
  await admin.json(`/messenger/api/messages/${notice.id}`, { method: 'PATCH', body: { body: '수정된 관리자 공지' } });
  await admin.json(`/messenger/api/messages/${notice.id}/pin`, { method: 'POST', body: {} });
  for (const user of [fx.users.member, managerUser, fx.users.viewer]) {
    const client = await fx.client(user), visible = await client.json('/messenger/api/bootstrap');
    const defaults = visible.channels.filter(room => room.systemKey);
    assert.equal(defaults.length, 3); assert.ok(defaults.every(room => room.memberIds.includes(visible.user.id)));
    assert.equal(defaults.find(room => room.systemKey === 'announcements').canPost, false);
    for (const room of defaults.filter(room => room.systemKey !== 'announcements')) assert.equal(room.canPost, user.role !== 'viewer');
    assert.equal((await client.json(`/messenger/api/messages/${notice.id}`)).message.body, '수정된 관리자 공지');
    assert.equal(await (await client.raw(`/messenger/api/files/${file.id}`)).text(), '전체 크루 열람 자료');
    for (const [path, method, body] of [
      [`/messenger/api/channels/${rooms.announcements.id}/messages`, 'POST', { body: '허용되지 않는 게시' }],
      [`/messenger/api/channels/${rooms.announcements.id}/messages`, 'POST', { body: '허용되지 않는 답글', replyToId: notice.id }],
      [`/messenger/api/messages/${notice.id}`, 'PATCH', { body: '허용되지 않는 수정' }],
      [`/messenger/api/messages/${notice.id}/pin`, 'DELETE', undefined],
    ]) await client.denied(path, { method, body }, 403);
    await client.denied(`/messenger/api/channels/${rooms.announcements.id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'blocked.txt' }, body: Buffer.from('forbidden') }, 403);
    if (user.role !== 'viewer') {
      await client.json(`/messenger/api/messages/${notice.id}/reactions`, { method: 'POST', body: { emoji: '👍' } });
      for (const key of ['info', 'social']) await send(client, rooms[key].id, `${user.role} ${key} 자유 대화`);
    } else {
      await client.denied(`/messenger/api/messages/${notice.id}/reactions`, { method: 'POST', body: { emoji: '👍' } }, 403);
      await client.denied(`/messenger/api/channels/${rooms.info.id}/messages`, { method: 'POST', body: { body: '열람자는 일반방도 조회 전용' } }, 403);
    }
  }
  const teams = seedTeams(fx), member = await fx.client(fx.users.member);
  fx.app.store.put('teams', teams[0].id, { ...teams[0], name: '공지' });
  const ownTeam = (await member.json(`/messenger/api/teams/${teams[0].id}/channel`, { method: 'POST', body: {} })).channel;
  assert.equal(ownTeam.name, '공지'); assert.equal(ownTeam.scope, 'team'); assert.equal(ownTeam.systemKey, null); assert.equal(ownTeam.canPost, true);
  await send(member, ownTeam.id, '같은 이름의 소속 팀방은 대화 가능');
  const outsider = await fx.client(fx.users.otherAdmin);
  await outsider.denied(`/messenger/api/channels/${ownTeam.id}/messages`, undefined, 404);
});

test('mounted static assets and file URLs remain under /messenger without exposing source, database or neighboring APIs', async t => {
  const fx = await fixture(t);
  const admin = await fx.client();
  const state = await admin.json('/messenger/api/bootstrap');
  const channel = state.channels.find(c => c.kind === 'channel');
  for (const pathname of ['/messenger/', '/messenger/app.js', '/messenger/styles.css', '/messenger/assets/synk-ko.svg']) {
    const response = await admin.raw(pathname);
    assert.equal(response.status, 200, pathname);
    await response.arrayBuffer();
  }
  const { file } = await upload(admin, channel.id, '../../침투.html');
  assert.equal(file.url, `/messenger/api/files/${file.id}`);
  await send(admin, channel.id, 'HTML 첨부', [file.id]);
  const download = await admin.raw(file.url);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await download.text(), '<script>not executable</script>');
  const signedOut = await fx.client(null);
  await signedOut.denied(file.url, undefined, 401);
  for (const pathname of ['/messenger/api/state', '/messenger/api/storage/../state', '/messenger/server.mjs', '/messenger/data/messenger.sqlite', '/messenger/data/drive-storage.json', '/messenger/%2e%2e%2fserver.mjs', '/messenger/assets/%2e%2e%2f%2e%2e%2fserver.mjs']) {
    const response = await admin.raw(pathname);
    assert.ok([400, 403, 404].includes(response.status), `${pathname} unexpectedly ${response.status}`);
    await response.arrayBuffer();
  }
  const staticResponse = await admin.raw('/messenger/index.html');
  const html = await staticResponse.text();
  assert.equal(/(?:src|href)=["']\/(?:app\.js|styles\.css|assets\/)/.test(html), false, 'mounted shell must resolve assets inside the messenger prefix');
});

test('revocation during a slow storage read cannot return a stale bootstrap or private Drive status', async t => {
  let heldMethod = null, began, release;
  let hold = Promise.resolve();
  const delayedDrive = {
    ...localDrive,
    async active() { if (heldMethod === 'active') { began(); await hold; } return null; },
    async status() { if (heldMethod === 'status') { began(); await hold; } return { ...await localDrive.status(), account: { email: 'private-drive@example.test' } }; },
  };
  const fx = await fixture(t, { driveStorage: delayedDrive });
  t.after(() => release?.());
  for (const [endpoint, method] of [
    ['/messenger/api/bootstrap', 'active'],
    ['/messenger/api/storage', 'status'],
    ['/messenger/api/storage/drive', 'status'],
  ]) {
    heldMethod = null;
    const admin = await fx.client();
    await admin.json('/messenger/api/bootstrap');
    const started = new Promise(resolve => { began = resolve; });
    hold = new Promise(resolve => { release = resolve; });
    heldMethod = method;
    const pending = admin.raw(endpoint);
    await started;
    await admin.json('/api/logout', { method: 'POST', body: {} });
    release();
    const response = await pending;
    const data = await response.json();
    assert.equal(response.status, 401, `${endpoint} returned stale authorized state: ${JSON.stringify(data)}`);
    assert.equal(JSON.stringify(data).includes('private-drive@example.test'), false);
  }
});

test('logout during Drive account verification prevents committing the new storage choice', async t => {
  let release, began, selected = null;
  const hold = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { began = resolve; });
  const delayedDrive = {
    ...localDrive,
    async setActive(connectionId, { beforeCommit } = {}) {
      began();
      await hold;
      beforeCommit?.();
      selected = connectionId;
      return { ...await localDrive.status(), provider: 'google-drive', activeConnectionId: selected };
    },
  };
  const fx = await fixture(t, { driveStorage: delayedDrive });
  t.after(() => release());
  const admin = await fx.client();
  await admin.json('/messenger/api/bootstrap');
  const pending = admin.raw('/messenger/api/storage/drive/active', { method: 'POST', body: { connectionId: 'registered-fake-drive' } });
  await started;
  await admin.json('/api/logout', { method: 'POST', body: {} });
  release();
  const response = await pending;
  assert.equal(response.status, 401);
  await response.arrayBuffer();
  assert.equal(selected, null, 'revoked request must not change the active storage setting');
});

test('unchanged roster reads perform no messenger writes while employee changes remain visible', async t => {
  const fx = await fixture(t);
  const admin = await fx.client();
  const baseline = await admin.json('/messenger/api/bootstrap');
  const changes = () => fx.app.messenger.db.prepare('SELECT total_changes() AS count').get().count;
  const stableReads = async () => {
    const before = changes();
    for (let i = 0; i < 3; i++) {
      await admin.json('/messenger/api/bootstrap');
      await admin.json('/api/workspace-summary');
    }
    assert.equal(changes(), before, 'repeated bootstrap and summary reads must not rewrite an unchanged roster');
  };
  await stableReads();

  const employee = fx.app.store.createUser({ name: '새 직원', email: 'new-staff@example.test', password, role: 'member' });
  const added = await admin.json('/messenger/api/bootstrap');
  assert.equal(added.members.length, baseline.members.length + 1);
  const employeeClient = await fx.client(employee);
  const initial = await employeeClient.json('/messenger/api/bootstrap');
  const identityId = initial.user.id;
  const selfId = initial.channels.find(channel => channel.kind === 'self').id;
  assert.equal(initial.integrated.canManage, false);
  assert.equal(initial.channels.filter(channel => channel.kind === 'channel').length, baseline.channels.filter(channel => channel.kind === 'channel').length);
  await stableReads();

  fx.app.store.put('users', employee.id, { ...fx.app.store.get('users', employee.id), name: '변경된 직원 이름', role: 'admin' });
  const promoted = await employeeClient.json('/messenger/api/bootstrap');
  assert.equal(promoted.user.id, identityId);
  assert.equal(promoted.user.name, '변경된 직원 이름');
  assert.equal(promoted.user.role, 'owner');
  assert.equal(promoted.integrated.canManage, true);
  assert.equal((await admin.json('/messenger/api/members')).members.find(member => member.id === identityId).name, '변경된 직원 이름');
  await stableReads();

  fx.app.store.put('users', employee.id, { ...fx.app.store.get('users', employee.id), active: false });
  assert.equal((await admin.json('/messenger/api/bootstrap')).members.some(member => member.id === identityId), false);
  await employeeClient.denied('/messenger/api/bootstrap', undefined, 401);
  await stableReads();

  fx.app.store.put('users', employee.id, { ...fx.app.store.get('users', employee.id), active: true, role: 'viewer' });
  const restored = await employeeClient.json('/messenger/api/bootstrap');
  assert.equal(restored.user.id, identityId);
  assert.equal(restored.integrated.canWrite, false);
  assert.equal(restored.integrated.canManage, false);
  assert.deepEqual(restored.channels.filter(channel => channel.kind === 'self').map(channel => channel.id), [selfId]);
  assert.equal((await admin.json('/messenger/api/bootstrap')).members.length, added.members.length);
  await stableReads();
});

test('the active employee directory exposes team roles without emails and team rooms exclude other teams and unrelated admins', async t => {
  const fx = await fixture(t);
  const admin = await fx.client();
  assert.deepEqual((await admin.json('/messenger/api/directory')).teams, []);
  const [teamA, teamB] = seedTeams(fx);
  const member = await fx.client(fx.users.member), peer = await fx.client(fx.users.peer), viewer = await fx.client(fx.users.viewer);
  const outsider = await fx.client(fx.users.otherAdmin);
  const state = await member.json('/messenger/api/bootstrap');
  assert.equal(state.user.teamId, teamA.id);
  assert.equal(state.user.teamName, teamA.name);
  assert.equal(state.user.companyRole, 'member');
  assert.equal(state.teams.find(team => team.id === teamA.id).memberCount, 3);
  assert.equal(state.teams.find(team => team.id === teamB.id).canOpen, false);
  assert.equal(state.teams.find(team => team.id === teamB.id).channelId, null);
  const directory = await admin.json('/messenger/api/directory');
  assert.equal(directory.members.length, 5);
  assert.ok(directory.members.every(user => !Object.hasOwn(user, 'email') && !Object.hasOwn(user, 'passwordHash')));
  assert.ok(!JSON.stringify(directory).includes('@example.test'));
  const publicRoom = (await admin.json('/messenger/api/channels', { method: 'POST', body: { name: '기존 팀 분류 공개방', category: 'team' } })).channel;
  assert.equal(publicRoom.scope, 'public');
  assert.equal(publicRoom.teamId, null);
  assert.equal(publicRoom.memberIds.length, 5);
  const outsiderEvents = await fx.events(outsider);
  const teamRoom = (await member.json(`/messenger/api/teams/${teamA.id}/channel`, { method: 'POST', body: {} })).channel;
  assert.equal(teamRoom.scope, 'team');
  assert.equal(teamRoom.teamId, teamA.id);
  assert.equal(teamRoom.canManage, false);
  assert.equal(teamRoom.memberIds.length, 3);
  assert.equal((await peer.json(`/messenger/api/teams/${teamA.id}/channel`, { method: 'POST', body: {} })).channel.id, teamRoom.id);
  await member.denied(`/messenger/api/channels/${teamRoom.id}`, { method: 'PATCH', body: { name: '임의 변경' } }, 403);
  for (const other of [admin, outsider]) await other.denied(`/messenger/api/teams/${teamA.id}/channel`, { method: 'POST', body: {} }, 404);
  const file = (await upload(member, teamRoom.id, '팀전용-기밀.txt', '비공개 첨부 원문')).file;
  const parent = (await send(member, teamRoom.id, '팀전용-기밀 원문', [file.id])).message;
  await peer.json(`/messenger/api/channels/${teamRoom.id}/messages`, { method: 'POST', body: { body: '팀전용-기밀 답글', replyToId: parent.id } });
  await peer.json(`/messenger/api/messages/${parent.id}/pin`, { method: 'POST', body: {} });
  assert.equal((await viewer.json(`/messenger/api/channels/${teamRoom.id}/pins`)).messages[0].id, parent.id);
  assert.equal((await viewer.json(`/messenger/api/messages/${parent.id}/replies`)).messages.length, 1);
  await viewer.denied(`/messenger/api/teams/${teamA.id}/channel`, { method: 'POST', body: {} }, 403);
  for (const other of [admin, outsider]) {
    for (const path of [`/messenger/api/channels/${teamRoom.id}/messages`, `/messenger/api/channels/${teamRoom.id}/pins`, `/messenger/api/messages/${parent.id}`, `/messenger/api/messages/${parent.id}/replies`, `/messenger/api/files/${file.id}`]) await other.denied(path, undefined, 404);
    assert.deepEqual((await other.json('/messenger/api/search?q=' + encodeURIComponent('팀전용-기밀'))).messages, []);
    assert.deepEqual((await other.json('/messenger/api/files?q=' + encodeURIComponent('팀전용-기밀'))).files, []);
    assert.equal((await other.json('/messenger/api/storage')).fileCount, 0);
    await other.denied(`/messenger/api/messages/${parent.id}/pin`, { method: 'POST', body: {} }, 404);
    await other.denied(`/messenger/api/channels/${teamRoom.id}/messages`, { method: 'POST', body: { body: '침입' } }, 404);
  }
  await send(member, publicRoom.id, '공개 이벤트 확인');
  await waitUntil(() => outsiderEvents.events.some(event => event.channelId === publicRoom.id), 'public channel event must arrive');
  assert.equal(outsiderEvents.events.some(event => event.channelId === teamRoom.id), false);
  const direct = (await admin.json('/messenger/api/dms', { method: 'POST', body: { userId: state.user.id } })).channel;
  assert.equal(direct.kind, 'dm');
  assert.equal(direct.scope, 'private');
  assert.equal(direct.teamId, null);
});

test('team transfers, deactivation and departure revoke all old-room access and SSE while retaining history for remaining members', async t => {
  const fx = await fixture(t);
  const [teamA, teamB] = seedTeams(fx);
  const admin = await fx.client(), member = await fx.client(fx.users.member), peer = await fx.client(fx.users.peer);
  const teamRoom = (await member.json(`/messenger/api/teams/${teamA.id}/channel`, { method: 'POST', body: {} })).channel;
  const file = (await upload(member, teamRoom.id, '이동전 팀파일.txt', 'preserved')).file;
  const parent = (await send(member, teamRoom.id, '이동전 팀기록', [file.id])).message;
  await member.json(`/messenger/api/messages/${parent.id}/pin`, { method: 'POST', body: {} });
  const stream = await fx.events(peer);
  fx.app.store.put('users', fx.users.peer.id, { ...fx.app.store.get('users', fx.users.peer.id), teamId: teamB.id });
  await admin.json('/api/me');
  await waitUntil(() => stream.ended, 'a transferred member must lose the old SSE subscription');
  for (const path of [`/messenger/api/channels/${teamRoom.id}/messages`, `/messenger/api/channels/${teamRoom.id}/pins`, `/messenger/api/messages/${parent.id}`, `/messenger/api/messages/${parent.id}/replies`, `/messenger/api/files/${file.id}`]) await peer.denied(path, undefined, 404);
  assert.deepEqual((await peer.json('/messenger/api/search?q=' + encodeURIComponent('이동전'))).messages, []);
  assert.deepEqual((await peer.json('/messenger/api/files?q=' + encodeURIComponent('이동전'))).files, []);
  assert.equal((await peer.json('/messenger/api/bootstrap')).channels.some(channel => channel.id === teamRoom.id), false);
  const next = (await peer.json(`/messenger/api/teams/${teamB.id}/channel`, { method: 'POST', body: {} })).channel;
  assert.notEqual(next.id, teamRoom.id);
  const newcomer = fx.app.store.createUser({ email: 'new-team@example.test', name: '신규 직원', password, role: 'member', teamId: teamA.id });
  const joined = await fx.client(newcomer);
  assert.equal((await joined.json(`/messenger/api/channels/${teamRoom.id}/messages`)).messages[0].id, parent.id);
  fx.app.store.put('users', newcomer.id, { ...fx.app.store.get('users', newcomer.id), teamId: null });
  await joined.denied(`/messenger/api/files/${file.id}`, undefined, 404);
  const activeStream = await fx.events(member);
  fx.app.store.put('teams', teamA.id, { ...teamA, active: false });
  await admin.json('/api/me');
  await waitUntil(() => activeStream.ended, 'a deactivated team must revoke its existing SSE subscribers');
  await member.denied(`/messenger/api/channels/${teamRoom.id}/messages`, undefined, 404);
  assert.equal((await admin.json('/messenger/api/directory')).teams.some(team => team.id === teamA.id), false);
  fx.app.store.put('teams', teamA.id, { ...teamA, name: '새 마케팅팀' });
  const restored = await member.json('/messenger/api/bootstrap');
  assert.equal(restored.channels.find(channel => channel.id === teamRoom.id).name, '새 마케팅팀');
  assert.equal(await (await member.raw(`/messenger/api/files/${file.id}`)).text(), 'preserved');
  fx.app.store.put('users', fx.users.member.id, { ...fx.app.store.get('users', fx.users.member.id), active: false });
  await admin.json('/api/me');
  await member.denied(`/messenger/api/files/${file.id}`, undefined, 401);
  const directory = await admin.json('/messenger/api/directory');
  assert.equal(directory.members.some(user => user.name === fx.users.member.name), false);
  const memberLink = fx.app.messenger.db.prepare('SELECT messenger_user_id FROM company_identity_links WHERE company_user_id=?').get(fx.users.member.id);
  assert.equal(fx.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM memberships WHERE channel_id=? AND user_id=?').get(teamRoom.id, memberLink.messenger_user_id).n, 0);
  assert.equal(fx.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE id=?').get(parent.id).n, 1);
  await fx.restart();
  const remainingViewer = await fx.client(fx.users.viewer);
  assert.equal((await remainingViewer.json(`/messenger/api/channels/${teamRoom.id}/pins`)).messages[0].id, parent.id);
  assert.equal(await (await remainingViewer.raw(`/messenger/api/files/${file.id}`)).text(), 'preserved');
});

test('moving teams during a delayed message, pin or file request cannot commit or return old-team content', async t => {
  let releaseDownload, beganDownload;
  const downloadStarted = new Promise(resolve => { beganDownload = resolve; });
  const drive = {
    ...localDrive,
    active: async () => ({ id: 'fixture-drive' }),
    upload: async ({ md5, fileId }) => ({ remoteId: 'remote-' + fileId, connectionId: 'fixture-drive', md5 }),
    download: async () => { beganDownload(); await new Promise(resolve => { releaseDownload = resolve; }); return Readable.from([Buffer.from('private bytes')]); },
    trash: async () => {},
  };
  const fx = await fixture(t, { driveStorage: drive });
  const [teamA, teamB] = seedTeams(fx);
  const member = await fx.client(fx.users.member);
  const teamRoom = (await member.json(`/messenger/api/teams/${teamA.id}/channel`, { method: 'POST', body: {} })).channel;
  const file = (await upload(member, teamRoom.id, 'slow.txt', 'private bytes')).file;
  const parent = (await send(member, teamRoom.id, 'slow original', [file.id])).message;
  const move = teamId => fx.app.store.put('users', fx.users.member.id, { ...fx.app.store.get('users', fx.users.member.id), teamId });
  for (const [path, body, headers] of [
    [`/messenger/api/channels/${teamRoom.id}/messages`, { body: 'must not commit', replyToId: parent.id }, {}],
    [`/messenger/api/messages/${parent.id}/pin`, {}, {}],
    [`/messenger/api/channels/${teamRoom.id}/files`, Buffer.from('staged team file'), { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'staged.txt' }],
  ]) {
    move(teamA.id);
    const partial = await fx.partial(member, path, body, { headers });
    move(teamB.id);
    assert.equal((await partial.finish()).status, 401);
  }
  move(teamA.id);
  const response = member.raw(`/messenger/api/files/${file.id}`);
  await downloadStarted;
  move(teamB.id); releaseDownload();
  const denied = await response;
  assert.equal(denied.status, 401);
  assert.ok(!(await denied.text()).includes('private bytes'));
  assert.equal(fx.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 1);
  assert.equal(fx.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM files').get().n, 1);
  assert.equal(fx.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_pins').get().n, 0);
  assert.deepEqual(await readdir(join(fx.messengerDir, 'uploads')), []);
});

test('legacy standalone credentials cannot open company team history after the integrated server stops', async t => {
  const fx = await fixture(t, { legacy: true });
  const [teamA] = seedTeams(fx);
  fx.app.store.put('users', fx.users.admin.id, { ...fx.app.store.get('users', fx.users.admin.id), teamId: teamA.id });
  const admin = await fx.client();
  const teamRoom = (await admin.json(`/messenger/api/teams/${teamA.id}/channel`, { method: 'POST', body: {} })).channel;
  const file = (await upload(admin, teamRoom.id, 'company-only.txt', 'company-only bytes')).file;
  const message = (await send(admin, teamRoom.id, 'company-only content', [file.id])).message;
  await fx.app.stop();
  const standalone = createMessenger({ dataDir: fx.messengerDir, port: 0, driveStorage: localDrive });
  try {
    const { url } = await standalone.listen();
    const login = await fetch(url + '/api/login', { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'legacyowner', password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie()[0].split(';')[0], state = await login.json();
    assert.equal(state.channels.some(channel => channel.id === teamRoom.id), false);
    assert.deepEqual(state.teams, []);
    for (const path of [`/api/channels/${teamRoom.id}/messages`, `/api/channels/${teamRoom.id}/pins`, `/api/messages/${message.id}`, `/api/messages/${message.id}/replies`, `/api/files/${file.id}`]) assert.equal((await fetch(url + path, { headers: { Cookie: cookie } })).status, 404);
    assert.deepEqual((await (await fetch(url + '/api/search?q=company-only', { headers: { Cookie: cookie } })).json()).messages, []);
    assert.deepEqual((await (await fetch(url + '/api/files?q=company-only', { headers: { Cookie: cookie } })).json()).files, []);
    assert.equal((await (await fetch(url + '/api/storage', { headers: { Cookie: cookie } })).json()).messageCount, fx.previous.counts.messages);
  } finally { await standalone.close(); }
});
