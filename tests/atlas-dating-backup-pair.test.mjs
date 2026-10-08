import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { inspectDatingBackupPair, inspectDatingRestore, consumeDatingRestoreAdmission } from '../experiences/atlas-lab/dating-restore.mjs';

const at = Date.parse('2026-10-08T12:00:00.000Z');
const environment = Object.freeze({ accountApiUrl: 'https://identity.example.invalid/functions/v1/synk-account',
  clientId: 'synthetic-backup-pair', issuer: 'synk-account', audience: 'atlas-dating' });
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
function fixture(t, { empty = false, mode = 'account' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-dating-backup-pair-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('synk-dating-backup-pair-')); fs.rmSync(dir, { recursive: true, force: true }); });
  const databasePath = path.join(dir, 'account.sqlite'), evidencePath = path.join(dir, 'paired.json');
  const subject = randomUUID(), event = randomUUID(), capturedAt = '2025-01-01T00:00:00.000Z';
  const store = createDatingStore({ path: databasePath, mode });
  if (!empty) store.transaction(tx => {
    tx.ensureAccount(subject, { nickname: '합성 비공개 이름', secret: 'never-print-private-document' });
    tx.putCentralAvailability(subject, 1, 'active', false, capturedAt);
    tx.rememberAvailabilitySequence(subject, 1, 'active');
    tx.putLifecycleReceipt('synk-account', event, 'a'.repeat(64), capturedAt, { status: 'applied', subjectId: subject, sequence: 1 });
  });
  store.close();
  const central = { accounts: empty ? [] : [{ synk_user_id: subject, status: 'active' }],
    cursor: empty ? [] : [{ subject_id: subject, sequence: 1 }],
    events: empty ? [] : [{ event_id: event, subject_id: subject, sequence: 1, status: 'active', state: 'delivered' }], deletion: [] };
  const paired = { version: 1, kind: 'atlas-dating-restore-snapshot', exportId: randomUUID(), environment, capturedAt, productSha256: digest(databasePath), central };
  const save = () => fs.writeFileSync(evidencePath, JSON.stringify(paired)); save();
  const options = { databasePath, evidencePath, expectedEnvironment: environment, clock: () => at };
  const inspect = extras => inspectDatingBackupPair({ ...options, ...extras });
  const editDatabase = sql => { const db = new DatabaseSync(databasePath); try { db.exec(sql); } finally { db.close(); }
    paired.productSha256 = digest(databasePath); save(); };
  return { ...options, dir, subject, event, paired, save, inspect, editDatabase };
}

test('an old consistent pair stays byte-identical and yields no restart admission or private data', t => {
  const f = fixture(t), before = fs.readdirSync(f.dir), hashes = before.map(name => digest(path.join(f.dir, name)));
  const result = f.inspect();
  assert.equal(result.summary.kind, 'atlas-dating-backup-pair-check'); assert.equal(result.summary.accountCount, 1);
  assert.equal(result.summary.capturedAt, f.paired.capturedAt); assert.equal(result.summary.productSha256, digest(f.databasePath));
  assert.equal(result.summary.evidenceSha256, digest(f.evidencePath));
  assert.equal(result.summary.restoreAdmitted, false); assert.equal(result.summary.remoteLatestVerified, false);
  assert.deepEqual(Object.keys(result), ['summary']); assert.throws(() => consumeDatingRestoreAdmission(result), /restore-admission-required/);
  assert.doesNotMatch(JSON.stringify(result), /never-print-private-document|합성|synthetic-backup-pair/);
  assert.ok(!JSON.stringify(result).includes(f.subject));
  assert.deepEqual(fs.readdirSync(f.dir), before); assert.deepEqual(before.map(name => digest(path.join(f.dir, name))), hashes);
});

