#!/usr/bin/env node
// clasp-guard — clasp push/deploy 배포 게이트 (PreToolUse 훅)
// CLAUDE.md 신뢰성 조항의 기계 강제: /deploy 파이프라인의 불변식을 절차가 아니라 사실로 검사한다.
// 통과 시 출력 없이 종료(기존 권한 ask 흐름 유지), 위반 시 deny JSON을 낸다.
// 의도된 예외 절차(임시 doGet 러너 등)는 명령에 CLASP_GUARD_BYPASS=1 을 명시해 의식적으로 우회한다.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

let cmd = '';
let callerCwd = '';
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  cmd = String((input.tool_input && input.tool_input.command) || '');
  callerCwd = String(input.cwd || '').trim(); // 명령이 실제로 실행될 위치(워크트리면 워크트리 경로)
} catch (_) {
  process.exit(0);
}

/* 명령에서 **실행되지 않는 텍스트**를 먼저 걷어낸다.
 * 2026-08-01 실사용 오탐: 커밋 메시지에 절차를 설명하려고 "clasp push"라고 적었더니
 *   `git commit -F - <<'EOF' … clasp push … EOF` 의 heredoc 본문이 매칭돼 **커밋 자체가 막혔다**.
 *   가드는 실행되는 명령을 봐야지 사람이 쓴 문장을 보면 안 된다 — 문서화를 벌하는 가드는
 *   결국 사람이 우회하는 법(BYPASS 남발)을 배우게 만든다. */
/* 알맹이는 lib/shell-text.js 에 있다 — 2026-08-04 code-edit-guard 를 세우며 **두 번째 사본**이
 * 생길 뻔했다. 이 판정(heredoc·커밋 메시지·인용 산문)은 이미 두 번 틀렸는데, 가드마다 다시 적으면
 * 새 가드가 옛 오탐을 그대로 되밟는다. CLAUDE.md 「호출부마다 고치는 대신 공용 통로를 만든다」.
 *
 * ⚠ 다만 통째로 지우면 **인용된 실행 경로**(`"C:/…/clasp.cmd" push`)의 clasp가 같이 사라져
 *   진짜 배포를 놓친다. 그래서 지우는 게 아니라 **치환**한다: 인용 안이 clasp 실행 경로로
 *   끝나면 ` clasp `로, 아니면 ` QUOTED `로. 실행 경로는 살리고 산문만 죽인다.
 *   무엇을 살릴지는 가드마다 다르므로 여기서 정한다(공용 통로는 「어떻게」만 가진다). */
function stripNonExecutedText(s) {
  return require(path.join(__dirname, 'lib', 'shell-text.js')).stripNonExecutedText(s, {
    keepQuoted: /clasp(\.cmd|\.ps1|\.exe)?\s*$/i,
    keepAs: ' clasp ',
  });
}
const execCmd = stripNonExecutedText(cmd);

/* 배포 대상 프로젝트 판별 — 이 저장소에는 clasp 프로젝트가 **둘**이다(루트 · crewcard/).
 *
 * 2026-08-04 F061 실사고: 크루카드 배포가 메인의 무관한 미커밋(엔진_수집.js)과 빨간 테스트에 막혔다.
 *   배포 집합은 그 프로젝트의 디렉터리가 정하는데 가드는 항상 ROOT 기준으로 검사했다.
 *   결과는 오탐만이 아니었다 — **크루카드 코드는 보안 검사를 한 줄도 안 받고 있었다**(미탐).
 *   그리고 정당한 배포가 막히면 사람은 BYPASS 를 배운다(v6.11) — 우회 습관을 만드는 가드가
 *   가장 나쁜 가드다.
 *
 * 🔑 오판정의 두 방향이 **비대칭**이라 판별을 보수적으로 짠다:
 *     메인인데 서브로 봄 → 메인 검사가 통째로 안 돈다(미탐 · 위험)
 *     서브인데 메인으로 봄 → 기존 동작(오탐 · F061 재발이지만 안전)
 *   그래서 못 찾으면 ROOT 로 떨어진다. 폴백은 언제나 '더 많이 검사하는' 쪽이다.
 *
 * 판별·매칭의 알맹이는 lib/clasp-project.js 에 있다 — 훅 본문에 두면 **테스트가 불가능하다**
 * (훅을 한 번 실행하면 테스트 48개와 clasp 네트워크 조회까지 돈다). 회귀 tests/clasp프로젝트.test.js. */
