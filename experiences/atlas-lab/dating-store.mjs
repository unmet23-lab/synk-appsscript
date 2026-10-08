// Dating product data only. Authentication remains with the existing SYNK account.
// SQLite transactions serialize compare-and-swap across processes and restarts.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const publicRoot = fileURLToPath(new URL('../', import.meta.url));
const inside = (root, target) => { const relative = path.relative(root, target); return !relative || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); };
const decode = row => row ? { ...row, document: row.document === null ? null : JSON.parse(row.document) } : null;

export function createDatingStore({ path: filename, mode } = {}) {
  if (!['demo', 'account'].includes(mode) || typeof filename !== 'string' || !path.isAbsolute(filename) || inside(publicRoot, path.resolve(filename))) throw new TypeError('An explicit non-public database path and mode are required.');
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  if (inside(fs.realpathSync(publicRoot), fs.realpathSync(path.dirname(filename))) || fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink()) throw new TypeError('Dating data cannot be exposed through static files or symlinks.');
  const db = new DatabaseSync(filename); let closed = false, unavailable = false;
  try {
    db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;');
    db.exec(`CREATE TABLE IF NOT EXISTS dating_meta (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, mode TEXT NOT NULL, adult_required INTEGER NOT NULL DEFAULT 0 CHECK(adult_required IN (0,1)));
      CREATE TABLE IF NOT EXISTS dating_clock (id INTEGER PRIMARY KEY CHECK(id=1), milliseconds INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS dating_accounts (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, status TEXT NOT NULL, document TEXT);
      CREATE TABLE IF NOT EXISTS dating_pairs (id TEXT PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, document TEXT);
      CREATE TABLE IF NOT EXISTS dating_introductions (a TEXT NOT NULL, b TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(a,b));
      CREATE TABLE IF NOT EXISTS dating_alignments (pair_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT);
      CREATE TABLE IF NOT EXISTS dating_receipts (actor TEXT NOT NULL, id TEXT NOT NULL, digest TEXT NOT NULL, revision INTEGER NOT NULL, result TEXT NOT NULL, PRIMARY KEY(actor,id));
      CREATE TABLE IF NOT EXISTS dating_lifecycle_receipts (issuer TEXT NOT NULL, event_id TEXT NOT NULL, digest TEXT NOT NULL, applied_at TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(issuer,event_id));
      CREATE TABLE IF NOT EXISTS dating_central_availability (subject_id TEXT PRIMARY KEY, sequence INTEGER NOT NULL CHECK(sequence>0), status TEXT NOT NULL CHECK(status IN ('active','deletion-requested','disabled')), resume_required INTEGER NOT NULL CHECK(resume_required IN (0,1)), applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS dating_availability_sequences (subject_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK(sequence>0), status TEXT NOT NULL, PRIMARY KEY(subject_id,sequence));
      CREATE TABLE IF NOT EXISTS dating_archived_introductions (a TEXT NOT NULL, b TEXT NOT NULL, revision INTEGER NOT NULL, retired_at TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(a,b,retired_at));
      CREATE TABLE IF NOT EXISTS dating_exposures (owner TEXT NOT NULL, context TEXT NOT NULL, candidate TEXT NOT NULL, PRIMARY KEY(owner,context,candidate));
      CREATE TABLE IF NOT EXISTS dating_reports (id TEXT PRIMARY KEY, reporter TEXT, target TEXT, status TEXT NOT NULL, reason TEXT NOT NULL, details TEXT, note TEXT, decision TEXT NOT NULL, at TEXT NOT NULL, updated_at TEXT NOT NULL);`);
    if (!db.prepare('PRAGMA table_info(dating_meta)').all().some(column => column.name === 'adult_required'))
      db.exec('ALTER TABLE dating_meta ADD COLUMN adult_required INTEGER NOT NULL DEFAULT 0 CHECK(adult_required IN (0,1));');
    db.prepare('INSERT OR IGNORE INTO dating_meta(id,version,mode) VALUES(1,1,?)').run(mode);
    const meta = db.prepare('SELECT * FROM dating_meta WHERE id=1').get();
    if (meta.mode !== mode || meta.version !== 1) throw new TypeError('Demo and account data must use separate databases.');
    fs.chmodSync(filename, 0o600);
  } catch (error) { db.close(); throw error; }
  const api = {
    adultRequired: () => db.prepare('SELECT adult_required FROM dating_meta WHERE id=1').get()?.adult_required === 1,
    requireAdultVerification() { db.prepare('UPDATE dating_meta SET adult_required=1 WHERE id=1').run(); },
    time(at, advance = false) {
      const requested = Date.parse(at); if (!Number.isSafeInteger(requested)) throw new TypeError('Invalid store time.');
      const previous = db.prepare('SELECT milliseconds FROM dating_clock WHERE id=1').get();
      const next = Math.max(requested, previous ? previous.milliseconds + (advance ? 1 : 0) : requested);
      db.prepare('INSERT INTO dating_clock VALUES(1,?) ON CONFLICT(id) DO UPDATE SET milliseconds=excluded.milliseconds').run(next);
      return new Date(next).toISOString();
    },
    account: id => { const row = decode(db.prepare('SELECT * FROM dating_accounts WHERE id=?').get(id)); return row ? { ...row, centralAvailability: api.centralAvailability(id) } : null; },
    accounts: () => db.prepare('SELECT * FROM dating_accounts ORDER BY id').all().map(row => ({ ...decode(row), centralAvailability: api.centralAvailability(row.id) })),
    ensureAccount(id, document) { db.prepare('INSERT OR IGNORE INTO dating_accounts VALUES(?,0,?,?)').run(id, 'active', JSON.stringify(document)); return api.account(id); },
    ensureDeletedAccount(id) { db.prepare('INSERT OR IGNORE INTO dating_accounts VALUES(?,0,?,NULL)').run(id, 'deleted'); return api.account(id); },
    updateAccount(row, document, status = row.status) {
      if (row.status === 'deleted' && (status !== 'deleted' || document !== null)) throw Object.assign(new Error('account-deleted'), { status: 410, code: 'account-deleted' });
      const result = db.prepare('UPDATE dating_accounts SET revision=revision+1,status=?,document=? WHERE id=? AND revision=?').run(status, document === null ? null : JSON.stringify(document), row.id, row.revision);
      if (result.changes !== 1) throw Object.assign(new Error('revision-conflict'), { status: 409 });
      return api.account(row.id);
    },
    receipt: (actor, id) => db.prepare('SELECT * FROM dating_receipts WHERE actor=? AND id=?').get(actor, id),
    putReceipt(actor, id, digest, revision, result) { db.prepare('INSERT INTO dating_receipts VALUES(?,?,?,?,?)').run(actor, id, digest, revision, JSON.stringify(result)); },
    lifecycleReceipt: (issuer, eventId) => db.prepare('SELECT * FROM dating_lifecycle_receipts WHERE issuer=? AND event_id=?').get(issuer, eventId),
    putLifecycleReceipt(issuer, eventId, digest, appliedAt, result) { db.prepare('INSERT INTO dating_lifecycle_receipts VALUES(?,?,?,?,?)').run(issuer, eventId, digest, appliedAt, JSON.stringify(result)); },
    centralAvailability: id => db.prepare('SELECT * FROM dating_central_availability WHERE subject_id=?').get(id) || null,
    availabilitySequence: (id, sequence) => db.prepare('SELECT status FROM dating_availability_sequences WHERE subject_id=? AND sequence=?').get(id, sequence),
    rememberAvailabilitySequence(id, sequence, status) { db.prepare('INSERT OR IGNORE INTO dating_availability_sequences VALUES(?,?,?)').run(id, sequence, status); },
    putCentralAvailability(id, sequence, status, resumeRequired, at) {
      db.prepare('INSERT INTO dating_central_availability VALUES(?,?,?,?,?) ON CONFLICT(subject_id) DO UPDATE SET sequence=excluded.sequence,status=excluded.status,resume_required=excluded.resume_required,applied_at=excluded.applied_at').run(id, sequence, status, resumeRequired ? 1 : 0, at);
      return api.centralAvailability(id);
    },
    resumeCentralAvailability(id) { db.prepare("UPDATE dating_central_availability SET resume_required=0 WHERE subject_id=? AND status='active'").run(id); },
    pair: id => decode(db.prepare('SELECT * FROM dating_pairs WHERE id=?').get(id)),
    alignment: pairId => decode(db.prepare('SELECT * FROM dating_alignments WHERE pair_id=?').get(pairId)),
    putAlignment(pairId, document, expectedRevision) {
      const old = api.alignment(pairId);
      if (!old) {
        if (expectedRevision !== 0) throw Object.assign(new Error('alignment-revision-conflict'), { status: 409, code: 'alignment-revision-conflict' });
        db.prepare('INSERT INTO dating_alignments VALUES(?,?,?)').run(pairId, document.revision, JSON.stringify(document));
      } else if (db.prepare('UPDATE dating_alignments SET revision=?,document=? WHERE pair_id=? AND revision=?').run(document.revision, JSON.stringify(document), pairId, expectedRevision).changes !== 1)
        throw Object.assign(new Error('alignment-revision-conflict'), { status: 409, code: 'alignment-revision-conflict' });
      return api.alignment(pairId);
    },
    clearAlignment(pairId, erase = false) {
      if (erase) db.prepare('DELETE FROM dating_alignments WHERE pair_id=?').run(pairId);
      else db.prepare('UPDATE dating_alignments SET revision=revision+1,document=NULL WHERE pair_id=? AND document IS NOT NULL').run(pairId);
    },
    introduction: (a, b) => decode(db.prepare('SELECT * FROM dating_introductions WHERE a=? AND b=?').get(...[a, b].sort())),
    introductions: id => db.prepare('SELECT * FROM dating_introductions WHERE a=? OR b=?').all(id, id).map(decode),
    putIntroduction(a, b, document, expectedRevision = null) {
      const ids = [a, b].sort();
      if (expectedRevision === null) db.prepare('INSERT INTO dating_introductions VALUES(?,?,?,?)').run(...ids, document.revision, JSON.stringify(document));
      // The row is the public CAS generation. Retiring a history may reset its
      // event document, but must never reuse a revision held by another person.
      else if (db.prepare('UPDATE dating_introductions SET revision=revision+1,document=? WHERE a=? AND b=? AND revision=?').run(JSON.stringify(document), ...ids, expectedRevision).changes !== 1)
        throw Object.assign(new Error('introduction-revision-conflict'), { status: 409, code: 'introduction-revision-conflict' });
      return api.introduction(a, b);
    },
    retireIntroduction(row, at) { db.prepare('INSERT INTO dating_archived_introductions VALUES(?,?,?,?,?)').run(row.a, row.b, row.revision, at, JSON.stringify(row.document)); },
    archivedIntroductions: id => db.prepare('SELECT * FROM dating_archived_introductions WHERE a=? OR b=?').all(id, id).map(decode),
    eraseIntroductions(id) { db.prepare('DELETE FROM dating_introductions WHERE a=? OR b=?').run(id, id); db.prepare('DELETE FROM dating_archived_introductions WHERE a=? OR b=?').run(id, id); },
    pairFor: (a, b) => { const ids = [a, b].sort(); return decode(db.prepare("SELECT * FROM dating_pairs WHERE a=? AND b=? AND status='active' ORDER BY rowid DESC LIMIT 1").get(...ids)); },
    pairs: id => db.prepare('SELECT * FROM dating_pairs WHERE a=? OR b=? ORDER BY id').all(id, id).map(decode),
    putPair({ id, a, b, revision, document, status = 'active' }) {
      const ids = [a, b].sort(); db.prepare('INSERT INTO dating_pairs VALUES(?,?,?,?,?,?)').run(id, ...ids, revision, status, JSON.stringify(document)); return api.pair(id);
    },
    updatePair(row, document, status = row.status) {
      const revision = status !== row.status || status === 'closed' ? row.revision + 1 : document?.revision ?? row.revision + 1;
      const result = db.prepare('UPDATE dating_pairs SET revision=?,status=?,document=? WHERE id=? AND revision=?').run(revision, status, document === null ? null : JSON.stringify(document), row.id, row.revision);
      if (result.changes !== 1) throw Object.assign(new Error('pair-revision-conflict'), { status: 409 });
      return api.pair(row.id);
    },
    addReport(row) { db.prepare('INSERT INTO dating_reports VALUES(?,?,?,?,?,?,?,?,?,?)').run(row.id, row.reporter, row.target, 'open', row.reason, row.details, null, 'none', row.at, row.at); },
    report: id => db.prepare('SELECT * FROM dating_reports WHERE id=?').get(id),
    reports: (id, operator = false) => operator ? db.prepare('SELECT * FROM dating_reports ORDER BY at').all() : db.prepare('SELECT * FROM dating_reports WHERE reporter=? ORDER BY at').all(id),
    updateReport(id, { status, decision, note, at }) { db.prepare('UPDATE dating_reports SET status=?,decision=?,note=?,updated_at=? WHERE id=?').run(status, decision, note, at, id); },
    eraseReports(id) { db.prepare('UPDATE dating_reports SET reporter=NULL,details=NULL,note=NULL WHERE reporter=?').run(id); db.prepare('UPDATE dating_reports SET target=NULL,details=NULL,note=NULL WHERE target=?').run(id); },
    eraseReceipts(id) { db.prepare('DELETE FROM dating_receipts WHERE actor=?').run(id); },
    expose(owner, context, candidate) { db.prepare('INSERT OR IGNORE INTO dating_exposures VALUES(?,?,?)').run(owner, context, candidate); },
    exposureCounts() { return Object.fromEntries(db.prepare('SELECT candidate,COUNT(*) AS total FROM dating_exposures GROUP BY candidate').all().map(row => [row.candidate, row.total])); },
    eraseExposures(id) { db.prepare('DELETE FROM dating_exposures WHERE owner=? OR candidate=?').run(id, id); },
  };
  return Object.freeze({ mode, path: filename,
    transaction(fn) {
      if (closed) {
        if (unavailable) throw Object.assign(new Error('store-unavailable'), { code: 'store-unavailable' });
        throw new Error('store-closed');
      }
      db.exec('BEGIN IMMEDIATE');
      try { const result = fn(api); if (result?.then) throw new TypeError('Dating transactions must be synchronous.'); db.exec('COMMIT'); return result; }
      catch (error) {
        // FULL/IOERR may already have rolled back the transaction. Preserve the
        // write error, and never reuse a connection with uncertain transaction state.
        let clean = false;
        try { if (db.isTransaction) db.exec('ROLLBACK'); clean = db.isTransaction === false; } catch {}
        if (!clean) { unavailable = closed = true; try { db.close(); } catch {} }
        throw error;
      }
    },
    close() { if (!closed) { closed = true; db.close(); } }
  });
}
