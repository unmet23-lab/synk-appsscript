import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRealQuery, evaluateRealConditions, evaluateRealStay, REAL_CONDITION_MAX_BUDGET,
} from '../experiences/path-travel/real-conditions.mjs';
import { REAL_PLACES, REAL_CONDITION_CALENDAR } from '../experiences/path-travel/real-places.mjs';
import {
  normalizeRealState, rankRealPlaces, setRealReaction, setRealVisit, setRealCategoryPreference,
  serializeRealState, readRealState, exportRealMemo, formatRealQuery,
} from '../experiences/path-travel/real-guide.mjs';

const now = '2026-10-07T01:00:00.000Z';
const sourceUrl = 'https://official.example/visit';
const calendar = { from: '2026-10-07', through: '2026-11-06', holidays: ['2026-10-09'], verifiedAt: '2026-10-07', sourceUrl };
const opts = { now, calendar };
function place() {
  return { id: 'test-museum', category: 'culture', conditions: {
    hours: { verifiedAt: '2026-10-07', sourceUrl, scope: 'full', holidayPolicy: 'unknown',
      weekly: Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [String(weekday), weekday === 1 ? [] : [{ open: '10:00', close: '18:00', lastEntry: '17:30' }]])),
    },
    price: { kind: 'exact', amount: 3000, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', verifiedAt: '2026-10-07', sourceUrl },
  } };
}
const result = (query, venue = place(), settings = opts) => evaluateRealConditions(venue, query, settings);
const schedule = (query, venue = place(), settings = opts) => result(query, venue, settings).checks.schedule;
const budget = (value, venue = place(), query = {}) => result({ ...query, budget: value }, venue).checks.budget;

test('코스 체류는 입장 마감과 퇴장 시각을 구분하고 폐관 정각 종료를 허용한다', () => {
  const stay = (time, stayMinutes) => evaluateRealStay(place(), { date: '2026-10-07', time, stayMinutes }, opts);
  assert.equal(stay('17:20', 40).status, 'matched');
  assert.equal(stay('17:20', 41).status, 'unmatched');
  assert.equal(stay('17:30', 10).status, 'unmatched');
  assert.equal(stay('17:20', null).status, 'unknown');
  assert.equal(evaluateRealStay(place(), { date: '2026-10-12', stayMinutes: null }, opts).status, 'unmatched');
  assert.throws(() => stay('12:00', Infinity), error => error.field === 'stayMinutes');
});

test('체류가 점심 쉬는 시간을 건너면 저녁 재개장만으로 연속 체류를 허용하지 않는다', () => {
  const venue = place();
  venue.conditions.hours.weekly['3'] = [{ open: '11:30', close: '15:00' }, { open: '18:00', close: '21:00' }];
  assert.equal(evaluateRealStay(venue, { date: '2026-10-07', time: '14:00', stayMinutes: 60 }, opts).status, 'matched');
  assert.equal(evaluateRealStay(venue, { date: '2026-10-07', time: '14:00', stayMinutes: 300 }, opts).status, 'unmatched');
  assert.match(evaluateRealStay(venue, { date: '2026-10-07', time: '14:00', stayMinutes: 60 }, opts).reason, /주문 마감/);
});

test('체류 중 일부 공간 연장으로 넘어가면 맞음으로 확대하지 않고 해당 공지 출처를 보존한다', () => {
  const venue = REAL_PLACES.find(place => place.id === 'seoul-museum-craft-art');
  const settings = { now, calendar: REAL_CONDITION_CALENDAR };
  const base = { date: '2026-10-07', time: '17:00' };
  assert.equal(evaluateRealStay(venue, { ...base, stayMinutes: 60 }, settings).status, 'matched');
  const partial = evaluateRealStay(venue, { ...base, stayMinutes: 61 }, settings);
  assert.equal(partial.status, 'unknown');
  assert.match(partial.sourceUrl, /NTT_0000000444/);
  assert.equal(evaluateRealStay(venue, { ...base, stayMinutes: 241 }, settings).status, 'unmatched');
  assert.equal(evaluateRealStay(venue, { ...base, date: '2026-10-08', stayMinutes: 61 }, settings).status, 'unmatched');
});

