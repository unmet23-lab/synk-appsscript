'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { TIME_BASES, normalizeHelpScope, normalizeTimeBounds, refineTimeBounds, classifyHelpTime } = require('./temporal-evidence.cjs');

const at = seconds => new Date(Date.UTC(2026, 8, 12, 0, 0, 0) + seconds * 1000).toISOString();
const bounds = (earliest, latest, sourceRef = 'synthetic/clock-calibration-1') => ({ earliestAt: at(earliest), latestAt: at(latest),
  basis: 'clock-calibration', sourceRef });
const utterance = { id: 'original', performanceInterval: { startedAt: at(10), endedAt: at(20) }, performanceTimeSource: 'browser-recorder' };
const classify = (earliest, latest) => classifyHelpTime({ id: 'help-1', at: at(999), timeBounds: bounds(earliest, latest) }, utterance);

test('supported help scopes are canonical, duplicate-free and input-order independent', () => {
  assert.deepEqual(normalizeHelpScope().skills, ['object', 'past']);
  for (const input of [['past', 'object'], ['object', 'past'], ['past', 'object', 'past']]) {
    const result = normalizeHelpScope(input);
    assert.equal(result.status, 'known');
    assert.deepEqual(result.skills, ['object', 'past']);
    assert.deepEqual(result.rawSkills, input);
    assert.notEqual(result.rawSkills, input);
  }
  assert.deepEqual(normalizeHelpScope(['past', 'all', 'object']).skills, ['all']);
});

test('unmapped, mixed, empty and malformed help scopes never silently become unrelated', () => {
  for (const input of [['unmapped-skill'], ['object', 'unmapped-skill'], [], null, 'past', {}, [null], [1], ['asr']]) {
    const result = normalizeHelpScope(input);
    assert.equal(result.status, 'unknown');
    assert.deepEqual(result.skills, ['all']);
    assert.deepEqual(result.rawSkills, input);
    assert.equal(result.reasonCode, 'help-scope-unrecognized');
  }
});

test('normalization retains explicit source provenance and normalizes equivalent timezones', () => {
  for (const basis of TIME_BASES) {
    const raw = { earliestAt: '2026-09-12T09:00:01+09:00', latestAt: '2026-09-12T09:00:02.5+09:00', basis, sourceRef: '  source-A  ' };
    const result = normalizeTimeBounds(raw);
    assert.deepEqual(result, { earliestAt: at(1), latestAt: at(2.5), basis, sourceRef: 'source-A' });
    assert.equal(raw.sourceRef, '  source-A  ');
  }
});

test('unproven, nonfinite, reversed and calendar-invalid bounds are rejected', () => {
  const good = bounds(1, 2);
  for (const bad of [null, [], {}, { ...good, earliestAt: 0 }, { ...good, latestAt: 'not-a-time' },
    { ...good, basis: 'automatic-truth' }, { ...good, sourceRef: '' }, { ...good, sourceRef: null },
    { ...good, earliestAt: '2026-02-30T00:00:00Z' }, { ...good, earliestAt: '2026-09-12T00:00:01' },
    { ...good, latestAt: '2026-09-12T00:00:02.9999Z' }, { ...good, latestAt: '2026-09-12T24:00:00Z' },
    { ...good, latestAt: '2026-09-12T00:00:02+24:00' }, bounds(2, 1)]) {
    assert.throws(() => normalizeTimeBounds(bad), { name: /TypeError|RangeError/ });
  }
  assert.equal(normalizeTimeBounds({ ...good, earliestAt: '2024-02-29T00:00:00Z' }).earliestAt, '2024-02-29T00:00:00.000Z');
});

test('fixed-capture boundary oracle distinguishes guaranteed overlap from ambiguity', () => {
  const oracle = [
    [-5, -1, 'before'], [9, 9.999, 'before'], [10, 10, 'overlap'], [20, 20, 'overlap'],
    [10, 20, 'overlap'], [12, 18, 'overlap'], [20.001, 21, 'after'],
    [9, 10, 'unknown'], [9, 11, 'unknown'], [19, 21, 'unknown'], [20, 21, 'unknown'],
    [9, 21, 'unknown'],
  ];
  for (const [earliest, latest, relation] of oracle) {
    const result = classify(earliest, latest);
    assert.equal(result.relation, relation, `${earliest}..${latest}`);
    assert.equal(result.helpBounds.basis, 'clock-calibration');
    assert.equal(result.helpBounds.sourceRef, 'synthetic/clock-calibration-1');
    assert.equal(result.performanceBounds.sourceRef, 'original');
    assert.equal(result.comparisons.latestHelpMinusStartMs, Math.round((latest - 10) * 1000));
  }
});

