'use strict';
// HA 쉬기(무장 없이 완료) 보존본 — closed-release.cjs preserveRest / verify의 경계 시험(2026-11-14, 사슬 65 준비, P1-R1 고침 뒤).
// 요약만으로는 봉인되지 않는다: 감시기 plan 증거 · 감시기 정지 기록 원본을 핀으로 받아 보존 · 재검증하고, 마지막 무장 쌍은 기존 검증기로 실제 폴더를 다시 읽는다.
// 마지막 무장 쌍은 기존 승인 봉인 시험과 같은 합성 부모(완료 보존본 + 합성 승인 모듈)로 실제 preserve · seal을 거쳐 만든다. 실제 .tmp · 운영 값은 쓰지 않는다.
const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require('../tools/company-release/closed-release.cjs');
const S = require('../tools/company-release/sealed-approval.cjs');
const { compose } = require('../tools/company-release/compose.cjs');

const H = c => c.repeat(64);
const OWNER = '1111111111111111111';
const putIn = root => (name, raw) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw); return R.record(name, raw); };
const result = n => ({ exit: 0, counts: { tests: n, pass: n, fail: 0, cancelled: 0, skipped: 0 } });

// 실제 무장 완료 보존본 + 승인 봉인(합성 부모 판 — tests/company-release-sealed-approval.test.cjs와 같은 꼴).
function armedPair(temp) {
  const root = path.join(temp, 'armed-release'), put = putIn(root);
  const app = Buffer.from('export const value = 0;\n'), spec = Buffer.from("import test from 'node:test'; test('x',()=>{});\n");
  const rows = [R.record('app.mjs', app), R.record('app.test.mjs', spec)]; put('candidate/app.mjs', app); put('candidate/app.test.mjs', spec);
  const grand = H('9'), manifestRaw = R.encode({ version: 1, kind: 'pulse-independent-web-pwa', parentManifestSHA256: grand, files: rows }), release = R.sha(manifestRaw);
  const approvalRaw = R.encode({ schema: 'synthetic-rearm-inputs/v1', candidateManifest: { sha256: release } });
  const receipt = { schema: 'synk-ha-reviewed-candidate/v1', manifestSha256: release, parentManifestSha256: grand, imageId: 'sha256:' + H('c'), linuxPassed: true, sourceFiles: 2, runtimeHashFiles: 2, productionDataMounted: false, productionServiceActions: 0, tests: { production: result(1), compat: result(2) } };
  const receiptRaw = R.encode(receipt), runtime = { 'node-agent.mjs': H('4') }, plan = { armed: false, release: { manifestSha256: release } };
  const deploymentContract = { id: '1'.repeat(32), mode: 'company-release-only', oldReleaseSha256: grand, newReleaseSha256: release };
  const now = Date.UTC(2026, 10, 13), chain = [
    { id: 'a'.repeat(32), mode: 'company-release-only', completedAt: now - 90000, oldReleaseSha256: H('8'), newReleaseSha256: grand, contractSha256: H('1'), packageSha256: H('2'), postcheckSha256: H('3') },
    { id: deploymentContract.id, mode: 'company-release-only', completedAt: now - 10000, oldReleaseSha256: grand, newReleaseSha256: release, contractSha256: S.shaValue(deploymentContract), packageSha256: H('5'), postcheckSha256: H('6') }];
  const a0 = { contract: deploymentContract, plan, runtime, releaseSha256: release, candidateReceipt: receipt, actualDeploymentAt: new Date(now - 10000).toISOString(),
    evidence: { packageSha256: H('5'), runtimeProofSha256: H('6'), inputSha256: R.sha(approvalRaw), candidateReceiptSha256: R.sha(receiptRaw) },
    deploymentChain: chain, priorArm: { requestId: '585d5697-e8d2-44ab-bfc1-432b0cbcd3f0', contractSha256: H('7'), postcheckSha256: H('b'), armedAt: now - 50000, releaseSha256: grand, sourceHashes: runtime },
    history: { returnOperation: { id: 'return' }, returnHistory: [{ phase: 'complete' }], lastRearm: { id: 'rearm' } }, runtimeTransition: { before: { 'node-agent.mjs': H('3') }, after: runtime } };
  const armed = { requestId: 'request', expected: { sourceHashes: runtime, history: { lastCompletedOperation: a0.history.returnOperation, lastCompletedHistory: a0.history.returnHistory, lastRearm: a0.history.lastRearm } }, nextPlan: { ...plan, armed: true }, history: a0.history, runtimeTransition: a0.runtimeTransition, priorArm: a0.priorArm, deploymentChain: chain, deployment: { ...a0.evidence, id: deploymentContract.id, contractSha256: S.shaValue(deploymentContract) } };
  const contractRaw = R.encode(armed), check = { status: 'passed', armed: true, releaseSha256: release };
  const pins = {
    manifest: put('candidate/release-manifest.json', manifestRaw), images: put('images.json', R.encode(rows)),
    selection: put('selection.json', R.encode({ manifestSha256: release, productionTests: 1, tests: ['app.test.mjs'] })),
    receipt: put('receipt.json', receiptRaw), approval: put('rearm/approval-input-v1.json', approvalRaw), contract: put('rearm/contract-final-v1.json', contractRaw),
    postcheck: put('rearm/arm-postcheck-final-v1.json', R.encode({ ...check, contractSha256: R.sha(contractRaw), requestId: 'request', readOnlySnapshot: { collectionTiming: { localAfter: 42 } } })),
    validator: put('rearm/postcheck.cjs', Buffer.from('module.exports={validate(){return ' + JSON.stringify(check) + ';}};\n')) };
  const completed = path.join(temp, 'company-completed-armed'), kept = R.preserve({ root, pins, output: completed });
  const moduleFile = path.join(root, 'rearm', 'approval.cjs');
  fs.writeFileSync(moduleFile, "const fs=require('node:fs'),crypto=require('node:crypto');const RESULT=" + JSON.stringify(a0) + ";module.exports={async loadApproval(file){const r=JSON.parse(JSON.stringify(RESULT));r.evidence.inputSha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');return r;}};\n");
  const approvalOut = path.join(temp, 'company-approval-armed');
  const sealed = S.seal({ completed, completedSealSha256: kept.sealSha256, module: { path: moduleFile, sha256: R.sha(fs.readFileSync(moduleFile)) }, output: approvalOut });
  return { release, ref: { completed: { root: completed, sealSha256: kept.sealSha256 }, approval: { root: approvalOut, sealSha256: sealed.sealSha256 } } };
}

