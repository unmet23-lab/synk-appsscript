'use strict';
// Compose a local candidate from a sealed completed release and an explicit carry.
// QA, product review, Linux image testing and live admission remain separate.
const fs = require('node:fs');
const path = require('node:path');
const a = require('node:assert/strict');
const R = require('./closed-release.cjs');
function compose({ parent, sealSha256, carryFile, carrySha256, output }) {
  a.ok([parent, carryFile, output].every(path.isAbsolute), 'ABSOLUTE_INPUT_REQUIRED');
  const base = R.verify(parent, sealSha256);
  const rawCarry = R.read(carryFile, { sha256: carrySha256 }), carry = JSON.parse(rawCarry);
  a.equal(carry.parentManifestSha256, base.manifestSha256, 'CARRY_PARENT_CHANGED');
  a.ok(Array.isArray(carry.files) && carry.files.length > 0, 'CARRY_FILES_REQUIRED');
  const files = new Map(), graph = new Map(base.source), changes = [], seen = new Set();
  // A selected test whose subject left the source (its file was deleted in git) is retired explicitly: the parent file stays byte for
  // byte in the source and the image (this tool never removes a parent file) and only leaves the selection, with a written reason.
  const retired = new Set();
  a.ok(carry.retiredTests === undefined || Array.isArray(carry.retiredTests), 'RETIRED_TESTS_LIST_REQUIRED');
  for (const row of carry.retiredTests || []) {
    R.name(row.path); a.equal(retired.has(row.path), false, 'DUPLICATE_RETIRED_TEST'); retired.add(row.path);
    a.ok(base.tests.includes(row.path), 'RETIRED_TEST_NOT_SELECTED ' + row.path);
    a.equal(base.source.get(row.path)?.sha256, row.sha256, 'RETIRED_TEST_BYTES_CHANGED ' + row.path);
    a.ok(typeof row.reason === 'string' && row.reason.trim().length >= 10, 'RETIRED_TEST_REASON_REQUIRED ' + row.path);
  }
  // The other direction: a test that sits in the parent source outside the parent selection (no QA runs it) and that a carried commit
  // changes together with its subject is adopted explicitly (chain 57: client-closeout.test.mjs, changed by the 3c server commit beside
  // client-closeout.mjs). An adopted row names the carried path, its parent bytes and a written reason; the changed test then joins the
  // selection (and the image, as every carried file does), so the candidate QA runs it. Without a row the carry still stops below.
  const adopted = new Set();
  a.ok(carry.adoptedTests === undefined || Array.isArray(carry.adoptedTests), 'ADOPTED_TESTS_LIST_REQUIRED');
  for (const row of carry.adoptedTests || []) {
    R.name(row.path); a.equal(adopted.has(row.path), false, 'DUPLICATE_ADOPTED_TEST'); adopted.add(row.path);
    a.ok(/\.test\.[cm]?js$/.test(row.path), 'ADOPTED_TEST_NAME_REQUIRED ' + row.path);
    a.ok(base.source.has(row.path), 'ADOPTED_TEST_NOT_IN_PARENT_SOURCE ' + row.path);
    a.equal(base.tests.includes(row.path), false, 'ADOPTED_TEST_ALREADY_SELECTED ' + row.path);
    a.equal(row.beforeSha256, base.source.get(row.path).sha256, 'ADOPTED_TEST_BYTES_CHANGED ' + row.path);
    a.ok(carry.files.some(file => file.path === row.path), 'ADOPTED_TEST_NOT_CARRIED ' + row.path);
    a.ok(typeof row.reason === 'string' && row.reason.trim().length >= 10, 'ADOPTED_TEST_REASON_REQUIRED ' + row.path);
  }
  for (const row of base.source.values()) files.set('candidate/' + row.path, R.read(path.join(parent, 'candidate', row.path), row));
  for (const row of carry.files) {
    R.name(row.path); a.equal(seen.has(row.path), false, 'DUPLICATE_CARRY_PATH'); seen.add(row.path);
    a.equal(retired.has(row.path), false, 'RETIRED_TEST_ALSO_CARRIED ' + row.path);
    const before = base.source.get(row.path);
    a.equal(row.beforeSha256, before?.sha256 ?? null, 'CARRY_BEFORE_CHANGED ' + row.path);
    if (before && /\.test\.[cm]?js$/.test(row.path)) a.ok(base.tests.includes(row.path) || adopted.has(row.path), 'EXPLICIT_RETIRED_TEST_DECISION_REQUIRED');
    const raw = R.read(path.join(path.dirname(carryFile), 'files', row.path), row);
    a.notEqual(R.sha(raw), before?.sha256, 'UNCHANGED_CARRY_ROW');
    const after = { path: row.path, sha256: R.sha(raw), bytes: raw.length };
    graph.set(row.path, after); changes.push({ ...after, beforeSha256: before?.sha256 ?? null });
    files.set('candidate/' + row.path, raw);
  }
  const sourceRows = [...graph.values()].sort((x, y) => x.path.localeCompare(y.path, 'en'));
  const manifest = { ...base.documents.manifest, parentManifestSHA256: base.manifestSha256, files: sourceRows };
  const manifestRaw = R.encode(manifest), manifestSha256 = R.sha(manifestRaw);
  const imageNames = new Set([...base.image.keys(), ...changes.map(row => row.path)]);
  const images = sourceRows.filter(row => imageNames.has(row.path));
  const tests = [...new Set([...base.tests.filter(test => !retired.has(test)), ...changes.filter(row => /\.test\.[cm]?js$/.test(row.path)).map(row => row.path)])].sort();
  a.ok(tests.length > 0, 'SELECTED_TESTS_REQUIRED');
  const delta = sourceRows.filter(row => seen.has(row.path));
  const runtimeDeltaPaths = delta.filter(row => !row.path.endsWith('.md') && !/\.test\.[cm]?js$/.test(row.path) && !row.path.includes('/qa/')).map(row => row.path).sort();
  const composition = {
    schema: 'synk-company-sealed-parent-composition/v1', status: 'prepared-local-qa-required',
    manifestSha256, parentManifestSha256: base.manifestSha256, parentImage: base.imageId,
    parentSeal: { path: path.join(parent, 'completed-release.json'), sha256: sealSha256 },
    carry: { path: carryFile, sha256: carrySha256 }, sourceFiles: sourceRows.length,
    imagePayloadFiles: images.length, delta, runtimeDeltaFiles: runtimeDeltaPaths.length, runtimeDeltaPaths,
    baseSourceFiles: base.source.size, baseSourceFilesUnchanged: base.source.size - changes.filter(row => row.beforeSha256 !== null).length,
    parentFilesRemoved: 0, parentImageFilesRemoved: 0, parentTestsRemoved: 0,
    tests, addedSelectedTests: tests.filter(test => !base.tests.includes(test)),
    droppedSelectedTests: [...retired].sort(), retiredTests: (carry.retiredTests || []).map(row => ({ path: row.path, sha256: row.sha256, reason: row.reason })).sort((x, y) => x.path.localeCompare(y.path, 'en')),
    adoptedTests: (carry.adoptedTests || []).map(row => ({ path: row.path, beforeSha256: row.beforeSha256, reason: row.reason })).sort((x, y) => x.path.localeCompare(y.path, 'en')),
    plannedEnv: { additions: {} },
    actualLocalQa: false, actualLinuxQa: false, productReviewAccepted: false, finalDeploymentApproval: false,
    currentLiveStateVerified: false, remoteCalls: 0, productionMutations: 0
  };
  files.set('candidate/release-manifest.json', manifestRaw);
  files.set('image-payload.json', R.encode(images));
  files.set('composition.json', R.encode(composition));
  // Recheck all parent and donor inputs before creating any output.
  R.verify(parent, sealSha256); R.read(carryFile, { sha256: carrySha256 });
  for (const row of carry.files) R.read(path.join(path.dirname(carryFile), 'files', row.path), row);
  R.writeNew(output, files, stage => {
    for (const row of sourceRows) R.read(path.join(stage, 'candidate', row.path), row);
    R.exactDirectory(path.join(stage, 'candidate'), [...graph.keys(), 'release-manifest.json']);
  });
  return { status: composition.status, manifestSha256, sourceFiles: sourceRows.length, imageFiles: images.length, deltaFiles: delta.length, runtimeDeltaFiles: runtimeDeltaPaths.length, selectedTests: tests.length, output, remoteCalls: 0 };
}
module.exports = { compose };
if (require.main === module) {
  try { a.equal(process.argv.length, 3); console.log(JSON.stringify(compose(JSON.parse(R.read(process.argv[2]))))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
