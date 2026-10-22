'use strict';
// 싱크타운 결산(세로 조각 설계 §14-4, W2 계획 D1·D6) — 옛 모듈의 짧은 타이머는 덩어리 크기와 상관없이 같은 상태에 닿는다:
// 한 덩어리 = 1초씩 = 0.3초씩(남은 시간은 다음 단계로 넘어가고, 단계 도장은 넘어간 정확한 U다 — F1·F4).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
/** total ms를 step ms씩(마지막은 나머지) 나눈 목록. */
const chunks = (total, step) => { const out = []; for (let left = total; left > 0; left -= step) out.push(Math.min(step, left)); return out; };
const SPLITS = total => [[total], chunks(total, 1000), chunks(total, 300)];

test('가판: 준비→내기→결과가 한 덩어리·1초씩·0.3초씩 같고, 낸 시각·마친 시각은 넘어간 정확한 U다', async () => {
  const { initialBazaar, advanceBazaar, commandBazaar } = await townFile('bazaar.mjs');
  const ctx = { elapsedMs: 0, canRun: true, location: 'cafe', support: 'cooperate', languageSupport: 'plain', cafeBusy: false };
  const ready = choice => {
    const state = initialBazaar(), send = (type, payload = {}) => commandBazaar(state, `BAZAAR_${type}`, payload, ctx);
    send('START', { kind: 'requests' }); send('ROLE', { role: 'planner' }); send('ASK');
    send('CHOICE', { choice });
    send('MATCH', { recipient: 'reader', menu: 'tea', sweetener: 'none' }); send('MATCH', { recipient: 'companion', menu: 'water', sweetener: 'none' });
    if (state.episode.stage === 'rehearsal') advanceBazaar(state, { ...ctx, elapsedMs: 3000 });
    send('CONFIRM');
    return { state, send };
  };
  for (const choice of ['together', 'waterFirst']) {
    const runs = SPLITS(9100).map(split => {
      const { state, send } = ready(choice), startU = state.uMs, facts = [];
      for (const ms of split) facts.push(...advanceBazaar(state, { ...ctx, elapsedMs: ms }));
      if (choice === 'waterFirst') { send('TEA_NEXT'); for (const ms of split) facts.push(...advanceBazaar(state, { ...ctx, elapsedMs: ms })); }
      return { state, facts, startU };
    });
    assert.deepEqual(runs[1], runs[0], `${choice}: 1초씩`);
    assert.deepEqual(runs[2], runs[0], `${choice}: 0.3초씩`);
    const { state, startU } = runs[0];
    const portions = Object.fromEntries(state.allocation.portions.map(p => [p.id, p.servedU]));
    if (choice === 'together') {
      assert.deepEqual(portions, { reader: startU + 5000, companion: startU + 5000 });
      assert.equal(state.history[0].completedU, startU + 5000);
      assert.equal(state.episode.elapsedMs, 1200, '결과 단계는 볼 수 있는 때까지만 센다');
    } else {
      assert.equal(portions.companion, startU + 5000);
      assert.equal(portions.reader, startU + 9100 + 5000, '차는 TEA_NEXT 뒤 준비·내기를 마친 때');
      assert.equal(state.history[0].completedU, startU + 9100 + 5000);
    }
  }
});

