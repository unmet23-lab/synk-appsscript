import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request } from 'node:http';
import { createMessenger } from '../server.mjs';

const password = 'Only-for-tests-2026!';

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'synk-messenger-test-'));
  let app = createMessenger({ dataDir, port: 0, host: '127.0.0.1' });
  let address = await app.listen();
  const streams = [];
  const fx = {
    dataDir,
    get db() { return app.db; },
    get server() { return app.server; },
    get url() { return address.url; },
    async restart() {
      await app.close();
      app = createMessenger({ dataDir, port: 0, host: '127.0.0.1' });
      address = await app.listen();
    },
    client() {
      const client = {
        cookie: '',
        async raw(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
          const allHeaders = { ...headers };
          if (client.cookie) allHeaders.Cookie = client.cookie;
          if (method !== 'GET' && method !== 'HEAD' && !('Origin' in allHeaders)) allHeaders.Origin = fx.url;
          if (body !== undefined && !(body instanceof Uint8Array) && typeof body !== 'string') {
            body = JSON.stringify(body);
            allHeaders['Content-Type'] = 'application/json';
          }
          const res = await fetch(fx.url + path, { method, body, headers: allHeaders, signal: AbortSignal.timeout(5000), ...rest });
          const cookie = res.headers.getSetCookie().find(value => value.startsWith('synk_messenger_session=') || /HttpOnly/i.test(value));
          if (cookie) client.cookie = cookie.split(';', 1)[0];
          return res;
        },
        async json(path, options) {
          const res = await client.raw(path, options);
          const json = await res.json();
          assert.ok(res.ok, `${options?.method || 'GET'} ${path}: ${res.status} ${JSON.stringify(json)}`);
          return json;
        },
        async denied(path, options) {
          const res = await client.raw(path, options);
          assert.ok(res.status >= 400 && res.status < 500, `${options?.method || 'GET'} ${path} should reject, got ${res.status}`);
          const json = await res.json();
          assert.equal(typeof json.error, 'string');
          return res;
        },
      };
      return client;
    },
    async owner() {
      const client = fx.client();
      const state = await client.json('/api/setup', { method: 'POST', body: { workspaceName: '테스트 팀', name: '관리자', username: 'owner', password } });
      return { client, state, user: state.user, lounge: state.channels.find(c => c.systemKey === 'social'), self: state.channels.find(c => c.kind === 'self') };
    },
    async member(owner, username = 'member') {
      const invite = await owner.json('/api/invites', { method: 'POST', body: {} });
      const client = fx.client();
      const state = await client.json('/api/join', { method: 'POST', body: { code: invite.code, name: username, username, password } });
      return { client, state, user: state.user, invite, self: state.channels.find(c => c.kind === 'self') };
    },
    async events(client) {
      const abort = new AbortController();
      const res = await client.raw('/api/events', { signal: abort.signal });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/event-stream/);
      const events = [];
      let pending = '';
      let waiter;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const done = (async () => {
        try {
          while (true) {
            const item = await reader.read();
            if (item.done) break;
            pending += decoder.decode(item.value, { stream: true }).replaceAll('\r\n', '\n');
            let end;
            while ((end = pending.indexOf('\n\n')) >= 0) {
              const frame = pending.slice(0, end);
              pending = pending.slice(end + 2);
              if (!frame.includes('event: update')) continue;
              const payload = frame.split('\n').find(line => line.startsWith('data:'));
              if (!payload) continue;
              events.push(JSON.parse(payload.slice(5).trim()));
              waiter?.();
            }
          }
        } catch (error) {
          if (!abort.signal.aborted) throw error;
        }
      })();
      const stream = {
        events,
        async waitFor(predicate) {
          if (events.some(predicate)) return;
          await new Promise((res, rej) => {
            const timeout = setTimeout(() => { waiter = null; rej(new Error('SSE update was not delivered')); }, 3000);
            waiter = () => {
              if (!events.some(predicate)) return;
              clearTimeout(timeout);
              waiter = null;
              res();
            };
          });
        },
        async close() { abort.abort(); await done; },
      };
      streams.push(stream);
      return stream;
    },
  };
  t.after(async () => {
    for (const stream of streams) await stream.close();
    await app.close();
    // Only remove the exact temporary directory created by this fixture.
    assert.ok(resolve(dataDir).startsWith(resolve(tmpdir()) + sep));
    assert.match(dataDir.split(sep).at(-1), /^synk-messenger-test-/);
    await rm(dataDir, { recursive: true, force: true });
  });
  return fx;
}

