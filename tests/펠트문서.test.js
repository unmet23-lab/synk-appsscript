/* 지면 스킨 「검은 무대」 회귀 — `tools/펠트문서.js`.
 *
 * 무엇을 지키나 — 셋 다 «실제로 밟은 자리»다(가상의 위험이 아니다):
 *   ① **낮 지면(인쇄·PDF)이 서 있는가.** v0.2 는 종이에도 검은 무대를 그대로 깔았다.
 *      크롬 인쇄의 「배경 그래픽」은 기본이 꺼짐이라 그때 바탕만 흰 종이가 되고 글자는 Cream 으로
 *      남는다 — 실측 **1.13:1**, 소개서 본문이 통째로 사라진다. 이 파일이 그 회귀를 막는다.
 *   ② **등장 숨김이 인쇄에서 풀리는가.** `html.js .듦{opacity:0}` 이 인쇄에도 그대로 걸려 있었다.
 *      실측(뷰포트 794×700 · @media print 적용): 구판 31개 중 **29개가 opacity 0**, 새 판 0개.
 *      스크립트에 4초 안전판이 있지만 그 전에 Ctrl+P 를 누르거나 헤드리스로 PDF 를 뽑으면 진다.
 *   ③ **스킨 CSS 안의 백틱.** 스킨은 템플릿 리터럴 «안»이라 주석에 백틱 하나가 들어가면
 *      지면이 통째로 끊긴다 — 이 트랙에서 실제로 한 번 끊겼다(node --check 가 잡았다).
 *
 * 탐지력은 «변형 문자열»이 진다 — 실제 스킨 출력에서 그 한 줄을 지운 사본을 만들어
 * 검사기가 빨개지는지 본다(가드 맹점 ② — 실저장소가 아직 병들어 있기를 요구하지 않는다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 도구 = require(path.join(루트, 'tools', '펠트문서.js'));

/* ── 검사기 — 스킨 문자열 하나를 받아 흠을 낸다(테스트와 픽스처가 같은 눈을 쓴다) ── */
function 흠찾기(css) {
  const 흠 = [];
  const 인쇄 = css.match(/@media print\{([\s\S]*?)\n  \}/);
  if (!인쇄) 흠.push('@media print 블록이 없다');
  else {
    const p = 인쇄[1];
    if (!/\.듦[^{]*\{[^}]*opacity:1!important/.test(p)) 흠.push('인쇄에서 등장 숨김을 안 푼다(.듦 opacity 리셋 없음)');
    if (!/background:var\(--paper\)/.test(p)) 흠.push('인쇄 바탕이 종이가 아니다');
    if (!/color:var\(--ink\)/.test(p)) 흠.push('인쇄 잉크가 Ink 가 아니다');
    if (!/-webkit-text-fill-color:var\(--ink\)/.test(p)) 흠.push('인쇄 제목이 투명하게 남는다(text-fill-color 폴백 없음)');
  }
  if (!/:focus-visible\{/.test(css)) 흠.push(':focus-visible 이 없다');
  if (!/::selection\{/.test(css)) 흠.push('::selection 이 없다');
  if (!/color-scheme:dark/.test(css)) 흠.push('color-scheme:dark 가 없다');
  if (!/<meta name="theme-color"/.test(css)) 흠.push('theme-color 가 없다');
  return 흠;
}

test('스킨 기본값이 «무채 림»이다 — 유호 픽 3 집행(실측: 스펙트럼은 색상 7갈래·자주보라 64.6%)', () => {
  const 무채 = 도구.스킨();
  const 스펙 = 도구.스킨(undefined, '스펙트럼');
  assert.notStrictEqual(무채, 스펙, '기본값과 스펙트럼이 같은 문자열이면 레시피가 안 갈린 것이다');
  // 스펙트럼 판에만 나오는 킷 색 = KC Hot Pink / Lime / KC Sun 의 rgb 삼각
  const 분홍 = /255,62,136/;
  assert.ok(분홍.test(스펙), '픽스처 확인 — 스펙트럼 판에는 KC Hot Pink 가 있어야 한다(없으면 이 검사가 헛것이다)');
  assert.ok(!분홍.test(무채), '기본값(무채)에 KC Hot Pink 가 새어 들어왔다 — 철칙 ④ 신호 1점 위반');
});

test('낮 지면(인쇄)·초점·선택·색상표가 스킨에 실제로 실린다', () => {
  assert.deepStrictEqual(흠찾기(도구.스킨()), [], '스킨에서 빠진 것이 있다');
});

test('탐지력 픽스처 — 그 한 줄을 지우면 검사기가 빨개진다', () => {
  const css = 도구.스킨();
  const 지우기 = [
    /* ⚠`!important` 로 못박는다 — 이 규칙과 «똑같이 생긴» 것이 reduced-motion 블록에도 있어서
       느슨한 정규는 그쪽을 먼저 지운다. 그러면 인쇄 규칙은 멀쩡한 채 검사기가 초록이 되고,
       픽스처는 「검사기가 무디다」고 거짓 신고를 한다(첫 실행이 정확히 그렇게 났다). */
    ['인쇄 등장 리셋', /html\.js \.듦,html\.js \.듦\.왔다\{opacity:1!important[^}]*\}/, '인쇄에서 등장 숨김을 안 푼다(.듦 opacity 리셋 없음)'],
    ['인쇄 제목 폴백', /-webkit-text-fill-color:var\(--ink\);/, '인쇄 제목이 투명하게 남는다(text-fill-color 폴백 없음)'],
    ['초점', /:focus-visible\{/, ':focus-visible 이 없다'],
    ['선택', /::selection\{/, '::selection 이 없다'],
  ];
  for (const [이름, 정규, 기대] of 지우기) {
    assert.ok(정규.test(css), `픽스처 확인 — 지울 대상(${이름})이 스킨에 있어야 한다`);
    const 병든 = css.replace(정규, '');
    assert.ok(흠찾기(병든).includes(기대), `${이름} 을 지웠는데 검사기가 조용하다 — 이 회귀는 아무것도 안 지킨다`);
  }
});

test('스킨 CSS 에 백틱이 없다 — 하나만 있어도 템플릿이 끊겨 지면이 통째로 사라진다', () => {
  const css = 도구.스킨();
  const 자리 = css.split('\n').map((l, i) => (l.includes('`') ? i + 1 : 0)).filter(Boolean);
  assert.deepStrictEqual(자리, [], `백틱이 든 줄: ${자리.join(', ')} — CSS 주석에는 «…» 를 쓴다`);
});

test('대비 — 밤 9짝 + 낮 7짝 전량이 기준을 넘는다(합계는 분모와 함께 읽는다)', () => {
  const 줄 = 도구.대비판정();
  const 밤 = 줄.filter((r) => !r.지면);
  const 낮 = 줄.filter((r) => r.지면 === '낮');
  assert.ok(밤.length >= 9, `밤 지면 짝이 ${밤.length}개다 — 줄면 «안 잰 면»이 생긴 것이다`);
  assert.ok(낮.length >= 7, `낮 지면 짝이 ${낮.length}개다 — 인쇄 지면을 안 재고 있다`);
  const 미달 = 줄.filter((r) => r.흠 || !r.통과);
  assert.deepStrictEqual(미달.map((r) => `${r.글자} on ${r.면}`), [], '기준 미달 짝이 있다');
});

test('수치 타일의 .n 은 «.수치 안에서만» 잡힌다 — 안 그러면 레일 번호까지 커진다', () => {
  const css = 도구.스킨();
  const 규칙 = [...css.matchAll(/([^\n{};]*\.n)\s*\{/g)].map((m) => m[1].trim());
  assert.ok(규칙.length, '픽스처 확인 — .n 규칙이 하나는 있어야 한다');
  for (const r of 규칙) {
    assert.ok(/\.수치\s+\.n$|\.레일/.test(r), `.n 규칙이 범위 없이 떠 있다: «${r}» — 레일의 <span class="n"> 까지 먹는다`);
  }
});

test('원고 변환 — 지면만 갈고 «글자»는 한 자도 안 바꾼다', (t) => {
  const os = require('node:os'); const fs = require('node:fs');
  const 옛 = `<!doctype html>
<html lang="ko">
<title>시험 문서</title>
<style>  body{color:red;}  </style>
<header>
  <div class="kicker">머리 꼭지</div>
  <h1>시험엔진</h1>
  <p class="one">한 줄 요약이다.</p>
  <div class="meta">메타 줄이다.</div>
</header>

<div class="banner">첫 배너다.</div>
<div class="banner">둘째 배너다.</div>

<nav class="toc">
<b>차례</b> — <a href="#s1">①처음</a> · <a href="#s2">②다음</a>
</nav>

<h2 id="s1">① 처음 절</h2>
<p>본문 한 문장.</p>
<div class="wide"><table><tbody><tr><td>표 칸</td></tr></tbody></table></div>
<h2 id="s2">② 다음 절</h2>
<p class="small muted">작고 흐린 문장.</p>
<div class="cards"><div class="card"><div class="n">3칸</div><div class="l">라벨</div></div></div>
</html>
`;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-원고-'));
  t.after(() => { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 정리 실패는 판정을 안 바꾼다 */ } });
  const 입 = path.join(d, '옛.html'); const 출 = path.join(d, '원고.html');
  fs.writeFileSync(입, 옛, 'utf8');
  const r = 도구.원고(입, 출);

  assert.deepStrictEqual(r.흠, [], '변환에 흠이 났다');
  assert.strictEqual(r.잰것.절, 2);
  assert.strictEqual(r.잰것.차례, 2);
  assert.strictEqual(r.잰것.배너, 2);
  assert.deepStrictEqual(r.잰것.매핑못한클래스, [], '못 옮긴 옛 클래스가 남았다 — 조용히 버려진 자리다');

  const 새 = fs.readFileSync(출, 'utf8');
  /* 글자 대조 — 항해 요소(레일·유리 원판 번호·장식 오브)는 지면이 «더한» 것이라 뺀다. */
  const 민 = (h) => h
    .replace(/<nav class="레일"[\s\S]*?<\/nav>/g, ' ')
    .replace(/<span class="번호">[^<]*<\/span>/g, ' ')
    .replace(/<div class="오브"[^>]*>[\s\S]*?<\/div>/g, ' ')
    .replace(/<summary>차례<\/summary>/g, ' 차례 — ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '').replace(/\s+/g, ' ').trim();
  assert.strictEqual(민(새), 민(옛), '지면을 갈면서 글자가 갈렸다 — 이건 디자인 사고가 아니라 문서 손상이다');

  // 골격이 실제로 바뀌었는지도 본다(글자만 같고 아무것도 안 했으면 그것도 실패다)
  for (const 표시 of ['<div class="판">', 'class="레일"', 'class="표지"', 'class="오브"',
    'class="유리 알림 듦"', 'class="유리 알림 조용 듦"', 'class="유리 표틀 듦"',
    'class="수치들 듦"', 'class="유리 잔잔 수치"', 'class="듦 작게 흐린"', 도구.표식]) {
    assert.ok(새.includes(표시), `원고에 «${표시}» 가 없다 — 변환이 그 자리를 안 옮겼다`);
  }
  assert.ok(!/class="(kicker|one|meta|banner|wide|toc|card|cards|legend|small|muted)"/.test(새),
    '옛 클래스가 남아 있다 — 스킨에 그 자리가 없어서 스타일이 통째로 빠진다');
});

test('낮 지면은 «배경 그래픽 끔»에도 읽힌다 — 이게 낮 지면이 있는 이유다', () => {
  const 흰 = 1; // 흰 종이 상대휘도
  const 비 = (Y) => (Math.max(Y, 흰) + 0.05) / (Math.min(Y, 흰) + 0.05);
  const 색 = Object.fromEntries(
    require(path.join(루트, 'docs', '디자인_토큰.json')).색.킷.map((c) => [c.이름, c.hex]));
  const 휘도 = (hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
    const ch = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  assert.ok(비(휘도(색['Ink'])) >= 4.5, '낮 지면 잉크가 흰 종이에서 안 읽힌다 — 낮 지면의 존재 이유가 무너진다');
  assert.ok(비(휘도(색['Cream'])) < 4.5, '픽스처 확인 — 밤 지면 잉크는 흰 종이에서 못 읽혀야 한다(이게 문제였다)');
});
