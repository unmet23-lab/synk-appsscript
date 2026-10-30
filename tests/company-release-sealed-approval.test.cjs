'use strict';
// 봉인된 부모 승인 결과 — 합성 완료 보존본과 합성 「옛 설계」 부모 모듈로 봉인 → 확인 → 자식이 믿기, 그리고 바꿔치기·꼴 깨짐이 막히는지 본다.
// 실제 .tmp·운영 값(인스턴스 ID·manifest)은 쓰지 않는다.
const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require('../tools/company-release/closed-release.cjs');
const S = require('../tools/company-release/sealed-approval.cjs');
const P = require('../tools/company-release/trusted-parent-port.cjs');

const H = c => c.repeat(64);
// 합성 부모 판 P: 완료 보존본 하나와, 그 보존본의 승인 입력을 읽어 결과를 내는 승인 모듈.
function fixture(t, { result: change } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sealed-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const tmp = path.join(temp, '.tmp'), root = path.join(tmp, 'p-release-20261030'); fs.mkdirSync(root, { recursive: true });
  const put = (name, raw) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw); return R.record(name, raw); };
  const app = Buffer.from('export const value = 1;\n'), spec = Buffer.from("import test from 'node:test'; test('x',()=>{});\n");
  const rows = [R.record('app.mjs', app), R.record('app.test.mjs', spec)]; put('candidate/app.mjs', app); put('candidate/app.test.mjs', spec);
  const grand = H('9'), manifest = { version: 1, kind: 'pulse-independent-web-pwa', parentManifestSHA256: grand, files: rows };
  const manifestRaw = R.encode(manifest), release = R.sha(manifestRaw);
  const evidenceFile = path.join(tmp, 'old-evidence-20261020', 'owner.json'); fs.mkdirSync(path.dirname(evidenceFile), { recursive: true }); fs.writeFileSync(evidenceFile, '{"owner":true}');
  const evidencePin = { path: evidenceFile, sha256: R.sha(fs.readFileSync(evidenceFile)) };
  const approvalRaw = R.encode({ schema: 'synthetic-rearm-inputs/v1', candidateManifest: { sha256: release }, historical: evidencePin });
  const result = count => ({ exit: 0, counts: { tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 } });
  const receipt = { schema: 'synk-ha-reviewed-candidate/v1', manifestSha256: release, parentManifestSha256: grand, imageId: 'sha256:' + H('c'), linuxPassed: true, sourceFiles: 2, runtimeHashFiles: 2, productionDataMounted: false, productionServiceActions: 0, tests: { production: result(1), compat: result(2) } };
  const receiptRaw = R.encode(receipt);
  const runtime = { 'node-agent.mjs': H('4') }, plan = { armed: false, release: { manifestSha256: release } };
  const deploymentContract = { id: '1'.repeat(32), mode: 'company-release-only', oldReleaseSha256: grand, newReleaseSha256: release };
  const now = Date.UTC(2026, 9, 30), priorArmedAt = now - 50000;
  const chain = [
    { id: 'a'.repeat(32), mode: 'company-release-only', completedAt: now - 90000, oldReleaseSha256: H('8'), newReleaseSha256: grand, contractSha256: H('1'), packageSha256: H('2'), postcheckSha256: H('3') },
    { id: deploymentContract.id, mode: 'company-release-only', completedAt: now - 10000, oldReleaseSha256: grand, newReleaseSha256: release, contractSha256: S.shaValue(deploymentContract), packageSha256: H('5'), postcheckSha256: H('6') },
  ];
  // 부모 결과 a — 부모 loadApproval이 내는 꼴(필요한 칸만).
  const a0 = {
    contract: deploymentContract, plan, runtime, releaseSha256: release, candidateReceipt: receipt, actualDeploymentAt: new Date(now - 10000).toISOString(),
    evidence: { packageSha256: H('5'), runtimeProofSha256: H('6'), inputSha256: R.sha(approvalRaw), candidateReceiptSha256: R.sha(receiptRaw) },
    deploymentChain: chain, priorArm: { requestId: '585d5697-e8d2-44ab-bfc1-432b0cbcd3f0', contractSha256: H('7'), postcheckSha256: H('b'), armedAt: priorArmedAt, releaseSha256: grand, sourceHashes: runtime },
    history: { returnOperation: { id: 'return' }, returnHistory: [{ phase: 'complete' }], lastRearm: { id: 'rearm' } }, runtimeTransition: { before: { 'node-agent.mjs': H('3') }, after: runtime },
    inputPins: { historical: evidencePin },
  };
  // 부모 무장 계약 — 그 판 core.prepare처럼 a에서 옮겨 적은 칸들(deployment·history·runtimeTransition·priorArm·expected).
  const armed = { requestId: 'request', expected: { sourceHashes: runtime, history: { lastCompletedOperation: a0.history.returnOperation, lastCompletedHistory: a0.history.returnHistory, lastRearm: a0.history.lastRearm } }, nextPlan: { ...plan, armed: true }, history: a0.history, runtimeTransition: a0.runtimeTransition, priorArm: a0.priorArm, deploymentChain: chain, deployment: { ...a0.evidence, id: deploymentContract.id, contractSha256: S.shaValue(deploymentContract) }, acceptance: { evidence: [evidencePin] } };
  const contractRaw = R.encode(armed), check = { status: 'passed', armed: true, releaseSha256: release };
  const post = { ...check, contractSha256: R.sha(contractRaw), requestId: 'request', readOnlySnapshot: { collectionTiming: { localAfter: 42 }, acceptance: armed.acceptance } };
  const pins = {
    manifest: put('candidate/release-manifest.json', manifestRaw), images: put('images.json', R.encode(rows)),
    selection: put('selection.json', R.encode({ manifestSha256: release, productionTests: 1, tests: ['app.test.mjs'] })),
    receipt: put('receipt.json', receiptRaw), approval: put('rearm/approval-input-v1.json', approvalRaw),
    contract: put('rearm/contract-final-v1.json', contractRaw), postcheck: put('rearm/arm-postcheck-final-v1.json', R.encode(post)),
    validator: put('rearm/postcheck.cjs', Buffer.from('module.exports={validate(){return ' + JSON.stringify(check) + ';}};\n')),
  };
  const completed = path.join(tmp, 'company-completed-p-20261030');
  const kept = R.preserve({ root, pins, output: completed });
  // 합성 옛 설계 부모 모듈: 승인 입력의 SHA를 결과 evidence에 적는다(실제 판처럼). change로 결과 꼴을 바꿔 막힘을 본다.
  const value = change ? change(structuredClone(a0)) : a0;
  const moduleFile = path.join(root, 'rearm', 'approval.cjs');
  fs.writeFileSync(moduleFile, [
    "const fs=require('node:fs'),crypto=require('node:crypto');",
    `const RESULT=${JSON.stringify(value)};`,
    'module.exports={async loadApproval(file){const raw=fs.readFileSync(file);const r=JSON.parse(JSON.stringify(RESULT));',
    "if(r.evidence)r.evidence.inputSha256=crypto.createHash('sha256').update(raw).digest('hex');",
    (change && change.extra) || '',
    'return r;}};',
  ].join('\n'));
  const mod = { path: moduleFile, sha256: R.sha(fs.readFileSync(moduleFile)) };
  const output = path.join(tmp, 'company-approval-p-20261030');
  const sealIt = () => S.seal({ completed, completedSealSha256: kept.sealSha256, module: mod, output });
  const parent = sealed => P.sealedParent({ completed: { root: completed, sealSha256: kept.sealSha256 }, approval: { root: output, sealSha256: sealed.sealSha256 }, release, previousRelease: grand, chainLength: 2 });
  return { temp, tmp, root, completed, kept, mod, output, sealIt, parent, release, grand, a0, evidenceFile, sealedInput: path.join(completed, 'evidence', 'approval.json') };
}

