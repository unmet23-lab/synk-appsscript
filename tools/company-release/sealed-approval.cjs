'use strict';
// 봉인된 부모 승인 결과 — 판 P의 loadApproval 결과를 P 완료 보존본 옆에 봉인하고(seal), 다음 판이 그 봉인과 이음만 다시 보고 믿는다(load).
// 배포·승인을 하지 않는다. 저장소에는 운영 값을 두지 않는다 — 판 생성기가 이 파일과 closed-release.cjs를 판의 rearm/sealed/로 바이트째 옮겨 쓴다.
//
//   node tools/company-release/sealed-approval.cjs seal <입력.json>
//   node tools/company-release/sealed-approval.cjs verify <봉인 폴더> <봉인 SHA256> <완료 보존본> <보존본 봉인 SHA256>
//
// 입력: completed(P 완료 보존본 절대 경로), completedSealSha256, module {path, sha256}(P의 rearm/approval.cjs), output(새 절대 경로).
// 옛 설계 P(부모 loadApproval을 끝까지 부르는 판)는 봉인 때 옛 계보 전체가 마지막으로 한 번 필요하다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const a = require('node:assert/strict');
const R = require('./closed-release.cjs');

const SCHEMA = 'synk-company-approval-result/v1';
const SEAL = 'approval-seal.json', RESULT = 'approval-result.json';
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
// 판 승인 모듈 맨 밑 도우미(ha-compat/approval.cjs)와 같은 정의: sha는 객체를 키 순서 그대로 JSON으로, equal은 키를 정렬해 견준다.
const shaValue = v => crypto.createHash('sha256').update(Buffer.isBuffer(v) ? v : typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const equal = (x, y) => JSON.stringify(stable(x)) === JSON.stringify(stable(y));
// 결과는 키를 정렬하지 않고 적는다 — 자식이 sha(a.contract)처럼 키 순서에 민감한 해시를 쓴다.
const serialize = v => Buffer.from(JSON.stringify(v, null, 2) + '\n');
/** 봉인 역사 핀의 열쇠 — Windows 경로는 대소문자를 가리지 않는다. */
const key = (file, sha256) => path.resolve(file).toLowerCase() + '|' + sha256;

/** JSON으로 그대로 옮겨지는 값만 — undefined·함수·Buffer·Date·Map·NaN·별난 프로토타입이 있으면 되살린 객체가 달라진다. */
function plainJson(v, at = '$') {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
  if (typeof v === 'number') { a.ok(Number.isFinite(v), 'APPROVAL_RESULT_NOT_PLAIN_JSON ' + at); return; }
  a.ok(v && typeof v === 'object', 'APPROVAL_RESULT_NOT_PLAIN_JSON ' + at);
  const proto = Object.getPrototypeOf(v);
  a.ok(Array.isArray(v) ? proto === Array.prototype : proto === Object.prototype || proto === null, 'APPROVAL_RESULT_NOT_PLAIN_JSON ' + at);
  for (const [k, x] of Object.entries(v)) plainJson(x, at + '.' + k);
}

/**
 * 부모 결과의 사슬 안 정합 — 옛 설계에서 자식이 부르던 부모 validateFinalChain과 같은 것을 일반으로 본다(부모 코드를 부르지 않는다).
 * expect: release(부모 manifest) · previousRelease(조부모 manifest) · chainLength(부모 결과 사슬 길이).
 */
function validateChain(r, { release, previousRelease, chainLength }) {
  a.ok(hex(release) && hex(previousRelease) && Number.isSafeInteger(chainLength) && chainLength >= 2, 'SEALED_CHAIN_EXPECTATION');
  const chain = r && r.deploymentChain, p = r && r.priorArm, done = Date.parse(r && r.actualDeploymentAt);
  a.ok(Array.isArray(chain) && chain.length === chainLength, 'SEALED_CHAIN_LENGTH');
  a.ok(p && p.releaseSha256 === previousRelease && /^[a-f0-9-]{36}$/.test(p.requestId || '') && hex(p.contractSha256) && hex(p.postcheckSha256) && Number.isSafeInteger(p.armedAt) && equal(p.sourceHashes, r.runtime), 'SEALED_PRIOR_ARM');
  chain.forEach((row, i) => {
    a.ok(row && /^[a-f0-9]{32}$/.test(row.id || '') && row.mode === 'company-release-only' && Number.isSafeInteger(row.completedAt) && ['contractSha256', 'packageSha256', 'postcheckSha256', 'oldReleaseSha256', 'newReleaseSha256'].every(k => hex(row[k])), 'SEALED_CHAIN_ROW ' + i);
    if (i) a.ok(chain[i - 1].newReleaseSha256 === row.oldReleaseSha256 && chain[i - 1].completedAt < row.completedAt, 'SEALED_CHAIN_LINK ' + i);
    if (i < chain.length - 1) a.ok(row.completedAt < p.armedAt, 'SEALED_CHAIN_BEFORE_PRIOR_ARM ' + i);
  });
  const tip = chain[chain.length - 1];
  a.ok(tip.completedAt >= p.armedAt && tip.completedAt === done, 'SEALED_CHAIN_TIP_TIME');
  a.ok(tip.oldReleaseSha256 === previousRelease && tip.newReleaseSha256 === release && r.releaseSha256 === release, 'SEALED_CHAIN_TIP_RELEASES');
  a.ok(r.contract && tip.id === r.contract.id && tip.contractSha256 === shaValue(r.contract) && r.evidence && tip.packageSha256 === r.evidence.packageSha256 && tip.postcheckSha256 === r.evidence.runtimeProofSha256, 'SEALED_CHAIN_TIP_BINDING');
  return chain;
}

/**
 * 결과 ↔ 완료 보존본(봉인한 승인 입력·receipt·무장 계약) 결속. 무장 계약은 부모가 실제로 무장할 때 설치하고 사후 확인한 것이고,
 * 그 판 core.prepare가 결과 a에서 deploymentChain·nextPlan·deployment(a.evidence + 배포 계약 id·SHA)·history·runtimeTransition·priorArm·
 * expected(sourceHashes·history 셋)를 옮겨 적었다 — 봉인 결과를 바꿔치기해도 이 계약과 어긋나면 잡힌다(Fable 설계 검토 P2-4, 37·36 실측으로 성립 확인).
 */
function bind(r, base, expect) {
  const ev = base.seal.evidence, docs = base.documents, c = docs.contract;
  a.equal(r.releaseSha256, base.manifestSha256, 'SEALED_RESULT_RELEASE');
  a.equal(r.evidence && r.evidence.inputSha256, ev.approval.sha256, 'SEALED_RESULT_APPROVAL_INPUT');
  a.equal(r.evidence && r.evidence.candidateReceiptSha256, ev.receipt.sha256, 'SEALED_RESULT_RECEIPT_SHA');
  a.ok(equal(r.candidateReceipt, docs.receipt), 'SEALED_RESULT_RECEIPT');
  a.ok(equal(c.deploymentChain, r.deploymentChain), 'SEALED_RESULT_ARMED_CHAIN');
  a.ok(equal(c.nextPlan, { ...r.plan, armed: true }), 'SEALED_RESULT_ARMED_PLAN');
  a.ok(r.contract && equal(c.deployment, { ...r.evidence, id: r.contract.id, contractSha256: shaValue(r.contract) }), 'SEALED_RESULT_ARMED_DEPLOYMENT');
  a.ok(r.history && equal(c.history, r.history) && equal(c.expected && c.expected.history, { lastCompletedOperation: r.history.returnOperation, lastCompletedHistory: r.history.returnHistory, lastRearm: r.history.lastRearm }), 'SEALED_RESULT_ARMED_HISTORY');
  a.ok(equal(c.runtimeTransition, r.runtimeTransition) && equal(c.priorArm, r.priorArm) && equal(c.expected && c.expected.sourceHashes, r.runtime), 'SEALED_RESULT_ARMED_RUNTIME');
  a.equal(expect.release, base.manifestSha256, 'SEALED_RESULT_EXPECTED_RELEASE');
  validateChain(r, expect);
}

/** 봉인 폴더 확인(읽기만) — 보존본 verify 전부 + 봉인 핀 + 결과 바이트·왕복 + 결속. expect가 없으면 봉인에 적힌 값으로 본다(도구 확인용). */
function verify(root, sealSha256, { completed, completedSealSha256 }, expect) {
  a.ok(hex(sealSha256), 'EXPLICIT_APPROVAL_SEAL_PIN_REQUIRED');
  const sealRaw = R.read(path.join(root, SEAL), { sha256: sealSha256 }), s = JSON.parse(sealRaw);
  a.equal(s.schema, SCHEMA, 'APPROVAL_SEAL_SCHEMA');
  a.equal(s.completed && s.completed.sealSha256, completedSealSha256, 'APPROVAL_SEAL_COMPLETED_PIN');
  const base = R.verify(completed, completedSealSha256), ev = base.seal.evidence;
  a.equal(s.release, base.manifestSha256, 'APPROVAL_SEAL_RELEASE');
  for (const k of ['approval', 'contract', 'postcheck', 'receipt']) a.equal(s[k] && s[k].sha256, ev[k].sha256, 'APPROVAL_SEAL_EVIDENCE ' + k);
  a.equal(s.result && s.result.path, RESULT, 'APPROVAL_SEAL_RESULT_PATH');
  R.exactDirectory(root, [SEAL, RESULT]);
  const raw = R.read(path.join(root, RESULT), s.result), result = JSON.parse(raw);
  plainJson(result); a.ok(serialize(result).equals(raw), 'APPROVAL_RESULT_ROUND_TRIP'); a.equal(shaValue(result), s.result.compactSha256, 'APPROVAL_RESULT_COMPACT_SHA');
  const want = expect || { release: s.release, previousRelease: s.previousRelease, chainLength: s.chainLength };
  a.ok(s.previousRelease === want.previousRelease && s.chainLength === want.chainLength, 'APPROVAL_SEAL_CHAIN_EXPECTATION');
  bind(result, base, want);
  R.read(path.join(root, SEAL), { sha256: sealSha256 });
  return { result, seal: s, sealSha256, base };
}

function sealedInputPath(PARENT, base) { return path.join(PARENT.completed.root, base.seal.evidence.approval.path); }

/**
 * 자식 판 재무장이 부르는 길 — 부모 loadApproval 대신. 매 호출 처음부터 다시 확인하고(캐시 없음) 새 객체를 돌려준다.
 * PARENT: {completed: {root, sealSha256}, approval: {root, sealSha256}, release, previousRelease, chainLength} — 자식 코드에 박은 믿음의 닻.
 * pin: 자식 승인 입력의 previousApproval — 정확히 봉인된 부모 승인 입력이어야 한다.
 */
function load(PARENT, pin) {
  a.ok(pin && typeof pin.path === 'string' && hex(pin.sha256), 'EXACT_PARENT_APPROVAL_PIN');
  const v = verify(PARENT.approval.root, PARENT.approval.sealSha256, { completed: PARENT.completed.root, completedSealSha256: PARENT.completed.sealSha256 },
    { release: PARENT.release, previousRelease: PARENT.previousRelease, chainLength: PARENT.chainLength });
  a.ok(key(pin.path, pin.sha256) === key(sealedInputPath(PARENT, v.base), v.base.seal.evidence.approval.sha256), 'PARENT_APPROVAL_PIN_IS_NOT_THE_SEALED_INPUT');
  return v.result;
}

/**
 * 믿음의 닻 파일 셋 — 자식 재무장의 입력 그래프가 TOCTOU 핀으로 잡아 계약을 쓰기 직전에 다시 대조한다(Fable P2-5 ①).
 * 보존본 봉인·승인 결과 봉인은 PARENT의 SHA, 결과 파일은 승인 결과 봉인에 적힌 SHA로.
 */
function anchors(PARENT) {
  const sealFile = path.join(PARENT.approval.root, SEAL);
  const s = JSON.parse(R.read(sealFile, { sha256: PARENT.approval.sealSha256 }));
  return [
    { path: path.join(PARENT.completed.root, 'completed-release.json'), sha256: PARENT.completed.sealSha256 },
    { path: sealFile, sha256: PARENT.approval.sealSha256 },
    { path: path.join(PARENT.approval.root, RESULT), sha256: s.result.sha256 },
  ];
}

/** 봉인 보존본의 검증기(부모 rearm/postcheck.cjs와 같은 바이트 — 보존본 봉인이 SHA로 고정). */
function validator(PARENT) {
  const seal = JSON.parse(R.read(path.join(PARENT.completed.root, 'completed-release.json'), { sha256: PARENT.completed.sealSha256 }));
  const file = path.join(PARENT.completed.root, R.name(seal.evidence.validator.path));
  R.read(file, seal.evidence.validator);
  return require(file);
}

/**
 * 봉인 역사 H — 봉인 보존본의 승인 입력·무장 계약·사후 확인과 봉인 승인 결과 안에 적힌 모든 (경로, SHA) 핀.
 * 자식 재무장의 입력 그래프는 안쪽 걷기에서 이 핀을 따라가지 않는다(부모 재무장과 봉인 때 검증한 역사다). 핀으로 고정한 파일만 읽는다.
 */
function history(PARENT) {
  const seal = JSON.parse(R.read(path.join(PARENT.completed.root, 'completed-release.json'), { sha256: PARENT.completed.sealSha256 }));
  const s = JSON.parse(R.read(path.join(PARENT.approval.root, SEAL), { sha256: PARENT.approval.sealSha256 }));
  a.ok(s.schema === SCHEMA && s.completed.sealSha256 === PARENT.completed.sealSha256 && s.release === seal.manifestSha256, 'APPROVAL_SEAL_COMPLETED_PIN');
  const docs = ['approval', 'contract', 'postcheck'].map(k => R.read(path.join(PARENT.completed.root, R.name(seal.evidence[k].path)), seal.evidence[k]));
  docs.push(R.read(path.join(PARENT.approval.root, RESULT), s.result));
  const found = new Set();
  const walk = v => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.path === 'string' && hex(v.sha256) && path.isAbsolute(v.path)) found.add(key(v.path, v.sha256));
    for (const x of Object.values(v)) walk(x);
  };
  for (const raw of docs) walk(JSON.parse(raw));
  return found;
}

