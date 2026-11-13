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
// Candidate part shared by the armed seal and the HA-rest seal (manifest · image payload · selection · reviewed Linux receipt).
function validateCandidate(documents) {
  const { manifest, images, selection, receipt } = documents;
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
  return { manifestSha256: manifestSha, source, image, tests: selection.tests, productionTests: production.counts.tests, imageId: receipt.imageId };
}
function validateDocuments(documents, validatePostcheck) {
  const { approval, contract, postcheck } = documents;
  const candidate = validateCandidate(documents), manifestSha = candidate.manifestSha256;
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
  return candidate;
}
// ---- HA rest mode (user-chosen A안, 2026-11-13): a release deployed while the HA controller plan stays disarmed and is not rearmed.
// It has no arm contract, arm postcheck or approval result. Its evidence is the deploy's runtime verification, the public verification, the raw
// controller-plan proof taken on the new release (disarmProof), the raw controller-stop record with its pre-stop serving observation and watch
// summary (controllerStop), and an HA-rest completion record that must agree with those raw bytes. The last armed seal pair is not a summary:
// it is read and re-verified with the existing verifiers (verify on the armed completed seal · sealed-approval verify) at seal time and at every verify.
// This is a different seal schema on purpose: an armed seal can never be produced from these pins, and a rest seal never carries armed:true.
// P1-R1 (GPT tool review 11-14): summaries alone (arbitrary sha256 + status words) are refused — every summary field is compared with the pinned raw file.
const REST_SCHEMA = 'synk-completed-company-release-ha-rest/v1', REST_RECORD = 'synk-company-ha-rest-completion/v1', ARMED_SCHEMA = 'synk-completed-company-release/v1';
const REST_KEYS = ['manifest', 'images', 'selection', 'receipt', 'runtimePostcheck', 'publicVerification', 'disarmProof', 'controllerStop', 'haRest'];
const STOP_CHECKS = ['releasePinned', 'primaryVmIdentity', 'primaryNatIsPin', 'staticAddressBound', 'lbAbsent', 'dnsOnPrimaryEverywhere', 'directHealthReady', 'directRoot200', 'publicHealthReady', 'nodeIdentity', 'nodeRelease', 'nodeCurrentIsRelease', 'nodePlanDisarmedSameRelease', 'containersExact', 'containersRunning', 'companyContainerHealthy', 'controlIdle'];
const hex64 = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function noArmedTrue(value, at) {
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (/armed/i.test(k) && !/disarmed/i.test(k) && (v === null || typeof v !== 'object')) a.equal(v, false, 'HA_REST_ARMED_VALUE ' + at + '.' + k);
    noArmedTrue(v, at + '.' + k);
  }
}
// Raw controller-plan proof (ha-rest65 disarm-proof) and raw controller-stop record (ha-rest65 controller-stop --실행): the observations themselves.
function validateRestRaw(manifestSha, documents) {
  const d = documents.disarmProof, s = documents.controllerStop, dRaw = documents.disarmProofRaw;
  a.equal(d.schema, 'synk-ha-rest-disarm-proof/v1', 'HA_REST_DISARM_RAW_SCHEMA'); a.equal(d.status, 'disarmed-verified', 'HA_REST_DISARM_RAW_STATUS');
  a.ok(d.armed === false && d.liveArmed === false && d.loadedPlanProven === true, 'HA_REST_DISARM_RAW_STATE');
  a.ok(d.planRelease === manifestSha && d.release === manifestSha, 'HA_REST_DISARM_RAW_RELEASE');
  const owner = d.control && d.control.activeId; a.ok(typeof owner === 'string' && owner.length > 0, 'HA_REST_DISARM_RAW_OWNER');
  a.equal(s.schema, 'synk-ha-rest65/v1', 'HA_REST_STOP_RAW_SCHEMA'); a.equal(s.mode, 'controller-stop', 'HA_REST_STOP_RAW_MODE'); a.equal(s.run, true, 'HA_REST_STOP_RAW_NOT_RUN');
  a.equal(s.status, 'controller-stopped-primary-serving', 'HA_REST_STOP_RAW_STATUS'); a.equal(s.after, 'TERMINATED', 'HA_REST_STOP_RAW_NOT_TERMINATED');
  a.ok(s.disarm && s.disarm.sha256 === sha(dRaw) && s.disarm.verdict && s.disarm.verdict.ok === true, 'HA_REST_STOP_USED_ANOTHER_DISARM_PROOF');
  a.ok(Date.parse(s.at) >= Date.parse(d.at), 'HA_REST_STOP_BEFORE_PROOF');
  const v = s.preflight && s.preflight.verdict, r = s.preflight && s.preflight.readings;
  a.ok(v && v.ok === true && Array.isArray(v.failed) && v.failed.length === 0 && STOP_CHECKS.every(k => v.checks && v.checks[k] === true), 'HA_REST_STOP_PREFLIGHT_VERDICT');
  a.ok(r && r.release === manifestSha, 'HA_REST_STOP_PREFLIGHT_RELEASE');
  const node = r.node || {};
  a.ok(node.nodeId === owner && node.releaseSha256 === manifestSha && node.manifestSha256 === manifestSha && node.planArmed === false && node.planRelease === manifestSha, 'HA_REST_STOP_NODE');
  a.ok(typeof node.releaseRoot === 'string' && node.current === node.releaseRoot, 'HA_REST_STOP_NODE_CURRENT');
  a.ok(Array.isArray(node.containers) && node.containers.length > 0 && node.containers.every(c => c.running === true && c.imageMatches === true && c.paused === false && c.restarting === false && c.dead === false && (c.health === null || c.health === 'healthy')), 'HA_REST_STOP_CONTAINERS');
  const ctl = r.control && r.control.value;
  a.ok(ctl && ctl.activeId === owner && ctl.maintenanceUntil === 0 && ['operation', 'deployment', 'runner', 'api', 'command'].every(k => ctl[k] == null), 'HA_REST_STOP_CONTROL');
  const ip = r.vm && r.vm.natIp, servers = r.dns && r.dns.servers;
  a.ok(typeof ip === 'string' && servers && Object.keys(servers).length > 0 && Object.values(servers).every(x => Array.isArray(x) && x.length === 1 && x[0] === ip), 'HA_REST_STOP_DNS');
  a.ok(r.direct && r.direct.health && r.direct.health.status === 200 && r.direct.health.ready === true && r.direct.root && r.direct.root.status === 200, 'HA_REST_STOP_DIRECT');
  a.ok(r.lb && ['fr', 'bs', 'hc', 'addr'].every(k => k in r.lb && r.lb[k] === null), 'HA_REST_STOP_LB');
  const w = s.watch || {};
  a.ok(Number.isSafeInteger(w.samples) && w.samples > 0 && w.bad === 0 && Array.isArray(w.missingKinds) && w.missingKinds.length === 0 && w.last && w.last.ok === true, 'HA_REST_STOP_WATCH');
  return { owner };
}
function validateRestDocuments(documents) {
  const { receipt, runtimePostcheck: run, publicVerification: pub, haRest: rest } = documents;
  const candidate = validateCandidate(documents), manifestSha = candidate.manifestSha256;
  a.equal(run.schema, 'synk-pulse-runtime-verification/v1', 'HA_REST_RUNTIME_SCHEMA'); a.equal(run.status, 'passed', 'HA_REST_RUNTIME_NOT_PASSED');
  a.equal(run.productionMutationCalls, 0, 'HA_REST_RUNTIME_MUTATIONS'); a.ok(Array.isArray(run.failures) && run.failures.length === 0, 'HA_REST_RUNTIME_FAILURES');
  a.equal(run.newReleaseSha256, manifestSha, 'HA_REST_RUNTIME_RELEASE'); a.equal(run.oldReleaseSha256, receipt.parentManifestSha256, 'HA_REST_RUNTIME_PARENT');
  a.equal(run.hosts?.controller?.status, 'passed', 'HA_REST_RUNTIME_CONTROLLER'); a.equal(run.hosts.controller.checks?.armed, false, 'HA_REST_RUNTIME_CONTROLLER_ARMED');
  a.equal(pub.status, 'passed', 'HA_REST_PUBLIC_NOT_PASSED'); a.equal(pub.manifest, manifestSha, 'HA_REST_PUBLIC_RELEASE');
  a.ok(Number.isSafeInteger(pub.files) && pub.files > 0 && pub.matched === pub.files, 'HA_REST_PUBLIC_MATCH');
  a.ok(pub.health?.status === 200 && pub.health.ready === true, 'HA_REST_PUBLIC_HEALTH');
  a.ok(pub.realSessionsCreated === 0 && pub.socialPostsCreated === 0, 'HA_REST_PUBLIC_SIDE_EFFECTS');
  a.equal(rest.schema, REST_RECORD, 'HA_REST_RECORD_SCHEMA'); noArmedTrue(rest, '$');
  noArmedTrue(documents.disarmProof, '$disarmProof'); noArmedTrue(documents.controllerStop, '$controllerStop');
  a.equal(rest.release, manifestSha, 'HA_REST_RECORD_RELEASE'); a.equal(rest.parentRelease, receipt.parentManifestSha256, 'HA_REST_RECORD_PARENT');
  a.equal(rest.armedBefore, false, 'HA_REST_ARMED_BEFORE'); a.equal(rest.armedAfter, false, 'HA_REST_ARMED_AFTER');
  a.equal(rest.runtimePostcheckSha256, sha(documents.runtimePostcheckRaw), 'HA_REST_RUNTIME_PIN'); a.equal(rest.publicVerificationSha256, sha(documents.publicVerificationRaw), 'HA_REST_PUBLIC_PIN');
  validateRestRaw(manifestSha, documents);
  const raw = documents.disarmProof, stop = documents.controllerStop, d = rest.disarmProofAfter || {}, c = rest.controllerStop || {};
  // The record's summaries are the raw bytes' own values (P1-R1: a summary without its raw file, or disagreeing with it, is refused).
  a.equal(d.sha256, sha(documents.disarmProofRaw), 'HA_REST_DISARM_SUMMARY_NOT_THE_RAW_FILE');
  for (const k of ['status', 'armed', 'liveArmed', 'loadedPlanProven', 'planRelease']) a.deepEqual(d[k], raw[k], 'HA_REST_DISARM_SUMMARY ' + k);
  a.equal(c.sha256, sha(documents.controllerStopRaw), 'HA_REST_STOP_SUMMARY_NOT_THE_RAW_FILE');
  a.ok(c.status === stop.status && c.after === stop.after && c.watchBad === stop.watch.bad, 'HA_REST_STOP_SUMMARY');
  const l = rest.lastArmed || {};
  a.ok(hex64(l.completedSealSha256) && hex64(l.approvalSealSha256) && hex64(l.release) && l.release !== manifestSha, 'HA_REST_LAST_ARMED');
  a.ok(typeof rest.userDecision === 'string' && rest.userDecision.trim().length >= 10, 'HA_REST_USER_DECISION');
  return { ...candidate, parentRelease: receipt.parentManifestSha256, lastArmed: { completedSealSha256: l.completedSealSha256, approvalSealSha256: l.approvalSealSha256, release: l.release } };
}
// The last armed seal pair, read and re-verified with the existing verifiers. An HA-rest seal offered as the "last armed" pair is refused here before any
// verify call (no recursion through rest seals); the armed verify path never reads a rest seal, so this cannot loop.
function verifyLastArmed(ref, expected) {
  a.ok(ref && ref.completed && ref.approval && path.isAbsolute(ref.completed.root || '') && path.isAbsolute(ref.approval.root || '') && hex64(ref.completed.sealSha256) && hex64(ref.approval.sealSha256), 'HA_REST_LAST_ARMED_REFERENCE_REQUIRED');
  a.ok(ref.completed.sealSha256 === expected.completedSealSha256 && ref.approval.sealSha256 === expected.approvalSealSha256, 'HA_REST_LAST_ARMED_RECORD_MISMATCH');
  const head = JSON.parse(read(path.join(ref.completed.root, 'completed-release.json'), { sha256: ref.completed.sealSha256 }));
  a.equal(head.schema, ARMED_SCHEMA, 'HA_REST_LAST_ARMED_IS_NOT_AN_ARMED_SEAL');
  const completed = verify(ref.completed.root, ref.completed.sealSha256);
  a.equal(completed.manifestSha256, expected.release, 'HA_REST_LAST_ARMED_RELEASE');
  const approval = require('./sealed-approval.cjs').verify(ref.approval.root, ref.approval.sealSha256, { completed: ref.completed.root, completedSealSha256: ref.completed.sealSha256 });
  a.equal(approval.seal.release, expected.release, 'HA_REST_LAST_ARMED_APPROVAL_RELEASE');
  return { completed: { folder: path.basename(ref.completed.root), root: path.resolve(ref.completed.root), sealSha256: ref.completed.sealSha256 }, approval: { folder: path.basename(ref.approval.root), root: path.resolve(ref.approval.root), sealSha256: ref.approval.sealSha256 }, release: expected.release, chainLength: approval.seal.chainLength };
}
// The parent must be the last armed release, or an HA-rest release (verified as such) that names the same last armed pair. Depth is bounded.
function verifyRestParent(result, parentRest, depth) {
  if (result.parentRelease === result.lastArmed.release) { a.equal(parentRest, undefined, 'HA_REST_PARENT_IS_ARMED_NO_REST_PARENT'); return null; }
  a.ok(depth < 64, 'HA_REST_PARENT_CHAIN_TOO_DEEP');
  a.ok(parentRest && path.isAbsolute(parentRest.root || '') && hex64(parentRest.sealSha256), 'HA_REST_PARENT_REST_REFERENCE_REQUIRED');
  const head = JSON.parse(read(path.join(parentRest.root, 'completed-release.json'), { sha256: parentRest.sealSha256 }));
  a.equal(head.schema, REST_SCHEMA, 'HA_REST_PARENT_IS_NOT_A_REST_SEAL');
  const parent = verify(parentRest.root, parentRest.sealSha256, depth + 1);
  a.equal(parent.manifestSha256, result.parentRelease, 'HA_REST_PARENT_RELEASE');
  a.ok(parent.seal.lastArmed.completed.sealSha256 === result.lastArmed.completedSealSha256 && parent.seal.lastArmed.approval.sealSha256 === result.lastArmed.approvalSealSha256 && parent.seal.lastArmed.release === result.lastArmed.release, 'HA_REST_PARENT_LAST_ARMED_DIFFERS');
  return { folder: path.basename(parentRest.root), root: path.resolve(parentRest.root), sealSha256: parentRest.sealSha256, release: parent.manifestSha256 };
}
function inspectRest(root, pins) {
  a.deepEqual(Object.keys(pins).sort(), [...REST_KEYS].sort(), 'HA_REST_EVIDENCE_KEYS');
  const documents = {}, used = [];
  for (const [key, pin] of Object.entries(pins)) {
    name(pin.path); const raw = read(path.join(root, pin.path), pin); used.push(record(pin.path, raw));
    documents[key] = JSON.parse(raw); documents[key + 'Raw'] = raw;
  }
  const result = validateRestDocuments(documents);
  for (const row of result.source.values()) read(path.join(root, 'candidate', row.path), row);
  exactDirectory(path.join(root, 'candidate'), [...result.source.keys(), 'release-manifest.json']);
  for (const [key, pin] of Object.entries(pins)) read(path.join(root, pin.path), pin);
  return { ...result, used, documents };
}
const restEvidencePath = key => key === 'manifest' ? 'candidate/release-manifest.json' : 'evidence/' + key + '.json';
// input: {root, pins (REST_KEYS), output, lastArmed:{completed:{root,sealSha256}, approval:{root,sealSha256}}, parentRest?:{root,sealSha256}}
function preserveRest({ root, pins, output, lastArmed, parentRest }) {
  a.ok(path.isAbsolute(root) && path.isAbsolute(output));
  const result = inspectRest(root, pins), files = new Map();
  const armedPair = verifyLastArmed(lastArmed, result.lastArmed), parent = verifyRestParent(result, parentRest, 0);
  for (const [key, pin] of Object.entries(pins)) files.set(restEvidencePath(key), read(path.join(root, pin.path), pin));
  for (const row of result.source.values()) files.set('candidate/' + row.path, read(path.join(root, 'candidate', row.path), row));
  const evidence = Object.fromEntries(Object.entries(pins).map(([key, pin]) => [key, { ...pin, path: restEvidencePath(key) }]));
  const seal = { schema: REST_SCHEMA, haMode: 'rest', armed: false, manifestSha256: result.manifestSha256, imageId: result.imageId, sourceFiles: result.source.size, imageFiles: result.image.size, selectedTests: result.tests.length, productionTests: result.productionTests, lastArmed: armedPair, parentRest: parent, evidence, historicalRevalidation: true, currentLiveStateVerified: false, deploymentAuthorized: false };
  files.set('completed-release.json', encode(seal));
  inspectRest(root, pins);
  writeNew(output, files, stage => verify(stage, sha(encode(seal))));
  return { manifest: result.manifestSha256, sealSha256: sha(encode(seal)), output, files: files.size, haMode: 'rest', armed: false, lastArmed: armedPair, parentRest: parent, historicalRevalidation: true, currentLiveStateVerified: false };
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
function writeNew(root, files, validate = () => {}) {
  a.ok(path.isAbsolute(root), 'ABSOLUTE_OUTPUT_REQUIRED');
  a.equal(fs.existsSync(root), false, 'NEW_RELEASE_DIRECTORY_REQUIRED');
  const parent = path.dirname(root);
  for (let cursor = parent;; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor);
    a.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'REGULAR_OUTPUT_PARENT_REQUIRED');
    if (path.dirname(cursor) === cursor) break;
  }
  const planned = new Map();
  for (const [relative, raw] of files) {
    name(relative); a.ok(Buffer.isBuffer(raw), 'OUTPUT_BYTES_REQUIRED');
    planned.set(relative, Buffer.from(raw));
  }
  // A failed build stays quarantined; the requested destination never becomes a partial release.
  const stage = fs.mkdtempSync(path.join(parent, '.' + path.basename(root) + '.preparing-'));
  for (const [relative, raw] of planned) {
    const file = path.join(stage, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw, { flag: 'wx', mode: 0o600 });
  }
  validate(stage);
  for (const [relative, raw] of planned) read(path.join(stage, relative), record(relative, raw));
  exactDirectory(stage, planned.keys());
  a.equal(fs.existsSync(root), false, 'NEW_RELEASE_DIRECTORY_REQUIRED');
  fs.renameSync(stage, root);
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
  writeNew(output, files, stage => verify(stage, sha(encode(seal))));
  return { manifest: result.manifestSha256, sealSha256: sha(encode(seal)), output, files: files.size, historicalRevalidation: true, currentLiveStateVerified: false };
}
function verify(root, sealSha256, depth = 0) {
  a.match(sealSha256 || '', /^[a-f0-9]{64}$/, 'EXPLICIT_SEAL_PIN_REQUIRED');
  const sealRaw = read(path.join(root, 'completed-release.json'), { sha256: sealSha256 }), seal = JSON.parse(sealRaw);
  if (seal.schema === REST_SCHEMA) {
    a.equal(seal.haMode, 'rest', 'HA_REST_SEAL_MODE'); a.equal(seal.armed, false, 'HA_REST_SEAL_ARMED');
    for (const [key, pin] of Object.entries(seal.evidence)) a.equal(pin.path, restEvidencePath(key), 'HA_REST_SEAL_EVIDENCE_PATH ' + key);
    const checked = inspectRest(root, seal.evidence);
    a.deepEqual([checked.manifestSha256, checked.imageId, checked.source.size, checked.image.size, checked.tests.length, checked.productionTests], [seal.manifestSha256, seal.imageId, seal.sourceFiles, seal.imageFiles, seal.selectedTests, seal.productionTests]);
    const ref = seal.lastArmed || {};
    a.ok(ref.completed && ref.approval, 'HA_REST_SEAL_LAST_ARMED_REFERENCE');
    a.deepEqual({ completedSealSha256: ref.completed.sealSha256, approvalSealSha256: ref.approval.sealSha256, release: ref.release }, checked.lastArmed, 'HA_REST_SEAL_LAST_ARMED');
    a.deepEqual(verifyLastArmed({ completed: ref.completed, approval: ref.approval }, checked.lastArmed), ref, 'HA_REST_SEAL_LAST_ARMED_REVERIFIED');
    a.deepEqual(verifyRestParent(checked, seal.parentRest ? { root: seal.parentRest.root, sealSha256: seal.parentRest.sealSha256 } : undefined, depth), seal.parentRest, 'HA_REST_SEAL_PARENT');
    exactDirectory(root, ['completed-release.json', ...Object.values(seal.evidence).map(pin => pin.path), ...[...checked.source.keys()].map(n => 'candidate/' + n)]);
    return { ...checked, seal, sealSha256 };
  }
  a.equal(seal.schema, 'synk-completed-company-release/v1');
  const validatorFile = path.join(root, name(seal.evidence.validator.path)); read(validatorFile, seal.evidence.validator);
  const checked = inspect(root, seal.evidence, require(validatorFile).validate);
  a.deepEqual([checked.manifestSha256, checked.imageId, checked.source.size, checked.image.size, checked.tests.length, checked.productionTests], [seal.manifestSha256, seal.imageId, seal.sourceFiles, seal.imageFiles, seal.selectedTests, seal.productionTests]);
  return { ...checked, seal, sealSha256 };
}
module.exports = { sha, encode, name, read, record, rows, exactDirectory, validateCandidate, validateDocuments, inspect, writeNew, preserve, verify, REST_SCHEMA, REST_RECORD, validateRestDocuments, validateRestRaw, verifyLastArmed, inspectRest, preserveRest, REST_KEYS };
if (require.main === module) {
  try {
    const [mode, input, expected] = process.argv.slice(2);
    if (mode === 'preserve') console.log(JSON.stringify(preserve(JSON.parse(read(input)))));
    else if (mode === 'preserve-rest') console.log(JSON.stringify(preserveRest(JSON.parse(read(input)))));
    else if (mode === 'verify') { const r = verify(path.resolve(input), expected); console.log(JSON.stringify({ status: 'completed-release-verified', manifest: r.manifestSha256, sourceFiles: r.source.size, remoteCalls: 0, currentLiveStateVerified: false })); }
    else throw Error('Use preserve <pinned-input.json>, preserve-rest <pinned-input.json> or verify <folder> <seal-sha256>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
