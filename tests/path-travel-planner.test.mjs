import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { planTravel, replanTravel, normalizePlannerInput, estimateWalkingLeg } from '../experiences/path-travel/planner.mjs';

const now = '2026-10-09T03:00:00.000Z';
const base = {
  date: '2026-10-10', startTime: '10:00', endTime: '18:00',
  origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 3,
  preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [],
};
const options = { now, ask: false };
const sourceUrl = 'https://example.org/official';
const open = { verifiedAt: '2026-10-07', sourceUrl, scope: 'full', holidayPolicy: 'same', weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open: '09:00', close: '20:00' }]])) };
const price = amount => ({ kind: amount ? 'exact' : 'free', amount, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', sourceUrl, verifiedAt: '2026-10-07' });
const venue = (id, category, features = {}, amount = 0, extra = {}) => ({
  id, name: id, category, address: '서울 종로', dayPlannerEligible: true,
  coordinates: { lat: 37.5765, lon: 126.9855 + (id.charCodeAt(0) - 97) * 0.0005 },
  features, planningStayMinutes: 40, checkedAt: '2026-10-07', verifiedAt: '2026-10-07',
  conditions: { hours: open, price: price(amount) }, ...extra,
});
const fixture = [
  venue('a', 'culture', { indoor: true, outdoor: false, art: true }),
  venue('b', 'culture', { indoor: false, outdoor: true, history: true }),
  venue('c', 'tea', { indoor: true, outdoor: false }),
  venue('d', 'food', { indoor: true, outdoor: false, vegetarian: true }, 15000),
  venue('e', 'food', { indoor: false, outdoor: true, vegetarian: false }, 20000),
  venue('f', 'culture', { indoor: true, outdoor: false, stepFree: false }),
];
const run = (input, places = fixture, extra = {}) => planTravel({ ...base, ...input }, { ...options, places, ...extra });
function validPlan(result, input) {
  assert.ok(result.primary, JSON.stringify({ blocked: result.blocked, unknowns: result.unknowns }));
  for (const plan of [result.primary, ...result.alternatives]) {
    assert.ok(plan.stops.length >= 2 && plan.stops.length <= input.stopCount);
    assert.ok(plan.walking.maxMinutes <= input.maxWalkMinutes);
    assert.ok(plan.endTime <= input.endTime);
    assert.ok(plan.cost.knownAmount <= input.budget);
    assert.equal(new Set(plan.stops.map(stop => stop.placeId)).size, plan.stops.length);
    for (const stop of plan.stops) assert.notEqual(stop.schedule.status, 'unmatched');
  }
}

test('실제 종로: 서로 다른 여행자 8명의 일정은 시간·인원 비용·걷기 제약을 지킨다', () => {
  const personas = [
    ['미술을 보는 혼자 여행', { preferences: { art: true, culture: true, indoor: true } }],
    ['친구 둘과 한 끼·차', { party: { adults: 2, children: 0 }, preferences: { food: true, tea: true }, requiredCategories: ['food', 'tea'], budget: 120000 }],
    ['부모와 아이 동행', { party: { adults: 2, children: 1 }, preferences: { culture: true }, maxWalkMinutes: 80 }],
    ['실내를 꼭 원하는 비 오는 날', { preferences: { culture: true, tea: true }, requiredFeatures: { indoor: true }, maxWalkMinutes: 90 }],
    ['야외·역사 선호', { preferences: { outdoor: true, history: true }, startTime: '09:00' }],
    ['짧게 두 곳만', { stopCount: 2, endTime: '15:00', preferences: { culture: true }, maxWalkMinutes: 70 }],
    ['무료 관람 중심', { budget: 0, preferences: { culture: true }, requiredCategories: ['culture'] }],
    ['혼자 차와 문화', { preferences: { tea: true, culture: true }, requiredCategories: ['tea'], budget: 30000 }],
  ];
  for (const [name, settings] of personas) {
    const input = { ...base, ...settings }, result = planTravel(input, options);
    assert.ok(result.primary, `${name}: ${JSON.stringify(result.blocked)}`);
    validPlan(result, input);
    if (settings.party?.children) {
      assert.equal(result.status, 'partial', name);
      assert.ok(result.primary.stops.some(stop => stop.cost.unknowns.some(reason => reason.includes('아이'))), name);
    }
    if (settings.requiredFeatures?.indoor) assert.ok(result.primary.stops.every(stop => stop.place.features?.indoor !== false));
  }
});

test('실내와 야외의 반대 선호는 확인된 의미 특성으로 다른 장소를 고른다', () => {
  const inside = run({ stopCount: 2, preferences: { indoor: true }, requiredCategories: ['culture'] });
  const outside = run({ stopCount: 2, preferences: { indoor: false }, requiredCategories: ['culture'] });
  assert.notDeepEqual(inside.primary.stops.map(stop => stop.placeId), outside.primary.stops.map(stop => stop.placeId));
  assert.ok(inside.primary.stops.every(stop => stop.place.features.indoor));
  assert.ok(outside.primary.stops.every(stop => !stop.place.features.indoor));
  assert.ok(inside.engineAudit.decisionReasons.some(row => row.field === 'indoor' && row.evidence.length));
});

test('필수 불일치와 근거 미확인은 구분하고 둘 다 가능한 추천에서 제외한다', () => {
  const strict = run({ requiredFeatures: { indoor: true, stepFree: true }, stopCount: 2 });
  assert.equal(strict.status, 'unavailable');
  assert.equal(strict.primary, null);
  assert.ok(strict.unknowns.some(row => row.kind === 'required.stepFree' && row.status === 'unknown'));
  assert.ok(strict.blocked.some(row => row.kind === 'required.stepFree' && row.status === 'unmatched'));
  const vegan = run({ requiredFeatures: { vegetarian: true }, requiredCategories: ['food'], stopCount: 2 });
  assert.ok(vegan.primary.stops.some(stop => stop.placeId === 'd'));
  assert.ok(vegan.primary.stops.every(stop => stop.placeId !== 'e'));
});

test('성인 비용은 인원만큼 곱하고 아이·표시 메뉴 미확인 비용을 0원으로 확정하지 않는다', () => {
  const adults = run({ party: { adults: 3, children: 0 }, lockedIds: ['d'], stopCount: 2 });
  assert.equal(adults.primary.stops.find(stop => stop.placeId === 'd').cost.knownAmount, 45000);
  const family = run({ party: { adults: 2, children: 1 }, lockedIds: ['d'], stopCount: 2 });
  assert.equal(family.status, 'partial');
  assert.equal(family.primary.cost.status, 'unknown');
  assert.ok(family.primary.cost.unknownPlaceIds.includes('d'));
  const tooLow = run({ party: { adults: 3, children: 0 }, budget: 40000, lockedIds: ['d'] });
  assert.equal(tooLow.primary, null);
  assert.ok(tooLow.blocked.some(row => row.kind === 'budget'));
});

test('보행 상한은 추정 상단으로 강제하며 확인 필요 경로는 메인에서 제외한다', () => {
  const routeLeg = (from, to) => ({ distanceMeters: 500, minMinutes: 5, maxMinutes: 20, coordinates: [[from.lon, from.lat], [to.lon, to.lat]], source: 'test-network' });
  const limited = run({ maxWalkMinutes: 25, stopCount: 2 }, fixture, { routeLeg });
  assert.equal(limited.status, 'unavailable');
  assert.ok(limited.diagnostics.walkingUncertainCandidates > 0);
  const accepted = run({ maxWalkMinutes: 40, stopCount: 2 }, fixture, { routeLeg });
  assert.equal(accepted.primary.walking.maxMinutes, 40);
  assert.ok(accepted.primary.legs.every(leg => leg.source === 'test-network'));
});

test('원점과 길망 이동시간은 실제 일정 순서·도착시간에 적용된다', () => {
  const first = run({ stopCount: 2 });
  const moved = run({ stopCount: 2, origin: { ...base.origin, lat: 37.59 } });
  assert.notEqual(first.primary.inputFingerprint, moved.primary.inputFingerprint);
  assert.ok(moved.primary.legs[0].maxMinutes > first.primary.legs[0].maxMinutes);
  assert.notEqual(first.primary.stops[0].arrivalTime, moved.primary.stops[0].arrivalTime);
  const fallback = estimateWalkingLeg(base.origin, fixture[0], { routeLeg: () => null });
  assert.equal(fallback.source, 'coordinate-distance-estimate');
  assert.match(fallback.label, /실제 길이 아님/);
});

test('무계단 필수는 장소 정보만으로 길의 계단·단차까지 보장하지 않는다', () => {
  const accessible = fixture.slice(0, 3).map(place => ({ ...place, features: { ...place.features, stepFree: true } }));
  const result = run({ requiredFeatures: { stepFree: true }, stopCount: 2 }, accessible);
  assert.equal(result.primary, null);
  assert.ok(result.unknowns.some(row => row.kind === 'required.stepFree.route'));
});

test('유지·제외·교체는 전체 동선과 비용·시각을 재계산한다', () => {
  const initial = run({ stopCount: 3, lockedIds: ['a', 'd'] });
  assert.ok(initial.primary.stops.some(stop => stop.placeId === 'a'));
  const replaced = replanTravel(initial.input, { ...options, places: fixture, replace: { fromId: 'd', toId: 'e' } });
  assert.ok(replaced.primary.stops.some(stop => stop.placeId === 'a'));
  assert.ok(replaced.primary.stops.some(stop => stop.placeId === 'e'));
  assert.ok(replaced.primary.stops.every(stop => stop.placeId !== 'd'));
  assert.notEqual(replaced.primary.inputFingerprint, initial.primary.inputFingerprint);
  assert.ok(replaced.primary.cost.knownAmount >= 20000);
  assert.notDeepEqual(replaced.primary.legs.map(leg => [leg.fromId, leg.toId]), initial.primary.legs.map(leg => [leg.fromId, leg.toId]));
});

test('문을 열기 전이면 대기하되 체류 중 닫는 장소는 운영 가능으로 만들지 않는다', () => {
  const late = venue('z', 'culture', { indoor: true }, 0, { conditions: { price: price(0), hours: { ...open, weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open: '11:00', close: '13:00' }]])) } } });
  const result = run({ stopCount: 2, lockedIds: ['z'], endTime: '15:00' }, [fixture[0], late]);
  const stop = result.primary.stops.find(stop => stop.placeId === 'z');
  assert.ok(stop.arrivalTime >= '11:00');
  assert.ok(stop.departureTime <= '13:00');
  const impossible = run({ stopCount: 2, startTime: '12:45', endTime: '14:00', lockedIds: ['z'] }, [fixture[0], late]);
  assert.equal(impossible.status, 'unavailable');
});

