'use strict';
// A local deterministic evaluator for synthetic, pre-labelled Korean sentences.
// No account, network, LLM, model training, or product data is used here.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/member-statement-v3-evaluation.json');
const key = tuple => JSON.stringify(tuple);
const tuple = m => [m.field, m.value, m.polarity, m.condition ?? null];
const sorted = rows => rows.map(key).sort();
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const divide = (a, b) => b ? a / b : null;
const sha = value => createHash('sha256').update(value).digest('hex');

function scoreCase(row, parsed, { skipResult = null, parseError = null } = {}) {
  const actual = (parsed?.meanings || []).map(tuple);
  const expectedKeys = new Set(row.expect.map(key));
  const actualKeys = new Set(actual.map(key));
  const truePositives = [...actualKeys].filter(x => expectedKeys.has(x));
  const falsePositives = [...actualKeys].filter(x => !expectedKeys.has(x));
  const falseNegatives = [...expectedKeys].filter(x => !actualKeys.has(x));
  const questionPolicy = row.mode === 'direct' ? 'absent' : row.mode === 'clarify' ? 'present' : row.question;
  const hasQuestion = Boolean(parsed?.question);
  const questionCorrect = questionPolicy === 'either' || hasQuestion === (questionPolicy === 'present');
  const evidenceErrors = (parsed?.meanings || []).filter(m => !m.evidence || !Number.isInteger(m.evidence.start)
    || !Number.isInteger(m.evidence.end) || m.evidence.start < 0 || m.evidence.end <= m.evidence.start
    || m.evidence.end > row.text.length || row.text.slice(m.evidence.start, m.evidence.end) !== m.evidence.quote).length;
  const options = parsed?.question?.options || [];
  const safeQuestionOptions = !hasQuestion || ['unsure', 'skip'].every(id => options.some(o => o.id === id));
  const skipSafe = !hasQuestion || Boolean(skipResult && same(actual, skipResult.meanings.map(tuple)));
  const semanticExact = falsePositives.length === 0 && falseNegatives.length === 0 && actual.length === actualKeys.size;
  return {
    id: row.id, split: row.split, category: row.category, mode: row.mode, text: row.text,
    expected: row.expect, actual, hasQuestion, questionPolicy, questionCorrect,
    truePositives: truePositives.map(JSON.parse), falsePositives: falsePositives.map(JSON.parse), falseNegatives: falseNegatives.map(JSON.parse),
    semanticExact, evidenceErrors, safeQuestionOptions, skipSafe, parseError,
    pass: !parseError && semanticExact && questionCorrect && evidenceErrors === 0 && safeQuestionOptions && skipSafe
  };
}

function summarize(rows) {
  const tp = rows.reduce((n, r) => n + r.truePositives.length, 0);
  const fp = rows.reduce((n, r) => n + r.falsePositives.length, 0);
  const fn = rows.reduce((n, r) => n + r.falseNegatives.length, 0);
  const precision = divide(tp, tp + fp), recall = divide(tp, tp + fn);
  const direct = rows.filter(r => r.mode === 'direct');
  const nonDirect = rows.filter(r => r.mode !== 'direct');
  const evidenceErrors = rows.reduce((n, r) => n + r.evidenceErrors, 0);
  const parseErrors = rows.filter(r => r.parseError).length;
  const questionFailures = rows.filter(r => !r.questionCorrect || !r.safeQuestionOptions || !r.skipSafe).length;
  return {
    cases: rows.length, passed: rows.filter(r => r.pass).length,
    exactCaseRate: divide(rows.filter(r => r.pass).length, rows.length),
    directCases: direct.length, directExact: direct.filter(r => r.pass).length,
    directExactRate: divide(direct.filter(r => r.pass).length, direct.length),
    truePositives: tp, falsePositives: fp, falseNegatives: fn, proposedTuples: tp + fp, expectedTuples: tp + fn, precision, recall,
    f1: precision === null || recall === null ? null : precision + recall ? 2 * precision * recall / (precision + recall) : 0,
    deferredCases: nonDirect.length, deferredWithoutFalseProposal: nonDirect.filter(r => r.actual.length === 0).length,
    noProposalCases: rows.filter(r => r.actual.length === 0).length,
    noProposalRate: divide(rows.filter(r => r.actual.length === 0).length, rows.length),
    supportedAbstentions: direct.filter(r => r.actual.length === 0).length,
    supportedAbstentionRate: divide(direct.filter(r => r.actual.length === 0).length, direct.length),
    questionsAsked: rows.filter(r => r.hasQuestion).length,
    questionFailures, evidenceErrors, parseErrors,
    safetyGatePass: fp === 0 && evidenceErrors === 0 && parseErrors === 0 && rows.every(r => r.safeQuestionOptions && r.skipSafe),
    allExpectationsPass: rows.every(r => r.pass)
  };
}

