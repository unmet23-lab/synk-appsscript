#!/usr/bin/env node
'use strict';
/**
 * 작업가지 — 세션의 작업을 «열린 PR» 하나로 서버에 세워, 세션이 죽어도 안 사라지게 한다.
 *
 * ■ 무엇이 3단계인가 (유호 승인 2026-08-15 「장기적으로 1,2가 좋기에 1,2를 추가」)
 *   1단계 = 서버측 잠금(`tools/게이트.js`) · 2단계 = 그 잠금 세우기 — 둘 다 서 있다.
 *   3단계 = **브랜치 + PR**. 이 파일이 그 PR 층이다.
 *
 * ■ 🔑 PR 은 «리뷰 게이트»가 아니라 «작업 목록»이다
 *   리뷰어가 없다(내가 열고 내가 머지한다). 그래서 승인 절차를 안 만든다 — 승인 대기 0.
 *   얻는 것은 리뷰가 아니라 **「지금 뭐가 진행 중인가」의 가시성**이고, 그 가시성이 겨누는
 *   병은 F403(워크트리 갇힘)이다: 워크트리는 아무도 못 보지만 **열린 PR 은 목록으로 남아
 *   세션이 죽어도 안 사라진다.** 보드는 「작업중」이라고 말할 뿐 바이트를 안 들고 있고,
 *   PR 은 diff 를 들고 있다 — 그 차이가 이 층이 보드 위에 더해지는 이유의 전부다.
 *   🚫 「큰 회사가 PR 쓰니까」를 근거로 쓰지 마라 — Google·Meta 는 오히려 trunk-based 다.
 *
 * ■ 가지·워크트리는 **내가 안 짓는다** — 하네스의 `EnterWorktree` 가 이미 짓는다
 *   그 도구는 `.claude/worktrees/` 에 워크트리를 떼고 `origin/master` 에서 새 가지를 내고
 *   세션 작업디렉터리를 그리로 옮긴다. 같은 판정을 두 곳에 적으면 갈라지므로(신뢰성 ④)
 *   여기서는 **PR 만** 진다. 그리고 그 도구는 「CLAUDE.md·메모리가 지시할 때만 쓰라」고
 *   스스로 못박아 두었다 — 즉 **정본 개정이 이 장치의 발동 조건이다**(같은 커밋에서 정한다).
 *
 * ■ 왜 장부를 새로 안 만드나
 *   **열린 PR 목록 자체가 장부다.** 보드·대기열·메모리에 이어 네 번째 장부를 두면 같은
 *   판정이 두 곳에 앉아 갈라진다 — 그게 08-15 에 ㉢Issues 를 기각한 이유 그대로다.
 *   ▶ 닫을 것 1개: 이 트랙은 새 장부 0 · 새 상태파일 0(스로틀 캐시는 tmp 라 저장소 밖).
 *
 * ■ 대가 (틀릴 때의 모습 — 정직하게)
 *   ① `gh` 인증이 끊기면 `--열기`·`--닫기` 가 죽는다. 그때 **작업은 그대로 살아 있고**
 *      가지도 로컬에 남는다 — 즉 이 도구가 죽는 방향은 「PR 이 안 생긴다」(=오늘 동작)지
 *      「작업이 사라진다」가 아니다.
 *   ② `--훅` 은 10분 스로틀이라 **방금 연 PR 이 이번 세션에 안 뜰 수 있다.** 그래서 뜰 때
 *      「몇 분 전 기준」인지 함께 낸다(작업본소유자의 fetch 스로틀과 같은 규칙 · #Q95).
 *   ③ 머지는 **`--merge` 고정이다. 절대 squash 하지 않는다** — squash 는 커밋마다 박힌
 *      `Session-Id` 트레일러를 한 줄로 뭉개고, 이 저장소는 커밋 주인을 그 트레일러로만
 *      가른다(F041). 주인을 못 가르면 F073 이 되살아난다.
 *   ④ **자격증명 우회는 한 번뿐이다**(F580). 흔적이 맞을 때만 `gh` 헬퍼로 다시 밀고, 그것도
 *      매달리면 벽시계가 두 배가 된다(그래서 재시도는 60초 제한). 우회가 성공해도 **영구 수리가
 *      아니다** — 이 노트북의 `credential.helper` 는 그대로고, 그 수리는 유호님 몫이다(F581).
 *   ⑤ **갈라짐 경보는 문턱 위에 있다**(F577). 즉 앞선 커밋이 1건이어도 뒤처짐이 있으면 운다 —
 *      틀리는 방향은 「더 자주 운다」다. 반대로 접었을 때의 값이 실측으로 0이라 이 쪽을 골랐다:
 *      옛 게이지는 앞 7·뒤 57(=`push` 가 `rejected`)에서 **두 눈금 다 초록**이었다.
 *   ⚠ 워크트리에서 clasp 배포하는 위험은 **여기서 안 막는다** — 이미 막혀 있다
 *      (`.claude/hooks/clasp-guard.js` 0번 검사 · 08-01 실측 3회 차단). 두 곳에 적지 않는다.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const 기본가지 = 'master';

/* 머지 뒤 로컬 master 를 전진시키는 통로 — `인계문수거` 와 **같은 파일**을 쓴다
 * (같은 판정을 두 곳에 적으면 갈라진다 · 사연은 tools/lib/master동기.js 머리말). */
