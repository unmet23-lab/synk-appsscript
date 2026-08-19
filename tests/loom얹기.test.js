/**
 * Loom 얹기 통로 회귀 — 공용 통로가 «판정 셋»을 실제로 지는지 픽스처로 못박는다.
 *
 * 왜 픽스처인가: 실저장소로만 재면 「지금 그런 지면이 없다」와 「검사가 안 돈다」가 같은 모양이다.
 *   탐지력은 여기서 지고(픽스처), 실저장소에는 **거짓양성만** 묻는다(맨 아래 한 건).
 *
 * 이 파일이 막는 것 넷 — 전부 「새는 방향이 통과」인 자리다:
 *   ① 훅 0 인데 얹는다      → 부품 0 인 채 마커만 켜져 전파가 거짓 초록이 된다(F517②)
 *   ② 지면 CSS «앞»에 얹는다 → 특정도 동점에서 지면이 이겨 훅은 늘고 화면은 그대로다
 *   ③ 두 번 돌리면 쌓인다    → 빌드를 두 번 부른 날 지면이 조용히 두 배가 된다
 *   ④ 사본이 다시 생긴다    → 발표물빌드가 자기 판정을 도로 들면 그 순간 둘이 갈라진다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 얹기모듈 = require('../tools/lib/loom얹기.js');

/** 픽스처 — 지면 하나의 최소 골격. `</style>` 이 있고, 부품 클래스는 인자로 받는다. */
const 지면 = (본문, 스타일 = 'body{color:#1B1B1A}') =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">\n<style>${스타일}</style>\n</head>\n<body>\n${본문}\n</body></html>`;

test('① 훅 0 이면 안 얹는다 — 부품 없는 지면에 마커만 켜지는 것을 막는다', () => {
  const html = 지면('<p>부품이 하나도 없는 지면이다.</p>');
  const r = 얹기모듈.얹기(html, { 지면: '부품만' });
  assert.equal(r.얹힘, false, '훅 0 인데 얹었다 — 전파가 거짓 초록이 된다');
  assert.equal(r.훅.length, 0);
  assert.ok(r.사유, '안 얹었으면 사유가 있어야 한다 — 없으면 다음 사람이 원인을 못 찾는다');
  assert.ok(!/data-loom/.test(r.html), '안 얹었다면서 블록이 들어갔다');
});

test('② 훅이 있으면 얹고, 마커가 실제로 들어간다', () => {
  const html = 지면('<div class="칩">태그</div>');
  const r = 얹기모듈.얹기(html, { 지면: '부품만' });
  assert.equal(r.얹힘, true, `훅이 있는데 안 얹었다 — 사유: ${r.사유}`);
  assert.ok(r.훅.includes('.칩'), `훅에 .칩 이 없다: ${r.훅.join(',')}`);
  assert.match(r.html, /<style data-loom="부품만">/, '얹은 블록에 프리셋 표식이 없다 — 뜯기가 지면을 못 가린다');
  assert.match(r.html, /\/\*loom부품:/, '마커가 없다 — 지면방이 이 지면을 「안얹힘」으로 읽는다');
});

test('③ 얹는 자리는 지면 CSS «뒤» 다 — 앞에 두면 동점에서 지면이 이긴다', () => {
  const html = 지면('<div class="칩">태그</div>', '.칩{color:red}');
  const r = 얹기모듈.얹기(html, { 지면: '부품만' });
  assert.equal(r.얹힘, true);
  const 지면CSS = r.html.indexOf('.칩{color:red}');
  const 얹은블록 = r.html.indexOf('<style data-loom=');
  assert.ok(지면CSS >= 0 && 얹은블록 >= 0, '두 자리를 다 못 찾았다 — 픽스처가 헛돈다');
  assert.ok(얹은블록 > 지면CSS,
    '얹은 블록이 지면 CSS 앞에 있다 — 특정도가 같아(0,1,0) 동점에서 지면이 이기고, 훅은 늘었는데 화면은 그대로가 된다');
});

test('④ `<style>` 이 없는 지면은 `</head>` 앞에 얹는다 — 그것도 지면 CSS 뒤다', () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><div class="칩">t</div></body></html>';
  const r = 얹기모듈.얹기(html, { 지면: '부품만' });
  assert.equal(r.얹힘, true, `스타일 없는 지면에 못 얹었다 — 사유: ${r.사유}`);
  assert.ok(r.html.indexOf('<style data-loom=') < r.html.indexOf('</head>'), '`</head>` 뒤에 얹혔다');
});

test('⑤ 멱등 — 두 번 돌려도 블록이 하나다', () => {
  const html = 지면('<div class="칩">태그</div>');
  const 한번 = 얹기모듈.얹기(html, { 지면: '부품만' }).html;
  const 두번 = 얹기모듈.얹기(한번, { 지면: '부품만' }).html;
  const 셈 = (s) => (s.match(/<style data-loom=/g) || []).length;
  assert.equal(셈(한번), 1);
  assert.equal(셈(두번), 1, '두 번 돌리자 블록이 쌓였다 — 빌드를 두 번 부른 날 지면이 두 배가 된다');
  assert.equal(두번, 한번, '두 번째 결과가 첫 번째와 다르다 — 멱등이 아니다');
});

