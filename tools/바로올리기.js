#!/usr/bin/env node
'use strict';
/**
 * 바로올리기 — 고친 것을 막 받은 origin/master 위에 커밋해 곧바로 push하고, 이 작업본을 그 커밋으로 따라가게 한다.
 * 로컬 가지에 커밋을 쌓았다가 origin 위에 다시 쌓아 올리는 두 단계(내커밋.js 커밋 → 올리기)를 한 번에 하고, 로컬에는 커밋을 쌓지 않는다.
 *
 *   node tools/바로올리기.js <경로…> -m "<메시지>"             미리 보기(fetch만 한다)
 *   node tools/바로올리기.js <경로…> -m "<메시지>" --실행      origin에 올리고 이 작업본을 따라가게 한다
 *   node tools/바로올리기.js --모두 -m "<메시지>" --실행       (워크트리) 바뀐 것을 모두 올린다
 *   node tools/바로올리기.js 따라가기 [--실행]                 push 없이 이 작업본을 origin 최신으로 옮긴다
 *   node tools/바로올리기.js 가볍게 [--실행] [--되살림]         (워크트리) 큰 미디어 폴더를 작업본에서 뺀다 · 되살린다
 *   공통: --json · --저장소 <폴더> · --원격 <이름>(origin) · --가지 <이름>(master)
 *   올리기: -F <메시지 파일> · --조각 <경로>=<조각,…|전부> · --폴더 · --자세히 · --줄끝그대로 · --옛판아님 · --공용안따라감
 *   git 2.43 이상(merge-file --object-id)이 필요하다.
 *
 * 작업본 두 가지
 *   워크트리(세션마다 따로 쓰는 연결 작업본) — 바뀐 것이 모두 그 세션 것이라 경로를 통째로 올린다(공용 문서도). 폴더도 그냥 준다.
 *   공용 작업본(여러 세션이 같이 쓰는 메인 작업본) — 내커밋.js처럼 공용 문서는 --조각으로 내 조각만, 폴더는 --폴더일 때만,
 *     공용 인덱스에 남의 스테이징이 있으면 멈춘다. 로컬 master가 origin의 조상일 때(꼬리가 없을 때)만 쓴다.
 *
 * 올리기
 *   1. origin/master를 fetch해 그 커밋(O)을 고정한다.
 *   2. 이 작업본의 HEAD(B)를 바탕으로 별도 인덱스에 준 경로를 얹어 커밋 C를 만든다(어느 가지도 움직이지 않는다). 줄끝은 바탕 판을 따른다.
 *   3. C를 O 위에 다시 쌓는다 — 내커밋.js 올리기의 쌓기·검사 그대로(경로마다 3방향, 문서는 자리 맞춤, 코드 겹침은 멈춤 ·
 *      올라갈 줄은 내 줄뿐 · 내 줄 빠짐 없음 · 줄끝은 origin 판 · 저장 용량). 그래서 B 밑에 남의 미푸시 커밋(꼬리)이 깔려 있어도
 *      내가 B에서 바꾼 것만 올라간다.
 *   4. push(강제 없음). 그새 origin이 움직였으면 1부터 다시 한다(다섯 번까지).
 *   5. 따라가기(아래)로 이 작업본을 올린 커밋으로 옮긴다. 워크트리에서 올렸으면 공용 작업본도 따라가게 한다 — 공용 작업본 master가
 *      올린 커밋의 조상이고(꼬리 없음) 겹치는 미커밋이 없을 때만. 따라가기가 막혀도 push는 된 것이고, 다시 돌리면 「올릴 것 없음」이다.
 * 따라가기 — 이 작업본의 가지(분리된 HEAD면 HEAD)를 B에서 목표 T로 옮긴다. B와 T 사이에 바뀐 경로마다:
 *   깨끗한 파일은 T 판 · 아직 고치는 파일은 3방향(방금 올린 경로는 올린 판을 바탕으로, 문서는 자리 맞춤) ·
 *   T가 새로 넣는 경로에 작업본 파일이 따로 있으면 그 바이트가 T 판과 같을 때만. 하나라도 겹치면 아무것도 바꾸지 않는다.
 *   이 가지에만 있는 커밋(origin에도 다른 가지에도 없는 커밋)이 있으면 옮기지 않는다(그 커밋이 가지에서 빠지므로).
 *   반영 순서: index.lock 기다림 → 바이트 백업(<git 폴더>/바로올리기/) → 고치는 파일을 B 판으로 → read-tree -m -u B T →
 *   가지 CAS(update-ref T B) → 3방향 결과 쓰기. 중간에 실패하면 백업으로 되돌린다.
 * 가볍게 — 워크트리에서만. git sparse-checkout(cone 아님)으로 docs/캐릭터·docs/홍보물·docs/라디오를 작업본에서 뺀다(약 2.1GB).
 *   extensions.worktreeConfig가 켜져 있어 그 워크트리에만 걸린다. 필요하면 `git sparse-checkout add /docs/캐릭터/정본_4K/` 또는 --되살림.
 *
 * 함정과 고친 기록: docs/현장노트/git_줄끝_잠금.md. 시험: node --test tests/바로올리기.test.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const 내커밋 = require('./내커밋.js');
const 잠금도구 = require('./git잠금.js');

const { 조각만들기, 고름읽기, 조각얹기, 줄끝맞추기, 줄잇기, 공용문서인가 } = 내커밋;
const { 쌓기, 올릴판검사 } = 내커밋._시험;
const {
  git도구, 저장소찾기, 경로맞추기, 잠깐, 별도인덱스, 날차이읽기, 블롭, 블롭쓰기, 글아닌경로, 조상인가, git버전확인,
  잠금기다리기, 글로, 바이트로, 이진인가, 멈춤, 사용법오류,
  트리항목들, 고름맞추기, 조각보기, 메시지만들기, 세판합치기, 남의스테이징,
} = 내커밋._도구;

const 다시한도 = 5;
/** 가볍게가 빼는 폴더(10-20 origin 추적 크기: 캐릭터 1.35GB · 홍보물 0.56GB · 라디오 0.22GB, 전체 4.15GB). */
const 가볍게뺄 = ['docs/캐릭터', 'docs/홍보물', 'docs/라디오'];
const 백업보관일 = 7;
/** 따라가기가 짝을 찾아 볼 「이 가지에만 있는 커밋」 수. 넘으면 짝을 찾지 않고 멈춘다. */
const 가지만한도 = 200;
const 좋은결과 = new Set(['미리 보기', '올림', '올릴 것 없음', '따라감', '이미 최신', '가볍게 함', '되살림']);

// ── 맥락 ────────────────────────────────────────────────────────────────────

