'use strict';
// Disclosed development sentences are regression coverage, not an unseen score.
// Labels and bytes were fixed before the first ko4 baseline execution.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { scoreCase } = require('../tools/member-statement-evaluate.cjs');
const { parseMemberStatement } = require('../experiences/synk-account/src/member-statement-contract.cjs');

const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/member-statement-v5-development-evaluation.json'));
const corpus = JSON.parse(bytes);
const fixedSHA256 = '23b68aae999723def6a0c77e64deae57ae5bb1db45dd6fba48149d3859e2afab';

test('ko5 development regression retains the pre-labelled fixture bytes', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fixedSHA256);
  assert.equal(corpus.cases.length, 60);
  assert.equal(corpus.cases.filter(row => row.mode === 'direct').length, 40);
  assert.equal(corpus.cases.filter(row => row.mode !== 'direct').length, 20);
  assert.equal(new Set(corpus.cases.map(row => row.id)).size, 60);
});

for (const row of corpus.cases) {
  test(`ko5 disclosed development regression ${row.id}: ${row.category}`, () => {
    const parsed = parseMemberStatement(row.text);
    const skipResult = parsed.question
      ? parseMemberStatement(row.text, { clarifications: [{ questionId: parsed.question.id, optionId: 'skip' }] })
      : null;
    const scored = scoreCase(row, parsed, { skipResult });
    assert.equal(scored.pass, true, JSON.stringify(scored, null, 2));
  });
}

// This former sealed80 corpus was disclosed after its first score of 26/80
// (direct 6/60). Any later success here is regression coverage only.
const disclosedBytes = fs.readFileSync(path.join(__dirname, 'fixtures/member-statement-v5-disclosed-evaluation.json'));
const disclosed = JSON.parse(disclosedBytes);
test('ko5 disclosed regression retains the original sealed80 bytes', () => {
  assert.equal(createHash('sha256').update(disclosedBytes).digest('hex'), '97a1c8942e9833b9fa0d15d462ada21a0c834d9d70777cd4616dd156d6d9edbe');
  assert.equal(disclosed.cases.length, 80);
  assert.equal(disclosed.cases.filter(row => row.mode === 'direct').length, 60);
  assert.equal(disclosed.cases.filter(row => row.mode !== 'direct').length, 20);
  assert.equal(new Set(disclosed.cases.map(row => row.id)).size, 80);
});

for (const row of disclosed.cases) {
  test(`ko5 disclosed former sealed80 regression ${row.id}: ${row.category}`, () => {
    const parsed = parseMemberStatement(row.text);
    const skipResult = parsed.question
      ? parseMemberStatement(row.text, { clarifications: [{ questionId: parsed.question.id, optionId: 'skip' }] })
      : null;
    const scored = scoreCase(row, parsed, { skipResult });
    assert.equal(scored.pass, true, JSON.stringify(scored, null, 2));
  });
}
