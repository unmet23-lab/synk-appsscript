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
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const wt = require(path.join(__dirname, 'worktrees.js'));

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
 * 보드에서 **내 줄**을 찾아 트랙명과 상태(=다음 할 일)를 뽑는다. 못 찾으면 null.
 *
 * 왜 필요한가 (유호님 08-04: "끊고 나서 새 세션에서 바로 작업 이어갈 수 있는 조치도"):
 *   옛 인계문은 커밋 목록만 주고 「보드를 열어 네 줄을 찾아라」로 끝났다. 그래서 새 세션이
 *   매번 보드 전문을 읽고 어느 줄이 제 것인지 되짚어야 했다 — 인계가 **주소만 있고 내용이 없었다.**
 *
 * 🔑 식별은 **내 커밋 해시로만** 한다. 이 저장소는 보드 상태 칸에 커밋 해시를 적는 관행이 있어
 *   그게 가장 정확한 지문이다. `작업중` 같은 문구로 폴백하지 않는다 — 그 줄이 **남의 트랙**이면
 *   새 세션이 남의 작업을 제 것으로 알고 이어받는다(F073 과 같은 형태의 사고). 모름은 모름으로 둔다.
 */
function boardTrack(cwd, commits) {
  let txt;
  try { txt = fs.readFileSync(path.join(String(cwd || '.'), 'docs', '세션보드.md'), 'utf8'); } catch (_) { return null; }
  const hashes = (commits || []).map((c) => String(c).split(' ')[0]).filter((h) => /^[0-9a-f]{7,40}$/.test(h));
  if (!hashes.length) return null;
  for (const line of txt.split('\n')) {
    if (line[0] !== '|') continue;
    if (!hashes.some((h) => line.indexOf(h) !== -1)) continue;
    const c = line.split('|').map((s) => s.trim());
    if (c.length < 5) continue;
    return { track: c[2] || '', state: c[4] || '' };
  }
  return null;
}

/**
 * 새 세션의 첫 메시지로 그대로 쓸 인계문.
 * 세션 간에 넘어가는 것은 **커밋·보드 줄·메모리 셋뿐**이므로(CLAUDE.md 세션 규약) 그 셋을 담는다.
 * 짧게 유지한다 — 이건 다음 세션의 컨텍스트에 실리는 비용이다.
 */
function buildHandoff(cwd, fallbackId, opts) {
  const o = opts || {};
  const commits = myCommits(cwd, hostSessionId(fallbackId));
  const dirty = o.dirty === undefined ? dirtyCount(cwd) : o.dirty;
  const track = boardTrack(cwd, commits);

  const did = commits.length
    ? commits.map((l) => `· ${l}`).join('\n')
    : '· (커밋 없음 — 보드 줄과 메모리에서 직전 작업을 찾을 것)';

  return [
    'SYNK 이어서 작업한다. 직전 세션에서 한 것:',
    did,
    // ⚠ 이 수는 **저장소 전체**다 — 내 것만이 아니다. 08-04 실측: 내 미커밋이 0건인데
    //   인계문에 「미커밋 9건」이 적혔고, 그 9건은 전부 옆 세션의 살아있는 작업본이었다.
    //   새 세션이 그걸 제 것으로 알고 커밋하면 사고다(F073) — 그래서 가르는 도구를 같이 준다.
    dirty === null
      ? '· 미커밋 (확인 필요)'
      : dirty === 0
        ? '· 미커밋 0건'
        : `· 저장소 미커밋 ${dirty}건 — **내 것인지 남의 것인지 \`node tools/작업본소유자.js\`로 먼저 가른다**(남의 작업본을 커밋하면 사고다)`,
    o.reason ? `· 종료 사유: ${o.reason}` : null,
    // ▶ 내 트랙을 **내용까지** 넘긴다 — 주소만 주면 새 세션이 보드 전문을 되짚어야 한다.
    track ? `▶ 내 보드 줄: ${track.track}` : null,
    track ? `   상태/다음: ${track.state}` : null,
    track
      ? '위 「상태/다음」에 적힌 다음 할 일부터 이어라. 열기 직전 `git log --oneline -10` 으로 ' +
        '그 사이 남이 손댔는지 보고, 관련 메모리를 읽은 뒤 시작한다. 이어갈 일이 없으면 그렇게 말하고 멈춰라.'
      : '먼저 `git log --oneline -10` 과 `docs/세션보드.md` 를 열어 내 트랙 줄을 찾고, ' +
        '관련 메모리를 읽은 뒤 다음 할 일부터 이어라. 이어갈 일이 없으면 그렇게 말하고 멈춰라.',
  ].filter(Boolean).join('\n');
}

/** 화면용 — 인계문을 테두리로 감싼다(유호님이 눈으로 구별할 수 있게). */
function frame(msg) {
  return `── 다음 세션 인계문 ──\n${msg}\n──────────────────────`;
}

/** 인계문이 쌓이는 파일. repo 안이라 **커밋하면 3계정 어디서든 보인다.** */
const 인계파일 = ['docs', '_ops', '인계문.md'];

