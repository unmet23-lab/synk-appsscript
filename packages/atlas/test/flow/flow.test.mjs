// 옛 시험 tests/atlas-flow.test.js의 장면을 새 순간 맞춤(src/flow)에 다시 건다.
// 바꾼 것과 뺀 것(단계 4 계획 §23-4 · §23-11의 2):
//   · 옛 장면의 items({ levels: [1, 2, 3], weight: 2 })는 같은 단계 · 무게의 맨 앞 내용 손잡이 level로 바꿔 걸었다. 옛 Flow가 items를
//     맨 앞 내용 손잡이로 다뤘으므로 장면의 뜻(올림 · 내림 · 기억 · 여는 자리)이 같다. 새 엔진에서 items는 손잡이가 아니고 관찰 칸이다 —
//     그 새 뜻은 items.test.mjs가 본다. 그래서 「items가 첫 내용 손잡이」 단정은 정의 검사만 남겼고, settings().level(Flow가 바라는
//     문항 단계)은 settings().values.level로 읽는다.
//   · 「다른 연습의 앞선 근거(priorFromSummary)」 장면은 뺐다 — priorFromSummary를 옮기지 않았다(새 길은 내용 기억이 없으면 시작값에서
//     연다). start의 prior 칸은 같은 뜻으로 남아 ladder 장면들이 그대로 쓴다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, later, legacy, NOW, play, reasons, seeded } from './legacy.mjs';

const rush = () =>
  Flow.defineContent({
    id: 'test.rush',
    target: 0.75,
    knobs: [
      { id: 'level', values: [1, 2, 3], weight: 2, start: 0 },
      { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
      { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
      { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
    ],
  });

test('a new person starts exactly at the content defaults, with no demographic input accepted', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  assert.deepEqual(run.settings().values, {
    level: 1,
    patience: 45,
    hint: 'normal',
    text: 'standard',
  });
  assert.equal(run.intro().code, 'start.default');
  assert.deepEqual(run.intro().opening, []);
  for (const field of ['age', 'gender', 'nationality', 'profile']) {
    assert.throws(() => Flow.start({ spec: rush(), now: NOW, [field]: 'x' }), /start accepts only/);
  }
  assert.throws(
    () =>
      Flow.defineContent({ id: 'x', knobs: [{ id: 'a', values: [1, 2] }], audience: 'over-60' }),
    /unknown spec field/,
  );
});

test('the spec is validated and a defined spec is reused', () => {
  const spec = rush();
  assert.throws(
    () => Flow.defineContent({ id: 'bad', knobs: [{ id: 'a', values: [1] }] }),
    /invalid knob/,
  );
  assert.throws(
    () => Flow.defineContent({ id: 'bad', target: 0.99, knobs: [{ id: 'a', values: [1, 2] }] }),
    /target/,
  );
  assert.throws(
    () => Flow.defineContent({ id: 'bad', knobs: [{ id: 'a', values: [1, 2], kind: 'mood' }] }),
    /invalid knob/,
  );
  assert.equal(Flow.defineContent(spec), spec, 'a defined spec is reused as is');
});

test('quiet successes raise one knob by one step at a time; a miss eases', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(12).fill({ outcome: 'success', pressure: 0.3 }));
  const changes = results.map(r => r.change).filter(Boolean);
  assert.ok(changes.length >= 2, 'a person who keeps succeeding gets more challenge');
  assert.ok(changes.every(c => c.direction === 1 && Math.abs(c.to - c.from) === 1));
  const at = changes.map(c => c.step);
  assert.equal(new Set(at).size, at.length, 'never two changes in one response');
  for (let i = 1; i < at.length; i += 1)
    assert.ok(at[i] - at[i - 1] > Flow.COOL_DOWN, 'raises are spaced out');
  const eased = run.observe({ outcome: 'fail', pressure: 0.3 });
  assert.equal(eased.change?.direction, -1, 'one miss after raises eases right away');
  assert.equal(eased.change.kind, 'content');
});

test('help never raises the challenge, however many assisted successes there are', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(20).fill({ outcome: 'success', assisted: true, pressure: 0.2 }));
  assert.ok(results.every(r => !r.change || r.change.direction < 0));
  assert.equal(run.quietStreak(), 0);
});

