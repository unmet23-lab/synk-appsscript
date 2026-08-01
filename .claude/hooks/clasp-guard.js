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
    .replace(/(-m|--message)\s+(['"])[\s\S]*?\2/g, '$1 MSG');
}
const execCmd = stripNonExecutedText(cmd);

// clasp 호출어 바로 뒤에 push/deploy가 올 때만 발동 — list-deployments, login 등은 통과
if (!/clasp(\.cmd|\.ps1)?["']?\s+(--?\S+\s+)*(push|deploy)\b/i.test(execCmd)) process.exit(0);
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

// 1) 루트 *.js 전부 구문검사 (/deploy 2단계와 동일)
for (const f of fs.readdirSync(ROOT)) {
  if (!f.endsWith('.js')) continue;
  try {
    run(process.execPath, ['--check', path.join(ROOT, f)]);
  } catch (e) {
    const lines = String(e.stderr || e.message).trim().split('\n');
    const detail = lines.find((l) => /error/i.test(l)) || lines[0] || '';
    problems.push(`구문 오류 ${f}: ${detail.trim()}`);
  }
}

// 2) 안전 불변식 테스트 (구문이 깨져 있으면 의미 없으니 생략)
//    node v24는 --test에 디렉토리를 못 받으므로 *.test.js를 명시 나열한다.
if (problems.length === 0) {
  const testFiles = fs
    .readdirSync(path.join(ROOT, 'tests'))
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => path.join(ROOT, 'tests', f));
  if (testFiles.length) {
    try {
      run(process.execPath, ['--test', ...testFiles]);
    } catch (_) {
      problems.push('안전 테스트 실패: node --test tests/*.test.js 를 통과해야 배포 가능');
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
function deployTargets() {
  try {
    const pats = fs
      .readFileSync(path.join(ROOT, '.claspignore'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('!'))
      .map((l) => l.slice(1).trim())
      .filter(Boolean);
    if (pats.length) return pats;
  } catch (_) {}
  // .claspignore를 못 읽으면 넓게 잡는다 — 폴백은 항상 '더 많이 검사하는' 쪽
  return ['appsscript.json', '*.js'];
}
function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
}

// 3) 배포 대상 파일 미커밋 금지 (커밋 → git push → clasp push 순서 강제)
try {
  const targets = deployTargets().map(globToRe);
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
    .filter((p) => targets.some((re) => re.test(p)));
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

if (problems.length) {
  deny(
    '[clasp-guard] 배포 게이트 차단:\n- ' +
      problems.join('\n- ') +
      '\n→ /deploy 스킬 순서(구문검사→테스트→커밋→git push→clasp push)로 진행할 것. 검증된 예외 절차만 CLASP_GUARD_BYPASS=1 로 우회.'
  );
}
process.exit(0);