test('체류 helper도 날짜별 폐관 시각·부분 휴관·만료·미래 확인일을 그대로 적용한다', () => {
  const venue = place();
  venue.conditions.hours.exceptions = { '2026-10-08': { slots: [{ open: '10:00', close: '14:00', lastEntry: '13:30' }], sourceUrl: 'https://official.example/special' } };
  const evaluated = evaluateRealStay(venue, { date: '2026-10-08', time: '13:00', stayMinutes: 61 }, opts);
  assert.equal(evaluated.status, 'unmatched');
  assert.equal(evaluated.sourceUrl, 'https://official.example/special');
  venue.conditions.hours.exceptions['2026-10-08'].scope = 'partial';
  assert.equal(evaluateRealStay(venue, { date: '2026-10-08', time: '13:00', stayMinutes: 60 }, opts).status, 'unknown');
  assert.equal(evaluateRealStay(place(), { date: '2026-11-07', time: '12:00', stayMinutes: 60 }, { ...opts, now: '2026-11-07T01:00:00.000Z' }).status, 'unknown');
  venue.conditions.hours.verifiedAt = '2026-10-08';
  assert.equal(evaluateRealStay(venue, { date: '2026-10-08', time: '13:00', stayMinutes: 60 }, opts).status, 'unknown');
});

test('날짜·시간·예산은 실제 달력과 입력 범위를 지키며 필드별 오류를 돌려준다', () => {
  assert.deepEqual(normalizeRealQuery(), { date: '', time: '', budget: null });
  assert.deepEqual(normalizeRealQuery({ date: '2028-02-29', time: '23:59', budget: 1 }), { date: '2028-02-29', time: '23:59', budget: 1 });
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', '0000-01-01', null, ' 2026-10-07']) {
    assert.throws(() => normalizeRealQuery({ date }), error => error instanceof TypeError && error.field === 'date');
  }
  for (const time of ['24:00', '12:60', '9:30', '12:00:00', null, 1200]) {
    assert.throws(() => normalizeRealQuery({ time }), error => error instanceof TypeError && error.field === 'time');
  }
  for (const value of [-1, 1.5, Infinity, NaN, '3000', REAL_CONDITION_MAX_BUDGET + 1]) {
    assert.throws(() => normalizeRealQuery({ budget: value }), error => error instanceof TypeError && error.field === 'budget');
  }
  assert.equal(normalizeRealQuery({ budget: 0 }).budget, 0);
  assert.equal(normalizeRealQuery({ budget: REAL_CONDITION_MAX_BUDGET }).budget, REAL_CONDITION_MAX_BUDGET);
  assert.throws(() => normalizeRealQuery({ extra: true }), TypeError);
  assert.throws(() => normalizeRealQuery(JSON.parse('{"__proto__":{}}')), TypeError);
});

test('음수 0 예산은 정상 0으로 바꿔 요약과 TXT에 마이너스가 나타나지 않는다', () => {
  const query = normalizeRealQuery({ budget: -0 });
  assert.equal(query.budget, 0);
  assert.equal(Object.is(query.budget, -0), false);
  assert.match(formatRealQuery({ budget: -0 }), /한 곳 성인 1인 0원/);
  assert.doesNotMatch(formatRealQuery({ budget: -0 }), /-0원/);
  const memo = exportRealMemo(normalizeRealState({}, { now }), { now, query: { budget: -0 } });
  assert.match(memo, /한 곳 성인 1인 0원/);
  assert.doesNotMatch(memo, /-0원/);
});

test('조건이 없으면 자료의 부재를 추정하지 않고 none이며 입력을 바꾸지 않는다', () => {
  const venue = place(), query = { date: '', time: '', budget: null };
  const before = structuredClone({ venue, query });
  assert.equal(result(query, venue).status, 'none');
  assert.equal(result(query, null).status, 'none');
  assert.deepEqual(result(query, venue).reasons, []);
  assert.deepEqual({ venue, query }, before);
});

test('날짜만 고르면 운영일만 비교하고 시간만 고르면 날짜 미정으로 확인 필요다', () => {
  assert.equal(schedule({ date: '2026-10-07' }).status, 'matched');
  assert.equal(schedule({ date: '2026-10-12' }).status, 'unmatched');
  assert.equal(schedule({ time: '12:00' }).status, 'unknown');
  assert.match(schedule({ time: '12:00' }).reason, /날짜/);
  assert.equal(result({ time: '12:00', budget: 3000 }).status, 'unknown');
});

test('한국 날짜와 요일을 쓰고 지나간 방문일을 현재 운영 가능으로 확정하지 않는다', () => {
  const utcBeforeMidnight = { now: '2026-10-06T15:30:00.000Z', calendar };
  assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, place(), utcBeforeMidnight).status, 'matched');
  const past = result({ date: '2026-10-06', budget: 3000 }, place(), utcBeforeMidnight);
  assert.equal(past.status, 'unknown');
  assert.equal(past.checks.budget.status, 'unknown');
  assert.match(past.checks.schedule.reason, /지난 날짜/);
});

