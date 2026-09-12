'use strict';

// This module plans conditional observations. It never writes observed evidence.
const LIMITS = Object.freeze({ actions: 24, targets: 64, blockers: 256, maxDepth: 24, maxStates: 100000 });
const ASSUMPTION = 'all-declared-blockers-cleared-by-supporting-observations';
const COST_MODEL = Object.freeze({ unit: 'declared-model-unit', measured: false, additive: true, probabilityModel: null });
const compareIds = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const stringId = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  return value;
};
const uniqueStrings = (value, field) => {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return [...new Set(value.map(id => stringId(id, field)))].sort(compareIds);
};
const popcount = value => { let count = 0; while (value) { value &= value - 1n; count++; } return count; };

function resourceLimited(reason, counts) {
  return {
    selectedActionIds: [], nextActionId: null, steps: [], unresolved: [],
    projectedQualification: { hypothetical: true, observed: false, assumption: ASSUMPTION, requiresSupportingOutcomes: true, inspectionAloneIsInsufficient: true, qualifiedTargetIds: [], newlyQualifiedTargetCount: 0, targets: [], inputFullyEvaluated: false, allTargetsConditionallyQualified: false },
    rejectedActions: [], score: { fullyQualifiedTargets: 0, coveredBlockers: 0, costUnits: 0, actionCount: 0 },
    optimalWithinBounds: false, exploredStates: 0, truncationReason: reason,
    limits: LIMITS, inputCounts: counts, inputNotEvaluated: true, costModel: COST_MODEL,
    executionPolicy: 'execute-one-observe-replan', actualEvidenceChanged: false,
  };
}

/**
 * Maximize fully qualified targets, then covered target/blocker pairs; minimize
 * declared cost, action count and lexicographic action ids in that order.
 * The search is exhaustive only within the declared budget and depth bounds.
 */