test('help on a hard item never lifts the estimate, and an assisted success never triggers a raise that was due', () => {
  const spec = rush();
  const memory = (estimates, indices) => ({
    v: 2,
    content: spec.id,
    specVersion: spec.version,
    at: NOW,
    estimates,
    indices,
    latencies: [],
  });
  // 지금 도전보다 한참 아래: 거기서 도움 본 성공은 뜻밖의 승리처럼 보인다.
  const low = Flow.start({
    spec,
    now: NOW,
    memory: memory(
      { content: { theta: -1, n: 10, reversals: 0 }, pace: { theta: 3, n: 10, reversals: 0 } },
      { level: 2, patience: 4, hint: 2, text: 1 },
    ),
  });
  const before = low.memory(NOW).estimates.content.theta;
  low.observe({ outcome: 'success', assisted: true, pressure: 0.3 });
  assert.ok(
    low.memory(NOW).estimates.content.theta <= before,
    'the estimate does not rise on help',
  );
  // 지금 도전보다 한참 위: 올림이 때가 됐지만 이 답의 도움이 막는다.
  const high = Flow.start({
    spec,
    now: NOW,
    memory: memory(
      { content: { theta: 6, n: 10, reversals: 0 }, pace: { theta: 6, n: 10, reversals: 0 } },
      { level: 0, patience: 2, hint: 1, text: 1 },
    ),
  });
  const assisted = high.observe({ outcome: 'success', assisted: true, pressure: 0.3 });
  assert.ok(
    !assisted.change || assisted.change.direction < 0,
    'no raise right after an assisted success',
  );
  const quiet = high.observe({ outcome: 'success', pressure: 0.3 });
  assert.equal(quiet.change?.direction, 1, 'the next quiet success may raise');
});

test('a timeout eases time first; a content miss eases content first', () => {
  const timed = Flow.start({ spec: rush(), now: NOW });
  const t = timed.observe({ outcome: 'timeout' });
  assert.equal(t.change.kind, 'pace');
  assert.equal(t.change.because, 'time-ran-out');
  assert.equal(t.settings.values.patience, 52);
  const missed = Flow.start({ spec: rush(), now: NOW });
  play(missed, Array(3).fill({ outcome: 'success', pressure: 0.3 }));
  const m = play(missed, ['fail', 'fail'])
    .map(r => r.change)
    .filter(Boolean);
  assert.ok(
    m.length && m.every(c => c.kind !== 'pace'),
    'content misses never loosen the clock first',
  );
});

test('successes that used most of the time never speed things up', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(16).fill({ outcome: 'success', pressure: 0.95 }));
  assert.ok(results.every(r => !r.change || r.change.kind !== 'pace' || r.change.direction < 0));
});

test('declared choices hold: locks, declared-only knobs, fixed mode and the comparison arm', () => {
  const locked = Flow.start({
    spec: rush(),
    now: NOW,
    declared: { knobs: { patience: 0, text: 0 } },
  });
  play(locked, [
    ...Array(10).fill('timeout'),
    ...Array(10).fill({ outcome: 'success', pressure: 0.1 }),
  ]);
  assert.equal(locked.settings().values.patience, 60);
  assert.equal(locked.settings().values.text, 'large');
  const fixed = Flow.start({ spec: rush(), now: NOW, declared: { mode: 'fixed' } });
  assert.ok(play(fixed, Array(10).fill('fail')).every(r => r.change === null));
  assert.equal(fixed.intro().code, 'start.fixed');
  const baseline = Flow.start({ spec: rush(), now: NOW, arm: 'baseline' });
  assert.ok(
    play(baseline, Array(10).fill({ outcome: 'success', pressure: 0.1 })).every(
      r => r.change === null,
    ),
  );
  assert.equal(baseline.intro().code, 'start.baseline');
  // 적응 판도 본인 선택만 따르는 손잡이는 움직이지 않는다.
  const run = Flow.start({ spec: rush(), now: NOW });
  play(run, Array(30).fill('fail'));
  assert.equal(run.settings().values.text, 'standard');
});

test('skipped or void responses are not evidence and move nothing', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, ['skip', 'void', 'skip', 'void']);
  assert.ok(results.every(r => r.change === null && r.evidence === false));
  assert.deepEqual(
    run.settings().indices,
    Flow.start({ spec: rush(), now: NOW }).settings().indices,
  );
});

