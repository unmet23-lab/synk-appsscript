// Unit checks of the provisioning server's pure parts and worker guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarize, judge, suggest, DAY, HOUR, WINDOW_DAYS } from '../detect.mjs';
import { reconcile, EXPECTED_RULES } from '../reconcile.mjs';
import { rpcClient, rpcServer } from '../rpc.mjs';
import { keyHandlers, WRITE_CAPS, READ_CAPS, DAILY_CAP } from '../keys-worker.mjs';
import { fileHandlers, RESTORES_PER_DAY } from '../files-worker.mjs';
import { applyPlan } from '../restore-hidden.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require_ = createRequire(import.meta.url);
import { createVerifier } from '../google-token.mjs';
import { createMailer, signRequest, SIGNED_TAG } from '../mail.mjs';
import { cleanBatch, cleanBundle, KNOWN_ERROR_CODES } from '../telemetry.mjs';
import { Store } from '../store.mjs';
import { listenHost } from '../config.mjs';
import { createJobs } from '../jobs.mjs';
import { withSettings, secretFile } from '../config.mjs';
import { FakeB2, fakeGoogle, clockAt, sessionOf } from './fakes.mjs';

const P = 'c/abcdefghijklmnop/';
const R = P + 'r/';
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
let n = 0;
const up = (name, content, at, extra = {}) => ({ fileName: R + name, fileId: `u${++n}`, action: 'upload', uploadTimestamp: at, contentSha1: sha(content), contentLength: content.length, ...extra });
const hide = (name, at) => ({ fileName: R + name, fileId: `h${++n}`, action: 'hide', uploadTimestamp: at, contentSha1: 'none', contentLength: 0 });
const T0 = Date.UTC(2026, 10, 1);

test('detect: same-size overwrite, settings and key changes are events; restore copies and re-uploads of the same bytes are not', () => {
  const v = [up('config', 'c', T0), up('config', 'c', T0 + 5), up('keys/k1', 'k', T0), up('data/aa/p1', 'AAAA', T0), up('snapshots/s1', 's', T0), up('locks/l1', 'x', T0), up('locks/l1', 'y', T0 + 9)];
  let s = summarize(v, { customerPrefix: P, since: T0 - 1, now: T0 + DAY });
  assert.deepEqual(s.events, [], 'a retried restic init and lock churn are not events');
  const ow = up('data/aa/p1', 'BBBB', T0 + HOUR); // same length, other content
  const copyBack = { ...ow, fileId: 'copy1', contentSha1: sha('AAAA'), uploadTimestamp: T0 + 2 * HOUR };
  const newKey = up('keys/k2', 'k2', T0 + 2 * DAY);
  const cfgHide = hide('config', T0 + 3 * DAY);
  const noSha = up('index/i1', 'i', T0, { contentSha1: 'none' }); const noSha2 = { ...up('index/i1', 'j', T0 + HOUR + 1), contentSha1: 'none' };
  s = summarize([...v, ow, copyBack, newKey, cfgHide, noSha, noSha2], { customerPrefix: P, since: T0, now: T0 + 4 * DAY, journal: { copies: ['copy1'] } });
  assert.deepEqual(s.events.map((e) => [e.kind, e.fileId]), [['overwrite', ow.fileId], ['overwrite', noSha2.fileId], ['keys', newKey.fileId], ['config', cfgHide.fileId]]);
  assert.equal(s.usage.visibleSnapshots, 1);
});

