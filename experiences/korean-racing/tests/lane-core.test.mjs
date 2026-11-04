// 차선 레이스의 셈(lane-core.js)과 WORLD 자전거 판 길 높이(course.js rideY). LAB 숫자가 그대로인지가 첫째다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LANES, CAR_TRACK, RIDE_TRACK, STEER_RATE, courseToRoad, displaySpeed, laneOf, gateWait, targetSpeed, listeningRoll, rivalBandFactor } from '../lane-core.js';
import { pathY, rideY, RIDE_GATE_FIRST, RIDE_GATE_SPACING } from '../course.js';
import { gatePosition } from '../race-pacing.js';

test('LAB 숫자: 차선 · 접촉 · 꺾기 · 도착 뒤 속도는 10-23 판 그대로', () => {
  assert.deepEqual([...LANES], [-3.45, 0, 3.45]);
  assert.equal(STEER_RATE, 5.8);
  assert.deepEqual({ ...CAR_TRACK.contact }, { halfWidth: 1.16, halfLength: 2.3 });
  assert.deepEqual({ ...CAR_TRACK.coast }, { open: 42, edge: 32, contact: 28 });
  assert.equal(CAR_TRACK.speedScale, 1); assert.equal(CAR_TRACK.stopForReview, true); assert.equal(CAR_TRACK.raceMusic, null);
  assert.equal(CAR_TRACK.words.boost, '부스터');
});

test('laneOf: 옛 식 clamp(round((offset+3.45)/3.45),0,2)와 같다', () => {
  for (let o = -5.05; o <= 5.05; o += .05) assert.equal(laneOf(o), Math.max(0, Math.min(2, Math.round((o + 3.45) / 3.45))));
});

test('gateWait: 음성 · 고르기 · 펼침만 기다리고, 멈춤선 밖에서는 기다리지 않는다', () => {
  const base = { announced: true, judged: false, distance: 40, hearing: false, campaign: true, auto: false, chosen: true, expanded: false };
  assert.equal(gateWait(base).waiting, false);
  assert.equal(gateWait({ ...base, hearing: true }).voice, true);
  assert.equal(gateWait({ ...base, hearing: true, distance: 70 }).waiting, false);
  assert.equal(gateWait({ ...base, chosen: false }).choice, true);
  assert.equal(gateWait({ ...base, chosen: false, campaign: false }).waiting, false);   // 낱말 코스는 고르기를 기다리지 않는다
  assert.equal(gateWait({ ...base, chosen: false, auto: true }).waiting, false);
  assert.equal(gateWait({ ...base, expanded: true, distance: 500 }).waiting, true);    // 펼치면 어디서든
  assert.equal(gateWait({ ...base, judged: true, hearing: true }).waiting, false);
  assert.equal(gateWait({ announced: undefined, judged: undefined, distance: Infinity, hearing: undefined, campaign: true, auto: false, chosen: false, expanded: false }).waiting, false);
});

test('targetSpeed: 대기 0 · 접촉 22 · 갓길 21 · 부스터 42 · 평소 cruise, 맞춤 비율을 곱한다', () => {
  const b = { waiting: false, contactTimer: 0, edge: false, boost: 0, allAnswered: false, cruise: 26, baseCruise: 26 };
  assert.equal(targetSpeed(b), 26);
  assert.equal(targetSpeed({ ...b, waiting: true, boost: 3 }), 0);
  assert.equal(targetSpeed({ ...b, contactTimer: .6 }), 22);
  assert.equal(targetSpeed({ ...b, contactTimer: .5 }), 26);
  assert.equal(targetSpeed({ ...b, edge: true }), 21);
  assert.equal(targetSpeed({ ...b, boost: 1 }), 42);
  assert.equal(targetSpeed({ ...b, allAnswered: true }), 42);
  assert.equal(targetSpeed({ ...b, cruise: 13, boost: 1 }), 21);
});

test('자전거 판: 코스 1m = 길 위 0.4m, 94km/h → 37km/h, 부스터 → 60km/h, 틀려도 안 멈춤', () => {
  assert.equal(courseToRoad(75, RIDE_TRACK), 75);
  assert.equal(courseToRoad(310, RIDE_TRACK), 169);
  assert.equal(courseToRoad(75 + 1000, RIDE_TRACK), 475);
  assert.equal(courseToRoad(310, CAR_TRACK), 310);
  assert.equal(displaySpeed(26, RIDE_TRACK), 37); assert.equal(displaySpeed(42, RIDE_TRACK), 60); assert.equal(displaySpeed(26, CAR_TRACK), 94);
  assert.equal(RIDE_TRACK.stopForReview, false);
  assert.equal(RIDE_TRACK.words.boost, '질주');
  assert.doesNotMatch(RIDE_TRACK.words.expandedHelp, /차가/);
});