const send = (client, channelId, body, fileIds = []) => client.json(`/api/channels/${channelId}/messages`, { method: 'POST', body: { body, fileIds } });
const upload = (client, channelId, name = '테스트.html', body = Buffer.from('<script>alert(1)</script>')) => client.json(`/api/channels/${channelId}/files`, { method: 'POST', headers: { 'X-File-Name': encodeURIComponent(name), 'Content-Type': 'application/octet-stream' }, body });

test('first-run setup is single-use, sessions log out, and real data survives a server restart', async t => {
  const fx = await fixture(t);
  const visitor = fx.client();
  assert.equal((await visitor.json('/api/bootstrap')).needsSetup, true);
  await visitor.denied('/api/channels');
  await visitor.denied('/api/setup', { method: 'POST', body: { workspaceName: 'x', name: 'x', username: 'xx', password: 'short' } });
  const { client, state, lounge, self } = await fx.owner();
  assert.equal(state.needsSetup, false);
  assert.equal(state.workspace.name, '테스트 팀');
  assert.equal(state.user.role, 'owner');
  assert.equal(state.members.length, 1);
  assert.equal(state.channels.filter(c => c.kind === 'channel').length, 3);
  assert.ok(self);
  assert.deepEqual((await client.json(`/api/channels/${lounge.id}/messages`)).messages, []);
  await visitor.denied('/api/setup', { method: 'POST', body: { workspaceName: 'other', name: 'x', username: 'other', password } });
  const { message } = await send(client, self.id, '재시작해도 남아 있는 내 메모');
  await client.json('/api/logout', { method: 'POST', body: {} });
  await client.denied(`/api/channels/${self.id}/messages`);
  await client.denied('/api/login', { method: 'POST', body: { username: 'owner', password: 'wrong-password' } });
  const login = await client.raw('/api/login', { method: 'POST', body: { username: 'owner', password } });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);
  await login.arrayBuffer();
  await fx.restart();
  await client.json('/api/login', { method: 'POST', body: { username: 'owner', password } });
  const persisted = await client.json(`/api/channels/${self.id}/messages`);
  assert.equal(persisted.messages.find(m => m.id === message.id)?.body, '재시작해도 남아 있는 내 메모');
});

test('concurrent setup and invitation redemption cannot create duplicate owners or reuse codes', async t => {
  const fx = await fixture(t);
  const people = [fx.client(), fx.client()];
  const responses = await Promise.all(people.map((client, i) => client.raw('/api/setup', { method: 'POST', body: { workspaceName: '동시 초기화', name: `owner${i}`, username: `owner${i}`, password } })));
  assert.equal(responses.filter(r => r.ok).length, 1);
  const owner = people[responses.findIndex(r => r.ok)];
  for (const res of responses) await res.arrayBuffer();
  const invite = await owner.json('/api/invites', { method: 'POST', body: {} });
  const applicants = [fx.client(), fx.client()];
  const joined = await Promise.all(applicants.map((client, i) => client.raw('/api/join', { method: 'POST', body: { code: invite.code, name: `member${i}`, username: `member${i}`, password } })));
  assert.equal(joined.filter(r => r.ok).length, 1);
  const member = applicants[joined.findIndex(r => r.ok)];
  for (const res of joined) await res.arrayBuffer();
  assert.equal((await owner.json('/api/members')).members.length, 2);
  await member.denied('/api/invites', { method: 'POST', body: {} });
  await member.denied('/api/invites');
  const list = await owner.json('/api/invites');
  assert.equal(list.invites.length, 1);
  assert.ok(list.invites[0].usedAt);
  assert.equal(JSON.stringify(list).includes(invite.code), false);
  const fresh = await owner.json('/api/invites', { method: 'POST', body: {} });
  const active = (await owner.json('/api/invites')).invites.find(i => !i.usedAt && !i.revokedAt);
  await owner.json(`/api/invites/${active.id}`, { method: 'DELETE' });
  await fx.client().denied('/api/join', { method: 'POST', body: { code: fresh.code, name: '차단', username: 'blocked', password } });
});

