'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Vellum = require('../atlas/vellum-flow');
const LegacyVellum = require('../atlas/vellum');

test('stuck is measured against the person, not one clock for everyone', () => {
  assert.deepEqual(Vellum.stuckFor({ latencies: [3000, 4000] }), { afterMs: 40000, misses: 2, basis: 'default', n: 2 });
  const quick = Vellum.stuckFor({ latencies: [2000, 2500, 3000, 2200, 2800] });
  const careful = Vellum.stuckFor({ latencies: [18000, 22000, 25000, 20000, 30000] });
  assert.equal(quick.basis, 'personal');
  assert.equal(quick.afterMs, 8000, 'never sooner than the floor');
  assert.equal(careful.afterMs, 55000, 'a careful reader is not interrupted early');
  assert.equal(Vellum.stuckFor({ latencies: Array(6).fill(50000) }).afterMs, 90000, 'never later than the ceiling');
  // The existing cue policy takes the personal threshold as is.
  assert.equal(LegacyVellum.offerCue({ support: 'choose', hasCue: true, elapsedMs: 30000, stuck: careful }), false);
  assert.equal(LegacyVellum.offerCue({ support: 'choose', hasCue: true, elapsedMs: 30000, stuck: quick }), true);
});

test('less help is offered after three quiet successes, never against a declared choice or right after a no', () => {
  const now = '2026-10-02T00:00:00.000Z';
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 3, now }).offer, true);
  assert.deepEqual(Vellum.supportStep({ at: 0, last: 2, streak: 3, now }), { offer: true, from: 0, to: 1, reason: 'quiet-streak' });
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 2, now }).reason, 'not-yet');
  assert.equal(Vellum.supportStep({ at: 2, last: 2, streak: 9, now }).reason, 'least-help');
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 9, now, declared: true }).reason, 'declared');
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 9, now, declinedAt: '2026-09-25T00:00:00.000Z' }).reason, 'declined-recently');
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 9, now, declinedAt: '2026-09-10T00:00:00.000Z' }).offer, true);
});

test('where help shows before every answer, one more success in a row than a quiet streak needs also asks', () => {
  const now = '2026-10-02T00:00:00.000Z';
  // No success is quiet at the most help when it shows at once: only the run of successes can ask.
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 0, steady: 3, now }).reason, 'not-yet');
  assert.deepEqual(Vellum.supportStep({ at: 0, last: 2, streak: 0, steady: 4, now }), { offer: true, from: 0, to: 1, reason: 'steady-with-help' });
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 3, steady: 4, now }).reason, 'quiet-streak', 'quiet successes are named first');
  // Still never against a declared choice, at the least help, or right after a no.
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 0, steady: 9, now, declared: true }).reason, 'declared');
  assert.equal(Vellum.supportStep({ at: 2, last: 2, streak: 0, steady: 9, now }).reason, 'least-help');
  assert.equal(Vellum.supportStep({ at: 0, last: 2, streak: 0, steady: 9, now, declinedAt: '2026-09-25T00:00:00.000Z' }).reason, 'declined-recently');
  assert.throws(() => Vellum.supportStep({ at: 0, last: 2, streak: 0, steady: -1, now }), /invalid support step/);
});

test('lines say what changed in plain words, in two levels, and contents may use their own words', () => {
  assert.equal(Vellum.line({ direction: 1, kind: 'pace' }).text, '조금 더 빠르게 해 볼게요.');
  assert.equal(Vellum.line({ direction: -1, kind: 'pace' }, { level: 'easy' }).text, '시간이 더 있어요.');
  assert.equal(Vellum.line({ direction: -1, kind: 'support' }).key, 'ease.support');
  assert.equal(Vellum.line({ direction: 1, because: 'accepted-less-help', kind: 'support' }).key, 'accepted-less-help');
  assert.equal(Vellum.line({ code: 'start.default' }), null, 'the default start needs no announcement');
  assert.equal(Vellum.line({ code: 'start.returning' }).text, '가볍게 다시 시작할게요.');
  assert.equal(Vellum.line({ direction: -1, kind: 'pace' }, { words: { 'ease.pace': '손님이 조금 천천히 와요.' } }).text, '손님이 조금 천천히 와요.');
  assert.equal(Vellum.line(null), null);
  for (const level of Object.values(Vellum.WORDS)) for (const text of Object.values(level)) {
    assert.doesNotMatch(text, /잘했|못했|실력|점수|빠졌|쉬었|며칠|오랜만/, 'never judges the person or counts absences');
  }
});
