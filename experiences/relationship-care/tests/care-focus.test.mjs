import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, makePerson, makeEvent, importBackup, recordCareAction, completeEvent,
  recordDraft, recordPreparation, addFollowup, updateFollowup,
} from '../model.mjs';
import { recommendCareFocus } from '../care-focus.mjs';

const NOW = '2026-10-07T03:00:00.000Z';
const dayClock = day => `${day}T02:00:00.000Z`;
function fixture(...ids) {
  return { ...emptyState(), people: ids.map(id => makePerson({ id, name: `사람 ${id}` })) };
}
function event(state, id, personId, date, extra = {}) {
  return { ...state, events: [...state.events, makeEvent({ id, personId, date, ...extra })] };
}
function activity(state, personId, occurredOn, extra = {}, at = dayClock(occurredOn)) {
  return recordCareAction(state, { personId, kind: 'contact', occurredOn, ...extra }, at);
}
function followup(state, personId, dueOn, id = `follow_${personId}`, at = '2026-09-01T02:00:00.000Z') {
  const next = addFollowup(state, { personId, title: `${personId}에게 직접 약속한 안부`, dueOn }, at);
  return { ...next, followups: next.followups.map((item, index) => index === next.followups.length - 1 ? { ...item, id } : item) };
}
const focus = (state, now = NOW) => recommendCareFocus({ state, now });
const choices = result => [result.recommendation, ...result.alternatives].filter(Boolean);
const pick = state => focus(state).recommendation;

test('내가 정한 다음 챙김 날짜 전에는 일반 안부로 다시 재촉하지 않는다', () => {
  const pending = followup(fixture('a'), 'a', '2026-10-07');
  const postponed = updateFollowup(pending, 'follow_a', { dueOn: '2026-10-08' }, NOW);
  assert.equal(focus(postponed).status, 'caught-up');
  assert.equal(focus(postponed, '2026-10-08T03:00:00Z').recommendation.followupId, 'follow_a');
  const withBirthday = event(postponed, 'birthday', 'a', '2026-10-07');
  assert.equal(pick(withBirthday).eventId, 'birthday');
});

test('직접 챙겼다고 완료한 후속은 같은 사람에게 첫 안부를 다시 권하지 않는다', () => {
  const pending = followup(fixture('a'), 'a', '2026-10-07');
  const done = updateFollowup(pending, 'follow_a', { status: 'done' }, NOW);
  assert.equal(focus(done).status, 'caught-up');
  const dismissed = updateFollowup(pending, 'follow_a', { status: 'dismissed' }, NOW);
  assert.equal(pick(dismissed).kind, 'checkin');
  assert.match(pick(dismissed).reason, /아직/);
});

test('완료한 후속은 실제 완료일을 쓰고 미래 완료 시각은 챙김으로 세지 않는다', () => {
  const pending = followup(fixture('a'), 'a', '2026-12-01');
  const done = updateFollowup(pending, 'follow_a', { status: 'done' }, '2026-09-01T15:00:00Z');
  assert.match(pick(done).reason, /2026-09-02\(35일 전\)/);
  const future = updateFollowup(pending, 'follow_a', { status: 'done' }, '2026-10-08T00:00:00Z');
  assert.match(pick(future).reason, /아직/);
});
function deepFreeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
}

test('빈 수첩은 빈 상태이며 사람을 만들거나 챙김 기록을 저장하지 않는다', () => {
  const state = emptyState(), before = structuredClone(state), result = focus(state);
  assert.equal(result.status, 'empty');
  assert.equal(result.recommendation, null);
  assert.deepEqual(result.alternatives, []);
  assert.deepEqual(state, before);
});

test('잘못된 기준 시간이나 잘못 연결된 기록은 추천 전에 거부한다', () => {
  for (const now of ['not-a-date', new Date(NaN), '1899-12-30T03:00:00Z', '2200-01-01T03:00:00Z']) assert.throws(() => focus(fixture('a'), now));
  assert.throws(() => focus(null));
  const wrongPerson = event(fixture('a'), 'e', 'missing', '2026-10-07');
  assert.throws(() => focus(wrongPerson));
});

test('챙김 기록이 없는 사람은 연락이 뜸했다고 추정하지 않고 선택 이유를 설명한다', () => {
  const result = focus(fixture('a'));
  assert.equal(result.status, 'ready');
  assert.equal(result.recommendation.personId, 'a');
  assert.equal(result.recommendation.eventId, '');
  assert.equal(result.recommendation.followupId, '');
  assert.ok(result.recommendation.reason.trim());
  assert.doesNotMatch(`${result.recommendation.reason} ${result.recommendation.detail}`, /오랫동안 연락|연락(?:을)? 안 한|연락이 뜸|관계가 소원|마지막 연락/);
});

