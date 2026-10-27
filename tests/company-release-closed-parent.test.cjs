'use strict';
const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require('../tools/company-release/closed-release.cjs');
const { compose } = require('../tools/company-release/compose.cjs');
const { runLocalQa } = require('../tools/company-release/local-qa.cjs');
const { verifyPreparedOutputs } = require('../tools/company-release/prepared-integrity.cjs');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cr-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'release'); fs.mkdirSync(root);
  const put = (name, raw) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw); return R.record(name, raw); };
  const sources = [{ path: 'app.mjs', raw: Buffer.from('export const value = 1;\n') }, { path: 'app.test.mjs', raw: Buffer.from("import test from 'node:test'; import assert from 'node:assert/strict'; import {value} from './app.mjs'; test('fixture value',()=>assert.ok(value>0));\n") }];
  const rows = sources.map(({ path: name, raw }) => { put('candidate/' + name, raw); return R.record(name, raw); });
  const manifest = { version: 1, kind: 'pulse-independent-web-pwa', parentManifestSHA256: 'b'.repeat(64), files: rows };
  const manifestRaw = R.encode(manifest), manifestSha256 = R.sha(manifestRaw);
  const approvalRaw = R.encode({ candidateManifest: { sha256: manifestSha256 } });
  const contractRaw = R.encode({ requestId: 'request', deployment: { inputSha256: R.sha(approvalRaw) }, nextPlan: { armed: true, release: { manifestSha256 } } });
  const check = { status: 'passed', armed: true, releaseSha256: manifestSha256 };
  const post = { ...check, contractSha256: R.sha(contractRaw), requestId: 'request', readOnlySnapshot: { collectionTiming: { localAfter: 42 } } };
  const result = count => ({ exit: 0, counts: { tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 } });
  const receipt = { schema: 'synk-ha-reviewed-candidate/v1', manifestSha256, parentManifestSha256: manifest.parentManifestSHA256, imageId: 'sha256:' + 'c'.repeat(64), linuxPassed: true, sourceFiles: 2, runtimeHashFiles: 2, productionDataMounted: false, productionServiceActions: 0, tests: { production: result(1), compat: result(2) } };
  const boundContract = JSON.parse(contractRaw);
  boundContract.deployment.candidateReceiptSha256 = R.sha(R.encode(receipt));
  const boundContractRaw = R.encode(boundContract); post.contractSha256 = R.sha(boundContractRaw);
  const pins = {
    manifest: put('candidate/release-manifest.json', manifestRaw), images: put('images.json', R.encode(rows)),
    selection: put('selection.json', R.encode({ manifestSha256, productionTests: 1, tests: ['app.test.mjs'] })),
    receipt: put('receipt.json', R.encode(receipt)), approval: put('approval.json', approvalRaw),
    contract: put('contract.json', boundContractRaw), postcheck: put('postcheck.json', R.encode(post)),
    validator: put('validator.cjs', Buffer.from('module.exports={validate(){return ' + JSON.stringify(check) + ';}};\n'))
  };
  const config = { root, pins, output: path.join(temp, 'closed') };
  const preserve = () => R.preserve(config);
  return { temp, root, put, pins, config, preserve, manifestSha256 };
}
test('a closed release survives removal of its original working folder', t => {
  const f = fixture(t), saved = f.preserve();
  fs.renameSync(f.root, path.join(f.temp, 'removed-original'));
  const checked = R.verify(saved.output, saved.sealSha256);
  a.equal(checked.manifestSha256, f.manifestSha256); a.equal(checked.source.size, 2);
  a.equal(checked.seal.currentLiveStateVerified, false); a.equal(checked.seal.deploymentAuthorized, false);
});
test('source tampering and unlisted files both stop preservation', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'candidate/app.mjs'), 'changed');
  a.throws(f.preserve, /RELEASE_INPUT_SHA/); a.equal(fs.existsSync(f.config.output), false);
  fs.writeFileSync(path.join(f.root, 'candidate/app.mjs'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(f.root, 'candidate/extra.mjs'), 'extra');
  a.throws(f.preserve, /RELEASE_SOURCE_CLOSURE/); a.equal(fs.existsSync(f.config.output), false);
});
test('a failed Linux receipt cannot become a completed parent even with matching input hashes', t => {
  const f = fixture(t), receipt = JSON.parse(R.read(path.join(f.root, f.pins.receipt.path)));
  receipt.tests.production.counts.fail = 1; f.pins.receipt = f.put('receipt.json', R.encode(receipt));
  a.throws(f.preserve); a.equal(fs.existsSync(f.config.output), false);
});
test('the actual pinned validator must accept the saved postcheck', t => {
  const f = fixture(t);
  f.pins.validator = f.put('reject.cjs', Buffer.from("module.exports={validate(){throw Error('ACTUAL_POSTCHECK_REJECTED');}};\n"));
  a.throws(f.preserve, /ACTUAL_POSTCHECK_REJECTED/); a.equal(fs.existsSync(f.config.output), false);
});
test('a different passed receipt for the same source cannot replace the receipt bound by the armed contract', t => {
  const f = fixture(t), receipt = JSON.parse(R.read(path.join(f.root, f.pins.receipt.path)));
  receipt.imageId = 'sha256:' + 'd'.repeat(64);
  f.pins.receipt = f.put('receipt.json', R.encode(receipt));
  a.throws(f.preserve, /ARMED_RECEIPT_CHANGED/); a.equal(fs.existsSync(f.config.output), false);
});
test('paired contract, input and postcheck hashes cannot be mixed', t => {
  const f = fixture(t), post = JSON.parse(R.read(path.join(f.root, f.pins.postcheck.path)));
  post.contractSha256 = 'f'.repeat(64); f.pins.postcheck = f.put('postcheck.json', R.encode(post));
  a.throws(f.preserve); a.equal(fs.existsSync(f.config.output), false);
});
test('path traversal and duplicate rows are rejected', () => {
  for (const value of ['../a', '/a', 'a/../b', 'C:/a', 'a\\b', 'a//b']) a.throws(() => R.name(value));
  const row = { path: 'a', sha256: 'a'.repeat(64), bytes: 0 };
  a.throws(() => R.rows([row, row]), /DUPLICATE_RELEASE_ROW/);
});
test('composition preserves parent bytes, images and selected tests and requires fresh QA', t => {
  const f = fixture(t), saved = f.preserve(), carry = path.join(f.temp, 'carry'); fs.mkdirSync(carry);
  const raw = Buffer.from('export const value = 2;\n'); fs.mkdirSync(path.join(carry, 'files')); fs.writeFileSync(path.join(carry, 'files/app.mjs'), raw);
  const before = R.sha(R.read(path.join(f.root, 'candidate/app.mjs')));
  const carryRaw = R.encode({ parentManifestSha256: saved.manifest, files: [{ ...R.record('app.mjs', raw), beforeSha256: before }] });
  const carryFile = path.join(carry, 'files.json'); fs.writeFileSync(carryFile, carryRaw);
  const config = { parent: saved.output, sealSha256: saved.sealSha256, carryFile, carrySha256: R.sha(carryRaw), output: path.join(f.temp, 'candidate') };
  const result = compose(config), composition = JSON.parse(R.read(path.join(config.output, 'composition.json')));
  a.equal(result.deltaFiles, 1); a.equal(result.selectedTests, 1); a.equal(result.imageFiles, 2);
  a.deepEqual(composition.tests, ['app.test.mjs']); a.equal(composition.actualLocalQa, false);
  a.equal(composition.finalDeploymentApproval, false); a.equal(composition.parentFilesRemoved, 0);
  a.equal(R.sha(R.read(path.join(config.output, 'candidate/app.test.mjs'))), R.sha(R.read(path.join(f.root, 'candidate/app.test.mjs'))));
  a.throws(() => compose(config), /NEW_RELEASE_DIRECTORY_REQUIRED/);
  config.output = path.join(f.temp, 'bad-candidate');
  const wrong = { ...JSON.parse(carryRaw), parentManifestSha256: 'f'.repeat(64) }, wrongRaw = R.encode(wrong);
  fs.writeFileSync(carryFile, wrongRaw); config.carrySha256 = R.sha(wrongRaw);
  a.throws(() => compose(config), /CARRY_PARENT_CHANGED/); a.equal(fs.existsSync(config.output), false);
});