test('운영 시작은 포함하고 입장 마감·종료·쉬는 시간은 맞음으로 표시하지 않는다', () => {
  for (const [time, status] of [['09:59', 'unmatched'], ['10:00', 'matched'], ['17:29', 'matched'], ['17:30', 'unmatched'], ['18:00', 'unmatched']]) {
    assert.equal(schedule({ date: '2026-10-07', time }).status, status, time);
  }
  const food = place();
  food.conditions.hours.weekly['3'] = [{ open: '11:30', close: '15:00' }, { open: '18:00', close: '21:00', lastEntry: '19:40' }];
  assert.equal(schedule({ date: '2026-10-07', time: '15:00' }, food).status, 'unmatched');
  assert.equal(schedule({ date: '2026-10-07', time: '18:00' }, food).status, 'matched');
  assert.equal(schedule({ date: '2026-10-07', time: '19:40' }, food).status, 'unmatched');
});

test('공휴일 예외가 불명확하면 unknown이고 같은 운영·공휴일 휴무만 명시적으로 비교한다', () => {
  const query = { date: '2026-10-09', time: '12:00' };
  const venue = place();
  assert.equal(schedule(query, venue).status, 'unknown');
  venue.conditions.hours.holidayPolicy = 'same';
  assert.equal(schedule(query, venue).status, 'matched');
  venue.conditions.hours.holidayPolicy = 'closed';
  assert.equal(schedule(query, venue).status, 'unmatched');
  venue.conditions.hours.scope = 'partial';
  assert.equal(schedule(query, venue).status, 'unknown', '일부 공간 휴무를 전체 휴무로 확대하지 않는다');
});

test('부분 관람 안내가 있는 장소라도 명시된 정기 전면 휴무를 가리지 않고 공휴일·부분연장 예외는 보존한다', () => {
  const venue = place(); venue.conditions.hours.scope = 'partial';
  assert.equal(schedule({ date: '2026-10-12', time: '12:00' }, venue).status, 'unmatched');
  const holidayMonday = { ...calendar, holidays: [...calendar.holidays, '2026-10-12'] };
  assert.equal(schedule({ date: '2026-10-12', time: '12:00' }, venue, { now, calendar: holidayMonday }).status, 'unknown');
  venue.conditions.hours.partialExtensions = [{ from: '2026-10-12', through: '2026-10-12', weekdays: [1], slots: [{ open: '12:00', close: '14:00' }] }];
  assert.equal(schedule({ date: '2026-10-12', time: '12:30' }, venue).status, 'unknown');
  assert.equal(schedule({ date: '2026-10-12' }, venue).status, 'unknown');
  assert.equal(schedule({ date: '2026-10-12', time: '15:00' }, venue).status, 'unmatched');
});

test('부분 관람 안내라도 안내된 운영시간 밖의 방문은 닫힌 것으로 보고 안에서만 확인 필요로 둔다', () => {
  const venue = place(); venue.conditions.hours.scope = 'partial'; venue.conditions.hours.note = '일부 전시실 휴관';
  const stay = (time, stayMinutes) => evaluateRealStay(venue, { date: '2026-10-07', time, stayMinutes }, opts);
  assert.equal(stay('12:00', 60).status, 'unknown');
  assert.match(stay('12:00', 60).reason, /일부 전시실/);
  assert.equal(stay('17:45', 30).status, 'unmatched', '입장 마감 뒤');
  assert.equal(stay('17:00', 90).status, 'unmatched', '폐관 뒤까지 머묾');
  assert.equal(stay('09:00', 30).status, 'unmatched', '개관 전');
  assert.equal(schedule({ date: '2026-10-07' }, venue).status, 'unknown');
  // 날짜별 부분 안내가 그날의 운영시간을 적으면 그 시간도 지킨다.
  venue.conditions.hours.exceptions = { '2026-10-08': { slots: [{ open: '10:00', close: '14:00' }], scope: 'partial', note: '동절기 단축' } };
  assert.equal(evaluateRealStay(venue, { date: '2026-10-08', time: '15:00', stayMinutes: 30 }, opts).status, 'unmatched');
  assert.match(evaluateRealStay(venue, { date: '2026-10-08', time: '12:00', stayMinutes: 30 }, opts).reason, /동절기/);
  // 실제 자료: 경복궁(월요일 09–18시, 입장 17시까지)의 저녁 방문은 넣지 않는다.
  const palace = REAL_PLACES.find(row => row.id === 'gyeongbokgung'), real = { now: '2026-10-19T03:00:00.000Z', calendar: REAL_CONDITION_CALENDAR };
  assert.equal(evaluateRealStay(palace, { date: '2026-10-19', time: '17:19', stayMinutes: 90 }, real).status, 'unmatched');
  assert.equal(evaluateRealStay(palace, { date: '2026-10-19', time: '15:00', stayMinutes: 90 }, real).status, 'unknown');
});

