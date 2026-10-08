import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { getLiveChange, isAccountAccessLost } from '../experiences/atlas-lab/dating-live.mjs';

const clone = value => structuredClone(value);
function fixture() {
  return {
    accountId: 'synthetic-owner', revision: 4, status: 'active', paused: false,
    adult: { selfDeclared: true, verified: false, at: '2026-10-07T00:00:00.000Z' },
    consents: { storePreferences: true, profilePublic: true, receiveInvitations: true },
    profile: { nickname: '가상 사용자', region: '', intro: '', values: {}, required: [] },
    asOf: '2026-10-07T00:00:00.000Z',
    discovery: {
      context: { id: 'context-one', closed: false, expiresAt: null, revision: 1 },
      fields: [{ id: 'wants.notice', source: 'context', required: false, requiredValue: null,
        baseline: { state: 'unknown', value: null, provenance: null },
        context: { state: 'known', value: 'advance', provenance: { eventId: 'declaration-one', at: '2026-10-07T00:00:00.000Z' } },
        effective: { state: 'known', value: 'advance', provenance: { eventId: 'declaration-one', at: '2026-10-07T00:00:00.000Z' } } }],
      priorities: { baseline: [], context: null, effective: [] }, conditionalPreference: null,
      candidates: [{ id: 'synthetic-peer', label: '가상 상대', status: 'eligible', canConnect: true }],
    },
    experience: { recommendationToken: 'opaque-one', records: [] },
    candidates: [{ accountId: 'synthetic-peer', nickname: '가상 상대', region: '', intro: '',
      values: { availability: 'weekend' }, required: [], adult: { selfDeclared: true, verified: false }, canConnect: true }],
    pairs: [{ pairId: 'pair-one', revision: 2, status: 'active', paused: false, scheduleDraftBasis: 'opaque-schedule-source',
      introduction: { revision: 2, accepted: true, canSend: false, canRespond: false, canWithdraw: true, canReopen: false,
        current: { id: 'introduction-one', status: 'accepted', expiresAt: '2026-10-08T00:00:00.000Z' } },
      view: { at: '2026-10-07T00:00:00.000Z', revision: 2, canPropose: true,
        me: { receiving: { state: 'open', canReopen: false }, nextForm: null, reflections: [] }, appointments: [], inbox: [] },
      alignment: { key: 'offer-one', contextKey: 'context-offer-one', proposalVersion: 0,
        selectedOptionId: 'baseline', canRespond: true, canWithdraw: false, canProposeOption: true, canCancelOption: false,
        me: { value: null }, partner: { value: null }, status: 'optional' } }],
    inbox: [],
  };
}
const changed = mutate => { const before = fixture(), after = clone(before); mutate(after); return getLiveChange(before, after); };

test('confirming explicitly off setup choices elsewhere invalidates an older onboarding draft even when consent values stay false',()=>{
  const before=fixture();before.consents={profilePublic:false,receiveInvitations:false,storePreferences:false};
  before.onboarding={complete:false,steps:{profile:true,adult:true,consents:false},missing:['consents']};
  const after=clone(before);after.onboarding={complete:true,steps:{profile:true,adult:true,consents:true},missing:[]};
  assert.equal(getLiveChange(before,after).kind,'invalidate');
  assert.equal(getLiveChange(after,clone(after)).kind,'unchanged');
});

test('saved candidates losing current visibility or removed elsewhere invalidate displayed saved comparisons',()=>{
  const before=fixture();before.savedCandidates={items:[{id:'saved-one',savedAt:before.asOf,candidateId:'synthetic-peer'}],limit:5,canAdd:true};
  for(const items of [[],[{...before.savedCandidates.items[0],candidateId:null}]]){
    const after=clone(before);after.savedCandidates.items=items;assert.equal(getLiveChange(before,after).kind,'invalidate');
  }
});
test('new private bookmarks notify without invalidating unrelated drafts and stable bookmarks are unchanged',()=>{
  const before=fixture();before.savedCandidates={items:[],limit:5,canAdd:true};
  const after=clone(before);after.savedCandidates.items.push({id:'saved-one',savedAt:before.asOf,candidateId:'synthetic-peer'});
  assert.equal(getLiveChange(before,after).kind,'notify');assert.equal(getLiveChange(after,clone(after)).kind,'unchanged');
});