test('첫 하루: 실행을 마친 시각(completedU)은 덩어리 크기와 상관없다', async () => {
  const { initialDay, advanceDay, commandDay } = await townFile('day.mjs');
  const runs = SPLITS(5300).map(split => {
    const day = initialDay(); let ctx = { nowMs: 100000, elapsedMs: 0, canRun: true, placement: 'garden', seatRevision: 1, ftReady: true };
    const send = (type, payload = {}) => commandDay(day, type, payload, { ...ctx, elapsedMs: 0 });
    send('DAY_MOVE', { location: 'cafe' }); if (day.home.exitTarget) send('DAY_EXIT');
    send('DAY_SUPPORT', { mode: 'cooperate' }); send('DAY_START', { kind: 'coordination' }); send('DAY_ROLE', { role: 'planner' });
    send('DAY_CHOICE', { choice: 'silent' }); send('DAY_CONFIRM');
    const startU = day.uMs;
    for (const ms of split) { ctx = { ...ctx, nowMs: ctx.nowMs + ms, elapsedMs: ms }; advanceDay(day, ctx); }
    return { history: day.history, emitted: day.emitted, startU };
  });
  assert.equal(runs[0].history.length, 1);
  assert.equal(runs[0].history[0].completedU, runs[0].startU + 4000);
  assert.deepEqual(runs[1].history, runs[0].history); assert.deepEqual(runs[2].history, runs[0].history);
  // 한 걸음 안에서 타이머 둘이 넘어가면 사실은 코드 순서로 붙는다 — 그래서 결산은 1초 이하 걸음으로 나눈다(D1).
  assert.deepEqual([...runs[0].emitted].sort(), [...runs[1].emitted].sort());
  assert.deepEqual(runs[2], runs[1]);
});

test('C1: 함께 한 일을 마친 시각(completedU)은 덩어리 크기와 상관없다', async () => {
  const { initialLife, advanceLife, commandLife } = await townFile('life.mjs');
  const runs = SPLITS(7700).map(split => {
    const life = initialLife(), ctx = { elapsedMs: 0, canRun: true, canContact: false, surfaceId: 'surface-a', fence: 1, worldRevision: 1, placement: 'eaves-left' };
    advanceLife(life, ctx);
    const send = (type, payload = {}) => commandLife(life, type, payload, { ...ctx, elapsedMs: 0 });
    send('LIFE_OPEN', { source: 'direct' }); send('LIFE_ROLE', { role: 'planner' }); send('LIFE_DIRECTION', { direction: 'near' }); send('LIFE_CONFIRM');
    const startU = life.uMs;
    for (const ms of split) advanceLife(life, { ...ctx, elapsedMs: ms });
    return { history: life.history, episode: life.episode, uMs: life.uMs, startU };
  });
  assert.equal(runs[0].history[0].completedU, runs[0].startU + 6000);
  assert.deepEqual(runs[1], runs[0]); assert.deepEqual(runs[2], runs[0]);
});

test('FT10: 차를 마치고 남은 시간은 이어지는 안내판 이용으로 넘어간다', async () => {
  const core = await townFile('core.mjs');
  // 이용을 줄 세우는 것은 3D 하루 화면(surface: day)이고, 찻집에 있어야 흐른다.
  const host = { enabled: true, canRun: true, canContact: false, surfaceId: 'surface-a', fence: 1, surface: 'day' };
  let n = 0;
  const run = (s, type, payload = {}) => core.reduceCommand(s, { id: `settle.${++n}`, type, payload, expectedRevision: s.revision }, host).state;
  const advance = (s, split) => { for (const ms of split) s = core.advanceLivingState(s, { ...host, elapsedMs: ms }).state; return s; };
  const ack = s => {
    const { view } = core.snapshot(s);
    return run(s, 'ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey, worldRevision: s.worldRevision,
      activity: s.activity, mode: 'static', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds });
  };
  // 자리를 놓고(차) → 안내판을 놓은 뒤 → 같은 자리에 다시 놓으면 차가 끝나는 순간 안내판 이용이 이어진다.
  let s = core.initialState({ lifeEnabled: true });
  s = run(s, 'DAY_MOVE', { location: 'cafe' }); if (s.day.home.exitTarget) s = run(s, 'DAY_EXIT');
  s = run(s, 'CHOOSE', { branch: 'inside' }); s = run(s, 'NEXT'); s = run(s, 'PLACE', { slot: 'eaves-left' });
  s = ack(advance(s, chunks(30000, 1000)));
  s = run(s, 'SIGN_START'); s = run(s, 'SIGN_NEXT'); s = run(s, 'SIGN_PICTURE', { picture: 'chair' }); s = run(s, 'SIGN_PLACE', { slot: 'entrance-left' });
  s = ack(advance(s, chunks(30000, 1000)));
  s = run(s, 'REARRANGE'); s = run(s, 'CHOOSE', { branch: 'inside' }); s = run(s, 'NEXT'); s = run(s, 'PLACE', { slot: 'eaves-left' });
  assert.equal(s.pendingUse?.kind, 'tea');
  // 판(revision)은 저장할 때마다 오르던 옛 뜻이라 견주지 않는다(D4에서 명령 판으로 바뀐다).
  const strip = state => { const { revision, ...rest } = state; return rest; };
  const runs = [[25000], chunks(25000, 1000), chunks(25000, 300)].map(split => strip(advance(structuredClone(s), split)));
  assert.equal(runs[0].activity, 'sign', '차를 마친 뒤 안내판 이용이 이어졌다');
  assert.ok(runs[0].sign.currentUseId, '안내판 이용까지 마쳤다');
  assert.deepEqual(runs[1], runs[0], '1초씩'); assert.deepEqual(runs[2], runs[0], '0.3초씩');
});

