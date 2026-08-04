#!/usr/bin/env node
'use strict';
/* deploy-freshness — `clasp push` 뒤에 **라이브가 실제로 바뀌었는지**를 알린다 (PostToolUse).
 *
 * 막을 수 없는 종류의 사고다 — push 는 이미 끝난 뒤라 차단할 것이 없다. 그래서 이 훅은
 * **가드가 아니라 알림**이고, 절대 작업을 세우지 않는다(permissionDecision 을 내지 않는다).
 *
 * 🔑 발화 자리를 여기로 고른 이유: 이 사고의 유일한 증상은 **「성공했다는 출력」**이다.
 *   `clasp push` 는 "Pushed 5 files" 라고 말하고 끝나고, 사람은 그걸 배포 완료로 읽는다.
 *   그 문장이 나온 **직후**가 아니면 아무도 다시 확인하지 않는다.
 *
 * ⚠ 라우팅은 훅보다 넓어야 한다 — settings 의 `case *clasp*` 는 이 훅이 보는
 *   `clasp push|deploy` 보다 넓다. 좁히면 그 자체가 구멍이다(가드 맹점 ③).
 */

const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');

let 입력 = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { 입력 += c; });
process.stdin.on('end', () => {
  let ev = {};
  try { ev = JSON.parse(입력 || '{}'); } catch (_) { process.exit(0); }

  const cmd = String(ev?.tool_input?.command || '');
  /* `clasp deployments` 는 조회다 — `deploy` 뒤 낱말 경계로 갈린다(`deployments` 는 안 걸린다).
   * push 뿐 아니라 deploy 도 본다: 갱신한 직후에 **초록을 확인**해 주는 쪽이 고리를 닫는다. */
  if (!/\bclasp\b[^\n]*?\s(push|deploy)\b/.test(cmd)) process.exit(0);

  let 점검, 프로젝트;
  try {
    점검 = require(path.join(ROOT, 'tools', '배포판점검.js'));
    프로젝트 = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'clasp-project.js'));
  } catch (_) { process.exit(0); } // 도구가 없으면 조용히 — 알림이 작업을 깨뜨리지 않는다

  let r;
  try {
    const proj = 프로젝트.resolveProject(cmd, ev?.cwd || ROOT, ROOT);
    r = 점검.점검(proj, ROOT);
  } catch (_) { process.exit(0); }

  if (r.level === 'ok') process.exit(0); // 초록이면 조용히 — 소음은 알림을 죽인다

  const 머리 = r.level === 'stale'
    ? `🔴 ${r.이름}: push 는 됐지만 **라이브는 옛 코드다**`
    : r.level === 'unreachable'
      ? `⚠ ${r.이름}: 배포판 확인 불가`
      : `⚠ ${r.이름}: 배포판 판정 불가(지문 없음)`;

  const 본문 =
    '[deploy-freshness] **`clasp push` 는 라이브를 바꾸지 않는다.**\n'
    + '웹앱은 프로젝트 파일이 아니라 **고정 버전 배포 스냅샷**을 서빙한다 — push 로 파일만\n'
    + '갱신하면 접수 URL 은 옛 코드를 그대로 계속 준다(2026-08-05 실사고: @16 이 v9.186 시점\n'
    + '카드를 서빙하는 동안 브랜드 키트 수리는 저장소에만 있었다).\n\n'
    + r.lines.join('\n') + '\n\n'
    + '→ **보고하기 전에** 위 명령으로 갱신하고, `clasp deployments` 로 **배포 개수가 그대로**인지 본다.\n'
    + '   개수가 늘었으면 접수 주소가 둘로 갈린 것이다 — 그건 되돌리기가 훨씬 비싸다.';

  process.stdout.write(JSON.stringify({
    systemMessage: 머리,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 본문 },
  }));
  process.exit(0);
});
