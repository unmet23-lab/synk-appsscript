import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getIntroductionGuidance } from '../experiences/atlas-lab/introduction-guidance.mjs';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const base = extra => ({ canConnect: false, ownReceiveInvitations: true, ...extra });
const blocks = fields => base({ ownExpiredPublicFields: fields });
const noRead = object => Object.defineProperty(object, 'private', { get() { throw new Error('private information was read'); }, enumerable: true });
const navigation = field => ({ kind: 'navigate', page: 'profile', target: 'disclosure', field, label: '공개 답과 기한 다시 확인' });

for (const field of ['availability', 'wants.contact', 'self.meetingRegions']) test(`own public expiry ${field} opens only that disclosed field and deadline`, () => {
  const input = noRead(blocks([field])), result = getIntroductionGuidance(input);
  assert.equal(result.id, 'own-public-answer-expired'); assert.deepEqual(result.action, navigation(field));
  assert.match(result.body, /내가 공개한/); assert.match(result.body, /기한이 지났/); assert.match(result.body, /추천용 답을 바꾸지 않/);
  assert.deepEqual(Object.keys(result).sort(), ['action', 'body', 'id', 'title']); assert.deepEqual(input.ownExpiredPublicFields, [field]);
});

test('multiple owner expired blockers use stable schedule, required-wants, area order and only authored field labels', () => {
  const result = getIntroductionGuidance(blocks(['self.meetingRegions', 'wants.relationshipSpeed', 'availability', 'wants.contact']));
  assert.deepEqual(result.action, navigation('availability'));
  for (const label of ['가능한 일정', '상대에게 바라는 알아가는 속도', '상대에게 바라는 연락 빈도', '실제로 만날 수 있는 지역']) assert.ok(result.body.includes(label));
  assert.doesNotMatch(JSON.stringify(result), /peer|account|event-|2026-/);
});

test('malformed, unknown, duplicate, self-answer and accessor expiry lists never invent an owner cause', () => {
  const accessor = ['availability']; Object.defineProperty(accessor, '0', { get() { throw new Error('accessor was read'); }, enumerable: true });
  for (const value of [null, 'availability', [], ['availability', 'availability'], ['self.contact'], ['secret-person'], ['availability', 'secret-person'], accessor, Array(30).fill('availability')])
    assert.equal(getIntroductionGuidance(base({ ownExpiredPublicFields: value })).id, 'introduction-confirmation-pending');
  const top = base(); Object.defineProperty(top, 'ownExpiredPublicFields', { get() { throw new Error('top accessor was read'); }, enumerable: true });
  assert.equal(getIntroductionGuidance(top).id, 'introduction-confirmation-pending');
});

test('connect authority and owner invitation settings still precede expired answer repair', () => {
  assert.equal(getIntroductionGuidance({ ...blocks(['availability']), canConnect: true }), null);
  assert.equal(getIntroductionGuidance({ ...blocks(['availability']), canConnect: undefined }).id, 'introduction-confirmation-pending');
  const settings = getIntroductionGuidance({ ...blocks(['availability']), ownReceiveInvitations: false });
  assert.equal(settings.id, 'own-invitations-off'); assert.equal(settings.action.page, 'settings');
});

test('already authorized history, acceptance, decline, pending and reopening rights precede new-public-expiry repair', () => {
  for (const [introduction, expected] of [
    [{ hasHistory: true, canReopen: true }, 'own-introduction-reopen'],
    [{ hasHistory: true, accepted: true }, 'existing-introduction-accepted'],
    [{ hasHistory: true, canRespond: true }, 'existing-introduction-response'],
    [{ hasHistory: true, canRespond: false, canDecline: true }, 'existing-introduction-response'],
    [{ hasHistory: true, canWithdraw: true, status: 'pending' }, 'existing-introduction-pending'],
  ]) {
    const input = base({ introduction }); Object.defineProperty(input, 'ownExpiredPublicFields', { get() { throw new Error('expiry should not be read'); }, enumerable: true });
    const result = getIntroductionGuidance(input); assert.equal(result.id, expected); assert.equal(result.action.kind, 'focus-pair');
  }
  assert.equal(getIntroductionGuidance({ ...blocks(['availability']), introduction: { hasHistory: false, accepted: true } }).id, 'own-public-answer-expired');
});

test('owner expiry repair does not read or copy private region answers or any counterpart information', () => {
  const input = blocks(['wants.contact']);
  for (const name of ['ownPrivateRegions', 'ownPublicRegions', 'peerPublicRegions', 'peerExpiredFields', 'peerPrivate', 'peerName', 'rawEvents'])
    Object.defineProperty(input, name, { get() { throw new Error(`${name} must not be read`); }, enumerable: true });
  const result = getIntroductionGuidance(input); assert.deepEqual(result.action, navigation('wants.contact'));
  assert.doesNotMatch(result.body, /상대의 기한|상대가|비공개 지역|자동.*공개/);
});