const 프로젝트 = require(path.join(__dirname, 'lib', 'clasp-project.js'));
const PROJ = 프로젝트.resolveProject(cmd, callerCwd, ROOT);
const 서브 = path.resolve(PROJ) !== path.resolve(ROOT);
// git status 는 저장소 루트 상대 경로를 준다 — 서브 프로젝트 파일을 가리려면 이 접두사가 필요하다.
const PREFIX = 서브 ? path.relative(ROOT, PROJ).replace(/\\/g, '/') + '/' : '';
const 프로젝트명 = 서브 ? PREFIX.replace(/\/$/, '') : '(루트)';

/* 0-A) clasp pull 차단 — **읽기처럼 생겼는데 작업본 덮어쓰기**다(F040 실사고).
 *   라이브 잔재를 "확인"하려고 부른 pull이 메인 작업본 `Code.js`를 라이브(v9.154)로 되돌려
 *   옆 세션의 v9.155 커밋 내용이 로컬에서 사라졌다. 그때 복구된 이유는 그 파일이 **커밋돼 있어서**다
 *   (`git checkout` 한 번). 같은 명령이 **미커밋 편집**에 닿으면 git·stash·reflog 어디에도 사본이 없다
 *   — F025·F037이 「유일한 무보호 상태」라 부른 그것. **피해가 작았던 건 설계가 아니라 운이었다.**
 *   그래서 발생 1회에도 기계로 옮긴다(되돌림 비용이 「즉시 복구」가 아니라 「영구 소실」이라서).
 *
 *   push/deploy 판정보다 **앞**에 둔다 — pull은 배포가 아니라서 아래 게이트에 애초에 닿지 않는다.
 *   BYPASS는 존중한다: 라이브 편집을 정말로 회수하려는 정당한 용법이 있고, 못 끄는 가드는
 *   사람이 우회하는 법을 배우게 만든다(v6.11 「과잉 차단은 BYPASS 습관을 만든다」). */
