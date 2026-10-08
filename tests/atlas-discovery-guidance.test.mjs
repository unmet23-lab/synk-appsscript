import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import ConditionalPreference from '../atlas/conditional-preference.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
import { getDiscoveryGuidance, getDiscoveryReadiness } from '../experiences/atlas-lab/discovery-guidance.mjs';

const adapter = createDiscoveryAdapter({ Domain, Ask, Personalization });
const set = (state, field, value, extra = {}) => adapter.record(state, { kind: 'set', field, value, ...extra });
const next = state => getDiscoveryGuidance(adapter.inspect(state));
const clone = value => structuredClone(value);
const base = adapter.create('ready');
const hosted = (discovery = adapter.inspect(base), extra = {}) => ({ mode: 'account', synthetic: false, status: 'active', paused: false,
  adult: { selfDeclared: true }, onboarding: { complete: true }, profile: { nickname: '내 공개 이름', values: {} },
  consents: { storePreferences: true, profilePublic: true, receiveInvitations: true }, discovery, candidates: [], ...extra });
const person = (id, values = {}, required = []) => ({ id, label: `공개 ${id}`, values: { consent: true, availability: 'weekend', 'self.pace': 'lead', 'wants.pace': 'any', ...values }, required });
function external(pool) {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization, ownerId: 'my-account', contextId: 'dating-account', synthetic: false, candidates: pool });
  let state = api.create();
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'wants.pace': 'lead' })) state = api.record(state, { kind: 'set', field, value });
  const view = () => hosted(api.inspect(state), { candidates: pool.map(p => ({ accountId: p.id, nickname: p.label, values: clone(p.values), required: [...p.required] })) });
  return { api, view, act(action) { state = api.record(state, action); }, snapshot: () => clone(state) };
}

test('access, onboarding, pause, storage and profile visibility are distinguished before candidate recovery', () => {
  const d = adapter.inspect(base);
  const cases = [
    [{ status: 'deleted', paused: true }, 'account-deleted', 'settings'],
    [{ status: 'suspended', paused: true }, 'account-unavailable', 'settings'],
    [{ onboarding: { complete: false }, paused: true }, 'onboarding-required', 'discover'],
    [{ paused: true, consents: { storePreferences: false } }, 'discovery-paused', 'settings'],
    [{ consents: { storePreferences: false, profilePublic: false } }, 'storage-consent-off', 'settings'],
    [{ consents: { storePreferences: true, profilePublic: false } }, 'profile-not-public', 'settings'],
  ];
  for (const [extra, id, page] of cases) {
    const result = getDiscoveryGuidance(hosted(d, extra)); assert.equal(result.id, id); assert.equal(result.action.kind, 'navigate'); assert.equal(result.action.page, page);
    assert.equal('counts' in result, false, 'unavailable access must not disclose latent candidate counts');
  }
  assert.equal(getDiscoveryGuidance(hosted(d, { mode: 'demo', synthetic: true, consents: { profilePublic: false, storePreferences: true } })).id,
    'profile-not-public', 'hosted demo now uses the same explicitly public role-profile pool');
});

test('consent missing and explicit no are separate and neither action automatically grants consent', () => {
  assert.equal(next(adapter.create()).id, 'discovery-consent-missing');
  const off = next(set(base, 'consent', false)); assert.equal(off.id, 'discovery-consent-off');
  for (const result of [next(adapter.create()), off]) {
    assert.deepEqual(result.action, { kind: 'answer', field: 'consent', label: '살펴보기 여부 정하기' });
    assert.equal('value' in result.action, false); assert.equal('counts' in result, false);
  }
});

