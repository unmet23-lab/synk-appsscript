// 시간표(초). 소리 없는 화면 글 편이라 한 줄을 2초 넘게 보이게 둔다(몽골 조사 「자막 2초 이상」).
import { Msg } from './data';

export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  cards: [2.0, 5.6, 9.2], // 줄임말마다 풀이 카드가 뜨는 초(3.6초 간격 — 뜻을 읽는 시간 약 2초)
  rule: 2.75, // 위 띠에 「줄일 때는 음절마다 첫 글자만」 — 첫 풀이의 첫 글자가 내려앉을 때
  end: 12.8,
  total: 16.2,
};

// 카드 안 순서(카드 시작에서 몇 초 뒤): 줄임말 = 원래 낱말 → 첫 글자 → 읽는 법 → 뜻
export const CARD = { syl: 0.1, init: 0.45, read: 0.85, mean: 1.25 };

export const MSGS: Msg[] = [
  { from: 'me', text: '🤪', emoji: true, at: -1 },
  { from: 'friend', text: 'ㅋㅋ', at: -1, item: 0 },
  ...(['🍜?', '🎁'] as const).flatMap((emoji, k): Msg[] => {
    const c = [5.6, 9.2][k];
    return [
      { from: 'me', text: emoji, emoji: true, at: c - 1.05 },
      { from: 'friend', text: ['ㅇㅇ', 'ㄱㅅ'][k], at: c - 0.15, typing: c - 0.6, item: k + 1 },
    ];
  }),
];

export const TOTAL_FRAMES = fr(T.total);