test('당일 일정, 도래한 후속 챙김, 7일 안 일정, 오래된 실제 기록 순서로 제안한다', () => {
  let state = fixture('today', 'due', 'soon', 'old', 'unknown');
  state = event(state, 'today_event', 'today', '1990-10-07');
  state = event(state, 'soon_event', 'soon', '2026-10-14', { type: 'wedding' });
  state = followup(state, 'due', '2026-10-01');
  state = activity(state, 'old', '2026-08-01');
  const first = focus(state);
  assert.equal(first.recommendation.personId, 'today');
  assert.equal(first.recommendation.eventId, 'today_event');
  state = { ...state, people: state.people.filter(item => item.id !== 'today'), events: state.events.filter(item => item.personId !== 'today') };
  assert.equal(pick(state).followupId, 'follow_due');
  state = { ...state, followups: [] };
  assert.equal(pick(state).eventId, 'soon_event');
  state = { ...state, events: [] };
  assert.equal(pick(state).personId, 'old');
});

test('후속 챙김은 도래한 pending 항목만 고르고 완료·보류·미래 날짜는 뺀다', () => {
  let state = fixture('pending', 'done', 'dismissed', 'future');
  for (const id of state.people.map(item => item.id)) state = activity(state, id, '2026-10-06');
  state = followup(state, 'pending', '2026-10-07');
  state = followup(state, 'done', '2026-10-01');
  state = updateFollowup(state, 'follow_done', { status: 'done' }, NOW);
  state = followup(state, 'dismissed', '2026-10-01');
  state = updateFollowup(state, 'follow_dismissed', { status: 'dismissed' }, NOW);
  state = followup(state, 'future', '2026-10-08');
  assert.deepEqual(choices(focus(state)).map(item => item.followupId), ['follow_pending']);
});

test('미래에 생성되었거나 수정된 후속 기록은 도래한 날짜라도 추천하지 않는다', () => {
  for (const field of ['createdAt', 'updatedAt']) {
    let state = activity(fixture('a'), 'a', '2026-10-06');
    state = followup(state, 'a', '2026-10-01');
    const future = '2026-10-08T02:00:00.000Z';
    state.followups[0][field] = future;
    if (field === 'createdAt') state.followups[0].updatedAt = future;
    assert.equal(focus(importBackup(state)).status, 'caught-up', field);
  }
});

test('오늘부터 7일까지는 일정 후보에 넣고 8일 뒤 일정은 아직 제안하지 않는다', () => {
  let state = fixture('seven', 'eight');
  state = activity(activity(state, 'seven', '2026-10-06'), 'eight', '2026-10-06');
  state = event(event(state, 'in_seven', 'seven', '2026-10-14'), 'in_eight', 'eight', '2026-10-15');
  assert.deepEqual(choices(focus(state)).map(item => item.eventId), ['in_seven']);
});

test('한국 날짜가 바뀌는 시각에 오늘 일정이 바로 우선순위가 된다', () => {
  let state = event(fixture('a'), 'midnight', 'a', '2026-10-07');
  state = followup(state, 'a', '2026-10-06');
  assert.equal(focus(state, '2026-10-06T14:59:59Z').recommendation.followupId, 'follow_a');
  assert.equal(focus(state, '2026-10-06T15:00:00Z').recommendation.eventId, 'midnight');
});

test('일회성 지난 일정과 아직 시작 연도가 오지 않은 연간 일정은 소급 추천하지 않는다', () => {
  let state = activity(fixture('a'), 'a', '2026-10-06');
  state = event(state, 'past', 'a', '2026-10-06', { type: 'wedding' });
  state = event(state, 'future_origin', 'a', '2027-10-07');
  assert.equal(focus(state).status, 'caught-up');
});

test('음력 일정은 저장한 음력 문자열 대신 실제 양력 회차로 제안한다', () => {
  const state = event(fixture('a'), 'lunar', 'a', '2026-08-30', { calendar: 'lunar' });
  const recommendation = pick(state);
  assert.equal(recommendation.eventId, 'lunar');
  assert.equal(recommendation.occurrenceId, 'lunar:2026-10-10');
});

test('윤년 생일의 다음 회차는 사용자가 정한 2월 28일 정책을 따른다', () => {
  const state = event(fixture('a'), 'leap', 'a', '2000-02-29');
  assert.equal(focus(state, '2027-02-28T03:00:00Z').recommendation.occurrenceId, 'leap:2027-02-28');
});

