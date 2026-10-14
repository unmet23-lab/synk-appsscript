import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, importBackup, draftMessage, generateCheckinDraft } from '../model.mjs';
import { memorialSchedule, markDeceased, unmarkDeceased, suggestMemorialEvents, addMemorialEvents, memorialNotice, callName, isDeceased } from '../care-memorial.mjs';
import { recommendCareFocus } from '../care-focus.mjs';
import { upcomingDays } from '../care-upcoming.mjs';

const NOW = '2026-10-14T10:00:00+09:00';
const one = (person = {}) => importBackup({ ...emptyState(), people: [makePerson({ id: 'p', name: '아버지', ...person })] });

test('49재는 돌아가신 날을 1일로 센 49일째, 기일은 양력·음력 다음 회차와 주기를 계산한다', () => {
  const schedule = memorialSchedule({ diedOn: '2026-09-01', now: NOW });
  assert.deepEqual(schedule.fortyNinth, { date: '2026-10-19', daysUntil: 5, passed: false, note: '돌아가신 날을 1일로 세어 49일째 되는 날이에요.' });
  assert.deepEqual(schedule.solar, { date: '2027-09-01', daysUntil: 322, nth: 1, eveDate: '2027-08-31' });
  assert.equal(schedule.lunar.lunarDate, '2026-07-20');
  assert.equal(schedule.lunar.label, '음력 7월 20일');
  assert.equal(schedule.lunar.next.nth, 1);
  assert.equal(schedule.lunar.next.lunarDate, '2027-07-20');
  assert.equal(schedule.daysSince, 43);
  assert.match(schedule.notes[0], /전날 밤이나 기일 저녁/);
  const older = memorialSchedule({ diedOn: '2019-10-20', now: NOW });
  assert.deepEqual([older.solar.date, older.solar.nth, older.fortyNinth.passed], ['2026-10-20', 7, true]);
});

test('돌아가신 바로 그날은 1주기가 아니라 다음 해를 기일로 보여 주고, 미래 날짜는 거절한다', () => {
  const sameDay = memorialSchedule({ diedOn: '2026-10-14', now: NOW });
  assert.deepEqual([sameDay.solar.date, sameDay.solar.nth, sameDay.fortyNinth.date], ['2027-10-14', 1, '2026-12-01']);
  assert.equal(sameDay.lunar.next.nth, 1);
  assert.throws(() => memorialSchedule({ diedOn: '2026-10-15', now: NOW }), /오늘보다 뒤/);
  assert.throws(() => memorialSchedule({ diedOn: '2026-02-30', now: NOW }), /YYYY-MM-DD/);
});

test('윤달에 돌아가신 경우 음력 기일은 윤달로 기록하고 평달로 지내는 안내를 붙인다', () => {
  const schedule = memorialSchedule({ diedOn: '2025-08-10', now: NOW });
  assert.deepEqual([schedule.lunar.lunarDate, schedule.lunar.leapMonth, schedule.lunar.label], ['2025-06-17', true, '음력 윤6월 17일']);
  assert.equal(schedule.lunar.next.leapMonth, false, '2027년에는 윤6월이 없어 평달');
  assert.match(schedule.notes.join(' '), /윤달이 없는 해에는 평달/);
});

test('고인 표시: 선택 칸만 더하고, 표시를 거두면 원래 모양으로 돌아온다', () => {
  const plain = one();
  assert.deepEqual(Object.keys(plain.people[0]).sort(), ['group', 'id', 'name', 'notes', 'recipientPreference', 'relationship', 'savedMessages', 'selfTone']);
  const marked = markDeceased(plain, 'p', { diedOn: '2020-10-16' }, NOW);
  assert.deepEqual([marked.people[0].deceased, marked.people[0].diedOn], [true, '2020-10-16']);
  assert.equal(isDeceased(marked.people[0]), true);
  assert.deepEqual(importBackup(JSON.parse(JSON.stringify(marked))).people[0], marked.people[0], '백업 왕복에서 유지');
  assert.deepEqual(unmarkDeceased(marked, 'p').people[0], plain.people[0]);
  assert.equal(markDeceased(plain, 'p', {}, NOW).people[0].diedOn, undefined, '돌아가신 날은 선택');
  assert.throws(() => markDeceased(plain, 'p', { diedOn: '2026-12-01' }, NOW), /오늘보다 뒤/);
  assert.throws(() => makePerson({ name: '이름', diedOn: '2020-01-01' }), /고인으로 표시한 뒤/);
  assert.throws(() => makePerson({ name: '이름', deceased: 'yes' }), /고인 표시/);
  const snoozed = importBackup({ ...plain, people: [makePerson({ ...plain.people[0], careSnooze: { on: '2026-10-14', until: '2026-10-17' } })] });
  assert.equal(Object.hasOwn(markDeceased(snoozed, 'p', {}, NOW).people[0], 'careSnooze'), false, '고인으로 표시하면 미루기를 지운다');
});

