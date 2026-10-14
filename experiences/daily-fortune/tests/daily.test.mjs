import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { Solar } from '../vendor/lunar-javascript-1.7.7/lunar.mjs';
import { WESTERN_ZODIAC, seoulDateKey } from '../core.mjs';
import { getSaju } from '../saju-core.mjs';
import { getDailyCard, DAILY_POOLS, SAJU_RELATIONS, WESTERN_RELATIONS, TAGS, tagFor, westernDayElement } from '../daily.mjs';
import { dayPillar, addDays, elementRelation, STEMS } from '../fortune-base.mjs';
import { assertGentle } from './fortune-text.mjs';

const today = '2026-10-14';
// 연달아 태어난 열흘은 일간 열 가지를 모두 지난다.
const sajus = Array.from({ length: 10 }, (_, index) => getSaju({ birthDate: addDays('1990-05-09', index), birthTime: null }, today));
const TEXT_FIELDS = ['headline', 'message', 'do', 'dont', 'luckyItem'];

test('문장 묶음: 제목 60개 이상, 풀이·할 일·피할 일·행운 물건 40개 이상을 계열마다 나누고 겹치지 않는다', () => {
  const families = { korean: ['supported', 'same', 'expressing', 'organizing', 'balancing'], western: ['fire', 'earth', 'air', 'water'] };
  for (const [mode, ids] of Object.entries(families)) {
    assert.deepEqual(Object.keys(DAILY_POOLS[mode]).sort(), [...ids].sort());
    for (const [category, minimum] of [['headlines', 60], ['messages', 40], ['do', 40], ['dont', 40], ['items', 40]]) {
      const all = ids.flatMap(id => DAILY_POOLS[mode][id][category]);
      assert.ok(all.length >= minimum, `${mode} ${category} ${all.length}`);
      assert.equal(new Set(all).size, all.length, `${mode} ${category}에 같은 문장이 있다`);
      for (const id of ids) assert.ok(DAILY_POOLS[mode][id][category].length >= (mode === 'korean' ? 6 : 9), `${mode}/${id}/${category}`);
    }
    for (const id of ids) {
      for (const line of DAILY_POOLS[mode][id].messages) assert.equal(line.match(/[.?!]/g).length, 2, `두 문장 풀이: ${line}`);
      for (const line of DAILY_POOLS[mode][id].do) assert.match(line, /세요\.$|주세요\.$/, line);
      for (const line of DAILY_POOLS[mode][id].dont) assert.match(line, /미뤄|내려|쉬어|멈춰|참아|살펴/, `부드러운 피할 일: ${line}`);
    }
  }
  assert.ok(assertGentle(DAILY_POOLS, '문장 묶음') > 450);
});

