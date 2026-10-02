import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createMessenger } from '../server.mjs';

const password = 'system-channel-fixture-password';
const localDrive = { active: async () => null, status: async () => ({ provider: 'local' }) };
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-system-channels-'));
  let app, url;
  async function start() { app = createMessenger({ dataDir: dir, port: 0, driveStorage: localDrive }); url = (await app.listen()).url; }
  await start();
  const fx = {
    dir, get db() { return app.db; },
    async restart(mutate) {
      await app.close();
      if (mutate) { const db = new DatabaseSync(join(dir, 'messenger.sqlite')); try { db.exec('PRAGMA foreign_keys=ON'); mutate(db); } finally { db.close(); } }
      await start();
    },
    client() {
      const client = { cookie: '',
        async raw(path, { method = 'GET', body, headers = {} } = {}) {
          headers = { Cookie: client.cookie, ...(method === 'GET' ? {} : { Origin: url }), ...headers };
          if (body !== undefined && !(body instanceof Uint8Array)) { body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
          const response = await fetch(url + path, { method, headers, body, signal: AbortSignal.timeout(5000) });
          const cookie = response.headers.getSetCookie().find(value => value.startsWith('synk_messenger_session='));
          if (cookie) client.cookie = cookie.split(';', 1)[0];
          return response;
        },
        async json(path, options) { const response = await client.raw(path, options), body = await response.json(); assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(body)}`); return body; },
        async forbidden(path, options) { const response = await client.raw(path, options); assert.equal(response.status, 403, `${path}: ${await response.text()}`); },
      };
      return client;
    },
    async owner() { const client = fx.client(), state = await client.json('/api/setup', { method: 'POST', body: { workspaceName: '합성 회사', name: '관리자', username: 'owner', password } }); return { client, state }; },
    async member(owner) { const invite = await owner.json('/api/invites', { method: 'POST', body: {} }), client = fx.client(), state = await client.json('/api/join', { method: 'POST', body: { code: invite.code, name: '합성 크루', username: 'crew', password } }); return { client, state }; },
  };
  t.after(async () => { await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-system-channels-')); await rm(dir, { recursive: true, force: true }); });
  return fx;
}
const byKey = state => Object.fromEntries(state.channels.filter(channel => channel.systemKey).map(channel => [channel.systemKey, channel]));
const send = (client, channelId, body, fileIds = []) => client.json(`/api/channels/${channelId}/messages`, { method: 'POST', body: { body, fileIds } });
const upload = (client, channelId, body = '보존할 첨부 원문') => client.json(`/api/channels/${channelId}/files`, { method: 'POST', headers: { 'X-File-Name': encodeURIComponent('기존 첨부.txt'), 'Content-Type': 'application/octet-stream' }, body: Buffer.from(body) });
const legacyDefaults = (db, keys) => {
  db.prepare("UPDATE channels SET system_key=NULL,name='공지사항',description='팀에 필요한 소식을 모아 두세요' WHERE id=?").run(keys.announcements.id);
  db.prepare("UPDATE channels SET system_key=NULL,name='팀 라운지',description='함께 나누는 이야기와 업무 소식' WHERE id=?").run(keys.social.id);
  db.prepare('DELETE FROM channels WHERE id=?').run(keys.info.id);
};

test('setup and later signups receive exactly three protected default rooms and preserve ordinary custom rooms', async t => {
  const fx = await fixture(t), owner = await fx.owner(), defaults = byKey(owner.state);
  assert.deepEqual(Object.keys(defaults).sort(), ['announcements', 'info', 'social']);
  assert.deepEqual(['announcements', 'info', 'social'].map(key => defaults[key].name), ['공지', '정보방', '수다방']);
  for (const channel of Object.values(defaults)) {
    assert.equal(channel.scope, 'public'); assert.equal(channel.canManage, false); assert.equal(channel.canPost, true);
    await owner.client.forbidden(`/api/channels/${channel.id}`, { method: 'PATCH', body: { name: '임의 변경' } });
  }
  const custom = (await owner.client.json('/api/channels', { method: 'POST', body: { name: '공지사항', description: '사용자가 만든 프로젝트', category: 'project', scope: 'public' } })).channel;
  assert.equal(custom.systemKey, null); assert.equal(custom.canManage, true);
  const member = await fx.member(owner.client), joined = byKey(member.state);
  assert.equal(joined.announcements.canPost, false); assert.equal(joined.info.canPost, true); assert.equal(joined.social.canPost, true);
  for (const room of Object.values(joined)) assert.ok(room.memberIds.includes(member.state.user.id));
  assert.ok(member.state.channels.some(room => room.id === custom.id && room.systemKey === null));
  for (const key of ['info', 'social']) assert.equal((await send(member.client, joined[key].id, `${key} 자유 대화`)).message.body, `${key} 자유 대화`);
});

test('legacy defaults keep channel, message and file identifiers while migration adds info once and ignores private, team and custom names', async t => {
  const fx = await fixture(t), owner = await fx.owner(), keys = byKey(owner.state), member = await fx.member(owner.client);
  const file = (await upload(owner.client, keys.announcements.id)).file;
  const notice = (await send(owner.client, keys.announcements.id, '이전 공지 원문', [file.id])).message;
  const lounge = (await send(member.client, keys.social.id, '이전 라운지 원문')).message;
  const custom = (await owner.client.json('/api/channels', { method: 'POST', body: { name: '공지사항', description: '직접 만든 공용방', category: 'generic' } })).channel;
  await fx.restart(db => {
    legacyDefaults(db, keys);
    const insert = db.prepare("INSERT INTO channels(id,name,description,kind,pair_key,created_at,category,scope,team_id) VALUES(?,?,?,?,?,'2020-01-01T00:00:00Z','generic',?,?)");
    insert.run('private-notice', '공지사항', '팀에 필요한 소식을 모아 두세요', 'dm', 'synthetic-private', 'private', null);
    insert.run('team-notice', '공지사항', '팀에 필요한 소식을 모아 두세요', 'channel', null, 'team', 'synthetic-team');
  });
  const migrated = await owner.client.json('/api/bootstrap'), current = byKey(migrated);
  assert.equal(current.announcements.id, keys.announcements.id); assert.equal(current.social.id, keys.social.id); assert.notEqual(current.info.id, keys.info.id);
  assert.equal((await owner.client.json(`/api/messages/${notice.id}`)).message.files[0].id, file.id);
  assert.equal((await member.client.json(`/api/messages/${lounge.id}`)).message.body, '이전 라운지 원문');
  assert.equal(await (await member.client.raw(`/api/files/${file.id}`)).text(), '보존할 첨부 원문');
  for (const id of ['private-notice', 'team-notice', custom.id]) assert.equal(fx.db.prepare('SELECT system_key FROM channels WHERE id=?').get(id).system_key, null);
  assert.equal(migrated.channels.find(room => room.id === custom.id).name, '공지사항');
  assert.ok(current.info.memberIds.includes(member.state.user.id));
  const snapshot = fx.db.prepare('SELECT id,system_key FROM channels ORDER BY id').all();
  await fx.restart(); await fx.restart();
  assert.deepEqual(fx.db.prepare('SELECT id,system_key FROM channels ORDER BY id').all(), snapshot);
  assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM files').get().n, 1);
  assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 2);
});

test('ambiguous old announcement candidates remain untouched instead of claiming a custom conversation', async t => {
  const fx = await fixture(t), owner = await fx.owner(), keys = byKey(owner.state);
  const message = (await send(owner.client, keys.announcements.id, '어느 방도 삭제하지 않음')).message;
  await fx.restart(db => {
    legacyDefaults(db, keys);
    db.prepare("INSERT INTO channels(id,name,description,kind,created_at,category,scope) VALUES('ambiguous-copy','공지사항','팀에 필요한 소식을 모아 두세요','channel','2020-01-01T00:00:00Z','generic','public')").run();
    db.prepare('INSERT INTO memberships(channel_id,user_id) VALUES(?,?)').run('ambiguous-copy', owner.state.user.id);
  });
  const state = await owner.client.json('/api/bootstrap'), keysAfter = byKey(state);
  assert.notEqual(keysAfter.announcements.id, keys.announcements.id);
  for (const id of [keys.announcements.id, 'ambiguous-copy']) { const room = state.channels.find(room => room.id === id); assert.equal(room.name, '공지사항'); assert.equal(room.systemKey, null); }
  assert.equal((await owner.client.json(`/api/messages/${message.id}`)).message.body, '어느 방도 삭제하지 않음');
});

test('announcement writes and uploads are owner-only while reads, reactions and historical self-deletion remain available', async t => {
  const fx = await fixture(t), owner = await fx.owner(), keys = byKey(owner.state), member = await fx.member(owner.client);
  const notice = (await send(owner.client, keys.announcements.id, '관리자 공지')).message;
  const historical = (await send(member.client, keys.social.id, '기존 크루 공지')).message;
  const draft = (await upload(member.client, keys.social.id, '기존 미전송 파일')).file;
  fx.db.prepare('UPDATE messages SET channel_id=? WHERE id=?').run(keys.announcements.id, historical.id);
  fx.db.prepare('UPDATE files SET channel_id=? WHERE id=?').run(keys.announcements.id, draft.id);
  await owner.client.json(`/api/messages/${notice.id}/pin`, { method: 'POST', body: {} });
  const filesBefore = await readdir(join(fx.dir, 'uploads'));
  for (const [path, method, body] of [
    [`/api/channels/${keys.announcements.id}/messages`, 'POST', { body: '공지 차단' }],
    [`/api/channels/${keys.announcements.id}/messages`, 'POST', { body: '답글 차단', replyToId: notice.id }],
    [`/api/messages/${historical.id}`, 'PATCH', { body: '본인 기존 공지도 편집 차단' }],
    [`/api/messages/${notice.id}/pin`, 'POST', {}],
    [`/api/messages/${notice.id}/pin`, 'DELETE', undefined],
  ]) await member.client.forbidden(path, { method, body });
  await member.client.forbidden(`/api/channels/${keys.announcements.id}/files`, { method: 'POST', headers: { 'X-File-Name': 'blocked.txt', 'Content-Type': 'application/octet-stream' }, body: Buffer.from('차단된 업로드') });
  assert.deepEqual(await readdir(join(fx.dir, 'uploads')), filesBefore);
  assert.equal((await member.client.json(`/api/messages/${historical.id}`)).message.body, '기존 크루 공지');
  await member.client.json(`/api/messages/${notice.id}/reactions`, { method: 'POST', body: { emoji: '👍' } });
  await member.client.json(`/api/messages/${historical.id}`, { method: 'DELETE' });
  await member.client.json(`/api/files/${draft.id}`, { method: 'DELETE' });
  assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM files').get().n, 0);
  const file = (await upload(owner.client, keys.announcements.id)).file;
  await send(owner.client, keys.announcements.id, '관리자 첨부 공지', [file.id]);
  await owner.client.json(`/api/messages/${notice.id}`, { method: 'PATCH', body: { body: '관리자 수정 공지' } });
  assert.equal((await member.client.json(`/api/messages/${notice.id}`)).message.body, '관리자 수정 공지');
  const normal = (await member.client.json('/api/channels', { method: 'POST', body: { name: '공지', description: '이름만 같은 일반 대화방' } })).channel;
  assert.equal(normal.systemKey, null); assert.equal(normal.canPost, true);
  await send(member.client, normal.id, '이름만으로 차단하지 않음');
});