/** 따로 띄운 node에서 P의 loadApproval을 부른다 — 모듈 캐시와 옛 판의 전역 패치(haDeployedCanonical)가 섞이지 않게. */
function compute(modulePath, inputPath, timeoutMs = 30 * 60 * 1000) {
  const room = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'synk-approval-seal-'));
  try {
    const out = path.join(room, 'result.json');
    const r = cp.spawnSync(process.execPath, [__filename, '__계산', modulePath, inputPath, out],
      { cwd: path.resolve(path.dirname(modulePath), '../../..'), encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    a.equal(r.status, 0, 'APPROVAL_RESULT_COMPUTE_FAILED ' + String(r.error ? r.error.message : '') + String(r.stderr || '').slice(-2000));
    const raw = fs.readFileSync(out), meta = JSON.parse(fs.readFileSync(out + '.meta.json'));
    return { raw, parent: meta.parent };
  } finally { fs.rmSync(room, { recursive: true, force: true }); }
}

function seal({ completed, completedSealSha256, module: mod, output, timeoutMs }) {
  a.ok([completed, output].every(p => typeof p === 'string' && path.isAbsolute(p)) && mod && typeof mod.path === 'string' && path.isAbsolute(mod.path), 'ABSOLUTE_INPUT_REQUIRED');
  a.ok(hex(completedSealSha256) && hex(mod.sha256), 'EXACT_PINS_REQUIRED');
  const base = R.verify(completed, completedSealSha256), ev = base.seal.evidence;
  R.read(mod.path, mod);
  const computed = compute(mod.path, path.join(completed, ev.approval.path), timeoutMs);
  R.read(mod.path, mod); R.verify(completed, completedSealSha256);
  const result = JSON.parse(computed.raw);
  plainJson(result); a.ok(serialize(result).equals(computed.raw), 'APPROVAL_RESULT_ROUND_TRIP');
  const chain = result.deploymentChain, tip = Array.isArray(chain) && chain.length ? chain[chain.length - 1] : null;
  const expect = { release: base.manifestSha256, previousRelease: tip && tip.oldReleaseSha256, chainLength: Array.isArray(chain) ? chain.length : null };
  bind(result, base, expect);
  const trusted = computed.parent ? { completedSealSha256: computed.parent.completed.sealSha256, approvalSealSha256: computed.parent.approval.sealSha256, release: computed.parent.release } : null;
  const doc = {
    schema: SCHEMA, release: base.manifestSha256, previousRelease: expect.previousRelease, chainLength: expect.chainLength,
    chainTip: { id: tip.id, completedAt: tip.completedAt, oldReleaseSha256: tip.oldReleaseSha256, newReleaseSha256: tip.newReleaseSha256 },
    completed: { folder: path.basename(completed), sealSha256: completedSealSha256 },
    approval: { sha256: ev.approval.sha256 }, contract: { sha256: ev.contract.sha256 }, postcheck: { sha256: ev.postcheck.sha256 }, receipt: { sha256: ev.receipt.sha256 },
    result: { path: RESULT, sha256: R.sha(computed.raw), bytes: computed.raw.length, compactSha256: shaValue(result) },
    computedBy: { module: { path: mod.path, sha256: mod.sha256 }, method: trusted ? 'trusted-parent' : 'full-recursion', trustedParent: trusted, node: process.version, at: new Date().toISOString() },
    historicalRevalidation: true, currentLiveStateVerified: false, deploymentAuthorized: false,
  };
  const sealRaw = R.encode(doc), sealSha256 = R.sha(sealRaw);
  R.writeNew(output, new Map([[SEAL, sealRaw], [RESULT, computed.raw]]), stage => verify(stage, sealSha256, { completed, completedSealSha256 }, expect));
  return { status: 'approval-result-sealed', sealSha256, output, release: base.manifestSha256, chainLength: expect.chainLength, method: doc.computedBy.method, resultSha256: doc.result.sha256, remoteCalls: 0 };
}

module.exports = { SCHEMA, key, plainJson, validateChain, bind, verify, load, validator, history, anchors, seal, serialize, shaValue, equal };

if (require.main === module) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === '__계산') {
    // 자식: 모듈의 loadApproval만 부르고 결과를 적는다. 봉인된 부모 설계 모듈이면 그 SEALED_PARENT(믿은 봉인)도 함께 적는다.
    (async () => {
      const [modulePath, inputPath, out] = rest, m = require(modulePath);
      const result = await m.loadApproval(inputPath);
      plainJson(result);
      fs.writeFileSync(out, serialize(result), { flag: 'wx' });
      fs.writeFileSync(out + '.meta.json', JSON.stringify({ parent: m.SEALED_PARENT && typeof m.SEALED_PARENT === 'object' ? m.SEALED_PARENT : null }), { flag: 'wx' });
    })().catch(e => { console.error(String((e && e.stack) || e).slice(0, 4000)); process.exitCode = 1; });
  } else {
    try {
      if (mode === 'seal' && rest.length === 1) console.log(JSON.stringify(seal(JSON.parse(R.read(rest[0])))));
      else if (mode === 'verify' && rest.length === 4) {
        const [root, sha256, completed, completedSealSha256] = rest, v = verify(path.resolve(root), sha256, { completed: path.resolve(completed), completedSealSha256 });
        console.log(JSON.stringify({ status: 'approval-result-verified', release: v.seal.release, chainLength: v.seal.chainLength, method: v.seal.computedBy.method, remoteCalls: 0, currentLiveStateVerified: false }));
      } else throw Error('Use seal <input.json> or verify <folder> <seal-sha256> <completed folder> <completed-seal-sha256>');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
