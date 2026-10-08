import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, makePerson, makeEvent, importBackup, exportBackup, recordCareAction,
  completeEvent, recordDraft, rememberDraft, recordPreparation, addFollowup, updateFollowup,
} from '../model.mjs';
import { recommendCareFocus } from '../care-focus.mjs';

const NOW = '2026-10-08T03:00:00.000Z';
const TODAY = '2026-10-08';
const day = offset => new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const atDay = value => `${value}T02:00:00.000Z`;
const person = (extra = {}) => makePerson({ id: 'p', name: '친구', ...extra });
const fixture = (extra = {}) => ({ ...emptyState(), people: [person(extra)] });
const focus = (state, now = NOW) => recommendCareFocus({ state, now });
const activity = (state, offset, extra = {}) => recordCareAction(state, { personId: 'p', kind: 'contact', occurredOn: day(offset), ...extra }, atDay(day(offset)));
const event = (state, offset, extra = {}) => ({ ...state, events: [...state.events, makeEvent({ id: 'event', personId: 'p', type: 'birthday', date: day(offset), ...extra })] });
const followup = (state, offset) => addFollowup(state, { personId: 'p', title: '직접 정한 다음 챙김', dueOn: day(offset) }, atDay(day(-400)));

test('사람의 안부 주기는 없는 필드를 만들지 않으며 0과 1~365 정수만 v1 백업에 보존한다', () => {
  const original = fixture();
  assert.equal(Object.hasOwn(original.people[0], 'checkinIntervalDays'), false);
  assert.equal(Object.hasOwn(importBackup(original).people[0], 'checkinIntervalDays'), false);
  assert.equal(Object.hasOwn(exportBackup(original, NOW).people[0], 'checkinIntervalDays'), false);
  for (const checkinIntervalDays of [0, 1, 7, 14, 30, 90, 365]) {
    const state = fixture({ checkinIntervalDays });
    const restored = importBackup(JSON.stringify(exportBackup(state, NOW)));
    assert.equal(restored.version, 1);
    assert.deepEqual(restored, state);
    assert.equal(restored.people[0].checkinIntervalDays, checkinIntervalDays);
  }
});

test('안부 주기의 문자·음수·소수·범위초과·null·boolean은 직접 입력과 백업 모두 거부한다', () => {
  for (const checkinIntervalDays of ['7', '', -1, 1.5, 366, Number.MAX_SAFE_INTEGER, Infinity, NaN, null, true, false, undefined, {}, []]) {
    assert.throws(() => person({ checkinIntervalDays }), /안부 주기/u);
    const raw = fixture(); raw.people[0].checkinIntervalDays = checkinIntervalDays;
    assert.throws(() => importBackup(raw), /안부 주기/u);
    assert.throws(() => focus(raw), /안부 주기/u);
  }
});

test('설정하지 않은 사람은 기존 30일 기준과 추천 이유 문구를 그대로 쓴다', () => {
  assert.equal(focus(activity(fixture(), -29)).status, 'caught-up');
  const result = focus(activity(fixture(), -30));
  assert.equal(result.recommendation.kind, 'checkin');
  assert.equal(result.recommendation.reason, `수첩에 마지막으로 남긴 챙김은 ${day(-30)}(30일 전)이에요. 실제로 나눈 연락과 다를 수 있어요.`);
  assert.equal(focus(fixture()).recommendation.reason, '아직 이 사람의 챙김 기록을 남기지 않았어요. 첫 안부부터 준비해 볼 수 있어요.');
});

test('7·14·30·90·365일 주기는 실제 챙김 날짜의 직전·당일·다음날 경계를 정확하게 적용한다', () => {
  for (const checkinIntervalDays of [7, 14, 30, 90, 365]) {
    for (const elapsed of [checkinIntervalDays - 1, checkinIntervalDays, checkinIntervalDays + 1]) {
      const state = activity(fixture({ checkinIntervalDays }), -elapsed), before = JSON.stringify(state);
      const result = focus(state);
      assert.equal(result.status, elapsed < checkinIntervalDays ? 'caught-up' : 'ready', `${checkinIntervalDays}/${elapsed}`);
      if (result.recommendation) {
        assert.equal(result.recommendation.kind, 'checkin');
        assert.ok(result.recommendation.reason.includes(`${elapsed}일 전`));
        assert.ok(result.recommendation.reason.includes(`직접 정한 ${checkinIntervalDays}일 간격`));
      }
      assert.equal(JSON.stringify(state), before);
    }
  }
});

test('같은 수첩에서 사람마다 다른 주기와 끄기 설정을 독립적으로 적용한다', () => {
  let state = { ...emptyState(), people: [
    person({ id: 'weekly', checkinIntervalDays: 7 }), person({ id: 'quarterly', checkinIntervalDays: 90 }), person({ id: 'off', checkinIntervalDays: 0 }),
  ] };
  for (const p of state.people) state = recordCareAction(state, { personId: p.id, kind: 'contact', occurredOn: day(-14) }, atDay(day(-14)));
  const result = focus(state);
  assert.equal(result.recommendation.personId, 'weekly');
  assert.deepEqual(result.alternatives, []);
});

