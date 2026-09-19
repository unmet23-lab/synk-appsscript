'use strict';
/**
 * 라디오 제목·소개·검색어의 실행 원본.
 * 방송 생성 도구와 서버의 방송지킴이가 함께 읽는다.
 * 2026-09-19: 감상 중심으로 전면 개정. 제작 홍보와 무중단 보장 문구를 걷었다.
 */
const 방송제목 = 'SYNK Radio | 음악은 켜 두고 · lofi & chill';
const 방송소개 = [
  '일할 때도, 쉴 때도 가볍게 틀어두는 음악.',
  '몽글·까몽·마린과 보름달 뜬 마당에서 잠시 쉬어가요.',
  '',
  'Lo-fi and mellow grooves for work, rest, and quiet nights.',
  '',
  'SYNK PULSE',
  'https://synk.im/',
].join('\n');
// 기존 YouTube 분류는 문구 개정과 별개로 유지한다.
const 분류 = '27';
const 꼬리표 = [
  'SYNK Radio', 'SYNK PULSE', 'lofi', 'lofi radio', 'lofi hip hop', 'k-lofi',
  'chill beats', 'mellow music', 'cafe music', 'relaxing music', 'work music',
  'study music', 'night music', '로파이', '카페 음악', '편하게 듣는 음악',
];
module.exports = { 방송제목, 방송소개, 분류, 꼬리표 };
