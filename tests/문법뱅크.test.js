'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { 뱅크읽기 } = require('../tools/lib/문법뱅크.js');
test('independent grammar source preserves all authored values and order', () => {
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(뱅크읽기())).digest('hex'), 'fd86975275c4fcf5d16bd63b0da2db0f212cbc300a867662c48d5f1cc11a059c');
});
test('each read is isolated and malformed input fails before map generation', () => {
  const bank = 뱅크읽기(); bank.GRAMMAR_BANK[0][1] = 'changed';
  assert.notEqual(뱅크읽기().GRAMMAR_BANK[0][1], 'changed');
  const duplicate = 뱅크읽기(); duplicate.GRAMMAR_BANK.push(duplicate.GRAMMAR_BANK[0]);
  assert.throws(() => 뱅크읽기(duplicate), /규격/);
  assert.throws(() => 뱅크읽기('const GRAMMAR_BANK = [];'), SyntaxError);
});
