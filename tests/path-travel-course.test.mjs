import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRealCourse, createRealCourseExample, createRealCourseFromSelection, evaluateRealCourse,
  replaceRealCourseStop, suggestRealCourseAlternatives, exportRealCourseMemo,
} from '../experiences/path-travel/real-course.mjs';
import { REAL_PLACES } from '../experiences/path-travel/real-places.mjs';
import { REAL_COURSE_OFFERINGS } from '../experiences/path-travel/real-course-data.mjs';
import { normalizeRealState, serializeRealState, readRealState, setRealVisit } from '../experiences/path-travel/real-guide.mjs';

const now = '2026-10-07T01:00:00.000Z', sourceUrl = 'https://official.example/visit';
const calendar = { from: '2026-10-07', through: '2026-11-06', holidays: ['2026-10-09'], verifiedAt: '2026-10-07', sourceUrl };
function venue(id, category = 'culture', amount = 3000) {
  return { id, name: id, category, address: '서울 종로', conditions: {
    hours: { verifiedAt: '2026-10-07', sourceUrl, scope: 'full', holidayPolicy: 'unknown',
      weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [String(day), [{ open: '10:00', close: '18:00', lastEntry: '17:30' }]])) },
    price: { kind: amount === 0 ? 'free' : 'exact', amount, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', verifiedAt: '2026-10-07', sourceUrl },
  } };
}
const catalog = [venue('a'), venue('b', 'culture', 0), venue('c', 'culture', 1000), venue('f', 'food'), venue('t', 'tea'), venue('h', 'stay')];
const options = { now, calendar, catalog, offerings: {} };
function course() { return { date: '2026-10-08', startTime: '11:30', totalBudget: 10000,
  stops: [{ placeId: 'a', stayMinutes: 60, useOffering: false }, { placeId: 'b', stayMinutes: 75, useOffering: false }], transfers: [15] }; }
const calc = (input = course(), settings = options) => evaluateRealCourse(input, settings);
const fails = (input, field) => assert.throws(() => normalizeRealCourse(input, { catalog }), error => error instanceof TypeError && error.field === field);

test('실제 날짜·시각·예산·장소·체류·이동 입력은 필드별로 엄격히 검증한다', () => {
  const invalids = [
    [{ date: '2026-02-30' }, 'date'], [{ date: null }, 'date'], [{ startTime: '24:00' }, 'startTime'],
    [{ totalBudget: Infinity }, 'totalBudget'], [{ totalBudget: 1000001 }, 'totalBudget'], [{ totalBudget: '1000' }, 'totalBudget'],
    [{ stops: [] }, 'stops'], [{ stops: [course().stops[0]] }, 'stops'], [{ stops: new Array(2) }, 'stops.0.placeId'],
    [{ transfers: [] }, 'transfers'], [{ transfers: [undefined] }, 'transfers.0'], [{ transfers: [181] }, 'transfers.0'], [{ transfers: [-1] }, 'transfers.0'], [{ transfers: [1.5] }, 'transfers.0'],
  ];
  invalids.forEach(([change, field]) => fails({ ...course(), ...change }, field));
  for (const [key, value, field] of [['placeId', 'h', 'placeId'], ['placeId', 'nope', 'placeId'], ['stayMinutes', 9, 'stayMinutes'], ['stayMinutes', 181, 'stayMinutes'], ['stayMinutes', NaN, 'stayMinutes'], ['useOffering', 'yes', 'useOffering']]) {
    const changed = course(); changed.stops[0][key] = value; fails(changed, `stops.0.${field}`);
  }
  const duplicate = course(); duplicate.stops[1].placeId = 'a'; fails(duplicate, 'stops.1.placeId');
  fails({ ...course(), extra: true }, 'course');
  fails(JSON.parse('{"__proto__":{}}'), 'course');
  const zero = normalizeRealCourse({ ...course(), totalBudget: -0, transfers: [-0] }, { catalog });
  assert.equal(Object.is(zero.totalBudget, -0), false);
  assert.equal(Object.is(zero.transfers[0], -0), false);
});

test('담은 목록 가져오기는 호텔만 제외하고 복사하며 4곳을 임의로 줄이지 않는다', () => {
  const ids = ['a', 'h', 'b'], original = [...ids];
  const draft = createRealCourseFromSelection(ids, { catalog });
  assert.deepEqual(ids, original);
  assert.deepEqual(draft.stops.map(row => row.placeId), ['a', 'b']);
  assert.deepEqual(draft.transfers, [null]);
  assert.ok(draft.stops.every(row => row.stayMinutes === null && row.useOffering === false));
  assert.throws(() => createRealCourseFromSelection(['a', 'b', 'c', 'f'], { catalog }), error => error.field === 'selection');
  assert.throws(() => createRealCourseFromSelection(['a', 'a'], { catalog }), error => error.field === 'selection');
});

