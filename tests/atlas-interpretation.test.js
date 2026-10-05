'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Interpretation = require('../atlas/interpretation');
const Domain = require('../atlas/domain');

// Synthetic source text only. Authentication and permission belong to the host.
const SOURCE_AT = '2026-10-05T09:00:00.000Z';
const AT = '2026-10-05T10:00:00.000Z';
const LATER = '2026-10-05T11:00:00.000Z';
const LAST = '2026-10-05T12:00:00.000Z';
const scope = { domain: 'SHIFT', workspace: 'interpretation-fixture', subject: 'synthetic-user' };
const contract = {
  id: 'work-request', version: '1', purpose: 'work-request-confirmation',
  fields: [
    { id: 'format', kind: 'enum', values: ['checklist', 'narrative'] },
    { id: 'deadlineDays', kind: 'number', range: [0, 30] },
    { id: 'remote', kind: 'boolean' },
  ],
  criteria: [
    { id: 'format-fit', field: 'format', feature: 'format', weight: 2 },
    { id: 'deadline-fit', field: 'deadlineDays', feature: 'deliveryDays', weight: 1, prefer: 'at-most', required: true },
  ],
};
const clone = value => structuredClone(value);
function source(id = 'source-1', text = '저는 체크리스트가 좋아요. 이틀 안에 필요하고 원격으로 일해요.', extra = {}) {
  return { id, scope: { ...scope }, at: SOURCE_AT, text, actor: 'self', ...extra };
}
function proposal(s, id = 'proposal-1', field = 'format', value = 'checklist', quote = '체크리스트가 좋아요', extra = {}) {
  const start = s.text.indexOf(quote);
  assert.ok(start >= 0, 'fixture quote exists in its source');
  return { id, field, value, subject: 'self', stance: 'current',
    evidence: [{ sourceId: s.id, start, end: start + quote.length, quote }], ...extra };
}
function fixture(extra = {}) {
  const s = source();
  return { contract: clone(contract), scope: { ...scope }, sources: [s], proposals: [proposal(s)], at: AT, reviews: [], ...extra };
}
const prepare = input => Interpretation.prepare(input);
const resolve = input => Interpretation.resolve(input);
const field = (result, id = 'format') => result.understanding.fields.find(entry => entry.id === id);
const status = (result, id = 'proposal-1') => result.proposals.find(entry => entry.id === id).status;
function review(input, action, extra = {}) {
  return Interpretation.review({ ...input, id: `review-${input.reviews.length + 1}`, proposalId: input.proposals[0].id, action, ...extra });
}
function appendReview(input, action, extra = {}) {
  return { ...input, reviews: [...input.reviews, review(input, action, extra)] };
}

test('raw interpretation proposals remain unconfirmed and cannot satisfy a required recommendation fact', () => {
  const input = fixture(), before = clone(input);
  const prepared = prepare(input), resolved = resolve(input);
  assert.equal(status(prepared), 'pending');
  assert.ok(resolved.understanding.fields.every(item => !item.usable));
  assert.ok(!resolved.observations.some(item => item.source === 'declared'));
  assert.equal(Domain.decide({ contract, scope, observations: resolved.observations, at: AT,
    candidates: [{ id: 'quick', features: { format: 'checklist', deliveryDays: 1 } }] }).status, 'unavailable');
  assert.deepEqual(input, before, 'interpreting must not rewrite the original text or caller state');
});

test('an explicit confirmation creates a scoped declaration and only that confirmed field becomes usable', () => {
  const input = appendReview(fixture(), 'confirm');
  const result = resolve(input);
  assert.equal(field(result).usable, true);
  assert.equal(field(result).status, 'declared');
  assert.equal(field(result).value, 'checklist');
  assert.equal(field(result, 'deadlineDays').usable, false);
  const observation = result.observations.find(item => item.field === 'format' && item.value === 'checklist');
  assert.equal(observation.source, 'declared');
  assert.deepEqual(observation.scope, scope);
  assert.deepEqual(observation.contract, { id: contract.id, version: contract.version, purpose: contract.purpose });
  assert.equal(observation.at, AT);
});

