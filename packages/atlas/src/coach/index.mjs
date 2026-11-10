// 코치 3판의 겉(설계 §8). 단계 4가 채운다. 메서드 이름은 §8의 표 그대로다 — 게임이 부르는 이름은 되도록 그대로 두고 속이 바뀐다.
// 결과의 why · idle · none은 메서드가 아니라 결과의 칸이다. 없애는 것(followups · syncPort · memoryPort · mapVersion 비교)은 두지 않는다.
//
// 단계 0의 코치는 ready만 풀리고, 나머지 메서드는 NOT_IMPLEMENTED로 분명히 던진다 — 조용히 빈 값을 돌려주면 제품이 엔진이
// 돈다고 믿는다. 입구(loader/loader.js)는 이 목록과 같은 이름을 ready 전까지 NOT_READY로 막는다(시험이 두 목록을 견준다).
import { EDITION } from '../edition.mjs';

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
]);

function notImplemented(name) {
  return () => {
    throw Object.assign(new Error(`Atlas ${name}: 단계 4에서 채운다(${EDITION})`), {
      code: 'NOT_IMPLEMENTED',
    });
  };
}

// options는 단계 4에서 정한다(저장 포트 · 지도 · 판 · 본인 설정). 단계 0은 받기만 한다.
export function createCoach(options = {}) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('Atlas: coach options must be an object');
  }
  const coach = { edition: EDITION, ready: Promise.resolve() };
  for (const name of COACH_METHODS) coach[name] = notImplemented(name);
  return Object.freeze(coach);
}
