import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPersonalization, setPreference, removePreference, startNewTrip,
  summarizePersonalization, valueLabel,
} from '../experiences/path-travel/profile.mjs';
import {
  buildRecommendations, DEFAULT_PROFILE, PRESETS,
} from '../experiences/path-travel/model.mjs';
import { exportPlan } from '../experiences/path-travel/storage.mjs';

const AT = '2026-10-06T00:00:00.000Z';
const EXPIRED_AT = '2026-11-07T00:00:00.000Z';
const declare = (state, field, value, options = {}) => setPreference(state, { field, value, at: AT, ...options });
const recommend = (state, options = {}) => buildRecommendations(DEFAULT_PROFILE, {
  personalization: state, at: AT, includeQuestion: false, ...options,
});
const entryOf = (state, field, at = AT) => summarizePersonalization(state, { at }).entries.find(entry => entry.field === field);
const detailOf = (result, field) => result.primary?.fitDetails.find(detail => detail.field === field);

test('기본값과 시연 프리셋은 사용자 선언·관찰·추천 증거를 만들어 내지 않는다', () => {
  for (const profile of [DEFAULT_PROFILE, ...PRESETS.map(preset => preset.profile)]) {
    const state = createPersonalization();
    const result = buildRecommendations(profile, { personalization: state, at: AT, includeQuestion: false });
    assert.equal(result.status, 'ready');
    assert.deepEqual(result.engineAudit.declaredFields, []);
    assert.deepEqual(result.engineAudit.observations, []);
    assert.deepEqual(result.engineAudit.decisionReasons, []);
    assert.deepEqual(result.primary.fitDetails, []);
    assert.deepEqual(state.events, []);
  }
});

test('소음 원값과 이벤트 출처가 관찰·판단·최종 추천 설명까지 이어진다', () => {
  const state = declare(createPersonalization(), 'hotelNoise', 0.2, {
    mode: 'require', importance: 5, duration: 'ongoing',
  });
  const raw = state.events.find(event => event.field === 'hotelNoise');
  const result = recommend(state);
  const observed = result.engineAudit.observations.find(observation => observation.field === raw.field);
  const understood = result.engineAudit.understanding.fields.find(field => field.id === raw.field);
  const reason = result.engineAudit.decisionReasons.find(reason => reason.field === raw.field);
  const fit = detailOf(result, raw.field);

  assert.equal(raw.value, 0.2);
  assert.equal(observed.id, raw.id);
  assert.equal(observed.value, raw.value);
  assert.equal(observed.at, raw.at);
  assert.deepEqual(observed.refs, [raw.id]);
  assert.equal(understood.value, raw.value);
  assert.equal(understood.status, 'declared');
  assert.equal(reason.value, raw.value);
  assert.deepEqual(reason.evidence, [raw.id]);
  assert.equal(fit.eventId, raw.id);
  assert.deepEqual(fit.evidence, [raw.id]);
  assert.equal(fit.wanted, valueLabel(raw.field, raw.value));
  assert.equal(fit.mode, 'require');
  assert.equal(fit.importance, 5);
  assert.equal(fit.duration, 'ongoing');
  assert.equal(fit.contribution, reason.contribution);
  assert.equal(fit.fit, 'met');
  assert.equal(result.primary.hotel.id, 'hotel-seongsu-b');
});

test('소음 필수 상한과 잠근 숙소가 충돌하면 임의로 완화하거나 잠금을 바꾸지 않는다', () => {
  const state = declare(createPersonalization(), 'hotelNoise', 0.2, { mode: 'require' });
  const result = recommend(state, { lockedHotelId: 'hotel-jongno-a' });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primary, null);
  assert.ok(result.diagnostics.structurallyFeasibleCount > 0, '예산·동선 문제와 구별한다');
  assert.ok(result.diagnostics.blockers.some(blocker => blocker.field === 'hotelNoise'));
  assert.equal(entryOf(state, 'hotelNoise').value, 0.2);
  assert.equal(entryOf(state, 'hotelNoise').mode, 'require');
});

test('순한 채식과 대기 10분 필수가 상충하면 세 조건 중 하나를 몰래 버리지 않는다', () => {
  let state = declare(createPersonalization(), 'vegetarian', true, { mode: 'require' });
  state = declare(state, 'spice', 0, { mode: 'require' });
  assert.equal(recommend(state).status, 'ready', '순한 채식 조합은 존재한다');
  state = declare(state, 'maxWait', 10, { mode: 'require' });
  const snapshot = structuredClone(state);
  const result = recommend(state);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primary, null);
  assert.ok(result.diagnostics.blockers.some(blocker => blocker.field === 'maxWait'));
  assert.deepEqual(result.engineAudit.declaredFields.sort(), ['maxWait', 'spice', 'vegetarian']);
  assert.deepEqual(state, snapshot);
});

