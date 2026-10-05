/* Core's optional source-backed interpretation review. This is a trust boundary,
 * not a language model: matching a quote proves provenance, never its meaning.
 * Hosts own authorized sources, user identity, persistence and model calls.
 * Reviewed sources/proposals are immutable; later sources may be appended. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./domain'));
  else root.SynkAtlasInterpretation = factory(root.SynkAtlasDomain);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Domain) {
  'use strict';
  const VERSION = 'core-interpretation-1', DAY = 86400000;
  const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
  const keys = (x, allowed) => plain(x) && Object.keys(x).every(k => allowed.includes(k));
  const token = x => typeof x === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
  const fail = m => { throw new TypeError(`Core interpretation: ${m}`); };
  const copy = x => JSON.parse(JSON.stringify(x));
  const canonical = x => JSON.stringify(x, (_k, v) => plain(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  const time = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) ? Date.parse(x) : fail('invalid time');
  const validValue = (f, v) => f.kind === 'enum' ? f.values.includes(v) : f.kind === 'boolean' ? typeof v === 'boolean'
    : typeof v === 'number' && Number.isFinite(v) && v >= f.range[0] && v <= f.range[1];
  const splitSurrogate = (text, offset) => offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]);

  function packet(input) {
    if (!Domain?.understand) fail('load Core domain first');
    const { contract, scope, sources, proposals, at } = input;
    const cutoff = time(at), fields = Domain.validateContract(contract);
    Domain.understand({ contract, scope, observations: [], at });
    if (!Array.isArray(sources) || sources.length > 32 || !Array.isArray(proposals) || proposals.length > 100) fail('invalid packet size');
    const bySource = new Map(), byProposal = new Map(); let chars = 0;
    for (const source of sources) {
      if (!keys(source, ['id', 'scope', 'at', 'text', 'actor', 'excludedAt']) || !token(source.id) || bySource.has(source.id)
        || canonical(source.scope) !== canonical(scope) || !['self', 'other'].includes(source.actor)
        || typeof source.text !== 'string' || !source.text.trim() || source.text.length > 4000) fail('invalid or foreign source');
      const happened = time(source.at);
      if (happened > cutoff || source.excludedAt != null && time(source.excludedAt) < happened) fail('invalid source chronology');
      chars += source.text.length; if (chars > 64000) fail('source packet too large');
      bySource.set(source.id, source);
    }
    for (const p of proposals) {
      if (!keys(p, ['id', 'field', 'value', 'subject', 'stance', 'evidence']) || !token(p.id) || byProposal.has(p.id)
        || !fields.has(p.field) || !validValue(fields.get(p.field), p.value)
        || !['self', 'other'].includes(p.subject) || !['current', 'past', 'hypothetical', 'uncertain'].includes(p.stance)
        || !Array.isArray(p.evidence) || !p.evidence.length || p.evidence.length > 4) fail('invalid proposal');
      const seen = new Set();
      for (const e of p.evidence) {
        const source = bySource.get(e?.sourceId);
        if (!keys(e, ['sourceId', 'start', 'end', 'quote']) || !source || !Number.isInteger(e.start) || !Number.isInteger(e.end)
          || e.start < 0 || e.end <= e.start || e.end > source.text.length || typeof e.quote !== 'string'
          || !e.quote.trim() || e.quote.length > 4000 || source.text.slice(e.start, e.end) !== e.quote
          || splitSurrogate(source.text, e.start) || splitSurrogate(source.text, e.end) || seen.has(canonical(e))) fail('invalid source quotation');
        seen.add(canonical(e));
      }
      byProposal.set(p.id, p);
    }
    const baseReasons = (p, cutoffAt) => {
      const reasons = [];
      if (p.subject !== 'self' || p.evidence.some(e => bySource.get(e.sourceId).actor !== 'self')) reasons.push('other-subject');
      if (p.stance !== 'current') reasons.push(p.stance);
      for (const e of p.evidence) {
        const s = bySource.get(e.sourceId);
        if (time(s.at) > cutoffAt) reasons.push('future-source');
        if (s.excludedAt != null && time(s.excludedAt) <= cutoffAt) reasons.push('source-excluded');
        if (time(s.at) + (fields.get(p.field).maxAgeDays ?? 30) * DAY <= cutoffAt) reasons.push('source-expired');
      }
      return [...new Set(reasons)];
    };
    const state = (p, when = cutoff, ignored = new Set()) => {
      const reasons = baseReasons(p, when);
      if (reasons.length) return { ...copy(p), status: 'blocked', reasons };
      const conflicting = proposals.some(peer => !ignored.has(peer.id) && peer.field === p.field && canonical(peer.value) !== canonical(p.value) && !baseReasons(peer, when).length);
      return { ...copy(p), status: conflicting ? 'conflict' : 'pending', reasons: conflicting ? ['conflicting-proposals'] : [] };
    };
    const basis = p => canonical({ contract, scope, proposal: p,
      sources: [...new Set(p.evidence.map(e => e.sourceId))].sort().map(id => { const { excludedAt, ...source } = bySource.get(id); return source; }) });
    return { contract, scope, at, cutoff, fields, sources, proposals, bySource, byProposal, state, basis, baseReasons };
  }
  function prepare(input = {}) {
    const p = packet(input);
    return { version: VERSION, proposals: p.proposals.map(row => p.state(row)), observations: [], calibrated: false };
  }
  function ledger(p, supplied = []) {
    if (!Array.isArray(supplied) || supplied.length > 200) fail('invalid review ledger');
    const reviews = [], ids = new Map(), latest = new Map(), active = new Map(), observations = [], lineage = [];
    let lastTime = -Infinity;
    for (const event of supplied) {
      if (!keys(event, ['id', 'proposalId', 'action', 'value', 'at', 'basis']) || !token(event.id) || !p.byProposal.has(event.proposalId)
        || !['confirm', 'correct', 'reject', 'withdraw'].includes(event.action) || typeof event.basis !== 'string') fail('invalid review');
      if (ids.has(event.id)) { if (canonical(ids.get(event.id)) !== canonical(event)) fail('conflicting review id'); continue; }
      const row = p.byProposal.get(event.proposalId), field = p.fields.get(row.field), at = time(event.at);
      if (at > p.cutoff || at < lastTime || row.evidence.some(e => time(p.bySource.get(e.sourceId).at) > at)) fail('invalid review chronology');
      if (event.basis !== p.basis(row)) fail('review basis changed');
      if (event.action === 'correct' ? !validValue(field, event.value) : Object.hasOwn(event, 'value')) fail('invalid review value');
      const state = p.state(row, at);
      // Replaying a person's prior confirmation must not be vetoed by a later
      // model proposal about the same old source. New confirmations check all
      // current alternatives in review(); replay checks the confirmed source.
      if (event.action === 'confirm' && p.baseReasons(row, at).length) fail('only a current self proposal can be confirmed');
      if (event.action === 'correct' && state.reasons.some(r => ['other-subject', 'source-excluded', 'source-expired', 'future-source'].includes(r))) fail('cannot correct an unavailable source');
      const previous = active.get(row.field);
      if (event.action === 'withdraw' && (previous?.proposalId !== row.id || previous.withdrawn)) fail('withdraw requires the active confirmation');
      ids.set(event.id, event); reviews.push(event); latest.set(row.id, event); lastTime = at;
      const accepted = ['confirm', 'correct'].includes(event.action);
      // Rejecting a different pending proposal must not erase a confirmed field.
      if (!accepted && (previous?.proposalId !== row.id || previous.withdrawn)) continue;
      const excluded = row.evidence.some(e => { const source = p.bySource.get(e.sourceId); return source.excludedAt != null && time(source.excludedAt) <= p.cutoff; });
      const value = accepted && !excluded ? (event.action === 'correct' ? event.value : row.value) : null;
      const observation = { id: `i.${event.id}`, scope: copy(p.scope), contract: { id: p.contract.id, version: p.contract.version, purpose: p.contract.purpose },
        field: row.field, value, source: 'declared', at: event.at, refs: [event.id], ...(previous ? { supersedes: previous.observationId } : {}) };
      // Confirmed extracted facts cannot remain fresh longer than their sources.
      // A correction is the person's new declaration at review time.
      if (value !== null && event.action === 'confirm') observation.until = new Date(Math.min(...row.evidence.map(e => time(p.bySource.get(e.sourceId).at))) + (field.maxAgeDays ?? 30) * DAY).toISOString();
      observations.push(observation);
      lineage.push({ observationId: observation.id, reviewId: event.id, proposalId: row.id,
        basis: event.action === 'correct' ? 'user-correction' : 'user-confirmation', evidence: copy(row.evidence), excluded, withdrawn: !accepted });
      active.set(row.field, { proposalId: row.id, observationId: observation.id, withdrawn: !accepted });
    }
    return { reviews, latest, observations, lineage };
  }
  function resolve(input = {}) {
    const p = packet(input), l = ledger(p, input.reviews);
    const ignored = new Set([...l.latest].filter(([, event]) => ['reject', 'withdraw'].includes(event.action)).map(([id]) => id));
    const understanding = Domain.understand({ contract: p.contract, scope: p.scope, observations: l.observations, at: p.at });
    return copy({ version: VERSION, proposals: p.proposals.map(row => ({ ...p.state(row, p.cutoff, ignored), ...(l.latest.has(row.id) ? { review: l.latest.get(row.id) } : {}) })),
      observations: l.observations, understanding, lineage: l.lineage, calibrated: false });
  }
  function review(input = {}) {
    const p = packet(input), l = ledger(p, input.reviews), proposal = p.byProposal.get(input.proposalId);
    if (!proposal) fail('unknown proposal');
    const event = { id: input.id, proposalId: input.proposalId, action: input.action, at: input.at, basis: p.basis(proposal),
      ...(Object.hasOwn(input, 'value') ? { value: input.value } : {}) };
    const existing = l.reviews.find(row => row.id === event.id);
    const ignored = new Set([...l.latest].filter(([, event]) => ['reject', 'withdraw'].includes(event.action)).map(([id]) => id));
    if (!existing && event.action === 'confirm' && p.state(proposal, p.cutoff, ignored).status !== 'pending') fail('only an unambiguous current self proposal can be confirmed');
    // Validate the prospective append, including retries and chronological ties.
    ledger(p, [...l.reviews, event]);
    return copy(event);
  }
  return Object.freeze({ VERSION, prepare, review, resolve });
});