test('an atomic preparation is invisible until validation finishes and preserves an existing destination', t => {
  const f = fixture(t), output = path.join(f.temp, 'atomic');
  const files = new Map([['nested/a.txt', Buffer.from('a')], ['b.txt', Buffer.from('b')]]);
  R.writeNew(output, files, stage => {
    a.equal(fs.existsSync(output), false); a.equal(fs.readFileSync(path.join(stage, 'b.txt'), 'utf8'), 'b');
  });
  a.equal(fs.readFileSync(path.join(output, 'nested/a.txt'), 'utf8'), 'a');
  a.throws(() => R.writeNew(output, files), /NEW_RELEASE_DIRECTORY_REQUIRED/);
  a.equal(fs.readFileSync(path.join(output, 'b.txt'), 'utf8'), 'b');
});

test('write errors, rejected validation and validation-time drift never publish a partial release', t => {
  const f = fixture(t);
  for (const mode of ['write', 'validation', 'drift', 'addition']) {
    const output = path.join(f.temp, mode), files = new Map([['a', Buffer.from('a')]]);
    if (mode === 'write') files.set('a/nested', Buffer.from('b'));
    a.throws(() => R.writeNew(output, files, stage => {
      if (mode === 'validation') throw Error('REJECTED_VALIDATION');
      if (mode === 'drift') fs.writeFileSync(path.join(stage, 'a'), 'changed');
      if (mode === 'addition') fs.writeFileSync(path.join(stage, 'unknown'), 'new');
    }));
    a.equal(fs.existsSync(output), false, mode);
  }
});

