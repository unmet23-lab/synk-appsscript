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
 *   ③ 글: 시험 글에 바꾼 경로나 파일 이름이 적혀 있으면(흔한 이름은 빼고) — 지도에 없는 새 시험과 지도를 못 받았을 때를 덮는다.
 *      기록 전용 경로(트랙·결정·현장노트 …)는 글로 고르지 않는다(10-22). 내커밋·바로올리기·짝검사 시험은 트랙 경로를 가짜 저장소의
 *      파일 이름으로만 적는데도 트랙을 같이 올리는 push마다 이 규칙에 붙었고, PC가 바쁠 때 내커밋·바로올리기는 각 11분 남짓 걸렸다
 *      (현장노트 시험_화면확인).
 *      그 경로는 ② 지도의 「읽음」과, 지도가 모르는 시험(지도를 못 받았거나 지도 뒤에 생긴 시험)이면 records-check.yml이 도는
 *      시험으로 고른다 — 기록 전용 경로를 실제로 읽는 시험은 그 목록에 있어야 CI가 초록이다(읽기 대조 ②, tools/ci읽기대조.cjs).
 *   기록 전용 경로만 바꾼 push는 고르지 않는다 — CI도 그 push에는 무거운 검사를 안 띄운다(records-check가 돈다).
 * 돌리기: node --test --test-reporter=tap. 워크트리에서는 CI=1이다(git 밖 로컬 자료를 읽는 시험이 건너뛴다 — 현장노트 시험_화면확인).
 *   공용 작업본에서는 주지 않는다. 이번 push로 처음 들어가는 파일은 SYNK_새파일로 넘긴다(git ls-files로 훑는 시험이 보게, 10-22).
 *   한 PC에서 동시에 도는 관련 시험은 자리 파일로 둘까지다(아래 「자리」 — 기다린 시간은 15분 한도에 안 든다, 10-22).
 *   원천과 짝 파일(생성물·사본)이 어긋난 push는 이 시험이 아니라 tools/짝검사.js가 먼저 막는다(CI의 시험 밖 단계까지).
 * 지도는 공용 git 폴더 안(<git-common-dir>/synk-관련시험/지도.json)에 두어 저장소에는 안 들어간다. 경로는 모두 저장소 기준이다.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { tap실패 } = require('./lib/tap실패.js');

const 무거운 = '.github/workflows/syntax-check.yml';
const 기록흐름 = '.github/workflows/records-check.yml';
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

