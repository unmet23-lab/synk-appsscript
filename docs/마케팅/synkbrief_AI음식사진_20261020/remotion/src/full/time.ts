// 본편 시간표(10-20 「메뉴판 AI 음식 사진」). 장면은 전부 배경음 박에 착지한다 — 박 격자는 지난 편과 같은 곡(src/lib/beat.ts).
// 곡 구조(지난 편 실측): 12~15박 드럼 빠짐 → 16박 드롭 / 47~63박 조용한 구간(63박 오르막) → 64박 드롭 / 76~79박 브레이크 → 80박 드롭.
// 이 편은 80박(39.1초)에서 곡의 끝맺음(원곡 53.0초 첫 타격)으로 건너뛴다.
import { beat } from '../lib/beat';

export const T = 12; // 밀기 전환: 시퀀스 시작 + 12프레임 = 착지 박

/** 장면이 착지하는 박. cut은 본편 음악을 끊고 끝맺음으로 잇는 박. */
export const B = {
  hook: 0,
  fact: 8,
  guest: 16,
  turn: 24,
  prompt: 30, // 요청문 카드를 읽을 시간을 2박 더 준다(Fable 10-20 P3)
  after: 40,
  check: 48,
  fix: 64,
  end: 74, // 08 말(4.3초)이 8박보다 길어 끝 장면을 2박 미룬다
  cut: 80,
} as const;

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 2.8초(지난 편 time.ts TAIL과 같다). */
export const TAIL = { songFrame: 1590, frames: Math.round(2.8 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

export type Key = Exclude<keyof typeof B, 'cut'>;
export const ORDER: Key[] = ['hook', 'fact', 'guest', 'turn', 'prompt', 'after', 'check', 'fix', 'end'];

/** 장면 시퀀스: 첫 장면은 0에서, 나머지는 착지 12프레임 전에 시작. 끝 장면은 영상 끝까지. */
export const seq = (k: Key) => {
  const i = ORDER.indexOf(k);
  const from = i === 0 ? 0 : beat(B[k]) - T;
  const to = k === 'end' ? TOTAL : beat(B[ORDER[i + 1]]); // 다음 장면이 착지할 때까지 — 앞뒤가 12프레임 겹쳐 밀기에 빈 화면이 없다(v1의 0.4초 빈 화면 고침)
  return { from, len: to - from };
};

/** 장면 안 프레임: 장면 k가 착지한 뒤 b박째(절대 박 번호) */
export const at = (k: Key, b: number) => beat(b) - beat(B[k]) + (k === 'hook' ? 0 : T);
