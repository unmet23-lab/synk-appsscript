// Stage-1 B2 measurements M1–M7 (STAGE1_DESIGN.md 4.4 「시험 버킷에서 먼저 확인할 것」).
// Usage: node b2-measure.mjs <restic.exe> [--revoke-b]
// Uses the pinned restic 0.19.1, the test bucket and keys from the local DPAPI
// store, and a fresh sub-prefix t/<run>/ per run. Writes the full report to
// %LOCALAPPDATA%\SynkWorkBackupStage1\evidence\measure-<stamp>\report.json and
// prints a summary. No secrets or bucket name are printed or written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { authorize } from '../b2-native.mjs';
import { s3Request } from '../s3-lite.mjs';
import { planRestore, applyPlan } from '../restore-hidden.mjs';
import * as store from './secret-store.mjs';

const RESTIC = process.argv[2];
const REVOKE_B = process.argv.includes('--revoke-b');
const RESTIC_SHA256 = 'b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830';
if (!RESTIC || crypto.createHash('sha256').update(fs.readFileSync(RESTIC)).digest('hex') !== RESTIC_SHA256) throw new Error('RESTIC_HASH');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.join(store.ROOT, 'evidence', `measure-${stamp}`);
const WORK = path.join(OUT, 'work'); fs.mkdirSync(WORK, { recursive: true });
const bucket = store.get('bucket');
const keys = { A: store.get('keyA'), B: store.has('keyB') ? store.get('keyB') : null, R: store.get('keyR'), S: store.get('keyS') };
const run = 'r' + crypto.randomBytes(3).toString('hex');
const secrets = [bucket.bucketName, ...Object.values(keys).filter(Boolean).flatMap((k) => [k.keyId, k.applicationKey])];
const redact = (t) => { let s = String(t || ''); for (const v of secrets) if (v) s = s.split(v).join('[redacted]'); return s; };
const report = { startedAt: new Date().toISOString(), restic: '0.19.1', region: bucket.region, run, steps: {} };
const save = () => fs.writeFileSync(path.join(OUT, 'report.json'), redact(JSON.stringify(report, null, 1)));
const S = await authorize(keys.S);

// ---- deterministic synthetic data (about 14 MB, Korean names, an empty folder) ----
function stream(seed, n) {
  const out = Buffer.alloc(n); let off = 0, i = 0;
  while (off < n) { const h = crypto.createHash('sha256').update(`${seed}:${i++}`).digest(); h.copy(out, off); off += h.length; }
  return out;
}
function writeDataset(dir, version) {
  fs.rmSync(dir, { recursive: true, force: true });
  const put = (rel, buf) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };
  for (let i = 0; i < 240; i++) {
    if (version === 2 && i < 5) continue;                                   // 5 deleted in v2
    const changed = version === 2 && i >= 5 && i < 15;                      // 10 changed in v2
    put(`문서/보고서-${String(i).padStart(3, '0')}.txt`, stream(`s${i}${changed ? 'b' : ''}`, 1024 + (i * 397) % 30000));
  }
  for (let i = 0; i < 30; i++) put(`사진/photo-${i}.bin`, stream(`m${i}`, 65536 + (i * 31337) % 900000));
  for (let i = 0; i < 2; i++) put(`큰자료/model-${i}.bin`, stream(`b${i}`, 4 * 1024 * 1024));
  if (version === 2) for (let i = 0; i < 5; i++) put(`새것/new-${i}.txt`, stream(`n${i}`, 5000));
  fs.mkdirSync(path.join(dir, '빈폴더'), { recursive: true });
}
function manifest(dir) {
  const m = {}; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else m[path.relative(dir, p).replaceAll('\\', '/')] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } };
  walk(dir); return m;
}

