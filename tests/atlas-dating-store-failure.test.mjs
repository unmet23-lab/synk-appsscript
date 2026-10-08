import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { armReceiptFull, captureDatingDatabase } from './lib/dating-sqlite-faults.mjs';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-storage-fault-'));
  const filename = path.join(directory, 'synthetic.sqlite');
  const { value: store, database } = captureDatingDatabase(() => createDatingStore({ path: filename, mode: 'account' }));
  t.after(() => { store.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  store.transaction(tx => {
    tx.ensureAccount('synthetic-a', { nickname: 'Before' });
    tx.putPair({ id: 'synthetic-pair', a: 'synthetic-a', b: 'synthetic-b', revision: 0, document: { revision: 0 } });
  });
  return { directory, filename, store, database };
}
function sqliteError(error, errno, message) {
  assert.equal(error.code, 'ERR_SQLITE_ERROR');
  assert.equal(error.errcode & 255, errno);
  if (message) assert.match(error.message, message);
  return true;
}
const snapshot = store => store.transaction(tx => ({ account: tx.account('synthetic-a'), pair: tx.pair('synthetic-pair'), receipt: tx.receipt('synthetic-a', 'save-1'), exposures: tx.exposureCounts() }));

test('actual SQLITE_FULL auto-rollback preserves the original error instead of masking it with a second rollback error', t => {
  const { store, database } = fixture(t), before = snapshot(store);
  database.exec(`PRAGMA max_page_count=${database.prepare('PRAGMA page_count').get().page_count}`);
  let automaticallyRolledBack = false;
  assert.throws(() => store.transaction(tx => {
    tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' });
    try { tx.putReceipt('synthetic-a', 'save-1', 'synthetic-digest', 1, { syntheticPayload: 'x'.repeat(1048576) }); }
    catch (error) { automaticallyRolledBack = !database.isTransaction; throw error; }
  }), error => sqliteError(error, 13, /full/i));
  assert.equal(automaticallyRolledBack, true);
  assert.deepEqual(snapshot(store), before);
  database.exec('PRAGMA max_page_count=1073741823');
  store.transaction(tx => { tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' }); tx.putReceipt('synthetic-a', 'save-1', 'synthetic-digest', 1, { saved: true }); });
  assert.equal(snapshot(store).account.revision, 1);
  assert.ok(snapshot(store).receipt);
});

test('actual receipt-trigger SQLITE_FULL atomically rolls back profile, pair, clock, exposure and receipt before retry', t => {
  const { store, database } = fixture(t), before = snapshot(store), disarm = armReceiptFull(database);
  let reachedReceipt = false;
  function save() {
    return store.transaction(tx => {
      const receipt = tx.receipt('synthetic-a', 'save-1');
      if (receipt) return JSON.parse(receipt.result);
      tx.time('2026-10-08T09:00:00.000Z', true);
      const updated = tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' });
      tx.updatePair(tx.pair('synthetic-pair'), { revision: 1 });
      tx.expose('synthetic-a', 'synthetic-context', 'synthetic-b');
      reachedReceipt = true;
      tx.putReceipt('synthetic-a', 'save-1', 'synthetic-digest', updated.revision, { saved: true, revision: updated.revision });
      return { saved: true, revision: updated.revision };
    });
  }
  assert.throws(save, error => sqliteError(error, 13, /full/i));
  assert.equal(reachedReceipt, true);
  assert.equal(database.isTransaction, false);
  assert.deepEqual(snapshot(store), before);
  assert.equal(database.prepare('SELECT * FROM dating_clock').get(), undefined);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM fixture_full_padding').get().count, 0);
  disarm();
  assert.deepEqual(save(), { saved: true, revision: 1 });
  assert.deepEqual(save(), { saved: true, revision: 1 });
  const saved = snapshot(store);
  assert.equal(saved.account.revision, 1);
  assert.equal(saved.account.document.nickname, 'After');
  assert.equal(saved.pair.revision, 1);
  assert.deepEqual(saved.exposures, { 'synthetic-b': 1 });
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM dating_receipts').get().count, 1);
});

test('actual SQLITE_READONLY from query_only rolls back and permits the same write once SQLite becomes writable', t => {
  const { store, database } = fixture(t), before = snapshot(store);
  database.exec('PRAGMA query_only=ON');
  assert.throws(() => store.transaction(tx => {
    tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' });
    tx.putReceipt('synthetic-a', 'save-1', 'synthetic-digest', 1, { saved: true });
  }), error => sqliteError(error, 8, /readonly/i));
  assert.equal(database.isTransaction, false);
  database.exec('PRAGMA query_only=OFF');
  assert.deepEqual(snapshot(store), before);
  store.transaction(tx => { tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' }); tx.putReceipt('synthetic-a', 'save-1', 'synthetic-digest', 1, { saved: true }); });
  assert.equal(snapshot(store).account.revision, 1);
  assert.ok(snapshot(store).receipt);
});

test('actual SQLITE_BUSY before BEGIN executes no callback and can recover after competing writer releases the lock', t => {
  const { store, database, filename } = fixture(t), before = snapshot(store), competing = new DatabaseSync(filename);
  database.exec('PRAGMA busy_timeout=0');
  let callbacks = 0;
  try {
    competing.exec('BEGIN IMMEDIATE');
    assert.throws(() => store.transaction(tx => { callbacks++; tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' }); }), error => sqliteError(error, 5, /locked/i));
    assert.equal(callbacks, 0);
    assert.equal(database.isTransaction, false);
  } finally { if (competing.isTransaction) competing.exec('ROLLBACK'); competing.close(); }
  assert.deepEqual(snapshot(store), before);
  store.transaction(tx => tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' }));
  assert.equal(snapshot(store).account.revision, 1);
});

test('actual SQLITE_BUSY at COMMIT rolls back completed writes and receipt before a successful retry', t => {
  const { store, database, filename } = fixture(t), before = snapshot(store);
  database.exec('PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=0');
  const reader = new DatabaseSync(filename);
  let callbackFinished = false;
  const save = () => store.transaction(tx => {
    tx.updateAccount(tx.account('synthetic-a'), { nickname: 'After' });
    tx.putReceipt('synthetic-a', 'save-1', 'synthetic-digest', 1, { saved: true });
    callbackFinished = true;
  });
  try {
    reader.exec('BEGIN'); reader.prepare('SELECT * FROM dating_accounts').all();
    assert.throws(save, error => sqliteError(error, 5, /locked/i));
    assert.equal(callbackFinished, true);
    assert.equal(database.isTransaction, false);
  } finally { if (reader.isTransaction) reader.exec('ROLLBACK'); reader.close(); }
  assert.deepEqual(snapshot(store), before);
  save();
  assert.equal(snapshot(store).account.revision, 1);
  assert.ok(snapshot(store).receipt);
});

test('real receipt uniqueness failure preserves original SQLite constraint error and rolls back earlier profile writes', t => {
  const { store, database } = fixture(t);
  store.transaction(tx => tx.putReceipt('synthetic-a', 'save-1', 'existing-digest', 0, { saved: 'existing' }));
  const before = snapshot(store);
  assert.throws(() => store.transaction(tx => {
    tx.updateAccount(tx.account('synthetic-a'), { nickname: 'Must roll back' });
    tx.putReceipt('synthetic-a', 'save-1', 'new-digest', 1, { saved: 'new' });
  }), error => sqliteError(error, 19, /UNIQUE/));
  assert.equal(database.isTransaction, false);
  assert.deepEqual(snapshot(store), before);
});

test('if transaction cleanup itself fails the original write error survives and the connection is no longer reusable', t => {
  const { store, database, filename } = fixture(t), original = DatabaseSync.prototype.exec;
  store.transaction(tx => tx.putReceipt('synthetic-a', 'save-1', 'existing-digest', 0, { saved: 'existing' }));
  const before = snapshot(store);
  DatabaseSync.prototype.exec = function (sql) {
    if (this === database && sql === 'ROLLBACK') throw new Error('synthetic rollback failure');
    return Reflect.apply(original, this, [sql]);
  };
  try {
    assert.throws(() => store.transaction(tx => {
      tx.updateAccount(tx.account('synthetic-a'), { nickname: 'Must roll back' });
      tx.putReceipt('synthetic-a', 'save-1', 'new-digest', 1, { saved: 'new' });
    }), error => sqliteError(error, 19, /UNIQUE/));
  } finally { DatabaseSync.prototype.exec = original; }
  assert.throws(() => store.transaction(() => {}), error => error.code === 'store-unavailable');
  assert.equal(database.isOpen, false);
  const reopened = createDatingStore({ path: filename, mode: 'account' });
  try { assert.deepEqual(snapshot(reopened), before); } finally { reopened.close(); }
});
