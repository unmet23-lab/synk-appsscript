'use strict';

// One finished character image per costume. These IDs never describe composable parts.
const COSTUMES = Object.freeze([
  { id: 'mongle-basic', name: '몽글의 기본 차림', character: '몽글', grant: 'starter', requiredActivities: 0, story: '처음 만난 날부터 함께하는 몽글의 차림이에요.' },
  { id: 'marin-basic', name: '마린의 기본 차림', character: '마린', grant: 'starter', requiredActivities: 0, story: '마린과 함께하는 첫 번째 차림이에요.' },
  { id: 'kkamong-basic', name: '까몽의 기본 차림', character: '까몽', grant: 'starter', requiredActivities: 0, story: '까몽과 친구가 된 날 받은 기본 차림이에요.' },
  { id: 'kkamong-scarf', name: '까몽의 포근한 목도리', character: '까몽', grant: 'starter', requiredActivities: 0, story: '첫 옷장을 열면 함께 들어 있는 환영 선물이에요.' },
  { id: 'kkamong-headphones', name: '까몽의 헤드폰', character: '까몽', grant: 'starter', requiredActivities: 0, story: '좋아하는 소리와 함께하라고 준비한 환영 선물이에요.' },
  { id: 'kkamong-apron', name: '까몽의 앞치마', character: '까몽', grant: 'first-activity', requiredActivities: 1, story: '첫 연습에 답을 남긴 날 받은 선물이에요.' },
  { id: 'kkamong-deel-summer', name: '까몽의 여름 델', character: '까몽', grant: 'three-activities', requiredActivities: 3, story: '서로 다른 연습 3개에 답을 남겨 받은 선물이에요.' },
  { id: 'kkamong-deel-winter', name: '까몽의 겨울 델', character: '까몽', grant: 'seven-activities', requiredActivities: 7, story: '서로 다른 연습 7개에 답을 남겨 받은 선물이에요.' },
].map(Object.freeze));

const BACKGROUNDS = Object.freeze([
  { id: 'paper', name: '하얀 종이', color: '#FFFFFF' },
  { id: 'night', name: '밤 액자', color: '#242943' },
  { id: 'lapis', name: '파란 액자', color: '#DDEAF6' },
].map(Object.freeze));

module.exports = { COSTUMES, BACKGROUNDS };
