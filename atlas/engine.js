/* SYNK Atlas. Canonical source: SYNK-appsscript/atlas/engine.js.
 * Pure, portable decision core. No network, model calls or implicit tracking.
 * Shared machinery does not grant permission to combine subjects or domains.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkAtlas = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'atlas-1.0.0';
  const DOMAINS = ['LAB', 'SHIFT', 'PULSE', 'PATH'];
  const CONTEXT = {
    goal: ['explore', 'study', 'work', 'clarity', 'expression', 'prepare'],
    time: ['short', 'standard', 'unlimited'],
    support: ['choose', 'step', 'independent'],
    audio: ['off', 'available'],
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const ms = value => { const n = Date.parse(value); if (!Number.isFinite(n)) throw new TypeError('Atlas: invalid time'); return n; };
  const scopeKey = scope => {
    if (!scope || !DOMAINS.includes(scope.domain) || !validId(scope.subject) || !validId(scope.workspace)) throw new TypeError('Atlas: invalid scope');
    return `${scope.domain}/${scope.workspace}/${scope.subject}`;
  };
  function validate(event) {
    if (!event || event.schema !== 1 || !validId(event.id)) throw new TypeError('Atlas: invalid event');
    scopeKey(event.scope); ms(event.at); ms(event.recordedAt);
    if (ms(event.recordedAt) < ms(event.at)) throw new TypeError('Atlas: recorded before occurrence');
    if (event.type === 'context.set') {
      if (!Object.hasOwn(CONTEXT, event.field) || !(event.value === null || CONTEXT[event.field].includes(event.value))) throw new TypeError('Atlas: invalid context');
      if (event.until != null && ms(event.until) <= ms(event.at)) throw new TypeError('Atlas: invalid expiry');
    } else if (event.type === 'decision.made') {
      if (!validId(event.experienceId) || !validId(event.variant) || event.policy !== VERSION || !Array.isArray(event.evidence) || !event.evidence.every(validId)) throw new TypeError('Atlas: invalid decision record');
    } else if (event.type === 'experience.completed') {
      if (!validId(event.decisionId) || !validId(event.experienceId) || !validId(event.variant)) throw new TypeError('Atlas: invalid completion');
    } else if (event.type === 'feedback.given') {
      if (!validId(event.completionId) || !['helpful', 'too_much', 'want_more', 'not_fit'].includes(event.value)) throw new TypeError('Atlas: invalid feedback');
    } else if (event.type === 'record.excluded') {
      if (!validId(event.targetId)) throw new TypeError('Atlas: invalid exclusion');
    } else throw new TypeError('Atlas: unknown event');
    return event;
  }
  function append(events, event) {
    validate(event);
    const previous = events.find(e => e.id === event.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(event)) throw new Error('Atlas: conflicting event id');
      return copy(events);
    }
    if (event.type === 'feedback.given') {
      const completion = events.find(e => e.id === event.completionId && e.type === 'experience.completed');
      if (!completion || scopeKey(completion.scope) !== scopeKey(event.scope) || ms(completion.at) > ms(event.at)) throw new Error('Atlas: feedback requires a prior completion in the same scope');
    }
    if (event.type === 'experience.completed') {
      const decision = events.find(e => e.type === 'decision.made' && e.id === event.decisionId);
      if (!decision || scopeKey(decision.scope) !== scopeKey(event.scope) || decision.variant !== event.variant || decision.experienceId !== event.experienceId || ms(decision.at) > ms(event.at)) throw new Error('Atlas: completion requires the delivered decision');
    }
    if (event.type === 'record.excluded') {
      const target = events.find(e => e.id === event.targetId);
      if (!target || target.type === 'record.excluded' || scopeKey(target.scope) !== scopeKey(event.scope)) throw new Error('Atlas: invalid exclusion target');
    }
    return [...copy(events), copy(event)];
  }
  function understand(events, scope, asOf, recordedAsOf = asOf) {
    const key = scopeKey(scope), cutoff = ms(asOf), recordedCutoff = ms(recordedAsOf);
    const ordered = events.map(validate).filter(e => scopeKey(e.scope) === key && ms(e.at) <= cutoff && ms(e.recordedAt) <= recordedCutoff)
      // Stable sort preserves the append order when both clocks have the same
      // millisecond. Random IDs are identity, never a causal ordering clock.
      .sort((a, b) => ms(a.at) - ms(b.at) || ms(a.recordedAt) - ms(b.recordedAt));
    const excluded = new Set(ordered.filter(e => e.type === 'record.excluded').map(e => e.targetId));
    const context = {}, evidence = {}, expired = [], latest = {};
    // Resolve newest declaration first. Its expiry must not resurrect an older declaration.
    for (const event of ordered) if (event.type === 'context.set') latest[event.field] = event;
    for (const [field, event] of Object.entries(latest)) {
      if (excluded.has(event.id) || event.value === null) continue;
      if (event.until && ms(event.until) <= cutoff) { expired.push(field); continue; }
      context[field] = event.value; evidence[field] = event.id;
    }
    const completed = new Map(ordered.filter(e => e.type === 'experience.completed' && !excluded.has(e.id)).map(e => [e.id, e]));
    const responses = new Map();
    // PULSE does not turn listening/activity into a personal behavioural profile.
    if (scope.domain !== 'PULSE') for (const event of ordered) {
      if (event.type !== 'feedback.given' || !completed.has(event.completionId)) continue;
      if (cutoff - ms(event.at) > 30 * 86400000) continue;
      const completion = completed.get(event.completionId);
      if (ms(completion.at) <= ms(event.at)) responses.set(event.completionId, { ...event, experienceId: completion.experienceId, variant: completion.variant });
    }
    return { version: VERSION, scope: copy(scope), asOf, recordedAsOf, context, evidence, expired, feedback: [...responses.values()].filter(e => !excluded.has(e.id)), excluded: [...excluded] };
  }
  function decide({ events = [], scope, at, recordedAt = at, experienceId, candidates }) {
    if (!validId(experienceId) || !Array.isArray(candidates) || !candidates.length) throw new TypeError('Atlas: candidates required');
    const state = understand(events, scope, at, recordedAt), c = state.context;
    const ids = new Set();
    const eligible = candidates.filter(item => {
      if (!validId(item.id) || ids.has(item.id) || !Number.isFinite(item.minutes) || item.minutes <= 0 || !['short', 'standard', 'deep'].includes(item.pace)) throw new TypeError('Atlas: invalid candidate');
      ids.add(item.id);
      return !(c.audio === 'off' && item.requiresAudio) && !(c.time === 'short' && item.minutes > 5);
    });
    const reasons = [], evidence = Object.values(state.evidence);
    if (c.time === 'short') reasons.push('time.short');
    if (c.audio === 'off') reasons.push('audio.off');
    if (c.goal) reasons.push(`goal.${c.goal}`);
    if (c.support) reasons.push(`support.${c.support}`);
    if (!eligible.length) return { version: VERSION, status: 'unavailable', scope: copy(scope), experienceId, at, reasons: [...reasons, 'no.feasible.experience'], evidence, alternatives: [], selected: null };
    const feedback = state.feedback.filter(f => f.experienceId === experienceId);
    const last = feedback.at(-1);
    const targetPace = c.time === 'short' ? 'short' : last?.value === 'too_much' ? 'short' : last?.value === 'want_more' && c.time !== 'short' ? 'deep' : 'standard';
    const scored = eligible.map(item => {
      let score = item.pace === targetPace ? 4 : 0;
      if (c.goal && item.goals?.includes(c.goal)) score += 3;
      const same = feedback.filter(f => f.variant === item.id).slice(-3);
      score += same.reduce((n, f) => n + (f.value === 'helpful' ? 1 : f.value === 'not_fit' ? -2 : 0), 0);
      return { item, score };
    }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
    if (last) { reasons.push(`feedback.${last.value}`); evidence.push(last.id, last.completionId); }
    for (const f of feedback) if (['helpful', 'not_fit'].includes(f.value)) evidence.push(f.id, f.completionId);
    return { version: VERSION, status: 'ready', scope: copy(scope), experienceId, at, selected: copy(scored[0].item),
      support: c.support || 'choose', focus: c.goal || 'explore', reasons, evidence: [...new Set(evidence)],
      alternatives: scored.slice(1).map(s => s.item.id), outcomeBasis: last ? 'self_report' : 'unobserved' };
  }
  function createSession({ scope, events = [], clock = () => new Date().toISOString(), id } = {}) {
    scopeKey(scope);
    let log = [];
    for (const event of events) {
      if (scopeKey(event.scope) !== scopeKey(scope)) throw new Error('Atlas: scope mismatch');
      log = append(log, event);
    }
    let sequence = 0;
    const nextId = id || (() => `a${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    const record = body => { const at = clock(); const event = { ...body, schema: 1, scope: copy(scope), id: nextId(), at, recordedAt: at }; log = append(log, event); return copy(event); };
    return {
      events: () => copy(log),
      set: (field, value, until = null) => record({ type: 'context.set', field, value, until }),
      plan: (experienceId, candidates) => {
        const decision = decide({ events: log, scope, at: clock(), experienceId, candidates });
        if (decision.status !== 'ready') return decision;
        const recorded = record({ type: 'decision.made', experienceId, variant: decision.selected.id, policy: VERSION,
          evidence: decision.evidence, reasons: decision.reasons, alternatives: decision.alternatives,
          support: decision.support, focus: decision.focus, candidateSnapshot: copy(candidates) });
        return { ...decision, id: recorded.id };
      },
      complete: decision => {
        if (!decision || decision.status !== 'ready' || scopeKey(decision.scope) !== scopeKey(scope)) throw new Error('Atlas: invalid decision');
        const existing = log.find(e => e.type === 'experience.completed' && e.decisionId === decision.id);
        return existing ? copy(existing) : record({ type: 'experience.completed', decisionId: decision.id, experienceId: decision.experienceId, variant: decision.selected.id });
      },
      feedback: (completionId, value) => record({ type: 'feedback.given', completionId, value }),
      exclude: targetId => record({ type: 'record.excluded', targetId }),
      clear: () => { log = []; },
      state: () => understand(log, scope, clock()),
    };
  }
  return Object.freeze({ VERSION, CONTEXT, validate, append, understand, decide, createSession });
});
