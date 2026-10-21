'use strict';
// node --test docs/마케팅/맞춤도구/rl/rules.test.js
// 기대값은 국립국어원 표준 발음법·로마자 표기법의 고시 예시와 표준국어대사전 발음 표기다(탐색노트.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const RL = require('./rules.js');

const kinds = (word) => RL.summary(RL.analyzeWord(word));
const heard = (word) => RL.analyzeWord(word).marks.map((m) => m.heard);

test('영상의 세 문제: 사랑 r · 물 l · 빨리 ll', () => {
  assert.deepEqual(kinds('사랑'), ['tap']);
  assert.deepEqual(kinds('물'), ['l']);
  assert.deepEqual(kinds('빨리'), ['ll']);
});

test('로마자 표기법 붙임 2의 예: 구리 r · 설악 r · 칠곡 l · 임실 l · 울릉 ll', () => {
  assert.deepEqual(kinds('구리'), ['tap']);
  assert.deepEqual(kinds('설악'), ['tap']); // 설악 Seorak — 받침 ㄹ이 모음 앞으로 넘어간다
  assert.deepEqual(kinds('칠곡'), ['l']);
  assert.deepEqual(kinds('임실'), ['l']);
  assert.deepEqual(kinds('울릉'), ['ll']);
});

test('모음 사이·낱말 끝·자음 앞', () => {
  assert.deepEqual(kinds('노래'), ['tap']);
  assert.deepEqual(kinds('이름'), ['tap']);
  assert.deepEqual(kinds('한글'), ['l']);
  assert.deepEqual(kinds('서울'), ['l']);
  assert.deepEqual(kinds('할머니'), ['l']);
  assert.deepEqual(kinds('몰라'), ['ll']);
  assert.deepEqual(kinds('달려'), ['ll']);
});

test('받침 ㄹ이 모음 앞으로 넘어가면 r: 서울에 [서우레] · 물이 [무리] · 알아요', () => {
  assert.deepEqual(kinds('서울에'), ['tap']);
  assert.deepEqual(heard('서울에'), ['우레']);
  assert.deepEqual(kinds('물이'), ['tap']);
  assert.deepEqual(kinds('알아요'), ['tap']);
  assert.deepEqual(kinds('일요일'), ['tap', 'l']); // [이료일]
});

test('제29항 붙임 1: 덧나는 ㄴ은 ㄹ — 서울역 [서울력] · 물약 [물략] · 솔잎 [솔립]', () => {
  assert.deepEqual(kinds('서울역'), ['ll']);
  assert.deepEqual(heard('서울역'), ['울력']);
  assert.deepEqual(kinds('물약'), ['ll']);
  assert.deepEqual(kinds('솔잎'), ['ll']);
  assert.deepEqual(kinds('휘발유'), ['ll']);
});

test('제20항: ㄴ과 ㄹ이 만나면 ㄹㄹ — 신라 [실라] · 난로 [날로] · 설날 [설랄] · 칼날 [칼랄]', () => {
  assert.deepEqual(kinds('신라'), ['ll']);
  assert.deepEqual(heard('신라'), ['실라']);
  assert.deepEqual(kinds('난로'), ['ll']);
  // 설날·칼날은 ㄹ 글자가 둘이다: 앞 ㄹ은 뒤 ㄴ을 ㄹ로 바꿔 ll, 끝 ㄹ은 l
  assert.deepEqual(kinds('설날'), ['ll', 'l']);
  assert.deepEqual(heard('설날'), ['설랄', '날']);
  assert.deepEqual(kinds('칼날'), ['ll', 'l']);
  assert.deepEqual(kinds('대관령'), ['ll']); // [대괄령] Daegwallyeong
});

test('제20항 다만: 의견란 [의견난] · 생산량 [생산냥]', () => {
  assert.deepEqual(kinds('의견란'), ['n']);
  assert.deepEqual(heard('생산량'), ['산냥']);
});