test('self notes and direct messages stay private across history, search, files and SSE', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const bob = await fx.member(owner.client, 'bob');
  const carol = await fx.member(owner.client, 'carol');
  const dm = (await owner.client.json('/api/dms', { method: 'POST', body: { userId: bob.user.id } })).channel;
  const same = (await bob.client.json('/api/dms', { method: 'POST', body: { userId: owner.user.id } })).channel;
  assert.equal(dm.id, same.id);
  const outsiderEvents = await fx.events(carol.client);
  const memberEvents = await fx.events(bob.client);
  const { file } = await upload(owner.client, dm.id);
  const { message } = await send(owner.client, dm.id, '비밀키워드 private-dm', [file.id]);
  await send(owner.client, owner.self.id, '비밀키워드 self-note');
  const privateNote = (await send(bob.client, bob.self.id, '비밀키워드 bob-note')).message;
  const privateReply = (await send(bob.client, dm.id, '비밀키워드 dm-reply')).message;
  const channelIds = (await carol.client.json('/api/channels')).channels.map(c => c.id);
  assert.equal(channelIds.includes(dm.id), false);
  assert.equal(channelIds.includes(owner.self.id), false);
  await carol.client.denied(`/api/channels/${dm.id}/messages`);
  await carol.client.denied(`/api/channels/${dm.id}/read`, { method: 'POST', body: {} });
  await carol.client.denied(`/api/channels/${dm.id}/messages`, { method: 'POST', body: { body: 'intruder' } });
  await carol.client.denied(`/api/messages/${message.id}/reactions`, { method: 'POST', body: { emoji: '👍' } });
  await carol.client.denied(`/api/files/${file.id}`);
  await owner.client.denied(`/api/channels/${bob.self.id}/messages`);
  await owner.client.denied(`/api/messages/${privateNote.id}`, { method: 'DELETE' });
  await owner.client.denied(`/api/messages/${privateReply.id}`, { method: 'DELETE' });
  const search = await carol.client.json('/api/search?q=' + encodeURIComponent('비밀키워드'));
  assert.deepEqual(search.messages, []);
  const narrowed = await carol.client.raw('/api/search?q=private&channelId=' + dm.id);
  if (narrowed.ok) assert.deepEqual((await narrowed.json()).messages, []);
  else { assert.ok(narrowed.status === 403 || narrowed.status === 404); await narrowed.arrayBuffer(); }
  assert.equal((await carol.client.json('/api/files')).files.some(f => f.id === file.id), false);
  assert.equal((await bob.client.json('/api/search?q=private-dm')).messages[0].id, message.id);
  assert.equal((await bob.client.json('/api/files')).files[0].id, file.id);
  await send(owner.client, owner.lounge.id, 'public event sentinel');
  await outsiderEvents.waitFor(e => e.type === 'message' && e.channelId === owner.lounge.id);
  await memberEvents.waitFor(e => e.type === 'message' && e.channelId === dm.id);
  assert.equal(outsiderEvents.events.some(e => e.channelId === dm.id || e.channelId === owner.self.id || e.channelId === bob.self.id), false);
});

test('upload ownership, attachment publishing, download disposition and removal are enforced', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const member = await fx.member(owner.client, 'member');
  const { file } = await upload(owner.client, owner.lounge.id, '../../파일.html');
  assert.equal(file.size, Buffer.byteLength('<script>alert(1)</script>'));
  assert.equal((await owner.client.json('/api/files')).files.length, 0);
  await member.client.denied(`/api/files/${file.id}`);
  await member.client.denied(`/api/channels/${owner.lounge.id}/messages`, { method: 'POST', body: { body: 'steal', fileIds: [file.id] } });
  await owner.client.denied(`/api/channels/${owner.self.id}/messages`, { method: 'POST', body: { body: 'wrong channel', fileIds: [file.id] } });
  const { message } = await send(owner.client, owner.lounge.id, '', [file.id]);
  await owner.client.denied(`/api/channels/${owner.lounge.id}/messages`, { method: 'POST', body: { body: 'reuse', fileIds: [file.id] } });
  const download = await member.client.raw(`/api/files/${file.id}`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment;/i);
  assert.equal(await download.text(), '<script>alert(1)</script>');
  await owner.client.denied(`/api/files/${file.id}`, { method: 'DELETE' });
  await owner.client.json(`/api/messages/${message.id}`, { method: 'DELETE' });
  await owner.client.denied(`/api/files/${file.id}`);
  assert.equal((await owner.client.json('/api/files')).files.length, 0);
  const cancelled = (await upload(owner.client, owner.lounge.id, '취소.bin')).file;
  await member.client.denied(`/api/files/${cancelled.id}`, { method: 'DELETE' });
  await owner.client.json(`/api/files/${cancelled.id}`, { method: 'DELETE' });
  await owner.client.denied(`/api/files/${cancelled.id}`);
  await owner.client.denied(`/api/channels/${owner.lounge.id}/files`, { method: 'POST', headers: { 'X-File-Name': 'empty.txt', 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(0) });
  assert.equal((await owner.client.json('/api/storage')).fileCount, 0);
  assert.deepEqual(await readdir(join(fx.dataDir, 'uploads')), []);
});