test('own schedule and independently required baseline answers get a concrete question without silently changing requirements', () => {
  const noSchedule = adapter.record(base, { kind: 'clear', field: 'availability' });
  assert.equal(next(noSchedule).id, 'own-availability-missing'); assert.equal(next(noSchedule).action.field, 'availability');
  let state = set(base, 'wants.pace', 'lead', { required: true });
  state = adapter.record(state, { kind: 'clear', field: 'wants.pace' });
  state = set(state, 'wants.pace', 'listen', { target: 'context' });
  const before = clone(state), result = next(state);
  assert.equal(result.id, 'own-required-answer-missing'); assert.equal(result.action.field, 'wants.pace');
  assert.match(result.body, /필수 지정은 그대로/); assert.deepEqual(state, before);
});

test('conflict recovery cancels only the conflicting current choice and retains the hard requirement', () => {
  let state = set(base, 'wants.pace', 'lead', { required: true });
  state = set(state, 'wants.pace', 'listen', { target: 'context' });
  const result = next(state); assert.equal(result.id, 'context-conflict');
  assert.deepEqual(result.action, { kind: 'revert-context', field: 'wants.pace', label: '이 항목의 이번 선택 취소하기' });
  const resolved = adapter.record(state, { kind: result.action.kind, field: result.action.field });
  assert.equal(adapter.inspect(resolved).fields.find(f => f.id === 'wants.pace').requiredValue, 'lead');
  assert.equal(adapter.inspect(resolved).candidates.find(p => p.id === 'candidate-2').status, 'excluded');
});

test('closed and expired contexts require an explicit new context, without resurrecting a selection', () => {
  let state = adapter.record(base, { kind: 'select', candidateId: 'candidate-1' });
  state = adapter.record(state, { kind: 'start-context', at: '2026-10-06T13:00:00.000Z', expiresAt: '2026-10-06T14:00:00.000Z' });
  const expired = adapter.inspect(state, { at: '2026-10-06T14:00:00.000Z' });
  const result = getDiscoveryGuidance(expired); assert.equal(result.id, 'context-ended'); assert.equal(result.action.kind, 'start-context');
  assert.equal(expired.selection, null); assert.equal(next(adapter.record(base, { kind: 'close-context' })).id, 'context-ended');
});

test('visible pool emptiness does not infer nonpublic accounts, rejection or attraction', () => {
  const fixture = external([]), view = fixture.view(), before = clone(view);
  const result = getDiscoveryGuidance(view); assert.equal(result.id, 'visible-pool-empty'); assert.equal(result.action.kind, 'refresh');
  assert.deepEqual(result.counts, { visible: 0, eligible: 0, pending: 0, excluded: 0, skipped: 0 }); assert.deepEqual(view, before);
  assert.match(result.body, /현재 공개된 후보 목록/); assert.equal(JSON.stringify(result).includes('거절'), false);
});

test('current skips offer individual restoration first while a new context remains explicit', () => {
  const fixture = external([person('a'), person('b')]);
  for (const id of ['a', 'b']) fixture.act({ kind: 'feedback', candidateId: id, reason: 'context', decision: 'skip-current' });
  let result = getDiscoveryGuidance(fixture.view()); assert.equal(result.id, 'all-current-candidates-skipped'); assert.deepEqual(result.action, { kind: 'focus-excluded', label: '이번에 넘긴 사람 확인하기' }); assert.equal(result.counts.skipped, 2);
  assert.match(result.body, /다른 답과 다른 후보 제외는 유지/); assert.match(result.body, /새 회차를 따로 시작/);
  assert.equal(JSON.stringify(result).includes('공개 a'), false); assert.equal(JSON.stringify(result).includes('event-'), false);
  const before = fixture.snapshot(); getDiscoveryGuidance(fixture.view()); assert.deepEqual(fixture.snapshot(), before);
  fixture.act({ kind: 'start-context' }); assert.equal(getDiscoveryGuidance(fixture.view()), null);
  let mixed = base;
  for (const id of ['candidate-1', 'candidate-2', 'candidate-3']) mixed = adapter.record(mixed, { kind: 'feedback', candidateId: id, reason: 'unknown', decision: 'skip-current' });
  result = next(mixed); assert.equal(result.id, 'current-candidates-skipped'); assert.equal(result.counts.visible, 5); assert.equal(result.counts.skipped, 3);
  assert.doesNotMatch(result.title, /모두/); assert.equal(result.action.kind, 'focus-excluded');
});

