'use strict';
// 「Google로 시작」 · 「보호 시작」 and the account's requests (account.cjs, STAGE1_DESIGN.md 2.1 · 4.5 · 4.6) over the real
// BackupEngine with a fake restic runner, and fakes of the provisioning client and envelope v3 (their own tests are
// provision-client.test.cjs and recovery-v3.test.cjs). Test keys and passwords only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const b2 = require('../src/b2.cjs');
const { BackupEngine, customerVault, APP, VERIFIED } = require('../src/engine.cjs');
const { Account } = require('../src/account.cjs');

const encryptionKey = crypto.randomBytes(32);
const secretStore = {
  encrypt(text) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv); return Buffer.concat([iv, c.update(text), c.final(), c.getAuthTag()]); },
  decrypt(bytes) { const d = crypto.createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12)); d.setAuthTag(bytes.subarray(-16)); return Buffer.concat([d.update(bytes.subarray(12, -16)), d.final()]).toString(); },
};
const PREFIX = 'c/abcdefghijklmnop/r', CUSTOMER = 'abcdefghijklmnop', ME = 'dev000000001', OLD = 'dev000000000';
const REPO = { endpoint: 'https://s3.us-east-005.backblazeb2.com', bucket: 'backup-fixture', prefix: PREFIX };
const WK = { keyId: 'write-key-id-0001', applicationKey: 'TEST-only+write/key=1' };
const WK2 = { keyId: 'write-key-id-0002', applicationKey: 'TEST-only+write/key=2' };
const RK = { keyId: 'read-key-id-00001', applicationKey: 'TEST-only+read/key=01' };
const RK2 = { keyId: 'read-key-id-00002', applicationKey: 'TEST-only+read/key=02' };
const ID = 'a'.repeat(64), OTHER_PASSWORD = 'P'.repeat(43);
const exit = (code) => Object.assign(new Error(`restic exit ${code}`), { exitCode: code });

