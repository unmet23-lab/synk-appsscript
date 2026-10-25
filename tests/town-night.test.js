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

// ── 검수 반영(10-23 W3 엔진 검수) ──────────────────────────────────────────
test('밤 규칙: 명령도 뷰와 같다 — sleeps면 잠든 주민이 필요한 장면 시작을 409로 거절하고, sleeps 없으면 그대로 연다', async () => {
  for (const sleeps of [true, false]) {
    const f = await fixture(at(2), { sleeps });
    f.go('workshop');
    const asleep = error => error.code === 'resident-asleep' && /공방 주인은 지금 자고 있어요/.test(error.message);
    if (sleeps) {
      assert.throws(() => f.send('DAY_JOB_START'), asleep);
      assert.throws(() => f.send('DAY_START', { kind: 'help' }), asleep);
      f.go('cafe');
      assert.throws(() => f.send('LIFE_OPEN', { source: 'direct' }), error => error.code === 'resident-asleep');
      assert.throws(() => f.send('BAZAAR_START', { kind: 'requests' }), error => error.code === 'resident-asleep');
      assert.equal(f.read().state.day.job, null, '거절한 명령은 아무것도 남기지 않는다');
    } else {
      f.send('DAY_JOB_START');
      assert.equal(f.read().state.day.job.status, 'preparing', 'sleeps 없음: 시각과 상관없이 연다');
      f.go('cafe');
      assert.throws(() => f.send('LIFE_OPEN', { source: 'direct' }), error => error.code !== 'resident-asleep');
    }
  }
});

test('계획기: 열고 닫은 시각이 같은(길이 0) 예약은 구간을 자르거나 다시 짜지 않는다', async () => {
  const { planBand } = await townFile('town/plan.mjs');
  const { bandInput } = await townFile('town/village.mjs');
  const f = await fixture(at(14));
  const v = f.read().state.village, input = bandInput(v);
  const mid = Math.floor((v.band.startMs + v.band.endMs) / 2);
  const plain = planBand(input), zero = planBand({ ...input, reservations: [{ id: 'R-zero', npc: 'cafe-owner', fromMs: mid, toMs: mid, spot: 'cafe.counter' }] });
  assert.deepEqual(zero.segments, plain.segments);
  assert.ok(plain.segments.every(s => s.startMs <= s.endMs));
});

test('구간만 옮긴 읽기: 쓰지 않아도 그 구간을 닫으며 생긴 마을 사건은 답에 보이고, 다음 쓰기가 같은 사건을 저장한다', async () => {
  const f = await fixture(at(12));
  f.go('greenhouse');
  f.send('DAY_START', { kind: 'coordination' }); f.send('DAY_ROLE', { role: 'planner' }); f.send('DAY_CHOICE', { choice: 'silent' });
  play(f, 2); f.send('DAY_CONTINUE'); f.send('DAY_CONFIRM'); play(f, 4); f.send('DAY_CLOSE');
  const saved = f.store.peek().state;
  assert.equal(saved.townEvents.filter(e => e.kind === 'habit.used').length, 1, '합의의 첫 이용');
  f.set(at(12) + 30 * 60 * MIN); // 다음 날 18시 — 맥박 없이 읽는다: 바뀐 것은 마을 구간뿐
  const shown = f.read().state;
  assert.equal(f.store.peek().state.writeSeq, saved.writeSeq, '쓰지 않았다');
  const used = shown.townEvents.filter(e => e.kind === 'habit.used');
  assert.equal(used.length, 2, '약속을 지킨 둘째 이용이 답에 보인다');
  assert.equal(shown.townSeq, shown.townEvents.at(-1).id.slice(2) * 1, '사건 번호와 목록이 맞는다');
  f.pulse(); f.send('DAY_REST');
  const kept = f.store.peek().state.townEvents.filter(e => e.kind === 'habit.used');
  assert.deepEqual(kept.map(e => e.id), used.map(e => e.id), '다음 쓰기가 같은 번호로 저장한다');
});