test('message author controls, reactions, unread markers, pagination and literal search work together', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const member = await fx.member(owner.client, 'member');
  const { channel } = await member.client.json('/api/channels', { method: 'POST', body: { name: '프로젝트', description: '지금 하는 일' } });
  assert.ok((await owner.client.json('/api/channels')).channels.some(c => c.id === channel.id));
  const sent = [];
  for (let i = 0; i < 7; i++) sent.push((await send(member.client, channel.id, `메시지 ${i} ' <script> 100% _`)).message);
  let mine = (await owner.client.json('/api/channels')).channels.find(c => c.id === channel.id);
  assert.equal(mine.unread, 7);
  const latest = await owner.client.json(`/api/channels/${channel.id}/messages?limit=3`);
  assert.deepEqual(latest.messages.map(m => m.id), sent.slice(-3).map(m => m.id));
  assert.equal(latest.hasMore, true);
  const older = await owner.client.json(`/api/channels/${channel.id}/messages?limit=3&before=${latest.messages[0].id}`);
  assert.deepEqual(older.messages.map(m => m.id), sent.slice(1, 4).map(m => m.id));
  await owner.client.json(`/api/channels/${channel.id}/read`, { method: 'POST', body: {} });
  mine = (await owner.client.json('/api/channels')).channels.find(c => c.id === channel.id);
  assert.equal(mine.unread, 0);
  const id = sent[0].id;
  await owner.client.denied(`/api/messages/${id}`, { method: 'PATCH', body: { body: 'not author' } });
  const edited = await member.client.json(`/api/messages/${id}`, { method: 'PATCH', body: { body: '수정 완료' } });
  assert.equal(edited.message.body, '수정 완료');
  assert.ok(edited.message.editedAt);
  const reaction = await owner.client.json(`/api/messages/${id}/reactions`, { method: 'POST', body: { emoji: '✅' } });
  assert.deepEqual(reaction.message.reactions, [{ emoji: '✅', count: 1, mine: true }]);
  const otherReaction = await member.client.json(`/api/messages/${id}/reactions`, { method: 'POST', body: { emoji: '✅' } });
  assert.equal(otherReaction.message.reactions[0].count, 2);
  await owner.client.json(`/api/messages/${id}/reactions`, { method: 'POST', body: { emoji: '✅' } });
  const seen = (await owner.client.json(`/api/channels/${channel.id}/messages`)).messages.find(m => m.id === id);
  assert.deepEqual(seen.reactions, [{ emoji: '✅', count: 1, mine: false }]);
  await member.client.denied(`/api/messages/${id}/reactions`, { method: 'POST', body: { emoji: '🚫' } });
  const percent = await owner.client.json('/api/search?q=' + encodeURIComponent('100% _'));
  assert.equal(percent.messages.length, 6);
  assert.equal((await owner.client.json('/api/search?q=' + encodeURIComponent("' OR 1=1 --"))).messages.length, 0);
  const adminMessage = (await send(owner.client, channel.id, '관리자 메시지')).message;
  await member.client.denied(`/api/messages/${adminMessage.id}`, { method: 'DELETE' });
  await owner.client.json(`/api/messages/${id}`, { method: 'DELETE' });
  assert.equal((await member.client.json(`/api/channels/${channel.id}/messages`)).messages.some(m => m.id === id), false);
  await member.client.denied(`/api/channels/${channel.id}/messages`, { method: 'POST', body: { body: '   ' } });
  await member.client.denied(`/api/channels/${channel.id}/messages`, { method: 'POST', body: { body: 'x'.repeat(8001) } });
  await member.client.denied(`/api/channels/${channel.id}/messages`, { method: 'POST', body: { body: [], fileIds: [] } });
});