test('central hold and explicit-resume requirements invalidate an old authorized draft even while the local actor remains active', () => {
  for (const centralAvailability of [{status:'disabled',sequence:2,resumeRequired:true,canResume:false},
    {status:'active',sequence:3,resumeRequired:true,canResume:true}]) {
    const before=fixture();before.centralAvailability={status:'active',sequence:1,resumeRequired:false,canResume:false};
    const after=clone(before);after.centralAvailability=centralAvailability;
    assert.equal(after.status,'active'); assert.equal(getLiveChange(before,after).kind,'invalidate');
    if (centralAvailability.status!=='active') {
      assert.match(getLiveChange(before,after).message,/작성 중인 내용과 전송 확인을 정리/);
      assert.doesNotMatch(getLiveChange(before,after).message,/유지/);
    }
  }
});

test('adult verification read clocks do not queue new responses, but current verification authority does invalidate old previews', () => {
  const before=fixture();before.adult.verification={required:true,status:'verified',validUntil:'2026-10-08T00:00:00.000Z',checkedAt:'2026-10-07T00:00:00.000Z',resumeRequired:false,canResume:false};
  const reread=clone(before);reread.adult.verification.checkedAt='2026-10-07T00:01:00.000Z';
  assert.equal(getLiveChange(before,reread).kind,'unchanged');
  for (const status of ['expired','revoked','pending','unavailable']) { const changed=clone(reread);changed.adult.verification.status=status; assert.equal(getLiveChange(before,changed).kind,'invalidate'); }
  const resume=clone(reread);resume.adult.verification.resumeRequired=true;resume.adult.verification.canResume=true;
  assert.equal(getLiveChange(before,resume).kind,'invalidate');
});

test('read clocks, rotating recommendation receipts and revisions are unchanged', () => {
  assert.equal(changed(after => {
    after.revision++; after.asOf = '2026-10-07T00:01:00.000Z'; after.discovery.context.revision++;
    after.experience.recommendationToken = 'opaque-two'; after.pairs[0].revision++;
    after.pairs[0].introduction.revision++; after.pairs[0].view.revision++;
    after.pairs[0].view.at = after.asOf;
  }).kind, 'unchanged');
});

test('ordinary new inbox response and private reflection notify without invalidating drafts', () => {
  for (const mutate of [
    after => after.inbox.push({ id: 'response-one', read: false, message: '가상 새 응답' }),
    after => after.pairs[0].view.me.reflections.push({ text: '가상 내 회고' }),
    after => { after.pairs[0].alignment.partner.value = 'yes'; after.pairs[0].alignment.status = 'waiting'; },
    after => after.experience.records.push({ id: 'own-record', responses: { intent: { value: 'yes' } } }),
  ]) assert.equal(changed(mutate).kind, 'notify');
});

test('additional candidates notify; reordering a pool does not withdraw existing permissions', () => {
  assert.equal(changed(after => after.candidates.push({ accountId: 'new-synthetic-peer', nickname: '새 가상 상대', values: {}, canConnect: true })).kind, 'notify');
  const before = fixture(); before.candidates.push({ accountId: 'another-peer', values: {}, canConnect: true });
  const after = clone(before); after.candidates.reverse();
  assert.equal(getLiveChange(before, after).kind, 'notify');
});

test('final deletion, disappearing view or identity switch cannot preserve the previous account', () => {
  for (const after of [null, {}, { ...fixture(), accountId: 'other-owner' }, { ...fixture(), status: 'deleted' },
    { accountId: 'synthetic-owner', deleted: true }]) assert.equal(getLiveChange(fixture(), after).kind, 'identity-lost');
});

