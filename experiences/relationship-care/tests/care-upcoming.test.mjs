import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, completeEvent, importBackup } from '../model.mjs';
import { lunarDateInYear, lunarMonthDays } from '../lunar.mjs';
import { upcomingDays, nextBirthday, ageOn, dDayLabel, upcomingSentence } from '../care-upcoming.mjs';

const NOW = '2026-10-14T03:00:00+09:00';
const notebook = (people, events) => importBackup({ ...emptyState(), people: people.map(makePerson), events: events.map(makeEvent) });
const kstNewYear = year => `${year}-01-01T00:00:00+09:00`;
const daysInYear = year => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 365 : 364;
/** 해마다 1월 1일~12월 31일 창으로 나눠 모든 회차를 모은다(창 경계에서 빠지거나 겹치지 않는지도 함께 본다). */
function collect(state, eventId, fromYear, toYear) {
  const found = new Map();
  for (let year = fromYear; year <= toYear; year++) {
    for (const item of upcomingDays(state, { now: kstNewYear(year), days: daysInYear(year) }).items) {
      if (item.eventId !== eventId) continue;
      assert.equal(item.date.slice(0, 4), String(year), '창 밖 날짜가 섞이지 않는다');
      assert.equal(found.has(item.occurrenceId), false, '같은 회차가 두 창에 겹치지 않는다');
      found.set(item.occurrenceId, item);
    }
  }
  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date));
}

test('연도를 아는 양력 생일은 만 나이·「○○번째 생신」·환갑을 붙이고, 연도를 모르면 나이를 붙이지 않는다', () => {
  const state = notebook([{ id: 'mom', name: '엄마', relationship: '어머니' }, { id: 'friend', name: '김민지', relationship: '친구' }],
    [{ id: 'mom-b', personId: 'mom', type: 'birthday', date: '1966-10-17', yearKnown: true },
      { id: 'friend-b', personId: 'friend', type: 'birthday', date: '2026-10-20' },
      { id: 'friend-known', personId: 'friend', type: 'anniversary', title: '첫 만남', date: '2016-10-21', yearKnown: true }]);
  const { items, today } = upcomingDays(state, { now: NOW, days: 30 });
  assert.equal(today, '2026-10-14');
  const mom = items.find(item => item.eventId === 'mom-b');
  assert.equal(mom.daysUntil, 3); assert.equal(mom.dDayLabel, 'D-3');
  assert.equal(mom.nth, 60); assert.equal(mom.nthLabel, '60번째 생신'); assert.equal(mom.milestone, '환갑');
  assert.equal(mom.ageToday, 59); assert.equal(mom.ageLabel, '만 59세');
  assert.equal(mom.emoji, '🎂'); assert.equal(mom.tone, 'celebrate'); assert.equal(mom.notice, null);
  assert.equal(mom.headline, '엄마 · 생일 · 60번째 생신 · 환갑');
  assert.equal(mom.dateLabel, '10월 17일 (토)');
  const friend = items.find(item => item.eventId === 'friend-b');
  assert.equal(friend.nth, null); assert.equal(friend.ageToday, null); assert.equal(friend.nthLabel, null);
  assert.equal(items.find(item => item.eventId === 'friend-known').nthLabel, '10주년');
  assert.deepEqual(items.map(item => item.eventId), ['mom-b', 'friend-b', 'friend-known'], 'D-day 순서');
  assert.equal(upcomingSentence(mom), '3일 뒤 엄마의 60번째 생신이에요.');
});

test('젊은 사람은 「생일」, 첫 생일은 「첫 돌」, 결혼 기념일은 「결혼 ○주년」으로 센다', () => {
  const state = notebook([{ id: 'kid', name: '하준', relationship: '조카' }, { id: 'p', name: '부모님', relationship: '부모님' }],
    [{ id: 'kid-b', personId: 'kid', type: 'birthday', date: '2025-11-01', yearKnown: true },
      { id: 'w', personId: 'p', type: 'anniversary', title: '결혼기념일', date: '1990-11-03', yearKnown: true },
      { id: 'kid-2', personId: 'kid', type: 'birthday', date: '2016-11-02', yearKnown: true }]);
  const items = upcomingDays(state, { now: NOW, days: 30 }).items;
  const first = items.find(item => item.eventId === 'kid-b');
  assert.equal(first.nthLabel, '첫 돌'); assert.equal(first.milestone, '첫 돌'); assert.equal(first.headline, '하준 · 생일 · 첫 돌');
  assert.equal(items.find(item => item.eventId === 'kid-2').nthLabel, '10번째 생일');
  assert.equal(items.find(item => item.eventId === 'w').nthLabel, '결혼 36주년');
});

