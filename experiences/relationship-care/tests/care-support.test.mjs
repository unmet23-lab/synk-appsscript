import test from 'node:test';
import assert from 'node:assert/strict';
import { makePerson, makeEvent, emptyState, defaultDraftApproach } from '../model.mjs';
import { SUPPORT_ENGINES, compareDraftEdits, applyPreferenceCandidate, reviewMessage, extractFollowupCandidates, followupRows, planFollowupAction } from '../care-support.mjs';

const today = '2026-10-06';
const person = makePerson({ id: 'p1', name: '다온', recipientPreference: { confirmed: true, length: 'balanced', allowEmoji: true, avoidPhrases: ['힘내'], noReplyPressure: true, closingLine: '편할 때 답해 줘.' } });
const people = [person, makePerson({ id: 'p2', name: '지민' })];
const event = makeEvent({ id: 'e1', personId: 'p1', type: 'wedding', date: '2026-10-10' });

test('visible edits need explicit confirmation and preserve the existing preference fields', () => {
  const before = '다온아, 생일 진심으로 축하하고 오늘 하루 좋은 일만 가득하길 바라! 🎂';
  const candidates = compareDraftEdits({ before, after: '다온아, 생일 축하해!' });
  assert.ok(candidates.every(item => item.requiresConfirmation));
  const short = candidates.find(item => item.kind === 'shorter'), noEmoji = candidates.find(item => item.kind === 'no-emoji');
  assert.throws(() => applyPreferenceCandidate(person, short), /확인/);
  const applied = applyPreferenceCandidate(person, short, { confirmed: true });
  assert.equal(applied.recipientPreference.length, 'short');
  assert.equal(applied.recipientPreference.closingLine, person.recipientPreference.closingLine);
  assert.equal(applied.recipientPreference.noReplyPressure, true);
  assert.equal(applyPreferenceCandidate(applied, noEmoji, { confirmed: true }).recipientPreference.allowEmoji, false);
  assert.equal(person.recipientPreference.length, 'balanced');
  assert.throws(() => applyPreferenceCandidate(person, { ...short, patch: { allowEmoji: true } }, { confirmed: true }), /후보/);
  assert.equal(SUPPORT_ENGINES.expression, 'vellum-expression-1');
});

test('a removed phrase is a candidate, deduplicates only after confirmation and obeys the model limit', () => {
  const candidate = compareDraftEdits({ before: '다온아, 힘내. 오늘 잘 보내.', after: '다온아, 오늘 잘 보내.' }).find(item => item.kind === 'avoid-phrase');
  assert.equal(candidate.patch.avoidPhrase, '힘내');
  assert.deepEqual(applyPreferenceCandidate(person, candidate, { confirmed: true }).recipientPreference.avoidPhrases, ['힘내']);
  const full = makePerson({ ...person, recipientPreference: { ...person.recipientPreference, avoidPhrases: Array.from({ length: 20 }, (_, i) => `표현${i}`) } });
  assert.throws(() => applyPreferenceCandidate(full, candidate, { confirmed: true }), /20개/);
  assert.deepEqual(compareDraftEdits({ before: '반가워', after: '반가워' }), []);
});

test('confirming one candidate cannot activate or discard other unconfirmed settings', () => {
  const candidate = compareDraftEdits({ before: '다온아, 생일 진심으로 축하하고 오늘 하루 좋은 일만 가득하길 바라!', after: '다온아, 생일 축하해!' }).find(item => item.kind === 'shorter');
  const savedSettings = [
    { salutation: '미확인호칭', avoidPhrases: ['미확인'] },
    { formality: 'polite' }, { length: 'balanced' }, { allowEmoji: true },
    { avoidPromises: false }, { noReplyPressure: true }, { closingLine: '미확인 맺음말' }, { note: '아직 확인할 메모' },
  ];
  for (const preference of savedSettings) {
    const unconfirmed = makePerson({ id: 'new-person', name: '다온', recipientPreference: { ...preference, confirmed: false } });
    const original = structuredClone(unconfirmed);
    assert.throws(() => applyPreferenceCandidate(unconfirmed, candidate, { confirmed: true }), /대화와 말투에서 기존 표현 설정을 먼저 확인/);
    assert.deepEqual(unconfirmed, original, 'the unconfirmed values and flag remain unchanged');
  }
});

