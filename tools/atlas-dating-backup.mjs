// Offline product backup only. Copies an already-stopped/checkpointed SQLite
// database and its paired ledger export; never freezes writers or starts a host.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectDatingBackupPair, inspectDatingRestore, inspectDatingStagedRestore } from '../experiences/atlas-lab/dating-restore.mjs';
import { prepareDatingReconciliation, applyDatingReconciliation } from '../experiences/atlas-lab/dating-reconcile.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const repositories = [root, path.resolve(root, '../SYNK-talk')];
const MAX_DB = 256 * 1024 * 1024, MAX_JSON = 16 * 1024 * 1024;
const FILES = Object.freeze(['account.sqlite', 'paired.json']);
const INCOMPLETE = '.backup-incomplete';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const ensure = (ok, code) => { if (!ok) fail(code); };
const canonical = value => JSON.stringify(value, (_key, item) => plain(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const inside = (base, target) => { const relative = path.relative(base, target); return !relative || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
function inCheckoutOrRuntimeBundle(target) {
  // A copied CLI has a different root. Also recognize repository/worktree and
  // runtime-package ancestors so moving the tool never makes them data stores.
  for (let current = target; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git')) || fs.existsSync(path.join(current, 'dating-package.json'))) return true;
    if (path.dirname(current) === current) return false;
  }
}
function privatePath(filename, { directory = false, newPath = false, max = MAX_JSON } = {}) {
  ensure(typeof filename === 'string' && path.isAbsolute(filename), 'backup-absolute-path-required');
  const target = path.resolve(filename), parent = path.dirname(target);
  ensure(!repositories.some(repo => inside(repo, target)) && !inCheckoutOrRuntimeBundle(target), 'backup-repository-path-forbidden');
  ensure(fs.realpathSync(parent) === parent, 'backup-linked-path');
  if (newPath) {
    let existing;
    try { existing = fs.lstatSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    ensure(!existing, 'backup-target-exists'); return target;
  }
  const stat = fs.lstatSync(target);
  ensure(!stat.isSymbolicLink() && fs.realpathSync(target) === target, 'backup-linked-path');
  ensure(directory ? stat.isDirectory() : stat.isFile() && stat.size > 0 && stat.size <= max, 'backup-file-invalid');
  return target;
}
function read(filename, max = MAX_JSON) {
  const target = privatePath(filename, { max }), bytes = fs.readFileSync(target);
  ensure(bytes.length > 0 && bytes.length <= max, 'backup-file-invalid');
  return { path: target, bytes, sha256: hash(bytes), max };
}
function json(filename, max = MAX_JSON) {
  const file = read(filename, max); let value;
  try { value = JSON.parse(file.bytes); } catch { fail('backup-json-invalid'); }
  ensure(plain(value), 'backup-json-invalid'); return { ...file, value };
}
function environment(value) {
  ensure(plain(value) && Object.keys(value).sort().join(',') === 'accountApiUrl,audience,clientId,issuer'
    && value.issuer === 'synk-account' && value.audience === 'atlas-dating'
    && typeof value.clientId === 'string' && value.clientId.length > 0 && value.clientId.length <= 200, 'backup-environment-invalid');
  let url; try { url = new URL(value.accountApiUrl); } catch { fail('backup-environment-invalid'); }
  ensure(url.href === value.accountApiUrl && !url.username && !url.password && !url.search && !url.hash
    && (url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)), 'backup-environment-invalid');
  return value;
}
function checkpointed(filename) {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    let present = false; try { fs.lstatSync(filename + suffix); present = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    ensure(!present, 'backup-database-not-checkpointed');
  }
}
export function readDatingBackupConfig(command, filename) {
  ensure(['create', 'verify', 'restore', 'reconcile'].includes(command), 'backup-arguments');
  const file = json(filename, 65536), value = file.value;
  const fields = command === 'create' ? ['version', 'operatorConfirmedAllWritersStopped', 'environment', 'databasePath', 'evidencePath', 'destination']
    : ['restore', 'reconcile'].includes(command) ? ['version', 'operatorConfirmedAllWritersStopped', 'environment', 'bundlePath', 'expectedManifestSha256', 'latestEvidencePath', 'destination']
      : ['version', 'bundlePath', 'expectedManifestSha256'];
  ensure(Object.keys(value).sort().join(',') === fields.sort().join(',') && value.version === 1, 'backup-config-invalid');
  const config = { ...value };
  if (command !== 'verify') {
    ensure(config.operatorConfirmedAllWritersStopped === true, 'backup-writer-confirmation-required');
    environment(config.environment); config.destination = privatePath(config.destination, { newPath: true });
  }
  if (command === 'create') {
    config.databasePath = privatePath(config.databasePath, { max: MAX_DB }); checkpointed(config.databasePath);
    config.evidencePath = privatePath(config.evidencePath);
    ensure(config.databasePath !== config.evidencePath, 'backup-inputs-invalid');
  } else {
    ensure(/^[a-f0-9]{64}$/.test(config.expectedManifestSha256 || ''), 'backup-trusted-hash-required');
    config.bundlePath = privatePath(config.bundlePath, { directory: true });
  }
  if (['restore', 'reconcile'].includes(command)) {
    config.latestEvidencePath = privatePath(config.latestEvidencePath);
    ensure(!inside(config.bundlePath, config.latestEvidencePath) && !inside(config.bundlePath, config.destination), 'backup-independent-latest-required');
  }
  return Object.freeze(config);
}
function durableWrite(filename, bytes) {
  const descriptor = fs.openSync(filename, 'wx', 0o600);
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}
function sourceUnchanged(files) {
  for (const file of files) ensure(read(file.path, file.max).sha256 === file.sha256, 'backup-source-changed');
}
const boundaries = Object.freeze({ localOnly: true, serviceStarted: false, remoteLatestVerified: false,
  centralWriterFreezeVerified: false, encrypted: false, offsiteCopyVerified: false });

function verify(config, { staged = false } = {}) {
  const bundle = privatePath(config.bundlePath, { directory: true });
  const manifest = json(path.join(bundle, 'manifest.json'), 65536);
  ensure(manifest.sha256 === config.expectedManifestSha256, 'backup-manifest-changed');
  const value = manifest.value;
  ensure(value.version === 1 && value.kind === 'atlas-dating-backup' && Array.isArray(value.files)
    && value.files.length === 2, 'backup-manifest-invalid');
  environment(value.environment);
  ensure(JSON.stringify(fs.readdirSync(bundle).sort()) === JSON.stringify([...FILES, 'manifest.json', ...(staged ? [INCOMPLETE] : [])].sort()), 'backup-unexpected-files');
  const files = FILES.map((name, index) => {
    const item = value.files[index];
    ensure(item?.path === name && Number.isSafeInteger(item.bytes) && item.bytes > 0
      && /^[a-f0-9]{64}$/.test(item.sha256 || ''), 'backup-manifest-invalid');
    const file = read(path.join(bundle, name), name === 'account.sqlite' ? MAX_DB : MAX_JSON);
    ensure(file.bytes.length === item.bytes && file.sha256 === item.sha256, 'backup-file-changed'); return file;
  });
  checkpointed(files[0].path);
  const checked = inspectDatingBackupPair({ databasePath: files[0].path, evidencePath: files[1].path, expectedEnvironment: value.environment });
  ensure(checked.summary.productSha256 === files[0].sha256 && checked.summary.evidenceSha256 === files[1].sha256, 'backup-source-changed');
  sourceUnchanged([...files, manifest]);
  return { files, manifest, checked, summary: { ok: true, kind: 'atlas-dating-backup-verify', files: 2,
    manifestSha256: manifest.sha256, accountCount: checked.summary.accountCount, restoreAdmitted: false, ...boundaries } };
}
export function runDatingBackup(command, configPath, { checkOnly = false } = {}) {
  // Re-read and revalidate private config on every invocation, including writes.
  const config = readDatingBackupConfig(command, configPath);
  if (checkOnly) return { ok: true, kind: 'atlas-dating-backup-config', operation: command,
    filesWritten: 0, databaseOpened: false, restoreAdmitted: false, ...boundaries };
  if (command === 'verify') return verify(config).summary;
  if (command === 'reconcile') return reconcile(config);
  let files, manifest, originalChecks;
  if (command === 'create') {
    const checked = inspectDatingBackupPair({ databasePath: config.databasePath, evidencePath: config.evidencePath, expectedEnvironment: config.environment });
    files = [read(config.databasePath, MAX_DB), read(config.evidencePath)];
    ensure(files[0].sha256 === checked.summary.productSha256 && files[1].sha256 === checked.summary.evidenceSha256, 'backup-source-changed');
    manifest = { version: 1, kind: 'atlas-dating-backup', environment: config.environment,
      files: files.map((file, index) => ({ path: FILES[index], bytes: file.bytes.length, sha256: file.sha256 })) };
    originalChecks = [...files];
  } else {
    const checked = verify(config); files = checked.files;
    ensure(canonical(checked.manifest.value.environment) === canonical(config.environment), 'backup-environment-mismatch');
    const latest = read(config.latestEvidencePath);
    inspectDatingRestore({ databasePath: files[0].path, evidencePath: files[1].path,
      latestEvidencePath: latest.path, expectedEnvironment: config.environment });
    originalChecks = [...files, checked.manifest, latest];
  }
  privatePath(config.destination, { newPath: true }); fs.mkdirSync(config.destination, { mode: 0o700 });
  durableWrite(path.join(config.destination, INCOMPLETE), Buffer.from('Incomplete offline copy. Do not resume.\n'));
  // From here on, a failed private staging directory remains for diagnosis.
  // No original is overwritten, and no server or network connection is opened.
  for (let index = 0; index < files.length; index++) durableWrite(path.join(config.destination, FILES[index]), files[index].bytes);
  sourceUnchanged(originalChecks); checkpointed(files[0].path);
  const target = { databasePath: path.join(config.destination, FILES[0]), evidencePath: path.join(config.destination, FILES[1]), expectedEnvironment: config.environment };
  if (command === 'create') {
    inspectDatingBackupPair(target);
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n'); durableWrite(path.join(config.destination, 'manifest.json'), bytes);
    const result = verify({ bundlePath: config.destination, expectedManifestSha256: hash(bytes) }, { staged: true }).summary;
    sourceUnchanged(originalChecks); checkpointed(files[0].path);
    fs.unlinkSync(path.join(config.destination, INCOMPLETE));
    return { ...result, kind: 'atlas-dating-backup-create', operatorConfirmedAllWritersStopped: true };
  }
  const restored = inspectDatingStagedRestore({ ...target, latestEvidencePath: config.latestEvidencePath });
  sourceUnchanged(originalChecks);
  const receipt = { version: 1, kind: 'atlas-dating-backup-restored-files', manifestSha256: config.expectedManifestSha256,
    checkedAt: restored.summary.checkedAt, latestObservedAt: restored.summary.latestObservedAt,
    files: 2, resumeRequired: true, restoreAdmitted: false, ...boundaries };
  durableWrite(path.join(config.destination, 'restore-receipt.json'), Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
  sourceUnchanged(originalChecks);
  fs.unlinkSync(path.join(config.destination, INCOMPLETE));
  return { ok: true, ...receipt, operatorConfirmedAllWritersStopped: true };
}

async function reconcile(config) {
  const checked = verify(config), files = checked.files;
  ensure(canonical(checked.manifest.value.environment) === canonical(config.environment), 'backup-environment-mismatch');
  const latest = read(config.latestEvidencePath), originals = [...files, checked.manifest, latest];
  const prepared = prepareDatingReconciliation({ databasePath: files[0].path, evidencePath: files[1].path,
    latestEvidencePath: latest.path, expectedEnvironment: config.environment, sourceManifestSha256: config.expectedManifestSha256 });
  sourceUnchanged(originals);
  privatePath(config.destination, { newPath: true }); fs.mkdirSync(config.destination, { mode: 0o700 });
  durableWrite(path.join(config.destination, INCOMPLETE), Buffer.from('Incomplete offline reconciliation. Do not resume.\n'));
  const databasePath = path.join(config.destination, FILES[0]), evidencePath = path.join(config.destination, FILES[1]);
  durableWrite(databasePath, files[0].bytes);
  const applied = await applyDatingReconciliation(prepared.plan, { databasePath });
  const evidenceBytes = Buffer.from(JSON.stringify(applied.pairedEvidence, null, 2) + '\n');
  ensure(evidenceBytes.length <= MAX_JSON, 'backup-file-invalid');
  durableWrite(evidencePath, evidenceBytes);
  const restored = inspectDatingStagedRestore({ databasePath, evidencePath, latestEvidencePath: latest.path,
    expectedEnvironment: config.environment });
  sourceUnchanged(originals); checkpointed(databasePath);
  const receipt = { version: 1, kind: 'atlas-dating-backup-reconciled-files', manifestSha256: config.expectedManifestSha256,
    checkedAt: restored.summary.checkedAt, latestObservedAt: restored.summary.latestObservedAt,
    productSha256: hash(fs.readFileSync(databasePath)), evidenceSha256: hash(evidenceBytes), latestEvidenceSha256: latest.sha256,
    files: 2, resumeRequired: true, restoreAdmitted: false, ...boundaries };
  durableWrite(path.join(config.destination, 'restore-receipt.json'), Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
  sourceUnchanged(originals); checkpointed(databasePath);
  // The marker is the final filesystem mutation. An interrupted/failed copy
  // remains ineligible for admission even if its final JSON was fully written.
  fs.unlinkSync(path.join(config.destination, INCOMPLETE));
  return { ok: true, ...receipt, operatorConfirmedAllWritersStopped: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let args = process.argv.slice(2), checkOnly = args[0] === '--check-config';
    if (checkOnly) args = args.slice(1);
    ensure(args.length === 2, 'backup-arguments');
    console.log(JSON.stringify(await runDatingBackup(args[0], args[1], { checkOnly })));
  } catch (error) {
    const code = /^(backup|restore|reconcile|central|product|terminal|known)-[a-z0-9-]+$/.test(error?.code || '') ? error.code : 'backup-io-failed';
    console.error(JSON.stringify({ ok: false, error: { code } })); process.exitCode = 1;
  }
}
