// Y22 v2 박자표(30fps). 장면은 v1과 같은 원본 StXGGNlNLOk 박자에 붙이고(../../../오마주.json), 이야기는 「제 귀엔 괜찮았던 한 줄을 검사기가 잡았다」.
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

export const B = {
  hook: F(0.3),
  flip: F(3.7),
  reveal: F(4.8),
  flash: F(6.5),
  ear: F(6.7),
  stake: F(7.9),
  lens: F(9.6),
  zoom1: F(11.3),
  zoom2: F(11.6),
  waves: F(11.8),
  run: F(15.5),
  mark: F(16.9),
  pull: F(18.2),
  again: F(21.2),
  out: F(25.3),
  rule: F(28.3),
  rule2: F(31.3),
  prompt: F(33.3),
  end: F(35.5),
} as const;
export const TOTAL = F(38.8);

/** 실제 소리 토막을 트는 프레임 — long: 「Your turn! Comment your name,」, crack: 「Your turn!」. */
export const CLIPS = [
  { at: F(0.3), src: 'clip/broken_long.wav', kind: 'broken_long' },
  { at: F(11.5), src: 'clip/broken.wav', kind: 'broken' }, // 돋보기가 다가가는 11.3 · 11.6초에 갈라진 「turn!」이 울린다
  { at: F(22.05), src: 'clip/clean_long.wav', kind: 'clean_long' },
  { at: F(36.85), src: 'clip/broken.wav', kind: 'broken' },
  { at: F(37.85), src: 'clip/clean.wav', kind: 'clean' },
] as const;

/** 목소리 줄이 시작하는 프레임. */
export const VO: Record<Spoken, number> = {
  w1: F(2.3),
  w2: F(4.95),
  w3: F(8.85),
  w4: F(12.4),
  w5: F(15.6),
  w6: F(18.35),
  w7: F(28.45),
  w8: F(33.45),
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
/** 화면 꼴 낱말: 읽는 숫자 → 숫자. */
export const show = (t: string) => t.replace('이십', '20.8%').replace(/^점$/, '').replace(/^팔$/, '').replace(/^퍼센트/, '');
