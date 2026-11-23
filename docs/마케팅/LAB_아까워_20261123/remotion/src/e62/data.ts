// LAB 영어 E62 「아까워」(11-23 07시 회차) — 1단계: 핵심 장면(한 장면 먼저 v1)만.
// 펠트 분식집, 볶음밥 한 숟갈이 남은 철판을 아주머니가 치우려 들어 올리자(p1 · p2) 몽글이 뛰어올라 철판 가장자리에 턱을 걸고 매달린다(p3)
// → 몽글 아주 가까이 「아까워!」(p4) → 아주머니가 굳었다가(p5) 웃음이 번진다(p6). 2단계에서 이 장면을 가운데 두고 편 칸표를 짠다.
// 판은 판/_판짜기.py가 1080×1920으로 짠 그림, 움직이는 몽글은 tools/층나누기.py가 나눈 층(img/layer/<판>_m.png)과 빈 배경(<판>_bg.jpg).
export const FPS = 30;
export const SCENE = 6.0; // v2(15시 회차): 말풍선을 1.5초 넘게 두려고 5.6 → 6.0

export type Cell = { at: number; img: string; push?: [number, number]; origin?: string };
export const CELLS: Cell[] = [
  { at: 0.0, img: 'layer/p1_bg.jpg', push: [1.0, 1.03], origin: '40% 55%' }, // 아주머니가 철판 손잡이를 잡음 · 몽글은 마지막 한 숟갈 쪽으로 몸을 기울이며 글썽임(층) · 뒤에서 친구가 코트를 입음
  { at: 0.8, img: 'layer/p2_bg_f.jpg', push: [1.0, 1.02], origin: '55% 70%' }, // 철판이 들림 · 몽글이 웅크렸다가 뛰어오름(층) — v2: 뒤 친구 자리는 p1 판을 붙여 자세가 튀지 않게(p2_bg_f) · 편 v2: 이해 시험 볼 이유 「첫 1초 안에 사건」으로 1.15 → 0.8
  { at: 1.72, img: 'layer/p3_bg.jpg', push: [1.0, 1.03], origin: '58% 65%' }, // 몽글이 철판 가장자리에 턱을 걸고 매달려 흔들림(층) · 아주머니 놀람
  { at: 2.75, img: 'layer/p4_bg.jpg', push: [1.0, 1.12], origin: '52% 55%' }, // 몽글 아주 가까이 — 「아까워!」(층이 떨고 외칠 때 늘어남)
  { at: 4.75, img: 'p5.jpg', push: [1.36, 1.45], origin: '50% 20%' }, // 아주머니 가까이 — 굳음(0.12초에 확 다가감) · v2: 얼굴만 크게(두 판의 철판 위 밥알이 달라 철판을 화면 밖으로)
  { at: 5.35, img: 'p6.jpg', push: [1.45, 1.5], origin: '50% 20%' }, // 같은 구도 — 웃음이 번짐
];

// 목소리 — 아주머니 미선(a1), 몽글 소진(m1)
export const VO: [number, string][] = [
  [0.1, 'vo/a1'], // 다 드셨죠~?
  [2.85, 'vo/m1'], // 아까워!
];

// [시각, 파일, 크기]
export const SFX: [number, string, number][] = [
  [0.8, 'lift.wav', 0.7], // 철판이 상에서 들림
  [0.85, 'squish.wav', 0.5], // 몽글이 납작 웅크림
  [1.32, 'whoosh.wav', 0.7], // 뛰어오름
  [1.72, 'cling.wav', 0.9], // 가장자리에 매달림
  [2.88, 'pop.wav', 0.45], // 말풍선
  [4.75, 'freeze.wav', 0.7], // 아주머니가 굳음
  [5.42, 'sparkle.wav', 0.35], // 웃음이 번짐
];

export const T = {
  a1: 0.05, a1To: 1.68, // 아주머니 말풍선(철판이 들리는 칸까지 — 같은 자리에 아주머니가 있다)
  m1: 2.88, m1To: 4.75, // 몽글 말풍선 「아까워!」
};