test('legacy or unrelated exclusion tickets cannot offer a current individual-restoration list', () => {
  const fixture = external([person('a')]); fixture.act({ kind: 'feedback', candidateId: 'a', reason: 'unknown', decision: 'skip-current' });
  const current = fixture.view(), valid = current.discovery.excludedCandidates[0];
  const cases = [undefined, [], [{ ...valid, id: 'nonpublic-person', label: '비공개 이름' }], [{ ...valid, label: '과거 공개 이름' }],
    [{ ...valid, feedbackId: 'stale-ticket' }], [{ ...valid, status: 'restored' }]];
  for (const excludedCandidates of cases) {
    const view = clone(current); view.discovery.excludedCandidates = excludedCandidates;
    const before = clone(view), result = getDiscoveryGuidance(view);
    assert.equal(result.action.kind, 'start-context'); assert.deepEqual(view, before);
    assert.equal(JSON.stringify(result).includes('비공개 이름'), false); assert.equal(JSON.stringify(result).includes('과거 공개 이름'), false);
  }
});

test('opening the current exclusion list cannot mutate context answers or other exclusions', () => {
  const fixture = external([person('a'), person('b')]); fixture.act({ kind: 'set', field: 'wants.plan', value: 'spontaneous', target: 'context' });
  for (const id of ['a', 'b']) fixture.act({ kind: 'feedback', candidateId: id, reason: 'context', decision: 'skip-current' });
  const before = fixture.snapshot(), view = fixture.view(), projectedBefore = clone(view);
  assert.equal(getDiscoveryGuidance(view).action.kind, 'focus-excluded'); assert.deepEqual(view, projectedBefore); assert.deepEqual(fixture.snapshot(), before);
  fixture.act({ kind: 'restore-candidate', candidateId: 'a', feedbackId: view.discovery.excludedCandidates.find(item => item.id === 'a').feedbackId });
  const after = fixture.view().discovery;
  assert.equal(after.context.id, view.discovery.context.id); assert.deepEqual(after.fields, view.discovery.fields);
  assert.deepEqual(after.excludedCandidates.map(item => item.id), ['b']); assert.equal(after.selection, null);
  fixture.act({ kind: 'start-context' }); assert.deepEqual(fixture.view().discovery.excludedCandidates, []);
});

test('missing counterpart schedule is claimed only for an exact currently visible profile ID with a pending row', () => {
  const p = person('public-person'); delete p.values.availability;
  const fixture = external([p]), view = fixture.view();
  const result = getDiscoveryGuidance(view); assert.equal(result.id, 'public-schedule-missing'); assert.equal(result.action.kind, 'refresh');
  assert.equal(JSON.stringify(result).includes('public-person'), false, 'guidance never echoes candidate identity');
  assert.equal(getDiscoveryGuidance(view.discovery).id, 'required-confirmation-pending', 'a bare discovery projection has no public schedule machine fields');
  const unrelated = hosted(view.discovery, { mode: 'demo', synthetic: true, candidates: [{ accountId: 'demo-role', values: {} }] });
  assert.equal(getDiscoveryGuidance(unrelated).id, 'required-confirmation-pending', 'demo role missing schedules cannot explain synthetic candidate rows');
  const disclosedSchedule = clone(view); disclosedSchedule.candidates[0].values.availability = 'weekend';
  assert.equal(getDiscoveryGuidance(disclosedSchedule).id, 'required-confirmation-pending');
});

