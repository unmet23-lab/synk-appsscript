import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CAMPAIGN, recommendedStage } from '../campaign.js';
import { racingItem, personalizedStage, RACING_CANDIDATES, FLOW_RACE, FLOW_WORDS, BASE_CRUISE, APPROACH, racePressure, describeRace } from '../personalization.js';

// 레이싱의 순간 맞춤: 달리는 속도와 맞춤 5문항의 문항 단계가 사람에 맞춰 움직이는지 실제 엔진으로 본다.
const require = createRequire(import.meta.url);
const { createGame } = require('../../../atlas/game-browser.js');
const setup = () => {
  let t = Date.parse('2026-10-03T09:00:00Z');
  const data = new Map();
  return createGame({ gameId: 'korean-racing', storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) },
    clock: () => new Date(t += 20000).toISOString() });
};
const open = coach => coach.live(FLOW_RACE, { words: FLOW_WORDS });
const levels = stage => stage.items.map(q => racingItem(q).difficulty);
const sum = list => list.reduce((a, b) => a + b, 0);
// One race as app.js runs it: present each gate through the live race, hear it, answer with the race's pressure.
function race(coach, stage, { correct = () => true, pressure = () => 0.2, flow = null } = {}) {
  const live = open(coach), start = live.settings().values, outs = [];
  for (const [i, q] of stage.items.entries()) {
    const pid = live.present(racingItem(q));
    coach.delivery(pid, { audio: 'completed' });
    outs.push(live.answer(pid, { correct: correct(i), assessable: true }, flow ?? { pressure: pressure(i) }));
  }
  return { start, end: live.end().settings.values, outs, changes: outs.filter(o => o.change).map(o => o.change) };
}
const plan = coach => personalizedStage(coach, { live: open(coach) }).stage;

test('처음 달리는 사람은 원래 레이싱 그대로(속도 26, 1단계 문항) 시작하고 첫 줄도 없다', () => {
  const live = open(setup());
  assert.deepEqual(live.settings().values, { 'item.difficulty': 1, cruise: BASE_CRUISE });
  assert.equal(FLOW_RACE.knobs[0].values[FLOW_RACE.knobs[0].start], BASE_CRUISE);
  assert.equal(live.intro().line, null);
  assert.deepEqual([1, 2, 3].map(l => RACING_CANDIDATES.some(c => c.difficulty === l)), [true, true, true], '세 단계 모두 고를 문항이 있다');
});

test('빨리 정확하게 고르면 속도가 한 칸씩 오르고, 다음 맞춤 5문항이 더 높은 단계에서 나온다', () => {
  const coach = setup();
  const races = [];
  for (let r = 0; r < 3; r++) races.push(race(coach, plan(coach)));
  const changes = races.flatMap(r => r.changes);
  assert.ok(changes.every(c => Math.abs(c.to - c.from) === 1), '한 번에 한 칸');
  assert.ok(races.every(r => r.changes.length <= r.outs.length), '응답 하나에 많아야 한 번');
  assert.ok(races[2].end.cruise > BASE_CRUISE && races[2].end['item.difficulty'] > 1);
  const paceLines = races.flatMap(r => r.outs).filter(o => o.change?.knob === 'cruise').map(o => o.line?.text);
  assert.ok(paceLines.length && paceLines.every(text => text === FLOW_WORDS['raise.pace']));
  // 문항 단계가 바뀐 것은 판 안에서 말하지 않는다(결과 화면에서 다음 맞춤 5문항으로 알린다).
  assert.ok(races.flatMap(r => r.outs).filter(o => o.change?.knob === 'item.difficulty').every(o => o.line === null));
  // 같은 기록에서 Core만 고른 5문항보다 높은 단계를 고른다(Core가 앞세운 후보 안에서만).
  const adapted = levels(plan(coach)), core = levels(personalizedStage(coach).stage);
  assert.ok(sum(adapted) > sum(core), `맞춤 ${adapted} > 순간 맞춤 없이 ${core}`);
});

test('오래 걸려 고르면 속도만 느긋해지고, 틀리면 문항 단계가 내려간다', () => {
  const slow = setup();
  const eased = race(slow, plan(slow), { pressure: () => 0.95 });
  assert.ok(eased.end.cruise < BASE_CRUISE, '느긋해진다');
  assert.equal(eased.end['item.difficulty'], 1, '맞힌 답은 문항을 쉽게 하지 않는다');
  assert.ok(eased.outs.filter(o => o.change).every(o => o.change.knob === 'cruise' && o.line?.text === FLOW_WORDS['ease.pace']));

  const climber = setup();
  for (let r = 0; r < 3; r++) race(climber, plan(climber));
  const before = open(climber).settings().values['item.difficulty'];
  const missed = race(climber, plan(climber), { correct: () => false, pressure: () => 0.6 });
  assert.ok(missed.end['item.difficulty'] < before, `틀리면 ${before} → ${missed.end['item.difficulty']}`);
  assert.ok(missed.changes.every(c => c.direction < 0), '틀린 판에서는 아무것도 오르지 않는다');
});

test('의도와 다른 길로 들어간 답(조작)은 속도도 단계도 바꾸지 않는다', () => {
  const coach = setup();
  const voided = race(coach, plan(coach), { flow: { outcome: 'void' } });
  assert.equal(voided.changes.length, 0);
  assert.deepEqual(voided.end, voided.start);
});