test('old paired data still needs separately fresh latest evidence for the existing restart gate', t => {
  const f = fixture(t), latestEvidencePath = path.join(f.dir, 'latest.json');
  const latest = { version: 1, kind: 'atlas-dating-restore-latest', exportId: randomUUID(), environment,
    observedAt: new Date(at).toISOString(), source: 'independent-current-central-ledger', central: structuredClone(f.paired.central) };
  fs.writeFileSync(latestEvidencePath, JSON.stringify(latest));
  assert.equal(inspectDatingRestore({ ...f, latestEvidencePath }).summary.ok, true);
  latest.observedAt = f.paired.capturedAt; fs.writeFileSync(latestEvidencePath, JSON.stringify(latest));
  assert.throws(() => inspectDatingRestore({ ...f, latestEvidencePath }), /restore-latest-evidence-stale/);
  assert.equal(f.inspect().summary.restoreAdmitted, false);
});

test('future capture, wrong kind, mismatched environment and checksum damage fail pair validation', t => {
  const f = fixture(t); f.paired.capturedAt = new Date(at + 30_001).toISOString(); f.save();
  assert.throws(() => f.inspect(), /restore-evidence-future/);
  f.paired.capturedAt = new Date(at + 30_000).toISOString(); f.save(); assert.equal(f.inspect().summary.ok, true);
  f.paired.kind = 'atlas-dating-restore-latest'; f.save(); assert.throws(() => f.inspect(), /restore-evidence-invalid/);
  f.paired.kind = 'atlas-dating-restore-snapshot'; f.save();
  assert.throws(() => f.inspect({ expectedEnvironment: { ...environment, clientId: 'other-product' } }), /restore-environment-mismatch/);
  f.paired.productSha256 = '0'.repeat(64); f.save(); assert.throws(() => f.inspect(), /restore-database-checksum-mismatch/);
});

test('a pending lost-ack event cannot lose its local receipt while retaining the availability fence', t => {
  const f = fixture(t); f.paired.central.events[0].state = 'pending'; f.save(); assert.equal(f.inspect().summary.ok, true);
  f.editDatabase('DELETE FROM dating_lifecycle_receipts');
  assert.throws(() => f.inspect(), /restore-product-latest-receipt-missing/);
});

test('deleted account tombstones cannot coexist with restored private introduction history', t => {
  const f = fixture(t); f.paired.central.accounts[0].status = 'deleted';
  f.paired.central.deletion.push({ event_id: randomUUID(), subject_id: f.subject, state: 'pending' });
  f.editDatabase(`UPDATE dating_accounts SET status='deleted',document=NULL;
    INSERT INTO dating_archived_introductions VALUES('${f.subject}','${randomUUID()}',1,'${f.paired.capturedAt}','{}');`);
  assert.throws(() => f.inspect(), /terminal-private-data-returned/);
});

test('missing schema, empty pair and demo storage fail instead of creating a valid backup', t => {
  const missing = fixture(t); missing.editDatabase('DROP TABLE dating_reports');
  assert.throws(() => missing.inspect(), /restore-database-schema-missing/);
  assert.throws(() => fixture(t, { empty: true }).inspect(), /restore-empty-inventory/);
  assert.throws(() => fixture(t, { mode: 'demo' }).inspect(), /restore-database-mode-mismatch/);
});

test('uncheckpointed database sidecars prevent pair checks without touching the source', t => {
  const f = fixture(t), bytes = fs.readFileSync(f.databasePath);
  fs.writeFileSync(f.databasePath + '-wal', 'synthetic uncheckpointed writes');
  assert.throws(() => f.inspect(), /restore-database-not-checkpointed/);
  assert.deepEqual(fs.readFileSync(f.databasePath), bytes);
  assert.equal(fs.readFileSync(f.databasePath + '-wal', 'utf8'), 'synthetic uncheckpointed writes');
});

test('pair file changes during a check are detected by the final fingerprint comparison', t => {
  const f = fixture(t), originalRead = fs.readFileSync; let changed = false;
  fs.readFileSync = (filename, ...args) => {
    const result = originalRead(filename, ...args);
    if (!changed && filename === f.evidencePath) { changed = true; fs.appendFileSync(filename, ' '); }
    return result;
  };
  try { assert.throws(() => f.inspect(), /restore-files-changed/); }
  finally { fs.readFileSync = originalRead; }
  assert.equal(changed, true);
});
