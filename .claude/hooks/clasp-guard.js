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
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  cmd = String((input.tool_input && input.tool_input.command) || '');
} catch (_) {
  process.exit(0);
}

// clasp 호출어 바로 뒤에 push/deploy가 올 때만 발동 — list-deployments, login 등은 통과
if (!/clasp(\.cmd|\.ps1)?["']?\s+(--?\S+\s+)*(push|deploy)\b/i.test(cmd)) process.exit(0);
if (cmd.includes('CLASP_GUARD_BYPASS=1')) process.exit(0);

function run(bin, args) {
  return execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

// 3) 배포 대상 파일 미커밋 금지 (커밋 → git push → clasp push 순서 강제)
try {
  const dirty = run('git', ['status', '--porcelain'])
    .split('\n')
    .filter(Boolean)
    .filter((l) => /^(Code\.js|contents_[^/]*\.js|appsscript\.json)$/.test(l.slice(3).replace(/"/g, '').trim()));
  if (dirty.length) problems.push(`미커밋 배포 파일(${dirty.map((l) => l.slice(3).trim()).join(', ')}): 커밋 먼저`);
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
