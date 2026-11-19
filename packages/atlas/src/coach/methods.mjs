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
  'itemUnits', // 지도 문항의 단위(단계 4 계획 §19-3 — 생활 복습 → 생활 단위, 제품이 단위를 짓지 않는다)
  'exposures', // 묶음 만남 — 여러 문항의 exposure()를 한 번에(단계 4 계획 §21-3 — 판을 여는 진단 · 시작점 고르기)
  'lookback', // 30일째 문장의 수 — 손님과 동의를 끈 계정(단계 4 계획 §21-7, 서버 길 계정은 null)
  'watch', // 받기 알림 — 문서 밖의 답이 들어왔다(receive · refresh만, 단계 4 계획 §21-20)
  'pull', // 지금 받기 — 서버 길 계정만, 학습일 답보다 기기가 뒤처졌을 때 셸이 그 답의 자리마다 한 번(단계 4 계획 §21-22)
  'firstAnswers', // 예상 급수의 근거 수 — 손님과 동의를 끈 계정(단계 4 계획 §21-23의 2, 서버 길 계정은 null)
  'excludeResponse', // 판 응답을 빼는 문 — 판 응답(feedback.given)만 받는다(단계 4 계획 §22-5)
  'responses', // 판 응답 목록 — 「내가 남긴 응답」 · 짧은 연습 길이(단계 4 계획 §22-5)
  'untell', // 본인 말 되돌리기 — { event, stored }, 본인 말 사건만 받는다(단계 4 계획 §22-6 · 4-5 끝 판 GPT GB4)
  'startSet', // 판 열기 — recommend 없이 present만 하는 판의 길이(단계 4 계획 §23-6 · 설계 주인 11-19 밤)
]);