test('memory resumes where the person left off; a long gap starts lighter without counting days', () => {
  const spec = rush();
  const run = Flow.start({ spec, now: NOW });
  play(run, Array(14).fill({ outcome: 'success', pressure: 0.3 }));
  const memory = run.memory(NOW);
  const before = run.settings().indices;
  assert.deepEqual(Object.keys(memory).sort(), [
    'at',
    'content',
    'estimates',
    'indices',
    'latencies',
    'policy',
    'specVersion',
    'v',
  ]);
  const resumed = Flow.start({ spec, memory, now: later(1) });
  assert.equal(resumed.intro().code, 'start.memory');
  assert.deepEqual(resumed.settings().indices, before);
  const back = Flow.start({ spec, memory, now: later(30) });
  assert.equal(back.intro().code, 'start.returning');
  assert.ok(
    Flow.challenge(spec, back.settings().indices) < Flow.challenge(spec, before),
    'starts a step lighter',
  );
  const other = Flow.defineContent({
    id: 'test.rush',
    version: 2,
    items: { levels: [1, 2, 3] },
    knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45], start: 1 }],
  });
  assert.equal(
    Flow.start({ spec: other, memory, now: later(1) }).intro().code,
    'start.default',
    'another version of the content starts fresh',
  );
});

test('a tired day never makes anything harder, offers no less help, and its start line says only that', () => {
  const quick = Array(20).fill({ outcome: 'success', pressure: 0.1 });
  const normal = Flow.start({ spec: rush(), now: NOW });
  assert.ok(
    play(normal, quick).some(r => r.change?.direction > 0),
    'the same answers raise on a normal day',
  );
  const run = Flow.start({ spec: rush(), now: NOW, condition: 'tired' });
  assert.equal(run.intro().code, 'start.tired');
  assert.ok(
    run.intro().opening.every(c => c.direction < 0),
    'the opening only eases',
  );
  assert.ok(play(run, quick).every(r => !r.change || r.change.direction < 0));
  assert.equal(run.lessHelpAllowed(), false);
  assert.equal(run.acceptLessHelp(), null);
  // 시간이 먼저 어려워지는 쪽이 아니다: 시계는 그날 시작한 자리보다 빡빡해지지 않는다.
  const spec = rush();
  const pace = r =>
    Flow.challenge(spec, r.settings().indices) -
    Flow.challenge(spec, { ...r.settings().indices, patience: 0 });
  const tired = Flow.start({ spec, now: NOW, condition: 'tired' });
  const began = pace(tired);
  for (const o of [...quick, 'fail', ...quick]) {
    tired.observe(typeof o === 'string' ? { outcome: o } : o);
    assert.ok(pace(tired) <= began);
  }
  // 앞선 근거는 보통 날을 높이 열 수 있지만 피곤한 날은 아니다.
  const prior = { content: 6 };
  assert.ok(
    Flow.start({ spec: rush(), now: NOW, prior })
      .intro()
      .opening.some(c => c.direction > 0),
  );
  const tiredPrior = Flow.start({ spec: rush(), now: NOW, prior, condition: 'tired' });
  assert.ok(tiredPrior.intro().opening.every(c => c.direction < 0));
  assert.equal(tiredPrior.settings().values.level, 1);
});

test('an opening taken for today alone is not kept: the next day starts where adapted play reached', () => {
  const spec = rush();
  const defaults = Flow.start({ spec, now: NOW }).settings().indices;
  // 피곤한 날은 한 칸 가볍게 연다(목표가 높다) …
  const tired = Flow.start({ spec, now: NOW, condition: 'tired' });
  assert.ok(
    tired.intro().opening.some(c => c.because === 'tired'),
    'the tired day eased its opening',
  );
  assert.notDeepEqual(tired.settings().indices, defaults);
  // … 그 밖에 아무 일이 없으면 남기는 것은 그 사람이 있던 자리다.
  assert.deepEqual(tired.memory(NOW).indices, defaults);
  const next = Flow.start({ spec, now: later(1), memory: tired.memory(NOW) });
  assert.equal(next.intro().code, 'start.memory');
  assert.deepEqual(
    next.settings().indices,
    defaults,
    'the next day does not start lighter because of yesterday',
  );
  // 판 안의 놓침은 배운다: 판에서 내린 한 칸은 남는다.
  const missed = Flow.start({ spec, now: NOW, condition: 'tired' });
  const eased = play(missed, [
    { outcome: 'fail', pressure: 0.2 },
    { outcome: 'fail', pressure: 0.2 },
  ]).filter(r => r.change).length;
  assert.ok(eased >= 1);
  const kept = missed.memory(NOW).indices;
  assert.ok(
    Flow.challenge(spec, kept) < Flow.challenge(spec, defaults),
    'what play eased stays eased',
  );
  assert.ok(
    Flow.challenge(spec, kept) > Flow.challenge(spec, missed.settings().indices),
    'only the tired opening is undone',
  );
  // 쉽게 고른 판도 오늘의 선택이다.
  const easier = Flow.start({ spec, now: NOW, declared: { mode: 'easier' } });
  if (easier.intro().opening.length) assert.deepEqual(easier.memory(NOW).indices, defaults);
});

