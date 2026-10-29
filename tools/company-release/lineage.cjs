'use strict';
// 회사 릴리스 계보 실측 — 판 하나가 실제로 읽는 .tmp 폴더를 잰다. 읽기만 하고 원격·운영 동작은 없다.
// ① 부모 승인 재검증: 판의 재무장(prepare-arm)이 맨 먼저 하는 「부모 판 rearm/approval.cjs의 loadApproval(봉인된 부모 승인 입력)」을
//    읽기 추적과 함께 돌린다. 이 재검증은 승인 사슬을 끝까지 내려가며 판마다 candidate/ 전체와 승인 기록을 다시 확인한다
//    (10-30 실측: 37 판 기준 옛 폴더 57곳에서 각 1,100~2,300개 파일 · 2~6분). 실패하면 그 판의 재무장도 같은 자리에서 멈춘다.
// ② 정적 코드 닫힘: 판의 도구 코드가 require·import·경로 글자로 부르는 다른 .tmp 폴더를 코드만 따라 모은다(원격 단계 도구 포함).
// 둘을 합친 이름이 .tmp/_정리제외.txt 「#! 실측 계보」 절의 닫힌 목록이다(tools/tmp정리목록.js가 남기되 언급은 따라가지 않는다).
//
//   node tools/company-release/lineage.cjs measure <판 폴더> [--정리대기 <폴더>] [--json <출력>] [--절]
//
// 재검증이 .tmp만으로 통과하면 그 재검증은 정리 대기에서 아무것도 읽지 않는다 — 정리 대기를 지우기 전·운영 반영 전 확인으로 쓴다.
// 실패하면 오류의 경로가 빠진 자리다(되돌리고 다시 돌린다). --정리대기는 「.tmp에 없는 이름」 가운데 그 폴더에 있는 것을 알린다(있는지만 본다).
//
// 판 폴더에는 deployment/parent-arm-pin.json(봉인된 부모 승인 입력의 경로·SHA)과 rearm/approval.cjs(부모 판 승인 모듈을
// previous로 부름)가 있어야 한다 — 사슬 생성기(p<N>-operators·p<N>-rearm)가 만드는 꼴이다.
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