// restic as the engine sees it: a repository with one password, or none yet.
function restic({ password = null, snapshots = [] } = {}) {
  const r = { password, snapshots, calls: [] };
  r.run = async (args, options) => {
    r.calls.push({ args, password: options.password, credentials: options.credentials, repository: options.repository });
    if (args[0] === 'cat') { if (r.password === null) throw exit(10); if (options.password !== r.password) throw exit(12); return JSON.stringify({ id: ID }); }
    if (args[0] === 'init') { r.password = options.password; return ''; }
    if (args[0] === 'snapshots') return JSON.stringify(r.snapshots);
    return '';
  };
  return r;
}
function fakeProvision(log, { role = 'write', readKey = RK, writer = null, googleStepRequired = false } = {}) {
  return {
    device: null, pending: null, write: null,
    async open() {},
    state() { return { connected: !!this.device, role: this.device?.role || null, deviceId: this.device?.deviceId || null, customerId: this.device?.customerId || null, repository: this.device?.repository || null, needs: this.needs || [] }; },
    async provision(args) {
      log.push(['provision', args]);
      if (this.device) throw Object.assign(new Error('already'), { code: 'ALREADY' });
      this.device = { deviceId: ME, customerId: CUSTOMER, role, repository: { ...REPO } };
      this.pending = readKey; this.write = role === 'write' ? WK : null;
      return { ...this.state(), readKey, writer, googleStepRequired };
    },
    async writeCredentials() { return this.write; },
    async pendingReadKey() { return this.pending; },
    async confirmReadKey(keyId) { log.push(['confirm', keyId]); if (this.pending?.keyId === keyId) this.pending = null; return { ok: true }; },
    async takeWriteSeat() { log.push(['takeWriteSeat']); this.device.role = 'write'; this.write = WK2; return { previous: { id: OLD, name: '옛 노트북' } }; },
    async devices() { return { devices: [{ id: OLD, name: '옛 노트북', role: 'write', state: 'active', createdAt: 1, lastSeenAt: 2, current: false, token: 'never-shown' }, { id: 'bad id', name: 'x' }] }; },
    async rotateReadKey() { log.push(['rotate']); this.pending = RK2; return { readKey: RK2, googleStepRequired: false }; },
    async restorePlan(at) { return { suggestions: [], plan: null, oldestAt: at ?? 0 }; },
    async restoreRun(at) { log.push(['restoreRun', at, this.hold?.()]); if (this.restoreError) throw this.restoreError; this.write = WK2; this.pending = RK2; return { jobId: 'job1', readKey: RK2 }; },
    async restoreJob() { return { state: 'done' }; },
    async restoreChoose(jobId, choice) { log.push(['choose', jobId, choice]); return { ok: true }; },
  };
}
function fakeEnvelope(log, found = null) {
  return {
    v: null, async open() {},
    getState() { return { verified: this.v, pending: false, invalid: false }; },
    async publish(x) { log.push(['publish', x]); this.v = { verifiedAt: '2026-11-16T03:00:00.000Z', repositoryId: x.repositoryId }; return this.getState(); },
    async discover() { return found ? [{ fileId: 'file1', createdAt: '2026-11-10T00:00:00.000Z', customer: CUSTOMER }] : []; },
    async read(fileId) { log.push(['read', fileId]); return found; },
  };
}
async function fixture({ repo = restic(), provision = {}, envelope = null } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-account-'));
  const source = path.join(root, 'source'); await fs.mkdir(source); await fs.writeFile(path.join(source, 'fixture.txt'), 'fixture only');
  const make = () => new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'fixture', providerType: 'b2', secretStore, intervalMs: 3600000, probe: async () => ({ serverTime: Date.now() }), runner: repo.run });
  const engine = make(); await engine.open();
  const log = [], p = fakeProvision(log, provision), e = fakeEnvelope(log, envelope);
  const account = new Account({ root, secretStore, engine, deviceName: '작업 노트북', appVersion: '0.7.0',
    make: { auth: () => ({ async open() {}, getState: () => ({ available: true, connected: true, email: 'person@example.test' }) }), provision: () => p, envelope: () => e } });
  await account.open();
  return { root, source, engine, account, log, provision: p, envelope: e, repo, make };
}
const secretsIn = (value, f) => [WK, WK2, RK, RK2].flatMap((k) => [k.keyId, k.applicationKey]).concat([f.engine.secret, OTHER_PASSWORD].filter(Boolean)).filter((s) => JSON.stringify(value).includes(s));

