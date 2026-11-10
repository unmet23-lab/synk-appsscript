// 기기 시계(설계 §5-4 「기기 시계」) — 지금 game-learning.js의 단조 시계를 잇는다.
//   ① 한 기기의 사건 시각은 늘 앞 사건보다 뒤다(같으면 1밀리초 뒤로).
//   ② 서버의 답에 실려 오는 서버 시각과의 차이(offsetMs)를 더해 찍는다 — 서버가 시각을 누르는 일은 한 번도 서버에 닿지 못한 채
//      시계가 앞선 기기에서만 생긴다.
//   ③ 이 기기가 아는 다른 사건(요약 줄의 가장 늦은 사건 시각)보다도 뒤로 — 그래야 방금 다른 기기가 답한 단위에 내 답을 얹을 수 있다.
//      다만 내 시계보다 5분 넘게 앞선 시각은 따라가지 않는다(다른 기기의 틀린 시계에 끌려가지 않게).
export const AHEAD_MS = 5 * 60_000;

export function createClock({
  now = () => Date.now(),
  offsetMs = 0,
  lastAt = 0,
  knownLatest = 0,
} = {}) {
  let offset = offsetMs;
  let last = lastAt;
  let known = knownLatest;
  return {
    next() {
      const base = Math.round(now() + offset);
      const follow = known <= base + AHEAD_MS ? known + 1 : Number.NEGATIVE_INFINITY;
      last = Math.max(base, last + 1, follow);
      return last;
    },
    // 서버 시각을 받았다 — 내 시계와의 차이를 고쳐 둔다(왕복 시간의 반은 무시한다: 밀리초 몇백의 어림).
    sync(serverMs, localMs = now()) {
      if (Number.isFinite(serverMs)) offset = serverMs - localMs;
      return offset;
    },
    know(latest) {
      if (Number.isFinite(latest)) known = Math.max(known, latest);
    },
    get offsetMs() {
      return offset;
    },
    get lastAt() {
      return last;
    },
  };
}
