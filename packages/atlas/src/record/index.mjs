// 기록 포트(Trail · 설계 §5) — 사건 2판 · 측정 계약 · 어댑터 · 근거 줄 · 서버 접기 순서 · 기기의 기록부 · 저장 포트 · 옛 기록 옮기기.
//
// 받는 것: 엔진이 만든 사건(제시 · 답 · 도움 · 제외 · 본인 말 · 옮겨 온 장부)과 호스트가 준 저장 포트, 서버의 답(받은 표지 · 요약).
// 내는 것: 저장 결과(저장이 끝나야 근거), 서버 요약 위에 내 사건을 얹은 보기(얹을 수 없는 줄은 기다린다), 「낸 것」 기록,
//          서버가 쓰는 접기 순서(foldAccount · summaryOf — SQL은 SYNK-talk의 포트).
// 지킬 것: 계정의 원천은 서버 · 저장에 실패한 답은 근거로 나가지 않는다 · 사건마다 만든 때의 동의 판 번호 · 저장 실패는 계기에.
// 계산 자체(기억 · 난도 · 첫 만남 · 얹기)는 단계 2의 src/fold를 부른다. 계획: docs/_ops/qa/atlas-redesign-20261110/단계3_계획.md
export const STAGE = 3;
export {
  deviceKey,
  EMPTY_INDEX,
  foldEventsOf,
  foldEventsOfAll,
  groupsOf,
  itemOf,
  serverKey,
  sourcesOf,
} from './adapt.mjs';
export { carriedFields, carriedSoFar, cellsOf, legacyToImport } from './carry.mjs';
export { AHEAD_MS, createClock } from './clock.mjs';
export {
  checkEvent,
  checkLinks,
  createEvent,
  EVENT_FORM,
  EVENT_TYPES,
  eventId,
} from './events.mjs';
export { idbPort } from './idb.mjs';
export { judge } from './judge.mjs';
export { createRecord, openRecord } from './log.mjs';
export { memoryPort, storeName } from './port.mjs';
export { linesOfGroups, rowsOfGroup } from './rows.mjs';
export {
  clampedOf,
  entryOf,
  FOLD_CAP,
  foldAccount,
  foldEdition,
  foldPending,
  RECORD_EDITION,
  summaryOf,
} from './server.mjs';
export { applyDelta, viewOf } from './summary.mjs';