test('챙김 기록이 없으면 켜진 주기는 첫 안부를 제안하고 끈 사람은 일반 안부에서 뺀다', () => {
  for (const checkinIntervalDays of [1, 7, 365]) {
    const result = focus(fixture({ checkinIntervalDays }));
    assert.equal(result.recommendation.kind, 'checkin');
    assert.match(result.recommendation.reason, /아직 이 사람의 챙김 기록/u);
    assert.ok(result.recommendation.reason.includes(`${checkinIntervalDays}일 간격`));
  }
  for (const state of [fixture({ checkinIntervalDays: 0 }), activity(fixture({ checkinIntervalDays: 0 }), -400)]) {
    assert.equal(focus(state).status, 'caught-up');
    assert.equal(focus(state).recommendation, null);
  }
});

test('일반 안부를 꺼도 오늘·7일 안 일정과 도래한 직접 후속 챙김은 계속 제안한다', () => {
  for (const offset of [0, 7]) {
    const result = focus(event(fixture({ checkinIntervalDays: 0 }), offset));
    assert.equal(result.recommendation.kind, 'event');
    assert.equal(result.recommendation.occurrenceId, `event:${day(offset)}`);
  }
  for (const offset of [-7, 0]) {
    const state = followup(fixture({ checkinIntervalDays: 0 }), offset), result = focus(state);
    assert.equal(result.recommendation.kind, 'followup');
    assert.equal(result.recommendation.followupId, state.followups[0].id);
  }
  assert.equal(focus(followup(fixture({ checkinIntervalDays: 0 }), 1)).status, 'caught-up');
});

test('짧은 주기라도 미래에 직접 정한 후속 날짜 전에는 일반 안부를 다시 권하지 않는다', () => {
  const state = followup(activity(fixture({ checkinIntervalDays: 1 }), -100), 1);
  assert.equal(focus(state).status, 'caught-up');
  assert.equal(focus(state, atDay(day(1))).recommendation.kind, 'followup');
  const explicit = focus(event(state, 0));
  assert.equal(explicit.recommendation.kind, 'event');
});

test('주기를 줄여도 기일·부고의 지난30일~앞으로7일 보호와 명시 일정·후속은 유지한다', () => {
  for (const type of ['condolence', 'memorial']) {
    for (const offset of [-30, -1]) {
      const state = event(activity(fixture({ checkinIntervalDays: 1 }), -100), offset, { type });
      assert.equal(focus(state).status, 'caught-up', `${type}/${offset}`);
      assert.equal(focus(followup(state, 0)).recommendation.kind, 'followup');
    }
    for (const offset of [0, 7]) {
      const result = focus(event(fixture({ checkinIntervalDays: 0 }), offset, { type }));
      assert.equal(result.recommendation.kind, 'event');
      assert.equal(result.recommendation.quiet, true);
    }
    for (const offset of [-31, 8]) {
      assert.equal(focus(event(fixture({ checkinIntervalDays: 1 }), offset, { type })).recommendation.kind, 'checkin');
    }
  }
});

test('복사·문구 저장·준비 화면 확인은 개인 주기의 실제 챙김 날짜를 갱신하지 않는다', () => {
  let state = activity(fixture({ checkinIntervalDays: 7 }), -7);
  const input = { personId: 'p', eventId: '', eventType: 'checkin', text: '복사만 한 안부예요.' };
  state = recordDraft(state, input, NOW);
  state = rememberDraft(state, input, NOW);
  state = recordPreparation(state, { personId: 'p', eventId: '', recommendedAction: 'contact' }, NOW);
  const result = focus(state);
  assert.equal(result.recommendation.kind, 'checkin');
  assert.ok(result.recommendation.reason.includes(`${day(-7)}(7일 전)`));
  assert.equal(focus(activity(state, 0)).status, 'caught-up');
});

test('행사 날짜 대신 실제 완료한 한국 날짜로 사용자 주기를 계산한다', () => {
  const state = event(fixture({ checkinIntervalDays: 14 }), 100);
  const beforeMidnight = completeEvent(state, 'event', `${day(-14)}T14:59:59Z`);
  const afterMidnight = completeEvent(state, 'event', `${day(-14)}T15:00:00Z`);
  assert.equal(focus(beforeMidnight).recommendation.kind, 'checkin');
  assert.ok(focus(beforeMidnight).recommendation.reason.includes(`${day(-14)}(14일 전)`));
  assert.equal(focus(afterMidnight).status, 'caught-up');
  assert.equal(focus(beforeMidnight, `${day(0)}T14:59:59Z`).status, 'ready');
});

test('후속 완료는 실제 완료일부터 주기를 세고 중단·미래 기록은 최근 챙김으로 세지 않는다', () => {
  const state = followup(fixture({ checkinIntervalDays: 7 }), -20), id = state.followups[0].id;
  const doneSix = updateFollowup(state, id, { status: 'done' }, atDay(day(-6)));
  const doneSeven = updateFollowup(state, id, { status: 'done' }, atDay(day(-7)));
  assert.equal(focus(doneSix).status, 'caught-up');
  assert.ok(focus(doneSeven).recommendation.reason.includes(`${day(-7)}(7일 전)`));
  const dismissed = updateFollowup(state, id, { status: 'dismissed' }, NOW);
  assert.match(focus(dismissed).recommendation.reason, /아직/u);
  const future = updateFollowup(state, id, { status: 'done' }, atDay(day(1)));
  assert.match(focus(future).recommendation.reason, /아직/u);
  const futureActivity = recordCareAction(fixture({ checkinIntervalDays: 7 }), { personId: 'p', kind: 'contact', occurredOn: TODAY }, atDay(day(1)));
  assert.match(focus(futureActivity).recommendation.reason, /아직/u);
});
