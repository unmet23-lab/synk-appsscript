// 시간선 — 셈은 timeline.js 하나(정지컷 도구와 같은 것). 구운 목소리는 vo.generated.json(node 음성시각.mjs).
import { FPS } from './tokens';
import { LINES } from './data';
import voJson from './vo.generated.json';

type VoGen = { dur?: Record<string, number>; words?: Record<string, [string, number, number][]> };
const vo = voJson as unknown as VoGen;
import { buildTimeline } from './timeline.js';

export type Span = { from: number; to: number };
export type Cue = Span & { line: string; text: string };

const T = buildTimeline(LINES, vo, FPS) as {
  lineTime: Record<string, Span & { sec: number; dur: number }>;
  cues: Cue[];
  scenes: Record<string, Span>;
  total: number;
};
export const lineTime = T.lineTime;
export const cues = T.cues;
export const SCENES = T.scenes;
export const TOTAL = T.total;
export const VO_DUR: Record<string, number> = vo.dur ?? {};
export const VO_WORDS: Record<string, [string, number, number][]> = vo.words ?? {};

/** 그 줄의 frac(0~1) 자리 — 전체 프레임. */
export const at = (id: string, frac = 0) => {
  const s = lineTime[id];
  if (!s) throw new Error(`없는 줄 ${id}`);
  return Math.round(s.from + (s.to - s.from) * frac);
};
/** 그 줄에서 낱말(needle을 품은 첫 낱말)이 시작하는 자리 — 구운 줄은 낱말 시각, 아니면 frac. */
export const atw = (id: string, needle: string, frac: number) => {
  const w = VO_WORDS[id]?.find(([t]) => t.includes(needle));
  return w ? Math.round(lineTime[id].from + w[1] * FPS) : at(id, frac);
};
export const end = (id: string) => lineTime[id].to;
