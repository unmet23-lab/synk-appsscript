import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicProfilePreview } from '../experiences/atlas-lab/public-profile-preview.mjs';
import { projectPublicAnswers } from '../experiences/atlas-lab/public-profile.mjs';

const AT = '2026-10-08T03:00:00.000Z', END = '2026-10-09T03:00:00.000Z';
function fixture({ values = {}, required = [], expirations = {} } = {}) {
  const profile = { nickname: '가상 소연', region: '소개에 직접 적은 지역', intro: '산책하며 대화해요.',
    values: { availability: 'weekend', 'self.contact': 'daily', ...values }, required, expirations };
  return { status: 'active', mode: 'demo', synthetic: true, asOf: AT, profile, publicAnswers: projectPublicAnswers(profile, AT),
    consents: { profilePublic: true, receiveInvitations: false, storePreferences: false }, paused: false,
    adult: { selfDeclared: true, verified: false, verification: { required: false, status: 'not-connected', validUntil: null, checkedAt: null, resumeRequired: false } },
    centralAvailability: null };
}
const row = (preview, id) => preview.answers.find(item => item.field === id);
const verified = view => {
  view.mode = 'account'; view.synthetic = false;
  view.adult = { selfDeclared: true, verified: true, verification: { required: true, status: 'verified', validUntil: END, checkedAt: AT, resumeRequired: false } };
  return view;
};