test('부모 결과를 봉인하면 자식은 부모 모듈 없이 같은 결과를 받는다 — 원래 판 폴더와 옛 증거 폴더가 없어도', t => {
  const f = fixture(t), sealed = f.sealIt();
  a.equal(sealed.status, 'approval-result-sealed'); a.equal(sealed.method, 'full-recursion'); a.equal(sealed.chainLength, 2);
  const PARENT = f.parent(sealed), pin = { path: f.sealedInput, sha256: R.sha(fs.readFileSync(f.sealedInput)) };
  fs.renameSync(f.root, f.root + '.gone'); fs.renameSync(path.dirname(f.evidenceFile), path.dirname(f.evidenceFile) + '.gone');
  const got = S.load(PARENT, pin);
  const expected = structuredClone(f.a0); expected.evidence.inputSha256 = pin.sha256;
  a.deepEqual(got, expected);
  a.notEqual(S.load(PARENT, pin), got, '부를 때마다 새 객체');
  a.equal(S.validator(PARENT).validate().status, 'passed', '봉인 보존본의 검증기');
  const h = S.history(PARENT);
  a.ok(h.has(S.key(f.evidenceFile, R.sha(Buffer.from('{"owner":true}')))), '봉인 계약·결과 속 핀이 봉인 역사에 든다');
  a.equal(JSON.parse(fs.readFileSync(path.join(f.output, 'approval-seal.json'))).currentLiveStateVerified, false);
});

