// B37 시간표 — 컷 · 말 · 소리 한 곳. 초 단위.
export type Crop = { s: number; cx: number; cy: number; ay?: number };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number };

const V1 = 'img/V1.png', V2 = 'img/V2.png', V3 = 'img/V3.png', V4 = 'img/V4.png', V5 = 'img/V5.png', V6 = 'img/V6.png';

export const S = {
  hook: 0, ago: 6.2, laptop: 12.8, v3: 14.6, v1: 20.9, lid: 21.7, minutes: 28.0, scroll: 29.4, scrollEnd: 31.2, focus: 31.4, minutesEnd: 33.2,
  frozen: 33.2, reveal: 38.2, boss: 40.3, law: 44.6, end: 47.8,
};
export const TOTAL_S = 50.2;

const WIDE: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  { from: 0, to: 1.4, src: V4, start: 0, crop: { s: 2.4, cx: 660, cy: 1690 } },
  { from: 1.4, to: 1.9, src: V4, start: 1.4, crop: { s: 2.3, cx: 600, cy: 1090 } },
  { from: 1.9, to: 3.2, src: V4, start: 3, crop: { s: 2.2, cx: 380, cy: 1100 } },
  { from: 3.2, to: 6.2, src: V4, start: 6, crop: { s: 1.15, cx: 560, cy: 1050 } },
  { from: 6.2, to: 7.9, src: V2, start: 0, crop: { s: 1.15, cx: 540, cy: 1000 } },
  { from: 7.9, to: 11.5, src: V2, start: 1.7, crop: { s: 1.5, cx: 540, cy: 1000 } },
  { from: 11.5, to: 12.8, src: V2, start: 5.3, crop: { s: 1.9, cx: 800, cy: 1000 } },
  { from: 12.8, to: 14.6, src: 'laptop', start: 0, crop: WIDE },
  { from: 14.6, to: 20.9, src: V3, start: 0, crop: { s: 1.1, cx: 540, cy: 1050 } },
  { from: 20.9, to: 28.0, src: V1, start: 0, crop: { s: 1.15, cx: 540, cy: 1050 } },
  { from: 33.2, to: 38.2, src: V3, start: 0, crop: { s: 1.1, cx: 540, cy: 1050 } },
  { from: 38.2, to: 40.3, src: V4, start: 8, crop: { s: 1.4, cx: 400, cy: 1100 } },
  { from: 40.3, to: 47.8, src: V5, start: 0, crop: { s: 1.15, cx: 540, cy: 1050 } },
  { from: 47.8, to: 50.2, src: V6, start: 0, crop: { s: 1.05, cx: 480, cy: 1050 } },
];

export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string }[] = [
  { lines: ['회의 끝나고 3분 뒤,', '전원의 폰이 울렸어요'], from: 0, to: 3.1, size: 88 },
  { lines: ['저 둘만', '아직 몰라요'], from: 3.25, to: 6.1, size: 112 },
  { lines: ['갔어요?'], from: 6.4, to: 7.3, meta: '3분 전 · 회의 끝' },
  { lines: ['갔어'], from: 7.3, to: 7.9, grey: true, meta: '3분 전 · 회의 끝' },
  { lines: ['부장님 오늘 같은 말', '세 번 하신 거 알죠?'], from: 8.0, to: 11.4, size: 84 },
  { lines: ['네 번'], from: 11.5, to: 12.8, grey: true, size: 112 },
  { lines: ['AI는 아직', '안 나갔어요'], from: 12.9, to: 14.6, size: 112 },
  { lines: ['본인도 회의', '왜 하는지 모르실걸요?'], from: 14.7, to: 16.9, grey: true, size: 84 },
  { lines: ['이거 부장님한텐', '비밀이에요'], from: 17.5, to: 19.6, size: 88 },
  { lines: ['당연하지'], from: 19.6, to: 20.8, grey: true, size: 112 },
  { lines: ['자, 진짜 끝'], from: 21.0, to: 22.5, grey: true, size: 112 },
  { lines: ['왜?'], from: 26.4, to: 28.0, grey: true, size: 112 },
  { lines: ['AI 회의록은 켜 두면,', '사람이 나가도 받아 적고요'], from: 33.3, to: 36.2, size: 76 },
  { lines: ['설정에 따라,', '끝나면 모두에게 가요'], from: 36.3, to: 38.2, size: 84 },
  { lines: ['아까 그 얘기,', '다섯 번째로 하지'], from: 41.0, to: 43.0, size: 88 },
  { lines: ['기록은 켜 두고'], from: 43.0, to: 44.5, size: 96 },
  { lines: ['미국에선 실제로, 남아서 한 말이', '이렇게 가서 거래가 깨졌어요'], from: 44.7, to: 47.7, size: 66 },
  { lines: ['회의 끝나면,', 'AI 기록부터 끄세요'], from: 47.9, to: 50.2, size: 92 },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 0.03 }, { id: 'n2', t: 3.3 }, { id: 'n3', t: 12.95 }, { id: 'n4', t: 33.3 }, { id: 'n5', t: 36.35 }, { id: 'n6', t: 44.7 },
];

export const SOUNDS: { t: number; vol: number; src?: string; dur?: number; clip?: string; from?: number; to?: number }[] = [
  { t: 0, src: 'sfx/buzz_many.wav', vol: 0.5, dur: 72 },
  { t: 3.2, src: 'sfx/thud.wav', vol: 0.28 },
  { t: 12.8, src: 'sfx/tok.wav', vol: 0.3 },
  { t: 28.0, src: 'sfx/thud.wav', vol: 0.3 },
  { t: 31.4, src: 'sfx/tok.wav', vol: 0.35 },
];