const 동기 = require(path.join(__dirname, 'lib', 'master동기.js'));
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('../.claude/hooks/lib/board-id.js');

/** 스로틀 간격(분). 0 = 끄기(항상 조회). 기본 10분 — 작업본소유자의 fetch 스로틀과 같은 값. */
const 신선_분 = Number(process.env.SYNK_PR_LIST_MIN ?? 10);

/**
 * 안 밀린 커밋이 이만큼 쌓이면 소리친다 (F502).
 *
 * 🔑 **이 숫자는 발명한 것이 아니라 실측이다** (2026-08-16 · reflog 15일 · push 1610회 · 커밋 5779개).
 *   한 push 가 실어 나른 커밋 수 = 그 순간 「밀리지 않고 있던 양」이고, 그 분포는
 *   p50 **1건** · p75 3 · p90 7 · p95 13 · **p99 29** · 최대 273 이다.
 *   30 으로 두면 과거 1610회 중 **16회(0.99%)** 만 울렸다 — 그날 사고는 98건이었다.
 *
 * 🔑 왜 «시간»이 아니라 «개수»인가. 시간 축도 재 봤다(지연 p99 = 11.7시간 · 최대 31.7시간).
 *   그런데 지키려는 것은 **잃을 바이트의 양**이다 — 커밋 1건이 12시간 묵는 것은 정상이고
 *   (밤에 커밋하고 아침에 민다 · 1시간 초과가 전체의 16%다) 30건이 쌓인 것은 아니다.
 *   시간으로 재면 정상인 하루를 매번 신고하게 되고, 그런 경보는 한 주면 꺼진다.
 */
const 안밀린_문턱 = Number(process.env.SYNK_AHEAD_MAX ?? 30);

/** 캐시는 **저장소 밖**(tmp)에 둔다 — 새 상태파일을 git 에 들이면 그게 곧 네 번째 장부다. */
const 캐시경로 = path.join(os.tmpdir(), 'synk-작업가지-목록.json');

// ── 공용 ────────────────────────────────────────────────────────────────────
function gh(인자, 옵션 = {}) {
  const r = spawnSync('gh', 인자, { encoding: 'utf8', shell: false, cwd: ROOT, timeout: 30000, ...옵션 });
  return { 성공: r.status === 0, 출력: (r.stdout || '').trim(), 오류: (r.stderr || '').trim() };
}

/**
 * 실패 사유를 **빈 문자열로 내보내지 않는다** (F580).
 *
 * 🔑 왜 빌 수 있나 — `spawnSync` 의 timeout 은 자식을 **죽여서** 끝낸다. 그러면 `status = null`,
 *   `stderr` 는 아직 아무것도 안 뱉었을 수 있어 **0바이트**다. 옛 코드는 그 자리를 `stderr` 하나로만
 *   채워 `🔴 못 밀었다 — ` (사유 칸이 빈 채)를 냈고, 화면엔 단서가 0이었다.
 *   실측 2026-08-17: GCM 이 GUI 대화상자를 띄우려다 TTY 가 없어 **매달렸다** — 「막힌 것」이 아니라
 *   「끝나지 않는 것」이라, 타임아웃 전까지는 「도는 중」과 구별이 안 된다.
 */
function 실패사유(r, 제한밀리) {
  const 조각 = [];
  const 표준오류 = String(r.stderr || '').trim();
  if (표준오류) 조각.push(표준오류.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' / '));
  if (r.error) 조각.push(`${r.error.code || r.error.name || 'Error'}: ${r.error.message}`);
  if (!조각.length) {
    /* 여기까지 왔다 = stderr 0바이트 + error 없음. **그래도 사유 칸을 비우지 않는다.** */
    조각.push(r.signal ? `신호 ${r.signal} 로 죽었다(출력 0바이트)`
      : `종료코드 ${r.status === null ? '없음' : r.status} · stderr 0바이트`);
  }
  if (r.error && r.error.code === 'ETIMEDOUT') {
    조각.push(`${Math.round(제한밀리 / 1000)}초 제한에 걸려 내가 죽였다 — «막힌» 게 아니라 «매달린» 것이다`);
  }
  return 조각.join(' · ');
}