// HA 쉬기 판(부모 = parentRelease) — 감시기 plan 증거 · 감시기 정지 기록 원본은 ha-rest65.cjs가 쓰는 꼴 그대로.
function restRelease(temp, name, { parentRelease, armed, mutate = {}, value = 1 }) {
  const root = path.join(temp, name), put = putIn(root);
  const sources = [{ path: 'app.mjs', raw: Buffer.from('export const value = ' + value + ';\n') }, { path: 'app.test.mjs', raw: Buffer.from("import test from 'node:test'; import assert from 'node:assert/strict'; import {value} from './app.mjs'; test('v',()=>assert.ok(value>0));\n") }];
  const rows = sources.map(({ path: n, raw }) => { put('candidate/' + n, raw); return R.record(n, raw); }).sort((x, y) => x.path.localeCompare(y.path, 'en'));
  const manifestRaw = R.encode({ version: 1, kind: 'pulse-independent-web-pwa', parentManifestSHA256: parentRelease, files: rows }), manifestSha256 = R.sha(manifestRaw);
  const receipt = { schema: 'synk-ha-reviewed-candidate/v1', manifestSha256, parentManifestSha256: parentRelease, imageId: 'sha256:' + H('c'), linuxPassed: true, sourceFiles: rows.length, runtimeHashFiles: rows.length, productionDataMounted: false, productionServiceActions: 0, tests: { production: result(1), compat: result(2) } };
  const run = { schema: 'synk-pulse-runtime-verification/v1', status: 'passed', productionMutationCalls: 0, oldReleaseSha256: parentRelease, newReleaseSha256: manifestSha256, failures: [], hosts: { controller: { status: 'passed', checks: { armed: false, newPlanLoaded: true } } }, ...(mutate.run || {}) };
  const pub = { manifest: manifestSha256, status: 'passed', files: 3, matched: 3, health: { status: 200, ready: true }, realSessionsCreated: 0, socialPostsCreated: 0 };
  const disarm = { schema: 'synk-ha-rest-disarm-proof/v1', at: '2026-11-14T03:00:00.000Z', release: manifestSha256, armed: false, planRelease: manifestSha256, liveArmed: false, loadedPlanProven: true, serviceActive: true, planSha256: H('a'), control: { generation: '1', sha256: H('b'), activeId: OWNER, activeEpoch: 7 }, status: 'disarmed-verified' };
  if (mutate.disarm) mutate.disarm(disarm);
  const disarmRaw = R.encode(disarm), checks = Object.fromEntries(['releasePinned', 'primaryVmIdentity', 'primaryNatIsPin', 'staticAddressBound', 'lbAbsent', 'dnsOnPrimaryEverywhere', 'directHealthReady', 'directRoot200', 'publicHealthReady', 'nodeIdentity', 'nodeRelease', 'nodeCurrentIsRelease', 'nodePlanDisarmedSameRelease', 'containersExact', 'containersRunning', 'companyContainerHealthy', 'controlIdle'].map(k => [k, true]));
  const stop = { schema: 'synk-ha-rest65/v1', at: '2026-11-14T03:05:00.000Z', mode: 'controller-stop', run: true, remoteWrites: 1,
    disarm: { file: 'C:/x/disarm-proof.json', sha256: R.sha(disarmRaw), verdict: { ok: true, failed: [] } },
    before: { status: 'RUNNING' },
    preflight: { readings: { release: manifestSha256, vm: { natIp: '10.0.0.1', status: 'RUNNING' }, lb: { fr: null, bs: null, hc: null, addr: null },
      dns: { servers: { a: ['10.0.0.1'], b: ['10.0.0.1'] } }, direct: { health: { status: 200, ready: true }, root: { status: 200 } }, public: { status: 200, ready: true },
      node: { nodeId: OWNER, releaseSha256: manifestSha256, manifestSha256, releaseRoot: '/opt/synk/releases/x', current: '/opt/synk/releases/x', planArmed: false, planRelease: manifestSha256, inspectRc: 0, containers: [{ name: 'c', imageMatches: true, running: true, paused: false, restarting: false, dead: false, health: 'healthy' }] },
      control: { generation: '1', value: { activeId: OWNER, activeEpoch: 7, maintenanceUntil: 0, operation: null, deployment: null, runner: null, api: null, command: null } } },
      verdict: { ok: true, checks, failed: [] } },
    after: 'TERMINATED', watch: { samples: 280, bad: 0, missingKinds: [], badRows: [], last: { kind: 'public', ok: true } }, status: 'controller-stopped-primary-serving' };
  if (mutate.stop) mutate.stop(stop);
  const stopRaw = R.encode(stop), runRaw = R.encode(run), pubRaw = R.encode(pub);
  const rest = { schema: 'synk-company-ha-rest-completion/v1', release: manifestSha256, parentRelease, armedBefore: false, armedAfter: false,
    runtimePostcheckSha256: R.sha(runRaw), publicVerificationSha256: R.sha(pubRaw),
    disarmProofAfter: { sha256: R.sha(disarmRaw), status: disarm.status, armed: disarm.armed, liveArmed: disarm.liveArmed, loadedPlanProven: disarm.loadedPlanProven, planRelease: disarm.planRelease },
    controllerStop: { sha256: R.sha(stopRaw), status: stop.status, after: stop.after, watchBad: stop.watch.bad },
    lastArmed: { completedSealSha256: armed.ref.completed.sealSha256, approvalSealSha256: armed.ref.approval.sealSha256, release: armed.release },
    userDecision: 'HA 쉬기 A안(11-13 「일단 a안으로 할게」) — 교체 뒤 재무장 없음' };
  if (mutate.rest) mutate.rest(rest);
  const pins = { manifest: put('candidate/release-manifest.json', manifestRaw), images: put('images.json', R.encode(rows)),
    selection: put('selection.json', R.encode({ manifestSha256, productionTests: 1, tests: ['app.test.mjs'] })), receipt: put('receipt.json', R.encode(receipt)),
    runtimePostcheck: put('runtime.json', runRaw), publicVerification: put('public.json', pubRaw), disarmProof: put('ha-rest/disarm-proof-after.json', disarmRaw),
    controllerStop: put('ha-rest/controller-stop.json', stopRaw), haRest: put('ha-rest/completion-v1.json', R.encode(rest)) };
  return { root, put, pins, manifestSha256 };
}
function fixture(t, mutate = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-rest-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const armed = armedPair(temp), r = restRelease(temp, 'release', { parentRelease: armed.release, armed, mutate });
  const config = { root: r.root, pins: r.pins, output: path.join(temp, 'closed-rest'), lastArmed: armed.ref };
  return { temp, armed, ...r, config, preserve: () => R.preserveRest(config) };
}
const refused = (t, mutate, code) => { const f = fixture(t, mutate); a.throws(f.preserve, code); a.equal(fs.existsSync(f.config.output), false); };

