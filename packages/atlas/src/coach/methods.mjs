// 코치 메서드 이름(설계 §8의 표). 입구(loader/loader.js)의 METHODS와 같아야 한다(시험이 두 목록을 견준다).
// 의존이 없는 잎 파일이라 unit 시험이 부른다 — 코치 본체(index.mjs)는 두뇌(ts-fsrs)를 부른다.
// 결과의 why · idle · none은 메서드가 아니라 결과의 칸이다. 없애는 것(followups · syncPort · memoryPort · mapVersion 비교)은 두지 않는다.
export const COACH_METHODS = Object.freeze([
  // 그대로
  'recommend',
  'present',
  'help',
  'delivery',
  'answer',
  'exclude',
  'recheck',
  'summary',
  'exposure',
  'finishSet',
  'feedback',
  'live',
  'today',
  'presentation',
  'reset',
  'dispose',
  // 더함
  'plan',
  'due',
  'tell',
  'synced', // 첫 받기의 결과를 한도 안에서(단계 4 계획 §18-5-5 G4 — 처음인 기기의 판 정하기)
  'guestRecords', // 손님 → 계정 옮기기(단계 4 계획 §18-5-3 — 경계 표지 · 다섯 걸음)
]);
