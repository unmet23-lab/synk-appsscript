import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initialState, reduceCommand, snapshot, reactionFor } from './core.mjs';
import { createStore } from './server.mjs';

function game(store = createStore()) {
  let seq = 0;
  return { store, read: () => store.read(),
    command: (type, payload = {}) => ({ id: `test-${++seq}`, type, payload, expectedRevision: store.read().state.revision }),
    send(type, payload = {}) { return store.execute(this.command(type, payload)); },
    inside() { this.send('CHOOSE', { branch: 'inside' }); this.send('NEXT'); return this.send('PLACE', { slot: 'eaves-left' }); },
    outside() {
      this.send('CHOOSE', { branch: 'outside' }); this.send('NEXT'); this.send('COLOR', { color: 'yellow' });
      this.send('CRAFT'); return this.send('PLACE', { slot: 'garden' });
    },
    ack(extra = {}) {
      const { state, view } = this.read();
      return this.send('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey,
        worldRevision: state.worldRevision, mode: 'motion', visible: true, assetsReady: true,
        appliedStepIds: view.committedStepIds, ...extra });
    },
  };
}
test('inside has no material requirement; actual guest and tea facts precede presentation', () => {
  const g = game(); const { state, view } = g.inside();
  assert.deepEqual(state.inventory, { wood: 0, cloth: 0, canopy: 0 });
  assert.equal(state.materialsGranted, false); assert.equal(state.served, true); assert.equal(state.delivered, false);
  assert.equal(view.line, '옮긴 의자예요');
  assert.deepEqual(state.events.filter(e => e.type === 'life.fact').map(e => e.factType),
    ['seat.placed', 'guest.arrived', 'seat.used', 'tea.served', 'FT10.inside.completed']);
  assert.deepEqual(view.committedStepIds, ['guest-walk', 'guest-sit', 'owner-serve', 'tea-place']);
  assert.equal(view.engine.learningEffectClaim, false);
  assert.ok(state.events.every(e => !e.type.startsWith('practice.')));
});
test('canopy crafting is atomic and same command retry does not spend twice', () => {
  const g = game(); g.send('CHOOSE', { branch: 'outside' }); g.send('NEXT'); g.send('COLOR', { color: 'yellow' });
  const command = g.command('CRAFT'); const one = g.store.execute(command); const two = g.store.execute(command);
  assert.deepEqual(two.state, one.state); assert.equal(two.duplicate, true);
  assert.deepEqual(one.state.inventory, { wood: 0, cloth: 0, canopy: 1 });
  assert.throws(() => g.store.execute({ ...command, payload: { changed: true } }), /같은 요청/);
  assert.throws(() => g.send('CRAFT'), /지금 할 수/);
});
test('preview/cancel/invalid path never spend or move a committed seat', () => {
  const g = game(); g.outside(); g.ack(); g.send('REARRANGE');
  g.send('CHOOSE', { branch: 'outside' }); g.send('NEXT');
  const before = g.read().state;
  assert.throws(() => g.send('PLACE', { slot: 'path' }), /여기는 길/);
  assert.deepEqual(g.read().state, before);
  g.send('PREVIEW_SLOT', { slot: 'garden-right' }); assert.equal(g.read().state.placement, 'garden');
  g.send('CANCEL'); assert.equal(g.read().state.placement, 'garden');
  assert.equal(g.read().state.inventory.canopy, 0);
});
test('moving between inside and outside preserves one owned canopy and one fixed chair', () => {
  const g = game(); g.outside(); g.ack();
  g.send('REARRANGE'); g.send('CHOOSE', { branch: 'inside' }); g.send('NEXT'); g.send('PLACE', { slot: 'eaves-right' });
  assert.equal(g.read().state.inventory.canopy, 1); assert.equal(g.read().view.scene.canopyPlaced, false);
  g.ack(); g.send('REARRANGE'); g.send('CHOOSE', { branch: 'outside' }); g.send('NEXT'); g.send('PLACE', { slot: 'garden-right' });
  assert.equal(g.read().state.inventory.canopy, 0); assert.equal(g.read().view.line, '이 자리에 앉아요');
  assert.equal(g.read().view.plan.steps.find(step => step.id === 'owner-serve').to.x, 90);
  assert.equal(g.read().view.plan.steps.find(step => step.id === 'tea-place').from.x, 90);
  assert.equal(g.read().state.events.filter(e => e.factType === 'canopy.crafted').length, 1);
});
test('leaving while crafting or placing resumes its saved phase and preview without consumption', () => {
  const g = game(); g.send('CHOOSE', { branch: 'outside' }); g.send('NEXT'); g.send('COLOR', { color: 'yellow' });
  g.send('LEAVE'); g.send('VISIT'); assert.equal(g.read().state.phase, 'color');
  g.send('CRAFT'); g.send('PREVIEW_SLOT', { slot: 'garden-right' }); g.send('LEAVE'); g.send('VISIT');
  assert.equal(g.read().state.phase, 'place'); assert.equal(g.read().state.previewSlot, 'garden-right');
  assert.equal(g.read().state.inventory.canopy, 1);
  g.send('PLACE', { slot: 'garden-right' }); assert.equal(g.read().state.color, 'yellow');
});
test('unseen scene resumes its original confirmed use; a normal revisit makes one new daily use', () => {
  const g = game(); const before = g.inside().state;
  g.send('LEAVE'); g.send('VISIT');
  assert.equal(g.read().state.currentUseId, before.currentUseId);
  assert.equal(g.read().state.events.filter(e => e.factType === 'tea.served').length, 1);
  assert.throws(() => g.send('VISIT'), /지금 할 수/);
  g.ack(); g.send('LEAVE'); g.send('VISIT');
  assert.equal(g.read().view.line, '이 자리에 앉아요');
  assert.equal(g.read().state.events.filter(e => e.factType === 'tea.served').length, 2);
});
test('removal cancels stale reaction but preserves achievement and inventory, re-placement never thanks twice', () => {
  const g = game(); g.outside(); const old = g.read();
  g.ack(); g.send('REMOVE');
  assert.equal(g.read().view.reaction, null); assert.equal(g.read().view.scene.canopyPlaced, false);
  assert.deepEqual(g.read().state.achievements, ['작은 지붕을 만들었어요.']);
  assert.equal(g.read().state.inventory.canopy, 1);
  g.send('CHOOSE', { branch: 'outside' }); g.send('NEXT'); g.send('PLACE', { slot: 'garden-right' });
  assert.equal(g.read().view.line, '이 자리에 앉아요');
  assert.equal(g.read().state.events.filter(e => e.factType === 'materials.granted').length, 1);
  assert.deepEqual(g.read().state.inventory, { wood: 0, cloth: 0, canopy: 0 });
  assert.throws(() => g.send('ACK', { reactionId: old.view.reaction.id, semanticKey: old.view.reaction.semanticKey,
    worldRevision: old.state.worldRevision, mode: 'motion', visible: true, assetsReady: true, appliedStepIds: old.view.committedStepIds }), /지금 자리/);
});
test('hidden, paused, asset-missing and partial presentation cannot create a delivery receipt', () => {
  const g = game(); g.inside();
  for (const extra of [{ hidden: true }, { paused: true }, { visible: false }, { assetsReady: false }, { appliedStepIds: ['guest-walk'] }]) {
    assert.throws(() => g.ack(extra), /장면이 보인/);
    assert.equal(g.read().state.delivered, false);
  }
  g.ack({ mode: 'static' }); assert.equal(g.read().state.delivered, true);
  assert.equal(g.read().state.events.filter(e => e.type === 'life.delivered').length, 1);
});
test('only witnesses know facts; another NPC cannot borrow the cafe reaction', () => {
  const g = game(); g.inside();
  assert.equal(reactionFor(g.read().state, 'distant-npc').selected, null);
  assert.equal(reactionFor(g.read().state, 'workshop-owner').selected, null);
});
test('stale concurrent commands fail before any event or inventory changes', () => {
  const g = game(); const stale = g.command('CHOOSE', { branch: 'outside' }); g.send('CHOOSE', { branch: 'inside' });
  const before = g.read(); assert.throws(() => g.store.execute(stale), /다른 창/); assert.deepEqual(g.read(), before);
});
test('failed storage never publishes a result and a retry remains exactly once', () => {
  let fail = true, saved;
  const g = game(createStore({ save(next) { if (fail) throw new Error('disk full'); saved = structuredClone(next); } }));
  const command = g.command('CHOOSE', { branch: 'outside' });
  assert.throws(() => g.store.execute(command), /저장하지 못/); assert.equal(g.read().state.revision, 0);
  fail = false; g.store.execute(command); g.store.execute(command);
  assert.deepEqual(saved.inventory, { wood: 2, cloth: 1, canopy: 0 });
});
test('server restart restores owned canopy and pending delivery; corrupt save is preserved and blocked', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-test-'));
  const file = path.join(dir, 'save.json');
  try {
    const g = game(createStore({ file })); g.outside();
    const restored = createStore({ file }).read(); assert.deepEqual(restored, g.read());
    fs.writeFileSync(file, '{broken');
    assert.throws(() => createStore({ file }).read(), /저장 기록/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('reset is explicit and rejects stale action while isolating fixture scope from student learning', () => {
  const g = game(); g.outside(); const stale = g.command('REMOVE'); g.send('RESET');
  assert.throws(() => g.store.execute(stale), /다른 창/);
  assert.equal(g.read().state.phase, 'choose'); assert.equal(g.read().state.events.length, 0);
  assert.equal(g.read().state.scope.subject, 'preview-local');
  const foreign = { ...initialState(), scope: { domain: 'LAB', workspace: 'synk-town', subject: 'real-student' } };
  assert.throws(() => snapshot(foreign), /체험 기록/);
});
