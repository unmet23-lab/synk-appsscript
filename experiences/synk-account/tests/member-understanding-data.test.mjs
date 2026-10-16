import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Statement from '../src/member-statement-contract.cjs';
import LegacyStatement from '../src/member-statement-v1.cjs';
import Ko2Statement from '../src/member-statement-v2.cjs';
import Ko3Statement from '../src/member-statement-v3.cjs';
import Ko4Statement from '../src/member-statement-v4.cjs';
import Ko5Statement from '../src/member-statement-v5.cjs';
import Ko6Statement from '../src/member-statement-v6.cjs';
import Ko7Statement from '../src/member-statement-v7.cjs';
import Statements from '../src/member-statement.cjs';
import { emptyMemberUnderstanding, validateMemberUnderstanding, updateMemberUnderstanding, MEMBER_UNDERSTANDING_LIMITS } from '../src/member-understanding-data.mjs';
import { PERSONAL_LIMITS, validatePersonalState, serializePersonalState, parsePersonalState, validatePersonalResponse } from '../src/personal-data.mjs';
const now = '2026-10-14T12:00:00.000Z', daysAgo = days => new Date(Date.parse(now) - days * 86400000).toISOString();
const claim = () => ({ version: 1, kind: 'usage-repeat', source: 'usage', generation: daysAgo(60), reference: 'world', value: 'fits', from: daysAgo(30), to: now, count: 4, total: 6, activeDays: 3, lastAt: daysAgo(1) });
const review = () => ({ id: randomUUID(), facetId: 'usage-repeat', verdict: 'agree', claim: claim(), note: '업무가 없는 날에는 달라요.', at: now });
const override = () => ({ id: randomUUID(), facetId: 'topics', values: ['ai-tools', 'travel-food'], note: '요즘 직접 골라 보고 싶은 내용이에요.', at: now });
const state = () => ({ version: 1, reviews: [review()], overrides: [override()] });

test('new understanding starts empty and remains a separate document from v1 observations', () => {
  const empty = emptyMemberUnderstanding();assert.deepEqual(empty, { version: 1, reviews: [], overrides: [] });
  assert.notEqual(empty.reviews, emptyMemberUnderstanding().reviews);
  const value = validateMemberUnderstanding(state());assert.deepEqual(value.overrides[0].values, ['travel-food', 'ai-tools']);
  assert.equal(PERSONAL_LIMITS['member-understanding'], 64 * 1024);
  assert.deepEqual(parsePersonalState('member-understanding', serializePersonalState('member-understanding', value)), value);
  assert.deepEqual(validatePersonalState('member-insight', { version: 1, consent: false, enabledAt: null, events: [], favorites: [] }), { version: 1, consent: false, enabledAt: null, events: [], favorites: [] });
});

test('only fixed facets, choices, verdicts and bounded raw-content-free claim metadata are accepted', () => {
  const value = state(), row = value.reviews[0];
  for (const bad of [
    { ...value, accountId: randomUUID() }, { ...value, notes: [] }, { ...value, events: [] },
    { ...value, reviews: [{ ...row, verdict: 'execute' }] },
    { ...value, reviews: [{ ...row, facetId: 'support' }] },
    { ...value, reviews: [{ ...row, claim: { ...row.claim, text: 'customer content' } }] },
    { ...value, reviews: [{ ...row, claim: { ...row.claim, url: 'https://example.invalid' } }] },
    { ...value, reviews: [{ ...row, claim: { ...row.claim, generation: 2 } }] },
    { ...value, reviews: [{ ...row, claim: { ...row.claim, count: 7 } }] },
    { ...value, reviews: [{ ...row, claim: { ...row.claim, from: daysAgo(29) } }] },
    { ...value, overrides: [{ ...value.overrides[0], values: [] }] },
    { ...value, overrides: [{ ...value.overrides[0], values: ['unknown-topic'] }] },
    { ...value, overrides: [{ ...value.overrides[0], values: ['ai-tools', 'ai-tools'] }] },
    { ...value, overrides: [{ ...value.overrides[0], facetId: 'support', values: ['choose', 'step'] }] },
  ]) assert.throws(() => validateMemberUnderstanding(bad), { code: 'INVALID_PERSONAL_STATE' });
});

