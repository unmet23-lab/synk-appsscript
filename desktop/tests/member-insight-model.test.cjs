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
  assert.deepEqual(Object.keys(result).sort(), ['asOf', 'description', 'headline', 'lastAt', 'learning', 'limits', 'personal', 'reasons', 'shared'].sort());
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
