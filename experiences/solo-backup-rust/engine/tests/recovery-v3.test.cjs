'use strict';
// Envelope v3, the customer read-key rule, the v3 envelope keeper and the server-bound
// Google sign-in (STAGE1_DESIGN.md 4.5 · 5.4 · 「봉투 v3의 꼴」).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DriveVault, MARKER, MARKER3, FORMAT3, parseEnvelopeV3, validateReadKeyV3, sha } = require('../src/recovery-vault.cjs');
const { EnvelopeV3 } = require('../src/recovery-service.cjs');
const { GoogleAuth } = require('../src/recovery-auth.cjs');
const { failure } = require('../src/recovery-http.cjs');

const subject = '123456789012345678901';
const repository = { endpoint: 'https://s3.us-east-005.backblazeb2.com', bucket: 'fixture-bucket', prefix: 'c/abcdefghijklmnop/r' };
const key = { keyId: 'readonly-fixture-key', applicationKey: 'readonly-fixture-secret' };
const repositoryId = 'a'.repeat(64), bucketId = 'b'.repeat(24), password = crypto.randomBytes(32).toString('base64url');
const envelope = () => ({ format: FORMAT3, version: 3, generationId: crypto.randomUUID(), generation: 1, createdAt: new Date().toISOString(), subject, repository, repositoryId, password, readKey: key, bucketId, resticVersion: '0.19.1' });
const wrap = (v) => ({ bytes: Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)), headers: {} });
const encryptionKey = crypto.randomBytes(32);
const secretStore = { encrypt(text) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv); return Buffer.concat([iv, c.update(text), c.final(), c.getAuthTag()]); }, decrypt(bytes) { const d = crypto.createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12)); d.setAuthTag(bytes.subarray(-16)); return Buffer.concat([d.update(bytes.subarray(12, -16)), d.final()]).toString(); } };

function memoryDrive() {
  const files = [], contents = new Map(); let failUpload = false;
  const auth = { tokens: { sub: subject }, getState: () => ({ connected: true }), access: async () => 'fixture-access' };
  const transport = async (url, options) => {
    const u = new URL(url);
    if (options.method === 'POST') {
      if (failUpload) throw failure();
      const pieces = options.body.toString().split('\r\n\r\n');
      const metadata = JSON.parse(pieces[1].split('\r\n--')[0]), bytes = Buffer.from(pieces[2].split('\r\n--')[0]);
      const file = { ...metadata, id: `file-${files.length}`, size: String(bytes.length), sha256Checksum: sha(bytes) };
      files.push(file); contents.set(file.id, bytes); return wrap(file);
    }
    if (options.method === 'PATCH') { const file = files.find((f) => u.pathname.endsWith('/' + f.id)); file.appProperties = { ...file.appProperties, ...JSON.parse(options.body).appProperties }; return wrap(file); }
    if (u.searchParams.get('alt') === 'media') return { bytes: contents.get(u.pathname.split('/').pop()), headers: {} };
    const app = /value='([^']+)' \}/.exec(u.searchParams.get('q'))[1];
    return wrap({ files: files.filter((f) => f.appProperties.app === app) });
  };
  return { auth, files, contents, transport, failUpload: (v) => { failUpload = v; } };
}

test('envelope v3: strict shape, customer repository prefix only, v1 fields refused', () => {
  const e = envelope();
  assert.equal(parseEnvelopeV3(Buffer.from(JSON.stringify(e)), subject).repository.prefix, repository.prefix);
  const wrong = [
    { ...e, subject: 'another' }, { ...e, version: 1 }, { ...e, format: 'workbackup-recovery-v1' }, { ...e, writeKey: key },
    { ...e, repository: { ...repository, prefix: 'work-backup/450e7286-744b-4d69-aeef-00c5244f54df' } },
    { ...e, repository: { ...repository, prefix: 'c/abcdefghijklmnop/' } }, { ...e, repository: { ...repository, prefix: 'c/ABCDEFGHIJKLMNOP/r' } },
    { ...e, repository: { ...repository, endpoint: 'https://evil.invalid' } }, { ...e, repository: { ...repository, extra: 1 } },
    { ...e, repositoryId: 'x' }, { ...e, password: 'short' }, { ...e, readKey: { ...key, capabilities: ['writeFiles'] } },
  ];
  for (const v of wrong) assert.throws(() => parseEnvelopeV3(Buffer.from(JSON.stringify(v)), subject));
});

test('customer read key: exactly the customer prefix, read-only, no expiry, same bucket and endpoint', async () => {
  const good = { applicationKeyExpirationTimestamp: null, apiInfo: { storageApi: { s3ApiUrl: repository.endpoint, allowed: { buckets: [{ id: bucketId, name: repository.bucket }], capabilities: ['listBuckets', 'listFiles', 'readFiles'], namePrefix: 'c/abcdefghijklmnop/' } } } };
  assert.deepEqual(await validateReadKeyV3(repository, key, async () => good), { bucketId });
  const mutate = [
    (v) => { v.apiInfo.storageApi.allowed.namePrefix = null; }, (v) => { v.apiInfo.storageApi.allowed.namePrefix = 'c/'; },
    (v) => { v.apiInfo.storageApi.allowed.namePrefix = 'c/zzzzzzzzzzzzzzzz/'; }, (v) => v.apiInfo.storageApi.allowed.capabilities.push('writeFiles'),
    (v) => v.apiInfo.storageApi.allowed.capabilities.push('shareFiles'), (v) => { v.applicationKeyExpirationTimestamp = 5; },
    (v) => { v.apiInfo.storageApi.allowed.buckets[0].name = 'other-bucket'; }, (v) => { v.apiInfo.storageApi.s3ApiUrl = 'https://s3.us-west-004.backblazeb2.com'; },
  ];
  for (const change of mutate) { const v = structuredClone(good); change(v); await assert.rejects(validateReadKeyV3(repository, key, async () => v)); }
});