test('기일·49재 후보를 보여 주고, 고른 것만 일정으로 더하며 이미 있는 것은 빼 준다', () => {
  const state = markDeceased(one(), 'p', { diedOn: '2026-09-01' }, NOW);
  const lunar = suggestMemorialEvents(state, 'p', { calendar: 'lunar', now: NOW });
  assert.deepEqual(lunar.events.map(item => [item.key, item.title, item.date, item.calendar, item.repeat]),
    [['memorial-yearly', '기일', '2026-07-20', 'lunar', 'yearly'], ['forty-ninth', '49재', '2026-10-19', 'solar', 'none']]);
  assert.equal(state.events.length, 0, '후보만 보여 주고 저장하지 않는다');
  const added = addMemorialEvents(state, 'p', ['memorial-yearly', 'forty-ninth'], { calendar: 'lunar', now: NOW });
  assert.equal(added.events.length, 2);
  assert.equal(added.events[0].yearKnown, true);
  const again = suggestMemorialEvents(added, 'p', { calendar: 'lunar', now: NOW });
  assert.deepEqual(again.events, []);
  assert.deepEqual(again.skipped.map(item => item.key), ['memorial-yearly', 'forty-ninth']);
  assert.throws(() => addMemorialEvents(added, 'p', ['forty-ninth'], { now: NOW }), /이미 있거나/);
  const solar = suggestMemorialEvents(added, 'p', { calendar: 'solar', now: NOW });
  assert.deepEqual(solar.events.map(item => [item.key, item.date]), [['memorial-yearly', '2026-09-01']], '양력 기일은 따로 더할 수 있다');
  const days = upcomingDays(added, { now: NOW, days: 400 }).items;
  const fortyNinth = days.find(item => item.title === '49재');
  assert.deepEqual([fortyNinth.kindLabel, fortyNinth.tone, fortyNinth.jesa], ['49재', 'quiet', null]);
  assert.match(fortyNinth.notice, /^10월 19일은 아버지의 49재예요\./);
  assert.equal(days.find(item => item.title === '기일').nthLabel, '1주기');
  assert.throws(() => suggestMemorialEvents(one(), 'p', { now: NOW }), /고인으로 표시하고/);
  const passed = markDeceased(one(), 'p', { diedOn: '2020-01-01' }, NOW);
  assert.deepEqual(suggestMemorialEvents(passed, 'p', { now: NOW }).skipped.map(item => item.reason), ['49재가 이미 지났어요.']);
});

test('고인의 생일·기념일 문구에는 축하와 이모지를 넣지 않는다(이모지를 허용한 설정이어도)', () => {
  const person = makePerson({ id: 'p', name: '할머니', deceased: true, recipientPreference: { confirmed: true, allowEmoji: true, formality: 'casual', closingLine: '사랑해!' } });
  const birthday = makeEvent({ id: 'b', personId: 'p', type: 'birthday', date: '1940-03-01' });
  const draft = draftMessage(person, birthday, { approach: 'warm' });
  assert.doesNotMatch(draft.text, /축하|🎂|🙂|💐|!|사랑해/u);
  assert.match(draft.text, /^생전 생신을 맞아 고인을 함께 기억합니다\./);
  assert.match(draft.basis[0], /고인으로 표시한 분/);
  const anniversary = draftMessage(person, makeEvent({ id: 'a', personId: 'p', type: 'anniversary', date: '1960-05-05' }));
  assert.doesNotMatch(anniversary.text, /축하/);
  assert.doesNotMatch(generateCheckinDraft(person).text, /🙂|축하/u);
  const living = draftMessage(makePerson({ id: 'p', name: '할머니' }), birthday);
  assert.match(living.text, /생일 축하/, '고인 표시가 없으면 원래대로');
});

test('오늘의 한 사람: 고인에게는 일반 안부를 권하지 않고 고인의 날은 조용하게 보여 준다', () => {
  let state = importBackup({ ...emptyState(), people: [makePerson({ id: 'p', name: '아버지', deceased: true }), makePerson({ id: 'q', name: '친구' })] });
  const focus = recommendCareFocus({ state, now: NOW });
  assert.deepEqual([focus.recommendation.personId, focus.alternatives.length], ['q', 0]);
  state = importBackup({ ...state, events: [makeEvent({ id: 'b', personId: 'p', type: 'birthday', date: '1950-10-15' })] });
  const birthday = recommendCareFocus({ state, now: NOW }).recommendation;
  assert.deepEqual([birthday.personId, birthday.quiet, birthday.actionLabel], ['p', true, '조용한 문구 준비하기']);
});

test('조용한 안내 문장은 날짜 머리말과 받침을 맞추고 축하 표현을 쓰지 않는다', () => {
  const today = '2026-10-14';
  assert.equal(memorialNotice({ person: { name: '김영희' }, kind: 'memorial', date: '2026-10-14', today, nth: 2 }),
    '오늘은 김영희 님의 2주기 기일이에요. 제사는 집안에 따라 기일 전날 밤이나 기일 저녁에 지내요.');
  assert.equal(memorialNotice({ person: { name: '할아버지' }, kind: 'forty-ninth', date: '2026-10-15', today }), '내일은 할아버지의 49재예요. 조용히 마음을 모아도 괜찮아요.');
  assert.equal(memorialNotice({ person: { name: '김영희' }, kind: 'other', date: '2026-10-20', today, title: '결혼기념일' }),
    '10월 20일은 김영희 님과 함께 기억하는 결혼기념일이에요. 조용히 마음을 모아도 괜찮아요. 6일 남았어요.');
  assert.equal(memorialNotice({ person: { name: '어머니' }, kind: 'other', date: '2026-10-20', today, title: '추도' }).includes('어머니와 함께 기억하는 추도예요.'), true);
  assert.equal(callName({ name: '박선생님' }), '박선생님');
  for (const kind of ['memorial', 'forty-ninth', 'birthday', 'condolence', 'other']) {
    assert.doesNotMatch(memorialNotice({ person: { name: '누군가' }, kind, date: '2026-10-16', today }), /축하|!|\p{Extended_Pictographic}/u);
  }
});
