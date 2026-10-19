import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planTravel, replanTravel, replanRemainingTravel, normalizePlannerInput } from '../experiences/path-travel/planner.mjs';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { createWalkingRouter } from '../experiences/path-travel/walking-router.mjs';

const now = '2026-10-09T03:00:00.000Z', sourceUrl = 'https://example.org/official';
const hours = { verifiedAt: '2026-10-09', sourceUrl, scope: 'full', holidayPolicy: 'same', weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open: '09:00', close: '20:00' }]])) };
const venue = (id, category, amount = 0, features = {}) => ({ id, name: `장소 ${id}`, category, address: '서울 종로', dayPlannerEligible: true,
  coordinates: { lat: 37.5765, lon: 126.9855 }, features, planningStayMinutes: 40, checkedAt: '2026-10-09', verifiedAt: '2026-10-09',
  conditions: { hours, price: { kind: amount ? 'exact' : 'free', amount, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', sourceUrl, verifiedAt: '2026-10-09' } } });
const places = [venue('a', 'culture'), venue('b', 'food', 12000, { noodles: true }), venue('c', 'tea', 6000, { coffee: true }), venue('d', 'culture'), venue('e', 'tea', 8000, { coffee: false })];
const base = { date: '2026-10-10', startTime: '10:00', endTime: '18:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 3,
  preferences: {}, requiredFeatures: {}, requiredCategories: ['culture', 'food', 'tea'], lockedIds: [], excludedIds: [] };
const routeLeg = (from, to) => ({ distanceMeters: 250, minMinutes: 4, maxMinutes: 5, coordinates: [[from.lon, from.lat], [to.lon, to.lat]], source: 'test-confirmed-route' });
const settings = { places, now, ask: false, routeLeg };
const progress = { completedIds: ['a', 'b'], skippedIds: [], currentTime: '14:00', origin: { id: 'b', name: '식사 마친 장소', lat: 37.5765, lon: 126.9855 }, remainingBudget: 7000, maxWalkMinutes: 30, stopCount: 1 };
const run = (input = {}, state = {}, extra = {}) => replanRemainingTravel({ ...base, ...input }, { ...progress, ...settings, ...state, ...extra });

test('한 곳만 고른 하루는 한 곳으로, 여러 곳을 고른 하루는 두 곳 이상으로 만들고 남은 일정은 한 곳으로 이어간다', () => {
  assert.equal(normalizePlannerInput(base).planningMode, 'day');
  const single = planTravel({ ...base, stopCount: 1, requiredCategories: [], endTime: '11:00' }, settings);
  assert.equal(single.input.planningMode, 'day');
  assert.equal(single.primary.stops.length, 1);
  assert.ok(planTravel({ ...base, stopCount: 2, requiredCategories: [] }, settings).primary.stops.length >= 2);
  assert.throws(() => planTravel({ ...base, stopCount: 0 }, settings), error => error.field === 'stopCount');
  const result = run();
  assert.equal(result.input.planningMode, 'remaining');
  assert.equal(result.primary.stops.length, 1);
  assert.equal(result.primary.stops[0].placeId, 'c');
  assert.equal(result.primary.legs.length, 1);
  assert.deepEqual(result.input.requiredCategories, ['tea']);
  assert.equal(result.input.date, base.date);
  assert.equal(result.input.startTime, '14:00');
  assert.equal(result.primary.startTime, '14:00');
  assert.equal(result.primary.legs[0].fromId, 'b');
  assert.equal(result.primary.stops[0].arrivalTime, '14:05');
  assert.equal(result.primary.label, '지금부터 남은 일정');
});

test('완료·건너뜀을 누적 제외하고 남은 잠금은 보존하며 완료 분야만 필수 해제한다', () => {
  const result = run({ lockedIds: ['a', 'c'], excludedIds: ['d'] }, { skippedIds: ['e'] });
  assert.deepEqual(result.input.lockedIds, ['c']);
  assert.deepEqual(new Set(result.input.excludedIds), new Set(['a', 'b', 'd', 'e']));
  assert.ok(result.primary.stops.every(stop => !result.input.excludedIds.includes(stop.placeId)));
  const skippedMeal = run({}, { completedIds: ['a'], skippedIds: ['b'], stopCount: 2 });
  assert.deepEqual(skippedMeal.input.requiredCategories, ['food', 'tea']);
  assert.equal(skippedMeal.primary, null, 'skipping the only meal must not pretend a required meal was completed');
});

test('실제 지출 대신 부분합을 차감하지 않고 직접 입력한 남은 예산만 사용한다', () => {
  const result = run();
  assert.equal(result.input.budget, 7000);
  assert.equal(result.primary.cost.knownAmount, 6000);
  assert.notEqual(result.input.budget, base.budget - 12000);
  const exhausted = run({}, { remainingBudget: 0 });
  assert.equal(exhausted.primary, null);
  assert.equal(exhausted.input.budget, 0);
  assert.equal(exhausted.status, 'unavailable');
  const free = run({ requiredCategories: [], preferences: { culture: true } }, { remainingBudget: 0 });
  assert.equal(free.primary.cost.knownAmount, 0);
  assert.equal(free.primary.cost.status, 'matched');
});

test('진행 입력의 시각·예산·원점·걷기·희망수를 명시하고 과거나 날짜 넘김을 거절한다', () => {
  for (const field of ['currentTime', 'origin', 'remainingBudget', 'maxWalkMinutes', 'stopCount']) {
    const state = { ...progress, [field]: undefined };
    assert.throws(() => run({}, state), `${field} must be explicit`);
  }
  for (const currentTime of ['09:59', '18:00', '23:59', '24:00', 'next-day']) assert.throws(() => run({}, { currentTime }), error => error.field === 'currentTime');
  assert.throws(() => run({}, { remainingBudget: -1 }), error => error.field === 'budget');
  assert.throws(() => run({}, { maxWalkMinutes: -1 }), error => error.field === 'maxWalkMinutes');
  assert.throws(() => run({}, { stopCount: 0 }), error => error.field === 'stopCount');
  assert.throws(() => run({ date: '2026-10-08' }), /지난 날짜/);
  assert.throws(() => normalizePlannerInput({ ...base, planningMode: 'finished' }), error => error.field === 'planningMode');
});

test('완료·건너뜀의 중복·교차·없는 장소를 수락하지 않고 입력을 변경하지 않는다', () => {
  for (const state of [{ completedIds: ['a', 'a'] }, { skippedIds: ['c', 'c'] }, { completedIds: ['a'], skippedIds: ['a'] }, { completedIds: ['not-known'] }, { skippedIds: ['not-known'] }]) assert.throws(() => run({}, state));
  const before = structuredClone({ base, progress, places });
  assert.deepEqual(run(), run());
  assert.deepEqual({ base, progress, places }, before);
});

test('남은 한 곳도 교체·Ask 미리보기·명시 선호로 같은 결과를 얻는다', () => {
  const initial = run({}, { remainingBudget: 10000 }, { ask: true });
  assert.equal(initial.question.about, 'coffee');
  for (const option of initial.question.options) {
    const applied = planTravel({ ...initial.input, preferences: { coffee: option.value } }, settings).primary;
    assert.equal(applied.stops.length, 1);
    assert.equal(option.preview.planId, applied.id);
  }
  const before = initial.primary.stops[0].placeId, after = before === 'c' ? 'e' : 'c';
  const replaced = replanTravel(initial.input, { ...settings, replace: { fromId: before, toId: after } });
  assert.equal(replaced.input.planningMode, 'remaining');
  assert.equal(replaced.primary.stops.length, 1);
  assert.equal(replaced.primary.stops[0].placeId, after);
  assert.ok(replaced.input.excludedIds.includes('a') && replaced.input.excludedIds.includes('b'));
});

test('남은 일정에서도 운영·필수 근거·구간 걷기·휴식 제약을 유지한다', () => {
  const rest = run({ maxLegWalkMinutes: 5, restEveryMinutes: 30, restDurationMinutes: 10 });
  assert.ok(rest.primary.stops[0].pauses.length);
  assert.equal(rest.primary.endTime, '14:55');
  const walk = run({ maxLegWalkMinutes: 4 });
  assert.equal(walk.primary, null);
  assert.ok(walk.unknowns.some(row => row.kind === 'walking.leg'));
  const unknownRequired = run({ requiredFeatures: { quiet: true } });
  assert.equal(unknownRequired.primary, null);
  assert.ok(unknownRequired.unknowns.some(row => row.kind === 'required.quiet'));
  const end = run({ endTime: '14:50', restEveryMinutes: 30, restDurationMinutes: 10 });
  assert.equal(end.primary, null);
});

test('완료 목록을 누적한 두 번째 재계산은 첫 재계산 때 제외했던 곳도 되살리지 않는다', () => {
  const initial = run({ requiredCategories: [], preferences: { tea: true } }, { remainingBudget: 10000 });
  const done = initial.primary.stops[0].placeId;
  const again = replanRemainingTravel(initial.input, { ...settings, ...progress, completedIds: ['a', 'b', done], currentTime: '15:00',
    remainingBudget: 10000, origin: { id: done, name: done, ...places.find(place => place.id === done).coordinates } });
  assert.ok(again.primary);
  assert.ok(again.primary.stops.every(stop => !['a', 'b', done].includes(stop.placeId)));
  assert.ok(['a', 'b', done].every(id => again.input.excludedIds.includes(id)));
  const allDone = run({ requiredCategories: [] }, { completedIds: places.map(place => place.id) });
  assert.equal(allDone.primary, null);
  assert.equal(allDone.status, 'unavailable', 'a search failure does not automatically finish a trip');
});

test('실제 OSM에서도 공예 관람·식사 완료 후 현재 장소부터 남은 차 한 곳으로 이어간다', () => {
  const router = createWalkingRouter(JSON.parse(readFileSync(new URL('../experiences/path-travel/assets/jongno-walking.json', import.meta.url), 'utf8')));
  const originPlace = TRAVEL_PLACES.find(place => place.id === 'gaeseong-mandu-koong');
  const result = replanRemainingTravel(base, { completedIds: ['seoul-museum-craft-art', originPlace.id], skippedIds: ['osulloc-bukchon'],
    currentTime: '14:00', origin: { id: originPlace.id, name: originPlace.name, lat: originPlace.coordinates.lat, lon: originPlace.coordinates.lon },
    remainingBudget: 15000, maxWalkMinutes: 30, stopCount: 1, now, routeLeg: router, ask: false });
  assert.ok(result.primary);
  assert.equal(result.primary.stops.length, 1);
  assert.equal(result.primary.stops[0].place.category, 'tea');
  assert.equal(result.primary.legs[0].source, 'osm-walking-network');
  assert.equal(result.primary.legs[0].fromId, originPlace.id);
  assert.equal(result.primary.legs[0].departureTime, '14:00');
  assert.ok(result.primary.walking.maxMinutes <= 30);
  assert.ok(result.primary.cost.knownAmount <= 15000);
  assert.ok(result.primary.stops.every(stop => !result.input.excludedIds.includes(stop.placeId)));
});
