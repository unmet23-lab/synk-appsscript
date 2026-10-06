import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import Travel from '../atlas/travel.js';

const AT = '2026-10-06T03:00:00Z';
function item(id = 'hotel', patch = {}) {
  return { id, kind: id, start: 600, end: 660, cost: { amount: 40000, currency: 'KRW', status: 'known' },
    walkMinutes: 10, requirements: { quiet: true },
    source: { kind: 'verified', checkedAt: '2026-10-06T00:00:00Z', validUntil: '2026-10-07T00:00:00Z' }, ...patch };
}
function input(items = [item()], patch = {}) {
  return { bundles: [{ id: 'seoul-a', items }], budget: 100000, currency: 'KRW', dayStart: 480, dayEnd: 1500,
    maxWalkMinutes: 60, requirements: [{ id: 'quiet', kind: 'hotel' }], lockedIds: [], excludedIds: [], at: AT, ...patch };
}
const evaluate = (items, patch) => Travel.evaluateBundles(input(items, patch));
const codes = result => result.reasons.map(reason => reason.code);

test('fresh feasible plan returns total extended prices without mutating input or retaining references', () => {
  const f = input([item(), item('meal', { start: 680, end: 740, requirements: {}, cost: { amount: 30000, currency: 'KRW', status: 'known' } })]);
  const before = structuredClone(f), r = Travel.evaluateBundles(f);
  assert.equal(r.feasible.length, 1);
  assert.deepEqual(r.feasible[0], { id: 'seoul-a', status: 'feasible', total: 70000, knownTotal: 70000, currency: 'KRW', walkMinutes: 20, reasons: [], demo: false });
  assert.deepEqual(f, before);
  r.feasible[0].reasons.push({ code: 'changed' });
  assert.deepEqual(f, before);
});

test('component prices within budget do not hide the bundle sum exceeding it', () => {
  const r = evaluate([item(), item('meal', { start: 680, end: 740 })], { budget: 70000 });
  assert.equal(r.rejected[0].total, 80000);
  assert.ok(codes(r.rejected[0]).includes('budget.exceeded'));
});

test('unknown cost remains null and is pending; known subtotal can independently reject', () => {
  const unknown = item('meal', { start: 680, end: 740, cost: { amount: null, currency: 'KRW', status: 'unknown' } });
  const r = evaluate([item(), unknown]);
  assert.equal(r.pending[0].total, null); assert.equal(r.pending[0].knownTotal, 40000);
  const rejected = evaluate([item(), unknown], { budget: 30000 }).rejected[0];
  assert.equal(rejected.total, null);
  assert.ok(codes(rejected).includes('budget.exceeded')); assert.ok(codes(rejected).includes('cost.unknown'));
});

test('explicit free items cost zero while absent or invented unknown amounts are invalid', () => {
  assert.equal(evaluate([item('park', { cost: { amount: 0, currency: 'KRW', status: 'known' } })], { requirements: [] }).feasible[0].total, 0);
  for (const cost of [{ currency: 'KRW', status: 'known' }, { amount: 0, currency: 'KRW', status: 'unknown' }, { amount: -1, currency: 'KRW', status: 'known' }]) {
    assert.throws(() => evaluate([item('bad', { cost })]), /invalid cost/);
  }
});

test('currency mismatch never adds foreign units to a won total', () => {
  const r = evaluate([item('meal', { cost: { amount: 30, currency: 'USD', status: 'known' } })], { requirements: [] });
  assert.equal(r.pending[0].total, null); assert.equal(r.pending[0].knownTotal, 0);
  assert.ok(codes(r.pending[0]).includes('cost.currency-unconverted'));
});

test('explicit hard condition failure rejects despite unknown facts or a low cost', () => {
  const r = evaluate([item('hotel', { requirements: { quiet: false }, cost: { amount: null, currency: 'KRW', status: 'unknown' } })]);
  assert.equal(r.rejected.length, 1); assert.equal(r.pending.length, 0);
  assert.ok(codes(r.rejected[0]).includes('requirement.failed'));
});

test('hard conditions stay pending when null, omitted, or their applicable kind is absent', () => {
  for (const requirements of [{ quiet: null }, {}]) {
    assert.ok(codes(evaluate([item('hotel', { requirements })]).pending[0]).includes('requirement.unknown'));
  }
  assert.ok(codes(evaluate([item('meal')]).pending[0]).includes('requirement.no-target'));
  const all = evaluate([item('hotel', { requirements: {} })], { requirements: ['quiet'] });
  assert.ok(codes(all.pending[0]).includes('requirement.unknown'));
});

