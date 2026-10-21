// Free loopback checks only; no model requests or production writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const qa = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(qa, '../../../..');
const origin = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '')) throw new Error('Isolated loopback preview required');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const write = (name, value) => fs.writeFile(path.join(qa, name), JSON.stringify(value, null, 2) + '\n');
const summary = log => Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped'].map(key => [key,
  Number(log.match(new RegExp('^(?:#|ℹ) ' + key + ' (\\d+)', 'm'))?.[1] ?? NaN)]));
const main = summary(await fs.readFile(path.join(qa, 'tests-output.log'), 'utf8'));
const service = summary(await fs.readFile(path.join(qa, 'tests-service.log'), 'utf8'));
if (main.tests !== 107 || main.pass !== 107 || service.tests !== 57 || service.pass !== 57
  || [main, service].some(run => !Number.isFinite(run.tests) || run.fail || run.cancelled || run.skipped)) throw new Error('Incomplete automatic checks');
const files = await read(path.join(qa, 'test-files.json'));
if (files.length !== 8 || new Set(files).size !== 8) throw new Error('Unexpected file scope');
const tests = { files: files.length, tests: main.tests + service.tests, pass: main.pass + service.pass,
  fail: 0, cancelled: 0, skipped: 0, runs: { main, service } };
await write('test-summary.json', tests);
const reproduction = await read(path.join(root, 'experiences/atlas-lab/qa/dating-input-continuity/reproduction.json'));
if (reproduction.status !== 'reproduced' || reproduction.paths.length !== 2 || reproduction.errors.length
  || reproduction.externalRequests.length || reproduction.modelCalls || reproduction.actualUsers) throw new Error('Missing before-fix reproduction');
await write('reproduction.json', reproduction);
const browsers = [];
for (const [kind, expected] of [['dating-input-continuity', 11], ['dating-conditional-draft', 9], ['dating-flexibility', 10], ['dating', 18], ['dating-clarity', 4]]) {
  const result = await read(path.join(root, 'experiences/atlas-lab/qa', kind, 'result.json'));
  if (result.status !== 'passed' || result.paths.length !== expected || result.errors.length
    || result.externalRequests.length || result.modelCalls || result.actualUsers) throw new Error('Incomplete browser checks: ' + kind);
  await write(`browser-${kind}.json`, result);
  browsers.push({ kind, paths: result.paths.length, screenshots: result.screenshots.length, errors: 0,
    externalRequests: 0, modelCalls: 0, at: result.at });
}
const served = [];
for (const name of ['dating.html', 'dating-ui.mjs', 'dating.css', 'dating-account.mjs', 'dating-insights.mjs', 'dating-journey.mjs', 'discovery-guidance.mjs', 'usability.html']) {
  const response = await fetch(origin + '/atlas-lab/' + name, { redirect: 'error' });
  const actual = hash(Buffer.from(await response.arrayBuffer())), expected = hash(await fs.readFile(path.join(root, 'experiences/atlas-lab', name)));
  if (response.status !== 200 || actual !== expected) throw new Error('Stale preview: ' + name);
  served.push({ path: 'experiences/atlas-lab/' + name, status: 200, sha256: actual, same: true });
}
await write('preview-check.json', { at: new Date().toISOString(), origin, files: served });
const previous = await read(path.join(root, 'docs/_ops/qa/atlas-dating-agency-20261007/sources.json'));
const engines = [];
for (const item of previous.filter(item => item.path.startsWith('atlas/'))) engines.push({ path: item.path,
  same: hash(await fs.readFile(path.join(root, item.path))) === item.sha256 });
