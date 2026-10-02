import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { restoreState, SEATS, SIGN_SLOTS, reactionFor } from './core.mjs';
import { createStore } from './server.mjs';
import Loom from '../../tools/lib/loom-life.js';

function game(store = createStore()) {
  let sequence = store.read().state.commands.length;
  return { store, read: () => store.read(),
    command(type, payload = {}) { return { id: `sign-test.${++sequence}`, type, payload, expectedRevision: store.read().state.revision }; },
    send(type, payload = {}) { return store.execute(this.command(type, payload)); },
    seat(branch = 'inside', slot = branch === 'inside' ? 'eaves-left' : 'garden') {
      this.send('CHOOSE', { branch }); this.send('NEXT');
      if (branch === 'outside' && !this.read().state.canopyOwned) { this.send('COLOR', { color: 'yellow' }); this.send('CRAFT'); }
      return this.send('PLACE', { slot });
    },
    draft(picture = 'chair', slot = 'entrance-left') {
      this.send('SIGN_START'); this.send('SIGN_NEXT'); this.send('SIGN_PICTURE', { picture });
      return this.send('SIGN_PREVIEW', { slot });
    },
    sign(picture = 'chair', slot = 'entrance-left') { this.draft(picture, slot); return this.send('SIGN_PLACE', { slot }); },
    receipt() {
      const { state, view } = this.read();
      return { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey, activity: state.activity,
        worldRevision: state.worldRevision, mode: 'motion', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds };
    },
    ack(extra = {}) { return this.send('ACK', { ...this.receipt(), ...extra }); },
  };
}
const facts = (state, type) => state.events.filter(event => event.factType === type);
const deliveries = state => state.events.filter(event => event.type === 'life.delivered');
const signNote = '자리로 가는 그림을 골랐어요.';
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-sign-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, 'state.json');
}

test('FT51 picture and side choices give the same completion without materials, grades or learning events', () => {
  for (const branch of ['inside', 'outside']) for (const picture of ['chair', 'tea']) for (const slot of Object.keys(SIGN_SLOTS)) {
    const g = game(); const before = g.seat(branch).state;
    const { state, view } = g.sign(picture, slot);
    assert.equal(state.phase, 'ready'); assert.equal(state.activity, 'sign');
    assert.equal(state.sign.picture, picture); assert.equal(state.sign.slot, slot);
    assert.equal(state.sign.target, state.placement); assert.equal(view.planKind, 'sign');
    assert.equal(view.line, '그림을 보고 왔어요'); assert.equal(view.presentationLine, '손님이 그림을 봐요');
    assert.equal(view.engine.learningEffectClaim, false);
    assert.deepEqual(state.inventory, before.inventory); assert.equal(state.canopyOwned, before.canopyOwned);
    assert.deepEqual(state.achievements, [...before.achievements, signNote]);
    assert.equal(facts(state, 'FT51.completed').length, 1); assert.equal(facts(state, 'sign.seat.used').length, 1);
    assert.equal(state.events.some(event => event.type.startsWith('practice.')), false);
    g.ack(); assert.equal(g.read().state.sign.delivered, true);
    assert.equal(deliveries(g.read().state).filter(event => event.semanticKey === 'FT51:first').length, 1);
  }
});

test('both sign locations actually change the guest route through the board and finish at the selected seat', () => {
  const routes = [];
  for (const slot of Object.keys(SIGN_SLOTS)) {
    const g = game(); g.seat('outside', 'garden-right');
    const { view, state } = g.sign('tea', slot), plan = Loom.createPlan(JSON.parse(JSON.stringify(view.plan)));
    const context = { currentRevision: state.worldRevision, currentPlanId: plan.id, committedStepIds: view.committedStepIds };
    assert.deepEqual({ ...plan.steps[0].to }, SIGN_SLOTS[slot]);
    assert.deepEqual({ ...plan.steps[2].from }, SIGN_SLOTS[slot]);
    const read = Loom.sample(plan, 1200, context).actors.guest;
    assert.deepEqual({ ...read }, { ...SIGN_SLOTS[slot], pose: 'reading' });
    const seated = Loom.sample(plan, plan.totalMs, context).actors.guest;
    assert.deepEqual({ ...seated }, { x: SEATS['garden-right'].x, y: SEATS['garden-right'].y, pose: 'seated' });
    routes.push(plan.steps.map(step => [step.from, step.to]));
  }
  assert.notDeepEqual(routes[0], routes[1]);
});

test('FT51 can start before FT10 is watched without forging its delivery or forcing that animation', () => {
  const g = game(); const seat = g.seat();
  assert.equal(seat.state.delivered, false); assert.equal(deliveries(seat.state).length, 0);
  assert.ok(seat.view.actions.some(action => action.type === 'SIGN_START'));
  g.sign(); const after = g.ack().state;
  assert.equal(after.delivered, false); assert.equal(after.sign.delivered, true);
  assert.deepEqual(deliveries(after).map(event => event.semanticKey), ['FT51:first']);
  assert.equal(after.currentUseId, seat.state.currentUseId);
});

