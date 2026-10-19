import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessCompanionFit, assessPlannerRequirements, normalizePlannerInput, planTravel, replanTravel, replanRemainingTravel, suggestTravelRecovery } from '../experiences/path-travel/planner.mjs';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { createWalkingRouter } from '../experiences/path-travel/walking-router.mjs';

const now = '2026-10-09T03:00:00.000Z', sourceUrl = 'https://example.org/official';
const base = { date: '2026-10-10', startTime: '10:00', endTime: '17:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 },
  party: { adults: 2, children: 0 }, budget: 100000, maxWalkMinutes: 120, stopCount: 2,
  preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [] };
const person = (id, preferences, requiredFeatures = {}) => ({ id, label: id, preferences, requiredFeatures });
const venue = (id, features, category = 'culture') => ({ id, name: id, category, dayPlannerEligible: true, planningStayMinutes: 30,
  coordinates: { lat: 37.5765, lon: 126.9854 }, features, verifiedAt: '2026-10-09',
  conditions: { hours: { verifiedAt: '2026-10-09', sourceUrl, scope: 'full', holidayPolicy: 'same', weekly: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, [{ open: '09:00', close: '20:00' }]])) },
    price: { kind: 'free', amount: 0, scope: 'adult-one', taxStatus: 'included', label: '일반 관람', verifiedAt: '2026-10-09', sourceUrl } } });
const walking = (from, to, extra = {}) => ({ distanceMeters: 100, minMinutes: 2, maxMinutes: 2,
  coordinates: [[from.lon, from.lat], [to.lon, to.lat]], source: 'test-route', ...extra });
const options = places => ({ places, now, routeLeg: walking, ask: false });
const run = (input, places, extra = {}) => planTravel({ ...base, ...input }, { ...options(places), ...extra });
const stops = places => places.map(place => ({ placeId: place.id, place }));

test('동행은 구입력에서 비어 있고 정확한 별칭·boolmap·인원·ID 계약을 검사한다', () => {
  assert.deepEqual(normalizePlannerInput(base).companions, []);
  const p = person('p', { indoor: false });
  const malformed = [null, {}, 'p', [null], [{}], [{ ...p, label: '' }], [{ ...p, label: '   ' }], [{ ...p, label: '가'.repeat(25) }],
    [{ ...p, id: '__proto__' }], [{ ...p, age: 30 }], [{ ...p, preferences: undefined }], [{ ...p, requiredFeatures: undefined }],
    [{ ...p, preferences: { indoor: 1 } }], [{ ...p, preferences: { invented: true } }], [{ ...p, requiredFeatures: { quiet: null } }],
    [{ ...p, preferences: {} }], [p, p], [p, person('two', { tea: true }), person('three', { tea: false })]];
  for (const companions of malformed) assert.throws(() => normalizePlannerInput({ ...base, companions }), error => error.field === 'companions');
  assert.throws(() => normalizePlannerInput({ ...base, party: { adults: 7, children: 0 }, companions: Array.from({ length: 7 }, (_, i) => person(`p${i}`, { tea: true })) }), /최대 6명/);
  const normalized = normalizePlannerInput({ ...base, companions: [{ ...p, label: '  친구  ' }, person('a', {}, { indoor: true })] });
  assert.equal(normalized.companions[1].label, '친구');
  assert.equal(normalized.companions[1].preferences.indoor, false);
  assert.deepEqual(normalized.requiredFeatures, {});
  assert.deepEqual(normalized.preferences, {});
});

test('서로 반대인 필수 조건은 동행 이름으로 명확히 거절하고 soft는 자동으로 바꾸지 않는다', () => {
  const a = { ...person('a', {}, { indoor: true }), label: '친구 A' }, b = { ...person('b', {}, { indoor: false }), label: '친구 B' };
  assert.throws(() => normalizePlannerInput({ ...base, companions: [a, b] }), error => error.field === 'companions' && error.message.includes('친구 A') && error.message.includes('친구 B'));
  assert.throws(() => normalizePlannerInput({ ...base, requiredFeatures: { indoor: false }, companions: [a] }), error => error.field === 'companions' && error.message.includes('공통') && error.message.includes('친구 A'));
  const input = normalizePlannerInput({ ...base, companions: [person('a', { indoor: false }, { indoor: true })] });
  assert.equal(input.companions[0].preferences.indoor, false);
  assert.equal(input.companions[0].requiredFeatures.indoor, true);
});

