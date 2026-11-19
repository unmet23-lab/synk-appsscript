#!/usr/bin/env node
'use strict';
/* 관련시험 — push 전에 바꾼 경로를 실제로 읽는 시험만 골라 돌린다 (2026-10-21). 바로올리기가 --실행 때 부른다.
 *
 *   node tools/관련시험.js <경로…>                       고른 시험과 까닭만 보인다
 *   node tools/관련시험.js <경로…> --돌리기              고른 시험을 돌린다(하나라도 깨지면 종료 1)
 *   node tools/관련시험.js 지도 --trace <기록 폴더> --out <파일>   읽기 기록으로 지도를 만든다(syntax-check.yml이 run마다)
 *   node tools/관련시험.js 지도받기                      최신 master CI의 지도를 받아 둔다(바로올리기는 6시간마다 저절로)
 *
 * 왜 있나: 10-21 master CI를 50회 연속 빨갛게 한 커밋은 시험을 한 번도 안 돌리고 올라갔다. 루트 시험 전체는 이 PC에서 5~10분이라
 *   push마다 돌리기 어렵다. 그런데 깨진 시험(지면폰트 ⑦)은 파일 이름을 부르지 않고 «추적 HTML 전부»를 훑는 자라서, 이름으로 고르면
 *   놓친다. 그래서 CI가 시험마다 실제로 읽은 파일(tools/ci읽기기록.cjs)을 지도로 남기고, 그 지도로 고른다.
 *
 * 고르는 법(넓게 — 몇 초 더 도는 편이 CI에서 깨지는 것보다 싸다):
 *   ① 바꾼 경로가 CI가 도는 시험 파일이면 그 시험.
 *   ② 지도: 그 시험(과 그 시험이 띄운 자식)이 바꾼 파일을 읽거나 쟀거나, 그 파일이 든 폴더를 나열했거나, `git ls-files`의 무늬에 걸리면.
 *   ③ 시험에 적힌 경로와 파일 이름을 대조한다. 다른 이름의 일부와 흔한 이름 단독 표기는 제외한다.
 *      시험에서 시작하는 상대 모듈 참조도 따라가므로 도우미를 거치는 시험은 읽기 지도가 없어도 고른다.
 *      기록 전용 경로(트랙·결정·현장노트 …)는 글로 고르지 않는다(10-22). 내커밋·바로올리기·짝검사 시험은 트랙 경로를 가짜 저장소의
 *      파일 이름으로만 적는데도 트랙을 같이 올리는 push마다 이 규칙에 붙었고, PC가 바쁠 때 내커밋·바로올리기는 각 11분 남짓 걸렸다
 *      (현장노트 시험_화면확인).
 *      그 경로는 ② 지도의 「읽음」과, 지도가 모르는 시험(지도를 못 받았거나 지도 뒤에 생긴 시험)이면 records-check.yml이 도는
 *      시험으로 고른다 — 기록 전용 경로를 실제로 읽는 시험은 그 목록에 있어야 CI가 초록이다(읽기 대조 ②, tools/ci읽기대조.cjs).
 *   ④ 조건부 등록부(11-12): tools/conditional-qa/cases.json에 적힌 시험 파일 · 그 폴더 · conditional-qa.yml을 바꾸면 등록을 보는
 *      tests/conditional-qa.test.cjs를 같이 고른다. ①~③의 후보에는 syntax-check와 ci넓은시험의 모든 묶음이 들어가며,
 *      이 규칙은 조건부 등록의 연결을 추가한다 — PC에만 있는 도구로 도는 시험을 등록 없이 넣은 push가 세 번(11-09 · 11-10 · 11-11)
 *      syntax-check를 20 · 31 · 33회 빨갛게 했다.
 *   기록 전용 경로만 바꾼 push는 고르지 않는다 — CI도 그 push에는 무거운 검사를 안 띄운다(records-check가 돈다).
 * 돌리기: node --test --test-reporter=tap. 워크트리에서는 CI=1이다(git 밖 로컬 자료를 읽는 시험이 건너뛴다 — 현장노트 시험_화면확인).
 *   공용 작업본에서는 주지 않는다. 이번 push로 처음 들어가는 파일은 SYNK_새파일로 넘긴다(git ls-files로 훑는 시험이 보게, 10-22).
 *   한 PC에서 동시에 도는 관련 시험은 자리 파일로 둘까지다(아래 「자리」 — 기다린 시간은 15분 한도에 안 든다, 10-22).
 *   원천과 짝 파일(생성물·사본)이 어긋난 push는 이 시험이 아니라 tools/짝검사.js가 먼저 막는다(CI의 시험 밖 단계까지).
 * 깨진 시험이 공용 작업본의 남의 미커밋을 읽었나: 바로올리기가 지도로 가르고, 지도에 없는 시험은 불러오는파일(그 시험과 require·import로
 *   닿는 모듈)로 본다(10-31 — 그전에는 다 읽는다고 봐서 처음 넣은 시험이 깨진 채 올라갔다).
 * 지도는 공용 git 폴더 안(<git-common-dir>/synk-관련시험/지도.json)에 두어 저장소에는 안 들어간다. 경로는 모두 저장소 기준이다.
 */
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

const { tap실패 } = require('./lib/tap실패.js');

const 무거운 = '.github/workflows/syntax-check.yml';
const 기록흐름 = '.github/workflows/records-check.yml';
const 등록부 = 'tools/conditional-qa/cases.json';
const 등록시험 = 'tests/conditional-qa.test.cjs';
const 등록흐름 = '.github/workflows/conditional-qa.yml';
const 지도이름 = 'test-read-map';
const 지도파일이름 = 'test-read-map.json';
const 받기간격ms = 6 * 3600e3;
const 받기쉼ms = 30 * 60e3; // 받기에 실패하면(아직 artifact가 없거나 gh가 안 되면) 이만큼은 다시 묻지 않는다
const 흔한이름 = new Set(['index.html', 'index.js', 'index.mjs', 'index.cjs', 'README.md', 'package.json', 'package-lock.json', 'main.js', 'app.js',
  'style.css', 'styles.css', 'config.json', 'server.mjs', '기획.md', '준비.json', '게시결과.json', '성과.json', 'manifest.json', '.gitignore']);

const 상대 = (full, root) => {
  const rel = path.relative(root, full);
  if (rel === '') return '.';
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
};
const 뺄경로 = (rel) => rel === '.git' || rel.startsWith('.git/') || /(^|\/)node_modules(\/|$)/.test(rel);

function git(root, args, timeout = 30000) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 256 << 20, timeout });
  return r.status === 0 ? String(r.stdout) : null;
}

