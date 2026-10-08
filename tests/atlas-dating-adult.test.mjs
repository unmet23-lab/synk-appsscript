import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createDatingAdultVerifier, readDatingAdultClaim, datingAdultProjection } from '../experiences/atlas-lab/dating-adult.mjs';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const START = '2026-10-07T03:00:00.000Z', ISSUER = 'local-adult-fixture';
const claim = (subjectId = 'synk:a', patch = {}) => ({ version: 1, subjectId, issuer: ISSUER, status: 'verified', sequence: 1,
  issuedAt: START, validUntil: '2026-10-08T03:00:00.000Z', ...patch });
const consents = { profilePublic: true, receiveInvitations: true, storePreferences: true };
const p = (nickname, values = { availability: 'weekend' }) => ({ nickname, region: '가상 지역', intro: '직접 공개한 소개', values, required: [] });
const read = (value, at = START) => readDatingAdultClaim(value, { subjectId: 'synk:a', issuer: ISSUER, at });

test('the adult assertion trusts only the exact pinned server contract, never a DOB, client token or different subject', () => {
  assert.equal(read(claim()).status, 'verified');
  for (const status of ['pending', 'unverified', 'revoked']) assert.equal(read(claim('synk:a', { status, validUntil: null })).status, status);
  for (const patch of [{ version: 2 }, { subjectId: 'synk:b' }, { issuer: 'other' }, { status: 'adult' }, { sequence: 0 }, { sequence: 1.1 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 }, { issuedAt: '2026-10-07T03:00:01.000Z' }, { issuedAt: '2026-10-07' }, { validUntil: START },
    { status: 'revoked' }, { validUntil: null }, { dateOfBirth: 'private-fixture-dob' }, { token: 'private-fixture-token' }, { document: 'private-fixture-document' }])
    assert.throws(() => read(claim('synk:a', patch)), TypeError);
  const missing = claim(); delete missing.sequence; assert.throws(() => read(missing));
  assert.throws(() => read(Object.create(claim()))); assert.throws(() => read({ ...claim(), __proto__: { status: 'verified' } }));
});
test('expiry is evaluated at the exact boundary and the display projection excludes the assertion subject and issuer', () => {
  const state = { claim: claim(), status: 'verified', resumeRequired: true, checkedAt: START };
  const fresh = datingAdultProjection({ required: true, state, at: START });
  assert.equal(fresh.status, 'verified'); assert.equal(fresh.canResume, true);
  const expired = datingAdultProjection({ required: true, state, at: state.claim.validUntil });
  assert.equal(expired.status, 'expired'); assert.equal(expired.canResume, false);
  assert.equal(datingAdultProjection({ required: true, state: { ...state, status: 'unavailable' }, at: START }).status, 'unavailable');
  assert.deepEqual(Object.keys(fresh), ['required', 'status', 'validUntil', 'checkedAt', 'resumeRequired', 'canResume']);
  assert.equal(datingAdultProjection().required, false);
});
test('a bounded verifier receives only the verified account subject and abort signal; errors never become verified or a declaration fallback', async () => {
  const seen = [], verifier = createDatingAdultVerifier({ required: true, issuer: ISSUER, verify: async input => { seen.push(input); return claim(input.subjectId); } });
  assert.equal((await verifier.check('synk:a', START)).unavailable, false);
  assert.deepEqual(Object.keys(seen[0]), ['subjectId', 'at', 'signal']); assert.ok(seen[0].signal instanceof AbortSignal);
  for (const verify of [async () => { throw Error('private-provider-fixture-error'); }, async () => ({ ...claim(), token: 'never-accepted' }), async () => claim('synk:b')])
    assert.deepEqual(await createDatingAdultVerifier({ required: true, issuer: ISSUER, verify }).check('synk:a', START), { claim: null, unavailable: true });
});
test('verifier timeout aborts its signal and a late success cannot promote the returned unavailable result', async () => {
  let signal;
  const result = await createDatingAdultVerifier({ required: true, issuer: ISSUER, timeoutMs: 10,
    verify: async input => { signal = input.signal; await new Promise(resolve => setTimeout(resolve, 30)); return claim(); } }).check('synk:a', START);
  assert.deepEqual(result, { claim: null, unavailable: true }); assert.equal(signal.aborted, true);
  await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(result.claim, null);
});
test('verification is an explicit server setting; missing verifier, false required and fictional demo enforcement are rejected', () => {
  for (const options of [{}, { required: false, issuer: ISSUER, verify() {} }, { required: true, issuer: ISSUER },
    { required: true, issuer: ISSUER, verify() {}, timeoutMs: 0 }, { required: true, issuer: ISSUER, verify() {}, timeoutMs: 8001 }])
    assert.throws(() => createDatingAdultVerifier(options), TypeError);
  assert.throws(() => createDatingService({ store: { mode: 'demo', transaction() {} }, mode: 'demo',
    adultVerification: { required: true, issuer: ISSUER, verify: async () => claim() } }), TypeError);
});