/** CI가 도는 시험 파일 — 추적되고 지금 디스크에 있는 것. */
function CI시험목록(root) {
  const 식들 = CI시험무늬(root).map(무늬식);
  const 목록 = git(root, ['-c', 'core.quotepath=false', 'ls-files', '-z', '--', 'tests']);
  return (목록 || '').split('\0').filter((p) => p && 식들.some((식) => 식.test(p)) && fs.existsSync(path.join(root, p)));
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

/** 바꾼 경로(저장소 기준) → { 시험: [파일…], 까닭: {파일: 까닭}, 기록전용, 지도: 'run 번호'|null }. 돌리지는 않는다. */
function 고르기({ root, 바뀐, 지도 = undefined, 받기 = true }) {
  const 경로들 = [...new Set(바뀐.map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '')))].filter(Boolean);
  if (기록전용인가(root, 경로들)) return { 시험: [], 까닭: {}, 기록전용: true, 지도: null };
  const 쓸지도 = 지도 === undefined ? 지도읽기(root, { 받기 }) : 지도;
  // 같은 push로 처음 올리는 시험 파일은 아직 추적되지 않는다 — CI 무늬에 맞고 디스크에 있으면 시험으로 센다.
  const 무늬들 = CI시험무늬(root).map(무늬식);
  const 새시험 = 경로들.filter((p) => 무늬들.some((식) => 식.test(p)) && fs.existsSync(path.join(root, p)));
  const 시험들 = [...new Set([...CI시험목록(root), ...새시험])];
  const 까닭 = {};
  const 고름 = (t, 왜) => { if (!까닭[t]) 까닭[t] = 왜; };
  for (const p of 경로들) if (시험들.includes(p)) 고름(p, '바꾼 시험');
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
      if (시험들.includes(t) && !(쓸지도 && 쓸지도.시험[t])) 고름(t, `기록 시험(records-check.yml)·지도에 없음: ${기록경로들[0]}`);
    }
  }
  const 이름들 = 경로들.filter((p) => !기록인가(p)).map((p) => [p, path.posix.basename(p)]).filter(([, b]) => !흔한이름.has(b));
  for (const t of 시험들) {
    if (까닭[t]) continue;
    let 글;
    try { 글 = fs.readFileSync(path.join(root, t), 'utf8'); } catch { continue; }
    for (const [p, b] of 이름들) {
      if (글.includes(p)) { 고름(t, `글에 경로: ${p}`); break; }
      const 줄기 = b.replace(/\.[^.]+$/, '');
      if (글.includes(b) || (줄기.length >= (/[가-힣]/.test(줄기) ? 3 : 6) && new RegExp(`['"\`/]${줄기.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`./]`).test(글))) { 고름(t, `글에 이름: ${b}`); break; }
    }
  }
  const 시험 = Object.keys(까닭).sort();
  return { 시험, 까닭, 기록전용: false, 지도: 쓸지도 ? 쓸지도.run || '로컬' : null };
}

// ── 돌리기 ────────────────────────────────────────────────────────────────────

/** TAP 요약과 깨진 잎 시험(「부모 › 잎」 이름·위치·시험이 찍은 → 안내) — tools/lib/tap실패.js. root 기준으로 위치를 줄인다. */
function tap읽기(글, root = null) {
  const r = tap실패(글, { root });
  return { 시험: r.시험, 통과: r.통과, 실패수: r.실패수, 취소: r.취소, 실패: r.실패.map((x) => ({ 이름: x.시험, 위치: x.위치, 파일: x.파일, ...(x.안내 && x.안내.length ? { 안내: x.안내 } : {}) })) };
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

/** 짧은 전체 잠금 — 쥐고 있는 동안만 표를 치우고 센다. 풀기 함수를 돌려준다. */
function 잠그기(폴더) {
  const 잠금 = path.join(폴더, 고르는중);
  for (;;) {
    try {
      fs.mkdirSync(잠금);
      return () => { try { fs.rmdirSync(잠금); } catch { /* 이미 없다 */ } };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(잠금).mtimeMs > 10e3) fs.rmdirSync(잠금); } catch { /* 그새 풀렸다 */ }
      잠깐(20);
    }
  }
}

/** 자리 하나를 잡는다 → { 번호(먼저 쥔 수), 수, 기다린초, 놓기() }. 기다림ms 안에 못 잡으면 번호 null(자리 없이 돈다 — 막지는 않는다). */
function 자리잡기(폴더, { 수 = 기본자리, 기다림ms = 30 * 60e3, 간격ms = 2000 } = {}) {
  const 시작 = Date.now();
  const 초 = () => Math.round((Date.now() - 시작) / 1000);
  fs.mkdirSync(폴더, { recursive: true });
  for (;;) {
    let 내자리 = null, 쥔수 = 0;
    const 풀기 = 잠그기(폴더);
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
function 돌리기({ root, 시험, 워크트리 = false, 한도ms = 15 * 60e3, 새파일 = [], 자리 = undefined }) {
  if (!시험.length) return { 통과함: true, 시험: 0, 통과: 0, 실패수: 0, 실패: [], 초: 0 };
  const tap = path.join(os.tmpdir(), `synk-관련시험-${process.pid}-${Date.now()}.tap`);
  const env = { ...process.env };
  // node --test 안에서 부르면(시험·훅) 부모 실행기의 표시가 따라와 자식이 TAP 파일 대신 부모에게 결과를 보낸다 — 0건으로 읽힌다.
  delete env.NODE_TEST_CONTEXT;
  if (워크트리) env.CI = '1';
  if (새파일.length) env.SYNK_새파일 = JSON.stringify(새파일);
  const 설정 = 자리설정(root, 자리);
  const 잡음 = 설정 ? 자리잡기(설정.폴더, 설정) : null;
  // 한 번에 도는 시험 파일 수 — 기본(CPU-1)이면 자리 둘이 함께 돌 때 CPU를 넘겨 서로 느려진다(현장노트 시험_화면확인 동시 실행).
  const 동시 = Math.max(2, Math.floor((os.availableParallelism ? os.availableParallelism() : os.cpus().length) / 3));
  const 시작 = Date.now();
  let r;
  try {
    r = spawnSync(process.execPath, ['--test', `--test-concurrency=${동시}`, '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...시험],
      { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 한도ms, maxBuffer: 64 << 20 });
  } finally {
    if (잡음) 잡음.놓기();
  }
  let 글 = '';
  try { 글 = fs.readFileSync(tap, 'utf8'); } catch { /* 아래 */ } finally { fs.rmSync(tap, { force: true }); }
  const 결과 = { ...tap읽기(글, root), 초: Math.round((Date.now() - 시작) / 1000), ...(잡음 ? { 자리: { 번호: 잡음.번호, 수: 잡음.수, 기다린초: 잡음.기다린초 } } : {}) };
  if (r.error && r.error.code === 'ETIMEDOUT') {
    // 끊기기 전까지의 결과는 TAP에 남는다 — 그때까지 깨진 것이 없으면 시간만넘김()이 참이다(바쁜 PC에서 느렸을 뿐일 수 있다).
    const 한도글 = 한도ms >= 60e3 ? `${Math.round(한도ms / 60e3)}분` : `${Math.round(한도ms / 1000)}초`;
    return { ...결과, 통과함: false, 시간넘김: true, 이유: `${한도글} 안에 끝나지 않았다` };
  }
  return { ...결과, 통과함: r.status === 0 && 결과.실패수 === 0, ...(r.status !== 0 && !결과.실패수 ? { 이유: `node --test 종료 ${r.status}` } : {}) };
}

/** 한도만 넘기고 그때까지 깨진 시험은 없었나(돌리기 결과). 바로올리기는 이때 막지 않고 주의만 남긴다(10-22). */
function 시간만넘김(r) {
  return Boolean(r && r.시간넘김 && !(r.실패 || []).length);
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

module.exports = { 고르기, 돌리기, 시간만넘김, 자리잡기, 자리글, 지도만들기, 지도읽기, 지도받기, 기록전용인가, 기록경로판정, 기록시험목록, CI시험목록, CI시험무늬, tap읽기, git무늬, git무늬식, 읽나, 지도이름, 지도파일이름 };
