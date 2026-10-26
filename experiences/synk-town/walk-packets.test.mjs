import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalkPackets } from './walk-packets.mjs';

const host = (headingX, headingZ) => ({ x: -7.5, z: -13.5, headingX, headingZ });

test('a fresh host pose updates facing even after this window has a position', () => {
  const walk = createWalkPackets();
  walk.reconcile(host(0, 1));
  walk.reconcile(host(1, 0));
  assert.equal(walk.pose().heading, Math.PI / 2);
  walk.reconcile(host(0, -1));
  assert.equal(walk.pose().heading, Math.PI);
});

test('unreceipted movement overrides host facing until the packet is settled', () => {
  const walk = createWalkPackets();
  walk.reconcile(host(0, 1));
  walk.step(0, { x: 1, z: 0 });
  walk.step(50, { x: 1, z: 0 });
  walk.take(50);
  walk.step(100, { x: -1, z: 0 });
  walk.reconcile(host(0, -1));
  assert.equal(walk.pose().heading, -Math.PI / 2);
  walk.halt();
  walk.reconcile(host(0, -1));
  assert.equal(walk.pose().heading, Math.PI / 2);
  walk.settle();
  walk.reconcile(host(0, -1));
  assert.equal(walk.pose().heading, Math.PI);
});

test('standing-up zero steps preserve the host facing', () => {
  const walk = createWalkPackets();
  walk.reconcile(host(1, 0));
  walk.zeroStep();
  walk.reconcile(host(0, -1));
  assert.equal(walk.pose().heading, Math.PI);
});
