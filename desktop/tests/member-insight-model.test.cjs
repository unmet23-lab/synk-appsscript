'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = import('../renderer/member-insight-model.mjs');
const asOf = '2026-10-14T03:00:00.000Z', lastAt = '2026-10-13T03:00:00.000Z';
function fixture() {
  return { ok: true, scope: 'synk-atlas-summary', learning: { enabled: true, revision: 2 }, shared: 'practice-and-settings', summary: {
    version: 'atlas-account-summary-1', asOf, presentation: null, reasons: null, forReasons: [],
    practice: { answered: 0, independent: 0, assisted: 0, lastAt: null, skills: [], content: [] },
    basis: 'cold-start', abilityClaim: false, learningEffectClaim: false, grade: null,
  } };
}
function practiced() {
  const value = fixture();
  Object.assign(value.summary, { reasons: ['travel', 'culture'], presentation: { support: 'step', explanation: 'brief' },
    forReasons: [{ reason: 'travel', situations: [{ id: 'travel.order', label: '주문하기', line: '여행에서 쓸 말을 연습해요.' }] }],
    practice: { answered: 8, independent: 7, assisted: 1, lastAt,
      skills: [{ id: 'ko.listening.detail', label: '세부 내용 듣기', status: 'practice', line: '세부 내용 듣기를 조금 더 연습해 봐요.', recent: 3, correct: 1, assisted: 1, lastAt }],
      content: [{ id: 'ko.word.hello', kind: 'word', label: '안녕하세요', status: 'review' }] },
  });
  return value;
}

test('empty history stays empty without inventing a trait, score, or growth', async () => {
  const { buildMemberInsightReport } = await model, result = buildMemberInsightReport(fixture());
  assert.deepEqual(result.personal, []);assert.deepEqual(result.reasons, []);assert.equal(result.learning.empty, true);
  assert.equal(result.lastAt, null);assert.equal(result.asOf, asOf);assert.match(result.description, /아직 정리할 정보가 없/);
  assert.deepEqual(Object.keys(result).sort(), ['asOf', 'description', 'headline', 'lastAt', 'learning', 'limits', 'personal', 'reasons', 'shared', 'activity', 'understanding', 'now', 'settings', 'settingChoices', 'reasonIds', 'worldReadsAnswers', 'worldFollowsSettings', 'usageLine', 'learningRevision', 'learningEnabled'].sort());
  assert.equal(result.worldReadsAnswers, false);assert.equal(result.worldFollowsSettings, false, 'both turn on in the release that ships WORLD with them');
  // Nothing is said beyond an honest empty state, and no setting is invented.
  assert.equal(result.now.kind, 'empty');assert.match(result.now.headline, /아직 나를 설명할 기록이 없어요/);
  assert.ok(Object.values(result.settings).every(value => value === null));assert.deepEqual(result.reasonIds, []);
  assert.equal(result.activity.status, 'unavailable');assert.equal(result.learning.periods, null);
});

test('projects only declared settings and actual practice counts, including wrong independent answers', async () => {
  const { buildMemberInsightReport } = await model, input = practiced(), before = structuredClone(input), result = buildMemberInsightReport(input);
  assert.deepEqual(input, before, 'the projection does not mutate its source');
  assert.deepEqual(result.personal.map(row => row.id), ['reasons', 'support', 'explanation']);
  assert.ok(result.personal.every(row => row.basis === 'self-declared' && !Object.hasOwn(row, 'at')));
  assert.equal(result.learning.independent, 7);assert.equal(result.learning.skills[0].correct, 1);
  assert.equal(result.learning.answered, 8);assert.equal(result.learning.assisted, 1);assert.equal(result.learning.empty, false);
  assert.deepEqual(result.reasons, [{ label: '한국 여행', line: '여행에서 쓸 말을 연습해요.' }]);
  assert.equal(result.lastAt, lastAt);assert.match(result.limits.join(' '), /오답도 포함/);assert.match(result.limits.join(' '), /최근 30일/);
  assert.match(result.limits.join(' '), /최대 12개/);assert.match(result.limits.join(' '), /한 시점/);
});

