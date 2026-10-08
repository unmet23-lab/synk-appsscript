import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { inspectDatingRestore } from '../experiences/atlas-lab/dating-restore.mjs';
import { runDatingBackup } from '../tools/atlas-dating-backup.mjs';

const cli = fileURLToPath(new URL('../tools/atlas-dating-backup.mjs', import.meta.url));
const hash = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SYNK_DATING_')));
const incompleteMarker = '.backup-incomplete';

// Only these test children replace fs methods. Production code has no fault hook,
// environment switch, or additional exported mutation capability.
const shim = String.raw`
import fs from 'node:fs';
import path from 'node:path';
const instruction = JSON.parse(fs.readFileSync(process.env.SYNK_BACKUP_FAULT_CONFIG, 'utf8'));
const open = fs.openSync, close = fs.closeSync, writeFile = fs.writeFileSync, fsync = fs.fsyncSync, unlink = fs.unlinkSync;
const descriptors = new Map();
fs.openSync = function(filename, ...args) {
  const fd = Reflect.apply(open, this, [filename, ...args]);
  if (typeof filename === 'string') descriptors.set(fd, path.resolve(filename));
  return fd;
};
fs.closeSync = function(fd, ...args) {
  try { return Reflect.apply(close, this, [fd, ...args]); } finally { descriptors.delete(fd); }
};
const matches = fd => descriptors.get(fd) === instruction.target;
function ioFailure() {
  throw Object.assign(new Error('synthetic private file failure: ' + instruction.target), { code: instruction.code });
}
function awaitTermination() {
  process.send({ faultReady: true });
  // The parent terminates this real child after observing the IPC boundary.
  // Waiting here prevents a race in which the normal writer could finish.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15000);
  process.exit(91);
}
fs.writeFileSync = function(fd, bytes, ...args) {
  if (matches(fd) && ['partial-write', 'interrupt'].includes(instruction.mode)) {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    Reflect.apply(writeFile, this, [fd, buffer.subarray(0, Math.max(1, Math.floor(buffer.length / 2))), ...args]);
    if (instruction.mode === 'partial-write') ioFailure();
    awaitTermination();
  }
  return Reflect.apply(writeFile, this, [fd, bytes, ...args]);
};
fs.fsyncSync = function(fd, ...args) {
  if (matches(fd) && instruction.mode === 'fsync') ioFailure();
  return Reflect.apply(fsync, this, [fd, ...args]);
};
fs.unlinkSync = function(filename, ...args) {
  if (path.resolve(filename) === instruction.target) {
    if (instruction.mode === 'unlink') ioFailure();
    if (instruction.mode === 'unlink-interrupt') awaitTermination();
  }
  return Reflect.apply(unlink, this, [filename, ...args]);
};
`;

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-backup-failure-'));
  let completed = false;
  t.after(() => {
    if (!completed) { t.diagnostic('Synthetic failure artifacts retained in a private temporary directory; path omitted.'); return; }
    const resolved = fs.realpathSync(dir), temp = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), temp);
    assert.ok(path.basename(resolved).startsWith('synk-backup-failure-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const environment = { accountApiUrl: 'http://127.0.0.1:1/', clientId: 'synthetic-backup-failure', issuer: 'synk-account', audience: 'atlas-dating' };
  const databasePath = path.join(dir, 'original.sqlite'), evidencePath = path.join(dir, 'original-paired.json');
  const latestEvidencePath = path.join(dir, 'independent-latest.json');
  const subject = randomUUID(), event = randomUUID(), at = new Date().toISOString();
  const store = createDatingStore({ path: databasePath, mode: 'account' });
  try {
    store.transaction(tx => {
      tx.ensureAccount(subject, { nickname: '장애 시험 합성 이름', private: 'synthetic-private-failure-fixture' });
      tx.putCentralAvailability(subject, 1, 'active', false, at);
      tx.rememberAvailabilitySequence(subject, 1, 'active');
      tx.putLifecycleReceipt('synk-account', event, 'b'.repeat(64), at, { status: 'applied', subjectId: subject, sequence: 1 });
    });
  } finally { store.close(); }
  const central = { accounts: [{ synk_user_id: subject, status: 'active' }], cursor: [{ subject_id: subject, sequence: 1 }],
    events: [{ event_id: event, subject_id: subject, sequence: 1, status: 'active', state: 'delivered' }], deletion: [] };
  fs.writeFileSync(evidencePath, JSON.stringify({ version: 1, kind: 'atlas-dating-restore-snapshot', exportId: randomUUID(), environment,
    capturedAt: at, productSha256: hash(databasePath), central }));
  fs.writeFileSync(latestEvidencePath, JSON.stringify({ version: 1, kind: 'atlas-dating-restore-latest', exportId: randomUUID(), environment,
    observedAt: at, source: 'independent-current-central-ledger', central }));
  const bundle = path.join(dir, 'backup'), destination = path.join(dir, 'restored');
  const configs = {
    create: { version: 1, operatorConfirmedAllWritersStopped: true, environment, databasePath, evidencePath, destination: bundle },
    verify: { version: 1, bundlePath: bundle, expectedManifestSha256: '0'.repeat(64) },
    restore: { version: 1, operatorConfirmedAllWritersStopped: true, environment, bundlePath: bundle, expectedManifestSha256: '0'.repeat(64), latestEvidencePath, destination }
  };
  configs.reconcile = { ...configs.restore };
  const paths = Object.fromEntries(Object.keys(configs).map(key => [key, path.join(dir, key + '.json')]));
  const save = () => { for (const [key, value] of Object.entries(configs)) fs.writeFileSync(paths[key], JSON.stringify(value)); };
  save();
  const shimPath = path.join(dir, 'fault-shim.mjs'), faultPath = path.join(dir, 'fault.json');
  fs.writeFileSync(shimPath, shim);
  const sources = [databasePath, evidencePath, latestEvidencePath], before = sources.map(hash);
  const assertSources = () => assert.deepEqual(sources.map(hash), before);
  const assertPrivate = output => {
    for (const value of [dir, subject, event, environment.clientId, '장애 시험 합성 이름', 'synthetic-private-failure-fixture'])
      assert.equal(output.includes(value), false, 'CLI output must not expose private fixture material or paths');
  };
  return { dir, configs, paths, bundle, destination, shimPath, faultPath, save, assertSources, assertPrivate,
    markCompleted: () => { completed = true; } };
}

async function childCLI(f, operation, fault) {
  fs.writeFileSync(f.faultPath, JSON.stringify(fault));
  const args = fault ? ['--import', pathToFileURL(f.shimPath).href, cli, operation, f.paths[operation]] : [cli, operation, f.paths[operation]];
  const child = spawn(process.execPath, args, { env: { ...cleanEnv(), SYNK_BACKUP_FAULT_CONFIG: f.faultPath }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stdout = '', stderr = '', interrupted = false;
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('message', message => { if (message?.faultReady === true) { interrupted = true; child.kill('SIGKILL'); } });
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Synthetic child did not finish within its test deadline')); }, 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', (code, signal) => { clearTimeout(timeout); resolve({ code, signal, stdout, stderr, interrupted }); });
  });
  // Retained only on a test failure; contains synthetic data, never user records.
  fs.writeFileSync(path.join(f.dir, operation + '-child-output.json'), JSON.stringify(result));
  return result;
}