test('own suspension, pause, adult and all three consent boundaries invalidate the view', () => {
  for (const mutate of [after => { after.status = 'suspended'; }, after => { after.paused = true; },
    after => { after.adult.selfDeclared = false; }, ...['storePreferences', 'profilePublic', 'receiveInvitations']
      .map(key => after => { after.consents[key] = false; })]) assert.equal(changed(mutate).kind, 'invalidate');
});

test('own source lineage, answer expiry, context and priority changes invalidate stale forms', () => {
  for (const mutate of [
    after => { after.discovery.fields[0].effective.provenance.eventId = 'new-declaration-same-answer'; },
    after => { after.discovery.fields[0].source = 'baseline'; },
    after => { after.discovery.fields[0].effective.state = 'expired'; after.discovery.fields[0].effective.value = null; },
    after => { after.discovery.fields[0].required = true; },
    after => { after.discovery.context.closed = true; },
    after => { after.discovery.context.id = 'context-two'; },
    after => { after.discovery.context.expiresAt = '2026-10-07T00:01:00.000Z'; },
    after => { after.discovery.priorities.effective = ['wants.notice']; },
    after => { after.discovery = null; },
  ]) assert.equal(changed(mutate).kind, 'invalidate');
});

test('conditional preference source or permission changes invalidate its original draft', () => {
  const before = fixture(); before.discovery.conditionalPreference = { available: true, baseline: { status: 'active', rule: { id: 'one' } }, context: null };
  for (const mutate of [after => { after.discovery.conditionalPreference.available = false; },
    after => { after.discovery.conditionalPreference.baseline.rule.id = 'two'; }]) {
    const after = clone(before); mutate(after); assert.equal(getLiveChange(before, after).kind, 'invalidate');
  }
});

test('withdrawing or altering an already disclosed candidate invalidates the stale public view', () => {
  for (const mutate of [after => { after.candidates = []; },
    after => { after.candidates[0].values.availability = 'weekday'; },
    after => { after.candidates[0].intro = '새 가상 소개'; },
    after => { after.candidates[0].canConnect = false; }]) assert.equal(changed(mutate).kind, 'invalidate');
});

test('connection closure, pause, invitation replacement and acceptance change invalidate', () => {
  for (const mutate of [after => { after.pairs = []; }, after => { after.pairs[0].status = 'closed'; },
    after => { after.pairs[0].paused = true; }, after => { after.pairs[0].view = null; },
    after => { after.pairs[0].introduction.current.id = 'replacement-introduction'; },
    after => { after.pairs[0].introduction.accepted = false; },
    after => { after.pairs[0].introduction.canRespond = true; },
    after => { after.pairs[0].scheduleDraftBasis = 'replacement-source'; }]) assert.equal(changed(mutate).kind, 'invalidate');
});

test('proposal replacement and time-based response permissions invalidate even without revisions', () => {
  const before = fixture(); before.pairs[0].view.appointments = [{ id: 'appointment-one', status: 'pending', proposal: { version: 1, expiresAt: '2026-10-08T00:00:00.000Z' },
    canRespond: true, canRevise: true, canCancel: true, canComplete: false, canReflect: false }];
  for (const mutate of [after => { after.pairs[0].view.appointments[0].proposal.version = 2; },
    after => { after.pairs[0].view.appointments[0].canRespond = false; },
    after => { after.pairs[0].view.appointments[0].status = 'expired'; },
    after => { after.pairs[0].view.me.receiving.state = 'closed'; },
    after => { after.pairs[0].view.canPropose = false; }]) {
    const after = clone(before); mutate(after); assert.equal(getLiveChange(before, after).kind, 'invalidate');
  }
});

