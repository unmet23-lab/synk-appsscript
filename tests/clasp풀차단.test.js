/* clasp pull 차단 회귀 — 마찰 F040.
 *
 * 지키려는 성질:
 *   ① `clasp pull`은 차단된다 — 읽기처럼 생겼지만 작업본을 라이브로 덮어쓴다.
 *      실사고: 라이브 잔재 "확인"용 pull이 옆 세션 커밋 내용을 로컬에서 되돌렸다. 그때는 커밋돼
 *      있어서 복구됐지만, 미커밋 편집에 닿으면 사본이 어디에도 없다(F025·F037의 「무보호 상태」).
 *   ② BYPASS를 붙이면 통과한다 — 라이브 편집 회수라는 정당한 용법이 있고, 못 끄는 가드는
 *      사람이 우회하는 법을 배우게 만든다(v6.11).
 *   ③ **과잉 차단하지 않는다** — `clasp login`·`clasp list-deployments`는 그대로 통과한다.
 *   ④ **문서화를 벌하지 않는다** — 커밋 메시지 본문에 "clasp pull"이라고 *적기만* 한 것은
 *      실행이 아니므로 막지 않는다(2026-08-01 heredoc 오탐이 커밋 자체를 막았던 전례).
 *
 * 차단 통로는 exit 코드가 아니라 **stdout의 deny JSON**이다(F044 — 실행 불가가 통과로 읽히면 안 된다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GUARD = path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js');

function runGuard(command) {
  const r = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: ROOT }),
    encoding: 'utf8',
  });
  let decision = null;
  const out = String(r.stdout || '').trim();
  if (out) {
    try { decision = JSON.parse(out).hookSpecificOutput.permissionDecision; } catch (_) { decision = 'PARSE_FAIL'; }
  }
  return { decision, out, status: r.status };
}

test('clasp pull은 차단된다 (읽기가 아니라 작업본 덮어쓰기)', () => {
  const r = runGuard('clasp pull');
  assert.equal(r.decision, 'deny', 'clasp pull이 안 막혔다 — stdout: ' + JSON.stringify(r.out));
  assert.match(r.out, /덮어쓰기/, '차단 사유가 「덮어쓰기」를 설명하지 않는다: ' + r.out);
});

/* 막기만 하고 「그럼 뭘 쓰라는 건지」를 안 주면 사람은 BYPASS를 습관으로 배운다(v6.11).
 * 옆 세션이 실사고 근거로 정당 용법을 하나 줬다 — 편집기 버퍼가 push를 덮어쓴 것을
 * 발각한 유일한 수단이 **repo 밖 임시 디렉터리 pull-diff**였다. F040(작업본 덮어쓰기)과
 * 방향이 반대라 접을 이유가 없고, 차단 문구가 그걸 드러내야 한다. */
test('차단 문구가 정당 용법(repo 밖 임시 디렉터리 pull-diff)을 알려준다', () => {
  const out = runGuard('clasp pull').out;
  assert.match(out, /임시 디렉터리/, '대안을 안 준다 — 금지만 하면 BYPASS가 습관이 된다: ' + out);
  assert.match(out, /diff/, '정당 용법의 실제 명령 형태가 없다: ' + out);
  assert.match(out, /CLASP_GUARD_BYPASS=1/, '우회 레버를 안 알려준다: ' + out);
});

test('경로·플래그가 붙은 형태도 차단된다 (사람이 실제로 쓰는 표기)', () => {
  for (const cmd of [
    'clasp pull --versionNumber 3',
    '"C:/Users/q1212/AppData/Roaming/npm/clasp.cmd" pull',
    'cd /c/Users/q1212/Documents/SYNK-appsscript && clasp pull',
  ]) {
    assert.equal(runGuard(cmd).decision, 'deny', '안 막힘: ' + cmd);
  }
});

test('BYPASS를 명시하면 통과한다 (라이브 편집 회수라는 정당한 용법)', () => {
  const r = runGuard('CLASP_GUARD_BYPASS=1 clasp pull');
  assert.equal(r.decision, null, 'BYPASS인데 막혔다 — 못 끄는 가드는 BYPASS 남발을 부른다: ' + r.out);
});

test('과잉 차단하지 않는다 — pull이 아닌 clasp 명령은 통과', () => {
  for (const cmd of ['clasp login', 'clasp list-deployments', 'clasp open']) {
    assert.equal(runGuard(cmd).decision, null, '과잉 차단: ' + cmd);
  }
});

test('검색을 벌하지 않는다 — 인용된 인자 안의 clasp pull은 통과 (2026-08-04 실측 오탐)', () => {
  /* 이 가드를 넣은 당일, 보드를 grep하려던 명령이 차단됐다 — 인용 인자 안의 문구를
   * 실행 명령으로 읽었다. 08-01 heredoc 오탐과 같은 계열이라 통과 목록에 못박는다. */
  for (const cmd of [
    'grep -n "clasp pull 차단" docs/세션보드.md',
    "rg 'clasp pull' docs/",
    'echo "clasp pull 은 작업본을 덮는다"',
  ]) {
    assert.equal(runGuard(cmd).decision, null, '검색·출력이 차단됐다(오탐): ' + cmd);
  }
});

test('인용된 실행 경로는 여전히 잡는다 (오탐 수리가 탐지를 깎지 않았다)', () => {
  // 산문만 죽이고 실행 경로는 살려야 한다 — 이 둘을 한 번에 검사한다.
  assert.equal(runGuard('"C:/Users/q1212/AppData/Roaming/npm/clasp.cmd" pull').decision, 'deny',
    '인용된 clasp 실행 경로의 pull을 놓쳤다 — 오탐 수리가 탐지 구멍을 냈다');
});

test('문서화를 벌하지 않는다 — 커밋 메시지에 적기만 한 clasp pull은 통과', () => {
  const cmd = "git commit -F - <<'EOF'\nops: 마찰 F040 — 확인에 clasp pull 금지\n\n라이브 잔재 확인에 clasp pull을 쓰면 작업본이 덮인다.\nEOF";
  const r = runGuard(cmd);
  assert.equal(r.decision, null,
    '실행되지 않는 heredoc 본문 때문에 커밋이 막혔다(2026-08-01 오탐 재발): ' + r.out);
});
