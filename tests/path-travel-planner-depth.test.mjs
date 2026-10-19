import test from 'node:test';
import assert from 'node:assert/strict';
import { planTravel, replanTravel, normalizePlannerInput, DETAIL_PREFERENCE_CATEGORIES, PREFERENCE_LABELS } from '../experiences/path-travel/planner.mjs';

const now = '2026-10-09T03:00:00.000Z';
const sourceUrl = 'https://example.org/official';
const price = amount => ({ kind: amount ? 'exact' : 'free', amount, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', sourceUrl, verifiedAt: '2026-10-09' });
const hours = { verifiedAt: '2026-10-09', sourceUrl, scope: 'full', holidayPolicy: 'same', weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open: '09:00', close: '20:00' }]])) };
const venue = (id, category, features = {}, amount = 0) => ({ id, name: `장소 ${id}`, category, address: '서울 종로', dayPlannerEligible: true,
  coordinates: { lat: 37.5765, lon: 126.9855 }, features, planningStayMinutes: 40, checkedAt: '2026-10-09', verifiedAt: '2026-10-09', conditions: { hours, price: price(amount) } });
const base = { date: '2026-10-10', startTime: '10:00', endTime: '18:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 2,
  preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [] };
const fixedLeg = (minMinutes = 5, maxMinutes = 5) => (from, to) => ({ distanceMeters: 250, minMinutes, maxMinutes, coordinates: [[from.lon, from.lat], [to.lon, to.lat]], source: 'test-confirmed-route' });
const run = (places, input = {}, settings = {}) => planTravel({ ...base, ...input }, { places, now, ask: false, routeLeg: fixedLeg(), ...settings });
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

test('음식·차의 8개 세부 선호와 회피는 해당 분야의 확인된 장소를 서로 다르게 고른다', () => {
  for (const [key, category] of Object.entries(DETAIL_PREFERENCE_CATEGORIES)) {
    const places = [venue('a', category, { [key]: true }, 5000), venue('b', category, { [key]: false }, 10000), venue('c', 'culture', { [key]: true })];
    const input = { requiredCategories: [category, 'culture'] };
    const yes = run(places, { ...input, preferences: { [key]: true } }), no = run(places, { ...input, preferences: { [key]: false } });
    assert.ok(yes.primary.stops.some(stop => stop.placeId === 'a'), key);
    assert.ok(no.primary.stops.some(stop => stop.placeId === 'b'), key);
    assert.ok(no.primary.stops.find(stop => stop.placeId === 'b').reasons.includes(`${PREFERENCE_LABELS[key]} 피하기 반영`));
    assert.equal(no.engineAudit.decisionReasons.find(reason => reason.field === key).candidateValue, 0, `${key}: unrelated culture feature must be ignored`);
  }
});

test('null·누락된 음식 특성은 회피 성공이나 필수 충족으로 승격하지 않는다', () => {
  const places = [venue('a', 'food', { noodles: null }), venue('b', 'culture', { noodles: true })];
  const result = run(places, { preferences: { noodles: false }, requiredCategories: ['food'] });
  assert.ok(result.primary);
  assert.ok(!result.engineAudit.decisionReasons.some(reason => reason.field === 'noodles'));
  assert.ok(result.primary.stops.every(stop => !stop.reasons.includes('면 요리 피하기 반영')));
  const strict = run(places, { requiredFeatures: { noodles: false }, requiredCategories: ['food'] });
  assert.equal(strict.primary, null);
  assert.ok(strict.unknowns.some(row => row.kind === 'required.noodles' && row.placeId === 'a'));
  const verified = run([venue('a', 'food', { noodles: false }), places[1]], { requiredFeatures: { noodles: false }, requiredCategories: ['food'] });
  assert.ok(verified.primary, 'category-specific required cuisine must not block a museum');
});

test('회피할 음식이 확인된 곳은 덜 고르되 미확인 대안을 확인된 회피 충족이라고 말하지 않는다', () => {
  const places = [venue('a', 'food', { dumplings: true }), venue('b', 'food', { dumplings: null }), venue('c', 'culture')];
  const input = { requiredCategories: ['food', 'culture'] };
  const yes = run(places, { ...input, preferences: { dumplings: true } });
  const no = run(places, { ...input, preferences: { dumplings: false } });
  assert.ok(yes.primary.stops.some(stop => stop.placeId === 'a'));
  assert.ok(no.primary.stops.some(stop => stop.placeId === 'b'));
  assert.ok(!no.engineAudit.decisionReasons.some(reason => reason.field === 'dumplings'));
  assert.ok(no.primary.stops.every(stop => !stop.reasons.includes('만두 피하기 반영')));
  const required = run(places, { ...input, requiredFeatures: { dumplings: false } });
  assert.equal(required.primary, null, 'a required avoidance still rejects both known conflict and unknown');
});

