/**
 * 발표물 색 회귀 — `docs/발표물/` 전량(배포물 6종 + 로고 정본)은 브랜드 키트 19색만 쓴다.
 *
 * 왜 따로 다나: 08-04 에 로고 정본은 제목이 「브랜드 키트 적용」인데 실제 칠은 개편 전
 * 인디고·골드 팔레트였다. 로고는 **다른 문서들이 복사해 가는 원천**이라, 여기가 낡으면
 * 낡은 색이 복사로 번진다. `tests/브랜드색.test.js` 의 화이트리스트 방식은 Glide 앱색
 * 때문에 엔진엔 못 쓰지만(그쪽은 금지 목록+동결), 발표물 폴더는 키트만 허용이라 여기서
 * 화이트리스트로 잠근다. 08-04 배포물 6종 이관 종결과 함께 후보시트 전용 → 폴더 전량으로 확장.
 *
 * ⚠ 문자열로 hex 만 찾으면 `rgba(253,252,248,…)` 를 놓친다. 실제로 그렇게 한 건이 남았었다.
 *   그래서 hex 와 rgb() 를 **둘 다** 본다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'docs', '발표물');
const SHEET = path.join(DIR, '로고', '후보시트.html');
const LOGO_TOOL = path.join(__dirname, '..', 'tools', '로고주입.js');

/** 발표물 HTML 전량(하위 로고/ 포함). 스캔이 조용히 0건이 되면 가드가 죽으므로 개수도 검사한다. */
function allHtml() {
  const out = [];
  for (const sub of ['', '로고']) {
    const d = path.join(DIR, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.html')) out.push(path.join(d, f));
  }
  return out;
}

/**
 * 킷 전량. 여기 없는 색은 이 문서에 못 들어온다.
 * 🔴 **손 목록을 안 든다**(2026-08-16 · F520): 초판은 「v10 Crew Dossier 19색」을 hex 로 박아 뒀는데,
 *   그 뒤 킷이 **23색**(19 + Slate 2 + Lime Family 2)이 되도록 이 목록만 안 따라왔다.
 *   그래서 정본이 정식으로 들인 `Slate #8A93AD`·`Slate 2 #5F657D`(DESIGN.md §킷 「보조 잉크 2」)를
 *   이 가드가 **「키트 밖 색」이라고 불렀다** — 새는 방향이 「적색」이라 안 보이다가, 그 색을 쓰는
 *   지면이 처음 들어오는 날 남의 트랙을 막는다. 같은 판정을 두 곳에 적으면 갈라진다(CLAUDE.md 맹점 ④).
 *   ⇒ **기계 원천에서 파생한다.** 토큰 파일 자신이 같은 교훈을 이미 적어 뒀다(`색._킷주`:
 *   「이름에 개수를 박지 않는다 — 개수는 배열이 안다」).
 */
function expand(h) {
  const s = h.replace('#', '');
  return '#' + (s.length === 3 ? [...s].map((c) => c + c).join('') : s).toUpperCase();
}

const 토큰 = require(path.join(__dirname, '..', 'docs', '디자인_토큰.json'));
const KIT = new Set(토큰['색']['킷'].map((c) => expand(c['hex'])));
/** 종이·먹 자체는 색이 아니다. */
const NEUTRAL = new Set(['#FFFFFF', '#000000']);

function colorsIn(src) {
  const found = new Set();
  for (const m of src.matchAll(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g)) found.add(expand(m[0]));
  for (const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    found.add('#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase());
  }
  return found;
}

test('발표물 전량이 키트 밖 색을 쓰지 않는다 (hex·rgb 둘 다)', () => {
  const files = allHtml();
  assert.ok(files.length >= 7, `발표물 HTML 이 ${files.length}건뿐 — 배포물 6종+로고 정본이 있어야 한다(경로가 바뀌면 스캔이 조용히 죽는다)`);
  for (const p of files) {
    const outside = [...colorsIn(fs.readFileSync(p, 'utf8'))].filter((c) => !KIT.has(c) && !NEUTRAL.has(c));
    assert.deepStrictEqual(outside, [], `${path.basename(p)} 키트 밖 색: ${outside.join(', ')}`);
  }
});

test('발표물 전량에 금지된 색이 없다 — Lime=앱 전용 · KC 4색=Part 6 전용', () => {
  for (const p of allHtml()) {
    const used = colorsIn(fs.readFileSync(p, 'utf8'));
    for (const [hex, why] of [
      ['#C8FF3D', 'Lime 은 앱 성장·획득 전용'],
      ['#FF3E88', 'KC 는 Part 6 전용'], ['#FF6BA8', 'KC 는 Part 6 전용'],
      ['#FFD447', 'KC Sun 은 Part 6·모드C 전용'], ['#4E7CFF', 'KC Cool 은 Part 6 전용'],
    ]) assert.ok(!used.has(hex), `${path.basename(p)}: ${hex} — ${why}`);
  }
});

test('구 팔레트가 되돌아오지 않았다', () => {
  for (const p of allHtml()) {
    const used = colorsIn(fs.readFileSync(p, 'utf8'));
    for (const hex of ['#FF6D00', '#3D5AFE', '#FFC400', '#1A237E', '#FDFCF8', '#0B1A2E'])
      assert.ok(!used.has(hex), `${path.basename(p)}: 구 팔레트 ${hex} 부활`);
  }
});

test('로고 주입기의 주입 정본이 키트 색이다 — 여기가 낡으면 주입 한 번에 전 파일로 번진다', () => {
  // 08-04 실측: 후보시트·브랜드킷은 이관됐는데 tools/로고주입.js 의 W5_DARK 가 구 색
  // (#FDFCF8·#FF6D00)인 채 남아 있었다 — 6파일을 고쳐도 주입 한 번이면 되살아나는 회귀 통로.
  const src = fs.readFileSync(LOGO_TOOL, 'utf8');
  const outside = [...colorsIn(src)].filter((c) => !KIT.has(c) && !NEUTRAL.has(c));
  assert.deepStrictEqual(outside, [], `로고주입.js 키트 밖 색: ${outside.join(', ')}`);
  assert.ok(src.includes('#E4E4E7') && src.includes('#FF6B5C'),
    'W5 주입 정본에 Chalk(#E4E4E7)·Coral(#FF6B5C)이 없다 — 브랜드킷 §3 v2.0 도형 정본과 어긋난다');
});

test('코랄 면 위 글자는 Ink 다 — 흰 글자는 2.8 로 미달한다', () => {
  const src = fs.readFileSync(SHEET, 'utf8');
  const rec = src.match(/\.id\.rec\{[^}]*\}/);
  assert.ok(rec, '.id.rec 규칙이 사라졌다');
  assert.ok(/background:var\(--coral\)/.test(rec[0]), '.id.rec 배경이 코랄이 아니다');
  assert.ok(/color:#1B1B1A/i.test(rec[0]), `.id.rec 글자가 Ink 가 아니다 — ${rec[0]}`);
});

test('「//」는 세 번째 색이 아니라 잉크의 저채도다', () => {
  const src = fs.readFileSync(SHEET, 'utf8');
  const slashes = [...src.matchAll(/<use href="#slash"[^>]*>/g)].map((m) => m[0]);
  assert.ok(slashes.length >= 3, `슬래시 사용처가 ${slashes.length}건뿐이다`);
  for (const s of slashes) {
    // W2 는 「남색 위 남색은 묻힌다」를 보여주는 반례라 불투명이 정상이다.
    if (/#2A3358"\/>/.test(s)) continue;
    assert.ok(/opacity="\.\d+"/.test(s), `저채도가 아니다 — ${s}`);
  }
});

/* ⚠ 대상은 **SVG·CSS** 다 — `코드만()`(JS 렉서)으로 감싸지 않는다(갈래 ⓒ 비JS · 대기열 #Q72). */
test('변수 이름과 값이 어긋나지 않는다 — var(--gold) 가 크림을 뱉으면 안 된다', () => {
  const src = fs.readFileSync(SHEET, 'utf8');
  for (const dead of ['--gold', '--orange', '--blue', '--midnight'])
    assert.ok(!src.includes(`var(${dead})`), `낡은 변수 참조 ${dead}`);
});