test('편집한 체류와 이동 여유만 누적하고 시작 지연·순서 변경을 뒤 일정에 반영한다', () => {
  const input = course(), original = structuredClone(input), result = calc(input);
  assert.deepEqual(result.stops.map(row => [row.arrivalTime, row.departureTime]), [['11:30', '12:30'], ['12:45', '14:00']]);
  assert.equal(result.endTime, '14:00');
  assert.deepEqual(input, original);
  assert.equal(calc({ ...input, startTime: '12:00' }).endTime, '14:30');
  const reordered = calc({ ...input, stops: [...input.stops].reverse() });
  assert.deepEqual(reordered.stops.map(row => row.arrivalTime), ['11:30', '13:00']);
  assert.match(result.warnings.join(' '), /실제 도보·교통 소요시간이 아니/);
});

test('빈 이동 여유는 뒤 도착·종료를 미정으로, 빈 체류는 그 이후만 미정으로 만든다', () => {
  const input = { ...course(), stops: [...course().stops, { placeId: 'c', stayMinutes: 45, useOffering: false }], transfers: [null, 0] };
  const unknownGap = calc(input);
  assert.deepEqual(unknownGap.stops.map(row => [row.arrivalTime, row.departureTime]), [['11:30', '12:30'], [null, null], [null, null]]);
  assert.equal(unknownGap.endTime, null);
  assert.equal(unknownGap.stops[1].schedule.status, 'unknown');
  input.transfers = [15, 0]; input.stops[1].stayMinutes = null;
  assert.deepEqual(calc(input).stops.map(row => [row.arrivalTime, row.departureTime]), [['11:30', '12:30'], ['12:45', null], [null, null]]);
});

test('도착은 가능해도 체류가 폐관이나 쉬는 시간을 넘으면 불일치다', () => {
  const input = course(); input.startTime = '17:00'; input.stops[0].stayMinutes = 60;
  assert.equal(calc(input).stops[0].schedule.status, 'matched');
  input.stops[0].stayMinutes = 61;
  assert.equal(calc(input).stops[0].schedule.status, 'unmatched');
  const source = structuredClone(catalog);
  source[0].conditions.hours.weekly['4'] = [{ open: '11:00', close: '12:00' }, { open: '14:00', close: '18:00' }];
  assert.equal(calc(course(), { ...options, catalog: source }).stops[0].schedule.status, 'unmatched');
});

test('자정을 넘으면 당일 이후 연결을 멈추며 24:00 퇴장은 마지막 장소에서만 표시한다', () => {
  const source = structuredClone(catalog);
  source.forEach(place => { place.conditions.hours.weekly['4'] = [{ open: '00:00', close: '24:00' }]; });
  const input = { ...course(), startTime: '23:30', transfers: [0] };
  assert.equal(calc(input, { ...options, catalog: source }).endTime, null);
  assert.equal(calc(input, { ...options, catalog: source }).stops[1].arrivalTime, null);
  assert.match(calc(input, { ...options, catalog: source }).warnings.join(' '), /자정/);
  source[1].conditions.hours.weekly['4'] = [];
  assert.equal(calc(input, { ...options, catalog: source }).stops[1].schedule.status, 'unknown', '다음 날로 밀린 장소에 원래 날짜의 휴무를 단정하지 않는다');
  source[1].conditions.hours.weekly['4'] = [{ open: '00:00', close: '24:00' }];
  input.startTime = '22:00'; input.stops[0].stayMinutes = 60; input.stops[1].stayMinutes = 60;
  assert.equal(calc(input, { ...options, catalog: source }).endTime, '24:00');
});

test('무료와 일반 성인 요금의 알려진 부분합만 비교하고 미확인 비용을 숨기지 않는다', () => {
  const result = calc();
  assert.equal(result.knownSubtotal, 3000); assert.deepEqual(result.unknownCostIds, []); assert.equal(result.budget.status, 'matched');
  assert.equal(calc({ ...course(), totalBudget: 2999 }).budget.status, 'unmatched');
  assert.equal(calc({ ...course(), totalBudget: null }).budget.status, 'none');
  const source = structuredClone(catalog); source[1].conditions.price.kind = 'unknown';
  const unknown = calc(course(), { ...options, catalog: source });
  assert.equal(unknown.knownSubtotal, 3000); assert.deepEqual(unknown.unknownCostIds, ['b']); assert.equal(unknown.budget.status, 'unknown');
  assert.equal(calc({ ...course(), totalBudget: 2999 }, { ...options, catalog: source }).budget.status, 'unmatched');
});

