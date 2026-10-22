'use strict';
// 싱크타운 마을 시계(세로 조각 설계 §4·§15-3) — 세 가지 시각, 네 구간, 두 가지 날씨, 시간대 바뀜.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule, runUnderTimezone } = require('./lib/town.js');

const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
/** 2026-10-22T10:00Z — 한국 19:00, UTC+8 사용자의 18:00(설계 §4-7의 예). */
const EXAMPLE = 1792663200000;
/** 내 시각 hh:mm의 epoch ms(2026-10-22 생활일 기준). */
const localAt = (offsetMin, hh, mm = 0) => Date.UTC(2026, 9, 22, hh, mm) - offsetMin * MINUTE;

test('설계 §4-7의 예와 같은 값을 낸다', async () => {
  const { clockAt } = await townModule('clock');
  const out = clockAt({ villageSeed: '9f3a', hostNowMs: EXAMPLE, tz: 480 });
  assert.equal(out.kstDate, '2026-10-22');
  assert.equal(out.kstHour, 19);
  assert.equal(out.season, 'autumn');
  assert.equal(out.lifeDay, 20748);
  assert.equal(out.lifeDate, '2026-10-22');
  assert.equal(out.localTime, '18:00');
  assert.equal(out.dayKind, 'weekday');
  assert.equal(out.band, 'evening');
  assert.equal(out.bandStartMs, 1792659600000);
  assert.equal(out.bandEndMs, 1792674000000);
  assert.deepEqual(out.lightKey, { from: 'sunset', to: 'blue-evening', t: 0.25 });
  assert.ok(['clear', 'rain'].includes(out.weatherNow) && ['clear', 'rain'].includes(out.weatherTomorrow));
});

test('생활일은 내 시각 05:00에 바뀌고 밤 구간은 자정을 넘어도 같은 생활일이다', async () => {
  const { bandAt, lifeDayAt, bandsBetween, BAND_IDS } = await townModule('clock');
  for (const tz of [540, 480, 420, -300]) {
    assert.equal(lifeDayAt(tz, localAt(tz, 4, 59)), 20747, `${tz} 04:59`);
    assert.equal(lifeDayAt(tz, localAt(tz, 5, 0)), 20748, `${tz} 05:00`);
    assert.equal(bandAt(tz, localAt(tz, 23, 0)).band, 'night');
    assert.equal(bandAt(tz, localAt(tz, 23, 0)).lifeDay, bandAt(tz, localAt(tz, 23, 0) + 3 * HOUR).lifeDay, '밤 23:00과 02:00은 같은 생활일');
    for (const [hh, band] of [[5, 'morning'], [10, 'morning'], [11, 'day'], [16, 'day'], [17, 'evening'], [20, 'evening'], [21, 'night'], [4, 'night']]) {
      assert.equal(bandAt(tz, localAt(tz, hh, 30)).band, band, `${tz} ${hh}:30`);
    }
    const windows = bandsBetween(tz, localAt(tz, 5, 0), localAt(tz, 5, 0) + DAY);
    assert.deepEqual(windows.map(w => w.band), BAND_IDS);
    assert.deepEqual(windows.map(w => (w.endMs - w.startMs) / HOUR), [6, 6, 4, 8]);
  }
});

test('같은 마을·같은 한국 날짜면 같은 날씨, 한국 시각은 사용자 시간대와 상관없다', async () => {
  const { weatherDayOf, weatherAt, clockAt } = await townModule('clock');
  for (let day = 20700; day < 20760; day++) assert.equal(weatherDayOf('v-a', day), weatherDayOf('v-a', day));
  const kinds = new Set(Array.from({ length: 120 }, (_, i) => weatherDayOf('v-a', 20700 + i)));
  assert.ok(kinds.size >= 4, `120일에 날씨 꼴이 여럿(${[...kinds]})`);
  let differs = 0;
  for (let day = 20700; day < 20760; day++) if (weatherDayOf('v-a', day) !== weatherDayOf('v-b', day)) differs++;
  assert.ok(differs > 5, '다른 마을은 날씨가 다르다');
  for (const ms of [EXAMPLE, EXAMPLE + 7 * HOUR, EXAMPLE + 15 * HOUR]) {
    const views = [540, 480, 420, -300].map(tz => clockAt({ villageSeed: 'v-a', hostNowMs: ms, tz }));
    assert.equal(new Set(views.map(v => `${v.kstDate} ${v.kstHour} ${v.weatherNow} ${v.weatherDay} ${v.season}`)).size, 1, '열여섯이 같은 순간에 같은 하늘');
    assert.equal(views[0].weatherNow, weatherAt('v-a', ms));
  }
});

test('하루 꼴은 한국 시각의 비 시간대로 바뀐다', async () => {
  const { weatherDayOf, weatherAt, WEATHER_DAYS } = await townModule('clock');
  const kstStart = day => day * DAY - 9 * HOUR;
  const found = {};
  for (let day = 20000; Object.keys(found).length < 5 && day < 22000; day++) {
    const kind = weatherDayOf('pattern-seed', day);
    if (!found[kind]) found[kind] = day;
  }
  assert.deepEqual(Object.keys(found).sort(), Object.keys(WEATHER_DAYS).sort());
  for (const [kind, day] of Object.entries(found)) {
    for (let hour = 0; hour < 24; hour++) {
      const raining = WEATHER_DAYS[kind].some(([from, to]) => hour >= from && hour < to);
      assert.equal(weatherAt('pattern-seed', kstStart(day) + hour * HOUR + 30 * MINUTE), raining ? 'rain' : 'clear', `${kind} ${hour}시`);
    }
  }
});

