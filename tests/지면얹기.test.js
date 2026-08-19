/**
 * ④ 지면 배선 잔여 — 「밝은 화면」 축 회귀 (2026-08-19)
 *
 * 이 파일이 막는 것 넷. 전부 **새는 방향이 「통과」**인 자리다:
 *   ① `인쇄부품` 의 낮 교정이 `@media print` 안이라, 밝은 «화면» 지면에 얹으면 제목이 사라지는데
 *      부품은 멀쩡히 보여서 전파는 초록으로 뜬다 → `밝은부품` 이 그 자리를 진다.
 *   ② 밝은 층이 **남의 지면의 맨 글자**(p·li·td)까지 검게 만들면, 밝은 지면 안의 «어두운 섬»
 *      (header 같은 것)이 통째로 사라진다 → 화면 층은 Loom 자신의 글만 만진다.
 *   ③ 번호를 손으로 적은 `ol` 에 counter 를 씌우면 «① 1. …» 두 번 번호가 된다 → `.민` 이 걷는다.
 *   ④ 손 HTML 은 생성기가 없어 **한 번 얹으면 끝**이라, Loom 이 바뀌어도 그 지면만 옛 CSS 로 남는다
 *      (F630 이 그 사고였다) → `지면얹기 --확인` 이 낡음을 적색으로 낸다.
 *
 * 탐지력은 **픽스처**가 진다 — 실저장소로만 재면 「지금 그런 지면이 없다」와 「검사가 안 돈다」가
 * 같은 모양이다. 실저장소에는 거짓양성만 묻는다(맨 아래 두 건).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const loom = require('../tools/lib/loom.js');
const 지면얹기 = require('../tools/지면얹기.js');
const 발표물 = require('../tools/발표물빌드.js');

/** `@media print{…}` 를 통째로 걷어낸 판 — 「화면에서 무엇이 걸리나」만 남긴다. */
function 화면만(css) {
  let 남 = ''; let i = 0;
  while (i < css.length) {
    const m = css.indexOf('@media print{', i);
    if (m < 0) { 남 += css.slice(i); break; }
    남 += css.slice(i, m);
    let 깊이 = 0; let j = m + '@media print'.length;
    for (; j < css.length; j += 1) {
      if (css[j] === '{') 깊이 += 1;
      else if (css[j] === '}') { 깊이 -= 1; if (깊이 === 0) { j += 1; break; } }
    }
    i = j;
  }
  return 남;
}

