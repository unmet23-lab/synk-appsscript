// Unit checks of the provisioning server's pure parts and worker guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarize, judge, suggest, DAY, HOUR } from '../detect.mjs';
import { reconcile, EXPECTED_RULES } from '../reconcile.mjs';
import { rpcClient, rpcServer } from '../rpc.mjs';
import { keyHandlers, WRITE_CAPS, DAILY_CAP } from '../keys-worker.mjs';
import { fileHandlers, RESTORES_PER_DAY } from '../files-worker.mjs';
import { createVerifier } from '../google-token.mjs';
import { createMailer, signRequest, SIGNED_TAG } from '../mail.mjs';
import { cleanBatch } from '../telemetry.mjs';
import { Store } from '../store.mjs';
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
  const noSha = up('index/i1', 'i', T0, {}); const noSha2 = { ...up('index/i1', 'j', T0 + HOUR + 1), contentSha1: 'none' };
  s = summarize([...v, ow, copyBack, newKey, cfgHide, noSha, noSha2], { customerPrefix: P, since: T0, now: T0 + 4 * DAY });
  assert.deepEqual(s.events.map((e) => [e.kind, e.fileId]), [['overwrite', ow.fileId], ['overwrite', noSha2.fileId], ['keys', newKey.fileId], ['config', cfgHide.fileId]]);
  assert.equal(s.usage.visibleSnapshots, 1);
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
  // Without the vanish (one snapshot left of two), the measured rule decides; a forged huge count is capped.
  const many = [...Array(12)].map((_, i) => up(`snapshots/m${i}`, `m${i}`, T0));
  const hideTen = many.slice(0, 10).map((x) => hide(x.fileName.slice(R.length), T0 + HOUR));
  const s2 = summarize([...many, ...hideTen], { customerPrefix: P, since: T0, now: T0 + DAY });
  assert.ok(judge(s2, { previousSnapshots: 12, reported: { pruned: 2 }, now: T0 + DAY }).alerts.length === 1);
  assert.equal(judge(s2, { previousSnapshots: 12, reported: { pruned: 10 }, now: T0 + DAY }).alerts.length, 0, 'a large but true prune (PC back after a weekend) is quiet');
  assert.equal(judge(s2, { previousSnapshots: 12, reported: { pruned: 999999 }, now: T0 + DAY }).alerts.length, 0, 'forged counts are capped at what could be pruned');
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

test('keys worker: fixed capabilities and names, customer prefixes only, never deletes foreign keys, daily cap', async () => {
  const clock = clockAt(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-keys-'));
  const b2 = new FakeB2({ clock });
  const own = b2.addKey({ keyName: 'srv', capabilities: ['writeKeys'] });
  const foreign = b2.addKey({ keyName: 'wbw-' + 'q'.repeat(20), capabilities: WRITE_CAPS, bucketIds: ['other'], namePrefix: P });
  const h = keyHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, protectedKeyIds: [own.applicationKeyId], stateDir: dir, now: () => clock.t });
  const name = 'wbw-' + 'a'.repeat(20);
  for (const bad of [{ kind: 'write', prefix: 'c/x/', name }, { kind: 'write', prefix: '', name }, { kind: 'read', prefix: P, name }, { kind: 'admin', prefix: P, name }, { kind: 'write', prefix: P, name: 'master' }]) {
    await assert.rejects(h['keys.create'](bad), { code: 'BAD_INPUT' });
  }
  const k = await h['keys.create']({ kind: 'write', prefix: P, name });
  assert.deepEqual(b2.keys.get(k.keyId).capabilities, WRITE_CAPS);
  await assert.rejects(h['keys.delete']({ keyId: own.applicationKeyId }), { code: 'BAD_INPUT' });
  await assert.rejects(h['keys.delete']({ keyId: foreign.applicationKeyId }), { code: 'NOT_OURS' });
  assert.deepEqual(await h['keys.delete']({ keyId: 'missing-key-id' }), { deleted: false, missing: true });
  assert.deepEqual(await h['keys.delete']({ keyId: k.keyId }), { deleted: true });
  for (let i = 1; i < DAILY_CAP; i++) await h['keys.create']({ kind: 'read', prefix: P, name: 'wbr-' + String(i).padStart(20, '0') });
  await assert.rejects(h['keys.create']({ kind: 'read', prefix: P, name: 'wbr-' + 'z'.repeat(20) }), { code: 'LIMIT_WORKER_DAY' });
  clock.advance(DAY);
  await h['keys.create']({ kind: 'read', prefix: P, name: 'wbr-' + 'y'.repeat(20) });
});

test('files worker: plans from its own listing, records the moment before, re-plans, three restores a day', async () => {
  const clock = clockAt(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-files-'));
  const b2 = new FakeB2({ clock });
  const h = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now: () => clock.t });
  b2.upload(R + 'config', 'c'); b2.upload(R + 'snapshots/s1', 's1');
  clock.advance(HOUR); const T = clock.t - 1;
  const late = b2.upload(R + 'snapshots/s2', 's2'); b2.hide(R + 'snapshots/s1');
  clock.advance(HOUR);
  await assert.rejects(h['restore.apply']({ prefix: 'c/../', at: T }), { code: 'BAD_INPUT' });
  const r = await h['restore.apply']({ prefix: P, at: T, items: [{ type: 'copy', sourceFileId: 'x', fileName: 'elsewhere' }] });
  assert.equal(r.preAt, Math.max(...b2.versions.slice(0, 4).map((v) => v.uploadTimestamp)));
  assert.equal(r.remaining, 0); assert.equal(r.rounds, 1);
  assert.ok(!b2.versions.some((v) => v.fileName === 'elsewhere'), 'a plan from the caller is ignored');
  assert.ok(late.uploadTimestamp <= r.preAt);
  for (let i = 1; i < RESTORES_PER_DAY; i++) await h['restore.apply']({ prefix: P, at: T });
  await assert.rejects(h['restore.apply']({ prefix: P, at: T }), { code: 'LIMIT_WORKER_DAY' });
  await h['restore.apply']({ prefix: P, at: T, resume: true });
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

test('mail: held while off, signature verifies with the relay formula, statuses', async () => {
  const clock = clockAt(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-mail-'));
  const store = new Store(path.join(dir, 'm.sqlite'), { now: () => clock.t });
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