test('the customer repository: c/<16>/r or 0.6 work-backup/<vault>, nothing else (b2.provider)', () => {
  const vault = '450e7286-744b-4d69-aeef-00c5244f54df', base = { endpoint: 's3.us-east-005.backblazeb2.com', bucket: 'backup-fixture' };
  assert.equal(b2.provider({ ...base, prefix: PREFIX }, customerVault(PREFIX)).prefix, PREFIX);
  assert.equal(b2.provider({ ...base, prefix: `work-backup/${vault}` }, vault).prefix, `work-backup/${vault}`);
  for (const prefix of ['c/abcdefghijklmnop/', 'c/ABCDEFGHIJKLMNOP/r', 'c/abcdefghijklmnop/r/x', `work-backup/${customerVault(PREFIX)}`, undefined, '']) assert.throws(() => b2.provider({ ...base, prefix }, vault), /경로/, String(prefix));
  // One vault for every device of the customer, shaped like the random one.
  assert.equal(customerVault(PREFIX), customerVault(PREFIX));
  assert.notEqual(customerVault(PREFIX), customerVault('c/abcdefghijklmnoq/r'));
  assert.match(customerVault(PREFIX), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('Google로 시작 → 보호 시작: repository made at the server prefix, host = device, envelope read back before the key is confirmed', async () => {
  const f = await fixture();
  await f.account.signIn();
  assert.deepEqual(f.log[0], ['provision', { name: '작업 노트북', appVersion: '0.7.0' }]);
  await f.account.startProtection({ sources: [f.source] });
  const c = f.engine.config;
  assert.equal(c.host, ME); assert.equal(f.engine.hostName, ME);
  assert.equal(c.vaultId, customerVault(PREFIX)); assert.equal(c.provider.prefix, PREFIX); assert.equal(c.repositoryId, ID);
  assert.equal(f.repo.calls.filter((x) => x.args[0] === 'init').length, 1);
  assert.deepEqual(f.repo.calls.find((x) => x.args[0] === 'init').credentials, WK, 'the repository is made with this device\'s write key');
  // The envelope: exactly the place, the repository, its password and the read key; the key is confirmed only after.
  const published = f.log.find((x) => x[0] === 'publish')[1];
  assert.deepEqual(published, { repository: REPO, repositoryId: ID, password: f.engine.secret, readKey: RK });
  assert.ok(f.log.findIndex((x) => x[0] === 'publish') < f.log.findIndex((x) => x[0] === 'confirm'));
  assert.deepEqual(f.log.find((x) => x[0] === 'confirm'), ['confirm', RK.keyId]);
  assert.equal(f.engine.hasRecovery(), true, 'the envelope is the first recovery');
  const s = f.account.state();
  assert.equal(s.role, 'write'); assert.equal(s.device, '작업 노트북'); assert.deepEqual(s.needs, []);
  f.provision.needs = ['read-key', 'token', 'restore']; assert.deepEqual(f.account.state().needs, ['read-key', 'restore'], 'only the words the screen knows'); f.provision.needs = []; assert.deepEqual(s.envelope, { verifiedAt: '2026-11-16T03:00:00.000Z' });
  assert.deepEqual(secretsIn(s, f), []); assert.deepEqual(secretsIn(f.engine.getState(), f), []);
  // Again after it is done: nothing is made twice, and a stopped start goes on.
  await f.account.signIn();
  await f.account.startProtection({ sources: [f.source] });
  assert.equal(f.repo.calls.filter((x) => x.args[0] === 'init').length, 1);
  assert.equal(f.log.filter((x) => x[0] === 'publish').length, 1);
  // The saved settings open again (the host and the customer vault are checked).
  const again = f.make(); await again.open();
  assert.equal(again.hostName, ME); assert.equal(again.config.vaultId, customerVault(PREFIX));
});

test('a customer repository already there is never made again: REPO_EXISTS, then 이어서 백업 opens it from the envelope', async () => {
  const repo = restic({ password: OTHER_PASSWORD, snapshots: [{ id: 'b'.repeat(64), time: '2026-11-15T00:00:00.000Z', hostname: OLD, tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] }] });
  const f = await fixture({ repo, provision: { readKey: null }, envelope: { repository: { ...REPO }, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK } });
  await f.account.signIn();
  await assert.rejects(f.account.startProtection({ sources: [f.source] }), (e) => e.code === 'REPO_EXISTS');
  assert.equal(f.engine.config, null, 'nothing is kept from the refused start');
  assert.equal(repo.calls.filter((x) => x.args[0] === 'init').length, 0);
  await f.account.continueBackup({ sources: [f.source] });
  const c = f.engine.config;
  assert.equal(c.mode, 'backup'); assert.equal(c.readOnly, false); assert.equal(c.host, ME, 'its own backups carry this device');
  assert.equal(f.engine.secret, OTHER_PASSWORD); assert.deepEqual(f.engine.cloudCredentials, WK);
  assert.equal(c.sources.length, 1, 'the folders this PC backs up');
  assert.equal(f.engine.hasRecovery(), true);
  assert.equal(repo.calls.filter((x) => x.args[0] === 'init').length, 0);
});

test('Google 2단계 걸음 after a loss report cannot be skipped: the envelope waits for it', async () => {
  const f = await fixture({ provision: { googleStepRequired: true } });
  await f.account.signIn();
  assert.equal(f.account.state().googleStepRequired, true);
  await assert.rejects(f.account.startProtection({ sources: [f.source] }), (e) => e.code === 'GOOGLE_STEP');
  assert.ok(f.engine.config.repositoryId, 'the repository is there');
  assert.equal(f.log.filter((x) => x[0] === 'publish' || x[0] === 'confirm').length, 0);
  // 「이어서 백업」 does not pass it either (GPT workbackup-account GA2).
  await assert.rejects(f.account.continueBackup({ sources: [f.source] }), (e) => e.code === 'GOOGLE_STEP');
  assert.equal(f.log.filter((x) => x[0] === 'publish' || x[0] === 'confirm').length, 0);
  await f.account.continueBackup({ sources: [f.source], googleStepDone: true });
  assert.deepEqual(f.log.filter((x) => x[0] === 'publish' || x[0] === 'confirm').map((x) => x[0]), ['publish', 'confirm']);
  assert.equal(f.account.state().googleStepRequired, false);
});

test('되돌리기: the hold is written before the request, a refusal clears it, an unknown answer keeps it and the runs rest', async () => {
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  f.provision.hold = () => !!f.engine.config.serverRestore;
  f.provision.restoreError = Object.assign(new Error('old'), { code: 'TOO_OLD' });
  await assert.rejects(f.account.restoreRun(Date.now() - 1000), (e) => e.code === 'TOO_OLD');
  assert.equal(f.log.find((x) => x[0] === 'restoreRun')[2], true, 'the hold was there when the server was asked');
  assert.equal(f.engine.config.serverRestore, undefined, 'a refusal started nothing');
  f.provision.restoreError = Object.assign(new Error('offline'), { code: 'NETWORK' });
  await assert.rejects(f.account.restoreRun(Date.now() - 1000), (e) => e.code === 'NETWORK');
  assert.ok(f.engine.config.serverRestore, 'an answer that never came keeps the hold');
  // A new request refused while that one may still run does not take its hold away (GPT workbackup-account GA1).
  const held = f.engine.config.serverRestore.since;
  f.provision.restoreError = Object.assign(new Error('busy'), { code: 'BUSY' });
  await assert.rejects(f.account.restoreRun(Date.now() - 1000), (e) => e.code === 'BUSY');
  assert.equal(f.engine.config.serverRestore?.since, held);
  f.engine.config.automatic = true;
  assert.deepEqual(await f.engine.runOnce({ force: true }), { outcome: 'skipped', reason: 'restore' });
  assert.throws(() => f.engine.assertBackupReady(), (e) => e.code === 'RESTORE_PENDING');
  // The restore itself: new write key for the engine, the new read key into the envelope, the choice clears the hold.
  f.provision.restoreError = null;
  assert.deepEqual(await f.account.restoreRun(Date.now() - 1000), { jobId: 'job1' });
  assert.deepEqual(f.engine.cloudCredentials, WK2);
  assert.deepEqual(f.log.filter((x) => x[0] === 'publish').at(-1)[1].readKey, RK2);
  assert.deepEqual(f.log.at(-1), ['confirm', RK2.keyId]);
  assert.ok(f.engine.config.serverRestore);
  await assert.rejects(f.account.restoreChoose('job1', 'later'), (e) => e.code === 'BAD_INPUT');
  await f.account.restoreChoose('job1', 'continue');
  assert.equal(f.engine.config.serverRestore, undefined);
  const again = f.make(); await again.open(); assert.equal(again.config.serverRestore, undefined);
  // A started job whose envelope step must wait (the Google step after a loss) still gives its number; the read key
  // it brought is reused by rotateReadKey once the step is done, without asking the server for another.
  f.account.info.googleStepRequired = true;
  assert.deepEqual(await f.account.restoreRun(Date.now() - 1000), { jobId: 'job1', left: 'GOOGLE_STEP' });
  const rotations = f.log.filter((x) => x[0] === 'rotate').length;
  await f.account.rotateReadKey({ googleStepDone: true });
  assert.equal(f.log.filter((x) => x[0] === 'rotate').length, rotations);
  assert.deepEqual(f.log.at(-1), ['confirm', RK2.keyId]);
});

test('a PC that does not write opens the account backup restore-only, then takes the seat as itself', async () => {
  const repo = restic({ password: OTHER_PASSWORD, snapshots: [
    { id: 'b'.repeat(64), time: '2026-11-15T00:00:00.000Z', hostname: OLD, tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] },
    { id: 'c'.repeat(64), time: '2026-11-16T00:00:00.000Z', hostname: 'not a device', tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] }] });
  const f = await fixture({ repo, provision: { role: 'read', readKey: null, writer: { id: OLD, name: '옛 노트북' } }, envelope: { repository: { ...REPO }, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK } });
  await f.account.signIn();
  assert.equal(f.account.state().writer, '옛 노트북');
  await assert.rejects(f.account.startProtection({ sources: [f.source] }), (e) => e.code === 'NOT_WRITER');
  await f.account.openBackup();
  const c = f.engine.config;
  assert.equal(c.mode, 'restore'); assert.equal(c.readOnly, true); assert.equal(c.host, OLD, 'restore-only reads the device of the newest complete backup');
  assert.deepEqual(f.engine.cloudCredentials, RK);
  assert.equal(c.lastBackup.id, 'b'.repeat(64), 'a snapshot whose host is not a device is not read');
  assert.equal((await f.engine.snapshots([VERIFIED], { host: OLD })).length, 1);
  assert.deepEqual(await f.account.devices(), [{ id: OLD, name: '옛 노트북', role: 'write', state: 'active', createdAt: 1, lastSeenAt: 2, current: false }]);
  // A new read key moves the restore-only connection to it before it is confirmed (GPT workbackup-account GA3).
  await f.account.rotateReadKey();
  assert.deepEqual(f.engine.cloudCredentials, RK2);
  const confirmAt = f.log.findIndex((x) => x[0] === 'confirm' && x[1] === RK2.keyId);
  assert.ok(confirmAt > f.log.findIndex((x) => x[0] === 'publish'));
  const reopened = f.make(); await reopened.open(); assert.deepEqual(reopened.cloudCredentials, RK2);
  const r = await f.account.takeWriteSeat({ sources: [f.source] });
  assert.equal(r.previous, '옛 노트북');
  assert.equal(f.engine.config.mode, 'backup'); assert.equal(f.engine.config.host, ME); assert.deepEqual(f.engine.cloudCredentials, WK2);
  const again = f.make(); await again.open(); assert.equal(again.hostName, ME);
});

