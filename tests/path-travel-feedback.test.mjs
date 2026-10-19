import test from 'node:test';
import assert from 'node:assert/strict';
import { REAL_PLACES } from '../experiences/path-travel/real-places.mjs';
import {
  normalizeRealState, rankRealPlaces, findRealPlaces, setRealReaction, setRealVisit,
  setRealCategoryPreference, clearRealFeedback, serializeRealState, readRealState,
  exportRealMemo, REAL_STORAGE_KEY, REAL_STORAGE_MAX_BYTES, VISIT_REASONS,
} from '../experiences/path-travel/real-guide.mjs';

const now = '2026-10-07T02:00:00.000Z', later = '2026-10-07T03:00:00.000Z';
const opts = { now }, first = REAL_PLACES[0], last = REAL_PLACES.at(-1);
const ids = state => findRealPlaces(state, opts).map(place => place.id);
const empty = () => normalizeRealState({}, opts);

test('기존 v1 선택 저장은 같은 key의 v2로 옮겨도 새 반응 저장 동의를 만들지 않는다', () => {
  assert.equal(REAL_STORAGE_KEY, 'synk-path-real-places-v1');
  const v1 = { version: 1, interests: ['culture'], selected: [last.id, first.id], consent: true };
  const migrated = readRealState(JSON.stringify(v1), opts);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.interests, v1.interests);
  assert.deepEqual(migrated.selected, v1.selected);
  assert.equal(migrated.feedbackConsent, false);
  assert.deepEqual(migrated.reactions, {});
  const forgedLegacy = { ...v1, feedbackConsent: true, reactions: { [last.id]: { value: 'interested', at: now } } };
  assert.equal(readRealState(JSON.stringify(forgedLegacy), opts), null);
  assert.deepEqual(normalizeRealState(forgedLegacy, opts).reactions, {});
});

test('관심 반응은 해당 장소를 올리고 덜보기는 낮추지만 어느 후보도 숨기지 않는다', () => {
  assert.deepEqual(ids(empty()), REAL_PLACES.map(place => place.id));
  const interested = setRealReaction(empty(), { placeId: last.id, value: 'interested', now });
  assert.equal(ids(interested)[0], last.id);
  const less = setRealReaction(empty(), { placeId: first.id, value: 'less', now });
  assert.equal(ids(less).at(-1), first.id);
  assert.equal(ids(less).length, REAL_PLACES.length);
  assert.deepEqual(new Set(ids(less)), new Set(REAL_PLACES.map(place => place.id)));
  const filtered = { ...less, interests: [first.category] };
  assert.equal(ids(filtered).at(-1), first.id);
  assert.ok(findRealPlaces(filtered, opts).every(place => place.category === first.category));
});

test('담기·삭제·순서 변경은 관심·방문 평가로 해석하지 않는다', () => {
  const baseline = empty(), original = ids(baseline);
  for (const selected of [[last.id], [last.id, first.id], [first.id, last.id], []]) {
    const state = { ...baseline, selected };
    assert.deepEqual(ids(state), original);
    assert.deepEqual(rankRealPlaces(state, opts).map(row => row.reasons), REAL_PLACES.map(() => []));
    assert.deepEqual(state.reactions, {});
    assert.deepEqual(state.visits, {});
  }
});

test('반복 클릭은 한 기록이며 시각·가중치를 누적하지 않고 수정은 이전 값을 교체한다', () => {
  let state = setRealReaction(empty(), { placeId: last.id, value: 'interested', now });
  const once = structuredClone(state), ranking = rankRealPlaces(state, opts);
  for (let index = 0; index < 50; index++) state = setRealReaction(state, { placeId: last.id, value: 'interested', now: later });
  assert.deepEqual(state, once);
  assert.deepEqual(rankRealPlaces(state, { now: later }), ranking);
  const changed = setRealReaction(state, { placeId: last.id, value: 'less', now: later });
  assert.deepEqual(Object.keys(changed.reactions), [last.id]);
  assert.deepEqual(changed.reactions[last.id], { value: 'less', at: later });
  assert.deepEqual(state, once, '입력 상태를 변경하지 않는다');
});

test('방문 평가는 직접 고른 장소에만 적용하며 이유는 업체의 특성이나 같은 분야 추론이 아니다', () => {
  const tea = REAL_PLACES.filter(place => place.category === 'tea');
  const selected = tea[1];
  const before = structuredClone(REAL_PLACES);
  const visit = setRealVisit(empty(), { placeId: selected.id, value: 'liked', reasons: ['atmosphere', 'wait'], now });
  const ranked = rankRealPlaces(visit, opts);
  assert.equal(ranked[0].place.id, selected.id);
  assert.equal(ranked[0].reasons.length, 1);
  assert.match(ranked[0].reasons[0].label, /방문 후.*좋았어요/);
  assert.deepEqual(ranked.find(row => row.place.id === tea[0].id).reasons, []);
  assert.equal(ranked.find(row => row.place.id === tea[0].id).score, 0);
  assert.deepEqual(visit.categoryPreferences, {});
  assert.deepEqual(REAL_PLACES, before);
  assert.deepEqual(visit.visits[selected.id].reasons, ['atmosphere', 'wait']);
  assert.doesNotMatch(JSON.stringify(ranked.map(row => row.reasons)), /조용|한적|대기.*짧|청결/);
});

