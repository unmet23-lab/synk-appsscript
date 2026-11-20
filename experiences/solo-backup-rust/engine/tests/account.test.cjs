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
    // 대량 삭제 · 변경 멈춤 (4.4): the comparison before clean-up finds nothing changed.
    if (args[0] === 'diff') { await options.consumeStdout(require('node:stream').Readable.from([Buffer.from(JSON.stringify({ message_type: 'statistics', changed_files: 0, added: { files: 0, bytes: 0 }, removed: { files: 0, dirs: 0, others: 0, bytes: 0 } }))])); return ''; }
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
    async restoreJob(id) { return this.jobs?.[id] ?? { id, state: 'done' }; },
    async restoreChoose(jobId, choice) { log.push(['choose', jobId, choice]); return this.chooseAnswer ?? (choice === 'continue' ? { state: 'continued' } : { ok: true }); },
    async status() { return this.statusValue ?? { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' }; },
    // As the real client: the server removes every read key of the account, the one kept here stays (GPT ui2 GA1).
    async lost() { log.push(['lost']); return { next: 'other' }; },
  };
}
function fakeEnvelope(log, found = null) {
  return {
    v: null, async open() {},
    getState() { return { verified: this.v, pending: false, invalid: false }; },
    async publish(x) { log.push(['publish', x]); this.v = { verifiedAt: '2026-11-16T03:00:00.000Z', repositoryId: x.repositoryId }; if (found) found = { ...x }; return this.getState(); },
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
  f.provision.needs = ['read-key', 'token', 'restore']; assert.deepEqual(f.account.state().needs, ['read-key'], 'only the words the screen knows');
  // 'restore' (an answer that was lost) only while the hold has not found its job.
  f.engine.config.serverRestore = { since: new Date().toISOString() }; assert.deepEqual(f.account.state().needs, ['read-key', 'restore']);
  f.engine.config.serverRestore.jobId = 'job1'; assert.deepEqual(f.account.state().needs, ['read-key']); delete f.engine.config.serverRestore; f.provision.needs = []; assert.deepEqual(s.envelope, { verifiedAt: '2026-11-16T03:00:00.000Z' });
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
  full.provision.provision = async () => { throw Object.assign(new Error('full'), { code: 'LIMIT_DEVICES', extra: { devices: [{ id: OLD, name: '옛 노트북', role: 'read', state: 'active', createdAt: 5, token: 'wbd_secret', sameInstall: true }, { id: 'dev000000002', name: '다른 PC', role: 'read', state: 'active', createdAt: 6, sameInstall: 'yes' }] } }); };
  await assert.rejects(full.account.signIn(), (e) => e.code === 'LIMIT_DEVICES' && !JSON.stringify(e.details).includes('wbd_secret') && e.details.devices[0].id === OLD
    // 화면 요청 15: the server's mark of this same PC reaches the screen, and only a real true counts.
    && e.details.devices[0].sameInstall === true && e.details.devices[1].sameInstall === false);
});

test('the server status reaches the writer: a moved seat rests the PC, a restore or the limit holds the run, a copied snapshot is pinned', async () => {
  const { applyStatus } = require('../src/account.cjs');
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const e = f.engine; e.config.automatic = true;
  const at = Date.now() + 86400000, pinned = 'f'.repeat(64);
  // Another device's status, or a restore-only connection, changes nothing here.
  assert.equal(await applyStatus(e, { device: { state: 'moved', movedTo: { id: OLD, name: '새 노트북' } } }, OLD), false);
  assert.equal(e.config.movedTo, undefined);
  await applyStatus(e, { device: { state: 'active' }, restore: null, customer: { overQuota: false }, move: { snapshotId: pinned, until: at, byThisDevice: false } }, ME);
  assert.deepEqual(e.config.movePin, { snapshotId: pinned, until: new Date(at).toISOString() });
  assert.equal(e.accountHold, null);
  await applyStatus(e, { device: { state: 'active' }, move: { snapshotId: pinned, until: at, byThisDevice: true } }, ME);
  assert.equal(e.config.movePin, undefined, 'this PC is not asked to keep its own copy');
  for (const [status, reason] of [[{ device: { state: 'active' }, restore: { state: 'running' } }, 'restore'], [{ device: { state: 'active' }, restore: { state: 'done', awaitingChoice: true } }, 'restore'], [{ device: { state: 'active' }, customer: { overQuota: true } }, 'over-quota']]) {
    await applyStatus(e, status, ME);
    assert.deepEqual(await e.runOnce({ force: true }), { outcome: 'skipped', reason });
  }
  await applyStatus(e, { device: { state: 'moved', movedTo: { id: OLD, name: '새 노트북' } } }, ME);
  assert.equal(e.getState().movedTo.device, '새 노트북');
  assert.deepEqual(await e.runOnce({ force: true }), { outcome: 'skipped', reason: 'moved' });
  assert.throws(() => e.assertBackupReady(), (x) => x.code === 'MOVED');
  // 「이 PC로 다시 백업」 takes the seat back and ends the rest.
  await f.account.takeWriteSeat({ sources: [f.source] });
  assert.equal(e.config.movedTo, undefined);
  await applyStatus(e, { device: { state: 'active' } }, ME);
  assert.equal(e.accountHold, null);
});

test("cleanup keeps this device's newest complete backup and the pinned copy; another device's never counts or goes", async () => {
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const e = f.engine, now = Date.now(), day = 86400000, vault = `vault:${e.config.vaultId}`;
  const snap = (c, ago, host, tags = [VERIFIED]) => ({ id: c.repeat(64), time: new Date(now - ago).toISOString(), hostname: host, tags: [APP, vault, ...tags], paths: [f.source] });
  e.config.health = { status: 'ok', checkedAt: new Date(now - 1000).toISOString() };
  e.config.lastBackup = { id: 'd'.repeat(64), at: new Date(now).toISOString() };
  e.config.movePin = { snapshotId: 'e'.repeat(64), until: new Date(now + day).toISOString() };
  // The other device's backup is newer than this one's: it is not this device's newest, and it is never forgotten.
  e.snapshots = async () => [snap('f', -60000, OLD), snap('d', 0, ME), snap('e', 2 * day, ME), snap('9', 3 * day, ME), snap('8', 4 * day, OLD)];
  await e.retain();
  const forgot = f.repo.calls.filter((c) => c.args[0] === 'forget').flatMap((c) => c.args.slice(1));
  assert.deepEqual(forgot, ['9'.repeat(64)]);
  // Once the pin's time is over the copy goes like any other old backup.
  e.config.movePin.until = new Date(now - 1).toISOString(); f.repo.calls.length = 0;
  await e.retain();
  assert.deepEqual(f.repo.calls.filter((c) => c.args[0] === 'forget').flatMap((c) => c.args.slice(1)), ['e'.repeat(64), '9'.repeat(64)]);
});