test('a person with only default preferences can explicitly confirm an individual candidate', () => {
  const candidate = compareDraftEdits({ before: '다온아, 힘내. 오늘 잘 보내.', after: '다온아, 오늘 잘 보내.' }).find(item => item.kind === 'avoid-phrase');
  const fresh = makePerson({ id: 'new-person', name: '다온' });
  const applied = applyPreferenceCandidate(fresh, candidate, { confirmed: true });
  assert.equal(applied.recipientPreference.confirmed, true);
  assert.deepEqual(applied.recipientPreference.avoidPhrases, ['힘내']);
  assert.equal(applied.recipientPreference.length, 'balanced');
  assert.deepEqual({ ...applied.recipientPreference, confirmed: false, length: fresh.recipientPreference.length, avoidPhrases: [] }, fresh.recipientPreference);
  assert.equal(fresh.recipientPreference.confirmed, false);
});

test('first confirmation of emoji or phrase preferences preserves the warm initial draft choice', () => {
  const candidates = [
    compareDraftEdits({ before: '다온아, 고마워 🙂', after: '다온아, 고마워' }).find(item => item.kind === 'no-emoji'),
    compareDraftEdits({ before: '다온아, 힘내. 오늘 잘 보내.', after: '다온아, 오늘 잘 보내.' }).find(item => item.kind === 'avoid-phrase'),
  ];
  for (const candidate of candidates) {
    assert.ok(candidate);
    const fresh = makePerson({ id: 'new-person', name: '다온' });
    const original = structuredClone(fresh);
    assert.equal(defaultDraftApproach(fresh, 'checkin'), 'warm');
    const applied = applyPreferenceCandidate(fresh, candidate, { confirmed: true });
    assert.equal(defaultDraftApproach(applied, 'checkin'), 'warm', candidate.kind);
    assert.equal(applied.recipientPreference.length, 'balanced');
    assert.equal(applied.recipientPreference.confirmed, true);
    if (candidate.kind === 'no-emoji') assert.equal(applied.recipientPreference.allowEmoji, false);
    else assert.deepEqual(applied.recipientPreference.avoidPhrases, ['힘내']);
    assert.deepEqual(fresh, original);
  }
});

test('unrelated preferences preserve a confirmed length and an explicit shorter choice still applies', () => {
  const noEmoji = compareDraftEdits({ before: '다온아, 고마워 🙂', after: '다온아, 고마워' }).find(item => item.kind === 'no-emoji');
  const avoidPhrase = compareDraftEdits({ before: '다온아, 힘내. 오늘 잘 보내.', after: '다온아, 오늘 잘 보내.' }).find(item => item.kind === 'avoid-phrase');
  for (const length of ['short', 'balanced']) {
    const confirmedPerson = makePerson({ id: 'confirmed', name: '다온', recipientPreference: { confirmed: true, length } });
    for (const candidate of [noEmoji, avoidPhrase]) {
      const applied = applyPreferenceCandidate(confirmedPerson, candidate, { confirmed: true });
      assert.equal(applied.recipientPreference.length, length);
      assert.equal(defaultDraftApproach(applied, 'checkin'), length === 'short' ? 'short' : 'warm');
    }
  }
  const shorter = compareDraftEdits({ before: '다온아, 생일 진심으로 축하하고 오늘 하루 좋은 일만 가득하길 바라!', after: '다온아, 생일 축하해!' }).find(item => item.kind === 'shorter');
  const applied = applyPreferenceCandidate(makePerson({ id: 'fresh', name: '다온' }), shorter, { confirmed: true });
  assert.equal(applied.recipientPreference.length, 'short');
  assert.equal(defaultDraftApproach(applied, 'checkin'), 'short');
});

test('review returns exact evidence for saved phrases, another name, date mismatch and a future action', () => {
  const text = '지민아, 힘내. 2026-10-11에 꼭 찾아갈게.';
  const result = reviewMessage({ text, person, people, event, today });
  assert.deepEqual(result.issues.map(item => item.kind), ['other-name', 'avoid-phrase', 'date-mismatch', 'promise-confirmation']);
  assert.ok(result.issues.every(item => text.slice(item.evidence.start, item.evidence.end) === item.evidence.quote && item.alternative && item.message));
  assert.equal(result.issues.find(item => item.kind === 'date-mismatch').evidence.expected, '2026-10-10');
  assert.equal(result.needsReview, true);
  assert.equal(result.limits.length, 2);
  assert.ok(result.limits.some(line => line.includes('표시가 없어도')));
});

