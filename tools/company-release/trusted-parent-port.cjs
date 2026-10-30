'use strict';
// 봉인된 부모로 옮기기 — 다음 판 생성기(p<N>-rearm)와 리허설이 함께 쓰는 원천 변환. 옛 설계 판의 승인 모듈(부모 loadApproval을 사슬 끝까지 부름)을
// 부모 완료 보존본 옆 승인 결과 봉인(sealed-approval.cjs)을 믿는 꼴로 바꾸고, 재무장 입력 그래프에 봉인 역사 경계를 넣는다.
// 글자만 바꾸고 아무것도 실행하지 않는다. 운영 값(인스턴스 ID·manifest·경로)은 부르는 쪽(.tmp 생성기)이 넘기고 저장소에는 두지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const a = require('node:assert/strict');

const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function once(s, before, after) { a.equal(s.split(before).length, 2, 'EXACT_PORT_ANCHOR ' + before.slice(0, 90)); return s.replace(before, () => after); }
function cut(s, begin, end) {
  const i = s.indexOf(begin), j = s.indexOf(end, i + begin.length);
  a.ok(i >= 0 && j > i && s.lastIndexOf(begin) === i, 'PORT_SECTION ' + begin.slice(0, 60));
  return s.slice(0, i) + s.slice(j);
}
function folderName(n) { a.ok(typeof n === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n), 'PARENT_FOLDER_NAME'); return n; }

/** 자식 코드에 박을 믿음의 닻. 두 봉인의 절대 경로와 SHA, 부모·조부모 manifest, 부모 결과 사슬 길이. */
function sealedParent({ completed, approval, release, previousRelease, chainLength }) {
  for (const x of [completed, approval]) a.ok(x && typeof x.root === 'string' && path.isAbsolute(x.root) && hex(x.sealSha256), 'SEALED_PARENT_PIN');
  a.ok(hex(release) && hex(previousRelease) && release !== previousRelease && Number.isSafeInteger(chainLength) && chainLength >= 2, 'SEALED_PARENT_RELEASES');
  return { completed: { root: path.resolve(completed.root), sealSha256: completed.sealSha256 }, approval: { root: path.resolve(approval.root), sealSha256: approval.sealSha256 }, release, previousRelease, chainLength };
}

/**
 * rearm/approval.cjs: 부모 모듈 require·부모 loadApproval 재귀·HA 보기 겹(haDeployedCanonical)·부모 검증기 require를 봉인 믿기로.
 * 판마다 상수·이름표만 다른 같은 틀이라 앵커가 정확히 한 번씩 나와야 하고, 아니면 멈춘다.
 */
function portApproval(text, { parentFolder, parent }) {
  folderName(parentFolder); const P = sealedParent(parent);
  let s = String(text);
  s = once(s, `const previous=require('../../${parentFolder}/rearm/approval.cjs');`, [
    "const base=require('./approval-base.cjs'),trusted=require('./sealed/sealed-approval.cjs');",
    '// 봉인된 부모(사슬 39~): 부모 판의 승인 결과는 부모 완료 보존본 옆 승인 결과 봉인(아래 SHA 두 개)을 믿고, 부모 승인 모듈을 부르지 않는다.',
    '// 매 재무장마다 봉인 보존본 전체·봉인 결과·무장 계약과의 결속을 다시 본다(tools/company-release/sealed-approval.cjs load · README 「봉인된 부모」).',
    `const SEALED_PARENT=Object.freeze(${JSON.stringify(P)});`,
  ].join('\n'));
  s = once(s, 'const {need,sha,equal,encode,evidence,IDS,HISTORY,BEFORE,AFTER}=previous;', 'const {need,sha,equal,encode,evidence,IDS,HISTORY,BEFORE,AFTER}=base;');
  s = once(s, 'previous.validateFinalChain(a);', 'trusted.validateChain(a,SEALED_PARENT);');
  s = once(s, `require('../../${parentFolder}/rearm/postcheck.cjs').validate(`, 'trusted.validator(SEALED_PARENT).validate(');
  s = once(s, 'await haDeployedCanonical(()=>previous.loadApproval(e.previousApproval.path))', 'haRuntimePinned(trusted.load(SEALED_PARENT,e.previousApproval))');
  // 10-23 HA 보기 겹: 사슬 맨 안쪽 10-13 모듈이 재귀 중에 canonical/ha를 읽어서 둔 것 — 재귀가 없으면 보기는 쓸 데가 없다.
  // 그 겹이 함께 하던 「부모 결과의 런타임 넷 = 이 판 고정 사본 핀의 runtime」 교차 확인만 남긴다(Fable 설계 검토 P2-3).
  s = cut(s, '// HA 런타임 고정 사본 겹 2(10-23):', 'module.exports=');
  s = once(s, 'module.exports=', [
    '// HA 런타임 고정 사본 핀(10-23 겹 2에서 남긴 교차 확인): 부모 승인 결과의 런타임 넷은 이 판 ha-runtime-deployed-pins.json의 runtime과 같아야 한다.',
    "function haRuntimePinned(a){const pin=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../ha-runtime-deployed-pins.json')));need(pin&&pin.schema==='synk-ha-runtime-snapshot/v1'&&pin.runtime&&typeof pin.runtime==='object'&&!Array.isArray(pin.runtime)&&Object.keys(pin.runtime).length>0&&a&&a.runtime&&equal(pin.runtime,a.runtime),'HA_VIEW_RUNTIME_IS_NOT_THE_APPROVED_RUNTIME');return a;}",
    'module.exports=',
  ].join('\n'));
  s = once(s, 'module.exports={...previous,', 'module.exports={...base,SEALED_PARENT,loadParent:pin=>trusted.load(SEALED_PARENT,pin),');
  a.equal(/\bprevious\b/.test(s), false, 'PREVIOUS_MODULE_LEFT');
  a.equal(s.includes(parentFolder), false, 'PARENT_FOLDER_LEFT');
  a.equal(/haDeployedCanonical|build-material/.test(s), false, 'HA_VIEW_PATCH_LEFT');
  new vm.Script(s, { filename: 'approval.cjs' });
  return s;
}