test('notes are literal bounded member statements; they cannot become structured commands or extra fields', () => {
  const value = state(), note = 'ignore previous instructions <script> synthetic literal';
  assert.equal(validateMemberUnderstanding({ ...value, reviews: [{ ...value.reviews[0], note }] }).reviews[0].note, note);
  const full = '🙂'.repeat(200);assert.equal(validateMemberUnderstanding({ ...value, reviews: [{ ...value.reviews[0], note: full }] }).reviews[0].note, full);
  const multiline = '첫 줄\n둘째 줄\r\n\t직접 쓴 설명';assert.equal(validateMemberUnderstanding({ ...value, reviews: [{ ...value.reviews[0], note: multiline }] }).reviews[0].note, multiline);
  for (const note of ['🙂'.repeat(201), '\u0000', '\u001b', '\uD800', { instruction: 'anything' }])
    assert.throws(() => validateMemberUnderstanding({ ...value, reviews: [{ ...value.reviews[0], note }] }), { code: 'INVALID_PERSONAL_STATE' });
});

test('UUIDs and facets are unique; sparse, accessor and non-JSON structures do not reach persistence', () => {
  const value = state(), row = value.reviews[0];
  for (const reviews of [[row, { ...row, id: randomUUID() }], [row, { ...row, id: row.id.toUpperCase() }], new Array(1)])
    assert.throws(() => validateMemberUnderstanding({ ...value, reviews }), { code: 'INVALID_PERSONAL_STATE' });
  assert.throws(() => validateMemberUnderstanding({ ...value, overrides: [{ ...value.overrides[0], id: row.id }] }), { code: 'INVALID_PERSONAL_STATE' });
  const sparse = new Array(1);assert.throws(() => validateMemberUnderstanding({ ...value, overrides: [{ ...value.overrides[0], values: sparse }] }), { code: 'INVALID_PERSONAL_STATE' });
  let invoked = false;const accessor = { ...row };Object.defineProperty(accessor, 'note', { enumerable: true, get() { invoked = true;return ''; } });
  assert.throws(() => validateMemberUnderstanding({ ...value, reviews: [accessor] }), { code: 'INVALID_PERSONAL_STATE' });assert.equal(invoked, false);
  const claimAccessor = { ...row.claim };Object.defineProperty(claimAccessor, 'count', { enumerable: true, get() { invoked = true;return 4; } });
  assert.throws(() => validateMemberUnderstanding({ ...value, reviews: [{ ...row, claim: claimAccessor }] }), { code: 'INVALID_PERSONAL_STATE' });assert.equal(invoked, false);
  const hidden = { ...row.claim };Object.defineProperty(hidden, Symbol('private'), { value: 'hidden' });
  assert.throws(() => validateMemberUnderstanding({ ...value, reviews: [{ ...row, claim: hidden }] }), { code: 'INVALID_PERSONAL_STATE' });
  assert.throws(() => validateMemberUnderstanding({ ...value, reviews: Array.from({ length: MEMBER_UNDERSTANDING_LIMITS.reviews + 1 }, () => review()) }), { code: 'INVALID_PERSONAL_STATE' });
});

test('claim source generations and review time are typed; future writes fail while old loaded documents remain removable', () => {
  const row = review(), learned = { ...row, facetId: 'practice-mode', claim: { ...claim(), kind: 'practice-mode', source: 'learning', generation: 2, reference: 'listening' } };
  assert.equal(validateMemberUnderstanding({ ...emptyMemberUnderstanding(), reviews: [learned] }).reviews[0].claim.generation, 2);
  assert.throws(() => validateMemberUnderstanding({ ...emptyMemberUnderstanding(), reviews: [{ ...learned, claim: { ...learned.claim, generation: null } }] }), { code: 'INVALID_PERSONAL_STATE' });
  const future = { ...emptyMemberUnderstanding(), reviews: [{ ...row, at: daysAgo(-1) }] };
  assert.deepEqual(validateMemberUnderstanding(future), future);
  assert.throws(() => validateMemberUnderstanding(future, { now, enforceTime: true }), { code: 'INVALID_PERSONAL_STATE' });
  assert.throws(() => validateMemberUnderstanding({ ...emptyMemberUnderstanding(), reviews: [{ ...row, at: daysAgo(1) }] }), { code: 'INVALID_PERSONAL_STATE' });
  assert.deepEqual(updateMemberUnderstanding(future, { type: 'clear' }, now), emptyMemberUnderstanding());
  assert.deepEqual(updateMemberUnderstanding(future, { type: 'remove-review', facetId: row.facetId }, now), emptyMemberUnderstanding());
});