function assertFailure(f, result, interrupted) {
  assert.equal(result.stdout, '', 'A failed operation must not emit a success result or trusted manifest hash');
  f.assertPrivate(result.stdout + result.stderr);
  assert.equal(result.interrupted, interrupted);
  if (interrupted) assert.ok(result.signal || result.code !== 0, 'The actual child must have been terminated');
  else {
    assert.equal(result.code, 1);
    // Node's SQLite experimental warning is runtime metadata, not a CLI error.
    const lines = result.stderr.trim().split(/\r?\n/).filter(line => line.startsWith('{'));
    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0]), { ok: false, error: { code: 'backup-io-failed' } });
  }
  f.assertSources();
}

for (const operation of ['create', 'restore', 'reconcile']) {
  for (const fault of [
    { label: 'database partial write with disk full', file: 'account.sqlite', mode: 'partial-write', code: 'ENOSPC' },
    { label: 'paired evidence partial write with I/O failure', file: 'paired.json', mode: 'partial-write', code: 'EIO' },
    { label: 'database fsync failure', file: 'account.sqlite', mode: 'fsync', code: 'EIO' },
    { label: 'final metadata fsync failure', file: operation === 'create' ? 'manifest.json' : 'restore-receipt.json', mode: 'fsync', code: 'EIO' },
    { label: 'parent terminates the child during evidence write', file: 'paired.json', mode: 'interrupt', code: 'EIO' },
    { label: 'completion marker cannot be removed', file: incompleteMarker, mode: 'unlink', code: 'EIO' },
    { label: 'parent terminates the child before completion marker removal', file: incompleteMarker, mode: 'unlink-interrupt', code: 'EIO' }
  ]) {
    test(`${operation}: ${fault.label} preserves sources and cannot become a successful backup or receipt`, { timeout: 15000 }, async t => {
      const f = fixture(t);
      let sourceBundleBefore;
      if (operation !== 'create') {
        const created = runDatingBackup('create', f.paths.create);
        f.configs.verify.expectedManifestSha256 = created.manifestSha256;
        f.configs.restore.expectedManifestSha256 = created.manifestSha256;
        f.configs.reconcile.expectedManifestSha256 = created.manifestSha256;
        f.save();
        sourceBundleBefore = fs.readdirSync(f.bundle).sort().map(name => [name, hash(path.join(f.bundle, name))]);
      }
      const output = operation === 'create' ? f.bundle : f.destination;
      const result = await childCLI(f, operation, { ...fault, target: path.join(output, fault.file) });
      assertFailure(f, result, fault.mode.endsWith('interrupt'));
      assert.equal(fs.existsSync(output), true, 'An interrupted private staging directory remains for diagnosis');
      assert.equal(fs.existsSync(path.join(output, incompleteMarker)), true, 'Every failed copy retains its durable incomplete marker');
      assert.equal(fs.existsSync(path.join(output, fault.file)), true, 'The injected target must have been reached');
      if (fault.mode === 'partial-write' || fault.mode === 'interrupt') {
        const original = fault.file === 'account.sqlite' ? f.configs.create.databasePath : f.configs.create.evidencePath;
        const partialSize = fs.statSync(path.join(output, fault.file)).size;
        assert.ok(partialSize > 0, 'The fault must leave an actual partial copy');
        if (operation === 'reconcile' && fault.file === 'paired.json') {
          // Reconciliation generates a new, pretty-printed evidence document;
          // its full size differs from the original compact paired snapshot.
          assert.throws(() => JSON.parse(fs.readFileSync(path.join(output, fault.file), 'utf8')), SyntaxError);
        } else assert.ok(partialSize < fs.statSync(original).size, 'The partial copy must be smaller than its source');
      }
      if (operation === 'create') {
        const manifest = path.join(output, 'manifest.json');
        if (fs.existsSync(manifest)) {
          // A fully written manifest is not enough: failure at fsync may leave
          // parseable metadata, so test with its exact hash, not a dummy hash.
          f.configs.verify.expectedManifestSha256 = hash(manifest); f.save();
        }
        assert.throws(() => runDatingBackup('verify', f.paths.verify), undefined, 'An incomplete backup must be rejected even with the residual manifest hash');
      } else {
        assert.deepEqual(fs.readdirSync(f.bundle).sort().map(name => [name, hash(path.join(f.bundle, name))]), sourceBundleBefore);
        const receipt = path.join(output, 'restore-receipt.json');
        assert.ok(!fs.existsSync(receipt) || fs.existsSync(path.join(output, incompleteMarker)), 'Residual final receipt must be explicitly marked incomplete');
        assert.throws(() => inspectDatingRestore({ databasePath: path.join(output, 'account.sqlite'), evidencePath: path.join(output, 'paired.json'),
          latestEvidencePath: f.configs.restore.latestEvidencePath, expectedEnvironment: f.configs.restore.environment }), { code: 'restore-bundle-incomplete' });
        assert.throws(() => runDatingBackup(operation, f.paths[operation]), { code: 'backup-target-exists' });
        const stagedInventory = () => fs.readdirSync(output).sort().map(name => [name, hash(path.join(output, name))]);
        const stagedBefore = stagedInventory();
        let server, verifications = 0;
        try {
          assert.throws(() => { server = createDatingServer({ mode: 'account', databasePath: path.join(output, 'account.sqlite'),
            verify: async () => { verifications++; return null; } }); }, { code: 'restore-bundle-incomplete' });
        } finally { if (server) await server.shutdownDating(); }
        assert.equal(verifications, 0);
        assert.deepEqual(stagedInventory(), stagedBefore, 'Normal startup must reject the incomplete directory before opening or changing the database');
      }
      f.markCompleted();
    });
  }
}
