// Y23 박자표(30fps). 원본 Sf8Gu31kEfA(37.9초) 컷 0 · 2.7 · 3.0 · 3.2 · 4.0 · 5.5 · 7.3 · 12.8 · 14.6 · 16.7 · 29.1과
// 박자 0.8 · 9.5 · 11.3 · 18.9 · 20.8 · 23.0 · 24.8 · 26.8 · 31.5 · 33.8 · 35.2 · 37.3에 우리 장면을 놓았다(../../오마주.json).
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

export const B = {
  title: F(0.8), // 원본 첫 자막이 서는 박 — 「실패 알림」 머리글
  real: F(2.7), // 실제 화면 한 컷 그대로
  zoomA: F(3.0), // 「You've hit your weekly limit」 줄 확대
  zoomB: F(3.2), // 시각 줄 확대
  pan: F(4.0), // 다시 화면 전체 — 천천히 내려감
  loop: F(5.5), // 15분마다 고리(원본 「74억 개」 큰 글 자리)
  night: F(7.3), // 실제 시각 71줄이 밤새 쌓임(원본 모델 목록이 차례로 붙는 자리)
  midnight: F(9.5), // 날이 바뀜
  count: F(11.3), // 「71번」 큰 카드(원본 「470여 종」 자리)
  twist: F(12.8), // 답은 알림 안에(원본 이름 공개 자리)
  twist2: F(14.6), // 풀리는 시각 확대
  rule: F(16.7), // 고친 규칙(원본 「한 번만 설정하면 끝」 자리)
  rest: F(18.9), // 고친 뒤 첫 알림 — 실제 화면(원본 「한도 도달」 자리)
  resume: F(20.8), // 풀리자 저절로 다시(원본 「자동 전환」 자리)
  again: F(23.0), // 이틀 뒤 또 한도
  one: F(24.8), // 알림 딱 한 번(원본 메모 타이핑 자리)
  versus: F(26.8), // 71 대 1
  cta: F(29.1), // 고친 규칙 한 단락은 글에(원본 「정리해 뒀어요」 자리)
  cta2: F(31.5),
  end: F(33.8), // 끝 장면 — 71통이 다시 쌓였다가(원본 밈 자리)
  fold: F(35.2), // 한 통으로 접힘
  settle: F(37.3),
} as const;
export const TOTAL = F(37.9);

/** 목소리 줄이 시작하는 프레임. */
export const VO: Record<Spoken, number> = {
  v1: F(0.15),
  v2: F(2.85),
  v3: F(7.8),
  v4: F(12.9),
  v5: F(16.8),
  v6: F(20.85),
  v7: F(29.2),
  v8: F(35.25),
};
export const ORDER = Object.keys(VO) as Spoken[];

type W = readonly [string, number, number];
export const words = (id: Spoken) => VOICE[id].words as readonly W[];
export const dur = (id: Spoken) => Math.round(VOICE[id].dur * 30);
export const lineEnd = (id: Spoken) => VO[id] + dur(id);
export const at = (id: Spoken, text: string, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return VO[id] + Math.round(ws[i][1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};