test('분야 확장은 더보기·덜보기를 사용자가 따로 명시했을 때만 해당 분야 전체에 적용한다', () => {
  const state = setRealCategoryPreference(empty(), { category: 'stay', value: 'more', now });
  const ranked = rankRealPlaces(state, opts);
  const stays = REAL_PLACES.filter(place => place.category === 'stay');
  assert.deepEqual(ranked.slice(0, stays.length).map(row => row.place.id), stays.map(place => place.id));
  assert.ok(ranked.slice(0, stays.length).every(row => row.reasons[0].kind === 'category' && /더/.test(row.reasons[0].label)));
  const lower = setRealCategoryPreference(state, { category: 'stay', value: 'less', now: later });
  assert.deepEqual(findRealPlaces(lower, { now: later }).slice(-stays.length).map(place => place.id), stays.map(place => place.id));
  const withdrawn = setRealCategoryPreference(lower, { category: 'stay', value: null, now: later });
  assert.deepEqual(findRealPlaces(withdrawn, { now: later }), REAL_PLACES);
});

test('정렬은 방문·반응·분야 명시의 가중치를 합치고 충돌한 두 이유를 모두 그대로 보여준다', () => {
  let state = setRealVisit(empty(), { placeId: last.id, value: 'liked', now });
  state = setRealReaction(state, { placeId: last.id, value: 'less', now });
  let ranked = rankRealPlaces(state, opts);
  assert.equal(ranked[0].place.id, last.id, '방문 긍정 3과 반응 부정 2의 차이');
  assert.deepEqual(ranked[0].reasons.map(row => row.kind), ['reaction', 'visit']);
  assert.match(ranked[0].reasons[0].label, /덜 보고/);
  assert.match(ranked[0].reasons[1].label, /좋았어요/);
  state = setRealVisit(state, { placeId: last.id, value: 'disliked', now });
  ranked = rankRealPlaces(state, opts);
  assert.equal(ranked.at(-1).place.id, last.id);
  const both = setRealReaction(setRealReaction(empty(), { placeId: last.id, value: 'interested', now }), { placeId: first.id, value: 'interested', now });
  assert.deepEqual(ids(both).slice(0, 2), [first.id, last.id], '동점은 기록 시각·ID순이 아니라 기본 후보 순서');
});

test('개별 철회와 전체 취향 삭제는 선택 목록과 분리되며 이전 기록을 되살리지 않는다', () => {
  let state = { ...empty(), selected: [last.id, first.id], interests: ['culture'], feedbackConsent: true };
  state = setRealReaction(state, { placeId: last.id, value: 'interested', now });
  state = setRealVisit(state, { placeId: last.id, value: 'liked', reasons: ['value'], now });
  state = setRealCategoryPreference(state, { category: last.category, value: 'more', now });
  const noReaction = setRealReaction(state, { placeId: last.id, value: null, now });
  const noPlaceRecord = setRealVisit(noReaction, { placeId: last.id, value: null, now });
  assert.deepEqual(noPlaceRecord.reactions, {});
  assert.deepEqual(noPlaceRecord.visits, {});
  assert.deepEqual(noPlaceRecord.categoryPreferences, state.categoryPreferences, '별도로 명시한 분야 선호는 별도 철회');
  const cleared = clearRealFeedback(state, opts);
  assert.deepEqual(cleared.selected, state.selected);
  assert.deepEqual(cleared.interests, state.interests);
  assert.equal(cleared.feedbackConsent, false);
  for (const key of ['reactions', 'visits', 'categoryPreferences']) assert.deepEqual(cleared[key], {});
  assert.deepEqual(readRealState(serializeRealState(cleared, opts), opts), cleared);
});

test('새 동의 없이 현재 탭에서 순서를 바꿀 수 있지만 저장되는 값에는 취향·방문 기록이 없다', () => {
  let state = { ...empty(), selected: [first.id], interests: ['culture'] };
  state = setRealReaction(state, { placeId: last.id, value: 'interested', now });
  state = setRealVisit(state, { placeId: last.id, value: 'liked', reasons: ['experience'], now });
  state = setRealCategoryPreference(state, { category: last.category, value: 'more', now });
  const original = structuredClone(state);
  assert.equal(ids(state)[0], last.id);
  const storage = JSON.parse(serializeRealState(state, opts));
  for (const key of ['reactions', 'visits', 'categoryPreferences']) assert.deepEqual(storage[key], {});
  assert.equal(storage.feedbackConsent, false);
  assert.deepEqual(storage.selected, [first.id]);
  assert.deepEqual(state, original, '직렬화가 현재 탭 기록을 지우지 않는다');
  const withConsent = { ...state, feedbackConsent: true };
  assert.deepEqual(readRealState(serializeRealState(withConsent, opts), opts), withConsent);
  const revoked = { ...withConsent, feedbackConsent: false };
  assert.deepEqual(readRealState(serializeRealState(revoked, opts), opts).visits, {});
});

