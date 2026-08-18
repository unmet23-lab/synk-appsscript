#!/usr/bin/env node
// commit-noop-guard — 커밋했다고 믿었는데 **아무것도 안 들어간** 경우를 알린다 (PostToolUse 훅)
//
// 왜 있나 (F071 · 2026-08-04):
//   직전 세션이 미커밋 8건을 남기고 끝났고, 그걸 **두 세션이 동시에 이어받았다.**
//   상대가 1분 먼저 같은 5개 파일을 커밋했고, 내 `git commit -F msg -- 경로들` 은
//   「nothing to commit」 상태 목록만 뱉고 **성공처럼 조용히 지나갔다.**
//   `git log` 를 열어서야 그 커밋의 주인이 내가 아닌 걸 알았다.
//
//   🔑 이 저장소가 지금까지 막아 온 세션 사고는 전부 **「남의 것을 덮었다」** 쪽이었다
//      (F025 미추적 소멸 · F037 rebase 에 쓸림 · uncommitted-swept-by-peer).
//      이건 반대 방향이다 — **「내 것이 안 들어갔는데 성공으로 보였다」.**
//      새는 방향은 언제나 통과다(CLAUDE.md 신뢰성). 그래서 결과를 검사한다.
//
//   ⚠ 왜 PreToolUse 로 못 막나 — no-op 인지는 **돌려봐야 안다.** 이 저장소의 가드는
//      전부 「막는」 PreToolUse 였고(발동층 0 · memory loop-trigger-layer), 결과를 보는
//      층이 아예 없었다. 이 훅이 그 층의 첫 입주자다.
//
// 무엇을 보나 — 명령에 `git commit` 이 있는데 출력이 「안 들어갔다」고 말하는 경우.
//   · nothing to commit / nothing added to commit / no changes added to commit
//   · pathspec ... did not match any file(s) known to git   ← 경로 오타·이미 커밋됨
//
// ⚠ 절대 차단하지 않는다 — 도구는 이미 실행됐고, no-op 자체가 손상은 아니다.
//   위험한 건 **그걸 「커밋했다」고 보고하는 것**이다. 정보만 준다.
'use strict';
const fs = require('fs');
const path = require('path');
const { stripNonExecutedText } = require(path.join(__dirname, 'lib', 'shell-text.js'));
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('./lib/board-id.js');

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const tool = String(input.tool_name || '');
if (!/^(Bash|PowerShell)$/.test(tool)) process.exit(0);

const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd) process.exit(0);

/* 인용·heredoc 안의 산문을 걷어낸 뒤에 본다 — 커밋 메시지에 "git commit" 이라고 적었거나
 * `grep "git commit"` 을 돌린 것까지 붙잡으면, 가드가 실작업을 벌주고 사람은 가드를 끈다
 * (F049 실측: clasp-guard 가 grep 을 막았다). 공용 통로를 쓰는 이유. */
const exec = stripNonExecutedText(cmd);

/* `git … commit` — 사이에 `-c k=v`·`-C dir` 같은 전역 옵션이 낄 수 있다.
 * 파이프·세미콜론은 건너지 않는다(다른 명령의 commit 을 이 git 것으로 오인하지 않게).
 *
 * 🔴 `commit` 은 **셸 토큰 하나**여야 한다 — `\b` 만 걸면 경로 속 글자가 걸린다(F230 · 08-08 실측).
 *   `git diff --stat -- .claude/hooks/auto-commit.js` 가 「커밋했다」로 읽혔다: 앞이 하이픈,
 *   뒤가 마침표라 양쪽 다 단어 경계다. 이 저장소엔 `auto-commit.js`·`commit-noop-guard.js` 가
 *   있어 그 파일을 만지는 트랙마다 상시 오발이고, 같은 호출에 `git status` 가 끼면(흔하다)
 *   그 출력이 조건을 채운다. 새는 방향이 나쁘다 — **가드가 실작업을 벌주면 사람이 가드를 끈다**
 *   (위 인용 스트리퍼가 존재하는 사유와 같다). 앵커는 하나에서 파생시킨다 — 세 곳에 적으면 갈라진다. */
const 커밋앵커 = String.raw`\bgit\b[^|;&\n]*?(?<![\w./\\-])commit(?![\w./\\-])`;
const 커밋했나 = new RegExp(커밋앵커).test(exec);
if (!커밋했나) process.exit(0);

// --dry-run 은 「안 들어가는 게 정상」이다. 벌주면 안 된다.
if (new RegExp(커밋앵커 + String.raw`[^|;&\n]*?(--dry-run|--porcelain)`).test(exec)) process.exit(0);

const res = input.tool_response;
const 원출력 = [
  typeof res === 'string' ? res : '',
  res && typeof res === 'object' ? String(res.stdout || '') : '',
  res && typeof res === 'object' ? String(res.stderr || '') : '',
].join('\n');
if (!원출력.trim()) process.exit(0);

/* 착지 줄 — git 은 커밋이 들어가면 `[master 2b5e7af] <제목>` 을 되뱉는다.
 * 아래 두 판정이 **같은 정의**를 쓴다. 두 곳에 적으면 갈라지고, 갈라지는 방향은 언제나 통과다. */