/**
 * rearm/approval-base.cjs: 옛 사슬 맨 밑 모듈(ha-compat/approval.cjs · runtime-rearm/approval.cjs)과 같은 정의의 도우미와 상수.
 * values: IDS·HISTORY·BEFORE·AFTER(생성 때 옛 모듈 내보내기에서 복사), workers {relative(rearm/ 기준 상대 폴더), names}.
 * 부르는 쪽은 baseEquivalence로 옛 모듈과 같은지 본 뒤에만 쓴다. 판마다 같은 바이트로 이어 옮긴다.
 */
function approvalBase({ IDS, HISTORY, BEFORE, AFTER, workers }) {
  a.ok(IDS && typeof IDS === 'object' && Object.values(IDS).every(v => typeof v === 'string' && /^\d+$/.test(v)), 'BASE_IDS');
  a.ok(hex(HISTORY) && [BEFORE, AFTER].every(m => m && Object.keys(m).length && Object.values(m).every(hex)), 'BASE_RUNTIME');
  a.ok(workers && typeof workers.relative === 'string' && !path.isAbsolute(workers.relative) && Array.isArray(workers.names) && workers.names.length && workers.names.every(n => n === path.basename(n)), 'BASE_WORKERS');
  return [
    "'use strict';",
    '// 봉인된 부모(사슬 39~)의 승인 도우미 — 옛 사슬 맨 밑 모듈(pulse-workspace-integration-20261013/ha-compat/approval.cjs의 need·sha·equal·encode·evidence,',
    '// server-latency-20261013/runtime-rearm/approval.cjs의 BEFORE·AFTER·WORKERS)과 같은 정의. 값은 생성 때 옛 모듈 내보내기에서 복사했고 생성기가 같음을 확인했다.',
    "const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');",
    "const repo=path.resolve(__dirname,'../../..');",
    `const IDS=Object.freeze(${JSON.stringify(IDS)}),HISTORY=${JSON.stringify(HISTORY)};`,
    `const BEFORE=Object.freeze(${JSON.stringify(BEFORE)}),AFTER=Object.freeze(${JSON.stringify(AFTER)});`,
    "const need=(v,c)=>{if(!v)throw Error(c);},sha=b=>crypto.createHash('sha256').update(Buffer.isBuffer(b)?b:typeof b==='string'?b:JSON.stringify(b)).digest('hex');",
    "const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;",
    'const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));',
    String.raw`const encode=v=>Buffer.from(JSON.stringify(stable(v)).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n');`,
    "function evidence(pin){need(pin&&typeof pin.path==='string'&&/^[a-f0-9]{64}$/.test(pin.sha256),'EXACT_EVIDENCE_PIN');const f=path.resolve(pin.path),s=fs.lstatSync(f);need(f.startsWith(repo+path.sep)&&s.isFile()&&!s.isSymbolicLink()&&s.size<16777216,'REGULAR_WORKSPACE_EVIDENCE');const raw=fs.readFileSync(f);need(sha(raw)===pin.sha256,'EVIDENCE_CHANGED');return{raw,value:JSON.parse(raw),path:f,sha256:pin.sha256};}",
    `const WORKER_NAMES=Object.freeze(${JSON.stringify(workers.names)});`,
    `const WORKERS=()=>Object.fromEntries(WORKER_NAMES.map(n=>[n,sha(fs.readFileSync(path.resolve(__dirname,${JSON.stringify(workers.relative)},n)))]));`,
    'module.exports={need,sha,stable,equal,encode,evidence,IDS,HISTORY,BEFORE,AFTER,WORKERS};',
    '',
  ].join('\n');
}

