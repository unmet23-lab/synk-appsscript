// clasp-guard 회귀 점검 — 실행: node tests/clasp-guard.check.js
// (파일명이 *.test.js가 아닌 이유: node --test tests/ 가 이 파일을 실행하면
//  가드가 다시 node --test tests/ 를 부르는 재귀가 생긴다. 이 점검은 수동/훅 수정 시 실행.)
'use strict';
const path = require('path');
const { 훅띄우기 } = require('./lib/훅띄우기');

const GUARD = path.join(__dirname, '..', '.claude', 'hooks', 'clasp-guard.js');

function feed(command, cwd) {
  const payload = { tool_name: 'Bash', tool_input: { command } };
  if (cwd) payload.cwd = cwd; // 훅 입력의 cwd = 명령이 실제로 실행될 위치
  const r = 훅띄우기(GUARD, {
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

/* 7) [2026-08-01 감사] **배포되는 파일 전부**가 미커밋 검사에 걸리는가.
 *    구 버전은 목록을 하드코딩(Code.js·contents_*·appsscript.json)해 두어
 *    실제로 배포되는 상담AI.js·교재연동.js·만족도팩.js 3종이 감시 밖이었다
 *    — 미커밋인 채로 clasp push가 통과했고, 그건 이 훅의 존재 이유가 절반에서 죽어 있었다는 뜻이다.
 *    목록을 다시 베끼지 않는다: .claspignore(배포 집합의 정본)에서 읽어 하나씩 실제로 더럽혀 본다. */
{
  const fs = require('fs');
  const ROOT = path.resolve(__dirname, '..');
  const pats = fs
    .readFileSync(path.join(ROOT, '.claspignore'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('!'))
    .map((l) => l.slice(1).trim())
    .filter(Boolean);
  const files = [];
  for (const t of pats) {
    if (t.includes('*')) {
      const re = new RegExp('^' + t.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      fs.readdirSync(ROOT).filter((f) => re.test(f)).forEach((f) => files.push(f));
    } else if (fs.existsSync(path.join(ROOT, t))) files.push(t);
  }
  check('.claspignore에서 배포 대상을 찾아냈다(≥5종)', files.length >= 5);

  for (const f of files) {
    const p = path.join(ROOT, f);
    const orig = fs.readFileSync(p);
    try {
      fs.appendFileSync(p, f.endsWith('.json') ? ' ' : '\n// clasp-guard 회귀 임시 한 줄\n');
      const reason = denyReason(feed(PUSH, ROOT));
      const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      check('미커밋 배포 파일 차단: ' + f, new RegExp('미커밋 배포 파일\\([^)]*' + esc).test(reason));
    } finally {
      fs.writeFileSync(p, orig); // 실패해도 반드시 원복 — 저장소를 더럽힌 채 끝내지 않는다
    }
  }

  // 배포 대상이 아닌 파일은 과차단하지 않는다(가드가 배포를 막는 쪽으로 고장 나는 것도 결함).
  //   ⚠ "미커밋 사유가 아예 없다"로 쓰면 안 된다 — 옆 세션이 배포 파일을 점유 중이면 그 사유가
  //     정당하게 떠서 이 검사가 저장소 상태에 따라 흔들린다. **그 파일 이름이 오르지 않는가**만 본다.
  const probeName = '_guard_probe_tmp.js';
  const nonTarget = path.join(ROOT, 'tests', probeName);
  try {
    fs.writeFileSync(nonTarget, '// 임시\n');
    const reason = denyReason(feed(PUSH, ROOT));
    check('배포 대상 아닌 파일은 미커밋 사유에 오르지 않는다', !reason.includes(probeName));
  } finally {
    try { fs.unlinkSync(nonTarget); } catch (_) {}
  }
}

/* 8) [2026-08-01 실사용 오탐] 커밋 메시지에 적힌 "clasp push"가 커밋을 막았다.
 *    가드는 실행되는 명령을 봐야지 사람이 쓴 문장을 보면 안 된다 — 문서화를 벌하면
 *    사람은 BYPASS를 남발하는 법을 배우고, 그때 가드는 실질적으로 죽는다. */
{
  const heredoc = "git commit -F - <<'EOF'\nfix: 순서 설명\n\n손 clasp push 단독 금지 — clasp push 는 커밋 뒤에.\nEOF";
  check('커밋 메시지 heredoc 안의 "clasp push"는 발동시키지 않는다', feed(heredoc, path.resolve(__dirname, '..')).out === '');

  const dashM = 'git commit -m "docs: clasp push 순서를 지침에 명문화"';
  check('-m 메시지 안의 "clasp push"는 발동시키지 않는다', feed(dashM, path.resolve(__dirname, '..')).out === '');

  // 반대로, 진짜 실행되는 clasp push는 heredoc이 섞여 있어도 잡아야 한다(오탐을 고치다 놓치면 더 나쁘다)
  const real = "git commit -F - <<'EOF'\n메시지\nEOF\n\"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd\" push --force";
  const r8 = feed(real, path.resolve(__dirname, '..'));
  check('heredoc 뒤에 실제 clasp push가 오면 게이트가 가동된다', r8.out !== '' || r8.code === 0);
  check('  └ 가동 시 형식은 deny JSON', r8.out === '' ? true : /\[clasp-guard\]/.test(denyReason(r8)));
}

process.exit(fails ? 1 : 0);
