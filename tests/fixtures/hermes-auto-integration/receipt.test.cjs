'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {completedCount} = require('./receipt.cjs');
test('counts integrated receipts and excludes attention', () => {
  assert.equal(completedCount([{state:'integrated'}, {state:'needs_attention'}]), 1);
});
test('counts no_changes receipts as completed', () => {
  assert.equal(completedCount([{state:'no_changes'}]), 1);
});
test('excludes needs_attention receipts from completed count', () => {
  assert.equal(completedCount([{state:'needs_attention'}]), 0);
});
test('counts both completed states in mixed receipts', () => {
  assert.equal(completedCount([
    {state:'integrated'},
    {state:'no_changes'},
    {state:'needs_attention'},
  ]), 2);
});
