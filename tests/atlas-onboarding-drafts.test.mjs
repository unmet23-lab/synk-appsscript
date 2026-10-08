import test from 'node:test';
import assert from 'node:assert/strict';
import { getOnboardingDraftBasis as basis } from '../experiences/atlas-lab/onboarding-drafts.mjs';

const AT = '2026-10-08T03:00:00.000Z', END = '2026-10-09T03:00:00.000Z';
const fixture = () => ({ accountId: 'synthetic-new-owner', status: 'active', paused: false, asOf: AT, revision: 1,
  profile: { nickname: '', region: '', intro: '', values: {}, required: [], expirations: {} },
  onboarding: { complete: false, steps: { profile: false, adult: false, consents: false }, missing: ['nickname', 'adult-self-declaration', 'consents'] },
  consents: { profilePublic: false, receiveInvitations: false, storePreferences: false },
  adult: { selfDeclared: false, verified: false, verification: { required: false, status: 'not-connected', validUntil: null, checkedAt: null, resumeRequired: false } },
  centralAvailability: null });
const changed = edit => { const view = fixture(), before = basis(view); edit(view); assert.notEqual(basis(view), before); };

test('a new account may preserve first signup input before adult declaration or any consent', () => {
  const view = fixture(); assert.equal(typeof basis(view), 'string');
  assert.deepEqual(view.consents, { profilePublic: false, receiveInvitations: false, storePreferences: false });
  assert.equal(view.adult.selfDeclared, false); assert.equal(view.onboarding.complete, false);
});

test('partial completion permits a fresh draft and invalidates a draft from the preceding step', () => {
  const view = fixture(), before = basis(view); view.profile.nickname = '가상 소연'; view.onboarding.steps.profile = true;
  const profileSaved = basis(view); assert.equal(typeof profileSaved, 'string'); assert.notEqual(profileSaved, before);
  view.adult.selfDeclared = true; view.onboarding.steps.adult = true;
  assert.equal(typeof basis(view), 'string'); assert.notEqual(basis(view), profileSaved);
});

test('explicitly confirming all false consents still invalidates the earlier unconfirmed draft', () => {
  const view = fixture(); view.profile.nickname = '가상 소연'; view.onboarding.steps.profile = true;
  view.adult.selfDeclared = true; view.onboarding.steps.adult = true; const before = basis(view);
  view.onboarding.steps.consents = true;
  assert.notEqual(basis(view), before); assert.ok(Object.values(view.consents).every(value => value === false));
  view.onboarding.complete = true; assert.equal(basis(view), null);
});

test('completed signup and missing or malformed progress cannot restore an old signup draft', () => {
  for (const edit of [view => { view.onboarding.complete = true; }, view => delete view.onboarding,
    view => { view.onboarding = []; }, view => delete view.onboarding.complete, view => { view.onboarding.complete = 'false'; },
    view => delete view.onboarding.steps, view => { view.onboarding.steps = []; },
    ...['profile', 'adult', 'consents'].flatMap(key => [view => delete view.onboarding.steps[key], view => { view.onboarding.steps[key] = 0; }])]) {
    const view = fixture(); edit(view); assert.equal(basis(view), null);
  }
});

test('each projected completed step independently invalidates a prior draft', () => {
  for (const key of ['profile', 'adult', 'consents']) changed(view => { view.onboarding.steps[key] = true; });
});

test('missing identity, inactive account or malformed profile prevents restoration', () => {
  for (const edit of [view => delete view.accountId, view => { view.accountId = ''; }, view => { view.accountId = ' '; },
    view => { view.accountId = 1; }, view => { view.status = 'suspended'; }, view => { view.status = 'deleted'; },
    view => delete view.profile, view => { view.profile = []; }, view => delete view.profile.intro,
    view => { view.profile.nickname = null; }, view => { view.profile.region = 123; },
    view => { view.profile.nickname = '이'.repeat(61); }, view => { view.profile.region = '가'.repeat(81); },
    view => { view.profile.intro = '가'.repeat(401); }, view => { view.profile.intro = '\u0001'; }]) {
    const view = fixture(); edit(view); assert.equal(basis(view), null);
  }
  for (const view of [undefined, null, [], 'view']) assert.equal(basis(view), null);
});

test('changing account identity invalidates the prior account draft', () => {
  changed(view => { view.accountId = 'another-synthetic-owner'; });
});

test('any saved basic profile change invalidates a draft without normalizing away raw differences', () => {
  for (const [key, value] of [['nickname', '소연'], ['region', '서울'], ['intro', '산책이 좋아요.']]) changed(view => { view.profile[key] = value; });
  const view = fixture(); view.profile.intro = '소개'; const before = basis(view); view.profile.intro = '소개 ';
  assert.notEqual(basis(view), before);
});

test('consent and pause transitions invalidate old input but allow new private signup drafts', () => {
  for (const key of ['profilePublic', 'receiveInvitations', 'storePreferences']) changed(view => { view.consents[key] = true; });
  const view = fixture(), before = basis(view); view.paused = true;
  assert.equal(typeof basis(view), 'string'); assert.notEqual(basis(view), before);
});

