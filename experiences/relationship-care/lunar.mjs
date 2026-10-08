/**
 * 한국 음력의 오프라인 변환. 날짜는 시간대 없는 YYYY-MM-DD이며 계산에는 UTC만 쓴다.
 * 지원: 음력 1900-01-01 ~ 2050-11-18 / 양력 1900-01-31 ~ 2050-12-31.
 *
 * 연도별 표와 비트 해석은 korean-lunar-calendar의 한국 음력 표를 재사용했다.
 * Source: https://github.com/usingsky/korean_lunar_calendar_js
 * Pinned: 6f988e3f50a424d165b9834f9e28cd3ea962da63
 * Original: src/korean-lunar-data.ts (1900~2050년 부분), src/korean-lunar-calendar.ts
 * Upstream states its table follows KASI: https://astro.kasi.re.kr/kor/life/pageView/5
 * SYNK: 범위 축소, 순수 함수, 명시적 윤달·작은달 반복 정책. 런타임 외부 요청 없음.
 *
 * MIT License
 * Copyright (c) 2022 Jinil Lee
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export const LUNAR_RANGE = Object.freeze({
  minYear: 1900, maxYear: 2050,
  minDate: '1900-01-01', maxDate: '2050-11-18',
  solarMin: '1900-01-31', solarMax: '2050-12-31',
});

// 1900년부터 순서대로: bits 0~11=평달 일수, 12~15=윤달, 16=윤달 일수,
// 17~25=해 전체 일수. 원본의 고위 비트도 그대로 보존한다.
const YEAR_DATA = Object.freeze([
  0x830084bd, 0x82c404ae, 0x82c60a57, 0x82fe554d, 0xc2c40d26, 0x82c60d95, 0x83014655, 0x82c4056a,
  0xc2c609ad, 0x8300255d, 0x82c404ae, 0x83006a5b, 0xc2c40a4d, 0x82c40d25, 0x83005da9, 0x82c60b55,
  0xc2c4056a, 0x83002ada, 0x82c6095d, 0x830074bb, 0xc2c4049b, 0x82c40a4b, 0x83005b4b, 0x82c406a9,
  0xc2c40ad4, 0x83024bb5, 0x82c402b6, 0x82c6095b, 0xc3002537, 0x82c40497, 0x82fe6656, 0x82c40e4a,
  0xc2c60ea5, 0x830156a9, 0x82c605b5, 0x82c402b6, 0xc30138ae, 0x82c4092e, 0x83017c8d, 0x82c40c95,
  0xc2c40d4a, 0x83016d8a, 0x82c60b69, 0x82c6056d, 0xc301425b, 0x82c4025d, 0x82c4092d, 0x83002d2b,
  0xc2c40a95, 0x83007d55, 0x82c40b4a, 0x82c60b55, 0xc3015555, 0x82c604db, 0x82c4025b, 0x83013857,
  0xc2c4052b, 0x83008a9b, 0x82c40695, 0x82c406aa, 0xc3006aea, 0x82c60ab5, 0x82c404b6, 0x83004aae,
  0xc2c60a57, 0x82c40527, 0x82fe3726, 0x82c60d95, 0xc30076b5, 0x82c4056a, 0x82c609ad, 0x830054dd,
  0xc2c404ae, 0x82c40a4e, 0x83004d4d, 0x82c40d25, 0xc3008d59, 0x82c40b54, 0x82c60d6a, 0x8301695a,
  0xc2c6095b, 0x82c4049b, 0x83004a9b, 0x82c40a4b, 0xc300ab27, 0x82c406a5, 0x82c406d4, 0x83026b75,
  0xc2c402b6, 0x82c6095b, 0x830054b7, 0x82c40497, 0xc2c4064b, 0x82fe374a, 0x82c60ea5, 0x830086d9,
  0xc2c605ad, 0x82c402b6, 0x8300596e, 0x82c4092e, 0xc2c40c96, 0x83004e95, 0x82c40d4a, 0x82c60da5,
  0xc3002755, 0x82c4056c, 0x83027abb, 0x82c4025d, 0xc2c4092d, 0x83005cab, 0x82c40a95, 0x82c40b4a,
  0xc3013b4a, 0x82c60b55, 0x8300955d, 0x82c404ba, 0xc2c60a5b, 0x83005557, 0x82c4052b, 0x82c40a95,
  0xc3004b95, 0x82c406aa, 0x82c60ad5, 0x830026b5, 0xc2c404b6, 0x83006a6e, 0x82c60a57, 0x82c40527,
  0xc2fe56a6, 0x82c60d93, 0x82c405aa, 0x83003b6a, 0xc2c6096d, 0x8300b4af, 0x82c404ae, 0x82c40a4d,
  0xc3016d0d, 0x82c40d25, 0x82c40d52, 0x83005dd4, 0xc2c60b6a, 0x82c6096d, 0x8300255b, 0x82c4049b,
  0xc3007a57, 0x82c40a4b, 0x82c40b25, 0x83015b25, 0xc2c406d4, 0x82c60ada, 0x830138b6,
]);
const DAY = 86_400_000;
const EPOCH = Date.UTC(1900, 0, 31);
const YEAR_STARTS = [0];
for (const data of YEAR_DATA) YEAR_STARTS.push(YEAR_STARTS.at(-1) + ((data >>> 17) & 0x1ff));
Object.freeze(YEAR_STARTS);
const pad = value => String(value).padStart(2, '0');
const dateString = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
const validYear = year => Number.isInteger(year) && year >= LUNAR_RANGE.minYear && year <= LUNAR_RANGE.maxYear;
const lunarData = year => YEAR_DATA[year - LUNAR_RANGE.minYear];
const leapMonthInYear = year => (lunarData(year) >>> 12) & 0xf;

/** 존재하는 평달·윤달의 실제 일수. 지원 범위 밖/없는 윤달이면 null. */
export function lunarMonthDays(year, month, leapMonth = false) {
  if (!validYear(year) || !Number.isInteger(month) || month < 1 || month > 12 || typeof leapMonth !== 'boolean') return null;
  if (leapMonth && leapMonthInYear(year) !== month) return null;
  return 29 + ((lunarData(year) >>> (leapMonth ? 16 : 12 - month)) & 1);
}

