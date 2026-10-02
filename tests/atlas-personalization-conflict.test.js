'use strict';
// Two devices editing the same profile: an edit made from an older copy is refused when the host
// names the revision it read (docs: 수정 충돌을 검사한다). Without it, behaviour is unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../atlas/personalization');
const at = '2026-10-02T00:00:00.000Z', later = '2026-10-02T00:01:00.000Z', latest = '2026-10-02T00:02:00.000Z';
const scope = { personId: 'person-1', productId: 'world', contextId: 'home', domain: 'LAB' };

test('an edit made from an older copy of the profile is refused, not written over', () => {
  const read = P.updateProfile(P.createProfile({ scope, at }), { consent: true, values: { goal: 'study' } }, at);
  // Device A saves first, from the copy both devices read.
  const saved = P.updateProfile(read, { values: { goal: 'work' }, expectedRevision: read.revision }, later);
  assert.equal(saved.revision, read.revision + 1);
  // Device B's edit was made from the same, now older copy.
  assert.throws(() => P.updateProfile(saved, { values: { goal: 'explore' }, expectedRevision: read.revision }, latest),
    error => error.code === 'PROFILE_CONFLICT');
  assert.equal(P.updateProfile(saved, { values: { goal: 'explore' }, expectedRevision: saved.revision }, latest).values.goal, 'explore');
});

test('the revision must be a whole number, and leaving it out keeps the old behaviour', () => {
  const read = P.updateProfile(P.createProfile({ scope, at }), { consent: true, values: { goal: 'study' } }, at);
  assert.throws(() => P.updateProfile(read, { values: {}, expectedRevision: '1' }, later), /invalid update/);
  assert.equal(P.updateProfile(read, { values: { goal: 'work' } }, later).values.goal, 'work');
  // Forgetting a profile never waits on a revision.
  assert.equal(P.clearProfile(read, { mode: 'delete', at: later }).status, 'deleted');
});