const 착지줄 = /^\s*\[[^\]\n]*\b[0-9a-f]{7,40}\]/;
const 줄들 = 원출력.split(/\r?\n/);
const 착지수 = 줄들.filter((l) => 착지줄.test(l)).length;

/* 🔑 F113 — 체인 안의 **다른 명령**이 낸 증상을 커밋 것으로 읽지 않는다.
 *   실사고: `git status; git add -- x; git commit -F msg -- x` 에서 앞의 `git status` 가
 *   「no changes added to commit」 을 찍었고 커밋은 **실제로 착지했는데**(1 file changed)
 *   가드가 no-op 이라고 짖었다(F113 · SYNK-talk b74be75). 거짓양성 가드는 사람이 가드를 끄게 만든다(F049 계열).
 *   그래서 판정 재료를 「그 문구가 어딘가 있나」에서 **「착지 수가 커밋 수를 채웠나」**로 옮긴다.
 *   `commit A && commit B` 에서 B 만 비는 경우(2:1)는 그대로 잡히고, 앞단 status 는 안 센다.
 *   ⚠ 천장: 커밋 수는 명령 문자열로 센다 — 반복문·함수 안에서 도는 커밋은 적게 세어
 *     착지가 많아 보일 수 있다(이 저장소는 「한 호출 안 커밋」 규약이라 그 형태를 안 쓴다). */
const 커밋수 = (exec.match(new RegExp(커밋앵커, 'g')) || []).length;
if (착지수 >= 커밋수) process.exit(0);

/* 제목 줄을 걷어낸 뒤에 증상을 찾는다 — 이 저장소는 커밋 제목에 가드 이야기를 자주 써서
 * `git commit -m "… nothing to commit …"` 이 **성공했는데도** 그 문구를 출력에 남긴다(자기 언급 함정).
 * 증상 문구는 언제나 자기 줄에 온다. */
const 출력 = 줄들.filter((l) => !착지줄.test(l)).join('\n');

const 증상 = [
  { re: /nothing to commit/i, 뜻: '커밋할 변경이 없었다 — 같은 내용을 누가 먼저 커밋했거나, 애초에 바뀐 게 없다' },
  { re: /nothing added to commit/i, 뜻: '스테이징에 올라간 것이 없다 — 경로 지정이 실제 변경과 어긋났다' },
  { re: /no changes added to commit/i, 뜻: '변경이 스테이징에 안 올라갔다 — 미추적 파일은 `git add -- <경로>` 가 먼저다' },
  { re: /did not match any file\(s\) known to git/i, 뜻: '경로가 git 이 아는 파일과 안 맞았다 — 오타이거나 아직 미추적이다' },
].filter((s) => s.re.test(출력));

if (!증상.length) process.exit(0);

const 본문 =
  '[commit-noop-guard] `git commit` 을 돌렸는데 **아무것도 안 들어갔다.**\n'
  + (착지수 ? `  · 커밋 ${커밋수}개 중 **${착지수}개만 착지**했다 — 나머지가 비었다.\n` : '')
  + 증상.map((s) => `  · ${s.뜻}`).join('\n') + '\n\n'
  + '왜 알리나 (F071): 직전 세션이 남긴 미커밋을 **두 세션이 동시에 이어받아**, 상대가 1분 먼저\n'
  + '커밋한 탓에 내 커밋이 조용히 no-op 이 됐다. git 은 이걸 오류로 부르지 않는다 — 상태 목록만\n'
  + '뱉고 정상 종료한다. 그래서 **「커밋했다」고 보고하면 그 보고가 거짓이 된다.**\n\n'
  + '→ 보고하기 전에:\n'
  + '   1) `git log -3 --format="%h %(trailers:key=Session-Id,valueonly) %s"` — **주인이 나인지** 본다.\n'
  + `      ⚠ 내 id 는 **$CLAUDE_CODE_HOST_SESSION_ID**(지금 이 세션 = ${보드id.세션id() || '미설정'})다.\n`
  + '      스크래치패드·트랜스크립트 경로의 UUID 와 **다른 식별자**라, 그걸로 대조하면 내 커밋이\n'
  + '      「남의 것」으로 뒤집힌다(실측 1회). author 는 전 세션 공통이라 애초에 구분자가 아니다(F041).\n'
  + '   2) 내 변경이 아직 남아 있으면(`git status`) 경로 지정을 고쳐 다시 커밋한다.\n'
  + '      새 파일이면 `git add -- <경로>` 가 먼저다 — 미추적은 이력·stash·reflog 어디에도 없다(F025).\n'
  + '   3) 남이 먼저 넣은 것이면 **그 커밋을 읽고** 내 작업과 겹치는지 본다. 중복 구현이 F070 이다.';

process.stdout.write(JSON.stringify({
  systemMessage: `⚠ 커밋이 비었다 — ${증상.length}건의 신호(${증상.map((s) => s.re.source.split('\\')[0].slice(0, 22)).join(' · ')})`,
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 본문 },
}));
process.exit(0);
