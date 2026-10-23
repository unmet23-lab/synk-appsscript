// 시간표(초). 나레이션 시각은 public/vo/*.json의 낱말 시각으로 맞췄다 — 이름표는 그 낱말이 들리는 순간에 뜬다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  // 첫 장 — 따라 쓰기 칸 넷(본 글자 하나 + 시도 셋)
  h1: 0.1, // Writing this for the first time...
  att1: [-0.9, 1.55], // 0초에 이미 1/3쯤 그어진 채로 시작(첫 화면이 비지 않게)
  a1: 2.15, // That's a two. — 「two」 +0.79
  att2: [2.55, 3.85],
  a2: 3.95, // Now it's a Z. — 「Z」 +1.03
  att3: [4.55, 5.85],
  a3: 5.95, // A snake?! — 「snake」 +0.28
  pencilOut: [6.0, 6.5], // 뱀을 다 그으면 곧 빠진다(멈춘 칸 줄이기)
  flip: [6.8, 7.35], // 쪽 넘김
  // 둘째 장 — 큰 칸 하나에 세 획
  f1: 7.45, // Easy fix: three strokes. — 「three」 +0.99
  pencilIn: [8.55, 9.45],
  st1: [9.45, 10.25],
  st2: [10.65, 11.15],
  st3: [11.55, 12.45],
  pencilAway: [12.5, 13.15],
  explode: [12.6, 13.0], // 세 획 벌리기
  snap: [14.35, 14.7], // 다시 붙이기
  k1: 13.1, // 리을.
  end: 14.85,
  e1: 14.95, // Rate mine, one to ten!
  grade: [15.2, 15.8], // 빨간 펜 「?/10」
  total: 18.0, // 0.5초 칸 끝에 맞춘다 — 끝에 0.1초짜리 멈춘 칸이 생기지 않게
} as const;

export const TOTAL_FRAMES = fr(T.total);
