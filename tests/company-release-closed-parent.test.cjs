'use strict';
const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require('../tools/company-release/closed-release.cjs');
const { compose } = require('../tools/company-release/compose.cjs');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cr-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'release'); fs.mkdirSync(root);
  const put = (name, raw) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw); return R.record(name, raw); };
  const sources = [{ path: 'app.mjs', raw: Buffer.from('export const value = 1;\n') }, { path: 'app.test.mjs', raw: Buffer.from('export {};\n') }];
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
