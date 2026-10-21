// Assemble already completed free test evidence. No model or provider calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const qa = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qa, '../../../..');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const write = (name, value) => fs.writeFile(path.join(qa, name), JSON.stringify(value, null, 2) + '\n');
const tap = await fs.readFile(path.join(qa, 'tests.tap'), 'utf8');
const count = key => Number(tap.match(new RegExp('^# ' + key + ' (\\d+)', 'm'))?.[1] ?? NaN);
const files = await read(path.join(qa, 'test-files.json'));
const tests = { at: new Date().toISOString(), fileCount: files.length, tests: count('tests'), pass: count('pass'), fail: count('fail'), cancelled: count('cancelled'), skipped: count('skipped') };
if (tests.tests !== 614 || tests.pass !== 614 || tests.fail || tests.cancelled || tests.skipped) throw new Error('Incomplete scoped test evidence');
await write('test-summary.json', tests);
const browsers = [];
for (const kind of ['dating-flexibility', 'dating', 'dating-clarity']) {
  const source = path.join(root, 'experiences/atlas-lab/qa', kind, 'result.json'), result = await read(source);
  if (result.status !== 'passed' || result.errors.length || result.externalRequests.length || result.modelCalls) throw new Error('Failed browser proof: ' + kind);
  await fs.copyFile(source, path.join(qa, 'browser-' + kind + '.json'));
  browsers.push({ kind, status: result.status, at: result.at, paths: result.paths.length, errors: result.errors.length, externalRequests: result.externalRequests.length,
    modelCalls: result.modelCalls, screenshots: result.screenshots.length, result: 'experiences/atlas-lab/qa/' + kind + '/result.json' });
}
const origin = process.env.SYNK_FLEXIBILITY_PREVIEW_ORIGIN;
if (!origin || new URL(origin).hostname !== '127.0.0.1') throw new Error('Explicit loopback preview origin required');
const publicChecks = [];
for (const name of ['dating.html', 'dating-ui.mjs', 'dating.css', 'dating-account.mjs', 'dating-insights.mjs', 'dating-journey.mjs', 'discovery-guidance.mjs', 'usability.html']) {
  const response = await fetch(origin + '/atlas-lab/' + name), bytes = Buffer.from(await response.arrayBuffer()), source = await fs.readFile(path.join(root, 'experiences/atlas-lab', name));
  publicChecks.push({ file: name, status: response.status, matches: response.status === 200 && digest(bytes) === digest(source) });
}
if (publicChecks.some(item => !item.matches)) throw new Error('Preview source drift');
await write('preview-check.json', { at: new Date().toISOString(), url: origin + '/atlas-lab/dating.html', isolatedPreview: true, publicChecks });
const report = { at: new Date().toISOString(), status: 'passed-in-scope', scope: [
  'Authored alternative proposal followed by two new explicit confirmations for the current option version',
  'Legacy default agreement compatibility, stale proposal protection and independent scheduling',
  'Explicit conditional preference with current public facts, original source, hard criteria and expiry checks',
  'Schedule drafts retain automatic or manually edited end times after coordination responses',
  'Anonymous free usability tasks updated to cover alternative proposals and conditional acceptance'],
  engine: { existingEngineFilesModifiedByThisBatch: 0, coreModulesAdded: ['atlas/conditional-preference.js'], originalEnginesAdded: 0,
    reused: ['Existing Core Domain/Ask and preference contracts', 'Existing Domain policy objectives', 'Existing Temper observation contracts'],
    productAdapters: ['meeting-alignment.mjs', 'discovery.mjs', 'dating-service.mjs', 'dating-ui.mjs', 'dating-insights.mjs'] },
  tests, browsers, browserPaths: browsers.reduce((n, item) => n + item.paths, 0),
  preview: { url: origin + '/atlas-lab/dating.html', guide: origin + '/atlas-lab/usability.html', isolatedPreview: true, filesMatched: publicChecks.length },
  modelCalls: 0, externalApiCost: 0, actualUsers: 0, publicDeployment: false,
  limitations: ['Real adult usability sessions have not been run; 5-8 is an exploratory plan.', 'Meeting start is a preparation cutoff, not evidence of an actual meeting.',
    'Real identity/adult verification, physical two-device use and production operation remain unverified.', 'Paid AI, paid evaluations and tutor remain deferred.',
    'Old model freeze still matches 8/9 with the pre-existing atlas/domain.js mismatch; no paid evaluation or heldout content inspection.'],
  artifacts: { guide: 'experiences/atlas-lab/usability.html', design: 'docs/아틀라스_공통능력_고도화_20261005.md#16-새-만남-방식의-합의와-조건부-선호-2026-10-07-후속',
    coreContract: 'docs/코어엔진_설계.md#3-4-1-직접-확인한-조건부-허용--공통-구현-2026-10-07', tests: 'docs/_ops/qa/atlas-dating-flexibility-20261007/tests.tap' } };
await write('report.json', report);
const prior = await read(path.join(root, 'docs/_ops/qa/atlas-dating-alignment-20261007/sources.json'));
const extras = ['experiences/atlas-lab/meeting-alignment.mjs', 'experiences/atlas-lab/dating-store.mjs', 'experiences/atlas-lab/dating-account.mjs', 'experiences/atlas-lab/usability.html',
  'tests/atlas-meeting-alignment.test.mjs', 'tests/atlas-dating-alignment-service.test.mjs', 'tests/atlas-dating-flexibility-smoke.mjs',
  'atlas/conditional-preference.js', 'docs/코어엔진_설계.md', 'docs/엔진8종_상향설계_v3.md',
  'docs/_ops/qa/atlas-dating-flexibility-20261007/report.json', 'docs/_ops/qa/atlas-dating-flexibility-20261007/finalize.mjs'];
const sources = [];
for (const name of new Set([...prior.map(item => item.path), ...files, ...extras])) sources.push({ path: name, sha256: digest(await fs.readFile(path.join(root, name))) });
await write('sources.json', sources);
const design = await fs.readFile(path.join(root, 'docs/아틀라스_공통능력_고도화_20261005.md'), 'utf8'), section = design.split('### 16.')[1].split('## 플레저:')[0];
const links = [];
for (const [, reference] of section.matchAll(/\]\(([^)]+)\)/g)) { await fs.access(path.resolve(root, 'docs', reference.split('#')[0])); links.push({ reference, exists: true }); }
const drift = [];
for (const item of sources) if (digest(await fs.readFile(path.join(root, item.path))) !== item.sha256) drift.push(item.path);
await write('final-check.json', { at: new Date().toISOString(), sourceCount: sources.length, drift, localLinks: links, layoutWidths: [320, 390, 1280], printedObservationWidth: 794 });
console.log(JSON.stringify({ tests, paths: report.browserPaths, previewFiles: publicChecks.length, sources: sources.length, drift: drift.length, localLinks: links.length, actualUsers: 0, modelCalls: 0 }));