// 여섯 단계 중 셋째에서 여는 내용 손잡이 하나: 여는 자리가 양쪽으로 갈 수 있다.
const ladder = () =>
  Flow.defineContent({
    id: 'test.ladder',
    knobs: [{ id: 'step', values: [0, 1, 2, 3, 4, 5], start: 2 }],
  });

test('a round chosen harder keeps the place the prior gave: only the steps past it are today’s and undone', () => {
  const spec = ladder();
  for (const declared of [{}, { mode: 'harder' }]) {
    const run = Flow.start({ spec, now: NOW, prior: { content: 4 }, declared });
    assert.equal(run.settings().indices.step, 5);
    assert.deepEqual(
      reasons(run),
      ['prior', 'prior', 'prior'],
      'every step was the prior’s, not today’s',
    );
    assert.equal(run.memory(NOW).indices.step, 5);
    assert.equal(
      Flow.start({ spec, now: later(1), memory: run.memory(NOW) }).settings().indices.step,
      5,
      'the next day resumes there',
    );
  }
  assert.equal(Flow.start({ spec, now: NOW, prior: { content: 3.2 } }).settings().indices.step, 4);
  const more = Flow.start({
    spec,
    now: NOW,
    prior: { content: 3.2 },
    declared: { mode: 'harder' },
  });
  assert.equal(more.settings().indices.step, 5);
  assert.deepEqual(reasons(more), ['prior', 'prior', 'declared-harder']);
  assert.equal(more.memory(NOW).indices.step, 4);
  assert.equal(
    Flow.start({ spec, now: later(1), memory: more.memory(NOW) }).settings().indices.step,
    4,
  );
  const missed = Flow.start({
    spec,
    now: NOW,
    prior: { content: 3.2 },
    declared: { mode: 'harder' },
  });
  assert.equal(missed.observe({ outcome: 'fail' }).change?.direction, -1);
  assert.equal(missed.settings().indices.step, 4);
  assert.equal(missed.memory(NOW).indices.step, 3);
});

test('an opening that memory itself asks for says so and is kept, even on a tired day; only the extra tired step is undone', () => {
  const spec = ladder();
  const at = Flow.start({ spec, now: NOW }).memory(NOW);
  const memory = {
    ...at,
    indices: { step: 4 },
    estimates: { ...at.estimates, content: { theta: 2.6, n: 10, reversals: 0 } },
  };
  const usual = Flow.start({ spec, now: later(1), memory });
  assert.equal(usual.intro().code, 'start.memory');
  assert.deepEqual(
    usual.intro().opening.map(c => [c.because, c.from, c.to]),
    [['memory', 4, 3]],
  );
  assert.equal(usual.memory(later(1)).indices.step, 3);
  const tired = Flow.start({ spec, now: later(1), memory, condition: 'tired' });
  assert.deepEqual(
    tired.intro().opening.map(c => [c.because, c.from, c.to]),
    [
      ['memory', 4, 3],
      ['tired', 3, 2],
    ],
  );
  assert.equal(tired.settings().indices.step, 2, 'today still opens a step lighter');
  assert.equal(
    tired.memory(later(1)).indices.step,
    3,
    'the next day starts where memory alone placed the person',
  );
});

test('when the prior and today pull different ways, or over several knobs, what is kept is the place the prior alone gives', () => {
  const spec = ladder();
  const low = { content: Math.log(3) };
  assert.equal(Flow.start({ spec, now: NOW, prior: low }).settings().indices.step, 0);
  const harder = Flow.start({ spec, now: NOW, prior: low, declared: { mode: 'harder' } });
  assert.equal(harder.settings().indices.step, 1);
  assert.deepEqual(reasons(harder), ['prior']);
  assert.equal(harder.memory(NOW).indices.step, 0);
  const easier = Flow.start({
    spec,
    now: NOW,
    prior: { content: 4 },
    declared: { mode: 'easier' },
  });
  assert.equal(easier.settings().indices.step, 4);
  assert.deepEqual(reasons(easier), ['prior', 'prior']);
  const tired = Flow.start({ spec, now: NOW, prior: { content: 4 }, condition: 'tired' });
  assert.equal(tired.settings().indices.step, 2, 'a tired day never opens higher');
  for (const run of [easier, tired]) assert.equal(run.memory(NOW).indices.step, 5);
  const two = Flow.defineContent({
    id: 'test.ladder.two',
    knobs: [
      { id: 'a', values: [0, 1, 2, 3], start: 1 },
      { id: 'b', values: [0, 1, 2, 3], start: 1 },
    ],
  });
  const prior = { content: 3.7 };
  assert.deepEqual(Flow.start({ spec: two, now: NOW, prior }).settings().indices, { a: 3, b: 2 });
  const both = Flow.start({ spec: two, now: NOW, prior, declared: { mode: 'harder' } });
  assert.deepEqual(both.settings().indices, { a: 3, b: 3 });
  assert.deepEqual(
    both.intro().opening.map(c => [c.knob, c.because]),
    [
      ['a', 'prior'],
      ['a', 'prior'],
      ['b', 'prior'],
      ['b', 'declared-harder'],
    ],
  );
  assert.deepEqual(both.memory(NOW).indices, { a: 3, b: 2 });
});