test('미확인 청결은 필수 조건을 통과하지 않고 선호 조건에서는 미확인으로 설명한다', () => {
  const affordable = declare(createPersonalization(), 'budget', 500000);
  const hard = declare(affordable, 'hotelCleanliness', 0.85, { mode: 'require' });
  const blocked = recommend(hard, { lockedHotelId: 'hotel-itaewon-c' });
  assert.equal(blocked.status, 'unavailable');
  assert.ok(blocked.diagnostics.structurallyFeasibleCount > 0);
  assert.ok(blocked.diagnostics.pendingCount > 0);
  assert.ok(blocked.diagnostics.blockers.some(blocker => blocker.field === 'hotelCleanliness' && /미확인/.test(blocker.reason)));

  const soft = declare(affordable, 'hotelCleanliness', 0.85, { mode: 'prefer' });
  const available = recommend(soft, { lockedHotelId: 'hotel-itaewon-c' });
  assert.equal(available.status, 'ready');
  const fit = detailOf(available, 'hotelCleanliness');
  assert.equal(fit.fit, 'unknown');
  assert.equal(fit.actual, '자료 미확인');
  assert.equal(fit.contribution, 0);
  assert.ok(available.primary.tradeoffs.some(text => /청결.*자료가 없어/.test(text)));
});

test('같은 소음·접근성 값에서 소음 중요도만 높이면 선택 숙소와 설명이 바뀐다', () => {
  const basis = declare(createPersonalization(), 'hotelCentrality', 0.9, { importance: 3 });
  const low = declare(basis, 'hotelNoise', 0.2, { importance: 1 });
  const high = declare(basis, 'hotelNoise', 0.2, { importance: 5 });
  const lowResult = recommend(low);
  const highResult = recommend(high);
  const withoutImportance = state => state.events.filter(event => !event.field?.endsWith('.importance'));
  assert.deepEqual(withoutImportance(low), withoutImportance(high));
  assert.equal(lowResult.primary.hotel.id, 'hotel-jongno-a');
  assert.equal(highResult.primary.hotel.id, 'hotel-seongsu-b');
  assert.equal(detailOf(lowResult, 'hotelNoise').fit, 'tradeoff');
  assert.equal(detailOf(highResult, 'hotelNoise').fit, 'met');
  assert.equal(detailOf(lowResult, 'hotelCentrality').fit, 'met');
  assert.equal(detailOf(highResult, 'hotelCentrality').fit, 'tradeoff');
});

test('평소 취향은 이번 여행 덮어쓰기 뒤 새 여행에서 원 이벤트와 함께 돌아온다', () => {
  const baseline = declare(createPersonalization(), 'food', 'local', { duration: 'ongoing' });
  const overridden = declare(baseline, 'food', 'fine', { duration: 'once' });
  const original = entryOf(baseline, 'food');
  assert.equal(recommend(overridden).profile.food, 'fine');
  assert.equal(entryOf(overridden, 'food').duration, 'once');
  const next = startNewTrip(overridden, { at: AT });
  assert.equal(next.trip, 2);
  assert.equal(recommend(next).profile.food, 'local');
  assert.equal(entryOf(next, 'food').eventId, original.eventId);
  assert.equal(entryOf(next, 'food').at, original.at);
  assert.equal(entryOf(next, 'food').duration, 'ongoing');
});

test('이번 여행 철회는 평소 취향으로 돌아가고 평소 취향 철회는 다음 여행에도 되살아나지 않는다', () => {
  const baseline = declare(createPersonalization(), 'food', 'local', { duration: 'ongoing' });
  const overridden = declare(baseline, 'food', 'fine');
  const onceRemoved = removePreference(overridden, { field: 'food', duration: 'once', at: AT });
  assert.equal(recommend(onceRemoved).profile.food, 'local');
  assert.equal(entryOf(onceRemoved, 'food').eventId, entryOf(baseline, 'food').eventId);

  const baselineRemoved = removePreference(overridden, { field: 'food', duration: 'ongoing', at: AT });
  assert.equal(recommend(baselineRemoved).profile.food, 'fine', '현재 여행의 별도 선언은 보존한다');
  assert.deepEqual(summarizePersonalization(baselineRemoved, { at: AT }).baseline, []);
  const next = startNewTrip(baselineRemoved, { at: AT });
  assert.equal(entryOf(next, 'food'), undefined);
  assert.equal(recommend(next).profile.food, 'any');
  assert.deepEqual(recommend(next).engineAudit.declaredFields, []);
});

