#!/usr/bin/env node
'use strict';
/**
 * 내커밋 — 여러 세션이 함께 쓰는 작업본에서 내 파일만 커밋하고, 내 커밋만 origin에 올린다.
 *
 *   node tools/내커밋.js 커밋 <경로…> -m "<메시지>"                  미리 보기(커밋하지 않는다)
 *   node tools/내커밋.js 커밋 <경로…> -m "<메시지>" --실행            커밋
 *   node tools/내커밋.js 커밋 … --조각 docs/_ops/트랙.md=a1b2c3       그 파일은 고른 조각만 올린다
 *   node tools/내커밋.js 올리기 <커밋…>                               미리 보기(fetch만 한다)
 *   node tools/내커밋.js 올리기 <커밋…> --실행 [--합치기]              내 커밋만 origin/master에 push
 *   공통: --json · --저장소 <폴더>(기본: 지금 폴더의 저장소) · --줄끝그대로(줄끝을 일부러 바꾸는 커밋만)
 *   커밋: -F <메시지 파일> · --폴더(폴더 아래 바뀐 파일이 모두 내 것일 때만) · --자세히(바뀐 파일마다 조각을 보인다)
 *   올리기: --원격 <이름>(기본 origin) · --가지 <이름>(기본 master)
 *   git 2.31 이상(커밋)·2.43 이상(올리기, merge-file --object-id)이 필요하다.
 *
 * 커밋 — 공용 인덱스(git add → git commit)를 쓰지 않는다.
 *   1. HEAD를 바탕으로 고정하고 별도 인덱스(GIT_INDEX_FILE)에 바탕을 읽는다.
 *   2. 지정한 경로만 올린다. 여러 세션이 같이 고치는 문서(아래 공용문서)는 통째로 올리지 않는다.
 *      미리 보기가 보여 주는 조각 가운데 내 것만 --조각으로 고르면 바탕 판에 그 조각만 얹는다.
 *      폴더 경로는 그 아래 남의 파일이 섞일 수 있어 --폴더 없이는 파일 목록만 보이고 멈춘다. 하위 저장소(gitlink)는 올리지 않는다.
 *   3. 줄끝은 바탕 판을 따른다. 바탕에 있던 줄은 바탕 줄끝 그대로, 새 줄은 이웃 줄을 따른다. 맞추고 나니 바탕과 같으면 커밋하지 않는다.
 *   4. 저장 용량 검사(`npm run check:storage`와 같은 tools/git-storage-check.cjs)를 별도 인덱스로 돌린다.
 *   5. commit-tree(훅이 돌지 않는다) → update-ref CAS. 그사이 HEAD가 움직였으면 새 HEAD로 처음부터 한다(세 번까지).
 *   6. 곧바로 공용 인덱스의 그 경로만 새 HEAD에 맞춘다(git reset -q -- 경로). 못 맞추면 가지를 되돌린다.
 *   index.lock은 tools/git잠금.js로 가려 기다리고, 주인 없는 잠금만 한 번 치운다.
 *   공용 인덱스에 내 경로의 다른 스테이징이 있으면 아무것도 하지 않는다(남이 올려 둔 것일 수 있다).
 *
 * 올리기 — 작업본·공용 인덱스·로컬 가지는 건드리지 않는다(--합치기만 로컬 가지에 병합 커밋 하나를 더한다).
 *   미리 보기도 fetch로 refs/remotes/origin/master를 새로 하고, 다시 쌓은 blob·커밋 객체를 저장소에 쓴다(어느 가지도 가리키지 않는다).
 *   1. origin/master를 fetch한다. 내 커밋이 origin/master 바로 위에 이어져 있으면 그대로 올리고, 아니면 별도 인덱스로
 *      origin/master 위에 내 커밋의 바뀐 경로만 다시 쌓는다(같은 메시지·작성자). 남의 미푸시 커밋은 올라가지 않는다.
 *      그대로 올릴 커밋에 줄끝만 원격 판과 다른 줄이 있으면 줄끝을 맞춰 다시 쌓는다.
 *   2. 경로마다: 원격 판이 내 부모 판과 같으면 내 판, 다르면 git merge-file. 문서가 겹치면 원격에도 있는 앞뒤 줄에 맞춰 붙인다.
 *   3. 검사: 올라갈 줄은 모두 내 커밋에서 온 줄(남의 미푸시 줄이 새지 않음) · 내 줄이 빠지지 않음 · 줄끝은 원격 판을 따름 ·
 *      저장 용량(git-storage-check.cjs --base origin/master --head <올릴 머리>).
 *   4. --실행이면 빨리감기 push(강제 없음). 그새 origin이 움직였으면 다시 fetch해 처음부터 한다(세 번까지).
 *   5. --합치기: origin에 있는 남의 커밋이 바꾼 경로가 모두 로컬과 같을 때만 로컬 가지에 「트리는 로컬 그대로」 병합 커밋을 더한다.
 *      다시 쌓으며 줄끝을 맞춘 경로가 있으면 로컬과 origin 판이 달라 합치지 않는다.
 *
 * 함정과 고친 기록: docs/현장노트/git_줄끝_잠금.md. 시험: node --test tests/내커밋.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const 잠금도구 = require('./git잠금.js');
const { checkRepository } = require('./git-storage-check.cjs');

/** 여러 세션이 같이 고치는 문서 — 통째로 올리지 않고 내 조각만 고른다(10-05~10-19 커밋 수 상위). */
const 공용문서 = [
  'AGENTS.md', 'CLAUDE.md', 'DESIGN.md', 'docs/AI_운영원칙.md', 'docs/문서_지도.md',
  'docs/_ops/결정.md', 'docs/_ops/트랙.md', 'docs/마케팅/제작양식/만족사례_장부.md',
  /^docs\/현장노트\/[^/]+\.md$/,
];
/** 다시 쌓다 겹친 자리를 원격에도 있는 앞뒤 줄로 맞춰 붙여도 되는 문서. 코드·JSON은 겹치면 멈춘다. */
const 맞춰붙일문서 = /\.(md|markdown|txt|jsonl|csv|tsv)$/i;
const 차이한도 = 3000;
const 영 = /^0+$/;
const 위치환경 = /^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|PREFIX)$/;
const 좋은결과 = new Set(['미리 보기', '커밋함', '커밋할 것 없음', '올림', '올릴 것 없음']);

class 멈춤 extends Error {
  constructor(이유, 덧 = {}) { super(이유); this.이유 = 이유; this.덧 = 덧; }
}
class 사용법오류 extends Error {}

// ── git ─────────────────────────────────────────────────────────────────────

function 기본환경() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!위치환경.test(k)) env[k] = v;
  env.GIT_TERMINAL_PROMPT = '0';
  return env;
}

function 잠깐(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** git(args) → stdout 버퍼. git.글(args) → 다듬은 글. git.돌리기(args, {허용: null})는 실패해도 결과를 준다. */
function git도구(저장소) {
  const 바탕env = 기본환경();
  function 돌리기(args, { env, input, 허용 = [0] } = {}) {
    const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: 저장소, env: { ...바탕env, ...env }, input, maxBuffer: 1024 * 1024 * 1024, windowsHide: true,
    });
    if (r.error) throw r.error;
    if (허용 && !허용.includes(r.status)) {
      const e = new Error(`git ${args.join(' ')} 실패(${r.status}): ${String(r.stderr || '').trim()}`);
      e.status = r.status;
      throw e;
    }
    return r;
  }
  const git = (args, o) => 돌리기(args, o).stdout;
  git.글 = (args, o) => git(args, o).toString('utf8').trim();
  git.돌리기 = 돌리기;
  git.저장소 = 저장소;
  return git;
}

function 저장소찾기(폴더) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: 폴더, env: 기본환경(), windowsHide: true });
  if (r.error || r.status !== 0) throw new 멈춤(`git 저장소가 아니다: ${폴더}`);
  return path.resolve(String(r.stdout).trim());
}

function 경로맞추기(저장소, 입력, 기준폴더) {
  const 상대 = path.relative(저장소, path.resolve(기준폴더, 입력));
  if (!상대) throw new 사용법오류('저장소 전체는 줄 수 없다 — 파일이나 폴더를 준다');
  if (상대 === '..' || 상대.startsWith(`..${path.sep}`) || path.isAbsolute(상대)) throw new 사용법오류(`저장소 밖 경로다: ${입력}`);
  return 상대.split(path.sep).join('/');
}

function 별도인덱스(git, 바탕) {
  const 파일 = path.join(os.tmpdir(), `synk-mycommit-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.index`);
  const env = { GIT_INDEX_FILE: 파일 };
  git(['read-tree', 바탕], { env });
  return { 파일, env, 치우기() { fs.rmSync(파일, { force: true }); fs.rmSync(`${파일}.lock`, { force: true }); } };
}

/** diff-index·diff-tree의 -z 날 출력 → [{옛모드, 새모드, 옛, 새, 상태, 경로}] (없는 쪽 blob은 null) */
function 날차이읽기(버퍼) {
  const 칸 = 버퍼.toString('utf8').split('\0');
  const 결과 = [];
  for (let i = 0; i + 1 < 칸.length; i += 2) {
    if (!칸[i]) break;
    const m = /^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/.exec(칸[i]);
    if (!m) throw new Error(`git 차이 출력을 못 읽었다: ${칸[i]}`);
    결과.push({ 옛모드: m[1], 새모드: m[2], 옛: 영.test(m[3]) ? null : m[3], 새: 영.test(m[4]) ? null : m[4], 상태: m[5], 경로: 칸[i + 1] });
  }
  return 결과;
}

/** 트리에서 경로들의 {모드, sha}. 없는 경로는 빠진다. */
function 트리항목들(git, 트리, 경로들) {
  const 찾을 = new Set(경로들);
  const 결과 = new Map();
  if (!찾을.size) return 결과;
  for (const 줄 of git(['ls-tree', '-r', '-z', 트리]).toString('utf8').split('\0')) {
    if (!줄) continue;
    const 탭 = 줄.indexOf('\t');
    const 경로 = 줄.slice(탭 + 1);
    if (!찾을.has(경로)) continue;
    const [모드, 종류, sha] = 줄.slice(0, 탭).split(' ');
    if (종류 === 'blob') 결과.set(경로, { 모드, sha });
  }
  return 결과;
}