test('missing or nonboolean permission and adult flags cannot retain a draft', () => {
  for (const edit of [view => delete view.paused, view => delete view.consents, view => delete view.adult,
    view => { view.adult.selfDeclared = 'false'; }, view => delete view.adult.verified,
    view => delete view.adult.verification, view => delete view.adult.verification.required,
    view => { view.adult.verification.status = ''; }, view => delete view.adult.verification.resumeRequired,
    ...['profilePublic', 'receiveInvitations', 'storePreferences'].map(key => view => delete view.consents[key])]) {
    const view = fixture(); edit(view); assert.equal(basis(view), null);
  }
});

test('adult declaration, verification status, result, deadline and resume transitions invalidate drafts', () => {
  for (const edit of [view => { view.adult.selfDeclared = true; }, view => { view.adult.verified = true; },
    view => { view.adult.verification.required = true; }, view => { view.adult.verification.status = 'pending'; },
    view => { view.adult.verification.validUntil = END; }, view => { view.adult.verification.resumeRequired = true; }]) changed(edit);
});

test('verification expiry invalidates at the server time boundary, not an advancing clock alone', () => {
  const view = fixture(); view.adult.verification.validUntil = END; const before = basis(view);
  view.asOf = '2026-10-09T02:59:59.999Z'; assert.equal(basis(view), before);
  view.asOf = END; const expired = basis(view); assert.notEqual(expired, before);
  view.asOf = '2026-10-10T03:00:00.000Z'; assert.equal(basis(view), expired);
});

test('invalid server time or verification deadline prevents deadline-sensitive restoration', () => {
  for (const value of [undefined, null, 0, 'bad-date', '2026-10-08', '2026-02-30T03:00:00.000Z']) {
    const view = fixture(); view.asOf = value; assert.equal(basis(view), null);
  }
  for (const validUntil of [undefined, 0, 'bad-date', '2026-10-09']) {
    const view = fixture(); view.adult.verification.validUntil = validUntil; assert.equal(basis(view), null);
  }
});

test('blocked central access prevents restoration while a fresh active resume state remains scoped', () => {
  for (const status of ['suspended', 'deleted', 'unavailable', undefined]) {
    const view = fixture(); view.centralAvailability = { status, resumeRequired: false }; assert.equal(basis(view), null);
  }
  const view = fixture(), disconnected = basis(view); view.centralAvailability = { status: 'active', resumeRequired: false };
  const active = basis(view); assert.equal(typeof active, 'string'); assert.notEqual(active, disconnected);
  view.centralAvailability.resumeRequired = true; assert.equal(typeof basis(view), 'string'); assert.notEqual(basis(view), active);
});

test('malformed central availability cannot restore an editable draft', () => {
  for (const central of [[], 'active', { status: 'active' }, { status: 'active', resumeRequired: 'false' }]) {
    const view = fixture(); view.centralAvailability = central; assert.equal(basis(view), null);
  }
});

test('unrelated public answers, recommendations, revisions and read clocks preserve first input', () => {
  const view = fixture(), before = basis(view);
  view.revision = 20; view.asOf = '2026-10-08T04:00:00.000Z'; view.adult.verification.checkedAt = END;
  view.profile.values.availability = 'weekend'; view.profile.required = ['wants.contact']; view.profile.expirations['wants.contact'] = END;
  view.publicAnswers = { values: {}, expiredFields: ['wants.contact'] }; view.recommendationToken = 'fresh-receipt';
  view.candidates = [{ accountId: 'synthetic-peer' }]; view.discovery = { changes: true }; view.onboarding.missing = ['different-derived-order'];
  assert.equal(basis(view), before);
});

test('property order and central read sequence do not produce a new signup baseline', () => {
  const view = fixture(); view.centralAvailability = { status: 'active', resumeRequired: false, checkedAt: AT, sequence: 1 }; const before = basis(view);
  view.consents = { storePreferences: false, receiveInvitations: false, profilePublic: false };
  view.onboarding.steps = { consents: false, adult: false, profile: false };
  view.centralAvailability.sequence = 2; view.centralAvailability.checkedAt = END; view.centralAvailability.canResume = false;
  assert.equal(basis(view), before);
});

test('draft bookkeeping neither mutates the view nor reads private or unrelated recommendation state', () => {
  const view = fixture(), before = structuredClone(view);
  const freeze = value => { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } };
  freeze(view); assert.equal(typeof basis(view), 'string'); assert.deepEqual(view, before);
  const isolated = fixture();
  for (const key of ['discovery', 'preferences', 'experience', 'candidates', 'publicAnswers', 'recommendationToken'])
    Object.defineProperty(isolated, key, { get() { throw Error('unrelated state read'); } });
  for (const key of ['values', 'required', 'expirations']) Object.defineProperty(isolated.profile, key, { get() { throw Error('unrelated public state read'); } });
  assert.equal(typeof basis(isolated), 'string');
});