/** 판 폴더에서 부모 승인 모듈과 봉인된 부모 승인 입력을 찾는다. 입력 파일은 핀의 SHA와 같아야 한다. */
function 부모찾기(판) {
  const 핀 = JSON.parse(fs.readFileSync(path.join(판, 'deployment/parent-arm-pin.json'), 'utf8'));
  const 승인 = 핀 && 핀.approval;
  if (!승인 || typeof 승인.path !== 'string' || !/^[a-f0-9]{64}$/.test(승인.sha256 || '')) throw new Error('PARENT_ARM_PIN_APPROVAL_REQUIRED');
  if (sha(fs.readFileSync(승인.path)) !== 승인.sha256) throw new Error('PARENT_APPROVAL_INPUT_CHANGED ' + 승인.path);
  const 글 = fs.readFileSync(path.join(판, 'rearm/approval.cjs'), 'utf8');
  const 찾음 = [...글.matchAll(/\bprevious\s*=\s*require\((['"])([^'"]+)\1\)/g)];
  if (찾음.length !== 1) throw new Error('PARENT_APPROVAL_MODULE_REQUIRED');
  return { 모듈: path.resolve(판, 'rearm', 찾음[0][2]), 승인입력: path.resolve(승인.path) };
}

/** ① 부모 승인 재검증을 따로 띄운 node에서 읽기 추적과 함께 돌린다. */
function 재검증추적({ 임시, 모듈, 승인입력, 시한 = 30 * 60 * 1000 }) {
  const 방 = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'synk-lineage-'));
  try {
    const 결과파일 = path.join(방, 'result.json');
    const r = cp.spawnSync(process.execPath, [__filename, '__추적', 모듈, 승인입력, 임시, 결과파일, path.join(방, 'esm.log')],
      { cwd: path.dirname(임시), encoding: 'utf8', windowsHide: true, timeout: 시한, maxBuffer: 64 * 1024 * 1024 });
    let 결과 = null;
    try { 결과 = JSON.parse(fs.readFileSync(결과파일, 'utf8')); } catch {}
    if (!결과) throw new Error('LINEAGE_TRACE_NO_RESULT ' + (r.error ? r.error.message : '') + ' ' + String(r.stderr || '').slice(-2000));
    if (!결과.ok) throw new Error('PARENT_APPROVAL_RECHECK_FAILED ' + 결과.error);
    return 결과;
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
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

/** 추적 자식: fs·require·import가 건드린 경로를 모으며 부모 승인 재검증을 돌린다. 디스크·동작은 바꾸지 않는다. */
async function 추적자식([모듈, 승인입력, 임시, 결과파일, esm로그]) {
  const Module = require('node:module'), { fileURLToPath } = require('node:url');
  const 본 = new Map(), 시작 = Date.now(), 원래있음 = fs.existsSync;
  // 실제로 있는 경로만 센다 — 없는 자리를 있는지 물어본 것은 쓰는 폴더가 아니다.
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
  let 결과;
  try {
    const 승인 = await require(모듈).loadApproval(승인입력);
    결과 = { ok: true, chainLength: Array.isArray(승인 && 승인.deploymentChain) ? 승인.deploymentChain.length : null };
  } catch (e) { 결과 = { ok: false, error: String((e && e.stack) || e).slice(0, 4000) }; }
  try { for (const p of fs.readFileSync(esm로그, 'utf8').split(String.fromCharCode(10))) if (p) 적기(p); } catch {}
  결과.seconds = Math.round((Date.now() - 시작) / 1000);
  결과.folders = Object.fromEntries([...본].sort((a, b) => a[0].localeCompare(b[0])));
  fs.writeFileSync(결과파일, JSON.stringify(결과));
  process.exitCode = 결과.ok ? 0 : 1;
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
      if (맞음 && 안의폴더(임시, 맞음)) 넣기(맞음);
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

/** 판 하나의 계보를 잰다 — ①+② 합집합과 각 몫. 정리대기를 주면 .tmp에 없는 이름 가운데 거기 있는 것을 알린다(있는지만 본다). */
function 재기(판, 옵션 = {}) {
  판 = path.resolve(판);
  const 임시 = path.dirname(판), 부모 = 부모찾기(판);
  const 재검증 = 재검증추적({ 임시, 모듈: 부모.모듈, 승인입력: 부모.승인입력, 시한: 옵션.시한 });
  const 정적 = [...정적닫힘({ 임시, 판 })].sort();
  const 있음 = (n) => fs.existsSync(path.join(임시, n));
  const 묶음 = new Set([path.basename(판), ...[안의폴더(임시, 부모.승인입력)].filter(Boolean), ...Object.keys(재검증.folders), ...정적]);
  const 없음 = [...묶음].filter((n) => !있음(n)).sort();
  return {
    schema: 'synk-company-lineage/v1', release: path.basename(판), parentModule: 부모.모듈, approvalInput: 부모.승인입력,
    seconds: 재검증.seconds, chainLength: 재검증.chainLength,
    folders: [...묶음].filter(있음).sort(), recheck: 재검증.folders, static: 정적, missing: 없음,
    missingInStaging: 옵션.정리대기 ? 없음.filter((n) => fs.existsSync(path.join(옵션.정리대기, n))) : [],
  };
}

function 절로(결과, 날 = new Date()) {
  const 오늘 = `${날.getFullYear()}-${String(날.getMonth() + 1).padStart(2, '0')}-${String(날.getDate()).padStart(2, '0')}`;
  return [`#! 실측 계보 시작 — node tools/company-release/lineage.cjs measure .tmp/${결과.release} (${오늘} · 재검증 ${Object.keys(결과.recheck).length}곳 ${결과.seconds}초 · 정적 ${결과.static.length}곳)`,
    ...결과.folders, '#! 실측 계보 끝'].join('\n');
}

module.exports = { 부모찾기, 재검증추적, 코드읽기, 정적닫힘, 재기, 절로 };

if (require.main === module) {
  const [명령, ...나머지] = process.argv.slice(2);
  if (명령 === '__추적') 추적자식(나머지);
  else if (명령 === 'measure' && 나머지[0]) {
    try {
      const g = 나머지.indexOf('--정리대기');
      const 결과 = 재기(나머지[0], { 정리대기: g >= 0 ? 나머지[g + 1] : '' });
      const j = 나머지.indexOf('--json');
      if (j >= 0) fs.writeFileSync(나머지[j + 1], JSON.stringify(결과, null, 1) + '\n', { flag: 'wx' });
      console.log(`계보 ${결과.folders.length}곳 · 재검증 ${Object.keys(결과.recheck).length}곳(${결과.seconds}초, 사슬 ${결과.chainLength}) · 정적 ${결과.static.length}곳`);
      // 재검증은 통과했어도 정적 참조가 가리키는 폴더가 .tmp에 없으면 원격 단계에서 멈출 수 있다 — 실패로 끝낸다.
      if (결과.missing.length) {
        console.log(`.tmp에 없는 계보 이름 ${결과.missing.length}곳: ${결과.missing.join(', ')}${결과.missingInStaging.length ? `\n그중 정리 대기에 있는 것(되돌린다): ${결과.missingInStaging.join(', ')}` : ''}`);
        process.exitCode = 1;
      }
      if (나머지.includes('--절')) console.log(절로(결과));
    } catch (e) { console.error(String((e && e.message) || e)); process.exitCode = 1; }
  } else { console.error('쓰기: node tools/company-release/lineage.cjs measure <판 폴더> [--정리대기 <폴더>] [--json <출력>] [--절]'); process.exitCode = 2; }
}