test('다섯 곳을 원해도 짧은 방문 가능 대안은 남기고 시간과 걷기를 늘리지 않는다', () => {
  const short = run({ stopCount: 5, endTime: '12:00' });
  assert.ok(short.primary.stops.length >= 2 && short.primary.stops.length < 5);
  assert.match(short.primary.reasons.join(' '), /짧은/);
  validPlan(short, { ...base, stopCount: 5, endTime: '12:00' });
  const long = run({ stopCount: 5, endTime: '20:00', maxWalkMinutes: 200 });
  assert.equal(long.primary.stops.length, 5);
});

test('확인한 피드백만 선호로 쓰며 이번 입력이 기억보다 우선한다', () => {
  const feedback = [{ id: 'f1', key: 'indoor', value: false, status: 'proposed', confirmedAt: now, source: { kind: 'user-confirmation' } }];
  const pending = run({ stopCount: 2 }, fixture, { feedback });
  assert.equal(pending.engineAudit.semanticPreferences.length, 0);
  feedback[0].status = 'confirmed';
  const remembered = run({ stopCount: 2 }, fixture, { feedback });
  assert.ok(remembered.primary.stops.every(stop => stop.place.features.indoor === false));
  const override = run({ stopCount: 2, preferences: { indoor: true } }, fixture, { feedback });
  assert.ok(override.primary.stops.every(stop => stop.place.features.indoor === true));
  assert.equal(override.engineAudit.semanticPreferences[0].origin, 'this-trip');
});

