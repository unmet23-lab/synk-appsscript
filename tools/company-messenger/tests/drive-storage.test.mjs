import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createDriveStorage, DriveStorageError } from '../drive-storage.mjs';

const md5 = bytes => createHash('md5').update(bytes).digest('hex');
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

class FakeGoogle {
  constructor() {
    this.calls = [];
    this.objects = new Map();
    this.sessions = new Map();
    this.counter = 0;
    this.identityOverride = null;
    this.aboutFailure = null;
    this.putFailure = null;
    this.badChecksum = false;
    this.badLocation = false;
    this.quota = { limit: '5497558138880', usage: '1024', usageInDrive: '512', usageInDriveTrash: '0' };
  }
  fetch = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || 'GET';
    this.calls.push({ url: url.href, method });
    assert.ok(['www.googleapis.com', 'oauth2.googleapis.com'].includes(url.hostname), 'credentials must never be sent outside Google');
    assert.equal(options.redirect, 'error');
    if (url.hostname === 'oauth2.googleapis.com') {
      assert.equal(url.pathname, '/token');
      const form = new URLSearchParams(options.body);
      const account = form.get('refresh_token').replace('refresh-', '');
      return json({ access_token: `test-access-${account}`, expires_in: 3600 });
    }
    const authorization = new Headers(options.headers).get('authorization');
    assert.match(authorization, /^Bearer test-access-/);
    const account = authorization.slice('Bearer test-access-'.length);
    if (url.pathname === '/drive/v3/about') {
      if (this.aboutFailure) return json(this.aboutFailure.body, this.aboutFailure.status);
      return json({ user: { emailAddress: this.identityOverride || `${account}@example.test`, displayName: `Account ${account}` }, storageQuota: this.quota });
    }
    if (url.pathname === '/drive/v3/files/generateIds') return json({ ids: [`remote-file-${++this.counter}`] });
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      return json({ files: [...this.objects.values()].filter(item => item.account === account && item.mimeType === 'application/vnd.google-apps.folder' && !item.trashed).map(item => ({ id: item.id })) });
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.mimeType, 'application/vnd.google-apps.folder');
      assert.ok(body.appProperties.synkMessengerSpaceId);
      const item = { ...body, id: `folder-${account}-${++this.counter}`, account, trashed: false };
      this.objects.set(item.id, item);
      return json({ id: item.id });
    }
    if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const metadata = JSON.parse(options.body);
      assert.equal(metadata.mimeType, 'application/octet-stream');
      assert.equal(metadata.parents.length, 1);
      assert.ok(metadata.appProperties.synkMessengerFileId);
      const sessionId = `session-${++this.counter}`;
      this.sessions.set(sessionId, { ...metadata, account });
      return new Response(null, { status: 200, headers: { Location: this.badLocation ? 'https://attacker.example/upload/drive/leak' : `https://www.googleapis.com/upload/drive/v3/files?upload_id=${sessionId}` } });
    }
    if (url.pathname === '/upload/drive/v3/files' && method === 'PUT') {
      const metadata = this.sessions.get(url.searchParams.get('upload_id'));
      assert.ok(metadata);
      const chunks = [];
      for await (const chunk of options.body) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      if (this.putFailure) return json(this.putFailure.body, this.putFailure.status);
      const item = { ...metadata, bytes, size: String(bytes.length), md5Checksum: this.badChecksum ? 'f'.repeat(32) : md5(bytes), trashed: false };
      this.objects.set(item.id, item);
      return json({ id: item.id });
    }
    const match = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (match) {
      const item = this.objects.get(decodeURIComponent(match[1]));
      if (!item || item.account !== account) return json({ error: { message: 'not found' } }, 404);
      if (method === 'PATCH') {
        assert.deepEqual(JSON.parse(options.body), { trashed: true }, 'cleanup may only move app files to trash');
        item.trashed = true;
        return json({ id: item.id, trashed: true });
      }
      if (url.searchParams.get('alt') === 'media') return new Response(item.bytes, { status: 200 });
      const { bytes, account: unused, ...metadata } = item;
      return json(metadata);
    }
    assert.fail(`Unexpected Google request: ${method} ${url.href}`);
  };
}

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'synk-drive-provider-test-'));
  const google = new FakeGoogle();
  const storage = createDriveStorage({ dataDir, fetchImpl: google.fetch });
  const files = [];
  const fx = {
    dataDir, google, storage,
    async source(account, { clasp = false } = {}) {
      const credentials = { client_id: 'fake-client-id', client_secret: 'fake-client-secret', refresh_token: `refresh-${account}`, access_token: 'do-not-copy-this-token', expiry_date: 1234 };
      const path = join(dataDir, `source-${account}.json`);
      await writeFile(path, JSON.stringify(clasp ? { tokens: { default: credentials }, unrelated: 'keep-original' } : { type: 'authorized_user', ...credentials }, null, 2));
      return path;
    },
    async connect(account = 'alpha', options) {
      const sourcePath = await fx.source(account, options);
      const original = await readFile(sourcePath, 'utf8');
      const status = await storage.connectFromFile({ sourcePath, expectedEmail: `${account}@example.test` });
      assert.equal(await readFile(sourcePath, 'utf8'), original, 'the authorized credential source remains unchanged');
      return status;
    },
    async upload(contents = '한글 문서 / text') {
      const bytes = Buffer.from(contents);
      const localPath = join(dataDir, `staged-${files.length}.txt`);
      await writeFile(localPath, bytes);
      const input = { connectionId: (await storage.active()).id, localPath, name: '팀 자료.txt', size: bytes.length, md5: md5(bytes), fileId: `test-file-${files.length}` };
      files.push(input);
      return { input, result: await storage.upload(input), bytes };
    },
  };
  t.after(async () => {
    assert.ok(resolve(dataDir).startsWith(resolve(tmpdir()) + sep));
    assert.match(dataDir.split(sep).at(-1), /^synk-drive-provider-test-/);
    await rm(dataDir, { recursive: true, force: true });
  });
  return fx;
}

