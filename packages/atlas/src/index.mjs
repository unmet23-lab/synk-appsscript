// Atlas 엔진 패키지의 바깥 입구(설계 §2 · §8 · §9). 빌드가 이 파일을 묶음 하나(atlas/<판>/atlas.mjs)로 묶는다.
// 단계 0은 자리만 있다 — 두뇌는 단계 2, 지도는 단계 1, 기록은 단계 3이 자기 폴더에 짓고 여기에 내보내기를 한 줄씩 더한다.
// 지금 판 코치에 계기를 붙이는 src/health/legacy.mjs는 묶음에 넣지 않는다(지금 판 제품의 빌드가 직접 가져다 쓴다).
export { EDITION } from './edition.mjs';
export { COACH_METHODS, createCoach } from './coach/index.mjs';
export { createHealth, HEALTH_VERSION } from './health/index.mjs';
export { EVENT_FORM, EVENT_TYPES } from './record/events.mjs';
