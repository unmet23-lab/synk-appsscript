// 지금 판 코치에 계기(./index.mjs)를 붙인다. 지금 판은 atlas/game-learning.js의 createGame이 낸 코치다 — 그 공개 표면만 읽고
// 엔진 파일은 건드리지 않는다. 이 파일은 엔진 묶음(src/index.mjs)에 들지 않는다: 지금 판 제품의 빌드가 이 파일을 직접 가져다 쓴다.
// 제품에 붙이는 것은 단계 0이 아니다(붙이면 공개본이 바뀐다) — 붙일 자리는 docs/_ops/qa/atlas-redesign-20261110/단계0_계획.md §4.
//
// 읽는 것
//   coach.syncPort.subscribe 알림 — 'storage-error'(STORAGE_ERROR · HISTORY_CAPACITY)는 저장 실패, 'storage-wait'(STORAGE_BUSY)는
//     다른 탭이 쓰는 중이라 미룸, 저장이 된 뒤 오는 알림(append · flush · import · storage-ready)은 저장 성공. 모르는 알림은 세지 않는다.
//   coach.recommend · coach.recommendActivities — 던지면 추천 실패, status 'unavailable'은 고르지 않음(실패 아님),
//     결과의 storage.available은 저장소 관측.
// 돌려주는 것: { coach, detach }. coach는 두 추천 메서드만 감싸고 나머지는 지금 판 그대로 넘기는 겉이다.
const SAVED = new Set(['append', 'flush', 'import', 'storage-ready']);
const WRAPPED = new Set(['recommend', 'recommendActivities']);

function onStorage(health, event) {
  const kind = event?.kind;
  if (kind === 'storage-error') health.note('save', { ok: false, code: event.code });
  else if (kind === 'storage-wait')
    health.note('save', { ok: false, code: event.code, waiting: true });
  else if (SAVED.has(kind)) health.note('save', { ok: true });
}

function counted(health, method) {
  return (...args) => {
    let result;
    try {
      result = method(...args);
    } catch (error) {
      health.note('recommend', { ok: false, code: error?.code || 'THROWN' });
      throw error;
    }
    health.observeStorage(result?.storage?.available);
    health.note('recommend', { ok: true, empty: result?.status === 'unavailable' });
    return result;
  };
}

export function attachLegacyCoach(coach, health) {
  if (!coach || typeof coach.recommend !== 'function') {
    throw new TypeError('Atlas health: a legacy coach is required');
  }
  if (!health || typeof health.note !== 'function') {
    throw new TypeError('Atlas health: a health counter is required');
  }
  const port = coach.syncPort;
  const unsubscribe =
    typeof port?.subscribe === 'function'
      ? port.subscribe(event => onStorage(health, event))
      : null;
  const methods = new Map();
  for (const name of WRAPPED) {
    if (typeof coach[name] === 'function') methods.set(name, counted(health, coach[name]));
  }
  const wrapped = new Proxy(coach, {
    get: (target, property, receiver) =>
      methods.get(property) ?? Reflect.get(target, property, receiver),
  });
  return Object.freeze({ coach: wrapped, detach: () => unsubscribe?.() });
}