test('a missing own answer needed for reciprocal comparison is offered before waiting on other people', () => {
  const fixture = external([person('required-other', {}, ['wants.pace'])]);
  // The other person's explicit required value is lead, and my declaration is absent.
  const pool = [person('required-other', { 'wants.pace': 'lead' }, ['wants.pace'])];
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization, ownerId: 'me', contextId: 'dating-account', synthetic: false, candidates: pool });
  let state = api.create(); for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' })) state = api.record(state, { kind: 'set', field, value });
  const result = getDiscoveryGuidance(hosted(api.inspect(state), { candidates: pool.map(p => ({ accountId: p.id, values: p.values })) }));
  assert.equal(result.id, 'reciprocal-answer-missing'); assert.equal(result.action.kind, 'answer'); assert.equal(result.action.field, 'self.pace');
  assert.equal(getDiscoveryGuidance(fixture.view()), null);
});

test('hard mismatch invites checking the recorded criteria without recommending a weaker requirement', () => {
  const fixture = external([person('different', { 'self.pace': 'listen' })]);
  fixture.act({ kind: 'set', field: 'wants.pace', value: 'lead', required: true });
  const result = getDiscoveryGuidance(fixture.view()); assert.equal(result.id, 'required-conditions-unmatched');
  assert.deepEqual(result.action, { kind: 'navigate', page: 'profile', label: '내 기준 확인하기' });
  assert.match(result.body, /그대로 유지해도/); assert.doesNotMatch(result.body, /조건을 넓|필수조건을 해제|기준을 낮춰/);
});

test('ready recommendations return no empty-state guidance and malformed projections stay unclassified', () => {
  assert.equal(next(base), null);
  for (const input of [null, {}, { discovery: null }, { fields: [], candidates: 'bad' }]) assert.equal(getDiscoveryGuidance(input).id, 'projection-unavailable');
  const invalid = adapter.inspect(base); invalid.candidates.push(clone(invalid.candidates[0])); assert.equal(getDiscoveryGuidance(invalid).id, 'projection-unavailable');
});

test('guidance is pure, detached, and never reads raw state or private records', () => {
  const view = hosted(adapter.inspect(adapter.record(base, { kind: 'clear', field: 'availability' })));
  for (const key of ['rawState', 'events', 'privateFeedback', 'preferences', 'reports', 'blocks']) Object.defineProperty(view, key, { get() { throw new Error(`private ${key} must not be read`); } });
  const result = getDiscoveryGuidance(view); assert.equal(result.id, 'own-availability-missing'); result.action.field = 'private';
  assert.equal(getDiscoveryGuidance(view).action.field, 'availability');
  assert.equal(Object.keys(result).filter(key => key === 'action').length, 1); assert.equal(Array.isArray(result.action), false);
});

test('a confirmed own hard answer and missing current public counterpart answer explain pending without exporting identities or values', () => {
  const fixture = external([person('public-contact-gap')]);
  fixture.act({ kind: 'set', field: 'wants.contact', value: 'daily', required: true });
  const view = fixture.view(), before = clone(view), g = getDiscoveryGuidance(view), r = getDiscoveryReadiness(view);
  assert.equal(g.id, 'required-confirmation-pending'); assert.match(g.body, /내.*필수 답은 확인/); assert.match(g.body, /공개 답이 없는 경우/);
  assert.equal(g.title, '공개 답이 더 필요해 추천을 보류했어요.'); assert.equal(r.recommendation.title, g.title);
  assert.doesNotMatch(g.title, /필수 확인이 남|내 답.*부족|내 답.*남/);
  assert.deepEqual(g.action, { kind: 'refresh', label: '확인된 정보 다시 살펴보기' });
  assert.equal(r.status, 'waiting'); assert.equal(r.preparation.status, 'confirmed'); assert.equal(r.recommendation.status, 'waiting');
  assert.deepEqual(r.pending, { own: [], public: [{ field: 'wants.contact', label: '상대에게 바라는 연락 빈도' }], unclassified: false });
  assert.doesNotMatch(JSON.stringify({ g, r }), /public-contact-gap|공개 public|daily|상대의 마음|호감도/);
  assert.deepEqual(view, before);
});