test('hostile origins, forged hosts and unauthenticated endpoints cannot modify or expose content', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const visitor = fx.client();
  await visitor.denied('/api/storage');
  await visitor.denied('/api/files');
  await visitor.denied('/api/members');
  await visitor.denied('/api/search?q=x');
  await visitor.denied('/api/events');
  await owner.client.denied(`/api/channels/${owner.lounge.id}/messages`, { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: { body: 'cross origin' } });
  // Undici fetch replaces Host; native HTTP is needed to exercise a forged wire header.
  const forgedHostStatus = await new Promise((resolve, reject) => {
    const req = request(fx.url + '/api/bootstrap', { headers: { Host: 'untrusted.example', Cookie: owner.client.cookie } }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Forged host request timed out')));
    req.end();
  });
  assert.equal(forgedHostStatus, 403);
  assert.deepEqual((await owner.client.json(`/api/channels/${owner.lounge.id}/messages`)).messages, []);
});

test('oversized uploads are rejected from their length header without leaving a file', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const status = await new Promise((resolve, reject) => {
    const req = request(fx.url + `/api/channels/${owner.lounge.id}/files`, {
      method: 'POST',
      headers: { Cookie: owner.client.cookie, Origin: fx.url, 'X-File-Name': 'huge.bin', 'Content-Type': 'application/octet-stream', 'Content-Length': String(104857601) },
    }, res => {
      res.resume();
      res.on('end', () => { resolve(res.statusCode); req.destroy(); });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Oversize upload was not rejected before reading 100 MiB')));
    req.end();
  });
  assert.equal(status, 413);
  assert.equal((await owner.client.json('/api/storage')).fileCount, 0);
  assert.deepEqual(await readdir(join(fx.dataDir, 'uploads')), []);
});

test('a disconnected upload removes partial disk data and leaves the server usable', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const req = request(fx.url + `/api/channels/${owner.lounge.id}/files`, {
    method: 'POST',
    headers: { Cookie: owner.client.cookie, Origin: fx.url, 'X-File-Name': 'interrupted.bin', 'Content-Type': 'application/octet-stream', 'Content-Length': '1048576' },
  });
  req.on('error', () => {}); // The intentional disconnect produces ECONNRESET.
  req.write(Buffer.alloc(65536, 1));
  let appeared = false;
  try {
    for (let i = 0; i < 100; i++) {
      if ((await readdir(join(fx.dataDir, 'uploads'))).length) { appeared = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } finally { req.destroy(); }
  assert.equal(appeared, true, 'the upload must start writing before we interrupt it');
  let remaining;
  for (let i = 0; i < 100; i++) {
    remaining = await readdir(join(fx.dataDir, 'uploads'));
    if (remaining.length === 0) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.deepEqual(remaining, []);
  assert.equal((await owner.client.json('/api/storage')).fileCount, 0);
  assert.equal((await send(owner.client, owner.lounge.id, '업로드 취소 후에도 전송')).message.body, '업로드 취소 후에도 전송');
});

test('editing or reacting while another tab deletes the message returns a missing-message error', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  for (const operation of [
    { method: 'PATCH', suffix: '', body: { body: '늦게 도착한 수정' } },
    { method: 'POST', suffix: '/reactions', body: { emoji: '👍' } },
    { method: 'POST', suffix: '/pin', body: {} },
    { method: 'POST', reply: true, body: { body: '늦게 도착한 답글' } },
  ]) {
    const { message } = await send(owner.client, owner.lounge.id, '다른 탭에서 지울 메시지');
    const body = Buffer.from(JSON.stringify({ ...operation.body, ...(operation.reply ? { replyToId: message.id } : {}) }));
    let req;
    const arrived = new Promise(resolve => fx.server.once('request', resolve));
    const response = new Promise((resolve, reject) => {
      req = request(fx.url + (operation.reply ? `/api/channels/${owner.lounge.id}/messages` : `/api/messages/${message.id}${operation.suffix}`), {
        method: operation.method,
        headers: { Cookie: owner.client.cookie, Origin: fx.url, 'Content-Type': 'application/json', 'Content-Length': String(body.length) },
      }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      });
      req.on('error', reject);
      req.setTimeout(3000, () => req.destroy(new Error('Concurrent message request timed out')));
      req.write(body.subarray(0, 1));
    });
    await arrived;
    await owner.client.json(`/api/messages/${message.id}`, { method: 'DELETE' });
    req.end(body.subarray(1));
    const result = await response;
    assert.equal(result.status, 404, `${operation.method}: ${JSON.stringify(result.body)}`);
    assert.equal((await owner.client.json(`/api/channels/${owner.lounge.id}/messages`)).messages.some(m => m.id === message.id), false);
  }
});

test('replies stay in their original room, update previews, page correctly and survive parent deletion without retaining its content', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const alice = await fx.member(owner.client, 'reply-alice');
  const parent = (await send(owner.client, owner.lounge.id, '답글 원문')).message;
  const secret = (await send(alice.client, alice.self.id, '공개되면 안 되는 원문')).message;
  const reply = async (client, channel, parentId, text) => client.json(`/api/channels/${channel}/messages`, { method: 'POST', body: { body: text, replyToId: parentId } });
  await owner.client.denied(`/api/channels/${owner.lounge.id}/messages`, { method: 'POST', body: { body: '비공개 원문 인용 시도', replyToId: secret.id } });
  await alice.client.denied(`/api/channels/${owner.lounge.id}/messages`, { method: 'POST', body: { body: '다른 방 원문 인용 시도', replyToId: secret.id } });
  await owner.client.denied(`/api/messages/${secret.id}/replies`);
  const first = (await reply(alice.client, owner.lounge.id, parent.id, '첫 답글')).message;
  const second = (await reply(owner.client, owner.lounge.id, parent.id, '다음 답글')).message;
  assert.equal(first.replyToId, parent.id);
  assert.equal(first.replyTo.body, '답글 원문');
  assert.equal(first.replyTo.user.id, owner.user.id);
  const page = await alice.client.json(`/api/messages/${parent.id}/replies?limit=1`);
  assert.equal(page.parent.replyCount, 2);
  assert.equal(page.hasMore, true);
  assert.deepEqual(page.messages.map(m => m.id), [second.id]);
  const older = await alice.client.json(`/api/messages/${parent.id}/replies?limit=1&before=${second.id}`);
  assert.equal(older.hasMore, false);
  assert.deepEqual(older.messages.map(m => m.id), [first.id]);
  await owner.client.json(`/api/messages/${parent.id}`, { method: 'PATCH', body: { body: '수정된 원문' } });
  assert.equal((await alice.client.json(`/api/messages/${first.id}`)).message.replyTo.body, '수정된 원문');
  await owner.client.json(`/api/messages/${parent.id}`, { method: 'DELETE' });
  const remaining = (await alice.client.json(`/api/messages/${first.id}`)).message;
  assert.equal(remaining.replyToId, parent.id);
  assert.deepEqual(remaining.replyTo, { id: parent.id, body: '', user: null, files: [], deleted: true });
  await alice.client.denied(`/api/messages/${parent.id}/replies`);
  await alice.client.denied(`/api/channels/${owner.lounge.id}/messages`, { method: 'POST', body: { body: '삭제된 원문에 답글', replyToId: parent.id } });
});