test('공식 날짜별 운영 예외는 일반 요일·공휴일보다 우선하고 자체로 확인된 날짜는 달력 누락에 영향받지 않는다', () => {
  const venue = place();
  venue.conditions.hours.exceptions = {
    '2026-10-12': { slots: [{ open: '10:00', close: '18:00' }], scope: 'full' },
    '2026-10-07': { closed: true },
  };
  assert.equal(schedule({ date: '2026-10-12', time: '12:00' }, venue, { now }).status, 'matched');
  assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, venue).status, 'unmatched');
  venue.conditions.hours.scope = 'partial';
  assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, venue).status, 'unmatched', '명시한 전체 휴관 예외는 평소의 부분 관람 안내보다 우선한다');
  venue.conditions.hours.exceptions['2026-10-07'].scope = 'partial';
  assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, venue).status, 'unknown', '일부 공간만 휴관하는 예외는 전체 휴관으로 확대하지 않는다');
  venue.conditions.hours.exceptions['2026-10-12'].scope = 'partial';
  assert.equal(schedule({ date: '2026-10-12', time: '12:00' }, venue).status, 'unknown');
  venue.conditions.hours.exceptions['2026-10-12'].note = '상설 전시실 일부 휴관 안내';
  assert.match(schedule({ date: '2026-10-12', time: '12:00' }, venue).reason, /상설 전시실/);
});

test('운영 예외와 부분 연장 판정은 그 공지의 HTTPS 출처를 유지하고 잘못된 출처는 확인 필요로 남긴다', () => {
  const venue = place(), exceptionUrl = 'https://official.example/temporary-closure';
  venue.conditions.hours.exceptions = { '2026-10-07': { closed: true, sourceUrl: exceptionUrl } };
  assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, venue).sourceUrl, exceptionUrl);
  for (const badUrl of ['http://official.example/notice', 'javascript:alert(1)', 'https://user:secret@official.example/notice', null]) {
    venue.conditions.hours.exceptions['2026-10-07'].sourceUrl = badUrl;
    assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, venue).status, 'unknown');
  }
  delete venue.conditions.hours.exceptions;
  const extensionUrl = 'https://official.example/evening-extension';
  venue.conditions.hours.partialExtensions = [{ from: '2026-10-07', through: '2026-10-07', weekdays: [3], slots: [{ open: '17:30', close: '21:00' }], sourceUrl: extensionUrl }];
  assert.equal(schedule({ date: '2026-10-07', time: '17:29' }, venue).sourceUrl, sourceUrl);
  assert.equal(schedule({ date: '2026-10-07', time: '17:45' }, venue).status, 'unknown');
  assert.equal(schedule({ date: '2026-10-07', time: '17:45' }, venue).sourceUrl, extensionUrl);
  venue.conditions.hours.partialExtensions[0].sourceUrl = 'javascript:alert(1)';
  assert.equal(schedule({ date: '2026-10-07', time: '17:45' }, venue).status, 'unknown');
  assert.equal(schedule({ date: '2026-10-07', time: '17:45' }, venue).sourceUrl, undefined);
});

test('공휴일 달력의 미확인·범위 밖·잘못된 자료는 영업 확정에 쓰지 않는다', () => {
  const query = { date: '2026-10-07', time: '12:00' };
  for (const bad of [undefined, { ...calendar, through: '2026-10-06' }, { ...calendar, holidays: ['2026-02-30'] }, { ...calendar, verifiedAt: '2026-10-08' }, { ...calendar, sourceUrl: 'http://official.example' }]) {
    assert.equal(schedule(query, place(), { now, calendar: bad }).status, 'unknown');
  }
});

test('확인한 지 30일과 방문일 30일 경계를 지키고 날짜 없는 가격도 오래되면 확인 필요다', () => {
  const venue = place();
  const onLimit = { now: '2026-11-06T01:00:00.000Z', calendar };
  assert.equal(result({ date: '2026-11-06', budget: 3000 }, venue, onLimit).status, 'matched');
  assert.equal(result({ budget: 3000 }, venue, { now: '2026-11-07T01:00:00.000Z', calendar }).status, 'unknown');
  assert.equal(result({ date: '2026-11-07', budget: 3000 }, venue).status, 'unknown');
  venue.conditions.price.verifiedAt = '2026-10-08';
  assert.equal(budget(3000, venue).status, 'unknown');
  assert.throws(() => result({}, venue, { now: '2026-02-30T00:00:00.000Z', calendar }), TypeError);
});