test('명시 의견은 30일 뒤 사라지거나 시각이 갱신되지 않으며 내보내기는 개인 의견을 섞지 않는다', () => {
  const state = { ...setRealVisit(empty(), { placeId: last.id, value: 'liked', reasons: ['atmosphere'], now }), selected: [last.id] };
  const afterYear = { now: '2027-10-07T02:00:00.000Z' };
  assert.equal(rankRealPlaces(state, afterYear)[0].place.id, last.id);
  assert.equal(rankRealPlaces(state, afterYear)[0].reasons[0].at, now);
  const memo = exportRealMemo(state, opts);
  assert.match(memo, /메모 만든 시각 \(한국\): .*11:00/);
  assert.doesNotMatch(memo, /방문 후 ‘|좋았어요|아쉬웠어요|취향 기록/);
  assert.equal(exportRealMemo(state, opts), exportRealMemo(state, opts));
});

test('미래·잘못된 날짜·비유한 값·알 수 없는 응답과 이유는 기록이나 복원에 들어가지 않는다', () => {
  const valid = { ...setRealVisit(empty(), { placeId: first.id, value: 'liked', reasons: ['access'], now }), feedbackConsent: true };
  const stored = JSON.parse(serializeRealState(valid, opts));
  for (const invalid of [
    { ...stored, visits: { [first.id]: { value: 'liked', reasons: ['access'], at: later } } },
    { ...stored, visits: { [first.id]: { value: 'liked', reasons: ['access'], at: '2026-02-30T00:00:00.000Z' } } },
    { ...stored, visits: { [first.id]: { value: 'liked', reasons: ['unknown'], at: now } } },
    { ...stored, visits: { [first.id]: { value: 'liked', reasons: ['access', 'access'], at: now } } },
    { ...stored, visits: { [first.id]: { value: Infinity, reasons: [], at: now } } },
    { ...stored, visits: { fake: { value: 'liked', reasons: [], at: now } } },
    { ...stored, visits: { [first.id]: { value: 'liked', reasons: [], at: now, venueIsQuiet: true } } },
    { ...stored, extra: true }, { ...stored, feedbackConsent: false }, { ...stored, feedbackConsent: 'true' },
    { ...stored, interests: ['unknown'] }, { ...stored, selected: [first.id, first.id] },
  ]) assert.equal(readRealState(JSON.stringify(invalid), opts), null);
  assert.deepEqual(normalizeRealState({ ...empty(), visits: { [first.id]: { value: 'liked', reasons: [], at: later } } }, opts).visits, {});
  for (const badNow of [Infinity, NaN, 'never', '2026-02-30T00:00:00.000Z']) assert.throws(() => setRealReaction(empty(), { placeId: first.id, value: 'interested', now: badNow }), TypeError);
  assert.throws(() => setRealReaction(empty(), { placeId: 'constructor', value: 'interested', now }), TypeError);
  assert.throws(() => setRealReaction(empty(), { placeId: first.id, value: Infinity, now }), TypeError);
  assert.throws(() => setRealVisit(empty(), { placeId: first.id, value: 'liked', reasons: ['invented'], now }), TypeError);
  assert.throws(() => setRealCategoryPreference(empty(), { category: 'unknown', value: 'more', now }), TypeError);
});

test('원형 오염 키·상속 상태·바이트 상한 초과 저장은 거부하고 정상 최대 기록은 왕복된다', () => {
  const base = JSON.parse(serializeRealState(empty(), opts));
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.equal(readRealState(JSON.stringify(base).replace('"reactions":{}', `"reactions":{"${key}":{"value":"interested","at":"${now}"}}`), opts), null);
    assert.equal(readRealState(JSON.stringify(base).replace('"consent":true', `"${key}":{},"consent":true`), opts), null);
  }
  assert.deepEqual(normalizeRealState(Object.create({ interests: ['tea'], feedbackConsent: true }), opts), empty());
  const koreanPadding = JSON.stringify({ ...base, padding: '가'.repeat(Math.floor(REAL_STORAGE_MAX_BYTES / 2)) });
  assert.ok(koreanPadding.length < REAL_STORAGE_MAX_BYTES);
  assert.ok(new TextEncoder().encode(koreanPadding).byteLength > REAL_STORAGE_MAX_BYTES);
  assert.equal(readRealState(koreanPadding, opts), null);
  let full = { ...empty(), feedbackConsent: true };
  for (const place of REAL_PLACES) {
    full = setRealReaction(full, { placeId: place.id, value: 'interested', now });
    full = setRealVisit(full, { placeId: place.id, value: 'liked', reasons: VISIT_REASONS.map(row => row.id), now });
    full = setRealCategoryPreference(full, { category: place.category, value: 'more', now });
  }
  assert.ok(new TextEncoder().encode(serializeRealState(full, opts)).byteLength < REAL_STORAGE_MAX_BYTES);
  assert.deepEqual(readRealState(serializeRealState(full, opts), opts), full);
});
