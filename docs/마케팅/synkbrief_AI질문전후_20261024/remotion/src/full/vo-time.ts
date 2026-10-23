// 나레이션 낱말이 영상에서 시작하는 프레임 — vo.ts(낱말 시각, scripts/vo-ts.mjs)와 vo-place.json(줄 자리, scripts/vo-place.mjs)을 합친다.
import { VO } from './vo';
import PLACE from './vo-place.json';

type Clip = { id: string; at: number; speechEnd: number; end: number };
export const CLIPS: Clip[] = (PLACE as unknown as Record<string, Clip[]>).A;

/** 줄 id의 낱말 word가 시작하는 영상 프레임. 못 찾으면 줄 시작 + fallback초. */
export const wf = (id: string, word: string, fallback = 0): number => {
  const c = CLIPS.find((x) => x.id === id);
  if (!c) return 0;
  const v = VO[id];
  const w = v?.words.find((x) => x.w === word) ?? v?.words.find((x) => x.w.startsWith(word.replace(/[,.?]$/, '')));
  return c.at + Math.round((w ? w.t : fallback) * 30);
};
export const clipAt = (id: string) => CLIPS.find((x) => x.id === id)?.at ?? 0;
export const clipEnd = (id: string) => CLIPS.find((x) => x.id === id)?.speechEnd ?? 0;