/** blob 여럿을 한 번에 읽는다. */
function 블롭읽기(git, 저장, shas) {
  const 고유 = [...new Set(shas.filter((s) => s && !저장.has(s)))];
  if (!고유.length) return 저장;
  const 출력 = git(['cat-file', '--batch'], { input: `${고유.join('\n')}\n` });
  let p = 0;
  for (const sha of 고유) {
    const 줄끝 = 출력.indexOf(0x0a, p);
    const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(출력.subarray(p, 줄끝).toString('utf8'));
    if (!m || m[1] !== sha) throw new Error(`blob을 못 읽었다: ${sha}`);
    const 크기 = Number(m[3]);
    저장.set(sha, 출력.subarray(줄끝 + 1, 줄끝 + 1 + 크기));
    p = 줄끝 + 1 + 크기 + 1;
  }
  return 저장;
}

function 블롭(git, 저장, sha) {
  if (!sha) return Buffer.alloc(0);
  if (!저장.has(sha)) 블롭읽기(git, 저장, [sha]);
  return 저장.get(sha);
}

function 블롭쓰기(git, 저장, 버퍼) {
  const sha = git.글(['hash-object', '-w', '--no-filters', '--stdin'], { input: 버퍼 });
  저장.set(sha, 버퍼);
  return sha;
}

/** check-attr로 text가 꺼진(-text·binary) 경로 */
function 글아닌경로(git, 경로들) {
  const 결과 = new Set();
  if (!경로들.length) return 결과;
  const 칸 = git(['check-attr', '--stdin', '-z', 'text'], { input: `${경로들.join('\0')}\0` }).toString('utf8').split('\0');
  for (let i = 0; i + 2 < 칸.length; i += 3) if (칸[i + 2] === 'unset') 결과.add(칸[i]);
  return 결과;
}

function 조상인가(git, 앞, 뒤) {
  return git.돌리기(['merge-base', '--is-ancestor', 앞, 뒤], { 허용: [0, 1] }).status === 0;
}

function git버전확인(git, 최소, 까닭) {
  const m = /(\d+)\.(\d+)/.exec(git.글(['--version']));
  const 판 = m ? [Number(m[1]), Number(m[2])] : [0, 0];
  if (판[0] < 최소[0] || (판[0] === 최소[0] && 판[1] < 최소[1])) throw new 멈춤(`git ${최소.join('.')} 이상이 필요하다(${까닭}) — 지금 ${판.join('.')}`);
}

// ── 줄 ──────────────────────────────────────────────────────────────────────
// 파일 내용은 latin1로 풀어 다룬다(바이트 그대로 돌아온다). 사람에게 보일 때만 UTF-8로 읽는다.

const 글로 = (버퍼) => 버퍼.toString('latin1');
const 바이트로 = (글) => Buffer.from(글, 'latin1');
const 보이게 = (글) => Buffer.from(글, 'latin1').toString('utf8');
const 이진인가 = (버퍼) => 버퍼.subarray(0, 8000).includes(0);

/** 글 → [{글, 끝}] (끝: '\r\n' · '\n' · ''(마지막 줄에 줄바꿈 없음)) */
function 줄나누기(글) {
  const 줄 = [];
  let i = 0;
  while (i < 글.length) {
    const j = 글.indexOf('\n', i);
    if (j < 0) { 줄.push({ 글: 글.slice(i), 끝: '' }); break; }
    if (j > i && 글[j - 1] === '\r') 줄.push({ 글: 글.slice(i, j - 1), 끝: '\r\n' });
    else 줄.push({ 글: 글.slice(i, j), 끝: '\n' });
    i = j + 1;
  }
  return 줄;
}

function 줄잇기(줄들) {
  return 줄들.map((l) => l.글 + l.끝).join('');
}

/** 마지막이 아닌 줄에 줄바꿈이 없으면(원래 파일 끝 줄 뒤에 줄을 이었을 때) 줄바꿈을 붙인다. 모양은 뒤에 줄끝맞추기가 정한다. */
function 줄바꿈채우기(줄들) {
  return 줄들.map((l, i) => (l.끝 === '' && i < 줄들.length - 1 ? { 글: l.글, 끝: '\n' } : l));
}

/** 줄 목록 a → b의 차이(Myers). ['=', a번, b번] · ['-', a번] · ['+', b번]을 차례대로. 너무 다르면 가운데를 통째로 바꾼 것으로 본다. */
function 줄차이(a, b) {
  let 앞 = 0;
  while (앞 < a.length && 앞 < b.length && a[앞] === b[앞]) 앞++;
  let 뒤 = 0;
  while (뒤 < a.length - 앞 && 뒤 < b.length - 앞 && a[a.length - 1 - 뒤] === b[b.length - 1 - 뒤]) 뒤++;
  const 가운데a = a.slice(앞, a.length - 뒤), 가운데b = b.slice(앞, b.length - 뒤);
  const 가운데 = 마이어스(가운데a, 가운데b) || [...가운데a.map((_, i) => ['-', i]), ...가운데b.map((_, j) => ['+', j])];
  const ops = [];
  for (let i = 0; i < 앞; i++) ops.push(['=', i, i]);
  for (const op of 가운데) ops.push(op[0] === '=' ? ['=', op[1] + 앞, op[2] + 앞] : [op[0], op[1] + 앞]);
  for (let k = 0; k < 뒤; k++) ops.push(['=', a.length - 뒤 + k, b.length - 뒤 + k]);
  return ops;
}

function 마이어스(a, b) {
  const N = a.length, M = b.length;
  if (!N) return b.map((_, j) => ['+', j]);
  if (!M) return a.map((_, i) => ['-', i]);
  const 번호 = new Map();
  const 번호로 = (s) => { let v = 번호.get(s); if (v === undefined) { v = 번호.size; 번호.set(s, v); } return v; };
  const A = Int32Array.from(a, 번호로), B = Int32Array.from(b, 번호로);
  const MAX = N + M, 한도 = Math.min(MAX, 차이한도), 중 = MAX + 2;
  const V = new Int32Array(2 * MAX + 5);
  const 자취 = [];
  let 찾음 = -1;
  for (let d = 0; d <= 한도 && 찾음 < 0; d++) {
    자취.push(V.slice(중 - d - 1, 중 + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && V[중 + k - 1] < V[중 + k + 1])) ? V[중 + k + 1] : V[중 + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      V[중 + k] = x;
      if (x >= N && y >= M) { 찾음 = d; break; }
    }
  }
  if (찾음 < 0) return null;
  const ops = [];
  let x = N, y = M;
  for (let d = 찾음; d >= 0; d--) {
    const v = 자취[d];
    const 값 = (k) => v[k + d + 1];
    const k = x - y;
    const 아래 = k === -d || (k !== d && 값(k - 1) < 값(k + 1));
    const pk = 아래 ? k + 1 : k - 1;
    const px = 값(pk), py = px - pk;
    while (x > px && y > py) { ops.push(['=', x - 1, y - 1]); x--; y--; }
    if (d > 0) ops.push(아래 ? ['+', py] : ['-', px]);
    x = px; y = py;
  }
  return ops.reverse();
}

/** 차이를 조각으로 묶는다: 바탕 [a1, a2)를 새 [b1, b2)로 바꾼 덩어리. id는 바뀐 줄 내용의 해시 앞 6자리. */
function 조각나누기(ops, B, N) {
  const 묶음 = [];
  let i = 0, j = 0, 지금 = null;
  for (const op of ops) {
    if (op[0] === '=') {
      if (지금) { 묶음.push(지금); 지금 = null; }
      i = op[1] + 1; j = op[2] + 1;
      continue;
    }
    if (!지금) 지금 = { a1: i, a2: i, b1: j, b2: j };
    if (op[0] === '-') { 지금.a2 = op[1] + 1; i = op[1] + 1; } else { 지금.b2 = op[1] + 1; j = op[1] + 1; }
  }
  if (지금) 묶음.push(지금);
  const 본 = new Map();
  for (const m of 묶음) {
    const h = crypto.createHash('sha1');
    for (let x = m.a1; x < m.a2; x++) h.update(`-${B[x].글}\n`, 'latin1');
    for (let y = m.b1; y < m.b2; y++) h.update(`+${N[y].글}\n`, 'latin1');
    const id = h.digest('hex').slice(0, 6);
    const n = (본.get(id) || 0) + 1;
    본.set(id, n);
    m.id = n > 1 ? `${id}-${n}` : id;
  }
  return 묶음;
}

function 조각만들기(바탕글, 새글) {
  const B = 줄나누기(바탕글), N = 줄나누기(새글);
  return { B, N, 묶음: 조각나누기(줄차이(B.map((l) => l.글), N.map((l) => l.글)), B, N) };
}

/** --조각 값: 「전부」 또는 「id」·「id:줄」·「id:줄-줄」을 쉼표로. → '전부' | Map(id → true | Set(줄 번호)) */
function 고름읽기(값) {
  const 글 = String(값 || '').trim();
  if (글 === '전부') return '전부';
  const 고름 = new Map();
  for (const 칸 of 글.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^([0-9a-f]{6}(?:-\d+)?)(?::(\d+)(?:-(\d+))?)?$/.exec(칸);
    if (!m) throw new 사용법오류(`조각 고르기를 못 읽었다: ${칸} (예: a1b2c3 · a1b2c3:2 · a1b2c3:2-4 · 전부)`);
    if (m[2] === undefined) { 고름.set(m[1], true); continue; }
    const 처음 = Number(m[2]), 끝 = m[3] === undefined ? 처음 : Number(m[3]);
    if (처음 < 1 || 끝 < 처음) throw new 사용법오류(`줄 번호가 이상하다: ${칸}`);
    const 있던 = 고름.get(m[1]);
    if (있던 === true) continue;
    const 줄 = 있던 || new Set();
    for (let n = 처음; n <= 끝; n++) 줄.add(n);
    고름.set(m[1], 줄);
  }
  if (!고름.size) throw new 사용법오류('고른 조각이 없다');
  return 고름;
}

/** 고름(Map id → true|Set)을 묶음 순번 → true|Set으로. 없는 id·넘는 줄 번호는 멈춘다. */
function 고름맞추기(고름, 묶음, 경로) {
  const 결과 = new Map();
  for (const [id, 줄] of 고름) {
    const k = 묶음.findIndex((m) => m.id === id);
    if (k < 0) throw new 멈춤(`${경로}: 조각 ${id}가 지금 차이에 없다 — 그사이 파일이 바뀌었을 수 있다. 미리 보기를 다시 본다`);
    const m = 묶음[k], 수 = (m.a2 - m.a1) + (m.b2 - m.b1);
    if (줄 !== true) for (const n of 줄) if (n > 수) throw new 멈춤(`${경로}: 조각 ${id}에는 줄이 ${수}개뿐이다(${n}번을 골랐다)`);
    결과.set(k, 줄);
  }
  return 결과;
}

/**
 * 바탕 B에 고른 조각만 얹는다. 조각 안 줄 번호는 뺀 줄(1…) 다음 더한 줄 차례다.
 * 섞인 조각은 새 판의 더한 줄 차례대로 걷는다 — 고른 줄은 넣고, 고르지 않은 줄 자리에는 남겨 둘 바탕 줄을 차례로 넣는다.
 */
