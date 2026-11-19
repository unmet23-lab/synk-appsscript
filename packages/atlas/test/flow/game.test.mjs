// 옛 시험 tests/atlas-game-flow*.test.js 가운데 알고리즘에 닿는 장면을 새 순간 맞춤(src/flow)에 다시 건다 — 코치 겉 없이
// start · observe · line · supportStep만으로. 옛 겉(game-flow.js createLive)이 하던 「도움 줄이기 제안 = supportStep + lessHelpAllowed」
// 조합은 아래 offer로 옮겨 적었다(새 코치의 live가 같은 조합을 맡는다).
// 뺀 것: 저장 포트(createFlowPort) · 코치 겉(createLive) 장면 — Trail 기록과 증거 · 오늘 상태의 하루 만료 · 비우기와 다른 탭 ·
// 기기에 남긴 표시 설정 · 문항 고르기(pick) · 같은 제시의 뒤 답(idempotency) · 판정할 수 없는 답(assessability). 이것들은 코치 쪽 시험이
// 맡는다(단계 4 계획 §23-4). 문항 고르기는 새 길에서 두뇌의 recommend와 같아 순간 맞춤이 고르지 않는다.
// 바꾼 것: 옛 장면의 내용 정의에는 items가 있다. 그대로 두고 새 뜻으로 단언한다 — 문항 단계는 움직이지 않고 낸 단계는 관찰만 한다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, later, NOW } from './legacy.mjs';

