// Stage-1 follow-up measurements asked by the Fable 5.2 design review (11-12):
//   M3b  a run killed mid-backup leaves a lock; can the no-delete key `unlock` it?
//   M4b  「이 시각으로 되돌리기」 with always-copy (no deletes), incl. versions behind hide markers; re-run is a no-op
//   M9   can the customer read key read an older version by id (S3 versionId · native download by id)?
//   M8   lifecycle on ci/ (hidden 1 day -> delete): set up four cases now, check in 2–6 days with --m8-check <file>
// Usage: node b2-measure-2.mjs <restic.exe>            (M3b · M4b · M9 · M8 setup)
//        node b2-measure-2.mjs --m8-check <m8-cases.json>
// No secrets or bucket name are printed or written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { authorize } from '../b2-native.mjs';
import { s3Request } from '../s3-lite.mjs';
import { planRestore, applyPlan } from '../restore-hidden.mjs';
import * as store from './secret-store.mjs';

const bucket = store.get('bucket');
const keys = { A: store.get('keyA'), R: store.get('keyR'), S: store.get('keyS') };
const secrets = [bucket.bucketName, ...Object.values(keys).flatMap((k) => [k.keyId, k.applicationKey])];
const redact = (t) => { let s = String(t || ''); for (const v of secrets) if (v) s = s.split(v).join('[redacted]'); return s; };
const S = await authorize(keys.S);
const versions = (prefix) => S.listFileVersions({ bucketId: bucket.bucketId, prefix });

if (process.argv[2] === '--m8-check') {
  const cases = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const out = { checkedAt: new Date().toISOString(), setupAt: cases.setupAt, hoursSinceSetup: +((Date.now() - Date.parse(cases.setupAt)) / 3600000).toFixed(1), cases: {} };
  for (const [name, c] of Object.entries(cases.cases)) {
    const present = new Set((await versions(c.fileName)).filter((v) => v.fileName === c.fileName).map((v) => v.fileId));
    out.cases[name] = Object.fromEntries(Object.entries(c.ids).map(([role, id]) => [role, present.has(id) ? 'present' : 'gone']));
  }
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}

const RESTIC = process.argv[2];
if (!RESTIC || crypto.createHash('sha256').update(fs.readFileSync(RESTIC)).digest('hex') !== 'b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830') throw new Error('RESTIC_HASH');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.join(store.ROOT, 'evidence', `measure2-${stamp}`); const WORK = path.join(OUT, 'work');
fs.mkdirSync(WORK, { recursive: true });
const run = 'r' + crypto.randomBytes(3).toString('hex');
const report = { startedAt: new Date().toISOString(), run, steps: {} };
const save = () => fs.writeFileSync(path.join(OUT, 'report.json'), redact(JSON.stringify(report, null, 1)));
const cache = path.join(WORK, 'cache'); const tmp = path.join(WORK, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
const env = (key, password) => ({ SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA,
  TEMP: tmp, TMP: tmp, AWS_ACCESS_KEY_ID: key.keyId, AWS_SECRET_ACCESS_KEY: key.applicationKey, AWS_DEFAULT_REGION: bucket.region, AWS_EC2_METADATA_DISABLED: 'true',
  RESTIC_PASSWORD: password, RESTIC_CACHE_DIR: cache, RESTIC_PROGRESS_FPS: '0.016' });
const repoArgs = (repoRel) => ['-r', `s3:${bucket.s3ApiUrl}/${bucket.bucketName}/${repoRel}`, '-o', 's3.bucket-lookup=path', '-o', `s3.region=${bucket.region}`];
function restic(key, repoRel, password, args) {
  const t0 = Date.now();
  const r = spawnSync(RESTIC, [...repoArgs(repoRel), ...args], { env: env(key, password), encoding: 'utf8', timeout: 900000, maxBuffer: 64 << 20, windowsHide: true });
  return { code: r.status, ms: Date.now() - t0, out: r.stdout || '', err: redact(r.stderr).slice(-2000) };
}
const lastLine = (t) => String(t || '').trim().split(/\r?\n/).filter(Boolean).slice(-2).join(' | ');
const s3 = (key, method, objKey, body, query = {}) => s3Request({ endpoint: bucket.s3ApiUrl, region: bucket.region, keyId: key.keyId, secret: key.applicationKey, method, bucket: bucket.bucketName, key: objKey, body, query });
const pw = () => crypto.randomBytes(24).toString('base64url');
function stream(seed, n) { const out = Buffer.alloc(n); let off = 0, i = 0; while (off < n) { const h = crypto.createHash('sha256').update(`${seed}:${i++}`).digest(); h.copy(out, off); off += h.length; } return out; }
function writeData(dir, version, bigMB = 0) {
  fs.rmSync(dir, { recursive: true, force: true });
  const put = (rel, buf) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };
  for (let i = 0; i < 60; i++) put(`문서/메모-${i}.txt`, stream(`${version === 2 && i < 8 ? 'x' : 's'}${i}`, 2000 + i * 113));
  for (let i = 0; i < 6; i++) put(`사진/p-${i}.bin`, stream(`p${i}`, 300000 + i * 7777));
  if (bigMB) put('큰자료/big.bin', stream('big', bigMB * 1024 * 1024));
}
function manifest(dir) { const m = {}; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else m[path.relative(dir, p).replaceAll('\\', '/')] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } }; walk(dir); return m; }
const dataDir = path.join(WORK, 'data');
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const want = (step) => !ONLY.length || ONLY.includes(step);


