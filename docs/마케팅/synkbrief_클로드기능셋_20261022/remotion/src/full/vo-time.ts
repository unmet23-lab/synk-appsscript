// 나레이션 낱말이 영상에서 시작하는 프레임 — vo.ts(낱말 시각, 소리/vo표.py)와 vo-place.json(줄 자리, scripts/vo-place.mjs)을 합친다.
import { VO } from './vo';
import PLACE from './vo-place.json';

type Clip = { id: string; at: number };
export const wordFrame = (variant: 'A' | 'B', id: string, word: string): number | null => {
  const c = ((PLACE as unknown as Record<string, Clip[]>)[variant] || []).find((x) => x.id === id);
  const v = VO[id];
  if (!c || !v) return null;
  const w = v.words.find((x) => x.w === word) ?? v.words.find((x) => x.w.startsWith(word.replace(/[,.?]$/, '')));
  return w ? c.at + Math.round(w.t * 30) : null;
};