test('a run reads the status first and sends its measurement when the worker stops; one not sent waits for the next run', async () => {
  const { createRunner } = require('../../worker/runner.cjs');
  const { cleanBatch } = await import('../../server/telemetry.mjs');
  // The run's profiles read the settings the window wrote (secrets kept in the clear by this fake host).
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-account-run-'));
  const source = path.join(root, 'source'); await fs.mkdir(source);
  const plain = { encrypt: async (v) => Buffer.from(v), decrypt: async (b) => b.toString() };
  const repo = restic();
  const engine = new BackupEngine({ stateDir: path.join(root, 'cloud-vault'), resticPath: 'fixture', providerType: 'b2', secretStore: plain, probe: async () => ({ serverTime: Date.now() }), runner: repo.run });
  await engine.open();
  const log = [], p = fakeProvision(log), env = fakeEnvelope(log);
  const account = new Account({ root, secretStore: plain, engine, appVersion: '0.7.0', make: { auth: () => ({ async open() {}, getState: () => ({ available: true, connected: true, email: null }) }), provision: () => p, envelope: () => env } });
  await account.open(); await account.signIn(); await account.startProtection({ sources: [source] });
  const host = async (m, a) => m === 'secret.encrypt' ? Buffer.from(String(a[0])).toString('base64') : m === 'secret.decrypt' ? Buffer.from(a[0], 'base64').toString() : null;
  const sent = [];
  let status = { device: { state: 'active' }, move: { snapshotId: 'f'.repeat(64), until: Date.now() + 86400000, byThisDevice: false } }, offline = false;
  const server = { state: () => ({ connected: true, deviceId: ME }), status: async () => status, telemetry: async (b) => { if (offline) throw Object.assign(new Error('offline'), { code: 'NETWORK' }); sent.push(b); return { accepted: true }; } };
  const run = async (trigger) => { const r = await createRunner({ host, root, resticPath: 'fixture', server, restic: repo.run }); const v = await r.runOnce({ trigger }); await r.stop(); return v; };
  const settings = async () => JSON.parse(await fs.readFile(path.join(root, 'cloud-vault', 'settings.json'), 'utf8'));
  assert.deepEqual((await run('hourly')).profiles.b2, { outcome: 'skipped', reason: 'off' });
  assert.equal((await settings()).movePin.snapshotId, 'f'.repeat(64), 'the pin is written before the run');
  assert.equal(sent.length, 1);
  const kept = cleanBatch(sent[0]);
  assert.deepEqual(kept.runs.map((r) => [r.trigger, r.result, r.pause]), [['hourly', 'skipped', 'none']]);
  assert.equal(kept.dropped.unknownFields, 0); assert.equal(kept.dropped.items, 0);
  assert.equal(kept.env.appVersion, '0.7.0');
  // Moved: even the person's run rests. Offline: the run is queued and goes with the next one.
  status = { device: { state: 'moved', movedTo: { id: OLD, name: '새 노트북' } } }; offline = true;
  assert.deepEqual((await run('manual')).profiles.b2, { outcome: 'skipped', reason: 'moved' });
  assert.equal((await settings()).movedTo.device, '새 노트북');
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'telemetry-queue.json'), 'utf8')).runs.length, 1);
  offline = false;
  await run('logon');
  assert.deepEqual(cleanBatch(sent.at(-1)).runs.map((r) => [r.trigger, r.result]), [['manual', 'skipped'], ['logon', 'skipped']]);
  await assert.rejects(fs.access(path.join(root, 'telemetry-queue.json')), 'the queue goes once it is sent');
  // A test run is not measured.
  const before = sent.length; await run('test'); assert.equal(sent.length, before);
});

test('measurements are whole numbers and fixed words the server keeps', async () => {
  const { telemetryRun } = require('../src/account.cjs');
  const { cleanBatch } = await import('../../server/telemetry.mjs');
  const startedAt = Date.now() - 60000;
  const items = [
    telemetryRun({ trigger: 'hourly', startedAt, result: { outcome: 'complete', durationMs: 4200, files: 12, bytes: 3456, filesNew: 1, filesChanged: 2, filesUnmodified: 9, dataAdded: 77, resticStartedAt: startedAt + 800 }, maxRssKb: 81234, cpuMs: 950 }),
    telemetryRun({ trigger: 'wake', startedAt, result: { outcome: 'partial', unreadable: 3, fill: ['C:'], durationMs: 9000 }, fill: { outcome: 'fill', left: 0 } }),
    telemetryRun({ trigger: 'unlock', startedAt, result: { outcome: 'failed', exitCode: 1, durationMs: 300 } }),
    telemetryRun({ trigger: 'logon', startedAt, result: { outcome: 'skipped', reason: 'paused' } }),
    telemetryRun({ trigger: 'hourly', startedAt, result: { outcome: 'skipped', reason: 'battery' }, skipCloud: 'battery' }),
    // 솔리오의 요청 작업이 띄운 회차가 쉬도록 고른 Wi-Fi에서 쉰 것(4.13 · 4.14): 서버가 두 낱말을 그대로 받는다.
    telemetryRun({ trigger: 'request', startedAt, result: { outcome: 'skipped', reason: 'network' }, skipCloud: 'network' }),
  ];
  const kept = cleanBatch({ runs: items });
  assert.equal(kept.runs.length, 6); assert.deepEqual(kept.dropped, { unknownFields: 0, items: 0 });
  assert.deepEqual([kept.runs[5].trigger, kept.runs[5].result, kept.runs[5].pause], ['request', 'skipped', 'network']);
  assert.deepEqual(kept.runs[0].files, { new: 1, changed: 2, unmodified: 9 }); assert.deepEqual(kept.runs[0].bytes, { added: 77, processed: 3456 });
  assert.equal(kept.runs[0].resticStartMs, 800); assert.equal(kept.runs[0].peakMemory, 81234 * 1024);
  assert.deepEqual(kept.runs[1].fill, { tried: true, result: 'done' });
  assert.deepEqual([kept.runs[3].result, kept.runs[3].pause, kept.runs[4].pause], ['paused', 'user', 'battery']);
  assert.equal(telemetryRun({ trigger: 'test', startedAt, result: { outcome: 'complete' } }), null);
  assert.ok(!JSON.stringify(items).includes('C:'), 'no drive, path or name goes');
});

test('a run that rests asks no fill and writes none; a late status answer changes nothing under the run (GPT runstatus GA1 · GA2)', async () => {
  const { applyStatus } = require('../src/account.cjs');
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const e = f.engine;
  e.config.lastPartial = { id: 'c'.repeat(64), at: new Date().toISOString(), volumes: ['C:'] }; e.config.lastFill = null;
  assert.deepEqual(e.fillDue(), ['C:'], 'due while nothing holds it');
  for (const [status, code] of [[{ device: { state: 'active' }, restore: { state: 'preparing' } }, 'RESTORE_PENDING'], [{ device: { state: 'active' }, customer: { overQuota: true } }, 'OVER_QUOTA']]) {
    await applyStatus(e, status, ME);
    assert.equal(e.fillDue(), null);
    assert.throws(() => e.assertBackupReady(), (x) => x.code === code);
  }
  await applyStatus(e, { device: { state: 'active' } }, ME);
  assert.deepEqual(e.fillDue(), ['C:']);
  // The choice clears the wait the window knew of.
  e.accountHold = 'restore'; e.config.serverRestore = { since: new Date().toISOString() };
  await f.account.restoreChoose('job1', 'continue');
  assert.equal(e.accountHold, null);

  // A status that answers after the run's limit is not applied, then or later.
  const { createRunner } = require('../../worker/runner.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-account-late-'));
  const source = path.join(root, 'source'); await fs.mkdir(source);
  const plain = { encrypt: async (v) => Buffer.from(v), decrypt: async (b) => b.toString() };
  const repo = restic();
  const engine = new BackupEngine({ stateDir: path.join(root, 'cloud-vault'), resticPath: 'fixture', providerType: 'b2', secretStore: plain, probe: async () => ({ serverTime: Date.now() }), runner: repo.run });
  await engine.open();
  const log = [], account = new Account({ root, secretStore: plain, engine, appVersion: '0.7.0', make: { auth: () => ({ async open() {}, getState: () => ({ available: true, connected: true, email: null }) }), provision: () => fakeProvision(log), envelope: () => fakeEnvelope(log) } });
  await account.open(); await account.signIn(); await account.startProtection({ sources: [source] });
  const host = async (m, a) => m === 'secret.encrypt' ? Buffer.from(String(a[0])).toString('base64') : m === 'secret.decrypt' ? Buffer.from(a[0], 'base64').toString() : null;
  let answered = false;
  const server = { state: () => ({ connected: true, deviceId: ME }), status: () => new Promise((ok) => setTimeout(() => { answered = true; ok({ device: { state: 'moved', movedTo: { id: OLD, name: '새 노트북' } } }); }, 300)), telemetry: async () => ({ accepted: true }) };
  const r = await createRunner({ host, root, resticPath: 'fixture', server, restic: repo.run, serverMs: 50 });
  assert.deepEqual((await r.runOnce({ trigger: 'hourly' })).profiles.b2, { outcome: 'skipped', reason: 'off' });
  await new Promise((ok) => setTimeout(ok, 400));
  assert.equal(answered, true);
  await r.stop();
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'cloud-vault', 'settings.json'), 'utf8')).movedTo, undefined);
});

