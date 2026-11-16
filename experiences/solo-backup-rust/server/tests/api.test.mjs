// Provisioning server end to end over real HTTP and real signed rpc, with an
// in-memory B2 account and a fake Google issuer (STAGE1_DESIGN.md T20 · T21 · T23 · T25).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { FakeB2, fakeGoogle, clockAt, sessionOf } from './fakes.mjs';
import { Store } from '../store.mjs';
import { createVerifier } from '../google-token.mjs';
import { rpcClient, rpcServer } from '../rpc.mjs';
import { keyHandlers, WRITE_CAPS, READ_CAPS } from '../keys-worker.mjs';
import { fileHandlers } from '../files-worker.mjs';
import { createApi } from '../server.mjs';
import { createJobs } from '../jobs.mjs';
import { createMailer } from '../mail.mjs';

const listen = (srv) => new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

async function harness(t, { grace = 0, config = {} } = {}) {
  const clock = clockAt(), now = () => clock.t;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-api-'));
  const b2 = new FakeB2({ clock });
  const own = b2.addKey({ keyName: 'wb-server-keys', capabilities: ['writeKeys', 'listKeys', 'deleteKeys'] });
  const filesKey = b2.addKey({ keyName: 'wb-server-files', capabilities: [...WRITE_CAPS], bucketIds: [b2.bucketId] });
  const protectedKeyIds = [own.applicationKeyId, filesKey.applicationKeyId];
  const ks = crypto.randomBytes(32).toString('hex'), fsec = crypto.randomBytes(32).toString('hex');
  const keysSrv = rpcServer({ secret: ks, now, handlers: keyHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, protectedKeyIds, stateDir: dir, now }) });
  const filesSrv = rpcServer({ secret: fsec, now, handlers: fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now }) });
  const [kp, fp] = [await listen(keysSrv), await listen(filesSrv)];
  const keys = rpcClient({ url: `http://127.0.0.1:${kp}/rpc`, secret: ks, now });
  const files = rpcClient({ url: `http://127.0.0.1:${fp}/rpc`, secret: fsec, now });
  const g = fakeGoogle({ clock });
  const store = new Store(path.join(dir, 'wb.sqlite'), { now });
  const mailer = createMailer({ store, enabled: false, operator: 'ops@example.com', now });
  const logs = [];
  const verify = createVerifier({ audiences: [g.aud], fetchImpl: g.fetchImpl, now });
  const hooks = { beforeVerify: null, onSleep: null };
  const api = createApi({ store, keys, files, mailer, now, log: (e) => logs.push(e), sleep: async (ms) => { clock.advance(ms); if (hooks.onSleep) { const f = hooks.onSleep; hooks.onSleep = null; await f(ms); } },
    verifyGoogle: async (tok) => { if (hooks.beforeVerify) { const f = hooks.beforeVerify; hooks.beforeVerify = null; await f(); } return verify(tok); },
    config: { endpoint: 'https://s3.us-east-005.backblazeb2.com', bucket: 'synk-wb-test-bucket', restoreGraceMs: grace, ...config } });
  const srv = api.server(); const port = await listen(srv);
  const jobs = createJobs({ store, api, keys, files, mailer, now, config: { bucketId: b2.bucketId, protectedKeyIds } });
  t.after(() => { srv.close(); keysSrv.close(); filesSrv.close(); store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  async function call(method, route, body, token) {
    const res = await fetch(`http://127.0.0.1:${port}/backup-api/v1/${route}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(res.headers.get('cache-control'), 'no-store');
    return { status: res.status, ...(await res.json()) };
  }
  async function proof(purpose = 'provision', claims = {}) {
    const n = await call('POST', 'nonce', { purpose });
    assert.equal(n.ok, true);
    return { idToken: g.token({ nonce: n.nonce, ...claims }), nonce: n.nonce };
  }
  async function provision(name = 'PC-1', claims = {}) { return call('POST', 'provision', { google: await proof('provision', claims), device: { name, appVersion: '0.7.0' } }); }
  async function ack(r) { const ids = Object.values(r.keys || {}).map((k) => k.keyId); return call('POST', 'keys/ack', { keyIds: ids }, r.device?.token || r.token); }
  return { clock, b2, store, api, jobs, call, proof, proofDirect: proof, provision, ack, dir, g, logs, protectedKeyIds, hooks, keys, files, port, mailer };
}
const dbBytes = (h) => Buffer.concat(['wb.sqlite', 'wb.sqlite-wal'].map((f) => { try { return fs.readFileSync(path.join(h.dir, f)); } catch { return Buffer.alloc(0); } }));

test('T20: invite list, Google subject binding, single-use nonces and only fresh sign-ins', async (t) => {
  const h = await harness(t);
  assert.equal((await h.provision()).code, 'NOT_INVITED');
  h.store.addInvite(' Pilot@Example.com ');
  const first = await h.provision();
  assert.equal(first.ok, true);
  assert.equal(first.device.role, 'write');
  assert.match(first.customer.id, /^[a-z0-9]{16}$/);
  assert.equal(first.customer.repository.prefix, `c/${first.customer.id}/r`);
  const made = [...h.b2.keys.values()].filter((k) => /^wb[wr]-/.test(k.keyName));
  assert.equal(made.length, 2);
  for (const k of made) {
    assert.deepEqual(k.bucketIds, [h.b2.bucketId]);
    assert.equal(k.namePrefix, `c/${first.customer.id}/`);
    assert.deepEqual(k.capabilities, k.keyName.startsWith('wbw-') ? ['listBuckets', 'listFiles', 'readFiles', 'writeFiles'] : ['listBuckets', 'listFiles', 'readFiles'], 'the approved set, written out (GPT r8a GE1)');
    assert.ok(!/@|pilot/i.test(k.keyName), 'key names carry no address');
  }
  // The same proof cannot be used twice, a sign-in nonce is not an action nonce and vice versa.
  const p = await h.proof();
  assert.equal((await h.call('POST', 'provision', { google: p, device: { name: 'x' } })).ok, true);
  assert.equal((await h.call('POST', 'provision', { google: p, device: { name: 'x' } })).code, 'NONCE');
  const action = await h.proof('lost');
  assert.equal((await h.call('POST', 'provision', { google: action, device: { name: 'x' } })).code, 'NONCE');
  assert.equal((await h.call('POST', 'lost', { google: await h.proof('provision'), deviceId: 'aaaaaaaaaaaa' })).code, 'NONCE', 'nor a sign-in nonce an action one (카본 끝판 E2)');
  // Another Google account with the same address is refused; stale or foreign tokens are refused.
  assert.equal((await h.provision('PC', { sub: '999' })).code, 'SUB_MISMATCH');
  const n = await h.call('POST', 'nonce', { purpose: 'provision' });
  const old = h.g.token({ nonce: n.nonce, iat: Math.floor(h.clock.t / 1000) - 11 * 60 });
  assert.equal((await h.call('POST', 'provision', { google: { idToken: old, nonce: n.nonce }, device: { name: 'x' } })).code, 'TOKEN');
  const n2 = await h.call('POST', 'nonce', { purpose: 'provision' });
  assert.equal((await h.call('POST', 'provision', { google: { idToken: h.g.token({ nonce: n2.nonce, aud: 'other.apps.googleusercontent.com', azp: 'other.apps.googleusercontent.com' }), nonce: n2.nonce }, device: { name: 'x' } })).code, 'TOKEN');
  const n3 = await h.call('POST', 'nonce', { purpose: 'provision' });
  assert.equal((await h.call('POST', 'provision', { google: { idToken: h.g.token({ nonce: n3.nonce, email_verified: false }), nonce: n3.nonce }, device: { name: 'x' } })).code, 'TOKEN');
  const n4 = await h.call('POST', 'nonce', { purpose: 'provision' });
  assert.equal((await h.call('POST', 'provision', { google: { idToken: h.g.token({ nonce: 'x'.repeat(43) }), nonce: n4.nonce }, device: { name: 'x' } })).code, 'NONCE');
  // Secrets never reach the database: no key secret, no device token.
  const raw = dbBytes(h);
  for (const k of made) assert.equal(raw.includes(Buffer.from(h.b2.keys.get(k.applicationKeyId).applicationKey)), false);
  assert.equal(raw.includes(Buffer.from(first.device.token)), false);
  // A device token alone cannot act for the customer.
  assert.equal((await h.call('GET', 'status', null, 'wbd_' + 'A'.repeat(43))).code, 'DEVICE');
  assert.equal((await h.call('POST', 'devices/take-write-seat', {}, first.device.token)).code, 'BAD_INPUT');
});

test('T20: two-step issue — keys nobody acknowledged are deleted after ten minutes', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const r = await h.provision();
  assert.deepEqual((await h.call('POST', 'keys/ack', { keyIds: [r.keys.write.keyId] }, r.device.token)).acked, [r.keys.write.keyId]);
  h.clock.advance(11 * 60000);
  await h.jobs.expireKeys();
  assert.ok(h.b2.keys.has(r.keys.write.keyId));
  assert.equal(h.b2.keys.has(r.keys.read.keyId), false);
  // A device whose every key went unacknowledged is abandoned; the next sign-in gets a fresh read key.
  h.store.addInvite('second@example.com');
  const lost = await h.provision('PC-2', { sub: '2000002', email: 'second@example.com' });
  h.clock.advance(11 * 60000);
  await h.jobs.expireKeys();
  assert.equal(h.store.device(lost.device.id).state, 'abandoned');
  assert.equal((await h.call('GET', 'status', null, lost.device.token)).code, 'DEVICE_STATE');
  const again = await h.provision('PC-2', { sub: '2000002', email: 'second@example.com' });
  assert.equal(again.device.role, 'write');
  assert.ok(again.keys.read);
});

async function readyCustomer(h, name = 'PC-1') {
  h.store.addInvite('pilot@example.com');
  const a = await h.provision(name);
  await h.ack(a);
  assert.equal((await h.call('POST', 'read-key/confirm', { keyId: a.keys.read.keyId }, a.device.token)).ok, true);
  return a;
}

test('T21: one writing device — a second device only reads, the seat moves by a fresh sign-in, old key first', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2');
  assert.equal(b.device.role, 'read');
  assert.deepEqual(b.keys, {}, 'the read key comes from the envelope');
  assert.deepEqual(b.writer, { id: a.device.id, name: 'PC-1' });
  const alerts = (await h.call('GET', 'status', null, a.device.token)).alerts;
  assert.ok(alerts.some((x) => x.kind === 'new-device' && x.detail.deviceId === b.device.id));
  // Deleting the old write key fails → nothing moves and no new key is made.
  const callsBefore = h.b2.calls.length;
  h.b2.failDelete = true;
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token)).code, 'SERVER');
  h.b2.failDelete = false;
  assert.equal(h.store.writerOf(a.customer.id).id, a.device.id);
  assert.equal(h.b2.calls.slice(callsBefore).filter((c) => c[0] === 'createKey').length, 0, 'no new key after the failed delete (카본 r8a E3)');
  assert.equal([...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbw-')).length, 1);
  h.b2.calls.length = 0;
  const seat = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token);
  assert.equal(seat.ok, true);
  assert.deepEqual(seat.previous, { id: a.device.id, name: 'PC-1' });
  const del = h.b2.calls.findIndex((c) => c[0] === 'deleteKey' && c[1] === a.keys.write.keyId);
  const make = h.b2.calls.findIndex((c) => c[0] === 'createKey');
  assert.ok(del >= 0 && make > del, 'old write key deleted before the new one is made');
  assert.equal(h.b2.keys.has(a.keys.write.keyId), false);
  const old = await h.call('GET', 'status', null, a.device.token);
  assert.equal(old.device.state, 'moved');
  assert.deepEqual(old.device.movedTo, { id: b.device.id, name: 'PC-2' });
  assert.equal((await h.call('POST', 'keys/ack', { keyIds: [] }, a.device.token)).code, 'DEVICE_STATE');
  // The moved PC takes the seat back only by its own explicit request.
  const back = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token);
  assert.equal(back.ok, true);
  assert.equal((await h.call('GET', 'status', null, b.device.token)).device.state, 'moved');
  // Writer 1 + readers 2.
  const c = await h.provision('PC-3'); const d = await h.provision('PC-4');
  assert.equal(c.device.role, 'read'); assert.equal(d.device.role, 'read');
  assert.equal((await h.provision('PC-5')).code, 'LIMIT_DEVICES');
  // Another customer's action proof cannot act here.
  h.store.addInvite('other@example.com');
  const other = await h.proof('take-write-seat', { sub: '3000003', email: 'other@example.com' });
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: other }, c.device.token)).code, 'SUB_MISMATCH');
});

test('T20: at most five key-making requests per customer a day', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h); // one request (two keys)
  for (let i = 0; i < 4; i++) assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).ok, true);
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).code, 'LIMIT_KEYS_DAY');
  h.clock.advance(24 * 3600000 + 1000);
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).ok, true);
});

test('T10: lost report deletes the write and read keys at once; a new read key needs the Google step', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2');
  const r = await h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: a.device.id });
  assert.equal(r.ok, true);
  assert.equal(r.googleRemovalUrl, 'https://myaccount.google.com/connections');
  assert.equal(h.b2.keys.has(a.keys.write.keyId), false);
  assert.equal(h.b2.keys.has(a.keys.read.keyId), false, 'old envelope and recovery code stop working');
  assert.equal((await h.call('GET', 'status', null, a.device.token)).code, 'DEVICE_STATE');
  const s = await h.call('GET', 'status', null, b.device.token);
  assert.equal(s.readKey, 'missing');
  assert.deepEqual(s.lost, { googleStepRequired: true });
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, b.device.token);
  assert.equal(rot.googleStepRequired, true);
  assert.deepEqual((await h.call('POST', 'keys/ack', { keyIds: [rot.keys.read.keyId] }, b.device.token)).acked, [rot.keys.read.keyId]);
  assert.equal((await h.call('POST', 'read-key/confirm', { keyId: rot.keys.read.keyId }, b.device.token)).ok, true);
  const after = await h.call('GET', 'status', null, b.device.token);
  assert.equal(after.readKey, 'ready'); assert.equal(after.lost, null);
  // An acknowledged read key waiting for confirm is not expired by the ten-minute rule.
  const rot2 = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, b.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [rot2.keys.read.keyId] }, b.device.token);
  h.clock.advance(30 * 60000); await h.jobs.expireKeys();
  assert.ok(h.b2.keys.has(rot2.keys.read.keyId));
  await h.call('POST', 'read-key/confirm', { keyId: rot2.keys.read.keyId }, b.device.token);
  await h.jobs.expireKeys();
  assert.equal(h.b2.keys.has(rot.keys.read.keyId), false, 'the superseded read key is deleted after confirm');
  assert.ok(h.b2.keys.has(rot2.keys.read.keyId));
});

function seedRepo(h, prefix) {
  const base = `${prefix}r/`;
  const files = { config: 'cfg', 'keys/k1': 'key-1', 'data/aa/d1': 'pack-one-content', 'index/i1': 'index-1', 'snapshots/s1': 'snap-1' };
  for (const [rel, c] of Object.entries(files)) h.b2.upload(base + rel, c);
  return base;
}

test('T9 · T23 · T24: restore plan, run with key rotation, copy back, continue or undo', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const prefix = `c/${a.customer.id}/`;
  const base = seedRepo(h, prefix);
  h.clock.advance(2 * 3600000);
  const attack = h.b2.upload(base + 'data/aa/d1', 'pack-one-CONTENT'); // same size, other content
  h.b2.hide(base + 'snapshots/s1'); h.b2.upload(base + 'snapshots/s2', 'snap-2');
  h.clock.advance(3600000);
  // Daily detection sees the same-size overwrite.
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const st = await h.call('GET', 'status', null, a.device.token);
  const changed = st.alerts.find((x) => x.kind === 'repo-changed');
  assert.ok(changed); assert.equal(changed.detail.daysLeft, 29);
  const plan = await h.call('POST', 'restore/plan', {}, a.device.token);
  assert.equal(plan.suggestions[0].reason, 'before-overwrite');
  assert.equal(plan.suggestions[0].at, attack.uploadTimestamp - 1000);
  assert.deepEqual(plan.plan.counts, { copy: 2, hide: 1, unchanged: 3 });
  // The run needs a fresh sign-in, replaces the write key and starts a new read key.
  assert.equal((await h.call('POST', 'restore/run', { at: plan.suggestions[0].at }, a.device.token)).code, 'BAD_INPUT');
  const versionsBefore = (await h.b2.listFileVersions({ prefix: base })).map((v) => v.fileId);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: plan.suggestions[0].at }, a.device.token);
  assert.equal(run.ok, true);
  assert.equal(h.b2.keys.has(a.keys.write.keyId), false);
  assert.ok(run.keys.write && run.keys.read);
  assert.ok(h.b2.keys.has(a.keys.read.keyId), 'old read key stays until the new envelope is confirmed');
  await h.api.runJob(h.store.job(run.jobId));
  const job = await h.call('GET', `restore/job?id=${run.jobId}`, null, a.device.token);
  assert.equal(job.state, 'done'); assert.equal(job.awaitingChoice, true);
  const versions = await h.b2.listFileVersions({ prefix: base });
  const latest = (n) => versions.find((v) => v.fileName === base + n);
  assert.equal(latest('data/aa/d1').contentSha1, crypto.createHash('sha1').update('pack-one-content').digest('hex'));
  assert.equal(latest('snapshots/s1').action, 'upload');
  assert.equal(latest('snapshots/s2').action, 'hide');
  // GPT GC1: no file version was deleted — every version from before the run is still listed.
  const versionsAfter = new Set(versions.map((v) => v.fileId));
  assert.deepEqual(versionsBefore.filter((id) => !versionsAfter.has(id)), []);
  assert.equal(h.b2.calls.filter((c) => /^delete/.test(c[0]) && c[0] !== 'deleteKey').length, 0);
  assert.equal((await h.call('GET', 'status', null, a.device.token)).restore.awaitingChoice, true);
  // The tool's own copies are not reported again as overwrites.
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 1);
  // Undo = the same tool to the moment before the restore started; it ends without another choice.
  const undo = await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'undo', google: await h.proof('restore-undo') }, a.device.token);
  assert.equal(undo.state, 'undone');
  await h.api.runJob(h.store.job(undo.jobId));
  assert.equal(h.store.job(undo.jobId).state, 'continued');
  const back = await h.b2.listFileVersions({ prefix: base });
  assert.equal(back.find((v) => v.fileName === base + 'snapshots/s2').action, 'upload');
  assert.equal((await h.call('GET', 'status', null, a.device.token)).restore, null);
  assert.equal((await h.call('POST', 'restore/plan', { at: h.clock.t - 30 * 86400000 }, a.device.token)).code, 'TOO_OLD');
});

test('T25: measurement keeps numbers and fixed words only — marked names never reach the database', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const MARK = 'ZQ표식QZ';
  const r = await h.call('POST', 'telemetry', {
    env: { appVersion: '0.7.0', windows: '10.0.26100', standby: 'S3', host: MARK },
    runs: [
      { trigger: 'hourly', startedAt: h.clock.t - 60000, durationMs: 5000, result: 'complete', files: { new: 1, changed: 2, unmodified: 3, path: `C:\\${MARK}` }, prunedSnapshots: 1, note: MARK },
      { trigger: 'hourly', startedAt: h.clock.t, result: `failed ${MARK}` },
      { trigger: 'hourly', startedAt: h.clock.t, result: 'partial', exitCode: 3, unreadable: 2 },
    ],
    notifications: [{ kind: 'status', shownAt: h.clock.t }, { kind: `D:\\${MARK}`, shownAt: h.clock.t }],
    installs: [{ step: 'install', durationMs: 900, ok: true }, { step: 'secret-project', durationMs: 1, ok: true }],
  }, a.device.token);
  assert.deepEqual(r.accepted, { runs: 2, notifications: 1, installs: 1 });
  assert.ok(r.dropped.unknownFields >= 3);
  assert.equal(dbBytes(h).includes(Buffer.from(MARK)), false);
  assert.equal(h.store.reportedSince(a.customer.id, 0).pruned, 1);
});

test('T20: nonce requests are rate limited per address and bodies are bounded', async (t) => {
  const h = await harness(t);
  for (let i = 0; i < 30; i++) assert.equal((await h.call('POST', 'nonce', { purpose: 'provision' })).ok, true);
  assert.equal((await h.call('POST', 'nonce', { purpose: 'provision' })).code, 'RATE');
  assert.equal((await h.call('POST', 'nonce', { purpose: 'other' })).code, 'RATE');
  h.clock.advance(11 * 60000);
  assert.equal((await h.call('POST', 'nonce', { purpose: 'other' })).code, 'BAD_INPUT');
  assert.equal((await h.call('GET', 'nope')).code, 'NOT_FOUND');
  assert.ok(h.logs.every((l) => !JSON.stringify(l).includes('nonce":"')));
});

test('T20 · T11: daily jobs — usage, 1.5x over quota, silence mail, reconcile of strange keys and bucket rules', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.b2.versions.push({ fileName: base + 'data/bb/big', fileId: 'big1', action: 'upload', uploadTimestamp: h.clock.t, contentSha1: 'a'.repeat(40), contentLength: 151 * 1024 ** 3 });
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const st = await h.call('GET', 'status', null, a.device.token);
  assert.equal(st.customer.overQuota, true);
  assert.ok(st.alerts.some((x) => x.kind === 'over-quota'));
  assert.equal(h.b2.keys.has(a.keys.write.keyId), true, 'over quota never cuts the key');
  // Silence: the writer is quiet for three days → one held mail; not while the server itself was down.
  h.clock.advance(3 * 86400000 + 60000);
  h.store.beat(); h.jobs.silence(h.clock.t);
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:silent:%'")[0].n, 1);
  assert.equal(h.store.all("select state from outbox where key like 'wb:silent:%'")[0].state, 'held', 'mail stays off until wording is chosen');
  h.jobs.silence(h.clock.t);
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:silent:%'")[0].n, 1);
  // Reconcile: clean, then a strange key, a too-wide key and a second lifecycle rule are each reported.
  let r = await h.jobs.reconcileKeys(h.clock.t);
  assert.deepEqual(r.problems, []);
  h.b2.addKey({ keyName: 'someone', capabilities: ['listFiles'] });
  h.b2.addKey({ keyName: 'wbw-' + 'z'.repeat(20), capabilities: [...WRITE_CAPS, 'deleteFiles'], bucketIds: [h.b2.bucketId], namePrefix: 'c/zzzzzzzzzzzzzzzz/' });
  h.b2.bucket.lifecycleRules.push({ fileNamePrefix: 'c/', daysFromHidingToDeleting: 1, daysFromUploadingToHiding: null });
  r = await h.jobs.reconcileKeys(h.clock.t);
  const kinds = r.problems.map((p) => p.kind).sort();
  assert.deepEqual(kinds, ['lifecycle', 'not-in-table', 'too-wide', 'unknown-key']);
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:op:reconcile:%'")[0].n, 1);
});

test('S5: the proof × device-state table — moved, lost and other devices are refused', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2');
  await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token);
  // a is moved now: status yes, everything else no.
  assert.equal((await h.call('GET', 'status', null, a.device.token)).device.state, 'moved');
  for (const [m, r, body] of [['GET', 'devices'], ['POST', 'telemetry', { runs: [] }], ['POST', 'restore/plan', {}], ['POST', 'keys/ack', { keyIds: [] }], ['POST', 'read-key/confirm', { keyId: 'x' }]]) {
    const res = await h.call(m, r, body, a.device.token);
    assert.equal(res.code, 'DEVICE_STATE', `${m} ${r}`); assert.equal(res.state, 'moved');
  }
  // A read key is confirmed only by the device that received it.
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, b.device.token);
  const c = await h.provision('PC-3');
  await h.call('POST', 'keys/ack', { keyIds: [rot.keys.read.keyId] }, b.device.token);
  assert.equal((await h.call('POST', 'read-key/confirm', { keyId: rot.keys.read.keyId }, c.device.token)).code, 'NOT_FOUND');
  assert.deepEqual((await h.call('POST', 'keys/ack', { keyIds: [rot.keys.read.keyId] }, c.device.token)).acked, []);
  // After a lost report the device's token does nothing at all.
  await h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: c.device.id });
  assert.equal((await h.call('GET', 'status', null, c.device.token)).state, 'lost');
  // Sign-in nonces are bound to the request name.
  const wrong = await h.proof('read-key-rotate');
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: wrong }, b.device.token)).code, 'NONCE');
  // 「여기서부터 계속」 belongs to the device that asked for the restore.
  const prefix = `c/${b.customer.id}/`; seedRepo(h, prefix); h.clock.advance(60000);
  const d = await h.provision('PC-4');
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, b.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  assert.equal((await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, d.device.token)).state, 'not-requester');
  // A finished restore waiting for its choice holds the account: no new device meanwhile.
  assert.equal((await h.provision('PC-5')).code, 'BUSY');
});

test('S2: requests that change keys run one at a time per customer — never two writers', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2');
  const [p1, p2] = [await h.proof('take-write-seat'), await h.proof('take-write-seat')];
  // The second request is sent while the first holds the customer's line: from inside the first
  // one's key making, so the two surely overlap (GPT 끝판2 GE1).
  const realCreate = h.b2.createKey.bind(h.b2);
  let r2 = null;
  h.b2.createKey = async (args) => {
    if (!r2) { r2 = 'sent'; r2 = await h.call('POST', 'devices/take-write-seat', { google: p2 }, a.device.token); }
    return realCreate(args);
  };
  const r1 = await h.call('POST', 'devices/take-write-seat', { google: p1 }, b.device.token);
  h.b2.createKey = realCreate;
  assert.equal(r1.ok, true, r1.code);
  assert.equal(r2.code, 'BUSY');
  const writers = [...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbw-'));
  assert.equal(writers.length, 1);
  assert.equal(h.store.all("select count(*) n from devices where role = 'write' and state = 'active'")[0].n, 1);
});

test('S1: a stop between deleting the old key and making the new one is continued by the same request', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2');
  h.b2.failCreate = true;
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token)).code, 'SERVER');
  h.b2.failCreate = false;
  assert.equal(h.b2.keys.has(a.keys.write.keyId), false, 'the old key went first');
  assert.equal(h.store.writerOf(a.customer.id).id, b.device.id, 'the seat is already recorded');
  const again = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token);
  assert.equal(again.ok, true);
  // The retry still names the PC the seat came from (as recorded with the move, 카본 C8).
  assert.equal(again.previous.id, a.device.id);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'seat-moved'")[0].n, 1, 'told once, with the move itself');
  assert.equal([...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbw-')).length, 1);
  // The writer that lost its unacknowledged key gets a new one the same way (다시 받기).
  h.clock.advance(11 * 60000); await h.jobs.expireKeys();
  assert.equal([...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbw-')).length, 0);
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token)).ok, true);
});

test('S16: dead devices filling the limit are listed and cut with a sign-in alone (not the writer)', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.provision('PC-3');
  const full = await h.provision('PC-4');
  assert.equal(full.code, 'LIMIT_DEVICES');
  assert.equal(full.devices.length, 3);
  assert.equal((await h.call('POST', 'devices/revoke', { google: await h.proof('revoke'), deviceId: a.device.id })).code, 'DEVICE_STATE');
  const cut = await h.call('POST', 'devices/revoke', { google: await h.proof('revoke'), deviceId: b.device.id });
  assert.equal(cut.ok, true); assert.equal(cut.suggestReadKeyRotation, true);
  assert.equal((await h.provision('PC-4')).ok, true);
});

test('S3 · S4: after a restore the old incident stays quiet; a new one after the baseline fires; resent runs count once', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const prefix = `c/${a.customer.id}/`;
  const base = seedRepo(h, prefix);
  for (let i = 2; i <= 6; i++) h.b2.upload(base + `snapshots/s${i}`, `snap-${i}`);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(3600000);
  h.b2.upload(base + 'data/aa/d1', 'pack-one-CONTENT');
  h.clock.advance(3600000);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 2 * 3600000 + 1 }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  assert.equal((await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, a.device.token)).state, 'continued');
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0, 'the incident before the baseline does not fire');
  // Measurements: a resent batch is stored once; a huge prunedSnapshots cannot hide a real surge.
  const runs = [{ trigger: 'hourly', startedAt: h.clock.t - 1000, result: 'complete', prunedSnapshots: 100000 }];
  assert.equal((await h.call('POST', 'telemetry', { runs }, a.device.token)).stored.runs, 1);
  assert.equal((await h.call('POST', 'telemetry', { runs }, a.device.token)).stored.runs, 0);
  h.clock.advance(3600000);
  for (let i = 1; i <= 6; i++) h.b2.hide(base + `snapshots/s${i}`);
  h.b2.upload(base + 'config', 'cfg-other');
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const usage = JSON.parse(h.store.lastUsage(a.customer.id).detect);
  assert.ok(usage.alerts.some((x) => x.reason === 'content'), 'the new config upload after the baseline fires');
  assert.ok(usage.alerts.some((x) => x.reason === 'hide-surge' && x.vanished), 'vanished snapshots fire without trusting telemetry');
});

test('S10: help bundles keep only checked fields', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const MARK = 'secretproject';
  const r = await h.call('POST', 'help', { text: '도와주세요', bundle: { env: { appVersion: '0.7.0' }, errorCodes: ['SCHEDULE_FOREIGN', MARK], settings: { sources: 3, folder: MARK, mode: 'backup' }, runs: [{ trigger: 'manual', startedAt: h.clock.t, result: 'failed', path: MARK }], log: MARK } }, a.device.token);
  assert.equal(r.ok, true);
  assert.equal(dbBytes(h).includes(Buffer.from(MARK)), false);
  const saved = JSON.parse(h.store.all('select bundle from help')[0].bundle);
  assert.deepEqual(saved.errorCodes, ['SCHEDULE_FOREIGN']);
  assert.deepEqual(saved.settings, { sources: 3, mode: 'backup' });
});

test('move pin: the reading PC pins the snapshot it copies, the writer sees it, the seat move or 7 days end it', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const w = await h.provision('옛 PC'); await h.ack(w);
  const r = await h.provision('새 PC'); await h.ack(r);
  const snap = 'ab'.repeat(32);
  assert.equal((await h.call('POST', 'move/pin', { snapshotId: 'short' }, r.device.token)).code, 'BAD_INPUT');
  assert.equal((await h.call('POST', 'move/pin', { snapshotId: snap }, w.device.token)).code, 'DEVICE_STATE', 'the writer cannot pin');
  const pinned = await h.call('POST', 'move/pin', { snapshotId: snap }, r.device.token);
  assert.equal(pinned.ok, true); assert.equal(pinned.move.snapshotId, snap);
  const ws = await h.call('GET', 'status', null, w.device.token);
  assert.deepEqual({ by: ws.move.by.name, snapshotId: ws.move.snapshotId, mine: ws.move.byThisDevice }, { by: '새 PC', snapshotId: snap, mine: false });
  // Only the pinning device can unpin.
  assert.equal((await h.call('POST', 'move/unpin', {}, w.device.token)).unpinned, false);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move.snapshotId, snap, 'the pin stays (카본 끝판2 E5)');
  // Pinning again replaces the pin.
  const snap2 = 'cd'.repeat(32);
  await h.call('POST', 'move/pin', { snapshotId: snap2 }, r.device.token);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move.snapshotId, snap2);
  // The pinning device releases it.
  assert.equal((await h.call('POST', 'move/unpin', {}, r.device.token)).unpinned, true);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move, null);
  await h.call('POST', 'move/pin', { snapshotId: snap2 }, r.device.token);
  // Seven days end a pin nobody released.
  h.clock.advance(7 * 24 * 3600 * 1000 + 1);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move, null);
  // The seat move ends it.
  await h.call('POST', 'move/pin', { snapshotId: snap }, r.device.token);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move.snapshotId, snap);
  const seat = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, r.device.token);
  assert.equal(seat.ok, true);
  assert.equal((await h.call('GET', 'status', null, r.device.token)).move, null);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move, null);
});

test('GPT r2 GA1: a database from the earlier version gains the new column and restore state', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-migrate-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { DatabaseSync } = await import('node:sqlite');
  const old = new DatabaseSync(path.join(dir, 'wb.sqlite'));
  old.exec(`create table customers(id text primary key, sub text not null unique, email text not null unique, prefix text not null unique, state text not null default 'active', created_at integer not null, lost_at integer, google_step integer not null default 0, read_key text, detect_since integer);
create table restore_jobs(id text primary key, customer_id text not null, device_id text not null, at integer not null, state text not null check (state in ('running','done','failed','continued','undone')), created_at integer not null, started_at integer, pre_at integer, rounds integer, finished_at integer, undo_of text, counts text, journal text, error text, choice_at integer);
create table devices(id text primary key, customer_id text not null references customers(id), name text not null, role text not null check (role in ('write','read')), state text not null check (state in ('active','moved','revoked','lost','abandoned')), created_at integer not null, last_seen_at integer, token_hash text not null unique, app_version text, moved_to text);
insert into customers(id, sub, email, prefix, created_at) values ('c1', 's1', 'c1@example.com', 'c/c1/', 1);
insert into devices(id, customer_id, name, role, state, created_at, token_hash) values ('d1', 'c1', 'PC', 'write', 'active', 1, 'h1');
insert into devices(id, customer_id, name, role, state, created_at, last_seen_at, token_hash) values ('d2', 'c1', 'PC-2', 'read', 'active', 1, 7, 'h2');
insert into restore_jobs(id, customer_id, device_id, at, state, created_at) values ('j1', 'c1', 'd1', 1, 'done', 2);`);
  old.close();
  const s = new Store(path.join(dir, 'wb.sqlite'));
  const j = s.createJob({ customerId: 'c1', deviceId: 'd1', at: 3, state: 'preparing' });
  assert.equal(j.state, 'preparing');
  assert.equal(s.job('j1').state, 'done');
  s.setCustomer('c1', { move_pin: null });
  assert.equal(s.customerById('c1').detect_cursor, null, 'the old customers table gained the scan cursor');
  assert.equal(s.device('d1').install_id, null, 'the old devices table gained install_id');
  assert.equal(s.device('d1').first_seen_at, 1, 'a device from before counts as one that spoke (카본 r8a E4)');
  assert.equal(s.device('d2').first_seen_at, 7);
  s.close(); new Store(path.join(dir, 'wb.sqlite')).close(); // a second open changes nothing
});

test('GPT GA4: the per-customer line holds across processes — a second store on the same file sees the lease', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const other = new Store(path.join(h.dir, 'wb.sqlite'), { now: () => h.clock.t });
  assert.equal(other.takeLock(a.customer.id, 'admin-process', 600000), true);
  const busy = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token);
  assert.equal(busy.code, 'BUSY');
  other.releaseLock(a.customer.id, 'admin-process');
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).ok, true);
  // A holder that died loses the lease when it runs out.
  assert.equal(other.takeLock(a.customer.id, 'dead-process', 1000), true);
  h.clock.advance(1001);
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).ok, true);
  other.close();
});

test('GPT GB4: a device cut while its sign-in was being checked is not brought back', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.ack(b);
  // While b's take-write-seat waits for Google, a reports b lost.
  h.hooks.beforeVerify = async () => {
    const r = await h.call('POST', 'lost', { google: await h.proofDirect('lost'), deviceId: b.device.id });
    assert.equal(r.ok, true);
  };
  const seat = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token);
  assert.equal(seat.code, 'DEVICE_STATE');
  assert.equal(h.store.device(b.device.id).state, 'lost');
  assert.equal(h.store.writerOf(a.customer.id).id, a.device.id);
  assert.equal(h.store.liveKeys(a.customer.id, 'write').filter((k) => k.device_id === b.device.id).length, 0);
});

test('GPT GB2 · 카본 C4: a restore stopped while its keys were being replaced ends failed — the old write keys are gone, the app asks again', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const prefix = `c/${a.customer.id}/`; seedRepo(h, prefix); h.clock.advance(60000);
  // The state a stop leaves: a preparing job (its answer never left) and the old write key still alive.
  const job = h.store.createJob({ customerId: a.customer.id, deviceId: a.device.id, at: h.clock.t - 30000, state: 'preparing' });
  assert.equal(await h.api.runJob(job), null, 'a preparing job never restores by itself');
  assert.ok(h.b2.keys.has(a.keys.write.keyId));
  // Another restore cannot start meanwhile.
  assert.equal((await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token)).code, 'BUSY');
  await h.api.finishPreparing(job);
  assert.equal(h.b2.keys.has(a.keys.write.keyId), false, 'the replacement that had started is finished');
  assert.equal(h.store.job(job.id).state, 'failed');
  assert.ok(!h.b2.versions.some((v) => v.action === 'hide' && v.uploadTimestamp >= job.created_at), 'nothing was restored');
  // The app asks again: a new restore runs.
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  assert.equal(run.ok, true);
  await h.api.runJob(h.store.job(run.jobId));
  assert.equal(h.store.job(run.jobId).state, 'done');
});
test('GPT GB3: a finished restore waiting for its choice blocks a second one; only the latest can be chosen', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const prefix = `c/${a.customer.id}/`; seedRepo(h, prefix); h.clock.advance(60000);
  const r1 = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  await h.api.runJob(h.store.job(r1.jobId));
  assert.equal((await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 20000 }, a.device.token)).code, 'BUSY');
  assert.equal((await h.call('POST', 'restore/choose', { jobId: r1.jobId, choice: 'continue' }, a.device.token)).state, 'continued');
  // An older finished job cannot be undone after a later restore was continued.
  h.clock.advance(1000);
  const r2 = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 10000 }, a.device.token);
  await h.api.runJob(h.store.job(r2.jobId));
  assert.equal((await h.call('POST', 'restore/choose', { jobId: r2.jobId, choice: 'continue' }, a.device.token)).state, 'continued');
  h.store.setJob(r1.jobId, { state: 'done' }); // as if r1 had never been chosen (an earlier version's data)
  assert.equal((await h.call('POST', 'restore/choose', { jobId: r1.jobId, choice: 'undo', google: await h.proof('restore-undo') }, a.device.token)).code, 'NOT_FOUND', 'with nothing newer running too (카본 끝판 E4)');
  assert.equal((await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 5000 }, a.device.token)).ok, true, 'the stale r1 does not block either');
  assert.equal((await h.call('POST', 'restore/choose', { jobId: r1.jobId, choice: 'undo', google: await h.proof('restore-undo') }, a.device.token)).code, 'NOT_FOUND');
});

test('GPT GB6: a write key that replaced another is usable only after the grace; the first one at once', async (t) => {
  const h = await harness(t, { grace: 60000 });
  h.store.addInvite('pilot@example.com');
  const a = await h.provision('PC-1'); await h.ack(a);
  assert.ok(!a.usableAt || a.usableAt <= h.clock.t);
  const b = await h.provision('PC-2'); await h.ack(b);
  const seat = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token);
  assert.equal(seat.usableAt, h.clock.t + 60000);
  // GPT r2 GA7 · 카본 D3: a stop after the old key was deleted and before the new one was made;
  // the retry 20 s later finds no live write key and still waits from the recorded deletion.
  h.clock.advance(1000);
  h.b2.failCreate = true;
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).code, 'SERVER');
  h.b2.failCreate = false;
  const deletedAt = h.store.lastWriteKeyDeleted(a.customer.id);
  assert.equal(h.store.liveKeys(a.customer.id, 'write').filter((k) => k.state !== 'creating').length, 0);
  h.clock.advance(20000);
  const retry = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token);
  assert.equal(retry.usableAt, deletedAt + 60000);
  assert.equal(retry.waitMs, deletedAt + 60000 - h.clock.t);
});

test('GPT GB9: every planning call counts against the day — new times cannot plan past the cap', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(3600000);
  let planned = 0, refused = null;
  for (let i = 1; i <= 30 && !refused; i++) {
    const r = await h.call('POST', 'restore/plan', { at: h.clock.t - i * 1000 }, a.device.token);
    if (r.code) refused = r.code; else planned++;
  }
  assert.equal(refused, 'RATE');
  assert.ok(planned < 20, `planned ${planned} times`);
});

test('GPT GB1 · 카본 D1 · B5: keys made or deleted while the reconcile listed are left alone; an intent is the expiry\'s, not the reconcile\'s', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  h.store.addInvite('second@example.com');
  let made = null;
  const keysDuring = async (method, params, o) => {
    const r = await h.keys(method, params, o);
    if (method === 'keys.list' && !made) {
      made = await h.provision('PC-B', { sub: '2000002', email: 'second@example.com' }); await h.ack(made);
      // And a key of the first customer deleted right after the listing.
      await h.api.dropKey(h.store.keyById(a.keys.read.keyId), 'test');
    }
    return r;
  };
  const jobs = createJobs({ store: h.store, api: h.api, keys: keysDuring, files: h.files, now: () => h.clock.t, config: { bucketId: h.b2.bucketId, protectedKeyIds: h.protectedKeyIds } });
  const result = await jobs.reconcileKeys(h.clock.t);
  assert.ok(Object.keys(made.keys).length >= 1, 'the second customer really got keys during the listing');
  assert.equal(h.store.all("select count(*) n from keys where state = 'deleted' and reason = 'missing'")[0].n, 0);
  assert.ok(!result.problems.some((p) => p.kind === 'not-deleted'), 'a key deleted after the listing began is not "not deleted"');
  // An intent still waiting for its B2 answer is not an orphan; one older than the ack window is.
  const young = h.store.keyIntent({ kind: 'read', customerId: a.customer.id, deviceId: a.device.id, purpose: 'rotate' });
  const k = h.b2.addKey({ keyName: young, capabilities: ['listBuckets', 'listFiles', 'readFiles'], bucketIds: [h.b2.bucketId], namePrefix: `c/${a.customer.id}/` });
  await h.jobs.reconcileKeys(h.clock.t);
  assert.ok(h.b2.keys.has(k.applicationKeyId), 'young intent kept');
  h.clock.advance(11 * 60000);
  const later = await h.jobs.reconcileKeys(h.clock.t);
  assert.ok(h.b2.keys.has(k.applicationKeyId), 'the reconcile does not sweep intents');
  assert.ok(!later.problems.some((p) => p.kind === 'not-in-table'));
  await h.jobs.expireKeys();
  assert.equal(h.b2.keys.has(k.applicationKeyId), false, 'the minute tick\'s expiry sweeps a stale intent by name');
  assert.equal(h.store.key(young).state, 'deleted');
  // GPT r2 GA5: the time counted is when B2 answered, not when the request was written down.
  const name = h.store.keyIntent({ kind: 'read', customerId: a.customer.id, deviceId: a.device.id, purpose: 'rotate' });
  h.clock.advance(5); const listedFrom = h.clock.t; h.clock.advance(5);
  h.store.keyCreated(name, { keyId: 'fixture-late-key', capabilities: [] });
  assert.ok(h.store.key(name).created_at > listedFrom);
});

test('GPT GB7 · 카본 D2: the minute tick expires unacknowledged keys while a long daily pass is still running', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com'); h.store.addInvite('second@example.com');
  let release, entered;
  const inScan = new Promise((ok) => { entered = ok; });
  const slowFiles = async (method, params, o) => { if (method === 'prefix.scan') { entered(); await new Promise((ok) => { release = ok; }); } return h.files(method, params, o); };
  const jobs = createJobs({ store: h.store, api: h.api, keys: h.keys, files: slowFiles, now: () => h.clock.t, config: { bucketId: h.b2.bucketId, protectedKeyIds: h.protectedKeyIds, dailyHourKst: 0 } });
  const first = await h.provision('PC-1'); await h.ack(first);
  const daily = jobs.tick();
  await inScan;
  const b = await h.provision('PC-B', { sub: '2000002', email: 'second@example.com' }); // never acknowledged
  const pending = h.store.all("select count(*) n from keys where device_id = ? and state != 'deleted'", b.device.id)[0].n;
  assert.ok(pending >= 1, 'the new customer has unacknowledged keys');
  h.clock.advance(11 * 60000);
  await jobs.tick();
  assert.equal(h.store.all("select count(*) n from keys where device_id = ? and state != 'deleted'", b.device.id)[0].n, 0, 'expired during the daily pass');
  release(); await daily;
});

test('GPT GA5: the server counts an audit run only when its audit job itself succeeded', async (t) => {
  const h = await harness(t);
  const runs = { workflow_runs: [{ conclusion: 'success', updated_at: new Date(h.clock.t - 3600000).toISOString(), jobs_url: 'https://api.github.com/repos/x/y/actions/runs/1/jobs' }] };
  let jobsAnswer = { jobs: [{ name: 'audit', conclusion: 'skipped' }] };
  const fetchImpl = async (url) => new Response(JSON.stringify(String(url).endsWith('/jobs') ? jobsAnswer : runs));
  const jobs = createJobs({ store: h.store, api: h.api, keys: h.keys, files: h.files, now: () => h.clock.t, fetchImpl, config: { bucketId: h.b2.bucketId, auditRunsUrl: 'https://api.github.com/repos/x/y/actions/workflows/workbackup-audit.yml/runs' } });
  await jobs.auditFresh(h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'audit-stale'")[0].n, 1, 'a skipped job is not an audit');
  jobsAnswer = { jobs: [{ name: 'audit', conclusion: 'success' }] };
  h.clock.advance(86400000); runs.workflow_runs[0].updated_at = new Date(h.clock.t - 3600000).toISOString();
  await jobs.auditFresh(h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'audit-stale'")[0].n, 1);
});

test('화면 요청 15: a full account marks the earlier devices of this same PC, only when the request names its install', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const installId = 'C'.repeat(22);
  const sign = async (name, install) => h.call('POST', 'provision', { google: await h.proof('provision'), device: { name, appVersion: '0.7.0', ...(install ? { installId: install } : {}) } });
  // This PC was the writer and finished its sign-up, then Windows was reinstalled (same install id kept on disk).
  const a = await sign('PC-1', installId);
  await h.ack(a);
  assert.equal((await h.call('POST', 'read-key/confirm', { keyId: a.keys.read.keyId }, a.device.token)).ok, true);
  const b = await h.provision('PC-2'); const c = await h.provision('PC-3');
  const full = await sign('PC-1 again', installId);
  assert.equal(full.code, 'LIMIT_DEVICES');
  assert.deepEqual(full.devices.map((d) => [d.id, d.sameInstall]), [[a.device.id, true], [b.device.id, false], [c.device.id, false]]);
  assert.equal(h.store.device(a.device.id).state, 'active', 'an acknowledged device of this PC is not dropped as a ghost');
  // Another PC, and a request without an install id: no row is this PC.
  assert.deepEqual((await sign('PC-9', 'D'.repeat(22))).devices.map((d) => d.sameInstall), [false, false, false]);
  assert.ok((await sign('PC-9')).devices.every((d) => !('sameInstall' in d)));
});

test('카본 D5 · C6: the same PC signing up again after a lost answer replaces its unfinished device, without a new-device notice', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const installId = 'A'.repeat(22);
  const sign = async () => h.call('POST', 'provision', { google: await h.proof('provision'), device: { name: 'PC', appVersion: '0.7.0', installId } });
  const lost = await sign(); // its answer "never arrived": nothing acknowledged
  const again = await sign();
  assert.equal(again.device.role, 'write');
  assert.equal(h.store.device(lost.device.id).state, 'abandoned');
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'new-device'")[0].n, 0);
  assert.equal((await h.call('POST', 'provision', { google: await h.proof('provision'), device: { name: 'PC', installId: 'bad' } })).code, 'BAD_INPUT');
  // Another PC (another install id) is a second device and does not replace anything — even
  // while this one's answer is still unacknowledged (카본 끝판2 E4).
  const other = await h.call('POST', 'provision', { google: await h.proof('provision'), device: { name: 'PC-2', installId: 'B'.repeat(22) } });
  assert.equal(other.device.role, 'read');
  assert.equal(h.store.device(again.device.id).state, 'active');
  await h.ack(again);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'new-device'")[0].n, 1);
});

test('카본 C1 · C2 · 카본 r6 C1: a lost requester\'s finished restore waits for another device\'s choice; with none left it is kept, so a new PC can sign up', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.ack(b);
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  assert.equal(h.store.job(run.jobId).state, 'done');
  // a is lost while its restore waits; b is still there, so b chooses.
  await h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: a.device.id });
  assert.equal(h.store.job(run.jobId).state, 'done', 'b may still undo it');
  assert.equal(h.store.key(h.store.keyById(run.keys.read.keyId).name).state, 'deleted', 'the lost report deleted every read key');
  assert.equal((await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, b.device.token)).state, 'continued');
  const c = await h.provision('PC-3');
  assert.equal(c.ok, true, 'a new PC can sign up');
  // C2: a reading device revoked with an acknowledged, unconfirmed read key leaves none behind.
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, b.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [rot.keys.read.keyId] }, b.device.token);
  await h.call('POST', 'devices/revoke', { google: await h.proof('revoke'), deviceId: b.device.id }, c.device.token);
  assert.equal(h.store.keyById(rot.keys.read.keyId).state, 'retired');
  // Another customer with one PC only: lost while its restore waits — nobody could choose, so it is kept.
  h.store.addInvite('second@example.com');
  const solo = await h.provision('Solo', { sub: '2000002', email: 'second@example.com' }); await h.ack(solo);
  seedRepo(h, `c/${solo.customer.id}/`); h.clock.advance(60000);
  const run2 = await h.call('POST', 'restore/run', { google: await h.proof('restore-run', { sub: '2000002', email: 'second@example.com' }), at: h.clock.t - 30000 }, solo.device.token);
  await h.api.runJob(h.store.job(run2.jobId));
  await h.call('POST', 'lost', { google: await h.proof('lost', { sub: '2000002', email: 'second@example.com' }), deviceId: solo.device.id });
  assert.equal(h.store.job(run2.jobId).state, 'continued');
  assert.equal((await h.provision('Solo-new', { sub: '2000002', email: 'second@example.com' })).ok, true);
});

test('카본 C1 · 카본 r6 C1: a requester revoked while its restore ran — the remaining device can undo it', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.ack(b);
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  await h.call('POST', 'devices/revoke', { google: await h.proof('revoke'), deviceId: a.device.id }, b.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  assert.equal(h.store.job(run.jobId).state, 'done', 'it waits for b');
  const undo = await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'undo', google: await h.proof('restore-undo') }, b.device.token);
  assert.equal(undo.state, 'undone');
  await h.api.runJob(h.store.job(undo.jobId));
  assert.equal(h.store.job(undo.jobId).state, 'continued');
});

test('카본 C5 · C7 · C9: malformed telemetry is a 400; the first sign-up after a loss is not counted; a time a little ahead is "now"', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const bad = await h.call('POST', 'telemetry', { runs: {} }, a.device.token);
  assert.equal(bad.status, 400); assert.equal(bad.code, 'BAD_INPUT');
  // Use up the day's key requests, then lose the only (writing) PC: the new PC still signs up.
  for (let i = 0; i < 4; i++) assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).ok, true);
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token)).code, 'LIMIT_KEYS_DAY');
  await h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: a.device.id });
  const n = h.store.keyRequestsSince(a.customer.id, h.clock.t - 86400000);
  const fresh = await h.provision('새 PC');
  assert.equal(fresh.ok, true); assert.equal(fresh.device.role, 'write'); assert.ok(fresh.keys.read);
  assert.equal(h.store.keyRequestsSince(a.customer.id, h.clock.t - 86400000), n, 'not counted');
  await h.ack(fresh);
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  assert.equal((await h.call('POST', 'restore/plan', { at: h.clock.t + 100 }, fresh.device.token)).ok, true);
  assert.equal((await h.call('POST', 'restore/plan', { at: 1.5 }, fresh.device.token)).code, 'BAD_INPUT');
  assert.equal((await h.call('POST', 'restore/plan', { at: h.clock.t - 40 * 86400000 }, fresh.device.token)).code, 'TOO_OLD');
});

test('카본 B2 · B3: the scan window starts no earlier than the last restore, and stays open while measurements are late', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const seen = [];
  const files = async (method, params, o) => { if (method === 'prefix.scan') seen.push(params); return h.files(method, params, o); };
  const jobs = createJobs({ store: h.store, api: h.api, keys: h.keys, files, now: () => h.clock.t, config: { bucketId: h.b2.bucketId } });
  const base = seedRepo(h, `c/${a.customer.id}/`);
  for (let i = 2; i <= 9; i++) h.b2.upload(base + `snapshots/s${i}`, `snap-${i}`);
  h.clock.advance(3600000);
  await jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  // A restore was chosen at noon; the next scan's window starts there.
  h.clock.advance(6 * 3600000);
  const baseline = h.clock.t; h.store.setCustomer(a.customer.id, { detect_since: baseline });
  h.clock.advance(6 * 3600000);
  for (let i = 2; i <= 9; i++) h.b2.hide(base + `snapshots/s${i}`); // after the baseline, no measurement yet
  h.clock.advance(3600000);
  await jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.ok(seen.at(-1).since >= baseline, 'the window does not start before the baseline');
  assert.equal(seen.at(-1).from, baseline);
  assert.ok(JSON.parse(h.store.lastUsage(a.customer.id).detect).deferred.includes('no-telemetry'));
  const held = seen.at(-1).since;
  // The next day the held window keeps its start, so late measurements still judge those hides.
  h.clock.advance(86400000);
  await jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(seen.at(-1).since, held);
});

// ── jobs.mjs 설계 관문(Fable 5.2 「고쳐서 간다」, 11-16): the reconcile reports, the scan window follows a cursor.
const jobsWith = (h, over = {}) => createJobs({ store: h.store, api: h.api, keys: h.keys, files: h.files, mailer: over.mailer, now: () => h.clock.t, config: { bucketId: h.b2.bucketId, protectedKeyIds: h.protectedKeyIds }, ...over });

test('jobs 관문: intent → listing → B2 answer → reconcile leaves the table as it is', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const name = h.store.keyIntent({ kind: 'read', customerId: a.customer.id, deviceId: a.device.id, purpose: 'rotate' });
  h.clock.advance(11 * 60000);
  let answered = null;
  const keys = async (method, params, o) => {
    const r = await h.keys(method, params, o);
    if (method === 'keys.list' && !answered) {
      answered = h.b2.addKey({ keyName: name, capabilities: ['listBuckets', 'listFiles', 'readFiles'], bucketIds: [h.b2.bucketId], namePrefix: `c/${a.customer.id}/` });
      h.store.keyCreated(name, { keyId: answered.applicationKeyId, capabilities: [] });
      assert.equal(h.store.ackKey(a.device.id, answered.applicationKeyId), true);
    }
    return r;
  };
  const result = await jobsWith(h, { keys }).reconcileKeys(h.clock.t);
  assert.equal(h.store.key(name).state, 'acked');
  assert.ok(h.b2.keys.has(answered.applicationKeyId));
  assert.ok(!result.problems.some((p) => p.kind === 'missing-key'));
});

test('jobs 관문: a confirmed read key deleted in the B2 console is marked missing after the in-line check, and the next sign-up gets a new one', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  h.clock.advance(11 * 60000);
  h.b2.keys.delete(a.keys.read.keyId);
  const result = await h.jobs.reconcileKeys(h.clock.t);
  assert.ok(result.problems.some((p) => p.kind === 'missing-key' && p.count === 1));
  const row = h.store.keyById(a.keys.read.keyId);
  assert.equal(row.state, 'deleted'); assert.equal(row.reason, 'missing');
  assert.equal(h.store.keyById(a.keys.write.keyId).state, 'active', 'the write key B2 still has is untouched');
  const b = await h.provision('PC-2');
  assert.ok(b.keys.read, 'a new read key for the envelope');
});

test('jobs 관문: a key the first listing missed but the in-line listing shows is not changed', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  h.clock.advance(11 * 60000);
  let first = true;
  const keys = async (method, params, o) => {
    const r = await h.keys(method, params, o);
    if (method === 'keys.list' && first) { first = false; return { keys: r.keys.filter((k) => k.keyId !== a.keys.write.keyId) }; }
    return r;
  };
  const result = await jobsWith(h, { keys }).reconcileKeys(h.clock.t);
  assert.equal(h.store.keyById(a.keys.write.keyId).state, 'active');
  assert.ok(!result.problems.some((p) => p.kind === 'missing-key'));
});

test('jobs 관문: a key B2 made after its sign-up was given up is deleted by name at the next reconcile', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const name = h.store.keyIntent({ kind: 'write', customerId: a.customer.id, deviceId: a.device.id, purpose: 'provision' });
  h.store.keyDeleted(name, 'provision-failed'); // given up while the B2 request still ran
  h.clock.advance(1000);
  const late = h.b2.addKey({ keyName: name, capabilities: [...WRITE_CAPS], bucketIds: [h.b2.bucketId], namePrefix: `c/${a.customer.id}/` });
  h.clock.advance(1000);
  const result = await h.jobs.reconcileKeys(h.clock.t);
  assert.ok(result.problems.some((p) => p.kind === 'not-deleted'));
  assert.equal(h.b2.keys.has(late.applicationKeyId), false);
  // And a key made for a row given up meanwhile is deleted at once by the request itself
  // (through the request, not only the store's answer — 카본 끝판2 E3).
  const row = h.store.keyIntent({ kind: 'read', customerId: a.customer.id, deviceId: a.device.id, purpose: 'rotate' });
  h.store.keyDeleted(row, 'test');
  assert.equal(h.store.keyCreated(row, { keyId: 'fixture', capabilities: [] }), 0);
  const realCreate = h.b2.createKey.bind(h.b2);
  let made = null;
  h.b2.createKey = async (args) => { h.store.keyDeleted(args.keyName, 'test'); made = await realCreate(args); return made; };
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token);
  h.b2.createKey = realCreate;
  assert.equal(rot.code, 'SERVER');
  assert.ok(made);
  assert.equal(h.b2.keys.has(made.applicationKeyId), false, 'the request deleted the key it could not hand out');
});

test('jobs 관문: hides with no measurement wait up to seven days, then are judged as none; the cursor then moves', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  for (let i = 2; i <= 9; i++) h.b2.upload(base + `snapshots/s${i}`, `snap-${i}`);
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const start = h.store.customerById(a.customer.id).detect_cursor;
  assert.ok(start);
  h.clock.advance(3600000);
  for (let i = 2; i <= 9; i++) h.b2.hide(base + `snapshots/s${i}`);
  const surges = () => h.store.all("select count(*) n from alerts where kind = 'repo-changed' and detail like '%hide-surge%'")[0].n;
  for (let day = 1; day <= 6; day++) {
    h.clock.advance(86400000);
    await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
    assert.ok(JSON.parse(h.store.lastUsage(a.customer.id).detect).deferred.includes('no-telemetry'), `day ${day} waits`);
    assert.equal(h.store.customerById(a.customer.id).detect_cursor, start);
  }
  assert.equal(surges(), 0);
  h.clock.advance(2 * 86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(surges(), 1, 'judged as no measurement');
  assert.equal(h.store.customerById(a.customer.id).detect_cursor, h.clock.t - 5 * 60000, 'to the end of the judged window');
});

test('jobs 관문: a prune measured a day late is capped by the count where the window starts, not yesterday\'s', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  for (let i = 2; i <= 30; i++) h.b2.upload(base + `snapshots/s${i}`, `snap-${i}`);
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(JSON.parse(h.store.lastUsage(a.customer.id).detect).deferred.length, 0);
  h.clock.advance(3600000);
  const pruneAt = h.clock.t;
  for (let i = 1; i <= 20; i++) h.b2.hide(base + `snapshots/s${i}`);
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t); // no measurement yet: waits
  assert.ok(JSON.parse(h.store.lastUsage(a.customer.id).detect).deferred.includes('no-telemetry'));
  const runs = [{ trigger: 'hourly', startedAt: pruneAt, result: 'complete', prunedSnapshots: 20 }];
  assert.equal((await h.call('POST', 'telemetry', { runs }, a.device.token)).stored.runs, 1);
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0, 'a normal prune, measured late, is no surge');
  assert.equal(JSON.parse(h.store.lastUsage(a.customer.id).detect).window.snapshotsAtStart, 30, 'the cap counts from the listing where the window starts');
});

test('jobs 관문: while the cursor waits, the same data surge mails once', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  for (let i = 2; i <= 9; i++) h.b2.upload(base + `snapshots/s${i}`, `snap-${i}`);
  for (let i = 0; i < 3; i++) h.b2.upload(base + `data/bb/big${i}`, `big-${i}`).contentLength = 1024 ** 3;
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(3600000);
  for (let i = 2; i <= 9; i++) h.b2.hide(base + `snapshots/s${i}`);
  for (let i = 0; i < 3; i++) h.b2.hide(base + `data/bb/big${i}`);
  for (let day = 1; day <= 3; day++) { h.clock.advance(86400000); await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t); }
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 3, 'an alert row a day');
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:repo-changed:%'")[0].n, 1, 'one mail');
});

test('jobs 관문: a restore chosen while the worker scanned throws that judgment away', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const cursor = h.store.customerById(a.customer.id).detect_cursor;
  h.clock.advance(3600000);
  h.b2.upload(base + 'data/aa/d1', 'pack-one-CONTENT');
  h.clock.advance(86400000);
  const files = async (method, params, o) => {
    const r = await h.files(method, params, o);
    if (method === 'prefix.scan') h.store.setCustomer(a.customer.id, { detect_since: h.clock.t });
    return r;
  };
  await jobsWith(h, { files }).scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
  assert.equal(h.store.all('select count(*) n from detect_seen')[0].n, 0);
  assert.equal(h.store.customerById(a.customer.id).detect_cursor, cursor);
});

test('jobs 관문: a failure between marking events seen and alerting undoes both', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(3600000);
  h.b2.upload(base + 'data/aa/d1', 'pack-one-CONTENT');
  h.clock.advance(86400000);
  const broken = { toCustomer() { throw new Error('disk'); }, toOperator() {} };
  await assert.rejects(jobsWith(h, { mailer: broken }).scanCustomer(h.store.customerById(a.customer.id), h.clock.t));
  assert.equal(h.store.all('select count(*) n from detect_seen')[0].n, 0);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 1, 'the next scan alerts');
});

test('jobs 관문: deleting a key in use that B2 no longer has tells the operator', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  h.b2.keys.delete(a.keys.write.keyId);
  await h.api.dropKey(h.store.keyById(a.keys.write.keyId), 'test');
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'key-missing' and audience = 'operator'")[0].n, 1);
  assert.equal(h.store.keyById(a.keys.write.keyId).state, 'deleted');
});

test('GPT r6 GB2: the operator\'s cut takes the device\'s unconfirmed read key and frees the restore it waited on', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.ack(b);
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, b.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [rot.keys.read.keyId] }, b.device.token);
  await h.api.cutDevice(b.device.id);
  assert.equal(h.store.device(b.device.id).state, 'revoked');
  assert.equal(h.store.keyById(rot.keys.read.keyId).state, 'retired');
  await h.jobs.expireKeys();
  assert.equal(h.b2.keys.has(rot.keys.read.keyId), false, 'the minute tick deleted it');
  // The writer cut while its restore waits for a choice: the account is not held.
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  await h.api.cutDevice(a.device.id);
  assert.equal(h.store.job(run.jobId).state, 'continued');
  assert.equal(h.store.liveKeys(a.customer.id, 'write').length, 0);
  assert.equal(h.b2.keys.has(run.keys.write.keyId), false, 'deleted on B2 too (카본 r7 D3)');
  assert.equal([...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbw-') && k.namePrefix === `c/${a.customer.id}/`).length, 0);
});

// ── 카본 r6 B · C(11-16)
test('카본 r6 C2 · C6: an undo waits out the grace, is free in the worker, and when it fails the restore waits for its choice again', async (t) => {
  const h = await harness(t, { grace: 60000 });
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.clock.advance(2 * 3600000);
  h.b2.upload(base + 'data/aa/d1', 'pack-one-CONTENT');
  h.clock.advance(3600000);
  const uses = () => { try { return JSON.parse(fs.readFileSync(path.join(h.dir, 'restore-days.json'), 'utf8')).counts?.[`c/${a.customer.id}/`] || 0; } catch { return 0; } };
  // Two restores and their undos: the undos are not counted.
  for (let i = 0; i < 2; i++) {
    const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 2 * 3600000 }, a.device.token);
    await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
    await h.api.runJob(h.store.job(run.jobId));
    // A write key deleted just now (the operator's cut of another device would do the same): the undo waits.
    h.store.run("update keys set deleted_at = ? where kind = 'write' and key_id is not null and state = 'deleted'", h.clock.t);
    const before = h.clock.t;
    const undo = await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'undo', google: await h.proof('restore-undo') }, a.device.token);
    await h.api.runJob(h.store.job(undo.jobId));
    assert.ok(h.clock.t >= before + 60000, 'the undo waited out the grace');
    assert.equal(h.store.job(undo.jobId).state, 'continued');
  }
  assert.equal(uses(), 2, 'two restores counted, the undos free');
  // A third restore, then its undo fails: the restore waits for its choice again, backups stay paused.
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 2 * 3600000 }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  const copy = h.b2.copyFile;
  h.b2.copyFile = async () => { throw Object.assign(new Error('boom'), { status: 503 }); };
  const undo = await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'undo', google: await h.proof('restore-undo') }, a.device.token);
  await h.api.runJob(h.store.job(undo.jobId));
  h.b2.copyFile = copy;
  // Called again, a finished job does not run again.
  assert.equal(await h.api.runJob(h.store.job(run.jobId)), null);
  assert.equal(h.store.job(undo.jobId).state, 'failed');
  assert.equal(h.store.job(run.jobId).state, 'done');
  const st = await h.call('GET', 'status', null, a.device.token);
  assert.equal(st.restore.jobId, run.jobId); assert.equal(st.restore.awaitingChoice, true);
  assert.equal((await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, a.device.token)).state, 'continued');
});

test('카본 r6 C3 · C4 · C5: B2 never holds three read keys of a prefix; a restore whose read key failed leaves no write key; incident requests are free once; a fourth restore is refused before keys', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const wbr = () => [...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbr-') && k.namePrefix === `c/${a.customer.id}/`).length;
  await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token);
  await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token);
  assert.equal(wbr(), 2, 'confirmed + the newest unconfirmed');
  // C4: the write key made before a failed read key is deleted at once.
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  let n = 0;
  const realCreate = h.b2.createKey.bind(h.b2);
  h.b2.createKey = async (args) => { if (args.keyName.startsWith('wbr-') && ++n === 1) throw Object.assign(new Error('boom'), { status: 503 }); return realCreate(args); };
  const failed = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  assert.equal(failed.code, 'SERVER');
  h.b2.createKey = realCreate;
  assert.equal(h.store.liveKeys(a.customer.id, 'write').length, 0, 'no write key left from the failed request');
  assert.equal([...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbw-') && k.namePrefix === `c/${a.customer.id}/`).length, 0, 'none on B2 either (카본 r7 D3)');
  // C5: after a loss, the first read-key request is free; the next ones count.
  const b = await h.provision('PC-2'); await h.ack(b);
  await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, a.device.token);
  await h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: a.device.id });
  const before = h.store.keyRequestsSince(a.customer.id, h.clock.t - 86400000);
  await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, b.device.token);
  assert.equal(h.store.keyRequestsSince(a.customer.id, h.clock.t - 86400000), before, 'the first one is free');
  await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, b.device.token);
  assert.equal(h.store.keyRequestsSince(a.customer.id, h.clock.t - 86400000), before + 1, 'the next one counts');
});

test('카본 r6 C5: the fourth restore of a day is refused before any key is made', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  for (let i = 0; i < 3; i++) {
    const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
    await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
    await h.api.runJob(h.store.job(run.jobId));
    await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, a.device.token);
  }
  const made = h.b2.calls.filter((c) => c[0] === 'createKey').length;
  assert.equal((await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token)).code, 'LIMIT_RESTORE_DAY');
  assert.equal(h.b2.calls.filter((c) => c[0] === 'createKey').length, made);
});

test('카본 r6 C7 · C8 · C9: every seat move mails; a short stop does not hide a longer one; an oversized body gets a 413 answer', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.ack(b);
  const take = async (d) => { await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, d.device.token); h.clock.advance(1000); };
  await take(b); await take(a); await take(b);
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:seat-moved:%'")[0].n, 3);
  // C8
  h.store.beat(); h.clock.advance(2 * 86400000); h.store.beat(); // a two-day stop
  h.clock.advance(11 * 60000); h.store.beat(); // then an eleven-minute one
  const gap = h.store.lastGap();
  assert.ok(gap.end - gap.start >= 2 * 86400000, 'the longer stop is kept');
  // C9
  const res = await fetch(`http://127.0.0.1:${h.port}/backup-api/v1/keys/ack`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${a.device.token}` }, body: JSON.stringify({ keyIds: ['x'.repeat(70000)] }) });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, 'BAD_INPUT');
});

test('카본 r6 B2: hides just before the cursor are not counted again the next day', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  for (let i = 2; i <= 12; i++) h.b2.upload(base + `snapshots/s${i}`, `snap-${i}`);
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const prune = async (from, to) => {
    const at = h.clock.t;
    for (let i = from; i <= to; i++) h.b2.hide(base + `snapshots/s${i}`);
    await h.call('POST', 'telemetry', { runs: [{ trigger: 'hourly', startedAt: at, result: 'complete', prunedSnapshots: to - from + 1 }] }, a.device.token);
  };
  h.clock.advance(23.5 * 3600000);
  await prune(1, 8); // half an hour before the next scan
  h.clock.advance(1800000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(JSON.parse(h.store.lastUsage(a.customer.id).detect).window.snapshotHides, 8);
  h.clock.advance(12 * 3600000);
  await prune(9, 9);
  h.clock.advance(12 * 3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(JSON.parse(h.store.lastUsage(a.customer.id).detect).window.snapshotHides, 1);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
});

// ── jobs.mjs 설계 관문 둘째(Fable 5.2 「고쳐서 간다」, 11-16 저녁): the window is (since, to].
const report = async (h, a, pruned, startedAt = h.clock.t) => h.call('POST', 'telemetry', { runs: [{ trigger: 'hourly', startedAt, result: 'complete', prunedSnapshots: pruned }] }, a.device.token);
const snapshots = (h, base, n, prefix = 's') => { for (let i = 1; i <= n; i++) h.b2.upload(base + `snapshots/${prefix}${i}`, `${prefix}-${i}`); };

test('jobs 관문 둘: a prune while the listing runs belongs to the next window only — no false surge that day or the next', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.b2.hide(base + 'snapshots/s1'); snapshots(h, base, 12, 'n');
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(86400000);
  // The scan begins at t; while its listing runs the PC prunes 9 of the 12 and reports it.
  const files = async (method, params, o) => {
    if (method === 'prefix.scan') { h.clock.advance(10 * 60000); for (let i = 1; i <= 9; i++) h.b2.hide(base + `snapshots/n${i}`); await report(h, a, 9); h.clock.advance(10 * 60000); }
    return h.files(method, params, o);
  };
  const jobs = createJobs({ store: h.store, api: h.api, keys: h.keys, files, mailer: undefined, now: () => h.clock.t, config: { bucketId: h.b2.bucketId } });
  await jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(JSON.parse(h.store.lastUsage(a.customer.id).detect).window.snapshotHides, 0, 'not in this window');
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(JSON.parse(h.store.lastUsage(a.customer.id).detect).window.snapshotHides, 9, 'counted once, the next day');
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
});

test('jobs 관문 둘: a data surge while the listing runs mails once', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  for (let i = 0; i < 3; i++) h.b2.upload(base + `data/bb/big${i}`, `big-${i}`).contentLength = 1024 ** 3;
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(86400000);
  const files = async (method, params, o) => {
    if (method === 'prefix.scan') { h.clock.advance(10 * 60000); for (let i = 0; i < 3; i++) h.b2.hide(base + `data/bb/big${i}`); await report(h, a, 0); h.clock.advance(10 * 60000); }
    return h.files(method, params, o);
  };
  const jobs = createJobs({ store: h.store, api: h.api, keys: h.keys, files, mailer: h.mailer, now: () => h.clock.t, config: { bucketId: h.b2.bucketId } });
  await jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:repo-changed:%'")[0].n, 1);
});

test('jobs 관문 둘: after a restore brought snapshots back, the first judgment counts them as there to prune', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.b2.hide(base + 'snapshots/s1'); snapshots(h, base, 12, 'n');
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const before = h.clock.t;
  h.clock.advance(3600000);
  for (let i = 1; i <= 8; i++) h.b2.hide(base + `snapshots/n${i}`);
  await report(h, a, 8);
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t); // 4 left, quiet
  // A restore to before that prune brings the 8 back; the customer keeps it.
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: before }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, a.device.token);
  h.clock.advance(3600000);
  for (let i = 1; i <= 9; i++) h.b2.hide(base + `snapshots/n${i}`);
  await report(h, a, 9);
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(JSON.parse(h.store.lastUsage(a.customer.id).detect).window.snapshotsAtStart, 12);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
});

