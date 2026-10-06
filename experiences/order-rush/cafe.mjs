// 주문 폭주 — 카페 화면에 쓰는 것: 손님(입장 검사의 펠트 동물), 컵 이름, 컵에 담긴 음료 색.
// 주문·판정·점수는 core.mjs, 학습 기록은 learning.mjs가 맡는다. 여기 있는 것은 화면 표현뿐이다.

/** 펠트 동물 손님(assets/cast/<키>.webp, 얼굴 동그라미는 assets/cast/face/<키>.webp). */
export const ANIMALS = Object.freeze({
  bear: '곰', deer: '사슴', ducks: '오리 둘', fox: '여우', hedgehog: '고슴도치', otter: '수달',
  panda: '판다', penguin: '펭귄', rabbit: '토끼', raccoon: '너구리', sheep: '양', squirrel: '다람쥐',
});

// 주문마다 정해 둔 손님(같은 주문은 늘 같은 손님). 본 주문 12개는 모두 다른 손님이라 줄에 같은 얼굴이 겹치지 않는다.
// 두 잔을 시키는 o08은 오리 둘, 새 주문 연습은 비슷한 주문을 했던 손님이 다시 온다(r01 사슴은 o04 아이스라테 손님).
const CUSTOMER = Object.freeze({
  o01: 'bear', o02: 'fox', o03: 'rabbit', o04: 'deer', o05: 'otter', o06: 'raccoon',
  o07: 'sheep', o08: 'ducks', o09: 'hedgehog', o10: 'panda', o11: 'penguin', o12: 'squirrel',
  r01: 'deer', r02: 'ducks', r03: 'panda',
});
export const customerOf = (orderId) => CUSTOMER[orderId] || 'bear';
export const customerName = (orderId) => `${ANIMALS[customerOf(orderId)]} 손님`;

/** 컵에 담긴 음료(색을 고를 때 쓴다). 음료가 없으면 null. */
export function liquidOf(cup) {
  if (cup.base === 'coffee') return cup.milk ? 'latte' : 'coffee';
  if (cup.base === 'tea') return cup.milk ? 'milktea' : 'tea';
  return cup.milk ? 'milk' : null;
}

const DRINK = { coffee: '커피', latte: '라테', tea: '차', milktea: '밀크티', milk: '우유' };

/** 컵 한 줄 이름: ‘따뜻한 커피 · 설탕’, ‘차가운 라테 · 얼음’, ‘빈 컵’. 넣은 것만 적는다(판정 문구는 core.mjs describeCup). */
export function cupLabel(cup) {
  const extras = [cup.ice && '얼음', cup.sugar && '설탕'].filter(Boolean);
  const drink = liquidOf(cup);
  if (!drink) {
    if (cup.temp === 'cold' && !cup.ice) extras.push('차갑게');
    return ['빈 컵', ...extras].join(' · ');
  }
  return [`${cup.temp === 'cold' ? '차가운' : '따뜻한'} ${DRINK[drink]}`, ...extras].join(' · ');
}
