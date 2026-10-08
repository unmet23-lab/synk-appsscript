import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, captureSource, draftMessage, generateCheckinDraft, recordDraft, rememberDraft, revokeCareMemory, personTimeline, importBackup, exportBackup, recordPreparation, updatePreparation, addFollowup, updateFollowup, toFollowupICS } from '../model.mjs';
import { prepareCare } from '../care-planner.mjs';

const now = '2026-10-06T03:00:00.000Z';
function fixture(text = '지난봄 함께 걸었던 강변', type = 'birthday', preference = {}) {
  const state = { ...emptyState(), people: [makePerson({ id: 'p', name: '친구', recipientPreference: preference }), makePerson({ id: 'other', name: '다른 사람' })], events: [makeEvent({ id: 'e', personId: 'p', type, date: '2026-10-07' })] };
  return captureSource(state, { personId: 'p', title: '내가 확인한 대화', text: `원문: ${text}. 공개하지 않을 원문 끝.`, memories: [{ kind: 'memory', text, sourceQuote: text }] }, now);
}
const selected = (state, use = 'shared-memory') => ({ memoryId: state.memories[0].id, use, confirmed: true });
const prepared = (state, memorySelection, extra = {}) => prepareCare({ state, personId: 'p', eventId: 'e', attendance: 'not-attend', timeMinutes: 15, budgetWon: 10000, memorySelection, now, ...extra });
const message = (state, memorySelection, extra = {}) => draftMessage(state.people[0], state.events[0], { state, memorySelection, ...extra });

test('원문·기억 철회는 연결 문구와 복사 기록을 지워 이후 자동 재사용을 막는다', () => {
  let state = fixture();
  const text = generateCheckinDraft(state.people[0], { state, memorySelection: selected(state) }).text;
  const input = { personId: 'p', eventId: '', eventType: 'checkin', text, originalText: text };
  state = rememberDraft(recordDraft(state, input, now), input, now);
  state = rememberDraft(state, { personId: 'other', eventId: '', eventType: 'checkin', text }, now);
  state = rememberDraft(state, { personId: 'p', eventId: 'e', text: '별도로 기억한 생일 축하' }, now);
  for (const target of [{ sourceId: state.sources[0].id }, { memoryId: state.memories[0].id }]) {
    const next = revokeCareMemory(state, target);
    assert.equal(next.memories.length, 0);
    assert.equal(next.drafts.length, 0);
    assert.equal(next.people[0].savedMessages.checkin, undefined);
    assert.equal(next.people[0].savedMessages.birthday.text, '별도로 기억한 생일 축하');
    assert.equal(next.people[1].savedMessages.checkin.text, text);
    assert.ok(!generateCheckinDraft(next.people[0], { approach: 'saved' }).text.includes(state.memories[0].text));
    assert.equal(next.events.length, 1);
  }
  assert.equal(state.memories.length, 1);
});

test('JSONB가 받지 못하는 문자는 백업·직접 입력에서 거부하고 한글·이모지는 보존한다', () => {
  for (const bad of ['a\u0000b', 'a\ud800b', 'a\udc00b']) {
    assert.throws(() => makePerson({ name: bad }), /저장할 수 없는 문자/);
    const state = fixture(); state.sources[0].text = bad;
    assert.throws(() => importBackup(state), /저장할 수 없는 문자/);
  }
  assert.equal(makePerson({ name: '한글🙂𝌆' }).name, '한글🙂𝌆');
});

test('준비 기록은 최근 500건 안에서 계속 새 선택과 평가를 남길 수 있다', () => {
  let state = recordPreparation(fixture(), { personId: 'p', eventId: '', recommendedAction: 'contact' }, now);
  const entry = state.preparations[0];
  state.preparations = Array.from({ length: 500 }, (_, index) => ({ ...entry, id: `prep_${index}` }));
  state = recordPreparation(state, { personId: 'p', eventId: '', recommendedAction: 'remember' }, now);
  assert.equal(state.preparations.length, 500); assert.equal(state.preparations[0].id, 'prep_1');
  const newest = state.preparations.at(-1).id;
  state = updatePreparation(state, newest, { chosenAction: 'remember', elapsedSeconds: 5 }, '2026-10-06T03:00:05.000Z');
  state = updatePreparation(state, newest, { satisfaction: 5 }, '2026-10-06T03:00:06.000Z');
  assert.equal(state.preparations.at(-1).satisfaction, 5);
});