test('all targeted items must satisfy a requirement; unrelated item needs no copied preference', () => {
  const meal = item('meal', { start: 670, end: 700, requirements: {} });
  assert.equal(evaluate([item(), meal]).feasible.length, 1);
  const secondHotel = item('hotel-b', { kind: 'hotel', start: 800, end: 900, requirements: { quiet: false } });
  assert.ok(codes(evaluate([item(), secondHotel]).rejected[0]).includes('requirement.failed'));
});

test('overlap is detected regardless of array order and adjacent intervals are allowed', () => {
  const first = item('meal', { start: 650, end: 700 });
  assert.ok(codes(evaluate([first, item()]).rejected[0]).includes('time.overlap'));
  assert.equal(evaluate([item('meal', { start: 660, end: 700 }), item()]).feasible.length, 1);
});

test('absolute minutes carry a midnight schedule into the next day and enforce the window', () => {
  const late = item('hotel', { start: 1410, end: 1470 });
  const after = item('meal', { start: 1470, end: 1500 });
  assert.equal(evaluate([late, after], { dayStart: 1380, dayEnd: 1500 }).feasible.length, 1);
  assert.ok(codes(evaluate([late, after], { dayStart: 1380, dayEnd: 1440 }).rejected[0]).includes('time.outside-day'));
});

test('walking limit sums all items and does not confuse travel duration with walking', () => {
  const r = evaluate([item(), item('taxi', { start: 670, end: 730, walkMinutes: 0 })], { maxWalkMinutes: 9 });
  assert.equal(r.rejected[0].walkMinutes, 10);
  assert.ok(codes(r.rejected[0]).includes('walking.exceeded'));
});

test('missing locked booking or a forbidden item rejects the plan', () => {
  assert.ok(codes(evaluate(undefined, { lockedIds: ['reserved-hotel'] }).rejected[0]).includes('lock.missing'));
  assert.ok(codes(evaluate(undefined, { excludedIds: ['hotel'] }).rejected[0]).includes('item.excluded'));
  assert.equal(evaluate(undefined, { lockedIds: ['hotel'] }).feasible.length, 1);
});

test('expired or future evidence is pending; fixtures require explicit opt-in and stay marked demo', () => {
  const expired = item('hotel', { source: { kind: 'verified', checkedAt: '2026-10-05T00:00:00Z', validUntil: AT } });
  assert.ok(codes(evaluate([expired]).pending[0]).includes('source.expired'));
  const future = item('hotel', { source: { kind: 'verified', checkedAt: '2026-10-06T04:00:00Z', validUntil: '2026-10-07T00:00:00Z' } });
  assert.ok(codes(evaluate([future]).pending[0]).includes('source.not-yet-checked'));
  const fixture = item(); fixture.source.kind = 'fixture';
  assert.ok(codes(evaluate([fixture]).pending[0]).includes('source.fixture-not-allowed'));
  assert.equal(evaluate([fixture], { allowFixtures: true }).feasible[0].demo, true);
  expired.source.kind = 'fixture';
  assert.equal(evaluate([expired], { allowFixtures: true }).pending.length, 1);
});

test('invalid schema, duplicate IDs, non-finite bounds and unsafe sums fail instead of fabricating results', () => {
  for (const patch of [{ budget: Infinity }, { budget: 1.5 }, { dayEnd: 1801 }, { dayStart: 1500 }, { allowFixtures: 'yes' },
    { at: '2026-10-06' }, { at: '2026-02-30T00:00:00Z' }, { at: '2026-10-06T24:00:00Z' },
    { unexpected: true }, { currency: 'USD' }, { requirements: [{ id: 'quiet' }] }, { lockedIds: ['x', 'x'] }]) {
    assert.throws(() => evaluate(undefined, patch), TypeError);
  }
  assert.throws(() => evaluate([item(), item()]), /duplicate item/);
  assert.throws(() => evaluate([item('hotel', { walkMinutes: 61 })]), /duration/);
  assert.throws(() => evaluate([item('hotel', { start: 660, end: 600 })]), /duration/);
  const a = item('hotel', { cost: { amount: Number.MAX_SAFE_INTEGER, currency: 'KRW', status: 'known' } });
  assert.throws(() => evaluate([a, item('meal', { start: 680, end: 740 })]), /safe integer/);
});

test('empty candidate list remains empty and browser UMD exports the same API', () => {
  assert.deepEqual(Travel.evaluateBundles(input([], { bundles: [] })), { version: Travel.VERSION, feasible: [], pending: [], rejected: [] });
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../atlas/travel.js', import.meta.url), 'utf8'), context);
  assert.equal(context.SynkAtlasTravel.VERSION, Travel.VERSION);
  assert.equal(typeof context.SynkAtlasTravel.evaluateBundles, 'function');
});