if (engines.some(item => !item.same)) throw new Error('Engine source changed during product fixes');
await write('engine-check.json', { engineCodeChangedByThisBatch: 0, newEngines: 0, checks: engines });
const previousFreeze = await read(path.join(root, 'docs/_ops/qa/atlas-dating-agency-20261007/frozen-check.json'));
const frozen = [];
for (const item of previousFreeze.checks) {
  const actual = hash(await fs.readFile(path.join(root, item.path)));
  frozen.push({ path: item.path, expected: item.expected, actual, same: actual === item.expected, changedSincePrior: actual !== item.actual });
}
if (frozen.some(item => item.changedSincePrior)) throw new Error('Paid evaluation baseline changed');
await write('frozen-check.json', { at: new Date().toISOString(), method: 'hash-only-no-heldout-content-inspection', checks: frozen });
const paths = new Set([...previous.map(item => item.path), ...files, 'tests/atlas-dating-input-continuity-smoke.mjs',
  'docs/_ops/qa/atlas-dating-input-continuity-20261007/finalize.mjs', 'docs/_ops/qa/atlas-dating-input-continuity-20261007/run-note.json']);
const sources = [];
for (const name of paths) sources.push({ path: name, sha256: hash(await fs.readFile(path.join(root, name))) });
await write('sources.json', sources);
const report = { at: new Date().toISOString(), status: 'passed-in-scope',
  scope: ['An unknown or expired preference stays unselected and cannot be declared by changing only the required checkbox',
    'Only an explicitly selected answer can enter preview; cancellation preserves its private input while source changes discard it',
    'Unsent appointment inputs and automatic/manual end-time mode persist across app navigation and unchanged refresh in the same tab',
    'Account, introduction, public access and structural appointment changes invalidate drafts, including unseen pause and storage round trips',
    'Explicit place/duration reuse shares the same draft boundary; with storage consent off it is limited to the current form',
    'Successful sends clear the corresponding draft; navigation and restoration never send an appointment automatically'],
  tests, browsers, browserPaths: browsers.reduce((sum, item) => sum + item.paths, 0),
  preview: { url: origin + '/atlas-lab/dating.html', isolatedPreview: true, filesMatched: served.length },
  engineCodeChangedByThisBatch: 0, newEngines: 0, modelCalls: 0, externalApiCost: 0, actualUsers: 0, publicDeployment: false,
  limitations: ['All browser participants are virtual adults; satisfaction, meeting results and real participant usability are unmeasured.',
    'Drafts are tab memory only. Reload, tab closure and another device do not retain them; no browser persistent storage or server draft storage was added.',
    'Server refresh is needed to learn a counterpart change. The guard supplements existing server authorization and CAS checks, never replaces them.',
    'Real SYNK login, adult verification, physical two devices and production operation remain unverified.',
    'Paid AI calls, paid evaluation, tutor and participant recruitment remain deferred. The previous domain.js freeze mismatch is unchanged.'],
  artifacts: { design: 'docs/아틀라스_공통능력_고도화_20261005.md#19-미확인-답과-작성-중인-약속-2026-10-07-후속',
    browser: 'experiences/atlas-lab/qa/dating-input-continuity/result.json', tests: 'docs/_ops/qa/atlas-dating-input-continuity-20261007/tests-output.log' } };
await write('report.json', report);
const drift = [];
for (const item of sources) if (hash(await fs.readFile(path.join(root, item.path))) !== item.sha256) drift.push(item.path);
const section = (await fs.readFile(path.join(root, 'docs/아틀라스_공통능력_고도화_20261005.md'), 'utf8')).split('### 19.')[1]?.split('## 플레저:')[0];
if (!section) throw new Error('Missing product contract');
const links = [];
for (const match of section.matchAll(/\]\(([^)]+)\)/g)) {
  const target = path.resolve(root, 'docs', match[1].split('#')[0]); await fs.access(target); links.push({ reference: match[1], exists: true });
}
await write('final-check.json', { at: new Date().toISOString(), sourceCount: sources.length, drift, localLinks: links,
  layoutWidths: [320, 390, 1280], screenshotInspection: ['unknown-is-unselected-390.png', 'new-schedule-retained-390.png'], actualUsers: 0 });
if (drift.length) throw new Error('Source drift after checks');
console.log(JSON.stringify({ tests, browserPaths: report.browserPaths, previewFiles: served.length, sources: sources.length, drift: drift.length, actualUsers: 0, modelCalls: 0 }));