const clue = start =>
  Flow.defineContent({
    id: start === 0 ? 'test.auto-help' : 'test.auto-help.mid',
    knobs: [{ id: 'clue', kind: 'support', values: ['at-once', 'on-pause', 'on-press'], start }],
  });

test('successes in a row, with help or without, are counted for the offer of less help; a miss ends the run', () => {
  const run = Flow.start({ spec: clue(0), now: NOW });
  play(run, Array(3).fill({ outcome: 'success', assisted: true }));
  assert.equal(run.quietStreak(), 0, 'a helped success is never quiet');
  assert.equal(run.steadyStreak(), 3);
  play(run, ['fail']);
  assert.equal(run.steadyStreak(), 0);
  play(run, ['skip', 'void']);
  assert.equal(run.steadyStreak(), 0, 'a skipped response is not a success');
  play(run, Array(4).fill({ outcome: 'success', assisted: true }));
  assert.equal(run.steadyStreak(), 4);
  assert.equal(run.lessHelpAllowed(), true);
  assert.equal(run.acceptLessHelp().to, 1);
  assert.equal(run.steadyStreak(), 0, 'the new help level earns its own run');
  const eased = Flow.start({ spec: clue(2), now: NOW });
  const turns = play(eased, [
    { outcome: 'success', assisted: true },
    'fail',
    { outcome: 'success', assisted: true },
    { outcome: 'success', assisted: true },
  ]);
  const lastEase = turns
    .map((r, i) => (r.change?.kind === 'support' ? i : -1))
    .filter(i => i >= 0)
    .at(-1);
  assert.ok(lastEase >= 0, 'help came earlier');
  assert.equal(
    eased.steadyStreak(),
    turns.length - 1 - lastEase,
    'only successes after the last change of help count',
  );
});

test('less help the person accepted is kept: the next round does not quietly take it back', () => {
  const spec = Flow.defineContent({
    id: 'test.auto-help.kept',
    knobs: [{ id: 'clue', kind: 'support', values: ['at-once', 'on-pause', 'on-press'], start: 2 }],
  });
  const run = Flow.start({ spec, now: NOW });
  play(run, ['fail', { outcome: 'success', assisted: true }, 'fail']);
  assert.equal(run.settings().values.clue, 'at-once', 'misses brought the help to its earliest');
  play(run, Array(4).fill({ outcome: 'success', assisted: true }));
  assert.equal(run.acceptLessHelp().value, 'on-pause');
  const next = Flow.start({ spec, now: later(1), memory: run.memory(NOW) });
  assert.equal(
    next.settings().values.clue,
    'on-pause',
    'the next round opens where the person chose',
  );
  play(next, ['fail']);
  assert.equal(next.settings().values.clue, 'at-once', 'a miss still brings the help back');
});

