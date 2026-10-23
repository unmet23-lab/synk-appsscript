'use strict';
// 싱크타운 밤 규칙과 화면 꼴(W3 통합 · 화면) — 10-23 「밤 첫 방문은 A로 하자. 깊은 밤엔 주민 장면 없이 자리 놓기·집 꾸미기·산책만.」
// 밤 규칙은 호스트가 sleeps를 켠 마을(계정 타운·미리 보기)에만 선다: 시험 저장소는 시계가 0 근처(CI는 UTC 자정)라 끈다.
// 화면은 서버 시계로 남은 조각을 보간하므로(§14-4), 뷰의 남은 조각·시작 자리만으로 서버의 전체 계획과 같은 자리가 나와야 한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
const at = (h, m = 0) => Date.UTC(2026, 9, 23, h - 9, m); // 2026-10-23 h:m KST
const MIN = 60_000;

async function fixture(start, options = {}) {
  const { createStore } = await townFile('server.mjs');
  let now = start, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'acct-night', ...options });
  const f = {
    store, read: () => store.read(), set(ms) { now = ms; },
    pulse(ms = 0, extra = {}) { now += ms; receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true, ...extra }).presence; return receipt; },
    boundary() { return store.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence }); },
    send(type, payload = {}) {
      return store.execute({ id: `night-${++sequence}`, type, expectedRevision: store.read().state.revision,
        payload: { ...(/^(DAY_|LIFE_|BAZAAR_|SUPPORT_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
    },
    go(location) { f.send('DAY_MOVE', { location }); if (f.read().state.day.home.exitTarget) f.send('DAY_EXIT'); },
    place() { f.send('CHOOSE', { branch: 'inside' }); f.send('NEXT'); f.send('PLACE', { slot: 'eaves-left' }); },
    ack() {
      const { state, view } = f.read();
      return f.send('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey, activity: state.activity,
        worldRevision: state.worldRevision, mode: 'static', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds });
    },
  };
  f.pulse();
  return f;
}
const play = (f, seconds, extra) => { for (let i = 0; i < seconds; i++) f.pulse(1000, extra); };

test('밤 규칙: 깊은 밤 찻집은 자리를 놓을 수 있고, 손님 이용은 주인이 일어나는 아침까지 시작하지 않는다(뷰는 실행 대신 아침 안내)', async () => {
  const f = await fixture(at(2), { sleeps: true });
  f.go('cafe'); f.place();
  play(f, 20);
  let { state, view } = f.read();
  assert.equal(state.placement, 'eaves-left', '자리 놓기는 밤에도 된다');
  assert.equal(state.pendingUse?.elapsedMs, 0, '손님 이용은 시작하지 않는다');
  assert.equal(view.execution, null);
  assert.match(view.line, /찻집 주인이 잠든 밤이에요\. 손님은 아침에 이 자리에 와요\./);
  assert.equal(view.day.scene.village.sleeps, true);
  assert.deepEqual(view.day.scene.village.hidden, ['cafe-owner'], '바쁜 찻집의 주인은 찻집 장면 몫');
  // 05:31 — 주인이 일어나 있으면 다음 방문에서 손님이 온다.
  f.set(at(5, 31)); f.pulse(); play(f, 30);
  ({ state, view } = f.read());
  assert.equal(state.pendingUse, null, '아침에는 이용이 끝까지 흐른다');
  assert.ok(view.plan && view.reaction, '손님의 반응 장면이 아침에 열린다');
  assert.doesNotMatch(view.line, /잠든 밤/);
});

test('밤 규칙: sleeps가 없는 마을(시험 저장소)은 시각과 상관없이 손님 이용·장면 시작이 그대로다', async () => {
  const f = await fixture(at(2));
  f.go('cafe'); f.place();
  play(f, 20);
  const { state, view } = f.read();
  assert.equal(state.pendingUse, null);
  assert.ok(view.plan, '반응 장면');
  assert.equal(view.day.scene.village.sleeps, undefined);
  assert.ok(view.day.actions.some(a => a.type === 'DAY_START'), '하루 장면 시작이 보인다');
  assert.ok(!/잠들었어요/.test(view.day.line));
});

test('밤 규칙: 주인이 잠들면 하루 장면·가판 시작이 보이지 않고, 경계 신호도 먼저 말을 걸지 않는다 — 그 전에 시작한 것은 그대로', async () => {
  for (const sleeps of [true, false]) {
    const f = await fixture(at(22), { sleeps });
    f.go('cafe'); f.place(); play(f, 20); f.ack();
    let { view } = f.read();
    assert.ok(view.bazaar.actions.some(a => a.type === 'BAZAAR_START'), '22시에는 가판을 열 수 있다');
    // 23:40 — 찻집 주인(23:30)은 잠들었고 연구원(01:00)은 아직 깨어 있다.
    f.set(at(23, 40)); f.pulse(); play(f, 50);
    ({ view } = f.read());
    const issued = f.boundary().issued;
    if (sleeps) {
      assert.deepEqual(view.bazaar.actions, []);
      assert.match(view.bazaar.line, /찻집 주인은 벌써 잠들었어요/);
      assert.ok(!view.day.actions.some(a => a.type === 'DAY_START' && a.payload.kind === 'tea'), '찻집 주인이 필요한 장면은 아침에');
      assert.match(view.day.line, /찻집 주인.*벌써 잠들었어요/);
      assert.equal(issued, null, '잠든 주인은 말을 걸지 않는다');
      assert.equal(view.life.canStart, false);
    } else {
      assert.ok(view.bazaar.actions.some(a => a.type === 'BAZAAR_START'), 'sleeps 없음: 그대로');
      assert.ok(issued, 'sleeps 없음: 경계 신호가 말을 건다');
    }
  }
});

test('W3 화면: 뷰의 남은 조각과 그 시작 자리만으로 placeAt이 서버의 전체 계획과 같은 자리를 낸다', async () => {
  const { planOf, placeAt } = await townFile('town/village.mjs');
  const f = await fixture(at(14, 20));
  f.go('greenhouse'); play(f, 5);
  const { state, view } = f.read(), v = view.day.scene.village;
  const full = planOf(state.village).segments;
  const bandStart = Object.fromEntries(Object.entries(state.village.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, spot]) => spot));
  assert.ok(v.segments.length < full.length, '이미 끝난 조각은 싣지 않는다');
  assert.ok(v.segments.every(s => s.endMs > v.nowMs));
  let walking = 0;
  for (let t = v.nowMs; t < v.band.endMs; t += 20_000) {
    for (const npc of ['cafe-owner', 'workshop-owner', 'researcher']) {
      const mine = placeAt(v.segments, npc, t, v.startSpots), server = placeAt(full, npc, t, bandStart);
      assert.deepEqual(mine, server, `${npc} @ ${(t - v.nowMs) / MIN}분`);
      if (mine?.walking) walking++;
    }
  }
  assert.ok(walking > 0, '걷는 순간도 견줬다');
});