async function fixture(t, { enabled = true, serverFactory = false, legacyMeta = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-adult-')), filename = path.join(dir, 'account.sqlite');
  if (legacyMeta) {
    const legacy = new DatabaseSync(filename);
    legacy.exec("CREATE TABLE dating_meta(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,mode TEXT NOT NULL); INSERT INTO dating_meta VALUES(1,1,'account');");
    legacy.close();
  }
  let time = Date.parse(START), store, service, server, origin, verificationEnabled = enabled;
  const claims = new Map(), calls = [], checkImpl = async input => { calls.push(input); const value = claims.get(input.subjectId);
    if (typeof value === 'function') return value(input); if (value instanceof Error) throw value; return value || claim(input.subjectId); };
  const verify = async token => ({ accountId: 'synk:' + token });
  async function start() {
    if (serverFactory) server = createDatingServer({ mode: 'account', databasePath: filename, verify, clock: () => time,
      ...(verificationEnabled ? { adultVerification: { required: true, issuer: ISSUER, verify: checkImpl } } : {}) });
    else { store = createDatingStore({ path: filename, mode: 'account' }); service = createDatingService({ store, mode: 'account', verify, operatorIds: ['synk:c'], clock: () => time,
      ...(verificationEnabled ? { adultVerification: { required: true, issuer: ISSUER, verify: checkImpl } } : {}) });
      server = http.createServer((req, res) => service.handle(req, res)); }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  }
  async function close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service?.close(); }
  await start(); t.after(close);
  async function call(route, token = 'a', body) {
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { httpStatus: response.status, ...await response.json() };
  }
  const get = async (token = 'a') => { const result = await call('/state', token); assert.equal(result.httpStatus, 200, JSON.stringify(result)); return result.view; };
  const envelope = async (token, action) => ({ requestId: randomUUID(), expectedRevision: (await get(token)).revision, action });
  const act = async (token, action) => call('/action', token, await envelope(token, action));
  const ok = async (token, action) => { const result = await act(token, action); assert.equal(result.httpStatus, 200, JSON.stringify(result)); return result; };
  const onboard = async (token = 'a') => { await ok(token, { kind: 'profile', profile: p(token) }); await ok(token, { kind: 'adult', declared: true }); return ok(token, { kind: 'consents', consents }); };
  const ready = async (token = 'a') => { for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' }))
    await ok(token, { kind: 'discovery', action: { kind: 'set', field, value } }); };
  const intro = async (token, pairId, action) => { const pair = (await get(token)).pairs.find(row => row.pairId === pairId);
    return ok(token, { kind: 'introduction', pairId, expectedIntroductionRevision: pair.introduction.revision, action }); };
  const connected = async () => { await onboard('a'); await onboard('b'); await ready('a');
    const sent = await ok('a', { kind: 'connect', targetAccountId: 'synk:b' });
    await intro('b', sent.result.pairId, { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' }); return sent.result.pairId; };
  return { call, get, act, ok, onboard, ready, connected, intro, envelope, claims, calls,
    get store() { return store; }, advance: ms => { time += ms; }, time: () => new Date(time).toISOString(),
    restart: async required => { await close(); if (required !== undefined) verificationEnabled = required; await start(); } };
}
test('the default account path remains declaration-only, does not invoke a provider, and cannot be promoted by client verified fields', async t => {
  const f = await fixture(t, { enabled: false }); await f.onboard(); const view = await f.get();
  assert.equal(view.adult.selfDeclared, true); assert.equal(view.adult.verified, false); assert.equal(view.adult.verification.required, false); assert.equal(f.calls.length, 0);
  assert.equal((await f.act('a', { kind: 'adult', declared: true, verified: true })).httpStatus, 400);
  assert.equal((await f.act('a', { kind: 'adult', declared: true, verification: claim() })).httpStatus, 400);
});
test('an enforced valid server assertion is projected only to its owner and repeated reads do not revise or store raw documents', async t => {
  const f = await fixture(t); await f.onboard('a'); await f.onboard('b'); const before = await f.get(), after = await f.get();
  assert.equal(before.adult.verified, true); assert.equal(after.revision, before.revision); assert.equal(before.adult.verification.status, 'verified');
  assert.equal(before.adultVerification, undefined); assert.equal(before.candidates[0].adult.verification, undefined);
  const stored = f.store.transaction(tx => tx.account('synk:a').document.adultVerification);
  assert.deepEqual(Object.keys(stored.claim).sort(), Object.keys(claim()).sort());
  assert.doesNotMatch(JSON.stringify(before), /local-adult-fixture|issuedAt|dateOfBirth|private-fixture/);
  assert.equal(f.calls.every(input => !Object.hasOwn(input, 'token')), true);
});
test('pending or malformed server evidence blocks new recommendation and disclosure but keeps own profile, criteria and deletion usable', async t => {
  const f = await fixture(t); f.claims.set('synk:a', claim('synk:a', { status: 'pending', validUntil: null }));
  await f.ok('a', { kind: 'profile', profile: p('private-own-name') }); await f.ok('a', { kind: 'adult', declared: true });
  await f.ok('a', { kind: 'consents', consents: { ...consents, profilePublic: false, receiveInvitations: false } }); await f.ready();
  const view = await f.get(); assert.equal(view.profile.nickname, 'private-own-name'); assert.equal(view.adult.verified, false);
  assert.equal(view.adult.verification.status, 'pending'); assert.ok(view.discovery.fields.length); assert.equal(view.discovery.topCandidateId, null);
  assert.equal(view.experience.recommendationToken, null); assert.equal((await f.act('a', { kind: 'consents', consents })).httpStatus, 403);
  f.claims.set('synk:a', { ...claim(), dateOfBirth: 'private-fixture-dob', token: 'private-fixture-token' });
  const failed = await f.get(); assert.equal(failed.adult.verification.status, 'unavailable'); assert.equal(failed.profile.nickname, 'private-own-name');
  assert.doesNotMatch(JSON.stringify(f.store.transaction(tx => tx.account('synk:a').document)), /private-fixture-dob|private-fixture-token/);
  assert.equal((await f.ok('a', { kind: 'delete' })).view.deleted, true);
});
test('expiry closes an accepted pair and preserves own preference, private criteria, outcome settings and history across restart', async t => {
  const f = await fixture(t), pairId = await f.connected(); await f.ok('a', { kind: 'preferences', preferences: { 'wants.contact': 'daily' } });
  await f.ok('a', { kind: 'experience', action: { kind: 'goal', value: 'pace' } });
  const before = f.store.transaction(tx => tx.account('synk:a').document), pair = (await f.get()).pairs.find(row => row.pairId === pairId);
  f.advance(86400000); const expired = await f.get();
  assert.equal(expired.adult.verification.status, 'expired'); assert.equal(expired.adult.verified, false);
  assert.equal(expired.consents.profilePublic, false); assert.equal(expired.consents.storePreferences, true);
  assert.deepEqual(expired.preferences, before.preferences); assert.equal(expired.experience.goal, 'pace'); assert.ok(expired.discovery.fields.length);
  assert.equal(expired.pairs.find(row => row.pairId === pairId).introduction.accepted, false); assert.equal(expired.pairs[0].view, null);
  assert.equal((await f.act('a', { kind: 'connect', targetAccountId: 'synk:b' })).httpStatus, 403);
  assert.equal((await f.act('a', { kind: 'introduction', pairId, expectedIntroductionRevision: pair.introduction.revision,
    action: { kind: 'respond', introductionId: pair.introduction.current.id, value: 'accept' } })).httpStatus, 410);
  await f.restart(); assert.equal((await f.get()).adult.verification.status, 'expired');
  assert.deepEqual(f.store.transaction(tx => tx.account('synk:a').document.discovery), before.discovery);
});
test('revocation is checked during a peer read, hides only unavailable candidates, and never reveals a peer verification reason', async t => {
  const f = await fixture(t), pairId = await f.connected(); f.claims.set('synk:a', claim('synk:a', { status: 'revoked', sequence: 2, validUntil: null }));
  const peer = await f.get('b'); assert.equal(peer.candidates.some(row => row.accountId === 'synk:a'), false);
  assert.equal(peer.pairs.find(row => row.pairId === pairId).view, null); assert.equal(peer.adult.verification.status, 'verified');
  assert.doesNotMatch(JSON.stringify(peer), /revoked|local-adult-fixture|private-own-name/);
  assert.equal((await f.get()).adult.verification.status, 'revoked');
});
test('a recovered verification requires explicit consent and peer reopening; old acceptances and closed pair IDs stay retired', async t => {
  const f = await fixture(t), pairId = await f.connected(); f.claims.set('synk:a', new Error('fixture-verifier-offline')); await f.get('b');
  const held = await f.get(); assert.equal(held.adult.verification.status, 'unavailable'); assert.equal(held.profile.nickname, 'a');
  f.claims.set('synk:a', claim('synk:a', { sequence: 2, validUntil: '2026-10-09T03:00:00.000Z' }));
  const recovered = await f.get(); assert.equal(recovered.adult.verification.status, 'verified'); assert.equal(recovered.adult.verification.canResume, true);
  assert.equal(recovered.consents.profilePublic, false); assert.equal(recovered.pairs[0].introduction.accepted, false);
  await f.ok('a', { kind: 'consents', consents }); assert.equal((await f.get()).adult.verification.resumeRequired, false);
  assert.equal((await f.act('a', { kind: 'connect', targetAccountId: 'synk:b' })).httpStatus, 403);
  await f.intro('a', pairId, { kind: 'reopen' }); const fresh = await f.ok('a', { kind: 'connect', targetAccountId: 'synk:b' });
  assert.notEqual(fresh.result.pairId, pairId); assert.equal(fresh.view.pairs.find(row => row.pairId === fresh.result.pairId).introduction.accepted, false);
  assert.equal(f.store.transaction(tx => tx.pair(pairId).status), 'closed');
});
test('out-of-order claims cannot override a newer revocation, including an older successful call completing after it', async t => {
  const f = await fixture(t); await f.onboard(); let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), wait = new Promise(resolve => { release = resolve; });
  f.claims.set('synk:a', async () => { entered(); await wait; return claim(); });
  const pending = f.call('/state', 'a'); await started;
  // This second observation must be newer; equal subject/time checks now share
  // one unfinished assertion, while later observations always query again.
  f.advance(1000); // Also move past the store's logical mutation clock.
  f.claims.set('synk:a', claim('synk:a', { sequence: 2, status: 'revoked', validUntil: null })); assert.equal((await f.get()).adult.verification.status, 'revoked');
  release(); const late = (await pending).view; assert.equal(late.adult.verification.status, 'revoked'); assert.equal(late.adult.verified, false);
  f.claims.set('synk:a', claim()); await f.restart(); assert.equal((await f.get()).adult.verification.status, 'revoked');
});
test('a same-sequence conflicting claim fails closed and its hold persists despite mutation rejection', async t => {
  const f = await fixture(t); await f.onboard(); const envelope = await f.envelope('a', { kind: 'preferences', preferences: {} });
  f.claims.set('synk:a', claim('synk:a', { validUntil: '2026-10-09T03:00:00.000Z' }));
  const conflict = await f.call('/action', 'a', envelope); assert.equal(conflict.httpStatus, 409); assert.equal(conflict.error.code, 'adult-verification-conflict');
  const current = await f.get(); assert.equal(current.adult.verification.status, 'unavailable'); assert.equal(current.consents.profilePublic, false);
  const stored = f.store.transaction(tx => tx.account('synk:a').document.adultVerification); assert.equal(stored.claim.validUntil, claim().validUntil);
  assert.equal(stored.resumeRequired, true);
  await f.ok('a', { kind: 'consents', consents: { ...consents, profilePublic: false, receiveInvitations: false } });
  assert.equal((await f.ok('a', { kind: 'delete' })).view.deleted, true, 'a broken verification assertion cannot prevent account deletion');
});
test('turning on enforcement cannot convert a declaration-only accepted relationship into a verified accepted one', async t => {
  const f = await fixture(t, { enabled: false }), pairId = await f.connected(); assert.equal((await f.get()).pairs[0].introduction.accepted, true);
  await f.restart(true); const upgraded = await f.get(); assert.equal(upgraded.adult.verified, true); assert.equal(upgraded.adult.verification.resumeRequired, true);
  assert.equal(upgraded.consents.profilePublic, false); assert.equal(upgraded.pairs.find(row => row.pairId === pairId).introduction.accepted, false);
  assert.equal(f.store.transaction(tx => tx.pair(pairId).status), 'closed');
});
test('server factory passes the explicit synthetic verifier through and defaults remain unconfigured', async t => {
  const f = await fixture(t, { serverFactory: true }); await f.onboard(); const view = await f.get();
  assert.equal(view.adult.verification.required, true); assert.equal(view.adult.verified, true); assert.ok(f.calls.length > 0);
  const original = await fixture(t, { enabled: false, serverFactory: true }); await original.onboard();
  assert.equal((await original.get()).adult.verification.required, false); assert.equal(original.calls.length, 0);
});
test('a local suspension cannot be cleared by a recovered adult assertion or consent set while suspended', async t => {
  const f = await fixture(t); await f.connected();
  const report = await f.ok('b', { kind: 'report', targetAccountId: 'synk:a', reason: 'other', details: '가상 신고' });
  const decision = (value, status = 'reviewing') => ({ kind: 'admin-report', reportId: report.result.reportId, status, decision: value, note: '가상 확인' });
  await f.ok('c', decision('suspend-target')); f.claims.set('synk:a', new Error('fixture authority error')); await f.get();
  f.claims.set('synk:a', claim('synk:a', { sequence: 2 })); const recovered = await f.get();
  assert.equal(recovered.status, 'suspended'); assert.equal(recovered.adult.verification.canResume, false);
  await f.ok('a', { kind: 'consents', consents }); assert.equal((await f.get()).adult.verification.resumeRequired, true);
  await f.ok('c', decision('restore-target', 'resolved'));
  assert.equal((await f.get('b')).candidates.some(row => row.accountId === 'synk:a'), false);
  await f.ok('a', { kind: 'consents', consents }); assert.equal((await f.get('b')).candidates.some(row => row.accountId === 'synk:a'), true);
});
test('an assertion that expires while its asynchronous check is in flight cannot authorize a stale new connection', async t => {
  const f = await fixture(t); await f.onboard('a'); await f.onboard('b'); await f.ready();
  const request = await f.envelope('a', { kind: 'connect', targetAccountId: 'synk:b' }); let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), wait = new Promise(resolve => { release = resolve; });
  f.claims.set('synk:a', async () => { entered(); await wait; return claim(); });
  const pending = f.call('/action', 'a', request); await started; f.advance(86400000); release();
  const rejected = await pending; assert.ok([403, 409].includes(rejected.httpStatus), JSON.stringify(rejected));
  const after = await f.get(); assert.equal(after.adult.verification.status, 'expired'); assert.equal(after.candidates.length, 0);
  assert.deepEqual(f.store.transaction(tx => tx.pairs('synk:a')), []);
});
test('a terminal product tombstone cannot regain its document or verified state after a later authoritative success', async t => {
  const f = await fixture(t); await f.onboard(); await f.ok('a', { kind: 'delete' });
  f.claims.set('synk:a', claim('synk:a', { sequence: 100 })); await f.restart(); const tombstone = await f.get();
  assert.equal(tombstone.deleted, true); assert.equal(tombstone.adult, undefined); assert.equal(f.store.transaction(tx => tx.account('synk:a').document), null);
});
test('omitting an enforced database verifier on restart fails closed instead of downgrading to the declaration-only default', async t => {
  const f = await fixture(t), pairId = await f.connected(); await f.restart(false);
  const own = await f.get(); assert.equal(own.adult.verification.required, true); assert.equal(own.adult.verification.status, 'unavailable');
  assert.equal(own.adult.verified, false); assert.equal(own.consents.profilePublic, false); assert.equal(own.profile.nickname, 'a');
  assert.equal(own.pairs.find(row => row.pairId === pairId).introduction.accepted, false);
  assert.equal((await f.act('a', { kind: 'consents', consents })).httpStatus, 403);
  await f.restart(true); const recovered = await f.get(); assert.equal(recovered.adult.verification.status, 'verified');
  assert.equal(recovered.consents.profilePublic, false); assert.equal(recovered.adult.verification.resumeRequired, true);
});
test('once-required policy survives deletion of every account document and blocks declaration-only disclosure by a new account after restart', async t => {
  const f = await fixture(t, { legacyMeta: true }); await f.onboard('a'); await f.onboard('b');
  assert.equal(f.store.transaction(tx => tx.adultRequired()), true, 'legacy three-column metadata is migrated and policy is remembered');
  await f.ok('a', { kind: 'delete' }); await f.ok('b', { kind: 'delete' });
  assert.equal(f.store.transaction(tx => tx.accounts().every(row => row.document === null)), true);
  await f.restart(false); const fresh = await f.get('d');
  assert.equal(fresh.adult.verification.required, true); assert.equal(fresh.adult.verification.status, 'unavailable');
  await f.ok('d', { kind: 'profile', profile: p('new-private-account') }); await f.ok('d', { kind: 'adult', declared: true });
  assert.equal((await f.act('d', { kind: 'consents', consents })).httpStatus, 403);
  assert.equal((await f.get('d')).consents.profilePublic, false);
});
test('same-sequence equivocation remains fenced across restart and only a higher trusted claim can permit explicit resume', async t => {
  const f = await fixture(t); await f.onboard();
  f.claims.set('synk:a', claim('synk:a', { validUntil: '2026-10-09T03:00:00.000Z' }));
  assert.equal((await f.get()).adult.verification.status, 'unavailable');
  f.claims.set('synk:a', claim()); await f.restart(true);
  const fenced = await f.get(); assert.equal(fenced.adult.verification.status, 'unavailable'); assert.equal(fenced.adult.verified, false);
  assert.equal((await f.act('a', { kind: 'consents', consents })).httpStatus, 403);
  assert.equal(f.store.transaction(tx => tx.account('synk:a').document.adultVerification.conflictedSequence), 1);
  f.claims.set('synk:a', claim('synk:a', { sequence: 2 }));
  const resolved = await f.get(); assert.equal(resolved.adult.verification.status, 'verified'); assert.equal(resolved.consents.profilePublic, false);
  assert.equal(resolved.adult.verification.resumeRequired, true);
  await f.ok('a', { kind: 'consents', consents }); assert.equal((await f.get()).consents.profilePublic, true);
  assert.equal(f.store.transaction(tx => tx.account('synk:a').document.adultVerification.conflictedSequence), null);
});
