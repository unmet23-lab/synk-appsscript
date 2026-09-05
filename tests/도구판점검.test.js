'use strict';
/* 도구판점검 — 「하네스 판」을 재는 자가 **어느 벌**을 재는지 문다.
 *
 * 🔴 2026-09-05 실측 — 이 자가 터미널 CLI(~/.local/bin) 하나만 재서 「2.1.259 → 2.1.260 · 자동 갱신이 막혔을 수
 *   있다」고 세션마다 울렸는데, 유호님 세션 열 개는 전부 데스크톱 앱이 품은 `%APPDATA%\Claude\claude-code\2.1.260`
 *   으로 돌고 있었다. 자가 다른 벌을 재고 있었고, 처방(`claude update`)을 따라도 세션 판은 안 바뀌었다.
 * 📏 자 = 화면이 두 벌을 «따로» 말하나 · 폴더에서 가장 높은 판을 고르나 · 폴더가 없으면 «못 봤다»(null)인가. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { 데스크톱내장판, 말짓기 } = require(path.join(__dirname, '..', 'tools', '도구판점검.js'));

test('🔑 앱 내장 폴더에서 가장 높은 판을 고른다 — 이름이 판 모양이 아닌 것은 셈에서 뺀다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-desktop-cc-'));
  for (const n of ['2.1.258', '2.1.260', '2.1.9', 'junk', 'latest']) fs.mkdirSync(path.join(방, n));
  assert.strictEqual(데스크톱내장판(방), '2.1.260', '문자열 정렬이면 2.1.9 가 이긴다 — 수로 비교해야 한다');
});

test('폴더가 없으면 null — «안 깔림»이 아니라 «못 봤다»다(0건이 성공 얼굴이 되는 자리)', () => {
  assert.strictEqual(데스크톱내장판(path.join(os.tmpdir(), 'synk-없는-폴더-' + Date.now())), null);
  const 빈방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-desktop-empty-'));
  assert.strictEqual(데스크톱내장판(빈방), null, '판 모양이 하나도 없으면 null 이다');
});

test('🔴 두 벌을 따로 말한다 — CLI 가 뒤지고 앱이 최신이면 «앱은 최신»이라고 그 줄에서 밝힌다', () => {
  const 말 = 말짓기({ 시각: new Date().toISOString(), 하네스: { 깔린: '2.1.259', 앱: '2.1.261', 최신: '2.1.261', 뒤짐: true, 앱뒤짐: false }, 전역: [], 저장소: [] }, true);
  assert.ok(말, '뒤진 벌이 하나라도 있으면 말한다');
  assert.match(말, /터미널 CLI 2\.1\.259 → 2\.1\.261/);
  assert.match(말, /데스크톱 앱 내장 2\.1\.261\(최신/, '유호님 세션이 도는 벌이 최신이라는 것을 같은 줄에서 알아야 헛손질이 없다');
});

test('🔴 앱 내장이 뒤지면 처방이 다르다 — `claude update` 로는 안 올라간다고 말한다', () => {
  const 말 = 말짓기({ 시각: new Date().toISOString(), 하네스: { 깔린: '2.1.261', 앱: '2.1.258', 최신: '2.1.261', 뒤짐: false, 앱뒤짐: true }, 전역: [], 저장소: [] }, true);
  assert.match(말, /데스크톱 앱 내장 2\.1\.258 → 2\.1\.261/);
  assert.match(말, /claude update` 로는 안 올라간다/);
});

test('둘 다 최신이면 하네스 줄은 침묵한다 — 다른 갈래가 없으면 통째로 null', () => {
  const 말 = 말짓기({ 시각: new Date().toISOString(), 하네스: { 깔린: '2.1.261', 앱: '2.1.261', 최신: '2.1.261', 뒤짐: false, 앱뒤짐: false }, 전역: [], 저장소: [] }, true);
  assert.strictEqual(말, null);
});

test('앱 폴더를 못 봤으면(null) 「못 봤다」로 적는다 — 없는 척도 최신인 척도 않는다', () => {
  const 말 = 말짓기({ 시각: new Date().toISOString(), 하네스: { 깔린: '2.1.259', 앱: null, 최신: '2.1.261', 뒤짐: true, 앱뒤짐: false }, 전역: [], 저장소: [] }, true);
  assert.match(말, /데스크톱 앱 내장 판은 못 봤다/);
});
