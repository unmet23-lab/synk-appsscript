import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { request } from 'node:http';
import { createMessenger } from '../server.mjs';

const password = 'Drive-tests-only-2026!';
const checksum = body => createHash('md5').update(body).digest('hex');
const safeError = (status, publicMessage) => Object.assign(new Error(publicMessage), { status, publicMessage });

class FakeDriveStorage {
  constructor() {
    this.activeId = null;
    this.connections = ['alpha', 'beta'].map(id => ({ id, email: `${id}@example.test`, folderId: `folder-${id}` }));
    this.files = new Map();
    this.calls = [];
    this.uploadError = null;
    this.trashError = null;
    this.statusError = null;
  }
  async active() { return this.connections.find(connection => connection.id === this.activeId) || null; }
  async status() {
    const active = await this.active();
    return {
      provider: active ? 'google-drive' : 'local',
      activeConnectionId: active?.id || null,
      connections: this.connections.map(({ id, email, folderId }) => ({ id, email, folderUrl: `https://drive.google.com/drive/folders/${folderId}`, active: id === this.activeId })),
      status: this.statusError ? 'error' : active ? 'connected' : 'local',
      account: active ? { email: active.email, name: '테스트 계정', limitBytes: 5497558138880, usedBytes: 1024, driveBytes: 512, trashBytes: 0 } : null,
      error: this.statusError,
      verifiedAt: active ? new Date().toISOString() : null,
    };
  }
  async setActive(id) {
    if (id !== null && !this.connections.some(c => c.id === id)) throw safeError(400, '등록되지 않은 Drive 연결입니다.');
    this.activeId = id;
    return this.status();
  }
  async upload(input) {
    const { connectionId, localPath, name, size, md5, fileId } = input;
    this.calls.push({ method: 'upload', connectionId, name, fileId });
    if (this.uploadError) throw this.uploadError;
    const data = await readFile(localPath);
    assert.equal(data.length, size);
    assert.equal(checksum(data), md5);
    const remoteId = `remote-${fileId}`;
    this.files.set(remoteId, { data, connectionId, fileId });
    return { remoteId, connectionId, md5 };
  }
  async download({ connectionId, remoteId, fileId }) {
    this.calls.push({ method: 'download', connectionId, remoteId, fileId });
    const file = this.files.get(remoteId);
    assert.ok(file, 'the backend must download a registered remote object');
    assert.equal(file.connectionId, connectionId);
    assert.equal(file.fileId, fileId);
    return Readable.from(file.data);
  }
  async trash({ connectionId, remoteId, fileId }) {
    this.calls.push({ method: 'trash', connectionId, remoteId, fileId });
    if (this.trashError) throw this.trashError;
    const file = this.files.get(remoteId);
    if (file) {
      assert.equal(file.connectionId, connectionId);
      assert.equal(file.fileId, fileId);
      this.files.delete(remoteId);
    }
  }
}

async function waitUntil(fn, message, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  assert.fail(message);
}