test('confirmed numeric constraints reach the existing Core decision rather than a separate ranking rule', () => {
  const s = source(), p = proposal(s, 'deadline', 'deadlineDays', 2, '이틀 안에 필요');
  let input = fixture({ sources: [s], proposals: [p] });
  input = appendReview(input, 'confirm');
  const result = resolve(input);
  const choice = Domain.decide({ contract, scope, observations: result.observations, at: AT, candidates: [
    { id: 'late', features: { format: 'checklist', deliveryDays: 5 } },
    { id: 'on-time', features: { format: 'narrative', deliveryDays: 1 } },
  ] });
  assert.equal(choice.selected.id, 'on-time');
  assert.deepEqual(choice.excluded[0], { id: 'late', reasons: ['constraint:deadline-fit'] });
});

test('correction is an explicit user value and preserves false and zero without coercion', () => {
  for (const [id, value, quote, corrected] of [
    ['remote', true, '원격으로 일해요', false],
    ['deadlineDays', 2, '이틀 안에 필요', 0],
  ]) {
    const s = source(), input = fixture({ sources: [s], proposals: [proposal(s, id, id, value, quote)] });
    assert.throws(() => review(input, 'correct'), 'correction must contain a value');
    const result = resolve(appendReview(input, 'correct', { value: corrected }));
    assert.equal(field(result, id).usable, true);
    assert.equal(field(result, id).value, corrected);
  }
});

test('field names, value types and ranges must match the product contract exactly', () => {
  for (const changes of [
    { field: 'unregistered' }, { value: 'other' }, { value: null },
    { field: 'deadlineDays', value: '2' }, { field: 'deadlineDays', value: 31 },
    { field: 'deadlineDays', value: Infinity }, { field: 'remote', value: 'true' },
  ]) {
    const input = fixture(); Object.assign(input.proposals[0], changes);
    assert.throws(() => prepare(input));
  }
  for (const value of ['other', false, null, 2]) assert.throws(() => review(fixture(), 'correct', { value }));
});

test('other-person, historical, hypothetical and uncertain proposals cannot be confirmed as current facts', () => {
  for (const changes of [{ subject: 'other' }, { stance: 'past' }, { stance: 'hypothetical' }, { stance: 'uncertain' }]) {
    const input = fixture(); Object.assign(input.proposals[0], changes);
    assert.equal(status(prepare(input)), 'blocked');
    assert.equal(field(resolve(input)).usable, false);
    assert.throws(() => review(input, 'confirm'));
  }
  const input = fixture(); input.sources[0].actor = 'other';
  assert.equal(status(prepare(input)), 'blocked');
  assert.throws(() => review(input, 'confirm'));
});

test('different proposed values stay visibly conflicted until the person supplies a correction', () => {
  const first = source('s1'), second = source('s2', '저는 서술형이 좋아요.');
  const input = fixture({ sources: [first, second], proposals: [proposal(first), proposal(second, 'p2', 'format', 'narrative', '서술형이 좋아요')] });
  assert.ok(prepare(input).proposals.every(item => item.status === 'conflict'));
  assert.throws(() => review(input, 'confirm'));
  assert.throws(() => review(input, 'confirm', { proposalId: 'p2' }));
  assert.equal(field(resolve(input)).usable, false);
  const confirmed = resolve(appendReview(input, 'correct', { value: 'narrative' }));
  assert.equal(field(confirmed).value, 'narrative');
  assert.equal(field(confirmed).status, 'declared');
});

test('rejecting a conflicting alternative makes the remaining proposal eligible for confirmation', () => {
  const first = source('s1'), second = source('s2', '저는 서술형이 좋아요.');
  let input = fixture({ sources: [first, second], proposals: [proposal(first), proposal(second, 'p2', 'format', 'narrative', '서술형이 좋아요')] });
  assert.ok(resolve(input).proposals.every(item => item.status === 'conflict'));
  input = appendReview(input, 'reject', { proposalId: 'p2' });
  const excluded = resolve(input);
  assert.equal(status(excluded), 'pending');
  assert.equal(excluded.proposals.find(item => item.id === 'p2').review.action, 'reject');
  assert.equal(field(excluded).usable, false, 'removing a competing interpretation is not itself confirmation');
  input = appendReview({ ...input, at: LATER }, 'confirm');
  assert.equal(field(resolve(input)).value, 'checklist');
  assert.equal(field(resolve(input)).status, 'declared');
});