test('기억 선택이 없으면 저장 원문은 기존 추천과 문구에 끼어들지 않는다', () => {
  const state = fixture(), original = JSON.stringify(state);
  assert.equal(prepared(state).recommendation.action, 'gift');
  assert.equal(prepared(state).memory, null);
  assert.ok(!message(state).text.includes(state.memories[0].text));
  assert.equal(message(state).memory, null);
  assert.equal(JSON.stringify(state), original);
});

test('직접 함께한 기억으로 선택하면 Core 선언이 추천을 바꾸고 준비·문구에 정확한 인용을 넣는다', () => {
  const state = fixture(), selection = selected(state), result = prepared(state, selection), draft = message(state, selection);
  assert.equal(result.recommendation.action, 'contact'); // 기억 없이 gift였던 동일 조건.
  assert.equal(result.decision.selected.reasons.find(item => item.field === 'memoryUse').value, 'shared-memory');
  assert.match(result.recommendation.steps.join(' '), /지난봄 함께 걸었던 강변/);
  assert.ok(draft.text.includes(`“${state.memories[0].text}”`));
  assert.deepEqual(result.memory.appliedTo, ['steps']);
  assert.deepEqual(draft.memory.appliedTo, ['message']);
  assert.equal(draft.memory.sourceQuote, state.memories[0].sourceQuote);
  assert.equal(draft.memory.sourceTitle, state.sources[0].title);
  assert.ok(!draft.text.includes('공개하지 않을 원문 끝'));
});

test('기억을 담아 보관한 문구를 다시 불러와도 같은 인용이 중복되지 않는다', () => {
  let state = fixture();
  const memorySelection = selected(state), first = generateCheckinDraft(state.people[0], { state, memorySelection });
  state = rememberDraft(state, { personId: 'p', eventId: '', eventType: 'checkin', text: first.text }, now);
  const again = generateCheckinDraft(state.people[0], { state, memorySelection, approach: 'saved' });
  assert.equal(again.text, first.text);
  assert.deepEqual(again.memory.appliedTo, ['message']);
  assert.equal(again.text.split(`“${state.memories[0].text}”`).length - 1, 1);
});

test('선물 취향은 직접 고른 내용으로 준비 순서를 바꾸며 메시지에 구매 약속을 만들지 않는다', () => {
  const state = fixture('손으로 쓴 짧은 편지가 좋아요'), selection = selected(state, 'gift-preference');
  const result = prepared(state, selection), draft = message(state, selection);
  assert.equal(result.recommendation.action, 'gift');
  assert.ok(result.recommendation.steps[0].includes(state.memories[0].text));
  assert.equal(result.decision.selected.reasons.find(item => item.field === 'memoryUse').value, 'gift-preference');
  assert.deepEqual(draft.memory.appliedTo, []);
  assert.ok(!draft.text.includes(state.memories[0].text));
  assert.match(draft.cautions.join(' '), /선물 약속을 넣지/);
});

test('확인하지 않은 용도·다른 사람·삭제한 기억·철회한 근거는 생성 시 현재 수첩에서 거부한다', () => {
  const state = fixture(), selection = selected(state);
  for (const patch of [{ confirmed: false }, { use: 'inferred' }, { memoryId: 'gone' }, { rawText: '임의 기억' }]) assert.throws(() => prepared(state, { ...selection, ...patch }));
  assert.throws(() => prepareCare({ state, personId: 'other', eventId: '', timeMinutes: 3, memorySelection: selection, now }));
  const removed = { ...state, memories: [] };
  assert.throws(() => message(removed, selection));
  assert.throws(() => prepared({ ...state, sources: [] }, selection));
  assert.throws(() => prepared({ ...state, sources: [{ ...state.sources[0], text: '근거를 지운 원문' }] }, selection));
  assert.throws(() => recordDraft(removed, { personId: 'p', eventId: '', eventType: 'checkin', text: '예전 초안', memorySelection: selection }, now));
  assert.throws(() => rememberDraft(removed, { personId: 'p', eventId: '', eventType: 'checkin', text: '예전 초안', memorySelection: selection }, now));
});

