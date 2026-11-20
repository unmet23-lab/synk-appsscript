// Y73 그림 · 색. 그림은 모두 실제 기준 그림의 가슴 패치 자리(420px)를 잘라 1008px로 키운 것(마크 글자 자리만 흐림).
// p1 = 1화 처음 그림(11-17) · p2 = 2화 · p3 = 3화 기준 그림(셋 다 「토마토색」만 적은 판)
// p1b = 1화를 「no stem, no leaves, no fruit」까지 적어 다시 만든 판 · f1~f3 = 꼭지만 지우는 고치기로 바로잡은 판(9크레딧씩)
// full1 = 1화 처음 그림 전신(AI로 만든 가상 인물)
export const STAGE = '#EEEAE2';
export const INK = '#15130F';
export const SUB = '#6B6458';
export const BUTTER = '#F5C445';
export const PAPER = '#FBF9F5';

/** 1008px 판 안의 꼭지 자리(가운데)와 원판 가운데. 눈으로 잰 값. */
export const STEM: Record<string, { x: number; y: number }> = {
  p1: { x: 509, y: 416 },
  p2: { x: 510, y: 406 },
  p3: { x: 512, y: 408 },
  p1b: { x: 524, y: 432 },
};
export const DISC: Record<string, { x: number; y: number }> = {
  p1: { x: 506, y: 508 },
  p2: { x: 506, y: 505 },
  p3: { x: 506, y: 512 },
  p1b: { x: 508, y: 498 },
  f1: { x: 508, y: 498 },
  f2: { x: 509, y: 440 },
  f3: { x: 500, y: 505 },
};
