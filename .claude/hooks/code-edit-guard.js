#!/usr/bin/env node
// code-edit-guard — 코드 파일을 **셸로** 고치는 통로를 막는다 (PreToolUse 훅)
//
// 왜 있나 — 같은 사고가 **네 번** 났고, 넷 다 결말이 같다: 원복이 실패해 **파일이 변이 상태로 남았다**.
//   F050  파이썬 heredoc 으로 테스트 파일을 편집 → 이스케이프가 꼬여 두 번 깨뜨렸다
//   F065  python subprocess 로 코드 파일을 변이 → 자식 stdout 을 CP949 로 디코드하다 예외,
//         **원복 라인이 실행되지 않았다**
//   F067  `sed -i` 로 SYNK-talk `tools/eval-score.js` 변이 → 백업 `cp` 가 /tmp 로 가서 원복 실패
//   그리고 직전 세션이 네 번째를 밟았다. CLAUDE.md 「3번째 = 원인을 쓸 수 없게 만든다 —
//   호출부마다 고치는 대신 **잘못 쓸 수 없는 공용 통로**를 만들고 옛 통로를 테스트로 금지」의 적용.
//
// 🔑 셋의 공통 구조는 「빨리 하려고」가 아니라 **원복이 별도 단계라는 것**이다.
//   셸 변이는 (백업 → 변이 → 검사 → 원복) 4단계고, 중간에 죽으면 3단계에서 멈춘다.
//   `Edit` 도구는 변이도 원복도 **같은 한 수**라 중간 상태가 존재하지 않는다.
//   그래서 이 훅이 권하는 것은 "조심하라"가 아니라 **단계를 없애는 도구**다.
//
// ⚠ 임시 변이 테스트도 예외가 아니다 — F067 이 정확히 그 변명으로 났다(「변이 테스트를 빨리 돌리려고」).
//
// 무엇을 막나 (셋 다 실사고의 형태 그대로):
//   ① in-place 편집기      sed -i · perl -pi · ruby -i            (F067)
//   ② 코드 파일에 써넣기    > · >> · tee · cp/mv 덮어쓰기 · PowerShell 쓰기 cmdlet
//   ③ 인라인 스크립트의 쓰기 node -e/python -c/힙독 안의 writeFileSync·open(...,'w')  (F050·F065)
//
// 무엇을 안 막나 (거짓양성은 BYPASS 를 습관으로 가르친다 · v6.11):
//   · 스트림 편집(`sed 's/a/b/' f`), 읽기(`cat`·`grep`·`node --check`)
//   · **repo 도구 실행**(`node tools/로고주입.js`) — 정본 하나가 여러 파일을 갱신하는 건
//     이 훅이 권하는 **반대편 정답**이다(변환이 반복되면 스크립트가 아니라 도구로 굳힌다)
//   · 임시 경로(스크래치패드·/tmp·AppData\Local\Temp·/dev/null) 쓰기
//   · **cp·mv 로 「없는 이름」에 만들기** — rename(`mv X X_구판.html`)과 새 사본 뜨기.
//     F076: 여기서 2회 연속 BYPASS 가 나왔다. 규칙 이름은 「덮어쓰기」인데 **덮어쓸 것이
//     있는지를 한 번도 안 봤다.** 게다가 이 훅의 처방은 「`Edit` 도구로 고쳐라」인데
//     `Edit` 는 파일을 옮기지도 복사하지도 못한다 — **따를 수 없는 처방을 주는 가드는
//     설계상 BYPASS 를 가르친다.** 대상이 실제로 있을 때만 막는다(아래 ②-b).
//
// 의도적 예외: 명령에 CODE_EDIT_BYPASS=1 을 붙인다.
'use strict';
const fs = require('fs');
const path = require('path');
const { stripNonExecutedText } = require(path.join(__dirname, 'lib', 'shell-text.js'));
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));   // 심장박동 — 아래 입력 파싱 직후

/* 코드 파일 = 「깨지면 실행이 멈추거나 배포가 나가는 것」.
 * 목록을 하나에서 파생시킨다 — 훅 안에서도 같은 판정을 두 곳에 적으면 갈라진다(F063). */
const 코드확장 = ['js', 'gs', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'html', 'htm', 'css', 'py', 'sh', 'ps1', 'yml', 'yaml'];
const 확장RE = new RegExp(`\\.(${코드확장.join('|')})$`, 'i');
const 경로RE = new RegExp(`[^\\s'"|;&<>()]*\\.(${코드확장.join('|')})\\b`, 'gi');