test('a day chosen to be easier lifts both aims: for the same answers, time pressure is never higher than on a normal day', () => {
  // 옛 장면의 씨앗(20261002)과 같은 선형 합동.
  const random = seeded(20261002);
  const cafe = Flow.defineContent({
    id: 'test.cafe',
    knobs: [
      { id: 'level', values: [1, 2, 3], weight: 2 },
      { id: 'patience', kind: 'pace', values: [60, 54, 48, 42, 36, 30], start: 3 },
      { id: 'spawn', kind: 'pace', values: [15, 13, 11, 10, 8, 7], start: 3 },
      { id: 'queue', kind: 'pace', values: [2, 3, 4], start: 1, weight: 1.5 },
    ],
  });
  for (const spec of [rush(), cafe]) {
    const pace = run => {
      const at = run.settings().indices;
      return spec.knobs.reduce((sum, k) => sum + (k.kind === 'pace' ? k.weight * at[k.id] : 0), 0);
    };
    for (let s = 0; s < 120; s += 1) {
      const success = 0.5 + 0.5 * random();
      const timeout = 0.15 * random();
      const speed = random();
      const normal = Flow.start({ spec, now: NOW });
      const easier = Flow.start({ spec, now: NOW, declared: { mode: 'easier' } });
      for (let i = 0; i < 30; i += 1) {
        const u = random();
        const o =
          u < timeout
            ? { outcome: 'timeout' }
            : u < timeout + (1 - timeout) * success
              ? { outcome: 'success', pressure: Math.min(1, speed * 0.9 + 0.1 * random()) }
              : { outcome: 'fail', pressure: Math.min(1, speed) };
        normal.observe(o);
        easier.observe(o);
        assert.ok(pace(easier) <= pace(normal), `sequence ${s}, answer ${i + 1}`);
      }
    }
  }
});

test('a skipped or void response is not a pause: the rails count answers only', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  let raised = null;
  while (!raised) raised = run.observe({ outcome: 'success', pressure: 0.2 }).change;
  play(run, ['skip', 'void', 'skip', 'void', 'skip']);
  assert.equal(run.lessHelpAllowed(), false, 'still right after the raise');
  const next = run.observe({ outcome: 'success', pressure: 0.2 });
  assert.ok(
    !next.change || next.change.direction < 0,
    'the pause after a raise is measured in answers',
  );
  assert.equal(run.trace().at(-1).response, run.trace().length);
});

test('a fixed round or a knob set by hand never overwrites where adapted play had reached', () => {
  const spec = rush();
  const run = Flow.start({ spec, now: NOW });
  play(run, Array(14).fill({ outcome: 'success', pressure: 0.3 }));
  const reached = run.settings().indices;
  const memory = run.memory(NOW);
  assert.notDeepEqual(reached, Flow.start({ spec, now: NOW }).settings().indices);
  for (const declared of [{ mode: 'fixed' }, { knobs: { patience: 0 } }]) {
    const today = Flow.start({ spec, memory, now: later(1), declared });
    play(today, Array(6).fill({ outcome: 'success', pressure: 0.3 }));
    const saved = today.memory(later(1));
    const next = Flow.start({ spec, memory: saved, now: later(2) });
    assert.equal(next.intro().code, 'start.memory');
    if (declared.mode) assert.deepEqual(next.settings().indices, reached);
    else {
      assert.equal(
        saved.indices.patience,
        reached.patience,
        'the hand-set knob returns to where it was',
      );
      assert.ok(
        saved.estimates.pace.theta >= memory.estimates.pace.theta,
        'and what was learned about time is kept',
      );
    }
  }
  // 고정 판의 답도 증거다: 거기서 힘들면 다음 적응 판이 가볍게 연다.
  const hard = Flow.start({ spec, memory, now: later(1), declared: { mode: 'fixed' } });
  play(hard, Array(6).fill('fail'));
  assert.deepEqual(hard.memory(later(1)).indices, reached);
  assert.ok(
    Flow.challenge(
      spec,
      Flow.start({ spec, memory: hard.memory(later(1)), now: later(2) }).settings().indices,
    ) < Flow.challenge(spec, reached),
  );
  const baseline = Flow.start({ spec, memory, now: later(1), arm: 'baseline' });
  play(baseline, Array(6).fill({ outcome: 'success', pressure: 0.2 }));
  assert.deepEqual(baseline.memory(later(1)).indices, reached);
});

test('a missed answer never raises anything, even when the other part looks ready', () => {
  const spec = rush();
  const at = Flow.start({ spec, now: NOW }).memory(NOW);
  const ahead = { theta: 0, n: 40, reversals: 0 };
  const fast = () =>
    Flow.start({
      spec,
      now: later(1),
      memory: {
        ...at,
        estimates: {
          content: { ...ahead, theta: at.estimates.content.theta + 3 },
          pace: { ...ahead, theta: at.estimates.pace.theta + 3 },
        },
      },
    });
  const missed = fast().observe({ outcome: 'fail', pressure: 0.2 });
  assert.equal(missed.change, null, 'quick, but wrong: nothing gets harder');
  assert.equal(
    fast().observe({ outcome: 'success', pressure: 0.2 }).change?.direction,
    1,
    'quick and right: one step up',
  );
});