test('either consent boundary hides mixed-in settings and practice, even malformed ones', async () => {
  const { buildMemberInsightReport } = await model;
  for (const flags of [{ enabled: false, shared: 'practice-and-settings' }, { enabled: true, shared: 'declared-only' }, { enabled: false, shared: 'declared-only' }]) {
    const input = practiced();input.learning.enabled = flags.enabled;input.shared = flags.shared;
    input.summary.presentation = { support: '<script>secret</script>' };input.summary.practice = { secret: 'not permitted' };
    const result = buildMemberInsightReport(input);
    assert.equal(result.shared, 'declared-only');assert.deepEqual(result.personal.map(row => row.id), ['reasons']);
    assert.equal(result.learning.answered, 0);assert.equal(result.learning.empty, true);assert.equal(result.lastAt, null);
    assert.doesNotMatch(JSON.stringify(result), /secret|not permitted/);
  }
});

test('rejects unknown contracts, broken consent metadata, contradictory counts and invalid dates', async () => {
  const { buildMemberInsightReport } = await model;
  const corruptions = [
    value => { value.ok = false; }, value => { value.scope = 'another-resource'; }, value => { value.learning.enabled = 'yes'; },
    value => { value.learning.revision = -1; }, value => { value.shared = 'everything'; },
    value => { value.summary.version = 'atlas-account-summary-2'; }, value => { value.summary.asOf = 'yesterday'; },
    value => { value.summary.reasons = ['travel', 'travel']; }, value => { value.summary.reasons = ['MBTI']; },
    value => { value.summary.presentation = { support: 'unknown' }; }, value => { value.summary.practice.independent = 99; },
    value => { value.summary.practice.skills[0].recent = 13; }, value => { value.summary.practice.skills[0].correct = 4; },
    value => { value.summary.practice.lastAt = '2026-10-15T00:00:00.000Z'; }, value => { value.summary.practice.skills[0].status = 'genius'; },
    value => { value.summary.abilityClaim = true; }, value => { value.summary.grade = 6; },
    value => { value.summary.forReasons[0].reason = 'work'; },
  ];
  for (const corrupt of corruptions) { const value = practiced();corrupt(value);assert.throws(() => buildMemberInsightReport(value), { code: 'INVALID_INSIGHT_SUMMARY' }); }
  for (const value of [null, [], {}, { ok: true }]) assert.throws(() => buildMemberInsightReport(value), { code: 'INVALID_INSIGHT_SUMMARY' });
});

test('rejects markup and control characters in displayed server strings without echoing the payload', async () => {
  const { buildMemberInsightReport } = await model;
  for (const [section, field] of [['skills', 'label'], ['skills', 'line'], ['content', 'label']]) {
    const input = practiced();input.summary.practice[section][0][field] = '<img src=x onerror=alert(1)>';
    assert.throws(() => buildMemberInsightReport(input), error => error.code === 'INVALID_INSIGHT_SUMMARY' && !error.message.includes('<img'));
  }
  const input = practiced();input.summary.forReasons[0].situations[0].line = 'safe\u0000unsafe';
  assert.throws(() => buildMemberInsightReport(input), { code: 'INVALID_INSIGHT_SUMMARY' });
});

test('never projects unrelated account, evaluation, free-text, flow or another product data', async () => {
  const { buildMemberInsightReport } = await model, input = practiced();
  input.account = { secret: 'not-output-account' };input.evaluation = { age: 'not-output-age' };
  input.summary.other = 'not-output-free-text';input.summary.flow = { private: 'not-output-flow' };
  input.summary.interests = ['not-output-inferred'];input.summary.care = 'not-output-other-product';
  input.summary.practice.skills[0].eventIds = ['not-output-raw-evidence'];
  const output = JSON.stringify(buildMemberInsightReport(input));
  assert.doesNotMatch(output, /not-output/);assert.doesNotMatch(output, /eventIds/);
});

