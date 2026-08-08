#!/usr/bin/env node
// clasp-project — 「이 명령은 어느 clasp 프로젝트를 배포하는가」 (clasp-guard 공용 통로)
//
// 왜 뗐나: 이 저장소에는 clasp 프로젝트가 둘이고(루트 · crewcard/), 판별이 틀리면
//   가드가 통째로 엉뚱한 것을 검사한다(F061). 그런데 훅 본문에 두면 **테스트가 불가능하다** —
//   훅을 실행하면 테스트 48개와 clasp 네트워크 조회까지 돌아 회귀로 쓸 수가 없다.
//   판별과 매칭만 떼면 순수 함수라 픽스처로 못박을 수 있다(handoff-store 와 같은 패턴).
'use strict';
const fs = require('fs');
const path = require('path');

/* 명령이 실제로 배포하는 프로젝트 루트.
 *
 * clasp 는 cwd 의 .clasp.json 으로 대상을 정한다. `cd crewcard && clasp push` 처럼 한 호출 안에서
 * 옮겨가는 형태가 일반적이라 cwd 만 보면 항상 메인으로 판정한다. 그래서 명령을 세그먼트로 쪼개
 * **clasp 가 도는 시점의 디렉터리**를 확정한다(그 뒤의 cd 는 배포와 무관하다).
 *
 * 🔑 오판정의 두 방향이 비대칭이라 보수적으로 짠다:
 *     메인인데 서브로 봄  → 메인 검사가 통째로 안 돈다(미탐 · 위험)
 *     서브인데 메인으로 봄 → 기존 동작(오탐 · F061 재발이지만 안전)
 *   그래서 못 찾으면 root 로 떨어진다. 폴백은 언제나 '더 많이 검사하는' 쪽이다.
 *
 * `^cd …$` 형태의 세그먼트만 인정하므로 커밋 메시지 안에 적힌 문장에는 안 속는다.
 */
