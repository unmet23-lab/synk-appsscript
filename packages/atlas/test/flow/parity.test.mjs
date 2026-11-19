// 대조 시험: 임의 응답 열 2,000개(씨앗 고정)에서 새 순간 맞춤(src/flow)이 옛 atlas/flow.js(+ 그 가드 temper.js의 check와 줄
// vellum-flow.js)와 같은 결과를 내는지 본다. 옛 모듈은 createRequire로 읽기만 한다.
// **두 판 모두 items 없는 내용으로 견준다**(단계 4 계획 §23-11의 2) — items는 새 엔진에서 손잡이가 아니라 관찰 칸이라 뜻이 다르다.
// 그 다른 뜻은 items.test.mjs가 따로 본다. settings()의 level 칸(옛 Flow가 바라는 문항 단계 — items 없는 내용에서는 늘 null)은 새 판에
// 없으므로 옛 값이 null인지 보고 뺀 뒤 견준다.
// 한 열 = 내용 정의(손잡이 종류 · 수 · 본인 선택만 따르는 손잡이 · 무게 · 목표) · 오늘(컨디션 · 모드 · 비교 판) · 표시 설정(declaredFrom)과
// 손으로 정한 잠금 · 앞선 근거 · 손으로 지은 기억(어긋난 칸 포함) · 응답(결과 다섯 · 도움 · 다시 본 문항 · 시간 몫 · 지연 · 틀린 입력) ·
// 도움 줄이기 받아들임, 그리고 그 판의 기억으로 여는 둘째 판(쉬었다 돌아옴 포함).
// 응답마다 결과(바뀜 · 설정 · 증거) · 연속 수 · 도움 줄이기 가능 · 바닥 · 지연 · 마지막 응답 · 줄 · 막힘 기준 · 도움 줄이기 제안을,
// 판 끝에 시작 코드 · 여는 걸음 · trace · 바뀜 · 기억을 견준다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, later, legacy, NOW, seeded } from './legacy.mjs';

const Old = legacy('flow.js');
const OldLines = legacy('vellum-flow.js');
const ROWS = 2000;

const WORDS = {
  'raise.pace': '손님이 조금 더 바빠져요.',
  'start.memory': '',
  'ease.support': '돋보기를 일찍 보여 줄게요.',
};
const DECLARED = {
  textSize: [
    ['standard', 'large'],
    ['large', 'standard'],
  ],
  motion: [['full', 'reduced']],
  explanation: [['brief', 'standard', 'detailed']],
  decor: [[0, 1, 2]],
};

// 던지면 그 글을, 아니면 값을 돌려준다 — 두 판의 답을 던짐까지 견주려고.
const outcome = call => {
  try {
    return { value: call() };
  } catch (error) {
    return { error: `${error.constructor.name}: ${error.message}` };
  }
};

function tools(random) {
  const int = (low, high) => low + Math.floor(random() * (high - low + 1));
  const pick = list => list[Math.floor(random() * list.length)];
  const chance = p => random() < p;
  const weighted = table => {
    let u = random();
    for (const [value, p] of table) {
      u -= p;
      if (u < 0) return value;
    }
    return table.at(-1)[0];
  };
  return { int, pick, chance, weighted };
}

function randomKnob(t, index, used) {
  const kind = t.weighted([
    ['content', 0.33],
    ['pace', 0.33],
    ['support', 0.2],
    ['declared', 0.14],
  ]);
  if (kind === 'declared') {
    const name = t.pick(Object.keys(DECLARED).filter(key => !used.has(key)));
    if (name) {
      used.add(name);
      const values = t.pick(DECLARED[name]);
      return {
        id: name,
        kind: 'content',
        follows: 'declared',
        values,
        start: t.int(0, values.length - 1),
      };
    }
  }
  const real = kind === 'declared' ? 'content' : kind;
  const values =
    real === 'support'
      ? t.pick([
          ['early', 'normal', 'late'],
          ['at-once', 'on-pause'],
          ['a', 'b', 'c', 'd'],
        ])
      : Array.from({ length: t.int(2, 7) }, (_, i) => i * 10);
  return {
    id: `k${index}`,
    kind: real,
    values,
    start: t.int(0, values.length - 1),
    ...(t.chance(0.7) ? { weight: t.pick([0.25, 0.5, 1, 1, 1.5, 2, 3, 4]) } : {}),
  };
}

