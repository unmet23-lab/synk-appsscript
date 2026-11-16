// The provisioning server's two B2 keys and the trial sign-up (STAGE1_DESIGN.md 4.4 표 · 4.5 「개통 서버 구현
// 설계」 · 「먼저 잴 것(M10)」). Runs on the operator PC with the owner's leave (11-16 「허락할게」).
//
// Reads the temporary key-management key ('custAdmin', captured DPAPI-protected from the B2 console, one-hour
// lifetime) of the customer account prepared on 11-13 (b2-customer-setup.mjs), and:
//  1. makes the key-work key (writeKeys · listKeys · deleteKeys + bucket settings) and the file-work key
//     (listBuckets · listFiles · readFiles · writeFiles on the customer bucket), stored DPAPI-protected as
//     'custServerKeys' · 'custServerFiles';
//  2. runs the real api and both workers in this process against the account (Google is the test verifier:
//     the backup Google project does not exist yet) — a test customer signs up, its keys are tried inside and
//     outside its prefix, a restore to a time runs and is undone;
//  3. M10: how long a deleted key's B2 token and upload address still work (10 s · 1 min · 10 min);
//  4. deletes the test customer's keys and files (only under its prefix), deletes the temporary key, and runs
//     the server's own reconcile against the account.
// Prints no secret, bucket name or account number. A rerun keeps the server keys already made.
// Usage: node tools/b2-server-setup.mjs [--no-wait]   (--no-wait: M10 at 10 s only, for a quick rerun)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { authorize, B2Error } from '../b2-native.mjs';
import { s3Request } from '../s3-lite.mjs';
import { keyHandlers, lazySession } from '../keys-worker.mjs';
import { fileHandlers } from '../files-worker.mjs';
import { rpcServer, rpcClient } from '../rpc.mjs';
import { Store } from '../store.mjs';
import { createApi } from '../server.mjs';
import { createJobs } from '../jobs.mjs';
import { createMailer } from '../mail.mjs';
import { createVerifier } from '../google-token.mjs';
import { fakeGoogle } from '../tests/fakes.mjs';
import * as secrets from './secret-store.mjs';

const KEYS_CAPS = ['writeKeys', 'listKeys', 'deleteKeys', 'listBuckets', 'readBuckets', 'readBucketEncryption', 'readBucketReplications'];
const KEYS_CAPS_WIDE = [...KEYS_CAPS, 'listFiles', 'readFiles', 'writeFiles']; // only if B2 refuses the narrow one (4.5)
const FILES_CAPS = ['listBuckets', 'listFiles', 'readFiles', 'writeFiles'];
const quick = process.argv.includes('--no-wait');
const report = { at: new Date().toISOString(), steps: {} };
const hidden = [];
const redact = (t) => { let s = String(t ?? ''); for (const v of hidden) if (v) s = s.split(v).join('[…]'); return s; };
const say = (step, value) => { report.steps[step] = value; console.log(redact(JSON.stringify({ step, ...value }))); };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ── the account and the temporary key
const temp = secrets.get('custAdmin');
const bucket = secrets.get('custBucket');
const audit = secrets.get('custAudit');
hidden.push(temp.keyId, temp.applicationKey, bucket.bucketName, bucket.bucketId, bucket.accountId, audit.keyId, audit.applicationKey);
const admin = await authorize(temp);
for (const need of ['writeKeys', 'listKeys', 'deleteKeys', 'listBuckets', 'listFiles', 'deleteFiles']) if (!admin.capabilities.includes(need)) throw new Error('ADMIN_KEY_MISSING_' + need);
if (admin.accountId !== bucket.accountId) throw new Error('ACCOUNT_MISMATCH');
if (secrets.has('keyR') && (await authorize(secrets.get('keyR'))).accountId === admin.accountId) throw new Error('OPERATOR_ACCOUNT');
const buckets = (await admin.listBuckets()).buckets || [];
if (buckets.length !== 1 || buckets[0].bucketId !== bucket.bucketId) throw new Error('ACCOUNT_NOT_AS_PREPARED');