function resolveProject(cmd, callerCwd, root) {
  const base = callerCwd && fs.existsSync(callerCwd) ? callerCwd : root;
  let dir = base;
  for (const seg of String(cmd || '').split(/&&|\|\||;|\n/)) {
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
  return root;
}

/* 배포 대상 파일 패턴 — **.claspignore가 유일 정본**이다(목록을 베끼지 않는다).
 * .claspignore 가 없는 프로젝트(crewcard 가 그렇다 — clasp 가 디렉터리 전부를 민다)는 넓게 잡는다.
 * .html 을 빼면 카드_kr/mn.html 이 미커밋인 채 배포될 수 있는데, 그 둘이 크루카드 화면 자체다. */
function deployTargets(projRoot) {
  try {
    const pats = fs.readFileSync(path.join(projRoot, '.claspignore'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('!'))
      .map((l) => l.slice(1).trim())
      .filter(Boolean);
    if (pats.length) return pats;
  } catch (_) {}
  return ['appsscript.json', '*.js', '*.gs', '*.html', '*.json'];
}

function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
}

/* git status 가 준 **저장소 루트 상대 경로**가 이 프로젝트의 배포 대상인가.
 *
 * ⚠ 함정: 글롭의 `*` 는 `[^/]*` 라 디렉터리를 건너지 않는다. 그래서 접두사를 떼지 않으면
 *   `crewcard/상담시트.js` 가 `*.js` 에 **안 걸려 전부 통과**한다(가드가 새는 방향은 언제나 통과).
 *   반대로 루트 배포에서는 같은 이유로 하위 디렉터리 파일이 자연히 빠진다 — 그게 맞는 동작이다. */
function isDeployFile(repoRelPath, projRoot, root) {
  const prefix = path.relative(root, projRoot).replace(/\\/g, '/');
  const res = deployTargets(projRoot).map(globToRe);
  let p = String(repoRelPath || '');
  if (prefix) {
    if (!p.startsWith(prefix + '/')) return false;
    p = p.slice(prefix.length + 1);
  }
  return res.some((re) => re.test(p));
}

/* 이 프로젝트를 검사하는 테스트 파일 목록.
 * 판별 = 테스트 소스가 프로젝트 경로를 참조하는가(목록을 손으로 적으면 파일이 늘 때 조용히 빠진다).
 * 루트 프로젝트는 전부 돈다 — 좁힐 근거가 없다.
 *
 * ⚠ 이 좁히기는 **미탐 방향**이다. 0건이면 「통과」가 아니라 호출부가 차단해야 한다
 *   (F047 의 「목록이 조용히 비어도 초록」과 같은 처방). 그래서 여기서는 사실만 돌려준다. */
function testsFor(projRoot, root) {
  const dir = path.join(root, 'tests');
  let all = [];
  try { all = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')); } catch (_) { return []; }
  const prefix = path.relative(root, projRoot).replace(/\\/g, '/');
  if (!prefix) return all;
  return all.filter((f) => {
    try { return fs.readFileSync(path.join(dir, f), 'utf8').includes(prefix); }
    catch (_) { return false; }
  });
}

/* 원격 CI 가 **지금 HEAD** 를 초록으로 통과시켰는가.
 *
 * 왜 있나 (F240 축 B · 2026-08-08): 배포 게이트가 저장소 **작업본 전체**를 재는 바람에, 세션이
 *   10개 넘게 도는 시간대엔 남의 진행 중 편집이 무관한 배포를 상시로 막았다. 실측 2회 — 남이
 *   편집 중이던 `board-guard.js` 의 ReferenceError, 두 저장소 사이에서 갈라진 계약 JSON. 둘 다
 *   배포집합 15개 밖이고 둘 다 남의 살아있는 작업본이라 F073 으로 손댈 수 없다. 처방이 「고쳐라」
 *   인데 고칠 권한이 없는 형태(F103 축)라, 규칙을 지키는 쪽이 밀리고 라이브가 조용히 뒤처졌다.
 *
 * 🔑 **배포되는 바이트는 작업본이 아니라 HEAD 다.** 검사 3 이 배포집합 미커밋을 막고 검사 4 가
 *   미push 를 막으므로, 그 둘을 통과한 시점의 배포집합 = HEAD 의 배포집합 = origin 의 그것이다.
 *   그러니 원격 CI 가 그 HEAD 를 초록으로 통과시켰다면 나갈 바이트는 **이미 검증됐고**, 작업본의
 *   적색은 정의상 커밋 안 된 작업이라 라이브와 무관하다. 우회가 아니라 재는 대상을 바로잡는 것이다.
 *   (syntax-check.yml 은 `node --test tests/*.test.js` 로 스위트 전량을 돈다 — 구문만 보는 게 아니다.)
 *
 * ⚠ 정적 이름 매칭으로 「배포집합을 검사하는 테스트」를 고르는 안은 **실측이 기각했다**: 배포 파일
 *   이름으로 테스트 소스를 훑으면 107개 중 45개가 걸리는데 그 안에 `board-guard.test.js` 가 있다
 *   (`Code.js` 가 보드 표 **픽스처 문자열**로 들어 있다). F240 실측 ① 을 그대로 놓치는 판별자다.
 *
 * ⚠ 못 재면 초록이라 하지 않는다 — gh 가 없거나(폰 클라우드) run 이 0건이면 false 로 떨어져
 *   호출부가 로컬 스위트를 그대로 돈다. 새는 방향이 「오늘과 같음」이라 F103 을 안 만든다.
 *
 * ⚠ **창이 좁다는 것을 알고 쓴다**: /deploy 는 push(6단계) 직후에 clasp push(7단계)를 하는데
 *   CI 완주는 3~4분 걸리므로 그 순간엔 대개 「대기」다. 게다가 이 저장소는 세션이 여럿이라 그
 *   사이 남이 커밋하면 HEAD 가 옮겨가 미push 가 된다(실측). 즉 지름길은 **재시도에서** 열린다 —
 *   그래도 옛 판은 「남의 편집이 끝날 때까지 무한정」이었고 지금은 「몇 분 뒤 열린다」다.
 *   창을 넓히려고 「배포집합 바이트가 같은 옛 초록 run 을 인정」하는 안까지 가지는 않았다:
 *   그 run 이 검사한 **테스트 판**은 지금 것이 아니라, 「같은 바이트」의 뜻이 조용히 달라진다. */
function 원격초록(root, 실행) {
  const go = 실행 || ((bin, args) => require('child_process').spawnSync(bin, args, {
    cwd: root, encoding: 'utf8', timeout: 60000, // 네트워크가 멎어도 훅 예산(120초)을 다 먹지 않게
  }));
  let r;
  try { r = go(process.execPath, [path.join(root, 'tools', '원격ci.js')]); }
  catch (e) { return { 초록: false, 출력: String((e && e.message) || e).split('\n')[0] }; }
  // 판정은 **첫 줄**에 있다 — 뒤따르는 줄은 처방(`→ gh …`)이라 그걸 집으면 사유가 사라진다.
  const 출력 = String((r && r.stdout) || '').trim().split('\n').filter(Boolean)[0] || '';
  return { 초록: !!r && r.status === 0, 출력 };
}

module.exports = { resolveProject, deployTargets, globToRe, isDeployFile, testsFor, 원격초록 };