async function fixture(t, drive = new FakeDriveStorage()) {
  const dataDir = await mkdtemp(join(tmpdir(), 'synk-drive-api-test-'));
  let app = createMessenger({ dataDir, port: 0, host: '127.0.0.1', driveStorage: drive });
  let address = await app.listen();
  const fx = {
    dataDir, drive,
    get url() { return address.url; },
    get db() { return app.db; },
    async restart({ legacy = false } = {}) {
      await app.close();
      if (legacy) {
        const db = new DatabaseSync(join(dataDir, 'messenger.sqlite'));
        try {
          for (const name of ['storage_provider', 'storage_connection_id', 'storage_remote_id', 'md5']) {
            const columns = db.prepare('PRAGMA table_info(files)').all();
            if (columns.some(c => c.name === name)) db.exec(`ALTER TABLE files DROP COLUMN ${name}`);
          }
        } finally { db.close(); }
      }
      app = createMessenger({ dataDir, port: 0, host: '127.0.0.1', driveStorage: drive });
      address = await app.listen();
    },
    client() {
      const client = {
        cookie: '',
        async raw(path, { method = 'GET', body, headers = {} } = {}) {
          headers = { ...headers };
          if (client.cookie) headers.Cookie = client.cookie;
          if (method !== 'GET') headers.Origin = fx.url;
          if (body !== undefined && !(body instanceof Uint8Array)) { body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
          const res = await fetch(fx.url + path, { method, body, headers, signal: AbortSignal.timeout(5000) });
          const cookie = res.headers.getSetCookie().find(c => c.startsWith('synk_messenger_session='));
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
          const json = await res.json();
          assert.ok([400, 401, 403, 404].includes(res.status), `${path}: expected denied, got ${res.status} ${JSON.stringify(json)}`);
          return json;
        },
      };
      return client;
    },
    async owner() {
      const client = fx.client();
      const state = await client.json('/api/setup', { method: 'POST', body: { name: '테스트 관리자', username: 'owner', password, workspaceName: 'Drive 테스트' } });
      return { client, state, self: state.channels.find(c => c.kind === 'self'), channel: state.channels.find(c => c.kind === 'channel') };
    },
    async member(owner) {
      const invite = await owner.json('/api/invites', { method: 'POST', body: {} });
      const client = fx.client();
      const state = await client.json('/api/join', { method: 'POST', body: { code: invite.code, name: '테스트 멤버', username: 'member', password } });
      return { client, state };
    },
  };
  t.after(async () => {
    await app.close();
    assert.ok(resolve(dataDir).startsWith(resolve(tmpdir()) + sep));
    assert.match(dataDir.split(sep).at(-1), /^synk-drive-api-test-/);
    await rm(dataDir, { recursive: true, force: true });
  });
  return fx;
}

const activate = (client, connectionId) => client.json('/api/storage/drive/active', { method: 'POST', body: { connectionId } });
const upload = (client, channelId, name, contents) => client.json(`/api/channels/${channelId}/files`, { method: 'POST', headers: { 'X-File-Name': encodeURIComponent(name), 'Content-Type': 'application/octet-stream' }, body: Buffer.from(contents) });
const publish = (client, channelId, fileIds) => client.json(`/api/channels/${channelId}/messages`, { method: 'POST', body: { body: '', fileIds } });

test('legacy local files survive migration and every cloud file keeps its original account after switches and restart', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const local = (await upload(owner.client, owner.channel.id, '로컬.txt', 'local-before-drive')).file;
  await publish(owner.client, owner.channel.id, [local.id]);
  await fx.restart({ legacy: true });
  await owner.client.json('/api/login', { method: 'POST', body: { username: 'owner', password } });
  await activate(owner.client, 'alpha');
  const alpha = (await upload(owner.client, owner.channel.id, 'A.txt', 'account-alpha')).file;
  assert.equal(alpha.storageProvider, 'google-drive');
  await publish(owner.client, owner.channel.id, [alpha.id]);
  await activate(owner.client, 'beta');
  const beta = (await upload(owner.client, owner.channel.id, 'B.txt', 'account-beta')).file;
  await publish(owner.client, owner.channel.id, [beta.id]);
  assert.deepEqual((await readdir(join(fx.dataDir, 'uploads'))).length, 1, 'only the original local file remains on disk');
  await activate(owner.client, null);
  await fx.restart();
  await owner.client.json('/api/login', { method: 'POST', body: { username: 'owner', password } });
  for (const [file, expected] of [[local, 'local-before-drive'], [alpha, 'account-alpha'], [beta, 'account-beta']]) {
    const response = await owner.client.raw(`/api/files/${file.id}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /^attachment;/);
    assert.equal(await response.text(), expected);
  }
  assert.deepEqual(fx.drive.calls.filter(c => c.method === 'download').map(c => c.connectionId), ['alpha', 'beta']);
  const files = (await owner.client.json('/api/files')).files;
  assert.equal(files.find(f => f.id === local.id).storageProvider, 'local');
  assert.equal(files.find(f => f.id === alpha.id).storageProvider, 'google-drive');
  assert.equal((await owner.client.json('/api/storage')).fileCount, 3);
});

test('changing the active account during an upload affects only later uploads', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  await activate(owner.client, 'alpha');
  const data = Buffer.alloc(65536, 42);
  let req;
  const completed = new Promise((resolve, reject) => {
    req = request(fx.url + `/api/channels/${owner.channel.id}/files`, {
      method: 'POST', headers: { Cookie: owner.client.cookie, Origin: fx.url, 'X-File-Name': 'during-switch.bin', 'Content-Length': String(data.length), 'Content-Type': 'application/octet-stream' },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Interrupted account-switch test')));
    req.write(data.subarray(0, 4096));
  });
  await waitUntil(async () => (await readdir(join(fx.dataDir, 'uploads'))).length > 0, 'upload must start staging');
  await activate(owner.client, 'beta');
  req.end(data.subarray(4096));
  const result = await completed;
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(fx.drive.calls.find(c => c.method === 'upload').connectionId, 'alpha');
  const next = await upload(owner.client, owner.channel.id, 'after-switch.txt', 'beta');
  assert.equal(next.file.storageProvider, 'google-drive');
  assert.equal(fx.drive.calls.filter(c => c.method === 'upload').at(-1).connectionId, 'beta');
});

test('Drive quota/auth failures return an explicit error with no local success or staging/DB leftovers', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  await activate(owner.client, 'alpha');
  for (const failure of [safeError(507, 'Google Drive 저장 공간이 부족합니다.'), safeError(503, 'Google Drive 인증을 다시 연결해 주세요.')]) {
    fx.drive.uploadError = failure;
    const response = await owner.client.raw(`/api/channels/${owner.channel.id}/files`, { method: 'POST', headers: { 'X-File-Name': 'cannot-upload.txt', 'Content-Type': 'application/octet-stream' }, body: Buffer.from('must not survive locally') });
    assert.equal(response.ok, false);
    assert.equal((await response.json()).error, failure.publicMessage);
    assert.deepEqual(await readdir(join(fx.dataDir, 'uploads')), []);
    assert.equal((await owner.client.json('/api/storage')).fileCount, 0);
    assert.equal((await owner.client.json('/api/bootstrap')).storage.provider, 'google-drive');
  }
  fx.drive.uploadError = null;
  assert.equal((await upload(owner.client, owner.channel.id, 'recovered.txt', 'works')).file.storageProvider, 'google-drive');
});

test('Drive configuration is owner-only and cloud downloads apply membership before any provider access', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  await activate(owner.client, 'alpha');
  const member = await fx.member(owner.client);
  const visitor = fx.client();
  const file = (await upload(owner.client, owner.self.id, 'private.txt', 'private')).file;
  await publish(owner.client, owner.self.id, [file.id]);
  const before = fx.drive.calls.length;
  await member.client.denied(`/api/files/${file.id}`);
  await visitor.denied(`/api/files/${file.id}`);
  assert.equal(fx.drive.calls.length, before, 'denied downloads must never contact Drive');
  for (const client of [visitor, member.client]) {
    await client.denied('/api/storage/drive');
    await client.denied('/api/storage/drive/active', { method: 'POST', body: { connectionId: 'beta' } });
    const bootstrap = await client.json('/api/bootstrap');
    assert.deepEqual(bootstrap.storage, { provider: 'google-drive' });
    assert.equal(JSON.stringify(bootstrap).includes('@example.test'), false);
    assert.equal(JSON.stringify(bootstrap).includes('folder-alpha'), false);
  }
  const memberStorage = await member.client.json('/api/storage');
  assert.equal(memberStorage.provider, 'google-drive');
  assert.equal('drive' in memberStorage, false);
  const ownerStatus = await owner.client.json('/api/storage/drive');
  assert.equal(ownerStatus.account.email, 'alpha@example.test');
  assert.equal(ownerStatus.account.limitBytes, 5497558138880);
  await owner.client.denied('/api/storage/drive/active', { method: 'POST', body: { connectionId: 'unknown' } });
  assert.equal(fx.drive.activeId, 'alpha');
});

test('remote deletions retain their original account in a durable retry queue across auth failure and restart', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  const local = (await upload(owner.client, owner.channel.id, 'local.txt', 'local')).file;
  await activate(owner.client, 'alpha');
  const cloud = (await upload(owner.client, owner.channel.id, 'cloud.txt', 'cloud')).file;
  const { message } = await publish(owner.client, owner.channel.id, [local.id, cloud.id]);
  await activate(owner.client, 'beta');
  fx.drive.trashError = safeError(503, 'Drive 인증을 다시 연결해 주세요.');
  await owner.client.json(`/api/messages/${message.id}`, { method: 'DELETE' });
  assert.equal((await owner.client.json('/api/files')).files.length, 0);
  assert.equal((await owner.client.json('/api/storage')).fileCount, 0);
  assert.deepEqual(await readdir(join(fx.dataDir, 'uploads')), []);
  assert.equal((await owner.client.json('/api/storage/drive')).pendingDeletions, 1);
  assert.equal(fx.drive.files.size, 1);
  await fx.restart();
  await owner.client.json('/api/login', { method: 'POST', body: { username: 'owner', password } });
  assert.equal((await owner.client.json('/api/storage/drive')).pendingDeletions, 1, 'failed cleanup remains queued after restart');
  fx.drive.trashError = null;
  await fx.restart();
  await owner.client.json('/api/login', { method: 'POST', body: { username: 'owner', password } });
  await waitUntil(async () => (await owner.client.json('/api/storage/drive')).pendingDeletions === 0, 'successful retry must clear the outbox');
  assert.equal(fx.drive.files.size, 0);
  assert.ok(fx.drive.calls.filter(c => c.method === 'trash').every(c => c.connectionId === 'alpha' && c.fileId === cloud.id));
  const cancelled = (await upload(owner.client, owner.channel.id, 'cancel.txt', 'cancel')).file;
  await owner.client.json(`/api/files/${cancelled.id}`, { method: 'DELETE' });
  assert.equal(fx.drive.files.size, 0);
  assert.equal((await owner.client.json('/api/storage/drive')).pendingDeletions, 0);
  assert.equal(fx.drive.calls.filter(c => c.method === 'trash').at(-1).connectionId, 'beta');
});

test('a failed verified upload preserves its remote cleanup intent until Drive authentication recovers', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  await activate(owner.client, 'alpha');
  const originalUpload = fx.drive.upload.bind(fx.drive);
  fx.drive.upload = async input => {
    const result = await originalUpload(input);
    const error = safeError(502, 'Drive에 저장된 파일이 원본과 일치하지 않습니다.');
    error.remoteCleanup = { fileId: input.fileId, connectionId: input.connectionId, remoteId: result.remoteId };
    throw error;
  };
  fx.drive.trashError = safeError(503, 'Google Drive 인증을 다시 연결해 주세요.');
  const response = await owner.client.raw(`/api/channels/${owner.channel.id}/files`, { method: 'POST', headers: { 'X-File-Name': 'failed.txt', 'Content-Type': 'application/octet-stream' }, body: Buffer.from('failed verify') });
  assert.equal(response.status, 502);
  await response.arrayBuffer();
  assert.equal((await owner.client.json('/api/storage')).fileCount, 0);
  assert.equal((await owner.client.json('/api/storage/drive')).pendingDeletions, 1);
  assert.deepEqual(await readdir(join(fx.dataDir, 'uploads')), []);
  fx.drive.trashError = null;
  await fx.restart();
  await waitUntil(async () => (await owner.client.json('/api/storage/drive')).pendingDeletions === 0, 'failed upload cleanup survives restart');
  assert.equal(fx.drive.files.size, 0);
});

test('disconnecting after a cloud transfer starts cleans the remote object and local staging', async t => {
  const fx = await fixture(t);
  const owner = await fx.owner();
  await activate(owner.client, 'alpha');
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const originalUpload = fx.drive.upload.bind(fx.drive);
  fx.drive.upload = async input => {
    const result = await originalUpload(input);
    entered();
    await hold;
    return result;
  };
  const body = Buffer.from('upload will finish after the browser closes');
  const req = request(fx.url + `/api/channels/${owner.channel.id}/files`, { method: 'POST', headers: { Cookie: owner.client.cookie, Origin: fx.url, 'X-File-Name': 'cancel.bin', 'Content-Type': 'application/octet-stream', 'Content-Length': String(body.length) } }, res => res.resume());
  req.on('error', () => {});
  req.end(body);
  await started;
  const disconnected = new Promise(resolve => req.once('close', resolve));
  req.destroy();
  await disconnected;
  release();
  await waitUntil(async () => fx.drive.files.size === 0 && (await readdir(join(fx.dataDir, 'uploads'))).length === 0, 'cancelled remote upload must leave no orphan');
  assert.equal((await owner.client.json('/api/storage')).fileCount, 0);
  assert.equal((await owner.client.json('/api/storage/drive')).pendingDeletions, 0);
});
