import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { assertDatingRestoreCompatible as assertCompatible } from '../experiences/atlas-lab/dating-restore.mjs';

const require = createRequire(import.meta.url);
const { PGlite } = require('../../SYNK-talk/node_modules/@electric-sql/pglite');
const { createLifecycleFixture } = require('../../SYNK-talk/tests/lib/account-lifecycle-fixture.js');
const { createPostgresJsonDriver } = require('../../SYNK-talk/tests/lib/postgres-json-fixture.js');
const { createAccountLifecycleDispatcher } = require('../../SYNK-talk/lib/synk-account-lifecycle.js');
const consents = { profilePublic: true, receiveInvitations: true, storePreferences: true };
const digest = value => createHash('sha256').update(value).digest('hex');
const fileHash = async filename => digest(await fs.readFile(filename));
const tables = ['dating_accounts', 'dating_pairs', 'dating_introductions', 'dating_archived_introductions',
  'dating_lifecycle_receipts', 'dating_central_availability', 'dating_availability_sequences', 'dating_receipts', 'dating_clock'];
const canonical = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? String(item)
  : item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

function productRows(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try { return Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])); }
  finally { db.close(); }
}
async function centralRows(central) {
  return {
    accounts: await central.sql`select synk_user_id,status from engine.synk_accounts order by synk_user_id`,
    cursor: await central.sql`select * from engine.synk_account_availability_cursor order by subject_id`,
    events: await central.sql`select * from engine.synk_account_availability order by subject_id,sequence`,
    deletion: await central.sql`select * from engine.synk_account_lifecycle order by subject_id`
  };
}
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-backup-dating-'));
  const filename = path.join(dir, 'account.sqlite'), secret = randomBytes(32).toString('hex');
  let central = await createLifecycleFixture({ availability: true }), server = null, origin, at = Date.now() + 1000;
  const a = await central.account(), b = await central.account();
  const start = async () => {
    assert.equal(server, null);
    server = createDatingServer({ mode: 'account', databasePath: filename, verify: async token => ({ accountId: token }),
      lifecycle: { token: secret, issuer: 'synk-account', audience: 'atlas-dating' } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => { if (server) { const current = server; server = null; current.closeAllConnections(); await new Promise(resolve => current.close(resolve)); } };
  t.after(async () => { await stop(); await central.close();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-backup-dating-'));
    await fs.rm(dir, { recursive: true, force: true }); });
  await start();
  const call = async (route, actor, body, browser = true) => {
    assert.ok(server, 'product must be explicitly admitted before browser access');
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { ...(browser ? { Origin: origin } : {}), Authorization: `Bearer ${actor}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { httpStatus: response.status, ...await response.json() };
  };
  const get = async actor => { const response = await call('/state', actor); assert.equal(response.httpStatus, 200); return response.view; };
  const action = async (actor, input) => call('/action', actor, { requestId: randomUUID(), expectedRevision: (await get(actor)).revision, action: input });
  const ok = async (actor, input) => { const response = await action(actor, input); assert.equal(response.httpStatus, 200, response.error?.code); return response; };
  const intro = async (actor, pairId, input) => { const pair = (await get(actor)).pairs.find(row => row.pairId === pairId);
    return ok(actor, { kind: 'introduction', pairId, expectedIntroductionRevision: pair.introduction.revision, action: input }); };
  const onboard = async () => { for (const [actor, nickname] of [[a.synk_user_id, '가상 A'], [b.synk_user_id, '가상 B']]) {
    await ok(actor, { kind: 'profile', profile: { nickname, region: '가상 지역', intro: '복구 합성 시험', values: { availability: 'weekend' }, required: [] } });
    await ok(actor, { kind: 'adult', declared: true }); await ok(actor, { kind: 'consents', consents });
    for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' })) await ok(actor, { kind: 'discovery', action: { kind: 'set', field, value } });
  } };
  const send = () => ok(a.synk_user_id, { kind: 'connect', targetAccountId: b.synk_user_id });
  const connected = async () => { await onboard(); const sent = await send(); await intro(b.synk_user_id, sent.result.pairId,
    { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' }); return sent; };
  const run = async ({ lose = null, packets = [] } = {}) => {
    const worker = createAccountLifecycleDispatcher({ sql: central.sql, receiverUrl: origin + '/api/atlas-dating/lifecycle', token: secret,
      clock: () => new Date(at).toISOString(), fetchImpl: async (url, init) => {
        assert.equal(new URL(url).origin, origin); const packet = JSON.parse(init.body); packets.push(packet);
        const response = await fetch(url, init); if (lose?.(packet)) { assert.equal(response.status, 200); await response.json(); throw new Error('synthetic acknowledgment lost after product commit'); }
        return response;
      } });
    return worker.runOnce({ limit: lose ? 1 : 20 });
  };
  const setStatus = async status => { at = Math.max(at + 2000, Date.now() + 1000); await central.sql`update engine.synk_accounts set status=${status} where synk_user_id=${a.synk_user_id}::uuid`; };
  const request = async () => { at = Math.max(at + 2000, Date.now() + 1000); const requestId = randomUUID();
    await central.sql`update engine.synk_accounts set status='deletion-requested' where synk_user_id=${a.synk_user_id}::uuid`;
    await central.sql`insert into engine.synk_data_requests(request_id,synk_user_id,kind,requested_at) values(${requestId}::uuid,${a.synk_user_id}::uuid,'delete',${new Date(Date.now() - 8 * 86400000).toISOString()}::timestamptz)`;
    return requestId;
  };
  const capture = async () => {
    // All fixture writes and the dispatcher are awaited. Stop browser admission
    // before the two snapshots; no concurrent writer or worker is permitted.
    await stop(); const name = randomUUID(), centralPath = path.join(dir, `${name}.tar.gz`), productPath = path.join(dir, `${name}.sqlite`);
    const centralState = await centralRows(central), productState = productRows(filename); assertCompatible(centralState, productState);
    const dump = await central.db.dumpDataDir(); await fs.writeFile(centralPath, Buffer.from(await dump.arrayBuffer()));
    const source = new DatabaseSync(filename, { readOnly: true }); try { await backup(source, productPath); } finally { source.close(); }
    assert.deepEqual(productRows(productPath), productState);
    return { centralPath, productPath, centralState, productState,
      manifest: { centralSha256: await fileHash(centralPath), productSha256: await fileHash(productPath),
        centralInventory: digest(canonical(centralState)), productInventory: digest(canonical(productState)) } };
  };
  const restore = async (snapshot, { admit = true, knownLatest = null } = {}) => {
    await stop(); assert.equal(await fileHash(snapshot.centralPath), snapshot.manifest.centralSha256, 'central-backup-checksum-mismatch');
    assert.equal(await fileHash(snapshot.productPath), snapshot.manifest.productSha256, 'product-backup-checksum-mismatch');
    await central.close(); const db = new PGlite({ loadDataDir: new Blob([await fs.readFile(snapshot.centralPath)]) });
    const sql = createPostgresJsonDriver(db); central = { db, sql, async close() { await sql.end(); await db.close(); } };
    for (const suffix of ['-wal', '-shm']) await fs.rm(filename + suffix, { force: true });
    await fs.copyFile(snapshot.productPath, filename);
    const centralState = await centralRows(central), productState = productRows(filename);
    assert.equal(digest(canonical(centralState)), snapshot.manifest.centralInventory, 'central-backup-inventory-mismatch');
    assert.equal(digest(canonical(productState)), snapshot.manifest.productInventory, 'product-backup-inventory-mismatch');
    assertCompatible(centralState, productState, knownLatest); if (admit) await start(); return { centralState, productState };
  };
  return { dir, filename, a: a.synk_user_id, b: b.synk_user_id, start, stop, get, action, ok, intro, send, connected, onboard, run, setStatus, request, capture, restore,
    advance: milliseconds => { at += milliseconds; }, get central() { return central; },
    deliver: packet => call('/lifecycle', secret, packet, false),
    read: async () => ({ centralState: await centralRows(central), productState: productRows(filename) }) };
}
const wire = row => ({ version: 2, type: 'account.availability', eventId: row.event_id, subjectId: row.subject_id,
  occurredAt: new Date(row.occurred_at).toISOString(), issuer: 'synk-account', audience: 'atlas-dating', status: row.status, sequence: Number(row.sequence) });

test('paired PGlite dump/load and SQLite backup restore a lost-ack hold, replay exactly, and require fresh consent and acceptance', async t => {
  const f = await fixture(t), old = await f.connected(); assert.equal((await f.run()).delivered, 2);
  await f.setStatus('disabled'); const first = []; assert.equal((await f.run({ packets: first, lose: packet => packet.status === 'disabled' })).pending, 1);
  const snapshot = await f.capture(); assert.equal(snapshot.productState.dating_archived_introductions.length, 1);
  assert.equal(snapshot.centralState.accounts.find(row => row.synk_user_id === f.a).status, 'disabled');
  assert.equal(Number(snapshot.centralState.cursor.find(row => row.subject_id === f.a).sequence), 2);
  assert.equal(snapshot.centralState.events.find(row => row.subject_id === f.a && Number(row.sequence) === 2).state, 'pending');
  assert.equal(snapshot.productState.dating_central_availability.find(row => row.subject_id === f.a).sequence, 2);
  await f.start(); await f.setStatus('active'); f.advance(5000); await f.run(); await f.ok(f.a, { kind: 'consents', consents });
  await f.intro(f.a, old.result.pairId, { kind: 'reopen' }); const changed = await f.send();
  await f.intro(f.b, changed.result.pairId, { kind: 'respond', introductionId: changed.result.introductionId, value: 'accept' });
  const restored = await f.restore(snapshot); assert.deepEqual(restored.centralState, snapshot.centralState); assert.deepEqual(restored.productState, snapshot.productState);
  const retry = []; f.advance(5000); assert.equal((await f.run({ packets: retry })).delivered, 1); assert.deepEqual(retry[0], first[0]);
  const rows = (await f.read()).productState; assert.deepEqual(rows.dating_lifecycle_receipts, snapshot.productState.dating_lifecycle_receipts);
  assert.deepEqual(rows.dating_archived_introductions, snapshot.productState.dating_archived_introductions);
  assert.equal((await f.get(f.b)).candidates.some(row => row.accountId === f.a), false);
  const baseline = snapshot.centralState.events.find(row => row.subject_id === f.a && Number(row.sequence) === 1);
  const ignored = await f.deliver({ ...wire(baseline), eventId: randomUUID() }); assert.equal(ignored.status, 'ignored');
  assert.equal((await f.deliver({ ...wire(baseline), eventId: randomUUID(), status: 'disabled' })).httpStatus, 409);
  await f.setStatus('active'); assert.equal((await f.run()).delivered, 1);
  let owner = await f.get(f.a); assert.equal(owner.consents.profilePublic, false); assert.equal(owner.centralAvailability.resumeRequired, true);
  assert.equal(owner.centralAvailability.sequence, 3);
  assert.equal(owner.pairs.find(row => row.pairId === old.result.pairId).introduction.accepted, false);
  await f.ok(f.a, { kind: 'consents', consents }); assert.equal((await f.action(f.a, { kind: 'connect', targetAccountId: f.b })).httpStatus, 403);
  await f.intro(f.a, old.result.pairId, { kind: 'reopen' }); const fresh = await f.send(); assert.notEqual(fresh.result.pairId, old.result.pairId);
  owner = await f.get(f.a); assert.equal(owner.pairs.find(row => row.pairId === fresh.result.pairId).introduction.accepted, false);
  await f.intro(f.b, fresh.result.pairId, { kind: 'respond', introductionId: fresh.result.introductionId, value: 'accept' });
  assert.equal((await f.get(f.a)).pairs.find(row => row.pairId === fresh.result.pairId).introduction.accepted, true);
});

test('restored final deletion receipt and tombstone survive worker replay and every later active event', async t => {
  const f = await fixture(t); await f.connected(); await f.run(); const requestId = await f.request();
  assert.equal((await f.central.sql`select engine.purge_synk_account(${requestId}::uuid) as result`)[0].result.status, 'completed');
  const first = []; assert.equal((await f.run({ packets: first, lose: packet => packet.type === 'account.deleted' })).pending, 1);
  const snapshot = await f.capture(); assert.equal(snapshot.productState.dating_accounts.find(row => row.id === f.a).document, null);
  await f.start(); await f.ok(f.b, { kind: 'preferences', preferences: { 'wants.contact': 'daily' } });
  await f.restore(snapshot); const retry = []; f.advance(5000); assert.ok((await f.run({ packets: retry })).delivered >= 1);
  assert.deepEqual(retry.find(packet => packet.type === 'account.deleted'), first[0]); assert.equal((await f.get(f.a)).deleted, true);
  const latest = snapshot.centralState.events.filter(row => row.subject_id === f.a).at(-1);
  assert.equal((await f.deliver({ ...wire(latest), eventId: randomUUID(), status: 'active', sequence: Number(latest.sequence) + 100 })).status, 'ignored');
  assert.equal((await f.get(f.a)).deleted, true); assert.equal((await f.action(f.a, { kind: 'adult', declared: true })).httpStatus, 410);
  assert.equal((await f.read()).productState.dating_archived_introductions.length, 0);
});

test('a missing central cursor or product lifecycle ledger fails read-only admission before the host is opened', async t => {
  const f = await fixture(t); await f.connected(); await f.run(); await f.setStatus('disabled'); await f.run();
  const snapshot = await f.capture(); await f.restore(snapshot, { admit: false });
  await f.central.db.exec('alter table engine.synk_account_availability_cursor disable trigger synk_account_availability_cursor_guard; delete from engine.synk_account_availability_cursor;');
  const incompleteCentral = await centralRows(f.central);
  assert.throws(() => assertCompatible(incompleteCentral, productRows(f.filename)), /central-cursor-missing/);
  await f.restore(snapshot, { admit: false });
  const validCentral = await centralRows(f.central);
  for (const [table, reason] of [['dating_lifecycle_receipts', /central-delivered-without-product-receipt/],
    ['dating_central_availability', /product-high-water-missing/], ['dating_availability_sequences', /product-sequence-observation-missing/]]) {
    const partial = path.join(f.dir, `partial-${table}.sqlite`); await fs.copyFile(snapshot.productPath, partial);
    const db = new DatabaseSync(partial); db.exec(`DELETE FROM ${table}`); db.close();
    assert.throws(() => assertCompatible(validCentral, productRows(partial)), reason);
  }
  await f.central.db.exec('alter table engine.synk_account_availability disable trigger synk_account_availability_immutable; delete from engine.synk_account_availability;');
  const missingOutbox = await centralRows(f.central);
  assert.throws(() => assertCompatible(missingOutbox, productRows(f.filename)), /central-cursor-history-mismatch/);
  // Corrupt an actual SQLite backup, not only its projected inventory. A trusted
  // manifest must reject loss of archived private introduction history too.
  const db = new DatabaseSync(snapshot.productPath); db.exec('DELETE FROM dating_archived_introductions'); db.close();
  await assert.rejects(f.restore(snapshot), /product-backup-checksum-mismatch/);
});
test('individually valid snapshots from different delivery points fail paired restore admission', async t => {
  const f = await fixture(t); await f.connected(); await f.run(); const old = await f.capture(); await f.start();
  await f.setStatus('disabled'); await f.run(); const current = await f.capture();
  const mixed = { ...old, centralPath: current.centralPath, manifest: { ...old.manifest,
    centralSha256: current.manifest.centralSha256, centralInventory: current.manifest.centralInventory } };
  await assert.rejects(f.restore(mixed), /central-delivered-without-product-receipt/);
});

test('two coherent old backups need newer deletion and sequence knowledge outside the pair to reject rollback', async t => {
  const f = await fixture(t); await f.connected(); await f.run(); const old = await f.capture(); await f.start();
  const requestId = await f.request(), knownNewerHold = await centralRows(f.central);
  await f.central.sql`select engine.purge_synk_account(${requestId}::uuid)`; await f.run();
  const knownLatest = await centralRows(f.central); assert.equal((await f.get(f.a)).deleted, true);
  const restored = await f.restore(old, { admit: false });
  assert.equal(restored.productState.dating_accounts.find(row => row.id === f.a).status, 'active');
  assert.equal(JSON.parse(restored.productState.dating_accounts.find(row => row.id === f.a).document).consents.profilePublic, true);
  assert.ok(JSON.parse(restored.productState.dating_introductions[0].document).events.some(row => row.kind === 'respond' && row.value === 'accept'));
  assert.throws(() => assertCompatible(restored.centralState, restored.productState, knownNewerHold), /known-newer-central-sequence-missing/);
  assert.throws(() => assertCompatible(restored.centralState, restored.productState, knownLatest), /known-terminal-deletion-missing/);
  // Deliberately do not admit this consistent-but-stale pair. Neither database
  // can infer events erased by rolling both databases back to the same old point.
});
