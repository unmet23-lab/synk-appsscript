// 순간 맞춤(단계 4 계획 §23-4 · 4-6b)의 입구. 코치의 live가 부른다 — 알고리즘(flow.mjs) · 가드(guard.mjs) · 사람에게 닿는 줄(lines.mjs).
// 셋 다 아무것도 저장하지 않는 순수 모듈이다. 내용 기억 · 오늘 · 표시 설정을 읽고 쓰는 일은 코치와 셸이 한다.
export {
  CONDITIONS,
  challenge,
  DIMENSIONS,
  declaredFrom,
  defineContent,
  ITEM,
  KINDS,
  logit,
  MODES,
  OUTCOMES,
  PRESENTATION,
  sigmoid,
  start,
  VERSION,
} from './flow.mjs';
export { COOL_DOWN, check, FLIP_WINDOW } from './guard.mjs';
export {
  line,
  STUCK,
  stuckFor,
  supportStep,
  VERSION as LINES_VERSION,
  WORDS,
} from './lines.mjs';