test('jobs 관문 둘: a customer from before the cursor (a usage row, no cursor) gets no false surge on its first judgment', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.b2.hide(base + 'snapshots/s1'); snapshots(h, base, 12, 'n');
  h.clock.advance(3 * 86400000);
  h.store.putUsage(a.customer.id, '2000-01-01', { visibleBytes: 0, visibleCount: 0, hiddenBytes: 0, hiddenCount: 0, visibleSnapshots: 1 }, null);
  for (let i = 1; i <= 8; i++) h.b2.hide(base + `snapshots/n${i}`);
  await report(h, a, 8);
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
});

test('jobs 관문 둘: a run of two hours that pruned inside the window counts by when its record arrived', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.b2.hide(base + 'snapshots/s1'); snapshots(h, base, 12, 'n');
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const cursor = h.store.customerById(a.customer.id).detect_cursor;
  h.clock.advance(3600000);
  for (let i = 1; i <= 8; i++) h.b2.hide(base + `snapshots/n${i}`);
  await report(h, a, 8, cursor - 2 * 3600000); // began two hours before the window
  await report(h, a, 0); // and a short run with nothing pruned
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
});

test('jobs 관문 둘: while the cursor waits, a new overwrite mails again', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  snapshots(h, base, 9, 'n');
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.clock.advance(3600000);
  for (let i = 1; i <= 8; i++) h.b2.hide(base + `snapshots/n${i}`); // no measurement: the cursor waits
  h.b2.upload(base + 'data/aa/d1', 'pack-one-CONTENT');
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  h.b2.upload(base + 'index/i1', 'index-other');
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.ok(JSON.parse(h.store.lastUsage(a.customer.id).detect).deferred.includes('no-telemetry'));
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:repo-changed:%content:%'")[0].n, 2);
});