test('되돌리기 상태: the hold keeps its job, an undo keeps it on the new job, and it goes when the server no longer has it open (화면 부탁 7 · 8)', async () => {
  const { applyStatus } = require('../src/account.cjs');
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const e = f.engine; e.config.automatic = true;
  const at = Date.now() - 60000;
  assert.deepEqual(await f.account.restoreRun(at), { jobId: 'job1' });
  assert.deepEqual(e.config.serverRestore.jobId, 'job1');
  assert.deepEqual(f.account.state().restore, { hold: true, jobId: 'job1', state: 'running', awaitingChoice: false, at, finishedAt: null, byThisDevice: true, error: null, undo: false, undoError: null });
  // Closed and opened again: the settings keep the hold and its number, the view keeps what the server said.
  const reopened = new Account({ root: f.root, secretStore, engine: f.make(), appVersion: '0.7.0', make: { auth: () => ({ async open() {}, getState: () => ({ available: true, connected: true, email: null }) }), provision: () => f.provision, envelope: () => f.envelope } });
  await reopened.engine.open(); await reopened.open();
  assert.equal(reopened.state().restore.jobId, 'job1'); assert.equal(reopened.state().restore.hold, true); assert.equal(reopened.state().restore.state, 'running');
  // The status that shows it waiting for the choice keeps the hold; the runs rest.
  assert.deepEqual(await applyStatus(e, { device: { state: 'active' }, restore: { jobId: 'job1', state: 'done', awaitingChoice: true, at, byThisDevice: true } }, ME), {});
  assert.equal(e.config.serverRestore.jobId, 'job1');
  assert.deepEqual(await e.runOnce({ force: true }), { outcome: 'skipped', reason: 'restore' });
  // 「되돌리기 취소」: the server's new job holds this PC until it ends, and its number is the state's.
  f.provision.chooseAnswer = { ok: true, state: 'undone', jobId: 'job2' };
  assert.deepEqual(await f.account.restoreChoose('job1', 'undo'), { ok: true, jobId: 'job2' });
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job2', undo: true });
  assert.equal(f.account.state().restore.jobId, 'job2'); assert.equal(f.account.state().restore.undo, true);
  assert.deepEqual(await e.runOnce({ force: true }), { outcome: 'skipped', reason: 'restore' });
  assert.throws(() => e.assertBackupReady(), (x) => x.code === 'RESTORE_PENDING');
  await applyStatus(e, { device: { state: 'active' }, restore: { jobId: 'job2', state: 'running', byThisDevice: true } }, ME);
  assert.equal(e.config.serverRestore.jobId, 'job2');
  // A status without the restore field says nothing about it.
  await applyStatus(e, { device: { state: 'active' } }, ME);
  assert.equal(e.config.serverRestore.jobId, 'job2');
  // The undo ended: no restore open any more, the hold goes and the runs go on.
  assert.deepEqual(await applyStatus(e, { device: { state: 'active' }, restore: null }, ME), { released: 'job2' });
  assert.equal(e.config.serverRestore, undefined);
  assert.notDeepEqual(await e.runOnce({ force: true }), { outcome: 'skipped', reason: 'restore' });

  // A failed restore: the window's look lets the hold go and keeps how it ended for the screen.
  f.provision.chooseAnswer = null;
  await f.account.restoreRun(at);
  f.provision.jobs = { job1: { id: 'job1', state: 'failed', at, finishedAt: at + 5000, error: 'INTERRUPTED', awaitingChoice: false }, job4: { id: 'job4', state: 'running', at } };
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.equal(e.config.serverRestore, undefined);
  assert.deepEqual(f.account.state().restore, { hold: false, jobId: 'job1', state: 'failed', awaitingChoice: false, at, finishedAt: at + 5000, byThisDevice: null, error: 'INTERRUPTED', undo: false, undoError: null });
  assert.equal(f.account.state().restoreEnded, null, 'a failure is the restore view\'s, not an end to tell');
  await f.account.refresh();
  assert.equal(f.account.state().restore.error, 'INTERRUPTED', 'a failure stays until another restore');

  // An answer that never came: the hold has no number; the status finds the job, the keys it brought are asked for again.
  f.provision.restoreError = Object.assign(new Error('offline'), { code: 'NETWORK' });
  f.provision.needs = ['restore'];
  await assert.rejects(f.account.restoreRun(at), (x) => x.code === 'NETWORK');
  assert.equal(e.config.serverRestore.jobId, undefined);
  assert.deepEqual(f.account.state().needs, ['restore']);
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job4', state: 'running', at, byThisDevice: true }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.equal(e.config.serverRestore.jobId, 'job4');
  assert.deepEqual(f.account.state().needs, ['write-key', 'read-key'], 'the restore is found; its keys are asked for again');
  assert.equal(f.account.state().restore.state, 'running');
  // Another device's restore holds the runs, and a hold of this PC whose job is not open goes.
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job5', state: 'running', at, byThisDevice: false }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.equal(e.config.serverRestore, undefined); assert.equal(e.accountHold, 'restore');
  assert.equal(f.account.state().restore.byThisDevice, false);
  assert.equal(f.account.holding(), true);
});

const reopen = async (f) => {
  const a = new Account({ root: f.root, secretStore, engine: f.make(), appVersion: '0.7.0', make: { auth: () => ({ async open() {}, getState: () => ({ available: true, connected: true, email: null }) }), provision: () => f.provision, envelope: () => f.envelope } });
  await a.engine.open(); await a.open(); return a;
};

test('복구 전용 연결 PC의 되돌리기: the request takes the seat on the server; this PC holds and follows it, and only reads (화면 부탁 1)', async () => {
  const { applyStatus } = require('../src/account.cjs');
  const repo = restic({ password: OTHER_PASSWORD, snapshots: [{ id: 'b'.repeat(64), time: '2026-11-15T00:00:00.000Z', hostname: OLD, tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] }] });
  const f = await fixture({ repo, provision: { role: 'read', readKey: null, writer: { id: OLD, name: '옛 노트북' } }, envelope: { repository: { ...REPO }, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK } });
  await f.account.signIn(); await f.account.openBackup();
  const e = f.engine;
  assert.equal(e.config.mode, 'restore'); assert.equal(e.config.host, OLD);
  let waited = false;
  f.provision.writeCredentials = async () => { waited = true; return WK2; };
  const at = Date.now() - 60000;
  assert.deepEqual(await f.account.restoreRun(at), { jobId: 'job1' });
  assert.equal(waited, false, 'a reading PC does not wait for the write key it does not use');
  assert.equal(e.config.mode, 'restore'); assert.equal(e.config.host, OLD);
  assert.deepEqual(e.cloudCredentials, RK2, 'it reads with the new read key, which went into the envelope');
  assert.deepEqual(f.log.filter((x) => x[0] === 'publish').at(-1)[1].readKey, RK2);
  assert.equal(e.config.serverRestore.jobId, 'job1');
  assert.equal(f.account.state().restore.hold, true); assert.equal(f.account.holding(), true);
  // The run's status (no repository given) leaves a reading PC alone; the window's follows its hold only — the seat,
  // the limit and the pin stay the writing PC's.
  assert.equal(await applyStatus(e, { device: { state: 'moved', movedTo: { name: 'x' } }, restore: null }, ME), false);
  assert.equal(e.config.serverRestore.jobId, 'job1');
  const busy = { device: { state: 'moved', movedTo: { name: 'x' } }, restore: { jobId: 'job1', state: 'done', awaitingChoice: true, at, byThisDevice: true }, customer: { overQuota: true }, move: { snapshotId: 'd'.repeat(64), until: Date.now() + 60000, byThisDevice: false } };
  assert.deepEqual(await applyStatus(e, busy, ME, PREFIX), {});
  assert.equal(e.config.movedTo, undefined); assert.equal(e.config.movePin, undefined); assert.ok(!e.accountHold);
  assert.equal(await applyStatus(e, busy, ME, 'c/abcdefghijklmnoq/r'), false, 'another customer\'s repository');
  // 「되돌리기 취소」 holds it on the undo job, and the window lets it go once the undo ended.
  f.provision.chooseAnswer = { state: 'undone', jobId: 'job2' };
  assert.deepEqual(await f.account.restoreChoose('job1', 'undo'), { ok: true, jobId: 'job2' });
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job2', undo: true });
  f.provision.jobs = { job2: { id: 'job2', state: 'continued', at, undoOf: 'job1' } };
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.equal(e.config.serverRestore, undefined);
  assert.deepEqual({ ...f.account.state().restoreEnded, at: 0 }, { jobId: 'job2', result: 'undone', at: 0 });
  // A lost answer on a reading PC asks again for the read key only.
  f.provision.restoreError = Object.assign(new Error('offline'), { code: 'NETWORK' });
  await assert.rejects(f.account.restoreRun(at), (x) => x.code === 'NETWORK');
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job3', state: 'running', at, byThisDevice: true }, lost: null, readKey: 'ready' };
  f.provision.jobs.job3 = { id: 'job3', state: 'running', at };
  await f.account.refresh();
  assert.equal(e.config.serverRestore.jobId, 'job3'); assert.deepEqual(f.account.state().needs, ['read-key']);
  // The client names a write key too after such a lost answer (개통 서버 r8a): a reading PC never asks for one.
  f.provision.needs = ['restore', 'write-key', 'read-key'];
  assert.deepEqual(f.account.state().needs, ['read-key']);
  f.account.info.needs = ['write-key', 'read-key'];
  assert.deepEqual(f.account.state().needs, ['read-key']);
  f.provision.needs = []; f.account.info.needs = [];

  // A backup this PC writes under another device's number is still not restored from here, before any sign-in.
  const w = await fixture();
  await w.account.signIn(); await w.account.startProtection({ sources: [w.source] });
  w.engine.config.host = OLD;
  await assert.rejects(w.account.restoreRun(at), (x) => x.code === 'OTHER_BACKUP');
  assert.equal(w.log.some((x) => x[0] === 'restoreRun'), false); assert.equal(w.engine.config.serverRestore, undefined);
});

