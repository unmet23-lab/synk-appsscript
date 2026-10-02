/* Trail's life-event projection. The game owns world facts and authorization.
 * This module reads a separate, confirmed projection; it never writes world state,
 * awards rewards, stores identities, or treats a life action as learning evidence.
 * Sequence, not a device clock, defines causality. No network or model calls.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkTrailLife = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'trail-life-1';
  const TYPES = ['life.fact', 'life.corrected', 'life.knowledge', 'life.delivered'];
  const BASE = ['schema', 'id', 'scope', 'seq', 'type'];
  const FIELDS = {
    'life.fact': ['factType', 'causes', 'revisions', 'knownBy'],
    'life.corrected': ['targetId'],
    'life.knowledge': ['factId', 'npcId', 'allowed', 'viaId'],
    'life.delivered': ['reactionId', 'deliveryId', 'npcId', 'semanticKey', 'sourceIds', 'revisions', 'contentVersion', 'mode'],
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const list = (value, min = 0) => Array.isArray(value) && value.length >= min && value.length <= 64
    && value.every(id) && new Set(value).size === value.length;
  const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
  const revisions = value => object(value) && Object.entries(value).length <= 64
    && Object.entries(value).every(([key, revision]) => id(key) && integer(revision));
  const canonical = value => JSON.stringify(value, (_key, entry) => object(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
  function scopeKey(scope) {
    if (!exact(scope, ['domain', 'workspace', 'subject']) || !['LAB', 'SHIFT', 'PATH'].includes(scope.domain)
      || !id(scope.workspace) || !id(scope.subject)) throw new TypeError('Trail Life: invalid scope');
    return JSON.stringify([scope.domain, scope.workspace, scope.subject]);
  }
  function validate(event) {
    if (!object(event) || !TYPES.includes(event.type) || !exact(event, [...BASE, ...FIELDS[event.type]])
      || event.schema !== 1 || !id(event.id) || !integer(event.seq) || event.seq < 1) throw new TypeError('Trail Life: invalid event fields');
    scopeKey(event.scope);
    if (event.type === 'life.fact' && (!id(event.factType) || !list(event.causes) || !revisions(event.revisions) || !list(event.knownBy))) {
      throw new TypeError('Trail Life: invalid fact');
    }
    if (event.type === 'life.corrected' && !id(event.targetId)) throw new TypeError('Trail Life: invalid correction');
    if (event.type === 'life.knowledge' && (!id(event.factId) || !id(event.npcId) || typeof event.allowed !== 'boolean'
      || (event.allowed ? !id(event.viaId) : event.viaId !== null))) throw new TypeError('Trail Life: invalid knowledge');
    if (event.type === 'life.delivered' && (![event.reactionId, event.deliveryId, event.npcId, event.semanticKey, event.contentVersion].every(id)
      || !list(event.sourceIds, 1) || !revisions(event.revisions) || !['motion', 'static', 'text'].includes(event.mode))) {
      throw new TypeError('Trail Life: invalid delivery');
    }
    return event;
  }
  function read(events, scope) {
    if (!Array.isArray(events)) throw new TypeError('Trail Life: log must be an array');
    const key = scopeKey(scope), seen = new Map(), facts = new Map(), knowledge = new Map(), deliveries = new Map(), log = [];
    let sequence = 0;
    const know = (npcId, factId, value) => {
      if (!knowledge.has(npcId)) knowledge.set(npcId, new Map());
      knowledge.get(npcId).set(factId, value);
    };
    const active = factId => facts.get(factId)?.active === true;
    const derivesFrom = (sourceId, targetId) => {
      const stack = [sourceId], visited = new Set();
      while (stack.length) {
        const id = stack.pop();
        if (id === targetId) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        stack.push(...(facts.get(id)?.event.causes || []));
      }
      return false;
    };
    const permitted = (npcId, factId, visited = new Set()) => {
      const grant = knowledge.get(npcId)?.get(factId);
      if (!active(factId) || grant?.allowed !== true || visited.has(factId)) return false;
      if (grant.viaId === null) return true;
      if (grant.viaId === factId) return facts.get(factId).event.knownBy.includes(npcId);
      return permitted(npcId, grant.viaId, new Set([...visited, factId]));
    };
    for (const event of events) {
      validate(event);
      if (scopeKey(event.scope) !== key) throw new Error('Trail Life: scope mismatch');
      if (seen.has(event.id)) {
        if (canonical(seen.get(event.id)) !== canonical(event)) throw new Error('Trail Life: conflicting event id');
        continue;
      }
      if (event.seq <= sequence) throw new Error('Trail Life: sequence must increase');
      if (event.type === 'life.fact') {
        if (event.causes.some(cause => !active(cause))) throw new Error('Trail Life: fact requires prior valid causes');
        facts.set(event.id, { event, active: true });
        for (const npc of event.knownBy) know(npc, event.id, { allowed: true, viaId: null });
      } else if (event.type === 'life.corrected') {
        if (!facts.has(event.targetId)) throw new Error('Trail Life: correction requires a prior fact');
        facts.get(event.targetId).active = false;
        // Facts are insertion ordered; all causes precede their dependants.
        for (const fact of facts.values()) if (fact.event.causes.some(cause => !active(cause))) fact.active = false;
      } else if (event.type === 'life.knowledge') {
        if (!facts.has(event.factId)) throw new Error('Trail Life: knowledge requires a prior fact');
        if (event.allowed && (!active(event.factId) || !active(event.viaId) || !derivesFrom(event.viaId, event.factId)
          || !(permitted(event.npcId, event.viaId) || (event.viaId === event.factId && facts.get(event.factId).event.knownBy.includes(event.npcId))))) {
          throw new Error('Trail Life: knowledge requires a witnessed source');
        }
        // Seeing it directly is the strongest source; a relayed grant cannot replace it.
        const own = knowledge.get(event.npcId)?.get(event.factId);
        if (!(event.allowed && own?.allowed === true && own.viaId === null)) know(event.npcId, event.factId, { allowed: event.allowed, viaId: event.viaId });
      } else {
        if (event.sourceIds.some(source => !permitted(event.npcId, source))) throw new Error('Trail Life: delivery requires permitted facts');
        if (deliveries.has(event.deliveryId)) throw new Error('Trail Life: duplicate delivery id');
        deliveries.set(event.deliveryId, event);
      }
      seen.set(event.id, event); log.push(event); sequence = event.seq;
    }
    return { log, seen, facts, knowledge, deliveries, sequence, permitted };
  }
  function append(events, event, { currentRevisions } = {}) {
    validate(event);
    const prior = read(events, event.scope);
    if (prior.seen.has(event.id)) {
      if (canonical(prior.seen.get(event.id)) !== canonical(event)) throw new Error('Trail Life: conflicting event id');
      return copy(prior.log);
    }
    if (event.type === 'life.delivered') {
      const previous = prior.deliveries.get(event.deliveryId);
      if (previous) {
        const receipt = value => { const { id: ignoredId, seq: ignoredSeq, ...body } = value; return body; };
        if (canonical(receipt(previous)) !== canonical(receipt(event))) throw new Error('Trail Life: conflicting delivery id');
        return copy(prior.log);
      }
      // A renderer cannot certify its own stale state. The game supplies its
      // current authoritative revisions after validating the actual render ack.
      if (!revisions(currentRevisions) || Object.entries(event.revisions).some(([key, revision]) =>
        !Object.hasOwn(currentRevisions, key) || currentRevisions[key] !== revision)) throw new Error('Trail Life: delivery revision mismatch');
    }
    return copy(read([...prior.log, event], event.scope).log);
  }
  function summarize(events, { scope, complete = true } = {}) {
    if (typeof complete !== 'boolean') throw new TypeError('Trail Life: invalid completeness');
    const state = read(events, scope);
    const result = { version: VERSION, status: complete ? 'ready' : 'unknown', scope: copy(scope), sequence: state.sequence,
      facts: [], knowledge: {}, deliveries: [], invalidated: [], learningEffectClaim: false };
    if (!complete) return result;
    result.facts = [...state.facts.values()].filter(f => f.active).map(f => copy(f.event));
    result.invalidated = [...state.facts.values()].filter(f => !f.active).map(f => f.event.id);
    result.knowledge = Object.fromEntries([...state.knowledge].map(([npc, known]) =>
      [npc, [...known.keys()].filter(factId => state.permitted(npc, factId))]));
    // A later correction/withdrawal never erases an actual earlier delivery.
    result.deliveries = [...state.deliveries.values()].map(copy);
    return result;
  }
  return Object.freeze({ VERSION, TYPES: Object.freeze([...TYPES]), scopeKey, validate, append, summarize });
});