test('classification is invariant to receive order and does not substitute later upload time', () => {
  const first = { id: 'help-1', at: at(99), sequence: 1, timeBounds: bounds(7, 9) };
  const late = { ...first, at: at(999), sequence: 50 };
  const uploadedLater = { ...utterance, at: at(1000), sequence: 100 };
  assert.deepEqual(classifyHelpTime(first, utterance), classifyHelpTime(late, uploadedLater));
  assert.equal(classifyHelpTime(late, uploadedLater).relation, 'before');
});

test('legacy point times remain supported, and invalid declared bounds never fall back to a point', () => {
  assert.equal(classifyHelpTime({ id: 'h-point', at: at(9) }, utterance).relation, 'before');
  assert.equal(classifyHelpTime({ id: 'h-point', at: at(10) }, utterance).relation, 'overlap');
  assert.equal(classifyHelpTime({ id: 'h-point', at: at(21) }, utterance).relation, 'after');
  const invalid = classifyHelpTime({ id: 'h-bad', at: at(21), timeBounds: null }, utterance);
  assert.equal(invalid.relation, 'unknown');
  assert.equal(invalid.reasonCode, 'help-time-invalid');
  assert.equal(classifyHelpTime({ at: 'yesterday' }, utterance).relation, 'unknown');
});

test('missing or invalid capture interval stays unknown; upload timestamp provides no interval', () => {
  const help = { at: at(1) };
  for (const target of [null, {}, { at: at(10) }, { performanceInterval: {} },
    { performanceInterval: { startedAt: at(20), endedAt: at(10) } },
    { performanceInterval: { startedAt: at(10), endedAt: 'unknown' } }]) {
    assert.equal(classifyHelpTime(help, target).relation, 'unknown');
  }
});

test('refinement permits subset and same bounds while preserving the new explicit source', () => {
  const previous = bounds(9, 21, 'source-wide');
  for (const [start, end] of [[9, 21], [10, 20], [9, 9], [21, 21], [11, 15]]) {
    const next = bounds(start, end, 'source-reviewed');
    assert.deepEqual(refineTimeBounds(previous, next), next);
  }
  assert.equal(previous.sourceRef, 'source-wide');
  for (const next of [bounds(8, 21), bounds(9, 22), bounds(8, 22), bounds(22, 23), bounds(1, 2)]) {
    assert.throws(() => refineTimeBounds(previous, next), RangeError);
  }
});

test('refining unknown bounds can resolve before, during or after without claiming which occurred', () => {
  const previous = bounds(9, 21);
  assert.equal(classify(9, 21).relation, 'unknown');
  for (const [start, end, relation] of [[9, 9.5, 'before'], [10, 20, 'overlap'], [20.5, 21, 'after']]) {
    const next = refineTimeBounds(previous, bounds(start, end, `review-${relation}`));
    assert.equal(classifyHelpTime({ timeBounds: next }, utterance).relation, relation);
  }
});

test('enumerated possible event instants independently validate every asserted relation', () => {
  // The oracle enumerates each possible integer event instant, rather than
  // calling the implementation or using its endpoint inequalities.
  for (let low = 7; low <= 23; low++) for (let high = low; high <= 23; high++) {
    const possibleLabels = new Set();
    for (let instant = low; instant <= high; instant++) {
      possibleLabels.add(instant < 10 ? 'before' : instant > 20 ? 'after' : 'overlap');
    }
    const expected = possibleLabels.size === 1 ? [...possibleLabels][0] : 'unknown';
    assert.equal(classify(low, high).relation, expected, `${low}..${high}`);
  }
});

test('subset refinements preserve previously established relations across all interval endpoints', () => {
  let checked = 0;
  for (let low = 7; low <= 23; low++) for (let high = low; high <= 23; high++) {
    const before = classify(low, high).relation;
    if (before === 'unknown') continue;
    for (let nextLow = low; nextLow <= high; nextLow++) for (let nextHigh = nextLow; nextHigh <= high; nextHigh++) {
      const refined = refineTimeBounds(bounds(low, high), bounds(nextLow, nextHigh));
      assert.equal(classifyHelpTime({ timeBounds: refined }, utterance).relation, before);
      checked++;
    }
  }
  assert.equal(checked, 1031);
});
