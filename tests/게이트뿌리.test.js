/* pre-commit 게이트의 **뿌리(ROOT)** 규칙 — `CLAUDE_PROJECT_DIR` 을 얹지 않는다 (2026-08-14)
 *
 * 왜 있나 — `tests/대장동봉E2E.test.js` 가 실측했다: 게이트가 ROOT 를 `CLAUDE_PROJECT_DIR` 로
 *   잡으면, 그 변수가 다른 저장소를 가리킬 때 **옆 저장소의 스테이징을 재고 조용히 통과한다.**
 *   워크트리는 이 저장소가 실제로 쓰는 층이고(F403 이 그 층에서 났다), 거기서 게이트는 통째로
 *   눈이 먼다 — 새는 방향이 「통과」라 증상이 없다.
 *
 * 🔑 같은 모양이 **두 곳**이었다(대장동봉검사·인용검사). 두 번째부터는 실수가 아니라 시스템
 *   결함이니(CLAUDE.md 신뢰성) 고치는 것으로 끝내지 않고 **잘못 쓸 수 없게** 여기서 막는다.
 *
 * 🔑 답은 `path.resolve(__dirname, '..')` 이다 — 훅은 `$ROOT/tools/…` 로 부르고 워크트리엔 제
 *   사본이 있으니 **이 파일의 자리가 곧 커밋되는 저장소**다. git 에게 되묻는 판은 cwd 를 따라가
 *   남의 저장소에서 부르면 그 저장소를 답한다(더 많은 부품 · 더 넓은 사각).
 *
 * 🔑 대상 목록을 **손으로 안 적는다** — 훅에서 파생한다. 같은 목록을 두 곳에 적으면 갈라지고,
 *   갈라지는 방향은 언제나 「통과」다(가드 맹점 ④). 훅에 게이트가 하나 늘면 이 검사도 같이 는다.
 *
 * ⚠ 범위 — **훅이 직접 부르는 검사기**만이다. `tools/이해대장.js`·`tools/대기열.js` 처럼 손으로
 *   부르는 도구는 여기 규칙의 대상이 아니다(그쪽에서 그 변수는 「지금 프로젝트」를 뜻한다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const 훅원본 = path.join(ROOT, 'tools', 'githooks', 'pre-commit');

/* 주석 제거 통로는 공용 하나다 — `tests/lib/소스검사.js` (F401 계열 · 대기열 P3 #Q72).
 * 여기 있던 지역 사본은 **줄머리 `//` 만** 지워서 인라인 주석이 그대로 코드로 세어졌다. */
const { 코드만 } = require('./lib/소스검사.js');

/** 판정 1벌 — 이 소스가 ROOT 를 `CLAUDE_PROJECT_DIR` 로 잡는가. 주석에 그 이름이 나오는 것은
 *  위반이 아니다(이 저장소는 왜 안 쓰는지를 주석으로 적는다 — 그걸 잡으면 처방이 곧 위반이 된다). */
function 환경변수로뿌리를잡나(소스) {
  return /^[^\n]*\bROOT\s*=[^\n]*process\.env\.CLAUDE_PROJECT_DIR/m.test(코드만(소스));
}

/** 훅이 `node "$ROOT/tools/….js"` 로 부르는 검사기들 — 목록의 출처는 훅 하나뿐이다. */
function 훅이부르는검사기() {
  const 훅 = fs.readFileSync(훅원본, 'utf8');
  const 이름들 = new Set();
  for (const m of 훅.matchAll(/node\s+"\$ROOT\/(tools\/[^"]+\.js)"/g)) 이름들.add(m[1]);
  return [...이름들];
}

/* ── 탐지력은 픽스처가 진다 (실저장소는 아래에서 거짓양성만 묻는다) ──── */

test('🔴 탐지력 — `CLAUDE_PROJECT_DIR` 로 뿌리를 잡는 소스를 잡는다', () => {
  assert.ok(환경변수로뿌리를잡나("const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');"),
    '이 검사가 지금 막고 있는 바로 그 형태를 못 잡는다');
  assert.ok(환경변수로뿌리를잡나('const ROOT = process.env.CLAUDE_PROJECT_DIR;'),
    '폴백 없는 형태를 못 잡는다 — 더 나쁜 쪽이다');
});

test('🔑 거짓양성 — 올바른 형태와 «왜 안 쓰는지» 적은 주석은 위반이 아니다', () => {
  assert.strictEqual(환경변수로뿌리를잡나("const ROOT = path.resolve(__dirname, '..');"), false,
    '처방한 형태를 위반으로 셌다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)');
  assert.strictEqual(환경변수로뿌리를잡나("/* CLAUDE_PROJECT_DIR 을 얹지 않는다 — 워크트리에서 눈이 먼다 */\nconst ROOT = path.resolve(__dirname, '..');"), false,
    '이유를 적은 주석을 위반으로 셌다 — 그러면 아무도 이유를 안 적는다');
  assert.strictEqual(환경변수로뿌리를잡나("const 프로젝트 = process.env.CLAUDE_PROJECT_DIR || '.';"), false,
    'ROOT 가 아닌 다른 쓰임까지 막았다 — 규칙이 자기 범위를 넘는다');
});

/* ── 실저장소 ─────────────────────────────────────────────────────────── */

test('🔑 미측정 방어 — 훅에서 검사기 목록이 실제로 수확된다 (0건이면 아래가 공회전한다 · F207)', () => {
  const 목록 = 훅이부르는검사기();
  assert.ok(목록.length >= 4, `훅에서 검사기를 ${목록.length}개밖에 못 읽었다 — 파싱이 낡았거나 훅이 바뀌었다`);
});

test('🔴 훅이 부르는 검사기는 어느 것도 `CLAUDE_PROJECT_DIR` 로 뿌리를 잡지 않는다', () => {
  const 샌다 = [];
  let 열어본수 = 0;
  for (const rel of 훅이부르는검사기()) {
    let 소스;
    try { 소스 = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { continue; }  // 부분 체크아웃
    열어본수 += 1;
    if (환경변수로뿌리를잡나(소스)) 샌다.push(rel);
  }
  assert.ok(열어본수 > 0, '검사기를 하나도 못 열었다 — 초록이 아니라 미실행이다(F207)');
  assert.deepStrictEqual(샌다, [],
    `이 게이트들은 워크트리에서 옆 저장소를 재고 조용히 통과한다(F403) — `
    + `ROOT 를 path.resolve(__dirname, '..') 로 바꾼다:\n  ${샌다.join('\n  ')}`);
});
