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

// Reed 마이크 알림(2026-11-08): 녹음하는 동안 같은 출처의 다른 창(WORLD 셸 · 나란히 띄운 마을)이 효과음 · 진동 · 말소리를 0으로 두게 알린다.
// experiences/brand-opening/world-sound.mjs createMicSignal과 같은 규약의 사본이다 — 공개 빌드가 드라마의 가져오기 셋을 고정 검사하고 brand-opening
// 경로로 바꿔 주지 않아 여기 둔다(가져오기 주소의 ?v= 토큰은 공개 빌드 · 공개 도구가 내용 해시로 붙여, 새 pilot은 늘 새 takes 주소를 부른다). 받는 쪽은 공유 열쇠 synk.world.mic(가장 최근 박동 시각, 15초 지나면 닫힘)만 읽고, 주체마다 synk.world.mic:<주체>를 따로 둬
// 한 창이 끝내도 다른 주체의 녹음 동안에는 공유 열쇠를 남긴다. 주체 열쇠가 없는 옛 판(이 규약 앞의 창)의 박동은 새 판들이 함께
// synk.world.mic:~older 하나에 기억해 주체처럼 센다 — 누가 먼저 끝내도 마지막 새 주체가 옛 창의 녹음을 알고, 옛 판이 끝내며 공유 열쇠를
// 지운 것을 어느 새 주체가 보든 그 기억을 지운다(검수 GB1 · 다시 검수 GA1 · FA1 · 무작위 시험). tests/reed-mic-signal.test.mjs가 두 사본이 같은 저장 결과를 내는지 본다.
export const MIC_KEY = 'synk.world.mic';
export const MIC_STALE_MS = 15000;
const MIC_CHANNEL = 'synk-world-audio', MIC_BEAT_MS = 5000, MIC_OLDER = `${MIC_KEY}:~older`;
let micChannel = null;
function micBus() {
  if (!micChannel && typeof BroadcastChannel === 'function') try { micChannel = new BroadcastChannel(MIC_CHANNEL); } catch { micChannel = null; }
  return micChannel;
}
const micStore = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function createMicSignal({ storage = micStore(), bus = micBus, now = () => Date.now(), every = (fn, ms) => setInterval(fn, ms), stop = (id) => clearInterval(id),
  owner = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` } = {}) {
  const own = `${MIC_KEY}:${owner}`; let timer = 0, open = false;
  const send = (value) => { try { bus()?.postMessage({ type: 'mic', open: value }); } catch {} };
  const owners = () => { const out = []; for (let i = 0; i < (storage?.length || 0); i++) { const k = storage.key(i); if (k?.startsWith(`${MIC_KEY}:`)) out.push(Number(storage.getItem(k))); } return out; };
  // 공유 열쇠의 시각이 15초 안이고 어느 주체 열쇠(~older 포함)에도 없으면 옛 판의 박동이다 — 덮기 전에 함께 기억한다.
  const note = (v, at) => { if (Number.isFinite(v) && at - v < MIC_STALE_MS && !owners().includes(v)) { const k = Number(storage?.getItem(MIC_OLDER)); if (!(Number.isFinite(k) && k >= v)) storage?.setItem(MIC_OLDER, String(v)); } };
  // 공유 열쇠가 비면 옛 판이 끝낸 것이다(새 판은 살아 있는 주체가 있는 동안 지우지 않는다) — 새 주체 누구든 박동 · 끝낼 때 보고 지운다.
  const forget = () => { try { storage?.removeItem(MIC_OLDER); } catch {} };
  const beat = () => {
    const at = now();
    try {
      const raw = storage?.getItem(MIC_KEY);
      if (raw == null) forget(); else note(Number(raw), at);
      storage?.setItem(own, String(at)); storage?.setItem(MIC_KEY, String(at));
    } catch {}
    send(true);
  };
  const close = () => {
    const at = now(); let still = 0;
    try {
      const raw = storage?.getItem(MIC_KEY);
      if (raw == null) forget(); else note(Number(raw), at);   // 내 열쇠를 지우기 전에 본다 — 내 시각은 옛 판 것으로 세지 않는다
      storage?.removeItem(own);
      for (const v of owners()) if (Number.isFinite(v) && at - v < MIC_STALE_MS) still = Math.max(still, v);
      if (still) storage?.setItem(MIC_KEY, String(still)); else storage?.removeItem(MIC_KEY);
    } catch {}
    send(still > 0);
  };
  return Object.freeze({ set(next) { next = Boolean(next); if (timer) { stop(timer); timer = 0; } if (next) { beat(); timer = every(beat, MIC_BEAT_MS); } else if (open) close(); open = next; }, open: () => open });
}
