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

/* ── 플랫폼 축 — 모사가 **못 지우는** 차이 (마찰 F620 · 2026-08-18) ──────────────────
 *
 * ■ 실사고: 리눅스 클라우드 세션이 `test-ci` 를 돌리자 fail 3 이 났다. 셋 다 윈도우에서는
 *   **초록**이던 것이다(바탕화면 없음 · 로컬 워크트리만 셈 · `path.resolve` 가 윈도우 경로
 *   픽스처를 이 기계 문법으로 뭉갬). 원격 Actions 는 0건(소진)이라 여태 아무도 안 쟀다.
 *
 * ■ 🔴 왜 원인이 도구에 있나: `test-ci` 는 지우는 축을 **①시간대 ②홈** 둘로 못박아 놓고
 *   「여기서 초록이면 CI 도 초록이다」라고 **단언**했다. 플랫폼은 그 목록에 없다 — 즉 **재지 않은
 *   축에 대한 주장**이고, 윈도우 세션에게는 그 문장이 거짓 보증이었다. F474·F608 과 같은 병이며
 *   새는 방향은 언제나 「통과」다(초록은 분모와 함께만 읽는다 · CLAUDE.md 신뢰성).
 *
 * ■ 그래서 여기서 **분모의 세 번째 축**을 낸다. 지울 수는 없다(OS 는 못 갈아끼운다) —
 *   지울 수 없으면 **이름 대고 말하는 것**이 유일하게 정직한 처방이다. */

/** `runs-on:` 값 → node 의 `process.platform` 어휘. 모르면 `null`(추측하지 않는다). */
function 러너판(값) {
  const s = String(값 || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  if (/\$\{\{/.test(s) || !s) return null;          // 표현식 — 이 층에서는 못 푼다
  if (s.startsWith('ubuntu')) return 'linux';
  if (s.startsWith('windows')) return 'win32';
  if (s.startsWith('macos') || s.startsWith('mac-')) return 'darwin';
  return null;                                       // self-hosted·처음 보는 라벨
}

/**
 * CI 가 **실제로 도는 판** — 워크플로에서 읽는다(손으로 적으면 갈라진다 · 목록은 하나에서 파생).
 *
 * 반환 `{판, 라벨들, 파일수}` · 판 = `'linux'` 처럼 유일하면 그 값, 갈리거나 못 읽으면 `null`.
 * ⚠ `판: null` 은 「같다」도 「다르다」도 아니다 — **모른다**다. 부르는 쪽이 그 셋을 섞으면
 *   이 축을 세운 의미가 사라진다(모름을 값으로 접는 것이 F620 이 난 자리와 같은 병이다).
 */
function CI판(root) {
  const dir = path.join(root || path.resolve(__dirname, '..', '..'), '.github', 'workflows');
  let 파일들;
  try {
    파일들 = fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f));
  } catch (_) { return { 판: null, 라벨들: [], 파일수: 0, 사유: `워크플로 폴더를 못 읽었다: ${dir}` }; }
  if (!파일들.length) return { 판: null, 라벨들: [], 파일수: 0, 사유: '워크플로 파일이 0건이다' };

  const 라벨들 = [];
  for (const f of 파일들) {
    let 원문;
    try { 원문 = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (_) { continue; }
    for (const m of 원문.matchAll(/^\s*runs-on:\s*(.+)$/gm)) 라벨들.push(m[1].trim());
  }
  if (!라벨들.length) return { 판: null, 라벨들: [], 파일수: 파일들.length, 사유: '`runs-on:` 을 한 줄도 못 찾았다' };

  const 판들 = [...new Set(라벨들.map(러너판))];
  if (판들.length === 1 && 판들[0]) return { 판: 판들[0], 라벨들: [...new Set(라벨들)], 파일수: 파일들.length };
  return {
    판: null,
    라벨들: [...new Set(라벨들)],
    파일수: 파일들.length,
    사유: 판들.includes(null) ? '못 읽는 러너 라벨이 섞였다' : '워크플로마다 OS 가 다르다',
  };
}

/**
 * 「이 판이 CI 판을 예측하는가」를 **글자로** 낸다 — 초록 옆에 붙는 분모 한 줄.
 * 세 갈래를 **다르게** 낸다: 같다 / 다르다 / 모른다. 셋이 같은 문장이면 이 축은 없는 것과 같다.
 */
function 플랫폼줄(내판, ci) {
  const 나 = String(내판 || process.platform);
  if (!ci || !ci.판) {
    const 라 = ci && ci.라벨들 && ci.라벨들.length ? ` (본 라벨: ${ci.라벨들.join(' · ')})` : '';
    return `   ⚠ 이 판은 **${나}** 인데 **CI 가 어느 판인지 못 읽었다**${라} — ${(ci && ci.사유) || '사유 미상'}.\n`
      + '      이 초록이 CI 판을 예측하는지 **모른다**(「같다」로 접지 않는다 · F620).\n';
  }
  if (ci.판 === 나) return `   · 플랫폼은 CI 와 **같다**(${나}) — 이 축은 이 판에서 실제로 재졌다.\n`;
  return `   🔴 이 판은 **${나}** 이고 **CI 는 ${ci.판}** 이다(${ci.라벨들.join(' · ')}) — 플랫폼 의존 실패는\n`
    + '      여기서 **원리상 안 보인다**. F620 실측: 리눅스에서만 나는 적색 3건이 윈도우에선 전부 초록이었다\n'
    + `      (바탕화면 없음 · 로컬 워크트리만 셈 · \`path.resolve\` 가 픽스처를 이 기계 문법으로 뭉갬).\n`
    + `      ⇒ ${ci.판} 판을 재는 층이 따로 필요하다: 클라우드 세션의 \`test-ci\` 또는 원격 run.\n`;
}

module.exports = { 만들기, 러너판, CI판, 플랫폼줄 };
