// 능력 줄의 peak(단계 4 계획 §21-3 · 설계 주인 11-16 새벽 덧붙인 물음 4) — 지금 streak 안의 측정 답(그 계열의 첫 만남을 도움 없이 낸 답)
// 가운데 가장 높은 난도다. 놓치거나 도움을 받으면 streak과 함께 비운다. 이 칸이 없던 옛 요약의 줄에 이어 붙인 streak은 그 안의 난도를
// 다 모르므로 끊길 때까지 null이다(「내 위치」는 null이면 streak으로 칸을 풀지 않는다). 규칙마다 tools/mutants/brain.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { EMPTY_SKILL, abilityOf, stepSkill } = await subject('ability/index.mjs');

let tick = 0;
const row = (difficulty, { grade = 'good', unaided = true, lead = true } = {}) => ({
  at: (tick += 1000),
  id: `r${tick}`,
  grade,
  unaided,
  lead,
  difficulty,
  responseFormat: 'binary-choice',
  unknownOption: false,
});
const fold = (rows, from = EMPTY_SKILL) =>
  rows.reduce((skill, next) => stepSkill(skill, next), from);
const pair = line => [line.streak, line.peak];

test('빈 줄의 peak은 null이다', () => {
  assert.equal(EMPTY_SKILL.peak, null);
});

test('peak은 지금 streak 안의 측정 답 가운데 가장 높은 난도다 — level(마지막 측정 답의 난도)과 다르다', () => {
  const line = abilityOf([row(2), row(3), row(1)]);
  assert.deepEqual([line.streak, line.level, line.peak], [3, 1, 3]);
});

test('혼자 놓치면 streak과 함께 비우고, 다음 측정 답이 새 streak의 처음이 된다', () => {
  const missed = fold([row(3), row(2), row(1, { grade: 'again' })]);
  assert.deepEqual(pair(missed), [0, null]);
  assert.deepEqual(pair(fold([row(1)], missed)), [1, 1]);
});

test('도움을 받으면 streak과 함께 비운다(답 없이 본 도움 · 도움 뒤의 답)', () => {
  const looked = fold([row(3), row(2, { grade: null, unaided: false })]);
  assert.deepEqual(pair(looked), [0, null]);
  const aided = fold([row(3), row(2, { unaided: false })]);
  assert.deepEqual(pair(aided), [0, null]);
  assert.deepEqual(pair(fold([row(2)], aided)), [1, 2]);
});

test('복습(첫 만남이 아닌 답)을 맞히면 streak과 peak이 그대로이고, 놓치면 비운다', () => {
  assert.deepEqual(pair(fold([row(3), row(1, { lead: false })])), [1, 3]);
  assert.deepEqual(pair(fold([row(3), row(1, { lead: false, grade: 'again' })])), [0, null]);
});

test('peak 칸이 없던 옛 요약의 줄에 이어 붙이면 그 streak이 끊길 때까지 null이다(엄격 — 조건 3)', () => {
  const old = Object.freeze({ theta: 0.4, n: 6, streak: 3, level: 2, lastAt: 0 });
  assert.deepEqual(pair(fold([row(3), row(1)], old)), [5, null], '앞 streak 세 답의 난도를 모른다');
  assert.deepEqual(
    pair(fold([row(2, { lead: false })], old)),
    [3, null],
    '복습을 맞혀도 모르는 그대로',
  );
  assert.deepEqual(
    pair(fold([row(1, { grade: 'again' }), row(2)], old)),
    [1, 2],
    '끊긴 뒤의 streak은 처음부터 안다',
  );
});

test('난도를 모르는 측정 답이 끼면 그 streak의 peak은 null이다', () => {
  assert.deepEqual(pair(fold([row(undefined)])), [1, null]);
  assert.deepEqual(pair(fold([row(2), row(undefined), row(3)])), [3, null]);
});

test('peak은 더하는 칸일 뿐이다 — θ · n · streak · level · lastAt은 peak을 지운 줄에 이어 붙여도 같다', () => {
  const rest = ({ peak, ...line }) => line;
  const rows = [
    row(1),
    row(3),
    row(2, { lead: false }),
    row(2, { unaided: false }),
    row(3),
    row(1, { grade: 'again' }),
    row(2),
  ];
  let line = EMPTY_SKILL;
  for (const next of rows) {
    const without = stepSkill(rest(line), next);
    line = stepSkill(line, next);
    assert.deepEqual(rest(without), rest(line));
  }
});
