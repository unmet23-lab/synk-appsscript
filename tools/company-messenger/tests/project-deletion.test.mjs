import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { createMessenger } from '../server.mjs';

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function fixture(t, driveStorage = { active: async () => null, status: async () => ({ provider: 'local' }) }) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-project-deletion-'));
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
    };
  }
  const owner = client(); const state = await owner.json('/api/setup', 'POST', { name: 'owner', username: 'owner', password: 'deletion-fixture-password', workspaceName: '삭제 복원 시험' }, 201);
  const member = async name => { const invite = await owner.json('/api/invites', 'POST', {}, 201), c = client(); const boot = await c.json('/api/join', 'POST', { name, username: name, password: 'deletion-fixture-password', code: invite.code }, 201); return { ...c, state: boot, user: boot.user }; };
  const fx = { owner: { ...owner, state, user: state.user }, alice: await member('alice'), bob: await member('bob'), member, get db() { return app.db; }, async restart() { await app.close(); await start(); } };
  t.after(async () => { await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-project-deletion-')); await rm(dir, { recursive: true, force: true }); });
  return fx;
}
const upload = async (person, id, text = '보존할 자료') => (await person.json(`/api/channels/${id}/files`, 'POST', Buffer.from(text), 201, { 'X-File-Name': 'preserve.txt' })).file;
const send = async (person, id, extras = {}) => (await person.json(`/api/channels/${id}/messages`, 'POST', { body: '복원할 프로젝트 원문', ...extras }, 201)).message;

test('deleting a project hides every source and personal index, preserves its records and resumes an overdue reminder after restore', async t => {
  const f = await fixture(t);
  const room = (await f.alice.json('/api/channels', 'POST', { name: '복원 프로젝트', category: 'project', memberIds: [f.bob.user.id] }, 201)).channel;
  const file = await upload(f.alice, room.id), message = await send(f.alice, room.id, { fileIds: [file.id], mentionIds: [f.bob.user.id] });
  await f.bob.json(`/api/messages/${message.id}/save`, 'POST', {});
  await f.bob.json(`/api/messages/${message.id}/reminder`, 'PUT', { remindAt: new Date(Date.now() + 3600000).toISOString() });
  await f.alice.json(`/api/messages/${message.id}/task`, 'POST', { assigneeId: f.bob.user.id }, 201);
  await f.alice.json(`/api/messages/${message.id}/pin`, 'POST', {});
  const reply = await send(f.bob, room.id, { replyToId: message.id });
  assert.equal(room.canDelete, true); await f.bob.json(`/api/channels/${room.id}`, 'DELETE', undefined, 403); await f.owner.json(`/api/channels/${room.id}`, 'DELETE', undefined, 404);
  await f.alice.json(`/api/channels/${room.id}`, 'DELETE'); await f.alice.json(`/api/channels/${room.id}`, 'DELETE');
  const deleted = (await f.alice.json('/api/channels/deleted')).channels;
  assert.equal(deleted.length, 1); assert.equal(deleted[0].id, room.id); assert.ok(deleted[0].deletedAt); assert.equal(deleted[0].deletedBy.id, f.alice.user.id);
  for (const key of ['canPost', 'canManage', 'canInvite', 'canDelete']) assert.equal(deleted[0][key], false); assert.equal(deleted[0].canRestore, true);
  assert.deepEqual((await f.bob.json('/api/channels/deleted')).channels, []); assert.deepEqual((await f.owner.json('/api/channels/deleted')).channels, []);
  for (const path of [`/api/channels/${room.id}/messages`, `/api/channels/${room.id}/members`, `/api/channels/${room.id}/pins`, `/api/channels/${room.id}/notifications`, `/api/messages/${message.id}`, `/api/messages/${message.id}/replies`, `/api/messages/${reply.id}`, `/api/files/${file.id}`, `/api/search?channelId=${room.id}`, `/api/tasks?scope=channel&channelId=${room.id}`]) await f.alice.json(path, 'GET', undefined, 404);
  for (const [path, method, body] of [[`/api/channels/${room.id}/messages`, 'POST', { body: '삭제 후 전송' }], [`/api/channels/${room.id}/members`, 'POST', { memberIds: [f.owner.user.id] }], [`/api/channels/${room.id}/read`, 'POST', {}], [`/api/messages/${message.id}/save`, 'POST', {}], [`/api/messages/${message.id}/task`, 'PATCH', { status: 'done' }], [`/api/messages/${message.id}/pin`, 'DELETE', undefined]]) await f.alice.json(path, method, body, 404);
  assert.equal((await f.bob.json('/api/bootstrap')).channels.some(c => c.id === room.id), false);
  for (const [path, key] of [['/api/search?q=프로젝트', 'messages'], ['/api/files', 'files'], ['/api/tasks?scope=all', 'tasks'], ['/api/saved', 'messages'], ['/api/reminders', 'reminders'], ['/api/notifications', 'items']]) assert.deepEqual((await f.bob.json(path))[key], []);
  assert.equal((await f.bob.json('/api/storage')).messageCount, 0);
  f.db.prepare("UPDATE message_reminders SET remind_at='2000-01-01T00:00:00.000Z'").run();
  await f.restart();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM message_reminders').get().n, 1); assert.equal(f.db.prepare('SELECT delivered_at FROM message_reminders').get().delivered_at, null);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages WHERE channel_id=?').get(room.id).n, 2); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM files WHERE id=?').get(file.id).n, 1);
  await f.bob.json(`/api/channels/${room.id}/restore`, 'POST', {}, 403); await f.owner.json(`/api/channels/${room.id}/restore`, 'POST', {}, 404);
  const restored = (await f.alice.json(`/api/channels/${room.id}/restore`, 'POST', {})).channel; assert.equal(restored.id, room.id); assert.equal(restored.deletedAt, null); assert.equal(restored.canDelete, true);
  await f.alice.json(`/api/channels/${room.id}/restore`, 'POST', {});
  const current = (await f.bob.json(`/api/messages/${message.id}`)).message; assert.equal(current.files[0].id, file.id); assert.equal(current.pinned, true); assert.equal(current.saved, true); assert.equal(current.task.assignee.id, f.bob.user.id);
  assert.equal(await (await f.bob.raw(`/api/files/${file.id}`)).text(), '보존할 자료');
  const inbox = (await f.bob.json('/api/notifications')).items; assert.equal(inbox.filter(row => row.kind === 'reminder').length, 1);
  await f.restart(); assert.equal((await f.bob.json('/api/notifications')).items.filter(row => row.kind === 'reminder').length, 1);
});

