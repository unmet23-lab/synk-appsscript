'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const learning = require('../atlas/game-learning');
const { createLive } = require('../atlas/game-flow');
const map = require('../strata').createMap(require('../strata/maps/topik-i.json'));

const SPEC = { id: 'test.flow.idempotency', items: { levels: [1, 2, 3], weight: 2 }, knobs: [
  { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
] };
const item = (id = 'one', difficulty = 1) => ({ id, itemKey: `${id}:v1`, skillId: 'ko.listening.detail', difficulty,
  modality: 'listening', responseFormat: 'cup-compose', audioRequired: false });
function setup(options = {}) {
  const data = new Map(), writes = [];
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => { writes.push(k); data.set(k, String(v)); }, removeItem: k => data.delete(k) };
  let time = Date.parse('2026-10-02T09:00:00Z');
  const clock = () => new Date(time += 1000).toISOString();
  const coach = learning.createGame({ gameId: 'flow-idempotency', map, storage, clock, ...options });
  const live = coach.live(SPEC);
  const flowKey = `${learning.KEY}.device.flow`;
  const state = () => ({ settings: live.settings(), trace: live.trace(), raw: storage.getItem(flowKey), writes: writes.filter(k => k === flowKey).length });
  const attempts = () => coach.events().filter(e => e.type === 'practice.attempted');
  return { coach, live, storage, state, attempts };
}
const success = { correct: true, assessable: true, attemptNo: 1 };

test('Q5: six deliveries of one accepted attempt observe and save only once', () => {
  const f = setup(), pid = f.live.present(item());
  const first = f.live.answer(pid, success, { pressure: 0.3 });
  const before = f.state();
  for (let i = 0; i < 5; i += 1) {
    const duplicate = f.live.answer(pid, { ...success, correct: false }, { outcome: 'fail', pressure: 1.2 });
    assert.equal(duplicate.recorded.eventId, first.recorded.eventId);
    assert.equal(duplicate.evidence, false);
    assert.equal(duplicate.change, null);
    assert.equal(duplicate.line, null);
    assert.deepEqual(duplicate.settings, before.settings);
  }
  assert.equal(f.attempts().length, 1);
  assert.deepEqual(f.state(), before, 'a duplicate must not alter trace, memory timestamp, pending intent, or save count');
  assert.equal(before.trace.length, 1);
});

test('Q5: omitted attemptNo still makes retransmission idempotent', () => {
  const f = setup(), pid = f.live.present(item());
  const answer = { correct: true, assessable: true };
  f.live.answer(pid, answer);
  const before = f.state();
  for (let i = 0; i < 5; i += 1) f.live.answer(pid, answer);
  assert.equal(f.attempts().length, 1);
  assert.deepEqual(f.state(), before);
});

test('Q5: a new consecutive attempt is observed, then old attempts cannot replay it', () => {
  const f = setup(), pid = f.live.present(item());
  const first = f.live.answer(pid, { correct: false, assessable: true, attemptNo: 1 });
  const second = f.live.answer(pid, { ...success, attemptNo: 2 });
  assert.notEqual(first.recorded.eventId, second.recorded.eventId);
  assert.equal(f.attempts().length, 2);
  assert.equal(f.live.trace().length, 2);
  const before = f.state();
  f.live.answer(pid, { ...success, attemptNo: 2 });
  f.live.answer(pid, success);
  assert.deepEqual(f.state(), before);
});

test('Q5: fresh items retain the existing adaptive progression', () => {
  const f = setup();
  for (let i = 0; i < 10; i += 1) {
    const pid = f.live.present(item(`fresh-${i}`, f.live.settings().level));
    f.live.answer(pid, success, { pressure: 0.3 });
  }
  assert.equal(f.attempts().length, 10);
  assert.equal(f.live.trace().length, 10);
  assert.ok(f.live.settings().level > 1);
});

test('Q5: the same item presented again remains a legitimate repeat practice', () => {
  const f = setup();
  const first = f.live.answer(f.live.present(item()), success);
  const second = f.live.answer(f.live.present(item()), success);
  assert.notEqual(first.recorded.eventId, second.recorded.eventId);
  assert.equal(second.recorded.exposure, 'repeat');
  assert.equal(f.attempts().length, 2);
  assert.equal(f.live.trace().length, 2);
  assert.equal(f.live.trace()[1].repeat, true);
});

test('Q5: unknown presentations and rejected responses never observe or save', () => {
  const f = setup(), pid = f.live.present(item()), before = f.state();
  assert.throws(() => f.live.answer('missing-pid', success), /presentation ended|reset/);
  assert.throws(() => f.live.answer(pid, { correct: true }), /assessability/);
  assert.throws(() => f.live.answer(pid, { ...success, attemptNo: 3 }), /consecutive/);
  assert.deepEqual(f.state(), before);
  assert.equal(f.attempts().length, 0);
  f.live.answer(pid, success);
  assert.equal(f.live.trace().length, 1);
});