test('detect (GPT GA2): A → B → our copy of A → B again is two attacks; a copy back that is not ours is a change too', () => {
  const a = up('config', 'A', T0), b1 = up('config', 'B', T0 + HOUR);
  const ourA = { ...up('config', 'A', T0 + 2 * HOUR), fileId: 'copyA' }, b2 = up('config', 'B', T0 + 3 * HOUR);
  let s = summarize([a, b1, ourA, b2], { customerPrefix: P, since: T0, now: T0 + DAY, journal: { copies: ['copyA'] } });
  assert.deepEqual(s.events.map((e) => e.fileId), [b1.fileId, b2.fileId]);
  // The second attack is new to judge even after the first was seen.
  assert.equal(judge(s, { seen: (id) => id === b1.fileId, now: T0 + DAY }).alerts.length, 1);
  // Without our journal the copy back to A is itself a change of the name.
  s = summarize([a, b1, ourA, b2], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.deepEqual(s.events.map((e) => e.fileId), [b1.fileId, ourA.fileId, b2.fileId]);
});

test('detect: judge counts only what happened after the baseline and does not repeat a seen event', () => {
  const ow = up('data/aa/p1', 'BBBB', T0 + HOUR);
  const s = summarize([up('data/aa/p1', 'AAAA', T0), ow], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.equal(judge(s, { now: T0 + DAY }).alerts[0].daysLeft, 29);
  assert.equal(judge(s, { baseline: T0 + 2 * HOUR, now: T0 + DAY }).alerts.length, 0);
  assert.equal(judge(s, { seen: (id) => id === ow.fileId, now: T0 + DAY }).alerts.length, 0);
});

test('detect: hide surge — vanished snapshots without telemetry, capped reported counts, deferral, mass-change confirmation', () => {
  const snaps = [1, 2, 3, 4, 5, 6].map((i) => up(`snapshots/s${i}`, `s${i}`, T0));
  const hides = [1, 2, 3, 4, 5, 6].map((i) => hide(`snapshots/s${i}`, T0 + HOUR));
  const s = summarize([...snaps, ...hides], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.equal(s.window.snapshotHides, 6);
  assert.ok(judge(s, { previousSnapshots: 6, reported: { pruned: 999999 }, now: T0 + DAY }).alerts.some((a) => a.vanished));
  assert.ok(judge(s, { previousSnapshots: 6, reported: null, now: T0 + DAY }).alerts.some((a) => a.vanished), 'without measurements too (카본 r8a F1)');
  // Without the vanish (one snapshot left of two), the measured rule decides; a forged huge count is capped.
  const many = [...Array(12)].map((_, i) => up(`snapshots/m${i}`, `m${i}`, T0));
  const hideTen = many.slice(0, 10).map((x) => hide(x.fileName.slice(R.length), T0 + HOUR));
  const s2 = summarize([...many, ...hideTen], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.ok(judge(s2, { previousSnapshots: 12, reported: { pruned: 2 }, now: T0 + DAY }).alerts.length === 1);
  assert.equal(judge(s2, { previousSnapshots: 12, reported: { pruned: 10 }, now: T0 + DAY }).alerts.length, 0, 'a large but true prune (PC back after a weekend) is quiet');
  assert.equal(judge(s2, { previousSnapshots: 12, reported: { pruned: 999999 }, now: T0 + DAY }).alerts.length, 0, 'forged counts are capped at what could be pruned');
  // 카본 r6 D1 · B1: snapshots made in the window are prunable too (a normal hourly prune is
  // quiet), and a forged huge count is capped at what existed — hide markers beyond that (one
  // name hidden again and again) still fire.
  const old2 = [up('snapshots/o1', 'o1', T0 - DAY), up('snapshots/o2', 'o2', T0 - DAY)];
  const today = [...Array(20)].map((_, i) => up(`snapshots/d${i}`, `d${i}`, T0 + i * 60000));
  const hide21 = [old2[0], ...today].map((x) => hide(x.fileName.slice(R.length), T0 + 2 * HOUR));
  const s21 = summarize([...old2, ...today, ...hide21], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.equal(s21.usage.visibleSnapshots, 1);
  assert.equal(judge(s21, { previousSnapshots: 2, reported: { pruned: 21 }, now: T0 + DAY }).alerts.length, 0, 'made and pruned in the window, as measured');
  const markers = [...Array(12)].map((_, i) => hide('snapshots/o1', T0 + HOUR + i));
  const sm = summarize([...old2, ...markers], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.equal(sm.window.snapshotHides, 12);
  assert.equal(judge(sm, { previousSnapshots: 2, reported: { pruned: 999999 }, now: T0 + DAY }).alerts.filter((a) => a.reason === 'hide-surge').length, 1, 'a forged count is capped at 2 − 1');
  assert.deepEqual(judge(s2, { previousSnapshots: 12, reported: null, now: T0 + DAY }).deferred, ['no-telemetry']);
  // Data: 1 GiB floor and the customer's own confirmation.
  const big = { ...up('data/bb/big', 'x', T0), contentLength: 2 * 1024 ** 3 };
  const s3 = summarize([big, hide('data/bb/big', T0 + HOUR)], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.equal(judge(s3, { reported: { pruned: 0 }, now: T0 + DAY }).alerts.length, 1);
  assert.equal(judge(s3, { reported: { pruned: 0, massConfirmed: true }, now: T0 + DAY }).alerts.length, 0);
});

test('detect: suggestions put the earliest incident first and include the first hour of a mass hide', () => {
  const now = T0 + 10 * DAY;
  const v = [up('data/aa/p1', 'AAAA', T0), up('data/aa/p1', 'BBBB', T0 + 5 * DAY)];
  for (let i = 0; i < 30; i++) { v.push(up(`snapshots/x${i}`, `x${i}`, T0)); v.push(hide(`snapshots/x${i}`, T0 + 3 * DAY + i * 1000)); }
  const s = summarize(v, { customerPrefix: P, since: T0, now });
  assert.deepEqual(suggest(s, { now }).map((c) => [c.reason, c.at]), [['before-mass-hide', T0 + 3 * DAY - 1000], ['before-overwrite', T0 + 5 * DAY - 1000]].sort((a, b) => a[1] - b[1]));
  assert.deepEqual(suggest(s, { now, baseline: T0 + 4 * DAY }).map((c) => c.reason), ['before-overwrite']);
});

test('reconcile: strange, wide, expiring, crowded keys and bucket drift are named by kind only', () => {
  const bucketId = 'b0b0b0b0b0b0b0b0';
  const ok = (name, prefix = P, caps = WRITE_CAPS) => ({ keyId: 'k' + name, keyName: name, capabilities: caps, bucketIds: [bucketId], namePrefix: prefix, expirationTimestamp: null });
  const bucket = { found: true, bucketCount: 1, bucketType: 'allPrivate', encryption: 'SSE-B2', lifecycleRules: EXPECTED_RULES, replication: 0 };
  assert.deepEqual(reconcile({ keys: [ok('wbw-' + 'a'.repeat(20)), ok('wbr-' + 'b'.repeat(20), P, ['listBuckets', 'listFiles', 'readFiles']), { keyId: 'srv', keyName: 'x', capabilities: ['writeKeys'] }], bucket, bucketId, protectedKeyIds: ['srv'] }).problems, []);
  const bad = reconcile({ bucketId, protectedKeyIds: [], keys: [
    { keyId: 'm', keyName: 'master', capabilities: ['deleteFiles'] },
    ok('wbw-' + 'c'.repeat(20), P, [...WRITE_CAPS, 'deleteFiles']),
    ok('wbw-' + 'd'.repeat(20), 'other/'),
    ok('wbw-' + 'e'.repeat(20)),
    { ...ok('wbr-' + 'f'.repeat(20)), expirationTimestamp: 5 },
  ], bucket: { ...bucket, bucketType: 'allPublic', replication: 1, lifecycleRules: [...EXPECTED_RULES, { fileNamePrefix: 'c/', daysFromHidingToDeleting: 1 }] } });
  assert.deepEqual(bad.problems.map((p) => p.kind).sort(), ['bucket-not-private', 'expiring', 'lifecycle', 'no-prefix', 'replication', 'too-many-keys', 'too-wide', 'unknown-key']);
  assert.ok(!JSON.stringify(bad).includes('master'), 'no key names or ids in the result');
});

test('rpc: signatures, clock skew and replays are refused; only codes come back', async (t) => {
  const clock = clockAt(), now = () => clock.t, secret = crypto.randomBytes(32).toString('hex');
  const srv = rpcServer({ secret, now, handlers: { 'x.echo': async (p) => p, 'x.fail': async () => { throw Object.assign(new Error('B2 400 bad: bucket synk-secret'), { code: 'NOT_OURS' }); } } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); t.after(() => srv.close());
  const url = `http://127.0.0.1:${srv.address().port}/rpc`;
  assert.deepEqual(await rpcClient({ url, secret, now })('x.echo', { a: 1 }), { a: 1 });
  await assert.rejects(rpcClient({ url, secret: 'z'.repeat(64), now })('x.echo'), { code: 'RPC_AUTH' });
  await assert.rejects(rpcClient({ url, secret, now: () => clock.t - 120000 })('x.echo'), { code: 'RPC_AUTH' });
  await assert.rejects(rpcClient({ url, secret, now })('x.fail'), (e) => e.code === 'NOT_OURS' && !e.message.includes('synk-secret'));
  // Replay of a captured request.
  const body = JSON.stringify({ method: 'x.echo', params: {} }), ts = String(now()), id = 'r'.repeat(20);
  const sig = crypto.createHmac('sha256', secret).update(`wb-rpc/v1\n${ts}\n${id}\nx.echo\n${crypto.createHash('sha256').update(body).digest('hex')}`).digest('base64url');
  const send = () => fetch(url, { method: 'POST', body, headers: { 'x-wb-ts': ts, 'x-wb-id': id, 'x-wb-sig': sig } }).then((r) => r.json());
  assert.equal((await send()).ok, true);
  assert.equal((await send()).code, 'RPC_REPLAY');
});

test('keys worker: fixed capabilities and names, customer prefixes only, never deletes foreign keys, daily cap', async (t) => {
  const clock = clockAt(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-keys-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const b2 = new FakeB2({ clock });
  const own = b2.addKey({ keyName: 'srv', capabilities: ['writeKeys'] });
  const foreign = b2.addKey({ keyName: 'wbw-' + 'q'.repeat(20), capabilities: WRITE_CAPS, bucketIds: ['other'], namePrefix: P });
  const h = keyHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, protectedKeyIds: [own.applicationKeyId], stateDir: dir, now: () => clock.t });
  const name = 'wbw-' + 'a'.repeat(20);
  for (const bad of [{ kind: 'write', prefix: 'c/x/', name }, { kind: 'write', prefix: '', name }, { kind: 'read', prefix: P, name }, { kind: 'admin', prefix: P, name }, { kind: 'write', prefix: P, name: 'master' }]) {
    await assert.rejects(h['keys.create'](bad), { code: 'BAD_INPUT' });
  }
  const k = await h['keys.create']({ kind: 'write', prefix: P, name });
  // The approved write set, written out here (GPT r7 GE1): no deleteFiles, no key or bucket powers.
  assert.deepEqual(b2.keys.get(k.keyId).capabilities, ['listBuckets', 'listFiles', 'readFiles', 'writeFiles']);
  assert.deepEqual(WRITE_CAPS, ['listBuckets', 'listFiles', 'readFiles', 'writeFiles']);
  assert.deepEqual(READ_CAPS, ['listBuckets', 'listFiles', 'readFiles']);
  await assert.rejects(h['keys.delete']({ keyId: own.applicationKeyId }), { code: 'BAD_INPUT' });
  await assert.rejects(h['keys.delete']({ keyId: foreign.applicationKeyId }), { code: 'NOT_OURS' });
  assert.deepEqual(await h['keys.delete']({ keyId: 'missing-key-id' }), { deleted: false, missing: true });
  assert.deepEqual(await h['keys.delete']({ keyId: k.keyId }), { deleted: true });
  for (let i = 1; i < DAILY_CAP; i++) await h['keys.create']({ kind: 'read', prefix: P, name: 'wbr-' + String(i).padStart(20, '0') });
  await assert.rejects(h['keys.create']({ kind: 'read', prefix: P, name: 'wbr-' + 'z'.repeat(20) }), { code: 'LIMIT_WORKER_DAY' });
  clock.advance(DAY);
  await h['keys.create']({ kind: 'read', prefix: P, name: 'wbr-' + 'y'.repeat(20) });
});

test('files worker: plans from its own listing, records the moment before, re-plans, three restores a day', async (t) => {
  const clock = clockAt(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-files-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const b2 = new FakeB2({ clock });
  const h = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  b2.upload(R + 'config', 'c'); b2.upload(R + 'snapshots/s1', 's1');
  clock.advance(HOUR); const T = clock.t - 1;
  const late = b2.upload(R + 'snapshots/s2', 's2'); b2.hide(R + 'snapshots/s1');
  clock.advance(HOUR);
  await assert.rejects(h['restore.apply']({ prefix: 'c/../', at: T }), { code: 'BAD_INPUT' });
  const r = await h['restore.apply']({ prefix: P, at: T, items: [{ type: 'copy', sourceFileId: 'x', fileName: 'elsewhere' }] });
  assert.equal(r.preAt, Math.max(...b2.versions.slice(0, 4).map((v) => v.uploadTimestamp), clock.t - HOUR), 'the latest upload, or an hour before the run (카본 r7 B1 · 설계 관문 셋째 6)');
  assert.equal(r.remaining, 0); assert.equal(r.rounds, 1);
  assert.ok(!b2.versions.some((v) => v.fileName === 'elsewhere'), 'a plan from the caller is ignored');
  assert.ok(late.uploadTimestamp <= r.preAt);
  for (let i = 1; i < RESTORES_PER_DAY; i++) await h['restore.apply']({ prefix: P, at: T });
  await assert.rejects(h['restore.apply']({ prefix: P, at: T }), { code: 'LIMIT_WORKER_DAY' });
  // A finished run is not continued for free either (GPT r2 GA4).
  await assert.rejects(h['restore.apply']({ prefix: P, at: T, resume: true }), { code: 'LIMIT_WORKER_DAY' });
  await assert.rejects(h['restore.plan']({ prefix: P, at: clock.t - 30 * DAY }), { code: 'TOO_OLD' });
});

test('google token: alg, signature, kid refresh at most once a minute', async () => {
  const clock = clockAt(), g = fakeGoogle({ clock });
  const verify = createVerifier({ audiences: [g.aud], fetchImpl: g.fetchImpl, now: () => clock.t });
  const nonce = 'n'.repeat(43);
  assert.equal((await verify(g.token({ nonce }))).email, 'pilot@example.com');
  const [h, p, s] = g.token({ nonce }).split('.');
  await assert.rejects(verify(`${Buffer.from(JSON.stringify({ alg: 'none', kid: 'x' })).toString('base64url')}.${p}.`), { reason: 'alg' });
  await assert.rejects(verify(`${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: '666' })).toString('base64url')}.${s}`), { reason: 'signature' });
  const before = g.fetched;
  await assert.rejects(verify(g.token({ nonce }, { header: { kid: 'unknown' } })), { reason: 'kid' });
  await assert.rejects(verify(g.token({ nonce }, { header: { kid: 'unknown2' } })), { reason: 'kid' });
  assert.equal(g.fetched - before, 1, 'one forced refresh, then a minute of rest');
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verify(g.token({ nonce }, { key: other })), { reason: 'signature' });
});

test('mail: held while off, signature verifies with the relay formula, statuses', async (t) => {
  const clock = clockAt(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-mail-'));
  const store = new Store(path.join(dir, 'm.sqlite'), { now: () => clock.t });
  t.after(() => { try { store.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });
  const off = createMailer({ store, enabled: false, operator: 'ops@example.com' });
  off.toCustomer({ id: 'abc', email: 'p@example.com' }, 'silent', { name: 'PC', lastSeen: clock.t }, 'x');
  assert.equal(store.all('select state from outbox')[0].state, 'held');
  assert.equal(await off.flush(), 0);
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const seen = [];
  const on = createMailer({ store, enabled: true, relayUrl: 'https://script.google.com/x', privateKey, operator: 'ops@example.com', now: () => clock.t,
    fetchImpl: async (_u, o) => { const req = JSON.parse(o.body); seen.push(req); return new Response(JSON.stringify({ ok: true, status: seen.length === 1 ? 'sent' : 'busy' })); } });
  on.toOperator('reconcile', { problems: [{ kind: 'lifecycle', count: 1 }] }, 'd1');
  on.toCustomer({ id: 'abc', email: 'p@example.com' }, 'new-device', { at: clock.t, name: 'PC<script>' }, 'dev1');
  assert.equal(await on.flush(), 1);
  const req = seen[0];
  const message = JSON.stringify([SIGNED_TAG, req.op, req.key, req.ts, req.to, req.subject, req.body]);
  assert.ok(crypto.verify('sha256', Buffer.from(message), { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(req.sig, 'base64')));
  assert.match(req.key, /^[a-z0-9:_-]{8,160}$/);
  assert.equal(store.all("select count(*) n from outbox where state = 'held'")[0].n, 1, 'mail held while off is never sent later');
  assert.equal(signRequest(privateKey, req).length > 300, true);
  store.close();
});

test('telemetry: closed words, bounds and time window', () => {
  const now = T0 + DAY;
  const r = cleanBatch({ runs: [...Array(250)].map((_, i) => ({ trigger: 'hourly', startedAt: now - i, result: 'complete' })).concat([{ trigger: 'hourly', startedAt: now - 9 * DAY, result: 'complete' }]),
    notifications: [{ kind: 'stale' }, { kind: 'my-project' }], installs: [{ step: 'provision', ok: true }, { step: 'C:/x' }] }, { now });
  assert.equal(r.runs.length, 200); assert.equal(r.notifications.length, 1); assert.equal(r.installs.length, 1);
  assert.equal(r.dropped.items, 51 + 1 + 1);
  // GPT GC2: the time window on its own — an old run first in a small batch is dropped.
  const w = cleanBatch({ runs: [{ trigger: 'hourly', startedAt: now - 9 * DAY, result: 'complete' }, ...[...Array(10)].map((_, i) => ({ trigger: 'hourly', startedAt: now - i * HOUR, result: 'complete' })), { trigger: 'hourly', startedAt: now + DAY, result: 'complete' }] }, { now });
  assert.equal(w.runs.length, 10);
  assert.ok(w.runs.every((x) => x.startedAt >= now - 8 * DAY && x.startedAt <= now + HOUR));
});

test('telemetry: a Solio request run and a rest on a chosen Wi-Fi are kept as fixed words (솔리오 잇기 305e380fe)', () => {
  const now = T0 + DAY;
  const r = cleanBatch({ runs: [{ trigger: 'request', startedAt: now - HOUR, result: 'complete' }, { trigger: 'hourly', startedAt: now, result: 'skipped', pause: 'network' }, { trigger: 'requests', startedAt: now, result: 'complete' }, { trigger: 'hourly', startedAt: now, result: 'skipped', pause: 'Office-WiFi' }] }, { now });
  assert.deepEqual(r.runs.map((x) => [x.trigger, x.pause ?? null]), [['request', null], ['hourly', 'network']]);
  assert.equal(r.dropped.items, 2, 'a word outside the closed lists drops the item, so a Wi-Fi name never comes in');
});

test('settings file and secrets folder: only WB_ names, never secrets, environment wins', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-settings-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'settings.env');
  fs.writeFileSync(file, '# 손님 버킷\r\nWB_BUCKET=fixture-bucket\r\n\r\nWB_GOOGLE_AUDIENCES=a.apps.googleusercontent.com,b\n');
  const env = withSettings({ WB_SETTINGS: file, WB_GOOGLE_AUDIENCES: 'from-env' });
  assert.equal(env.WB_BUCKET, 'fixture-bucket');
  assert.equal(env.WB_GOOGLE_AUDIENCES, 'from-env', 'the environment wins');
  assert.deepEqual(withSettings({ A: '1' }), { A: '1' }, 'no settings file, nothing read');
  for (const bad of ['WB_SECRET_WB_KEYS_RPC=x', 'PATH=/tmp', 'WB_SETTINGS=/etc/passwd', 'not a line']) {
    fs.writeFileSync(file, bad);
    assert.throws(() => withSettings({ WB_SETTINGS: file }), /CONFIG_INVALID/);
  }
  assert.throws(() => withSettings({ WB_SETTINGS: path.join(dir, 'missing') }), /CONFIG_MISSING/);
  fs.mkdirSync(path.join(dir, 'secrets'));
  fs.writeFileSync(path.join(dir, 'secrets', 'wb-keys-rpc'), 'k'.repeat(64) + '\n');
  assert.equal(secretFile('WB_KEYS_RPC', { env: { WB_SECRETS_DIR: path.join(dir, 'secrets') } }), 'k'.repeat(64));
  assert.throws(() => secretFile('WB_FILES_RPC', { env: { WB_SECRETS_DIR: path.join(dir, 'secrets') } }), /SECRET_MISSING/);
});

test('GPT GA1: a claimed resume of a restore this worker never started still counts', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-files-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c'); clock.advance(HOUR);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  for (let i = 1; i <= RESTORES_PER_DAY; i++) await f['restore.apply']({ prefix: P, at: clock.t - i * 1000, resume: true });
  await assert.rejects(f['restore.apply']({ prefix: P, at: clock.t - 99000, resume: true }), { code: 'LIMIT_WORKER_DAY' });
  // A finished run is not continued for free (GPT r2 GA4); the next day counts anew.
  await assert.rejects(f['restore.apply']({ prefix: P, at: clock.t - RESTORES_PER_DAY * 1000, resume: true }), { code: 'LIMIT_WORKER_DAY' });
  clock.advance(DAY);
  const at = clock.t - 1000;
  // A run that stopped half-way (the worker answered with an error) is continued free.
  // It stops after its first plan passed (카본 r7 E2): the copy fails, so it is counted and unfinished.
  b2.upload(R + 'config', 'changed');
  const realCopy = b2.copyFile.bind(b2);
  b2.copyFile = async () => { throw Object.assign(new Error('stop'), { status: 503 }); };
  await assert.rejects(f['restore.apply']({ prefix: P, at }));
  b2.copyFile = realCopy;
  const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'restore-days.json'), 'utf8'));
  assert.equal(ledger.started[P].done, undefined, 'left unfinished');
  await f['restore.apply']({ prefix: P, at, resume: true });
  await f['restore.apply']({ prefix: P, at: at - 1 });
  await f['restore.apply']({ prefix: P, at: at - 2 });
  await assert.rejects(f['restore.apply']({ prefix: P, at: at - 3 }), { code: 'LIMIT_WORKER_DAY' }, 'the stopped run counted once, its continuation not at all');
});

test('GPT GB5: after the first failure no lane starts another item, and the error carries what was done', async () => {
  const items = [...Array(8)].map((_, i) => ({ type: 'copy', fileName: R + `data/aa/p${i}`, rel: `data/aa/p${i}`, sourceFileId: `s${i}` }));
  const plan = { at: 1, prefix: R, counts: { copy: 8, hide: 0, unchanged: 0 }, copyBytes: 0, items };
  const started = [];
  const session = { async copyFile({ fileName }) { started.push(fileName); if (fileName.endsWith('p0')) { await new Promise((ok) => setTimeout(ok, 5)); throw Object.assign(new Error('boom'), { status: 503 }); } await new Promise((ok) => setTimeout(ok, 20)); return { fileId: 'n-' + fileName.slice(-2) }; } };
  const seen = [];
  const e = await applyPlan(session, { bucketId: 'b'.repeat(24), plan, concurrency: 4, onItem: (x) => seen.push(x) }).catch((x) => x);
  assert.equal(e.message, 'boom');
  assert.equal(started.length, 4, 'only the four already running');
  assert.equal(e.journal.length, 3); assert.deepEqual(seen, e.journal);
});

test('GPT GB8: a read key with a write power is too wide', () => {
  const k = { keyId: 'k1', keyName: 'wbr-aaaaaaaaaaaaaaaaaaaa', capabilities: ['listBuckets', 'listFiles', 'readFiles', 'writeFiles'], bucketIds: ['b'.repeat(24)], namePrefix: P, expirationTimestamp: null };
  const r = reconcile({ keys: [k], bucket: { found: true, bucketCount: 1, bucketType: 'allPrivate', encryption: 'SSE-B2', lifecycleRules: EXPECTED_RULES, replication: 0 }, bucketId: 'b'.repeat(24) });
  assert.deepEqual(r.problems, [{ kind: 'too-wide', count: 1 }]);
  const w = reconcile({ keys: [{ ...k, keyName: 'wbw-aaaaaaaaaaaaaaaaaaaa' }], bucket: { found: true, bucketCount: 1, bucketType: 'allPrivate', encryption: 'SSE-B2', lifecycleRules: EXPECTED_RULES, replication: 0 }, bucketId: 'b'.repeat(24) });
  assert.equal(w.ok, true);
});

test('GPT GA5: the outside audit fails, never passes quietly, when its settings are missing or malformed', () => {
  const { spawnSync } = require_('node:child_process');
  const run = (env) => spawnSync(process.execPath, [path.join(import.meta.dirname, '..', 'audit.mjs')], { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot || '', ...env }, encoding: 'utf8', timeout: 30000 });
  for (const env of [{}, { WB_AUDIT_KEY_ID: '0051234567890000000000001', WB_AUDIT_APP_KEY: 'x'.repeat(31), WB_AUDIT_BUCKET_ID: 'not-hex' }, { WB_AUDIT_KEY_ID: '0051234567890000000000001', WB_AUDIT_APP_KEY: 'x'.repeat(31), WB_AUDIT_BUCKET_ID: 'b'.repeat(24) }]) {
    const r = run(env);
    assert.equal(r.status, 1, JSON.stringify(env));
    assert.match(r.stdout, /"ok":false/);
  }
});

test('카본 B1: with many old incidents the scan still returns the newest event, and nothing before the baseline', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-scan-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0), b2 = new FakeB2({ clock });
  for (let i = 0; i < 1200; i++) { b2.upload(R + `data/aa/p${i}`, 'A'); clock.advance(1); b2.upload(R + `data/aa/p${i}`, 'B'); clock.advance(1); }
  const baseline = clock.t;
  clock.advance(HOUR); const fresh = b2.upload(R + 'config', 'c1'); b2.upload(R + 'config', 'c2');
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const all = await f['prefix.scan']({ prefix: P, since: T0 });
  assert.equal(all.events.length, 1000); assert.equal(all.eventCount, 1201);
  assert.equal(all.events.at(-1).rel, 'config', 'the newest event is kept');
  const after = await f['prefix.scan']({ prefix: P, since: T0, from: baseline });
  assert.deepEqual(after.events.map((e) => e.rel), ['config']);
  assert.ok(fresh);
});

test('카본 B4: a continued restore keeps the moment before taken by its first listing', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-pre-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c'); b2.upload(R + 'snapshots/s1', 's1'); clock.advance(HOUR);
  const at = clock.t - 1; b2.hide(R + 'snapshots/s1'); clock.advance(HOUR);
  const before = Math.max(...b2.versions.map((v) => v.uploadTimestamp), clock.t - HOUR); // 카본 r7 B1 · 설계 관문 셋째 6
  // The first run lists, then stops on its first change.
  let calls = 0;
  const failing = (fn) => sessionOf(b2)((s) => fn(new Proxy(s, { get: (o, k) => (k === 'copyFile' && ++calls === 1 ? async () => { throw Object.assign(new Error('stop'), { code: 'B2' }); } : o[k]) })));
  const f1 = fileHandlers({ withSession: failing, bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  await assert.rejects(f1['restore.apply']({ prefix: P, at, runId: 'b4aaaaaaaaaaaaaa' }));
  clock.advance(HOUR); b2.upload(R + 'snapshots/s9', 'late');
  const f2 = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r = await f2['restore.apply']({ prefix: P, at, runId: 'b4aaaaaaaaaaaaaa', resume: true });
  assert.equal(r.preAt, before, 'the same job continued: the late write does not move it');
});

test('카본 B8: an upload and its hide in the same millisecond keep their order', () => {
  const at = T0 + HOUR;
  // B2 lists newest first: the hide, then the upload it hid.
  const v = [hide('snapshots/s1', at), up('snapshots/s1', 's', at)];
  const s = summarize(v, { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.equal(s.usage.visibleSnapshots, 0);
  assert.equal(s.usage.hiddenCount, 1);
});

test('GPT r6 GB1: an unfinished restore resumed three days later is still the same run — free, with its first moment before', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-pre3-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c'); b2.upload(R + 'snapshots/s1', 's1'); b2.upload(R + 'snapshots/s2', 's2'); clock.advance(HOUR);
  const at = clock.t - 1; b2.hide(R + 'snapshots/s1'); b2.hide(R + 'snapshots/s2'); clock.advance(HOUR);
  const before = Math.max(...b2.versions.map((v) => v.uploadTimestamp), clock.t - HOUR); // 카본 r7 B1 · 설계 관문 셋째 6
  let calls = 0;
  const failing = (fn) => sessionOf(b2)((s) => fn(new Proxy(s, { get: (o, k) => (k === 'copyFile' && ++calls === 2 ? async () => { throw Object.assign(new Error('stop'), { code: 'B2' }); } : o[k]) })));
  const f1 = fileHandlers({ withSession: failing, bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  await assert.rejects(f1['restore.apply']({ prefix: P, at })); // one copy made, then a stop
  clock.advance(3 * DAY);
  const f2 = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r = await f2['restore.apply']({ prefix: P, at, resume: true });
  assert.equal(r.preAt, before, 'the moment before the first run, not after its copy');
  const days = JSON.parse(fs.readFileSync(path.join(dir, 'restore-days.json'), 'utf8'));
  const today = new Date(clock.t).toISOString().slice(0, 10);
  assert.ok(days.day !== today || !days.counts?.[P], 'the resume was not counted as a new restore');
  // Finished, it is forgotten after two days: a later resume is a new restore.
  clock.advance(3 * DAY);
  await f2['restore.apply']({ prefix: P, at, resume: true });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'restore-days.json'), 'utf8')).counts[P], 1);
});

test('GPT r6 GB3: the first scan takes what there was to prune from the listing — a forged prune count does not cover hidden snapshots', () => {
  const v = [];
  for (let i = 0; i < 100; i++) v.push(up(`snapshots/s${i}`, `s${i}`, T0 - DAY));
  for (let i = 0; i < 100; i++) v.push(hide(`snapshots/s${i}`, T0 + HOUR));
  const s = summarize(v, { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.equal(s.window.snapshotsAtStart, 100);
  assert.ok(judge(s, { reported: { pruned: 100 }, now: T0 + DAY }).alerts.some((a) => a.reason === 'hide-surge' && a.vanished));
  // A new repository: 48 hourly snapshots made and 24 pruned in the window, as measured — quiet.
  const w = [];
  for (let i = 0; i < 48; i++) w.push(up(`snapshots/n${i}`, `n${i}`, T0 + i * HOUR));
  for (let i = 0; i < 24; i++) w.push(hide(`snapshots/n${i}`, T0 + (24 + i) * HOUR + 1));
  const fresh = summarize(w, { customerPrefix: P, since: T0 - 1, now: T0 + 2 * DAY });
  assert.equal(fresh.window.snapshotsAtStart, 0); assert.equal(fresh.window.snapshotUploads, 48);
  assert.equal(judge(fresh, { reported: { pruned: 24 }, now: T0 + 2 * DAY }).alerts.length, 0);
  // More hides than measured, still on the first scan: a surge.
  assert.ok(judge(fresh, { reported: { pruned: 10 }, now: T0 + 2 * DAY }).alerts.some((a) => a.reason === 'hide-surge'));
});

test('GPT r6 GD1 · GD2: the approved lifecycle rule is fixed here; the fake B2 refuses to copy a missing or hidden version', async () => {
  assert.deepEqual(EXPECTED_RULES, [{ fileNamePrefix: '', daysFromHidingToDeleting: 30, daysFromUploadingToHiding: null, daysFromStartingToCancelingUnfinishedLargeFiles: 1 }]);
  const clock = clockAt(T0), b2 = new FakeB2({ clock });
  const shortened = { ...b2.bucket, lifecycleRules: [{ ...b2.bucket.lifecycleRules[0], daysFromHidingToDeleting: 7 }] };
  const bucket = { bucketCount: 1, found: true, bucketType: shortened.bucketType, lifecycleRules: shortened.lifecycleRules, encryption: 'SSE-B2', replication: 0 };
  assert.ok(reconcile({ keys: [], bucket, bucketId: b2.bucketId }).problems.some((p) => p.kind === 'lifecycle'));
  await assert.rejects(b2.copyFile({ sourceFileId: 'missing', fileName: R + 'x' }));
  const h = b2.hide(R + 'snapshots/s1');
  await assert.rejects(b2.copyFile({ sourceFileId: h.fileId, fileName: R + 'snapshots/s1' }));
  assert.equal(b2.versions.length, 1, 'a refused copy adds nothing');
});

test('카본 r6 B4: a bad time does not use a day\'s restore; a run near the 29-day edge plans with its start; a run left unfinished stays free to continue', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-b4-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 40 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c', T0); b2.upload(R + 'snapshots/s1', 's1', T0);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  await assert.rejects(f['restore.apply']({ prefix: P, at: T0 }), { code: 'TOO_OLD' });
  assert.equal(fs.existsSync(path.join(dir, 'restore-days.json')), false, 'nothing counted');
  // A run that begins just inside the window and stops; resumed past the edge, it still plans.
  const at = clock.t - 29 * DAY + 60000;
  b2.hide(R + 'snapshots/s1');
  let calls = 0;
  const failing = (fn) => sessionOf(b2)((s) => fn(new Proxy(s, { get: (o, k) => (k === 'copyFile' && ++calls === 1 ? async () => { throw Object.assign(new Error('stop'), { code: 'B2' }); } : o[k]) })));
  await assert.rejects(fileHandlers({ withSession: failing, bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at }));
  clock.advance(2 * HOUR);
  const r = await f['restore.apply']({ prefix: P, at, resume: true });
  assert.equal(r.remaining, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'restore-days.json'), 'utf8')).counts[P], 1, 'one restore counted');
});