test('explicit upsert retries keep their UUID; replacing or reverting one facet never changes observations or another answer', () => {
  const value = validateMemberUnderstanding(state()), row = review();row.verdict = 'contextual';
  const next = updateMemberUnderstanding(value, { type: 'review', value: row }, now);
  assert.equal(next.reviews.length, 1);assert.equal(next.reviews[0].verdict, 'contextual');assert.deepEqual(next.overrides, value.overrides);
  assert.deepEqual(updateMemberUnderstanding(next, { type: 'review', value: row }, now), next);
  const reordered = { ...next, reviews: [{ ...next.reviews[0], claim: Object.fromEntries(Object.entries(next.reviews[0].claim).reverse()) }] };
  assert.deepEqual(updateMemberUnderstanding(reordered, { type: 'review', value: row }, now), next, 'a JSONB object key order change is still the same UUID retry');
  assert.throws(() => updateMemberUnderstanding(next, { type: 'review', value: { ...row, verdict: 'disagree' } }, now), { code: 'INVALID_PERSONAL_STATE' });
  const direct = { ...override(), facetId: 'support', values: ['step'] };
  const corrected = updateMemberUnderstanding(next, { type: 'override', value: direct }, now);assert.equal(corrected.overrides.length, 2);
  const reverted = updateMemberUnderstanding(corrected, { type: 'remove-override', facetId: 'support' }, now);assert.deepEqual(reverted, next);
  assert.deepEqual(updateMemberUnderstanding(corrected, { type: 'clear' }, now), emptyMemberUnderstanding());
  assert.throws(() => updateMemberUnderstanding(next, { type: 'clear', accountId: 'other' }, now), { code: 'INVALID_PERSONAL_STATE' });
});

test('generic personal response guards owner/resource and enforces 64 KiB before accepting a document', () => {
  const value = validateMemberUnderstanding(state()), response = { ok: true, scope: 'synk-personal', resource: 'member-understanding', accountId: 'synthetic-owner', revision: 1, updatedAt: now, state: value };
  assert.deepEqual(validatePersonalResponse(response, { resource: 'member-understanding', accountId: 'synthetic-owner' }), response);
  assert.throws(() => validatePersonalResponse(response, { resource: 'member-understanding', accountId: 'other-owner' }), { code: 'ACCOUNT_CHANGED' });
  assert.throws(() => validatePersonalState('member-understanding', { ...value, extra: 'x'.repeat(64 * 1024) }), { code: 'PERSONAL_DATA_TOO_LARGE' });
});

const statement = (text = '혼자 하는 게 좋지만 처음에는 예시가 필요해') => ({ id: randomUUID(), parserVersion: LegacyStatement.PARSER_VERSION, text, at: now, confirmedAt: now, meanings: LegacyStatement.parseMemberStatement(text).meanings });
const v2 = () => ({ ...state(), version: 2, statements: [statement()] });

test('strict v1 stays unchanged and only a confirmed statement explicitly promotes it to v2', () => {
  const original = validateMemberUnderstanding(state());original.reviews[0].note = '혼자 하는 게 좋아';
  assert.deepEqual(validateMemberUnderstanding(original), original);
  assert.equal(updateMemberUnderstanding(original, { type: 'review', value: original.reviews[0] }, now).version, 1);
  for (const value of [{ ...original, statements: [] }, { ...original, version: 2 }, { ...v2(), version: 10 }])
    assert.throws(() => validateMemberUnderstanding(value), { code: 'INVALID_PERSONAL_STATE' });
  const row = statement(), promoted = updateMemberUnderstanding(original, { type: 'statement', value: row, replaceId: null }, now);
  assert.equal(promoted.version, 2);assert.deepEqual(promoted.reviews, original.reviews);assert.deepEqual(promoted.overrides, original.overrides);assert.deepEqual(promoted.statements, [row]);
  assert.deepEqual(parsePersonalState('member-understanding', serializePersonalState('member-understanding', promoted)), promoted);
  assert.deepEqual(updateMemberUnderstanding(promoted, { type: 'clear' }, now), { version: 2, reviews: [], overrides: [], statements: [] });
});