// ── 1. the server's two keys
async function makeKey(name, keyName, capabilities, bucketIds) {
  if (secrets.has(name)) {
    const k = secrets.get(name);
    if (k.accountId !== admin.accountId) throw new Error('ACCOUNT_MISMATCH_' + name);
    hidden.push(k.keyId, k.applicationKey);
    return k;
  }
  const r = await admin.createKey({ keyName, capabilities, ...(bucketIds ? { bucketIds } : {}) });
  const k = { accountId: admin.accountId, keyId: r.applicationKeyId, applicationKey: r.applicationKey, keyName: r.keyName, capabilities: r.capabilities, bucketIds: r.bucketIds || null };
  secrets.put(name, k);
  hidden.push(k.keyId, k.applicationKey);
  return k;
}
let keysKey = await makeKey('custServerKeys', 'wb-server-keys', KEYS_CAPS, null);
const filesKey = await makeKey('custServerFiles', 'wb-server-files', FILES_CAPS, [bucket.bucketId]);
async function describe(k) {
  const s = await authorize(k);
  return { capabilities: [...s.capabilities].sort(), bucketRestricted: !!(s.allowed?.bucketId || s.allowed?.buckets?.length), sameAccount: s.accountId === admin.accountId };
}
say('server-keys', { keys: await describe(keysKey), files: await describe(filesKey) });

// ── 2. the real api and workers in this process
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-trial-'));
const protectedKeyIds = () => [keysKey.keyId, filesKey.keyId, audit.keyId];
const ks = crypto.randomBytes(32).toString('hex'), fsec = crypto.randomBytes(32).toString('hex');
const now = () => Date.now();
let keysSrv;
const listen = (srv) => new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
async function startKeys() {
  keysSrv?.close();
  keysSrv = rpcServer({ secret: ks, now, handlers: keyHandlers({ withSession: lazySession(keysKey), bucketId: bucket.bucketId, protectedKeyIds: protectedKeyIds(), stateDir: path.join(dir, 'keys') }) });
  return listen(keysSrv);
}
fs.mkdirSync(path.join(dir, 'keys')); fs.mkdirSync(path.join(dir, 'files'));
let kp = await startKeys();
const filesSrv = rpcServer({ secret: fsec, now, handlers: fileHandlers({ withSession: lazySession(filesKey), bucketId: bucket.bucketId, stateDir: path.join(dir, 'files'), now }) });
const fp = await listen(filesSrv);
let keysRpc = rpcClient({ url: `http://127.0.0.1:${kp}/rpc`, secret: ks, now });
const keys = (...a) => keysRpc(...a);
const files = rpcClient({ url: `http://127.0.0.1:${fp}/rpc`, secret: fsec, now });
const clock = { get t() { return Date.now(); } };
const g = fakeGoogle({ clock });
const store = new Store(path.join(dir, 'wb.sqlite'), { now });
const mailer = createMailer({ store, enabled: false, operator: 'ops@example.invalid', now });
const logs = [];
const api = createApi({ store, keys, files, mailer, now, log: (e) => logs.push(e), verifyGoogle: createVerifier({ audiences: [g.aud], fetchImpl: g.fetchImpl, now }),
  config: { endpoint: `https://s3.${bucket.region}.backblazeb2.com`, bucket: bucket.bucketName, restoreGraceMs: 60000 } });
