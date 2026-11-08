'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { GoogleAuth, authorize, verifier, SCOPE } = require('../src/recovery-auth.cjs');
const { DriveVault, parseEnvelope, validateReadKey, MARKER, sha } = require('../src/recovery-vault.cjs');
const { RecoveryService } = require('../src/recovery-service.cjs');
const { request, failure } = require('../src/recovery-http.cjs');
const { BackupEngine, APP, VERIFIED } = require('../src/engine.cjs');
const b2 = require('../src/b2.cjs');
const client = { client_id: '123456-fixture.apps.googleusercontent.com', client_secret: 'fixture-client-public-1234', project_id: 'fixture-project' };
const subject = '123456789012345678901';
const key = { keyId: 'readonly-fixture-key', applicationKey: 'readonly-fixture-secret' };
const uuid = '450e7286-744b-4d69-aeef-00c5244f54df';
const provider = b2.provider({ endpoint: 's3.us-east-005.backblazeb2.com', bucket: 'fixture-bucket', prefix: `work-backup/${uuid}` }, uuid);
const repoId = 'a'.repeat(64), bucketId = 'b'.repeat(24);
function envelope() { return { format: MARKER, version: 1, generationId: crypto.randomUUID(), generation: 1, createdAt: new Date().toISOString(), subject, kit: { format: APP, version: 2, type: 'b2', provider, repository: b2.repository(provider, uuid), repositoryId: repoId, vaultId: uuid, password: crypto.randomBytes(32).toString('base64url') }, readKey: key, bucketId, resticVersion: '0.19.1' }; }
const wrap = v => ({ bytes: Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)), headers: {} });
const encryptionKey = crypto.randomBytes(32);
const secretStore = { encrypt(text) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv); return Buffer.concat([iv, c.update(text), c.final(), c.getAuthTag()]); }, decrypt(bytes) { const d = crypto.createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12)); d.setAuthTag(bytes.subarray(-16)); return Buffer.concat([d.update(bytes.subarray(12, -16)), d.final()]).toString(); } };
async function directory(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'workbackup-recovery-')); t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir; }
function memoryDrive() {
  const files = [], contents = new Map(); let commitFail = false, lostResponse = false, lostCommit = false, reads = 0;
  const auth = { tokens: { sub: subject }, access: async () => 'fixture-access' };
  const transport = async (url, options) => {
    assert.ok(url.startsWith('https://www.googleapis.com/')); assert.equal(options.headers.authorization, 'Bearer fixture-access');
    const u = new URL(url);
    if (options.method === 'POST') {
      const pieces = options.body.toString().split('\r\n\r\n');
      const metadata = JSON.parse(pieces[1].split('\r\n--')[0]), bytes = Buffer.from(pieces[2].split('\r\n--')[0]);
      assert.deepEqual(metadata.parents, ['appDataFolder']);
      const file = { ...metadata, id: `file-${files.length}`, size: String(bytes.length), sha256Checksum: sha(bytes) };
      files.push(file); contents.set(file.id, bytes);
      if (lostResponse) { lostResponse = false; throw failure(); }
      return wrap(file);
    }
    if (options.method === 'PATCH') {
      assert.ok(reads > 0, 'must read remote bytes before commit');
      if (commitFail) throw failure();
      const file = files.find(f => u.pathname.endsWith('/' + f.id));
      file.appProperties = { ...file.appProperties, ...JSON.parse(options.body).appProperties };
      if (lostCommit) { lostCommit = false; throw failure(); } return wrap(file);
    }
    if (u.searchParams.get('alt') === 'media') { reads++; return { bytes: contents.get(u.pathname.split('/').pop()), headers: {} }; }
    assert.equal(u.searchParams.get('spaces'), 'appDataFolder'); assert.equal(u.searchParams.get('pageSize'), '100'); return wrap({ files });
  };
  return { auth, files, contents, vault: new DriveVault(auth, transport), failCommit: v => commitFail = v, loseResponse: () => lostResponse = true, loseCommitResponse: () => lostCommit = true };
}

