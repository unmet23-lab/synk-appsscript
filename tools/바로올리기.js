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
 *   올리기: -F <메시지 파일> · --조각 <경로>=<조각,…|전부> · --폴더 · --자세히 · --줄끝그대로 · --옛판아님 · --공용안따라감 · --운영안따라감 · --시험건너뜀 <까닭>
 *           · --짝검사건너뜀 <까닭>
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
 *      올라갈 줄은 내 줄뿐 · 내 줄 빠짐 없음 · 줄끝은 origin 판 · 저장 용량 · 공개 검사(tools/공개검사.js — O 대비 더한 줄과
 *      커밋 메시지에 개인정보·학생 명단·미공개 특허가 있으면 멈춤)). 그래서 B 밑에 남의 미푸시 커밋(꼬리)이 깔려 있어도
 *      내가 B에서 바꾼 것만 올라간다.
 *   3¼. 짝 검사(미리 보기와 --실행 모두, 2026-10-22) — tools/짝검사.js 표의 원천·결과물에 걸리는 경로가 있을 때만 그 생성기
 *      대조(WORLD 묶음·학습 묶음·Atlas 사본·계정 묶음·TOPIK4 문항)와 지면폰트 ⑦을 작업본에서 돌린다. 낡았거나 결과물이 작업본에서
 *      바뀐 채 이번 push에 없으면 아무것도 올리지 않고 고치는 명령을 보인다. 상관없는 push는 아무것도 안 돈다.
 *      이 push와 무관하면 --짝검사건너뜀 "<까닭>"(까닭은 커밋 메시지에 남는다).
 *   3½. 관련 시험(--실행 때만, 2026-10-21) — tools/관련시험.js가 바꾼 경로를 실제로 읽는 CI 시험만 골라 push 전에 돌린다
 *      (CI 읽기 기록 지도 + 시험 글의 경로·이름). 깨지면 아무것도 올리지 않는다. 공용 작업본에서 깨진 시험이 남의 미커밋을
 *      읽으면 막지 않고 주의만 남긴다. 이 push와 무관한 실패면 --시험건너뜀 "<까닭>"(까닭은 커밋 메시지에 남는다).
 *      이번 push로 처음 들어가는 파일은 SYNK_새파일로 넘긴다(git ls-files로 훑는 시험이 보게).
 *      PC가 바빠 15분 한도만 넘기고 그때까지 깨진 시험이 없으면 막지 않고 주의만 남긴다 — 같은 시험을 CI가 다시 돈다(2026-10-22).
 *      미리 보기는 고른 목록만 보인다. master CI가 빨가면 tools/ci빨간불.js의 빠른 상태를 경고로 보인다(막지는 않는다).
 *   4. push(강제 없음). 그새 origin이 움직였으면 1부터 다시 한다(다섯 번까지).
 *   5. 따라가기(아래)로 이 작업본을 올린 커밋으로 옮긴다. 워크트리에서 올렸으면 공용 작업본도 따라가게 한다 — 공용 작업본 master가
 *      올린 커밋의 조상이고(꼬리 없음) 겹치는 미커밋이 없을 때만. 따라가기가 막혀도 push는 된 것이고, 다시 돌리면 「올릴 것 없음」이다.
 *      예약 작업·헤르메스 감시가 실행하는 운영 사본(tools/운영사본.js)도 갱신한다 — 운영 사본에서 올렸으면 헤르메스 감시 계약만 맞춘다.
 * 따라가기 — 이 작업본의 가지(분리된 HEAD면 HEAD)를 B에서 목표 T로 옮긴다. B와 T 사이에 바뀐 경로마다:
 *   깨끗한 파일은 T 판 · 아직 고치는 파일은 3방향(방금 올린 경로는 올린 판을 바탕으로, 문서는 자리 맞춤) ·
 *   T가 새로 넣는 경로에 작업본 파일이 따로 있으면 그 바이트가 T 판과 같을 때만. 하나라도 겹치면 아무것도 바꾸지 않는다.
 *   이 가지에만 있는 커밋(origin에도 다른 가지에도 없는 커밋)이 있으면 옮기지 않는다(그 커밋이 가지에서 빠지므로).
 *   반영 순서: index.lock 기다림 → 바이트 백업(<git 폴더>/바로올리기/) → 고치는 파일을 B 판으로 → read-tree -m -u B T →
 *   가지 CAS(update-ref T B) → 3방향 결과 쓰기. 중간에 실패하면 백업으로 되돌린다.
 * 가볍게 — 워크트리에서만. git sparse-checkout(cone 아님)으로 docs/캐릭터·docs/홍보물·docs/라디오를 작업본에서 뺀다(약 2.1GB).
 *   extensions.worktreeConfig가 켜져 있어 그 워크트리에만 걸린다. 필요한 폴더만 `가볍게 --되살림 docs/캐릭터/정본_4K --실행`, 전부는 `--되살림`.
 *
 * 함정과 고친 기록: docs/현장노트/git_줄끝_잠금.md. 시험: node --test tests/바로올리기.test.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const 내커밋 = require('./내커밋.js');
const 잠금도구 = require('./git잠금.js');
const 공개검사 = require('./공개검사.js');
/** push 전 짝 검사·관련 시험·CI 빨간불 경고 — 도구를 골라 복사해 도는 시험 사본처럼 파일이 없으면 그 검사만 건너뛴다. */
const 있으면 = (이름) => { try { return require(이름); } catch (e) { if (e && e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(이름.slice(2))) return null; throw e; } };
const 짝검사 = 있으면('./짝검사.js');
const 관련시험 = 있으면('./관련시험.js');
const ci빨간불 = 있으면('./ci빨간불.js');
const 운영사본 = 있으면('./운영사본.js');

const { 조각만들기, 고름읽기, 조각얹기, 줄끝맞추기, 줄나누기, 줄잇기, 줄차이, 공용문서인가 } = 내커밋;
const { 쌓기, 올릴판검사 } = 내커밋._시험;
const {
  git도구, 저장소찾기, 경로맞추기, 잠깐, 별도인덱스, 날차이읽기, 블롭, 블롭쓰기, 글아닌경로, 조상인가, git버전확인,
  잠금기다리기, 줄바꿈채우기, 줄셈, 뚜렷한줄, 글로, 바이트로, 보이게, 이진인가, 멈춤, 사용법오류,
  트리항목들, 고름맞추기, 조각보기, 메시지만들기, 세판합치기, 남의스테이징, 검사멈춤이유,
} = 내커밋._도구;

const 다시한도 = 5;
/** 가볍게가 빼는 폴더(10-20 origin 추적 크기: 캐릭터 1.35GB · 홍보물 0.56GB · 라디오 0.22GB, 전체 4.15GB). */
const 가볍게뺄 = ['docs/캐릭터', 'docs/홍보물', 'docs/라디오'];
const 백업보관일 = 7;
/** 따라가기가 짝을 찾아 볼 「이 가지에만 있는 커밋」 수. 넘으면 짝을 찾지 않고 멈춘다. */
const 가지만한도 = 200;
/**
 * 3방향 바탕을 맞출 때 읽는 그 경로의 origin 판 수(새것부터). 60개로 자르니 반나절 막힌 공용 작업본(트랙 104판 뒤)에서 작업본이 받은 옛 판이 창
 * 밖이라 「쓰는 중인 줄」로 보여 멈췄다(10-22 저녁 WORLD TOPIK 줄). 시험은 SYNK_이력판한도로 줄여 잰다.
 */