test('an HA-rest completed release seals with its raw evidence, survives removal of its working folder and re-verifies the last armed pair', t => {
  const f = fixture(t), saved = f.preserve();
  a.equal(saved.armed, false); a.equal(saved.haMode, 'rest'); a.equal(saved.parentRest, null);
  fs.renameSync(f.root, path.join(f.temp, 'removed-original'));
  const v = R.verify(saved.output, saved.sealSha256);
  a.equal(v.manifestSha256, f.manifestSha256); a.equal(v.seal.schema, R.REST_SCHEMA); a.equal(v.seal.armed, false);
  a.equal(v.seal.lastArmed.release, f.armed.release); a.equal(v.seal.lastArmed.completed.sealSha256, f.armed.ref.completed.sealSha256); a.equal(v.seal.lastArmed.chainLength, 2);
  for (const k of ['disarmProof', 'controllerStop']) a.ok(fs.existsSync(path.join(saved.output, 'evidence', k + '.json')), 'raw evidence kept ' + k);
  a.throws(() => R.verify(saved.output, H('0')), /RELEASE_INPUT_SHA/);
});

test('P1-R1 regression: the old summary-only input (seven keys, arbitrary sha256 summaries, no raw files) is refused', t => {
  const f = fixture(t), pins = { ...f.pins }; delete pins.disarmProof; delete pins.controllerStop;
  a.throws(() => R.preserveRest({ ...f.config, pins }), /HA_REST_EVIDENCE_KEYS/); a.equal(fs.existsSync(f.config.output), false);
  refused(t, { rest: r => { r.disarmProofAfter.sha256 = H('d'); } }, /HA_REST_DISARM_SUMMARY_NOT_THE_RAW_FILE/);
  refused(t, { rest: r => { r.controllerStop.sha256 = H('e'); } }, /HA_REST_STOP_SUMMARY_NOT_THE_RAW_FILE/);
  refused(t, { rest: r => { r.controllerStop.watchBad = 0; r.controllerStop.status = 'controller-stopped-primary-serving'; } , stop: s => { s.watch.bad = 3; } }, /HA_REST_STOP_WATCH/);
});

