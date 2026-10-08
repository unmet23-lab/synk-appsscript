import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';

const START = '2026-10-10T03:00:00.000Z', END = '2026-10-10T03:01:00.000Z', FUTURE = '2026-10-11T03:00:00.000Z';
const ids = Array.from({ length: 8 }, (_, index) => `controls:${index}`);
const consents = patch => ({ profilePublic: true, receiveInvitations: true, storePreferences: true, ...patch });
const answer = (field, value, required = false, until = null) => ({ kind: 'public-answer', field, value, required, until });
const save = index => ({ kind: 'bookmark-save', targetAccountId: ids[index] });
const remove = bookmarkId => ({ kind: 'bookmark-remove', bookmarkId });
async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-controls-'));
  const filename = path.join(dir, 'account.sqlite'); let time = Date.parse(START), server, service, store, origin;
  async function start() {
    store = createDatingStore({ path: filename, mode: 'account' });
    service = createDatingService({ store, mode: 'account', verify: async accountId => ids.includes(accountId) ? { accountId } : null,
      clock: () => new Date(time), ...options });
    server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); }
  await start();
  t.after(async () => { await stop(); assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-dating-controls-')); await fs.rm(dir, { recursive: true, force: true }); });
  async function call(route, index, json) {
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: json ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${ids[index]}`, ...(json ? { Origin: origin, 'Content-Type': 'application/json' } : {}) },
      ...(json ? { body: JSON.stringify(json) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const state = async index => { const r = await call('/state', index); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.view; };
  const act = async (index, action, extra = {}) => call('/action', index, { requestId: randomUUID(), expectedRevision: (await state(index)).revision, action, ...extra });
  const ok = async (index, action, extra) => { const r = await act(index, action, extra); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  async function seed(index, { values = {}, required = [], expirations, discover = index === 0 } = {}) {
    await ok(index, { kind: 'profile', profile: { nickname: `합성 ${index}`, region: '합성 지역', intro: '직접 고른 소개', values: { availability: 'weekend', ...values }, required, ...(expirations ? { expirations } : {}) } });
    await ok(index, { kind: 'adult', declared: true }); await ok(index, { kind: 'consents', consents: consents() });
    if (discover) for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' })) await ok(index, { kind: 'discovery', action: { kind: 'set', field, value } });
  }
  const raw = index => store.transaction(tx => tx.account(ids[index]));
  const patch = (index, documentPatch, status) => store.transaction(tx => { const row = tx.account(ids[index]); return tx.updateAccount(row, { ...row.document, ...documentPatch }, status || row.status); });
  const databaseSnapshot = () => store.transaction(tx => ({ exposures: tx.exposureCounts(), introductions: tx.introductions(ids[0]), pairs: tx.pairs(ids[0]) }));
  return { call, state, act, ok, seed, raw, patch, databaseSnapshot, restart: async () => { await stop(); await start(); }, advance: ms => { time += ms; } };
}
const personal = document => ({ preferences: document.preferences, discovery: document.discovery, discoveryEpoch: document.discoveryEpoch,
  experience: document.experience, consents: document.consents, adult: document.adult, paused: document.paused, blocks: document.blocks });
const rank = view => ({ top: view.discovery?.topCandidateId, candidates: view.discovery?.candidates.map(({ id, status, score }) => ({ id, status, score })), priorities: view.discovery?.priorities });

test('HTTP public answer patches one field while preserving every other public and private declaration', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'self.contact': 'daily', 'wants.plan': 'planned', 'self.purpose': 'gradual' }, required: ['wants.plan'], expirations: { 'wants.plan': END } });
  await f.ok(0, { kind: 'discovery', action: { kind: 'set', field: 'self.contact', value: 'flexible' } });
  const before = f.raw(0).document; f.advance(60000);
  const r = await f.ok(0, answer('self.contact', 'few-days', false, FUTURE)); const after = f.raw(0).document;
  assert.deepEqual(personal(after), personal(before));
  assert.deepEqual(after.profile, { ...before.profile, values: { ...before.profile.values, 'self.contact': 'few-days' }, expirations: { ...before.profile.expirations, 'self.contact': FUTURE } });
  assert.deepEqual(r.view.publicAnswers.expiredFields, ['wants.plan']); assert.deepEqual(r.result, { field: 'self.contact', withdrawn: false });
});

test('HTTP one-field withdrawal removes only its value, required flag and deadline even with storage off and paused', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'wants.contact': 'daily', 'self.plan': 'planned' }, required: ['wants.contact'], expirations: { 'wants.contact': END } });
  await f.ok(0, { kind: 'consents', consents: consents({ storePreferences: false, profilePublic: false, receiveInvitations: false }) }); await f.ok(0, { kind: 'pause', paused: true });
  const before = f.raw(0).document;
  const r = await f.ok(0, answer('wants.contact', null));
  assert.equal(r.view.discovery, null); assert.deepEqual(personal(f.raw(0).document), personal(before));
  assert.deepEqual(r.view.profile.values, { availability: 'weekend', 'self.plan': 'planned' }); assert.deepEqual(r.view.profile.required, []); assert.deepEqual(r.view.profile.expirations, {});
  await f.ok(0, answer('self.contact', 'daily')); assert.equal((await f.state(0)).consents.storePreferences, false); assert.equal((await f.state(0)).paused, true);
});

test('HTTP explicit past deadline is preserved only for its unchanged saved answer and fresh null reconfirms a changed answer', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'wants.contact': 'daily' }, required: ['wants.contact'], expirations: { 'wants.contact': END } }); f.advance(60000);
  await f.ok(0, answer('wants.contact', 'daily', true, END));
  const before = f.raw(0); assert.equal((await f.act(0, answer('wants.contact', 'few-days', true, END))).status, 400); assert.deepEqual(f.raw(0), before);
  await f.ok(0, answer('wants.contact', 'few-days', true)); const view = await f.state(0);
  assert.equal(view.publicAnswers.values['wants.contact'], 'few-days'); assert.deepEqual(view.profile.required, ['wants.contact']); assert.deepEqual(view.publicAnswers.expiredFields, []);
});

test('HTTP public-answer rejects unknown keys, hidden consent, malformed values, invalid requirements and implicit deadlines', async t => {
  const f = await fixture(t); await f.seed(0); const valid = answer('self.contact', 'daily');
  const invalid = [{ ...valid, nickname: 'override' }, { ...valid, field: 'consent', value: true }, { ...valid, field: 'unknown' },
    { ...valid, required: true }, { ...valid, value: 'unknown' }, { ...valid, until: '2026-10-11T03:00:00Z' }, { ...valid, until: START },
    { ...valid, value: null, until: FUTURE }, answer('wants.contact', null, true), { ...valid, required: 1 },
    answer('self.meetingRegions', ['bad-region']), Object.fromEntries(Object.entries(valid).filter(([key]) => key !== 'until'))];
  const before = f.raw(0); for (const action of invalid) assert.equal((await f.act(0, action)).status, 400, JSON.stringify(action)); assert.deepEqual(f.raw(0), before);
});

test('HTTP public-answer preserves or withdraws a stored legacy value but cannot introduce or replace one', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'self.purpose': 'gradual' } });
  await f.ok(0, answer('self.purpose', 'gradual')); assert.equal((await f.act(0, answer('self.purpose', 'committed'))).status, 400);
  assert.equal((await f.act(0, answer('wants.purpose', 'any'))).status, 400); await f.ok(0, answer('self.purpose', null));
  assert.equal((await f.act(0, answer('self.purpose', 'gradual'))).status, 400);
});

test('HTTP field patches require current revisions and replay the same receipt without overriding a second field', async t => {
  const f = await fixture(t); await f.seed(0); const before = await f.state(0), requestId = randomUUID();
  const envelope = { requestId, expectedRevision: before.revision, action: answer('self.contact', 'daily') };
  assert.equal((await f.call('/action', 0, envelope)).status, 200); const saved = f.raw(0);
  const replay = await f.call('/action', 0, envelope); assert.equal(replay.body.replayed, true); assert.deepEqual(f.raw(0), saved);
  assert.equal((await f.call('/action', 0, { ...envelope, action: answer('self.plan', 'planned') })).status, 409);
  assert.equal((await f.act(0, answer('self.plan', 'planned'), { expectedRevision: before.revision })).status, 409);
  await f.ok(0, answer('self.plan', 'planned')); assert.equal((await f.state(0)).profile.values['self.contact'], 'daily');
  assert.equal((await f.call(`/receipt?requestId=${requestId}`, 1)).body.status, 'not-found');
});

test('HTTP saved candidates persist privately without changing recommendation rank, declarations, exposure or introductions', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); await f.seed(2);
  const before = await f.state(0), privateBefore = personal(f.raw(0).document), databaseBefore = f.databaseSnapshot();
  const r = await f.ok(0, save(1)); assert.equal(r.view.savedCandidates.items.length, 1); assert.equal(r.view.savedCandidates.items[0].candidateId, ids[1]);
  assert.equal(r.view.savedCandidates.items[0].id, r.result.bookmarkId); assert.equal(r.view.savedCandidates.limit, 5); assert.equal(r.view.savedCandidates.canAdd, true);
  assert.deepEqual(personal(f.raw(0).document), privateBefore); assert.deepEqual(rank(r.view), rank(before)); assert.deepEqual(f.databaseSnapshot(), databaseBefore);
  assert.equal(r.view.bookmarks, undefined); assert.deepEqual(Object.keys(r.view.savedCandidates.items[0]).sort(), ['candidateId', 'id', 'savedAt']);
  assert.deepEqual((await f.state(1)).savedCandidates.items, []); assert.equal(JSON.stringify(await f.state(1)).includes(r.result.bookmarkId), false);
  await f.restart(); assert.deepEqual((await f.state(0)).savedCandidates, r.view.savedCandidates);
});

test('HTTP bookmark retries and duplicate saves preserve a single opaque bookmark and the original saved date', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); const before = await f.state(0), requestId = randomUUID();
  const envelope = { requestId, expectedRevision: before.revision, action: save(1) }; const first = await f.call('/action', 0, envelope); assert.equal(first.status, 200);
  const original = first.body.view.savedCandidates.items[0]; f.advance(20000); await f.restart();
  const replay = await f.call('/action', 0, envelope); assert.equal(replay.body.replayed, true); assert.deepEqual(replay.body.result, first.body.result);
  const duplicate = await f.ok(0, save(1)); assert.equal(duplicate.result.alreadySaved, true); assert.deepEqual(duplicate.view.savedCandidates.items, [original]);
  assert.equal((await f.call(`/receipt?requestId=${requestId}`, 1)).body.status, 'not-found');
});

test('HTTP bookmarks cap at five, never evict a saved person, and free capacity only after explicit removal', async t => {
  const f = await fixture(t); await f.seed(0); for (let index = 1; index < 7; index++) await f.seed(index);
  for (let index = 1; index < 6; index++) await f.ok(0, save(index)); const before = await f.state(0);
  assert.equal(before.savedCandidates.canAdd, false); assert.equal((await f.act(0, save(6))).body.error.code, 'bookmark-limit');
  assert.deepEqual((await f.state(0)).savedCandidates, before.savedCandidates); assert.equal((await f.ok(0, save(1))).result.alreadySaved, true);
  await f.ok(0, remove(before.savedCandidates.items[2].id)); const after = await f.ok(0, save(6)); assert.equal(after.view.savedCandidates.items.length, 5);
  assert.equal(after.view.savedCandidates.items.some(item => item.id === before.savedCandidates.items[2].id), false);
});

test('HTTP current eligibility and both accounts disclosure are required before saving', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); await f.ok(0, { kind: 'discovery', action: { kind: 'set', field: 'wants.contact', value: 'daily', required: true } });
  assert.equal((await f.act(0, save(1))).body.error.code, 'candidate-unavailable'); await f.ok(1, answer('self.contact', 'daily'));
  await f.ok(1, { kind: 'consents', consents: consents({ profilePublic: false }) }); assert.equal((await f.act(0, save(1))).status, 403);
  await f.ok(1, { kind: 'consents', consents: consents() }); await f.ok(0, { kind: 'pause', paused: true }); assert.equal((await f.act(0, save(1))).status, 403);
  await f.ok(0, { kind: 'pause', paused: false }); await f.ok(0, { kind: 'consents', consents: consents({ storePreferences: false }) }); assert.equal((await f.act(0, save(1))).status, 403);
  assert.deepEqual((await f.state(0)).savedCandidates.items, []);
});

test('HTTP hidden and no-longer-matching bookmarks become opaque and removable without leaking past profile values', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1, { values: { 'self.contact': 'daily' } }); const saved = await f.ok(0, save(1)), bookmarkId = saved.result.bookmarkId;
  await f.ok(0, { kind: 'discovery', action: { kind: 'hide-candidate', candidateId: ids[1], days: 7 } });
  assert.deepEqual((await f.state(0)).savedCandidates.items, [{ ...saved.view.savedCandidates.items[0], candidateId: null }]); assert.equal((await f.act(0, save(1))).status, 403);
  await f.ok(0, { kind: 'discovery', action: { kind: 'unhide-candidate', candidateId: ids[1] } }); assert.equal((await f.state(0)).savedCandidates.items[0].candidateId, ids[1]);
  await f.ok(0, { kind: 'discovery', action: { kind: 'set', field: 'wants.contact', value: 'few-days', required: true } });
  assert.equal((await f.state(0)).savedCandidates.items[0].candidateId, null); await f.ok(0, remove(bookmarkId)); assert.deepEqual((await f.state(0)).savedCandidates.items, []);
});

test('HTTP peer privacy, pause, suspension and blocks remove all saved-profile projection while owner can still remove it', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); const saved = await f.ok(0, save(1)), bookmarkId = saved.result.bookmarkId;
  async function unavailable() { const v = await f.state(0); assert.equal(v.savedCandidates.items[0].candidateId, null); assert.equal(v.candidates.some(c => c.accountId === ids[1]), false); assert.equal(JSON.stringify(v.savedCandidates).includes('합성 1'), false); }
  await f.ok(1, { kind: 'consents', consents: consents({ profilePublic: false }) }); await unavailable();
  await f.ok(1, { kind: 'consents', consents: consents() }); await f.ok(1, { kind: 'pause', paused: true }); await unavailable();
  await f.ok(1, { kind: 'pause', paused: false }); f.patch(1, {}, 'suspended'); await unavailable(); f.patch(1, {}, 'active');
  await f.ok(1, { kind: 'block', targetAccountId: ids[0] }); await unavailable(); await f.ok(0, { kind: 'pause', paused: true });
  const before = personal(f.raw(0).document); await f.ok(0, remove(bookmarkId)); assert.deepEqual(personal(f.raw(0).document), before);
});

test('HTTP removing a bookmark only addresses the signed-in owners opaque ID, including while suspended', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1, { discover: true }); await f.seed(2);
  const a = await f.ok(0, save(2)), b = await f.ok(1, save(2));
  assert.equal((await f.act(1, remove(a.result.bookmarkId))).status, 404); assert.equal((await f.act(0, { ...remove(a.result.bookmarkId), targetAccountId: ids[2] })).status, 400);
  f.patch(0, {}, 'suspended'); const r = await f.ok(0, remove(a.result.bookmarkId)); assert.deepEqual(r.view.savedCandidates.items, []); assert.equal(r.view.savedCandidates.canAdd, false);
  assert.equal((await f.state(1)).savedCandidates.items[0].id, b.result.bookmarkId); assert.equal((await f.act(0, save(2))).status, 403);
});

test('HTTP simultaneous bookmark changes use account CAS and a lost remove response is replayable', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); await f.seed(2); const v = await f.state(0);
  const results = await Promise.all([1, 2].map(index => f.call('/action', 0, { requestId: randomUUID(), expectedRevision: v.revision, action: save(index) })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); const current = await f.state(0), bookmarkId = current.savedCandidates.items[0].id;
  const envelope = { requestId: randomUUID(), expectedRevision: current.revision, action: remove(bookmarkId) }; assert.equal((await f.call('/action', 0, envelope)).status, 200);
  await f.restart(); const replay = await f.call('/action', 0, envelope); assert.equal(replay.body.replayed, true); assert.equal(replay.body.result.removed, true); assert.deepEqual(replay.body.view.savedCandidates.items, []);
});

test('HTTP private storage withdrawal erases bookmarks and reenabling cannot restore them', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); await f.ok(0, save(1));
  await f.ok(0, { kind: 'consents', consents: consents({ storePreferences: false }) }); assert.equal(f.raw(0).document.bookmarks, undefined);
  await f.restart(); await f.ok(0, { kind: 'consents', consents: consents() }); assert.deepEqual((await f.state(0)).savedCandidates.items, []);
});

test('HTTP target account deletion removes private bookmark references and CAS protects surviving owners', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); await f.seed(2, { discover: true }); await f.ok(0, save(1)); await f.ok(2, save(1)); const before = await f.state(0);
  await f.ok(1, { kind: 'delete' }); assert.deepEqual(f.raw(0).document.bookmarks, []); assert.deepEqual(f.raw(2).document.bookmarks, []);
  assert.deepEqual((await f.state(0)).savedCandidates.items, []); assert.ok((await f.state(0)).revision > before.revision);
  assert.equal((await f.act(0, answer('self.contact', 'daily'), { expectedRevision: before.revision })).status, 409);
  await f.ok(0, save(2)); await f.ok(0, { kind: 'delete' }); assert.equal(f.raw(0).document, null); await f.restart(); assert.equal((await f.state(0)).deleted, true);
});

test('HTTP old documents without bookmarks project an empty collection and forged bookmark shapes are rejected', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1); assert.equal(f.raw(0).document.bookmarks, undefined); assert.deepEqual((await f.state(0)).savedCandidates.items, []);
  for (const action of [{ ...save(1), savedAt: START }, { ...save(1), id: randomUUID() }, { kind: 'bookmark-save' }, save(0),
    { kind: 'bookmark-save', targetAccountId: '__proto__' }, remove(ids[1]), { ...remove(randomUUID()), candidateId: ids[1] }]) assert.equal((await f.act(0, action)).status, 400);
  assert.equal((await f.act(0, { kind: 'bookmark-save', targetAccountId: 'controls:nonexistent' })).status, 403);
  assert.deepEqual((await f.state(0)).savedCandidates.items, []);
});

test('HTTP enforced adult revocation prevents adding or revealing a saved candidate without removing owner deletion control', async t => {
  const statuses = new Map();
  const adultVerification = { required: true, issuer: 'controls-adult', verify: async ({ subjectId }) => ({ version: 1, subjectId, issuer: 'controls-adult',
    status: statuses.get(subjectId)?.status || 'verified', sequence: statuses.get(subjectId)?.sequence || 1, issuedAt: START,
    validUntil: statuses.get(subjectId)?.status === 'revoked' ? null : FUTURE }) };
  const f = await fixture(t, { adultVerification }); await f.seed(0); await f.seed(1); const saved = await f.ok(0, save(1));
  statuses.set(ids[1], { status: 'revoked', sequence: 2 }); assert.equal((await f.state(0)).savedCandidates.items[0].candidateId, null); assert.equal((await f.act(0, save(1))).status, 403);
  statuses.set(ids[0], { status: 'revoked', sequence: 2 }); assert.equal((await f.act(0, save(1))).status, 403); await f.ok(0, remove(saved.result.bookmarkId)); assert.deepEqual((await f.state(0)).savedCandidates.items, []);
});