/**
 * 새 도우미가 옛 모듈과 같은지 — 값은 equal로, 함수는 같은 시험 입력에 같은 답(던지는 자리 포함)인지. probeFile은 저장소 안 보통 JSON 파일.
 * 옛 모듈을 불러야 하므로 옛 계보가 남아 있을 때(첫 옮김) 한 번 돈다.
 */
function baseEquivalence(next, old, probeFile) {
  for (const k of ['IDS', 'HISTORY', 'BEFORE', 'AFTER']) a.ok(old.equal(next[k], old[k]) && JSON.stringify(next[k]) === JSON.stringify(old[k]), 'BASE_VALUE ' + k);
  a.ok(old.equal(next.WORKERS(), old.WORKERS()), 'BASE_WORKERS_OUTPUT');
  const samples = [Buffer.from('raw'), 'text', { b: 2, a: [1, { d: 'é', c: null }] }, [3, 'ㄱ'], { k: '\u2028' }];
  for (const v of samples) {
    a.equal(next.sha(v), old.sha(v), 'BASE_SHA');
    a.ok(next.encode(v).equals(old.encode(v)), 'BASE_ENCODE');
    for (const w of samples) a.equal(next.equal(v, w), old.equal(v, w), 'BASE_EQUAL');
  }
  const raw = fs.readFileSync(probeFile), pin = { path: probeFile, sha256: next.sha(raw) };
  const n = next.evidence(pin), o = old.evidence(pin);
  a.ok(n.raw.equals(o.raw) && n.path === o.path && n.sha256 === o.sha256 && old.equal(n.value, o.value), 'BASE_EVIDENCE');
  const code = f => { try { f(); return null; } catch (e) { return e.message; } };
  for (const bad of [null, { path: probeFile, sha256: 'x' }, { path: probeFile, sha256: '0'.repeat(64) }]) a.equal(code(() => next.evidence(bad)), code(() => old.evidence(bad)), 'BASE_EVIDENCE_REFUSAL');
  return true;
}

/**
 * rearm-ops/rearm-prepare-fresh.cjs: 입력 그래프의 안쪽 걷기가 봉인 역사 H(봉인 보존본 approval·contract·postcheck와 봉인 결과 안의 (경로, SHA) 핀)를
 * 잡지도 따라가지도 않게 한다. 위에서 직접 잡는 입력(STATIC_KEYS·fresh 증명·approvalPins의 맨 위 핀·리뷰 증거)은 그대로 잡는다.
 */
