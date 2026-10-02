import test from 'node:test';
import assert from 'node:assert/strict';
import { townWorkspace, townCommand } from './town-bridge.mjs';
const actor = id => ({ id, role: 'learner', mode: 'local-linked' });
const fixture = () => ({ mode: 'local-linked', synthetic: false, classes: [{ id: 'c', learnerIds: ['a', 'b'] }],
  learners: ['a', 'b'].map(id => ({ id, classId: 'c', connectedAt: '2026-10-02', sharing: { enabled: true, revision: 2 }, evidence: [], events: [] })) });
const command = (s, id, type, payload = {}) => townCommand(s, actor(id), { id: crypto.randomUUID(), type, payload,
  expectedRevision: townWorkspace(s, actor(id)).state.revision, sharingRevision: 2 });
test('Town life belongs to one connected learner; it creates no language evidence', () => {
  const s = fixture(); command(s, 'a', 'CHOOSE', { branch: 'inside' }); command(s, 'a', 'NEXT'); command(s, 'a', 'PLACE', { slot: 'eaves-left' });
  const a = townWorkspace(s, actor('a')), b = townWorkspace(s, actor('b'));
  assert.equal(a.state.placement, 'eaves-left'); assert.equal(b.state.phase, 'choose');
  assert.ok(a.state.events.length > 0); assert.ok(a.state.events.every(e => e.scope.subject === 'linked-a'));
  assert.equal(s.learners[0].evidence.length, 0); assert.equal(s.learners[0].events.length, 0);
});
test('reset preserves the owner and never resets another learner', () => {
  const s = fixture(); command(s, 'a', 'CHOOSE', { branch: 'inside' }); command(s, 'b', 'CHOOSE', { branch: 'outside' });
  command(s, 'a', 'RESET'); assert.equal(townWorkspace(s, actor('a')).state.scope.subject, 'linked-a');
  assert.equal(townWorkspace(s, actor('b')).state.branch, 'outside');
});
test('teacher, unlinked, revoked, disabled, removed-class and production actors fail closed', () => {
  for (const change of [s => s.synthetic = true, s => s.mode = 'production', s => s.learners[0].revoked = true,
    s => s.learners[0].sharing.enabled = false, s => s.learners[0].connectedAt = null, s => s.classes[0].learnerIds = ['b']]) {
    const s = fixture(); change(s); assert.throws(() => townWorkspace(s, actor('a')));
  }
  assert.throws(() => townWorkspace(fixture(), { ...actor('a'), role: 'teacher' }));
  assert.throws(() => townWorkspace(fixture(), actor('missing')));
});
test('stale consent revision, copied owner and foreign life event are rejected without mutation', () => {
  const s = fixture(); command(s, 'a', 'CHOOSE', { branch: 'inside' });
  const before = structuredClone(s);
  assert.throws(() => townCommand(s, actor('a'), { id: 'stale', type: 'NEXT', expectedRevision: 1, sharingRevision: 1 }), /연결 상태/);
  assert.deepEqual(s, before); s.learners[1].town = structuredClone(s.learners[0].town);
  assert.throws(() => townWorkspace(s, actor('b')), /다른 학생/);
  command(s, 'a', 'NEXT'); command(s, 'a', 'PLACE', { slot: 'eaves-left' }); s.learners[0].town.state.events[0].scope.subject = 'linked-b';
  assert.throws(() => townWorkspace(s, actor('a')), /다른 사람/);
});
test('same command is idempotent within the same learner only', () => {
  const s = fixture(), c = { id: 'retry-command', type: 'CHOOSE', payload: { branch: 'inside' }, expectedRevision: 0, sharingRevision: 2 };
  townCommand(s, actor('a'), c); assert.equal(townCommand(s, actor('a'), c).duplicate, true);
  assert.equal(townCommand(s, actor('b'), c).duplicate, false);
});
