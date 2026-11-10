// 기억 1판의 간격 모양(설계 §3-2 「간격의 모양」 · 시제품 prototype/intervals.mjs를 옮겼다). FSRS-6 기본 매개변수 · 목표 보유율 0.9 · 최대 60일.
// 「제때」 = 돌아올 때가 된 바로 그때. 같은 자리(6시간) 안에는 다시 만나지 않으므로 놓친 뒤의 첫 만남은 하루 뒤로 둔다.
// 설계서가 적은 자릿수로 맞댄다(10일 아래는 소수 한 자리, 그 위는 정수).
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { PARAMS, createMemory } = await subject();
const DAY = 86_400_000;
const T0 = Date.parse('2026-12-01T09:00:00Z');

function walk(grades, params = PARAMS) {
  const memory = createMemory(params);
  const answers = [];
  const gaps = [];
  let at = T0;
  for (const grade of grades) {
    answers.push({ at, grade });
    const gap = Math.max(memory.intervalDays(memory.fold(answers)), grade === 'again' ? 1 : 0);
    gaps.push(gap < 10 ? Math.round(gap * 10) / 10 : Math.round(gap));
    at += gap * DAY;
  }
  return gaps;
}
const six = grade => Array(6).fill(grade);

test('고르는 꼴을 계속 혼자 맞히면(약한 성공) 1.3 → 2.9 → 5.9 → 12 → 21 → 38일', () => {
  assert.deepEqual(walk(six('weak')), [1.3, 2.9, 5.9, 12, 21, 38]);
});

test('만들어 내는 꼴을 계속 혼자 맞히면(Good) 2.3 → 12 → 50 → 60일(상한)', () => {
  assert.deepEqual(walk(six('good')), [2.3, 12, 50, 60, 60, 60]);
});

test('고르는 꼴로 세 번 맞힌 뒤 조립으로 넘어가면 5.9 → 20 → 59일', () => {
  assert.deepEqual(
    walk(['weak', 'weak', 'weak', 'good', 'good', 'good']),
    [1.3, 2.9, 5.9, 20, 59, 60],
  );
});

test('처음에 놓치면 다음 날 오고, 그 뒤 제때 맞히면 0.9 → 1.8 → 3.4 → 6.1 → 11일', () => {
  assert.deepEqual(walk(['again', ...Array(5).fill('weak')]), [1, 0.9, 1.8, 3.4, 6.1, 11]);
});

test('세 번 맞힌 뒤 놓치면 처음으로 돌아가고, 다시 맞히면 1.6 → 2.5일', () => {
  assert.deepEqual(
    walk(['weak', 'weak', 'weak', 'again', 'weak', 'weak']),
    [1.3, 2.9, 5.9, 1, 1.6, 2.5],
  );
});

test('고르는 꼴도 Good으로 치면(증가분 1.0) 두 번에 12일 · 세 번에 50일 — 약한 성공을 둔 까닭', () => {
  assert.deepEqual(walk(six('weak'), { ...PARAMS, weakWeight: 1 }).slice(0, 3), [2.3, 12, 50]);
});