function git(인자, 뿌리 = process.cwd(), 옵션 = {}) {
  const 제한 = 옵션.시간제한 ?? 30000;
  const r = spawnSync('git', 인자, { encoding: 'utf8', shell: false, cwd: 뿌리, timeout: 제한, windowsHide: true });
  const 성공 = r.status === 0;
  return {
    성공,
    출력: (r.stdout || '').trim(),
    오류: 성공 ? '' : 실패사유(r, 제한),
    시간초과: Boolean(r.error && r.error.code === 'ETIMEDOUT'),
  };
}

/**
 * 「자격증명 통로가 죽었다」의 흔적 (F580·F581).
 *
 * ⚠ `gh auth status` 는 이때도 **초록**이다 — 인증 자체는 살아 있고 **git 쪽 통로만** 죽은 것이라,
 *   인증을 확인해 봐야 아무것도 안 나온다. 그래서 흔적으로 가른다.
 */
const 자격증명_흔적 = /could not read Username|could not read Password|User cancelled dialog|\/dev\/tty|failed to execute prompt script|terminal prompts disabled|credential-manager/i;

/** 빈 값을 **먼저** 넣어 물려받은 헬퍼(GCM)를 지우고, 그 위에 gh 의 헬퍼를 얹는다. */
const 우회_인자 = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'];

/**
 * 가지를 민다 — 자격증명 통로에서 막히면 **gh 헬퍼로 한 번만** 다시 민다 (F580).
 *
 * 🔑 왜 자동으로 하나: 여기서 멈추면 트랙을 닫는 마지막 걸음이 통째로 막히고, 그 처방은
 *   사람이 명령을 옮겨 치는 일이 된다(철학 ㉡ — 사람 손을 늘리는 해법은 해법이 아니다).
 *   새 자격증명을 만드는 게 아니라 **이미 초록인 `gh` 인증을 git 에 물려 주는 것**뿐이다.
 * ⚠ 대가(틀릴 때의 모습): 우회도 매달리면 벽시계가 두 배가 된다 — 그래서 **흔적이 맞을 때만**,
 *   **한 번만**, 그리고 재시도는 60초 제한으로 건다. 닫을 것 1개 = 새 상태파일·새 장부 0.
 */
function 가지밀기(뿌리, 인자들) {
  const 첫판 = git(['push', ...인자들], 뿌리);
  if (첫판.성공) return { ...첫판, 우회했나: false };
  if (!(첫판.시간초과 || 자격증명_흔적.test(첫판.오류))) return { ...첫판, 우회했나: false };

  console.error(`  ⚠ push 가 **자격증명 통로**에서 막혔다 — ${첫판.오류}`);
  console.error('     gh 의 헬퍼로 한 번만 다시 민다(F580 우회 · 새 자격증명이 아니라 gh 인증을 물려 준다).');
  const 두판 = git([...우회_인자, 'push', ...인자들], 뿌리, { 시간제한: 60000 });
  if (두판.성공) {
    console.error('     ✅ 우회로 밀렸다 — **영구 수리는 아니다**(이 노트북의 git credential helper 는 그대로다 · F581).');
    return { ...두판, 우회했나: true };
  }
  return { ...두판, 우회했나: true, 오류: `${첫판.오류}  ▷ 우회도 실패: ${두판.오류}` };
}

/** push 가 죽었을 때의 **따를 수 있는** 처방 — 자격증명 자리면 그 자리를 지목한다. */
function 밀기처방(결과, 가지) {
  if (결과.시간초과 || 자격증명_흔적.test(결과.오류 || '')) {
    return 'git 의 자격증명 통로가 죽었다(gh 는 초록일 수 있다 · F581). 직접 돌려 본다:\n'
      + `        git -c credential.helper= -c credential.helper="!gh auth git-credential" push origin ${가지}:${가지}\n`
      + '        영구 수리는 유호님 몫이다 — Windows 자격 증명 관리자에서 github.com 항목을 지우고 다시 로그인한다.';
  }
  return `git push origin ${가지}:${가지} 를 직접 돌려 사유 원문을 본다.`;
}

function 죽기(사유, 처방) {
  console.error(`\n🔴 ${사유}`);
  if (처방) console.error(`   ▶ ${처방}`);
  console.error('   ⚠ 이 도구가 죽어도 **작업과 가지는 그대로 살아 있다** — PR 만 안 생긴 것이다.\n');
  process.exit(1);
}

function 지문() {
  return 보드id.보드지문() || null;
}

