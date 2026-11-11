// 설계 §1 표 4 · 7 — 작업 난도(난도 1판)가 학습자를 따라가는가. 가상 학습자의 진짜 능력 a로 맞힐 확률이
// 찍기 바닥 + (1 − 바닥) × σ(a − 문항 난도)인 세계에서(넷 중 고르기 · 난도 1 · 2 · 3 문항이 넉넉하다), 처음 온 사람에게
// 새 문항만 낸다(같은 진도 묶음 — 난도 맞음으로 고른다). 진짜 능력을 아니까 예측 오차는 「예상 성공 − 참 확률」로 잰다
// (결과와의 제곱 오차는 쉬운 문항일수록 작아지는 값이라 창끼리 견주는 잣대가 못 된다).
//   4. 늘 조금 어려운 정도다 — 15답 안에 성공률이 0.75~0.85(11~15번째 답, 학습자 300명 평균). 더 어려운 문항이 있는 능력
//      (a = 0 · 0.5 · 1)에 건다 — 문항 은행의 가장 어려운 난도로도 0.8이 안 되는 사람은 어느 엔진도 띠 안에 둘 수 없다
//      (그런 능력이 있는지는 단계 1의 빌드 검사 「난도가 한 값뿐인 능력」 · 문항 건강이 본다).
//   7. 쓸수록 나에게 맞아진다 — 능력이 퍼진 학습자 무리에서 예측 오차가 앞 다섯 답보다 26~30번째 답에서 작다.
// 출발값(설계 §3-3 θ 걸음 = 0.25 + 0.9 / (1 + n / 4))의 바닥 0.25 때문에 θ가 계속 조금씩 흔들려, 능력이 출발값과 같은 사람은
// 오차가 오히려 커진다 — 바닥을 0.1로 낮춘 판이 고정 능력 · 천천히 배우는 사람 모두에서 조금 낫다(단계 2 기록 §9, 다음 매개변수 판 후보).
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';

const brain = await subject();
const { PARAMS, choose, createLearner, createMemory, present, record, startSession } = brain;
const memory = createMemory();
const T0 = Date.parse('2026-12-01T09:00:00Z');
const P = { ...PARAMS, newPerSession: 60, newPerDay: 120 };
const SKILL = 'ko.listening.detail';
const ITEMS = [1, 2, 3].flatMap(d =>
  Array.from({ length: 40 }, (_, i) => ({
    itemKey: `d${d}.${i}`,
    familyKey: `d${d}.${i}`,
    skillId: SKILL,
    difficulty: d,
    responseFormat: 'single-choice',
    order: 0,
  })),
);
const sigmoid = x => 1 / (1 + Math.exp(-x));
const truthOf = (a, item) => 0.25 + 0.75 * sigmoid(a - PARAMS.difficultyLogit[item.difficulty]);
const mean = list => list.reduce((x, y) => x + y, 0) / list.length;

// 한 사람에게 새 문항 n개: 답마다 (예상 p, 참 확률, 결과)를 돌려준다. 후보는 아직 안 낸 계열만이다 — 놓친 문항의 「다시」(0층)는
// 기억 항이 든 예상이라 능력만 보는 참 확률과 견줄 수 없다(GPT 끝 판 GB3: 전에는 다시가 섞여 표 4 · 7이 설명과 다른 조건을 쟀다).
function runLearner(a, seed, n) {
  const random = rng(seed);
  const learner = createLearner();
  startSession(learner, T0, P);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const now = T0 + i * 20_000;
    const unseen = ITEMS.filter(item => !learner.shown.some(row => row.family === item.familyKey));
    const row = choose(unseen, learner, memory, now, { params: P, seed: `s${seed}` })[0];
    assert.equal(row.tier, 2, '새 문항만 낸다');
    const truth = truthOf(a, row.item);
    const correct = random() < truth;
    present(learner, row);
    record(learner, memory, row.item, { correct, target: row.target }, now, P);
    out.push({ p: row.p, truth, correct });
  }
  return out;
}

test('§1 표 4 — 더 어려운 문항이 있는 능력이면 11~15번째 답의 성공률이 0.75~0.85다', () => {
  for (const a of [0, 0.5, 1]) {
    const runs = Array.from({ length: 300 }, (_, i) => runLearner(a, 7000 + i, 15));
    const rate = mean(runs.flatMap(answers => answers.slice(10).map(x => (x.correct ? 1 : 0))));
    assert.ok(rate >= 0.75 && rate <= 0.85, `능력 ${a}: 성공률 ${rate.toFixed(3)}`);
  }
});

test('§1 표 7 — 능력이 퍼진 학습자 무리에서 예측 오차가 답이 쌓일수록 준다', () => {
  const runs = [0, 0.5, 1, 1.5, 2].flatMap(a =>
    Array.from({ length: 60 }, (_, i) => runLearner(a, 8000 + 100 * a + i, 30)),
  );
  const error = (from, to) =>
    mean(runs.flatMap(answers => answers.slice(from, to).map(x => Math.abs(x.p - x.truth))));
  const early = error(0, 5);
  const late = error(25, 30);
  assert.ok(late < early, `앞 다섯 답 ${early.toFixed(4)} · 26~30번째 ${late.toFixed(4)}`);
});