test('every canonical reason and setting remains an explicit declaration, never an observed personality', async () => {
  const { buildMemberInsightReport } = await model;
  for (const reason of ['culture', 'travel', 'people', 'life', 'study', 'work', 'career', 'exam', 'hobby', 'other']) {
    const input = fixture();input.summary.reasons = [reason];input.summary.presentation = { support: 'independent', explanation: 'detailed', textSize: 'large', motion: 'reduced', audio: 'off' };
    const output = buildMemberInsightReport(input);
    assert.equal(output.personal.length, 6);assert.ok(output.personal.every(row => row.basis === 'self-declared'));
    assert.equal(output.learning.empty, true);assert.equal(output.lastAt, null);
  }
});

function activitySummary(patch = {}) {
  const { summarizeMemberActivity } = require('../../atlas/member-activity.js');
  return summarizeMemberActivity({ asOf, document: { version: 1, consent: true, enabledAt: '2026-07-01T00:00:00.000Z',
    favorites: ['path'], events: [
      { id: '11111111-1111-4111-8111-111111111111', appId: 'world', at: '2026-09-01T03:00:00.000Z' },
      { id: '22222222-2222-4222-8222-222222222222', appId: 'world', at: lastAt },
    ], ...patch } });
}
function practicePeriods() {
  return { days: 30,
    recent: { from: '2026-09-14T03:00:00.000Z', to: asOf, answered: 5, independent: 3, assisted: 2, activeDays: 3 },
    previous: { from: '2026-08-15T03:00:00.000Z', to: '2026-09-14T03:00:00.000Z', answered: 3, independent: 1, assisted: 2, activeDays: 2 },
    sufficient: true, reason: '두 기간에 기록된 응답 횟수예요. 실력 변화를 판정하지 않아요.', delta: { answered: 2, independent: 2, assisted: 0, activeDays: 1 } };
}

test('Atlas activity output keeps favorites declared, app openings observed, and uses fixed launch targets', async () => {
  const { buildMemberInsightReport } = await model;
  const activity = activitySummary(), before = structuredClone(activity);
  const result = buildMemberInsightReport(fixture(), { activity, activityStatus: 'ready' });
  assert.deepEqual(activity, before);
  assert.equal(result.activity.status, 'ready');
  assert.equal(result.activity.interests.find(row => row.id === 'path').kind, 'favorite');
  assert.equal(result.activity.interests.find(row => row.id === 'world').kind, 'opened');
  assert.equal(result.activity.activities.find(row => row.targetId === 'world').label, 'WORLD에서 연습 고르기');
  assert.deepEqual(result.activity.periods.delta, { observations: 0, activeDays: 0 });
  assert.doesNotMatch(JSON.stringify(result.activity), /11111111|22222222|eventIds|document/);
});

test('app consent and practice consent remain independent, with disabled stale data discarded', async () => {
  const { buildMemberInsightReport } = await model;
  const input = practiced();input.learning.enabled = false;input.summary.practice = { periods: 'hidden-practice' };
  const output = buildMemberInsightReport(input, { activity: activitySummary(), activityStatus: 'ready' });
  assert.equal(output.learning.periods, null);assert.equal(output.activity.status, 'ready');
  assert.equal(output.activity.interests.length, 2);assert.doesNotMatch(JSON.stringify(output), /hidden-practice/);
  const disabled = { version: 1, availability: 'disabled', interests: [{ private: 'stale-favorite' }], periods: 'stale-events' };
  const result = buildMemberInsightReport(practiced(), { activity: disabled, activityStatus: 'ready' });
  assert.equal(result.activity.status, 'disabled');assert.equal(result.learning.answered, 8);
  assert.doesNotMatch(JSON.stringify(result), /stale-favorite|stale-events/);
});

