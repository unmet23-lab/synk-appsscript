// 옛 시험 tests/atlas-vellum-flow.test.js의 장면을 새 줄(src/flow/lines.mjs)에 다시 건다.
// 뺀 것: 「옛 도움 신호 정책(atlas/vellum.js offerCue)이 개인 기준을 그대로 받는다」 두 단정 — offerCue는 옮기지 않은 옛 Vellum의 것이다.
// 더한 것: 임의 입력에서 stuckFor · supportStep · line이 옛 vellum-flow와 같은 답(던짐 포함)을 내는지 맞댄다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, legacy, seeded } from './legacy.mjs';

const Vellum = legacy('vellum-flow.js');
const at = '2026-10-02T00:00:00.000Z';

test('stuck is measured against the person, not one clock for everyone', () => {
  assert.deepEqual(Flow.stuckFor({ latencies: [3000, 4000] }), {
    afterMs: 40000,
    misses: 2,
    basis: 'default',
    n: 2,
  });
  const quick = Flow.stuckFor({ latencies: [2000, 2500, 3000, 2200, 2800] });
  const careful = Flow.stuckFor({ latencies: [18000, 22000, 25000, 20000, 30000] });
  assert.equal(quick.basis, 'personal');
  assert.equal(quick.afterMs, 8000, 'never sooner than the floor');
  assert.equal(careful.afterMs, 55000, 'a careful reader is not interrupted early');
  assert.equal(
    Flow.stuckFor({ latencies: Array(6).fill(50000) }).afterMs,
    90000,
    'never later than the ceiling',
  );
});

test('less help is offered after three quiet successes, never against a declared choice or right after a no', () => {
  assert.equal(Flow.supportStep({ at: 0, last: 2, streak: 3, now: at }).offer, true);
  assert.deepEqual(Flow.supportStep({ at: 0, last: 2, streak: 3, now: at }), {
    offer: true,
    from: 0,
    to: 1,
    reason: 'quiet-streak',
  });
  assert.equal(Flow.supportStep({ at: 0, last: 2, streak: 2, now: at }).reason, 'not-yet');
  assert.equal(Flow.supportStep({ at: 2, last: 2, streak: 9, now: at }).reason, 'least-help');
  assert.equal(
    Flow.supportStep({ at: 0, last: 2, streak: 9, now: at, declared: true }).reason,
    'declared',
  );
  assert.equal(
    Flow.supportStep({ at: 0, last: 2, streak: 9, now: at, declinedAt: '2026-09-25T00:00:00.000Z' })
      .reason,
    'declined-recently',
  );
  assert.equal(
    Flow.supportStep({ at: 0, last: 2, streak: 9, now: at, declinedAt: '2026-09-10T00:00:00.000Z' })
      .offer,
    true,
  );
});

test('where help shows before every answer, one more success in a row than a quiet streak needs also asks', () => {
  assert.equal(
    Flow.supportStep({ at: 0, last: 2, streak: 0, steady: 3, now: at }).reason,
    'not-yet',
  );
  assert.deepEqual(Flow.supportStep({ at: 0, last: 2, streak: 0, steady: 4, now: at }), {
    offer: true,
    from: 0,
    to: 1,
    reason: 'steady-with-help',
  });
  assert.equal(
    Flow.supportStep({ at: 0, last: 2, streak: 3, steady: 4, now: at }).reason,
    'quiet-streak',
    'quiet successes are named first',
  );
  assert.equal(
    Flow.supportStep({ at: 0, last: 2, streak: 0, steady: 9, now: at, declared: true }).reason,
    'declared',
  );
  assert.equal(
    Flow.supportStep({ at: 2, last: 2, streak: 0, steady: 9, now: at }).reason,
    'least-help',
  );
  assert.equal(
    Flow.supportStep({
      at: 0,
      last: 2,
      streak: 0,
      steady: 9,
      now: at,
      declinedAt: '2026-09-25T00:00:00.000Z',
    }).reason,
    'declined-recently',
  );
  assert.throws(
    () => Flow.supportStep({ at: 0, last: 2, streak: 0, steady: -1, now: at }),
    /invalid support step/,
  );
});