test('밤 규칙: 안내 줄은 그 자리 주민이 잠들었거나 잠 때문에 여기서 열 장면이 하나도 없을 때만 — 잠든 사이 이어지는 준비의 공방 주인은 작업대에 남는다', async () => {
  const f = await fixture(at(22), { sleeps: true });
  f.go('cafe'); f.place(); play(f, 20); f.ack();
  const cafe = f.read().view.day;
  assert.ok(cafe.actions.some(a => a.type === 'DAY_START' && a.payload.kind === 'tea'), '22시: 찻집 주인·연구원은 깨어 있다');
  assert.ok(!/잠들었어요/.test(cafe.line), '열 수 있는 장면 옆에 잠든 안내를 덮지 않는다');
  f.go('workshop');
  assert.match(f.read().view.day.line, /^공방 주인은 벌써 잠들었어요/, '그 자리 주민(21:30 취침)이 잠들었다');
  const g = await fixture(at(21, 29) + 45_000, { sleeps: true }); // 준비 끝은 21:30:15, 공방 주인 취침은 21:30
  g.go('workshop'); g.send('DAY_JOB_START');
  g.set(at(21, 30) + 5000); g.pulse();
  const scene = g.read().view.day.scene;
  assert.equal(g.read().state.day.job.status, 'preparing');
  assert.equal(scene.village.holds['workshop-owner']?.pose, 'working', '준비가 끝날 때까지 작업대');
  assert.ok(scene.npcs.some(n => n.id === 'workshop-owner'), '옛 화면에도 보인다');
});

test('방문 끝 벽시계: 결산 없이 같은 U에서 방문이 두 번 끝나도 첫 방문 끝 시각을 지킨다(GPT 검수 GA1)', async () => {
  const { initialLease, pulseLease, VISIT_IDLE_MS } = await townFile('presence.mjs');
  let lease = initialLease();
  const pulse = (ms, foreground) => { lease = pulseLease(lease, { surfaceId: 'w', surface: 'day', foreground, safe: false }, ms).lease; };
  pulse(0, true); pulse(3000 + VISIT_IDLE_MS, true); pulse(3000 + VISIT_IDLE_MS, false); pulse(3000 + 2 * VISIT_IDLE_MS, true);
  assert.equal(lease.breaks.length, 1, '같은 U의 도장은 하나');
  assert.equal(lease.breakAts[lease.breaks[0]], 3000 + VISIT_IDLE_MS, '첫 방문 끝 = 마지막 전경 + 3초 + 30분');
});

test('예약 상한: 넘치면 오래된 닫힌 예약부터 빠지고, 아직 붙잡고 있는 예약은 남는다(GPT 검수 GA3)', async () => {
  const v = await townFile('town/village.mjs');
  const village = v.initialVillage();
  v.closeBands(village, { nowMs: at(12), seed: 'acct-night', offsetMin: 540, revision: 1 });
  const long = { by: 'E-long', spot: 'greenhouse.board' };
  v.holdResidents(village, { researcher: long }, at(12) + 1000, 2);
  for (let i = 0; i < 80; i++) v.holdResidents(village, { researcher: long, 'cafe-owner': { by: `E-${i}`, spot: 'cafe.counter' } }, at(12) + 2000 + i * 1000, 3 + i);
  assert.ok(village.reservations.length <= v.RESERVATIONS_MAX, String(village.reservations.length));
  assert.ok(village.reservations.some(r => r.by === 'E-long' && r.toMs === null), '오래 붙잡은 예약이 남는다');
  assert.ok(village.reservations.some(r => r.by === 'E-79' && r.toMs === null), '지금 붙잡은 예약도 남는다');
  assert.equal(v.validVillage(village), true);
});