test('specific public pending requires the same authorized profile, missing machine field, and unchanged structured hard comparison', () => {
  const fixture = external([person('public-contact-gap')]); fixture.act({ kind: 'set', field: 'wants.contact', value: 'daily', required: true });
  const valid = fixture.view(), variants = [];
  for (const candidates of [[], [{ accountId: 'unrelated-private', values: {} }], [valid.candidates[0], clone(valid.candidates[0])],
    [{ ...valid.candidates[0], values: { ...valid.candidates[0].values, 'self.contact': 'few-days' } }]]) {
    const view = clone(valid); view.candidates = candidates; variants.push(view);
  }
  for (const changes of [{ owner: 'partner' }, { required: false }, { comparison: 'different' }, { editable: false }, { value: 'few-days' }]) {
    const view = clone(valid); Object.assign(view.discovery.candidates[0].reasonDetails.find(d => d.field === 'wants.contact' && d.owner === 'self'), changes); variants.push(view);
  }
  for (const view of variants) {
    const r = getDiscoveryReadiness(view), g = getDiscoveryGuidance(view);
    assert.equal(g.id, 'required-confirmation-pending'); assert.equal(g.title, '필수 확인이 남아 추천을 보류했어요.'); assert.doesNotMatch(g.body, /내.*필수 답은 확인/);
    assert.deepEqual(r.pending.public, []); assert.equal(r.pending.unclassified, true);
    assert.doesNotMatch(JSON.stringify(r), /unrelated-private|few-days/);
  }
});

test('a present but different contact answer is excluded rather than described as a missing public answer', () => {
  const fixture = external([person('known-contact', { 'self.contact': 'few-days' })]);
  fixture.act({ kind: 'set', field: 'wants.contact', value: 'daily', required: true });
  const view = fixture.view(), result = getDiscoveryReadiness(view);
  assert.equal(view.discovery.candidates[0].status, 'excluded'); assert.equal(getDiscoveryGuidance(view).id, 'required-conditions-unmatched');
  assert.equal(result.recommendation.status, 'blocked'); assert.deepEqual(result.pending.public, []);
  assert.doesNotMatch(result.body, /공개 답이 없는 경우|미확인.*연락/);
});

test('a missing own required answer stays preparation work and is not attributed to public counterpart gaps', () => {
  const fixture = external([person('public-contact-gap')]);
  fixture.act({ kind: 'set', field: 'wants.contact', value: 'daily', required: true }); fixture.act({ kind: 'clear', field: 'wants.contact' });
  const view = fixture.view(), before = clone(view), r = getDiscoveryReadiness(view);
  assert.equal(getDiscoveryGuidance(view).id, 'own-required-answer-missing'); assert.equal(r.status, 'needs-action');
  assert.equal(r.preparation.status, 'needed'); assert.equal(r.preparation.items[0].action.field, 'wants.contact');
  assert.equal(r.optional.status, 'unavailable'); assert.deepEqual(r.pending.public, []); assert.deepEqual(view, before);
});

test('readiness remains ready with an eligible row while another pending row needs an own reciprocal answer', () => {
  const fixture = external([person('already-comparable'), person('waiting-for-my-answer', { 'wants.contact': 'daily' }, ['wants.contact'])]);
  const view = fixture.view(), before = clone(view), r = getDiscoveryReadiness(view);
  assert.equal(view.discovery.status, 'ready'); assert.equal(view.discovery.question.optional, false); assert.equal(view.discovery.question.field, 'self.contact');
  assert.equal(getDiscoveryGuidance(view), null); assert.equal(r.status, 'ready'); assert.equal(r.recommendation.status, 'ready');
  assert.equal(r.preparation.status, 'confirmed'); assert.equal(r.optional.status, 'none');
  assert.deepEqual(r.pending.own.map(item => item.field), ['self.contact']); assert.deepEqual(r.pending.public, []);
  assert.doesNotMatch(JSON.stringify(r), /already-comparable|waiting-for-my-answer|daily/); assert.deepEqual(view, before);
});

