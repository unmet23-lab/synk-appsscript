// 시간표(초). 원본 ABi9-hza5Ks(21.5초 · 「이렇게 말하지 마」 훅 → 규칙 → 세 낱말이 틀린 표기 ✗ → 고친 표기로 1.3~1.8초마다 → 끝 댓글 부르기)의 뼈대를 옮긴다.
// 틀린 표기 칸은 블록이 떨어지는 순간, 고친 표기 칸은 시소로 튀어 오른 자음 블록이 합쳐지는 순간. 셋째 이름 뒤에 거북이가 걸어 들어오는 끝을 더했다.
// v3(같이 짚은 것): 자음이 튀어 오르는 순간에 「F → ㅍ (p)」(시소와 글자 교체의 고리) · 합칠 때 카메라를 밀어 빈 시소를 뺌 · 빅터에서 자음이 몽글 머리를 치는 개그(같은 동작 되풀이) · 피오나 뒤를 줄임.
// v5(볼 이유 심사 「빅터가 되풀이 · 거북이를 앞당겨라」): 빅터 · 자라를 줄이고 빅터 끝은 웃는 얼굴 대신 어지러운 얼굴, 끝 장면을 둘로(자라 → 물음표 거북이).
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export type RowT = { tip: number; hit: number; land: number; merges: number[]; done: number };
export const T = {
  total: 23.1,
  q1: 2.1,
  ko1: 3.8,
  say1: [4.65, 5.05, 5.45], // 피 · 오 · 나 튕김
  rule: 6.0, // No V. No Z, either — 피오나가 쓸려 나가고 V · Z가 떨어진다
  row2: 7.8,
  bonk: 8.72, // ㅂ이 몽글 머리를 친다
  row3: 10.1,
  turtle: 12.2, // 거북이가 걸어 들어옴
  hop: 12.68, // 자라 블록이 등으로 올라탐
  end: 13.6, // 끝거북이 판
  ask: 15.6, // YOUR name in Korean? — 물음표 거북이 판
  cta: 18.0, // 물음표 블록이 뒤집혀 Bob → 밥 = rice(둘째 반전 — v7 볼 이유 심사)
  you: 19.75, // 다시 뒤집혀 너는? · Comment your name
  r1: { tip: 0.5, hit: 1.25, land: 1.95, merges: [2.75, 3.1, 3.45], done: 3.85 } as RowT,
  r2: { tip: 8.0, hit: 8.4, land: 9.25, merges: [9.4, 9.55], done: 9.6 } as RowT,
  r3: { tip: 10.35, hit: 10.7, land: 11.1, merges: [11.25, 11.4], done: 11.45 } as RowT,
} as const;

export const TOTAL_FRAMES = fr(T.total);
