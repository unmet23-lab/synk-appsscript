'use strict';
// PC 앱이 켜질 때의 두 가지(experiences/solo-backup-rust/SOLIO_ONE_CLIENT.md 2.3 · 2.5, 2026-11-26).
// 1. synk-solio: 주소. 엔진은 인자 없이 켜지거나 알림이 눌리면 `synk-solio:backup?topic=<낱말>`을 연다. 포장된 platform 판이 이 이름을 맡는다.
//    첫 실행과 second-instance에서 마지막 인자가 이 꼴과 글자 그대로 같을 때만 받는다(낱말은 엔진의 아홉 낱말).
// 2. 원격 디버깅 거절. 포장된 판이 --remote-debugging-port류로 켜지면 바로 끝난다. 그래야 PC 앱 실행 파일로
//    엔진 화면 자리를 몰고 가 호스트의 바꾸는 메서드에 닿지 못한다(퓨즈는 tools/package.cjs electronFuses).
// 시험: desktop/tests/solio-launch.test.cjs.
const SOLIO_SCHEME = 'synk-solio';
const SOLIO_TOPICS = Object.freeze(['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update', 'move']);
const SOLIO_URL = new RegExp(`^${SOLIO_SCHEME}:backup\\?topic=(${SOLIO_TOPICS.join('|')})$`);

/* 인자 목록의 마지막이 synk-solio:backup?topic=<낱말>이면 그 낱말, 아니면 null */
function solioTopic(argv) {
  if (!Array.isArray(argv) || !argv.length) return null;
  const last = argv[argv.length - 1];
  if (typeof last !== 'string' || last.length > 64) return null;
  const match = SOLIO_URL.exec(last);
  return match ? match[1] : null;
}

/* Chromium이 받는 원격 디버깅 스위치. Windows의 Chromium은 -- · - · / 셋을 스위치 머리로 받는다 */
/* Node 검사기(--inspect류)는 넣지 않는다. 포장 판 확인 도구가 메인 검사기로 들어가므로 퓨즈와 함께 켜 둔다(SOLIO_ONE_CLIENT.md 2.3 · 8장) */
const DEBUG_SWITCHES = Object.freeze(['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'remote-debugging-socket-name', 'remote-allow-origins']);
const DEBUG_ARG = new RegExp(`^(?:--?|/)(?:${DEBUG_SWITCHES.join('|')})(?:[=:].*)?$`, 'i');

/* 디버깅 스위치로 켜졌는가. hasSwitch는 app.commandLine.hasSwitch(Chromium이 읽은 명령 줄)다. -- 뒤의 인자는 스위치가 아니다 */
function debugSwitch(argv, hasSwitch = () => false) {
  try { if (DEBUG_SWITCHES.some(name => hasSwitch(name) === true)) return true; } catch { return true; }
  if (!Array.isArray(argv)) return false;
  for (const arg of argv.slice(1)) {
    if (arg === '--') break;
    if (typeof arg === 'string' && DEBUG_ARG.test(arg)) return true;
  }
  return false;
}

module.exports = { solioTopic, debugSwitch, SOLIO_SCHEME, SOLIO_TOPICS, DEBUG_SWITCHES };
