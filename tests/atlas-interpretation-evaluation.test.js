'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const Temper = require('../atlas/temper-interpretation');
const Ask = require('../atlas/ask');
const Domain = require('../atlas/domain');
const Interpretation = require('../atlas/interpretation');
const content = require('../docs/마케팅/맞춤도구/computer/content');
const dataset = require('./fixtures/atlas-interpretation-cases.json');
const backend = { id: 'evaluator-self-test', version: '1', kind: 'manual-replay' };
const evaluate = (runs = [], data = dataset, extra = {}) => Temper.evaluateInterpretations({ dataset: data, runs, backend, mode: 'proposal-replay', ...extra });
const one = id => ({ ...dataset, cases: dataset.cases.filter(item => item.id === id) });
// These fabricated proposals test the EVALUATOR. They are never extractor runs.
const proposal = (item, field, value, extra = {}) => ({ id: `test.${field}`, field, value, subject: 'self', stance: 'current',
  evidence: [{ sourceId: item.source.id, start: 0, end: item.source.text.length, quote: item.source.text }], ...extra });
const replay = item => ({ caseId: item.id, output: { proposals: Object.entries(item.expected.facts).map(([field, value]) => proposal(item, field, value)) } });
const cli = args => spawnSync(process.execPath, [path.join(__dirname, '../tools/evaluate-atlas-interpretation.mjs'), ...args], { encoding: 'utf8' });

test('the authored source dataset covers semantic risks with independent explicit expectations', () => {
  assert.equal(Temper.validateDataset(dataset).size, 27);
  assert.ok(dataset.cases.length >= 20);
  const tags = new Set(dataset.cases.flatMap(item => item.tags));
  for (const tag of ['negation', 'time', 'contradiction', 'subject', 'uncertainty', 'correction', 'required', 'semantic-hold']) assert.ok(tags.has(tag));
  assert.equal(one('negated-local-positive-web').cases[0].expected.facts['uses.localai'], false);
  assert.deepEqual(one('hard-cap-soft-target').cases[0].expected.facts, {});
  assert.notEqual(dataset.cases[0].rationale, '');
});

test('authored vocabulary matches the existing product choices without generating expected answers', () => {
  const fields = new Map();
  for (const step of content.steps) {
    if (step.type === 'multi') for (const option of step.options) fields.set(`${step.id}.${option.id}`, { kind: 'boolean' });
    if (step.type === 'single') fields.set(step.id, { kind: 'enum', values: step.options.map(option => option.id) });
    if (step.type === 'group') for (const field of step.fields) fields.set(`${step.id}.${field.id}`, { kind: 'enum', values: field.options.map(option => option.id) });
  }
  for (const field of dataset.fields) { const { id, ...spec } = field; assert.deepEqual(spec, fields.get(id)); }
});

test('missing runs remain not_run with no invented score or source accuracy claim', () => {
  const report = evaluate();
  assert.equal(report.status, 'not_run'); assert.equal(report.counts.notRun, dataset.cases.length);
  assert.equal(report.rates.attemptedCaseAgreement, null); assert.equal(report.rates.evaluatedFieldRecall, null);
  assert.equal(report.sourceInterpretationAssessed, false); assert.equal(report.generalAccuracyEstablished, false);
});

test('perfect authored-answer replay verifies scoring only, not interpretation accuracy', () => {
  const report = evaluate(dataset.cases.map(replay));
  assert.equal(report.counts.passed, dataset.cases.length); assert.equal(report.claims.unsupported, 0);
  assert.equal(report.rates.attemptedCaseAgreement, 1); assert.equal(report.sourceInterpretationAssessed, false);
  assert.equal(report.mode, 'proposal-replay'); assert.equal(report.productionEffectMeasured, false);
});

test('permitted ownership is optional and never changes the required-field recall denominator', () => {
  const data = one('ram-direct'), item = data.cases[0], required = replay(item);
  const absent = evaluate([required], data);
  const added = evaluate([{ caseId: item.id, output: { proposals: [...required.output.proposals, proposal(item, 'owned', 'have')] } }], data);
  assert.equal(absent.counts.passed, 1); assert.equal(added.counts.passed, 1);
  assert.equal(absent.claims.permitted, 0); assert.equal(added.claims.permitted, 1);
  for (const report of [absent, added]) {
    assert.equal(report.claims.expected, 1); assert.equal(report.claims.exact, 1); assert.equal(report.claims.missing, 0);
    assert.equal(report.claims.unsupported, 0); assert.equal(report.rates.evaluatedFieldRecall, 1);
  }
  assert.equal(added.cases[0].fields.find(row => row.field === 'owned').status, 'permitted');
  const onlyPermitted = evaluate([{ caseId: item.id, output: { proposals: [proposal(item, 'owned', 'have')] } }], data);
  assert.equal(onlyPermitted.claims.exact, 0); assert.equal(onlyPermitted.claims.missing, 1);
  assert.equal(onlyPermitted.rates.evaluatedFieldRecall, 0); assert.equal(onlyPermitted.counts.failed, 1);
});

