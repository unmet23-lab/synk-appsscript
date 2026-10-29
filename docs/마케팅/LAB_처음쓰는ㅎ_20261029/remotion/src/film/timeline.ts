// 시간표(초). 원본(우리편) E5 「처음 쓰는 ㄹ」의 자리를 그대로 따르고(오마주.json 뼈대 — 반전 6.9 · 끝 15.0),
// 나레이션 시각은 public/vo/*.json의 낱말 시각으로 맞췄다 — 이름표는 그 낱말이 들리는 순간에 뜬다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

const BASE = {
  // 첫 장 — 따라 쓰기 칸 넷(본 글자 하나 + 시도 셋). 시도마다 펜을 드는 획이 셋이다.
  h1: 0.1, // My first try at this letter...
  att1: [-0.6, 1.9], // 눈사람 — 0초엔 위 작은 동그라미만 다 그어져 있다(눈사람 개그를 첫 화면에서 다 쓰지 않게)
  a1: 2.35, // That's a snowman. — 「snowman」 +0.41
  att2: [2.6, 4.05], // 하트
  a2: 4.25, // Now it's a heart. — 「heart」 +0.73
  att3: [4.45, 5.75], // 모자 쓴 얼굴
  a3: 5.5, // A guy in a top hat? — 「top」 +0.59
  pencilOut: [5.8, 6.3], // 다 그으면 곧 빠진다(멈춘 칸 줄이기)
  flip: [6.8, 7.35], // 쪽 넘김
  // 둘째 장 — 큰 칸 하나에 세 획
  f1: 7.45, // The real way: three strokes. — 「three」 +1.01
  pencilIn: [8.55, 9.45],
  st1: [9.45, 9.95], // Short line.
  st2: [10.5, 11.1], // Long line.
  st3: [11.4, 12.45], // Circle. — 12시에서 왼쪽으로(시계 반대)
  pencilAway: [12.5, 13.15],
  explode: [12.6, 13.0], // 세 획 벌리기
  snap: [14.35, 14.7], // 다시 붙이기
  k1: 13.1, // 히읗.
  end: 14.85,
  e1: 14.95, // Give mine a score, one to ten! — 「one」 +1.07
  grade: [15.2, 15.8], // 빨간 펜 「?/10」
  total: 18.0, // 0.5초 칸 끝에 맞춘다 — 끝에 0.1초짜리 멈춘 칸이 생기지 않게
  // 이름표가 뜨는 때 — 그 낱말이 들리는 순간(「snowman」 +0.41 · 「heart」 +0.73 · 「top」 +0.59)
  tag1: 2.35 + 0.41,
  tag2: 4.25 + 0.73,
  tag3: 5.5 + 0.59,
} as const;

export const T = BASE;
export const TOTAL_FRAMES = fr(T.total);