test('세부 회피 기억을 보존하고 이번 여행의 반대 선호로 명시적으로 덮어쓴다', () => {
  const places = [venue('a', 'food', { soup: true }), venue('b', 'food', { soup: false }), venue('c', 'culture')];
  const feedback = [{ id: 'confirmed-soup', key: 'soup', value: false, status: 'confirmed', confirmedAt: now, source: { kind: 'user-confirmation' } }];
  assert.ok(run(places, { requiredCategories: ['food', 'culture'] }, { feedback }).primary.stops.some(stop => stop.placeId === 'b'));
  assert.ok(run(places, { requiredCategories: ['food', 'culture'], preferences: { soup: true } }, { feedback }).primary.stops.some(stop => stop.placeId === 'a'));
});

test('Ask는 실제 두 답의 장소·시각·부분합·걷기 미리보기를 제공하며 적용한 결과와 같다', () => {
  const places = [venue('a', 'food', { noodles: true }, 5000), venue('b', 'food', { noodles: false }, 12000), venue('c', 'culture')];
  const input = { requiredCategories: ['food', 'culture'] }, result = run(places, input, { ask: true });
  const question = result.question;
  assert.equal(question.about, 'noodles');
  assert.match(question.caveat, /미확인 비용/);
  assert.equal(question.before.planId, result.primary.id);
  assert.notDeepEqual(question.options[0].preview.stops.map(stop => stop.placeId), question.options[1].preview.stops.map(stop => stop.placeId));
  for (const option of question.options) {
    const selected = run(places, { ...input, preferences: { [question.about]: option.value } }).primary;
    assert.equal(option.preview.planId, selected.id);
    assert.deepEqual(option.preview.stops, selected.stops.map(stop => ({ placeId: stop.placeId, name: stop.place.name, arrivalTime: stop.arrivalTime, departureTime: stop.departureTime })));
    assert.equal(option.preview.knownAmount, selected.cost.knownAmount);
    assert.equal(option.preview.walking.maxMinutes, selected.walking.maxMinutes);
    assert.equal(option.preview.changes.knownAmountDelta, selected.cost.knownAmount - result.primary.cost.knownAmount);
    assert.ok(!Object.hasOwn(option.preview, 'score'), 'utility score is not a satisfaction estimate');
  }
});

test('답이 달라도 고정한 같은 코스면 Ask가 입력별 ID 차이만으로 질문하지 않는다', () => {
  const places = [venue('a', 'food', { noodles: true }), venue('b', 'food', { noodles: false }), venue('c', 'culture')];
  assert.equal(run(places, { requiredCategories: ['food', 'culture'], lockedIds: ['a', 'c'] }, { ask: true }).question, null);
  const unknown = [venue('a', 'food', { noodles: null }), venue('b', 'food'), venue('c', 'culture')];
  assert.equal(run(unknown, { requiredCategories: ['food', 'culture'] }, { ask: true }).question, null);
});

test('한 번 걷기 제한은 총합과 별개이며 예상 상단을 넘는 구간을 허용하지 않는다', () => {
  const places = [venue('a', 'culture'), venue('b', 'culture')];
  const uncertain = run(places, { maxLegWalkMinutes: 7 }, { routeLeg: fixedLeg(4, 8) });
  assert.equal(uncertain.primary, null);
  assert.ok(uncertain.unknowns.some(check => check.kind === 'walking.leg'));
  const blocked = run(places, { maxLegWalkMinutes: 3 }, { routeLeg: fixedLeg(4, 8) });
  assert.equal(blocked.primary, null);
  assert.ok(blocked.blocked.some(check => check.kind === 'walking.leg'));
  const accepted = run(places, { maxLegWalkMinutes: 8 }, { routeLeg: fixedLeg(4, 8) });
  assert.ok(accepted.primary.legs.every(leg => leg.maxMinutes <= 8));
});