test('봉인된 부모 설계 모듈로 봉인하면 믿은 부모(SEALED_PARENT)가 봉인에 남는다(GPT GB2)', t => {
  const f = fixture(t);
  fs.appendFileSync(f.mod.path, `\nmodule.exports.SEALED_PARENT=${JSON.stringify({ completed: { root: 'C:\\x', sealSha256: H('a') }, approval: { root: 'C:\\y', sealSha256: H('b') }, release: H('c') })};\n`);
  const mod = { path: f.mod.path, sha256: R.sha(fs.readFileSync(f.mod.path)) };
  const sealed = S.seal({ completed: f.completed, completedSealSha256: f.kept.sealSha256, module: mod, output: f.output });
  const doc = JSON.parse(fs.readFileSync(path.join(f.output, 'approval-seal.json')));
  a.equal(sealed.method, 'trusted-parent');
  a.deepEqual(doc.computedBy.trustedParent, { completedSealSha256: H('a'), approvalSealSha256: H('b'), release: H('c') });
});

test('봉인 결과 한 바이트 · 봉인 SHA · 다른 보존본 · 기대 사슬이 다르면 믿지 않는다', t => {
  const f = fixture(t), sealed = f.sealIt(), PARENT = f.parent(sealed), pin = { path: f.sealedInput, sha256: R.sha(fs.readFileSync(f.sealedInput)) };
  a.throws(() => S.load({ ...PARENT, approval: { ...PARENT.approval, sealSha256: H('0') } }, pin), /RELEASE_INPUT_SHA/);
  a.throws(() => S.load({ ...PARENT, completed: { ...PARENT.completed, sealSha256: H('0') } }, pin), /APPROVAL_SEAL_COMPLETED_PIN|RELEASE_INPUT_SHA/);
  a.throws(() => S.load({ ...PARENT, chainLength: 3 }, pin), /APPROVAL_SEAL_CHAIN_EXPECTATION/);
  a.throws(() => S.load({ ...PARENT, previousRelease: H('e') }, pin), /APPROVAL_SEAL_CHAIN_EXPECTATION/);
  a.throws(() => S.load(PARENT, { path: path.join(f.completed, 'evidence', 'contract.json'), sha256: pin.sha256 }), /PARENT_APPROVAL_PIN_IS_NOT_THE_SEALED_INPUT/);
  a.throws(() => S.load(PARENT, { ...pin, sha256: H('0') }), /PARENT_APPROVAL_PIN_IS_NOT_THE_SEALED_INPUT/);
  const file = path.join(f.output, 'approval-result.json'), raw = fs.readFileSync(file);
  fs.writeFileSync(file, Buffer.concat([raw.subarray(0, raw.length - 2), Buffer.from(' \n')]));
  a.throws(() => S.load(PARENT, pin), /RELEASE_INPUT_SHA/);
  fs.writeFileSync(file, raw); fs.writeFileSync(path.join(f.output, 'extra.json'), '{}');
  a.throws(() => S.load(PARENT, pin), /RELEASE_SOURCE_CLOSURE/, '봉인 폴더에 덧붙인 파일');
});