test('a destination created while validation runs is not replaced', t => {
  const f = fixture(t), output = path.join(f.temp, 'race');
  a.throws(() => R.writeNew(output, new Map([['new', Buffer.from('new')]]), () => {
    fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'other-owner'), 'preserve');
  }), /NEW_RELEASE_DIRECTORY_REQUIRED/);
  a.equal(fs.readFileSync(path.join(output, 'other-owner'), 'utf8'), 'preserve');
});

function qaFixture(t, source) {
  const f = fixture(t);
  if (typeof source === 'function') source = source(f);
  if (source) {
    const manifestFile = path.join(f.root, 'candidate/release-manifest.json');
    // A fresh sealed parent is easier to keep honest than re-pinning a modified parent.
    const saved = f.preserve(), carryDir = path.join(f.temp, 'carry');
    fs.mkdirSync(path.join(carryDir, 'files'), { recursive: true });
    const raw = Buffer.from(source), name = 'app.test.mjs';
    fs.writeFileSync(path.join(carryDir, 'files', name), raw);
    const row = JSON.parse(fs.readFileSync(manifestFile)).files.find(r => r.path === name);
    const carryRaw = R.encode({ parentManifestSha256: saved.manifest, files: [{ ...R.record(name, raw), beforeSha256: row.sha256 }] });
    const carryFile = path.join(carryDir, 'files.json'); fs.writeFileSync(carryFile, carryRaw);
    const candidate = path.join(f.temp, 'composed');
    compose({ parent: saved.output, sealSha256: saved.sealSha256, carryFile, carrySha256: R.sha(carryRaw), output: candidate });
    const guardFile = path.join(f.temp, 'guard.cjs'), guardRaw = Buffer.from("if(process.env.SYNK_TEST_PRIVATE_ENV)throw Error('UNSAFE_ENV_INHERITED');globalThis.__qaGuard=true;\n");
    fs.writeFileSync(guardFile, guardRaw);
    return { ...f, candidate, config: { candidate, compositionSha256: R.sha(fs.readFileSync(path.join(candidate, 'composition.json'))),
      output: path.join(f.temp, 'qa-proof'), guard: { path: guardFile, sha256: R.sha(guardRaw) }, expectedTests: 1 } };
  }
  throw Error('QA_SOURCE_REQUIRED');
}

