import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, importBackup, addFollowup, recordCareAction } from '../model.mjs';
import { todayCards, recordTodayContact, snoozeTodayCard, clearTodaySnooze, TODAY_ACTIONS } from '../care-today.mjs';
import { buildCareContext } from '../care-context.mjs';

const NOW = '2026-10-14T10:00:00+09:00';
const at = (day, time = '10:00:00') => `${day}T${time}+09:00`;
const people = (...ids) => importBackup({ ...emptyState(), people: ids.map(id => makePerson({ id, name: `사람${id}` })) });
const withEvent = (state, input) => importBackup({ ...state, events: [...state.events, makeEvent(input)] });
const ids = result => result.cards.map(card => card.personId);

test('하루 카드는 최대 3명이고, 챙긴 사람은 바로 빠지며 빈자리를 다른 사람으로 채우지 않는다', () => {
  let state = people('a', 'b', 'c', 'd', 'e');
  const first = todayCards({ state, now: NOW });
  assert.equal(first.status, 'ready'); assert.equal(first.cards.length, 3); assert.equal(first.waiting, 2);
  const [one, two, three] = first.cards;
  assert.equal(one.kind, 'checkin'); assert.equal(one.lastCareLabel, '아직 챙김 기록이 없어요');
  assert.deepEqual(one.actions.map(item => item.how), ['call', 'message', 'meet', 'gift']);
  state = recordTodayContact(state, { personId: one.personId, how: 'call' }, NOW);
  const after = todayCards({ state, now: NOW });
  assert.deepEqual(ids(after), [two.personId, three.personId], '네 번째 사람이 끼어들지 않는다');
  assert.deepEqual(after.handled, [{ personId: one.personId, personName: one.personName, how: 'cared' }]);
  state = recordTodayContact(state, { personId: two.personId, how: 'message' }, NOW);
  state = recordTodayContact(state, { personId: three.personId, how: 'meet' }, NOW);
  const done = todayCards({ state, now: NOW });
  assert.equal(done.status, 'done-for-today'); assert.equal(done.cards.length, 0); assert.match(done.message, /여기까지/);
  const tomorrow = todayCards({ state, now: at('2026-10-15') });
  assert.equal(tomorrow.cards.length, 2, '다음 날에는 남은 두 사람이 다시 보인다');
  assert.equal(tomorrow.cards.some(card => [one.personId, two.personId, three.personId].includes(card.personId)), false);
});

test('「연락했어요」는 연락 방법과 함께 오늘 기록을 남겨 그 사람의 안부 주기를 다시 시작한다', () => {
  let state = importBackup({ ...emptyState(), people: [makePerson({ id: 'a', name: '민지', checkinIntervalDays: 14 })] });
  state = recordTodayContact(state, { personId: 'a', how: 'call', note: '목소리 들었어요' }, NOW);
  const activity = state.activities.at(-1);
  assert.deepEqual({ kind: activity.kind, channel: activity.channel, occurredOn: activity.occurredOn, direction: activity.direction, note: activity.note },
    { kind: 'contact', channel: 'call', occurredOn: '2026-10-14', direction: 'sent', note: '목소리 들었어요' });
  assert.equal(todayCards({ state, now: at('2026-10-27') }).cards.length, 0, '14일이 지나기 전에는 다시 권하지 않는다');
  const again = todayCards({ state, now: at('2026-10-28') });
  assert.equal(again.cards[0].personId, 'a');
  assert.equal(again.cards[0].lastCareLabel, '마지막 챙김 10월 14일 (수) · 14일 전');
  assert.equal(again.cards[0].checkinIntervalDays, 14);
  state = recordTodayContact(state, { personId: 'a', how: 'gift', item: '핸드크림', amountWon: 15000 }, at('2026-10-28'));
  assert.deepEqual([state.activities.at(-1).kind, state.activities.at(-1).item, state.activities.at(-1).amountWon, state.activities.at(-1).channel], ['gift', '핸드크림', 15000, undefined]);
  assert.throws(() => recordTodayContact(state, { personId: 'a', how: 'fax' }, NOW), /어떻게 챙겼는지/);
  assert.throws(() => recordTodayContact(state, { personId: 'a', how: 'call', extra: 1 }, NOW), /형식/);
  assert.deepEqual(Object.keys(TODAY_ACTIONS), ['call', 'message', 'meet', 'gift', 'remember']);
});