test('카본 r6 B6: a hide marker of our own restore clears the version it stood on', () => {
  const v = [up('data/aa/p1', 'AAAA', T0), hide('data/aa/p1', T0 + HOUR), hide('data/aa/p1', T0 + 2 * HOUR)];
  const s = summarize(v, { customerPrefix: P, since: T0, now: T0 + DAY, journal: { hides: [v[1].fileId] } });
  assert.equal(s.window.dataHiddenBytes, 0, 'the second marker hides nothing more');
});

test('카본 r6 B5: a database error in a tick is logged, not an unhandled rejection', async () => {
  const logs = [];
  let failNext = true;
  const store = new Proxy({}, { get: (_o, k) => (k === 'beat' ? () => { if (failNext) { failNext = false; throw Object.assign(new Error('busy'), { code: 'ERR_SQLITE_BUSY' }); } } : () => []) });
  const jobs = createJobs({ store, api: { serial: async (_c, fn) => fn(), finishPreparing: async () => null, runJob: async () => null }, keys: async () => ({}), files: async () => ({}), log: (e) => logs.push(e), now: () => T0 });
  const seen = [];
  const onRej = (e) => seen.push(e);
  process.on('unhandledRejection', onRej);
  try { jobs.start(); await new Promise((ok) => setTimeout(ok, 50)); } finally { jobs.stop(); process.off('unhandledRejection', onRej); }
  assert.equal(seen.length, 0);
  assert.ok(logs.some((l) => l.code === 'ERR_SQLITE_BUSY'));
});

