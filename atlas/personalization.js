/* Core adapter for voluntary settings shared by product implementations.
 * Pure: the host owns identity, permission, consent UI, storage, clock and deletion.
 * This is not another engine. Core owns selection and feedback; Trail owns practice
 * evidence, Strata owns content mappings, Vellum owns wording, Temper owns measurement.
 * A setting is a reversible declaration, never evidence of ability or a fixed trait.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'), () => require('./domain'));
  else root.SynkAtlasPersonalization = factory(root.SynkAtlas, () => root.SynkAtlasDomain);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, getDomain) {
  'use strict';
  if (!Core?.createSession) throw new TypeError('Personalization: load Core first');
  const VERSION = 'core-personalization-1';
  const OPTIONS = Object.freeze({
    goal: Object.freeze(['explore', 'study', 'work', 'clarity', 'expression', 'prepare']),
    experience: Object.freeze(['new', 'familiar', 'practiced']),
    support: Object.freeze(['choose', 'step', 'independent']),
    audio: Object.freeze(['off', 'available']),
    textSize: Object.freeze(['standard', 'large']),
    explanation: Object.freeze(['brief', 'standard', 'detailed']),
    motion: Object.freeze(['full', 'reduced']),
  });
  const DEFAULT_PRESENTATION = Object.freeze({ textSize: 'standard', explanation: 'standard', motion: 'full', support: 'choose', audio: 'available' });
  // Learning reasons a person may declare (계약/배우는이유_선택응답_계약.json r1, 공개판 설계 #learn-reasons).
  // A reason shapes situations, examples and exam guidance through the broad goal below; it is
  // never evidence of ability, level, age or gender. `other` has no goal and its text stays with the host.
  const REASON_GOAL = Object.freeze({ culture: 'explore', travel: 'expression', people: 'expression', life: 'expression',
    study: 'study', work: 'work', career: 'work', exam: 'prepare', hobby: 'explore', other: null });
  const REASONS = Object.freeze(Object.keys(REASON_GOAL));
  const MAX_REASONS = 3;
  const FIELDS = Object.freeze([...Object.keys(OPTIONS), 'minutes', 'reasons', 'primaryReason']);
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new TypeError(`Personalization: ${message}`); };
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const exact = (value, keys) => record(value) && Object.keys(value).every(key => keys.includes(key));
  const token = (value, max = 48) => typeof value === 'string' && new RegExp(`^[a-zA-Z0-9_.-]{1,${max}}$`).test(value);
  function instant(at) {
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) fail('use an explicit ISO UTC time');
    return Date.parse(at);
  }
  function checkScope(scope) {
    if (!exact(scope, ['personId', 'productId', 'contextId', 'domain']) || Object.keys(scope).length !== 4
      || !token(scope.personId, 120) || !token(scope.productId) || !token(scope.contextId)
      || !['LAB', 'SHIFT', 'PATH', 'PULSE', 'SYNK'].includes(scope.domain)) fail('invalid person/product/context scope');
    return scope;
  }
  const scopeKey = scope => JSON.stringify([scope.personId, scope.productId, scope.contextId, scope.domain]);
  function checkValues(values, patch = false) {
    if (!exact(values, FIELDS)) fail('unsupported setting (identity, age and gender are not personalization inputs)');
    for (const [field, value] of Object.entries(values)) {
      if (patch && value === null) continue;
      if (field === 'reasons') {
        if (!Array.isArray(value) || !value.length || value.length > MAX_REASONS || new Set(value).size !== value.length
          || value.some(reason => !REASONS.includes(reason))) fail('invalid reasons (choose one to three known reasons)');
      } else if (field === 'primaryReason') {
        if (!REASONS.includes(value)) fail('invalid primaryReason');
      } else if (field === 'minutes' ? !Number.isInteger(value) || value < 1 || value > 240 : !OPTIONS[field].includes(value)) fail(`invalid ${field}`);
    }
    return values;
  }
  // Reasons are unordered: store them in the shared contract order so no position reads as a ranking.
  const canonicalReasons = reasons => REASONS.filter(reason => reasons.includes(reason));
  // The one broad goal Core may act on: an explicit goal, else the reason the person named as the
  // biggest, else the goal all declared reasons share. Several different goals stay undecided.
  function reasonGoals(values) {
    return [...new Set((values.reasons || []).map(reason => REASON_GOAL[reason]).filter(Boolean))];
  }
  function declaredGoal(values) {
    if (values.goal) return values.goal;
    if (values.primaryReason) return REASON_GOAL[values.primaryReason];
    const goals = reasonGoals(values);
    return goals.length === 1 ? goals[0] : null;
  }
  function checkProfile(profile) {
    const keys = ['version', 'scope', 'revision', 'generation', 'status', 'consent', 'values', 'provenance', 'createdAt', 'updatedAt'];
    if (!exact(profile, keys) || keys.some(key => !Object.hasOwn(profile, key)) || profile.version !== VERSION
      || !Number.isSafeInteger(profile.revision) || profile.revision < 0
      || !Number.isSafeInteger(profile.generation) || profile.generation < 0 || profile.generation > 999999999
      || !['new', 'active', 'skipped', 'disabled', 'deleted'].includes(profile.status)
      || typeof profile.consent !== 'boolean' || (profile.status === 'active') !== profile.consent) fail('invalid profile');
    checkScope(profile.scope); checkValues(profile.values);
    if (Object.hasOwn(profile.values, 'primaryReason') && !(profile.values.reasons || []).includes(profile.values.primaryReason)) fail('primary reason must be one of the declared reasons');
    if (instant(profile.updatedAt) < instant(profile.createdAt)) fail('profile time reversal');
    if (!exact(profile.provenance, Object.keys(profile.values)) || Object.keys(profile.values).some(key => !Object.hasOwn(profile.provenance, key))) fail('invalid provenance');
    for (const source of Object.values(profile.provenance)) {
      if (!exact(source, ['source', 'confidence', 'at', 'revision']) || Object.keys(source).length !== 4
        || source.source !== 'self-declared' || source.confidence !== 'declared'
        || !Number.isSafeInteger(source.revision) || source.revision < 1 || source.revision > profile.revision
        || instant(source.at) < instant(profile.createdAt) || instant(source.at) > instant(profile.updatedAt)) fail('invalid declared source');
    }
    if (!profile.consent && Object.keys(profile.values).length) fail('unconsented stored settings');
    return profile;
  }
  function atOrAfter(profile, at) {
    if (instant(at) < instant(profile.updatedAt)) fail('stale update time');
  }
  function createProfile({ scope, at } = {}) {
    checkScope(scope); instant(at);
    return { version: VERSION, scope: copy(scope), revision: 0, generation: 0, status: 'new', consent: false,
      values: {}, provenance: {}, createdAt: at, updatedAt: at };
  }
  function updateProfile(profile, patch, at) {
    checkProfile(profile); atOrAfter(profile, at);
    if (!exact(patch, ['values', 'consent', 'expectedRevision']) || !Object.hasOwn(patch, 'values')
      || (Object.hasOwn(patch, 'consent') && typeof patch.consent !== 'boolean')
      || (Object.hasOwn(patch, 'expectedRevision') && !Number.isSafeInteger(patch.expectedRevision))) fail('invalid update');
    // A host that passes the revision its edit was made from has an edit from an older copy
    // refused (another device changed the profile meanwhile) instead of silently written over.
    // Clearing never needs it: forgetting a profile always wins.
    if (Object.hasOwn(patch, 'expectedRevision') && patch.expectedRevision !== profile.revision) {
      throw Object.assign(new Error('Personalization: the profile changed since this edit began'), { code: 'PROFILE_CONFLICT' });
    }
    checkValues(patch.values, true);
    if (patch.consent === false) return clearProfile(profile, { mode: 'disable', at });
    if (!(patch.consent === true || profile.consent)) fail('explicit consent required before remembering settings');
    const next = copy(profile);
    next.revision += 1; next.updatedAt = at;
    // Forgetting one setting also starts a clean decision history. A host that
    // replaces its stored events with the returned array will not retain the
    // removed value inside older Core context or decision snapshots.
    if (!next.consent || Object.entries(patch.values).some(([field, value]) => value === null && Object.hasOwn(next.values, field))) next.generation += 1;
    next.status = 'active'; next.consent = true;
    for (const [field, value] of Object.entries(patch.values)) {
      if (value === null) { delete next.values[field]; delete next.provenance[field]; }
      else {
        next.values[field] = field === 'reasons' ? canonicalReasons(value) : value;
        next.provenance[field] = { source: 'self-declared', confidence: 'declared', at, revision: next.revision };
      }
    }
    // A biggest reason cannot outlive the reasons it was chosen from. Naming it together with
    // reasons that leave it out is a host error; changing the reasons later forgets it, which
    // (like any forgotten setting) starts a clean decision history.
    if (Object.hasOwn(next.values, 'primaryReason') && !(next.values.reasons || []).includes(next.values.primaryReason)) {
      if (patch.values.primaryReason != null) fail('primary reason must be one of the declared reasons');
      delete next.values.primaryReason; delete next.provenance.primaryReason;
      if (next.generation === profile.generation) next.generation += 1;
    }
    return copy(checkProfile(next));
  }
  function clearProfile(profile, { mode = 'delete', at } = {}) {
    checkProfile(profile); atOrAfter(profile, at);
    const statuses = { skip: 'skipped', disable: 'disabled', delete: 'deleted' };
    if (!Object.hasOwn(statuses, mode)) fail('invalid clear mode');
    // Keep a content-free revision tombstone. Hosts must also erase the event log;
    // the generation prevents accidentally restored old feedback becoming usable.
    return checkProfile({ ...copy(profile), revision: profile.revision + 1, generation: profile.generation + 1,
      status: statuses[mode], consent: false, values: {}, provenance: {}, updatedAt: at });
  }
  function coreScope(profile) {
    const { scope, generation } = checkProfile(profile);
    return { domain: scope.domain, subject: scope.personId, workspace: `p.${scope.productId}:c.${scope.contextId}:g.${generation}` };
  }
  function owned(profile, scope) {
    checkProfile(profile); checkScope(scope);
    if (scopeKey(profile.scope) !== scopeKey(scope)) fail('profile belongs to another person, product or context');
  }
  function history(profile, scope, events, at) {
    owned(profile, scope); atOrAfter(profile, at);
    if (!Array.isArray(events) || events.length > 10000) fail('invalid event history');
    const expected = coreScope(profile), prefix = `p.${scope.productId}:c.${scope.contextId}:g.`;
    for (const event of events) {
      Core.validate(event);
      if (event.scope.domain !== expected.domain || event.scope.subject !== expected.subject || !event.scope.workspace.startsWith(prefix)
        || !/^\d+$/.test(event.scope.workspace.slice(prefix.length))) fail('foreign event history');
      if (instant(event.at) > instant(at) || instant(event.recordedAt) > instant(at)) fail('future event history');
      if (!['context.set', 'decision.made', 'experience.completed', 'feedback.given', 'record.excluded'].includes(event.type)) fail('use the owning practice adapter for observations');
    }
    return profile.consent ? copy(events.filter(event => event.scope.workspace === expected.workspace)) : [];
  }
  function session(profile, events, at) {
    let sequence = events.length;
    const ids = new Set(events.map(event => event.id));
    return Core.createSession({ scope: coreScope(profile), events, clock: () => at, id: () => {
      let value;
      do { value = `p${profile.generation}-${instant(at).toString(36)}-${++sequence}`; } while (ids.has(value));
      ids.add(value); return value;
    } });
  }
  function presentationFor(values) {
    return { ...DEFAULT_PRESENTATION, support: values.experience === 'new' ? 'step' : 'choose',
      ...Object.fromEntries(Object.entries(values).filter(([key]) => Object.hasOwn(DEFAULT_PRESENTATION, key))) };
  }
  function checkCandidates(candidates) {
    if (!Array.isArray(candidates) || !candidates.length || candidates.length > 500) fail('candidates required');
    const seen = new Set();
    for (const item of candidates) {
      if (!exact(item, ['id', 'minutes', 'pace', 'goals', 'requiresAudio', 'experiences', 'supports'])
        || !token(item.id, 120) || seen.has(item.id) || !Number.isFinite(item.minutes) || item.minutes <= 0
        || !['short', 'standard', 'deep'].includes(item.pace)
        || (item.goals != null && (!Array.isArray(item.goals) || item.goals.some(goal => !OPTIONS.goal.includes(goal))))
        || (item.requiresAudio != null && typeof item.requiresAudio !== 'boolean')
        || (item.supports != null && (!Array.isArray(item.supports) || !item.supports.length || item.supports.some(value => !OPTIONS.support.includes(value))))
        || (item.experiences != null && (!Array.isArray(item.experiences) || !item.experiences.length || item.experiences.some(value => !OPTIONS.experience.includes(value))))) fail('invalid candidate');
      seen.add(item.id);
    }
  }
  function selectPersonalization({ profile, scope, candidates, experienceId, events = [], at } = {}) {
    const prior = history(profile, scope, events, at);
    checkCandidates(candidates);
    if (!token(experienceId, 120)) fail('invalid experience id');
    const values = profile.consent ? copy(profile.values) : {}, presentation = presentationFor(values), current = session(profile, prior, at);
    // Project declarations into the existing Core vocabulary; no parallel ranking.
    const settings = { goal: declaredGoal(values), time: values.minutes == null ? null : values.minutes <= 5 ? 'short' : 'standard',
      support: values.support ?? null, audio: values.audio ?? null };
    const apply = (target, wanted) => {
      const previous = target.state().context;
      for (const [field, value] of Object.entries(wanted)) if ((previous[field] ?? null) !== value) target.set(field, value);
    };
    apply(current, settings);
    const mixedGoals = settings.goal == null ? reasonGoals(values) : [];
    let eligible = candidates.filter(item => (values.minutes == null || item.minutes <= values.minutes)
      && (!values.experience || !item.experiences || item.experiences.includes(values.experience)));
    // A help style derived from the declared experience prefers fitting ways of working; it is
    // never stored as the person's own choice, and it never empties the list.
    if (values.support == null && presentation.support !== 'choose') {
      const fitting = eligible.filter(item => !item.supports || item.supports.includes(presentation.support));
      if (fitting.length) eligible = fitting;
    }
    const constraints = [];
    if (values.minutes != null) constraints.push('time.limit');
    if (values.experience != null) constraints.push('experience.declared');
    if (values.reasons) constraints.push('reasons.declared');
    if (mixedGoals.length > 1) constraints.push('reasons.mixed');
    // Reasons pointing to different goals are not ranked by guesswork. Core offers "today's one
    // question" (atlas/ask.js) only when naming the biggest reason would change this very plan;
    // each answer is tried in a throwaway session so no trial decision enters the history.
    let ask = null;
    if (mixedGoals.length > 1 && eligible.length) {
      const outcomes = new Set(mixedGoals.map(goal => {
        const trial = session(profile, copy(prior), at);
        apply(trial, { ...settings, goal });
        return trial.plan(experienceId, copy(eligible)).selected?.id ?? null;
      }));
      if (outcomes.size > 1) ask = { id: 'reasons.primary', kind: 'choice', about: 'primaryReason',
        options: values.reasons.filter(reason => REASON_GOAL[reason]).map(reason => ({ id: reason })) };
    }
    const plan = eligible.length ? current.plan(experienceId, copy(eligible)) : {
      version: Core.VERSION, status: 'unavailable', scope: coreScope(profile), experienceId, at,
      selected: null, alternatives: [], reasons: ['no.feasible.experience'], evidence: [],
    };
    const reasons = [...new Set([...plan.reasons, ...constraints])];
    const chosen = plan.selected?.supports;
    if (chosen && !chosen.includes(presentation.support)) presentation.support = chosen.includes('choose') ? 'choose' : chosen[0];
    const returned = profile.consent ? current.events() : [];
    const basis = plan.outcomeBasis === 'self_report' ? 'self-reported-feedback' : Object.keys(values).length ? 'self-declared' : 'cold-start';
    return { version: VERSION, profile: copy(profile), values, presentation, plan: copy(plan), events: returned, reasons, ask,
      provenance: copy(profile.provenance), explanation: { basis, confidence: basis === 'cold-start' ? 'unknown' : 'declared',
        learningEffectClaim: false, abilityClaim: false, reasons, evidence: copy(plan.evidence), revision: profile.revision },
      persistence: profile.consent ? 'consented-product-context' : 'none' };
  }
  function feedbackSession(options) {
    const { profile, scope, events = [], at } = options;
    const prior = history(profile, scope, events, at);
    if (!profile.consent) fail('feedback memory requires consent');
    if (scope.domain === 'PULSE') fail('PULSE does not learn a personal behavioral profile');
    return session(profile, prior, at);
  }
  function recordCompletion(options = {}) {
    const current = feedbackSession(options);
    const decision = current.events().find(event => event.type === 'decision.made' && event.id === options.decisionId);
    if (!decision) fail('unknown decision');
    current.complete({ ...decision, status: 'ready', selected: { id: decision.variant } });
    return current.events();
  }
  function recordFeedback(options = {}) {
    const current = feedbackSession(options);
    const completed = current.events().find(event => event.type === 'experience.completed' && event.id === options.completionId);
    if (!completed) fail('use a completed recommendation before feedback');
    if (!['helpful', 'not_fit', 'too_much', 'want_more'].includes(options.value)) fail('invalid feedback');
    current.feedback(completed.id, options.value);
    return current.events();
  }
  // Product-declared preferences, separate from the learning profile above. The host
  // authenticates the actor, authorizes remembering these choices, and verifies the
  // feedback reference. A proposal is never a fact or an inferred personal trait.
  const PREFERENCE_VERSION = 'core-preference-context-1';
  const preferenceToken = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value)
    && !['__proto__', 'prototype', 'constructor'].includes(value);
  const canonical = value => JSON.stringify(value, (_key, item) => record(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  const PREFERENCE_KEYS = Object.freeze({ set: ['field', 'value', 'duration'], withdraw: ['field', 'duration'], reset: [], close: [],
    propose: ['field', 'value', 'feedbackId'], apply: ['proposalId', 'duration'], dismiss: ['proposalId'] });
  const preferenceOptional = kind => ['set', 'apply'].includes(kind) ? ['until'] : [];
  const preferenceBase = ['version', 'id', 'scope', 'contract', 'encounterId', 'at', 'kind', 'source'];
  function preferenceReplay({ contract, scope, events = [], encounterId, at } = {}) {
    checkScope(scope); instant(at);
    if (!preferenceToken(encounterId)) fail('invalid preference encounter');
    const domain = getDomain();
    if (!domain?.validateContract) fail('load Core domain capability first');
    const fields = domain.validateContract(contract), reference = { id: contract.id, version: contract.version, purpose: contract.purpose };
    if (!Array.isArray(events) || events.length > 10000) fail('invalid preference history');
    const ongoing = new Map(), once = new Map(), pending = new Map(), closed = new Set(), seen = new Map(), unique = [];
    let previousAt = -Infinity;
    const clearPendingField = field => { for (const [id, event] of pending) if (event.field === field) pending.delete(id); };
    const onceFor = id => { if (!once.has(id)) once.set(id, new Map()); return once.get(id); };
    const isValue = (field, value) => field.kind === 'enum' ? field.values.includes(value)
      : field.kind === 'boolean' ? typeof value === 'boolean'
        : typeof value === 'number' && Number.isFinite(value) && value >= field.range[0] && value <= field.range[1];
    for (const event of events) {
      if (!record(event) || !Object.hasOwn(PREFERENCE_KEYS, event.kind)) fail('invalid preference event kind');
      const keys = [...preferenceBase, ...PREFERENCE_KEYS[event.kind]];
      if (!exact(event, [...keys, ...preferenceOptional(event.kind)]) || keys.some(key => !Object.hasOwn(event, key)) || event.version !== PREFERENCE_VERSION
        || !preferenceToken(event.id) || !preferenceToken(event.encounterId)) fail('invalid preference event');
      checkScope(event.scope);
      if (scopeKey(event.scope) !== scopeKey(scope) || canonical(event.contract) !== canonical(reference)) fail('foreign preference scope or contract');
      if (event.source !== (event.kind === 'apply' ? 'feedback-confirmed' : 'explicit')) fail('invalid preference source');
      // PULSE may use a customer's direct choices, but its existing boundary
      // excludes personal feedback learning, including reviewed suggestions.
      if (scope.domain === 'PULSE' && ['propose', 'apply'].includes(event.kind)) fail('PULSE does not learn a personal behavioral profile');
      const eventAt = instant(event.at);
      if (Object.hasOwn(event, 'until') && instant(event.until) <= eventAt) fail('preference deadline must be after its declaration');
      if (eventAt > instant(at)) fail('future preference event');
      if (seen.has(event.id)) {
        if (canonical(seen.get(event.id)) !== canonical(event)) fail('conflicting preference event id');
        continue;
      }
      if (eventAt < previousAt) fail('preference event time reversal');
      previousAt = eventAt;
      if (Object.hasOwn(event, 'field') && !fields.has(event.field)) fail('unknown preference field');
      if (Object.hasOwn(event, 'value') && !isValue(fields.get(event.field), event.value)) fail('invalid preference value');
      if (Object.hasOwn(event, 'duration') && !['once', 'ongoing'].includes(event.duration)) fail('invalid preference duration');
      for (const key of ['proposalId', 'feedbackId']) if (Object.hasOwn(event, key) && !preferenceToken(event[key])) fail(`invalid ${key}`);
      if (closed.has(event.encounterId) && ['set', 'propose', 'apply'].includes(event.kind)) fail('preference encounter is closed');
      if (event.kind === 'propose') pending.set(event.id, event);
      else if (event.kind === 'apply' || event.kind === 'dismiss') {
        const proposal = pending.get(event.proposalId);
        if (!proposal || proposal.encounterId !== event.encounterId) fail('preference proposal is not pending in this encounter');
        pending.delete(proposal.id);
        if (event.kind === 'apply') {
          const applied = { ...event, field: proposal.field, value: proposal.value, feedbackId: proposal.feedbackId };
          (event.duration === 'ongoing' ? ongoing : onceFor(event.encounterId)).set(proposal.field, applied);
          if (event.duration === 'ongoing') onceFor(event.encounterId).delete(proposal.field);
          clearPendingField(proposal.field);
        }
      } else if (event.kind === 'set') {
        (event.duration === 'ongoing' ? ongoing : onceFor(event.encounterId)).set(event.field, event);
        if (event.duration === 'ongoing') onceFor(event.encounterId).delete(event.field);
        clearPendingField(event.field);
      } else if (event.kind === 'withdraw') {
        (event.duration === 'ongoing' ? ongoing : onceFor(event.encounterId)).delete(event.field);
        clearPendingField(event.field);
      } else if (event.kind === 'reset') {
        ongoing.clear(); once.clear(); pending.clear(); // Do not reopen ended encounters.
      } else if (event.kind === 'close') {
        closed.add(event.encounterId); once.delete(event.encounterId);
        for (const [id, proposal] of pending) if (proposal.encounterId === event.encounterId) pending.delete(id);
      }
      seen.set(event.id, event); unique.push(event);
    }
    const origin = event => ({ eventId: event.id, source: event.source, duration: event.duration, encounterId: event.encounterId, at: event.at,
      ...(Object.hasOwn(event, 'until') ? { until: event.until } : {}),
      ...(event.proposalId ? { proposalId: event.proposalId, feedbackId: event.feedbackId } : {}) });
    const expiredAt = event => Object.hasOwn(event, 'until') && instant(at) >= instant(event.until);
    const readLayer = selected => {
      const values = {}, provenance = {}, expired = [];
      for (const [field, event] of selected) {
        if (expiredAt(event)) { expired.push({ field, value: event.value, ...origin(event) }); continue; }
        values[field] = event.value;
        provenance[field] = origin(event);
      }
      return { values, provenance, ...(expired.length ? { expired } : {}) };
    };
    const baseline = readLayer(ongoing), context = readLayer(once.get(encounterId) || []);
    // A deadline ends the current declaration, never searches its history for an
    // older value. An expired once choice may reveal the still-current baseline.
    const effective = { values: { ...baseline.values, ...context.values }, provenance: { ...baseline.provenance, ...context.provenance } };
    const expired = [...(baseline.expired || []), ...(context.expired || [])];
    if (expired.length) effective.expired = expired;
    const projection = { version: PREFERENCE_VERSION, ...effective, closed: closed.has(encounterId),
      pendingProposals: [...pending.values()].filter(event => event.encounterId === encounterId).map(event => ({ id: event.id,
        field: event.field, value: event.value, feedbackId: event.feedbackId, encounterId: event.encounterId, at: event.at })) };
    return { projection, layers: { version: 'core-preference-layers-1', baseline,
      context: { encounterId, ...context, closed: closed.has(encounterId) }, effective: projection }, events: unique };
  }
  function projectPreferences(input = {}) { return copy(preferenceReplay(input).projection); }
  function preferenceLayers(input = {}) { return copy(preferenceReplay(input).layers); }
  // Map only the effective explicit choices into Domain without replacing their
  // original timestamp or turning product defaults into personal declarations.
  // The host owns the workspace namespace, authentication, permission and an
  // explicit-unknown mask. This bridge checks person/domain identity only.
  function preferencesToDomain(input = {}) {
    if (!exact(input, ['contract', 'scope', 'events', 'encounterId', 'at', 'domainScope'])) fail('unsupported preference bridge input');
    const { contract, scope, events = [], encounterId, at, domainScope } = input;
    checkScope(scope);
    if (!record(domainScope) || domainScope.subject !== scope.personId || domainScope.domain !== scope.domain) fail('foreign preference bridge subject or domain');
    const domain = getDomain();
    if (!domain?.understand) fail('load Core domain capability first');
    // Domain validates the complete target scope even if no values exist.
    domain.understand({ contract, scope: domainScope, observations: [], at });
    const layers = preferenceLayers({ contract, scope, events, encounterId, at });
    const fields = new Map(contract.fields.map(field => [field.id, field]));
    const reference = { id: contract.id, version: contract.version, purpose: contract.purpose };
    const observations = [], lineage = [];
    const selected = new Map(Object.entries(layers.effective.values).map(([field, value]) => [field, { value, origin: layers.effective.provenance[field] }]));
    // Keep a currently expired declaration as expired evidence when no live
    // layer remains. This lets a required field fail closed with its real cause.
    for (const expired of layers.effective.expired || []) if (!Object.hasOwn(layers.effective.values, expired.field)) {
      const { field, value, ...origin } = expired; selected.set(field, { value, origin });
    }
    for (const [field, { value, origin }] of selected) {
      const began = instant(origin.at), contractExpiry = began + (fields.get(field).maxAgeDays ?? 30) * 86400000;
      const expires = origin.until ? Math.min(contractExpiry, instant(origin.until)) : contractExpiry;
      if (!Number.isFinite(expires) || Math.abs(expires) > 8640000000000000 || Math.trunc(expires) <= began) fail('invalid preference bridge lifetime');
      const until = new Date(expires).toISOString();
      const refs = [...new Set([origin.eventId, origin.proposalId, origin.feedbackId].filter(Boolean))];
      observations.push({ id: origin.eventId, scope: copy(domainScope), contract: copy(reference), field, value,
        source: 'declared', at: origin.at, until, refs });
      lineage.push({ field, eventId: origin.eventId, source: origin.source, duration: origin.duration,
        encounterId: origin.encounterId, at: origin.at, until });
    }
    // Expired effective choices are deliberately retained: Domain marks them
    // expired instead of refreshing them or reviving an older baseline value.
    const understanding = domain.understand({ contract, scope: domainScope, observations, at });
    return copy({ observations, layers, understanding, lineage });
  }
  function recordPreference(input = {}) {
    if (!record(input) || !Object.hasOwn(PREFERENCE_KEYS, input.kind)) fail('invalid preference action');
    const { contract, scope, encounterId, at, id, kind, events = [] } = input;
    const extraKeys = PREFERENCE_KEYS[kind], optionalKeys = preferenceOptional(kind), keys = ['contract', 'scope', 'events', 'encounterId', 'at', 'id', 'kind', ...extraKeys, ...optionalKeys];
    if (!exact(input, keys)) fail('unsupported preference action input');
    // Validate the supplied history first; callers cannot smuggle a different
    // actor, purpose, value, time or implicit source into an existing log.
    const prior = preferenceReplay({ contract, scope, events, encounterId, at }).events;
    const event = { version: PREFERENCE_VERSION, id, scope: copy(scope), contract: { id: contract.id, version: contract.version, purpose: contract.purpose },
      encounterId, at, kind, source: kind === 'apply' ? 'feedback-confirmed' : 'explicit' };
    for (const key of extraKeys) { if (!Object.hasOwn(input, key)) fail(`missing preference ${key}`); event[key] = input[key]; }
    for (const key of optionalKeys) if (Object.hasOwn(input, key)) event[key] = input[key];
    return copy(preferenceReplay({ contract, scope, events: [...prior, event], encounterId, at }).events);
  }
  const preferences = Object.freeze({ project: projectPreferences, record: recordPreference, layers: preferenceLayers, toDomain: preferencesToDomain });
  return Object.freeze({ VERSION, PREFERENCE_VERSION, preferences, OPTIONS, FIELDS, REASONS, REASON_GOAL, MAX_REASONS, DEFAULT_PRESENTATION, createProfile, updateProfile, clearProfile,
    selectPersonalization, recordCompletion, recordFeedback, coreScope, validateProfile: checkProfile,
    // Optional Core capability: products that need field-based decisions load it.
    get domain() { const domain = getDomain(); if (!domain?.decide) fail('load Core domain capability first'); return domain; } });
});
