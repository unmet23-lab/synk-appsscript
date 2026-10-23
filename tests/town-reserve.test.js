'use strict';
// 싱크타운 주민 예약(세로 조각 설계 §6-4·§14-4, W3 통합) — 장면이 주민을 붙잡고 놓는 것은 명령 시각,
// 방문 끝은 임대의 벽시계(visitEndAt) 하나, 구간 결과는 결산을 언제·몇 번 하든 같다(§15-3 결합 법칙).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0); // 2026-10-23 12:00 KST, 낮 구간
const MIN = 60_000;

async function fixture(start = NOON) {
  const { createStore } = await townFile('server.mjs');
  let now = start, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'acct-1' });
  const f = {
    store, read: () => store.read(), at: () => now, elapse(ms) { now += ms; },
    pulse(ms = 0) { now += ms; receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; return receipt; },
    send(type, payload = {}) {
      return store.execute({ id: `reserve-${++sequence}`, type, expectedRevision: store.read().state.revision,
        payload: { ...(/^(DAY_|LIFE_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
    },
    go(location) { f.send('DAY_MOVE', { location }); if (f.read().state.day.home.exitTarget) f.send('DAY_EXIT'); },
  };
  f.pulse();
  return f;
}

test('예약: 도움 장면을 연 명령이 공방 주인을 붙잡고(명령 시각), 닫은 명령이 놓는다 · 붙잡힌 동안 계획은 「reserved」 조각', async () => {
  const f = await fixture();
  f.go('workshop');
  const opened = f.at();
  f.send('DAY_START', { kind: 'help' });
  let v = f.read().state.village;
  assert.equal(v.reservations.length, 1);
  const r = v.reservations[0];
  assert.deepEqual({ npc: r.npc, fromMs: r.fromMs, toMs: r.toMs, spot: r.spot }, { npc: 'workshop-owner', fromMs: opened, toMs: null, spot: 'workshop.bench' });
  const held = f.read().view.day.scene.village.segments.find(s => s.npc === 'workshop-owner' && s.archetype === 'reserved');
  assert.ok(held && held.startMs === opened && held.arriveMs >= opened, JSON.stringify(held));
  f.pulse(2 * MIN);
  const closed = f.at();
  f.send('DAY_CLOSE');
  v = f.read().state.village;
  assert.equal(v.reservations[0].toMs, closed, '닫은 명령의 시각');
  // 같은 명령 흐름을 다시 보내지 않고 읽기만 해도 예약은 그대로다.
  f.pulse(1000); f.read(); f.read();
  assert.deepEqual(f.read().state.village.reservations, v.reservations);
});

test('예약: 받침 준비는 처음부터 끝이 정해진다(시작 + 30초) — 준비가 끝나 상태가 바뀌어도 예약 끝은 그대로', async () => {
  const f = await fixture();
  f.go('workshop');
  const started = f.at();
  f.send('DAY_JOB_START');
  const job = f.read().state.day.job, r = f.read().state.village.reservations.find(x => x.npc === 'workshop-owner');
  assert.equal(r.toMs, job.readyAt);
  assert.equal(job.readyAt, job.startedAt + 30_000, '준비 끝은 시작 + 30초');
  assert.ok(r.toMs >= started + 30_000 - 1);
  f.pulse(40_000); f.send('DAY_REST');
  assert.equal(f.read().state.day.job.status, 'ready', '40초 뒤 준비 완료(GPT 검수 GB2)');
  assert.equal(f.read().state.village.reservations.find(x => x.id === r.id).toMs, job.readyAt);
});

test('방문 끝: 결산은 맥박이 아직 못 잡은 방문 끝을 읽기만 하고, 맥박이 남긴 break에서 예약 끝·장면 닫기를 그 벽시계로 기록한다', async () => {
  const f = await fixture();
  f.go('workshop');
  f.send('DAY_START', { kind: 'help' });
  const lastPulse = f.at();
  f.pulse(0);
  const endAt = lastPulse + 3000 + 30 * MIN;
  f.elapse(45 * MIN);
  // 맥박 없이 읽기: 저장된 예약은 열린 채(기록 안 함), 장면도 그대로.
  let { state } = f.read();
  assert.equal(state.village.reservations[0].toMs, null);
  assert.equal(state.day.episode.open, true);
  // 돌아온 맥박이 방문 끝을 잡으면 다음 결산이 그 벽시계로 닫는다.
  f.pulse(0);
  f.send('DAY_REST');
  state = f.read().state;
  assert.equal(state.village.reservations[0].toMs, endAt, '방문 끝 = 마지막 창의 임대 끝 + 30분');
  assert.equal(state.day.episode.open, false, '방문 끝에서 장면이 닫힌다');
});

test('결합 법칙: 예약·방문 끝·습관 자리가 있는 마을을 여러 번 나눠 결산해도 한 번에 결산한 것과 같다', async () => {
  const { initialVillage, closeBands, holdResidents } = await townModule('village');
  const seed = 'acct-1', base = { seed, offsetMin: 540, candidates: [{ spot: 'cafe.eaves-left' }, { spot: 'greenhouse.bench', npc: 'workshop-owner' }] };
  const v0 = initialVillage();
  closeBands(v0, { ...base, nowMs: NOON, revision: 4 });
  holdResidents(v0, { 'cafe-owner': { by: 'DAY:1:tea', spot: 'cafe.counter' }, researcher: { by: 'DAY:1:tea', spot: 'cafe.front' } }, NOON + 5 * MIN, 5);
  const visitEnd = NOON + 45 * MIN, end = NOON + 30 * 60 * MIN;
  const once = structuredClone(v0), split = structuredClone(v0);
  const uses = { once: closeBands(once, { ...base, nowMs: end, revision: 5, visitEnd }), split: [] };
  for (const t of [NOON + 50 * MIN, NOON + 6 * 60 * MIN, NOON + 6 * 60 * MIN + 1, NOON + 19 * 60 * MIN, end])
    uses.split.push(...closeBands(split, { ...base, nowMs: t, revision: 5, visitEnd }));
  assert.deepEqual(split, once);
  assert.deepEqual(uses.split, uses.once);
  assert.equal(once.band.planCmdRev, 5, '결산 사이에 명령이 없으면 구간 판은 같은 revision');
});

test('계획기: 예약 뒤 재계획은 이미 시작한 약속을 다시 놓지 않는다(구간당 한 번)', async () => {
  const { planBand } = await townModule('plan');
  const { lifeDayStartAt } = await townModule('clock');
  const dayStart = lifeDayStartAt(540, NOON), start = dayStart + 6 * 60 * MIN;
  const input = { villageSeed: 'acct-1', lifeDay: 1, band: 'day', startMs: start, endMs: start + 6 * 60 * MIN, dayStartMs: dayStart, planCmdRev: 0,
    weatherAt: () => 'clear', weatherTomorrow: 'clear', season: 'autumn', residents: {}, objects: {},
    promises: [{ id: 'P-1', npc: 'workshop-owner', archetype: 'quiet-rest', spot: 'greenhouse.bench' }] };
  const kept = planBand(input).segments.filter(s => s.promise === 'P-1');
  assert.equal(kept.length, 1);
  const held = planBand({ ...input, reservations: [{ id: 'R-1', npc: 'workshop-owner', fromMs: kept[0].startMs + MIN, toMs: kept[0].startMs + 20 * MIN }] });
  assert.equal(held.segments.filter(s => s.promise === 'P-1').length, 1, JSON.stringify(held.segments.filter(s => s.npc === 'workshop-owner').map(s => s.archetype)));
});
