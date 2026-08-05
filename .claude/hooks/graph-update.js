#!/usr/bin/env node
// graph-update — 코드 지식 그래프를 편집 직후 증분 갱신한다 (PostToolUse · Edit|Write)
//
// 왜 있나 (2026-08-05 · code-review-graph 도입):
//   그래프는 「어떤 파일을 읽어야 하는가」를 답하는 지도다. 낡은 지도는 없는 지도보다 나쁘다 —
//   지운 함수를 살아있다고, 새 호출을 없다고 답하면 그건 오답이 아니라 **확신에 찬 오답**이다.
//   그래서 편집이 끝나는 자리에서 바로 따라 붙인다(실측 ~1.5초 · `--skip-flows`).
//
// 🔑 GIT_CONFIG_* 3줄이 이 훅의 핵심이다 — 지우면 조용히 69%가 사라진다:
//   code-review-graph 는 파일 목록을 `git ls-files` 로 받는데(incremental.py:701)
//   `core.quotepath` 방어 없이 부른다. git 기본값은 비ASCII 경로를 "\352\265\220..." 로
//   따옴표+8진 이스케이프해서 내보내고, 그 문자열을 그대로 경로로 쓰니 파일이 없어
//   **오류 없이 스킵**된다. 2026-08-05 실측 — 방어 전 49/160 파일(한글 파일명 110개 중 **0개**:
//   상담AI.js·엔진_두뇌.js·엔진_수집.js 등 SYNK 핵심 전부) → 방어 후 158/160.
//   같은 패키지의 changes.py:231 에는 `core.quotepath=off` 가 있다. 빌드 경로에만 빠진 구멍이다.
//   ⚠ repo 의 core.quotepath 를 바꾸지 않는다 — `git status` 출력을 파싱하는 SYNK 도구들
//     (작업본소유자·board-move 등)이 함께 흔들린다. 그래서 **이 프로세스에만** 주입한다.
//
// ⚠ 절대 차단하지 않는다(가드가 아니라 인덱스다). 다만 **조용히 통과하지도 않는다** —
//   갱신에 실패하면 stderr 로 드러낸다. 통과와 미실행이 같은 모양이면 안 된다(F044 계열).
'use strict';
const { execFileSync } = require('child_process');

// 훅 입력은 쓰지 않지만, 읽지 않으면 파이프가 막힌다.
try { require('fs').readFileSync(0, 'utf8'); } catch (_) { /* stdin 없음 */ }

const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// uvx = uv 에 딸린 실행기. PATH 에 있으면 code-review-graph 를 알아서 해석한다
// (절대경로 대신 이것을 쓰는 이유 = 다른 기계에서도 사는 등록층 · F044①).
try {
  execFileSync(process.platform === 'win32' ? 'where' : 'which', ['uvx'], { stdio: 'ignore' });
} catch (_) {
  console.error('코드그래프 갱신 건너뜀: uvx 를 못 찾았다 — 그래프가 낡는다(F044)');
  process.exit(0);
}

try {
  execFileSync('uvx', ['code-review-graph', 'update', '--skip-flows', '--repo', repo], {
    stdio: 'ignore',
    timeout: 25_000,
    env: {
      ...process.env,
      PYTHONUTF8: '1',              // 한글 경로·소스를 UTF-8 로 (Windows 기본은 cp949)
      GIT_CONFIG_COUNT: '1',        // ↓ 위 🔑 주석 참조. 이 3줄이 커버리지 49 → 158 을 가른다.
      GIT_CONFIG_KEY_0: 'core.quotepath',
      GIT_CONFIG_VALUE_0: 'false',
    },
  });
} catch (err) {
  console.error(`코드그래프 갱신 실패 — 그래프가 낡았다(재빌드: uvx code-review-graph build): ${err.message}`);
}
process.exit(0);