test('GPT r7 GB2: a measurement received after the window\'s end does not cover this window\'s hides', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.b2.hide(base + 'snapshots/s1'); snapshots(h, base, 20, 'n');
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  const next = h.clock.t + 86400000; // the next scan
  h.clock.advance(3600000);
  await report(h, a, 0); // an ordinary run inside the window
  h.clock.t = next - 6 * 60000;
  for (let i = 1; i <= 6; i++) h.b2.hide(base + `snapshots/n${i}`); // with nothing measured
  h.clock.t = next - 2 * 60000;
  for (let i = 7; i <= 12; i++) h.b2.hide(base + `snapshots/n${i}`);
  await report(h, a, 6); // a real prune, after the window's end
  h.clock.t = next;
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.ok(JSON.parse(h.store.lastUsage(a.customer.id).detect).alerts.some((x) => x.reason === 'hide-surge'));
});

test('GPT r7 GC1 · GC2: the last device leaving releases a finished restore whoever asked; reporting a lost device again changes nothing', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.ack(b);
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  await h.call('POST', 'devices/revoke', { google: await h.proof('revoke'), deviceId: a.device.id }, b.device.token);
  assert.equal(h.store.job(run.jobId).state, 'done', 'b may still choose');
  await h.call('POST', 'devices/revoke', { google: await h.proof('revoke'), deviceId: b.device.id }, b.device.token);
  assert.equal(h.store.job(run.jobId).state, 'continued', 'nobody is left to choose');
  const c = await h.provision('PC-3'); await h.ack(c);
  assert.equal(c.ok, true);
  // GC2: c reports a lost, then recovers the read key; reporting a again changes nothing.
  await h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: a.device.id });
  const lostAt = h.store.customerById(a.customer.id).lost_at;
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, c.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [rot.keys.read.keyId] }, c.device.token);
  await h.call('POST', 'read-key/confirm', { keyId: rot.keys.read.keyId }, c.device.token);
  h.clock.advance(60000);
  const again = await h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: a.device.id });
  assert.equal(again.alreadyLost, true);
  assert.equal(h.store.keyById(rot.keys.read.keyId).state, 'active', 'the recovered read key stays');
  assert.equal(h.store.customerById(a.customer.id).lost_at, lostAt);
  assert.equal(h.store.customerById(a.customer.id).google_step, 0);
});

