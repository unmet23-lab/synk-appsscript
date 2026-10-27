// 본편 시간표(10-28 「AI 포스터가 너무 복잡할 때 — '디테일 줄여 줘' 한 줄」). 장면은 배경음 박에 착지한다 — 박 격자는 지난 편들과 같은 곡(src/lib/beat.ts).
// 곡 구조(지난 편 실측): 16박 드롭(7.87초) · 47~63박 조용한 구간 · 64박 드롭. 끝 장면 뒤 cut박에서 곡의 끝맺음(원곡 53.0초 첫 타격)으로 건너뛴다.
import { beat } from '../lib/beat';

/** 장면이 착지하는 박. 목소리를 구운 뒤 줄 길이에 맞춰 정했다(scripts/vo-place.mjs가 겹침을 막는다). */
export const B = {
  hook: 0, // 꽉 찬 포스터 → 「땐,」에서 깔끔한 포스터로 밀어 넘김
  line: 8, // 다시 짠 입력 칸 「디테일 줄여 줘」 + 보내기(글은 처음부터 보임 — v4)
  cnt: 15, // 큰 카드 한 장 — 글씨 11곳에 빨간 테 → 밀어 넘겨 3곳에 노란 테(v4, 16박 드롭 앞)
  recap: 23, // 「디테일 줄여 줘」 한 줄을 크게 + 전후 작게(v4)
  end: 31, // 끝 질문(끝 화면 6초 안 — 올리기 전 검사 ③)
  cut: 35, // 끝 질문 뒤 곡 끝맺음으로
} as const;
// v1~v3(마디 hook · line · cmp · recap · end, 이해 시험 4 · 3점)의 박은 git 이력에 있다.

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 2.8초. */
export const TAIL = { songFrame: 1590, frames: Math.round(2.8 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

export type Key = Exclude<keyof typeof B, 'cut'>;
export const at = (k: Key) => beat(B[k]);
