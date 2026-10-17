'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const { summarizeAccount, SCOPE } = require('../atlas/account-summary');
const { summarizeMemberActivity } = require('../atlas/member-activity');
const { bounds, activeDays } = require('../atlas/trail-periods');
const map = createMap(require('../strata/maps/topik-i.json'));
const asOf = '2026-10-14T12:00:00.000Z';
const DAY = 86400000;
const ago = days => new Date(Date.parse(asOf) - days * DAY).toISOString();
let sequence = 0;
const event = (appId, at) => ({ id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`, appId, at });
const document = (events = [], favorites = [], extra = {}) => ({ version: 1, consent: true, enabledAt: ago(61), events, favorites, ...extra });
const activity = doc => summarizeMemberActivity({ document: doc, asOf });
function practiceLog() {
  let serial = 0;
  const events = [];
  const add = (type, at, fields) => { const row = { schema: 1, id: `p${++serial}`, scope: { ...SCOPE }, at, recordedAt: at, type, ...fields }; events.push(row); return row; };
  const answer = (at, options = {}) => {
    const decision = add('decision.made', at, {});
    const p = add('practice.presented', at, { decisionId: decision.id, taskId: 'test-task', taskVersion: 'v1', itemKey: options.item || `item-${serial}`,
      conceptIds: ['ko.reading.vocabulary'], firstExposure: true });
    if (options.help) add('practice.helped', at, { presentationId: p.id, helpId: 'hint', level: 'cue', contentRef: 'hint-v1' });
    return add('practice.attempted', at, { presentationId: p.id, attemptNo: 1, verdict: options.verdict || 'correct', errorTags: [], ...options.recordedAt ? { recordedAt: options.recordedAt } : {} });
  };
  return { events, add, answer, summary: () => summarizeAccount({ events, map, asOf }) };
}

test('consent disabled reveals neither stale observations nor favorites', () => {
  const result = activity(document([event('pulse', ago(1))], ['path'], { consent: false }));
  assert.equal(result.availability, 'disabled');
  assert.equal(result.enabledAt, null);
  assert.deepEqual(result.interests, []);
  assert.deepEqual(result.activities, []);
  assert.equal(result.periods.recent.observations, 0);
  assert.equal(result.periods.delta, null);
});

test('only app-opening metadata is accepted; unknown apps and private extra fields fail closed', () => {
  for (const row of [{ ...event('world', ago(1)), text: 'private note' }, event('customer-project', ago(1)), { ...event('path', ago(1)), id: 'user-name' }]) {
    assert.throws(() => activity(document([row])), /invalid authorized document/);
  }
  assert.throws(() => activity({ ...document(), customerId: 'unrelated' }), /invalid authorized document/);
  assert.throws(() => activity(document([], ['path', 'path'])), /invalid authorized document/);
  assert.throws(() => activity(document([], [], { enabledAt: null })), /ISO UTC time required/);
});

test('equal time windows partition boundary events exactly once and omit future or old-consent events', () => {
  const { recent, previous } = bounds(asOf);
  const result = activity(document([
    event('world', previous.from), event('world', previous.to), event('path', recent.to),
    event('pulse', ago(-1)), event('messenger', ago(62)),
  ]));
  assert.equal(result.periods.recent.observations, 1);
  assert.equal(result.periods.previous.observations, 1);
  assert.equal(result.periods.sufficient, true);
  assert.deepEqual(result.periods.delta, { observations: 0, activeDays: 0 });
  assert.deepEqual(result.interests.map(row => row.id), ['path', 'world']);
  assert.ok(!JSON.stringify(result).includes('00000000-'), 'event IDs do not leave the projection');
});

test('partial consent coverage preserves actual counts but never invents a complete comparison', () => {
  const result = activity(document([event('path', ago(31)), event('pulse', ago(2)), event('world', ago(59))], [], { enabledAt: ago(40) }));
  assert.equal(result.periods.previous.observations, 1);
  assert.equal(result.periods.recent.observations, 1);
  assert.equal(result.periods.sufficient, false);
  assert.equal(result.periods.delta, null);
  assert.match(result.periods.reason, /모두 확인할 수 없어요/);
  const empty = activity(document([event('path', ago(1))]));
  assert.equal(empty.periods.previous.observations, 0);
  assert.equal(empty.periods.delta, null);
});

test('an idempotent opening counts once; conflicting reuse cannot silently alter evidence', () => {
  const row = event('path', ago(1));
  assert.equal(activity(document([row, { ...row }])).periods.recent.observations, 1);
  assert.throws(() => activity(document([row, { ...row, appId: 'pulse' }])), /invalid authorized document/);
  assert.throws(() => activity(document([row, { ...row, at: ago(2) }])), /invalid authorized document/);
});

test('retention-cap truncation inside either window never becomes a complete comparison', () => {
  const rows = Array.from({ length: 2000 }, (_, index) => event(index ? 'path' : 'world', index ? new Date(Date.parse(ago(1)) + index).toISOString() : ago(40)));
  const result = activity(document(rows, [], { enabledAt: ago(90) }));
  assert.equal(result.periods.previous.observations, 1);assert.equal(result.periods.recent.observations, 1999);
  assert.equal(result.periods.sufficient, false);assert.equal(result.periods.delta, null);
  rows[0].at=ago(70);rows[1].at=ago(40);
  const covered=activity(document(rows, [], { enabledAt: ago(90) }));
  assert.equal(covered.periods.sufficient, true, 'a cap with an older tail still covers the complete comparison window');
});

test('explicit favorites remain separate from observations and do not add event counts', () => {
  const input = document([event('world', ago(1)), event('world', ago(2)), event('messenger', ago(4))], ['path', 'pulse']);
  const before = JSON.stringify(input), result = activity(input);
  assert.equal(JSON.stringify(input), before, 'the authorized source is immutable');
  assert.equal(result.periods.recent.observations, 3);
  assert.equal(result.interests.length, 4);
  assert.equal(result.activities.length, 3);
  assert.deepEqual(result.interests.slice(0, 2).map(row => [row.id, row.kind, row.recentCount, row.lastAt]), [['path', 'favorite', 0, null], ['pulse', 'favorite', 0, null]]);
  assert.deepEqual(result.activities.map(row => [row.targetId, row.basis]), [['path', 'self-declared'], ['pulse', 'self-declared'], ['world', 'observed']]);
  assert.match(result.interests.find(row => row.kind === 'opened').detail, /완료나 좋아하는 정도를 뜻하지/);
  assert.ok(result.activities.every(row => !Object.hasOwn(row, 'url')));
});

test('active dates use Korean calendar boundaries independent of the machine timezone', () => {
  assert.equal(activeDays([{ at: '2026-10-01T14:59:00.000Z' }, { at: '2026-10-01T15:01:00.000Z' }]), 2);
  assert.equal(activeDays([{ at: '2026-10-01T15:01:00.000Z' }, { at: '2026-10-02T14:59:00.000Z' }]), 1);
});

test('practice periods retain full-history exposure rules before grouping equal windows', () => {
  const log = practiceLog();
  log.answer(ago(65), { item: 'same-family' });
  log.answer(ago(31), { verdict: 'incorrect' });
  log.answer(ago(2), { item: 'same-family' });
  log.answer(ago(1), { help: true });
  const summary = log.summary(), periods = summary.practice.periods;
  assert.equal(summary.practice.answered, 4, 'the original cumulative view is preserved');
  assert.equal(periods.previous.answered, 1);
  assert.equal(periods.previous.independent, 1, 'a wrong first answer remains independent evidence');
  assert.equal(periods.recent.answered, 2);
  assert.equal(periods.recent.independent, 0, 'earlier exposure outside both windows still prevents independence');
  assert.equal(periods.recent.assisted, 1);
  assert.deepEqual(periods.delta, { answered: 1, independent: -1, assisted: 1, activeDays: 1 });
  assert.match(periods.reason, /실력 성장이나 학습 효과를 뜻하지/);
});

test('practice comparison obeys exclusion, late arrival, future time and exact boundaries', () => {
  const log = practiceLog();
  log.answer(ago(60));
  log.answer(ago(30));
  const removed = log.answer(ago(2));
  log.add('record.excluded', ago(1), { targetId: removed.id });
  log.answer(ago(1), { recordedAt: ago(-1) });
  log.answer(ago(-1));
  log.answer(asOf);
  const periods = log.summary().practice.periods;
  assert.equal(periods.previous.answered, 1, '(from,to] includes the shared boundary only in previous');
  assert.equal(periods.recent.answered, 1, 'only the visible, unexcluded asOf attempt remains');
  assert.equal(periods.delta.answered, 0);
});

test('no previous practice does not become zero-based growth', () => {
  const log = practiceLog();
  log.answer(ago(1));
  const periods = log.summary().practice.periods;
  assert.equal(periods.recent.answered, 1);
  assert.equal(periods.previous.answered, 0);
  assert.equal(periods.sufficient, false);
  assert.equal(periods.delta, null);
});

test('existing Trail timestamps with offsets and no milliseconds remain valid for period summaries', () => {
  const log = practiceLog();
  log.answer('2026-09-10T21:00:00+09:00');
  log.answer('2026-10-10T12:00:00Z');
  const periods = log.summary().practice.periods;
  assert.equal(periods.previous.answered, 1);
  assert.equal(periods.recent.answered, 1);
  assert.equal(periods.sufficient, true);
  assert.equal(periods.delta.answered, 0);
});