test('계절 운영의 적용 기간 밖은 확인 필요이고 부분 야간 운영을 전체 운영으로 바꾸지 않는다', () => {
  const venue = place();
  venue.conditions.hours.validFrom = '2026-10-01';
  venue.conditions.hours.validThrough = '2026-10-31';
  venue.conditions.hours.partialExtensions = [{ from: '2026-10-01', through: '2026-10-31', weekdays: [3], slots: [{ open: '18:00', close: '21:00', lastEntry: '20:30' }], note: '일부 전시실' }];
  assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, venue).status, 'matched');
  assert.equal(schedule({ date: '2026-10-07', time: '20:00' }, venue).status, 'unknown');
  assert.match(schedule({ date: '2026-10-07', time: '20:00' }, venue).reason, /일부 공간/);
  assert.equal(schedule({ date: '2026-10-07', time: '20:30' }, venue).status, 'unmatched');
  assert.equal(schedule({ date: '2026-11-01', time: '12:00' }, venue).status, 'unknown');
  venue.conditions.hours.weekly['3'] = [];
  assert.equal(schedule({ date: '2026-10-07' }, venue).status, 'unknown', '일부 공간만 여는 날을 전체 운영일로 표시하지 않는다');
});

test('누락된 요일·자정 넘김·잘못된 마감·겹친 시간 등 불충분한 운영 자료는 unknown이다', () => {
  for (const slots of [undefined, [{ open: '22:00', close: '02:00' }], [{ open: '10:00', close: '18:00', lastEntry: '09:00' }], [{ open: '10:00', close: '18:00' }, { open: '17:00', close: '20:00' }]]) {
    const venue = place(); venue.conditions.hours.weekly['3'] = slots;
    assert.equal(schedule({ date: '2026-10-07', time: '12:00' }, venue).status, 'unknown');
  }
  const allDay = place(); allDay.conditions.hours.weekly['3'] = [{ open: '00:00', close: '24:00' }];
  assert.equal(schedule({ date: '2026-10-07', time: '23:59' }, allDay).status, 'matched');
  const conflicting = place(); conflicting.conditions.hours.scope = 'partial'; conflicting.conditions.hours.note = '공식 자료의 요일별 마감시간이 상충해 확인 필요';
  assert.match(schedule({ date: '2026-10-07', time: '12:00' }, conflicting).reason, /상충/);
  assert.doesNotMatch(schedule({ date: '2026-10-07', time: '12:00' }, conflicting).reason, /일부 공간/);
});

test('확정 일반 성인 요금과 무료 관람은 예산에 정확히 비교하며 미확인 가격을 0원으로 만들지 않는다', () => {
  assert.equal(budget(2999).status, 'unmatched');
  assert.equal(budget(3000).status, 'matched');
  const free = place(); free.conditions.price.kind = 'free'; free.conditions.price.amount = 0;
  assert.equal(budget(0, free).status, 'matched');
  assert.equal(budget(0, { category: 'culture' }).status, 'unknown');
  free.conditions.price.kind = 'unknown';
  assert.equal(budget(1000000, free).status, 'unknown');
  const nonfinite = place(); nonfinite.conditions.price.amount = Infinity;
  assert.equal(budget(1000000, nonfinite).status, 'unknown');
});

test('예시 상품은 표시가격 이상일 때 그 상품 기준으로만 맞으며 더 싼 예산은 탈락하지 않는다', () => {
  const cafe = place(); cafe.category = 'tea';
  cafe.conditions.price = { ...cafe.conditions.price, kind: 'sample', amount: 39000, label: '티코스 예시', scope: 'menu-item', taxStatus: 'not-stated' };
  assert.equal(budget(39000, cafe).status, 'matched');
  assert.match(budget(39000, cafe).reason, /해당 예시 상품 표시금액 기준/);
  assert.match(budget(39000, cafe).reason, /추가비/);
  assert.equal(budget(5000, cafe).status, 'unknown');
  assert.match(budget(5000, cafe).reason, /다른 저가 메뉴/);
  cafe.conditions.price.kind = 'exact';
  assert.equal(budget(5000, cafe).status, 'unknown', '단일 메뉴를 전체 장소의 최저가격으로 쓰지 않는다');
});

