// 지금 싣는 서울 하루 장소 자료를 자료 자신의 확인일 기준으로 검사한다.
// 엔진 규칙 시험은 10월 표본(tests/fixtures/path-travel-catalog-20261009)으로 돌고,
// 이 파일은 날짜를 박지 않아 30일마다 자료를 다시 확인해도 그대로 돈다.
// 확인일에서 30일이 지나 「확인 필요」로 떨어지는 만료(2026-11-08 공개 앱)를 막는 관문이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRAVEL_PLACES, SOURCES, PHOTO_CREDITS, TRAVEL_META, findPlace } from '../experiences/path-travel/places-v2.mjs';
import { REAL_PLACES, REAL_META, REAL_CONDITION_CALENDAR } from '../experiences/path-travel/real-places.mjs';
import { REAL_COURSE_META, REAL_COURSE_RECHECKS, REAL_COURSE_PERIODS } from '../experiences/path-travel/real-course-data.mjs';
import { evaluateRealConditions, REAL_CONDITION_MAX_AGE_DAYS } from '../experiences/path-travel/real-conditions.mjs';
import { planTravel } from '../experiences/path-travel/planner.mjs';

const DAY = 86400000;
const checkedAt = TRAVEL_META.checkedAt;
const shift = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
const lastFresh = shift(checkedAt, REAL_CONDITION_MAX_AGE_DAYS);
const now = checkedAt + 'T01:00:00.000Z';
const holidays = new Set(REAL_CONDITION_CALENDAR.holidays);
const nextDay = (want, from = shift(checkedAt, 1)) => {
  for (let date = from; date <= lastFresh; date = shift(date, 1)) if (want(date)) return date;
  return null;
};
const base = {
  startTime: '10:00', endTime: '18:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 3,
  preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [],
};
const dates = place => [
  place.checkedAt, place.verifiedAt, place.conditions.hours.verifiedAt, place.conditions.price.verifiedAt,
  place.conditions.childPrice?.verifiedAt, place.visitInfo?.verifiedAt, ...(place.menuItems ?? []).map(item => item.verifiedAt),
  ...Object.values(place.provenance?.featuresByKey ?? {}).map(row => row.verifiedAt),
].filter(Boolean);

test('지금 자료는 확인일이 하나로 맞고 확인일부터 30일 동안 공휴일 달력이 이어진다', () => {
  assert.equal(REAL_META.checkedAt, checkedAt);
  assert.equal(REAL_COURSE_META.verifiedAt, checkedAt);
  for (const place of TRAVEL_PLACES) for (const date of dates(place)) assert.equal(date, checkedAt, place.id);
  for (const source of SOURCES) assert.equal(source.checkedAt, checkedAt, source.id);
  const calendar = REAL_CONDITION_CALENDAR;
  assert.equal(calendar.verifiedAt, checkedAt);
  assert.ok(calendar.from <= checkedAt, '달력은 확인일부터 시작한다');
  assert.ok(calendar.through >= lastFresh, `달력은 확인일+30일(${lastFresh})까지 이어져야 한다`);
  for (const date of calendar.holidays) assert.ok(date >= calendar.from && date <= calendar.through, date);
  for (const row of REAL_COURSE_RECHECKS) {
    assert.equal(row.verifiedAt, checkedAt, row.placeId);
    assert.ok(row.reviewBy >= checkedAt && row.reviewBy <= lastFresh, row.placeId);
  }
  for (const row of REAL_COURSE_PERIODS) assert.equal(row.verifiedAt, checkedAt, row.id);
});

test('운영기간을 정한 장소는 확인일에 이미 끝난 기간을 싣지 않는다', () => {
  for (const place of REAL_PLACES.concat(TRAVEL_PLACES)) {
    const hours = place.conditions.hours;
    if (hours.validThrough) assert.ok(hours.validThrough > checkedAt, `${place.id} validThrough ${hours.validThrough}`);
    if (hours.validFrom) assert.ok(hours.validFrom <= shift(checkedAt, 1), `${place.id} validFrom ${hours.validFrom}`);
    for (const date of Object.keys(hours.exceptions ?? {})) assert.ok(date >= checkedAt, `${place.id} 지난 예외 ${date}`);
    for (const row of hours.partialExtensions ?? []) assert.ok(row.through >= checkedAt, `${place.id} 지난 연장 ${row.through}`);
  }
  for (const row of REAL_COURSE_PERIODS) if (row.through) assert.ok(row.through >= checkedAt, `코스 기간표에 지난 기간 ${row.id} ${row.through}`);
});