// ── 맥박은 임대만, 결산은 경계 신호·읽기·명령에서(§14-3, D1~D5) ──────────────────────────
async function storeFixture() {
  const { createStore } = await townFile('server.mjs');
  return (options = {}) => {
    let at = 100000, n = 0, receipt;
    const store = createStore({ now: () => at, ...options });
    const pulseInput = { surfaceId: 'day-a', surface: 'day', foreground: true, safe: false };
    const f = {
      store, get at() { return at; },
      old(ms = 0, extra = {}) { at += ms; const out = store.presence({ ...pulseInput, ...extra }); receipt = out.presence; return out; },
      pulse(ms = 0, extra = {}) { at += ms; const out = store.pulse({ ...pulseInput, ...extra }); receipt = out.presence; return out; },
      send(type, payload = {}) {
        return store.execute({ id: `settle-${++n}`, type, expectedRevision: store.peek().state.revision,
          payload: { ...(/^(DAY_|LIFE_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
      },
      boundary(extra = {}) { return store.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence, ...extra }); },
    };
    return f;
  };
}
const worldOf = snapshot => { const { writeSeq, ...rest } = snapshot.state; return rest; };
/** 찻집에 자리를 놓아 FT10 차 이용이 흐르게 해 둔 가게 — 맥박 방식만 고른다. */
function placed(make, mode) {
  const f = make(); f[mode]();
  f.send('DAY_MOVE', { location: 'cafe' }); if (f.store.peek().state.day.home.exitTarget) f.send('DAY_EXIT');
  f.send('CHOOSE', { branch: 'inside' }); f.send('NEXT'); f.send('PLACE', { slot: 'eaves-left' });
  return f;
}

test('맥박만 보내고 명령 때 결산한 세계는 1초마다 옛 맥박으로 민 세계와 명령 경계마다 같다', async () => {
  const make = await storeFixture();
  const old = placed(make, 'old'), lazy = placed(make, 'pulse');
  for (let i = 0; i < 20; i++) { old.old(1000); lazy.pulse(1000); }
  assert.equal(lazy.store.peek().state.settledU < old.store.peek().state.settledU, true, '맥박은 세계를 밀지 않는다');
  old.send('DAY_MOVE', { location: 'workshop' }); lazy.send('DAY_MOVE', { location: 'workshop' });
  assert.deepEqual(worldOf(lazy.store.peek()), worldOf(old.store.peek()));
  assert.ok(old.store.peek().state.writeSeq > lazy.store.peek().state.writeSeq, '옛 맥박은 매번 쓰고, 새 맥박은 쓰지 않는다');
});

test('나눠 결산해도 한 번에 결산한 것과 같다(걸음 격자 위에서) · peek은 결산하지 않는다', async () => {
  const make = await storeFixture();
  const once = placed(make, 'pulse'), split = placed(make, 'pulse');
  for (let i = 0; i < 10; i++) { once.pulse(1000); split.pulse(1000); }
  const before = split.store.peek().state.settledU;
  split.store.read();
  assert.ok(split.store.peek().state.settledU > before, '읽기는 결산한다');
  for (let i = 0; i < 10; i++) { once.pulse(1000); split.pulse(1000); }
  const peeked = once.store.peek().state.settledU;
  assert.equal(once.store.peek().state.settledU, peeked);
  once.send('DAY_MOVE', { location: 'workshop' }); split.send('DAY_MOVE', { location: 'workshop' });
  assert.deepEqual(worldOf(split.store.peek()), worldOf(once.store.peek()));
});

test('판 둘: 맥박·결산은 명령 판(revision)을 올리지 않고, 쓸 때마다 writeSeq가 오른다 · 맥박 응답은 작다', async () => {
  const make = await storeFixture();
  const f = placed(make, 'old'), revision = f.store.peek().state.revision, seq = f.store.peek().state.writeSeq;
  f.old(1000); f.old(1000);
  assert.equal(f.store.peek().state.revision, revision);
  assert.equal(f.store.peek().state.writeSeq, seq + 2);
  const answer = f.pulse(1000);
  assert.deepEqual(Object.keys(answer).sort(), ['presence', 'serverNow', 'worldSeq']);
  assert.ok(JSON.stringify(answer).length < 200, JSON.stringify(answer));
  f.send('DAY_MOVE', { location: 'workshop' });
  assert.equal(f.store.peek().state.revision, revision + 1);
});

test('30분 쉬면 방문 끝 도장이 남고, 결산이 그 U까지 걸은 뒤 방문을 한 번 닫는다', async () => {
  const { settleSteps } = await townFile('town/settle.mjs');
  const { initialLease } = await townFile('presence.mjs');
  const span = { u: 0, surfaceId: 'a', fence: 1, surface: 'classic', canRun: true };
  const lease = { ...initialLease({ uMs: 4500 }), spans: [span], breaks: [2500] };
  const steps = settleSteps(0, lease);
  assert.deepEqual(steps.map(s => [s.u, s.elapsedMs, !!s.visitEnded]), [[0, 1000, false], [1000, 1000, false], [2000, 500, false], [2500, 0, true], [2500, 1000, false], [3500, 1000, false]]);
  assert.deepEqual(settleSteps(2500, lease).filter(s => s.visitEnded), [], '이미 결산한 도장은 다시 쓰지 않는다');
  const make = await storeFixture();
  const f = make(); f.old(); f.old(1000);
  const visit = f.store.peek().state.life.visitIndex;
  f.old(31 * 60000); f.old(1000);
  assert.equal(f.store.peek().state.life.visitIndex, visit + 1, '쉰 뒤 새 방문');
});

test('경계 신호: 결산 뒤 안전하면 먼저 말 걸기를 낸다 · 화면이 부르는 것은 20초에 한 번 · 주인 창만', async () => {
  const make = await storeFixture();
  const f = make(); f.pulse(0, { surface: 'classic' });
  f.send('CHOOSE', { branch: 'inside' }); f.send('NEXT'); f.send('PLACE', { slot: 'eaves-left' });
  const ack = () => { const { state, view } = f.store.peek(); return f.send('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey,
    activity: state.activity, worldRevision: state.worldRevision, mode: 'static', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds }); };
  ack();
  for (let i = 0; i < 50; i++) f.pulse(1000, { surface: 'classic' });
  assert.equal(f.store.peek().state.life.contacts.length, 0, '맥박은 말을 걸지 않는다');
  assert.throws(() => f.boundary({ fence: 99 }), error => error.code === 'stale-surface');
  const first = f.boundary();
  assert.ok(first.issued, JSON.stringify(first));
  const { contacts, uMs } = f.store.peek().state.life;
  assert.equal(contacts.length, 1); assert.equal(contacts[0].issuedU, uMs, '발급 U는 경계에서 결산한 U');
  f.pulse(1000, { surface: 'classic' });
  assert.deepEqual(f.boundary(), { issued: null, throttled: true, worldSeq: f.store.peek().state.writeSeq });
});
