import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { inspectDatingRestore, consumeDatingRestoreAdmission, DATING_RESTORE_MAX_AGE_MS } from '../experiences/atlas-lab/dating-restore.mjs';

const at = Date.parse('2026-10-08T00:00:00.000Z');
const environment = Object.freeze({ accountApiUrl: 'https://identity.example.invalid/functions/v1/synk-account',
  clientId: 'synthetic-dating-client', issuer: 'synk-account', audience: 'atlas-dating' });
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
function fixture(t, { mode = 'account', status = 'active', empty = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-dating-restore-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('synk-dating-restore-')); fs.rmSync(dir, { recursive: true, force: true }); });
  const databasePath = path.join(dir, 'account.sqlite'), evidencePath = path.join(dir, 'paired.json'), latestEvidencePath = path.join(dir, 'latest.json');
  const subject = randomUUID(), event = randomUUID(), observedAt = new Date(at).toISOString();
  const store = createDatingStore({ path: databasePath, mode });
  if (!empty) store.transaction(tx => {
    let row = tx.ensureAccount(subject, { nickname: '합성 비공개 이름', secret: 'must-never-be-printed' });
    if (status !== 'active') row = tx.updateAccount(row, row.document, status);
    tx.putCentralAvailability(subject, 1, 'active', false, observedAt);
    tx.rememberAvailabilitySequence(subject, 1, 'active');
    tx.putLifecycleReceipt('synk-account', event, 'a'.repeat(64), observedAt, { status: 'applied', subjectId: subject, sequence: 1 });
  });
  store.close();
  const central = { accounts: empty ? [] : [{ synk_user_id: subject, status: 'active' }], cursor: empty ? [] : [{ subject_id: subject, sequence: 1 }],
    events: empty ? [] : [{ event_id: event, subject_id: subject, sequence: 1, status: 'active', state: 'delivered' }], deletion: [] };
  const paired = { version: 1, kind: 'atlas-dating-restore-snapshot', exportId: randomUUID(), environment, capturedAt: observedAt, productSha256: digest(databasePath), central };
  const latest = { version: 1, kind: 'atlas-dating-restore-latest', exportId: randomUUID(), environment, observedAt,
    source: 'independent-current-central-ledger', central: structuredClone(central) };
  const save = () => { fs.writeFileSync(evidencePath, JSON.stringify(paired)); fs.writeFileSync(latestEvidencePath, JSON.stringify(latest)); };
  save();
  const options = { databasePath, evidencePath, latestEvidencePath, expectedEnvironment: environment, clock: () => at };
  const inspect = extras => inspectDatingRestore({ ...options, ...extras });
  const consume = (proof, extras) => consumeDatingRestoreAdmission(proof, { databasePath, expectedEnvironment: environment, clock: () => at, ...extras });
  const editDatabase = sql => { const db = new DatabaseSync(databasePath); try { db.exec(sql); } finally { db.close(); }
    paired.productSha256 = digest(databasePath); save(); };
  return { ...options, dir, subject, event, paired, latest, save, inspect, consume, editDatabase };
}

test('offline admission reads the checkpointed database unchanged, redacts identities, and is one-use', t => {
  const f = fixture(t), before = fs.readdirSync(f.dir), hashes = before.map(name => digest(path.join(f.dir, name)));
  const result = f.inspect();
  assert.equal(result.summary.ok, true); assert.equal(result.summary.accountCount, 1); assert.equal(result.summary.remoteLatestVerified, false);
  assert.match(result.summary.fingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /must-never-be-printed|합성|synthetic-dating-client/);
  assert.ok(!JSON.stringify(result).includes(f.subject));
  assert.deepEqual(fs.readdirSync(f.dir), before); assert.deepEqual(before.map(name => digest(path.join(f.dir, name))), hashes);
  assert.equal(f.consume(result.admission).fingerprint, result.summary.fingerprint);
  assert.throws(() => f.consume(result.admission), /restore-admission-required/);
  assert.throws(() => f.consume({}), /restore-admission-required/);
});

test('missing database or independent evidence cannot create a database or authorize a restart', t => {
  const f = fixture(t), missing = path.join(f.dir, 'missing.sqlite');
  assert.throws(() => f.inspect({ databasePath: missing }), /restore-file-unavailable/); assert.equal(fs.existsSync(missing), false);
  assert.throws(() => f.inspect({ latestEvidencePath: path.join(f.dir, 'missing.json') }), /restore-file-unavailable/);
  assert.throws(() => f.inspect({ latestEvidencePath: f.evidencePath }), /restore-independent-evidence-required/);
  f.latest.exportId = f.paired.exportId; f.save(); assert.throws(() => f.inspect(), /restore-independent-evidence-required/);
});

