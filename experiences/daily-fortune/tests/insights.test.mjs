import test from 'node:test';
import assert from 'node:assert/strict';
import { getFortune } from '../core.mjs';
import { getSaju } from '../saju-core.mjs';
import { suggestZodiac, ZODIAC_PROFILES, getZodiacProfile, getReadingSeries, getActionCard, getSajuGuide } from '../insights.mjs';

test('생일 자동 추천이 12별자리 경계의 양쪽과 연말·연초를 구분한다', () => {
  const cases = [
    ['01-19', 'capricorn'], ['01-20', 'aquarius'], ['02-18', 'aquarius'], ['02-19', 'pisces'],
    ['03-20', 'pisces'], ['03-21', 'aries'], ['04-19', 'aries'], ['04-20', 'taurus'],
    ['05-20', 'taurus'], ['05-21', 'gemini'], ['06-20', 'gemini'], ['06-21', 'cancer'],
    ['07-22', 'cancer'], ['07-23', 'leo'], ['08-22', 'leo'], ['08-23', 'virgo'],
    ['09-22', 'virgo'], ['09-23', 'libra'], ['10-22', 'libra'], ['10-23', 'scorpio'],
    ['11-21', 'scorpio'], ['11-22', 'sagittarius'], ['12-21', 'sagittarius'], ['12-22', 'capricorn'],
  ];
  for (const [monthDay, signId] of cases) {
    const value = suggestZodiac(`2000-${monthDay}`);
    assert.equal(value.signId, signId, monthDay);
    assert.equal(value.isBoundaryDay, true, monthDay);
    assert.ok(value.adjacentSign);
    assert.notEqual(value.adjacentSign.signId, signId);
    assert.match(value.note, /출생 연도·시각/);
  }
  assert.equal(suggestZodiac('2000-01-01').signId, 'capricorn');
  assert.equal(suggestZodiac('2000-12-31').signId, 'capricorn');
});

test('윤일 생일을 처리하며 일반 생일과 경계 근처의 안내를 구분한다', () => {
  const leap = suggestZodiac('2000-02-29');
  assert.equal(leap.signId, 'pisces');
  assert.equal(leap.nearBoundary, false);
  assert.equal(leap.isBoundaryDay, false);
  assert.equal(leap.adjacentSign, null);
  const nearby = suggestZodiac('1995-03-22');
  assert.equal(nearby.nearBoundary, true);
  assert.equal(nearby.isBoundaryDay, false);
  assert.match(nearby.note, /가까워요/);
  for (const date of ['2001-02-29', '2000-02-30', '2000-00-01', '2000-13-01', '', null]) assert.throws(() => suggestZodiac(date), TypeError);
});

test('별자리 기본 설명에 검증한 네 원소·세 양상과 열린 질문을 담는다', () => {
  assert.equal(ZODIAC_PROFILES.length, 12);
  const expected = {
    aries: ['fire', 'cardinal'], taurus: ['earth', 'fixed'], gemini: ['air', 'mutable'], cancer: ['water', 'cardinal'],
    leo: ['fire', 'fixed'], virgo: ['earth', 'mutable'], libra: ['air', 'cardinal'], scorpio: ['water', 'fixed'],
    sagittarius: ['fire', 'mutable'], capricorn: ['earth', 'cardinal'], aquarius: ['air', 'fixed'], pisces: ['water', 'mutable'],
  };
  for (const [id, values] of Object.entries(expected)) {
    const profile = getZodiacProfile(id);
    assert.deepEqual([profile.element.id, profile.modality.id], values);
    assert.equal(profile.keywords.length, 3);
    assert.match(profile.question, /\?$/);
    assert.match(profile.note, /문화적 상징/);
    assert.equal(Object.isFrozen(profile.keywords), true);
  }
  for (const id of ['constructor', '__proto__', '', null]) assert.throws(() => getZodiacProfile(id), TypeError);
});

test('오늘 읽을거리는 기존 별자리 운세와 행동을 그대로 재사용한다', () => {
  const series = getReadingSeries({ mode: 'western', signId: 'aries', date: '2026-10-06' });
  assert.equal(series.period, 'today');
  assert.equal(series.items.length, 1);
  assert.equal(series.startDate, '2026-10-06');
  assert.equal(series.endDate, '2026-10-06');
  assert.equal(series.items[0].weekday, '화');
  assert.equal(series.items[0].isToday, true);
  assert.deepEqual(series.items[0].fortune, getFortune('aries', '2026-10-06', 'western'));
  assert.equal(series.items[0].action.text, series.items[0].fortune.action);
});

test('이번 주는 월요일부터 일요일까지이며 날짜별 기존 결과와 일치한다', () => {
  const series = getReadingSeries({ mode: 'western', signId: 'libra', date: '2026-10-06', period: 'week' });
  assert.equal(series.startDate, '2026-10-05');
  assert.equal(series.endDate, '2026-10-11');
  assert.equal(series.items.length, 7);
  assert.deepEqual(series.items.map(item => item.weekday), ['월', '화', '수', '목', '금', '토', '일']);
  assert.equal(series.items.filter(item => item.isToday).length, 1);
  for (const item of series.items) assert.deepEqual(item.fortune, getFortune('libra', item.date, 'western'));
  const sunday = getReadingSeries({ mode: 'western', signId: 'libra', date: '2026-10-11', period: 'week' });
  assert.equal(sunday.startDate, series.startDate);
  assert.equal(sunday.endDate, series.endDate);
});