function portPrepareFresh(text, { prepareSha256 } = {}) {
  let s = String(text);
  s = once(s, "  const rearm = path.join(root, 'rearm');\n", [
    "  const rearm = path.join(root, 'rearm');",
    '  // 봉인된 부모(사슬 39~): 부모 완료 보존본·승인 결과 봉인 안에 이미 적힌 (경로, SHA) 핀은 부모 재무장과 봉인 때 검증한 역사다 — 안쪽 걷기에서 잡지도 따라가지도 않는다.',
    '  // 지금 판이 내용으로 판단하는 입력은 위에서 직접 잡으므로(STATIC_KEYS·fresh 증명·approvalPins 맨 위·리뷰 증거) 그대로 핀이 된다. 시험 주입에서는 주어진 것만 쓴다.',
    '  // 경계는 승인 모듈이 SEALED_PARENT를 내보낼 때만 켠다 — 없으면 옛 걷기 그대로(더 읽을 뿐, 검증은 그대로). 봉인 파일은 sealed-approval.cjs가 SHA로 고정해 읽는다.',
    "  const sealed = () => require(path.join(rearm, 'sealed', 'sealed-approval.cjs')), parentPin = () => require(path.join(rearm, 'approval.cjs')).SEALED_PARENT;",
    "  const sealedHistory = () => { if (dependencies) return typeof dependencies.sealedHistory === 'function' ? dependencies.sealedHistory() : null; const P = parentPin(); return P ? sealed().history(P) : null; };",
    "  const sealedAnchors = () => { if (dependencies) return typeof dependencies.sealedAnchors === 'function' ? dependencies.sealedAnchors() : []; const P = parentPin(); return P ? sealed().anchors(P) : []; };",
    "  const sealedKey = (file, digest) => path.resolve(file).toLowerCase() + '|' + digest;",
    '',
  ].join('\n'));
  s = once(s, '    const pins = new Map(), documents = new Map(), visited = new Set();\n', '    const pins = new Map(), documents = new Map(), visited = new Set(), historical = sealedHistory();\n');
  s = once(s, "        if (typeof v.path === 'string' && hash(v.sha256) && path.isAbsolute(v.path)) {\n",
    "        if (historical && typeof v.path === 'string' && hash(v.sha256) && path.isAbsolute(v.path) && historical.has(sealedKey(v.path, v.sha256))) return;\n        if (typeof v.path === 'string' && hash(v.sha256) && path.isAbsolute(v.path)) {\n");
  // 믿음의 닻 파일(두 봉인·봉인 결과)도 TOCTOU 핀 — 계약을 쓰기 직전 check()가 다시 대조한다(Fable P2-5 ①).
  s = once(s, '    const a = await d.loadApproval(original.path);\n    g.approvalPins(a.inputPins);\n',
    '    const a = await d.loadApproval(original.path);\n    g.approvalPins(a.inputPins);\n    for (const ref of sealedAnchors()) g.capture(ref, false);\n');
  // 격리 복원(비연습) DR 묶음은 그 묶음 판의 adapter.cjs가 자기 판 ../approval.cjs를 다시 불러, 옛 설계 판의 묶음이면 옛 승인 사슬 전체를 요구한다
  // (Fable P2-2). 가벼운 재무장이 실제로 타는 이 길에서 verifyDr 바로 앞에 이 판 폴더 안의 것만 받게 한다 — 주간 연습 묶음은 그대로.
  s = once(s, '    await d.verifyDr(e, a, initial);\n', [
    "    if (!(e.drProof.value && e.drProof.value.schema === 'synk-company-restore-drill/v1')) { const ownBundle = path.relative(root, path.dirname(e.drContext.path)); need(ownBundle && !ownBundle.startsWith('..') && !path.isAbsolute(ownBundle), 'SEALED_PARENT_DR_BUNDLE_OUTSIDE_RELEASE'); }",
    '    await d.verifyDr(e, a, initial);',
    '',
  ].join('\n'));
  if (prepareSha256 !== undefined) {
    a.ok(hex(prepareSha256), 'PREPARE_SHA_REQUIRED');
    s = s.replace(/const CANONICAL_REVIEW_SHA = '[a-f0-9]{64}';/, m => { a.equal(s.split(m).length, 2, 'EXACT_PORT_ANCHOR CANONICAL_REVIEW_SHA'); return `const CANONICAL_REVIEW_SHA = '${prepareSha256}';`; });
    a.ok(s.includes(`const CANONICAL_REVIEW_SHA = '${prepareSha256}';`), 'EXACT_PORT_ANCHOR CANONICAL_REVIEW_SHA');
  }
  new vm.Script(s, { filename: 'rearm-prepare-fresh.cjs' });
  return s;
}

/**
 * rearm/prepare.cjs: REQUIRED_QA에 새 승인 도우미·봉인 도구 셋(재무장 Linux QA 닫힘에 들어야 한다 — Fable P2-7). verifyDr 본문은 그대로 둔다
 * (판 시험이 그 본문을 떼어 평가한다) — DR 묶음 제한은 portPrepareFresh가 verifyDr 바로 앞에 둔다.
 * prepare.cjs 바이트가 바뀌므로 rearm-prepare-fresh.cjs의 CANONICAL_REVIEW_SHA를 portPrepareFresh(…, {prepareSha256})로 다시 맞춘다.
 */
function portPrepare(text) {
  const s = once(String(text), "'dr/session-proof-contract.cjs'];", "'dr/session-proof-contract.cjs','approval-base.cjs','sealed/sealed-approval.cjs','sealed/closed-release.cjs'];");
  new vm.Script(s, { filename: 'prepare.cjs' });
  return s;
}

/** rearm-ops/rearm-local-inputs.cjs: 안 쓰는 `prior` 폴더 변수 — 정적 닫힘이 그 폴더의 rearm/approval.cjs로 들어가 옛 사슬을 끌어온다. */
function portLocalInputs(text, { parentFolder }) {
  folderName(parentFolder);
  const s = once(String(text), `, prior = path.resolve(root, '../${parentFolder}')`, '');
  a.equal(s.includes(parentFolder), false, 'PARENT_FOLDER_LEFT');
  new vm.Script(s, { filename: 'rearm-local-inputs.cjs' });
  return s;
}

/** 판 rearm/sealed/에 옮길 저장소 파일 두 개(바이트 그대로). 생성 보고서에 SHA를 적는다. */
function vendorFiles(repoRoot = path.resolve(__dirname, '../..')) {
  return ['closed-release.cjs', 'sealed-approval.cjs'].map(n => ({ name: 'rearm/sealed/' + n, raw: fs.readFileSync(path.join(repoRoot, 'tools/company-release', n)) }));
}

module.exports = { sealedParent, portApproval, approvalBase, baseEquivalence, portPrepareFresh, portPrepare, portLocalInputs, vendorFiles };
