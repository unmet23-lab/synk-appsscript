// 접기 — 사건에서 상태를 다시 만드는 순수 계산(설계 §5-3 · §5-4). 단계 2가 짓고 단계 3(src/record · 서버)이 부른다.
//
// 받는 것: 접기 사건(events.mjs의 꼴). 내는 것: 단위마다 기억 상태 · 능력마다 작업 난도 · 계열마다 첫 만남(요약),
// 그리고 기기가 요약 위에 내 사건을 얹은 보기(얹을 수 없는 줄은 기다린다).
// 지킬 것: 접기는 근거 줄의 순수 함수다 — 줄마다 그 줄의 재료만 읽어 닿은 것만 다시 접어도 처음부터 접은 값과 같다 ·
// 받은 차례를 타지 않는다(order.mjs) · 기기는 서버와 다른 값을 지어내지 않는다. 시험: test/properties/fold.property.test.mjs.
export { applyOwn, createView, overlay, touchedBy } from './device.mjs';
export { evidenceOf, gradeOfEvent, markOf, unitRowOf } from './evidence.mjs';
export { checkFoldEvent, FOLD_KINDS } from './events.mjs';
export { byTime, sortByTime } from './order.mjs';
export { firstMeeting, foldServer, foldSkill, foldUnit, skillRowsOf } from './server.mjs';
export { creditedOf, familyUnit, unitsOf } from './units.mjs';