const 이력판한도 = Number(process.env.SYNK_이력판한도) || 400;
const 좋은결과 = new Set(['미리 보기', '올림', '올릴 것 없음', '따라감', '이미 최신', '가볍게 함', '되살림']);
/** 공용 작업본에 꼬리가 다시 생겼을 때(2026-10-20 정리 뒤 로컬 master에 커밋이 쌓임) 할 일 */
const 꼬리안내 = '꼬리 커밋은 먼저 `node tools/내커밋.js 올리기 <커밋…> --실행`으로 origin에 올리고, docs/현장노트/git_줄끝_잠금.md 「공용 작업본 꼬리 정리」대로 master를 origin의 조상으로 되돌린다';

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
    // 인덱스에서 지운 경로에 작업본 파일이 남으면 「D 」 뒤에 「??」가 또 나온다 — 미추적 줄이 스테이징을 가리지 않게 한다
    if (x === '?' && 결과.has(p)) continue;
    결과.set(p, { x, y });
    if (x === 'R' || x === 'C') {
      const 옛 = 칸[++i];
      if (옛 && x === 'R') 결과.set(옛, { x: 'D', y: ' ', 이름바꿈: true });
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

/** 이 경로로 git add 하면 생길 blob의 sha(줄끝 정규화 같은 clean 필터를 거친다). 객체는 쓰지 않는다. */
function 깨끗한sha(c, 경로, 바이트) {
  return c.git.글(['hash-object', `--path=${경로}`, '--stdin'], { input: 바이트 });
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
  const 새판 = [], 고침 = [], 걸림 = [], 비킬 = [];
  for (const p of 경로) {
    const st = 상태.get(p);
    const bh = B항.get(p) || null, th = T항.get(p) || null;
    const 파일 = path.join(c.저장소, p);
    const 있음 = 파일읽기(파일);
    const 덮을파일 = !bh && !있음.없음;          // T가 새로 넣는 경로에 작업본 파일(미추적·무시)이 이미 있다
    if (!st && !덮을파일) { 새판.push(p); continue; }
    // 인덱스에서 이미 지웠고(작업본에 남긴 파일은 무시·미추적) origin도 지운 경로 — 인덱스가 이미 T와 같으니 남의 스테이징이 아니라
    // 먼저 올라간 일이다. 막지 않고, 작업본에 남은 파일은 read-tree가 지우지 않게 잠깐 비켜 두었다가 되돌린다(10-21 붙여넣기 판 셋).
    // 이름 바꾸기(git mv)의 옛 경로는 남의 스테이징 그대로 멈춘다. 파일이 없는 지움도 넣어 둔다 — 실패 되돌리기에서 지움을 다시 맞춘다.
    if (!th && bh && st && st.x === 'D' && st.y === ' ' && !st.이름바꿈 && !있음.폴더) {
      비킬.push({ 경로: p, 바이트: 있음.없음 ? null : 있음.바이트, Bsha: bh.sha });
      continue;
    }
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
      // 바탕에 없던 파일이 작업본에 있다(미추적·새 파일). 줄끝만 다르면(작업본 LF · 체크아웃 CRLF) git add가 만들 blob이
      // origin 판과 같으니 같은 파일이다 — 백업 뒤 체크아웃 판으로 바뀐다(10-21, 미추적 끝난 작업물을 올렸을 때 공용 작업본이 못 따라가던 일).
      if (th && (W.equals(꺼낸바이트(c, th.sha, p)) || 깨끗한sha(c, p, W) === th.sha)) 고침항(th.sha, '이미 같음');
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
    // 작업본이 B보다 새 origin 판 위에 다시 짜였으면(공용 작업본에서 세션이 최신 판에 제 줄을 얹은 경우) 그 판을 바탕으로 3방향.
    // 바탕은 「B + 작업본이 이미 받은 origin 고침」으로 맞춘다(받은것만바탕).
    const 판들 = origin판들(c, B, T, p);
    const K = 바탕들.has(p) ? 바탕sha : 가까운바탕(c, 판들, 바탕sha, 글로(W));
    const 바탕 = 받은것만바탕(c, { 경로: p, 판들, K, 바탕sha, 바탕바이트, W, Tsha: th.sha });
    if (바탕.문제) { 걸림.push({ 경로: p, 이유: 바탕.문제 }); continue; }
    if (내sha === 바탕) { 고침항(th.sha, '새 판'); continue; }
    const m = 세판합치기(git, c.저장, p, th.sha, 바탕, 내sha);
    if (m.문제) { 걸림.push({ 경로: p, 이유: m.문제 }); continue; }
    고침항(블롭쓰기(git, c.저장, m.버퍼), m.방법);
  }
  if (걸림.length) return { 결과: '멈춤', B, T, 이유: '작업본에서 아직 고치는 파일이 origin의 변경과 겹친다 — 아무것도 옮기지 않았다', 걸림 };
  return { 결과: '계획', B, T, 경로, 새판, 고침, 비킬 };
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

/**
 * B..T 사이에 이 경로를 바꾼 커밋들(최근 이력판한도개)의 origin 판 blob — 새것부터 커밋 차례 그대로(되돌려 같은 판이 되풀이돼도 둔다 — ③이 실제
 * 전이를 본다). 그 경로가 없는 판은 뺀다.
 */
function origin판들(c, B, T, p) {
  const 커밋들 = c.git.글(['rev-list', `--max-count=${이력판한도}`, `${B}..${T}`, '--', p]).split('\n').filter(Boolean);
  if (!커밋들.length) return [];
  const 답 = c.git.글(['cat-file', '--batch-check=%(objectname) %(objecttype)'], { input: `${커밋들.map((h) => `${h}:${p}`).join('\n')}\n` });
  return 답.split('\n').map((l) => l.split(' ')).filter((x) => x.length === 2 && x[1] === 'blob').map((x) => x[0]);
}

/**
 * 고치던 파일의 3방향 바탕: B 판과 B..T 사이 origin 판들 가운데 작업본과 바뀐 줄 수가 가장 적은 판(같으면 B).
 * 작업본이 B에서 고쳐 온 것이면 B가, 더 새 origin 판에 줄을 얹은 것이면 그 판이 고른다(옛 master맞추기의 「가장 가까운 이력 판」).
 */
function 가까운바탕(c, 판들, 바탕sha, W글) {
  const 줄 = (글) => 글.replace(/\r\n/g, '\n').split('\n');
  const W줄 = 줄(W글);
  const 차이수 = (sha) => 줄차이(줄(글로(블롭(c.git, c.저장, sha))), W줄).filter((op) => op[0] !== '=').length;
  let 최선 = 바탕sha, 최선수 = 차이수(바탕sha);
  for (const sha of new Set(판들)) {
    if (sha === 바탕sha || 이진인가(블롭(c.git, c.저장, sha))) continue;
    const n = 차이수(sha);
    if (n < 최선수) { 최선 = sha; 최선수 = n; }
  }
  return 최선;
}

/** 작업본이 이미 받은 origin 줄을 작업본 자리로 바탕에 넣는 문서(장부 .jsonl은 장부 덧붙이기가 맡는다) */
const 받은줄넣을문서 = /\.(md|markdown|txt)$/i;

/** 자리(작업본 줄 번호)가 있는 바탕 줄 가운데 자리가 늘어나는 가장 긴 차례의 번호들 — 같은 작업본 줄을 두 바탕 줄이 잡았을 때 고른다. */
function 늘어나는차례(바탕줄) {
  const 끝값 = [], 끝번 = [], 앞 = new Map();
  바탕줄.forEach((x, n) => {
    if (x.자리 === undefined) return;
    let lo = 0, hi = 끝값.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (끝값[mid] < x.자리) lo = mid + 1; else hi = mid; }
    끝값[lo] = x.자리; 끝번[lo] = n; 앞.set(n, lo > 0 ? 끝번[lo - 1] : -1);
  });
  const 고른 = new Set();
  for (let n = 끝번.length ? 끝번[끝번.length - 1] : -1; n >= 0; n = 앞.get(n)) 고른.add(n);
  return 고른;
}

/** 줄 차이(줄차이 ops)를 덩어리로 — '='는 그대로 넘기고, 이어진 '-'·'+'를 [뺀 a번호들, 더한 b번호들, 다음 '='의 a번호(없으면 null)]로 부른다. */
function 덩어리마다(ops, 할일) {
  for (let i = 0; i < ops.length;) {
    if (ops[i][0] === '=') { i++; continue; }
    const 뺀 = [], 더한 = [];
    for (; i < ops.length && ops[i][0] !== '='; i++) (ops[i][0] === '-' ? 뺀 : 더한).push(ops[i][1]);
    할일(뺀, 더한, i < ops.length ? ops[i][1] : null);
  }
}

/**
 * 줄의 몸 — 목록·인용·제목 기호를 떼고, 표 행은 날짜 칸과 두 글자 이하 칸(성격·상태)을 뺀 칸들. 겹침·머리·열쇠는 몸으로 잰다 — 같은 날 결정 행은
 * 날짜·성격 칸만으로도 겹쳤다(10-22 검수 5차).
 */
function 줄몸(글) {
  const s = 보이게(글).trim();
  if (!s.startsWith('|')) return s.replace(/^(?:[-*+>]\s+|#+\s+|\d+[.)]\s+)+/, '');
  return s.split('|').map((x) => x.trim()).filter((x) => Array.from(x).length > 2 && !/^\d{2,4}(?:[-./]\d{1,2}){1,2}$/.test(x)).join(' | ');
}

const 낱말들 = (글) => new Set(글.split(/[\s,.·:;()[\]「」『』"'*|/—–]+/).filter(Boolean));
function 자카드(A, B) {
  let 같음 = 0;
  for (const x of A) if (B.has(x)) 같음++;
  return A.size + B.size - 같음 ? 같음 / (A.size + B.size - 같음) : 0;
}

/** 두 줄 몸의 낱말 겹침(자카드) — 같은 줄의 옛·새 판은 0.5를 넘는다(10-22 트랙 모두의창업 줄의 판끼리 0.86). */
const 낱말겹침 = (a, b) => 자카드(낱말들(줄몸(a)), 낱말들(줄몸(b)));

/** 몸의 첫 낱말(앞뒤 기호를 뗀다) — 항목의 머리. */
const 머리낱말 = (글) => (줄몸(글).split(/\s+/)[0] || '').replace(/^[*_`[(「『"']+|[*_`\])」』"':]+$/g, '');

/** 항목 열쇠 — 몸 맨 앞의 `[…]` 꼬리표(링크 글자는 빼고)나 `**…**` 굵은 머리. 없으면 null. */
function 항목열쇠(글) {
  const m = 줄몸(글).match(/^\[([^\]]{1,160})\](?!\()|^\*\*([^*]{1,200})\*\*/);
  return m ? (m[1] ?? m[2]) : null;
}

/**
 * 같은 줄의 옛·새 판인가. 두 줄 다 항목 열쇠가 있으면 열쇠 낱말이 0.7 이상 겹칠 때만 같은 줄이다 — `[A]`·`[N]`처럼 열쇠가 다른 항목은 나머지가
 * 거의 같아도(0.82) 다른 줄이고(10-22 검수 5차), `기한 넷(…)`·`기한 셋(…)`처럼 열쇠가 조금 바뀐 판은 같은 줄이다. 열쇠가 없으면 낱말 겹침이 0.6
 * 이상이거나, 머리 낱말이 같고 겹침이 0.15 이상이다(10-22 검수 4차).
 */
function 같은줄판(a, b) {
  const ka = 항목열쇠(a), kb = 항목열쇠(b);
  if (ka !== null && kb !== null) return 자카드(낱말들(ka), 낱말들(kb)) >= 0.7;
  const 겹침 = 낱말겹침(a, b);
  return 겹침 >= 0.6 || (겹침 >= 0.15 && 머리낱말(a) !== '' && 머리낱말(a) === 머리낱말(b));
}

/**
 * 한 덩어리 안의 짝 — 같은 줄의 판끼리만(옛 줄마다 낱말이 가장 많이 겹치는 줄). 한 줄 대 한 줄이어도 같은 줄인지 본다 — origin이 줄을 지우고
 * 다른 줄을 넣은 덩어리를 고침으로 짝지으면 작업본의 고침이 숨는다(10-22 검수 4차). 자리 차례만으로 짝지으면 옮긴 줄·더한 줄이 섞인 덩어리에서
 * 다른 줄끼리 엇갈린다(10-22 검수 3차). 항목 열쇠가 똑같은 짝을 덩어리 전체에서 먼저 맺고(앞 줄이 차례대로 고르다 뒤 줄의 열쇠 같은 판을 가로챘다 —
 * 10-22 검수 8차), 나머지는 다른 옛 줄과 열쇠가 똑같은 새 줄을 빼고 고르며, 열쇠 있는 옛 줄은 후보가 하나이고 새 판(온판) 어디에도 그 열쇠의
 * 줄이 없을 때만 짝짓는다 — `[첫째 …]`의 고친 판보다 글이 덜 바뀐 `[둘째 …]`를 짝지어(7차), 고친 판이 다른 덩어리로 옮겨 가 남은 `[둘째 …]`와
 * 짝지어(8차) 작업본의 지움이 숨었다. 온판: 새 줄들이 든 새 판 전체(없으면 새글들). → [[옛 번호, 새 번호]…]
 */
function 판짝(옛글들, 새글들, 온판 = 새글들) {
  const 열쇠 = (글) => { const k = 항목열쇠(글); return k === null ? null : 보이게(k).replace(/\s+/g, ' ').trim(); };
  const 옛열쇠 = 옛글들.map(열쇠), 새열쇠 = 새글들.map(열쇠), 옛열쇠들 = new Set(옛열쇠.filter((k) => k !== null));
  let 온판열쇠 = null;   // 처음 필요할 때 센다
  const 온판에있음 = (k) => { if (온판열쇠 === null) 온판열쇠 = new Set(온판.map(열쇠).filter((x) => x !== null)); return 온판열쇠.has(k); };
  const 쓴 = new Set(), 짝지은 = new Set(), 짝 = [];
  const 맺기 = (i, 후보) => {
    let 고른 = -1, 최고 = -1;
    for (const k of 후보) {
      const 겹침 = 낱말겹침(옛글들[i], 새글들[k]);
      if (겹침 > 최고) { 최고 = 겹침; 고른 = k; }
    }
    if (고른 >= 0) { 쓴.add(고른); 짝지은.add(i); 짝.push([i, 고른]); }
  };
  옛글들.forEach((g, i) => {
    if (옛열쇠[i] !== null) 맺기(i, 새글들.map((x, k) => k).filter((k) => !쓴.has(k) && 새열쇠[k] === 옛열쇠[i]));
  });
  // 나머지는 쌍마다 낱말 겹침을 재어 큰 것부터 맺는다 — 앞 줄부터 고르면 겹침이 낮은 앞 줄이 뒤 줄의 판을 가로챘다(10-22 검수 9차). 같은 겹침으로 한
  // 줄을 두고 겨루는 쌍은 어느 쪽도 맺지 않는다.
  const 쌍 = [];
  옛글들.forEach((g, i) => {
    if (짝지은.has(i)) return;
    const 후보 = 새글들.map((x, k) => k).filter((k) => !쓴.has(k) && !(새열쇠[k] !== null && 옛열쇠들.has(새열쇠[k])) && 같은줄판(g, 새글들[k]));
    if (옛열쇠[i] !== null && (후보.length > 1 || 온판에있음(옛열쇠[i]))) return;
    for (const k of 후보) 쌍.push({ 겹침: 낱말겹침(g, 새글들[k]), i, k });
  });
  쌍.sort((a, b) => b.겹침 - a.겹침);
  const 막힌옛 = new Set(), 막힌새 = new Set();
  for (const p of 쌍) {
    if (짝지은.has(p.i) || 쓴.has(p.k) || 막힌옛.has(p.i) || 막힌새.has(p.k)) continue;
    const 겨룸 = 쌍.filter((q) => q !== p && q.겹침 === p.겹침 && (q.i === p.i || q.k === p.k) && !짝지은.has(q.i) && !쓴.has(q.k));
    if (겨룸.length) { for (const q of [p, ...겨룸]) { 막힌옛.add(q.i); 막힌새.add(q.k); } continue; }
    쓴.add(p.k); 짝지은.add(p.i); 짝.push([p.i, p.k]);
  }
  return 짝;
}

/**
 * 고치던 문서의 3방향 바탕을 「바탕 판(B 또는 방금 올린 내 판) + 작업본이 이미 받은 origin 고침」으로 맞춘다. 작업본은 바탕 판에서 나왔다.
 * 줄이 작업본에 있는지는 줄 글이 아니라 차이(바탕 → 작업본, K → 작업본)의 자리로 본다 — 파일 다른 곳에 같은 글의 줄(「- 다시 확인: 통과」·빈 줄)이
 * 있어도 덩어리 안의 줄로 가른다. 한 덩어리 안의 옛 줄·새 줄은 같은 줄의 판(앞뒤가 충분히 같은 줄)끼리만 짝짓는다.
 * ① K(작업본과 가장 가까운 origin 판)가 바탕 판이 아니면 바탕 → K 덩어리마다:
 *    - K 줄은 작업본에 있을 때만 남긴다 — 없으면 작업본이 지운 줄이 아니라 받은 적이 없는 줄이다(빈 줄 포함).
 *    - 짝지은 옛 줄(origin의 줄 고침)은 작업본에 있거나, 짝인 새 판도 작업본에 없으면(작업본이 달리 고쳤다 — 겹침이 드러나게) 남긴다.
 *    - 짝 없는 옛 줄은 작업본에 있거나, 덩어리의 새 줄을 다 받지는 못했거나, 덩어리 자리에 작업본이 새로 쓴 줄이 있으면 남긴다.
 *    - 어느 쪽이든 그 뚜렷한 옛 줄의 글이 작업본 어디에도 없는데 K에 있으면(origin이 옮긴 줄을 작업본은 지웠다) 남긴다 — 빼면 바탕이
 *      작업본과 같아져 옮긴 줄이 되살아난다.
 *    - 같은 작업본 줄을 두 바탕 줄이 잡으면(옮긴 줄 — 바탕 차이와 K 차이가 따로 맞춘다) 작업본 순서에 맞는 하나만 남긴다.
 * 「작업본에서 B 줄의 자리」는 B → 작업본 차이에서 그 줄 앞뒤로 작업본에 남은 가장 가까운 B 줄 사이다 — 다른 자리의 같은 글은 그 줄의 판이 아니다.
 * ③ (문서) 바탕 판·B..T origin 판을 실제 커밋 차례로 이어 본 차이의 짝(같은 줄의 판)을 따라가, 바탕에 남은 옛 B 줄(작업본에 없는 뚜렷한 줄)의
 *    판이 작업본의 그 자리에 하나 있으면 — 작업본이 그 고침을 받았다 — 옛 줄을 받은 판으로 바꾼다(이미 바탕에 있으면 옛 줄만 뺀다). T가 그 줄을
 *    되돌렸어도 바꾼다 — 3방향이 되돌림을 따른다. K보다 새 판을 받은 줄(여러 번 고쳐진 줄 포함)의 옛 판이 바탕에 남아 옆 줄 고침과 겹치지 않게.
 *    짝 없는 지움은 빼지 않는다 — 작업본이 그 줄을 고치는 중일 수 있다.
 * ② (문서) 그러고도 바탕에 없는, 작업본에 한 번만 있는 뚜렷한 줄 가운데 B..T origin 판에 나온 줄(이력에서 더해진 받은 줄)은 — 그 판에서 든 자리
 *    (앞뒤로 가장 가까운 B 줄 사이)가 작업본에서 든 자리와 겹칠 때만 — 바탕 → 작업본 차이의 그 덩어리 안에서 그 줄이나 그 뒤의 작업본 줄과 짝지은
 *    바탕 줄 앞(짝이 없으면 덩어리 끝)에 넣는다. 3방향이 그 줄을 작업본이 더한 줄로 보지 않고 origin이 한 대로 따른다.
 *    (문서) 작업본과 T 둘 다에 그대로 없는 뚜렷한 B 줄은 작업본의 그 자리를 보아, 작업본이 그 줄을 쓰는 중이거나(이력에 없는 같은 줄의 판) 받은
 *    판이 둘 이상이거나, 그 줄을 지웠는데 작업본에 없는 그 줄의 판이 T에 있으면 { 문제 }를 돌려 멈추게 한다 — 고침·고침, 고침·지움, 지움·고침의 겹침이다.
 * K를 그대로 쓰면 받은 적 없는 새 줄을 작업본이 지운 줄로 보아 T에서도 지우고(10-21 공용 작업본 문서 9개), 더해진 줄만 빼면 받지 못한 고침의
 * 옛 판이 작업본이 새로 쓴 줄로 보여 「옛·새 판」으로 멈추거나 둘 다 남고 받지 못한 지움은 되살아났다(10-22 트랙). ②가 없으면 세션들이 표 맨 위에
 * 붙이고 조각으로 올린 행이 origin에 다른 차례로 들어갔을 때 「두 번 들어간다」로(10-22 결정 표), ③이 없으면 K보다 새 판을 받은 줄의 옛 판이
 * 바탕에 남아 「내가 고친 줄이 원격 판에 그대로 없다」로 멈췄다(10-22 트랙 모두의창업 줄 — T보다 옛 판을 받은 줄도 같은 파일에 있어 K를 T로
 * 바꿔도 안 됐다). 바꿀 줄이 없으면 K 그대로.
 */
function 받은것만바탕(c, { 경로, 판들, K, 바탕sha, 바탕바이트, W, Tsha }) {
  const B줄 = 줄나누기(글로(바탕바이트));
  const W줄 = 줄나누기(글로(W)), W글 = W줄.map((l) => l.글);
  const 남은자리 = (줄들) => {
    const 자리 = new Map();
    for (const op of 줄차이(줄들.map((l) => l.글), W글)) if (op[0] === '=') 자리.set(op[1], op[2]);
    return 자리;
  };
  const 있음 = (x) => x.자리 !== undefined;
  const B남음 = 남은자리(B줄);
  const 판글 = 판들.map((sha) => 블롭(c.git, c.저장, sha)).filter((b) => !이진인가(b)).map((b) => 줄나누기(글로(b)).map((l) => l.글));   // 새것부터
  const 이력 = new Set(판글.flat());
  const b셈 = 줄셈(B줄), w셈 = 줄셈(W줄);
  let 바탕줄, 끝, 바뀜 = false;   // 바탕줄: [{줄, 자리, b}] — 자리는 작업본에서 맞춘 줄 번호(작업본에 없으면 undefined), b는 B 줄이면 그 B 번호
  if (K === 바탕sha) {
    바탕줄 = B줄.map((줄, i) => ({ 줄, 자리: B남음.get(i), b: i }));
    끝 = (B줄.find((l) => l.끝) || { 끝: '\n' }).끝;
  } else {
    const K줄 = 줄나누기(글로(블롭(c.git, c.저장, K))), K글 = K줄.map((l) => l.글), K남음 = 남은자리(K줄), k셈 = 줄셈(K줄);
    끝 = (K줄.find((l) => l.끝) || { 끝: '\n' }).끝;
    const 옛줄 = (b) => ({ 줄: { 글: B줄[b].글, 끝: B줄[b].끝 && 끝 }, 자리: B남음.get(b), b });
    const 새줄 = (k) => ({ 줄: K줄[k], 자리: K남음.get(k) });
    // 작업본은 지웠는데 origin은 K의 다른 자리로 옮긴 뚜렷한 줄
    const 옮겨진 = (x) => 뚜렷한줄(x.줄.글) && !w셈.has(x.줄.글) && k셈.has(x.줄.글);
    const ops = 줄차이(B줄.map((l) => l.글), K줄.map((l) => l.글));
    // ops마다 그 뒤 첫 공통 줄의 작업본 자리(모르면 더 뒤, 없으면 작업본 끝) — 덩어리 자리의 끝
    const 뒤자리 = new Array(ops.length + 1).fill(W줄.length);
    for (let i = ops.length - 1; i >= 0; i--) {
      const z = ops[i][0] === '=' ? (K남음.has(ops[i][2]) ? K남음.get(ops[i][2]) : B남음.get(ops[i][1])) : undefined;
      뒤자리[i] = z !== undefined ? z : 뒤자리[i + 1];
    }
    let 앞자리 = -1;   // 앞 공통 줄의 작업본 자리
    바탕줄 = [];
    for (let i = 0; i < ops.length;) {
      if (ops[i][0] === '=') {
        const [, b, k] = ops[i++];
        const 자리 = K남음.has(k) ? K남음.get(k) : B남음.get(b);
        바탕줄.push({ 줄: K줄[k], 자리, b });
        if (자리 !== undefined) 앞자리 = 자리;
        continue;
      }
      const 뺀 = [], 더한 = [];
      for (; i < ops.length && ops[i][0] !== '='; i++) (ops[i][0] === '-' ? 뺀 : 더한).push(ops[i][1]);
      const 옛들 = 뺀.map(옛줄), 새들 = 더한.map(새줄);
      const 짝 = new Map(판짝(옛들.map((x) => x.줄.글), 새들.map((x) => x.줄.글), K글));   // 옛 번호 → 새 번호
      const 잡은 = new Set([...옛들, ...새들].filter(있음).map((x) => x.자리));
      let 새로쓴 = 0;
      for (let j = 앞자리 + 1; j < 뒤자리[i]; j++) if (!잡은.has(j) && !b셈.has(W글[j]) && !이력.has(W글[j])) 새로쓴++;
      const 다받음 = 새들.every(있음) && !새로쓴;
      const 옛 = 옛들.filter((x, n) => 있음(x) || 옮겨진(x) || (짝.has(n) ? !있음(새들[짝.get(n)]) : !다받음));
      const 덩어리 = [...옛.filter((x) => !있음(x)), ...[...옛.filter(있음), ...새들.filter(있음)].sort((a, b) => a.자리 - b.자리)]
        .filter((x, n, 다) => n === 0 || !있음(x) || x.자리 !== 다[n - 1].자리);
      if (덩어리.length !== 더한.length || 덩어리.some((x, n) => x.줄 !== K줄[더한[n]])) 바뀜 = true;   // 되살린 옛 줄 · 뺀 새 줄
      바탕줄.push(...덩어리);
    }
    // 같은 작업본 줄을 두 바탕 줄이 잡으면 작업본 순서(자리가 늘어나는 가장 긴 차례)에 든 것을, 둘 다 안 들면 앞의 것을 남긴다
    const 셈자리 = new Map();
    for (const x of 바탕줄) if (있음(x)) 셈자리.set(x.자리, (셈자리.get(x.자리) || 0) + 1);
    if ([...셈자리.values()].some((n) => n > 1)) {
      const 차례 = 늘어나는차례(바탕줄), 남긴자리 = new Set();
      바탕줄.forEach((x, n) => { if (있음(x) && 셈자리.get(x.자리) > 1 && 차례.has(n)) 남긴자리.add(x.자리); });
      바탕줄 = 바탕줄.filter((x, n) => {
        if (!있음(x) || 셈자리.get(x.자리) === 1) return true;
        if (남긴자리.has(x.자리)) return 차례.has(n);
        남긴자리.add(x.자리);
        return true;
      });
      바뀜 = true;
    }
  }
  if (받은줄넣을문서.test(경로)) {
    const T글 = 줄나누기(글로(블롭(c.git, c.저장, Tsha))).map((l) => l.글), t셈 = 줄셈(T글.map((글) => ({ 글 })));
    const B글 = B줄.map((l) => l.글);
    const 차례판 = [B글, ...판글.slice().reverse()];   // 실제 커밋 차례(같은 판이 되풀이돼도 그대로 — 되돌리기 전이를 지킨다)
    // 판 사슬은 글이 아니라 자리로 잇는다 — 이웃한 두 판 차이의 같은 줄('=')과 같은 줄의 판 짝으로 다음 판의 줄 번호를 따라간다. 글로 이으면 다른 줄이
    // 같은 글을 거칠 때 그 줄의 뒤 판까지 이 줄의 판으로 섞였다(10-22 검수 7차). 같은 줄이 맞닿은 덩어리에 새로 든 같은 줄의 판과 겨루면 그 '='는 정체가
    // 모호하다 — 한 커밋이 줄을 고치며 옛 글을 곁에 더하면 차이가 옛 글끼리 맞춰 고친 판을 새 줄로 봤다(10-22 검수 9차).
    const 다음자리 = [], 모호자리 = [];   // 차례 v → Map(v판 번호 → v+1판 번호) · Set(정체가 모호한 v+1판 번호)
    for (let v = 1; v < 차례판.length; v++) {
      const a = 차례판[v - 1], b = 차례판[v], m = new Map(), ops = 줄차이(a, b), 짝지은새 = new Set(), 모호 = new Set();
      for (const op of ops) if (op[0] === '=') m.set(op[1], op[2]);
      덩어리마다(ops, (뺀, 더한) => {
        for (const [i, j] of 판짝(뺀.map((x) => a[x]), 더한.map((y) => b[y]), b)) { m.set(뺀[i], 더한[j]); 짝지은새.add(더한[j]); }
      });
      ops.forEach((op, n) => {
        if (op[0] !== '=' || !뚜렷한줄(a[op[1]])) return;
        const 곁 = [];
        for (let u = n - 1; u >= 0 && ops[u][0] !== '='; u--) if (ops[u][0] === '+') 곁.push(ops[u][1]);
        for (let u = n + 1; u < ops.length && ops[u][0] !== '='; u++) if (ops[u][0] === '+') 곁.push(ops[u][1]);
        if (곁.some((y) => !짝지은새.has(y) && 같은줄판(a[op[1]], b[y]))) 모호.add(op[2]);
      });
      다음자리.push(m);
      모호자리.push(모호);
    }
    const 사슬 = (i) => {   // B 번호 i 줄의 뒤 판 글들(B 글과 다른 것)과 T에 닿았는지 — 사슬이 끊기면(지움) 거기까지
      const 판 = new Set();
      let v = 0;
      for (let q = i; v < 다음자리.length && 다음자리[v].has(q); v++) {
        q = 다음자리[v].get(q);
        if (차례판[v + 1][q] !== B글[i]) 판.add(차례판[v + 1][q]);
      }
      return { 판, T닿음: v === 다음자리.length };
    };
    const 판사슬 = (i) => 사슬(i).판;
    // 줄 정체 — 차례판의 (판, 줄 번호)마다 사슬이 이어진 B 번호(`B${i}`)나 그 판에서 새로 든 자리(`N${v}:${q}`), 모호한 '='를 거쳤으면 앞에 `?`.
    // 글정체: 글마다 그 글을 지녔던 정체들(B 줄이 거쳐 간 글과 같은 글의 새 줄을 그 B 줄의 받은 판으로 봤다 — 10-22 검수 8차)
    const 정체들 = [B글.map((_, i) => `B${i}`)], 글정체 = new Map();
    for (let v = 1; v < 차례판.length; v++) {
      const 거꾸로 = new Map([...다음자리[v - 1]].map(([p, q]) => [q, p])), 앞 = 정체들[v - 1];
      정체들.push(차례판[v].map((_, q) => {
        if (!거꾸로.has(q)) return `N${v}:${q}`;
        const id = 앞[거꾸로.get(q)];
        return 모호자리[v - 1].has(q) && !id.startsWith('?') ? `?${id}` : id;
      }));
      차례판[v].forEach((글, q) => { if (!글정체.has(글)) 글정체.set(글, new Set()); 글정체.get(글).add(정체들[v][q]); });
    }
    // 자리의 닻 — B와 그 판에 한 번씩만 있는 뚜렷한 줄로 맞춘 것만 쓴다. 빈 줄·틀 줄·되풀이 줄은 차이가 아무 데나 맞춰 범위를 엉뚱하게 좁혔다(10-22
    // 실제 공용 작업본 PATH 초안 — 고쳐 쓴 목록 아래 빈 줄이 위쪽 빈 줄에 맞아 「8. 보낼 때」 줄의 범위가 한 줄이 됐다). 짝: B 번호 → 판 번호
    const 닻만 = (짝, 판셈) => new Map([...짝].filter(([b]) => 뚜렷한줄(B글[b]) && b셈.get(B글[b]) === 1 && 판셈.get(B글[b]) === 1));
    const W닻 = 닻만(B남음, w셈);
    // B 번호 i 줄이 작업본에서 들 수 있는 범위(열린 구간) — 앞뒤로 가장 가까운 닻의 작업본 자리 사이. 다른 자리의 같은 글은 이 줄의 판이 아니다
    // (이력에서 서로 다른 줄이 같은 글이 될 수 있다 — 10-22 검수 4·5차).
    const 창앞 = [], 창뒤 = [];
    for (let i = 0, z = -1; i < B줄.length; i++) { 창앞[i] = z; if (W닻.has(i)) z = W닻.get(i); }
    for (let i = B줄.length - 1, z = W글.length; i >= 0; i--) { 창뒤[i] = z; if (W닻.has(i)) z = W닻.get(i); }
    // 줄마다 앞·뒤로 가장 가까운 닻의 B 번호(닻: B 번호 → 줄 번호). 이력 판의 닻에서 작업본과 T 둘 다에서 사라진 B 줄은 뺀다 — 양쪽이 지운 줄은 자리를
    // 가르지 못한다(치면 받은 줄 옆 줄을 양쪽이 지운 뒤로 영영 멈췄다).
    const 틈 = (줄들, 닻) => {
      const 짝 = new Map([...닻].map(([b, q]) => [q, b])), 앞 = [], 뒤 = [];
      for (let q = 0, z = -1; q < 줄들.length; q++) { 앞[q] = z; if (짝.has(q)) z = 짝.get(q); }
      for (let q = 줄들.length - 1, z = B줄.length; q >= 0; q--) { 뒤[q] = z; if (짝.has(q)) z = 짝.get(q); }
      return { 앞, 뒤 };
    };
    const W틈 = 틈(W글, W닻);
    const 판틈 = new Map();   // 차례판 번호 → 틈
    const 틈얻기 = (v) => {
      if (!판틈.has(v)) {
        const 판 = 차례판[v], 짝 = new Map();
        for (const op of 줄차이(B글, 판)) if (op[0] === '=' && (w셈.has(B글[op[1]]) || t셈.has(B글[op[1]]))) 짝.set(op[1], op[2]);
        판틈.set(v, 틈(판, 닻만(짝, 줄셈(판.map((글) => ({ 글 }))))));
      }
      return 판틈.get(v);
    };
    // 작업본 j 줄의 정체 후보 — 그 글을 지닌 이력 판의 줄 가운데 그 판에서의 자리(앞뒤 닻 사이)가 작업본 자리와 겹치는 줄들의 정체. 다른 자리의 같은
    // 글은 빼고 가린다(10-22 검수 9차 — 다른 절에서 같은 글이었던 새 줄 때문에 되돌린 줄의 받은 판을 못 찾았다).
    const 정체후보 = (j) => {
      const 답 = new Set();
      for (let v = 1; v < 차례판.length; v++) {
        차례판[v].forEach((y, q) => {
          if (y !== W글[j]) return;
          const { 앞, 뒤 } = 틈얻기(v);
          if (Math.max(W틈.앞[j], 앞[q]) < Math.min(W틈.뒤[j], 뒤[q])) 답.add(정체들[v][q]);
        });
      }
      return 답;
    };
    // B 번호 i 줄의 판 가운데 작업본의 그 자리에 한 번 있고 B에는 없던 뚜렷한 줄(받은 판)의 작업본 번호들 — B에도 있던 글은 작업본이 원래 가진 줄이고,
    // 그 자리에서 이 줄 말고 다른 줄(또는 모호한 정체)도 지녔던 글은 받은 판으로 단정하지 않는다
    const 받은판들 = (i, 판 = 판사슬(i)) => {
      const 답 = [];
      for (let j = 창앞[i] + 1; j < 창뒤[i]; j++) {
        const w = W글[j];
        if (!판.has(w) || w셈.get(w) !== 1 || b셈.has(w) || !뚜렷한줄(w)) continue;
        const 후보 = 정체후보(j);
        if (후보.size === 1 && 후보.has(`B${i}`)) 답.push(j);
      }
      return 답;
    };
    // 받은 판은 하나 대 하나 — 작업본 줄 하나를 서로 다른 B 줄 둘의 받은 판으로 쓰면 두 옛 줄이 하나로 접혀 한쪽 지움이 숨었다(10-22 검수 6차)
    const 받은짝 = new Map(), 잡힌 = new Map();   // B 번호 → 받은 판의 작업본 번호들 · 작업본 번호 → 그 줄을 받은 판으로 잡은 B 줄 수
    for (let i = 0; i < B줄.length; i++) {
      if (!뚜렷한줄(B글[i]) || w셈.has(B글[i])) continue;
      const 답 = 받은판들(i);
      받은짝.set(i, 답);
      for (const j of 답) 잡힌.set(j, (잡힌.get(j) || 0) + 1);
    }
    for (const [j, n] of 잡힌) if (n > 1) return { 문제: `작업본 줄 하나가 B 줄 둘 이상의 받은 판으로 잡힌다 — 손으로 가른다: ${보이게(W글[j]).slice(0, 80)}` };
    // 순수 지움 — B → 그 판 차이에서 더한 줄이 모두 다른 옛 줄의 판으로 짝지어진 덩어리의 뺀 B 번호들(같은 줄로 못 알아본 고침이 없는 지움)
    const 순수지움 = (판) => {
      const 답 = new Set();
      덩어리마다(줄차이(B글, 판), (뺀, 더한) => {
        if (판짝(뺀.map((b) => B글[b]), 더한.map((y) => 판[y]), 판).length === 더한.length) for (const b of 뺀) 답.add(b);
      });
      return 답;
    };
    const T순수 = 순수지움(T글), W순수 = 순수지움(W글);
    // ③ 바탕에 남은 옛 B 줄의 받은 판이 작업본의 그 자리에 하나 있으면 옛 줄을 그 판으로 — T가 되돌렸어도 바꾼다(옛 줄을 두고 받은 판을 ②가 앞에
    //    넣으면 3방향이 두 줄을 다 지워 T의 되돌린 줄을 잃었다 — 10-22 검수 5차)
    const 바탕글셈 = 줄셈(바탕줄.map((x) => x.줄));
    const 새바탕 = [];
    for (const x of 바탕줄) {
      const 옛B줄 = x.b !== undefined && !있음(x) && 뚜렷한줄(x.줄.글) && !w셈.has(x.줄.글);
      const 받은 = 옛B줄 ? 받은짝.get(x.b) || [] : [];
      if (받은.length === 1) {
        const r = W글[받은[0]];
        바뀜 = true;
        if (!바탕글셈.has(r)) { 새바탕.push({ 줄: { 글: r, 끝 }, 자리: 받은[0] }); 바탕글셈.set(r, 1); }
        continue;
      }
      // 작업본도 T도 순수하게 지운(판 사슬이 T에 닿지 않고, 두 차이 모두 그 덩어리에 짝 없는 새 줄이 없는) 옛 B 줄은 바탕에서 뺀다 — 결과는 같고, 두면
      // 3방향이 이웃 줄 고침과 맞닿은 덩어리로 보아 멈췄다(10-22 검수 8차 재현). 같은 줄로 못 알아본 고침이 있는 덩어리면 남겨 3방향이 겹침을 잡게 한다
      // (빼면 그 고침이 조용히 들어왔다 — 10-22 검수 9차).
      if (옛B줄 && !받은.length && !t셈.has(x.줄.글) && !사슬(x.b).T닿음 && T순수.has(x.b) && W순수.has(x.b)) { 바뀜 = true; continue; }
      새바탕.push(x);
    }
    바탕줄 = 새바탕;
    // ② 이력에서 더해진 받은 줄을, 바탕 → 작업본 차이 덩어리 안에서 그 줄이나 그 뒤의 작업본 줄과 짝지은(같은 줄의 판) 바탕 줄 앞에 넣는다
    //    — 짝이 없으면 덩어리 끝에. 순번으로 짝지으면 작업본이 그 위아래에 줄을 더하거나 고칠 때 차례가 뒤집혔다(10-22 검수 4차).
    //    B 줄의 판이었던 글(정체에 B 번호가 든 글)은 ③이 받지 않았으면 넣지 않고 멈춘다 — 넣으면 옛 B 줄과 두 판이 함께 바탕에 들어 3방향이 둘 다
    //    지웠다(10-22 검수 9차). T에 남은 줄은 받은 줄로 본다(잘못 봐도 한 번은 남는다). T에서 지워진 줄은 작업본에서 든 자리(앞뒤로 가장 가까운 닻의
    //    B 번호 사이)가 이력 판 어느 하나에서 든 자리 안일 때만 받은 줄이고, 아니면 멈춘다 — 같은 글을 다른 자리에 새로 썼는지, 받은 줄을 옮겼거나 그
    //    사이 B 줄을 지웠는지 가릴 수 없다(받은 줄로 넣으면 새 줄이 사라지고, 새 줄로 두면 origin이 지운 줄이 되살아난다 — 10-22 검수 5·6차). 그 세션이
    //    올리면 풀린다.
    const 이력자리안 = (j) => {
      for (let v = 1; v < 차례판.length; v++) {
        const 판 = 차례판[v];
        for (let q = 0; q < 판.length; q++) {
          if (판[q] !== W글[j]) continue;
          const { 앞, 뒤 } = 틈얻기(v);
          if (W틈.앞[j] >= 앞[q] && W틈.뒤[j] <= 뒤[q]) return true;
        }
      }
      return false;
    };
    const B판이던글 = (글) => [...(글정체.get(글) || [])].some((x) => /^\??B/.test(x));
    const 받을만한 = (j) => w셈.get(W글[j]) === 1 && !b셈.has(W글[j]) && !바탕글셈.has(W글[j]) && 이력.has(W글[j]) && 뚜렷한줄(W글[j]);
    const 넣기 = [];   // [그 앞에 넣을 바탕 번호, 작업본 번호]
    let 모호줄 = null;
    덩어리마다(줄차이(바탕줄.map((x) => x.줄.글), W글), (뺀, 더한, 다음) => {
      const 짝 = new Map(판짝(뺀.map((b) => 바탕줄[b].줄.글), 더한.map((j) => W글[j]), W글).map(([i, t]) => [t, 뺀[i]]));   // 더한 순번 → 짝 바탕 번호
      더한.forEach((j, t) => {
        if (!받을만한(j)) return;
        if (B판이던글(W글[j]) || (!t셈.has(W글[j]) && !이력자리안(j))) { if (모호줄 === null) 모호줄 = j; return; }
        let 앞 = -1;
        for (let u = t; u < 더한.length && 앞 < 0; u++) if (짝.has(u)) 앞 = 짝.get(u);
        넣기.push([앞 >= 0 ? 앞 : (다음 ?? 바탕줄.length), j]);
      });
    });
    if (모호줄 !== null) {
      return { 문제: `작업본 줄이 이력의 어느 줄인지 가릴 수 없다(B 줄의 판이었거나 origin이 더했다 지운 줄과 글이 같은데 그 자리가 아니다) — 그 세션이 올리거나 정리한 뒤 따라간다: ${보이게(W글[모호줄]).slice(0, 80)}` };
    }
    넣기.sort((a, b) => b[0] - a[0] || b[1] - a[1]);   // 뒤에서부터 넣어 번호가 밀리지 않게 — 같은 자리는 작업본 차례가 늦은 것부터
    for (const [k, j] of 넣기) 바탕줄.splice(k, 0, { 줄: { 글: W글[j], 끝 }, 자리: j });
    if (넣기.length) 바뀜 = true;
    // 겹침 멈춤 — 작업본의 그 자리에 그대로 남지 않은 뚜렷한 B 줄마다 본다. 3방향은 바탕 줄 차례에 따라 이를 「지움 + 새 줄」로 보아 두 판을 함께 남기거나
    // 한쪽을 조용히 버릴 때가 있다(10-22 검수 4·5차).
    //  · 되풀이 글의 한 사본을 작업본이 지웠는데 origin도 그 글의 사본 수를 줄였으면 어느 사본을 고쳤는지 가릴 수 없어 멈춘다(10-22 검수 9차 — 남은 사본
    //    때문에 지운 사본의 검사를 건너뛰었다). 그대로면 넘어간다.
    //  · T에 그 글이 그대로 있으면 넘어간다(작업본의 고침·지움을 3방향이 따른다).
    //  · 받은 판이 하나면 넘어간다(③이 바탕을 그 판으로 바꿨다 — 그 자리의 비슷한 새 줄은 다른 줄이다). 둘 이상이면 멈춘다.
    //  · 그 자리에 쓰는 중인 같은 줄의 판(이력에 없는 줄)이 있다 — origin도 그 줄을 고쳤거나 지웠다. 받은 판을 다시 고치는 중일 수도 있지만 가릴 수 없다.
    //  · 판이 없다(작업본이 지웠다) — 작업본에 없는 그 줄의 판(이력의 판이나 같은 줄의 판)이 T 어디에든 있으면 origin이 고쳐(옮겨) 두었다.
    const 쓰는줄 = (w) => 뚜렷한줄(w) && !b셈.has(w) && !이력.has(w);
    const 남은T = [...t셈.keys()].filter((y) => !w셈.has(y) && !b셈.has(y) && 뚜렷한줄(y));
    for (let i = 0; i < B줄.length; i++) {
      const g = B글[i];
      if (!뚜렷한줄(g) || B남음.has(i)) continue;
      if (w셈.has(g)) {
        if ((t셈.get(g) || 0) < (b셈.get(g) || 0)) return { 문제: `되풀이 줄(또는 옮긴 줄)의 한 사본을 작업본이 지웠고 origin도 그 사본 수를 바꿨다 — 손으로 가른다: ${보이게(g).slice(0, 80)}` };
        continue;
      }
      if (t셈.has(g)) continue;
      const 받은 = (받은짝.get(i) || []).length;
      if (받은 > 1) return { 문제: `작업본의 한 자리에 같은 줄의 받은 판이 둘 이상 있다 — 손으로 가른다: ${보이게(g).slice(0, 80)}` };
      if (받은 === 1) continue;
      const 판 = 판사슬(i), 판들 = [g, ...판];
      for (let j = 창앞[i] + 1; j < 창뒤[i]; j++) {
        if (쓰는줄(W글[j]) && 판들.some((y) => 같은줄판(y, W글[j]))) {
          return { 문제: `origin이 바꾼 줄을 작업본도 고치는 중이다 — 그 세션이 올리거나 정리한 뒤 따라간다: ${보이게(W글[j]).slice(0, 80)}` };
        }
      }
      if (남은T.some((y) => 판.has(y) || 판들.some((z) => 같은줄판(z, y)))) {
        return { 문제: `origin이 고친 줄을 작업본이 지웠다 — 그 세션이 정리한 뒤 따라간다: ${보이게(g).slice(0, 80)}` };
      }
    }
  }
  if (!바뀜) return K;
  return 블롭쓰기(c.git, c.저장, 바이트로(줄잇기(줄바꿈채우기(바탕줄.map((x) => x.줄)))));
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
  const 비킬 = 계획.비킬 || [];
  for (const x of [...계획.고침, ...비킬.map((v) => ({ 경로: v.경로, 전: v.바이트 }))]) {
    const 지금 = 파일읽기(path.join(c.저장소, x.경로));
    const 같음 = x.전 === null ? Boolean(지금.없음) : Boolean(지금.바이트 && 지금.바이트.equals(x.전));
    if (!같음) return { 결과: '멈춤', 이유: `그사이 작업본 파일이 바뀌었다(${x.경로}) — 다시 돌린다` };
  }
  // 바이트 백업
  const 백업뿌리 = path.join(c.gitdir, '바로올리기');
  백업정리(백업뿌리);
  const 시각 = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const 백업 = path.join(백업뿌리, `${시각}-${B.slice(0, 9)}-${T.slice(0, 9)}`);
  const 비킬파일 = 비킬.filter((v) => v.바이트);               // 작업본에 파일이 남은 지움 — 비켜 두었다가 되돌린다
  const 백업목록 = [...계획.고침.map((x) => ({ 경로: x.경로, 바이트: x.전 })), ...비킬파일.map((v) => ({ 경로: v.경로, 바이트: v.바이트 }))];
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
    for (const v of 비킬파일) fs.rmSync(path.join(c.저장소, v.경로), { force: true });   // 백업에 있다 — 따라간 뒤 되돌린다
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
    // 되돌린 read-tree가 지움 경로에 B 판 항목과 파일을 다시 넣었다 — 처음처럼 인덱스에서 지운 채로 두고, 파일이 없던 경로는
    // 그 B 판 파일만 치운다(그사이 남이 쓴 파일은 두고). 파일이 있던 경로는 아래 되돌리기가 비켜 둔 판을 다시 쓴다.
    if (비킬.length) {
      git.돌리기(['--literal-pathspecs', 'rm', '-q', '--cached', '--ignore-unmatch', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: `${비킬.map((v) => v.경로).join('\0')}\0`, 허용: null });
      for (const v of 비킬) {
        if (v.바이트) continue;
        const 지금 = 파일읽기(path.join(c.저장소, v.경로));
        if (지금.바이트 && 지금.바이트.equals(꺼낸바이트(c, v.Bsha, v.경로))) fs.rmSync(path.join(c.저장소, v.경로), { force: true });
      }
    }
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
  // 비켜 둔 파일(인덱스에서 지운 채 작업본에 남긴 판)을 제자리에
  for (const v of 비킬파일) {
    const 파일 = path.join(c.저장소, v.경로);
    if (!파일읽기(파일).없음) { 주의.push(`${v.경로}: 그사이 그 자리에 파일이 생겨 비켜 둔 판을 되돌리지 않았다(백업 ${백업})`); continue; }
    try { 바꿔쓰기(파일, v.바이트); } catch (e) { 주의.push(`${v.경로}: ${e.message}(백업 ${백업})`); }
  }
  const r = {
    결과: '따라감', B, T, 경로: 계획.경로.length, 새판: 계획.새판.length,
    고침: 계획.고침.map((x) => ({ 경로: x.경로, 방법: x.방법 })), ...(비킬파일.length ? { 지킨파일: 비킬파일.map((v) => v.경로) } : {}),
    ...(백업목록.length ? { 백업 } : {}),
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
  if (!조상인가(m.git, B, T)) return { 결과: '건너뜀', 이유: `공용 작업본 ${c.원격가지}에 origin에 없는 커밋(꼬리)이 있다 — 따라가지 않았다. ${꼬리안내}` };
  const 계획 = 따라가기계획(m, B, T);
  if (계획.결과 !== '계획') return 계획.결과 === '멈춤' ? { 결과: '건너뜀', 이유: 계획.이유, 걸림: 계획.걸림 } : { 결과: 계획.결과 };
  const r = 따라가기실행(m, 계획);
  return r.결과 === '따라감' ? r : { 결과: '건너뜀', 이유: r.이유 };
}

// ── 명령 ────────────────────────────────────────────────────────────────────

/** 옵션: 저장소 · 경로들[] · 모두 · 조각 · 메시지 · 메시지파일 · 실행 · 폴더 · 자세히 · 줄끝그대로 · 옛판아님 · 공용안따라감 · 운영안따라감 ·
 *  시험건너뜀 · 짝검사건너뜀 · 짝검사표(시험이 주는 짝 검사 표 — 없으면 tools/짝검사.js 기본표) */
// ── 관련 시험·CI 빨간불(push 전, 2026-10-21) ─────────────────────────────────────

/** 커밋 메시지 끝 트레일러(Co-Authored-By 꼴) 앞에 한 문단을 넣는다 — 뒤에 붙이면 트레일러가 끝 문단이 아니게 된다. */
function 트레일러앞에(메시지, 문단) {
  if (!메시지 || !문단) return 메시지;
  const 문단들 = 메시지.replace(/\s+$/, '').split(/\n[ \t]*\n/);
  const 끝 = 문단들[문단들.length - 1];
  if (문단들.length > 1 && 끝.split('\n').every((l) => /^[A-Za-z][A-Za-z-]*: \S/.test(l))) 문단들.splice(문단들.length - 1, 0, 문단);
  else 문단들.push(문단);
  return `${문단들.join('\n\n')}\n`;
}

/** 짝 검사 표에서 이번 push의 경로가 걸리는 줄을 고른다(옵션.짝검사표는 시험이 주는 표). SYNK_짝검사=끔이면 안 고른다. */
function 짝검사고르기(c, 만든, 옵션) {
  if (!짝검사 || process.env.SYNK_짝검사 === '끔') return null;
  try {
    const 고름 = 짝검사.고르기({ root: c.저장소, 바뀐: 만든.바뀜.map((e) => e.경로), 표: 옵션.짝검사표 || null });
    return { 고름, 요약: { 수: 고름.length, 검사: 고름.map((x) => x.줄.이름) } };
  } catch (e) {
    return { 고름: [], 요약: { 수: 0, 검사: [], 못고름: e.message } };
  }
}

/** 고른 짝 검사를 작업본에서 돌린다. 작업본 대조에 쓸 것 — 통째로 올리는 경로(조각으로 일부만 올리는 경로는 뺀다)·새 파일·
 *  작업본의 바뀐 경로·바탕과 origin 사이에 origin이 바꾼 경로. */
async function 짝검사돌리기(c, 만든, 판, B, O, 조각) {
  const 조각경로 = new Set([...조각].filter(([, v]) => v !== '전부').map(([p]) => p));
  const 더러운 = [...상태읽기(c.git)].map(([경로, s]) => ({ 경로, 추적: s.x !== '?' }));
  let 뒤처진 = [];
  if (B !== O) {
    try { 뒤처진 = c.git(['diff', '--name-only', '--no-renames', '-z', B, O]).toString('utf8').split('\0').filter(Boolean); } catch (_) { 뒤처진 = []; }
  }
  return 짝검사.돌리기({
    root: c.저장소, 고름: 판.고름, 공용: c.공용, 더러운, 뒤처진,
    올린: 만든.바뀜.map((e) => e.경로).filter((p) => !조각경로.has(p)),
    새파일: 만든.바뀜.filter((e) => !e.옛 && e.새).map((e) => e.경로),
  });
}

function 관련시험고르기(c, 만든, 실행) {
  if (!관련시험 || process.env.SYNK_관련시험 === '끔') return null;
  try {
    // 미리 보기는 받아 둔 지도로만 고른다(지도 받기는 6시간마다, --실행 때만).
    const 고름 = 관련시험.고르기({ root: c.저장소, 바뀐: 만든.바뀜.map((e) => e.경로), 받기: Boolean(실행) });
    return { 고름, 요약: { 수: 고름.시험.length, 시험: 고름.시험.slice(0, 8), 기록전용: 고름.기록전용, 지도: 고름.지도 } };
  } catch (e) {
    return { 고름: { 시험: [], 까닭: {} }, 요약: { 수: 0, 시험: [], 못고름: e.message } };
  }
}

/**
 * 공용 작업본에서 깨진 시험이 남의 미커밋을 읽었을 수 있나 — 그런 경로들(없으면 빈 배열 = 내 변경 탓으로 보고 막는다).
 * 시험은 커밋할 트리가 아니라 작업본 파일로 돈다. 그래서 「막는다」는 깨진 시험이 남이 고치는 파일을 하나도 안 읽는다고
 * 지도로 보일 때만이다(아르곤 10-22 P1): 지도의 세 기준(읽음·폴더·무늬)을 다 보고, 지도에 그 시험이 없으면 섞였다고 본다.
 * 후보에는 --조각으로 일부만 올린 내 경로도 든다(작업본에는 남의 조각이 남아 있다). 위치를 못 읽은 실패가 있으면 돌린 시험 전부를 본다.
 */
function 남의미커밋섞임(c, 만든, 결과, 고른시험, 조각경로들 = []) {
  const 내것 = new Set(만든.바뀜.map((e) => e.경로));
  const 후보 = [...new Set([...[...상태읽기(c.git).keys()].filter((p) => !내것.has(p)), ...조각경로들])];
  if (!후보.length) return [];
  const 위치로 = 결과.실패.map((x) => x.파일).filter(Boolean);
  const 깨진시험 = !결과.실패.length || 결과.실패.some((x) => !x.파일) || 결과.이유 ? 고른시험 : [...new Set(위치로)];
  let 지도 = null;
  try { 지도 = 관련시험.지도읽기(c.저장소, { 받기: false }); } catch { 지도 = null; }
  return 후보.filter((p) => 깨진시험.some((t) => t === p || !지도 || !지도.시험[t] || Boolean(관련시험.읽나(지도.시험[t], p))));
}

function CI경고(c) {
  if (!ci빨간불 || process.env.SYNK_관련시험 === '끔') return null;
  try { return ci빨간불.빠른경고글(ci빨간불.빠른상태({ sh: ci빨간불.실행기(c.저장소) })); } catch { return null; }
}

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
    const 건너뜀 = 옵션.시험건너뜀 ? String(옵션.시험건너뜀).trim() : '';
    if (옵션.시험건너뜀 !== undefined && !건너뜀) throw new 사용법오류('--시험건너뜀 뒤에 까닭을 적는다(커밋 메시지에 남는다)');
    const 짝건너뜀 = 옵션.짝검사건너뜀 ? String(옵션.짝검사건너뜀).trim() : '';
    if (옵션.짝검사건너뜀 !== undefined && !짝건너뜀) throw new 사용법오류('--짝검사건너뜀 뒤에 까닭을 적는다(커밋 메시지에 남는다)');
    const 메시지 = 트레일러앞에(트레일러앞에(메시지만들기({ ...옵션, 기준폴더: c.기준폴더 }), 짝건너뜀 ? `짝 검사 건너뜀: ${짝건너뜀}` : ''),
      건너뜀 ? `관련 시험 건너뜀: ${건너뜀}` : '');
    const 실행 = Boolean(옵션.실행);
    if (실행 && !메시지) throw new 사용법오류('커밋 메시지가 없다(-m "…" 또는 -F 파일)');
    const 일 = { 경로들, 조각, 모두, 폴더: Boolean(옵션.폴더), 줄끝그대로: Boolean(옵션.줄끝그대로), 메시지 };
    진행중작업(c);

    let 만든 = null;
    let 짝판 = null, 짝결과 = null, 시험판 = null, 시험결과 = null, 시험주의 = null, CI판 = undefined;
    for (let 차례 = 1; 차례 <= 다시한도; 차례++) {
      const O = 받기(c);
      const B = 머리(c);
      const 요약 = {
        작업본: c.공용 ? '공용' : '워크트리', 가지: c.가지 ? c.가지.replace(/^refs\/heads\//, '') : '(분리된 HEAD)',
        원격: `${c.원격}/${c.원격가지}`, 바탕: B, 원격머리: O, ...(차례 > 1 ? { 다시한수: 차례 - 1 } : {}),
      };
      if (c.공용) {
        const 꼬리 = 꼬리수(c, B, O);
        if (꼬리) return { 결과: '멈춤', 이유: `공용 작업본 ${요약.가지}에 origin에 없는 커밋(꼬리)이 ${꼬리}개 있다 — 아무것도 올리지 않았다. ${꼬리안내}`, ...요약 };
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
      if (검사.공개) 요약.공개 = 검사.공개;
      if (검사.문제.length) return { 결과: '멈춤', 이유: 검사멈춤이유(검사.문제), 문제: 검사.문제, 용량: 검사.용량, ...요약 };
      요약.머리 = 계획.머리;
      요약.수 = 줄수(git, O, 계획.머리);
      요약.용량 = 검사.용량;
      if (!짝판) 짝판 = 짝검사고르기(c, 만든, 옵션);
      if (짝판 && (짝판.요약.수 || 짝판.요약.못고름)) 요약.짝검사 = { ...짝판.요약, ...(짝건너뜀 ? { 건너뜀: 짝건너뜀 } : {}), ...(짝결과 ? { 결과: 짝결과 } : {}) };
      if (짝판 && 짝판.고름.length && !짝건너뜀 && !짝결과) {
        // 작업본의 파일로 돈다 — origin이 움직여 다시 쌓아도 내 경로의 내용은 같으니 한 번만 돌린다(관련 시험과 같다).
        // 검사 도구 자체가 던지면 막지 않는다 — 모든 세션의 push가 그 고장에 묶이지 않게(CI가 같은 검사를 다시 돈다).
        try { 짝결과 = await 짝검사돌리기(c, 만든, 짝판, B, O, 조각); } catch (e) { 짝결과 = { 결과: [], 막음: [], 초: 0, 오류: e.message }; }
        요약.짝검사.결과 = 짝결과;
        if (짝결과.막음.length) {
          return { 결과: '멈춤', 이유: `짝 파일이 원천과 어긋난다(${짝결과.막음.join(' · ')}) — 아무것도 올리지 않았다. 아래 고치는 명령을 돌리고 결과물을 경로에 더해 다시 올린다. 이 push와 무관하면 --짝검사건너뜀 "<까닭>"`, ...요약 };
        }
      }
      if (!시험판) 시험판 = 관련시험고르기(c, 만든, 실행);
      if (시험판) 요약.관련시험 = { ...시험판.요약, ...(건너뜀 ? { 건너뜀 } : {}), ...(시험결과 ? { 결과: 시험결과 } : {}) };
      if (CI판 === undefined) CI판 = CI경고(c);
      if (CI판) 요약.CI빨강 = CI판;
      if (실행 && 시험판 && !건너뜀 && !시험결과 && 시험판.고름.시험.length) {
        // 작업본의 파일로 돈다 — origin이 움직여 다시 쌓아도 내 경로의 내용은 같으니 한 번만 돌린다(시험용으로 옵션.관련시험돌리기).
        시험결과 = (옵션.관련시험돌리기 || 관련시험.돌리기)({ root: c.저장소, 시험: 시험판.고름.시험, 워크트리: !c.공용, 새파일: 만든.바뀜.filter((e) => !e.옛 && e.새).map((e) => e.경로) });
        요약.관련시험.결과 = 시험결과;
        if (관련시험.시간만넘김(시험결과)) {
          // 10-22 PC가 바쁠 때(CPU 100%) 관련 시험 넷이 15분을 넘겨 push가 막혔다 — 따로 돌리니 다 통과했다.
          // 바쁜 날 모든 세션의 push가 15분씩 묶였다 실패하지 않게, 깨진 것이 보이지 않았으면 올리고 CI(빨간불 알림)에 맡긴다.
          시험주의 = `관련 시험이 ${시험결과.이유}(${시험결과.초}초까지 깨진 시험 없음) — PC가 바쁜 탓으로 보고 막지 않았다. 같은 시험은 CI가 다시 돈다`;
        } else if (!시험결과.통과함) {
          const 조각경로들 = [...조각].filter(([, v]) => v !== '전부').map(([p]) => p);
          const 섞임 = c.공용 ? 남의미커밋섞임(c, 만든, 시험결과, 시험판.고름.시험, 조각경로들) : [];
          if (!섞임.length) {
            // 한도에 끊긴 TAP에는 요약 줄(# tests·# fail)이 없다 — 그때는 읽은 실패 수만 보인다.
            const 셈글 = 시험결과.시간넘김 ? `${시험결과.실패.length}개 깨짐 · 끝까지 못 봄` : `${시험결과.실패수 || '?'}/${시험결과.시험}`;
            return { 결과: '멈춤', 이유: `관련 시험이 깨졌다(${셈글}${시험결과.이유 ? ` · ${시험결과.이유}` : ''}) — 아무것도 올리지 않았다. 고쳐서 다시 올리고, 이 push와 무관한 실패면 --시험건너뜀 "<까닭>"을 붙인다`, ...요약 };
          }
          시험주의 = `관련 시험이 깨졌지만 그 시험이 공용 작업본의 남의 미커밋(${섞임.slice(0, 3).join(', ')}${섞임.length > 3 ? ' …' : ''})을 읽어 막지 않았다 — 내 경로가 원인인지 워크트리에서 다시 본다`;
        }
      }
      // 요약은 차례마다 새로 만든다 — push가 거절돼 다시 쌓아도 시험 주의가 빠지지 않게 여기서 붙인다.
      if (시험주의) 요약.주의 = 시험주의;
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
      } catch (e) { r.주의 = [r.주의, `push는 됐지만 ls-remote로 다시 확인하지 못했다 — ${e.message}`].filter(Boolean).join(' / '); }
      git.돌리기(['update-ref', `refs/remotes/${c.원격}/${c.원격가지}`, 계획.머리], { 허용: null });
      r.따라가기 = 따라가기한번(c, B, 계획.머리, 바탕들);
      if (!c.공용 && !옵션.공용안따라감) {
        try { const s = 공용따라가기(c, 계획.머리); if (s) r.공용따라가기 = s; } catch (e) { r.공용따라가기 = { 결과: '건너뜀', 이유: e.이유 || e.message }; }
      }
      // 예약 작업·헤르메스 감시가 실행하는 운영 사본도 바로 따라가게 한다(운영 사본에서 올린 장부면 헤르메스 계약만 맞춘다)
      if (운영사본 && !옵션.운영안따라감) {
        try { const s = await 운영사본.밀린뒤(c.저장소); if (s) r.운영따라가기 = s; } catch (e) { r.운영따라가기 = { 결과: '실패', 이유: e.이유 || e.message }; }
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
  return {
    결과: '계획', B: 계획.B, T: 계획.T, 경로: 계획.경로.length, 새판: 계획.새판.length, 고침: 계획.고침.map((x) => ({ 경로: x.경로, 방법: x.방법 })),
    ...(계획.비킬 && 계획.비킬.some((v) => v.바이트) ? { 지킬파일: 계획.비킬.filter((v) => v.바이트).map((v) => v.경로) } : {}),
  };
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
      return { 결과: '멈춤', 이유: `공용 작업본에 origin에 없는 커밋(꼬리)이 ${꼬리수(c, B, O)}개 있다 — 따라가지 않았다. ${꼬리안내}`, B, T: O };
    }
    const 계획 = 따라가기계획(c, B, O);
    if (계획.결과 !== '계획') return 계획요약(계획);
    if (!옵션.실행) return { ...계획요약(계획), 결과: '미리 보기' };
    const r = 따라가기실행(c, 계획);
    // 운영 사본을 손으로 따라가게 했으면 헤르메스 감시 계약도 바로 맞춘다(운영사본.js 갱신은 스스로 맞추므로 운영안맞춤)
    if (r.결과 === '따라감' && 운영사본 && !옵션.운영안맞춤 && 운영사본.운영사본인가(c.저장소)) r.헤르메스 = 운영사본.헤르메스맞추기(c.저장소, { 실행: true });
    return r;
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
      // 폴더를 주면 그 폴더만 다시 꺼낸다. 무늬는 stdin으로 넘긴다 — Git Bash는 「/docs/…」 인자를 프로그램 폴더 경로로 바꾼다.
      const 폴더들 = (옵션.폴더들 || []).map((p) => 경로맞추기(c.저장소, p, c.기준폴더).replace(/\/+$/, ''));
      const 할일 = 폴더들.length ? `git sparse-checkout add — ${폴더들.join(' · ')}만 다시 꺼낸다` : 'git sparse-checkout disable — 뺀 폴더를 모두 다시 꺼낸다';
      if (!옵션.실행) return { 결과: '미리 보기', 할일 };
      const r = 폴더들.length
        ? git.돌리기(['sparse-checkout', 'add', '--stdin'], { input: `${폴더들.map((p) => `/${p}/`).join('\n')}\n`, 허용: null })
        : git.돌리기(['sparse-checkout', 'disable'], { 허용: null });
      if (r.status !== 0) throw new 멈춤(`되살리지 못했다 — ${String(r.stderr).trim()}`);
      return { 결과: '되살림', 할일 };
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
  node tools/바로올리기.js <경로…> -m "<메시지>" [--조각 <경로>=<조각,…|전부>] [--폴더] [--자세히] [--줄끝그대로] [--옛판아님] [--공용안따라감] [--운영안따라감]
      [--짝검사건너뜀 <까닭>] [--시험건너뜀 <까닭>] [--실행] [--json]
  node tools/바로올리기.js --모두 -m "<메시지>" [--실행]      (워크트리) 바뀐 것을 모두
  node tools/바로올리기.js 따라가기 [--실행]                  push 없이 이 작업본을 origin 최신으로
  node tools/바로올리기.js 가볍게 [--되살림 [<폴더…>]] [--실행]  (워크트리) 큰 미디어 폴더를 빼고·되살린다(폴더를 주면 그 폴더만)
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
    else if (a === '--시험건너뜀') 옵션.시험건너뜀 = 값();
    else if (a === '--짝검사건너뜀') 옵션.짝검사건너뜀 = 값();
    else if (['--모두', '--폴더', '--자세히', '--줄끝그대로', '--옛판아님', '--공용안따라감', '--운영안따라감', '--되살림'].includes(a)) 옵션[a.slice(2)] = true;
    else if (a === '--저장소') 옵션.저장소 = 값();
    else if (a === '--원격') 옵션.원격 = 값();
    else if (a === '--가지') 옵션.가지 = 값();
    else if (a.startsWith('-')) throw new 사용법오류(`모르는 인자: ${a}`);
    else 옵션.위치.push(a);
  }
  const 올리기만 = ['모두', '폴더', '자세히', '줄끝그대로', '옛판아님', '공용안따라감', '운영안따라감', '시험건너뜀', '짝검사건너뜀'].filter((k) => 옵션[k] !== undefined && 옵션[k] !== false);
  if (명령 !== '올리기') {
    const 폴더받음 = 명령 === '가볍게' && 옵션.되살림;   // 가볍게 --되살림 <폴더…>: 그 폴더만 다시 꺼낸다
    if ((옵션.위치.length && !폴더받음) || 옵션.메시지.length || 옵션.메시지파일 || 옵션.조각.length || 올리기만.length) throw new 사용법오류(`${명령}은 경로·메시지·올리기 인자를 받지 않는다`);
    옵션.폴더들 = 옵션.위치;
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
  if (r.공개) 줄.push(`  ${공개검사.요약글(r.공개)}`);
  if (r.짝검사 && 짝검사) 줄.push(...짝검사.글로(r.짝검사));
  if (r.관련시험) 줄.push(...관련시험글(r.관련시험));
  if (r.CI빨강) 줄.push(r.CI빨강);
  줄.push(...따라가기글(r.따라가기));
  if (r.공용따라가기) 줄.push(...따라가기글(r.공용따라가기, '공용 작업본'));
  if (r.운영따라가기) 줄.push(운영따라가기글(r.운영따라가기));
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  if (r.결과 === '미리 보기') 줄.push('검사 통과 — --실행을 붙이면 올린다.');
  return 줄.join('\n');
}

function 운영따라가기글(x) {
  const 헤 = x.헤르메스 && !['맞음', '건너뜀'].includes(x.헤르메스.결과) ? ` · 헤르메스 감시 계약 ${x.헤르메스.결과}${x.헤르메스.이유 ? `(${x.헤르메스.이유})` : ''}` : '';
  if (x.결과 === '운영 사본') return `운영 사본: 여기서 올렸다${헤}`;
  return `운영 사본: ${x.결과}${x.머리 ? ` ${짧게(x.머리)}` : ''}${x.이유 ? ` — ${x.이유}` : ''}${헤}`;
}

function 관련시험글(x) {
  const 지도 = `지도 ${x.지도 ? `run ${x.지도}` : '없음 — 시험 글로만 골랐다'}`;
  if (x.못고름) return [`  관련 시험: 고르지 못했다 — ${x.못고름}`];
  if (x.기록전용) return ['  관련 시험: 기록 전용 경로뿐이라 없음(CI도 records-check만 돈다)'];
  if (x.건너뜀) return [`  관련 시험 ${x.수}개 건너뜀 — ${x.건너뜀}`];
  if (!x.수) return [`  관련 시험: 없음(${지도})`];
  if (!x.결과) return [`  관련 시험 ${x.수}개 — --실행 때 push 전에 돈다(${지도}): ${x.시험.join(' · ')}${x.수 > x.시험.length ? ' …' : ''}`];
  const r = x.결과;
  const 상태 = r.통과함 ? '통과' : 관련시험 && 관련시험.시간만넘김(r) ? '시간 넘김' : '깨짐';
  const 셈 = r.시간넘김 ? '끝까지 못 봄' : `${r.통과}/${r.시험}`;
  const 자리 = 관련시험 && 관련시험.자리글 ? 관련시험.자리글(r.자리) : '';
  const 줄 = [`  관련 시험 ${상태} — ${셈} · ${r.초}초 · 파일 ${x.수}개(${지도})${자리}${r.이유 ? ` · ${r.이유}` : ''}`];
  for (const f of r.실패.slice(0, 5)) {
    줄.push(`    ✗ ${f.이름}${f.위치 ? ` (${f.위치})` : ''}`);
    // 시험이 찍은 고치는 길(→ 줄) — 예: 지면폰트 ⑦의 「→ 심는다: node tools/lib/브랜드폰트.js --심기 …」
    for (const l of (f.안내 || []).slice(0, 2)) 줄.push(`      → ${l}`);
  }
  return 줄;
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

module.exports = { 올리기, 따라가기, 가볍게, 인자읽기, main, 가볍게뺄, _시험: { 따라가기계획, 따라가기실행, 공용따라가기, 상태읽기, 맥락, 올리기글, origin판들, 가까운바탕, 받은것만바탕 } };