test('결과가 봉인 증거와 맞물리지 않으면 봉인하지 않는다 — 다른 입력·receipt·무장 사슬·계획·끝 줄', t => {
  const cases = [
    ['SEALED_RESULT_APPROVAL_INPUT', r => r, "r.evidence.inputSha256='0'.repeat(64);"],
    ['SEALED_RESULT_RECEIPT', r => { r.candidateReceipt.imageId = 'sha256:' + H('d'); return r; }],
    ['SEALED_RESULT_ARMED_CHAIN', r => { r.deploymentChain[0].packageSha256 = H('0'); return r; }],
    ['SEALED_RESULT_ARMED_PLAN', r => { r.plan.release.manifestSha256 = H('0'); return r; }],
    ['SEALED_RESULT_ARMED_DEPLOYMENT', r => { r.contract.newReleaseSha256 = H('0'); return r; }],
    ['SEALED_RESULT_ARMED_RUNTIME', r => { r.priorArm.releaseSha256 = H('e'); return r; }],
    ['SEALED_RESULT_ARMED_HISTORY', r => { r.history.lastRearm = { id: 'other' }; return r; }],
    ['SEALED_RESULT_ARMED_RUNTIME', r => { r.runtimeTransition.before = {}; return r; }],
    ['SEALED_RESULT_ARMED_DEPLOYMENT', r => { r.evidence.packageSha256 = H('0'); return r; }],
  ];
  for (const [code, change, extra] of cases) {
    change.extra = extra;
    const f = fixture(t, { result: change });
    a.throws(f.sealIt, new RegExp(code), code);
    a.equal(fs.existsSync(f.output), false, code + ' — 출력 폴더가 생기지 않는다');
  }
});

test('JSON으로 그대로 옮겨지지 않는 결과(undefined·Buffer 꼴·NaN)와 있는 출력 폴더는 거절한다', t => {
  for (const extra of ['r.extra=undefined;', "r.blob=Buffer.from('x');", 'r.n=NaN;', 'r.when=new Date(0);']) {
    const change = r => r; change.extra = extra;
    const f = fixture(t, { result: change });
    a.throws(f.sealIt, /APPROVAL_RESULT_COMPUTE_FAILED|APPROVAL_RESULT_NOT_PLAIN_JSON|APPROVAL_RESULT_ROUND_TRIP/, extra);
  }
  const f = fixture(t); f.sealIt();
  a.throws(f.sealIt, /NEW_RELEASE_DIRECTORY_REQUIRED/);
});

