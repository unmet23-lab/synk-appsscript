'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const learning = require('../atlas/game-learning');
const map = require('../strata').createMap(require('../strata/maps/topik-i.json'));

function setup() {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
  let time = Date.parse('2026-10-02T09:00:00Z');
  const coach = learning.createGame({ gameId: 'flow-assessability', map, storage, clock: () => new Date(time += 1000).toISOString() });
  const live = coach.live({ id: 'test.flow.assessability', items: { levels: [1, 2, 3], weight: 2 },
    knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 }] });
  let next = 0;
  const present = (audio, confounded = false) => {
    const id = `item-${next++}`;
    const pid = live.present({ id, itemKey: `${id}:v1`, skillId: 'ko.listening.detail', difficulty: live.settings().level,
      modality: 'listening', responseFormat: 'cup-compose', audioRequired: true, confounded });
    coach.delivery(pid, { audio });
    return pid;
  };
  return { coach, live, present };
}

for (const correct of [true, false]) {
  for (const scenario of [
    { name: 'audio failed, caller also reports unassessable', audio: 'failed', assessable: false },
    { name: 'audio failed, caller incorrectly reports assessable', audio: 'failed', assessable: true },
    { name: 'audio completed but response is unassessable', audio: 'completed', assessable: false },
    { name: 'visual confound overrides caller assessability', audio: 'completed', assessable: true, confounded: true },
  ]) {
    test(`Flow uses recorded verdict: ${scenario.name}, correct=${correct}`, () => {
      const { live, present } = setup(), before = live.settings();
      for (let i = 0; i < 6; i += 1) {
        const r = live.answer(present(scenario.audio, scenario.confounded), { correct, assessable: scenario.assessable }, { pressure: 0.3 });
        assert.equal(r.recorded.verdict, 'unassessed');
        assert.equal(r.evidence, false, 'unassessed is not success or failure evidence for automatic adaptation');
        assert.equal(r.change, null);
      }
      assert.deepEqual(live.settings(), before);
      assert.equal(live.trace().length, 6);
      assert.ok(live.trace().every(row => row.outcome === 'void'));
    });
  }
}

test('assessed correct and incorrect answers retain adaptive outcomes', () => {
  for (const correct of [true, false]) {
    const { live, present } = setup();
    for (let i = 0; i < 6; i += 1) {
      const r = live.answer(present('completed'), { correct, assessable: true }, { pressure: 0.3 });
      assert.equal(r.recorded.verdict, correct ? 'correct' : 'incorrect');
      assert.equal(r.evidence, true);
    }
    assert.ok(live.trace().every(row => row.outcome === (correct ? 'success' : 'fail')));
    if (correct) assert.ok(live.settings().level > 1);
  }
});

test('an assessable skipped answer stays neutral', () => {
  const { live, present } = setup(), before = live.settings();
  const r = live.answer(present('completed'), { correct: null, assessable: true });
  assert.equal(r.recorded.verdict, 'skipped');
  assert.equal(r.evidence, false);
  assert.equal(live.trace()[0].outcome, 'void');
  assert.deepEqual(live.settings(), before);
});

test('an explicit game timeout remains independent of language assessment', () => {
  const { live, present } = setup();
  const r = live.answer(present('failed'), { correct: null, assessable: false }, { outcome: 'timeout', pressure: 1.1 });
  assert.equal(r.recorded.verdict, 'unassessed');
  assert.equal(r.evidence, true);
  assert.equal(live.trace()[0].outcome, 'timeout');
});

test('redelivery of an unassessed attempt stays idempotent', () => {
  const { live, present } = setup(), pid = present('failed');
  live.answer(pid, { correct: true, assessable: true });
  const before = { settings: live.settings(), trace: live.trace() };
  live.answer(pid, { correct: true, assessable: true }, { outcome: 'success' });
  assert.deepEqual({ settings: live.settings(), trace: live.trace() }, before);
});
