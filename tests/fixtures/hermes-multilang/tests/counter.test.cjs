const test = require('node:test');
const assert = require('node:assert/strict');
const {completedCount} = require('../counter.js');
test('returns the completed fixture count', () => assert.equal(completedCount(), 1));