// ── 카본 r7 A · B · C(11-16 밤)
test('카본 r7 B2: the operator\'s loss report is the customer\'s, in the same line; a second one changes nothing', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2'); await h.ack(b);
  const r = await h.api.reportLost(b.device.id);
  assert.equal(r.next, 'read-key-rotate');
  assert.equal(h.store.device(b.device.id).state, 'lost');
  assert.equal(h.store.customerById(a.customer.id).google_step, 1);
  assert.equal(h.b2.keys.has(a.keys.read.keyId), false, 'the account read key is deleted on B2');
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token);
  const again = await h.api.reportLost(b.device.id);
  assert.equal(again.alreadyLost, true);
  assert.ok(h.b2.keys.has(rot.keys.read.keyId), 'the read key made since stays');
  await assert.rejects(h.api.reportLost('zzzzzzzzzzzz'), { code: 'NOT_FOUND' });
});

test('카본 r7 B4: a key that seemed missing but could not be looked at again is a problem, not a pass', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  h.clock.advance(11 * 60000);
  h.b2.keys.delete(a.keys.read.keyId);
  let lists = 0;
  const keys = async (method, params, o) => { if (method === 'keys.list' && ++lists === 2) throw Object.assign(new Error('down'), { code: 'NETWORK' }); return h.keys(method, params, o); };
  const result = await jobsWith(h, { keys }).reconcileKeys(h.clock.t);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.kind === 'missing-unchecked' && p.customers === 1));
  assert.notEqual(h.store.keyById(a.keys.read.keyId).state, 'deleted', 'not marked without the second look');
});