/**
 * 인계문을 **파일로도** 남긴다. 최근 3개까지 유지하고 최신을 맨 위에 둔다.
 *
 * 왜 파일인가 (유호님 08-04: "새 세션에서 바로 이어서 할 수 있게 프롬프트나 텍스트파일을 전달"):
 *   바통(tmp json)은 새 창의 첫 메시지로 **자동 입력**되지만, 그 경로가 닿지 않는 자리가 있다 —
 *   다른 계정·폰 클라우드 세션·자동 입력이 실패한 경우. 그때 유호님이 **열어서 복사할 것**이 필요하다.
 *   tmp 는 유호님이 찾아갈 수 없는 자리라 repo 안에 둔다.
 *
 * ⚠ 덮어쓰지 않고 **쌓는다.** 창을 여러 개 쓰는 이 환경에선 같은 시각에 여러 세션이 끝나고,
 *   덮으면 남의 트랙 인계문이 사라진다 — handoff-store `take()` 가 뒤처진 바통을 안 지우는 것과
 *   같은 판정이다("잃는 쪽이 무는 쪽보다 나쁘다"). 3개를 넘기면 가장 오래된 것부터 버린다.
 *
 * 실패해도 조용하다 — 이건 보조 통로고, 본 통로(자동 입력)는 바통이 진다.
 */
function writeHandoffFile(cwd, msg, meta) {
  if (!String(msg || '').trim()) return null;
  const m = meta || {};
  try {
    // ⚠ 워크트리에서 불려도 **메인** 작업 트리에 쓴다 — 유호님이 여는 파일은 하나다.
    //   projectKey 를 mainWorktree 로 고칠 때(c7083b4) 이 파일만 raw cwd 로 남아 있었다
    //   (같은 함정의 4번째 입구 — ①대소문자 ②구분자 ③워크트리 키 ④인계문 파일).
    const dir = path.join(wt.mainWorktree(String(cwd || '.')), 인계파일[0], 인계파일[1]);
    const file = path.join(dir, 인계파일[2]);
    fs.mkdirSync(dir, { recursive: true });

    // ⚠ **로컬 시각으로 적는다.** `toISOString()` 은 UTC 라 한국에서 9시간 어긋난 값이 찍히고,
    //   유호님이 「이게 방금 것인가」를 시각으로 판단하는 파일이라 그 어긋남이 곧 오독이 된다
    //   (실측: 21:27 에 만든 파일에 12:27 이 찍혔다). 표시용이므로 CI 의 UTC 고정과 무관하다.
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const 시각 = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    // `local_` 접두(내부 에이전트 id 표기)는 떼고 자른다 — 안 떼면 8자 중 6자가 접두라
    // 세션 구분 정보가 2자만 남는다(실측: `local_0b`·`local_85` 꼴로 뭉개졌다).
    const sid8 = String(m.sessionId || '?').replace(/^local_/, '').slice(0, 8);
    const 머리 = `## ${시각} · 세션 ${sid8}${m.reason ? ` · ${m.reason}` : ''}`;
    const 새블록 = `${머리}\n\n\`\`\`\n${msg}\n\`\`\`\n`;

    let 옛것 = '';
    try { 옛것 = fs.readFileSync(file, 'utf8'); } catch (_) { /* 없으면 새로 */ }
    // 머리말은 다시 쓰지 않는다 — 옛 본문에서 기존 블록만 떼어 낸다.
    let 블록들 = 옛것.split(/^## /m).slice(1).map((s) => '## ' + s.trimEnd());
    // 같은 세션의 옛 블록은 **교체**한다 — 한 세션이 여러 번 쓰면(🔴 도달→트랙 경계→종료)
    // 3칸을 전부 차지해 **남의 트랙 블록을 밀어낸다.** 바통(store.drop)이 같은 세션을
    // 덮어쓰는 것과 같은 판정. 08-04 실측: 한 번의 시험 3연타가 실블록을 전부 밀어냈다.
    if (sid8 !== '?') {
      블록들 = 블록들.filter((b) => {
        const 첫줄 = b.split('\n', 1)[0];
        return !(첫줄.indexOf(` 세션 ${sid8} `) !== -1 || 첫줄.endsWith(` 세션 ${sid8}`));
      });
    }
    const 합본 = [새블록.trimEnd(), ...블록들].slice(0, 3).join('\n\n');

    fs.writeFileSync(file,
      '# 다음 세션 인계문 (자동 생성 · 최근 3개)\n\n'
      + '> 새 창을 열면 맨 위 블록이 **자동으로 첫 메시지에 들어간다.** 자동 입력이 안 된 경우\n'
      + '> (다른 계정·폰) 맨 위 블록의 ``` 안을 통째로 복사해 새 창에 붙이면 그대로 이어진다.\n'
      + '> 이 파일은 훅이 덮어쓴다 — 손으로 고치지 않는다.\n\n'
      + 합본 + '\n');
    return file;
  } catch (_) { return null; }
}

module.exports = { dirtyCount, myCommits, hostSessionId, boardTrack, buildHandoff, frame, writeHandoffFile };