test('the raw controller-stop record must show a real stop of this release with a clean pre-stop observation and watch', t => {
  refused(t, { stop: s => { s.status = 'controller-stopped-WATCH-FAILED'; } }, /HA_REST_STOP_RAW_STATUS/);
  refused(t, { stop: s => { s.after = 'RUNNING'; } }, /HA_REST_STOP_RAW_NOT_TERMINATED/);
  refused(t, { stop: s => { s.run = false; } }, /HA_REST_STOP_RAW_NOT_RUN/);
  refused(t, { stop: s => { s.watch.samples = 0; } }, /HA_REST_STOP_WATCH/);
  refused(t, { stop: s => { s.watch.missingKinds = ['dns']; } }, /HA_REST_STOP_WATCH/);
  refused(t, { stop: s => { s.preflight.readings.release = H('f'); } }, /HA_REST_STOP_PREFLIGHT_RELEASE/);
  refused(t, { stop: s => { s.preflight.readings.node.releaseSha256 = H('f'); } }, /HA_REST_STOP_NODE/);
  refused(t, { stop: s => { s.preflight.readings.node.nodeId = '2222'; } }, /HA_REST_STOP_NODE/);
  refused(t, { stop: s => { s.preflight.readings.node.containers[0].running = false; } }, /HA_REST_STOP_CONTAINERS/);
  refused(t, { stop: s => { s.preflight.readings.control.value.operation = { id: 'x' }; } }, /HA_REST_STOP_CONTROL/);
  refused(t, { stop: s => { s.preflight.readings.dns.servers.b = ['10.0.0.9']; } }, /HA_REST_STOP_DNS/);
  refused(t, { stop: s => { s.preflight.readings.direct.health.ready = false; } }, /HA_REST_STOP_DIRECT/);
  refused(t, { stop: s => { s.preflight.readings.lb.bs = { name: 'x' }; } }, /HA_REST_STOP_LB/);
  refused(t, { stop: s => { delete s.preflight.verdict.checks.controlIdle; } }, /HA_REST_STOP_PREFLIGHT_VERDICT/);
  refused(t, { stop: s => { s.disarm.sha256 = H('7'); } }, /HA_REST_STOP_USED_ANOTHER_DISARM_PROOF/);
  refused(t, { stop: s => { s.at = '2026-11-14T02:00:00.000Z'; } }, /HA_REST_STOP_BEFORE_PROOF/);
});