test('room pins are shared and idempotent but private pins and SSE remain limited to participants', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const alice = await fx.member(owner.client, 'pin-alice');
  const original = (await send(owner.client, owner.lounge.id, '팀이 확인할 중요 메시지')).message;
  const pinned = (await alice.client.json(`/api/messages/${original.id}/pin`, { method: 'POST', body: {} })).message;
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.pinnedBy.id, alice.user.id);
  const again = (await owner.client.json(`/api/messages/${original.id}/pin`, { method: 'POST', body: {} })).message;
  assert.equal(again.pinnedAt, pinned.pinnedAt);
  assert.equal(again.pinnedBy.id, alice.user.id);
  assert.deepEqual((await owner.client.json(`/api/channels/${owner.lounge.id}/pins`)).messages.map(m => m.id), [original.id]);
  const ownerEvents = await fx.events(owner.client);
  const privateMessage = (await send(alice.client, alice.self.id, '개인 중요 메모')).message;
  await alice.client.json(`/api/messages/${privateMessage.id}/pin`, { method: 'POST', body: {} });
  await owner.client.denied(`/api/channels/${alice.self.id}/pins`);
  await owner.client.denied(`/api/messages/${privateMessage.id}/pin`, { method: 'POST', body: {} });
  await owner.client.denied(`/api/messages/${privateMessage.id}/pin`, { method: 'DELETE' });
  await send(alice.client, owner.lounge.id, 'SSE 확인용 공개 메시지');
  await ownerEvents.waitFor(event => event.type === 'message' && event.channelId === owner.lounge.id);
  assert.equal(ownerEvents.events.some(event => event.channelId === alice.self.id), false);
  const unpinned = (await owner.client.json(`/api/messages/${original.id}/pin`, { method: 'DELETE' })).message;
  assert.equal(unpinned.pinned, false);
  assert.equal(unpinned.pinnedBy, null);
  await owner.client.json(`/api/messages/${original.id}/pin`, { method: 'DELETE' });
  await owner.client.json(`/api/messages/${original.id}/pin`, { method: 'POST', body: {} });
  await owner.client.json(`/api/messages/${original.id}`, { method: 'DELETE' });
  assert.deepEqual((await owner.client.json(`/api/channels/${owner.lounge.id}/pins`)).messages, []);
});

