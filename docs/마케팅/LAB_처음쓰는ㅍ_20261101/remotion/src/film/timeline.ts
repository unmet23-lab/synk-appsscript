// 시간표(초). 원본(우리편) E5 「처음 쓰는 ㄹ」의 자리를 따르고(오마주.json 뼈대 — 반전 6.9 · 끝 15.0),
// 나레이션 시각은 public/vo/*.json의 낱말 시각으로 맞췄다 — 이름표는 그 낱말이 들리는 순간에 뜬다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

const BASE = {
  // 첫 장 — 따라 쓰기 칸 넷(본 글자 하나 + 시도 셋). 이름표 셋은 원본 박자(2.9 · 5.0 · 6.2) 0.6초 안에.
  h1: 0.05, // My first try at this letter...
  att1: [-0.6, 1.9], // π — 0초엔 위 가로줄만 다 그어져 있다
  a1: 2.215, // That's pi. — 「pi」 +0.385
  att2: [2.15, 3.6], // # — 세로 둘이 가로 둘을 뚫고 나간다(ㅍ의 흔한 실수)
  a2: 3.81, // Now it's a hashtag. — 「hashtag」 +0.643
  att3: [3.9, 5.2], // 강아지 — 머리 · 등과 꼬리 · 다리 둘 · 바닥(v6 — v3의 첫 장 강아지로 되돌림, 끝에서 ✓)
  a3: 5.17, // Wait... is that a dog? — 「dog」 +1.254
  pencilOut: [5.3, 5.8],
  flip: [7.1, 7.65], // 쪽 넘김(원본 6.9 — 0.2초 늦게, 강아지 이름표를 0.7초 보이려고)
  // 둘째 장 — 큰 칸 하나에 네 획(위 → 왼쪽 → 오른쪽 → 아래)
  f1: 7.75, // The real way: four strokes. — 「four」 +1.064
  pencilIn: [8.75, 9.6],
  st1: [9.6, 10.08], // Top.
  st2: [10.28, 10.8], // Left.
  st3: [10.98, 11.5], // Right.
  st4: [11.7, 12.4], // Bottom.
  pencilAway: [12.45, 13.1],
  explode: [12.6, 13.0], // 네 획 벌리기
  k1: 13.15, // 피읖.
  snap: [14.25, 14.55], // 다시 붙이기
  end: 15.05,
  dog: [10.1, 10.75], // 첫 획(위 가로) 뒤 빨간 펜으로 머리 · 귀 · 꼬리 — 획마다 강아지가 조립된다(v7, 볼 이유 심사 v2~v6 「8~12초 교과서」)
  e1: 15.45, // See? It is a little dog standing on the floor. (e2 — 「dog」 +1.253 · 「floor」 +2.28)
  wiggle: [11.25, 11.6], // 오른쪽 다리까지 그으면 두 다리가 강아지 다리처럼 한 번 꿈틀(앞 장 강아지를 부른다)
  back: 15.45 + 1.253, // 「back」 꼬리표 — 위 가로 = 강아지 등
  floor: 15.45 + 2.28, // 「floor」 꼬리표 — 아래 가로 = 바닥
  total: 18.6,
  tag1: 2.215 + 0.385,
  tag2: 3.81 + 0.643,
  tag3: 5.17 + 1.254,
} as const;

export const T = BASE;
export const TOTAL_FRAMES = fr(T.total);