test('오늘이 그날인 일정 카드는 칸 수·미루기와 상관없이 보이고, 연락하면 그 회차가 완료된다', () => {
  let state = withEvent(people('a', 'b', 'c', 'd'), { id: 'bd', personId: 'd', type: 'birthday', date: '1990-10-14', yearKnown: true });
  for (const id of ['a', 'b', 'c']) state = recordTodayContact(state, { personId: id, how: 'message' }, NOW);
  const result = todayCards({ state, now: NOW });
  assert.equal(result.cards.length, 1);
  const card = result.cards[0];
  assert.deepEqual([card.personId, card.kind, card.dueToday, card.dDayLabel, card.nthLabel, card.emoji, card.canSnooze], ['d', 'event', true, '오늘', '36번째 생일', '🎂', false]);
  assert.throws(() => snoozeTodayCard(state, { personId: 'd', eventId: 'bd', occurrenceId: card.occurrenceId }, NOW), /오늘이 그날이라/);
  state = recordTodayContact(state, { personId: 'd', how: 'call', eventId: 'bd', occurrenceId: card.occurrenceId }, NOW);
  assert.equal(state.completions.at(-1).occurrenceId, 'bd:2026-10-14');
  assert.equal(state.activities.at(-1).eventId, 'bd');
  assert.equal(state.activities.at(-1).createdAt, state.completions.at(-1).completedAt, '연락 맥락이 한 번으로 묶을 수 있게 같은 시각');
  const context = buildCareContext(state, { personId: 'd', today: '2026-10-14' });
  assert.equal(context.lastCare.sourceKind, 'activity');
  assert.equal(todayCards({ state, now: NOW }).status, 'done-for-today');
  const twice = recordTodayContact(state, { personId: 'd', how: 'call', eventId: 'bd', occurrenceId: card.occurrenceId }, NOW);
  assert.equal(twice.activities.length, state.activities.length, '두 번 눌러도 기록이 늘지 않는다');
});

test('「3일 뒤에」는 그 사람을 사흘 동안 빼고, 오늘 칸을 쓴 것으로 센다', () => {
  let state = people('a', 'b', 'c', 'd');
  const first = todayCards({ state, now: NOW });
  const target = first.cards[0];
  assert.deepEqual([target.canSnooze, target.snoozeUntil], [true, '2026-10-17']);
  state = snoozeTodayCard(state, { personId: target.personId }, NOW);
  assert.deepEqual(state.people.find(person => person.id === target.personId).careSnooze, { on: '2026-10-14', until: '2026-10-17' });
  const today = todayCards({ state, now: NOW });
  assert.equal(today.cards.length, 2, '미룬 자리도 오늘 칸으로 센다');
  assert.equal(today.cards.some(card => card.personId === target.personId), false);
  assert.deepEqual(today.snoozed.map(item => [item.personId, item.until]), [[target.personId, '2026-10-17']]);
  assert.equal(todayCards({ state, now: at('2026-10-16') }).cards.some(card => card.personId === target.personId), false);
  assert.equal(todayCards({ state, now: at('2026-10-17') }).cards.some(card => card.personId === target.personId), true);
  const cleared = clearTodaySnooze(state, target.personId);
  assert.equal(Object.hasOwn(cleared.people.find(person => person.id === target.personId), 'careSnooze'), false);
  assert.throws(() => snoozeTodayCard(state, { personId: 'a', days: 0 }, NOW), /1~14일/);
  // 연락을 남기면 미룬 표시도 지운다.
  const contacted = recordTodayContact(state, { personId: target.personId, how: 'call' }, at('2026-10-15'));
  assert.equal(Object.hasOwn(contacted.people.find(person => person.id === target.personId), 'careSnooze'), false);
});

