'use strict';
// Product vocabulary for Core's member understanding. No identity, raw source
// content, URL or model output belongs in a stored claim. Hosts own consent/CAS.
const VERSION = 1;
const DAY = 86400000;
const choices = rows => Object.freeze(rows.map(([id, label]) => Object.freeze({ id, label })));
const MEMBER_UNDERSTANDING_FACETS = Object.freeze({
  topics: Object.freeze({ title: '직접 고른 관심 주제', multiple: true, max: 5, choices: choices([
    ['travel-planning', '여행 일정·동선'], ['travel-food', '여행지 음식·주문'], ['travel-stay', '여행지 숙소'],
    ['career-interview', '면접 준비'], ['career-planning', '진로 탐색'], ['content-video', '영상 제작'],
    ['content-design', '디자인 제작'], ['ai-tools', 'AI 도구 활용'], ['work-collaboration', '업무 협업'],
  ]) }),
  'usage-repeat': Object.freeze({ title: '여러 날 다시 연 앱', multiple: false, max: 1, choices: choices([
    ['world', 'WORLD'], ['messenger', '워크스페이스'], ['path', 'PATH'], ['pulse', 'PULSE'], ['no-fixed-app', '특정 앱으로 정해 두지 않음'],
  ]) }),
  'practice-mode': Object.freeze({ title: '기록에 반복해서 나타난 학습 방식', multiple: false, max: 1, choices: choices([
    ['listening', '듣기'], ['reading', '읽기'], ['mixed', '듣기와 읽기를 함께'], ['no-fixed-mode', '특정 방식으로 정해 두지 않음'],
  ]) }),
  'practice-response': Object.freeze({ title: '기록에 반복해서 나타난 응답 방식', multiple: false, max: 1, choices: choices([
    ['binary-choice', '두 보기에서 고르기'], ['single-choice', '여러 보기에서 고르기'], ['cup-compose', '낱말을 조합하기'],
    ['action', '행동으로 답하기'], ['mixed', '여러 방식을 함께'], ['no-fixed-format', '특정 방식으로 정해 두지 않음'],
  ]) }),
  'learning-topic': Object.freeze({ title: '실제로 다룬 학습 내용', multiple: false, max: 1, choices: choices([
    ['interested', '관심 있는 내용이에요'], ['practice-only', '연습에서 다룬 내용일 뿐이에요'], ['not-now', '지금 관심 있는 내용은 아니에요'],
  ]) }),
  support: Object.freeze({ title: '직접 고른 도움 방식', multiple: false, max: 1, choices: choices([
    ['choose', '필요할 때 선택'], ['step', '단계별 도움'], ['independent', '먼저 혼자 시도'],
  ]) }),
  explanation: Object.freeze({ title: '직접 고른 설명 길이', multiple: false, max: 1, choices: choices([
    ['brief', '짧게'], ['standard', '보통 길이'], ['detailed', '자세히'],
  ]) }),
});
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const dataField = (x, key) => { const field = Object.getOwnPropertyDescriptor(x, key); return field?.enumerable === true && Object.hasOwn(field, 'value'); };
const exact = (x, fields) => plain(x) && Reflect.ownKeys(x).length === fields.length && fields.every(key => dataField(x, key));
const token = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(x) && !['constructor', 'prototype', '__proto__'].includes(x);
const fail = () => { throw new TypeError('Member understanding: invalid structured contract'); };
const CLAIM_FIELDS = Object.freeze(['version', 'kind', 'source', 'generation', 'reference', 'value', 'from', 'to', 'count', 'total', 'activeDays', 'lastAt']);
function instant(x) {
  if (typeof x !== 'string' || !Number.isFinite(Date.parse(x)) || new Date(x).toISOString() !== x) fail();
  return Date.parse(x);
}
function understandingFacet(facetId) {
  if (typeof facetId !== 'string') fail();
  if (facetId.startsWith('learning-topic:') && token(facetId.slice(15))) return MEMBER_UNDERSTANDING_FACETS['learning-topic'];
  if (facetId !== 'learning-topic' && Object.hasOwn(MEMBER_UNDERSTANDING_FACETS, facetId)) return MEMBER_UNDERSTANDING_FACETS[facetId];
  return fail();
}
function validateUnderstandingValues(facetId, values) {
  const facet = understandingFacet(facetId);
  if (!Array.isArray(values) || !values.length || values.length > facet.max || Reflect.ownKeys(values).length !== values.length + 1
    || !Array.from({ length: values.length }, (_, index) => index).every(index => dataField(values, String(index))) || new Set(values).size !== values.length
    || values.some(value => !facet.choices.some(choice => choice.id === value))) fail();
  return facet.choices.filter(choice => values.includes(choice.id)).map(choice => choice.id);
}
function validateUnderstandingClaim(claim, { facetId } = {}) {
  understandingFacet(facetId);
  if (!exact(claim, CLAIM_FIELDS)
    || claim.version !== VERSION || !['learning-topic', 'usage-repeat', 'practice-mode', 'practice-response'].includes(claim.kind)) fail();
  const expectedFacet = claim.kind === 'learning-topic' ? `learning-topic:${claim.reference}` : claim.kind;
  if (facetId !== expectedFacet || claim.source !== (claim.kind === 'usage-repeat' ? 'usage' : 'learning')
    || claim.value !== (claim.kind === 'learning-topic' ? 'interested' : 'fits') || !token(claim.reference)) fail();
  if (claim.source === 'usage') {
    if (instant(claim.generation) > instant(claim.lastAt)) fail();
  } else if (!Number.isSafeInteger(claim.generation) || claim.generation < 0) fail();
  if (claim.kind !== 'learning-topic') {
    const allowed = MEMBER_UNDERSTANDING_FACETS[claim.kind].choices.map(choice => choice.id).filter(id => !['mixed', 'no-fixed-app', 'no-fixed-mode', 'no-fixed-format'].includes(id));
    if (!allowed.includes(claim.reference)) fail();
  }
  const from = instant(claim.from), to = instant(claim.to), last = instant(claim.lastAt);
  if (to - from !== 30 * DAY || last <= from || last > to
    || !['count', 'total', 'activeDays'].every(key => Number.isSafeInteger(claim[key]) && claim[key] >= 1 && claim[key] <= 1000000)
    || claim.count > claim.total || claim.activeDays > claim.count || claim.activeDays > 31) fail();
  // PostgreSQL jsonb may reorder keys. Fixed output order makes an identical
  // review retry compare equal after an account round trip.
  return Object.fromEntries(CLAIM_FIELDS.map(key => [key, claim[key]]));
}
module.exports = { VERSION, MEMBER_UNDERSTANDING_FACETS, understandingFacet, validateUnderstandingClaim, validateUnderstandingValues };
