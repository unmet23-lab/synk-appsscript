import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, importBackup, recordCareAction, completeEvent } from '../model.mjs';
import { buildCareContext } from '../care-context.mjs';

const TODAY = '2026-10-07', AT = '2026-10-07T03:00:00.000Z';
const stamp = day => `${day}T03:00:00.000Z`;
const fixture = () => ({ ...emptyState(), people: ['a', 'b'].map(id => makePerson({ id, name: `사람 ${id}` })),
  events: ['a', 'b'].map(id => makeEvent({ id: `e_${id}`, personId: id, type: 'birthday', date: '2026-10-09' })) });
const activity = (id, occurredOn, extra = {}) => ({ id, personId: 'a', kind: 'contact', eventId: '', occurredOn,
  direction: 'sent', note: `${id}의 이야기`, amountWon: null, createdAt: stamp(occurredOn), ...extra });
const followup = (id, dueOn, extra = {}) => ({ id, personId: 'a', title: `${id}에게 안부`, dueOn,
  status: 'pending', sourceId: '', sourceQuote: '', createdAt: '2026-09-01T03:00:00.000Z', updatedAt: AT, ...extra });
const source = (id, extra = {}) => ({ id, personId: 'a', title: `${id} 원문`, text: '함께 바다에 다녀온 날. 원문 전체의 별도 비공개 내용.', kind: 'text', createdAt: '2026-10-01T03:00:00.000Z', ...extra });
const memory = (id, sourceId, extra = {}) => ({ id, personId: 'a', kind: 'memory', text: '함께 바다에 다녀온 날',
  sourceId, sourceQuote: '함께 바다에 다녀온 날', createdAt: AT, ...extra });
const draft = (id, extra = {}) => ({ id, personId: 'a', eventType: 'checkin', eventId: '', eventTitle: '오늘 그냥 안부',
  text: `${id} 복사한 초안`, originalText: '', preferenceNote: '', createdAt: AT, ...extra });
const completion = (extra = {}) => ({ personId: 'a', eventId: 'e_a', eventType: 'birthday', eventTitle: '생일',
  action: 'contacted', occurrenceId: 'e_a:2026-10-09', date: '2026-10-09', completedAt: AT, ...extra });
const context = (state, extra = {}) => buildCareContext(state, { personId: 'a', today: TODAY, ...extra });

test('최근 챙김은 실제 날짜를 쓰며 최근 입력한 과거 기록이나 복사·준비를 연락으로 세지 않는다', () => {
  const state = fixture();
  state.activities = [activity('latest', '2026-10-06'), activity('entered_later', '2026-10-01', { createdAt: AT })];
  state.drafts = [draft('copy')];
  state.preparations = [{ id: 'plan', personId: 'a', eventId: '', recommendedAction: 'contact', chosenAction: 'contact',
    shownAt: '2026-10-07T02:00:00.000Z', selectedAt: AT, elapsedSeconds: null, satisfaction: null, satisfactionAt: null }];
  const result = context(importBackup(state));
  assert.equal(result.lastCare.id, 'latest');
  assert.equal(result.lastCare.date, '2026-10-06');
  assert.equal(result.previousDraft.label, '복사한 문구');
  assert.equal(context({ ...state, activities: [] }).lastCare, null);
});

test('일정은 행사 날짜 대신 직접 완료한 날을, 후속 챙김은 기한 대신 완료한 날을 표시한다', () => {
  const state = fixture(); state.completions = [completion()];
  let result = context(importBackup(state));
  assert.equal(result.lastCare.sourceKind, 'completion');
  assert.equal(result.lastCare.date, TODAY);
  assert.equal(result.lastCare.scheduledDate, '2026-10-09');
  state.followups = [followup('done', '2026-12-01', { status: 'done', updatedAt: '2026-10-07T04:00:00.000Z' })];
  result = context(importBackup(state));
  assert.equal(result.lastCare.id, 'done'); assert.equal(result.lastCare.date, TODAY);
  assert.equal(result.lastCare.label, '후속 챙김 완료');
  assert.equal(result.followups.length, 0);
});