test('a rejected or withdrawn alternative still conflicts with another active value when reconfirmed', () => {
  for (const previousAction of ['reject', 'withdraw']) {
    const first = source('s1'), second = source('s2', '저는 서술형이 좋아요.');
    let input = fixture({ sources: [first, second], proposals: [proposal(first), proposal(second, 'p2', 'format', 'narrative', '서술형이 좋아요')] });
    if (previousAction === 'withdraw') input = appendReview(input, 'correct', { proposalId: 'p2', value: 'narrative' });
    input = appendReview(input, previousAction, { proposalId: 'p2' });
    input = appendReview({ ...input, at: LATER }, 'confirm');
    assert.equal(field(resolve(input)).value, 'checklist');
    assert.equal(status(resolve(input), 'p2'), 'conflict');
    assert.throws(() => review({ ...input, at: LAST }, 'confirm', { proposalId: 'p2' }));
    input = appendReview({ ...input, at: LAST }, 'correct', { proposalId: 'p2', value: 'narrative' });
    const corrected = resolve(input);
    assert.equal(field(corrected).value, 'narrative');
    assert.equal(field(corrected).status, 'declared');
    assert.equal(corrected.observations.at(-1).supersedes, corrected.observations.at(-2).id);
  }
});

test('matching proposals are not treated as a contradiction or automatic independent proof', () => {
  const s = source(), input = fixture({ sources: [s], proposals: [proposal(s), proposal(s, 'p2')] });
  assert.ok(prepare(input).proposals.every(item => item.status === 'pending'));
  assert.equal(field(resolve(input)).usable, false);
});

test('UTF-16 source offsets and exact quotations preserve an emoji before the claimed span', () => {
  const s = source('emoji-source', '🙂 저는 체크리스트가 좋아요.'), p = proposal(s);
  const input = fixture({ sources: [s], proposals: [p] });
  assert.equal(status(prepare(input)), 'pending');
  assert.equal(field(resolve(appendReview(input, 'confirm'))).value, 'checklist');
  const wrong = clone(input); wrong.proposals[0].evidence[0].start -= 1; wrong.proposals[0].evidence[0].end -= 1;
  assert.throws(() => prepare(wrong), 'code-point offsets must not be accepted as UTF-16 offsets');
});

test('invented quotes, nonexistent sources and invalid spans are rejected before review', () => {
  for (const patch of [{ quote: '제가 하지 않은 말' }, { sourceId: 'missing-source' }, { start: -1 }, { start: 1.5 }, { end: 500 }, { end: 1 }]) {
    const input = fixture(); Object.assign(input.proposals[0].evidence[0], patch);
    assert.throws(() => prepare(input));
  }
  const input = fixture(); input.proposals[0].evidence = [];
  assert.throws(() => prepare(input));
});

test('a source from another person, workspace or product scope cannot be interpreted here', () => {
  for (const [key, value] of [['subject', 'foreign-user'], ['workspace', 'foreign-workspace'], ['domain', 'LAB']]) {
    const input = fixture(); input.sources[0].scope[key] = value;
    assert.throws(() => prepare(input));
  }
});

test('a future source or a review earlier than its source is rejected', () => {
  const input = fixture(); input.sources[0].at = LATER;
  assert.throws(() => prepare(input));
  assert.throws(() => review(input, 'confirm'));
});

test('same-time reviews use explicit array order and supersede the prior declaration', () => {
  let input = appendReview(fixture(), 'confirm');
  input = appendReview(input, 'correct', { value: 'narrative' });
  const result = resolve(input), declarations = result.observations.filter(item => item.field === 'format' && item.source === 'declared');
  assert.equal(field(result).value, 'narrative');
  assert.equal(declarations.length, 2);
  assert.equal(declarations[1].supersedes, declarations[0].id);
});

test('out-of-order reviews and future review replay do not rewrite a past state', () => {
  let input = appendReview(fixture(), 'confirm');
  input = { ...input, at: LATER };
  input = appendReview(input, 'correct', { value: 'narrative' });
  assert.throws(() => resolve({ ...input, reviews: [...input.reviews].reverse() }));
  assert.throws(() => resolve({ ...input, at: AT }));
});

test('reject leaves a pending proposal unconfirmed, while withdrawal removes an earlier confirmed declaration', () => {
  const rejected = resolve(appendReview(fixture(), 'reject'));
  assert.equal(field(rejected).usable, false);
  let input = appendReview(fixture(), 'confirm');
  input = appendReview({ ...input, at: LATER }, 'withdraw');
  const withdrawn = resolve(input);
  assert.equal(field(withdrawn).status, 'withdrawn');
  assert.equal(field(withdrawn).value, null);
  assert.equal(field(withdrawn).usable, false);
  for (const action of ['confirm', 'reject', 'withdraw']) assert.throws(() => review(fixture(), action, { value: 'narrative' }));
});