test('date checks distinguish invalid solar days, ambiguous relative dates and lunar 2/30', () => {
  const result = reviewMessage({ text: '2026-02-30, 내일, 10월 10일, 음력 2월 30일을 확인해.', person, today });
  assert.deepEqual(result.issues.map(item => item.kind), ['invalid-date', 'date-confirmation', 'date-confirmation', 'date-confirmation']);
  assert.equal(reviewMessage({ text: '2026-10-10에 만나.', person, event, today }).issues.length, 0);
  assert.throws(() => reviewMessage({ text: '확인', person, event: { ...event, personId: 'p2' }, today }), /사람과 일정/);
});

test('lunar events compare the solar occurrence and date handling uses the Korean day', () => {
  const lunar = makeEvent({ id: 'lunar', personId: 'p1', type: 'birthday', calendar: 'lunar', date: '1995-01-01' });
  const result = reviewMessage({ text: '2026-02-17 생일 축하해.', person, event: lunar, today: '2026-01-01' });
  assert.equal(result.issues.length, 0);
  const relative = reviewMessage({ text: '내일 연락할게.', person, today: '2026-10-05T15:01:00Z' });
  assert.equal(relative.issues.find(item => item.kind === 'date-confirmation').candidate, '2026-10-07');
});

test('explicit lunar leap-month wording remains a confirmation cue, and month digits are not truncated', () => {
  const text = '음력 2026년 윤2월 30일에 전화하기.';
  const result = reviewMessage({ text, person, today });
  assert.deepEqual(result.issues.map(item => item.kind), ['date-confirmation']);
  assert.equal(extractFollowupCandidates(text, { today })[0].dueOn, '');
  assert.equal(reviewMessage({ text: '110월 10일', person, today }).issues.length, 0);
});

test('names do not match inside longer names and unconfirmed preferences are not silently enforced', () => {
  const unconfirmed = makePerson({ ...person, recipientPreference: { ...person.recipientPreference, confirmed: false } });
  assert.deepEqual(reviewMessage({ text: '한지민과 다온이 힘내라고 했어.', person: unconfirmed, people, today }).issues, []);
  const sameName = [person, { ...people[1], name: person.name }];
  assert.equal(reviewMessage({ text: '다온아, 반가워.', person, people: sameName, today }).issues.length, 0);
  assert.equal(reviewMessage({ text: '연락할게.', person, today, confirmedPromises: ['연락할게'] }).issues.length, 0);
  assert.equal(reviewMessage({ text: '연락했어.', person, today }).issues.length, 0);
});

test('polite future actions are exact review cues without changing the draft or confirming a promise', () => {
  for (const [text, quote] of [
    ['곧 찾아뵙겠습니다.', '찾아뵙겠습니다'],
    ['행사에 참석하겠습니다.', '참석하겠습니다'],
    ['조만간 선물을 보내 드릴게요.', '보내 드릴게요'],
    ['확인 후 연락드리겠습니다.', '연락드리겠습니다'],
    ['곧 찾아뵐게요.', '찾아뵐게요'],
    ['다시 전화 드리겠습니다.', '전화 드리겠습니다'],
    ['제가 도와드릴게요.', '도와드릴게요'],
    ['필요한 자료를 보내드리겠습니다.', '보내드리겠습니다'],
    ['꼭 연락드릴게요.', '꼭 연락드릴게요'],
    ['선물을 보내겠습니다.', '보내겠습니다'],
  ]) {
    const input = { text, person: structuredClone(person), today };
    const original = structuredClone(input);
    const result = reviewMessage(input);
    assert.deepEqual(result.issues.map(item => item.kind), ['promise-confirmation'], text);
    const issue = result.issues[0];
    assert.equal(issue.evidence.quote, quote, text);
    assert.equal(text.slice(issue.evidence.start, issue.evidence.end), quote);
    assert.match(issue.message, /표면 표현/);
    assert.equal(result.method, 'surface-rules');
    assert.equal(result.needsReview, true);
    assert.deepEqual(input, original);
    assert.equal(reviewMessage({ ...input, confirmedPromises: [quote] }).issues.length, 0);
  }
});

test('past, questions, suggestions, direct negatives and attached reported endings are not future action cues', () => {
  for (const text of [
    '찾아뵈었습니다.', '행사에 참석했습니다.', '선물을 보내 드렸어요.', '연락드렸습니다.',
    '보내 드릴까요?', '보내드릴까요?', '도와드릴까요?', '함께 참석합시다.', '찾아뵙는 게 어떨까요?',
    '안 갈게.', '못 찾아뵙겠습니다.', '이번에는 안 참석하겠습니다.', '꼭 안 연락드릴게요.',
    '안 꼭 연락드리겠습니다.', '보내 드리지 않겠습니다.', '참석하지 않겠습니다.',
    '참석하겠다고 했습니다.', '연락드리겠습니다라고 적었어요.', '찾아뵙겠습니다만 확정은 아니에요.',
    '연락드릴게요?', '보내 드릴게요  ？',
  ]) {
    assert.deepEqual(reviewMessage({ text, person, today }).issues, [], text);
  }
});

