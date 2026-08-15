'use strict';
/* 회귀가 쓰는 심장박동·상태 파일을 **이 시험 전용 폴더**로 격리한다 — 공용 통로 하나.
 *
 * ■ 무엇이 문제였나 (실측 2026-08-15 · 세션 376f6598)
 *   `handoff-store` 의 STATE_DIR 기본값은 `os.tmpdir()/synk-context-budget` 이고, 그 폴더는
 *   **이 머신에서 도는 모든 세션의 훅이 공유한다.** 픽스처가 거기에 `track-*.json` 을 쓰면
 *   두 방향으로 샌다 — 그리고 **새는 방향은 둘 다 「통과」다**:
 *     ① 남이 내 픽스처를 지운다 — `sweep()` 규칙이 `if (!j.at || 나이>ttl) unlink` 라
 *        `at` 없는 박동은 **나이와 무관하게 즉시** 사라진다. 그러면 「주인이 살아 있으면
 *        기다린다」를 재는 시험이 「죽었다」를 보고 빨개진다. 세션이 여럿 도는 시간대에만
 *        나므로 **거짓 적색과 진짜 적색이 같은 모양**이 된다(test-ci 자신의 규율 위반).
 *     ② 내 픽스처가 남의 실물 상태에 섞인다 — 가짜 세션이 살아 있는 것처럼 보이고,
 *        그 순간 옆 세션의 board-guard·작업본소유자가 없는 세션을 피해 비켜난다.
 *
 *   기전은 2026-08-11 에 이미 적혀 있었다(`tests/이종검수.test.js` — 「표식은 남이 청소하는
 *   폴더에 두지 않는다」). 그 파일은 자기 표식을 옮겨 스스로를 지켰지만, **박동을 쓰는
 *   회귀 3벌은 그대로 남아** 같은 자리를 계속 밟았다. 그래서 판정을 파일마다 베끼지 않고
 *   여기 한 벌로 둔다 — 같은 판정을 세 곳에 적으면 갈라지고, 갈라진 쪽은 조용히 통과한다.
 *
 * ■ 왜 `at` 을 채우는 것으로 안 고치나
 *   그러면 ①만 막고 ②는 그대로다(픽스처가 여전히 공유 폴더에 산다). 그리고 `at` 은
 *   `sweep` 의 **현재** 규칙이라, 규칙이 바뀌는 날 이 회귀들이 다시 조용히 샌다.
 *
 * ■ 왜 «store 를 돌려주는» 모양인가 (잘못 쓸 수 없는 통로)
 *   STATE_DIR 은 `handoff-store` 의 **모듈 최상위 const** 라 require 시점에 굳는다. env 를
 *   require «뒤»에 세우면 조용히 옛 좌표를 쓰고, 증상은 역시 「통과」뿐이다. 그래서 env 를
 *   세우는 일과 require 를 한 함수 안에 묶어 **순서를 틀릴 수 없게** 만든다.
 *   (CLAUDE.md 신뢰성: 3번째부터는 호출부마다 고치는 대신 원인을 쓸 수 없게 만든다.)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STORE = path.join(__dirname, '..', '..', '.claude', 'hooks', 'lib', 'handoff-store.js');

/** 이 시험 전용 STATE_DIR 을 세우고, 그 좌표로 굳은 `handoff-store` 를 돌려준다.
 *  자식 프로세스는 `...process.env` 를 퍼뜨리는 기존 통로로 그대로 물려받는다.
 *  @param {string} 이름 보통 `__filename` — 폴더 이름에 섞어 어느 시험 것인지 보이게 한다. */
function 격리된store(이름) {
  const 꼬리 = path.basename(String(이름 || 'test'), '.js').replace(/[^A-Za-z0-9_-]/g, '') || 'test';
  /* 이미 격리돼 있으면 그대로 쓴다 — 한 파일에서 두 번 불러도 좌표가 갈리면 안 된다
   * (박동을 쓴 쪽과 읽는 쪽이 다른 폴더를 보면 그 시험은 영원히 「죽었다」를 본다). */
  if (!process.env.SYNK_CTXBUDGET_DIR) {
    process.env.SYNK_CTXBUDGET_DIR = fs.mkdtempSync(path.join(os.tmpdir(), `state-${꼬리}-`));
  }
  /* 🔴 require 는 env 를 세운 **뒤**에만 온다 — 이 순서가 이 파일의 존재 이유다.
   *   이미 require 캐시에 있으면 STATE_DIR 은 이미 굳었으니, 그 사실을 숨기지 않고 던진다. */
  const 굳었나 = Boolean(require.cache[require.resolve(STORE)]);
  const store = require(STORE);
  if (굳었나 && path.resolve(store.stateDir()) !== path.resolve(process.env.SYNK_CTXBUDGET_DIR)) {
    throw new Error(
      '[상태격리] handoff-store 가 이 호출보다 **먼저** require 돼 STATE_DIR 이 이미 굳었다 — '
      + `지금 좌표 ${store.stateDir()}. 격리된store(__filename) 를 그 require 앞으로 옮겨라.`,
    );
  }
  return store;
}

module.exports = { 격리된store };
