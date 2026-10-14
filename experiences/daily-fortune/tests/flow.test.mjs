import test from 'node:test';
import assert from 'node:assert/strict';
import { WESTERN_ZODIAC, seoulDateKey } from '../core.mjs';
import { getSaju } from '../saju-core.mjs';
import { getMonthFlow } from '../flow.mjs';
import { getDailyCard, TAGS } from '../daily.mjs';
import { addDays } from '../fortune-base.mjs';
import { assertGentle } from './fortune-text.mjs';

const today = '2026-10-14';
const saju = getSaju({ birthDate: '1990-05-17', birthTime: null }, today);

test('30일 흐름은 연속한 날짜마다 오늘 카드와 같은 총운·표시를 쓰고 요약을 맞춘다', () => {
  for (const options of [{ mode: 'korean', saju }, { mode: 'western', signId: 'leo' }]) {
    const flow = getMonthFlow({ ...options, startDate: today });
    assert.equal(flow.items.length, 30);
    assert.equal(flow.length, 30);
    assert.equal(flow.startDate, today);
    assert.equal(flow.endDate, addDays(today, 29));
    assert.equal(Object.isFrozen(flow.items[0]), true);
    flow.items.forEach((item, index) => {
      const card = getDailyCard({ ...options, date: addDays(today, index) });
      assert.equal(item.date, addDays(today, index));
      assert.equal(item.available, true);
      assert.equal(item.overall, card.levels.overall);
      assert.equal(item.tag, card.tag);
      assert.equal(item.label, card.label);
      assert.ok(['good', 'calm', 'care', null].includes(item.tag));
      assert.equal(item.tagLabel, item.tag ? TAGS[item.tag] : null);
    });
    for (const [field, tag] of [['goodDays', 'good'], ['calmDays', 'calm'], ['careDays', 'care']]) {
      assert.deepEqual(flow[field].map(item => item.date), flow.items.filter(item => item.tag === tag).map(item => item.date));
      for (const item of flow[field]) assert.ok(item.label && item.tagLabel === TAGS[tag]);
    }
    assert.match(flow.summary, /^앞으로 30일/);
    assert.deepEqual(flow, getMonthFlow({ ...options, startDate: today }), '같은 입력은 같은 흐름');
  }
});

test('표시 이름은 부드럽고 「조심할 날」 같은 말을 쓰지 않는다', () => {
  assert.deepEqual(TAGS, { good: '기운이 좋은 날', calm: '쉬어 가기 좋은 날', care: '천천히 가면 좋은 날' });
  for (const sign of WESTERN_ZODIAC) {
    const flow = getMonthFlow({ mode: 'western', signId: sign.id, startDate: today });
    assertGentle(flow, sign.id);
    assert.doesNotMatch(JSON.stringify(flow), /조심할 날|나쁜 날|흉일/);
  }
  assertGentle(getMonthFlow({ mode: 'korean', saju, startDate: today }), 'saju');
});

test('한 해 동안 좋은 날은 열에 한두 날, 천천히 갈 날은 드물다', () => {
  for (const options of [{ mode: 'korean', saju }, { mode: 'western', signId: 'aries' }, { mode: 'korean', saju: getSaju({ birthDate: '1984-03-02', birthTime: '06:00' }, today) }]) {
    const flow = getMonthFlow({ ...options, startDate: '2026-01-01', days: 62 });
    const share = tag => flow.items.filter(item => item.tag === tag).length / flow.items.length;
    assert.ok(share('good') >= 0.1 && share('good') <= 0.35, `좋은 날 ${share('good')}`);
    assert.ok(share('care') <= 0.12, `천천히 갈 날 ${share('care')}`);
  }
});

test('시작일·기간을 검사하고 지원 범위 끝을 넘는 날은 계산하지 않음으로 표시한다', () => {
  const end = getMonthFlow({ mode: 'western', signId: 'virgo', startDate: '2100-12-20' });
  assert.equal(end.items.filter(item => item.available).length, 12);
  assert.deepEqual(end.items.at(-1), { date: '2101-01-18', weekday: end.items.at(-1).weekday, available: false, overall: null, tag: null, tagLabel: null, label: '계산 지원 범위 밖의 날짜예요.' });
  for (const days of [0, 63, 1.5, '30']) assert.throws(() => getMonthFlow({ mode: 'western', signId: 'virgo', startDate: today, days }), RangeError);
  assert.throws(() => getMonthFlow({ mode: 'western', signId: 'virgo', startDate: '2026-13-01' }), TypeError);
  assert.throws(() => getMonthFlow({ mode: 'western', signId: 'nope', startDate: today }), TypeError);
  assert.equal(getMonthFlow({ mode: 'western', signId: 'virgo', startDate: today, days: 7 }).items.length, 7);
});

test('한국 날짜 기본값을 쓰고, 일간이 유보된 사주는 null을 돌려준다', () => {
  assert.equal(getMonthFlow({ mode: 'western', signId: 'leo' }).startDate, seoulDateKey());
  const withheld = structuredClone(saju);
  withheld.pillars[2] = { ...withheld.pillars[2], known: false };
  assert.equal(getMonthFlow({ mode: 'korean', saju: withheld, startDate: today }), null);
  const unknownTime = getSaju({ birthDate: '2024-02-04', birthTime: null }, today);
  assert.equal(getMonthFlow({ mode: 'korean', saju: unknownTime, startDate: today }).items.length, 30, '시간 모름·절입 당일도 일간으로 계산');
});
