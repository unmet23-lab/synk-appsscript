// LAB 영어 E37 「very」 화면 글 정본(영어 판). 한국어 낱말은 구운 펠트 조각에 바느질로 박힌 글(장면과 한 장) + 한국어 목소리,
// 영어는 화면 글, 읽는 법은 조각 아래 작은 글.
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const KO = "'SUIT', 'Inter Tight', sans-serif";
export const TEXT = {
  hook: '“Very” in Korean?',
  ask: 'Just one word… right?',
  more: 'Wait… there’s MORE?!',
  line: 'Korean has a LOT of\nwords for “very.”',
  sayKo: '한국어… 진짜 어려워…',
  saySub: 'Korean is 진짜 hard…',
};
// 조각 그림(public/img/wNN.png — 소리/그림.py가 조각판에서 오림) · 읽는 법(로마자 표기)
export const WORDS: { img: string; ko: string; read: string }[] = [
  { img: 'w01', ko: '아주', read: 'a-ju' },
  { img: 'w02', ko: '정말', read: 'jeong-mal' },
  { img: 'w03', ko: '진짜', read: 'jin-jja' },
  { img: 'w04', ko: '완전', read: 'wan-jeon' },
  { img: 'w05', ko: '매우', read: 'mae-u' },
  { img: 'w06', ko: '너무', read: 'neo-mu' },
  { img: 'w07', ko: '엄청', read: 'eom-cheong' },
  { img: 'w08', ko: '되게', read: 'doe-ge' },
  { img: 'w09', ko: '무척', read: 'mu-cheok' },
  { img: 'w10', ko: '굉장히', read: 'goeng-jang-hi' },
  { img: 'w11', ko: '몹시', read: 'mop-si' },
  { img: 'w12', ko: '대단히', read: 'dae-dan-hi' },
];
