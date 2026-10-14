import test from 'node:test';
import assert from 'node:assert/strict';
import { Solar } from '../vendor/lunar-javascript-1.7.7/lunar.mjs';
import { WESTERN_ZODIAC } from '../core.mjs';
import { getSaju } from '../saju-core.mjs';
import { getYearReading, getZodiacYear, yearGanji, YEAR_TEXT } from '../year.mjs';
import { monthPillar, elementRelation, STEMS, addDays } from '../fortune-base.mjs';
import { assertGentle } from './fortune-text.mjs';

const today = '2026-10-14';
const sajus = Array.from({ length: 10 }, (_, index) => getSaju({ birthDate: addDays('1990-05-09', index), birthTime: null }, today));

test('그해 이름: 2026 병오, 2024 갑진, 1984 갑자, 1900 경자, 2100 경신', () => {
  assert.deepEqual(yearGanji(2026), { hangul: '병오', hanja: '丙午', element: '화', branch: '오' });
  for (const [year, hangul] of [[2024, '갑진'], [1984, '갑자'], [1900, '경자'], [2100, '경신'], [2027, '정미']]) assert.equal(yearGanji(year).hangul, hangul);
  for (const year of [1899, 2101, 2026.5, '2026', null]) assert.throws(() => yearGanji(year), RangeError);
});

test('월건은 그달 15일에 걸린 절기 월주이며 고정 만세력·사주 월주와 같다', () => {
  assert.deepEqual(Array.from({ length: 12 }, (_, index) => monthPillar(2026, index + 1).hangul),
    ['기축', '경인', '신묘', '임진', '계사', '갑오', '을미', '병신', '정유', '무술', '기해', '경자']);
  for (let year = 1900; year <= 2100; year += 17) {
    for (let month = 1; month <= 12; month++) {
      const pillar = monthPillar(year, month);
      assert.equal(pillar.hanja, Solar.fromYmdHms(year, month, 15, 12, 0, 0).getLunar().getMonthInGanZhiExact(), `${year}-${month}`);
      const birthDate = `${year}-${String(month).padStart(2, '0')}-15`;
      if (birthDate <= today) assert.equal(getSaju({ birthDate, birthTime: '12:00' }, today).pillars[1].hanja, pillar.hanja);
    }
  }
});

test('올해 읽을거리는 그해 천간과 일간의 관계로 정하고 월별 12칸을 채운다', () => {
  const relations = new Set();
  for (const saju of sajus) {
    const reading = getYearReading({ saju, year: 2026 });
    const stem = STEMS.find(item => item.hanja === saju.dayMaster.hanja);
    assert.equal(reading.year, 2026);
    assert.equal(reading.ganji, '병오');
    assert.equal(reading.relation, elementRelation(stem.element, '화'));
    assert.match(reading.message, /^2026년은 병오년, 화 기운의 해예요\. /);
    assert.equal(reading.keywords.length, 3);
    assert.ok(reading.headline.length > 4);
    assert.equal(reading.months.length, 12);
    assert.deepEqual(reading.months.map(item => item.month), Array.from({ length: 12 }, (_, index) => index + 1));
    for (const item of reading.months) {
      assert.ok(Number.isInteger(item.level) && item.level >= 1 && item.level <= 5);
      assert.equal(item.relation, elementRelation(stem.element, monthPillar(2026, item.month).stem.element));
      assert.ok(YEAR_TEXT.korean.months[item.relation].includes(item.line));
      assert.equal(item.ganji, monthPillar(2026, item.month).hangul);
    }
    assert.equal(new Set(reading.months.map(item => item.line)).size, 12, '한 해 안에서 월별 문장이 겹치지 않는다');
    assert.deepEqual(reading, getYearReading({ saju, year: 2026 }));
    assert.equal(Object.isFrozen(reading.months[0]), true);
    relations.add(reading.relation);
    assertGentle(reading, saju.dayMaster.hanja);
  }
  assert.equal(relations.size, 5);
  for (let year = 1990; year <= 2040; year += 7) {
    for (const saju of sajus) assert.equal(new Set(getYearReading({ saju, year }).months.map(item => item.line)).size, 12, `${year}`);
  }
});

test('시간 모름·절입 당일도 일간으로 읽고, 일간이 유보되면 null', () => {
  const boundary = getSaju({ birthDate: '2024-02-04', birthTime: null }, today);
  assert.equal(getYearReading({ saju: boundary, year: 2026 }).months.length, 12);
  const withheld = structuredClone(boundary);
  withheld.pillars[2] = { ...withheld.pillars[2], known: false };
  assert.equal(getYearReading({ saju: withheld, year: 2026 }), null);
  assert.throws(() => getYearReading({ saju: boundary, year: 2101 }), RangeError);
  assert.throws(() => getYearReading({ saju: null, year: 2026 }), TypeError);
});

test('별자리 올해: 그달 15일 태양 별자리 원소와의 관계로 월별 기운, 내 별자리 시즌은 따로 표시', () => {
  for (const sign of WESTERN_ZODIAC) {
    const reading = getZodiacYear({ signId: sign.id, year: 2026 });
    assert.equal(reading.signLabel, sign.label);
    assert.equal(reading.keywords.length, 3);
    assert.match(reading.message, new RegExp(`${sign.label}에게 2026년은 `));
    assert.equal(reading.months.length, 12);
    const season = reading.months.filter(item => item.sunSign === sign.label);
    assert.equal(season.length, 1);
    assert.equal(season[0].level, 5);
    assert.equal(season[0].line, YEAR_TEXT.western.months.season);
    assert.equal(new Set(reading.months.map(item => item.line)).size, 12);
    for (const item of reading.months) assert.ok(item.level >= 1 && item.level <= 5);
    assertGentle(reading, sign.id);
  }
  assert.deepEqual(getZodiacYear({ signId: 'leo', year: 2026 }).months.map(item => item.sunSign),
    ['염소자리', '물병자리', '물고기자리', '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리', '천칭자리', '전갈자리', '사수자리']);
  assert.notEqual(getZodiacYear({ signId: 'leo', year: 2026 }).headline, getZodiacYear({ signId: 'leo', year: 2027 }).headline);
  assert.throws(() => getZodiacYear({ signId: 'rat', year: 2026 }), TypeError);
  assert.throws(() => getZodiacYear({ signId: 'leo', year: 1899 }), RangeError);
});

test('올해 문장 전체에 금지어와 단정·권유 표현이 없다', () => {
  assertGentle(YEAR_TEXT, '올해 문장');
});