/** 옵션: 저장소 · 원격 · 가지 · 시험용 잠깐(ms) · 잠금살피기() · 잠금한도ms · 시험고리 {push직전, 가지옮기기직전, 따라가기쓰기직전} */
function 맥락(옵션 = {}) {
  const 저장소 = 저장소찾기(옵션.저장소 || process.cwd());
  const git = git도구(저장소);
  git버전확인(git, [2, 43], 'merge-file --object-id');
  const [gitdir, 공용gitdir, 인덱스파일] = git.글(['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir', '--git-path', 'index']).split('\n');
  let 가지 = null;
  try { 가지 = git.글(['symbolic-ref', '-q', 'HEAD']) || null; } catch (_) {}
  const 잠금 = `${path.resolve(인덱스파일)}.lock`;
  return {
    저장소, 기준폴더: 옵션.저장소 ? 저장소 : process.cwd(), git,
    gitdir: path.resolve(gitdir), 공용gitdir: path.resolve(공용gitdir),
    /** 메인 작업본이면 공용(여러 세션이 같이 쓴다), 연결 작업본(워크트리)이면 그 세션 것 */
    공용: path.resolve(gitdir) === path.resolve(공용gitdir),
    가지, 원격: 옵션.원격 || 'origin', 원격가지: 옵션.가지 || 'master',
    잠깐: 옵션.잠깐 || 잠깐,
    잠금살피기: 옵션.잠금살피기 || (() => 잠금도구.살피기(저장소, { 잠금 })),
    한도: { 잠금: 20000, ...(옵션.잠금한도ms || {}) },
    고리: 옵션.시험고리 || {},
  };
}

function 받기(c) {
  const 추적 = `refs/remotes/${c.원격}/${c.원격가지}`;
  const f = c.git.돌리기(['fetch', '-q', c.원격, `+refs/heads/${c.원격가지}:${추적}`], { 허용: null });
  if (f.status !== 0) throw new 멈춤(`fetch 실패 — ${String(f.stderr).trim()}`);
  return c.git.글(['rev-parse', '--verify', `${추적}^{commit}`]);
}

function 머리(c) {
  return c.git.글(['rev-parse', '--verify', 'HEAD^{commit}']);
}

/** 공용 작업본 master에 origin에 없는 커밋(꼬리)이 있으면 그 수 */
function 꼬리수(c, B, O) {
  if (조상인가(c.git, B, O)) return 0;
  return Number(c.git.글(['rev-list', '--count', `${O}..${B}`]));
}

function 진행중작업(c) {
  for (const f of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG']) {
    if (fs.existsSync(path.join(c.gitdir, f))) throw new 멈춤(`진행 중인 git 작업이 있다(${f}) — 끝난 뒤 다시 한다`);
  }
}

// ── 커밋 C 만들기(가지는 그대로) ─────────────────────────────────────────────

/**
 * B 바탕 별도 인덱스에 준 경로(모두면 바뀐 것 전부)를 얹어 커밋 C를 만든다. ref는 건드리지 않는다.
 * → {결과:'만듦', C, 바뀜, 조각보기} | {결과:'올릴 것 없음'|'멈춤', …}
 */
function C만들기(c, B, 일) {
  const { git } = c;
  const 저장 = c.저장;
  const 인덱스 = 별도인덱스(git, B);
  try {
    const 통째 = 일.경로들.filter((p) => !일.조각.has(p) || 일.조각.get(p) === '전부');
    const 고른 = 일.경로들.filter((p) => 일.조각.has(p) && 일.조각.get(p) !== '전부');
    if (일.모두) {
      const r = git.돌리기(['add', '-A'], { env: 인덱스.env, 허용: null });
      if (r.status !== 0) throw new 멈춤(`바뀐 것을 올리지 못했다 — ${String(r.stderr).trim()}`);
    } else if (통째.length) {
      const r = git.돌리기(['--literal-pathspecs', 'add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'],
        { env: 인덱스.env, input: `${통째.join('\0')}\0`, 허용: null });
      if (r.status !== 0) throw new 멈춤(`경로를 올리지 못했다 — ${String(r.stderr).trim().split('\n').filter((l) => !/^warning:/.test(l)).join(' ')}`);
    }
    const 조각들 = [];
    const 바탕항 = 트리항목들(git, B, 고른);
    for (const p of 고른) {
      const 파일 = path.join(c.저장소, p);
      if (!fs.existsSync(파일) || !fs.statSync(파일).isFile()) throw new 멈춤(`${p}: 작업본에 파일이 없다 — 조각은 있는 파일에서만 고른다`);
      const 항 = 바탕항.get(p);
      const 바탕블롭 = 항 ? 블롭(git, 저장, 항.sha) : Buffer.alloc(0);
      const 새 = fs.readFileSync(파일);
      if (이진인가(새) || 이진인가(바탕블롭)) throw new 멈춤(`${p}: 바이너리라 조각을 고를 수 없다`);
      const { B: 바탕줄, N, 묶음 } = 조각만들기(글로(바탕블롭), 글로(새));
      const 고름 = 고름맞추기(일.조각.get(p), 묶음, p);
      let 글 = 줄잇기(조각얹기(바탕줄, N, 묶음, 고름));
      if (항 && !일.줄끝그대로) 글 = 줄끝맞추기(글로(바탕블롭), 글).글;
      const sha = 블롭쓰기(git, 저장, 바이트로(글));
      git(['update-index', '--add', '--cacheinfo', `${항 ? 항.모드 : '100644'},${sha},${p}`], { env: 인덱스.env });
      조각들.push(조각보기(p, 묶음, 바탕줄, N, 고름));
    }

    const 차이 = () => 날차이읽기(git(['diff-index', '--cached', '--no-renames', '--no-abbrev', '-z', B], { env: 인덱스.env }));
    let 바뀜 = 차이();
    if (!일.모두) {
      const 밖 = 바뀜.filter((e) => !일.경로들.some((p) => e.경로 === p || e.경로.startsWith(`${p}/`)));
      if (밖.length) throw new 멈춤(`준 경로 밖이 섞였다: ${밖.map((e) => e.경로).join(', ')}`);
    }
    if (!바뀜.length) return { 결과: '올릴 것 없음', 이유: '준 경로가 바탕과 같다' };
    const 하위저장소 = 바뀜.filter((e) => e.옛모드 === '160000' || e.새모드 === '160000');
    if (하위저장소.length) throw new 멈춤(`하위 git 저장소(gitlink)가 섞였다 — 이 도구로 올리지 않는다: ${하위저장소.map((e) => e.경로).join(', ')}`);
    if (c.공용) {
      const 정확히 = new Set(일.경로들);
      const 폴더에서 = 바뀜.filter((e) => !정확히.has(e.경로));
      if (폴더에서.length && !일.폴더) {
        return {
          결과: '멈춤', 폴더파일: 폴더에서.map((e) => ({ 경로: e.경로, 상태: !e.옛 ? '추가' : !e.새 ? '지움' : '수정' })),
          이유: '공용 작업본에서 폴더 경로는 그 아래 남의 미커밋 수정·새 파일까지 올린다. 아래 파일 가운데 내 것만 하나씩 주거나, 모두 내 것이면 --폴더를 붙인다',
        };
      }
      블롭읽기묶음(c, 바뀜.flatMap((e) => [e.옛, e.새]));
      const 막힌 = [];
      for (const e of 바뀜) {
        if (!e.옛 || 일.조각.has(e.경로) || !공용문서인가(e.경로)) continue;
        const 파일 = path.join(c.저장소, e.경로);
        const 새 = e.새 && fs.existsSync(파일) ? fs.readFileSync(파일) : Buffer.alloc(0);
        const { B: 바탕줄, N, 묶음 } = 조각만들기(글로(블롭(git, 저장, e.옛)), 글로(새));
        막힌.push(조각보기(e.경로, 묶음, 바탕줄, N, null));
      }
      if (막힌.length) {
        return {
          결과: '멈춤', 조각보기: 막힌,
          이유: `공용 작업본에서 여러 세션이 같이 고치는 문서는 통째로 올리지 않는다(${막힌.map((x) => x.경로).join(', ')}) — 아래 조각 가운데 내 것만 --조각 <경로>=<조각>[,<조각>…]으로 고른다. 바뀐 곳이 모두 내 것이면 =전부`,
        };
      }
    }

    // 줄끝은 바탕 판을 따른다(통째로 올린 경로)
    const 글아님 = 글아닌경로(git, 바뀜.filter((e) => e.옛 && e.새).map((e) => e.경로));
    const 줄끝고침 = [];
    for (const e of 일.줄끝그대로 ? [] : 바뀜) {
      if (!e.옛 || !e.새 || (일.조각.has(e.경로) && 일.조각.get(e.경로) !== '전부')) continue;
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
      if (!바뀜.length) return { 결과: '올릴 것 없음', 이유: '줄끝만 바탕과 다르다 — 바탕 판의 줄끝을 따르면 바뀐 것이 없다(줄끝을 일부러 바꾸는 커밋이면 --줄끝그대로)' };
    }
    if (c.공용) {
      const 걸림 = 남의스테이징(git, 바뀜);
      if (걸림.length) return { 결과: '멈춤', 걸림, 이유: '공용 인덱스에 내 경로의 다른 스테이징이 있다 — 남이 올려 둔 것일 수 있어 손대지 않았다' };
    }
    const 트리 = git.글(['write-tree'], { env: 인덱스.env });
    const C = git.글(['commit-tree', 트리, '-p', B, '-F', '-'], { input: Buffer.from(일.메시지 || '(미리 보기)\n', 'utf8') });
    return { 결과: '만듦', C, 바뀜, 조각보기: 조각들, 줄끝고침 };
  } finally {
    인덱스.치우기();
  }
}

