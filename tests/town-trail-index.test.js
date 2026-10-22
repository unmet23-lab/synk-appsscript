'use strict';
// 싱크타운 사건 색인(세로 조각 설계 §14-3, W2 계획 D7) — 붙이기·검증·반응 고르기가 Trail 로그를 통째로 다시 읽지 않는다.
// 색인은 atlas/trail-life.js와 같은 답을 내야 한다: 같은 로그를 Trail이 받아들이고, 같은 반응을 고른다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');
const Trail = require('../atlas/trail-life.js');
const Vellum = require('../atlas/vellum-life.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
const host = { enabled: true, canRun: true, canContact: false, surfaceId: 'surface-a', fence: 1 };

/** 자리를 놓고 차를 내고(ACK) 안내판까지 — 사실과 배달이 섞인 로그를 만든다. */
async function playedState() {
  const core = await townFile('core.mjs');
  let n = 0, s = core.initialState({ lifeEnabled: true });
  const run = (type, payload = {}) => { s = core.reduceCommand(s, { id: `index.${++n}`, type, payload, expectedRevision: s.revision }, host).state; };
  const ack = () => { const { view } = core.snapshot(s); run('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey,
    worldRevision: s.worldRevision, activity: s.activity, mode: 'static', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds }); };
  run('CHOOSE', { branch: 'inside' }); run('NEXT'); run('PLACE', { slot: 'eaves-left' }); ack();
  run('SIGN_START'); run('SIGN_NEXT'); run('SIGN_PICTURE', { picture: 'chair' }); run('SIGN_PLACE', { slot: 'entrance-left' }); ack();
  return { core, state: s, run: (...args) => { run(...args); return s; } };
}

test('색인으로 붙인 로그를 Trail이 그대로 받아들이고, 다시 지은 색인과 같다', async () => {
  const { state } = await playedState();
  const { indexLog } = await townModule('trail-index');
  assert.ok(state.events.some(e => e.type === 'life.delivered'), '배달이 섞인 로그');
  assert.doesNotThrow(() => Trail.summarize(state.events, { scope: state.scope }));
  assert.deepEqual(indexLog(state.events), state.trail);
});

test('색인의 투영은 Vellum이 읽는 모든 답에서 Trail 요약 전체와 같다', async () => {
  const { state } = await playedState();
  const { projection } = await townModule('trail-index');
  const summary = Trail.summarize(state.events, { scope: state.scope });
  const ids = [...state.events.map(e => e.id), 'life:999', 'nowhere'];
  for (const npcId of ['cafe-owner', 'guest', 'workshop-owner', 'researcher', 'nobody']) {
    for (const sourceIds of [ids, ids.slice(0, 3), ids.slice(-4)]) {
      const view = projection(state.trail, { version: Trail.VERSION, scope: state.scope, npcId, sourceIds });
      const inSources = list => list.filter(id => sourceIds.includes(id)).sort();
      assert.deepEqual(view.facts.map(f => f.id).sort(), inSources(summary.facts.map(f => f.id)), `${npcId} 사실`);
      assert.equal(Object.hasOwn(view.knowledge, npcId), Object.hasOwn(summary.knowledge, npcId), `${npcId}를 아는가`);
      if (Object.hasOwn(summary.knowledge, npcId)) assert.deepEqual([...view.knowledge[npcId]].sort(), inSources(summary.knowledge[npcId]), `${npcId} 지식`);
      const mine = list => list.filter(d => d.npcId === npcId).map(d => [d.npcId, d.semanticKey, [...d.sourceIds].sort()]);
      assert.deepEqual(mine(view.deliveries), mine(summary.deliveries), `${npcId} 배달`);
    }
  }
  // 그래서 같은 후보면 같은 반응이다.
  const candidate = { id: 'probe', semanticKey: 'FT10:daily-use', sourceIds: [state.currentUseId], requiredRevisions: {}, conditions: {},
    priority: 1, once: true, contentRef: 'FT10.revisit', actionRef: 'FT10.05' };
  const pick = trail => Vellum.select({ scope: state.scope, trail, npcId: 'cafe-owner', currentRevisions: {}, conditions: {}, candidates: [candidate] });
  assert.deepEqual(pick(projection(state.trail, { version: Trail.VERSION, scope: state.scope, npcId: 'cafe-owner', sourceIds: candidate.sourceIds })), pick(summary));
});

