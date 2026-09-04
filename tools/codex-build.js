#!/usr/bin/env node
'use strict';
/* codex-build — GPT(코덱스) «기술 실행자» 레인 (2026-09-04 · 유호 확정 「기술실행자 역할도 추가하고싶어 …
 * 이 모든걸 자동으로 흘러가게 시스템화 하고싶어」).
 *
 * ■ 흐름 — 한 번 부르면 사람 손 없이 끝까지 돈다
 *   ⓪ 발주서 형식 검사(도구)            → 절이 빠지면 여기서 멈춘다(코덱스를 태우기 전에)
 *   ① 발주 검토(코덱스 · 읽기 전용)      → 구멍(입출력·빈값·완료기준·모순·범위)을 찾는다 · «막힘»이면 멈춘다
 *   ② 실행(코덱스 · 워크트리에 쓰기)      → 발주서대로 구현 + 시험 작성 · 네트워크 없음
 *   ③ 범위·비밀 검사 + 시험(도구가 직접)  → 모델의 말이 아니라 `git status` 와 시험 종료코드가 자다
 *   ④ 커밋(워크트리 가지 · 범위 안 파일만)
 *   ⑤ 검수(`tools/codex-review.js --commit` · 새 세션 · 읽기 전용)  → 적대 검수 · 장부 `검수기록.jsonl`
 *   ⑥ 수용 기준 대조(코덱스 · 읽기 전용) → 발주서 «수용 기준»을 하나씩 diff 에 댄다
 *   ⑦ 차단급(P0·P1)·미충족·시험 실패가 있으면 수리 라운드(②부터 · 상한 `--라운드`)
 *   ⑧ 장부(`docs/_ops/실행기록.jsonl`) + 보고
 *   그 뒤는 사람 몫이다 — 클로드가 가지를 읽고 의미·통합을 확인해 master 에 합치고, 유호님이 운영 배포를 승인한다.
 *
 * ■ 왜 이렇게 지었나
 *   · 워크트리에서 짓는다 — 실행자가 남의 작업본을 못 본다(섞이면 남의 미커밋이 실려 간다 · `docs/_ops/워크트리_규약.md`).
 *   · 네트워크를 끈다 — push·배포·패키지 설치·유출이 통째로 막힌다(09-04 프로브: `workspace-write` +
 *     `sandbox_workspace_write.network_access=false` 에서 example.com 연결이 실제로 실패했다).
 *   · 범위 검사를 «도구»가 한다 — 모델의 약속은 자가 아니다. 워크트리의 `git status` 가 자다.
 *   · 검수자는 «다른 세션»이다 — 실행자의 프롬프트·발주서를 검수자는 못 본다(백지가 무기 · 유호 확정 09-04).
 *     발주서는 ⑥ 수용 대조 단계에만 «수용 기준»만 실린다.
 *   · 코덱스 호출은 `codex-review.js` 의 `codex()` 한 통로를 빌린다 — 한도 게이트·배너 걷기·실패 갈래가 거기 산다.
 *
 * 🔴 이 장치가 틀릴 때의 모습(대가를 함께 적는다)
 *   ① 샌드박스는 «쓰기»만 막고 «읽기»는 안 막는다 — 실행자가 홈의 파일(자격증명 폴더 포함)을 읽을 수 있다
 *      (09-04 프로브: `~/.gitconfig` 첫 줄 읽힘). 밖으로 나갈 길(네트워크)이 없고, 커밋 «전» 비밀 무늬 검사가 마지막 벽이다.
 *   ② 임시 폴더(%TEMP%)에는 쓸 수 있다(09-04 프로브) — 그래서 워크트리를 임시 폴더에 두지 않는다.
 *   ③ 수용 대조·발주 검토는 모델의 판정이다 — «충족»이 사실이라는 보장이 아니다. 시험 종료코드만 자다.
 *   ④ 검수가 「확인 불가」(종료 2)면 라운드를 안 돌고 멈춘다 — 통과가 아니다.
 *
 * ■ 쓰기
 *   node tools/codex-build.js --발주 <발주서.md> [--저장소 <경로>] [--실행 luna|sol] [--효력 max]
 *                             [--라운드 2] [--timeout 초] [--버그만] [--발주검토안함] [--검수안함] [--던지기] [--한도무시]
 *   node tools/codex-build.js --발주 <발주서.md> --마른손          # 코덱스 없이 ⓪만(형식·범위·계획 출력)
 *   node tools/codex-build.js --런목록                            # 던진 실행 런 상태
 *   node tools/codex-build.js --공통지침대조                       # ~/.codex/AGENTS.md 가 정본(docs/GPT_정본.md §6)과 같은가
 *   발주서 규격 = docs/발주서_틀.md · 역할 지침 = AGENTS.md §3 · 정본 발췌 = docs/GPT_정본.md
 *   종료코드: 0 = 완주(차단급 0 · 미충족 0 · 시험 통과) · 1 = 결과는 있는데 처리할 것이 남았다 · 2 = 확인 불가(안 돌았다)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 검수 = require('./codex-review.js');
const 정책 = require('./모델정책.js');
const 런 = require('./lib/검수런.js');
const { 인자게이트 } = require('./lib/인자게이트.js');

const 실행스키마 = path.join(__dirname, '코덱스실행.schema.json');
const 검토스키마 = path.join(__dirname, '발주검토.schema.json');
const 수용스키마 = path.join(__dirname, '수용대조.schema.json');
const 정본경로 = path.join(ROOT, 'docs', 'GPT_정본.md');
const 기록경로 = process.env.SYNK_BUILD_LEDGER || path.join(ROOT, 'docs', '_ops', '실행기록.jsonl');
const 공통지침경로 = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'AGENTS.md');

function 확인불가(msg) { const e = new Error(msg); e.확인불가 = true; return e; }

/* ── 인자 ────────────────────────────────────────────────────────────────── */
const 값플래그 = ['--발주', '--저장소', '--실행', '--효력', '--라운드', '--timeout'];
/* 🔴 한도 우회 플래그는 **검수 쪽에서 빌린다** — 한 값을 두 곳이 적으면 갈리고, 갈린 쪽이 조용하다.
 *   09-05 실측: 이 레인이 `--한도무시` 를 아예 몰라서 한도 차단문이 준 처방이 「모르는 플래그」로
 *   거절됐다(종료 2). 차단문은 codex() 안에 있어 **두 레인이 같은 문장을 쓰는데**, 그 처방이
 *   한쪽에서만 실행 가능했다 — 처방이 그대로 안 먹으면 우회(env 직접 심기)가 정상 통로가 된다(F103). */
const 한도무시플래그 = 검수.한도무시플래그;
const 홑플래그 = ['--버그만', '--발주검토안함', '--검수안함', '--마른손', '--던지기', '--런목록', '--공통지침대조', 한도무시플래그, '--help', '-h'];
const 아는플래그 = [...값플래그, ...홑플래그];
function 값(argv, 플래그) {
  const i = argv.indexOf(플래그);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || /^--/.test(v)) throw 확인불가(`${플래그} 뒤에 값이 없다`);
  return v;
}

/* ── 발주서 규격 — docs/발주서_틀.md 가 사람 쪽 정본이고, 여기는 기계 쪽 자다 ───────────── */
const 필수절 = ['목표', '범위', '수용 기준', '시험'];
const 선택절 = ['금지', '맥락', '시험 수정 허용'];

/* 이 경로들은 어느 발주서도 «범위»에 넣을 수 없다 — 정본·가드·훅·장부·모델값은 사람이 고친다.
 * 접두(폴더)는 `/` 로 끝내고, 파일은 그대로 적는다. 대조는 저장소 상대 경로(슬래시 통일)로 한다. */
const 금지경로들 = [
  '.claude/', '.github/', '.githooks/', '.codex/', '.agents/',
  'AGENTS.md', 'CLAUDE.md', 'appsscript.json', '.clasp.json',
  'docs/_ops/결정.md', 'docs/_ops/트랙.md', 'docs/SYNK_철학.md', 'docs/제품방향.md', 'docs/GPT_정본.md',
  'tools/모델정책.js', 'tools/codex-review.js', 'tools/codex-build.js', 'tools/lib/검수런.js',
  'tools/guard.js', 'tools/precommit.js',
];

