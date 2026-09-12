'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planEvidencePreserving: plan, LIMITS } = require('./observation-planner.cjs');
const target = (id, blockers, purpose = 'original-performance', epoch = 'e0') => ({ id, epoch, purpose, blockers: blockers.map(id => ({ id, code: id })) });
const action = (id, resolves, costUnits = 1, extra = {}) => ({ id, title: id, costUnits, resolves, ...extra });

// Test oracle deliberately enumerates ALL subsets by integer mask, validates
// dependencies afterwards and counts strings in sets. It does not use the
// implementation's reachable-state queue, coverage bitset or internal helpers.
function oracle(targets, actions, budget, maxDepth) {
  let best = null;
  const sorted = [...actions].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (let mask = 0; mask < 2 ** sorted.length; mask++) {
    const selected = sorted.filter((_, index) => Math.floor(mask / (2 ** index)) % 2 === 1);
    if (selected.length > maxDepth || selected.some(a => a.available === false)) continue;
    const cost = selected.reduce((sum, a) => sum + a.costUnits, 0);
    if (cost > budget) continue;
    const ids = selected.map(a => a.id);
    const done = new Set();
    for (let pass = 0; pass < selected.length; pass++) {
      for (const a of selected) if ((a.requires || []).every(id => done.has(id))) done.add(a.id);
    }
    if (done.size !== selected.length) continue;
    function safe(a, seen = new Set()) {
      if (seen.has(a.id) || a.exposesAnswer || a.createsEpoch || a.eligibleForOriginal === false) return false;
      return (a.requires || []).every(id => {
        const dependency = selected.find(row => row.id === id);
        return dependency && safe(dependency, new Set([...seen, a.id]));
      });
    }
    let complete = 0, covered = 0;
    for (const t of targets) {
      const resolved = new Set(selected.filter(a => t.purpose !== 'original-performance' || safe(a)).flatMap(a => a.resolves));
      const blockerIds = [...new Set(t.blockers.map(b => b.id))];
      covered += blockerIds.filter(id => resolved.has(id)).length;
      if (blockerIds.every(id => resolved.has(id))) complete++;
    }
    const candidate = { selectedActionIds: ids, score: { fullyQualifiedTargets: complete, coveredBlockers: covered, costUnits: cost, actionCount: selected.length } };
    const rank = row => [-row.score.fullyQualifiedTargets, -row.score.coveredBlockers, row.score.costUnits, row.score.actionCount, JSON.stringify(row.selectedActionIds)];
    if (!best) best = candidate;
    else {
      const left = rank(candidate), right = rank(best);
      const different = left.findIndex((value, index) => value !== right[index]);
      if (different !== -1 && left[different] < right[different]) best = candidate;
    }
  }
  return best;
}

test('combines separate blockers so original evidence only conditionally qualifies after both', () => {
  const result = plan({ targets: [target('object', ['transcript', 'help-time'])], actions: [action('listen', ['transcript'], 3), action('time', ['help-time'], 2)] });
  assert.deepEqual(result.selectedActionIds, ['listen', 'time']);
  assert.deepEqual(result.score, { fullyQualifiedTargets: 1, coveredBlockers: 2, costUnits: 5, actionCount: 2 });
  assert.equal(result.projectedQualification.hypothetical, true);
  assert.equal(result.projectedQualification.observed, false);
  assert.equal(result.projectedQualification.assumption, 'all-declared-blockers-cleared-by-supporting-observations');
  assert.equal(result.projectedQualification.inspectionAloneIsInsufficient, true);
  assert.equal(result.actualEvidenceChanged, false);
  assert.equal(result.executionPolicy, 'execute-one-observe-replan');
  assert.deepEqual(result.steps[1].conditionalOn, ['listen']);
});

test('complete-target priority beats greedy blocker count per cost', () => {
  const targets = [target('small', ['a', 'b']), target('large', ['c', 'd', 'e', 'f'])];
  const actions = [action('greedy-three', ['c', 'd', 'e'], 2), action('complete-a', ['a'], 1), action('complete-b', ['b'], 1)];
  const result = plan({ targets, actions, budget: 2 });
  assert.deepEqual(result.selectedActionIds, ['complete-a', 'complete-b']);
  assert.deepEqual(result.score, oracle(targets, actions, 2, 8).score);
});

test('overlapping observations are charged once and can qualify multiple targets', () => {
  const result = plan({ targets: [target('object', ['time', 'scope']), target('past', ['time'])], actions: [action('time', ['time'], 2), action('scope', ['scope'], 1)] });
  assert.equal(result.score.fullyQualifiedTargets, 2);
  assert.equal(result.score.coveredBlockers, 3);
  assert.equal(result.score.costUnits, 3);
  assert.equal(result.steps.find(step => step.actionId === 'time').projectedResolves.length, 2);
});