test('⑥ 뜯기 — 얹은 것을 되돌리면 원문이다(`--check` 가 1:1 대조를 할 수 있다)', () => {
  const html = 지면('<div class="칩">태그</div>');
  const 얹은 = 얹기모듈.얹기(html, { 지면: '부품만' }).html;
  assert.notEqual(얹은, html, '픽스처 확인 — 얹혔어야 한다');
  assert.equal(얹기모듈.뜯기(얹은), html, '뜯었는데 원문이 아니다');
});

test('⑦ 범위진단 — `ol` 은 있는데 `.룸` 이 없으면 이름째 신고한다', () => {
  /* 🔴 이 자리가 실측으로 제일 많이 샌 곳이다(08-18: 안 입은 12벌 중 10벌).
   *   `부품만` 은 맨요소 규칙을 `.룸` 안에 가두므로, 목록이 있어도 스코프가 없으면 아무 데도 안 닿는다. */
  const 없음 = 지면('<ol><li>하나</li><li>둘</li></ol>');
  const r1 = 얹기모듈.얹기(없음, { 지면: '부품만' });
  assert.equal(r1.얹힘, false, '훅 0 이어야 한다 — .룸 이 없으면 맨요소 규칙이 안 닿는다');
  assert.ok(r1.범위흠, '`.룸` 이 없는데 범위흠을 신고 안 했다 — 다음 사람이 원인을 영영 못 찾는다');
  assert.match(r1.범위흠, /룸/, '신고문이 무엇을 더하라는지 안 말한다');

  const 있음 = 지면('<div class="룸"><ol><li>하나</li></ol></div>');
  const r2 = 얹기모듈.얹기(있음, { 지면: '부품만' });
  assert.equal(r2.범위흠, null, '`.룸` 이 있는데도 범위흠을 냈다 — 거짓양성이다');
  assert.equal(r2.얹힘, true, `.룸 을 씌웠는데 여전히 안 얹는다 — 사유: ${r2.사유}`);
  assert.ok(r2.훅.some((s) => s.includes('ol')), `순번 부품이 안 닿는다: ${r2.훅.join(',')}`);
});

test('⑧ 통짜 지면(문서)은 범위진단이 «안» 걸린다 — 그 프리셋엔 스코프가 없다', () => {
  const html = 지면('<ol><li>하나</li></ol>');
  const r = 얹기모듈.얹기(html, { 지면: '문서' });
  assert.equal(r.범위흠, null, '스코프 없는 프리셋에 범위흠을 냈다 — 따를 수 없는 처방이다(F103)');
});

test('⑨ 모르는 프리셋은 조용히 넘어가지 않는다', () => {
  assert.throws(() => 얹기모듈.얹기(지면('<div class="칩">t</div>'), { 지면: '없는지면' }),
    /모르는 지면 프리셋/, '오타난 프리셋을 조용히 삼키면 「돌았는데 아무것도 안 얹힌」 판이 초록으로 남는다');
});

/* ─── 등록층 — 사본이 다시 생기지 않았나 (가드는 로직보다 여기서 샌다) ─────────── */
test('⑩ 발표물빌드가 판정을 «다시 베끼지» 않았다 — 통로는 하나다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', '발표물빌드.js'), 'utf8');
  assert.match(src, /require\(['"]\.\/lib\/loom얹기\.js['"]\)/, '발표물빌드가 공용 통로를 안 쓴다');
  /* 자기 판정을 도로 든 자리 — 훅 게이트·얹을 자리를 직접 구현하면 그 순간 둘이 갈라진다 */
  assert.doesNotMatch(src, /닿는선택자들\s*\(/, '발표물빌드가 「닿나」 판정을 다시 베꼈다 — 재는 자는 하나다(F517①)');
  assert.doesNotMatch(src, /lastIndexOf\(['"]<\/style>['"]\)/, '발표물빌드가 「얹을 자리」를 다시 베꼈다');
});

/* ─── 실저장소 — 거짓양성만 묻는다(탐지력은 위 픽스처가 진다) ─────────────────── */
test('⑪ 실저장소 — 이미 입은 지면을 이 통로가 「안 얹힌다」고 말하지 않는다', () => {
  const 입은것 = require('../tools/lib/지면방.js').점검().갈래.입는다
    .filter((r) => r.입음).map((r) => r.경로);
  assert.ok(입은것.length >= 5, `입은 지면이 ${입은것.length}벌뿐 — 분모가 사라지면 이 검사는 무의미하다(F207)`);
  /* 통로가 「얹혀 있다」를 못 읽으면 빌드가 매번 새로 얹어 지면이 흔들린다 */
  const 못읽음 = 입은것.filter((rel) => !얹기모듈.얹힘(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
  assert.deepEqual(못읽음, [], `이미 얹힌 지면을 통로가 못 읽는다: ${못읽음.join(', ')}`);
});