test('연말·월말·윤일을 끼는 주도 정확히 일곱 날짜를 제공한다', () => {
  for (const [date, start, end] of [
    ['2026-12-31', '2026-12-28', '2027-01-03'],
    ['2024-02-29', '2024-02-26', '2024-03-03'],
    ['2026-10-01', '2026-09-28', '2026-10-04'],
  ]) {
    const series = getReadingSeries({ mode: 'western', signId: 'pisces', date, period: 'week' });
    assert.equal(series.startDate, start);
    assert.equal(series.endDate, end);
    assert.equal(new Set(series.items.map(item => item.date)).size, 7);
    for (let index = 1; index < 7; index++) {
      const previous = Date.parse(series.items[index - 1].date + 'T00:00:00Z');
      const current = Date.parse(series.items[index].date + 'T00:00:00Z');
      assert.equal(current - previous, 86_400_000);
    }
  }
});

test('사주 주간 읽을거리에서 출생 기둥은 유지하고 날짜별 일진을 적용한다', () => {
  const input = { mode: 'korean', birthDate: '2005-12-23', birthTime: '08:37', date: '2026-10-06', period: 'week' };
  const series = getReadingSeries(input);
  const first = series.items[0].fortune;
  for (const item of series.items) {
    assert.deepEqual(item.fortune, getSaju({ birthDate: input.birthDate, birthTime: input.birthTime }, item.date));
    assert.deepEqual(item.fortune.pillars, first.pillars);
  }
  assert.equal(new Set(series.items.map(item => item.fortune.todayPillar.hanja)).size, 7);
});

test('출생일 이전과 지원 범위 밖의 주간 날짜에 임의 결과를 만들지 않는다', () => {
  const newborn = getReadingSeries({ mode: 'korean', birthDate: '2026-10-06', birthTime: null, date: '2026-10-06', period: 'week' });
  assert.equal(newborn.items[0].date, '2026-10-05');
  assert.equal(newborn.items[0].fortune, null);
  assert.equal(newborn.items[0].action, null);
  assert.match(newborn.items[0].unavailableReason, /출생일 이전/);
  assert.ok(newborn.items[1].fortune);
  const boundary = getReadingSeries({ mode: 'korean', birthDate: '2000-01-01', date: '2100-12-31', period: 'week' });
  assert.equal(boundary.items[6].fortune, null);
  assert.match(boundary.items[6].unavailableReason, /지원 범위/);
});

test('읽을거리 기간·프로필·날짜 입력 오류를 조기에 거부한다', () => {
  const good = { mode: 'western', signId: 'aries', date: '2026-10-06' };
  for (const options of [null, [], {}, { ...good, period: 'year' }, { ...good, mode: 'other' }, { ...good, signId: '__proto__' },
    { ...good, date: '2026-02-29' }, { ...good, date: '1899-12-31' }, { ...good, mode: 'korean', birthDate: '2026-10-07' }]) {
    assert.throws(() => getReadingSeries(options));
  }
});

test('행동·회고 초기값은 비어 있으며 날짜와 선택 프로필마다 완료 기록 키를 구분한다', () => {
  const fortune = getFortune('aries', '2026-10-06', 'western');
  const a = getActionCard(fortune);
  assert.equal(a.key, 'western:2026-10-06:aries');
  assert.equal(a.completed, false);
  assert.equal(a.reflection, '');
  assert.deepEqual(a, getActionCard(fortune));
  assert.notEqual(a.key, getActionCard(getFortune('taurus', '2026-10-06', 'western')).key);
  assert.notEqual(a.key, getActionCard(getFortune('aries', '2026-10-07', 'western')).key);
  const saju = getSaju({ birthDate: '2005-12-23', birthTime: '08:37' }, '2026-10-06');
  const otherTime = getSaju({ birthDate: '2005-12-23', birthTime: '10:37' }, '2026-10-06');
  assert.notEqual(getActionCard(saju).key, getActionCard(otherTime).key);
  assert.equal(getActionCard(saju).key.includes('2005-12-23'), false);
  assert.equal(Object.isFrozen(a), true);
});

test('사주 가이드는 실제 네 기둥·일간·겉글자 집계와 자세한 한계를 함께 설명한다', () => {
  const saju = getSaju({ birthDate: '2005-12-23', birthTime: '08:37' }, '2026-10-06');
  const guide = getSajuGuide(saju);
  assert.equal(guide.pillars.length, 4);
  assert.equal(guide.countedCharacters, 8);
  assert.match(guide.pillars[0].description, /입춘/);
  assert.match(guide.pillars[1].description, /12절/);
  assert.match(guide.pillars[2].reading, /辛巳/);
  assert.match(guide.dayMaster.title, /辛\(신\).*금 일간/);
  assert.match(guide.limits.join(' '), /지장간/);
  assert.match(guide.limits.join(' '), /신강·신약/);
  assert.match(guide.limits.join(' '), /용신/);
  assert.match(guide.limits.join(' '), /서머타임/);
  assert.deepEqual(guide.elements.map(item => item.count), saju.elements.map(item => item.count));
});

test('불확실한 사주 가이드는 빈 기둥을 유지하고 0개 오행을 결핍으로 읽지 않는다', () => {
  const guide = getSajuGuide(getSaju({ birthDate: '2024-02-04', birthTime: null }, '2026-10-06'));
  assert.equal(guide.countedCharacters, 2);
  assert.equal(guide.pillars.filter(item => !item.known).length, 3);
  assert.match(guide.pillars[0].reading, /아직 확정하지 않았어요/);
  for (const element of guide.elements.filter(item => item.count === 0)) assert.match(element.reading, /능력이 없다는 뜻은 아니에요/);
  assert.throws(() => getSajuGuide(getFortune('rat', '2026-10-06')), TypeError);
});
