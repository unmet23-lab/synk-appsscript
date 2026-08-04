/**
 * 로고 정본 색 회귀 — `docs/발표물/로고/후보시트.html` 은 브랜드 키트 19색만 쓴다.
 *
 * 왜 따로 다나: 08-04 에 이 파일은 제목이 「브랜드 키트 적용」인데 실제 칠은 개편 전
 * 인디고·골드 팔레트였다. 로고는 **다른 문서들이 복사해 가는 원천**이라, 여기가 낡으면
 * 낡은 색이 복사로 번진다. `tests/브랜드색.test.js` 의 스캔 범위는 `docs/tools` 와
 * `contents_*.js` 뿐이라 발표물 폴더는 애초에 가드 밖이었다 — 그래서 62 초록인데도 살았다.
 *
 * ⚠ 문자열로 hex 만 찾으면 `rgba(253,252,248,…)` 를 놓친다. 실제로 그렇게 한 건이 남았었다.
 *   그래서 hex 와 rgb() 를 **둘 다** 본다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SHEET = path.join(__dirname, '..', 'docs', '발표물', '로고', '후보시트.html');

/** v10 Crew Dossier 19색. 여기 없는 색은 이 문서에 못 들어온다. */
const KIT = new Set([
  '#F6F1E8', '#FF6B5C', '#1A2340', '#C8FF3D', '#171820',
  '#FBF7EE', '#EFE7D7', '#E7DDC7',
  '#FFE9E4', '#FFCFC6', '#FF8877', '#E8543F',
  '#2A3358', '#131A32', '#0F1730',
  '#FF3E88', '#FF6BA8', '#FFD447', '#4E7CFF',
]);
/** 종이·먹 자체는 색이 아니다. */
const NEUTRAL = new Set(['#FFFFFF', '#000000']);

function expand(h) {
  const s = h.replace('#', '');
  return '#' + (s.length === 3 ? [...s].map((c) => c + c).join('') : s).toUpperCase();
}

function colorsIn(src) {
  const found = new Set();
  for (const m of src.matchAll(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g)) found.add(expand(m[0]));
  for (const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    found.add('#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase());
  }
  return found;
}

test('로고 정본이 키트 밖 색을 쓰지 않는다 (hex·rgb 둘 다)', () => {
  const src = fs.readFileSync(SHEET, 'utf8');
  const outside = [...colorsIn(src)].filter((c) => !KIT.has(c) && !NEUTRAL.has(c));
  assert.deepStrictEqual(outside, [], `키트 밖 색: ${outside.join(', ')}`);
});

test('이 문서에 금지된 색이 없다 — Lime=앱 전용 · KC 4색=Part 6 전용', () => {
  const used = colorsIn(fs.readFileSync(SHEET, 'utf8'));
  for (const [hex, why] of [
    ['#C8FF3D', 'Lime 은 앱 성장·획득 전용'],
    ['#FF3E88', 'KC 는 Part 6 전용'], ['#FF6BA8', 'KC 는 Part 6 전용'],
    ['#FFD447', 'KC Sun 은 Part 6·모드C 전용'], ['#4E7CFF', 'KC Cool 은 Part 6 전용'],
  ]) assert.ok(!used.has(hex), `${hex} — ${why}`);
});

test('구 팔레트가 되돌아오지 않았다', () => {
  const used = colorsIn(fs.readFileSync(SHEET, 'utf8'));
  for (const hex of ['#FF6D00', '#3D5AFE', '#FFC400', '#1A237E', '#FDFCF8', '#0B1A2E'])
    assert.ok(!used.has(hex), `구 팔레트 ${hex} 부활`);
});

test('코랄 면 위 글자는 Ink 다 — 흰 글자는 2.8 로 미달한다', () => {
  const src = fs.readFileSync(SHEET, 'utf8');
  const rec = src.match(/\.id\.rec\{[^}]*\}/);
  assert.ok(rec, '.id.rec 규칙이 사라졌다');
  assert.ok(/background:var\(--coral\)/.test(rec[0]), '.id.rec 배경이 코랄이 아니다');
  assert.ok(/color:#171820/i.test(rec[0]), `.id.rec 글자가 Ink 가 아니다 — ${rec[0]}`);
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

test('변수 이름과 값이 어긋나지 않는다 — var(--gold) 가 크림을 뱉으면 안 된다', () => {
  const src = fs.readFileSync(SHEET, 'utf8');
  for (const dead of ['--gold', '--orange', '--blue', '--midnight'])
    assert.ok(!src.includes(`var(${dead})`), `낡은 변수 참조 ${dead}`);
});