test('a raise is not taken where the next answer would ease it straight back', () => {
  const spec = rush();
  const at = Flow.start({ spec, now: NOW }).memory(NOW);
  const ahead = shift =>
    Flow.start({
      spec,
      now: later(1),
      memory: {
        ...at,
        estimates: {
          content: {
            theta: at.estimates.content.theta + shift * spec.scale,
            n: 40,
            reversals: 100,
          },
          pace: { ...at.estimates.pace, n: 40, reversals: 100 },
        },
      },
    });
  // level 한 단계는 두 칸이다. 한 칸 조금 넘게 앞서면 내림 구역으로 도로 떨어진다.
  assert.equal(ahead(1).observe({ outcome: 'success', pressure: 0.6 }).change, null);
  const clear = ahead(1.4).observe({ outcome: 'success', pressure: 0.6 }).change;
  assert.equal(clear?.knob, 'level');
  assert.equal(clear.because, 'steady-success');
});

test('a quiet streak only steps up to a level the person can still meet near the aim', () => {
  const spec = rush();
  const at = Flow.start({ spec, now: NOW }).memory(NOW);
  const settled = shift =>
    Flow.start({
      spec,
      now: later(1),
      memory: {
        ...at,
        estimates: {
          content: { theta: at.estimates.content.theta + shift, n: 40, reversals: 100 },
          pace: { ...at.estimates.pace, n: 40, reversals: 100 },
        },
      },
    });
  const streakOf = run =>
    play(run, Array(4).fill({ outcome: 'success', pressure: 0.6 }))
      .map(r => r.change)
      .filter(Boolean);
  const below = settled(-0.15);
  const changes = streakOf(below);
  assert.equal(below.quietStreak(), 4, 'four quiet successes in a row');
  assert.deepEqual(changes, [], 'the level step was beyond reach, so the level holds');
  const near = streakOf(settled(0.1));
  assert.equal(near.length, 1);
  assert.equal(near[0].knob, 'level');
  assert.equal(near[0].because, 'quiet-streak', 'within reach, the streak steps up');
});

test('less help is only ever accepted, one step, and never in the same response as another change', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(15).fill({ outcome: 'success', pressure: 0.3 }));
  assert.ok(
    results.every(r => !r.change || r.change.kind !== 'support' || r.change.direction < 0),
    'support never rises by itself',
  );
  for (let i = 0; i < 8 && !run.lessHelpAllowed(); i += 1) {
    if (run.observe({ outcome: 'success', pressure: 0.3 }).change)
      assert.equal(run.lessHelpAllowed(), false);
  }
  assert.equal(run.lessHelpAllowed(), true);
  const accepted = run.acceptLessHelp();
  assert.equal(accepted.because, 'accepted-less-help');
  assert.equal(accepted.to, accepted.from + 1);
  assert.equal(run.acceptLessHelp(), null, 'one step for one calm moment');
});

test('the floor names the dimension that has no easier step left', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  assert.deepEqual(run.floor(), []);
  play(run, Array(30).fill('timeout'));
  assert.ok(run.floor().includes('pace'), 'time pressure cannot ease further');
  const content = Flow.start({ spec: rush(), now: NOW });
  play(content, Array(30).fill({ outcome: 'fail', pressure: 0.2 }));
  assert.ok(content.floor().includes('content'));
});

test('the same inputs give the same decisions', () => {
  const sequence = [
    'success',
    'success',
    'fail',
    'timeout',
    { outcome: 'success', pressure: 0.2 },
    'fail',
    'success',
    'success',
    'success',
    'success',
  ];
  const a = Flow.start({ spec: rush(), now: NOW });
  const b = Flow.start({ spec: rush(), now: NOW });
  play(a, sequence);
  play(b, sequence);
  assert.deepEqual(a.trace(), b.trace());
});