test('이미 완료한 연간 회차는 다시 추천하지 않으며 오늘의 챙김으로 남는다', () => {
  for (const action of ['contacted', 'remembered']) {
    let state = event(fixture('a'), 'birthday', 'a', '1990-10-07');
    state = completeEvent(state, 'birthday', NOW, 'birthday:2026-10-07', { action });
    assert.equal(focus(state).status, 'caught-up', action);
    assert.equal(focus(state).recommendation, null, action);
  }
});

test('다음 해 일정까지 미리 완료해도 완료 사실의 시각을 최근 챙김의 기준으로 쓴다', () => {
  let state = event(fixture('a'), 'future_event', 'a', '2027-04-01');
  state = completeEvent(state, 'future_event', '2026-09-01T03:00:00Z');
  const recommendation = pick(state);
  assert.equal(recommendation.personId, 'a');
  assert.equal(recommendation.eventId, '');
  assert.match(recommendation.reason, /2026[.\-/년 ]+0?9[.\-/월 ]+0?1/);
  assert.doesNotMatch(recommendation.reason, /2027/);
});

test('실제 챙김은 방법과 주고받은 방향에 관계없이 최근 기록으로 인정한다', () => {
  for (const kind of ['contact', 'attend', 'gift', 'money', 'remember']) {
    for (const direction of ['sent', 'received']) {
      const state = activity(fixture('a'), 'a', '2026-10-06', { kind, direction });
      assert.equal(focus(state).status, 'caught-up', `${kind}/${direction}`);
    }
  }
});

test('초안 복사와 준비 화면 확인만으로 실제 챙김을 했다고 판단하지 않는다', () => {
  let state = fixture('a');
  state = recordDraft(state, { personId: 'a', eventId: '', eventType: 'checkin', text: '안부 초안만 복사했어요.' }, NOW);
  state = recordPreparation(state, { personId: 'a', eventId: '', recommendedAction: 'contact' }, NOW);
  const result = focus(state);
  assert.equal(result.status, 'ready');
  assert.equal(result.recommendation.personId, 'a');
  assert.doesNotMatch(result.recommendation.reason, /2026[.\-/년 ]+10/);
});

test('30일 경계는 실제 챙긴 한국 날짜로 판단하고 29일 이내에는 일반 안부를 재촉하지 않는다', () => {
  const twentyNine = activity(fixture('a'), 'a', '2026-09-08');
  const thirty = activity(fixture('a'), 'a', '2026-09-07');
  assert.equal(focus(twentyNine).status, 'caught-up');
  assert.equal(focus(thirty).status, 'ready');
  assert.equal(pick(thirty).personId, 'a');
});

test('배열 순서와 저장 시각이 아니라 실제 챙긴 날짜가 가장 최신인 기록을 쓴다', () => {
  let state = activity(fixture('a'), 'a', '2026-09-01');
  state = activity(state, 'a', '2026-10-06');
  state = activity(state, 'a', '2026-08-01', {}, NOW);
  assert.equal(focus(state).status, 'caught-up');
  assert.equal(focus({ ...state, activities: [...state.activities].reverse() }).status, 'caught-up');
  const onlyOld = { ...state, activities: [state.activities[2]] };
  assert.equal(focus(onlyOld).status, 'ready');
  assert.match(pick(onlyOld).reason, /2026[.\-/년 ]+0?8[.\-/월 ]+0?1/);
});

test('최근 완료와 활동을 함께 비교하고 더 오래된 기록이 최신 사실을 가리지 않는다', () => {
  let state = event(fixture('a'), 'anniversary', 'a', '2026-08-01');
  state = completeEvent(state, 'anniversary', '2026-08-01T03:00:00Z');
  state = activity(state, 'a', '2026-10-06');
  assert.equal(focus(state).status, 'caught-up');
  state = { ...state, completions: [{ ...state.completions[0], completedAt: '2026-10-07T02:00:00.000Z' }], activities: [state.activities[0]] };
  assert.equal(focus(importBackup(state)).status, 'caught-up');
});

test('완료 시각도 UTC 날짜가 아닌 한국 날짜로 30일 경계를 판단한다', () => {
  const state = event(fixture('a'), 'annual', 'a', '2026-09-07');
  const thirty = completeEvent(state, 'annual', '2026-09-07T14:59:59Z');
  const twentyNine = completeEvent(state, 'annual', '2026-09-07T15:00:00Z');
  assert.equal(focus(thirty).status, 'ready');
  assert.equal(focus(twentyNine).status, 'caught-up');
});

