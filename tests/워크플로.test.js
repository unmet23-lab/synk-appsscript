/* 워크플로 모양 회귀 — `.github/workflows/syntax-check.yml` 이 지켜야 하는 것들 (2026-08-18).
 *
 * 왜 이 파일이 생겼나 — 원격 CI 를 셀프호스티드로 되살리면서 **분을 태우는 자리**와
 *   **검사 0건을 초록으로 만드는 자리**가 둘 다 이 한 파일에 모였다. 그런데 이 파일의 모양을
 *   재는 회귀는 그때까지 **0건**이었다(언급만 주석에 있었다).
 *
 * 🔑 파서를 안 쓰고 **원문**을 본다 — 이 파일에서 가장 흔한 사고가 「주석 처리」이고(옛 `# push:`),
 *   파싱하면 주석이 사라져 「그 줄이 없다」와 「죽어 있다」가 같은 모양이 된다.
 *
 * ⚠ 이 스위트가 재지 «못»하는 것: 실제로 run 이 뜨는지, 스위치 변수가 켜졌는지.
 *   둘 다 GitHub 쪽 상태라 저장소 파일로는 원리상 못 본다 — `tools/환경눈.js` 의 「원격 CI」 층이
 *   `gh` 로 그 몫을 지고, `gh` 가 없으면 「못 쟀다」로 남긴다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 경로 = path.join(ROOT, '.github', 'workflows', 'syntax-check.yml');
const 원문 = fs.readFileSync(경로, 'utf8');

/** 주석을 걷어낸 «실행되는» 줄만. 이 파일의 사고는 대부분 주석 처리라 이 구분이 핵심이다. */
const 실행줄 = 원문.split('\n').filter((l) => !/^\s*#/.test(l));
const 실행판 = 실행줄.join('\n');

/* ── ① 트리거 ─────────────────────────────────────────────────────────── */

test('🔴 `push:` 트리거가 살아 있다 — 주석이면 푸시해도 run 이 0건이다', () => {
  assert.match(실행판, /^\s{2}push:\s*$/m,
    '`push:` 가 주석이거나 사라졌다 — 그러면 「안 돌아서 초록」이 되고 화면에서 초록과 구분이 안 된다.\n'
    + '  2026-08-14~18 이 정확히 그 상태였다(run 0건 · 그 사이 커밋 1458건).');
});

test('🔑 `workflow_dispatch` 손잡이가 남아 있다 — run 이 0건일 때 되살릴 유일한 수단이다', () => {
  assert.match(실행판, /^\s{2}workflow_dispatch:\s*$/m,
    'dispatch 를 없앴다 — 웹훅이 throttle 되면(2026-08-06 실측) rerun 할 run 조차 없어 손잡이가 사라진다');
});

test('🔴 경로 필터가 없다 — 「안 돌아서 초록」을 만든 2026-08-04 실사고 그 자리', () => {
  assert.ok(!/^\s{4}paths(-ignore)?:/m.test(실행판),
    '경로 필터가 붙었다 — 문서만 깨는 커밋이 CI 를 통째로 건너뛰고 초록으로 통과한다.\n'
    + '  이 저장소의 테스트는 docs·tools 도 검사하므로 `.js` 만 거르는 것은 구멍이다.');
});

/* ── ② 러너 스위치 (분을 태우지 않는 자리) ────────────────────────────── */

/** 스위치 변수 이름은 **한 곳에서만** 산다 — 세 파일에 적혀 있어서 갈라지면 처방이 틀린다(F063). */
const 스위치이름 = 'SYNK_SELFHOSTED';

test('🔴 job 에 러너 스위치가 걸려 있다 — 없으면 러너가 없을 때 job 이 큐에 쌓이고 분을 태운다', () => {
  assert.match(실행판, new RegExp(`^\\s{4}if:\\s*vars\\.${스위치이름}\\s*==\\s*'on'\\s*$`, 'm'),
    `job 의 \`if: vars.${스위치이름} == 'on'\` 게이트가 사라졌다.\n`
    + '  이 게이트가 없으면 ①러너가 없을 때 PR 이 영원히 pending 이고 ②GitHub-hosted 로 떨어지면\n'
    + '  하루 792커밋 × 2.7분이 그대로 청구된다(무료 3,000분은 1.4일이면 끝난다).');
});

test('🔴 `runs-on` 이 self-hosted 와 linux 를 **함께** 요구한다 — 윈도우 러너에 잡히면 리눅스 축을 잃는다', () => {
  const m = /^\s{4}runs-on:\s*(.+)$/m.exec(실행판);
  assert.ok(m, 'runs-on 을 못 찾았다');
  const 값 = m[1];
  assert.match(값, /self-hosted/, `runs-on 이 self-hosted 가 아니다: ${값} — GitHub-hosted 면 분이 청구된다`);
  assert.match(값, /\blinux\b/,
    `runs-on 이 linux 를 안 requires 한다: ${값}\n`
    + '  유호님 노트북은 win32 다. 라벨을 안 걸면 윈도우 러너에 잡혀 **로컬 모사와 같은 축**을 재게 되고,\n'
    + '  그러면 F617 이 잡은 「윈도우 초록 3건이 리눅스에서 무너진다」를 다시는 못 잡는다.');
});

test('🔑 스위치 이름이 처방 문구와 갈라지지 않는다 — 같은 판정을 두 곳에 적으면 갈라진다(F063)', () => {
  for (const rel of ['tools/원격ci.js', 'tools/환경눈.js']) {
    const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(s.includes(스위치이름),
      `${rel} 이 스위치 이름 \`${스위치이름}\` 을 모른다 — 워크플로만 바뀌면 처방이 없는 변수를 가리킨다`);
  }
});

/* ── ③ 분을 아끼는 장치·검증을 깎지 않는 장치 ─────────────────────────── */

test('🔴 낡은 판 취소가 살아 있다 (F210 — 무료분 $12.05 를 7일에 소진해 계정이 잠겼다)', () => {
  assert.match(실행판, /^concurrency:/m, 'concurrency 블록이 사라졌다');
  assert.match(실행판, /cancel-in-progress:\s*true/,
    'cancel-in-progress 가 꺼졌다 — 커밋 간격 1분 · 스위트 2.7분이라 낡은 판이 분량 대부분을 태운다');
});

test('🔴 전체 이력을 받는다 — 얕은 클론이면 이력을 재는 검사가 CI 에서만 깨진다', () => {
  assert.match(실행판, /fetch-depth:\s*0/,
    'fetch-depth: 0 이 사라졌다 — `HEAD~1` 이 없어 실저장소 이력 검사가 로컬에선 초록·CI 에선 적색이 된다');
});

test('🔑 타임아웃이 있다 — 러너가 매달리면 job 이 무한정 남는다', () => {
  const m = /^\s{4}timeout-minutes:\s*(\d+)\s*$/m.exec(실행판);
  assert.ok(m, 'timeout-minutes 가 없다 — 셀프호스티드는 GitHub 가 기본 6시간을 준다');
  const 분 = Number(m[1]);
  assert.ok(분 >= 10 && 분 <= 120,
    `타임아웃이 ${분}분이다 — 스위트 실측이 2.7분이라 10~120분 밖이면 너무 빡빡하거나 무의미하다`);
});

test('🔑 테스트를 **전량** 돌린다 — 부분 실행은 통과와 같은 모양이다(F207)', () => {
  assert.match(실행판, /node --test tests\/\*\.test\.js/,
    '테스트 실행 줄이 바뀌었다 — 일부만 돌리면 「초록」이 분모 없이 나간다');
});
