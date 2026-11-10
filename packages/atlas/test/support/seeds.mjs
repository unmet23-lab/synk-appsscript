// 씨앗 난수 — 시제품(prototype/fuzz.mjs · fuzz-session.mjs)과 같은 수열(mulberry32). 같은 씨앗이면 같은 판이 나온다.
// 임의 시험의 크기는 ATLAS_SEEDS(씨앗 수) · ATLAS_FIRST_SEED(첫 씨앗)로 바꾼다. 어긋난 판은 씨앗과 함께 찍어 그 씨앗 하나로 다시 돌린다.
export const rng = start => {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = (random, list) => list[Math.floor(random() * list.length)];

export function seedRange({ count, first = 1 } = {}) {
  const n = Number(process.env.ATLAS_SEEDS) || count;
  const start = Number(process.env.ATLAS_FIRST_SEED) || first;
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(start)) {
    throw new TypeError('Atlas seeds: 씨앗 수와 첫 씨앗은 정수다');
  }
  return Array.from({ length: n }, (_, i) => start + i);
}
