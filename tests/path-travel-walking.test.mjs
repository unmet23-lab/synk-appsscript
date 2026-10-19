import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWalkingRouter, meters } from '../experiences/path-travel/walking-router.mjs';
import { planTravel, replanTravel, estimateWalkingLeg, DETAIL_PREFERENCE_CATEGORIES, PREFERENCE_LABELS } from '../experiences/path-travel/planner.mjs';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';

const map = JSON.parse(readFileSync(new URL('../experiences/path-travel/assets/jongno-walking.json', import.meta.url), 'utf8'));
const routeLeg = createWalkingRouter(map);
const now = '2026-10-09T03:00:00.000Z';
const base = { date: '2026-10-10', startTime: '10:00', endTime: '18:00',
  origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 3,
  preferences: { food: true, culture: true, tea: true } };
const options = { routeLeg, now, ask: false };
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

test('실제 음식·카페 자료 8가지의 반대 취향은 다른 장소를 고르며 미확인 회피를 보장하지 않는다', () => {
  const input = { ...base, requiredCategories: ['food', 'tea'] };
  for (const [key, category] of Object.entries(DETAIL_PREFERENCE_CATEGORIES)) {
    const yes = planTravel({ ...input, preferences: { ...input.preferences, [key]: true } }, options);
    const no = planTravel({ ...input, preferences: { ...input.preferences, [key]: false } }, options);
    assert.ok(yes.primary && no.primary, key);
    assert.ok(yes.primary.stops.some(stop => stop.place.category === category && stop.place.features[key] === true), key);
    assert.ok(no.primary.stops.every(stop => stop.place.category !== category || stop.place.features[key] !== true), key);
    assert.notDeepEqual(yes.primary.stops.map(stop => stop.placeId), no.primary.stops.map(stop => stop.placeId), key);
    // Catalogue has positive source evidence and null elsewhere, no unsupported
    // assertions that a restaurant or café never serves this item.
    assert.ok(!no.engineAudit.decisionReasons.some(reason => reason.field === key && reason.contribution > 0), key);
    assert.ok(no.primary.stops.every(stop => !stop.reasons.includes(`${PREFERENCE_LABELS[key]} 피하기 반영`)), key);
  }
});

test('실제 OSM에서 구간 걷기·휴식과 질문 답변 미리보기가 같은 재계산 결과로 이어진다', () => {
  const input = { ...base, maxLegWalkMinutes: 20, restEveryMinutes: 60, restDurationMinutes: 10 };
  const result = planTravel(input, { ...options, ask: true });
  assert.ok(result.primary);
  assert.ok(result.primary.stops.some(stop => stop.pauses?.length));
  for (const plan of [result.primary, ...result.alternatives]) {
    assert.ok(plan.legs.every(leg => leg.maxMinutes <= 20));
    assert.ok(plan.endTime <= input.endTime);
    for (const stop of plan.stops) {
      // A long day may stretch a visit; the pauses still come on top and the stretch is explained.
      const pauseMinutes = (stop.pauses ?? []).reduce((sum, pause) => sum + pause.durationMinutes, 0), visit = stop.stayMinutes - pauseMinutes;
      assert.ok(visit >= stop.place.planningStayMinutes);
      if (visit > stop.place.planningStayMinutes) assert.ok(stop.reasons.includes(`고른 시간에 맞춰 ${visit - stop.place.planningStayMinutes}분 더 머물게 잡았어요.`));
      assert.equal(minute(stop.departureTime) - minute(stop.arrivalTime), stop.stayMinutes);
    }
  }
  assert.ok(result.question);
  for (const option of result.question.options) {
    const applied = planTravel({ ...input, preferences: { ...input.preferences, [result.question.about]: option.value } }, options).primary;
    assert.equal(option.preview.planId, applied.id);
    assert.deepEqual(option.preview.walking, { minMinutes: applied.walking.minMinutes, maxMinutes: applied.walking.maxMinutes });
    assert.equal(option.preview.endTime, applied.endTime);
    assert.equal(option.preview.knownAmount, applied.cost.knownAmount);
  }
});

test('실제 OSM 동선의 거리·시간·좌표와 추천 일정이 일치한다', () => {
  const result = planTravel(base, options);
  assert.ok(result.primary);
  for (const plan of [result.primary, ...result.alternatives]) {
    assert.equal(plan.walking.maxMinutes, plan.legs.reduce((sum, leg) => sum + leg.maxMinutes, 0));
    assert.ok(plan.walking.maxMinutes <= base.maxWalkMinutes);
    assert.ok(plan.endTime <= base.endTime);
    for (let i = 0; i < plan.stops.length; i++) {
      const stop = plan.stops[i], leg = plan.legs[i];
      assert.equal(leg.source, 'osm-walking-network');
      assert.equal(minute(leg.arrivalTime) - minute(leg.departureTime), leg.maxMinutes);
      assert.equal(minute(stop.arrivalTime), minute(leg.arrivalTime) + stop.waitMinutes);
      assert.equal(minute(stop.departureTime) - minute(stop.arrivalTime), stop.stayMinutes);
      if (i) assert.equal(plan.stops[i - 1].departureTime, leg.departureTime);
      const geometryMeters = leg.coordinates.slice(1).reduce((sum, point, index) => sum + meters(point, leg.coordinates[index]), 0);
      assert.ok(Math.abs(geometryMeters - leg.distanceMeters) <= 1, `${stop.placeId} geometry ${geometryMeters} vs ${leg.distanceMeters}`);
    }
  }
});

