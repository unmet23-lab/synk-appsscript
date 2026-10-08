import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTone, makePerson, makeEvent, emptyState, nextOccurrence, upcomingEvents, draftMessage, completeEvent, recordDraft, rememberDraft, personTimeline, exportBackup, importBackup, toICS } from '../model.mjs';

const now = new Date('2026-10-05T03:00:00Z');
const person = input => makePerson({ id: 'p_1', name: '지훈', ...input });
const event = input => makeEvent({ id: 'e_1', personId: 'p_1', type: 'birthday', date: '1990-10-06', ...input });
const state = (p = person(), e = event()) => ({ ...emptyState(), people: [p], events: [e] });

test('말투 관찰은 규칙 기반임을 밝히고 원문·상대 선호를 보관하지 않는다', () => {
  const polite = analyzeTone('생일 축하드려요. 좋은 하루 보내세요!');
  assert.equal(polite.formality, 'polite');
  assert.equal(polite.source, 'rule-based');
  assert.equal(polite.sampleCount, 2);
  const casual = analyzeTone('생일 축하해 ㅋㅋ\n내일 보자 😊');
  assert.equal(casual.formality, 'casual');
  assert.equal(casual.hasLaughter, true);
  assert.equal(casual.hasEmoji, true);
  assert.equal(analyzeTone('감사해요. 내일 보자.').formality, 'mixed');
  assert.equal(analyzeTone('사진 첨부').formality, 'unknown');
  const stored = person({ selfTone: { ...casual, rawText: '저장하면 안 되는 원문' } });
  assert.equal(stored.selfTone.rawText, undefined);
  assert.equal(stored.recipientPreference.confirmed, false);
  assert.throws(() => analyzeTone(' '));
});

test('잘못된 날짜·시간·달력·반복·알림 입력을 거부한다', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-1-01', '0000-01-01']) assert.throws(() => event({ date }));
  for (const time of ['24:00', '12:60', '9:00', '11:05\nSUMMARY:Injected']) assert.throws(() => event({ time }));
  assert.throws(() => event({ calendar: 'unknown' }));
  assert.throws(() => event({ calendar: 'lunar', date: '2026-02-30' }));
  assert.throws(() => event({ calendar: 'lunar', date: '2025-06-01', lunarLeapMonth: 'true' }));
  assert.throws(() => event({ type: 'wedding', repeat: 'yearly' }));
  assert.throws(() => event({ reminderDays: [-1] }));
  assert.throws(() => event({ reminderDays: ['7'] }));
  assert.deepEqual(event({ reminderDays: [0, 7, 7, 1] }).reminderDays, [7, 1, 0]);
});

test('생일 다음 회차는 한국 날짜와 연도 경계를 따른다', () => {
  assert.equal(nextOccurrence(event(), now).date, '2026-10-06');
  assert.equal(nextOccurrence(event(), now).daysUntil, 1);
  assert.equal(nextOccurrence(event(), '2026-10-05T16:00:00Z').daysUntil, 0);
  assert.equal(nextOccurrence(event(), '2026-10-06T16:00:00Z').date, '2027-10-06');
  assert.equal(nextOccurrence(event({ date: '2027-01-01' }), '2026-12-31T14:59:00Z').daysUntil, 1);
  assert.equal(nextOccurrence(event({ date: '2027-01-01' }), '2026-12-31T15:00:00Z').daysUntil, 0);
  assert.equal(nextOccurrence(event({ type: 'wedding', date: '2026-10-04' }), now), null);
});

test('2월 29일 정책을 평년과 윤년에 명시 적용한다', () => {
  const leap = event({ date: '2000-02-29' });
  assert.equal(nextOccurrence(leap, '2027-01-01').date, '2027-02-28');
  assert.equal(nextOccurrence({ ...leap, leapDayPolicy: 'mar1' }, '2027-01-01').date, '2027-03-01');
  assert.equal(nextOccurrence(leap, '2028-01-01').date, '2028-02-29');
  assert.equal(nextOccurrence({ ...leap, leapDayPolicy: 'mar1' }, '2028-01-01').date, '2028-02-29');
});

