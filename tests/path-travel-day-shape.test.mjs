import test from 'node:test';
import assert from 'node:assert/strict';
import { planTravel, replanRemainingTravel } from '../experiences/path-travel/planner.mjs';
import { createTravelMemory, validateTravelMemory } from '../experiences/path-travel/planner-storage.mjs';

// The shape of a day: the asked things appear, kinds alternate, meals land at
// mealtime, and the chosen hours are used with a short margin left at the end.
const now = '2026-10-09T03:00:00.000Z', sourceUrl = 'https://example.org/official';
const hours = { verifiedAt: '2026-10-09', sourceUrl, scope: 'full', holidayPolicy: 'same', weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open: '09:00', close: '20:00' }]])) };
const venue = (id, category, features = {}, stay = 40) => ({ id, name: `장소 ${id}`, category, address: '서울 종로', dayPlannerEligible: true,
  coordinates: { lat: 37.5765, lon: 126.9855 }, features, planningStayMinutes: stay, checkedAt: '2026-10-09', verifiedAt: '2026-10-09',
  conditions: { hours, price: { kind: 'free', amount: 0, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', sourceUrl, verifiedAt: '2026-10-09' } } });
const base = { date: '2026-10-10', startTime: '10:00', endTime: '18:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 3,
  preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [] };
const routeLeg = (from, to) => ({ distanceMeters: 250, minMinutes: 5, maxMinutes: 5, coordinates: [[from.lon, from.lat], [to.lon, to.lat]], source: 'test-confirmed-route' });
const run = (places, input = {}) => planTravel({ ...base, ...input }, { places, now, ask: false, routeLeg });
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const visitMinutes = stop => stop.stayMinutes - (stop.pauses ?? []).reduce((sum, pause) => sum + pause.durationMinutes, 0);
const adjacentSame = plan => plan.stops.some((stop, i) => i > 0 && stop.place.category !== 'culture' && stop.place.category === plan.stops[i - 1].place.category);

test('미술을 고르면 미술 기록이 없는 카페가 함께 있어도 미술관이 들어간다', () => {
  // The short palace would win on time alone; a café's missing art record must not hide the museum's.
  const places = [venue('museum', 'culture', { indoor: true, art: true }, 75), venue('palace', 'culture', { outdoor: true, history: true }, 30),
    venue('cafe-1', 'tea', { indoor: true }), venue('cafe-2', 'tea', { indoor: true })];
  const plan = run(places, { endTime: '13:00', preferences: { art: true, tea: true } }).primary;
  assert.ok(plan.stops.some(stop => stop.placeId === 'museum'), JSON.stringify(plan.stops.map(stop => stop.placeId)));
  assert.ok(plan.stops.some(stop => stop.place.category === 'tea'));
  assert.ok(plan.stops.find(stop => stop.placeId === 'museum').reasons.includes('미술·공예 선호 반영'));
});

test('고른 것이 여럿이면 하나를 늘리기 전에 각각을 한 번씩 넣는다', () => {
  const places = [venue('art-1', 'culture', { art: true }), venue('art-2', 'culture', { art: true }), venue('art-3', 'culture', { art: true }),
    venue('old', 'culture', { history: true, walk: true }), venue('cafe', 'tea')];
  const plan = run(places, { preferences: { art: true, history: true, walk: true, tea: true } }).primary;
  assert.ok(plan.stops.some(stop => stop.placeId === 'old'));
  assert.ok(plan.stops.some(stop => stop.placeId === 'cafe'));
  assert.ok(plan.stops.some(stop => stop.place.features.art === true));
});

test('고른 것이 아닌 곳을 하나 더 넣어도 덜 맞는 하루로 보지 않아 시간만큼 곳을 채운다', () => {
  // Counting art against the share of stops would have kept this day at two places.
  const places = [venue('museum', 'culture', { indoor: true, art: true }, 60), venue('cafe', 'tea', { indoor: true }), venue('garden', 'culture', { outdoor: true, art: false })];
  const plan = run(places, { endTime: '14:00', preferences: { art: true, tea: true } }).primary;
  assert.deepEqual(new Set(plan.stops.map(stop => stop.placeId)), new Set(['museum', 'cafe', 'garden']));
});

test('피하고 싶은 것은 기록 없는 곳 때문에 무뎌지지 않고 확인된 곳을 뺀다', () => {
  // Every other place has no art record. Unknowns must neither cancel the avoidance nor count as avoided.
  const places = [venue('museum', 'culture', { indoor: true, art: true }), venue('palace', 'culture', { outdoor: true, history: true }),
    venue('cafe', 'tea'), venue('hall', 'culture', { indoor: true })];
  const plan = run(places, { preferences: { art: false } }).primary;
  assert.ok(plan.stops.every(stop => stop.placeId !== 'museum'), JSON.stringify(plan.stops.map(stop => stop.placeId)));
  assert.ok(plan.stops.every(stop => !stop.reasons.includes('미술·공예 피하기 반영')));
});

test('첫 화면에서 고른 「궁궐」은 역사 기록만 있는 곳보다 진짜 궁을 넣는다', () => {
  const places = [venue('temple', 'culture', { outdoor: true, history: true, walk: true }, 30), venue('palace', 'culture', { outdoor: true, history: true, walk: true, palace: true }, 60), venue('cafe', 'tea')];
  const prefs = { history: true, walk: true };
  const plain = run(places, { endTime: '12:00', stopCount: 2, preferences: prefs }).primary;
  const picked = planTravel({ ...base, endTime: '12:00', stopCount: 2, preferences: prefs }, { places, now, ask: false, routeLeg, intents: [{ id: 'palace', feature: 'palace' }] });
  assert.ok(picked.primary.stops.some(stop => stop.placeId === 'palace'), JSON.stringify(picked.primary.stops.map(stop => stop.placeId)));
  assert.deepEqual(picked.engineAudit.intents, ['palace']);
  assert.ok(plain.stops.length >= 1);
  for (const intents of [[{ id: 'x' }], [{ id: 'x', category: 'stay' }], Array.from({ length: 7 }, (_, i) => ({ id: 'p' + i, feature: 'palace' }))]) {
    assert.throws(() => planTravel({ ...base }, { places, now, ask: false, routeLeg, intents }), error => error.field === 'intents');
  }
});

test('카페와 식당을 연달아 넣지 않고 카페를 겹쳐 넣지 않는다', () => {
  const places = [venue('cafe-1', 'tea'), venue('cafe-2', 'tea'), venue('cafe-3', 'tea'), venue('a', 'culture', {}, 60), venue('b', 'culture', {}, 60)];
  for (const plan of [run(places, { preferences: { tea: true } }).primary, run(places, { stopCount: 4 }).primary]) {
    assert.equal(adjacentSame(plan), false, JSON.stringify(plan.stops.map(stop => stop.placeId)));
    assert.equal(plan.stops.filter(stop => stop.place.category === 'tea').length, 1);
  }
});

test('식사 시간을 정하지 않아도 식당은 점심이나 저녁 시간에 들어간다', () => {
  const places = [venue('meal', 'food', {}, 60), venue('a', 'culture', {}, 60), venue('b', 'culture', {}, 60), venue('c', 'culture', {}, 60)];
  const plan = run(places, { endTime: '15:00', stopCount: 4, preferences: { food: true } }).primary;
  const meal = plan.stops.find(stop => stop.placeId === 'meal');
  assert.ok(meal && minute(meal.arrivalTime) >= 660 && minute(meal.arrivalTime) <= 840, meal?.arrivalTime);
});

test('고른 시간을 채우되 끝에 짧은 여유를 남기고 늘린 만큼을 설명한다', () => {
  const places = [venue('a', 'culture'), venue('b', 'culture'), venue('c', 'tea')];
  // Unstretched, three 40-minute visits end at 12:15. Three hours keep a 10-minute
  // margin, so the 35 spare minutes are handed out in five-minute steps up to 12:50.
  const plan = run(places, { endTime: '13:00' }).primary;
  assert.equal(plan.endTime, '12:50');
  // Four hours have more spare time than the visits may grow (half of each): they stop at the cap.
  const capped = run(places, { endTime: '14:00' }).primary;
  assert.equal(capped.endTime, '13:15');
  assert.ok(capped.stops.every(stop => visitMinutes(stop) === 60));
  for (const day of [plan, capped]) {
    for (const stop of day.stops) {
      const extra = visitMinutes(stop) - stop.place.planningStayMinutes;
      assert.ok(extra >= 0 && extra <= stop.place.planningStayMinutes * 0.5 && extra % 5 === 0, `${stop.placeId} +${extra}`);
      assert.equal(stop.reasons.includes(`고른 시간에 맞춰 ${extra}분 더 머물게 잡았어요.`), extra > 0);
      assert.equal(minute(stop.departureTime) - minute(stop.arrivalTime), stop.stayMinutes);
    }
    for (const [i, leg] of day.legs.entries()) assert.equal(leg.departureTime, i ? day.stops[i - 1].departureTime : day.startTime);
  }
});

test('늘린 하루와 한 곳 하루를 실제 장소로 저장했다가 그대로 다시 연다', () => {
  // Stored records accept only the real catalogue, so these use it with a fixed walking estimate.
  const real = input => planTravel({ ...base, ...input }, { now, ask: false, routeLeg });
  for (const input of [{ stopCount: 3, preferences: { tea: true, art: true } }, { startTime: '14:00', endTime: '15:00', stopCount: 1, preferences: { tea: true } }]) {
    const result = real(input);
    assert.ok(result.primary, JSON.stringify(result.blocked.slice(0, 3)));
    if (input.stopCount === 1) assert.equal(result.primary.stops.length, 1);
    else assert.ok(result.primary.stops.some(stop => visitMinutes(stop) > stop.place.planningStayMinutes));
    const memory = createTravelMemory({ query: result.input, plan: result.primary }, { now });
    assert.deepEqual(validateTravelMemory(JSON.parse(JSON.stringify(memory))).plan.stops.map(stop => [stop.placeId, stop.stayMinutes]),
      result.primary.stops.map(stop => [stop.placeId, stop.stayMinutes]));
  }
});

test('예약한 곳과 식사 시간대를 정한 식당은 계획한 길이 그대로 둔다', () => {
  const places = [venue('booked', 'culture'), venue('meal', 'food'), venue('free', 'culture')];
  const plan = run(places, { appointments: [{ placeId: 'booked', time: '10:30' }], meal: { mode: 'window', startTime: '12:00', endTime: '12:30' } }).primary;
  assert.equal(plan.stops.find(stop => stop.placeId === 'booked').stayMinutes, 40);
  assert.equal(plan.stops.find(stop => stop.placeId === 'meal').stayMinutes, 40);
  assert.ok(visitMinutes(plan.stops.find(stop => stop.placeId === 'free')) > 40);
});

test('한 곳만 고른 한 시간 나들이는 고른 분야의 한 곳으로 만든다', () => {
  const places = [venue('a', 'culture'), venue('b', 'tea')];
  const result = run(places, { endTime: '11:00', stopCount: 1, preferences: { tea: true } });
  assert.deepEqual(result.primary.stops.map(stop => stop.placeId), ['b']);
  assert.ok(result.alternatives.every(plan => plan.stops.length === 1));
});

test('여행 중 남은 일정은 머무는 시간을 늘리지 않는다', () => {
  const places = [venue('a', 'culture'), venue('b', 'culture'), venue('c', 'tea')];
  const result = replanRemainingTravel({ ...base, stopCount: 2 }, { places, now, ask: false, routeLeg, completedIds: ['a'], currentTime: '11:00',
    origin: { id: 'a', name: '장소 a', lat: 37.5765, lon: 126.9855 }, remainingBudget: 10000, maxWalkMinutes: 60, stopCount: 2 });
  assert.ok(result.primary.stops.every(stop => stop.stayMinutes === stop.place.planningStayMinutes));
});

test('여행 중 남은 일정은 다녀온 곳이 이미 채운 고른 것을 다시 쫓지 않는다', () => {
  const places = [venue('cafe-1', 'tea'), venue('cafe-2', 'tea'), venue('a', 'culture'), venue('b', 'culture')];
  const remaining = progress => replanRemainingTravel({ ...base, stopCount: 2, preferences: { tea: true } }, { places, now, ask: false, routeLeg,
    intents: [{ id: 'tea', category: 'tea' }], currentTime: '11:00', origin: { id: 'here', name: '지금 위치', lat: 37.5765, lon: 126.9855 },
    remainingBudget: 10000, maxWalkMinutes: 60, stopCount: 2, ...progress });
  assert.deepEqual(remaining({ completedIds: ['cafe-1'] }).engineAudit.intents, []);
  // Skipping says nothing about the pick, so another café may still come.
  assert.deepEqual(remaining({ skippedIds: ['cafe-1'] }).engineAudit.intents, ['tea']);
  assert.deepEqual(remaining({ completedIds: ['a'] }).engineAudit.intents, ['tea']);
});