test('W3 화면: 장면이 붙잡은 주민의 자리는 holds에 — 걸어오는 중이면 옛 화면의 npcs는 계획의 걸음을 그대로 둔다', async () => {
  const { placeAt } = await townFile('town/village.mjs');
  const f = await fixture(at(10));
  f.go('workshop'); f.send('DAY_START', { kind: 'help' });
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const v = f.read().view.day.scene.village, npc = f.read().view.day.scene.npcs.find(n => n.id === 'workshop-owner');
    const hold = v.holds['workshop-owner'], here = placeAt(v.segments, 'workshop-owner', v.nowMs, v.startSpots);
    assert.ok(hold && Number.isFinite(hold.x) && hold.pose, JSON.stringify(v.holds));
    const walkingIn = here?.walking && here.archetype === 'reserved';
    seen.add(walkingIn ? 'walking' : 'held');
    if (walkingIn) assert.deepEqual({ x: npc.x, z: npc.z }, { x: here.x, z: here.z }, '걸어오는 중: 계획의 걸음');
    else assert.deepEqual({ x: npc.x, z: npc.z, pose: npc.pose }, { x: hold.x, z: hold.z, pose: hold.pose }, '도착 뒤: 장면 자리');
    f.pulse(1000);
  }
  assert.ok(seen.has('held'), [...seen].join());
});
