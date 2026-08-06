#!/usr/bin/env node
/* auto-commit — 턴이 끝날 때 내 편집을 그 자리에서 커밋해 **미커밋 노출 시간을 0으로** (Stop 훅)
 *
 * 왜 있나 (2026-08-07 · 유호님 지시 「인계문 쓰던 방식 그대로, 충돌 안 나게」):
 *   마찰장부 169건에서 가장 많은 단어가 「미커밋」(34회)이다. F025(미추적이 git clean 에 소멸 —
 *   이력·stash·reflog 어디에도 없음) · F037(추적 미커밋이 남의 rebase --abort 에 쓸림) ·
 *   F073(내 미커밋이 남의 커밋에 실려 나감) — 셋 다 **미커밋으로 떠 있는 시간**에만 일어난다.
 *   세션을 8개로 늘리면 그 시간대가 서로 겹친다. 처방은 파일 구조가 아니라 시간이다:
 *   편집이 끝난 턴에 바로 커밋하면 노출 창 자체가 사라진다.
 *
 * 무엇을 커밋하나 — **「내것 ∧ 함께 없음」만** (git-scope-guard ⑧과 같은 조건):
 *   · 내 세션이 Edit·Write 로 만진 파일(track-collision 기록)  ∩  지금 미커밋인 파일
 *   · 판정 재료는 tools/작업본소유자.js 의 세션들()·살았나 **하나**에서 가져온다 —
 *     같은 판정을 두 곳에 적으면 갈라지고, 갈라진 쪽의 증상은 언제나 「통과」다(맹점 ④).
 *   · 살아있는 다른 세션이 같은 파일을 만졌으면(F104 「함께」) 그 파일은 남기고 알린다 —
 *     경로를 못 박아도 같은 파일 안의 남의 줄은 함께 실린다.
 *
 * 커밋하지 않는 것:
 *   · docs/세션보드.md · 세션보드_아카이브.md — F102 🚫보드 자동커밋(이동은 board-move.js 의 의식)
 *   · docs/_ops/마찰신호.md — friction-close-guard 가 Bash 층에서 지키는 통로를 우회하지 않는다
 *   · ../ 형제 저장소 — 이 훅은 이 저장소만 본다(SYNK-talk 는 그쪽 규약이 따로 있다)
 *   · 구문 깨진 .js — 반쪽 문장을 스냅샷으로 남기면 push 순간 CI 가 빨개진다(F078 계열).
 *     고쳐지면 다음 턴에 자동으로 실린다. ponytail: 그동안 그 파일만 노출 상태로 남는다 —
 *     lone 깨짐은 침묵이지만 /close 와 작업본소유자 SessionStart 가 어차피 띄운다.
 *   · 삭제 — Edit·Write 는 지우지 않으므로 삭제는 내 기록 밖의 손이다.
 *   · Bash·외부 앱이 만든 변경 — 기록이 없어 원리적으로 못 가른다(모름은 커밋하지 않는다).
 *
 * 안전 형태:
 *   · 제목은 항상 「자동커밋: 」으로 시작 — `[배포]` 로 시작하면 deploy-live 가 라이브를 태운다.
 *   · [vNEXT] 헤더는 그대로 커밋해도 안전 — bump-version 의 자리표 설계가 그 목적이다.
 *   · rebase·merge·cherry-pick 진행 중엔 아무것도 안 한다(F035·F038).
 *   · index.lock 경합(옆 세션 훅과 동시 커밋)은 300ms 3회만 기다린다.
 *   · 커밋했다고 믿지 않고 결과를 본다(F071) — 그 경로들이 깨끗해졌는지 재확인.
 *   · 실패는 어느 층이든 exit 0 — 이 훅은 편의 장치지 가드가 아니다. 못 하면 조용히 물러나고,
 *     노출은 기존 통로(/close·작업본소유자)가 그대로 받는다.
 *   · 커밋한 턴에만 입을 연다 — 잔소리하는 장치는 읽히지 않게 된다(작업본소유자와 같은 원칙).
 *   · 끄기: settings.json 의 등록을 지우거나 SYNK_AUTOCOMMIT_OFF=1.
 *
 * 회귀: tests/자동커밋.test.js (픽스처 저장소 — 실저장소에는 아무 것도 하지 않는다)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.env.SYNK_AUTOCOMMIT_OFF === '1') process.exit(0);

let input = {};
try {
  const raw = fs.readFileSync(0, 'utf8');
  input = raw ? JSON.parse(raw) : {};
} catch (_) { process.exit(0); }

const ROOT = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const 원본sid = String(process.env.CLAUDE_CODE_HOST_SESSION_ID || input.session_id || '').trim();
if (!원본sid) process.exit(0);

/* 판정층은 하나 — 작업본소유자를 읽기만 한다. 못 읽으면 추측 커밋 대신 침묵(안전한 방향). */
let owner; let store;
try {
  owner = require(path.join(__dirname, '..', '..', 'tools', '작업본소유자.js'));
  store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
} catch (_) { process.exit(0); }
const 나 = store.safeId(원본sid);

function git(args) {
  return spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 15000, windowsHide: true,
    // Session-Id 트레일러(prepare-commit-msg)가 이 변수를 읽는다 — 없으면 커밋이 주인 없는 채로 남는다(F142 계열)
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 원본sid },
  });
}
const gitOk = (args) => { const r = git(args); return (!r.error && r.status === 0) ? String(r.stdout || '') : null; };