test('expiry guidance is detached and a later unexpired host projection no longer asks to renew it', () => {
  const input = Object.freeze(blocks(Object.freeze(['wants.plan']))), first = getIntroductionGuidance(input);
  first.action.field = 'availability'; assert.deepEqual(getIntroductionGuidance(input).action, navigation('wants.plan'));
  assert.equal(getIntroductionGuidance(base({ ownExpiredPublicFields: [] })).id, 'introduction-confirmation-pending');
});

const START = '2026-10-10T03:00:00.000Z', END = '2026-10-10T03:01:00.000Z';
const ids = ['public-guidance:owner', 'public-guidance:peer'], area = ['seoul-center'];
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-public-guidance-')); let time = Date.parse(START);
  const server = createDatingServer({ mode: 'account', databasePath: path.join(dir, 'account.sqlite'),
    verify: async accountId => ids.includes(accountId) ? { accountId } : null, clock: () => time });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  async function call(route, index, json) {
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: json ? 'POST' : 'GET', headers: { Authorization: `Bearer ${ids[index]}`,
      ...(json ? { Origin: origin, 'Content-Type': 'application/json' } : {}) }, ...(json ? { body: JSON.stringify(json) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  async function state(index = 0) { const result = await call('/state', index); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.view; }
  async function raw(index, action) { return call('/action', index, { requestId: randomUUID(), expectedRevision: (await state(index)).revision, action }); }
  async function action(index, value) { const result = await raw(index, value); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
  async function seed(index, { values = {}, required = [], expirations, answers = {}, receiveInvitations = true } = {}) {
    await action(index, { kind: 'profile', profile: { nickname: `공개기한 가상${index}`, region: '합성 지역 소개', intro: '직접 공개한 합성 소개',
      values: { availability: 'weekend', ...values }, required, ...(expirations ? { expirations } : {}) } });
    await action(index, { kind: 'adult', declared: true });
    await action(index, { kind: 'consents', consents: { profilePublic: true, receiveInvitations, storePreferences: true } });
    for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', ...answers })) await action(index, { kind: 'discovery', action: { kind: 'set', field, value } });
  }
  async function candidate(index = 0) { return (await state(index)).discovery.candidates.find(item => item.id === ids[1 - index]); }
  async function respond(index, sent, value) { const pair = (await state(index)).pairs.find(item => item.pairId === sent.result.pairId);
    return raw(index, { kind: 'introduction', pairId: pair.pairId, expectedIntroductionRevision: pair.introduction.revision,
      action: { kind: 'respond', introductionId: sent.result.introductionId, value } }); }
  return { call, state, raw, action, seed, candidate, respond, advance: ms => { time += ms; } };
}

test('HTTP own public schedule expiry names the cause and opens public schedule without changing valid private answers', async t => {
  const f = await fixture(t); await f.seed(0, { expirations: { availability: END } }); await f.seed(1);
  const before = await f.state(); f.advance(60000); const current = await f.state(), candidate = await f.candidate();
  assert.equal(candidate.status, 'eligible'); assert.equal(candidate.canConnect, false); assert.deepEqual(candidate.introductionGuidance.action, navigation('availability'));
  assert.equal(current.revision, before.revision); assert.deepEqual(current.discovery.fields, before.discovery.fields);
  assert.equal(current.publicAnswers.values.availability, undefined); assert.equal(current.profile.values.availability, 'weekend');
  assert.equal((await f.raw(0, { kind: 'connect', targetAccountId: ids[1] })).status, 403);
  assert.equal((await f.state()).pairs.length, 0); assert.deepEqual((await f.state()).profile, before.profile);
});

for (const value of ['daily', 'any']) test(`HTTP expired required public contact ${value} is an owner repair even when private comparison remains eligible`, async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'wants.contact': value }, required: ['wants.contact'], expirations: { 'wants.contact': END }, answers: { 'wants.contact': 'daily' } });
  await f.seed(1, { values: { 'self.contact': 'daily' } }); const before = await f.state(); f.advance(60000);
  const current = await f.state(), candidate = await f.candidate(); assert.equal(candidate.status, 'eligible'); assert.equal(candidate.canConnect, false);
  assert.equal(candidate.introductionGuidance.id, 'own-public-answer-expired'); assert.deepEqual(candidate.introductionGuidance.action, navigation('wants.contact'));
  assert.deepEqual(current.publicAnswers.required, ['wants.contact']); assert.equal(current.publicAnswers.values['wants.contact'], undefined);
  assert.equal(current.profile.values['wants.contact'], value); assert.deepEqual(current.discovery.fields, before.discovery.fields);
  assert.equal((await f.raw(0, { kind: 'connect', targetAccountId: ids[1] })).status, 403);
});

