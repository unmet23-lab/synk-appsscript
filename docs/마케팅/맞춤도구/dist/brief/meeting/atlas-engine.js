/* SYNK Core decisions and the shared session entry point.
 * Canonical source: SYNK-appsscript/atlas/engine.js.
 * Atlas names the eight-engine family, not a separate decision engine.
 * Core owns understand/decide/choice; the session delegates practice provenance
 * to Trail. Extend each engine at its own source, not all features in this file.
 * Ownership: docs/엔진8종_상향설계_v3.md#engine-owner-sources.
 * SynkAtlas, this file path and atlas-* policy IDs remain compatibility names.
 * Pure and portable. No network, model calls or implicit tracking.
 * Shared machinery does not grant permission to combine subjects or domains.
 * atlas-2: Core selects registered levers; their owner engines deliver and check.
 * The shape and the content of an experience adapt; what an assessment means is never a lever.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(() => require('./trail'));
  else root.SynkAtlas = factory(() => root.SynkAtlasTrail || root.SynkTrail);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getTrail) {
  'use strict';
  const VERSION = 'atlas-2.3.0';
  // Decisions recorded by an earlier policy stay readable; a new plan is always stamped with VERSION.
  const POLICIES = ['atlas-1.0.0', 'atlas-2.0.0', 'atlas-2.1.0', 'atlas-2.2.0', VERSION];
  const trail = () => {
    const module = getTrail();
    if (!module || typeof module.validate !== 'function' || typeof module.checkLink !== 'function' || typeof module.summarize !== 'function') throw new Error('Atlas: Trail practice module unavailable');
    return module;
  };
  const isPractice = event => typeof event?.type === 'string' && event.type.startsWith('practice.');
  // SYNK is the shared product context; brand-domain scopes remain independent.
  const DOMAINS = ['LAB', 'SHIFT', 'PULSE', 'PATH', 'SYNK'];
  const CONTEXT = {
    goal: ['explore', 'study', 'work', 'clarity', 'expression', 'prepare'],
    time: ['short', 'standard', 'unlimited'],
    support: ['choose', 'step', 'independent'],
    audio: ['off', 'available'],
  };
  const SIGNALS = ['need', 'due', 'trait'];
  const ANSWERS = ['yes', 'no', 'unsure'];
  const WINDOWS = ['immediate', 'd1', 'd7', 'd30'];
  const UNMEASURED = ['not_due', 'no_sample', 'unmeasurable'];
  const LEVER_CLASSES = ['shape', 'content'];
  const ARMS = ['adapted', 'baseline'];
  const DAY = 86400000, RECENT = 30 * DAY;
  const copy = value => JSON.parse(JSON.stringify(value));
  const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const k of Object.keys(value)) freeze(value[k]); }
    return value;
  };
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const unit = value => typeof value === 'number' && value >= 0 && value <= 1;
  const flag = value => value == null || typeof value === 'boolean';
  const ms = value => { const n = Date.parse(value); if (!Number.isFinite(n)) throw new TypeError('Atlas: invalid time'); return n; };
  const scopeKey = scope => {
    if (!scope || !DOMAINS.includes(scope.domain) || !validId(scope.subject) || !validId(scope.workspace)) throw new TypeError('Atlas: invalid scope');
    return `${scope.domain}/${scope.workspace}/${scope.subject}`;
  };
  // Seeded, platform-independent randomness. It only splits rounds into adapted and baseline arms.
  const random = seed => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  function validate(event) {
    if (!event || event.schema !== 1 || !validId(event.id)) throw new TypeError('Atlas: invalid event');
    scopeKey(event.scope); ms(event.at); ms(event.recordedAt);
    if (ms(event.recordedAt) < ms(event.at)) throw new TypeError('Atlas: recorded before occurrence');
    // PULSE does not turn listening/activity into a personal behavioural profile, so it keeps none.
    if (event.scope.domain === 'PULSE' && (isPractice(event) || ['signal.observed', 'estimate.responded', 'outcome.observed'].includes(event.type))) throw new TypeError('Atlas: PULSE keeps no personal observations');
    if (isPractice(event)) return trail().validate(event);
    if (event.type === 'context.set') {
      if (!Object.hasOwn(CONTEXT, event.field) || !(event.value === null || CONTEXT[event.field].includes(event.value))) throw new TypeError('Atlas: invalid context');
      if (event.until != null && ms(event.until) <= ms(event.at)) throw new TypeError('Atlas: invalid expiry');
    } else if (event.type === 'decision.made') {
      if (!validId(event.experienceId) || !validId(event.variant) || !POLICIES.includes(event.policy) || !Array.isArray(event.evidence) || !event.evidence.every(validId)) throw new TypeError('Atlas: invalid decision record');
      if (event.arm != null && !ARMS.includes(event.arm)) throw new TypeError('Atlas: invalid decision record');
      if (event.bundle != null && (typeof event.bundle !== 'object' || Array.isArray(event.bundle) || !Object.entries(event.bundle).every(([lever, pick]) => validId(lever) && pick && (pick.option === null || validId(pick.option))))) throw new TypeError('Atlas: invalid decision record');
    } else if (event.type === 'experience.completed') {
      if (!validId(event.decisionId) || !validId(event.experienceId) || !validId(event.variant)) throw new TypeError('Atlas: invalid completion');
    } else if (event.type === 'feedback.given') {
      if (!validId(event.completionId) || !['helpful', 'too_much', 'want_more', 'not_fit'].includes(event.value)) throw new TypeError('Atlas: invalid feedback');
    } else if (event.type === 'signal.observed') {
      // An adapter's summary of what was observed. Raw text, audio and identifiers never enter.
      if (!SIGNALS.includes(event.kind) || !validId(event.key) || !unit(event.strength) || !Number.isInteger(event.n) || event.n < 0 || !flag(event.assisted)) throw new TypeError('Atlas: invalid signal');
      if (event.until != null && ms(event.until) <= ms(event.at)) throw new TypeError('Atlas: invalid expiry');
      if (event.refs != null && !(Array.isArray(event.refs) && event.refs.length <= 20 && event.refs.every(validId))) throw new TypeError('Atlas: invalid signal');
    } else if (event.type === 'estimate.responded') {
      if (!validId(event.line) || !ANSWERS.includes(event.value)) throw new TypeError('Atlas: invalid estimate response');
    } else if (event.type === 'outcome.observed') {
      if (!validId(event.decisionId) || !validId(event.measure) || !WINDOWS.includes(event.window) || !flag(event.assisted)) throw new TypeError('Atlas: invalid outcome');
      if ((event.attemptId != null || event.targetLine != null)
        && (!validId(event.attemptId) || !validId(event.targetLine) || !/^(need|due):/.test(event.targetLine))) throw new TypeError('Atlas: outcome proof needs an attempt and target line');
      // No value is neither failure nor zero effect, so it must say why.
      if (!(unit(event.value) && event.reason == null) && !(event.value === null && UNMEASURED.includes(event.reason))) throw new TypeError('Atlas: outcome needs a value or a reason');
    } else if (event.type === 'record.excluded') {
      if (!validId(event.targetId)) throw new TypeError('Atlas: invalid exclusion');
    } else throw new TypeError('Atlas: unknown event');
    return event;
  }
  // Entries a session has admitted: validated once, owned by that session and frozen,
  // so reading its log again neither re-validates them nor re-parses their times.
  const admitted = new WeakMap();
  // Link checks look events up by id. A session answers from its own index; a bare log is scanned.
  const scan = events => ({
    byId: id => events.find(e => e.id === id),
    attempts: presentationId => {
      const stats = { count: 0, latest: -Infinity };
      for (const e of events) if (e.type === 'practice.attempted' && e.presentationId === presentationId) { stats.count += 1; stats.latest = Math.max(stats.latest, ms(e.at)); }
      return stats;
    },
    events,
  });
  // Check one event against a log without copying the log. False means an exact replay.
  function admit(events, event) { return admitWith(scan(events), event); }
  function admitWith(lookup, event) {
    // An entry another session already admitted is frozen and was validated then; its links
    // and ids are still checked against this log below.
    if (!admitted.has(event)) validate(event);
    // Ids are unique in an admitted log, so "the event with this id, of this type" is one lookup.
    const find = (id, type) => { const found = lookup.byId(id); return found && (!type || found.type === type) ? found : undefined; };
    const previous = lookup.byId(event.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(event)) throw new Error('Atlas: conflicting event id');
      return false;
    }
    if (isPractice(event)) {
      const t = trail();
      if (typeof t.link === 'function') t.link(event, lookup.byId(event.type === 'practice.presented' ? event.decisionId : event.presentationId), lookup.attempts(event.presentationId));
      else t.checkLink(lookup.events, event);
    }
    if (event.type === 'feedback.given') {
      const completion = find(event.completionId, 'experience.completed');
      if (!completion || scopeKey(completion.scope) !== scopeKey(event.scope) || ms(completion.at) > ms(event.at)) throw new Error('Atlas: feedback requires a prior completion in the same scope');
    }
    if (event.type === 'experience.completed') {
      const decision = find(event.decisionId, 'decision.made');
      if (!decision || scopeKey(decision.scope) !== scopeKey(event.scope) || decision.variant !== event.variant || decision.experienceId !== event.experienceId || ms(decision.at) > ms(event.at)) throw new Error('Atlas: completion requires the delivered decision');
    }
    if (event.type === 'outcome.observed') {
      const decision = find(event.decisionId, 'decision.made');
      if (!decision || scopeKey(decision.scope) !== scopeKey(event.scope) || ms(decision.at) > ms(event.at)) throw new Error('Atlas: outcome requires a prior decision in the same scope');
      if (event.attemptId != null) {
        const attempt = find(event.attemptId, 'practice.attempted');
        if (!attempt || scopeKey(attempt.scope) !== scopeKey(event.scope) || ms(attempt.at) > ms(event.at)
          || ms(attempt.recordedAt) > ms(event.recordedAt)) throw new Error('Atlas: outcome proof requires a prior attempt in the same scope');
      }
    }
    if (event.type === 'record.excluded') {
      const target = find(event.targetId);
      if (!target || target.type === 'record.excluded' || scopeKey(target.scope) !== scopeKey(event.scope)) throw new Error('Atlas: invalid exclusion target');
    }
    return true;
  }
  function append(events, event) {
    return admit(events, event) ? [...copy(events), copy(event)] : copy(events);
  }
  // Internal reading. understand() publishes the state; decide() also needs the decision history.
  function read(events, scope, asOf, recordedAsOf = asOf) {
    const key = scopeKey(scope), cutoff = ms(asOf), recordedCutoff = ms(recordedAsOf);
    // A session's own entries were validated when admitted; anything else is checked in full.
    const rows = [];
    let sorted = true, last = null;
    for (const e of events) {
      const known = admitted.get(e);
      if (!known) validate(e);
      const row = known || { key: scopeKey(e.scope), at: ms(e.at), recordedAt: ms(e.recordedAt) };
      if (row.key !== key || row.at > cutoff || row.recordedAt > recordedCutoff) continue;
      if (last && (row.at < last.at || (row.at === last.at && row.recordedAt < last.recordedAt))) sorted = false;
      rows.push({ e, at: row.at, recordedAt: row.recordedAt }); last = row;
    }
    // Stable sort preserves the append order when both clocks have the same
    // millisecond. Random IDs are identity, never a causal ordering clock.
    if (!sorted) rows.sort((a, b) => a.at - b.at || a.recordedAt - b.recordedAt);
    const ordered = rows.map(row => row.e);
    const excluded = new Set(ordered.filter(e => e.type === 'record.excluded').map(e => e.targetId));
    const context = {}, evidence = {}, expired = [], latest = {}, latestSignal = {}, latestAnswer = {}, lines = [];
    // Resolve newest declaration first. Its expiry must not resurrect an older declaration.
    for (const event of ordered) {
      if (event.type === 'context.set') latest[event.field] = event;
      if (event.type === 'signal.observed') latestSignal[`${event.kind}:${event.key}`] = event;
      if (event.type === 'estimate.responded') latestAnswer[event.line] = event;
    }
    for (const [field, event] of Object.entries(latest)) {
      if (excluded.has(event.id) || event.value === null) continue;
      if (event.until && ms(event.until) <= cutoff) { expired.push(field); continue; }
      context[field] = event.value; evidence[field] = event.id;
      lines.push({ key: `declared:${field}`, kind: 'declared', source: 'declared', value: event.value, at: event.at, until: event.until || null, evidence: [event.id], status: 'confirmed', usable: true });
    }
    // PULSE does not turn listening/activity into a personal behavioural profile.
    const personal = scope.domain !== 'PULSE';
    if (personal) for (const [line, event] of Object.entries(latestSignal)) {
      if (excluded.has(event.id)) continue;
      const until = event.until || new Date(ms(event.at) + RECENT).toISOString();
      if (ms(until) <= cutoff) { expired.push(line); continue; }
      const answer = latestAnswer[line] && !excluded.has(latestAnswer[line].id) ? latestAnswer[line] : null;
      // "No" to a guess about the person stays until they answer again. "No" to a need or a
      // due review only covers what had been observed by then; later evidence opens a new line.
      const denied = answer?.value === 'no' && (event.kind === 'trait' || ms(answer.at) >= ms(event.at));
      const status = denied ? 'denied' : answer?.value === 'yes' ? 'confirmed' : 'unconfirmed';
      const sufficiency = event.n >= 8 ? 'solid' : event.n >= 3 ? 'fair' : 'thin';
      lines.push({ key: line, kind: event.kind, source: 'observed', strength: event.strength, n: event.n, sufficiency, assisted: event.assisted ?? null, at: event.at, until,
        evidence: [event.id, ...(answer ? [answer.id] : [])], status, usable: !denied && (sufficiency !== 'thin' || status === 'confirmed') });
    }
    const completed = new Map(ordered.filter(e => e.type === 'experience.completed' && !excluded.has(e.id)).map(e => [e.id, e]));
    const responses = new Map();
    if (personal) for (const event of ordered) {
      if (event.type !== 'feedback.given' || !completed.has(event.completionId)) continue;
      if (cutoff - ms(event.at) > RECENT) continue;
      const completion = completed.get(event.completionId);
      // A changed answer moves to the end, so the list stays in order of the latest response.
      if (ms(completion.at) <= ms(event.at)) { responses.delete(event.completionId); responses.set(event.completionId, copy({ ...event, experienceId: completion.experienceId, variant: completion.variant })); }
    }
    const decisions = new Map(ordered.filter(e => e.type === 'decision.made' && !excluded.has(e.id)).map(e => [e.id, e]));
    const latestOutcome = new Map();
    // The newest report per decision, measure, window and target line: a proof for one
    // line is never replaced by a report about another line or by a proofless report.
    if (personal) for (const event of ordered) {
      if (event.type === 'outcome.observed' && !excluded.has(event.id) && decisions.has(event.decisionId)) latestOutcome.set(`${event.decisionId}|${event.measure}|${event.window}|${event.targetLine ?? ''}`, event);
    }
    // A round is one finished experience. Excluding a completion removes it as evidence, not as history.
    const rounds = {};
    for (const event of ordered) if (event.type === 'experience.completed') rounds[event.experienceId] = (rounds[event.experienceId] || 0) + 1;
    const state = { version: VERSION, scope: copy(scope), asOf, recordedAsOf, context, evidence, expired,
      feedback: [...responses.values()].filter(e => !excluded.has(e.id)), excluded: [...excluded], lines, outcomes: [...latestOutcome.values()].map(copy), rounds };
    return { state, cutoff, personal, decisions, completed };
  }
  function understand(events, scope, asOf, recordedAsOf = asOf) { return read(events, scope, asOf, recordedAsOf).state; }
  function checkLever(lever, seen) {
    const ids = new Set();
    if (!lever || !validId(lever.id) || seen.has(lever.id) || lever.id === 'mode' || !LEVER_CLASSES.includes(lever.class) || !Array.isArray(lever.options) || !lever.options.length) throw new TypeError('Atlas: invalid lever');
    for (const option of lever.options) { if (!option || !validId(option.id) || ids.has(option.id)) throw new TypeError('Atlas: invalid lever'); ids.add(option.id); }
    if (lever.default != null && !ids.has(lever.default)) throw new TypeError('Atlas: invalid lever');
    if (lever.follows != null && !Object.hasOwn(CONTEXT, lever.follows)) throw new TypeError('Atlas: invalid lever');
    // Content is never tried at random, and a shape can only learn from a declared starting point.
    if (lever.learn && (lever.class !== 'shape' || lever.default == null)) throw new TypeError('Atlas: invalid lever');
    seen.add(lever.id);
  }
  const picked = (decision, leverId) => decision.bundle?.[leverId]?.option ?? (leverId === 'mode' ? decision.variant : undefined);
  function decide({ events = [], scope, at, recordedAt = at, experienceId, candidates, levers = [], explore = 0 }) {
    if (!validId(experienceId) || !Array.isArray(candidates) || !candidates.length) throw new TypeError('Atlas: candidates required');
    if (!Array.isArray(levers) || typeof explore !== 'number' || !(explore >= 0 && explore <= 0.5)) throw new TypeError('Atlas: invalid decision input');
    const seen = new Set(); for (const lever of levers) checkLever(lever, seen);
    const view = read(events, scope, at, recordedAt), state = view.state, c = state.context;
    const round = state.rounds[experienceId] || 0, seed = `${scopeKey(scope)}|${experienceId}|${round}`;
    // Every replan inside one round lands in the same arm. The baseline arm ignores observed lines,
    // responses and learned weights so the two arms can be compared later; declared settings always hold.
    const share = view.personal ? explore : 0, arm = random(seed)() < share ? 'baseline' : 'adapted', adapted = arm === 'adapted';
    const ids = new Set();
    const feasible = item => !(c.audio === 'off' && item.requiresAudio) && !(c.time === 'short' && item.minutes > 5)
      && !(c.support && item.supports && !item.supports.includes(c.support));
    const eligible = candidates.filter(item => {
      if (!validId(item.id) || ids.has(item.id) || !Number.isFinite(item.minutes) || item.minutes <= 0 || !['short', 'standard', 'deep'].includes(item.pace)
        || (item.supports != null && (!Array.isArray(item.supports) || !item.supports.length || item.supports.some(value => !CONTEXT.support.includes(value))))) throw new TypeError('Atlas: invalid candidate');
      ids.add(item.id);
      return feasible(item);
    });
    const reasons = [], evidence = Object.values(state.evidence);
    if (c.time === 'short') reasons.push('time.short');
    if (c.audio === 'off') reasons.push('audio.off');
    if (c.goal) reasons.push(`goal.${c.goal}`);
    if (c.support) reasons.push(`support.${c.support}`);
    if (!adapted) reasons.push('arm.baseline');
    if (!eligible.length) return { version: VERSION, status: 'unavailable', scope: copy(scope), experienceId, at, reasons: [...reasons, 'no.feasible.experience'], evidence, alternatives: [], selected: null };
    const usable = adapted ? state.lines.filter(line => line.source === 'observed' && line.usable) : [];
    const mine = [...view.completed.values()].filter(done => done.experienceId === experienceId && view.decisions.has(done.decisionId));
    const last = mine.at(-1) ? view.decisions.get(mine.at(-1).decisionId) : null;
    let performance = false;
    const performanceProof = [];
    const attempts = state.outcomes.some(o => o.attemptId) ? new Map(trail().summarize(events, { scope, asOf: at, recordedAsOf: recordedAt }).attempts.map(item => [item.eventId, item])) : new Map();
    // A curriculum need is keyed by its Strata node (`need:skill.<id>` or `need:node.<id>`),
    // so a practice attempt proves it only through the same node in its conceptIds.
    const improved = (leverId, optionId, line) => state.outcomes.find(o => {
      if (o.value == null || o.value < 0.8 || o.assisted !== false || o.measure !== 'independent'
        || o.targetLine !== line.key || view.cutoff - ms(o.at) > RECENT || ms(o.at) < ms(line.at)
        || picked(view.decisions.get(o.decisionId), leverId) !== optionId) return false;
      const attempt = attempts.get(o.attemptId);
      const concept = line.key.replace(/^(need|due):/, '').replace(/^(skill|node)\./, '');
      return attempt && attempt.decisionId === o.decisionId && attempt.exposure === 'new'
        && attempt.independent === true && attempt.assisted === false && attempt.verdict === 'correct'
        && attempt.conceptIds.includes(concept) && ms(attempt.at) >= ms(line.at)
        && ms(attempt.at) <= ms(o.at) && ms(attempt.recordedAt) <= ms(o.recordedAt)
        && view.cutoff - ms(attempt.at) <= RECENT;
    });
    const aim = (leverId, option, content, notes, proof) => {
      let total = 0, due = false;
      for (const line of usable) if (option.targets?.includes(line.key)) {
        let weight = line.kind === 'due' ? 2 + 2 * line.strength : 4 * line.strength;
        if (line.kind === 'due') due = true;
        // An independent success on this aim lowers it until a newer observation says otherwise.
        const result = content ? improved(leverId, option.id, line) : null;
        if (result) {
          weight *= 0.5; performance = true; notes.push('outcome.improved');
          const refs = [result.id, result.attemptId, attempts.get(result.attemptId).presentationId, ...line.evidence];
          proof.push(...refs); performanceProof.push(...refs);
        }
        total += weight; notes.push(`line.${line.key}`); proof.push(...line.evidence);
      }
      return { total, due };
    };
    const feedback = adapted ? state.feedback.filter(f => f.experienceId === experienceId) : [];
    const recent = feedback.at(-1);
    const targetPace = c.time === 'short' ? 'short' : recent?.value === 'too_much' ? 'short' : recent?.value === 'want_more' && c.time !== 'short' ? 'deep' : 'standard';
    // An explicit request for another way must not lose to the old goal weight. Every way
    // whose latest answer was "not for me" stays out while a feasible alternative remains;
    // if all were refused, at least the one just refused is not offered straight back.
    const latest = new Map(feedback.map(f => [f.variant, f.value]));
    const another = recent?.value === 'not_fit' ? eligible.filter(item => latest.get(item.id) !== 'not_fit') : [];
    const fallback = recent?.value === 'not_fit' && !another.length ? eligible.filter(item => item.id !== recent.variant) : [];
    const selectable = another.length ? another : fallback.length ? fallback : eligible;
    if (recent?.value === 'not_fit') reasons.push(another.length || fallback.length ? 'feedback.alternative' : 'feedback.no_alternative');
    const scored = selectable.map(item => {
      const notes = [], proof = [];
      let score = item.pace === targetPace ? 4 : 0;
      if (c.goal && item.goals?.includes(c.goal)) score += 3;
      const same = feedback.filter(f => f.variant === item.id).slice(-3);
      score += same.reduce((n, f) => n + (f.value === 'helpful' ? 1 : f.value === 'not_fit' ? -2 : 0), 0);
      score += aim('mode', item, false, notes, proof).total;
      return { item, score, notes, proof };
    }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
    if (recent) { reasons.push(`feedback.${recent.value}`); evidence.push(recent.id, recent.completionId); }
    for (const f of feedback) if (['helpful', 'not_fit'].includes(f.value)) evidence.push(f.id, f.completionId);
    evidence.push(...scored[0].proof);
    const bundle = { mode: { option: scored[0].item.id, basis: !adapted ? 'baseline' : scored[0].notes.length ? 'line' : recent ? 'response' : 'setting', reasons: scored[0].notes, evidence: scored[0].proof } };
    // How a way of working went for this person: helpful counts for it, not_fit against it.
    // too_much and want_more only steer ordered amounts above. A finished round with no answer is a weak yes.
    const tally = (leverId, optionId) => {
      let s = 0, f = 0, helped = 0; const proof = [];
      for (const done of mine) {
        if (view.cutoff - ms(done.at) > RECENT || picked(view.decisions.get(done.decisionId), leverId) !== optionId) continue;
        const answer = state.feedback.find(item => item.completionId === done.id);
        if (!answer) s += 0.25; else if (answer.value === 'helpful') { s += 1; helped += 1; proof.push(answer.id, done.id); } else if (answer.value === 'not_fit') { f += 1; proof.push(answer.id, done.id); }
      }
      return { s, f, helped, proof };
    };
    for (const lever of [...levers].sort((a, b) => a.id.localeCompare(b.id))) {
      const options = lever.options.filter(feasible), content = lever.class === 'content';
      if (!options.length) { bundle[lever.id] = { option: null, basis: 'unavailable', reasons: ['no.feasible.option'], evidence: [] }; continue; }
      const declared = lever.follows && c[lever.follows] != null ? options.find(option => option.id === c[lever.follows]) : null;
      if (declared) { bundle[lever.id] = { option: declared.id, basis: 'declared', reasons: [`declared.${lever.follows}`], evidence: [state.evidence[lever.follows]] }; continue; }
      const turn = index => (index - round % options.length + options.length) % options.length;
      if (!adapted) {
        const option = content ? options.find((_, index) => turn(index) === 0) : options.find(item => item.id === lever.default) || options[0];
        bundle[lever.id] = { option: option.id, basis: 'baseline', reasons: ['arm.baseline'], evidence: [] }; continue;
      }
      const before = last ? picked(last, lever.id) : undefined;
      const tallies = new Map(lever.learn ? options.map(option => [option.id, tally(lever.id, option.id)]) : []);
      const ranked = options.map((option, index) => {
        const notes = [], proof = []; let score = 0, basis = null;
        if (c.goal && option.goals?.includes(c.goal)) { score += 3; notes.push(`goal.${c.goal}`); proof.push(state.evidence.goal); basis = 'goal'; }
        const aimed = aim(lever.id, option, content, notes, proof);
        if (aimed.total) { score += aimed.total; basis = 'line'; }
        if (content) { if (before === option.id && !aimed.due) { score -= 2; notes.push('spacing'); } }
        else {
          if (option.id === lever.default) score += 0.5;
          if (lever.learn) {
            // Keep what works; when it stops working the less-tried way gets its turn. No coin flips.
            const t = tallies.get(option.id), a = (option.id === lever.default ? 2 : 1) + t.s, b = 1 + t.f;
            score += 3 * a / (a + b) + 1 / Math.sqrt(1 + t.s + t.f);
          }
        }
        return { option, score, notes, proof, basis, order: content ? turn(index) : index };
      // Ties: content takes the round's turn, a shape takes the adapter's own order.
      }).sort((a, b) => b.score - a.score || a.order - b.order);
      const best = ranked[0], answered = [...tallies.values()].filter(t => t.proof.length);
      if (answered.length && !best.basis) {
        // Say which kind of learning it was, so the reason shown to the person stays true.
        const away = best.option.id !== lever.default && tallies.get(lever.default)?.f >= 1;
        best.basis = 'learned'; best.notes.push('learned', tallies.get(best.option.id).helped ? 'learned.works' : away ? 'learned.switch' : 'learned.keep');
        for (const t of answered) best.proof.push(...t.proof);
      }
      bundle[lever.id] = { option: best.option.id, basis: best.basis || (content ? 'rotation' : 'default'), reasons: best.notes.length ? best.notes : [content ? 'rotation' : 'default'], evidence: [...new Set(best.proof)] };
      evidence.push(...best.proof);
    }
    const following = levers.find(lever => lever.follows === 'support');
    evidence.push(...performanceProof);
    return { version: VERSION, status: 'ready', scope: copy(scope), experienceId, at, selected: copy(scored[0].item),
      support: (following && bundle[following.id].option) || c.support || 'choose', focus: c.goal || 'explore', reasons, evidence: [...new Set(evidence)],
      alternatives: scored.slice(1).map(s => s.item.id), outcomeBasis: performance ? 'performance' : recent ? 'self_report' : 'unobserved',
      arm, round, seed, explore: share, bundle };
  }
  // Standalone or connected: with no ready plan an engine keeps its own default.
  const choice = (plan, leverId, fallback = null) => (plan && plan.status === 'ready' && plan.bundle?.[leverId]?.option) || fallback;
  function createSession({ scope, events = [], clock = () => new Date().toISOString(), id, explore = 0 } = {}) {
    scopeKey(scope);
    // The owner is fixed for this session, even if the host reuses and edits its
    // input object while switching accounts or workspaces.
    scope = copy(scope);
    // The session owns its log. Appending checks one event against an id index and never
    // copies or rescans the whole log, so a fast game with a long history stays cheap.
    // events() returns copies; snapshot() returns the frozen entries themselves.
    let log = [], frozen = null;
    const byId = new Map(), attemptStats = new Map(), completions = new Map();
    const lookup = { byId: id => byId.get(id), attempts: presentationId => attemptStats.get(presentationId) || { count: 0, latest: -Infinity },
      get events() { return log; } };
    const index = entry => {
      if (entry.type === 'practice.attempted') {
        const stats = lookup.attempts(entry.presentationId);
        attemptStats.set(entry.presentationId, { count: stats.count + 1, latest: Math.max(stats.latest, admitted.get(entry)?.at ?? ms(entry.at)) });
      }
      if (entry.type === 'experience.completed' && !completions.has(entry.decisionId)) completions.set(entry.decisionId, entry);
    };
    const store = event => {
      // An admitted entry is immutable, so a new session (after folding, for example) can
      // hold the same object instead of copying it again.
      if (admitted.has(event)) { byId.set(event.id, event); index(event); log.push(event); frozen = null; return; }
      const entry = copy(event);
      // The entry is never handed out or changed again, so it is checked once and frozen.
      // Trail may load later (it is only needed for practice); until then entries stay unvouched.
      const t = getTrail();
      if (typeof t?.vouch === 'function') t.vouch(entry);
      else freeze(entry);
      admitted.set(entry, { key: scopeKey(entry.scope), at: ms(entry.at), recordedAt: ms(entry.recordedAt) });
      byId.set(entry.id, entry); index(entry);
      log.push(entry); frozen = null;
    };
    for (const event of events) {
      if (scopeKey(event.scope) !== scopeKey(scope)) throw new Error('Atlas: scope mismatch');
      if (admitWith(lookup, event)) store(event);
    }
    let sequence = 0;
    const nextId = id || (() => `a${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    const record = body => {
      const at = clock(), event = { ...body, schema: 1, scope: copy(scope), id: nextId(), at, recordedAt: at };
      // The caller's nested values (lists, snapshots) are detached before they enter the log.
      if (admitWith(lookup, event)) store(event);
      return copy(event);
    };
    return {
      events: () => copy(log),
      snapshot: () => frozen || (frozen = Object.freeze(log.slice())),
      set: (field, value, until = null) => record({ type: 'context.set', field, value, until }),
      observe: signal => record({ type: 'signal.observed', kind: signal?.kind, key: signal?.key, strength: signal?.strength, n: signal?.n, assisted: signal?.assisted ?? null, until: signal?.until ?? null, refs: signal?.refs ?? [] }),
      respond: (line, value) => record({ type: 'estimate.responded', line, value }),
      plan: (experienceId, candidates, options = {}) => {
        const levers = options.levers || [];
        const decision = decide({ events: log, scope, at: clock(), experienceId, candidates, levers, explore });
        if (decision.status !== 'ready') return decision;
        const recorded = record({ type: 'decision.made', experienceId, variant: decision.selected.id, policy: VERSION,
          evidence: decision.evidence, reasons: decision.reasons, alternatives: decision.alternatives,
          support: decision.support, focus: decision.focus, candidateSnapshot: copy(candidates),
          arm: decision.arm, round: decision.round, seed: decision.seed, explore: decision.explore, bundle: copy(decision.bundle), leverSnapshot: copy(levers) });
        return { ...decision, id: recorded.id };
      },
      complete: decision => {
        if (!decision || decision.status !== 'ready' || scopeKey(decision.scope) !== scopeKey(scope)) throw new Error('Atlas: invalid decision');
        const existing = completions.get(decision.id);
        return existing ? copy(existing) : record({ type: 'experience.completed', decisionId: decision.id, experienceId: decision.experienceId, variant: decision.selected.id });
      },
      feedback: (completionId, value) => record({ type: 'feedback.given', completionId, value }),
      practice: (kind, fields) => {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields) || typeof kind !== 'string') throw new TypeError('Atlas: invalid practice fields');
        return record({ ...fields, type: kind.startsWith('practice.') ? kind : `practice.${kind}` });
      },
      outcome: (decisionId, result) => record({ type: 'outcome.observed', decisionId, measure: result?.measure, window: result?.window, value: result?.value ?? null, reason: result?.reason ?? null, assisted: result?.assisted ?? null,
        ...(result?.attemptId != null || result?.targetLine != null ? { attemptId: result?.attemptId, targetLine: result?.targetLine } : {}) }),
      exclude: targetId => record({ type: 'record.excluded', targetId }),
      clear: () => { log = []; frozen = null; byId.clear(); attemptStats.clear(); completions.clear(); },
      state: () => understand(log, scope, clock()),
      lines: () => understand(log, scope, clock()).lines,
    };
  }
  return Object.freeze({ VERSION, POLICIES, CONTEXT, validate, append, understand, decide, choice, createSession });
});
