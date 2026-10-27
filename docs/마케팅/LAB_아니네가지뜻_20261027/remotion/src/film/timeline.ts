// 시간표(초). 목소리 시각은 public/vo/*.json의 길이 · 낱말 시각으로 맞췄다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  // S1 계산대 넓게 — 몽글이 동전 병을 쏟았고 바리스타가 깜짝, 첫 화면 제목은 0초부터
  b1: 0.5, // 아니?! (0.50초)
  s2: 2.6, // S2 몽글 가까이(걱정) — 교과서 꼬리표 + 말풍선 1
  bubble1: 2.7,
  s3: 5.1, // S3 꽃 화분 — 바리스타가 빨개져 손사래
  b2: 5.25, // 아니~ 뭘 이런 걸! (1.94초)
  bubbleAgain: 6.75, // 몽글 「또 아니?!」 작은 말풍선
  // Real Korean 칸(멈춘 카페) — v4 시험 「8~16초 어둡고 같은 표가 길게」: 어두운 표 한 장 대신 멈춘 장면을 색 그대로,
  // 놀란 바리스타(S1) 위에 첫 줄 → 빨개진 바리스타(S3) 위에 둘째 줄로 그림이 바뀐다
  lesson: 7.8,
  n1: 7.9, // Not always no! (1.89초)
  rb1: 9.95, // 바리스타 「아니?!」 한 번 더 — 첫 줄
  l3: 10.9, // 둘째 그림(S3 멈춤) + 둘째 줄
  rb2: 11.0, // 바리스타 「아니~ 뭘 이런 걸!」 한 번 더(→ 12.94)
  n3: 13.15, // Your turn. Say it out loud! (2.40초 — E3 파일)
  turnGap: [15.6, 17.6], // 따라 말할 틈 2초 — 둘째 줄을 따라 말한다
  s5: 17.6, // S5 쿠키 서비스 — 몽글이 둘째 줄로 대답
  b3: 17.7, // 서비스예요! (1.05초)
  bubble2: 18.6,
  end: 19.9, // 끝 판
  n4: 20.05, // Which one have you heard in K-dramas? (2.73초)
  total: 23.2,
} as const;

// n1 낱말 시각(초, 줄 머리 기준)
export const N1_WORDS = { not: 0.05, no: 1.323, end: 1.891 } as const;
export const B1_DUR = 0.495;
export const B2_DUR = 1.935;

export const TOTAL_FRAMES = fr(T.total);
