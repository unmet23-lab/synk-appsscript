#!/usr/bin/env node
'use strict';
/**
 * 공개 — synk.im에 내 파일만 얹어 올린다. synk.im = 공개 저장소 unmet23-lab/synk-policy의 main(GitHub Pages, Jekyll 기본 빌드).
 *
 *   node tools/공개.js 올리기 <항목…> [옵션]                                    미리 보기(커밋·push 안 함)
 *   node tools/공개.js 올리기 <항목…> -m "<메시지>" --실행 --계획 <해시>          커밋 → push → 공개 주소 바이트 대조 → 배포 점검
 *   node tools/공개.js 확인 <커밋> [--재실행]                                    올라간 커밋을 다시 대조하고 배포 점검을 기다린다(남의 공개도 된다)
 *   node tools/공개.js 채우기 [<공개경로 glob>…]                                 공개 뒤 비워진 CDN에 큰 영상을 한 번씩 받아 채운다(기본 PATH 면접 영상)
 *
 *   항목: <공개경로>=<로컬 파일·폴더> · 또는 --원본 <폴더> 아래의 <경로>(그 경로가 공개 경로다. --공개폴더 <앞>으로 앞을 붙인다)
 *   --지움 <공개경로>(폴더는 끝에 /) · --기준 <공개 커밋> · --기준폴더 <폴더> · --전부 · --줄끝도 · --토큰 <값> · --토큰안함
 *   --허용 <공개경로>(AI 이름·제작 자료 검사와 그 경로가 부르는 import ③만 사람이 보고 넘긴다) · --후보폴더 <폴더> · --위에 <커밋>(미리 보기 전용, 지난 공개 재현)
 *   --만 <공개경로>(항목 가운데 그 경로만 올리고 지운다 — import 엇갈림을 두 번에 나눠 올릴 때 1단계)
 *   공통: --json · --사본 <bare 폴더> · --새사본 · --원격주소 <url> · --주소 <사이트> · --기다림 <분> · --점검기다림 <분> · --간격 <초>
 *
 * 올리기
 *   1. 도구 전용 bare 사본(작업본·인덱스 없음, blob 없는 부분 클론)에 origin/main을 새로 받는다. Documents/synk-policy 작업본은 쓰지 않는다.
 *      사본은 ~/Documents/synk-vendor/synk-policy-publish.git(없으면 받는다). git은 모두 GIT_NO_LAZY_FETCH=1로 돌리고, 필요한 blob만 한 번에 받는다.
 *   2. 후보 = 공개본 + 내 파일. 기준이 없으면 공개본과 같은 파일·줄끝만 다른 파일은 빼고 내 판으로 덮는다.
 *      기준이 있으면 경로마다: 내 판 = 기준이면 그대로 둠, 공개본 = 기준이면 내 판, 셋이 다르면 git merge-file 3방향(겹치면 멈춤).
 *      기준 없이 폴더를 주면 남이 공개본을 직접 고친 파일까지 덮을 수 있어 목록만 보이고 멈춘다(--전부면 올린다).
 *   3. ?v= 갱신: 바뀐 파일을 ?v=로 부르는 공개 파일(html·css·js·mjs·json·svg·xml)의 그 토큰만 새 값으로 바꾼다. 사슬(json → js → html)은 끝까지 따라간다.
 *      새 값은 그 파일 sha256의 앞자리(옛 토큰이 16진 8~64자면 같은 길이, 아니면 12자, --토큰이면 그 값). 올릴 파일의 토큰은 먼저 같은 파일
 *      공개본 값으로 맞춘다(깨끗한 빌드의 토큰이 공개본과 달라서). 그대로 두는 것: 공개본 값에서 이미 바꿔 올린 토큰, 바뀌지 않은 파일의 토큰,
 *      .github/ 아래, 어느 파일도 부르지 않는 css·js·데이터 파일(지금 안 쓰는 옛 루트 app.js 등 — 알린다), 같은 이름의 파일이 여럿이라
 *      어느 것인지 모르는 참조(공개본 토큰 해시가 맞는 후보가 하나면 그것으로 본다 — 아니면 알린다).
 *   4. 검사: 배포 점검과 같은 도구 이름 규칙(후보의 .github/site-check/check.mjs에서 읽음) · 그림·영상의 생성 도구 표시(C2PA 등, --허용) ·
 *      더한 줄의 AI 이름(영문·한글, --허용) · 더한 줄의 이 PC·작업 자리 경로(synk-vendor·Documents/ 등, --허용) ·
 *      저장 용량(GitHub 한도 100MiB, 경고 50MiB) · 공개 경로(밑줄 폴더·제작 자료·Jekyll 머리말) ·
 *      import 이름 엇갈림(공개 주소 캐시 10분, tools/lib/import엇갈림.js): 바뀌는 .js·.mjs와 그 모듈을 부르는 공개본 모듈의 정적
 *      import·export를 견줘 ① 새 판 → 바뀐 모듈의 옛 판에 없는 이름 ② 바뀐 모듈의 옛 판 → 새 판에서 없어진 이름 ③ 새 판끼리 안 맞음을
 *      센다. ③은 걸림(부르는 쪽 --허용 · 아무 파일도 부르지 않는 옛 모듈이면 알림), ①·②는 「두 번에 나눠 올리기」를 보이고
 *      1단계(옛 화면과도 맞는 쪽)를 --만 명령으로 준다.
 *   5. --실행 --계획 <해시>: 계획 해시(경로마다 공개본 판 → 새 판)가 미리 보기와 같을 때만 별도 인덱스 → commit-tree → fetch 재확인 →
 *      push(강제 없음). 그사이 origin/main이 움직였으면 새 판 위에 다시 만들고, 계획이 바뀌면(남이 내 경로를 고침) 멈춘다(세 번까지).
 *   6. push 뒤 확인을 한다.
 *
 * 확인 — curl로 공개 주소(…?probe=임의값, no-cache)를 받아 받은 바이트의 git blob id를 커밋 blob과 대조한다(지운 파일은 404, Jekyll 머리말 파일과
 *   밑줄·점 경로는 뺀다. 머리말 없는 .md는 그대로 나가 대조한다). 그 커밋 뒤 공개가 같은 경로를 다시 바꿨으면 지금 main 판으로 대조한다.
 *   다 같아지거나 --기다림(기본 12분)이 지날 때까지 --간격(20초)마다 다시 받는다. 그다음 gh로 배포 점검(site-check.yml)
 *   실행을 찾아 끝날 때까지(--점검기다림, 기본 25분) 기다린다. 뒤 push가 앞 실행을 취소하면 내 커밋을 품은 다음 실행으로 본다.
 *   실패하면 실패 단계를 보이고, --재실행이면 바이트가 다 같을 때 한 번만 실패 작업을 다시 돌린다.
 * 채우기 — 쿼리 없는 공개 주소를 한 번씩 받아(동시 4개) CDN 캐시를 채우고, 다시 물어 x-cache를 적는다.
 *
 * 함정과 고친 기록: docs/현장노트/배포_공개.md 「synk.im(synk-policy)」. 시험: node --test tests/공개.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');
const 엇갈림 = require('./lib/import엇갈림.js');

const 기본원격 = 'git@github.com:unmet23-lab/synk-policy.git';
const 기본저장소이름 = 'unmet23-lab/synk-policy';
const 기본주소 = 'https://synk.im';
const 기본사본 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
/** 10-18 이후 공개 커밋의 작성자(GitHub noreply 메일). */
const 기본작성자 = { 이름: 'yuho', 메일: '301381929+unmet23-lab@users.noreply.github.com' };
const 추적 = 'refs/remotes/origin/main';
const 영oid = '0'.repeat(40);
const 기본채우기 = ['path/assets/interview/film/strict-*.mp4'];
const 한도 = { 파일: 100 * 1024 * 1024, 파일경고: 50 * 1024 * 1024, 합계경고: 300 * 1024 * 1024 };
const 토큰파일 = /\.(html?|css|m?js|json|webmanifest|svg|xml)$/i;
const 미디어파일 = /\.(png|jpe?g|webp|avif|gif|heic|mp4|m4v|mov|webm|m4a|wav|glb)$/i;
/**
 * 그림·영상 안의 생성 도구 표시(C2PA 등) — 메모 「AI 도구 이름 표기 금지」(10-10)와 같은 낱말. C2PA 조각의 이름표는
 * `c2pa.claim`·`c2pa.signature`처럼 점이 붙는다 — 맨 `c2pa` 넉 자는 큰 영상에서 우연히 나와(10-19 검수) 점까지 본다.
 */
const 제작표시 = /c2pa\.|openai|chatgpt|gpt-image|trainedAlgorithmicMedia/i;
/**
 * 배포 점검에는 없는 AI 이름(더한 줄만 본다). 화면·데이터·주석에 도구 이름을 남기지 않는 원칙.
 * 맨 `gpt`는 10-19 몽글 시범 공개에서 「GPT 이미지」가 새어 더했다(`\b`라 MonoGPT·gpt2 같은 붙은 이름은 따로 적는다).
 * runway·llama·sora·veo처럼 흔한 낱말과 같은 이름은 숫자가 붙은 꼴만 본다(10-19 공개본 948개로 잰 거짓 경보: CSS runway,
 * 스페인어 llama, 받아쓰기 모델 tokenizer.json).
 */
const AI이름 = /\b(?:claude(?:\.ai)?|anthropic|chatgpt|openai|codex|gpt-?[0-9][\w.]*|gpt[- ]?image|gpt|monogpt|gemini|copilot|midjourney|higgsfield|suno|udio|nano[ -]?banana|elevenlabs|seedance|kling|typecast|demucs|cosy ?voice|mmaudio|seedvr2?|hyperframes|comfy ?ui|qwen|hailuo|veo[- ]?[0-9]|sora[- ]?[0-9]|flux[ .-]?[0-9])\b/i;
/** 한글로 적은 AI 이름. 다른 낱말 속에 들어가기 쉬운 것(사이클링·교수노조)은 앞 글자가 한글이 아닐 때만 본다. */
const AI한글이름 = /지피티|제미나이|타입캐스트|힉스필드|나노 ?바나나|미드저니|일레븐 ?랩스|앤[트스]로픽|오픈 ?(?:AI|에이아이)|코파일럿|(?<![가-힣])(?:클로드|클링|수노|코덱스|제미니|[씨시]댄스)/i;
const AI표현 = /AI ?생성|AI로 만든|AI가 만든|AI-generated|generated (?:by|with) AI|made (?:by|with) AI/i;
/**
 * 이 PC·작업 자리 경로(더한 줄만 본다). 10-19 몽글 시범 공개에서 `Documents/synk-vendor/…`가 주석에 실려 나갔다.
 * AI 이름과 달리 맞춤 도구·vendor·처리방침까지 본다(`brief/katana/view.js`에도 있었다). 대소문자를 가린다 — 주소의 `/documents/`는 뺀다.
 * 원고 위치 머리말 `SYNK-appsscript/docs/…`와 PC 이사 안내의 OneDrive는 일부러 둔 글이라 넣지 않는다.
 */
const 내부경로 = /synk-vendor|SYNK-worktrees|SYNK_보안|원본창고|\bq1212\b|\bAppData\b|\bDocuments[\\/]|\b[A-Za-z]:[\\/]{1,2}Users\b|\/c\/Users\b|\.claude[\\/]|scratchpad[\\/]|(?<![\w.-])\.tmp[\\/]/;
/** AI 도구 사용법 자체가 내용인 맞춤 도구 페이지(배포 점검이 빼는 brief/와 같은 성격) — AI 이름 검사만 뺀다 */
const 도구안내 = /^(en\/)?builds\//;
/** 공개 묶음에 넣지 않는 제작 자료(10-02 첫 공개에 섞여 나간 꼴, 레이싱 qa/ 함정). */
const 제작자료 = [
  [/(^|\/)[^/]*-original\.[^/]+$/i, '원본 그림(-original)'],
  [/\.source\.json$/i, '제작 기록(.source.json)'],
  [/(^|\/)source\//i, 'source/ 폴더(지시문·원본)'],
  [/(^|\/)qa\//i, 'qa/ 폴더(확인 스크립트·화면)'],
  [/(^|\/)(node_modules|\.tmp)\//, '개발 폴더'],
  [/\.(psd|blend1?|kra|xcf|aep|prproj)$/i, '편집 원본 파일'],
];
/** 배포 점검(.github/site-check/check.mjs 「2. 도구 이름」) 규칙을 못 읽을 때 쓰는 사본(10-19 그대로). */
const 점검규칙사본 = {
  낱말: 'c3Vub3xoaWdnc2ZpZWxkfG5hbm8gYmFuYW5hfG1pZGpvdXJuZXl8Z3B0Wy0gXWltYWdlfGVkZ2VbLV8gXXR0c3xlbGV2ZW5sYWJzfGdlbWluaS1bMC05XVtcdy4tXSp0dHN8a28tS1ItW0EtWmEtel0rTmV1cmFsfG1hZGUgd2l0aCAoc3Vub3x1ZGlvKQ==',
  태그: 'c3Vub3xcYnVkaW9cYnxnZW1pbml8ZWxldmVubGFic3xvcGVuYWl8ZWRnZVstXyBdP3R0cw==',
  skipDir: /(^|\/)(vendor|node_modules)\//,
  skipPage: /^(en\/)?(privacy|terms|data-deletion|brief)\//,
  skipFile: /(^|\/)knowledge-engine\.js$/,
  글: /\.(html|js|mjs|css|json|txt|xml|md|svg|webmanifest)$/i,
};
const 위치환경 = /^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|PREFIX)$/;
const 좋은결과 = new Set(['미리 보기', '올릴 것 없음', '올림', '확인함', '채움']);

class 멈춤 extends Error {
  constructor(이유, 덧 = {}) { super(이유); this.이유 = 이유; this.덧 = 덧; }
}
class 사용법오류 extends Error {}

// ── 작은 도움 ─────────────────────────────────────────────────────────────────

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const 블롭id = (b) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
const 이진인가 = (b) => b.subarray(0, 8000).includes(0);
const 짧게 = (s) => (s ? s.slice(0, 7) : '');
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
const 바이트글 = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : n >= 1024 ? `${(n / 1024).toFixed(1)}KB` : `${n}B`);

function 기본환경() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!위치환경.test(k)) env[k] = v;
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_NO_LAZY_FETCH = '1';
  return env;
}

/** git(args) → stdout 버퍼. git.글(args) → 다듬은 글. git.돌리기(args, {허용: null})는 실패해도 결과를 준다. */
function git도구(폴더) {
  const 바탕env = 기본환경();
  function 돌리기(args, { env, input, 허용 = [0] } = {}) {
    const r = spawnSync('git', ['-C', 폴더, '-c', 'core.quotepath=false', ...args], {
      env: { ...바탕env, ...env }, input, maxBuffer: 1024 * 1024 * 1024, windowsHide: true,
    });
    if (r.error) throw r.error;
    if (허용 && !허용.includes(r.status)) {
      const e = new Error(`git ${args.slice(0, 4).join(' ')} 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 600)}`);
      e.status = r.status;
      throw e;
    }
    return r;
  }
  const git = (args, o) => 돌리기(args, o).stdout;
  git.글 = (args, o) => git(args, o).toString('utf8').trim();
  git.돌리기 = 돌리기;
  git.폴더 = 폴더;
  return git;
}

/** 공개 경로를 다듬는다: 역슬래시 → /, 앞 ./ 제거. 비었거나 ..·.git·절대 경로면 사용법오류. */
function 공개경로(값, { 폴더 = false } = {}) {
  let p = String(값).replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  const 끝슬래시 = p.endsWith('/');
  p = p.replace(/\/+$/, '');
  if (!p || p.startsWith('/') || /^[A-Za-z]:/.test(p)) throw new 사용법오류(`공개 경로는 저장소 뿌리에서 본 상대 경로다: ${값}`);
  const 칸 = p.split('/');
  if (칸.some((x) => !x || x === '.' || x === '..')) throw new 사용법오류(`공개 경로에 빈 칸·..가 있다: ${값}`);
  if (칸.some((x) => x.toLowerCase() === '.git')) throw new 사용법오류(`.git 아래는 올리지 않는다: ${값}`);
  return 폴더 || 끝슬래시 ? `${p}/` : p;
}