test('ready comparison remains available while another current public contact answer is pending', () => {
  const fixture = external([person('already-comparable', { 'self.contact': 'daily' }), person('public-contact-gap')]);
  fixture.act({ kind: 'set', field: 'wants.contact', value: 'daily', required: true });
  const view = fixture.view(), r = getDiscoveryReadiness(view);
  assert.equal(getDiscoveryGuidance(view), null); assert.equal(r.status, 'ready'); assert.equal(r.preparation.status, 'confirmed');
  assert.equal(r.recommendation.status, 'ready'); assert.deepEqual(r.pending.public.map(item => item.field), ['wants.contact']);
  assert.doesNotMatch(JSON.stringify(r), /already-comparable|public-contact-gap|daily/);
});

test('public schedule readiness uses structured own comparison proof as well as the exact currently missing public schedule', () => {
  const p = person('schedule-gap'); delete p.values.availability;
  const valid = external([p]).view(), r = getDiscoveryReadiness(valid);
  assert.deepEqual(r.pending.public.map(item => item.field), ['availability']); assert.equal(getDiscoveryGuidance(valid).id, 'public-schedule-missing');
  for (const patch of [{ owner: 'partner' }, { comparison: 'different' }, { required: false }, { value: 'weekday' }]) {
    const view = clone(valid); Object.assign(view.discovery.candidates[0].reasonDetails.find(d => d.field === 'availability'), patch);
    assert.equal(getDiscoveryGuidance(view).id, 'required-confirmation-pending'); assert.deepEqual(getDiscoveryReadiness(view).pending.public, []);
  }
  const duplicate = clone(valid); duplicate.candidates.push(clone(duplicate.candidates[0]));
  assert.equal(getDiscoveryGuidance(duplicate).id, 'required-confirmation-pending'); assert.deepEqual(getDiscoveryReadiness(duplicate).pending.public, []);
});

test('missing notice for a conditional soft preference never relabels a known contact mismatch as a required public gap', () => {
  const pool = [person('known-contact', { 'self.contact': 'few-days' })];
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization, ConditionalPreference, ownerId: 'my-account', contextId: 'dating-account', synthetic: false, candidates: pool });
  let state = api.create();
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'wants.contact': 'daily' })) state = api.record(state, { kind: 'set', field, value });
  state = api.applyPreview(state, api.preview(state, { kind: 'conditional-set', ruleId: 'contact-with-notice', target: 'context' }));
  const discovery = api.inspect(state), detail = discovery.candidates[0].reasonDetails.find(d => d.owner === 'self' && d.field === 'wants.contact');
  assert.equal(detail.comparison, 'different'); assert.equal(detail.conditionStatus, 'unknown');
  const r = getDiscoveryReadiness(hosted(discovery, { candidates: pool.map(p => ({ accountId: p.id, values: clone(p.values) })) }));
  assert.equal(r.status, 'ready'); assert.deepEqual(r.pending.public, []); assert.equal(r.recommendation.status, 'ready');
});

test('without an eligible row the current mandatory reciprocal question is preparation work before refreshing others', () => {
  const fixture = external([person('waiting-for-my-answer', { 'wants.contact': 'daily' }, ['wants.contact'])]);
  const view = fixture.view(), r = getDiscoveryReadiness(view);
  assert.equal(view.discovery.question.field, 'self.contact'); assert.equal(getDiscoveryGuidance(view).id, 'reciprocal-answer-missing');
  assert.equal(r.status, 'needs-action'); assert.equal(r.preparation.status, 'needed'); assert.equal(r.recommendation.status, 'waiting');
  assert.equal(r.preparation.items.at(-1).action.field, 'self.contact'); assert.deepEqual(r.pending.own.map(item => item.field), ['self.contact']);
  assert.equal(r.optional.status, 'none');
});