test('제19항: ㅁ·ㅇ 뒤 ㄹ은 ㄴ — 종로 [종노] · 강릉 [강능] · 담력 [담녁] · 대통령', () => {
  assert.deepEqual(kinds('종로'), ['n']);
  assert.deepEqual(heard('종로'), ['종노']);
  assert.deepEqual(kinds('강릉'), ['n']);
  assert.deepEqual(kinds('담력'), ['n']);
  assert.deepEqual(kinds('대통령'), ['n']);
});

test('제19항 붙임: ㄱ·ㅂ 뒤 ㄹ도 ㄴ, 앞 받침은 ㅇ·ㅁ — 백리 [뱅니] · 협력 [혐녁] · 국립 [궁닙]', () => {
  assert.deepEqual(heard('백리'), ['뱅니']);
  assert.deepEqual(heard('협력'), ['혐녁']);
  assert.deepEqual(heard('국립'), ['궁닙']);
  assert.deepEqual(heard('십리'), ['심니']);
});

test('겹받침: 닭 [닥] · 삶 [삼] 은 ㄹ이 안 들리고, 모음 앞에서는 l', () => {
  assert.deepEqual(kinds('닭'), ['silent']);
  assert.deepEqual(kinds('삶'), ['silent']);
  assert.deepEqual(kinds('닭이'), ['l']);
  assert.deepEqual(heard('닭이'), ['달기']);
  assert.deepEqual(kinds('젊어'), ['l']);
  assert.deepEqual(kinds('여덟'), ['l']);
  assert.deepEqual(kinds('넓다'), ['l']);
  assert.deepEqual(kinds('밟다'), ['silent']); // [밥ː따]
  assert.deepEqual(kinds('밟아'), ['l']);      // [발바]
  assert.deepEqual(kinds('읽고'), ['maybe']);  // 동사는 [일꼬], 닭고기는 [닥꼬기]
  assert.deepEqual(kinds('핥다'), ['l']);
  assert.deepEqual(kinds('외곬'), ['l']);
});

test('ㅀ: 앓아 [아라] r · 끓는 [끌른] ll · 앓다 l', () => {
  assert.deepEqual(kinds('앓아'), ['tap']);
  assert.deepEqual(kinds('끓는'), ['ll']);
  assert.deepEqual(kinds('앓다'), ['l']);
});

test('낱말 첫 ㄹ은 start, 띄어 쓴 낱말 사이로는 넘어가지 않는다', () => {
  assert.deepEqual(kinds('라면'), ['start']);
  const words = RL.analyze('빨리 빨리! 사랑해요');
  assert.equal(words.length, 3);
  assert.deepEqual(words.map((w) => w.word), ['빨리', '빨리', '사랑해요']);
  assert.deepEqual(words.map((w) => RL.summary(w)), [['ll'], ['ll'], ['tap']]);
});

test('한글이 아닌 글자는 건너뛰고, ㄹ이 없으면 표시도 없다', () => {
  assert.deepEqual(RL.analyze('BTS 아미'), [{ word: '아미', marks: [], start: 4 }]);
  assert.deepEqual(RL.analyze(''), []);
});

test('검수 보완: 덧나는 ㄹ(숫자·흔한 합성어), ㄿ, ㄾ+ㄴ, 넓적, 낱말 끝 대표음', () => {
  assert.deepEqual(kinds('열여섯'), ['ll']);          // [열려섣]
  assert.deepEqual(kinds('스물여섯'), ['ll']);        // 제29항 [붙임 2] [스물려섣]
  assert.deepEqual(heard('볼일')[0], '볼릴');
  assert.deepEqual(kinds('불이익'), ['ll']);          // [불리익]
  assert.deepEqual(kinds('읊다'), ['silent']);        // 제11항 [읍따]
  assert.deepEqual(kinds('읊어'), ['l']);             // 제14항 [을퍼]
  assert.deepEqual(heard('핥는'), ['할른']);          // 제20항 [붙임]
  assert.deepEqual(kinds('넓적'), ['silent']);        // [넙쩍]
  assert.deepEqual(heard('물엿'), ['물렫']);          // 제29항 [붙임 1] [물렫]
  assert.deepEqual(heard('솔잎'), ['솔립']);
});