test('카본 r7 B5: every change of a scan with more than 1,000 is marked seen', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  for (let i = 0; i < 1100; i++) h.b2.upload(base + `data/aa/q${i}`, `a${i}`.padEnd(8, '.'));
  h.clock.advance(3600000);
  for (let i = 0; i < 1100; i++) h.b2.upload(base + `data/aa/q${i}`, `b${i}`.padEnd(8, '.'));
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.ok(h.store.all('select count(*) n from detect_seen where customer_id = ?', a.customer.id)[0].n >= 1100);
  const alerts = () => h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n;
  const once = alerts();
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(alerts(), once, 'the next scan raises none of the 1,100 again (카본 r8a E5)');
});

test('카본 r7 C3: an undo that fails after the last device left keeps the restore, so a new PC can sign up', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const at = h.clock.t - 30000;
  h.b2.upload(base + 'data/aa/d1', 'pack-two-content'); h.clock.advance(60000);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  assert.equal(h.store.job(run.jobId).state, 'done');
  let release; const gate = new Promise((ok) => { release = ok; });
  const realCopy = h.b2.copyFile.bind(h.b2);
  h.b2.copyFile = async () => { await gate; throw Object.assign(new Error('boom'), { status: 503 }); };
  t.after(() => { h.b2.copyFile = realCopy; });
  const undo = await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'undo', google: await h.proof('restore-undo') }, a.device.token);
  const running = h.api.runJob(h.store.job(undo.jobId));
  await h.api.cutDevice(a.device.id); // the only device, while the undo runs
  release();
  await running;
  assert.equal(h.store.job(undo.jobId).state, 'failed');
  assert.equal(h.store.job(run.jobId).state, 'continued', 'nobody is left to choose');
  h.b2.copyFile = realCopy;
  const c = await h.provision('PC-3');
  assert.equal(c.ok, true);
});

