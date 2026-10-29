// Y22 v4 박자표(30fps). v3에서 12~15초 원리 설명을 「turn」 반 빠르기 듣기로 바꾸고(볼 이유 심사 두 번 제안), 조각 세기는 15.5~18.2초로 줄였다.
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

export const B = {
  hook: F(0.3),
  flip: F(3.95), // 원본 3.7 — x1 「들리세요?」를 다 말한 뒤에 판정이 서게(나란히 0.6초 안)
  reveal: F(4.8),
  flash: F(6.5),
  def: F(6.7),
  where: F(7.9),
  lens: F(9.6),
  zoom1: F(11.3),
  zoom2: F(11.6),
  slow: F(11.8),
  slices: F(15.5),
  mark: F(17.6), // x4 「잘라서」 뒤 조각이 다 선 다음(「갈라진 조각을」 자리)
  almost: F(18.2),
  again: F(21.2),
  out: F(25.3),
  rule: F(28.3),
  rule2: F(31.3),
  prompt: F(33.3),
  end: F(35.5),
} as const;
export const TOTAL = F(38.8);

/** 실제 소리 토막. short: 「Your turn!」, long: 「Your turn! Comment your name,」. */
export const CLIPS = [
  { at: F(0.3), src: 'clip/broken.wav', dur: 0.777 },
  { at: F(1.3), src: 'clip/clean.wav', dur: 0.688 },
  { at: F(12.75), src: 'clip/broken_turn_slow.wav', dur: 0.935 }, // 깨진 「turn」 반 빠르기(atempo 0.5, 음높이 그대로)
  { at: F(14.1), src: 'clip/clean_turn_slow.wav', dur: 0.873 },
  { at: F(22.3), src: 'clip/clean_long.wav', dur: 1.925 },
  { at: F(36.8), src: 'clip/broken.wav', dur: 0.777 },
] as const;

export const VO: Record<Spoken, number> = {
  x1: F(2.1),
  x2: F(4.95),
  x3: F(9.85),
  x4: F(15.6),
  x5: F(18.35),
  x6: F(28.45),
  x7: F(33.45),
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
export const show = (t: string) => t.replace('이십', '20.8%').replace(/^점$/, '').replace(/^팔$/, '').replace(/^퍼센트/, '');
