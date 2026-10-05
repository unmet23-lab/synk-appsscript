import test from 'node:test';
import assert from 'node:assert/strict';
import { measureFidelity } from '../tools/probe-atlas-consultation-fidelity.mjs';

// Synthetic, seeded answer sets only. This guards the question policy against its own
// product rules; it says nothing about real users or whether the hardware advice is right.
test('when the consultation stops asking, its advice rarely differs from the fully answered advice', () => {
  const report = measureFidelity({ samples: 150, seed: 20261006 }), value = report.policies.value;
  // 2026-10-06: counting only "would still run" as enough left 11.5% of random answer sets
  // with different, mostly lower-memory advice. The bound leaves room for rule changes.
  assert.ok(value.rate <= 0.05, `advice differed in ${value.adviceDiffersFromFullAnswers} of ${report.samples} answer sets`);
  assert.ok(value.meanQuestionsAsked < report.meanEligibleQuestions - 1, 'the policy still asks clearly fewer questions than asking everything');
  // Declared value may order and trim questions; it must not be far behind plain decision change.
  assert.ok(value.adviceDiffersFromFullAnswers <= report.policies.impact.adviceDiffersFromFullAnswers + Math.ceil(report.samples * 0.03));
});

test('the measurement is reproducible and refuses unusable arguments', () => {
  assert.deepEqual(measureFidelity({ samples: 20, seed: 7 }), measureFidelity({ samples: 20, seed: 7 }));
  for (const input of [{ samples: 0 }, { samples: 1.5 }, { samples: 100001 }, { seed: 0.5 }]) assert.throws(() => measureFidelity(input), /usage/);
});