test('HTTP expired own public area points to publication instead of filling it from the still-valid private area', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'self.meetingRegions': area }, expirations: { 'self.meetingRegions': END }, answers: { 'self.meetingRegions': area } });
  await f.seed(1, { values: { 'self.meetingRegions': area }, answers: { 'self.meetingRegions': area } }); f.advance(60000);
  const current = await f.state(), candidate = await f.candidate(); assert.equal(candidate.status, 'eligible'); assert.equal(candidate.canConnect, false);
  assert.deepEqual(candidate.introductionGuidance.action, navigation('self.meetingRegions'));
  assert.deepEqual(current.discovery.fields.find(field => field.id === 'self.meetingRegions').value, area);
  assert.equal(current.publicAnswers.values['self.meetingRegions'], undefined); assert.deepEqual(current.profile.values['self.meetingRegions'], area);
  assert.doesNotMatch(JSON.stringify(candidate.introductionGuidance), /seoul-center|공개기한 가상|public-guidance:/);
});

test('HTTP optional expired public wishes do not become owner repair blockers or reveal an unrelated peer setting', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'wants.contact': 'daily' }, expirations: { 'wants.contact': END } }); await f.seed(1, { receiveInvitations: false });
  f.advance(60000); const current = await f.state(), candidate = await f.candidate(); assert.deepEqual(current.publicAnswers.expiredFields, ['wants.contact']);
  assert.equal(candidate.canConnect, false); assert.equal(candidate.introductionGuidance.id, 'introduction-confirmation-pending');
  assert.deepEqual(candidate.introductionGuidance.action, { kind: 'refresh', label: '최신 소개 상태 확인' });
  assert.doesNotMatch(JSON.stringify(candidate.introductionGuidance), /wants.contact|상대의 초대|상대가/);
});

test('HTTP peer expiry is never described as an owner cause or echoed into private owner guidance', async t => {
  const f = await fixture(t); await f.seed(0); await f.seed(1, { expirations: { availability: END } }); f.advance(60000);
  const current = await f.state(), candidate = await f.candidate(); assert.deepEqual(current.publicAnswers.expiredFields, []);
  assert.equal(candidate.canConnect, false); assert.equal(candidate.introductionGuidance.id, 'introduction-confirmation-pending');
  assert.doesNotMatch(JSON.stringify(candidate.introductionGuidance), /availability|상대의 기한|public-guidance:|공개기한 가상/);
});

test('HTTP accepted and outstanding introduction responses retain their existing actions after own public expiry', async t => {
  const f = await fixture(t); await f.seed(0, { expirations: { availability: END } }); await f.seed(1, { expirations: { availability: END } });
  const sent = await f.action(0, { kind: 'connect', targetAccountId: ids[1] }); f.advance(60000);
  assert.equal((await f.candidate(0)).introductionGuidance.id, 'existing-introduction-pending');
  assert.equal((await f.candidate(1)).introductionGuidance.id, 'existing-introduction-response');
  assert.equal((await f.respond(1, sent, 'accept')).status, 403); assert.equal((await f.respond(1, sent, 'decline')).status, 200);
  assert.equal((await f.candidate(1)).introductionGuidance.id, 'own-introduction-reopen');
});

test('HTTP already accepted introduction keeps its history action and acceptance after a later own public blocker expires', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'wants.contact': 'any' }, required: ['wants.contact'], expirations: { 'wants.contact': END } }); await f.seed(1);
  const sent = await f.action(0, { kind: 'connect', targetAccountId: ids[1] }); assert.equal((await f.respond(1, sent, 'accept')).status, 200);
  f.advance(60000); const current = await f.state(), candidate = await f.candidate();
  assert.equal(candidate.introductionGuidance.id, 'existing-introduction-accepted'); assert.equal(candidate.introductionGuidance.action.kind, 'focus-pair');
  assert.equal(current.pairs.find(pair => pair.pairId === sent.result.pairId).introduction.accepted, true);
  assert.deepEqual(current.publicAnswers.required, ['wants.contact']); assert.deepEqual(current.publicAnswers.expiredFields, ['wants.contact']);
});

test('HTTP explicitly renewing a public deadline clears repair guidance without editing private answers or enabling consent', async t => {
  const f = await fixture(t); await f.seed(0, { values: { 'wants.contact': 'daily' }, required: ['wants.contact'], expirations: { 'wants.contact': END }, answers: { 'wants.contact': 'few-days' } });
  await f.seed(1, { values: { 'self.contact': 'daily' } }); f.advance(60000); const expired = await f.state();
  assert.equal((await f.candidate()).introductionGuidance.id, 'own-public-answer-expired');
  await f.action(0, { kind: 'profile', profile: { ...expired.profile, expirations: { 'wants.contact': '2026-10-10T03:10:00.000Z' } } });
  const renewed = await f.state(), candidate = await f.candidate(); assert.equal(candidate.canConnect, true); assert.equal(candidate.introductionGuidance, null);
  assert.deepEqual(renewed.discovery.fields, expired.discovery.fields); assert.deepEqual(renewed.consents, expired.consents);
  assert.equal(renewed.profile.values['wants.contact'], 'daily'); assert.equal(renewed.discovery.fields.find(field => field.id === 'wants.contact').value, 'few-days');
});