test('alignment offer and option permissions invalidate; peer reaction alone only notifies', () => {
  for (const mutate of [after => { after.pairs[0].alignment.key = 'replacement-offer'; },
    after => { after.pairs[0].alignment.proposalVersion++; },
    after => { after.pairs[0].alignment.canRespond = false; }]) assert.equal(changed(mutate).kind, 'invalidate');
});

test('classification neither mutates inputs nor returns private content or identifiers', () => {
  const before = fixture(), after = clone(before); after.experience.records.push({ id: 'private-record-sentinel', text: 'private-text-sentinel' });
  const original = clone({ before, after });
  const result = getLiveChange(before, after);
  assert.deepEqual({ before, after }, original); assert.deepEqual(Object.keys(result).sort(), ['kind', 'message']);
  assert.doesNotMatch(JSON.stringify(result), /sentinel|synthetic-owner|synthetic-peer/);
  assert.equal(getLiveChange(null, fixture()).kind, 'notify');
});

test('account loss excludes a closed pair and preserves sessions during network or provider outages', () => {
  for (const error of [{ status: 401 }, { status: 410 }, { status: 410, code: 'account-deleted' },
    ...['operator-required', 'account-suspended', 'account-unavailable'].map(code => ({ status: 403, code }))]) assert.equal(isAccountAccessLost(error), true);
  for (const error of [{ status: 410, code: 'pair-closed' }, { status: 410, code: 'target-unavailable' }, { status: 503, code: 'account-auth-unavailable' },
    { status: 403, code: 'connection-unavailable' }, { status: 409, code: 'revision-conflict' }, new TypeError('Failed to fetch'), null]) assert.equal(isAccountAccessLost(error), false);
});

test('actual authorized connected views stay unchanged on reread and invalidate on public withdrawal', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-live-helper-'));
  let clock = Date.parse('2026-10-07T03:00:00.000Z');
  const server = createDatingServer({ mode: 'demo', databasePath: path.join(dir, 'fixture.sqlite'), clock: () => clock });
  t.after(async () => {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    const resolved = path.resolve(dir), root = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), root); assert.ok(path.basename(resolved).startsWith('synk-dating-live-helper-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function call(route, token, body) {
    const response = await fetch(`${origin}/api/atlas-dating${route}`, { method: body ? 'POST' : 'GET',
      headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
  }
  const owner = await call('/demo/session', null, { role: 'adult-a' }), peer = await call('/demo/session', null, { role: 'sample-3' });
  const get = async actor => (await call('/state', actor.token)).view;
  const act = async (actor, action) => call('/action', actor.token, { requestId: randomUUID(), expectedRevision: (await get(actor)).revision, action });
  await act(owner, { kind: 'profile', profile: { nickname: '가상 작성자', region: '', intro: '', required: [], values: { availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned' } } });
  await act(owner, { kind: 'adult', declared: true });
  await act(owner, { kind: 'consents', consents: { profilePublic: true, receiveInvitations: true, storePreferences: true } });
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned', 'wants.pace': 'lead' }))
    await act(owner, { kind: 'discovery', action: { kind: 'set', field, value } });
  const connected = await act(owner, { kind: 'connect', targetAccountId: peer.accountId });
  const pair = (await get(peer)).pairs.find(item => item.pairId === connected.result.pairId);
  await act(peer, { kind: 'introduction', pairId: pair.pairId, expectedIntroductionRevision: pair.introduction.revision,
    action: { kind: 'respond', introductionId: connected.result.introductionId, value: 'accept' } });
  const before = await get(owner); assert.equal(before.pairs[0].introduction.accepted, true);
  clock += 1000;
  assert.equal(getLiveChange(before, await get(owner)).kind, 'unchanged');
  await act(peer, { kind: 'consents', consents: { profilePublic: false, receiveInvitations: true, storePreferences: true } });
  const withdrawn = await get(owner); assert.equal(withdrawn.candidates.some(item => item.accountId === peer.accountId), false);
  assert.equal(getLiveChange(before, withdrawn).kind, 'invalidate');
});