/** 저장소 상대 경로를 슬래시로 통일한다(윈도우 `\` · 앞 `./`). */
function 경로정규화(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/** 접두·파일·별표(`*`=한 마디 · `**`=여러 마디) 셋을 한 자로 댄다. */
function 경로맞나(파일, 패턴) {
  const f = 경로정규화(파일);
  const p = 경로정규화(패턴);
  if (!p) return false;
  if (p.endsWith('/')) return f.startsWith(p);
  if (!p.includes('*')) return f === p || f.startsWith(p + '/');
  const re = new RegExp('^' + p.split('**').map((s) => s.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
  return re.test(f);
}

function 경로금지인가(파일) {
  return 금지경로들.some((금지) => 경로맞나(파일, 금지));
}

/** 마크다운을 `## 절` 로 가른다 — 절 이름의 번호·기호·공백을 걷어 «목표»·«수용 기준» 같은 이름으로 찾는다. */
function 절나누기(text) {
  const 줄 = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const 절들 = {};
  let 제목 = '';
  let 현재 = null;
  for (const l of 줄) {
    const h1 = /^#\s+(.+)$/.exec(l);
    if (h1 && !제목 && 현재 === null) { 제목 = h1[1].trim(); continue; }
    const h2 = /^##\s+(.+)$/.exec(l);
    if (h2) {
      현재 = h2[1].replace(/^[\d.①-⑳㉠-㉿\s·)]+/, '').replace(/[*_`]/g, '').trim();
      절들[현재] = [];
      continue;
    }
    if (현재 !== null) 절들[현재].push(l);
  }
  return { 제목, 절들 };
}

/** 절 본문에서 «항목»(`- ` · `1.` · 코드 펜스 안 줄)만 뽑는다. */
function 항목들(줄들) {
  const 밖 = [];
  let 펜스 = false;
  for (const raw of 줄들 || []) {
    const l = raw.trim();
    if (/^```/.test(l)) { 펜스 = !펜스; continue; }
    if (!l) continue;
    if (펜스) { 밖.push(l); continue; }
    const m = /^(?:[-*]|\d+[.)])\s+(.+)$/.exec(l);
    if (m) 밖.push(m[1].trim());
  }
  return 밖;
}

/** `- \`tools/<이름>.js\`` → 그 경로 · `- tools/ — 도구` → `tools/` (첫 마디만 경로다).
 *  ⚠ 예시에 «실제 파일처럼 보이는» 경로를 적지 않는다 — 부패 점검이 그것을 「없는 파일을 부른다」로 센다. */
function 경로항목(s) {
  const 백틱 = /`([^`]+)`/.exec(s);
  if (백틱) return 백틱[1].trim();
  return String(s).split(/\s+/)[0].replace(/[—:·,]+$/, '');
}

/**
 * 발주서 형식 검사 — **순수 함수**. 파일·git 없이 회귀가 여기를 문다.
 * 돌려주는 것: { 제목, 절들, 허용경로들, 시험명령들, 수용기준들, 금지항목들, 맥락들, 오류들 }
 * 오류가 하나라도 있으면 코덱스를 태우지 않는다 — 구멍 난 발주서로 도는 실행은 「돌았다」의 얼굴로 틀린다.
 */
function 발주서검사(text) {
  const { 제목, 절들 } = 절나누기(text);
  const 오류들 = [];
  if (!제목) 오류들.push('첫 줄에 `# 발주 — <제목>` 이 없다');
  if (제목 && !/^발주/.test(제목)) 오류들.push(`제목이 「발주 — …」로 시작하지 않는다: "${제목}"`);
  for (const 절 of 필수절) if (!절들[절]) 오류들.push(`필수 절 «${절}» 이 없다(\`## ${절}\`)`);
  const 허용경로들 = 항목들(절들['범위']).map(경로항목).map(경로정규화).filter(Boolean);
  const 시험명령들 = 항목들(절들['시험']).map((s) => s.replace(/^`|`$/g, ''));
  const 수용기준들 = 항목들(절들['수용 기준']);
  const 금지항목들 = 항목들(절들['금지']);
  const 맥락들 = 항목들(절들['맥락']).map(경로항목);
  /* «시험 수정 허용» — 기본은 «있던 시험 못 고침»이고 이 절만 이름 대어 연다(자기 채점 막기 · :183).
   * 🔴 이 절로 시험 «아닌» 경로를 열 수 없다 — 열리면 범위 검사를 우회하는 둘째 문이 된다. */
  const 시험수정허용 = 항목들(절들['시험 수정 허용']).map(경로항목).map(경로정규화).filter(Boolean);
  for (const p of 시험수정허용) {
    if (!시험파일인가(p)) 오류들.push(`«시험 수정 허용» 의 \`${p}\` 는 시험 파일이 아니다 — 이 절은 시험만 연다`);
    if (경로금지인가(p)) 오류들.push(`«시험 수정 허용» 의 \`${p}\` 는 발주로 만질 수 없는 자리다`);
  }
  if (절들['시험 수정 허용'] && !시험수정허용.length) 오류들.push('«시험 수정 허용» 절이 있는데 경로가 0개다 — 열 파일을 `- 경로` 로 이름 대어 적는다(빈 절은 지운다)');
  if (절들['범위'] && !허용경로들.length) 오류들.push('«범위» 에 경로 항목이 0개다 — 실행자가 만질 수 있는 경로를 `- 경로` 로 적는다');
  // ⚠ 예시 경로는 «실제 파일처럼» 적지 않는다(위 경로항목 머리말과 같은 까닭).
  if (절들['시험'] && !시험명령들.length) 오류들.push('«시험» 에 명령이 0개다 — 도구가 직접 돌릴 명령을 적는다(예: `node --test tests/<이름>.test.js`)');
  if (절들['수용 기준'] && !수용기준들.length) 오류들.push('«수용 기준» 에 항목이 0개다 — 시험으로 판정할 수 있는 문장으로 적는다');
  for (const p of 허용경로들) {
    if (경로금지인가(p)) 오류들.push(`«범위» 의 \`${p}\` 는 발주로 만질 수 없는 자리다(정본·가드·훅·장부·모델값 = 사람 몫)`);
    if (p === '.' || p === '/' || p === '**' || p === '*') 오류들.push(`«범위» 의 \`${p}\` 는 저장소 전부다 — 범위가 아니다`);
  }
  if (절들['목표'] && !(절들['목표'] || []).join('').trim()) 오류들.push('«목표» 가 비었다');
  return { 제목, 절들, 허용경로들, 시험명령들, 수용기준들, 금지항목들, 맥락들, 시험수정허용, 오류들 };
}

/** 워크트리가 바꾼 파일 중 «범위» 밖 — 비어 있어야 커밋한다. 금지 경로는 범위에 있어도 밖이다. */
function 범위밖(파일들, 허용경로들) {
  return (파일들 || []).map(경로정규화).filter((f) => 경로금지인가(f) || !(허용경로들 || []).some((p) => 경로맞나(f, p)));
}

/* ── 🔴 «자기 채점» 막기 — 실행자는 저를 재는 시험을 못 고친다 (2026-09-04) ──────────────────
 *
 * 왜: ③의 자는 «시험 종료코드»다. 그런데 시험 파일이 «범위» 안에 있으면 실행자가 그 자를 스스로
 *   느슨하게 고쳐 초록을 만들 수 있다 — 코드가 아니라 «자»가 바뀐 것이라 종료코드는 참말처럼 보인다.
 *   같은 병을 이미 한 번 앓았다(기억 `test-guards-the-defect` — 「자가 결함을 지키면 초록은 영원하다」).
 *   GPT 가 이 자리를 지적했고(09-04 · 유호님이 전달), 재보니 금지 목록에 시험이 없어 **진짜 구멍**이었다.
 *
 * 규칙: **이미 있던 시험 파일은 못 고친다 · 새 시험 파일은 얼마든지 더한다.**
 *   고쳐야만 하는 발주(깨진 시험 수리 등)는 발주서가 «시험 수정 허용» 절에 파일을 **이름 대어** 연다 —
 *   기본이 막힘이고 예외는 장부에 남아 검수자가 본다. 🚫 이 절로 시험 아닌 경로는 못 연다(아래 검사). */
const 시험무늬 = /(^|\/)(tests?|__tests__|evals)\/|\.(test|spec)\.[cm]?[jt]sx?$/i;
function 시험파일인가(p) { return 시험무늬.test(경로정규화(p)); }

/** 실행 «전» 시험 파일들의 지문. **추적 중인 것만** — 새로 지은 시험은 원래 없었으니 자유다. */
function 시험지문들(wt) {
  const 맵 = new Map();
  let 목록 = [];
  try {
    목록 = execFileSync('git', ['-C', wt, 'ls-files', '-z'], 검수.자식옵션({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
      .split('\0').filter(Boolean).map(경로정규화).filter(시험파일인가);
  } catch (_) { return 맵; }
  for (const p of 목록) {
    try { 맵.set(p, crypto.createHash('sha256').update(fs.readFileSync(path.join(wt, p))).digest('hex')); }
    catch (_) { /* 못 읽은 것은 안 담는다 — 뒤에 «바뀜»으로 잡히면 그때 막힌다 */ }
  }
  return 맵;
}

/**
 * 손댄 시험 — **순수 함수**(회귀가 여기를 문다 · git 도 파일도 안 만진다).
 * @param 파일들 이번 라운드가 바꾼 경로들 · @param 원본 실행 «전» 지문 Map · @param 지금 (경로)=>지문|null
 * @param 허용 발주서 «시험 수정 허용» 의 경로들
 */
function 시험손댐(파일들, 원본, 지금, 허용 = []) {
  const 열린 = (허용 || []).map(경로정규화);
  const 걸린 = [];
  for (const f0 of 파일들 || []) {
    const f = 경로정규화(f0);
    if (!시험파일인가(f)) continue;
    if (!원본.has(f)) continue;                       // 새로 지은 시험 — 허용
    if (열린.some((p) => 경로맞나(f, p))) continue;    // 발주서가 이름 대어 연 자리
    const 이제 = 지금(f);
    if (이제 === null) { 걸린.push(`${f} (지웠다)`); continue; }
    if (이제 !== 원본.get(f)) 걸린.push(`${f} (고쳤다)`);
  }
  return 걸린;
}

/* 비밀 무늬 — 커밋 «전» 마지막 벽. 샌드박스가 읽기를 안 막으므로(머리말 ①) 실행자가 홈의 열쇠를 읽어
 * 파일에 옮겨 적는 경로가 이론상 열려 있다. 넓게 잡고 거짓양성은 사람이 푼다(새는 방향이 「커밋됨」이면 안 된다). */
const 비밀무늬들 = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bsk-ant-[A-Za-z0-9_-]{20,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bsb_secret_[A-Za-z0-9_-]{10,}/,
  /\bghp_[A-Za-z0-9]{30,}/,
  /\bxox[abp]-[A-Za-z0-9-]{10,}/,
  /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /\b\d{9,10}:[A-Za-z0-9_-]{35}\b/, // 텔레그램 봇 토큰
];
function 비밀검사(text) {
  const 맞은 = [];
  for (const re of 비밀무늬들) { const m = re.exec(String(text || '')); if (m) 맞은.push(m[0].slice(0, 12) + '…'); }
  return 맞은;
}

/* ── 정본 발췌 — docs/GPT_정본.md 를 역할 마커로 자른다(사본을 안 만든다) ───────────────── */
function 정본절(역할, 원문) {
  const md = 원문 == null ? fs.readFileSync(정본경로, 'utf8') : String(원문);
  const 시작 = `<!-- 역할: ${역할} 시작 -->`;
  const 끝 = `<!-- 역할: ${역할} 끝 -->`;
  const i = md.indexOf(시작);
  const j = md.indexOf(끝);
  if (i === -1 || j === -1 || j < i) throw 확인불가(`docs/GPT_정본.md 에 «${역할}» 마커(${시작} … ${끝})가 없다 — 정본 없이 도는 실행은 규율 없는 실행이다`);
  return md.slice(i + 시작.length, j).trim();
}

/* ── 프롬프트 셋 — 순수 함수(회귀가 문다) ─────────────────────────────────────────── */
function 발주검토프롬프트(발주서, 공통) {
  return `당신은 SYNK 의 «발주 검토자»(GPT/코덱스 · 읽기 전용)다. 아래 발주서를 **구현하기 전에** 구멍을 찾는다 — 구현하지 마라.
클로드가 쓴 발주서를 다른 눈이 보는 자리다(작성자·검수자 분리). 저장소를 읽어 발주서가 가리키는 경로·함수·시험이 실재하는지 대조하라.

찾을 것 넷(SYNK-talk 개발_분업 §4): ①입출력이 구체적인가 ②빈 값·중복·네트워크 실패·재시도가 정의됐는가
③완료 기준을 «시험»으로 판정할 수 있는가 ④구현 불가능하거나 서로 모순된 요구가 없는가. 덧붙여 ⑤«범위»가 실제 고칠 자리를 덮는가.
«막힘» = 이대로 구현하면 틀린 것을 짓거나 판정을 못 한다 · «경고» = 구현은 되지만 실행자가 짐작으로 메워야 한다.
지어내지 마라. 발주서가 이미 답한 것을 구멍이라 하지 마라. 구멍이 없으면 착수가능·빈 배열이 옳은 답이다. 한국어로.

${공통}

--- 발주서 전문 ---
${발주서}`;
}

function 실행프롬프트({ 발주서, 실행자절, 공통, 라운드, 앞라운드 }) {
  const 수리 = 앞라운드 ? `
--- 앞 라운드(${라운드 - 1})가 남긴 것 — 이번 라운드는 «이것»을 닫는 수리다 ---
${앞라운드.시험실패 && 앞라운드.시험실패.length ? '시험 실패:\n' + 앞라운드.시험실패.map((s) => `  · ${s}`).join('\n') + '\n' : ''}${앞라운드.지적들 && 앞라운드.지적들.length ? '검수 지적(차단급):\n' + 앞라운드.지적들.map((z) => `  · [${z.등급}] ${z.파일}:${z.라인} ${z.제목} — ${z.근거}${z.수정방향 ? ' → ' + z.수정방향 : ''}`).join('\n') + '\n' : ''}${앞라운드.미충족 && 앞라운드.미충족.length ? '미충족 수용 기준:\n' + 앞라운드.미충족.map((m) => `  · ${m.기준} — ${m.근거}`).join('\n') + '\n' : ''}지적이 오판이면 고치지 말고 남긴것에 「오판 — 이유」로 적어라. 오판이 아니면 고친다.
` : '';
  return `당신은 SYNK 의 «기술 실행자»(GPT/코덱스)다. 아래 발주서를 그대로 구현하고 시험한다. 지금은 라운드 ${라운드}다.
이 저장소의 AGENTS.md 가 자동으로 읽혀 있다 — §3 «기술 실행자 규칙»을 지킨다. 아래 정본 발췌는 당신이 알아야 할 SYNK 사실이다.
${공통}

${실행자절}
${수리}
--- 발주서 전문 ---
${발주서}

--- 🔴 시험은 당신을 재는 자다 ---
이미 있는 시험 파일은 **고치거나 지우지 마라**(발주서 «시험 수정 허용» 절이 이름 대어 연 것만 예외).
새 시험 파일을 더하는 것은 얼마든지 좋다. 도구가 실행 전후 지문을 대조해 손댄 것을 잡고, 걸리면 이 라운드는 커밋 없이 끝난다.
시험이 발주서와 어긋나 보이면 고치지 말고 «발주밖발견»에 적어라.

--- 마지막 답 ---
최종 메시지는 스키마대로 JSON 하나다. 못 한 것은 남긴것에, 발주서 밖에서 본 문제는 발주밖발견에(고치지 않는다).
확신도는 정직하게 — 시험을 못 돌렸으면 0.5 를 넘기지 마라.`;
}

function 수용대조프롬프트(수용기준들, diff, 시험결과줄) {
  return `당신은 SYNK 의 «이종 검수자»(GPT/코덱스 · 읽기 전용)다. 방금 다른 세션의 실행자가 구현한 변경(diff)을 아래 «수용 기준»에 하나씩 댄다.
기준마다 충족 / 미충족 / 확인불가 중 하나와 코드 근거(파일:줄)를 적는다. 짐작으로 충족을 주지 마라 — diff 와 저장소에서 확인되는 것만 충족이다.
시험 결과는 도구가 실제로 돌린 값이다(모델의 주장이 아니다): ${시험결과줄}
한국어로. 기준 원문을 그대로 «기준» 칸에 옮겨 적어라(줄여 쓰면 도구가 못 맞춘다).

--- 수용 기준 ---
${(수용기준들 || []).map((k, i) => `${i + 1}. ${k}`).join('\n')}

--- 변경 내용(diff) ---
${diff}`;
}

/* 실행자 잠금 — 검수의 `잠금플래그`(읽기 전용)와 «쓰기» 한 칸만 다르다. 나머지(사용자 설정 무시 · 승인 없음 ·
 * elevated · 바깥으로 나가는 도구 차단)는 검수와 같은 목록에서 파생한다 — 두 곳에 적으면 갈린다. */
const 쓰기플래그 = [
  '--ignore-user-config', '-c', 'sandbox_mode="workspace-write"', '-c', 'approval_policy="never"',
  '-c', 'windows.sandbox="elevated"',
  '-c', 'sandbox_workspace_write.network_access=false',
  '-c', 'web_search="disabled"',
  ...검수.외부도구들.flatMap((f) => ['--disable', f]),
];
/* 읽기 전용 단계(발주 검토·수용 대조)도 웹 검색을 끈다 — 검수 잠금에 이 한 칸만 더한다. */
const 읽기플래그 = [...검수.잠금플래그, '-c', 'web_search="disabled"'];

/* ── git 손 ─────────────────────────────────────────────────────────────── */
function git(root, args, opts) {
  return execFileSync('git', ['-C', root, ...args], 검수.자식옵션({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...(opts || {}) })).trim();
}
function 저장소뿌리(경로) {
  try { return git(path.resolve(경로), ['rev-parse', '--show-toplevel']); }
  catch (e) { throw 확인불가(`«${경로}» 를 git 저장소로 못 읽었다 — ${String((e && e.stderr) || e.message).split('\n').filter(Boolean).pop() || ''}`); }
}
function 저장소이름(root) {
  try { const 공통 = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']); return path.basename(path.dirname(path.resolve(공통))); }
  catch (_) { return path.basename(root); }
}
/** 워크트리가 바꾼 파일(추적·미추적 전부). `git status --porcelain=v1 -z` 로 이름 바뀜도 읽는다. */
function 변경파일들(wt) {
  const out = execFileSync('git', ['-C', wt, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], 검수.자식옵션({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const 조각 = out.split('\0').filter(Boolean);
  const 파일 = [];
  for (let i = 0; i < 조각.length; i++) {
    const s = 조각[i];
    const 상태 = s.slice(0, 2);
    const p = s.slice(3);
    파일.push(경로정규화(p));
    if (/R|C/.test(상태)) i++; // 이름 바뀜은 다음 조각이 원래 이름이다
  }
  return 파일;
}

/** 발주 지문 = 발주서 본문 sha256 앞 8 — 같은 발주는 같은 가지·같은 워크트리다(다시 부르면 이어 돈다). */
function 발주지문(text) { return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 8); }

function 가지이름(지문) { return `codex/${지문}`; }
function 워크트리경로(root, 지문) { return path.join(root, '.claude', 'worktrees', `codex+${지문}`); }

/** 워크트리를 세운다(있으면 그대로 쓴다). 가지 기준 = 그 저장소의 지금 HEAD. */
function 워크트리준비(root, 지문, 마른손) {
  const wt = 워크트리경로(root, 지문);
  const 가지 = 가지이름(지문);
  const 있음 = fs.existsSync(path.join(wt, '.git'));
  if (마른손) return { wt, 가지, 있음 };
  if (!있음) {
    fs.mkdirSync(path.dirname(wt), { recursive: true });
    /* 메인 눈에 안 띄게 — `.git/info/exclude` 는 커밋 안 되는 로컬 파일이다(규약 §2 와 같은 자리). */
    try {
      const 공통 = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
      const ex = path.join(공통, 'info', 'exclude');
      const 줄 = '.claude/worktrees/';
      const 지금 = fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : '';
      if (!지금.split(/\r?\n/).includes(줄)) fs.appendFileSync(ex, (지금.endsWith('\n') || !지금 ? '' : '\n') + 줄 + '\n');
    } catch (_) { /* 못 적어도 워크트리는 선다 — 미추적으로 보일 뿐이다 */ }
    let 가지있음 = false;
    try { git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${가지}`]); 가지있음 = true; } catch (_) { /* 없다 */ }
    git(root, 가지있음 ? ['worktree', 'add', wt, 가지] : ['worktree', 'add', '-b', 가지, wt, 'HEAD']);
  }
  return { wt, 가지, 있음 };
}

/* ── 시험 — 도구가 직접 돌린다 ─────────────────────────────────────────────── */
function 시험돌리기(wt, 명령들, 초 = 900) {
  const 결과 = [];
  for (const 명령 of 명령들) {
    const isWin = process.platform === 'win32';
    const r = spawnSync(isWin ? (process.env.ComSpec || 'cmd.exe') : 'sh', [isWin ? '/c' : '-c', 명령],
      검수.자식옵션({ cwd: wt, encoding: 'utf8', timeout: 초 * 1000, maxBuffer: 64 * 1024 * 1024 }));
    const 꼬리 = String((r.stdout || '') + '\n' + (r.stderr || '')).trim().split('\n').slice(-12).join('\n');
    결과.push({ 명령, 종료: r.status, 시간초과: !!r.signal, 통과: r.status === 0 && !r.signal, 꼬리 });
  }
  return 결과;
}
function 시험결과줄(결과) {
  return (결과 || []).map((r) => `${r.통과 ? '통과' : (r.시간초과 ? '시간초과' : `실패(${r.종료})`)}: ${r.명령}`).join(' · ') || '(시험 없음)';
}

/* ── 코덱스 호출 셋 ────────────────────────────────────────────────────────── */
function 스키마호출(플래그, 설정, 스키마, 프롬프트, 초, 라벨, 작업뿌리) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-build-'));
  const out = path.join(임시, 'out.json');
  검수.codex(['exec', '-C', 작업뿌리, ...플래그, ...정책.코덱스플래그(설정), '--output-schema', 스키마, '--ephemeral', '-o', out, '-'], 프롬프트, 초 * 1000, 라벨);
  let 본문 = '';
  try { 본문 = fs.readFileSync(out, 'utf8'); } catch (_) { throw 확인불가(`${라벨}: 코덱스가 답 파일을 안 남겼다(빈손 + 종료 0 = 안 돈 것이다)`); }
  try { return JSON.parse(본문); } catch (_) { throw 확인불가(`${라벨}: 답이 스키마 JSON 이 아니다 — ${본문.slice(0, 200)}`); }
}

/* ── 검수 단계 — 다른 프로세스·다른 세션 ──────────────────────────────────────── */
function 검수부르기(wt, sha, 초, 버그만) {
  const 인자 = [path.join(ROOT, 'tools', 'codex-review.js'), '--저장소', wt, '--commit', sha, '--범위밖', '--timeout', String(초)];
  if (버그만) 인자.push('--버그만');
  const r = spawnSync(process.execPath, 인자, 검수.자식옵션({ cwd: ROOT, encoding: 'utf8', timeout: (초 + 300) * 1000, maxBuffer: 64 * 1024 * 1024, env: 런.자식환경(process.env) }));
  const 종료 = r.signal ? 2 : (r.status == null ? 2 : r.status);
  const 행 = 검수행찾기(sha);
  return { 종료, 행, 꼬리: String((r.stdout || '') + '\n' + (r.stderr || '')).trim().split('\n').slice(-20).join('\n') };
}
/* 🔴 09-05 실측 — **검수가 한도로 죽으면 커밋은 남고 도장만 없다.** 그런데 리셋 뒤 같은 명령을
 *   다시 부르면 실행자가 이미 다 지어 놔 «바뀐 파일 0개»가 되고, 그러면 `기록.sha` 가 null 이라
 *   ⑤ 가 통째로 건너뛰어졌다 — 도장 없는 커밋이 가지에 영영 남는데 화면엔 「커밋 없음」으로만 뜬다.
 *   지적 0 · 미충족 0 · 시험 통과라 **거의 다 된 얼굴**을 한다(「0건이 성공 얼굴」의 그 무늬다).
 * ⇒ 새 커밋이 없을 때는 «가지 끝»을 본다. 실행자가 만든 커밋인지는 **제목 접두**로 가른다
 *   (우리가 붙이는 글자라 확실하다 — 한 값을 두 곳에 적지 않으려고 상수 하나를 나눠 쓴다). */
const 실행자제목접두 = '[codex 실행자]';
function 가지끝실행자커밋(wt) {
  try {
    if (!git(wt, ['log', '-1', '--format=%s', 'HEAD']).startsWith(실행자제목접두)) return null;
    return git(wt, ['rev-parse', 'HEAD']);
  } catch (_) { return null; }
}
function 검수행찾기(sha) {
  let 줄들 = [];
  try { 줄들 = fs.readFileSync(검수.기록경로, 'utf8').split('\n').filter(Boolean); } catch (_) { return null; }
  for (let i = 줄들.length - 1; i >= 0; i--) {
    try {
      const r = JSON.parse(줄들[i]);
      if (r && r.대상 && String(r.대상.값 || '').startsWith(String(sha).slice(0, 8))) return r;
    } catch (_) { /* 깨진 줄은 건너뛴다 */ }
  }
  return null;
}
function 차단지적들(행) {
  return ((행 && 행.지적) || []).filter((z) => 검수.차단급.has(z.등급));
}

/* ── 장부 ─────────────────────────────────────────────────────────────────── */
function 장부적기(행) {
  fs.mkdirSync(path.dirname(기록경로), { recursive: true });
  fs.appendFileSync(기록경로, JSON.stringify(행) + '\n', 'utf8');
}

/* ── 던지기 — 검수 러너와 같은 장부·같은 훅 알림 ────────────────────────────────── */
function 던지기(argv, 발주경로) {
  const 한도 = 런.한도상태();
  if (런.한도막나(한도)) { console.error('🔴 던지지 않는다 — GPT(codex) 한도 소진 중이다(리셋 뒤 같은 명령).'); return 2; }
  const 런ID = 런.런ID발급('실행');
  const 로그 = 런.로그경로(런ID);
  const 인자 = 런.자식인자(argv);
  fs.mkdirSync(path.dirname(로그), { recursive: true });
  const fd = fs.openSync(로그, 'a');
  let child;
  try {
    child = spawn(process.execPath, [__filename, ...인자], 검수.자식옵션({ cwd: ROOT, detached: true, stdio: ['ignore', fd, fd], env: { ...process.env, [런.런ID키]: 런ID } }));
    child.unref();
  } catch (e) {
    console.error(`🔴 던지기 실패(${e.message}) — 세션 안에서 그냥 돌리려면 --던지기 를 빼고 다시 부른다.`);
    return 2;
  } finally { fs.closeSync(fd); }
  let HEAD = '';
  try { HEAD = git(ROOT, ['rev-parse', 'HEAD']); } catch (_) { /* 없어도 된다 */ }
  런.런쓰기({ 런ID, 종류: '실행', 상태: '진행', 시작: new Date().toISOString(), pid: child.pid, 대상: 발주경로, 인자, 로그, 도구: 'tools/codex-build.js', HEAD });
  console.log(`⏱ 실행 런을 던졌다: ${런ID} (pid ${child.pid})\n   로그: ${로그}\n   상태: node tools/codex-build.js --런목록 · 세션을 다시 열면 훅이 알린다.`);
  return 0;
}
function 마감(종료코드, 비고) {
  const 런ID = process.env[런.런ID키];
  if (!런ID || 런.자식인가(process.env)) return;
  런.런갱신(런ID, { 상태: 런.상태이름(종료코드, 'codex'), 종료코드, 끝: new Date().toISOString(), 비고: String(비고 || '') });
}

/* ── 공통 지침 대조 — ~/.codex/AGENTS.md 는 docs/GPT_정본.md §6 의 사본이다 ─────────────── */
function 공통지침정본(원문) {
  const md = 원문 == null ? fs.readFileSync(정본경로, 'utf8') : String(원문);
  /* [09-04] 줄끝 관용 — 이 저장소는 윈도우 체크아웃이라 정본이 CRLF 로 앉는다. 옛 판은 펜스 뒤에
   *   «\n 하나»만 받아서, 파일에 펜스가 멀쩡히 있는데도 「없다」로 던졌다(자가 틀린 자리라 검사가
   *   빨개도 고칠 곳을 못 가리켰다). 아래 대조는 이미 \r\n 을 정규화하는데 여기만 빠져 있었다. */
  const m = /<!-- 공통지침 시작 -->\s*```(?:markdown|md)?\r?\n([\s\S]*?)```\s*<!-- 공통지침 끝 -->/.exec(md);
  if (!m) throw 확인불가('docs/GPT_정본.md 에 «공통지침» 펜스(<!-- 공통지침 시작 --> … 끝)가 없다');
  return m[1].replace(/\r\n/g, '\n').trim();
}
function 공통지침대조() {
  const 정본 = 공통지침정본();
  let 사본 = null;
  try { 사본 = fs.readFileSync(공통지침경로, 'utf8').replace(/\r\n/g, '\n').trim(); } catch (_) { /* 없다 */ }
  if (사본 === 정본) { console.log(`✅ ${공통지침경로} 가 정본(docs/GPT_정본.md §6)과 같다.`); return 0; }
  console.log(`🔴 ${공통지침경로} 가 정본과 다르다${사본 == null ? '(파일 없음)' : ''} — 정본을 그 자리에 다시 쓴다: node tools/codex-build.js --공통지침설치`);
  return 1;
}
function 공통지침설치() {
  const 정본 = 공통지침정본();
  fs.mkdirSync(path.dirname(공통지침경로), { recursive: true });
  fs.writeFileSync(공통지침경로, 정본 + '\n', 'utf8');
  console.log(`✅ ${공통지침경로} 에 정본을 썼다(${정본.length}자).`);
  return 0;
}

/* ── 본체 ─────────────────────────────────────────────────────────────────── */
const 사용법 = [
  '사용:',
  '  node tools/codex-build.js --발주 <발주서.md> [--저장소 <경로>] [--실행 luna|sol] [--효력 max] [--라운드 2] [--timeout 초]',
  '                            [--버그만] [--발주검토안함] [--검수안함] [--던지기] [--마른손] [--한도무시]',
  '  node tools/codex-build.js --런목록 · --공통지침대조 · --공통지침설치',
  '  발주서 규격 = docs/발주서_틀.md · 종료코드 0 완주 / 1 처리할 것 남음 / 2 확인 불가',
].join('\n');

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(사용법); return 0; }
  const 오류 = 인자게이트('codex-build', argv, [...아는플래그, '--공통지침설치']);
  if (오류) { console.error(오류); return 2; }
  /* 한도 우회는 env 로 심는다 — 여기서 한 번이면 던지기 자식·검수 자식까지 spawn env 로 흐른다
   * (`런.자식환경`). 성공 1회가 마커를 지우므로 오탐은 확인 강행 한 번으로 스스로 낫는다. */
  if (argv.includes(한도무시플래그)) process.env[런.한도무시키] = '1';
  if (argv.includes('--공통지침대조')) return 공통지침대조();
  if (argv.includes('--공통지침설치')) return 공통지침설치();
  if (argv.includes('--런목록')) {
    const s = 런.요약();
    const 전부 = [...s.진행, ...s.멈춤, ...s.완주미처분, ...s.미결미처분, ...s.실패미처분].filter((x) => x.런.종류 === '실행');
    if (!전부.length) { console.log('던진 실행 런 없음.'); return 0; }
    for (const x of 전부) console.log(`  · ${x.런.런ID} · ${x.판.갈래} · ${x.판.분 == null ? '?' : x.판.분}분 · ${x.런.대상}\n    로그: ${x.런.로그}`);
    return 0;
  }

  const 발주경로 = 값(argv, '--발주');
  if (!발주경로) { console.error('🔴 --발주 <발주서.md> 가 없다.\n' + 사용법); return 2; }
  const 발주절대 = path.resolve(process.cwd(), 발주경로);
  if (!fs.existsSync(발주절대)) { console.error(`🔴 발주서가 없다: ${발주절대}`); return 2; }
  const 발주서 = fs.readFileSync(발주절대, 'utf8');
  const 검사 = 발주서검사(발주서);
  const 마른손 = argv.includes('--마른손');
  if (검사.오류들.length) {
    console.error(`🔴 발주서 형식 오류 ${검사.오류들.length}건 — 코덱스를 안 태웠다(규격 = docs/발주서_틀.md):`);
    검사.오류들.forEach((e) => console.error('   · ' + e));
    return 2;
  }
  if (argv.includes('--던지기')) return 던지기(argv, 발주경로);

  let 실행설정, 판단설정, 라운드상한, 초;
  try {
    실행설정 = 정책.실행설정(argv);
    판단설정 = { ...정책.검수선택(정책.검수기본) };
    if (argv.includes('--효력')) 판단설정.effort = String(값(argv, '--효력'));
    정책.코덱스플래그(실행설정); 정책.코덱스플래그(판단설정);   // 조합 검사를 먼저 — 몇 분 뒤가 아니라 지금 거절한다
    라운드상한 = argv.includes('--라운드') ? Number(값(argv, '--라운드')) : 2;
    if (!Number.isInteger(라운드상한) || 라운드상한 < 1 || 라운드상한 > 3) throw 확인불가(`--라운드 는 1~3 의 정수다(받은 값 ${값(argv, '--라운드')})`);
    초 = argv.includes('--timeout') ? Number(값(argv, '--timeout')) : 2400;
    if (!Number.isInteger(초) || 초 < 60) throw 확인불가('--timeout 은 60 이상의 정수(초)다');
  } catch (e) { console.error('🔴 확인 불가 — 안 돌았다: ' + e.message); return 2; }

  const root = 저장소뿌리(argv.includes('--저장소') ? 값(argv, '--저장소') : ROOT);
  const 이름 = 저장소이름(root);
  const 지문 = 발주지문(발주서);
  const { wt, 가지, 있음 } = 워크트리준비(root, 지문, 마른손);

  console.log(`발주: ${검사.제목} (${path.relative(ROOT, 발주절대) || 발주경로}) · 지문 ${지문}`);
  console.log(`저장소: ${이름} (${root}) · 가지 ${가지} · 워크트리 ${wt}${있음 ? ' (이미 있다 — 이어 돈다)' : ''}`);
  console.log(`실행자 ${실행설정.model}/${실행설정.effort} · 검토·대조 ${판단설정.model}/${판단설정.effort} · 라운드 상한 ${라운드상한} · 타임아웃 ${초}초`);
  console.log(`범위 ${검사.허용경로들.length}개: ${검사.허용경로들.join(' · ')}`);
  console.log(`시험 ${검사.시험명령들.length}개: ${검사.시험명령들.join(' · ')}`);
  console.log(`수용 기준 ${검사.수용기준들.length}개`);
  if (마른손) { console.log('(--마른손: 여기까지 — 코덱스를 안 태운다)'); return 0; }

  const 공통 = 정본절('공통');
  const 실행자절 = 정본절('실행자');
  const 장부행 = {
    시각: new Date().toISOString(), 발주: { 경로: path.relative(ROOT, 발주절대).replace(/\\/g, '/'), 제목: 검사.제목, 지문 },
    저장소: 이름, 가지, 워크트리: wt, 실행자: { model: 실행설정.model, effort: 실행설정.effort }, 판단: { model: 판단설정.model, effort: 판단설정.effort },
    검토: null, 라운드들: [], 상태: '진행',
  };

  // ① 발주 검토 — 구멍이 «막힘»이면 클로드에게 돌려준다(실행자를 안 태운다)
  if (!argv.includes('--발주검토안함')) {
    try {
      const 검토 = 스키마호출(읽기플래그, 판단설정, 검토스키마, 발주검토프롬프트(발주서, 공통), Math.min(초, 1200), '발주 검토', wt);
      장부행.검토 = 검토;
      const 막힘 = (검토.구멍들 || []).filter((g) => g.심각 === '막힘');
      console.log(`① 발주 검토: ${검토.판정} · 구멍 ${(검토.구멍들 || []).length}건(막힘 ${막힘.length}) · 질문 ${(검토.질문들 || []).length}건`);
      (검토.구멍들 || []).forEach((g) => console.log(`   ${g.심각 === '막힘' ? '🔴' : '🟡'} [${g.종류}] ${g.내용}`));
      (검토.질문들 || []).forEach((q) => console.log(`   ❔ ${q}`));
      if (막힘.length) {
        장부행.상태 = '발주보완필요'; 장부적기(장부행);
        console.log('🔴 발주서를 보완한 뒤 다시 부른다 — 막힘이 있는 발주로 실행자를 태우지 않는다.');
        마감(1, `발주 검토 막힘 ${막힘.length}건`); return 1;
      }
    } catch (e) {
      장부행.상태 = '확인불가'; 장부행.사유 = '발주 검토: ' + e.message; 장부적기(장부행);
      console.error('🔴 확인 불가 — 발주 검토가 안 돌았다: ' + e.message); 마감(2, e.message); return 2;
    }
  }

  /* 🔴 실행 «전»에 시험의 지문을 뜬다 — 뒤에 뜨면 실행자가 이미 고친 뒤라 「원본」이 아니다(:183). */
  const 원본시험 = 시험지문들(wt);
  const 지금지문 = (f) => {
    try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(wt, f))).digest('hex'); }
    catch (_) { return null; }
  };
  console.log(`시험 파일 ${원본시험.size}벌을 «못 고침»으로 잠갔다${검사.시험수정허용.length ? ` · 발주서가 연 것 ${검사.시험수정허용.length}개: ${검사.시험수정허용.join(' · ')}` : ''}`);

  // ②~⑦ 라운드
  let 앞라운드 = null;
  let 마지막 = null;
  for (let 라운드 = 1; 라운드 <= 라운드상한; 라운드++) {
    const 기록 = { 라운드, sha: null, 이어받음: [], 실행: null, 범위밖: [], 비밀: [], 시험손댐: [], 시험: [], 검수: null, 수용: null };
    장부행.라운드들.push(기록);
    /* 🔴 실행 «전» 워크트리에 이미 있던 변경 = **앞 회차가 짓다 만 잔해**다(한도·타임아웃으로 죽은 런은
     *   커밋을 안 남기지만 파일은 남긴다 — 09-05 실측). 워크트리가 발주 지문으로 정해져 다시 부르면
     *   같은 자리로 돌아오므로, 그 잔해는 이 라운드의 커밋에 **그대로 섞여 들어간다**.
     * 🔑 그 자체는 「이어 돈다」라 옳은데, 안 적으면 커밋 제목이 「라운드 N」 하나뿐이라 읽는 사람이
     *   **이번 회차가 지은 것으로 읽는다.** 벽(범위·비밀·시험)은 잔해에도 걸리니 안전 문제가 아니라
     *   «누가 지었나»가 사라지는 문제다 — 그래서 화면·커밋·장부 세 곳에 갈라 적는다. */
    const 잔해 = 변경파일들(wt);
    기록.이어받음 = 잔해;
    if (잔해.length) console.log(`\n⏭ 앞 회차가 짓다 만 것 ${잔해.length}개를 이어받는다(이번 회차가 지은 것이 아니다): ${잔해.join(' · ')}`);
    console.log(`\n② 실행 라운드 ${라운드}/${라운드상한} — 코덱스가 워크트리에 짓는다(최대 ${초}초)…`);
    try {
      기록.실행 = 스키마호출(쓰기플래그, 실행설정, 실행스키마, 실행프롬프트({ 발주서, 실행자절, 공통, 라운드, 앞라운드 }), 초, `실행 ${라운드}`, wt);
    } catch (e) {
      장부행.상태 = '확인불가'; 장부행.사유 = `실행 ${라운드}: ` + e.message; 장부적기(장부행);
      console.error('🔴 확인 불가 — 실행이 안 돌았다: ' + e.message); 마감(2, e.message); return 2;
    }
    console.log(`   실행자: ${기록.실행.상태} · ${기록.실행.요약}`);
    (기록.실행.남긴것 || []).forEach((s) => console.log(`   ⏳ 남긴 것: ${s}`));
    (기록.실행.발주밖발견 || []).forEach((s) => console.log(`   👀 발주 밖 발견: ${s}`));

    // ③ 범위·비밀·시험 — 도구가 잰다
    const 파일들 = 변경파일들(wt);
    기록.범위밖 = 범위밖(파일들, 검사.허용경로들);
    if (!파일들.length) {
      console.log('🟡 워크트리에 바뀐 파일이 0개다 — 실행자가 아무것도 안 지었다.');
    }
    if (기록.범위밖.length) {
      장부행.상태 = '범위밖'; 장부적기(장부행);
      console.error(`🔴 «범위» 밖 파일 ${기록.범위밖.length}개를 만졌다 — 커밋하지 않는다(워크트리는 그대로 두었다 · 읽고 정한다):`);
      기록.범위밖.forEach((f) => console.error('   · ' + f));
      마감(1, `범위 밖 ${기록.범위밖.length}개`); return 1;
    }
    /* 🔴 자기 채점 — 자를 고쳤으면 시험을 «돌리기 전»에 멈춘다. 돌린 뒤에 재면 그 초록이 장부에 남는다. */
    기록.시험손댐 = 시험손댐(파일들, 원본시험, 지금지문, 검사.시험수정허용);
    if (기록.시험손댐.length) {
      장부행.상태 = '시험손댐'; 장부적기(장부행);
      console.error(`🔴 실행자가 «저를 재는 시험» ${기록.시험손댐.length}개를 손댔다 — 커밋하지 않는다(워크트리는 그대로 · 읽고 정한다):`);
      기록.시험손댐.forEach((f) => console.error('   · ' + f));
      console.error('   시험을 정말 고쳐야 하는 발주면 발주서에 «## 시험 수정 허용» 절로 그 파일을 이름 대어 연다.');
      마감(1, `시험 손댐 ${기록.시험손댐.length}개`); return 1;
    }
    let 디프 = '';
    try { git(wt, ['add', '-A', '--', ...파일들]); 디프 = git(wt, ['diff', '--cached']); } catch (_) { 디프 = ''; }
    기록.비밀 = 비밀검사(디프);
    if (기록.비밀.length) {
      try { git(wt, ['reset', '-q']); } catch (_) { /* 스테이징만 푼다 */ }
      장부행.상태 = '비밀무늬'; 장부적기(장부행);
      console.error(`🔴 변경분에 비밀처럼 생긴 무늬 ${기록.비밀.length}건 — 커밋하지 않는다: ${기록.비밀.join(' · ')}`);
      마감(1, '비밀 무늬'); return 1;
    }
    기록.시험 = 시험돌리기(wt, 검사.시험명령들);
    console.log(`③ 시험(도구가 돌렸다): ${시험결과줄(기록.시험)}`);
    기록.시험.filter((r) => !r.통과).forEach((r) => console.log(`   ✗ ${r.명령}\n${r.꼬리.split('\n').map((l) => '     ' + l).join('\n')}`));

    // ④ 커밋 — 범위 안 파일만(위에서 범위 밖 0 을 확인했다)
    if (파일들.length) {
      /* 이어받은 것은 «이번에 커밋되는 파일» 과 교집합만 센다 — 앞 회차 잔해를 실행자가 지웠으면
       * 그건 이어받은 것이 아니다. 제목에도 한 마디 넣는다: `--oneline` 만 보는 눈에도 보이게. */
      const 이어받은 = 기록.이어받음.filter((f) => 파일들.includes(f));
      const 제목 = `${실행자제목접두} ${검사.제목.replace(/^발주\s*[—-]\s*/, '')} (라운드 ${라운드}${이어받은.length ? ` · 앞 회차 이어받음 ${이어받은.length}` : ''})`;
      const 몸 = `발주 ${장부행.발주.경로} · 지문 ${지문} · 모델 ${실행설정.model}/${실행설정.effort}\n시험: ${시험결과줄(기록.시험)}`
        + (이어받은.length ? `\n⏭ 이 커밋의 ${이어받은.length}개는 «앞 회차가 짓다 만 것»을 이어받은 것이다(이번 라운드가 새로 지은 것이 아니다): ${이어받은.join(' · ')}` : '')
        + `\n\nCo-Authored-By: Codex ${실행설정.model} <noreply@openai.com>`;
      try {
        git(wt, ['commit', '-q', '-m', 제목, '-m', 몸, '--', ...파일들]);
        기록.sha = git(wt, ['rev-parse', 'HEAD']);
        console.log(`④ 커밋 ${기록.sha.slice(0, 9)} (${가지}) · 파일 ${파일들.length}개`);
      } catch (e) {
        장부행.상태 = '확인불가'; 장부행.사유 = '커밋 실패: ' + String((e && e.stderr) || e.message).split('\n').filter(Boolean).slice(-3).join(' / '); 장부적기(장부행);
        console.error('🔴 커밋이 안 됐다(pre-commit 가드가 막았을 수 있다): ' + 장부행.사유); 마감(2, 장부행.사유); return 2;
      }
    } else {
      기록.sha = null;
    }

    // ⑤ 검수 — 다른 세션
    let 지적들 = [];
    /* 이 라운드가 커밋을 안 냈어도 가지 끝에 실행자 커밋이 있으면 그것이 «이 런의 산출물»이다.
     * 도장이 이미 있으면 다시 안 찍고 그 행의 차단급을 그대로 이어 읽는다(안 읽으면 앞서 잡힌
     * 차단급이 사라져 또 다른 거짓 초록이 된다). */
    const 가지끝 = 기록.sha || 가지끝실행자커밋(wt);
    const 검수대상 = 기록.sha || (가지끝 && !검수행찾기(가지끝) ? 가지끝 : null);
    기록.검수대상 = 검수대상;
    if (!기록.sha && 검수대상) {
      console.log(`⑤ 새로 지은 것은 없지만 가지 끝 커밋 ${검수대상.slice(0, 9)} 에 **검수 도장이 없다** — 그것을 검수한다(앞 회차가 검수에서 끊겼을 때의 자리다).`);
    }
    if (!검수대상 && 가지끝 && !argv.includes('--검수안함')) {
      const 앞행 = 검수행찾기(가지끝);
      지적들 = 앞행 ? 차단지적들(앞행) : [];
      기록.검수 = { 종료: 0, 지적수: 앞행 ? (앞행.지적 || []).length : null, 차단수: 지적들.length, 요약: 앞행 ? 앞행.요약 : null, 이미찍힘: true };
      console.log(`⑤ 가지 끝 커밋 ${가지끝.slice(0, 9)} 엔 이미 검수 도장이 있다 — 다시 안 찍는다 · 차단급 ${지적들.length}건`);
    }
    if (검수대상 && !argv.includes('--검수안함')) {
      console.log(`⑤ 검수(codex-review · 새 세션 · 읽기 전용)… 최대 ${Math.min(초, 1800)}초`);
      const r = 검수부르기(wt, 검수대상, Math.min(초, 1800), argv.includes('--버그만'));
      기록.검수 = { 종료: r.종료, 지적수: r.행 ? (r.행.지적 || []).length : null, 차단수: r.행 ? 차단지적들(r.행).length : null, 요약: r.행 ? r.행.요약 : null };
      if (r.종료 === 2 || !r.행) {
        장부행.상태 = '검수확인불가'; 장부적기(장부행);
        console.error('🔴 검수가 «확인 불가»로 끝났다(통과가 아니다) — 로그 꼬리:\n' + r.꼬리.split('\n').map((l) => '   ' + l).join('\n'));
        마감(2, '검수 확인 불가'); return 2;
      }
      지적들 = 차단지적들(r.행);
      console.log(`   검수: 지적 ${기록.검수.지적수}건 · 차단급 ${기록.검수.차단수}건 · ${기록.검수.요약 || ''}`);
      지적들.forEach((z) => console.log(`   🔴 [${z.등급}] ${z.파일}:${z.라인} ${z.제목}`));
    }

    // ⑥ 수용 대조
    let 미충족 = [];
    if (가지끝) {
      try {
        const diff = git(wt, ['show', '--format=%H %s', 가지끝]).slice(0, 검수.디프상한 || 200000);
        const 대조 = 스키마호출(읽기플래그, 판단설정, 수용스키마, 수용대조프롬프트(검사.수용기준들, diff, 시험결과줄(기록.시험)), Math.min(초, 1200), '수용 대조', wt);
        기록.수용 = 대조;
        미충족 = (대조.항목 || []).filter((x) => x.판정 !== '충족');
        console.log(`⑥ 수용 대조: 충족 ${(대조.항목 || []).length - 미충족.length}/${(대조.항목 || []).length} · ${대조.요약}`);
        미충족.forEach((x) => console.log(`   ${x.판정 === '미충족' ? '🔴' : '🟡'} ${x.기준} — ${x.근거}`));
      } catch (e) {
        기록.수용 = { 확인불가: e.message };
        console.error('🟡 수용 대조가 안 돌았다(확인 불가): ' + e.message);
      }
    }

    const 시험실패 = 기록.시험.filter((r) => !r.통과).map((r) => `${r.명령} → ${r.시간초과 ? '시간초과' : '종료 ' + r.종료}\n${r.꼬리}`);
    const 진짜미충족 = 미충족.filter((x) => x.판정 === '미충족');
    /* 🔴 09-05 실측 — 수용 대조가 한도로 못 돌아도 「✅ 완주 · 미충족 0 · 종료 0」이 나왔다.
     *   그 «0»은 「0건」이 아니라 «안 쟀다»다. 수용 기준은 발주서가 정한 «이게 되면 합격»이고
     *   그걸 재는 자는 이 단계 하나뿐이라, 못 잰 채 찍힌 완주 도장은 아무도 안 본 합격이 된다.
     *   ⑤ 검수는 확인 불가면 멈추는데 ⑥ 만 삼키고 있었다 — 두 «모델 판정»의 대칭을 맞춘다.
     * 🔑 다만 종료는 2 가 아니라 1 이다: 커밋·시험·검수는 실제로 끝났고 빈 것은 마지막 확인 하나다.
     *   같은 명령을 다시 부르면 ⑥ 이 가지 끝을 보고 그것만 마저 잰다(수리 라운드는 돌 이유가 없다). */
    const 수용못잼 = !!(기록.수용 && 기록.수용.확인불가);
    마지막 = { 라운드, 지적들, 미충족: 진짜미충족, 시험실패, sha: 가지끝, 수용못잼, 이어받음: 기록.이어받음.filter((f) => 파일들.includes(f)) };
    /* 완주의 조건은 «이 런이 커밋을 냈나»가 아니라 «가지에 산출물이 서 있나»다 — 앞 회차가
     * 커밋까지 갔고 이번엔 검수만 마저 붙인 경우도 완주다(09-05). */
    if (!지적들.length && !진짜미충족.length && !시험실패.length && !수용못잼 && 가지끝) {
      장부행.상태 = '완주'; 장부적기(장부행);
      break;
    }
    if (수용못잼 && !지적들.length && !진짜미충족.length && !시험실패.length) {
      장부행.상태 = '수용확인불가'; 장부적기(장부행);
      break;   // 고칠 지적이 있는 게 아니라 «못 잰» 것이다 — 실행자를 다시 태우지 않는다
    }
    앞라운드 = 마지막;
    if (라운드 === 라운드상한) { 장부행.상태 = '남음'; 장부적기(장부행); }
  }

  // ⑧ 보고 — 사람(클로드)이 읽는 자리
  console.log('\n══ 실행자 레인 결과 ══');
  console.log(`가지 ${가지} · 워크트리 ${wt}${마지막 && 마지막.sha ? ` · 마지막 커밋 ${마지막.sha.slice(0, 9)}` : ' · 커밋 없음'}`);
  /* 앞 회차 잔해가 섞였으면 «합칠지 정하는 사람»이 그걸 모르고 읽지 않게 여기서도 말한다. */
  if (마지막 && 마지막.이어받음 && 마지막.이어받음.length) {
    console.log(`⏭ 이 가지에는 «앞 회차가 짓다 만 것» ${마지막.이어받음.length}개가 섞여 있다(이번 실행이 지은 것이 아니다): ${마지막.이어받음.join(' · ')}`);
  }
  if (장부행.상태 === '완주') {
    console.log('✅ 완주 — 차단급 0 · 미충족 0 · 시험 통과. 다음은 클로드 몫: 가지를 읽고 의미·통합을 확인한 뒤 master 에 합친다.');
    console.log(`   보는 법: git -C "${root}" log --oneline master..${가지} · git -C "${root}" diff master...${가지}`);
    console.log(`   합치기: git -C "${root}" merge --no-ff ${가지}   (그 뒤 배포는 유호님 승인 — /deploy · 원격배포)`);
    마감(0, '완주'); return 0;
  }
  console.log(`🟠 처리할 것이 남았다(라운드 ${마지막 ? 마지막.라운드 : 0}/${라운드상한}):`);
  if (마지막) {
    마지막.시험실패.forEach((s) => console.log(`   ✗ 시험: ${s.split('\n')[0]}`));
    마지막.지적들.forEach((z) => console.log(`   🔴 [${z.등급}] ${z.파일}:${z.라인} ${z.제목}`));
    마지막.미충족.forEach((x) => console.log(`   🔴 미충족: ${x.기준}`));
    if (마지막.수용못잼) {
      console.log('   🟡 수용 대조를 **못 쟀다**(「미충족 0건」이 아니다) — 발주서의 수용 기준이 실제로 충족됐는지 아직 아무도 안 봤다.');
      console.log('      같은 명령을 다시 부르면 그것만 마저 잰다(실행자는 다시 안 태운다). 이대로 합치면 «수용 미검증»을 밝힌다.');
    }
  }
  console.log('   클로드가 읽고 정한다 — 오판이면 검수 지적은 `node tools/codex-review.js --기각 <키> --사유 "…"`, 남은 일은 발주서를 고쳐 같은 명령으로 다시(같은 워크트리에서 이어 돈다).');
  마감(1, 마지막 && 마지막.수용못잼 ? '수용 대조 확인 불가(못 쟀다 — 미충족 0 이 아니다)' : `남음 — 라운드 ${마지막 ? 마지막.라운드 : 0}`); return 1;
}

module.exports = {
  발주서검사, 절나누기, 항목들, 경로항목, 경로정규화, 경로맞나, 경로금지인가, 금지경로들, 범위밖,
  시험파일인가, 시험무늬, 시험지문들, 시험손댐,
  비밀검사, 비밀무늬들, 정본절, 발주검토프롬프트, 실행프롬프트, 수용대조프롬프트,
  쓰기플래그, 읽기플래그, 발주지문, 가지이름, 워크트리경로, 시험결과줄, 차단지적들, 검수행찾기,
  공통지침정본, 공통지침경로, 아는플래그, 필수절, 선택절, 기록경로, 정본경로,
};

if (require.main === module) {
  let 코드;
  try { 코드 = main(process.argv.slice(2)); }
  catch (e) {
    console.error('🔴 확인 불가 — ' + String((e && e.message) || e));
    마감(2, String((e && e.message) || e));
    코드 = 2;
  }
  process.exit(코드);
}