test('카본 r7 C4: the writer taking its own seat again keeps the reading PC\'s pin', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const w = await h.provision('옛 PC'); await h.ack(w);
  const r = await h.provision('새 PC'); await h.ack(r);
  const snap = 'ab'.repeat(32);
  await h.call('POST', 'move/pin', { snapshotId: snap }, r.device.token);
  const again = await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, w.device.token);
  assert.equal(again.ok, true);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move.snapshotId, snap);
  const x = await h.provision('셋째 PC'); await h.ack(x);
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, x.device.token)).ok, true);
  assert.equal((await h.call('GET', 'status', null, r.device.token)).move.snapshotId, snap, 'a third PC taking the seat keeps it (카본 r8a E6)');
});

// ── 설계 관문 셋째(Fable 5.2 「고쳐서 간다」, 11-16 밤): one rule for a finished restore nobody can choose for.
async function doneRestore(h, a) {
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  assert.equal(h.store.job(run.jobId).state, 'done');
  return run.jobId;
}

test('설계 관문 셋째 3 · 4: a device whose sign-up answer never arrived cannot choose; the last real device leaving keeps the restore', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  await h.provision('ghost'); // signed up, its answer lost: it never speaks with its token
  const jobId = await doneRestore(h, a);
  await h.api.cutDevice(a.device.id);
  assert.equal(h.store.job(jobId).state, 'continued');
});

