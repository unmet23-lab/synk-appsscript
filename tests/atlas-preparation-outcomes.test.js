const test = require('node:test');
const assert = require('node:assert/strict');
const Temper = require('../atlas/temper-outcomes');
const scope = { domain: 'SHIFT', workspace: 'care', purpose: 'my-preparation' }, subject = 'self';
const row = { id: 'a', scope, subject, shownAt: '2026-10-06T01:00:00Z', selectedAt: '2026-10-06T01:00:30Z', elapsedSeconds: 30, satisfaction: 4, satisfactionAt: '2026-10-06T02:00:00Z' };
const summarize = records => Temper.summarizePreparation({ scope, subject, records, asOf: '2026-10-06T03:00:00Z' });
test('describes actual preparation and explicit feedback, missing is never zero or failure', () => {
  const summary = summarize([row, { ...row, id: 'b', elapsedSeconds: 30, satisfaction: null, satisfactionAt: null }, { ...row, id: 'c', selectedAt: null, elapsedSeconds: null, satisfaction: null, satisfactionAt: null }]);
  assert.equal(summary.shown, 3); assert.equal(summary.selected, 2); assert.equal(summary.unselected, 1);
  assert.equal(summary.rated, 1); assert.equal(summary.unrated, 1); assert.equal(summary.averageSatisfaction, 4);
  assert.equal(summary.averageSeconds, 30); assert.equal(summary.relationshipQuality, null); assert.equal(summary.causalClaim, false);
  assert.equal(summarize([]).averageSatisfaction, null);
});
test('rejects foreign scopes, duplicate records and invented time or ratings', () => {
  assert.throws(() => summarize([{ ...row, subject: 'someone-else' }]), /foreign/);
  assert.throws(() => summarize([{ ...row, scope: { ...scope, workspace: 'other' } }]), /foreign/);
  assert.throws(() => summarize([row, row]), /duplicate/);
  assert.throws(() => summarize([{ ...row, elapsedSeconds: 31 }]), /duration/);
  assert.throws(() => summarize([{ ...row, satisfactionAt: null }]), /incomplete/);
  assert.throws(() => summarize([{ ...row, satisfactionAt: '2026-10-06T00:00:00Z' }]), /self-report/);
  assert.throws(() => summarize([{ ...row, satisfaction: 0 }]), /self-report/);
  assert.throws(() => summarize([{ ...row, shownAt: '2027-01-01T00:00:00Z' }]), /chronology/);
});