/** 지금 어느 가지에 서 있나. detached 면 null. */
function 현재가지(뿌리 = process.cwd()) {
  const r = git(['rev-parse', '--abbrev-ref', 'HEAD'], 뿌리);
  if (!r.성공) return null;
  return r.출력 === 'HEAD' ? null : r.출력;
}

/** 워크트리인가 — git-dir 과 common-dir 이 다르면 워크트리다(clasp-guard 와 같은 판정법). */
function 워크트리인가(뿌리 = process.cwd()) {
  const a = git(['rev-parse', '--absolute-git-dir'], 뿌리);
  const b = git(['rev-parse', '--git-common-dir'], 뿌리);
  if (!a.성공 || !b.성공) return null;                       // 모름은 안전이 아니다 — 부르는 쪽이 판단
  return path.resolve(a.출력) !== path.resolve(뿌리, b.출력);
}

// ── 하위 명령 ───────────────────────────────────────────────────────────────
/**
 * `--열기 "제목"` — 지금 가지를 origin 에 밀고 PR 을 연다.
 *
 * 🔑 **첫 커밋이 있어야 PR 이 열린다**(GitHub 은 커밋 0 인 PR 을 거절한다). 이 저장소에서
 *   그 첫 커밋은 자연스럽게 **보드 선언 커밋**이다 — 선언이 곧 PR 의 몸통이 된다.
 */
function 열기(제목) {
  const 뿌리 = process.cwd();
  const 가지 = 현재가지(뿌리);

  if (!가지) 죽기('detached HEAD 다 — 가지 위에 있어야 PR 을 연다.', 'EnterWorktree 로 워크트리를 뜬다.');
  if (가지 === 기본가지) {
    죽기(
      `${기본가지} 위에서는 PR 을 못 연다 — PR 은 «master 로 들어갈 것»을 담는 그릇이다.`,
      'EnterWorktree 로 워크트리를 뜬 뒤(가지가 자동으로 갈린다) 보드 선언을 커밋하고 다시 부른다.',
    );
  }
  if (!제목) 죽기('제목이 없다', 'node tools/작업가지.js --열기 "트랙 제목"');

  /* 커밋 0 이면 GitHub 이 거절한다 — 그 거절을 그대로 흘리지 말고 **여기서 처방으로 바꾼다**.
     따를 수 없는 처방은 우회를 정상 통로로 만든다(F103). */
  const 앞선 = git(['rev-list', '--count', `origin/${기본가지}..HEAD`], 뿌리);
  if (앞선.성공 && 앞선.출력 === '0') {
    죽기(
      '이 가지에 커밋이 0건이다 — 커밋 0 인 PR 은 GitHub 이 거절한다.',
      '보드 선언을 먼저 커밋한다: git add -- docs/_ops/보드/<지문>.md && git commit -m "docs: 보드 …" -- docs/_ops/보드/<지문>.md',
    );
  }

  const 밀기 = 가지밀기(뿌리, ['-u', 'origin', `${가지}:${가지}`]);
  if (!밀기.성공) 죽기(`가지를 못 밀었다 — ${밀기.오류}`, 밀기처방(밀기, 가지));

  /* 이미 열린 PR 이 있으면 두 번째를 만들지 않는다 — 같은 작업이 목록에 둘로 서면
     「지금 뭐가 진행 중인가」가 오히려 흐려진다(이 층의 존재 이유가 가시성이다). */
  const 있나 = gh(['pr', 'list', '--head', 가지, '--state', 'open', '--json', 'number,url']);
  if (있나.성공 && 있나.출력 && 있나.출력 !== '[]') {
    let 목록 = [];
    try { 목록 = JSON.parse(있나.출력); } catch (_) { 목록 = []; }
    if (목록.length) {
      console.log(`  · 이미 열린 PR 이 있다 — #${목록[0].number}. 새로 안 만든다(가지만 갱신했다).`);
      console.log(`    ${목록[0].url}\n`);
      return;
    }
  }

  const 몸통 = [
    `**지문** \`${지문() || '(모름)'}\` · **가지** \`${가지}\``,
    '',
    '이 PR 은 **리뷰 게이트가 아니라 작업 목록**이다 — 승인 대기 0, 내가 열고 내가 머지한다.',
    '열려 있는 동안 = 이 트랙이 진행 중이라는 뜻이고, 세션이 죽어도 이 줄은 남는다(F403).',
    '',
    `보드 정본: \`docs/_ops/보드/${지문() || '<지문>'}.md\``,
    '',
    '닫기: `node tools/작업가지.js --닫기`',
  ].join('\n');

  const 몸통파일 = path.join(os.tmpdir(), `synk-pr-몸통-${process.pid}.md`);
  fs.writeFileSync(몸통파일, 몸통, 'utf8');
  try {
    const r = gh(['pr', 'create', '--base', 기본가지, '--head', 가지, '--title', 제목, '--body-file', 몸통파일]);
    if (!r.성공) 죽기(`PR 을 못 열었다 — ${r.오류}`, 'gh auth status 로 인증을 본다.');
    console.log(`\n✅ PR 을 열었다 — ${r.출력}`);
    console.log('   이제 이 워크트리에서 작업한다. 끝나면: node tools/작업가지.js --닫기\n');
  } finally {
    fs.rmSync(몸통파일, { force: true });
  }
}