test('settings of a customer repository open only with its own vault and a device number', async () => {
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const file = path.join(f.engine.stateDir, 'settings.json'), saved = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const change of [{ host: undefined }, { host: 'Not-A-Device' }, { vaultId: '450e7286-744b-4d69-aeef-00c5244f54df', repository: `s3:${REPO.endpoint}/${REPO.bucket}/${PREFIX}` }]) {
    await fs.writeFile(file, JSON.stringify({ ...saved, ...change }));
    await assert.rejects(f.make().open(), /설정 형식|경로/, JSON.stringify(change));
  }
});

test('the account refuses what it cannot check, and no key reaches the screen', async () => {
  const f = await fixture();
  await assert.rejects(f.account.startProtection({ sources: [f.source] }), (e) => e.code === 'NOT_SIGNED_IN');
  await assert.rejects(f.account.signIn({ hint: 'not an address' }), (e) => e.code === 'BAD_INPUT');
  await f.account.signIn();
  for (const bad of ['', 'DEV000000001', 'dev00000000', '../x']) await assert.rejects(f.account.revokeDevice(bad), (e) => e.code === 'BAD_INPUT');
  await assert.rejects(f.account.restoreRun('yesterday'), (e) => e.code === 'BAD_INPUT');
  await assert.rejects(f.account.restoreJob('../job'), (e) => e.code === 'BAD_INPUT');
  const none = new Account({ root: f.root, secretStore, engine: f.engine, appVersion: '0.7.0' });
  assert.equal(none.state().available, false);
  await assert.rejects(none.signIn(), (e) => e.code === 'NO_GOOGLE');
  // A full account: the screen gets the devices to cut off, never their tokens.
  const full = await fixture();
  full.provision.provision = async () => { throw Object.assign(new Error('full'), { code: 'LIMIT_DEVICES', extra: { devices: [{ id: OLD, name: '옛 노트북', role: 'read', state: 'active', createdAt: 5, token: 'wbd_secret' }] } }); };
  await assert.rejects(full.account.signIn(), (e) => e.code === 'LIMIT_DEVICES' && !JSON.stringify(e.details).includes('wbd_secret') && e.details.devices[0].id === OLD);
});