test('되돌리기 취소가 실패하면: the restore waits for its choice again, is not marked as an undo, and the failure is said until the choice (화면 부탁 2)', async () => {
  const { applyStatus } = require('../src/account.cjs');
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const e = f.engine, at = Date.now() - 60000;
  await f.account.restoreRun(at);
  f.provision.chooseAnswer = { state: 'undone', jobId: 'job2' };
  await f.account.restoreChoose('job1', 'undo');
  assert.equal(e.config.serverRestore.undo, true);
  f.provision.chooseAnswer = null;
  // The undo failed: the server opens job1 again, waiting for its choice.
  f.provision.jobs = { job1: { id: 'job1', state: 'done', awaitingChoice: true, at, finishedAt: at + 1000 }, job2: { id: 'job2', state: 'failed', at, error: 'INTERRUPTED', undoOf: 'job1' } };
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job1', state: 'done', awaitingChoice: true, at, byThisDevice: true }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job1' });
  let s = f.account.state().restore;
  assert.deepEqual([s.jobId, s.awaitingChoice, s.undo, s.undoError, s.finishedAt], ['job1', true, false, 'INTERRUPTED', at + 1000]);
  assert.deepEqual(f.account.state().needs, [], 'its keys came with the restore');
  await f.account.refresh();
  assert.equal(f.account.state().restore.undoError, 'INTERRUPTED', 'said until the choice');
  await f.account.restoreJob('job1');
  assert.equal(f.account.state().restore.undoError, 'INTERRUPTED');
  assert.equal((await reopen(f)).state().restore.undoError, 'INTERRUPTED', 'kept when the window opens again');
  // The run looks first (GPT restore3 GA1): it takes job1 up without reading a job and does not mark it as an undo;
  // what it changed stays in the settings, and the window's look afterwards still says how the undo failed.
  e.config.serverRestore = { since: new Date().toISOString(), jobId: 'job2', undo: true }; await e.save();
  f.account.info.restore = null;
  await applyStatus(e, f.provision.statusValue, ME);
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job1', adopted: { from: 'job2', fromUndo: true, lost: false } });
  assert.deepEqual((await (async () => { const x = f.make(); await x.open(); return x; })()).config.serverRestore.adopted, { from: 'job2', fromUndo: true, lost: false }, 'the settings keep it');
  await f.account.refresh();
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job1' }, 'read once, then written again without it');
  s = f.account.state().restore;
  assert.deepEqual([s.jobId, s.awaitingChoice, s.undo, s.undoError], ['job1', true, false, 'INTERRUPTED']);
  // An undo whose answer was lost: the status shows the undo job, taken up as an undo, and its own word agrees.
  f.provision.jobs.job3 = { id: 'job3', state: 'running', at, undoOf: 'job1' };
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job3', state: 'running', at, byThisDevice: true }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job3', undo: true });
  s = f.account.state().restore; assert.deepEqual([s.jobId, s.undo, s.undoError], ['job3', true, null]);
  // The job's word wins over the guess: a job taken up as an undo that is not one is set right.
  e.config.serverRestore = { since: new Date().toISOString(), jobId: 'job1' };
  f.provision.jobs.job5 = { id: 'job5', state: 'running', at };
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job5', state: 'running', at, byThisDevice: true }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job5' });
  assert.equal(f.account.state().restore.undo, false);
  // The choice ends what was said.
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job5', state: 'done', awaitingChoice: true, at, byThisDevice: true }, lost: null, readKey: 'ready' };
  await f.account.restoreChoose('job5', 'continue');
  assert.equal(f.account.state().restore, null);
  // A request whose answer was lost, its job taken up by a run and then by another run before the window looks: the
  // window still asks again for the keys that never came.
  f.account.info.needs = [];
  e.config.serverRestore = { since: new Date().toISOString() }; await e.save();
  f.provision.jobs.job6 = { id: 'job6', state: 'running', at }; f.provision.jobs.job7 = { id: 'job7', state: 'running', at, undoOf: 'job6' };
  await applyStatus(e, { device: { state: 'active' }, restore: { jobId: 'job6', state: 'running', at, byThisDevice: true } }, ME);
  await applyStatus(e, { device: { state: 'active' }, restore: { jobId: 'job7', state: 'running', at, byThisDevice: true } }, ME);
  assert.deepEqual(e.config.serverRestore.adopted, { from: 'job6', fromUndo: false, lost: true });
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job7', state: 'running', at, byThisDevice: true }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.deepEqual(f.account.state().needs, ['write-key', 'read-key']);
  assert.deepEqual(e.config.serverRestore, { since: e.config.serverRestore.since, jobId: 'job7', undo: true });
  // The same, its job ended before the window looked (GPT restore3-r2 GA1): the release keeps that the keys never came.
  const ended = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
  for (const steps of [['job6', 'release'], [null, 'release']]) {
    f.account.info.needs = [];
    e.config.serverRestore = { since: new Date().toISOString() }; await e.save();
    if (steps[0]) await applyStatus(e, { device: { state: 'active' }, restore: { jobId: 'job6', state: 'running', at, byThisDevice: true } }, ME);
    f.provision.jobs.job6 = { id: 'job6', state: 'failed', at, error: 'INTERRUPTED' };
    await applyStatus(e, ended, ME);
    assert.deepEqual(e.config.restoreReleased, { ...(steps[0] ? { jobId: 'job6' } : {}), at: e.config.restoreReleased.at, lost: true });
    const x = f.make(); await x.open(); assert.equal(x.config.restoreReleased.lost, true, 'the settings keep it');
    f.provision.statusValue = ended;
    await f.account.refresh();
    assert.deepEqual(f.account.state().needs, ['write-key', 'read-key'], String(steps[0]));
    assert.equal(e.config.restoreReleased, undefined);
    if (steps[0]) assert.equal(f.account.state().restore.state, 'failed');
  }
  // 「되돌리기 취소」 whose answer never came (GPT restore3-r2 GA2): the restore waiting under the same number means no
  // undo happened, and that is said; an undo the server did start is taken up as one.
  const choose = f.provision.restoreChoose;
  for (const started of [false, true]) {
    f.account.info.restore = null;
    await f.engine.holdForServerRestore({ jobId: 'job1' });
    f.provision.restoreChoose = async () => { throw Object.assign(new Error('offline'), { code: 'NETWORK' }); };
    await assert.rejects(f.account.restoreChoose('job1', 'undo'), (x) => x.code === 'NETWORK');
    assert.equal((await reopen(f)).info.undoAsked, 'job1', 'kept for the next look');
    f.provision.jobs.job1 = { id: 'job1', state: 'done', awaitingChoice: true, at };
    f.provision.jobs.job9 = { id: 'job9', state: 'running', at, undoOf: 'job1' };
    f.provision.statusValue = { device: { state: 'active' }, restore: started ? { jobId: 'job9', state: 'running', at, byThisDevice: true } : { jobId: 'job1', state: 'done', awaitingChoice: true, at, byThisDevice: true }, lost: null, readKey: 'ready' };
    await f.account.refresh();
    const v = f.account.state().restore;
    assert.deepEqual([v.jobId, v.undo, v.undoError], started ? ['job9', true, null] : ['job1', false, 'FAILED'], String(started));
    assert.equal(f.account.info.undoAsked, null);
  }
  // The same lost undo, finished before any look took its job up (GPT restore3-r3 GA1): the restore was undone and
  // nothing is open, so the end is told as undone — whether the run or the window let the hold go.
  for (const runFirst of [false, true]) {
    f.account.info.restore = null; f.account.info.restoreEnded = null;
    await f.engine.holdForServerRestore({ jobId: 'job1' });
    await assert.rejects(f.account.restoreChoose('job1', 'undo'), (x) => x.code === 'NETWORK');
    f.provision.jobs.job1 = { id: 'job1', state: 'undone', at };
    f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
    if (runFirst) await applyStatus(e, f.provision.statusValue, ME);
    await f.account.refresh();
    assert.equal(e.config.serverRestore, undefined);
    assert.deepEqual({ ...f.account.state().restoreEnded, at: 0 }, { jobId: 'job1', result: 'undone', at: 0 }, String(runFirst));
    assert.equal(f.account.state().restore, null);
  }
  // An undone restore while another PC's restore is open is not told as ended (that one may be the undo).
  f.account.info.restoreEnded = null;
  await f.engine.holdForServerRestore({ jobId: 'job1' });
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job10', state: 'running', at, byThisDevice: false }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.equal(f.account.state().restoreEnded, null);
  f.provision.restoreChoose = choose;
});

