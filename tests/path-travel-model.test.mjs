import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, PRESETS, buildRecommendations, normalizeProfile } from '../experiences/path-travel/model.mjs';
import { CANDIDATES } from '../experiences/path-travel/catalog.mjs';
import { STORAGE_KEY, loadSavedTrip, saveTrip, clearSavedTrip, exportPlan } from '../experiences/path-travel/storage.mjs';
import { createPersonalization, setPreference, DETAIL_FIELDS } from '../experiences/path-travel/profile.mjs';

const build = (profile, options = {}) => buildRecommendations(profile, { includeQuestion: false, ...options });

test('같은 예산에서 숙면과 미식의 우선순위가 실제 숙소·식사를 바꾼다', () => {
  const food = build(PRESETS[0].profile).primary;
  const rest = build(PRESETS[1].profile).primary;
  assert.equal(food.budgetLimit, rest.budgetLimit);
  assert.notEqual(food.hotel.id, rest.hotel.id);
  assert.ok(rest.hotel.cost > food.hotel.cost);
  assert.notEqual(food.stops.find(stop => stop.kind === 'dinner').id, rest.stops.find(stop => stop.kind === 'dinner').id);
  assert.ok(food.budget.find(row => row.id === 'food').amount > rest.budget.find(row => row.id === 'food').amount);
});

test('네 시연과 대안은 예산·영업시간·하루 끝·도보 한도를 지키고 누락 없이 합산한다', () => {
  for (const { profile } of PRESETS) {
    const result = build(profile);
    assert.equal(result.status, 'ready');
    for (const plan of [result.primary, ...result.alternatives]) {
      assert.ok(plan.totalCost <= profile.budget);
      assert.equal(plan.totalCost, plan.budget.reduce((sum, row) => sum + row.amount, 0));
      assert.equal(plan.totalCost, plan.stops.reduce((sum, row) => sum + row.cost, 0));
      assert.ok(plan.walkingMinutes <= (profile.pace === 'easy' ? 70 : 180));
      assert.ok(plan.stops.at(-1).end <= (profile.pace === 'easy' ? 1380 : 1500));
      let lastEnd = profile.dayStart * 60;
      for (const stop of plan.stops) {
        assert.ok(stop.start >= lastEnd);
        assert.equal(stop.duration, stop.end - stop.start);
        lastEnd = stop.end;
        const candidate = CANDIDATES.find(candidate => candidate.id === stop.id);
        if (candidate) assert.ok(candidate.openWindows.some(window => window.start <= stop.start && stop.end <= window.end));
      }
      for (let index = 1; index < plan.stops.length; index++) {
        const previous = plan.stops[index - 1], current = plan.stops[index];
        if (current.kind === 'rest' && previous.kind === 'transfer') assert.equal(current.area, previous.area.split(' → ').at(-1));
      }
    }
  }
});

test('예산 부족과 숙소 고정 충돌은 가짜 결과나 조용한 숙소 교체를 만들지 않는다', () => {
  const hotel = build(PRESETS[1].profile).primary.hotel;
  const changed = build({ ...DEFAULT_PROFILE, food: 'local' }, { lockedHotelId: hotel.id });
  assert.equal(changed.primary.hotel.id, hotel.id);
  for (const plan of changed.alternatives) assert.equal(plan.hotel.id, hotel.id);
  const failed = build({ ...DEFAULT_PROFILE, budget: 100000 }, { lockedHotelId: hotel.id });
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.primary, null);
  assert.equal(failed.alternatives.length, 0);
  assert.match(failed.diagnostics.issues.join(' '), /잠근 숙소/);
  assert.equal(build({ ...DEFAULT_PROFILE, budget: 30000 }).status, 'unavailable');
});

test('비 오는 날 활동과 음주 제외는 모든 제공 대안에도 적용한다', () => {
  const result = build({ ...PRESETS[2].profile, rain: true, alcohol: false });
  for (const plan of [result.primary, ...result.alternatives]) {
    for (const stop of plan.stops) {
      const candidate = CANDIDATES.find(candidate => candidate.id === stop.id);
      if (!candidate) continue;
      assert.equal(candidate.requiresAlcohol, false);
      if (candidate.type === 'activity') assert.equal(candidate.indoor, true);
    }
  }
  assert.match(result.primary.tradeoffs.join(' '), /원한 밤 활동/);
});

