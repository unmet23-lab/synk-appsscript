// 본편 시간표(10-17 「v5d 연출로 나머지 장면까지 배경음에 맞춰」). 장면은 전부 박에 착지한다.
// 곡 구조(scratchpad bgm-map 실측): 12~15박 드럼 빠짐 → 16박 드롭 / 47~63박 조용한 구간(63박 오르막) → 64박 드롭 /
// 76~79박 브레이크 → 80박 드롭 / 88박에서 곡의 끝맺음(108박~)으로 건너뛴다.
import { beat } from '../lib/beat';

export const T = 12; // 밀기 전환: 시퀀스 시작 + 12프레임 = 착지 박

/** 장면이 착지하는 박. cut은 본편 음악을 끊고 끝맺음으로 잇는 박. */
export const B = {
  hook: 0,
  before: 8,
  benefit: 16,
  check: 22,
  attention: 32,
  spare: 40,
  reset: 46,
  week: 54,
  official: 60,
  guide: 72,
  end: 80,
  cut: 88,
} as const;

/** 끝맺음: 곡 끝맺음의 첫 타격(원곡 1590프레임 = 53.0초)부터 2.8초. 108박 격자(1584)는 곡 자체의 멈춤 구간이라 그 6프레임 뒤 실제 타격에 잇는다
 * (Fable 10-18, 원곡 프레임별 RMS: 1583~1589 −21~−37 dB → 1590 −11.8 dB). 소리는 55.6초쯤 사라진다. */
export const TAIL = { songFrame: 1590, frames: Math.round(2.8 * 30) };
export const CUT = beat(B.cut);
export const TOTAL = CUT + TAIL.frames;

type Key = keyof typeof B;
const ORDER: Key[] = ['hook', 'before', 'benefit', 'check', 'attention', 'spare', 'reset', 'week', 'official', 'guide', 'end'];

/** 장면 시퀀스: 첫 장면은 0에서, 나머지는 착지 12프레임 전에 시작. 끝 장면은 영상 끝까지. */
export const seq = (k: Key) => {
  const i = ORDER.indexOf(k);
  const from = i === 0 ? 0 : beat(B[k]) - T;
  const to = k === 'end' ? TOTAL : beat(B[ORDER[i + 1]]);
  return { from, len: to - from };
};

/** 장면 안 프레임: 장면 k가 착지한 뒤 b박째(절대 박 번호) */
export const at = (k: Key, b: number) => beat(b) - beat(B[k]) + (k === 'hook' ? 0 : T);
