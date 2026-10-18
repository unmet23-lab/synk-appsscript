'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {completedCount} = require('./receipt.cjs');
test('counts integrated receipts and excludes attention', () => {
  assert.equal(completedCount([{state:'integrated'}, {state:'needs_attention'}]), 1);
});
