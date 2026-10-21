// Assemble completed free checks; loopback static files and hashes only.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const qa = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qa, '../../../..');
const origin = 'http://127.0.0.1:54124';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const write = (name, value) => fs.writeFile(path.join(qa, name), JSON.stringify(value, null, 2) + '\n');
const output = await fs.readFile(path.join(qa, 'tests-output.log'), 'utf8');
const count = key => Number(output.match(new RegExp('^(?:#|ℹ) ' + key + ' (\\d+)', 'm'))?.[1] ?? NaN);
const testFiles = await read(path.join(qa, 'test-files.json'));
const tests = { files: testFiles.length, tests: count('tests'), pass: count('pass'), fail: count('fail'), cancelled: count('cancelled'), skipped: count('skipped') };
if (tests.files !== 6 || tests.tests !== 125 || tests.pass !== 125 || tests.fail || tests.cancelled || tests.skipped) throw new Error('Incomplete automated checks');
await write('test-summary.json', tests);
const browsers = [];
for (const [kind, expected] of [['dating-conditional-draft', 9], ['dating-flexibility', 10], ['dating', 18], ['dating-clarity', 4]]) {
  const result = await read(path.join(root, 'experiences/atlas-lab/qa', kind, 'result.json'));
  if (result.status !== 'passed' || result.paths.length !== expected || result.errors.length || result.externalRequests.length || result.modelCalls || result.actualUsers) throw new Error('Incomplete browser checks: ' + kind);
  await write(`browser-${kind}.json`, result);
  browsers.push({ kind, paths: result.paths.length, errors: 0, externalRequests: 0, modelCalls: 0, screenshots: result.screenshots.length, at: result.at });
}
const served = [];
for (const name of ['dating.html', 'dating-ui.mjs', 'dating.css', 'dating-account.mjs', 'dating-insights.mjs', 'dating-journey.mjs', 'discovery-guidance.mjs', 'usability.html']) {
  const response = await fetch(origin + '/atlas-lab/' + name, { redirect: 'error' });
  const actual = digest(Buffer.from(await response.arrayBuffer()));
  const expected = digest(await fs.readFile(path.join(root, 'experiences/atlas-lab', name)));
  if (response.status !== 200 || actual !== expected) throw new Error('Stale preview: ' + name);
  served.push({ path: 'experiences/atlas-lab/' + name, status: 200, sha256: actual, same: true });
}
await write('preview-check.json', { at: new Date().toISOString(), origin, files: served });
const previousSources = await read(path.join(root, 'docs/_ops/qa/atlas-dating-flexibility-20261007/sources.json'));
const engineChecks = [];
for (const item of previousSources.filter(item => item.path.startsWith('atlas/'))) {
  const actual = digest(await fs.readFile(path.join(root, item.path)));
  engineChecks.push({ path: item.path, same: actual === item.sha256 });
}
if (engineChecks.some(item => !item.same)) throw new Error('Engine changed during this product batch');
await write('engine-check.json', { engineCodeChangedByThisBatch: 0, newEngines: 0, checks: engineChecks });
const previousFreeze = await read(path.join(root, 'docs/_ops/qa/atlas-dating-flexibility-20261007/frozen-check.json'));
const frozenChecks = [];
for (const item of previousFreeze.checks) {
  const actual = digest(await fs.readFile(path.join(root, item.path)));
  frozenChecks.push({ path: item.path, expected: item.expected, actual, same: actual === item.expected, changedSincePrior: actual !== item.actual });
}
if (frozenChecks.some(item => item.changedSincePrior)) throw new Error('Model freeze files changed');
await write('frozen-check.json', { at: new Date().toISOString(), method: 'hash-only-no-heldout-content-inspection', checks: frozenChecks });
const paths = new Set([...previousSources.map(item => item.path), ...testFiles, 'tests/atlas-dating-conditional-draft-smoke.mjs',
  'docs/_ops/qa/atlas-dating-usability-readiness-20261007/finalize.mjs']);
const sources = [];
for (const name of paths) sources.push({ path: name, sha256: digest(await fs.readFile(path.join(root, name))) });
await write('sources.json', sources);
const report = { at: new Date().toISOString(), status: 'passed-in-scope',
  scope: ['Conditional draft cancellation preserves unsaved scope and deadline without applying them',
    'Stale preview cancellation reads current state and discards a changed original source while preserving drafts after peer-only public changes',
    'Each saved allowance layer exposes its scope, status and deadline; withdrawing the baseline remains visible even while the context allowance stays active',
    'Usability preparation supplies a private correction baseline and a date task consistent with mutually public availability'],
  tests, browsers, browserPaths: browsers.reduce((sum, item) => sum + item.paths, 0),
  preview: { url: origin + '/atlas-lab/dating.html', guide: origin + '/atlas-lab/usability.html', isolatedPreview: true, filesMatched: served.length },
  engineCodeChangedByThisBatch: 0, newEngines: 0, modelCalls: 0, externalApiCost: 0, actualUsers: 0, publicDeployment: false,
  limitations: ['Participants and real satisfaction measurement are deferred by the user; all browser checks use synthetic roles.',
    'This run covers 6 files and 125 automated checks, not a rerun of the earlier 614-check suite.',
    'Real SYNK login/adult verification, physical two devices and production operation remain unverified.',
    'Paid AI, paid evaluations and tutor remain deferred.',
    'The old model freeze still matches 8/9 with the unchanged pre-existing atlas/domain.js mismatch.'],
  artifacts: { design: 'docs/아틀라스_공통능력_고도화_20261005.md#17-입력-보존과-사용-범위의-설명-2026-10-07-후속',
    guide: 'experiences/atlas-lab/usability.html', tests: 'docs/_ops/qa/atlas-dating-usability-readiness-20261007/tests-output.log',
    beforeDraft: 'experiences/atlas-lab/qa/dating-conditional-draft/pre-fix-result.json', beforeLayers: 'conditional-layer-before.json', afterLayers: 'conditional-layer-after.json' } };
await write('report.json', report);
const drift = [];
for (const item of sources) if (digest(await fs.readFile(path.join(root, item.path))) !== item.sha256) drift.push(item.path);
const section = (await fs.readFile(path.join(root, 'docs/아틀라스_공통능력_고도화_20261005.md'), 'utf8')).split('### 17.')[1].split('## 플레저:')[0];
const links = [];
for (const match of section.matchAll(/\]\(([^)]+)\)/g)) {
  const target = path.resolve(root, 'docs', match[1].split('#')[0]);
  await fs.access(target); links.push({ reference: match[1], exists: true });
}
await write('final-check.json', { at: new Date().toISOString(), sourceCount: sources.length, drift, localLinks: links, layoutWidths: [320, 390, 1280], printedObservationWidth: 794 });
if (drift.length) throw new Error('Source drift after validation');
console.log(JSON.stringify({ tests, browserPaths: report.browserPaths, previewFiles: served.length, sources: sources.length, drift: drift.length, localLinks: links.length, actualUsers: 0, modelCalls: 0 }));