test('재시작: 창 항목이 온전하지 않은 임대 파일은 버리고 세계의 도장으로 연다 — 저장소는 멈추지 않는다(GPT 검수 GA4)', async () => {
  const fs = require('node:fs'), os = require('node:os');
  const { createStore } = await townFile('server.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-lease-'));
  try {
    const now = () => at(12), save = path.join(dir, 'save');
    const first = createStore({ dir: save, now, tz: 540 });
    first.pulse({ surfaceId: 'w', surface: 'day', foreground: true, safe: true });
    const revision = first.read().state.revision, file = path.join(save, 'lease.json');
    const lease = JSON.parse(fs.readFileSync(file, 'utf8')); lease.presence.surfaces = { w: null }; fs.writeFileSync(file, JSON.stringify(lease));
    const again = createStore({ dir: save, now, tz: 540 });
    assert.equal(again.read().state.revision, revision);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('밤 규칙: 취침 전에 시작한 장면은 취침 시각을 넘겨도 이어 간다(GPT 검수 GB1)', async () => {
  const f = await fixture(at(23, 28), { sleeps: true });
  f.go('cafe'); f.place(); play(f, 20); f.ack();
  f.send('DAY_START', { kind: 'tea' });
  f.set(at(23, 31)); f.pulse();
  assert.throws(() => f.send('LIFE_OPEN', { source: 'direct' }), error => error.code === 'resident-asleep', '새 장면은 막힌다');
  f.send('DAY_ROLE', { role: 'planner' });
  const e = f.read().state.day.episode;
  assert.ok(e.open && e.stage === 'choice', JSON.stringify({ open: e.open, stage: e.stage }));
});

test('W3 화면: 다른 곳에 있던 주민은 장면 자리로 걸어온 뒤 붙잡힌다 — 걸음과 붙잡힘을 둘 다 본다(GPT 검수 GB3)', async () => {
  const { placeAt, planOf } = await townFile('town/village.mjs');
  const f = await fixture(at(10));
  // 공방 주인이 공방 밖에 머무는 때를 계획에서 찾아 그 시각에 도움을 청한다.
  const v = f.read().state.village, segments = planOf(v).segments, start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, s]) => s));
  let when = null;
  for (let t = at(10); t < v.band.endMs - 10 * MIN && when === null; t += MIN) { const p = placeAt(segments, 'workshop-owner', t, start); if (p && !p.walking && p.to !== 'workshop') when = t; }
  assert.ok(when, '공방 밖의 공방 주인');
  f.set(when); f.pulse(); f.go('workshop'); f.send('DAY_START', { kind: 'help' });
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const v2 = f.read().view.day.scene.village, here = placeAt(v2.segments, 'workshop-owner', v2.nowMs, v2.startSpots);
    seen.add(here?.walking && here.archetype === 'reserved' ? 'walking' : v2.holds['workshop-owner'] ? 'held' : 'other');
    f.pulse(1000);
  }
  assert.ok(seen.has('walking') && seen.has('held'), [...seen].join());
});

test('밤 규칙: 가판 이어 하기는 시작이 아니다 — 공방 주인이 잠든 뒤엔 그림 메뉴 가판 시작만 막고, 준비 중인 공방 주인을 잠들었다고 하지 않는다(화면 검수 A1·A2)', async () => {
  const f = await fixture(at(21, 29) + 45_000, { sleeps: true });
  f.go('workshop'); f.send('DAY_JOB_START');
  f.set(at(21, 30) + 5000); f.pulse();
  assert.doesNotMatch(f.read().view.day.line, /잠들었어요/, '준비가 이어지는 동안');
  const g = await fixture(at(21, 31), { sleeps: true });
  g.go('cafe'); g.place(); play(g, 20); g.ack();
  assert.throws(() => g.send('BAZAAR_START', { kind: 'pictureMenu' }), error => error.code === 'resident-asleep' && /공방 주인/.test(error.message));
  g.send('BAZAAR_START', { kind: 'requests' });
  g.send('BAZAAR_CLOSE');
  g.send('BAZAAR_RESUME');
  assert.equal(g.read().state.bazaar.episode.open, true, '시작한 가판은 이어 한다');
});