test('봉인 역사 경계: 옮긴 prepare-fresh의 안쪽 걷기는 H 핀을 잡지도 따라가지도 않고, 위에서 직접 잡는 핀은 그대로 잡는다', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-boundary-')); t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const w = (n, v) => { const p = path.join(temp, n); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v)); return { path: p, sha256: R.sha(fs.readFileSync(p)) }; };
  const old = w('old/owner.json', { old: 1 }), deep = w('old/deeper.json', { deeper: 1 }), fresh = w('now/fresh.json', { fresh: 1 });
  const baseline = w('now/baseline.json', { acceptance: { evidence: [old, fresh] }, chained: { path: deep.path, sha256: deep.sha256 } });
  // 실제 rearm-prepare-fresh.cjs의 앵커 세 줄을 가진 합성 원천(guards·graph 꼴만).
  const source = [
    "'use strict';", "const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');",
    "const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);",
    'function createHelper({root,dependencies}={}){',
    "  const rearm = path.join(root, 'rearm');",
    '  function guards() {',
    '    const pins = new Map(), documents = new Map(), visited = new Set();',
    '    function capture(ref){const raw=fs.readFileSync(ref.path);if(sha(raw)!==ref.sha256)throw Error("INPUT_PIN_CHANGED");pins.set(ref.path,ref.sha256);return {path:ref.path,value:JSON.parse(raw)};}',
    '    function graph(ref){const row=capture(ref);if(visited.has(row.path))return row;visited.add(row.path);',
    '      function walk(v) {',
    "        if (!v || typeof v !== 'object') return;",
    "        if (typeof v.path === 'string' && hash(v.sha256) && path.isAbsolute(v.path)) {",
    '          graph(v);',
    '        }',
    "        for (const x of Object.values(v)) if (x && typeof x === 'object') walk(x);",
    '      }',
    '      walk(row.value);return row;}',
    '    function check(){for(const [p,d] of pins)if(sha(fs.readFileSync(p))!==d)throw Error("INPUT_OR_SOURCE_CHANGED");}',
    '    function approvalPins(v){if(!v||typeof v!=="object")return;if(typeof v.path==="string"&&hash(v.sha256)){graph(v);return;}for(const x of Object.values(v))approvalPins(x);}',
    '    return {graph,capture,pins,check,approvalPins};',
    '  }',
    '  async function prepareApproval({approval,d}) {',
    '    const g = guards(), original = g.graph(approval);',
    '    const a = await d.loadApproval(original.path);',
    '    g.approvalPins(a.inputPins);',
    '    return g;',
    '  }',
    '  async function checkDr(e, a, initial, d) {',
    '    await d.verifyDr(e, a, initial);',
    "    return 'verified';",
    '  }',
    '  return {guards,prepareApproval,checkDr};',
    '}',
    'const need=(v,c)=>{if(!v)throw Error(c);};',
    "const CANONICAL_REVIEW_SHA = '" + H('5') + "';",
    'module.exports={createHelper,CANONICAL_REVIEW_SHA};', '',
  ].join('\n');
  const ported = P.portPrepareFresh(source, { prepareSha256: H('6') }), file = path.join(temp, 'ported.cjs'); fs.writeFileSync(file, ported);
  const { createHelper, CANONICAL_REVIEW_SHA } = require(file);
  a.equal(CANONICAL_REVIEW_SHA, H('6'), '옮긴 prepare.cjs SHA로 다시 맞춘다');
  const history = new Set([S.key(old.path, old.sha256), S.key(deep.path, deep.sha256)]);
  const g = createHelper({ root: temp, dependencies: { sealedHistory: () => history } }).guards();
  g.graph(baseline);
  a.deepEqual([...g.pins.keys()].sort(), [baseline.path, fresh.path].sort(), '역사 핀(old·deeper)은 안 잡고 새 핀(fresh)은 잡는다');
  const g2 = createHelper({ root: temp, dependencies: { sealedHistory: () => history } }).guards();
  g2.graph(old);
  a.deepEqual([...g2.pins.keys()], [old.path], '위에서 직접 잡는 역사 파일은 그대로 잡는다');
  // 같은 경로라도 SHA가 다르면 역사가 아니다 — 잡는다(그리고 바이트가 핀과 다르면 멈춘다).
  const changed = w('now/baseline2.json', { acceptance: { evidence: [{ path: old.path, sha256: H('0') }] } });
  const g4 = createHelper({ root: temp, dependencies: { sealedHistory: () => history } }).guards();
  a.throws(() => g4.graph(changed), /INPUT_PIN_CHANGED/, '역사와 SHA가 다른 같은 경로');
  const g3 = createHelper({ root: temp, dependencies: {} }).guards();
  g3.graph(baseline);
  a.equal(g3.pins.size, 4, '시험 주입에 역사가 없으면 옛 걷기 그대로');
  a.throws(() => P.portPrepareFresh(source.replace("  const rearm = path.join(root, 'rearm');\n", '')), /EXACT_PORT_ANCHOR/);
  a.throws(() => P.portPrepareFresh(source + source), /EXACT_PORT_ANCHOR/);
  a.throws(() => P.portPrepareFresh(source.replace('    g.approvalPins(a.inputPins);\n', '')), /EXACT_PORT_ANCHOR/);
  // DR 묶음(Fable P2-2): 주간 연습 묶음은 그대로, 격리 복원(비연습) 묶음은 이 판 폴더 안의 것만 verifyDr로 간다.
  const helper = createHelper({ root: temp, dependencies: {} }), d = { verifyDr: async () => {} };
  const dr = (dir, schema) => ({ drProof: { value: { schema } }, drContext: { path: path.join(dir, 'context-long-v1.json') } });
  // 닻 핀(Fable P2-5 ① · GPT GA1): 부모 결과 뒤 두 봉인·결과 파일이 핀이 되고, 계약을 쓰기 전 check()가 바뀐 닻을 거절한다.
  const anchor = w('sealed/approval-seal.json', { seal: 1 }), input = w('now/approval-input.json', { schema: 'x' });
  return (async () => {
    const g5 = await createHelper({ root: temp, dependencies: { sealedHistory: () => history, sealedAnchors: () => [anchor] } })
      .prepareApproval({ approval: input, d: { loadApproval: async () => ({ inputPins: { kept: fresh } }) } });
    a.ok(g5.pins.has(anchor.path) && g5.pins.has(fresh.path), '부모 결과 뒤 닻 파일과 맨 위 inputPins를 핀으로 잡는다');
    g5.check();
    fs.writeFileSync(anchor.path, JSON.stringify({ seal: 2 }));
    a.throws(() => g5.check(), /INPUT_OR_SOURCE_CHANGED/, '계약을 쓰기 전 바뀐 닻을 거절한다');
    a.equal(await helper.checkDr(dr(path.join(temp, '..', 'other-release', 'rearm', 'dr-drill', 'run'), 'synk-company-restore-drill/v1'), {}, {}, d), 'verified', '연습 묶음은 어디 있든 그대로');
    a.equal(await helper.checkDr(dr(path.join(temp, 'rearm', 'dr'), 'synk-pulse-restore/v1'), {}, {}, d), 'verified', '이 판 rearm/dr의 격리 복원 묶음');
    await a.rejects(helper.checkDr(dr(path.join(temp, '..', 'old-release', 'rearm', 'dr'), 'synk-pulse-restore/v1'), {}, {}, d), /SEALED_PARENT_DR_BUNDLE_OUTSIDE_RELEASE/, '다른 판의 격리 복원 묶음');
    a.throws(() => P.portPrepareFresh(source.replace('    await d.verifyDr(e, a, initial);\n', '')), /EXACT_PORT_ANCHOR/);
  })();
});