test('끝난 되돌리기는 한 번 알린다: kept or undone, told until seen or for a week, gone with another restore (화면 부탁 3)', async () => {
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const at = Date.now() - 60000;
  await f.account.restoreRun(at);
  assert.equal(f.account.state().restoreEnded, null);
  assert.deepEqual(await f.account.restoreChoose('job1', 'continue'), { ok: true });
  const ended = f.account.state().restoreEnded;
  assert.deepEqual({ ...ended, at: 0 }, { jobId: 'job1', result: 'continued', at: 0 }); assert.ok(Math.abs(Date.now() - ended.at) < 10000);
  assert.deepEqual((await reopen(f)).state().restoreEnded, ended, 'told when the window opens again');
  await assert.rejects(f.account.restoreSeen('../x'), (x) => x.code === 'BAD_INPUT');
  assert.deepEqual((await f.account.restoreSeen('job9')).restoreEnded, ended, 'another job\'s word leaves it');
  assert.equal((await f.account.restoreSeen('job1')).restoreEnded, null);
  assert.equal((await reopen(f)).state().restoreEnded, null, 'not told again');
  // An undo that finished, let go by a run before the window looked (GPT restore3 GA1): the settings keep the job's
  // number, and the window's look tells it as undone, then forgets the number.
  const { applyStatus } = require('../src/account.cjs');
  await f.account.restoreRun(at);
  f.provision.chooseAnswer = { state: 'undone', jobId: 'job2' }; await f.account.restoreChoose('job1', 'undo');
  assert.equal(f.account.state().restoreEnded, null, 'not ended while the undo runs');
  f.provision.jobs = { job2: { id: 'job2', state: 'continued', at, finishedAt: at + 2000, undoOf: 'job1' } };
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
  assert.deepEqual(await applyStatus(f.engine, f.provision.statusValue, ME), { released: 'job2' });
  assert.equal((await (async () => { const x = f.make(); await x.open(); return x; })()).config.restoreReleased.jobId, 'job2', 'the settings keep it');
  await f.account.refresh();
  assert.deepEqual({ ...f.account.state().restoreEnded, at: 0 }, { jobId: 'job2', result: 'undone', at: 0 });
  assert.equal(f.account.state().restore, null);
  assert.equal(f.engine.config.restoreReleased, undefined);
  // A week later it is not told any more.
  const kept = f.account.info.restoreEnded.at;
  f.account.info.restoreEnded.at = Date.now() - 8 * 24 * 3600 * 1000; assert.equal(f.account.state().restoreEnded, null);
  f.account.info.restoreEnded.at = kept;
  // A job the window cannot read now is read at its next look; one the server no longer has is forgotten.
  f.engine.config.restoreReleased = { jobId: 'job8', at: new Date().toISOString() };
  const read = f.provision.restoreJob;
  f.provision.restoreJob = async () => { throw Object.assign(new Error('offline'), { code: 'NETWORK' }); };
  await f.account.refresh(); assert.equal(f.engine.config.restoreReleased?.jobId, 'job8');
  f.provision.restoreJob = async () => { throw Object.assign(new Error('gone'), { code: 'NOT_FOUND' }); };
  await f.account.refresh(); assert.equal(f.engine.config.restoreReleased, undefined);
  f.provision.restoreJob = read;
  // A failed restore let go by a run is the restore view's, as before.
  f.provision.chooseAnswer = null;
  await f.account.restoreRun(at);
  f.provision.jobs.job1 = { id: 'job1', state: 'failed', at, error: 'INTERRUPTED' };
  await applyStatus(f.engine, f.provision.statusValue, ME);
  await f.account.refresh();
  assert.deepEqual([f.account.state().restore.state, f.account.state().restore.error], ['failed', 'INTERRUPTED']);
  assert.equal(f.account.state().restoreEnded, null, 'another restore takes the end away at once');
  // A new restore forgets an end not read yet.
  f.engine.config.restoreReleased = { jobId: 'job2', at: new Date().toISOString() };
  f.provision.statusValue = null;
  await f.account.restoreRun(at);
  assert.equal(f.engine.config.restoreReleased, undefined);
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
  // A new request whose answer never came may have started a restore: the earlier end goes too (GPT restore3-r4 GA1),
  // and so does one a run's taking-up of this PC's new job finds.
  await f.account.restoreChoose('job1', 'continue');
  assert.equal(f.account.state().restoreEnded.jobId, 'job1');
  f.provision.restoreError = Object.assign(new Error('offline'), { code: 'NETWORK' });
  await assert.rejects(f.account.restoreRun(at), (x) => x.code === 'NETWORK');
  assert.equal(f.account.state().restoreEnded, null);
  assert.equal((await reopen(f)).state().restoreEnded, null, 'not kept either');
  f.provision.restoreError = null;
  f.account.ended('job1', 'continued');
  f.provision.jobs.job11 = { id: 'job11', state: 'running', at };
  await applyStatus(f.engine, { device: { state: 'active' }, restore: { jobId: 'job11', state: 'running', at, byThisDevice: true } }, ME);
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job11', state: 'running', at, byThisDevice: true }, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.equal(f.account.state().restoreEnded, null);
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
  // A damaged kept end is the same as none.
  f.account.info.restoreEnded = { jobId: '../x', result: 'continued', at: 1 }; await f.account.keep();
  assert.equal((await reopen(f)).state().restoreEnded, null);
});

