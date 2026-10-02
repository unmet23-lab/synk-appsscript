/* Vellum's grounded life-reaction selection. Authored candidates in, a plan out.
 * The game owns facts, permissions, NPC actions and render acknowledgements.
 * Choosing a plan creates no fact, delivery, relationship or learning success.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(() => require('./trail-life'));
  else root.SynkVellumLife = factory(() => root.SynkTrailLife);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getTrail) {
  'use strict';
  const VERSION = 'vellum-life-1';
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const list = value => Array.isArray(value) && value.length > 0 && value.length <= 64
    && value.every(id) && new Set(value).size === value.length;
  const entries = (value, test) => object(value) && Object.entries(value).length <= 64
    && Object.entries(value).every(([key, item]) => id(key) && test(item));
  const revisions = value => entries(value, revision => Number.isSafeInteger(revision) && revision >= 0);
  const conditions = value => entries(value, flag => typeof flag === 'boolean');
  function validateCandidate(candidate) {
    const required = ['id', 'semanticKey', 'sourceIds', 'requiredRevisions', 'conditions', 'priority', 'once', 'contentRef', 'actionRef'];
    if (!object(candidate) || Object.keys(candidate).some(key => !required.includes(key)) || required.some(key => !Object.hasOwn(candidate, key))
      || ![candidate.id, candidate.semanticKey, candidate.contentRef, candidate.actionRef].every(id) || !list(candidate.sourceIds)
      || !revisions(candidate.requiredRevisions) || !conditions(candidate.conditions)
      || !Number.isFinite(candidate.priority) || typeof candidate.once !== 'boolean') throw new TypeError('Vellum Life: invalid candidate');
    return candidate;
  }
  function select({ scope, trail, npcId, currentRevisions, conditions: currentConditions, candidates }) {
    const Trail = getTrail();
    if (!Trail || typeof Trail.scopeKey !== 'function') throw new Error('Vellum Life: Trail Life unavailable');
    const key = Trail.scopeKey(scope);
    if (!id(npcId) || !revisions(currentRevisions) || !conditions(currentConditions) || !Array.isArray(candidates)) {
      throw new TypeError('Vellum Life: invalid selection input');
    }
    const seen = new Set();
    for (const candidate of candidates) {
      validateCandidate(candidate);
      if (seen.has(candidate.id)) throw new TypeError('Vellum Life: duplicate candidate id');
      seen.add(candidate.id);
    }
    const result = { version: VERSION, status: 'unavailable', selected: null, eligible: [], rejected: [] };
    let unavailable = null;
    if (!object(trail) || trail.version !== Trail.VERSION || trail.status !== 'ready') unavailable = 'projection-unavailable';
    else if (Trail.scopeKey(trail.scope) !== key) unavailable = 'scope-mismatch';
    else if (!Array.isArray(trail.facts) || !object(trail.knowledge) || !Array.isArray(trail.deliveries)) throw new TypeError('Vellum Life: invalid projection');
    else if (!Object.hasOwn(trail.knowledge, npcId)) unavailable = 'unknown-npc';
    if (unavailable) {
      result.rejected = candidates.map(candidate => ({ id: candidate.id, reason: unavailable }));
      return result;
    }
    const known = trail.knowledge[npcId];
    if (!Array.isArray(known) || !known.every(id)) throw new TypeError('Vellum Life: invalid knowledge projection');
    const facts = new Set(trail.facts.map(fact => fact.id));
    for (const candidate of candidates) {
      let reason = null;
      if (candidate.sourceIds.some(source => !facts.has(source))) reason = 'source-missing';
      else if (candidate.sourceIds.some(source => !known.includes(source))) reason = 'npc-unaware';
      else if (Object.entries(candidate.requiredRevisions).some(([entity, revision]) =>
        !Object.hasOwn(currentRevisions, entity) || currentRevisions[entity] !== revision)) reason = 'revision-mismatch';
      else if (Object.entries(candidate.conditions).some(([condition, value]) =>
        !Object.hasOwn(currentConditions, condition) || currentConditions[condition] !== value)) reason = 'condition-unmet';
      else if (candidate.once && trail.deliveries.some(delivery => delivery.npcId === npcId
        && delivery.semanticKey === candidate.semanticKey && delivery.sourceIds.length === candidate.sourceIds.length
        && candidate.sourceIds.every(source => delivery.sourceIds.includes(source)))) reason = 'already-delivered';
      if (reason) result.rejected.push({ id: candidate.id, reason });
      else result.eligible.push(copy(candidate));
    }
    result.eligible.sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (result.eligible.length) { result.status = 'ready'; result.selected = copy(result.eligible[0]); }
    return result;
  }
  return Object.freeze({ VERSION, validateCandidate, select });
});