test('public restoration admits current crew while deleted rooms never autojoin, and protected room types cannot be deleted', async t => {
  const f = await fixture(t);
  const room = (await f.alice.json('/api/channels', 'POST', { name: '공개 프로젝트', category: 'project', scope: 'public' }, 201)).channel;
  const generic = (await f.alice.json('/api/channels', 'POST', { name: '일반방' }, 201)).channel;
  const categoryTeam = (await f.alice.json('/api/channels', 'POST', { name: '공용 팀 분류', category: 'team' }, 201)).channel;
  const dm = (await f.owner.json('/api/dms', 'POST', { userId: f.alice.user.id }, 201)).channel;
  for (const channel of [...f.owner.state.channels, generic, categoryTeam, dm]) await f.owner.json(`/api/channels/${channel.id}`, 'DELETE', undefined, 403);
  await f.owner.json(`/api/channels/${room.id}`, 'DELETE');
  assert.equal((await f.owner.json('/api/channels/deleted')).channels[0].id, room.id);
  const newcomer = await f.member('newcomer');
  assert.equal(f.db.prepare('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?').get(room.id, newcomer.user.id), undefined);
  assert.equal(newcomer.state.channels.some(c => c.id === room.id), false);
  await f.owner.json(`/api/channels/${room.id}/restore`, 'POST', {});
  assert.ok((await newcomer.json('/api/channels')).channels.some(c => c.id === room.id)); assert.deepEqual((await f.alice.json('/api/channels/deleted')).channels, []);
});

test('deleting a cloud project retains committed objects but rejects pending upload/download after delete and restore', async t => {
  let uploadHold = null, downloadHold = null, latestDownload = null;
  const trashed = [];
  const driveStorage = {
    active: async () => ({ id: 'test-cloud' }), status: async () => ({ provider: 'google-drive' }),
    async upload(input) { if (uploadHold) { uploadHold.entered.resolve(); await uploadHold.release.promise; } return { connectionId: input.connectionId, remoteId: `remote-${input.fileId}`, md5: input.md5 }; },
    async download() { if (downloadHold) { downloadHold.entered.resolve(); await downloadHold.release.promise; } latestDownload = Readable.from([Buffer.from('cloud bytes')]); return latestDownload; },
    async trash(input) { trashed.push(input); },
  };
  const f = await fixture(t, driveStorage), room = (await f.owner.json('/api/channels', 'POST', { name: 'Drive 프로젝트', category: 'project' }, 201)).channel;
  const committed = await upload(f.owner, room.id, 'cloud bytes'); await send(f.owner, room.id, { fileIds: [committed.id] });
  uploadHold = { entered: deferred(), release: deferred() };
  const pending = f.owner.raw(`/api/channels/${room.id}/files`, 'POST', Buffer.from('pending bytes'), { 'X-File-Name': 'pending.txt' });
  await uploadHold.entered.promise;
  await f.owner.json(`/api/channels/${room.id}`, 'DELETE'); assert.equal(trashed.length, 0, 'soft delete does not trash committed files');
  await f.owner.json(`/api/channels/${room.id}/restore`, 'POST', {}); uploadHold.release.resolve();
  const failed = await pending; assert.equal(failed.status, 409); await failed.json();
  assert.equal(trashed.length, 1); assert.notEqual(trashed[0].fileId, committed.id);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM files WHERE channel_id=?').get(room.id).n, 1);
  uploadHold = null; downloadHold = { entered: deferred(), release: deferred() };
  const download = f.owner.raw(`/api/files/${committed.id}`); await downloadHold.entered.promise;
  await f.owner.json(`/api/channels/${room.id}`, 'DELETE'); downloadHold.release.resolve();
  const rejected = await download; assert.equal(rejected.status, 404); await rejected.json(); assert.equal(latestDownload.destroyed, true);
  assert.equal(trashed.length, 1); assert.ok(f.db.prepare('SELECT id FROM files WHERE id=?').get(committed.id));
});
