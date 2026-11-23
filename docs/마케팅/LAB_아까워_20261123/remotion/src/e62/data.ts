// LAB 영어 E62 「아까워」(11-23 07시 회차) — 1단계: 핵심 장면(한 장면 먼저 v1)만.
// 펠트 분식집, 볶음밥 한 숟갈이 남은 철판을 아주머니가 치우려 들어 올리자(p1 · p2) 몽글이 뛰어올라 철판 가장자리에 턱을 걸고 매달린다(p3)
// → 몽글 아주 가까이 「아까워!」(p4) → 아주머니가 굳었다가(p5) 웃음이 번진다(p6). 2단계에서 이 장면을 가운데 두고 편 칸표를 짠다.
// 판은 판/_판짜기.py가 1080×1920으로 짠 그림, 움직이는 몽글은 tools/층나누기.py가 나눈 층(img/layer/<판>_m.png)과 빈 배경(<판>_bg.jpg).
export const FPS = 30;
export const SCENE = 5.6;

export type Cell = { at: number; img: string; push?: [number, number]; origin?: string };
export const CELLS: Cell[] = [
  { at: 0.0, img: 'layer/p1_bg.jpg', push: [1.0, 1.03], origin: '40% 55%' }, // 아주머니가 철판 손잡이를 잡음 · 몽글은 마지막 한 숟갈 쪽으로 몸을 기울이며 글썽임(층) · 뒤에서 친구가 코트를 입음
  { at: 0.95, img: 'layer/p2_bg.jpg', push: [1.0, 1.02], origin: '55% 70%' }, // 철판이 들림 · 몽글이 웅크렸다가 뛰어오름(층)
  { at: 1.55, img: 'layer/p3_bg.jpg', push: [1.0, 1.03], origin: '58% 65%' }, // 몽글이 철판 가장자리에 턱을 걸고 매달려 흔들림(층) · 아주머니 놀람
  { at: 2.55, img: 'layer/p4_bg.jpg', push: [1.0, 1.05], origin: '52% 55%' }, // 몽글 아주 가까이 — 「아까워!」(층이 떨고 외칠 때 늘어남)
  { at: 4.05, img: 'p5.jpg', push: [1.0, 1.05], origin: '46% 32%' }, // 아주머니 가까이 — 굳음(0.12초에 확 다가감)
  { at: 4.75, img: 'p6.jpg', push: [1.05, 1.08], origin: '46% 32%' }, // 같은 구도 — 웃음이 번짐
];

// 목소리 — 아주머니 미선(a1), 몽글 소진(m1)
export const VO: [number, string][] = [
  [0.1, 'vo/a1'], // 다 드셨죠~?
  [2.65, 'vo/m1'], // 아까워!
];

// [시각, 파일, 크기]
export const SFX: [number, string, number][] = [
  [0.95, 'lift.wav', 0.7], // 철판이 상에서 들림
  [1.0, 'squish.wav', 0.5], // 몽글이 납작 웅크림
  [1.22, 'whoosh.wav', 0.7], // 뛰어오름
  [1.55, 'cling.wav', 0.9], // 가장자리에 매달림
  [2.68, 'pop.wav', 0.45], // 말풍선
  [4.05, 'freeze.wav', 0.7], // 아주머니가 굳음
  [4.8, 'sparkle.wav', 0.35], // 웃음이 번짐
];

export const T = {
  a1: 0.12, a1To: 1.45, // 아주머니 말풍선(철판이 들리는 칸까지 — 같은 자리에 아주머니가 있다)
  m1: 2.68, m1To: 4.05, // 몽글 말풍선 「아까워!」
};

export type Layer = { img: string; cx: number; cy: number }; // cx · cy = 돌리고 키우는 기준(층 좌표 — 1080×1920)
// p2 — 웅크림(0.95~1.2) → 뛰어오름(1.2~1.55): 바닥 가운데 기준
export const JUMP = { img: 'layer/p2_m.png', base: [827, 1599] as [number, number], from: 0.95, crouch: 1.2, to: 1.55, dx: -230, dy: -330 };
// p3 — 철판 가장자리를 문 입 자리를 축으로 그네처럼 흔들림(처음 16° → 잦아듦)
export const SWING = { img: 'layer/p3_m.png', pivot: [640, 1385] as [number, number], from: 1.55, to: 2.55, deg: 16, hz: 1.4, decay: 1.5 };
// p4 — 떨림(±5px) + 「아-까-워」 세 마디마다 몸이 늘었다 줄고(낱말 시각 0.02~0.81초) 매달린 채 좌우로 흔들림: 철판 가장자리 기준
export const PLEAD = { img: 'layer/p4_m.png', pivot: [560, 1090] as [number, number], from: 2.55, to: 4.05, px: 5, beats: [2.67, 2.93, 3.2], sway: 3 };
// p1 — 마지막 한 숟갈 쪽(왼쪽)으로 몸을 기울이며 들썩임: 바닥 가운데 기준
export const LEAN = { img: 'layer/p1_m.png', base: [852, 1555] as [number, number], from: 0.0, to: 0.95, deg: -9 };