test('봉인 닻 파일 셋은 부모 결과 뒤 TOCTOU 핀이 된다 — 두 봉인과 결과 파일', async t => {
  const f = fixture(t), sealed = f.sealIt(), PARENT = f.parent(sealed);
  const anchors = S.anchors(PARENT);
  a.deepEqual(anchors.map(x => path.basename(x.path)), ['completed-release.json', 'approval-seal.json', 'approval-result.json']);
  for (const x of anchors) a.equal(R.sha(fs.readFileSync(x.path)), x.sha256);
  a.throws(() => S.anchors({ ...PARENT, approval: { ...PARENT.approval, sealSha256: H('0') } }), /RELEASE_INPUT_SHA/);
});

test('prepare.cjs 옮기기: REQUIRED_QA에 새 셋만 — verifyDr 본문은 그대로(판 시험이 본문을 떼어 평가한다)', () => {
  const verifyDr = "async function verifyDr(e,a,input){const bundle=path.dirname(e.drContext.path),adapterFile=path.join(bundle,'adapter.cjs');return adapterFile;}";
  const src = ["const path=require('node:path');", "const REQUIRED_QA=['approval.cjs','dr/session-proof-contract.cjs'];", verifyDr, 'module.exports={REQUIRED_QA,verifyDr};', ''].join('\n');
  const s = P.portPrepare(src);
  a.ok(s.includes("'dr/session-proof-contract.cjs','approval-base.cjs','sealed/sealed-approval.cjs','sealed/closed-release.cjs'];"));
  a.ok(s.includes(verifyDr), 'verifyDr 본문 바이트 그대로');
  a.throws(() => P.portPrepare(src.replace("'dr/session-proof-contract.cjs'];", "'x'];")), /EXACT_PORT_ANCHOR/);
});