test('듣는 동안 구르기: 자전거 판만, 부스터가 끝난 뒤, 멈춤선에서는 그대로 선다. LAB은 언제나 없음', () => {
  const b = { hearing: true, waiting: false, boost: 0 };
  assert.equal(listeningRoll(b, CAR_TRACK), null);
  assert.equal(listeningRoll(b, RIDE_TRACK), RIDE_TRACK.listenRoll);
  assert.equal(listeningRoll({ ...b, boost: 2 }, RIDE_TRACK), null);
  assert.equal(listeningRoll({ ...b, waiting: true }, RIDE_TRACK), null);
  assert.equal(listeningRoll({ ...b, hearing: false }, RIDE_TRACK), null);
  const s = { waiting: false, contactTimer: 0, edge: false, boost: 0, allAnswered: false, cruise: 26, baseCruise: 26 };
  assert.equal(targetSpeed({ ...s, rollSpeed: 13 }), 13);
  assert.equal(targetSpeed({ ...s, rollSpeed: 13, cruise: 20 }), 10);   // 맞춤 속도 비율을 함께 곱한다
  assert.equal(targetSpeed({ ...s, rollSpeed: 13, boost: 1 }), 42);
  assert.equal(targetSpeed({ ...s, rollSpeed: 13, waiting: true }), 0);
  assert.equal(targetSpeed({ ...s, rollSpeed: null }), 26);
  assert.equal(RIDE_TRACK.rivalsMakeRoom, true); assert.equal(CAR_TRACK.rivalsMakeRoom, false);
  assert.ok(RIDE_TRACK.listenRoll * .4 * 3.6 > 10, '듣는 동안에도 굴러간다');
});

test('상대 자리: 맞힌 수만큼 뒤로 밀려나고, 뒤처져도 질주보다 느리며, 처음엔 내 앞이다. LAB은 끔', () => {
  const [taeo, harin] = RIDE_TRACK.rivalHover;
  assert.equal(rivalBandFactor(taeo[0], taeo, 0), 1);
  assert.ok(taeo[0] < 0 && harin[0] < 0, '처음엔 둘 다 앞(1인칭에서 보인다)');
  assert.ok(taeo[0] + taeo[1] * 5 > 0 && harin[0] + harin[1] * 5 > 0, '다 맞히면 둘 다 뒤');
  assert.ok(taeo[0] + taeo[1] * 1 < 0 && harin[0] + harin[1] * 3 < 0, '한 번 맞혔다고 혼자가 되지 않는다');
  assert.ok(rivalBandFactor(500, taeo, 0) * 26 < 42, '질주로는 여전히 앞선다');
  assert.ok(rivalBandFactor(-500, taeo, 0) >= .78);
  assert.ok(rivalBandFactor(10, taeo, 0) > rivalBandFactor(10, taeo, 3), '많이 맞힐수록 덜 따라온다');
  assert.equal(CAR_TRACK.rivalHover, null);
});

test('rideY: 게이트는 고개 위(자리가 코스 게이트와 같다), 지나면 내리막이 경사로 느껴진다', () => {
  for (let i = 0; i < 5; i++) assert.equal(courseToRoad(gatePosition(i), RIDE_TRACK), RIDE_GATE_FIRST + i * RIDE_GATE_SPACING);
  const slope = (s) => (rideY(s + .5) - rideY(s - .5));
  let steepest = 0, climb = 0;
  for (let s = 100; s < 880; s += 1) { steepest = Math.min(steepest, slope(s)); climb = Math.max(climb, slope(s)); }
  assert.ok(steepest < -.08, `내리막 최대 ${steepest}`);   // 지금 길은 2.2%
  assert.ok(climb < .09, `오르막 최대 ${climb}`);
  for (let i = 0; i < 5; i++) {
    const g = RIDE_GATE_FIRST + i * RIDE_GATE_SPACING;
    assert.ok(rideY(g) > rideY(g + 60), `게이트 ${i} 뒤로 내려간다`);
    assert.ok(rideY(g) >= rideY(g - 30) - .35, `게이트 ${i} 앞은 고개로 오르거나 평평`);
  }
  assert.ok(rideY(75) > rideY(865) + 14, '전체가 내려간다');
  assert.ok(rideY(865) > 7, '바다보다 위');
});

test('rideY는 끊기지 않고, LAB 길(pathY)은 그대로다', () => {
  for (let s = 0; s < 2250; s += 1) assert.ok(Math.abs(rideY(s + 1) - rideY(s)) < .16, `s=${s}`);
  assert.equal(pathY(0), 23 + Math.sin(0) * 2.8 + Math.sin(0) * 1.2);
  assert.ok(Math.abs(pathY(500) - (23 + Math.sin(500 / 280) * 2.8 + Math.sin(500 / 100) * 1.2)) < 1e-12);
});