function 블롭읽기묶음(c, shas) {
  for (const s of shas) if (s) 블롭(c.git, c.저장, s);
}

// ── 따라가기 ────────────────────────────────────────────────────────────────

/** git status -z → 경로 → {x, y}. 옮긴 항목은 옛 경로도 지움으로 넣는다. */
function 상태읽기(git) {
  const 칸 = git(['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all']).toString('utf8').split('\0');
  const 결과 = new Map();
  for (let i = 0; i < 칸.length; i++) {
    const s = 칸[i];
    if (!s) continue;
    const x = s[0], y = s[1], p = s.slice(3);
    결과.set(p, { x, y });
    if (x === 'R' || x === 'C') {
      const 옛 = 칸[++i];
      if (옛 && x === 'R') 결과.set(옛, { x: 'D', y: ' ' });
    }
  }
  return 결과;
}

function 파일읽기(파일) {
  try {
    const st = fs.lstatSync(파일);
    if (st.isDirectory()) return { 폴더: true };
    return { 바이트: fs.readFileSync(파일) };
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return { 없음: true };
    throw e;
  }
}

/** 작업본에 쓸 바이트(체크아웃과 같은 변환) */
function 꺼낸바이트(c, sha, 경로) {
  return c.git(['cat-file', `--path=${경로}`, '--filters', sha]);
}

/**
 * B → T로 옮길 계획. 바탕들: 방금 올린 경로 → 올린 내 판(C의 blob sha 또는 null). 3방향 바탕으로 B 판 대신 쓴다.
 * → {결과:'이미 최신'} | {결과:'멈춤', 걸림[]} | {결과:'계획', B, T, 경로[], 새판[], 고침[]}
 */