function out(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

/* 처방을 먼저 준다 — 막기만 하는 가드는 우회를 가르친다.
 * 세 사고 전부 「원복이 별도 단계라 중간에 죽었다」이므로, 처방도 단계를 없애는 쪽이다. */
const 처방 =
  '\n\n→ 대신:'
  + '\n   1) **`Edit` 도구**로 고친다 — 되돌릴 때도 `Edit` 한 수다. 중간 상태가 없어 죽어도 파일이 안 남는다.'
  + '\n      일시적 변이(변이 테스트)도 예외가 아니다 — F067 이 정확히 그 변명으로 났다.'
  + '\n   2) 같은 변환을 **반복**한다면 셸이 아니라 repo 도구로 굳힌다(`tools/로고주입.js` 형태 — 정본 1개 + `--check`).'
  + '\n   3) 대상이 임시 파일이면 스크래치패드 경로로 옮긴다(그 경로는 이 훅이 안 본다).'
  + '\n      ⚠ **절대경로로 적어야 한다** — 상대 경로는 cwd 로 풀지 않으므로(풀면 temp 아래 저장소에서'
  + '\n      가드가 통째로 꺼진다) 스크래치패드 «안에서» 돌려도 `sample.js` 같은 표기는 그대로 막힌다.'
  + '\n      경로를 변수에 담았다면 **같은 명령 안에서** 대입한다 — 그건 풀어서 본다(F088).'
  + '\n      선언을 못 찾은 변수는 값이 뭔지 알 방법이 없어 그대로 막는다(모르면 막는 게 이 훅의 계약).'
  + '\n   의도적 예외라면 명령 앞에 CODE_EDIT_BYPASS=1 을 붙인다'
  + ' — PowerShell 이면 `$env:CODE_EDIT_BYPASS=1;` 로, **따옴표를 씌우면 안 걸린다**(이 저장소의 주 셸이다).';

/* ── 셸 변수 (F088) ────────────────────────────────────────────────────────
 * 이 훅이 `$d/src/x.js` 를 「코드 파일 덮어쓰기」로 막았다. 대상은 mktemp 임시 디렉터리였다.
 * 변수를 못 푸니 fail-closed 는 설계상 옳았지만, **훅이 준 처방을 따를 수가 없었다** —
 * 3번 처방이 「임시 파일이면 스크래치패드로 옮겨라」인데 이미 스크래치패드였다.
 * 따를 수 없는 처방은 BYPASS 를 손버릇으로 만들고, 그 손버릇은 진짜 덮어쓰기도 통과시킨다(F076 계열).
 *
 * 🔑 그래서 **판정을 낮추지 않는다 — 모르는 것의 범위를 좁힌다.**
 *   같은 명령 안에서 눈에 보이게 선언된 변수만 푼다. 선언을 못 찾으면 그대로 fail-closed 다.
 *   (다른 데서 온 환경변수는 여전히 모르는 값이고, 모르면 막는 게 이 훅의 계약이다.) */
let 변수 = {};

/** 같은 명령 문자열 안의 대입만 긁는다. POSIX `N=값` · PowerShell `$N = "값"`. */
function 변수표(s) {
  const t = {};
  const 값 = (m) => (m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] || '');
  const 담기 = (이름, v) => {
    /* `d=$(mktemp -d)` — 명령치환은 실행해야 알 수 있지만 mktemp 만은 **정의상** 임시다.
     *   F088 의 실제 입력이 이 모양이었다. 나머지 치환은 값을 모르니 담지 않는다(fail-closed 유지). */
    if (/\$\(|`/.test(v)) { if (/\bmktemp\b/.test(v)) t[이름] = '/tmp/mktemp'; return; }
    t[이름] = v;
  };
  let m;
  const posix = /(?:^|[\n;&|(]|\bexport\s+)\s*([A-Za-z_]\w*)=("([^"]*)"|'([^']*)'|([^\s;&|]+))/g;
  while ((m = posix.exec(s))) 담기(m[1], 값(m));
  const ps = /\$(?:env:)?([A-Za-z_]\w*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s;|]+))/g;
  while ((m = ps.exec(s))) 담기(m[1], 값(m));
  return t;
}

/** `$N`·`${N}`·`$env:N` 을 표의 값으로. 모르는 이름은 **그대로 둔다**(그래야 임시 판정에서 떨어진다). */
function 변수풀기(p) {
  let s = String(p);
  for (let i = 0; i < 3; i++) { // 중첩 대입 몇 겹까지만 — 순환이면 멈춘다
    const 전 = s;
    s = s.replace(/\$\{([A-Za-z_]\w*)\}|\$(?:env:)?([A-Za-z_]\w*)/g, (전체, a, b) => {
      const k = a || b;
      return Object.prototype.hasOwnProperty.call(변수, k) ? 변수[k] : 전체;
    });
    if (s === 전) break;
  }
  return s;
}

/** 임시·비영속 경로인가 — 여기 쓰는 건 사고가 아니다. */
function 임시경로원문(p) {
  /* ⚠ `..` 를 먼저 접는다 — `$d/../Documents/…/Code.js` 는 $d 가 /tmp 라도 임시가 **아니다**.
   *   정규화 없이 재면 `/tmp/` 가 앞에 보인다는 이유로 진짜 덮어쓰기가 통과한다(새는 방향은 언제나 통과).
   * ⚠ 상대 경로를 cwd 로 풀지 **않는다.** 한 번 그렇게 짰다가 회귀 6건이 빨개졌다 —
   *   저장소가 temp 아래에 있으면(픽스처·워크트리·임시 클론) 그 저장소의 **모든** 코드 파일이
   *   임시로 읽혀 가드가 통째로 꺼진다. 넓히려다 끄는 쪽이 되는 자리라 원문만 본다. */
  let s = path.posix.normalize(String(p).replace(/\\/g, '/')).toLowerCase();
  return /(^|\/)(tmp|temp)\//.test(s)
    || /appdata\/local\/temp/.test(s)
    || /scratchpad/.test(s)
    || /(^|\/)node_modules\//.test(s)
    || s.startsWith('/dev/');
}

const 임시경로 = (p) => 임시경로원문(p) || 임시경로원문(변수풀기(p));

/** 문자열 안에서 보호 대상 코드 파일 경로만 뽑는다. */
function 코드경로들(s) {
  const hits = String(s).match(경로RE) || [];
  return hits.filter((p) => !임시경로(p));
}

/** 이미 토큰으로 갈라 놓은 **한 인자**가 보호 대상인가 (경로RE 를 다시 돌리지 않는다 · F063).
 *  cp·mv 는 인자 자리로 뜻이 갈려서 문자열 스캔이 아니라 토큰 판정이 필요하다. */
const 코드대상인가 = (p) => 확장RE.test(String(p)) && !임시경로(p);

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0); // 입력을 못 읽으면 검사할 명령도 없다
}

/* ── 심장박동 (2026-08-12) — 이 훅의 본업이 아니다. 여기 있는 이유가 곧 그 수리다. ──────────
 * 박동은 `track-collision`(Edit|Write|MultiEdit) 에서만 뛰었고, 그래서 **셸만 돌리는 세션은
 * 남들에게 죽은 것으로 보였다**(사연·좌표 규칙 전부 `handoff-store.박동찍기`).
 * 셸 쪽에 새 훅을 세우지 않고 여기 얹는 이유는 **이 훅이 모든 셸 호출에 실제로 도는 유일한
 * 훅**이기 때문이다 — PostToolUse 는 전부 좁다(commit-noop·friction-close 는 settings 가
 * `*git*` 으로 거르고, track-boundary 는 매처만 넓고 본체가 「성공한 git commit」에서만 통과한다).
 * 새 훅을 세우면 셸 호출마다 node 프로세스가 하나 더 뜨는데, 이 훅은 이미 떠 있다.
 *
 * 🔑 **어떤 조기 종료보다 먼저** 찍는다. 아래 `exit(0)` 중 하나라도 앞서면 그 갈래에서 박동이
 *   조용히 멎고, 그건 지금 고치는 병 그대로다 — 회귀가 갈래마다(비-Bash·빈 명령·BYPASS) 못박는다.
 * 🔑 실패해도 **가드를 죽이지 않는다**. 부수효과가 차단 판정을 못 건드리게 한다(CLAUDE.md
 *   가드 맹점 ②: 실패 안전을 자기 로직 밖에 기대지 않는다). */
try { store.박동찍기(input); } catch (_) { /* 박동은 부수효과다 — 여기서 죽으면 가드가 안 돈다 */ }

const tool = String(input.tool_name || '');
if (!/^(Bash|PowerShell)$/i.test(tool)) process.exit(0);
const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd) process.exit(0);
if (/CODE_EDIT_BYPASS=1/.test(cmd)) process.exit(0);

/* 실행부만 남긴다 — 커밋 메시지·검색어에 적힌 문장을 명령으로 읽으면 문서화가 벌받는다(F049).
 * 단 **인용된 코드 경로**는 살린다(`> "docs/x.html"` 을 놓치면 규칙②가 통째로 헛돈다).
 * 인라인 스크립트 본문은 인용 안이 곧 검사 대상이라 여기 말고 규칙③에서 원본을 본다. */
/* ⚠ 인용 안의 **공백을 살린다.**
 *   이 저장소의 실제 경로는 `docs/정본/SYNK LAB/자료/…` 처럼 공백을 품는데, 인용을 그냥
 *   풀어 놓으면 아래 토큰 나누기가 경로를 조각내 `자료/X.html` 같은 **없는 경로**가 판정
 *   재료가 된다. F076 의 실제 입력이 정확히 이 모양이었고, 그래서 「대상이 있나」를 물어도
 *   영원히 「없다」가 나온다 — 조각은 언제나 없으니까. 공백을 U+0001 로 바꿔 한 토큰으로
 *   묶고, **파일을 만지거나 사람에게 보이기 직전에** `되돌림` 으로 푼다. */
// ⚠ 반드시 **이스케이프로** 적는다. 날문자로 적으면 눈에 안 보여서, 어느 편집이 지워도
//    `공백표` 가 빈 문자열이 되고 `되돌림` 이 글자 사이마다 공백을 끼운다 — 조용한 전면 파손이다.
const 공백표 = '\u0001';
const 되돌림 = (s) => String(s).split(공백표).join(' ');
/* 이 상수가 깨지면 경로에서 공백이 **사라져** 「없는 파일」이 되고, 그러면 아래 판정이 전부
 * 통과로 기운다 — 새는 방향이 언제나 통과인 그 형태다. 그래서 조용히 넘기지 않고 deny 로 드러낸다. */
if (공백표.length !== 1) {
  out('deny', '[code-edit-guard] 내부 상수(공백표)가 깨져 경로를 정확히 못 읽는다 — 검사할 수 없으니 막는다.'
    + '\n훅을 고치거나, 이 명령이 안전하다고 판단하면 CODE_EDIT_BYPASS=1 을 붙인다.');
}
const 실행부 = stripNonExecutedText(cmd, {
  keepQuoted: 확장RE,
  keepAs: (body) => ` ${body.split(' ').join(공백표)} `,
});

/* 명령이 실제로 실행될 위치. 상대 경로를 풀 때만 쓴다 — 없으면 훅 프로세스의 cwd 로 떨어지고,
 * 그때는 「해석 못 함」이 아니라 「다른 기준」이 되므로 아래 판정이 fail-closed 로 기운다. */
const 작업디렉터리 = String(input.cwd || process.cwd());

/* 변수표는 **원본 cmd** 에서 긁는다 — 실행부는 인용을 접어 놓아 대입의 우변이 깨져 있다.
 * 여기서 채워야 아래 규칙들이 부르는 임시경로()가 변수를 풀 수 있다(F088). */
변수 = 변수표(cmd);

/* ── ① in-place 편집기 (F067) ─────────────────────────────────────────────
 * 스트림 편집이 필요하면 stdout 으로 내보내면 되고, 반복 변환이면 repo 도구로 굳힌다.
 *
 * ⚠ 대상 경로를 **본다**. 처음엔 `sed -i` 자체를 무조건 막게 짰는데, 그러면 권장 경로인
 *   「사본을 스크래치패드에 떠서 변이시킨다」까지 막혀 변이 검증 자체가 불가능해진다.
 *   막을 수 없는 걸 막는 가드는 BYPASS 를 습관으로 가르친다(v6.11). 보호 대상 코드 파일이
 *   하나라도 걸릴 때만 막는다 — F067 의 대상(SYNK-talk `tools/eval-score.js`)은 걸리고
 *   `/tmp/mut.js` 는 안 걸린다. */
function 인플레이스(s) {
  const re = /\b(sed|perl|ruby)\b([^\n;|&]*)/g;
  let m;
  while ((m = re.exec(s))) {
    for (const raw of (m[2].match(/(?:^|\s)(--?[A-Za-z][^\s]*)/g) || [])) {
      const f = raw.trim();
      // `--in-place` · `-i` · `-i.bak` · 묶음 플래그(`-pi`·`-ri`). `-e`·`-n`·`-f` 는 안 걸린다.
      if (/^--in-place\b/.test(f) || /^-[A-Za-z]*i(\.[^\s]*)?$/.test(f)) return { 이름: m[1], 플래그: f };
    }
  }
  return null;
}
const ip = 인플레이스(실행부);
const ip대상 = ip ? 코드경로들(실행부) : [];
if (ip && ip대상.length) {
  out('deny', `[code-edit-guard] \`${ip.이름} ${ip.플래그}\` 가 코드 파일을 **제자리에서** 바꾼다 — \`${ip대상[0]}\``
    + '\n2026-08-04 F067 실사고: 변이 테스트를 빨리 돌리려고 SYNK-talk `tools/eval-score.js` 에 `sed -i` 를 걸었는데,'
    + ' 백업 `cp` 가 /tmp 로 가서 **원복이 실패**했고 파일이 변이 상태로 남았다.'
    + '\n같은 결말이 네 번째다(F050 파이썬 heredoc · F065 python subprocess 중간 사망 · F067 여기 · 직전 세션 4번째).'
    + 처방);
}

/* ── ② 코드 파일에 써넣기 ────────────────────────────────────────────────
 * 리다이렉트·tee·cp/mv 덮어쓰기·PowerShell 쓰기 cmdlet. F065 의 「백업 cp」도 이 통로다. */
const 쓰기규칙 = [
  { 왜: '리다이렉트(`>` · `>>`)', re: /(?:^|[^\d\w>])>>?\s*([^\s'"|;&<>()]+)/g, 대상: (m) => [m[1]] },
  { 왜: '`tee`', re: /\btee\b((?:\s+-\S+)*)\s+([^\s'"|;&<>()]+)/g, 대상: (m) => [m[2]] },
  // cp·mv 는 여기 없다 — 인자 자리로 뜻이 갈리고 「대상이 있나」를 물어야 해서 ②-b 에서 따로 본다.
  // 쓰기 cmdlet 은 인자 자리 구분 없이 「그 안의 코드 경로」가 곧 쓰기 대상이다.
  { 왜: 'PowerShell 쓰기 cmdlet', re: /\b(?:Set-Content|Out-File|Add-Content)\b([^\n;|&]*)/gi, 대상: (m) => [m[1]] },
  { 왜: '.NET 파일 쓰기', re: /\[(?:System\.)?IO\.File\]::(?:WriteAll\w+|AppendAll\w+)\s*\(([^)]*)\)/gi, 대상: (m) => [m[1]] },
];
for (const 규칙 of 쓰기규칙) {
  let m;
  규칙.re.lastIndex = 0;
  while ((m = 규칙.re.exec(실행부))) {
    for (const 조각 of 규칙.대상(m)) {
      const 맞은것 = 코드경로들(조각);
      if (!맞은것.length) continue;
      out('deny', `[code-edit-guard] ${규칙.왜}로 코드 파일을 덮어쓴다 — \`${되돌림(맞은것[0])}\``
        + '\n셸 변이는 (백업→변이→검사→원복) 4단계라 중간에 죽으면 **변이 상태로 남는다**.'
        + ' 2026-08-04 F065: python subprocess 가 자식 stdout 을 CP949 로 디코드하다 예외를 던져 원복 라인이 아예 실행되지 않았다.'
        + 처방);
    }
  }
}

/* ── ②-b cp·mv 는 **덮어쓸 것이 있을 때만** 덮어쓰기다 (F076) ────────────────
 * 🔴 이 규칙은 원래 「마지막 인자가 코드 파일이면 막는다」였다. 그래서 rename 과 새 사본
 *   뜨기까지 막았고, 한 세션이 **2회 연속 BYPASS** 했다. 가드가 죽는 방식이 정확히 이것이다 —
 *   못 지킬 규칙은 우회를 손버릇으로 만들고, 그 손버릇은 **진짜 덮어쓰기도 같이 통과시킨다.**
 *
 * 🔑 가르는 축은 「덮어쓸 것이 지금 있는가」다. 그게 이 규칙 이름의 뜻이고,
 *   `Edit` 도구가 대안이 되는 조건이기도 하다(`Edit` 는 옮기지도 복사하지도 못한다 —
 *   따를 수 없는 처방을 주면 안 된다). 지키는 것: `cp /tmp/x.bak Code.js` 같은
 *   **백업 되돌리기** — F065·F067 이 실패한 바로 그 4단계의 마지막 칸.
 *
 * ⚠ 모르면 막는다. 글롭·변수처럼 대상을 특정할 수 없으면 「없다」가 아니라 **모른다**이고,
 *   가드에서 모름을 통과로 번역하면 새는 방향은 언제나 통과다. */
/* cp·mv 의 인자는 **전부 경로**다. 그래서 여기서는 `실행부` 를 쓰지 않고 **원본을 인용째**
 * 토큰으로 가른다 — 인용 안을 산문으로 보고 지우면 `cp x.js "자료 폴더"` 처럼 확장자도
 * 구분자도 없는 **대상이 통째로 사라지고**, 사라진 대상은 무엇을 물어도 「없다」라 조용히 통과한다.
 * (`keepQuoted` 를 넓히는 길도 있었지만 그러면 규칙①②가 인용 안 산문을 명령으로 읽어 F049 가 되돌아온다.)
 *
 * 대신 앵커를 좁힌다: cp·mv 가 **명령 자리**(첫 토큰이거나 구분자 뒤)에 있을 때만 본다.
 * 인용 안에 적힌 `mv a.js b.js`(커밋 메시지·메모)는 토큰 하나로 뭉쳐 있어 명령이 될 수 없다. */
const 이동이름 = /^(?:cp|cpi|mv|mi|copy|move|Copy-Item|Move-Item)$/i;
const 앞말 = /^(?:sudo|time|nohup|command|env|nice)$/i;   // `sudo cp …` 도 cp 다
const 환경대입 = /^[A-Za-z_]\w*=/;                         // `FOO=1 cp …`

function 이동호출들(원본) {
  const s = String(원본)
    .replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm, ' <<HEREDOC ')
    .replace(/(-m|--message)\s+(['"])[\s\S]*?\2/g, '$1 MSG');

  const 토큰 = [];
  let 현재 = '', 인용됨 = false, 담김 = false;
  const 끊는다 = () => { if (담김) 토큰.push({ 값: 현재, 인용됨 }); 현재 = ''; 인용됨 = false; 담김 = false; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'") {                 // 인용 안의 공백·구분자는 글자다
      const 끝 = s.indexOf(c, i + 1);
      if (끝 < 0) { 현재 += s.slice(i + 1); 담김 = true; break; }
      현재 += s.slice(i + 1, 끝); 인용됨 = true; 담김 = true; i = 끝; continue;
    }
    if (c === '$' && s[i + 1] === '(') {          // 치환은 통째로 남긴다 — 지우면 「모름」이 안 보인다
      let 깊이 = 1, j = i + 2;
      while (j < s.length && 깊이 > 0) { if (s[j] === '(') 깊이++; else if (s[j] === ')') 깊이--; j++; }
      현재 += s.slice(i, j); 담김 = true; i = j - 1; continue;
    }
    if (c === '`') {
      const 끝 = s.indexOf('`', i + 1);
      const j = 끝 < 0 ? s.length : 끝 + 1;
      현재 += s.slice(i, j); 담김 = true; i = j - 1; continue;
    }
    // `SYNK\ LAB` 만 이스케이프로 본다 — 윈도 경로 구분자(`C:\Users`)를 먹으면 경로가 망가진다
    if (c === '\\' && /[\s'"\\]/.test(s[i + 1] || '')) { 현재 += s[++i]; 담김 = true; continue; }
    if (/\s/.test(c)) { 끊는다(); if (c === '\n') 토큰.push({ 구분: true }); continue; }
    if (c === ';' || c === '|' || c === '&') { 끊는다(); 토큰.push({ 구분: true }); continue; }
    현재 += c; 담김 = true;
  }
  끊는다();

  const 호출 = [];
  let 명령자리 = true;
  for (let i = 0; i < 토큰.length; i++) {
    const t = 토큰[i];
    if (t.구분) { 명령자리 = true; continue; }
    if (!명령자리) continue;
    if (!t.인용됨 && (앞말.test(t.값) || 환경대입.test(t.값))) continue;   // 명령 자리를 유지한 채 건너뛴다
    if (!t.인용됨 && 이동이름.test(t.값.replace(/^\\/, ''))) {
      const 인자 = [];
      let j = i + 1;
      for (; j < 토큰.length && !토큰[j].구분; j++) 인자.push(토큰[j]);
      호출.push({ 이름: t.값, 인자 });
      i = j - 1;
    }
    명령자리 = false;
  }
  return 호출;
}

/* 홈 표기는 **펼친다** — `~/…` 와 `$HOME/…` 은 셸이 반드시 같은 자리로 푸는 것이라
 * 「모른다」가 아니다. 안 펼치면 unknown 으로 떨어져 차단되는데, 그러면 **F076 이 기록한
 * 그 두 명령이 여전히 막힌다** — 바탕화면 사본 배포도 구판 rename 도 둘 다
 * `$HOME/OneDrive/Desktop/…` 였다(F076 해소 뒤 실측으로 드러난 잔여분).
 * ⚠ 그 밖의 변수·치환·글롭은 그대로 unknown 이다 — 펼치기가 통과 핑계가 되면 안 된다. */
const 홈 = process.env.HOME || process.env.USERPROFILE || require('os').homedir();
const 홈펼침 = (s) => (홈 ? String(s)
  .replace(/^~(?=[\\/]|$)/, 홈)
  .replace(/\$\{?HOME\}?(?![A-Za-z0-9_])/g, 홈)
  .replace(/%USERPROFILE%/gi, 홈)
  .replace(/\$env:USERPROFILE/gi, 홈)
  : String(s));

/** 위로 올라가며 `.git` 을 찾는다 — 되돌릴 수단이 있는 자리인가.
 *  외부 명령을 부르지 않는다(가드의 실패 안전을 외부 명령에 기대면 안 된다 · F044).
 *  ⚠ **못 찾았을 때만** 「되돌릴 수 없다」를 덧붙인다 — 잘못 짚어도 문구가 조용해질 뿐 틀리진 않는다. */
function git밖인가(p) {
  let d = path.dirname(path.isAbsolute(p) ? p : path.resolve(작업디렉터리, p));
  for (let i = 0; i < 64; i++) {
    try { if (fs.existsSync(path.join(d, '.git'))) return false; } catch (_) { return false; }
    const 위 = path.dirname(d);
    if (위 === d) return true;
    d = 위;
  }
  return false;
}

/** 'yes' | 'no' | 'unknown' — 이 자리에 지금 무언가 있는가. */
function 있나(p) {
  const s = 홈펼침(되돌림(p));
  /* 글롭·변수·틸드는 해석 못 한다. `$` 는 **뒤를 보지 않고** 잡는다 — `\w` 로 좁혔더니
   * `$대상.js` 처럼 한글로 시작하는 변수를 놓쳤고(JS 의 `\w` 는 ASCII 다), 놓친 방향은 통과였다. */
  if (!s || /[*?]|\$|%\w+%|(^|[\\/])~([\\/]|$)/.test(s)) return 'unknown';
  try {
    return fs.existsSync(path.isAbsolute(s) ? s : path.resolve(작업디렉터리, s)) ? 'yes' : 'no';
  } catch (_) { return 'unknown'; }
}

/** 디렉터리로 옮기면 진짜 대상은 `대상/원본이름` 이다 — 대상 토큰만 보면 통째로 눈이 먼다. */
function 실제대상들(원본들, 대상) {
  const s = 홈펼침(되돌림(대상));
  let 디렉터리 = false;
  try { 디렉터리 = fs.statSync(path.isAbsolute(s) ? s : path.resolve(작업디렉터리, s)).isDirectory(); } catch (_) { /* 없으면 파일 자리다 */ }
  if (!디렉터리) return [대상];
  const 앞 = 대상.replace(/[\\/]+$/, '');
  return 원본들.map((o) => `${앞}/${path.basename(되돌림(o))}`);
}

for (const { 이름, 인자 } of 이동호출들(cmd)) {
  const 위치 = [];
  let 대상 = null;
  for (let i = 0; i < 인자.length; i++) {
    const t = 인자[i];
    if (!t.인용됨 && /^-/.test(t.값)) {
      // PowerShell 명명 인자 — 자리로만 읽으면 `Copy-Item -Destination b -Path a` 에서 대상이 뒤집힌다.
      if (/^-{1,2}(?:Destination|Dest|Target)$/i.test(t.값)) { 대상 = (인자[++i] || {}).값 || 대상; continue; }
      if (/^-{1,2}(?:Path|LiteralPath)$/i.test(t.값)) { if (인자[i + 1]) 위치.push(인자[++i].값); continue; }
      continue;   // 그 밖의 플래그
    }
    위치.push(t.값);
  }
  if (대상 === null) 대상 = 위치.pop() || null;
  if (!대상 || !위치.length) continue;   // `mv a` 같은 조각은 판정 재료가 아니다

  for (const 후보 of 실제대상들(위치, 대상)) {
    if (!코드대상인가(후보)) continue;
    const 상태 = 있나(후보);
    if (상태 === 'no') continue;         // 🔑 덮어쓸 것이 없다 — rename·새 사본이다 (F076)
    out('deny', 상태 === 'unknown'
      ? `[code-edit-guard] \`${이름}\` 의 대상을 특정할 수 없다 — \`${되돌림(후보)}\``
        + '\n글롭·변수가 섞여 있어 **덮어쓰는지 아닌지를 못 읽는다.** 모름을 통과로 바꾸지 않는다.'
        + '\n대상을 하나씩 풀어서 쓰면 이 훅은 rename·새 사본을 막지 않는다.'
        + 처방
      : `[code-edit-guard] \`${이름}\` 가 **이미 있는** 코드 파일을 덮어쓴다 — \`${되돌림(후보)}\``
        /* 근거를 경우별로 갈라 적는다 — 무관한 사고를 읊는 메시지가 F076 의 절반이었다.
         * 바탕화면 사본에 대고 「python subprocess 가 중간에 죽었다」를 읽히면 사람은
         * 다음부터 메시지를 안 읽고, 그때부터 BYPASS 는 손버릇이 된다. */
        + (git밖인가(홈펼침(되돌림(후보)))
          ? '\n⚠ 이 경로 위에는 `.git` 이 없다 — **되돌릴 수단이 없는 자리**다. 덮으면 이전 내용은 그대로 사라진다.'
          : '\n셸 변이는 (백업→변이→검사→원복) 4단계라 중간에 죽으면 **변이 상태로 남는다**.'
            + ' 2026-08-04 F065: python subprocess 가 자식 stdout 을 CP949 로 디코드하다 예외를 던져 원복 라인이 아예 실행되지 않았다.')
        + '\n(대상이 **없는** 이름이면 막지 않는다 — rename 과 새 사본은 이 통로가 아니다 · F076)'
        + 처방);
  }
}

/* ── ③ 인라인 스크립트가 코드 파일을 쓴다 (F050·F065) ──────────────────────
 * 여기서는 **원본**을 본다 — 인용·힙독 안이 곧 검사 대상이라 실행부를 쓰면 눈이 먼다.
 * 대신 앵커를 좁힌다: 실행기 + eval 플래그, 또는 **실행기에게 먹이는** 힙독. 그래야
 * 커밋 메시지에 적힌 코드 예시가 걸리지 않는다(가드는 산문을 벌하면 안 된다 · F049). */
const 실행기 = '(?:node|python3?|perl|ruby|deno|bun|php)';
const 쓰기API = new RegExp([
  'writeFileSync', 'appendFileSync', 'createWriteStream', 'copyFileSync', 'renameSync', 'cpSync',
  'unlinkSync', 'truncateSync', 'writeFile\\b', 'appendFile\\b',
  'write_text', 'writelines', 'shutil\\.(?:copy|move)', 'os\\.(?:replace|rename|remove)', 'fileinput',
  'File\\.write', 'IO\\.write',
  "open\\s*\\([^)]*['\"][waxr]\\+?b?t?['\"]", // open(p,'w') · open(p,'a') · open(p,'r+')
].join('|'), 'i');

const 본문들 = [];
// (a) 실행기에게 먹이는 힙독 — 여는 줄에 실행기가 있어야 한다(`git commit -F - <<EOF` 는 아니다)
const 힙 = /([^\n]*)<<-?\s*(['"]?)([A-Za-z_]\w*)\2[^\n]*\n([\s\S]*?)^\s*\3\s*$/gm;
let h;
while ((h = 힙.exec(cmd))) {
  if (new RegExp(`\\b${실행기}\\b`).test(h[1])) 본문들.push({ 형태: `힙독(<<${h[3]})`, 본문: h[4] });
}
// (b) -e / -c / --eval 본문. 힙독 본문과 커밋 메시지는 먼저 걷어낸다(앵커가 산문 안에서 잡히지 않게).
const 앵커용 = cmd
  .replace(힙, ' <<HEREDOC ')
  .replace(/(-m|--message)\s+(['"])[\s\S]*?\2/g, '$1 MSG');
const e = new RegExp(`\\b${실행기}\\b[^\\n]*?\\s(?:-e|-c|--eval)\\s`).exec(앵커용);
if (e) 본문들.push({ 형태: `인라인(${e[0].trim().split(/\s+/)[0]} …)`, 본문: 앵커용.slice(e.index + e[0].length) });

for (const { 형태, 본문 } of 본문들) {
  if (!쓰기API.test(본문)) continue;
  const 맞은것 = 코드경로들(본문);
  if (!맞은것.length) continue;
  out('deny', `[code-edit-guard] ${형태} 스크립트가 코드 파일에 쓴다 — \`${맞은것[0]}\``
    + '\n2026-08-04 F050: 파이썬 heredoc 으로 테스트 파일을 편집하다 이스케이프가 꼬여 **두 번 깨뜨렸다**.'
    + ' F065: 같은 통로에서 스크립트가 중간에 죽어 원복이 실행되지 않았다.'
    + '\n인라인 스크립트는 셸 인용 + 언어 이스케이프가 **두 겹**이라, 틀려도 실패가 아니라 오염으로 나온다.'
    + 처방);
}

process.exit(0);