function 조각얹기(B, N, 묶음, 고름) {
  const 결과 = [];
  let 앞 = 0;
  묶음.forEach((m, k) => {
    for (let i = 앞; i < m.a1; i++) 결과.push(B[i]);
    const s = 고름.get(k);
    const 뺀수 = m.a2 - m.a1;
    const 골랐나 = (n) => s === true || (s instanceof Set && s.has(n));
    const 남길 = [];
    for (let x = 0; x < 뺀수; x++) if (!골랐나(x + 1)) 남길.push(B[m.a1 + x]);
    let 다음 = 0;
    for (let y = 0; y < m.b2 - m.b1; y++) {
      if (골랐나(뺀수 + y + 1)) 결과.push(N[m.b1 + y]);
      else if (다음 < 남길.length) 결과.push(남길[다음++]);
    }
    while (다음 < 남길.length) 결과.push(남길[다음++]);
    앞 = m.a2;
  });
  for (let i = 앞; i < B.length; i++) 결과.push(B[i]);
  return 줄바꿈채우기(결과);
}

/**
 * 새 글의 줄끝을 바탕 판에 맞춘다. 바탕에 있던 줄은 바탕 줄끝, 새 줄은 앞 줄(없으면 뒤 바탕 줄, 그것도 없으면 바탕에 많은 쪽)을 따른다.
 * 바탕이 줄바꿈으로 끝났으면 끝 줄바꿈을 되살린다. 줄 내용은 바꾸지 않는다. → {글, 고친줄}
 */
function 줄끝맞추기(바탕글, 새글) {
  if (!바탕글.length || !새글.length) return { 글: 새글, 고친줄: 0 };
  const 바탕끝남 = 바탕글.endsWith('\n');
  if (!바탕글.includes('\r') && !새글.includes('\r') && (!바탕끝남 || 새글.endsWith('\n'))) return { 글: 새글, 고친줄: 0 };
  const B = 줄나누기(바탕글), N = 줄나누기(새글);
  let crlf = 0, lf = 0;
  for (const l of B) { if (l.끝 === '\r\n') crlf++; else if (l.끝 === '\n') lf++; }
  const 많은끝 = crlf > lf ? '\r\n' : '\n';
  const 짝 = new Int32Array(N.length).fill(-1);
  for (const op of 줄차이(B.map((l) => l.글), N.map((l) => l.글))) if (op[0] === '=') 짝[op[2]] = op[1];
  const 결과 = [];
  let 고친줄 = 0;
  for (let j = 0; j < N.length; j++) {
    let 끝 = 짝[j] >= 0 ? B[짝[j]].끝 : '';
    if (짝[j] < 0) {
      const 앞줄 = 결과[결과.length - 1];
      if (앞줄 && 앞줄.끝) 끝 = 앞줄.끝;
      else for (let t = j + 1; t < N.length && !끝; t++) if (짝[t] >= 0) 끝 = B[짝[t]].끝;
      if (!끝) 끝 = 많은끝;
    }
    if (j === N.length - 1) {
      if (!바탕끝남) 끝 = N[j].끝 === '' ? '' : (끝 || 많은끝);
      else if (!끝) 끝 = 많은끝;
    } else if (!끝) 끝 = 많은끝;
    if (끝 !== N[j].끝) 고친줄++;
    결과.push({ 글: N[j].글, 끝 });
  }
  return { 글: 줄잇기(결과), 고친줄 };
}

// 줄 개수 셈(빈 줄은 뺀다)
function 줄셈(줄들) {
  const m = new Map();
  for (const l of 줄들) if (l.글.trim()) m.set(l.글, (m.get(l.글) || 0) + 1);
  return m;
}
function 셈빼기(a, b) {
  const m = new Map();
  for (const [k, v] of a) { const r = v - (b.get(k) || 0); if (r > 0) m.set(k, r); }
  return m;
}
function 셈더하기(a, b) {
  const m = new Map(a);
  for (const [k, v] of b) m.set(k, (m.get(k) || 0) + v);
  return m;
}
/** a ⊆ b 이면 null, 아니면 넘치는 줄 하나 */
function 넘는줄(a, b) {
  for (const [k, v] of a) if ((b.get(k) || 0) < v) return k;
  return null;
}

/** 합친 결과 R이 「원격 O − 내가 뺀 줄 + 내가 더한 줄」인지 본다(원격이 이미 같은 줄을 더했으면 한 번만). 문제면 그 설명. */
function 줄셈검사(P, O, C, R) {
  const p = 줄셈(P), o = 줄셈(O), c = 줄셈(C), r = 줄셈(R);
  const 더한 = 셈빼기(c, p), 뺀 = 셈빼기(p, c), 남은원격 = 셈빼기(o, 뺀);
  const 빠짐 = 넘는줄(셈더하기(남은원격, 셈빼기(더한, 셈빼기(o, p))), r);
  if (빠짐 !== null) return `합친 결과에 있어야 할 줄이 없다: ${보이게(빠짐).slice(0, 80)}`;
  const 넘침 = 넘는줄(r, 셈더하기(남은원격, 더한));
  if (넘침 !== null) return `원격 판에도 내 커밋에도 없는 줄이 생겼다: ${보이게(넘침).slice(0, 80)}`;
  return null;
}

/**
 * 내 커밋의 변화(P → C)를 원격 판 O에 얹는다. git merge-file이 겹친다고 한 문서에만 쓴다.
 * 내가 고치거나 지운 줄은 원격 판에 그대로 이어져 있어야 한다. 더한 줄은 「원격에도 있는 다음 줄」 바로 앞에 넣는다
 * (사이에 원격만 더한 줄이 있으면 그 뒤 — 원격 줄 다음에 내 줄). 남의 미푸시 줄(P에만 있는 줄)은 건너뛴다.
 */
function 자리맞춰붙이기(P, O, C) {
  const 짝 = new Int32Array(P.length).fill(-1);
  for (const op of 줄차이(P.map((l) => l.글), O.map((l) => l.글))) if (op[0] === '=') 짝[op[1]] = op[2];
  const 고침 = [];
  for (const m of 조각나누기(줄차이(P.map((l) => l.글), C.map((l) => l.글)), P, C)) {
    const 넣을 = C.slice(m.b1, m.b2);
    if (m.a2 > m.a1) {
      const 시작 = 짝[m.a1];
      for (let i = m.a1; i < m.a2; i++) {
        if (짝[i] < 0 || 짝[i] !== 시작 + (i - m.a1)) return { 문제: `내가 고친 줄이 원격 판에 그대로 없다: ${보이게(P[i].글).slice(0, 80)}` };
      }
      고침.push({ o1: 시작, o2: 시작 + (m.a2 - m.a1), 넣을 });
    } else {
      let f = m.a1;
      while (f < P.length && 짝[f] < 0) f++;
      const 자리 = f < P.length ? 짝[f] : O.length;
      고침.push({ o1: 자리, o2: 자리, 넣을, 더함: true });
    }
  }
  고침.sort((x, y) => x.o1 - y.o1);
  const 결과 = [], 자리 = [];
  let 앞 = 0;
  for (const g of 고침) {
    if (g.o1 < 앞) return { 문제: '고칠 자리가 서로 겹친다' };
    for (let i = 앞; i < g.o1; i++) 결과.push(O[i]);
    if (g.더함 && g.넣을.length) 자리.push({ 앞줄: 결과.length ? 결과[결과.length - 1].글 : null, 내줄: g.넣을[0].글, 줄수: g.넣을.length });
    결과.push(...g.넣을);
    앞 = g.o2;
  }
  for (let i = 앞; i < O.length; i++) 결과.push(O[i]);
  return { 줄: 줄바꿈채우기(결과), 자리 };
}

function 공용문서인가(경로) {
  return 공용문서.some((p) => (typeof p === 'string' ? p === 경로 : p.test(경로)));
}

function 조각보기(경로, 묶음, B, N, 고름) {
  return {
    경로,
    조각: 묶음.map((m, k) => {
      const s = 고름 ? 고름.get(k) : undefined;
      const 줄 = [];
      for (let x = m.a1; x < m.a2; x++) 줄.push({ 번호: 줄.length + 1, 표: '−', 글: 보이게(B[x].글) });
      for (let y = m.b1; y < m.b2; y++) 줄.push({ 번호: 줄.length + 1, 표: '+', 글: 보이게(N[y].글) });
      for (const l of 줄) l.고름 = s === true || (s instanceof Set && s.has(l.번호));
      return { id: m.id, 행: m.a1 + 1, 뺀: m.a2 - m.a1, 더한: m.b2 - m.b1, 줄 };
    }),
  };
}

// ── 커밋 ────────────────────────────────────────────────────────────────────

function 메시지만들기(옵션) {
  let 글 = '';
  if (옵션.메시지파일) 글 = fs.readFileSync(path.resolve(옵션.기준폴더 || process.cwd(), 옵션.메시지파일), 'utf8');
  else if (Array.isArray(옵션.메시지)) 글 = 옵션.메시지.join('\n\n');
  else if (옵션.메시지) 글 = String(옵션.메시지);
  글 = 글.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  return 글 ? `${글}\n` : '';
}

/** 공용 인덱스(이 작업본의 진짜 인덱스)에서 경로들의 항목. 경로 → [{모드, sha, 단계}] */
function 공용인덱스항목(git, 경로들) {
  const 결과 = new Map();
  for (let i = 0; i < 경로들.length; i += 100) {
    const 출력 = git(['--literal-pathspecs', 'ls-files', '-s', '-z', '--', ...경로들.slice(i, i + 100)]).toString('utf8');
    for (const 줄 of 출력.split('\0')) {
      if (!줄) continue;
      const 탭 = 줄.indexOf('\t');
      const [모드, sha, 단계] = 줄.slice(0, 탭).split(' ');
      const 경로 = 줄.slice(탭 + 1);
      if (!결과.has(경로)) 결과.set(경로, []);
      결과.get(경로).push({ 모드, sha, 단계 });
    }
  }
  return 결과;
}

/** 내 경로마다 공용 인덱스가 바탕 그대로이거나 내 판과 같은지. 아니면 [{경로, 이유}] */
function 남의스테이징(git, 바뀜) {
  const 항목 = 공용인덱스항목(git, 바뀜.map((e) => e.경로));
  const 걸림 = [];
  for (const e of 바뀜) {
    const 항 = 항목.get(e.경로) || [];
    if (항.some((h) => h.단계 !== '0')) { 걸림.push({ 경로: e.경로, 이유: '병합이 끝나지 않은 항목이 있다' }); continue; }
    const s = 항.length ? 항[0].sha : null;
    if (s === e.옛 || s === e.새) continue;
    걸림.push({ 경로: e.경로, 이유: s ? '바탕과도 내 판과도 다른 판이 올라가 있다' : '지움이 올라가 있다' });
  }
  return 걸림;
}