test('예시 메뉴는 직접 포함한 경우만 항목 가격을 더하고 최저 비용으로 추론하지 않는다', () => {
  const input = course(); input.stops[0].placeId = 'f';
  const source = structuredClone(catalog); source[3].conditions.price = { ...source[3].conditions.price, kind: 'sample', scope: 'menu-item', amount: 15000 };
  const offerings = { f: { kind: 'sample', amount: 15000, currency: 'KRW', unit: 'menu-item', label: '만둣국', taxStatus: 'not-stated', sourceUrl, verifiedAt: '2026-10-07' } };
  const settings = { ...options, catalog: source, offerings };
  assert.equal(calc(input, settings).knownSubtotal, 0); assert.deepEqual(calc(input, settings).unknownCostIds, ['f']);
  input.stops[0].useOffering = true;
  const result = calc(input, settings);
  assert.equal(result.knownSubtotal, 15000); assert.equal(result.budget.status, 'unmatched');
  assert.match(result.stops[0].cost.reason, /최소 비용.*아니/);
  offerings.f.verifiedAt = '2026-10-08'; assert.equal(calc(input, settings).stops[0].cost.amount, null);
  offerings.f.verifiedAt = '2026-10-07'; offerings.f.sourceUrl = 'javascript:alert(1)'; assert.equal(calc(input, settings).stops[0].cost.amount, null);
});

test('가격 범위 하한·누락된 메뉴는 합계에 확정 비용으로 넣지 않는다', () => {
  const source = structuredClone(catalog); source[0].conditions.price = { ...source[0].conditions.price, kind: 'minimum', min: 1000 };
  assert.equal(calc(course(), { ...options, catalog: source }).stops[0].cost.amount, null);
  const input = course(); input.stops[0] = { placeId: 'f', stayMinutes: 60, useOffering: true };
  assert.equal(calc(input).stops[0].cost.amount, null);
});

test('출처 30일 만료·미래 검증·공휴일과 날짜 미정은 운영 가능으로 확정하지 않는다', () => {
  const missing = calc({ ...course(), date: '' }); assert.equal(missing.stops[0].schedule.status, 'unknown');
  assert.equal(calc({ ...course(), date: '2026-10-09' }).stops[0].schedule.status, 'unknown');
  const stale = calc({ ...course(), date: '2026-11-07' }, { ...options, now: '2026-11-07T01:00:00.000Z' });
  assert.equal(stale.stops[0].schedule.status, 'unknown'); assert.equal(stale.stops[0].cost.amount, null);
  const source = structuredClone(catalog); source[0].conditions.hours.verifiedAt = '2026-10-08';
  assert.equal(calc(course(), { ...options, catalog: source }).stops[0].schedule.status, 'unknown');
});

test('날짜별 폐관·가격 예외는 정규 안내보다 우선하고 해당 출처로 내보낸다', () => {
  const source = structuredClone(catalog), notice = 'https://official.example/special-free';
  source[0].conditions.hours.exceptions = { '2026-10-08': { slots: [{ open: '10:00', close: '12:00', lastEntry: '11:45' }], sourceUrl: notice } };
  source[0].conditions.price.exceptions = { '2026-10-08': { kind: 'free', amount: 0, sourceUrl: notice } };
  const result = calc(course(), { ...options, catalog: source });
  assert.equal(result.stops[0].schedule.status, 'unmatched'); assert.equal(result.stops[0].schedule.sourceUrl, notice);
  assert.equal(result.stops[0].cost.amount, 0); assert.equal(result.stops[0].cost.sourceUrl, notice);
  assert.match(exportRealCourseMemo(course(), { ...options, catalog: source }), /운영 공식 출처: https:\/\/official\.example\/special-free/);
});