/**
 * `--닫기` — 남은 것을 밀고 PR 을 머지한다.
 *
 * ⚠ **머지 방식은 `--merge` 고정**이다(위 대가 ③). squash 는 Session-Id 트레일러를 뭉개고,
 *   rebase 는 SHA 를 바꿔 보드·메모리에 적힌 `\`abc1234\`` 참조를 통째로 죽인다.
 */
function 닫기() {
  const 뿌리 = process.cwd();
  const 가지 = 현재가지(뿌리);
  if (!가지 || 가지 === 기본가지) 죽기(`작업 가지 위가 아니다(현재: ${가지 || 'detached'})`);

  const 더러움 = git(['status', '--porcelain'], 뿌리);
  if (더러움.성공 && 더러움.출력) {
    죽기(
      '미커밋이 남아 있다 — 머지하면 이 바이트는 **안 따라간다**(그게 정확히 F403 이다).',
      `먼저 커밋한다. 남은 것:\n${더러움.출력.split('\n').slice(0, 10).map((l) => `        ${l}`).join('\n')}`,
    );
  }

  const 밀기 = 가지밀기(뿌리, ['origin', `${가지}:${가지}`]);
  if (!밀기.성공) 죽기(`못 밀었다 — ${밀기.오류}`, 밀기처방(밀기, 가지));

  /* `--delete-branch` 는 **로컬 가지까지** 지우려 든다. 세션이 아직 그 가지 위에 서 있으므로
     그건 실패하고, 실패가 머지 성공을 가린다. 그래서 원격 ref 만 따로 지운다 —
     로컬 워크트리·가지 정리는 하네스의 `ExitWorktree(remove)` 몫이다(두 곳에 적지 않는다). */
  const r = gh(['pr', 'merge', 가지, '--merge']);
  if (!r.성공) 죽기(`머지 못 했다 — ${r.오류}`, '충돌이면 먼저 master 를 이 가지에 반입해 푼다: git fetch origin && git merge origin/master');
  console.log(`\n✅ 머지했다 — ${가지} → ${기본가지}`);

  const 지우기 = gh(['api', '--method', 'DELETE', `repos/{owner}/{repo}/git/refs/heads/${가지}`]);
  console.log(지우기.성공 ? '   원격 가지도 거뒀다.' : `   ⚠ 원격 가지가 남았다(${지우기.오류 || '사유 모름'}) — 목록에 계속 뜬다.`);

  /* 🔑 머지는 **origin 에서만** 일어난다 — 여기서 멈추면 이 트리의 로컬 master 는 제자리다.
   * 실측 2026-08-17: 그렇게 하루에 57 커밋 뒤처졌고, 로컬 판을 읽는 층이 전부 거짓을 냈다
   * (F542 보드 줄 · F565 가지 기준 · F566 커밋 목록 — 셋 다 이 한 줄이 없어서 생긴 얼굴이다).
   * `--ff-only` 라 머지 커밋을 만들지 않고, 남의 미커밋이 있으면 git 이 거절한다(그게 안전선이다). */
  console.log(동기.줄내기('작업가지', 동기.전진(뿌리)));
  워크트리거두기처방(뿌리, 가지);
}

/**
 * 머지가 끝난 뒤 **이 워크트리를 거두는 마지막 한 칸** (F567).
 *
 * 🔑 무엇이 비어 있었나 — F403(워크트리 갇힘)의 처방은 「죽은 워크트리를 이어받아 끝내라」까지
 *   세워 놨는데, **이어받은 쪽 길의 마지막 칸**은 아무 도구도 안 진다. `ExitWorktree(remove)` 는
 *   «이 세션이 만든» 워크트리만 거두므로, 이어받은 것에는 「주인이 아니다」로 거절한다.
 *   실측 2026-08-17(`local_950d2850`): 손으로 `git worktree remove` 를 친 것은 **기억했기 때문**이지
 *   무엇이 시켜서가 아니었다. 안 쳤으면 「머지는 됐는데 워크트리만 남은」 상태가 되고, 그건
 *   다음 세션 SessionStart 에 **갇힘 후보로 다시 떠서** 같은 판정을 또 시킨다.
 *
 * ⚠ 여기서 **자동으로 지우지 않는다** — 세션의 작업 디렉터리가 이 안이라, 발밑을 지우면 그 뒤의
 *   모든 명령이 깨진다. 디렉터리를 옮기는 일은 하네스 몫이다(두 곳에 적지 않는다 · 신뢰성 ④).
 *   그래서 이 칸이 지는 것은 **「명령을 손에 쥐여 주는 것」**뿐이고, 대가는 사람이 한 줄 붙여넣는
 *   비용이다(닫을 것 1개 = 새 상태파일·새 장부 0).
 */
