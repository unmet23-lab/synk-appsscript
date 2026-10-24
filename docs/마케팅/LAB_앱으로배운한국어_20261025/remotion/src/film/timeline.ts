// 시간표(초). 목소리 시각은 public/vo/*.json의 길이 · 낱말 시각으로 맞췄다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  // S1 계산대 넓게 — 첫 화면 제목은 0초부터
  b1: 0.55, // 주문하시겠어요? (1.07초)
  s2: 2.25, // S2 몽글 「앱 말투」 — 말풍선 1
  bubble1: 2.35,
  s3: 4.75, // S3 바리스타 굳은 미소 + 「way too formal」 딱지(v2 「왜 어색한지 설명이 없다」)
  b2: 4.85, // 아, 네. 따뜻한 거요, 아이스요? (2.64초)
  s4: 7.5, // S4 몽글 멘붕 — 말풍선 2, 음악 멈춤
  bubble2: 7.6,
  lesson: 9.45, // Real Korean 칸 — 세 조각을 처음부터 다 보이고 말할 때 켠다
  n2: 9.75, // 아이스 아메리카노 하나 주세요. (2.43초, 낱말 0.02 · 0.645 · 1.431 · 1.733)
  anyItem: 12.25, // 「메뉴 + 하나 주세요」 한 줄
  n3: 12.4, // Your turn. Say it out loud! (2.40초 — v2 「따라 말하라는 건지 댓글인지」)
  turnGap: [14.85, 16.85], // 따라 말할 틈 2초(v1 1.45초는 「말할 시간이 짧다」)
  s5: 16.85, // S5 커피 받기 — 몽글 말풍선 3
  bubble3: 16.95,
  b3: 17.45, // 네, 아이스 아메리카노 하나요! (2.03초)
  end: 19.65, // 끝 판
  n4: 19.8, // What's the weirdest sentence your app taught you? (2.55초)
  total: 22.9,
} as const;

// n2 낱말 시각(초, 줄 머리 기준)
export const N2_WORDS = { ice: 0.02, americano: 0.645, hana: 1.431, juseyo: 1.733, end: 2.433 } as const;

export const TOTAL_FRAMES = fr(T.total);
