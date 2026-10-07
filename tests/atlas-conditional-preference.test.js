const test = require('node:test');
const assert = require('node:assert/strict');
const Conditional = require('../atlas/conditional-preference');
const scope = { personId: 'one', productId: 'test', contextId: 'pool', domain: 'SYNK' };
const contract = { id: 'test', version: '1', purpose: 'test', criteria: [], fields: [
  { id: 'wanted', kind: 'enum', values: ['primary', 'alternative', 'other'] },
  { id: 'actual', kind: 'enum', values: ['primary', 'alternative', 'other'] },
  { id: 'gate', kind: 'enum', values: ['yes', 'no'] },
] };
const source = { eventId: 'event-1', source: 'explicit', duration: 'ongoing', encounterId: 'first', at: '2026-10-07T00:00:00.000Z' };
const base = () => ({ version: Conditional.VERSION, id: 'rule', scope: structuredClone(scope), field: 'wanted', feature: 'actual', primary: 'primary', alternative: 'alternative',
  when: { field: 'gate', value: 'yes' }, target: 'context', encounterId: 'first', at: '2026-10-07T00:01:00.000Z', until: null, source: structuredClone(source) });
const input = () => ({ contract, scope, rule: base(), preference: { value: 'primary', source: structuredClone(source), usable: true, required: false },
  facts: { actual: { value: 'alternative', usable: true }, gate: { value: 'yes', usable: true } }, encounterId: 'first', at: '2026-10-07T00:02:00.000Z' });
const validate = args => Conditional.validateRule({ contract: args.contract, scope: args.scope, rule: args.rule });

test('explicit condition admits one alternative and keeps primary distinct without mutations', () => {
  const args = input(), before = structuredClone(args), result = Conditional.assess(args);
  assert.equal(result.status, 'conditional'); assert.equal(result.conditionStatus, 'satisfied'); assert.deepEqual(args, before);
  args.facts.actual.value = 'primary'; assert.equal(Conditional.assess(args).status, 'primary');
  args.facts.actual.value = 'other'; assert.equal(Conditional.assess(args).status, 'different');
  assert.notEqual(validate(args).source, args.rule.source);
});
test('missing, unusable or expired candidate condition never admits an alternative', () => {
  for (const condition of [undefined, { value: 'yes', usable: false }, { value: 'yes', usable: true, until: '2026-10-07T00:02:00.000Z' }]) {
    const args = input(); if (condition) args.facts.gate = condition; else delete args.facts.gate;
    const result = Conditional.assess(args); assert.equal(result.status, 'different'); assert.equal(result.conditionStatus, 'unknown');
  }
  const args = input(); args.facts.gate.value = 'no'; assert.equal(Conditional.assess(args).conditionStatus, 'different');
});
test('missing or expired primary feature remains unknown', () => {
  const args = input(); delete args.facts.actual; assert.equal(Conditional.assess(args).status, 'unknown');
  args.facts.actual = { value: 'alternative', usable: true, until: args.at }; assert.equal(Conditional.assess(args).status, 'unknown');
});
test('required preference defeats even a satisfied alternative', () => {
  const args = input(); args.preference.required = true;
  assert.deepEqual(Conditional.assess(args), { status: 'inactive', conditionStatus: 'inactive', reason: 'required-primary', ruleId: 'rule', evidence: [] });
});
test('source substitution, unknown, same-value re-declaration and explicit invalidation stop a rule', () => {
  for (const change of [args => args.preference.source.eventId = 'new-source', args => args.preference.source.at = '2026-10-07T00:00:01.000Z',
    args => args.preference.usable = false, args => args.preference.value = null, args => args.preference.source = null, args => args.invalidated = true]) {
    const args = input(); change(args); assert.equal(Conditional.assess(args).status, 'inactive');
  }
});
test('rule and source deadlines are inclusive and context scope cannot carry into another encounter', () => {
  const args = input(); args.rule.until = args.at; assert.equal(Conditional.assess(args).reason, 'rule-expired');
  args.rule.until = null; args.rule.source.until = args.at; args.preference.source.until = args.at;
  assert.equal(Conditional.assess(args).reason, 'source-expired');
  delete args.rule.source.until; delete args.preference.source.until; args.encounterId = 'second'; assert.equal(Conditional.assess(args).reason, 'context-ended');
  args.rule.target = 'baseline'; assert.equal(Conditional.assess(args).status, 'conditional');
});
test('declaration cannot widen once scope or outlive an explicit source deadline', () => {
  const args = input(); args.rule.source.duration = 'once'; args.rule.target = 'baseline';
  assert.throws(() => validate(args), /widen/);
  args.rule.target = 'context'; args.rule.source.encounterId = 'elsewhere'; assert.throws(() => validate(args), /widen/);
  args.rule.source = { ...source, until: '2026-10-07T00:03:00.000Z' }; args.rule.until = '2026-10-07T00:04:00.000Z';
  assert.throws(() => validate(args), /outlives/);
});
test('scope and recursive allowlists reject foreign owners and executable/free-form conditions', () => {
  for (const change of [args => args.rule.scope.personId = 'another', args => args.rule.when.operator = 'javascript', args => args.rule.when.value = 'maybe',
    args => args.rule.primary = 'unlisted', args => args.rule.alternative = 'primary', args => args.rule.at = 'tomorrow',
    args => args.rule.source.confidence = 'inferred', args => args.rule.source.source = 'inferred', args => args.rule.secret = true,
    args => args.rule.when.field = 'actual']) {
    const args = input(); change(args); assert.throws(() => validate(args), TypeError);
  }
});
test('candidate fact and current preference allowlists fail closed on invalid values or hidden attributes', () => {
  for (const change of [args => args.facts.secret = { value: 'yes', usable: true }, args => args.facts.gate.secret = true,
    args => args.facts.gate.value = 'maybe', args => args.preference.value = 'maybe', args => args.preference.assumed = true,
    args => args.at = '2026-10-07', args => args.preference.required = 'false', args => args.extra = true]) {
    const args = input(); change(args); assert.throws(() => Conditional.assess(args), TypeError);
  }
  assert.throws(() => Conditional.validateRule({ contract, scope, rule: base(), extra: true }), /unsupported/);
});