test('승인 모듈 옮기기: 앵커가 정확히 한 번씩일 때만, 부모 모듈·HA 보기 겹·부모 폴더 이름이 남지 않게', () => {
  const parentFolder = 'q-37-release-20261029';
  const old = [
    "'use strict';",
    "const fs=require('node:fs'),path=require('node:path');",
    `const previous=require('../../${parentFolder}/rearm/approval.cjs');`,
    'const {need,sha,equal,encode,evidence,IDS,HISTORY,BEFORE,AFTER}=previous;',
    'function validatePriorArm(a,c,p){',
    ' previous.validateFinalChain(a);',
    ` const checked=require('../../${parentFolder}/rearm/postcheck.cjs').validate(c,p.readOnlySnapshot,p.at);`,
    ' return checked;',
    '}',
    'async function loadApproval(file){const e={previousApproval:{path:file}};',
    ' const a=await haDeployedCanonical(()=>previous.loadApproval(e.previousApproval.path)),priorArm=validatePriorArm(a,{},{});return a;}',
    '',
    '// HA 런타임 고정 사본 겹 2(10-23): 부모 승인 사슬 맨 안쪽의 10-13 모듈(…build-material.cjs의 canonical)',
    "async function haDeployedCanonical(load){const material=require('path').resolve(__dirname,'../../server-latency-20261013/runtime-deployment/build-material.cjs');return load();}",
    'module.exports={...previous,loadApproval,validatePriorArm};', '',
  ].join('\n');
  const parent = { completed: { root: 'C:\\x\\.tmp\\company-completed-q', sealSha256: H('a') }, approval: { root: 'C:\\x\\.tmp\\company-approval-q', sealSha256: H('b') }, release: H('c'), previousRelease: H('d'), chainLength: 37 };
  const s = P.portApproval(old, { parentFolder, parent });
  a.ok(!/\bprevious\b/.test(s) && !s.includes(parentFolder) && !s.includes('haDeployedCanonical') && !s.includes('build-material'));
  a.ok(s.includes("trusted=require('./sealed/sealed-approval.cjs')") && s.includes('trusted.load(SEALED_PARENT,e.previousApproval)') && s.includes('trusted.validateChain(a,SEALED_PARENT);') && s.includes('trusted.validator(SEALED_PARENT).validate('));
  a.ok(s.includes('module.exports={...base,SEALED_PARENT,loadParent:pin=>trusted.load(SEALED_PARENT,pin),loadApproval,validatePriorArm};'));
  a.throws(() => P.portApproval(old.replace(' previous.validateFinalChain(a);\n', ''), { parentFolder, parent }), /EXACT_PORT_ANCHOR/);
  a.throws(() => P.portApproval(old.replace('async function loadApproval', ' previous.validateFinalChain(a);\nasync function loadApproval'), { parentFolder, parent }), /EXACT_PORT_ANCHOR/);
  a.throws(() => P.portApproval(old, { parentFolder: '../x', parent }), /PARENT_FOLDER_NAME/);
  a.throws(() => P.portApproval(old, { parentFolder, parent: { ...parent, previousRelease: parent.release } }), /SEALED_PARENT_RELEASES/);
  a.equal(P.portLocalInputs(`const s = session(), prior = path.resolve(root, '../${parentFolder}');\n`, { parentFolder }), 'const s = session();\n');
});