function 워크트리거두기처방(뿌리, 가지) {
  if (워크트리인가(뿌리) !== true) {
    console.log('   (워크트리가 아니다 — 거둘 것 없다.)\n');
    return;
  }
  const 메인 = 동기.메인뿌리(뿌리);
  console.log('   로컬 워크트리 정리 = **ExitWorktree(remove)** 를 먼저 부른다.');
  console.log('   ⚠ **이어받은 워크트리면 그 도구가 거절한다**(이 세션이 만든 것이 아니라서다 · F567).');
  console.log('      그때는 아래를 그대로 친다 — 머지가 이미 끝났으니 잃을 바이트는 0이다:');
  console.log(`         git -C "${메인}" worktree remove "${뿌리}"`);
  console.log(`         git -C "${메인}" branch -D ${가지}`);
  console.log('      안 거두면 다음 세션 SessionStart 에 「갇힘 후보」로 다시 떠서 같은 판정을 또 시킨다.\n');
}

/** 열린 PR 을 딴다. 실패하면 **null(=못 봄)** 이지 빈 배열이 아니다. */
function 열린것따기() {
  const r = gh(['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,createdAt,url,author']);
  if (!r.성공) return null;   // 못 봄 ≠ 0건 (F207)
  try { return JSON.parse(r.출력 || '[]'); } catch (_) { return null; }
}

/** 캐시 나이(분) — 없으면 null(=모름) → 부르는 쪽은 그때 «딴다»(모름을 신선함으로 바꾸지 않는다). */
function 캐시나이_분(경로 = 캐시경로) {
  try {
    if (!fs.existsSync(경로)) return null;
    return (Date.now() - fs.statSync(경로).mtimeMs) / 60000;
  } catch (_) { return null; }
}

/**
 * 안 밀린 커밋 수와 그중 가장 오래된 것의 나이(시간). **네트워크 0** — 로컬 ref 만 읽는다.
 * 못 세면 `{수: null}`(=모름) 이지 0 이 아니다.
 */
function 안밀린것(뿌리 = ROOT) {
  const 수 = git(['rev-list', '--count', `origin/${기본가지}..${기본가지}`], 뿌리);
  if (!수.성공) return { 수: null, 최고령_시간: null };
  const n = Number(수.출력);
  if (!Number.isFinite(n)) return { 수: null, 최고령_시간: null };

  /* 가장 오래된 것 = `git log` 의 마지막 줄(최신이 먼저 나온다). */
  const 때들 = git(['rev-list', '--format=%ct', '--no-commit-header', `origin/${기본가지}..${기본가지}`], 뿌리);
  let 최고령_시간 = null;
  if (때들.성공 && 때들.출력) {
    const 줄 = 때들.출력.split('\n').map((s) => Number(s.trim())).filter(Number.isFinite);
    if (줄.length) 최고령_시간 = (Date.now() - Math.min(...줄) * 1000) / 3600000;
  }
  return { 수: n, 최고령_시간 };
}

/**
 * 밀림 경보 — F502. 커밋은 다들 지켰는데 **그 한 층 위가 비어 있던** 자리다.
 *
 * ⚠ **원격 기준이 낡았으면 이 수는 부풀려진다** — `origin/master` 는 로컬 추적 ref 라
 *   fetch 를 안 했으면 실제보다 뒤처져 있고, 그러면 안 밀린 것을 실제보다 «많게» 센다.
 *   틀리는 방향이 「더 자주 운다」라 눈이 어두워지지는 않지만, 그렇다고 **모른 채 단정하지는
 *   않는다** — 기준이 얼마나 낡았는지를 함께 낸다(같은 SessionStart 에서 작업본소유자가
 *   10분 스로틀로 fetch 하므로 보통은 신선하다).
 */