export type Layer = { img: string; cx: number; cy: number }; // cx · cy = 돌리고 키우는 기준(층 좌표 — 1080×1920)
// p2 — 웅크림(0.95~1.2) → 뛰어오름(1.2~1.55): 바닥 가운데 기준
export const JUMP = { img: 'layer/p2_m.png', base: [827, 1599] as [number, number], from: 0.8, crouch: 1.3, to: 1.72, dx: -230, dy: -330 };
// p3 — 철판 가장자리를 문 입 자리를 축으로 그네처럼 흔들림(처음 16° → 잦아듦)
export const SWING = { img: 'layer/p3_m.png', pivot: [640, 1385] as [number, number], from: 1.72, to: 2.75, deg: 34, hz: 0.9, decay: 0.7, swayPx: 40 }; // 편(15시 회차): 첫 컷 v2 「그네가 작다」로 24° → 34° + 좌우 40px
// p4 — 떨림(±5px) + 「아-까-워」 세 마디마다 몸이 늘었다 줄고(낱말 시각 0.02~0.81초) 매달린 채 좌우로 흔들림: 철판 가장자리 기준
export const PLEAD = { img: 'layer/p4_m.png', pivot: [560, 1090] as [number, number], from: 2.75, to: 4.75, px: 7, beats: [2.87, 3.13, 3.4, 3.95], sway: 6 }; // 편: 장면 심사 v2 「3~4초가 멈춰 보인다」로 떨림 · 흔들림 · 다가감을 키우고 4번째 마디(꾹 끌어안음)를 더함
// p1 — 마지막 한 숟갈 쪽(왼쪽)으로 몸을 기울이며 들썩임: 바닥 가운데 기준
export const LEAN = { img: 'layer/p1_m.png', base: [852, 1555] as [number, number], from: 0.0, to: 0.8, deg: -9 };

// ── 편(e62-en, 11-23 15시 회차) ──────────────────────────────────────────────
// v2(이해 시험 v1 — sonnet · haiku가 같이 「같아 보임」: 앞 낱말 카드 → … → 끝 질문 카드 짜임이 지난 두 편과 같다 · 교훈 L02):
//   머리 글 칸과 끝 질문 띠를 뺐다. 편은 핵심 장면 첫 칸(아주머니 「다 드셨죠~?」 · 0.8초 철판 들림)으로 바로 열고, 사건으로 닫는다.
// 칸: 0~6.0 핵심 장면(Scene) → 6.0~9.6 뜻 카드(p7a — 철판에 매달린 채 아주머니를 올려다보는 몽글, 웃는 아주머니 「호호호~」)
// → 9.6~18.6 끝 사건(p9 — 아주머니가 밥을 가득 얹은 철판을 들어 「더 줄게~」 → 몽글이 뛰어올라 또 매달림 · 별눈 「아까워~」
//    → 꼭 끌어안고 들썩이며 아주머니 웃음 「아하하~」, 천천히 몽글에게 다가감). 마지막 화면 글은 몽글 말풍선이다. 댓글 물음은 고정 댓글로만.
// 처음 기획의 「한 국자 더 얹는 손」 · 「몽글이 밥에 얼굴을 묻는 컷」(p7 · p8)은 그림 굽기 계정 셋이 모두 한도라(bake1 20:26에 풀림) 이번 판에 없다.
export const FILM = 18.6;
export const SC = 0; // 핵심 장면이 시작하는 편 초(v2부터 맨 앞)
export const F = { card: 6.0, end: 9.6, leap: 10.6, cling: 11.05, zoom: 13.5 };

// 화면 글 꾸러미(판본 틀 — 나라 판본은 이 칸만 바꾼다)
export const TXT = {
  a1: '다 드셨죠~?', a1m: 'All done?',
  m1: '아까워!', m1m: 'Too good to waste!',
  cardKo: '아까워', cardRead: 'a-kka-wo', cardMean: 'too good to waste', cardNote: 'No single English word',
  a2: '더 줄게~', a2m: 'Have some more~',
  m2: '아까워~', m2m: 'Too good to waste~',
};
export const TT = {
  card: 6.1, cardTo: 9.55,
  a2: 9.75, a2To: 11.75,
  m2: 12.45, m2To: 18.6,
};
// 끝 칸 — 몽글이 꼭 끌어안는 때(편 초, 꾹 소리와 같은 때)
export const HUGS = [13.6, 15.0, 16.4, 17.8];

// 편 소리(편 초) — 핵심 장면의 VO · SFX는 SC만큼 밀어 Film이 함께 깐다
export const FILM_VO: [number, string][] = [
  [7.3, 'vo/a0'], // 호호호~(뜻 카드 칸 — 웃는 아주머니)
  [9.8, 'vo/a2'], // 더 줄게~
  [12.4, 'vo/m2'], // 아까워~
  [14.3, 'vo/a3'], // 아하하~(끝 — 또 매달린 몽글을 보고)
];
export const FILM_SFX: [number, string, number][] = [
  [6.12, 'pop.wav', 0.35], // 뜻 카드
  [9.62, 'plop.wav', 0.8], // 가득 얹은 철판 — 털썩
  [9.7, 'sparkle.wav', 0.3],
  [10.6, 'whoosh.wav', 0.6], // 몽글이 뛰어오름
  [11.05, 'cling.wav', 0.85], // 또 매달림
  [11.1, 'sparkle.wav', 0.35], // 별눈
  ...HUGS.map((t) => [t, 'squish.wav', 0.4] as [number, string, number]), // 꼭 끌어안음
  [16.95, 'sparkle.wav', 0.25],
];