// ---- restic and S3 helpers ----
const cache = path.join(WORK, 'cache'); const tmp = path.join(WORK, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
function restic(key, repoRel, password, args, { timeout = 900000 } = {}) {
  const env = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: tmp, TMP: tmp, AWS_ACCESS_KEY_ID: key.keyId, AWS_SECRET_ACCESS_KEY: key.applicationKey,
    AWS_DEFAULT_REGION: bucket.region, AWS_EC2_METADATA_DISABLED: 'true', RESTIC_PASSWORD: password, RESTIC_CACHE_DIR: cache, RESTIC_PROGRESS_FPS: '0.016' };
  const repo = `s3:${bucket.s3ApiUrl}/${bucket.bucketName}/${repoRel}`;
  const t0 = Date.now();
  const r = spawnSync(RESTIC, ['-r', repo, '-o', 's3.bucket-lookup=path', '-o', `s3.region=${bucket.region}`, ...args], { env, encoding: 'utf8', timeout, maxBuffer: 64 << 20, windowsHide: true });
  return { code: r.status, ms: Date.now() - t0, out: r.stdout || '', err: redact(r.stderr).slice(-3000) };
}
const s3 = (key, method, objKey, body, query = {}) => s3Request({ endpoint: bucket.s3ApiUrl, region: bucket.region, keyId: key.keyId, secret: key.applicationKey, method, bucket: bucket.bucketName, key: objKey, body, query });
const versions = (prefix) => S.listFileVersions({ bucketId: bucket.bucketId, prefix });
const pw = () => crypto.randomBytes(24).toString('base64url');
const lastLine = (t) => String(t || '').trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
function storageOf(list) {
  const byName = new Map(); for (const v of list) if (v.action === 'upload' || v.action === 'hide') (byName.get(v.fileName) || byName.set(v.fileName, []).get(v.fileName)).push(v);
  let visible = 0, hidden = 0, visibleFiles = 0, hiddenVersions = 0, hideMarkers = 0;
  for (const vs of byName.values()) {
    vs.sort((a, b) => b.uploadTimestamp - a.uploadTimestamp);
    vs.forEach((v, i) => { if (v.action === 'hide') hideMarkers++; else if (i === 0) { visible += v.contentLength; visibleFiles++; } else { hidden += v.contentLength; hiddenVersions++; } });
  }
  return { visibleBytes: visible, visibleFiles, hiddenBytes: hidden, hiddenVersions, hideMarkers };
}
const dataDir = path.join(WORK, 'data');

// ---- M1: prefix key, bucket check and repository creation ----
writeDataset(dataDir, 1);
const manifest1 = manifest(dataDir);
report.dataset = { files: Object.keys(manifest1).length, bytes: Object.keys(manifest1).reduce((n, r) => n + fs.statSync(path.join(dataDir, r)).size, 0) };
report.steps.M1 = {};
for (const [label, key] of [['m1a_listBuckets', keys.A], ['m1b_noListBuckets', keys.B]]) {
  if (!key) { report.steps.M1[label] = { skipped: 'key revoked earlier' }; continue; }
  const head = await s3(key, 'HEAD', '', undefined);
  const repoRel = `t/${run}/${label}`; const p = pw();
  const init = restic(key, repoRel, p, ['init']);
  const r = { headBucket: head.status, init: init.code, initErr: init.code ? lastLine(init.err) : undefined };
  if (init.code === 0) {
    const b = restic(key, repoRel, p, ['backup', '--json', '--host', 'measure', dataDir]);
    const snaps = restic(key, repoRel, p, ['snapshots', '--json']);
    const check = restic(key, repoRel, p, ['check']);
    Object.assign(r, { backup: b.code, backupMs: b.ms, snapshots: snaps.code === 0 ? JSON.parse(snaps.out).length : `exit ${snaps.code}`, check: check.code, checkErr: check.code ? lastLine(check.err) : undefined });
  }
  report.steps.M1[label] = r; save();
}

// ---- M2: S3 deletes with a key that has no deleteFiles ----
{
  const base = `t/${run}/m2/`; const A = keys.A; const r = {};
  const put1 = await s3(A, 'PUT', base + 'a.txt', 'v1');
  r.put = put1.status; const v1 = put1.headers['x-amz-version-id'];
  const del = await s3(A, 'DELETE', base + 'a.txt');
  r.deleteNoVersion = { status: del.status, code: del.code, deleteMarker: del.headers['x-amz-delete-marker'] || null };
  r.afterDelete = (await versions(base + 'a.txt')).map((v) => v.action);
  const delV = await s3(A, 'DELETE', base + 'a.txt', undefined, { versionId: v1 || 'missing' });
  r.deleteWithVersion = { status: delV.status, code: delV.code };
  r.afterVersionedDelete = (await versions(base + 'a.txt')).map((v) => v.action);
  await s3(A, 'PUT', base + 'b.txt', 'one'); await s3(A, 'PUT', base + 'b.txt', 'two');
  r.overwriteKeepsOld = (await versions(base + 'b.txt')).map((v) => `${v.action}:${v.contentLength}`);
  const put3 = await s3(keys.S, 'PUT', base + 'c.txt', 'control');
  const delS = await s3(keys.S, 'DELETE', base + 'c.txt', undefined, { versionId: put3.headers['x-amz-version-id'] || 'missing' });
  r.controlServerKeyVersionedDelete = { status: delS.status, remaining: (await versions(base + 'c.txt')).length };
  report.steps.M2 = r; save();
}

