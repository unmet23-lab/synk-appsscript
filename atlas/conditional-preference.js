/* Core's optional, explicit conditional-preference comparison.
 * Pure: products own authentication, public projections, storage and clocks.
 * It never changes a primary declaration or relaxes a required criterion.
 * A condition is a reversible user declaration, not an inferred personal trait.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./domain'));
  else root.SynkAtlasConditionalPreference = factory(root.SynkAtlasDomain);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Domain) {
  'use strict';
  const VERSION = 'core-conditional-preference-1';
  const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
  const own = (value, key) => Object.hasOwn(value, key);
  const exact = (value, keys, required = keys) => plain(value) && Object.keys(value).every(key => keys.includes(key)) && required.every(key => own(value, key));
  const token = value => typeof value === 'string' && /^[A-Za-z0-9_.:@-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
  const fail = message => { throw new TypeError(`Conditional preference: ${message}`); };
  const copy = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value, (_key, item) => plain(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  function time(at) {
    if (typeof at !== 'string' || at.length > 40 || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) fail('explicit ISO UTC time required');
    return Date.parse(at);
  }
  function checkScope(scope) {
    if (!exact(scope, ['personId', 'productId', 'contextId', 'domain']) || Object.values(scope).some(value => !token(value))) fail('invalid scope');
  }
  function checkSource(source) {
    if (!exact(source, ['eventId', 'source', 'duration', 'encounterId', 'at', 'until'], ['eventId', 'source', 'duration', 'encounterId', 'at'])
      || !token(source.eventId) || source.source !== 'explicit' || !['ongoing', 'once'].includes(source.duration) || !token(source.encounterId)) fail('invalid explicit source');
    time(source.at);
    if (own(source, 'until') && time(source.until) <= time(source.at)) fail('invalid source deadline');
  }
  function validateRule(input = {}) {
    if (!exact(input, ['contract', 'scope', 'rule'])) fail('unsupported rule input');
    const { contract, scope, rule } = input;
    if (!Domain?.validateContract) fail('Core Domain required');
    Domain.validateContract(contract); checkScope(scope);
    if (!exact(rule, ['version', 'id', 'scope', 'field', 'feature', 'primary', 'alternative', 'when', 'target', 'encounterId', 'at', 'until', 'source'])
      || rule.version !== VERSION || !token(rule.id) || !token(rule.encounterId) || !['baseline', 'context'].includes(rule.target)) fail('invalid rule');
    checkScope(rule.scope);
    if (canonical(rule.scope) !== canonical(scope)) fail('foreign rule scope');
    const fields = new Map(contract.fields.map(field => [field.id, field]));
    const preferred = fields.get(rule.field), feature = fields.get(rule.feature);
    if (!preferred || preferred.kind !== 'enum' || !feature || feature.kind !== 'enum'
      || !preferred.values.includes(rule.primary) || !preferred.values.includes(rule.alternative) || rule.primary === rule.alternative
      || !feature.values.includes(rule.primary) || !feature.values.includes(rule.alternative)) fail('invalid primary or alternative');
    if (!exact(rule.when, ['field', 'value']) || fields.get(rule.when.field)?.kind !== 'enum'
      || !fields.get(rule.when.field).values.includes(rule.when.value) || rule.when.field === rule.feature) fail('invalid condition');
    checkSource(rule.source);
    if (time(rule.at) < time(rule.source.at) || rule.target === 'baseline' && rule.source.duration !== 'ongoing'
      || rule.source.duration === 'once' && rule.source.encounterId !== rule.encounterId) fail('rule cannot widen its source scope');
    if (rule.until !== null && time(rule.until) <= time(rule.at)) fail('rule deadline must be later than declaration');
    if (rule.source.until && (time(rule.source.until) <= time(rule.at) || rule.until !== null && time(rule.until) > time(rule.source.until))) fail('rule outlives its source');
    return copy(rule);
  }
  function assess(input = {}) {
    if (!exact(input, ['contract', 'scope', 'rule', 'preference', 'facts', 'encounterId', 'at', 'invalidated'], ['contract', 'scope', 'rule', 'preference', 'encounterId', 'at'])) fail('unsupported comparison input');
    const { contract, scope, rule, preference, facts = {}, encounterId, at, invalidated = false } = input;
    validateRule({ contract, scope, rule }); const cutoff = time(at);
    if (!token(encounterId) || typeof invalidated !== 'boolean'
      || !exact(preference, ['value', 'source', 'usable', 'required']) || typeof preference.usable !== 'boolean' || typeof preference.required !== 'boolean') fail('invalid current preference');
    if (preference.source !== null) checkSource(preference.source);
    const fields = new Map(contract.fields.map(field => [field.id, field]));
    if (preference.value !== null && !fields.get(rule.field).values.includes(preference.value)) fail('invalid current preference value');
    if (!exact(facts, [rule.feature, rule.when.field], []) ) fail('unsupported candidate facts');
    for (const [field, fact] of Object.entries(facts)) {
      if (!exact(fact, ['value', 'usable', 'until'], ['value', 'usable']) || typeof fact.usable !== 'boolean'
        || !fields.get(field).values.includes(fact.value)) fail('invalid candidate fact');
      if (own(fact, 'until')) time(fact.until);
    }
    const inactive = reason => ({ status: 'inactive', conditionStatus: 'inactive', reason, ruleId: rule.id, evidence: [] });
    if (cutoff < time(rule.at)) return inactive('not-yet-declared');
    if (invalidated) return inactive('source-changed');
    if (preference.required) return inactive('required-primary');
    if (rule.target === 'context' && rule.encounterId !== encounterId) return inactive('context-ended');
    if (rule.until !== null && cutoff >= time(rule.until)) return inactive('rule-expired');
    if (rule.source.until && cutoff >= time(rule.source.until)) return inactive('source-expired');
    if (!preference.usable || preference.value !== rule.primary || !preference.source || canonical(preference.source) !== canonical(rule.source)) return inactive('source-changed');
    const usable = field => own(facts, field) && facts[field].usable && (!own(facts[field], 'until') || cutoff < time(facts[field].until));
    if (!usable(rule.feature)) return { status: 'unknown', conditionStatus: 'unknown', reason: 'feature-unknown', ruleId: rule.id, evidence: [rule.source.eventId] };
    if (facts[rule.feature].value === rule.primary) return { status: 'primary', conditionStatus: 'not-needed', reason: 'primary-match', ruleId: rule.id, evidence: [rule.source.eventId] };
    if (facts[rule.feature].value !== rule.alternative) return { status: 'different', conditionStatus: 'not-needed', reason: 'outside-alternative', ruleId: rule.id, evidence: [rule.source.eventId] };
    if (!usable(rule.when.field)) return { status: 'different', conditionStatus: 'unknown', reason: 'condition-unknown', ruleId: rule.id, evidence: [rule.source.eventId] };
    const passed = facts[rule.when.field].value === rule.when.value;
    return { status: passed ? 'conditional' : 'different', conditionStatus: passed ? 'satisfied' : 'different', reason: passed ? 'explicit-alternative' : 'condition-different', ruleId: rule.id, evidence: [rule.source.eventId] };
  }
  return Object.freeze({ VERSION, validateRule, assess });
});