function randomSpec(t, row) {
  const used = new Set();
  return {
    id: `parity.${row}`,
    ...(t.chance(0.7) ? { target: t.pick([0.55, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) } : {}),
    ...(t.chance(0.3) ? { scale: t.pick([0.2, 0.3, 0.5, 0.8, 1.2, 1.5]) } : {}),
    knobs: Array.from({ length: t.int(1, 6) }, (_, i) => randomKnob(t, i, used)),
  };
}

function randomPresentation(t) {
  const presentation = {};
  for (const [key, values] of Object.entries(Flow.PRESENTATION))
    if (t.chance(0.35)) presentation[key] = t.chance(0.1) ? null : t.pick(values);
  return presentation;
}

// 오늘의 선택: 컨디션 · 모드 · 비교 판 · 표시 설정과 손으로 정한 잠금 · 앞선 근거.
function randomDay(t, input) {
  const presentation = randomPresentation(t);
  const declaredA = Flow.declaredFrom(input, presentation);
  assert.deepEqual(declaredA, Old.declaredFrom(input, presentation), 'declaredFrom');
  const knobs = { ...declaredA.knobs };
  for (const knob of input.knobs)
    if (t.chance(0.12)) knobs[knob.id] = t.int(0, knob.values.length - 1);
  const mode = t.weighted([
    ['auto', 0.6],
    ['fixed', 0.1],
    ['easier', 0.15],
    ['harder', 0.15],
  ]);
  return {
    declared: { ...(mode === 'auto' && t.chance(0.5) ? {} : { mode }), knobs },
    condition: t.pick([null, null, 'good', 'okay', 'tired', 'tired', 'no_time']),
    ...(t.chance(0.08) ? { arm: 'baseline' } : {}),
  };
}

// 손으로 지은 기억 — 쉬었다 돌아옴 · 어긋난 칸(범위 밖 자리 · 판이 다른 기억)을 섞는다.
function randomMemory(t, input) {
  const estimate = () => ({ theta: t.int(-40, 80) / 10, n: t.int(0, 60), reversals: t.int(0, 6) });
  return {
    v: 2,
    content: input.id,
    specVersion: t.chance(0.05) ? 2 : 1,
    at: later(-t.pick([0.5, 1, 3, 13, 15, 40]), NOW),
    estimates: { content: estimate(), pace: estimate() },
    indices: Object.fromEntries(
      input.knobs.map(k => [k.id, t.chance(0.1) ? 99 : t.int(0, k.values.length - 1)]),
    ),
    latencies: Array.from({ length: t.int(0, 8) }, () => t.int(500, 30000)),
  };
}

function randomObservation(t) {
  if (t.chance(0.03))
    return t.pick([
      { outcome: 'maybe' },
      { outcome: 'success', pressure: 2 },
      { outcome: 'fail', assisted: 'yes' },
      { outcome: 'success', latencyMs: -1 },
    ]);
  return {
    outcome: t.weighted([
      ['success', 0.5],
      ['fail', 0.2],
      ['timeout', 0.12],
      ['skip', 0.09],
      ['void', 0.09],
    ]),
    ...(t.chance(0.2) ? { assisted: true } : {}),
    ...(t.chance(0.1) ? { repeat: true } : {}),
    ...(t.chance(0.6) ? { pressure: t.int(0, 120) / 100 } : {}),
    ...(t.chance(0.7) ? { latencyMs: t.int(500, 60000) } : {}),
  };
}

const settingsOf = (old, label) => {
  const { level, ...rest } = old;
  assert.equal(level, null, `${label}: the old level is null without items`);
  return rest;
};

// 응답 하나 뒤의 상태를 견준다. 도움 손잡이가 있으면 그 제안도.
function compareState(t, a, b, input, at, label) {
  assert.deepEqual(b.settings(), settingsOf(a.settings(), label), `${label} settings`);
  assert.equal(b.quietStreak(), a.quietStreak(), `${label} quiet`);
  assert.equal(b.steadyStreak(), a.steadyStreak(), `${label} steady`);
  assert.equal(b.lessHelpAllowed(), a.lessHelpAllowed(), `${label} lessHelpAllowed`);
  assert.deepEqual(b.floor(), a.floor(), `${label} floor`);
  assert.deepEqual(b.latencies(), a.latencies(), `${label} latencies`);
  assert.deepEqual(b.last(), a.last(), `${label} last`);
  assert.deepEqual(
    Flow.stuckFor({ latencies: b.latencies() }),
    OldLines.stuckFor({ latencies: a.latencies() }),
    `${label} stuck`,
  );
  const support = input.knobs.find(k => k.kind === 'support' && k.follows !== 'declared');
  if (!support) return;
  const step = streaks => ({
    at: b.settings().indices[support.id],
    last: support.values.length - 1,
    ...streaks,
    declinedAt: t.chance(0.3) ? later(-t.int(1, 20), at) : null,
    now: at,
  });
  const asked = step({ streak: b.quietStreak(), steady: b.steadyStreak() });
  assert.deepEqual(Flow.supportStep(asked), OldLines.supportStep(asked), `${label} supportStep`);
}

function compareLine(t, event, label) {
  const options = {
    level: t.pick(['easy', 'standard']),
    ...(t.chance(0.4) ? { words: WORDS } : {}),
  };
  assert.deepEqual(Flow.line(event, options), OldLines.line(event, options), `${label} line`);
}

const seen = {
  intro: new Set(),
  because: new Set(),
  rows: 0,
  responses: 0,
  accepted: 0,
  errors: 0,
};

function playSession(t, a, b, input, at, label) {
  for (let i = 0, count = t.int(5, 35); i < count; i += 1) {
    const here = `${label} #${i}`;
    if (t.chance(0.08)) {
      const accepted = [a.acceptLessHelp(), b.acceptLessHelp()];
      assert.deepEqual(accepted[1], accepted[0], `${here} acceptLessHelp`);
      if (accepted[0]) {
        seen.accepted += 1;
        seen.because.add(accepted[0].because);
        compareLine(t, accepted[0], here);
      }
    }
    const observation = randomObservation(t);
    const results = [outcome(() => a.observe(observation)), outcome(() => b.observe(observation))];
    if (results[0].error) {
      seen.errors += 1;
      assert.deepEqual(results[1], results[0], `${here} error`);
      continue;
    }
    const [old, next] = results.map(r => r.value);
    assert.deepEqual(next.change, old.change, `${here} change`);
    assert.equal(next.evidence, old.evidence, `${here} evidence`);
    assert.deepEqual(next.settings, settingsOf(old.settings, here), `${here} result settings`);
    if (old.change) {
      seen.because.add(old.change.because);
      compareLine(t, old.change, here);
    }
    seen.responses += 1;
    compareState(t, a, b, input, at, here);
  }
}

function startBoth(options, label) {
  const runs = [outcome(() => Old.start(options)), outcome(() => Flow.start(options))];
  if (runs[0].error) {
    assert.deepEqual(runs[1], runs[0], `${label} start error`);
    seen.errors += 1;
    return null;
  }
  const [a, b] = runs.map(r => r.value);
  assert.deepEqual(b.intro(), a.intro(), `${label} intro`);
  seen.intro.add(a.intro().code);
  for (const change of a.intro().opening) seen.because.add(change.because);
  return [a, b];
}

function endBoth(t, a, b, at, label) {
  assert.deepEqual(b.trace(), a.trace(), `${label} trace`);
  assert.deepEqual(b.changes(), a.changes(), `${label} changes`);
  const memory = a.memory(at);
  assert.deepEqual(b.memory(at), memory, `${label} memory`);
  compareLine(t, a.intro(), `${label} intro`);
  return memory;
}

function row(n) {
  const t = tools(seeded(20261119 + n * 7919));
  const input = randomSpec(t, n);
  let memory = t.chance(0.25) ? randomMemory(t, input) : null;
  let at = NOW;
  for (let session = 0, count = t.chance(0.4) ? 2 : 1; session < count; session += 1) {
    const label = `row ${n} session ${session}`;
    const options = {
      spec: input,
      now: t.chance(0.01) ? 'yesterday' : at,
      ...(memory ? { memory } : {}),
      ...(session === 0 && !memory && t.chance(0.2)
        ? { prior: { content: t.int(-30, 70) / 10 } }
        : {}),
      ...randomDay(t, input),
      ...(t.chance(0.01) ? { condition: 'sad' } : {}),
    };
    const runs = startBoth(options, label);
    if (!runs) return;
    playSession(t, runs[0], runs[1], input, at, label);
    memory = endBoth(t, runs[0], runs[1], at, label);
    at = later(t.pick([0.5, 1, 2, 7, 15, 30]), at);
  }
  seen.rows += 1;
}

test(`${ROWS.toLocaleString('en')} random rows without items: the new Flow answers as the old one does`, () => {
  for (let n = 0; n < ROWS; n += 1) row(n);
  // 열들이 무디지 않은지: 시작 코드 · 바뀜의 까닭이 고루 나왔고, 받아들임과 틀린 입력도 지났다.
  assert.ok(seen.rows >= ROWS * 0.95, `${seen.rows} rows played to the end`);
  assert.ok(seen.responses > ROWS * 10, `${seen.responses} responses`);
  assert.deepEqual([...seen.intro].sort(), [
    'start.baseline',
    'start.default',
    'start.fixed',
    'start.memory',
    'start.prior',
    'start.returning',
    'start.tired',
  ]);
  for (const reason of [
    'steady-success',
    'comfortable-success',
    'quiet-streak',
    'content-miss',
    'time-ran-out',
    'time-pressure',
    'more-help',
    'help-needed',
    'accepted-less-help',
    'returning',
    'memory',
    'prior',
    'tired',
    'declared-easier',
    'declared-harder',
  ])
    assert.ok(seen.because.has(reason), `a change because ${reason}`);
  assert.ok(seen.accepted > 0 && seen.errors > 0);
});
