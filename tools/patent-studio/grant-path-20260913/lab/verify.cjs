'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const run = args => { const result = spawnSync(process.execPath, args, { cwd: __dirname, encoding: 'utf8', windowsHide: true }); if (result.status !== 0) throw Error(result.stdout + result.stderr); return result.stdout; };
const output = run(['--test', '--test-reporter=tap', 'observation-contract.test.cjs']);
fs.writeFileSync(path.join(__dirname, 'TESTS.tap'), output);
const count = name => Number(new RegExp('^# ' + name + ' (\\d+)$', 'm').exec(output)?.[1]);
if (!count('tests') || count('fail') !== 0 || count('pass') !== count('tests')) throw Error('Unexpected test results');
run(['run-experiment.cjs']);
const experiment = JSON.parse(fs.readFileSync(path.join(__dirname, 'RESULTS.json'), 'utf8'));
const files = ['observation-contract.cjs', 'observation-contract.test.cjs', 'fixtures.cjs', 'run-experiment.cjs', 'RESULTS.json', 'ADVERSARIAL_REVIEW.md', 'TESTS.tap'];
const report = { checkedAt: new Date().toISOString(), node: process.version, command: 'node --test --test-reporter=tap observation-contract.test.cjs',
  tests: count('tests'), passed: count('pass'), failed: count('fail'), scenarios: experiment.scenarios.length,
  routingPairs: experiment.routingComparison.pairs.length, equalRoutingPairs: experiment.routingComparison.equalPairs,
  scope: 'local synthetic metadata processing; no patentability or human listening claim',
  files: Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')])) };
fs.writeFileSync(path.join(__dirname, 'VERIFICATION.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ tests: report.tests, passed: report.passed, failed: report.failed, scenarios: report.scenarios, equalRoutingPairs: report.equalRoutingPairs }));
