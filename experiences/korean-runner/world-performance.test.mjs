import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameBudget, renderPixelRatio } from './world.mjs';

test('Retina and large displays stay inside the 3D pixel budget without changing CSS size', () => {
  for (const [width, height, dpr] of [[390, 620, 3], [1180, 660, 2], [1440, 740, 2], [3840, 2160, 2], [1180, 660, 0.8]]) {
    const ratio = renderPixelRatio(width, height, dpr);
    assert.ok(ratio <= 1.5 && ratio <= dpr);
    assert.ok(Math.floor(width * ratio) * Math.floor(height * ratio) <= 1600000);
  }
  assert.equal(renderPixelRatio(1180, 660, 1), 1);
  assert.equal(renderPixelRatio(390, 620, 3), 1.5);
});

const sample = (budget, frames, ms) => { let changes = 0; for (let i = 0; i < frames; i++) if (budget.sample(ms)) changes++; return changes; };

test('sustained slow rendering lowers the buffer without changing game time', () => {
  const budget = createFrameBudget();
  assert.equal(sample(budget, 59, 34), 1);
  assert.equal(budget.scale, 0.85);
  assert.equal(sample(budget, 118, 34), 2);
  assert.equal(budget.scale, 0.6);
  assert.equal(sample(budget, 240, 50), 0);
  assert.equal(budget.scale, 0.6);
});

test('one hitch does not lower quality; recovery requires eight seconds of smooth rendering', () => {
  const budget = createFrameBudget();
  sample(budget, 60, 16.7);
  budget.sample(200);
  sample(budget, 60, 16.7);
  assert.equal(budget.scale, 1);
  budget.reset();
  sample(budget, 60, 34);
  assert.equal(budget.scale, 0.85);
  budget.reset();
  assert.equal(sample(budget, 479, 16.7), 0);
  assert.equal(sample(budget, 1, 16.7), 1);
  assert.equal(budget.scale, 1);
});

test('hidden time and pauses cannot be mistaken for sustained slow rendering', () => {
  const budget = createFrameBudget();
  sample(budget, 50, 34);
  budget.reset();
  sample(budget, 5, 34);
  budget.sample(10000);
  sample(budget, 120, 16.7);
  assert.equal(budget.scale, 1);
  for (const invalid of [NaN, Infinity, -1, 0]) assert.equal(budget.sample(invalid), false);
});