test('동행 필수는 모두 AND이며 알려진 불일치와 미확인을 모두 추천에서 제외한다', () => {
  const places = [venue('a', { indoor: true, quiet: true }), venue('b', { indoor: true, quiet: true }),
    venue('unknown', { indoor: true }), venue('mismatch', { indoor: false, quiet: true })];
  const result = run({ companions: [person('friend', {}, { quiet: true }), person('child', {}, { indoor: true })] }, places);
  assert.deepEqual(new Set(result.primary.stops.map(stop => stop.placeId)), new Set(['a', 'b']));
  assert.ok(result.unknowns.some(row => row.placeId === 'unknown' && row.reason.includes('friend')));
  assert.ok(result.blocked.some(row => row.placeId === 'mismatch' && row.reason.includes('child')));
  const impossible = run({ companions: [person('friend', {}, { quiet: true })] }, [places[2], places[3]]);
  assert.equal(impossible.primary, null);
});

test('동행의 무계단 필수는 장소뿐 아니라 왕복 경로에도 적용한다', () => {
  const places = [venue('a', { stepFree: true }), venue('b', { stepFree: true })], companions = [person('walker', {}, { stepFree: true })];
  const missing = run({ companions }, places);
  assert.equal(missing.primary, null);
  assert.ok(missing.unknowns.some(row => row.kind === 'required.stepFree.route'));
  const destination = { ...base.origin, id: 'home' }, requested = [];
  const lateMissing = run({ companions, destination }, places, { routeLeg: (from, to, options) => { requested.push(options.stepFree); return walking(from, to, { stepFreeVerified: to.id !== 'home' }); } });
  assert.equal(lateMissing.primary, null);
  assert.ok(requested.every(Boolean));
  assert.ok(lateMissing.unknowns.some(row => row.kind === 'required.stepFree.return'));
});

test('저장 필수 재검사는 같은 분야 범위를 쓰고 각 이동과 마지막 도착 경로도 확인한다', () => {
  const places = [venue('museum', { indoor: true, stepFree: true }), venue('meal', { indoor: true, vegetarian: true, noodles: false, stepFree: true }, 'food')];
  const input = { requiredFeatures: { indoor: true }, companions: [person('friend', {}, { vegetarian: true, noodles: false, stepFree: true })], destination: base.origin };
  const route = { legs: [{ stepFreeVerified: true }, { stepFreeVerified: true }], returnLeg: { stepFreeVerified: true } };
  const checks = assessPlannerRequirements(stops(places), input, route);
  assert.ok(checks.every(row => row.status === 'matched'));
  assert.ok(!checks.some(row => row.placeId === 'museum' && ['required.vegetarian', 'required.noodles'].includes(row.kind)));
  assert.equal(checks.filter(row => row.kind === 'required.stepFree.route').length, 2);
  assert.equal(checks.filter(row => row.kind === 'required.stepFree.return').length, 1);
  const partialRoute = assessPlannerRequirements(stops(places), input, { legs: [route.legs[0]] });
  assert.equal(partialRoute.find(row => row.kind === 'required.stepFree.route' && row.placeId === 'meal').status, 'unknown');
  assert.equal(partialRoute.find(row => row.kind === 'required.stepFree.return').status, 'unknown');
  const changed = assessPlannerRequirements(stops(places), { ...input, companions: [person('friend', {}, { quiet: true })] }, route);
  assert.ok(changed.some(row => row.kind === 'required.quiet' && row.status === 'unknown' && row.reason.includes('friend')));
  const mismatch = assessPlannerRequirements(stops(places), { ...input, requiredFeatures: {}, companions: [person('friend', {}, { indoor: false })] }, route);
  assert.ok(mismatch.some(row => row.kind === 'required.indoor' && row.status === 'unmatched'));
});