test('확인일 다음 평일 하루는 고른 장소가 모두 공식 안내상 운영 시간 안이다', () => {
  const date = nextDay(day => ![0, 1, 6].includes(weekday(day)) && !holidays.has(day));
  assert.ok(date);
  for (const stopCount of [2, 3, 4]) {
    const result = planTravel({ ...base, date, stopCount }, { now, ask: false });
    assert.ok(result.primary, `${date} ${stopCount}곳`);
    for (const stop of result.primary.stops) assert.equal(stop.schedule.status, 'matched', `${date} ${stop.placeId}`);
  }
});

test('월요일에는 월요일 휴관 장소가 닫힘으로 판정되고 하루 일정에 들어가지 않는다', () => {
  const monday = nextDay(day => weekday(day) === 1 && !holidays.has(day));
  assert.ok(monday);
  const closed = TRAVEL_PLACES.filter(place => place.dayPlannerEligible && Array.isArray(place.conditions.hours.weekly?.['1'])
    && !place.conditions.hours.weekly['1'].length && !place.conditions.hours.exceptions?.[monday]
    && !(place.conditions.hours.partialExtensions ?? []).some(row => row.from <= monday && row.through >= monday && row.weekdays.includes(1)));
  assert.ok(closed.some(place => place.id === 'unhyeongung'), '운현궁은 월요일 정기 휴관이다');
  for (const place of closed) {
    const checked = evaluateRealConditions(place, { date: monday, time: '12:00' }, { now, calendar: REAL_CONDITION_CALENDAR });
    assert.equal(checked.checks.schedule.status, 'unmatched', `${monday} ${place.id}`);
  }
  for (const stopCount of [3, 4, 5]) {
    const result = planTravel({ ...base, date: monday, stopCount }, { now, ask: false });
    for (const plan of [result.primary, ...result.alternatives].filter(Boolean)) {
      for (const stop of plan.stops) assert.ok(!closed.some(place => place.id === stop.placeId), `${monday} ${stop.placeId}`);
    }
  }
  const locked = planTravel({ ...base, date: monday, lockedIds: ['unhyeongung'] }, { now, ask: false });
  assert.equal(locked.primary, null, '월요일에 운현궁을 꼭 넣으면 일정을 만들지 않는다');
});

test('확인일+30일이 지난 날짜는 다시 「확인 필요」로 떨어진다', () => {
  const late = shift(lastFresh, 1);
  const place = findPlace('unhyeongung');
  assert.equal(evaluateRealConditions(place, { date: late, time: '12:00' }, { now, calendar: REAL_CONDITION_CALENDAR }).checks.schedule.status, 'unknown');
  const afterNow = shift(lastFresh, 1) + 'T01:00:00.000Z';
  const result = planTravel({ ...base, date: shift(lastFresh, 2) }, { now: afterNow, ask: false });
  for (const stop of result.primary?.stops ?? []) assert.notEqual(stop.schedule.status, 'matched', stop.placeId);
});

test('출처 기록과 사진 대장은 이번 확인일의 재확인 대장과 같다', async () => {
  const folder = 'recheck-' + checkedAt.replaceAll('-', '');
  const ledger = JSON.parse(await readFile(new URL(`../experiences/path-travel/qa/${folder}/sources.json`, import.meta.url), 'utf8'));
  assert.equal(ledger.checkedAt, checkedAt);
  assert.deepEqual(ledger.records, SOURCES);
  assert.deepEqual(ledger.photos, PHOTO_CREDITS);
  assert.deepEqual(ledger.calendar, REAL_CONDITION_CALENDAR);
  assert.deepEqual(ledger.places.map(row => row.id), TRAVEL_PLACES.map(place => place.id));
  for (const source of SOURCES) {
    assert.equal(new URL(source.url).protocol, 'https:', source.id);
    if (source.coordinateSourceUrl) assert.equal(new URL(source.coordinateSourceUrl).protocol, 'https:', source.id);
  }
});

test('장소 25곳·당일 추천 23곳과 공식 주소·좌표 범위를 지킨다', () => {
  assert.equal(TRAVEL_PLACES.length, 25);
  assert.equal(new Set(TRAVEL_PLACES.map(place => place.id)).size, 25);
  assert.equal(TRAVEL_META.placeCount, 25);
  assert.equal(TRAVEL_PLACES.filter(place => place.dayPlannerEligible).length, 23);
  for (const place of TRAVEL_PLACES) {
    for (const url of [place.officialUrl, place.bookingUrl, place.conditions.hours.sourceUrl, place.conditions.price.sourceUrl]) assert.equal(new URL(url).protocol, 'https:', place.id);
    if (!place.dayPlannerEligible) continue;
    assert.ok(place.coordinates.lat > 37.5 && place.coordinates.lat < 37.7, place.id);
    assert.ok(place.coordinates.lon > 126.9 && place.coordinates.lon < 127.1, place.id);
    assert.equal(place.coordinates.verifiedAt, checkedAt, place.id);
  }
});
