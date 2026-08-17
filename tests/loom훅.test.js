/* loom훅 회귀 — `tools/lib/loom훅.js` (Loom 전파 술어).
 *
 * 무엇을 지키나 — 옛 술어는 CSS 주석 마커 하나였다. 그래서 **얹기만 하면 부품 0개여도
 * 「입었다」**로 켜졌다(F517①). 그 실패는 초록의 얼굴로 오고, 화면은 한 픽셀도 안 바뀐다.
 *
 * 탐지력은 **픽스처가 진다**(가드 맹점 ② — 실저장소가 병들어 있기를 요구하지 않는다).
 * 오늘 실저장소의 「마커만」은 0건이라, 실물만 보면 이 술어는 아무것도 증명하지 못한다.
 * ⇒ 아래는 «병든 지면»을 손으로 만들어 술어가 실제로 무는지 본다.
 *
 * 🔑 픽스처의 CSS 는 **진짜 `loom.css()` 출력**이다. 축소 모형으로 쓰면 선택자 문법이
 *    실물과 갈리고, 갈리는 방향은 언제나 「통과」다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 훅 = require(path.join(루트, 'tools', 'lib', 'loom훅.js'));
const loom = require(path.join(루트, 'tools', 'lib', 'loom.js'));

const 전역CSS = loom.css({});
const 범위CSS = loom.css({ 지면: '인쇄부품' });
const 지면 = (css, 마크업) => `<html><head><style>${css}</style></head><body>${마크업}</body></html>`;

/* ── ① 급소 — 얹혔는데 안 닿는 것을 무나 ────────────────────────────────── */

test('🔴 범위 프리셋 + 맨요소뿐인 원고 = 「마커만」 — F517② 그 자리다', () => {
  /* 발표물 6벌이 정확히 이 상태였다: 부품 클래스 0, `.룸` 없음. 옛 술어는 여기서 초록이었다. */
  const r = 훅.파일판정(지면(범위CSS, '<h2>제목</h2><ol><li>가</li></ol><p>글</p>'));
  assert.ok(r.마커 > 0, '마커는 얹혀 있어야 한다 — 그래야 「마커만」 상태가 성립한다');
  assert.deepEqual(r.닿은, [],
    '범위 프리셋은 맨요소를 `.룸` 안에 가둔다 — `.룸` 이 없으면 CSS 는 아무 데도 안 닿는다');
});

test('🔴 부품을 CSS 에만 적고 마크업엔 안 쓰면 「마커만」 — 정의는 사용이 아니다', () => {
  const r = 훅.파일판정(지면(전역CSS, '<div><img src="x" alt=""></div>'));
  assert.equal(r.닿은.length, 0, '<style> 안의 클래스 이름을 «쓴 것»으로 세면 술어가 늘 참이 된다');
});

test('🔴 원고 CSS 의 «속성 선택자»에 든 이름도 훅이 아니다 — 스타일만 베낀 지면이 켜진다', () => {
  /* ⚠픽스처는 **속성 선택자**라야 한다. `.칩{}` 만 두면 `class="…"` 문자열이 CSS 에 없어서
   *   「CSS 까지 본다」로 망가뜨려도 결과가 같다 — 첫 판이 그래서 변이 구멍으로 나왔다
   *   (`발표물Loom.test.js` 가 같은 이유로 같은 모양을 쓴다). */
  const 집합 = 훅.마크업집합('<style>[class="칩 룸"]{color:red}</style><div class="tag">x</div>');
  assert.ok(!집합.클래스.has('칩'), 'CSS 안의 `class="칩"` 문자열을 «쓴 것»으로 세면 안 된다');
  assert.ok(집합.클래스.has('tag'), '마크업의 클래스는 세야 한다');
  assert.ok(!집합.태그.has('style'), '<style> 블록은 통째로 마크업이 아니다');
});

/* ── ② 반대 방향 — 이미 입은 지면을 거짓 강등하지 않나 ────────────────────── */