test('portable local QA runs real selected tests in a copy and saves both source vectors without inherited credentials', t => {
  const f = qaFixture(t, "import test from 'node:test';import assert from 'node:assert/strict';import {value} from './app.mjs';test('isolated',()=>{assert.equal(value,1);assert.equal(globalThis.__qaGuard,true);assert.equal(process.env.SYNK_TEST_PRIVATE_ENV,undefined);});\n");
  const previous = process.env.SYNK_TEST_PRIVATE_ENV; process.env.SYNK_TEST_PRIVATE_ENV = 'synthetic';
  t.after(() => { if (previous === undefined) delete process.env.SYNK_TEST_PRIVATE_ENV; else process.env.SYNK_TEST_PRIVATE_ENV = previous; });
  const result = runLocalQa(f.config);
  a.equal(result.ok, true); a.equal(result.counts.pass, 1); a.equal(result.finalDeploymentApproval, false);
  a.deepEqual(JSON.parse(fs.readFileSync(path.join(f.config.output, 'source-before.json'))), JSON.parse(fs.readFileSync(path.join(f.config.output, 'source-after.json'))));
  a.equal(result.vectors['copy-before.json'].sha256, result.vectors['copy-after.json'].sha256);
  a.throws(() => runLocalQa(f.config), /NEW_QA_DIRECTORY_REQUIRED/);
});

test('missing guard pins and the wrong expected test count cannot produce a passed QA proof', t => {
  const f = qaFixture(t, "import test from 'node:test';test('one real test',()=>{});\n");
  a.throws(() => runLocalQa({ ...f.config, guard: { ...f.config.guard, sha256: 'f'.repeat(64) } }), /RELEASE_INPUT_SHA/);
  a.equal(fs.existsSync(f.config.output), false);
  const result = runLocalQa({ ...f.config, expectedTests: 2 });
  a.equal(result.ok, false); a.equal(result.status, 'failed-local'); a.equal(result.counts.pass, 1);
});

test('a passing test that changes its copied source is rejected by the recorded vectors', t => {
  const f = qaFixture(t, "import test from 'node:test';import fs from 'node:fs';test('mutating copy',()=>fs.writeFileSync(new URL('./app.mjs',import.meta.url),'changed'));\n");
  const result = runLocalQa(f.config);
  a.equal(result.counts.pass, 1); a.equal(result.ok, false); a.equal(result.sourceUnchanged, false);
  a.notEqual(result.vectors['copy-before.json'].sha256, result.vectors['copy-after.json'].sha256);
  a.equal(fs.readFileSync(path.join(f.candidate, 'candidate/app.mjs'), 'utf8'), 'export const value = 1;\n');
});

test('a passing test that reaches back to the original candidate also fails the original source vector', t => {
  const f = qaFixture(t, owner => "import test from 'node:test';import fs from 'node:fs';test('mutating original fixture',()=>fs.writeFileSync(" +
    JSON.stringify(path.join(owner.temp, 'composed/candidate/app.mjs')) + ",'changed'));\n");
  const result = runLocalQa(f.config);
  a.equal(result.counts.pass, 1); a.equal(result.ok, false); a.equal(result.sourceUnchanged, false);
  a.notEqual(result.vectors['source-before.json'].sha256, result.vectors['source-after.json'].sha256);
  a.equal(result.vectors['copy-before.json'].sha256, result.vectors['copy-after.json'].sha256);
});

