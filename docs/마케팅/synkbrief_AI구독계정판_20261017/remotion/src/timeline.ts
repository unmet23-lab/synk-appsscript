// 시험판 시간표(프레임). 전부 배경음 박에 붙인다: 훅 두 마디 → 「지금 확인」은 드럼이 빠진 마디에서 칩이 하나씩 켜지고
// 다시 터지는 16박(7.87초)에 6/6 → 「급한 것만 맨 위에」.
import { beat } from './lib/beat';

export const T = 12; // 전환 길이
export const CHECK_START = beat(8) - T;
export const ATT_START = beat(18) - T;
export const END = beat(25);

export const HOOK = { click: beat(2), rows: [2.5, 3, 3.5, 4, 4.5, 5].map(beat), mark: beat(6.5), len: CHECK_START + T };
export const CHK = {
  click: beat(9) - CHECK_START,
  done: [11, 12, 13, 14, 15, 16].map((b) => beat(b) - CHECK_START),
  len: ATT_START + T - CHECK_START,
};
export const ATT = {
  chips: [10, 20],
  pop: beat(20) - ATT_START,
  back: beat(22.5) - ATT_START,
  circle: beat(23) - ATT_START,
  len: END - ATT_START,
};
