'use strict';
// 회사 릴리스 계보 실측 — 판 하나가 실제로 읽는 .tmp 폴더를 잰다. 읽기만 하고 원격·운영 동작은 없다.
// ① 부모 승인 재검증: 판의 재무장(prepare-arm)이 맨 먼저 하는 「부모 판 rearm/approval.cjs의 loadApproval(봉인된 부모 승인 입력)」을
//    읽기 추적과 함께 돌린다. 이 재검증은 승인 사슬을 끝까지 내려가며 판마다 candidate/ 전체와 승인 기록을 다시 확인한다
//    (10-30 실측: 37 판 기준 옛 폴더 57곳에서 각 1,100~2,300개 파일 · 2~6분). 실패하면 그 판의 재무장도 같은 자리에서 멈춘다.
//    봉인된 부모 설계 판(사슬 39~, trusted-parent-port.cjs가 옮긴 꼴)은 판 자신의 loadParent(봉인 믿기)를 잰다.
// ①′ 재무장 입력 그래프: prepare-arm이 핀(경로, SHA)을 따라 읽는 파일 — 부모 핀·후보 요약·앞 판 정적 입력과 그 DR 묶음·inputPins(10-30 추가).
// ② 정적 코드 닫힘: 판의 도구 코드가 require·import·경로 글자로 부르는 다른 .tmp 폴더를 코드만 따라 모은다(원격 단계 도구 포함, 생성기는 이름만).
// ③ 재무장 Linux QA 원천: 판 rearm/linux-qa.cjs의 sources()를 그 판 코드 그대로 읽기 추적과 함께 돌린다(10-30 추가 — QA원천 머리말).
// 넷을 합친 이름이 .tmp/_정리제외.txt 「#! 실측 계보」 절의 닫힌 목록이다(tools/tmp정리목록.js가 남기되 언급은 따라가지 않는다).
// 어느 하나라도 끝까지 못 돌면 재기 전체가 실패한다 — 일부만 센 절을 내지 않는다.
//
//   node tools/company-release/lineage.cjs measure <판 폴더> [<판 폴더>…] [--정리대기 <폴더>] [--json <출력>] [--절]   (판 여럿 = 계보 합집합)
//
// 재검증이 .tmp만으로 통과하면 그 재검증은 정리 대기에서 아무것도 읽지 않는다 — 정리 대기를 지우기 전·운영 반영 전 확인으로 쓴다.
// 실패하면 오류의 경로가 빠진 자리다(되돌리고 다시 돌린다). --정리대기는 「.tmp에 없는 이름」 가운데 그 폴더에 있는 것을 알린다(있는지만 본다).
//
// 판 폴더에는 deployment/parent-arm-pin.json(봉인된 부모 승인 입력의 경로·SHA)과 rearm/approval.cjs(부모 판 승인 모듈을
// previous로 부르거나, 봉인된 부모를 SEALED_PARENT로 믿음)가 있어야 한다 — 사슬 생성기(p<N>-operators·p<N>-rearm)가 만드는 꼴이다.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');

const 코드확장자 = new Set(['.cjs', '.mjs', '.js', '.py']);
const 건너뛸폴더 = new Set(['candidate', 'qa', 'execution', 'node_modules', '.git', 'review-repo']);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const 같은경로 = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
/** 뿌리 안이면 뿌리 기준 상대 경로, 아니면 null. */
function 안쪽(뿌리, p) {
  const r = path.relative(뿌리, path.resolve(p));
  return !r || r.startsWith('..') || path.isAbsolute(r) ? null : r;
}
function 안의폴더(임시, p) { const r = 안쪽(임시, p); return r ? r.split(path.sep)[0] : null; }

/**
 * 판 폴더에서 부모 승인 모듈과 봉인된 부모 승인 입력을 찾는다. 입력 파일은 핀의 SHA와 같아야 한다.
 * 옛 설계(방식 previous): 판 승인 모듈이 부모 판 모듈을 previous로 부르고, ①은 그 부모의 loadApproval이다.
 * 봉인된 부모 설계(방식 sealed, 사슬 39~ — trusted-parent-port.cjs가 옮긴 꼴): 판 자신의 승인 모듈이 봉인을 믿고(loadParent), ①은 그 loadParent다.
 */
