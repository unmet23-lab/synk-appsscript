import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createMessenger } from '../server.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-project-membership-'));
  const driveStorage = { active: async () => null, status: async () => ({ provider: 'local' }) };
  let app, url;
  async function start() { app = createMessenger({ dataDir: dir, port: 0, driveStorage }); url = (await app.listen()).url; }
  await start();
  function client() {
    let cookie = '';
    return {
      async raw(path, method = 'GET', body, extra = {}) {
        const bytes = body instanceof Uint8Array;
        const response = await fetch(url + path, { method, headers: { Cookie: cookie, ...(method === 'GET' ? {} : { Origin: url }), ...(body === undefined ? {} : { 'Content-Type': bytes ? 'application/octet-stream' : 'application/json' }), ...extra }, body: body === undefined ? undefined : bytes ? body : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
        const next = response.headers.getSetCookie().find(row => row.startsWith('synk_messenger_session=')); if (next) cookie = next.split(';')[0];
        return response;
      },
      async json(path, method = 'GET', body, status = 200, extra = {}) { const r = await this.raw(path, method, body, extra); const value = await r.json(); assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(value)}`); return value; },
      async events() { const abort = new AbortController(); const r = await fetch(url + '/api/events', { headers: { Cookie: cookie }, signal: abort.signal }); assert.equal(r.status, 200); const events = []; const done = (async () => { let pending = ''; try { for await (const chunk of r.body) { pending += new TextDecoder().decode(chunk); let end; while ((end = pending.indexOf('\n\n')) >= 0) { const item = pending.slice(0, end); pending = pending.slice(end + 2); const data = item.split('\n').find(line => line.startsWith('data: ')); if (data) events.push(JSON.parse(data.slice(6))); } } } catch (error) { if (!abort.signal.aborted) throw error; } })(); return { events, async close() { abort.abort(); await done; } }; },
    };
  }
  const owner = client();
  const boot = await owner.json('/api/setup', 'POST', { workspaceName: '프로젝트 격리 시험', name: '관리자', username: 'owner', password: 'project-test-password' }, 201);
  async function member(name) { const invitation = await owner.json('/api/invites', 'POST', {}, 201), c = client(); const state = await c.json('/api/join', 'POST', { name, username: name, password: 'project-test-password', code: invitation.code }, 201); return { ...c, user: state.user, state }; }
  const fx = { owner: { ...owner, user: boot.user }, alice: await member('alice'), bob: await member('bob'), member, social: boot.channels.find(c => c.systemKey === 'social').id, get db() { return app.db; }, async restart() { await app.close(); await start(); } };
  t.after(async () => { await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-project-membership-')); await rm(dir, { recursive: true, force: true }); });
  return fx;
}

test('selected projects restrict history, files, pins, replies, search and SSE even from an unrelated owner', async t => {
  const f = await fixture(t), ownerEvents = await f.owner.events(); t.after(() => ownerEvents.close());
  const room = (await f.alice.json('/api/channels', 'POST', { name: '선택 프로젝트', category: 'project', memberIds: [f.bob.user.id, f.alice.user.id, f.bob.user.id] }, 201)).channel;
  assert.equal(room.scope, 'private'); assert.equal(room.canInvite, true); assert.deepEqual(new Set(room.memberIds), new Set([f.alice.user.id, f.bob.user.id]));
  const file = (await f.alice.json(`/api/channels/${room.id}/files`, 'POST', Buffer.from('프로젝트 첨부'), 201, { 'X-File-Name': encodeURIComponent('비공개.txt') })).file;
  const message = (await f.alice.json(`/api/channels/${room.id}/messages`, 'POST', { body: '숨겨진 프로젝트 원문', fileIds: [file.id] }, 201)).message;
  await f.alice.json(`/api/messages/${message.id}/pin`, 'POST', {});
  for (const path of [`/api/channels/${room.id}/messages`, `/api/channels/${room.id}/members`, `/api/channels/${room.id}/pins`, `/api/messages/${message.id}`, `/api/messages/${message.id}/replies`, `/api/files/${file.id}`]) await f.owner.json(path, 'GET', undefined, 404);
  await f.owner.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.owner.user.id] }, 404);
  await f.owner.json(`/api/channels/${room.id}/files`, 'POST', Buffer.from('침입'), 404, { 'X-File-Name': 'outside.txt' });
  assert.equal((await f.owner.json('/api/channels')).channels.some(row => row.id === room.id), false);
  assert.deepEqual((await f.owner.json('/api/search?q=프로젝트')).messages, []); assert.deepEqual((await f.owner.json('/api/files')).files, []);
  assert.equal((await f.owner.json('/api/storage')).messageCount, 0);
  const published = (await f.alice.json(`/api/channels/${f.social}/messages`, 'POST', { body: '공개 이벤트' }, 201)).message;
  for (let i = 0; i < 25 && !ownerEvents.events.some(e => e.channelId === f.social); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(ownerEvents.events.some(e => e.channelId === published.channelId)); assert.equal(ownerEvents.events.some(e => e.channelId === room.id), false);
  assert.equal((await f.bob.json(`/api/messages/${message.id}`)).message.body, message.body);
});

test('only a participating creator or owner can add active selected crew; membership and scope are not changed through settings', async t => {
  const f = await fixture(t);
  const room = (await f.alice.json('/api/channels', 'POST', { name: '작은 프로젝트', category: 'project', memberIds: [f.bob.user.id] }, 201)).channel;
  const bobShape = (await f.bob.json('/api/channels')).channels.find(c => c.id === room.id); assert.equal(bobShape.canInvite, false);
  await f.bob.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.owner.user.id] }, 403);
  await f.alice.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: ['missing'] }, 400);
  for (const patch of [{ category: 'generic' }, { scope: 'public' }, { memberIds: [f.owner.user.id] }]) await f.alice.json(`/api/channels/${room.id}`, 'PATCH', patch, 400);
  await f.alice.json(`/api/channels/${room.id}`, 'PATCH', { name: '이름만 변경', description: '안전하게 유지' });
  const added = await f.alice.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.owner.user.id, f.owner.user.id] });
  assert.deepEqual(added.addedIds, [f.owner.user.id]); assert.equal(added.members.length, 3);
  assert.deepEqual((await f.alice.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.owner.user.id] })).addedIds, []);
  assert.equal((await f.owner.json(`/api/channels/${room.id}/members`)).channel.canInvite, true);
  const newcomer = await f.member('newcomer'); await f.owner.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [newcomer.user.id] });
  assert.equal((await newcomer.json(`/api/channels/${room.id}/members`)).members.length, 4);
});

test('restart preserves existing public projects and their file IDs while new signups do not enter selected projects', async t => {
  const f = await fixture(t);
  const legacy = (await f.owner.json('/api/channels', 'POST', { name: '기존 공개 프로젝트' }, 201)).channel;
  f.db.prepare("UPDATE channels SET category='project' WHERE id=?").run(legacy.id);
  const file = (await f.owner.json(`/api/channels/${legacy.id}/files`, 'POST', Buffer.from('원본'), 201, { 'X-File-Name': 'preserved.txt' })).file;
  const message = (await f.owner.json(`/api/channels/${legacy.id}/messages`, 'POST', { body: '기존 기록', fileIds: [file.id] }, 201)).message;
  const selected = (await f.owner.json('/api/channels', 'POST', { name: '새 선택 프로젝트', category: 'project' }, 201)).channel;
  assert.deepEqual(selected.memberIds, [f.owner.user.id]);
  const explicit = (await f.owner.json('/api/channels', 'POST', { name: '명시 공개 프로젝트', category: 'project', scope: 'public' }, 201)).channel;
  for (const body of [{ name: '일반 제한', memberIds: [] }, { name: '공개 선택 혼합', category: 'project', scope: 'public', memberIds: [] }, { name: '불명 크루', category: 'project', memberIds: ['unknown'] }]) await f.owner.json('/api/channels', 'POST', body, 400);
  await f.restart();
  const newcomer = await f.member('later');
  assert.ok(newcomer.state.channels.some(c => c.id === legacy.id && c.scope === 'public' && !c.canInvite));
  assert.ok(newcomer.state.channels.some(c => c.id === explicit.id)); assert.equal(newcomer.state.channels.some(c => c.id === selected.id), false);
  assert.equal((await newcomer.json(`/api/messages/${message.id}`)).message.files[0].id, file.id);
  assert.equal(await (await newcomer.raw(`/api/files/${file.id}`)).text(), '원본');
  const error = await f.owner.json(`/api/channels/${legacy.id}/members`, 'POST', { memberIds: [newcomer.user.id] }, 409); assert.match(error.error, /이미 모든 크루/);
  await f.owner.json(`/api/channels/${legacy.id}`, 'PATCH', { scope: 'private' }, 400);
  await f.restart(); assert.equal(f.db.prepare("SELECT COUNT(*) n FROM channels WHERE id IN (?,?)").get(legacy.id, selected.id).n, 2);
});
