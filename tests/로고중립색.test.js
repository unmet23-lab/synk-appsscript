'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const logo=require('../tools/lib/로고정본');
test('대외 민판은 라이트 Ink 네 글자, 다크 Paper 네 글자',()=>{
 for(const [판,색] of [['라이트',logo.색.Ink],['다크',logo.색.Paper]]){
  const s=logo.워드마크({판,표현:'민'});assert.ok(s.includes(`d="${logo.SYN}" fill="${색}"`));assert.ok(s.includes(`d="${logo.K}" fill="${색}"`));assert.ok(!s.includes(logo.색.Coral));
 }
});
test('대외 펠트는 같은 재질 램프와 두께를 유지하고 네 글자의 실땀만 뺀다',()=>{
 const s=logo.워드마크안쪽({판:'라이트'});assert.ok(s.includes('#sl-k'));assert.ok(s.includes('#sl-felt-ink'));assert.ok(!s.includes('#sl-felt-coral'));
 const p=logo.워드마크안쪽();assert.ok(p.includes('#sl-felt-paper'));assert.ok(!p.includes('#sl-felt-coral'));
 for(const 판 of ['라이트','다크'])for(const 색갈래 of [undefined,'단색','코랄','버터','메도우','팝']){
  const s=logo.워드마크안쪽({판,색갈래});
  assert.ok(!s.includes('stroke-dasharray'), `${판}/${색갈래}: 대외 실땀 제거`);
  for(const 참조 of ['#sl-syn','#sl-k']){
   assert.ok(s.includes(`href="${참조}" fill="${logo.색['Ink Deep']}" opacity="0.5" transform="translate(0.8,1.6)" filter="url(#sl-contact)"`));
   assert.ok(s.includes(`href="${참조}"`) && s.includes('filter="url(#sl-fuzz2)"'));
  }
  assert.ok(s.includes('transform="translate(0.4,2.0)"'));
  assert.ok(!logo.워드마크({판,색갈래,슬래시:true}).includes('stroke-dasharray'));
 }
});
test('내부 꺾쇠 코랄과 명시적 역사판은 보존한다',()=>{
 const internal=logo.워드마크({신호:'꺾쇠',표현:'민'});assert.ok(internal.includes(`d="${logo.CHEV}" fill="${logo.색.Coral}"`));
 const archive=logo.워드마크({신호:'k',색갈래:'코랄',표현:'민'});assert.ok(archive.includes(`d="${logo.K}" fill="${logo.색.Coral}"`));
});
test('내부 꺾쇠와 단독 기호·도장·알록 특별판은 기존 실땀을 유지한다',()=>{
 for(const 판 of ['라이트','다크']){
  assert.ok(logo.워드마크안쪽({판,신호:'꺾쇠'}).includes('stroke-dasharray'));
  assert.ok(logo.워드마크안쪽({판,신호:'꺾쇠',색갈래:'단색'}).includes('stroke-dasharray'));
  assert.ok(logo.워드마크안쪽({판,색갈래:'알록'}).includes('stroke-dasharray'));
 }
 assert.ok(logo.기호({px:44}).includes('stroke-dasharray'));
 assert.ok(!logo.기호({px:20}).includes('stroke-dasharray'));
 assert.ok(logo.도장().includes('stroke-dasharray'));
 assert.ok(logo.알록대안().includes('stroke-dasharray'));
});
