// 본편 시간표(10-27 「한 칸에 몰린 주문 옵션, AI한테 나누는 수식을 달라고 하세요」). 장면은 배경음 박에 착지한다 — 박 격자는 지난 편들과 같은 곡(src/lib/beat.ts).
// 곡 구조(지난 편 실측): 16박 드롭(7.87초) · 47~63박 조용한 구간 · 64박 드롭. 끝 장면 뒤 cut박에서 곡의 끝맺음(원곡 53.0초 첫 타격)으로 건너뛴다.
import { beat } from '../lib/beat';

/** 장면이 착지하는 박. 목소리를 구운 뒤 줄 길이에 맞춰 정했다(scripts/vo-place.mjs가 겹침을 막는다). */
export const B = {
  hook: 0,
  ask: 9,
  ans: 21,
  paste: 31,
  fill: 36,
  end: 44, // 끝 화면이 6초 안(올리기 전 검사 ③)
  cut: 50, // 끝 말 뒤 곡 끝맺음으로
} as const;

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 1.6초(이해 시험 v2 「말이 끝난 뒤 늘어진다」 → 2.8초에서 줄임). */
export const TAIL = { songFrame: 1590, frames: Math.round(1.6 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

export type Key = Exclude<keyof typeof B, 'cut'>;
export const at = (k: Key) => beat(B[k]);