test('카본 r6 C5: the api\'s restore cap matches the files worker\'s', async () => {
  const { LIMITS } = await import('../server.mjs');
  assert.equal(LIMITS.restoresPerDay, RESTORES_PER_DAY);
});

test('jobs 관문 둘: hides after the window\'s end are not in it', () => {
  const v = [up('snapshots/s1', 's1', T0), up('snapshots/s2', 's2', T0), hide('snapshots/s1', T0 + HOUR), hide('snapshots/s2', T0 + 3 * HOUR)];
  const s = summarize(v, { customerPrefix: P, since: T0, to: T0 + 2 * HOUR, now: T0 + 4 * HOUR });
  assert.equal(s.window.snapshotHides, 1);
  assert.equal(s.window.to, T0 + 2 * HOUR);
  assert.equal(s.usage.visibleSnapshots, 0, 'usage is as listed');
});

test('GPT r7 GB1: the same run asked again after its answer was lost gets what it did — not a second restore', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-replay-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c'); b2.upload(R + 'data/aa/p1', 'A'); clock.advance(HOUR);
  const at = clock.t - 1; b2.upload(R + 'data/aa/p1', 'B'); clock.advance(HOUR);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const first = await f['restore.apply']({ prefix: P, at, runId: 'abcdefghij012345' });
  clock.advance(HOUR);
  const later = b2.upload(R + 'data/aa/p1', 'C'); // a backup after the restore
  const calls = b2.calls.length;
  const again = await f['restore.apply']({ prefix: P, at, runId: 'abcdefghij012345' });
  assert.equal(b2.calls.length, calls, 'nothing copied or hidden again (GPT r8a GF1)');
  assert.equal(b2.versions.filter((v) => v.fileName === R + 'data/aa/p1').at(-1).fileId, later.fileId, 'the later backup stays the latest');
  assert.equal(again.replayed, true);
  assert.equal(again.preAt, first.preAt, 'the moment before the first run, not after its copy');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'restore-days.json'), 'utf8')).counts[P], 1);
  // Another run to the same time is a new restore.
  const third = await f['restore.apply']({ prefix: P, at, runId: 'abcdefghij999999' });
  assert.notEqual(third.replayed, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'restore-days.json'), 'utf8')).counts[P], 2);
  await assert.rejects(f['restore.apply']({ prefix: P, at, runId: 'BAD' }), { code: 'BAD_INPUT' });
});