test('개인별 설명은 실제 반영·미확인·알려진 회피 충돌·미반영을 분리한다', () => {
  const known = venue('food', { noodles: true, dumplings: false }, 'food'), uncertain = venue('other', { noodles: null }, 'food');
  const input = [person('friend', { noodles: false, dumplings: false, soup: true, templeFood: true })];
  const report = assessCompanionFit(stops([known, uncertain]), input)[0].preferences;
  assert.deepEqual(report.find(row => row.key === 'noodles'), { key: 'noodles', value: false, status: 'conflict', matchedPlaceIds: [], unknownPlaceIds: ['other'], conflictPlaceIds: ['food'] });
  assert.equal(report.find(row => row.key === 'dumplings').status, 'unknown', 'one known false cannot verify the unknown venue');
  assert.equal(report.find(row => row.key === 'soup').status, 'unknown');
  const omission = assessCompanionFit(stops([venue('museum', {})]), [person('p', { noodles: false, soup: true })])[0].preferences;
  assert.deepEqual(omission.find(row => row.key === 'noodles'), { key: 'noodles', value: false, status: 'reflected', matchedPlaceIds: [], unknownPlaceIds: [], conflictPlaceIds: [] });
  assert.equal(omission.find(row => row.key === 'soup').status, 'unmet');
  const met = assessCompanionFit(stops([known]), [person('p', { noodles: true, dumplings: false })])[0];
  assert.ok(met.preferences.every(row => row.status === 'reflected' && row.matchedPlaceIds[0] === 'food'));
  assert.ok(!JSON.stringify(met).includes('score'));
});

test('입력을 많이 한 사람에게 치우치지 않고 서로 다른 취향을 함께 담는 실제 코스를 고른다', () => {
  const rich = { indoor: true, art: true, history: true, quiet: true, walk: true };
  const a = { ...rich, outdoor: false }, b = Object.fromEntries(Object.keys(a).map(key => [key, !a[key]]));
  const places = [venue('a1', a), venue('a2', a), venue('b', b)];
  const single = run({ preferences: rich }, places);
  assert.ok(single.primary.stops.every(stop => stop.placeId.startsWith('a')));
  const balanced = run({ preferences: rich, companions: [person('many', rich), person('one', { outdoor: true })] }, places);
  assert.ok(balanced.primary.stops.some(stop => stop.placeId === 'b'));
  assert.ok(balanced.primary.stops.some(stop => stop.placeId.startsWith('a')));
  assert.ok(assessCompanionFit(balanced.primary.stops, balanced.input.companions).every(row => row.preferences.every(pref => pref.status === 'reflected')));
  assert.equal(balanced.engineAudit.companionPolicy.order, 'least-then-average-then-group-and-route');
});

test('평균이 더 높아도 한 사람만 빠지는 안보다 최소 반영이 높은 안을 먼저 고른다', () => {
  const companions = [person('a', { indoor: true, outdoor: true }), person('b', { art: true, history: true }), person('c', { quiet: true, walk: true })];
  const unequal = venue('unequal', { indoor: true, outdoor: true, art: true, history: true, quiet: false, walk: false });
  const equal = venue('equal', { indoor: true, outdoor: false, art: true, history: false, quiet: true, walk: false });
  const input = { planningMode: 'remaining', stopCount: 1, party: { adults: 3, children: 0 }, preferences: { outdoor: true, history: true }, companions };
  assert.equal(run(input, [unequal, equal]).primary.stops[0].placeId, 'equal');
  const betterAverage = venue('average', { indoor: true, outdoor: true, art: true, history: false, quiet: true, walk: false });
  assert.equal(run(input, [unequal, equal, betterAverage]).primary.stops[0].placeId, 'average');
});

test('회피 근거 없음은 성공으로 승격하지 않되 확인된 회피 충돌보다 우선 비교한다', () => {
  const places = [venue('bad', { noodles: true }, 'food'), venue('unknown', {}, 'food'), venue('known', { noodles: false }, 'food')];
  const input = { planningMode: 'remaining', stopCount: 1, requiredCategories: ['food'], companions: [person('p', { noodles: false })] };
  const result = run(input, places.slice(0, 2));
  assert.equal(result.primary.stops[0].placeId, 'unknown');
  assert.equal(assessCompanionFit(result.primary.stops, result.input.companions)[0].preferences[0].status, 'unknown');
  assert.equal(run(input, places).primary.stops[0].placeId, 'known');
});

test('프로필·카탈로그 순서를 바꿔도 같은 결과이며 공통 취향·확인 기억으로 자동 합치지 않는다', () => {
  const places = [venue('a', { indoor: true }), venue('b', { indoor: false }), venue('c', { indoor: true })];
  const companions = [person('z', { indoor: true }), person('a', { indoor: false })];
  const feedback = [{ id: 'confirmed', key: 'tea', value: true, status: 'confirmed', confirmedAt: now, source: { kind: 'user-confirmation' } }];
  const input = { ...base, companions, preferences: { culture: true } }, before = structuredClone({ input, places, feedback });
  const first = run(input, places, { feedback });
  const reversed = run({ ...input, companions: [...companions].reverse() }, [...places].reverse(), { feedback });
  assert.deepEqual(first, reversed);
  assert.deepEqual({ input, places, feedback }, before);
  assert.deepEqual(first.engineAudit.semanticPreferences.map(row => row.field), ['tea', 'culture']);
  assert.deepEqual(first.input.preferences, { culture: true });
  assert.deepEqual(first.input.requiredFeatures, {});
});