test('금지 표현·답장 압박·조심스러운 날의 웃음 표지는 근거를 보여 주되 자동 삽입하지 않는다', () => {
  const states = [fixture('만나면 술 한잔해요', 'birthday', { confirmed: true, avoidPhrases: ['술 한잔'] }), fixture('빨리 답장 주세요', 'birthday', { confirmed: true, noReplyPressure: true }), fixture('함께했던 산책 😊', 'memorial'), fixture('재밌었죠 ㅋㅋ', 'condolence')];
  for (const state of states) {
    const selection = selected(state), draft = message(state, selection), result = prepared(state, selection);
    assert.ok(draft.memory.blockedReasons.length);
    assert.equal(draft.memory.sourceQuote, state.memories[0].sourceQuote);
    assert.ok(!draft.text.includes(state.memories[0].text));
    assert.ok(!result.recommendation.steps.join(' ').includes(state.memories[0].text));
    assert.deepEqual(draft.memory.appliedTo, []);
    assert.deepEqual(result.memory.appliedTo, []);
  }
  const sensitive = fixture('편지가 좋아요', 'memorial');
  assert.ok(prepared(sensitive, selected(sensitive, 'gift-preference')).memory.blockedReasons.length);
});

test('기억을 쓸 때는 오래된 사람·행사 객체 대신 현재 설정과 행사 종류를 확인한다', () => {
  const state = fixture('산책이 즐거웠어요 😊'), oldPerson = state.people[0], oldEvent = state.events[0], selection = selected(state);
  const changed = { ...state, events: [makeEvent({ ...oldEvent, type: 'memorial' })] };
  const draft = draftMessage(oldPerson, oldEvent, { state: changed, memorySelection: selection });
  assert.ok(!draft.text.includes('생일'));
  assert.ok(!draft.text.includes('😊'));
  assert.ok(draft.memory.blockedReasons.length);
});

test('일상 안부는 일정 없이 준비·복사·명시 기억·백업 왕복이 되고 완료를 만들지 않는다', () => {
  let state = fixture(); state.events = [];
  const draft = generateCheckinDraft(state.people[0], { state, memorySelection: selected(state), approach: 'warm' });
  assert.equal(draft.eventId, ''); assert.equal(draft.eventType, 'checkin');
  assert.ok(!Object.hasOwn(draft, 'occurrenceId'));
  assert.ok(draft.text.includes(state.memories[0].text));
  state = recordDraft(state, { personId: 'p', eventId: '', eventType: 'checkin', originalText: draft.text, text: draft.text }, now);
  assert.equal(personTimeline(state, 'p')[0].eventTitle, '오늘 그냥 안부');
  assert.equal(personTimeline(state, 'p')[0].kind, 'copied');
  assert.equal(state.people[0].savedMessages.checkin, undefined);
  state = rememberDraft(state, { personId: 'p', eventId: '', eventType: 'checkin', text: '문득 네 생각이 났어.' }, now);
  assert.equal(generateCheckinDraft(state.people[0], { approach: 'saved' }).text, '문득 네 생각이 났어.');
  assert.deepEqual(importBackup(JSON.stringify(exportBackup(state, now))), state);
  assert.equal(state.events.length + state.completions.length + state.activities.length, 0);
});