test('설계 관문 셋째 3 · 4: the minute tick keeps a restore no path settled, and one whose moment before is past the 29 days', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const jobId = await doneRestore(h, a);
  h.store.setDevice(a.device.id, { state: 'revoked', role: 'read' }); // a path that forgot to settle
  assert.equal(h.store.job(jobId).state, 'done');
  await h.jobs.tick();
  assert.equal(h.store.job(jobId).state, 'continued');
  const h2 = await harness(t);
  const b = await readyCustomer(h2);
  const old = await doneRestore(h2, b);
  h2.clock.advance(30 * 86400000);
  await h2.jobs.tick();
  assert.equal(h2.store.job(old).state, 'continued', 'undo would be TOO_OLD');
});

test('설계 관문 셋째 5: four ways a device leaves × somebody left to choose or not', async (t) => {
  const ways = {
    revoke: async (h, a) => h.call('POST', 'devices/revoke', { google: await h.proof('revoke'), deviceId: a.device.id }, a.device.token),
    lost: async (h, a) => h.call('POST', 'lost', { google: await h.proof('lost'), deviceId: a.device.id }),
    cut: (h, a) => h.api.cutDevice(a.device.id),
    report: (h, a) => h.api.reportLost(a.device.id),
  };
  for (const [way, leave] of Object.entries(ways)) for (const other of [true, false]) {
    const h = await harness(t);
    const a = await readyCustomer(h);
    if (other) { const b = await h.provision('PC-2'); await h.ack(b); }
    const jobId = await doneRestore(h, a);
    await leave(h, a);
    assert.notEqual(h.store.device(a.device.id).state, 'active', way);
    assert.equal(h.store.job(jobId).state, other ? 'done' : 'continued', `${way}, ${other ? 'another device left to choose' : 'nobody left'}`);
  }
});