test('answer disclosure, new performance and explicit exclusion never repair original qualifications', () => {
  for (const extra of [{ exposesAnswer: true }, { createsEpoch: true }, { eligibleForOriginal: false }]) {
    const result = plan({ targets: [target('original', ['missing'])], actions: [action('teach-and-answer', ['missing'], 0, extra)] });
    assert.deepEqual(result.selectedActionIds, []);
    assert.equal(result.score.fullyQualifiedTargets, 0);
    assert.equal(result.rejectedActions[0].reason, 'original-evidence-ineligible');
    assert.deepEqual(result.unresolved[0].blockerIds, ['missing']);
  }
});

test('same declared blocker can be solved for a new response without retroactive original repair', () => {
  const result = plan({ targets: [target('original', ['audio']), target('new-response', ['audio'], 'response-performance', 'e1')], actions: [action('respond', ['audio'], 1, { createsEpoch: true })] });
  assert.deepEqual(result.selectedActionIds, ['respond']);
  assert.deepEqual(result.projectedQualification.qualifiedTargetIds, ['new-response']);
  assert.deepEqual(result.steps[0].projectedResolves, [{ targetId: 'new-response', blockerId: 'audio' }]);
});

test('dependencies are included, costed and ordered before dependent observations', () => {
  const result = plan({ targets: [target('original', ['scope'])], actions: [action('a-review', ['scope'], 2, { requires: ['z-open'] }), action('z-open', [], 1)] });
  assert.deepEqual(result.selectedActionIds, ['a-review', 'z-open']);
  assert.deepEqual(result.steps.map(step => step.actionId), ['z-open', 'a-review']);
  assert.equal(result.score.costUnits, 3);
  assert.equal(plan({ targets: [target('original', ['scope'])], actions: [action('review', ['scope'], 2, { requires: ['open'] }), action('open', [], 1)], budget: 2 }).score.fullyQualifiedTargets, 0);
});

test('unsafe prerequisites cannot launder a later action into original evidence', () => {
  const result = plan({ targets: [target('original', ['scope'])], actions: [action('read-answer', [], 0, { exposesAnswer: true }), action('repeat', ['scope'], 1, { requires: ['read-answer'] })] });
  assert.deepEqual(result.selectedActionIds, []);
  assert.equal(result.rejectedActions.find(row => row.actionId === 'repeat').reason, 'original-evidence-ineligible');
});

test('cycles, missing dependencies and unavailable ancestors are rejected without looping', () => {
  const result = plan({ targets: [target('original', ['x'])], actions: [
    action('a', ['x'], 1, { requires: ['b'] }), action('b', [], 1, { requires: ['a'] }),
    action('missing', ['x'], 1, { requires: ['absent'] }), action('offline', [], 1, { available: false }),
    action('requires-offline', ['x'], 1, { requires: ['offline'] }),
  ] });
  assert.deepEqual(result.selectedActionIds, []);
  assert.equal(result.rejectedActions.find(row => row.actionId === 'a').reason, 'dependency-cycle');
  assert.equal(result.rejectedActions.find(row => row.actionId === 'missing').reason, 'missing-dependency');
  assert.equal(result.rejectedActions.find(row => row.actionId === 'requires-offline').reason, 'unavailable-dependency');
});

test('no-response leaves source inputs and blockers intact and supports replanning', () => {
  const input = { targets: [target('original', ['transcript', 'time'])], actions: [action('listen', ['transcript']), action('time', ['time'])] };
  const before = JSON.stringify(input);
  const first = plan(input);
  assert.equal(JSON.stringify(input), before);
  const second = plan({ ...input, actions: input.actions.map(a => ({ ...a, available: a.id !== first.nextActionId })) });
  assert.equal(second.score.fullyQualifiedTargets, 0);
  assert.equal(second.unresolved[0].blockerIds.length, 1);
  assert.equal(second.projectedQualification.observed, false);
});

test('contrary observations are not promoted by the plan and require external reevaluation', () => {
  const input = { targets: [target('original', ['help-time'])], actions: [action('inspect-time', ['help-time'])] };
  const before = JSON.stringify(input);
  const result = plan(input);
  assert.equal(result.projectedQualification.targets[0].wouldQualify, true);
  assert.equal(result.projectedQualification.requiresSupportingOutcomes, true);
  assert.equal(result.projectedQualification.inspectionAloneIsInsufficient, true);
  // A later confirmed 'help before performance' is contradictory evidence, not
  // the supporting outcome assumed here. Only the engine can apply that event.
  assert.equal(result.actualEvidenceChanged, false);
  assert.equal(JSON.stringify(input), before);
  assert.equal(input.targets[0].blockers[0].id, 'help-time');
});

