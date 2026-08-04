#!/usr/bin/env node
// track-collision — 남의 커밋이 **내 세션 도중** 내 자리에 착지하면 알린다 (PreToolUse 훅)
//
// 왜 있나 (F070 · 2026-08-04, 하루 두 번째):
//   같은 트랙이 두 세션에서 병렬로 돌아 같은 가드를 따로 구현했다
//   (c04e7b7 shell-inline-guard 안 vs b927369 새 훅). 크루카드 포크에 이은 두 번째다.
//
//   🔑 근본 원인은 규약 위반이 아니다 — **규약을 다 지켜도 안 보이는 자리**다.
//      CLAUDE.md 는 "열기 직전 `git log --oneline -10`" 을 시킨다. 그건 했다. 그런데
//      상대 커밋은 그 **25분 뒤에** 착지했다. 시작 시 로그는 스냅샷이라, 세션이 길어질수록
//      「내가 본 저장소」와 「지금 저장소」의 간격이 벌어진다. 발동층이 아예 없던 자리다.
//
//   이번에 발견된 경로는 우연이었다 — 예상 밖 테스트 적색을 「고칠 것」으로 보지 않고
//   파봤기 때문이다. 그건 재현 가능한 장치가 아니라서 기계로 옮긴다.
//
// 무엇을 보나 — 세 신호. 하나라도 걸리면 알린다.
//   ① 내가 **이번 세션에 만진** 파일에 남의 커밋이 닿았다
//   ② 내가 **보드에 선언한** 파일에 남의 커밋이 닿았다 (아직 안 만졌어도 그 자리는 내 자리다)
//   ③ 남의 커밋 제목이 내 보드 줄과 **같은 표식**을 쓴다 (F0NN · [v9.NNN])
//      — 파일이 안 겹쳐도 트랙은 겹칠 수 있다. 오늘이 정확히 그 경우였다.
//
// ⚠ **절대 차단하지 않는다.** permissionDecision 을 아예 내지 않는다 —
//   ①남의 커밋이 내 편집을 금지할 근거가 없고 ②Edit 매처엔 board-guard·memory-index-guard·
//   doc-propagation 이 함께 걸려 있어, 여기서 allow 를 내면 그것들의 판정을 덮을 위험이 있다.
//   정보만 준다: systemMessage(유호님 눈) + additionalContext(AI 눈).
//
// ⚠ 같은 커밋을 두 번 알리지 않는다 — 잔소리하는 장치는 읽히지 않게 되고,
//   읽히지 않는 경고는 없는 것과 같다(screenshot-budget 사다리와 같은 원칙).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// SYNK_TRACK_ROOT = 테스트 격리 전용 이음매. 로직을 끄지 않고 **보는 저장소만** 바꾼다
// (실저장소에 커밋을 만들지 않고 탐지력을 재려면 이 자리가 필요하다 · SYNK_FRICTION_ROOT 와 같은 패턴).
const ROOT = process.env.SYNK_TRACK_ROOT || path.resolve(__dirname, '..', '..');
const 보드 = path.join(ROOT, 'docs', '세션보드.md');
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));

/** 실패를 null 로 돌려주는 git — 이 훅은 편의지 안전장치가 아니다. git 사정으로 작업을 세우지 않는다.
 *
 * 🔴 `core.quotepath=false` 가 없으면 이 훅은 **이 저장소에서 거의 아무것도 못 잡는다.**
 *    git 은 기본값으로 비ASCII 경로를 `"\354\227\224…"` 로 이스케이프해 내놓는다. 그런데 여기 파일은
 *    `엔진_수집.js`·`tests/코드편집가드.test.js`·`docs/세션보드.md` 처럼 대부분 한글이다 —
 *    경로 대조가 전부 빗나가고 결과는 「겹치는 것 없음 = 조용」이다. 가드가 새는 방향은 언제나 통과다.
 *    CLAUDE.md 「재는 층이 값을 깨뜨리지 않는지 본다 — 목록 명령이 경로를 이스케이프하면
 *    원본이 멀쩡해도 빠진 채 초록이 된다」의 정확한 실례. 회귀가 이 자리를 지킨다. */
