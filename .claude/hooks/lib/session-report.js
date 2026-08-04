// session-report — 「이 세션이 뭘 했나」를 git 에서 읽어 인계문을 만든다 (공용)
//
// 쓰는 곳이 둘이다: context-budget(Stop, 🔴 도달) · session-end-handoff(SessionEnd, 세션 종료).
// 문구가 갈라지면 어느 경로로 끝났는지에 따라 인계 품질이 달라진다 — 그래서 여기 하나뿐이다.
//
// ⚠ 세션 id 가 **둘**이다(08-04 실측으로 한 번 데였다):
//   · 훅 입력의 `session_id` = 내부 에이전트 id — 커밋 트레일러에 안 박힌다
//   · `CLAUDE_CODE_HOST_SESSION_ID` = 호스트 세션 id — prepare-commit-msg 가 박는 **그 값**
//   전자로 찾으면 자기 커밋을 하나도 못 찾는다. prepare-commit-msg 가 "내부 id 는 쓰지 말 것"이라
//   적어둔 그대로다. 여기서 원천을 하나로 고정해 호출부가 틀릴 수 없게 한다.
'use strict';
const { spawnSync } = require('child_process');

function git(cwd, args, timeout) {
  try {
    const r = spawnSync('git', args, { cwd: cwd || process.cwd(), encoding: 'utf8', timeout: timeout || 5000 });
    if (r.error || r.status !== 0) return null;
    return String(r.stdout || '');
  } catch (_) { return null; }
}

/** 미커밋 파일 수. git 을 못 부르면 **null(=모름)** — 0건과 구별해야 한다(「끊어도 된다」를 잘못 말하지 않게). */
function dirtyCount(cwd) {
  const out = git(cwd, ['status', '--porcelain']);
  if (out === null) return null;
  return out.split('\n').filter((s) => s.trim()).length;
}

/** 이 세션이 쓴 커밋. 트레일러로만 판단한다 — author·시각 인접성은 세션 구분자가 아니다(F041). */
function myCommits(cwd, hostSessionId) {
  if (!hostSessionId) return [];
  const out = git(cwd, ['log', '--format=%h %s', '-20', `--grep=Session-Id: ${hostSessionId}`]);
  if (out === null) return [];
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function hostSessionId(fallback) {
  return process.env.CLAUDE_CODE_HOST_SESSION_ID || fallback || '';
}

/**
 * 새 세션의 첫 메시지로 그대로 쓸 인계문.
 * 세션 간에 넘어가는 것은 **커밋·보드 줄·메모리 셋뿐**이므로(CLAUDE.md 세션 규약) 그 셋의 주소를 적는다.
 * 짧게 유지한다 — 이건 다음 세션의 컨텍스트에 실리는 비용이다.
 */
function buildHandoff(cwd, fallbackId, opts) {
  const o = opts || {};
  const commits = myCommits(cwd, hostSessionId(fallbackId));
  const dirty = o.dirty === undefined ? dirtyCount(cwd) : o.dirty;

  const did = commits.length
    ? commits.map((l) => `· ${l}`).join('\n')
    : '· (커밋 없음 — 보드 줄과 메모리에서 직전 작업을 찾을 것)';

  return [
    'SYNK 이어서 작업한다. 직전 세션에서 한 것:',
    did,
    `· 미커밋 ${dirty === null ? '(확인 필요)' : `${dirty}건`}`,
    o.reason ? `· 종료 사유: ${o.reason}` : null,
    '먼저 `git log --oneline -10` 과 `docs/세션보드.md` 를 열어 내 트랙 줄을 찾고, ' +
      '관련 메모리를 읽은 뒤 다음 할 일부터 이어라. 이어갈 일이 없으면 그렇게 말하고 멈춰라.',
  ].filter(Boolean).join('\n');
}

/** 화면용 — 인계문을 테두리로 감싼다(유호님이 눈으로 구별할 수 있게). */
function frame(msg) {
  return `── 다음 세션 인계문 ──\n${msg}\n──────────────────────`;
}

module.exports = { dirtyCount, myCommits, hostSessionId, buildHandoff, frame };