test('칠순은 만 70세에 표시하고, 예전 나이로 셈하는 집을 위해 한 해 전에도 안내한다', () => {
  const state = notebook([{ id: 'a', name: '이모', relationship: '이모' }, { id: 'b', name: '고모', relationship: '고모' }],
    [{ id: 'a70', personId: 'a', type: 'birthday', date: '1956-10-20', yearKnown: true }, { id: 'b69', personId: 'b', type: 'birthday', date: '1957-10-20', yearKnown: true }]);
  const items = upcomingDays(state, { now: NOW, days: 10 }).items;
  const seventy = items.find(item => item.eventId === 'a70'), sixtyNine = items.find(item => item.eventId === 'b69');
  assert.equal(seventy.milestone, '칠순'); assert.match(seventy.milestoneNote, /한 해 이르게/);
  assert.equal(sixtyNine.milestone, null); assert.match(sixtyNine.milestoneNote, /예전 나이로 셈하면 올해가 칠순/);
});

test('음력 생일은 10년 동안 해마다 한 번씩 빠짐없이 생기고, 몇 번째 생신은 음력 해로 센다', () => {
  // 음력 12월 20일은 양력으로 다음 해 1~2월이라 양력 한 해에 0번이나 2번 올 수 있다. 음력 해 기준으로 빠짐이 없어야 한다.
  const state = notebook([{ id: 'grandma', name: '할머니', relationship: '할머니' }],
    [{ id: 'lunar-b', personId: 'grandma', type: 'birthday', date: '1946-12-20', calendar: 'lunar', yearKnown: true },
      { id: 'lunar-mid', personId: 'grandma', type: 'anniversary', title: '이사 온 날', date: '2000-03-15', calendar: 'lunar' }]);
  for (const [eventId, month, day] of [['lunar-b', 12, 20], ['lunar-mid', 3, 15]]) {
    const items = collect(state, eventId, 2026, 2037);
    const byLunarYear = new Map(items.map(item => [Number(item.lunar.date.slice(0, 4)), item]));
    for (let year = 2026; year <= 2035; year++) {
      const item = byLunarYear.get(year);
      assert.ok(item, `${eventId} 음력 ${year}년 회차가 있어요`);
      assert.equal(item.date, lunarDateInYear({ date: `${eventId === 'lunar-b' ? 1946 : 2000}-${String(month).padStart(2, '0')}-${day}` }, year).date);
      assert.equal(item.lunar.label, `음력 ${month}월 ${day}일`);
      assert.equal(item.calendar, 'lunar');
      if (eventId === 'lunar-b') { assert.equal(item.nth, year - 1946); assert.equal(item.nthLabel, `${year - 1946}번째 생신`); }
      else assert.equal(item.nth, null);
    }
    const lunarYears = items.map(item => Number(item.lunar.date.slice(0, 4)));
    assert.deepEqual(lunarYears, [...new Set(lunarYears)], '음력 해마다 한 번만');
  }
});

test('윤달 일정: 평달로 챙기기는 해마다, 윤달 해만은 그 윤달이 있는 해에만 생긴다', () => {
  // 2025년 음력 윤6월 17일(양력 2025-08-10). 다음 윤6월은 2036년이다.
  const state = notebook([{ id: 'p', name: '아버지', deceased: true, diedOn: '2025-08-10' }],
    [{ id: 'regular', personId: 'p', type: 'memorial', date: '2025-06-17', calendar: 'lunar', lunarLeapMonth: true, lunarLeapPolicy: 'regular', yearKnown: true },
      { id: 'leap-only', personId: 'p', type: 'memorial', title: '윤달 기일', date: '2025-06-17', calendar: 'lunar', lunarLeapMonth: true, lunarLeapPolicy: 'leap-only' }]);
  const regular = collect(state, 'regular', 2026, 2036);
  const years = regular.map(item => Number(item.lunar.date.slice(0, 4)));
  assert.deepEqual(years, [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036]);
  for (const item of regular) {
    const year = Number(item.lunar.date.slice(0, 4)), hasLeap = lunarMonthDays(year, 6, true) !== null;
    assert.equal(item.lunar.leapMonth, hasLeap);
    assert.equal(item.lunar.label, `음력 ${hasLeap ? '윤' : ''}6월 17일`);
    if (!hasLeap) assert.match(item.lunar.notes.join(' '), /윤달이 없어 평달/);
    assert.equal(item.nthLabel, `${year - 2025}주기`);
    assert.equal(item.tone, 'quiet'); assert.equal(item.emoji, null);
  }
  const leapOnly = collect(state, 'leap-only', 2026, 2036);
  assert.deepEqual(leapOnly.map(item => item.lunar.date), ['2036-06-17']);
  assert.equal(leapOnly[0].lunar.leapMonth, true);
});