test('the Google step and the read key the server reports stay after the window opens again (화면 부탁 11)', async () => {
  const f = await fixture();
  await f.account.signIn();
  // A loss reported from another device since: the server says so, this window did not know.
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: { googleStepRequired: true }, readKey: 'unconfirmed' };
  assert.equal(f.account.state().googleStepRequired, false);
  await assert.rejects(f.account.startProtection({ sources: [f.source] }), (e) => e.code === 'GOOGLE_STEP');
  assert.equal(f.log.filter((x) => x[0] === 'publish').length, 0, 'the envelope waits for the step');
  const again = async () => { const a = new Account({ root: f.root, secretStore, engine: f.engine, appVersion: '0.7.0', make: { auth: () => ({ async open() {}, getState: () => ({ available: true, connected: true, email: null }) }), provision: () => f.provision, envelope: () => f.envelope } }); await a.open(); return a; };
  let a = await again();
  assert.equal(a.state().googleStepRequired, true);
  // The loss took every read key of the account, the one received here too (GPT ui2 GA1).
  assert.equal(a.state().readKeyPending, false, 'the key kept here went with the loss');
  await assert.rejects(a.startProtection({ sources: [f.source], googleStepDone: true }), (e) => e.code === 'READ_KEY');
  await assert.rejects(a.continueBackup({ sources: [f.source], googleStepDone: true }), (e) => e.code === 'READ_KEY', 'no recovery is marked without an envelope');
  assert.equal(f.engine.hasRecovery(), false);
  await a.rotateReadKey({ googleStepDone: true });
  assert.deepEqual(f.log.filter((x) => x[0] === 'publish').map((x) => x[1].readKey), [RK2]);
  assert.equal(f.engine.hasRecovery(), true);
  // A restore whose envelope step waits: `left` and the pending key stay.
  a.info.googleStepRequired = true;
  const r = await a.restoreRun(Date.now() - 1000);
  assert.deepEqual(r, { jobId: 'job1', left: 'GOOGLE_STEP' });
  a = await again();
  assert.equal(a.state().left, 'GOOGLE_STEP'); assert.equal(a.state().readKeyPending, true);
  // The server's later word clears the step; the window's look then finishes what the restore left.
  f.provision.statusValue = { device: { state: 'active' }, restore: { jobId: 'job1', state: 'running', byThisDevice: true }, lost: null, readKey: 'unconfirmed' };
  await a.refresh();
  assert.equal(a.state().googleStepRequired, false); assert.equal(a.state().left, null); assert.equal(a.state().readKeyPending, false);
  assert.deepEqual(f.log.at(-1), ['confirm', RK2.keyId]);
  assert.equal((await again()).state().left, null);
});

test('after a loss report a PC opens the backup with the read key it received since (화면 부탁 10)', async () => {
  const envelope = { repository: { ...REPO }, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK };
  const snapshots = [{ id: 'b'.repeat(64), time: '2026-11-15T00:00:00.000Z', hostname: OLD, tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] }];
  // A reading PC with nothing set up: every read key went with the report.
  const f = await fixture({ repo: restic({ password: OTHER_PASSWORD, snapshots }), provision: { role: 'read', readKey: null }, envelope });
  await f.account.signIn();
  assert.deepEqual(await f.account.reportLost(OLD), { next: null, googleRemovalUrl: null });
  assert.equal(f.account.state().googleStepRequired, true); assert.equal(f.account.state().readKey, 'missing');
  // The server says so too: no read key, the Google step to do.
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: { googleStepRequired: true }, readKey: 'missing' };
  await assert.rejects(f.account.openBackup(), (e) => e.code === 'READ_KEY', 'the dead key in the envelope is not tried');
  // A new key another PC received and has not put in the envelope yet is not this PC's: still not openable.
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: { googleStepRequired: true }, readKey: 'unconfirmed' };
  await assert.rejects(f.account.openBackup(), (e) => e.code === 'READ_KEY');
  await assert.rejects(f.account.rotateReadKey(), (e) => e.code === 'GOOGLE_STEP');
  assert.equal(f.engine.config, null);
  // The step done: the new envelope is written from the old one with the new key, without setting this PC up.
  await f.account.rotateReadKey({ googleStepDone: true });
  assert.deepEqual(f.log.filter((x) => x[0] === 'publish').at(-1)[1], { repository: REPO, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK2 });
  assert.deepEqual(f.log.at(-1), ['confirm', RK2.keyId]);
  assert.equal(f.engine.config, null);
  assert.equal(f.account.state().readKey, 'ready');
  // A window that remembers 「missing」 asks the server again before it refuses.
  f.provision.statusValue = null; f.account.info.readKey = 'missing';
  await f.account.openBackup();
  assert.deepEqual(f.engine.cloudCredentials, RK2);

  // A PC that holds the new key but whose envelope step is not done yet opens with that key, not the dead one.
  const g = await fixture({ repo: restic({ password: OTHER_PASSWORD, snapshots }), provision: { role: 'read', readKey: null }, envelope });
  await g.account.signIn();
  g.provision.pending = RK2;
  await g.account.openBackup();
  assert.deepEqual(g.engine.cloudCredentials, RK2);
});

test('a reading PC chooses its folders before it takes the seat; a folder that cannot be backed up keeps the old PC writing (화면 부탁 12)', async () => {
  const repo = restic({ password: OTHER_PASSWORD, snapshots: [{ id: 'b'.repeat(64), time: '2026-11-15T00:00:00.000Z', hostname: OLD, tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] }] });
  const f = await fixture({ repo, provision: { role: 'read', readKey: null }, envelope: { repository: { ...REPO }, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK } });
  await f.account.signIn(); await f.account.openBackup();
  await assert.rejects(f.engine.chooseNextSources([path.join(f.root, 'not-there')]));
  await f.engine.chooseNextSources([f.source]);
  assert.deepEqual(f.engine.getState().nextSources, [await fs.realpath(f.source)]);
  const reopened = f.make(); await reopened.open(); assert.deepEqual(reopened.config.nextSources, [await fs.realpath(f.source)]);
  // A folder that is gone is found before the seat moves.
  await assert.rejects(f.account.takeWriteSeat({ sources: [path.join(f.root, 'gone')] }));
  assert.equal(f.log.filter((x) => x[0] === 'takeWriteSeat').length, 0, 'the old PC keeps writing');
  assert.equal(f.engine.config.mode, 'restore');
  // The chosen folders are the ones it backs up.
  await f.account.takeWriteSeat({});
  assert.equal(f.engine.config.mode, 'backup'); assert.deepEqual(f.engine.config.sources, [await fs.realpath(f.source)]);
  assert.equal(f.engine.config.nextSources, undefined);
  // Only a restore-only connection to the account's backup keeps folders for later.
  await assert.rejects(f.engine.chooseNextSources([f.source]), /복구 전용/);
});

test('「그만두기」 ends a Google sign-in that waits; a sign-in that fails on its own keeps its code (화면 부탁 13)', async () => {
  const f = await fixture();
  let stop = null;
  f.account.auth.cancel = () => stop?.();
  f.provision.provision = () => new Promise((_ok, no) => { stop = () => no(Object.assign(new Error('closed'), { code: 'REAUTH' })); });
  const waiting = f.account.signIn();
  await new Promise((ok) => setImmediate(ok));
  f.account.cancelSignIn();
  await assert.rejects(waiting, (e) => e.code === 'CANCELED');
  f.provision.provision = async () => { throw Object.assign(new Error('closed'), { code: 'REAUTH' }); };
  await assert.rejects(f.account.signIn(), (e) => e.code === 'REAUTH', 'a stale cancel does not rename the next failure');
  // A restore whose sign-in is stopped started nothing: its hold goes.
  const g = await fixture();
  await g.account.signIn(); await g.account.startProtection({ sources: [g.source] });
  g.account.auth.cancel = () => stop?.();
  let reached; const asked = new Promise((ok) => { reached = ok; });
  g.provision.restoreRun = () => new Promise((_ok, no) => { stop = () => no(Object.assign(new Error('closed'), { code: 'REAUTH' })); reached(); });
  const run = g.account.restoreRun(Date.now() - 1000);
  await asked;
  g.account.cancelSignIn();
  await assert.rejects(run, (e) => e.code === 'CANCELED');
  assert.equal(g.engine.config.serverRestore, undefined);
});