test('team and project categories preserve public memberships while room editing stays with its creator or owner', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const alice = await fx.member(owner.client, 'room-alice');
  const bob = await fx.member(owner.client, 'room-bob');
  assert.equal(owner.lounge.category, 'generic');
  assert.equal(owner.self.category, null);
  const team = (await alice.client.json('/api/channels', { method: 'POST', body: { name: '디자인팀', category: 'team' } })).channel;
  assert.equal(team.category, 'team');
  assert.equal(team.canManage, true);
  assert.equal(team.memberIds.length, 3);
  assert.equal((await bob.client.json('/api/channels')).channels.find(c => c.id === team.id).canManage, false);
  await bob.client.denied(`/api/channels/${team.id}`, { method: 'PATCH', body: { category: 'project' } });
  const project = (await alice.client.json(`/api/channels/${team.id}`, { method: 'PATCH', body: { name: '신제품 출시', category: 'project' } })).channel;
  assert.equal(project.category, 'project');
  assert.equal(project.name, '신제품 출시');
  await owner.client.json(`/api/channels/${team.id}`, { method: 'PATCH', body: { category: 'team' } });
  await alice.client.denied('/api/channels', { method: 'POST', body: { name: '잘못된 분류', category: 'private' } });
  await owner.client.denied(`/api/channels/${owner.self.id}`, { method: 'PATCH', body: { category: 'team' } });
  const dm = (await alice.client.json('/api/dms', { method: 'POST', body: { userId: bob.user.id } })).channel;
  assert.equal(dm.category, null);
  await owner.client.denied(`/api/channels/${dm.id}`, { method: 'PATCH', body: { category: 'project' } });
});

test('file search applies literal names, kind, uploader and pagination before limiting results and never lists private or staged files', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const alice = await fx.member(owner.client, 'files-alice');
  const published = [];
  for (const name of ['매출_100%.PDF', '매출x100q.pdf', '사진.PNG', '발표.MOV', '음악.FLAC', '자료.7z', '모델.blend']) {
    const { file } = await upload(owner.client, owner.lounge.id, name);
    const { message } = await send(owner.client, owner.lounge.id, '', [file.id]);
    published.push(message.files[0]);
  }
  const aliceFile = (await upload(alice.client, owner.lounge.id, '팀문서.xlsx')).file;
  await send(alice.client, owner.lounge.id, '', [aliceFile.id]);
  const staged = (await upload(owner.client, owner.lounge.id, '매출_100%미전송.pdf')).file;
  const secret = (await upload(alice.client, alice.self.id, '매출_100%비공개.pdf')).file;
  await send(alice.client, alice.self.id, '', [secret.id]);
  const exact = await owner.client.json('/api/files?q=' + encodeURIComponent('매출_100%') + '&type=document');
  assert.deepEqual(exact.files.map(f => f.name), ['매출_100%.PDF']);
  assert.equal(exact.files[0].type, 'document');
  assert.ok(exact.files[0].messageId);
  for (const type of ['image', 'video', 'audio', 'archive', 'other']) {
    const found = (await owner.client.json('/api/files?type=' + type)).files;
    assert.equal(found.length, 1);
    assert.equal(found[0].type, type);
  }
  assert.deepEqual((await owner.client.json(`/api/files?uploaderId=${alice.user.id}`)).files.map(f => f.id), [aliceFile.id]);
  const first = await owner.client.json('/api/files?limit=3');
  assert.equal(first.hasMore, true);
  assert.equal(first.nextOffset, 3);
  const second = await owner.client.json('/api/files?limit=3&offset=3');
  const third = await owner.client.json('/api/files?limit=3&offset=6');
  assert.equal(third.hasMore, false);
  assert.equal(third.nextOffset, null);
  const seen = [...first.files, ...second.files, ...third.files].map(f => f.id);
  assert.equal(new Set(seen).size, 8);
  assert.equal(seen.includes(staged.id), false);
  assert.equal(seen.includes(secret.id), false);
  await owner.client.denied(`/api/files?channelId=${alice.self.id}`);
  await owner.client.denied('/api/files?type=unknown');
  await owner.client.denied('/api/files?offset=-1');
});

