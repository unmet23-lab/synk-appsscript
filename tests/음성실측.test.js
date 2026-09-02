'use strict';
/* 음성실측(tools/음성실측.js) 회귀 — 2차 검수(08-29 codex P1 넷 · c85b152cc156·d8ecdd22eb14·dfbdcd58be31·4432603abc8a)가
 * 잡은 「측정 불가를 성공으로 접는」 자리와 「출력 폴더 = 저장소 루트」 경계값을 못 박는다(09-02 수리).
 * ⚠ 네트워크 0 · 키 파일 0 — 순수 함수만 부른다(require 만으로는 아무것도 굽지 않는다). */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const 실측 = require(path.join(__dirname, '..', 'tools', '음성실측.js'));
const L16 = { 비트: 16, 레이트: 24000, 채널: 1 };

test('소리측정 — 홀수 바이트 PCM 은 «못 잼»이다(표본 경계가 깨진 응답을 반쪽 표본으로 재지 않는다)', () => {
  const r = 실측.소리측정(Buffer.alloc(5), L16);
  assert.strictEqual(r.잼, false);
  assert.match(r.이유, /홀수/);
});

test('소리측정 — 16비트가 아니면 못 잼 · 16비트면 무음/소리를 가른다', () => {
  assert.strictEqual(실측.소리측정(Buffer.alloc(8), { 비트: 24, 레이트: 24000, 채널: 1 }).잼, false);
  const 무음 = 실측.소리측정(Buffer.alloc(4800), L16);
  assert.strictEqual(무음.잼, true);
  assert.strictEqual(무음.소리있음, false);
  const 소리 = Buffer.alloc(4800);
  for (let i = 0; i < 2400; i++) 소리.writeInt16LE(i % 2 ? 12000 : -12000, i * 2);
  assert.strictEqual(실측.소리측정(소리, L16).소리있음, true);
});

test('저장소안인가 — 루트 그 자체도 «안»이다(startsWith(루트+sep) 만 보면 --출력 <루트> 가 샌다)', () => {
  const 루트 = path.resolve(__dirname, '..');
  assert.strictEqual(실측.저장소안인가(루트, 루트), true, '루트 그 자체를 밖으로 읽는다 — 옛 경계값 구멍');
  assert.strictEqual(실측.저장소안인가(path.join(루트, 'docs'), 루트), true);
  assert.strictEqual(실측.저장소안인가(path.join(루트, '..', 'synk-음성실측'), 루트), false);
  assert.strictEqual(실측.저장소안인가(루트 + '-형제', 루트), false, '이름이 접두로만 겹치는 형제 폴더를 안으로 오인한다');
});

test('종료판정 — 못 잰 것(소리있음 null)만 있어도 2 다(확인 불가는 통과가 아니다)', () => {
  const ok = { ok: true, 소리있음: true };
  assert.strictEqual(실측.종료판정([ok, ok]).코드, 0);
  assert.strictEqual(실측.종료판정([ok, { ok: true, 소리있음: null }]).코드, 2, '못 잼이 종료 0 으로 샌다');
  assert.strictEqual(실측.종료판정([ok, { ok: true, 소리있음: false }]).코드, 2);
  assert.strictEqual(실측.종료판정([{ ok: false }]).코드, 2);
  assert.strictEqual(실측.종료판정([{ ...ok, 역듣기: { ok: false } }]).코드, 2);
  assert.strictEqual(실측.종료판정([ok, { ok: true, 소리있음: null }]).못잼, 1);
});