function 밀림경보(뿌리 = ROOT) {
  const { 수, 최고령_시간 } = 안밀린것(뿌리);
  if (수 === null) return;                                    // 못 셈 — 0 이 아니다(F207)

  /* ㉡ **「밀 수 없다」는 개수·나이와 무관하다** (F577).
   *   문턱 30 은 ㉠「밀 수 있는데 안 밀었다」를 재도록 실측된 값인데(위 주석), 갈라진 판은
   *   0~29 구간에 그대로 앉아 ㉠ 의 침묵을 물려받는다. 실측 2026-08-17: 앞 7 · 뒤 57 로
   *   `push --dry-run` 이 `! [rejected] (non-fast-forward)` 였는데 **두 눈금 다 초록**이었다.
   *   그래서 이 갈래는 문턱 **위에** 둔다 — 개수가 1이어도 못 민다. */
  const { 뒤처진 } = 동기.갈라짐(뿌리);
  if (수 > 0 && 뒤처진 !== null && 뒤처진 > 0) {
    console.log(`🔀 **로컬 ${기본가지} 가 갈라졌다 — 앞 ${수} · 뒤 ${뒤처진}.** 「안 밀었다」가 아니라 **「못 민다」**다.`);
    console.log(`   \`git push origin ${기본가지}\` 는 \`! [rejected] (non-fast-forward)\` 로 죽는다 — 그래서 그 처방을 여기서 안 낸다(F103).`);
    console.log(`   → ${동기.갈라짐처방(뿌리, { 앞선: 수, 뒤처진 })}`);
    console.log('   왜 조용했나: 이 게이지는 «앞선 개수»만 재서, 갈라진 판이 문턱 아래 그대로 앉는다(F577).');
    console.log('');
    return;                       // 두 경보를 겹쳐 내지 않는다 — 처방이 서로 어긋난다
  }

  /* `수 === 0` 을 따로 막는다 — 문턱을 0 으로 내리면 «안 밀린 커밋 0건» 이라는 경보가 뜬다.
     안 도는 것보다 이런 자리로 더 자주 샌다(맹점 ④ · 맞는 얼굴로 틀린 값). */
  if (수 === 0 || 수 < 안밀린_문턱) return;

  const 나이 = 최고령_시간 === null ? null
    : 최고령_시간 < 24 ? `${Math.round(최고령_시간)}시간` : `${Math.round(최고령_시간 / 24)}일`;
  console.log(`📤 **안 밀린 커밋 ${수}건** — 이 노트북에만 있다(문턱 ${안밀린_문턱}건).`);
  if (나이) console.log(`   가장 오래된 것이 ${나이}째 origin 에 못 닿았다.`);

  let 기준 = null;
  try { 기준 = require('./작업본소유자.js').fetch나이_분(ROOT); } catch (_) { /* 못 읽으면 안 적는다 */ }
  if (기준 !== null && 기준 > 30) {
    console.log(`   ⚠ 원격 기준이 ${Math.round(기준)}분 낡았다 — 이 수는 부풀려졌을 수 있다(fetch 뒤 다시 본다).`);
  }
  console.log('   왜 뜨나: 서버측 잠금도 PR 도 **origin 에 올라온 것만** 지킨다 — 안 민 하루는 그 층이 없는 하루다.');
  console.log('      (실측 08-16: 커밋 98건이 하루 종일 push 0건이었다 · F502)');
  console.log(`   → git push origin ${기본가지}`);
  console.log('');
}

/** 며칠 지났나 — 오래 열린 PR 이 곧 「갇힌 작업」의 신호다. */
function 나이_시간(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (Date.now() - t) / 3600000 : null;
}

function 그리기(목록, 기준분) {
  if (목록 === null) {
    console.log('❔ **열린 작업 PR 을 못 읽었다** — gh 인증·네트워크를 본다(0건이 아니다).');
    return;
  }
  if (!목록.length) return;                                   // 조용한 것이 정상이다

  const 기준 = 기준분 === null ? '방금 잼' : `${Math.round(기준분)}분 전 기준`;
  console.log(`🌿 **열린 작업 PR ${목록.length}건** — 진행 중이라고 «서버가» 말하는 트랙이다 (${기준}).`);
  for (const p of 목록) {
    const h = 나이_시간(p.createdAt);
    const 나이 = h === null ? '?' : h < 24 ? `${Math.round(h)}시간` : `${Math.round(h / 24)}일`;
    const 늙음 = h !== null && h >= 24 ? '  🔴' : '';
    console.log(`   · #${p.number} ${p.title}`);
    console.log(`     \`${p.headRefName}\` · ${나이}째${늙음}`);
  }
  const 늙은 = 목록.filter((p) => { const h = 나이_시간(p.createdAt); return h !== null && h >= 24; });
  if (늙은.length) {
    console.log(`   🔴 **하루 넘게 열린 것 ${늙은.length}건** — 주인 세션이 죽었을 수 있다. 그게 F403(워크트리 갇힘)의 얼굴이다.`);
    console.log('      → 내 것이면 닫는다: node tools/작업가지.js --닫기   ·   남의 것이면 «이어받지 않는다»(모름은 안전이 아니다).');
  }
  console.log('');
}