const h2색 = (css) => {
  const m = /\.룸 h2\{color:var\(--([a-z0-9]+)\)/.exec(css);
  return m ? m[1] : null;
};

test('① 밝은부품은 «화면에서» 제목을 Ink 로 낸다 — 인쇄부품은 못 한다(탐지력)', () => {
  const 밝 = 화면만(loom.css({ 지면: '밝은부품' }));
  const 인 = 화면만(loom.css({ 지면: '인쇄부품' }));

  assert.equal(h2색(밝), 'ink',
    '밝은부품이 화면에서 h2 를 Ink 로 안 낸다 — Paper 위 Chalk = 1.21:1 로 제목이 사라진다');
  assert.match(밝, /\.룸 a\{color:var\(--ink\)/,
    '밝은부품이 화면에서 링크를 Ink 로 안 낸다');

  /* 탐지력 — 이 대조가 없으면 「둘 다 Ink 라 통과」인지 「검사가 안 돈다」인지 못 가른다. */
  assert.notEqual(h2색(인), 'ink',
    '인쇄부품이 화면에서 이미 Ink 라면 이 프리셋을 새로 세운 사유가 사라진다 — 검사를 다시 짜라');
});

test('② 밝은 «화면» 층은 남의 맨 글자를 안 만진다 — 어두운 섬이 사라지는 것을 막는다', () => {
  const 밝 = 화면만(loom.css({ 지면: '밝은부품' }));
  assert.ok(!/\.룸 p,\.룸 li,\.룸 b,\.룸 strong,\.룸 td,\.룸 th,\.룸 h3\{color:var\(--ink\)/.test(밝),
    '화면 층이 p·li·td 까지 Ink 로 만든다 — 밝은 지면 «안»의 어두운 header 글이 통째로 사라진다');

  /* 종이 쪽은 그대로여야 한다 — 거기선 Loom 이 판 전체를 가지므로 맨 글자를 만지는 게 맞다. */
  const 전량 = loom.css({ 지면: '밝은부품' });
  assert.match(전량, /\.룸 p,\.룸 li,\.룸 b,\.룸 strong,\.룸 td,\.룸 th,\.룸 h3\{color:var\(--ink\)/,
    '인쇄 층에서까지 맨 글자 교정이 사라졌다 — 종이에서 본문이 Cream 으로 남는다(1.13:1)');
});

test('③ 밝은부품은 남의 인용을 «안 흐린다» — 판 위 blockquote 의 대비를 보장할 수 없다', () => {
  const 밝 = 화면만(loom.css({ 지면: '밝은부품' }));
  assert.match(밝, /\.룸 blockquote\{color:var\(--ink\);\}/,
    '화면 층이 인용을 Ash 2 로 흐린다 — Chalk 판 위에서 4.46:1 이라 렌더린트가 문다(실측 08-19)');
});

test('④ `.민` — 손으로 번호를 적은 ol 에서 counter 원판을 걷는다', () => {
  const css = loom.css({ 지면: '밝은부품' });
  assert.match(css, /\.룸 ol\.민>li::before,\.룸 ol\.민>li::after\{content:none;display:none;\}/,
    '.민 옵트아웃이 없다 — 손번호 목록이 「① 1. …」 로 두 번 번호가 된다');
  assert.match(css, /\.룸 ol>li::before\{content:counter\(순번\)/,
    '기본 순번 원판이 사라졌다 — .민 을 더하면서 기본 규칙을 건드렸다(흠 검사가 그 모양을 잰다)');
});

test('⑤ 룸씌우기 — 어두운 칸은 건너뛴다(휘도로 가른다 · 클래스 이름으로 안 가른다)', () => {
  const html = [
    '<style>:root{--밤:#08090C;--낮:#FAFAF9}',
    '.어둠칸{background:var(--밤)} .밝은칸{background:var(--낮)}</style>',
    '<section class="어둠칸"><h2>어두운 판</h2></section>',
    '<section class="밝은칸"><h2>밝은 판</h2></section>',
  ].join('\n');
  const r = 발표물.룸씌우기(html);
  assert.equal(r.밝음, 1);
  assert.equal(r.어둠, 1);
  assert.match(r.html, /<section class="밝은칸 룸"/, '밝은 칸에 룸이 안 붙었다 — 맨요소 훅이 어디에도 안 닿는다');
  assert.ok(!/<section class="어둠칸 룸"/.test(r.html),
    '어두운 칸에 룸이 붙었다 — 낮 층이 그 안의 글을 Ink 로 바꿔 판이 통째로 사라진다');

  /* 멱등 — 빌드를 두 번 부른 날 클래스가 쌓이면 안 된다. */
  assert.equal(발표물.룸씌우기(r.html).html, r.html, '두 번 씌우면 클래스가 쌓인다');
});

test('⑥ 룸씌우기 — 이름이 `dark` 가 아니어도 어두우면 건너뛴다(이름 규칙이 아니라 자다)', () => {
  const html = '<style>.표지{background:#101014}</style>\n<section class="표지"><h2>표지</h2></section>';
  const r = 발표물.룸씌우기(html);
  assert.equal(r.어둠, 1, '이름에 dark 가 없다고 밝다고 읽었다 — 다음 덱에서 그대로 샌다');
});

test('⑦ 민목록 — 손번호만 잡는다(거짓양성까지 못박는다)', () => {
  const 손번호 = '<ol class="q3"><li><span>1.</span> 첫째</li><li><span>2.</span> 둘째</li></ol>';
  assert.equal(발표물.민목록(손번호).센다, 1);
  assert.match(발표물.민목록(손번호).html, /<ol class="q3 민"/);

  const 보통 = '<ol><li>번호를 안 적은 항목</li><li>둘째</li></ol>';
  assert.equal(발표물.민목록(보통).센다, 0, '번호 없는 목록에 .민 을 달았다 — 순번 원판이 통째로 죽는다');
  assert.equal(발표물.민목록(보통).html, 보통);

  /* 멱등 */
  const 한번 = 발표물.민목록(손번호).html;
  assert.equal(발표물.민목록(한번).html, 한번, '두 번 돌리면 .민 이 쌓인다');
});

test('⑧ 휘도 — 킷의 두 정박점이 자를 통과한다', () => {
  assert.ok(발표물.휘도('#FAFAF9') > 0.9, 'Paper 를 어둡다고 읽는다');
  assert.ok(발표물.휘도('#08090C') < 0.02, 'Graphite 를 밝다고 읽는다');
});

/* ── 여기부터 실저장소 — 거짓양성만 묻는다 ───────────────────────────────────── */

test('⑨ [실저장소] 등록된 손 HTML 은 지금 Loom 과 «바이트 동일»하다 (F630 손 HTML 판)', () => {
  const 낡음 = [];
  for (const [rel, 지면] of 지면얹기.등록) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) { 낡음.push(`${rel} — 파일이 없다(등록층이 낡았다)`); continue; }
    const { 원본, html, 얹힘, 사유 } = 지면얹기.굽는다(rel, 지면);
    if (!얹힘) { 낡음.push(`${rel} — 못 얹는다: ${사유}`); continue; }
    if (html !== 원본) 낡음.push(`${rel} — 얹힌 CSS 가 낡았다`);
  }
  assert.deepEqual(낡음, [],
    `\`node tools/지면얹기.js --적용\` 을 돌려라 — 지면이 옛 Loom CSS 를 들고 있다:\n  ${낡음.join('\n  ')}`);
});

test('⑩ [실저장소] 등록층 분모 — 손 HTML 목록이 비지 않았다', () => {
  assert.ok(지면얹기.등록.length >= 4,
    `등록이 ${지면얹기.등록.length}건이다 — 목록이 비면 ⑨ 가 «0건 통과»로 조용히 초록이 된다(F207)`);
  for (const [, 지면] of 지면얹기.등록) {
    assert.ok(loom.지면들[지면], `모르는 프리셋 ${지면} — 아는 것은 ${Object.keys(loom.지면들).join('·')}`);
  }
});