test('permission is limited to its exact authored field and value and cannot hide a contradiction', () => {
  const data = one('ram-direct'), item = data.cases[0], required = replay(item).output.proposals;
  for (const extra of [[proposal(item, 'owned', 'new')], [proposal(item, 'current.kind', 'laptop')],
    [proposal(item, 'owned', 'have'), proposal(item, 'owned', 'new', { id: 'conflicting-owner' })]]) {
    const report = evaluate([{ caseId: item.id, output: { proposals: [...required, ...extra] } }], data);
    assert.equal(report.counts.failed, 1); assert.equal(report.claims.unsupported, 1);
  }
  const other = one('other-only'), source = other.cases[0];
  assert.equal(evaluate([{ caseId: source.id, output: { proposals: [proposal(source, 'owned', 'have')] } }], other).claims.unsupported, 1);
});

test('permitted facts cannot conflict with required, unknown or forbidden authored expectations', () => {
  for (const mutate of [
    expected => { expected.permittedFacts['current.ram'] = '16'; },
    expected => { expected.permittedFacts.owned = 'unavailable-choice'; },
    expected => { expected.permittedFacts['not-a-field'] = true; },
    expected => { expected.unknownFields.push('owned'); },
    expected => { expected.mustNotAssert.push({ field: 'owned' }); },
    expected => { expected.mustNotAssert.push({ field: 'owned', value: 'have' }); }
  ]) {
    const data = structuredClone(one('ram-direct')); mutate(data.cases[0].expected);
    assert.throws(() => evaluate([], data));
  }
  const nonconflicting = structuredClone(one('ram-direct'));
  nonconflicting.cases[0].expected.mustNotAssert.push({ field: 'owned', value: 'new' });
  assert.doesNotThrow(() => evaluate([], nonconflicting));
});

test('all 28 manually reviewed cases keep their 20 required facts and explicit optional ownership scope', () => {
  assert.equal(dataset.version, '2'); assert.equal(dataset.cases.length, 28);
  assert.equal(dataset.cases.reduce((sum, item) => sum + Object.keys(item.expected.facts).length, 0), 20);
  assert.deepEqual(dataset.cases.filter(item => Object.keys(item.expected.permittedFacts).length).map(item => item.id),
    ['ram-direct', 'ram-past-current', 'quoted-recommendation', 'ram-uncertain', 'contradictory-ram', 'explicit-correction', 'other-correction', 'quoted-instruction', 'ram-category', 'model-size-not-ram']);
  const allPermitted = dataset.cases.map(item => ({ caseId: item.id, output: { proposals: [
    ...replay(item).output.proposals,
    ...Object.entries(item.expected.permittedFacts).map(([field, value]) => proposal(item, field, value))
  ] } }));
  const result = evaluate(allPermitted);
  assert.equal(result.claims.expected, 20); assert.equal(result.claims.exact, 20); assert.equal(result.claims.permitted, 10);
  assert.equal(result.claims.unsupported, 0); assert.equal(result.counts.passed, 28);
  assert.equal(result.sourceInterpretationAssessed, false);
});

test('wrong facts, absent facts and added claims are distinguished at field level', () => {
  const data = one('unknown-and-use'), item = data.cases[0];
  const report = evaluate([{ caseId: item.id, output: { proposals: [proposal(item, 'current.ram', '32')] } }], data);
  assert.equal(report.claims.missing, 1); assert.equal(report.claims.unsupported, 1);
  assert.equal(report.restraint.violated, 1); assert.equal(report.claims.forbiddenAssertions, 1);
  assert.equal(report.cases[0].fields.find(row => row.field === 'uses.video').status, 'missing');
  assert.equal(report.cases[0].fields.find(row => row.field === 'current.ram').status, 'unsupported');
  const wrong = one('ram-direct'), source = wrong.cases[0];
  const incorrect = evaluate([{ caseId: source.id, output: { proposals: [proposal(source, 'current.ram', '8')] } }], wrong);
  assert.equal(incorrect.claims.incorrect, 1); assert.equal(incorrect.claims.missing, 0); assert.equal(incorrect.claims.unsupported, 1);
});