// ---- M3b: killed backup leaves a lock; unlock with the no-delete key ----
if (want('M3b')) {
  const A = keys.A, repo = `t/${run}/m3b`, p = pw(), r = {};
  r.init = restic(A, repo, p, ['init']).code;
  writeData(dataDir, 1, 120);
  const child = spawn(RESTIC, [...repoArgs(repo), 'backup', '--host', 'measure', dataDir], { env: env(A, p), windowsHide: true, stdio: 'ignore' });
  let sawLock = false; const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    if ((await versions(`${repo}/locks/`)).some((v) => v.action === 'upload')) { sawLock = true; break; }
    await new Promise((ok) => setTimeout(ok, 400));
  }
  child.kill(); await new Promise((ok) => child.once('exit', ok));
  r.lockSeenBeforeKill = sawLock; r.killedAfterMs = Date.now() - t0;
  const liveLocks = (await versions(`${repo}/locks/`)).filter((v) => v.action === 'upload').length;
  r.locksLeft = liveLocks;
  const c1 = restic(A, repo, p, ['check']); r.checkAfterKill = c1.code; r.checkAfterKillErr = c1.code ? lastLine(c1.err) : undefined;
  const un = restic(A, repo, p, ['unlock']); r.unlock = un.code; r.unlockErr = un.code ? lastLine(un.err) : undefined;
  const lockVersions = await versions(`${repo}/locks/`);
  r.lockVersionsAfterUnlock = lockVersions.map((v) => v.action);
  const c2 = restic(A, repo, p, ['check']); r.checkAfterUnlock = c2.code;
  const b = restic(A, repo, p, ['backup', '--host', 'measure', dataDir]); r.backupAfter = b.code;
  report.steps.M3b = r; save();
}

// ---- M4b: always-copy restore, then a second plan must be empty ----
if (want('M4b')) {
  const A = keys.A, repo = `t/${run}/m4b`, p = pw(), r = {};
  restic(A, repo, p, ['init']);
  writeData(dataDir, 1); restic(A, repo, p, ['backup', '--host', 'measure', dataDir]);
  writeData(dataDir, 2); const want = manifest(dataDir); restic(A, repo, p, ['backup', '--host', 'measure', dataDir]);
  const T = Math.max(...(await versions(repo + '/')).map((v) => v.uploadTimestamp)) + 1;
  await new Promise((ok) => setTimeout(ok, 3000));
  const ids = JSON.parse(restic(A, repo, p, ['snapshots', '--json']).out || '[]').map((s) => s.id);
  r.attack = { forget: restic(A, repo, p, ['forget', ...ids]).code, prune: restic(A, repo, p, ['prune', '--max-repack-size', '0']).code };
  const now1 = await versions(repo + '/');
  for (const name of [...new Set(now1.filter((v) => /\/(config|keys\/[^/]+)$/.test(v.fileName)).map((v) => v.fileName))]) await s3(A, 'DELETE', name);
  const pack = now1.find((v) => v.action === 'upload' && v.fileName.includes('/data/'));
  if (pack) await s3(A, 'PUT', pack.fileName, 'garbage-' + crypto.randomBytes(8).toString('hex'));
  r.broken = restic(A, repo, p, ['snapshots', '--json']).code;
  const t0 = Date.now();
  const plan = planRestore(await versions(repo + '/'), { at: T, now: Date.now(), prefix: repo + '/' });
  r.plan = { counts: plan.counts, copyBytes: plan.copyBytes };
  const { journal } = await applyPlan(S, { bucketId: bucket.bucketId, plan, freshVersions: await versions(repo + '/'), now: Date.now() });
  r.applyMs = Date.now() - t0; r.copies = journal.filter((j) => j.type === 'copy').length; r.hides = journal.filter((j) => j.type === 'hide').length;
  r.deleteCalls = 0; // the session has no delete path in applyPlan
  r.secondPlan = planRestore(await versions(repo + '/'), { at: T, now: Date.now(), prefix: repo + '/' }).counts;
  r.snapshots = (JSON.parse(restic(A, repo, p, ['snapshots', '--json']).out || '[]')).length;
  const chk = restic(A, repo, p, ['check', '--read-data']); r.checkReadData = chk.code; r.checkErr = chk.code ? lastLine(chk.err) : undefined;
  // Read path: dump each file with the read key (as the app does), no lock.
  // restic lists oldest first; the state at T is the newest snapshot (the second backup).
  const snap = JSON.parse(restic(keys.R, repo, p, ['snapshots', '--json', '--no-lock']).out || '[]').sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
  let ok = 0, total = 0;
  if (snap) {
    const base = snap.paths[0].replace(/^([A-Za-z]):/, '/$1').replaceAll('\\', '/');
    for (const [rel, hash] of Object.entries(want)) {
      total++;
      const d = spawnSync(RESTIC, [...repoArgs(repo), 'dump', '--no-lock', snap.id, `${base}/${rel}`], { env: env(keys.R, p), maxBuffer: 64 << 20, windowsHide: true });
      if (d.status === 0 && crypto.createHash('sha256').update(d.stdout).digest('hex') === hash) ok++;
    }
  }
  r.readKeyDumpHashMatch = `${ok}/${total}`;
  report.steps.M4b = r; save();
}

