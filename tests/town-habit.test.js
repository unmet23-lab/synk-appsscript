'use strict';
// 싱크타운 습관(세로 조각 설계 §6-5, W3 통합) — 첫 하루 조율 합의가 첫 이용, 다음 날 낮 구간의 약속이 둘째
// 이용이 되어 습관이 선다. 이용은 사건(habit.used)으로 남고 Trail 사실이 아니다. 자리가 사라지면 습관도 빠진다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0); // 2026-10-23 12:00 KST
const MIN = 60_000, HOUR = 60 * MIN;

test('습관: 조율 합의 → 첫 이용 + 내일 낮 약속 → 다음 날 실제로 쉰 조각이 둘째 이용 → 습관(계획기 입력)', async () => {
  const { createStore } = await townFile('server.mjs');
  let now = NOON, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'acct-1' });
  const pulse = (ms = 0) => { now += ms; receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; };
  const send = (type, payload = {}) => store.execute({ id: `habit-${++sequence}`, type, expectedRevision: store.read().state.revision,
    payload: { ...(/^DAY_/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  const tick = ms => { for (let left = ms; left > 0; left -= 1000) pulse(Math.min(1000, left)); };
  pulse();
  send('DAY_MOVE', { location: 'greenhouse' }); if (store.read().state.day.home.exitTarget) send('DAY_EXIT');
  send('DAY_START', { kind: 'coordination' }); send('DAY_ROLE', { role: 'planner' }); send('DAY_CHOICE', { choice: 'silent' });
  tick(2000); send('DAY_CONTINUE'); send('DAY_CONFIRM'); tick(4000);
  send('DAY_CLOSE');
  let { state } = store.read();
  assert.ok(state.day.agreement, '합의가 섰다');
  const habit = state.village.habits['workshop-owner']?.find(h => h.spot === 'greenhouse.bench');
  assert.ok(habit && habit.uses.length === 1 && !habit.formed, JSON.stringify(state.village.habits));
  const promise = state.village.promises.find(p => p.npc === 'workshop-owner');
  assert.deepEqual({ spot: promise.spot, band: promise.band, archetype: promise.archetype }, { spot: 'greenhouse.bench', band: 'day', archetype: 'quiet-rest' });
  assert.equal(promise.lifeDay, state.village.band.lifeDay + 1);
  assert.ok(state.townEvents.some(e => e.kind === 'habit.used' && e.npc === 'workshop-owner'), '첫 이용은 사건');
  assert.ok(!state.events.some(e => e.factType === 'habit.used'), 'Trail 사실이 아니다');
  // 다음 날 낮 구간이 끝난 뒤(18:00): 약속대로 쉰 조각이 둘째 이용 → 습관.
  now = NOON + 30 * HOUR; pulse(); send('DAY_REST');
  state = store.read().state;
  const formed = state.village.habits['workshop-owner'].find(h => h.spot === 'greenhouse.bench');
  assert.equal(formed.uses.length, 2); assert.equal(formed.formed, true);
  assert.equal(state.village.promises.filter(p => p.npc === 'workshop-owner').length, 0, '지킨 약속은 지운다');
  assert.equal(state.townEvents.filter(e => e.kind === 'habit.used').length, 2);
});

test('습관: 자리가 사라지면 습관 항목이 빠지고, 이용 기록(사건)은 남는다 · 같은 구간은 한 번만 센다', async () => {
  const v = await townModule('village');
  const village = v.initialVillage();
  v.closeBands(village, { nowMs: NOON, seed: 'acct-1', offsetMin: 540, revision: 1 });
  assert.ok(v.recordUse(village, { npc: 'workshop-owner', spot: 'cafe.eaves-left', archetype: 'quiet-rest' }));
  assert.equal(v.recordUse(village, { npc: 'workshop-owner', spot: 'cafe.eaves-left', archetype: 'quiet-rest' }), null, '같은 구간 두 번째는 세지 않는다');
  v.keepHabitSpots(village, [{ spot: 'greenhouse.bench', npc: 'workshop-owner' }]);
  assert.equal(village.habits['workshop-owner'], undefined);
  assert.equal(v.validVillage(village), true);
});
