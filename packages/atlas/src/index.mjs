// Atlas 엔진 패키지의 바깥 입구(설계 §2 · §8 · §9). 빌드가 이 파일을 묶음 하나(atlas/<판>/atlas.mjs)로 묶는다.
// 단계마다 자기 폴더에 짓고 여기에 내보내기를 한 줄씩 더한다 — 지도는 단계 1, 두뇌는 단계 2, 기록은 단계 3.
// 지금 판 코치에 계기를 붙이는 src/health/legacy.mjs는 묶음에 넣지 않는다(지금 판 제품의 빌드가 직접 가져다 쓴다).
// 두뇌(src/memory)가 ts-fsrs를 부르므로 이 입구를 거치는 시험은 의존을 깐 묶음(build · properties · learners)에 둔다 —
// unit 시험은 잎 모듈만 부른다.
export {
  abilityOf,
  abilityTerm,
  EMPTY_SKILL,
  floorOf,
  stepAbility,
  stepSkill,
} from './ability/index.mjs';
export { COACH_METHODS, createCoach } from './coach/index.mjs';
export { EDITION } from './edition.mjs';
export { applyOwn, createView, overlay, touchedBy } from './fold/device.mjs';
export { evidenceOf, markOf, unitRowOf } from './fold/evidence.mjs';
export { checkFoldEvent, FOLD_KINDS } from './fold/events.mjs';
export { byTime } from './fold/order.mjs';
export { firstMeeting, foldServer, foldSkill, foldUnit, skillRowsOf } from './fold/server.mjs';
export { creditedOf, familyUnit, unitsOf } from './fold/units.mjs';
export { createHealth, HEALTH_VERSION } from './health/index.mjs';
export { openMap } from './map/index.mjs';
export { GRADES, gradeOf, PRODUCED } from './memory/grade.mjs';
export { createMemory } from './memory/index.mjs';
export { EDITIONS, PARAMS } from './params.mjs';
export { REASON_CODES } from './reason/index.mjs';
export { reasonLine } from './reason/ko.mjs';
export {
  applyDelta,
  carriedFields,
  carriedSoFar,
  checkEvent,
  checkLinks,
  clampedOf,
  createClock,
  createEvent,
  createRecord,
  EMPTY_INDEX,
  EVENT_FORM,
  EVENT_TYPES,
  entryOf,
  eventId,
  FOLD_CAP,
  foldAccount,
  foldEdition,
  foldEventsOfAll,
  groupsOf,
  idbPort,
  judge,
  legacyToImport,
  linesOfGroups,
  memoryPort,
  openRecord,
  RECORD_EDITION,
  storeName,
  summaryOf,
  viewOf,
} from './record/index.mjs';
export { choose } from './select/choose.mjs';
export { filterCandidates } from './select/filter.mjs';
export { PLAN_FACTS, planActivities } from './select/plan.mjs';
export { effectiveTheta, predict, predictParts } from './select/predict.mjs';
export {
  createLearner,
  dayKey,
  newLimitOf,
  present,
  record,
  say,
  startSession,
  stubbornCapOf,
} from './select/session.mjs';
