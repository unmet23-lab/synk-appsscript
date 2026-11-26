// 새 길 문 확인(5-3 게임) — 게임 앱이 키트를 싣기 전에 「새 길을 열 차례인가」만 본다. 키트(kit/atlas-next.mjs)의
// nextDoor(win) || devFlag(win)와 같은 조건이다(kit.test.mjs가 여러 창으로 견준다).
// 앱은 아래 함수를 글자 그대로 옮겨 적고 키트를 정적으로 부르지 않는다(kit.test.mjs가 글자를 견준다). 키트를 정적으로 부르면 키트를
// 못 받을 때(404 · 응답 없음 · 깨진 글) 모듈 전체가 서지 않아, 키트를 쓰지 않는 꺼진 판 게임도 열리지 않는다. 키트는 새 길 모듈이 부른다.
export function atlasGate(win) {
  for (const up of [win?.parent, win?.top]) {
    if (!up || up === win) continue;
    try {
      if (up.SYNKAtlasGame && typeof up.SYNKAtlasGame.open === 'function') return true;
    } catch {
      // 다른 출처 — 문이 없다
    }
  }
  try {
    if (!/^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(win.location.hostname)) return false;
    if (new URLSearchParams(win.location.search).get('atlas') !== 'next') return false;
    return !(win.parent && win.parent !== win && win.parent.SYNKLearningHost);
  } catch {
    return false;
  }
}