test('휴식은 실제 체류·출발·종료를 늦추며 확인된 좌석으로 표시하지 않는다', () => {
  // A window this short leaves no spare time to fill, so the rest alone moves the day.
  const places = [venue('a', 'culture'), venue('b', 'culture')], tight = { endTime: '11:50' };
  const ordinary = run(places, tight).primary, result = run(places, { ...tight, restEveryMinutes: 60, restDurationMinutes: 10 });
  const plan = result.primary, pauses = plan.stops.flatMap(stop => stop.pauses ?? []);
  assert.equal(pauses.length, 1);
  assert.equal(minute(plan.endTime) - minute(ordinary.endTime), 10);
  assert.equal(plan.cost.knownAmount, ordinary.cost.knownAmount);
  assert.deepEqual(plan.walking, ordinary.walking);
  assert.equal(plan.status, 'partial');
  for (const stop of plan.stops) {
    assert.equal(stop.stayMinutes, 40 + (stop.pauses ?? []).reduce((sum, pause) => sum + pause.durationMinutes, 0));
    assert.equal(minute(stop.departureTime) - minute(stop.arrivalTime), stop.stayMinutes);
    for (const pause of stop.pauses ?? []) {
      assert.ok(pause.startTime >= stop.arrivalTime && pause.endTime <= stop.departureTime);
      assert.equal(pause.locationStatus, 'unverified');
      assert.ok(plan.checks.some(check => check.kind === 'rest-place' && check.placeId === stop.placeId && check.status === 'unknown'));
    }
  }
});

test('휴식 포함 체류가 폐관이나 여행 종료를 넘으면 그대로 추천하지 않는다', () => {
  const closing = { ...hours, weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open: '09:00', close: '11:35' }]])) };
  const places = [venue('a', 'culture'), venue('b', 'culture')].map(place => ({ ...place, conditions: { ...place.conditions, hours: closing } }));
  assert.ok(run(places, { endTime: '11:35' }).primary);
  const relaxed = run(places, { endTime: '11:35', restEveryMinutes: 60, restDurationMinutes: 10 });
  assert.equal(relaxed.primary, null);
  const hoursOnly = run(places, { restEveryMinutes: 60, restDurationMinutes: 10 });
  assert.equal(hoursOnly.primary, null);
  assert.ok(hoursOnly.blocked.some(check => check.kind === 'schedule'));
});

test('휴식은 보행 경로에 가상 쉼터를 만들지 않고 도착한 장소 안에만 배치한다', () => {
  const places = [venue('a', 'culture'), venue('b', 'culture')];
  const result = run(places, { maxWalkMinutes: 200, restEveryMinutes: 30, restDurationMinutes: 5 }, { routeLeg: fixedLeg(35, 40) });
  assert.ok(result.primary);
  assert.equal(result.primary.stops[0].pauses[0].startTime, result.primary.stops[0].arrivalTime);
  assert.ok(result.primary.legs.every(leg => !Object.hasOwn(leg, 'pauses')));
  assert.match(result.primary.checks.find(check => check.kind === 'rest-place').reason, /다음 장소에 도착한 뒤/);
});

test('교체 후에도 구간 제한·휴식·운영 체류를 전체 재계산한다', () => {
  const places = [venue('a', 'culture'), venue('b', 'culture'), { ...venue('c', 'culture'), planningStayMinutes: 70 }];
  const input = { ...base, lockedIds: ['a', 'b'], maxLegWalkMinutes: 5, restEveryMinutes: 60, restDurationMinutes: 10 };
  const initial = run(places, input).primary;
  const result = replanTravel(input, { places, now, ask: false, routeLeg: fixedLeg(), replace: { fromId: 'b', toId: 'c' } });
  assert.ok(result.primary.stops.some(stop => stop.placeId === 'a'));
  assert.ok(result.primary.stops.some(stop => stop.placeId === 'c'));
  assert.ok(result.primary.stops.every(stop => stop.placeId !== 'b'));
  assert.ok(result.primary.endTime > initial.endTime);
  assert.ok(result.primary.legs.every(leg => leg.maxMinutes <= 5));
  assert.ok(result.primary.stops.some(stop => stop.pauses?.length));
});

test('구입력은 pace 기본값으로 복원하고 잘못된 간격·휴식값은 거절한다', () => {
  const normalized = normalizePlannerInput(base);
  assert.equal(normalized.maxLegWalkMinutes, null);
  assert.equal(normalized.restEveryMinutes, null);
  assert.equal(normalized.restDurationMinutes, 10);
  for (const [field, value] of [['maxLegWalkMinutes', -1], ['maxLegWalkMinutes', '10'], ['restEveryMinutes', 29], ['restEveryMinutes', 181], ['restDurationMinutes', null], ['restDurationMinutes', 4], ['restDurationMinutes', 31]]) {
    assert.throws(() => normalizePlannerInput({ ...base, [field]: value }), error => error.field === field);
  }
});
