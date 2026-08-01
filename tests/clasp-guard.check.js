// clasp-guard 회귀 점검 — 실행: node tests/clasp-guard.check.js
// (파일명이 *.test.js가 아닌 이유: node --test tests/ 가 이 파일을 실행하면
//  가드가 다시 node --test tests/ 를 부르는 재귀가 생긴다. 이 점검은 수동/훅 수정 시 실행.)
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const GUARD = path.join(__dirname, '..', '.claude', 'hooks', 'clasp-guard.js');

function feed(command, cwd) {
  const payload = { tool_name: 'Bash', tool_input: { command } };
  if (cwd) payload.cwd = cwd; // 훅 입력의 cwd = 명령이 실제로 실행될 위치
  const r = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 120000,
  });
  return { code: r.status, out: (r.stdout || '').trim() };
}
const PUSH = '"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" push --force';
function denyReason(r) {
  try {
    const j = JSON.parse(r.out);
    return (j.hookSpecificOutput && j.hookSpecificOutput.permissionDecision === 'deny')
      ? String(j.hookSpecificOutput.permissionDecisionReason || '') : '';
  } catch (_) { return ''; }
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

// 5) 워크트리에서의 push → 워크트리 사유로 차단(08-01: 메인 상태를 보고 엉뚱한 진단을 내던 결함)
//    라이브 타깃이 하나라 미병합 브랜치를 밀면 master의 최신 코드가 라이브에서 사라진다 → 허용이 아니라 정확한 차단.
{
  const fs = require('fs');
  const wtDir = path.join(__dirname, '..', '.claude', 'worktrees');
  let wt = '';
  try {
    wt = (fs.readdirSync(wtDir, { withFileTypes: true }).find((d) => d.isDirectory() &&
      fs.existsSync(path.join(wtDir, d.name, '.git'))) || {}).name || '';
  } catch (_) {}
  if (!wt) {
    console.log('skip 워크트리 차단 — 검사할 워크트리가 없음(정상: 전부 정리된 상태)');
  } else {
    const reason = denyReason(feed(PUSH, path.join(wtDir, wt)));
    check('워크트리 push 차단', /워크트리에서는 clasp push/.test(reason));
    check('워크트리 차단 사유에 복구 절차 포함', /메인 저장소.*\/deploy/s.test(reason));
  }
}

// 6) 메인 저장소 cwd는 종전과 동일하게 동작한다(워크트리 차단이 정상 배포를 막지 않는다)
{
  const main = path.resolve(__dirname, '..');
  const r = feed(PUSH, main);
  const reason = denyReason(r);
  check('메인 cwd는 워크트리로 오판하지 않음', !/워크트리에서는 clasp push/.test(reason));
  check('메인 cwd 응답 형식 유지', r.code === 0 && (r.out === '' || reason !== ''));
}

process.exit(fails ? 1 : 0);
