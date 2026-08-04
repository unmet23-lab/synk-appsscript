// context-size — 지금 컨텍스트가 얼마인지 재는 **유일한 통로** (context-budget · track-boundary 공용)
//
// 왜 모아 뒀나 — 이 값을 읽는 훅이 둘이 됐다. 트랜스크립트를 뒤지는 규칙이 각 훅에 흩어지면
//   **한 곳만 고쳐도 조용히 갈라진다.** CLAUDE.md 「훅 안에서도 같은 판정을 두 곳에 적으면
//   갈라진다 — 목록은 하나에서 파생시킨다」(가드 등록층 ④)의 적용. 실측 전례가 있다:
//   액션 판정은 `scroll` 을 아는데 도구 이름 판정은 몰라 단건 도구가 두 층 다 통과했다(F063).
//
// ⚠ 바이트 수로 추정하지 않는다 — 시스템 프롬프트·도구 스키마가 안 잡혀 **실제의 절반**이 나온다
//   (08-04 실측 1회 오답). `usage` 를 읽는 것만이 실측이다.
'use strict';
const fs = require('fs');

// 08-04 실측 바닥값 = 이 저장소 세션의 첫 API 호출 컨텍스트.
// 시스템 프롬프트 + 도구 스키마 + CLAUDE.md + MEMORY.md 로 구성되며 **컴팩트해도 안 내려간다.**
// 독립 확인 2회: 21세션 중앙값 69,561 · 134세션 중앙값 68,420.
// 「새 창을 열면 여기서 시작한다」의 근거값이라 두 훅이 같은 수를 봐야 한다.
const FLOOR = 68_500;

/**
 * 트랜스크립트에서 **마지막** usage 를 찾아 `{ tokens, model }` 을 낸다. 못 찾으면 null.
 *
 * 모델을 같이 돌려주는 이유 = 창 크기가 모델마다 다르기 때문(F058).
 * **같은 줄에서 뽑는다** — 따로 찾으면 토큰과 모델이 다른 턴 것이 섞인다.
 *
 * 세 값을 더하는 이유: 실제로 청구되는 컨텍스트 = 순입력 + 캐시읽기 + 캐시생성.
 * 컴팩트가 일어나면 이 값은 자동으로 내려간다(그래서 단계 카운터도 따라 내려야 한다).
 */
function currentContext(file) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch (_) { return null; }
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l || l.indexOf('"usage"') === -1) continue; // 파싱 비용 절약 — 매 턴 도는 훅이다
    let o;
    try { o = JSON.parse(l); } catch (_) { continue; }
    const u = o && o.message && o.message.usage;
    if (!u) continue;
    const n =
      (Number(u.input_tokens) || 0) +
      (Number(u.cache_read_input_tokens) || 0) +
      (Number(u.cache_creation_input_tokens) || 0);
    if (n > 0) return { tokens: n, model: String((o.message && o.message.model) || '') };
  }
  return null;
}

module.exports = { currentContext, FLOOR };