test('GPT r7 GD1: a help bundle keeps only error codes the app and the server raise', () => {
  const b = cleanBundle({ errorCodes: ['CLIENT_ACME_PAYROLL_2026', 'secretproject', 'SCHEDULE_FOREIGN', 'NETWORK', 'REPO_EXISTS'] });
  assert.deepEqual(b.errorCodes, ['SCHEDULE_FOREIGN', 'NETWORK', 'REPO_EXISTS']);
});

test('카본 r7 D1 · D2: a Windows exit status is kept; a help bundle keeps runs from before a long stop', () => {
  const now = T0 + 40 * DAY;
  const b = cleanBatch({ runs: [{ startedAt: now - HOUR, result: 'failed', exitCode: -1073741510 }, { startedAt: now - 2 * HOUR, result: 'failed', exitCode: 3221225786 }] }, { now });
  assert.deepEqual(b.runs.map((r) => r.exitCode), [-1073741510, 3221225786]);
  const help = cleanBundle({ runs: [{ startedAt: now - 9 * DAY, result: 'failed' }, { startedAt: now - 31 * DAY, result: 'failed' }] }, { now });
  assert.equal(help.runs.length, 1, 'nine days back is kept, a month back is not');
  assert.equal(cleanBatch({ runs: [{ startedAt: now - 9 * DAY, result: 'failed' }] }, { now }).runs.length, 0, 'the hourly measurements keep their week');
});

test('카본 r7 D4: the fake lists names in byte order like B2', async () => {
  const b2 = new FakeB2({ clock: clockAt(T0) });
  b2.upload('c/x/r_1', 'a'); b2.upload('c/x/r/1', 'b');
  assert.deepEqual((await b2.listFileVersions({ prefix: 'c/x/' })).map((v) => v.fileName), ['c/x/r/1', 'c/x/r_1']);
});

test('카본 r7 B1: the moment before a restore stays inside the 29 days when the last backup is older', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-preat-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 40 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c', T0); b2.upload(R + 'data/aa/p1', 'A', T0);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r = await f['restore.apply']({ prefix: P, at: clock.t - HOUR, runId: 'b1aaaaaaaaaaaaaa' });
  assert.ok(r.preAt >= clock.t - HOUR && r.preAt < clock.t, 'not the upload of forty days ago');
  clock.advance(HOUR);
  const undo = await f['restore.apply']({ prefix: P, at: r.preAt, runId: 'b1bbbbbbbbbbbbbb', undoOf: 'b1aaaaaaaaaaaaaa' });
  assert.equal(undo.remaining, 0);
  // An empty folder too.
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-preat-')); t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const e = fileHandlers({ withSession: sessionOf(new FakeB2({ clock })), bucketId: b2.bucketId, stateDir: empty, now: () => clock.t });
  assert.ok((await e['restore.apply']({ prefix: P, at: clock.t - HOUR })).preAt >= clock.t - HOUR);
});

test('카본 r7 B3 · B5: a new change gets its own days left; an unseen change older than the window is no new alert', () => {
  const now = T0 + 20 * DAY + HOUR;
  const v = [up('data/aa/p1', 'AAAA', T0), up('data/aa/p1', 'BBBB', T0 + HOUR), up('data/aa/p2', 'CCCC', T0), up('data/aa/p2', 'DDDD', T0 + 20 * DAY)];
  const s = summarize(v, { customerPrefix: P, since: T0, now });
  const old = s.events.find((e) => e.at === T0 + HOUR);
  const j = judge(s, { seen: (id) => id === old.fileId, now });
  assert.equal(j.alerts.find((a) => a.reason === 'content').daysLeft, WINDOW_DAYS, 'the new overwrite of today, not the one of twenty days ago');
  const later = T0 + 31 * DAY;
  const late = judge(summarize(v.slice(0, 2), { customerPrefix: P, since: T0, now: later }), { now: later });
  assert.ok(!late.alerts.some((a) => a.reason === 'content'), 'thirty days old: it can no longer be undone');
});

test('카본 r7 B5: with more than 1,000 changes the ones in between are named, to be marked seen', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-between-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + DAY), b2 = new FakeB2({ clock });
  for (let i = 0; i < 1200; i++) b2.upload(R + `data/aa/q${i}`, `a${i}`.padEnd(8, '.'), T0);
  for (let i = 0; i < 1200; i++) b2.upload(R + `data/aa/q${i}`, `b${i}`.padEnd(8, '.'), T0 + HOUR);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r = await f['prefix.scan']({ prefix: P, since: T0 });
  assert.equal(r.eventCount, 1200); assert.equal(r.events.length, 1000); assert.equal(r.between.length, 200);
  assert.equal(new Set([...r.events.map((e) => e.fileId), ...r.between.map(([id]) => id)]).size, 1200);
});

test('카본 r7 C5: a worker code with digits comes back as it is', async (t) => {
  const clock = clockAt(), now = () => clock.t, secret = crypto.randomBytes(32).toString('hex');
  const srv = rpcServer({ secret, now, handlers: { 'x.fail': async () => { throw Object.assign(new Error('x'), { code: 'B2_BAD_RESPONSE' }); } } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); t.after(() => srv.close());
  await assert.rejects(rpcClient({ url: `http://127.0.0.1:${srv.address().port}/rpc`, secret, now })('x.fail'), { code: 'B2_BAD_RESPONSE' });
});

// ── 설계 관문 셋째(Fable 5.2 「고쳐서 간다」, 11-16 밤): the restore ledger by run ids and the prefix's chain.
const ledgerOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'restore-days.json'), 'utf8'));
const latestSha = (b2, rel) => b2.versions.filter((v) => v.fileName === R + rel).at(-1);
const failOn = (b2, nth) => { let calls = 0; return (fn) => sessionOf(b2)((s) => fn(new Proxy(s, { get: (o, k) => (k === 'copyFile' && ++calls === nth ? async () => { throw Object.assign(new Error('stop'), { status: 503 }); } : o[k]) }))); };
const twoFiles = (b2, clock) => {
  b2.upload(R + 'config', 'c'); b2.upload(R + 'data/aa/p1', 'x1'); b2.upload(R + 'data/aa/p2', 'x2');
  clock.advance(HOUR);
  const at = clock.t - 30 * 60000;
  b2.upload(R + 'data/aa/p1', 'y1'); b2.upload(R + 'data/aa/p2', 'y2'); clock.advance(HOUR);
  return at;
};

test('설계 관문 셋째 1: a restore asked again after a failure, to another time, keeps the chain\'s moment before — its undo goes back to before the first run', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-chain-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  const at = twoFiles(b2, clock);
  await assert.rejects(fileHandlers({ withSession: failOn(b2, 2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'chain00000000001' }));
  clock.advance(10 * 60000);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r2 = await f['restore.apply']({ prefix: P, at: at + 60000, runId: 'chain00000000002' });
  assert.equal(latestSha(b2, 'data/aa/p1').contentSha1, sha('x1'));
  clock.advance(10 * 60000);
  await f['restore.apply']({ prefix: P, at: r2.preAt, runId: 'chain00000000003', undoOf: 'chain00000000002' });
  assert.equal(latestSha(b2, 'data/aa/p1').contentSha1, sha('y1'), 'back to before the first, failed run');
  assert.equal(latestSha(b2, 'data/aa/p2').contentSha1, sha('y2'));
  assert.equal(ledgerOf(dir).counts[P], 2, 'two restores; the undo free');
});

test('설계 관문 셋째 1: once a backup ran after a failed restore, the next restore starts a new chain — its undo keeps that backup', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-chain2-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  const at = twoFiles(b2, clock);
  await assert.rejects(fileHandlers({ withSession: failOn(b2, 2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'chain00000000011' }));
  clock.advance(HOUR);
  b2.upload(R + 'snapshots/s9', 'a backup after the failure'); clock.advance(HOUR);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r2 = await f['restore.apply']({ prefix: P, at: at + 60000, runId: 'chain00000000012' });
  assert.equal(latestSha(b2, 'snapshots/s9').action, 'hide');
  await f['restore.apply']({ prefix: P, at: r2.preAt, runId: 'chain00000000013', undoOf: 'chain00000000012' });
  assert.equal(latestSha(b2, 'snapshots/s9').action, 'upload', 'the backup made on top is back');
});

