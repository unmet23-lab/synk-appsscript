import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { RunnerModel, driveDemo } from './core.mjs';
import { INSTRUCTIONS } from './instructions.mjs';
import { LISTENING_CHECKS, createListeningCheck } from './listening-check.mjs';
import { scoreRun, skillReport, skillOf, SKILL_LABEL, STEP_WORD } from './report.mjs';
import { instructionMetadata, actionEvidence } from './learning.mjs';

const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const answer = (id, correct, texted = false) => { const item = INSTRUCTIONS.find((x) => x.id === id); return { ...item, correct, texted, steps: item.steps.map((s) => ({ ...s, status: correct ? 'done' : 'missed' })) }; };

test('결과 별: 다 해내면 셋, 둘까지 놓치면 둘, 절반이면 하나 — 끝까지 달리지 못한 판은 하나까지', () => {
  const nine = (missed) => Array.from({ length: 9 }, (_, i) => answer(INSTRUCTIONS[i].id, i >= missed));
  assert.equal(scoreRun(nine(0), { completed: true }).stars, 3);
  assert.equal(scoreRun(nine(2), { completed: true }).stars, 2);
  assert.equal(scoreRun(nine(4), { completed: true }).stars, 1);
  assert.equal(scoreRun(nine(5), { completed: true }).stars, 0);
  assert.equal(scoreRun(nine(0), { completed: false }).stars, 1, '부딪혀 멈춘 판');
  assert.equal(scoreRun([], { completed: true }).stars, 0);
  const s = scoreRun([answer('left', true), answer('no-jump', false, true), answer('left-jump', true)], { completed: true });
  assert.deepEqual([s.total, s.correct, s.missed, s.texted], [3, 2, 1, 1]);
  assert.deepEqual(s.bySkill['ko.listening.negation'], { heard: 1, done: 0 });
  assert.deepEqual(s.bySkill['ko.listening.sequence'], { heard: 1, done: 1 });
});

test('부탁 열여섯 개는 모두 세 듣기 항목 가운데 하나로 묶이고, 동작 상태마다 말이 있다', () => {
  for (const item of INSTRUCTIONS) assert.ok(SKILL_LABEL[skillOf(item)], item.id);
  assert.deepEqual(Object.keys(STEP_WORD).sort(), ['different', 'done', 'missed', 'timing']);
});

test('90초 시연 한 판의 기록으로 결과 숫자가 맞게 나온다', () => {
  const model = new RunnerModel({ seed: 4 });
  for (let i = 0; i < 9100 && !model.finished; i++) { driveDemo(model); model.step(0.01); }
  const s = scoreRun(model.answers, { completed: model.reason === 'tour' });
  assert.equal(s.total, model.answers.length); assert.equal(s.correct, model.correct); assert.equal(s.stars, 3);
  assert.ok(s.total >= 7, `90초에 부탁 ${s.total}개`);
});

test('듣기 능력 기록은 듣기 확인(보기 고르기)의 응답만 읽는다 — 달리기 동작은 바꾸지 못한다', () => {
  const rows = new Map(), coach = createGame({ gameId: 'korean-runner', map, storage: { getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) } });
  const before = skillReport(coach.summary());
  assert.deepEqual(before.map((r) => r.status), ['unseen', 'unseen', 'unseen']);
  // 달리기 동작(평가하지 않음)만으로는 그대로다
  const run = INSTRUCTIONS.find((x) => x.id === 'no-jump'), pid = coach.present(instructionMetadata(run));
  coach.delivery(pid, { audio: 'completed' }); coach.answer(pid, actionEvidence({ steps: [{ status: 'done' }] }, true));
  assert.deepEqual(skillReport(coach.summary()).map((r) => r.status), ['unseen', 'unseen', 'unseen']);
  // 듣기 확인 하나를 혼자 맞히면 그 항목이 움직인다
  const check = createListeningCheck(coach), item = LISTENING_CHECKS.find((x) => x.id === 'check-not-middle'), token = check.begin(item);
  check.delivery(token, 'completed'); check.answer(item.correct);
  const after = skillReport(coach.summary()), neg = after.find((r) => r.id === 'ko.listening.negation');
  assert.notEqual(neg.status, 'unseen'); assert.equal(neg.n, 1); assert.equal(neg.correct, 1);
  assert.deepEqual(after.filter((r) => r.id !== 'ko.listening.negation').map((r) => r.status), ['unseen', 'unseen']);
});