test('v3 vault keeps its own marker: a v1 vault never sees v3 envelopes', async () => {
  const d = memoryDrive();
  const v3 = new DriveVault(d.auth, d.transport, { marker: MARKER3, parse: parseEnvelopeV3 });
  const receipt = await v3.publish(envelope());
  assert.equal(receipt.repositoryId, repositoryId);
  assert.equal(d.files[0].appProperties.app, MARKER3);
  assert.equal((await v3.list(subject)).length, 1);
  assert.equal((await new DriveVault(d.auth, d.transport).list(subject)).length, 0);
  assert.notEqual(MARKER, MARKER3);
});

test('EnvelopeV3: pending survives a failed upload and retries the same generation; recheck and discover', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-env3-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const d = memoryDrive();
  const validateKey = async () => ({ bucketId });
  const keeper = new EnvelopeV3({ root, secretStore, auth: d.auth, vault: new DriveVault(d.auth, d.transport, { marker: MARKER3, parse: parseEnvelopeV3 }), validateKey });
  await keeper.open();
  d.failUpload(true);
  await assert.rejects(keeper.publish({ repository, repositoryId, password, readKey: key }));
  assert.equal(keeper.getState().pending, true);
  const pendingId = keeper.record.pending.generationId;
  const stored = await fs.readFile(path.join(root, 'account-recovery-v3', 'envelope.bin'));
  assert.equal(stored.includes(Buffer.from(password)), false, 'the pending envelope is encrypted at rest');
  d.failUpload(false);
  const s = await keeper.publish({ repository, repositoryId, password, readKey: key });
  assert.equal(s.verified.repositoryId, repositoryId); assert.equal(s.pending, false);
  assert.equal(d.files.length, 1); assert.equal(JSON.parse(d.contents.get('file-0')).generationId, pendingId);
  assert.equal(d.files[0].appProperties.status, 'committed');
  assert.equal((await keeper.recheck({ repositoryId, password })).invalid, false);
  await assert.rejects(keeper.recheck({ repositoryId, password: 'x'.repeat(43) }));
  assert.equal(keeper.getState().invalid, true);
  const found = await keeper.discover();
  assert.equal(found.length, 1); assert.equal(found[0].customer, 'abcdefghijklmnop');
  assert.ok(!JSON.stringify(found).includes(password));
  assert.equal((await keeper.read(found[0].fileId)).password, password);
  // A different Google account cannot use this keeper.
  d.auth.tokens.sub = 'someone-else';
  await assert.rejects(keeper.publish({ repository, repositoryId, password, readKey: key }), { code: 'ACCOUNT' });
});

test('GoogleAuth.signIn carries the server nonce and returns the fresh ID token; revoke ends the grant', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-auth-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const client = { client_id: '123456-fixture.apps.googleusercontent.com', client_secret: 'fixture-client-public-1234', project_id: 'fixture-project' };
  const seen = []; let posted = null;
  const auth = new GoogleAuth({ dir, secretStore, client, openExternal: async () => {},
    authorizeFlow: async (_c, _o, opts) => { seen.push(opts); return { code: 'code', nonce: opts.nonce || 'own-nonce', codeVerifier: 'verifier', redirect: 'http://127.0.0.1/callback' }; },
    json: async () => ({ token_type: 'Bearer', access_token: 'fixture-access-secret', expires_in: 3600, refresh_token: 'fixture-refresh-secret', id_token: 'fixture.id.token', scope: 'https://www.googleapis.com/auth/drive.appdata' }),
    http: async (url, o) => { posted = { url, body: o.body }; return { bytes: Buffer.alloc(0), headers: {} }; },
    verify: async (_tok, _aud, { nonce }) => ({ sub: subject, email: 'fixture@example.invalid', nonce }) });
  await auth.open();
  const nonce = crypto.randomBytes(32).toString('base64url');
  const r = await auth.signIn({ nonce, hint: 'owner@example.invalid' });
  assert.deepEqual(r, { idToken: 'fixture.id.token', nonce, sub: subject, email: 'fixture@example.invalid' });
  assert.equal(seen[0].nonce, nonce); assert.equal(seen[0].hint, 'owner@example.invalid');
  // Without a hint, a sign-in that must be this account pre-selects it.
  await auth.signIn({ nonce, expectedSub: subject });
  assert.equal(seen[1].hint, 'fixture@example.invalid');
  await assert.rejects(auth.signIn({ nonce, expectedSub: 'other' }), { code: 'ACCOUNT' });
  assert.equal(await auth.revoke(), true);
  assert.equal(posted.url, 'https://oauth2.googleapis.com/revoke');
  assert.equal(new URLSearchParams(posted.body).get('token'), 'fixture-refresh-secret');
  assert.equal(auth.getState().connected, false);
  const { authorize } = require('../src/recovery-auth.cjs');
  await assert.rejects(authorize(client, async () => {}, { nonce: 'bad nonce', timeoutMs: 10 }), { code: 'INVALID' });
  await assert.rejects(authorize(client, async () => {}, { hint: 'not an address', timeoutMs: 10 }), { code: 'INVALID' });
  let opened = null;
  await assert.rejects(authorize(client, async (u) => { opened = new URL(u); }, { nonce, hint: 'owner@example.invalid', timeoutMs: 50 }), { code: 'REAUTH' });
  assert.equal(opened.searchParams.get('login_hint'), 'owner@example.invalid');
  assert.equal(opened.searchParams.get('nonce'), nonce);
});