test('같은 사람·날짜는 같은 카드이고 얼려 있으며 형식이 맞다', () => {
  for (const options of [{ mode: 'western', signId: 'leo', date: today }, { mode: 'korean', saju: sajus[3], date: today }]) {
    const card = getDailyCard(options);
    assert.deepEqual(card, getDailyCard(options));
    assert.equal(Object.isFrozen(card), true);
    assert.equal(Object.isFrozen(card.levels), true);
    assert.equal(card.date, today);
    assert.equal(card.mode, options.mode);
    for (const field of ['overall', 'love', 'money', 'work']) {
      assert.ok(Number.isInteger(card.levels[field]) && card.levels[field] >= 1 && card.levels[field] <= 5, field);
    }
    for (const field of [...TEXT_FIELDS, 'basis', 'note', 'label']) assert.ok(typeof card[field] === 'string' && card[field].length > (field === 'luckyItem' ? 1 : 3), field);
    assert.match(card.luckyColor.hex, /^#[0-9A-F]{6}$/);
    assert.ok(card.luckyColor.name.length > 1);
    assert.ok(Number.isInteger(card.luckyNumber) && card.luckyNumber >= 1 && card.luckyNumber <= 10);
    assert.equal(card.tag, tagFor(card.levels.overall));
    assert.equal(card.tagLabel, card.tag ? TAGS[card.tag] : null);
  }
  assert.equal(getDailyCard({ mode: 'western', signId: 'leo', date: today }).luckyTime, null);
  assert.match(getDailyCard({ mode: 'korean', saju: sajus[3], date: today }).luckyTime, /^(오전|오후|저녁|밤) \d{1,2}(시)?~(오후 )?\d{1,2}시$/);
});

test('사주는 오늘 일진 천간과 내 일간의 오행 관계 다섯 갈래로 기운과 근거를 정한다', () => {
  assert.equal(dayPillar(today).hanja, '辛酉');
  const saju = getSaju({ birthDate: '1990-05-17', birthTime: null }, today);
  assert.equal(saju.dayMaster.hanja, '壬');
  const card = getDailyCard({ mode: 'korean', saju, date: today });
  assert.equal(card.relation, 'supported');
  assert.equal(card.basis, '오늘 일진의 신금이 내 일간 임수를 살려 주는 날이에요.');
  assert.ok(card.levels.overall >= 4);
  const seen = new Set();
  for (const value of sajus) {
    for (let offset = 0; offset < 10; offset++) {
      const date = addDays(today, offset), result = getDailyCard({ mode: 'korean', saju: value, date });
      const stem = STEMS.find(item => item.hanja === value.dayMaster.hanja), todayStem = dayPillar(date).stem;
      assert.equal(result.relation, elementRelation(stem.element, todayStem.element));
      assert.equal(result.label, SAJU_RELATIONS[result.relation].label);
      assert.ok(result.basis.includes(stem.name) && result.basis.includes(todayStem.name), result.basis);
      assert.ok(Math.abs(result.levels.overall - SAJU_RELATIONS[result.relation].overall) <= 1);
      seen.add(result.relation);
    }
  }
  assert.equal(seen.size, 5);
});

test('별자리는 별자리 원소와 날짜로 고른 오늘의 원소로 정하고 4일마다 네 원소를 한 번씩 돈다', () => {
  for (let start = 0; start < 400; start += 4) {
    const first = addDays('2026-01-01', start - (Math.round(Date.parse('2026-01-01T00:00:00Z') / 86_400_000) % 4));
    const block = Array.from({ length: 4 }, (_, index) => westernDayElement(addDays(first, index)).element.id);
    assert.deepEqual([...block].sort(), ['air', 'earth', 'fire', 'water']);
  }
  const card = getDailyCard({ mode: 'western', signId: 'aries', date: today });
  assert.equal(card.signElement.id, 'fire');
  assert.equal(card.dayElement.id, westernDayElement(today).element.id);
  assert.ok(Object.keys(WESTERN_RELATIONS).includes(card.relation));
  assert.match(card.basis, /^오늘은 (불|흙|바람|물) 기운이 도는 날이라, /);
  assert.match(card.note, /천체 위치를 계산하지 않아요/);
});

function assertNoRepeatWithin30(cards, label) {
  for (let start = 0; start + 30 <= cards.length; start++) {
    const window = cards.slice(start, start + 30);
    for (const field of TEXT_FIELDS) {
      const values = window.map(card => card[field]);
      assert.equal(new Set(values).size, 30, `${label} ${window[0].date}부터 30일 ${field} 반복`);
    }
  }
}

test('같은 사람이 30일 연속으로 보면 제목·할 일·피할 일·풀이·행운 물건이 겹치지 않는다(열 가지 일간·12별자리, 매일 시작)', () => {
  for (const [start, span] of [['2026-10-14', 400], ['1999-12-01', 120], ['2100-10-01', 92]]) {
    for (const saju of sajus) {
      const cards = Array.from({ length: span }, (_, index) => getDailyCard({ mode: 'korean', saju, date: addDays(start, index) }));
      assertNoRepeatWithin30(cards, `사주 ${saju.dayMaster.hanja}`);
    }
    for (const sign of WESTERN_ZODIAC) {
      const cards = Array.from({ length: span }, (_, index) => getDailyCard({ mode: 'western', signId: sign.id, date: addDays(start, index) }));
      assertNoRepeatWithin30(cards, sign.id);
    }
  }
});

test('같은 일간이라도 생년월일이 다르면 문장 순서가 달라진다', () => {
  const a = getSaju({ birthDate: '1990-05-17', birthTime: null }, today);
  const b = getSaju({ birthDate: '1990-07-16', birthTime: null }, today);
  assert.equal(a.dayMaster.hanja, b.dayMaster.hanja);
  const headlines = saju => Array.from({ length: 30 }, (_, index) => getDailyCard({ mode: 'korean', saju, date: addDays(today, index) }).headline);
  assert.notDeepEqual(headlines(a), headlines(b));
});

test('한국 자정 경계에서 카드가 바뀌고 호스트 시간대와 무관하다', () => {
  const before = seoulDateKey('2026-10-14T14:59:59.999Z'), after = seoulDateKey('2026-10-14T15:00:00.000Z');
  assert.equal(before, '2026-10-14');
  assert.equal(after, '2026-10-15');
  for (const options of [{ mode: 'western', signId: 'pisces' }, { mode: 'korean', saju: sajus[0] }]) {
    const a = getDailyCard({ ...options, date: before }), b = getDailyCard({ ...options, date: after });
    assert.notEqual(a.headline, b.headline);
    assert.deepEqual(getDailyCard(options), getDailyCard({ ...options, date: seoulDateKey() }), '날짜를 빼면 한국 오늘');
  }
  const moduleUrl = new URL('../daily.mjs', import.meta.url).href, sajuUrl = new URL('../saju-core.mjs', import.meta.url).href;
  const code = `import {getDailyCard} from ${JSON.stringify(moduleUrl)};import {getSaju} from ${JSON.stringify(sajuUrl)};
    const saju=getSaju({birthDate:'2024-02-04',birthTime:null},'2026-10-14');
    console.log(JSON.stringify([getDailyCard({mode:'korean',saju,date:'2026-10-14'}),getDailyCard({mode:'western',signId:'virgo',date:'2026-12-31'})]))`;
  const outputs = ['Asia/Seoul', 'UTC', 'America/New_York'].map(TZ => execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TZ }, encoding: 'utf8', timeout: 10_000,
  }));
  assert.equal(outputs[0], outputs[1]);
  assert.equal(outputs[0], outputs[2]);
});

