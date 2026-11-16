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

async function harness(t) {
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
  const api = createApi({ store, keys, files, mailer, now, log: (e) => logs.push(e),
    verifyGoogle: createVerifier({ audiences: [g.aud], fetchImpl: g.fetchImpl, now }),
    config: { endpoint: 'https://s3.us-east-005.backblazeb2.com', bucket: 'synk-wb-test-bucket', restoreGraceMs: 0 } });
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
  return { clock, b2, store, api, jobs, call, proof, provision, ack, dir, g, logs, protectedKeyIds };
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
    assert.deepEqual(k.capabilities, k.keyName.startsWith('wbw-') ? WRITE_CAPS : READ_CAPS);
    assert.ok(!/@|pilot/i.test(k.keyName), 'key names carry no address');
  }
  // The same proof cannot be used twice, a sign-in nonce is not an action nonce and vice versa.
  const p = await h.proof();
  assert.equal((await h.call('POST', 'provision', { google: p, device: { name: 'x' } })).ok, true);
  assert.equal((await h.call('POST', 'provision', { google: p, device: { name: 'x' } })).code, 'NONCE');
  const action = await h.proof('lost');
  assert.equal((await h.call('POST', 'provision', { google: action, device: { name: 'x' } })).code, 'NONCE');
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
  h.b2.failDelete = true;
  assert.equal((await h.call('POST', 'devices/take-write-seat', { google: await h.proof('take-write-seat') }, b.device.token)).code, 'SERVER');
  h.b2.failDelete = false;
  assert.equal(h.store.writerOf(a.customer.id).id, a.device.id);
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
  assert.equal(h.b2.calls.filter((c) => c[0] === 'deleteKey' && c[1].startsWith('4_')).length, 0);
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
  const run = await h.call('POST', 'restore/run', { google: await h.proof('restore-run'), at: h.clock.t - 30000 }, b.device.token);
  await h.api.runJob(h.store.job(run.jobId));
  const d = await h.provision('PC-4');
  assert.equal((await h.call('POST', 'restore/choose', { jobId: run.jobId, choice: 'continue' }, d.device.token)).state, 'not-requester');
});

test('S2: requests that change keys run one at a time per customer — never two writers', async (t) => {
  const h = await harness(t);
  const a = await readyCustomer(h);
  const b = await h.provision('PC-2');
  const [p1, p2] = [await h.proof('take-write-seat'), await h.proof('take-write-seat')];
  const [r1, r2] = await Promise.all([
    h.call('POST', 'devices/take-write-seat', { google: p1 }, a.device.token),
    h.call('POST', 'devices/take-write-seat', { google: p2 }, b.device.token),
  ]);
  assert.deepEqual([r1.ok, r2.ok].sort(), [false, true]);
  assert.equal((r1.ok ? r2 : r1).code, 'BUSY');
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
  assert.equal(again.previous, null);
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
  // Pinning again replaces the pin.
  const snap2 = 'cd'.repeat(32);
  await h.call('POST', 'move/pin', { snapshotId: snap2 }, r.device.token);
  assert.equal((await h.call('GET', 'status', null, w.device.token)).move.snapshotId, snap2);
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
