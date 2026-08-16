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
 *   ⚠ 워크트리에서 clasp 배포하는 위험은 **여기서 안 막는다** — 이미 막혀 있다
 *      (`.claude/hooks/clasp-guard.js` 0번 검사 · 08-01 실측 3회 차단). 두 곳에 적지 않는다.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const 기본가지 = 'master';

/** 스로틀 간격(분). 0 = 끄기(항상 조회). 기본 10분 — 작업본소유자의 fetch 스로틀과 같은 값. */
const 신선_분 = Number(process.env.SYNK_PR_LIST_MIN ?? 10);

/** 캐시는 **저장소 밖**(tmp)에 둔다 — 새 상태파일을 git 에 들이면 그게 곧 네 번째 장부다. */
const 캐시경로 = path.join(os.tmpdir(), 'synk-작업가지-목록.json');

// ── 공용 ────────────────────────────────────────────────────────────────────
function gh(인자, 옵션 = {}) {
  const r = spawnSync('gh', 인자, { encoding: 'utf8', shell: false, cwd: ROOT, timeout: 30000, ...옵션 });
  return { 성공: r.status === 0, 출력: (r.stdout || '').trim(), 오류: (r.stderr || '').trim() };
}

function git(인자, 뿌리 = process.cwd()) {
  const r = spawnSync('git', 인자, { encoding: 'utf8', shell: false, cwd: 뿌리, timeout: 30000, windowsHide: true });
  return { 성공: r.status === 0, 출력: (r.stdout || '').trim(), 오류: (r.stderr || '').trim() };
}

function 죽기(사유, 처방) {
  console.error(`\n🔴 ${사유}`);
  if (처방) console.error(`   ▶ ${처방}`);
  console.error('   ⚠ 이 도구가 죽어도 **작업과 가지는 그대로 살아 있다** — PR 만 안 생긴 것이다.\n');
  process.exit(1);
}

function 지문() {
  return (process.env.CLAUDE_CODE_HOST_SESSION_ID || '').replace(/^local_/, '').slice(0, 8) || null;
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

  const 밀기 = git(['push', '-u', 'origin', `${가지}:${가지}`], 뿌리);
  if (!밀기.성공) 죽기(`가지를 못 밀었다 — ${밀기.오류}`, 'git push -u origin <가지> 를 직접 돌려 본다.');

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

  const 밀기 = git(['push', 'origin', `${가지}:${가지}`], 뿌리);
  if (!밀기.성공) 죽기(`못 밀었다 — ${밀기.오류}`);

  /* `--delete-branch` 는 **로컬 가지까지** 지우려 든다. 세션이 아직 그 가지 위에 서 있으므로
     그건 실패하고, 실패가 머지 성공을 가린다. 그래서 원격 ref 만 따로 지운다 —
     로컬 워크트리·가지 정리는 하네스의 `ExitWorktree(remove)` 몫이다(두 곳에 적지 않는다). */
  const r = gh(['pr', 'merge', 가지, '--merge']);
  if (!r.성공) 죽기(`머지 못 했다 — ${r.오류}`, '충돌이면 먼저 master 를 이 가지에 반입해 푼다: git fetch origin && git merge origin/master');
  console.log(`\n✅ 머지했다 — ${가지} → ${기본가지}`);

  const 지우기 = gh(['api', '--method', 'DELETE', `repos/{owner}/{repo}/git/refs/heads/${가지}`]);
  console.log(지우기.성공 ? '   원격 가지도 거뒀다.' : `   ⚠ 원격 가지가 남았다(${지우기.오류 || '사유 모름'}) — 목록에 계속 뜬다.`);
  console.log('   로컬 워크트리 정리는 ExitWorktree(remove) 가 한다.\n');
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

  if (있나('--훅')) {
    /* 훅은 «조용히 실패»한다 — 세션 시작을 막지 않는다. 다만 못 읽었으면 그렇게 말한다. */
    if (!gh(['--version']).성공) return;
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

module.exports = { 기본가지, 현재가지, 워크트리인가, 캐시나이_분, 나이_시간, 열린것따기, 캐시경로 };