test('완료는 회차별이며 재호출은 중복을 만들지 않고 다음 해를 숨기지 않는다', () => {
  const original = state();
  const before = upcomingEvents(original, now);
  assert.equal(before[0].reminderDue, true);
  const done = completeEvent(original, 'e_1', now);
  assert.equal(original.completions.length, 0);
  assert.equal(done.completions.length, 1);
  assert.equal(completeEvent(done, 'e_1', now), done);
  assert.equal(upcomingEvents(done, now)[0].occurrence.date, '2027-10-06');
  assert.equal(upcomingEvents(done, now)[0].reminderDue, false);
  const next = upcomingEvents(done, now)[0].occurrence;
  assert.match(toICS(event(), person(), now, next.date), /DTSTART;VALUE=DATE:20271006/);
  const twice = completeEvent(done, 'e_1', now, next.occurrenceId);
  assert.equal(twice.completions.length, 2);
  assert.equal(completeEvent(twice, 'e_1', now, next.occurrenceId), twice);
  assert.throws(() => completeEvent(done, 'e_1', now, 'e_1:2030-10-06'));
  assert.throws(() => toICS(event(), person(), now, '2027-10-07'));
  const wedding = state(person(), event({ type: 'wedding', date: '2026-10-06' }));
  assert.equal(upcomingEvents(completeEvent(wedding, 'e_1', now), now).length, 0);
});

test('직접 확인한 선호만 관찰 말투를 덮어쓰고 미확인 선호는 쓰지 않는다', () => {
  const observed = analyzeTone('잘 지내요. 생일 축하드려요.');
  const unconfirmed = person({ selfTone: observed, recipientPreference: { formality: 'casual', allowEmoji: true } });
  const draft = draftMessage(unconfirmed, event());
  assert.match(draft.text, /축하드려요/);
  assert.doesNotMatch(draft.text, /🎂/u);
  const confirmed = person({ selfTone: observed, recipientPreference: { confirmed: true, formality: 'casual', allowEmoji: true } });
  assert.match(draftMessage(confirmed, event()).text, /축하해! 🎂/u);
  assert.equal(draft.method, 'template');
  assert.equal(draft.needsReview, true);
});

test('부고·기일은 친근한 선호와 웃음·이모지 관찰이 있어도 차분한 초안만 낸다', () => {
  const p = person({ selfTone: analyzeTone('생일 축하해 ㅋㅋ 😊'), recipientPreference: { confirmed: true, formality: 'casual', allowEmoji: true } });
  for (const type of ['condolence', 'memorial']) {
    const draft = draftMessage(p, event({ type, date: '2026-10-06' }));
    assert.doesNotMatch(draft.text, /[ㅋㅎ]|\p{Extended_Pictographic}|축하|밥|보내줄/gu);
    assert.match(draft.cautions.join(' '), /상황과 종교/);
  }
});

test('직접 확인한 메시지 길이가 모든 행사 초안에 반영된다', () => {
  const short = person({ recipientPreference: { confirmed: true, length: 'short' } });
  const balanced = person({ recipientPreference: { confirmed: true, length: 'balanced' } });
  for (const type of ['birthday', 'wedding', 'condolence', 'memorial', 'anniversary']) {
    const e = event({ type, date: '2026-10-06' });
    assert.ok(draftMessage(balanced, e).text.length > draftMessage(short, e).text.length, type);
  }
});

test('사용자의 초안 수정과 이유를 보존하며 선호 학습으로 가장하지 않는다', () => {
  const original = state();
  const changed = recordDraft(original, { personId: 'p_1', eventId: 'e_1', originalText: '생일 축하해!', text: '생일 축하한다!', preferenceNote: '느낌표 줄이기' }, now);
  assert.equal(changed.drafts[0].text, '생일 축하한다!');
  assert.equal(changed.drafts[0].preferenceNote, '느낌표 줄이기');
  assert.equal(original.drafts.length, 0);
  assert.deepEqual(changed.people, original.people);
  assert.throws(() => recordDraft(original, { personId: 'bad', eventId: 'e_1', originalText: 'a', text: 'b' }, now));
});