test('other-person, past, uncertain and hypothetical proposals remain withheld', () => {
  const data = one('other-only'), item = data.cases[0];
  for (const extra of [{ subject: 'other' }, { stance: 'past' }, { stance: 'uncertain' }, { stance: 'hypothetical' }]) {
    const report = evaluate([{ caseId: item.id, output: { proposals: [proposal(item, 'current.ram', '32', extra)] } }], data);
    assert.equal(report.counts.passed, 1); assert.equal(report.claims.withheldProposals, 1); assert.equal(report.restraint.correctlyUnasserted, 1);
  }
});

test('a source quote is necessary but does not turn semantically wrong attribution into a supported fact', () => {
  const data = one('other-only'), item = data.cases[0];
  const report = evaluate([{ caseId: item.id, output: { proposals: [proposal(item, 'current.ram', '32')] } }], data);
  assert.equal(report.cases[0].status, 'evaluated'); assert.equal(report.counts.failed, 1); assert.equal(report.claims.unsupported, 1);
});

test('malformed output or evidence is a failed attempt, never a missing run or discarded denominator', () => {
  const data = one('ram-direct'), item = data.cases[0], good = proposal(item, 'current.ram', '16');
  const invalid = [null, {}, { proposals: [{ ...good, field: 'invented' }] },
    { proposals: [{ ...good, evidence: [{ ...good.evidence[0], sourceId: 'other-source' }] }] },
    { proposals: [{ ...good, evidence: [{ ...good.evidence[0], quote: '램 32GB' }] }] },
    { proposals: [{ ...good, evidence: [] }] }, { proposals: [good, good] },
    { proposals: [], held: [{ quote: '없는 원문', start: 0, end: 5, reason: 'uncertain' }] }];
  for (const output of invalid) {
    const report = evaluate([{ caseId: item.id, output }], data);
    assert.equal(report.counts.malformed, 1); assert.equal(report.counts.notRun, 0);
    assert.equal(report.rates.attemptedCaseAgreement, 0); assert.equal(report.rates.evaluatedFieldRecall, null);
    assert.equal(report.byField.find(row => row.field === 'current.ram').malformed, 1);
  }
});

test('UTF-16 evidence offsets match String.slice even with preceding supplementary characters', () => {
  const data = structuredClone(one('ram-direct')), item = data.cases[0]; item.source.text = '💻 제 램은 16GB입니다.';
  const p = proposal(item, 'current.ram', '16'), start = item.source.text.indexOf('16GB');
  p.evidence = [{ sourceId: item.source.id, start, end: start + 4, quote: '16GB' }];
  assert.equal(evaluate([{ caseId: item.id, output: { proposals: [p] } }], data).counts.passed, 1);
  p.evidence[0].start--;
  assert.equal(evaluate([{ caseId: item.id, output: { proposals: [p] } }], data).counts.malformed, 1);
});

test('proposal limits and quotation rejection match the Core interpretation boundary', () => {
  const data = structuredClone(one('ram-direct')), item = data.cases[0]; item.source.text = '💻 제 램은 16GB입니다.';
  const base = proposal(item, 'current.ram', '16'), scope = { domain: 'SHIFT', workspace: 'evaluation', subject: 'synthetic' };
  const packet = proposals => ({ contract: { id: 'evaluation-contract', version: '1', purpose: 'evaluation', fields: data.fields, criteria: [] },
    scope, at: item.source.at, sources: [{ ...item.source, scope }], proposals });
  const firstFour = [0, 3, 5, 8].map(start => ({ sourceId: item.source.id, start, end: start === 0 ? 2 : start + 1, quote: item.source.text.slice(start, start === 0 ? 2 : start + 1) }));
  const invalid = [
    Array.from({ length: 101 }, (_, i) => ({ ...base, id: `p${i}` })),
    [{ ...base, id: 'p'.repeat(101) }],
    [{ ...base, evidence: [...firstFour, base.evidence[0]] }],
    [{ ...base, evidence: [base.evidence[0], base.evidence[0]] }],
    [{ ...base, evidence: [{ sourceId: item.source.id, start: 0, end: 1, quote: item.source.text.slice(0, 1) }] }],
    [{ ...base, evidence: [{ sourceId: item.source.id, start: 2, end: 3, quote: ' ' }] }]
  ];
  for (const proposals of invalid) {
    assert.throws(() => Interpretation.prepare(packet(proposals)));
    assert.equal(evaluate([{ caseId: item.id, output: { proposals } }], data).counts.malformed, 1);
  }
  const valid = Array.from({ length: 100 }, (_, i) => ({ ...base, id: `p${i}` }));
  assert.doesNotThrow(() => Interpretation.prepare(packet(valid)));
  assert.equal(evaluate([{ caseId: item.id, output: { proposals: valid } }], data).counts.evaluated, 1);
});

