'use strict';
// 싱크타운 계획기(세로 조각 설계 §4-2·§4-5·§6) — 구간마다 세 주민의 조각을 결정적으로 짠다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

const MINUTE = 60000, HOUR = 60 * MINUTE;
const TZ = 540;
/** 2026-10-22(목) 생활일의 시작 — 내 시각(한국) 05:00. */
const DAY = Date.UTC(2026, 9, 22, 5, 0) - TZ * MINUTE;
const LIFE_DAY = 20748;
const band = (id, from, to, extra = {}) => ({ villageSeed: 'plan-test', lifeDay: LIFE_DAY, band: id, startMs: DAY + from * HOUR, endMs: DAY + to * HOUR,
  dayStartMs: DAY, planCmdRev: 7, weatherTomorrow: 'clear', season: 'autumn', weatherAt: () => 'clear', ...extra });

async function dayPlan(lifeDay = LIFE_DAY, weatherAt = () => 'clear') {
  const { planBand } = await townModule('plan');
  const dayStart = DAY + (lifeDay - LIFE_DAY) * 24 * HOUR;
  let residents = {}, objects = { 'cafe-tray': { spot: 'cafe.prep' } };
  const all = [];
  for (const [id, from, to] of [['morning', 0, 6], ['day', 6, 12], ['evening', 12, 16], ['night', 16, 24]]) {
    const out = planBand({ ...band(id, from, to), lifeDay, startMs: dayStart + from * HOUR, endMs: dayStart + to * HOUR, dayStartMs: dayStart, weatherAt, residents, objects });
    residents = out.residents; objects = out.objects; all.push(...out.segments);
  }
  return all;
}
const awakeAt = (segments, ms) => [...new Set(segments.filter(s => s.startMs <= ms && ms < s.endMs).map(s => s.npc))].sort();

test('같은 입력이면 같은 계획, 명령 판이 바뀌면 다른 계획', async () => {
  const { planBand } = await townModule('plan');
  const a = planBand(band('day', 6, 12)), b = planBand(band('day', 6, 12));
  assert.deepEqual(a, b);
  assert.notDeepEqual(planBand(band('day', 6, 12, { planCmdRev: 8 })).segments, a.segments);
  for (const s of a.segments) {
    assert.ok(Number.isSafeInteger(s.startMs) && s.startMs < s.endMs && s.arriveMs <= s.endMs, JSON.stringify(s));
    assert.ok(s.startMs >= DAY + 6 * HOUR && s.endMs <= DAY + 12 * HOUR);
  }
});

test('기상·취침 덮임 — 만날 수 있는 시각에는 늘 둘 이상, 깊은 밤에는 잔다(§4-2)', async () => {
  const thursday = await dayPlan();
  const at = (hh, mm = 0) => DAY + ((hh - 5 + 24) % 24) * HOUR + mm * MINUTE;
  assert.deepEqual(awakeAt(thursday, at(5, 10)), ['workshop-owner']);
  assert.deepEqual(awakeAt(thursday, at(5, 40)), ['cafe-owner', 'workshop-owner']);
  assert.deepEqual(awakeAt(thursday, at(9)), ['cafe-owner', 'researcher', 'workshop-owner']);
  assert.deepEqual(awakeAt(thursday, at(22)), ['cafe-owner', 'researcher']);
  assert.deepEqual(awakeAt(thursday, at(23, 45)), ['researcher']);
  assert.deepEqual(awakeAt(thursday, at(2)), []);
  const sunday = await dayPlan(LIFE_DAY + 3);
  assert.deepEqual(awakeAt(sunday, DAY + 3 * 24 * HOUR + 4 * HOUR), ['cafe-owner', 'workshop-owner'], '일요일 연구원은 10시에 일어난다');
});

test('자리는 수용보다 많이 차지 않는다(이동 중에도 목적 자리를 잡는다)', async () => {
  const { SPOT_BY_ID } = await townModule('places');
  for (const day of [LIFE_DAY, LIFE_DAY + 4, LIFE_DAY + 6]) {
    const segments = await dayPlan(day);
    for (const s of segments) {
      const together = segments.filter(o => o.spot === s.spot && o.startMs <= s.startMs && s.startMs < o.endMs).length;
      assert.ok(together <= SPOT_BY_ID[s.spot].capacity, `${s.spot} ${together}명`);
    }
  }
});

test('비 오는 동안 바깥 자리에 있는 주민이 없고, 바깥 일은 처마·안쪽으로 옮긴다', async () => {
  const { SPOT_BY_ID } = await townModule('places');
  const wet = await dayPlan(LIFE_DAY, () => 'rain');
  assert.equal(wet.filter(s => !SPOT_BY_ID[s.spot].sheltered).length, 0);
  assert.ok(wet.some(s => s.cause === 'weather'), '비가 바꾼 조각이 있다');
  // 비가 구간 중간에 시작하면 바깥에 있던 조각은 그 순간 끝난다.
  const { planBand } = await townModule('plan');
  const rainFrom = DAY + 8 * HOUR;
  const out = planBand(band('day', 6, 12, { weatherAt: ms => (ms >= rainFrom ? 'rain' : 'clear') }));
  for (const s of out.segments) if (!SPOT_BY_ID[s.spot].sheltered) assert.ok(s.endMs <= rainFrom, `${s.npc} ${s.spot}`);
});