test('cancel and leave during a draft keep the committed board and resume the draft without consuming anything', () => {
  const g = game(); g.seat(); g.sign('chair', 'entrance-left'); g.ack();
  const original = g.read();
  for (const phase of ['sign-intro', 'sign-picture', 'sign-place']) {
    g.send('SIGN_START');
    if (phase !== 'sign-intro') g.send('SIGN_NEXT');
    if (phase === 'sign-place') { g.send('SIGN_PICTURE', { picture: 'tea' }); g.send('SIGN_PREVIEW', { slot: 'entrance-right' }); }
    const draft = g.read();
    assert.deepEqual(draft.view.scene.sign, original.view.scene.sign);
    g.send('LEAVE'); assert.deepEqual(g.read().view.scene.sign, original.view.scene.sign);
    g.send('VISIT'); assert.equal(g.read().state.phase, phase);
    assert.deepEqual(g.read().view.scene.sign, original.view.scene.sign);
    g.send('SIGN_CANCEL'); assert.equal(g.read().state.phase, 'ready');
    assert.deepEqual(g.read().view.scene.sign, original.view.scene.sign);
    assert.deepEqual(g.read().state.inventory, original.state.inventory);
    assert.deepEqual(g.read().state.events, original.state.events);
  }
});

test('confirmed FT51 board and an unseen reaction survive a real save-file restart', t => {
  const file = temporary(t), g = game(createStore({ file }));
  g.seat('outside'); g.sign('tea', 'entrance-right');
  const before = g.read(), restoredGame = game(createStore({ file })), reopened = restoredGame.read();
  assert.deepEqual(reopened, before);
  assert.equal(reopened.view.planKind, 'sign'); assert.equal(reopened.state.sign.delivered, false);
  assert.equal(reopened.view.reaction.semanticKey, 'FT51:first');
  assert.equal(reopened.state.events.some(event => event.type.startsWith('practice.')), false);
  restoredGame.ack();
  assert.equal(createStore({ file }).read().state.sign.delivered, true);
});

test('revisits reuse the same board, preserve unseen use and only repeat the daily reaction', () => {
  const g = game(); g.seat(); const placed = g.sign('tea', 'entrance-right');
  g.send('LEAVE'); g.send('VISIT');
  assert.equal(g.read().state.sign.currentUseId, placed.state.sign.currentUseId);
  assert.equal(facts(g.read().state, 'sign.seat.used').length, 1);
  g.ack(); const board = g.read().view.scene.sign;
  g.send('LEAVE'); g.send('VISIT');
  assert.deepEqual(g.read().view.scene.sign, board); assert.equal(g.read().view.reaction.semanticKey, 'FT51:daily-use');
  g.ack();
  assert.equal(facts(g.read().state, 'sign.placed').length, 1); assert.equal(facts(g.read().state, 'FT51.completed').length, 1);
  assert.deepEqual(deliveries(g.read().state).map(event => event.semanticKey), ['FT51:first', 'FT51:daily-use']);
  assert.equal(g.read().state.achievements.filter(note => note === signNote).length, 1);
});

test('seat changes retarget both the board and the actual follow route in one commit', () => {
  const g = game(); g.seat('outside'); g.sign('chair', 'entrance-right'); g.ack();
  const goal = g.read().state.sign.goalId;
  g.send('REARRANGE'); const { state, view } = g.seat('inside', 'eaves-right');
  assert.equal(state.sign.picture, 'chair'); assert.equal(state.sign.slot, 'entrance-right');
  assert.equal(state.sign.target, 'eaves-right'); assert.equal(view.scene.sign.target, 'eaves-right');
  assert.equal(state.sign.goalId, goal); assert.equal(view.reaction.semanticKey, 'FT51:daily-use');
  assert.deepEqual({ ...view.plan.steps.find(step => step.id === 'guest-follow-sign').to },
    { x: SEATS['eaves-right'].x, y: SEATS['eaves-right'].y });
  assert.equal(facts(state, 'sign.retargeted').length, 1);
  assert.equal(state.inventory.canopy, 1);
});

test('removing the canopy disables its sign destination; re-placement reconnects it without rewarding again', () => {
  const g = game(); g.seat('outside'); g.sign(); g.ack();
  const goal = g.read().state.sign.goalId;
  const removed = g.send('REMOVE');
  assert.equal(removed.state.placement, null); assert.equal(removed.state.sign.target, null);
  assert.equal(removed.view.scene.sign.active, false); assert.equal(removed.view.reaction, null);
  const before = g.read(); assert.throws(() => g.send('SIGN_START'), /지금 할 수|먼저 자리/); assert.deepEqual(g.read(), before);
  g.seat('outside', 'garden-right');
  assert.equal(g.read().view.scene.sign.active, true); assert.equal(g.read().state.sign.target, 'garden-right');
  assert.equal(g.read().state.sign.goalId, goal); assert.equal(g.read().view.reaction.semanticKey, 'FT51:daily-use');
  assert.equal(facts(g.read().state, 'FT51.completed').length, 1);
});

