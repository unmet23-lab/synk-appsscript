import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planTravel, replanTravel, replanRemainingTravel, suggestTravelRecovery, normalizePlannerInput } from '../experiences/path-travel/planner.mjs';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { createWalkingRouter } from '../experiences/path-travel/walking-router.mjs';

const now = '2026-10-09T03:00:00.000Z', sourceUrl = 'https://example.org/official';
const hours = (open = '09:00', close = '20:00') => ({ verifiedAt: '2026-10-09', sourceUrl, scope: 'full', holidayPolicy: 'same', weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open, close }]])) });
const venue = (id, category = 'culture', extra = {}) => ({ id, name: `장소 ${id}`, category, address: '서울 종로', dayPlannerEligible: true,
  coordinates: { lat: 37.5765, lon: 126.9855 }, features: { indoor: true }, planningStayMinutes: 40, checkedAt: '2026-10-09', verifiedAt: '2026-10-09',
  conditions: { hours: hours(), price: { kind: 'free', amount: 0, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', sourceUrl, verifiedAt: '2026-10-09' } }, ...extra });
const places = [venue('a'), venue('b'), venue('c', 'food'), venue('d', 'tea')];
const base = { date: '2026-10-10', startTime: '10:00', endTime: '18:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 2,
  preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [] };
const destination = { id: 'destination', name: '돌아갈 숙소', lat: 37.578, lon: 126.986 };
const leg = (from, to, minMinutes = 5, maxMinutes = minMinutes, extra = {}) => ({ distanceMeters: maxMinutes * 60, minMinutes, maxMinutes, coordinates: [[from.lon, from.lat], [to.lon, to.lat]], source: 'test-confirmed-route', ...extra });
const routeLeg = (from, to) => leg(from, to);
const options = { places, now, ask: false, routeLeg };
const run = (input = {}, settings = {}) => planTravel({ ...base, ...input }, { ...options, ...settings });
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

test('이전 여행 입력은 예약 없음·식사 자유·도착지 없음으로 호환된다', () => {
  const input = normalizePlannerInput(base);
  assert.deepEqual(input.appointments, []);
  assert.deepEqual(input.meal, { mode: 'any', startTime: '12:00', endTime: '13:00' });
  assert.equal(input.destination, null);
  const plan = run().primary;
  assert.equal(plan.destination, null);
  assert.equal(plan.returnLeg, null);
  assert.equal(plan.endTime, plan.stops.at(-1).departureTime);
});

test('예약은 장소 유지와 별개로 정확한 시각에 시작하며 조기 도착은 기다린다', () => {
  const input = { appointments: [{ placeId: 'a', time: '10:30' }], lockedIds: ['b'] };
  const result = run(input, { places: places.slice(0, 2) });
  assert.ok(result.primary);
  for (const plan of [result.primary, ...result.alternatives]) {
    const index = plan.stops.findIndex(stop => stop.placeId === 'a'), stop = plan.stops[index];
    assert.equal(stop.arrivalTime, '10:30');
    assert.equal(stop.departureTime, '11:10');
    assert.equal(stop.waitMinutes, 25);
    assert.equal(plan.legs[index].arrivalTime, '10:05');
    assert.ok(stop.reasons.some(reason => reason.includes('10:30 예약')));
    assert.deepEqual(plan.lockedIds, ['b'], 'appointments must not silently become user locks');
  }
});

test('예약에 늦거나 이전 예약의 체류와 겹치면 시각을 옮겨 추천하지 않는다', () => {
  const late = run({ appointments: [{ placeId: 'a', time: '10:03' }] });
  assert.equal(late.primary, null);
  assert.ok(late.blocked.some(row => row.kind === 'appointment.late'));
  const conflict = run({ appointments: [{ placeId: 'a', time: '10:20' }, { placeId: 'b', time: '10:40' }] });
  assert.equal(conflict.primary, null);
  assert.ok(conflict.blocked.some(row => row.kind === 'appointment.conflict'));
});

test('예약한 전체 체류와 휴식은 영업·종료 시각 안이어야 하며 영업 시작으로 예약을 미루지 않는다', () => {
  const closing = venue('a', 'culture', { conditions: { ...places[0].conditions, hours: hours('10:40', '11:15') } });
  const result = run({ appointments: [{ placeId: 'a', time: '10:30' }] }, { places: [closing, places[1]] });
  assert.equal(result.primary, null);
  assert.ok(result.blocked.some(row => row.kind === 'schedule' && row.placeId === 'a'));
  const free = run({ endTime: '11:35', appointments: [{ placeId: 'a', time: '10:05' }] }, { places: places.slice(0, 2) });
  assert.ok(free.primary);
  const paused = run({ endTime: '11:35', restEveryMinutes: 30, restDurationMinutes: 10, appointments: [{ placeId: 'a', time: '10:05' }] }, { places: places.slice(0, 2) });
  assert.equal(paused.primary, null);
});

test('예약·식사 시작 전에 필요한 휴식을 대기 안에 배치하고 방문 중 휴식도 유지한다', () => {
  const result = run({ planningMode: 'remaining', stopCount: 1, startTime: '11:00', endTime: '12:50',
    appointments: [{ placeId: 'c', time: '12:00' }], meal: { mode: 'window', startTime: '12:00', endTime: '12:00' },
    restEveryMinutes: 30, restDurationMinutes: 10,
  }, { places: [places[2]], routeLeg: (from, to) => leg(from, to, 40) });
  const plan = result.primary, stop = plan?.stops[0];
  assert.ok(plan);
  assert.equal(plan.legs[0].arrivalTime, '11:40');
  assert.deepEqual(stop.preStartPause, { startTime: '11:40', endTime: '11:50', durationMinutes: 10, kind: 'planned-rest', locationStatus: 'unverified' });
  assert.equal(stop.arrivalTime, '12:00');
  assert.equal(stop.waitMinutes, 20, 'pre-start rest is inside the existing wait, not an additional delay');
  assert.deepEqual(stop.pauses, [{ startTime: '12:30', endTime: '12:40', durationMinutes: 10, kind: 'planned-rest', locationStatus: 'unverified' }]);
  assert.equal(stop.stayMinutes, 50);
  assert.equal(stop.departureTime, '12:50');
  assert.equal(plan.status, 'partial');
  assert.ok(plan.checks.some(row => row.kind === 'rest-place' && row.status === 'unknown' && row.placeId === 'c'));
});

test('예약 전에 쉴 시간이 모자라면 휴식을 생략하거나 예약 시작과 겹치지 않는다', () => {
  const input = { planningMode: 'remaining', stopCount: 1, startTime: '11:00', appointments: [{ placeId: 'a', time: '12:00' }], restEveryMinutes: 30, restDurationMinutes: 10 };
  const tooLate = run(input, { places: [places[0]], routeLeg: (from, to) => leg(from, to, 55) });
  assert.equal(tooLate.primary, null);
  assert.ok(tooLate.blocked.some(row => row.kind === 'appointment.late' && row.reason.includes('휴식')));
  const exact = run(input, { places: [places[0]], routeLeg: (from, to) => leg(from, to, 50) });
  assert.equal(exact.primary.stops[0].preStartPause.endTime, '12:00');
  assert.equal(exact.primary.stops[0].arrivalTime, '12:00');
});

test('식사 시간대는 휴식을 마친 실제 시작으로 검사하며 식사 전 좌석을 확인했다고 하지 않는다', () => {
  const input = { planningMode: 'remaining', stopCount: 1, startTime: '11:00', meal: { mode: 'window', startTime: '11:40', endTime: '11:50' },
    restEveryMinutes: 30, restDurationMinutes: 10 };
  const food = venue('c', 'food', { planningStayMinutes: 20, conditions: { ...places[2].conditions, hours: hours('11:50', '14:00') } });
  const result = run(input, { places: [food], routeLeg: (from, to) => leg(from, to, 40) });
  const stop = result.primary.stops[0];
  assert.equal(stop.arrivalTime, '11:50');
  assert.equal(stop.preStartPause.startTime, '11:40');
  assert.equal(stop.preStartPause.locationStatus, 'unverified');
  assert.equal(stop.pauses, undefined, 'a pre-start pause must create an unknown check even when there is no internal pause');
  assert.equal(stop.schedule.status, 'matched');
  assert.equal(result.primary.status, 'partial');
  assert.ok(result.primary.checks.some(row => row.kind === 'rest-place' && row.placeId === 'c' && row.status === 'unknown'));
  const missed = run({ ...input, meal: { ...input.meal, endTime: '11:49' } }, { places: [food], routeLeg: (from, to) => leg(from, to, 40) });
  assert.equal(missed.primary, null);
  assert.ok(missed.blocked.some(row => row.kind === 'meal.time' && row.reason.includes('휴식')));
});

test('예약 입력의 중복·같은 시각·여행 범위·숙박·제외 충돌을 명확히 거절한다', () => {
  const bad = [
    [{ placeId: 'a', time: '10:30' }, { placeId: 'a', time: '11:30' }],
    [{ placeId: 'a', time: '10:30' }, { placeId: 'b', time: '10:30' }],
    [{ placeId: 'a', time: '09:59' }], [{ placeId: 'a', time: '18:00' }], [{ placeId: 'missing', time: '12:00' }],
  ];
  for (const appointments of bad) assert.throws(() => run({ appointments }), error => error.field === 'appointments');
  assert.throws(() => run({ appointments: [{ placeId: 'a', time: '12:00' }], excludedIds: ['a'] }), /동시에 제외/);
  assert.throws(() => run({ appointments: [{ placeId: 'a', time: '12:00' }], lockedIds: ['b', 'c'] }), /희망 방문 수/);
  assert.throws(() => run({ appointments: [{ placeId: 'hotel', time: '12:00' }] }, { places: [...places, venue('hotel', 'stay', { dayPlannerEligible: false })] }), /당일 여행/);
  assert.throws(() => run({ destination: { ...destination, lon: NaN } }), error => error.field === 'destination');
  const sorted = run({ appointments: [{ placeId: 'b', time: '12:00' }, { placeId: 'a', time: '10:30' }] });
  assert.deepEqual(sorted.input.appointments.map(row => row.placeId), ['a', 'b']);
});

test('식사 시작 시간대는 식사를 포함하며 체류 전체를 그 안에 억지로 끝내지 않는다', () => {
  const result = run({ meal: { mode: 'window', startTime: '12:00', endTime: '12:00' } }, { places: [places[0], places[2]] });
  assert.ok(result.primary);
  for (const plan of [result.primary, ...result.alternatives]) {
    const food = plan.stops.find(stop => stop.place.category === 'food');
    assert.equal(food.arrivalTime, '12:00');
    assert.equal(food.departureTime, '12:40');
    assert.ok(food.waitMinutes > 0);
  }
  assert.deepEqual(result.input.requiredCategories, [], 'meal window does not overwrite the explicitly chosen categories');
});

test('식당의 개장까지 기다릴 수 있으나 지정한 식사 시작 시간대 밖으로 넘기지 않는다', () => {
  const narrow = venue('c', 'food', { conditions: { ...places[2].conditions, hours: hours('12:02', '15:00') } });
  const result = run({ meal: { mode: 'window', startTime: '12:00', endTime: '12:03' } }, { places: [places[0], narrow] });
  assert.equal(result.primary.stops.find(stop => stop.placeId === 'c').arrivalTime, '12:02');
  const impossible = run({ meal: { mode: 'window', startTime: '12:00', endTime: '12:01' } }, { places: [places[0], narrow] });
  assert.equal(impossible.primary, null);
  const alreadyLate = run({ startTime: '13:01', meal: { mode: 'window', startTime: '12:00', endTime: '13:00' } });
  assert.equal(alreadyLate.primary, null);
});

test('식사 생략은 음식 취향보다 우선하며 식사 필수·예약·유지와의 충돌은 묻어두지 않는다', () => {
  const result = run({ meal: { mode: 'none' }, preferences: { food: true, noodles: true } });
  assert.ok([result.primary, ...result.alternatives].every(plan => plan.stops.every(stop => stop.place.category !== 'food')));
  for (const extra of [{ requiredCategories: ['food'] }, { appointments: [{ placeId: 'c', time: '12:00' }] }, { lockedIds: ['c'] }]) {
    assert.throws(() => run({ ...extra, meal: { mode: 'none' } }), error => error.field === 'meal');
  }
  assert.throws(() => run({ meal: { mode: 'window', startTime: '12:00', endTime: '13:00' }, appointments: [{ placeId: 'c', time: '13:01' }] }), /식당 예약 시각/);
});

test('마지막 도착지 이동을 전체 도보·종료에 넣고 일반 방문 legs와 분리한다', () => {
  const result = run({ destination, lockedIds: ['a', 'b'] }, { routeLeg: (from, to) => leg(from, to, to.id === destination.id ? 10 : 5) });
  for (const plan of [result.primary, ...result.alternatives]) {
    assert.equal(plan.legs.length, plan.stops.length);
    assert.deepEqual(plan.destination, destination);
    assert.equal(plan.returnLeg.fromId, plan.stops.at(-1).placeId);
    assert.equal(plan.returnLeg.toId, destination.id);
    assert.equal(plan.returnLeg.departureTime, plan.stops.at(-1).departureTime);
    assert.equal(plan.returnLeg.arrivalTime, plan.endTime);
    assert.equal(minute(plan.endTime) - minute(plan.returnLeg.departureTime), 10);
    assert.equal(plan.walking.maxMinutes, plan.legs.reduce((sum, leg) => sum + leg.maxMinutes, 0) + 10);
    assert.equal(plan.walking.minMinutes, plan.legs.reduce((sum, leg) => sum + leg.minMinutes, 0) + 10);
    assert.match(plan.walking.label, /마지막 도착지/);
  }
});

test('관람까지 가능해도 귀가가 늦거나 귀가 구간이 너무 길면 추천에서 제외한다', () => {
  const two = places.slice(0, 2), longReturn = (from, to) => leg(from, to, to.id === destination.id ? 15 : 5);
  assert.ok(run({ endTime: '11:40' }, { places: two, routeLeg: longReturn }).primary);
  const late = run({ destination, endTime: '11:40' }, { places: two, routeLeg: longReturn });
  assert.equal(late.primary, null); assert.ok(late.blocked.some(row => row.kind === 'destination.time'));
  const tooFar = run({ destination, maxWalkMinutes: 24 }, { places: two, routeLeg: longReturn });
  assert.equal(tooFar.primary, null); assert.ok(tooFar.blocked.some(row => row.kind === 'walking.return'));
  const longLeg = run({ destination, maxLegWalkMinutes: 10 }, { places: two, routeLeg: longReturn });
  assert.equal(longLeg.primary, null);
  const uncertain = run({ destination, maxLegWalkMinutes: 15 }, { places: two, routeLeg: (from, to) => to.id === destination.id ? leg(from, to, 10, 20) : leg(from, to) });
  assert.equal(uncertain.primary, null); assert.ok(uncertain.unknowns.some(row => row.kind === 'walking.return'));
});

test('마지막 이동도 경로 미확인·접근성 확인을 보존하며 같은 도착점은 0분으로 가능하다', () => {
  const two = places.slice(0, 2);
  const fallback = run({ destination }, { places: two, routeLeg: (from, to) => to.id === destination.id ? null : leg(from, to) });
  assert.equal(fallback.primary.returnLeg.source, 'coordinate-distance-estimate');
  assert.equal(fallback.primary.status, 'partial');
  assert.ok(fallback.primary.checks.some(row => row.kind === 'route.return' && row.status === 'unknown'));
  const accessible = two.map(place => ({ ...place, features: { stepFree: true } }));
  const step = run({ destination, requiredFeatures: { stepFree: true } }, { places: accessible, routeLeg: (from, to) => leg(from, to, 5, 5, { stepFreeVerified: to.id !== destination.id }) });
  assert.equal(step.primary, null); assert.ok(step.unknowns.some(row => row.kind === 'required.stepFree.return'));
  const same = run({ destination: { ...base.origin } }, { places: two, routeLeg: (from, to) => leg(from, to, to.id === base.origin.id ? 0 : 5) });
  assert.equal(same.primary.returnLeg.maxMinutes, 0);
  assert.equal(same.primary.endTime, same.primary.stops.at(-1).departureTime);
});

test('같은 ID라도 도착지 좌표가 다르면 앞 이동 캐시를 재사용하지 않는다', () => {
  const target = { ...destination, id: 'a' };
  const result = run({ destination: target, appointments: [{ placeId: 'a', time: '12:00' }], lockedIds: ['b'] }, {
    places: places.slice(0, 2), routeLeg: (from, to) => leg(from, to, to.lon === target.lon ? 17 : 5),
  });
  assert.equal(result.primary.returnLeg.maxMinutes, 17);
  assert.deepEqual(result.primary.returnLeg.coordinates.at(-1), [target.lon, target.lat]);
});

test('완료·건너뜀 보고는 해당 예약만 지우며 남은 예약·식사·도착지를 보존한다', () => {
  const input = { ...base, stopCount: 3, destination, meal: { mode: 'none' },
    appointments: [{ placeId: 'a', time: '10:30' }, { placeId: 'b', time: '14:10' }, { placeId: 'd', time: '15:00' }] };
  const result = replanRemainingTravel(input, { ...options, completedIds: ['a'], skippedIds: ['b'], currentTime: '14:00', origin: base.origin, remainingBudget: 10000, maxWalkMinutes: 30, stopCount: 1 });
  assert.deepEqual(result.input.appointments, [{ placeId: 'd', time: '15:00' }]);
  assert.equal(result.primary.stops[0].arrivalTime, '15:00');
  assert.equal(result.input.meal.mode, 'none'); assert.deepEqual(result.input.destination, destination);
  assert.equal(result.primary.returnLeg.toId, destination.id);
  assert.throws(() => replanRemainingTravel(input, { ...options, completedIds: ['a'], currentTime: '14:30', origin: base.origin, remainingBudget: 10000, maxWalkMinutes: 30, stopCount: 2 }), /예약 시각/);
});

test('식사를 마쳤다는 보고와 앞으로 식사 없음 선택은 옛 필수·예약 충돌 없이 함께 적용된다', () => {
  const input = { ...base, requiredCategories: ['food'], lockedIds: ['c'], appointments: [{ placeId: 'c', time: '12:00' }], meal: { mode: 'none' }, destination };
  const state = { ...options, completedIds: ['c'], currentTime: '14:00', origin: base.origin, remainingBudget: 10000, maxWalkMinutes: 30, stopCount: 1 };
  const result = replanRemainingTravel(input, state);
  assert.ok(result.primary);
  assert.deepEqual(result.input.requiredCategories, []);
  assert.deepEqual(result.input.appointments, []);
  assert.deepEqual(result.input.lockedIds, []);
  assert.ok(result.primary.stops.every(stop => stop.place.category !== 'food'));
  assert.equal(result.input.meal.mode, 'none');
  assert.throws(() => replanRemainingTravel(input, { ...state, completedIds: [], skippedIds: ['c'] }), /식사 필수/, 'skipping a meal must not satisfy a required meal');
});

test('교체와 복구 제안은 예약·식사·도착 조건을 자동으로 풀지 않는다', () => {
  const input = { ...base, endTime: '12:30', destination, meal: { mode: 'window', startTime: '12:00', endTime: '12:10' }, appointments: [{ placeId: 'a', time: '10:30' }] };
  const initial = run(input);
  assert.equal(initial.primary, null);
  const recovery = suggestTravelRecovery(input, options);
  assert.ok(recovery.suggestions.length);
  for (const suggestion of recovery.suggestions) {
    assert.deepEqual(suggestion.result.input.appointments, input.appointments);
    assert.deepEqual(suggestion.result.input.meal, input.meal);
    assert.deepEqual(suggestion.result.input.destination, destination);
    assert.equal(suggestion.result.primary.stops.find(stop => stop.placeId === 'a').arrivalTime, '10:30');
    assert.ok(!suggestion.changes.some(row => ['appointments', 'meal', 'destination'].includes(row.field)));
  }
  const good = recovery.suggestions[0].result;
  assert.throws(() => replanTravel(good.input, { ...options, replace: { fromId: 'a', toId: 'b' } }), /예약한 장소/);
});

test('새 시간 조건은 결정적이며 답별 재추천에서도 예약·식사·도착지를 보존한다', () => {
  const input = { ...base, destination, appointments: [{ placeId: 'a', time: '10:30' }], meal: { mode: 'window', startTime: '12:00', endTime: '13:00' } };
  const catalogue = [places[0], { ...places[2], features: { noodles: true } }, venue('e', 'food', { features: { noodles: false } })];
  const snapshot = structuredClone({ input, catalogue }), settings = { ...options, places: catalogue, ask: true };
  const first = planTravel(input, settings), second = planTravel(input, settings);
  assert.deepEqual(first, second);
  assert.deepEqual({ input, catalogue }, snapshot);
  assert.equal(first.question.about, 'noodles');
  for (const answer of first.question.options) {
    const applied = planTravel({ ...input, preferences: { noodles: answer.value } }, { ...settings, ask: false });
    assert.equal(answer.preview.planId, applied.primary.id);
    assert.equal(answer.preview.endTime, applied.primary.returnLeg.arrivalTime);
    assert.equal(answer.preview.walking.maxMinutes, applied.primary.walking.maxMinutes);
    assert.equal(applied.primary.stops.find(stop => stop.placeId === 'a').arrivalTime, '10:30');
    assert.ok(applied.primary.stops.find(stop => stop.place.category === 'food').arrivalTime >= '12:00');
    assert.deepEqual(applied.primary.destination, destination);
  }
});

test('실제 OSM에서 식당 예약과 마지막 역 도착까지의 도보 합계를 계산한다', () => {
  const router = createWalkingRouter(JSON.parse(readFileSync(new URL('../experiences/path-travel/assets/jongno-walking.json', import.meta.url), 'utf8')));
  const result = planTravel({ ...base, stopCount: 3, maxWalkMinutes: 120, destination: { id: 'jonggak', name: '종각역', lat: 37.57016, lon: 126.98306 },
    appointments: [{ placeId: 'gaeseong-mandu-koong', time: '12:00' }], meal: { mode: 'window', startTime: '11:30', endTime: '12:30' }, preferences: { culture: true, tea: true },
  }, { places: TRAVEL_PLACES, now, routeLeg: router, ask: false });
  assert.ok(result.primary);
  for (const plan of [result.primary, ...result.alternatives]) {
    assert.equal(plan.stops.find(stop => stop.placeId === 'gaeseong-mandu-koong').arrivalTime, '12:00');
    assert.equal(plan.returnLeg.source, 'osm-walking-network');
    assert.equal(plan.returnLeg.toId, 'jonggak');
    assert.equal(plan.walking.maxMinutes, [...plan.legs, plan.returnLeg].reduce((sum, leg) => sum + leg.maxMinutes, 0));
    assert.ok(plan.endTime <= base.endTime);
  }
});