test('a read key kept here before a loss is never published or opened with; a new one is asked for (GPT ui2 GA1)', async () => {
  const envelope = { repository: { ...REPO }, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK };
  const snapshots = [{ id: 'b'.repeat(64), time: '2026-11-15T00:00:00.000Z', hostname: OLD, tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] }];
  // This PC received the read key RK and has not put it in an envelope yet when it reports the old PC lost.
  const f = await fixture({ repo: restic({ password: OTHER_PASSWORD, snapshots }), provision: { role: 'read', readKey: RK }, envelope });
  await f.account.signIn();
  assert.equal(f.account.state().readKeyPending, true);
  await f.account.reportLost(OLD);
  assert.equal(f.account.state().readKeyPending, false, 'the kept key went with the report');
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: { googleStepRequired: true }, readKey: 'missing' };
  await assert.rejects(f.account.openBackup(), (e) => e.code === 'READ_KEY');
  assert.equal(f.engine.config, null, 'not opened with the dead key');
  await f.account.rotateReadKey({ googleStepDone: true });
  assert.equal(f.log.filter((x) => x[0] === 'rotate').length, 1, 'a new key is asked for');
  assert.deepEqual(f.log.filter((x) => x[0] === 'publish').map((x) => x[1].readKey), [RK2], 'the dead key never goes into an envelope');
  assert.deepEqual(f.log.at(-1), ['confirm', RK2.keyId]);

  // A loss reported from another PC, heard from the server: the key kept here is not used either.
  const g = await fixture({ repo: restic({ password: OTHER_PASSWORD, snapshots }), provision: { role: 'read', readKey: RK }, envelope: { ...envelope } });
  await g.account.signIn();
  g.provision.statusValue = { device: { state: 'active' }, restore: null, lost: { googleStepRequired: true }, readKey: 'unconfirmed' };
  await g.account.refresh();
  assert.equal(g.account.state().googleStepRequired, true); assert.equal(g.account.state().readKeyPending, false);
  // Kept across a new window.
  const again = new Account({ root: g.root, secretStore, engine: g.engine, appVersion: '0.7.0', make: { auth: () => ({ async open() {}, getState: () => ({ available: true, connected: true, email: null }) }), provision: () => g.provision, envelope: () => g.envelope } });
  await again.open();
  assert.equal(again.state().readKeyPending, false);
  await again.rotateReadKey({ googleStepDone: true });
  assert.deepEqual(g.log.filter((x) => x[0] === 'publish').map((x) => x[1].readKey), [RK2]);
  // A key received after the loss is the one that goes in: the next status with the step still open does not drop it.
  const h = await fixture({ repo: restic({ password: OTHER_PASSWORD, snapshots }), provision: { role: 'read', readKey: null }, envelope: { ...envelope } });
  await h.account.signIn();
  h.provision.rotateReadKey = async function () { h.log.push(['rotate']); this.pending = RK2; return { readKey: RK2, googleStepRequired: true }; };
  await assert.rejects(h.account.rotateReadKey(), (e) => e.code === 'GOOGLE_STEP');
  h.provision.statusValue = { device: { state: 'active' }, restore: null, lost: { googleStepRequired: true }, readKey: 'unconfirmed' };
  await h.account.refresh();
  assert.equal(h.account.state().readKeyPending, true);
  await h.account.rotateReadKey({ googleStepDone: true });
  assert.equal(h.log.filter((x) => x[0] === 'rotate').length, 1);
  assert.deepEqual(h.log.filter((x) => x[0] === 'publish').map((x) => x[1].readKey), [RK2]);
});

test('옮겨 오기 꾸러미 once a day after a cloud backup that ran: this device\'s own small snapshot, the newest one kept (4.6)', async () => {
  const { dailyKit } = require('../../worker/runner.cjs');
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const e = f.engine, profile = path.join(f.root, 'profile'); await fs.mkdir(profile);
  const host = async (m) => {
    if (m === 'folders.snapshot') return { known: { profile: { path: profile }, roaming: { path: profile }, local: { path: profile } }, drives: [] };
    if (m === 'reinstall.installed') return ['Git.Git', 'not an id!'];
    throw new Error('HOST_METHOD');
  };
  const kit = (result, now) => dailyKit({ engine: e, host, dir: f.root, resticPath: path.join(f.root, 'restic.exe'), result, ...(now ? { now } : {}) });
  const stored = () => f.repo.calls.filter((c) => c.args[0] === 'backup' && c.args.includes('--stdin'));
  assert.equal(await kit({ outcome: 'skipped', reason: 'paused' }), false, 'a run that rested makes none');
  assert.equal(await kit({ outcome: 'complete' }), true);
  const args = stored()[0].args;
  assert.equal(args[args.indexOf('--host') + 1], ME, 'this device\'s own snapshot, so cleanup can keep its newest');
  assert.ok(args[args.indexOf('--tag') + 1].split(',').includes('movekit'));
  assert.equal(e.config.moveKit.apps, 0); assert.ok(Number.isFinite(Date.parse(e.config.moveKit.at)));
  assert.deepEqual(e.getState().moveKit, e.config.moveKit);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.root, 'movekit-last.json'), 'utf8')).programs.winget, [{ id: 'Git.Git' }]);
  // Once a day only; a moved seat or a restore makes none either.
  assert.equal(await kit({ outcome: 'complete' }), false);
  e.config.movedTo = { device: '새 노트북', at: new Date().toISOString() };
  assert.equal(await kit({ outcome: 'complete' }, Date.now() + 2 * 86400000), false);
  delete e.config.movedTo; e.config.serverRestore = { since: new Date().toISOString() };
  assert.equal(await kit({ outcome: 'complete' }, Date.now() + 2 * 86400000), false);
  delete e.config.serverRestore;
  assert.equal(await kit({ outcome: 'partial' }, Date.now() + 2 * 86400000), true);
  assert.equal(stored().length, 2);

  // Cleanup keeps this device's newest kit and lets an older one go after a day; another device's is never touched.
  const now = Date.now(), day = 86400000, vault = `vault:${e.config.vaultId}`;
  const snap = (c, ago, h, tags = [VERIFIED]) => ({ id: c.repeat(64), time: new Date(now - ago).toISOString(), hostname: h, tags: [APP, vault, ...tags], paths: [f.source] });
  e.config.health = { status: 'ok', checkedAt: new Date(now - 1000).toISOString() };
  e.config.lastBackup = { id: 'd'.repeat(64), at: new Date(now).toISOString() };
  e.snapshots = async () => [snap('d', 0, ME), snap('7', 2 * day, ME, ['movekit']), snap('6', 3 * day, ME, ['movekit']), snap('5', 3 * day, OLD, ['movekit'])];
  f.repo.calls.length = 0;
  await e.retain();
  assert.deepEqual(f.repo.calls.filter((c) => c.args[0] === 'forget').flatMap((c) => c.args.slice(1)), ['6'.repeat(64)]);
});

test('a backup leaves out what an unfinished move left; a move that fails is the move\'s failure, not the backups\' (4.6)', async () => {
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const e = f.engine;
  await e.backupNow().catch(() => {});
  const backup = f.repo.calls.find((c) => c.args[0] === 'backup' && !c.args.includes('--stdin'));
  assert.ok(backup, 'a backup ran');
  assert.equal(backup.args[backup.args.indexOf('--exclude') + 1], '~synk-*.part');
  e.config.lastError = '지난 백업 실패';
  await assert.rejects(e.operation('move', async () => { throw Object.assign(new Error('gone'), { code: 'MOVE_KIT_SIZE' }); }));
  assert.equal(e.config.lastError, '지난 백업 실패');
  assert.equal(e.config.lastMoveError.code, 'MOVE_KIT_SIZE');
  await e.operation('move', async () => null);
  assert.equal(e.config.lastMoveError, null); assert.equal(e.config.lastError, '지난 백업 실패');
});

