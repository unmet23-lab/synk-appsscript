// Offline, read-only restore admission. Operator exports are a trust boundary:
// this module cannot prove that a JSON file was collected from the live ledger.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DATING_RESTORE_MAX_AGE_MS = 5 * 60_000;
const admissions = new WeakMap();
const publicRoot = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const inside = (root, filename) => { const relative = path.relative(root, filename); return !relative
  || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const hash = value => createHash('sha256').update(value).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const requireThat = (condition, code) => { if (!condition) fail(code); };
const canonical = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? String(item)
  : plain(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const sequence = value => (typeof value === 'number' || typeof value === 'string' && /^[1-9]\d*$/.test(value))
  && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const availability = ['active', 'deletion-requested', 'disabled'];
const delivery = ['pending', 'delivering', 'delivered', 'blocked'];
const columns = Object.freeze({
  dating_meta: ['id', 'version', 'mode', 'adult_required'], dating_clock: ['id', 'milliseconds'],
  dating_accounts: ['id', 'revision', 'status', 'document'],
  dating_pairs: ['id', 'a', 'b', 'revision', 'status', 'document'],
  dating_introductions: ['a', 'b', 'revision', 'document'],
  dating_alignments: ['pair_id', 'revision', 'document'],
  dating_receipts: ['actor', 'id', 'digest', 'revision', 'result'],
  dating_lifecycle_receipts: ['issuer', 'event_id', 'digest', 'applied_at', 'result'],
  dating_central_availability: ['subject_id', 'sequence', 'status', 'resume_required', 'applied_at'],
  dating_availability_sequences: ['subject_id', 'sequence', 'status'],
  dating_archived_introductions: ['a', 'b', 'revision', 'retired_at', 'document'],
  dating_exposures: ['owner', 'context', 'candidate'],
  dating_reports: ['id', 'reporter', 'target', 'status', 'reason', 'details', 'note', 'decision', 'at', 'updated_at']
});
function inventory(value) {
  requireThat(plain(value), 'restore-central-invalid');
  for (const key of ['accounts', 'cursor', 'events', 'deletion']) requireThat(Array.isArray(value[key])
    && value[key].length <= 100_000 && value[key].every(plain), 'restore-central-invalid');
  const unique = (rows, key) => { const keys = rows.map(key); requireThat(new Set(keys).size === keys.length, 'restore-central-duplicate'); };
  unique(value.accounts, row => row.synk_user_id); unique(value.cursor, row => row.subject_id);
  unique(value.events, row => row.event_id); unique(value.events, row => `${row.subject_id}:${row.sequence}`);
  unique(value.deletion, row => row.event_id); unique(value.deletion, row => row.subject_id);
  const accounts = new Map(value.accounts.map(row => [row.synk_user_id, row.status]));
  for (const row of value.accounts) requireThat(uuid(row.synk_user_id) && [...availability, 'deleted'].includes(row.status), 'restore-central-invalid');
  for (const row of value.cursor) requireThat(uuid(row.subject_id) && accounts.has(row.subject_id) && sequence(row.sequence), 'restore-central-invalid');
  for (const row of value.events) requireThat(uuid(row.subject_id) && accounts.has(row.subject_id) && uuid(row.event_id)
    && sequence(row.sequence) && availability.includes(row.status) && delivery.includes(row.state), 'restore-central-invalid');
  for (const row of value.deletion) requireThat(uuid(row.subject_id) && accounts.get(row.subject_id) === 'deleted'
    && uuid(row.event_id) && delivery.includes(row.state), 'restore-central-invalid');
  const eventIds = new Set(value.events.map(row => row.event_id));
  requireThat(!value.deletion.some(row => eventIds.has(row.event_id)), 'restore-central-duplicate');
  return value;
}

// Shared structural comparison, also used by the full backup/restore rehearsal.
// Without knownLatest this proves internal compatibility only, not freshness.
export function assertDatingRestoreCompatible(central, product, knownLatest = null) {
  inventory(central); if (knownLatest) inventory(knownLatest);
  for (const key of ['dating_accounts', 'dating_lifecycle_receipts', 'dating_central_availability', 'dating_availability_sequences'])
    requireThat(Array.isArray(product?.[key]), 'restore-product-invalid');
  const cursor = new Map(central.cursor.map(row => [row.subject_id, Number(row.sequence)]));
  const local = new Map(product.dating_accounts.map(row => [row.id, row]));
  const receipt = new Map();
  for (const row of product.dating_lifecycle_receipts) {
    let result; try { result = JSON.parse(row.result); } catch { fail('restore-receipt-invalid'); }
    requireThat(row.issuer === 'synk-account' && uuid(row.event_id) && plain(result) && !receipt.has(row.event_id), 'restore-receipt-invalid');
    receipt.set(row.event_id, result);
  }
  const fence = new Map(product.dating_central_availability.map(row => [row.subject_id, row]));
  const seen = new Map(product.dating_availability_sequences.map(row => [`${row.subject_id}:${row.sequence}`, row.status]));
  const centralSeen = new Map(central.events.map(row => [`${row.subject_id}:${row.sequence}`, row.status]));
  const maxSequences = new Map();
  for (const event of central.events) {
    maxSequences.set(event.subject_id, Math.max(maxSequences.get(event.subject_id) || 0, Number(event.sequence)));
    requireThat(cursor.has(event.subject_id), 'central-cursor-missing');
    requireThat(cursor.get(event.subject_id) >= Number(event.sequence), 'central-cursor-behind-history');
    if (event.state === 'delivered') requireThat(receipt.has(event.event_id), 'central-delivered-without-product-receipt');
    const acknowledgment = receipt.get(event.event_id);
    if (acknowledgment) {
      requireThat(acknowledgment.subjectId === event.subject_id, 'product-receipt-subject-mismatch');
      requireThat(acknowledgment.sequence === Number(event.sequence), 'product-receipt-sequence-mismatch');
      requireThat(['applied', 'ignored'].includes(acknowledgment.status), 'product-receipt-status-mismatch');
      requireThat(seen.get(`${event.subject_id}:${event.sequence}`) === event.status, 'product-sequence-observation-missing');
      if (local.get(event.subject_id)?.status !== 'deleted') {
        requireThat(fence.has(event.subject_id), 'product-high-water-missing');
        requireThat(fence.get(event.subject_id).sequence >= Number(event.sequence), 'product-high-water-behind-receipt');
      }
    }
  }
  for (const row of central.cursor) requireThat(Number(row.sequence) === (maxSequences.get(row.subject_id) || 0), 'central-cursor-history-mismatch');
  for (const row of product.dating_central_availability) requireThat(centralSeen.get(`${row.subject_id}:${row.sequence}`) === row.status, 'product-high-water-without-central-event');
  for (const event of central.deletion) if (event.state === 'delivered' || receipt.has(event.event_id)) {
    requireThat(receipt.get(event.event_id)?.status === 'deleted', 'terminal-receipt-missing');
    requireThat(receipt.get(event.event_id)?.subjectId === event.subject_id, 'product-receipt-subject-mismatch');
    requireThat(local.get(event.subject_id)?.status === 'deleted', 'terminal-tombstone-missing');
    requireThat(local.get(event.subject_id)?.document === null, 'terminal-private-data-returned');
  }
  if (knownLatest) {
    const centralAccounts = new Map(central.accounts.map(row => [row.synk_user_id, row.status]));
    for (const row of knownLatest.accounts.filter(row => row.status === 'deleted')) {
      requireThat(centralAccounts.get(row.synk_user_id) === 'deleted', 'known-terminal-deletion-missing');
      requireThat(local.get(row.synk_user_id)?.status === 'deleted', 'known-product-tombstone-missing');
      requireThat(local.get(row.synk_user_id)?.document === null, 'terminal-private-data-returned');
    }
    for (const row of knownLatest.cursor) requireThat((cursor.get(row.subject_id) || 0) >= Number(row.sequence), 'known-newer-central-sequence-missing');
  }
  return true;
}

function checkedFile(filename, maxBytes) {
  requireThat(typeof filename === 'string' && path.isAbsolute(filename), 'restore-file-path-required');
  const absolute = path.resolve(filename); let stat, real;
  try { stat = fs.lstatSync(absolute); real = fs.realpathSync(absolute); } catch { fail('restore-file-unavailable'); }
  requireThat(stat.isFile() && !stat.isSymbolicLink() && real === absolute && stat.size > 0 && stat.size <= maxBytes, 'restore-file-invalid');
  requireThat(!inside(publicRoot, real), 'restore-public-file-forbidden');
  let bytes; try { bytes = fs.readFileSync(absolute); } catch { fail('restore-file-unavailable'); }
  return { path: absolute, bytes, digest: hash(bytes) };
}
function checkpointed(filename) {
  for (const suffix of ['-wal', '-shm', '-journal']) requireThat(!fs.existsSync(filename + suffix), 'restore-database-not-checkpointed');
}
function readEvidence(filename) {
  const file = checkedFile(filename, 16 * 1024 * 1024); let value;
  try { value = JSON.parse(file.bytes.toString('utf8')); } catch { fail('restore-evidence-invalid'); }
  requireThat(plain(value), 'restore-evidence-invalid'); return { ...file, value };
}
function environment(value) {
  requireThat(plain(value) && Object.keys(value).sort().join(',') === 'accountApiUrl,audience,clientId,issuer'
    && value.issuer === 'synk-account' && value.audience === 'atlas-dating'
    && typeof value.clientId === 'string' && value.clientId.length > 0 && value.clientId.length <= 200, 'restore-environment-invalid');
  let url; try { url = new URL(value.accountApiUrl); } catch { fail('restore-environment-invalid'); }
  requireThat(url.href === value.accountApiUrl && !url.username && !url.password && !url.search && !url.hash
    && (url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)), 'restore-environment-invalid');
  return canonical(value);
}
function time(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  requireThat(Number.isFinite(parsed) && new Date(parsed).toISOString() === value, 'restore-evidence-time-invalid'); return parsed;
}
function currentTime(clock) {
  const value = clock(); const at = typeof value === 'string' ? Date.parse(value) : Number(value);
  requireThat(Number.isSafeInteger(at) && at > 0, 'restore-clock-invalid'); return at;
}
function productRows(filename) {
  let db;
  try {
    // Plain readOnly still creates WAL/SHM files for a WAL-mode database.
    // immutable=1 avoids those writes; all writers must remain stopped, and
    // we reject existing journals and compare fingerprints before/after.
    db = new DatabaseSync(pathToFileURL(filename).href + '?immutable=1', { readOnly: true });
    db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=0; BEGIN;');
    requireThat(db.prepare('PRAGMA quick_check').all().every(row => row.quick_check === 'ok'), 'restore-database-corrupt');
    const result = {};
    for (const [table, required] of Object.entries(columns)) {
      const schema = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
      requireThat(required.every(name => schema.includes(name)), 'restore-database-schema-missing');
      requireThat(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n <= 100_000, 'restore-database-too-large');
      result[table] = db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
    }
    requireThat(result.dating_meta.length === 1 && result.dating_meta[0].id === 1 && result.dating_meta[0].version === 1
      && result.dating_meta[0].mode === 'account' && [0, 1].includes(result.dating_meta[0].adult_required), 'restore-database-mode-mismatch');
    for (const row of result.dating_accounts) {
      requireThat(uuid(row.id) && ['active', 'suspended', 'deleted'].includes(row.status) && Number.isSafeInteger(row.revision) && row.revision >= 0, 'restore-product-invalid');
      if (row.status === 'deleted') requireThat(row.document === null, 'terminal-private-data-returned');
      else { let document; try { document = JSON.parse(row.document); } catch { fail('restore-product-invalid'); }
        requireThat(plain(document), 'restore-product-invalid'); }
    }
    db.exec('ROLLBACK;'); return result;
  } catch (error) { if (/^(restore|terminal)-[a-z0-9-]+$/.test(error.code || '')) throw error; fail('restore-database-unreadable'); }
  finally { if (db) db.close(); }
}
function requireCurrent(central, latest, product) {
  requireThat(central.accounts.length > 0 && latest.accounts.length > 0 && product.dating_accounts.length > 0, 'restore-empty-inventory');
  assertDatingRestoreCompatible(central, product, latest);
  // Compare stable ledger identity, not delivery attempts which can legitimately
  // change when an acknowledgment is lost and replayed.
  const projection = value => ({ accounts: value.accounts.map(row => [row.synk_user_id, row.status]).sort(),
    cursor: value.cursor.map(row => [row.subject_id, Number(row.sequence)]).sort(),
    events: value.events.map(row => [row.event_id, row.subject_id, Number(row.sequence), row.status]).sort(),
    deletion: value.deletion.map(row => [row.event_id, row.subject_id]).sort() });
  requireThat(canonical(projection(central)) === canonical(projection(latest)), 'restore-latest-ledger-mismatch');
  const accounts = new Map(central.accounts.map(row => [row.synk_user_id, row]));
  const cursors = new Map(central.cursor.map(row => [row.subject_id, Number(row.sequence)]));
  const fences = new Map(product.dating_central_availability.map(row => [row.subject_id, row]));
  const events = new Map(central.events.map(row => [`${row.subject_id}:${row.sequence}`, row]));
  const receipts = new Map(product.dating_lifecycle_receipts.map(row => [row.event_id, JSON.parse(row.result)]));
  for (const row of product.dating_accounts) {
    requireThat(accounts.has(row.id), 'restore-product-account-without-central');
    if (row.status === 'deleted') continue;
    requireThat(accounts.get(row.id).status !== 'deleted', 'known-product-tombstone-missing');
    const fence = fences.get(row.id);
    requireThat(cursors.has(row.id) && fence?.sequence === cursors.get(row.id)
      && fence.status === accounts.get(row.id).status, 'restore-product-latest-state-missing');
    // A lost central acknowledgment may leave the event pending, but the local
    // fence and its receipt were committed together and must both survive.
    const receipt = receipts.get(events.get(`${row.id}:${fence.sequence}`)?.event_id);
    requireThat(receipt?.subjectId === row.id && receipt.sequence === fence.sequence
      && ['applied', 'ignored'].includes(receipt.status), 'restore-product-latest-receipt-missing');
  }
  const deletions = new Set(latest.deletion.map(row => row.subject_id));
  for (const row of latest.accounts.filter(row => row.status === 'deleted')) requireThat(deletions.has(row.synk_user_id), 'restore-terminal-ledger-missing');
  const deleted = new Set(product.dating_accounts.filter(row => row.status === 'deleted').map(row => row.id));
  const deletedPairs = new Set(product.dating_pairs.filter(row => deleted.has(row.a) || deleted.has(row.b)).map(row => row.id));
  requireThat(!product.dating_pairs.some(row => deletedPairs.has(row.id) && (row.document !== null || row.status !== 'closed'))
    && !product.dating_introductions.some(row => deleted.has(row.a) || deleted.has(row.b))
    && !product.dating_archived_introductions.some(row => deleted.has(row.a) || deleted.has(row.b))
    && !product.dating_alignments.some(row => deletedPairs.has(row.pair_id))
    && !product.dating_receipts.some(row => deleted.has(row.actor))
    && !product.dating_exposures.some(row => deleted.has(row.owner) || deleted.has(row.candidate))
    && !product.dating_reports.some(row => deleted.has(row.reporter) || deleted.has(row.target)), 'terminal-private-data-returned');
}

// A stored pair can be internally consistent regardless of its age. This check
// does not manufacture independent latest evidence or create restart admission.
export function inspectDatingBackupPair({ databasePath, evidencePath, expectedEnvironment, clock = Date.now } = {}) {
  const at = currentTime(clock), expected = environment(expectedEnvironment);
  const database = checkedFile(databasePath, 256 * 1024 * 1024); checkpointed(database.path);
  const paired = readEvidence(evidencePath);
  requireThat(database.path !== paired.path, 'restore-pair-files-must-differ');
  requireThat(paired.value.version === 1 && paired.value.kind === 'atlas-dating-restore-snapshot'
    && uuid(paired.value.exportId), 'restore-evidence-invalid');
  requireThat(environment(paired.value.environment) === expected, 'restore-environment-mismatch');
  requireThat(time(paired.value.capturedAt) <= at + 30_000, 'restore-evidence-future');
  requireThat(/^[a-f0-9]{64}$/.test(paired.value.productSha256) && paired.value.productSha256 === database.digest, 'restore-database-checksum-mismatch');
  const product = productRows(database.path), central = inventory(paired.value.central);
  // Reuse the existing full schema, receipt, sequence and erased-private-data
  // requirements solely as a comparison within the supplied pair.
  requireCurrent(central, central, product);
  for (const file of [database, paired]) requireThat(checkedFile(file.path,
    file.path === database.path ? 256 * 1024 * 1024 : 16 * 1024 * 1024).digest === file.digest, 'restore-files-changed');
  checkpointed(database.path);
  return Object.freeze({ summary: Object.freeze({ ok: true, kind: 'atlas-dating-backup-pair-check',
    productSha256: database.digest, evidenceSha256: paired.digest, accountCount: product.dating_accounts.length,
    capturedAt: paired.value.capturedAt, localOnly: true, remoteLatestVerified: false, restoreAdmitted: false }) });
}

// Private ledger input for the offline reconciliation module. No admission is
// created here; its caller must separately validate the old pair.
export function inspectDatingReconciliationSource({ databasePath, evidencePath, latestEvidencePath, expectedEnvironment, clock = Date.now } = {}) {
  const at = currentTime(clock), expected = environment(expectedEnvironment);
  const database = checkedFile(databasePath, 256 * 1024 * 1024); checkpointed(database.path);
  const paired = readEvidence(evidencePath), latest = readEvidence(latestEvidencePath);
  requireThat(new Set([database.path, paired.path, latest.path]).size === 3, 'restore-independent-evidence-required');
  for (const item of [paired.value, latest.value]) requireThat(item.version === 1 && uuid(item.exportId), 'restore-evidence-invalid');
  requireThat(paired.value.kind === 'atlas-dating-restore-snapshot' && latest.value.kind === 'atlas-dating-restore-latest'
    && latest.value.source === 'independent-current-central-ledger' && latest.value.exportId !== paired.value.exportId, 'restore-independent-evidence-required');
  requireThat(environment(paired.value.environment) === expected && environment(latest.value.environment) === expected, 'restore-environment-mismatch');
  const captured = time(paired.value.capturedAt), observed = time(latest.value.observedAt);
  requireThat(captured <= observed && observed <= at + 30_000 && at - observed <= DATING_RESTORE_MAX_AGE_MS, 'restore-latest-evidence-stale');
  requireThat(/^[a-f0-9]{64}$/.test(paired.value.productSha256) && paired.value.productSha256 === database.digest, 'restore-database-checksum-mismatch');
  const product = productRows(database.path);
  inventory(paired.value.central); inventory(latest.value.central);
  const files = [database, paired, latest].map(({ path: filename, digest }) => ({ path: filename, digest }));
  // SQLite is closed before the second fingerprint; checkpoint files must still
  // be absent. The operator must keep all writers stopped through admission.
  for (const file of files) requireThat(checkedFile(file.path, file.path === database.path ? 256 * 1024 * 1024 : 16 * 1024 * 1024).digest === file.digest, 'restore-files-changed');
  checkpointed(database.path);
  const fingerprint = hash(canonical({ files, environment: expected }));
  return { database, paired, latest, product, files, fingerprint, expected, at, observed };
}

function checkDatingRestoreFiles(options) {
  const checked = inspectDatingReconciliationSource(options);
  const { database, paired, latest, product, files, fingerprint, expected, at, observed } = checked;
  requireCurrent(paired.value.central, latest.value.central, product);
  const summary = Object.freeze({ ok: true, kind: 'atlas-dating-restore-check', fingerprint,
    checkedAt: new Date(at).toISOString(), latestObservedAt: latest.value.observedAt,
    accountCount: product.dating_accounts.length, deletedAccountCount: product.dating_accounts.filter(row => row.status === 'deleted').length,
    availabilityEventCount: paired.value.central.events.length, deletionEventCount: paired.value.central.deletion.length,
    localOnly: true, remoteLatestVerified: false, admissionExpiresAt: new Date(observed + DATING_RESTORE_MAX_AGE_MS).toISOString() });
  return { summary, files, databasePath: database.path, environment: expected, observed, at, fingerprint };
}

export function assertDatingCopyComplete(databasePath) {
  requireThat(typeof databasePath === 'string' && path.isAbsolute(databasePath), 'restore-file-path-required');
  try { fs.lstatSync(path.join(path.dirname(databasePath), '.backup-incomplete')); }
  catch (error) { if (error.code === 'ENOENT') return; fail('restore-bundle-incomplete'); }
  fail('restore-bundle-incomplete');
}

// CLI staging may check all restored data while its durable incomplete marker
// remains present. This API cannot authorize starting a service.
export function inspectDatingStagedRestore(options = {}) {
  const { summary } = checkDatingRestoreFiles(options);
  return Object.freeze({ summary: Object.freeze({ ...summary, kind: 'atlas-dating-staged-restore-check', restoreAdmitted: false }) });
}

export function inspectDatingRestore(options = {}) {
  assertDatingCopyComplete(options.databasePath);
  const checked = checkDatingRestoreFiles(options);
  assertDatingCopyComplete(options.databasePath);
  const admission = Object.freeze({});
  admissions.set(admission, checked);
  return Object.freeze({ summary: checked.summary, admission });
}

export function consumeDatingRestoreAdmission(admission, { databasePath, expectedEnvironment, clock = Date.now } = {}) {
  const record = admissions.get(admission); admissions.delete(admission);
  requireThat(!!record, 'restore-admission-required');
  const at = currentTime(clock);
  requireThat(at >= record.at && at - record.observed <= DATING_RESTORE_MAX_AGE_MS, 'restore-admission-expired');
  requireThat(typeof databasePath === 'string' && path.resolve(databasePath) === record.databasePath
    && environment(expectedEnvironment) === record.environment, 'restore-admission-context-mismatch');
  assertDatingCopyComplete(record.databasePath);
  checkpointed(record.databasePath);
  for (const file of record.files) requireThat(checkedFile(file.path, file.path === record.databasePath ? 256 * 1024 * 1024 : 16 * 1024 * 1024).digest === file.digest, 'restore-files-changed');
  return Object.freeze({ ok: true, fingerprint: record.fingerprint });
}