test('붙이기 규칙: 모르는 원인·배달 충돌·판 불일치·허락 없는 배달·다른 두 종류는 막는다', async () => {
  const { emptyIndex, admit, record } = await townModule('trail-index');
  const scope = { domain: 'LAB', workspace: 'synk-town', subject: 'preview-local' };
  const index = emptyIndex();
  const fact = (seq, extra = {}) => Trail.validate({ schema: 1, id: `life:${seq}`, scope, seq, type: 'life.fact', factType: 'seat.placed',
    causes: [], revisions: { shelter: 1 }, knownBy: ['cafe-owner'], ...extra });
  record(index, fact(1));
  assert.equal(index.lastSeatPlaced, 'life:1');
  assert.throws(() => admit(index, fact(2, { causes: ['life:99'] })), /prior valid causes/);
  assert.throws(() => admit(index, fact(1)), /sequence must increase/);
  const delivery = (seq, extra = {}) => Trail.validate({ schema: 1, id: `life:${seq}`, scope, seq, type: 'life.delivered', reactionId: 'r1',
    deliveryId: 'FT10:1:1:delivery', npcId: 'cafe-owner', semanticKey: 'FT10:daily-use', sourceIds: ['life:1'], revisions: { shelter: 1 },
    contentVersion: 'FT10.v1', mode: 'static', ...extra });
  assert.throws(() => admit(index, delivery(2), { currentRevisions: { shelter: 2 } }), /revision mismatch/);
  assert.throws(() => admit(index, delivery(2, { npcId: 'researcher' }), { currentRevisions: { shelter: 1 } }), /permitted facts/);
  assert.equal(admit(index, delivery(2), { currentRevisions: { shelter: 1 } }), 'append');
  record(index, delivery(2));
  assert.equal(admit(index, delivery(3), { currentRevisions: { shelter: 1 } }), 'same', '같은 영수증의 배달은 한 번만');
  assert.throws(() => admit(index, delivery(3, { mode: 'text' }), { currentRevisions: { shelter: 1 } }), /conflicting delivery id/);
  for (const type of ['life.corrected', 'life.knowledge']) assert.throws(() => admit(index, { type, seq: 9 }), /facts and deliveries only/);
});

test('복원은 로그를 한 번 읽어 색인을 다시 짓고(저장된 색인은 믿지 않음), RESET 뒤에도 사건 순번은 이어진다', async () => {
  const { core, state, run } = await playedState();
  const tampered = { ...structuredClone(state), trail: { ...state.trail, facts: {} } };
  const restored = core.restoreState(tampered, { lifeEnabled: true });
  assert.deepEqual(restored.trail.facts, state.trail.facts);
  const before = state.trail.seq;
  const reset = run('RESET');
  assert.equal(reset.events.length, 0); assert.equal(reset.trail.seq, before);
  const placed = core.reduceCommand(reset, { id: 'index.after-reset', type: 'CHOOSE', payload: { branch: 'inside' }, expectedRevision: reset.revision }, host).state;
  const next = core.reduceCommand(placed, { id: 'index.after-reset-2', type: 'NEXT', payload: {}, expectedRevision: placed.revision }, host).state;
  const third = core.reduceCommand(next, { id: 'index.after-reset-3', type: 'PLACE', payload: { slot: 'eaves-left' }, expectedRevision: next.revision }, host).state;
  assert.ok(third.events.length > 0);
  assert.ok(third.events.every(e => e.seq > before), '리셋 뒤 사건 id가 앞 id를 다시 쓰지 않는다');
  assert.equal(core.restoreState(third, { lifeEnabled: true }).trail.seq, third.trail.seq);
});

test('사건 1만 개에서도 명령 한 번은 로그 전체를 다시 읽지 않는다', async () => {
  const core = await townFile('core.mjs');
  const base = core.initialState({ lifeEnabled: true });
  const events = Array.from({ length: 10000 }, (_, i) => ({ schema: 1, id: `life:${i + 1}`, scope: { ...base.scope }, seq: i + 1, type: 'life.fact',
    factType: 'materials.granted', causes: [], revisions: { shelter: 0 }, knownBy: ['workshop-owner'] }));
  const big = core.restoreState({ ...base, events, trail: undefined }, { lifeEnabled: true });
  assert.equal(Object.keys(big.trail.facts).length, 10000);
  const started = process.hrtime.bigint();
  let s = big;
  for (const [i, [type, payload]] of [['CHOOSE', { branch: 'inside' }], ['NEXT', {}], ['PLACE', { slot: 'eaves-left' }]].entries()) {
    s = core.reduceCommand(s, { id: `big.${i}`, type, payload, expectedRevision: s.revision }, host).state;
  }
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.equal(s.events.length, 10000 + s.events.filter(e => e.seq > 10000).length);
  // 명령 셋 — 예전에는 붙일 때마다 Trail이 1만 줄을 다시 읽었다. 상태 복사(1만 줄)는 사건 갈래로 옮기기 전까지 남는다.
  assert.ok(ms < 3000, `${ms}ms`);
});
