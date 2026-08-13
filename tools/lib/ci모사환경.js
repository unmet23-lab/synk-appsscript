'use strict';
/* CI 모사 환경 **한 벌** — tools/test-ci.js 와 .claude/hooks/clasp-guard.js(안전테스트)가
 * 같은 눈금으로 재게 한다 (F389).
 *
 * 왜 (F389 · 2026-08-12 실측): 두 자리가 환경을 각자 조립하자 곧바로 갈라졌다 —
 *   test-ci 는 HOME 을 비워 repo 밖(메모리층) 검사 둘이 skip(초록), clasp-guard 는 실 HOME 으로
 *   같은 스위트를 돌려 그 둘만 적색. 「CI 모사 초록 2895/0」인데 배포가 막혔고, 그 적색은
 *   배포자 트랙 밖(남이 적은 메모리 줄)이라 주인이 자기 적색을 볼 통로도 없었다. 갈라 줄
 *   원격 CI 는 Actions 한도로 job 0건 — 판정층이 통째로 없던 날이다.
 *
 * 🔑 처방은 문구가 아니라 한 벌이다: 지우는 목록(TZ·HOME·USERPROFILE·SYNK_MEMORY_DIR)을
 *   두 곳에 각자 적으면 다음 갈라짐이 예약된다(CLAUDE.md 「같은 판정을 두 곳에 적으면 갈라진다」).
 *   회귀 tests/판정층정합.test.js 가 두 소비자의 요구·사용을 소스로 못박는다.
 *   메모리 위생 검사가 게이트에서 잃는 발동 자리는 rot-check(재질의 절)가 잇는다 —
 *   실물(메모리)이 있는 기계에서 · 고칠 수 있는 사람(세션)에게 · 배포를 막지 않는 층(warn)으로.
 *
 * ⚠ fakeHome 은 「존재하는 빈 디렉터리」라야 한다 — 없는 경로를 HOME 으로 주면 도구가
 *   「경로 오류」로 죽어 CI 와 다른 실패가 난다(test-ci 원 주석 승계). */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function 만들기(baseEnv) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci-home-'));
  const env = { ...(baseEnv || process.env), TZ: 'UTC', HOME: fakeHome, USERPROFILE: fakeHome };
  // 명시 지정이 남아 있으면 홈을 비운 의미가 사라진다(모사가 조용히 무력화된다)
  delete env.SYNK_MEMORY_DIR;
  return {
    env,
    fakeHome,
    치우기() {
      try { fs.rmSync(fakeHome, { recursive: true, force: true }); } catch (_) { /* 윈도우 잠금 — 임시 폴더라 OS 가 마저 치운다 */ }
    },
  };
}

module.exports = { 만들기 };