// ---- M9: read key and older versions by id ----
if (want('M9')) {
  const name = `t/${run}/m9/x.txt`, r = {};
  const v1 = await s3(keys.S, 'PUT', name, 'version-one'); await s3(keys.S, 'PUT', name, 'version-two');
  const id1 = v1.headers['x-amz-version-id'];
  const s3get = await s3(keys.R, 'GET', name, undefined, { versionId: id1 });
  r.s3GetOldVersionWithReadKey = { status: s3get.status, body: s3get.status === 200 ? (s3get.body === 'version-one' ? 'matches v1' : 'different') : s3get.code };
  const Rn = await authorize(keys.R);
  const dl = await fetch(`${Rn.downloadUrl}/b2api/v4/b2_download_file_by_id?fileId=${encodeURIComponent(id1)}`, { headers: { authorization: Rn.token } });
  const text = await dl.text();
  r.nativeDownloadByIdWithReadKey = { status: dl.status, body: dl.status === 200 ? (text === 'version-one' ? 'matches v1' : 'different') : 'error' };
  report.steps.M9 = r; save();
}

// ---- M8 setup: four lifecycle cases under ci/ (hidden 1 day -> deleted) ----
if (want('M8')) {
  const base = `ci/m8-${run}/`, cases = {};
  const put = async (n, body) => (await s3(keys.S, 'PUT', base + n, body)).headers['x-amz-version-id'];
  const a1 = await put('a.txt', 'a1'); const ah = (await S.hideFile({ bucketId: bucket.bucketId, fileName: base + 'a.txt' })).fileId;
  cases.hiddenByMarker = { fileName: base + 'a.txt', ids: { upload: a1, hideMarker: ah }, expect: 'upload and marker gone after the lifecycle passes 1 day' };
  const b1 = await put('b.txt', 'b1'); const b2 = await put('b.txt', 'b2');
  cases.replacedByNewer = { fileName: base + 'b.txt', ids: { older: b1, newer: b2 }, expect: 'older gone, newer present' };
  const c1 = await put('c.txt', 'c1'); const ch = (await S.hideFile({ bucketId: bucket.bucketId, fileName: base + 'c.txt' })).fileId;
  await S.deleteFileVersion({ fileName: base + 'c.txt', fileId: ch });
  cases.unhiddenByDeletingMarker = { fileName: base + 'c.txt', ids: { upload: c1 }, expect: 'present (no longer hidden)' };
  const d1 = await put('d.txt', 'd1'); const dh = (await S.hideFile({ bucketId: bucket.bucketId, fileName: base + 'd.txt' })).fileId;
  const dc = (await S.copyFile({ sourceFileId: d1, fileName: base + 'd.txt' })).fileId;
  cases.restoredByCopy = { fileName: base + 'd.txt', ids: { original: d1, hideMarker: dh, copy: dc }, expect: 'copy present; original and marker gone' };
  const file = path.join(OUT, 'm8-cases.json');
  fs.writeFileSync(file, JSON.stringify({ setupAt: new Date().toISOString(), cases }, null, 1));
  report.steps.M8 = { setup: 'done', casesFile: file, note: 'check after 48h with --m8-check' }; save();
}

report.finishedAt = new Date().toISOString(); save();
console.log(redact(JSON.stringify({ out: OUT, ...report.steps }, null, 1)));