test('saved public fields use canonical labels while private storage and invitations may both be off', () => {
  const preview = getPublicProfilePreview(fixture({ values: { 'wants.contact': 'few-days' }, required: ['wants.contact'] }));
  assert.equal(preview.status, 'ready'); assert.equal(preview.isPublic, true);
  assert.deepEqual(preview.profile, { nickname: '가상 소연', region: '소개에 직접 적은 지역', intro: '산책하며 대화해요.' });
  assert.deepEqual(row(preview, 'wants.contact'), { field: 'wants.contact', label: '상대에게 바라는 연락 빈도', valueLabel: '며칠에 한 번 여유 있게 연락해요', required: true, until: null });
  assert.match(preview.notice, /상대별 추천 순서나 소개 가능 여부는 달라질/);
});
test('private discovery, preferences and experience are never read or turned into public declarations', () => {
  const view = fixture();
  for (const field of ['discovery', 'preferences', 'experience', 'candidates']) Object.defineProperty(view, field, { get() { throw Error('private access'); } });
  assert.deepEqual(getPublicProfilePreview(view).answers.map(item => item.field), ['availability', 'self.contact']);
});
test('a valid independent deadline is displayed without deriving any private deadline', () => {
  const preview = getPublicProfilePreview(fixture({ expirations: { 'self.contact': END } }));
  assert.equal(row(preview, 'self.contact').until, END); assert.equal(row(preview, 'availability').until, null);
});
test('an expired required answer keeps its field and required status but never its old value', () => {
  const view = fixture({ values: { 'wants.contact': 'few-days' }, required: ['wants.contact'], expirations: { 'wants.contact': AT } });
  const preview = getPublicProfilePreview(view);
  assert.equal(row(preview, 'wants.contact'), undefined);
  assert.deepEqual(preview.expired, [{ field: 'wants.contact', label: '상대에게 바라는 연락 빈도', required: true }]);
  assert.deepEqual(preview.requiredUnknown, [{ field: 'wants.contact', label: '상대에게 바라는 연락 빈도', required: true }]);
  assert.doesNotMatch(JSON.stringify(preview), /며칠|few-days/);
});
test('the exact deadline is rechecked against asOf even when a supplied projection still contains its old value', () => {
  const view = fixture({ expirations: { 'self.contact': END } }); view.asOf = END;
  const preview = getPublicProfilePreview(view);
  assert.equal(row(preview, 'self.contact'), undefined); assert.equal(preview.expired[0].field, 'self.contact');
  assert.doesNotMatch(JSON.stringify(preview), /daily|하루에/);
});
test('server-filtered expired and withdrawn answers cannot be reconstructed from saved raw values', () => {
  const view = fixture(); view.publicAnswers.values = {}; view.publicAnswers.expiredFields = ['self.contact'];
  const preview = getPublicProfilePreview(view);
  assert.deepEqual(preview.answers, []); assert.deepEqual(preview.expired.map(item => item.field), ['self.contact']);
});
test('a projected value must also agree with the current saved public answer', () => {
  const view = fixture(); view.publicAnswers.values['self.contact'] = 'few-days'; view.publicAnswers.values['self.plan'] = 'planned';
  assert.deepEqual(getPublicProfilePreview(view).answers.map(item => item.field), ['availability']);
});
test('invalid enums, unknown fields, consent and invalid meeting-region sets are omitted', () => {
  const view = fixture({ values: { 'self.contact': 'secret free text', invented: 'secret', consent: true, 'self.meetingRegions': ['unknown'] } });
  const preview = getPublicProfilePreview(view);
  assert.deepEqual(preview.answers.map(item => item.field), ['availability']); assert.doesNotMatch(JSON.stringify(preview), /secret|invented|consent/);
});
test('meeting regions are labelled from explicit canonical choices and never inferred from the free-form region', () => {
  const preview = getPublicProfilePreview(fixture({ values: { 'self.meetingRegions': ['busan', 'seoul-center'] } }));
  assert.equal(row(preview, 'self.meetingRegions').valueLabel, '서울 도심 · 부산');
  const view = fixture(); view.profile.region = '서울 도심'; assert.equal(row(getPublicProfilePreview(view), 'self.meetingRegions'), undefined);
});
test('legacy public declarations retain their legacy label without inventing independent goal or speed', () => {
  const preview = getPublicProfilePreview(fixture({ values: { 'self.purpose': 'gradual' } }));
  assert.match(row(preview, 'self.purpose').label, /예전에 함께/);
  assert.equal(row(preview, 'self.relationshipGoal'), undefined); assert.equal(row(preview, 'self.relationshipSpeed'), undefined);
});
test('missing or malformed required public answers remain unknown instead of fulfilled or optional', () => {
  const view = fixture({ values: { 'wants.contact': 'invalid' }, required: ['wants.contact', 'self.contact', 'invented'] });
  const preview = getPublicProfilePreview(view);
  assert.deepEqual(preview.requiredUnknown.map(item => item.field), ['wants.contact']); assert.equal(row(preview, 'self.contact').required, false);
});
test('profile-public off and paused states show saved content with accurate non-public notices', () => {
  for (const [change, pattern] of [[view => { view.consents.profilePublic = false; }, /공개를 꺼/], [view => { view.paused = true; }, /쉬는 중/]]) {
    const view = fixture(); change(view); const preview = getPublicProfilePreview(view);
    assert.equal(preview.isPublic, false); assert.equal(preview.status, 'ready'); assert.match(preview.title, /저장한 공개용/);
    assert.match(preview.notice, pattern); assert.ok(preview.answers.length);
  }
});
test('self-declaration and server adult verification gates are preserved without inventing a new demo age requirement', () => {
  assert.equal(getPublicProfilePreview(verified(fixture())).isPublic, true);
  for (const change of [view => { view.adult.selfDeclared = false; }, view => { view.adult.verification.status = 'pending'; },
    view => { view.adult.verification.resumeRequired = true; }, view => { view.adult.verified = false; },
    view => { view.adult.verification.validUntil = AT; }, view => { view.adult.verification = undefined; }]) {
    const view = verified(fixture()); change(view); assert.equal(getPublicProfilePreview(view).isPublic, false);
  }
  assert.equal(getPublicProfilePreview(fixture()).isPublic, true);
});
test('central hold, required resume, and local suspension never claim public visibility', () => {
  for (const availability of [{ status: 'suspended', resumeRequired: true }, { status: 'active', resumeRequired: true }]) {
    const view = fixture(); view.centralAvailability = availability; assert.equal(getPublicProfilePreview(view).isPublic, false);
  }
  const active = fixture(); active.centralAvailability = { status: 'active', resumeRequired: false }; assert.equal(getPublicProfilePreview(active).isPublic, true);
  active.status = 'suspended'; assert.equal(getPublicProfilePreview(active).isPublic, false);
  const held = { status: 'active', centralAvailability: { status: 'suspended', resumeRequired: true } };
  assert.equal(getPublicProfilePreview(held).status, 'unavailable');
});
test('invalid public deadlines cannot be displayed as unlimited or current', () => {
  for (const until of ['tomorrow', '2026-10-09', false, 123, undefined]) {
    const view = fixture(); view.profile.expirations['self.contact'] = until;
    assert.equal(row(getPublicProfilePreview(view), 'self.contact'), undefined);
  }
});
test('missing server clock and malformed or deleted projections cannot certify public content', () => {
  for (const change of [view => { delete view.asOf; }, view => { view.asOf = 'today'; }, view => { view.status = 'deleted'; },
    view => { view.publicAnswers = null; }, view => { view.profile.values = null; }, view => { view.profile.nickname = ''; }]) {
    const view = fixture(); change(view); const preview = getPublicProfilePreview(view);
    assert.equal(preview.status, 'unavailable'); assert.equal(preview.isPublic, false); assert.equal(preview.profile, null); assert.deepEqual(preview.answers, []);
  }
});
test('the owner snapshot is never mutated, no device clock is used, and output changes do not modify the input', () => {
  const view = fixture({ values: { 'self.meetingRegions': ['busan'] } }), before = structuredClone(view), saved = Date.now;
  try {
    Date.now = () => { throw Error('device clock'); };
    const preview = getPublicProfilePreview(view); preview.profile.nickname = 'changed'; preview.answers[0].valueLabel = 'changed';
    assert.deepEqual(view, before); assert.equal(getPublicProfilePreview(view).profile.nickname, before.profile.nickname);
  } finally { Date.now = saved; }
});
test('accessors and inherited values cannot introduce executable or hidden public answers', () => {
  const view = fixture();
  Object.defineProperty(view.publicAnswers.values, 'self.plan', { get() { throw Error('not data'); } });
  Object.defineProperty(view.profile.values, 'self.plan', { get() { throw Error('not data'); } });
  assert.equal(row(getPublicProfilePreview(view), 'self.plan'), undefined);
  Object.defineProperty(view.profile.expirations, 'self.contact', { get() { throw Error('not a deadline'); } });
  assert.equal(row(getPublicProfilePreview(view), 'self.contact'), undefined);
  view.publicAnswers.values = Object.create({ 'self.plan': 'planned' });
  assert.equal(getPublicProfilePreview(view).status, 'unavailable');
});
