// Y22 박자표(30fps). 오마주 원본 StXGGNlNLOk(38.8초)의 컷 · 박자 초에 장면을 붙이고(../../../오마주.json), 목소리 줄은 그 칸 안에 넣는다.
// 원본: 0.3 큰 숫자 훅 · 3.7 숫자 바뀜 · 4.8 공개(밝은 판) · 6.5~7.9 · 9.6 원리 확대(11.3 · 11.6 더 확대) · 11.8 문제 · 15.5 한 번 돌리기 ·
// 16.9 · 18.2 · 21.2 비교 막대 · 25.3 · 28.3 두 줄 · 31.3 · 33.3 가져갈 것 · 35.5 끝(댓글) · 38.8 끝.
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

export const B = {
  hook: F(0.3),
  flip: F(3.9), // 원본 3.7 — v1이 「퍼센트」를 다 말한 뒤에 바뀌게(나란히 0.6초 안)
  reveal: F(4.8),
  flash: F(6.5),
  ear: F(6.7),
  pair: F(7.9),
  lens: F(9.6),
  zoom1: F(11.3),
  zoom2: F(11.6),
  broken: F(11.8),
  run: F(15.5),
  mark: F(16.9),
  voices: F(18.2),
  bars: F(21.2),
  listen: F(25.3),
  rule: F(28.3),
  rule2: F(31.3),
  prompt: F(33.3),
  end: F(35.5),
} as const;
export const TOTAL = F(38.8);

/** 실제 소리 한마디(「Your turn!」)를 트는 프레임. 깨진 판 → 다시 뽑은 판. */
export const CLIP = {
  broken1: F(0.3),
  clean1: F(3.95),
  broken2: F(25.45),
  clean2: F(26.65),
} as const;

/** 목소리 줄이 시작하는 프레임. */
export const VO: Record<Spoken, number> = {
  v1: F(1.1),
  v2: F(4.95),
  v3: F(9.75),
  v4: F(14.85),
  v5: F(19.5),
  v6: F(28.35),
  v7: F(33.7),
};
export const ORDER = Object.keys(VO) as Spoken[];

type W = readonly [string, number, number];
export const words = (id: Spoken) => VOICE[id].words as readonly W[];
export const dur = (id: Spoken) => Math.round(VOICE[id].dur * 30);
export const lineEnd = (id: Spoken) => VO[id] + dur(id);
/** id 줄에서 text를 품은 첫 낱말(from번째부터)이 시작하는 프레임. 없으면 렌더를 멈춘다(대본이 바뀌면 바로 알게). */
export const at = (id: Spoken, text: string, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return VO[id] + Math.round(ws[i][1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};
/** 화면 꼴 낱말: 「에이아이」 → 「AI」, 읽는 숫자 → 숫자. */
export const show = (t: string) =>
  t.replace(/에이아이/g, 'AI').replace('이십', '20.8%').replace(/^점$/, '').replace(/^팔$/, '').replace(/^퍼센트/, '').replace(/^영$/, '0%');
