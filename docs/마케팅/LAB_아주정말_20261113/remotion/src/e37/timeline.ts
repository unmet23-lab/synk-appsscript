// 시간표(초). 원본 6x_nN3roaHk(doci_korean 「How to say "very"」 13.7초 · 훅 0.3 · 낱말이 쏟아지기 시작 2.6 · 끝 컷 13.1)를
// 1.2배 자리(훅 0.36 · 쏟아짐 3.12)에 옮기고, 끝 컷은 몽글 한 줄을 들을 시간만큼(15.5초부터 2.8초) 둔다 — 오마주.json 「다르게」.
// 원본은 한 사람 머리 둘레에 「very」 낱말 꼬리표가 스무 개 남짓 쌓이는 한 장면이고, 우리는 그 쌓임을 실제 물건으로 —
// 사전에서 낱말 조각이 튀어나와 방을 채우고 몽글이 파묻힌다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  total: 19.0,
  hook: 0.36, // 원본 0.3 — 「“Very” in Korean?」
  ask: 1.45, // 「Just one word… right?」
  burst: 3.12, // 원본 2.6 — 사전이 펑 열린다
  w: [3.2, 4.35, 5.5, 6.65], // 아주 · 정말 · 진짜 · 완전 — 하나씩 날아올라 머문다
  more: 7.85, // 「Wait… there's MORE?!」 — 네 조각이 더미로 떨어지고 낱말이 빨라진다
  f: [8.0, 8.45, 8.9, 9.35, 9.8, 10.25, 10.7, 11.15], // 매우 · 너무 · 엄청 · 되게 · 무척 · 굉장히 · 몹시 · 대단히
  rain: 11.6, // 조각이 쏟아져 방이 찬다(~14.8)
  line: 12.4, // 「Korean has a LOT of words for “very.”」
  full: 14.8, // 방이 다 찼다 — 몽글은 눈만
  end: 15.5, // 원본 13.1(끝 컷) — 더미 속 몽글 가까이
  bonk: 15.85, // 마지막 한 조각 「아주」가 몽글 머리에 툭(장면 심사 v1 답 4) — 「아주!」
  say: 16.55, // 몽글 「한국어… 진짜 어려워…」
} as const;

export const TOTAL_FRAMES = fr(T.total);
// 장면 심사용 6초(핵심 장면 — 낱말 조각이 빨라지며 쏟아져 방이 차고 몽글이 파묻힌다)
export const SCENE = { from: 9.0, to: 15.0 } as const;