test('ICS는 다음 1회·한국 시간·알림을 내보내고 텍스트 삽입을 안전하게 처리한다', () => {
  const malicious = event({ title: '생일\r\nATTENDEE:bad@example.com', location: '서울, 강남; 2층\\홀', time: '13:30' });
  const ics = toICS(malicious, person(), now);
  assert.match(ics, /DTSTART;TZID=Asia\/Seoul:20261006T133000/);
  assert.match(ics, /BEGIN:VTIMEZONE/);
  assert.match(ics, /TRIGGER:-P7D/);
  assert.match(ics, /TRIGGER:PT0M/);
  assert.doesNotMatch(ics, /\r\nATTENDEE:/);
  assert.match(ics, /\\nATTENDEE:/);
  assert.doesNotMatch(ics, /RRULE:/);
  assert.match(ics, /LOCATION:서울\\, 강남\\; 2층\\\\홀/);
  const allDay = toICS(event({ title: '한'.repeat(90) }), person(), now);
  assert.match(allDay, /DTSTART;VALUE=DATE:20261006/);
  assert.match(allDay, /DTEND;VALUE=DATE:20261007/);
  for (const line of allDay.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `${Buffer.byteLength(line)} byte line`);
  assert.equal(allDay.replace(/\r\n /g, '').includes('한'.repeat(90)), true);
});

test('확인한 호칭·덧붙일 말·답장 부담만 반영하며 금지 표현은 문장 단위로 제외한다', () => {
  const preferences = { confirmed: true, formality: 'casual', salutation: '지훈아', closingLine: '어제 도와줘서 고마워. 나이는 비밀이다!', noReplyPressure: true, avoidPhrases: ['나이'], note: '상대가 야근 중' };
  const p = person({ recipientPreference: preferences });
  const draft = draftMessage(p, event(), { approach: 'warm' });
  assert.match(draft.text, /^지훈아, 생일 축하해!/);
  assert.match(draft.text, /어제 도와줘서 고마워/);
  assert.match(draft.text, /답장은 편할 때/);
  assert.doesNotMatch(draft.text, /나이|비밀|야근/);
  assert.deepEqual(draft.removedPhrases, ['나이']);
  assert.match(draft.cautions.join(' '), /자유롭게 적은 선호 메모는 문구에 자동 반영되지/);
  const notConfirmed = draftMessage(person({ recipientPreference: { ...preferences, confirmed: false } }), event());
  assert.doesNotMatch(notConfirmed.text, /지훈아|어제|답장/);
  const empty = draftMessage(person({ recipientPreference: { confirmed: true, avoidPhrases: ['생일'] } }), event());
  assert.equal(empty.text, '');
  assert.equal(empty.needsComposition, true);
  assert.equal(empty.needsReview, true);
  assert.throws(() => person({ recipientPreference: { avoidPhrases: '나이' } }));
  assert.throws(() => person({ recipientPreference: { avoidPhrases: Array(21).fill('나이') } }));
});

test('문구를 복사한 것만으로 재사용하지 않고 명시 기억을 종류·사람별로 분리한다', () => {
  const original = state();
  const copied = recordDraft(original, { personId: 'p_1', eventId: 'e_1', originalText: '생일 축하해!', text: '올해는 우리 좀 자주 보자.' }, now);
  assert.equal(draftMessage(copied.people[0], event(), { approach: 'saved' }).method, 'template');
  const remembered = rememberDraft(copied, { personId: 'p_1', eventId: 'e_1', text: '오랜 친구야,\n생일 축하한다.' }, now);
  const draft = draftMessage(remembered.people[0], event(), { approach: 'saved' });
  assert.equal(draft.method, 'saved');
  assert.equal(draft.text, '오랜 친구야,\n생일 축하한다.');
  assert.equal(draftMessage(remembered.people[0], event({ type: 'anniversary' }), { approach: 'saved' }).method, 'template');
  assert.deepEqual(original.people[0].savedMessages, {});
  assert.deepEqual(copied.people[0].savedMessages, {});
  assert.throws(() => rememberDraft(copied, { personId: 'p_wrong', eventId: 'e_1', text: '다른 사람' }, now));
  assert.ok(draftMessage(person(), event(), { approach: 'warm' }).text.length > draftMessage(person(), event(), { approach: 'short' }).text.length);
});

test('기억한 위로 문구도 이모지·웃음 표지·금지 표현을 통과시키지 않는다', () => {
  const p = person({ recipientPreference: { confirmed: true, allowEmoji: true, noReplyPressure: true, avoidPhrases: ['명복'], closingLine: '힘내 ㅋㅋ! 마음으로 함께하겠습니다. 💐' } });
  const e = event({ type: 'condolence', date: '2026-10-06' });
  const remembered = rememberDraft(state(p, e), { personId: p.id, eventId: e.id, text: '삼가 고인의 명복을 빕니다. 농담이야! 💐 위로의 마음을 전합니다. 답장 꼭 해줘.' }, now);
  const draft = draftMessage(remembered.people[0], e, { approach: 'saved' });
  assert.equal(draft.method, 'saved');
  assert.doesNotMatch(draft.text, /[ㅋㅎ]|농담|명복|꼭|\p{Extended_Pictographic}/u);
  assert.match(draft.text, /위로의 마음/);
  assert.doesNotMatch(draft.text, /답장은 편하실 때/);
  assert.match(draft.cautions.join(' '), /숨은 뜻이나 농담을 판별하는 기능은 아니/);
});