test('strict envelope rejects cross-account, unknown secrets/paths, wrong endpoint, overflow and malformed identities', () => {
  const e = envelope(); assert.equal(parseEnvelope(Buffer.from(JSON.stringify(e)), subject).kit.repositoryId, repoId);
  const wrong = [ { ...e, subject: 'another' }, { ...e, access_token: 'leak' }, { ...e, generation: 0 }, { ...e, createdAt: 'today' }, { ...e, readKey: { ...key, writeKey: 'bad' } }, { ...e, kit: { ...e.kit, sources: ['C:\\private'] } }, { ...e, kit: { ...e.kit, repository: 'https://evil.invalid' } } ];
  for (const value of wrong) assert.throws(() => parseEnvelope(Buffer.from(JSON.stringify(value)), subject));
  assert.throws(() => parseEnvelope(Buffer.alloc(65537), subject));
});

test('RO key validation rejects write/delete/admin, all buckets, expiry, foreign prefix or endpoint', async () => {
  const good = { applicationKeyExpirationTimestamp: null, apiInfo: { storageApi: { s3ApiUrl: provider.endpoint, allowed: { buckets: [{ id: bucketId, name: provider.bucket }], capabilities: ['listBuckets', 'listFiles', 'readFiles'], namePrefix: null } } } };
  assert.deepEqual(await validateReadKey(provider, key, async () => good), { bucketId });
  const mutate = [v => v.apiInfo.storageApi.allowed.capabilities.push('writeFiles'), v => v.apiInfo.storageApi.allowed.capabilities.push('deleteFiles'), v => v.apiInfo.storageApi.allowed.capabilities.push('writeKeys'), v => v.apiInfo.storageApi.allowed.buckets = null, v => v.applicationKeyExpirationTimestamp = Date.now() + 3600000, v => v.apiInfo.storageApi.allowed.namePrefix = 'foreign/', v => v.apiInfo.storageApi.s3ApiUrl = 'https://evil.invalid'];
  for (const change of mutate) { const v = structuredClone(good); change(v); await assert.rejects(validateReadKey(provider, key, async () => v)); }
});

test('remote commit requires readback; lost create/commit response retries same immutable generation', async () => {
  const d = memoryDrive(), e = envelope(); d.loseResponse();
  await assert.rejects(d.vault.publish(e)); assert.equal(d.files.length, 1); assert.equal(d.files[0].appProperties.status, 'pending');
  d.failCommit(true); await assert.rejects(d.vault.publish(e)); assert.equal(d.files.length, 1);
  d.failCommit(false); d.loseCommitResponse(); await assert.rejects(d.vault.publish(e)); assert.equal(d.files[0].appProperties.status, 'committed');
  const receipt = await d.vault.publish(e); assert.equal(receipt.fileId, 'file-0'); assert.equal(d.files[0].appProperties.status, 'committed');
  await d.vault.publish(e); assert.equal(d.files.length, 1);
  d.contents.set('file-0', Buffer.from('corrupt')); await assert.rejects(d.vault.publish(e)); assert.equal(d.files[0].appProperties.status, 'committed');
});

test('listing rejects duplicate pages, overlarge files and unbounded pagination', async () => {
  const e = envelope(), d = memoryDrive(); await d.vault.publish(e); d.files[0].size = '65537'; await assert.rejects(d.vault.list(subject));
  const vault = new DriveVault(d.auth, async () => wrap({ files: [], nextPageToken: crypto.randomUUID() })); await assert.rejects(vault.list(subject), /너무 많아/);
});

