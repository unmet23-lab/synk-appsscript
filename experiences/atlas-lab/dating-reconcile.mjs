// Offline reconciliation of a verified old pair, never the running database.
// The source ledger remains operator supplied; this is not a live central read.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { createDatingStore } from './dating-store.mjs';
import { createDatingService } from './dating-service.mjs';
import { inspectDatingBackupPair, inspectDatingReconciliationSource } from './dating-restore.mjs';

const plans = new WeakMap();
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const requireThat = (value, code) => { if (!value) fail(code); };
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identity = row => [row.event_id, row.subject_id, ...(row.sequence === undefined ? [] : [Number(row.sequence), row.status])];
const canonical = value => JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);

function eventTime(row, observed) {
  const value = row.occurred_at;
  requireThat(typeof value === 'string' && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value && Date.parse(value) <= observed, 'reconcile-event-time-required');
  return value;
}
function envelope(row, observed) {
  return { version: row.sequence === undefined ? 1 : 2,
    type: row.sequence === undefined ? 'account.deleted' : 'account.availability',
    eventId: row.event_id, subjectId: row.subject_id, occurredAt: eventTime(row, observed),
    issuer: 'synk-account', audience: 'atlas-dating',
    ...(row.sequence === undefined ? {} : { status: row.status, sequence: Number(row.sequence) }) };
}

function ledgerHistory(value) {
  const histories = new Map(), cursors = new Map(value.cursor.map(row => [row.subject_id, Number(row.sequence)]));
  for (const row of [...value.events, ...value.deletion])
    requireThat(row.subject_id === row.subject_id.toLowerCase() && row.event_id === row.event_id.toLowerCase(), 'reconcile-canonical-identity-required');
  for (const row of value.accounts) requireThat(row.synk_user_id === row.synk_user_id.toLowerCase(), 'reconcile-canonical-identity-required');
  for (const row of value.events) {
    if (!histories.has(row.subject_id)) histories.set(row.subject_id, []);
    histories.get(row.subject_id).push(row);
  }
  for (const [subject, rows] of histories) {
    rows.sort((a, b) => Number(a.sequence) - Number(b.sequence));
    requireThat(rows.every((row, index) => Number(row.sequence) === index + 1)
      && cursors.get(subject) === rows.length, 'reconcile-history-gap');
  }
  for (const row of value.cursor) requireThat(histories.has(row.subject_id), 'reconcile-history-gap');
  const deletions = new Set(value.deletion.map(row => row.subject_id));
  for (const row of value.accounts) {
    const history = histories.get(row.synk_user_id);
    if (row.status === 'deleted') requireThat(deletions.has(row.synk_user_id), 'restore-terminal-ledger-missing');
    else requireThat(history ? history.at(-1).status === row.status : row.status === 'active', 'reconcile-account-history-mismatch');
  }
  return histories;
}

function extension(old, latest) {
  ledgerHistory(old); ledgerHistory(latest);
  const accounts = new Map(latest.accounts.map(row => [row.synk_user_id, row]));
  for (const row of old.accounts) {
    const next = accounts.get(row.synk_user_id);
    requireThat(!!next, 'reconcile-account-history-dropped');
    requireThat(row.status !== 'deleted' || next.status === 'deleted', 'reconcile-terminal-history-regressed');
  }
  for (const key of ['events', 'deletion']) {
    const rows = new Map(latest[key].map(row => [row.event_id, row]));
    for (const row of old[key]) {
      const next = rows.get(row.event_id);
      requireThat(!!next && same(identity(row), identity(next))
        && (row.occurred_at === undefined || row.occurred_at === next.occurred_at), 'reconcile-event-history-rewritten');
    }
  }
  const cursors = new Map(latest.cursor.map(row => [row.subject_id, Number(row.sequence)]));
  for (const row of old.cursor) requireThat((cursors.get(row.subject_id) || 0) >= Number(row.sequence), 'reconcile-cursor-regressed');
}

function unchanged(record, clock) {
  const checked = inspectDatingReconciliationSource({ ...record.options, clock });
  requireThat(checked.fingerprint === record.fingerprint, 'restore-files-changed');
  return checked;
}