test('the raw controller-plan proof must be disarmed on this release', t => {
  refused(t, { disarm: d => { d.planRelease = H('b'); } }, /HA_REST_DISARM_RAW_RELEASE/);
  refused(t, { disarm: d => { d.loadedPlanProven = false; } }, /HA_REST_DISARM_RAW_STATE/);
  refused(t, { disarm: d => { d.liveArmed = true; } }, /HA_REST_ARMED_VALUE|HA_REST_DISARM_RAW_STATE/);
  refused(t, { disarm: d => { d.status = 'NOT-DISARMED'; } }, /HA_REST_DISARM_RAW_STATUS/);
});

test('armed:true anywhere in the record or raw files is refused', t => {
  for (const edit of [r => { r.armedAfter = true; }, r => { r.armedBefore = true; }, r => { r.extra = { nested: { armed: true } }; }]) refused(t, { rest: edit }, /HA_REST_ARMED/);
  refused(t, { stop: s => { s.preflight.readings.node.planArmed = true; } }, /HA_REST_ARMED_VALUE|HA_REST_STOP_NODE/);
});

test('the last armed pair is the real pair, re-verified with the existing verifiers; a rest seal posing as the armed pair is refused without recursion', t => {
  const f = fixture(t);
  a.throws(() => R.preserveRest({ ...f.config, lastArmed: undefined }), /HA_REST_LAST_ARMED_REFERENCE_REQUIRED/);
  a.throws(() => R.preserveRest({ ...f.config, lastArmed: { ...f.armed.ref, approval: { ...f.armed.ref.approval, sealSha256: H('2') } } }), /HA_REST_LAST_ARMED_RECORD_MISMATCH/);
  refused(t, { rest: r => { r.lastArmed.completedSealSha256 = H('1'); } }, /HA_REST_LAST_ARMED_RECORD_MISMATCH/);
  // Tampering a sealed armed evidence file breaks the existing verifier.
  const g = fixture(t), ev = path.join(g.armed.ref.completed.root, 'evidence', 'postcheck.json'); fs.chmodSync(ev, 0o600); fs.appendFileSync(ev, ' ');
  a.throws(g.preserve, /RELEASE_INPUT/); a.equal(fs.existsSync(g.config.output), false);
  // A valid rest seal offered as the "last armed" pair: refused by schema before any verify call.
  const h = fixture(t), first = h.preserve();
  const second = restRelease(h.temp, 'release-2', { parentRelease: h.manifestSha256, armed: { ...h.armed, release: first.manifest, ref: { completed: { root: first.output, sealSha256: first.sealSha256 }, approval: h.armed.ref.approval } }, value: 2 });
  a.throws(() => R.preserveRest({ root: second.root, pins: second.pins, output: path.join(h.temp, 'closed-2'), lastArmed: { completed: { root: first.output, sealSha256: first.sealSha256 }, approval: h.armed.ref.approval } }), /HA_REST_LAST_ARMED_IS_NOT_AN_ARMED_SEAL/);
  // The parent must be the armed release itself unless a verified rest parent naming the same pair is given.
  const lost = restRelease(h.temp, 'release-3', { parentRelease: h.manifestSha256, armed: h.armed, value: 3 });
  a.throws(() => R.preserveRest({ root: lost.root, pins: lost.pins, output: path.join(h.temp, 'closed-3'), lastArmed: h.armed.ref }), /HA_REST_PARENT_REST_REFERENCE_REQUIRED/);
  const next = R.preserveRest({ root: lost.root, pins: lost.pins, output: path.join(h.temp, 'closed-3b'), lastArmed: h.armed.ref, parentRest: { root: first.output, sealSha256: first.sealSha256 } });
  a.equal(next.parentRest.release, h.manifestSha256); a.equal(R.verify(next.output, next.sealSha256).seal.parentRest.sealSha256, first.sealSha256);
});

