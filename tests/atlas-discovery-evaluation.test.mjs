import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { evaluateDiscovery, DISCOVERY_EVALUATION_SCENARIOS } from '../experiences/atlas-lab/discovery-evaluation.mjs';
const report = evaluateDiscovery({ Domain, Ask, Personalization });

test('fixed authored synthetic evaluation compares ordering while sharing reciprocal eligibility', () => {
  assert.equal(report.synthetic, true); assert.equal(report.authored, true); assert.equal(report.cases.length, 12);
  assert.equal(report.summary.comparableCases, 12); assert.equal(report.summary.atlas.authoredPriorityPassed, 12);
  assert.equal(report.summary.baseline.eligibilityPassed, 12); assert.equal(report.summary.atlas.eligibilityPassed, 12);
  assert.equal(report.summary.baseline.selectedIneligible, 0); assert.equal(report.summary.atlas.selectedIneligible, 0);
  assert.equal(report.summary.baseline.authoredPriorityPassed, 7);
  for (const row of report.cases) assert.deepEqual(row.baseline.eligibleIds, row.atlas.eligibleIds);
});

test('fixture priorities are independent declared expectations, including ties, mandatory unknowns and consent withdrawal', () => {
  const find = id => report.cases.find(item => item.id === id);
  assert.deepEqual(find('listen').expected.acceptableTopIds, ['candidate-2']); assert.equal(find('listen').baseline.topCandidateId, 'candidate-1');
  assert.deepEqual(find('equal-rank').expected.acceptableTopIds, ['candidate-1', 'candidate-3']);
  for (const id of ['hard-unknown', 'consent-missing', 'consent-withdrawn']) {
    assert.deepEqual(find(id).expected.eligibleIds, []); assert.equal(find(id).atlas.topCandidateId, null); assert.equal(find(id).baseline.topCandidateId, null);
  }
  for (const row of report.cases) assert.equal(row.atlas.eligibleIds.includes('candidate-4'), false, 'reciprocal must-have cannot be traded for own preference');
  assert.ok(Object.isFrozen(DISCOVERY_EVALUATION_SCENARIOS[0].acceptableTopIds));
});

test('evaluation uses existing Core Domain, Ask and preferences and makes no network calls', () => {
  let decisions = 0, questions = 0, projections = 0;
  const beforeFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('network must not be used'); };
  try {
    const again = evaluateDiscovery({ Domain: { ...Domain, decide: input => { decisions++; return Domain.decide(input); } },
      Ask: { ...Ask, choose: input => { questions++; return Ask.choose(input); } },
      Personalization: { ...Personalization, preferences: { ...Personalization.preferences, layers: input => { projections++; return Personalization.preferences.layers(input); } } } });
    assert.deepEqual(again, report); assert.ok(decisions > 0); assert.ok(questions > 0); assert.ok(projections > 0);
  } finally { globalThis.fetch = beforeFetch; }
});

test('evaluation labels its synthetic policy scope and makes no satisfaction or real relationship claim', () => {
  assert.equal(report.scope, 'fixed-synthetic-policy-ordering');
  assert.match(report.limitations.join(' '), /사용자 만족도는 검증하지/);
  assert.match(report.limitations.join(' '), /질문 부담/);
  assert.equal('accuracy' in report.summary, false); assert.equal('successProbability' in report.summary, false);
});
