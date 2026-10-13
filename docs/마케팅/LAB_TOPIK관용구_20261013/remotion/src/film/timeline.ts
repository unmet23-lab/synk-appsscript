// 120 BPM 격자: 한 박 = 15프레임(30fps). 문제 하나 = 4마디(16박).
// 1마디 함정 · 2마디 보기+카운트다운(음악이 멈추는 마디) · 3마디 첫 박에 정답(음악이 다시 터짐) · 4마디 예문 읽기.
export const FPS = 30;
export const B = 15;
export const Q_LEN = 16 * B; // 240 = 8초
export const END_LEN = 12 * B; // 180 = 6초
export const Q_COUNT = 3;
export const TOTAL = Q_COUNT * Q_LEN + END_LEN; // 900 = 30초

/** 문제 안 사건(문제 시작 기준 프레임). */
export const T = {
  title: 0,
  parts: 1 * B, // 15: 조각 알약 두 개
  guess: 2 * B, // 30: 글자 그대로 읽은 오답
  strike: 3 * B, // 45: 줄 긋기 + Nope
  card: 4 * B, // 60: 카드가 올라오며 제목을 품는다
  options: [4 * B + 4, 4 * B + 8, 4 * B + 12], // 64·68·72: 보기 셋, 4프레임 간격
  count: [5 * B, 6 * B, 7 * B], // 75·90·105: 3·2·1 (음악이 멈춘 두 박 + 쌓는 한 박)
  reveal: 8 * B, // 120: 다운비트에 정답(음악이 다시 터짐)
  art: 8 * B + 8, // 128: 보기가 접히고 그림이 그려진다
  example: 9 * B, // 135
  gloss: 10 * B, // 150
  say: 12 * B, // 180: 4마디 첫 박 — 실제로 말해 볼 형태
  out: 16 * B - 8, // 232: 카메라 쪽으로 빨려 들어가며 다음 장면으로
} as const;

export const qStart = (i: number) => i * Q_LEN;
export const END_START = Q_COUNT * Q_LEN; // 720

/** 끝 장면 안 사건(끝 시작 기준). */
export const E = {
  recap: [1 * B, 2 * B, 3 * B], // 15·30·45
  comment: 4 * B, // 60
  cheer: 6 * B, // 90
  logo: 8 * B, // 120
} as const;

/** 장면이 바뀌는 프레임(다음 장면 시작). 빛 번짐·모션블러·음악 이음매가 여기에 걸린다. */
export const CUTS = [Q_LEN, 2 * Q_LEN, END_START];

/** 빠르게 움직이는 구간 — 이때만 CameraMotionBlur를 켠다. */
export const isFast = (f: number) =>
  CUTS.some((c) => f >= c - 9 && f < c + 8) ||
  Array.from({ length: Q_COUNT }, (_, i) => qStart(i) + T.card).some((c) => f >= c - 2 && f < c + 12);

/** 색수차가 번쩍이는 순간(3~4프레임). 첫 프레임은 깨끗하게 두려고 1프레임에서 시작. */
export const HITS = [1, ...Array.from({ length: Q_COUNT }, (_, i) => [qStart(i) + T.strike, qStart(i) + T.reveal]).flat(), END_START + E.logo];
export const hitAmount = (f: number) => {
  for (const h of HITS) {
    const d = f - h;
    if (d >= 0 && d < 4) return [9, 6, 3, 1][d];
  }
  return 0;
};
