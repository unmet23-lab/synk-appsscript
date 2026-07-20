// clasp-guard 회귀 점검 — 실행: node tests/clasp-guard.check.js
// (파일명이 *.test.js가 아닌 이유: node --test tests/ 가 이 파일을 실행하면
//  가드가 다시 node --test tests/ 를 부르는 재귀가 생긴다. 이 점검은 수동/훅 수정 시 실행.)
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const GUARD = path.join(__dirname, '..', '.claude', 'hooks', 'clasp-guard.js');

function feed(command) {
  const r = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    timeout: 120000,
  });
  return { code: r.status, out: (r.stdout || '').trim() };
}

let fails = 0;
function check(name, cond) {
  console.log((cond ? 'ok   ' : 'FAIL ') + name);
  if (!cond) fails++;
}

// 1) clasp 무관 명령 → 무개입(출력 없음)
let r = feed('git status');
check('무관 명령 통과', r.code === 0 && r.out === '');

// 2) 읽기성 clasp 명령 → 무개입
r = feed('"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" list-deployments');
check('list-deployments 통과', r.code === 0 && r.out === '');

// 3) 의식적 우회 → 무개입
r = feed('CLASP_GUARD_BYPASS=1 "/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" push --force');
check('BYPASS 우회 통과', r.code === 0 && r.out === '');

// 4) clasp push → 게이트 가동: 결과는 (a) 무출력=불변식 전부 통과 또는 (b) deny JSON.
//    저장소 상태에 따라 달라지므로 "형식이 올바른가"만 고정 검증한다.
r = feed('"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" push --force');
if (r.out === '') {
  check('push 게이트: 불변식 전부 통과(무개입)', r.code === 0);
} else {
  let ok = false;
  try {
    const j = JSON.parse(r.out);
    ok =
      j.hookSpecificOutput &&
      j.hookSpecificOutput.permissionDecision === 'deny' &&
      /\[clasp-guard\]/.test(j.hookSpecificOutput.permissionDecisionReason);
  } catch (_) {}
  check('push 게이트: deny JSON 형식', r.code === 0 && ok);
  console.log('  (현재 저장소 상태 기준 차단 사유)');
  console.log('  ' + JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason.split('\n').join('\n  '));
}

process.exit(fails ? 1 : 0);