test('실제 길망 주입 뒤에도 취향 반대·장소 교체·걷기 상한이 유지된다', () => {
  const food = planTravel(base, options);
  const noFood = planTravel({ ...base, preferences: { food: false, culture: true } }, options);
  assert.ok(food.primary.stops.some(stop => stop.place.category === 'food'));
  assert.ok(noFood.primary.stops.every(stop => stop.place.category !== 'food'));
  const kept = food.primary.stops[0].placeId, removed = food.primary.stops[1].placeId;
  const replacement = TRAVEL_PLACES.find(place => place.dayPlannerEligible && place.coordinates && !food.primary.stops.some(stop => stop.placeId === place.id)).id;
  const replaced = replanTravel(base, { ...options, lockedIds: [kept], replace: { fromId: removed, toId: replacement } });
  assert.ok(replaced.primary);
  assert.ok(replaced.primary.stops.some(stop => stop.placeId === kept));
  assert.ok(replaced.primary.stops.some(stop => stop.placeId === replacement));
  assert.ok(replaced.primary.stops.every(stop => stop.placeId !== removed));
  assert.ok(replaced.primary.walking.maxMinutes <= base.maxWalkMinutes);
  assert.notEqual(food.primary.id, replaced.primary.id);
  const tiny = planTravel({ ...base, maxWalkMinutes: 0 }, options);
  assert.equal(tiny.primary, null);
});

test('문화 중심과 식사 중심을 같은 코스로 포화시키지 않고 반나절 식사를 반복하지 않는다', () => {
  const food = planTravel({ ...base, stopCount: 5, preferences: { food: true } }, options);
  const culture = planTravel({ ...base, stopCount: 5, preferences: { culture: true } }, options);
  assert.ok(food.primary && culture.primary);
  assert.notDeepEqual(food.primary.stops.map(stop => stop.placeId), culture.primary.stops.map(stop => stop.placeId));
  const cultureCount = plan => plan.stops.filter(stop => stop.place.category === 'culture').length;
  assert.ok(cultureCount(culture.primary) > cultureCount(food.primary));
  for (const plan of [food.primary, ...food.alternatives]) assert.ok(plan.stops.filter(stop => stop.place.category === 'food').length <= 1);
});

test('스냅 출입 연결·보행 접근 미확인을 보존하고 확정 일정이라고 처리하지 않는다', () => {
  const result = planTravel(base, options);
  assert.ok(result.primary.legs.some(leg => leg.connectorMeters > 0 || leg.unknownAccess));
  assert.equal(result.primary.status, 'partial');
  assert.ok(result.primary.checks.some(row => row.kind === 'route' && row.status === 'unknown'));
  assert.match(result.primary.checks.filter(row => row.kind === 'route').map(row => row.reason).join(' '), /출입구|보행 접근/);
});

test('길망에 연결하지 못하면 직선을 실제 경로로 바꾸지 않는다', () => {
  const far = { id: 'far', name: '지도 밖', lat: 37.7, lon: 126.8 };
  const destination = TRAVEL_PLACES.find(place => place.coordinates && place.dayPlannerEligible);
  assert.equal(routeLeg(far, destination), null);
  const leg = estimateWalkingLeg(far, destination, { routeLeg });
  assert.equal(leg.source, 'coordinate-distance-estimate');
  assert.equal(leg.estimated, true);
  assert.equal(leg.coordinates.length, 2);
  assert.match(leg.label, /실제 길이 아님/);
});

test('계단 회피는 지도에 표시된 계단만 피하며 무장애 검증으로 승격하지 않는다', () => {
  const nodes = [[126.98, 37.57], [126.982, 37.57], [126.98, 37.572], [126.982, 37.572]];
  const local = createWalkingRouter({ version: 1, nodes, ways: [
    { kind: 'steps', stairs: true, n: [0, 1] },
    { kind: 'footway', stairs: false, n: [0, 2, 3, 1] },
  ], sourceTimestamp: now });
  const a = { lon: nodes[0][0], lat: nodes[0][1] }, b = { lon: nodes[1][0], lat: nodes[1][1] };
  const direct = local(a, b), noSteps = local(a, b, { stepFree: true });
  assert.equal(direct.steps, true);
  assert.equal(noSteps.steps, false);
  assert.ok(noSteps.distanceMeters > direct.distanceMeters);
  assert.equal(noSteps.unknownAccess, true);
  assert.notEqual(noSteps.stepFreeVerified, true);
});

test('사유지·보행 금지 지름길은 계산에서 제외된다', () => {
  const nodes = [[126.98, 37.57], [126.982, 37.57], [126.98, 37.572], [126.982, 37.572]];
  for (const restriction of [{ access: 'private' }, { foot: 'no' }]) {
    const local = createWalkingRouter({ version: 1, nodes, ways: [
      { kind: 'service', n: [0, 1], ...restriction },
      { kind: 'footway', n: [0, 2, 3, 1] },
    ], sourceTimestamp: now });
    const route = local({ lon: nodes[0][0], lat: nodes[0][1] }, { lon: nodes[1][0], lat: nodes[1][1] });
    assert.ok(route.distanceMeters > 500);
  }
});

test('반복 사용은 같은 결과를 내고 입력 지도 자료를 변경하지 않는다', () => {
  const points = TRAVEL_PLACES.filter(place => place.coordinates && place.dayPlannerEligible).slice(0, 4);
  const before = JSON.stringify(points.map(place => place.coordinates));
  assert.deepEqual(routeLeg(points[0], points[1]), routeLeg(points[0], points[1]));
  const plan = planTravel(base, options), repeated = planTravel(base, options);
  assert.deepEqual(plan, repeated);
  assert.equal(JSON.stringify(points.map(place => place.coordinates)), before);
});