test('input and action permutation do not change selected actions or step ordering', () => {
  const targets = [target('two', ['c', 'a']), target('one', ['b'])];
  const actions = [action('z', ['a', 'b'], 2), action('a', ['c'], 1), action('b', ['a'], 1), action('c', ['b'], 1)];
  const first = plan({ targets, actions, budget: 3 });
  const second = plan({ targets: [...targets].reverse().map(t => ({ ...t, blockers: [...t.blockers].reverse() })), actions: [...actions].reverse(), budget: 3 });
  assert.deepEqual(first, second);
});

test('bounded result is feasible and explicitly not optimal after state cap', () => {
  const result = plan({ targets: [target('all', ['a', 'b', 'c'])], actions: [action('a', ['a']), action('b', ['b']), action('c', ['c'])], maxStates: 2 });
  assert.equal(result.optimalWithinBounds, false);
  assert.equal(result.truncationReason, 'state-limit-exceeded');
  assert.ok(result.discoveredStates <= 2);
  assert.ok(result.score.costUnits <= result.bounds.budget);
  assert.deepEqual(result.selectedActionIds, ['a']);
});

test('depth and budget are explicit optimization bounds, not complete-goal claims', () => {
  const result = plan({ targets: [target('all', ['a', 'b'])], actions: [action('a', ['a']), action('b', ['b'])], maxDepth: 1 });
  assert.equal(result.optimalWithinBounds, true);
  assert.equal(result.score.fullyQualifiedTargets, 0);
  assert.equal(result.bounds.maxDepth, 1);
  assert.equal(result.unresolved[0].blockerIds.length, 1);
});

test('empty, impossible and already unblocked targets have honest results', () => {
  assert.deepEqual(plan().selectedActionIds, []);
  assert.equal(plan().optimalWithinBounds, true);
  const impossible = plan({ targets: [target('original', ['unobserved'])] });
  assert.equal(impossible.projectedQualification.newlyQualifiedTargetCount, 0);
  assert.deepEqual(impossible.unresolved[0].blockerIds, ['unobserved']);
  const clear = plan({ targets: [target('clear', [])], actions: [action('irrelevant', ['x'], 0)] });
  assert.equal(clear.score.fullyQualifiedTargets, 1);
  assert.equal(clear.projectedQualification.newlyQualifiedTargetCount, 0);
  assert.deepEqual(clear.selectedActionIds, []);
});

test('oversized inputs return an explicit unevaluated result without optimistic qualification', () => {
  const result = plan({ actions: Array(LIMITS.actions + 1).fill(null) });
  assert.equal(result.truncationReason, 'input-limit-exceeded');
  assert.equal(result.inputNotEvaluated, true);
  assert.equal(result.optimalWithinBounds, false);
  assert.equal(result.projectedQualification.inputFullyEvaluated, false);
  assert.equal(result.projectedQualification.allTargetsConditionallyQualified, false);
  const blockers = Array(LIMITS.blockers + 1).fill({ id: 'same' });
  assert.equal(plan({ targets: [{ id: 'large', epoch: 'e0', purpose: 'original-performance', blockers }] }).truncationReason, 'blocker-limit-exceeded');
});

test('malformed or ambiguous identifiers, costs and flags are rejected', () => {
  assert.throws(() => plan({ targets: [target('duplicate', []), target('duplicate', [])] }), /duplicate target/);
  assert.throws(() => plan({ actions: [action('duplicate', []), action('duplicate', [])] }), /duplicate action/);
  assert.throws(() => plan({ actions: [action('negative', [], -1)] }), /costUnits/);
  assert.throws(() => plan({ actions: [action('nan', [], NaN)] }), /costUnits/);
  assert.throws(() => plan({ actions: [action('flag', [], 1, { exposesAnswer: 'false' })] }), /must be boolean/);
  assert.throws(() => plan({ maxStates: 0 }), /maxStates/);
  assert.throws(() => plan({ budget: Infinity }), /budget/);
  assert.throws(() => plan({ targets: [target('typo', ['x'], 'original-performnce')] }), /unsupported target purpose/);
});

test('independent exhaustive oracle agrees across 80 varied small conditional plans', () => {
  let seed = 1729;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let sample = 0; sample < 80; sample++) {
    const targets = [target('original', ['a', 'b']), target('response', ['b', 'c'], 'response-performance', 'e1')];
    const actions = Array.from({ length: 6 }, (_, index) => action(`action-${index}`, ['a', 'b', 'c'].filter(() => random(3) === 0), random(4), {
      requires: index && random(4) === 0 ? [`action-${random(index)}`] : [], exposesAnswer: random(6) === 0,
      createsEpoch: random(7) === 0, available: random(9) !== 0,
    }));
    const budget = random(7), maxDepth = random(5);
    const expected = oracle(targets, actions, budget, maxDepth);
    const actual = plan({ targets, actions, budget, maxDepth });
    assert.deepEqual(actual.score, expected.score, `score sample ${sample}`);
    assert.deepEqual(actual.selectedActionIds, expected.selectedActionIds, `selected sample ${sample}`);
    assert.equal(actual.optimalWithinBounds, true);
  }
});
