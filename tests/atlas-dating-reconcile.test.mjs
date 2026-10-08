import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createIntroductionsAdapter } from '../experiences/atlas-lab/introductions.mjs';
import { createAppointmentsAdapter } from '../experiences/atlas-lab/appointments.mjs';
import { prepareDatingReconciliation, applyDatingReconciliation } from '../experiences/atlas-lab/dating-reconcile.mjs';
import { inspectDatingRestore, inspectDatingStagedRestore, consumeDatingRestoreAdmission } from '../experiences/atlas-lab/dating-restore.mjs';

const at = Date.parse('2026-10-08T06:00:00.000Z'), iso = value => new Date(value).toISOString();
const oldAt = iso(at - 30 * 86400000), current = iso(at), environment = {
  accountApiUrl: 'https://identity.example.invalid/functions/v1/synk-account', clientId: 'synthetic-reconcile', issuer: 'synk-account', audience: 'atlas-dating' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = filename => hash(fs.readFileSync(filename));
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const packet = row => ({ version: row.sequence === undefined ? 1 : 2, type: row.sequence === undefined ? 'account.deleted' : 'account.availability',
  eventId: row.event_id, subjectId: row.subject_id, occurredAt: row.occurred_at, issuer: 'synk-account', audience: 'atlas-dating',
  ...(row.sequence === undefined ? {} : { sequence: row.sequence, status: row.status }) });
async function deliver(service, event) {
  const req = Readable.from([Buffer.from(JSON.stringify(event))]); req.method = 'POST'; req.url = '/api/atlas-dating/lifecycle';
  req.headers = { authorization: 'Bearer synthetic-lifecycle-token-000000000000000000', 'content-type': 'application/json' };
  req.socket = { localAddress: '127.0.0.1', remoteAddress: '127.0.0.1' };
  let status, result; const res = { writeHead(value) { status = value; }, end(value) { result = JSON.parse(value); } };
  await service.handle(req, res); return { status, result };
}
function fixture(t, { suspended = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-reconcile-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('synk-reconcile-')); fs.rmSync(dir, { recursive: true, force: true }); });
  const databasePath = path.join(dir, 'original.sqlite'), evidencePath = path.join(dir, 'paired.json'), latestEvidencePath = path.join(dir, 'latest.json');
  const a = randomUUID(), b = randomUUID(), pairId = randomUUID();
  const accounts = [a, b].map(id => ({ synk_user_id: id, status: 'active' }));
  const events = [a, b].map(subject_id => ({ event_id: randomUUID(), subject_id, sequence: 1, status: 'active', state: 'delivered', occurred_at: oldAt }));
  const central = { accounts, events, cursor: [a, b].map(subject_id => ({ subject_id, sequence: 1 })), deletion: [] };
  const intros = createIntroductionsAdapter(), dates = createAppointmentsAdapter();
  let intro = intros.create({ people: [a, b], at: oldAt }); const introductionId = randomUUID();
  intro = intros.record(intro, { kind: 'send', actor: a, pairId, requestId: introductionId, expectedRevision: intro.revision, at: oldAt });
  intro = intros.record(intro, { kind: 'respond', actor: b, introductionId, value: 'accept', requestId: randomUUID(), expectedRevision: intro.revision, at: oldAt });
  let appointment = dates.create({ pairId, people: [a, b].map(id => ({ id, label: 'synthetic private name' })), at: oldAt });
  const act = (actor, action, time = oldAt) => { appointment = dates.record(appointment, { ...action, actor, requestId: randomUUID(), expectedRevision: appointment.revision, at: time }); };
  act(a, { kind: 'propose', schedule: { startsAt: iso(Date.parse(oldAt) + 60000), endsAt: iso(Date.parse(oldAt) + 120000), timeZone: 'Asia/Seoul', place: 'erase-private-place', note: 'erase-private-note' } });
  const appointmentId = dates.inspect(appointment, { viewer: a, at: oldAt }).currentId;
  for (const actor of [a, b]) act(actor, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  for (const actor of [a, b]) { act(actor, { kind: 'complete', appointmentId }, iso(Date.parse(oldAt) + 180000));
    act(actor, { kind: 'reflect', appointmentId, value: 'good', note: actor === b ? 'peer-own-reflection' : 'erase-own-reflection' }, iso(Date.parse(oldAt) + 180000)); }
  const store = createDatingStore({ path: databasePath, mode: 'account' });
  store.transaction(tx => {
    for (const id of [a, b]) {
      let account = tx.ensureAccount(id, { profile: { nickname: 'synthetic-private-name', values: {}, required: [] }, preferences: { private: 'keep-own-preference' },
        consents: { profilePublic: true, receiveInvitations: true, storePreferences: true }, adult: { selfDeclared: true },
        paused: false, blocks: [], bookmarks: id === b ? [{ targetAccountId: a }] : [], archivedReflections: [], createdAt: oldAt, updatedAt: oldAt });
      if (id === a && suspended) tx.updateAccount(account, account.document, 'suspended');
      const event = events.find(row => row.subject_id === id);
      tx.putCentralAvailability(id, 1, 'active', false, oldAt); tx.rememberAvailabilitySequence(id, 1, 'active');
      tx.putLifecycleReceipt('synk-account', event.event_id, hash(canonical(packet(event))), oldAt, { ok: true, eventId: event.event_id, status: 'applied', subjectId: id, sequence: 1 });
    }
    tx.putPair({ id: pairId, a, b, revision: appointment.revision, document: appointment });
    tx.putIntroduction(a, b, intro); tx.putAlignment(pairId, { revision: 0, private: 'erase-private-alignment' }, 0);
    tx.putReceipt(a, randomUUID(), 'a'.repeat(64), 1, { private: 'erase-private-receipt' }); tx.expose(a, 'private-context', b);
    tx.addReport({ id: randomUUID(), reporter: a, target: b, reason: 'other', details: 'erase-private-report', at: oldAt });
  }); store.close();
  const paired = { version: 1, kind: 'atlas-dating-restore-snapshot', exportId: randomUUID(), environment,
    capturedAt: iso(Date.parse(oldAt) + 240000), productSha256: digest(databasePath), central };
  const latest = { version: 1, kind: 'atlas-dating-restore-latest', exportId: randomUUID(), environment, observedAt: current,
    source: 'independent-current-central-ledger', central: structuredClone(central) };
  const save = () => { fs.writeFileSync(evidencePath, JSON.stringify(paired)); fs.writeFileSync(latestEvidencePath, JSON.stringify(latest)); }; save();
  const options = { databasePath, evidencePath, latestEvidencePath, expectedEnvironment: environment, sourceManifestSha256: 'c'.repeat(64), clock: () => at };
  const add = (status, subject = a) => {
    let account = latest.central.accounts.find(row => row.synk_user_id === subject);
    if (!account) { account = { synk_user_id: subject, status }; latest.central.accounts.push(account); } account.status = status;
    if (status === 'deleted') { const row = { event_id: randomUUID(), subject_id: subject, state: 'pending', occurred_at: iso(at - 1000) }; latest.central.deletion.push(row); return row; }
    let cursor = latest.central.cursor.find(row => row.subject_id === subject);
    if (!cursor) { cursor = { subject_id: subject, sequence: 0 }; latest.central.cursor.push(cursor); }
    const row = { event_id: randomUUID(), subject_id: subject, sequence: ++cursor.sequence, status, state: 'pending', occurred_at: iso(at - 2000) };
    latest.central.events.push(row); return row;
  };
  const prepare = () => { save(); return prepareDatingReconciliation(options); };
  const apply = async prepared => {
    const out = path.join(dir, 'restored-' + randomUUID()); fs.mkdirSync(out);
    const copy = path.join(out, 'account.sqlite'), derived = path.join(out, 'paired.json'); fs.copyFileSync(databasePath, copy);
    const result = await applyDatingReconciliation((prepared || prepare()).plan, { databasePath: copy, clock: () => at });
    fs.writeFileSync(derived, JSON.stringify(result.pairedEvidence));
    const restored = { databasePath: copy, evidencePath: derived, latestEvidencePath, expectedEnvironment: environment, clock: () => at };
    assert.equal(inspectDatingRestore(restored).summary.ok, true); return { ...result, ...restored, out };
  };
  return { ...options, dir, a, b, pairId, paired, latest, save, add, prepare, apply };
}
function read(filename, fn) { const store = createDatingStore({ path: filename, mode: 'account' }); try { return store.transaction(fn); } finally { store.close(); } }