test('새 도우미(approval-base)는 옛 맨 밑 도우미와 같은 답을 낸다 — 값·sha·encode·equal·evidence·WORKERS', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-base-')); t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo'), rearm = path.join(repo, '.tmp', 'n-release', 'rearm'), workers = path.join(repo, '.tmp', 'w-20261013', 'runtime-deployment');
  fs.mkdirSync(rearm, { recursive: true }); fs.mkdirSync(workers, { recursive: true });
  fs.writeFileSync(path.join(workers, 'job.py'), 'print(1)\n');
  const probe = path.join(repo, 'probe.json'); fs.writeFileSync(probe, '{"é":[1,2]}');
  const values = { IDS: { primary: '111', standby: '222', controller: '333' }, HISTORY: H('6'), BEFORE: { 'node-agent.mjs': H('1') }, AFTER: { 'node-agent.mjs': H('2') }, workers: { relative: '../../w-20261013/runtime-deployment', names: ['job.py'] } };
  fs.writeFileSync(path.join(rearm, 'approval-base.cjs'), P.approvalBase(values));
  const next = require(path.join(rearm, 'approval-base.cjs'));
  // 옛 맨 밑 도우미의 정의(공개 코드 꼴만 — 값은 합성)로 만든 비교 대상.
  const oldDir = path.join(repo, '.tmp', 'o-20261013', 'ha-compat'); fs.mkdirSync(oldDir, { recursive: true });
  fs.writeFileSync(path.join(oldDir, 'approval.cjs'), [
    "const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');",
    "const task=path.resolve(__dirname,'..'),repo=path.resolve(task,'../..');",
    `const IDS=${JSON.stringify(values.IDS)},HISTORY='${values.HISTORY}';`,
    "const need=(v,c)=>{if(!v)throw Error(c);},sha=b=>crypto.createHash('sha256').update(Buffer.isBuffer(b)?b:typeof b==='string'?b:JSON.stringify(b)).digest('hex');",
    "const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;",
    'const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));',
    String.raw`const encode=v=>Buffer.from(JSON.stringify(stable(v)).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n');`,
    "function evidence(pin){need(pin&&typeof pin.path==='string'&&/^[a-f0-9]{64}$/.test(pin.sha256),'EXACT_EVIDENCE_PIN');const f=path.resolve(pin.path),s=fs.lstatSync(f);need(f.startsWith(repo+path.sep)&&s.isFile()&&!s.isSymbolicLink()&&s.size<16777216,'REGULAR_WORKSPACE_EVIDENCE');const raw=fs.readFileSync(f);need(sha(raw)===pin.sha256,'EVIDENCE_CHANGED');return{raw,value:JSON.parse(raw),path:f,sha256:pin.sha256};}",
    `const BEFORE=${JSON.stringify(values.BEFORE)},AFTER=${JSON.stringify(values.AFTER)};`,
    "const WORKERS=()=>Object.fromEntries(['job.py'].map(n=>[n,sha(fs.readFileSync(path.resolve(__dirname,'../../w-20261013/runtime-deployment',n)))]));",
    'module.exports={need,sha,equal,encode,evidence,IDS,HISTORY,BEFORE,AFTER,WORKERS};',
  ].join('\n'));
  const old = require(path.join(oldDir, 'approval.cjs'));
  a.equal(P.baseEquivalence(next, old, probe), true);
  a.throws(() => P.baseEquivalence({ ...next, HISTORY: H('7') }, old, probe), /BASE_VALUE HISTORY/);
  a.throws(() => P.baseEquivalence({ ...next, encode: v => Buffer.from(JSON.stringify(v) + '\n') }, old, probe), /BASE_ENCODE/);
  a.throws(() => P.approvalBase({ ...values, workers: { relative: 'C:\\abs', names: ['job.py'] } }), /BASE_WORKERS/);
});