test('statement persistence requires a confirmed exact parsed subset, original spans and bounded current times', () => {
  const value = v2(), row = value.statements[0];assert.equal(row.meanings.length, 2);
  const selected = { ...row, meanings: [row.meanings[1]] };assert.deepEqual(validateMemberUnderstanding({ ...value, statements: [selected] }).statements, [selected]);
  for (const bad of [{ ...row, confirmedAt: daysAgo(1) }, { ...row, confirmedAt: daysAgo(-1) }, { ...row, at: '2026-10-14' },
    { ...row, meanings: [] }, { ...row, parserVersion: 'other' }, { ...row, text: '다른 사람이 하는 말' }, { ...row, extra: true },
    { ...row, meanings: [row.meanings[0], row.meanings[0]] }, { ...row, meanings: [{ ...row.meanings[0], polarity: 'avoid' }] },
    { ...row, meanings: [{ ...row.meanings[0], evidence: { ...row.meanings[0].evidence, start: 1 } }] }])
    assert.throws(() => validateMemberUnderstanding({ ...value, statements: [bad] }, { now, enforceTime: true }), { code: 'INVALID_PERSONAL_STATE' });
  const future = { ...value, statements: [{ ...row, at: daysAgo(-1), confirmedAt: daysAgo(-1) }] };
  assert.equal(validateMemberUnderstanding(future).version, 2);
  assert.equal(updateMemberUnderstanding(future, { type: 'remove-statement', id: row.id }, now).statements.length, 0);
});

test('statement IDs are globally unique and all JSON structures reject hidden or executable members', () => {
  const value = v2(), row = value.statements[0];
  for (const statements of [[row, { ...row, id: row.id.toUpperCase() }], [{ ...row, id: value.reviews[0].id }], [{ ...row, id: value.overrides[0].id }], new Array(1), Array.from({ length: 21 }, () => statement())])
    assert.throws(() => validateMemberUnderstanding({ ...value, statements }), { code: 'INVALID_PERSONAL_STATE' });
  let called = false;const executable = { ...row };Object.defineProperty(executable, 'text', { enumerable: true, get() { called = true;return row.text; } });
  assert.throws(() => validateMemberUnderstanding({ ...value, statements: [executable] }), { code: 'INVALID_PERSONAL_STATE' });assert.equal(called, false);
  const hidden = { ...row };Object.defineProperty(hidden, Symbol('hidden'), { value: 'data' });
  assert.throws(() => validateMemberUnderstanding({ ...value, statements: [hidden] }), { code: 'INVALID_PERSONAL_STATE' });
  const versionGetter = { ...value };Object.defineProperty(versionGetter, 'version', { enumerable: true, get() { called = true;return 2; } });
  assert.throws(() => validateMemberUnderstanding(versionGetter), { code: 'INVALID_PERSONAL_STATE' });assert.equal(called, false);
});

test('statement CAS retries preserve UUIDs while explicit replacement or removal preserves unrelated answers', () => {
  const original = validateMemberUnderstanding(v2()), first = original.statements[0], replacement = statement('읽기 연습이 좋아');
  const next = updateMemberUnderstanding(original, { type: 'statement', value: replacement, replaceId: first.id }, now);
  assert.deepEqual(next.statements, [replacement]);assert.deepEqual(next.reviews, original.reviews);assert.deepEqual(next.overrides, original.overrides);
  assert.deepEqual(updateMemberUnderstanding(next, { type: 'statement', value: replacement, replaceId: first.id }, now), next);
  const reversed = Object.fromEntries(Object.entries(replacement).reverse());reversed.meanings = reversed.meanings.map(m => ({ ...m, evidence: Object.fromEntries(Object.entries(m.evidence).reverse()) }));
  assert.deepEqual(updateMemberUnderstanding(next, { type: 'statement', value: reversed, replaceId: first.id }, now), next);
  for (const action of [{ type: 'statement', value: replacement, replaceId: replacement.id }, { type: 'statement', value: statement(), replaceId: randomUUID() },
    { type: 'statement', value: { ...statement(), id: replacement.id }, replaceId: null }, { type: 'statement', value: replacement }])
    assert.throws(() => updateMemberUnderstanding(next, action, now), { code: 'INVALID_PERSONAL_STATE' });
  const edited = updateMemberUnderstanding(next, { type: 'override', value: { ...override(), facetId: 'support', values: ['step'] } }, now);
  assert.deepEqual(edited.statements, [replacement]);assert.equal(edited.version, 2);
  const removed = updateMemberUnderstanding(edited, { type: 'remove-statement', id: replacement.id }, now);
  assert.deepEqual(removed.statements, []);assert.deepEqual(removed.overrides, edited.overrides);assert.equal(removed.version, 2);
});