test('가격 하한·범위의 시작값은 실제 고를 상품 가격으로 단정하지 않는다', () => {
  for (const kind of ['minimum', 'range']) {
    const venue = place(); venue.conditions.price = { ...venue.conditions.price, kind, min: 5000, max: 8000 };
    assert.equal(budget(4999, venue).status, 'unmatched');
    assert.equal(budget(5000, venue).status, 'unknown');
    assert.equal(budget(10000, venue).status, 'unknown');
  }
  const malformed = place(); malformed.conditions.price = { ...malformed.conditions.price, kind: 'range', min: 5000, max: 4000 };
  assert.equal(budget(4999, malformed).status, 'unknown');
});

test('숙박 요금은 확인된 금액처럼 보여도 1인 음식·관람 예산 비교에서 제외한다', () => {
  const hotel = place(); hotel.category = 'stay'; hotel.conditions.price.amount = 100;
  assert.equal(budget(1000000, hotel).status, 'unknown');
  hotel.category = 'culture'; hotel.conditions.price.scope = 'room';
  assert.equal(budget(1000000, hotel).status, 'unknown');
});

test('공식 날짜별 무료 예외는 해당 날짜에만 적용하고 날짜 미선택 때 일반요금으로 탈락시키지 않는다', () => {
  const venue = place();
  venue.conditions.price.exceptions = { '2026-10-28': { kind: 'free', amount: 0, label: '해당 날짜 일반 관람' } };
  assert.equal(budget(0, venue).status, 'unknown');
  assert.equal(budget(0, venue, { date: '2026-10-28' }).status, 'matched');
  assert.equal(budget(0, venue, { date: '2026-10-27' }).status, 'unmatched');
  venue.conditions.price.exceptions['2026-10-29'] = { kind: 'unknown' };
  assert.equal(budget(5000, venue, { date: '2026-10-29' }).status, 'unknown');
});

test('조건 결합은 확정 불일치를 우선하며 미확인 영업과 맞는 예산을 합쳐 맞음으로 바꾸지 않는다', () => {
  const closed = result({ date: '2026-10-12', time: '12:00', budget: 5000 });
  assert.equal(closed.status, 'unmatched');
  assert.equal(closed.label, '조건과 다름');
  const holiday = result({ date: '2026-10-09', time: '12:00', budget: 5000 });
  assert.equal(holiday.status, 'unknown');
  assert.equal(holiday.label, '확인 필요');
  assert.equal(result({ date: '2026-10-09', budget: 0 }).status, 'unmatched');
  const matched = result({ date: '2026-10-07', time: '12:00', budget: 3000 });
  assert.equal(matched.status, 'matched');
  assert.equal(matched.label, '안내상 조건 맞음');
  assert.equal(matched.reasons.length, 2);
});

const realQuery = { date: '2026-10-08', time: '12:00', budget: 1000 };
const realOptions = { now, query: realQuery };
const realCondition = place => evaluateRealConditions(place, realQuery, { now, calendar: REAL_CONDITION_CALENDAR });

test('실제 카탈로그: 경복궁의 11월 3일 전체 휴궁 예외를 10월 부분 관람이나 예산 충족으로 덮지 않는다', () => {
  const palace = REAL_PLACES.find(place => place.id === 'gyeongbokgung');
  assert.ok(palace);
  const checked = evaluateRealConditions(palace, { date: '2026-11-03', time: '12:00', budget: 3000 }, { now, calendar: REAL_CONDITION_CALENDAR });
  assert.equal(checked.checks.schedule.status, 'unmatched');
  assert.equal(checked.checks.budget.status, 'matched');
  assert.equal(checked.status, 'unmatched');
  assert.match(checked.checks.schedule.reason, /휴관·휴무/);
});

test('실제 카탈로그: 경복궁 10월의 세 화요일 정기 휴궁은 부분 관람 안내보다 우선한다', () => {
  const palace = REAL_PLACES.find(place => place.id === 'gyeongbokgung');
  for (const date of ['2026-10-13', '2026-10-20', '2026-10-27']) {
    const checked = evaluateRealConditions(palace, { date, time: '12:00', budget: 3000 }, { now, calendar: REAL_CONDITION_CALENDAR });
    assert.equal(checked.checks.schedule.status, 'unmatched', date);
    assert.equal(checked.status, 'unmatched', date);
    assert.match(checked.checks.schedule.reason, /휴관·휴무/);
  }
});