test('피곤한 날은 처음부터 느긋하게, 판 안에서는 빨라지지도 어려워지지도 않는다', () => {
  const coach = setup();
  coach.setToday('tired');
  const intro = open(coach).intro();
  assert.equal(intro.line?.text, FLOW_WORDS['start.tired']);
  const tired = race(coach, plan(coach));
  assert.ok(tired.start.cruise <= BASE_CRUISE);
  assert.ok(tired.changes.every(c => c.direction < 0), '오르는 변화가 없다');
  assert.ok(tired.end.cruise <= tired.start.cruise && tired.end['item.difficulty'] <= tired.start['item.difficulty']);
});

test('교사 목표가 있으면 문항은 Core가 고른 그대로 두고 순간 맞춤 단계로 바꾸지 않는다', () => {
  const coach = setup();
  const pool = RACING_CANDIDATES.filter(c => c.skillIds[0] === 'ko.listening.detail' && c.difficulty === 2);
  const target = { skillId: 'ko.listening.detail', difficulty: 2, modality: 'listening', responseFormat: 'single-choice', familyKeys: pool.map(c => c.itemKey), requiredAttempts: 3 };
  const hosted = { ...coach, assignment: () => target };
  const refuses = { pick() { throw new Error('교사 목표에서는 순간 맞춤이 문항을 고르지 않는다'); } };
  const withLive = personalizedStage(hosted, { live: refuses }), without = personalizedStage(hosted);
  assert.deepEqual(withLive.stage.items.map(q => q.id), without.stage.items.map(q => q.id));
  assert.ok(withLive.stage.items.every(q => racingItem(q).difficulty === 2));
});

test('고르는 데 쓴 시간: 문장 코스는 설계한 접근 시간, 낱말 코스는 남은 길 기준이고 1에 닿지 않는다', () => {
  assert.ok(Math.abs(racePressure({ readyAt: 10, choseAt: 10 + APPROACH / BASE_CRUISE / 2, cruise: BASE_CRUISE, campaign: true }) - 0.5) < 1e-9);
  assert.equal(racePressure({ readyAt: 10, choseAt: 9, cruise: BASE_CRUISE, campaign: true }), 0, '음성이 끝나기 전에 고르면 0');
  assert.equal(racePressure({ readyAt: 10, choseAt: 60, cruise: BASE_CRUISE, campaign: true }), 0.95, '차가 멈춰 기다린 답도 늦은 답이 아니다');
  assert.equal(racePressure({ readyAt: 10, choseAt: 11.5, cruise: 26, campaign: false, roadLeft: 65 }), 0.6);
  assert.ok(racePressure({ readyAt: 10, choseAt: 12, cruise: 32, campaign: true }) > racePressure({ readyAt: 10, choseAt: 12, cruise: 20, campaign: true }), '빠를수록 같은 시간이 더 빠듯하다');
  assert.equal(racePressure({ readyAt: null, choseAt: 3, cruise: 26, campaign: true }), null);
  assert.equal(racePressure({ readyAt: 3, choseAt: undefined, cruise: 26, campaign: true }), null);
});

test('결과 화면은 바뀐 설정만 말한다', () => {
  assert.deepEqual(describeRace({ 'item.difficulty': 1, cruise: 26 }, { 'item.difficulty': 1, cruise: 26 }), []);
  assert.deepEqual(describeRace({ 'item.difficulty': 1, cruise: 26 }, { 'item.difficulty': 2, cruise: 29 }),
    ['달리는 속도 94 → 104km/h', '다음 맞춤 5문항은 조금 더 어려운 문장도 골라요']);
  assert.deepEqual(describeRace({ 'item.difficulty': 3, cruise: 29 }, { 'item.difficulty': 2, cruise: 26 }),
    ['달리는 속도 104 → 94km/h', '다음 맞춤 5문항은 조금 더 쉬운 문장부터 골라요']);
  assert.deepEqual(describeRace(null, { cruise: 29 }), []);
});

test('모든 코스를 통과한 뒤의 추천은 마지막 코스가 아니라 가장 덜 익숙한 코스다', () => {
  const stages = Object.fromEntries(CAMPAIGN.map(s => [s.id, { plays: 2, bestScore: 5, cleared: true }]));
  stages[CAMPAIGN[4].id] = { plays: 3, bestScore: 4, cleared: true };
  stages[CAMPAIGN[7].id] = { plays: 1, bestScore: 4, cleared: true };
  assert.equal(recommendedStage({ stages }).id, CAMPAIGN[7].id, '점수가 낮고 덜 달린 코스');
  const even = Object.fromEntries(CAMPAIGN.map(s => [s.id, { plays: 2, bestScore: 5, cleared: true }]));
  even[CAMPAIGN.at(-1).id] = { plays: 3, bestScore: 5, cleared: true };
  assert.notEqual(recommendedStage({ stages: even }).id, CAMPAIGN.at(-1).id);
  assert.equal(recommendedStage({ stages: { [CAMPAIGN[0].id]: { plays: 1, bestScore: 5, cleared: true } } }).id, CAMPAIGN[1].id, '아직 남은 코스가 있으면 그 코스');
});