test('음력 30일 일정: 30일이 없는 해에는 말일로 챙기거나 그 해를 건너뛴다', () => {
  const state = notebook([{ id: 'p', name: '친구' }],
    [{ id: 'last', personId: 'p', type: 'anniversary', date: '2026-01-30', calendar: 'lunar', lunarShortMonthPolicy: 'last-day' },
      { id: 'skip', personId: 'p', type: 'anniversary', title: '건너뛰는 날', date: '2026-01-30', calendar: 'lunar', lunarShortMonthPolicy: 'skip' }]);
  const last = collect(state, 'last', 2026, 2036).filter(item => Number(item.lunar.date.slice(0, 4)) <= 2035);
  assert.equal(last.length, 10);
  for (const item of last) {
    const year = Number(item.lunar.date.slice(0, 4)), full = lunarMonthDays(year, 1) === 30;
    assert.equal(item.lunar.label, `음력 1월 ${full ? 30 : 29}일`);
    assert.equal(item.lunar.notes.some(note => /29일까지라 29일로/.test(note)), !full);
  }
  const skip = collect(state, 'skip', 2026, 2036).filter(item => Number(item.lunar.date.slice(0, 4)) <= 2035);
  assert.deepEqual(skip.map(item => Number(item.lunar.date.slice(0, 4))), [2026, 2029, 2031, 2032, 2035]);
});

test('2월 29일 생일: 평년에는 기존 규칙대로 2월 28일(기본) 또는 3월 1일에 챙기고 나이도 그날 더한다', () => {
  const state = notebook([{ id: 'p', name: '윤일생' }],
    [{ id: 'feb28', personId: 'p', type: 'birthday', date: '2000-02-29', yearKnown: true },
      { id: 'mar1', personId: 'p', type: 'birthday', title: '3월 1일로', date: '2000-02-29', yearKnown: true, leapDayPolicy: 'mar1' }]);
  const in2027 = upcomingDays(state, { now: '2027-02-20T12:00:00+09:00', days: 20 }).items;
  assert.equal(in2027.find(item => item.eventId === 'feb28').date, '2027-02-28');
  assert.equal(in2027.find(item => item.eventId === 'mar1').date, '2027-03-01');
  assert.equal(in2027.find(item => item.eventId === 'feb28').nthLabel, '27번째 생일');
  const in2028 = upcomingDays(state, { now: '2028-02-20T12:00:00+09:00', days: 20 }).items;
  assert.deepEqual(in2028.map(item => item.date), ['2028-02-29', '2028-02-29']);
  assert.equal(ageOn('2000-02-29', '2027-02-27'), 26);
  assert.equal(ageOn('2000-02-29', '2027-02-28'), 27);
  assert.equal(ageOn('2000-02-29', '2027-02-28', 'mar1'), 26);
  assert.equal(ageOn('2000-02-29', '2027-03-01', 'mar1'), 27);
  assert.equal(ageOn('2000-02-29', '2028-02-28'), 27);
  assert.equal(ageOn('2000-02-29', '2028-02-29'), 28);
});

test('연말 경계: 한국 시간 자정을 기준으로 오늘·내일과 새해의 나이를 정한다', () => {
  const state = notebook([{ id: 'p', name: '새해생', relationship: '친구' }],
    [{ id: 'ny', personId: 'p', type: 'birthday', date: '1990-01-01', yearKnown: true }, { id: 'dec', personId: 'p', type: 'anniversary', title: '연말 모임', date: '2015-12-31', yearKnown: true }]);
  const beforeMidnight = upcomingDays(state, { now: '2026-12-31T14:59:59Z', days: 3 });
  assert.equal(beforeMidnight.today, '2026-12-31');
  const ny = beforeMidnight.items.find(item => item.eventId === 'ny');
  assert.equal(ny.date, '2027-01-01'); assert.equal(ny.dDayLabel, '내일'); assert.equal(ny.nth, 37); assert.equal(ny.ageToday, 36);
  assert.equal(ny.dateLabel, '2027년 1월 1일 (금)');
  assert.equal(beforeMidnight.items.find(item => item.eventId === 'dec').dDayLabel, '오늘');
  const afterMidnight = upcomingDays(state, { now: '2026-12-31T15:00:00Z', days: 3 });
  assert.equal(afterMidnight.today, '2027-01-01');
  const nyToday = afterMidnight.items.find(item => item.eventId === 'ny');
  assert.equal(nyToday.dDayLabel, '오늘'); assert.equal(nyToday.ageToday, 37);
  assert.equal(afterMidnight.items.some(item => item.eventId === 'dec'), false);
  const across = upcomingDays(state, { now: '2026-12-20T09:00:00+09:00', days: 30 }).items.map(item => item.date);
  assert.deepEqual(across, ['2026-12-31', '2027-01-01']);
});