// ---- M3: forget · prune with the no-delete key ----
const m3 = `t/${run}/m3`; const p3 = pw(); let snap1, snap2, manifest2;
{
  const A = keys.A; const r = {};
  r.init = restic(A, m3, p3, ['init']).code;
  writeDataset(dataDir, 1);
  const b1 = restic(A, m3, p3, ['backup', '--json', '--host', 'measure', dataDir]);
  writeDataset(dataDir, 2); manifest2 = manifest(dataDir);
  const b2 = restic(A, m3, p3, ['backup', '--json', '--host', 'measure', dataDir]);
  const list = JSON.parse(restic(A, m3, p3, ['snapshots', '--json']).out || '[]');
  [snap1, snap2] = list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time)).map((s) => s.id);
  r.backups = [b1.code, b2.code];
  const before = await versions(m3 + '/'); const uploadsBefore = new Set(before.filter((v) => v.action === 'upload').map((v) => v.fileId));
  r.storageBefore = storageOf(before);
  const forget = restic(A, m3, p3, ['forget', snap1]);
  const prune = restic(A, m3, p3, ['prune', '--max-repack-size', '0']);
  const check = restic(A, m3, p3, ['check']);
  const after = await versions(m3 + '/');
  const uploadsAfter = new Set(after.filter((v) => v.action === 'upload').map((v) => v.fileId));
  const hiddenByDir = {}; for (const v of after) if (v.action === 'hide') { const d = v.fileName.slice(m3.length + 1).split('/')[0]; hiddenByDir[d] = (hiddenByDir[d] || 0) + 1; }
  Object.assign(r, { forget: forget.code, forgetErr: forget.code ? lastLine(forget.err) : undefined, prune: prune.code, pruneErr: prune.code ? lastLine(prune.err) : undefined,
    pruneSummary: lastLine(prune.out), check: check.code, snapshotsAfter: JSON.parse(restic(A, m3, p3, ['snapshots', '--json']).out || '[]').length,
    permanentlyDeleted: [...uploadsBefore].filter((id) => !uploadsAfter.has(id)).length, hideMarkersByDir: hiddenByDir, storageAfter: storageOf(after) });
  report.steps.M3 = r; save();
}