test('교체·복구·남은 일정에서도 동행 취향과 필수 조건을 그대로 유지한다', () => {
  const places = [venue('a', { indoor: true, art: true }), venue('b', { indoor: true, art: false }), venue('c', { indoor: true, art: true })];
  const companions = [person('friend', { art: true }, { indoor: true })], input = { ...base, companions };
  const initial = run(input, places);
  const replacement = places.find(place => !initial.primary.stops.some(stop => stop.placeId === place.id));
  const swapped = replanTravel(input, { ...options(places), replace: { fromId: initial.primary.stops[0].placeId, toId: replacement.id } });
  assert.deepEqual(swapped.input.companions, companions);
  const recovery = suggestTravelRecovery({ ...input, endTime: '10:40' }, options(places));
  assert.ok(recovery.suggestions.length);
  assert.ok(recovery.suggestions.every(row => JSON.stringify(row.result.input.companions) === JSON.stringify(companions)));
  const remaining = replanRemainingTravel(input, { ...options(places), completedIds: ['a'], currentTime: '11:00', origin: base.origin, remainingBudget: 10000, maxWalkMinutes: 30, stopCount: 1 });
  assert.deepEqual(remaining.input.companions, companions);
  assert.equal(remaining.primary.stops[0].placeId, 'c');
  assert.equal(remaining.input.companions[0].requiredFeatures.indoor, true);
});

test('Ask의 답별 미리보기는 동행을 보존한 같은 재계산 결과이며 강제 조건을 묻지 않는다', () => {
  const places = [venue('culture', { indoor: true }), venue('noodles', { indoor: true, noodles: true }, 'food'), venue('other', { indoor: true, noodles: false }, 'food')];
  const input = { ...base, lockedIds: ['culture'], requiredCategories: ['food'], companions: [person('friend', { indoor: true })] };
  const first = run(input, places, { ask: true });
  assert.equal(first.question.about, 'noodles');
  for (const answer of first.question.options) {
    const applied = run({ ...input, preferences: { noodles: answer.value } }, places);
    assert.deepEqual(applied.input.companions, input.companions);
    assert.equal(applied.primary.id, answer.preview.planId);
  }
  const constrained = run({ ...input, companions: [person('friend', {}, { noodles: false })] }, places, { ask: true });
  assert.ok(!constrained.question || constrained.question.about !== 'noodles');
  assert.equal(constrained.primary.stops.find(stop => stop.place.category === 'food').placeId, 'other');
});

test('실제 장소·OSM에서도 동행의 반대 음식 취향이 다른 일정을 만들고 미확인 회피를 구분한다', () => {
  const routeLeg = createWalkingRouter(JSON.parse(readFileSync(new URL('../experiences/path-travel/assets/jongno-walking.json', import.meta.url), 'utf8')));
  const input = { ...base, requiredCategories: ['food'], preferences: { culture: true }, companions: [person('friend', { dumplings: true })] };
  const liked = planTravel(input, { places: TRAVEL_PLACES, now, routeLeg, ask: false });
  const avoided = planTravel({ ...input, companions: [person('friend', { dumplings: false })] }, { places: TRAVEL_PLACES, now, routeLeg, ask: false });
  assert.ok(liked.primary && avoided.primary);
  assert.notDeepEqual(liked.primary.stops.map(stop => stop.placeId), avoided.primary.stops.map(stop => stop.placeId));
  assert.equal(assessCompanionFit(liked.primary.stops, liked.input.companions)[0].preferences[0].status, 'reflected');
  const report = assessCompanionFit(avoided.primary.stops, avoided.input.companions)[0].preferences[0];
  assert.equal(report.status, 'unknown');
  assert.ok(report.unknownPlaceIds.length);
  assert.ok(liked.primary.legs.every(leg => leg.source === 'osm-walking-network'));
  assert.ok(liked.primary.walking.maxMinutes <= input.maxWalkMinutes && avoided.primary.walking.maxMinutes <= input.maxWalkMinutes);
});