test('설계 관문 셋째 2: a failed undo chosen again continues free; an undo to another time than the moment before counts', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-undo-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  const at = twoFiles(b2, clock);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r = await f['restore.apply']({ prefix: P, at, runId: 'undo000000000001' });
  clock.advance(10 * 60000);
  await assert.rejects(fileHandlers({ withSession: failOn(b2, 2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at: r.preAt, runId: 'undo000000000002', undoOf: 'undo000000000001' }));
  await f['restore.apply']({ prefix: P, at: r.preAt, runId: 'undo000000000003', undoOf: 'undo000000000001' });
  assert.equal(latestSha(b2, 'data/aa/p1').contentSha1, sha('y1'));
  assert.equal(ledgerOf(dir).counts[P], 1, 'the undo and its continuation are free');
  // A claimed undo of a run that is not the last finished one, or to another time, counts.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-undo2-')); t.after(() => fs.rmSync(dir2, { recursive: true, force: true }));
  const g = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir2, now: () => clock.t });
  const r1 = await g['restore.apply']({ prefix: P, at, runId: 'undo000000000011' });
  clock.advance(10 * 60000);
  const bogus = await g['restore.apply']({ prefix: P, at: r1.preAt, runId: 'undo000000000012', undoOf: 'undo000000000099' });
  assert.equal(ledgerOf(dir2).counts[P], 2, 'back to the moment before, but not the undo of that run');
  clock.advance(10 * 60000);
  await g['restore.apply']({ prefix: P, at: bogus.preAt - 1, runId: 'undo000000000013', undoOf: 'undo000000000012' });
  assert.equal(ledgerOf(dir2).counts[P], 3, 'the undo of that run, but to another time');
});

test('설계 관문 셋째 6: with B2\'s clock 20 or 90 minutes behind ours, the undo still takes the restore back', async (t) => {
  for (const lag of [20 * 60000, 90 * 60000]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-lag-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock: { get t() { return clock.t - lag; } } });
    b2.upload(R + 'config', 'c'); b2.upload(R + 'data/aa/p1', 'x1');
    clock.advance(2 * HOUR); const at = clock.t - lag - 1;
    b2.upload(R + 'data/aa/p1', 'y1'); clock.advance(3 * HOUR);
    const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
    const r = await f['restore.apply']({ prefix: P, at, runId: 'lag0000000000001' });
    assert.equal(latestSha(b2, 'data/aa/p1').contentSha1, sha('x1'));
    assert.ok(r.preAt < latestSha(b2, 'data/aa/p1').uploadTimestamp, `${lag / 60000} minutes: before our own copy in B2's time`);
    clock.advance(10 * 60000);
    await f['restore.apply']({ prefix: P, at: r.preAt, runId: 'lag0000000000002', undoOf: 'lag0000000000001' });
    assert.equal(latestSha(b2, 'data/aa/p1').contentSha1, sha('y1'), `${lag / 60000} minutes: undone`);
  }
});

test('설계 관문 셋째 7: a second run on the same prefix while one runs is refused BUSY', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-busy-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  const at = twoFiles(b2, clock);
  let release; const gate = new Promise((ok) => { release = ok; });
  const slow = (fn) => sessionOf(b2)((s) => fn(new Proxy(s, { get: (o, k) => (k === 'copyFile' ? async (a) => { await gate; return o.copyFile(a); } : o[k]) })));
  const f = fileHandlers({ withSession: slow, bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const first = f['restore.apply']({ prefix: P, at, runId: 'busy000000000001' });
  const second = f['restore.apply']({ prefix: P, at, runId: 'busy000000000002' });
  setTimeout(release, 50); // without the refusal the second would wait for the same copies
  await assert.rejects(second, { code: 'BUSY' });
  assert.equal((await first).remaining, 0);
  assert.equal(ledgerOf(dir).counts[P], 1);
});

test('도움 요청 부호 목록: every error code the engine, the worker and the window raise is in KNOWN_ERROR_CODES (a new one is added there)', () => {
  const app = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = [];
  // This UI fixture deliberately includes external installer exit codes. The
  // application never loads it; only production emitters belong in this check.
  const fixture = path.join(app, 'ui', 'engine-fixtures.js');
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (!['tests', 'test', 'node_modules'].includes(e.name)) walk(f); } else if (f !== fixture && /\.(c|m)?js$/.test(e.name)) files.push(f); } };
  for (const d of ['engine/src', 'worker', 'ui']) {
    const before = files.length;
    assert.ok(fs.existsSync(path.join(app, d)), `${d} is where the codes are looked for (카본 끝판 F1)`);
    walk(path.join(app, d));
    assert.ok(files.length > before, `${d} was read`);
  }
  const missing = new Set();
  const shapes = [/code:\s*'([A-Z][A-Z0-9_]{1,40})'/g, /(?:failure|err|ServerError)\(\s*'([A-Z][A-Z0-9_]{1,40})'/g];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    // `EXIT_<number>` is an installer's exit code in a program's reinstall result (move-service.cjs), not a code anything
    // raises; the window's sample results write it in the same shape.
    for (const re of shapes) for (const m of text.matchAll(re)) if (!KNOWN_ERROR_CODES.has(m[1]) && !/^EXIT_\d+$/.test(m[1])) missing.add(`${m[1]} (${path.relative(app, f)})`);
  }
  assert.deepEqual([...missing], []);
});

// ── r8a 검수(11-16 밤)
test('카본 r8a B1: snapshots made and all hidden inside the first window are "vanished"', () => {
  const v = [up('config', 'c', T0), up('snapshots/s1', 's1', T0 + HOUR), up('snapshots/s2', 's2', T0 + 2 * HOUR), hide('snapshots/s1', T0 + 3 * HOUR), hide('snapshots/s2', T0 + 3 * HOUR)];
  const s = summarize(v, { customerPrefix: P, since: T0 + 30 * 60000, now: T0 + DAY });
  assert.equal(s.window.snapshotsAtStart, 0);
  assert.ok(judge(s, { previousSnapshots: null, reported: { pruned: 2 }, now: T0 + DAY }).alerts.some((a) => a.vanished));
});

test('카본 r8a B3: a burst before the baseline does not hold back the next one after it; the hour the baseline falls in suggests just after it', () => {
  const many = (start, n) => [...Array(n)].flatMap((_, i) => [up(`snapshots/b${start}-${i}`, `x${i}`, T0), hide(`snapshots/b${start}-${i}`, start + i)]);
  const baseline = T0 + 14 * HOUR + 30 * 60000;
  const s = summarize([...many(T0 + 14 * HOUR + 10 * 60000, 50), ...many(T0 + 15 * HOUR + 10 * 60000, 50)], { customerPrefix: P, since: T0, now: T0 + 16 * HOUR });
  const c = suggest(s, { baseline, now: T0 + 16 * HOUR });
  assert.ok(c.some((x) => x.reason === 'before-mass-hide' && x.at === T0 + 15 * HOUR + 10 * 60000 - 1000), 'the burst after the restore');
  const s2 = summarize([...many(T0 + 14 * HOUR + 10 * 60000, 1), ...many(T0 + 14 * HOUR + 45 * 60000, 50)], { customerPrefix: P, since: T0, now: T0 + 16 * HOUR, hourlyFrom: baseline });
  const c2 = suggest(s2, { baseline, now: T0 + 16 * HOUR });
  assert.deepEqual(c2.filter((x) => x.reason === 'before-mass-hide').map((x) => x.at), [T0 + 14 * HOUR + 45 * 60000 - 1000], 'the burst in the baseline hour, by its own first hide');
  // GPT r9 GA1 · 카본 r9 A1: a burst only before the baseline suggests nothing; with a new one the first candidate is the new one.
  const s3 = summarize(many(T0 + 14 * HOUR + 10 * 60000, 50), { customerPrefix: P, since: T0, now: T0 + 16 * HOUR, hourlyFrom: baseline });
  assert.deepEqual(suggest(s3, { baseline, now: T0 + 16 * HOUR }).filter((x) => x.reason === 'before-mass-hide'), []);
  const s4 = summarize([...many(T0 + 14 * HOUR + 10 * 60000, 50), ...many(T0 + 15 * HOUR + 10 * 60000, 50)], { customerPrefix: P, since: T0, now: T0 + 16 * HOUR, hourlyFrom: baseline });
  assert.equal(suggest(s4, { baseline, now: T0 + 16 * HOUR })[0].at, T0 + 15 * HOUR + 10 * 60000 - 1000, 'the default candidate is the new burst');
});