test('일진 계산은 고정 만세력의 일주와 1900~2100년 전체에서 같다', () => {
  for (let date = '1900-01-01'; date <= '2100-12-31'; date = addDays(date, 97)) {
    const [year, month, day] = date.split('-').map(Number);
    assert.equal(dayPillar(date).hanja, Solar.fromYmd(year, month, day).getLunar().getDayInGanZhi(), date);
  }
  assert.equal(dayPillar('2024-02-29').hanja, '癸亥');
});

test('시간 모름·절입 당일로 유보된 기둥이 있어도 일간만 있으면 계산하고, 일간이 유보되면 null', () => {
  const unknownBoundary = getSaju({ birthDate: '2024-02-04', birthTime: null }, today);
  assert.equal(unknownBoundary.pillars[0].known, false);
  assert.equal(unknownBoundary.pillars[1].known, false);
  assert.equal(unknownBoundary.pillars[3].known, false);
  const card = getDailyCard({ mode: 'korean', saju: unknownBoundary, date: today });
  assert.equal(card.dayMaster.hanja, '戊');
  assert.equal(card.birthTime, null);
  const timed = getDailyCard({ mode: 'korean', saju: getSaju({ birthDate: '2024-02-04', birthTime: '17:28' }, today), date: today });
  assert.equal(timed.relation, card.relation, '일간이 같으면 오늘 관계도 같다');
  const withheld = structuredClone(unknownBoundary);
  withheld.pillars[2] = { ...withheld.pillars[2], known: false, stem: null, branch: null };
  assert.equal(getDailyCard({ mode: 'korean', saju: withheld, date: today }), null);
  assert.equal(getDailyCard({ mode: 'korean', saju: { ...structuredClone(unknownBoundary), dayMaster: null }, date: today }), null);
});

test('잘못된 방식·별자리·날짜·사주와 출생 전 날짜를 거부한다', () => {
  assert.throws(() => getDailyCard({ mode: 'chinese', signId: 'leo', date: today }), TypeError);
  assert.throws(() => getDailyCard({ mode: 'western', signId: 'rat', date: today }), TypeError);
  assert.throws(() => getDailyCard({ mode: 'western', signId: 'leo', date: '2026-02-30' }), TypeError);
  assert.throws(() => getDailyCard({ mode: 'western', signId: 'leo', date: '2101-01-01' }), RangeError);
  assert.throws(() => getDailyCard({ mode: 'korean', date: today }), TypeError);
  assert.throws(() => getDailyCard({ mode: 'korean', saju: { signId: 'leo' }, date: today }), TypeError);
  assert.throws(() => getDailyCard({ mode: 'korean', saju: sajus[0], date: '1990-05-08' }), RangeError);
  assert.throws(() => getDailyCard(), TypeError);
});

test('나온 카드 전체에 금지어와 단정·권유 표현이 없다', () => {
  let count = 0;
  for (let index = 0; index < 60; index++) {
    const date = addDays(today, index * 7);
    for (const saju of sajus) count += assertGentle(getDailyCard({ mode: 'korean', saju, date }), date);
    for (const sign of WESTERN_ZODIAC) count += assertGentle(getDailyCard({ mode: 'western', signId: sign.id, date }), date);
  }
  assert.ok(count > 10_000);
});