test('휴무 대안은 같은 분야·다른 장소이며 전체 체류가 확인된 후보만 제시한다', () => {
  const source = structuredClone(catalog); source[0].conditions.hours.weekly['4'] = [];
  const settings = { ...options, catalog: source }, input = course(), before = structuredClone(input);
  const alternatives = suggestRealCourseAlternatives(input, 0, settings);
  assert.deepEqual(alternatives.map(row => row.place.id), ['c']);
  assert.equal(alternatives[0].schedule.status, 'matched');
  assert.deepEqual(input, before);
  source[2].conditions.hours.scope = 'partial';
  assert.deepEqual(suggestRealCourseAlternatives(input, 0, settings), []);
});

test('예산 초과 대안은 알려진 비용을 낮춰야 하며 사용자 교체 전에는 원래 코스가 유지된다', () => {
  const input = { ...course(), totalBudget: 1000 }, before = structuredClone(input);
  const alternatives = suggestRealCourseAlternatives(input, 0, options);
  assert.deepEqual(alternatives.map(row => row.place.id), ['c']);
  assert.equal(alternatives[0].evaluation.budget.status, 'matched');
  assert.deepEqual(input, before);
  const applied = replaceRealCourseStop(input, 0, 'c', { catalog });
  assert.equal(applied.stops[0].placeId, 'c'); assert.deepEqual(input, before);
  assert.deepEqual(applied.transfers, [null]);
  assert.equal(calc(applied).stops[1].arrivalTime, null);
  assert.throws(() => replaceRealCourseStop(input, 0, 'f', { catalog }), error => error.field === 'stops.0.placeId');
  assert.throws(() => replaceRealCourseStop(input, 0, 'b', { catalog }), error => error.field === 'stops.0.placeId');
});

test('둘째 장소 대안은 기존 도착 시각을 가정해 보여주되 적용 때 양옆 이동 여유를 비운다', () => {
  const source = [...structuredClone(catalog), venue('d', 'culture', 0)];
  source[1].conditions.hours.weekly['4'] = [];
  const input = { ...course(), stops: [...course().stops, { placeId: 'c', stayMinutes: 45, useOffering: false }], transfers: [15, 20] };
  const settings = { ...options, catalog: source };
  const alternatives = suggestRealCourseAlternatives(input, 1, settings);
  assert.deepEqual(alternatives.map(row => row.place.id), ['d']);
  assert.equal(alternatives[0].schedule.status, 'matched');
  assert.equal(alternatives[0].evaluation.stops[1].arrivalTime, null);
  assert.equal(alternatives[0].evaluation.stops[1].schedule.status, 'unknown');
  assert.match(alternatives[0].reasons.join(' '), /기존 도착 시각.*이동 여유를 다시 입력/);
  assert.deepEqual(alternatives[0].course.transfers, [null, null]);
  assert.deepEqual(input.transfers, [15, 20]);
});

test('실제 예시는 편집값 시각과 궁 한 항목·무료 관람·오설록 미확인 비용을 그대로 드러낸다', () => {
  const input = { ...createRealCourseExample(), date: '2026-10-08', totalBudget: 20000 };
  const result = evaluateRealCourse(input, { now });
  assert.deepEqual(result.stops.map(row => [row.arrivalTime, row.departureTime]), [['11:30', '12:30'], ['12:45', '14:00'], ['14:15', '15:00']]);
  assert.deepEqual(result.stops.map(row => row.schedule.status), ['unknown', 'matched', 'matched']);
  assert.equal(result.knownSubtotal, 15000); assert.deepEqual(result.unknownCostIds, ['osulloc-bukchon']); assert.equal(result.budget.status, 'unknown');
  assert.deepEqual(Object.keys(REAL_COURSE_OFFERINGS), ['gaeseong-mandu-koong']);
  assert.equal(evaluateRealCourse({ ...input, totalBudget: 14999 }, { now }).budget.status, 'unmatched');
});

test('자정 뒤 도착 날짜가 끊긴 장소에는 출발일의 무료 관람 예외를 적용하지 않는다', () => {
  const input = createRealCourseFromSelection(['osulloc-bukchon', 'changgyeonggung']);
  Object.assign(input, { date: '2026-10-07', startTime: '23:30', totalBudget: 0, transfers: [0] });
  input.stops.forEach(stop => { stop.stayMinutes = 60; });
  const result = evaluateRealCourse(input, { now });
  assert.equal(result.stops[1].arrivalTime, null);
  assert.equal(result.stops[1].schedule.status, 'unknown');
  assert.equal(result.stops[1].cost.status, 'unknown');
  assert.equal(result.stops[1].cost.amount, null);
  assert.match(result.stops[1].cost.reason, /원래 날짜의 요금을 적용하지/);
  assert.deepEqual(result.unknownCostIds, ['osulloc-bukchon', 'changgyeonggung']);
  const memo = exportRealCourseMemo(input, { now });
  assert.match(memo, /비용 미확인: 2곳/);
  assert.doesNotMatch(memo, /매주 수요일 일반 관람.*무료/);
});