test('connection verifies account identity before Drive changes and preserves the credential source', async t => {
  const fx = await fixture(t);
  assert.equal(await fx.storage.active(), null);
  assert.equal((await fx.storage.status()).provider, 'local');
  assert.equal(fx.google.calls.length, 0);
  const sourcePath = await fx.source('alpha', { clasp: true });
  const source = await readFile(sourcePath, 'utf8');
  await assert.rejects(fx.storage.connectFromFile({ sourcePath, expectedEmail: 'different@example.test' }), error => error instanceof DriveStorageError && error.status === 409);
  assert.equal(await readFile(sourcePath, 'utf8'), source);
  assert.equal(fx.google.calls.some(c => ['POST', 'PATCH', 'DELETE'].includes(c.method) && c.url.includes('/drive/')), false);
  await assert.rejects(access(join(fx.dataDir, 'drive-storage.json')));
  const status = await fx.storage.connectFromFile({ sourcePath, expectedEmail: 'alpha@example.test' });
  assert.equal(status.status, 'connected');
  assert.equal(status.account.limitBytes, 5497558138880);
  assert.equal(status.account.usedBytes, 1024);
  const serialized = JSON.stringify(status);
  for (const secret of ['fake-client-secret', 'refresh-alpha', 'do-not-copy-this-token', 'test-access-alpha']) assert.equal(serialized.includes(secret), false);
  const registry = JSON.parse(await readFile(join(fx.dataDir, 'drive-storage.json'), 'utf8'));
  assert.deepEqual(Object.keys(registry.connections[0].credentials).sort(), ['client_id', 'client_secret', 'refresh_token']);
  assert.equal(await readFile(sourcePath, 'utf8'), source);
});