function 따라가기계획(c, B, T, { 바탕들 = new Map() } = {}) {
  const { git } = c;
  if (B === T) return { 결과: '이미 최신', B, T };
  const 짧은가지 = c.가지 && c.가지.startsWith('refs/heads/') ? c.가지.slice('refs/heads/'.length) : null;
  const 가지만 = git.글(['rev-list', `--max-count=${가지만한도 + 1}`, B, '--not', T, '--remotes', ...(짧은가지 ? [`--exclude=${짧은가지}`] : []), '--branches']).split('\n').filter(Boolean);
  const 안올라간 = 가지만.length > 가지만한도 ? 가지만 : 짝없는커밋(git, 가지만, T);
  if (안올라간.length) {
    return {
      결과: '멈춤', B, T,
      이유: `이 ${짧은가지 ? `가지(${짧은가지})` : 'HEAD'}에만 있고 origin에 올라가지 않은 커밋이 ${안올라간.length > 가지만한도 ? `${가지만한도}개 넘게` : `${안올라간.length}개`} 있다 — 옮기면 가지에서 빠진다. 먼저 올리거나(내커밋.js 올리기) 다른 가지에 남긴다`,
      걸림: 안올라간.slice(0, 5).map((h) => ({ 커밋: h })),
    };
  }
  const 경로 = git(['diff', '--name-only', '-z', '--no-renames', B, T]).toString('utf8').split('\0').filter(Boolean);
  const 상태 = 상태읽기(git);
  const B항 = 트리항목들(git, B, 경로), T항 = 트리항목들(git, T, 경로);
  const 글아님 = 글아닌경로(git, 경로);
  const 새판 = [], 고침 = [], 걸림 = [];
  for (const p of 경로) {
    const st = 상태.get(p);
    const bh = B항.get(p) || null, th = T항.get(p) || null;
    const 파일 = path.join(c.저장소, p);
    const 있음 = 파일읽기(파일);
    const 덮을파일 = !bh && !있음.없음;          // T가 새로 넣는 경로에 작업본 파일(미추적·무시)이 이미 있다
    if (!st && !덮을파일) { 새판.push(p); continue; }
    if (c.공용 && st && st.x !== ' ' && st.x !== '?') { 걸림.push({ 경로: p, 이유: '공용 인덱스에 스테이징이 있다(남의 것일 수 있다)' }); continue; }
    if (있음.폴더) { 걸림.push({ 경로: p, 이유: '작업본의 그 자리에 폴더가 있다' }); continue; }
    const 바탕sha = 바탕들.has(p) ? 바탕들.get(p) : (bh ? bh.sha : null);
    const W = 있음.없음 ? null : 있음.바이트;
    const 고침항 = (sha, 방법) => 고침.push({ 경로: p, sha, 모드: th ? th.모드 : (bh ? bh.모드 : '100644'), 방법, 전: W, B있음: Boolean(bh) });
    if (W === null) {
      // 작업본에서 지웠다
      if (!th) 고침항(null, '양쪽 지움');
      else if (바탕sha && th.sha === 바탕sha) 고침항(null, '내 지움');
      else 걸림.push({ 경로: p, 이유: '작업본에서 지운 파일을 origin이 고쳤다' });
      continue;
    }
    if (!바탕sha) {
      // 바탕에 없던 파일이 작업본에 있다(미추적·새 파일)
      if (th && W.equals(꺼낸바이트(c, th.sha, p))) 고침항(th.sha, '이미 같음');
      else 걸림.push({ 경로: p, 이유: th ? 'origin이 새로 넣는 파일과 다른 파일이 작업본에 있다' : '바탕에 없는 파일이다' });
      continue;
    }
    const 바탕바이트 = 블롭(git, c.저장, 바탕sha);
    if (!th) {
      if (W.equals(꺼낸바이트(c, 바탕sha, p))) 고침항(null, '새 판(지움)');
      else 걸림.push({ 경로: p, 이유: '작업본에서 고치는 파일을 origin이 지웠다' });
      continue;
    }
    const 이진 = 이진인가(W) || 이진인가(바탕바이트) || 이진인가(블롭(git, c.저장, th.sha)) || 글아님.has(p);
    let 내sha;
    if (이진) {
      내sha = W.equals(꺼낸바이트(c, 바탕sha, p)) ? 바탕sha : W.equals(꺼낸바이트(c, th.sha, p)) ? th.sha : 블롭쓰기(git, c.저장, W);
    } else {
      내sha = 블롭쓰기(git, c.저장, 바이트로(줄끝맞추기(글로(바탕바이트), 글로(W)).글));
    }
    if (내sha === th.sha) { 고침항(th.sha, '이미 같음'); continue; }
    if (내sha === 바탕sha) { 고침항(th.sha, '새 판'); continue; }
    if (이진) { 걸림.push({ 경로: p, 이유: '바이너리 파일을 양쪽이 고쳤다' }); continue; }
    const m = 세판합치기(git, c.저장, p, th.sha, 바탕sha, 내sha);
    if (m.문제) { 걸림.push({ 경로: p, 이유: m.문제 }); continue; }
    고침항(블롭쓰기(git, c.저장, m.버퍼), m.방법);
  }
  if (걸림.length) return { 결과: '멈춤', B, T, 이유: '작업본에서 아직 고치는 파일이 origin의 변경과 겹친다 — 아무것도 옮기지 않았다', 걸림 };
  return { 결과: '계획', B, T, 경로, 새판, 고침 };
}

/**
 * 이 가지에만 있는 커밋 가운데 origin(T의 내력)에 같은 작성자·작성 시각·제목의 짝이 없는 것.
 * 내커밋.js 올리기는 커밋을 origin 위에 다시 쌓으며 이 셋을 그대로 두므로, 짝이 있으면 이미 올라간 커밋이다.
 */
function 짝없는커밋(git, 커밋들, T) {
  if (!커밋들.length) return [];
  const 키 = (an, at, s) => `${an}\u001f${at}\u001f${s}`;
  const 내것 = 커밋들.map((h) => {
    const [an, at, s] = git.글(['log', '-1', '--format=%an%x1f%at%x1f%s', h]).split('\u001f');
    return { h, at: Number(at), 키: 키(an, at, s) };
  });
  const 가장이른 = Math.min(...내것.map((x) => x.at));
  const 원격 = new Set(git(['log', '-z', '--format=%an%x1f%at%x1f%s', `--since=${가장이른 - 2 * 86400}`, T]).toString('utf8').split('\0').filter(Boolean));
  return 내것.filter((x) => !원격.has(x.키)).map((x) => x.h);
}