test('미래 활동 시각과 미래 완료 시각은 현재 기록을 숨기거나 오늘 회차를 완료시키지 않는다', () => {
  for (const occurredOn of ['2026-10-07', '2026-10-08']) {
    const state = activity(fixture('a'), 'a', occurredOn, {}, '2026-10-08T02:00:00.000Z');
    assert.equal(focus(state).status, 'ready', occurredOn);
  }
  let state = event(fixture('a'), 'birthday', 'a', '1990-10-07');
  state = completeEvent(state, 'birthday', '2026-10-07T10:00:00.000Z');
  assert.equal(pick(state).occurrenceId, 'birthday:2026-10-07');
});

test('같은 한국 날짜 안의 아직 오지 않은 활동 시각도 최근 챙김으로 인정하지 않는다', () => {
  const state = activity(fixture('a'), 'a', '2026-10-07', {}, '2026-10-07T04:00:00.000Z');
  assert.equal(focus(state).status, 'ready');
});

test('부고·기일 전후에는 일반 안부를 빼되 명시적인 당일 일정은 제안한다', () => {
  for (const type of ['condolence', 'memorial']) {
    for (const date of ['2026-09-07', '2026-10-06']) {
      const state = event(fixture('a'), 'quiet', 'a', date, { type });
      assert.equal(focus(state).status, 'caught-up', `${type}/${date}`);
    }
    const today = event(fixture('a'), 'quiet_today', 'a', '2026-10-07', { type });
    assert.equal(pick(today).eventId, 'quiet_today');
    assert.equal(pick(today).quiet, true);
  }
});

test('조심스러운 기간의 경계는 지난 30일부터 앞으로 7일까지이며 기간 밖에는 일반 안부를 허용한다', () => {
  for (const date of ['2026-09-06', '2026-10-15']) {
    const state = event(fixture('a'), 'quiet', 'a', date, { type: 'condolence' });
    const recommendation = pick(state);
    assert.equal(recommendation.personId, 'a', date);
    assert.equal(recommendation.eventId, '', date);
  }
  const future = event(fixture('a'), 'quiet_soon', 'a', '2026-10-14', { type: 'memorial' });
  assert.equal(pick(future).eventId, 'quiet_soon');
  assert.equal(pick(future).quiet, true);
});

test('여러 해 전 등록한 기일도 올해의 회차가 최근이라면 일반 안부를 보류한다', () => {
  const state = event(fixture('a'), 'old_origin', 'a', '2000-10-01', { type: 'memorial' });
  assert.equal(focus(state).status, 'caught-up');
  const lunar = event(fixture('a'), 'lunar_memorial', 'a', '2026-08-15', { type: 'memorial', calendar: 'lunar' });
  assert.equal(focus(lunar).status, 'caught-up');
});

test('조심스러운 기간이라도 사용자가 날짜를 정한 후속 챙김은 막지 않는다', () => {
  let state = event(fixture('a'), 'quiet', 'a', '2026-10-01', { type: 'condolence' });
  state = followup(state, 'a', '2026-10-07');
  assert.equal(pick(state).followupId, 'follow_a');
});

test('한 사람의 여러 일정과 후속이 있어도 다른 선택지는 사람당 하나만 담는다', () => {
  let state = fixture('a', 'b', 'c');
  state = event(event(state, 'a_today', 'a', '2026-10-07'), 'a_tomorrow', 'a', '2026-10-08');
  state = followup(state, 'a', '2026-10-01');
  state = event(state, 'b_soon', 'b', '2026-10-09');
  const result = choices(focus(state));
  assert.equal(result[0].eventId, 'a_today');
  assert.equal(new Set(result.map(item => item.personId)).size, result.length);
  assert.ok(result.some(item => item.personId === 'b'));
});

test('날짜와 우선순위가 같아도 사람·일정 배열 순서에 따라 추천이 흔들리지 않는다', () => {
  let state = fixture('c', 'a', 'b');
  for (const id of ['c', 'a', 'b']) state = event(state, `${id}_event`, id, '2026-10-07');
  const before = structuredClone(state);
  const normal = focus(deepFreeze(state));
  const reversed = focus({ ...before, people: [...before.people].reverse(), events: [...before.events].reverse() });
  assert.deepEqual(normal, reversed);
  assert.deepEqual(state, before);
});

test('첫 제안을 챙긴 실제 기록을 남기면 같은 사람을 반복해 재촉하지 않는다', () => {
  let state = fixture('a', 'b');
  const initial = pick(state);
  state = activity(state, initial.personId, '2026-10-07', {}, NOW);
  assert.notEqual(pick(state).personId, initial.personId);
  state = activity(state, pick(state).personId, '2026-10-07', {}, NOW);
  assert.equal(focus(state).status, 'caught-up');
});