const srv = api.server(); const port = await listen(srv);
const jobs = createJobs({ store, api, keys, files, mailer, now, config: { bucketId: bucket.bucketId, protectedKeyIds: protectedKeyIds() } });
async function call(method, route, body, token) {
  const res = await fetch(`http://127.0.0.1:${port}/backup-api/v1/${route}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, ...(await res.json()) };
}
const email = 'trial-' + crypto.randomBytes(3).toString('hex') + '@example.invalid';
const sub = '7' + crypto.randomInt(1e9, 9e9); // the one Google account of the trial customer
async function proof(purpose) {
  const n = await call('POST', 'nonce', { purpose });
  if (!n.ok) throw new Error('NONCE_' + n.code);
  return { idToken: g.token({ nonce: n.nonce, sub, email }), nonce: n.nonce };
}

let customer = null, deviceToken = null, mFile = null;
const created = []; // test keys (write · read) the trial got, for the cleanup
const s3 = (key, method, objKey, body) => s3Request({ endpoint: `https://s3.${bucket.region}.backblazeb2.com`, region: bucket.region, keyId: key.keyId, secret: key.applicationKey, method, bucket: bucket.bucketName, key: objKey, body });
const keyOf = (k) => { hidden.push(k.keyId, k.applicationKey); created.push(k.keyId); return k; };
let cleanupOk = false;
try {
  // ── sign-up; the narrow key-work key is measured here (4.5)
  store.addInvite(email);
  const signUp = async () => { const n = await call('POST', 'nonce', { purpose: 'provision' }); return call('POST', 'provision', { google: { idToken: g.token({ nonce: n.nonce, sub, email }), nonce: n.nonce }, device: { name: 'trial PC', appVersion: '0.7.0' } }); };
  let p = await signUp();
  let widened = false;
  if (!p.ok && p.code === 'SERVER' && logs.some((e) => e.task === 'keys.create')) {
    // B2 refused a customer key from the narrow key: widen it once (still no delete), as 4.5 says.
    const old = keysKey;
    secrets.remove('custServerKeys');
    keysKey = await makeKey('custServerKeys', 'wb-server-keys', KEYS_CAPS_WIDE, null);
    await admin.deleteKey(old.keyId);
    kp = await startKeys();
    keysRpc = rpcClient({ url: `http://127.0.0.1:${kp}/rpc`, secret: ks, now });
    widened = true;
    p = await signUp();
  }
  if (!p.ok) throw new Error('PROVISION_' + p.code);
  customer = p.customer; deviceToken = p.device.token;
  hidden.push(customer.id, deviceToken);
  const w1 = keyOf(p.keys.write), r1 = keyOf(p.keys.read);
  await call('POST', 'keys/ack', { keyIds: [w1.keyId, r1.keyId] }, deviceToken);
  const confirm = await call('POST', 'read-key/confirm', { keyId: r1.keyId }, deviceToken);
  const base = customer.repository.prefix.replace(/\/?$/, '/');
  say('sign-up', { ok: true, narrowKeyWorked: !widened, readKeyConfirmed: confirm.ok === true, prefixShape: /^c\/[a-z0-9]{16}\/r\/$/.test(base) });

  // ── the customer's keys: inside and outside the prefix (the app writes through S3, as restic does)
  const usable = Math.max(0, (p.usableAt || 0) - Date.now()); if (usable) await sleep(usable);
  const inside = await s3(w1, 'PUT', base + 'config', 'trial-config');
  const outside = await s3(w1, 'PUT', 'c/zzzzzzzzzzzzzzzz/r/config', 'x');
  const readPut = await s3(r1, 'PUT', base + 'keys/k1', 'x');
  const readGet = await s3(r1, 'GET', base + 'config');
  say('prefix', { writeInside: inside.status, writeOutside: outside.status, readKeyWrite: readPut.status, readKeyRead: readGet.status, readBody: readGet.body === 'trial-config' });

  // ── a restore to a time, then its undo (real copies and hides; 60 s grace after each key change)
  await s3(w1, 'PUT', base + 'data/aa/p1', 'pack-one'); await s3(w1, 'PUT', base + 'index/i1', 'index-one'); await s3(w1, 'PUT', base + 'snapshots/s1', 'snap-one');
  const fv = (await admin.listFileVersions({ bucketId: bucket.bucketId, prefix: base })) || [];
  const at = Math.max(...fv.map((v) => v.uploadTimestamp)) + 1000;
  while (Date.now() < at + 3000) await sleep(500);
  await s3(w1, 'PUT', base + 'data/aa/p1', 'pack-TWO'); await s3(w1, 'PUT', base + 'snapshots/s2', 'snap-two');
  const v2 = ((await admin.listFileVersions({ bucketId: bucket.bucketId, prefix: base })) || []).filter((v) => v.uploadTimestamp > at).length;
  if (v2 < 2) throw new Error('SECOND_VERSIONS_NOT_AFTER_AT'); // B2's clock and ours: the restore must have something to undo
  const plan = await call('POST', 'restore/plan', { at }, deviceToken);
  const run = await call('POST', 'restore/run', { google: await proof('restore-run'), at }, deviceToken);
  if (!run.ok) throw new Error('RESTORE_RUN_' + run.code);
  const w2 = keyOf(run.keys.write), r2 = keyOf(run.keys.read);
  await call('POST', 'keys/ack', { keyIds: [w2.keyId, r2.keyId] }, deviceToken);
  const t0 = Date.now();
  await api.runJob(store.job(run.jobId));
  const job = store.job(run.jobId);
  const p1 = await s3(r2, 'GET', base + 'data/aa/p1'), s2 = await s3(r2, 'GET', base + 'snapshots/s2');
  const oldWrite = await s3(w1, 'PUT', base + 'data/aa/after', 'x');
  say('restore', { planCounts: plan.plan?.counts || null, state: job.state, waitedMs: Date.now() - t0, p1Back: p1.body === 'pack-one', s2Hidden: s2.status === 404, oldWriteKeyAfter: oldWrite.status });
  const undo = await call('POST', 'restore/choose', { jobId: run.jobId, choice: 'undo', google: await proof('restore-undo') }, deviceToken);
  if (undo.ok && undo.jobId) await api.runJob(store.job(undo.jobId));
  const p1u = await s3(r2, 'GET', base + 'data/aa/p1'), s2u = await s3(r2, 'GET', base + 'snapshots/s2');
  say('undo', { ok: undo.state === 'undone', state: undo.jobId ? store.job(undo.jobId).state : undo.code, p1Again: p1u.body === 'pack-TWO', s2Back: s2u.body === 'snap-two' });

  // ── M10: a deleted key's token and upload address (STAGE1_DESIGN.md 4.5 「먼저 잴 것(M10)」)
  const w = await authorize(w2);
  const up = await w.call('b2_get_upload_url', { bucketId: bucket.bucketId });
  mFile = base + 'snapshots/m10-before';
  const upload = async (name) => {
    const body = Buffer.from('m10 ' + name);
    const r = await fetch(up.uploadUrl, { method: 'POST', headers: { authorization: up.authorizationToken, 'x-bz-file-name': name.split('/').map(encodeURIComponent).join('/'), 'content-type': 'text/plain', 'x-bz-content-sha1': crypto.createHash('sha1').update(body).digest('hex') }, body });
    return r.status;
  };
  const before = await upload(mFile);
  const raw = async (name, body) => (await fetch(`${w.apiUrl}/b2api/v4/${name}`, { method: 'POST', headers: { authorization: w.token, 'content-type': 'application/json' }, body: JSON.stringify(body) })).status;
  const download = async () => (await fetch(`${w.downloadUrl}/file/${encodeURIComponent(bucket.bucketName)}/${mFile.split('/').map(encodeURIComponent).join('/')}`, { headers: { authorization: w.token } })).status;
  const deleted = await keys('keys.delete', { keyId: w2.keyId });
  const tDel = Date.now();
  const marks = quick ? [10000] : [10000, 60000, 600000];
  const m10 = { uploadBefore: before, deleted: deleted.deleted === true, after: [] };
  for (const ms of marks) {
    while (Date.now() < tDel + ms) await sleep(1000);
    let fresh;
    try { await authorize(w2); fresh = 200; } catch (e) { fresh = e instanceof B2Error ? e.status : 'error'; }
    m10.after.push({ afterMs: ms, upload: await upload(base + `snapshots/m10-${ms}`), hide: await raw('b2_hide_file', { bucketId: bucket.bucketId, fileName: mFile }), download: await download(), newSignIn: fresh });
  }
  say('m10', m10);
} finally {
  // ── 4. cleanup: the trial's keys (through the key worker, as the server would) and files (temporary key)
  const result = { keys: 0, keyErrors: 0, files: 0 };
  for (const row of customer ? store.allLiveKeys().filter((r) => r.customer_id === customer.id && r.key_id) : []) {
    try { await keys('keys.delete', { keyId: row.key_id }); store.keyDeleted(row.name, 'trial-cleanup'); result.keys++; } catch { result.keyErrors++; }
  }
  const leftKeys = (await admin.listKeys()).filter((k) => created.includes(k.applicationKeyId));
  for (const k of leftKeys) { try { await admin.deleteKey(k.applicationKeyId); result.keys++; } catch { result.keyErrors++; } }
  if (customer) {
    const prefix = `c/${customer.id}/`;
    for (let round = 0; round < 3; round++) {
      const list = (await admin.listFileVersions({ bucketId: bucket.bucketId, prefix })) || [];
      if (!list.length) break;
      for (const v of list) { if (!v.fileName.startsWith(prefix)) throw new Error('CLEANUP_OUTSIDE_PREFIX'); await admin.deleteFileVersion({ fileName: v.fileName, fileId: v.fileId }); result.files++; }
    }
    result.prefixEmpty = ((await admin.listFileVersions({ bucketId: bucket.bucketId, prefix })) || []).length === 0;
  }
  result.trialKeysLeft = (await admin.listKeys()).filter((k) => created.includes(k.applicationKeyId)).length;
  cleanupOk = result.keyErrors === 0 && result.trialKeysLeft === 0 && (customer ? result.prefixEmpty : true);
  say('cleanup', result);
  srv.close(); filesSrv.close(); keysSrv.close(); store.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── the temporary key goes last (as in b2-customer-setup.mjs: B2 may accept it a few seconds more)
if (!cleanupOk) throw new Error('CLEANUP_INCOMPLETE — the temporary key is kept for a retry (it expires within the hour)');
await admin.deleteKey(temp.keyId);
let tempGone = false;
for (let i = 0; i < 12 && !tempGone; i++) {
  if (i) await sleep(5000);
  try { await authorize(temp); } catch (e) { if (e.status !== 401) throw e; tempGone = true; }
}
if (!tempGone) throw new Error('TEMP_KEY_STILL_VALID');
secrets.remove('custAdmin');

// ── the account as the server's reconcile sees it (keys and bucket settings), after the trial
const after = await authorize(keysKey);
const left = await after.listKeys();
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-reconcile-'));
const store2 = new Store(path.join(dir2, 'wb.sqlite'), { now });
const kh = keyHandlers({ withSession: lazySession(keysKey), bucketId: bucket.bucketId, protectedKeyIds: protectedKeyIds(), stateDir: dir2 });
const jobs2 = createJobs({ store: store2, api: null, keys: (m, a) => kh[m](a || {}), files: null, mailer: null, now, config: { bucketId: bucket.bucketId, protectedKeyIds: protectedKeyIds() } });
const rec = await jobs2.reconcileKeys(Date.now());
store2.close(); fs.rmSync(dir2, { recursive: true, force: true });
say('account-after', { tempKeyDeleted: true, keysInAccount: left.length, reconcileProblems: (rec?.problems || []).map((x) => x.kind) });
void jobs;