test('미뤄 둔 사이에 그날이 되는 일정은 그날 다시 보이고, 후속 카드를 미루면 후속 날짜도 옮긴다', () => {
  let state = withEvent(people('a'), { id: 'bd', personId: 'a', type: 'birthday', date: '1990-10-16' });
  assert.equal(todayCards({ state, now: NOW }).cards[0].kind, 'event');
  state = snoozeTodayCard(state, { personId: 'a', eventId: 'bd', occurrenceId: 'bd:2026-10-16' }, NOW);
  assert.equal(todayCards({ state, now: at('2026-10-15') }).cards.length, 0);
  const onTheDay = todayCards({ state, now: at('2026-10-16') });
  assert.deepEqual([onTheDay.cards[0].kind, onTheDay.cards[0].dueToday], ['event', true]);

  let follow = addFollowup(people('f'), { personId: 'f', title: '이사 잘 했는지 묻기', dueOn: '2026-10-14' }, at('2026-10-01'));
  const card = todayCards({ state: follow, now: NOW }).cards[0];
  assert.deepEqual([card.kind, card.date, card.dDayLabel], ['followup', '2026-10-14', '오늘']);
  follow = snoozeTodayCard(follow, { personId: 'f', followupId: card.followupId }, NOW);
  assert.equal(follow.followups[0].dueOn, '2026-10-17');
  assert.equal(follow.followups[0].status, 'pending');
  const later = todayCards({ state: follow, now: at('2026-10-17') }).cards[0];
  assert.deepEqual([later.kind, later.followupId], ['followup', card.followupId]);
  follow = recordTodayContact(follow, { personId: 'f', how: 'message', followupId: card.followupId }, at('2026-10-17'));
  assert.equal(follow.followups[0].status, 'done');
  assert.equal(todayCards({ state: follow, now: at('2026-10-17') }).status, 'done-for-today');
});

test('고인에게는 일반 안부 카드를 내지 않고, 기일 카드는 조용한 단추를 먼저 보여 준다', () => {
  let state = importBackup({ ...emptyState(), people: [makePerson({ id: 'dad', name: '아버지', deceased: true, diedOn: '2020-10-16' })] });
  assert.equal(todayCards({ state, now: NOW }).status, 'caught-up', '기록이 없어도 고인에게 「첫 안부」를 권하지 않는다');
  state = withEvent(state, { id: 'm', personId: 'dad', type: 'memorial', date: '2020-10-16', yearKnown: true });
  state = withEvent(state, { id: 'b', personId: 'dad', type: 'birthday', date: '1950-10-15' });
  const card = todayCards({ state, now: NOW }).cards[0];
  assert.equal(card.quiet, true); assert.equal(card.emoji, null);
  assert.equal(card.actions[0].how, 'remember');
  assert.match(card.notice, /생전 생신|기일/);
  state = recordTodayContact(state, { personId: 'dad', how: 'remember', eventId: card.eventId, occurrenceId: card.occurrenceId }, NOW);
  assert.equal(state.completions.at(-1).action, 'remembered');
  assert.equal(state.activities.at(-1).kind, 'remember');
});

test('받은 기록이나 미래 시계 기록은 오늘 챙긴 것으로 세지 않고, 사람이 없으면 empty', () => {
  assert.equal(todayCards({ state: emptyState(), now: NOW }).status, 'empty');
  let state = people('a');
  state = recordCareAction(state, { personId: 'a', kind: 'gift', direction: 'received', occurredOn: '2026-10-14', item: '과일' }, NOW);
  const result = todayCards({ state, now: NOW });
  assert.equal(result.handled.length, 0);
  assert.throws(() => todayCards({ state, now: NOW, limit: 9 }), /1~5명/);
});

test('새 칸을 쓰지 않은 옛 수첩은 모양이 그대로다', () => {
  const state = people('a', 'b');
  const next = recordTodayContact(state, { personId: 'a', how: 'call' }, NOW);
  assert.deepEqual(Object.keys(next.people[1]).sort(), Object.keys(state.people[1]).sort());
  assert.equal(Object.hasOwn(next.people[0], 'careSnooze'), false);
});