test('oversized source and malformed dataset field definitions fail before scoring', () => {
  for (const mutate of [
    data => { data.cases[0].source.text = '가'.repeat(4001); },
    data => { data.cases[0].source.text = '   '; },
    data => { data.fields[0].values = ['single']; },
    data => { data.fields[0].values = ['__proto__', 'ordinary']; },
    data => { data.fields[0] = { id: 'owned', kind: 'number', range: [-Number.MAX_VALUE, Number.MAX_VALUE] }; },
    data => { data.fields[1].values = ['wrong', 'kind']; }
  ]) {
    const data = structuredClone(dataset); mutate(data); assert.throws(() => evaluate([], data));
  }
});

test('empty performed output is abstention; an absent case is not_run', () => {
  const report = evaluate([{ caseId: 'ram-direct', output: { proposals: [] } }]);
  assert.equal(report.status, 'partial'); assert.equal(report.counts.evaluated, 1);
  assert.equal(report.claims.missing, 1); assert.equal(report.counts.notRun, dataset.cases.length - 1);
});

test('same-value repeats do not inflate exact fields and contradicting proposals cannot pass', () => {
  const data = one('ram-direct'), item = data.cases[0], first = proposal(item, 'current.ram', '16');
  const same = { ...first, id: 'other.id' };
  assert.equal(evaluate([{ caseId: item.id, output: { proposals: [first, same] } }], data).claims.exact, 1);
  const mixed = evaluate([{ caseId: item.id, output: { proposals: [first, { ...same, value: '32' }] } }], data);
  assert.equal(mixed.counts.failed, 1); assert.equal(mixed.claims.conflicting, 1); assert.equal(mixed.claims.exact, 0);
});

test('batch provenance, dataset identity and duplicate case references are explicit boundaries', () => {
  assert.throws(() => evaluate([], dataset, { mode: undefined }), /mode/);
  assert.throws(() => evaluate([], dataset, { mode: 'extractor-output' }), /backend/);
  assert.throws(() => evaluate([replay(dataset.cases[0]), replay(dataset.cases[0])]), /duplicated/);
  assert.throws(() => evaluate([{ caseId: 'not-in-dataset', output: {} }]), /unknown/);
  const invalid = structuredClone(dataset); invalid.cases[0].expected.facts['current.ram'] = '512';
  assert.throws(() => evaluate([], invalid), /authored fact/);
});

test('CLI without outputs truthfully records no extractor execution', () => {
  const result = cli([]); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'not_run'); assert.equal(report.backend.kind, 'not-run');
  assert.equal(report.inputs.outputsSha256, null); assert.equal(report.evaluatorExecution.extractionPerformed, false);
  assert.equal(report.evaluatorExecution.networkCalls, 0); assert.equal(report.evaluatorExecution.externalApiCost, 0);
});

test('CLI evaluates saved output separately from proposal replay and refuses a mismatched dataset', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-interpretation-evaluation-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outputs = path.join(dir, 'outputs.json'), reportPath = path.join(dir, 'report.json');
  const saved = { version: 1, dataset: { id: dataset.id, version: dataset.version }, mode: 'extractor-output',
    backend: { id: 'recorded-local-example', version: '1', kind: 'local-pattern' }, runs: [{ caseId: 'other-only', output: { proposals: [] } }] };
  fs.writeFileSync(outputs, JSON.stringify(saved));
  const result = cli(['--outputs', outputs, '--report', reportPath]); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(reportPath));
  assert.equal(report.mode, 'extractor-output'); assert.equal(report.sourceInterpretationAssessed, true);
  assert.equal(report.backend.id, 'recorded-local-example'); assert.equal(report.counts.evaluated, 1);
  assert.match(report.inputs.outputsSha256, /^[a-f0-9]{64}$/); assert.equal(report.generalAccuracyEstablished, false);
  saved.dataset.version = 'different'; fs.writeFileSync(outputs, JSON.stringify(saved));
  assert.equal(cli(['--outputs', outputs]).status, 1);
});

