import test from 'node:test';
import assert from 'node:assert/strict';
import { getProfileEditingBasis } from '../experiences/atlas-lab/profile-editing-drafts.mjs';
import { DISCOVERY_FIELDS } from '../experiences/atlas-lab/discovery.mjs';

const AT = '2026-10-08T03:00:00.000Z', END = '2026-10-09T03:00:00.000Z';
const fixture = () => ({ accountId: 'synthetic-draft-owner', status: 'active', paused: false, asOf: AT, revision: 1,
  profile: { nickname: '가상 소연', region: '서울', intro: '산책하며 대화해요.',
    values: { availability: 'weekend', 'self.contact': 'daily', 'wants.contact': 'daily' }, required: ['wants.contact'], expirations: {} },
  publicAnswers: { values: { availability: 'weekend', 'self.contact': 'daily', 'wants.contact': 'daily' }, required: ['wants.contact'], expiredFields: [] },
  consents: { profilePublic: true, receiveInvitations: true, storePreferences: true },
  adult: { selfDeclared: true, verified: false, verification: { required: false, status: 'not-connected', validUntil: null, checkedAt: null, resumeRequired: false } },
  centralAvailability: null });
const basis = (view, key = 'self.contact') => getProfileEditingBasis(view, key);
const changed = (edit, key = 'self.contact') => { const view = fixture(), before = basis(view, key); edit(view); assert.notEqual(basis(view, key), before); };
const stable = (edit, key = 'self.contact') => { const view = fixture(), before = basis(view, key); edit(view); assert.equal(basis(view, key), before); };

