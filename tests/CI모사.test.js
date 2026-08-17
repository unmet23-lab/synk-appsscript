/**
 * tools/test-ci.js 회귀 — **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.**
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 옆 세션이
 *   Code.js·HTML 을 편집하면 테스트가 중간 상태를 읽고 빨간불이 된다. 그 적색은
 *   진짜 적색과 모양이 완전히 같아서, 실제로 그걸 보고 **남의 살아있는 작업본
 *   (Code.js ← 931bae1e 세션)을 고치러 갈 뻔했다.** 재실행하니 둘 다 초록이었다.
 *
 * ⚠ 이 파일의 탐지력 한계: 스위트 전체를 돌리는 스크립트라 실동작 재현이 비싸서
 *   **비교 로직만 격리해 검사**하고, 배선(전후 스냅샷·경고 출력)은 소스로 본다.
 *   즉 「경고를 지웠다」는 잡지만 「비교가 미묘하게 틀렸다」는 아래 격리 검사가 진다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 파일소스 } = require('./lib/소스검사');

const ROOT = path.resolve(__dirname, '..');
/* 🔑 `파일소스()` 로 읽는다 — 읽으면서 줄끝 표기를 접는다(#Q101 · 2026-08-17).
 *   그전엔 원문 그대로 읽고 앵커 쪽에서 `\r?\n` 으로 CRLF 만 받아냈다. 형제 축(줄 끝 공백)은
 *   열려 있어서, 행동을 한 글자도 안 바꾸는 변형에 아래 두 시험이 **실측으로** 빨개졌다.
 *   접기는 이제 이음매가 진다 — 여기 손 접기를 다시 적으면 그게 곧 사본이다. */
const SRC = 파일소스(path.join(ROOT, 'tools', 'test-ci.js'));

/** test-ci.js 의 비교 로직을 그 소스에서 **꺼내 와** 돌린다(베껴 쓰면 같이 눈이 먼다). */
function movedFrom(src, before, after) {
  const body = src.match(/const moved = \[\];\n([\s\S]*?)\nif \(code !== 0/);
  assert.ok(body, 'test-ci.js 에서 변화 비교 블록을 못 찾았다 — 구조가 바뀌었으면 이 회귀도 갱신하라');
  const moved = [];
  new Function('moved', 'before', 'after', body[1])(moved, before, after);
  return moved;
}

test('🔑 도는 동안 바뀐 파일을 잡는다 — 수정도 삭제도', () => {
  const before = new Map([['Code.js', '100:5'], ['docs/a.md', '200:9'], ['tests/b.js', '300:1']]);
  const after = new Map([['Code.js', '999:7'], ['tests/b.js', '300:1'], ['새파일.js', '400:2']]);
  const moved = movedFrom(SRC, before, after);

  assert.ok(moved.some((m) => m.startsWith('Code.js')), '내용이 바뀐 파일을 못 잡았다 — 거짓 적색이 진짜처럼 보인다');
  assert.ok(moved.some((m) => m.startsWith('docs/a.md')), '사라진 파일을 못 잡았다');
  assert.ok(!moved.some((m) => m.startsWith('tests/b.js')), '안 바뀐 파일을 바뀌었다고 했다 — 매번 경고면 경고가 죽는다');
  // 새로 **생긴** 파일은 셀 필요가 없다 — 테스트가 읽던 대상이 아니었다(스위트 자신의 산출물이 섞인다)
  assert.ok(!moved.some((m) => m.startsWith('새파일.js')), '새로 생긴 파일까지 셌다 — 거짓 경고가 는다');
});

test('🔑 변화가 없으면 조용하다 (거짓양성 0)', () => {
  const same = new Map([['Code.js', '100:5'], ['docs/a.md', '200:9']]);
  assert.deepStrictEqual(movedFrom(SRC, same, new Map(same)), [], '아무것도 안 바뀌었는데 경고 대상이 생겼다');
});

test('배선 — 실행 전후로 스냅샷을 찍고, 적색일 때만 경고한다', () => {
  assert.match(SRC, /const before = snapshot\(\)[\s\S]{0,400}spawnSync[\s\S]{0,200}const after = snapshot\(\)/,
    '실행 **전후**로 스냅샷을 안 찍는다 — 한쪽만 찍으면 비교가 성립하지 않는다');
  assert.match(SRC, /if \(code !== 0 && moved\.length\)/,
    '초록일 때도 경고하거나, 적색인데 변화를 안 본다');
  assert.match(SRC, /이 적색은 못 믿는다/, '거짓 적색이라는 표시가 사라졌다 — 진짜와 구별이 안 된다');
  assert.match(SRC, /재실행하라/, '무엇을 하라는 지시가 없다 — 경고만 있으면 또 고치러 간다');
  assert.match(SRC, /작업본소유자/, '누구 파일인지 가르는 도구를 안 알려준다(F073)');
});

test('스냅샷 대상이 테스트가 읽는 곳을 덮는다 — 루트·tests·tools·docs·.claude', () => {
  // 실측된 거짓 적색 2회의 진원지가 **Code.js(루트)** 와 **docs/ 아래 HTML** 이었다.
  const walk = SRC.match(/walk\(ROOT, 0\);\s*for \(const d of \[([^\]]*)\]\)/);
  assert.ok(walk, '스냅샷 대상 목록을 못 찾았다');
  for (const d of ['tests', 'tools', 'docs', '.claude']) {
    assert.ok(walk[1].includes(`'${d}'`), `스냅샷이 ${d} 를 안 본다`);
  }
  assert.match(SRC, /\.\(js\|json\|md\|html\|txt\)\$/i, '확장자 목록이 좁아졌다 — html 이 빠지면 실측된 거짓 적색을 놓친다');
});