test('예약은 그 주민만 다시 짜고, 다른 주민의 조각은 그대로다', async () => {
  const { planBand } = await townModule('plan');
  const free = planBand(band('day', 6, 12));
  const from = DAY + 7 * HOUR, to = DAY + 7 * HOUR + 25 * MINUTE;
  const held = planBand(band('day', 6, 12, { reservations: [{ id: 'tea-order-1', npc: 'cafe-owner', fromMs: from, toMs: to, spot: 'cafe.counter' }] }));
  const others = out => out.segments.filter(s => s.npc !== 'cafe-owner');
  assert.deepEqual(others(held), others(free));
  const mine = held.segments.filter(s => s.npc === 'cafe-owner');
  assert.ok(mine.some(s => s.archetype === 'reserved' && s.startMs === from && s.endMs === to && s.spot === 'cafe.counter'));
  assert.ok(mine.every(s => s.endMs <= from || s.startMs >= to || s.archetype === 'reserved'), '예약 동안 다른 조각이 없다');
  const cut = s => ({ ...s, endMs: Math.min(s.endMs, from), arriveMs: Math.min(s.arriveMs, from) });
  assert.deepEqual(mine.filter(s => s.startMs < from), free.segments.filter(s => s.npc === 'cafe-owner' && s.startMs < from).map(cut), '예약 전 조각은 그대로(걸친 조각은 그 시각에서 끝난다)');
  const open = planBand(band('day', 6, 12, { reservations: [{ id: 'scene-1', npc: 'researcher', fromMs: from, toMs: null }] }));
  assert.equal(open.segments.filter(s => s.npc === 'researcher' && s.startMs >= from && s.archetype !== 'reserved').length, 0, '끝이 없는 예약은 구간 끝까지');
});

test('약속은 먼저 자리를 잡고, 비가 오면 처마로 옮기거나 다음 맑은 구간으로 미룬다(§4-5)', async () => {
  const { planBand } = await townModule('plan');
  const promises = [{ id: 'agree-1', npc: 'workshop-owner', archetype: 'quiet-rest', spot: 'cafe.garden' }];
  const clear = planBand(band('day', 6, 12, { promises }));
  const first = clear.segments.find(s => s.npc === 'workshop-owner');
  assert.deepEqual([first.archetype, first.spot, first.cause, first.promise], ['quiet-rest', 'cafe.garden', 'promise', 'agree-1']);
  const wet = planBand(band('day', 6, 12, { promises, weatherAt: () => 'rain' }));
  assert.equal(wet.segments.find(s => s.npc === 'workshop-owner').spot, 'cafe.eaves-left');
  const lane = planBand(band('day', 6, 12, { promises: [{ id: 'walk-1', npc: 'workshop-owner', archetype: 'stroll', spot: 'lane.mid' }], weatherAt: () => 'rain' }));
  assert.deepEqual(lane.deferredPromises.map(p => p.id), ['walk-1']);
});

test('습관 자리는 가중치 300 × 1.5로 일과에 들어간다(§6-5)', async () => {
  const { planBand } = await townModule('plan');
  const habits = { 'workshop-owner': [{ spot: 'cafe.garden-right', archetype: 'quiet-rest' }] };
  let used = 0;
  for (let rev = 0; rev < 12; rev++) {
    used += planBand(band('evening', 12, 16, { planCmdRev: rev, habits })).segments.filter(s => s.npc === 'workshop-owner' && s.spot === 'cafe.garden-right').length;
  }
  assert.ok(used >= 6, `습관 자리 이용 ${used}`);
});

test('합의 자리 → 자리 ID, 맡기기는 습관 후보가 아니다', async () => {
  const { agreementSpot } = await townModule('plan');
  assert.equal(agreementSpot({ choice: 'rest', target: { kind: 'seat', placement: 'garden' }, location: 'cafe' }), 'cafe.garden');
  assert.equal(agreementSpot({ choice: 'separate', target: { kind: 'base' }, location: 'greenhouse' }), 'greenhouse.bench');
  assert.equal(agreementSpot({ choice: 'silent', target: { kind: 'base' }, location: 'cafe' }), 'cafe.eaves-left');
  assert.equal(agreementSpot({ choice: 'delegate', target: { kind: 'base' }, location: 'cafe' }), null);
  assert.equal(agreementSpot(null), null);
});

test('바로 앞과 같은 일은 고르지 않는다(쉬기 빼고) — 같은 자리에서 이어지면 한 조각', async () => {
  const { ARCHETYPE_BY_ID } = await townModule('plan');
  const segments = await dayPlan(LIFE_DAY + 1);
  for (const npc of ['cafe-owner', 'workshop-owner', 'researcher']) {
    const mine = segments.filter(s => s.npc === npc);
    for (let i = 1; i < mine.length; i++) {
      const [a, b] = [mine[i - 1], mine[i]];
      if (a.endMs !== b.startMs || ARCHETYPE_BY_ID[b.archetype]?.kind === 'rest' || b.moved) continue;
      assert.ok(a.archetype !== b.archetype || a.spot === b.spot, `${npc} ${a.archetype}@${a.spot} → @${b.spot}`);
      assert.ok(!(a.archetype === b.archetype && a.spot === b.spot && a.cause === b.cause), '같은 자리에서 잇는 일은 합친다');
    }
  }
});

test('물건을 옮기는 원형은 물건 자리를 남긴다(§6-1)', async () => {
  const { planBand } = await townModule('plan');
  const out = planBand(band('day', 6, 12, { objects: { 'cafe-tray': { spot: 'cafe.prep' } } }));
  const lastTray = out.segments.filter(s => ['serve', 'prep-cups'].includes(s.archetype)).at(-1);
  assert.equal(out.objects['cafe-tray'].spot, lastTray.archetype === 'prep-cups' ? 'cafe.prep' : lastTray.spot);
});
