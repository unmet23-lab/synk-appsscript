/* Core adapter for voluntary settings shared by product implementations.
 * Pure: the host owns identity, permission, consent UI, storage, clock and deletion.
 * This is not another engine. Core owns selection and feedback; Trail owns practice
 * evidence, Strata owns content mappings, Vellum owns wording, Temper owns measurement.
 * A setting is a reversible declaration, never evidence of ability or a fixed trait.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'));
  else root.SynkAtlasPersonalization = factory(root.SynkAtlas);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
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
  const FIELDS = Object.freeze([...Object.keys(OPTIONS), 'minutes']);
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
      if (field === 'minutes' ? !Number.isInteger(value) || value < 1 || value > 240 : !OPTIONS[field].includes(value)) fail(`invalid ${field}`);
    }
    return values;
  }
  function checkProfile(profile) {
    const keys = ['version', 'scope', 'revision', 'generation', 'status', 'consent', 'values', 'provenance', 'createdAt', 'updatedAt'];
    if (!exact(profile, keys) || keys.some(key => !Object.hasOwn(profile, key)) || profile.version !== VERSION
      || !Number.isSafeInteger(profile.revision) || profile.revision < 0
      || !Number.isSafeInteger(profile.generation) || profile.generation < 0 || profile.generation > 999999999
      || !['new', 'active', 'skipped', 'disabled', 'deleted'].includes(profile.status)
      || typeof profile.consent !== 'boolean' || (profile.status === 'active') !== profile.consent) fail('invalid profile');
    checkScope(profile.scope); checkValues(profile.values);
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
    if (!exact(patch, ['values', 'consent']) || !Object.hasOwn(patch, 'values')
      || (Object.hasOwn(patch, 'consent') && typeof patch.consent !== 'boolean')) fail('invalid update');
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
        next.values[field] = value;
        next.provenance[field] = { source: 'self-declared', confidence: 'declared', at, revision: next.revision };
      }
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
    const settings = { goal: values.goal ?? null, time: values.minutes == null ? null : values.minutes <= 5 ? 'short' : 'standard',
      support: values.support ?? null, audio: values.audio ?? null };
    const previous = current.state().context;
    for (const [field, value] of Object.entries(settings)) if ((previous[field] ?? null) !== value) current.set(field, value);
    const eligible = candidates.filter(item => (values.minutes == null || item.minutes <= values.minutes)
      && (!values.experience || !item.experiences || item.experiences.includes(values.experience)));
    const constraints = [];
    if (values.minutes != null) constraints.push('time.limit');
    if (values.experience != null) constraints.push('experience.declared');
    const plan = eligible.length ? current.plan(experienceId, copy(eligible)) : {
      version: Core.VERSION, status: 'unavailable', scope: coreScope(profile), experienceId, at,
      selected: null, alternatives: [], reasons: ['no.feasible.experience'], evidence: [],
    };
    const reasons = [...new Set([...plan.reasons, ...constraints])];
    const returned = profile.consent ? current.events() : [];
    const basis = plan.outcomeBasis === 'self_report' ? 'self-reported-feedback' : Object.keys(values).length ? 'self-declared' : 'cold-start';
    return { version: VERSION, profile: copy(profile), values, presentation, plan: copy(plan), events: returned, reasons,
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
  return Object.freeze({ VERSION, OPTIONS, FIELDS, DEFAULT_PRESENTATION, createProfile, updateProfile, clearProfile,
    selectPersonalization, recordCompletion, recordFeedback, coreScope, validateProfile: checkProfile });
});
