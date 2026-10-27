// 시간표(초). 목소리 시각은 public/vo/*.json의 길이 · 낱말 시각으로 맞췄다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  // S1 계산대 넓게 — 바리스타가 손을 흔들며 인사, 첫 화면 제목은 0초부터
  b1: 0.45, // 다음에 밥 한번 먹어요! (1.62초 — 10-28 잘림 없이 다시 구움)
  s2: 2.3, // S2 몽글이 달력을 꺼냄 — 말풍선 1
  bubble1: 2.4,
  s3: 4.9, // S3 바리스타 굳은 미소 + 「NOT A REAL PLAN」 도장
  b2: 5.0, // 아, 네. 그냥, 다음에요. (2.38초 — 10-28 다시 구움, seed 1030)
  lesson: 7.6, // Real Korean 칸(멈춘 카페) — 두 줄을 처음부터 다 보이고 들릴 때 켠다
  n1: 7.85, // It's not a real plan. It just means, see you around! (4.15초)
  n2: 12.2, // 네, 좋아요! (1.78초, 낱말 0.04 · 0.402)
  n3: 14.15, // Your turn. Say it out loud! (2.40초 — E3 파일)
  turnGap: [16.6, 18.6], // 따라 말할 틈 2초
  s5: 18.6, // S5 몽글이 「네, 좋아요!」 — 말풍선 2
  bubble2: 18.7,
  b3: 19.2, // 네! 또 오세요! (1.09초)
  end: 20.6, // 끝 판
  n4: 20.75, // What other Korean polite lies do you know? (2.86초)
  total: 24.2,
} as const;

// n1 낱말 시각(초, 줄 머리 기준)
export const N1_WORDS = { not: 0.35, see: 2.916, end: 4.15 } as const;
// n2 낱말 시각
export const N2_WORDS = { ne: 0.04, joayo: 0.402, end: 1.777 } as const;

export const TOTAL_FRAMES = fr(T.total);
