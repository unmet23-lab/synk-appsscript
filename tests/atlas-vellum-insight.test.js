'use strict';
// 「내 성향」 sentences (atlas/vellum-insight.js): the order of the 「지금의 나」 rules, words that
// only tell what happened, and Korean particles that follow the word they attach to.
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../atlas/vellum-insight');
const at = '2026-10-19T03:00:00.000Z';
const practice = fields => ({ answered: 0, independent: 0, lastAt: null, recent: null, previous: null, comparable: false, strong: null, topics: [], ...fields });
const period = (answered, independent, assisted, activeDays) => ({ answered, independent, assisted, activeDays });
const now = fields => V.memberInsightNow({ connected: true, at, ...fields });

test('the connection off comes first and promises nothing it cannot show', () => {
  const off = V.memberInsightNow({ connected: false, reasons: ['한국 여행'], at, practice: practice({ answered: 40, recent: period(20, 9, 1, 8) }) });
  assert.equal(off.kind, 'disconnected');
  assert.doesNotMatch(off.headline + off.support.join(' '), /\d+번/, 'practice counts are never read while the connection is off');
  assert.match(off.support[0], /배우는 이유만 보여요/);
});

test('independent answers that went up lead; "처음으로" only when there were none before at all', () => {
  const grew = now({ practice: practice({ answered: 30, independent: 11, recent: period(20, 8, 4, 6), previous: period(10, 3, 2, 3), comparable: true }) });
  assert.equal(grew.kind, 'growth');assert.equal(grew.headline, '최근 30일, 혼자 답한 횟수가 3번에서 8번으로 늘었어요.');
  const first = now({ practice: practice({ answered: 10, independent: 4, recent: period(8, 4, 1, 3), previous: period(2, 0, 2, 1), comparable: true }) });
  assert.equal(first.headline, '최근 30일, 처음으로 혼자 4번 답했어요.');
  const again = now({ practice: practice({ answered: 40, independent: 9, recent: period(8, 4, 1, 3), previous: period(2, 0, 2, 1), comparable: true }) });
  assert.equal(again.headline, '최근 30일, 혼자 답한 횟수가 0번에서 4번으로 늘었어요.', 'earlier independent answers rule out "처음으로"');
  // Not comparable windows never claim growth.
  assert.notEqual(now({ practice: practice({ answered: 30, independent: 11, recent: period(20, 8, 4, 6), previous: period(10, 3, 2, 3), comparable: false }) }).kind, 'growth');
});

test('a fall is never said: the headline moves to the next rule', () => {
  const fell = now({ practice: practice({ answered: 30, independent: 9, recent: period(9, 2, 1, 4), previous: period(21, 7, 3, 9), comparable: true }) });
  assert.equal(fell.kind, 'volume');assert.equal(fell.headline, '최근 30일 동안 4일, 9번 답했어요.');
  assert.doesNotMatch(JSON.stringify(fell), /줄었|떨어|낮아|못했/);
});

test('one day of practice says the day and what was practised, and invites one more try', () => {
  const day = now({ practice: practice({ answered: 6, lastAt: '2026-10-18T09:00:00.000Z', recent: period(6, 0, 4, 1), previous: period(0, 0, 0, 0),
    topics: [{ label: '-(으)세요', kind: 'grammar_point', count: 3, activeDays: 1 }, { label: '-아요/어요', kind: 'grammar_point', count: 2, activeDays: 1 }, { label: '카페', kind: 'situation', count: 1, activeDays: 1 }] }) });
  assert.equal(day.kind, 'one-day');assert.equal(day.headline, '어제, 처음으로 6번 답했어요.');
  assert.deepEqual(day.support, ['-(으)세요 같은 표현 두 가지를 도움 받으며 연습했어요.', '이번엔 혼자 한 번 해 볼까요? 틀려도 괜찮아요.']);
  const later = now({ practice: practice({ answered: 20, lastAt: '2026-10-16T09:00:00.000Z', recent: period(6, 2, 1, 1), previous: period(0, 0, 0, 0) }) });
  assert.equal(later.headline, '사흘 전 6번 답했어요.', 'older answers outside the window rule out "처음으로"');
});

test('practice before the last 30 days is the person\'s record, never "nothing yet"', () => {
  const quiet = now({ reasons: ['시험·자격'], practice: practice({ answered: 12, lastAt: '2026-08-30T09:00:00.000Z', recent: period(0, 0, 0, 0), previous: period(0, 0, 0, 0) }) });
  assert.equal(quiet.kind, 'quiet');assert.equal(quiet.headline, '최근 30일에는 연습 기록이 없어요. 마지막 연습은 8월 30일이에요.');
  assert.doesNotMatch(quiet.headline, /아직/);
});

