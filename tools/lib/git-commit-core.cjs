'use strict';
// Git bytes, diff/merge rules, locks and error types shared by both CLIs.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const 잠금도구 = require('../git잠금.js');
const { checkRepository } = require('../git-storage-check.cjs');
const 공개검사 = require('../공개검사.js');

/** 여러 세션이 같이 고치는 문서 — 통째로 올리지 않고 내 조각만 고른다(10-05~10-19 커밋 수 상위). */
const 공용문서 = [
  'AGENTS.md', 'CLAUDE.md', 'DESIGN.md', 'docs/AI_운영원칙.md', 'docs/문서_지도.md',
  'docs/_ops/결정.md', 'docs/_ops/트랙.md', 'docs/마케팅/제작양식/만족사례_장부.md',
  /^docs\/현장노트\/[^/]+\.md$/,
];
/** 다시 쌓다 겹친 자리를 원격에도 있는 앞뒤 줄로 맞춰 붙여도 되는 문서. 코드·JSON은 겹치면 멈춘다. */
const 맞춰붙일문서 = /\.(md|markdown|txt|jsonl|csv|tsv)$/i;
/**
 * 한 줄이 기록 하나이고 고치지 않고 덧붙이기만 하는 장부(docs/_ops/몽골어검문.jsonl·채널성과.jsonl 등). 공용 작업본에서 도구가 덧붙인 줄과
 * origin이 덧붙인 줄이 같은 자리(파일 끝)에서 만나도 따라가기·올리기가 막히지 않게 따로 합친다(10-21, 장부덧붙이기).
 */
const 장부꼴 = /\.jsonl$/i;
const 차이한도 = 3000;
/** 같은 자리의 원격 줄 수 × 내 줄 수가 이보다 크면 겹친 줄을 찾지 않는다(그래도 같은 줄이 두 번 들어가게 되면 멈춘다). */
const 겹침찾기한도 = 4000000;
/**
 * 같은 줄의 옛·새 판으로 보는 앞부분 길이(공백을 줄인 글자 수). 10-20 origin 판 공용 문서에서 앞 40자가 같은 줄 묶음은 24개다
 * (결정 표의 같은 날·같은 표지 행이 12개 — 「| 2026-10-03 | 확정 | [Claude 추천 · 유호님 채택(MVP)] **」만 48자). 60자면 4개이고
 * 그 가운데 결정 표 1개는 실제로 겹쳐 들어간 옛·새 판이다.
 */
const 판머리길이 = 60;
/** 남이 다시 쌓아 올린 내 커밋(짝)을 찾을 때 내 커밋의 가장 이른 작성 시각보다 이만큼(초) 앞선 커밋까지 본다(세션마다 시계가 조금 다르다). */
const 짝찾기여유 = 2 * 86400;
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

/**
 * 꼬리 없는 공용 작업본이면 {가지, 원격}: 메인 작업본(연결 작업본이 아님)의 가지가 받아 둔 origin 같은 이름 가지의 조상이다.
 * 받아 둔 origin 판이 낡았어도 조상이면 최신 origin의 조상이다. origin 추적 가지가 없으면 null.
 */
function 꼬리없는공용가지(git, 원격 = 'origin') {
  let 가지 = '';
  try { 가지 = git.글(['symbolic-ref', '-q', 'HEAD']); } catch (_) { return null; }
  if (!가지.startsWith('refs/heads/')) return null;
  const [gitdir, 공용gitdir] = git.글(['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir']).split('\n');
  if (path.resolve(gitdir) !== path.resolve(공용gitdir)) return null;
  const 짧은 = 가지.slice('refs/heads/'.length);
  const r = git.돌리기(['rev-parse', '-q', '--verify', `refs/remotes/${원격}/${짧은}^{commit}`], { 허용: [0, 1] });
  const O = String(r.stdout).trim();
  if (r.status !== 0 || !O) return null;
  return 조상인가(git, 'HEAD', O) ? { 가지: 짧은, 원격: `${원격}/${짧은}` } : null;
}

