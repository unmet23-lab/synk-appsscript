'use strict';
// 싱크타운 피드백·덜 추천·오늘은 다른 일·관측 → 한 번 묻기(세로 조각 설계 §20-3, 시험 §20-10 town-prefs).
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

const adapted = { visitId: 'V-1', paramsVer: 'town-params-1', arm: 'adapted' }, baseline = { ...adapted, arm: 'baseline' };
const use = (n, family, direct = true) => ({ useId: `U-${n}`, canonicalActivityId: family === 'cafe-life' ? 'tea-order' : 'card.W1', storyFamily: family, direct });

test('피드백은 마지막 것 · 지난 응답은 쓰지 않음 · 지우기', async () => {
  const p = await townModule('prefs');
  const { paramsFor } = await townModule('params');
  let prefs = p.giveFeedback(p.initialPrefs(), { completionId: 'E-1', value: 'not_fit', canonicalActivityId: 'tea-order', lifeDay: 100 });
  prefs = p.giveFeedback(prefs, { completionId: 'E-1', value: 'helpful', canonicalActivityId: 'tea-order', lifeDay: 101 });
  assert.deepEqual(prefs.feedback.map(f => f.value), ['helpful']);
  const old = p.giveFeedback(p.initialPrefs(), { completionId: 'E-2', value: 'not_fit', canonicalActivityId: 'tea-order', lifeDay: 100 });
  const life = paramsFor().prefs.feedbackLifeDays;
  assert.equal(p.activeFeedback(old, 100 + life - 1).length, 1);
  assert.equal(p.activeFeedback(old, 100 + life).length, 0, '그 생활일 수가 지나면 쓰지 않는다');
  assert.deepEqual(p.removeFeedback(prefs, 'E-1').feedback, []);
  assert.throws(() => p.giveFeedback(p.initialPrefs(), { completionId: 'E-1', value: 'great', canonicalActivityId: 'x', lifeDay: 1 }));
});

test('「덜 추천」은 순위만 낮추고 두 회차 모두 지킨다 · 피드백 순위는 맞춤 회차에서만', async () => {
  const p = await townModule('prefs');
  const { paramsFor } = await townModule('params');
  const { prefs: knobs } = paramsFor();
  const less = p.setLessOften(p.initialPrefs(), 'card.C2', true);
  for (const policy of [adapted, baseline]) assert.equal(p.suggestionWeight(less, { activity: 'card.C2', lifeDay: 1, policy }).weight, knobs.lessOftenMultiplier);
  assert.deepEqual(p.setLessOften(less, 'card.C2', false).lessOften, [], '해제');
  const notFit = p.giveFeedback(p.initialPrefs(), { completionId: 'E-1', value: 'not_fit', canonicalActivityId: 'tea-order', lifeDay: 1 });
  assert.equal(p.suggestionWeight(notFit, { activity: 'tea-order', lifeDay: 2, policy: adapted }).weight, knobs.notFitMultiplier);
  assert.equal(p.suggestionWeight(notFit, { activity: 'tea-order', lifeDay: 2, policy: baseline }).weight, 1000, '기본 회차는 응답 순위를 끈다');
  const helpful = p.giveFeedback(p.initialPrefs(), { completionId: 'E-1', value: 'helpful', canonicalActivityId: 'tea-order', lifeDay: 1 });
  assert.equal(p.suggestionWeight(helpful, { activity: 'tea-order', lifeDay: 2, policy: adapted }).ahead, true);
});

test('「오늘은 다른 일」은 방문 하나 · 먼저 말 걸지 않기는 따로', async () => {
  const p = await townModule('prefs');
  const today = p.setTodayOther(p.initialPrefs(), 'V-1', 'tea-order');
  assert.equal(p.todayOther(today, 'V-1', 'tea-order'), true);
  assert.equal(p.todayOther(today, 'V-2', 'tea-order'), false, '다음 방문에는 다시 권한다');
  assert.deepEqual(p.setTodayOther(today, 'V-2', 'card.C1').todayOther, { visitId: 'V-2', items: ['card.C1'] });
  const optOut = p.setApproach(today, 'tea-order', true);
  assert.deepEqual([optOut.approachOptOut, optOut.lessOften], [['tea-order'], []], '셋을 섞지 않는다');
});

