import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

// Moved with the module from tests/atlas-trail-followup.test.js (2026-10-08).
const require = createRequire(import.meta.url);
const Trail = require('../care-followup.js');
const item = (id, dueOn, status = 'pending') => ({ id, title: 'Check the result', dueOn, status });

test('timeline sorts explicit plans and keeps done and dismissed apart', () => {
  const items = [item('later', '2026-03-01'), item('done', '2026-02-27', 'done'), item('today', '2026-02-28'), item('old', '2026-02-27'), item('dismissed', '2026-02-26', 'dismissed')];
  const original = JSON.stringify(items), result = Trail.summarize({ items, today: '2026-02-28' });
  assert.deepEqual(result.pending.map(row => [row.id, row.phase, row.daysUntil]), [['old', 'overdue', -1], ['today', 'today', 0], ['later', 'upcoming', 1]]);
  assert.equal(result.completed[0].id, 'done'); assert.equal(result.dismissed[0].id, 'dismissed');
  assert.equal(JSON.stringify(items), original);
  assert.equal(Trail.summarize({ items: [item('leap', '2028-03-01')], today: '2028-02-28' }).pending[0].daysUntil, 2);
});

test('preparing contact never marks it done; later, done and dismiss are explicit patches', () => {
  const followup = item('one', '2026-10-06'), options = { today: '2026-10-06' };
  assert.deepEqual(Trail.planAction(followup, { ...options, action: 'now' }), { version: Trail.VERSION, action: 'now', intent: 'prepare-contact', patch: null, completed: false });
  assert.deepEqual(Trail.planAction(followup, { ...options, action: 'later', dueOn: '2026-10-07' }).patch, { dueOn: '2026-10-07', status: 'pending' });
  assert.equal(Trail.planAction(followup, { ...options, action: 'done' }).completed, true);
  assert.deepEqual(Trail.planAction(followup, { ...options, action: 'dismiss' }).patch, { status: 'dismissed' });
  assert.equal(followup.status, 'pending');
  for (const dueOn of ['2026-10-06', '2026-10-05', '2026-02-30', '2200-01-01']) assert.throws(() => Trail.planAction(followup, { ...options, action: 'later', dueOn }));
  assert.throws(() => Trail.planAction({ ...followup, status: 'done' }, { ...options, action: 'now' }), /closed/);
  assert.throws(() => Trail.planAction(followup, { ...options, action: 'send' }), /action/);
});

test('ambiguous or invalid calendar inputs and duplicate records are rejected', () => {
  for (const input of ['2026-02-29', '2026-2-01', '1899-12-31', '2200-01-01', 'tomorrow', null]) assert.throws(() => Trail.date(input));
  assert.equal(Trail.date('2028-02-29'), Date.parse('2028-02-29T00:00:00Z'));
  assert.throws(() => Trail.summarize({ items: [item('one', '2026-10-06'), item('one', '2026-10-07')], today: '2026-10-06' }), /duplicate/);
  assert.throws(() => Trail.summarize({ items: [{ ...item('one', '2026-10-06'), status: 'sent' }], today: '2026-10-06' }));
});

test('browser entry works without a module loader or storage', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../care-followup.js'), 'utf8'), context);
  assert.equal(context.SynkTrailFollowup.VERSION, Trail.VERSION);
  assert.equal(context.SynkTrailFollowup.summarize({ items: [item('one', '2026-10-06')], today: '2026-10-06' }).pending[0].phase, 'today');
});

test('the version recorded in Care data stays the one stored before the move', () => {
  assert.equal(Trail.VERSION, 'trail-followup-1');
});