test('quoted future wording remains a source cue and does not identify who promised', () => {
  const text = '상대가 “찾아뵙겠습니다”라고 말했어요.';
  const result = reviewMessage({ text, person, today });
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].kind, 'promise-confirmation');
  assert.equal(result.issues[0].evidence.quote, '찾아뵙겠습니다');
  assert.equal(result.method, 'surface-rules');
  assert.ok(result.limits.some(line => line.includes('뜻·상황·상대의 기분을 이해한 결과가 아니에요')));
  assert.ok(result.limits.some(line => line.includes('직접 확인')));
});

test('promise patterns require complete endings and retain the 5000-character input limit', () => {
  for (const text of ['찾아뵙겠습니다의뜻', '연락드리겠습니', '연락드리겠습니다'.repeat(500)]) {
    assert.ok(text.length <= 5000);
    assert.deepEqual(reviewMessage({ text, person, today }).issues, []);
  }
  const text = `${' '.repeat(4989)}연락드리겠습니다.`;
  assert.ok(text.length <= 5000);
  const issue = reviewMessage({ text, person, today }).issues[0];
  assert.equal(text.slice(issue.evidence.start, issue.evidence.end), '연락드리겠습니다');
  assert.throws(() => reviewMessage({ text: ' '.repeat(5001), person, today }), /5,000자/);
});

test('follow-up candidates keep exact source quotes and written dates still require confirmation', () => {
  const text = '  2026.10.15에 이사 잘했는지 연락해 보기.  \n내일 검사 결과를 물어봐 줘.\n10월 20일에 안부 전화.\n평범한 인사야.';
  const candidates = extractFollowupCandidates(text, { today });
  assert.equal(candidates.length, 3);
  assert.deepEqual(candidates.map(item => item.dueOn), ['2026-10-15', '', '']);
  assert.ok(candidates.every(item => item.needsDateConfirmation && text.includes(item.sourceQuote)));
  const first = candidates[0];
  assert.equal(first.sourceQuote.slice(first.dateEvidence.start, first.dateEvidence.end), '2026.10.15');
  assert.equal(first.dueDate, first.dueOn);
});

test('multiple dates, lunar dates and relative hints never pick an automatic follow-up day', () => {
  for (const text of ['2026-10-07 결과, 2026-10-09 연락.', '다음 주에 안부 물어보기.', '음력 2026년 2월 30일에 전화하기.']) {
    const candidates = extractFollowupCandidates(text, { today });
    assert.equal(candidates.length, 1); assert.equal(candidates[0].dueOn, '');
  }
  assert.deepEqual(extractFollowupCandidates('2026-10-07 생일 축하해!', { today }), []);
  assert.deepEqual(extractFollowupCandidates('2026-02-30에 연락하기.', { today }), []);
  assert.throws(() => extractFollowupCandidates('a'.repeat(50001), { today }));
});

test('follow-up rows call Trail, keep person associations and actions do not mutate state', () => {
  const followup = { id: 'f1', personId: 'p1', title: '이사 뒤 안부', dueOn: today, status: 'pending' };
  const state = { ...emptyState(), people, followups: [followup, { ...followup, id: 'f2', personId: 'p2', dueOn: '2026-10-05' }] };
  const original = JSON.stringify(state), rows = followupRows(state, { today, personId: 'p1' });
  assert.equal(rows.version, SUPPORT_ENGINES.followup);
  assert.equal(rows.pending.length, 1); assert.equal(rows.pending[0].person.name, person.name);
  assert.equal(rows.pending[0].dueLabel, '오늘 다시 챙기기');
  assert.equal(planFollowupAction(followup, { action: 'now', today }).patch, null);
  assert.deepEqual(planFollowupAction(followup, { action: 'later', today, dueOn: '2026-10-08' }).patch, { dueOn: '2026-10-08', status: 'pending' });
  assert.deepEqual(planFollowupAction(followup, { action: 'done', today }).patch, { status: 'done' });
  assert.equal(JSON.stringify(state), original);
});