function planEvidencePreserving({ targets = [], actions = [], budget = 32, maxDepth = 8, maxStates = 50000 } = {}) {
  if (!Array.isArray(targets) || !Array.isArray(actions)) throw new TypeError('targets and actions must be arrays');
  if (!Number.isFinite(budget) || budget < 0) throw new TypeError('budget must be a finite non-negative number');
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > LIMITS.maxDepth) throw new TypeError(`maxDepth must be an integer from 0 to ${LIMITS.maxDepth}`);
  if (!Number.isInteger(maxStates) || maxStates < 1 || maxStates > LIMITS.maxStates) throw new TypeError(`maxStates must be an integer from 1 to ${LIMITS.maxStates}`);
  const counts = { targets: targets.length, actions: actions.length };
  if (targets.length > LIMITS.targets || actions.length > LIMITS.actions) return resourceLimited('input-limit-exceeded', counts);

  let pairCount = 0;
  const targetIds = new Set();
  const normalizedTargets = targets.map((target, targetIndex) => {
    if (!target || typeof target !== 'object') throw new TypeError('target must be an object');
    const id = stringId(target.id, 'target.id');
    if (targetIds.has(id)) throw new TypeError(`duplicate target id: ${id}`);
    targetIds.add(id);
    const epoch = stringId(target.epoch, 'target.epoch');
    const purpose = stringId(target.purpose, 'target.purpose');
    if (!['original-performance', 'response-performance', 'asr-data'].includes(purpose)) throw new TypeError(`unsupported target purpose: ${purpose}`);
    if (!Array.isArray(target.blockers)) throw new TypeError('target.blockers must be an array');
    // Check the raw length before scanning so malformed oversized input stays bounded.
    if (target.blockers.length > LIMITS.blockers) return null;
    const blockers = [...new Set(target.blockers.map(blocker => stringId(blocker?.id, 'blocker.id')))].sort(compareIds);
    pairCount += blockers.length;
    return { id, epoch, purpose, blockers, targetIndex };
  });
  counts.targetBlockerPairs = pairCount;
  if (normalizedTargets.includes(null) || pairCount > LIMITS.blockers) return resourceLimited('blocker-limit-exceeded', counts);
  normalizedTargets.sort((a, b) => compareIds(a.id, b.id));

  const pairs = [];
  for (const target of normalizedTargets) {
    target.mask = 0n;
    for (const blockerId of target.blockers) {
      const bit = 1n << BigInt(pairs.length);
      target.mask |= bit;
      pairs.push({ targetId: target.id, epoch: target.epoch, purpose: target.purpose, blockerId, bit });
    }
  }
  const actionIds = new Set();
  const normalizedActions = actions.map(action => {
    if (!action || typeof action !== 'object') throw new TypeError('action must be an object');
    const id = stringId(action.id, 'action.id');
    if (actionIds.has(id)) throw new TypeError(`duplicate action id: ${id}`);
    actionIds.add(id);
    if (!Number.isFinite(action.costUnits) || action.costUnits < 0) throw new TypeError(`action ${id} costUnits must be finite and non-negative`);
    for (const field of ['available', 'exposesAnswer', 'createsEpoch', 'eligibleForOriginal']) {
      if (action[field] !== undefined && typeof action[field] !== 'boolean') throw new TypeError(`action ${id} ${field} must be boolean`);
    }
    if (!Array.isArray(action.resolves) || action.resolves.length > LIMITS.blockers) throw new TypeError(`action ${id} resolves must be an array of at most ${LIMITS.blockers} blocker ids`);
    if (action.requires !== undefined && (!Array.isArray(action.requires) || action.requires.length > LIMITS.actions)) throw new TypeError(`action ${id} requires must be an array of at most ${LIMITS.actions} action ids`);
    return {
      id, title: typeof action.title === 'string' ? action.title : id, costUnits: action.costUnits,
      resolves: uniqueStrings(action.resolves, 'action.resolves'), requires: uniqueStrings(action.requires || [], 'action.requires'),
      available: action.available !== false, exposesAnswer: action.exposesAnswer === true,
      createsEpoch: action.createsEpoch === true, eligibleForOriginal: action.eligibleForOriginal !== false,
    };
  }).sort((a, b) => compareIds(a.id, b.id));
  const byId = new Map(normalizedActions.map(action => [action.id, action]));
  const invalid = new Map();
  const state = new Map();
  function validateDependencies(action, path = []) {
    if (state.get(action.id) === 2) return !invalid.has(action.id);
    if (state.get(action.id) === 1) {
      const start = path.indexOf(action.id);
      for (const id of path.slice(start)) invalid.set(id, 'dependency-cycle');
      return false;
    }
    state.set(action.id, 1);
    if (!action.available) invalid.set(action.id, 'unavailable');
    for (const dependencyId of action.requires) {
      const dependency = byId.get(dependencyId);
      if (!dependency) invalid.set(action.id, 'missing-dependency');
      else if (!validateDependencies(dependency, [...path, action.id]) && !invalid.has(action.id)) invalid.set(action.id, 'unavailable-dependency');
    }
    state.set(action.id, 2);
    return !invalid.has(action.id);
  }
  for (const action of normalizedActions) validateDependencies(action);
  const safety = new Map();
  function originalSafe(action) {
    if (safety.has(action.id)) return safety.get(action.id);
    if (invalid.has(action.id)) return false;
    const safe = !action.exposesAnswer && !action.createsEpoch && action.eligibleForOriginal && action.requires.every(id => originalSafe(byId.get(id)));
    safety.set(action.id, safe);
    return safe;
  }
  const rejectedActions = [];
  for (const action of normalizedActions) {
    action.coverage = 0n;
    if (invalid.has(action.id)) {
      rejectedActions.push({ actionId: action.id, reason: invalid.get(action.id), excludedFromSearch: true });
      continue;
    }
    const declared = new Set(action.resolves);
    const disallowed = [];
    for (const pair of pairs) {
      if (!declared.has(pair.blockerId)) continue;
      if (pair.purpose === 'original-performance' && !originalSafe(action)) disallowed.push({ targetId: pair.targetId, blockerId: pair.blockerId });
      else action.coverage |= pair.bit;
    }
    if (disallowed.length) rejectedActions.push({ actionId: action.id, reason: 'original-evidence-ineligible', excludedFromSearch: action.coverage === 0n, excludedTargetBlockers: disallowed });
  }
  // A zero-coverage action can still be necessary as a declared prerequisite.
  const relevant = new Set();
  function addRelevant(action) {
    if (relevant.has(action.id)) return;
    relevant.add(action.id);
    action.requires.forEach(id => addRelevant(byId.get(id)));
  }
  normalizedActions.filter(action => !invalid.has(action.id) && action.coverage !== 0n).forEach(addRelevant);
  for (const rejection of rejectedActions) rejection.excludedFromSearch = !relevant.has(rejection.actionId);
  for (const action of normalizedActions) {
    if (!invalid.has(action.id) && !relevant.has(action.id) && !rejectedActions.some(row => row.actionId === action.id)) rejectedActions.push({ actionId: action.id, reason: 'no-relevant-blockers', excludedFromSearch: true });
  }
  const candidates = normalizedActions.filter(action => relevant.has(action.id));
  const candidateIndex = new Map(candidates.map((action, index) => [action.id, index]));
  candidates.forEach((action, index) => {
    action.bit = 1 << index;
    action.requiredMask = action.requires.reduce((mask, id) => mask | (1 << candidateIndex.get(id)), 0);
  });

  const completeCount = coverage => normalizedTargets.reduce((count, target) => count + ((coverage & target.mask) === target.mask ? 1 : 0), 0);
  const selectedIds = mask => candidates.filter(action => (mask & action.bit) !== 0).map(action => action.id);
  function score(node) {
    return { fullyQualifiedTargets: completeCount(node.coverage), coveredBlockers: popcount(node.coverage), costUnits: node.cost, actionCount: node.depth };
  }
  function better(node, incumbent) {
    const left = score(node), right = score(incumbent);
    for (const field of ['fullyQualifiedTargets', 'coveredBlockers']) if (left[field] !== right[field]) return left[field] > right[field];
    for (const field of ['costUnits', 'actionCount']) if (left[field] !== right[field]) return left[field] < right[field];
    return compareIds(JSON.stringify(selectedIds(node.mask)), JSON.stringify(selectedIds(incumbent.mask))) < 0;
  }
  const initial = { mask: 0, coverage: 0n, cost: 0, depth: 0 };
  let best = initial;
  const queue = [initial];
  const visited = new Set([0]);
  let exploredStates = 0;
  let truncationReason = null;
  search: for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    exploredStates++;
    if (better(current, best)) best = current;
    if (current.depth >= maxDepth) continue;
    for (const action of candidates) {
      if ((current.mask & action.bit) !== 0 || (current.mask & action.requiredMask) !== action.requiredMask) continue;
      const cost = current.cost + action.costUnits;
      if (cost > budget) continue;
      const mask = current.mask | action.bit;
      if (visited.has(mask)) continue;
      if (queue.length >= maxStates) {
        truncationReason = 'state-limit-exceeded';
        break search;
      }
      const next = { mask, coverage: current.coverage | action.coverage, cost, depth: current.depth + 1 };
      visited.add(mask);
      queue.push(next);
      // Retain the best discovered feasible solution even when expansion stops.
      if (better(next, best)) best = next;
    }
  }
  const selected = selectedIds(best.mask);
  const pending = new Set(selected);
  const executed = new Set();
  const steps = [];
  while (pending.size) {
    const action = candidates.find(row => pending.has(row.id) && row.requires.every(id => executed.has(id)));
    if (!action) throw new Error('internal planner error: selected dependency graph is cyclic');
    steps.push({
      actionId: action.id, title: action.title, costUnits: action.costUnits, requires: [...action.requires],
      conditionalOn: steps.map(step => step.actionId), hypothetical: true, requiresActualObservation: true,
      projectedResolves: pairs.filter(pair => (action.coverage & pair.bit) !== 0n).map(({ targetId, blockerId }) => ({ targetId, blockerId })),
      exposesAnswer: action.exposesAnswer, createsEpoch: action.createsEpoch,
    });
    pending.delete(action.id);
    executed.add(action.id);
  }
  const qualifications = normalizedTargets.map(target => ({
    targetId: target.id, epoch: target.epoch, purpose: target.purpose,
    currentlyUnblocked: target.blockers.length === 0,
    wouldQualify: (best.coverage & target.mask) === target.mask,
    remainingBlockerIds: pairs.filter(pair => pair.targetId === target.id && (best.coverage & pair.bit) === 0n).map(pair => pair.blockerId),
  }));
  return {
    selectedActionIds: selected, nextActionId: steps[0]?.actionId || null, steps,
    unresolved: qualifications.filter(target => target.remainingBlockerIds.length).map(target => ({ targetId: target.targetId, epoch: target.epoch, purpose: target.purpose, blockerIds: target.remainingBlockerIds })),
    projectedQualification: {
      hypothetical: true, observed: false, assumption: ASSUMPTION, requiresSupportingOutcomes: true, inspectionAloneIsInsufficient: true,
      inputFullyEvaluated: true, allTargetsConditionallyQualified: qualifications.every(target => target.wouldQualify),
      qualifiedTargetIds: qualifications.filter(target => target.wouldQualify).map(target => target.targetId),
      newlyQualifiedTargetCount: qualifications.filter(target => target.wouldQualify && !target.currentlyUnblocked).length,
      targets: qualifications,
    },
    rejectedActions: rejectedActions.sort((a, b) => compareIds(a.actionId, b.actionId)), score: score(best),
    optimalWithinBounds: truncationReason === null, exploredStates, discoveredStates: queue.length, truncationReason,
    searchScope: 'declared-candidates-budget-depth',
    bounds: { budget, maxDepth, maxStates }, limits: LIMITS, inputCounts: counts,
    costModel: COST_MODEL, executionPolicy: 'execute-one-observe-replan', actualEvidenceChanged: false,
  };
}

module.exports = { planEvidencePreserving, LIMITS };