test('verified cloud bytes can download and only marked files in the dedicated folder can be trashed', async t => {
  const fx = await fixture(t);
  await fx.connect();
  const { result, input, bytes } = await fx.upload();
  assert.equal(result.md5, md5(bytes));
  assert.equal(result.connectionId, input.connectionId);
  const ref = { connectionId: result.connectionId, remoteId: result.remoteId, fileId: input.fileId };
  const remote = fx.google.objects.get(result.remoteId);
  const originalParents = [...remote.parents];
  remote.parents = ['someone-elses-folder'];
  const before = fx.google.calls.length;
  await assert.rejects(fx.storage.download(ref), error => error.status === 409);
  await assert.rejects(fx.storage.trash(ref), error => error.status === 409);
  assert.equal(fx.google.calls.slice(before).some(c => c.method === 'PATCH' || c.url.includes('alt=media')), false);
  remote.parents = originalParents;
  const originalMarker = remote.appProperties.synkMessengerFileId;
  remote.appProperties.synkMessengerFileId = 'other-file';
  await assert.rejects(fx.storage.trash(ref), error => error.status === 409);
  remote.appProperties.synkMessengerFileId = originalMarker;
  const downloaded = [];
  for await (const chunk of await fx.storage.download(ref)) downloaded.push(chunk);
  assert.deepEqual(Buffer.concat(downloaded), bytes);
  await fx.storage.trash(ref);
  const patchCount = fx.google.calls.filter(c => c.method === 'PATCH').length;
  await fx.storage.trash(ref);
  assert.equal(fx.google.calls.filter(c => c.method === 'PATCH').length, patchCount);
  await assert.rejects(fx.storage.download(ref), error => error.status === 404);
  await fx.storage.trash({ ...ref, remoteId: 'already-missing' });
  assert.equal(fx.google.calls.some(c => c.method === 'DELETE'), false);
});

test('quota failures and upstream errors stay explicit and cannot expose provider response secrets', async t => {
  const fx = await fixture(t);
  await fx.connect();
  fx.google.quota = { limit: '1024', usage: '1024', usageInDrive: '1024', usageInDriveTrash: '0' };
  await fx.storage.status({ fresh: true });
  const before = fx.google.calls.length;
  await assert.rejects(fx.upload(), error => error instanceof DriveStorageError && error.status === 507);
  assert.equal(fx.google.calls.slice(before).some(c => c.method === 'POST'), false);
  fx.google.aboutFailure = { status: 403, body: { error: { message: 'private-upstream-secret', errors: [{ reason: 'forbidden' }] } } };
  const status = await fx.storage.status({ fresh: true });
  assert.equal(status.provider, 'google-drive');
  assert.equal(status.status, 'error');
  assert.equal(JSON.stringify(status).includes('private-upstream-secret'), false);
  fx.google.aboutFailure = null;
  fx.google.quota.limit = '5497558138880';
  await fx.storage.status({ fresh: true });
  fx.google.putFailure = { status: 403, body: { error: { message: 'quota-secret', errors: [{ reason: 'storageQuotaExceeded' }] } } };
  await assert.rejects(fx.upload(), error => error.status === 507 && !error.publicMessage.includes('quota-secret'));
});

test('uploads reject untrusted resumable locations and checksum mismatches without reporting success', async t => {
  const fx = await fixture(t);
  await fx.connect();
  fx.google.badLocation = true;
  await assert.rejects(fx.upload(), error => error instanceof DriveStorageError && error.status === 503);
  assert.equal(fx.google.calls.some(c => c.url.includes('attacker.example')), false);
  fx.google.badLocation = false;
  fx.google.badChecksum = true;
  await assert.rejects(fx.upload(), error => error.status === 502);
  const uploaded = [...fx.google.objects.values()].filter(object => object.mimeType !== 'application/vnd.google-apps.folder');
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].trashed, true, 'a mismatching uploaded object is safely moved to trash');
});