test('예약 상한(재검수 GA1): 한 구간의 닫힌 예약은 상한까지 남고, 구간을 한 번에 닫든 나눠 결산하든 같은 결과다', async () => {
  const v = await townFile('town/village.mjs');
  const make = () => { const village = v.initialVillage(); v.closeBands(village, { nowMs: at(12), seed: 'acct-night', offsetMin: 540, revision: 1 }); return village; };
  const hold = village => { for (let i = 0; i < 100; i++) v.holdResidents(village, { 'cafe-owner': { by: `E-${i}`, spot: 'cafe.counter' } }, at(12) + 1000 + i * 1000, 2 + i); };
  const whole = make(), split = make(); hold(whole); hold(split);
  assert.equal(whole.reservations.length, 100, '상한(128) 아래에서는 하나도 빠지지 않는다');
  v.closeBands(split, { nowMs: at(15), seed: 'acct-night', offsetMin: 540, revision: 200 });
  for (const village of [whole, split]) v.closeBands(village, { nowMs: at(17, 30), seed: 'acct-night', offsetMin: 540, revision: 200 });
  assert.deepEqual(split.band, whole.band, '나눠 결산해도 다음 구간의 시작 상태가 같다');
  assert.equal(v.validVillage(whole), true);
});
test('밤 규칙: 자리가 바뀐 장면을 다시 정하는 것은 시작이다 — 잠든 주민이 있으면 DAY_RETRY는 409, 뷰는 다시 정하기 대신 아침 안내(Fable 최종 P1)', async () => {
  const f = await fixture(at(14), { sleeps: true });
  f.go('cafe'); f.place(); play(f, 20); f.ack();
  f.send('DAY_START', { kind: 'tea' }); f.send('DAY_CLOSE');
  f.send('REARRANGE'); f.send('CHOOSE', { branch: 'inside' }); f.send('NEXT'); f.send('PLACE', { slot: 'eaves-right' });
  play(f, 20); f.ack();
  assert.equal(f.read().state.day.episode.stage, 'invalid', '자리를 옮기면 닫아 둔 장면은 다시 정할 차례');
  f.set(at(26, 10)); f.pulse(); // 다음 날 02:10
  f.send('DAY_RESUME'); // 이어 하기는 시작이 아니다
  let { state, view } = f.read();
  assert.ok(state.day.episode.open && state.day.episode.stage === 'invalid');
  assert.ok(!view.day.actions.some(a => a.type === 'DAY_RETRY'), '잠든 밤에는 다시 정하기를 내지 않는다');
  assert.equal(view.day.speaker, '생활 수첩');
  assert.match(view.day.line, /찻집 주인과 연구원이 잠든 밤이라, 지금 자리로 다시 정하는 일은 아침에 함께해요\./);
  assert.throws(() => f.send('DAY_RETRY'), error => error.code === 'resident-asleep' && error.status === 409);
  ({ state, view } = f.read());
  assert.equal(state.day.episode.stage, 'invalid');
  assert.deepEqual(Object.keys(view.day.scene.village.holds), [], '잠든 주민을 붙잡지 않는다');
  // 아침 09:00 — 방문이 끝나 닫힌 장면을 이어 하면, 두 주민이 일어나 있어 다시 정할 수 있다.
  f.set(at(33)); f.pulse();
  if (!f.read().state.day.episode.open) f.send('DAY_RESUME');
  ({ view } = f.read());
  assert.ok(view.day.actions.some(a => a.type === 'DAY_RETRY'), view.day.line);
  f.send('DAY_RETRY');
  assert.equal(f.read().state.day.episode.stage, 'role');
});

test('밤 규칙: 취침 전에 시작해 닫아 둔 가판은 밤에도 화면에서 이어 할 수 있다 — 명령·하루 장면과 같은 규칙, 새 가판만 아침에(Fable 최종 P2)', async () => {
  const f = await fixture(at(23, 20), { sleeps: true });
  f.go('cafe'); f.place(); play(f, 20); f.ack();
  f.send('BAZAAR_START', { kind: 'requests' }); f.send('BAZAAR_ROLE', { role: 'planner' }); f.send('BAZAAR_ASK');
  f.send('BAZAAR_CLOSE');
  f.set(at(23, 40)); f.pulse();
  let { view } = f.read();
  assert.deepEqual(view.bazaar.actions.map(a => a.type), ['BAZAAR_RESUME'], '시작한 가판은 이어 하기만, 새 가판 시작은 없다');
  assert.match(view.bazaar.line, /하던 손님 맞이는 이어 할 수 있어요\. 새 손님 맞이는 찻집 주인이 일어나는 아침에 함께해요\./);
  f.send('BAZAAR_RESUME');
  ({ view } = f.read());
  assert.equal(f.read().state.bazaar.episode.open, true);
  assert.ok(view.bazaar.scene.npcs.some(n => n.id === 'cafe-owner'), '다시 연 가판은 찻집 주인과 함께 그린다');
});

test('밤 규칙: 요청 회차를 마치고 그림 메뉴만 남았는데 공방 주인이 잠들었으면, 다시 보기 단추가 남아도 그렇게 말한다(Fable 최종 P3)', async () => {
  const f = await fixture(at(22), { sleeps: true });
  f.go('cafe'); f.place(); play(f, 20); f.ack();
  f.send('BAZAAR_START', { kind: 'requests' }); f.send('BAZAAR_ROLE', { role: 'delegated' }); f.send('BAZAAR_ASK');
  play(f, 3); f.send('BAZAAR_CONTINUE'); f.send('BAZAAR_CONFIRM'); play(f, 7);
  assert.equal(f.read().state.bazaar.episode.stage, 'result');
  f.send('BAZAAR_CLOSE');
  const { view } = f.read();
  assert.deepEqual(view.bazaar.actions.map(a => a.label), ['방금 마친 모습 다시 보기']);
  assert.equal(view.bazaar.line, '공방 주인은 벌써 잠들었어요. 그림 메뉴 가판은 아침에 함께해요.');
});
