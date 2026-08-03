/* HTML 인라인 스크립트 회귀 — 마찰 F047(일반화분).
 *
 * 사건: 카드 제출 버튼이 죽었는데 회귀 10건이 전부 초록이었다. 원인은 「주석 안에 스크립트
 * 종료 태그를 문자로 써서 파서가 블록을 끊은 것」이라 **문자열 존재 검사로는 원리적으로 못 잡는다**
 * (문자열은 파일에 그대로 있고 죽은 건 실행이다). 옆 세션이 crewcard 2파일에 파싱 회귀를 넣었고
 * (353d5c4), 여기서 저장소 전체로 넓힌다 — `docs/tools/*.html` 등은 검사 밖이었다.
 *
 * 구성은 CLAUDE.md 신뢰성 조항대로 가른다:
 *   · **탐지 능력 = 픽스처**로 못박는다(버그가 실저장소에 아직 있기를 요구하지 않는다)
 *   · **실저장소 = 거짓양성만** 검사한다(지금 깨끗한지)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const check = require('../tools/html-script-check.js');

const ROOT = path.join(__dirname, '..');

// ── ① 탐지 능력 (픽스처) ────────────────────────────────────────────
test('F047 지문을 잡는다 — 주석 안의 종료 태그가 블록을 끊는 경우', () => {
  /* 실제 형태: 주석에 </script> 를 문자로 적어 파서가 거기서 끝낸다.
   * 뒤쪽 진짜 종료 태그가 붕 뜨고, 끊긴 블록은 괄호가 안 맞는다. */
  const bad = [
    '<html><body><button id="go">보내기</button>',
    '<script>',
    '  function submit() {',
    '    // 종료 태그를 주석에 적었다: </script>',
    '    fetch("/x");',
    '  }',
    '  document.getElementById("go").onclick = submit;',
    '</script>',
    '</body></html>',
  ].join('\n');
  const problems = check.checkHtml(bad, 'fixture.html');
  assert.ok(problems.length > 0, 'F047 형태를 못 잡았다 — 이 검사는 탐지력이 없다');
  assert.match(problems.join(' | '), /개수가 안 맞는다|파싱 실패/, problems.join(' | '));
});

test('문법이 깨진 인라인 스크립트를 잡는다', () => {
  const bad = '<html><script>function f( { return 1 }</script></html>';
  assert.ok(check.checkHtml(bad, 'fixture2.html').length > 0, '문법 오류를 통과시켰다');
});

test('멀쩡한 HTML은 통과시킨다 (과잉 차단하지 않는다)', () => {
  const good = [
    '<html><body>',
    '<script src="x.js"></script>',
    '<script type="text/template"><div>{{안 돌 코드}}</div></script>',
    '<script>const a = 1; function f(){ return a; } f();</script>',
    '</body></html>',
  ].join('\n');
  assert.deepEqual(check.checkHtml(good, 'ok.html'), [], '멀쩡한 HTML을 문제로 봤다');
});

// ── ② 실저장소 (거짓양성만) ─────────────────────────────────────────
test('저장소의 추적 HTML 인라인 스크립트가 전부 살아 있다', () => {
  const r = check.checkRepo(ROOT);
  assert.deepEqual(r.problems, [], '죽은 인라인 스크립트:\n  ' + r.problems.join('\n  '));

  /* ⚠ 이 단언이 없으면 목록이 조용히 비어도 초록이 된다. 실제로 탐침 첫 판에서
   * `git ls-files` 기본값이 한글 경로를 이스케이프해 **17개 중 12개가 빠진 채** 통과했다.
   * 검사에서 조용히 빠지는 것과 통과가 같은 모양이면 안 된다. */
  assert.ok(r.withScript >= 10,
    `인라인 스크립트를 가진 파일이 ${r.withScript}개뿐이다 — 파일 목록이 새고 있다(경로 인코딩 의심)`);
});