test('✅ 전역 프리셋 + 맨요소 = 입음 — 클래스만 세는 술어였다면 7벌이 거짓 강등됐다', () => {
  const r = 훅.파일판정(지면(전역CSS, '<h2>제목</h2><ol><li>가</li></ol>'));
  const 이름 = r.닿은.map((d) => d.선택자);
  assert.ok(이름.includes('h2'), '전역 프리셋은 맨 h2 로 입는다: ' + JSON.stringify(이름.slice(0, 6)));
  assert.ok(이름.includes('ol'), '전역 프리셋은 맨 ol 로 입는다');
});

test('✅ 범위 프리셋 + `.룸` 을 씌운 원고 = 입음', () => {
  const r = 훅.파일판정(지면(범위CSS, '<div class="룸"><h2>제목</h2></div>'));
  assert.ok(r.닿은.length > 0, '`.룸` 을 씌우면 갇혀 있던 맨요소 규칙이 살아난다');
});

test('✅ 부품 클래스 하나만 있어도 입음 — 발표물 3벌이 `.칩` 으로 입었다', () => {
  const r = 훅.파일판정(지면(범위CSS, '<span class="칩">태그</span>'));
  assert.deepEqual(r.닿은.map((d) => d.선택자).filter((s) => s === '.칩'), ['.칩']);
});

/* ── ③ 훅 규칙 — 여기가 헐거우면 위의 판정이 전부 흔들린다 ────────────────── */

test('`:not()`·`:has()` 안은 «요구»가 아니다 — 괄호 안에 속으면 멀쩡한 지면이 빨개진다', () => {
  assert.deepEqual(훅.필수훅('h2:not(:has(.번호))::before'), ['h2'],
    '`.번호` 를 요구로 세면, 번호를 안 적은 원고가 통째로 「안 닿음」이 된다');
  assert.deepEqual(훅.필수훅('a:not(.레일 a)'), ['a'],
    '괄호 «안»의 공백에 속으면 실패가 「안 닿는다」쪽으로 떨어진다');
  /* 🔑 **중첩**이 진짜 급소다 — 안쪽부터 지우지 않으면 바깥 괄호가 안 닫혀서
   *   그 안의 `.대상` 이 «요구»로 새어 나온다(= 멀쩡한 지면이 거짓 적색). */
  assert.deepEqual(훅.필수훅('h2:not(:has(.번호) .대상)'), ['h2'],
    '중첩 괄호를 안쪽부터 안 지우면 `.대상` 이 요구로 남는다');
});

test('`html`·`body`·`*`·`:root` 는 훅이 아니다 — 늘 있는 것은 증거가 아니다', () => {
  for (const s of ['body', 'html', '*', ':root'])
    assert.deepEqual(훅.필수훅(s), [], `${s} 가 훅이면 술어는 어떤 지면에서도 참이 된다`);
  /* 실물 급소: `.글,article,body{counter-reset:절;}` — `body` 하나 때문에 통째로 참이 됐었다. */
  const 닿은 = 훅.닿는선택자들('.글,article,body{counter-reset:절;}', '<body><div>없다</div></body>');
  assert.deepEqual(닿은, [], '`body` 를 세면 이 규칙 하나로 모든 지면이 「입었다」가 된다');
});

test('조상 선택자는 **전부** 있어야 닿는다 — 하나라도 빠지면 안 닿는다', () => {
  assert.deepEqual(훅.필수훅('.룸 h2').sort(), ['.룸', 'h2']);
  assert.deepEqual(훅.필수훅('ol>li::before').sort(), ['li', 'ol']);
  const 집합 = (m) => 훅.닿는선택자들('.룸 h2{color:red}', m).length;
  assert.equal(집합('<div class="룸"><h2>가</h2></div>'), 1);
  assert.equal(집합('<h2>룸이 없다</h2>'), 0, '범위 클래스가 없으면 안 닿는다 — 이게 F517② 의 뿌리다');
  assert.equal(집합('<div class="룸">h2 가 없다</div>'), 0);
});