/** syntax-check.yml이 `node --test`에 넘기는 시험 무늬(tests/*.test.js 꼴) — 못 읽으면 tests/*.test.js. */
function CI시험무늬(root) {
  let yaml = '';
  try { yaml = fs.readFileSync(path.join(root, 무거운), 'utf8'); } catch { /* 아래 기본 */ }
  const 무늬 = [...new Set([...yaml.matchAll(/node --test[^\n]*/g)].flatMap((m) => [...m[0].matchAll(/tests\/\*\.test\.[a-z]+/g)].map((x) => x[0])))];
  return 무늬.length ? 무늬 : ['tests/*.test.js'];
}
const 무늬식 = (무늬) => new RegExp('^' + 무늬.replace(/[.+^$()|\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');

/** 확장자·제품 목록을 복제하지 않고 넓은 CI 실행기의 실제 묶음 판정과 합친다. */
function CI시험판정(root) {
  const 식들 = CI시험무늬(root).map(무늬식);
  const 넓은 = Object.values(require('./ci넓은시험.js').묶음들);
  return (p) => !뺄경로(p) && !p.split('/').some((part) => part === '..' || part === '.') &&
    (식들.some((식) => 식.test(p)) || 넓은.some((맞음) => 맞음(p)));
}
function 시험파일있나(root, p) {
  try { return fs.statSync(path.join(root, p)).isFile(); } catch { return false; }
}

/** CI가 도는 시험 파일 — 추적되고 지금 디스크에 있는 것. */
function 추적목록(root) {
  return (git(root, ['-c', 'core.quotepath=false', 'ls-files', '-z']) || '').split('\0').filter(Boolean);
}
function CI시험목록(root, 맞음 = CI시험판정(root), 추적 = 추적목록(root)) {
  return 추적.filter((p) => 맞음(p) && 시험파일있나(root, p));
}

/** 조건부 등록부에 적힌 시험 파일들 — 등록부를 못 읽으면 null(그 파일로는 고르지 않는다). */
function 등록부파일들(root) {
  try { return new Set(JSON.parse(fs.readFileSync(path.join(root, 등록부), 'utf8')).cases.map((row) => row.file)); } catch { return null; }
}

/** 경로 하나가 기록 전용인가를 가르는 함수 — 그 경로만 바꾼 push가 무거운 검사를 안 띄우면(syntax-check.yml paths-ignore)
 *  기록 전용이다(ci읽기대조.cjs와 같은 판정). 목록을 못 읽으면 모두 기록 밖으로 본다(넓게 고른다). */
function 기록경로판정(root) {
  try {
    const { 푸시필터, 걸리나 } = require('./원격ci.js');
    const 필터 = 푸시필터(fs.readFileSync(path.join(root, 무거운), 'utf8'));
    return (p) => 걸리나(필터, [p]) === false;
  } catch { return () => false; }
}

/** 기록 전용 경로뿐인가 — syntax-check.yml의 paths-ignore에 모두 걸리면 CI도 무거운 검사를 안 띄운다. */
function 기록전용인가(root, 바뀐) {
  return 바뀐.length > 0 && 바뀐.every(기록경로판정(root));
}

/** records-check.yml이 도는 시험 — 기록 전용 경로를 실제로 읽는 시험은 모두 여기 있어야 한다(CI 읽기 대조 ②가 그 목록을 같은 식으로 읽는다). */
function 기록시험목록(root) {
  try {
    const { 시험목록 } = require('./ci읽기대조.cjs');
    return 시험목록(fs.readFileSync(path.join(root, 기록흐름), 'utf8'));
  } catch { return []; }
}

// ── 지도 만들기(CI) ────────────────────────────────────────────────────────────

/** git ls-files 자식의 무늬(전부 훑으면 '*'). 저장소 밖에서 돈 git은 뺀다. */
function git무늬(spawn, root) {
  const 이름 = path.basename(String(spawn.command || '')).replace(/\.exe$/i, '');
  const args = spawn.args || [];
  if (이름 !== 'git' || !args.includes('ls-files')) return [];
  let cwd = spawn.cwd;
  for (let i = 0; i < args.length; i++) if (args[i] === '-C' && args[i + 1]) cwd = path.resolve(cwd || root, args[++i]);
  if (!cwd || 상대(cwd, root) === null) return [];
  if ([spawn.gitDir, spawn.gitWorkTree].some((p) => p && 상대(p, root) === null)) return [];
  const 앞 = 상대(cwd, root);
  const k = args.indexOf('--');
  const 뒤 = (k >= 0 ? args.slice(k + 1) : args.slice(args.indexOf('ls-files') + 1).filter((a) => !a.startsWith('-')));
  if (!뒤.length) return [앞 === '.' ? '*' : `${앞}/*`];
  // `.`·`dir/.`·`dir/`은 그 폴더 전부다 — 저장소 맨 위면 '*'(아르곤 10-22 P2)
  return 뒤.map((a) => {
    const 붙인 = (앞 === '.' ? a : `${앞}/${a}`).replace(/^\.\//, '').replace(/\/\.?$/, '');
    return 붙인 === '.' || 붙인 === '' ? '*' : 붙인;
  });
}

/** 기록들(ci읽기기록 json들)을 시험 파일별 {읽음, 폴더, 무늬}로 묶는다. 추적 파일·추적 파일이 든 폴더만 남긴다. */
function 지도만들기(기록들, root, 추적들) {
  const { 주인별, 인자경로 } = require('./ci읽기대조.cjs');
  const 추적 = new Set(추적들);
  const 폴더들 = new Set(['.']);
  for (const p of 추적) for (let d = path.posix.dirname(p); d !== '.' && !폴더들.has(d); d = path.posix.dirname(d)) 폴더들.add(d);
  const 시험 = {};
  for (const [주인, 목록] of 주인별(기록들, root)) {
    if (주인.startsWith('단계:')) continue;
    const 읽음 = new Set(), 폴더 = new Set(), 무늬 = new Set();
    for (const r of 목록) {
      for (const [p, 종류] of r.reads || []) {
        const rel = 상대(p, root);
        if (!rel || 뺄경로(rel)) continue;
        if (종류.includes('dir') && 폴더들.has(rel)) 폴더.add(rel);
        if (종류.some((k) => k !== 'dir') && 추적.has(rel)) 읽음.add(rel);
      }
      for (const s of r.spawns || []) {
        for (const rel of 인자경로(s, root)) if (추적.has(rel)) 읽음.add(rel);
        for (const m of git무늬(s, root)) 무늬.add(m);
      }
    }
    읽음.delete(주인);
    시험[주인] = { 읽음: [...읽음].sort(), 폴더: [...폴더].sort(), 무늬: [...무늬].sort() };
  }
  return 시험;
}

function 기록읽기(폴더) {
  const 결과 = [];
  for (const 이름 of fs.readdirSync(폴더)) {
    if (!이름.endsWith('.json')) continue;
    try { 결과.push(JSON.parse(fs.readFileSync(path.join(폴더, 이름), 'utf8'))); } catch { /* 깨진 기록은 건너뛴다 */ }
  }
  return 결과;
}

// ── 지도 받기·읽기(로컬) ───────────────────────────────────────────────────────

function 지도자리(root) {
  const g = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'], 10000);
  return g ? path.join(g.trim(), 'synk-관련시험') : null;
}

/** 최신 master syntax-check run에서 지도 artifact를 받는다. GitHub 원격이 아니거나 gh가 안 되면 null. */
function 지도받기(root, { gh = null } = {}) {
  const 자리 = 지도자리(root);
  if (!자리) return null;
  const 원격 = (git(root, ['remote', 'get-url', 'origin'], 10000) || '').trim().match(/github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (!원격) return null;
  const repo = `${원격[1]}/${원격[2]}`;
  const 부르기 = gh || ((args, timeout) => {
    const r = spawnSync('gh', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout });
    return r.status === 0 ? String(r.stdout) : null;
  });
  const 목록 = 부르기(['run', 'list', '--repo', repo, '--workflow', 'syntax-check.yml', '--branch', 'master', '--status', 'completed', '--limit', '5', '--json', 'databaseId,headSha,createdAt'], 20000);
  let runs = [];
  try { runs = JSON.parse(목록 || '[]'); } catch { return null; }
  for (const run of runs) {
    const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-관련시험-'));
    try {
      if (부르기(['run', 'download', String(run.databaseId), '--repo', repo, '--name', 지도이름, '--dir', 임시], 60000) === null) continue;
      const 받은 = path.join(임시, 지도파일이름);
      if (!fs.existsSync(받은)) continue;
      const 지도 = JSON.parse(fs.readFileSync(받은, 'utf8'));
      fs.mkdirSync(자리, { recursive: true });
      const 값 = { ...지도, run: run.databaseId, sha: run.headSha, 받은때: new Date().toISOString() };
      // 여러 세션이 같은 공용 git 폴더에 쓴다 — 임시 이름이 겹치지 않게
      const 임시파일 = path.join(자리, `지도.json.${process.pid}.${Date.now()}.tmp`);
      fs.writeFileSync(임시파일, JSON.stringify(값));
      fs.renameSync(임시파일, path.join(자리, '지도.json'));
      return 값;
    } catch { /* 다음 run */ } finally { fs.rmSync(임시, { recursive: true, force: true }); }
  }
  return null;
}

/** 받아 둔 지도(없거나 6시간 넘었으면 한 번 받아 본다). 못 구하면 null. */
function 지도읽기(root, { 받기 = true, 지금ms = Date.now(), gh = null } = {}) {
  const 자리 = 지도자리(root);
  let 지도 = null;
  try { 지도 = 자리 && JSON.parse(fs.readFileSync(path.join(자리, '지도.json'), 'utf8')); } catch { 지도 = null; }
  if (받기 && 자리 && (!지도 || 지금ms - Date.parse(지도.받은때) > 받기간격ms)) {
    const 쉼파일 = path.join(자리, '받기실패.txt');
    let 쉼 = 0;
    try { 쉼 = Date.parse(fs.readFileSync(쉼파일, 'utf8').trim()) || 0; } catch { 쉼 = 0; }
    if (지금ms - 쉼 >= 받기쉼ms) {
      const 받은 = 지도받기(root, { gh });
      if (받은) { 지도 = 받은; fs.rmSync(쉼파일, { force: true }); }
      else { try { fs.mkdirSync(자리, { recursive: true }); fs.writeFileSync(쉼파일, new Date(지금ms).toISOString()); } catch { /* 다음에 다시 */ } }
    }
  }
  return 지도 && 지도.시험 ? 지도 : null;
}

// ── 고르기 ────────────────────────────────────────────────────────────────────

/** git pathspec → 식. 와일드카드가 없으면 그 파일이거나 그 폴더 아래 전부다(`git ls-files -- tests`는 tests/ 아래 모두). */
function git무늬식(무늬) {
  if (무늬 === '*') return /^/;
  const 글 = 무늬.replace(/\/+$/, '');
  const 식 = 글.replace(/[.+^$()|\\[\]{}]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return /[*?]/.test(글) ? new RegExp(`^${식}$`) : new RegExp(`^${식}(?:/.*)?$`);
}

/** 지도의 한 시험 칸이 이 경로를 읽나 — 읽은 파일 · 나열한 폴더(새 파일) · git 무늬. 까닭 글을 돌려주고, 아니면 null. */
function 읽나(칸, p) {
  if (!칸) return null;
  if ((칸.읽음 || []).includes(p)) return `읽음: ${p}`;
  const 위 = path.posix.dirname(p);
  if ((칸.폴더 || []).includes(위)) return `폴더 나열: ${위}`;
  const 걸린 = (칸.무늬 || []).find((m) => git무늬식(m).test(p));
  return 걸린 ? `git 무늬 ${걸린}: ${p}` : null;
}

// 마침표·붙임표·밑줄도 파일 이름에 들어간다. 예를 들어 foo.test.mjs는 test.mjs의 참조가 아니다.
const 이름문자 = '[\\p{L}\\p{M}\\p{N}_.-]';
const 식문자 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const 온이름 = (s) => new RegExp(`(?<!${이름문자})${식문자(s)}(?!${이름문자})`, 'u');
function 글판정(p) {
  const 이름 = path.posix.basename(p);
  const 경로식 = p.includes('/') || !흔한이름.has(이름) ? 온이름(p) : null;
  const 이름식 = !흔한이름.has(이름) && 온이름(이름);
  const 줄기 = path.posix.parse(이름).name;
  const 줄기식 = 이름식 && 줄기.length >= (/[가-힣]/.test(줄기) ? 3 : 6)
    && new RegExp("['\"`/]" + 식문자(줄기) + "(?=['\"`/]|\\.[${'\"`])");
  return (글, 모듈밖, 의존) => {
    if (경로식 && 경로식.test(글) && (의존?.has(p) || 경로식.test(모듈밖()))) return `글에 경로: ${p}`;
    const 이름있나 = (본문) => (이름식 && 이름식.test(본문)) || (줄기식 && 줄기식.test(본문));
    if (이름있나(글) && 이름있나(모듈밖())) return `글에 이름: ${이름}`;
    return null;
  };
}

/** 바꾼 경로(저장소 기준) → { 시험: [파일…], 까닭: {파일: 까닭}, 기록전용, 지도: 'run 번호'|null }. 돌리지는 않는다. */
function 고르기({ root, 바뀐, 지도 = undefined, 받기 = true }) {
  const 경로들 = [...new Set(바뀐.map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '')))].filter(Boolean);
  if (기록전용인가(root, 경로들)) return { 시험: [], 까닭: {}, 기록전용: true, 지도: null };
  const 쓸지도 = 지도 === undefined ? 지도읽기(root, { 받기 }) : 지도;
  // 같은 push로 처음 올리는 시험 파일은 아직 추적되지 않는다 — CI 무늬에 맞고 디스크에 있으면 시험으로 센다.
  const 맞음 = CI시험판정(root);
  const 새시험 = 경로들.filter((p) => 맞음(p) && 시험파일있나(root, p));
  const 추적 = 추적목록(root);
  const 시험들 = new Set([...CI시험목록(root, 맞음, 추적), ...새시험]);
  const 까닭 = {};
  const 고름 = (t, 왜) => { if (!까닭[t]) 까닭[t] = 왜; };
  for (const p of 새시험) 고름(p, '바꾼 시험');
  // ④ 조건부 등록부가 보는 파일(머리 주석) — 직접 변경 외의 등록 연결도 고른다.
  if (fs.existsSync(path.join(root, 등록시험))) {
    const 등록 = 등록부파일들(root);
    const 걸린 = 경로들.find((p) => p === 등록시험 || p === 등록흐름 || p.startsWith('tools/conditional-qa/') || (등록 && 등록.has(p)));
    if (걸린) 고름(등록시험, `조건부 등록부가 보는 파일: ${걸린}`);
  }
  if (쓸지도) {
    for (const t of 시험들) {
      const 칸 = 쓸지도.시험[t];
      if (!칸) continue;
      for (const p of 경로들) {
        const 왜 = 읽나(칸, p);
        if (왜) { 고름(t, 왜); break; }
      }
    }
  }
  // 기록 전용 경로는 글로 고르지 않는다(머리 주석 ③). 지도가 모르는 시험은 records-check.yml 목록으로 덮는다.
  const 기록인가 = 기록경로판정(root);
  const 기록경로들 = 경로들.filter(기록인가);
  if (기록경로들.length) {
    for (const t of 기록시험목록(root)) {
      if (시험들.has(t) && !(쓸지도 && 쓸지도.시험[t])) 고름(t, `기록 시험(records-check.yml)·지도에 없음: ${기록경로들[0]}`);
    }
  }
  const 원천 = 경로들.filter((p) => !기록인가(p));
  const 판정들 = 원천.map(글판정);
  const 모듈 = 원천.filter((p) => 모듈끝.test(p));
  const 캐시 = 모듈.length ? 구문캐시(root) : null;
  const 파일들 = new Set([...추적, ...경로들]);
  const 참조자 = new Map();
  const 읽을파일 = new Set(시험들);
  // 같은 도우미를 여러 시험이 부르더라도 소스는 한 번만 읽는다. Set 순회 중 추가한 모듈도 방문한다.
  for (const rel of 읽을파일) {
    const 시험인가 = 시험들.has(rel);
    if (!모듈.length && (!시험인가 || 까닭[rel])) continue;
    let 글;
    try { 글 = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    const 확정경로 = [];
    const 의존 = 모듈.length ? 글속모듈(root, rel, 글, 시험인가, 파일들, 확정경로, 캐시) : null;
    if (시험인가 && !까닭[rel]) {
      const 경로글 = 글.replace(/\\+/g, '/');
      let 나머지;
      const 모듈밖 = () => 나머지 ??= (확정경로.length ? 참조밖(글, 확정경로).replace(/\\+/g, '/') : 경로글);
      for (const 판정 of 판정들) {
        const 왜 = 판정(경로글, 모듈밖, 의존);
        if (왜) { 고름(rel, 왜); break; }
      }
    }
    if (!의존) continue;
    for (const dep of 의존) {
      if (!참조자.has(dep)) 참조자.set(dep, new Set());
      참조자.get(dep).add(rel);
      if (따라갈끝.test(dep)) 읽을파일.add(dep);
    }
  }
  const 영향 = new Map(모듈.map((p) => [p, p]));
  캐시?.저장();
  for (const [rel, 원인] of 영향) {
    if (시험들.has(rel)) 고름(rel, `모듈 참조: ${원인}`);
    for (const 부모 of 참조자.get(rel) || []) if (!영향.has(부모)) 영향.set(부모, 원인);
  }
  const 시험 = Object.keys(까닭).sort();
  return { 시험, 까닭, 기록전용: false, 지도: 쓸지도 ? 쓸지도.run || '로컬' : null };
}

// ── 불러오는 파일(지도에 없는 시험, 2026-10-31) ─────────────────────────────────────
// 바로올리기는 공용 작업본에서 깨진 시험이 남의 미커밋을 읽었을 수 있으면 막지 않는다(git-publish-core.cjs 남의미커밋섞임).
// 지도에 없는 시험(이번 push로 처음 넣은 시험 · 지도 뒤에 생긴 시험 · 지도를 못 받았을 때)을 「남의 미커밋을 다 읽는다」로 치자
// 10-30 공용 작업본에서 처음 넣은 시험이 깨진 채 올라갔다(840a50cad, 현장노트 시험_화면확인). 그런 시험은 이것으로 본다 —
// 그 시험 파일에서 시작해 require·require.resolve·import·import()·export from의 './'·'../' 경로를 끝까지 따라간다.
// 시험 파일에서만 도구를 부르는 다른 꼴도 센다: './'·'../'로 시작하는 글자, path.join·path.resolve의 글자 조각(__dirname·import.meta가
// 있으면 그 파일 폴더, 없으면 저장소 기준 — REPO·ROOT·루트), 저장소 기준 경로 글자('tools/x.js'). 도구 글의 같은 꼴은 대개 자료 목록
// (짝검사 표·Atlas 사본 목록)이라, 따라가면 반응리포트 시험 하나가 349개로 불어 공용 작업본의 남의 미커밋(experiences 코드 수백 개)과
// 늘 겹친다(10-31 실측 — 이 규칙이면 47개). 모듈(.js·.cjs·.mjs)과 .json만 센다 — 트랙·결정 같은 문서를 세면 늘 「읽는다」가 된다.
// fs로 읽는 자료·문서는 못 본다. 저장소 밖·node_modules·.git은 뺀다.
const 모듈끝 = /\.(?:[cm]?js|json)$/i;
const 따라갈끝 = /\.[cm]?js$/i;
const 글자 = /(['"`])([^'"`\n$]*)\1/g;
const 구문사이 = String.raw`(?:\s|/\*(?:[^*]|\*(?!/))*\*/|//[^\r\n]*(?=[\r\n]|$))*`;
const 모듈꼴 = new RegExp(String.raw`(?:\b(?:require(?:\.resolve)?|import)${구문사이}\(${구문사이}|\b(?:from|import)${구문사이})(['"\`])(\.\.?(/[^'"\`\r\n]*)?)\1`, 'g');

/** Node처럼 모듈 파일을 찾는다 — 그 파일 · 끝 붙이기 · 폴더의 index. 저장소 기준 경로, 못 찾았거나 뺄 곳이면 null. */
function 모듈찾기(root, 전체, 파일들, 의존) {
  const rel = 상대(전체, root);
  if (!rel || 뺄경로(rel)) return null;
  const 있음 = (p) => 파일들 ? 파일들.has(p) : 시험파일있나(root, p);
  const 파일 = (p) => [p, p + '.js', p + '.json'].find(f => 모듈끝.test(f) && 있음(f));
  const 바로 = 파일(rel);
  if (바로) return 바로;
  const 설명 = path.posix.join(rel, 'package.json');
  if (있음(설명)) {
    의존?.add(설명);
    try {
      const { main } = JSON.parse(fs.readFileSync(path.join(root, 설명), 'utf8'));
      if (typeof main === 'string' && main) {
        const 입구 = 상대(path.resolve(root, rel, main), root);
        if (입구 && !뺄경로(입구)) {
          const 대상 = 파일(입구) || 파일(path.posix.join(입구, 'index'));
          if (대상) return 대상;
        }
      }
    } catch { /* 지웠거나 읽을 수 없는 설명도 이 시험의 입력이다. */ }
  }
  return 파일(path.posix.join(rel, 'index')) || [rel + '.cjs', rel + '.mjs',
    ...['.cjs', '.mjs'].map(끝 => path.posix.join(rel, 'index' + 끝))].find(있음) || null;
}

// 실제로 해석한 정적 import/export의 경로만 이름 비교에서 제외한다.
function 참조밖(글, 경로들) {
  let 끝 = 0, 결과 = '';
  for (const source of 경로들.sort((a, b) => a.start - b.start)) {
    결과 += 글.slice(끝, source.start) + ' ';
    끝 = source.end;
  }
  return 결과 + 글.slice(끝);
}

const 지문 = (s) => createHash('sha256').update(s).digest('hex');

// 파서가 찾은 문자열과 위치만 재사용한다. 경로 해석·package.json·CI 지도는 매번 현재 판을 본다.
function 구문캐시(root) {
  const 자리 = 지도자리(root);
  if (!자리) return null;
  let 판;
  try { 판 = 지문(구문참조.toString() + 모듈꼴.source + require('acorn').version); } catch { return null; }
  const 파일 = path.join(자리, '구문참조.json');
  let 이전 = {}, 새로읽음 = false;
  try {
    const raw = fs.readFileSync(파일, 'utf8');
    if (raw.slice(0, 64) === 지문(raw.slice(65))) {
      const 값 = JSON.parse(raw.slice(65));
      if (값.판 === 판 && 값.항목) 이전 = 값.항목;
    }
  } catch { /* 없거나 손상된 캐시는 다시 만든다. */ }
  const 항목 = {};
  return {
    읽기(모드, 글) {
      const 키 = 모드 + 지문(글);
      if (항목[키]) return 항목[키];
      if (Array.isArray(이전[키])) return 항목[키] = 이전[키];
      새로읽음 = true;
      return 항목[키] = 구문참조(모드, 글);
    },
    저장() {
      if (!새로읽음) return;
      const 임시 = 파일 + '.' + process.pid + '.' + Date.now() + '.tmp';
      try {
        const raw = JSON.stringify({ 판, 항목 });
        fs.mkdirSync(자리, {recursive:true});
        fs.writeFileSync(임시, 지문(raw) + '\n' + raw);
        fs.renameSync(임시, 파일);
      } catch { /* 캐시를 쓸 수 없어도 이번 선택은 완성됐다. */ }
      finally { try { fs.unlinkSync(임시); } catch { /* 이미 옮긴 파일 */ } }
    },
  };
}

// 문자열 안의 키워드와 실제 호출을 구분한다. 파서가 없거나 작성 중인 파일이면
// 상대 경로의 글 단서를 보존하고 import 경로를 가리지 않는다.
function 구문참조(모드, 글) {
  const 참조 = [];
  if (!/['"`][.\\]/.test(글)) return 참조;
  const 후보 = new Set();
  const 후보넣기 = s => { if (typeof s === 'string' && /^\.\.?(?:\/|$)/.test(s)) 후보.add(s); };
  let 트리;
  try {
    트리 = require('acorn').parse(글, {ecmaVersion: 'latest', sourceType: 모드, allowReturnOutsideFunction: true});
  } catch {
    for (const [, , s] of 글.matchAll(모듈꼴)) 참조.push({s, esm:false});
    for (const [, q, s] of 글.matchAll(/(['"`])(\.\.?(?:\/[^'"`\r\n]*)?)\1/g)) {
      if (q !== '`' || !s.includes('${')) 후보넣기(s);
    }
  }
  const 남은 = 트리 ? [트리] : [];
  while (남은.length) {
    const n = 남은.pop();
    if (n.type === 'Literal') 후보넣기(n.value);
    if (n.type === 'TemplateLiteral' && !n.expressions.length) 후보넣기(n.quasis[0].value.cooked);
    const 정적 = n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration';
    const esm = 정적 || n.type === 'ImportExpression';
    let 값;
    if (esm) 값 = n.source;
    else if (n.type === 'CallExpression') {
      const c = n.callee;
      const 메서드 = c.computed ? c.property?.value : c.property?.name;
      if (c.name === 'require' || (c.object?.name === 'require' && 메서드 === 'resolve') || (c.object?.name === 'module' && 메서드 === 'require')) 값 = n.arguments[0];
    }
    if (값) {
      const s = 값.type === 'TemplateLiteral' && !값.expressions.length ? 값.quasis[0].value.cooked : 값.value;
      if (typeof s === 'string' && /^\.\.?(?:\/|$)/.test(s)) {
        참조.push(정적 ? {s, esm, start:값.start, end:값.end} : {s, esm});
      }
    }
    for (const key of Object.keys(n)) {
      const child = n[key];
      if (Array.isArray(child)) { for (const item of child) if (item?.type) 남은.push(item); }
      else if (child?.type) 남은.push(child);
    }
  }
  // 어떤 함수나 별칭에 전달되는지 모르는 리터럴은 시험 선택에만 보수적으로 쓴다.
  // 실패한 시험을 남의 미커밋 탓으로 판단할 때에는 확인된 참조만 사용한다.
  for (const s of 후보) 참조.push({s, 후보:true});
  return 참조;
}

/** 모듈 글 하나가 부르는 저장소 안 모듈 경로들 — 모듈 꼴, 시험 파일이면 위 다른 꼴까지. */
function 글속모듈(root, rel, 글, 시험인가, 파일들, 확정경로, 캐시) {
  const 폴더 = path.dirname(path.join(root, rel));
  const 찾음 = new Set();
  const 넣기 = (전체) => { const r = 모듈찾기(root, 전체, 파일들, 찾음); if (r) 찾음.add(r); return r; };
  const 모드 = rel.endsWith('.cjs') ? 'script' : 'module';
  const 참조들 = 캐시 ? 캐시.읽기(모드, 글) : 구문참조(모드, 글);
  for (const 참조 of 참조들) {
    if (참조.후보 && !파일들) continue;
    const {s, esm} = 참조;
    let 전체 = path.resolve(폴더, s);
    if (esm && /[%?#]/.test(s)) {
      try { 전체 = fileURLToPath(new URL(s, pathToFileURL(path.join(root, rel)))); } catch { /* 경로 단서도 확인한다. */ }
    }
    if (넣기(전체) && 참조.start !== undefined) 확정경로?.push(참조);
  }
  if (!시험인가) return 찾음;
  for (const [, , s] of 글.matchAll(글자)) {
    if (/^\.\.?\//.test(s)) 넣기(path.resolve(폴더, s));
    else if (/^[^/:\s][^:\s]*\/[^:\s]*\.(?:[cm]?js|json)$/i.test(s)) 넣기(path.resolve(root, s));
  }
  for (const [, 인자] of 글.matchAll(/\b(?:join|resolve)\(((?:[^()]|\([^()]*\))*)\)/g)) {
    const 조각 = [...인자.matchAll(글자)].map((x) => x[2]);
    if (조각.length) 넣기(path.resolve(/__dirname|import\.meta/.test(인자) ? 폴더 : root, ...조각));
  }
  return 찾음;
}

/** 시험 하나가 불러오는 저장소 파일(그 시험 포함, 저장소 기준 경로의 Set). 한도를 넘으면 null — 모르니 다 읽는다고 본다. */
function 불러오는파일(root, 시험, { 한도 = 5000 } = {}) {
  const 처음 = String(시험).replace(/\\/g, '/');
  const 본 = new Set();
  const 남은 = [처음];
  while (남은.length) {
    const rel = 남은.pop();
    if (본.has(rel)) continue;
    if (본.size >= 한도) return null;
    본.add(rel);
    if (!따라갈끝.test(rel)) continue;
    let 글;
    try { 글 = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    for (const 다음 of 글속모듈(root, rel, 글, rel === 처음)) if (!본.has(다음)) 남은.push(다음);
  }
  return 본;
}

// ── 돌리기 ────────────────────────────────────────────────────────────────────

/** TAP 요약과 깨진 잎 시험(「부모 › 잎」 이름·위치·시험이 찍은 → 안내) — tools/lib/tap실패.js. root 기준으로 위치를 줄인다. */
function tap읽기(글, root = null) {
  const r = tap실패(글, { root });
  return { 시험: r.시험, 통과: r.통과, 실패수: r.실패수, 취소: r.취소, 실패: r.실패.map((x) => ({ 이름: x.시험, 위치: x.위치, 파일: x.파일, ...(x.안내 && x.안내.length ? { 안내: x.안내 } : {}) })) };
}

/** Node가 실행한 범위의 완료 여부다. 요약은 stdout 주석과 섞이지 않도록 마지막 루트 계획 뒤에서만 읽는다. */
function 보고서판정(글) {
  const 줄들 = typeof 글 === 'string' ? 글.split('\n') : [];
  // LF 완결 여부를 먼저 보존한다. CR만 남은 꼬리를 빈 줄로 바꾸면 안 된다.
  const 꼬리 = 줄들.at(-1) || '';
  if (!꼬리) 줄들.pop();
  const 완결줄수 = 줄들.length - (꼬리 ? 1 : 0);
  for (let i = 0; i < 완결줄수; i++) if (줄들[i].endsWith('\r')) 줄들[i] = 줄들[i].slice(0, -1);
  const 완결줄 = 줄들.slice(0, 완결줄수);
  const 지시어 = l => / # (?:SKIP|TODO)(?: |$)/.test(l);
  const 본문결과 = [];
  let 진단들여쓰기 = null;
  for (const 줄 of 완결줄) {
    if (진단들여쓰기 !== null) {
      if (줄 === ' '.repeat(진단들여쓰기) + '...') 진단들여쓰기 = null;
      continue;
    }
    const 진단시작 = 줄.match(/^( +)---$/);
    if (진단시작) { 진단들여쓰기 = 진단시작[1].length; continue; }
    if (/^ *(?:not ok|ok) \d+(?: |$)/.test(줄)) 본문결과.push(줄);
  }
  const 루트결과 = 본문결과.filter(l => /^(?:not ok|ok) \d+(?: |$)/.test(l));
  const 본통과 = 루트결과.filter(l => l.startsWith('ok ') && !지시어(l)).length;
  const 본실패 = 본문결과.filter(l => /^ *not ok \d+(?: |$)/.test(l) && !지시어(l)).length;
  let 마지막본문 = 줄들.length - 1;
  while (마지막본문 >= 0 && 줄들[마지막본문].startsWith('#')) 마지막본문--;
  const 계획글 = 줄들[마지막본문]?.match(/^1\.\.(\d+)$/);
  const 계획 = 계획글 ? Number(계획글[1]) : null;
  const 키 = { tests: '시험', pass: '통과', fail: '실패수', cancelled: '취소', skipped: '건너뜀', todo: '할일', suites: '묶음', duration_ms: '시간' };
  const 요약 = {}, 본키 = new Set();
  let 꼴맞음 = Boolean(계획글), 실패취소단서 = false, 명시적오류 = Boolean(계획글) && (!Number.isSafeInteger(계획) || 계획 < 1);
  if (계획글) for (const 줄 of 줄들.slice(마지막본문 + 1)) {
    const m = 줄.match(/^# ([a-z_]+) (.*)$/);
    if (!m || !Object.hasOwn(키, m[1])) continue;
    const 숫자 = m[1] === 'duration_ms' ? /^\d+(?:\.\d+)?$/ : /^\d+$/;
    const 값 = Number(m[2]);
    const 유효 = 숫자.test(m[2]) && Number.isFinite(값) && (m[1] === 'duration_ms' || Number.isSafeInteger(값));
    if ((m[1] === 'fail' || m[1] === 'cancelled') && 유효 && 값 > 0) 실패취소단서 = true;
    if (본키.has(m[1]) || !유효) { 꼴맞음 = false; 명시적오류 = true; }
    본키.add(m[1]); 요약[키[m[1]]] = 유효 ? 값 : null;
  }
  if (계획글 && 진단들여쓰기 !== null) 명시적오류 = true;
  const 완료 = 꼴맞음 && 진단들여쓰기 === null && Number.isSafeInteger(계획) && 계획 > 0 && 루트결과.length > 0 &&
    ['tests', 'pass', 'fail', 'cancelled', 'duration_ms'].every(k => 본키.has(k)) && /^# duration_ms \d+(?:\.\d+)?$/.test(줄들.at(-1) || '');
  const 상태 = 완료 ? '완료' : !꼬리 && !명시적오류 && 본통과 + 본실패 > 0 ? '중간' : '미확인';
  return { 상태, 계획, 본통과, 본실패, 실패취소단서,
    요약: 완료 ? { 시험: 요약.시험, 통과: 요약.통과, 실패수: 요약.실패수, 취소: 요약.취소, 건너뜀: 요약.건너뜀 ?? null, 할일: 요약.할일 ?? null } : null,
    까닭: 상태 === '미확인' ? (꼬리 ? 'TAP 마지막 줄이 끝나지 않았다' : 'TAP에 확인한 시험 결과가 없다') : 완료 ? null : 'TAP 완료 요약이 없다(잘렸거나 Node 출력이 바뀌었다)' };
}

// ── 자리(한 PC에서 동시에 도는 push 전 관련 시험 수, 2026-10-22) ─────────────────────────────
// 10-22 13시 여러 세션의 push 전 관련 시험이 한꺼번에 돌아 CPU 100%·`--test` 프로세스 29개가 되자 모두 15분 한도에 걸렸다
// (시험 내용이 아니라 동시에 도는 양 탓). 공용 git 폴더(<git-common-dir>/synk-관련시험/자리/ — 이 저장소 워크트리 모두가 같이 본다)에
// 자리를 쥔 프로세스만 표(<시각>-<pid>-<임의>.lock)를 두고, 표가 수만큼 있으면 기다린다. 기다린 시간은 15분 한도에 안 든다
// (자리를 잡은 뒤에 시계를 켠다). 「주인이 없거나 멈춘 표 치우기 → 표 세기 → 내 표 두기」는 짧은 전체 잠금(.고르는중 폴더 — mkdir가
// 원자적이다) 안에서만 한다 — 버려진 자리를 둘이 같이 보고 하나가 지운 뒤 새로 잡은 남의 자리를 다른 하나가 또 지우거나(아르곤 10-22 P1),
// 같은 밀리초에 뽑은 표끼리 순서가 뒤바뀌어 자리가 넘치는 일이 없다. 표 이름도 하나뿐이라 치울 때 그 이름만 지운다.
// 자리를 쥔 표는 그대로 두어 30분(한도의 두 배)이 지나면 멈춘 것으로 본다. 고르다 죽은 프로세스의 전체 잠금은 10초 뒤 치운다.
// 자리 수는 SYNK_관련시험_자리(기본 2, 「끔」이면 안 잡는다), 한 번에 도는 시험 파일은 CPU의 3분의 1.
const 기본자리 = 2;
const 자리낡음ms = 30 * 60e3; // 한도 15분의 두 배 — 이보다 오래 그대로인 표는 주인이 멈춘 것이다
const 고르는중 = '.고르는중';
const 잠깐 = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const 표식 = /^\d{15}-(\d+)-[0-9a-z]+\.lock$/;

function 살아있나(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// Windows는 남이 막 지우는 폴더 자리에 mkdir를 하면 EEXIST가 아니라 EPERM을 낸다(지워지는 중인 이름은 손잡이가 다 닫힐 때까지 못 쓴다).
// 11-13 · 11-19에 여러 세션이 함께 자리를 고르다 이 EPERM으로 올리기가 죽었다(재현: 아홉 프로세스 5초에 2,439번, 가장 길게 0.03초).
// 그래서 이 셋은 잠깐 쉬고 다시 한다. 진짜 권한 문제는 한 번도 안 풀리니, 이 오류만 연달아 난 시간이 한도를 넘으면 그 오류를 던진다.
const 잠금잠깐막힘 = new Set(['EPERM', 'EACCES', 'EBUSY']);
const 잠금막힘한도ms = 30e3;
const 단조ms = () => Number(process.hrtime.bigint() / 1000000n); // 시스템 시각을 맞춰도 안 뛰는 시계 — 한도는 이것으로 센다

/** 짧은 전체 잠금 — 쥐고 있는 동안만 표를 치우고 센다. 풀기 함수를 돌려준다. 막힘한도ms는 시험이 준다. */
function 잠그기(폴더, { 막힘한도ms = 잠금막힘한도ms } = {}) {
  const 잠금 = path.join(폴더, 고르는중);
  let 막힌때 = null; // 잠깐 막힘 오류가 연달아 나기 시작한 때 — 잠금이 보이면(EEXIST) 처음부터 다시 센다
  for (;;) {
    try {
      fs.mkdirSync(잠금);
      return () => { try { fs.rmdirSync(잠금); } catch { /* 이미 없다 */ } };
    } catch (e) {
      if (e.code === 'EEXIST') {
        막힌때 = null;
        try { if (Date.now() - fs.statSync(잠금).mtimeMs > 10e3) fs.rmdirSync(잠금); } catch { /* 그새 풀렸다 */ }
      } else if (잠금잠깐막힘.has(e.code)) {
        if (막힌때 === null) 막힌때 = 단조ms();
        else if (단조ms() - 막힌때 >= 막힘한도ms) throw e;
      } else throw e;
      잠깐(20);
    }
  }
}

/** 자리 하나를 잡는다 → { 번호(먼저 쥔 수), 수, 기다린초, 놓기() }. 기다림ms 안에 못 잡으면 번호 null(자리 없이 돈다 — 막지는 않는다).
 *  전체 잠금을 끝내 못 만들면(막힘한도ms 동안 권한 오류만 났다) 그 오류를 던진다 — 막힘한도ms는 시험만 준다. */
function 자리잡기(폴더, { 수 = 기본자리, 기다림ms = 30 * 60e3, 간격ms = 2000, 막힘한도ms = 잠금막힘한도ms } = {}) {
  const 시작 = Date.now();
  const 초 = () => Math.round((Date.now() - 시작) / 1000);
  fs.mkdirSync(폴더, { recursive: true });
  for (;;) {
    let 내자리 = null, 쥔수 = 0;
    const 풀기 = 잠그기(폴더, { 막힘한도ms });
    try {
      const 지금 = Date.now();
      for (const 이름 of fs.readdirSync(폴더)) {
        const m = 표식.exec(이름);
        if (!m) continue;
        let 수정ms;
        try { 수정ms = fs.statSync(path.join(폴더, 이름)).mtimeMs; } catch { continue; } // 그새 놓은 표
        if (!살아있나(Number(m[1])) || 지금 - 수정ms > 자리낡음ms) { try { fs.rmSync(path.join(폴더, 이름), { force: true }); } catch { /* 다음 바퀴 */ } continue; }
        쥔수++;
      }
      if (쥔수 < 수) {
        내자리 = path.join(폴더, `${String(지금).padStart(15, '0')}-${process.pid}-${Math.random().toString(36).slice(2, 8) || '0'}.lock`);
        fs.writeFileSync(내자리, '', { flag: 'wx' });
      }
    } finally { 풀기(); }
    if (내자리) {
      const 놓을곳 = 내자리;
      return { 번호: 쥔수, 수, 기다린초: 초(), 놓기: () => { try { fs.rmSync(놓을곳, { force: true }); } catch { /* 이미 없다 */ } } };
    }
    if (Date.now() - 시작 >= 기다림ms) return { 번호: null, 수, 기다린초: 초(), 놓기: () => {} };
    잠깐(Math.max(10, 간격ms)); // 0이면 CPU를 헛돈다
  }
}

/** 자리 설정 — 시험이 폴더·수·기다림·간격을 준다(0도 그 값 그대로). SYNK_관련시험_자리=끔이면 null(안 잡는다). */
function 자리설정(root, 자리) {
  if (자리 === false || process.env.SYNK_관련시험_자리 === '끔') return null;
  const 준 = 자리 || {};
  const 폴더 = 준.폴더 || (지도자리(root) && path.join(지도자리(root), '자리'));
  if (!폴더) return null;
  const 수 = Number(준.수 || process.env.SYNK_관련시험_자리) || 기본자리;
  const 값 = (v) => (Number.isFinite(v) && v >= 0 ? v : undefined);
  return { 폴더, 수: Math.max(1, Math.floor(수)),
    ...(값(준.기다림ms) !== undefined ? { 기다림ms: 준.기다림ms } : {}), ...(값(준.간격ms) !== undefined ? { 간격ms: 준.간격ms } : {}) };
}

/** 새파일: 이번 push로 처음 들어가는 경로 — SYNK_새파일(JSON 배열)로 넘긴다. push 전 작업본에서는 아직 추적 밖이라
 *  git ls-files로 훑는 시험이 못 본다(10-21 지면폰트 ⑦ 빨강 두 번이 모두 새 지면이었다 — tests/_git밖.js 이번push새파일).
 *  자리: 위 「자리」 — 시험이 { 폴더, 수, 기다림ms, 간격ms }를 주거나 false로 끈다. 결과의 자리 = { 번호, 수, 기다린초 }. */
// Windows CreateProcess는 전체 명령줄을 UTF-16 32,767자로 제한한다. 모든 인자를
// 따옴표로 감쌌을 때의 역슬래시/따옴표 이스케이프까지 세어 여유 있는 크기로 나눈다.
function 명령인자길이(value) {
  const text = String(value);
  let extra = 3, slashes = 0; // 여닫는 따옴표와 구분 공백
  for (const char of text) {
    if (char === '\\') slashes++;
    else { if (char === '"') extra += slashes + 1; slashes = 0; }
  }
  return text.length + extra + slashes;
}
function 시험인자묶음(시험, 고정) {
  if (process.platform !== 'win32') return [시험];
  const fixed = [process.execPath, ...고정].reduce((sum, arg) => sum + 명령인자길이(arg), 0) + 20;
  const batches = []; let batch = [], length = fixed;
  for (const file of 시험) {
    const size = 명령인자길이(file);
    if (fixed + size > 30000) throw new Error('시험 파일 경로가 Windows 명령 길이 한도를 넘는다');
    if (batch.length && length + size > 30000) { batches.push(batch); batch = []; length = fixed; }
    batch.push(file); length += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function 돌리기({ root, 시험, 워크트리 = false, 한도ms = 15 * 60e3, 새파일 = [], 자리 = undefined }) {
  if (!시험.length) return { 통과함: true, 시험: 0, 통과: 0, 실패수: 0, 실패: [], 초: 0 };
  const tap = path.join(os.tmpdir(), `synk-관련시험-${process.pid}-${Date.now()}.tap`);
  const env = { ...process.env };
  // node --test 안에서 부르면(시험·훅) 부모 실행기의 표시가 따라와 자식이 TAP 파일 대신 부모에게 결과를 보낸다 — 0건으로 읽힌다.
  delete env.NODE_TEST_CONTEXT;
  if (워크트리) env.CI = '1';
  if (새파일.length) env.SYNK_새파일 = JSON.stringify(새파일);
  // 한 번에 도는 시험 파일 수 — 기본(CPU-1)이면 자리 둘이 함께 돌 때 CPU를 넘겨 서로 느려진다(현장노트 시험_화면확인 동시 실행).
  const 동시 = Math.max(2, Math.floor((os.availableParallelism ? os.availableParallelism() : os.cpus().length) / 3));
  const 고정 = ['--test', '--test-timeout=120000', `--test-concurrency=${동시}`, '--test-reporter=tap'];
  let 묶음;
  try { 묶음 = 시험인자묶음(시험, [...고정, `--test-reporter-destination=${tap}`]); }
  catch (error) { return { ...tap읽기('', root), 통과함: false, 초: 0, 이유: error.message }; }
  const 설정 = 자리설정(root, 자리);
  const 잡음 = 설정 ? 자리잡기(설정.폴더, 설정) : null;
  const 시작 = process.hrtime.bigint();
  const 경과ms = () => Number((process.hrtime.bigint() - 시작) / 1000000n);
  const 합계 = { 시험: 0, 통과: 0, 실패수: 0, 취소: 0, 건너뜀: 0, 할일: 0, 실패: [] };
  let r = { status: 0 }, 실행수 = 0, 완료수 = 0, 읽기오류 = null, 예산소진 = false, 보고서 = 보고서판정(null);
  try {
    for (let index = 0; index < 묶음.length; index++) {
      const remaining = 한도ms === 0 ? 0 : index === 0 ? 한도ms : 한도ms - 경과ms();
      if (한도ms > 0 && remaining <= 0) { r = { status: null, error: { code: 'ETIMEDOUT' } }; 예산소진 = true; break; }
      const output = index === 0 ? tap : `${tap}.${index}`;
      let 글 = null;
      try {
        // 같은 pid·시각의 옛 보고서를 이번 실행의 증거로 읽지 않는다.
        try { fs.rmSync(output, { force: true }); }
        catch (error) { r = { status: null, error }; 읽기오류 = `${index + 1}번 묶음 TAP 경로 초기화 실패 (${error.code || error.message})`; break; }
        // 묶음마다 시간을 다시 주지 않는다. 하나의 자리와 전체 한도 안에서 모든 선택 파일을 실행한다.
        r = spawnSync(process.execPath, [...고정, `--test-reporter-destination=${output}`, ...묶음[index]],
          { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: remaining, maxBuffer: 64 << 20 });
        실행수++;
        try { 글 = fs.readFileSync(output, 'utf8'); }
        catch (error) {
          읽기오류 = `${index + 1}번 묶음 TAP 읽기 실패 (${error.code || error.message})`;
        }
      } finally {
        try { fs.rmSync(output, { force: true }); }
        catch (error) { console.error(`관련 시험 TAP 임시 파일 정리 실패 (${error.code || 'UNKNOWN'})`); }
      }
      const current = tap읽기(글, root);
      보고서 = 보고서판정(글);
      if (보고서.요약) for (const k of ['시험', '통과', '실패수', '취소', '건너뜀', '할일']) {
        합계[k] = 합계[k] === null || 보고서.요약[k] === null ? null : 합계[k] + 보고서.요약[k];
      }
      if (보고서.본실패 > 0) 합계.실패.push(...current.실패);
      // 한 묶음의 실제 실패나 실행 오류를 뒤 묶음의 통과/시간 초과가 가리지 못하게 한다.
      const 묶음통과 = !읽기오류 && !r.error && r.status === 0 && 보고서.상태 === '완료' &&
        보고서.요약.실패수 === 0 && 보고서.요약.취소 === 0 && 보고서.본실패 === 0;
      if (!묶음통과) break;
      완료수++;
    }
  } finally {
    if (잡음) 잡음.놓기();
  }
  // 실행 요청을 보내지 않은 뒤 묶음만 센다. 시작한 묶음 안에서 실제 완료된 수는 TAP 집계를 따른다.
  const 미실행파일 = 묶음.slice(실행수).reduce((sum, batch) => sum + batch.length, 0);
  const 미실행글 = 미실행파일 ? `전체 ${묶음.length}묶음 중 ${실행수}묶음에서 멈췄다. 남은 ${미실행파일}개 파일은 실행하지 않았다.` : '';
  const 시간넘김 = 예산소진 || r.error?.code === 'ETIMEDOUT';
  const 한도글 = 한도ms >= 60e3 ? `${Math.round(한도ms / 60e3)}분` : `${Math.round(한도ms / 1000)}초`;
  const 프로세스까닭 = 시간넘김 ? `${한도글} 안에 끝나지 않았다` : r.error ? `node --test 실행 실패 (${r.error.code || r.error.message})` :
    r.status === null ? `node --test 신호 ${r.signal || '알 수 없음'}` : r.status !== 0 && !(보고서.요약?.실패수 > 0) ? `node --test 종료 ${r.status}` : null;
  const 실패단서 = 보고서.본실패 > 0 || 보고서.실패취소단서 || 합계.실패수 > 0 || 합계.취소 > 0;
  const 시간예외근거 = 예산소진 || !읽기오류 && !실패단서 && (보고서.상태 === '완료' || 보고서.상태 === '중간' && 보고서.본통과 > 0);
  const 보고서까닭 = 보고서.본실패 > 0 ? `TAP 본문에 실패 결과 ${보고서.본실패}개가 있다` : 보고서.상태 === '완료' && 실패단서 ? 'TAP에 실패나 취소가 있다' : 보고서.까닭;
  const 보고서거절 = 시간넘김 ? !시간예외근거 : !r.error && r.status === 0 ? 완료수 !== 묶음.length : 보고서.상태 !== '완료';
  const TAP오류 = 읽기오류 || (!예산소진 && 보고서거절 ? `${Math.max(실행수, 1)}번 묶음 ${보고서까닭 || 'TAP의 정상 완료를 확인하지 못했다'}` : null);
  const 이유 = [[프로세스까닭, TAP오류].filter(Boolean).join(' · '), 미실행글].filter(Boolean).join(' ');
  return { ...합계, 초: Math.round(경과ms() / 1000), 통과함: 실행수 === 묶음.length && 완료수 === 묶음.length,
    ...(시간넘김 ? { 시간넘김: true } : {}), ...(TAP오류 ? { TAP오류 } : {}), ...(이유 ? { 이유 } : {}),
    ...(묶음.length > 1 ? { 묶음: { 전체: 묶음.length, 실행: 실행수, 선택파일: 시험.length, 미실행파일 } } : {}),
    ...(잡음 ? { 자리: { 번호: 잡음.번호, 수: 잡음.수, 기다린초: 잡음.기다린초 } } : {}) };
}

/** 한도만 넘기고 그때까지 깨진 시험은 없었나(돌리기 결과). 바로올리기는 이때 막지 않고 주의만 남긴다(10-22). */
function 시간만넘김(r) {
  return Boolean(r && r.시간넘김 && !r.TAP오류 && r.실패수 === 0 && r.취소 === 0 && !(r.실패 || []).length);
}

/** 결과 줄에 붙일 자리 글 — 기다렸거나 못 잡았을 때만. */
function 자리글(자리) {
  if (!자리) return '';
  if (자리.번호 === null) return ` · 자리 ${자리.수}개가 ${자리.기다린초}초 동안 안 비어 자리 없이 돌았다`;
  return 자리.기다린초 ? ` · 자리 기다림 ${자리.기다린초}초` : '';
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

function main(argv = process.argv.slice(2)) {
  const root = path.resolve(__dirname, '..');
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === '지도') {
    const trace = 값('--trace'), out = 값('--out');
    const 저장소 = path.resolve(값('--root') || root);
    if (!trace || !out) { console.error('사용: node tools/관련시험.js 지도 --trace <기록 폴더> --out <파일> [--root <저장소>]'); return 2; }
    const 추적들 = (git(저장소, ['-c', 'core.quotepath=false', 'ls-files', '-z']) || '').split('\0').filter(Boolean);
    const 시험 = 지도만들기(기록읽기(trace), 저장소, 추적들);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ 판: 1, 만든때: new Date().toISOString(), 시험 }));
    console.log(`지도: 시험 ${Object.keys(시험).length}개 · ${(fs.statSync(out).size / 1024).toFixed(0)}KB → ${out}`);
    return 0;
  }
  if (argv[0] === '지도받기') {
    const 지도 = 지도받기(root);
    console.log(지도 ? `받음: run ${지도.run} · 시험 ${Object.keys(지도.시험).length}개` : '못 받았다(GitHub 원격·gh 인증·artifact를 본다)');
    return 지도 ? 0 : 1;
  }
  const 경로들 = argv.filter((a) => !a.startsWith('--'));
  if (!경로들.length) { console.error('사용: node tools/관련시험.js <경로…> [--돌리기]'); return 2; }
  const 고름 = 고르기({ root, 바뀐: 경로들.map((p) => 상대(path.resolve(p), root) || p) });
  if (고름.기록전용) { console.log('기록 전용 경로뿐이다 — 고를 시험 없음(CI도 records-check만 돈다)'); return 0; }
  console.log(`관련 시험 ${고름.시험.length}개(지도 ${고름.지도 || '없음 — 글로만 골랐다'})`);
  for (const t of 고름.시험) console.log(`  ${t} — ${고름.까닭[t]}`);
  if (!argv.includes('--돌리기')) return 0;
  const g = git(root, ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir']);
  const [gd, cd] = (g || '').trim().split('\n');
  const r = 돌리기({ root, 시험: 고름.시험, 워크트리: Boolean(gd && cd && path.resolve(gd) !== path.resolve(cd)) });
  console.log(`${r.통과함 ? '통과' : 시간만넘김(r) ? '시간 넘김' : '깨짐'} — ${r.시간넘김 ? '끝까지 못 봄' : `${r.통과}/${r.시험}`} · ${r.초}초${자리글(r.자리)}${r.이유 ? ` · ${r.이유}` : ''}`);
  for (const x of r.실패) console.log(`  ✗ ${x.이름}${x.위치 ? ` (${x.위치})` : ''}`);
  return r.통과함 ? 0 : 1;
}

if (require.main === module) process.exitCode = main();

module.exports = { 고르기, 돌리기, 시간만넘김, 자리잡기, 자리글, 지도만들기, 지도읽기, 지도받기, 기록전용인가, 기록경로판정, 기록시험목록, CI시험목록, CI시험무늬, tap읽기, 보고서판정, git무늬, git무늬식, 읽나, 불러오는파일, 지도이름, 지도파일이름 };