test('disabled then active replay closes relationships, revokes public consent and keeps suspended product status', async t => {
  const f = fixture(t, { suspended: true }); f.add('disabled'); f.add('active'); f.save();
  const sources = [f.databasePath, f.evidencePath, f.latestEvidencePath], before = sources.map(digest);
  const result = await f.apply(), state = read(result.databasePath, tx => ({ account: tx.account(f.a), pair: tx.pair(f.pairId),
    intro: tx.introduction(f.a, f.b), archived: tx.archivedIntroductions(f.a), alignment: tx.alignment(f.pairId) }));
  assert.equal(state.account.status, 'suspended'); assert.equal(state.account.centralAvailability.sequence, 3);
  assert.equal(state.account.centralAvailability.resume_required, 1);
  assert.deepEqual(state.account.document.consents, { profilePublic: false, receiveInvitations: false, storePreferences: true });
  assert.equal(state.account.document.preferences.private, 'keep-own-preference'); assert.equal(state.pair.status, 'closed');
  assert.equal(state.alignment.document, null); assert.equal(state.archived.length, 1);
  assert.equal(createIntroductionsAdapter().inspect(state.intro.document, { viewer: f.a, at: current }).accepted, false);
  assert.deepEqual(sources.map(digest), before); assert.equal(result.summary.availabilityEventCount, 2);
  assert.equal(result.pairedEvidence.provenance.originalProductSha256, before[0]);
  assert.equal(result.pairedEvidence.provenance.latestExportId, f.latest.exportId);
  assert.doesNotMatch(JSON.stringify(result.summary), /synthetic-private|keep-own|synk-reconcile/);
  assert.ok(!JSON.stringify(result.summary).includes(f.a));
});