/* ── ④ CSS 읽기 — 경계가 새면 원고 CSS 가 훅으로 들어온다 ────────────────── */

test('마커 구간 밖의 CSS 는 훅이 아니다 — 원고 CSS 가 새면 술어가 다시 헐거워진다', () => {
  const css = '.원고전용{color:red}\n/*loom부품:태그*/ .칩{color:blue}\n';
  const 구간 = 훅.마커구간들(css);
  assert.equal(구간.length, 1, '마커 하나');
  assert.ok(!구간[0].본문.includes('.원고전용'), '마커 «앞»의 규칙이 구간에 들어오면 안 된다');
  const r = 훅.파일판정(`<style>${css}</style><body><div class="원고전용">x</div></body>`);
  assert.deepEqual(r.닿은, [], '원고 클래스가 닿는다고 Loom 을 입은 것이 아니다');
});

test('`@media`·`@page` 프렐류드는 선택자가 아니고, 그 안쪽 규칙은 집는다', () => {
  const sels = 훅.선택자들('@media print{ .룸 h2{color:red} } @page{margin:0}');
  assert.ok(!sels.some((s) => s.startsWith('@')), '@규칙 프렐류드가 선택자로 새면 안 된다: ' + JSON.stringify(sels));
  assert.ok(sels.includes('.룸 h2'), '안쪽 규칙은 집어야 한다: ' + JSON.stringify(sels));
});

test('문자열 안의 중괄호가 «가짜 선택자»를 만들지 않는다', () => {
  const sels = 훅.선택자들('.가::before{content:"{"} .나{color:red}');
  assert.ok(sels.includes('.나'), '뒤따르는 진짜 선택자는 그대로 찾아야 한다: ' + JSON.stringify(sels));
  /* 🔑 새는 방향은 «못 찾는다»가 아니라 **없는 선택자를 만들어 낸다** 쪽이다.
   *   문자열을 안 지우면 `content:"} .룸 {"` 의 «}» 가 블록을 조기 종료시켜
   *   그 안의 `.룸` 이 진짜 선택자로 읽힌다 — 부품 0인 지면이 초록이 되는 경로다. */
  const 가짜 = 훅.선택자들('.가{content:"} .룸 {"} p{color:red}');
  assert.ok(!가짜.includes('.룸'),
    'CSS 문자열 안의 글자가 선택자로 새어 나왔다: ' + JSON.stringify(가짜));
  assert.ok(가짜.includes('p'), '진짜 선택자는 여전히 찾아야 한다: ' + JSON.stringify(가짜));
});

test('마지막 마커는 규칙 하나까지만 읽는다 — 그 뒤는 재질층이라 부품 훅이 아니다', () => {
  const css = '/*loom부품:본문타이포*/ p,li{font-family:X;}\n/* 낮 지면 */ .재질층{color:red}';
  const 구간 = 훅.마커구간들(css);
  assert.equal(구간.length, 1);
  assert.ok(!구간[0].본문.includes('.재질층'),
    '구간이 재질층을 삼키면 부품이 0인 지면도 재질 선택자로 초록이 된다');
});

/* ── ⑤ 실물 — 여기서는 «거짓양성 0» 만 본다(맹점 ②) ─────────────────────── */

test('실저장소 — 진짜 `loom.css()` 를 얹은 지면은 셋 다 닿는다(거짓 적색 0)', () => {
  /* 실측으로 굳힌 값이 아니라 «원리»를 본다: 전역이면 맨요소로, 범위면 `.룸`·부품으로 닿는다. */
  for (const [이름, css, 마크업] of [
    ['전역', 전역CSS, '<h2>가</h2>'],
    ['범위-룸', 범위CSS, '<div class="룸"><p>가</p></div>'],
    ['범위-칩', 범위CSS, '<span class="칩">가</span>'],
  ]) {
    const r = 훅.파일판정(지면(css, 마크업));
    assert.ok(r.닿은.length > 0, `${이름} 이 안 닿는다고 나왔다 — 이 장치는 거짓 적색 쪽으로 샌다`);
  }
});