test('periods expose actual counts and signed deltas, but never infer a missing prior period', async () => {
  const { buildMemberInsightReport } = await model;
  const input = practiced();input.summary.practice.periods = practicePeriods();
  assert.deepEqual(buildMemberInsightReport(input).learning.periods.delta, { answered: 2, independent: 2, assisted: 0, activeDays: 1 });
  input.summary.practice.periods.sufficient = false;input.summary.practice.periods.delta = null;
  assert.equal(buildMemberInsightReport(input).learning.periods.delta, null);
  delete input.summary.practice.periods;
  assert.equal(buildMemberInsightReport(input).learning.periods, null);
  const partial = activitySummary({ enabledAt: '2026-10-01T00:00:00.000Z' });
  const report = buildMemberInsightReport(input, { activity: partial, activityStatus: 'ready' });
  assert.equal(report.activity.periods.sufficient, false);assert.equal(report.activity.periods.delta, null);
});

test('period validation rejects overlapping windows, incorrect deltas and a fabricated comparison', async () => {
  const { buildMemberInsightReport } = await model;
  for (const corrupt of [p => p.recent.from = '2026-09-15T03:00:00.000Z', p => p.previous.to = asOf,
    p => p.delta.answered = 99, p => p.sufficient = false, p => p.recent.activeDays = 32,
    p => p.recent.independent = 999, p => p.reason = '<script>private</script>']) {
    const input = practiced();input.summary.practice.periods = practicePeriods();corrupt(input.summary.practice.periods);
    assert.throws(() => buildMemberInsightReport(input), { code: 'INVALID_INSIGHT_SUMMARY' });
  }
  const input = practiced();input.summary.practice.periods = practicePeriods();
  input.summary.practice.periods.recent.activeDays = 31;input.summary.practice.periods.delta.activeDays = 29;
  assert.equal(buildMemberInsightReport(input).learning.periods.recent.activeDays, 31);
});

test('malformed activity is isolated to a neutral error without losing the practice summary', async () => {
  const { buildMemberInsightReport } = await model;
  for (const corrupt of [a => a.activities[0].targetId = 'https://private.invalid', a => a.interests[0].label = '<img src=x>',
    a => a.version = 999, a => a.periods.delta.observations = 999, a => a.enabledAt = 'tomorrow']) {
    const activity = activitySummary();corrupt(activity);
    const report = buildMemberInsightReport(practiced(), { activity, activityStatus: 'ready', activityError: 'private-error' });
    assert.equal(report.activity.status, 'error');assert.equal(report.learning.answered, 8);
    assert.doesNotMatch(JSON.stringify(report), /private-error|private\.invalid|<img/);
  }
  for (const status of ['unavailable', 'loading', 'error']) {
    const report = buildMemberInsightReport(fixture(), { activity: { secret: 'stale-private' }, activityStatus: status });
    assert.equal(report.activity.status, status);assert.doesNotMatch(JSON.stringify(report), /stale-private/);
  }
});

const understandingDocument = () => ({ version: 1, reviews: [], overrides: [] });
function understandingInput() { return require('../tools/member-insight-fixture.cjs').summary(); }

test('Core understanding consumes permitted topic and repeated format aggregates without inferring app content', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput();
  const result = buildMemberInsightReport(input, { understanding: understandingDocument(), understandingStatus: 'ready' });
  assert.equal(result.understanding.status, 'ready');
  assert.equal(result.understanding.facets.find(row => row.id === 'practice-mode').claim.reference, 'listening');
  assert.equal(result.understanding.facets.find(row => row.id === 'learning-topic:cafe-order').title, '카페에서 주문하기');
  assert.equal(result.understanding.facets.find(row => row.id === 'topics').claim, null);
  assert.equal(result.understanding.facets.find(row => row.id === 'usage-repeat').available, false);
  assert.equal(result.understanding.history.length, 0);
  assert.equal(result.learning.answered, input.summary.practice.answered);
});

