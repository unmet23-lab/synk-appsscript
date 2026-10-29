// 본편 시간표 — 원본(우리편 「AI 유료 구독, 하나만 고른다면」 유튜브 판 48.8초)의 장면 착지 초 · 장면 안 박을
// 이 곡(밝은_052) 박 가운데 가장 가까운 박으로 옮겼다(어긋남 0.03~0.33초, 오마주 나란히 허용 0.6초 안).
//   원본 착지 3.96 · 11.29 · 18.12 · 24.47 · 31.31 · 39.12 · 44.01초 → 박 6 · 17 · 28 · 38 · 49 · 61 · 69
//   원본 장면 안 박 5.9 · 7.7 · 16.7 · 21.0 · 22.9 · 28.2 · 34.2 · 35.1 · 35.8 · 36.7 · 40.3 · 42.1 · 45.9초
import { beat } from './lib/beat';

export const T = 12; // 밀기 전환: 시퀀스 시작 + 12프레임 = 착지 박(원본과 같다)

/** 장면이 착지하는 박 */
export const B = {
  hook: 0,
  myth: 6,
  q1: 17,
  q2: 28,
  q3: 38,
  extra: 49,
  sum: 61,
  end: 69,
} as const;

/** 장면 안 박(절대 박 번호) — 화면이 한 번에 바뀌는 자리 */
export const E = {
  mythNo: 9, // ✕ 도장(원본 5.9)
  mythZoom: 11, // 그 줄 크게(원본 7.7)
  q1Yes: 20, // 「예」 누름(말 「그럼」 13.27초 앞 — v6 자가 진단)
  q1Temp: 22, // 임시 채팅 화면으로(원본에 없음 — 한 구성 4초를 넘지 않게)
  q1Pill: 26, // 알약(원본 16.7)
  q2Yes: 30, // 「예」 누름(말 「설정」 19.68초 앞)
  q2Path: 32, // 길 표시(원본 21.0)
  q2Zoom: 36, // 그 줄 크게 + 끄기 화살표(원본 22.9)
  q3Yes: 43, // 「예」 누름(말 「그건」 27.58초)
  q3Hi: 44, // 형광펜 + 알약(원본 28.2)
  exRing: 53, // 평가 단추 동그라미(원본 34.2)
  exDoc: 55, // 도움말 문단(원본 35.1)
  exHi: 56, // 형광펜(원본 35.8)
  exStamp: 57, // 도장(원본 36.7)
  sum2: 63, // 둘째 체크(원본 40.3)
  sum3: 66, // 셋째 체크(원본 42.1)
  endLine: 72, // 댓글 줄(원본 45.9)
} as const;

export const TOTAL = Math.round(48.8 * 30); // 원본 길이 그대로

export type Key = keyof typeof B;
export const ORDER: Key[] = ['hook', 'myth', 'q1', 'q2', 'q3', 'extra', 'sum', 'end'];

/** 장면 시퀀스: 첫 장면은 0에서, 나머지는 착지 12프레임 전에 시작. 끝 장면은 영상 끝까지. */
export const seq = (k: Key) => {
  const i = ORDER.indexOf(k);
  const from = i === 0 ? 0 : beat(B[k]) - T;
  const to = k === 'end' ? TOTAL : beat(B[ORDER[i + 1]]);
  return { from, len: to - from };
};

/** 장면 k 안의 프레임: 절대 박 b가 장면 시작에서 몇 프레임 뒤인가 */
export const at = (k: Key, b: number) => (k === 'hook' ? beat(b) : beat(b) - beat(B[k]) + T);
/** 장면 k 안에서 착지 프레임 */
export const land = (k: Key) => (k === 'hook' ? 0 : T);