test('saved baseline comparisons use the same cases and expose unmatched attempts without declaring superiority', t => {
  const item = dataset.cases[0], baseline = evaluate([replay(item)]), candidate = evaluate([{ caseId: item.id, output: { proposals: [] } }, replay(dataset.cases[1])]);
  const comparison = Temper.compareInterpretations({ baseline, candidate });
  assert.equal(comparison.counts.pairedAttempted, 1); assert.equal(comparison.counts.regressedCases, 1);
  assert.equal(comparison.counts.improvedCases, 0); assert.equal(comparison.counts.unpaired, dataset.cases.length - 1);
  assert.equal(comparison.fieldDifference.exact, -1); assert.equal(comparison.fieldDifference.missing, 1);
  assert.equal(comparison.superiorityEstablished, false);
  const permitted = evaluate([{ caseId: item.id, output: { proposals: [...replay(item).output.proposals, proposal(item, 'owned', 'have')] } }]);
  const optionalComparison = Temper.compareInterpretations({ baseline, candidate: permitted });
  assert.equal(optionalComparison.counts.bothPassed, 1); assert.equal(optionalComparison.fieldDifference.permitted, 1);
  assert.equal(optionalComparison.fieldDifference.exact, 0); assert.equal(optionalComparison.fieldDifference.missing, 0);
  assert.throws(() => Temper.compareInterpretations({ baseline, candidate: { ...candidate, mode: 'extractor-output' } }), /same dataset/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-interpretation-comparison-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bundle = runs => ({ version: 1, dataset: { id: dataset.id, version: dataset.version }, mode: 'proposal-replay', backend, runs });
  const before = path.join(dir, 'baseline.json'), after = path.join(dir, 'candidate.json');
  fs.writeFileSync(before, JSON.stringify(bundle([replay(item)]))); fs.writeFileSync(after, JSON.stringify(bundle([{ caseId: item.id, output: { proposals: [] } }])));
  const result = cli(['--baseline', before, '--outputs', after]); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).comparison.counts.regressedCases, 1);
});

test('an independently authored loss table makes a useful question worth 1.5 policy units', () => {
  const loss = { small: { A: 0, B: 1 }, large: { A: 4, B: 0 } };
  const decide = answers => ({ content: answers.load === 'large' ? 'B' : 'A' });
  const evaluate = ({ decision, answers }) => ({ loss: loss[answers.load || 'small'][decision.content] });
  const load = { id: 'load', cost: 0.5, options: [{ id: 'small' }, { id: 'large' }] };
  const color = { id: 'color', options: [{ id: 'blue' }, { id: 'green' }] };
  const result = Ask.choose({ questions: [color, load], decide, evaluate });
  assert.equal(result.question.id, 'load'); assert.equal(result.value, 1.5);
  assert.equal(result.ranked.find(row => row.id === 'color').skippable, true);
  const expensive = Ask.choose({ questions: [{ ...load, cost: 2 }], decide, evaluate });
  assert.equal(expensive.status, 'none');
  const answered = Ask.choose({ questions: [load], answers: { load: 'large' }, decide, evaluate });
  assert.equal(answered.status, 'none');
});

test('an independently authored hard cap defeats a high soft preference and unknown caps abstain', () => {
  const contract = { id: 'independent-required-case', version: '1', purpose: 'authored-policy-test',
    fields: [{ id: 'cap', kind: 'number', range: [0, 500] }, { id: 'finish', kind: 'enum', values: ['matte', 'glossy'] }],
    criteria: [{ id: 'within-cap', field: 'cap', feature: 'price', prefer: 'at-most', weight: 1, required: true },
      { id: 'looks', field: 'finish', feature: 'finish', weight: 100, required: false }] };
  const scope = { domain: 'SYNK', workspace: 'synthetic-evaluation', subject: 'authored-case' }, at = '2026-10-05T12:00:00.000Z';
  const row = (field, value) => ({ id: field, field, value, scope, at, source: 'declared', contract: { id: contract.id, version: contract.version, purpose: contract.purpose } });
  const candidates = [{ id: 'over-cap-but-preferred', features: { price: 200, finish: 'matte' } }, { id: 'within-cap', features: { price: 120, finish: 'glossy' } }];
  const input = { contract, scope, at, candidates, observations: [row('cap', 150), row('finish', 'matte')] };
  assert.equal(Domain.decide(input).selected.id, 'within-cap');
  assert.equal(Domain.decide({ ...input, observations: [row('finish', 'matte')] }).status, 'unavailable');
});