test('a failed connection switch preserves the active account and previous credentials', async t => {
  const fx = await fixture(t);
  const alpha = await fx.connect('alpha');
  const beta = await fx.connect('beta');
  assert.notEqual(alpha.activeConnectionId, beta.activeConnectionId);
  const registryBefore = await readFile(join(fx.dataDir, 'drive-storage.json'), 'utf8');
  fx.google.identityOverride = 'unexpected@example.test';
  await assert.rejects(fx.storage.setActive(alpha.activeConnectionId), error => error.status === 409);
  assert.equal(await readFile(join(fx.dataDir, 'drive-storage.json'), 'utf8'), registryBefore);
  assert.equal((await fx.storage.active()).id, beta.activeConnectionId);
  fx.google.identityOverride = null;
  await fx.storage.setActive(alpha.activeConnectionId);
  assert.equal((await fx.storage.active()).id, alpha.activeConnectionId);
  await fx.storage.setActive(null);
  assert.equal((await fx.storage.status()).provider, 'local');
  assert.equal((await fx.storage.status()).connections.length, 2);
});

test('manual cloud content changes are rejected before sending a mismatched download stream', async t => {
  const fx = await fixture(t);
  await fx.connect();
  const { result, input } = await fx.upload('unchanged original');
  const ref = { connectionId: result.connectionId, remoteId: result.remoteId, fileId: input.fileId, expectedSize: input.size, expectedMd5: input.md5 };
  const remote = fx.google.objects.get(result.remoteId);
  for (const change of [{ size: String(input.size + 1) }, { size: String(input.size), md5Checksum: 'f'.repeat(32) }]) {
    Object.assign(remote, change);
    const before = fx.google.calls.length;
    await assert.rejects(fx.storage.download(ref), error => error instanceof DriveStorageError && error.status === 409);
    assert.equal(fx.google.calls.slice(before).some(call => call.url.includes('alt=media')), false);
  }
});

test('reconnecting the same email with another OAuth client preserves the original file connection', async t => {
  const fx = await fixture(t);
  const first = await fx.connect();
  const originalFile = await fx.upload('original client');
  const sourcePath = await fx.source('alpha');
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  source.client_id = 'another-client-id';
  source.client_secret = 'another-client-secret';
  await writeFile(sourcePath, JSON.stringify(source));
  const second = await fx.storage.connectFromFile({ sourcePath, expectedEmail: 'alpha@example.test' });
  assert.notEqual(second.activeConnectionId, first.activeConnectionId);
  const registry = JSON.parse(await readFile(join(fx.dataDir, 'drive-storage.json'), 'utf8'));
  assert.equal(registry.connections.length, 2);
  assert.equal(registry.connections.find(c => c.id === first.activeConnectionId).credentials.client_id, 'fake-client-id');
  assert.equal(registry.connections.find(c => c.id === second.activeConnectionId).credentials.client_id, 'another-client-id');
  const bytes = [];
  for await (const chunk of await fx.storage.download({ connectionId: first.activeConnectionId, remoteId: originalFile.result.remoteId, fileId: originalFile.input.fileId })) bytes.push(chunk);
  assert.deepEqual(Buffer.concat(bytes), originalFile.bytes);
});

test('a failed final authorization guard preserves the prior Drive registry and removes staged configuration', async t => {
  const fx = await fixture(t);
  const alpha = await fx.connect('alpha');
  const beta = await fx.connect('beta');
  const original = await readFile(join(fx.dataDir, 'drive-storage.json'), 'utf8');
  let guardCalls = 0;
  await assert.rejects(fx.storage.setActive(alpha.activeConnectionId, { beforeCommit() { guardCalls++; throw Object.assign(new Error('session revoked'), { status: 401 }); } }), error => error.status === 401);
  assert.equal(guardCalls, 1);
  assert.equal(await readFile(join(fx.dataDir, 'drive-storage.json'), 'utf8'), original);
  assert.equal((await fx.storage.active()).id, beta.activeConnectionId);
  assert.equal((await readdir(fx.dataDir)).some(name => name.startsWith('drive-storage.json.') && name.endsWith('.tmp')), false);
});