test('GPT r8a GC1: a malformed rpc message is refused and the worker keeps running', async (t) => {
  const clock = clockAt(), now = () => clock.t, secret = crypto.randomBytes(32).toString('hex');
  const srv = rpcServer({ secret, now, handlers: { 'x.echo': async (p) => p } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); t.after(() => srv.close());
  const url = `http://127.0.0.1:${srv.address().port}/rpc`;
  for (const body of ['{"method":{"toString":null}}', '[]', 'null', '{"method":1}']) {
    const r = await fetch(url, { method: 'POST', body, headers: { 'x-wb-ts': String(now()), 'x-wb-id': 'r'.repeat(20), 'x-wb-sig': 'bad' } });
    assert.equal(r.status, 400, body);
  }
  assert.deepEqual(await rpcClient({ url, secret, now })('x.echo', { a: 1 }), { a: 1 }, 'still answering');
});

test('카본 r8a E1 · E2: the fake B2 refuses what B2 refuses — hiding a hidden or missing name, deleting a missing key', async () => {
  const b2 = new FakeB2({ clock: clockAt(T0) });
  await assert.rejects(b2.hideFile({ fileName: R + 'nothing' }), { status: 400 });
  b2.upload(R + 'snapshots/s1', 's1');
  await b2.hideFile({ fileName: R + 'snapshots/s1' });
  await assert.rejects(b2.hideFile({ fileName: R + 'snapshots/s1' }), { status: 400 });
  await assert.rejects(b2.deleteKey('no-such-key'), { status: 400 });
});

test('GPT r9 GA1: the files worker counts the candidate hours from the baseline it is given', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-hours-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 16 * HOUR), b2 = new FakeB2({ clock });
  for (let i = 0; i < 50; i++) { b2.upload(R + `snapshots/o${i}`, `o${i}`, T0); b2.hide(R + `snapshots/o${i}`, T0 + 14 * HOUR + 10 * 60000 + i); }
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const before = await f['prefix.scan']({ prefix: P, since: T0, from: 0 });
  const after = await f['prefix.scan']({ prefix: P, since: T0, from: T0 + 14 * HOUR + 30 * 60000 });
  assert.equal(before.hourly.reduce((n, h) => n + h.count, 0), 50);
  assert.equal(after.hourly.length, 0, 'the hides before the last restore are history');
});

test('카본 r10a A1: hides that began within a second of the baseline still give a candidate between the two', () => {
  const many = (start, n) => [...Array(n)].flatMap((_, i) => [up(`snapshots/q${start}-${i}`, `x${i}`, T0), hide(`snapshots/q${start}-${i}`, start + i)]);
  const baseline = T0 + 14 * HOUR + 30 * 60000;
  const s = summarize([...many(baseline + 500, 50), ...many(T0 + 15 * HOUR + 10 * 60000, 50)], { customerPrefix: P, since: T0, now: T0 + 16 * HOUR, hourlyFrom: baseline });
  const c = suggest(s, { baseline, now: T0 + 16 * HOUR }).filter((x) => x.reason === 'before-mass-hide');
  assert.deepEqual(c.map((x) => x.at), [baseline + 1], 'just after the baseline, before the first hide; the next hour is the same run');
  const s2 = summarize([...many(baseline + 1, 50), ...many(T0 + 15 * HOUR + 10 * 60000, 50)], { customerPrefix: P, since: T0, now: T0 + 16 * HOUR, hourlyFrom: baseline });
  assert.deepEqual(suggest(s2, { baseline, now: T0 + 16 * HOUR }).filter((x) => x.reason === 'before-mass-hide').map((x) => x.at), [T0 + 15 * HOUR + 10 * 60000 - 1000], 'no room right after the baseline: the next hour is not held back');
});

// ── 끝판 검수(11-16 밤)
test('GPT 끝판 GC1 · 카본 끝판 C2: a run left unfinished changes nothing once B2 may have deleted what it needs; a finished one keeps its answer 29 days from when it finished', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-old-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 40 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c', T0 + 11 * DAY); b2.upload(R + 'data/aa/p1', 'x1', T0 + 11 * DAY); b2.upload(R + 'data/aa/p2', 'x2', T0 + 11 * DAY);
  const at = T0 + 12 * DAY; // 28 days back
  b2.upload(R + 'data/aa/p1', 'y1', T0 + 13 * DAY); b2.upload(R + 'data/aa/p2', 'y2', T0 + 13 * DAY);
  await assert.rejects(fileHandlers({ withSession: failOn(b2, 2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'old0000000000001' }));
  clock.advance(2 * DAY); // 30 days back now
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const calls = b2.calls.length;
  await assert.rejects(f['restore.apply']({ prefix: P, at, runId: 'old0000000000001' }), { code: 'TOO_OLD' });
  assert.equal(b2.calls.length, calls, 'nothing copied or hidden');
  // A run finished near the edge keeps its answer for a retry long after it began.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-old2-')); t.after(() => fs.rmSync(dir2, { recursive: true, force: true }));
  const clock2 = clockAt(T0 + 40 * DAY), b3 = new FakeB2({ clock: clock2 });
  b3.upload(R + 'config', 'c', T0 + 11 * DAY); b3.upload(R + 'data/aa/p1', 'x1', T0 + 11 * DAY); b3.upload(R + 'data/aa/p2', 'x2', T0 + 11 * DAY);
  b3.upload(R + 'data/aa/p1', 'y1', T0 + 13 * DAY); b3.upload(R + 'data/aa/p2', 'y2', T0 + 13 * DAY);
  await assert.rejects(fileHandlers({ withSession: failOn(b3, 2), bucketId: b3.bucketId, stateDir: dir2, now: () => clock2.t })['restore.apply']({ prefix: P, at, runId: 'old0000000000002' }));
  clock2.advance(DAY); // 29 days back: still continued
  const g = fileHandlers({ withSession: sessionOf(b3), bucketId: b3.bucketId, stateDir: dir2, now: () => clock2.t });
  assert.equal((await g['restore.apply']({ prefix: P, at, runId: 'old0000000000002' })).remaining, 0);
  clock2.advance(28 * DAY);
  assert.equal((await g['restore.apply']({ prefix: P, at, runId: 'old0000000000002' })).replayed, true, 'its answer is kept from when it finished');
});

test('카본 끝판 C3: after a failed undo and backups on top, a restore to the same time is a new restore — it counts, and its own undo is free', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-c3-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  const at = twoFiles(b2, clock);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r1 = await f['restore.apply']({ prefix: P, at, runId: 'c3aaaaaaaaaaaaa1' });
  clock.advance(10 * 60000);
  await assert.rejects(fileHandlers({ withSession: failOn(b2, 2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at: r1.preAt, runId: 'c3aaaaaaaaaaaaa2', undoOf: 'c3aaaaaaaaaaaaa1' }));
  clock.advance(HOUR); b2.upload(R + 'snapshots/s9', 'a backup after the customer kept it'); clock.advance(HOUR);
  const r2 = await f['restore.apply']({ prefix: P, at: r1.preAt, runId: 'c3aaaaaaaaaaaaa3' });
  assert.equal(ledgerOf(dir).counts[P], 2, 'a new restore');
  assert.equal(ledgerOf(dir).started[P].undo, undefined);
  clock.advance(10 * 60000);
  await f['restore.apply']({ prefix: P, at: r2.preAt, runId: 'c3aaaaaaaaaaaaa4', undoOf: 'c3aaaaaaaaaaaaa3' });
  assert.equal(ledgerOf(dir).counts[P], 2, 'its undo is free');
});