test('실제 카탈로그: 강한 관심·방문 긍정도 확정 조건 불일치를 맞는 후보보다 먼저 올리지 않는다', () => {
  const mismatch = REAL_PLACES.find(place => realCondition(place).status === 'unmatched');
  const match = REAL_PLACES.find(place => realCondition(place).status === 'matched');
  assert.ok(mismatch && match, '실제 자료에 같은 조건의 일치·불일치 대안이 모두 있어야 한다');
  let state = normalizeRealState({}, { now });
  state = setRealReaction(state, { placeId: mismatch.id, value: 'interested', now });
  state = setRealVisit(state, { placeId: mismatch.id, value: 'liked', reasons: ['experience'], now });
  state = setRealCategoryPreference(state, { category: mismatch.category, value: 'more', now });
  assert.equal(rankRealPlaces(state, { now })[0].place.id, mismatch.id, '조건 없는 개인화에서는 강한 명시 반응이 먼저다');
  const ranked = rankRealPlaces(state, realOptions);
  const chosenIndex = ranked.findIndex(row => row.place.id === mismatch.id);
  assert.ok(ranked.filter(row => row.condition.status === 'matched').every(row => ranked.indexOf(row) < chosenIndex));
  assert.equal(ranked[chosenIndex].condition.status, 'unmatched');
  assert.equal(ranked.length, REAL_PLACES.length, '확정 불일치도 사용자가 볼 수 있게 남긴다');
});

test('실제 카탈로그: 기본 순서는 같은 조건 그룹 안에서만 후보 원순서로 복원하고 개인 기록은 보존한다', () => {
  const target = REAL_PLACES.at(-1);
  let state = setRealReaction(normalizeRealState({}, { now }), { placeId: target.id, value: 'interested', now });
  state = setRealVisit(state, { placeId: target.id, value: 'liked', reasons: ['atmosphere'], now });
  const before = structuredClone(state);
  const personal = rankRealPlaces(state, realOptions), original = rankRealPlaces(state, { ...realOptions, order: 'original' });
  assert.deepEqual(state, before);
  assert.deepEqual(new Set(original.map(row => row.place.id)), new Set(personal.map(row => row.place.id)));
  const priority = { matched: 0, unknown: 1, unmatched: 2 };
  assert.deepEqual(original.map(row => row.place.id), REAL_PLACES.map((place, index) => ({ place, index, status: realCondition(place).status }))
    .sort((a, b) => priority[a.status] - priority[b.status] || a.index - b.index).map(row => row.place.id));
  assert.deepEqual(rankRealPlaces(state, { now, order: 'original' }).map(row => row.place.id), REAL_PLACES.map(place => place.id));
});

test('실제 카탈로그: 이번 조건의 반복 적용·해제는 v1 이전 선택과 v2 방문·취향 저장을 바꾸지 않는다', () => {
  const first = REAL_PLACES[0], last = REAL_PLACES.at(-1);
  const legacy = readRealState(JSON.stringify({ version: 1, consent: true, interests: [], selected: [last.id, first.id] }), { now });
  let saved = { ...legacy, feedbackConsent: true };
  saved = setRealReaction(saved, { placeId: first.id, value: 'less', now });
  saved = setRealVisit(saved, { placeId: last.id, value: 'liked', reasons: ['access'], now });
  saved = setRealCategoryPreference(saved, { category: last.category, value: 'more', now });
  for (const state of [legacy, saved]) {
    const before = structuredClone(state), raw = serializeRealState(state, { now }), initial = rankRealPlaces(state, { now });
    for (const query of [realQuery, { budget: 0 }, { time: '20:00' }, { date: '2026-10-09' }, {}, realQuery, {}]) rankRealPlaces(state, { now, query });
    assert.deepEqual(state, before);
    assert.equal(serializeRealState(state, { now }), raw);
    assert.deepEqual(rankRealPlaces(state, { now }), initial);
    const restored = readRealState(raw, { now });
    assert.deepEqual(restored, before);
    assert.equal(Object.hasOwn(restored, 'query'), false);
    assert.equal(Object.hasOwn(restored, 'budget'), false);
  }
});