test('compose accepts an HA-rest seal as the next parent unchanged', t => {
  const f = fixture(t), saved = f.preserve();
  const carryDir = path.join(f.temp, 'carry'); fs.mkdirSync(path.join(carryDir, 'files'), { recursive: true });
  const raw = Buffer.from('export const value = 2;\n'); fs.writeFileSync(path.join(carryDir, 'files', 'app.mjs'), raw);
  const before = R.verify(saved.output, saved.sealSha256).source.get('app.mjs').sha256;
  const carryRaw = R.encode({ parentManifestSha256: f.manifestSha256, files: [{ path: 'app.mjs', beforeSha256: before, sha256: R.sha(raw), bytes: raw.length }], retiredTests: [], adoptedTests: [] });
  fs.writeFileSync(path.join(carryDir, 'carry.json'), carryRaw);
  const out = compose({ parent: saved.output, sealSha256: saved.sealSha256, carryFile: path.join(carryDir, 'carry.json'), carrySha256: R.sha(carryRaw), output: path.join(f.temp, 'next') });
  a.equal(out.deltaFiles, 1); a.equal(out.sourceFiles, 2);
});

test('runtime and public evidence must be for this release and passed', t => {
  refused(t, { run: { newReleaseSha256: H('f') } }, /HA_REST_RUNTIME_RELEASE/);
  refused(t, { run: { hosts: { controller: { status: 'passed', checks: { armed: true } } } } }, /HA_REST_RUNTIME_CONTROLLER_ARMED|HA_REST_ARMED/);
  refused(t, { run: { status: 'failed' } }, /HA_REST_RUNTIME_NOT_PASSED/);
  refused(t, { rest: r => { r.runtimePostcheckSha256 = H('9'); } }, /HA_REST_RUNTIME_PIN/);
});

test('rest pins cannot be sealed as armed, a rest seal edited to claim armed:true no longer verifies, and the approval seal refuses it', t => {
  const f = fixture(t);
  a.throws(() => R.preserve({ root: f.root, pins: { ...f.pins, validator: f.put('v.cjs', Buffer.from('module.exports={validate(){return {}}};\n')) }, output: f.config.output }));
  a.equal(fs.existsSync(f.config.output), false);
  const saved = f.preserve(), file = path.join(saved.output, 'completed-release.json');
  const mod = path.join(f.temp, 'approval.cjs'); fs.writeFileSync(mod, 'module.exports={};\n');
  a.throws(() => S.seal({ completed: saved.output, completedSealSha256: saved.sealSha256, module: { path: mod, sha256: R.sha(fs.readFileSync(mod)) }, output: path.join(f.temp, 'approval') }), /HA_REST_RELEASE_HAS_NO_APPROVAL_RESULT/);
  const seal = JSON.parse(fs.readFileSync(file)); seal.armed = true; const raw = R.encode(seal); fs.chmodSync(file, 0o600); fs.writeFileSync(file, raw);
  a.throws(() => R.verify(saved.output, R.sha(raw)), /HA_REST_SEAL_ARMED/);
});

test('tampered raw evidence in the sealed folder or an extra file stops verify', t => {
  const f = fixture(t), saved = f.preserve(), stopFile = path.join(saved.output, 'evidence', 'controllerStop.json');
  fs.chmodSync(stopFile, 0o600); fs.appendFileSync(stopFile, ' ');
  a.throws(() => R.verify(saved.output, saved.sealSha256), /RELEASE_INPUT_SHA/);
  const g = fixture(t), saved2 = g.preserve(); fs.writeFileSync(path.join(saved2.output, 'evidence', 'extra.json'), '{}');
  a.throws(() => R.verify(saved2.output, saved2.sealSha256), /RELEASE_SOURCE_CLOSURE/);
});
