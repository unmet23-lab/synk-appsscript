// Free, local evidence only. No provider calls, deployments, or real participants.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const qa = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(qa, '../../../..');
const origin = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '')) throw new Error('Isolated loopback preview required');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const write = (name, value) => fs.writeFile(path.join(qa, name), JSON.stringify(value, null, 2) + '\n');
const output = await fs.readFile(path.join(qa, 'tests-output.log'), 'utf8');
const count = (log, key) => Number(log.match(new RegExp('^(?:#|ℹ) ' + key + ' (\\d+)', 'm'))?.[1] ?? NaN);
const files = await read(path.join(qa, 'test-files.json'));
const summary = log => Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped'].map(key => [key, count(log, key)]));
const main = summary(output), delta = summary(await fs.readFile(path.join(qa, 'tests-delta.log'), 'utf8'));
if (main.tests !== 646 || main.pass !== 646 || delta.tests !== 1 || delta.pass !== 1 || [main, delta].some(run => run.fail || run.cancelled || run.skipped)) throw new Error('Incomplete automatic checks');
const tests = { files: files.length, tests: main.tests + delta.tests, pass: main.pass + delta.pass, fail: 0, cancelled: 0, skipped: 0,
  runs: { main, delta: { ...delta, file: 'tests/atlas-dating-allowance-review-service.test.mjs', filter: '^own public withdrawal already removes', note: 'One boundary test was added after the 646-check suite loaded its files. Product source remained frozen; this delta covers the new test once.' } } };
if (files.length !== 43) throw new Error('Unexpected automatic file scope');
await write('test-summary.json', tests);
const browsers = [];
for (const [kind, expected] of [['dating-agency', 9], ['dating-conditional-draft', 9], ['dating-flexibility', 10], ['dating', 18], ['dating-clarity', 4]]) {
  const result = await read(path.join(root, 'experiences/atlas-lab/qa', kind, 'result.json'));
  if (result.status !== 'passed' || result.paths.length !== expected || result.errors.length || result.externalRequests.length || result.modelCalls || result.actualUsers) throw new Error('Incomplete browser check: ' + kind);
  await write(`browser-${kind}.json`, result);
  browsers.push({ kind, paths: result.paths.length, screenshots: result.screenshots.length, errors: 0, externalRequests: 0, modelCalls: 0, at: result.at });
}
const served = [];
for (const name of ['dating.html', 'dating-ui.mjs', 'dating.css', 'dating-account.mjs', 'dating-insights.mjs', 'dating-journey.mjs', 'discovery-guidance.mjs', 'usability.html']) {
  const response = await fetch(origin + '/atlas-lab/' + name, { redirect: 'error' });
  const actual = digest(Buffer.from(await response.arrayBuffer())), expected = digest(await fs.readFile(path.join(root, 'experiences/atlas-lab', name)));
  if (response.status !== 200 || actual !== expected) throw new Error('Stale preview: ' + name);
  served.push({ path: 'experiences/atlas-lab/' + name, status: 200, sha256: actual, same: true });
}
await write('preview-check.json', { at: new Date().toISOString(), origin, files: served });
const previous = await read(path.join(root, 'docs/_ops/qa/atlas-dating-usability-readiness-20261007/sources.json'));
const engines = [];
for (const item of previous.filter(item => item.path.startsWith('atlas/'))) engines.push({ path: item.path, same: digest(await fs.readFile(path.join(root, item.path))) === item.sha256 });
if (engines.some(item => !item.same)) throw new Error('Engine drift during product work');
await write('engine-check.json', { engineCodeChangedByThisBatch: 0, newEngines: 0, checks: engines });
const priorFreeze = await read(path.join(root, 'docs/_ops/qa/atlas-dating-usability-readiness-20261007/frozen-check.json'));
const frozen = [];
for (const item of priorFreeze.checks) { const actual = digest(await fs.readFile(path.join(root, item.path))); frozen.push({ path: item.path, expected: item.expected, actual, same: actual === item.expected, changedSincePrior: actual !== item.actual }); }
if (frozen.some(item => item.changedSincePrior)) throw new Error('Paid model evaluation baseline drift');
await write('frozen-check.json', { at: new Date().toISOString(), method: 'hash-only-no-heldout-content-inspection', checks: frozen });
const paths = new Set([...previous.map(item => item.path), ...files, 'tests/atlas-dating-agency-smoke.mjs', 'docs/_ops/qa/atlas-dating-agency-20261007/finalize.mjs', 'docs/_ops/qa/atlas-dating-agency-20261007/run-note.json']);
const sources = [];
for (const name of paths) sources.push({ path: name, sha256: digest(await fs.readFile(path.join(root, name))) });
await write('sources.json', sources);
const report = { at: new Date().toISOString(), status: 'passed-in-scope',
  scope: ['Undo one current explicit exclusion while preserving context, other exclusions, timed hiding and history; no automatic selection, introduction or appointment restoration',
    'Capture a private allowance review only on an explicit recommendation record whose actual first candidate used the currently valid conditional contact reason',
    'Review or withdraw the feeling without changing the preference; a stop response can propose clearing only its bound layer through preview and explicit apply',
    'Source re-declaration, expiry, context or public generation changes invalidate old review authority without revival; old records never receive inferred snapshots'],
  tests, browsers, browserPaths: browsers.reduce((sum, item) => sum + item.paths, 0),
  preview: { url: origin + '/atlas-lab/dating.html', guide: origin + '/atlas-lab/usability.html', isolatedPreview: true, filesMatched: served.length },
  engineCodeChangedByThisBatch: 0, newEngines: 0, modelCalls: 0, externalApiCost: 0, actualUsers: 0, publicDeployment: false,
  limitations: ['Participants are deferred by the user. All browser roles and outcomes are synthetic.',
    'Allowance responses describe looking at a recommendation, not observed counterpart behavior, completed meetings or causal satisfaction improvements.',
    'Real SYNK login/adult verification, physical two devices and production operation remain unverified.',
    'Paid AI calls, paid model evaluations and tutor remain deferred. The pre-existing atlas/domain.js model freeze mismatch remains unchanged.'],
  artifacts: { design: 'docs/아틀라스_공통능력_고도화_20261005.md#18-개별-제외-취소와-허용-조건-회고-2026-10-07-후속', guide: 'experiences/atlas-lab/usability.html', browser: 'experiences/atlas-lab/qa/dating-agency/result.json', tests: 'docs/_ops/qa/atlas-dating-agency-20261007/tests-output.log' } };
await write('report.json', report);
const drift = [];
for (const item of sources) if (digest(await fs.readFile(path.join(root, item.path))) !== item.sha256) drift.push(item.path);
const section = (await fs.readFile(path.join(root, 'docs/아틀라스_공통능력_고도화_20261005.md'), 'utf8')).split('### 18.')[1].split('## 플레저:')[0];
const links = [];
for (const match of section.matchAll(/\]\(([^)]+)\)/g)) { const target = path.resolve(root, 'docs', match[1].split('#')[0]); await fs.access(target); links.push({ reference: match[1], exists: true }); }
await write('final-check.json', { at: new Date().toISOString(), sourceCount: sources.length, drift, localLinks: links, layoutWidths: [320, 390, 1280], actualUsers: 0 });
if (drift.length) throw new Error('Source drift after verification');
console.log(JSON.stringify({ tests, browserPaths: report.browserPaths, previewFiles: served.length, sources: sources.length, drift: drift.length, localLinks: links.length, actualUsers: 0, modelCalls: 0 }));
