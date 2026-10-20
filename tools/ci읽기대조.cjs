#!/usr/bin/env node
'use strict';
/* CI 읽기 대조 — 무거운 검사(syntax-check.yml)가 돈 뒤, tools/ci읽기기록.cjs가 남긴 실제 읽기로 세 가지를 본다(2026-10-20).
 *  ① syntax-check.yml의 paths-ignore와 records-check.yml의 paths(제 워크플로 파일은 뺀다)가 같은 목록이고,
 *     두 파일의 저장소 체크아웃 sparse-checkout 목록도 같다.
 *  ② 기록 전용 경로(①의 목록)를 읽은 시험은 모두 records-check.yml이 돈다. 시험 밖 단계는 읽지 않는다.
 *     — 아니면 기록만 바꾼 push에서 그 시험이 아무 데서도 안 돌고, 다음 코드 push가 남의 탓으로 빨개진다.
 *  ③ 희소 체크아웃이 뺀 파일(skip-worktree)을 아무도 열거나 재지 않는다.
 *     — 아니면 그 시험이 깨지거나 「파일이 없으면 건너뜀」처럼 조용히 덜 본다. 폴더 나열만은 허용한다
 *       (나열하는 도구는 코드·html·md만 골라, 미디어만 든 폴더가 없어도 결과가 같다 — 10-20 실측).
 * 사용: node tools/ci읽기대조.cjs --trace <기록 폴더> [--root <저장소>]
 * 종료: 0 통과 · 1 어긋남 · 2 확인 불가(기록·워크플로를 못 읽음) */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 푸시필터, 걸리나 } = require('./원격ci.js');

const 무거운 = 'syntax-check.yml', 기록 = 'records-check.yml';

/* 저장소 체크아웃 단계(repository: 가 없는 actions/checkout)의 sparse-checkout 블록 줄들. */
function 희소목록(yaml) {
  const 줄들 = String(yaml).replace(/\r/g, '').split('\n');
  const 결과 = [];
  for (let i = 0; i < 줄들.length; i++) {
    const m = 줄들[i].match(/^(\s*)sparse-checkout:\s*\|\s*$/);
    if (!m) continue;
    let 시작 = i;
    while (시작 > 0 && !/^\s*-\s+(uses|name):/.test(줄들[시작])) 시작--;
    const 단계 = 줄들.slice(시작, i);
    if (단계.some((l) => /^\s*repository:/.test(l)) || !단계.some((l) => /actions\/checkout@/.test(l))) continue;
    const 목록 = [];
    for (let j = i + 1; j < 줄들.length; j++) {
      if (!줄들[j].trim()) continue;
      if (줄들[j].match(/^\s*/)[0].length <= m[1].length) break;
      목록.push(줄들[j].trim());
    }
    결과.push(목록);
  }
  return 결과;
}

