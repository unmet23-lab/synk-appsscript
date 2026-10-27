import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createMessenger } from '../server.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-backend-boundaries-'));
  const drive = { active: async () => null, status: async () => ({ provider: 'local' }) };
  const app = createMessenger({ dataDir: dir, port: 0, backgroundJobsEnabled: false, driveStorage: drive });
  const { url } = await app.listen();
  t.after(async () => { app.server.closeAllConnections(); await app.close(); await rm(dir, { recursive: true, force: true }); });
  function client() {
    let cookie = '';
    return {
      get cookie() { return cookie; },
      async send(path, body, method = 'POST') {
        const response = await fetch(url + path, { method, headers: { Cookie: cookie, Origin: url, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
        const next = response.headers.getSetCookie().find(value => value.startsWith('synk_messenger_session='));
        if (next) cookie = next.split(';')[0];
        return { status: response.status, body: await response.json() };
      },
    };
  }
  const owner = client();
  const setup = await owner.send('/api/setup', { workspaceName: 'Isolated boundary audit', username: 'owner', name: 'Owner', password: 'synthetic-boundary-password' });
  assert.equal(setup.status, 201);
  const room = setup.body.channels.find(row => row.systemKey === 'social').id;
  async function member(username) {
    const invitation = await owner.send('/api/invites', {}), member = client();
    const joined = await member.send('/api/join', { username, name: username, password: 'synthetic-boundary-password', code: invitation.body.code });
    assert.equal(joined.status, 201);
    return { ...member, id: joined.body.user.id };
  }
  return { app, drive, url, owner, room, member, count: table => app.db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n };
}

test('logout rejects a bootstrap response delayed by storage IO', async t => {
  const f = await fixture(t);
  let began, release;
  const started = new Promise(resolve => { began = resolve; }), held = new Promise(resolve => { release = resolve; });
  f.drive.active = () => { began(); return held; };
  t.after(() => release(null));
  const response = fetch(f.url + '/api/bootstrap', { headers: { Cookie: f.owner.cookie }, signal: AbortSignal.timeout(5000) });
  await started;
  assert.equal((await f.owner.send('/api/logout', {})).status, 200);
  release(null);
  const result = await response;
  assert.equal(result.status, 401);
  const body = await result.json();
  assert.equal(body.error, '로그인 상태가 바뀌었어요. 다시 로그인해 주세요.');
  assert.equal(body.user, undefined); assert.equal(body.channels, undefined); assert.equal(body.members, undefined);
});

test('logout rejects a partially received message before it writes data', async t => {
  const f = await fixture(t), input = JSON.stringify({ body: 'must not be stored', clientMessageId: randomUUID() });
  let began, pending;
  const started = new Promise(resolve => { began = resolve; });
  f.app.server.once('request', began);
  const result = new Promise((resolve, reject) => {
    pending = request(f.url + `/api/channels/${f.room}/messages`, { method: 'POST', headers: { Cookie: f.owner.cookie, Origin: f.url, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(input) } }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', part => { body += part; }); response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    });
    pending.on('error', reject); pending.write(input.slice(0, 8));
  });
  t.after(() => pending.destroy());
  await started;
  assert.equal((await f.owner.send('/api/logout', {})).status, 200);
  pending.end(input.slice(8));
  assert.equal((await result).status, 401);
  assert.equal(f.count('messages'), 0);
  assert.equal(f.count('message_send_requests'), 0);
});

test('notification storage failure rolls back message, attachments and receipt, and a retry delivers once', async t => {
  const f = await fixture(t), recipient = await f.member('recipient');
  const upload = await fetch(f.url + `/api/channels/${f.room}/files`, { method: 'POST', headers: { Cookie: f.owner.cookie, Origin: f.url, 'Content-Type': 'application/octet-stream', 'X-File-Name': 'synthetic.txt' }, body: 'synthetic attachment', signal: AbortSignal.timeout(5000) });
  assert.equal(upload.status, 201);
  const file = (await upload.json()).file;
  const id = randomUUID(), input = { body: 'atomic message', fileIds: [file.id], mentionIds: [recipient.id], clientMessageId: id };
  f.app.db.exec("CREATE TEMP TRIGGER reject_notification BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'synthetic notification failure'); END");
  const failed = await f.owner.send(`/api/channels/${f.room}/messages`, input);
  assert.equal(failed.status, 500);
  assert.equal(f.count('messages'), 0, 'message must roll back with its notification');
  assert.equal(f.count('message_mentions'), 0);
  assert.equal(f.count('message_send_requests'), 0);
  assert.equal(f.count('notifications'), 0);
  assert.equal(f.app.db.prepare('SELECT message_id FROM files WHERE id=?').get(file.id).message_id, null);
  f.app.db.exec('DROP TRIGGER reject_notification');
  assert.equal((await f.owner.send(`/api/channels/${f.room}/messages`, input)).status, 201);
  const replay = await f.owner.send(`/api/channels/${f.room}/messages`, input);
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true);
  assert.equal(f.count('messages'), 1); assert.equal(f.count('notifications'), 1);
  assert.equal(String(f.app.db.prepare('SELECT message_id FROM files WHERE id=?').get(file.id).message_id), replay.body.message.id);
});

test('logout rejects a partially received file and leaves no committed upload or receipt', async t => {
  const f = await fixture(t), bytes = Buffer.from('synthetic unfinished upload');
  let began, pending;
  const started = new Promise(resolve => { began = resolve; });
  f.app.server.once('request', began);
  const result = new Promise((resolve, reject) => {
    pending = request(f.url + `/api/channels/${f.room}/files`, { method: 'POST', headers: { Cookie: f.owner.cookie, Origin: f.url, 'Content-Type': 'application/octet-stream', 'X-File-Name': 'synthetic.txt', 'X-Upload-Id': randomUUID(), 'Content-Length': bytes.length } }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', part => { body += part; }); response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    });
    pending.on('error', reject); pending.write(bytes.subarray(0, 4));
  });
  t.after(() => pending.destroy());
  await started;
  assert.equal((await f.owner.send('/api/logout', {})).status, 200);
  pending.end(bytes.subarray(4));
  assert.equal((await result).status, 401);
  assert.equal(f.count('files'), 0);
  assert.equal(f.count('file_upload_requests'), 0);
});

test('notification storage failure rolls back a message edit and the old mention list', async t => {
  const f = await fixture(t), first = await f.member('first'), second = await f.member('second');
  const sent = await f.owner.send(`/api/channels/${f.room}/messages`, { body: 'original', mentionIds: [first.id], clientMessageId: randomUUID() });
  assert.equal(sent.status, 201);
  const id = sent.body.message.id;
  f.app.db.exec("CREATE TEMP TRIGGER reject_notification BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'synthetic notification failure'); END");
  const failed = await f.owner.send(`/api/messages/${id}`, { body: 'changed', mentionIds: [second.id] }, 'PATCH');
  assert.equal(failed.status, 500);
  assert.equal(f.app.db.prepare('SELECT body FROM messages WHERE id=?').get(id).body, 'original');
  assert.deepEqual(f.app.db.prepare('SELECT user_id FROM message_mentions WHERE message_id=?').all(id).map(row => row.user_id), [first.id]);
  assert.equal(f.count('notifications'), 1);
  f.app.db.exec('DROP TRIGGER reject_notification');
  assert.equal((await f.owner.send(`/api/messages/${id}`, { body: 'changed', mentionIds: [second.id] }, 'PATCH')).status, 200);
  assert.equal(f.count('notifications'), 2);
});