test('30일이 지난 조건은 호출·새 여행만으로 재확인된 것처럼 갱신되지 않는다', () => {
  const state = declare(createPersonalization(), 'hotelNoise', 0.2, { mode: 'require', duration: 'ongoing' });
  const snapshot = structuredClone(state);
  for (const current of [state, startNewTrip(state, { at: EXPIRED_AT })]) {
    const result = recommend(current, { at: EXPIRED_AT });
    const entry = entryOf(current, 'hotelNoise', EXPIRED_AT);
    const observation = result.engineAudit.observations.find(item => item.field === 'hotelNoise');
    assert.equal(entry.status, 'expired');
    assert.equal(entry.at, AT);
    assert.equal(observation.at, AT);
    assert.equal(observation.until, '2026-11-05T00:00:00.000Z');
    assert.deepEqual(result.engineAudit.declaredFields, []);
    assert.ok(!result.engineAudit.decisionReasons.some(reason => reason.field === 'hotelNoise'));
    assert.ok(!result.primary.fitDetails.some(detail => detail.field === 'hotelNoise'));
    assert.equal(result.engineAudit.understanding.fields.find(field => field.id === 'hotelNoise').usable, false);
  }
  assert.deepEqual(state, snapshot);
});

test('이번 여행의 아직 모름은 평소 취향을 가리며 과거 값을 추천에 다시 주입하지 않는다', () => {
  const baseline = declare(createPersonalization(), 'food', 'local', { duration: 'ongoing' });
  const masked = declare(baseline, 'food', 'any', { duration: 'once' });
  const result = recommend(masked);
  assert.equal(result.profile.food, 'any');
  assert.equal(entryOf(masked, 'food').value, 'any');
  assert.equal(entryOf(masked, 'food').mode, 'ignore');
  assert.equal(entryOf(masked, 'food').status, 'unknown');
  assert.ok(!result.engineAudit.declaredFields.includes('food'));
  assert.ok(!result.engineAudit.decisionReasons.some(reason => reason.field === 'food'));
  assert.ok(!result.primary.fitDetails.some(detail => detail.field === 'food'));
  assert.ok(!result.engineAudit.observations.some(observation => observation.field === 'food' && observation.value === 'local'));
  assert.equal(summarizePersonalization(masked, { at: AT }).baseline[0].value, 'local');
});

test('다른 사람·제품·맥락의 상태나 이벤트를 개인화 근거로 수용하지 않는다', () => {
  const state = declare(createPersonalization(), 'hotelNoise', 0.2);
  for (const key of ['personId', 'productId', 'contextId', 'domain']) {
    for (const target of ['state', 'event']) {
      const foreign = structuredClone(state);
      (target === 'state' ? foreign.scope : foreign.events[0].scope)[key] = 'foreign';
      assert.throws(() => recommend(foreign), TypeError, `${target}.${key}`);
    }
  }
});

test('총예산 같은 실행 조건은 선호 중요도로 완화하는 것처럼 기록하지 않는다', () => {
  const state=declare(createPersonalization(),'budget',130000,{mode:'prefer',importance:1});
  const entry=entryOf(state,'budget');
  assert.equal(entry.mode,'require');
  assert.equal(entry.importance,3);
  const result=recommend(state);
  assert.ok(result.primary.totalCost<=130000);
  assert.equal(result.primary.fitDetails.find(item=>item.field==='budget').mode,'require');
});

test('선택한 시작 시간은 개인화 설명과 내려받는 여행 메모에 시 단위로 표시한다', () => {
  for (const hour of [9, 11]) {
    const state = declare(createPersonalization(), 'dayStart', hour);
    const result = recommend(state);
    assert.equal(result.status, 'ready');
    assert.equal(entryOf(state, 'dayStart').labelValue, `${hour}시`);
    assert.equal(detailOf(result, 'dayStart').wanted, `${hour}시`);
    const memo = exportPlan(result.primary, result.profile);
    assert.ok(memo.includes(`- 시작 시간: ${hour}시 / 반영 / 이번 여행`));
    assert.ok(!memo.includes(`- 시작 시간: ${hour} /`));
  }
});

test('추가 질문의 가상 답변 평가가 실제 선언과 원본 상태를 변경하지 않는다', () => {
  const state = declare(createPersonalization(), 'hotelNoise', 0.2, { duration: 'ongoing' });
  const snapshot = structuredClone(state);
  const withoutQuestion = recommend(state);
  const withQuestion = recommend(state, { includeQuestion: true });
  assert.deepEqual(state, snapshot);
  assert.deepEqual(withQuestion.engineAudit.observations, withoutQuestion.engineAudit.observations);
  assert.deepEqual(withQuestion.engineAudit.declaredFields, ['hotelNoise']);
  assert.equal(withQuestion.primary.id, withoutQuestion.primary.id);
  assert.equal(withQuestion.primary.fitDetails.length, 1);
  assert.ok(withQuestion.engineAudit.questionRanking.length > 0);
  assert.ok(withQuestion.question);
  assert.ok(withQuestion.question.options.every(option => typeof option.preview === 'string'));
});
