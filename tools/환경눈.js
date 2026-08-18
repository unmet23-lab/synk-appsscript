#!/usr/bin/env node
/* 환경눈 — 「이 환경에서 **못 재는 층**이 몇 개인가」를 세션 첫 화면에 한 줄로 낸다.
 *
 * 왜 있나 (유호 지시 2026-08-18 「한 수 더」 · 마찰 F634 실측에서 나왔다):
 *   시동 훅 열셋이 각자 「못 쟀다」를 말한다 — 결정 큐 · 형제 초록 · 열린 PR · 도달 실측 · 낡음 대조.
 *   전부 정직한 문구지만 **다섯 줄로 흩어져** 있어서, 읽는 사람은 그날 자기 판정이 어느 만큼
 *   믿을 만한지를 한눈에 못 본다. 실측 2026-08-18(클라우드): 시동 출력 8.2KB 중 그 다섯 줄이
 *   서로 500자씩 떨어져 있었고, 그 세션은 「대기열이 0이다」를 **분모 없이** 읽을 뻔했다.
 *   한 줄로 접으면 그 판정이 앞에 서고, 뒤에 오는 초록들이 전부 그 분모 아래에서 읽힌다(F207).
 *
 * 🔑 이것은 **두 번째 판정이 아니다.** 각 층에서 재는 것은 「그 재료가 이 기계에 있는가」뿐이고,
 *   판정은 여전히 그 층의 도구가 진다. 그래서 여기서 나오는 문장은 「N개 층이 눈멀었다」이지
 *   「무엇이 참이다」가 아니다 — 같은 판정을 두 곳에 적으면 갈라진다(F063)를 피하는 선이 여기다.
 *
 * ⚠ 틀릴 때의 모습 (대가): 도구·훅이 재는 자리를 옮겼는데 이 표를 안 고치면, 이 줄은
 *   「다 보인다」고 말하는데 그 층은 실제로 눈이 먼 상태가 된다 — 새는 방향이 「통과」다.
 *   그래서 각 칸에 **눈이 머는 도구 이름**을 함께 적고, `tests/환경눈.test.js` 가 그 파일들이
 *   실재하는지를 검사한다(이름이 낡으면 빨개진다).
 * ⚠ 닫은 것 1개: 「분모 없이 초록을 읽는」 자리. 이 줄이 서기 전엔 그 다섯 줄을 다 읽어야만
 *   분모를 알 수 있었고, 실제로 아무도 다 안 읽었다.
 *
 * 사용: node tools/환경눈.js [--훅]
 *   --훅 = 세션 시작용 (전부 보이면 **아무것도 안 찍는다** — 조용한 것이 정상이다)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(process.env.SYNK_ENV_EYE_ROOT || path.resolve(__dirname, '..'));
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'board-id.js'));

const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));
{
  /* 모르는 플래그를 조용히 삼키면 「딴 과녁을 재고 초록」이 된다(F400·F435 계열). */
  const 오류 = 인자게이트('환경눈', process.argv.slice(2), ['--훅']);
  if (오류) { console.error(오류); process.exit(1); }
}

const 있나 = (p) => { try { return fs.existsSync(p); } catch (_) { return false; } };
const 명령있나 = (c) => {
  try { execFileSync(process.platform === 'win32' ? 'where' : 'command', process.platform === 'win32' ? [c] : ['-v', c], { stdio: 'ignore', shell: process.platform !== 'win32' }); return true; }
  catch (_) { return false; }
};

/* 층 표 — [이름, 보이나?, 안 보이면 눈머는 곳, 그래서 무엇을 못 하나]
 * 「보이나?」는 **재료가 이 기계에 있는가**만 묻는다. 판정은 그 층의 도구가 진다. */
const 층들 = [
  {
    이름: '세션 지문',
    보이나: () => !!보드id.보드지문(),
    도구: 'tools/board.js · tools/board-move.js · tools/대기열.js',
    잃는것: '내 보드 줄을 못 고르고 일감을 규약대로 못 집는다',
  },
  {
    이름: '커밋 주인 표식',
    보이나: () => {
      try {
        let dir = '';
        try { dir = execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (_) { dir = ''; }
        if (!dir) dir = path.join(execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' }).trim(), 'hooks');
        return 있나(path.resolve(ROOT, dir, 'prepare-commit-msg'));
      } catch (_) { return false; }
    },
    도구: 'tools/githooks/prepare-commit-msg',
    잃는것: '커밋에 Session-Id 가 안 박혀 주인을 트레일러로 못 읽는다(F041)',
  },
  {
    이름: '유호님 결정 큐',
    보이나: () => {
      const d = process.env.SYNK_MEMORY_DIR
        || path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'projects',
          '-' + ROOT.replace(/^[/\\]/, '').replace(/[/\\]/g, '-'), 'memory');
      return 있나(d);
    },
    도구: '.claude/hooks/session-decisions.js',
    잃는것: '⏳유호 대기 줄이 이미 확정됐는지 대조를 못 한다',
  },
  {
    이름: '형제 저장소(SYNK-talk)',
    보이나: () => {
      /* 자리를 손으로 적지 않는다 — 형제 좌표는 `형제저장소.js` 한 곳에서만 산다(F063). */
      try {
        const 형제 = require(path.join(ROOT, '.claude', 'hooks', 'lib', '형제저장소.js'));
        const 자리 = 형제.형제경로(ROOT);
        return !!자리 && 있나(자리);
      } catch (_) { return false; }
    },
    도구: 'tools/형제초록.js · 엔진 도달 실측 · 대기열 낡음 대조',
    잃는것: '초록 도장·엔진 도달·대기열 낡음을 셋 다 못 잰다',
  },
  {
    이름: '열린 PR 조회(gh)',
    보이나: () => 명령있나('gh'),
    도구: 'tools/작업가지.js --훅',
    잃는것: '하루 넘게 열린 PR 을 적색으로 못 낸다',
  },
  {
    이름: '원격 CI',
    보이나: () => {
      try {
        const y = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'syntax-check.yml'), 'utf8');
        return /^\s{2}push:/m.test(y);      // 주석 처리돼 있으면 안 돈다
      } catch (_) { return false; }
    },
    도구: '.github/workflows/syntax-check.yml · tools/원격ci.js',
    잃는것: '푸시해도 run 이 안 생겨 진실 층이 0건이다(로컬 모사만 남는다)',
  },
];

const 잰것 = 층들.map((층) => {
  let 보임 = false;
  try { 보임 = !!층.보이나(); } catch (_) { 보임 = false; }
  return { ...층, 보임 };
});
const 눈먼것 = 잰것.filter((l) => !l.보임);
const 훅 = process.argv.includes('--훅');

if (훅 && !눈먼것.length) process.exit(0);   // 전부 보이면 조용하다

const 색 = 눈먼것.length === 0 ? '🟢' : (눈먼것.length >= 4 ? '🔴' : '🟡');
console.log(`${색} **이 환경에서 눈먼 층 ${눈먼것.length}/${잰것.length}** — 아래 초록·0건은 전부 이 분모 아래에서 읽는다(F207).`);
for (const l of 눈먼것) {
  console.log(`   · ${l.이름} — ${l.잃는것}`);
  console.log(`     ↳ 눈머는 곳: ${l.도구}`);
}
if (눈먼것.length) {
  console.log('   🔑 「못 쟀다」는 「없다」가 아니다 — 부정 판정을 쓰려면 그 층을 직접 열어야 한다(F348).');
}
if (!훅) {
  for (const l of 잰것.filter((x) => x.보임)) console.log(`   ✅ ${l.이름}`);
}
