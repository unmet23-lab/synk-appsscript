'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const corpus = require('./fixtures/member-statement-v3-evaluation.json');
const followupCorpus = require('./fixtures/member-statement-v3-followup-evaluation.json');
const generalizationCorpus = require('./fixtures/member-statement-v3-generalization-evaluation.json');
const C = require('../experiences/synk-account/src/member-statement-contract.cjs');
const A = require('../experiences/synk-account/src/member-statement.cjs');
const { evaluateCorpus, scoreCase, summarize } = require('../tools/member-statement-evaluate.cjs');

test('semantic evaluation labels remain the independently frozen 112 synthetic sentences', () => {
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('./fixtures/member-statement-v3-evaluation.json'))).digest('hex'), 'aa66a93e63c11fba7766e2d2434f64a49805e325bf3b242ea5562d507737b7b0');
  assert.equal(corpus.cases.length, 112);
  assert.equal(new Set(corpus.cases.map(r => r.id)).size, 112);
  assert.equal(new Set(corpus.cases.map(r => r.text)).size, 112);
  assert.equal(corpus.cases.filter(r => r.split === 'development').length, 72);
  assert.equal(corpus.cases.filter(r => r.split === 'holdout').length, 40);
  for (const row of corpus.cases) {
    assert.ok(row.text.length <= C.MEMBER_STATEMENT_LIMITS.text, row.id);
    assert.ok(['direct', 'clarify', 'withhold'].includes(row.mode), row.id);
    if (row.mode === 'direct') assert.ok(row.expect.length > 0, row.id);
    else assert.deepEqual(row.expect, [], row.id);
  }
});

test('the evaluator counts the wrong condition as both a false positive and a missed meaning', () => {
  const row = { id: 'scorer', mode: 'direct', text: '원문', expect: [['support', 'example', 'prefer', 'first-try']] };
  const parsed = { meanings: [{ field: 'support', value: 'example', polarity: 'prefer', condition: null, evidence: { start: 0, end: 2, quote: '원문' } }], question: null };
  const result = scoreCase(row, parsed);
  assert.equal(result.truePositives.length, 0);
  assert.equal(result.falsePositives.length, 1);
  assert.equal(result.falseNegatives.length, 1);
  assert.equal(result.pass, false);
  const metrics = summarize([result]);
  assert.equal(metrics.precision, 0);
  assert.equal(metrics.recall, 0);
  assert.equal(metrics.safetyGatePass, false);
});

test('the additional 24 disclosed challenge sentences keep their original labels', () => {
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('./fixtures/member-statement-v3-followup-evaluation.json'))).digest('hex'), '7dfc873e30d3ca193212d70975560eea0edb9ebf12bc692f812374ca508c2e8e');
  assert.equal(followupCorpus.cases.length, 24);
});

test('the final 24 disclosed generalization sentences keep their original labels', () => {
  assert.equal(createHash('sha256').update(fs.readFileSync(require.resolve('./fixtures/member-statement-v3-generalization-evaluation.json'))).digest('hex'), '99297a00c910e5b7f3ad5b83e38287244fc143550253e46ea3f12ded054c1397');
  assert.equal(generalizationCorpus.cases.length, 24);
});

const split = process.env.SYNK_EVALUATION_SPLIT || 'all';
const evaluation = evaluateCorpus({ corpus, parse: C.parseMemberStatement, split });
const followupEvaluation = evaluateCorpus({ corpus: followupCorpus, parse: C.parseMemberStatement, split });
const generalizationEvaluation = evaluateCorpus({ corpus: generalizationCorpus, parse: C.parseMemberStatement, split });
const allRows = [...evaluation.cases, ...followupEvaluation.cases, ...generalizationEvaluation.cases];
for (const row of allRows) {
  test(`semantic corpus ${row.id} ${row.split}/${row.category}`, () => {
    assert.equal(row.parseError, null, row.parseError);
    assert.deepEqual(row.falsePositives, [], 'Unstated or incorrect meaning was proposed');
    assert.deepEqual(row.falseNegatives, [], 'Expected explicit meaning was missed');
    assert.equal(row.questionCorrect, true, 'Clarification/withholding policy differs');
    assert.equal(row.evidenceErrors, 0, 'Source span must exactly quote the input');
    assert.equal(row.safeQuestionOptions, true, 'Uncertainty must allow unsure and skip');
    assert.equal(row.skipSafe, true, 'Skipping clarification must not create a preference');
    assert.equal(row.pass, true);
  });
}

test('the directly understood corpus meanings survive explicit confirmation and Atlas replay unchanged', () => {
  const at = '2026-10-15T00:00:00.000Z';
  for (const [index, row] of allRows.filter(r => r.mode === 'direct').entries()) {
    const preview = A.previewMemberStatement({ text: row.text, at, asOf: at });
    assert.equal(preview.question, null, row.id);
    const statement = A.confirmMemberStatement({ preview, acceptedIds: preview.proposals.map(p => p.id),
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, at, text: row.text, clarifications: [] });
    assert.deepEqual(C.validateMemberStatement(statement), statement, row.id);
    const active = A.resolveMemberStatements([statement], at).entries.filter(e => e.active && e.verified)
      .map(e => [e.meaning.field, e.meaning.value, e.meaning.polarity, e.meaning.condition]);
    assert.deepEqual(active.map(JSON.stringify).sort(), row.expected.map(JSON.stringify).sort(), row.id);
  }
});