if (gitOk(['rev-parse', '--is-inside-work-tree']) === null) process.exit(0);
for (const 상태 of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD']) {
  const o = gitOk(['rev-parse', '--git-path', 상태]);
  if (o && fs.existsSync(path.resolve(ROOT, o.trim()))) process.exit(0); // 그 상태를 만든 손이 끝낼 일이다
}

let 산것들;
try { 산것들 = owner.세션들(ROOT).filter(owner.살았나); } catch (_) { process.exit(0); }
const 슬래시 = (f) => String(f).replace(/\\/g, '/');
const 내기록 = 산것들.find((s) => s.sid === 나);
if (!내기록 || !내기록.touched.length) process.exit(0);
const 남의만짐 = new Set();
for (const s of 산것들) if (s.sid !== 나) for (const f of s.touched) 남의만짐.add(슬래시(f));

/* 미커밋 목록 — `-z` 라 경로가 날것으로 온다(이스케이프 층이 값을 깨뜨리지 않는다 · F045 계열).
 * `-uall` 이 없으면 새 폴더의 미추적이 `?? docs/` 한 줄로 접혀 파일이 사라진다(작업본소유자 실측). */
const zr = git(['status', '--porcelain', '-z', '-uall']);
if (zr.error || zr.status !== 0) process.exit(0);
const 토큰 = String(zr.stdout || '').split('\0').filter(Boolean);
const 더러움 = new Set();
for (let i = 0; i < 토큰.length; i++) {
  const xy = 토큰[i].slice(0, 2);
  더러움.add(토큰[i].slice(3));
  if (/[RC]/.test(xy)) i++; // 이름바뀜: 다음 토큰은 옛 경로 — 새 경로가 지금 자리다
}

const 제외 = new Set([
  'docs/세션보드.md', 'docs/세션보드_아카이브.md', // F102 — 🚫보드 자동커밋
  'docs/_ops/마찰신호.md',                          // friction-close-guard 통로 보존
]);

const 후보 = []; const 함께남김 = []; const 깨짐 = [];
for (const f0 of 내기록.touched) {
  const f = 슬래시(f0);
  if (f.startsWith('../') || 제외.has(f) || !더러움.has(f)) continue;
  const 절대 = path.join(ROOT, f);
  if (!fs.existsSync(절대)) continue;
  if (남의만짐.has(f)) { 함께남김.push(f); continue; } // 내것 ∧ 함께 없음 만 (F104)
  if (/\.(js|mjs|cjs)$/.test(f)) {
    const c = spawnSync(process.execPath, ['--check', 절대], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    if (c.error || c.status !== 0) { 깨짐.push(f); continue; }
  }
  if (/\.json$/.test(f)) { // 깨진 settings.json 이 실리면 다음 세션의 훅 전체가 죽는다 — 같은 대기 통로로
    try { JSON.parse(fs.readFileSync(절대, 'utf8')); } catch (_) { 깨짐.push(f); continue; }
  }
  후보.push(f);
}
if (!후보.length) process.exit(0);

const 이름들 = 후보.map((f) => path.basename(f));
const 머리 = 이름들.slice(0, 3).join('·') + (이름들.length > 3 ? ` +${이름들.length - 3}` : '');
// ⚠ 제목이 [배포] 로 시작하면 deploy-live 가 라이브 배포를 대행한다 — 이 고정 접두가 그 사고를 원천 차단한다.
const 메시지 = `자동커밋: ${머리} — 미커밋 노출 차단(Stop 훅)`;

const say = (글) => { process.stdout.write(JSON.stringify({ systemMessage: 글 })); process.exit(0); };

const add = git(['add', '--', ...후보]);
if (add.error || add.status !== 0) say(`[자동커밋] add 실패 — 이번 턴은 물러난다: ${String(add.stderr || add.error || '').trim().slice(0, 200)}`);

let cm;
for (let 시도 = 0; 시도 < 3; 시도++) {
  cm = git(['commit', '-m', 메시지, '--', ...후보]);
  if (!cm.error && cm.status === 0) break;
  if (!/index\.lock/.test(String(cm.stderr || ''))) break;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); // 옆 세션 훅과의 락 경합만 기다린다
}
if (cm.error || cm.status !== 0) say(`[자동커밋] 커밋 실패 — 이번 턴은 물러난다: ${String(cm.stderr || cm.error || '').trim().slice(0, 200)}`);

/* 커밋했다고 믿지 말고 결과를 본다(F071) — 겹침·경로 어긋남이면 git 은 성공처럼 조용히 지나간다. */
const 남은 = gitOk(['status', '--porcelain', '-z', '--', ...후보]);
if (남은 === null || 남은.trim() !== '') say(`[자동커밋] ⚠ 커밋 뒤에도 ${후보.length}개 중 일부가 미커밋으로 남았다 — git status 로 직접 확인 필요`);
const 해시 = (gitOk(['rev-parse', '--short', 'HEAD']) || '').trim();

const 줄 = [`[자동커밋] ${후보.length}개 → ${해시} (${머리})`];
if (함께남김.length) 줄.push(`⚠ 남이 함께 만진 ${함께남김.length}건은 남겼다(F104): ${함께남김.join(', ')} — git diff 로 가른 뒤 손 커밋`);
if (깨짐.length) 줄.push(`⚠ 구문 깨짐 ${깨짐.length}건 대기: ${깨짐.join(', ')} — 고쳐지면 다음 턴에 자동으로 실린다`);
say(줄.join('\n'));