test('일상 안부는 연락·기억 준비만 고르고 참석·예산을 묻거나 가짜 날짜를 만들지 않는다', () => {
  const state = fixture(); state.events = [];
  const result = prepared(state, selected(state), { eventId: '', timeMinutes: 3 });
  assert.equal(result.recommendation.action, 'contact'); assert.equal(result.occurrenceId, null);
  assert.equal(result.question, null);
  assert.deepEqual(result.alternatives.map(item => item.action), ['remember']);
  assert.ok(!result.recommendation.steps.join(' ').includes('날짜를 확인'));
  const gift = prepared(state, selected(state, 'gift-preference'), { eventId: '', timeMinutes: 15 });
  assert.ok(gift.memory.blockedReasons.length);
  let logged = recordPreparation(state, { personId: 'p', eventId: '', recommendedAction: 'contact' }, now);
  logged = updatePreparation(logged, logged.preparations[0].id, { chosenAction: 'remember' }, '2026-10-06T03:01:00Z');
  assert.equal(logged.preparations[0].eventId, '');
  for (const action of ['attend', 'gift']) assert.throws(() => recordPreparation(state, { personId: 'p', eventId: '', recommendedAction: action }, now));
});

test('일상 안부를 실제 행사와 섞거나 잘못된 사람·회차로 가져오지 못한다', () => {
  const state = recordDraft(fixture(), { personId: 'p', eventId: '', eventType: 'checkin', text: '잘 지내시죠.' }, now);
  for (const patch of [{ eventId: 'e' }, { eventId: 'missing' }, { eventType: 'birthday' }, { personId: 'missing' }, { occurrenceId: 'e:2026-10-07' }, { occurrenceId: '' }]) assert.throws(() => importBackup({ ...state, drafts: [{ ...state.drafts[0], ...patch }] }));
  assert.throws(() => recordDraft(state, { personId: 'p', eventId: '', text: '종류 생략' }, now));
  assert.throws(() => rememberDraft(state, { personId: 'p', eventId: 'e', eventType: 'checkin', text: '혼합' }, now));
  assert.throws(() => makeEvent({ id: 'fake', personId: 'p', type: 'checkin', date: '2026-10-06' }));
});

function followupFixture(dueOn = '2026-10-07') {
  const state = fixture('민감한 검사 원문');
  return addFollowup(state, { personId: 'p', title: '안부 묻기', dueOn, sourceId: state.sources[0].id, sourceQuote: state.memories[0].sourceQuote }, now);
}