test('basic profile and every current public field have distinct editing scopes', () => {
  const view = fixture(), keys = ['profile', ...DISCOVERY_FIELDS.filter(field => !field.legacy && field.id !== 'consent').map(field => field.id)];
  const results = keys.map(key => basis(view, key));
  assert.ok(results.every(value => typeof value === 'string')); assert.equal(new Set(results).size, keys.length);
});
test('unknown keys and the private discovery consent field cannot hold public drafts', () => {
  for (const key of ['consent', 'unknown', '__proto__', 'constructor', null, undefined, {}]) assert.equal(getProfileEditingBasis(fixture(), key), null);
});
test('legacy fields can only preserve an answer that is still present in the owner profile', () => {
  const view = fixture(); assert.equal(basis(view, 'self.purpose'), null);
  view.profile.values['self.purpose'] = 'serious'; assert.equal(typeof basis(view, 'self.purpose'), 'string');
  delete view.profile.values['self.purpose']; assert.equal(basis(view, 'self.purpose'), null);
});
test('missing identity, profile, active state or adult declaration disallows restoration', () => {
  for (const edit of [view => delete view.accountId, view => { view.accountId = ''; }, view => delete view.profile,
    view => { view.profile = []; }, view => { view.status = 'suspended'; }, view => { view.status = 'deleted'; },
    view => { view.adult.selfDeclared = false; }, view => delete view.adult]) {
    const view = fixture(); edit(view); assert.equal(basis(view), null); assert.equal(basis(view, 'profile'), null);
  }
});
test('an unavailable or deleted central account cannot retain an editable draft', () => {
  for (const status of ['suspended', 'deleted', 'unavailable', undefined]) {
    const view = fixture(); view.centralAvailability = { status, resumeRequired: true }; assert.equal(basis(view), null);
  }
});
test('account switching invalidates both basic profile and public field drafts', () => {
  for (const key of ['profile', 'self.contact']) changed(view => { view.accountId = 'another-synthetic-account'; }, key);
});
test('pause transitions invalidate previous drafts but allow fresh editing while paused', () => {
  const view = fixture(), before = basis(view); view.paused = true;
  assert.equal(typeof basis(view), 'string'); assert.notEqual(basis(view), before);
});
test('each consent transition invalidates old drafts without blocking fresh private-storage-off editing', () => {
  for (const consent of ['profilePublic', 'receiveInvitations', 'storePreferences']) {
    const view = fixture(), before = basis(view); view.consents[consent] = false;
    assert.equal(typeof basis(view), 'string'); assert.notEqual(basis(view), before);
  }
});
test('consent property insertion order does not invalidate an unchanged draft', () => {
  stable(view => { view.consents = { storePreferences: true, receiveInvitations: true, profilePublic: true }; });
});
test('adult verification status, scope, result, deadline and resume changes invalidate drafts', () => {
  for (const edit of [view => { view.adult.verification.status = 'verified'; }, view => { view.adult.verification.required = true; },
    view => { view.adult.verified = true; }, view => { view.adult.verification.validUntil = END; },
    view => { view.adult.verification.resumeRequired = true; }]) changed(edit);
});
test('adult verification expiry uses server time and changes basis exactly at the boundary', () => {
  const view = fixture(); view.adult.verification.validUntil = END; const before = basis(view);
  view.asOf = '2026-10-09T02:59:59.999Z'; assert.equal(basis(view), before);
  view.asOf = END; assert.notEqual(basis(view), before);
});
test('central resume changes invalidate old drafts while an active account may be edited', () => {
  const view = fixture(); view.centralAvailability = { status: 'active', resumeRequired: false, sequence: 1 }; const before = basis(view);
  view.centralAvailability.resumeRequired = true; assert.equal(typeof basis(view), 'string'); assert.notEqual(basis(view), before);
});
test('same-field edits, withdrawals, required status and deadlines invalidate only that field source', () => {
  for (const edit of [view => { view.profile.values['self.contact'] = 'few-days'; }, view => { delete view.profile.values['self.contact']; },
    view => { view.profile.required.push('self.contact'); }, view => { view.profile.expirations['self.contact'] = END; }]) {
    changed(edit); stable(edit, 'profile'); stable(edit, 'availability');
  }
});
test('public answer expiry invalidates a draft even before the projected expired list refreshes', () => {
  const view = fixture(); view.profile.expirations['self.contact'] = END; const before = basis(view);
  view.asOf = '2026-10-09T02:59:59.999Z'; assert.equal(basis(view), before);
  view.asOf = END; assert.notEqual(basis(view), before);
});
test('a server projected expiry invalidates that public draft but no unrelated or basic profile draft', () => {
  const edit = view => { view.publicAnswers.expiredFields = ['self.contact']; };
  changed(edit); stable(edit, 'profile'); stable(edit, 'availability');
});
test('basic profile source changes invalidate the basic draft but preserve unrelated public drafts', () => {
  for (const [key, value] of [['nickname', '가상 민지'], ['region', '부산'], ['intro', '다른 소개']]) {
    const edit = view => { view.profile[key] = value; }; changed(edit, 'profile'); stable(edit);
  }
});
test('one public field changing does not discard another public draft', () => {
  stable(view => { view.profile.values.availability = 'weekday'; view.profile.required.push('availability'); view.profile.expirations.availability = END; });
});
test('server clock, checkedAt, revision, central sequence and recommendations alone are stable', () => {
  for (const key of ['profile', 'self.contact']) stable(view => {
    view.asOf = '2026-10-08T04:00:00.000Z'; view.revision = 10; view.adult.verification.checkedAt = END;
    view.recommendationToken = 'new-token'; view.candidates = [{ id: 'changed' }]; view.discovery = { unrelated: true };
  }, key);
  const view = fixture(); view.centralAvailability = { status: 'active', resumeRequired: false, sequence: 1, checkedAt: AT }; const before = basis(view);
  view.centralAvailability.sequence = 2; view.centralAvailability.checkedAt = END; assert.equal(basis(view), before);
});
test('expired answers stay stable as server time advances after the same boundary', () => {
  const view = fixture(); view.profile.expirations['self.contact'] = AT; const before = basis(view); view.asOf = END; assert.equal(basis(view), before);
});
test('an unverifiable server time cannot restore a deadline-sensitive draft', () => {
  for (const asOf of [undefined, null, 'not-a-date', 0]) { const view = fixture(); view.asOf = asOf; assert.equal(basis(view), null); }
});
test('reading draft sources leaves the view unchanged and does not read private recommendation state', () => {
  const view = fixture(), before = structuredClone(view);
  const freeze = value => { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } };
  freeze(view); basis(view); basis(view, 'profile'); assert.deepEqual(view, before);
  const isolated = fixture();
  for (const key of ['discovery', 'preferences', 'experience', 'candidates']) Object.defineProperty(isolated, key, { get() { throw Error('private state read'); } });
  assert.equal(typeof basis(isolated), 'string'); assert.equal(typeof basis(isolated, 'profile'), 'string');
});