function 잠금기다리기(c, 한도ms) {
  const 끝 = Date.now() + 한도ms;
  let 치움 = false;
  for (;;) {
    const r = c.잠금살피기();
    if (r.상태 === '없음') return { 풀림: true, 치움 };
    if (r.지움 && !치움 && 잠금도구.정리(r)) { 치움 = true; continue; }
    if (Date.now() >= 끝) return { 풀림: false, 이유: `index.lock ${r.상태} — ${r.이유}` };
    c.잠깐(200);
  }
}

/** 커밋 뒤 공용 인덱스의 내 경로만 새 HEAD에 맞춘다. 잠금이면 기다렸다 다시 한다. */
function 공용인덱스맞추기(c, 경로들) {
  const 끝 = Date.now() + c.한도.맞춤;
  let 치움 = false;
  for (;;) {
    const r = c.git.돌리기(['--literal-pathspecs', 'reset', '-q', '--pathspec-from-file=-', '--pathspec-file-nul'],
      { input: `${경로들.join('\0')}\0`, 허용: null });
    if (r.status === 0) return { 됨: true };
    const 오류 = String(r.stderr).trim();
    if (!/index\.lock/.test(오류)) return { 됨: false, 이유: 오류 };
    const s = c.잠금살피기();
    if (s.지움 && !치움 && 잠금도구.정리(s)) { 치움 = true; continue; }
    if (Date.now() >= 끝) return { 됨: false, 이유: `index.lock ${s.상태} — ${s.이유}` };
    c.잠깐(200);
  }
}

/** 줄끝만 맞춘 내 파일은 작업본도 새 판으로 쓴다(그사이 작업본이 그대로일 때만). */
function 작업본맞추기(c, 새커밋, 줄끝고침, 읽은판) {
  const 다시씀 = [], 못씀 = [];
  const 다듬기 = (b) => 글로(b).replace(/\r\n/g, '\n').replace(/\n$/, '');
  for (const { 경로 } of 줄끝고침) {
    const 전 = 읽은판.get(경로);
    if (!전) continue;
    const 파일 = path.join(c.저장소, 경로);
    let 지금;
    try { 지금 = fs.readFileSync(파일); } catch (_) { continue; }
    if (!지금.equals(전)) { 못씀.push({ 경로, 이유: '그사이 작업본이 바뀌었다' }); continue; }
    const 기대 = c.git(['cat-file', '--filters', `${새커밋}:${경로}`]);
    if (기대.equals(지금)) continue;
    if (다듬기(기대) !== 다듬기(지금)) { 못씀.push({ 경로, 이유: '줄끝 말고도 다르다' }); continue; }
    const 임시 = `${파일}.mycommit-${process.pid}.tmp`;
    try {
      fs.writeFileSync(임시, 기대);
      fs.renameSync(임시, 파일);
      다시씀.push(경로);
    } catch (e) {
      fs.rmSync(임시, { force: true });
      못씀.push({ 경로, 이유: e.message });
    }
  }
  return { 다시씀, 못씀 };
}

async function 커밋한번(c) {
  const { git } = c;
  for (const f of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG']) {
    if (fs.existsSync(path.join(c.gitdir, f))) throw new 멈춤(`진행 중인 git 작업이 있다(${f}) — 끝난 뒤 다시 한다`);
  }
  let 가지 = '';
  try { 가지 = git.글(['symbolic-ref', '-q', 'HEAD']); } catch (_) {}
  if (!가지.startsWith('refs/heads/')) throw new 멈춤('HEAD가 가지에 있지 않다(분리된 HEAD)');
  const 바탕 = git.글(['rev-parse', '--verify', 'HEAD^{commit}']);
  const 인덱스 = 별도인덱스(git, 바탕);
  const 저장 = new Map();
  try {
    const 통째 = c.경로들.filter((p) => !c.조각.has(p) || c.조각.get(p) === '전부');
    const 고른 = c.경로들.filter((p) => c.조각.has(p) && c.조각.get(p) !== '전부');
    const 읽은판 = new Map();
    for (const p of 통째) {
      try { const 파일 = path.join(c.저장소, p); if (fs.statSync(파일).isFile()) 읽은판.set(p, fs.readFileSync(파일)); } catch (_) {}
    }
    if (통째.length) {
      const r = git.돌리기(['--literal-pathspecs', 'add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'],
        { env: 인덱스.env, input: `${통째.join('\0')}\0`, 허용: null });
      if (r.status !== 0) throw new 멈춤(`경로를 올리지 못했다 — ${String(r.stderr).trim().split('\n').filter((l) => !/^warning:/.test(l)).join(' ')}`);
    }

    const 조각들 = [];
    const 바탕항 = 트리항목들(git, 바탕, 고른);
    for (const p of 고른) {
      const 파일 = path.join(c.저장소, p);
      if (!fs.existsSync(파일) || !fs.statSync(파일).isFile()) throw new 멈춤(`${p}: 작업본에 파일이 없다 — 조각은 있는 파일에서만 고른다`);
      const 항 = 바탕항.get(p);
      const 바탕블롭 = 항 ? 블롭(git, 저장, 항.sha) : Buffer.alloc(0);
      const 새 = fs.readFileSync(파일);
      if (이진인가(새) || 이진인가(바탕블롭)) throw new 멈춤(`${p}: 바이너리라 조각을 고를 수 없다`);
      const { B, N, 묶음 } = 조각만들기(글로(바탕블롭), 글로(새));
      const 고름 = 고름맞추기(c.조각.get(p), 묶음, p);
      let 글 = 줄잇기(조각얹기(B, N, 묶음, 고름));
      if (항 && !c.줄끝그대로) 글 = 줄끝맞추기(글로(바탕블롭), 글).글;
      const sha = 블롭쓰기(git, 저장, 바이트로(글));
      git(['update-index', '--add', '--cacheinfo', `${항 ? 항.모드 : '100644'},${sha},${p}`], { env: 인덱스.env });
      조각들.push(조각보기(p, 묶음, B, N, 고름));
    }

    const 차이 = () => 날차이읽기(git(['diff-index', '--cached', '--no-renames', '--no-abbrev', '-z', 바탕], { env: 인덱스.env }));
    let 바뀜 = 차이();
    const 밖 = 바뀜.filter((e) => !c.경로들.some((p) => e.경로 === p || e.경로.startsWith(`${p}/`)));
    if (밖.length) throw new 멈춤(`준 경로 밖이 섞였다: ${밖.map((e) => e.경로).join(', ')}`);
    if (!바뀜.length) return { 결과: '커밋할 것 없음', 이유: '준 경로가 바탕과 같다', 가지, 바탕 };
    const 하위저장소 = 바뀜.filter((e) => e.옛모드 === '160000' || e.새모드 === '160000');
    if (하위저장소.length) throw new 멈춤(`하위 git 저장소(gitlink)가 섞였다 — 이 도구로 올리지 않는다: ${하위저장소.map((e) => e.경로).join(', ')}`);
    const 정확히 = new Set(c.경로들);
    const 폴더에서 = 바뀜.filter((e) => !정확히.has(e.경로));
    if (폴더에서.length && !c.폴더) {
      return {
        결과: '멈춤', 가지, 바탕, 폴더파일: 폴더에서.map((e) => ({ 경로: e.경로, 상태: !e.옛 ? '추가' : !e.새 ? '지움' : '수정' })),
        이유: '폴더 경로는 그 아래 바뀐 파일을 모두 올린다 — 남의 미커밋 수정·새 파일이 섞일 수 있다. 아래 파일 가운데 내 것만 하나씩 주거나, 모두 내 것이면 --폴더를 붙인다',
      };
    }

    블롭읽기(git, 저장, 바뀜.flatMap((e) => [e.옛, e.새]));
    const 막힌 = [];
    for (const e of 바뀜) {
      if (!e.옛 || c.조각.has(e.경로) || !공용문서인가(e.경로)) continue;
      const 파일 = path.join(c.저장소, e.경로);
      const 새 = e.새 && fs.existsSync(파일) ? fs.readFileSync(파일) : Buffer.alloc(0);
      const { B, N, 묶음 } = 조각만들기(글로(블롭(git, 저장, e.옛)), 글로(새));
      막힌.push(조각보기(e.경로, 묶음, B, N, null));
    }
    if (막힌.length) {
      return {
        결과: '멈춤', 가지, 바탕, 조각보기: 막힌,
        이유: `여러 세션이 같이 고치는 문서는 통째로 올리지 않는다(${막힌.map((x) => x.경로).join(', ')}) — 아래 조각 가운데 내 것만 --조각 <경로>=<조각>[,<조각>…]으로 고른다. 그 파일의 바뀐 곳이 모두 내 것이면 =전부, 조각 안 일부 줄만이면 <조각>:<줄>-<줄>`,
      };
    }

    const 글아님 = 글아닌경로(git, 바뀜.filter((e) => e.옛 && e.새).map((e) => e.경로));
    const 줄끝고침 = [];
    for (const e of c.줄끝그대로 ? [] : 바뀜) {
      if (!e.옛 || !e.새 || c.조각.has(e.경로) && c.조각.get(e.경로) !== '전부') continue;
      if (!/^100(644|755)$/.test(e.새모드) || 글아님.has(e.경로)) continue;
      const 바탕블롭 = 블롭(git, 저장, e.옛), 새블롭 = 블롭(git, 저장, e.새);
      if (이진인가(바탕블롭) || 이진인가(새블롭)) continue;
      const r = 줄끝맞추기(글로(바탕블롭), 글로(새블롭));
      if (!r.고친줄) continue;
      e.새 = 블롭쓰기(git, 저장, 바이트로(r.글));
      git(['update-index', '--cacheinfo', `${e.새모드},${e.새},${e.경로}`], { env: 인덱스.env });
      줄끝고침.push({ 경로: e.경로, 줄: r.고친줄 });
    }
    if (줄끝고침.length) {
      바뀜 = 차이();
      for (const x of 줄끝고침) if (!바뀜.some((e) => e.경로 === x.경로)) x.빠짐 = true;
      if (!바뀜.length) {
        return {
          결과: '커밋할 것 없음', 가지, 바탕, 줄끝고침,
          이유: '줄끝만 바탕과 다르다 — 바탕 판의 줄끝을 따르면 바뀐 것이 없다(줄끝을 일부러 바꾸는 커밋이면 --줄끝그대로)',
        };
      }
    }

    const 수 = new Map();
    const 칸 = git(['diff', '--cached', '--numstat', '--no-renames', '-z', 바탕], { env: 인덱스.env }).toString('utf8').split('\0');
    for (const 줄 of 칸) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(줄);
      if (m) 수.set(m[3], { 더함: m[1] === '-' ? null : Number(m[1]), 뺌: m[2] === '-' ? null : Number(m[2]) });
    }
    const 파일 = 바뀜.map((e) => ({
      경로: e.경로, 상태: !e.옛 ? '추가' : !e.새 ? '지움' : '수정', ...(수.get(e.경로) || {}),
      ...(c.조각.has(e.경로) && c.조각.get(e.경로) !== '전부' ? { 조각: true } : {}),
    }));
    if (c.자세히) {
      for (const e of 바뀜) {
        if (!e.옛 || !e.새 || 조각들.some((x) => x.경로 === e.경로)) continue;
        const 바탕블롭 = 블롭(git, 저장, e.옛), 새블롭 = 블롭(git, 저장, e.새);
        if (이진인가(바탕블롭) || 이진인가(새블롭)) continue;
        const { B, N, 묶음 } = 조각만들기(글로(바탕블롭), 글로(새블롭));
        조각들.push(조각보기(e.경로, 묶음, B, N, new Map(묶음.map((_, k) => [k, true]))));
      }
    }

    let 용량;
    try {
      용량 = await checkRepository({ cached: true, base: 바탕 }, c.저장소, { ...기본환경(), GIT_INDEX_FILE: 인덱스.파일 });
    } catch (e) {
      throw new 멈춤(`저장 용량 검사를 돌리지 못했다 — ${e.message}`);
    }
    const 요약 = {
      가지, 바탕, 파일, 줄끝고침, 조각보기: 조각들,
      용량: { 통과: 용량.ok, 새blob: 용량.newBlobs, 바이트: 용량.countedBytes, 위반: 용량.violations },
    };
    if (!용량.ok) return { 결과: '멈춤', 이유: '저장 용량 검사에 걸렸다(tools/git-storage-policy.json, docs/_ops/github-storage/README.md)', ...요약 };
    const 스테이징이유 = '공용 인덱스에 내 경로의 다른 스테이징이 있다 — 남이 올려 둔 것일 수 있어 손대지 않았다. 내가 전에 git add한 판이면 git reset -q -- <경로>로 내린 뒤 다시 한다';
    let 걸림 = 남의스테이징(git, 바뀜);
    if (걸림.length) return { 결과: '멈춤', 이유: 스테이징이유, 걸림, ...요약 };
    if (!c.실행) return { 결과: '미리 보기', ...요약 };
    if (!c.메시지) throw new 사용법오류('커밋 메시지가 없다(-m "…" 또는 -F 파일)');

    const 잠금 = 잠금기다리기(c, c.한도.커밋전);
    if (!잠금.풀림) return { 결과: '멈춤', 이유: `공용 인덱스 잠금이 풀리지 않아 커밋하지 않았다 — ${잠금.이유}`, ...요약 };
    걸림 = 남의스테이징(git, 바뀜);
    if (걸림.length) return { 결과: '멈춤', 이유: 스테이징이유, 걸림, ...요약 };
    if (git.글(['rev-parse', 'HEAD']) !== 바탕) return { 결과: '다시' };
    const 트리 = git.글(['write-tree'], { env: 인덱스.env });
    const 새커밋 = git.글(['commit-tree', 트리, '-p', 바탕, '-F', '-'], { input: Buffer.from(c.메시지, 'utf8') });
    if (c.고리.커밋직전) c.고리.커밋직전();
    const 제목 = c.메시지.split('\n')[0].slice(0, 80);
    if (git.돌리기(['update-ref', '-m', `내커밋: ${제목}`, 가지, 새커밋, 바탕], { 허용: null }).status !== 0) return { 결과: '다시' };
    if (c.고리.커밋직후) c.고리.커밋직후();

    const 맞춤 = 공용인덱스맞추기(c, 바뀜.map((e) => e.경로));
    if (!맞춤.됨) {
      const 되돌림 = git.돌리기(['update-ref', '-m', '내커밋: 공용 인덱스를 못 맞춰 되돌림', 가지, 바탕, 새커밋], { 허용: null }).status === 0;
      return {
        결과: '실패', 커밋: 새커밋, ...요약, 되돌림,
        이유: `공용 인덱스를 새 HEAD에 맞추지 못했다(${맞춤.이유}) — ${되돌림
          ? '가지를 원래대로 되돌렸다. 작업본은 그대로니 잠금이 풀린 뒤 다시 한다'
          : `가지를 되돌리지 못했다(그사이 다른 커밋이 올라감). 곧바로 git reset -q -- <경로>로 공용 인덱스를 맞춘다: ${바뀜.map((e) => e.경로).join(' ')}`}`,
      };
    }
    // 여기부터는 커밋과 공용 인덱스 맞추기가 끝난 뒤다. 실패해도 결과는 「커밋함」으로 두고 주의로 알린다.
    const 주의 = [];
    let 작업본 = { 다시씀: [], 못씀: [] };
    try { 작업본 = 작업본맞추기(c, 새커밋, 줄끝고침, 읽은판); } catch (e) { 주의.push(`작업본 줄끝을 맞추지 못했다 — ${e.message}`); }
    try {
      const 내경로 = new Set(바뀜.map((e) => e.경로));
      const 남은 = git(['diff', '--cached', '--name-only', '--no-renames', '-z']).toString('utf8').split('\0').filter((p) => 내경로.has(p));
      if (남은.length) 주의.push(`공용 인덱스에서 아직 HEAD와 다른 내 경로: ${남은.join(', ')}`);
    } catch (e) {
      주의.push(`공용 인덱스를 다시 확인하지 못했다 — ${e.message}`);
    }
    return { 결과: '커밋함', 커밋: 새커밋, ...요약, 작업본, ...(주의.length ? { 주의: 주의.join(' / ') } : {}) };
  } finally {
    인덱스.치우기();
  }
}