function 부모찾기(판) {
  const 핀 = JSON.parse(fs.readFileSync(path.join(판, 'deployment/parent-arm-pin.json'), 'utf8'));
  const 승인 = 핀 && 핀.approval;
  if (!승인 || typeof 승인.path !== 'string' || !/^[a-f0-9]{64}$/.test(승인.sha256 || '')) throw new Error('PARENT_ARM_PIN_APPROVAL_REQUIRED');
  if (sha(fs.readFileSync(승인.path)) !== 승인.sha256) throw new Error('PARENT_APPROVAL_INPUT_CHANGED ' + 승인.path);
  const 부모핀 = ['approval', 'contract', 'postcheck'].map((k) => 핀[k]).filter((x) => x && typeof x.path === 'string' && /^[a-f0-9]{64}$/.test(x.sha256 || ''));
  const 글 = fs.readFileSync(path.join(판, 'rearm/approval.cjs'), 'utf8');
  const 봉인 = /\btrusted\s*=\s*require\((['"])\.\/sealed\/sealed-approval\.cjs\1\)/.test(글) && /\bSEALED_PARENT\s*=\s*Object\.freeze\(/.test(글);
  const 찾음 = [...글.matchAll(/\bprevious\s*=\s*require\((['"])([^'"]+)\1\)/g)];
  if (봉인 && 찾음.length === 0) return { 방식: 'sealed', 모듈: path.join(판, 'rearm', 'approval.cjs'), 승인입력: path.resolve(승인.path), 부모핀 };
  if (봉인 || 찾음.length !== 1) throw new Error('PARENT_APPROVAL_MODULE_REQUIRED');
  return { 방식: 'previous', 모듈: path.resolve(판, 'rearm', 찾음[0][2]), 승인입력: path.resolve(승인.path), 부모핀 };
}

/** 이 파일의 숨은 명령을 따로 띄운 node(작업 폴더 = 저장소 뿌리)에서 돌리고 결과 json을 읽는다. 결과가 없거나 ok가 아니면 그 코드로 멈춘다. */
function 자식으로(명령, 인자들, { 임시, 시한, 없음코드, 실패코드 }) {
  const 방 = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'synk-lineage-'));
  try {
    const 결과파일 = path.join(방, 'result.json');
    const r = cp.spawnSync(process.execPath, [__filename, 명령, 임시, 결과파일, path.join(방, 'esm.log'), ...인자들],
      { cwd: path.dirname(임시), encoding: 'utf8', windowsHide: true, timeout: 시한, maxBuffer: 64 * 1024 * 1024 });
    let 결과 = null;
    try { 결과 = JSON.parse(fs.readFileSync(결과파일, 'utf8')); } catch {}
    if (!결과) throw new Error(없음코드 + ' ' + (r.error ? r.error.message : '') + ' ' + String(r.stderr || '').slice(-2000));
    if (!결과.ok) throw new Error(실패코드 + ' ' + 결과.error);
    return 결과;
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
}

/** ① 부모 승인 재검증을 따로 띄운 node에서 읽기 추적과 함께 돌린다. 방식 sealed면 판 모듈의 loadParent(봉인 믿기)를 부른다. */
function 재검증추적({ 임시, 모듈, 승인입력, 방식 = 'previous', 시한 = 30 * 60 * 1000 }) {
  return 자식으로('__추적', [모듈, 승인입력, 방식], { 임시, 시한, 없음코드: 'LINEAGE_TRACE_NO_RESULT', 실패코드: 'PARENT_APPROVAL_RECHECK_FAILED' });
}

/**
 * ③ 재무장 Linux QA 원천: 판 rearm/linux-qa.cjs의 sources()(QA가 원격 Linux로 보내는 원천 목록을 만드는 그 판 코드)를 읽기 추적과 함께 돌린다.
 * 판 폴더 걷기·고정 목록·HA 사본·상대 require 따라가기를 판 코드 그대로 타므로, 정적 닫힘(②)이 QA 원천을 덮는다는 주장에 기대지 않는다(GPT 10-30 r3).
 * 배포 전에는 배포 단계가 판 안에 쓰는 파일(38: deployment/rearm-stage-plan-pin.json — deployment/finish-local-binding.cjs가 씀)이 아직 없어
 * sources()가 멈춘다 — 그래서 판 deployment/ 안에 없는 JS 아닌 파일만 「있는 빈 파일」로 본다(lstat·stat은 보통 파일, 인코딩 없이 읽으면 빈 내용).
 * 봐준 파일은 원천 목록의 잎이어야 한다: 돌려준 목록에 그 이름으로 들고, 인코딩 없이 많아야 한 번(해시) 읽힌다 — 두 번 이상 읽거나 목록에 없으면
 * 그 빈 내용이 원천 찾기에 쓰였을 수 있어 QA_TOLERATED_NOT_A_LEAF로 실패한다(Fable 10-30 P2 — 「따라가는 것은 JS뿐」이라는 코드 읽기를 실행 검사로).
 * 판 폴더는 늘 계보에 들므로 잎인 빈 파일은 폴더 목록을 바꾸지 못한다. 그 밖의 실패(판 밖 파일이 없음 · deployment/ 밖이나 JS인 없는 파일 ·
 * 없는 파일을 글로 읽음 · 없는 폴더 목록 돌기)는 그대로 실패이고 재기 전체가 실패한다 — 도중까지 센 몫을 계보로 내지 않는다(GPT 10-30 GB1 · r2).
 * 한계: 봐준 파일을 한 번 읽어 해시와 원천 찾기에 함께 쓰는 코드는 QA 전에 못 잡는다(그 내용이 아직 없다) — QA 뒤 대조(QA결과대조)가 잡고,
 * 그때까지 절 머리에 「QA 전 · 봐줌」을 적는다(절로).
 * 판에 rearm/linux-qa.cjs가 없으면(재무장 QA가 없는 꼴) null.
 */
function QA원천({ 임시, 판, 시한 = 10 * 60 * 1000 }) {
  const qa = path.join(판, 'rearm', 'linux-qa.cjs');
  if (!fs.existsSync(qa)) return null;
  return 자식으로('__QA원천', [qa, 판], { 임시, 시한, 없음코드: 'LINEAGE_QA_NO_RESULT', 실패코드: 'QA_SOURCES_FAILED' });
}

/**
 * ③과 실제 QA 대조(QA 뒤에 잴 때): 판의 가장 새 재무장 Linux QA 결과(rearm/linux-qa-result-v<N>.json — 같은 sources()가 그때 낸 목록)의 원천 이름이
 * ③ 이름에 다 있는지 본다. 빠진 것이 있으면 ③이 그 판 코드에서 QA가 실제로 보낸 것을 못 찾았거나 QA 뒤 판 코드가 바뀐 것이다(어느 쪽이든 그 파일은
 * ①′가 QA 결과 목록으로 잡는다). 배포 전 너그러움이 원천 찾기를 바꾸지 않는지는 판마다 QA 뒤 이 대조로 실제 자료에서 다시 확인된다(10-30 실측:
 * 37 실제 판에서 배포 파일 셋을 가려 배포 전 상태로 돌린 ③도 QA 결과 877개와 같았다). QA 결과가 없으면 null.
 */
function QA결과대조(판, 이름들) {
  const 곳 = path.join(판, 'rearm');
  const 결과들 = fs.existsSync(곳) ? fs.readdirSync(곳).map((n) => /^linux-qa-result-v(\d+)\.json$/.exec(n)).filter(Boolean).sort((x, y) => Number(x[1]) - Number(y[1])) : [];
  if (!결과들.length) return null;
  const 파일 = 결과들[결과들.length - 1][0];
  let qa = null; try { qa = JSON.parse(fs.readFileSync(path.join(곳, 파일), 'utf8')); } catch {}
  const 줄들 = qa && Array.isArray(qa.files) ? qa.files : null;
  // 대조할 수 없는 결과(안 읽힘 · files가 배열이 아님 · 비었음 · 이름 없는 줄)를 「다 있음」으로 세지 않는다(GPT 10-30 r5 GA1).
  if (!줄들 || !줄들.length || 줄들.some((f) => !f || typeof f.name !== 'string' || !f.name)) return { result: 파일, invalid: true, names: 0, missing: [], extra: 0 };
  const 그때 = 줄들.map((f) => f.name), 지금 = new Set(이름들), 그때들 = new Set(그때);
  return { result: 파일, invalid: false, names: 그때.length, missing: 그때.filter((x) => !지금.has(x)).sort(), extra: 이름들.filter((x) => !그때들.has(x)).length };
}

// fs에서 첫 인자가 읽는 경로인 함수(복사는 원본) — 동기·콜백·promises. 하나라도 빠지면 그 읽기로 쓰는 폴더를 못 센다(GPT 10-30 GA3).
const 동기읽기 = ['readFileSync', 'openSync', 'statSync', 'lstatSync', 'existsSync', 'readdirSync', 'accessSync', 'realpathSync', 'createReadStream', 'opendirSync', 'readlinkSync', 'copyFileSync', 'cpSync'];
const 콜백읽기 = ['readFile', 'open', 'stat', 'lstat', 'readdir', 'access', 'realpath', 'opendir', 'readlink', 'copyFile', 'cp', 'exists'];
const 약속읽기 = ['readFile', 'open', 'stat', 'lstat', 'readdir', 'access', 'realpath', 'opendir', 'readlink', 'copyFile', 'cp'];
// import() 훅(로더 스레드) — 풀린 파일을 남긴다. 원문에 줄바꿈 이스케이프를 두지 않는다.
const 가져오기훅 = [
  "import fs from 'node:fs';", "import {fileURLToPath} from 'node:url';", 'let out;', 'export function initialize(d){out=d.out;}',
  "export async function resolve(s,c,n){const r=await n(s,c);if(out&&r.url&&r.url.startsWith('file:'))fs.appendFileSync(out,fileURLToPath(r.url)+String.fromCharCode(10));return r;}",
].join(String.fromCharCode(10));

/**
 * 추적 훅: fs·require·import가 건드린 .tmp 폴더를 센다. 디스크·동작은 바꾸지 않는다. 돌려준 함수가 import 훅 기록까지 모아 폴더 표를 낸다.
 * 실제로 있는 경로만 센다 — 없는 자리를 있는지 물어본 것은 쓰는 폴더가 아니다.
 */
function 추적걸기(임시, esm로그) {
  const Module = require('node:module'), { fileURLToPath } = require('node:url');
  const 본 = new Map(), 원래있음 = fs.existsSync;
  const 적기 = (p) => {
    try {
      if (p instanceof URL) p = fileURLToPath(p);
      if (Buffer.isBuffer(p)) p = p.toString();
      if (typeof p !== 'string') return;
      const 이름 = 안의폴더(임시, p);
      if (이름 && 원래있음.call(fs, p)) 본.set(이름, (본.get(이름) || 0) + 1);
    } catch {}
  };
  const 원래풀기 = Module._resolveFilename;
  Module._resolveFilename = function (요청, 부모, ...나머지) { const r = 원래풀기.call(this, 요청, 부모, ...나머지); 적기(r); return r; };
  const 감싸기 = (대상, 이름) => {
    const 원래 = 대상[이름]; if (typeof 원래 !== 'function') return;
    const 감쌈 = function (p, ...나머지) { 적기(p); return 원래.call(this, p, ...나머지); };
    if (원래.native) 감쌈.native = function (p, ...나머지) { 적기(p); return 원래.native.call(this, p, ...나머지); };
    대상[이름] = 감쌈;
  };
  for (const 이름 of [...동기읽기, ...콜백읽기]) 감싸기(fs, 이름);
  for (const 이름 of 약속읽기) 감싸기(fs.promises, 이름);
  Module.register('data:text/javascript;base64,' + Buffer.from(가져오기훅).toString('base64'), { data: { out: esm로그 } });
  return () => {
    try { for (const p of fs.readFileSync(esm로그, 'utf8').split(String.fromCharCode(10))) if (p) 적기(p); } catch {}
    return Object.fromEntries([...본].sort((a, b) => a[0].localeCompare(b[0])));
  };
}

/** ① 자식: 추적 훅을 걸고 부모 승인 재검증을 돌린다. */
async function 추적자식([임시, 결과파일, esm로그, 모듈, 승인입력, 방식 = 'previous']) {
  const 시작 = Date.now(), 마무리 = 추적걸기(임시, esm로그);
  let 결과;
  try {
    const m = require(모듈);
    const 승인 = 방식 === 'sealed' ? await m.loadParent({ path: 승인입력, sha256: sha(fs.readFileSync(승인입력)) }) : await m.loadApproval(승인입력);
    // ①′ 입력 그래프가 쓸 것: 결과의 inputPins, 봉인 설계면 그 판 sealed-approval.cjs의 봉인 역사 H(같은 코드로 — 경계를 흉내 내지 않는다).
    const 역사 = 방식 === 'sealed' ? [...require(path.join(path.dirname(모듈), 'sealed', 'sealed-approval.cjs')).history(m.SEALED_PARENT)] : null;
    결과 = { ok: true, chainLength: Array.isArray(승인 && 승인.deploymentChain) ? 승인.deploymentChain.length : null, inputPins: (승인 && 승인.inputPins) || {}, history: 역사 };
  } catch (e) { 결과 = { ok: false, error: String((e && e.stack) || e).slice(0, 4000) }; }
  결과.folders = 마무리();
  결과.seconds = Math.round((Date.now() - 시작) / 1000);
  fs.writeFileSync(결과파일, JSON.stringify(결과));
  process.exitCode = 결과.ok ? 0 : 1;
}

/** ③ 자식: 판 deployment/ 안에 없는 JS 아닌 파일만 「있는 빈 파일」로 보는 덧씌움(QA원천 머리말)을 건 뒤 추적 훅을 걸고 판의 sources()를 돌린다. */
function QA원천자식([임시, 결과파일, esm로그, qa, 판]) {
  const { fileURLToPath } = require('node:url'), 원래있음 = fs.existsSync, 봐줌 = new Map(), 배포곳 = path.join(판, 'deployment'); // 봐준 경로 → 인코딩 없는 읽기 수
  const 봐줄것 = (p) => {
    try {
      if (p instanceof URL) p = fileURLToPath(p);
      if (Buffer.isBuffer(p)) p = p.toString();
      if (typeof p !== 'string' || !안쪽(배포곳, p) || /\.[cm]?js$/i.test(p) || 원래있음.call(fs, p)) return null;
      return path.resolve(p);
    } catch { return null; }
  };
  const 빈파일 = Object.freeze({ isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false, size: 0 });
  for (const 이름 of ['lstatSync', 'statSync']) {
    const 원래 = fs[이름];
    fs[이름] = function (p, ...나머지) { const q = 봐줄것(p); if (q) { if (!봐줌.has(q)) 봐줌.set(q, 0); return 빈파일; } return 원래.call(this, p, ...나머지); };
  }
  // 인코딩 없이 읽는 것(해시·base64)만 빈 내용이다 — 글로 읽어 내용을 쓰려 하면 그대로 없음(실패)이다.
  const 원래읽기 = fs.readFileSync;
  fs.readFileSync = function (p, 옵션, ...나머지) {
    const q = 봐줄것(p), 글로 = typeof 옵션 === 'string' || Boolean(옵션 && 옵션.encoding);
    if (q && !글로) { 봐줌.set(q, (봐줌.get(q) || 0) + 1); return Buffer.alloc(0); }
    return 원래읽기.call(this, p, 옵션, ...나머지);
  };
  const 마무리 = 추적걸기(임시, esm로그);
  let 결과;
  try {
    const 원천 = require(qa).sources();
    if (!Array.isArray(원천)) throw new Error('QA_SOURCES_NOT_A_LIST');
    const 이름들 = 원천.map((r) => r && r.name).filter((x) => typeof x === 'string');
    // 봐준 파일은 잎이어야 한다 — 원천 이름은 저장소 뿌리(.tmp의 부모) 기준이다(판 linux-qa.cjs의 repo).
    const 뿌리 = path.dirname(임시), 목록 = new Set(이름들.map((n) => path.resolve(뿌리, n).toLowerCase()));
    for (const [p, 읽음] of 봐줌) {
      const 있음 = 목록.has(p.toLowerCase());
      if (읽음 > 1 || !있음) throw new Error(`QA_TOLERATED_NOT_A_LEAF ${path.relative(판, p).split(path.sep).join('/')} (인코딩 없는 읽기 ${읽음}회 · 원천 목록에 ${있음 ? '있음' : '없음'})`);
    }
    결과 = { ok: true, files: 원천.length, names: 이름들.sort(), tolerated: [...봐줌.keys()].map((p) => path.relative(판, p).split(path.sep).join('/')).sort() };
  } catch (e) { 결과 = { ok: false, error: String((e && e.stack) || e).slice(0, 4000) }; }
  결과.folders = 마무리();
  fs.writeFileSync(결과파일, JSON.stringify(결과));
  process.exitCode = 결과.ok ? 0 : 1;
}

/**
 * ①′ 재무장 입력 그래프 — 판 rearm-ops/rearm-prepare-fresh.cjs의 guards().graph()·approvalPins()처럼 JSON 속 (경로, SHA) 핀을 따라 읽는 파일을 잰다(읽기만).
 * 뿌리: 부모 핀(승인·계약·사후 확인), 판 candidate-validation.json, 판 rearm/에 이미 있으면 승인 입력·fresh-static(그 핀은 맨 위로)·owner·natural·snapshot,
 * 그리고 ① 결과의 inputPins. 봉인된 부모 설계면 안쪽 걷기에서 봉인 역사 H(①이 그 판 코드로 잰 것)를 따라가지 않는다 — 판 코드와 같은 규칙.
 * 10-30: ①만 재던 판은 이 걷기만 닿는 3곳(company-completed-c2431857-20261027 · backend-boundaries-20261027 · sns-simple-fix-37-carry-20261029)을 놓쳤다.
 * 저장소 밖 경로(Codex 작업트리 거울)는 세기만 한다 — 그 거울 폴더는 rearm-prepare-fresh.cjs의 글자로 정적 닫힘에 든다. 유닉스 경로(캡슐 속)는 판 코드처럼 건너뛴다.
 */
function 입력그래프({ 임시, 판, 부모핀 = [], inputPins = {}, 역사 = null, 덮는열쇠 = new Set() }) {
  const 뿌리 = path.dirname(임시), 본 = new Map(), 걸음 = new Set(), 없음 = [], 바뀜 = [];
  const 역사안 = 역사 ? new Set(역사) : null, 열쇠 = (p, d) => path.resolve(p).toLowerCase() + '|' + d;
  const 핀꼴 = (v) => Boolean(v) && typeof v.path === 'string' && /^[a-f0-9]{64}$/.test(v.sha256 || '') && path.isAbsolute(v.path);
  // 맨 위에서 직접 읽는 핀은 상대 경로도 받는다 — 판의 evidence()·capture()가 작업 폴더(저장소 뿌리) 기준으로 푼다(676 게이트 증거가 .tmp/… 상대 경로).
  const 맨위핀꼴 = (v) => Boolean(v) && typeof v.path === 'string' && v.path.length > 0 && /^[a-f0-9]{64}$/.test(v.sha256 || '');
  const 풀기 = (p) => (path.isAbsolute(p) ? path.resolve(p) : path.resolve(뿌리, p));
  let 밖 = 0, 건너뜀 = 0;
  function 잡기(ref, json) {
    const p = 풀기(ref.path);
    if (!안쪽(뿌리, p)) { 밖++; return null; }
    let raw; try { raw = fs.readFileSync(p); } catch { 없음.push(p); return null; }
    if (sha(raw) !== ref.sha256) 바뀜.push(p);
    본.set(p, raw.length);
    if (!json) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function 걷기(ref) {
    const p = 풀기(ref.path), 값 = 잡기(ref, true);
    if (값 === null || 걸음.has(p)) return;
    걸음.add(p);
    (function 안(v) {
      if (!v || typeof v !== 'object') return;
      if (핀꼴(v)) {
        if (역사안 && 역사안.has(열쇠(v.path, v.sha256))) { 건너뜀++; return; }
        if (!/^\/(?!\/)/.test(v.path)) { if (/\.json$/i.test(v.path)) 걷기(v); else 잡기(v, false); }
      }
      for (const x of Object.values(v)) if (x && typeof x === 'object') 안(x);
    })(값);
  }
  const 파일핀 = (p) => ({ path: p, sha256: sha(fs.readFileSync(p)) });
  // 정적 입력(fresh-static-inputs)의 핀은 재무장이 맨 위에서 직접 읽는다 — parentDrBundle의 record()·prepareFresh의 g.graph(initial[k]).
  const 정적입력 = (ref) => { const 값 = 잡기(ref, true); if (값 && typeof 값 === 'object') for (const v of Object.values(값)) if (맨위핀꼴(v)) (/\.json$/i.test(v.path) ? 걷기(v) : 잡기(v, false)); };
  for (const ref of 부모핀) 걷기(ref);
  const 요약 = path.join(판, 'candidate-validation.json');
  if (fs.existsSync(요약)) 걷기(파일핀(요약));
  // prepare-arm 첫 단계 parentDrBundle: 판 rearm-operations.cjs가 고정한 앞 판 정적 입력(PARENT_STATIC)과 그 DR 묶음·승인 입력을 읽는다.
  // 연습 묶음이 앞 판 것보다 새롭지 않으면 그 경로를 그대로 물려받아 여러 판 앞 폴더일 수 있다(10-30 Fable P1-1 — 37 · 36의 묶음은 teacher-copy-23).
  const 운영 = path.join(판, 'rearm-ops', 'rearm-operations.cjs');
  if (fs.existsSync(운영)) {
    const m = /\bPARENT_STATIC\s*=\s*Object\.freeze\(\{\s*path\s*:\s*path\.resolve\(\s*__dirname\s*,\s*(['"])([^'"]+)\1\s*\)\s*,\s*sha256\s*:\s*(['"])([a-f0-9]{64})\3/.exec(fs.readFileSync(운영, 'utf8'));
    if (m) 정적입력({ path: path.resolve(path.dirname(운영), m[2]), sha256: m[4] });
  }
  const 재무장 = path.join(판, 'rearm');
  if (fs.existsSync(재무장)) {
    for (const n of fs.readdirSync(재무장).sort()) {
      const p = path.join(재무장, n);
      if (/^fresh-static-inputs-final-v\d+\.json$/.test(n)) 정적입력(파일핀(p));
      else if (/^(?:approval-input|owner-final|natural-final|snapshot-final)-v\d+\.json$/.test(n)) 걷기(파일핀(p));
    }
  }
  // ①이 돌려준 것은 부모 결과라, 그 inputPins 가운데 판 승인 모듈이 자기 값으로 덮는 열쇠(previousApproval 등 — 그 판 approval.cjs의
  // inputPins={...a.inputPins,…}에서 읽음)는 걷지 않는다. 그 자리의 판 값은 부모 핀·후보 요약·판 승인 입력 뿌리로 이미 걷는다.
  // 안 그러면 부모의 previousApproval(조부모 봉인 입력)을 맨 위에서 걸어 옛 사슬로 내려간다(10-30 리허설 실측).
  const 맨위 = (v) => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.path === 'string' && /^[a-f0-9]{64}$/.test(v.sha256 || '')) { if (맨위핀꼴(v)) (/\.json$/i.test(v.path) ? 걷기(v) : 잡기(v, false)); return; }
    for (const x of Object.values(v)) 맨위(x);
  };
  for (const [k, v] of Object.entries(inputPins || {})) if (!덮는열쇠.has(k)) 맨위(v);
  // buildReview: 676 무장의 게이트 증거를 맨 위에서 하나씩 읽는다(evidence(row)) — 봉인 역사여도(리허설 실측: pulse-portfolio-server-audit-20261012 등).
  if (맨위핀꼴(inputPins.finalArm676)) {
    const 무장 = 잡기(inputPins.finalArm676, true), 게이트 = 무장 && 무장.acceptance && 무장.acceptance._operatorEvidence && 무장.acceptance._operatorEvidence.gates;
    if (게이트 && typeof 게이트 === 'object') for (const g of Object.values(게이트)) for (const row of (g && g.evidence) || []) if (맨위핀꼴(row)) 잡기(row, false);
  }
  // prepareApproval: 재무장 Linux QA 결과에 적힌 원천 파일을 하나씩 잡는다(QA 뒤에 잴 때). QA 전 몫은 ③(QA원천 — 판 자신의 sources())이 잰다.
  if (fs.existsSync(재무장)) {
    const HA = 'docs/마케팅/온라인마케팅지도/engagement/company/deploy/ha/';
    for (const n of fs.readdirSync(재무장).filter((x) => /^linux-qa-result-v\d+\.json$/.test(x)).sort()) {
      let qa; try { qa = JSON.parse(fs.readFileSync(path.join(재무장, n), 'utf8')); } catch { continue; }
      for (const f of (qa && Array.isArray(qa.files) ? qa.files : [])) {
        if (!f || typeof f.name !== 'string' || !/^[a-f0-9]{64}$/.test(f.sha256 || '') || path.isAbsolute(f.name) || f.name.split(/[\\/]/).includes('..')) continue;
        잡기({ path: f.name.startsWith(HA) ? path.join(판, 'ha-runtime-deployed', f.name.slice(HA.length)) : path.resolve(뿌리, f.name), sha256: f.sha256 }, false);
      }
    }
  }
  const 폴더 = {};
  for (const p of 본.keys()) { const 이름 = 안의폴더(임시, p); if (이름) 폴더[이름] = (폴더[이름] || 0) + 1; }
  for (const p of 없음) { const 이름 = 안의폴더(임시, p); if (이름 && !(이름 in 폴더)) 폴더[이름] = 0; }
  return { folders: Object.fromEntries(Object.entries(폴더).sort((x, y) => x[0].localeCompare(y[0]))), files: 본.size, bytes: [...본.values()].reduce((s, n) => s + n, 0), outside: 밖, skippedHistory: 건너뜀, missing: 없음, changed: 바뀜 };
}

/**
 * 코드 읽기 — 주석·문자열·템플릿·정규식 리터럴을 가려 읽는 작은 토크나이저. 정규식으로 코드를 흉내 내면 공백·주석·문자열 속
 * 가짜 require( 에 속았다(GPT 10-30 r4 — `require( 'fs')`를 로더로, `require (x)`를 못 봄). 저장소에 파서가 설치돼 있지 않아 직접 둔다.
 * 돌려주는 것: 글자들(문자열 값·템플릿 고정 조각), 부름들(require·require.resolve·import()·import/export … from의 인자 — 글자면 값,
 * 계산이면 null), 이름들(코드 속 식별자). 파이썬은 주석(#)·문자열(접두어·세 겹 따옴표)만 가려 글자들과 이름들을 낸다.
 */
function 코드읽기(글, 파이썬 = false) {
  const 글자들 = [], 부름들 = [], 이름들 = new Set(), 토큰 = [], n = 글.length;
  const 풀이 = (c) => ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[c] ?? c);
  const 식별자시작 = /[A-Za-z_$\u0080-￿]/, 식별자글자 = /[\w$\u0080-￿]/;
  let i = 0;
  if (파이썬) {
    while (i < n) {
      const c = 글[i];
      if (c === '#') { const e = 글.indexOf('\n', i); i = e < 0 ? n : e; continue; }
      const m = /^([rRbBfFuU]{0,2})('''|"""|'|")/.exec(글.slice(i, i + 5));
      if (m && !(i > 0 && 식별자글자.test(글[i - 1]))) {
        const 날것 = /[rR]/.test(m[1]), 닫음 = m[2];
        let v = '';
        i += m[0].length;
        while (i < n && !글.startsWith(닫음, i)) {
          if (닫음.length === 1 && 글[i] === '\n') break;
          // raw 문자열도 \" 는 닫지 않는다(두 글자 그대로 남는다 — r5·r6 GA4/GA3).
          if (글[i] === '\\') { v += 날것 ? 글[i] + (글[i + 1] ?? '') : 풀이(글[i + 1]); i += 2; continue; }
          v += 글[i++];
        }
        i += 닫음.length;
        글자들.push(v);
        continue;
      }
      if (식별자시작.test(c)) { let j = i + 1; while (j < n && 식별자글자.test(글[j])) j++; 이름들.add(글.slice(i, j)); i = j; continue; }
      i++;
    }
    return { 글자들, 부름들, 이름들 };
  }
  const 정규식앞말 = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
  const 정규식앞기호 = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  // 괄호 짝 — if·while·for·with의 조건을 닫는 ) 뒤의 / 는 정규식이다(`if (x) /'/.test(s)` — r5·r6 GA1).
  const 괄호들 = [];
  // 깊이: 템플릿 ${ … } 안을 읽을 때 짝 없는 } 를 만나면 돌아간다.
  function 읽기(템플릿안) {
    let 깊이 = 0;
    while (i < n) {
      const c = 글[i];
      if (c === '/' && 글[i + 1] === '/') { const e = 글.indexOf('\n', i); i = e < 0 ? n : e; continue; }
      if (c === '/' && 글[i + 1] === '*') { const e = 글.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"' || c === "'") {
        let v = ''; i++;
        while (i < n && 글[i] !== c && 글[i] !== '\n') { if (글[i] === '\\') { v += 풀이(글[i + 1]); i += 2; continue; } v += 글[i++]; }
        i++; 글자들.push(v); 토큰.push({ t: '글', v }); continue;
      }
      if (c === '`') {
        const 표 = { t: '틀', v: '', 식: 0 }; 토큰.push(표); i++;
        // 풀이한 값과 이스케이프를 풀지 않은 원문을 둘 다 글자로 낸다 — String.raw`C:\work\.tmp\…`는 원문이 경로다(r5 GA3·r6 GA2).
        let v = '', 원문 = '';
        const 조각끝 = () => { 글자들.push(v, 원문); 표.v += v; v = ''; 원문 = ''; };
        while (i < n && 글[i] !== '`') {
          if (글[i] === '\\') { v += 풀이(글[i + 1]); 원문 += 글[i] + (글[i + 1] ?? ''); i += 2; continue; }
          // ${…}가 끝나면 경계를 둔다 — `${require}${(T)}`의 두 식 토큰이 이어져 require(T)로 읽히지 않게(r5 GA2).
          if (글[i] === '$' && 글[i + 1] === '{') { 조각끝(); 표.식++; i += 2; 읽기(true); 토큰.push({ t: '경계' }); continue; }
          원문 += 글[i]; v += 글[i++];
        }
        i++; 조각끝(); continue;
      }
      if (식별자시작.test(c)) { let j = i + 1; while (j < n && 식별자글자.test(글[j])) j++; const v = 글.slice(i, j); 이름들.add(v); 토큰.push({ t: '이름', v }); i = j; continue; }
      if (/[0-9]/.test(c)) { let j = i + 1; while (j < n && /[\w.]/.test(글[j])) j++; 토큰.push({ t: '수' }); i = j; continue; }
      if (c === '/') {
        const 앞 = 토큰[토큰.length - 1];
        if (!앞 || (앞.t === '기호' && (정규식앞기호.has(앞.v) || 앞.제어)) || (앞.t === '이름' && 정규식앞말.has(앞.v))) {
          let j = i + 1, 묶음안 = false;
          while (j < n && 글[j] !== '\n' && (묶음안 || 글[j] !== '/')) { if (글[j] === '\\') j++; else if (글[j] === '[') 묶음안 = true; else if (글[j] === ']') 묶음안 = false; j++; }
          j++; while (j < n && /[a-z]/i.test(글[j])) j++;
          토큰.push({ t: '정규식' }); i = j; continue;
        }
      }
      if (템플릿안 && c === '{') 깊이++;
      if (템플릿안 && c === '}') { if (깊이 === 0) { i++; return; } 깊이--; }
      const 기호 = { t: '기호', v: c };
      // 속성 이름(api.if(…))은 제어문이 아니다(r7).
      if (c === '(') { const 앞 = 토큰[토큰.length - 1], 앞앞 = 토큰[토큰.length - 2]; 괄호들.push(Boolean(앞 && 앞.t === '이름' && ['if', 'while', 'for', 'with'].includes(앞.v) && !(앞앞 && 앞앞.t === '기호' && 앞앞.v === '.'))); }
      if (c === ')' && 괄호들.pop()) 기호.제어 = true;
      토큰.push(기호); i++;
    }
  }
  읽기(false);
  const 글자인자 = (k) => {
    const a = 토큰[k], b = 토큰[k + 1];
    if (a && (a.t === '글' || (a.t === '틀' && a.식 === 0)) && b && b.t === '기호' && (b.v === ')' || b.v === ',')) return a.v;
    return null;
  };
  for (let k = 0; k < 토큰.length; k++) {
    const x = 토큰[k], 앞 = 토큰[k - 1];
    if (x.t !== '이름') continue;
    const 속성 = 앞 && 앞.t === '기호' && 앞.v === '.';
    if (x.v === 'require' && !속성) {
      let m = k + 1;
      if (토큰[m] && 토큰[m].t === '기호' && 토큰[m].v === '.' && 토큰[m + 1] && 토큰[m + 1].v === 'resolve') m += 2;
      if (토큰[m] && 토큰[m].t === '기호' && 토큰[m].v === '(') 부름들.push({ 값: 글자인자(m + 1) });
    } else if (x.v === 'import' && !속성) {
      const 다음 = 토큰[k + 1];
      if (다음 && 다음.t === '기호' && 다음.v === '(') 부름들.push({ 값: 글자인자(k + 2) });
      else if (다음 && 다음.t === '글') 부름들.push({ 값: 다음.v });
    } else if (x.v === 'from' && 토큰[k + 1] && 토큰[k + 1].t === '글') 부름들.push({ 값: 토큰[k + 1].v }); // from 뒤에 바로 글자가 오는 것은 import/export … from뿐이다
  }
  return { 글자들, 부름들, 이름들 };
}

/**
 * 글자 그대로 훑기 — 앞 판의 정규식 추출. 토크나이저와 서로 다른 데서 틀린다(토크나이저는 정규식/나눗셈 갈림·raw 문자열에서,
 * 이것은 괄호 앞 공백·주석 속 글자에서). 정적 닫힘은 둘의 합집합을 쓴다 — 놓치면 쓰는 폴더가 정리되고, 넓게 잡으면 공간만 덜 빈다.
 */
function 글자훑기(글) {
  const 글자들 = [], 부름들 = [];
  for (const m of 글.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) 글자들.push(m[2].replace(/\\\\/g, '\\'));
  for (const m of 글.matchAll(/(?:require(?:\.resolve)?\s*\(\s*|from\s+|import\s*\(\s*|import\s+)(['"])([^'"]+)\1/g)) 부름들.push({ 값: m[2] });
  const 로더 = /(?<![.\w$])(?:require|import)\s*\(\s*(?![\s'"`])/.test(글);
  const 목록돎 = /\b(?:readdir(?:Sync)?|opendir(?:Sync)?|r?glob|iterdir|listdir|scandir|walk)\s*\(/.test(글);
  return { 글자들, 부름들, 로더, 목록돎 };
}

/** 폴더 아래 코드 파일 전부(큰 사본 폴더·링크는 건너뜀). */
function 코드들(폴더, 모음 = []) {
  for (const e of fs.readdirSync(폴더, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const p = path.join(폴더, e.name);
    if (e.isDirectory()) { if (!건너뛸폴더.has(e.name)) 코드들(p, 모음); }
    else if (코드확장자.has(path.extname(e.name))) 모음.push(p);
  }
  return 모음;
}

/**
 * ② 정적 코드 닫힘: 판 코드에서 시작해 다른 .tmp 폴더의 코드로 require·import·경로 글자를 따라간다. 넓게 잡는 쪽이 안전하다.
 * 글자가 폴더를 가리키면(HA=…/platform-ha-…, 그 안은 path.join(HA,'deployment','x.cjs')로 부름 — GPT 10-30 GA1) 그 아래 파일 중
 * 경로 조각이 모두 같은 파일의 글자로 적힌 것(마지막 조각은 확장자 없이도 · index.*는 폴더 이름만)을 따라가고, 그 파일이 readdir·glob로
 * 목록을 돌면 하위 폴더 바로 아래 코드도, 계산한 경로로 코드를 부르는 로더면 맨 위 폴더 바로 아래 코드도 읽는다.
 * 한계: 글자로 안 적힌 이름(설정 json에서 읽은 파일 이름 등)으로 부르는 코드는 못 본다 — 그 길은 ① 재검증 추적이 탄 만큼만 덮인다.
 * 폴더 아래를 통째로 펼치면 판마다의 candidate·큰 작업 폴더를 타고 .tmp 전체(39만 파일)로 번졌다(10-30 r2 판).
 */
function 정적닫힘({ 임시, 판 }) {
  const 이름들 = new Set(fs.readdirSync(임시, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name));
  const 판이름 = path.basename(판), 본파일 = new Set(), 쌓기 = [], 폴더 = new Set(), 폴더코드 = new Map();
  const 넣기 = (p) => { const k = path.resolve(p).toLowerCase(); if (!본파일.has(k)) { 본파일.add(k); 쌓기.push(path.resolve(p)); } };
  const 아래코드 = (d) => { const k = path.resolve(d).toLowerCase(); if (!폴더코드.has(k)) 폴더코드.set(k, 코드들(d)); return 폴더코드.get(k); };
  for (const p of 코드들(판)) 넣기(p);
  const 있는파일 = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  const 목록이름 = ['readdir', 'readdirSync', 'opendir', 'opendirSync', 'glob', 'rglob', 'iterdir', 'listdir', 'scandir', 'walk'];
  while (쌓기.length) {
    const 파일 = 쌓기.pop();
    let 글; try { 글 = fs.readFileSync(파일, 'utf8'); } catch { continue; }
    const 곳 = path.dirname(파일);
    // generators/ 아래 생성기는 앞 판 원천을 글자로 읽어 옮길 뿐 실행하지 않는다(실행하는 것은 저장소 도구·그 판 자신·다른 판을 부르지 않는
    // company-ha-runtime-snapshot-layer 하나). 그래서 가리키는 폴더 이름만 계보에 넣고 그 폴더의 코드로 따라 들어가지 않는다 — 안 그러면
    // 사슬 39 생성기가 38 rearm/approval.cjs를 글자로 적는 것만으로 옛 승인 사슬 전체가 다시 들어온다(10-30 봉인된 부모 설계).
    const 이름만 = (안쪽(임시, 파일) || '').split(path.sep).includes('generators');
    // 토크나이저와 글자 그대로 훑기의 합집합(위 글자훑기 머리말) — 둘 다 놓쳐야 빠진다.
    const 파이썬 = path.extname(파일) === '.py', 읽음 = 코드읽기(글, 파이썬), 훑음 = 글자훑기(글);
    const 모든글자 = [...읽음.글자들, ...훑음.글자들];
    const 모든부름 = [...읽음.부름들, ...(파이썬 ? [] : 훑음.부름들)];
    const 낱말 = new Set();
    for (const s of 모든글자) for (const x of s.split(/[\\/]+/)) if (x) 낱말.add(x);
    const 목록돎 = 목록이름.some((x) => 읽음.이름들.has(x)) || 훑음.목록돎;
    // 계산한 경로로 코드를 부르는 JS(로더) — require(변수)·require(path.join(…))·import(pathToFileURL(…)) 따위(r3b GA2).
    const 로더 = !파이썬 && (읽음.부름들.some((b) => b.값 === null) || 훑음.로더);
    // 경로 조각이 이 파일의 글자로 적혔는가 — 마지막 조각은 확장자 없이 적어도 되고(require(join(D,'reader'))), index.*는 폴더 이름만 적어도 된다(r3b GA1).
    const 글자로적힘 = (조각들) => {
      const 끝 = 조각들[조각들.length - 1], 앞 = 조각들.slice(0, -1);
      if (!앞.every((c) => 낱말.has(c))) return false;
      return 낱말.has(끝) || 낱말.has(끝.replace(/\.(?:c|m)?js$/, '')) || (/^index\.(?:c|m)?js$/.test(끝) && 앞.length > 0);
    };
    for (const b of 모든부름) {
      if (!b.값 || !/^\.{1,2}[\\/]/.test(b.값)) continue;
      const 대상 = path.resolve(곳, b.값);
      const 맞음 = [대상, 대상 + '.js', 대상 + '.cjs', 대상 + '.mjs', path.join(대상, 'index.js')].find(있는파일);
      // .tmp/<폴더>/<…> 꼴이면 그 폴더가 없어도 이름을 남긴다 — 정리 대기로 옮겨진 도우미를 「.tmp에 없는 이름」으로 알린다(r2 GA1).
      // .tmp 맨 위 파일 하나(.tmp/x.cjs — 문자열 표 속 '../x.cjs' 따위)는 폴더가 아니다.
      const 상대 = 안쪽(임시, 대상), n = 상대 && 상대.split(path.sep).length > 1 ? 상대.split(path.sep)[0] : null;
      if (n && n !== 판이름) 폴더.add(n);
      // .tmp 안이면 판 안의 건너뛴 폴더(qa/ 등)로 가는 require도 따라간다(GA2). 저장소 쪽(.tmp 밖)은 공개 저장소 코드라 따라가지 않는다.
      if (맞음 && 안의폴더(임시, 맞음) && !이름만) 넣기(맞음);
    }
    for (const s of 모든글자) {
      const 조각 = s.split(/[\\/]+/);
      for (let i = 0; i < 조각.length; i++) {
        const n = 조각[i];
        if (!이름들.has(n) || n === 판이름) continue;
        // 경로 구분자 없는 낱말은 날짜 붙은 폴더 이름일 때만 경로로 본다(「recovery」 같은 낱말을 걸러 낸다).
        if (조각.length === 1 && !/20\d{6}/.test(n)) break;
        // 이름 뒤 조각은 「..」 앞에서 끊는다 — 대상이 늘 그 폴더 안에 머문다(올라가면 .tmp 자체를 가리켰다).
        const 뒤 = [];
        for (const x of 조각.slice(i + 1)) { if (x === '..') break; if (x && x !== '.') 뒤.push(x); }
        let 대상 = path.join(임시, n, ...뒤);
        while (!fs.existsSync(대상) && !같은경로(대상, path.join(임시, n))) 대상 = path.dirname(대상);
        폴더.add(n);
        if (이름만) break;
        if (있는파일(대상)) { if (코드확장자.has(path.extname(대상))) 넣기(대상); }
        // 폴더를 가리키면 그 아래에서 경로 조각이 모두 이 파일의 글자인 코드, 목록을 돌면 바로 아래 코드도(제품 사본 폴더 안으로는 펼치지 않는다).
        else if (fs.existsSync(대상) && !안쪽(임시, 대상).split(path.sep).some((c) => 건너뛸폴더.has(c))) {
          for (const p of 아래코드(대상)) {
            const 조각들 = path.relative(대상, p).split(path.sep);
            // 목록 돌기는 그 파일이 로더이거나 하위 폴더(…/runtime-deployment 등)일 때만 바로 아래 코드를 읽는다 — 로더가 아닌 파일의 맨 위
            // 목록 돌기(scope.cjs의 후보 트리 훑기)까지 펼치면 옛 판 맨 위 생성기가 끌려와 출처 언급뿐인 후보 작업 폴더 120곳이 더해졌다(68 → 185곳).
            const 바로아래 = 조각들.length === 1 && 목록돎 && (로더 || 안쪽(임시, 대상).split(path.sep).length > 1);
            if (글자로적힘(조각들) || 바로아래) 넣기(p);
          }
        }
        break;
      }
    }
  }
  return 폴더;
}

/** 판 승인 모듈이 부모 결과의 inputPins에서 자기 값으로 덮는(또는 지우는) 열쇠 — `inputPins={...a.inputPins,k:…}` · `delete inputPins.k`. 못 찾으면 빈 집합(덜 빼는 쪽). */
function 덮는열쇠(판) {
  let 글 = ''; try { 글 = fs.readFileSync(path.join(판, 'rearm', 'approval.cjs'), 'utf8'); } catch { return new Set(); }
  const 열쇠 = new Set();
  for (const m of 글.matchAll(/\binputPins\s*=\s*\{\s*\.\.\.a\.inputPins\s*,([^}]*)\}/g)) for (const x of m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)) 열쇠.add(x[1]);
  for (const m of 글.matchAll(/\bdelete\s+inputPins\.([A-Za-z_$][\w$]*)/g)) 열쇠.add(m[1]);
  return 열쇠;
}

/** 판 하나의 계보를 잰다 — ①+①′+②+③ 합집합과 각 몫. 정리대기를 주면 .tmp에 없는 이름 가운데 거기 있는 것을 알린다(있는지만 본다). */
function 재기(판, 옵션 = {}) {
  판 = path.resolve(판);
  const 임시 = path.dirname(판), 부모 = 부모찾기(판);
  const 재검증 = 재검증추적({ 임시, 모듈: 부모.모듈, 승인입력: 부모.승인입력, 방식: 부모.방식, 시한: 옵션.시한 });
  const 그래프 = 입력그래프({ 임시, 판, 부모핀: 부모.부모핀, inputPins: 재검증.inputPins, 역사: 재검증.history, 덮는열쇠: 덮는열쇠(판) });
  const 정적 = [...정적닫힘({ 임시, 판 })].sort();
  const qa = QA원천({ 임시, 판, 시한: 옵션.시한 }), qa폴더 = qa ? Object.keys(qa.folders) : [];
  const 있음 = (n) => fs.existsSync(path.join(임시, n));
  const 묶음 = new Set([path.basename(판), ...[안의폴더(임시, 부모.승인입력)].filter(Boolean), ...Object.keys(재검증.folders), ...Object.keys(그래프.folders), ...정적, ...qa폴더]);
  const 없음 = [...묶음].filter((n) => !있음(n)).sort();
  return {
    schema: 'synk-company-lineage/v2', release: path.basename(판), design: 부모.방식, parentModule: 부모.모듈, approvalInput: 부모.승인입력,
    seconds: 재검증.seconds, chainLength: 재검증.chainLength,
    folders: [...묶음].filter(있음).sort(), recheck: 재검증.folders,
    inputGraph: { folders: 그래프.folders, files: 그래프.files, bytes: 그래프.bytes, outside: 그래프.outside, skippedHistory: 그래프.skippedHistory, missing: 그래프.missing, changed: 그래프.changed },
    static: 정적,
    // outsideStatic: ③만 닿은 폴더(②가 글자로 못 본 것 — 자료 json에서 읽은 경로 따위). 계보에는 이미 든다.
    qaSources: qa && { folders: qa.folders, files: qa.files, tolerated: qa.tolerated, outsideStatic: qa폴더.filter((n) => n !== path.basename(판) && !정적.includes(n)).sort(), qaResult: QA결과대조(판, qa.names) },
    missing: 없음,
    missingInStaging: 옵션.정리대기 ? 없음.filter((n) => fs.existsSync(path.join(옵션.정리대기, n))) : [],
  };
}

/**
 * 「#! 실측 계보」 절. 여러 판을 주면 합집합이다 — 절은 지금 운영 판(마지막으로 무장한 판, 다시 무장해야 할 수 있다)과 준비 중인 판의 계보를 함께 남긴다
 * (10-30 Fable P1-2: 39가 만들어졌어도 39가 무장하기 전까지는 38 재무장 길이 살아 있다).
 */
function 절로(결과들, 날 = new Date()) {
  const 목록 = Array.isArray(결과들) ? 결과들 : [결과들];
  const 오늘 = `${날.getFullYear()}-${String(날.getMonth() + 1).padStart(2, '0')}-${String(날.getDate()).padStart(2, '0')}`;
  const 한판 = (결과) => {
    const 그래프 = 결과.inputGraph ? ` · 입력 그래프 ${Object.keys(결과.inputGraph.folders).length}곳` : '';
    // QA 전이거나 봐준 파일이 있으면 그 판 몫이 임시임을 절 머리에 남긴다 — stdout 안내는 _정리제외.txt에 붙이면 사라진다(Fable 10-30 P2 · P3).
    const q = 결과.qaSources, 대조 = q && q.qaResult;
    const 임시표시 = !q ? '' : [
      ...(!대조 ? ['QA 전'] : []), ...(q.tolerated.length ? [`봐줌 ${q.tolerated.length}(${q.tolerated.join(', ')})`] : []),
      ...(대조 && 대조.invalid ? ['QA 결과 꼴 아님'] : []), ...(대조 && 대조.missing.length ? [`QA 결과에만 ${대조.missing.length}`] : []),
    ].map((x) => ` · ${x}`).join('');
    const qa = q ? ` · QA 원천 ${Object.keys(q.folders).length}곳${임시표시}` : '';
    return `.tmp/${결과.release} (${결과.design === 'sealed' ? '봉인된 부모 · ' : ''}재검증 ${Object.keys(결과.recheck).length}곳 ${결과.seconds}초${그래프} · 정적 ${결과.static.length}곳${qa})`;
  };
  const 폴더 = [...new Set(목록.flatMap((결과) => 결과.folders))].sort();
  return [`#! 실측 계보 시작 — node tools/company-release/lineage.cjs measure ${목록.map(한판).join(' + ')} (${오늘}${목록.length > 1 ? ` · 합집합 ${폴더.length}곳` : ''})`,
    ...폴더, '#! 실측 계보 끝'].join('\n');
}

module.exports = { 부모찾기, 재검증추적, 입력그래프, 코드읽기, 정적닫힘, QA원천, 재기, 절로 };

if (require.main === module) {
  const [명령, ...나머지] = process.argv.slice(2);
  if (명령 === '__추적') 추적자식(나머지);
  else if (명령 === '__QA원천') QA원천자식(나머지);
  else if (명령 === 'measure' && 나머지[0] && !나머지[0].startsWith('--')) {
    try {
      const 대기자리 = 나머지.indexOf('--정리대기'), j = 나머지.indexOf('--json');
      const 값자리 = new Set([대기자리, j].filter((i) => i >= 0).map((i) => i + 1));
      // 판 여러 개(지금 운영 판 · 준비 중인 판)를 주면 절은 합집합이다.
      const 판들 = 나머지.filter((x, i) => !x.startsWith('--') && !값자리.has(i));
      const 결과들 = 판들.map((판) => 재기(판, { 정리대기: 대기자리 >= 0 ? 나머지[대기자리 + 1] : '' }));
      if (j >= 0) fs.writeFileSync(나머지[j + 1], JSON.stringify(결과들.length === 1 ? 결과들[0] : 결과들, null, 1) + '\n', { flag: 'wx' });
      for (const 결과 of 결과들) {
        const g = 결과.inputGraph;
        const q = 결과.qaSources;
        console.log(`${결과.release}: 계보 ${결과.folders.length}곳${결과.design === 'sealed' ? '(봉인된 부모)' : ''} · 재검증 ${Object.keys(결과.recheck).length}곳(${결과.seconds}초, 사슬 ${결과.chainLength}) · 입력 그래프 ${Object.keys(g.folders).length}곳(${g.files}파일 ${(g.bytes / 1048576).toFixed(1)}MB${g.skippedHistory ? `, 봉인 역사 ${g.skippedHistory}곳 건너뜀` : ''}${g.outside ? `, 저장소 밖 ${g.outside}` : ''}) · 정적 ${결과.static.length}곳${q ? ` · QA 원천 ${Object.keys(q.folders).length}곳(${q.files}파일)` : ''}`);
        if (q && q.tolerated.length) console.log(`QA 원천: 배포 전이라 판 deployment/에 아직 없는 JS 아닌 파일 ${q.tolerated.length}개는 빈 파일로 셈(원천 목록의 잎 확인 — 판 폴더라 계보는 같다, 절 머리에 「봐줌」): ${q.tolerated.join(', ')}`);
        if (q && !q.qaResult) console.log(`QA 원천: ${결과.release}는 QA 전이라 실제 QA 결과와 대조하지 못했다 — QA를 마치면 다시 재서 대조한다(절 머리에 「QA 전」)`);
        if (q && q.outsideStatic.length) console.log(`QA 원천에만 닿은 폴더 ${q.outsideStatic.length}곳(정적 닫힘이 못 봄 — 계보에는 듦): ${q.outsideStatic.join(', ')}`);
        const 대조 = q && q.qaResult;
        if (대조 && 대조.invalid) { console.log(`QA 결과(${대조.result})가 원천 목록 꼴이 아니라 ③과 대조할 수 없다(QA를 다시 돌린다)`); process.exitCode = 1; }
        if (대조 && !대조.invalid && !대조.missing.length) console.log(`QA 결과(${대조.result})와 대조: QA가 보낸 원천 ${대조.names}개가 모두 ③에 있음${대조.extra ? ` · ③에만 ${대조.extra}개(QA 뒤 판에 더해진 원천)` : ''}`);
        // ③이 실제 QA가 보낸 원천을 못 찾으면 그 판 코드에서 ③을 믿을 수 없다(또는 QA가 낡았다 — prepare-arm이 멈출 자리) — 실패로 끝낸다.
        if (대조 && 대조.missing.length) { console.log(`QA 결과(${대조.result})에만 있는 원천 ${대조.missing.length}개(①′가 잡음 — QA 뒤 판 코드가 바뀌었으면 QA를 다시 돌린다): ${대조.missing.slice(0, 10).join(', ')}`); process.exitCode = 1; }
        // 재무장 입력 그래프의 핀 파일이 바뀌었거나 없으면 prepare-arm이 그 자리에서 멈춘다 — 실패로 끝낸다.
        if (g.changed.length) { console.log(`핀과 다른 입력 그래프 파일 ${g.changed.length}개: ${g.changed.slice(0, 10).join(', ')}`); process.exitCode = 1; }
        if (g.missing.length) { console.log(`없는 입력 그래프 파일 ${g.missing.length}개: ${g.missing.slice(0, 10).join(', ')}`); process.exitCode = 1; }
        // 재검증은 통과했어도 정적 참조나 입력 그래프가 가리키는 폴더가 .tmp에 없으면 원격 단계·재무장에서 멈출 수 있다 — 실패로 끝낸다.
        if (결과.missing.length) {
          console.log(`.tmp에 없는 계보 이름 ${결과.missing.length}곳: ${결과.missing.join(', ')}${결과.missingInStaging.length ? `\n그중 정리 대기에 있는 것(되돌린다): ${결과.missingInStaging.join(', ')}` : ''}`);
          process.exitCode = 1;
        }
      }
      if (나머지.includes('--절')) console.log(절로(결과들));
    } catch (e) { console.error(String((e && e.message) || e)); process.exitCode = 1; }
  } else { console.error('쓰기: node tools/company-release/lineage.cjs measure <판 폴더> [<판 폴더>…] [--정리대기 <폴더>] [--json <출력>] [--절]'); process.exitCode = 2; }
}