test('explicit choices change the next Core explanation and remain separate from actual account settings', async () => {
  const { buildMemberInsightReport } = await model, document = understandingDocument(), input = understandingInput();
  document.overrides = [
    { id: 'topics-1', facetId: 'topics', values: ['travel-food', 'ai-tools'], note: '이 말은 직접 남긴 설명이에요.', at: asOf },
    { id: 'support-1', facetId: 'support', values: ['independent'], note: '', at: asOf },
    { id: 'explanation-1', facetId: 'explanation', values: ['detailed'], note: '', at: asOf },
  ];
  const result = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready' });
  assert.equal(result.understanding.status, 'ready');
  assert.match(result.understanding.paragraphs.join(' '), /여행지 음식·주문.*AI 도구 활용/);
  assert.match(result.understanding.paragraphs.join(' '), /먼저 혼자 시도/);
  assert.match(result.understanding.paragraphs.join(' '), /덧붙인 말.*이 말은 직접 남긴 설명이에요/);
  assert.equal(result.understanding.history.find(row => row.facetId === 'topics').note, document.overrides[0].note);
  assert.equal(result.personal.find(row => row.id === 'support').value, '단계별로 도와줘요');
  assert.equal(input.summary.presentation.support, 'step');
  // The screen-only correction of a setting never speaks for the setting the apps use.
  assert.equal(result.settings.support, 'step');assert.doesNotMatch(result.now.support.join(' '), /혼자 해 보기|자세한 설명/);
});

test('agree, disagree and contextual confirmations affect current interpretation while preserving observed counts', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput();
  const current = buildMemberInsightReport(input, { understanding: understandingDocument(), understandingStatus: 'ready' });
  const claim = current.understanding.facets.find(row => row.id === 'practice-mode').claim;
  for (const verdict of ['agree', 'disagree', 'contextual']) {
    const document = understandingDocument();document.reviews.push({ id: verdict + '-1', facetId: 'practice-mode', verdict, claim, note: '', at: asOf });
    const result = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready' });
    assert.equal(result.understanding.status, 'ready');
    const facet = result.understanding.facets.find(row => row.id === 'practice-mode');
    assert.equal(facet.review.verdict, verdict);assert.deepEqual(facet.claim, claim);
    assert.notEqual(facet.line, current.understanding.facets.find(row => row.id === 'practice-mode').line);
    assert.equal(result.learning.answered, current.learning.answered);
    assert.equal(result.understanding.history[0].kind, 'review');
  }
});

test('a later understanding check applies fresh feedback without relabeling the older account summary time', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput(), document = understandingDocument();
  const later = '2026-10-14T04:00:00.000Z';
  document.overrides.push({ id: 'later-1', facetId: 'topics', values: ['content-video'], note: '', at: later });
  const result = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready', understandingAsOf: later });
  assert.equal(result.understanding.status, 'ready');assert.equal(result.asOf, asOf);assert.equal(result.understanding.asOf, later);
  assert.match(result.understanding.paragraphs.join(' '), /영상 제작/);
});

test('disconnected learning hides observation claims while keeping explicit corrections in reversible history', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput(), document = understandingDocument();
  const before = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready' });
  document.reviews.push({ id: 'review-mode', facetId: 'practice-mode', verdict: 'agree', claim: before.understanding.facets.find(row => row.id === 'practice-mode').claim, note: '', at: asOf });
  document.overrides.push({ id: 'own-topics', facetId: 'topics', values: ['ai-tools'], note: '', at: asOf });
  input.learning.enabled = false;input.shared = 'declared-only';
  const result = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready' });
  const facet = result.understanding.facets.find(row => row.id === 'practice-mode');
  assert.equal(facet.available, false);assert.equal(facet.claim, null);assert.equal(facet.review, null);
  assert.equal(result.understanding.history.length, 2);assert.match(result.understanding.paragraphs.join(' '), /AI 도구 활용/);
  assert.doesNotMatch(result.understanding.paragraphs.join(' '), /카페에서 주문|듣기/);
});

