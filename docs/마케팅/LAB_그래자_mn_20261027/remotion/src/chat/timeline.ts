// 시간표(초). 소리 없는 화면 글 편이라 한 줄을 2초 넘게 보이게 둔다(몽골 조사 「자막 2초 이상」).
import { Msg } from './data';

export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  cards: [2.2, 5.4, 8.6], // 「그래 = За」 카드가 뜨는 초(3.2초 간격 — v3 2.8초는 「글자 전환이 빨라 읽을 시간이 모자란다」)
  rule: 2.9, // 위 띠에 「Солонгосоор 'за' гэвэл — 그래」 — 첫 카드의 = за가 뜰 때
  land: 11.8, // 정리 카드 — 선생님 · 어른께 그래 ✗ → 네 ✓ 하나를 크게(친구 줄은 작게)
  end: 15.2,
  total: 18.2,
};

// 카드 안 순서(카드 시작에서 몇 초 뒤): 친구 말 뜻 → 내 대답 그래 → = за → 읽는 법
export const CARD = { gloss: 0.05, reply: 0.3, za: 0.7, read: 1.0 };

export const MSGS: Msg[] = [
  { from: 'friend', text: '밥 먹자! 🍜', at: 0.55, typing: 0.15, item: 0 },
  { from: 'me', text: '그래! 😋', at: 1.75, item: 0 },
  { from: 'friend', text: '미안, 좀 늦어 😢', at: 4.25, typing: 3.85, item: 1 },
  { from: 'me', text: '그래 🙂', at: 5.0, item: 1 },
  { from: 'friend', text: '잘 자! 🌙', at: 7.45, typing: 7.05, item: 2 },
  { from: 'me', text: '그래~ 🌙', at: 8.2, item: 2 }, // v3: 「그래~ 👋」의 손 흔들기가 모호하다 — 친구 말의 달을 그대로
];

export const TOTAL_FRAMES = fr(T.total);