function 백업정리(폴더) {
  let 목록 = [];
  try { 목록 = fs.readdirSync(폴더); } catch (_) { return; }
  const 한계 = Date.now() - 백업보관일 * 86400000;
  for (const 이름 of 목록) {
    const p = path.join(폴더, 이름);
    try { if (fs.statSync(p).mtimeMs < 한계) fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
  }
}

function 바꿔쓰기(파일, 바이트) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.baro-${process.pid}.tmp`;
  try {
    fs.writeFileSync(임시, 바이트);
    fs.renameSync(임시, 파일);
  } catch (e) {
    fs.rmSync(임시, { force: true });
    throw e;
  }
}

function 되돌리기(c, 계획, 백업목록) {
  const 못함 = [];
  for (const x of 백업목록) {
    const 파일 = path.join(c.저장소, x.경로);
    try {
      if (x.바이트 === null) fs.rmSync(파일, { force: true });
      else 바꿔쓰기(파일, x.바이트);
    } catch (e) { 못함.push(`${x.경로}: ${e.message}`); }
  }
  return 못함;
}

/** 계획대로 옮긴다. → {결과:'따라감'|'멈춤'|'실패', …} */
function 따라가기실행(c, 계획) {
  const { git } = c;
  const { B, T } = 계획;
  const 잠금 = 잠금기다리기(c, c.한도.잠금);
  if (!잠금.풀림) return { 결과: '멈춤', 이유: `index.lock이 풀리지 않아 옮기지 않았다 — ${잠금.이유}` };
  if (머리(c) !== B) return { 결과: '멈춤', 이유: '그사이 HEAD가 움직였다 — 다시 돌린다' };
  for (const x of 계획.고침) {
    const 지금 = 파일읽기(path.join(c.저장소, x.경로));
    const 같음 = x.전 === null ? Boolean(지금.없음) : Boolean(지금.바이트 && 지금.바이트.equals(x.전));
    if (!같음) return { 결과: '멈춤', 이유: `그사이 작업본 파일이 바뀌었다(${x.경로}) — 다시 돌린다` };
  }
  // 바이트 백업
  const 백업뿌리 = path.join(c.gitdir, '바로올리기');
  백업정리(백업뿌리);
  const 시각 = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const 백업 = path.join(백업뿌리, `${시각}-${B.slice(0, 9)}-${T.slice(0, 9)}`);
  const 백업목록 = 계획.고침.map((x) => ({ 경로: x.경로, 바이트: x.전 }));
  if (백업목록.length) {
    fs.mkdirSync(path.join(백업, '파일'), { recursive: true });
    const 목록 = 백업목록.map((x, i) => {
      if (x.바이트 !== null) fs.writeFileSync(path.join(백업, '파일', String(i)), x.바이트);
      return { 경로: x.경로, 파일: x.바이트 === null ? null : String(i), sha256: x.바이트 === null ? null : crypto.createHash('sha256').update(x.바이트).digest('hex') };
    });
    fs.writeFileSync(path.join(백업, '목록.json'), `${JSON.stringify({ B, T, 가지: c.가지, 경로: 목록 }, null, 2)}\n`);
  }
  // 고치는 파일을 B 판으로(추적 파일은 checkout, 바탕에 없는 파일은 치운다)
  const B에있는 = 계획.고침.filter((x) => x.B있음).map((x) => x.경로);
  const B에없는 = 계획.고침.filter((x) => !x.B있음).map((x) => x.경로);
  try {
    if (B에있는.length) {
      git(['--literal-pathspecs', 'checkout', B, '--pathspec-from-file=-', '--pathspec-file-nul'], { input: `${B에있는.join('\0')}\0` });
    }
    if (B에없는.length) {
      const 올라간 = git(['--literal-pathspecs', 'ls-files', '-z', '--', ...B에없는]).toString('utf8').split('\0').filter(Boolean);
      if (올라간.length) git(['--literal-pathspecs', 'rm', '-q', '--cached', '--ignore-unmatch', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: `${올라간.join('\0')}\0` });
      for (const p of B에없는) fs.rmSync(path.join(c.저장소, p), { force: true });
    }
  } catch (e) {
    const 못함 = 되돌리기(c, 계획, 백업목록);
    return { 결과: '실패', 이유: `고치는 파일을 바탕 판으로 돌리지 못했다 — ${e.message}${못함.length ? ` / 되돌리지 못함: ${못함.join('; ')}` : ' (되돌림)'}`, 백업 };
  }
  const rt = git.돌리기(['read-tree', '-m', '-u', B, T], { 허용: null });
  if (rt.status !== 0) {
    const 못함 = 되돌리기(c, 계획, 백업목록);
    return { 결과: '실패', 이유: `read-tree가 멈췄다 — ${String(rt.stderr).trim()}${못함.length ? ` / 되돌리지 못함: ${못함.join('; ')}` : ' (되돌림)'}`, 백업 };
  }
  const 참조 = c.가지 || 'HEAD';
  if (c.고리.가지옮기기직전) c.고리.가지옮기기직전();
  const ur = git.돌리기(['update-ref', ...(c.가지 ? [] : ['--no-deref']), '-m', `바로올리기: 따라가기 ${B.slice(0, 9)} → ${T.slice(0, 9)}`, 참조, T, B], { 허용: null });
  if (ur.status !== 0) {
    const 뒤로 = git.돌리기(['read-tree', '-m', '-u', T, B], { 허용: null });
    const 못함 = 되돌리기(c, 계획, 백업목록);
    return { 결과: '실패', 이유: `가지를 옮기지 못했다(그사이 움직임) — 작업본을 되돌렸다${뒤로.status !== 0 ? `(read-tree 되돌리기 실패: ${String(뒤로.stderr).trim()})` : ''}${못함.length ? ` / 되돌리지 못함: ${못함.join('; ')}` : ''}`, 백업 };
  }
  if (c.고리.따라가기쓰기직전) c.고리.따라가기쓰기직전();
  // 3방향 결과·지움 쓰기. read-tree가 쓴 T 판이 그대로일 때만 덮는다.
  const 주의 = [];
  const T항 = 트리항목들(git, T, 계획.고침.map((x) => x.경로));
  for (const x of 계획.고침) {
    const 파일 = path.join(c.저장소, x.경로);
    const th = T항.get(x.경로) || null;
    if (x.sha === (th ? th.sha : null)) continue;              // T 판 그대로가 결과다
    const 지금 = 파일읽기(파일);
    const 기대 = th ? 꺼낸바이트(c, th.sha, x.경로) : null;
    const 그대로 = 기대 === null ? Boolean(지금.없음) : Boolean(지금.바이트 && 지금.바이트.equals(기대));
    if (!그대로) { 주의.push(`${x.경로}: 그사이 누가 써서 3방향 결과를 쓰지 않았다(백업 ${백업})`); continue; }
    try {
      if (x.sha === null) fs.rmSync(파일, { force: true });
      else 바꿔쓰기(파일, 꺼낸바이트(c, x.sha, x.경로));
    } catch (e) { 주의.push(`${x.경로}: ${e.message}(백업 ${백업})`); }
  }
  const r = {
    결과: '따라감', B, T, 경로: 계획.경로.length, 새판: 계획.새판.length,
    고침: 계획.고침.map((x) => ({ 경로: x.경로, 방법: x.방법 })), ...(백업목록.length ? { 백업 } : {}),
  };
  if (주의.length) r.주의 = 주의.join(' / ');
  return r;
}

/** 메인 작업본(공용)을 T로 따라가게 한다. 꼬리가 있거나 겹치면 건너뛴다. */
function 공용따라가기(c, T) {
  const 줄 = c.git.글(['worktree', 'list', '--porcelain']).split('\n');
  const 첫 = 줄.find((l) => l.startsWith('worktree '));
  if (!첫) return { 결과: '건너뜀', 이유: '공용 작업본을 찾지 못했다' };
  const 메인 = path.resolve(첫.slice('worktree '.length));
  if (메인 === path.resolve(c.저장소)) return null;
  let m;
  try { m = 맥락({ 저장소: 메인, 원격: c.원격, 가지: c.원격가지 }); } catch (e) { return { 결과: '건너뜀', 이유: `공용 작업본을 열지 못했다 — ${e.이유 || e.message}` }; }
  m.저장 = c.저장;
  if (m.가지 !== `refs/heads/${c.원격가지}`) return { 결과: '건너뜀', 이유: `공용 작업본이 ${c.원격가지} 가지가 아니다` };
  const B = 머리(m);
  if (B === T) return { 결과: '이미 최신' };
  if (!조상인가(m.git, B, T)) return { 결과: '건너뜀', 이유: `공용 작업본 ${c.원격가지}에 origin에 없는 커밋(꼬리)이 있다 — 정리 전까지는 따라가지 않는다` };
  const 계획 = 따라가기계획(m, B, T);
  if (계획.결과 !== '계획') return 계획.결과 === '멈춤' ? { 결과: '건너뜀', 이유: 계획.이유, 걸림: 계획.걸림 } : { 결과: 계획.결과 };
  const r = 따라가기실행(m, 계획);
  return r.결과 === '따라감' ? r : { 결과: '건너뜀', 이유: r.이유 };
}

// ── 명령 ────────────────────────────────────────────────────────────────────

/** 옵션: 저장소 · 경로들[] · 모두 · 조각 · 메시지 · 메시지파일 · 실행 · 폴더 · 자세히 · 줄끝그대로 · 옛판아님 · 공용안따라감 */
async function 올리기(옵션 = {}) {
  try {
    const c = 맥락(옵션);
    c.저장 = new Map();
    const { git } = c;
    const 조각 = new Map();
    for (const [p, v] of (옵션.조각 instanceof Map ? [...옵션.조각] : (옵션.조각 || []))) {
      const 경로 = 경로맞추기(c.저장소, p, c.기준폴더);
      const 고름 = typeof v === 'string' ? 고름읽기(v) : v;
      const 있던 = 조각.get(경로);
      if (있던 === '전부' || 고름 === '전부') { 조각.set(경로, '전부'); continue; }
      if (있던) for (const [id, 줄] of 고름) 있던.set(id, 있던.get(id) === true || 줄 === true ? true : new Set([...(있던.get(id) || []), ...줄]));
      else 조각.set(경로, 고름);
    }
    const 경로들 = [...new Set([...(옵션.경로들 || []).map((p) => 경로맞추기(c.저장소, p, c.기준폴더)), ...조각.keys()])];
    const 모두 = Boolean(옵션.모두);
    if (모두 && c.공용) throw new 사용법오류('--모두는 워크트리에서만 쓴다 — 공용 작업본에는 남의 미커밋이 섞인다');
    if (모두 && 경로들.length) throw new 사용법오류('--모두와 경로를 함께 주지 않는다');
    if (!모두 && !경로들.length) throw new 사용법오류('올릴 경로를 준다(워크트리에서 바뀐 것을 모두 올리려면 --모두)');
    const 메시지 = 메시지만들기({ ...옵션, 기준폴더: c.기준폴더 });
    const 실행 = Boolean(옵션.실행);
    if (실행 && !메시지) throw new 사용법오류('커밋 메시지가 없다(-m "…" 또는 -F 파일)');
    const 일 = { 경로들, 조각, 모두, 폴더: Boolean(옵션.폴더), 줄끝그대로: Boolean(옵션.줄끝그대로), 메시지 };
    진행중작업(c);

    let 만든 = null;
    for (let 차례 = 1; 차례 <= 다시한도; 차례++) {
      const O = 받기(c);
      const B = 머리(c);
      const 요약 = {
        작업본: c.공용 ? '공용' : '워크트리', 가지: c.가지 ? c.가지.replace(/^refs\/heads\//, '') : '(분리된 HEAD)',
        원격: `${c.원격}/${c.원격가지}`, 바탕: B, 원격머리: O, ...(차례 > 1 ? { 다시한수: 차례 - 1 } : {}),
      };
      if (c.공용) {
        const 꼬리 = 꼬리수(c, B, O);
        if (꼬리) return { 결과: '멈춤', 이유: `공용 작업본 ${요약.가지}에 origin에 없는 커밋(꼬리)이 ${꼬리}개 있다 — 정리 전까지 공용 작업본에서는 내커밋.js 커밋·올리기를 쓴다(워크트리에서는 바로 쓴다)`, ...요약 };
      }
      if (!만든 || 만든.B !== B) {
        const m = C만들기(c, B, 일);
        if (m.결과 !== '만듦') return { ...m, ...요약 };
        만든 = { ...m, B };
      }
      const 바탕들 = new Map(만든.바뀜.map((e) => [e.경로, e.새]));
      let 계획 = 쌓기(git, c.저장, O, [만든.C], { 줄끝그대로: 일.줄끝그대로, 옛판아님: Boolean(옵션.옛판아님) });
      let 검사 = 계획.문제.length || 계획.머리 === O ? null : await 올릴판검사(git, c.저장, c.저장소, O, 계획, { 줄끝그대로: 일.줄끝그대로 });
      if (계획.그대로 && 검사 && 검사.문제.length && 검사.문제.every((x) => x.줄끝)) {
        계획 = 쌓기(git, c.저장, O, [만든.C], { 다시쌓기: true, 옛판아님: Boolean(옵션.옛판아님) });
        검사 = 계획.문제.length || 계획.머리 === O ? null : await 올릴판검사(git, c.저장, c.저장소, O, 계획);
      }
      const 경로보기 = 계획.경로.map((x) => ({ 경로: x.경로, 방법: x.방법, ...(x.자리 ? { 자리: x.자리 } : {}) }));
      Object.assign(요약, { 경로: 경로보기, ...(만든.조각보기.length ? { 조각보기: 만든.조각보기 } : {}), ...(만든.줄끝고침.length ? { 줄끝고침: 만든.줄끝고침 } : {}) });
      if (계획.문제.length) return { 결과: '멈춤', 이유: 'origin 위에 얹지 못한 경로가 있다 — 아무것도 올리지 않았다', 문제: 계획.문제, ...요약 };
      if (계획.머리 === O) {
        // 내용이 이미 origin에 있다. 실행이면 작업본만 origin으로 따라가게 한다.
        const r = { 결과: '올릴 것 없음', 이유: '준 경로의 바뀐 내용이 이미 origin에 다 있다', ...요약 };
        if (실행 && B !== O) r.따라가기 = 따라가기한번(c, B, O, 바탕들);
        return r;
      }
      if (검사.문제.length) {
        return { 결과: '멈춤', 이유: `올릴 판 검사에 걸렸다 — 아무것도 올리지 않았다${검사.문제.some((x) => x.줄끝) ? '(줄끝을 일부러 바꾸는 커밋이면 --줄끝그대로)' : ''}`, 문제: 검사.문제, 용량: 검사.용량, ...요약 };
      }
      요약.머리 = 계획.머리;
      요약.수 = 줄수(git, O, 계획.머리);
      요약.용량 = 검사.용량;
      if (!실행) {
        const 미리 = 따라가기계획(c, B, 계획.머리, { 바탕들 });
        return { 결과: '미리 보기', ...요약, 따라가기: 계획요약(미리) };
      }
      if (c.고리.push직전) c.고리.push직전(차례);
      const p = git.돌리기(['push', '--porcelain', c.원격, `${계획.머리}:refs/heads/${c.원격가지}`], { 허용: null });
      const 출력 = `${p.stdout}\n${p.stderr}`;
      if (p.status !== 0) {
        if (/non-fast-forward|fetch first|\[rejected\]|stale info/.test(출력) && 차례 < 다시한도) continue;
        return { 결과: '멈춤', 이유: `push가 거절됐다 — ${출력.trim().split('\n').slice(-3).join(' / ')}`, ...요약 };
      }
      // 여기부터는 push가 끝난 뒤다. 따라가기가 막혀도 결과는 「올림」이다.
      const r = { 결과: '올림', ...요약 };
      try {
        r.원격확인 = git.글(['ls-remote', c.원격, `refs/heads/${c.원격가지}`]).split(/\s/)[0] === 계획.머리;
      } catch (e) { r.주의 = `push는 됐지만 ls-remote로 다시 확인하지 못했다 — ${e.message}`; }
      git.돌리기(['update-ref', `refs/remotes/${c.원격}/${c.원격가지}`, 계획.머리], { 허용: null });
      r.따라가기 = 따라가기한번(c, B, 계획.머리, 바탕들);
      if (!c.공용 && !옵션.공용안따라감) {
        try { const s = 공용따라가기(c, 계획.머리); if (s) r.공용따라가기 = s; } catch (e) { r.공용따라가기 = { 결과: '건너뜀', 이유: e.이유 || e.message }; }
      }
      return r;
    }
    return { 결과: '멈춤', 이유: `origin이 계속 움직여 ${다시한도}번 모두 올리지 못했다(아무것도 바뀌지 않음)` };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

function 따라가기한번(c, B, T, 바탕들) {
  try {
    const 계획 = 따라가기계획(c, B, T, { 바탕들 });
    if (계획.결과 !== '계획') return 계획요약(계획);
    return 따라가기실행(c, 계획);
  } catch (e) {
    return { 결과: '실패', 이유: e.이유 || e.message };
  }
}

function 계획요약(계획) {
  if (계획.결과 !== '계획') return { 결과: 계획.결과, ...(계획.이유 ? { 이유: 계획.이유 } : {}), ...(계획.걸림 ? { 걸림: 계획.걸림 } : {}) };
  return { 결과: '계획', B: 계획.B, T: 계획.T, 경로: 계획.경로.length, 새판: 계획.새판.length, 고침: 계획.고침.map((x) => ({ 경로: x.경로, 방법: x.방법 })) };
}

function 줄수(git, 앞, 뒤) {
  const 수 = [];
  for (const 줄 of git(['diff', '--numstat', '--no-renames', '-z', 앞, 뒤]).toString('utf8').split('\0')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(줄);
    if (m) 수.push({ 경로: m[3], 더함: m[1] === '-' ? null : Number(m[1]), 뺌: m[2] === '-' ? null : Number(m[2]) });
  }
  return 수;
}

/** 옵션: 저장소 · 실행 → push 없이 이 작업본을 origin 최신으로 옮긴다. */
async function 따라가기(옵션 = {}) {
  try {
    const c = 맥락(옵션);
    c.저장 = new Map();
    진행중작업(c);
    const O = 받기(c);
    const B = 머리(c);
    if (c.공용 && !조상인가(c.git, B, O)) {
      return { 결과: '멈춤', 이유: `공용 작업본에 origin에 없는 커밋(꼬리)이 ${꼬리수(c, B, O)}개 있다 — 정리 전까지는 따라가지 않는다`, B, T: O };
    }
    const 계획 = 따라가기계획(c, B, O);
    if (계획.결과 !== '계획') return 계획요약(계획);
    if (!옵션.실행) return { ...계획요약(계획), 결과: '미리 보기' };
    return 따라가기실행(c, 계획);
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

/** 옵션: 저장소 · 실행 · 되살림 → 워크트리에서 큰 미디어 폴더를 sparse-checkout으로 뺀다. */
async function 가볍게(옵션 = {}) {
  try {
    const c = 맥락(옵션);
    if (c.공용) throw new 멈춤('공용 작업본은 가볍게 하지 않는다 — 예약 작업이 그 파일을 읽는다. 워크트리에서만 쓴다');
    const { git } = c;
    const 켜짐 = git.돌리기(['config', '--get', 'core.sparseCheckout'], { 허용: null });
    const 지금켜짐 = String(켜짐.stdout).trim() === 'true';
    if (옵션.되살림) {
      if (!지금켜짐) return { 결과: '되살림', 이유: '이미 전체 작업본이다' };
      if (!옵션.실행) return { 결과: '미리 보기', 할일: 'git sparse-checkout disable — 뺀 폴더를 다시 꺼낸다' };
      const r = git.돌리기(['sparse-checkout', 'disable'], { 허용: null });
      if (r.status !== 0) throw new 멈춤(`되살리지 못했다 — ${String(r.stderr).trim()}`);
      return { 결과: '되살림' };
    }
    const 고침 = git(['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...가볍게뺄]).toString('utf8').split('\0').filter(Boolean);
    if (고침.length) return { 결과: '멈춤', 이유: `뺄 폴더에 아직 커밋하지 않은 파일이 ${고침.length}개 있다 — 먼저 올리거나 옮긴다`, 걸림: 고침.slice(0, 10) };
    let 바이트 = 0, 수 = 0;
    for (const 줄 of git(['ls-tree', '-r', '-l', '-z', 'HEAD', '--', ...가볍게뺄]).toString('utf8').split('\0')) {
      const m = /^\d+ blob [0-9a-f]+\s+(\d+)\t/.exec(줄);
      if (m) { 바이트 += Number(m[1]); 수++; }
    }
    const 무늬 = ['/*', ...가볍게뺄.map((p) => `!/${p}/`)];
    const 요약 = { 뺄폴더: 가볍게뺄, 파일: 수, 바이트, 무늬 };
    if (!옵션.실행) return { 결과: '미리 보기', ...요약 };
    const r = git.돌리기(['sparse-checkout', 'set', '--no-cone', '--stdin'], { input: `${무늬.join('\n')}\n`, 허용: null });
    if (r.status !== 0) throw new 멈춤(`가볍게 하지 못했다 — ${String(r.stderr).trim()}`);
    const 범위 = git.글(['config', '--show-scope', '--get', 'core.sparseCheckout']);
    return { 결과: '가볍게 함', ...요약, 설정: 범위 };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const 사용법 = `사용법
  node tools/바로올리기.js <경로…> -m "<메시지>" [--조각 <경로>=<조각,…|전부>] [--폴더] [--자세히] [--줄끝그대로] [--옛판아님] [--공용안따라감] [--실행] [--json]
  node tools/바로올리기.js --모두 -m "<메시지>" [--실행]      (워크트리) 바뀐 것을 모두
  node tools/바로올리기.js 따라가기 [--실행]                  push 없이 이 작업본을 origin 최신으로
  node tools/바로올리기.js 가볍게 [--되살림] [--실행]          (워크트리) 큰 미디어 폴더를 빼고·되살린다
  기본은 미리 보기다. --실행을 붙여야 올리고 옮긴다. 검사는 모두 안에서 돌고 걸리면 아무것도 바꾸지 않는다.
  자세한 설명은 파일 머리.`;

function 인자읽기(argv) {
  const 처음 = argv[0];
  if (처음 === '--help' || 처음 === '-h' || 처음 === '도움말') return { 도움말: true };
  const 명령 = 처음 === '따라가기' || 처음 === '가볍게' ? 처음 : '올리기';
  const 나머지 = 명령 === '올리기' ? argv : argv.slice(1);
  if (명령 === '올리기' && !argv.length) return { 도움말: true };
  const 옵션 = { 명령, 위치: [], 메시지: [], 조각: [], 실행: false, json: false };
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
    else if (['--모두', '--폴더', '--자세히', '--줄끝그대로', '--옛판아님', '--공용안따라감', '--되살림'].includes(a)) 옵션[a.slice(2)] = true;
    else if (a === '--저장소') 옵션.저장소 = 값();
    else if (a === '--원격') 옵션.원격 = 값();
    else if (a === '--가지') 옵션.가지 = 값();
    else if (a.startsWith('-')) throw new 사용법오류(`모르는 인자: ${a}`);
    else 옵션.위치.push(a);
  }
  const 올리기만 = ['모두', '폴더', '자세히', '줄끝그대로', '옛판아님', '공용안따라감'].filter((k) => 옵션[k]);
  if (명령 !== '올리기') {
    if (옵션.위치.length || 옵션.메시지.length || 옵션.메시지파일 || 옵션.조각.length || 올리기만.length) throw new 사용법오류(`${명령}은 경로·메시지·올리기 인자를 받지 않는다`);
    if (명령 === '따라가기' && 옵션.되살림) throw new 사용법오류('--되살림은 가볍게에만 쓴다');
  } else {
    if (옵션.되살림) throw new 사용법오류('--되살림은 가볍게에만 쓴다');
    옵션.경로들 = 옵션.위치;
  }
  return 옵션;
}

const 짧게 = (sha) => (sha ? sha.slice(0, 9) : '');

function 따라가기글(r, 머리말 = '따라가기') {
  if (!r) return [];
  if (r.결과 === '따라감') {
    const 고친 = (r.고침 || []).filter((x) => x.방법 !== '이미 같음' && x.방법 !== '새 판');
    return [`${머리말}: ${짧게(r.B)} → ${짧게(r.T)} · 바뀐 경로 ${r.경로}(새 판 ${r.새판}${고친.length ? ` · 고치던 파일에 얹음 ${고친.length}` : ''})${r.주의 ? ` · 주의: ${r.주의}` : ''}`];
  }
  if (r.결과 === '계획') return [`${머리말}(실행하면): ${짧게(r.B)} → ${짧게(r.T)} · 바뀐 경로 ${r.경로}(새 판 ${r.새판} · 고치던 파일 ${r.고침.length})`];
  const 줄 = [`${머리말}: ${r.결과}${r.이유 ? ` — ${r.이유}` : ''}`];
  for (const x of (r.걸림 || []).slice(0, 8)) 줄.push(`  - ${x.경로 || 짧게(x.커밋)}${x.이유 ? `: ${x.이유}` : ''}`);
  return 줄;
}

function 올리기글(r) {
  const 줄 = [`[${r.결과}]${r.이유 ? ` ${r.이유}` : ''}`];
  if (r.작업본) 줄.push(`작업본: ${r.작업본}(${r.가지}) · 바탕 ${짧게(r.바탕)} · ${r.원격} ${짧게(r.원격머리)}${r.다시한수 ? ` · 그새 origin이 움직여 ${r.다시한수}번 다시` : ''}`);
  if (r.머리) 줄.push(`${r.결과 === '올림' ? '올린' : '올릴'} 커밋: ${짧게(r.머리)}(부모 ${짧게(r.원격머리)})${r.결과 === '올림' && r.원격확인 ? ' · origin 확인 ✓' : ''}`);
  for (const x of r.수 || []) {
    const 방법 = (r.경로 || []).find((y) => y.경로 === x.경로);
    줄.push(`  ${x.경로}  +${x.더함 ?? '바이너리'} −${x.뺌 ?? ''}${방법 ? ` · ${방법.방법}` : ''}`);
  }
  for (const x of r.문제 || []) 줄.push(`  ✗ ${x.경로 ? `${x.경로}: ` : ''}${x.이유}`);
  for (const x of r.걸림 || []) 줄.push(`  ✗ ${x.경로}: ${x.이유}`);
  for (const x of r.폴더파일 || []) 줄.push(`  - ${x.경로} (${x.상태})`);
  for (const 보기 of r.조각보기 || []) {
    줄.push(`  조각 — ${보기.경로}`);
    for (const 조각 of 보기.조각) {
      줄.push(`    [${조각.id}] ${조각.행}행 −${조각.뺀} +${조각.더한}`);
      for (const l of 조각.줄) 줄.push(`      ${l.번호} ${l.표}${l.고름 ? '✓' : ' '} ${l.글.slice(0, 160)}`);
    }
  }
  if (r.용량 && r.용량.통과 === false) 줄.push(`  저장 용량: 걸림 (${(r.용량.위반 || []).map((v) => v.code).join(', ')})`);
  줄.push(...따라가기글(r.따라가기));
  if (r.공용따라가기) 줄.push(...따라가기글(r.공용따라가기, '공용 작업본'));
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  if (r.결과 === '미리 보기') 줄.push('검사 통과 — --실행을 붙이면 올린다.');
  return 줄.join('\n');
}

function 가볍게글(r) {
  const 줄 = [`[${r.결과}]${r.이유 ? ` ${r.이유}` : ''}`];
  if (r.뺄폴더) 줄.push(`뺄 폴더: ${r.뺄폴더.join(' · ')} — 파일 ${r.파일}개 · ${(r.바이트 / 1048576).toFixed(0)}MB${r.설정 ? ` · 설정 범위 ${r.설정}` : ''}`);
  if (r.할일) 줄.push(r.할일);
  for (const x of r.걸림 || []) 줄.push(`  - ${x}`);
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
    r = 옵션.명령 === '따라가기' ? await 따라가기(옵션) : 옵션.명령 === '가볍게' ? await 가볍게(옵션) : await 올리기(옵션);
  } catch (e) {
    if (e instanceof 사용법오류) { console.error(`${e.message}\n${사용법}`); return 2; }
    r = { 결과: '실패', 이유: e.message };
  }
  if (옵션.json) console.log(JSON.stringify(r, null, 2));
  else if (옵션.명령 === '가볍게') console.log(가볍게글(r));
  else if (옵션.명령 === '따라가기') console.log([`[${r.결과}]${r.이유 && r.결과 !== '따라감' ? ` ${r.이유}` : ''}`, ...따라가기글(r.결과 === '미리 보기' ? { ...r, 결과: '계획' } : r)].join('\n'));
  else console.log(올리기글(r));
  return 좋은결과.has(r.결과) || r.결과 === '계획' ? 0 : 1;
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = { 올리기, 따라가기, 가볍게, 인자읽기, main, 가볍게뺄, _시험: { 따라가기계획, 따라가기실행, 공용따라가기, 상태읽기, 맥락 } };