test('an operator latest export must have explicit provenance and a bounded fresh timestamp', t => {
  const f = fixture(t);
  for (const delta of [-DATING_RESTORE_MAX_AGE_MS - 1, 30_001]) {
    f.latest.observedAt = new Date(at + delta).toISOString(); f.save(); assert.throws(() => f.inspect(), /restore-latest-evidence-stale/);
  }
  f.latest.observedAt = new Date(at).toISOString(); f.latest.source = 'restored-backup'; f.save();
  assert.throws(() => f.inspect(), /restore-independent-evidence-required/);
});

test('two mutually coherent old backups cannot pass a newer independent hold sequence', t => {
  const f = fixture(t); f.latest.central.accounts[0].status = 'disabled'; f.latest.central.cursor[0].sequence = 2;
  f.latest.central.events.push({ event_id: randomUUID(), subject_id: f.subject, sequence: 2, status: 'disabled', state: 'pending' }); f.save();
  assert.throws(() => f.inspect(), /known-newer-central-sequence-missing/);
});

test('two mutually coherent old backups cannot resurrect an independently known terminal deletion', t => {
  const f = fixture(t); f.latest.central.accounts[0].status = 'deleted';
  f.latest.central.deletion.push({ event_id: randomUUID(), subject_id: f.subject, state: 'pending' }); f.save();
  assert.throws(() => f.inspect(), /known-terminal-deletion-missing/);
});

test('latest exports must match the service environment and stable ledger status, not merely counters', t => {
  const f = fixture(t); f.latest.environment = { ...environment, clientId: 'another-service-client' }; f.save();
  assert.throws(() => f.inspect(), /restore-environment-mismatch/);
  f.latest.environment = environment; f.latest.central.accounts[0].status = 'disabled'; f.save();
  assert.throws(() => f.inspect(), /restore-latest-ledger-mismatch/);
});

test('even a coherent pending hold requires product state to be fenced before reopening', t => {
  const f = fixture(t);
  f.paired.central.accounts[0].status = 'disabled'; f.paired.central.cursor[0].sequence = 2;
  f.paired.central.events.push({ event_id: randomUUID(), subject_id: f.subject, sequence: 2, status: 'disabled', state: 'pending' });
  f.latest.central = structuredClone(f.paired.central); f.save();
  assert.throws(() => f.inspect(), /restore-product-latest-state-missing/);
});

test('changed database, latest evidence, or environment invalidates and consumes a prior admission', t => {
  const f = fixture(t); let checked = f.inspect();
  f.editDatabase('UPDATE dating_accounts SET revision=revision+1');
  assert.throws(() => f.consume(checked.admission), /restore-files-changed/);
  assert.throws(() => f.consume(checked.admission), /restore-admission-required/);
  checked = f.inspect(); fs.appendFileSync(f.latestEvidencePath, ' ');
  assert.throws(() => f.consume(checked.admission), /restore-files-changed/);
  f.save(); checked = f.inspect();
  assert.throws(() => f.consume(checked.admission, { expectedEnvironment: { ...environment, clientId: 'other' } }), /restore-admission-context-mismatch/);
});

test('admission expires and rejects clock rollback before any service opens the database', t => {
  const f = fixture(t);
  assert.throws(() => f.consume(f.inspect().admission, { clock: () => at + DATING_RESTORE_MAX_AGE_MS + 1 }), /restore-admission-expired/);
  assert.throws(() => f.consume(f.inspect().admission, { clock: () => at - 1 }), /restore-admission-expired/);
});

test('uncheckpointed sidecars are rejected before readonly SQLite access and when added after inspection', t => {
  const f = fixture(t), proof = f.inspect().admission;
  fs.writeFileSync(f.databasePath + '-wal', 'synthetic uncheckpointed data');
  assert.throws(() => f.inspect(), /restore-database-not-checkpointed/);
  assert.throws(() => f.consume(proof), /restore-database-not-checkpointed/);
});

test('suspended product accounts remain suspended and are compatible with central active accounts', t => {
  const f = fixture(t, { status: 'suspended' }); assert.equal(f.inspect().summary.accountCount, 1);
  const db = new DatabaseSync(f.databasePath, { readOnly: true });
  try { assert.equal(db.prepare('SELECT status FROM dating_accounts').get().status, 'suspended'); } finally { db.close(); }
});