function evaluateCorpus({ corpus = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), parse, split = 'all' } = {}) {
  if (typeof parse !== 'function') throw new TypeError('An explicit parse function is required');
  if (!['all', 'development', 'holdout'].includes(split)) throw new TypeError('Unknown evaluation split');
  const cases = corpus.cases.filter(row => split === 'all' || row.split === split);
  const rows = cases.map(row => {
    let parsed = null, skipResult = null, parseError = null;
    try {
      parsed = parse(row.text);
      if (parsed.question) skipResult = parse(row.text, { clarifications: [{ questionId: parsed.question.id, optionId: 'skip' }] });
    } catch (error) { parseError = String(error?.message || error); }
    return scoreCase(row, parsed, { skipResult, parseError });
  });
  const groups = field => Object.fromEntries([...new Set(rows.map(r => r[field]))].sort().map(value => [value, summarize(rows.filter(r => r[field] === value))]));
  return { split, summary: summarize(rows), bySplit: groups('split'), byCategory: groups('category'), cases: rows };
}

function main(argv) {
  const options = { split: 'all', parser: 'current', out: null, fixture: FIXTURE, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') options.strict = true;
    else if (['--split', '--parser', '--out', '--fixture'].includes(arg) && argv[i + 1]) options[arg.slice(2)] = argv[++i];
    else throw new TypeError('Usage: node tools/member-statement-evaluate.cjs [--split development|holdout|all] [--parser current|ko2|ko3] [--fixture path] [--out path] [--strict]');
  }
  if (!['current', 'ko2', 'ko3'].includes(options.parser)) throw new TypeError('Unknown parser');
  const modulePath = path.join(ROOT, 'experiences/synk-account/src', options.parser === 'ko2' ? 'member-statement-v2.cjs' : options.parser === 'ko3' ? 'member-statement-v3.cjs' : 'member-statement-contract.cjs');
  const contract = require(modulePath);
  const fixturePath = path.resolve(ROOT, options.fixture);
  const report = {
    at: new Date().toISOString(), parserVersion: contract.PARSER_VERSION,
    fixture: path.relative(ROOT, fixturePath).replaceAll('\\', '/'), fixtureSha256: sha(fs.readFileSync(fixturePath)),
    sourceHashes: Object.fromEntries(['member-statement-contract.cjs', 'member-statement-v1.cjs', 'member-statement-v2.cjs', 'member-statement-v3.cjs', 'member-statement.cjs']
      .map(name => path.join(ROOT, 'experiences/synk-account/src', name)).filter(p => fs.existsSync(p)).map(p => [path.relative(ROOT, p).replaceAll('\\', '/'), sha(fs.readFileSync(p))])),
    population: 'Evaluator-authored synthetic Korean sentences only; no real users or psychological validity study.',
    ...evaluateCorpus({ corpus: JSON.parse(fs.readFileSync(fixturePath, 'utf8')), parse: contract.parseMemberStatement, split: options.split })
  };
  if (options.out) { const target = path.resolve(ROOT, options.out);fs.mkdirSync(path.dirname(target), { recursive: true });fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n'); }
  process.stdout.write(JSON.stringify({ parserVersion: report.parserVersion, split: report.split, ...report.summary, failures: report.cases.filter(r => !r.pass).map(r => r.id), report: options.out }, null, 2) + '\n');
  if (!report.summary.safetyGatePass || options.strict && !report.summary.allExpectationsPass) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { scoreCase, summarize, evaluateCorpus };
