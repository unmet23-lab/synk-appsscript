import test from 'node:test';
import assert from 'node:assert/strict';
import { LUNAR_RANGE, lunarMonthDays, lunarToSolar, solarToLunar, normalizeLunarDate, lunarDateInYear } from '../lunar.mjs';

const dateString = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const lunarParts = (date, leapMonth = false) => {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day, leapMonth };
};

// Upstream's KASI / data.go.kr API reference samples, restricted to our range.
// https://github.com/usingsky/korean_lunar_calendar_js/blob/6f988e3f50a424d165b9834f9e28cd3ea962da63/test/dataset/kasi-lunar-dataset.json
// Source attribution and MIT license are retained in ../lunar.mjs.
const REFERENCE_DATES = [
  ['1904-07-13', '1904-06-01', false],
  ['1908-02-09', '1908-01-08', false],
  ['1909-04-08', '1909-02-18', true],
  ['1910-10-17', '1910-09-15', false],
  ['1911-09-20', '1911-07-28', false],
  ['1914-09-05', '1914-07-16', false],
  ['1916-03-14', '1916-02-11', false],
  ['1918-02-18', '1918-01-08', false],
  ['1919-09-12', '1919-07-18', true],
  ['1921-11-22', '1921-10-23', false],
  ['1922-02-28', '1922-02-02', false],
  ['1925-05-27', '1925-04-05', true],
  ['1926-10-24', '1926-09-18', false],
  ['1927-04-27', '1927-03-26', false],
  ['1928-05-22', '1928-04-04', false],
  ['1932-09-06', '1932-08-06', false],
  ['1935-03-28', '1935-02-24', false],
  ['1935-10-19', '1935-09-22', false],
  ['1939-06-15', '1939-04-28', false],
  ['1941-10-11', '1941-08-21', false],
  ['1946-02-27', '1946-01-26', false],
  ['1947-08-26', '1947-07-11', false],
  ['1953-02-18', '1953-01-05', false],
  ['1956-11-13', '1956-10-11', false],
  ['1956-11-17', '1956-10-15', false],
  ['1959-03-27', '1959-02-19', false],
  ['1965-01-21', '1964-12-19', false],
  ['1968-06-08', '1968-05-13', false],
  ['1968-12-23', '1968-11-04', false],
  ['1971-09-25', '1971-08-07', false],
  ['1972-10-28', '1972-09-22', false],
  ['1977-04-11', '1977-02-23', false],
  ['1980-08-22', '1980-07-12', false],
  ['1980-12-05', '1980-10-28', false],
  ['1981-04-23', '1981-03-19', false],
  ['1982-04-12', '1982-03-19', false],
  ['1983-03-21', '1983-02-07', false],
  ['1983-04-11', '1983-02-28', false],
  ['1985-02-16', '1984-12-27', false],
  ['1990-06-14', '1990-05-22', false],
  ['1991-04-08', '1991-02-24', false],
  ['1992-01-13', '1991-12-09', false],
  ['1993-12-04', '1993-10-21', false],
  ['1994-01-23', '1993-12-12', false],
  ['1997-08-17', '1997-07-15', false],
  ['2000-02-05', '2000-01-01', false],
  ['2003-06-18', '2003-05-19', false],
  ['2009-10-23', '2009-09-06', false],
  ['2010-06-11', '2010-04-29', false],
  ['2010-07-10', '2010-05-29', false],
  ['2011-08-21', '2011-07-22', false],
  ['2015-09-04', '2015-07-22', false],
  ['2016-07-13', '2016-06-10', false],
  ['2021-12-26', '2021-11-23', false],
  ['2028-06-24', '2028-05-02', true],
  ['2029-01-22', '2028-12-08', false],
  ['2033-02-12', '2033-01-13', false],
  ['2037-08-08', '2037-06-27', false],
  ['2038-04-06', '2038-03-02', false],
  ['2041-05-21', '2041-04-22', false],
  ['2042-10-08', '2042-08-25', false],
  ['2044-11-15', '2044-09-26', false],
  ['2045-09-10', '2045-07-29', false],
];

test('한국 음력 기준 자료 63개가 양방향으로 일치한다', () => {
  assert.equal(REFERENCE_DATES.length, 63);
  for (const [solar, lunar, leapMonth] of REFERENCE_DATES) {
    const parts = lunarParts(lunar, leapMonth);
    assert.equal(lunarToSolar(parts), solar, `음력 ${lunar} 윤달=${leapMonth}`);
    assert.deepEqual(solarToLunar(solar), parts, `양력 ${solar}`);
  }
});

test('한국천문연구원 현재 월 표와 알려진 설·추석·윤달 날짜가 일치한다', () => {
  // Live KASI table checked on 2026-10-06:
  // https://astro.kasi.re.kr/kor/life/pageView/5 (2026년 10월)
  const examples = [
    ['2026-10-06', '2026-08-26', false],
    ['2026-10-10', '2026-08-30', false],
    ['2026-10-11', '2026-09-01', false],
    ['2026-02-17', '2026-01-01', false],
    ['2026-09-25', '2026-08-15', false],
    ['2025-07-25', '2025-06-01', true],
    ['2017-06-24', '2017-05-01', true],
    ['1956-03-03', '1956-01-21', false],
  ];
  for (const [solar, lunar, leapMonth] of examples) {
    assert.equal(lunarToSolar(lunarParts(lunar, leapMonth)), solar);
    assert.deepEqual(solarToLunar(solar), lunarParts(lunar, leapMonth));
  }
});