test('missing tables, malformed receipts, and checksum damage fail closed', t => {
  const f = fixture(t); const bytes = fs.readFileSync(f.databasePath);
  f.editDatabase('DROP TABLE dating_reports'); assert.throws(() => f.inspect(), /restore-database-schema-missing/);
  fs.writeFileSync(f.databasePath, bytes); f.editDatabase("UPDATE dating_lifecycle_receipts SET result='bad json'");
  assert.throws(() => f.inspect(), /restore-receipt-invalid/);
  fs.writeFileSync(f.databasePath, bytes); assert.throws(() => f.inspect(), /restore-database-checksum-mismatch/);
});

test('empty central and product inventories, demo databases, and malformed evidence cannot authorize restore', t => {
  const empty = fixture(t, { empty: true }); assert.throws(() => empty.inspect(), /restore-empty-inventory/);
  const demo = fixture(t, { mode: 'demo' }); assert.throws(() => demo.inspect(), /restore-database-mode-mismatch/);
  const malformed = fixture(t); fs.writeFileSync(malformed.evidencePath, '{broken'); assert.throws(() => malformed.inspect(), /restore-evidence-invalid/);
});

test('valid deleted tombstones require deletion ledger and no private document', t => {
  const f = fixture(t); const deletionId = randomUUID();
  f.paired.central.accounts[0].status = 'deleted';
  f.paired.central.deletion.push({ event_id: deletionId, subject_id: f.subject, state: 'delivered' });
  f.latest.central = structuredClone(f.paired.central);
  const result = JSON.stringify({ subjectId: f.subject, status: 'deleted' }).replaceAll("'", "''");
  f.editDatabase(`UPDATE dating_accounts SET status='deleted',document=NULL;
    INSERT INTO dating_lifecycle_receipts VALUES('synk-account','${deletionId}','${'a'.repeat(64)}','${new Date(at).toISOString()}','${result}');`);
  assert.equal(f.inspect().summary.deletedAccountCount, 1);
  f.paired.central.deletion = []; f.latest.central.deletion = []; f.save();
  assert.throws(() => f.inspect(), /restore-terminal-ledger-missing/);
});

test('restore evidence cannot live inside the public experiences directory', t => {
  const f = fixture(t), exposed = fileURLToPath(new URL(`../experiences/atlas-lab/restore-synthetic-${randomUUID()}.json`, import.meta.url));
  fs.writeFileSync(exposed, JSON.stringify(f.latest));
  t.after(() => fs.unlinkSync(exposed));
  assert.throws(() => f.inspect({ latestEvidencePath: exposed }), /restore-public-file-forbidden/);
  assert.throws(() => f.inspect({ evidencePath: exposed }), /restore-public-file-forbidden/);
});

test('invalid SQLite bytes are rejected without leaking raw input or generating sidecars', t => {
  const f = fixture(t); fs.writeFileSync(f.databasePath, 'synthetic-sensitive-invalid-database');
  f.paired.productSha256 = digest(f.databasePath); f.save(); const before = fs.readdirSync(f.dir);
  assert.throws(() => f.inspect(), error => error.code === 'restore-database-unreadable' && !error.message.includes('synthetic-sensitive'));
  assert.deepEqual(fs.readdirSync(f.dir), before);
});

test('a tombstone cannot admit restored private introductions left outside the account document', t => {
  const f = fixture(t); const deletionId = randomUUID(); f.paired.central.accounts[0].status = 'deleted';
  f.paired.central.deletion.push({ event_id: deletionId, subject_id: f.subject, state: 'pending' });
  f.latest.central = structuredClone(f.paired.central);
  f.editDatabase(`UPDATE dating_accounts SET status='deleted',document=NULL;
    INSERT INTO dating_archived_introductions VALUES('${f.subject}','${randomUUID()}',1,'${new Date(at).toISOString()}','{}');`);
  assert.throws(() => f.inspect(), /terminal-private-data-returned/);
});

test('a lost-ack pending event still requires the local receipt committed with its fence', t => {
  const f = fixture(t); f.paired.central.events[0].state = 'pending'; f.latest.central.events[0].state = 'pending'; f.save();
  assert.equal(f.inspect().summary.ok, true);
  f.editDatabase('DELETE FROM dating_lifecycle_receipts');
  assert.throws(() => f.inspect(), /restore-product-latest-receipt-missing/);
});
