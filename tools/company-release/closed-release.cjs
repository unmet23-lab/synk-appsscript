'use strict';
// Local release preservation. This module never deploys or issues an approval.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const a = require('node:assert/strict');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function name(value) {
  a.ok(typeof value === 'string' && value.length > 0 && !/[\\:\x00-\x1f<>"|?*]/.test(value), 'UNSAFE_RELEASE_PATH');
  a.ok(!path.posix.isAbsolute(value) && path.posix.normalize(value) === value, 'UNSAFE_RELEASE_PATH');
  a.ok(value.split('/').every(part => part && part !== '.' && part !== '..'), 'UNSAFE_RELEASE_PATH');
  return value;
}
function read(file, expected) {
  file = path.resolve(file);
  for (let cursor = file;; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor);
    a.equal(stat.isSymbolicLink(), false, 'LINK_RELEASE_INPUT');
    if (cursor === file) a.ok(stat.isFile() && stat.nlink === 1, 'REGULAR_RELEASE_INPUT');
    if (path.dirname(cursor) === cursor) break;
  }
  const before = fs.statSync(file), raw = fs.readFileSync(file), after = fs.statSync(file);
  a.deepEqual([after.ino, after.size, after.mtimeMs, after.ctimeMs], [before.ino, before.size, before.mtimeMs, before.ctimeMs], 'RELEASE_INPUT_CHANGED');
  if (expected) {
    a.equal(sha(raw), expected.sha256, 'RELEASE_INPUT_SHA ' + file);
    if (expected.bytes !== undefined) a.equal(raw.length, expected.bytes, 'RELEASE_INPUT_BYTES');
  }
  return raw;
}
function record(file, raw) { return { path: file, sha256: sha(raw), bytes: raw.length }; }
function rows(values) {
  a.ok(Array.isArray(values) && values.length > 0, 'RELEASE_ROWS_REQUIRED');
  const result = new Map();
  for (const row of values) {
    name(row.path); a.match(row.sha256 || '', /^[a-f0-9]{64}$/);
    a.ok(Number.isSafeInteger(row.bytes) && row.bytes >= 0);
    a.equal(result.has(row.path), false, 'DUPLICATE_RELEASE_ROW');
    result.set(row.path, row);
  }
  return result;
}
function exactDirectory(root, names) {
  const actual = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      a.equal(entry.isSymbolicLink(), false, 'LINK_RELEASE_INPUT');
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else { a.ok(entry.isFile()); actual.push(path.relative(root, full).split(path.sep).join('/')); }
    }
  }
  walk(root); a.deepEqual(actual.sort(), [...names].sort(), 'RELEASE_SOURCE_CLOSURE');
}
function validateDocuments(documents, validatePostcheck) {
  const { manifest, images, selection, receipt, approval, contract, postcheck } = documents;
  const manifestSha = sha(documents.manifestRaw), source = rows(manifest.files), image = rows(images);
  a.equal(manifest.version, 1); a.equal(manifest.kind, 'pulse-independent-web-pwa');
  a.equal(receipt.schema, 'synk-ha-reviewed-candidate/v1');
  a.equal(receipt.synthetic, undefined); a.equal(receipt.linuxPassed, true);
  a.equal(receipt.manifestSha256, manifestSha);
  a.equal(receipt.parentManifestSha256, manifest.parentManifestSHA256);
  a.match(receipt.imageId || '', /^sha256:[a-f0-9]{64}$/);
  a.equal(receipt.sourceFiles, source.size); a.equal(receipt.runtimeHashFiles, image.size);
  a.equal(receipt.productionDataMounted, false); a.equal(receipt.productionServiceActions, 0);
  for (const row of image.values()) a.deepEqual(row, source.get(row.path), 'IMAGE_OUTSIDE_SOURCE');
  a.equal(selection.manifestSha256, manifestSha);
  a.ok(Array.isArray(selection.tests) && selection.tests.length > 0);
  a.equal(new Set(selection.tests).size, selection.tests.length);
  for (const test of selection.tests) { name(test); a.ok(source.has(test) && /\.test\.[cm]?js$/.test(test)); }
  const production = receipt.tests.production, compat = receipt.tests.compat;
  for (const result of [production, compat]) {
    a.equal(result.exit, 0); a.ok(Number.isSafeInteger(result.counts.tests) && result.counts.tests > 0);
    a.equal(result.counts.pass, result.counts.tests);
    for (const key of ['fail', 'cancelled', 'skipped']) a.equal(result.counts[key], 0);
  }
  a.equal(selection.productionTests, production.counts.tests);
  a.equal(contract.deployment.inputSha256, sha(documents.approvalRaw));
  a.equal(contract.deployment.candidateReceiptSha256, sha(documents.receiptRaw), 'ARMED_RECEIPT_CHANGED');
  a.equal(contract.nextPlan.armed, true); a.equal(contract.nextPlan.release.manifestSha256, manifestSha);
  a.equal(postcheck.status, 'passed'); a.equal(postcheck.armed, true);
  a.equal(postcheck.releaseSha256, manifestSha); a.equal(postcheck.contractSha256, sha(documents.contractRaw));
  a.equal(postcheck.requestId, contract.requestId);
  a.equal(approval.candidateManifest.sha256, manifestSha);
  const checked = validatePostcheck(contract, structuredClone(postcheck.readOnlySnapshot), postcheck.readOnlySnapshot.collectionTiming.localAfter);
  a.ok(checked && typeof checked === 'object' && typeof checked.then !== 'function');
  a.equal(checked.status, 'passed'); a.equal(checked.armed, true); a.equal(checked.releaseSha256, manifestSha);
  for (const [key, value] of Object.entries(checked)) a.deepEqual(postcheck[key], value, 'POSTCHECK_REVALIDATION ' + key);
  return { manifestSha256: manifestSha, source, image, tests: selection.tests, productionTests: production.counts.tests, imageId: receipt.imageId };
}
function inspect(root, pins, validator) {
  const raw = {}, documents = {}, used = [];
  for (const [key, pin] of Object.entries(pins)) {
    name(pin.path); raw[key] = read(path.join(root, pin.path), pin); used.push(record(pin.path, raw[key]));
    if (key !== 'validator') { documents[key] = JSON.parse(raw[key]); documents[key + 'Raw'] = raw[key]; }
  }
  a.ok(raw.validator && typeof validator === 'function', 'PINNED_POSTCHECK_VALIDATOR_REQUIRED');
  const result = validateDocuments(documents, validator);
  for (const row of result.source.values()) read(path.join(root, 'candidate', row.path), row);
  exactDirectory(path.join(root, 'candidate'), [...result.source.keys(), 'release-manifest.json']);
  for (const [key, pin] of Object.entries(pins)) read(path.join(root, pin.path), pin);
  return { ...result, used, documents };
}
function writeNew(root, files) {
  a.equal(fs.existsSync(root), false, 'NEW_RELEASE_DIRECTORY_REQUIRED');
  fs.mkdirSync(root); // The parent must already exist; do not create an accidental path tree.
  for (const [relative, raw] of files) {
    name(relative); const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw, { flag: 'wx', mode: 0o600 });
  }
}
function preserve({ root, pins, output }) {
  a.ok(path.isAbsolute(root) && path.isAbsolute(output));
  const validatorFile = path.join(root, name(pins.validator.path));
  read(validatorFile, pins.validator);
  const result = inspect(root, pins, require(validatorFile).validate);
  const files = new Map();
  for (const [key, pin] of Object.entries(pins)) files.set(key === 'manifest' ? 'candidate/release-manifest.json' : 'evidence/' + key + (key === 'validator' ? '.cjs' : '.json'), read(path.join(root, pin.path), pin));
  for (const row of result.source.values()) files.set('candidate/' + row.path, read(path.join(root, 'candidate', row.path), row));
  const evidence = Object.fromEntries(Object.entries(pins).map(([key, pin]) => [key, { ...pin, path: key === 'manifest' ? 'candidate/release-manifest.json' : 'evidence/' + key + (key === 'validator' ? '.cjs' : '.json') }]));
  const seal = { schema: 'synk-completed-company-release/v1', manifestSha256: result.manifestSha256, imageId: result.imageId, sourceFiles: result.source.size, imageFiles: result.image.size, selectedTests: result.tests.length, productionTests: result.productionTests, evidence, historicalRevalidation: true, currentLiveStateVerified: false, deploymentAuthorized: false };
  files.set('completed-release.json', encode(seal));
  inspect(root, pins, require(validatorFile).validate);
  writeNew(output, files);
  verify(output, sha(encode(seal)));
  return { manifest: result.manifestSha256, sealSha256: sha(encode(seal)), output, files: files.size, historicalRevalidation: true, currentLiveStateVerified: false };
}
function verify(root, sealSha256) {
  a.match(sealSha256 || '', /^[a-f0-9]{64}$/, 'EXPLICIT_SEAL_PIN_REQUIRED');
  const sealRaw = read(path.join(root, 'completed-release.json'), { sha256: sealSha256 }), seal = JSON.parse(sealRaw);
  a.equal(seal.schema, 'synk-completed-company-release/v1');
  const validatorFile = path.join(root, name(seal.evidence.validator.path)); read(validatorFile, seal.evidence.validator);
  const checked = inspect(root, seal.evidence, require(validatorFile).validate);
  a.deepEqual([checked.manifestSha256, checked.imageId, checked.source.size, checked.image.size, checked.tests.length, checked.productionTests], [seal.manifestSha256, seal.imageId, seal.sourceFiles, seal.imageFiles, seal.selectedTests, seal.productionTests]);
  return { ...checked, seal, sealSha256 };
}
module.exports = { sha, encode, name, read, record, rows, exactDirectory, validateDocuments, inspect, writeNew, preserve, verify };
if (require.main === module) {
  try {
    const [mode, input, expected] = process.argv.slice(2);
    if (mode === 'preserve') console.log(JSON.stringify(preserve(JSON.parse(read(input)))));
    else if (mode === 'verify') { const r = verify(path.resolve(input), expected); console.log(JSON.stringify({ status: 'completed-release-verified', manifest: r.manifestSha256, sourceFiles: r.source.size, remoteCalls: 0, currentLiveStateVerified: false })); }
    else throw Error('Use preserve <pinned-input.json> or verify <folder> <seal-sha256>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