test('타임라인은 복사·실제 연락·조용히 기억하기를 구분하고 과거 행사 이름을 보존한다', () => {
  let value = state();
  value = recordDraft(value, { personId: 'p_1', eventId: 'e_1', originalText: '', text: '직접 쓴 말', occurrenceId: 'e_1:2026-10-06' }, now);
  value = completeEvent(value, 'e_1', '2026-10-05T04:00:00Z', 'e_1:2026-10-06', { action: 'remembered' });
  value = { ...value, events: [event({ title: '새 행사 이름', type: 'anniversary' })] };
  const timeline = personTimeline(value, 'p_1');
  assert.deepEqual(timeline.map(item => item.kind), ['completed', 'copied']);
  assert.equal(timeline[0].action, 'remembered');
  assert.equal(timeline[0].eventType, 'birthday');
  assert.equal(timeline[0].eventTitle, '생일');
  assert.equal(timeline[1].text, '직접 쓴 말');
  assert.equal(timeline[1].originalText, '');
  assert.equal(timeline[1].occurrenceId, 'e_1:2026-10-06');
  assert.equal(timeline[1].action, undefined);
  assert.deepEqual(personTimeline(value, 'other_person'), []);
  assert.equal(completeEvent(state(), 'e_1', now).completions[0].action, 'contacted');
  assert.throws(() => completeEvent(state(), 'e_1', now, undefined, { action: 'sent_automatically' }));
});

test('백업 왕복은 과거 v1 기록과 명시 문구를 보존하고 원문·녹음·화면 상태는 제외한다', () => {
  let original = recordDraft(state(), { personId: 'p_1', eventId: 'e_1', originalText: '원래 문구', text: '수정한 문구', occurrenceId: 'e_1:2026-10-06' }, now);
  original = rememberDraft(original, { personId: 'p_1', eventId: 'e_1', text: '다음에도 쓸 말' }, now);
  original = completeEvent(original, 'e_1', now, undefined, { action: 'remembered' });
  original.rawConversation = '대화 원문'; original.audio = '녹음'; original.people[0].transcript = '녹취 원문'; original.selectedPersonId = 'p_1';
  const backup = exportBackup(original, now);
  const restored = importBackup(JSON.stringify(backup));
  assert.equal(restored.people[0].savedMessages.birthday.text, '다음에도 쓸 말');
  assert.equal(restored.drafts[0].id, original.drafts[0].id);
  assert.equal(restored.drafts[0].originalText, '원래 문구');
  assert.equal(restored.completions[0].action, 'remembered');
  assert.doesNotMatch(JSON.stringify(backup), /대화 원문|녹취 원문|녹음|selectedPersonId/);
  assert.equal(backup.exportedAt, now.toISOString());
  assert.equal(restored.exportedAt, undefined);
  const legacy = structuredClone(backup);
  delete legacy.people[0].savedMessages;
  for (const key of ['personId', 'eventType', 'eventTitle', 'action']) delete legacy.completions[0][key];
  for (const key of ['eventType', 'eventTitle', 'occurrenceId']) delete legacy.drafts[0][key];
  const old = importBackup(legacy);
  assert.equal(old.completions[0].action, 'contacted');
  assert.equal(old.drafts[0].id, original.drafts[0].id);
  assert.equal(old.drafts[0].text, '수정한 문구');
  assert.equal(original.rawConversation, '대화 원문');
  restored.people[0].name = '복원본만 수정';
  assert.equal(original.people[0].name, '지훈');
});

