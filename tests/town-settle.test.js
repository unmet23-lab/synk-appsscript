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