test('terminal deletion erases restored private data and preserves only the peer own reflection', async t => {
  const f = fixture(t); f.add('deleted'); const result = await f.apply();
  const state = read(result.databasePath, tx => ({ account: tx.account(f.a), peer: tx.account(f.b), pair: tx.pair(f.pairId),
    intro: tx.introductions(f.a), archived: tx.archivedIntroductions(f.a), alignment: tx.alignment(f.pairId), reports: tx.reports(f.a, true), exposure: tx.exposureCounts() }));
  assert.equal(state.account.status, 'deleted'); assert.equal(state.account.document, null); assert.equal(state.pair.document, null);
  assert.equal(state.pair.status, 'closed'); assert.deepEqual(state.intro, []); assert.deepEqual(state.archived, []); assert.equal(state.alignment, null);
  assert.deepEqual(state.peer.document.bookmarks, []); assert.equal(state.peer.document.archivedReflections.length, 1);
  assert.equal(state.peer.document.archivedReflections[0].note, 'peer-own-reflection');
  assert.ok(state.reports.every(row => row.reporter === null && row.details === null)); assert.deepEqual(state.exposure, {});
  const db = new DatabaseSync(result.databasePath, { readOnly: true });
  try { assert.equal(db.prepare('SELECT count(*) n FROM dating_receipts WHERE actor=?').get(f.a).n, 0); } finally { db.close(); }
});

test('new central-only availability makes no profile while central-only deletion creates a terminal tombstone', async t => {
  const f = fixture(t), active = randomUUID(), deleted = randomUUID(); f.add('active', active); f.add('deleted', deleted);
  const result = await f.apply(), state = read(result.databasePath, tx => ({ active: tx.account(active), fence: tx.centralAvailability(active), deleted: tx.account(deleted) }));
  assert.equal(state.active, null); assert.equal(state.fence.status, 'active'); assert.equal(state.deleted.status, 'deleted'); assert.equal(state.deleted.document, null);
});

test('replayed receipts accept the exact later central delivery without digest conflict or another revision', async t => {
  const f = fixture(t), event = f.add('disabled'), result = await f.apply();
  const store = createDatingStore({ path: result.databasePath, mode: 'account' });
  const before = store.transaction(tx => tx.account(f.a).revision);
  const service = createDatingService({ store, verify: async () => { throw new Error('network must not run'); }, clock: () => at,
    lifecycle: { token: 'synthetic-lifecycle-token-000000000000000000', issuer: 'synk-account', audience: 'atlas-dating' } });
  try { assert.equal((await deliver(service, packet(event))).status, 200); assert.equal(store.transaction(tx => tx.account(f.a).revision), before); }
  finally { service.close(); }
});

test('missing or invalid original event times never create replacement event identities', t => {
  for (const value of [undefined, 'bad', iso(at + 1), '2026-10-08T06:00:00Z']) {
    const f = fixture(t), event = f.add('disabled'); event.occurred_at = value;
    assert.throws(() => f.prepare(), /reconcile-event-time-required/);
  }
});

