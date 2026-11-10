// 계기 — 저장 실패 · 추천 실패를 센다(설계 §1 표 5행 「저장 실패는 화면과 집계에 보임」 · §11 단계 0).
// 코호트 첫 주에 「엔진이 꺼진 학습자」가 몇 명인지 보려는 것이다. 새 코치(단계 3의 저장 포트 · 단계 4의 recommend)와
// 지금 판 코치(./legacy.mjs)가 같은 계기에 알린다. 엔진 묶음을 못 받은 것은 묶음 안의 이 모듈이 알 수 없으므로
// 호스트가 입구의 coach.ready 결과를 note('load', …)로 넘긴다(loader/loader.js의 LOAD_FAILED).
//
// note(kind, outcome) — kind는 'load' · 'save' · 'recommend'.
//   { ok: true }                          됐다
//   { ok: true, empty: true }             (recommend) 조건에 맞는 문항이 없어 고르지 않았다 — 실패가 아니다(제품은 원고 순서로 간다)
//   { ok: false, code }                   실패했다. 코드는 대문자 낱말만 남긴다(메시지 · 경고 문장 · 답 · 문항은 싣지 않는다)
//   { ok: false, code, waiting: true }    (save) 다른 탭 · 틀이 쓰기 잠금을 쥐고 있어 미뤘다 — 정상 경로다. 시도로도 실패로도 세지 않고,
//                                         다음에 저장이 될 때까지 「기다리는 중」으로 둔다
// observeStorage(available) — 저장소를 쓸 수 있는가의 마지막 관측. 판정에는 쓰지 않는다(잠금을 기다리는 탭도 false다).
// snapshot() — 수 · 코드 · 시각만 있는 요약. 학습자 신원 · 문항 번호 · 답 내용이 없다.
//
// 「엔진이 꺼진」 판정(offReasons)
//   load-failed       마지막으로 엔진 묶음을 받으려다 실패했다(그 뒤 받은 적이 없다)
//   save-streak       저장이 offAfter번(기본 3) 이어서 실패했다 — 한 번 되면 0으로 돌아간다
//   recommend-streak  추천이 offAfter번 이어서 던졌다 — 고르지 않음(empty)은 세지 않는다
export const HEALTH_VERSION = 'atlas-health-1';
const KINDS = Object.freeze(['load', 'save', 'recommend']);
const CODE = /^[A-Z][A-Z0-9_]{1,39}$/;
const MAX_CODES = 16;

function emptyTally() {
  return {
    attempts: 0,
    failures: 0,
    streak: 0,
    longestStreak: 0,
    waits: 0,
    waiting: false,
    empty: 0,
    codes: {},
    firstFailureAt: null,
    lastFailureAt: null,
  };
}

function cleanCode(code) {
  return typeof code === 'string' && CODE.test(code) ? code : 'UNKNOWN';
}

function countCode(codes, code) {
  const key = code in codes || Object.keys(codes).length < MAX_CODES ? code : 'OTHER';
  codes[key] = (codes[key] || 0) + 1;
}

function checkOutcome(kind, outcome) {
  if (!KINDS.includes(kind)) throw new TypeError(`Atlas health: unknown kind ${String(kind)}`);
  if (!outcome || typeof outcome.ok !== 'boolean') {
    throw new TypeError('Atlas health: outcome needs ok');
  }
}

function offReasonsOf(tallies, offAfter) {
  const reasons = [];
  if (tallies.load.streak > 0) reasons.push('load-failed');
  if (tallies.save.streak >= offAfter) reasons.push('save-streak');
  if (tallies.recommend.streak >= offAfter) reasons.push('recommend-streak');
  return reasons;
}

export function createHealth({ clock = Date.now, offAfter = 3 } = {}) {
  if (!Number.isInteger(offAfter) || offAfter < 1) {
    throw new TypeError('Atlas health: offAfter must be a positive integer');
  }
  if (typeof clock !== 'function') throw new TypeError('Atlas health: clock must be a function');
  const tallies = { load: emptyTally(), save: emptyTally(), recommend: emptyTally() };
  let available = null;

  function fail(tally, code) {
    const at = clock();
    tally.failures += 1;
    tally.streak += 1;
    tally.longestStreak = Math.max(tally.longestStreak, tally.streak);
    tally.firstFailureAt ??= at;
    tally.lastFailureAt = at;
    countCode(tally.codes, cleanCode(code));
  }

  function note(kind, outcome) {
    checkOutcome(kind, outcome);
    const tally = tallies[kind];
    if (kind === 'save' && outcome.waiting === true) {
      tally.waits += 1;
      tally.waiting = true;
      return;
    }
    tally.attempts += 1;
    if (!outcome.ok) {
      fail(tally, outcome.code);
      return;
    }
    tally.streak = 0;
    tally.waiting = false;
    if (kind === 'recommend' && outcome.empty === true) tally.empty += 1;
  }

  function observeStorage(value) {
    if (typeof value === 'boolean') available = value;
  }

  function snapshot() {
    const copy = tally => ({ ...tally, codes: { ...tally.codes } });
    const offReasons = offReasonsOf(tallies, offAfter);
    return {
      version: HEALTH_VERSION,
      offAfter,
      storageAvailable: available,
      load: copy(tallies.load),
      save: copy(tallies.save),
      recommend: copy(tallies.recommend),
      engineOff: offReasons.length > 0,
      offReasons,
    };
  }

  return Object.freeze({ note, observeStorage, snapshot });
}
