// 지도가 자라도 재확인이 이어진다(Temper temper-followup-2부터 · 2026-11-08, docs/_ops/qa/atlas-world-engine-20261108/설계.md §3 A).
// 무관한 Strata 마디를 더해 지도판이 바뀌면 그 전에 잡힌 1·7·30일 재확인이 소비에서 사라지고 짝도 못 맺던 결함의 회귀다.
// 짝 열쇠는 게임 · 능력 · 난도 · 응답 꼴 · 영역 · 소리이고, 지도판은 재현용으로 기록에만 남는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { delayedSupplemental } from '../experiences/korean-rhythm/supplemental-player.mjs';
import { supplementalItems } from '../experiences/korean-rhythm/supplemental.mjs';
import { BASE_ORDERS, ADDITIONAL_ORDERS } from '../experiences/order-rush/core.mjs';
import { orderMetadata, delayedOrders } from '../experiences/order-rush/learning.mjs';
import { followupRows } from '../experiences/synk-world-app/world-learning-followups.mjs';
const require = createRequire(import.meta.url);
const { createMap } = require('../strata');
const { createGame } = require('../atlas/game-learning.js');
const Temper = require('../atlas/temper.js');

const TOPIK_I = require('../strata/maps/topik-i.json');
const copy = value => JSON.parse(JSON.stringify(value));
// 앱이 새 판으로 바뀌어 지도에 무관한 문법 마디가 하나 늘었다(지도판 문자열도 바뀐다).
function grown(data, suffix = 'grown') {
  const next = copy(data), node = next.nodes.find(n => n.kind === 'grammar_point');
  next.nodes.push({ ...copy(node), id: `${node.id}-${suffix}`, label_ko: `${node.label_ko}(${suffix})` });
  next.map_ver = `${data.map_ver}-${suffix}`;
  return next;
}
function bench(gameId) {
  let t = Date.parse('2026-11-08T03:00:00Z');
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  // 같은 기기 장부(storage · learnerKey)를 여러 게임이 함께 쓴다 — on(지도, 다른 게임)으로 둘째 게임을 세운다.
  return { on: (data, id = gameId) => createGame({ gameId: id, map: createMap(data), storage, clock: () => new Date(t += 1000).toISOString(), followups: true }),
    wait: days => { t += days * 86400000; } };
}

test('Temper names the changed pairing contract', () => {
  assert.equal(Temper.FOLLOWUP.version, 'temper-followup-3');
});

test('rhythm: a grown map keeps the due follow-up offered and pairs the new item', () => {
  const b = bench('korean-rhythm');
  let coach = b.on(TOPIK_I);
  const first = supplementalItems().find(i => i.skillId === 'ko.listening.detail' && i.difficulty === 1);
  const id = coach.present(first); coach.delivery(id, { audio: 'completed' }); coach.answer(id, { correct: true, assessable: true });
  b.wait(2);
  assert.equal(delayedSupplemental(coach).length, 2, 'same map edition');
  coach = b.on(grown(TOPIK_I));
  assert.notEqual(coach.mapVersion, TOPIK_I.map_ver);
  const row = coach.followups().items.find(r => r.gameId === 'korean-rhythm' && r.window === 'd1');
  assert.equal(row.status, 'due'); assert.equal(row.current, true);
  assert.equal(row.measure.taskVersion, TOPIK_I.map_ver, 'the recorded edition stays for reproduction');
  const offered = delayedSupplemental(coach);
  assert.equal(offered.length, 2, 'a grown map must not hide the due follow-up');
  const pid = coach.present(offered[0]); coach.delivery(pid, { audio: 'completed' }); coach.answer(pid, { correct: true, assessable: true });
  const observed = () => coach.followups().items.find(r => r.gameId === 'korean-rhythm' && r.window === 'd1');
  assert.deepEqual([observed().status, observed().outcome], ['observed', 'independent-correct']);
  b.wait(3);
  assert.deepEqual([observed().status, observed().outcome], ['observed', 'independent-correct'], 'another edition later does not undo the pair');
  coach = b.on(grown(grown(TOPIK_I), 'again'));
  assert.deepEqual([observed().status, observed().outcome], ['observed', 'independent-correct']);
});

test('order rush: a grown map keeps the cup follow-up and the pair', () => {
  const b = bench('order-rush');
  let coach = b.on(TOPIK_I);
  const id = coach.present(orderMetadata(BASE_ORDERS[0])); coach.delivery(id, { audio: 'completed' }); coach.answer(id, { correct: true, assessable: true });
  const pool = ADDITIONAL_ORDERS.filter(o => o.role === 'delayed');
  b.wait(2);
  const before = delayedOrders(coach, pool).map(o => o.id);
  assert.ok(before.length > 0);
  coach = b.on(grown(TOPIK_I));
  assert.deepEqual(delayedOrders(coach, pool).map(o => o.id), before);
});