test('지난 일정을 뒤늦게 함께 기록한 활동·완료에서는 직접 입력한 실제 날짜와 메모를 보여 준다', () => {
  const state = fixture(); state.events[0] = makeEvent({ id: 'e_a', personId: 'a', type: 'birthday', date: '2026-10-01' });
  const recordedAt = new Date(AT);
  const withActivity = recordCareAction(state, { personId: 'a', eventId: 'e_a', kind: 'contact', direction: 'sent',
    occurredOn: '2026-10-01', note: '생일에 전화하며 바다 여행 이야기를 나눴어요.' }, recordedAt);
  const saved = completeEvent(withActivity, 'e_a', recordedAt, 'e_a:2026-10-01', { allowPast: true, action: 'contacted' });
  const before = JSON.stringify(saved), result = context(saved);
  assert.equal(saved.completions[0].completedAt, AT);
  assert.equal(saved.activities[0].createdAt, AT);
  assert.equal(result.lastCare.sourceKind, 'activity');
  assert.equal(result.lastCare.date, '2026-10-01');
  assert.equal(result.lastCare.note, '생일에 전화하며 바다 여행 이야기를 나눴어요.');
  assert.equal(JSON.stringify(saved), before);
});

test('같은 일정의 과거 활동이 있어도 다른 시점의 독립적인 완료 기록은 유지한다', () => {
  let state = recordCareAction(fixture(), { personId: 'a', eventId: 'e_a', kind: 'contact', direction: 'sent',
    occurredOn: '2025-10-09', note: '지난해 인사' }, '2026-10-06T03:00:00.000Z');
  state = completeEvent(state, 'e_a', AT, 'e_a:2026-10-09', { action: 'contacted' });
  const result = context(state);
  assert.equal(result.lastCare.sourceKind, 'completion');
  assert.equal(result.lastCare.date, TODAY);
  assert.equal(result.lastCare.scheduledDate, '2026-10-09');
});

test('조용히 기억한 활동은 remembered 완료와만 묶고 서로 다른 행동은 따로 남긴다', () => {
  const state = fixture(); state.events[0] = makeEvent({ id: 'e_a', personId: 'a', type: 'memorial', date: '2026-10-01' });
  for (const kind of ['remember', 'contact']) {
    const activityState = recordCareAction(state, { personId: 'a', eventId: 'e_a', kind, direction: 'sent',
      occurredOn: '2026-10-01', note: '이날의 마음을 따로 남겼어요.' }, AT);
    for (const action of ['remembered', 'contacted']) {
      const saved = completeEvent(activityState, 'e_a', AT, 'e_a:2026-10-01', { allowPast: true, action });
      const matched = kind === 'remember' ? action === 'remembered' : action === 'contacted';
      assert.equal(context(saved).lastCare.sourceKind, matched ? 'activity' : 'completion', `${kind}/${action}`);
      assert.equal(context(saved).lastCare.date, matched ? '2026-10-01' : TODAY);
    }
  }
});

test('받은 기록·다른 일정·다른 사람·다른 저장시각의 활동을 완료의 동반 기록으로 오인하지 않는다', () => {
  const cases = [
    { direction: 'received' },
    { eventId: 'another_a' },
    { personId: 'b', eventId: 'e_b' },
    { at: '2026-10-07T02:59:59.999Z' },
  ];
  for (const { at = AT, ...patch } of cases) {
    let state = fixture(); state.events.push(makeEvent({ id: 'another_a', personId: 'a', type: 'wedding', date: TODAY }));
    state = recordCareAction(state, { personId: 'a', eventId: 'e_a', kind: 'contact', direction: 'sent',
      occurredOn: '2026-10-01', note: '완료와 별개로 남긴 기록', ...patch }, at);
    state = completeEvent(state, 'e_a', AT, 'e_a:2026-10-09', { action: 'contacted' });
    assert.equal(context(state).lastCare.sourceKind, 'completion', JSON.stringify({ at, ...patch }));
  }
});

