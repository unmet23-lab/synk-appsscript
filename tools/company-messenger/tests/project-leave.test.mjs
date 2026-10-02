import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { createMessenger } from '../server.mjs';

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function fixture(t, driveStorage = { active: async () => null, status: async () => ({ provider: 'local' }) }) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-project-leave-'));
  let app, url;
  const start = async () => { app = createMessenger({ dataDir: dir, port: 0, driveStorage }); url = (await app.listen()).url; };
  await start();
  function client() {
    let cookie = '';
    return {
      async raw(path, method = 'GET', body, extra = {}) {
        const bytes = body instanceof Uint8Array;
        const r = await fetch(url + path, { method, headers: { Cookie: cookie, ...(method === 'GET' ? {} : { Origin: url }), ...(body === undefined ? {} : { 'Content-Type': bytes ? 'application/octet-stream' : 'application/json' }), ...extra }, body: body === undefined ? undefined : bytes ? body : JSON.stringify(body), signal: AbortSignal.timeout(6000) });
        const next = r.headers.getSetCookie().find(row => row.startsWith('synk_messenger_session=')); if (next) cookie = next.split(';')[0]; return r;
      },
      async json(path, method = 'GET', body, status = 200, headers) { const r = await this.raw(path, method, body, headers), value = await r.json(); assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(value)}`); return value; },
      async events() { const abort = new AbortController(), r = await fetch(url + '/api/events', { headers: { Cookie: cookie }, signal: abort.signal }); assert.equal(r.status, 200); const events = []; const done = (async () => { let pending = ''; try { for await (const chunk of r.body) { pending += new TextDecoder().decode(chunk); let end; while ((end = pending.indexOf('\n\n')) >= 0) { const item = pending.slice(0, end); pending = pending.slice(end + 2); const data = item.split('\n').find(line => line.startsWith('data: ')); if (data) events.push(JSON.parse(data.slice(6))); } } } catch (error) { if (!abort.signal.aborted) throw error; } })(); return { events, async close() { abort.abort(); await done; } }; },
    };
  }
  const owner = client(); const state = await owner.json('/api/setup', 'POST', { name: 'owner', username: 'owner', password: 'leave-fixture-password', workspaceName: '프로젝트 나가기 시험' }, 201);
  const member = async name => { const invite = await owner.json('/api/invites', 'POST', {}, 201), c = client(); const boot = await c.json('/api/join', 'POST', { name, username: name, password: 'leave-fixture-password', code: invite.code }, 201); return { ...c, state: boot, user: boot.user }; };
  const fx = { owner: { ...owner, state, user: state.user }, alice: await member('alice'), bob: await member('bob'), member, get db() { return app.db; }, async restart() { await app.close(); await start(); } };
  t.after(async () => { await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-project-leave-')); await rm(dir, { recursive: true, force: true }); });
  return fx;
}
const upload = async (person, id) => (await person.json(`/api/channels/${id}/files`, 'POST', Buffer.from('retained bytes'), 201, { 'X-File-Name': 'retained.txt' })).file;
const send = async (person, id, extras = {}) => (await person.json(`/api/channels/${id}/messages`, 'POST', { body: '남은 크루가 볼 기록', ...extras }, 201)).message;
async function waitEvent(stream, predicate) { for (let i = 0; i < 80 && !stream.events.some(predicate); i++) await new Promise(resolve => setTimeout(resolve, 10)); assert.ok(stream.events.some(predicate)); }

test('a member can leave without affecting history; their other tabs refresh and later room content stays private', async t => {
  const f = await fixture(t), room = (await f.alice.json('/api/channels', 'POST', { name: '프로젝트', category: 'project', memberIds: [f.bob.user.id] }, 201)).channel;
  assert.equal(room.canLeave, true); assert.equal(room.activeMemberCount, 2);
  const file = await upload(f.bob, room.id), message = await send(f.alice, room.id, { fileIds: [], mentionIds: [f.bob.user.id] });
  const own = await send(f.bob, room.id, { fileIds: [file.id] });
  await f.bob.json(`/api/messages/${message.id}/save`, 'POST', {}); await f.alice.json(`/api/messages/${message.id}/task`, 'POST', { assigneeId: f.bob.user.id }, 201);
  const bobEvents = await f.bob.events(), aliceEvents = await f.alice.events(); t.after(async () => { await bobEvents.close(); await aliceEvents.close(); });
  const result = await f.bob.json(`/api/channels/${room.id}/leave`, 'POST', {}); assert.equal(result.archived, false); assert.equal(result.newManagerId, f.alice.user.id);
  await f.bob.json(`/api/channels/${room.id}/leave`, 'POST', {});
  await waitEvent(bobEvents, e => e.type === 'channel' && !e.channelId); await waitEvent(aliceEvents, e => e.type === 'channel' && e.channelId === room.id);
  for (const path of [`/api/channels/${room.id}/members`, `/api/channels/${room.id}/messages`, `/api/messages/${message.id}`, `/api/files/${file.id}`]) await f.bob.json(path, 'GET', undefined, 404);
  for (const [path, key] of [['/api/search?q=기록', 'messages'], ['/api/files', 'files'], ['/api/saved', 'messages'], ['/api/tasks?scope=all', 'tasks'], ['/api/notifications', 'items']]) assert.deepEqual((await f.bob.json(path))[key], []);
  await f.bob.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.bob.user.id] }, 404);
  assert.equal((await f.alice.json(`/api/messages/${own.id}`)).message.files[0].id, file.id); assert.equal(await (await f.alice.raw(`/api/files/${file.id}`)).text(), 'retained bytes');
  await send(f.alice, room.id); await send(f.alice, f.alice.state.channels.find(c => c.systemKey === 'social').id);
  await waitEvent(bobEvents, e => e.type === 'message'); assert.equal(bobEvents.events.some(e => e.channelId === room.id), false);
});

test('public departure survives restart and restoration until an explicit invitation; creator management passes to an existing writer', async t => {
  const f = await fixture(t), room = (await f.owner.json('/api/channels', 'POST', { name: '공개 프로젝트', category: 'project', scope: 'public' }, 201)).channel;
  const file = await upload(f.owner, room.id); await send(f.owner, room.id, { fileIds: [file.id] });
  for (const c of f.owner.state.channels) { assert.equal(c.canLeave, false); await f.owner.json(`/api/channels/${c.id}/leave`, 'POST', {}, 403); }
  const left = await f.owner.json(`/api/channels/${room.id}/leave`, 'POST', {}); assert.equal(left.newManagerId, f.alice.user.id);
  const storage = await f.owner.json('/api/storage'); assert.equal(storage.messageCount, 0); assert.equal(storage.fileCount, 0);
  let channel = (await f.alice.json('/api/channels')).channels.find(c => c.id === room.id); assert.equal(channel.canManage, true); assert.equal(channel.canInvite, true);
  await f.alice.json(`/api/channels/${room.id}`, 'PATCH', { description: '승계한 관리자가 수정' });
  await f.alice.json(`/api/channels/${room.id}`, 'DELETE'); await f.alice.json(`/api/channels/${room.id}/restore`, 'POST', {});
  await f.restart(); const later = await f.member('later'); assert.ok(later.state.channels.some(c => c.id === room.id));
  assert.equal((await f.owner.json('/api/bootstrap')).channels.some(c => c.id === room.id), false);
  assert.equal(f.db.prepare('SELECT rejoined_at FROM channel_departures WHERE channel_id=? AND user_id=?').get(room.id, f.owner.user.id).rejoined_at, null);
  const rejoined = await f.alice.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.owner.user.id] }); assert.deepEqual(rejoined.addedIds, [f.owner.user.id]);
  assert.ok(f.db.prepare('SELECT rejoined_at FROM channel_departures WHERE channel_id=? AND user_id=?').get(room.id, f.owner.user.id).rejoined_at);
  await f.restart(); assert.ok((await f.owner.json('/api/channels')).channels.some(c => c.id === room.id));
});

test('the last participant archives the empty room and alone can restore their participation without rejoining earlier leavers', async t => {
  const f = await fixture(t), room = (await f.alice.json('/api/channels', 'POST', { name: '보관될 프로젝트', category: 'project', memberIds: [f.bob.user.id] }, 201)).channel;
  const file = await upload(f.alice, room.id), message = await send(f.alice, room.id, { fileIds: [file.id] });
  assert.equal((await f.alice.json(`/api/channels/${room.id}/leave`, 'POST', {})).newManagerId, f.bob.user.id);
  assert.equal((await f.bob.json(`/api/channels/${room.id}/leave`, 'POST', {})).archived, true);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM memberships WHERE channel_id=?').get(room.id).n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages WHERE channel_id=?').get(room.id).n, 1);
  assert.deepEqual((await f.alice.json('/api/channels/deleted')).channels, []); assert.deepEqual((await f.owner.json('/api/channels/deleted')).channels, []);
  await f.alice.json(`/api/channels/${room.id}/restore`, 'POST', {}, 404); await f.owner.json(`/api/channels/${room.id}/restore`, 'POST', {}, 404);
  await f.restart(); const archived = (await f.bob.json('/api/channels/deleted')).channels[0]; assert.equal(archived.id, room.id); assert.equal(archived.archivedByLeave, true); assert.equal(archived.canRestore, true); assert.equal(archived.canLeave, false);
  const restored = (await f.bob.json(`/api/channels/${room.id}/restore`, 'POST', {})).channel; assert.deepEqual(restored.memberIds, [f.bob.user.id]); assert.equal(restored.canManage, true); assert.equal(restored.archivedByLeave, false);
  assert.equal((await f.bob.json(`/api/messages/${message.id}`)).message.files[0].id, file.id); assert.equal(await (await f.bob.raw(`/api/files/${file.id}`)).text(), 'retained bytes');
  await f.alice.json(`/api/messages/${message.id}`, 'GET', undefined, 404);
});

test('leaving during a cloud transfer revokes it even after reinvitation, while other crew and committed files are unaffected', async t => {
  let uploadHold = null, downloadHold = null, lastStream;
  const trashed = [];
  const driveStorage = {
    active: async () => ({ id: 'fake-cloud' }), status: async () => ({ provider: 'google-drive' }),
    async upload(input) { if (uploadHold) { uploadHold.entered.resolve(); await uploadHold.release.promise; } return { connectionId: input.connectionId, remoteId: `remote-${input.fileId}`, md5: input.md5 }; },
    async download() { if (downloadHold) { downloadHold.entered.resolve(); await downloadHold.release.promise; } lastStream = Readable.from([Buffer.from('retained bytes')]); return lastStream; },
    async trash(input) { trashed.push(input); },
  };
  const f = await fixture(t, driveStorage), room = (await f.alice.json('/api/channels', 'POST', { name: '느린 저장 프로젝트', category: 'project', memberIds: [f.bob.user.id] }, 201)).channel;
  const file = await upload(f.alice, room.id); await send(f.alice, room.id, { fileIds: [file.id] });
  uploadHold = { entered: deferred(), release: deferred() };
  const pending = f.bob.raw(`/api/channels/${room.id}/files`, 'POST', Buffer.from('pending'), { 'X-File-Name': 'pending.txt' }); await uploadHold.entered.promise;
  await f.bob.json(`/api/channels/${room.id}/leave`, 'POST', {}); await f.alice.json(`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.bob.user.id] }); uploadHold.release.resolve();
  const failed = await pending; assert.equal(failed.status, 409); await failed.json(); assert.equal(trashed.length, 1); assert.notEqual(trashed[0].fileId, file.id);
  uploadHold = null; downloadHold = { entered: deferred(), release: deferred() };
  const download = f.bob.raw(`/api/files/${file.id}`); await downloadHold.entered.promise;
  await f.bob.json(`/api/channels/${room.id}/leave`, 'POST', {}); downloadHold.release.resolve(); const rejected = await download; assert.equal(rejected.status, 404); await rejected.json(); assert.equal(lastStream.destroyed, true);
  downloadHold = null; assert.equal(await (await f.alice.raw(`/api/files/${file.id}`)).text(), 'retained bytes'); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM files WHERE channel_id=?').get(room.id).n, 1);
});