test('Q5: accepted unassessed attempts still permit an explicit game timeout', () => {
  const f = setup(), pid = f.live.present(item());
  const first = f.live.answer(pid, { correct: null, assessable: false, reason: 'audio' }, { outcome: 'timeout', pressure: 1.1 });
  assert.equal(first.evidence, true);
  assert.equal(f.live.trace()[0].outcome, 'timeout');
  const before = f.state();
  f.live.answer(pid, { correct: null, assessable: false, reason: 'audio' }, { outcome: 'timeout', pressure: 1.1 });
  assert.deepEqual(f.state(), before);
});

test('Q5: explicit non-Trail observations continue to count as separate game actions', () => {
  const f = setup();
  for (let i = 0; i < 3; i += 1) f.live.observe({ outcome: 'timeout', pressure: 1.2 });
  assert.equal(f.live.trace().length, 3);
  assert.equal(f.state().writes, 3);
  assert.equal(f.attempts().length, 0);
});

test('Q5: a coach result without an accepted event id cannot become Flow evidence', () => {
  for (const recorded of [null, undefined, false, {}, { accepted: false }]) {
    let saves = 0;
    const port = { epoch: () => null, memories: () => ({ contents: {} }), today: () => null, save: () => { saves += 1; } };
    const live = createLive({ coach: { present: () => 'pid', answer: () => recorded }, port, clock: () => '2026-10-02T09:00:00Z' })(SPEC);
    const pid = live.present(item()), before = live.settings();
    const response = live.answer(pid, success);
    assert.equal(response.recorded, recorded);
    assert.equal(response.evidence, false);
    assert.equal(response.change, null);
    assert.equal(response.line, null);
    assert.deepEqual(response.settings, before);
    assert.deepEqual(live.trace(), []);
    assert.equal(saves, 0);
  }
});

test('Q5: an invalid Flow observation can be corrected without losing the accepted attempt', () => {
  const f = setup(), pid = f.live.present(item());
  assert.throws(() => f.live.answer(pid, success, { pressure: 2 }), /invalid observation/);
  assert.equal(f.attempts().length, 1);
  assert.equal(f.live.trace().length, 0);
  f.live.answer(pid, success, { pressure: 0.3 });
  assert.equal(f.attempts().length, 1);
  assert.equal(f.live.trace().length, 1);
});

test('Q5: recreating live on the same coach cannot consume an earlier accepted event again', () => {
  const f = setup(), pid = f.live.present(item());
  const first = f.live.answer(pid, success);
  const other = f.coach.live(SPEC), before = f.state(), otherBefore = other.settings();
  const replay = other.answer(pid, success);
  assert.equal(replay.recorded.eventId, first.recorded.eventId);
  assert.equal(replay.evidence, false);
  assert.deepEqual(other.trace(), []);
  assert.deepEqual(other.settings(), otherBefore);
  assert.deepEqual(f.state(), before);
  const second = other.answer(pid, { ...success, attemptNo: 2 });
  assert.notEqual(second.recorded.eventId, first.recorded.eventId);
  assert.equal(other.trace().length, 1, 'the same pid still permits a new consecutive attempt');
  const after = f.state();
  f.live.answer(pid, { ...success, attemptNo: 2 });
  assert.deepEqual(f.state(), after, 'the original live also cannot recount the second event');
});

test('Q5: an attempt already accepted directly by the coach is not new Flow evidence', () => {
  const f = setup(), pid = f.live.present(item());
  const accepted = f.coach.answer(pid, success), before = f.state();
  const replay = f.live.answer(pid, success);
  assert.equal(replay.recorded.eventId, accepted.eventId);
  assert.equal(replay.evidence, false);
  assert.deepEqual(f.state(), before);
  assert.equal(f.attempts().length, 1);
});

test('Q5: folding an old attempt closes its presentation before it can be counted again', () => {
  const f = setup({ fold: { max: 90, keep: 60, ageMs: 0 } });
  const oldPid = f.live.present(item('old'));
  const old = f.live.answer(oldPid, success);
  for (let i = 0; i < 80; i += 1) f.live.answer(f.live.present(item(`fold-${i}`)), success);
  const stored = JSON.parse(f.storage.getItem(`${learning.KEY}.device`));
  assert.ok(stored.ledger?.folded > 0, 'this is a real fold, not a simulated missing event');
  assert.ok(!f.attempts().some(event => event.id === old.recorded.eventId));
  const before = f.state();
  assert.throws(() => f.live.answer(oldPid, success), /presentation ended|reset/);
  assert.deepEqual(f.state(), before);
});
