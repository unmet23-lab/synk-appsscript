// 차례 — 파생 기록을 쓰는 일 하나 동안만 쥐었다 놓는 저장소 자물쇠(단계 4 계획 §18-5-1, 설계 §5-4 「탭과 틀」).
//   차례는 겹쳐 하는 일을 줄일 뿐 맞음의 조건이 아니다 — 차례 규칙(newer · readKey · 읽은 데까지만 지우기)이 정본이다. 그래서
//   ⓐ 사건 덧붙이기는 차례를 기다리지 않고 ⓑ 넘겨받는 상태가 없으며(차례를 얻으면 꼬리부터 다시 읽는다) ⓒ 차례를 한 번도 못 얻은
//   탭도 제 보기가 맞고 ⓓ 차례가 없거나 못 얻어도 맞다. 못 얻는 일이 이어지면 올리기 · 받기 · 캐시 저장은 차례 없이 가고, 지우는 일과
//   사람에게 물어 옮기는 일은 차례를 얻었을 때만 한다.
//   차례를 쥐는 겹은 호스트 하나다(R1) — 기록부에는 같은 함수를 exclusive로 주고, 일을 하는 동안 기록부의 「차례 안」 표시를 켠다.
//   Web Locks는 다시 들어갈 수 없다 — 차례 안에서 또 청하면 그 저장소의 일이 모두 멈춘다(s8).
// 일마다 한도(wait) · 못 얻었을 때(miss) · 못 얻는 일이 이어질 때(streak — 3번 또는 60초) — 계획 §18-5-1 R2 표.
//   miss 'skip': 이번은 쉰다(TURN_BUSY로 거절 — 부른 쪽이 건너뛴다) · 'free': 차례 없이 한다(꼬리부터 읽는 것은 일 쪽이 한다)
//   streak 'free': 이어지면 차례 없이 · 'skip': 이어져도 쉰다
export const TURN_JOBS = Object.freeze({
  upload: { wait: 15_000, miss: 'skip', streak: 'free' }, // 요청 한도(12초)보다 길게 — 느린 망에서 멀쩡한 탭이 쥔 동안 POST가 두 배가 되지 않게
  get: { wait: 15_000, miss: 'skip', streak: 'free' },
  summary: { wait: 1_000, miss: 'skip', streak: 'free' }, // 손님 요약 저장 — 계산은 이미 했다
  compact: { wait: 1_000, miss: 'skip', streak: 'skip' }, // 치우기 — 다음 날
  legacy: { wait: 4_000, miss: 'free', streak: 'free' }, // 옛 기록 옮기기 — coach.ready가 기다리는 일
  move: { wait: 10_000, miss: 'skip', streak: 'skip' }, // 손님 → 계정 옮기기 — 「옮기지 못했어요 · 다시」
});
export const STREAK_COUNT = 3;
export const STREAK_MS = 60_000;

export const turnBusy = job =>
  Object.assign(new Error(`Atlas turn: 차례를 얻지 못했다(${job})`), { code: 'TURN_BUSY', job });

// locks: navigator.locks 꼴({ request(name, { signal }, callback) }) — 없으면 모든 일을 차례 규칙만으로 한다.
// enter · leave: 일을 시작하고 끝낼 때(기록부의 「차례 안」 표시). now: 이어진 못 얻음의 60초를 잰다.
export function createTurn({
  name,
  locks = null,
  enter = () => {},
  leave = () => {},
  now = () => Date.now(),
  jobs = TURN_JOBS,
}) {
  const state = { closed: false, misses: new Map(), waiting: new Set() };

  async function inside(work) {
    enter();
    try {
      return await work();
    } finally {
      leave();
    }
  }

  const streaking = job => {
    const miss = state.misses.get(job);
    return Boolean(miss) && (miss.count >= STREAK_COUNT || now() - miss.since >= STREAK_MS);
  };

  function missed(job) {
    const miss = state.misses.get(job) ?? { count: 0, since: now() };
    miss.count += 1;
    state.misses.set(job, miss);
  }

  // 한도 안에 차례를 얻으면 그 안에서 일을 한다. 못 얻으면(한도 · 거절된 청하기 — 막힌 문맥의 SecurityError) 그 일의 표대로.
  async function request(job, work, rule) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), rule.wait);
    timer.unref?.();
    state.waiting.add(controller);
    let granted = false;
    try {
      return await locks.request(name, { signal: controller.signal }, () => {
        granted = true;
        clearTimeout(timer);
        state.waiting.delete(controller);
        state.misses.delete(job);
        return inside(work);
      });
    } catch (error) {
      if (granted) throw error; // 일 자신의 오류
      if (state.closed) throw turnBusy(job);
      missed(job);
      if (rule.miss === 'free') return inside(work);
      throw turnBusy(job);
    } finally {
      clearTimeout(timer);
      state.waiting.delete(controller);
    }
  }

  // 못 얻는 일이 이어진 뒤 — 비어 있으면 쥐고(이어짐이 끝난다), 아니면 기다리지 않고 차례 없이 한다(쥔 채 멈춘 탭이 모두를 막지 않게).
  async function freely(job, work) {
    let ran = false;
    try {
      return await locks.request(name, { ifAvailable: true }, lock => {
        ran = true;
        if (state.closed) throw turnBusy(job); // 청하는 사이 닫혔다 — 닫힌 호스트에서 일하지 않는다(카본 끝 판 D)
        if (lock) state.misses.delete(job);
        return inside(work);
      });
    } catch (error) {
      if (ran) throw error; // 일 자신의 오류
      if (state.closed) throw turnBusy(job);
      return inside(work); // 청하기 자체가 거절됐다(SecurityError) — 차례 없이
    }
  }

  function turn(job, work) {
    const rule = jobs[job];
    if (!rule) throw new TypeError(`Atlas turn: 모르는 일 ${job}`);
    if (state.closed) return Promise.reject(turnBusy(job));
    if (typeof locks?.request !== 'function') return inside(work); // 차례가 없는 브라우저 — 차례 규칙만으로(ⓓ)
    if (rule.streak === 'free' && streaking(job)) return freely(job, work);
    return request(job, work, rule);
  }

  // 호스트를 닫을 때 기다리던 청하기를 거둔다.
  turn.close = () => {
    state.closed = true;
    for (const controller of state.waiting) controller.abort();
    state.waiting.clear();
  };
  turn.misses = job => state.misses.get(job)?.count ?? 0;
  return turn;
}