test('account removal, rewritten event identity, missing history and status without an event fail before writing', t => {
  const mutations = [
    f => { f.latest.central.accounts = f.latest.central.accounts.filter(row => row.synk_user_id !== f.b); f.latest.central.events = f.latest.central.events.filter(row => row.subject_id !== f.b); f.latest.central.cursor = f.latest.central.cursor.filter(row => row.subject_id !== f.b); },
    f => { f.latest.central.events[0].event_id = randomUUID(); },
    f => { const row = f.add('active'); row.sequence = 3; f.latest.central.cursor.find(row => row.subject_id === f.a).sequence = 3; },
    f => { f.latest.central.accounts[0].status = 'disabled'; },
    f => { f.latest.central.events[0].occurred_at = iso(Date.parse(oldAt) + 1); },
  ];
  for (const mutate of mutations) { const f = fixture(t), before = digest(f.databasePath); mutate(f); assert.throws(() => f.prepare(), /reconcile-/); assert.equal(digest(f.databasePath), before); }
});

test('stale, wrong environment and non-independent evidence remain rejected', t => {
  const mutations = [f => { f.latest.observedAt = iso(at - 300001); }, f => { f.latest.environment = { ...environment, clientId: 'wrong' }; },
    f => { f.latest.exportId = f.paired.exportId; }, f => { f.latest.source = 'restored-backup'; }];
  for (const mutate of mutations) { const f = fixture(t); mutate(f); assert.throws(() => f.prepare(), /restore-/); }
});

test('a plan cannot mutate the original, a hard-link alias, or a copy after latest evidence changes', async t => {
  const f = fixture(t); f.add('disabled'); const before = digest(f.databasePath);
  await assert.rejects(applyDatingReconciliation(f.prepare().plan, { databasePath: f.databasePath, clock: () => at }), /reconcile-original-write-forbidden/);
  const alias = path.join(f.dir, 'alias.sqlite'); fs.linkSync(f.databasePath, alias);
  await assert.rejects(applyDatingReconciliation(f.prepare().plan, { databasePath: alias, clock: () => at }), /reconcile-original-write-forbidden/); fs.unlinkSync(alias);
  const plan = f.prepare().plan, copy = path.join(f.dir, 'copy.sqlite'); fs.copyFileSync(f.databasePath, copy);
  f.latest.central.events[0].state = 'pending'; f.save();
  await assert.rejects(applyDatingReconciliation(plan, { databasePath: copy, clock: () => at }), /restore-files-changed/);
  await assert.rejects(applyDatingReconciliation(plan, { databasePath: copy, clock: () => at }), /reconcile-plan-required/);
  assert.equal(digest(copy), before); assert.equal(digest(f.databasePath), before);
});

test('an incomplete marker permits a read-only staged check but blocks inspection and consumed admission', async t => {
  const f = fixture(t), result = await f.apply(), admission = inspectDatingRestore(result).admission;
  const marker = path.join(result.out, '.backup-incomplete'); fs.writeFileSync(marker, 'incomplete');
  const staged = inspectDatingStagedRestore(result); assert.equal(staged.summary.restoreAdmitted, false); assert.equal(staged.admission, undefined);
  assert.throws(() => inspectDatingRestore(result), /restore-bundle-incomplete/);
  assert.throws(() => consumeDatingRestoreAdmission(admission, result), /restore-bundle-incomplete/);
  fs.unlinkSync(marker); assert.equal(inspectDatingRestore(result).summary.ok, true);
});

test('a legacy snapshot without event timestamps can reconcile only newly timestamped ledger events', async t => {
  const f = fixture(t);
  for (const row of [...f.paired.central.events, ...f.latest.central.events]) delete row.occurred_at;
  f.add('disabled');
  const result = await f.apply();
  assert.equal(result.summary.availabilityEventCount, 1);
  assert.equal(result.pairedEvidence.provenance.originalExportId, f.paired.exportId);
  assert.equal(read(result.databasePath, tx => tx.centralAvailability(f.a).status), 'disabled');
});

test('a known terminal ledger account cannot be reactivated by dropping its deletion history', async t => {
  const f = fixture(t); f.add('deleted'); const result = await f.apply();
  f.latest.exportId = randomUUID();
  f.latest.central.accounts.find(row => row.synk_user_id === f.a).status = 'active'; f.latest.central.deletion = [];
  fs.writeFileSync(f.latestEvidencePath, JSON.stringify(f.latest));
  assert.throws(() => prepareDatingReconciliation({ databasePath: result.databasePath, evidencePath: result.evidencePath,
    latestEvidencePath: f.latestEvidencePath, expectedEnvironment: environment, sourceManifestSha256: 'c'.repeat(64), clock: () => at }), /reconcile-terminal-history-regressed/);
});