test('an ability gone from the map, or now of another modality, is not offered', () => {
  const b = bench('korean-rhythm');
  let coach = b.on(TOPIK_I);
  const first = supplementalItems().find(i => i.skillId === 'ko.listening.detail' && i.difficulty === 1);
  const id = coach.present(first); coach.delivery(id, { audio: 'completed' }); coach.answer(id, { correct: true, assessable: true });
  b.wait(2);
  const moved = copy(TOPIK_I); moved.nodes.find(n => n.id === 'ko.listening.detail').domain = 'reading'; moved.map_ver += '-moved';
  coach = b.on(moved);
  const row = coach.followups().items.find(r => r.gameId === 'korean-rhythm' && r.window === 'd1');
  assert.equal(row.current, false);
  assert.deepEqual(delayedSupplemental(coach), []);
  // 소비가 Core의 표시를 따른다: current가 거짓이면 같은 지도판이어도 내지 않는다.
  coach = b.on(TOPIK_I);
  const hidden = { ...coach, followups: () => { const r = coach.followups(); return { ...r, items: r.items.map(x => ({ ...x, current: false })) }; } };
  assert.deepEqual(delayedSupplemental(hidden), []);
});

test('the shared ledger of two games keeps each game in its own cell', () => {
  const b = bench('korean-rhythm');
  const rhythm = b.on(TOPIK_I);
  const pool = supplementalItems().filter(i => i.skillId === 'ko.listening.detail' && i.difficulty === 1);
  const [first] = pool, others = pool.filter(i => i.familyKey !== first.familyKey && i.itemKey !== first.itemKey);
  assert.ok(others.length >= 2, 'two fresh items of the same cell');
  const id = rhythm.present(first); rhythm.delivery(id, { audio: 'completed' }); rhythm.answer(id, { correct: true, assessable: true });
  b.wait(2);
  const d1 = coach => coach.followups().items.find(r => r.gameId === 'korean-rhythm' && r.window === 'd1');
  // 지도가 자란 뒤 같은 장부의 다른 게임이 같은 능력 칸(능력 · 난도 · 꼴 · 영역 · 소리)의 새 문항을 풀어도 리듬의 짝이 아니다.
  const racing = b.on(grown(TOPIK_I), 'korean-racing');
  const pid = racing.present(others[0]); racing.delivery(pid, { audio: 'completed' }); racing.answer(pid, { correct: true, assessable: true });
  assert.equal(d1(racing).status, 'due', 'another game’s answer does not observe the rhythm follow-up');
  assert.ok(racing.followups().items.some(r => r.gameId === 'korean-racing'), 'the racing answer is its own anchor');
  // 대조: 같은 칸을 리듬이 풀면 짝이 맺어진다 — 갈린 것은 게임 하나뿐이다.
  const again = b.on(grown(TOPIK_I));
  const rid = again.present(others[1]); again.delivery(rid, { audio: 'completed' }); again.answer(rid, { correct: true, assessable: true });
  assert.deepEqual([d1(again).status, d1(again).outcome], ['observed', 'independent-correct']);
});

test('WORLD projection follows the current flag and keeps the old comparison for older engine copies', () => {
  const measure = { skillId: 'ko.reading.detail', difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false, taskVersion: 'v1' };
  const item = { id: 'fresh', itemKey: 'fresh', familyKey: 'fresh', skillId: 'ko.reading.detail', difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false };
  const project = extra => ({ evidenceComplete: true, coverage: {}, items: [{ id: 'r:d1', gameId: 'world-practice', status: 'due', window: 'd1', measure, ...extra }] });
  const run = (extra, taskVersion) => followupRows({ projection: project(extra), pool: [item], seen: () => false, taskVersion }).rows[0].available;
  assert.equal(run({ current: true }, 'v2'), true, 'a grown WORLD map keeps it');
  assert.equal(run({ current: false }, 'v1'), false, 'the engine said the ability is gone');
  assert.equal(run({}, 'v1'), true, 'older engine copy: same edition');
  assert.equal(run({}, 'v2'), false, 'older engine copy: other edition');
});

test('Core recheck compares the ability cell, not the map edition', () => {
  const b = bench('world-practice');
  const coach = b.on(TOPIK_I);
  const source = { id: 'source', itemKey: 'source.v1', familyKey: 'source', skillId: 'ko.reading.detail', difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false };
  const a = coach.answer(coach.present(source), { correct: false, assessable: true });
  const later = b.on(grown(TOPIK_I));
  const target = { ...source, id: 'target', itemKey: 'target.v1', familyKey: 'target' };
  const t = later.answer(later.present(target), { correct: true, assessable: true });
  const result = later.recheck(a.eventId, t.eventId);
  assert.notEqual(result.reason, 'different-measurement');
  assert.equal(result.status, 'independent-correct');
});