test('미래 시계의 기록은 오늘 맥락을 덮지 않고 한국 자정 경계로 분리한다', () => {
  const state = fixture();
  state.activities = [activity('real', '2026-10-05'), activity('future_record', '2026-10-06', { createdAt: '2026-10-07T15:00:00.000Z' })];
  state.completions = [completion({ completedAt: '2026-10-07T15:00:00.000Z' })];
  state.followups = [followup('future_done', TODAY, { status: 'done', updatedAt: '2026-10-07T15:00:00.000Z' })];
  state.drafts = [draft('future_copy', { createdAt: '2026-10-07T15:00:00.000Z' })];
  assert.equal(context(importBackup(state)).lastCare.id, 'real');
  assert.equal(context(state).previousDraft, null);
  state.completions[0].completedAt = '2026-10-07T14:59:59.999Z';
  assert.equal(context(state).lastCare.sourceKind, 'completion');
  assert.equal(context(state).lastCare.date, TODAY);
});

test('받은 선물과 조용히 기억한 날은 연락했다고 바꾸지 않는다', () => {
  const state = fixture(); state.activities = [activity('gift', TODAY, { kind: 'gift', direction: 'received', amountWon: 0 })];
  let result = context(importBackup(state));
  assert.equal(result.lastCare.kind, 'gift'); assert.match(result.lastCare.label, /받은 마음/);
  assert.equal(result.exchanges[0].amountWon, 0);
  state.activities = []; state.completions = [completion({ action: 'remembered' })];
  result = context(state); assert.equal(result.lastCare.label, '조용히 기억한 날');
});

test('선택한 후속은 먼저, 나머지는 오늘·지난 날짜·미래 날짜 순으로 세 개만 보여 준다', () => {
  const state = fixture();
  state.followups = [followup('later', '2026-11-01'), followup('old', '2026-09-20'), followup('recent_past', '2026-10-06'),
    followup('today', TODAY), followup('tomorrow', '2026-10-08'), followup('stopped', TODAY, { status: 'dismissed' })];
  const valid = importBackup(state);
  assert.deepEqual(context(valid).followups.map(item => item.id), ['today', 'old', 'recent_past']);
  const chosen = context(valid, { followupId: 'later' });
  assert.deepEqual(chosen.followups.map(item => item.id), ['later', 'today', 'old']);
  assert.equal(chosen.selectedFollowup.daysUntil, 25);
  assert.equal(chosen.selectedFollowup.phase, 'upcoming');
  assert.equal(chosen.selectedFollowup.title, state.followups[0].title);
});

test('선택 후속이 삭제·완료·중단·다른 사람 소유일 때 선택을 대체하지 않는다', () => {
  const state = fixture(); state.followups = [followup('own', TODAY), followup('other', TODAY, { personId: 'b' }),
    followup('done', TODAY, { status: 'done' }), followup('stop', TODAY, { status: 'dismissed' })];
  for (const followupId of ['missing', 'other', 'done', 'stop']) {
    const result = context(importBackup(state), { followupId });
    assert.equal(result.selectedFollowup, null, followupId);
    assert.deepEqual(result.followups.map(item => item.id), ['own']);
    assert.equal(result.followups[0].selected, false);
  }
});

test('기억과 후속은 동일한 사람의 살아 있는 원문에 근거 문장이 있을 때만 노출한다', () => {
  const state = fixture(); state.sources = [source('s')];
  state.memories = [memory('m', 's')];
  state.followups = [followup('f', TODAY, { sourceId: 's', sourceQuote: '함께 바다에 다녀온 날' })];
  const baseline = importBackup(state), result = context(baseline, { followupId: 'f' });
  assert.equal(result.memories.length, 1); assert.equal(result.selectedFollowup.sourceTitle, 's 원문');
  assert.equal(JSON.stringify(result).includes('별도 비공개 내용'), false);
  for (const sources of [[], [source('s', { personId: 'b' })], [source('s', { text: '수정한 다른 글' })], [source('s', { createdAt: '2026-10-08T03:00:00.000Z' })]]) {
    const changed = context({ ...baseline, sources }, { followupId: 'f' });
    assert.deepEqual(changed.memories, []); assert.deepEqual(changed.followups, []); assert.equal(changed.selectedFollowup, null);
  }
});

