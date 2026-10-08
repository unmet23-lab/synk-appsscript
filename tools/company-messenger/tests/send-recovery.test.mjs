import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { createMessenger } from '../server.mjs';

class FakeDrive {
  activeId = null;
  calls = [];
  files = new Map();
  error = null;
  barrier = null;
  trashError = null;
  trashBarrier = null;
  trashCalls = [];
  afterUpload = null;
  async active() { return this.activeId ? { id: this.activeId } : null; }
  async upload(input) {
    this.calls.push(input);
    const bytes = await readFile(input.localPath);
    assert.equal(bytes.length, input.size);
    assert.equal(createHash('md5').update(bytes).digest('hex'), input.md5);
    if (this.barrier) await this.barrier;
    if (this.error) throw this.error;
    const remoteId = `remote-${input.fileId}`;
    this.files.set(remoteId, bytes);
    this.afterUpload?.();
    return { remoteId, connectionId: input.connectionId, md5: input.md5 };
  }
  async trash({ remoteId }) { this.trashCalls.push(remoteId); if (this.trashBarrier) await this.trashBarrier; if (this.trashError) throw this.trashError; this.files.delete(remoteId); }
}
async function waitFor(check) {
  const end = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < end, 'condition did not settle'); await new Promise(resolve => setTimeout(resolve, 10)); }
}
async function fixture(t, { integrated = false, backgroundJobsEnabled = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-send-recovery-'));
  const drive = new FakeDrive();
  let app, server, url, blockedShare = false, canWrite = true, signedIn = true, companyUserId = 'synthetic-owner';
  const integration = integrated ? {
    origin: 'http://127.0.0.1:0', listUsers: () => [{ id: 'synthetic-owner', name: '합성 관리자', role: 'admin', active: true }, { id: 'synthetic-member', name: '합성 멤버', role: 'member', active: true }],
    authenticate: () => signedIn ? { companyUserId, role: companyUserId === 'synthetic-owner' ? 'admin' : 'member', canWrite, canManage: companyUserId === 'synthetic-owner', csrfToken: 'synthetic-csrf', token: 'synthetic-token', parentOrigin: integration.origin } : null,
    resolveWorkspaceLink: ({ workspaceLink }) => { if (blockedShare) throw Object.assign(new Error('private detail'), { status: typeof blockedShare === 'number' ? blockedShare : 403 }); return workspaceLink; },
  } : null;
  async function start() {
    app = createMessenger({ dataDir: dir, port: 0, driveStorage: drive, integration, backgroundJobsEnabled });
    if (integration) {
      server = createServer(app.handler);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      url = integration.origin = `http://127.0.0.1:${server.address().port}`;
      await app.startMounted();
    } else { url = (await app.listen()).url; server = app.server; }
  }
  async function stop() {
    if (integration) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
    await app.close();
  }
  await start();
  function client() {
    let cookie = '';
    return {
      get cookie() { return cookie; },
      async raw(path, method = 'GET', body, headers = {}) {
        const bytes = body instanceof Uint8Array;
        const response = await fetch(url + path, { method, headers: { Cookie: cookie, ...(method === 'GET' ? {} : { Origin: url, ...(integration ? { 'X-CSRF-Token': 'synthetic-csrf' } : {}) }), ...(body === undefined ? {} : { 'Content-Type': bytes ? 'application/octet-stream' : 'application/json' }), ...headers }, body: body === undefined ? undefined : bytes ? body : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
        const next = response.headers.getSetCookie().find(row => row.startsWith('synk_messenger_session=')); if (next) cookie = next.split(';')[0];
        return response;
      },
      async json(path, method = 'GET', body, status = 200, headers) { const response = await this.raw(path, method, body, headers); const data = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`); return data; },
    };
  }
  const owner = client();
  const boot = integrated ? await owner.json('/api/bootstrap') : await owner.json('/api/setup', 'POST', { workspaceName: '격리 전송 시험', name: '합성 관리자', username: 'owner', password: 'send-recovery-password' }, 201);
  const f = {
    owner, boot, drive, room: boot.channels.find(row => row.systemKey === 'social').id,
    get db() { return app.db; }, get url() { return url; }, get server() { return server; },
    async restart({ backgroundJobsEnabled: nextEnabled = backgroundJobsEnabled } = {}) { await stop(); backgroundJobsEnabled = nextEnabled; await start(); },
    setShareDenied(value) { blockedShare = value; }, setCanWrite(value) { canWrite = value; }, setSignedIn(value) { signedIn = value; }, setCompanyUser(value) { companyUserId = value; },
    async member() { const invite = await owner.json('/api/invites', 'POST', {}, 201); const c = client(); const state = await c.json('/api/join', 'POST', { name: '합성 멤버', username: 'member', password: 'send-recovery-password', code: invite.code }, 201); return { ...c, user: state.user }; },
    upload(id, bytes = 'original', name = 'original.txt', status = 201) { return owner.json(`/api/channels/${f.room}/files`, 'POST', Buffer.from(bytes), status, { 'X-File-Name': encodeURIComponent(name), ...(id ? { 'X-Upload-Id': id } : {}) }); },
  };
  t.after(async () => { await stop(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.split(sep).at(-1).startsWith('synk-send-recovery-')); await rm(dir, { recursive: true, force: true }); });
  return f;
}

test('response loss and restart recover the same message, files and single notification; edited/deleted originals are not recreated', async t => {
  const f = await fixture(t), member = await f.member();
  assert.deepEqual(f.boot.sendRecovery, { messages: true, uploads: true });
  const uploaded = (await f.upload(randomUUID())).file;
  const id = randomUUID(), input = { body: '원본', clientMessageId: id, fileIds: [uploaded.id], mentionIds: [member.user.id] }, path = `/api/channels/${f.room}/messages`;
  const first = await f.owner.raw(path, 'POST', input);
  assert.equal(first.status, 201); await first.body.cancel(); // The caller discards the successful response.
  const saved = f.db.prepare('SELECT * FROM messages WHERE channel_id=?').get(f.room);
  await f.restart();
  const recovered = await f.owner.json(`${path}/requests/${id}`);
  assert.equal(recovered.status, 'sent'); assert.equal(recovered.message.id, String(saved.id)); assert.equal(recovered.message.files[0].id, uploaded.id);
  for (const result of await Promise.all([f.owner.json(path, 'POST', input), f.owner.json(path, 'POST', { ...input, body: ' 원본 ' })])) { assert.equal(result.replayed, true); assert.equal(result.message.id, String(saved.id)); }
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages').get().n, 1);
  assert.equal((await member.json('/api/notifications')).items.length, 1);
  assert.equal((await f.owner.json(path, 'POST', { ...input, body: '다른 내용' }, 409)).code, 'MESSAGE_REQUEST_CONFLICT');
  await member.json(`${path}/requests/${id}`, 'GET', undefined, 404);
  await f.owner.json(`/api/messages/${saved.id}`, 'PATCH', { body: '수정한 원문' });
  assert.equal((await f.owner.json(path, 'POST', input)).message.body, '수정한 원문');
  await f.owner.json(`/api/messages/${saved.id}`, 'DELETE');
  assert.equal((await f.owner.json(path, 'POST', input, 409)).code, 'MESSAGE_DELETED');
  assert.equal((await f.owner.json(`${path}/requests/${id}`, 'GET', undefined, 409)).code, 'MESSAGE_DELETED');
  assert.equal(f.db.prepare('SELECT message_id FROM message_send_requests').get().message_id, null);
  assert.ok(!Object.keys(f.db.prepare('SELECT * FROM message_send_requests').get()).some(key => ['body', 'payload'].includes(key)));
});

test('replay survives deleted reply parent, scopes keys to user and room, and preserves unkeyed legacy posting', async t => {
  const f = await fixture(t), member = await f.member(), path = `/api/channels/${f.room}/messages`;
  const parent = (await f.owner.json(path, 'POST', { body: '부모' }, 201)).message;
  const input = { body: '답글', clientMessageId: randomUUID(), replyToId: parent.id };
  const reply = (await f.owner.json(path, 'POST', input, 201)).message;
  await f.owner.json(`/api/messages/${parent.id}`, 'DELETE');
  assert.equal((await f.owner.json(path, 'POST', input)).message.id, reply.id);
  assert.equal((await f.owner.json(`${path}/requests/${input.clientMessageId}`)).message.replyTo.deleted, true);
  await member.json(path, 'POST', { body: '멤버의 별도 요청', clientMessageId: input.clientMessageId }, 201);
  const self = f.boot.channels.find(row => row.kind === 'self').id;
  await f.owner.json(`/api/channels/${self}/messages`, 'POST', { body: '다른 방', clientMessageId: input.clientMessageId }, 201);
  const legacyA = await f.owner.json(path, 'POST', { body: '구버전' }, 201), legacyB = await f.owner.json(path, 'POST', { body: '구버전' }, 201);
  assert.notEqual(legacyA.message.id, legacyB.message.id);
  await f.owner.json(path, 'POST', { body: '잘못된 키', clientMessageId: 'same' }, 400);
  await f.owner.json(`${path}/requests/not-a-uuid`, 'GET', undefined, 400);
});

test('completed upload reuses the same bytes after restart, rejects content conflicts, and retains consumed/deleted tombstones', async t => {
  const f = await fixture(t); f.drive.activeId = 'synthetic-drive';
  const id = randomUUID(), first = (await f.upload(id)).file;
  await f.restart();
  assert.equal((await f.upload(id)).file.id, first.id); assert.equal(f.drive.calls.length, 1);
  assert.equal((await f.owner.json(`/api/channels/${f.room}/files/requests/${id}`)).file.id, first.id);
  assert.equal((await f.upload(id, 'changed!', 'original.txt', 409)).code, 'UPLOAD_REQUEST_CONFLICT');
  assert.equal((await f.upload(id, 'original', 'different.txt', 409)).code, 'UPLOAD_REQUEST_CONFLICT');
  assert.equal(f.drive.calls.length, 1, 'same length but different bytes must not reach Drive');
  const body = { body: '', fileIds: [first.id], clientMessageId: randomUUID() };
  const sent = (await f.owner.json(`/api/channels/${f.room}/messages`, 'POST', body, 201)).message;
  assert.equal((await f.upload(id, 'original', 'original.txt', 409)).code, 'UPLOAD_CONSUMED');
  assert.equal((await f.owner.json(`/api/channels/${f.room}/files/requests/${id}`, 'GET', undefined, 409)).code, 'UPLOAD_CONSUMED');
  assert.equal((await f.owner.json(`/api/channels/${f.room}/messages`, 'POST', body)).message.id, sent.id);
  await f.owner.json(`/api/messages/${sent.id}`, 'DELETE');
  assert.equal((await f.upload(id, 'original', 'original.txt', 409)).code, 'UPLOAD_DELETED');
  const cancelledId = randomUUID(), cancelled = (await f.upload(cancelledId)).file;
  await f.owner.json(`/api/files/${cancelled.id}`, 'DELETE');
  assert.equal((await f.upload(cancelledId, 'original', 'original.txt', 409)).code, 'UPLOAD_DELETED');
  assert.equal(f.drive.calls.length, 2);
  const a = (await f.upload(null)).file, b = (await f.upload(null)).file; assert.notEqual(a.id, b.id);
});

test('concurrent uploads call Drive once; a known failure retries while interrupted remote writes stay blocked after restart', async t => {
  const f = await fixture(t); f.drive.activeId = 'synthetic-drive';
  let release; f.drive.barrier = new Promise(resolve => { release = resolve; });
  const id = randomUUID(), first = f.upload(id);
  await waitFor(() => f.drive.calls.length === 1);
  const pending = await f.upload(id, 'original', 'original.txt', 409);
  assert.equal(pending.code, 'UPLOAD_IN_PROGRESS'); assert.equal(pending.status, 'pending'); assert.equal(pending.retryable, false);
  assert.equal((await f.owner.json(`/api/channels/${f.room}/files/requests/${id}`, 'GET', undefined, 409)).code, 'UPLOAD_IN_PROGRESS');
  release(); const file = (await first).file; f.drive.barrier = null;
  assert.equal((await f.upload(id)).file.id, file.id); assert.equal(f.drive.calls.length, 1);
  const failedId = randomUUID(); f.drive.error = Object.assign(new Error('synthetic failure'), { status: 503, publicMessage: '합성 실패' });
  await f.upload(failedId, 'original', 'original.txt', 503);
  assert.equal((await f.owner.json(`/api/channels/${f.room}/files/requests/${failedId}`, 'GET', undefined, 404)).code, 'UPLOAD_NOT_COMPLETE');
  f.drive.error = null; await f.upload(failedId); assert.equal(f.drive.calls.length, 3);
  // Materialize only the durable boundary a killed process leaves immediately before remote I/O.
  const unknown = randomUUID(), digest = createHash('sha256').update('original').digest('hex');
  const fingerprint = createHash('sha256').update(JSON.stringify(['original.txt', 8, digest])).digest('hex');
  f.db.prepare("INSERT INTO file_upload_requests(user_id,channel_id,request_id,payload_hash,state,created_at) VALUES(?,?,?,?,'pending',?)").run(f.boot.user.id, f.room, unknown, fingerprint, new Date().toISOString());
  await f.restart();
  const uncertain = await f.upload(unknown, 'original', 'original.txt', 409);
  assert.equal(uncertain.code, 'UPLOAD_UNCERTAIN'); assert.equal(uncertain.status, 'uncertain'); assert.equal(uncertain.retryable, false);
  assert.deepEqual(await f.owner.json(`/api/channels/${f.room}/files/requests/${unknown}`, 'DELETE'), { status: 'cancelled' }, 'cancelling the pending request does not claim that its remote object was removed');
  assert.equal((await f.upload(unknown, 'original', 'original.txt', 409)).code, 'UPLOAD_CANCELLED');
  await f.restart();
  assert.equal((await f.upload(unknown, 'original', 'original.txt', 409)).code, 'UPLOAD_CANCELLED');
  assert.equal(f.drive.calls.length, 3);
});

test('upload response disconnection after Drive started preserves discoverable completed file', async t => {
  const f = await fixture(t); f.drive.activeId = 'synthetic-drive';
  let release; f.drive.barrier = new Promise(resolve => { release = resolve; });
  const id = randomUUID();
  const req = httpRequest(`${f.url}/api/channels/${f.room}/files`, { method: 'POST', headers: { Cookie: f.owner.cookie, Origin: f.url, 'X-File-Name': 'response-lost.txt', 'X-Upload-Id': id, 'Content-Length': '8' } });
  req.on('error', () => {}); req.end('original');
  await waitFor(() => f.drive.calls.length === 1); req.destroy(); release();
  await waitFor(() => f.db.prepare("SELECT state FROM file_upload_requests WHERE request_id=?").get(id)?.state === 'complete');
  assert.equal((await f.owner.json(`/api/channels/${f.room}/files/requests/${id}`)).file.name, 'response-lost.txt');
  assert.equal(f.drive.files.size, 1);
});

test('recovery rechecks company auth, posting, CSRF and current workspace sharing permissions', async t => {
  const f = await fixture(t, { integrated: true });
  const input = { body: '공유 원문', clientMessageId: randomUUID(), workspaceLink: { title: '기획', url: '/#view=content&section=plan&draftId=synthetic-plan' } }, path = `/api/channels/${f.room}/messages`;
  await f.owner.json(path, 'POST', input, 201);
  const uploadId = randomUUID(); await f.upload(uploadId);
  await f.owner.json(path, 'POST', input, 403, { 'X-CSRF-Token': 'wrong' });
  f.setShareDenied(true);
  for (const [route, method, body] of [[path, 'POST', input], [`${path}/requests/${input.clientMessageId}`, 'GET']]) {
    const result = await f.owner.json(route, method, body); assert.equal(result.status, 'sent'); assert.equal(result.unavailable, true); assert.equal(result.message, undefined);
  }
  await f.owner.json(path, 'POST', { ...input, clientMessageId: randomUUID() }, 403);
  f.setShareDenied(false); f.setCanWrite(false);
  await f.owner.json(path, 'POST', input, 403);
  // Read-only users can inspect their completed receipt but cannot trigger a new post/upload.
  f.setCanWrite(true); f.setSignedIn(false);
  await f.owner.json(`${path}/requests/${input.clientMessageId}`, 'GET', undefined, 401);
  await f.owner.json(`/api/channels/${f.room}/files/requests/${uploadId}`, 'GET', undefined, 401);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages').get().n, 1);
});

test('recovery does not disclose a selected project after its author leaves', async t => {
  const f = await fixture(t), member = await f.member();
  const room = (await f.owner.json('/api/channels', 'POST', { name: '선택 프로젝트', category: 'project', memberIds: [member.user.id] }, 201)).channel;
  f.room = room.id;
  const input = { body: '비공개', clientMessageId: randomUUID() }, path = `/api/channels/${room.id}/messages`, uploadId = randomUUID();
  await f.owner.json(path, 'POST', input, 201); await f.upload(uploadId);
  await f.owner.json(`/api/channels/${room.id}/leave`, 'POST', {});
  await f.owner.json(path, 'POST', input, 404);
  await f.owner.json(`${path}/requests/${input.clientMessageId}`, 'GET', undefined, 404);
  await f.owner.json(`/api/channels/${room.id}/files/requests/${uploadId}`, 'GET', undefined, 404);
  await f.upload(uploadId, 'original', 'original.txt', 404);
});

test('cancellation tombstones stop late streaming posts and survive restart; completed messages are returned without deletion', async t => {
  const f = await fixture(t), id = randomUUID(), path = `/api/channels/${f.room}/messages`, receiptPath = `${path}/requests/${id}`;
  const input = { body: '늦게 도착한 원문', clientMessageId: id }, bytes = Buffer.from(JSON.stringify(input));
  let finish;
  const response = new Promise((resolve, reject) => {
    const req = httpRequest(f.url + path, { method: 'POST', headers: { Cookie: f.owner.cookie, Origin: f.url, 'Content-Type': 'application/json', 'Content-Length': String(bytes.length) } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    req.on('error', reject); req.write(bytes.subarray(0, 10)); finish = () => req.end(bytes.subarray(10));
  });
  assert.equal((await f.owner.json(receiptPath, 'DELETE')).status, 'cancelled');
  finish(); const late = await response;
  assert.equal(late.status, 409); assert.equal(late.body.code, 'MESSAGE_CANCELLED');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages').get().n, 0);
  await f.restart();
  assert.equal((await f.owner.json(path, 'POST', input, 409)).code, 'MESSAGE_CANCELLED');
  assert.equal((await f.owner.json(receiptPath, 'GET', undefined, 409)).code, 'MESSAGE_CANCELLED');
  assert.equal((await f.owner.json(receiptPath, 'DELETE')).status, 'cancelled');
  const completedInput = { body: '이미 저장한 원문', clientMessageId: randomUUID() };
  const sent = (await f.owner.json(path, 'POST', completedInput, 201)).message;
  const cancellation = await f.owner.json(`${path}/requests/${completedInput.clientMessageId}`, 'DELETE');
  assert.equal(cancellation.status, 'sent'); assert.equal(cancellation.message.id, sent.id);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages').get().n, 1);
});

test('a departed mention target does not invalidate an already committed send receipt', async t => {
  const f = await fixture(t), member = await f.member();
  const room = (await f.owner.json('/api/channels', 'POST', { name: '멘션 프로젝트', category: 'project', memberIds: [member.user.id] }, 201)).channel;
  const input = { body: '멘션 원문', mentionIds: [member.user.id], clientMessageId: randomUUID() }, path = `/api/channels/${room.id}/messages`;
  const first = (await f.owner.json(path, 'POST', input, 201)).message;
  await member.json(`/api/channels/${room.id}/leave`, 'POST', {});
  assert.equal((await f.owner.json(path, 'POST', input)).message.id, first.id);
  assert.equal((await f.owner.json(`${path}/requests/${input.clientMessageId}`)).message.id, first.id);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages').get().n, 1);
});

test('upload cancellation blocks delayed bodies and remote completions; consumed files cannot be cancelled', async t => {
  const f = await fixture(t), id = randomUUID(), route = `/api/channels/${f.room}/files`;
  let finish;
  const response = new Promise((resolve, reject) => {
    const req = httpRequest(f.url + route, { method: 'POST', headers: { Cookie: f.owner.cookie, Origin: f.url, 'X-File-Name': 'original.txt', 'X-Upload-Id': id, 'Content-Length': '8' } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    req.on('error', reject); req.write('orig'); finish = () => req.end('inal');
  });
  assert.equal((await f.owner.json(`${route}/requests/${id}`, 'DELETE')).status, 'cancelled');
  finish(); const late = await response; assert.equal(late.status, 409); assert.equal(late.body.code, 'UPLOAD_CANCELLED');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM files').get().n, 0);
  await f.restart(); assert.equal((await f.upload(id, 'original', 'original.txt', 409)).code, 'UPLOAD_CANCELLED');
  f.drive.activeId = 'synthetic-drive';
  let release; f.drive.barrier = new Promise(resolve => { release = resolve; });
  const remoteId = randomUUID(), pending = f.upload(remoteId, 'original', 'original.txt', 409);
  await waitFor(() => f.drive.calls.length === 1);
  assert.equal((await f.owner.json(`${route}/requests/${remoteId}`, 'DELETE')).status, 'cancelled');
  release(); assert.equal((await pending).code, 'UPLOAD_CANCELLED'); f.drive.barrier = null;
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM files').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM drive_delete_outbox').get().n, 1, 'background jobs are disabled, so remote cleanup intent must remain durable');
  const completeId = randomUUID(), file = (await f.upload(completeId)).file;
  assert.equal((await f.owner.json(`${route}/requests/${completeId}`, 'DELETE')).status, 'cancelled');
  assert.equal(f.db.prepare('SELECT id FROM files WHERE id=?').get(file.id), undefined);
  const consumedId = randomUUID(), consumed = (await f.upload(consumedId)).file;
  await f.owner.json(`/api/channels/${f.room}/messages`, 'POST', { body: '', fileIds: [consumed.id], clientMessageId: randomUUID() }, 201);
  assert.equal((await f.owner.json(`${route}/requests/${consumedId}`, 'DELETE', undefined, 409)).code, 'UPLOAD_CONSUMED');
  assert.ok(f.db.prepare('SELECT id FROM files WHERE id=?').get(consumed.id));
});

test('a removed or inaccessible plan returns only completion metadata for owned receipts without reposting or leaking to another user or room', async t => {
  const f = await fixture(t, { integrated: true });
  const member = f.boot.members.find(row => row.id !== f.boot.user.id);
  const attachment = (await f.upload(randomUUID(), 'private bytes', 'private.txt')).file;
  const input = { body: '비공개 원문', fileIds: [attachment.id], mentionIds: [member.id], clientMessageId: randomUUID(), workspaceLink: { title: '비공개 기획', url: '/#view=content&section=plan&draftId=private-plan' } };
  const path = `/api/channels/${f.room}/messages`, receiptPath = `${path}/requests/${input.clientMessageId}`;
  const sent = (await f.owner.json(path, 'POST', input, 201)).message;
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM notifications WHERE message_id=?').get(sent.id).n, 1);
  assert.equal((await f.owner.json('/api/bootstrap')).channels.find(row => row.id === f.room).canPost, true);
  for (const status of [403, 404]) {
    f.setShareDenied(status);
    for (const [route, method, body] of [[receiptPath, 'GET'], [path, 'POST', input], [receiptPath, 'DELETE']]) {
      const result = await f.owner.json(route, method, body);
      assert.deepEqual(result, { status: 'sent', unavailable: true, ...(method === 'POST' ? { replayed: true } : {}) });
      assert.doesNotMatch(JSON.stringify(result), /private|비공개|file|messageId|body/);
    }
    await f.owner.json(path, 'POST', { ...input, clientMessageId: randomUUID() }, status, undefined);
  }
  await f.owner.json(path, 'POST', { ...input, body: '다른 원문' }, 409);
  await f.owner.json(receiptPath, 'DELETE', undefined, 403, { 'X-CSRF-Token': 'wrong' });
  for (const status of [401, 500]) {
    f.setShareDenied(status);
    for (const [route, method, body] of [[receiptPath, 'GET'], [path, 'POST', input], [receiptPath, 'DELETE']]) await f.owner.json(route, method, body, status);
  }
  f.setShareDenied(403); f.setCanWrite(false);
  await f.owner.json(path, 'POST', input, 403); await f.owner.json(receiptPath, 'DELETE', undefined, 403);
  f.setCanWrite(true);
  const self = f.boot.channels.find(row => row.kind === 'self').id;
  await f.owner.json(`/api/channels/${self}/messages/requests/${input.clientMessageId}`, 'GET', undefined, 404);
  assert.deepEqual(await f.owner.json(`/api/channels/${self}/messages/requests/${input.clientMessageId}`, 'DELETE'), { status: 'cancelled' });
  f.setCompanyUser('synthetic-member');
  await f.owner.json(receiptPath, 'GET', undefined, 404);
  assert.deepEqual(await f.owner.json(receiptPath, 'DELETE'), { status: 'cancelled' });
  await f.owner.json(`/api/channels/${self}/messages/requests/${input.clientMessageId}`, 'GET', undefined, 404);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM messages').get().n, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM notifications WHERE message_id=?').get(sent.id).n, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM files WHERE message_id=?').get(sent.id).n, 1);
  assert.equal(f.db.prepare('SELECT state FROM message_send_requests WHERE user_id=? AND channel_id=? AND request_id=?').get(f.boot.user.id, f.room, input.clientMessageId).state, 'sent');
});

test('a lost legacy file cancellation response is recoverable only with the current owners private deletion receipt', async t => {
  const f = await fixture(t), member = await f.member();
  const legacy = (await f.upload(null, 'legacy attachment', 'legacy.txt')).file;
  const lost = await f.owner.raw(`/api/files/${legacy.id}`, 'DELETE');
  assert.equal(lost.status, 200); await lost.body.cancel();
  assert.equal(f.db.prepare('SELECT id FROM files WHERE id=?').get(legacy.id), undefined);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM file_deletion_receipts WHERE user_id=? AND file_id=?').get(f.boot.user.id, legacy.id).n, 1);
  await f.restart();
  assert.equal((await f.owner.json(`/api/files/${legacy.id}`, 'DELETE', undefined, 404)).code, 'UPLOAD_DELETED');
  const missing = await member.json(`/api/files/${randomUUID()}`, 'DELETE', undefined, 404);
  assert.deepEqual(await member.json(`/api/files/${legacy.id}`, 'DELETE', undefined, 404), missing);
  const stillPrivate = (await f.upload(null, 'private staged bytes', 'private.txt')).file;
  assert.deepEqual(await member.json(`/api/files/${stillPrivate.id}`, 'DELETE', undefined, 404), missing, 'another users existing, deleted and never-existing staged files are indistinguishable');
  const posted = (await f.upload(randomUUID())).file;
  await f.owner.json(`/api/channels/${f.room}/messages`, 'POST', { body: '', fileIds: [posted.id], clientMessageId: randomUUID() }, 201);
  assert.equal((await f.owner.json(`/api/files/${posted.id}`, 'DELETE', undefined, 409)).code, 'UPLOAD_CONSUMED');
  const consumedOther = await member.json(`/api/files/${posted.id}`, 'DELETE', undefined, 403);
  assert.equal(consumedOther.code, undefined, 'a different user cannot use the owners cancellation receipt');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM file_deletion_receipts WHERE file_id=?').get(posted.id).n, 0);
  const room = (await f.owner.json('/api/channels', 'POST', { name: '취소 권한 프로젝트', category: 'project', memberIds: [member.user.id] }, 201)).channel;
  f.room = room.id;
  const privateFile = (await f.upload(null)).file;
  await f.owner.json(`/api/files/${privateFile.id}`, 'DELETE');
  await f.owner.json(`/api/channels/${room.id}/leave`, 'POST', {});
  const revoked = await f.owner.json(`/api/files/${privateFile.id}`, 'DELETE', undefined, 404);
  assert.equal(revoked.code, undefined, 'a deletion receipt cannot bypass the current room access check');
});

for (const scenario of ['worker-paused', 'Drive-grant-revoked', 'other-cleanup-running']) test(`uncertain upload cancellation preserves remote cleanup after ${scenario}`, async t => {
  const f = await fixture(t, { integrated: true, backgroundJobsEnabled: scenario !== 'worker-paused' });
  f.drive.activeId = 'synthetic-drive';
  let releaseOther;
  if (scenario === 'Drive-grant-revoked') f.drive.trashError = Object.assign(new Error('synthetic revoked Drive grant'), { publicMessage: '합성 Drive 권한 회수' });
  if (scenario === 'other-cleanup-running') {
    f.drive.trashBarrier = new Promise(resolve => { releaseOther = resolve; });
    f.db.prepare('INSERT INTO drive_delete_outbox(file_id,connection_id,remote_id,created_at) VALUES(?,?,?,?)').run(randomUUID(), 'synthetic-drive', 'remote-existing-cleanup', new Date().toISOString());
    await f.restart();
    await waitFor(() => f.drive.trashCalls.includes('remote-existing-cleanup'));
  }
  f.drive.afterUpload = () => f.setCanWrite(false);
  const key = randomUUID(), uploading = f.upload(key, 'original', 'original.txt', 403);
  if (releaseOther) {
    await waitFor(() => f.drive.files.size === 1);
    releaseOther(); f.drive.trashBarrier = null;
  }
  await uploading;
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM files').get().n, 0);
  assert.equal(f.db.prepare('SELECT state FROM file_upload_requests WHERE request_id=?').get(key).state, 'pending');
  const cleanup = f.db.prepare('SELECT * FROM drive_delete_outbox').all();
  assert.equal(cleanup.length, 1);
  assert.equal(f.drive.files.size, 1, 'remote object remains pending cleanup rather than being labelled deleted');
  const route = `/api/channels/${f.room}/files/requests/${key}`;
  await f.owner.json(route, 'DELETE', undefined, 403);
  f.setCanWrite(true);
  assert.deepEqual(await f.owner.json(route, 'DELETE'), { status: 'cancelled' });
  assert.deepEqual(f.db.prepare('SELECT * FROM drive_delete_outbox').all(), cleanup, 'cancellation preserves the exact existing remote cleanup intent');
  assert.equal((await f.upload(key, 'original', 'original.txt', 409)).code, 'UPLOAD_CANCELLED');
  assert.equal(f.drive.calls.length, 1, 'cancelled key never starts another remote write');
  f.drive.trashError = null; f.drive.afterUpload = null;
  await f.restart({ backgroundJobsEnabled: true });
  await waitFor(() => f.db.prepare('SELECT COUNT(*) n FROM drive_delete_outbox').get().n === 0);
  assert.equal(f.drive.files.size, 0);
  assert.equal(f.db.prepare('SELECT state FROM file_upload_requests WHERE request_id=?').get(key).state, 'cancelled');
  assert.equal((await f.upload(key, 'original', 'original.txt', 409)).code, 'UPLOAD_CANCELLED');
});