test('같은 입력·시각·자료는 결정적으로 같고 어떤 입력도 수정하지 않는다', () => {
  const input = structuredClone(base), places = structuredClone(fixture), snapshot = structuredClone({ input, places });
  assert.deepEqual(planTravel(input, { ...options, places }), planTravel(input, { ...options, places }));
  assert.deepEqual({ input, places }, snapshot);
  assert.throws(() => normalizePlannerInput({ ...base, lockedIds: ['a'], excludedIds: ['a'] }), /유지하면서 제외/);
  assert.throws(() => normalizePlannerInput({ ...base, party: { adults: 0, children: 2 } }), /성인/);
  assert.throws(() => normalizePlannerInput({ ...base, date: '2026-02-30' }), /날짜/);
  assert.throws(() => planTravel({ ...base, lockedIds: ['not-real'] }, options), /없는 곳/);
});

test('시작·종료·장소 수가 불가능하면 조건을 몰래 풀지 않는다', () => {
  const result = run({ startTime: '17:45', endTime: '18:00', stopCount: 3, maxWalkMinutes: 5 });
  assert.equal(result.primary, null);
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.input, normalizePlannerInput({ ...base, startTime: '17:45', endTime: '18:00', stopCount: 3, maxWalkMinutes: 5 }));
  assert.ok(result.blocked.length || result.unknowns.length);
});

test('0원은 가격 미확인 식당을 공짜처럼 끼우지 않고 확인된 무료만 추천한다', () => {
  const result = planTravel({ ...base, budget: 0, preferences: { food: true } }, options);
  assert.ok(result.primary);
  assert.ok([result.primary, ...result.alternatives].every(plan => plan.cost.knownAmount === 0 && plan.cost.status === 'matched'));
  assert.ok(result.unknowns.some(row => row.kind === 'budget.free-only'));
  const impossible = planTravel({ ...base, budget: 0, requiredCategories: ['food'] }, options);
  assert.equal(impossible.primary, null);
});

test('과거 날짜는 새 일정으로 생성하지 않고 한국 날짜 경계를 사용한다', () => {
  assert.throws(() => planTravel({ ...base, date: '2026-10-08' }, options), error => error.field === 'date' && /지난 날짜/.test(error.message));
  assert.throws(() => planTravel({ ...base, date: '2026-10-09' }, { ...options, now: '2026-10-09T15:01:00.000Z' }), /지난 날짜/);
  assert.doesNotThrow(() => planTravel({ ...base, date: '2026-10-10' }, { ...options, now: '2026-10-09T15:01:00.000Z' }));
});