// ── r8a 검수(11-16 밤)
test('카본 r8a C1: a key deleted while the listing ran is no "not in table" problem', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token);
  h.clock.advance(11 * 60000);
  let first = true;
  const keys = async (method, params, o) => {
    const r = await h.keys(method, params, o);
    if (method === 'keys.list' && first) { first = false; await h.api.dropKey(h.store.keyById(rot.keys.read.keyId), 'superseded'); }
    return r;
  };
  const result = await jobsWith(h, { keys }).reconcileKeys(h.clock.t);
  assert.ok(!result.problems.some((p) => p.kind === 'not-in-table'), JSON.stringify(result.problems));
});

test('카본 r8a D1: a plan cached before a restore is not shown after it', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const at = h.clock.t - 30000;
  h.b2.upload(base + 'data/aa/d1', 'pack-two-content'); h.clock.advance(60000);
  let release; const gate = new Promise((ok) => { release = ok; });
  const realCopy = h.b2.copyFile.bind(h.b2);
  h.b2.copyFile = async (x) => { await gate; return realCopy(x); };
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  assert.equal((await h.call('POST', 'restore/plan', { at }, a.device.token)).plan.counts.copy, 1, 'planned while it runs');
  const running = h.api.runJob(h.store.job(run.jobId));
  release(); await running; h.b2.copyFile = realCopy;
  assert.equal((await h.call('POST', 'restore/plan', { at }, a.device.token)).plan.counts.copy, 0, 'the files are already back');
});

test('카본 r8a D2 · D3: a non-string version or install id is refused before the sign-in; the rate key is the proxy\'s own entry', async (t) => {
  const h = await harness(t, { config: { trustedProxies: ['127.0.0.1', '::1'] } });
  h.store.addInvite('pilot@example.com');
  const p = await h.proof('provision');
  for (const device of [{ name: 'PC', appVersion: ['0.7.0'] }, { name: 'PC', installId: ['a'.repeat(22)] }]) {
    const r = await h.call('POST', 'provision', { google: p, device });
    assert.equal(r.code, 'BAD_INPUT');
  }
  assert.equal((await h.call('POST', 'provision', { google: p, device: { name: 'PC' } })).ok, true, 'the refusals did not use the sign-in (카본 끝판 E1)');
  const nonce = async (xff) => (await fetch(`http://127.0.0.1:${h.port}/backup-api/v1/nonce`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': xff }, body: JSON.stringify({ purpose: 'provision' }) })).json();
  const codes = [];
  for (let i = 0; i < 31; i++) codes.push((await nonce(`10.0.0.${i}, 203.0.113.9`)).code ?? 'ok');
  assert.deepEqual(codes.slice(0, 30).filter((c) => c !== 'ok'), [], 'the first thirty pass (카본 끝판2 E2)');
  assert.equal(codes[30], 'RATE', 'a client cannot dodge the limit with its own forwarded-for entries');
  // Another client behind the same proxy is its own key: the key is the proxy's entry, not the proxy's address.
  assert.equal((await nonce('203.0.113.10')).ok, true);
});

test('GPT r8a GD1: the same time asked again after a third restore failed half-way continues it, not refused as a fourth', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const once = async (at) => {
    const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at }, a.device.token);
    assert.equal(run.ok, true, run.code);
    await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
    await h.api.runJob(h.store.job(run.jobId));
    return run.jobId;
  };
  for (let i = 0; i < 2; i++) {
    const at = h.clock.t - 1000; h.b2.upload(base + 'data/aa/d1', `pack-change-${i}-x`); h.clock.advance(60000);
    const id = await once(at);
    await h.call('POST', 'restore/choose', { jobId: id, choice: 'continue' }, a.device.token);
    h.clock.advance(60000);
  }
  const at = h.clock.t - 1000; h.b2.upload(base + 'data/aa/d1', 'pack-change-3-x'); h.b2.upload(base + 'index/i1', 'index-changed'); h.clock.advance(60000);
  const realCopy = h.b2.copyFile.bind(h.b2); let n = 0;
  h.b2.copyFile = async (x) => { if (++n === 2) throw Object.assign(new Error('boom'), { status: 503 }); return realCopy(x); };
  const failed = await once(at);
  assert.equal(h.store.job(failed).state, 'failed');
  h.b2.copyFile = realCopy;
  const id = await once(at);
  assert.equal(h.store.job(id).state, 'done', 'continued in the worker, free');
  const latest = async (rel) => (await h.b2.listFileVersions({ prefix: base + rel })).find((v) => v.fileName === base + rel);
  assert.equal((await latest('data/aa/d1')).contentSha1, crypto.createHash('sha1').update('pack-one-content').digest('hex'), 'both files are back (카본 끝판 E3)');
  assert.equal((await latest('index/i1')).contentSha1, crypto.createHash('sha1').update('index-1').digest('hex'));
});

// ── 끝판 검수(11-16 밤)
test('GPT 끝판 GD1 · 카본 끝판 D1: a failed run and its continuation are one of the day\'s restores; a retry that failed while making its keys does not end the continuation', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const ask = async (at) => {
    const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at }, a.device.token);
    if (!run.ok) return run;
    await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
    await h.api.runJob(h.store.job(run.jobId));
    if (h.store.job(run.jobId).state === 'done') await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, a.device.token);
    h.clock.advance(60000);
    return run;
  };
  const change = (i) => { const at = h.clock.t - 1000; h.b2.upload(base + 'data/aa/d1', `pack-change-${i}-x`); h.b2.upload(base + 'index/i1', `index-change-${i}`); h.clock.advance(60000); return at; };
  let at = change(0);
  const realCopy = h.b2.copyFile.bind(h.b2); let n = 0;
  h.b2.copyFile = async (x) => { if (++n === 2) throw Object.assign(new Error('boom'), { status: 503 }); return realCopy(x); };
  await ask(at); // fails half-way
  h.b2.copyFile = realCopy;
  // The retry fails while making its keys: it never starts.
  const realCreate = h.b2.createKey.bind(h.b2);
  h.b2.createKey = async () => { throw Object.assign(new Error('boom'), { status: 503 }); };
  assert.equal((await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at }, a.device.token)).code, 'SERVER');
  h.b2.createKey = realCreate;
  assert.equal((await ask(at)).ok, true, 'still the continuation');
  at = change(1); assert.equal((await ask(at)).ok, true);
  at = change(2); assert.equal((await ask(at)).ok, true, 'the failed run and its continuation counted once: this is the third');
  at = change(3); assert.equal((await ask(at)).code, 'LIMIT_RESTORE_DAY');
});

test('카본 끝판 D2: the grace is waited out again when a write key is deleted while the restore waits', async (t) => {
  const h = await harness(t, { grace: 60000 });
  const a = await readyCustomer(h);
  seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(120000);
  let deletedAt = null;
  h.hooks.onSleep = async () => {
    const name = h.store.keyIntent({ kind: 'write', customerId: a.customer.id, deviceId: a.device.id, purpose: 'seat' });
    h.store.keyCreated(name, { keyId: 'k' + 'x'.repeat(23), capabilities: [] });
    h.store.keyDeleted(name, 'test'); deletedAt = h.clock.t;
  };
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, a.device.token);
  await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  assert.ok(deletedAt !== null);
  assert.ok(h.store.job(run.jobId).started_at >= deletedAt + 60000, 'started only after the new grace');
});

test('카본 끝판 E5: no silence mail when the server itself was down', async (t) => {
  const h = await harness(t);
  await readyCustomer(h);
  h.store.beat();
  h.clock.advance(3 * 86400000 + 60000);
  h.store.beat(); // the server comes back after three days
  h.jobs.silence(h.clock.t);
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:silent:%'")[0].n, 0);
});

test('카본 r13 A1: a same-time request after a failed restore with a backup on top is a new restore — the server counts it as the worker did', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`); h.clock.advance(60000);
  const at = h.clock.t - 1000; h.b2.upload(base + 'data/aa/d1', 'pack-change-x'); h.b2.upload(base + 'index/i1', 'index-changed'); h.clock.advance(60000);
  const ask = async () => {
    const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at }, a.device.token);
    assert.equal(run.ok, true, run.code);
    await h.call('POST', 'keys/ack', { keyIds: [run.keys.write.keyId, run.keys.read.keyId] }, a.device.token);
    await h.api.runJob(h.store.job(run.jobId));
    return run.jobId;
  };
  const realCopy = h.b2.copyFile.bind(h.b2); let n = 0;
  h.b2.copyFile = async (x) => { if (++n === 2) throw Object.assign(new Error('boom'), { status: 503 }); return realCopy(x); };
  const failed = await ask();
  assert.equal(h.store.job(failed).state, 'failed');
  h.b2.copyFile = realCopy;
  h.clock.advance(3600000); h.b2.upload(base + 'snapshots/s9', 'a backup after the failure'); h.clock.advance(60000);
  const id = await ask();
  assert.equal(h.store.job(id).state, 'done');
  assert.equal(h.store.job(id).continues, null, 'the worker took it as a new restore');
  assert.equal(h.store.restoresSince(a.customer.id, h.clock.t - 86400000), 2);
});

test('GPT 끝판2 GD1: an unconfirmed read key whose delete failed is deleted again before a new one is made', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h); // A: the confirmed read key
  const rot = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token);
  assert.equal(rot.ok, true, rot.code);
  await h.call('POST', 'keys/ack', { keyIds: [rot.keys.read.keyId] }, a.device.token); // B: acknowledged, not confirmed
  h.b2.failDelete = true;
  assert.equal((await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token)).code, 'SERVER');
  h.b2.failDelete = false;
  const again = await h.call('POST', 'read-key/rotate', { google: await h.proof('read-key-rotate') }, a.device.token);
  assert.equal(again.ok, true, again.code);
  assert.equal(h.b2.keys.has(rot.keys.read.keyId), false, 'B is deleted this time');
  assert.equal([...h.b2.keys.values()].filter((k) => k.keyName.startsWith('wbr-')).length, 2, 'the confirmed one and the new one');
});

// ── 둘째 끝판 검수(11-16 밤)
test('카본 끝판2 C2: after a restore to a time before any snapshot, 「모두 사라짐」 does not count the snapshots measured before the restore', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const base = seedRepo(h, `c/${a.customer.id}/`);
  h.clock.advance(3600000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.lastUsage(a.customer.id).visible_snapshots, 1);
  h.clock.advance(3600000);
  h.b2.hide(base + 'snapshots/s1'); // what the restore did
  h.clock.advance(60000);
  h.store.setCustomer(a.customer.id, { detect_since: h.clock.t }); // the restore was kept
  h.clock.advance(86400000);
  await h.jobs.scanCustomer(h.store.customerById(a.customer.id), h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'repo-changed'")[0].n, 0);
});

test('카본 끝판2 C4: one silence notice per silence, not one a day; none for a customer who is not active', async (t) => {
  const h = await harness(t);
  await readyCustomer(h);
  h.store.addInvite('second@example.com');
  const c2 = await h.provision('PC-B', { sub: '2000002', email: 'second@example.com' }); await h.ack(c2);
  h.store.setCustomer(c2.customer.id, { state: 'suspended' });
  h.clock.advance(3 * 86400000 + 60000);
  h.store.beat(); h.jobs.silence(h.clock.t);
  for (let i = 0; i < 170; i++) { h.clock.advance(9 * 60000); h.store.beat(); } // a day, the server up all along
  h.jobs.silence(h.clock.t);
  assert.equal(h.store.all("select count(*) n from alerts where kind = 'silent'")[0].n, 1);
  assert.equal(h.store.all("select count(*) n from outbox where key like 'wb:silent:%'")[0].n, 1);
  assert.equal(h.store.all("select count(*) n from outbox where key like ?", `wb:silent:${c2.customer.id}:%`)[0].n, 0);
});