export function prepareDatingReconciliation({ sourceManifestSha256, ...options } = {}) {
  requireThat(hex(sourceManifestSha256), 'reconcile-manifest-checksum-required');
  inspectDatingBackupPair(options);
  const input = inspectDatingReconciliationSource(options);
  extension(input.paired.value.central, input.latest.value.central);
  const receipts = new Set(input.product.dating_lifecycle_receipts.map(row => row.event_id));
  const ledgerIds = new Set([...input.latest.value.central.events, ...input.latest.value.central.deletion].map(row => row.event_id));
  requireThat([...receipts].every(id => ledgerIds.has(id)), 'reconcile-product-receipt-without-ledger');
  const available = [...input.latest.value.central.events].sort((a, b) => a.subject_id.localeCompare(b.subject_id) || Number(a.sequence) - Number(b.sequence));
  const deleted = [...input.latest.value.central.deletion].sort((a, b) => a.subject_id.localeCompare(b.subject_id));
  const events = [...available, ...deleted].filter(row => !receipts.has(row.event_id)).map(row => envelope(row, input.observed));
  // All events in a subject's history are replayed in sequence, including a
  // temporary hold before an active state. Applying only the final active row
  // would resurrect an old consent, invitation or accepted relationship.
  const summary = Object.freeze({ ok: true, kind: 'atlas-dating-reconciliation-plan',
    availabilityEventCount: events.filter(row => row.version === 2).length,
    deletionEventCount: events.filter(row => row.version === 1).length,
    sourceManifestSha256, originalProductSha256: input.database.digest,
    originalEvidenceSha256: input.paired.digest, latestEvidenceSha256: input.latest.digest,
    localOnly: true, remoteLatestVerified: false, restoreAdmitted: false });
  const plan = Object.freeze({});
  plans.set(plan, { options, fingerprint: input.fingerprint, events, sourceManifestSha256, summary,
    originalDatabasePath: input.database.path, sourceStat: fs.statSync(input.database.path) });
  return Object.freeze({ summary, plan });
}

async function deliver(service, token, event) {
  const req = Readable.from([Buffer.from(JSON.stringify(event))]);
  req.method = 'POST'; req.url = '/api/atlas-dating/lifecycle';
  req.headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  req.socket = { localAddress: '127.0.0.1', remoteAddress: '127.0.0.1' };
  let status, value;
  const res = { destroyed: false, writableEnded: false,
    writeHead(code) { status = code; }, end(body) { this.writableEnded = true; try { value = JSON.parse(body); } catch { /* Reject below. */ } } };
  const handled = await service.handle(req, res);
  requireThat(handled === true && status === 200 && value?.ok === true
    && value.eventId === event.eventId && value.subjectId === event.subjectId, 'reconcile-lifecycle-apply-failed');
}

export async function applyDatingReconciliation(plan, { databasePath, clock = Date.now } = {}) {
  const record = plans.get(plan); plans.delete(plan);
  requireThat(!!record, 'reconcile-plan-required');
  const input = unchanged(record, clock);
  requireThat(typeof databasePath === 'string' && path.isAbsolute(databasePath), 'reconcile-staged-database-required');
  const destination = path.resolve(databasePath);
  requireThat(!input.files.some(file => file.path === destination), 'reconcile-original-write-forbidden');
  let stat;
  try { stat = fs.lstatSync(destination); } catch { fail('reconcile-staged-database-required'); }
  requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && fs.realpathSync(destination) === destination
    && !(stat.dev === record.sourceStat.dev && stat.ino === record.sourceStat.ino), 'reconcile-original-write-forbidden');
  // This independently rejects journals, wrong bytes, invalid product state and
  // public paths before opening the staged SQLite file for writing.
  inspectDatingBackupPair({ ...record.options, databasePath: destination, clock });
  let store, service;
  try {
    store = createDatingStore({ path: destination, mode: 'account' });
    const token = randomBytes(32).toString('hex');
    service = createDatingService({ store, mode: 'account', clock,
      verify: async () => { fail('reconcile-network-forbidden'); },
      lifecycle: { token, issuer: 'synk-account', audience: 'atlas-dating' } });
    for (const event of record.events) await deliver(service, token, event);
  } finally { if (service) service.close(); else if (store) store.close(); }
  unchanged(record, clock);
  for (const suffix of ['-wal', '-shm', '-journal']) requireThat(!fs.existsSync(destination + suffix), 'restore-database-not-checkpointed');
  const productSha256 = hash(fs.readFileSync(destination));
  const pairedEvidence = { version: 1, kind: 'atlas-dating-restore-snapshot', exportId: randomUUID(),
    environment: input.paired.value.environment, capturedAt: input.latest.value.observedAt, productSha256,
    central: input.latest.value.central,
    provenance: { kind: 'offline-reconciliation', version: 1,
      sourceManifestSha256: record.sourceManifestSha256,
      originalProductSha256: input.database.digest, originalEvidenceSha256: input.paired.digest,
      originalExportId: input.paired.value.exportId, originalCapturedAt: input.paired.value.capturedAt,
      latestEvidenceSha256: input.latest.digest, latestExportId: input.latest.value.exportId,
      reconciledAt: new Date(clock()).toISOString(), newCentralRead: false, remoteLatestVerified: false } };
  return Object.freeze({ summary: Object.freeze({ ...record.summary, kind: 'atlas-dating-reconciliation-applied',
    productSha256, resumeRequired: true }), pairedEvidence });
}