test('실제 카탈로그: TXT에는 이번 조건과 안내 평가·공식 출처를 넣고 개인 반응·이유는 넣지 않는다', () => {
  const chosen = ['matched', 'unknown', 'unmatched'].map(status => REAL_PLACES.find(place => realCondition(place).status === status));
  assert.ok(chosen.every(Boolean), '세 조건 그룹을 모두 실제 장소로 검사한다');
  let state = { ...normalizeRealState({}, { now }), selected: chosen.map(place => place.id) };
  state = setRealReaction(state, { placeId: chosen[0].id, value: 'interested', now });
  state = setRealVisit(state, { placeId: chosen[0].id, value: 'liked', reasons: ['atmosphere'], now });
  const memo = exportRealMemo(state, realOptions);
  assert.ok(memo.includes(`이번에 비교한 조건: ${formatRealQuery(realQuery)}`));
  assert.match(memo, /12:00 도착 \(서울 시간\).*한 곳 성인 1인 1,000원/);
  assert.deepEqual(memo.split('\n').filter(line => /^\d+\. /.test(line)), chosen.map((place, index) => `${index + 1}. ${place.name}`));
  for (const place of chosen) {
    const checked = realCondition(place);
    assert.ok(memo.includes(`조건 비교: ${checked.label}`));
    assert.ok(checked.reasons.every(reason => memo.includes(reason)));
    assert.ok(memo.includes(place.sourceUrl));
    if (place.conditions?.price?.sourceUrl) assert.ok(memo.includes(`가격 공식 출처: ${place.conditions.price.sourceUrl}`));
    const visitUrl = checked.checks.schedule.sourceUrl ?? place.visitSourceUrl;
    if (visitUrl) assert.ok(memo.includes(`운영·방문 공식 출처: ${visitUrl}`));
  }
  assert.doesNotMatch(memo, /관심 있어요|좋았어요|방문 후 ‘|reactions|feedbackConsent/);
  assert.doesNotMatch(exportRealMemo(state, { now }), /이번에 비교한 조건:|조건 비교:/);
});

test('실제 카탈로그: 10월 30일 궁궐 무료 입장 TXT는 일반 요금표 대신 해당 날짜의 무료 공지를 가격 근거로 연결한다', () => {
  const palaces = ['gyeongbokgung', 'changgyeonggung'].map(id => REAL_PLACES.find(place => place.id === id));
  assert.ok(palaces.every(Boolean));
  const query = { date: '2026-10-30', time: '12:00', budget: 0 };
  const state = { ...normalizeRealState({}, { now }), selected: palaces.map(place => place.id) };
  const memo = exportRealMemo(state, { now, query });
  const sourceLines = memo.split('\n').filter(line => line.startsWith('가격 공식 출처: '));
  assert.deepEqual(sourceLines, palaces.map(place => `가격 공식 출처: ${place.conditions.price.exceptions[query.date].sourceUrl}`));
  for (const place of palaces) {
    const exceptionUrl = place.conditions.price.exceptions[query.date].sourceUrl;
    assert.notEqual(exceptionUrl, place.conditions.price.sourceUrl);
    const checked = evaluateRealConditions(place, query, { now, calendar: REAL_CONDITION_CALENDAR });
    assert.equal(checked.checks.budget.status, 'matched');
    assert.equal(checked.checks.budget.sourceUrl, exceptionUrl);
  }
});

test('실제 카탈로그: 공예박물관 주간 마감·부분 야간 경계와 임시 휴관 출처를 정확히 연결한다', () => {
  const museum = REAL_PLACES.find(place => place.id === 'seoul-museum-craft-art');
  const evaluate = query => evaluateRealConditions(museum, query, { now, calendar: REAL_CONDITION_CALENDAR });
  for (const [time, expected] of [['17:29', 'matched'], ['17:30', 'unknown'], ['17:45', 'unknown'], ['21:00', 'unmatched']]) {
    const checked = evaluate({ date: '2026-10-07', time });
    assert.equal(checked.checks.schedule.status, expected, time);
    if (expected === 'unknown') assert.match(checked.checks.schedule.sourceUrl, /NTT_0000000444/);
  }
  assert.equal(evaluate({ date: '2026-10-08', time: '17:30' }).checks.schedule.status, 'unmatched', '목요일에는 별도 야간 운영으로 보완하지 않는다');
  const query = { date: '2026-10-13', time: '12:00' };
  const exceptionUrl = museum.conditions.hours.exceptions[query.date].sourceUrl;
  assert.match(exceptionUrl, /NTT_0000000452/);
  assert.equal(evaluate(query).checks.schedule.status, 'unknown');
  assert.equal(evaluate(query).checks.schedule.sourceUrl, exceptionUrl);
  const memo = exportRealMemo({ ...normalizeRealState({}, { now }), selected: [museum.id] }, { now, query });
  assert.ok(memo.includes(`운영·방문 공식 출처: ${exceptionUrl}`));
  assert.doesNotMatch(memo.split('\n').find(line => line.startsWith('운영·방문 공식 출처: ')), /\/preview\/visit$/);
  assert.equal(evaluate({ date: '2026-10-19', time: '12:00' }).checks.schedule.status, 'unmatched', '임시 부분 휴관 기간의 월요일은 전체 정기 휴관을 유지한다');
});