test('current optional questions are separate from ready comparison and answer coverage is never read as completion', () => {
  const view = hosted(adapter.inspect(base));
  Object.defineProperty(view.discovery, 'insights', { get() { throw new Error('answer totals must not decide completion'); } });
  const r = getDiscoveryReadiness(view);
  assert.equal(r.status, 'ready'); assert.equal(r.preparation.status, 'confirmed'); assert.equal(r.recommendation.status, 'ready');
  assert.equal(r.optional.status, 'available'); assert.equal(r.optional.action.kind, 'answer'); assert.equal(r.optional.action.field, view.discovery.question.field);
  assert.doesNotMatch(JSON.stringify(r), /percent|coverage|total|knownCount|\d+%|개 중/);
  const stopped = getDiscoveryReadiness(hosted(adapter.inspect(adapter.record(base, { kind: 'stop-questions' }))));
  assert.equal(stopped.status, 'ready'); assert.equal(stopped.optional.status, 'paused'); assert.match(stopped.optional.body, /쉬고/);
});

test('completed optional daily budget does not revoke currently ready recommendations', () => {
  let state = adapter.record(base, { kind: 'question-mode', mode: 'brief' });
  for (let i = 0; i < 2; i++) {
    const q = adapter.inspect(state).question; assert.equal(q.optional, true);
    state = adapter.record(state, { kind: 'skip', field: q.field });
  }
  const view = hosted(adapter.inspect(state)), r = getDiscoveryReadiness(view);
  assert.equal(view.discovery.questionControl.remaining, 0); assert.equal(r.status, 'ready'); assert.equal(r.optional.status, 'paused');
  assert.match(r.optional.body, /오늘.*마쳤/); assert.equal('action' in r.optional, false);
});

test('account lifecycle, central restriction and required adult verification do not read latent discovery or public profiles', () => {
  const cases = [{ status: 'deleted' }, { status: 'suspended' }, { centralAvailability: { status: 'deletion-requested' } },
    ...['not-connected', 'pending', 'revoked', 'unverified', 'expired', 'unavailable', 'unexpected'].map(status => ({ adult: { selfDeclared: true, verification: { required: true, status } } }))];
  for (const extra of cases) {
    const view = hosted(undefined, extra);
    for (const key of ['discovery', 'candidates']) Object.defineProperty(view, key, { get() { throw new Error(`latent ${key} must not be read`); } });
    const r = getDiscoveryReadiness(view);
    assert.equal(r.status, 'unavailable'); assert.equal(r.preparation.status, 'unavailable'); assert.equal(r.optional.status, 'unavailable');
    assert.deepEqual(r.pending, { own: [], public: [], unclassified: false }); assert.deepEqual(r.preparation.items, []);
  }
});

test('optional adult verification is not a new gate while verified resume still requires explicit public scope', () => {
  const ready = hosted(undefined, { adult: { selfDeclared: true, verified: false, verification: { required: false, status: 'not-connected' } } });
  assert.equal(getDiscoveryReadiness(ready).status, 'ready');
  const verified = hosted(undefined, { adult: { selfDeclared: true, verified: true, verification: { required: true, status: 'verified', resumeRequired: true } },
    consents: { storePreferences: true, profilePublic: false, receiveInvitations: false } });
  assert.equal(getDiscoveryGuidance(verified).id, 'profile-not-public'); assert.equal(getDiscoveryReadiness(verified).status, 'needs-action');
});

test('unfinished start, pause and independently disabled scopes remain preparation work without reading hidden candidate data', () => {
  for (const extra of [{ onboarding: { complete: false } }, { paused: true }, { consents: { storePreferences: false } },
    { consents: { storePreferences: true, profilePublic: false } }]) {
    const view = hosted(undefined, extra);
    Object.defineProperty(view, 'candidates', { get() { throw new Error('hidden candidates must not be read'); } });
    Object.defineProperty(view, 'discovery', { get() { throw new Error('hidden discovery must not be read'); } });
    const r = getDiscoveryReadiness(view); assert.equal(r.status, 'needs-action'); assert.equal(r.preparation.status, 'needed');
    assert.equal(r.preparation.items.length, 1); assert.equal(r.optional.status, 'unavailable');
  }
  const noInvites = hosted(undefined, { consents: { storePreferences: true, profilePublic: true, receiveInvitations: false } });
  assert.equal(getDiscoveryReadiness(noInvites).status, 'ready', 'receiving invitations is independently chosen and not a prerequisite for browsing');
});