/**
 * 옵션: 저장소 · 경로들[] · 조각(Map|[[경로, 값]]) · 메시지(글|글[]) · 메시지파일 · 실행 · 자세히
 * 시험용: 잠깐(ms) · 잠금살피기() · 잠금한도ms {커밋전, 맞춤} · 시험고리 {커밋직전, 커밋직후}
 */
async function 커밋(옵션 = {}) {
  try {
    const 저장소 = 저장소찾기(옵션.저장소 || process.cwd());
    const 기준폴더 = 옵션.저장소 ? 저장소 : process.cwd();
    const git = git도구(저장소);
    const 조각 = new Map();
    for (const [p, v] of (옵션.조각 instanceof Map ? [...옵션.조각] : (옵션.조각 || []))) {
      const 경로 = 경로맞추기(저장소, p, 기준폴더);
      const 고름 = typeof v === 'string' ? 고름읽기(v) : v;
      const 있던 = 조각.get(경로);
      if (있던 === '전부' || 고름 === '전부') { 조각.set(경로, '전부'); continue; }
      if (있던) for (const [id, 줄] of 고름) 있던.set(id, 있던.get(id) === true || 줄 === true ? true : new Set([...(있던.get(id) || []), ...줄]));
      else 조각.set(경로, 고름);
    }
    const 경로들 = [...new Set([...(옵션.경로들 || []).map((p) => 경로맞추기(저장소, p, 기준폴더)), ...조각.keys()])];
    if (!경로들.length) throw new 사용법오류('커밋할 경로를 준다');
    git버전확인(git, [2, 31], '--path-format=absolute');
    const [gitdir, 인덱스파일] = git.글(['rev-parse', '--path-format=absolute', '--git-dir', '--git-path', 'index']).split('\n');
    const 잠금 = `${path.resolve(인덱스파일)}.lock`;
    const c = {
      git, 저장소, gitdir: path.resolve(gitdir), 경로들, 조각, 실행: Boolean(옵션.실행), 자세히: Boolean(옵션.자세히),
      폴더: Boolean(옵션.폴더), 줄끝그대로: Boolean(옵션.줄끝그대로),
      메시지: 메시지만들기({ ...옵션, 기준폴더 }), 고리: 옵션.시험고리 || {}, 잠깐: 옵션.잠깐 || 잠깐,
      잠금살피기: 옵션.잠금살피기 || (() => 잠금도구.살피기(저장소, { 잠금 })),
      한도: { 커밋전: 20000, 맞춤: 30000, ...(옵션.잠금한도ms || {}) },
    };
    if (c.실행 && !c.메시지) throw new 사용법오류('커밋 메시지가 없다(-m "…" 또는 -F 파일)');
    for (let 차례 = 1; 차례 <= 3; 차례++) {
      const r = await 커밋한번(c);
      if (r.결과 !== '다시') return 차례 > 1 ? { ...r, 다시한수: 차례 - 1 } : r;
    }
    return { 결과: '멈춤', 이유: 'HEAD가 계속 움직여 세 번 모두 커밋하지 못했다(작업본은 그대로)' };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

// ── 올리기 ──────────────────────────────────────────────────────────────────

function 커밋풀기(git, 입력들) {
  const 결과 = [];
  for (const 입력 of 입력들) {
    const 목록 = 입력.includes('..')
      ? git.글(['rev-list', '--reverse', 입력]).split('\n').filter(Boolean)
      : [git.글(['rev-parse', '--verify', `${입력}^{commit}`])];
    if (!목록.length) throw new 멈춤(`커밋이 없다: ${입력}`);
    for (const c of 목록) {
      const 부모 = git.글(['log', '-1', '--format=%P', c]).split(' ').filter(Boolean);
      if (부모.length !== 1) throw new 멈춤(`${c.slice(0, 9)}: 부모가 ${부모.length}개다 — 병합·뿌리 커밋은 다시 쌓지 않는다`);
      if (!결과.includes(c)) 결과.push(c);
    }
  }
  return 결과;
}

function 세판합치기(git, 저장, 경로, 원sha, 부sha, 내sha) {
  const O = 블롭(git, 저장, 원sha), P = 블롭(git, 저장, 부sha), C = 블롭(git, 저장, 내sha);
  if (이진인가(O) || 이진인가(P) || 이진인가(C)) return { 문제: '바이너리 파일이 원격에서도 바뀌었다 — 손으로 고른다' };
  const r = git.돌리기(['merge-file', '-p', '--object-id', 원sha, 부sha, 내sha], { 허용: null });
  let R, 방법, 자리;
  if (r.status === 0) { R = r.stdout; 방법 = '3방향'; }
  else if (r.status > 0 && r.status < 128) {
    if (!맞춰붙일문서.test(경로)) return { 문제: `원격 판과 ${r.status}곳이 겹친다 — 코드·데이터 파일은 손으로 합친다` };
    const a = 자리맞춰붙이기(줄나누기(글로(P)), 줄나누기(글로(O)), 줄나누기(글로(C)));
    if (a.문제) return { 문제: a.문제 };
    R = 바이트로(줄잇기(a.줄));
    방법 = '자리 맞춤';
    자리 = a.자리.map((x) => ({ 앞줄: x.앞줄 === null ? null : 보이게(x.앞줄), 내줄: 보이게(x.내줄), 줄수: x.줄수 }));
  } else return { 문제: `git merge-file 실패: ${String(r.stderr).trim()}` };
  const 셈 = 줄셈검사(...[P, O, C, R].map((b) => 줄나누기(글로(b))));
  return 셈 ? { 문제: 셈 } : { 버퍼: R, 방법, ...(자리 ? { 자리 } : {}) };
}

/**
 * 내 커밋들을 바탕 위에 다시 쌓는다. 이미 바탕 바로 위에 차례대로 이어져 있으면 그대로 쓴다(다시쌓기면 그래도 쌓는다).
 * 줄끝그대로면 원격 판 줄끝에 맞추지 않는다.
 */
function 쌓기(git, 저장, 바탕, 커밋들, { 다시쌓기 = false, 줄끝그대로 = false } = {}) {
  const 항목들 = 커밋들.map((c) => {
    const 부모 = git.글(['rev-parse', `${c}^`]);
    return { 커밋: c, 부모, 바뀜: 날차이읽기(git(['diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', 부모, c])) };
  });
  const 하위저장소 = 항목들.flatMap((항) => 항.바뀜.filter((e) => e.옛모드 === '160000' || e.새모드 === '160000').map((e) => ({ 커밋: 항.커밋, 경로: e.경로 })));
  if (하위저장소.length) {
    return { 머리: 바탕, 그대로: false, 대응: [], 경로: [], 내변화: new Map(), 문제: 하위저장소.map((x) => ({ ...x, 이유: '하위 git 저장소(gitlink)는 이 도구로 올리지 않는다' })) };
  }
  const 내변화 = new Map();
  for (const 항 of 항목들) {
    for (const e of 항.바뀜) {
      if (!내변화.has(e.경로)) 내변화.set(e.경로, []);
      내변화.get(e.경로).push({ 옛: e.옛, 새: e.새 });
    }
  }
  const 마지막 = 커밋들[커밋들.length - 1];
  const 이어짐 = git.글(['rev-list', '--reverse', `${바탕}..${마지막}`]).split('\n').filter(Boolean);
  if (!다시쌓기 && 이어짐.length === 커밋들.length && 이어짐.every((c, i) => c === 커밋들[i])) {
    return { 머리: 마지막, 그대로: true, 대응: 커밋들.map((c) => ({ 원래: c, 새: c })), 경로: [], 문제: [], 내변화 };
  }
  const 지금 = 트리항목들(git, 바탕, [...내변화.keys()]);
  블롭읽기(git, 저장, [...[...지금.values()].map((v) => v.sha), ...항목들.flatMap((항) => 항.바뀜.flatMap((e) => [e.옛, e.새]))]);
  const 글아님 = 글아닌경로(git, [...내변화.keys()]);
  const 인덱스 = 별도인덱스(git, 바탕);
  try {
    let 머리 = 바탕;
    const 대응 = [], 경로 = [], 문제 = [];
    for (const 항 of 항목들) {
      const 고침 = [];
      for (const e of 항.바뀜) {
        const 현재 = 지금.get(e.경로) || null, cs = 현재 ? 현재.sha : null;
        let 자리 = null;
        const 기록 = (방법) => 경로.push({ 커밋: 항.커밋, 경로: e.경로, 방법, ...(자리 ? { 자리 } : {}) });
        const 막힘 = (이유) => 문제.push({ 커밋: 항.커밋, 경로: e.경로, 이유 });
        if (!e.새) {
          if (cs === e.옛) { 고침.push(`0 ${'0'.repeat(40)}\t${e.경로}`); 지금.delete(e.경로); 기록('지움'); }
          else if (cs === null) 기록('이미 없음');
          else 막힘('내가 지운 파일이 origin에서는 다른 판이다');
          continue;
        }
        let sha, 방법;
        if (cs === e.옛) { sha = e.새; 방법 = '내 판'; }
        else if (cs === e.새) { 기록('이미 같음'); continue; }
        else if (cs === null) { 막힘('origin에 없는 파일을 고쳤다 — 그 파일을 만든 앞 커밋이 아직 origin에 없다(내 커밋이면 같이 준다)'); continue; }
        else if (e.옛 === null) { 막힘('새로 만든 파일인데 origin에 같은 이름의 다른 파일이 있다'); continue; }
        else {
          const m = 세판합치기(git, 저장, e.경로, cs, e.옛, e.새);
          if (m.문제) { 막힘(m.문제); continue; }
          sha = 블롭쓰기(git, 저장, m.버퍼);
          방법 = m.방법;
          자리 = m.자리 || null;
        }
        if (!줄끝그대로 && cs && /^100(644|755)$/.test(e.새모드) && !글아님.has(e.경로)) {
          const 원격판 = 블롭(git, 저장, cs), 넣을판 = 블롭(git, 저장, sha);
          if (!이진인가(원격판) && !이진인가(넣을판)) {
            const f = 줄끝맞추기(글로(원격판), 글로(넣을판));
            if (f.고친줄) { sha = 블롭쓰기(git, 저장, 바이트로(f.글)); 방법 += ` · 줄끝 ${f.고친줄}줄 맞춤`; }
          }
        }
        고침.push(`${e.새모드} ${sha}\t${e.경로}`);
        지금.set(e.경로, { 모드: e.새모드, sha });
        기록(방법);
      }
      if (문제.length) break;
      if (고침.length) git(['update-index', '-z', '--index-info'], { env: 인덱스.env, input: `${고침.join('\0')}\0` });
      const 트리 = git.글(['write-tree'], { env: 인덱스.env });
      if (트리 === git.글(['rev-parse', `${머리}^{tree}`])) { 대응.push({ 원래: 항.커밋, 새: null }); continue; }
      const [이름, 메일, 날짜, ...몸] = git(['log', '-1', '--format=%an%x00%ae%x00%ad%x00%B', '--date=raw', 항.커밋]).toString('utf8').split('\0');
      const 새 = git.글(['commit-tree', 트리, '-p', 머리, '-F', '-'], {
        input: Buffer.from(`${몸.join('\0').replace(/\n+$/, '')}\n`, 'utf8'),
        env: { GIT_AUTHOR_NAME: 이름, GIT_AUTHOR_EMAIL: 메일, GIT_AUTHOR_DATE: 날짜 },
      });
      대응.push({ 원래: 항.커밋, 새 });
      머리 = 새;
    }
    return { 머리, 그대로: false, 대응, 경로, 문제, 내변화 };
  } finally {
    인덱스.치우기();
  }
}

/** 올릴 판(바탕..머리)을 경로마다 본다: 새는 줄·빠진 줄·줄끝(줄끝그대로면 안 본다), 그리고 저장 용량. */
async function 올릴판검사(git, 저장, 저장소, 바탕, 계획, { 줄끝그대로 = false } = {}) {
  const 문제 = [];
  const 경로들 = [...계획.내변화.keys()];
  const 바탕항 = 트리항목들(git, 바탕, 경로들), 머리항 = 트리항목들(git, 계획.머리, 경로들);
  블롭읽기(git, 저장, [...바탕항.values(), ...머리항.values()].map((v) => v.sha)
    .concat([...계획.내변화.values()].flatMap((v) => v.flatMap((x) => [x.옛, x.새]))));
  const 글아님 = 글아닌경로(git, 경로들);
  for (const p of git(['diff', '--name-only', '--no-renames', '-z', 바탕, 계획.머리]).toString('utf8').split('\0')) {
    if (p && !계획.내변화.has(p)) 문제.push({ 경로: p, 이유: '내 커밋이 바꾸지 않은 경로가 바뀐다(남의 커밋이 섞였다)' });
  }
  for (const 경로 of 경로들) {
    const b = 바탕항.get(경로), h = 머리항.get(경로);
    if ((b ? b.sha : null) === (h ? h.sha : null)) continue;
    const 변화 = 계획.내변화.get(경로);
    const bb = 블롭(git, 저장, b && b.sha), hb = 블롭(git, 저장, h && h.sha);
    if (이진인가(bb) || 이진인가(hb) || 변화.some((v) => 이진인가(블롭(git, 저장, v.옛)) || 이진인가(블롭(git, 저장, v.새)))) {
      if ((h ? h.sha : null) !== 변화[변화.length - 1].새) 문제.push({ 경로, 이유: '바이너리 파일이 내 마지막 판과 다르다' });
      continue;
    }
    let 더한 = new Map(), 뺀 = new Map();
    for (const v of 변화) {
      const p = 줄셈(줄나누기(글로(블롭(git, 저장, v.옛)))), c = 줄셈(줄나누기(글로(블롭(git, 저장, v.새))));
      더한 = 셈더하기(더한, 셈빼기(c, p));
      뺀 = 셈더하기(뺀, 셈빼기(p, c));
    }
    const 머리셈 = 줄셈(줄나누기(글로(hb))), 바탕셈 = 줄셈(줄나누기(글로(bb)));
    const 샌줄 = 넘는줄(셈빼기(머리셈, 바탕셈), 더한);
    if (샌줄 !== null) 문제.push({ 경로, 이유: `내 커밋에 없는 줄이 올라간다: ${보이게(샌줄).slice(0, 80)}` });
    const 빠진줄 = 넘는줄(셈빼기(바탕셈, 머리셈), 뺀);
    if (빠진줄 !== null) 문제.push({ 경로, 이유: `내가 지우지 않은 원격 줄이 빠진다: ${보이게(빠진줄).slice(0, 80)}` });
    if (!줄끝그대로 && b && h && !글아님.has(경로)) {
      const f = 줄끝맞추기(글로(bb), 글로(hb));
      if (f.고친줄) 문제.push({ 경로, 줄끝: true, 이유: `줄끝이 원격 판과 다른 줄이 ${f.고친줄}개다` });
    }
  }
  let 용량 = null;
  try {
    const r = await checkRepository({ base: 바탕, head: 계획.머리 }, 저장소, 기본환경());
    용량 = { 통과: r.ok, 새blob: r.newBlobs, 바이트: r.countedBytes, 위반: r.violations };
    for (const v of r.violations) 문제.push({ 경로: v.path, 이유: `저장 용량(${v.code}, ${v.bytes}바이트${v.limit ? ` · 한도 ${v.limit}` : ''})` });
  } catch (e) {
    문제.push({ 이유: `저장 용량 검사를 돌리지 못했다 — ${e.message}` });
  }
  return { 문제, 용량 };
}

/** push한 뒤 로컬 가지에 방금 올린 머리를 「트리는 로컬 그대로」 합친다. origin의 남의 커밋이 바꾼 경로가 모두 로컬과 같을 때만. */
function 로컬합치기(git, 원격, 계획) {
  let 가지 = '';
  try { 가지 = git.글(['symbolic-ref', '-q', 'HEAD']); } catch (_) {}
  if (!가지.startsWith('refs/heads/')) return { 결과: '건너뜀', 이유: 'HEAD가 가지에 있지 않다' };
  const 머리 = git.글(['rev-parse', 'HEAD']);
  if (조상인가(git, 원격, 머리)) return { 결과: '할 것 없음', 이유: 'origin이 이미 로컬 가지 안에 있다' };
  if (!계획.대응.every((d) => 조상인가(git, d.원래, 머리))) return { 결과: '건너뜀', 이유: '올린 내 커밋이 지금 가지에 없다' };
  const 줄끝고친 = [...new Set(계획.경로.filter((x) => /줄끝/.test(x.방법)).map((x) => x.경로))];
  if (줄끝고친.length) {
    return { 결과: '건너뜀', 이유: `다시 쌓으며 줄끝을 원격 판에 맞춘 경로가 있어 로컬과 origin의 판이 다르다 — 로컬을 그대로 두고 합치면 그 줄끝이 되돌아간다`, 예: 줄끝고친.slice(0, 5) };
  }
  const 내것 = new Set(계획.대응.map((d) => d.새).filter(Boolean));
  const 남의 = git.글(['rev-list', '--first-parent', `${머리}..${원격}`]).split('\n').filter((c) => c && !내것.has(c));
  const 경로 = new Set();
  for (const c of 남의) {
    for (const p of git(['diff-tree', '-r', '--no-renames', '--name-only', '-z', `${c}^`, c]).toString('utf8').split('\0')) if (p) 경로.add(p);
  }
  const 경로들 = [...경로];
  const 로컬항 = 트리항목들(git, 머리, 경로들), 원격항 = 트리항목들(git, 원격, 경로들);
  const 다름 = 경로들.filter((p) => (로컬항.get(p) || {}).sha !== (원격항.get(p) || {}).sha);
  if (다름.length) return { 결과: '건너뜀', 이유: `origin에 있는 남의 커밋 ${남의.length}개가 바꾼 경로 가운데 ${다름.length}개가 로컬과 다르다 — 「트리는 로컬 그대로」로 합치면 그 변경이 빠진다`, 예: 다름.slice(0, 5) };
  const 트리 = git.글(['rev-parse', `${머리}^{tree}`]);
  const 글 = `Merge my pushed commits from origin (tree kept local)\n\n${계획.대응.filter((d) => d.새).map((d) => `${d.원래.slice(0, 9)} -> ${d.새.slice(0, 9)}`).join('\n')}\n`;
  const 병합 = git.글(['commit-tree', 트리, '-p', 머리, '-p', 원격, '-F', '-'], { input: Buffer.from(글, 'utf8') });
  if (git.돌리기(['update-ref', '-m', '내커밋: 올린 내 커밋을 로컬에 합침', 가지, 병합, 머리], { 허용: null }).status !== 0) {
    return { 결과: '건너뜀', 이유: '그사이 로컬 가지가 움직였다' };
  }
  return { 결과: '합침', 커밋: 병합, 가지 };
}

/**
 * 옵션: 저장소 · 커밋들[](해시·참조·a..b) · 실행 · 합치기 · 줄끝그대로 · 원격(origin) · 가지(master)
 */
async function 올리기(옵션 = {}) {
  try {
    const 저장소 = 저장소찾기(옵션.저장소 || process.cwd());
    const git = git도구(저장소);
    git버전확인(git, [2, 43], 'merge-file --object-id');
    const 원격 = 옵션.원격 || 'origin', 원격가지 = 옵션.가지 || 'master';
    const 추적 = `refs/remotes/${원격}/${원격가지}`;
    const 원래 = 커밋풀기(git, 옵션.커밋들 || []);
    if (!원래.length) throw new 사용법오류('올릴 커밋을 준다');
    const 줄끝그대로 = Boolean(옵션.줄끝그대로);
    const 저장 = new Map();
    for (let 차례 = 1; 차례 <= 3; 차례++) {
      const f = git.돌리기(['fetch', '-q', 원격, `+refs/heads/${원격가지}:${추적}`], { 허용: null });
      if (f.status !== 0) throw new 멈춤(`fetch 실패 — ${String(f.stderr).trim()}`);
      const 바탕 = git.글(['rev-parse', '--verify', `${추적}^{commit}`]);
      const 남은 = 원래.filter((c) => !조상인가(git, c, 바탕));
      if (!남은.length) return { 결과: '올릴 것 없음', 이유: '준 커밋이 모두 이미 origin에 있다', 바탕 };
      const 차례맞춘 = git.글(['rev-list', '--topo-order', '--reverse', ...남은, `^${바탕}`]).split('\n').filter((c) => 남은.includes(c));
      let 계획 = 쌓기(git, 저장, 바탕, 차례맞춘, { 줄끝그대로 });
      let 검사 = 계획.문제.length || 계획.머리 === 바탕 ? null : await 올릴판검사(git, 저장, 저장소, 바탕, 계획, { 줄끝그대로 });
      if (계획.그대로 && 검사 && 검사.문제.length && 검사.문제.every((x) => x.줄끝)) {
        // origin 바로 위의 내 커밋에 줄끝만 원격 판과 다른 줄이 있다: 그대로 올리지 않고 줄끝을 맞춰 다시 쌓는다
        계획 = 쌓기(git, 저장, 바탕, 차례맞춘, { 다시쌓기: true });
        검사 = 계획.문제.length || 계획.머리 === 바탕 ? null : await 올릴판검사(git, 저장, 저장소, 바탕, 계획);
      }
      let 로컬만 = [];
      try {
        const 지금머리 = git.글(['rev-parse', 'HEAD']);
        로컬만 = git.글(['rev-list', `${바탕}..${지금머리}`]).split('\n').filter((c) => c && !원래.includes(c));
      } catch (_) {}
      const 요약 = {
        원격: `${원격}/${원격가지}`, 바탕, 머리: 계획.머리, 그대로: 계획.그대로, 대응: 계획.대응, 경로: 계획.경로,
        남의미푸시: 로컬만.length,
        ...(차례 > 1 ? { 다시한수: 차례 - 1 } : {}),
      };
      if (계획.문제.length) return { 결과: '멈춤', 이유: 'origin 위에 다시 쌓지 못한 경로가 있다 — 아무것도 올리지 않았다', 문제: 계획.문제, ...요약 };
      if (계획.머리 === 바탕) return { 결과: '올릴 것 없음', 이유: '준 커밋의 내용이 이미 origin에 다 있다', ...요약 };
      if (검사.문제.length) {
        const 이유 = `올릴 판 검사에 걸렸다 — 아무것도 올리지 않았다${검사.문제.some((x) => x.줄끝) ? '(줄끝을 일부러 바꾸는 커밋이면 --줄끝그대로)' : ''}`;
        return { 결과: '멈춤', 이유, 문제: 검사.문제, 용량: 검사.용량, ...요약 };
      }
      if (!옵션.실행) return { 결과: '미리 보기', 용량: 검사.용량, ...요약 };
      const p = git.돌리기(['push', '--porcelain', 원격, `${계획.머리}:refs/heads/${원격가지}`], { 허용: null });
      const 출력 = `${p.stdout}\n${p.stderr}`;
      if (p.status !== 0) {
        if (/non-fast-forward|fetch first|\[rejected\]/.test(출력) && 차례 < 3) continue;
        return { 결과: '멈춤', 이유: `push가 거절됐다 — ${출력.trim().split('\n').slice(-3).join(' / ')}`, ...요약 };
      }
      // 여기부터는 push가 끝난 뒤다. 실패해도 결과는 「올림」으로 두고 주의로 알린다.
      const r = { 결과: '올림', 용량: 검사.용량, ...요약 };
      try {
        r.원격머리 = git.글(['ls-remote', 원격, `refs/heads/${원격가지}`]).split(/\s/)[0];
        r.확인 = r.원격머리 === 계획.머리;
      } catch (e) {
        r.주의 = `push는 됐지만 ls-remote로 다시 확인하지 못했다 — ${e.message}`;
      }
      if (옵션.합치기) {
        try {
          r.합치기 = r.확인 ? 로컬합치기(git, 계획.머리, 계획)
            : { 결과: '건너뜀', 이유: r.원격머리 ? `ls-remote가 올린 머리가 아니다(${짧게(r.원격머리)}) — 그새 누가 올렸다` : 'origin 머리를 확인하지 못했다' };
        } catch (e) {
          r.합치기 = { 결과: '건너뜀', 이유: `로컬 합치기 중 오류 — ${e.message}` };
        }
      }
      return r;
    }
    return { 결과: '멈춤', 이유: 'origin이 계속 움직여 세 번 모두 올리지 못했다' };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const 사용법 = `사용법
  node tools/내커밋.js 커밋 <경로…> -m "<메시지>" [--조각 <경로>=<조각,…>] [--폴더] [--자세히] [--줄끝그대로] [--실행] [--json]
  node tools/내커밋.js 올리기 <커밋…> [--합치기] [--줄끝그대로] [--실행] [--json]
  기본은 미리 보기다. --실행을 붙여야 커밋·push한다.
  --조각: 미리 보기가 보여 준 조각 id. 조각 안 일부 줄은 <id>:<줄>-<줄>, 그 파일의 바뀐 곳이 모두 내 것이면 <경로>=전부.
  --폴더: 준 폴더 아래 바뀐 파일이 모두 내 것일 때만. 없으면 폴더 경로는 파일 목록을 보이고 멈춘다.
  --줄끝그대로: 줄끝을 일부러 바꾸는 커밋(재정규화)일 때만. 바탕·원격 판 줄끝에 맞추지 않는다.
  자세한 설명은 파일 머리.`;

function 인자읽기(argv) {
  const [명령, ...나머지] = argv;
  if (!명령 || 명령 === '--help' || 명령 === '-h' || 명령 === '도움말') return { 도움말: true };
  if (!['커밋', '올리기'].includes(명령)) throw new 사용법오류(`모르는 명령: ${명령} (커밋 · 올리기)`);
  const 옵션 = { 명령, 위치: [], 메시지: [], 조각: [], 실행: false, json: false, 자세히: false, 합치기: false, 폴더: false, 줄끝그대로: false };
  for (let i = 0; i < 나머지.length; i++) {
    const a = 나머지[i];
    const 값 = () => {
      if (i + 1 >= 나머지.length) throw new 사용법오류(`${a} 뒤에 값이 없다`);
      return 나머지[++i];
    };
    if (a === '--') { 옵션.위치.push(...나머지.slice(i + 1)); break; }
    else if (a === '-m' || a === '--메시지') 옵션.메시지.push(값());
    else if (a === '-F' || a === '--메시지파일') 옵션.메시지파일 = 값();
    else if (a === '--조각') {
      const v = 값(), k = v.lastIndexOf('=');
      if (k <= 0) throw new 사용법오류(`--조각은 <경로>=<조각,…> 꼴이다: ${v}`);
      옵션.조각.push([v.slice(0, k), 고름읽기(v.slice(k + 1))]);
    }
    else if (a === '--실행') 옵션.실행 = true;
    else if (a === '--json') 옵션.json = true;
    else if (a === '--자세히') 옵션.자세히 = true;
    else if (a === '--합치기') 옵션.합치기 = true;
    else if (a === '--폴더') 옵션.폴더 = true;
    else if (a === '--줄끝그대로') 옵션.줄끝그대로 = true;
    else if (a === '--저장소') 옵션.저장소 = 값();
    else if (a === '--원격') 옵션.원격 = 값();
    else if (a === '--가지') 옵션.가지 = 값();
    else if (a.startsWith('-')) throw new 사용법오류(`모르는 인자: ${a}`);
    else 옵션.위치.push(a);
  }
  if (명령 === '커밋') {
    if (옵션.합치기 || 옵션.원격 || 옵션.가지) throw new 사용법오류('--합치기·--원격·--가지는 올리기에만 쓴다');
    if (!옵션.위치.length && !옵션.조각.length) throw new 사용법오류('커밋할 경로를 준다');
    옵션.경로들 = 옵션.위치;
  } else {
    if (옵션.메시지.length || 옵션.메시지파일 || 옵션.조각.length || 옵션.자세히 || 옵션.폴더) throw new 사용법오류('-m·-F·--조각·--폴더·--자세히는 커밋에만 쓴다');
    if (!옵션.위치.length) throw new 사용법오류('올릴 커밋을 준다');
    옵션.커밋들 = 옵션.위치;
  }
  return 옵션;
}

const 짧게 = (sha) => (sha ? sha.slice(0, 9) : '');

function 조각글(보기) {
  const 줄 = [`${보기.경로} — 바탕 대비 조각 ${보기.조각.length}개`];
  for (const 조 of 보기.조각) {
    줄.push(`  [${조.id}] ${조.행}행 ${조.뺀 ? `−${조.뺀} ` : ''}${조.더한 ? `+${조.더한}` : ''}`.trimEnd());
    // 조각 안 줄 번호로 고르므로 줄은 하나도 빼지 않고 다 보인다(긴 줄만 자른다)
    for (const l of 조.줄) {
      const 글 = l.글.length > 140 ? `${l.글.slice(0, 140)}…` : l.글;
      줄.push(`    ${String(l.번호).padStart(3)} ${l.표}${l.고름 ? '✓' : ' '} ${글}`);
    }
  }
  return 줄.join('\n');
}

function 커밋글(r) {
  const 머리 = {
    '미리 보기': '[미리 보기] 아직 커밋하지 않았다 — 같은 명령에 --실행을 붙이면 커밋한다',
    '커밋함': `[커밋함] ${짧게(r.커밋)}`,
    '커밋할 것 없음': `[커밋할 것 없음] ${r.이유 || ''}`,
    '멈춤': `[멈춤] ${r.이유}`,
    '실패': `[실패] ${r.이유}`,
  }[r.결과] || `[${r.결과}] ${r.이유 || ''}`;
  const 줄 = [머리];
  if (r.가지) 줄.push(`가지 ${r.가지.replace(/^refs\/heads\//, '')} · 바탕 ${짧게(r.바탕)}${r.다시한수 ? ` · HEAD가 움직여 ${r.다시한수}번 다시 함` : ''}`);
  if (r.파일 && r.파일.length) {
    줄.push(`올릴 경로 ${r.파일.length}개`);
    for (const f of r.파일) {
      const 수 = f.더함 == null ? '바이너리' : `+${f.더함} −${f.뺌}`;
      줄.push(`  ${f.상태}  ${f.경로}  ${수}${f.조각 ? '  (고른 조각만)' : ''}`);
    }
  }
  for (const x of r.폴더파일 || []) 줄.push(`  ${x.상태}  ${x.경로}`);
  for (const x of r.줄끝고침 || []) 줄.push(`줄끝을 바탕 판에 맞춤: ${x.경로} ${x.줄}줄${x.빠짐 ? ' — 맞추고 나니 바탕과 같아 커밋에서 빠짐' : ''}`);
  if (r.용량) {
    줄.push(r.용량.통과 ? `저장 용량 검사 통과 — 새 blob ${r.용량.새blob}개 · ${r.용량.바이트}바이트`
      : `저장 용량 검사 걸림: ${r.용량.위반.map((v) => `${v.path || '(합계)'} ${v.code} ${v.bytes}바이트`).join(', ')}`);
  }
  for (const x of r.걸림 || []) 줄.push(`  ${x.경로} — ${x.이유}`);
  if (r.결과 === '커밋함') {
    줄.push('공용 인덱스의 내 경로를 새 HEAD에 맞췄다(남의 스테이징·미커밋 수정은 그대로)');
    for (const p of (r.작업본 && r.작업본.다시씀) || []) 줄.push(`작업본 줄끝도 새 판으로 맞춤: ${p}`);
    for (const x of (r.작업본 && r.작업본.못씀) || []) 줄.push(`작업본 줄끝을 못 맞춤: ${x.경로} — ${x.이유}`);
  }
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  for (const 보기 of r.조각보기 || []) 줄.push(조각글(보기));
  return 줄.join('\n');
}

function 올리기글(r) {
  const 머리 = {
    '미리 보기': '[미리 보기] 아직 올리지 않았다 — 같은 명령에 --실행을 붙이면 push한다',
    '올림': `[올림] ${r.원격} ← ${짧게(r.머리)}${r.확인 ? '' : ` (주의: ls-remote가 ${짧게(r.원격머리)}다)`}`,
    '올릴 것 없음': `[올릴 것 없음] ${r.이유 || ''}`,
    '멈춤': `[멈춤] ${r.이유}`,
  }[r.결과] || `[${r.결과}] ${r.이유 || ''}`;
  const 줄 = [머리];
  if (r.바탕) 줄.push(`origin 바탕 ${짧게(r.바탕)}${r.다시한수 ? ` · origin이 움직여 ${r.다시한수}번 다시 함` : ''}`);
  if (r.대응 && r.대응.length) {
    줄.push(r.그대로 ? `내 커밋 ${r.대응.length}개가 origin 바로 위에 이어져 있어 그대로 올린다` : `origin 위에 내 커밋 ${r.대응.length}개를 다시 쌓음`);
    if (!r.그대로) for (const d of r.대응) 줄.push(`  ${짧게(d.원래)} → ${d.새 ? 짧게(d.새) : '(같은 내용이 이미 origin에 있어 건너뜀)'}`);
    if (!r.그대로 && r.결과 === '미리 보기') 줄.push('  (새 커밋 번호는 실행 때 다시 만들어 달라진다 — 원격 CI는 실행 출력의 번호로 본다)');
  }
  const 방법수 = new Map();
  for (const x of r.경로 || []) 방법수.set(x.방법, (방법수.get(x.방법) || 0) + 1);
  if (방법수.size) 줄.push(`경로: ${[...방법수].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const 줄일 = (s) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);
  for (const x of (r.경로 || []).filter((x) => x.방법 !== '내 판')) {
    줄.push(`  ${x.방법}: ${x.경로}`);
    for (const 자 of x.자리 || []) 줄.push(`    ${자.앞줄 === null ? '파일 맨 앞에' : `「${줄일(자.앞줄)}」 다음에`} 「${줄일(자.내줄)}」${자.줄수 > 1 ? ` 외 ${자.줄수 - 1}줄` : ''}`);
  }
  for (const x of r.문제 || []) 줄.push(`  문제${x.커밋 ? ` ${짧게(x.커밋)}` : ''}${x.경로 ? ` ${x.경로}` : ''} — ${x.이유}`);
  if (r.용량) 줄.push(r.용량.통과 ? `저장 용량 검사 통과 — 새 blob ${r.용량.새blob}개 · ${r.용량.바이트}바이트` : '저장 용량 검사 걸림');
  if (r.결과 === '미리 보기' || r.결과 === '올림') 줄.push('검사: 올라갈 줄은 모두 내 커밋의 줄 · 내 줄 빠짐 없음 · 줄끝은 원격 판을 따름');
  if (r.남의미푸시) 줄.push(`로컬 가지에만 있는 다른 커밋 ${r.남의미푸시}개는 올리지 않는다`);
  if (r.합치기) {
    줄.push(`로컬 합치기: ${r.합치기.결과}${r.합치기.커밋 ? ` ${짧게(r.합치기.커밋)}` : ''}${r.합치기.이유 ? ` — ${r.합치기.이유}` : ''}`);
    if (r.합치기.예) 줄.push(`  예: ${r.합치기.예.join(', ')}`);
  }
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  return 줄.join('\n');
}

async function main(argv = process.argv.slice(2)) {
  let 옵션;
  try {
    옵션 = 인자읽기(argv);
  } catch (e) {
    if (!(e instanceof 사용법오류)) throw e;
    console.error(`${e.message}\n${사용법}`);
    return 2;
  }
  if (옵션.도움말) { console.log(사용법); return 0; }
  let r;
  try {
    r = 옵션.명령 === '커밋' ? await 커밋(옵션) : await 올리기(옵션);
  } catch (e) {
    if (e instanceof 사용법오류) { console.error(`${e.message}\n${사용법}`); return 2; }
    r = { 결과: '실패', 이유: e.message };
  }
  console.log(옵션.json ? JSON.stringify(r, null, 2) : 옵션.명령 === '커밋' ? 커밋글(r) : 올리기글(r));
  return 좋은결과.has(r.결과) ? 0 : 1;
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = {
  커밋, 올리기, 인자읽기, main,
  줄나누기, 줄잇기, 줄차이, 조각나누기, 조각만들기, 고름읽기, 조각얹기, 줄끝맞추기, 자리맞춰붙이기, 줄셈검사, 공용문서인가,
  _시험: { git도구, 쌓기, 올릴판검사, 커밋글, 올리기글 },
};
