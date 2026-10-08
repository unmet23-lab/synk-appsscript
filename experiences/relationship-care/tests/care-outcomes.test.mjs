import test from 'node:test';
import assert from 'node:assert/strict';
import { preparationSummary } from '../care-outcomes.mjs';
test('own feedback stays descriptive and a future-device backup cannot block the notebook', () => {
  const row = { id: 'p', shownAt: '2026-10-06T01:00:00Z', selectedAt: '2026-10-06T01:00:30Z', elapsedSeconds: 30, satisfaction: 5, satisfactionAt: '2026-10-06T01:01:00Z' };
  const state = { preparations: [row, { ...row, id: 'future', shownAt: '2027-10-06T01:00:00Z', selectedAt: null, elapsedSeconds: null, satisfaction: null, satisfactionAt: null }] };
  const copy = structuredClone(state), result = preparationSummary(state, '2026-10-06T02:00:00Z');
  assert.equal(result.selected, 1); assert.equal(result.averageSeconds, 30); assert.equal(result.averageSatisfaction, 5); assert.equal(result.excludedFuture, 1);
  assert.equal(result.causalClaim, false); assert.deepEqual(state, copy);
});
