// v2 박자표(30fps). 오마주 원본 Ls0r557jclc(42.5초)의 컷 · 박자 초에 장면을 붙이고(../../../오마주.json), 목소리 줄은 그 칸 안에 넣는다.
// 원본: 0.3 결과 훅 · 6.0 반전 · 11.9~13.3 카드 셋 · 17.8 실제 화면 · 22.3 · 23.2 결과 표 · 29.6~30.7 다시 해 본 표 · 35.4~37.1 끝 카드 둘 · 42.0 끝.
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

/** 원본 박자(초) → 프레임. 장면 · 사건은 이것에만 붙는다. */
export const B = {
  hook: F(0.3),
  twist: F(6.0),
  twistMark: F(6.7),
  rule: F(11.9),
  card2: F(12.8),
  card3: F(13.3),
  prompt: F(17.8),
  sent: F(22.3),
  result: F(23.2),
  again: F(29.6),
  row1: F(30.2),
  row2: F(30.7),
  end: F(35.4),
  endA: F(36.4),
  endB: F(37.1),
  last: F(42.0),
} as const;
export const TOTAL = F(42.5);

/** 목소리 줄이 시작하는 프레임 — 칸마다 한 줄, 칸 머리에서 0.15~0.6초 뒤(원본의 숨 자리). */
export const VO: Record<Spoken, number> = {
  v1: F(0.15),
  v2: F(6.1), // r5 v2가 5.75초라 6.1초에 — 11.85초에 끝나 11.9초 컷 전
  v3: F(12.1),
  v4: F(18.3),
  v5: F(23.6),
  v6: F(30.2),
  v7: F(35.6), // r6 v7이 6.26초 — 41.86초에 끝나 42.0초(자막창 걷힘) 전
};
export const ORDER = Object.keys(VO) as Spoken[];

type W = readonly [string, number, number];
const words = (id: Spoken) => VOICE[id].words as readonly W[];
export const dur = (id: Spoken) => Math.round(VOICE[id].dur * 30);
export const lineEnd = (id: Spoken) => VO[id] + dur(id);
/** id 줄에서 text를 품은 첫 낱말(from번째부터)이 시작하는 프레임. 없으면 렌더를 멈춘다(대본이 바뀌면 바로 알게). */
export const at = (id: Spoken, text: string, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return VO[id] + Math.round(ws[i][1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};

/** 자막 글: 줄의 낱말 그대로, 「에이아이」만 화면 꼴 「AI」. */
export const lineText = (id: Spoken) => words(id).map((w) => w[0]).join(' ').replace(/에이아이/g, 'AI');
