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
  /* ⚠**인쇄 블록은 하나가 아니다**(2026-08-16 배선 뒤) — Loom 낮 지면이 한 벌, 지면 골격이 한 벌.
     첫 판은 `match` 로 «맨 앞 하나»만 봐서, 골격 블록에 멀쩡히 살아 있는 규칙 둘을 「없다」고 했다.
     한 곳만 보는 검사기는 층이 늘어난 날 **거짓 빨강**을 내고, 거짓 빨강은 검사기를 끄게 만든다.
     그래서 전량을 이어 붙여 본다 — 어느 블록이 지든 「인쇄된 종이가 이러한가」가 물음이다. */
  const 인쇄들 = [...css.matchAll(/@media print\{([\s\S]*?)\n  \}/g)];
  if (!인쇄들.length) 흠.push('@media print 블록이 없다');
  else {
    const p = 인쇄들.map((m) => m[1]).join('\n');
    if (!/\.듦[^{]*\{[^}]*opacity:1!important/.test(p)) 흠.push('인쇄에서 등장 숨김을 안 푼다(.듦 opacity 리셋 없음)');
    /* ⚠`body{` 에 못박는다 — 인쇄 블록에는 `html{background:var(--paper)}` 도 따로 있어서
       느슨하게 찾으면 **body 를 다시 검게 바꿔도 초록**이다(변이 검사가 실제로 그 구멍을 냈다).
       지면의 바닥을 정하는 것은 body 다. */
    if (!/body\{[^}]*background:var\(--paper\)/.test(p)) 흠.push('인쇄 바탕이 종이가 아니다');
    if (!/body\{[^}]*color:var\(--ink\)/.test(p)) 흠.push('인쇄 잉크가 Ink 가 아니다');
    if (/body\{[^}]*color:var\(--cream\)/.test(p)) 흠.push('인쇄 잉크가 Cream 이다 — 배경을 끄면 1.13:1 로 사라진다');
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

/* ══════════════════════════════════════════════════════════════════════════
   원고가 정본인가 — 전량 굽기의 게이트 (2026-08-16 · 실사고에서 왔다)

   무엇을 밟았나: `docs/엔진/Loom_소개서.html` 이 자기 원고보다 **5,869자 앞서 있었다**.
   누군가 산출물을 손으로 고쳤고, 원고는 v1.0 인 채였다. 그 상태로 `--전량` 을 돌리면
   그 수정이 **exit 0 으로** 사라진다 — 화면도, 테스트도, git 도 아무도 안 운다
   (다시 구운 지면은 «멀쩡한 문서»로 보인다 · 새는 방향은 언제나 「통과」다).

   ⚠탐지력은 픽스처가 진다(가드 맹점 ②) — 실저장소가 병들어 있기를 요구하지 않는다.
     실저장소 쪽은 «갈라짐 0»이라는 거짓양성만 본다.
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('node:fs');
const os = require('node:os');

/** 픽스처 — 원고 한 벌을 구워 놓고, 산출물만 손으로 고친 상태를 만든다. */
function 픽스처방() {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-원고픽스처-'));
  const 원고방 = path.join(방, '_원고');
  fs.mkdirSync(원고방, { recursive: true });
  const 씨 = fs.readFileSync(path.join(루트, 'docs', '엔진', '_원고', 'Trail_소개서.html'), 'utf8');
  fs.writeFileSync(path.join(원고방, '갑.html'), 씨, 'utf8');
  fs.writeFileSync(path.join(원고방, '을.html'), 씨, 'utf8');
  도구.굽기(path.join(원고방, '갑.html'), path.join(방, '갑.html'));
  도구.굽기(path.join(원고방, '을.html'), path.join(방, '을.html'));
  return { 방, 원고방, 상대: { 원고: path.relative(루트, 원고방), 산출: path.relative(루트, 방) } };
}

test('탐지력 — 산출물만 손으로 고치면 「갈라짐」으로 잡는다(픽스처)', () => {
  const { 방, 상대 } = 픽스처방();
  const 임시 = path.join(os.tmpdir(), 'synk-재현대조-시험');

  const 처음 = 도구.재현대조(임시, 상대);
  assert.strictEqual(처음.length, 2, '픽스처 분모가 2가 아니다 — 0/0 은 초록이 아니라 «안 쟀다»다');
  assert.ok(처음.every((r) => r.상태 === '재현'), '갓 구운 짝이 재현 안 된다: '
    + JSON.stringify(처음.map((r) => [r.이름, r.상태])));

  // 산출물 «을» 만 손으로 고친다 — 원고는 그대로다.
  const 을 = path.join(방, '을.html');
  fs.writeFileSync(을, fs.readFileSync(을, 'utf8')
    .replace('</div><!-- /글 -->', '<p class="듦">손으로 더한 문단 — 원고에는 없다</p>\n</div><!-- /글 -->'), 'utf8');

  const 뒤 = 도구.재현대조(임시, 상대);
  const 갈 = 뒤.filter((r) => r.상태 === '갈라짐');
  assert.strictEqual(갈.length, 1, '손 수정을 못 잡았다 — 전량 굽기가 그것을 조용히 삼킨다');
  assert.strictEqual(갈[0].이름, '을.html', '엉뚱한 지면을 갈라짐이라 했다');
});

test('자기 처방 — 「갈라짐」이 시키는 되메우기가 실제로 통과시킨다', () => {
  const { 방, 원고방, 상대 } = 픽스처방();
  const 임시 = path.join(os.tmpdir(), 'synk-재현대조-처방');
  const 을 = path.join(방, '을.html');
  fs.writeFileSync(을, fs.readFileSync(을, 'utf8')
    .replace('</div><!-- /글 -->', '<p class="듦">손으로 더한 문단</p>\n</div><!-- /글 -->'), 'utf8');
  assert.strictEqual(도구.재현대조(임시, 상대).filter((r) => r.상태 === '갈라짐').length, 1);

  // 가드가 내는 그 명령 그대로 — 통하지 않으면 그 처방은 우회를 정상 통로로 만든다(F103).
  도구.되메우기(을, path.join(원고방, '을.html'));
  const 뒤 = 도구.재현대조(임시, 상대);
  assert.ok(뒤.every((r) => r.상태 === '재현'), '되메운 뒤에도 갈라짐이 남았다: '
    + JSON.stringify(뒤.map((r) => [r.이름, r.상태])));
  assert.ok(fs.readFileSync(path.join(원고방, '을.html'), 'utf8').includes('손으로 더한 문단'),
    '되메운 원고에 손 수정이 안 실렸다 — 되돌린 것이 아니라 버린 것이다');
});

test('되메우기는 반쪽만 뜯으면 «쓰지 않고» 던진다', () => {
  const { 방, 원고방 } = 픽스처방();
  const 갑 = path.join(방, '갑.html');
  const 원고갑 = path.join(원고방, '갑.html');
  const 전 = fs.readFileSync(원고갑, 'utf8');
  // 굽기 산출물이 아닌 파일 — 뜯을 스킨이 없다.
  assert.throws(() => 도구.되메우기(원고갑, path.join(방, '버릴.html')), /굽기 산출물이 아니다/);
  도구.되메우기(갑, 원고갑);
  assert.notStrictEqual(fs.readFileSync(원고갑, 'utf8').length, 0);
  assert.ok(전.includes(도구.표식) && fs.readFileSync(원고갑, 'utf8').includes(도구.표식),
    '되메운 원고에 표식이 없다 — 다시 못 굽는다');
});

/* 🔑 왕복 시험이 진짜로 막는가 — «반쪽 뜯기»를 실제로 만들어 본다.
   굽기가 넣은 script 바로 뒤에 «굽기가 안 넣은» script 를 한 벌 붙이면, 되메우기의
   「연달아 먹기」가 그것까지 삼킨다. 그러면 되메운 원고를 다시 구워도 그 script 가 안 돌아와
   몸통이 어긋난다 — 이때 원고를 쓰면 그 한 벌이 영원히 사라진다(파일은 멀쩡해 보인다). */
test('되메우기 — 왕복이 어긋나면 원고를 «건드리지 않고» 던진다', () => {
  const { 방, 원고방 } = 픽스처방();
  const 을 = path.join(방, '을.html');
  const 원고을 = path.join(원고방, '을.html');
  const 원고전 = fs.readFileSync(원고을, 'utf8');

  /* ⚠줄끝을 가정하지 않는다 — 이 저장소의 작업본은 사실상 전부 CRLF 라(F477),
     `\n` 을 박은 치환은 조용히 «원본 그대로»를 돌려주고 픽스처가 헛것이 된다.
     그래서 마지막 </script> 뒤에 끼워 넣는 것으로 자리를 잡는다(줄끝 무관). */
  const 원본을 = fs.readFileSync(을, 'utf8');
  const 끝 = 원본을.lastIndexOf('</script>') + '</script>'.length;
  assert.ok(끝 > 10, '픽스처 확인 — 굽기 산출물에 script 가 없다');
  fs.writeFileSync(을, 원본을.slice(0, 끝) + '<script>/*굽기가 안 넣은 것*/</script>' + 원본을.slice(끝), 'utf8');
  assert.ok(fs.readFileSync(을, 'utf8').includes('굽기가 안 넣은 것'), '픽스처 확인 — 덧붙인 script 가 안 들어갔다');

  assert.throws(() => 도구.되메우기(을, 원고을), /왕복이 안 맞는다/,
    '반쪽 뜯기가 통과했다 — 이 원고는 다시 구우면 한 벌이 사라진다');
  assert.strictEqual(fs.readFileSync(원고을, 'utf8'), 원고전,
    '던지면서 원고를 이미 덮었다 — 「쓰지 않고 던진다」가 거짓이다');
});

test('전량 굽기 — 갈라진 지면이 있으면 «한 벌도» 굽지 않고 던진다', () => {
  const { 방, 상대 } = 픽스처방();
  const 을 = path.join(방, '을.html');
  const 갑 = path.join(방, '갑.html');
  fs.writeFileSync(을, fs.readFileSync(을, 'utf8')
    .replace('</div><!-- /글 -->', '<p class="듦">손으로 더한 문단</p>\n</div><!-- /글 -->'), 'utf8');
  const 갑전 = fs.readFileSync(갑, 'utf8');
  const 을전 = fs.readFileSync(을, 'utf8');

  assert.throws(() => 도구.전량({ 방: 상대, 임시방: path.join(os.tmpdir(), 'synk-전량-시험') }),
    /원고가 낡은 지면/, '갈라진 채로 구웠다 — 손 수정이 exit 0 으로 사라지는 자리다');
  assert.strictEqual(fs.readFileSync(갑, 'utf8'), 갑전, '멀쩡한 지면까지 구웠다 — 게이트가 반만 섰다');
  assert.strictEqual(fs.readFileSync(을, 'utf8'), 을전, '갈라진 지면을 덮었다 — 손 수정이 사라졌다');
});

test('실저장소 — 「Loom 을 입는 지면」 전량이 원고에서 재현된다(0 은 분모와 함께)', () => {
  const 짝 = 도구.지면짝들();
  assert.ok(짝.length >= 6, `지면 분모가 ${짝.length} 이다 — 0/0 초록은 「안 쟀다」와 같은 모양이다`);
  const 줄 = 도구.재현대조(path.join(os.tmpdir(), 'synk-재현대조-실'));
  const 갈 = 줄.filter((r) => r.상태 === '갈라짐');
  const 못잼 = 줄.filter((r) => !['재현', '갈라짐'].includes(r.상태));
  assert.strictEqual(갈.length, 0,
    '원고보다 앞선 산출물 ' + 갈.length + '벌 — `node tools/펠트문서.js --재현` 이 되메우기 명령을 낸다: '
    + 갈.map((r) => r.이름).join(', '));
  assert.strictEqual(못잼.length, 0, '못 잰 지면: ' + 못잼.map((r) => r.이름 + '(' + r.상태 + ')').join(', '));
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
  assert.ok(비(휘도(색['Chalk'])) < 4.5, '픽스처 확인 — 밤 지면 잉크는 흰 종이에서 못 읽혀야 한다(이게 문제였다)');
});