test('withdrawing a newer declaration cannot resurrect a different older confirmed value', () => {
  let input = appendReview(fixture(), 'confirm');
  const second = source('s2', '이제 서술형이 좋아요.', { at: LATER });
  input = { ...input, at: LATER, sources: [...input.sources, second], proposals: [...input.proposals, proposal(second, 'p2', 'format', 'narrative', '서술형이 좋아요')] };
  input = appendReview(input, 'correct', { proposalId: 'p2', value: 'narrative' });
  assert.equal(field(resolve(input)).value, 'narrative');
  input = appendReview({ ...input, at: LAST }, 'withdraw', { proposalId: 'p2' });
  assert.equal(field(resolve(input)).status, 'withdrawn');
  assert.equal(field(resolve(input)).value, null);
});

test('the entire source and reviewed proposal are bound, even if the cited substring is unchanged', () => {
  const approved = appendReview(fixture(), 'confirm');
  for (const mutate of [
    input => { input.sources[0].text += ' 추가된 다른 내용'; },
    input => { input.sources[0].at = '2026-10-05T08:00:00.000Z'; },
    input => { input.sources[0].actor = 'other'; },
    input => { input.proposals[0].value = 'narrative'; },
    input => { input.proposals[0].stance = 'past'; },
    input => { input.contract.version = '2'; },
    input => { input.contract.purpose = 'another-purpose'; },
    input => { input.contract.criteria[0].weight = 9; },
  ]) {
    const tampered = clone(approved); mutate(tampered);
    assert.throws(() => resolve(tampered), 'an old confirmation must not authorize changed material');
  }
});

test('excluding a reviewed source invalidates its declaration without invalidating the original review basis', () => {
  let input = appendReview(fixture(), 'confirm');
  input = { ...input, at: LATER, sources: input.sources.map(s => ({ ...s, excludedAt: LATER })) };
  const result = resolve(input);
  assert.equal(field(result).status, 'withdrawn');
  assert.equal(field(result).value, null);
  assert.equal(field(result).usable, false);
  assert.throws(() => review(input, 'confirm'));
  assert.throws(() => review(input, 'correct', { value: 'narrative' }));
});

test('excluding the latest source does not revive an earlier declaration from a different source', () => {
  let input = appendReview(fixture(), 'confirm');
  const second = source('s2', '이제 서술형이 좋아요.', { at: LATER });
  input = { ...input, at: LATER, sources: [...input.sources, second], proposals: [...input.proposals, proposal(second, 'p2', 'format', 'narrative', '서술형이 좋아요')] };
  input = appendReview(input, 'correct', { proposalId: 'p2', value: 'narrative' });
  input = { ...input, at: LAST, sources: input.sources.map(s => s.id === 's2' ? { ...s, excludedAt: LAST } : s) };
  const result = resolve(input);
  assert.equal(field(result).status, 'withdrawn');
  assert.equal(field(result).value, null);
});

test('withdrawing an old source does not erase a later confirmation from a new usable source', () => {
  let input = appendReview(fixture(), 'confirm');
  const second = source('s2', '이제 서술형이 좋아요.', { at: LATER });
  input = { ...input, at: LATER,
    sources: [...input.sources.map(s => ({ ...s, excludedAt: LATER })), second],
    proposals: [...input.proposals, proposal(second, 'p2', 'format', 'narrative', '서술형이 좋아요')],
  };
  assert.equal(status(prepare(input)), 'blocked');
  assert.equal(status(prepare(input), 'p2'), 'pending');
  input = appendReview(input, 'confirm', { proposalId: 'p2' });
  const result = resolve(input);
  assert.equal(field(result).status, 'declared');
  assert.equal(field(result).value, 'narrative');
  assert.equal(result.observations[0].value, null);
  assert.equal(result.observations[1].supersedes, result.observations[0].id);
});

test('rejecting a different proposal for the same field preserves the already confirmed declaration', () => {
  let input = appendReview(fixture(), 'confirm');
  const second = source('s2', '저는 서술형이 좋아요.', { at: LATER });
  input = { ...input, at: LATER, sources: [...input.sources, second],
    proposals: [...input.proposals, proposal(second, 'p2', 'format', 'narrative', '서술형이 좋아요')] };
  input = appendReview(input, 'reject', { proposalId: 'p2' });
  const result = resolve(input);
  assert.equal(field(result).value, 'checklist');
  assert.equal(field(result, 'remote').usable, false);
  assert.equal(result.observations.length, 1);
});