function 시험목록(yaml) {
  return [...new Set([...String(yaml).matchAll(/tests\/[^\s'"`]+\.test\.[cm]?js/g)].map((m) => m[0]))];
}

/* 기록 폴더의 프로세스들을 「주인」(시험 파일, 아니면 단계 명령)별로 묶는다. */
function 주인별(기록들, root) {
  const byPid = new Map(기록들.map((r) => [r.pid, r]));
  const 시험파일 = (r) => {
    const argv = r.argv || [];
    const 파일들 = argv.slice(1).filter((a) => /(^|[\\/])tests[\\/][^\\/]+\.test\.[cm]?js$/.test(a));
    if (파일들.length !== 1) return null; // 여러 파일을 받은 것은 시험 실행기다 — 그 아래 파일별 프로세스가 주인이다
    return 상대(path.resolve(r.cwd || root, 파일들[0]), root);
  };
  const 주인 = (r) => {
    for (let cur = r, n = 0; cur && n < 64; cur = byPid.get(cur.ppid), n++) {
      const t = 시험파일(cur);
      if (t) return t;
    }
    // 시험이 아니면 맨 위 프로세스의 명령(단계)로 부른다.
    let top = r;
    for (let n = 0; byPid.get(top.ppid) && n < 64; n++) top = byPid.get(top.ppid);
    const 명령 = (top.argv || []).slice(1).find((a) => !a.startsWith('-')) || '(node)';
    return '단계:' + (상대(path.resolve(top.cwd || root, 명령), root) || path.basename(명령));
  };
  const 묶음 = new Map();
  for (const r of 기록들) {
    const k = 주인(r);
    if (!묶음.has(k)) 묶음.set(k, []);
    묶음.get(k).push(r);
  }
  return 묶음;
}

function 상대(full, root) {
  const rel = path.relative(root, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

/* 자식 명령 인자 가운데 저장소 경로로 읽히는 것(git show HEAD:<경로> 포함). 임시 저장소에서 돈 명령은 뺀다 —
 * cwd가 저장소 밖이거나, git의 -C·--git-dir·--work-tree(또는 GIT_DIR·GIT_WORK_TREE)가 저장소 밖을 가리키면. */
function 인자경로(spawn, root) {
  const 안 = (p) => 상대(p, root) !== null || path.resolve(p) === path.resolve(root);
  let cwd = spawn.cwd;
  const args = spawn.args || [];
  const 깃자리 = [spawn.gitDir, spawn.gitWorkTree];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-C' && args[i + 1]) cwd = path.resolve(cwd || root, args[++i]);
    else if ((a === '--git-dir' || a === '--work-tree') && args[i + 1]) 깃자리.push(path.resolve(cwd || root, args[++i]));
    else if (/^--(git-dir|work-tree)=/.test(a)) 깃자리.push(path.resolve(cwd || root, a.slice(a.indexOf('=') + 1)));
  }
  if (!cwd || !안(cwd) || 깃자리.some((p) => p && !안(p))) return [];
  const 결과 = [];
  for (const a of args) {
    // <rev>:<경로>는 저장소 맨 위 기준이다(./로 시작하면 cwd 기준). 그 밖의 인자는 cwd 기준 경로로 본다.
    const 판경로 = a.includes(':') && !/^[A-Za-z]:[\\/]/.test(a) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(a);
    const 뒤 = 판경로 ? a.slice(a.indexOf(':') + 1) : a;
    if (!뒤 || 뒤.startsWith('-') || /[\s*?]/.test(뒤)) continue;
    const r = 상대(path.resolve(판경로 && !/^\.\.?\//.test(뒤) ? root : cwd, 뒤), root);
    if (r) 결과.push(r);
  }
  return 결과;
}

function 대조({ root, 기록들, 무거운yaml, 기록yaml, 희소빠짐 }) {
  const 어긋남 = [];
  const 무거운필터 = 푸시필터(무거운yaml), 기록필터 = 푸시필터(기록yaml);
  if (무거운필터.종류 !== 'paths-ignore') 어긋남.push(`${무거운}: on.push.paths-ignore 목록을 못 읽었다(${무거운필터.종류})`);
  if (기록필터.종류 !== 'paths') 어긋남.push(`${기록}: on.push.paths 목록을 못 읽었다(${기록필터.종류})`);
  if (어긋남.length) return { 어긋남, 셈: {} };
  const 기록경로들 = 기록필터.패턴.filter((p) => p !== `.github/workflows/${기록}`);
  const 한쪽만 = [...무거운필터.패턴.filter((p) => !기록경로들.includes(p)).map((p) => `${무거운}에만: ${p}`),
    ...기록경로들.filter((p) => !무거운필터.패턴.includes(p)).map((p) => `${기록}에만: ${p}`)];
  for (const x of 한쪽만) 어긋남.push(`① 기록 전용 경로 목록이 다르다 — ${x}`);
  const 희소들 = [희소목록(무거운yaml), 희소목록(기록yaml)];
  if (희소들.some((x) => x.length !== 1)) 어긋남.push(`① 저장소 체크아웃의 sparse-checkout 블록을 두 파일에서 하나씩 찾지 못했다(${희소들.map((x) => x.length).join('·')})`);
  else if (희소들[0][0].join('\n') !== 희소들[1][0].join('\n')) 어긋남.push(`① ${무거운}와 ${기록}의 sparse-checkout 목록이 다르다 — 같은 줄로 맞춘다`);
  const 가벼운시험 = new Set(시험목록(기록yaml));
  const 기록경로인가 = (p) => 걸리나(무거운필터, [p]) === false; // 그 파일 하나만 바꾼 push 가 무거운 검사를 안 띄운다
  const 묶음 = 주인별(기록들, root);
  const 기록읽은 = new Map(), 빠진읽기 = new Map(), 폴더인가 = new Map();
  // 폴더는 세지 않는다 — 폴더를 훑는 도구는 그 안에서 실제로 연 파일로 잡힌다(나열만으로는 결과가 달라지지 않는다).
  const 폴더 = (rel) => {
    if (!폴더인가.has(rel)) { let d = false; try { d = fs.statSync(path.join(root, rel)).isDirectory(); } catch { /* 없는 경로는 파일로 본다 */ } 폴더인가.set(rel, d); }
    return 폴더인가.get(rel);
  };
  for (const [주인, procs] of 묶음) {
    for (const r of procs) {
      for (const [full, kinds] of r.reads || []) {
        const rel = 상대(full, root);
        if (!rel || /(^|\/)(node_modules|\.git)(\/|$)/.test(rel) || 폴더(rel)) continue;
        if (기록경로인가(rel)) { if (!기록읽은.has(주인)) 기록읽은.set(주인, new Set()); 기록읽은.get(주인).add(rel); }
        if (희소빠짐.has(rel) && kinds.some((k) => k !== 'dir')) { if (!빠진읽기.has(주인)) 빠진읽기.set(주인, new Set()); 빠진읽기.get(주인).add(rel); }
      }
      for (const s of r.spawns || []) for (const rel of 인자경로(s, root)) {
        if (기록경로인가(rel)) { if (!기록읽은.has(주인)) 기록읽은.set(주인, new Set()); 기록읽은.get(주인).add(rel + ' (자식 명령)'); }
      }
    }
  }
  for (const [주인, 경로들] of 기록읽은) {
    if (가벼운시험.has(주인)) continue;
    const 보기 = [...경로들].slice(0, 3).join(', ');
    어긋남.push(주인.startsWith('단계:')
      ? `② ${주인.slice(3)} 단계가 기록 전용 경로를 읽는다(${보기}) — 기록만 바꾼 push에서는 이 단계가 안 돈다. 그 경로를 ${무거운} paths-ignore·${기록} paths에서 뺀다`
      : `② ${주인}가 기록 전용 경로를 읽는다(${보기}) — ${기록}의 node --test 줄에 이 시험을 더하거나, 그 경로를 두 목록에서 뺀다`);
  }
  for (const [주인, 경로들] of 빠진읽기) {
    const 보기 = [...경로들].slice(0, 5).join(', ');
    어긋남.push(`③ ${주인.replace(/^단계:/, '')}가 희소 체크아웃이 뺀 파일을 연다(${보기}${경로들.size > 5 ? ` 외 ${경로들.size - 5}개` : ''}) — ${무거운}·${기록}의 sparse-checkout에 그 파일(이나 폴더/**)을 다시 넣는 줄을 더한다`);
  }
  return { 어긋남, 셈: { 프로세스: 기록들.length, 주인: 묶음.size, 시험: [...묶음.keys()].filter((k) => !k.startsWith('단계:')).length,
    기록읽은시험: [...기록읽은.keys()].length, 가벼운시험: 가벼운시험.size, 희소빠짐: 희소빠짐.size } };
}

function main(argv = process.argv.slice(2)) {
  let trace = process.env.SYNK_READ_TRACE_DIR, root = path.resolve(__dirname, '..');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--trace') trace = argv[++i];
    else if (argv[i] === '--root') root = path.resolve(argv[++i]);
    else { console.error(`[ci읽기대조] 모르는 인자: ${argv[i]}`); return 2; }
  }
  const 읽기 = (f) => { try { return fs.readFileSync(path.join(root, '.github', 'workflows', f), 'utf8'); } catch { return null; } };
  const 무거운yaml = 읽기(무거운), 기록yaml = 읽기(기록);
  if (!무거운yaml || !기록yaml) { console.error(`[ci읽기대조] 확인 불가 — ${무거운}·${기록}를 못 읽었다`); return 2; }
  let 파일들 = [];
  try { 파일들 = fs.readdirSync(trace).filter((f) => f.endsWith('.json')); } catch { /* 아래에서 0개로 잡는다 */ }
  if (!trace || !파일들.length) { console.error(`[ci읽기대조] 확인 불가 — 읽기 기록이 없다(${trace || 'SYNK_READ_TRACE_DIR 없음'}). 통과가 아니다.`); return 2; }
  const 기록들 = [];
  for (const f of 파일들) { try { 기록들.push(JSON.parse(fs.readFileSync(path.join(trace, f), 'utf8'))); } catch { /* 깨진 하나는 뺀다 */ } }
  const ls = spawnSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-t', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 });
  if (ls.status !== 0) { console.error('[ci읽기대조] 확인 불가 — git ls-files를 못 돌렸다'); return 2; }
  const 희소빠짐 = new Set(ls.stdout.split('\0').filter((l) => l.startsWith('S ')).map((l) => l.slice(2)));
  const { 어긋남, 셈 } = 대조({ root, 기록들, 무거운yaml, 기록yaml, 희소빠짐 });
  if (어긋남.length) {
    console.log(`[ci읽기대조] ❌ 어긋남 ${어긋남.length}건`);
    for (const x of 어긋남) console.log('  - ' + x);
    return 1;
  }
  console.log(`[ci읽기대조] ✅ 통과 — 프로세스 ${셈.프로세스}개 · 시험 ${셈.시험}개 · 기록 전용 경로를 읽은 시험 ${셈.기록읽은시험}개(모두 ${기록}이 돈다, 목록 ${셈.가벼운시험}개) · 희소로 뺀 파일 ${셈.희소빠짐}개 중 열린 것 0`);
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { 대조, 희소목록, 시험목록, 주인별, 인자경로, main };
