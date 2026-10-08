import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { runDatingBackup } from '../tools/atlas-dating-backup.mjs';
import { DatabaseSync } from 'node:sqlite';
import { inspectDatingRestore } from '../experiences/atlas-lab/dating-restore.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), cli = path.join(root, 'tools/atlas-dating-backup.mjs'), serverCLI = path.join(root, 'experiences/atlas-lab/dating-server.mjs');
const execute = promisify(execFile), digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SYNK_DATING_')));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const inventory = dir => Object.fromEntries(fs.readdirSync(dir).sort().map(name => [name, fs.statSync(path.join(dir, name)).isDirectory() ? 'directory' : digest(path.join(dir, name))]));
function fixture(t, { accountApiUrl = 'http://127.0.0.1:1/' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-dating-backup-tool-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-dating-backup-tool-')); fs.rmSync(dir, { recursive: true, force: true }); });
  const environment = { accountApiUrl, clientId: 'synthetic-backup-tool', issuer: 'synk-account', audience: 'atlas-dating' };
  const databasePath = path.join(dir, 'source.sqlite'), evidencePath = path.join(dir, 'source-paired.json'), latestEvidencePath = path.join(dir, 'independent-latest.json');
  const subject = randomUUID(), event = randomUUID(), at = new Date().toISOString();
  const store = createDatingStore({ path: databasePath, mode: 'account' });
  try { store.transaction(tx => { tx.ensureAccount(subject, { nickname: '비공개 합성 이름', private: 'synthetic-secret-never-print' });
    tx.putCentralAvailability(subject, 1, 'active', false, at); tx.rememberAvailabilitySequence(subject, 1, 'active');
    tx.putLifecycleReceipt('synk-account', event, 'a'.repeat(64), at, { status: 'applied', subjectId: subject, sequence: 1 }); }); }
  finally { store.close(); }
  const central = { accounts: [{ synk_user_id: subject, status: 'active' }], cursor: [{ subject_id: subject, sequence: 1 }],
    events: [{ event_id: event, subject_id: subject, sequence: 1, status: 'active', state: 'delivered' }], deletion: [] };
  const paired = { version: 1, kind: 'atlas-dating-restore-snapshot', exportId: randomUUID(), environment,
    capturedAt: at, productSha256: digest(databasePath), central };
  const latest = { version: 1, kind: 'atlas-dating-restore-latest', exportId: randomUUID(), environment,
    observedAt: at, source: 'independent-current-central-ledger', central: structuredClone(central) };
  const saveEvidence = () => { fs.writeFileSync(evidencePath, JSON.stringify(paired)); fs.writeFileSync(latestEvidencePath, JSON.stringify(latest)); };
  saveEvidence();
  const bundle = path.join(dir, 'backup'), destination = path.join(dir, 'restored');
  const configs = {
    create: { version: 1, operatorConfirmedAllWritersStopped: true, environment, databasePath, evidencePath, destination: bundle },
    verify: { version: 1, bundlePath: bundle, expectedManifestSha256: '0'.repeat(64) },
    restore: { version: 1, operatorConfirmedAllWritersStopped: true, environment, bundlePath: bundle,
      expectedManifestSha256: '0'.repeat(64), latestEvidencePath, destination }
  };
  configs.reconcile = structuredClone(configs.restore);
  const configPaths = Object.fromEntries(Object.keys(configs).map(kind => [kind, path.join(dir, kind + '.config.json')]));
  const saveConfig = () => { for (const [kind, value] of Object.entries(configs)) fs.writeFileSync(configPaths[kind], JSON.stringify(value)); };
  saveConfig();
  const create = () => { const result = runDatingBackup('create', configPaths.create); configs.verify.expectedManifestSha256 = result.manifestSha256;
    configs.restore.expectedManifestSha256 = result.manifestSha256; configs.reconcile.expectedManifestSha256 = result.manifestSha256; saveConfig(); return result; };
  const run = kind => runDatingBackup(kind, configPaths[kind]);
  const assertPrivate = text => { for (const value of [dir, subject, event, '비공개 합성 이름', 'synthetic-secret-never-print', environment.clientId]) assert.ok(!text.includes(value), 'Output must omit private test data'); };
  return { dir, environment, databasePath, evidencePath, latestEvidencePath, paired, latest, saveEvidence, configs, configPaths, saveConfig, bundle, destination, create, run, assertPrivate, subject };
}

test('actual CLI config checks are read-only and create/verify/restore preserves its sources then resumes through the existing gate', { timeout: 25000 }, async t => {
  let child, identity, exited; t.after(async () => { if (child && child.exitCode === null && child.signalCode === null) child.kill(); if (exited) await exited;
    if (identity) { identity.closeAllConnections(); await new Promise(resolve => identity.close(resolve)); } });
  let requests = 0; identity = http.createServer((_req, res) => { requests++; res.writeHead(500).end(); }); await listen(identity);
  const identityOrigin = `http://127.0.0.1:${identity.address().port}`, f = fixture(t, { accountApiUrl: identityOrigin + '/' });
  const options = { env: cleanEnv(), windowsHide: true, timeout: 10000 };
  const before = inventory(f.dir), sourceHash = digest(f.databasePath), pairedHash = digest(f.evidencePath);
  const check = await execute(process.execPath, [cli, '--check-config', 'create', f.configPaths.create], options);
  assert.equal(JSON.parse(check.stdout).databaseOpened, false); assert.deepEqual(inventory(f.dir), before); f.assertPrivate(check.stdout + check.stderr);
  const created = await execute(process.execPath, [cli, 'create', f.configPaths.create], options), createdResult = JSON.parse(created.stdout);
  f.configs.verify.expectedManifestSha256 = createdResult.manifestSha256; f.configs.restore.expectedManifestSha256 = createdResult.manifestSha256; f.saveConfig();
  assert.deepEqual(fs.readdirSync(f.bundle).sort(), ['account.sqlite', 'manifest.json', 'paired.json']);
  const verified = await execute(process.execPath, [cli, 'verify', f.configPaths.verify], options); assert.equal(JSON.parse(verified.stdout).restoreAdmitted, false);
  const restored = await execute(process.execPath, [cli, 'restore', f.configPaths.restore], options); assert.equal(JSON.parse(restored.stdout).serviceStarted, false);
  assert.deepEqual(fs.readdirSync(f.destination).sort(), ['account.sqlite', 'paired.json', 'restore-receipt.json']);
  assert.equal(digest(path.join(f.destination, 'account.sqlite')), sourceHash); assert.equal(digest(path.join(f.destination, 'paired.json')), pairedHash);
  assert.equal(digest(f.databasePath), sourceHash); assert.equal(digest(f.evidencePath), pairedHash);
  for (const result of [created, verified, restored]) f.assertPrivate(result.stdout + result.stderr);
  const reservation = net.createServer(); await listen(reservation); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const publicConfig = path.join(f.dir, 'public.json'); fs.writeFileSync(publicConfig, JSON.stringify({ version: 1, supabaseUrl: identityOrigin,
    accountApiUrl: identityOrigin, supabasePublishableKey: 'sb_publishable_synthetic_backup', portalUrl: identityOrigin + '/id/',
    clients: { platform: { clientId: f.environment.clientId, redirectUri: `http://127.0.0.1:${port}/atlas-lab/dating.html` } } }));
  const env = { ...cleanEnv(), SYNK_DATING_MODE: 'account', SYNK_DATING_PORT: String(port), SYNK_DATING_ACCOUNT_CONFIG: publicConfig,
    SYNK_DATING_DB: path.join(f.destination, 'account.sqlite'), SYNK_DATING_RESTORE_EVIDENCE: path.join(f.destination, 'paired.json'), SYNK_DATING_RESTORE_LATEST: f.latestEvidencePath };
  const inspected = await execute(process.execPath, [serverCLI, '--check-restore'], { ...options, env }); assert.equal(JSON.parse(inspected.stdout).ok, true); f.assertPrivate(inspected.stdout + inspected.stderr);
  let stdout = '', stderr = ''; child = spawn(process.execPath, [serverCLI, '--resume-after-restore'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', part => { stdout += part; }); child.stderr.on('data', part => { stderr += part; }); exited = new Promise(resolve => child.once('exit', resolve));
  for (let i = 0; i < 150 && !stdout.includes('SYNK 나다운 만남 (account):') && child.exitCode === null; i++) await tick(20);
  assert.match(stdout, /SYNK 나다운 만남 \(account\):/, stderr);
  const response = await fetch(`http://127.0.0.1:${port}/api/atlas-dating/config`, { headers: { Connection: 'close' }, signal: AbortSignal.timeout(2000) });
  assert.equal(response.status, 200); assert.equal((await response.json()).demoEnabled, false); assert.equal(requests, 0); f.assertPrivate(stdout + stderr);
});

test('old consistent paired backups can be archived but a stale independent latest export cannot authorize copying for resume', t => {
  const f = fixture(t); f.paired.capturedAt = new Date(Date.now() - 90 * 86400000).toISOString(); f.saveEvidence();
  assert.equal(f.create().ok, true); assert.equal(f.run('verify').ok, true);
  f.latest.observedAt = new Date(Date.now() - 6 * 60000).toISOString(); f.saveEvidence();
  assert.throws(() => f.run('restore'), { code: 'restore-latest-evidence-stale' }); assert.equal(fs.existsSync(f.destination), false);
});

test('fresh independent deletion or a newer restriction rejects a mutually coherent older backup', t => {
  const f = fixture(t); f.create();
  f.latest.central.accounts[0].status = 'deleted'; f.latest.central.deletion.push({ event_id: randomUUID(), subject_id: f.subject, state: 'pending' }); f.saveEvidence();
  assert.throws(() => f.run('restore'), { code: 'known-terminal-deletion-missing' }); assert.equal(fs.existsSync(f.destination), false);
  f.latest.central = structuredClone(f.paired.central); f.latest.central.accounts[0].status = 'disabled'; f.latest.central.cursor[0].sequence = 2;
  f.latest.central.events.push({ event_id: randomUUID(), subject_id: f.subject, sequence: 2, status: 'disabled', state: 'pending' }); f.saveEvidence();
  assert.throws(() => f.run('restore'), { code: 'known-newer-central-sequence-missing' }); assert.equal(fs.existsSync(f.destination), false);
});

test('actual reconciliation CLI applies a hold then reactivation without restoring public consent or changing the original backup', async t => {
  const f = fixture(t); f.create(); const before = inventory(f.bundle), original = digest(f.databasePath);
  const at = new Date().toISOString(); f.latest.observedAt = at;
  f.latest.central.cursor[0].sequence = 3;
  f.latest.central.events.push(...['disabled', 'active'].map((status, index) => ({ event_id: randomUUID(), subject_id: f.subject,
    sequence: index + 2, status, state: 'delivered', occurred_at: at })));
  f.saveEvidence();
  const options = { env: cleanEnv(), windowsHide: true, timeout: 10000 };
  const checked = await execute(process.execPath, [cli, '--check-config', 'reconcile', f.configPaths.reconcile], options);
  assert.equal(JSON.parse(checked.stdout).databaseOpened, false); assert.equal(fs.existsSync(f.destination), false);
  const completed = await execute(process.execPath, [cli, 'reconcile', f.configPaths.reconcile], options);
  const summary = JSON.parse(completed.stdout); assert.equal(summary.kind, 'atlas-dating-backup-reconciled-files');
  assert.equal(summary.restoreAdmitted, false); assert.equal(summary.serviceStarted, false); f.assertPrivate(completed.stdout + completed.stderr);
  assert.deepEqual(inventory(f.bundle), before); assert.equal(digest(f.databasePath), original);
  assert.deepEqual(fs.readdirSync(f.destination).sort(), ['account.sqlite', 'paired.json', 'restore-receipt.json']);
  const databasePath = path.join(f.destination, 'account.sqlite'), evidencePath = path.join(f.destination, 'paired.json');
  const result = inspectDatingRestore({ databasePath, evidencePath, latestEvidencePath: f.latestEvidencePath, expectedEnvironment: f.environment });
  assert.equal(result.summary.ok, true);
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = db.prepare('SELECT * FROM dating_accounts WHERE id=?').get(f.subject), document = JSON.parse(row.document);
    assert.equal(row.status, 'active'); assert.equal(document.consents.profilePublic, false); assert.equal(document.consents.receiveInvitations, false);
    const fence = db.prepare('SELECT * FROM dating_central_availability WHERE subject_id=?').get(f.subject);
    assert.equal(fence.sequence, 3); assert.equal(fence.resume_required, 1);
  } finally { db.close(); }
});

test('reconciliation CLI applies a terminal deletion into a separate copy before granting any resume inspection', async t => {
  const f = fixture(t); f.create(); const before = inventory(f.bundle);
  f.latest.observedAt = new Date().toISOString(); f.latest.central.accounts[0].status = 'deleted';
  f.latest.central.deletion.push({ event_id: randomUUID(), subject_id: f.subject, state: 'delivered', occurred_at: f.latest.observedAt }); f.saveEvidence();
  const result = await execute(process.execPath, [cli, 'reconcile', f.configPaths.reconcile], { env: cleanEnv(), windowsHide: true, timeout: 10000 });
  assert.equal(JSON.parse(result.stdout).resumeRequired, true); f.assertPrivate(result.stdout + result.stderr);
  assert.deepEqual(inventory(f.bundle), before);
  const databasePath = path.join(f.destination, 'account.sqlite'), evidencePath = path.join(f.destination, 'paired.json');
  assert.equal(inspectDatingRestore({ databasePath, evidencePath, latestEvidencePath: f.latestEvidencePath, expectedEnvironment: f.environment }).summary.deletedAccountCount, 1);
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try { const row = db.prepare('SELECT * FROM dating_accounts WHERE id=?').get(f.subject); assert.equal(row.status, 'deleted'); assert.equal(row.document, null); }
  finally { db.close(); }
});

test('bundle manifests require an independent hash and exact inventory with unchanged payload bytes', t => {
  const f = fixture(t); f.create(); const manifest = path.join(f.bundle, 'manifest.json'), bytes = fs.readFileSync(manifest);
  f.configs.verify.expectedManifestSha256 = '0'.repeat(64); f.saveConfig(); assert.throws(() => f.run('verify'), { code: 'backup-manifest-changed' });
  f.configs.verify.expectedManifestSha256 = digest(manifest); f.saveConfig();
  fs.appendFileSync(manifest, ' '); assert.throws(() => f.run('verify'), { code: 'backup-manifest-changed' }); fs.writeFileSync(manifest, bytes);
  const data = path.join(f.bundle, 'account.sqlite'), original = fs.readFileSync(data); fs.appendFileSync(data, 'synthetic damage');
  assert.throws(() => f.run('verify'), { code: 'backup-file-changed' }); fs.writeFileSync(data, original);
  const extra = path.join(f.bundle, 'latest.json'); fs.writeFileSync(extra, JSON.stringify(f.latest));
  assert.throws(() => f.run('verify'), { code: 'backup-unexpected-files' });
  f.configs.restore.latestEvidencePath = extra; f.saveConfig(); assert.throws(() => f.run('restore'), { code: 'backup-independent-latest-required' });
});

test('mismatched environments and unconfirmed writers fail before any destination is created', t => {
  const f = fixture(t); f.configs.create.operatorConfirmedAllWritersStopped = false; f.saveConfig();
  assert.throws(() => f.run('create'), { code: 'backup-writer-confirmation-required' }); assert.equal(fs.existsSync(f.bundle), false);
  f.configs.create.operatorConfirmedAllWritersStopped = true; f.configs.create.environment = { ...f.environment, clientId: 'different-synthetic-client' }; f.saveConfig();
  assert.throws(() => f.run('create'), { code: 'restore-environment-mismatch' }); assert.equal(fs.existsSync(f.bundle), false);
  f.configs.create.environment = f.environment; f.saveConfig(); f.create();
  f.configs.restore.environment = { ...f.environment, clientId: 'different-synthetic-client' }; f.saveConfig();
  assert.throws(() => f.run('restore'), { code: 'backup-environment-mismatch' }); assert.equal(fs.existsSync(f.destination), false);
});

test('existing backup and restoration destinations are preserved instead of overwritten', t => {
  const f = fixture(t); f.create(); const before = inventory(f.bundle);
  assert.throws(() => f.run('create'), { code: 'backup-target-exists' }); assert.deepEqual(inventory(f.bundle), before);
  fs.mkdirSync(f.destination); fs.writeFileSync(path.join(f.destination, 'keep.txt'), 'untouched');
  assert.throws(() => f.run('restore'), { code: 'backup-target-exists' }); assert.equal(fs.readFileSync(path.join(f.destination, 'keep.txt'), 'utf8'), 'untouched');
});

test('sidecars and linked input/output paths are rejected without changing source files', t => {
  const f = fixture(t), sidecar = f.databasePath + '-wal', before = digest(f.databasePath);
  fs.writeFileSync(sidecar, 'synthetic sidecar'); assert.throws(() => f.run('create'), { code: 'backup-database-not-checkpointed' }); fs.unlinkSync(sidecar);
  const linked = path.join(f.dir, 'linked'), real = path.join(f.dir, 'real'); fs.mkdirSync(real); fs.symlinkSync(real, linked, process.platform === 'win32' ? 'junction' : 'dir');
  f.configs.create.destination = path.join(linked, 'new-backup'); f.saveConfig(); assert.throws(() => f.run('create'), { code: 'backup-linked-path' });
  f.configs.create.destination = f.bundle; f.configs.create.databasePath = path.join(linked, 'source.sqlite'); fs.copyFileSync(f.databasePath, path.join(real, 'source.sqlite')); f.saveConfig();
  assert.throws(() => f.run('create'), { code: 'backup-linked-path' }); assert.equal(digest(f.databasePath), before); assert.equal(fs.existsSync(f.bundle), false);
});

test('private config and outputs cannot live in either source repository and CLI errors omit paths or private data', async t => {
  const f = fixture(t);
  assert.throws(() => runDatingBackup('create', path.join(root, 'experiences/atlas-lab/deploy/account.public.example.json')), { code: 'backup-repository-path-forbidden' });
  f.configs.create.destination = path.join(root, 'must-not-create-' + randomUUID()); f.saveConfig();
  await assert.rejects(execute(process.execPath, [cli, 'create', f.configPaths.create], { env: cleanEnv(), windowsHide: true, timeout: 10000 }), error => {
    assert.equal(error.code, 1); assert.equal(error.stdout, ''); assert.equal(JSON.parse(error.stderr).error.code, 'backup-repository-path-forbidden'); f.assertPrivate(error.stderr); return true;
  });
  assert.equal(fs.existsSync(f.configs.create.destination), false);
  f.configs.create.destination = path.resolve(root, '../SYNK-talk/must-not-create-' + randomUUID()); f.saveConfig();
  assert.throws(() => f.run('create'), { code: 'backup-repository-path-forbidden' }); assert.equal(fs.existsSync(f.configs.create.destination), false);
  for (const [name, marker, directory] of [['checkout', '.git', true], ['worktree', '.git', false], ['runtime', 'dating-package.json', false]]) {
    const marked = path.join(f.dir, name), nested = path.join(marked, 'nested'); fs.mkdirSync(nested, { recursive: true });
    if (directory) fs.mkdirSync(path.join(marked, marker)); else fs.writeFileSync(path.join(marked, marker), 'synthetic marker');
    const markedConfig = path.join(nested, 'private-config.json'); fs.copyFileSync(f.configPaths.create, markedConfig);
    assert.throws(() => runDatingBackup('create', markedConfig), { code: 'backup-repository-path-forbidden' });
    f.configs.create.destination = path.join(nested, 'backup'); f.configs.create.databasePath = f.databasePath; f.saveConfig();
    assert.throws(() => f.run('create'), { code: 'backup-repository-path-forbidden' }); assert.equal(fs.existsSync(f.configs.create.destination), false);
    const markedSource = path.join(nested, 'source.sqlite'); fs.copyFileSync(f.databasePath, markedSource);
    f.configs.create.destination = f.bundle; f.configs.create.databasePath = markedSource; f.saveConfig();
    assert.throws(() => f.run('create'), { code: 'backup-repository-path-forbidden' }); assert.equal(fs.existsSync(f.bundle), false);
  }
});
