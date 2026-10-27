// 본편 시간표(10-27 「빈 방 사진 한 장, AI가 기억하는 '나'」 다시 살림 v4~). 장면은 배경음 박에 착지한다 — 박 격자는 지난 편들과 같은 곡(src/lib/beat.ts).
// 곡 구조(지난 편 실측): 16박 드롭(7.87초) · 47~63박 조용한 구간 · 64박 드롭. 끝 장면 뒤 cut박에서 곡의 끝맺음(원곡 53.0초 첫 타격)으로 건너뛴다.
// v3까지의 시간표(설명 셋 — 기억 · 임시 채팅 · 끄는 곳)와 v4 · v5 시간표는 git 이력에 있다.
import { beat } from '../lib/beat';

/** 장면이 착지하는 박. 목소리를 구운 뒤 줄 길이에 맞춰 정했다(scripts/vo-place.mjs가 겹침을 막는다). */
export const B = {
  hook: 0, // 빈 방 → 채워진 방(「줬더니」에서)
  why: 8, // 같은 방에 머물며 「메모리를 켜 둔 ChatGPT가 짐작」(v6)
  items: 16, // 물건 다섯(같은 방 안, 16박 드롭)
  line: 28, // 다시 짠 입력 칸 「여러분도 빈 방 사진에, 이 한 줄만」(v6 — 끝에서 시킴)
  end: 36, // 끝 장면을 따로 떼어 끝 화면이 6초 안(올리기 전 검사 ③)
  cut: 40, // 끝 질문 뒤 곡 끝맺음으로
} as const;

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 2.8초. */
export const TAIL = { songFrame: 1590, frames: Math.round(2.8 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

export type Key = Exclude<keyof typeof B, 'cut'>;
export const at = (k: Key) => beat(B[k]);
