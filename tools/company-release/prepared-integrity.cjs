'use strict';
// Verify an explicitly recovered preparation against its original pins; never re-pin current bytes.
const path = require('node:path');
const a = require('node:assert/strict');
const R = require('./closed-release.cjs');
const METADATA = ['candidate-validation.json', 'operator-input.json', 'operator-input-with-prior-arm.json', 'deployment/candidate-pin.json'];
const PREPARATION = 'deployment/operator-preparation.json', REARM = 'rearm/source-successor.json';

function verifyPreparedOutputs({ originalRaw, originalRearmRaw, changes, readyRaw }, readOutput) {
  const original = JSON.parse(originalRaw), ready = JSON.parse(readyRaw);
  a.ok(Array.isArray(changes), 'DECLARED_CHANGES_REQUIRED');
  const declared = new Map();
  for (const change of changes) {
    R.name(change.path);
    a.equal(declared.has(change.path), false, 'DUPLICATE_DECLARED_CHANGE');
    for (const key of ['before', 'after']) a.match(change[key] || '', /^[a-f0-9]{64}$/, 'DECLARED_HASH_REQUIRED');
    declared.set(change.path, change);
  }
  a.deepEqual([...declared.keys()].sort(), [...METADATA, PREPARATION, REARM].sort(), 'EXACT_DECLARED_CHANGE_SET_REQUIRED');
  const originalPins = R.rows(original.outputs.map(row => ({ path: row.name, sha256: row.sha256, bytes: row.bytes })));
  const measured = new Map();
  for (const row of originalPins.values()) {
    const raw = readOutput(row.path), change = declared.get(row.path);
    if (change) {
      a.ok(METADATA.includes(row.path), 'DOCUMENT_CANNOT_BE_OUTPUT_METADATA');
      a.equal(change.before, row.sha256, 'ORIGINAL_METADATA_HASH');
      a.equal(R.sha(raw), change.after, 'DECLARED_METADATA_RESULT');
    } else {
      a.equal(R.sha(raw), row.sha256, 'UNDECLARED_OUTPUT_DRIFT ' + row.path);
      a.equal(raw.length, row.bytes, 'UNDECLARED_OUTPUT_BYTES');
    }
    measured.set(row.path, R.record(row.path, raw));
  }
  for (const name of METADATA) a.ok(measured.has(name), 'METADATA_OUTSIDE_ORIGINAL_OUTPUTS');
  a.ok(measured.has('qa/result.json') && measured.has('qa/tests.tap'), 'QA_NOT_IN_ORIGINAL_OUTPUTS');
  const preparationRaw = readOutput(PREPARATION), rearmRaw = readOutput(REARM);
  a.equal(declared.get(PREPARATION).before, R.sha(originalRaw), 'ORIGINAL_PREPARATION_HASH');
  a.equal(declared.get(PREPARATION).after, R.sha(preparationRaw), 'CURRENT_PREPARATION_HASH');
  a.equal(declared.get(REARM).before, R.sha(originalRearmRaw), 'ORIGINAL_REARM_HASH');
  a.equal(declared.get(REARM).after, R.sha(rearmRaw), 'CURRENT_REARM_HASH');
  a.equal(ready.status, 'passed-local');
  a.equal(ready.preparationSha256, R.sha(preparationRaw), 'READY_PREPARATION_HASH');
  const current = JSON.parse(preparationRaw);
  const currentPins = R.rows(current.outputs.map(row => ({ path: row.name, sha256: row.sha256, bytes: row.bytes })));
  a.equal(currentPins.size, measured.size, 'CURRENT_OUTPUT_COUNT');
  for (const [name, row] of currentPins) a.deepEqual(row, measured.get(name), 'CURRENT_PIN_IS_NOT_ORIGINAL_OR_DECLARED_CHANGE');
  const qa = JSON.parse(readOutput('qa/result.json'));
  a.equal(qa.logSha256, measured.get('qa/tests.tap').sha256, 'QA_TAP_PIN_MISMATCH');
  a.equal(qa.ok, true); a.equal(qa.exitCode, 0); a.equal(qa.sourceUnchanged, true);
  a.ok(Number.isSafeInteger(qa.counts.tests) && qa.counts.tests > 0);
  a.equal(qa.counts.pass, qa.counts.tests);
  for (const key of ['fail', 'cancelled', 'skipped', 'todo']) a.equal(qa.counts[key], 0);
  a.equal(qa.manifestSha256, ready.manifest, 'QA_MANIFEST_CHANGED');
  return { status: 'passed-local-integrity', originalOutputPinsVerified: measured.size, documentPairs: 2,
    originalQaAndTapPinsPresent: true, preparationMatchesReady: true, metadataRewritten: false,
    remoteCalls: 0, productionMutations: 0, qaReexecuted: false, finalDeploymentApproval: false };
}

function verifyRecoveredPreparation({ root, original, originalRearm, changes, readySha256 }) {
  a.ok(path.isAbsolute(root), 'ABSOLUTE_PREPARATION_ROOT_REQUIRED');
  function pinned(pin) {
    a.ok(pin && path.isAbsolute(pin.path), 'ABSOLUTE_PIN_REQUIRED');
    a.match(pin.sha256 || '', /^[a-f0-9]{64}$/, 'EXPLICIT_INPUT_PIN_REQUIRED');
    return R.read(pin.path, pin);
  }
  a.match(readySha256 || '', /^[a-f0-9]{64}$/, 'EXPLICIT_READY_PIN_REQUIRED');
  const originalRaw = pinned(original), originalRearmRaw = pinned(originalRearm), changesRaw = pinned(changes);
  const readyRaw = R.read(path.join(root, 'deployment/operator-ready.json'), { sha256: readySha256 });
  const proof = verifyPreparedOutputs({ originalRaw, originalRearmRaw, changes: JSON.parse(changesRaw), readyRaw }, name => R.read(path.join(root, name)));
  // All externally supplied pins must still match after the read-only check.
  pinned(original); pinned(originalRearm); pinned(changes);
  R.read(path.join(root, 'deployment/operator-ready.json'), { sha256: readySha256 });
  return { ...proof, manifestSha256: JSON.parse(readyRaw).manifest, readySha256,
    originalPreparationSha256: original.sha256, originalRearmSha256: originalRearm.sha256, changesSha256: changes.sha256,
    verifierSha256: R.sha(R.read(__filename)) };
}

module.exports = { verifyPreparedOutputs, verifyRecoveredPreparation };
if (require.main === module) {
  try {
    a.equal(process.argv.length, 3);
    console.log(JSON.stringify(verifyRecoveredPreparation(JSON.parse(R.read(process.argv[2])))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
