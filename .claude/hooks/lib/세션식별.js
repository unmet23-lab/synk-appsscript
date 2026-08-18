/* 세션식별 — 「지금 이 프로세스는 **어느 세션인가**」를 정하는 한 곳 (마찰 F633).
 *
 * 왜 있나 (2026-08-18 실측 · 클라우드 컨테이너 `cse_014P5Hsr7yE5p9pdLqwj6X9x`):
 *   **쓰는 층과 읽는 층이 서로 다른 질문을 하고 있었다.**
 *   · 쓰는 층(`handoff-store.trackSessionId` · `track-collision:79`)은 이미 폴백이 있었다 —
 *     `HOST || input.session_id`. 그래서 심장박동·만진기록은 클라우드에서도 쌓였다.
 *   · 읽는 층 14곳은 `process.env.CLAUDE_CODE_HOST_SESSION_ID` **하나만** 읽었다.
 *     클라우드엔 그 변수가 아예 없어서 전부 `''` 로 떨어졌고, 새는 방향은 전부 「통과」였다:
 *       - `board-guard:607` 내지문 `''` → `생사쟀나` 영구 false → 검사 ⑧(살아있는 남의 트랙과
 *         겹침)이 deny 대신 경고로 내려앉는다.
 *       - `작업본소유자:65` 나지금 `''` → `살았나` 의 **자기면제 절이 꺼진다**(F264 실사고가
 *         클라우드 세션 전부에 상시 재장전된다).
 *       - `대기열:1087` → 「세션 지문을 못 읽었다」 하드 에러. 처방이 「그 변수를 채워라」인데
 *         채울 수 없다 — 따를 수 없는 처방이다(F103).
 *       - `repo-staleness:224` · `git-scope-guard:890` → 상태 파일 키가 리터럴 `nosid` 로 뭉친다.
 *       - `bump-version:193` · `friction:320` 락 주인 = `unknown/<pid>`.
 *   · 왜 갈렸나 = **공용 통로가 훅 전용이었다.** `trackSessionId(input)` 이 그 통로인데 인자로
 *     훅 stdin 을 요구한다. 훅이 아닌 도구엔 그 `input` 이 없어 부를 수가 없었고, 그래서 14곳이
 *     각자 `process.env` 를 직접 읽는 옛 통로로 남았다. 「호출부마다 따로 적었다」가 아니라
 *     **「공용 통로에 도구가 못 들어갔다」** 다 — 그래서 통로를 넓히는 것이 수리다.
 *
 * 🔑 **id 가 하나가 아니다.** 한 함수로 뭉치면 어느 한쪽이 반드시 틀린다 —
 *   그래서 «무엇에 쓰는 값인가»로 갈라 두고, 부르는 쪽이 자리를 골라 부른다.
 *
 *     ① `연락id()`  — 이 값을 들고 그 세션에 **말을 걸 수 있어야** 하는 자리
 *                     (커밋 트레일러 · `list_sessions`/`send_message`).
 *                     HOST → REMOTE. ⚠ `CLAUDE_CODE_SESSION_ID` 로는 **안 내려간다** —
 *                     그건 메시지를 못 보내는 내부 id 라, 거기까지 폴백하면 이 값의 뜻이
 *                     「연락 가능한 id」에서 「그냥 구분자」로 내려앉는다(F628 훅 주석과 같은 판단).
 *     ② `자리id()`  — 상태 파일 키 · 보드 파일명 · 「내 줄인가」. **쓰는 층과 같아야 하는 값**이라
 *                     쓰는 층의 순서를 그대로 물려받고(`HOST || input.session_id`) 그 뒤에
 *                     env 폴백을 한 칸 더 둔다. 도구는 훅 stdin 이 없으므로 그 칸이 없으면
 *                     클라우드에서 통째로 빈다.
 *     ③ `지문()`    — 보드 8자리. `docs/_ops/보드/<지문>.md` 와 `board-id.파일지문()` 이
 *                     **hex 를 요구**하므로 hex 가 아니면 `''`(=모름)로 떨어뜨린다(아래 ⚠).
 *     ④ `표기id()`  — 기록·락 주인처럼 «세션마다 달라야 하지만 연락 가능성은 필수가 아닌» 자리.
 *
 * ⚠ **REMOTE 를 보드 지문으로 쓰면 안 된다 — 실측으로 갈랐다.**
 *   `board-id.지문('cse_014P5Hsr7yE5p9pdLqwj6X9x')` = `'014p5hsr'` 인데 이건 hex 가 아니다.
 *   그래서 소비자가 전부 거부한다: `파일지문('014p5hsr.md')` = `''`(주인 없음) ·
 *   `줄의지문(줄)` = `[]` · `줄이말하나()` = `false`. F628 훅 주석의 「보드 지문은 어느 쪽이든
 *   같다 — 접두를 벗긴다」는 `지문()` **한 함수에 대해서만** 참이고, 그 값을 받는 쪽이 hex 를
 *   요구한다는 것은 거기 안 적혀 있다. 반면 `CLAUDE_CODE_SESSION_ID` 는 UUID 라 앞 8자가 hex 고
 *   (`e54f1033`), **쓰는 층이 이미 그 값으로 키를 만든다** — 그래서 ② 의 폴백은 그쪽이다.
 *
 * ⚠ **hex 가 아니면 `''` 다** — 「모름」이지 「내 것」이 아니다. 부르는 쪽이 `''` 끼리 `===` 로
 *   비교하면 주인 없는 것이 통째로 내 것이 된다(board-id 머리 ⚠ 와 같은 함정). 그래서
 *   `진단()` 이 «어느 층이 답했나»를 함께 낸다 — 초록은 분모와 함께만 읽는다(F207).
 *
 * ⛔ 옛 통로 금지: 이 파일 **밖**에서 `process.env.CLAUDE_CODE_HOST_SESSION_ID` 를 직접 읽으면
 *   `tests/세션식별.test.js` 가 fail 로 잡는다. 잘못 쓸 수 없는 통로 + 옛 통로를 테스트로 금지 —
 *   CLAUDE.md 신뢰성 「3번째 = 원인을 쓸 수 없게 만든다」.
 *   면제는 두 곳뿐이다: 이 파일 자신과 `tools/githooks/prepare-commit-msg`(셸 · 폴백 자체가 그 훅의
 *   본문이고 node 를 못 부른다).
 */
