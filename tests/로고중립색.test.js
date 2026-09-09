'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const logo=require('../tools/lib/로고정본');
test('대외 민판은 라이트 Ink 네 글자, 다크 Paper 네 글자',()=>{
 for(const [판,색] of [['라이트',logo.색.Ink],['다크',logo.색.Paper]]){
  const s=logo.워드마크({판,표현:'민'});assert.ok(s.includes(`d="${logo.SYN}" fill="${색}"`));assert.ok(s.includes(`d="${logo.K}" fill="${색}"`));assert.ok(!s.includes(logo.색.Coral));
 }
});
test('대외 펠트 몸체는 같은 재질 램프를 사용한다',()=>{
 const s=logo.워드마크안쪽({판:'라이트'});assert.ok(s.includes('#sl-k'));assert.ok(s.includes('#sl-felt-ink'));assert.ok(!s.includes('#sl-felt-coral'));
 const p=logo.워드마크안쪽();assert.ok(p.includes('#sl-felt-paper'));assert.ok(!p.includes('#sl-felt-coral'));
});
test('내부 꺾쇠 코랄과 명시적 역사판은 보존한다',()=>{
 const internal=logo.워드마크({신호:'꺾쇠',표현:'민'});assert.ok(internal.includes(`d="${logo.CHEV}" fill="${logo.색.Coral}"`));
 const archive=logo.워드마크({신호:'k',색갈래:'코랄',표현:'민'});assert.ok(archive.includes(`d="${logo.K}" fill="${logo.색.Coral}"`));
});
