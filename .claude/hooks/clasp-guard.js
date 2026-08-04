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
function stripNonExecutedText(s) {
  return s
    // heredoc 본문: <<EOF / <<'EOF' / <<-"EOF" … 줄 처음의 같은 태그까지
    .replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm, ' <<HEREDOC ')
    // -m / --message 의 인용 문자열 본문
    .replace(/(-m|--message)\s+(['"])[\s\S]*?\2/g, '$1 MSG')
    /* 인용된 인자 본문 — 2026-08-04 재발: `grep -n "…clasp pull 차단…"` 이 차단됐다.
     * 08-01 heredoc 오탐과 **같은 계열**이다(실행되지 않는 텍스트를 명령으로 읽음). 그때는
     * heredoc만 막았는데, 인용 인자에도 같은 구멍이 있었다 — 검색·문서화가 벌받으면
     * 사람은 BYPASS를 배운다(v6.11).
     * ⚠ 다만 통째로 지우면 **인용된 실행 경로**(`"C:/…/clasp.cmd" push`)의 clasp가 같이 사라져
     *   진짜 배포를 놓친다. 그래서 지우는 게 아니라 **치환**한다: 인용 안이 clasp 실행 경로로
     *   끝나면 ` clasp `로, 아니면 ` QUOTED `로. 실행 경로는 살리고 산문만 죽인다. */
    .replace(/(['"])([\s\S]*?)\1/g, (m, _q, body) =>
      /clasp(\.cmd|\.ps1|\.exe)?\s*$/i.test(body) ? ' clasp ' : ' QUOTED ');
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
 * clasp 는 cwd 의 .clasp.json 으로 대상을 정한다. `cd crewcard && clasp push` 처럼 한 호출 안에서
 * 옮겨가는 형태가 일반적이라 cwd 만 보면 항상 메인으로 판정한다 — 그래서 명령을 세그먼트로 쪼개
 * **clasp 가 도는 시점의 디렉터리**를 확정한다(그 뒤의 cd 는 배포와 무관하다).
 * 원본 cmd 를 보되 `^cd …$` 형태의 세그먼트만 인정하므로, 커밋 메시지 안에 적힌 문장에는 안 속는다. */
function deployProjectRoot() {
  const base = callerCwd && fs.existsSync(callerCwd) ? callerCwd : ROOT;
  let dir = base;
  for (const seg of cmd.split(/&&|\|\||;|\n/)) {
    const m = /^\s*(?:cd|pushd|Set-Location|sl)\s+(?:-\S+\s+)*(['"]?)(.+?)\1\s*$/i.exec(seg);
    if (m) {
      const p = m[2].trim();
      if (p && p !== '-') dir = path.resolve(dir, p);
      continue;
    }
    if (/clasp/i.test(seg)) break; // 여기서 배포가 돈다 — 디렉터리 확정
  }
  for (let cur = dir, i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(cur, '.clasp.json'))) return cur;
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return ROOT;
}
const PROJ = deployProjectRoot();
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

// 0) 워크트리에서의 배포 차단 — 아래 4개 검사보다 앞. 이 훅은 settings.json에 절대경로로 등록돼
//    ROOT가 항상 메인 저장소를 가리키므로, 워크트리에서 부르면 "내 워크트리는 깨끗한데 메인의
//    타 세션 미커밋 때문에 막힌다"는 엉뚱한 진단이 나온다(08-01 실측 3회 차단).
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
      deny(
        '[clasp-guard] 배포 게이트 차단:\n' +
          `- 워크트리에서는 clasp push/deploy를 하지 않는다 (${path.basename(callerCwd)}${br ? ' · ' + br : ''})\n` +
          '  라이브 Apps Script는 하나뿐이라, 워크트리 파일을 밀면 그 사이 master에 들어간\n' +
          '  다른 세션의 최신 코드가 라이브에서 조용히 사라진다.\n' +
          `→ ①브랜치를 master에 반영(병합/rebase) ②메인 저장소(${ROOT})에서 /deploy\n` +
          '   메인이 타 세션 미커밋으로 지저분하면, 먼저 git push origin <내브랜치>:master 로\n' +
          '   백업만 해두고 라이브 반영은 메인이 깨끗해진 뒤 한 번에 한다.'
      );
    }
  } catch (_) {
    // 워크트리 판정 실패(git 없음·저장소 밖 등) → 아래 기존 검사로 계속 진행한다(폴백은 항상 검사 쪽)
  }
}

const problems = [];

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
if (problems.length === 0) {
  const 전체 = fs
    .readdirSync(path.join(ROOT, 'tests'))
    .filter((f) => f.endsWith('.test.js'));
  let testFiles;
  if (서브) {
    const key = PREFIX.replace(/\/$/, '');
    testFiles = 전체.filter((f) => {
      try { return fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8').includes(key); }
      catch (_) { return false; }
    });
    if (!testFiles.length) {
      problems.push(
        `${프로젝트명} 프로젝트를 검사하는 테스트가 0건 — 고르기가 실패했거나 회귀가 없다.\n` +
        `  0건을 「통과」로 읽으면 배포가 무검증으로 나간다(그래서 통과가 아니라 차단이다).\n` +
        `  → tests/ 안에 "${key}" 를 참조하는 회귀를 두거나, 정말 예외면 CLASP_GUARD_BYPASS=1.`
      );
    }
  } else {
    testFiles = 전체;
  }
  if (testFiles.length) {
    try {
      run(process.execPath, ['--test', ...testFiles.map((f) => path.join(ROOT, 'tests', f))]);
    } catch (_) {
      problems.push(
        `안전 테스트 실패(${프로젝트명} 관련 ${testFiles.length}개): ` +
        `node --test ${testFiles.map((f) => 'tests/' + f).join(' ')} 를 통과해야 배포 가능`
      );
    }
  }
}

/* 배포 대상 파일 목록 — **.claspignore가 유일 정본**이다.
 * 2026-08-01 감사에서 발각: 여기에 목록을 하드코딩했더니(Code.js·contents_*·appsscript.json)
 * 실제로 배포되는 상담AI.js·교재연동.js·만족도팩.js 3종이 감시 밖이었다. 즉 그 파일들은
 * **미커밋인 채로 clasp push가 통과**했다 — 라이브가 git 이력보다 앞서가는 것을 막겠다는
 * 이 훅의 존재 이유가 정작 파일 절반에서 작동하지 않았다.
 * .claspignore 주석은 그 3종이 빠지면 "반쪽 배포"라고 스스로 적어 두었는데 가드만 몰랐다.
 * → 목록을 베끼지 않는다. 배포 집합을 정하는 파일에서 그대로 읽는다([[guard-must-check-result]] 패턴). */
function deployTargets(root) {
  try {
    const pats = fs
      .readFileSync(path.join(root, '.claspignore'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('!'))
      .map((l) => l.slice(1).trim())
      .filter(Boolean);
    if (pats.length) return pats;
  } catch (_) {}
  /* .claspignore가 없으면 넓게 잡는다 — 폴백은 항상 '더 많이 검사하는' 쪽.
   * crewcard/ 가 정확히 이 경우다(허용목록이 없어 clasp가 디렉터리 전부를 민다).
   * .html 을 빼면 카드_kr/mn.html 이 미커밋인 채 배포될 수 있다 — 그 둘이 크루카드 화면 자체다. */
  return ['appsscript.json', '*.js', '*.gs', '*.html', '*.json'];
}
function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
}

// 3) 배포 대상 파일 미커밋 금지 (커밋 → git push → clasp push 순서 강제)
try {
  const targets = deployTargets(PROJ).map(globToRe);
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
    /* 그 프로젝트가 실제로 배포하는 파일만 본다(F061).
     * git status 는 저장소 루트 상대 경로를 주므로, 서브 프로젝트는 접두사를 떼고 매칭한다 —
     * 접두사를 안 떼면 `crewcard/상담시트.js` 가 `*.js`(= `^[^/]*\.js$`)에 안 걸려 **전부 통과**한다.
     * 반대로 루트 배포에서는 하위 디렉터리 파일이 `[^/]*` 때문에 자연히 빠진다. */
    .filter((p) => {
      if (서브) {
        if (!p.startsWith(PREFIX)) return false;
        return targets.some((re) => re.test(p.slice(PREFIX.length)));
      }
      return targets.some((re) => re.test(p));
    });
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

if (problems.length) {
  deny(
    `[clasp-guard] 배포 게이트 차단 — 프로젝트 ${프로젝트명}:\n- ` +
      problems.join('\n- ') +
      '\n→ /deploy 스킬 순서(구문검사→테스트→커밋→git push→clasp push)로 진행할 것. 검증된 예외 절차만 CLASP_GUARD_BYPASS=1 로 우회.'
  );
}
process.exit(0);