test('후속 달력 기본값은 다음 한 번 종일·알림 없음이며 원문·선호를 내보내지 않는다', () => {
  const state = followupFixture(), before = JSON.stringify(state), ics = toFollowupICS(state, state.followups[0].id, {}, now);
  assert.match(ics, /DTSTART;VALUE=DATE:20261007/);
  assert.match(ics, /DTEND;VALUE=DATE:20261008/);
  assert.ok(!ics.includes('VALARM')); assert.ok(!ics.includes('RRULE'));
  assert.ok(!ics.includes('민감한 검사 원문'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.match(ics.replace(/\r\n /g, ''), /달력은 자동으로 바뀌지/);
  assert.equal(JSON.stringify(state), before);
});

test('후속 달력은 직접 고른 한국 시각과 알림 간격만 쓰고 중복을 정리한다', () => {
  const state = followupFixture(), id = state.followups[0].id;
  const ics = toFollowupICS(state, id, { time: '09:30', reminderMinutes: [0, 30, 30] }, now);
  assert.match(ics, /DTSTART;TZID=Asia\/Seoul:20261007T093000/);
  assert.match(ics, /TZOFFSETTO:\+0900/);
  assert.match(ics, /TRIGGER:PT0M/); assert.match(ics, /TRIGGER:-PT30M/);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 2);
  const moved = updateFollowup(state, id, { dueOn: '2026-10-08' }, now);
  assert.equal(toFollowupICS(moved, id, {}, now).match(/UID:([^\r]+)/)[1], ics.match(/UID:([^\r]+)/)[1]);
});

test('지난 날짜·한국 자정·이미 지난 시각·알림·잘못된 옵션·완료/중단을 거부한다', () => {
  const state = followupFixture(), id = state.followups[0].id;
  for (const options of [{ time: '24:00' }, { time: '9:00' }, { reminderMinutes: [0] }, { time: '09:00', reminderMinutes: [-1] }, { time: '09:00', reminderMinutes: [0.5] }, { time: '09:00', reminderMinutes: ['0'] }, { time: '09:00', raw: 'extra' }]) assert.throws(() => toFollowupICS(state, id, options, now));
  assert.throws(() => toFollowupICS(state, id, { time: '09:00' }, '2026-10-07T00:01:00Z'));
  assert.throws(() => toFollowupICS(state, id, { time: '09:00', reminderMinutes: [60] }, '2026-10-06T23:30:00Z'));
  assert.throws(() => toFollowupICS(state, id, {}, '2026-10-07T15:00:00Z')); // 한국은 8일.
  for (const status of ['done', 'dismissed']) {
    const changed = updateFollowup(state, id, { status }, now);
    assert.throws(() => toFollowupICS(changed, id, {}, now));
  }
});

test('후속 ICS의 줄 삽입·쉼표를 escape하고 한글도 75바이트 이내로 접는다', () => {
  const state = addFollowup(fixture(), { personId: 'p', title: '한글'.repeat(40) + ', 메모\nBEGIN:VEVENT', dueOn: '2026-10-07' }, now);
  const ics = toFollowupICS(state, state.followups[0].id, {}, now);
  assert.equal(ics.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  assert.match(ics.replace(/\r\n /g, ''), /\\, 메모\\nBEGIN:VEVENT/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
});

test('최종 5000자 상한은 기억 인용까지 지키며 평소 덧붙임·답장 배려는 새 틀에만 연결한다', () => {
  let state = fixture('기'.repeat(2000), 'birthday', { confirmed: true, closingLine: '끝'.repeat(300), noReplyPressure: true });
  state = rememberDraft(state, { personId: 'p', eventId: 'e', text: '가'.repeat(3100) }, now);
  const selection = selected(state), long = message(state, selection, { approach: 'saved' });
  assert.ok(long.text.length <= 5000);
  assert.deepEqual(long.memory.appliedTo, []);
  assert.match(long.memory.blockedReasons.join(' '), /5,000/);
  assert.ok(!long.text.includes('끝'.repeat(300)));
  assert.doesNotMatch(long.text, /답장은 편하실 때/u);
  const short = message(state, selection, { approach: 'short' });
  assert.ok(short.text.includes(state.memories[0].text));
  assert.deepEqual(short.memory.appliedTo, ['message']);
  assert.ok(short.text.includes('끝'.repeat(300)));
  assert.match(short.text, /답장은 편하실 때/u);
  const quoteLine = `“${state.memories[0].text}” 이 기억이 떠올랐어요.`;
  const exactPrefixLength = 5000 - quoteLine.length - 1;
  state = rememberDraft(state, { personId: 'p', eventId: 'e', text: '가'.repeat(exactPrefixLength) }, now);
  const exact = message(state, selection, { approach: 'saved' });
  assert.equal(exact.text.length, 5000);
  assert.ok(exact.text.endsWith(`\n${quoteLine}`));
  assert.deepEqual(exact.memory.appliedTo, ['message']);
  state = rememberDraft(state, { personId: 'p', eventId: 'e', text: '가'.repeat(exactPrefixLength + 1) }, now);
  const over = message(state, selection, { approach: 'saved' });
  assert.deepEqual(over.memory.appliedTo, []);
  assert.ok(!over.text.includes(state.memories[0].text));
  assert.match(over.memory.blockedReasons.join(' '), /5,000/);
  state = rememberDraft(state, { personId: 'p', eventId: 'e', text: '가'.repeat(5000) }, now);
  const full = message(state, null, { approach: 'saved' });
  assert.equal(full.text.length, 5000);
  assert.doesNotMatch(full.cautions.join(' '), /덧붙임은 넣지/u);
});

test('기억을 잇는 문장 자체가 금지 표현이면 일부만 남기거나 반영했다고 표시하지 않는다', () => {
  const state = fixture('함께 걸었던 강변', 'birthday', { confirmed: true, avoidPhrases: ['이 기억이'] });
  const draft = message(state, selected(state));
  assert.ok(!draft.text.includes('함께 걸었던 강변'));
  assert.deepEqual(draft.memory.appliedTo, []);
  assert.ok(draft.memory.blockedReasons.length);
  assert.ok(draft.removedPhrases.includes('이 기억이'));
  assert.ok(!draft.basis.some(line => line.includes('고른 글을 인용')));
});