function recoveredFixture() {
  const files = new Map(), put = (name, value) => files.set(name, R.encode(value));
  const tap = Buffer.from('# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');
  files.set('qa/tests.tap', tap);
  put('qa/result.json', { ok: true, exitCode: 0, sourceUnchanged: true, manifestSha256: 'a'.repeat(64), logSha256: R.sha(tap), counts: { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 } });
  const metadata = ['candidate-validation.json', 'operator-input.json', 'operator-input-with-prior-arm.json', 'deployment/candidate-pin.json'];
  for (const name of metadata) put(name, { before: name });
  const pins = () => [...files].map(([name, raw]) => ({ name, sha256: R.sha(raw), bytes: raw.length }));
  let original = { outputs: pins() }, originalRearmRaw = R.encode({ previous: true });
  const changes = metadata.map(name => { const before = R.sha(files.get(name)); put(name, { after: name }); return { path: name, before, after: R.sha(files.get(name)) }; });
  function bind() {
    const originalRaw = R.encode(original);
    const currentRaw = R.encode({ outputs: pins().filter(row => !['deployment/operator-preparation.json', 'rearm/source-successor.json'].includes(row.name)) });
    files.set('deployment/operator-preparation.json', currentRaw);
    put('rearm/source-successor.json', { current: true });
    const allChanges = [...changes, { path: 'deployment/operator-preparation.json', before: R.sha(originalRaw), after: R.sha(currentRaw) },
      { path: 'rearm/source-successor.json', before: R.sha(originalRearmRaw), after: R.sha(files.get('rearm/source-successor.json')) }];
    return { originalRaw, originalRearmRaw, changes: allChanges, readyRaw: R.encode({ status: 'passed-local', manifest: 'a'.repeat(64), preparationSha256: R.sha(currentRaw) }) };
  }
  return { files, bind, setOriginal: value => { original = value; }, original, verify: input => verifyPreparedOutputs(input, name => files.get(name)) };
}

test('recovered preparation binds both document hash pairs and original QA pins', () => {
  const f = recoveredFixture(), result = f.verify(f.bind());
  a.equal(result.documentPairs, 2); a.equal(result.originalQaAndTapPinsPresent, true); a.equal(result.metadataRewritten, false);
});

test('recovered preparation rejects missing, duplicate and unknown change declarations', () => {
  for (const mode of ['missing', 'duplicate', 'unknown']) {
    const f = recoveredFixture(), input = f.bind();
    if (mode === 'missing') input.changes.pop();
    if (mode === 'duplicate') input.changes.push(input.changes[0]);
    if (mode === 'unknown') input.changes[0].path = 'unknown.json';
    a.throws(() => f.verify(input));
  }
});

test('recovered preparation rejects either broken document hash pair and a mismatched ready pin', () => {
  for (const name of ['deployment/operator-preparation.json', 'rearm/source-successor.json']) for (const key of ['before', 'after']) {
    const f = recoveredFixture(), input = f.bind(); input.changes.find(r => r.path === name)[key] = 'f'.repeat(64);
    a.throws(() => f.verify(input));
  }
  const f = recoveredFixture(), input = f.bind(); input.readyRaw = R.encode({ status: 'passed-local', preparationSha256: 'f'.repeat(64) });
  a.throws(() => f.verify(input), /READY_PREPARATION_HASH/);
});

test('recovered preparation rejects current output duplicates, unknown rows and wrong pins even if current document is re-hashed', () => {
  for (const mode of ['duplicate', 'unknown', 'pin']) {
    const f = recoveredFixture(), input = f.bind(), current = JSON.parse(f.files.get('deployment/operator-preparation.json'));
    if (mode === 'duplicate') current.outputs.push(current.outputs[0]);
    if (mode === 'unknown') current.outputs[0].name = 'unknown.txt';
    if (mode === 'pin') current.outputs[0].sha256 = 'f'.repeat(64);
    const raw = R.encode(current); f.files.set('deployment/operator-preparation.json', raw);
    input.changes.find(r => r.path === 'deployment/operator-preparation.json').after = R.sha(raw);
    input.readyRaw = R.encode({ status: 'passed-local', preparationSha256: R.sha(raw) });
    a.throws(() => f.verify(input));
  }
});

test('recovered preparation rejects metadata absent from original outputs and either absent QA pin', () => {
  for (const name of ['candidate-validation.json', 'qa/result.json', 'qa/tests.tap']) {
    const f = recoveredFixture(); f.setOriginal({ outputs: f.original.outputs.filter(row => row.name !== name) });
    a.throws(() => f.verify(f.bind()), name.startsWith('qa/') ? /QA_NOT_IN_ORIGINAL_OUTPUTS/ : /METADATA_OUTSIDE_ORIGINAL_OUTPUTS/);
  }
});