/** 실제로 존재하는 음력 날짜만 양력으로 변환. 잘못된 입력·범위 초과는 null. */
export function lunarToSolar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const { year, month, day, leapMonth = false } = input;
  const monthDays = lunarMonthDays(year, month, leapMonth);
  if (!monthDays || !Number.isInteger(day) || day < 1 || day > monthDays) return null;
  const date = dateString(year, month, day);
  if (date < LUNAR_RANGE.minDate || date > LUNAR_RANGE.maxDate) return null;
  let offset = YEAR_STARTS[year - LUNAR_RANGE.minYear] + day - 1;
  const leap = leapMonthInYear(year);
  for (let m = 1; m < month; m++) {
    offset += lunarMonthDays(year, m);
    if (m === leap) offset += lunarMonthDays(year, m, true);
  }
  if (leapMonth) offset += lunarMonthDays(year, month);
  const solar = new Date(EPOCH + offset * DAY).toISOString().slice(0, 10);
  return solar <= LUNAR_RANGE.solarMax ? solar : null;
}

/** 양력 YYYY-MM-DD를 한국 음력으로 변환. 현지 시간대나 Intl 달력에 의존하지 않는다. */
export function solarToLunar(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < LUNAR_RANGE.solarMin || date > LUNAR_RANGE.solarMax) return null;
  const [year, month, day] = date.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  const offset = Math.round((timestamp - EPOCH) / DAY);
  let yearIndex = 0;
  while (yearIndex + 1 < YEAR_STARTS.length && YEAR_STARTS[yearIndex + 1] <= offset) yearIndex++;
  const lunarYear = LUNAR_RANGE.minYear + yearIndex;
  let remaining = offset - YEAR_STARTS[yearIndex];
  const leap = leapMonthInYear(lunarYear);
  for (let m = 1; m <= 12; m++) {
    const days = lunarMonthDays(lunarYear, m);
    if (remaining < days) return { year: lunarYear, month: m, day: remaining + 1, leapMonth: false };
    remaining -= days;
    if (m === leap) {
      const leapDays = lunarMonthDays(lunarYear, m, true);
      if (remaining < leapDays) return { year: lunarYear, month: m, day: remaining + 1, leapMonth: true };
      remaining -= leapDays;
    }
  }
  return null;
}

/** 입력 저장용 검증. 음력 2월 30일을 양력 Date로 검사하지 않는다. */
export function normalizeLunarDate(date, leapMonth = false) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('음력 날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');
  if (typeof leapMonth !== 'boolean') throw new Error('음력 윤달 여부를 확인해 주세요.');
  if (date < LUNAR_RANGE.minDate || date > LUNAR_RANGE.maxDate) throw new Error('음력은 1900-01-01~2050-11-18 사이만 지원해요.');
  const [year, month, day] = date.split('-').map(Number);
  const value = { year, month, day, leapMonth };
  if (!lunarToSolar(value)) throw new Error('실제로 존재하는 음력 날짜와 윤달 여부를 확인해 주세요.');
  return { date, ...value };
}

/**
 * 지정한 음력 해의 반복 회차. 원본 날짜는 먼저 엄격히 검증한다.
 * leapPolicy: regular = 해당 윤달이 없는 해에는 평달 / leap-only = 해당 해 생략.
 * shortMonthPolicy: last-day = 30일이 없는 달에는 29일 / skip = 해당 해 생략.
 * 지원 끝 경계를 넘는 날짜는 18일 등으로 보정하지 않고 null을 돌려준다.
 */
export function lunarDateInYear(input, targetYear) {
  const original = normalizeLunarDate(input?.date, input?.leapMonth ?? false);
  const leapPolicy = input?.leapPolicy ?? 'regular';
  const shortMonthPolicy = input?.shortMonthPolicy ?? 'last-day';
  if (!['regular', 'leap-only'].includes(leapPolicy)) throw new Error('음력 윤달 반복 방법을 확인해 주세요.');
  if (!['last-day', 'skip'].includes(shortMonthPolicy)) throw new Error('음력 30일이 없는 해의 처리 방법을 확인해 주세요.');
  if (!validYear(targetYear) || targetYear < original.year) return null;
  let leapMonth = original.leapMonth;
  if (leapMonth && leapMonthInYear(targetYear) !== original.month) {
    if (leapPolicy === 'leap-only') return null;
    leapMonth = false;
  }
  const days = lunarMonthDays(targetYear, original.month, leapMonth);
  if (original.day > days && shortMonthPolicy === 'skip') return null;
  const day = Math.min(original.day, days);
  const date = lunarToSolar({ year: targetYear, month: original.month, day, leapMonth });
  return date ? { date, lunarDate: dateString(targetYear, original.month, day), leapMonth } : null;
}
