// 고르기 — 「고르기 1판」: 층 · 한도 · 차례(설계 §3-5 · §3-6). 단계 2가 채웠다.
//
// 받는 것: 문항 후보 · 기억 · 작업 난도 · 판(길이 · 새것 한도 · 더 배우기 · 연습 수준) · 하루(「낸 것」 기록) · 본인 설정.
// 내는 것: 고른 문항과 겨눈 단위 · 층 · 예상 성공 확률(세 항) · 이유, 또는 idle(할 것 없음) · none(낼 것 없음).
// 지킬 것: 설계 §3-5의 불변식 일곱과 차례의 속성 여섯(test/properties/session.property.test.mjs). 동점은 씨앗으로 가른다.
// 진도(새것의 순서)는 제품이, 때(언제 다시)는 엔진이 정한다.
export { choose } from './choose.mjs';
export { filterCandidates } from './filter.mjs';
export { PLAN_FACTS, planActivities } from './plan.mjs';
export { effectiveTheta, predict, predictParts } from './predict.mjs';
export {
  createLearner,
  dayKey,
  newLimitOf,
  present,
  record,
  say,
  startSession,
  stubbornCapOf,
} from './session.mjs';