'use strict';

const path = require('path');
const 보드id = require(path.join(__dirname, 'board-id.js'));

/** 보드 파일명·`board-id.파일지문()` 이 요구하는 모양. 여기 하나에만 적는다. */
const HEX8 = /^[0-9a-f]{8}$/;

function 값(env, 이름) {
  return String((env && env[이름]) || '').trim();
}

/** ① 말을 걸 수 있어야 하는 자리의 id — HOST → REMOTE. 없으면 `''`. */
function 연락id(env = process.env) {
  return 값(env, 'CLAUDE_CODE_HOST_SESSION_ID') || 값(env, 'CLAUDE_CODE_REMOTE_SESSION_ID');
}

/** ② 자리 식별 id — 상태 파일 키·보드 파일명. 쓰는 층(`HOST || input.session_id`)을 그대로
 *  물려받고 env 폴백을 한 칸 더 둔다(도구엔 훅 stdin 이 없다). */
function 자리id(env = process.env, input = null) {
  return 값(env, 'CLAUDE_CODE_HOST_SESSION_ID')
    || String((input && input.session_id) || '').trim()
    || 값(env, 'CLAUDE_CODE_SESSION_ID');
}

/** ③ 보드 지문 8자리 — hex 가 아니면 `''`(모름). */
function 지문(env = process.env, input = null) {
  const f = 보드id.지문(자리id(env, input));
  return HEX8.test(f) ? f : '';
}

/** ④ 기록·락 주인 표기 — 연락 가능하면 그것을, 아니면 자리 id 를. */
function 표기id(env = process.env, input = null) {
  return 연락id(env) || 자리id(env, input);
}

/** ⑤ 분모 — 어느 층이 답했고 무엇이 비었나. 보고문에 그대로 실을 수 있게 문자열도 준다. */
function 진단(env = process.env, input = null) {
  const 층 = 값(env, 'CLAUDE_CODE_HOST_SESSION_ID') ? 'HOST'
    : (input && input.session_id) ? '훅stdin'
      : 값(env, 'CLAUDE_CODE_SESSION_ID') ? 'CLAUDE_CODE_SESSION_ID'
        : '없음';
  const 연락층 = 값(env, 'CLAUDE_CODE_HOST_SESSION_ID') ? 'HOST'
    : 값(env, 'CLAUDE_CODE_REMOTE_SESSION_ID') ? 'REMOTE' : '없음';
  const f = 보드id.지문(자리id(env, input));
  return {
    연락id: 연락id(env),
    자리id: 자리id(env, input),
    지문: HEX8.test(f) ? f : '',
    층,
    연락층,
    /* 지문이 왜 비었나 — 「안 재봤다」와 「재봤는데 못 쓴다」를 가른다. */
    지문사유: HEX8.test(f) ? '' : (f ? `hex 가 아니다(${f})` : '자리 id 가 없다'),
    한줄: `자리=${층} · 연락=${연락층} · 지문=${HEX8.test(f) ? f : '(모름)'}`,
  };
}

/** 이 통로가 읽는 환경변수 **전부**. 목록을 여기 하나에 둔다 — 「모름」을 만들어야 하는 쪽
 *  (회귀·격리 실행)이 자기 목록을 따로 적으면, 소스가 하나 늘 때 그 목록만 낡아
 *  **주변 환경이 답을 흘려 넣는다.** 실측 2026-08-18: 이 폴백을 넣자 HOST 만 비우던 회귀
 *  7건이 러너의 `CLAUDE_CODE_SESSION_ID` 를 주워 깨졌다(CI 에선 없어서 통과 — F296 그 자리다). */
const 환경변수들 = Object.freeze([
  'CLAUDE_CODE_HOST_SESSION_ID',
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_CODE_SESSION_ID',
]);

/** 「어떤 세션도 아니다」인 env 사본 — 위 목록 전부를 비운다. */
function 모름env(base = process.env) {
  const e = { ...base };
  for (const k of 환경변수들) e[k] = '';
  return e;
}

module.exports = { 연락id, 자리id, 지문, 표기id, 진단, HEX8, 환경변수들, 모름env };