test('카본 끝판 C4: a B2 session renewed in the middle of a round retries that one call, not the round', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-c4-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  const at = twoFiles(b2, clock);
  const { lazySession } = await import('../keys-worker.mjs');
  const { B2Error } = await import('../b2-native.mjs');
  let copies = 0, expired = false;
  const authorizeImpl = async () => new Proxy(b2, { get: (o, k) => (k === 'copyFile' ? async (a) => { if (++copies === 2 && !expired) { expired = true; throw new B2Error(401, 'expired_auth_token'); } return o.copyFile(a); } : o[k]) });
  const withSession = lazySession({}, { authorizeImpl });
  const f = fileHandlers({ withSession, bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const before = b2.versions.length;
  const r = await f['restore.apply']({ prefix: P, at, runId: 'c4aaaaaaaaaaaaa1' });
  assert.equal(r.remaining, 0);
  assert.equal(b2.versions.length - before, 2, 'two copies, none made twice');
});

test('카본 끝판 B1 · B2 · D3: the same bytes put back after a restore hid them are a change; a change within a second of the baseline still gets a candidate; operator alerts are once a day', () => {
  const evil = up('keys/evil', 'evil', T0 + 2 * DAY);
  const ourHide = hide('keys/evil', T0 + 3 * DAY);
  const again = { ...up('keys/evil', 'evil', T0 + 4 * DAY) };
  const s = summarize([up('keys/k1', 'k', T0), evil, ourHide, again], { customerPrefix: P, since: T0, now: T0 + 5 * DAY, journal: { hides: [ourHide.fileId] } });
  assert.ok(s.events.some((e) => e.fileId === again.fileId), 'put back after our hide');
  const c = suggest({ events: [{ kind: 'overwrite', fileId: 'f1', rel: 'data/a', at: 10500 }, { kind: 'overwrite', fileId: 'f2', rel: 'data/b', at: 20000 }], hourly: [] }, { baseline: 10000, now: 50000 });
  assert.deepEqual(c.map((x) => x.at), [10001]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-alerts-'));
  const store = new Store(path.join(dir, 'wb.sqlite'));
  try {
    assert.ok(store.addAlert({ kind: 'reconcile', audience: 'operator' }));
    assert.equal(store.addAlert({ kind: 'reconcile', audience: 'operator' }), null);
  } finally { store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('GPT r13 GA1: a continued run that crosses 29.5 days — while listing, or between two copies — changes nothing more', async (t) => {
  const setup = (name) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), name)); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const clock = clockAt(T0 + 40 * DAY), b2 = new FakeB2({ clock });
    b2.upload(R + 'config', 'c', T0 + 11 * DAY); b2.upload(R + 'data/aa/p1', 'x1', T0 + 11 * DAY); b2.upload(R + 'index/i1', 'i-x', T0 + 11 * DAY);
    b2.upload(R + 'data/aa/p1', 'y1', T0 + 13 * DAY); b2.upload(R + 'index/i1', 'i-y', T0 + 13 * DAY);
    return { dir, clock, b2 };
  };
  const at = T0 + 12 * DAY;
  const changes = (b2) => b2.calls.filter((c) => c[0] === 'copyFile' || c[0] === 'hideFile').length;
  // Crossing while the listing runs.
  {
    const { dir, clock, b2 } = setup('wb-ga1a-');
    await assert.rejects(fileHandlers({ withSession: failOn(b2, 1), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'ga1a000000000001' }));
    clock.t = at + 29.4 * DAY;
    const slowList = (fn) => sessionOf(b2)((s) => fn(new Proxy(s, { get: (o, k) => (k === 'listFileVersions' ? async (a) => { const r = await o.listFileVersions(a); clock.advance(0.2 * DAY); return r; } : o[k]) })));
    const before = changes(b2);
    await assert.rejects(fileHandlers({ withSession: slowList, bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'ga1a000000000001' }), { code: 'TOO_OLD' });
    assert.equal(changes(b2), before, 'no copy or hide after the line');
  }
  // Crossing between the data copy and the index copy.
  {
    const { dir, clock, b2 } = setup('wb-ga1b-');
    await assert.rejects(fileHandlers({ withSession: failOn(b2, 1), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'ga1b000000000001' }));
    clock.t = at + 29.45 * DAY;
    const slowCopy = (fn) => sessionOf(b2)((s) => fn(new Proxy(s, { get: (o, k) => (k === 'copyFile' ? async (a) => { const r = await o.copyFile(a); clock.advance(0.1 * DAY); return r; } : o[k]) })));
    const before = changes(b2);
    await assert.rejects(fileHandlers({ withSession: slowCopy, bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'ga1b000000000001' }), { code: 'TOO_OLD' });
    assert.equal(changes(b2) - before, 1, 'the data copy made before the line, nothing after it');
    assert.equal(latestSha(b2, 'index/i1').contentSha1, sha('i-y'), 'the index is not copied back past the line');
  }
});

test('GPT r14 GA1: a call made again after a renewed B2 sign-in that crossed 29.5 days is refused too', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-r14-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 40 * DAY), b2 = new FakeB2({ clock });
  b2.upload(R + 'config', 'c', T0 + 11 * DAY); b2.upload(R + 'data/aa/p1', 'x1', T0 + 11 * DAY);
  b2.upload(R + 'data/aa/p1', 'y1', T0 + 13 * DAY);
  const at = T0 + 12 * DAY;
  await assert.rejects(fileHandlers({ withSession: failOn(b2, 1), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'r14a000000000001' }));
  clock.t = at + 29.5 * DAY - 1000; // a second before the line
  const { lazySession } = await import('../keys-worker.mjs');
  const { B2Error } = await import('../b2-native.mjs');
  let signIns = 0, expired = false;
  const authorizeImpl = async () => {
    if (signIns++) clock.advance(2000); // the renewed sign-in takes two seconds: past the line
    return new Proxy(b2, { get: (o, k) => (k === 'copyFile' ? async (a) => { if (!expired) { expired = true; throw new B2Error(401, 'expired_auth_token'); } return o.copyFile(a); } : o[k]) });
  };
  const copies = b2.calls.filter((c) => c[0] === 'copyFile').length;
  const f = fileHandlers({ withSession: lazySession({}, { authorizeImpl }), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  await assert.rejects(f['restore.apply']({ prefix: P, at, runId: 'r14a000000000001' }), { code: 'TOO_OLD' });
  assert.equal(signIns, 2, 'the sign-in was renewed');
  assert.equal(b2.calls.filter((c) => c[0] === 'copyFile').length, copies, 'nothing copied after the line');
});

// ── Fable 5.2 설계 관문 넷째(files-worker 29.5일, 11-16 밤)
test('설계 관문 넷째 2: wherever the 29.5-day line is crossed — sign-in, listing, a copy, a renewed sign-in, a hide — B2 gets no copy or hide past it, and nothing but copies, hides and listings', async (t) => {
  const at = T0 + 12 * DAY, LIMIT = 29.5 * DAY;
  const { lazySession } = await import('../keys-worker.mjs');
  const { B2Error } = await import('../b2-native.mjs');
  const allowed = new Set(['listFileVersions', 'copyFile', 'hideFile']);
  const outcomes = new Set();
  for (let before = 500; before <= 14500; before += 1000) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-gate4-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const clock = clockAt(T0 + 40 * DAY), b2 = new FakeB2({ clock });
    b2.upload(R + 'config', 'c', T0 + 11 * DAY);
    for (const n of ['p1', 'p2', 'p3']) b2.upload(R + `data/aa/${n}`, `x-${n}`, T0 + 11 * DAY);
    b2.upload(R + 'index/i1', 'i-x', T0 + 11 * DAY); b2.upload(R + 'snapshots/s1', 's1', T0 + 11 * DAY);
    for (const n of ['p1', 'p2', 'p3']) b2.upload(R + `data/aa/${n}`, `y-${n}`, T0 + 13 * DAY);
    b2.upload(R + 'index/i1', 'i-y', T0 + 13 * DAY); b2.upload(R + 'snapshots/s2', 's2', T0 + 13 * DAY);
    // A first run that stopped at its first copy: the next call continues it.
    await assert.rejects(fileHandlers({ withSession: failOn(b2, 1), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t })['restore.apply']({ prefix: P, at, runId: 'gate400000000001' }));
    clock.t = at + LIMIT - before;
    const bad = [];
    let expired = false;
    // Every call takes a second; the first copy meets an expired token and the session signs in again.
    const authorizeImpl = async () => {
      clock.advance(1000);
      return new Proxy(b2, { get: (o, k) => {
        if (typeof o[k] !== 'function') return o[k];
        if (!allowed.has(k)) return () => { bad.push(`${String(k)} called`); throw new Error('NOT_ALLOWED'); };
        return async (a, opts) => {
          opts?.beforeAttempt?.(); // what B2Session.call does before each attempt
          if (k !== 'listFileVersions' && clock.t - at > LIMIT) bad.push(`${k} ${clock.t - at - LIMIT}ms past the line`);
          clock.advance(1000);
          if (k === 'copyFile' && !expired) { expired = true; throw new B2Error(401, 'expired_auth_token'); }
          return o[k](a);
        };
      } });
    };
    const f = fileHandlers({ withSession: lazySession({}, { authorizeImpl }), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
    try { const r = await f['restore.apply']({ prefix: P, at, runId: 'gate400000000001' }); assert.equal(r.remaining, 0); outcomes.add('done'); }
    catch (e) { assert.equal(e.code, 'TOO_OLD', `${before}ms before the line: ${e.message}`); outcomes.add('too-old'); }
    assert.deepEqual(bad, [], `${before}ms before the line`);
  }
  assert.deepEqual([...outcomes].sort(), ['done', 'too-old'], 'the runs crossed the line at different points, and some finished in time');
});

test('설계 관문 넷째 3: a B2 call checks before every attempt, so a retry that would go out past the line does not', async () => {
  const { B2Session } = await import('../b2-native.mjs');
  let fetches = 0;
  const fetchImpl = async () => { fetches++; return new Response(JSON.stringify({ code: 'service_unavailable', message: 'busy' }), { status: 503 }); };
  const s = new B2Session({ accountId: 'a', token: 't', apiUrl: 'https://api.example', allowed: {}, fetchImpl, timeoutMs: 1000 });
  let checks = 0;
  const beforeAttempt = () => { if (++checks === 2) throw Object.assign(new Error('TOO_OLD'), { code: 'TOO_OLD' }); };
  await assert.rejects(s.copyFile({ sourceFileId: 'f', fileName: 'n' }, { beforeAttempt }), { code: 'TOO_OLD' });
  assert.equal(fetches, 1, 'the retry did not go out');
  checks = 0; fetches = 0;
  await assert.rejects(s.hideFile({ bucketId: 'b', fileName: 'n' }, { beforeAttempt }), { code: 'TOO_OLD' });
  assert.equal(fetches, 1);
});

// ── 둘째 끝판 검수(11-16 밤)
test('설계 관문 둘 · 카본 끝판2 C1: a large data hide alerts without waiting for measurements; only the device confirming stops it', () => {
  const summary = { events: [], usage: { visibleBytes: 1024 ** 3, visibleSnapshots: 3 }, window: { from: T0, to: T0 + DAY, snapshotHides: 0, dataHiddenBytes: 3 * 1024 ** 3, snapshotsAtStart: 3, snapshotUploads: 0 } };
  assert.equal(judge(summary, { baseline: 0, reported: null, previousSnapshots: 3, now: T0 + DAY }).alerts[0]?.reason, 'hide-surge');
  assert.deepEqual(judge(summary, { baseline: 0, reported: { runs: 1, pruned: 0, massConfirmed: true }, previousSnapshots: 3, now: T0 + DAY }).alerts, []);
});

test('카본 끝판2 C3: an undo that finished here but whose answer was lost, asked again by a new job, answers what it did — free, nothing changed again', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-undo-replay-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = clockAt(T0 + 10 * DAY), b2 = new FakeB2({ clock });
  const at = twoFiles(b2, clock);
  const f = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  const r1 = await f['restore.apply']({ prefix: P, at, runId: 'c3bbbbbbbbbbbbb1' });
  clock.advance(10 * 60000);
  await f['restore.apply']({ prefix: P, at: r1.preAt, runId: 'c3bbbbbbbbbbbbb2', undoOf: 'c3bbbbbbbbbbbbb1' });
  const versions = b2.versions.length;
  clock.advance(60000);
  const again = await f['restore.apply']({ prefix: P, at: r1.preAt, runId: 'c3bbbbbbbbbbbbb3', undoOf: 'c3bbbbbbbbbbbbb1' });
  assert.equal(again.replayed, true);
  assert.equal(b2.versions.length, versions, 'nothing copied or hidden again');
  assert.equal(ledgerOf(dir).counts[P], 1, 'one restore; its undo free, once');
});

test('listen host: unset is all addresses, a set value must be one IPv4 literal', () => {
  assert.equal(listenHost({}), '0.0.0.0');
  assert.equal(listenHost({ WB_HOST: '' }), '0.0.0.0');
  assert.equal(listenHost({ WB_HOST: '172.30.77.9' }), '172.30.77.9');
  assert.equal(listenHost({ WB_HOST: '127.0.0.1' }), '127.0.0.1');
  for (const bad of ['localhost', '256.0.0.1', '172.30.77.9 ', '::1', '1.2.3', '1.2.3.4.5']) assert.throws(() => listenHost({ WB_HOST: bad }), /CONFIG_INVALID:WB_HOST/);
});
