// 드라마 말하기 테이크 차례와 「혼자 해 봄」 규칙(2026-11-02). 브라우저와 Node가 같은 파일을 쓴다 — 이PC 시범 서버(tools/lib/drama-pilot-service.mjs가
// 다시 내보냄)는 세션마다, WORLD 안 화면(pilot.mjs의 WORLD 통로)은 화면 메모리에서 같은 규칙으로 정한다.
// 「혼자 해 봄」(assessable)은 검수를 통과한 새 상황 명세에서 모범을 보기 전 첫 판정 테이크가 규칙으로 확신한 것(통과+확실 → 맞음, 노트 → 고칠 점)뿐이다
// (docs/드라마말하기_기획.md §3-5 · 결정 10-31 ②). 다른 날 이미 본 문항인지는 Atlas가 계정 이력으로 따로 거른다(firstExposure).

export class TakeLimitError extends Error {
  constructor() { super('take_limit'); this.code = 'take_limit'; this.status = 429; }
}

export function newAttemptState() {
  return { epoch: 0, attempts: new Map(), requests: new Map(), usedRequests: new Set(), transferRevealed: false, transferSubmitted: false };
}
export function resetAttempts(state) {
  state.epoch++; state.attempts.clear(); state.requests.clear();
  // 같은 새상황을 이미 보거나 제출한 사실은 다시하기로 지우지 않는다.
  return { ok: true, firstExposure: !state.transferSubmitted && !state.transferRevealed };
}
export function beginTake(state, { lineId, phase, requestId }) {
  const key = `${phase}:${lineId}`, attempt = (state.attempts.get(key) || 0) + 1;
  if (attempt > 9) throw new TakeLimitError();
  const transfer = phase === 'transfer';
  // 판정 보류(명세 밖 · 확신 없는 통과)는 기회를 쓰지 않는다(10-31 결정). 기록에서는 learning-entry가 그 차례의 첫 시도만 「혼자 해 봄」으로 남기고,
  // 다른 날 · 다시 시작한 판은 Atlas가 계정 이력(firstExposure)으로 반복으로 본다 — 측정은 Trail의 independent로 읽는다.
  const eligible = transfer && !state.transferRevealed && !state.transferSubmitted;
  state.attempts.set(key, attempt);
  state.usedRequests.add(requestId);
  return { epoch: state.epoch, requestId, attempt, hinted: transfer ? state.transferRevealed : true, independentEligible: eligible };
}
export function trailOf({ phase, status, transcript = '', observation, independentEligible = false, reviewed = false }) {
  const kind = status === 'ok' ? observation?.kind : null;
  const correct = kind === 'pass' ? true : kind === 'note' ? false : null;
  const assessable = phase === 'transfer' && independentEligible === true && reviewed === true && (kind === 'note' || kind === 'pass' && observation.sure === true);
  const unheard = status === 'no_speech' || status === 'unclear' && !String(transcript || '').trim();
  return { correct, assessable, ...(unheard ? { reason: 'unanswered' } : {}) };
}

// WORLD 안 화면(11-02): talk world-speaking take 응답의 take 칸 → 시범 서버 응답 꼴(status · transcript · observation). 판정은 talk(drama-judge)가 정본이다.
// 노트는 verdict가 note일 때, 통과는 verdict pass이고 sure일 때만이다 — 확신 없는 통과는 판정 보류(pending). 한국어 아님 · 너무 빠름 · 잘 안 들림은 unclear.
const PENDING = Object.freeze({ kind: 'pending', note: null, sure: false });
export function talkObservation(t) {
  const transcript = typeof t?.heard === 'string' ? t.heard : '';
  if (t?.status === 'no_speech') return { status: 'no_speech', transcript, observation: { ...PENDING } };
  if (t?.status !== 'ok') return { status: 'unclear', transcript, observation: { ...PENDING } };
  const kind = t.verdict === 'note' && t.note ? 'note' : t.verdict === 'pass' && t.sure === true ? 'pass' : 'pending';
  return { status: 'ok', transcript, observation: { kind, note: kind === 'note' ? t.note : null, sure: kind === 'pass' } };
}
// talk에 알려 주는 그 대사의 앞 테이크 수 — 판정된 수 · 잇달아 안 들린 수(talk의 다음 걸음만 바꾼다).
export const isUnheard = (out) => out.status === 'no_speech' || (out.status === 'unclear' && !String(out.transcript || '').trim());
// talk는 0~20만 받는다(넘으면 400) — 다음 걸음에만 쓰는 수라 20에서 멈춘다.
export const TAKE_COUNT_MAX = 20;
export const nextCount = (count, out) => (isUnheard(out) ? { judged: count.judged, unheard: Math.min(TAKE_COUNT_MAX, count.unheard + 1) } : { judged: Math.min(TAKE_COUNT_MAX, count.judged + 1), unheard: 0 });
// 테이크 한 번의 결과를 차례 상태에 반영하고 화면이 받던 응답 꼴로. turn은 beginTake의 돌려줌, reviewed는 그 대사의 칸 명세 검수 통과 여부.
export function settleTake(state, { phase, turn, out, reviewed }) {
  const observed = out.status === 'ok' && out.observation.kind !== 'pending';
  if (phase === 'transfer' && observed) state.transferSubmitted = true;
  const independentEligible = turn.independentEligible && !state.transferRevealed && observed;
  return { ...out, take: { attempt: turn.attempt, hinted: turn.hinted, firstUnhintedAttempt: turn.independentEligible, independentEligible },
    trail: trailOf({ phase, status: out.status, transcript: out.transcript, observation: out.observation, independentEligible, reviewed: reviewed === true }) };
}
