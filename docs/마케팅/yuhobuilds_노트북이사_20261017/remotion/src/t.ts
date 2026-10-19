// 실제 말 시각(음성/timing.js → 준비.mjs → data.json)을 프레임으로. 모든 사건은 낱말 시각에 붙는다.
import data from './data.json';

export const FPS = 30;
export type Seg = { start: number; end: number; tokens: number[]; cap: string[] };
export const VO = data.VO as unknown as {
  total: number;
  x: Record<string, number>;
  segs: Record<string, Seg>;
  variants?: Record<string, Seg & { replaces: string }>;
};
export const LOG = data.LOG as string[];
export const RES = data.RES as { people: { who: string; title: string; first: string }[] };
export const VOICE_AT = data.VOICE_AT as number;

export const fr = (sec: number) => Math.round(sec * FPS);
export const TOTAL = fr(VO.total);

/** 장면 순서와 그 장면이 덮는 대사 */
export const ORDER = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'] as const;
export type SceneId = (typeof ORDER)[number];
export const SCENE_SEGS: Record<SceneId, string[]> = {
  s1: ['h1'],
  s2: ['s1'],
  s3: ['p1', 'p2'],
  s4: ['d1'],
  s5: ['f1', 'f2'],
  s6: ['k1'],
  s7: ['r1', 'r2'],
  s8: ['t1'],
  s9: ['c1', 'c2'],
  s10: ['c3'],
};

/** 위로 밀어 넘기기: 들어오는 장면은 시퀀스 시작 + LAND 프레임에 내려앉는다. 시퀀스는 전환 시각 X에서 시작한다. */
export const LAND = 12;
export const seqStart = (s: SceneId) => (s === 's1' ? 0 : fr(VO.x[s]));
export const seqLen = (s: SceneId) => {
  const i = ORDER.indexOf(s);
  return i === ORDER.length - 1 ? TOTAL - seqStart(s) : seqStart(ORDER[i + 1]) + LAND - seqStart(s);
};

/** 장면 안에서 쓰는 시각 도구: 절대 초 → 그 장면의 프레임 */
export const clock = (s: SceneId, hook: 'A' | 'C' = 'A') => {
  const t0 = seqStart(s);
  const seg = (id: string): Seg => (id === 'h1' && hook === 'C' && VO.variants?.h1c ? VO.variants.h1c : VO.segs[id]);
  return {
    at: (sec: number) => fr(sec) - t0,
    T: (id: string, i: number) => fr(seg(id).tokens[i]) - t0,
    ST: (id: string) => fr(seg(id).start) - t0,
    EN: (id: string) => fr(seg(id).end) - t0,
    seg,
    land: s === 's1' ? 0 : LAND,
    len: seqLen(s),
  };
};