test('an empty public pool and current hard mismatch distinguish next action without claiming optional answers are necessary', () => {
  const empty = getDiscoveryReadiness(external([]).view()); assert.equal(empty.status, 'waiting'); assert.equal(empty.preparation.status, 'confirmed');
  assert.equal(empty.recommendation.status, 'empty'); assert.equal(empty.recommendation.action.kind, 'refresh');
  const fixture = external([person('different', { 'self.pace': 'listen' })]); fixture.act({ kind: 'set', field: 'wants.pace', value: 'lead', required: true });
  const mismatch = getDiscoveryReadiness(fixture.view()); assert.equal(mismatch.status, 'waiting'); assert.equal(mismatch.recommendation.status, 'blocked');
  assert.equal(mismatch.preparation.status, 'confirmed'); assert.equal(mismatch.recommendation.action.page, 'profile');
  assert.doesNotMatch(mismatch.body, /기준을 낮|필수조건을 해제|답을 더.*해야/);
});

test('unknown or contradictory projections cannot make readiness complete', () => {
  const variants = [null, {}, { discovery: null }];
  for (const patch of [{ status: 'unknown' }, { status: 'needs-confirmation' }, { candidates: [] }, { question: { field: 'private-unrecognized', optional: true } }]) {
    const d = adapter.inspect(base); Object.assign(d, patch); variants.push(hosted(d));
  }
  const duplicate = hosted(adapter.inspect(base)); duplicate.discovery.fields.push(clone(duplicate.discovery.fields[0])); variants.push(duplicate);
  const badHard = external([person('a')]); badHard.act({ kind: 'set', field: 'wants.pace', value: 'lead', required: true });
  const invalidValue = badHard.view(); invalidValue.discovery.fields.find(f => f.id === 'wants.pace').requiredValue = 'invalid-private'; variants.push(invalidValue);
  const missingScope = hosted(undefined, { consents: { storePreferences: true } }); variants.push(missingScope);
  for (const view of variants) {
    const r = getDiscoveryReadiness(view); assert.equal(r.status, 'unavailable'); assert.equal(r.recommendation.status, 'unavailable');
    assert.equal(r.optional.status, 'unavailable'); assert.deepEqual(r.pending.public, []); assert.doesNotMatch(JSON.stringify(r), /private-unrecognized|invalid-private/);
  }
});

test('readiness is detached and never reads private records, scores, historical profiles or free-form explanation text', () => {
  const fixture = external([person('public-contact-gap')]); fixture.act({ kind: 'set', field: 'wants.contact', value: 'daily', required: true });
  const view = fixture.view();
  for (const key of ['rawState', 'events', 'privateFeedback', 'preferences', 'reports', 'blocks', 'previousCandidates'])
    Object.defineProperty(view, key, { get() { throw new Error(`private ${key} must not be read`); } });
  for (const row of view.discovery.candidates) {
    for (const key of ['label', 'score', 'reason']) Object.defineProperty(row, key, { get() { throw new Error(`candidate ${key} must not be read`); } });
    for (const detail of row.reasonDetails) Object.defineProperty(detail, 'text', { get() { throw new Error('free-form reasons are not evidence'); } });
  }
  const r = getDiscoveryReadiness(view); r.pending.public[0].field = 'private'; r.preparation.items[0].status = 'private';
  const again = getDiscoveryReadiness(view); assert.equal(again.pending.public[0].field, 'wants.contact'); assert.equal(again.preparation.items[0].status, 'confirmed');
  assert.equal(Object.hasOwn(again, 'counts'), false); assert.equal(Object.hasOwn(again, 'action'), false);
});