test('loopback enforces Host/method/path/state, PKCE and single-use without logging authorization codes', async () => {
  let flowUrl;
  const get = (url, method = 'GET', host) => new Promise((resolve, reject) => { const req = http.request(url, { method, headers: host ? { host } : {} }, r => { r.resume(); r.on('end', () => resolve(r.statusCode)); }); req.on('error', reject); req.end(); });
  const result = await authorize(client, async url => {
    flowUrl = new URL(url); const redirect = flowUrl.searchParams.get('redirect_uri');
    assert.equal(flowUrl.origin, 'https://accounts.google.com'); assert.equal(flowUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(await get(redirect + '?state=wrong&code=bad'), 400);
    const good = redirect + '?' + new URLSearchParams({ state: flowUrl.searchParams.get('state'), code: 'fixture-code' });
    assert.equal(await get(good, 'POST'), 400); assert.equal(await get(good, 'GET', 'evil.invalid'), 400);
    assert.equal(await get(good), 200);
  }, { timeoutMs: 3000 });
  assert.equal(result.code, 'fixture-code'); assert.equal(sha(result.codeVerifier), Buffer.from(flowUrl.searchParams.get('code_challenge'), 'base64url').toString('hex'));
  await assert.rejects(authorize(client, async () => {}, { timeoutMs: 20 }), /로그인/);
  const controller = new AbortController(); await assert.rejects(authorize(client, async () => controller.abort(), { timeoutMs: 300000, signal: controller.signal }), /로그인/);
});

test('JWT verifier rejects forgery, nonce/audience/issuer/account mismatches and expiry with real signatures', async () => {
  const jose = await import('jose'), pair = await jose.generateKeyPair('RS256'), other = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(pair.publicKey); jwk.kid = 'fixture';
  const verify = await verifier({ loadDiscovery: async () => ({ jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs' }), loadKeys: async () => wrap({ keys: [jwk] }) });
  const sign = (changes = {}, key = pair.privateKey) => new jose.SignJWT({ sub: subject, email: 'fixture@example.invalid', email_verified: true, nonce: 'nonce', iss: 'https://accounts.google.com', aud: client.client_id, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).sign(key);
  assert.equal((await verify(await sign(), client.client_id, { nonce: 'nonce', sub: subject })).sub, subject);
  for (const changes of [{ nonce: 'wrong' }, { aud: 'wrong' }, { iss: 'https://evil.invalid' }, { azp: 'wrong' }, { exp: 1 }, { email_verified: false }, { sub: 'other' }]) await assert.rejects(verify(await sign(changes), client.client_id, { nonce: 'nonce', sub: subject }));
  await assert.rejects(verify(await sign({}, other.privateKey), client.client_id));
});

test('auth stores encrypted tokens; wrong account or refresh subject never replaces prior account', async t => {
  const dir = await directory(t); let returnedSub = subject;
  const auth = new GoogleAuth({ dir, secretStore, client, openExternal: async () => {}, authorizeFlow: async () => ({ code: 'code', nonce: 'nonce', codeVerifier: 'verifier', redirect: 'http://127.0.0.1/callback' }), json: async () => ({ token_type: 'Bearer', access_token: 'fixture-access-secret', refresh_token: 'fixture-refresh-secret', id_token: 'fixture-id', expires_in: 3600, scope: SCOPE }), verify: async (_token, _client, expected) => { if (expected.sub && returnedSub !== expected.sub) throw failure('ACCOUNT'); return { sub: returnedSub, email: 'fixture@example.invalid' }; } });
  await auth.open(); await auth.connect(subject);
  const bytes = await fs.readFile(path.join(dir, 'google.bin')); assert.ok(!bytes.includes(Buffer.from('fixture-refresh-secret')));
  assert.ok(!JSON.stringify(auth.getState()).includes('fixture-access-secret'));
  returnedSub = 'other'; await assert.rejects(auth.connect(subject)); assert.equal(auth.tokens.sub, subject); assert.deepEqual(await fs.readFile(path.join(dir, 'google.bin')), bytes);
  auth.tokens.expires = 0; await assert.rejects(auth.access()); assert.equal(auth.getState().needsLogin, true);
  await auth.disconnect(); assert.equal(auth.tokens, null); assert.equal(await fs.stat(path.join(dir, 'google.bin')).catch(e => e.code), 'ENOENT');
});

test('HTTP rejects redirect, oversized payloads, host changes and redacts server credentials', async t => {
  let response = { code: 302, body: 'fixture-secret' };
  t.mock.method(https, 'request', (_url, _options, cb) => {
    const req = new EventEmitter(); req.destroy = () => {};
    req.end = () => queueMicrotask(() => { const res = new EventEmitter(); res.statusCode = response.code; res.headers = {}; res.destroy = () => {}; cb(res); res.emit('data', Buffer.from(response.body)); res.emit('end'); }); return req;
  });
  await assert.rejects(request('https://evil.invalid/')); await assert.rejects(request('https://www.googleapis.com/test'), e => !e.message.includes('fixture-secret'));
  response = { code: 200, body: 'x'.repeat(100) }; await assert.rejects(request('https://www.googleapis.com/test', { limit: 10 }));
  response = { code: 400, body: JSON.stringify({ error: 'invalid_grant', description: 'fixture-secret' }) }; await assert.rejects(request('https://oauth2.googleapis.com/token'), e => e.code === 'REAUTH' && !e.message.includes('fixture-secret'));
});

test('RO engine read allowlist carries no-lock; write/check/prune and old-profile overwrite fail closed', async t => {
  const dir = await directory(t), e = envelope(), calls = [];
  const engine = new BackupEngine({ stateDir: dir, resticPath: 'fixture', providerType: 'b2', secretStore, runner: async (args, options) => { calls.push({ args, options }); return args[0] === 'cat' ? JSON.stringify({ id: repoId }) : JSON.stringify([{ id: 'c'.repeat(64), time: new Date().toISOString(), tags: [APP, VERIFIED, `vault:${uuid}`] }]); } });
  await engine.open(); await engine.importRecoveryKit({ text: JSON.stringify(e.kit), credentials: key, readOnly: true });
  assert.ok(calls.every(c => c.options.providerArgs.includes('--no-lock'))); assert.equal(engine.getState().readOnly, true);
  for (const verb of ['backup', 'check', 'forget', 'prune', 'unlock', 'key', 'init']) await assert.rejects(engine.run([verb]));
  await assert.rejects(engine.importRecoveryKit({ text: JSON.stringify(e.kit), credentials: key, readOnly: true }), /덮어쓸/);
});

test('service pending journal survives crash; remote failure preserves old verified keys and hides secrets', async t => {
  const dir = await directory(t), e = envelope(), d = memoryDrive();
  const auth = { tokens: { sub: subject }, open: async () => fs.mkdir(path.join(dir, 'account-recovery'), { recursive: true }), getState: () => ({ connected: true, available: true }), connect: async () => {}, disconnect: async () => {} };
  const engine = { config: { repositoryId: repoId, mode: 'backup', provider }, secret: e.kit.password, job: null, recoveryKit: () => e.kit, validateReadCredential: async () => {}, operation: async (_kind, fn) => fn(), save: async () => {} };
  const options = { root: dir, engine, secretStore, auth, vault: d.vault, validateKey: async () => ({ bucketId }) };
  const s = new RecoveryService(options); await s.open(); t.after(() => s.stop());
  await s.save({ subject, readKey: { credentials: key, bucketId } });
  d.failCommit(true); await assert.rejects(s.sync()); assert.ok(s.record.pending); assert.equal(engine.config.remoteRecovery, undefined);
  const bytes = await fs.readFile(path.join(dir, 'account-recovery', 'recovery.bin')); for (const secret of [key.applicationKey, e.kit.password]) assert.ok(!bytes.includes(Buffer.from(secret)));
  await s.stop(); const restarted = new RecoveryService(options); await restarted.open(); t.after(() => restarted.stop());
  d.failCommit(false); await restarted.sync(); assert.equal(d.files.length, 1); assert.equal(restarted.record.pending, null); assert.equal(restarted.getState().status, 'verified');
  const proof = structuredClone(restarted.record.verified); d.failCommit(true); await assert.rejects(restarted.sync()); assert.deepEqual(restarted.record.verified, proof); assert.equal(restarted.getState().status, 'attention'); assert.ok(restarted.getState().verifiedAt);
  for (const secret of [key.applicationKey, e.kit.password, subject]) assert.ok(!JSON.stringify(restarted.getState()).includes(secret));
  const nextKey = { keyId: 'new-fixture-ro-key', applicationKey: 'new-fixture-ro-secret' }; d.failCommit(false); await restarted.prepareReadKey(nextKey);
  assert.equal(restarted.record.readKey.credentials.keyId, nextKey.keyId); assert.equal(d.files.length, 3); assert.equal(d.files[1].appProperties.status, 'pending');
  restarted.nextAttempt = 0; d.files.splice(2, 1); await restarted.tick(); assert.equal(restarted.record.invalidProof, false); assert.ok(engine.config.remoteRecovery); assert.equal(d.files.length, 3);
  restarted.nextAttempt = 0; restarted.validateKey = async () => { throw failure('DENIED'); }; await restarted.tick(); assert.equal(engine.config.remoteRecovery, undefined); assert.equal(restarted.record.invalidProof, true); assert.equal(restarted.getState().status, 'attention');
});

test('fresh app has valid unconfigured state; corrupt empty-profile journal is preserved and recoverable', async t => {
  const dir = await directory(t), auth = { tokens: { sub: subject }, open: async () => fs.mkdir(path.join(dir, 'account-recovery'), { recursive: true }), getState: () => ({ connected: true }), connect: async () => {} };
  const options = { root: dir, engine: { config: null }, secretStore, auth, vault: {} };
  const fresh = new RecoveryService(options); await fresh.open(); assert.equal(fresh.getState().verifiedAt, null); assert.equal(fresh.getState().status, 'notSaved'); await fresh.stop();
  await fs.writeFile(path.join(dir, 'account-recovery', 'recovery.bin'), 'corrupt fixture');
  const damaged = new RecoveryService(options); await damaged.open(); t.after(() => damaged.stop()); assert.equal(damaged.blocked, true); await damaged.connect(); assert.equal(damaged.record.subject, subject); assert.ok((await fs.readdir(path.join(dir, 'account-recovery'))).some(n => n.startsWith('recovery-damaged-')));
});

test('unpublished account can switch; published binding cannot; first pending-key upload retries automatically', async t => {
  const dir = await directory(t), e = envelope(), d = memoryDrive(); let account = 'first-account', expected;
  const auth = { tokens: { sub: account }, open: async () => fs.mkdir(path.join(dir, 'account-recovery'), { recursive: true }), getState: () => ({ connected: true }), connect: async wanted => { expected = wanted; if (wanted && wanted !== account) throw failure('ACCOUNT'); auth.tokens.sub = account; }, disconnect: async () => {} };
  const engine = { config: { repositoryId: repoId, mode: 'backup', provider }, secret: e.kit.password, recoveryKit: () => e.kit, validateReadCredential: async () => {}, operation: async (_kind, fn) => fn(), save: async () => {} };
  const service = new RecoveryService({ root: dir, engine, secretStore, auth, vault: d.vault, validateKey: async () => ({ bucketId }) }); await service.open(); t.after(() => service.stop());
  await service.connect(); await service.disconnect(); account = subject; await service.connect(); assert.equal(expected, undefined); assert.equal(service.record.subject, subject);
  d.failCommit(true); await assert.rejects(service.prepareReadKey(key)); assert.equal(service.record.readKey, undefined); assert.ok(service.record.pendingKey);
  d.failCommit(false); service.nextAttempt = 0; await service.tick(); assert.equal(service.record.pending, null); assert.equal(service.getState().status, 'verified'); assert.equal(d.files.length, 1);
  await service.disconnect(); account = 'wrong-account'; await assert.rejects(service.connect(), e => e.code === 'ACCOUNT'); assert.equal(expected, subject);
});