test('same board is a no-op; changing or removing it never repeats the first completion', () => {
  const g = game(); g.seat(); g.sign(); g.ack(); const first = g.read().state;
  g.sign(); assert.deepEqual(g.read().state.events, first.events); assert.equal(g.read().state.worldRevision, first.worldRevision);
  g.sign('tea', 'entrance-right'); assert.equal(g.read().view.reaction.semanticKey, 'FT51:daily-use'); g.ack();
  g.send('SIGN_REMOVE'); assert.equal(g.read().view.scene.sign, null);
  g.sign('chair', 'entrance-left'); assert.equal(g.read().view.reaction.semanticKey, 'FT51:daily-use');
  assert.equal(g.read().state.sign.goalId, first.sign.goalId);
  assert.equal(facts(g.read().state, 'FT51.completed').length, 1);
});

test('sign command retries are idempotent and stale or incomplete acknowledgements cannot erase pending delivery', () => {
  const g = game(); g.seat(); g.draft(); const command = g.command('SIGN_PLACE', { slot: 'entrance-left' });
  const first = g.store.execute(command), repeated = g.store.execute(command);
  assert.equal(repeated.duplicate, true); assert.deepEqual(repeated.state, first.state);
  assert.throws(() => g.store.execute({ ...command, payload: { slot: 'entrance-right' } }), /같은 요청/);
  const stale = g.receipt();
  g.sign('tea', 'entrance-right');
  const before = g.read(); assert.throws(() => g.send('ACK', stale), /지금 자리/); assert.deepEqual(g.read(), before);
  for (const invalid of [{ activity: 'seat' }, { hidden: true }, { paused: true }, { visible: false },
    { assetsReady: false }, { appliedStepIds: ['guest-walk-sign'] }]) {
    assert.throws(() => g.ack(invalid), /지금 자리|장면이 보인/);
    assert.equal(g.read().state.sign.delivered, false);
  }
  g.ack(); assert.equal(g.read().state.sign.delivered, true);
});

test('sign placement save failure keeps the previous world and retry commits exactly once', () => {
  let fail = false, saved;
  const g = game(createStore({ save(next) { if (fail) throw new Error('synthetic full disk'); saved = structuredClone(next); } }));
  g.seat(); g.draft('tea', 'entrance-right'); const before = g.read();
  const command = g.command('SIGN_PLACE', { slot: 'entrance-right' }); fail = true;
  assert.throws(() => g.store.execute(command), /저장하지 못/); assert.deepEqual(g.read(), before);
  fail = false; g.store.execute(command); const repeated = g.store.execute(command);
  assert.equal(repeated.duplicate, true); assert.deepEqual(saved, repeated.state);
  assert.equal(facts(saved, 'sign.placed').length, 1); assert.equal(facts(saved, 'FT51.completed').length, 1);
});

test('legacy FT10 saves gain only empty FT51 state and preserve their pending original reaction', t => {
  const file = temporary(t), g = game(); g.seat('outside');
  const legacy = structuredClone(g.read().state); delete legacy.activity; delete legacy.sign;
  const original = structuredClone(legacy), migrated = restoreState(legacy);
  assert.deepEqual(legacy, original, 'migration does not modify its input');
  assert.equal(migrated.activity, 'seat'); assert.equal(migrated.sign.slot, null);
  assert.deepEqual(migrated.events, legacy.events); assert.deepEqual(migrated.inventory, legacy.inventory);
  fs.writeFileSync(file, JSON.stringify(legacy));
  const restoredGame = game(createStore({ file })), restored = restoredGame.read();
  assert.equal(restored.view.reaction.semanticKey, 'FT10:outside:first');
  assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(legacy), 'reading never rewrites the old save');
  restoredGame.ack();
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.activity, 'seat'); assert.equal(saved.sign.slot, null);
  assert.deepEqual(saved.events.slice(0, legacy.events.length), legacy.events);
  assert.throws(() => restoreState({ ...legacy, sign: { slot: 'entrance-left' } }), /안내판 기록/);
});

test('only the observing NPC can receive FT51 reactions; unknown NPCs have no candidate', () => {
  const g = game(); g.seat(); g.sign();
  assert.equal(reactionFor(g.read().state, 'workshop-owner').selected, null);
  assert.equal(reactionFor(g.read().state, 'distant-npc').selected, null);
});