// ---- M4: attack with the device-like key, then 「이 시각으로 되돌리기」 ----
{
  const A = keys.A; const r = {};
  const settled = await versions(m3 + '/');
  const T = Math.max(...settled.map((v) => v.uploadTimestamp)) + 1;       // B2 clock, just after the last good change
  await new Promise((ok) => setTimeout(ok, 3000));
  const ids = JSON.parse(restic(A, m3, p3, ['snapshots', '--json']).out || '[]').map((s) => s.id);
  r.attackForget = restic(A, m3, p3, ['forget', ...ids]).code;
  r.attackPrune = restic(A, m3, p3, ['prune', '--max-repack-size', '0']).code;
  const now1 = await versions(m3 + '/');
  const cfgKeys = [...new Set(now1.filter((v) => /\/(config|keys\/[^/]+)$/.test(v.fileName)).map((v) => v.fileName))];
  r.attackDeleteConfigKeys = [];
  for (const name of cfgKeys) r.attackDeleteConfigKeys.push((await s3(A, 'DELETE', name)).status);
  const pack = now1.find((v) => v.action === 'upload' && v.fileName.includes('/data/'));
  r.attackOverwritePack = pack ? (await s3(A, 'PUT', pack.fileName, 'garbage-' + crypto.randomBytes(8).toString('hex'))).status : 'no pack';
  r.attackVersionedDelete = pack ? (await s3(A, 'DELETE', pack.fileName, undefined, { versionId: pack.fileId })).status : 'no pack';
  const broken = restic(A, m3, p3, ['snapshots', '--json']);
  r.afterAttackSnapshots = broken.code === 0 ? JSON.parse(broken.out || '[]').length : `exit ${broken.code}`;
  const t0 = Date.now();
  const plan = planRestore(await versions(m3 + '/'), { at: T, now: T + 3600000, prefix: m3 + '/' });
  r.plan = { counts: plan.counts, copyBytes: plan.copyBytes };
  const journal = await applyPlan(S, { bucketId: bucket.bucketId, plan });
  r.applyMs = Date.now() - t0; r.journalSteps = journal.length;
  const snaps = restic(A, m3, p3, ['snapshots', '--json']);
  const list = snaps.code === 0 ? JSON.parse(snaps.out || '[]') : [];
  r.restoredSnapshots = list.map((s) => s.id === snap2 ? 'second-backup' : s.id === snap1 ? 'first-backup(forgotten-before-T)' : 'other');
  const check = restic(A, m3, p3, ['check', '--read-data']);
  r.checkReadData = check.code; r.checkErr = check.code ? lastLine(check.err) : undefined;
  const target = path.join(WORK, 'restore');
  // The customer read key cannot write a lock file, so the read path uses --no-lock (as the 0.5.0 restore-only mode does).
  const rest = restic(keys.R, m3, p3, ['restore', 'latest', '--no-lock', '--target', target]);
  r.restoreWithReadKey = rest.code; r.restoreErr = rest.code ? lastLine(rest.err) : undefined;
  // restic `restore` (not the app's dump stream) may fail to set metadata on the
  // recreated system-folder levels of the source path; file contents are still
  // compared below, and only metadata errors are tolerated.
  const metadataOnly = rest.code !== 0 && rest.err.split(/\r?\n/).filter((l) => /error|Fatal/i.test(l)).every((l) => /failed to restore timestamp|There were \d+ errors/i.test(l));
  r.restoreErrorsMetadataOnly = rest.code === 0 ? null : metadataOnly;
  if (rest.code === 0 || metadataOnly) {
    // restic recreates the absolute source path under the target.
    const found = (() => { let d = target; for (;;) { const e = fs.readdirSync(d, { withFileTypes: true }); if (e.some((x) => x.name === '문서')) return d; if (e.length !== 1 || !e[0].isDirectory()) return null; d = path.join(d, e[0].name); } })();
    const m = found ? manifest(found) : {};
    const want = Object.keys(manifest2); r.hashMatch = `${want.filter((k) => m[k] === manifest2[k]).length}/${want.length}`; r.extra = Object.keys(m).filter((k) => !(k in manifest2)).length;
  }
  report.steps.M4 = r; save();
}

// ---- M5: storage overhead of the safety net (this run) ----
report.steps.M5 = storageOf(await versions(`t/${run}/`)); save();

// ---- M6: back-dated snapshot for the stolen-key drill ----
{
  const A = keys.A; const repo = `t/${run}/m6`; const p = pw();
  restic(A, repo, p, ['init']);
  const b = restic(A, repo, p, ['backup', '--json', '--host', 'measure', '--time', '2026-10-01 09:00:00', dataDir]);
  const list = JSON.parse(restic(A, repo, p, ['snapshots', '--json']).out || '[]');
  report.steps.M6 = { backup: b.code, snapshotTime: list[0]?.time || null, olderThanOneDay: list[0] ? Date.now() - Date.parse(list[0].time) > 86400000 : null };
  save();
}

// ---- M7: a deleted key is refused ----
if (REVOKE_B && keys.B) {
  const admin = await authorize(store.get('admin'));
  await admin.deleteKey(keys.B.keyId);
  let auth; try { await authorize(keys.B); auth = 'accepted'; } catch (e) { auth = `${e.status} ${e.code}`; }
  const head = await s3(keys.B, 'HEAD', '', undefined);
  const list = await s3(keys.B, 'GET', '', undefined, { 'list-type': '2', prefix: 't/', 'max-keys': '1' });
  report.steps.M7 = { nativeAuthorize: auth, s3HeadBucket: head.status, s3List: `${list.status} ${list.code || ''}`.trim() };
  store.remove('keyB'); save();
} else report.steps.M7 = { skipped: REVOKE_B ? 'keyB already revoked' : 'pass --revoke-b' };

report.finishedAt = new Date().toISOString(); save();
console.log(redact(JSON.stringify({ out: OUT, run, dataset: report.dataset, ...report.steps }, null, 1)));
