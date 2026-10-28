// 본편 시간표(10-28 「AI 글 티 날 때 — 내 글 세 줄 붙이고 '이 말투로 다시 써 줘'」). 장면은 배경음 박에 착지한다 — 박 격자는 지난 편들과 같은 곡(src/lib/beat.ts).
// 곡 구조(지난 편 실측): 16박 드롭(7.87초) · 47~63박 조용한 구간 · 64박 드롭. 끝 장면 뒤 cut박에서 곡의 끝맺음(원곡 53.0초 첫 타격)으로 건너뛴다.
import { beat } from '../lib/beat';

/** 장면이 착지하는 박. 목소리를 구운 뒤 줄 길이에 맞춰 정했다(scripts/vo-place.mjs가 겹침을 막는다). B14보다 한 줄 장면 말(v02)이 0.9초 길어 cnt부터 두 박씩 늦다. */
export const B = {
  hook: 0, // 처음 공지 → 「이렇게」에서 네 줄 공지로 밀어 넘김
  line: 8, // 다시 짠 입력 칸: 「내가 전에 쓴 글이야」 + 세 줄 + 「이 말투로 다시 써 줘」 + 보내기
  cnt: 17, // 견줌 판 — 위 처음 공지 줄(빨간 테 → 지워짐) · 아래 세 줄 붙인 뒤 네 줄(노란 테)
  recap: 25, // 그대로 붙여 쓰는 요청문 틀 — 「내가 전에 쓴 글이야 + (내 글 세 줄) + 이 말투로 다시 써 줘」
  end: 33, // 끝 질문(끝 화면 6초 안 — 올리기 전 검사 ③)
  cut: 39, // 끝 질문 뒤 곡 끝맺음으로(v2: 끝 말에 「댓글로 알려 주세요」가 붙어 두 박 늦춤)
} as const;

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 2.8초. */
export const TAIL = { songFrame: 1590, frames: Math.round(2.8 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

export type Key = Exclude<keyof typeof B, 'cut'>;
export const at = (k: Key) => beat(B[k]);
