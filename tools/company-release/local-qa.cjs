'use strict';
// Isolated local tests. This proof never authorizes Linux admission or deployment.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const a = require('node:assert/strict');
const R = require('./closed-release.cjs');

function runLocalQa({ candidate, compositionSha256, output, guard, expectedTests, dependencyRoots = [] }) {
  a.ok([candidate, output, guard?.path].every(value => typeof value === 'string' && path.isAbsolute(value)), 'ABSOLUTE_QA_INPUT_REQUIRED');
  const relative = path.relative(candidate, output);
  a.ok(relative.startsWith('..' + path.sep) || path.isAbsolute(relative), 'QA_OUTPUT_OUTSIDE_CANDIDATE_REQUIRED');
  a.equal(fs.existsSync(output), false, 'NEW_QA_DIRECTORY_REQUIRED');
  a.ok(Number.isSafeInteger(expectedTests) && expectedTests > 0, 'EXPECTED_TEST_COUNT_REQUIRED');
  const compositionFile = path.join(candidate, 'composition.json');
  const runnerFile = __filename, verifierFile = require.resolve('./closed-release.cjs');
  const runnerSha256 = R.sha(R.read(runnerFile)), verifierSha256 = R.sha(R.read(verifierFile));
  const compositionRaw = R.read(compositionFile, { sha256: compositionSha256 });
  const composition = JSON.parse(compositionRaw);
  a.equal(composition.status, 'prepared-local-qa-required');
  const source = path.join(candidate, 'candidate');
  const manifestRaw = R.read(path.join(source, 'release-manifest.json'), { sha256: composition.manifestSha256 });
  const manifest = JSON.parse(manifestRaw), rows = R.rows(manifest.files);
  a.equal(manifest.parentManifestSHA256, composition.parentManifestSha256);
  a.ok(Array.isArray(composition.tests) && composition.tests.length > 0);
  a.equal(new Set(composition.tests).size, composition.tests.length, 'DUPLICATE_QA_TEST');
  for (const name of composition.tests) { R.name(name); a.ok(rows.has(name) && /\.test\.[cm]?js$/.test(name), 'QA_TEST_OUTSIDE_SOURCE'); }
  const guardRaw = R.read(guard.path, { sha256: guard.sha256 });
  for (const root of dependencyRoots) a.ok(path.isAbsolute(root) && fs.statSync(root).isDirectory(), 'ABSOLUTE_DEPENDENCY_ROOT_REQUIRED');
  const vector = root => [...rows.values(), R.record('release-manifest.json', manifestRaw)].map(row => R.record(row.path, R.read(path.join(root, row.path))));
  const before = vector(source);
  for (const row of rows.values()) R.read(path.join(source, row.path), row);
  R.exactDirectory(source, [...rows.keys(), 'release-manifest.json']);

  const scratch = fs.mkdtempSync(path.join(path.dirname(output), '.company-local-qa-'));
  const copy = path.join(scratch, 'candidate'), temp = path.join(scratch, 'temp');
  fs.mkdirSync(temp);
  const copyFiles = new Map([...rows.values()].map(row => [row.path, R.read(path.join(source, row.path), row)]));
  copyFiles.set('release-manifest.json', manifestRaw);
  R.writeNew(copy, copyFiles);
  const copyBefore = vector(copy);
  const guardFile = path.join(scratch, 'network-guard.cjs');
  fs.writeFileSync(guardFile, guardRaw, { flag: 'wx', mode: 0o600 });
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  Object.assign(env, { HOME: temp, USERPROFILE: temp, APPDATA: temp, LOCALAPPDATA: temp,
    TEMP: temp, TMP: temp, TMPDIR: temp, SYNK_SOCIAL_AI_ENABLED: '0', NODE_PATH: dependencyRoots.join(path.delimiter) });
  const logFile = path.join(scratch, 'tests.tap'), errFile = path.join(scratch, 'stderr.txt');
  const logFd = fs.openSync(logFile, 'wx'), errFd = fs.openSync(errFile, 'wx');
  const startedAt = new Date().toISOString();
  let result;
  try {
    result = cp.spawnSync(process.execPath, ['--require', guardFile, '--test', '--test-reporter=tap', '--test-concurrency=3', ...composition.tests],
      { cwd: copy, env, windowsHide: true, stdio: ['ignore', logFd, errFd], timeout: 600000 });
  } finally { fs.closeSync(logFd); fs.closeSync(errFd); }
  const log = R.read(logFile), counts = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...log.toString().matchAll(new RegExp('^# ' + key + ' (\\d+)\\s*$', 'gm'))];
    counts[key] = matches.length === 1 ? Number(matches[0][1]) : -1;
  }
  let after = null, copyAfter = null, sourceUnchanged = false, integrityError = null;
  try {
    after = vector(source); copyAfter = vector(copy);
    R.exactDirectory(source, [...rows.keys(), 'release-manifest.json']);
    R.read(compositionFile, { sha256: compositionSha256 });
    a.deepEqual(after, before); a.deepEqual(copyAfter, copyBefore);
    R.read(guardFile, { sha256: guard.sha256 });
    R.read(runnerFile, { sha256: runnerSha256 }); R.read(verifierFile, { sha256: verifierSha256 });
    sourceUnchanged = true;
  } catch (error) { integrityError = error.message; }
  const ok = result.status === 0 && !result.error && sourceUnchanged && counts.tests === expectedTests && counts.pass === expectedTests &&
    ['fail', 'cancelled', 'skipped', 'todo'].every(key => counts[key] === 0);
  const files = new Map([
    ['tests.tap', log], ['stderr.txt', R.read(errFile)],
    ['source-before.json', R.encode(before)], ['source-after.json', R.encode(after)],
    ['copy-before.json', R.encode(copyBefore)], ['copy-after.json', R.encode(copyAfter)],
  ]);
  const proof = { schema: 'synk-company-isolated-local-qa/v1', ok, status: ok ? 'passed-local' : 'failed-local',
    manifestSha256: composition.manifestSha256, parentManifestSha256: composition.parentManifestSha256, compositionSha256,
    startedAt, finishedAt: new Date().toISOString(), exitCode: result.status, error: result.error?.message || integrityError,
    node: process.version, platform: process.platform, tests: composition.tests, counts, expectedTests, sourceUnchanged,
    logSha256: R.sha(log), networkGuardSha256: guard.sha256, runnerSha256, verifierSha256,
    vectors: Object.fromEntries([...files].filter(([name]) => name.endsWith('.json')).map(([name, raw]) => [name, R.record(name, raw)])),
    scratch, externalNetworkGuardApplied: true, productionMutations: 0, actualLinuxQa: false, finalDeploymentApproval: false };
  files.set('result.json', R.encode(proof));
  R.writeNew(output, files);
  return proof;
}

module.exports = { runLocalQa };
if (require.main === module) {
  try {
    a.equal(process.argv.length, 3);
    const proof = runLocalQa(JSON.parse(R.read(process.argv[2])));
    console.log(JSON.stringify(proof)); if (!proof.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