test('관측은 최근 직접 이용으로 세고, 묻기 한 번 뒤 「아니요」면 그 생활은 다시 묻지 않는다', async () => {
  const p = await townModule('prefs');
  const { paramsFor } = await townModule('params');
  const { observe } = paramsFor();
  let uses = [];
  for (let i = 0; i < observe.needed; i++) uses = p.recordUse(uses, use(i, 'cafe-life'));
  for (let i = observe.needed; i < observe.window; i++) uses = p.recordUse(uses, use(i, 'workshop-life'));
  assert.equal(p.observedFamily(uses, p.initialPrefs(), { policy: adapted }), 'cafe-life');
  assert.equal(p.observedFamily(uses, p.initialPrefs(), { policy: baseline }), null, '기본 회차는 관측하지 않는다');
  assert.equal(p.observedFamily(uses, p.initialPrefs(), { policy: adapted, firstFamily: 'cafe-life' }), null, '답이 순서를 안 바꾸면 묻지 않는다');
  const indirect = uses.map(u => ({ ...u, direct: false }));
  assert.equal(p.observedFamily(indirect, p.initialPrefs(), { policy: adapted }), null, '직접 연 이용만');
  const no = p.answerFamily(p.initialPrefs(), 'cafe-life', 'no');
  assert.equal(p.observedFamily(uses, no, { policy: adapted }), null, '「아니요」 뒤에는 시간이 지나도 묻지 않는다');
  const yes = p.answerFamily(p.initialPrefs(), 'cafe-life', 'yes');
  assert.equal(yes.preferredFamily, 'cafe-life');
  const corrected = p.correctObserved(uses, { ...p.initialPrefs(), observed: 'cafe-life' }, 'cafe-life');
  assert.equal(corrected.prefs.observed, null); assert.ok(corrected.uses.every(u => u.storyFamily !== 'cafe-life'), '「그때만 한 거예요」로 지운 이용은 관측에서 빠진다');
  assert.equal(p.recordUse(Array.from({ length: observe.recentUses }, (_, i) => use(100 + i, 'gather')), use(1, 'gather')).length, observe.recentUses);
});

test('마스코트 묻기는 생활일 하나에 한 번이고, 같은 질문은 정한 날 수 안에 다시 하지 않는다 · 우선순위', async () => {
  const p = await townModule('prefs');
  const { paramsFor } = await townModule('params');
  const { asks } = paramsFor();
  const ready = { lifeDay: 10, key: 'pref.cafe-life', secondsIntoVisit: asks.quietAfterVisitSeconds };
  assert.equal(p.mayAsk(p.initialAsks(), ready), true);
  assert.equal(p.mayAsk(p.initialAsks(), { ...ready, secondsIntoVisit: asks.quietAfterVisitSeconds - 1 }), false, '방문 첫 몇 초는 묻지 않는다');
  const asked = p.recordAsk(p.initialAsks(), ready);
  assert.equal(p.mayAsk(asked, { ...ready, key: 'consent.eval' }), false, '그날 이미 물었다');
  assert.equal(p.mayAsk(asked, { ...ready, lifeDay: 10 + asks.sameQuestionLifeDays - 1 }), false);
  assert.equal(p.mayAsk(asked, { ...ready, lifeDay: 10 + asks.sameQuestionLifeDays }), true);
  assert.equal(p.firstAsk(['consent', 'taste']), 'taste'); assert.equal(p.firstAsk(['consent', 'widen', 'taste']), 'widen');
});

test('「맞춤 기록 모두 비우기」는 관측·응답·이용을 비우고 본인 설정은 남긴다', async () => {
  const p = await townModule('prefs');
  let prefs = p.setLessOften(p.answerFamily(p.initialPrefs(), 'gather', 'yes'), 'card.C2', true);
  prefs = p.giveFeedback({ ...prefs, observed: 'cafe-life' }, { completionId: 'E-1', value: 'helpful', canonicalActivityId: 'tea-order', lifeDay: 1 });
  const cleared = p.clearPersonal({ prefs, uses: [use(1, 'cafe-life')] });
  assert.deepEqual([cleared.prefs.observed, cleared.prefs.feedback, cleared.uses], [null, [], []]);
  assert.deepEqual([cleared.prefs.preferredFamily, cleared.prefs.lessOften], ['gather', ['card.C2']]);
  assert.ok(p.validPrefs(cleared.prefs));
});