test('최근 기억·주고받음·같은 행사 종류의 복사 문구만 꺼내고 각 목록을 제한한다', () => {
  const state = fixture(); state.sources = [source('s')];
  state.memories = [1, 2, 3, 4].map(n => memory(`m${n}`, 's', { createdAt: stamp(`2026-10-0${n}`) }));
  state.activities = [1, 2, 3, 4].map(n => activity(`money${n}`, `2026-10-0${n}`, { kind: 'money', amountWon: n * 10000 }));
  state.drafts = [draft('older', { createdAt: '2026-10-01T03:00:00.000Z' }), draft('latest'),
    draft('birthday', { eventId: 'e_a', eventType: 'birthday' }), draft('other_person', { personId: 'b' })];
  const result = context(importBackup(state));
  assert.deepEqual(result.memories.map(item => item.id), ['m4', 'm3', 'm2']);
  assert.deepEqual(result.exchanges.map(item => item.id), ['money4', 'money3', 'money2']);
  assert.equal(result.previousDraft.id, 'latest'); assert.equal(result.previousDraft.kind, 'copied');
  assert.equal(context(state, { eventType: 'birthday' }).previousDraft.id, 'birthday');
});

test('동률 정렬은 배열 순서에 좌우되지 않고 입력과 원문 객체를 변경하지 않는다', () => {
  const state = fixture(); state.sources = [source('s')];
  state.memories = [memory('z', 's'), memory('a', 's')];
  state.activities = [activity('z', TODAY), activity('a', TODAY)];
  state.followups = [followup('z', TODAY), followup('a', TODAY)]; state.drafts = [draft('z'), draft('a')];
  const freeze = value => { Object.values(value).forEach(item => { if (item && typeof item === 'object') freeze(item); });return Object.freeze(value); };
  const before = JSON.stringify(state), result = context(freeze(state));
  const reversed = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, Array.isArray(value) ? [...value].reverse() : value]));
  assert.deepEqual(context(reversed), result); assert.equal(JSON.stringify(state), before);
  assert.equal(result.lastCare.id, 'a'); assert.equal(result.memories[0].id, 'a'); assert.equal(result.previousDraft.id, 'a');
  result.memories[0].text = '표시 객체만 변경'; assert.equal(state.memories[1].text, '함께 바다에 다녀온 날');
});

test('사람·계정 수첩이 바뀌면 이전 사람의 정보를 반환하지 않는다', () => {
  const state = fixture(); state.sources = [source('s')]; state.memories = [memory('m', 's')];
  state.activities = [activity('care', TODAY)]; state.followups = [followup('f', TODAY)]; state.drafts = [draft('d')];
  const other = context(importBackup(state), { personId: 'b', followupId: 'f' });
  assert.equal(other.personId, 'b'); assert.equal(other.lastCare, null); assert.equal(other.selectedFollowup, null);
  assert.deepEqual(other.memories, []); assert.deepEqual(other.followups, []); assert.equal(other.previousDraft, null);
  assert.deepEqual(context(emptyState(), { followupId: 'f' }), { personId: null, today: TODAY, lastCare: null,
    selectedFollowup: null, followups: [], memories: [], exchanges: [], previousDraft: null });
});

test('유효하지 않은 기준 날짜와 일정 종류는 묵시적으로 오늘이나 다른 행사로 바꾸지 않는다', () => {
  for (const today of [undefined, '', '2026-02-30', '1899-12-31', '2200-01-01', '2026-10-07T00:00:00Z']) {
    assert.throws(() => context(fixture(), { today }), /한국 날짜/);
  }
  assert.throws(() => context(fixture(), { eventType: 'unknown' }), /일정 종류/);
});