test('계절별 가중치를 따른다(천분율, 〔초기값〕)', async () => {
  const { weatherDayOf, WEATHER_WEIGHTS } = await townModule('clock');
  // 2026년 4월(봄)·7월(여름)·10월(가을)·1월(겨울) 날짜에 마을 400곳.
  for (const [season, day] of [['spring', 20558], ['summer', 20649], ['autumn', 20741], ['winter', 20469]]) {
    let clear = 0;
    for (let v = 0; v < 400; v++) for (let d = 0; d < 3; d++) if (weatherDayOf(`season-${v}`, day + d) === 'clear-day') clear++;
    const share = clear / 1200, expected = WEATHER_WEIGHTS[season][0] / 1000;
    assert.ok(Math.abs(share - expected) < 0.05, `${season} 맑은 날 ${share} ≈ ${expected}`);
  }
});

test('내일 날씨는 다음 생활일 05:00~21:00에 비가 있는지다', async () => {
  const { clockAt, rainBetween } = await townModule('clock');
  for (let i = 0; i < 40; i++) {
    const ms = EXAMPLE + i * DAY;
    const out = clockAt({ villageSeed: 'tomorrow', hostNowMs: ms, tz: 540 });
    const start = localAt(540, 5, 0) + (i + 1) * DAY;
    assert.equal(out.weatherTomorrow, rainBetween('tomorrow', start, start + 16 * HOUR) ? 'rain' : 'clear');
  }
});

test('하루 유형: 휴무가 주말보다 앞선다', async () => {
  const { dayKindOf, weekdayOf } = await townModule('clock');
  assert.equal(weekdayOf(20748), 3, '2026-10-22는 목요일');
  assert.equal(dayKindOf(20748), 'weekday');
  assert.equal(dayKindOf(20750), 'weekend', '토요일');
  assert.equal(dayKindOf(20751, 6), 'off', '일요일 휴무인 연구원은 일요일이 휴무');
  assert.equal(dayKindOf(20747, 2), 'off', '수요일 휴무인 공방 주인');
  assert.equal(dayKindOf(20747), 'weekday');
});

test('시간대가 바뀌면 다음 구간 경계부터 유효하고, 생활일 번호는 줄지 않는다', async () => {
  const { recordOffset, lifeDayAt, bandAt, bandsBetween, offsetAt } = await townModule('clock');
  const start = [{ fromMs: 0, offsetMin: 540 }];
  const now = localAt(540, 19, 0);
  const moved = recordOffset(start, now, -300);
  assert.equal(moved.length, 2);
  assert.equal(moved[1].fromMs, localAt(540, 21, 0), '저녁 구간이 끝나는 21:00(한국)부터');
  assert.equal(offsetAt(moved, now), 540, '이미 시작한 구간은 그대로');
  assert.deepEqual(bandsBetween(moved, localAt(540, 5, 0), now), bandsBetween(start, localAt(540, 5, 0), now), '결산한 구간은 다시 만들지 않는다');
  // 서쪽으로 가면 내 시각이 뒤로 간다 — 같은 생활일이 두 번 생기지 않게 번호를 잡아 둔다.
  let last = -Infinity;
  for (let ms = now; ms < now + 3 * DAY; ms += 15 * MINUTE) {
    const day = lifeDayAt(moved, ms);
    assert.ok(day >= last, '생활일 번호는 줄지 않는다');
    last = day;
  }
  assert.equal(lifeDayAt(moved, moved[1].fromMs), 20748);
  assert.ok(bandAt(moved, moved[1].fromMs).startMs >= moved[1].fromMs, '바뀐 순간이 새 구간의 시작');
  assert.deepEqual(recordOffset(moved, now, 540), start, '바뀌기 전에 되돌리면 예약만 지운다');
  assert.deepEqual(recordOffset(start, now, 540), start, '같은 오프셋이면 그대로');
  let history = start;
  for (let i = 1; i <= 6; i++) history = recordOffset(history, now + i * DAY, i % 2 ? 480 : 540);
  assert.equal(history.length, 4, '기록은 최근 넷만');
  for (const bad of [541, 900, -735, 1.5]) assert.throws(() => recordOffset(start, now, bad), RangeError);
});

test('시간대가 다른 기기에서 같은 시계 값을 낸다', () => {
  const script = `import('./experiences/synk-town/town/clock.mjs').then(c => {
    const out = [];
    for (let i = 0; i < 48; i++) for (const tz of [540, 480, 420, -300]) out.push(c.clockAt({ villageSeed: 'tz-probe', hostNowMs: ${EXAMPLE} + i * 3700000, tz }));
    console.log(JSON.stringify({ out, tzName: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  });`;
  const runs = ['UTC', 'Asia/Seoul', 'America/Los_Angeles'].map(tz => runUnderTimezone(['--input-type=module', '-e', script], tz));
  assert.deepEqual(runs.map(r => r.tzName), ['UTC', 'Asia/Seoul', 'America/Los_Angeles']);
  assert.deepEqual(runs[1].out, runs[0].out);
  assert.deepEqual(runs[2].out, runs[0].out);
});
