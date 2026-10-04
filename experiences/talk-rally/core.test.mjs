import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ITEMS, PRACTICE, SKILL_LABEL, ROUND_SIZE } from './content.mjs';
import { composeRound, scoreRound, pointsFor, isSmash, flightTime, swipeLane, validateItems, rng, shuffled } from './core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

test('원고: 보기 셋·정답 하나·학습 항목·설명·음성 이름이 맞고, 연습도 같은 규칙', () => {
  assert.deepEqual(validateItems(ITEMS), []);
  assert.deepEqual(validateItems([PRACTICE]), []);
  assert.ok(ITEMS.length >= 40, '문항 40개 이상(10-03 26개에서 늘림)');
  assert.ok(ITEMS.filter((x) => x.difficulty === 2).length >= 15, '조금 어려운 말 15개 이상');
  // 아틀라스는 학습 항목·난도마다 말마다의 첫 응답 중 최근 12개로 다음 단계를 정한다(atlas/learning.js). 쉬운 말이 12개를 넉넉히 넘어야
  // 처음에 4개쯤 틀린 사람도 나머지를 맞히면 조금 어려운 말로 넘어간다(11개면 30일 동안 쉬운 말만 돈다)
  for (const skill of Object.keys(SKILL_LABEL)) assert.ok(ITEMS.filter((x) => x.skill === skill && x.difficulty === 1).length >= 14, `${skill} 쉬운 말 14개 이상`);
  for (const skill of Object.keys(SKILL_LABEL)) assert.ok(ITEMS.filter((x) => x.skill === skill).length >= 8, `${skill} 8개 이상`);
});

test('원고: 음성 파일이 모두 있고, 확인 목록의 말이 원고와 같다', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'assets/voice/manifest.json'), 'utf8'));
  const byId = new Map(manifest.lines.map((l) => [l.id, l]));
  for (const x of [PRACTICE, ...ITEMS]) {
    assert.ok(existsSync(path.join(root, x.voice)), `${x.id} 음성 파일`);
    assert.equal(byId.get(x.id)?.text, x.line, `${x.id} 음성이 지금 원고로 구워졌다`);
    assert.ok(byId.get(x.id).durationSeconds < 2.5, `${x.id} 말이 너무 길지 않다`);
  }
});

test('원고: 보기 셋이 서로 같은 말로 시작하지 않는 문항이 대부분(위치·첫 글자로 정답이 드러나지 않게)', () => {
  // 정답이 늘 가장 길거나 가장 짧으면 길이로 맞힐 수 있다 — 한쪽으로 쏠리지 않았는지 본다
  let longest = 0;
  for (const x of ITEMS) if (x.answer.length === Math.max(...x.options.map((o) => o.length))) longest += 1;
  assert.ok(longest / ITEMS.length < 0.75, `정답이 가장 긴 보기인 비율 ${longest}/${ITEMS.length}`);
});

test('한 판: 12개, 두 학습 항목 4개 이상씩, 처음이면 난도 1부터, 쉬운 것부터', () => {
  const round = composeRound(ITEMS, { firstTime: true });
  assert.equal(round.length, ROUND_SIZE);
  for (const skill of Object.keys(SKILL_LABEL)) assert.ok(round.filter((x) => x.skill === skill).length >= 4);
  assert.ok(round.every((x, i) => i === 0 || round[i - 1].difficulty <= x.difficulty));
  assert.ok(round.slice(0, 6).every((x) => x.difficulty === 1));
});

test('한 판: 아틀라스 필요 순서가 앞에 들어가고, 순서가 없으면 판마다 섞인다', () => {
  const ranked = ['f12', 'w08', 'f11'];
  const round = composeRound(ITEMS, { ranked }).map((x) => x.id);
  for (const id of ranked) assert.ok(round.includes(id));
  const a = composeRound(ITEMS, { seed: 2 }).map((x) => x.id).join(), b = composeRound(ITEMS, { seed: 3 }).map((x) => x.id).join();
  assert.notEqual(a, b);
});

test('점수: 100점 + 랠리 보너스(최대 +100), 세 번 연속마다 스매시 +50, 공이 닿기 전에 고르면 빠르게 +50', () => {
  assert.equal(pointsFor(1), 100);
  assert.equal(pointsFor(1, { quick: true }), 150);
  assert.equal(pointsFor(3, { quick: true }), 140 + 50 + 50);
  assert.equal(pointsFor(2), 120);
  assert.equal(isSmash(3), true); assert.equal(isSmash(4), false); assert.equal(isSmash(0), false);
  assert.equal(pointsFor(3), 140 + 50);
  assert.equal(pointsFor(6), 200 + 50);
  assert.equal(pointsFor(9), 200 + 50);
});

test('결과: 맞힘·최고 랠리·별·빠른 대답·도움(예전 기록의 놓침도 센다)', () => {
  const r = (correct, more = {}) => ({ itemId: 'x', skill: 'ko.listening.main', correct, points: correct ? 100 : 0, ...more });
  const s = scoreRound([r(true, { quick: true }), r(true, { quick: true }), r(true), r(false, { quick: true }), r(null), r(true, { helped: true })]);
  assert.equal(s.correct, 4); assert.equal(s.missed, 1); assert.equal(s.bestRally, 3); assert.equal(s.total, 6);
  assert.equal(s.quick, 2, '틀린 답은 빨라도 빠른 대답이 아니다'); assert.equal(s.helped, 1);
  assert.equal(scoreRound(Array(12).fill(r(true))).stars, 3);
});

test('공 속도: 랠리가 이어질수록 빨라지되 2초 아래로는 안 가고, 천천히 모드는 1.4배(공은 기다려 주니 보너스 시간이다)', () => {
  assert.equal(flightTime({ rally: 0 }), 2.8);
  assert.ok(flightTime({ rally: 5 }) < flightTime({ rally: 1 }));
  assert.equal(flightTime({ rally: 50 }), 2.0);
  assert.equal(flightTime({ rally: 0, slow: true }), 3.92);
  assert.ok(flightTime({ difficulty: 2 }) > flightTime({ difficulty: 1 }));
});

test('긋기 방향: 위로 곧게는 가운데, 왼쪽 위·오른쪽 위는 그쪽, 아래로·짧게는 고르지 않음', () => {
  assert.equal(swipeLane(0, -120), 1);
  assert.equal(swipeLane(-90, -90), 0);
  assert.equal(swipeLane(90, -90), 2);
  assert.equal(swipeLane(20, -120), 1);
  assert.equal(swipeLane(0, 120), null);
  assert.equal(swipeLane(5, -10), null);
  assert.equal(swipeLane(-120, 10), null);
});

test('섞기: 같은 씨앗이면 같은 순서', () => {
  assert.deepEqual(shuffled([1, 2, 3, 4, 5], rng(7)), shuffled([1, 2, 3, 4, 5], rng(7)));
});