test('실제 궁궐 휴궁일 대안과 부분 관람·기간 공지를 보수적으로 적용한다', () => {
  const input = createRealCourseFromSelection(['gyeongbokgung', 'unhyeongung']);
  Object.assign(input, { date: '2026-10-13', startTime: '11:00', totalBudget: 3000, transfers: [15] });
  input.stops.forEach(stop => { stop.stayMinutes = 60; });
  const result = evaluateRealCourse(input, { now });
  assert.equal(result.stops[0].schedule.status, 'unmatched');
  const alternatives = suggestRealCourseAlternatives(input, 0, { now });
  assert.deepEqual(alternatives.map(row => row.place.id), ['changgyeonggung']);
  assert.ok(alternatives.every(row => row.evaluation.stops[0].schedule.status === 'matched'));
  const craft = { ...input, stops: [{ ...input.stops[0], placeId: 'seoul-museum-craft-art' }, input.stops[1]] };
  assert.match(evaluateRealCourse(craft, { now }).stops[0].schedule.sourceUrl, /NTT_0000000452/);
});

test('운영 대안의 표시 비용과 교체 뒤 예산 초과를 선택 전에 설명한다', () => {
  const input = createRealCourseFromSelection(['seoul-museum-craft-art', 'unhyeongung']);
  Object.assign(input, { date: '2026-10-08', startTime: '09:30', totalBudget: 0, transfers: [15] });
  input.stops.forEach(stop => { stop.stayMinutes = 60; });
  const candidate = suggestRealCourseAlternatives(input, 0, { now }).find(row => row.place.id === 'changgyeonggung');
  assert.ok(candidate);
  assert.equal(candidate.cost.amount, 1000);
  assert.equal(candidate.evaluation.budget.status, 'unmatched');
  assert.match(candidate.reasons.join(' '), /대안 장소의 표시 비용은 1,000원/);
  assert.match(candidate.reasons.join(' '), /예산 0원을 넘어요/);
});

test('일정 변경·예산·반복 계산·내보내기는 v1/v2 담기와 취향 직렬화를 바꾸지 않는다', () => {
  const legacy = readRealState(JSON.stringify({ version: 1, interests: ['culture'], selected: ['gyeongbokgung', 'unhyeongung'], consent: true }), { now });
  let state = setRealVisit(legacy, { placeId: 'gyeongbokgung', value: 'liked', reasons: ['experience'], now }); state.feedbackConsent = true;
  const before = serializeRealState(state, { now }), input = createRealCourseFromSelection(state.selected);
  input.date = '2026-10-13'; input.startTime = '11:00'; input.totalBudget = 3000; input.transfers = [15]; input.stops.forEach(row => { row.stayMinutes = 60; });
  for (let i = 0; i < 5; i++) { evaluateRealCourse(input, { now }); suggestRealCourseAlternatives(input, 0, { now, state }); exportRealCourseMemo(input, { now, state }); }
  assert.equal(serializeRealState(state, { now }), before);
  assert.deepEqual(normalizeRealState(state, { now }).selected, ['gyeongbokgung', 'unhyeongung']);
});

test('TXT는 공식 운영·가격 출처와 미정 구간을 포함하고 개인 반응은 내보내지 않는다', () => {
  const input = { ...createRealCourseExample(), date: '2026-10-08', totalBudget: 20000, transfers: [null, 15] };
  const memo = exportRealCourseMemo(input, { now, state: { visits: { secret: '좋았어요' } } });
  assert.match(memo, /종료: 미정/); assert.match(memo, /도착 미정/); assert.match(memo, /가격 공식 출처: https:\/\/www\.koong/);
  assert.match(memo, /운영 공식 출처: https:\/\/www\.koong/); assert.match(memo, /비용 미확인: 1곳/);
  assert.match(memo, /실측 이동시간 아님/); assert.match(memo, /최소 비용.*아니/); assert.doesNotMatch(memo, /secret|좋았어요|reactions|feedbackConsent/);
  const names = REAL_PLACES.filter(place => input.stops.some(stop => stop.placeId === place.id)).map(place => place.name);
  names.forEach(name => assert.ok(memo.includes(name)));
});