test('손상된 백업의 중복·끊긴 참조·상한·잘못된 회차는 원본을 건드리지 않고 거부한다', () => {
  let original = recordDraft(state(), { personId: 'p_1', eventId: 'e_1', originalText: 'a', text: 'b' }, now);
  original = completeEvent(original, 'e_1', now);
  const before = JSON.stringify(original);
  const invalid = mutate => { const copy = structuredClone(original); mutate(copy); assert.throws(() => importBackup(copy)); assert.equal(JSON.stringify(original), before); };
  invalid(copy => copy.people.push(copy.people[0]));
  invalid(copy => copy.events.push(copy.events[0]));
  invalid(copy => copy.drafts.push(copy.drafts[0]));
  invalid(copy => copy.completions.push(copy.completions[0]));
  invalid(copy => { copy.events[0].personId = 'missing'; });
  invalid(copy => { copy.drafts[0].personId = 'missing'; });
  invalid(copy => { copy.completions[0].eventId = 'missing'; });
  invalid(copy => { copy.completions[0].date = '2026-10-07'; });
  invalid(copy => { copy.drafts[0].occurrenceId = 'other:2026-10-06'; });
  invalid(copy => { delete copy.people[0].id; });
  invalid(copy => { copy.people = Array(1001).fill(copy.people[0]); });
  invalid(copy => { copy.version = 2; });
  invalid(copy => { copy.drafts[0].createdAt = '2026-02-30T00:00:00Z'; });
  invalid(copy => { copy.drafts[0].createdAt = '2026-10-06T24:00:00Z'; });
  assert.throws(() => importBackup('{invalid'));
  assert.throws(() => importBackup(' '.repeat(4 * 1024 * 1024 + 1)));
});

test('음력 반복은 한국 날짜의 실제 다음 회차를 쓰고 완료·ICS·백업에도 같은 날짜가 이어진다', () => {
  const e = event({ calendar: 'lunar', date: '1990-08-15' });
  const before = '2026-09-24T03:00:00Z';
  const next = nextOccurrence(e, before);
  assert.equal(next.date, '2026-09-25');
  assert.equal(next.lunarDate, '2026-08-15');
  assert.equal(next.daysUntil, 1);
  assert.equal(nextOccurrence(e, '2026-09-24T15:00:00Z').daysUntil, 0);
  const done = completeEvent(state(person(), e), e.id, before, next.occurrenceId);
  const later = upcomingEvents(done, before)[0].occurrence;
  assert.equal(later.lunarDate, '2027-08-15');
  assert.notEqual(later.date, '2027-09-25');
  const ics = toICS(e, person(), before, later.date).replace(/\r\n /g, '');
  assert.match(ics, new RegExp(`DTSTART;VALUE=DATE:${later.date.replaceAll('-', '')}`));
  assert.match(ics, /음력 1990-08-15/);
  assert.doesNotMatch(ics, /RRULE:/);
  const restored = importBackup(exportBackup(done, now));
  assert.equal(restored.events[0].calendar, 'lunar');
  assert.equal(restored.events[0].date, '1990-08-15');
  assert.equal(upcomingEvents(restored, before)[0].occurrence.date, later.date);
});

test('음력 윤달·작은달·연초·범위 끝은 명시한 정책에 따라 처리한다', () => {
  const leap = event({ calendar: 'lunar', date: '2025-06-01', lunarLeapMonth: true });
  assert.equal(nextOccurrence(leap, '2026-01-01').date, '2026-07-14');
  const onlyLeap = nextOccurrence({ ...leap, lunarLeapPolicy: 'leap-only' }, '2026-01-01');
  assert.equal(onlyLeap.lunarLeapMonth, true);
  assert.ok(onlyLeap.lunarDate > '2026-12-31');
  const shortMonth = event({ calendar: 'lunar', date: '2023-02-30' });
  assert.equal(nextOccurrence(shortMonth, '2025-01-01').lunarDate, '2025-02-29');
  assert.equal(nextOccurrence({ ...shortMonth, lunarShortMonthPolicy: 'skip' }, '2025-01-01').lunarDate, '2027-02-30');
  const yearEnd = event({ calendar: 'lunar', date: '2024-12-15' });
  assert.equal(nextOccurrence(yearEnd, '2025-01-01').lunarDate, '2024-12-15');
  const oneTime = event({ calendar: 'lunar', date: '2026-08-15', repeat: 'none' });
  assert.equal(nextOccurrence(oneTime, '2026-09-26'), null);
  assert.equal(nextOccurrence(oneTime, '2026-09-24').date, '2026-09-25');
  assert.equal(nextOccurrence(leap, '2051-01-01'), null);
  assert.equal(nextOccurrence(event({ calendar: 'lunar', date: '2050-11-18' }), '2050-12-31').date, '2050-12-31');
  assert.throws(() => event({ calendar: 'lunar', date: '2050-11-19' }));
});