if (/clasp(\.cmd|\.ps1)?["']?\s+(--?\S+\s+)*pull\b/i.test(execCmd) && !cmd.includes('CLASP_GUARD_BYPASS=1')) {
  deny(
    '[clasp-guard] clasp pull 차단 — 이건 읽기가 아니라 **작업본 덮어쓰기**다.\n' +
      '라이브를 확인하려던 pull이 옆 세션의 커밋 내용을 로컬에서 되돌린 실사고가 있다(F040).\n' +
      '미커밋 편집에 닿으면 git 어디에도 사본이 없어 복구 자체가 불가능하다.\n' +
      '\n✅ 정당한 용법 — **repo 밖 임시 디렉터리로 받아 작업본과 diff**(이건 막으려는 게 아니다):\n' +
      '     mkdir /tmp/live && cp .clasp.json /tmp/live/ && cd /tmp/live \\\n' +
      '       && CLASP_GUARD_BYPASS=1 clasp pull && diff -r /tmp/live <작업본>\n' +
      '   왜 필요한가: **편집기를 열어둔 채 clasp push하면 편집기의 오래된 버퍼가 나중에 자동 저장되며\n' +
      '   push를 덮어쓴다**(2026-08-04 실사고 — 그때 이 pull-diff가 유일한 발각 수단이었다).\n' +
      '   작업본 안에서 받는 것만 위험하다(F040) — 방향이 반대인 이 용법까지 접을 필요는 없다.\n' +
      '→ 그냥 라이브를 눈으로만 볼 거면 Apps Script 편집기가 더 싸다.\n' +
      '→ **작업본을** 라이브로 되돌리는 게 정말 의도라면 `git status` 전문으로 남의 미커밋 변경이\n' +
      '   없는지 확인한 뒤 CLASP_GUARD_BYPASS=1 을 붙인다.'
  );
}

// clasp 호출어 바로 뒤에 push/deploy가 올 때만 발동 — list-deployments, login 등은 통과
if (!/clasp(\.cmd|\.ps1)?["']?\s+(--?\S+\s+)*(push|deploy)\b/i.test(execCmd)) process.exit(0);

/* 5-A) 코드의 성질을 보는 보안 검사 — **BYPASS보다 앞**이다.
 *   08-02 옆 세션 지적: 임시 러너는 언제나 bypass로 push한다(러너 코드가 미커밋이라 우회하지 않으면
 *   3번 검사에 걸려 애초에 못 나간다). 이 검사를 아래에 두면 **고정 토큰·doGet 파괴 연산은
 *   그것들이 실제로 존재하는 유일한 경로에서 절대 발화하지 않는다** — 막으려던 것만 못 보는 가드.
 *   그래서 우회 레버를 늘리는 대신 기존 레버가 끌 수 있는 범위를 좁혔다.
 *   러너를 금지하는 게 아니라, 러너가 최소한 ScriptProperties 토큰 + doPost를 쓰게 강제한다.
 *   (워크트리에서 bypass로 부르면 이 검사만 메인 저장소 기준으로 도는 한계가 있다 — 아래 0번이
 *    워크트리 배포 자체를 막으므로 정상 경로에서는 닿지 않는다.) */
{
  let codeProblems;
  try {
    codeProblems = require(path.join(ROOT, 'tools', 'deploy-security-check.js')).checkCode(PROJ);
  } catch (e) {
    codeProblems = ['보안 검사(코드) 실행 실패: ' + String((e && e.message) || e).split('\n')[0]];
  }
  if (codeProblems.length) {
    deny(
      '[clasp-guard] 배포 게이트 차단 — **CLASP_GUARD_BYPASS로 끌 수 없는 항목**:\n- ' +
        codeProblems.join('\n- ') +
        '\n→ 임시 러너라도 토큰은 PropertiesService.getScriptProperties()에서 읽고,\n' +
        '   파괴적 연산은 doPost에 둔다. 이건 절차 위반이 아니라 코드 자체의 결함이라 우회 대상이 아니다.'
    );
  }
}

if (cmd.includes('CLASP_GUARD_BYPASS=1')) process.exit(0);

function run(bin, args) {
  return execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function gitAt(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// 0) 워크트리에서의 배포 차단 — 아래 4개 검사보다 앞. 워크트리에서 부르면 "내 워크트리는
//    깨끗한데 메인의 타 세션 미커밋 때문에 막힌다"는 엉뚱한 진단이 나온다(08-01 실측 3회 차단).
//    ⚠ ROOT를 "메인 저장소"라고 부르지 않는다 — 등록층이 ${CLAUDE_PROJECT_DIR:-$PWD} 라서
//    워크트리 세션에서는 워크트리의 훅 사본이 돌고 ROOT도 워크트리다(08-07 실측). 메인 경로는
//    아래 commonDir에서 파생한다. 예전 주석은 "절대경로 등록"을 전제했는데 그 전제가 죽어 있었고,
//    그 바람에 차단 사유가 "메인 저장소(<워크트리 자신>)에서 /deploy"라는 따를 수 없는 처방을 냈다.
//    그렇다고 워크트리 기준으로 검사하게 바꾸면 더 위험하다 — 라이브 타깃은 하나뿐이라
//    미병합 브랜치를 밀면 master에 이미 들어간 남의 최신 코드가 라이브에서 사라진다
//    (08-01 실측: 어떤 워크트리는 v9.89인데 master는 v9.95였다). 그래서 허용이 아니라 정확한 차단.
if (callerCwd) {
  try {
    const gitDir = path.resolve(gitAt(callerCwd, ['rev-parse', '--absolute-git-dir']));
    const commonDir = path.resolve(callerCwd, gitAt(callerCwd, ['rev-parse', '--git-common-dir']));
    if (gitDir !== commonDir) {
      let br = '';
      try { br = gitAt(callerCwd, ['rev-parse', '--abbrev-ref', 'HEAD']); } catch (_) {}
      // 메인 저장소 = commonDir(<메인>/.git)의 부모. ROOT를 쓰면 워크트리 세션에서 자기 자신을
      // 가리켜 "차단된 그 자리에서 /deploy 하라"는 따를 수 없는 처방이 된다(08-07 실측).
      const 메인 = path.dirname(commonDir);
      deny(
        '[clasp-guard] 배포 게이트 차단:\n' +
          `- 워크트리에서는 clasp push/deploy를 하지 않는다 (${path.basename(callerCwd)}${br ? ' · ' + br : ''})\n` +
          '  라이브 Apps Script는 하나뿐이라, 워크트리 파일을 밀면 그 사이 master에 들어간\n' +
          '  다른 세션의 최신 코드가 라이브에서 조용히 사라진다.\n' +
          `→ ①브랜치를 master에 반영(병합/rebase) ②메인 저장소(${메인})에서 /deploy\n` +
          '   메인이 타 세션 미커밋으로 지저분하면, 먼저 git push origin <내브랜치>:master 로\n' +
          '   백업만 해두고 라이브 반영은 메인이 깨끗해진 뒤 한 번에 한다.'
      );
    }
  } catch (_) {
    // 워크트리 판정 실패(git 없음·저장소 밖 등) → 아래 기존 검사로 계속 진행한다(폴백은 항상 검사 쪽)
  }
}

const problems = [];
let 게이트알림 = ''; // 재는 층이 평소와 달라졌을 때만 채운다 — 「안 돌린 것」이 조용히 통과와 같은 모양이면 안 된다

// 1) 배포되는 프로젝트의 *.js 전부 구문검사 (/deploy 2단계와 동일)
for (const f of fs.readdirSync(PROJ)) {
  if (!f.endsWith('.js')) continue;
  try {
    run(process.execPath, ['--check', path.join(PROJ, f)]);
  } catch (e) {
    const lines = String(e.stderr || e.message).trim().split('\n');
    const detail = lines.find((l) => /error/i.test(l)) || lines[0] || '';
    problems.push(`구문 오류 ${PREFIX}${f}: ${detail.trim()}`);
  }
}

/* 2) 안전 불변식 테스트 (구문이 깨져 있으면 의미 없으니 생략)
 *    node v24는 --test에 디렉토리를 못 받으므로 *.test.js를 명시 나열한다.
 *
 *    서브 프로젝트는 **그 프로젝트를 읽는 테스트만** 돈다(F061) — 메인의 무관한 빨간불이
 *    크루카드 배포를 막던 것이 정확히 이 자리다. 판별은 테스트 소스가 프로젝트 경로를
 *    참조하는가로 한다(목록을 손으로 적으면 파일이 늘 때 조용히 빠진다 · [[guard-must-check-result]]).
 *
 *    ⚠ 이 좁히기는 **미탐 방향**이다 — 고르기가 실패하면 「테스트 0건 통과」가 되어 초록으로 보인다.
 *      그래서 0건이면 통과가 아니라 **차단**한다(F047의 「목록이 조용히 비어도 초록」과 같은 처방). */
/* ⚠ **값싼 검사를 먼저 돌린다.** 이 블록은 원래 3·4번보다 **앞**에 있었는데, 그래서 「배포 파일이
 *   미커밋이다」라는 git 한 줄이면 알 답을 주려고 스위트를 5분 넘게 돌렸다. 실측 08-08:
 *   `tests/clasp-guard.check.js` 의 미커밋 검사가 그 때문에 **10분 타임아웃마저 넘겨** 완주한 적이
 *   없었다(F236·F238 이 「전체 점검 완주 미확인」으로 남긴 그 자리). 순서를 바꾸면 이미 막힐 것이
 *   확정된 배포에서 스위트를 아예 안 돈다 — 어차피 커밋한 뒤 재시도할 때 돈다. */
function 안전테스트검사() {
  if (problems.length) return; // 이미 막힐 것이 확정됐으면 5분짜리 스위트를 돌 이유가 없다
  const testFiles = 프로젝트.testsFor(PROJ, ROOT);
  if (서브 && !testFiles.length) {
    const key = PREFIX.replace(/\/$/, '');
    problems.push(
      `${프로젝트명} 프로젝트를 검사하는 테스트가 0건 — 고르기가 실패했거나 회귀가 없다.\n` +
      `  0건을 「통과」로 읽으면 배포가 무검증으로 나간다(그래서 통과가 아니라 차단이다).\n` +
      `  → tests/ 안에 "${key}" 를 참조하는 회귀를 두거나, 정말 예외면 CLASP_GUARD_BYPASS=1.`
    );
  }
  if (testFiles.length) {
    /* 🔑 재는 대상은 **작업본이 아니라 HEAD** 다 — 아래 3·4번이 배포집합 미커밋과 미push 를 막으므로
     *   나갈 바이트는 HEAD 의 것이고, 원격 CI 가 그 HEAD 를 통과시켰으면 이미 검증된 바이트다.
     *   작업본 전체를 재던 옛 판은 남의 진행 중 편집(배포집합 밖)이 무관한 배포를 상시로 막았다
     *   — F240 축 B. 판별의 재료·기각된 대안은 lib/clasp-project.js 의 `원격초록` 주석에 있다. */
    const 원격 = 프로젝트.원격초록(ROOT);
    /* ⚠ 「초록」만으로는 부족하다 — 원격ci 의 담는가는 `merge-base --is-ancestor` 라 **후손 커밋의
     *   run** 도 내 커밋을 담은 것으로 센다. 내가 origin 보다 뒤처져 있으면 그 초록은 내 나무가
     *   아니라 남의 더 새 나무를 검사한 것이고, 정작 clasp 가 미는 건 내 디스크의 옛 판이다
     *   (아래 4번은 「안 올라간 커밋」만 보지 「뒤처짐」은 안 본다 — 방향이 반대라 안 걸린다).
     *   그래서 지름길은 **HEAD 가 upstream 과 같을 때만** 쓴다. 못 재면(upstream 없음) 옛 동작. */
    let 뒤처짐 = null;
    try { 뒤처짐 = run('git', ['rev-list', '--count', 'HEAD..@{u}']).trim(); } catch (_) { /* upstream 없음 */ }
    if (원격.초록 && 뒤처짐 === '0') {
      게이트알림 =
        `[배포게이트] 로컬 스위트를 **안 돌렸다** — 원격 CI 가 이 HEAD 를 초록으로 통과시켰다.\n` +
        `  ${원격.출력}\n` +
        `  나갈 바이트는 HEAD 다(배포집합 미커밋 0 · origin push 완료 — 아래 3·4번이 강제). 작업본의\n` +
        `  적색이 남아 있다면 그건 **커밋 안 된 작업**이라 라이브와 무관하다(F240 축 B). 주인은\n` +
        `  \`list_sessions(하네스)\`, 저장소 초록 여부는 \`node tools/test-ci.js\` 로 따로 본다.`;
    } else {
      // 못 쟀거나 원격이 적색이면 오늘까지의 동작 그대로 — 로컬 작업본 전체를 돈다.
      /* 🔑 단 재는 **환경은 CI 모사 한 벌**(tools/lib/ci모사환경 — TZ=UTC·빈 HOME)이다 (F389).
       *   실 HOME 으로 돌리면 test-ci 가 skip 으로 드러내는 repo 밖 검사(메모리층)가 여기서만
       *   켜져서, 「CI 모사 초록 2895/0」인데 게이트가 **남의 메모리 상태**로 빨개진다 — 그 적색은
       *   배포자 트랙 밖이고, 그 줄을 적은 세션은 자기 test-ci 가 초록이라 볼 통로가 없다.
       *   게이트·모사·CI 가 같은 눈금이라야 「초록이면 나간다」가 성립한다. 게이트가 놓은
       *   메모리 위생의 발동 자리는 rot-check 재질의 절이 잇는다(배포를 막지 않는 warn 층). */
      let 모사;
      try { 모사 = require(path.join(ROOT, 'tools', 'lib', 'ci모사환경.js')).만들기(); } catch (e) {
        // 환경을 못 조립하면 재지 못한 것이다 — 폴백은 언제나 '더 많이 검사하는' 쪽 = 차단(F044 「실행 불가는 deny로」).
        problems.push('안전 테스트의 CI 모사 환경 조립 실패(tools/lib/ci모사환경.js): '
          + String((e && e.message) || e).split('\n')[0] + ' — 통과가 아니라 미실행이라 차단한다');
        return;
      }
      try {
        execFileSync(process.execPath, ['--test', ...testFiles.map((f) => path.join(ROOT, 'tests', f))],
          { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: 모사.env });
      } catch (_) {
        problems.push(
          `안전 테스트 실패(${프로젝트명} 관련 ${testFiles.length}개 · CI 모사 눈금 TZ=UTC·빈 HOME — test-ci 와 같다): ` +
          `node --test ${testFiles.map((f) => 'tests/' + f).join(' ')} 를 통과해야 배포 가능\n` +
          `  ⚠ 원격 CI 로는 못 갈랐다(${원격.초록 && 뒤처짐 !== '0'
            ? `원격은 초록인데 HEAD 가 upstream 보다 ${뒤처짐 === null ? '얼마나인지 모르게' : 뒤처짐 + '건'} 뒤처졌다 — 그 초록은 내 나무가 아니다`
            : 원격.출력}) — 그래서 작업본 전체를 쟀다.\n` +
          `  이 적색이 **내 배포집합 밖**이고 남의 미커밋 탓이면, HEAD 를 원격에 태워 초록을 받는 것이\n` +
          `  정상 통로다(BYPASS 아님): git push origin master → node tools/원격ci.js`
        );
      } finally { 모사.치우기(); }
    }
  }
}

/* 배포 대상 파일 목록 — **.claspignore가 유일 정본**이다(목록을 베끼지 않는다).
 * 2026-08-01 감사에서 발각: 여기에 목록을 하드코딩했더니 실제로 배포되는 상담AI.js·교재연동.js·
 * 만족도팩.js 3종이 감시 밖이었다 — 라이브가 git 이력보다 앞서가는 것을 막겠다는 이 훅의 존재
 * 이유가 정작 파일 절반에서 작동하지 않았다([[guard-must-check-result]] 패턴).
 * 판정은 lib/clasp-project.js 로 옮겼다(프로젝트가 둘이 되면서 순수 함수로 떼야 테스트가 된다). */
// 3) 배포 대상 파일 미커밋 금지 (커밋 → git push → clasp push 순서 강제)
//    무엇이 배포 대상인가는 lib/clasp-project.js 의 isDeployFile 이 판정한다 — 접두사 함정
//    (`crewcard/상담시트.js` 가 `*.js` 에 안 걸리는 것)이 거기 주석과 회귀에 못박혀 있다.
try {
  // core.quotepath=false — 끄지 않으면 한글 파일명이 "\354\203\201…" 로 이스케이프돼 매칭이 통째로 빗나간다
  //   (상담AI.js·교재연동.js·만족도팩.js가 전부 한글이라 이 한 줄이 없으면 목록을 고쳐도 여전히 못 잡는다)
  const dirty = run('git', ['-c', 'core.quotepath=false', 'status', '--porcelain'])
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      let p = l.slice(3).trim();
      const arrow = p.indexOf(' -> '); // rename: "R  old -> new" → 새 이름이 배포 대상인지 본다
      if (arrow !== -1) p = p.slice(arrow + 4).trim();
      return p.replace(/^"|"$/g, '');
    })
    .filter((p) => 프로젝트.isDeployFile(p, PROJ, ROOT));
  if (dirty.length) problems.push(`미커밋 배포 파일(${dirty.join(', ')}): 커밋 먼저`);
} catch (_) {
  problems.push('git status 확인 실패 — 저장소 상태를 확인할 수 없어 차단');
}

// 4) GitHub 백업 선행 (라이브가 git 이력보다 앞서가는 것 금지)
try {
  const n = run('git', ['rev-list', '--count', 'origin/master..master']).trim();
  if (n !== '0') problems.push(`GitHub 미push 커밋 ${n}건: git push origin master 먼저`);
} catch (_) {
  // origin 참조가 없으면 이 검사는 건너뜀
}

// 2) 를 여기서 부른다 — 위 두 검사가 git 한 줄이고 이건 분 단위라서다(위 ⚠ 주석 참조).
안전테스트검사();

/* 5-B) 임시 배포 잔존 — **순간의 성질**이라 여기(BYPASS 뒤)가 맞다.
 *    러너를 돌리는 도중엔 임시 배포가 있는 게 정상이고, 러너가 끝난 뒤 정상 push에서 잡히면 된다.
 *    08-02 실측: 이 검사가 살아남은 배포 4개(@28~@31)를 실제로 잡았다.
 *    **코드를 지워도 라이브는 안 닫힌다** — versioned 배포는 그 시점 코드를 영구 서빙한다.
 *    모듈이 깨지면 통과가 아니라 차단이다(이 파일 3번 검사의 'git status 확인 실패'와 같은 방향). */
try {
  problems.push(...require(path.join(ROOT, 'tools', 'deploy-security-check.js')).checkDeployments(PROJ));
} catch (e) {
  problems.push(
    '배포 표면 검사 실행 실패(tools/deploy-security-check.js): ' +
      String((e && e.message) || e).split('\n')[0]
  );
}

/* 5-C) 이종(GPT/Codex) 검수 확인 — **BYPASS 뒤**가 맞다.
 *    임시 doGet 러너는 언제나 bypass로 나가는데(러너 코드가 미커밋이라), 그 미커밋 임시 코드에
 *    5분짜리 이종 검수를 요구하면 따를 수 없는 처방이 된다 — 그런 처방은 우회를 정상 통로로
 *    만든다(F103). 5-A(보안)와 달리 이건 절차 층이라 의식적 우회를 존중한다.
 *
 *    🔑 **차단하는 것은 「검수 안 함」이 아니라 「차단급 지적을 안 고치고 배포」뿐이다.**
 *      검수를 돌릴 자격증명이 없는 환경은 늘 있다(CI 러너·새 기계·키 만료 직후).
 *      「검수 없으면 차단」으로 짜면 그 환경이 통째로 죽는다 — 따를 수 없는 처방의 교과서적 형태다.
 *      그래서 없으면 알리고(none/scope), 지적을 무시하면 막는다(block). 처방은 둘 다 실행 가능하다:
 *      고치거나, 사유를 달아 기각하거나.
 *
 *    검수 자체는 여기서 돌리지 않는다 — 훅 안에서 5분을 쓸 수는 없다. 이건 **조회**다(네트워크 0). */
let 검수알림 = '';
try {
  const r = require(path.join(ROOT, 'tools', 'codex-review.js')).게이트판정(PROJ, ROOT);
  if (r.level === 'block') problems.push(r.lines.join('\n  '));
  else if (r.level !== 'ok') 검수알림 = r.lines.join('\n');
} catch (e) {
  // 게이트가 죽어도 배포는 막지 않는다(절차 층이라). 단 **조용히 넘기지도 않는다**.
  검수알림 =
    '[이종검수] 게이트 실행 실패 — 검수 여부를 **확인 못 했다**: ' +
    String((e && e.message) || e).split('\n')[0] +
    '\n통과가 아니라 미실행이다.';
}

if (problems.length) {
  deny(
    `[clasp-guard] 배포 게이트 차단 — 프로젝트 ${프로젝트명}:\n- ` +
      problems.join('\n- ') +
      // 다른 사유로 막을 때도 「스위트를 안 돌렸다」는 사실은 같이 나가야 한다 —
      // 여기서 빠지면 통과와 「안 잰 것」이 사용자 눈에 같은 모양이 된다.
      (게이트알림 ? `\n\n${게이트알림}` : '') +
      '\n→ /deploy 스킬 순서(구문검사→테스트→커밋→git push→clasp push)로 진행할 것. 검증된 예외 절차만 CLASP_GUARD_BYPASS=1 로 우회.'
  );
}

/* 6) 배포 뒤 라이브 1회 실행이 필요한가 (F081) — **차단이 아니라 할 일 목록**이다.
 *    막으면 실행 자체가 불가능해지므로 여기서 막는 건 뜻이 없다. 대신 배포가 나가는
 *    바로 이 순간에 스스로 말하게 한다 — 프로즈로 두면 다음 배포에서 잊는다
 *    (CLAUDE.md 「장치와 그 발동 조건은 같은 커밋에서 정한다」).
 *    기준점은 **직전 버전 태그**다: bump-version 이 배포마다 태그를 채므로,
 *    HEAD^ 에서 보이는 최신 태그가 「지난 배포」다(이번 배포의 태그는 HEAD 에 있어 빠진다). */
/* ⚠ 알림은 **한 번만** 쓴다 — stdout 에 JSON 객체를 두 번 쓰면 통째로 파싱에 실패해
 *   두 알림이 **둘 다** 사라진다(실패 방향은 여기서도 「조용함」이다). 그래서 모아서 한 번. */
const 알림들 = [];
if (게이트알림) 알림들.push(게이트알림);
if (검수알림) 알림들.push(검수알림);

try {
  const 점검 = require(path.join(ROOT, 'tools', '실행층점검.js'));
  let range;
  try {
    range = run('git', ['describe', '--tags', '--abbrev=0', '--match', 'synk-v*', 'HEAD^']).trim() + '..HEAD';
  } catch (_) {
    range = ''; // 태그가 없으면 도구의 기본값(마지막 커밋)으로 — 그 사실은 도구가 스스로 밝힌다
  }
  const 글 = 점검.체크리스트(점검.훑기({ range, 프로젝트: PROJ }));
  if (글) 알림들.push(글);
} catch (e) {
  // 이 검사가 죽어도 배포는 막지 않는다(할 일 목록이지 게이트가 아니다). 단 조용히 넘기지도 않는다.
  알림들.push('[실행층점검] 실행 실패 — 배포 뒤 필수 실행 목록을 **못 만들었다**: '
    + String((e && e.message) || e).split('\n')[0]
    + '\n통과가 아니라 미실행이다. 폼·드라이브를 만졌다면 직접 확인할 것(F081).');
}

if (알림들.length) {
  const 글 = 알림들.join('\n\n');
  process.stdout.write(JSON.stringify({
    systemMessage: 글,
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 글 },
  }));
}
process.exit(0);