test('invalid, loading and unavailable feedback never contributes stale explanations or user notes', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput(), invalid = understandingDocument();
  invalid.rawCustomerText = 'not-output-private';
  const result = buildMemberInsightReport(input, { understanding: invalid, understandingStatus: 'ready' });
  assert.equal(result.understanding.status, 'error');assert.equal(result.learning.empty, false);
  assert.doesNotMatch(JSON.stringify(result), /not-output-private/);
  for (const status of ['loading', 'unavailable', 'error']) {
    const result = buildMemberInsightReport(input, { understanding: invalid, understandingStatus: status });
    assert.equal(result.understanding.status, status);assert.deepEqual(result.understanding.history, []);assert.deepEqual(result.understanding.facets, []);
  }
});

test('literal explanations accept 200 Unicode characters and preserve markup as text without interpretation', async () => {
  const { buildMemberInsightReport } = await model;
  for (const note of ['<관심>과 다른 말\n직접 남긴 설명', '🙂'.repeat(200)]) {
    const document = understandingDocument();document.overrides.push({ id: 'literal-1', facetId: 'topics', values: ['content-video'], note, at: asOf });
    const result = buildMemberInsightReport(understandingInput(), { understanding: document, understandingStatus: 'ready' });
    assert.equal(result.understanding.status, 'ready');assert.ok(result.understanding.paragraphs.join(' ').includes(note));
    assert.equal(result.understanding.history[0].note, note);
    assert.deepEqual(result.understanding.activities.map(row => row.targetId), ['pulse']);
    assert.ok(result.understanding.activities.every(row => row.basis === 'self-declared' && !row.reason.includes(note)));
  }
});

async function confirmedStatement(text, acceptedIds = ['p0', 'p1']) {
  const core = (await import('../renderer/generated/member-understanding.mjs')).default;
  const document = { version: 10, reviews: [], overrides: [], statements: [] };
  let preview = core.previewMemberStatement({ text, document, asOf });
  while (preview.question) {
    assert.ok(preview.question.options.some(option => option.id === 'skip'));
    preview = core.previewMemberStatement({ text, document, asOf, clarifications: [...preview.clarifications, { questionId: preview.question.id, optionId: 'skip' }] });
  }
  document.statements.push(core.confirmMemberStatement({ preview, acceptedIds, id: '00000000-0000-4000-8000-000000000001', at: asOf }));
  return document;
}

test('confirmed natural wording reaches conditional analysis and reversible history without changing raw settings', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput();
  const document = await confirmedStatement('혼자 하는 게 좋아요. 처음에는 예시가 필요해요. 아마 음악을 좋아할 거예요.');
  const result = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready' });
  assert.equal(result.understanding.status, 'ready');
  const relation = result.understanding.relations.find(row => row.kind === 'conditional-preference');
  assert.match(relation.line, /혼자 시도하기/);assert.match(relation.line, /처음 시도할 때/);
  assert.equal(relation.certainty, 'declared');assert.equal(relation.evidence.length, 2);
  assert.ok(relation.evidence.every(item => item.kind === 'statement'));
  assert.equal(result.understanding.statementHistory[0].meanings.length, 2);
  assert.ok(result.understanding.statementHistory[0].text.includes('아마 음악'));
  assert.doesNotMatch(result.understanding.paragraphs.join(' '), /음악/);
  assert.equal(result.personal.find(row => row.id === 'support').value, '단계별로 도와줘요');
  assert.equal(result.learning.answered, input.summary.practice.answered);
});