test('without practice the first thing the person told leads, and an empty member is told that nothing is not a weakness', () => {
  assert.equal(now({ reasons: ['한국 여행', '드라마·음악·웹툰'], chosen: ['단계별 도움'], practice: practice({}) }).headline, '한국 여행과 드라마·음악·웹툰 때문에 배우기로 했어요.');
  assert.equal(now({ interests: ['면접 준비', 'AI 도구 활용'], practice: practice({}) }).headline, '관심 주제로 면접 준비와 AI 도구 활용을 골랐어요.');
  const empty = now({ practice: practice({}) });
  assert.equal(empty.kind, 'empty');assert.match(empty.support[0], /기록이 없다고 실력이 없다는 뜻은 아니에요/);
});

test('a confirmed statement is said back whole or not at all', () => {
  const said = V.memberInsightStatement([{ field: 'support', value: 'example', polarity: 'prefer', condition: 'first-try' },
    { field: 'support', value: 'independent', polarity: 'prefer', condition: 'first-try-after-example' }]);
  assert.equal(said, '처음 배울 땐 예시부터 보고, 그다음엔 혼자 해 보고 싶다고 알려 줬어요.');
  assert.equal(V.memberInsightStatement([{ field: 'support', value: 'example', polarity: 'prefer', condition: null }, { field: 'support', value: 'step', polarity: 'avoid', condition: null }]), '',
    'an avoidance cannot be said this way, so no part of the statement is shown');
  assert.equal(V.memberInsightStatement([{ field: 'work-style', value: 'plan-first', polarity: 'prefer', condition: null }]), '');
  const strong = now({ statement: [{ field: 'explanation', value: 'brief', polarity: 'prefer', condition: null }], practice: practice({ answered: 9, independent: 6, strong: '짧은 지시 듣기', recent: period(9, 6, 0, 2) }) });
  assert.equal(strong.headline, '짧은 지시 듣기를 최근 혼자 해냈어요.');assert.equal(strong.support[0], '짧은 설명을 보고 싶다고 알려 줬어요.');
});

test('facts, questions and corrections stay about the record and the answer', () => {
  assert.equal(V.memberInsightPracticeFact({ recent: 5, correct: 4, assisted: 2 }), '이 연습에서 최근 혼자 답한 5번 중 4번 맞혔어요. 도움 받고 맞힌 건 2번이에요.');
  assert.equal(V.memberInsightPracticeFact({ recent: 0, correct: 0 }), '아직 기록이 적어요.');
  assert.throws(() => V.memberInsightPracticeFact({ recent: 2, correct: 3 }));
  assert.equal(V.memberInsightQuestion({ facet: 'practice-mode', label: '듣기' }), '듣기로 하는 연습이 나와 맞나요?');
  assert.equal(V.memberInsightQuestion({ facet: 'learning-topic', label: '주세요', kind: 'word' }), '더 연습하고 싶은 표현인가요?');
  assert.equal(V.memberInsightQuestion({ facet: 'learning-topic', label: '카페 주문', kind: 'situation' }), '더 배우고 싶은 상황인가요?');
  assert.equal(V.memberCorrectionLine({ kind: 'override', answer: 'not-now' }), '지금은 아니라고 답했어요.');
  assert.equal(V.memberCorrectionLine({ kind: 'override', facet: 'explanation', labels: ['자세히'] }), '설명 길이로 ‘자세히’를 골랐어요.');
  assert.equal(V.memberCorrectionLine({ kind: 'override', facet: 'topics', labels: ['여행지 음식·주문', 'AI 도구 활용'] }), '관심 주제로 여행지 음식·주문과 AI 도구 활용을 골랐어요.');
  for (const line of [V.memberUnderstandingLine({ kind: 'support', label: '단계별 도움', state: 'declared' }), V.memberUnderstandingLine({ kind: 'practice-mode', label: '듣기', count: 7, activeDays: 3, state: 'agreed', periodEnd: at })])
    assert.doesNotMatch(line, /직접 고른 내용:|자신에게|자신의|다음 설명에서도/, 'the retired templates are gone');
});

test('particles follow the last sound, including digits, Latin letters and closing marks', () => {
  assert.equal(V.josa('TOPIK', '을', '를'), 'TOPIK을');assert.equal(V.josa('WORLD', '을', '를'), 'WORLD를');
  assert.equal(V.josa('카페', '을', '를'), '카페를');assert.equal(V.josa('-(으)세요', '을', '를'), '-(으)세요를');
  assert.equal(V.euro('듣기'), '듣기로');assert.equal(V.euro('한국 생활'), '한국 생활로');assert.equal(V.euro('설명 길이'), '설명 길이로');assert.equal(V.euro('관심 주제'), '관심 주제로');
  assert.equal(V.euro('문제 방식'), '문제 방식으로');assert.equal(V.josa('3', '을', '를'), '3을');assert.equal(V.josa('‘단계별 도움’', '을', '를'), '‘단계별 도움’을');
  assert.equal(V.joinAnd(['한국 여행', '드라마·음악·웹툰', '시험·자격']), '한국 여행, 드라마·음악·웹툰과 시험·자격');
  assert.equal(V.dayLabel('2025-12-31T16:00:00.000Z', at), '1월 1일', 'Korea\'s calendar decides the date');
  assert.equal(V.dayLabel('2025-12-30T00:00:00.000Z', at), '2025년 12월 30일', 'another year is named');
});
