// Synthetic tests only. Capture the connection during synchronous initialization;
// fault controls are SQLite PRAGMAs/triggers, never production-store hooks.
import { DatabaseSync } from 'node:sqlite';

export function captureDatingDatabase(create) {
  const original = DatabaseSync.prototype.exec;
  let database;
  DatabaseSync.prototype.exec = function (sql) {
    if (database && database !== this) throw new Error('Expected one synthetic SQLite connection during capture.');
    database = this;
    return Reflect.apply(original, this, [sql]);
  };
  try {
    const value = create();
    if (!database || value?.then) throw new Error('A synchronous SQLite initializer is required.');
    return { value, database };
  } finally { DatabaseSync.prototype.exec = original; }
}

// Fail at the receipt write after preceding product writes have already run.
// The one-MiB allocation exceeds this tiny synthetic DB's capped page count;
// no real disk exhaustion or production schema changes are involved.
export function armReceiptFull(database) {
  database.exec('CREATE TABLE fixture_full_padding (payload BLOB);');
  database.exec(`CREATE TRIGGER fixture_receipt_full BEFORE INSERT ON dating_receipts
    BEGIN INSERT INTO fixture_full_padding VALUES(zeroblob(1048576)); END;`);
  const pages = database.prepare('PRAGMA page_count').get().page_count;
  const limit = database.prepare(`PRAGMA max_page_count=${pages}`).get().max_page_count;
  if (limit !== pages) throw new Error('Could not cap synthetic SQLite page count.');
  return () => {
    database.exec('PRAGMA max_page_count=1073741823; DROP TRIGGER fixture_receipt_full; DROP TABLE fixture_full_padding;');
  };
}