test('explicit conditional words remain declarations after learning observation is disconnected and disappear on reversal', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput();
  const document = await confirmedStatement('혼자 하는 게 좋아요. 처음에는 예시가 필요해요.');
  input.learning.enabled = false;input.shared = 'declared-only';
  const result = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready' });
  assert.equal(result.understanding.status, 'ready');assert.equal(result.learning.answered, 0);
  assert.match(result.understanding.paragraphs.join(' '), /처음 시도할 때/);
  assert.equal(result.understanding.facets.find(row => row.id === 'practice-mode').claim, null);
  const undone = buildMemberInsightReport(input, { understanding: { ...document, statements: [] }, understandingStatus: 'ready' });
  assert.deepEqual(undone.understanding.statementHistory, []);assert.deepEqual(undone.understanding.relations, []);
  assert.doesNotMatch(undone.understanding.paragraphs.join(' '), /처음 시도할 때/);
});

test('literal natural source accepts Unicode, newlines and markup only in source history', async () => {
  const { buildMemberInsightReport } = await model;
  const text = '혼자 하는 게 좋아요.\n<문자>\t' + '🙂'.repeat(220);
  const document = await confirmedStatement(text, ['p0']);
  const result = buildMemberInsightReport(understandingInput(), { understanding: document, understandingStatus: 'ready' });
  assert.equal(result.understanding.status, 'ready');assert.equal(result.understanding.statementHistory[0].text, text);
  assert.doesNotMatch(result.understanding.paragraphs.join(' '), /<문자>|🙂/);
  const corrupt = structuredClone(document);corrupt.statements[0].meanings[0].evidence.quote = '다른 원문';
  const rejected = buildMemberInsightReport(understandingInput(), { understanding: corrupt, understandingStatus: 'ready' });
  assert.equal(rejected.understanding.status, 'error');assert.deepEqual(rejected.understanding.statementHistory, []);
  for (const status of ['loading', 'error', 'unavailable']) {
    const unavailable = buildMemberInsightReport(understandingInput(), { understanding: document, understandingStatus: status });
    assert.deepEqual(unavailable.understanding.statementHistory, []);assert.deepEqual(unavailable.understanding.relations, []);
  }
});

test('the first example then independent sequence survives the presentation boundary as two conditional meanings', async () => {
  const { buildMemberInsightReport } = await model, input = understandingInput();
  const document = await confirmedStatement('처음 배우는 일은 예시를 보고 감을 잡은 다음 혼자 해보고 싶어요.');
  const report = buildMemberInsightReport(input, { understanding: document, understandingStatus: 'ready' });
  assert.equal(report.understanding.status, 'ready');
  assert.deepEqual(report.understanding.statementHistory[0].meanings.map(m => m.condition), ['first-try', 'first-try-after-example']);
  assert.equal(report.understanding.statementHistory[0].meanings.length, 2);
  assert.equal(report.learning.answered, input.summary.practice.answered);
  assert.equal(report.personal.find(row => row.id === 'support').value, '단계별로 도와줘요');
});

test('clarification answer history is retained on the next analysis as an explicit member answer', async () => {
  const { buildMemberInsightReport } = await model;
  const core = (await import('../renderer/generated/member-understanding.mjs')).default;
  const text = '나는 자세한 설명이 좋을 수도 있어요.';
  let preview = core.previewMemberStatement({ text, asOf });
  preview = core.previewMemberStatement({ text, asOf, clarifications: [{ questionId: preview.question.id, optionId: 'confirm' }] });
  const row = core.confirmMemberStatement({ preview, acceptedIds: preview.proposals.map(p => p.id), id: '00000000-0000-4000-8000-000000000001', at: asOf });
  const result = buildMemberInsightReport(understandingInput(), { understanding: { version: 10, reviews: [], overrides: [], statements: [row] }, understandingStatus: 'ready' });
  assert.equal(result.understanding.status, 'ready');
  assert.equal(result.understanding.statementHistory[0].clarificationAnswers.length, 1);
  assert.ok(result.understanding.statementHistory[0].clarificationAnswers[0].questionLabel);
  assert.equal(result.understanding.facets.find(f => f.id === 'explanation').selected[0], 'detailed');
});
