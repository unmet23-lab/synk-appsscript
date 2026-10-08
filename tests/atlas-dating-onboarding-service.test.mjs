import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';

const START = '2026-10-08T03:00:00.000Z', FUTURE = '2026-10-09T03:00:00.000Z';
const ids = ['onboarding:a', 'onboarding:b'], ISSUER = 'local-onboarding-fixture';
const off = { profilePublic: false, receiveInvitations: false, storePreferences: false };
const on = { profilePublic: true, receiveInvitations: true, storePreferences: true };
const profile = patch => ({ nickname: '첫 소개', region: '가상 지역', intro: '직접 작성한 소개예요.', ...patch });
const onboard = patch => ({ kind: 'onboard', profile: profile(), declared: true, consents: { ...off }, ...patch });
const progress = (profile, adult, consents) => ({ complete: profile && adult && consents, steps: { profile, adult, consents },
  missing: [!profile && 'nickname', !adult && 'adult-self-declaration', !consents && 'consents'].filter(Boolean) });
async function fixture(t, { enforced = false, verified = true } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-onboarding-')), filename = path.join(directory, 'account.sqlite');
  let server, store, service, origin, verification = verified;
  async function start() {
    store = createDatingStore({ path: filename, mode: 'account' });
    service = createDatingService({ store, mode: 'account', clock: () => START,
      verify: async token => ids.includes(token) ? { accountId: token } : null,
      ...(enforced ? { adultVerification: { required: true, issuer: ISSUER, verify: async ({ subjectId }) => ({
        version: 1, subjectId, issuer: ISSUER, sequence: 1, status: verification ? 'verified' : 'pending', issuedAt: START,
        validUntil: verification ? FUTURE : null }) } } : {}) });
    server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); }
  await start();
  t.after(async () => { await stop(); assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('synk-onboarding-')); await fs.rm(directory, { recursive: true, force: true }); });
  async function call(route, index = 0, json) {
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: json ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${ids[index]}`, ...(json ? { Origin: origin, 'Content-Type': 'application/json' } : {}) },
      ...(json ? { body: JSON.stringify(json) } : {}) });
    return { status: response.status, ...await response.json() };
  }
  const state = async (index = 0) => { const result = await call('/state', index); assert.equal(result.status, 200, JSON.stringify(result)); return result.view; };
  const act = async (action, index = 0, extra = {}) => call('/action', index, { requestId: randomUUID(), expectedRevision: (await state(index)).revision, action, ...extra });
  const ok = async (action, index = 0) => { const result = await act(action, index); assert.equal(result.status, 200, JSON.stringify(result)); return result; };
  const raw = (index = 0) => store.transaction(tx => tx.account(ids[index]));
  const patch = (callback, index = 0, status) => store.transaction(tx => { const row = tx.account(ids[index]); return tx.updateAccount(row, callback(row.document), status || row.status); });
  return { call, state, act, ok, raw, patch, restart: async () => { await stop(); await start(); },
    central: (status, resume = false) => store.transaction(tx => tx.putCentralAvailability(ids[0], 1, status, resume, START)) };
}

test('HTTP fresh setup distinguishes untouched false defaults from explicitly saved all-false choices across restart', async t => {
  const f = await fixture(t), initial = await f.state();
  assert.deepEqual(initial.onboarding, progress(false, false, false)); assert.deepEqual(initial.consents, off);
  assert.equal(initial.onboardingState, undefined);
  const result = await f.ok(onboard()); assert.equal(result.view.revision, initial.revision + 1);
  assert.deepEqual(result.view.onboarding, progress(true, true, true)); assert.deepEqual(result.view.consents, off);
  assert.equal(result.view.candidates.length, 0); assert.equal(result.view.discovery, null); assert.equal(result.view.adult.verified, false);
  await f.restart(); assert.deepEqual((await f.state()).onboarding, progress(true, true, true));
});

test('HTTP sequential legacy-style first setup exposes exactly the remaining saved steps after reload', async t => {
  const f = await fixture(t); await f.ok({ kind: 'profile', profile: profile() });
  assert.deepEqual((await f.state()).onboarding, progress(true, false, false));
  await f.ok({ kind: 'adult', declared: true }); await f.restart();
  assert.deepEqual((await f.state()).onboarding, progress(true, true, false));
  await f.ok({ kind: 'consents', consents: off }); assert.deepEqual((await f.state()).onboarding, progress(true, true, true));
});

test('HTTP choosing all-false permissions before profile and declaration still counts as an explicit saved choice', async t => {
  const f = await fixture(t); await f.ok({ kind: 'consents', consents: off });
  assert.deepEqual((await f.state()).onboarding, progress(false, false, true));
  await f.ok({ kind: 'profile', profile: profile() }); await f.ok({ kind: 'adult', declared: true });
  assert.deepEqual((await f.state()).onboarding, progress(true, true, true));
});

test('HTTP atomic setup preserves declared public values, requirements and deadlines when resuming a saved profile', async t => {
  const f = await fixture(t), published = { ...profile(), values: { 'self.contact': 'daily', 'wants.plan': 'planned' }, required: ['wants.plan'], expirations: { 'wants.plan': FUTURE } };
  await f.ok({ kind: 'profile', profile: published }); const before = f.raw();
  const result = await f.ok(onboard({ profile: profile({ nickname: '  이어서 저장  ', region: ' 가상 지역 ', intro: ' 새 소개 ' }), consents: on }));
  assert.equal(result.view.revision, before.revision + 1);
  assert.deepEqual(result.view.profile, { ...published, nickname: '이어서 저장', region: '가상 지역', intro: '새 소개' });
  assert.deepEqual(result.view.onboarding, progress(true, true, true));
});

test('HTTP completing a partial setup keeps private criteria and discovery when storage remains explicitly enabled', async t => {
  const f = await fixture(t); await f.ok({ kind: 'adult', declared: true });
  await f.ok({ kind: 'consents', consents: { ...off, storePreferences: true } });
  await f.ok({ kind: 'preferences', preferences: { 'wants.contact': 'few-days' } });
  await f.ok({ kind: 'discovery', action: { kind: 'set', field: 'consent', value: true } });
  await f.ok({ kind: 'discovery', action: { kind: 'set', field: 'availability', value: 'weekend' } });
  const before = f.raw().document;
  await f.ok(onboard({ consents: { ...off, storePreferences: true } })); const after = f.raw().document;
  for (const key of ['preferences', 'discovery', 'discoveryEpoch', 'experience']) assert.deepEqual(after[key], before[key], key);
});

test('HTTP malformed final consent rejects the whole setup without profile, adult, revision or receipt changes', async t => {
  const f = await fixture(t); await f.state(); const before = f.raw(), requestId = randomUUID();
  const failed = await f.act(onboard({ consents: { profilePublic: true, receiveInvitations: true } }), 0, { requestId });
  assert.equal(failed.status, 400); assert.deepEqual(f.raw(), before);
  assert.equal((await f.call(`/receipt?requestId=${requestId}`)).status, 'not-found');
  assert.deepEqual((await f.state()).onboarding, progress(false, false, false));
});

test('HTTP setup validates the same profile limits and rejects optional-field smuggling and undeclared adults atomically', async t => {
  const f = await fixture(t); await f.state(); const before = f.raw();
  const invalid = [onboard({ declared: false }), onboard({ declared: 'true' }), onboard({ profile: profile({ nickname: ' ' }) }),
    onboard({ profile: profile({ nickname: 'a'.repeat(61) }) }), onboard({ profile: profile({ region: 'a'.repeat(81) }) }),
    onboard({ profile: profile({ intro: 'a'.repeat(401) }) }), onboard({ profile: profile({ intro: 'bad\u0001input' }) }),
    onboard({ profile: profile({ values: { 'self.contact': 'daily' } }) }), onboard({ profile: profile({ required: [] }) }),
    onboard({ profile: profile({ expirations: {} }) }), onboard({ accountId: ids[1] }), onboard({ verified: true }),
    onboard({ consents: { ...off, storePreferences: 1 } }), onboard({ consents: { ...off, automatic: true } }),
    { kind: 'onboard', profile: profile(), declared: true }];
  for (const action of invalid) { assert.equal((await f.act(action)).status, 400, JSON.stringify(action)); assert.deepEqual(f.raw(), before); }
});

test('HTTP pending server adult evidence rejects public setup atomically but allows an explicit private completion', async t => {
  const f = await fixture(t, { enforced: true, verified: false }); await f.state(); const before = f.raw();
  const rejected = await f.act(onboard({ consents: on })); assert.equal(rejected.status, 403); assert.equal(rejected.error.code, 'adult-verification-required');
  assert.deepEqual(f.raw(), before);
  const completed = await f.ok(onboard()); assert.deepEqual(completed.view.onboarding, progress(true, true, true));
  assert.equal(completed.view.adult.verified, false); assert.equal(completed.view.adult.verification.status, 'pending'); assert.deepEqual(completed.view.consents, off);
});

test('HTTP verified setup retains the server assertion and only publishes the explicitly selected permissions', async t => {
  const f = await fixture(t, { enforced: true }); await f.state(); const before = f.raw().document.adultVerification;
  const selected = { ...off, profilePublic: true }, completed = await f.ok(onboard({ consents: selected }));
  assert.equal(completed.view.adult.verified, true); assert.deepEqual(completed.view.consents, selected);
  assert.deepEqual(f.raw().document.adultVerification.claim, before.claim); assert.deepEqual(completed.view.onboarding, progress(true, true, true));
});

test('HTTP lost successful setup is recovered through the same receipt after restart without a second write', async t => {
  const f = await fixture(t), before = await f.state(), envelope = { requestId: randomUUID(), expectedRevision: before.revision, action: onboard({ consents: on }) };
  const first = await f.call('/action', 0, envelope); assert.equal(first.status, 200); const saved = f.raw(); await f.restart();
  const receipt = await f.call(`/receipt?requestId=${envelope.requestId}`); assert.equal(receipt.status, 'applied'); assert.equal(receipt.appliedRevision, saved.revision);
  const replay = await f.call('/action', 0, envelope); assert.equal(replay.status, 200); assert.equal(replay.replayed, true); assert.deepEqual(f.raw(), saved);
  assert.deepEqual(replay.view.onboarding, progress(true, true, true));
  const conflict = await f.call('/action', 0, { ...envelope, action: onboard({ profile: profile({ intro: '다른 초안' }) }) });
  assert.equal(conflict.status, 409); assert.equal(conflict.error.code, 'idempotency-conflict'); assert.deepEqual(f.raw(), saved);
});

test('HTTP concurrent first setup cannot mix profile or permission choices from different revisions', async t => {
  const f = await fixture(t), before = await f.state();
  const actions = [onboard({ profile: profile({ nickname: '선택 A' }), consents: off }), onboard({ profile: profile({ nickname: '선택 B' }), consents: on })];
  const responses = await Promise.all(actions.map(action => f.call('/action', 0, { requestId: randomUUID(), expectedRevision: before.revision, action })));
  assert.deepEqual(responses.map(result => result.status).sort(), [200, 409]);
  const winner = responses.findIndex(result => result.status === 200), current = await f.state();
  assert.equal(current.profile.nickname, actions[winner].profile.nickname); assert.deepEqual(current.consents, actions[winner].consents);
  assert.equal(current.revision, before.revision + 1); assert.deepEqual(current.onboarding, progress(true, true, true));
});

test('HTTP setup and its receipt stay bound to the authenticated account', async t => {
  const f = await fixture(t), a = await f.state(0), b = await f.state(1), requestId = randomUUID();
  await f.call('/action', 0, { requestId, expectedRevision: a.revision, action: onboard() });
  assert.deepEqual((await f.state(1)).onboarding, progress(false, false, false)); assert.equal((await f.state(1)).revision, b.revision);
  assert.equal((await f.call(`/receipt?requestId=${requestId}`, 1)).status, 'not-found');
  const before = f.raw(1); assert.equal((await f.act(onboard({ accountId: ids[0] }), 1)).status, 400); assert.deepEqual(f.raw(1), before);
});

test('HTTP setup respects suspended, deleted and centrally unavailable account gates', async t => {
  const f = await fixture(t); await f.state(); f.patch(document => document, 0, 'suspended'); let before = f.raw();
  assert.equal((await f.act(onboard())).error.code, 'account-suspended'); assert.deepEqual(f.raw(), before);
  f.patch(document => document, 0, 'active'); f.central('disabled'); before = f.raw();
  assert.equal((await f.act(onboard())).error.code, 'account-unavailable'); assert.deepEqual(f.raw(), before);
  f.central('active', true); const completed = await f.ok(onboard()); assert.equal(completed.view.centralAvailability.resumeRequired, true);
  await f.ok({ kind: 'delete' }); const deleted = await f.call('/action', 0, { requestId: randomUUID(), expectedRevision: 0, action: onboard() });
  assert.equal(deleted.status, 410); assert.equal(deleted.error.code, 'account-deleted'); assert.equal(f.raw().document, null);
});

test('HTTP legacy completed accounts without confirmation metadata remain compatible and acquire explicit tracking on save', async t => {
  const f = await fixture(t); await f.ok(onboard()); f.patch(document => { delete document.onboardingState; return document; });
  await f.restart(); assert.deepEqual((await f.state()).onboarding, progress(true, true, true));
  await f.ok({ kind: 'consents', consents: off }); assert.deepEqual(f.raw().document.onboardingState, { consentsConfirmed: true });
  await f.ok({ kind: 'adult', declared: false }); assert.deepEqual((await f.state()).onboarding, progress(true, false, true));
});

test('HTTP legacy blank and profile-only documents gain explicit incomplete tracking before individual steps advance', async t => {
  const f = await fixture(t);
  for (const index of [0, 1]) {
    await f.state(index);
    if (index === 1) await f.ok({ kind: 'profile', profile: profile() }, index);
    f.patch(document => { delete document.onboardingState; return document; }, index);
    if (index === 0) await f.ok({ kind: 'profile', profile: profile() }, index);
    await f.ok({ kind: 'adult', declared: true }, index);
    assert.deepEqual((await f.state(index)).onboarding, progress(true, true, false));
    assert.deepEqual(f.raw(index).document.onboardingState, { consentsConfirmed: false });
    await f.ok({ kind: 'consents', consents: off }, index);
    assert.deepEqual((await f.state(index)).onboarding, progress(true, true, true));
  }
});