const SPEC = {
  id: 'test.cafe.rush',
  items: { levels: [1, 2, 3], weight: 2 },
  knobs: [
    { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
    { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
  ],
};

// 옛 겉의 offerLessHelp와 같은 조합: 제안(supportStep)이 되더라도 방금 바뀐 때라 받아들일 수 없으면 「지금은 아님」.
function offer(run, { declared = {}, declinedAt = null, now }) {
  const support = run.spec.knobs.find(k => k.kind === 'support' && k.follows !== 'declared');
  if (!support || !run.settings().adaptive) return { offer: false, reason: 'not-available' };
  const step = Flow.supportStep({
    at: run.settings().indices[support.id],
    last: support.values.length - 1,
    streak: run.quietStreak(),
    steady: run.steadyStreak(),
    declared: Object.hasOwn(declared.knobs || {}, support.id),
    declinedAt,
    now,
  });
  return step.offer && !run.lessHelpAllowed() ? { offer: false, reason: 'not-now' } : step;
}

test('a game moves the challenge with responses, and each change has a sentence; the item level is only observed', () => {
  const run = Flow.start({ spec: SPEC, now: NOW });
  assert.deepEqual(run.settings().values, { patience: 45, hint: 'normal' });
  const lines = [];
  for (let i = 0; i < 10; i += 1) {
    const out = run.observe({ outcome: 'success', pressure: 0.3, level: 1 + (i % 3) });
    if (out.change) lines.push(Flow.line(out.change));
  }
  assert.ok(
    lines.length >= 1,
    'quiet successes made the content harder, and each change has a sentence',
  );
  assert.ok(
    lines.some(line => line.key === 'raise.pace'),
    'time pressure followed the quiet successes',
  );
  // 문항 단계는 두뇌의 것이라 그 올림 · 내림 줄이 없다. 낸 단계가 추정보다 높으면 도움은 한 칸 더해질 수 있다(관찰 칸이 판단에 든다).
  assert.ok(lines.every(line => !['raise.content', 'ease.content'].includes(line.key)));
});

test('help shown before an answer never raises the challenge', () => {
  const run = Flow.start({ spec: SPEC, now: NOW });
  for (let i = 0; i < 12; i += 1) {
    const out = run.observe({ outcome: 'success', assisted: true, pressure: 0.2, level: 1 });
    assert.ok(!out.change || out.change.direction < 0);
  }
});

test('a response without an answer (audio failed, nothing chosen) moves nothing', () => {
  const run = Flow.start({ spec: SPEC, now: NOW });
  const before = run.settings().indices;
  for (let i = 0; i < 6; i += 1) {
    const out = run.observe({ outcome: 'void', level: 1 });
    assert.equal(out.evidence, false);
    assert.equal(out.change, null);
  }
  assert.deepEqual(run.settings().indices, before);
});

test('a missed customer eases time', () => {
  const run = Flow.start({ spec: SPEC, now: NOW });
  const out = run.observe({ outcome: 'timeout' });
  assert.equal(out.change.kind, 'pace');
  assert.equal(out.settings.values.patience, 52);
  assert.equal(Flow.line(out.change).text, '시간을 조금 더 넉넉하게 드릴게요.');
});

test('memory resumes on the next visit, and says so', () => {
  const first = Flow.start({ spec: SPEC, now: NOW });
  for (let i = 0; i < 12; i += 1) first.observe({ outcome: 'success', pressure: 0.3, level: 1 });
  const reached = first.settings().indices;
  const again = Flow.start({ spec: SPEC, now: later(1), memory: first.memory(NOW) });
  assert.equal(again.intro().code, 'start.memory');
  assert.deepEqual(again.settings().indices, reached);
  assert.equal(Flow.line(again.intro()).text, '지난번에 하던 데서 이어 갈게요.');
  assert.equal(
    Flow.line(Flow.start({ spec: SPEC, now: NOW }).intro()),
    null,
    'a first visit says nothing',
  );
});

test('where help shows at once, steady successes still bring the offer of less help', () => {
  const AUTO = Flow.defineContent({
    id: 'test.auto-help',
    knobs: [{ id: 'clue', kind: 'support', values: ['at-once', 'on-pause', 'on-press'], start: 0 }],
  });
  const run = Flow.start({ spec: AUTO, now: NOW });
  const helped = n => {
    for (let i = 0; i < n; i += 1) run.observe({ outcome: 'success', assisted: true });
  };
  helped(3);
  assert.equal(offer(run, { now: NOW }).reason, 'not-yet');
  helped(1);
  assert.deepEqual(offer(run, { now: NOW }), {
    offer: true,
    from: 0,
    to: 1,
    reason: 'steady-with-help',
  });
  assert.equal(run.acceptLessHelp().because, 'accepted-less-help');
  assert.equal(run.settings().values.clue, 'on-pause');
  assert.equal(offer(run, { now: NOW }).reason, 'not-yet', 'the next step waits for its own run');
});

test('less help is offered after quiet successes, accepted one step at a time, and a no keeps it quiet for two weeks', () => {
  const HELP = {
    id: 'test.help',
    items: { levels: [1, 2, 3] },
    knobs: [{ id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 0 }],
  };
  const three = run => {
    for (let i = 0; i < 3; i += 1) run.observe({ outcome: 'success', level: 1 });
  };
  // 제안은 방금 바뀐 응답이 아닌 차분한 때를 기다린다.
  const calm = (run, options) => {
    for (let i = 0; i < 6 && !offer(run, options).offer; i += 1)
      run.observe({ outcome: 'success', level: 1 });
  };
  const visit = Flow.start({ spec: HELP, now: NOW });
  three(visit);
  calm(visit, { now: NOW });
  assert.deepEqual(offer(visit, { now: NOW }), {
    offer: true,
    from: 0,
    to: 1,
    reason: 'quiet-streak',
  });
  const declinedAt = NOW;
  const next = Flow.start({ spec: HELP, now: later(1), memory: visit.memory(NOW) });
  three(next);
  assert.equal(offer(next, { declinedAt, now: later(1) }).reason, 'declined-recently');
  const after = Flow.start({ spec: HELP, now: later(18), memory: next.memory(later(1)) });
  three(after);
  calm(after, { declinedAt, now: later(18) });
  assert.equal(offer(after, { declinedAt, now: later(18) }).offer, true);
  const accepted = after.acceptLessHelp();
  assert.equal(accepted.because, 'accepted-less-help');
  assert.equal(Flow.line(accepted).text, '말씀하신 대로 도움을 조금 늦게 보여 드릴게요.');
  assert.equal(after.settings().values.hint, 'normal');
});

test('a game passes the settings the person chose; a lock the content set for itself still wins', () => {
  const hint = (presentation, declared = {}) => {
    const knobs = { ...Flow.declaredFrom(SPEC, presentation).knobs, ...declared.knobs };
    return Flow.start({ spec: SPEC, now: NOW, declared: { ...declared, knobs } }).settings();
  };
  assert.equal(hint({ support: 'step' }).values.hint, 'early');
  assert.equal(hint({ support: 'independent' }).values.hint, 'late');
  assert.equal(hint({ support: 'choose' }).values.hint, 'normal');
  assert.equal(hint({ support: 'step' }, { knobs: { hint: 2 } }).values.hint, 'late');
  assert.equal(hint({ support: 'step' }, { mode: 'fixed' }).mode, 'fixed');
  assert.throws(() => Flow.declaredFrom(SPEC, { minutes: 5 }), /presentation accepts only/);
});