test('정확한 지원 경계를 포함하고 그 밖은 계산하지 않는다', () => {
  assert.equal(lunarToSolar(lunarParts(LUNAR_RANGE.minDate)), LUNAR_RANGE.solarMin);
  assert.equal(lunarToSolar(lunarParts(LUNAR_RANGE.maxDate)), LUNAR_RANGE.solarMax);
  assert.deepEqual(solarToLunar(LUNAR_RANGE.solarMin), lunarParts(LUNAR_RANGE.minDate));
  assert.deepEqual(solarToLunar(LUNAR_RANGE.solarMax), lunarParts(LUNAR_RANGE.maxDate));
  for (const date of ['1899-12-31', '1900-01-30', '2051-01-01', '2199-01-01']) assert.equal(solarToLunar(date), null);
  for (const date of ['1899-12-30', '2050-11-19', '2050-12-01', '2051-01-01']) {
    assert.equal(lunarToSolar(lunarParts(date)), null);
    assert.throws(() => normalizeLunarDate(date), /1900-01-01~2050-11-18/);
  }
  assert.equal(lunarDateInYear({ date: '2026-12-01' }, 2050), null);
});

test('음력 2월 30일은 허용하고 없는 날짜·윤달·잘못된 자료형은 거부한다', () => {
  assert.deepEqual(normalizeLunarDate('2023-02-30'), { date: '2023-02-30', ...lunarParts('2023-02-30') });
  assert.equal(lunarToSolar(lunarParts('2023-02-30')), '2023-03-21');
  assert.equal(lunarToSolar(lunarParts('2026-02-30')), null);
  assert.equal(lunarToSolar(lunarParts('2026-06-01', true)), null);
  for (const input of [null, undefined, [], {}, { year: '2026', month: 1, day: 1 }, { year: 2026, month: 1, day: 1.5 }, { year: 2026, month: 1, day: 0 }, { year: 2026, month: 13, day: 1 }, { year: 2026, month: 1, day: 31 }, { year: 2026, month: 1, day: 1, leapMonth: 'false' }]) assert.equal(lunarToSolar(input), null);
  for (const input of [null, undefined, '', '2026-2-17', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-02-17T00:00:00Z']) assert.equal(solarToLunar(input), null);
  assert.throws(() => normalizeLunarDate('2026-06-01', true), /실제로 존재/);
  assert.throws(() => normalizeLunarDate('2026-02-30'), /실제로 존재/);
  assert.throws(() => normalizeLunarDate('2026-2-01'), /YYYY-MM-DD/);
  assert.throws(() => normalizeLunarDate('2026-02-01', 'true'), /윤달 여부/);
});

test('윤달 반복은 윤달 유지·평달 대체·해당 해 건너뛰기를 구분한다', () => {
  const input = { date: '2025-06-01', leapMonth: true, leapPolicy: 'regular', shortMonthPolicy: 'last-day' };
  assert.deepEqual(lunarDateInYear(input, 2025), { date: '2025-07-25', lunarDate: '2025-06-01', leapMonth: true });
  assert.deepEqual(lunarDateInYear(input, 2026), { date: '2026-07-14', lunarDate: '2026-06-01', leapMonth: false });
  assert.equal(lunarDateInYear({ ...input, leapPolicy: 'leap-only' }, 2026), null);
  assert.equal(lunarDateInYear({ ...input, leapPolicy: 'leap-only' }, 2025).leapMonth, true);
  assert.equal(lunarDateInYear({ ...input, leapMonth: false }, 2025).date, '2025-06-25');
  assert.equal(lunarDateInYear(input, 2024), null);
  assert.equal(lunarDateInYear(input, 2051), null);
  assert.throws(() => lunarDateInYear({ ...input, leapPolicy: 'guess' }, 2026), /반복 방법/);
});

test('작은달 30일 반복의 마지막 날·건너뛰기 정책이 저장 날짜를 훼손하지 않는다', () => {
  const input = { date: '2023-02-30', leapMonth: false, shortMonthPolicy: 'last-day' };
  assert.deepEqual(lunarDateInYear(input, 2025), { date: '2025-03-28', lunarDate: '2025-02-29', leapMonth: false });
  assert.equal(lunarDateInYear({ ...input, shortMonthPolicy: 'skip' }, 2025), null);
  assert.deepEqual(lunarDateInYear(input, 2027), { date: '2027-04-06', lunarDate: '2027-02-30', leapMonth: false });
  assert.equal(input.date, '2023-02-30');
  assert.throws(() => lunarDateInYear({ ...input, shortMonthPolicy: 'guess' }, 2025), /처리 방법/);
  assert.throws(() => lunarDateInYear({ date: '2026-02-30' }, 2027), /실제로 존재/);
  assert.equal(lunarMonthDays(2025, 2), 29);
  assert.equal(lunarMonthDays(2023, 2), 30);
  assert.equal(lunarMonthDays(2026, 6, true), null);
});

test('지원 범위 모든 양력 날짜가 하루도 빠짐없이 원래 날짜로 돌아온다', () => {
  const first = Date.parse(`${LUNAR_RANGE.solarMin}T00:00:00Z`);
  const last = Date.parse(`${LUNAR_RANGE.solarMax}T00:00:00Z`);
  for (let time = first; time <= last; time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const lunar = solarToLunar(date);
    assert.ok(lunar, date);
    assert.equal(lunarToSolar(lunar), date, date);
    assert.equal(normalizeLunarDate(dateString(lunar.year, lunar.month, lunar.day), lunar.leapMonth).day, lunar.day);
  }
});