test('lines say what changed in plain words, in two levels, and contents may use their own words', () => {
  assert.equal(Flow.line({ direction: 1, kind: 'pace' }).text, '조금 더 빠르게 해 볼게요.');
  assert.equal(
    Flow.line({ direction: -1, kind: 'pace' }, { level: 'easy' }).text,
    '시간이 더 있어요.',
  );
  assert.equal(Flow.line({ direction: -1, kind: 'support' }).key, 'ease.support');
  assert.equal(
    Flow.line({ direction: 1, because: 'accepted-less-help', kind: 'support' }).key,
    'accepted-less-help',
  );
  assert.equal(
    Flow.line({ code: 'start.default' }),
    null,
    'the default start needs no announcement',
  );
  assert.equal(
    Flow.line({ code: 'start.none' }),
    null,
    'a content without moment-level challenge says nothing',
  );
  assert.equal(Flow.line({ code: 'start.returning' }).text, '가볍게 다시 시작할게요.');
  assert.equal(
    Flow.line(
      { direction: -1, kind: 'pace' },
      { words: { 'ease.pace': '손님이 조금 천천히 와요.' } },
    ).text,
    '손님이 조금 천천히 와요.',
  );
  assert.equal(Flow.line(null), null);
  for (const level of Object.values(Flow.WORDS))
    for (const text of Object.values(level))
      assert.doesNotMatch(
        text,
        /잘했|못했|실력|점수|빠졌|쉬었|며칠|오랜만/,
        'never judges the person or counts absences',
      );
  assert.deepEqual(Flow.WORDS, Vellum.WORDS);
  assert.deepEqual(Flow.STUCK, Vellum.STUCK);
});

// 던지면 그 글을, 아니면 값을 돌려준다 — 두 판의 답을 던짐까지 견주려고.
const outcome = call => {
  try {
    return { value: call() };
  } catch (error) {
    return { error: `${error.constructor.name}: ${error.message}` };
  }
};

function tools(random) {
  const pick = list => list[Math.floor(random() * list.length)];
  const maybe = (p, value) => (random() < p ? value() : {});
  return { random, pick, maybe };
}

function randomStuck({ random, pick, maybe }) {
  const latencies =
    random() < 0.05
      ? pick([[700000], [-1]])
      : Array.from({ length: Math.floor(random() * 12) }, () => Math.round(random() * 120000));
  return {
    latencies,
    ...maybe(0.3, () => ({ factor: pick([1, 2.5, 4, 11]) })),
    ...maybe(0.2, () => ({ minSamples: pick([1, 3, 5, 0]) })),
    ...maybe(0.1, () => ({
      base: pick([{ afterMs: 20000, misses: 3 }, { afterMs: 10, misses: 1 }, null]),
    })),
  };
}

function randomStep({ random, pick, maybe }) {
  const last = Math.floor(random() * 4);
  return {
    at: random() < 0.05 ? -1 : Math.floor(random() * (last + 1)),
    last,
    streak: Math.floor(random() * 6),
    steady: random() < 0.03 ? -1 : Math.floor(random() * 7),
    declared: random() < 0.15,
    declinedAt:
      random() < 0.3 ? new Date(Date.parse(at) - random() * 30 * 86_400_000).toISOString() : null,
    now: at,
    ...maybe(0.2, () => ({ need: pick([1, 2, 3, 4]) })),
  };
}

const KEYS = Object.keys(Vellum.WORDS.standard);
function randomLine({ random, pick, maybe }) {
  const event =
    random() < 0.3
      ? { code: pick(['start.default', 'start.none', ...KEYS.filter(k => k.startsWith('start.'))]) }
      : {
          direction: pick([-1, 0, 1]),
          kind: pick(['content', 'pace', 'support', undefined]),
          ...maybe(0.1, () => ({ because: 'accepted-less-help' })),
        };
  const options = {
    level: random() < 0.05 ? 'loud' : pick(['easy', 'standard']),
    ...maybe(0.3, () => ({ words: { [pick(KEYS)]: pick(['', '손님이 와요.']) } })),
  };
  return [event, options];
}

test('2,000 random inputs: stuckFor, supportStep and line answer as the old vellum-flow does', () => {
  const t = tools(seeded(4206));
  for (let n = 0; n < 2000; n += 1) {
    const stuck = randomStuck(t);
    assert.deepEqual(
      outcome(() => Flow.stuckFor(stuck)),
      outcome(() => Vellum.stuckFor(stuck)),
      `stuck ${n}`,
    );
    const step = randomStep(t);
    assert.deepEqual(
      outcome(() => Flow.supportStep(step)),
      outcome(() => Vellum.supportStep(step)),
      `step ${n}`,
    );
    const [event, options] = randomLine(t);
    assert.deepEqual(
      outcome(() => Flow.line(event, options)),
      outcome(() => Vellum.line(event, options)),
      `line ${n}`,
    );
  }
});