test('a later-added conflicting interpretation cannot retroactively invalidate an actual user confirmation', () => {
  for (const sameSource of [false, true]) {
    let input = appendReview(fixture(), 'confirm');
    const second = sameSource ? input.sources[0] : source('late-source', '저는 서술형이 좋아요.', { at: '2026-10-05T09:30:00.000Z' });
    const added = proposal(second, 'late-proposal', 'format', 'narrative', sameSource ? '체크리스트가 좋아요' : '서술형이 좋아요');
    input = { ...input, at: LATER, sources: sameSource ? input.sources : [...input.sources, second], proposals: [...input.proposals, added] };
    assert.ok(prepare(input).proposals.every(item => item.status === 'conflict'));
    assert.equal(field(resolve(input)).value, 'checklist', 'only a new user action can replace the actual earlier confirmation');
    assert.throws(() => review(input, 'confirm', { proposalId: added.id }), 'a new confirmation still checks the current conflict');
    const corrected = resolve(appendReview(input, 'correct', { proposalId: added.id, value: 'narrative' }));
    assert.equal(field(corrected).value, 'narrative');
  }
});

test('replaying the identical review is idempotent and a changed review with the same ID is rejected', () => {
  const input = appendReview(fixture(), 'confirm'), result = resolve(input);
  assert.deepEqual(resolve({ ...input, reviews: [...input.reviews, clone(input.reviews[0])] }), result);
  assert.throws(() => resolve({ ...input, reviews: [...input.reviews, { ...input.reviews[0], action: 'reject' }] }));
});

test('a confirmed extraction expires with its source while a new correction has its own declaration time', () => {
  const c = clone(contract); c.fields[0].maxAgeDays = 1;
  let input = fixture({ contract: c });
  input = appendReview(input, 'confirm');
  assert.equal(field(resolve({ ...input, at: '2026-10-06T09:00:00.000Z' })).status, 'expired');
  input = appendReview({ ...input, at: '2026-10-06T08:00:00.000Z' }, 'correct', { value: 'narrative' });
  const result = resolve({ ...input, at: '2026-10-06T09:00:00.000Z' });
  assert.equal(field(result).value, 'narrative');
  assert.equal(field(result).usable, true);
});

test('source and proposal collection limits reject oversized inputs', () => {
  const oversizedText = fixture(); oversizedText.sources[0].text += '가'.repeat(4000);
  assert.throws(() => prepare(oversizedText));
  const oversizedSources = fixture({ sources: Array.from({ length: 33 }, (_, i) => source(`source-${i}`)) });
  oversizedSources.proposals = [proposal(oversizedSources.sources[0])];
  assert.throws(() => prepare(oversizedSources));
  const s = source();
  assert.throws(() => prepare(fixture({ sources: [s], proposals: Array.from({ length: 101 }, (_, i) => proposal(s, `p-${i}`)) })));
});

test('two hundred reviews remain valid but the next review cannot grow the bounded event log', () => {
  let input = fixture();
  for (let i = 0; i < 200; i++) input = appendReview(input, 'correct', { value: i % 2 ? 'narrative' : 'checklist' });
  assert.equal(input.reviews.length, 200);
  assert.equal(field(resolve(input)).value, 'narrative');
  assert.throws(() => review(input, 'correct', { value: 'checklist' }));
  assert.throws(() => resolve({ ...input, reviews: [...input.reviews, { ...input.reviews.at(-1), id: 'over-limit' }] }));
});

test('a review targets one known proposal and uses an allowed action', () => {
  assert.throws(() => review(fixture(), 'confirm', { proposalId: 'missing' }));
  assert.throws(() => review(fixture(), 'approve'));
  const input = appendReview(fixture(), 'confirm');
  assert.throws(() => review(input, 'correct', { id: input.reviews[0].id, value: 'narrative' }));
});

test('review creation and resolution do not mutate the original source, proposal or existing events', () => {
  const input = fixture(), before = clone(input), event = review(input, 'confirm');
  assert.deepEqual(input, before);
  const reviewed = { ...input, reviews: [event] }, snapshot = clone(reviewed);
  resolve(reviewed);
  assert.deepEqual(reviewed, snapshot);
});