test('개통 서버 r7: a read key the server retired never goes into an envelope; the Google pages are this code\'s; the same PC\'s devices are named', async () => {
  const { telemetryRun } = require('../src/account.cjs');
  const f = await fixture();
  await f.account.signIn();
  // Another PC's newer rotation retired the key this PC holds: nothing is published, the screen asks for a new key.
  f.provision.readKeyAlive = async function () { this.pending = null; this.needs = ['read-key']; return false; };
  await assert.rejects(f.account.startProtection({ sources: [f.source] }), (e) => e.code === 'READ_KEY');
  assert.equal(f.log.filter((x) => x[0] === 'publish').length, 0);
  assert.equal(f.account.state().readKeyPending, false);
  f.provision.readKeyAlive = async () => true;
  await f.account.rotateReadKey();
  assert.deepEqual(f.log.filter((x) => x[0] === 'publish').map((x) => x[1].readKey), [RK2]);
  // The pages: fixed addresses on myaccount.google.com, the loss report's own while its step is open.
  assert.equal(f.account.googlePage('devices'), 'https://myaccount.google.com/device-activity');
  assert.equal(f.account.googlePage('apps'), 'https://myaccount.google.com/connections');
  assert.equal(f.account.googlePage('removal'), 'https://myaccount.google.com/connections');
  for (const bad of ['https://evil.example/', 'toString', '__proto__', undefined, 3]) assert.throws(() => f.account.googlePage(bad), (e) => e.code === 'BAD_INPUT', String(bad));
  f.provision.lost = async () => ({ next: 'read-key-rotate', googleRemovalUrl: 'https://myaccount.google.com/connections?hl=ko' });
  assert.equal((await f.account.reportLost(OLD)).googleRemovalUrl, 'https://myaccount.google.com/connections?hl=ko');
  assert.equal(f.account.googlePage('removal'), 'https://myaccount.google.com/connections?hl=ko');
  assert.equal(f.account.state().googleRemovalUrl, 'https://myaccount.google.com/connections?hl=ko');
  f.provision.lost = async () => ({ next: 'read-key-rotate', googleRemovalUrl: 'https://evil.example/connections' });
  assert.equal((await f.account.reportLost(OLD)).googleRemovalUrl, null, 'a page that is not Google\'s is never kept');
  // The step done, the loss report's page goes (화면 세션 부탁 17): from the server's word, or from the envelope this PC
  // published with its new read key.
  f.provision.lost = async () => ({ next: 'read-key-rotate', googleRemovalUrl: 'https://myaccount.google.com/connections?hl=ko' });
  await f.account.reportLost(OLD);
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: { googleStepRequired: true }, readKey: 'missing' };
  await f.account.refresh();
  assert.equal(f.account.googlePage('removal'), 'https://myaccount.google.com/connections?hl=ko', 'kept while the step is open');
  f.provision.statusValue = { device: { state: 'active' }, restore: null, lost: null, readKey: 'ready' };
  await f.account.refresh();
  assert.equal(f.account.info.googleRemovalUrl, null); assert.equal(f.account.googlePage('removal'), 'https://myaccount.google.com/connections');
  f.provision.statusValue = null;
  await f.account.reportLost(OLD);
  f.account.info.googleStepRequired = false;
  assert.equal(f.account.googlePage('removal'), 'https://myaccount.google.com/connections', 'a closed step never opens the old page');
  f.account.info.googleStepRequired = true;
  await f.account.rotateReadKey({ googleStepDone: true });
  assert.equal(f.account.info.googleRemovalUrl, null);
  // The same PC's earlier devices, as the client gives them.
  f.provision.state = function () { return { connected: true, role: 'write', deviceId: ME, customerId: CUSTOMER, repository: { ...REPO }, needs: [], sameInstall: [OLD, 'NOT A DEVICE'] }; };
  assert.deepEqual(f.account.state().sameInstall, [OLD]);
  // A Windows exit code (32 bits) is measured as it is.
  const run = (exitCode) => telemetryRun({ trigger: 'hourly', startedAt: Date.now(), result: { outcome: 'failed', exitCode } });
  assert.equal(run(3221225477).exitCode, 3221225477); assert.equal(run(-1).exitCode, -1);
  assert.equal(run(2 ** 32).exitCode, undefined); assert.equal(run(-(2 ** 31) - 1).exitCode, undefined);
});

test('되살리기 실패 칸의 부호와 기본 자리 표시(화면 세션 부탁 14 · 18)', async () => {
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-restore-out-'));
  // No complete backup yet: NO_SNAPSHOT, and the record says the window's default place was used.
  await assert.rejects(f.engine.restoreLatest({ parent: out, named: true }), (e) => e.code === 'NO_SNAPSHOT');
  assert.deepEqual({ ...f.engine.getState().lastRestoreError, at: 0 }, { code: 'NO_SNAPSHOT', at: 0, named: true });
  await assert.rejects(f.engine.restoreLatest({ parent: out }), (e) => e.code === 'NO_SNAPSHOT');
  assert.equal(f.engine.getState().lastRestoreError.named, undefined, 'a place the person chose');
  // A place inside the backed-up folders is refused as before, with the same mark.
  await assert.rejects(f.engine.restoreLatest({ parent: f.source, named: true }), (e) => e.code === 'OUTPUT_UNSAFE');
  assert.deepEqual([f.engine.getState().lastRestoreError.code, f.engine.getState().lastRestoreError.named], ['OUTPUT_UNSAFE', true]);
  const again = f.make(); await again.open(); assert.equal(again.getState().lastRestoreError.named, true, 'kept in the settings');
});

test('넘길 폴더가 없으면 어느 폴더인지 함께 거절한다(화면 세션 E15)', async () => {
  const repo = restic({ password: OTHER_PASSWORD, snapshots: [{ id: 'b'.repeat(64), time: '2026-11-15T00:00:00.000Z', hostname: OLD, tags: [APP, `vault:${customerVault(PREFIX)}`, VERIFIED] }] });
  const f = await fixture({ repo, provision: { role: 'read', readKey: null, writer: { id: OLD, name: '옛 노트북' } }, envelope: { repository: { ...REPO }, repositoryId: ID, password: OTHER_PASSWORD, readKey: RK } });
  await f.account.signIn(); await f.account.openBackup();
  const gone = path.join(f.root, '빈 폴더였던 자리'), other = path.join(f.root, '옮겨 온 다른 자리');
  await assert.rejects(f.account.takeWriteSeat({ sources: [f.source, gone, other] }), (e) => e.code === 'SOURCES_MISSING' && JSON.stringify(e.details) === JSON.stringify({ paths: [gone, other] }));
  assert.equal(f.log.some((x) => x[0] === 'takeWriteSeat'), false, 'the old PC keeps its seat');
  assert.equal(f.engine.config.mode, 'restore');
  // The rest are checked as before (one folder inside another).
  await assert.rejects(f.account.takeWriteSeat({ sources: [f.root, f.source] }), (e) => e.code !== 'SOURCES_MISSING');
});

test('a reading device cut off leaves its read key to be replaced: asked at once here, or once this PC has its device (화면 세션 E28)', async () => {
  // This PC has its device: 「복구 정보 다시 맡기기」 is asked at once, and goes when the new key is in.
  const f = await fixture();
  await f.account.signIn(); await f.account.startProtection({ sources: [f.source] });
  f.provision.revoke = async () => ({ suggestReadKeyRotation: true });
  assert.deepEqual(await f.account.revokeDevice(OLD), { suggestReadKeyRotation: true });
  assert.deepEqual(f.account.state().needs, ['read-key']);
  await f.account.rotateReadKey();
  assert.deepEqual(f.account.state().needs, []);
  // A device that had no key to hold (the server says so): nothing is asked.
  f.provision.revoke = async () => ({ suggestReadKeyRotation: false });
  await f.account.revokeDevice(OLD); assert.deepEqual(f.account.state().needs, []);
  // No device here yet (the account was full): remembered across a restart, and asked once 「Google로 시작」 has given
  // this PC its device — unless that sign-up brought a new read key (the account had none in use).
  for (const [readKey, after] of [[null, ['read-key']], [RK, []]]) {
    const g = await fixture({ provision: { readKey } });
    g.provision.revoke = async () => ({ suggestReadKeyRotation: true });
    await g.account.revokeDevice(OLD);
    assert.deepEqual(g.account.state().needs, [], 'nothing to press before this PC has a device');
    assert.equal(JSON.parse(await fs.readFile(g.account.viewFile, 'utf8')).rotateAfterSignIn, true);
    await g.account.open();
    await g.account.signIn();
    assert.deepEqual(g.account.state().needs, after, String(readKey));
    assert.equal(JSON.parse(await fs.readFile(g.account.viewFile, 'utf8')).rotateAfterSignIn, false, 'asked once');
  }
});