test('confirmed ko2 promotes old documents to v3 without reinterpreting or dropping ko1 rows', () => {
  const original = validateMemberUnderstanding(v2()), legacy = structuredClone(original.statements[0]);
  const text = '처음 배우는 일은 예시를 보고 감을 잡은 다음 혼자 해보고 싶어요.', parsed = Ko2Statement.parseMemberStatement(text);
  assert.equal(parsed.question, null);assert.equal(parsed.meanings.length, 2);
  const row = { id: randomUUID(), parserVersion: Ko2Statement.PARSER_VERSION, text, at: now, confirmedAt: now, meanings: parsed.meanings, clarifications: [] };
  const promoted = updateMemberUnderstanding(original, { type: 'statement', value: row, replaceId: null }, now);
  assert.equal(promoted.version, 3);assert.deepEqual(promoted.statements.find(s => s.id === legacy.id), legacy);
  assert.deepEqual(promoted.reviews, original.reviews);assert.deepEqual(promoted.overrides, original.overrides);
  assert.throws(() => validateMemberUnderstanding({ ...promoted, version: 2 }), { code: 'INVALID_PERSONAL_STATE' });
  assert.deepEqual(parsePersonalState('member-understanding', serializePersonalState('member-understanding', promoted)), promoted);
  const removed = updateMemberUnderstanding(promoted, { type: 'remove-statement', id: row.id }, now);
  assert.equal(removed.version, 3);assert.deepEqual(removed.statements, [legacy]);
  assert.deepEqual(updateMemberUnderstanding(promoted, { type: 'clear' }, now), { version: 3, reviews: [], overrides: [], statements: [] });
});

test('stored clarification choices must replay the exact current question before acceptance', () => {
  const text = '나는 자세한 설명이 좋을 수도 있어요.';
  const first = Statements.previewMemberStatement({ text, asOf: now });assert.ok(first.question);
  const clarifications = [{ questionId: first.question.id, optionId: 'confirm' }];
  assert.ok(first.question.options.some(option => option.id === 'confirm'));
  const preview = Statements.previewMemberStatement({ text, asOf: now, clarifications });
  const row = Statements.confirmMemberStatement({ preview, acceptedIds: preview.proposals.map(p => p.id), id: randomUUID(), at: now });
  const value = updateMemberUnderstanding(state(), { type: 'statement', value: row, replaceId: null }, now);
  assert.equal(value.version, 9);assert.equal(value.statements[0].clarifications.length, 1);
  for (const change of [r => r.clarifications[0].optionId = 'skip', r => r.text = '나는 짧은 설명이 좋을 수도 있어요.', r => r.clarifications.push(r.clarifications[0])]) {
    const changed = structuredClone(value);change(changed.statements[0]);
    assert.throws(() => validateMemberUnderstanding(changed), { code: 'INVALID_PERSONAL_STATE' });
  }
});

