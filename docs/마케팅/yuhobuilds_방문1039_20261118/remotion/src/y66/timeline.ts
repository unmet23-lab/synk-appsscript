// Y66 시간표(초). 장면 바뀜은 원본(_g-ROA0W5DE) 컷 · 박자 자리에 둔다 — 원본 박자 2.7 · 3.2 · 6.8 · 7.9 · 10.0 · 10.6 · 12.2 · 13.0 · 14.1 · 15.8 · 19.3 · 23.9 · 24.8 · 26.3 · 26.9 · 28.0 · 30.2 · 31.8 · 33.2.
// r2(이해 시험 r1 반영): 세 줄은 「사이트를 만든 AI에게 보낼 부탁」으로, 막대(결과 숫자 되풀이)는 빼고, 끝은 「여러분 홈페이지」 홀을 띠가 훑는 장면.
export const LEN = 36.8;

export const T = {
  page: 0, // 실제 페이지 + 1,039번 방문 · 그중 진짜 사람은?
  hall: 2.7, // 홀이 참
  settle: 3.2, // 「처음으로 제대로 재 봤다」
  top: 6.8, // 윗줄 가까이 — 사람인지, 로봇인지
  sweep: 7.9, // 띠 출발(홀 넓게) · 로봇 셈
  sweepEnd: 10.5,
  botNote: 10.0, // 로봇 = 사람 없이 자동으로 들어온 프로그램
  pct: 10.6, // 98%
  glow: 12.2, // 사람 17
  push: 13.0, // 한 번에 다가감
  me: 14.1, // 가까이 — 그중 10번쯤은 아마 나
  laptop: 15.8, // 고치면서 띄워 본 화면도 따로
  stream: 16.5,
  apart: 18.5,
  ask: 19.5, // 사이트를 만든 AI한테 고치게 한 세 가지(뺄 것 셋)
  strike: 21.6,
  save: 23.9, // 보낼 세 줄(밝은 종이)
  tick2: 24.8,
  tick3: 26.3,
  lift: 26.9, // 줄들이 위로 — 책갈피 자리
  ribbon: 28.0, // 저장해 두세요
  line: 30.2, // 한 문장
  under: 31.8,
  end: 33.3, // 끝 — 여러분 홈페이지 홀
  endSweep: 33.9,
} as const;

export const VO: { id: string; at: number }[] = [
  { id: 'V1', at: 0.15 },
  { id: 'V2', at: 4.35 },
  { id: 'V3', at: 8.2 },
  { id: 'V4', at: 12.2 },
  { id: 'V5b', at: 16.0 },
  { id: 'V6b', at: 19.7 },
  { id: 'V6c', at: 23.95 },
  { id: 'V9', at: 28.3 },
  { id: 'V8', at: 30.5 },
  { id: 'V10', at: 33.8 },
];

export const SFX: { file: string; at: number; v: number }[] = [
  { file: 'swish', at: 2.7, v: 0.55 },
  { file: 'tok', at: 3.2, v: 0.5 },
  { file: 'tick', at: 4.6, v: 0.4 },
  { file: 'tick', at: 5.8, v: 0.4 },
  { file: 'swish', at: 6.8, v: 0.45 },
  { file: 'swish', at: 7.9, v: 0.6 },
  { file: 'tick', at: 10.0, v: 0.45 },
  { file: 'tok', at: 10.6, v: 0.6 },
  { file: 'thud', at: 12.2, v: 0.85 },
  { file: 'tok', at: 13.0, v: 0.4 },
  { file: 'tok', at: 14.1, v: 0.5 },
  { file: 'swish', at: 15.8, v: 0.5 },
  { file: 'tick', at: 18.5, v: 0.45 },
  { file: 'swish', at: 19.5, v: 0.5 },
  { file: 'tick', at: 21.6, v: 0.45 },
  { file: 'tok', at: 23.9, v: 0.5 },
  { file: 'tok', at: 24.8, v: 0.5 },
  { file: 'tok', at: 26.3, v: 0.5 },
  { file: 'tick', at: 26.9, v: 0.4 },
  { file: 'thud', at: 28.0, v: 0.6 },
  { file: 'swish', at: 30.2, v: 0.45 },
  { file: 'tick', at: 31.8, v: 0.45 },
  { file: 'thud', at: 33.3, v: 0.85 },
  { file: 'swish', at: 33.9, v: 0.5 },
  { file: 'tick', at: 35.2, v: 0.4 },
];