test('긴 창에서는 매년 일정이 두 번 나오고, 이미 챙긴 회차는 표시만 하거나 뺄 수 있다', () => {
  let state = notebook([{ id: 'p', name: '친구' }], [{ id: 'b', personId: 'p', type: 'birthday', date: '1990-10-20' }]);
  assert.deepEqual(upcomingDays(state, { now: NOW, days: 400 }).items.map(item => item.date), ['2026-10-20', '2027-10-20']);
  state = completeEvent(state, 'b', NOW, 'b:2026-10-20');
  const shown = upcomingDays(state, { now: NOW, days: 30 });
  assert.equal(shown.items[0].completed, true); assert.equal(shown.counts.completed, 1);
  assert.equal(upcomingDays(state, { now: NOW, days: 30, includeCompleted: false }).items.length, 0);
  assert.equal(nextBirthday(state, { now: NOW }).date, '2027-10-20');
});

test('미리 알림 날짜와 다음 알림 예정일을 함께 돌려준다', () => {
  const state = notebook([{ id: 'p', name: '친구' }], [{ id: 'b', personId: 'p', type: 'birthday', date: '1990-10-18', reminderDays: [7, 1, 0] }]);
  const item = upcomingDays(state, { now: NOW, days: 30 }).items[0];
  assert.deepEqual(item.reminders.map(row => [row.daysBefore, row.date, row.passed]), [[7, '2026-10-11', true], [1, '2026-10-17', false], [0, '2026-10-18', false]]);
  assert.equal(item.nextReminderOn, '2026-10-17');
  assert.equal(item.reminderDue, false);
});

test('고인의 생일은 「생전 생신」으로 조용히 보여 주고 축하·이모지·나이를 붙이지 않는다', () => {
  const state = notebook([{ id: 'dad', name: '아버지', deceased: true, diedOn: '2023-10-20' }],
    [{ id: 'db', personId: 'dad', type: 'birthday', date: '1955-10-20', yearKnown: true }, { id: 'dm', personId: 'dad', type: 'memorial', date: '2023-10-20', yearKnown: true }]);
  const items = upcomingDays(state, { now: NOW, days: 10 }).items;
  const birthday = items.find(item => item.eventId === 'db');
  assert.equal(birthday.kindLabel, '생전 생신'); assert.equal(birthday.tone, 'quiet'); assert.equal(birthday.emoji, null);
  assert.equal(birthday.nth, null); assert.equal(birthday.ageLabel, null);
  assert.match(birthday.notice, /생전 생신이에요\. 조용히 기억해도 괜찮아요/); assert.doesNotMatch(birthday.notice, /축하|🎂|!/u);
  const memorial = items.find(item => item.eventId === 'dm');
  assert.equal(memorial.nthLabel, '3주기'); assert.deepEqual(memorial.jesa, { eveDate: '2026-10-19', date: '2026-10-20', note: '제사는 집안에 따라 기일 전날 밤이나 기일 저녁에 지내요.' });
  assert.match(memorial.notice, /^10월 20일은 아버지의 3주기 기일이에요\./);
  assert.equal(nextBirthday(state, { now: NOW }), null, '고인의 생전 생신은 가장 가까운 생일에서 뺀다');
});

test('부고·기일·결혼 일회성 일정과 범위 검사', () => {
  const state = notebook([{ id: 'p', name: '동료' }],
    [{ id: 'c', personId: 'p', type: 'condolence', title: '부친상', date: '2026-10-15' }, { id: 'w', personId: 'p', type: 'wedding', date: '2026-11-07' }]);
  const items = upcomingDays(state, { now: NOW, days: 30 }).items;
  assert.equal(items[0].tone, 'quiet'); assert.match(items[0].notice, /^내일은 기억해 둔 부친상 날이에요/);
  assert.equal(items[1].emoji, '💍'); assert.equal(items[1].nth, null);
  assert.equal(upcomingDays(state, { now: NOW, days: 30, types: ['wedding'] }).items.length, 1);
  assert.throws(() => upcomingDays(state, { now: NOW, days: 731 }), /0~730일/);
  assert.throws(() => upcomingDays(state, { now: NOW, types: ['party'] }), /일정 종류/);
  assert.equal(dDayLabel(0), '오늘'); assert.equal(dDayLabel(1), '내일'); assert.equal(dDayLabel(12), 'D-12');
});