/**
 * 훅 모드 — SessionStart. **10분 스로틀**로 조회를 아낀다.
 * 세션 시작 비용은 세션 수만큼 곱해지고, 이 저장소는 이미 그 자리를 재서 깎아 놨다(#Q95).
 */
function 훅() {
  /* 🔑 밀림 경보는 **스로틀 밖**이다 — 네트워크 0(로컬 ref 만)이라 아낄 것이 없고,
     아끼면 사고가 난 그 세션에서 조용해진다. 비싼 것(PR 조회)만 스로틀한다. */
  밀림경보();

  const 나이 = 캐시나이_분();
  if (신선_분 > 0 && 나이 !== null && 나이 < 신선_분) {
    try {
      그리기(JSON.parse(fs.readFileSync(캐시경로, 'utf8')), 나이);
      return;
    } catch (_) { /* 캐시가 깨졌으면 아래에서 새로 딴다 */ }
  }
  const 목록 = 열린것따기();
  if (목록 !== null) {
    try { fs.writeFileSync(캐시경로, JSON.stringify(목록), 'utf8'); } catch (_) {}
  }
  그리기(목록, null);
}

// ── 진입 ────────────────────────────────────────────────────────────────────
/* 🔑 `require.main` 으로 감싼다 — 없으면 테스트가 이 파일을 여는 순간 **실제 PR 을 연다**. */
function 진입() {
  const 인자 = process.argv.slice(2);
  const 있나 = (f) => 인자.includes(f);
  const 값 = (f) => { const i = 인자.indexOf(f); return i >= 0 ? 인자[i + 1] : undefined; };

  /* 🔴 **모르는 낱말을 삼키면 이 도구는 「현황을 그리고」 조용히 끝난다** — `--단기` 오타 하나면
   *   트랙이 안 닫힌 채 초록이 된다. 이 파일이 방금 F567·F577·F580(트랙을 닫는 마지막 걸음이
   *   조용히 실패한다)을 고친 자리고, 삼켜지는 플래그는 **같은 병의 네 번째 입**이다.
   * 🔑 목록은 눈으로 정하지 않았다 — `tests/lib/도구인자.js` 의 `CLI도구들()` 로 재서 셋이고,
   *   `tests/도구인자게이트.test.js` ④ 가 「자기 낱말 전량을 선언이 덮는가」를 매번 다시 센다.
   *   ⚠ `gh`·`git` 에 넘기는 인자(`--porcelain`·`--merge` 류)는 **여기 넣지 않는다** — 넣으면
   *     그 낱말이 CLI 에서 통과한다(처방을 따르면 병이 생기는 자리 · F103). */
  const 아는플래그 = ['--훅', '--열기', '--닫기'];
  const 플래그오류 = 인자게이트('작업가지', 인자, 아는플래그);
  if (플래그오류) 죽기(플래그오류, '위 낱말 중 하나를 쓴다 — 오타면 트랙이 안 닫힌 채 초록이 된다.');

  if (있나('--훅')) {
    /* 훅은 «조용히 실패»한다 — 세션 시작을 막지 않는다. 다만 못 읽었으면 그렇게 말한다.
       🔑 `gh` 가 없어도 **밀림 경보는 돈다** — 그건 git 만 쓴다. 여기서 통째로 return 하면
          `gh` 하나가 죽었다는 이유로 F502 감시까지 같이 꺼진다(가드가 서로를 끌어내리는 자리). */
    if (!gh(['--version']).성공) { 밀림경보(); return; }
    훅();
    return;
  }

  if (!gh(['--version']).성공) 죽기('gh CLI 를 못 불렀다', 'gh --version 을 직접 확인한다.');
  if (!gh(['auth', 'status']).성공) 죽기('gh 인증이 없다', 'gh auth status 로 확인한다.');

  if (있나('--열기')) 열기(값('--열기'));
  else if (있나('--닫기')) 닫기();
  else 그리기(열린것따기(), null);
}

if (require.main === module) 진입();

module.exports = {
  기본가지, 현재가지, 워크트리인가, 캐시나이_분, 나이_시간, 열린것따기, 캐시경로, 안밀린것, 안밀린_문턱,
  실패사유, 밀기처방, 자격증명_흔적, 우회_인자, 밀림경보, 워크트리거두기처방,
};