test('guarded collaboration migration preserves old messages and files and repeating it keeps replies, pins and categories', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  owner.lounge = (await owner.client.json('/api/channels', { method: 'POST', body: { name: '기존 사용자 대화방' } })).channel;
  const file = (await upload(owner.client, owner.lounge.id, '이전자료.txt')).file;
  const parent = (await send(owner.client, owner.lounge.id, '기존 데이터', [file.id])).message;
  // This isolated fixture simulates the previous schema without touching production data.
  fx.db.exec('DROP TABLE message_pins; DROP INDEX messages_reply; ALTER TABLE messages DROP COLUMN reply_to_id; ALTER TABLE channels DROP COLUMN category; ALTER TABLE channels DROP COLUMN creator_id;');
  await fx.restart();
  const restored = (await owner.client.json(`/api/messages/${parent.id}`)).message;
  assert.equal(restored.body, '기존 데이터');
  assert.equal(restored.replyToId, null);
  assert.equal(restored.pinned, false);
  assert.equal(restored.files[0].id, file.id);
  assert.equal((await owner.client.json('/api/channels')).channels.find(c => c.id === owner.lounge.id).category, 'generic');
  const reply = (await owner.client.json(`/api/channels/${owner.lounge.id}/messages`, { method: 'POST', body: { body: '새 답글', replyToId: parent.id } })).message;
  await owner.client.json(`/api/messages/${parent.id}/pin`, { method: 'POST', body: {} });
  await owner.client.json(`/api/channels/${owner.lounge.id}`, { method: 'PATCH', body: { category: 'project' } });
  await fx.restart();
  assert.equal((await owner.client.json(`/api/messages/${reply.id}`)).message.replyTo.id, parent.id);
  assert.equal((await owner.client.json(`/api/channels/${owner.lounge.id}/pins`)).messages[0].id, parent.id);
  assert.equal((await owner.client.json('/api/channels')).channels.find(c => c.id === owner.lounge.id).category, 'project');
  assert.equal(await (await owner.client.raw(`/api/files/${file.id}`)).text(), '<script>alert(1)</script>');
});

test('read markers only advance through the displayed snapshot and never consume later arrivals', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const alice = await fx.member(owner.client, 'read-alice');
  const first = (await send(alice.client, owner.lounge.id, '화면에서 읽은 메시지')).message;
  const snapshot = (await owner.client.json(`/api/channels/${owner.lounge.id}/messages`)).messages;
  const late = (await send(alice.client, owner.lounge.id, '화면을 그린 뒤 도착한 메시지')).message;
  const unread = async () => (await owner.client.json('/api/channels')).channels.find(c => c.id === owner.lounge.id).unread;
  await owner.client.json(`/api/channels/${owner.lounge.id}/read`, { method: 'POST', body: { messageId: snapshot.at(-1).id } });
  assert.equal(await unread(), 1);
  await owner.client.json(`/api/channels/${owner.lounge.id}/read`, { method: 'POST', body: { messageId: late.id } });
  assert.equal(await unread(), 0);
  await owner.client.json(`/api/channels/${owner.lounge.id}/read`, { method: 'POST', body: { messageId: first.id } });
  assert.equal(await unread(), 0);
  const secret = (await send(alice.client, alice.self.id, '다른 방 메시지')).message;
  await owner.client.denied(`/api/channels/${owner.lounge.id}/read`, { method: 'POST', body: { messageId: secret.id } });
  await send(alice.client, owner.lounge.id, '이전 클라이언트 호환');
  await owner.client.json(`/api/channels/${owner.lounge.id}/read`, { method: 'POST', body: {} });
  assert.equal(await unread(), 0);
});
