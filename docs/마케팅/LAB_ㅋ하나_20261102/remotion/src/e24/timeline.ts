// 시간표(초). 원본 DOwd4BBj7dA(17.7초 · 「그래」 한 낱말이 상황마다 다섯 뜻 — 제목 → 낱말 → 1~4 → 5 반전 → 「알겠지?」 → 끝)의 박자를 그대로 옮긴다.
// 원본 박자 2.2(컷) · 5.1 · 6.2 · 7.5 · 8.1 · 9.2 · 10.0 · 11.5 · 15.3 · 16.1
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  total: 17.7,
  hookMsg: 0.12, // 몽글이 보낸 장난 이모지
  hookReply: 0.42, // 친구 답 ㅋㅋㅋㅋㅋㅋ — 폰에서 ㅋ가 쏟아지기 시작
  reveal: 2.2, // 컷: ㅋ 한 조각이 크게 떨어진다 — keu · 웃음소리
  rule: 3.6, // 많을수록 더 웃긴 것
  s1: 5.1, // ㅋㅋ = haha
  s2: 6.2, // ㅋㅋㅋ = LOL
  s3: 7.5, // ㅋㅋㅋㅋㅋㅋ = LMAO — 몽글이 넘어가게 웃는다
  s3b: 8.1,
  s4: 9.2, // ㅋ × 14 = I'm DEAD — 카페가 ㅋ로 덮인다
  s4b: 10.0,
  dive: 11.15, // 폰 화면으로 다가간다
  chat: 11.5, // 폰 속 메신저 — 몽글의 마지막 장난 「Knock knock 🚪」
  typing: 11.8,
  one: 12.25, // 친구 답 「ㅋ」 하나
  freeze: 12.9, // 폰에서 냉기가 퍼져 카페가 얼어붙는다 — 날던 ㅋ도 그 자리에서
  cold: 13.15, // ㅋ = k. 🥶
  why: 14.1, // (not funny 😐) — 왜 차가운지(v3 haiku)
  zoom: 15.3, // 얼음 속 몽글 가까이 — 금이 간다
  end: 16.1, // 친구가 「ㅋㅋㅋㅋㅋㅋㅋ jk 😂」 — 얼음이 깨지고 카페가 다시 따뜻해진다(v6)
} as const;

export const TOTAL_FRAMES = fr(T.total);