test('ko3 promotes v1/v2/v3 to v4 and preserves old statements, selection and the removal fence', () => {
  const text = '회의에서 다른 사람의 의견을 듣고 정리하는 편이에요.';
  const parsed = Ko3Statement.parseMemberStatement(text);
  assert.equal(parsed.question, null);assert.ok(parsed.meanings.length);
  const row = { id: randomUUID(), parserVersion: Ko3Statement.PARSER_VERSION, text, at: now, confirmedAt: now, meanings: parsed.meanings, clarifications: [] };
  assert.equal(row.parserVersion, 'member-statement-ko-3');
  const oldText = '예시를 먼저 보는 게 편해요.', ko2 = Ko2Statement.parseMemberStatement(oldText);
  const oldRow = { id: randomUUID(), parserVersion: Ko2Statement.PARSER_VERSION, text: oldText, at: now, confirmedAt: now, meanings: ko2.meanings, clarifications: [] };
  for (const original of [state(), v2(), { ...v2(), version: 3, statements: [statement(), oldRow] }]) {
    const prior = structuredClone(original), next = updateMemberUnderstanding(original, { type: 'statement', value: row, replaceId: null }, now);
    assert.equal(next.version, 4);assert.deepEqual(original, prior);
    for (const old of prior.statements || []) assert.deepEqual(next.statements.find(item => item.id === old.id), old);
    const normalizedPrior = validateMemberUnderstanding(prior);
    assert.deepEqual(next.reviews, normalizedPrior.reviews);assert.deepEqual(next.overrides, normalizedPrior.overrides);
    for (const version of [2, 3]) assert.throws(() => validateMemberUnderstanding({ ...next, version }), { code: 'INVALID_PERSONAL_STATE' });
    assert.deepEqual(parsePersonalState('member-understanding', serializePersonalState('member-understanding', next)), next);
    const removed = updateMemberUnderstanding(next, { type: 'remove-statement', id: row.id }, now);
    assert.equal(removed.version, 4);assert.equal(removed.statements.length, prior.statements?.length || 0);
    assert.deepEqual(updateMemberUnderstanding(next, { type: 'clear' }, now), { version: 4, reviews: [], overrides: [], statements: [] });
  }
});

for (const [parser, storageVersion] of [[Ko4Statement, 5], [Ko5Statement, 6], [Ko6Statement, 7], [Ko7Statement, 8], [Statement, 9]]) test(`${parser.PARSER_VERSION} promotes supported documents and refuses older version labels`, () => {
  const text = '책 읽기를 좋아해요.', parsed = Ko3Statement.parseMemberStatement(text);
  const oldRow = { id: randomUUID(), parserVersion: Ko3Statement.PARSER_VERSION, text, at: now, confirmedAt: now, meanings: parsed.meanings, clarifications: [] };
  const currentText = '글로 소통하는 게 좋아요.', currentParsed = parser.parseMemberStatement(currentText);
  assert.equal(currentParsed.question, null);assert.ok(currentParsed.meanings.length);
  const row = { id: randomUUID(), parserVersion: parser.PARSER_VERSION, text: currentText, at: now, confirmedAt: now, meanings: currentParsed.meanings, clarifications: [] };
  const parents = [state(), v2(), { ...v2(), version: 3 }, { ...v2(), version: 4, statements: [statement(), oldRow] }];
  for (const [olderParser, version] of [[Ko4Statement, 5], [Ko5Statement, 6], [Ko6Statement, 7], [Ko7Statement, 8]]) {
    if (version >= storageVersion) continue;
    const olderText = '글로 소통하는 게 좋아요.', olderParsed = olderParser.parseMemberStatement(olderText);
    parents.push({ ...v2(), version, statements: [statement(), oldRow, { id: randomUUID(), parserVersion: olderParser.PARSER_VERSION, text: olderText, at: now, confirmedAt: now, meanings: olderParsed.meanings, clarifications: [] }] });
  }
  for (const original of parents) {
    const before = validateMemberUnderstanding(original), next = updateMemberUnderstanding(original, { type: 'statement', value: row, replaceId: null }, now);
    assert.equal(next.version, storageVersion);assert.deepEqual(next.reviews, before.reviews);assert.deepEqual(next.overrides, before.overrides);
    for (const old of before.statements || []) assert.deepEqual(next.statements.find(item => item.id === old.id), old);
    for (const version of Array.from({length: storageVersion - 2}, (_, i) => i + 2)) assert.throws(() => validateMemberUnderstanding({ ...next, version }), { code: 'INVALID_PERSONAL_STATE' });
    assert.deepEqual(parsePersonalState('member-understanding', serializePersonalState('member-understanding', next)), next);
    assert.equal(updateMemberUnderstanding(next, { type: 'remove-statement', id: row.id }, now).version, storageVersion);
    assert.deepEqual(updateMemberUnderstanding(next, { type: 'clear' }, now), { version: storageVersion, reviews: [], overrides: [], statements: [] });
  }
});