// 본인이 고른 설정(Core personalization)을 이 내용의 잠금으로(§9). 옛 개인화 모듈(atlas/personalization.js)은 읽기만 한다.
const Personalization = legacy('personalization.js');
const chosen = () =>
  Flow.defineContent({
    id: 'test.chosen',
    target: 0.75,
    knobs: [
      { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
      { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
      {
        id: 'textSize',
        kind: 'content',
        follows: 'declared',
        values: ['standard', 'large'],
        start: 0,
      },
      { id: 'motion', kind: 'content', follows: 'declared', values: ['full', 'reduced'], start: 0 },
      { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
    ],
  });

test('a chosen help style holds the help knob; "choose" leaves help to the round', () => {
  assert.deepEqual(Flow.declaredFrom(chosen(), { support: 'step' }).knobs, { hint: 0 });
  assert.deepEqual(Flow.declaredFrom(chosen(), { support: 'independent' }).knobs, { hint: 2 });
  assert.deepEqual(Flow.declaredFrom(chosen(), { support: 'choose' }).knobs, {});
  assert.deepEqual(Flow.declaredFrom(chosen(), {}).knobs, {});
  const step = Flow.start({
    spec: chosen(),
    now: NOW,
    declared: Flow.declaredFrom(chosen(), { support: 'step' }),
  });
  play(step, Array(16).fill({ outcome: 'success', pressure: 0.2 }));
  assert.equal(step.settings().values.hint, 'early');
  assert.ok(
    step.changes().some(change => change.knob === 'patience'),
    'the rest of the content still follows the person',
  );
  assert.equal(
    step.lessHelpAllowed(),
    false,
    'less help is not even offered against the chosen style',
  );
  assert.equal(step.acceptLessHelp(), null);
  const alone = Flow.start({
    spec: chosen(),
    now: NOW,
    declared: Flow.declaredFrom(chosen(), { support: 'independent' }),
  });
  play(alone, Array(12).fill({ outcome: 'fail', pressure: 0.9 }));
  assert.equal(alone.settings().values.hint, 'late');
  assert.ok(alone.changes().length > 0, 'it eases elsewhere instead');
});

test('text size, motion and explanation set the declared knob of the same name, nothing else', () => {
  const declared = Flow.declaredFrom(chosen(), {
    textSize: 'large',
    motion: 'reduced',
    explanation: 'brief',
    audio: 'off',
  });
  assert.deepEqual(declared.knobs, { textSize: 1, motion: 1 });
  const run = Flow.start({ spec: chosen(), now: NOW, declared });
  assert.equal(run.settings().values.textSize, 'large');
  assert.equal(run.settings().values.motion, 'reduced');
  assert.equal(
    run.settings().values.text,
    'standard',
    'a declared knob with another name keeps the content default',
  );
  assert.deepEqual(Flow.declaredFrom(rush(), { textSize: 'large', support: 'choose' }).knobs, {});
});

test('only presentation settings are accepted, in the personalization adapter vocabulary', () => {
  for (const extra of [
    { minutes: 10 },
    { goal: 'study' },
    { reasons: ['travel'] },
    { age: 40 },
    { gender: 'f' },
  ]) {
    assert.throws(() => Flow.declaredFrom(chosen(), extra), /presentation accepts only/);
  }
  assert.throws(
    () => Flow.declaredFrom(chosen(), { support: 'maybe' }),
    /invalid presentation support/,
  );
  assert.throws(
    () => Flow.declaredFrom(chosen(), { textSize: 'huge' }),
    /invalid presentation textSize/,
  );
  for (const bad of [null, [], 'step'])
    assert.throws(() => Flow.declaredFrom(chosen(), bad), /presentation accepts only/);
  for (const key of Object.keys(Flow.PRESENTATION))
    assert.deepEqual([...Flow.PRESENTATION[key]], [...Personalization.OPTIONS[key]], key);
});

test('from a remembered profile to the round: the person’s own choice, or a fitting default for a first time', () => {
  const scope = {
    personId: 'person-1',
    productId: 'atlas-lab',
    contextId: 'numbers',
    domain: 'LAB',
  };
  const at = '2026-10-02T09:00:00.000Z';
  const pick = values => {
    const profile = Personalization.updateProfile(
      Personalization.createProfile({ scope, at }),
      { values, consent: true },
      at,
    );
    return Personalization.selectPersonalization({
      profile,
      scope,
      at,
      experienceId: 'atlas-lab.numbers',
      candidates: [{ id: 'atlas-lab.numbers', minutes: 3, pace: 'short' }],
    }).presentation;
  };
  const values = presentation =>
    Flow.start({
      spec: chosen(),
      now: NOW,
      declared: Flow.declaredFrom(chosen(), presentation),
    }).settings().values;
  assert.equal(values(pick({ support: 'independent', textSize: 'large' })).hint, 'late');
  assert.equal(values(pick({ support: 'independent', textSize: 'large' })).textSize, 'large');
  assert.equal(
    values(pick({ experience: 'new' })).hint,
    'early',
    'a first-timer who did not choose gets step-by-step help',
  );
  assert.equal(
    values(pick({ experience: 'practiced' })).hint,
    'normal',
    'otherwise help is left to the round',
  );
});