/** 내커밋 커밋 인자와 같은 일을 하는 바로올리기 명령(안내 글). 조각은 고름을 다시 「id」·「id:줄」 꼴로 쓴다. */
function 바로올리기안내(경로들, 조각, 옵션) {
  const 따옴 = (s) => (/^[\w./가-힣=:,-]+$/.test(s) ? s : `"${String(s).replace(/(["\\$`])/g, '\\$1')}"`);
  const 칸 = ['node', 'tools/바로올리기.js', ...경로들.filter((p) => !조각.has(p)).map(따옴)];
  for (const [p, 고름] of 조각) {
    const 값 = 고름 === '전부' ? '전부' : [...고름].flatMap(([id, 줄]) => (줄 === true ? [id] : [...줄].sort((a, b) => a - b).map((n) => `${id}:${n}`))).join(',');
    칸.push('--조각', 따옴(`${p}=${값}`));
  }
  if (옵션.폴더) 칸.push('--폴더');
  if (옵션.메시지파일) 칸.push('-F', 따옴(옵션.메시지파일));
  else for (const m of [].concat(옵션.메시지 || [])) 칸.push('-m', 따옴(m));
  if (!옵션.메시지파일 && ![].concat(옵션.메시지 || []).length) 칸.push('-m', '"…"');
  return 칸.join(' ');
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
 * 겹친 줄로 맞대도 되는 줄: 글자·숫자가 있고 코드 울타리(```)나 태그만 있는 줄이 아니다.
 * 빈 줄·`---`·`|---|`·```·</details> 같은 틀 줄은 서로 다른 덩어리에서도 똑같이 나온다.
 */
function 뚜렷한줄(글) {
  const s = 보이게(글).trim();
  return /[\p{L}\p{N}]/u.test(s) && !/^(`{3,}|~{3,})/.test(s) && !/^<\/?[A-Za-z][^<>]*>$/.test(s);
}

/** b마다: R[b-h..b)가 N의 앞 h줄과 같은 가장 긴 h(머리), R[b..b+t)가 N의 끝 t줄과 같은 가장 긴 t(꼬리) */
function 맞닿은겹침(R, N) {
  const 머리 = new Int32Array(R.length + 1), 꼬리 = new Int32Array(R.length + 1);
  for (let s = 0; s < R.length; s++) {
    let k = 0;
    while (s + k < R.length && k < N.length && R[s + k].글 === N[k].글) { k++; if (k > 머리[s + k]) 머리[s + k] = k; }
  }
  for (let e = R.length; e > 0; e--) {
    let k = 0;
    while (k < e && k < N.length && R[e - 1 - k].글 === N[N.length - 1 - k].글) { k++; if (k > 꼬리[e - k]) 꼬리[e - k] = k; }
  }
  return { 머리, 꼬리 };
}

/**
 * 원격이 같은 자리(앞뒤 공통 줄 사이)에 더한 줄 R 사이에 내가 더한 줄 N을 넣는다.
 * N의 앞(머리)이나 끝(꼬리)이 R 안의 이어진 줄과 같으면 원격에만 있던 줄을 작업본에 같이 넣은 것이라 그 줄은 원격에 이미 있는 것으로 보고 걷는다.
 * 머리와 꼬리를 함께 걷으면 R에서 둘이 맞닿아 있어야 하고(그 사이에 내 줄), 걷을 줄 가운데 같은 줄로 볼 줄(같은줄)이 하나는 있어야 한다.
 * 남은 내 줄은 꼬리를 걷었으면 그 바로 앞, 아니면 R 끝(원격 줄 다음에 내 줄)에 둔다. → { 넣을, 자리(R 안 번호), 걷음 }
 */
function 더한줄자리(R, N, 같은줄) {
  let b = R.length, h = 0, t = 0;
  if (R.length && N.length && R.length * N.length <= 겹침찾기한도) {
    const 셈 = [0];
    for (const l of R) 셈.push(셈[셈.length - 1] + (같은줄(l.글) ? 1 : 0));
    const { 머리, 꼬리 } = 맞닿은겹침(R, N);
    // 걷는 줄이 가장 많은 곳, 같으면 뒤쪽(원격 줄 다음)
    for (let 곳 = 0; 곳 <= R.length; 곳++) {
      const 앞 = 머리[곳], 뒤 = Math.min(꼬리[곳], N.length - 앞);
      if (앞 + 뒤 >= h + t && 셈[곳 + 뒤] > 셈[곳 - 앞]) { b = 곳; h = 앞; t = 뒤; }
    }
  }
  return { 넣을: N.slice(h, N.length - t), 자리: t ? b : R.length, 걷음: h + t };
}

/** 고친 자리: 넣을 줄의 앞이 바로 앞 원격만의 줄(앞R)의 끝과, 끝이 바로 뒤 원격만의 줄(뒤R)의 앞과 같으면 걷는다(같은줄이 있을 때만). */
function 고친줄걷기(앞R, 뒤R, N, 같은줄) {
  const 있다 = (줄들) => 줄들.some((l) => 같은줄(l.글));
  let h = 0, t = 0;
  if (N.length && (앞R.length + 뒤R.length) * N.length <= 겹침찾기한도) {
    h = 맞닿은겹침(앞R, N).머리[앞R.length];
    if (!있다(앞R.slice(앞R.length - h))) h = 0;
    t = Math.min(맞닿은겹침(뒤R, N).꼬리[0], N.length - h);
    if (!있다(뒤R.slice(0, t))) t = 0;
  }
  return { 넣을: N.slice(h, N.length - t), 걷음: h + t };
}

/**
 * 내 커밋의 변화(P → C)를 원격 판 O에 얹는다. git merge-file이 겹친다고 한 문서에만 쓴다.
 * 내가 고치거나 지운 줄은 원격 판에 그대로 이어져 있어야 한다. 더한 줄은 「원격에도 있는 다음 줄」 바로 앞에 넣는다
 * (사이에 원격만 더한 줄이 있으면 그 뒤 — 원격 줄 다음에 내 줄). 남의 미푸시 줄(P에만 있는 줄)은 건너뛴다.
 * 원격만 더한 줄을 내 커밋도 같은 자리에 품었으면 한 번만 둔다(더한줄자리·고친줄걷기). 같은 줄로 보는 것은 뚜렷한 줄 가운데
 * 바탕 P에 없고 O·C에 한 번씩만 있는 줄이다 — 문서에 되풀이되는 틀 줄(`- **방법:**` 등)은 같은 줄로 보지 않는다.
 * 그렇게 걷지 못해 같은 줄이 결과에 두 번 남으면(내 조각 가운데에 넣었거나 차이가 다른 자리로 보냈다) 멈춘다.
 */
function 자리맞춰붙이기(P, O, C) {
  const 짝 = new Int32Array(P.length).fill(-1);
  for (const op of 줄차이(P.map((l) => l.글), O.map((l) => l.글))) if (op[0] === '=') 짝[op[1]] = op[2];
  const [p셈, o셈, c셈] = [P, O, C].map(줄셈);
  const 같은줄 = (글) => !p셈.has(글) && o셈.get(글) === 1 && c셈.get(글) === 1 && 뚜렷한줄(글);
  // i번 앞쪽에서 가장 가까운 공통 줄의 원격 판 번호 + 1 · i번부터 뒤쪽에서 가장 가까운 공통 줄의 원격 판 번호
  const 앞공통다음 = (i) => { let e = i - 1; while (e >= 0 && 짝[e] < 0) e--; return e >= 0 ? 짝[e] + 1 : 0; };
  const 뒤공통 = (i) => { let f = i; while (f < P.length && 짝[f] < 0) f++; return f < P.length ? 짝[f] : O.length; };
  const 고침 = [];
  for (const m of 조각나누기(줄차이(P.map((l) => l.글), C.map((l) => l.글)), P, C)) {
    const 넣을 = C.slice(m.b1, m.b2);
    if (m.a2 > m.a1) {
      const 시작 = 짝[m.a1];
      for (let i = m.a1; i < m.a2; i++) {
        if (짝[i] < 0 || 짝[i] !== 시작 + (i - m.a1)) return { 문제: `내가 고친 줄이 원격 판에 그대로 없다: ${보이게(P[i].글).slice(0, 80)}` };
      }
      const 끝 = 시작 + (m.a2 - m.a1);
      const w = 고친줄걷기(O.slice(앞공통다음(m.a1), 시작), O.slice(끝, 뒤공통(m.a2)), 넣을, 같은줄);
      고침.push({ o1: 시작, o2: 끝, 넣을: w.넣을, 걷음: w.걷음 });
    } else {
      const 처음 = 앞공통다음(m.a1);
      const w = 더한줄자리(O.slice(처음, 뒤공통(m.a1)), 넣을, 같은줄);
      고침.push({ o1: 처음 + w.자리, o2: 처음 + w.자리, 넣을: w.넣을, 더함: true, 걷음: w.걷음 });
    }
  }
  고침.sort((x, y) => x.o1 - y.o1);
  const 결과 = [], 자리 = [];
  let 앞 = 0;
  for (const g of 고침) {
    if (g.o1 < 앞) return { 문제: '고칠 자리가 서로 겹친다' };
    for (let i = 앞; i < g.o1; i++) 결과.push(O[i]);
    if ((g.더함 && g.넣을.length) || g.걷음) {
      자리.push({
        앞줄: 결과.length ? 결과[결과.length - 1].글 : null, 내줄: g.넣을.length ? g.넣을[0].글 : null, 줄수: g.넣을.length,
        ...(g.걷음 ? { 이미있음: g.걷음 } : {}),
      });
    }
    결과.push(...g.넣을);
    앞 = g.o2;
  }
  for (let i = 앞; i < O.length; i++) 결과.push(O[i]);
  const 본 = new Set();
  for (const l of 결과) {
    if (!같은줄(l.글)) continue;
    if (본.has(l.글)) return { 문제: `내가 더한 줄이 원격에도 있어 두 번 들어간다 — 그 파일은 손으로 합친다: ${보이게(l.글).slice(0, 80)}` };
    본.add(l.글);
  }
  return { 줄: 줄바꿈채우기(결과), 자리 };
}

/**
 * 덧붙이기 장부의 3방향. 바탕 P가 원격 O와 내 판 C의 앞부분(줄 글이 같다)이면 O 뒤에, C가 더한 줄 가운데 O가 더한 줄에 없는 것만
 * 차례대로 붙인다. O가 더한 줄과 같은 내 줄은 이미 올라간 것이라 한 번만 둔다(개수까지 센다). 어느 쪽이든 덧붙이기가 아니면
 * (줄을 고치거나 지우거나 가운데에 넣었다) null — 보통 합치기로 돌아간다.
 * 자리맞춰붙이기는 이미 올라간 내 줄이 원격 줄 사이에 끼면 「두 번 들어간다」로, 한 줄짜리 회차가 앞 60자가 같으면 다른판줄로 멈췄다(10-21 재현).
 */
function 장부덧붙이기(P, O, C) {
  if (O.length < P.length || C.length < P.length) return null;
  for (let i = 0; i < P.length; i++) if (O[i].글 !== P[i].글 || C[i].글 !== P[i].글) return null;
  const 원격더한 = new Map();
  for (const l of O.slice(P.length)) 원격더한.set(l.글, (원격더한.get(l.글) || 0) + 1);
  const 붙일 = [];
  for (const l of C.slice(P.length)) {
    const 남은 = 원격더한.get(l.글) || 0;
    if (남은) 원격더한.set(l.글, 남은 - 1);
    else 붙일.push(l);
  }
  return 줄바꿈채우기([...O, ...붙일]);
}

/** 줄의 앞 60자(앞뒤 공백을 떼고 이어진 공백은 한 칸으로 줄인 UTF-8 글자). 그보다 짧거나 글자·숫자가 없는 틀 줄이면 null. */
function 판머리(글) {
  if (!뚜렷한줄(글)) return null;
  const 글자 = Array.from(보이게(글).trim().replace(/\s+/g, ' ').slice(0, 판머리길이 * 2)).slice(0, 판머리길이);
  return 글자.length === 판머리길이 ? 글자.join('') : null;
}

/**
 * 합친 결과 R에 내가 새로 더한 줄(P·O에 없는 C의 줄)과 원격만 새로 더한 줄(P·C에 없는 O의 줄)이 앞 60자가 같은 채 함께 남는지 본다.
 * 그러면 같은 줄의 옛·새 판이 나란히 들어간다 — 남이 내 커밋을 먼저 다시 쌓아 올렸고 그 줄을 고친 판이 origin에 있는데, 짝을 못 찾은 옛 커밋을
 * 다시 넘겼을 때다(줄 셈 검사는 두 줄 모두 어딘가에서 온 줄이라 통과한다). 그 머리가 바탕 P에도 있거나 O·C 안에서 되풀이되면 틀 줄로 보고 넘긴다.
 * → { 내줄, 원격줄 } | null
 */
function 다른판줄(P, O, C, R) {
  const [p, o, c, r] = [P, O, C, R].map(줄셈);
  const 머리 = new Map();
  const 머리값 = (글) => { if (!머리.has(글)) 머리.set(글, 판머리(글)); return 머리.get(글); };
  const 새줄 = (셈, 빼1, 빼2) => {
    const m = new Map();
    for (const 글 of 셈.keys()) if (!빼1.has(글) && !빼2.has(글) && r.has(글) && 머리값(글)) m.set(머리값(글), 글);
    return m;
  };
  const 내새 = 새줄(c, p, o);
  if (!내새.size) return null;
  const 원격새 = 새줄(o, p, c);
  const 겹 = new Set([...내새.keys()].filter((h) => 원격새.has(h)));
  if (!겹.size) return null;
  const 머리수 = (셈) => {
    const m = new Map();
    for (const 글 of 셈.keys()) { const h = 머리값(글); if (h && 겹.has(h)) m.set(h, (m.get(h) || 0) + 1); }
    return m;
  };
  const [p수, o수, c수] = [p, o, c].map(머리수);
  for (const h of 겹) if (!p수.has(h) && o수.get(h) === 1 && c수.get(h) === 1) return { 내줄: 내새.get(h), 원격줄: 원격새.get(h) };
  return null;
}

/** 앞이 같은 두 줄이 처음 갈리는 곳 앞뒤만 보인다. → [a 조각, b 조각] */
function 갈린곳(a, b) {
  const x = Array.from(보이게(a)), y = Array.from(보이게(b));
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  const 처음 = Math.max(0, i - 20);
  return [x, y].map((z) => `${처음 ? '…' : ''}${z.slice(처음, i + 40).join('')}${z.length > i + 40 ? '…' : ''}`);
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


module.exports = { 공용문서, 맞춰붙일문서, 장부꼴, 차이한도, 겹침찾기한도, 판머리길이, 짝찾기여유, 영, 위치환경, 좋은결과, 멈춤, 사용법오류, 기본환경, 잠깐, git도구, 저장소찾기, 경로맞추기, 별도인덱스, 날차이읽기, 트리항목들, 블롭읽기, 블롭, 블롭쓰기, 글아닌경로, 조상인가, 꼬리없는공용가지, 바로올리기안내, git버전확인, 글로, 바이트로, 보이게, 이진인가, 줄나누기, 줄잇기, 줄바꿈채우기, 줄차이, 마이어스, 조각나누기, 조각만들기, 고름읽기, 고름맞추기, 조각얹기, 줄끝맞추기, 줄셈, 셈빼기, 셈더하기, 넘는줄, 줄셈검사, 뚜렷한줄, 맞닿은겹침, 더한줄자리, 고친줄걷기, 자리맞춰붙이기, 장부덧붙이기, 판머리, 다른판줄, 갈린곳, 공용문서인가, 조각보기, 메시지만들기, 공용인덱스항목, 남의스테이징, 잠금기다리기, 공용인덱스맞추기, 작업본맞추기 };