test('밤 쉬기와 클럽은 다른 일정이며 다음날 시각을 숨기지 않는다', () => {
  const quiet = build({ ...PRESETS[2].profile, night: 'none' }).primary;
  const club = build(PRESETS[2].profile).primary;
  assert.equal(quiet.stops.some(stop => stop.kind === 'night'), false);
  assert.equal(CANDIDATES.find(candidate => candidate.id === club.stops.find(stop => stop.kind === 'night').id).nightStyle, 'club');
  assert.ok(club.stops.at(-1).end > quiet.stops.at(-1).end);
});

test('다음 질문은 미정 항목 중 하나이며 답에 따라 실제 추천이 바뀐다', () => {
  const result = buildRecommendations(DEFAULT_PROFILE);
  assert.ok(result.question);
  assert.ok(DEFAULT_PROFILE[result.question.about] === 'any' || DETAIL_FIELDS.some(field => field.id === result.question.about));
  const alternatives = result.question.options.map(option => build(DEFAULT_PROFILE, { personalization: setPreference(createPersonalization(), { field: result.question.about, value: option.value }) }).primary?.id);
  assert.ok(new Set([result.primary.id, ...alternatives]).size > 1);
  const confirmed = buildRecommendations({ ...DEFAULT_PROFILE, food: 'local', hotel: 'quiet', night: 'none' });
  assert.ok(confirmed.question === null || DETAIL_FIELDS.some(field => field.id === confirmed.question.about));
});

test('변경 이유는 이전 계획과 비교하고 입력과 이전 계획을 바꾸지 않는다', () => {
  const profile = { ...DEFAULT_PROFILE };
  const prior = build(profile).primary;
  const original = JSON.stringify(prior);
  const changed = build(PRESETS[2].profile, { previousPlan: prior });
  assert.ok(changed.primary.changes.some(change => /밤:/.test(change)));
  assert.equal(JSON.stringify(prior), original);
  assert.deepEqual(profile, DEFAULT_PROFILE);
});

test('음주 제외 후에도 술 없는 조용한 찻집을 고르는 질문은 남는다', () => {
  const result = buildRecommendations({ ...DEFAULT_PROFILE, food: 'local', hotel: 'central', alcohol: false });
  if (result.question?.about === 'night') {
    assert.ok(result.question.options.some(option => option.value === 'quiet'));
    assert.equal(result.question.options.some(option => option.value === 'club'), false);
  }
  const quiet = build({ ...DEFAULT_PROFILE, food: 'local', hotel: 'central', alcohol: false }, { personalization: setPreference(createPersonalization(), { field: 'night', value: 'quiet', mode: 'require' }) });
  assert.ok(quiet.primary.stops.some(stop => stop.kind === 'night' && CANDIDATES.find(candidate => candidate.id === stop.id)?.requiresAlcohol === false));
});

test('입력값을 검증하고 정체성·재산 추정을 프로필에 끼워 넣지 않는다', () => {
  for (const budget of [NaN, Infinity, -1, 29999, 1000001, 123456.7, '250000']) assert.throws(() => normalizeProfile({ budget }));
  assert.throws(() => normalizeProfile({ age: 30 }));
  assert.throws(() => normalizeProfile({ wealth: 'rich' }));
  assert.throws(() => normalizeProfile({ night: '<script>' }));
  assert.throws(() => build(DEFAULT_PROFILE, { lockedHotelId: '<script>' }));
});

function fakeStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}

test('저장은 명시 호출 때만 남고 철회·삭제하면 복원되지 않는다', () => {
  const storage = fakeStorage();
  assert.equal(loadSavedTrip(storage), null);
  saveTrip({ profile: PRESETS[0].profile, lockedHotelId: null }, storage);
  assert.deepEqual(loadSavedTrip(storage).profile, PRESETS[0].profile);
  clearSavedTrip(storage);
  assert.equal(loadSavedTrip(storage), null);
  storage.setItem(STORAGE_KEY, '{broken');
  assert.throws(() => loadSavedTrip(storage), /읽을 수 없어요/);
});

test('가져갈 계획에도 가상 자료와 비용 포함 범위를 보존한다', () => {
  const plan = build(DEFAULT_PROFILE).primary;
  const exported = exportPlan(plan, DEFAULT_PROFILE);
  assert.match(exported, /실제 예약·길안내용이 아닙니다/);
  assert.match(exported, /서울 도착\/출발 교통/);
  assert.ok(exported.includes(plan.hotel.name));
  assert.ok(exported.includes('117,300원'));
});