// ── 사본 ────────────────────────────────────────────────────────────────────

/** 도구 전용 bare 부분 클론을 연다(없으면 받는다). 돌려준 것: {git, 폴더, 원격, 치우기()} */
function 사본열기(옵션) {
  const 원격 = 옵션.원격주소 || 기본원격;
  let 폴더 = 옵션.사본 ? path.resolve(옵션.사본) : 기본사본;
  let 임시 = false;
  if (옵션.새사본) { 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-publish-')); 임시 = true; }
  if (fs.existsSync(path.join(폴더, '.git'))) throw new 멈춤(`사본이 bare 저장소가 아니다(작업본을 쓰지 않는다): ${폴더}`);
  if (!fs.existsSync(path.join(폴더, 'HEAD'))) {
    if (fs.existsSync(폴더) && fs.readdirSync(폴더).length) throw new 멈춤(`사본 폴더가 비어 있지 않은데 git 저장소가 아니다: ${폴더}`);
    fs.mkdirSync(path.dirname(폴더), { recursive: true });
    const r = spawnSync('git', ['clone', '-q', '--bare', '--filter=blob:none', '--no-tags', 원격, 폴더], { env: 기본환경(), windowsHide: true });
    if (r.status !== 0) throw new 멈춤(`공개 저장소를 받지 못했다(${원격}) — ${String(r.stderr).trim().slice(0, 400)}`);
  }
  const git = git도구(폴더);
  if (git.글(['rev-parse', '--is-bare-repository']) !== 'true') throw new 멈춤(`사본이 bare 저장소가 아니다(작업본을 쓰지 않는다): ${폴더}`);
  const 지금원격 = git.돌리기(['config', '--get', 'remote.origin.url'], { 허용: null }).stdout.toString('utf8').trim();
  if (지금원격 !== 원격) throw new 멈춤(`사본의 origin이 ${지금원격 || '(없음)'}이다 — ${원격}이어야 한다: ${폴더}`);
  if (git.글(['rev-parse', '--show-object-format']) !== 'sha1') throw new 멈춤('sha1 저장소만 다룬다');
  return { git, 폴더, 원격, 치우기() { if (임시) fs.rmSync(폴더, { recursive: true, force: true, maxRetries: 5 }); } };
}

/** origin/main을 새로 받는다. 남이 같은 사본에서 받는 중이면 잠깐 기다려 다시 한다. */
async function 받아오기(git) {
  for (let 차례 = 1; ; 차례++) {
    const r = git.돌리기(['fetch', '-q', '--no-tags', '--filter=blob:none', 'origin', `+refs/heads/main:${추적}`], { 허용: null });
    if (r.status === 0) {
      const 머리 = git.글(['rev-parse', '--verify', `${추적}^{commit}`]);
      // bare 사본의 main도 받은 판으로 옮겨 --기준 main·--위에 main이 클론 때 판으로 풀리지 않게 한다
      git.돌리기(['update-ref', 'refs/heads/main', 머리], { 허용: null });
      return 머리;
    }
    const 글 = String(r.stderr).trim();
    if (차례 < 4 && /lock|cannot lock|unable to update/i.test(글)) { await 잠깐(1500 * 차례); continue; }
    throw new 멈춤(`fetch 실패 — ${글.slice(0, 400)}`);
  }
}

function 트리읽기(git, rev) {
  const 결과 = new Map();
  for (const 줄 of git(['ls-tree', '-r', '-z', '--full-tree', rev]).toString('utf8').split('\0')) {
    if (!줄) continue;
    const 탭 = 줄.indexOf('\t');
    const [모드, 종류, oid] = 줄.slice(0, 탭).split(' ');
    if (종류 === 'blob') 결과.set(줄.slice(탭 + 1), { 모드, oid });
  }
  return 결과;
}

/** 사본에 없는 blob만 한 번에 받는다(부분 클론에서 하나씩 받으러 가는 함정을 피한다). */
function 블롭받기(git, oids) {
  const 고유 = [...new Set(oids.filter(Boolean))];
  if (!고유.length) return;
  const 없음 = git(['cat-file', '--batch-check'], { input: `${고유.join('\n')}\n` }).toString('utf8')
    .split('\n').filter((l) => / missing$/.test(l)).map((l) => l.split(' ')[0]);
  for (let i = 0; i < 없음.length; i += 400) {
    const 묶음 = 없음.slice(i, i + 400);
    const r = git.돌리기(['fetch', '-q', '--no-tags', '--filter=blob:none', '--stdin', 'origin'], { input: `${묶음.join('\n')}\n`, 허용: null });
    if (r.status !== 0) throw new 멈춤(`blob ${묶음.length}개를 받지 못했다 — ${String(r.stderr).trim().slice(0, 300)}`);
  }
}

function 블롭읽기(git, 저장, oids) {
  const 고유 = [...new Set(oids.filter((s) => s && !저장.has(s)))];
  if (!고유.length) return 저장;
  블롭받기(git, 고유);
  const 출력 = git(['cat-file', '--batch'], { input: `${고유.join('\n')}\n` });
  let p = 0;
  for (const oid of 고유) {
    const 끝 = 출력.indexOf(0x0a, p);
    const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(출력.subarray(p, 끝).toString('utf8'));
    if (!m || m[1] !== oid) throw new Error(`blob을 못 읽었다: ${oid}`);
    const 크기 = Number(m[3]);
    저장.set(oid, 출력.subarray(끝 + 1, 끝 + 1 + 크기));
    p = 끝 + 1 + 크기 + 1;
  }
  return 저장;
}

function 블롭(git, 저장, oid) {
  if (!oid) return Buffer.alloc(0);
  if (!저장.has(oid)) 블롭읽기(git, 저장, [oid]);
  return 저장.get(oid);
}

function 블롭쓰기(git, 저장, 버퍼) {
  const oid = git.글(['hash-object', '-w', '--no-filters', '--stdin'], { input: 버퍼 });
  if (oid !== 블롭id(버퍼)) throw new Error(`hash-object가 다른 id를 냈다: ${oid}`);
  저장.set(oid, 버퍼);
  return oid;
}

/** diff-tree -z 날 출력 → [{옛모드, 새모드, 옛, 새, 상태, 경로}] */
function 날차이읽기(버퍼) {
  const 칸 = 버퍼.toString('utf8').split('\0');
  const 결과 = [];
  for (let i = 0; i + 1 < 칸.length; i += 2) {
    if (!칸[i]) break;
    const m = /^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/.exec(칸[i]);
    if (!m) throw new Error(`git 차이 출력을 못 읽었다: ${칸[i]}`);
    결과.push({ 옛모드: m[1], 새모드: m[2], 옛: /^0+$/.test(m[3]) ? null : m[3], 새: /^0+$/.test(m[4]) ? null : m[4], 상태: m[5], 경로: 칸[i + 1] });
  }
  return 결과;
}

function 커밋바뀜(git, 커밋, 부터) {
  return 날차이읽기(git(['diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', 부터 || `${커밋}^`, 커밋]));
}

function 조상인가(git, 앞, 뒤) {
  return git.돌리기(['merge-base', '--is-ancestor', 앞, 뒤], { 허용: [0, 1, 128] }).status === 0;
}

function 커밋요약(git, rev) {
  const [h, t, s] = git(['log', '-1', '--format=%H%x00%ct%x00%s', rev]).toString('utf8').trim().split('\0');
  return { 커밋: h, 시각: Number(t) * 1000, 제목: s };
}

// ── 입력 ────────────────────────────────────────────────────────────────────

function 폴더걷기(뿌리, 앞 = '') {
  const 파일 = [], 연결 = [];
  for (const e of fs.readdirSync(path.join(뿌리, 앞), { withFileTypes: true })) {
    const 상대 = 앞 ? `${앞}/${e.name}` : e.name;
    if (e.name === '.git') continue;
    if (e.isSymbolicLink()) { 연결.push(상대); continue; }
    if (e.isDirectory()) { const r = 폴더걷기(뿌리, 상대); 파일.push(...r.파일); 연결.push(...r.연결); }
    else if (e.isFile()) 파일.push(상대);
  }
  return { 파일, 연결 };
}

/** 항목 → {올릴: Map(공개경로 → 로컬 파일), 폴더: [{공개, 로컬}], 지울: [공개경로…], 연결: [건너뛴 연결 폴더]} */
function 항목모으기(옵션) {
  const 올릴 = new Map(), 폴더 = [], 연결 = [];
  const 앞 = 옵션.공개폴더 ? 공개경로(옵션.공개폴더).replace(/\/$/, '') : '';
  const 붙이기 = (p) => (앞 ? `${앞}/${p}` : p);
  const 더하기 = (공개, 로컬) => {
    const 있던 = 올릴.get(공개);
    if (있던 && path.resolve(있던) !== path.resolve(로컬)) throw new 사용법오류(`같은 공개 경로에 다른 파일을 두 번 줬다: ${공개}`);
    올릴.set(공개, path.resolve(로컬));
  };
  for (const 항 of 옵션.항목 || []) {
    let 공개, 로컬;
    const k = 항.indexOf('=');
    if (k > 0) { 공개 = 항.slice(0, k); 로컬 = 항.slice(k + 1); }
    else {
      if (!옵션.원본) throw new 사용법오류(`--원본 없이 준 항목은 <공개경로>=<로컬 파일> 꼴이어야 한다: ${항}`);
      const 상대 = 항.replace(/\\/g, '/').replace(/^(\.\/)+|^\.$/, '');
      로컬 = path.join(옵션.원본, 상대);
      공개 = 상대 ? 붙이기(상대) : 앞; // 「.」은 --원본 전체(공개 뿌리 또는 --공개폴더)
    }
    if (!fs.existsSync(로컬)) throw new 사용법오류(`없는 파일·폴더: ${로컬}`);
    const 상태 = fs.statSync(로컬);
    if (상태.isDirectory()) {
      const p = 공개 ? 공개경로(공개, { 폴더: true }) : '';
      const r = 폴더걷기(로컬);
      for (const f of r.파일) 더하기(공개경로(`${p}${f}`), path.join(로컬, f));
      연결.push(...r.연결.map((x) => `${p}${x}`));
      폴더.push({ 공개: p, 로컬: path.resolve(로컬) });
    } else 더하기(공개경로(공개), 로컬);
  }
  const 지울 = (옵션.지움 || []).map((x) => 공개경로(x));
  for (const p of 지울) if (올릴.has(p)) throw new 사용법오류(`올리면서 지울 수는 없다: ${p}`);
  return { 올릴, 폴더, 지울, 연결 };
}

/**
 * 기준 판: --기준 <커밋>이면 그 커밋의 트리, --기준폴더면 --원본과 같은 모양의 폴더(공개경로 → 같은 상대 경로). 없으면 null.
 * 판(p) → oid|null. 폴더 판의 내용은 저장(blob 모음)에 넣는다.
 */
function 기준읽기(git, 옵션, 저장) {
  if (옵션.기준 && 옵션.기준폴더) throw new 사용법오류('--기준과 --기준폴더는 하나만 준다');
  if (옵션.기준) {
    const r = git.돌리기(['rev-parse', '--verify', '-q', `${옵션.기준}^{commit}`], { 허용: null });
    if (r.status !== 0) throw new 멈춤(`--기준 커밋을 사본에서 못 찾았다: ${옵션.기준} (origin/main 이력에 있는 공개 커밋이어야 한다)`);
    const 커밋 = r.stdout.toString('utf8').trim();
    const 트리 = 트리읽기(git, 커밋);
    return { 종류: '커밋', 커밋, 판: (p) => (트리.get(p) || {}).oid || null };
  }
  if (!옵션.기준폴더) return null;
  const 뿌리 = path.resolve(옵션.기준폴더);
  if (!fs.existsSync(뿌리) || !fs.statSync(뿌리).isDirectory()) throw new 사용법오류(`--기준폴더가 폴더가 아니다: ${옵션.기준폴더}`);
  const 앞 = 옵션.공개폴더 ? 공개경로(옵션.공개폴더).replace(/\/$/, '') : '';
  const 상대로 = (p) => (앞 ? (p.startsWith(`${앞}/`) ? p.slice(앞.length + 1) : null) : p);
  const 판 = (p) => {
    const r = 상대로(p);
    if (r === null) return null;
    const f = path.join(뿌리, ...r.split('/'));
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return null;
    const b = fs.readFileSync(f);
    const oid = 블롭id(b);
    저장.set(oid, b);
    return oid;
  };
  const 아래 = (공개앞) => {
    const 끝없앰 = 공개앞.replace(/\/$/, '');
    const r = !앞 ? 끝없앰 : 끝없앰 === 앞 ? '' : 상대로(끝없앰);
    if (r === null) return [];
    const 폴더 = path.join(뿌리, ...r.split('/').filter(Boolean));
    if (!fs.existsSync(폴더)) return [];
    return 폴더걷기(폴더).파일.map((f) => `${공개앞}${f}`);
  };
  return { 종류: '폴더', 폴더: 뿌리, 판, 아래 };
}

// ── 줄끝·3방향 ──────────────────────────────────────────────────────────────

function 줄끝종류(b) {
  const 글 = b.toString('latin1');
  const 전체 = (글.match(/\n/g) || []).length;
  if (!전체) return '없음';
  const crlf = (글.match(/\r\n/g) || []).length;
  return crlf === 전체 ? 'crlf' : crlf === 0 ? 'lf' : '섞임';
}
const LF로 = (b) => Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
const CRLF로 = (b) => Buffer.from(b.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1');

function 줄끝만다름(a, b) {
  if (이진인가(a) || 이진인가(b)) return false;
  return !a.equals(b) && LF로(a).equals(LF로(b));
}

/** 공개본(우리) · 기준 · 내 판 3방향. 줄끝이 서로 다르면 LF로 맞춰 합치고 공개본 줄끝으로 돌린다. */
function 세판합치기(git, 저장, 공oid, 기oid, 나oid) {
  const P = 블롭(git, 저장, 공oid), B = 블롭(git, 저장, 기oid), M = 블롭(git, 저장, 나oid);
  if (이진인가(P) || 이진인가(B) || 이진인가(M)) return { 문제: '그림·바이너리 파일을 기준 뒤 공개본에서도 바꿨다 — 손으로 고른다' };
  const 종류 = [P, B, M].map(줄끝종류);
  // 줄끝이 섞인 판(공개본에 38개)이 끼면 셋 다 LF로 맞춰 합치고 LF로 둔다(돌릴 한 가지 줄끝이 없다)
  const 섞임 = 종류.includes('섞임');
  const 맞춤 = 섞임 || new Set(종류.filter((x) => x !== '없음')).size > 1;
  const [p, b, m] = 맞춤 ? [P, B, M].map((x) => 블롭쓰기(git, 저장, LF로(x))) : [공oid, 기oid, 나oid];
  const r = git.돌리기(['merge-file', '-p', '--object-id', '-L', '공개본', '-L', '기준', '-L', '내 판', p, b, m], { 허용: null });
  if (r.status !== 0) {
    if (r.status > 0 && r.status < 128) return { 문제: `기준 뒤 공개본에서 바뀐 곳과 내가 바꾼 곳이 ${r.status}곳 겹친다 — 손으로 합친다` };
    return { 문제: `git merge-file 실패: ${String(r.stderr).trim()}` };
  }
  let 결과 = r.stdout;
  if (맞춤 && 종류[0] === 'crlf') 결과 = CRLF로(결과);
  return { 버퍼: 결과, 줄끝맞춤: 맞춤, 섞임 };
}

// ── ?v= 토큰 ─────────────────────────────────────────────────────────────────

/** 참조 글 + ?v=토큰. 참조 앞은 글 시작·공백·따옴표·(·=·, 가운데 하나여야 한다(속성 이름까지 참조로 읽지 않게 =·{}는 참조에 넣지 않는다). */
const 토큰찾기 = /(?<=^|[\s"'`(=,])([^\s"'`()<>?#={}[\]\\,;|]+)\?v=([A-Za-z0-9._-]+)/g;

function 토큰값(내용, 옛, 정한값) {
  if (정한값) return 정한값;
  const h = sha256(내용);
  if (/^[0-9a-f]+$/.test(옛) && 옛.length >= 8 && 옛.length <= 64) return h.slice(0, 옛.length);
  return h.slice(0, 12);
}

/**
 * 참조 글(url) → 공개 경로. 다른 사이트·data: 주소는 null. 상대 → 뿌리 → 꼬리 맞춤 차례로 찾는다. 꼬리 맞춤은 데이터 모듈처럼
 * 다른 기준 폴더로 적힌 참조(`"onb/mongle-기본.webp?v="`, `"marin-기본.webp?v="`)를 위한 것이다 — 같은 꼬리 경로가 하나뿐이면
 * {경로, 꼬리: true}, 여럿이면 {모호: [후보…]}(어느 것인지 몰라 고치지 않고 알린다).
 */
function 참조풀기(파일, 주소, 있나, 꼬리들, 호스트들) {
  let u = 주소;
  const m = /^(?:https?:)?\/\/([^/]+)(\/.*)?$/i.exec(u);
  if (m) { if (!호스트들.has(m[1].toLowerCase())) return null; u = m[2] || '/'; }
  else if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
  try { u = decodeURI(u); } catch (_) { /* 그대로 */ }
  const 뿌리부터 = u.startsWith('/');
  let p = 뿌리부터 ? path.posix.normalize(u.slice(1) || '.') : path.posix.normalize(path.posix.join(path.posix.dirname(파일), u));
  p = p.replace(/\/+$/, '');
  if (p === '.') p = '';
  if (p.startsWith('../') || p === '..') return null;
  if (u.endsWith('/') || !p) p = p ? `${p}/index.html` : 'index.html';
  if (있나(p)) return { 경로: p };
  if (!뿌리부터 && !u.startsWith('.') && !u.endsWith('/')) {
    const 맞음 = 꼬리들(path.posix.normalize(u));
    if (맞음.length === 1) return { 경로: 맞음[0], 꼬리: true };
    if (맞음.length > 1) return { 모호: 맞음 };
  }
  return null;
}

function 토큰모음(글) {
  const 결과 = new Map();
  for (const m of 글.matchAll(토큰찾기)) {
    if (!결과.has(m[1])) 결과.set(m[1], new Set());
    결과.get(m[1]).add(m[2]);
  }
  return 결과;
}

/**
 * 토큰 맞춤: 올릴 파일(또는 기준 판)의 ?v= 값을 같은 파일 공개본의 같은 참조 값으로 되돌린다. 깨끗한 빌드의 토큰은 공개본과 달라
 * 안 바꾼 파일까지 바뀐 것처럼 보이고 3방향이 겹친다(현장 노트 「?v=를 다시 계산하면」). 바뀐 파일의 토큰은 다음 단계가 새로 붙인다.
 * 공개본에 같은 참조가 없거나 값이 여럿이면 그대로 둔다.
 */
function 토큰맞춤(버퍼, 공개버퍼) {
  const 공토큰 = 토큰모음(공개버퍼.toString('latin1'));
  let 맞춤 = 0;
  const 새 = 버퍼.toString('latin1').replace(토큰찾기, (전체, 주소, 토큰) => {
    const s = 공토큰.get(주소);
    if (!s || s.size !== 1) return 전체;
    const t0 = s.values().next().value;
    if (t0 === 토큰) return 전체;
    맞춤++;
    return `${주소}?v=${t0}`;
  });
  return 맞춤 ? { 버퍼: Buffer.from(새, 'latin1'), 맞춤 } : { 버퍼, 맞춤 };
}

/**
 * 바뀐 파일을 ?v=로 부르는 파일의 토큰을 고친다. 원래(p)는 토큰을 고치기 전 판(내 판 또는 공개본), 공개(p)는 공개본 판(없으면 null).
 * HTML이 아닌 파일은 어느 파일도 부르지 않으면(부르는가(p)가 거짓, 예: 지금 쓰지 않는 루트 app.js) 고치지 않고 알린다.
 * 반환: Map(경로 → {버퍼, 바꿈: [{참조, 대상, 전, 후, 꼬리}]}), .지운참조 · .안부름 · .모호
 */
function 토큰고치기({ 훑을, 원래, 공개, 처음바뀜, 지움, 있나, 꼬리들, 호스트들, 정한값, 부르는가 = () => true, 받아두기 = () => {} }) {
  let 바뀐 = new Map(처음바뀜); // 경로 → 새 버퍼(내용이 바뀐 대상)
  const 공개토큰 = new Map();
  const 공개토큰들 = (p) => {
    if (!공개토큰.has(p)) { const b = 공개(p); 공개토큰.set(p, b ? 토큰모음(b.toString('latin1')) : null); }
    return 공개토큰.get(p);
  };
  let 결과 = new Map();
  for (let 돌기 = 1; ; 돌기++) {
    const 이번 = new Map();
    const 지운참조 = [], 안부름 = [], 모호 = [];
    for (const F of 훑을) {
      const 처음 = 원래(F);
      if (!처음 || 이진인가(처음)) continue;
      const 글 = 처음.toString('latin1');
      if (!글.includes('?v=')) continue;
      const 옛토큰 = 공개토큰들(F);
      const 고침 = [];
      let 안부르는파일 = null;
      for (const m of 글.matchAll(토큰찾기)) {
        const 주소 = Buffer.from(m[1], 'latin1').toString('utf8');
        let 풀림 = 참조풀기(F, 주소, 있나, 꼬리들, 호스트들);
        if (!풀림) continue;
        if (풀림.모호) {
          const 바뀐후보 = 풀림.모호.filter((p) => 바뀐.has(p) || 지움.has(p));
          if (!바뀐후보.length) continue;
          // 같은 이름이 여럿이면 공개본 토큰(해시)이 내용과 맞는 후보가 그 참조의 대상이다(tutor-profiles.mjs의 marin-기본.webp: 8개 중 하나)
          let 고른 = null;
          if (/^[0-9a-f]+$/.test(m[2]) && m[2].length >= 8 && m[2].length <= 64) {
            받아두기(풀림.모호);
            const 맞는 = 풀림.모호.filter((p) => { const b = 공개(p); return b && sha256(b).startsWith(m[2]); });
            if (맞는.length === 1) [고른] = 맞는;
          }
          if (!고른) { 모호.push({ 파일: F, 참조: 주소, 후보: 풀림.모호.length, 바뀐후보 }); continue; }
          풀림 = { 경로: 고른, 꼬리: true };
        }
        if (풀림.경로 === F) continue;
        if (지움.has(풀림.경로)) { 지운참조.push({ 파일: F, 참조: 주소, 대상: 풀림.경로 }); continue; }
        const 대상 = 바뀐.get(풀림.경로);
        if (!대상) continue;
        const 전 = m[2];
        // 공개본 판의 같은 참조 토큰이 아니면(올린 사람이 이미 바꿨거나 새 참조) 그대로 둔다
        if (!옛토큰 || !옛토큰.has(m[1]) || !옛토큰.get(m[1]).has(전)) continue;
        // 어느 파일도 부르지 않는 css·js·데이터 파일(지금 안 쓰는 옛 파일)은 고치지 않고 알린다. HTML은 주소로 바로 열리니 늘 고친다.
        if (!/\.html?$/i.test(F)) {
          if (안부르는파일 === null) 안부르는파일 = !부르는가(F);
          if (안부르는파일) { 안부름.push({ 파일: F, 참조: 주소, 대상: 풀림.경로 }); continue; }
        }
        const 후 = 토큰값(대상, 전, 정한값);
        if (후 === 전) continue;
        const 시작 = m.index + m[0].length - 전.length;
        고침.push({ 시작, 끝: m.index + m[0].length, 후, 기록: { 참조: 주소, 대상: 풀림.경로, 전, 후, ...(풀림.꼬리 ? { 꼬리: true } : {}) } });
      }
      if (!고침.length) continue;
      let 새글 = '', p = 0;
      for (const g of 고침) { 새글 += 글.slice(p, g.시작) + g.후; p = g.끝; }
      새글 += 글.slice(p);
      이번.set(F, { 버퍼: Buffer.from(새글, 'latin1'), 바꿈: 고침.map((g) => g.기록), 지운참조: [] });
    }
    // 대상 = 처음 바뀐 파일 + 이번에 토큰이 바뀐 파일. 이전 판과 같아지면 끝.
    const 다음 = new Map(처음바뀜);
    for (const [F, v] of 이번) 다음.set(F, v.버퍼);
    const 같음 = 다음.size === 바뀐.size && [...다음].every(([k, v]) => 바뀐.has(k) && 바뀐.get(k).equals(v));
    결과 = 이번;
    Object.assign(결과, { 지운참조, 안부름, 모호 });
    if (같음) return 결과;
    if (돌기 >= 12) throw new 멈춤('?v= 참조가 서로를 부르며 끝나지 않는다 — --토큰안함으로 끄고 손으로 고친다');
    바뀐 = 다음;
  }
}

/** HTML이 토큰 없이 부르는 바뀐 css·js(브라우저·CDN이 옛 판을 쓸 수 있다) */
function 토큰없는참조(html들, 내용, 바뀐대상, 있나, 꼬리들, 호스트들) {
  const 결과 = [];
  const 찾기 = /(?:href|src)=["']([^"'?#]+)["']/g;
  for (const F of html들) {
    const b = 내용(F);
    if (!b) continue;
    for (const m of b.toString('latin1').matchAll(찾기)) {
      const 주소 = Buffer.from(m[1], 'latin1').toString('utf8');
      if (!/\.(css|m?js)$/i.test(주소)) continue;
      const 풀림 = 참조풀기(F, 주소, 있나, () => [], 호스트들);
      if (풀림 && 바뀐대상.has(풀림.경로)) 결과.push({ 파일: F, 참조: 주소, 대상: 풀림.경로 });
    }
  }
  return 결과;
}

// ── 검사 ────────────────────────────────────────────────────────────────────

/** 배포 점검의 도구 이름 규칙을 check.mjs 글에서 읽는다. 못 읽으면 사본 규칙과 알림. */
function 점검규칙읽기(글) {
  const 규칙 = { ...점검규칙사본, 출처: '도구 사본' };
  if (!글) return 규칙;
  // 이름으로 찾는다(목록이 늘어도 어긋나지 않게): const words = listOf('…') · const tagWords = listOf('…')
  const 목록글 = (이름) => { const m = new RegExp(`const ${이름} = listOf\\('([A-Za-z0-9+/=]+)'\\)`).exec(글); return m ? m[1] : null; };
  const 정규 = (이름) => {
    const m = new RegExp(`const ${이름} = /(.+)/([a-z]*);`).exec(글);
    try { return m ? new RegExp(m[1], m[2]) : null; } catch (_) { return null; }
  };
  const 글확장 = /if \(\/(\\\.\([a-z|]+\)\$)\/i\.test\(f\)\)/.exec(글);
  const 읽음 = { 낱말: 목록글('words'), 태그: 목록글('tagWords'), skipDir: 정규('skipDir'), skipPage: 정규('skipPage'), skipFile: 정규('skipFile') };
  if (Object.values(읽음).every(Boolean) && 글확장) return { ...읽음, 글: new RegExp(글확장[1], 'i'), 출처: '.github/site-check/check.mjs' };
  return 규칙;
}

const 목록 = (b64) => new RegExp(Buffer.from(b64, 'base64').toString('utf8'), 'i');
const 덩어리빼기 = (t) => t.replace(/data:[^"')\s]+/g, '').replace(/[A-Za-z0-9+/=]{300,}/g, '');

function 더한줄(옛, 새) {
  const 셈 = new Map();
  for (const l of 옛.toString('utf8').split('\n')) 셈.set(l.replace(/\r$/, ''), (셈.get(l.replace(/\r$/, '')) || 0) + 1);
  const 결과 = [];
  for (const raw of 새.toString('utf8').split('\n')) {
    const l = raw.replace(/\r$/, '');
    const n = 셈.get(l) || 0;
    if (n) 셈.set(l, n - 1); else 결과.push(l);
  }
  return 결과;
}

const 글조각 = (t, i, 길이) => t.slice(Math.max(0, i - 30), i + 길이 + 30).replace(/\s+/g, ' ');

/** 바뀐 파일의 검사. 항목들: [{경로, 버퍼|null(지움), 공개버퍼|null}] → {걸림, 알림, 요약} */
function 검사하기(항목들, 규칙, 옵션 = {}) {
  const 걸림 = [], 알림 = [];
  const 허용 = new Set((옵션.허용 || []).map((p) => 공개경로(p)));
  const 한 = { ...한도, ...(옵션.한도 || {}) }; // 시험만 줄인다
  const 낱말 = 목록(규칙.낱말), 태그 = 목록(규칙.태그);
  const 요약 = { 글: 0, mp3: 0, 미디어: 0, 더한줄: 0, 경로줄: 0, 새바이트: 0, 새blob: 0 };
  for (const x of 항목들) {
    if (!x.버퍼) continue;
    const p = x.경로;
    const 숨김 = p.startsWith('.github/');
    const 점검밖 = 규칙.skipDir.test(p) || 규칙.skipPage.test(p) || 규칙.skipFile.test(p) || 숨김;
    // 1) 배포 점검과 같은 도구 이름 규칙 — 점검이 실패할 것이므로 허용으로 넘기지 않는다
    if (!점검밖 && 규칙.글.test(p)) {
      const 글 = 덩어리빼기(x.버퍼.toString('utf8'));
      요약.글++;
      const m = 글.match(낱말);
      if (m) 걸림.push({ 경로: p, 검사: '도구 이름', 이유: `배포 점검 규칙에 걸린다: “${글조각(글, m.index, m[0].length)}”` });
    } else if (!점검밖 && /\.mp3$/i.test(p)) {
      const 머리 = x.버퍼.subarray(0, 8192).toString('latin1');
      요약.mp3++;
      const m = 머리.match(태그);
      if (머리.startsWith('ID3') && m) 걸림.push({ 경로: p, 검사: '도구 이름', 이유: `MP3 태그에 “${m[0]}”(배포 점검 규칙)` });
    }
    // 2) 그림·영상의 생성 도구 표시(C2PA 등). 큰 영상은 우연히 같은 바이트가 나올 수 있어 사람이 보고 --허용으로 넘길 수 있다.
    if (!점검밖 && 미디어파일.test(p)) {
      요약.미디어++;
      const m = x.버퍼.toString('latin1').match(제작표시);
      if (m) {
        const 항 = { 경로: p, 검사: '제작 표시', 이유: `파일 안에 생성 도구 표시 “${m[0]}”가 있다(그림은 C2PA 조각을 빼고 올린다)` };
        if (허용.has(p)) 알림.push({ ...항, 이유: `${항.이유} — --허용으로 넘김` }); else 걸림.push(항);
      }
    }
    // 3) 더한 줄의 AI 이름(영문·한글)·「AI로 만든」 표현·이 PC 경로 — 사람이 보고 --허용으로 넘길 수 있다. AI 이름은 배포 점검이 빼는
    //    곳과 도구 사용법이 내용인 맞춤 도구(/builds/)를 빼고, 이 PC 경로는 그런 곳까지 본다(.github/만 뺀다).
    const 글파일 = !숨김 && !이진인가(x.버퍼) && /\.(html?|css|m?js|json|txt|xml|svg|webmanifest|md)$/i.test(p);
    if (글파일) {
      const 이름칸 = !점검밖 && !도구안내.test(p);
      const 줄들 = 더한줄(x.공개버퍼 || Buffer.alloc(0), x.버퍼);
      if (이름칸) 요약.더한줄 += 줄들.length;
      요약.경로줄 += 줄들.length;
      const 넘김 = (항) => { if (허용.has(p)) 알림.push({ ...항, 이유: `${항.이유} — --허용으로 넘김` }); else 걸림.push(항); };
      let 이름봄 = !이름칸, 경로봄 = false;
      for (const 줄 of 줄들) {
        const 글 = 덩어리빼기(줄);
        if (!이름봄) {
          const m = 글.match(AI이름) || 글.match(AI한글이름) || (/^(en\/)?pulse\//.test(p) ? null : 글.match(AI표현));
          if (m) { 넘김({ 경로: p, 검사: 'AI 이름', 이유: `더한 줄에 “${글조각(글, m.index, m[0].length)}”` }); 이름봄 = true; }
        }
        if (!경로봄) {
          const m = 글.match(내부경로);
          if (m) { 넘김({ 경로: p, 검사: '내부 경로', 이유: `더한 줄에 이 PC·작업 자리 경로 “${글조각(글, m.index, m[0].length)}”` }); 경로봄 = true; }
        }
        if (이름봄 && 경로봄) break;
      }
    }
    // 4) 저장 용량(GitHub: 100MiB 넘는 파일은 push 거절, 50MiB 넘으면 경고)
    const 크기 = x.버퍼.length;
    if (!x.공개버퍼 || !x.공개버퍼.equals(x.버퍼)) { 요약.새바이트 += 크기; 요약.새blob++; }
    if (크기 > 한.파일) 걸림.push({ 경로: p, 검사: '저장 용량', 이유: `${바이트글(크기)} — GitHub가 100MiB 넘는 파일의 push를 거절한다` });
    else if (크기 > 한.파일경고) 알림.push({ 경로: p, 검사: '저장 용량', 이유: `${바이트글(크기)} — GitHub가 50MiB 넘는 파일을 경고한다` });
  }
  if (요약.새바이트 > 한.합계경고) 알림.push({ 검사: '저장 용량', 이유: `새로 올릴 바이트가 ${바이트글(요약.새바이트)}다 — 큰 업로드 전 확인(현장 노트 백업_업로드)` });
  // 5) 공개 경로
  for (const x of 항목들) {
    const p = x.경로;
    if (p.startsWith('.github/')) {
      if (p.startsWith('.github/workflows/') || p.startsWith('.github/site-check/')) 알림.push({ 경로: p, 검사: '공개 경로', 이유: '배포 점검·워크플로 자체를 바꾼다' });
      continue;
    }
    if (!x.버퍼) continue; // 지우는 것은 막지 않는다(잘못 올라간 밑줄 경로·제작 자료를 치울 수 있게)
    const 칸 = p.split('/');
    if (칸.some((s) => s.startsWith('_'))) 걸림.push({ 경로: p, 검사: '공개 경로', 이유: '밑줄로 시작하는 폴더·파일은 Jekyll이 내보내지 않는다(.nojekyll 없음)' });
    else if (칸.some((s) => s.startsWith('.') && s !== '.well-known')) 알림.push({ 경로: p, 검사: '공개 경로', 이유: '점으로 시작하는 경로는 공개 주소로 나가지 않는다' });
    for (const [식, 이름] of 제작자료) {
      if (!식.test(p)) continue;
      const 항 = { 경로: p, 검사: '제작 자료', 이유: `${이름} — 공개 묶음에 넣지 않는다` };
      if (허용.has(p)) 알림.push({ ...항, 이유: `${항.이유} — --허용으로 넘김` }); else 걸림.push(항);
      break;
    }
    // 머리말 없는 .md는 그대로 나간다(10-19 `README.md` 200 text/markdown, blob 같음). 머리말(---) 파일만 Jekyll이 바꾼다.
    if (!이진인가(x.버퍼) && /^---\r?\n/.test(x.버퍼.subarray(0, 8).toString('latin1'))) {
      알림.push({ 경로: p, 검사: '공개 경로', 이유: 'Jekyll 머리말(---)로 시작해 공개 바이트가 저장소와 달라진다 — 바이트 대조에서 뺀다' });
    }
  }
  return { 걸림, 알림, 요약 };
}

/** 공개 주소로 바이트를 대조할 경로인가(Jekyll이 내보내지 않거나 바꾸는 파일은 뺀다) */
function 대조할경로(p, 버퍼) {
  if (p.split('/').some((s) => s.startsWith('_') || (s.startsWith('.') && s !== '.well-known'))) return '공개 주소로 나가지 않는다';
  if (버퍼 && !이진인가(버퍼) && /^---\r?\n/.test(버퍼.subarray(0, 8).toString('latin1'))) return 'Jekyll 머리말 파일';
  return null;
}

const 모듈파일 = (p) => /\.m?js$/i.test(p) && !p.startsWith('.github/') && !/(^|\/)node_modules\//.test(p);

/** 짝 한 줄: 부르는 → 대상: 이름들 */
const 짝글 = (x) => `${x.부르는}${x.판 === '옛' ? '(옛 판)' : ''} → ${x.대상}: ${[...x.이름, ...(x.모듈없음 ? [x.종류 === '②' ? '(지운 모듈)' : '(없는 모듈)'] : [])].join(', ')}`;

/**
 * import 이름 엇갈림(공개 주소 캐시 10분) — 바뀌는 .js·.mjs와 그 모듈을 부르는 공개본 모듈을 lib/import엇갈림.js로 센다.
 * ③은 걸림 — 부르는 쪽 경로를 --허용하면 알림, 아무 파일도 부르지 않는 모듈(루트 app.js 같은 옛 파일)이 부르면 알림.
 * 세지 못하면(오류) ③이 숨을 수 있어 걸림. ①·②는 미리 보기 글에서 나눔을 보인다. 1단계는 --만으로 고를 수 있는 새·바꿈만.
 * 반환 {결과, 걸림, 알림} · 바뀌는 모듈이 없으면 null
 */
function 엇갈림보기({ git, 저장, 옵션, 공개트리, 항목, 공개판, 지금판, 호스트들, 있나, 꼬리들, 부르는가 }) {
  const 바뀐 = [...항목.values()].filter((x) => 모듈파일(x.경로)).map((x) => [x.경로, x.종류]);
  if (!바뀐.length) return null;
  const 모든 = [...new Set([...공개트리.keys(), ...항목.keys()])].filter(모듈파일);
  블롭읽기(git, 저장, 모든.filter((p) => 공개트리.has(p)).map((p) => 공개트리.get(p).oid));
  // 공개본이 그 모듈을 ?v=로 부르던 값 — ① 가운데 처음 쓰는 주소(캐시에 없다)를 가린다. 처음 물을 때 공개본 글 파일을 한 번에 받는다.
  let 공개글 = null;
  const 옛토큰 = new Map();
  const 옛토큰들 = (T) => {
    if (옛토큰.has(T)) return 옛토큰.get(T);
    if (!공개글) {
      공개글 = [...공개트리.keys()].filter((p) => 토큰파일.test(p) && !p.startsWith('.github/'));
      블롭읽기(git, 저장, 공개글.map((p) => 공개트리.get(p).oid));
    }
    const 이름 = Buffer.from(path.posix.basename(T), 'utf8').toString('latin1');
    const 값 = new Set();
    for (const G of 공개글) {
      const b = 공개판(G);
      if (!b || 이진인가(b)) continue;
      const 글 = b.toString('latin1');
      if (!글.includes('?v=') || !글.includes(이름)) continue;
      for (const m of 글.matchAll(토큰찾기)) {
        const r = 참조풀기(G, Buffer.from(m[1], 'latin1').toString('utf8'), 있나, 꼬리들, 호스트들);
        if (r && (r.경로 === T || (r.모호 && r.모호.includes(T)))) 값.add(m[2]);
      }
    }
    옛토큰.set(T, 값);
    return 값;
  };
  const 허용 = new Set((옵션.허용 || []).map((p) => 공개경로(p)));
  let 결과;
  try {
    결과 = 엇갈림.세기({ 바뀐, 옛판: 공개판, 새판: 지금판, 모든경로: 모든, 호스트들, 옛토큰들, 넘김: 허용, 쓰이나: 부르는가 });
  } catch (e) {
    const 이유 = `import 이름 엇갈림을 세지 못했다 — ${e.message} (③이 숨어 있을 수 있어 올리지 않는다 · 도구를 고친다)`;
    return { 결과: { 오류: e.message }, 걸림: [{ 검사: 'import 이름', 이유 }], 알림: [] };
  }
  const 걸림 = [], 알림 = [];
  for (const x of 결과.짝) {
    if (x.종류 !== '③') continue;
    const 항 = { 경로: x.부르는, 검사: 'import 이름', 이유: `③ ${짝글(x)} — 새 판에 없는 것을 부른다(캐시와 상관없이 깨진다)` };
    if (x.안쓰임) 알림.push({ ...항, 이유: `${항.이유} — 이 모듈을 부르는 파일이 없어(안 쓰는 옛 모듈) 알림만 한다. 동적으로 불러 쓰면 깨진다` });
    else if (허용.has(x.부르는)) 알림.push({ ...항, 이유: `${항.이유} — --허용으로 넘김` });
    else 걸림.push({ ...항, 이유: `${항.이유} · 사람이 보고 넘기려면 --허용 ${x.부르는}` });
  }
  const 판이름 = { 옛: '공개본 판', 새: '후보 판', 같음: '모듈' };
  for (const x of 결과.못읽음.slice(0, 10)) 알림.push({ 경로: x.경로, 검사: 'import 이름', 이유: `${판이름[x.판]}을 끝까지 읽지 못했다(${x.이유}) — 이 모듈의 짝은 빠졌을 수 있다` });
  if (결과.못읽음.length > 10) 알림.push({ 검사: 'import 이름', 이유: `끝까지 읽지 못한 모듈이 ${결과.못읽음.length - 10}개 더 있다(--json의 엇갈림.못읽음)` });
  if (결과.나눔) {
    const 먼저 = 결과.나눔['1단계'].filter((p) => ['새', '바꿈'].includes(항목.get(p).종류));
    결과.나눔 = { '1단계': 먼저, '2단계': [...항목.keys()].filter((p) => !먼저.includes(p)).sort(), 남는: 결과.나눔.남는 };
  }
  if (결과.짝.length > 200) Object.assign(결과, { 짝더: 결과.짝.length - 200, 짝: 결과.짝.slice(0, 200) });
  return { 결과, 걸림, 알림 };
}

// ── 계획 ────────────────────────────────────────────────────────────────────

function 계획해시(항목들) {
  const 줄 = [...항목들].sort((a, b) => (a.경로 < b.경로 ? -1 : 1)).map((x) => `${x.경로}\0${x.전 || '-'}\0${x.후 || '-'}\0${x.후 ? x.모드 : '-'}`);
  return sha256(줄.join('\n')).slice(0, 12);
}

/** 바뀐 경로의 최근 공개(남이 고친 지 얼마 안 된 파일을 기준 없이 덮지 않게 보여 준다) */
function 최근공개(git, 위, 경로들, 개수 = 80) {
  const 찾을 = new Set(경로들);
  const 결과 = new Map();
  if (!찾을.size) return 결과;
  const 글 = git(['log', `-n${개수}`, '--no-renames', '--format=%x01%h%x00%ct%x00%s', '--name-only', 위]).toString('utf8');
  for (const 덩이 of 글.split('\x01').slice(1)) {
    const [머리, ...줄] = 덩이.split('\n');
    const [h, t, s] = 머리.split('\0');
    for (const p of 줄) if (p && 찾을.has(p) && !결과.has(p)) 결과.set(p, { 커밋: h, 시각: Number(t) * 1000, 제목: s });
  }
  return 결과;
}

/** 후보를 만든다(커밋하지 않는다). c: {git, 옵션, 입력, 위, 저장} */
function 후보만들기(c) {
  const { git, 옵션, 입력, 위 } = c;
  const 저장 = c.저장 || new Map();
  const 공개트리 = 트리읽기(git, 위);
  const 기준 = 기준읽기(git, 옵션, 저장);
  const 토큰다룸 = !옵션.토큰안함;
  const 항목 = new Map();   // 경로 → {경로, 종류, 전, 후, 모드, 버퍼, 방법, 출처, 토큰}
  const 건너뜀 = [];
  const 걸림 = [];
  const 알림 = [];
  const 더하기 = (x) => 항목.set(x.경로, x);
  // 기준 없이 폴더를 주면 목록만 보이고 멈춘다(남이 공개본을 직접 고친 파일을 덮지 않게)
  const 폴더멈춤 = Boolean(입력.폴더.length && !기준 && !옵션.전부);
  // --만: 항목(올릴·지울) 가운데 그 경로만 — import 엇갈림을 나눠 올리는 1단계. 기준폴더의 지울 것은 고르기 전 목록으로 가린다.
  const 만 = 옵션.만 && 옵션.만.length ? new Set(옵션.만.map((p) => 공개경로(p))) : null;

  // 1) 내 파일
  const 내것 = new Map();
  for (const [p, f] of 입력.올릴) {
    const b = fs.readFileSync(f);
    const oid = 블롭id(b);
    내것.set(p, { 파일: f, 버퍼: b, oid });
    저장.set(oid, b); // 기준·공개본이 같은 blob이면 다시 받지 않는다
  }
  for (const p of 입력.연결) 알림.push({ 경로: p, 검사: '입력', 이유: '연결(junction·symlink) 폴더라 따라가지 않았다' });

  // 2) 글 파일의 공개본·기준 판을 한 번에 받는다(그림·영상은 blob id로만 견준다)
  const 필요 = [];
  for (const [p, m] of 내것) {
    if (이진인가(m.버퍼) || (만 && !만.has(p))) continue;
    const 공 = 공개트리.get(p);
    if (공 && 공.oid !== m.oid) 필요.push(공.oid);
    if (기준 && 기준.종류 === '커밋') { const b = 기준.판(p); if (b && b !== m.oid) 필요.push(b); }
  }
  블롭읽기(git, 저장, 필요);

  // 3) 경로마다 고른다
  for (const [p, m] of 내것) {
    if (만 && !만.has(p)) continue;
    const 공 = 공개트리.get(p) || null;
    const 공oid = 공 ? 공.oid : null;
    const 모드 = 공 ? 공.모드 : '100644';
    const 출처 = m.파일;
    const 글인가 = !이진인가(m.버퍼);
    const 공버퍼 = 공 && 글인가 && 공oid !== m.oid ? 블롭(git, 저장, 공oid) : null;
    const 맞출수 = 토큰다룸 && 토큰파일.test(p) && 공버퍼 && !이진인가(공버퍼);
    let 내버퍼 = m.버퍼, 맞춤 = 0;
    if (맞출수) ({ 버퍼: 내버퍼, 맞춤 } = 토큰맞춤(m.버퍼, 공버퍼));
    const 나oid = 맞춤 ? 블롭id(내버퍼) : m.oid;
    const 덧 = 맞춤 ? ` · ?v= ${맞춤}개 공개본 값으로` : '';
    if (맞춤) 저장.set(나oid, 내버퍼);
    if (공oid === 나oid) { 건너뜀.push({ 경로: p, 이유: 맞춤 ? '?v= 토큰만 공개본과 달랐다(공개본 그대로)' : '이미 공개본과 같다' }); continue; }
    if (공 && 글인가 && !옵션.줄끝도 && 줄끝만다름(공버퍼, 내버퍼)) { 건너뜀.push({ 경로: p, 이유: '줄끝만 다르다(공개본 그대로 · 올리려면 --줄끝도)' }); continue; }
    if (!기준) {
      더하기({ 경로: p, 종류: 공 ? '바꿈' : '새', 전: 공oid, 후: 나oid, 모드, 버퍼: 내버퍼, 방법: `내 판${덧}`, 출처 });
      continue;
    }
    let 기oid = 기준.판(p);
    if (기oid && 맞출수 && 글인가) {
      const 기버퍼 = 블롭(git, 저장, 기oid);
      if (!이진인가(기버퍼)) {
        const r = 토큰맞춤(기버퍼, 공버퍼);
        if (r.맞춤) { 기oid = 블롭id(r.버퍼); 저장.set(기oid, r.버퍼); }
      }
    }
    if (기oid === 나oid) { 건너뜀.push({ 경로: p, 이유: '기준과 같다(내가 바꾸지 않은 파일 — 공개본 그대로)' }); continue; }
    if (공oid === 기oid) {
      더하기({ 경로: p, 종류: 공 ? '바꿈' : '새', 전: 공oid, 후: 나oid, 모드, 버퍼: 내버퍼, 방법: `내 판(기준 뒤 공개본 그대로)${덧}`, 출처 });
      continue;
    }
    if (!공) { 걸림.push({ 경로: p, 검사: '3방향', 이유: '기준 뒤 공개본에서 지워진 파일을 고쳤다' }); continue; }
    if (!기oid) { 걸림.push({ 경로: p, 검사: '3방향', 이유: '새로 만든 파일인데 기준 뒤 공개본에 같은 이름의 다른 파일이 생겼다' }); continue; }
    if (!글인가) { 걸림.push({ 경로: p, 검사: '3방향', 이유: '그림·바이너리 파일을 기준 뒤 공개본에서도 바꿨다 — 손으로 고른다' }); continue; }
    // merge-file은 사본 안의 blob을 읽는다: 내 판·기준 판(폴더·토큰 맞춤)을 써 둔다
    블롭쓰기(git, 저장, 내버퍼);
    블롭쓰기(git, 저장, 블롭(git, 저장, 기oid));
    const r = 세판합치기(git, 저장, 공oid, 기oid, 나oid);
    if (r.문제) { 걸림.push({ 경로: p, 검사: '3방향', 이유: r.문제 }); continue; }
    const oid = 블롭id(r.버퍼);
    if (oid === 공oid) { 건너뜀.push({ 경로: p, 이유: '내 변경이 이미 공개본에 있다(3방향 결과 = 공개본)' }); continue; }
    const 줄끝글 = r.섞임 ? ' · 줄끝이 섞인 판이라 LF로 맞춰 합침' : r.줄끝맞춤 ? ' · 줄끝 맞춰 합침' : '';
    더하기({ 경로: p, 종류: '바꿈', 전: 공oid, 후: oid, 모드, 버퍼: r.버퍼, 방법: `3방향(기준 뒤 남의 변경 보존${줄끝글})${덧}`, 출처 });
  }

  // 4) 지울 것: --지움(폴더는 끝에 /). --기준폴더면 기준 빌드에만 있고 내 빌드에 없는 파일(원고에서 지운 파일)도.
  const 지울것 = new Map(); // 경로 → 직접 줬나
  for (const d of 입력.지울) {
    if (d.endsWith('/')) {
      const 아래 = [...공개트리.keys()].filter((p) => p.startsWith(d));
      if (!아래.length) 건너뜀.push({ 경로: d, 이유: '공개본에 그 폴더가 없다' });
      for (const p of 아래) 지울것.set(p, true);
    } else 지울것.set(d, true);
  }
  if (기준 && 기준.종류 === '폴더') {
    for (const 폴더 of 입력.폴더) for (const p of 기준.아래(폴더.공개)) if (!내것.has(p) && !지울것.has(p)) 지울것.set(p, false);
  }
  if (만) for (const p of 만) if (!내것.has(p) && !지울것.has(p)) throw new 사용법오류(`--만 ${p}: 이번 항목에 올리거나 지울 경로가 아니다`);
  for (const [p, 직접] of 지울것) {
    if (만 && !만.has(p)) continue;
    const 공 = 공개트리.get(p) || null;
    if (!공) { if (직접) 건너뜀.push({ 경로: p, 이유: '이미 공개본에 없다' }); continue; }
    let 덧 = '';
    if (기준) {
      const 기oid = 기준.판(p);
      if (기oid && 기oid !== 공.oid) {
        // 기준 빌드(LF)와 공개본(CRLF·다른 ?v=)이 줄끝·토큰만 다르면 남이 바꾼 것이 아니다 — 3방향과 같은 눈으로 본다
        const 공버퍼 = 블롭(git, 저장, 공.oid), 기버퍼 = 블롭(git, 저장, 기oid);
        const 같은판 = !이진인가(공버퍼) && !이진인가(기버퍼)
          && LF로(토큰파일.test(p) && 토큰다룸 ? 토큰맞춤(기버퍼, 공버퍼).버퍼 : 기버퍼).equals(LF로(공버퍼));
        if (!같은판) { 걸림.push({ 경로: p, 검사: '3방향', 이유: '지우려는 파일을 기준 뒤 공개본에서 남이 바꿨다' }); continue; }
        덧 = ' · 기준과 줄끝·?v=만 다름';
      }
    }
    더하기({ 경로: p, 종류: '지움', 전: 공.oid, 후: null, 모드: 공.모드, 버퍼: null, 방법: `${직접 ? '지움' : '지움(기준 빌드에만 있다)'}${덧}` });
  }

  // 5) 기준 없이 폴더: 공개본에만 있는 파일은 알리기만(지우지 않는다)
  if (!기준 && !만) {
    for (const 폴더 of 입력.폴더) {
      const 남는 = [...공개트리.keys()].filter((p) => p.startsWith(폴더.공개) && !내것.has(p) && !지울것.has(p));
      if (남는.length) 알림.push({ 경로: 폴더.공개, 검사: '입력', 이유: `공개본에만 있는 파일 ${남는.length}개는 그대로 둔다(지우려면 --지움)`, 예: 남는.slice(0, 5) });
    }
  }

  // 6) ?v= 토큰 갱신
  const 있는경로 = new Set(공개트리.keys());
  for (const x of 항목.values()) { if (x.후) 있는경로.add(x.경로); else 있는경로.delete(x.경로); }
  const 호스트들 = new Set(['synk.im', 'www.synk.im']);
  try { 호스트들.add(new URL(옵션.주소 || 기본주소).host.toLowerCase()); } catch (_) { /* 그대로 */ }
  let 꼬리목록 = null;
  const 꼬리들 = (꼬리) => {
    if (!꼬리목록) 꼬리목록 = [...있는경로].filter((p) => !p.startsWith('.github/'));
    return 꼬리목록.filter((p) => p === 꼬리 || p.endsWith(`/${꼬리}`));
  };
  const 풀경로 = new Set([...공개트리.keys(), ...항목.keys()]);
  const 있나 = (p) => 풀경로.has(p);
  const 공개판 = (p) => (공개트리.has(p) ? 블롭(git, 저장, 공개트리.get(p).oid) : null);
  const 지금판 = (p) => (항목.has(p) ? 항목.get(p).버퍼 : 공개판(p));
  // 공개 글 파일(토큰을 고치고 「누가 부르나」를 찾는 범위) — 처음 쓸 때 공개본 판을 한 번에 받는다
  const 훑을 = [...있는경로].filter((p) => 토큰파일.test(p) && !p.startsWith('.github/') && !/(^|\/)node_modules\//.test(p));
  let 훑을받음 = false;
  const 훑을받기 = () => {
    if (훑을받음) return;
    훑을받음 = true;
    블롭읽기(git, 저장, 훑을.filter((p) => !항목.has(p)).map((p) => 공개트리.get(p).oid));
  };
  // F를 부르는 파일이 하나라도 있나(?v= 갱신·import ③에서 쓴다): 공개 글 파일에서 따옴표·괄호·= 뒤에 F의 이름으로 끝나는 참조를
  // 찾아 풀어 본다(주석 속 낱말 「app.js and sites.js」는 참조가 아니다 — 10-19 site-bar.js)
  const 부름 = new Map();
  const 부르는가 = (F) => {
    if (부름.has(F)) return 부름.get(F);
    훑을받기();
    const 이름 = Buffer.from(path.posix.basename(F), 'utf8').toString('latin1');
    const 이름식 = 이름.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const 식 = new RegExp('(?<=["\'`(=])([^\\s"\'`()<>?#={}[\\]\\\\,;|]*' + 이름식 + ')(?=[?#"\'`)\\s>]|$)', 'g');
    let 답 = false;
    for (const G of 훑을) {
      if (G === F) continue;
      const b = 지금판(G);
      if (!b || 이진인가(b)) continue;
      const 글 = b.toString('latin1');
      if (!글.includes(이름)) continue;
      for (const m of 글.matchAll(식)) {
        const r = 참조풀기(G, Buffer.from(m[1], 'latin1').toString('utf8'), 있나, 꼬리들, 호스트들);
        if (r && (r.경로 === F || (r.모호 && r.모호.includes(F)))) { 답 = true; break; }
      }
      if (답) break;
    }
    부름.set(F, 답);
    return 답;
  };
  const 토큰기록 = [];
  if (토큰다룸 && 항목.size) {
    훑을받기();
    const 처음바뀜 = new Map([...항목.values()].filter((x) => x.후).map((x) => [x.경로, x.버퍼]));
    const 지움 = new Set([...항목.values()].filter((x) => !x.후).map((x) => x.경로));
    const 받아두기 = (경로들) => 블롭읽기(git, 저장, 경로들.map((p) => 공개트리.get(p)).filter(Boolean).map((v) => v.oid));
    const 고침 = 토큰고치기({ 훑을, 원래: 지금판, 공개: 공개판, 처음바뀜, 지움, 있나, 꼬리들, 호스트들, 정한값: 옵션.토큰, 부르는가, 받아두기 });
    for (const [F, v] of 고침) {
      const oid = 블롭id(v.버퍼);
      토큰기록.push({ 경로: F, 바꿈: v.바꿈 });
      if (항목.has(F)) {
        const x = 항목.get(F);
        Object.assign(x, { 버퍼: v.버퍼, 후: oid, 방법: `${x.방법} · ?v= ${v.바꿈.length}개 갱신`, 토큰: v.바꿈 });
      } else {
        const 공 = 공개트리.get(F);
        더하기({ 경로: F, 종류: '토큰', 전: 공.oid, 후: oid, 모드: 공.모드, 버퍼: v.버퍼, 방법: `?v= ${v.바꿈.length}개 갱신`, 토큰: v.바꿈 });
      }
    }
    for (const r of 고침.지운참조 || []) 알림.push({ 경로: r.파일, 검사: '?v=', 이유: `지우는 파일을 부른다: ${r.참조}` });
    const 안부름별 = new Map();
    for (const r of 고침.안부름 || []) { if (!안부름별.has(r.파일)) 안부름별.set(r.파일, new Set()); 안부름별.get(r.파일).add(r.대상); }
    for (const [파일, 대상들] of 안부름별) {
      알림.push({ 경로: 파일, 검사: '?v=', 이유: `어느 파일도 부르지 않는 파일이라 바뀐 ${[...대상들].slice(0, 3).join(', ')}${대상들.size > 3 ? ' …' : ''}의 토큰을 안 고쳤다(쓰는 파일이면 부르는 곳을 확인하고 그 파일을 올린다)` });
    }
    for (const r of 고침.모호 || []) {
      알림.push({ 경로: r.파일, 검사: '?v=', 이유: `「${r.참조}」가 가리킬 수 있는 파일이 ${r.후보}개라 토큰을 안 고쳤다(바뀐 것: ${r.바뀐후보.slice(0, 3).join(', ')}) — 손으로 맞춘다` });
    }
    const 바뀐대상 = new Set([...항목.values()].filter((x) => x.후 && /\.(css|m?js)$/i.test(x.경로)).map((x) => x.경로));
    const html들 = [...있는경로].filter((p) => /\.html?$/i.test(p) && !p.startsWith('.github/'));
    const 없는 = 토큰없는참조(html들, 지금판, 바뀐대상, 있나, 꼬리들, 호스트들);
    const 대상별 = new Map();
    for (const r of 없는) { if (!대상별.has(r.대상)) 대상별.set(r.대상, new Set()); 대상별.get(r.대상).add(r.파일); }
    for (const [대상, 파일들] of 대상별) {
      const 목록글 = [...파일들];
      알림.push({ 경로: 대상, 검사: '?v=', 이유: `토큰 없이 부르는 곳 ${목록글.length}곳(브라우저·CDN이 옛 판을 쓸 수 있다): ${목록글.slice(0, 3).join(', ')}${목록글.length > 3 ? ' …' : ''}` });
    }
  }

  // 7) 검사(배포 점검 규칙은 후보 판의 check.mjs에서 읽는다)
  const 점검글 = (() => {
    const 판 = 지금판('.github/site-check/check.mjs');
    return 판 ? 판.toString('utf8') : null;
  })();
  const 규칙 = 점검규칙읽기(점검글);
  if (규칙.출처 !== '.github/site-check/check.mjs') 알림.push({ 검사: '도구 이름', 이유: '배포 점검 규칙(check.mjs)을 못 읽어 도구에 든 사본 규칙으로 봤다' });
  const 검사대상 = [...항목.values()].map((x) => ({ 경로: x.경로, 버퍼: x.버퍼, 공개버퍼: x.전 && x.버퍼 && !이진인가(x.버퍼) ? 블롭(git, 저장, x.전) : null }));
  const 검사 = 검사하기(검사대상, 규칙, 옵션);
  걸림.push(...검사.걸림);
  알림.push(...검사.알림);

  // 8) import 이름 엇갈림(공개 주소 캐시 10분) — 바뀌는 .js·.mjs가 있을 때만
  const 이름엇갈림 = 엇갈림보기({ git, 저장, 옵션, 공개트리, 항목, 공개판, 지금판, 호스트들, 있나, 꼬리들, 부르는가 });
  if (이름엇갈림) { 걸림.push(...이름엇갈림.걸림); 알림.push(...이름엇갈림.알림); }

  // 9) 기준 없이 덮는 파일을 하루 안에 남이 고쳤으면 알린다(그 판에서 만든 파일이 아니면 --기준으로 3방향)
  if (!기준) {
    // 「새」도 본다: 하루 안에 남이 지운 파일을 기준 없이 다시 올리는 것일 수 있다
    const 덮을 = [...항목.values()].filter((x) => x.종류 === '바꿈' || x.종류 === '새').map((x) => x.경로);
    const 최근 = 최근공개(git, 위, 덮을);
    const 위시각 = 커밋요약(git, 위).시각;
    const 커밋별 = new Map();
    for (const [p, r] of 최근) {
      if (위시각 - r.시각 >= 24 * 3600 * 1000) continue;
      if (!커밋별.has(r.커밋)) 커밋별.set(r.커밋, { r, 파일: [] });
      커밋별.get(r.커밋).파일.push(p);
    }
    for (const { r, 파일 } of 커밋별.values()) {
      알림.push({
        경로: 파일.length === 1 ? 파일[0] : `${파일.length}개 파일`, 검사: '덮어쓰기',
        이유: `${짧게(r.커밋)}(${시각글(r.시각)} KST · ${r.제목.slice(0, 50)})가 고치거나 지운 경로를 덮는다 — 내 파일이 그 판 뒤에 만든 것이 아니면 --기준 <커밋>으로 3방향`,
        ...(파일.length > 1 ? { 예: 파일.slice(0, 5) } : {}),
      });
    }
  }

  const 목록들 = [...항목.values()].sort((a, b) => (a.경로 < b.경로 ? -1 : 1));
  return {
    위, 항목: 목록들, 건너뜀, 걸림, 알림, 토큰: 토큰기록, 검사: 검사.요약, 규칙출처: 규칙.출처,
    엇갈림: 이름엇갈림 ? 이름엇갈림.결과 : null,
    기준: 기준 ? (기준.종류 === '커밋' ? { 커밋: 기준.커밋 } : { 폴더: 기준.폴더 }) : null,
    폴더멈춤, 계획: 계획해시(목록들), 저장,
  };
}

/** 커밋에 넣을 새 blob을 사본에 쓴다(미리 보기에서는 쓰지 않는다). */
function 블롭들쓰기(git, 저장, 항목들) {
  const 쓸 = 항목들.filter((x) => x.후);
  if (!쓸.length) return;
  const 있음 = new Set(git(['cat-file', '--batch-check'], { input: `${쓸.map((x) => x.후).join('\n')}\n` }).toString('utf8')
    .split('\n').filter((l) => / blob \d+$/.test(l)).map((l) => l.split(' ')[0]));
  for (const x of 쓸) if (!있음.has(x.후)) { 블롭쓰기(git, 저장, x.버퍼); 있음.add(x.후); }
}

/** 별도 인덱스에서 커밋을 만든다(사본의 어떤 가지도 움직이지 않는다). */
function 커밋만들기(git, 위, 항목들, 메시지, 작성자) {
  const 파일 = path.join(os.tmpdir(), `synk-publish-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.index`);
  const env = { GIT_INDEX_FILE: 파일 };
  try {
    git(['read-tree', 위], { env });
    const 줄 = 항목들.map((x) => (x.후 ? `${x.모드} ${x.후}\t${x.경로}` : `0 ${영oid}\t${x.경로}`));
    git(['update-index', '-z', '--index-info'], { env, input: `${줄.join('\0')}\0` });
    const 트리 = git.글(['write-tree', '--missing-ok'], { env });
    // 지킴: 바탕과 트리의 차이가 계획과 정확히 같다
    const 바뀜 = 날차이읽기(git(['diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', `${위}^{tree}`, 트리]));
    const 기대 = new Map(항목들.map((x) => [x.경로, x.후]));
    if (바뀜.length !== 기대.size || 바뀜.some((e) => !기대.has(e.경로) || 기대.get(e.경로) !== e.새)) {
      throw new 멈춤('만든 트리의 차이가 계획과 다르다 — 커밋하지 않았다', { 차이: 바뀜.map((e) => e.경로).slice(0, 10) });
    }
    const 지금 = new Date().toISOString();
    const 커밋 = git.글(['commit-tree', 트리, '-p', 위, '-F', '-'], {
      input: Buffer.from(`${메시지.replace(/\s+$/, '')}\n`, 'utf8'),
      env: { GIT_AUTHOR_NAME: 작성자.이름, GIT_AUTHOR_EMAIL: 작성자.메일, GIT_COMMITTER_NAME: 작성자.이름, GIT_COMMITTER_EMAIL: 작성자.메일, GIT_AUTHOR_DATE: 지금, GIT_COMMITTER_DATE: 지금 },
    });
    return { 트리, 커밋 };
  } finally {
    fs.rmSync(파일, { force: true });
    fs.rmSync(`${파일}.lock`, { force: true });
  }
}

function 후보폴더쓰기(폴더, 후보) {
  const 뿌리 = path.resolve(폴더);
  if (fs.existsSync(뿌리) && fs.readdirSync(뿌리).length) {
    // 이 도구가 전에 써 둔 후보 폴더(후보.json에 적힌 파일만 있음)면 비우고 다시 쓴다. 다른 파일이 섞였으면 멈춘다.
    let 전 = null;
    try { 전 = JSON.parse(fs.readFileSync(path.join(뿌리, '후보.json'), 'utf8')); } catch (_) { /* 우리 폴더가 아니다 */ }
    const 적힌 = new Set(전 && Array.isArray(전.항목) ? [...전.항목.map((x) => x.경로), '후보.json'] : []);
    const 있는 = 폴더걷기(뿌리);
    if (!전 || 있는.연결.length || 있는.파일.some((f) => !적힌.has(f))) throw new 멈춤(`--후보폴더가 비어 있지 않다(이 도구가 쓴 후보 폴더가 아니다): ${뿌리}`);
    fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 });
  }
  for (const x of 후보.항목) {
    if (!x.버퍼) continue;
    const f = path.join(뿌리, ...x.경로.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, x.버퍼);
  }
  fs.mkdirSync(뿌리, { recursive: true });
  const 기록 = { 위: 후보.위, 계획: 후보.계획, 항목: 후보.항목.map((x) => ({ 경로: x.경로, 종류: x.종류, sha256: x.버퍼 ? sha256(x.버퍼) : null, 크기: x.버퍼 ? x.버퍼.length : 0 })) };
  fs.writeFileSync(path.join(뿌리, '후보.json'), `${JSON.stringify(기록, null, 1)}\n`);
  return 뿌리;
}

// ── 공개 주소 받기 ──────────────────────────────────────────────────────────

const 주소로 = (바탕, p) => `${바탕.replace(/\/$/, '')}/${p.split('/').map(encodeURIComponent).join('/')}`;

/** curl로 받는다(Node fetch가 synk.im 인증서를 거절한 적이 있다). 반환 {상태, 버퍼, 머리} */
function curl받기(주소, { 몸 = true, 캐시없이 = true, 시간 = 180 } = {}) {
  return new Promise((resolve) => {
    const 임시 = path.join(os.tmpdir(), `synk-publish-get-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
    const args = ['-sS', '-L', '--max-time', String(시간), '-o', 몸 ? `${임시}.body` : (process.platform === 'win32' ? 'NUL' : '/dev/null'), '-D', `${임시}.head`, '-w', '%{http_code}'];
    if (!몸) args.push('-I');
    if (캐시없이) args.push('-H', 'Cache-Control: no-cache', '-H', 'Pragma: no-cache');
    args.push(주소);
    const child = spawn('curl', args, { windowsHide: true });
    let 출력 = '', 오류 = '';
    child.stdout.on('data', (d) => { 출력 += d; });
    child.stderr.on('data', (d) => { 오류 += d; });
    child.on('error', (e) => resolve({ 상태: 0, 오류: e.message }));
    child.on('close', () => {
      const 상태 = Number(출력.trim().slice(-3)) || 0;
      let 버퍼 = null, 머리 = '';
      try { if (몸) 버퍼 = fs.readFileSync(`${임시}.body`); } catch (_) { 버퍼 = 몸 ? Buffer.alloc(0) : null; }
      try { 머리 = fs.readFileSync(`${임시}.head`, 'latin1'); } catch (_) { /* 없음 */ }
      fs.rmSync(`${임시}.body`, { force: true });
      fs.rmSync(`${임시}.head`, { force: true });
      resolve({ 상태, 버퍼, 머리, ...(오류.trim() ? { 오류: 오류.trim().slice(0, 200) } : {}) });
    });
  });
}

const 머리값 = (머리, 이름) => {
  const 묶음 = 머리.split(/\r?\n\r?\n/).filter((x) => x.trim());
  const 끝 = 묶음[묶음.length - 1] || '';
  const m = new RegExp(`^${이름}:\\s*(.*)$`, 'im').exec(끝);
  return m ? m[1].trim() : null;
};

async function 풀어서(일들, 동시, 하기) {
  const 결과 = new Array(일들.length);
  let 다음 = 0;
  await Promise.all(Array.from({ length: Math.min(동시, 일들.length) }, async () => {
    while (다음 < 일들.length) { const i = 다음++; 결과[i] = await 하기(일들[i], i); }
  }));
  return 결과;
}

/**
 * 공개 주소 바이트 대조. 대상: [{경로, oid(git blob id)|null(지움), 크기|null}]. 받은 바이트의 git blob id가 커밋의 blob과 같아야 한다
 * (그래서 확인할 때 큰 blob을 사본에 받지 않아도 된다). 다 같아지거나 기한이 지날 때까지 다시 받는다.
 * 크기를 아는 큰 파일은 먼저 Content-Length를 보고 크기가 맞을 때만 몸을 받는다.
 */
async function 바이트대조(대상, { 주소 = 기본주소, 기다림ms = 12 * 60 * 1000, 간격ms = 20000, 받기 = curl받기, 알리기 = () => {} } = {}) {
  const 남은 = new Map(대상.map((x) => [x.경로, x]));
  const 마지막 = new Map();
  const 시작 = Date.now();
  for (let 바퀴 = 1; ; 바퀴++) {
    await 풀어서([...남은.values()], 6, async (x) => {
      const u = `${주소로(주소, x.경로)}?probe=${crypto.randomBytes(6).toString('hex')}`;
      if (x.oid && x.크기 > 8 * 1024 * 1024) {
        const h = await 받기(u, { 몸: false });
        const 길이 = Number(머리값(h.머리 || '', 'content-length'));
        if (h.상태 !== 200 || (길이 && 길이 !== x.크기)) { 마지막.set(x.경로, { 상태: h.상태, 크기: 길이 || null }); return; }
      }
      // 공개 직후 CDN이 비면 원본에서 초당 200KB쯤 온다 — 큰 파일은 크기에 맞춰 기다린다(크기를 모르면 10분)
      const r = await 받기(u, { 시간: x.크기 ? Math.max(180, Math.ceil(x.크기 / (100 * 1024)) + 60) : 600 });
      const 같음 = x.oid ? r.상태 === 200 && 블롭id(r.버퍼 || Buffer.alloc(0)) === x.oid : r.상태 === 404;
      if (같음) 남은.delete(x.경로);
      else 마지막.set(x.경로, { 상태: r.상태, 크기: r.버퍼 ? r.버퍼.length : null, ...(r.오류 ? { 오류: r.오류 } : {}) });
    });
    알리기(`${new Date().toISOString().slice(11, 19)} 같음 ${대상.length - 남은.size}/${대상.length}`);
    if (!남은.size) return { 통과: true, 같음: 대상.length, 전체: 대상.length, 바퀴, 초: Math.round((Date.now() - 시작) / 1000) };
    if (Date.now() - 시작 + 간격ms > 기다림ms) {
      return {
        통과: false, 같음: 대상.length - 남은.size, 전체: 대상.length, 바퀴, 초: Math.round((Date.now() - 시작) / 1000),
        다름: [...남은.values()].map((x) => ({ 경로: x.경로, 기대: x.oid ? `200 · blob ${짧게(x.oid)}${x.크기 != null ? ` · ${x.크기}바이트` : ''}` : '404', ...마지막.get(x.경로) })),
      };
    }
    await 잠깐(간격ms);
  }
}

// ── 배포 점검(GitHub Actions) ──────────────────────────────────────────────

function gh실행(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new 멈춤(`gh를 못 돌렸다 — ${r.error.message}`);
  if (r.status !== 0) throw new 멈춤(`gh ${args.slice(0, 3).join(' ')} 실패 — ${String(r.stderr).trim().slice(0, 300)}`);
  return r.stdout;
}

/**
 * 내 커밋(또는 그 뒤 커밋)의 배포 점검 결과를 기다린다. 뒤 push가 앞 실행을 취소하면(concurrency) 내 커밋을 품은 다음 실행을 본다.
 * 내 커밋을 품은 실행 하나라도 성공으로 끝나면 통과. 아직 도는 실행이 없고 가장 늦은 실행이 실패로 끝났으면 실패
 * (--재실행이고 바이트 대조가 통과했으면 실패 작업만 한 번 다시 돌리고 그 시도를 기다린다).
 * 반환 {결과: '통과'|'실패'|'기다림 끝'|'못 찾음', 실행, 커밋, 실패단계, 재실행}
 */
async function 점검기다리기(git, 커밋, { 저장소이름 = 기본저장소이름, 기다림ms = 25 * 60 * 1000, 간격ms = 30000, 재실행 = false, 바이트통과 = false, gh = gh실행, 알리기 = () => {} } = {}) {
  const 시작 = Date.now();
  let 다시돌림 = null; // {실행, 시도}
  let 받은때 = 0;
  const 있나 = (sha) => git.돌리기(['cat-file', '-e', `${sha}^{commit}`], { 허용: null }).status === 0;
  for (;;) {
    let 실행들;
    try {
      실행들 = JSON.parse(gh(['run', 'list', '-R', 저장소이름, '--workflow', 'site-check.yml', '-L', '30', '--json', 'databaseId,headSha,status,conclusion,createdAt,url,attempt']));
    } catch (e) {
      return { 결과: '못 찾음', 이유: e.이유 || e.message };
    }
    // 내 커밋을 품은 실행만: 그 커밋이거나 그 뒤 커밋(사본에 아직 없으면 한 번 받아 본다)
    if (실행들.some((r) => r.headSha !== 커밋 && !있나(r.headSha)) && Date.now() - 받은때 > 60000) {
      try { await 받아오기(git); } catch (_) { /* 다음 바퀴에 */ }
      받은때 = Date.now();
    }
    const 품은 = 실행들.filter((r) => r.headSha === 커밋 || (있나(r.headSha) && 조상인가(git, 커밋, r.headSha)))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    // 다시 돌린 실행은 새 시도가 끝나야 끝난 것으로 본다
    const 끝남 = (r) => r.status === 'completed' && !(다시돌림 && r.databaseId === 다시돌림.실행 && Number(r.attempt || 0) <= 다시돌림.시도);
    const 성공 = 품은.filter((r) => 끝남(r) && r.conclusion === 'success').pop();
    if (성공) {
      return { 결과: '통과', 실행: 성공.databaseId, 주소: 성공.url, 커밋: 성공.headSha, ...(성공.headSha !== 커밋 ? { 뒤커밋: true } : {}), ...(다시돌림 ? { 재실행: 다시돌림.실행 } : {}) };
    }
    const 산 = 품은.filter((r) => !(끝남(r) && ['cancelled', 'skipped'].includes(r.conclusion)));
    const 대상 = 산[산.length - 1] || null;
    const 도는중 = 산.some((r) => !끝남(r));
    if (대상 && 끝남(대상) && !도는중) {
      const 실패단계 = 실패단계읽기(gh, 저장소이름, 대상.databaseId);
      if (재실행 && !다시돌림 && 바이트통과) {
        try {
          gh(['run', 'rerun', String(대상.databaseId), '-R', 저장소이름, '--failed']);
        } catch (e) {
          return { 결과: '실패', 실행: 대상.databaseId, 주소: 대상.url, 커밋: 대상.headSha, 결론: 대상.conclusion, 실패단계, 재실행오류: e.이유 || e.message };
        }
        다시돌림 = { 실행: 대상.databaseId, 시도: Number(대상.attempt || 1) };
        알리기(`배포 점검 ${대상.databaseId} 실패(${실패단계.join(', ') || '단계 모름'}) — 실패 작업을 한 번 다시 돌린다`);
        await 잠깐(간격ms);
        continue;
      }
      return { 결과: '실패', 실행: 대상.databaseId, 주소: 대상.url, 커밋: 대상.headSha, 결론: 대상.conclusion, 실패단계, ...(다시돌림 ? { 재실행: 다시돌림.실행 } : {}) };
    }
    if (Date.now() - 시작 + 간격ms > 기다림ms) {
      return {
        결과: 품은.length ? '기다림 끝' : '못 찾음',
        이유: 품은.length ? '아직 끝나지 않았다' : '내 커밋을 품은 배포 점검 실행이 없다',
        실행: 대상 ? 대상.databaseId : null, 상태: 대상 ? `${대상.status}/${대상.conclusion || '-'}` : null,
      };
    }
    알리기(`배포 점검 ${대상 ? `${대상.databaseId} ${대상.status}` : '실행 기다림'}`);
    await 잠깐(간격ms);
  }
}

function 실패단계읽기(gh, 저장소이름, 실행) {
  try {
    const j = JSON.parse(gh(['run', 'view', String(실행), '-R', 저장소이름, '--json', 'jobs']));
    return (j.jobs || []).flatMap((job) => (job.steps || []).filter((s) => s.conclusion === 'failure').map((s) => s.name));
  } catch (_) {
    return [];
  }
}

// ── 명령 ────────────────────────────────────────────────────────────────────

function 결과요약(후보) {
  const { 저장, ...나머지 } = 후보;
  return { ...나머지, 항목: 후보.항목.map(({ 버퍼, ...x }) => ({ ...x, 크기: 버퍼 ? 버퍼.length : 0 })) };
}

/** 올리기. 옵션: 항목[]·원본·공개폴더·지움[]·기준·기준폴더·전부·줄끝도·토큰·토큰안함·허용[]·후보폴더·위에·실행·계획·메시지·사본·새사본·원격주소·주소… */
async function 올리기(옵션 = {}) {
  const 입력 = 항목모으기(옵션);
  if (!입력.올릴.size && !입력.지울.length) throw new 사용법오류('올리거나 지울 항목을 준다');
  if (옵션.실행 && 옵션.위에) throw new 사용법오류('--위에는 미리 보기(지난 공개 재현)에만 쓴다');
  if (옵션.실행 && !옵션.계획) throw new 사용법오류('--실행에는 미리 보기가 보인 --계획 <해시>가 필요하다');
  if (옵션.실행 && !(옵션.메시지 || '').trim()) throw new 사용법오류('--실행에는 커밋 메시지(-m 또는 -F)가 필요하다');
  const 알리기 = 옵션.알리기 || (() => {});
  let 사본 = null;
  try {
    사본 = 사본열기(옵션);
    const { git } = 사본;
    const 저장 = new Map();
    for (let 차례 = 1; 차례 <= 3; 차례++) {
      const 원격머리 = await 받아오기(git);
      const 위 = 옵션.위에 ? git.글(['rev-parse', '--verify', `${옵션.위에}^{commit}`]) : 원격머리;
      const 후보 = 후보만들기({ git, 옵션, 입력, 위, 저장 });
      const 요약 = { ...결과요약(후보), 위요약: 커밋요약(git, 위), 사본: 사본.폴더, ...(차례 > 1 ? { 다시한수: 차례 - 1 } : {}) };
      if (후보.폴더멈춤) return { 결과: '멈춤', 이유: '기준(--기준·--기준폴더) 없이 폴더를 줬다 — 남이 공개본을 직접 고친 파일까지 덮을 수 있어 목록만 보인다(모두 올리려면 --전부)', ...요약 };
      if (후보.걸림.length) return { 결과: '걸림', 이유: '검사에 걸렸다 — 아무것도 올리지 않았다', ...요약 };
      if (!후보.항목.length) return { 결과: '올릴 것 없음', 이유: '바뀌는 파일이 없다', ...요약 };
      if (옵션.후보폴더 && 차례 === 1 && !옵션.실행) 요약.후보폴더 = 후보폴더쓰기(옵션.후보폴더, 후보);
      if (!옵션.실행) return { 결과: '미리 보기', ...요약 };
      if (옵션.계획 !== 후보.계획) {
        return { 결과: '멈춤', 이유: `계획이 미리 보기와 다르다(${옵션.계획} → ${후보.계획}) — 그사이 공개본이나 내 파일이 바뀌었다. 미리 보기를 다시 보고 승인받는다`, ...요약 };
      }
      const 작성자 = 옵션.작성자 || 기본작성자;
      블롭들쓰기(git, 저장, 후보.항목);
      const { 커밋 } = 커밋만들기(git, 위, 후보.항목, 옵션.메시지, 작성자);
      // 커밋 직전·push 직전에 origin/main이 그대로인지 다시 본다(움직였으면 새 판 위에서 처음부터)
      if (await 받아오기(git) !== 위) { 알리기('origin/main이 움직여 새 판 위에서 다시 만든다'); continue; }
      if (옵션._밀기전) await 옵션._밀기전();
      const p = git.돌리기(['push', '--porcelain', 'origin', `${커밋}:refs/heads/main`], { 허용: null });
      const 출력 = `${p.stdout}\n${p.stderr}`;
      if (p.status !== 0) {
        if (/non-fast-forward|fetch first|\[rejected\]|stale info/.test(출력) && 차례 < 3) { 알리기('push가 거절돼(그새 남이 올림) 다시 만든다'); continue; }
        return { 결과: '멈춤', 이유: `push가 거절됐다 — ${출력.trim().split('\n').slice(-3).join(' / ')}`, 커밋, ...요약 };
      }
      const r = { 결과: '올림', 커밋, ...요약 };
      try {
        r.원격머리 = git.글(['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0];
        await 받아오기(git);
      } catch (e) { r.주의 = `push는 됐지만 ls-remote로 다시 보지 못했다 — ${e.message}`; }
      // push 뒤: 바이트 대조 → 배포 점검
      r.대조뺌 = 후보.항목.map((x) => ({ 경로: x.경로, 이유: 대조할경로(x.경로, x.버퍼) })).filter((x) => x.이유);
      const 대조대상 = 후보.항목.filter((x) => !대조할경로(x.경로, x.버퍼)).map((x) => ({ 경로: x.경로, oid: x.후, 크기: x.버퍼 ? x.버퍼.length : null }));
      // 여기부터는 push가 끝난 뒤다 — 확인에서 무슨 일이 나도 결과는 「올림」 쪽으로 커밋을 남겨 돌려준다
      try {
        r.확인 = await 올린뒤확인(git, 커밋, 대조대상, 옵션);
      } catch (e) {
        r.확인 = { 통과: false, 오류: e.이유 || e.message };
      }
      if (!r.확인.통과) r.결과 = '올림·확인 덜 됨';
      return r;
    }
    return { 결과: '멈춤', 이유: 'origin/main이 계속 움직여 세 번 모두 올리지 못했다' };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  } finally {
    if (사본) 사본.치우기();
  }
}

/**
 * 내 커밋이 origin/main에 들어 있고 그 뒤 커밋이 같은 경로를 다시 바꿨으면, 그 경로는 지금 main 판으로 대조한다
 * (Pages는 main 머리를 내준다). 반환: 고친 대상과 뒤에 바뀐 경로 목록.
 */
function 뒤판으로(git, 커밋, 대상) {
  let 머리;
  try { 머리 = git.글(['rev-parse', '--verify', `${추적}^{commit}`]); } catch (_) { return { 대상, 뒤바뀜: [] }; }
  if (머리 === 커밋 || !조상인가(git, 커밋, 머리)) return { 대상, 뒤바뀜: [] };
  const 지금 = 트리읽기(git, 머리);
  const 뒤바뀜 = [];
  const 고친 = 대상.map((x) => {
    const 판 = 지금.get(x.경로);
    const oid = 판 ? 판.oid : null;
    if (oid === x.oid) return x;
    뒤바뀜.push(x.경로);
    return { 경로: x.경로, oid, 크기: null };
  });
  return { 대상: 고친, 뒤바뀜, 머리 };
}

async function 올린뒤확인(git, 커밋, 대조대상, 옵션) {
  const 알리기 = 옵션.알리기 || (() => {});
  const 분 = (v, 기본) => (v == null ? 기본 : Number(v)) * 60 * 1000;
  const 간격ms = (옵션.간격 == null ? 20 : Number(옵션.간격)) * 1000;
  const 뒤 = 뒤판으로(git, 커밋, 대조대상);
  대조대상 = 뒤.대상;
  const 대조 = 대조대상.length
    ? await 바이트대조(대조대상, { 주소: 옵션.주소 || 기본주소, 기다림ms: 분(옵션.기다림, 12), 간격ms, 받기: 옵션.받기 || curl받기, 알리기 })
    : { 통과: true, 같음: 0, 전체: 0, 바퀴: 0, 초: 0 };
  let 점검 = null;
  if (!옵션.점검안함) {
    // 실제 gh는 30초보다 자주 묻지 않는다(시험의 가짜 gh는 --간격 그대로)
    점검 = await 점검기다리기(git, 커밋, {
      저장소이름: 옵션.저장소이름 || 기본저장소이름, 기다림ms: 분(옵션.점검기다림, 25), 간격ms: 옵션.gh ? 간격ms : Math.max(간격ms, 30000),
      재실행: Boolean(옵션.재실행), 바이트통과: 대조.통과, gh: 옵션.gh || gh실행, 알리기,
    });
  }
  return { 통과: 대조.통과 && (!점검 || 점검.결과 === '통과'), 대조: { ...대조, ...(뒤.뒤바뀜.length ? { 뒤바뀜: 뒤.뒤바뀜, 뒤머리: 뒤.머리 } : {}) }, 점검 };
}

/** 확인: 이미 올라간 커밋(남의 공개도 된다)의 바뀐 파일을 공개 주소와 대조하고 배포 점검을 기다린다. */
async function 확인(옵션 = {}) {
  if (!옵션.커밋) throw new 사용법오류('확인할 커밋을 준다');
  let 사본 = null;
  try {
    사본 = 사본열기(옵션);
    const { git } = 사본;
    const 원격머리 = await 받아오기(git);
    const r = git.돌리기(['rev-parse', '--verify', '-q', `${옵션.커밋}^{commit}`], { 허용: null });
    if (r.status !== 0) throw new 멈춤(`커밋을 사본에서 못 찾았다: ${옵션.커밋}`);
    const 커밋 = r.stdout.toString('utf8').trim();
    const 들어감 = 조상인가(git, 커밋, 원격머리);
    const 바뀜 = 커밋바뀜(git, 커밋, 옵션.부터 ? git.글(['rev-parse', '--verify', `${옵션.부터}^{commit}`]) : null);
    // 대조는 git blob id로 하므로 큰 그림·영상 blob은 받지 않는다. Jekyll 머리말을 보려고 글 파일만 받는다.
    const 저장 = new Map();
    const 글파일 = (p) => /\.(html?|css|m?js|json|txt|xml|svg|webmanifest)$/i.test(p);
    블롭읽기(git, 저장, 바뀜.filter((e) => e.새 && 글파일(e.경로)).map((e) => e.새));
    const 빠짐 = [];
    const 대상 = [];
    for (const e of 바뀜) {
      const b = e.새 && 글파일(e.경로) ? 블롭(git, 저장, e.새) : null;
      const 이유 = 대조할경로(e.경로, b);
      if (이유) { 빠짐.push({ 경로: e.경로, 이유 }); continue; }
      대상.push({ 경로: e.경로, oid: e.새, 크기: b ? b.length : null });
    }
    const 결과 = await 올린뒤확인(git, 커밋, 대상, 옵션);
    return { 결과: 결과.통과 ? '확인함' : '확인 덜 됨', 커밋, 요약: 커밋요약(git, 커밋), main에있음: 들어감, 빠짐, ...결과 };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  } finally {
    if (사본) 사본.치우기();
  }
}

/** 공개 경로 glob: `*`는 한 칸 안, `**`는 여러 칸 */
function glob식(g) {
  const 칸들 = g.split('/');
  const 식 = 칸들.map((칸, i) => {
    const 끝 = i === 칸들.length - 1;
    if (칸 === '**') return 끝 ? '.*' : '(?:[^/]+/)*';
    return `${칸.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}${끝 ? '' : '/'}`;
  }).join('');
  return new RegExp(`^${식}$`);
}

/** 채우기: 공개 직후 비워진 CDN 캐시를 큰 영상부터 채운다. 쿼리 없는 주소를 받아야 그 주소의 캐시가 찬다. */
async function 채우기(옵션 = {}) {
  let 사본 = null;
  try {
    사본 = 사본열기(옵션);
    const { git } = 사본;
    const 원격머리 = await 받아오기(git);
    const 트리 = 트리읽기(git, 원격머리);
    const 식들 = (옵션.항목 && 옵션.항목.length ? 옵션.항목 : 기본채우기).map(glob식);
    const 경로들 = [...트리.keys()].filter((p) => 식들.some((r) => r.test(p))).sort();
    if (!경로들.length) return { 결과: '멈춤', 이유: '맞는 공개 파일이 없다' };
    const 받기 = 옵션.받기 || curl받기;
    const 주소 = 옵션.주소 || 기본주소;
    const 시작 = Date.now();
    const 결과들 = await 풀어서(경로들, 4, async (p) => {
      const t = Date.now();
      const 첫 = await 받기(주소로(주소, p), { 캐시없이: false, 시간: 600 });
      const 둘 = await 받기(주소로(주소, p), { 몸: false, 캐시없이: false, 시간: 60 });
      return { 경로: p, 상태: 첫.상태, 크기: 첫.버퍼 ? 첫.버퍼.length : null, 초: Math.round((Date.now() - t) / 100) / 10, 캐시: 머리값(둘.머리 || '', 'x-cache') };
    });
    const 다참 = 결과들.every((r) => r.상태 === 200 && /HIT/i.test(r.캐시 || ''));
    return { 결과: 다참 ? '채움' : '덜 참', 파일: 결과들, 초: Math.round((Date.now() - 시작) / 1000) };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  } finally {
    if (사본) 사본.치우기();
  }
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const 사용법 = `사용법
  node tools/공개.js 올리기 <항목…> [--원본 <폴더>] [--공개폴더 <앞>] [--지움 <공개경로>] [--기준 <커밋> | --기준폴더 <폴더>]
                          [--전부] [--줄끝도] [--토큰 <값> | --토큰안함] [--허용 <공개경로>] [--만 <공개경로>] [--후보폴더 <폴더>] [--위에 <커밋>] [--json]
  node tools/공개.js 올리기 <항목…> -m "<메시지>" --실행 --계획 <해시> [--재실행] [--기다림 <분>] [--점검기다림 <분>]
  node tools/공개.js 확인 <커밋> [--부터 <커밋>] [--재실행] [--기다림 <분>] [--점검기다림 <분>] [--점검안함] [--json]
  node tools/공개.js 채우기 [<공개경로 glob>…] [--json]
  항목: <공개경로>=<로컬 파일·폴더>, 또는 --원본 아래 <경로>. 기본은 미리 보기다. --실행은 유호님이 승인한 범위에서만.
  공통: --사본 <bare 폴더> · --새사본 · --원격주소 <url> · --주소 <사이트> · --간격 <초> · --작성자 "이름 <메일>"
  자세한 설명은 파일 머리.`;

function 인자읽기(argv) {
  const [명령, ...나머지] = argv;
  if (!명령 || ['--help', '-h', '도움말'].includes(명령)) return { 도움말: true };
  if (!['올리기', '확인', '채우기'].includes(명령)) throw new 사용법오류(`모르는 명령: ${명령} (올리기 · 확인 · 채우기)`);
  const 옵션 = { 명령, 항목: [], 지움: [], 허용: [], 만: [], 메시지: '', 실행: false, json: false };
  const 메시지 = [];
  for (let i = 0; i < 나머지.length; i++) {
    const a = 나머지[i];
    const 값 = () => {
      if (i + 1 >= 나머지.length) throw new 사용법오류(`${a} 뒤에 값이 없다`);
      return 나머지[++i];
    };
    if (a === '--') { 옵션.항목.push(...나머지.slice(i + 1)); break; }
    else if (a === '-m' || a === '--메시지') 메시지.push(값());
    else if (a === '-F' || a === '--메시지파일') 옵션.메시지파일 = 값();
    else if (a === '--원본') 옵션.원본 = 값();
    else if (a === '--공개폴더') 옵션.공개폴더 = 값();
    else if (a === '--지움') 옵션.지움.push(값());
    else if (a === '--기준') 옵션.기준 = 값();
    else if (a === '--기준폴더') 옵션.기준폴더 = 값();
    else if (a === '--허용') 옵션.허용.push(값());
    else if (a === '--만') 옵션.만.push(값());
    else if (a === '--토큰') 옵션.토큰 = 값();
    else if (a === '--후보폴더') 옵션.후보폴더 = 값();
    else if (a === '--위에') 옵션.위에 = 값();
    else if (a === '--계획') 옵션.계획 = 값();
    else if (a === '--부터') 옵션.부터 = 값();
    else if (a === '--사본') 옵션.사본 = 값();
    else if (a === '--원격주소') 옵션.원격주소 = 값();
    else if (a === '--주소') 옵션.주소 = 값();
    else if (a === '--저장소이름') 옵션.저장소이름 = 값();
    else if (a === '--기다림') 옵션.기다림 = Number(값());
    else if (a === '--점검기다림') 옵션.점검기다림 = Number(값());
    else if (a === '--간격') 옵션.간격 = Number(값());
    else if (a === '--작성자') {
      const m = /^(.+?)\s*<([^>]+)>$/.exec(값());
      if (!m) throw new 사용법오류('--작성자는 "이름 <메일>" 꼴이다');
      옵션.작성자 = { 이름: m[1], 메일: m[2] };
    }
    else if (a === '--실행') 옵션.실행 = true;
    else if (a === '--json') 옵션.json = true;
    else if (a === '--전부') 옵션.전부 = true;
    else if (a === '--줄끝도') 옵션.줄끝도 = true;
    else if (a === '--토큰안함') 옵션.토큰안함 = true;
    else if (a === '--새사본') 옵션.새사본 = true;
    else if (a === '--재실행') 옵션.재실행 = true;
    else if (a === '--점검안함') 옵션.점검안함 = true;
    else if (a.startsWith('-')) throw new 사용법오류(`모르는 인자: ${a}`);
    else 옵션.항목.push(a);
  }
  for (const k of ['기다림', '점검기다림', '간격']) if (옵션[k] != null && !(옵션[k] >= 0)) throw new 사용법오류(`--${k}는 0 이상 숫자다`);
  if (옵션.메시지파일) 메시지.push(fs.readFileSync(옵션.메시지파일, 'utf8'));
  옵션.메시지 = 메시지.join('\n\n');
  if (명령 === '확인') {
    if (옵션.항목.length !== 1) throw new 사용법오류('확인할 커밋 하나를 준다');
    옵션.커밋 = 옵션.항목[0];
  }
  return 옵션;
}

const 시각글 = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ');

function 인용(a) {
  return /^[\w@%+=:,./가-힣-]+$/.test(a) ? a : `"${a.replace(/(["$`])/g, '\\$1')}"`;
}

function 올리기글(r, argv) {
  const 머리 = {
    '미리 보기': '[미리 보기] 아직 올리지 않았다',
    '올릴 것 없음': `[올릴 것 없음] ${r.이유 || ''}`,
    '걸림': `[걸림] ${r.이유}`,
    '멈춤': `[멈춤] ${r.이유}`,
    '올림': `[올림] origin/main ← ${짧게(r.커밋)}`,
    '올림·확인 덜 됨': `[올림·확인 덜 됨] origin/main ← ${짧게(r.커밋)} — push는 됐다. 아래 확인을 다시: node tools/공개.js 확인 ${짧게(r.커밋)}`,
    '실패': `[실패] ${r.이유}`,
  }[r.결과] || `[${r.결과}] ${r.이유 || ''}`;
  const 줄 = [머리];
  if (r.위요약) 줄.push(`공개본 ${짧게(r.위요약.커밋)} (${시각글(r.위요약.시각)} KST · ${r.위요약.제목})${r.다시한수 ? ` · origin이 움직여 ${r.다시한수}번 다시 함` : ''}`);
  if (r.기준) 줄.push(`3방향 기준: ${r.기준.커밋 ? `공개 커밋 ${짧게(r.기준.커밋)}` : `폴더 ${r.기준.폴더}`}`);
  if (r.항목 && r.항목.length) {
    줄.push(`바뀔 파일 ${r.항목.length}개 · 계획 ${r.계획}`);
    for (const x of r.항목) {
      줄.push(`  ${x.종류.padEnd(2)}  ${x.경로}${x.종류 === '지움' ? '' : `  ${바이트글(x.크기)}`}  ${x.방법}`);
      for (const t of (x.토큰 || []).slice(0, 6)) 줄.push(`        ${t.참조}?v=${t.전} → ${t.후}${t.꼬리 ? ' (꼬리 맞춤)' : ''}`);
      if ((x.토큰 || []).length > 6) 줄.push(`        … 외 ${x.토큰.length - 6}개`);
    }
  }
  if (r.건너뜀 && r.건너뜀.length) {
    줄.push(`건너뜀 ${r.건너뜀.length}개`);
    for (const x of r.건너뜀.slice(0, 30)) 줄.push(`  ${x.경로} — ${x.이유}`);
    if (r.건너뜀.length > 30) 줄.push(`  … 외 ${r.건너뜀.length - 30}개`);
  }
  if (r.검사) {
    const s = r.검사;
    줄.push(`검사 — 도구 이름(${r.규칙출처}) 글 ${s.글}·MP3 ${s.mp3} · 제작 표시 미디어 ${s.미디어} · AI 이름 더한 줄 ${s.더한줄} · 이 PC 경로 더한 줄 ${s.경로줄} · 저장 용량 새 blob ${s.새blob}개 ${바이트글(s.새바이트)}`);
  }
  if (r.엇갈림) 줄.push(...엇갈림글(r.엇갈림, argv, r.결과));
  for (const x of r.걸림 || []) 줄.push(`  걸림 [${x.검사}] ${x.경로 || ''} — ${x.이유}`);
  for (const x of r.알림 || []) {
    줄.push(`  알림 [${x.검사}] ${x.경로 || ''} — ${x.이유}`);
    if (x.예) 줄.push(`        예: ${x.예.join(', ')}`);
  }
  if (r.후보폴더) 줄.push(`후보 파일을 써 둠: ${r.후보폴더} (후보.json)`);
  if (r.결과 === '미리 보기' && (argv || []).includes('--위에')) {
    줄.push('--위에로 지난 공개를 재현한 미리 보기다 — 올리는 명령은 없다');
  } else if (r.결과 === '미리 보기') {
    const 남길 = (argv || []).filter((a, i, all) => a !== '--json' && !(i > 0 && all[i - 1] === '--후보폴더') && a !== '--후보폴더');
    const 메시지없음 = !남길.includes('-m') && !남길.includes('-F') && !남길.includes('--메시지') && !남길.includes('--메시지파일');
    const 엇갈림있음 = r.엇갈림 && r.엇갈림.셈 && (r.엇갈림.셈['①'] || r.엇갈림.셈['②']);
    줄.push(엇갈림있음 ? '한 번에 올리려면(위 import ①·② 엇갈림을 알고도 — 유호님이 이 계획을 승인한 뒤에만):' : '올리려면(유호님이 이 계획을 승인한 뒤에만):');
    줄.push(`  node tools/공개.js ${남길.map(인용).join(' ')}${메시지없음 ? ' -m "<메시지>"' : ''} --실행 --계획 ${r.계획}`);
  }
  if (r.확인) 줄.push(...확인글(r.확인));
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  return 줄.join('\n');
}

/**
 * 1단계 미리 보기 명령: 받은 명령에 --만 <경로>…를 붙인다(-- 뒤 항목 앞에). 받은 --만·실행·계획·메시지·기다림 인자는 뺀다.
 * 명령줄이 없으면 붙일 인자만.
 */
function 단계명령(argv, 경로들) {
  const 덧 = 경로들.flatMap((p) => ['--만', p]);
  if (!argv || !argv.length) return `(같은 명령에) ${덧.map(인용).join(' ')}`;
  const 값뺄 = new Set(['--만', '--후보폴더', '--계획', '-m', '--메시지', '-F', '--메시지파일', '--기다림', '--점검기다림', '--간격']);
  const 그냥뺄 = new Set(['--json', '--실행', '--재실행', '--점검안함']);
  const 남길 = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') { 남길.push(...argv.slice(i)); break; }
    if (값뺄.has(argv[i])) i++;
    else if (!그냥뺄.has(argv[i])) 남길.push(argv[i]);
  }
  const k = 남길.indexOf('--');
  const 명령 = k < 0 ? [...남길, ...덧] : [...남길.slice(0, k), ...덧, ...남길.slice(k)];
  return `node tools/공개.js ${명령.map(인용).join(' ')}`;
}

/** import 이름 엇갈림 줄: 세 짝 수, ①·②·알 수 없음의 예, 미리 보기면 나눔(1단계 --만 명령) */
function 엇갈림글(e, argv, 결과) {
  if (e.오류) return [`import 이름 — 세지 못했다: ${e.오류}`];
  const s = e.셈;
  const 덧 = [
    e.새주소 ? `처음 쓰는 ?v= 주소라 ①에서 뺀 이름 ${e.새주소}개` : '',
    e.알수없음.length ? `export * 때문에 모르는 이름 ${e.알수없음.length}개` : '',
  ].filter(Boolean);
  const 줄 = [`import 이름(캐시 10분) — ① ${s['①']}짝 · ② ${s['②']}짝 · ③ ${s['③']}짝 · 바뀐 모듈 ${e.모듈.바뀐}개 · 읽은 모듈 ${e.모듈.읽음}개${덧.length ? ` · ${덧.join(' · ')}` : ''}`];
  const 보기 = (종류, 설명) => {
    const 짝 = e.짝.filter((x) => x.종류 === 종류);
    if (!짝.length) return;
    줄.push(`  ${종류} ${설명}`);
    for (const x of 짝.slice(0, 5)) 줄.push(`    ${짝글(x)}`);
    if (짝.length > 5) 줄.push(`    … 외 ${짝.length - 5}짝`);
  };
  보기('①', '새 판이 바뀐 모듈의 옛 판에 없는 이름을 부른다 — 옛 판이 캐시에 남은 사람은 10분 동안 깨진다');
  보기('②', '바뀐 모듈의 옛 판이 새 판에서 없어진 이름을 부른다 — 옛 판이 캐시에 남은 사람은 10분 동안 깨진다');
  if (s['③']) 줄.push('  ③ 새 판끼리 안 맞는다 — 아래 걸림·알림(캐시와 상관없이 깨진다)');
  if (e.알수없음.length) {
    const 예 = e.알수없음.slice(0, 3).map((x) => `${x.부르는} → ${x.대상}: ${x.이름}`).join(' · ');
    줄.push(`  알 수 없음(export * 너머라 세지 않았다 — 손으로 본다): ${예}${e.알수없음.length > 3 ? ' …' : ''}`);
  }
  if (e.나눔 && 결과 === '미리 보기') {
    const 먼저 = e.나눔['1단계'];
    if (!먼저.length) 줄.push('  옛 화면과도 맞는 모듈이 없어 나눠 올릴 수 없다 — 없애는 이름을 한동안 남긴 판을 먼저 올린다');
    else {
      줄.push(`  두 번에 나눠 올린다 — 1단계(옛 화면과도 맞는 쪽) ${먼저.length}개: ${먼저.join(', ')}`);
      if (!(argv || []).includes('--위에')) 줄.push(`    ${단계명령(argv, 먼저)}`);
      줄.push(`  2단계(나머지 ${e.나눔['2단계'].length}개): 1단계 바이트 대조가 같아진 때부터 10분 뒤 --만 없이 다시 미리 보기${e.나눔.남는.length ? ` — 2단계에도 엇갈림 ${e.나눔.남는.length}짝이 남아 그때 다음 나눔이 나온다` : ''}`);
    }
  }
  return 줄;
}

function 확인글(c) {
  const 줄 = [];
  const d = c.대조;
  if (d) {
    줄.push(d.통과 ? `바이트 대조 ${d.같음}/${d.전체} 같음 (${d.초}초, ${d.바퀴}바퀴)` : `바이트 대조 실패 ${d.같음}/${d.전체} (${d.초}초 기다림)`);
    if (d.뒤바뀜) 줄.push(`  그 뒤 커밋이 다시 바꾼 ${d.뒤바뀜.length}개는 지금 main(${짧게(d.뒤머리)}) 판으로 대조: ${d.뒤바뀜.slice(0, 5).join(', ')}${d.뒤바뀜.length > 5 ? ' …' : ''}`);
    for (const x of (d.다름 || []).slice(0, 20)) 줄.push(`  다름 ${x.경로} — 기대 ${x.기대}, 받음 ${x.상태 || '연결 실패'}${x.크기 != null ? ` · ${x.크기}바이트` : ''}${x.오류 ? ` · ${x.오류}` : ''}`);
  }
  const p = c.점검;
  if (p) {
    if (p.결과 === '통과') 줄.push(`배포 점검 통과 — 실행 ${p.실행}${p.뒤커밋 ? `(뒤 커밋 ${짧게(p.커밋)}의 점검이 내 커밋을 품는다)` : ''}${p.재실행 ? ' · 한 번 다시 돌려 통과' : ''}`);
    else if (p.결과 === '실패') {
      줄.push(`배포 점검 실패 — 실행 ${p.실행} ${p.결론 || ''} · 실패 단계: ${(p.실패단계 || []).join(', ') || '모름'} · ${p.주소 || ''}${p.재실행 ? ' (다시 돌려도 실패)' : ''}`);
      if (p.재실행오류) 줄.push(`  다시 돌리지 못했다: ${p.재실행오류}`);
    } else 줄.push(`배포 점검 ${p.결과} — ${p.이유 || ''}${p.실행 ? ` (실행 ${p.실행} ${p.상태 || ''})` : ''}`);
  }
  if (c.오류) 줄.push(`확인 중 오류(push는 됐다): ${c.오류}`);
  return 줄;
}

function 확인결과글(r) {
  if (r.결과 === '멈춤') return `[멈춤] ${r.이유}`;
  const 줄 = [`[${r.결과}] ${짧게(r.커밋)} (${시각글(r.요약.시각)} KST · ${r.요약.제목})${r.main에있음 ? '' : ' — 아직 origin/main에 없다'}`];
  if (r.빠짐 && r.빠짐.length) 줄.push(`대조에서 뺀 경로 ${r.빠짐.length}개: ${r.빠짐.slice(0, 5).map((x) => `${x.경로}(${x.이유})`).join(', ')}`);
  줄.push(...확인글(r));
  return 줄.join('\n');
}

function 채우기글(r) {
  if (r.결과 === '멈춤') return `[멈춤] ${r.이유}`;
  const 줄 = [`[${r.결과}] ${r.파일.length}개 · ${r.초}초`];
  for (const x of r.파일) 줄.push(`  ${x.상태} ${x.경로} ${x.크기 != null ? 바이트글(x.크기) : ''} ${x.초}초 · x-cache ${x.캐시 || '-'}`);
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
  if (!옵션.json) 옵션.알리기 = (글) => console.error(`… ${글}`);
  let r;
  try {
    r = 옵션.명령 === '올리기' ? await 올리기(옵션) : 옵션.명령 === '확인' ? await 확인(옵션) : await 채우기(옵션);
  } catch (e) {
    if (e instanceof 사용법오류) { console.error(`${e.message}\n${사용법}`); return 2; }
    r = { 결과: '실패', 이유: e.message };
  }
  if (옵션.json) console.log(JSON.stringify(r, null, 2));
  else console.log(옵션.명령 === '올리기' ? 올리기글(r, argv) : 옵션.명령 === '확인' ? 확인결과글(r) : 채우기글(r));
  return 좋은결과.has(r.결과) ? 0 : 1;
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = {
  올리기, 확인, 채우기, 인자읽기, main,
  _시험: { 토큰고치기, 토큰값, 참조풀기, 점검규칙읽기, 검사하기, 더한줄, 계획해시, 바이트대조, 점검기다리기, 줄끝만다름, 공개경로, 올리기글, 확인결과글, glob식 },
};