function git(args) {
  try {
    const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: ROOT, encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (r.error || r.status !== 0) return null;
    return String(r.stdout || '');
  } catch (_) { return null; }
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const tool = String(input.tool_name || '');
if (!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) process.exit(0);

/* 세션 id 가 둘이다 — 트레일러에 박히는 건 **호스트 id** 다(prepare-commit-msg 가 그렇게 적었다).
 * 내부 에이전트 id 로 대조하면 내 커밋을 하나도 못 알아보고, 그러면 내 커밋마다 나를 경고한다. */
const 내세션 = String(process.env.CLAUDE_CODE_HOST_SESSION_ID || input.session_id || '').trim();

const 상태경로 = path.join(store.stateDir(), `track-${store.projectKey(ROOT)}-${store.safeId(내세션)}.json`);
function 상태읽기() {
  try {
    const j = JSON.parse(fs.readFileSync(상태경로, 'utf8'));
    if (!j.at || Date.now() - Number(j.at) > store.SWEEP_TTL_MS) return null;
    return j;
  } catch (_) { return null; }
}
function 상태쓰기(s) {
  try {
    fs.mkdirSync(store.stateDir(), { recursive: true });
    fs.writeFileSync(상태경로, JSON.stringify({ ...s, at: Date.now() }));
  } catch (_) { /* 못 써도 작업은 진행한다 */ }
}

const HEAD = (git(['rev-parse', 'HEAD']) || '').trim();
if (!HEAD) process.exit(0); // git 이 없거나 저장소가 아니다

/* 이번 호출에서 만진 파일 — 저장소 상대 경로로 정규화한다.
 * MultiEdit·NotebookEdit 도 file_path 를 쓴다. 저장소 밖(스크래치패드)은 담지 않는다. */
function 저장소상대(p) {
  if (!p) return null;
  const abs = path.resolve(String(p));
  const rel = path.relative(ROOT, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.replace(/\\/g, '/');
}
const 이번파일 = 저장소상대((input.tool_input && input.tool_input.file_path) || '');

const 이전 = 상태읽기();
const 만진목록 = new Set((이전 && 이전.touched) || []);
if (이번파일) 만진목록.add(이번파일);

/* 기준점(baseline) = **이 세션이 처음 이 훅을 부른 시점의 HEAD**.
 * 시계가 아니라 커밋 그래프로 잡는다 — 시각 비교는 시간대·클럭 어긋남에 물리고,
 * 이 저장소는 이미 시트 TZ 로 두 번 데였다(F062). */
if (!이전 || !이전.baseline) {
  상태쓰기({ baseline: HEAD, lastHead: HEAD, touched: [...만진목록], warned: [] });
  process.exit(0); // 첫 호출엔 비교 대상이 없다
}

const 기준 = String(이전.baseline);
const 알린것 = new Set(이전.warned || []);

// HEAD 가 그대로면 새 커밋이 없다 — 가장 흔한 경우를 rev-parse 한 번으로 끝낸다.
if (이전.lastHead === HEAD) {
  if (이번파일 && !((이전.touched || []).includes(이번파일))) {
    상태쓰기({ ...이전, touched: [...만진목록] });
  }
  process.exit(0);
}

/* 기준..HEAD. rebase·force-push 로 기준이 도달 불가가 되면 git 이 실패한다 —
 * 그때는 아는 척하지 말고 기준을 지금 HEAD 로 다시 잡는다(거짓 경고보다 조용한 편이 낫다).
 *
 * ⚠ 아래 SEP 는 **눈에 안 보이는 제어문자 0x1F(US)** 다. 커밋 제목엔 한글·`|`·`·` 가 흔해
 *   보이는 구분자를 쓸 수 없다. 편집 중 이 글자가 사라지면 `split('')` 이 되어 제목이 글자
 *   단위로 쪼개진다 — 조용히 틀리는 쪽이라 회귀가 이 자리를 지킨다(구분자처럼 생긴 제목 검사).
 *   눈으로 확인: `grep SEP .claude/hooks/track-collision.js | cat -A` → `'^_'` 로 보여야 한다. */
const SEP = '';
const 로그 = git(['log', `${기준}..HEAD`, '--no-merges', `--format=%H${SEP}%ct${SEP}%s${SEP}%(trailers:key=Session-Id,valueonly)`]);
if (로그 === null) {
  상태쓰기({ baseline: HEAD, lastHead: HEAD, touched: [...만진목록], warned: [] });
  process.exit(0);
}

const 새커밋 = 로그.split('\n').filter(Boolean).map((줄) => {
  const [sha, ct, subject, sid] = 줄.split(SEP);
  return { sha, ct: Number(ct) || 0, subject: String(subject || ''), sid: String(sid || '').trim() };
});

/* 내 보드 줄 찾기 — 「내가 만진 파일이 만지는 파일 칸에 적힌 줄」이 내 줄이다.
 * 보드 줄엔 세션 id 가 없어서 다른 식별자가 없다. 이 파생은 자기 교정적이다:
 * 내가 실제로 만진 것에서 출발하므로 남의 줄을 내 줄로 착각할 일이 적다.
 * ⚠ 여러 줄이 같은 파일을 적을 수 있어(예: settings.json) **가장 많이 겹치는 줄**을 고른다. */
function 내보드줄() {
  let 본문;
  try { 본문 = fs.readFileSync(보드, 'utf8'); } catch (_) { return null; }
  const 기저 = [...만진목록].map((f) => path.posix.basename(f)).filter(Boolean);
  if (!기저.length) return null;

  /* 🔴 동점이면 **아무 줄도 안 고른다.** 보드 줄엔 세션 id 가 없어서 동점을 가를 근거가 진짜로 없다.
   *
   * 신설 당일 같은 자리에서 **두 번** 틀렸다:
   *   ① `>` (먼저 만난 줄이 이김) → 앞줄은 오래된 남의 트랙이라, 내가 선언한 적 없는
   *      `엔진_수집.js` 를 「내가 선언한」이라고 보고했다.
   *   ② `>=` (뒤에 붙은 줄이 이김) 으로 고쳤더니, 그 사이 남이 줄을 더 붙여서
   *      이번엔 **남의 줄**이 이겼다 — 오탐이 고쳐진 게 아니라 반대편으로 옮겨갔을 뿐이다.
   *   두 방향 다 틀리는 건 heuristic 이 부족해서가 아니라 **가를 정보가 없어서**다.
   *   그래서 추측 대신 침묵한다 — 틀린 귀속은 「남의 파일을 내 자리라고 말하는 것」이라
   *   경고 자체의 신뢰를 깎는다(그러면 진짜 충돌도 안 읽힌다).
   *
   * ⚠ 대신 표식 신호는 **내 커밋 제목**에서 따로 뽑는다(아래) — 그건 Session-Id 로 확실히 내 것이라
   *   보드가 애매해도 트랙 충돌을 계속 볼 수 있다. 약한 신호만 버리고 강한 신호는 지킨다. */
  let 최고 = null, 동점 = false;
  for (const 줄 of 본문.split(/\r?\n/)) {
    if (!줄.startsWith('|')) continue;
    const 칸 = 줄.split('|').map((c) => c.trim());
    if (칸.length < 5) continue;
    const 점수 = new Set(기저.filter((b) => 줄.includes(b))).size;
    if (점수 === 0) continue;
    if (!최고 || 점수 > 최고.점수) { 최고 = { 점수, 트랙: 칸[2], 파일칸: 칸[3] }; 동점 = false; }
    else if (점수 === 최고.점수) 동점 = true;
  }
  return 동점 ? null : 최고;
}
const 내줄 = 내보드줄();

// 보드 「만지는 파일」 칸에서 경로처럼 생긴 토큰만 뽑는다(장식·설명은 버린다).
const 선언파일 = new Set();
if (내줄) {
  for (const m of 내줄.파일칸.matchAll(/[\w가-힣./_-]+\.(?:js|gs|json|html|md|yml|yaml|css|ps1|cmd)\b/g)) {
    선언파일.add(path.posix.basename(m[0]));
  }
}
/* 표식 토큰 — F0NN 과 [v9.NNN]. 파일이 안 겹쳐도 트랙은 겹칠 수 있다(오늘이 그 경우다:
 * 상대는 shell-inline-guard 를, 나는 새 훅을 만졌는데 커밋 제목의 F 번호가 같았다). */
const 표식RE = /\bF0\d{2}\b|\[v\d+\.\d+\]/g;
const 내표식 = new Set();
if (내줄) {
  for (const m of `${내줄.트랙} ${내줄.파일칸}`.matchAll(표식RE)) 내표식.add(m[0]);
}
/* 🔑 **내 커밋 제목**에서도 뽑는다 — 보드 줄과 달리 이건 Session-Id 로 확실히 내 것이다.
 *   보드 줄 판별이 동점이라 포기했을 때(위) 표식 신호까지 같이 죽지 않게 하는 자리고,
 *   보드에 아직 안 적은 표식(작업 중 새로 생긴 F 번호)도 여기서 잡힌다. */
for (const c of 새커밋) {
  if (!c.sid || !내세션 || c.sid !== 내세션) continue;
  for (const m of c.subject.matchAll(표식RE)) 내표식.add(m[0]);
}

/* 공용 장부 — **모든 세션이 규약상 만지는** 파일이다. 여기서의 겹침은 충돌이 아니라 정상이다.
 *
 * 🔴 신설 당일 라이브 프로브가 이걸 드러냈다: 기준점을 세션 시작으로 놓자 13건이 걸렸는데
 *    **11건이 `docs/세션보드.md`** 였다(각 세션의 종료 선언). 진짜 신호 2건(c04e7b7·17c9661,
 *    settings.json)이 그 밑에 묻혔다. 이 훅 머리말이 스스로 적어둔 실패 —
 *    「잔소리하는 장치는 안 읽히고, 안 읽히는 경고는 없는 것과 같다」를 만들 뻔했다.
 *
 * ⚠ settings.json 은 여기 넣지 않는다 — 그건 공용 장부가 아니라 **공유 작업면**이고,
 *   오늘 진짜 충돌이 정확히 거기서 났다. 장부와 작업면을 섞으면 신호를 통째로 버린다.
 *   장부라도 **표식 겹침**(F0NN·[v9.NNN])은 그대로 본다 — 보드 커밋 제목엔 트랙명이 들어간다. */
const 장부 = new Set([
  'docs/세션보드.md',
  'docs/세션보드_아카이브.md',
  'docs/_ops/마찰신호.md',
  'docs/버전_이력.md',
  'docs/지침_이력.md',
]);
const 장부아님 = (f) => !장부.has(f);

const 충돌 = [];
for (const c of 새커밋) {
  if (알린것.has(c.sha)) continue;
  if (c.sid && 내세션 && c.sid === 내세션) continue; // 내 커밋

  const 파일들 = (git(['show', '--name-only', '--format=', c.sha]) || '')
    .split('\n').map((s) => s.trim()).filter(Boolean);

  const 만진겹침 = 파일들.filter((f) => 만진목록.has(f) && 장부아님(f));
  const 선언겹침 = 파일들.filter((f) => 선언파일.has(path.posix.basename(f)) && !만진목록.has(f) && 장부아님(f));
  const 표식겹침 = [...내표식].filter((t) => c.subject.includes(t));

  if (!만진겹침.length && !선언겹침.length && !표식겹침.length) continue;
  충돌.push({ ...c, 만진겹침, 선언겹침, 표식겹침 });
}

// 새 커밋은 전부 「본 것」으로 표시한다 — 겹치지 않은 것까지 매번 다시 조회하지 않는다.
상태쓰기({
  baseline: 기준,
  lastHead: HEAD,
  touched: [...만진목록],
  warned: [...new Set([...알린것, ...새커밋.map((c) => c.sha)])].slice(-200),
});

if (!충돌.length) process.exit(0);

const 나이 = (ct) => {
  const 분 = Math.max(0, Math.round((Date.now() / 1000 - ct) / 60));
  return 분 < 60 ? `${분}분 전` : `${Math.round(분 / 60)}시간 전`;
};

/* 표시는 최신 5건까지. 길면 안 읽히고, 안 읽히는 경고는 없는 것과 같다.
 * ⚠ 자른 것은 **숫자로 밝힌다** — 조용한 절단은 「이게 전부」로 읽힌다(CLAUDE.md 가드 조항). */
const 최대표시 = 5;
const 표시 = 충돌.slice(0, 최대표시);
const 잘림 = 충돌.length - 표시.length;

const 줄들 = 표시.map((c) => {
  const 왜 = [
    c.만진겹침.length ? `내가 만진 ${c.만진겹침.join(', ')}` : '',
    c.선언겹침.length ? `내가 선언한 ${c.선언겹침.join(', ')}` : '',
    c.표식겹침.length ? `같은 표식 ${c.표식겹침.join('·')}` : '',
  ].filter(Boolean).join(' · ');
  const 주인 = c.sid ? c.sid.slice(0, 20) : '주인 미상(트레일러 없음)';
  return `  · ${c.sha.slice(0, 7)} (${나이(c.ct)}, ${주인})\n      ${c.subject}\n      ↳ ${왜}`;
});

const 본문 =
  `[track-collision] 내 세션이 시작된 뒤 **남의 커밋 ${충돌.length}건**이 내 자리에 착지했다.\n`
  + `${줄들.join('\n')}\n`
  + (잘림 > 0 ? `  … 그리고 ${잘림}건 더(오래된 순). 전부 보려면 \`git log ${기준.slice(0, 7)}..HEAD --oneline\`\n` : '')
  + '\n'
  + '왜 알리나: 시작 시 `git log` 는 스냅샷이라 세션 도중 착지가 안 보인다. F070 실사고 —\n'
  + '같은 트랙이 두 세션에서 병렬로 돌아 같은 가드를 따로 구현했다(하루 두 번째).\n\n'
  + '→ 계속하기 전에:\n'
  + '   1) `git show <sha>` 로 **그 커밋을 먼저 읽는다** — 같은 트랙이면 새로 짓지 말고 물린다.\n'
  + '   2) 내 작업과 겹치면 조율은 실행 조율만(편집권·순서·인계). 방향·비가역 승인은 유호님 몫이다.\n'
  + '   3) 조율한 사실을 **커밋 메시지나 보드 줄에 1줄** 남긴다(메시지는 전달이 보장되지 않는다).';

process.stdout.write(JSON.stringify({
  systemMessage: `⚠ 남의 커밋 ${충돌.length}건이 내 자리에 착지했다 — ${충돌.map((c) => c.sha.slice(0, 7)).join(', ')}`,
  hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 본문 },
}));
process.exit(0);
