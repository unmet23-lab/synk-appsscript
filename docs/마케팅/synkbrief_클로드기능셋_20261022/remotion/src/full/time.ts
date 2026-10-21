// 본편 시간표(10-22 「Claude 기능 셋」). 장면은 전부 배경음 박에 착지한다 — 박 격자는 지난 편들과 같은 곡(src/lib/beat.ts).
// 곡 구조(지난 편 실측): 12~15박 드럼 빠짐 → 16박 드롭 / 47~63박 조용한 구간(63박 오르막) → 64박 드롭 / 76~79박 브레이크 → 80박 드롭.
// 끝 장면 뒤 cut박에서 곡의 끝맺음(원곡 53.0초 첫 타격)으로 건너뛴다.
import { beat } from '../lib/beat';

export const T = 12; // 밀기 전환: 시퀀스 시작 + 12프레임 = 착지 박

/** 장면이 착지하는 박. cut은 본편 음악을 끊고 끝맺음으로 잇는 박. 목소리를 구운 뒤 줄 길이에 맞춰 정했다(scripts/vo-place.mjs가 겹침을 막는다). */
export const B = {
  hook: 0,
  rule: 14, // 16박 드롭이 기준 첫 줄
  proj: 27,
  skill: 41,
  myth: 56, // 조용한 구간(47~63박) 끝, 64박 드롭이 「만들어 주고」 무렵 · 장면마다 마지막 요소가 1초 넘게 보이게 한 박씩 늘림(v2)
  conn: 71, // 80박 드롭이 「보내기 전엔」 무렵
  sum: 86,
  end: 99,
  cut: 106, // 끝 질문 줄이 곡 끝맺음 위로 이어진다
} as const;

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 2.8초. */
export const TAIL = { songFrame: 1590, frames: Math.round(2.8 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

export type Key = Exclude<keyof typeof B, 'cut'>;
export const ORDER: Key[] = ['hook', 'rule', 'proj', 'skill', 'myth', 'conn', 'sum', 'end'];

/** 장면 시퀀스: 첫 장면은 0에서, 나머지는 착지 12프레임 전에 시작. 끝 장면은 영상 끝까지. 앞뒤가 12프레임 겹쳐 밀기에 빈 화면이 없다. */
export const seq = (k: Key) => {
  const i = ORDER.indexOf(k);
  const from = i === 0 ? 0 : beat(B[k]) - T;
  const to = k === 'end' ? TOTAL : beat(B[ORDER[i + 1]]);
  return { from, len: to - from };
};

/** 장면 안 프레임: 장면 k가 착지한 뒤 b박째(절대 박 번호) */
export const at = (k: Key, b: number) => beat(b) - beat(B[k]) + (k === 'hook' ? 0 : T);
