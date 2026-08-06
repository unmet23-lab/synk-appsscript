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
const store = require(path.join(__dirname, 'handoff-store.js'));
const 보드id = require(path.join(__dirname, 'board-id.js'));

function git(cwd, args, timeout) {
  try {
    const r = spawnSync('git', args, { cwd: cwd || process.cwd(), encoding: 'utf8', timeout: timeout || 5000 });
    if (r.error || r.status !== 0) return null;
    return String(r.stdout || '');
  } catch (_) { return null; }
}

/* ⚠ 이 프로젝트의 트랙은 저장소 **둘**을 함께 만진다 — 아래 둘은 형제 저장소도 읽는다(F142).
 *   좌표는 조립하지 않고 handoff-store 의 `siblings()` 하나에서만 받는다(같은 판정을 두 곳에
 *   적으면 갈라지고, 갈라진 쪽 증상은 조용한 「없음」이다). 형제가 없는 기계(CI)에선 조용히 빠진다. */

/** 미커밋 파일 수(형제 저장소 합산). git 을 못 부르면 **null(=모름)** — 0건과 구별해야 한다
 *  (「끊어도 된다」를 잘못 말하지 않게). 🔑 내 저장소를 못 읽었으면 형제 수로 덮지 않는다.
 *
 *  🔴 **형제를 못 읽은 것도 「모름」이다**(F142 반박 패스 실측 2026-08-07). 처음엔 `|| 0` 이었고,
 *    형제에 미커밋 3건이 있는데 그 저장소의 git 이 실패하면 **총합이 조용히 `0`** 이 됐다 —
 *    인계문이 「미커밋 0건」이라 말하면 다음 세션은 끊어도 된다고 읽는다. 하필 미추적은
 *    이력·stash·reflog 어디에도 없는 유일한 무보호 상태다(F025).
 *    `.git` 존재 검사를 통과하고 git 만 실패하는 모양은 실재한다 — 끊긴 워크트리 링크·
 *    `index.lock` 경합(세션 여럿이 형제를 두드린다)·timeout. 이 계열 전체가 「못 읽음 → 0건」이라
 *    조용히 새는 자리였고, 여기만 그 번역을 남겨 두면 인계 통로에서 되살아난다. */
function dirtyCount(cwd) {
  const 세기 = (root) => {
    const out = git(root, ['status', '--porcelain']);
    return out === null ? null : out.split('\n').filter((s) => s.trim()).length;
  };
  const 본 = 세기(cwd);
  if (본 === null) return null;
  let n = 본;
  for (const { 뿌리 } of store.siblings(cwd)) {
    const 형제 = 세기(뿌리);
    if (형제 === null) return null;   // 합계를 아는 척하지 않는다 — 0 으로 접으면 침묵과 같아진다
    n += 형제;
  }
  return n;
}

/** 이 세션이 쓴 커밋. 트레일러로만 판단한다 — author·시각 인접성은 세션 구분자가 아니다(F041).
 *
 *  F142(2026-08-07 실사고): 형제 저장소(SYNK-talk)에 7커밋을 한 세션의 인계문이 「커밋 없음」으로
 *  나갔다 — 트랙 절반이 거기서 도는데 여기만 읽었다. 그대로 넘기면 다음 세션이 직전 작업을 못 찾는다.
 *
 *  🔑 형제 표식은 **해시 뒤**에 붙인다 — `boardTrack` 이 `split(' ')[0]` 으로 해시를 떼어
 *    보드 줄을 찾으므로, 앞에 붙이면 보드 줄 인계가 통째로 죽는다(보드는 talk 해시도 적는다). */
function myCommits(cwd, hostSessionId) {
  if (!hostSessionId) return [];
  const 모음 = [];
  const 읽기 = (root, 표) => {
    const out = git(root, ['log', '--format=%h %s', '-20', `--grep=Session-Id: ${hostSessionId}`]);
    if (out === null) return;
    for (const s of out.split('\n')) {
      const t = s.trim();
      if (!t) continue;
      const i = t.indexOf(' ');
      모음.push(표 && i > 0 ? `${t.slice(0, i)} (${표}) ${t.slice(i + 1)}` : t);
    }
  };
  읽기(cwd, '');
  for (const { 뿌리, 저장소 } of store.siblings(cwd)) 읽기(뿌리, 저장소);
  return 모음;
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
 * 🔑 식별은 **줄이 스스로 말하는 것으로만** 한다 — ①내 커밋 해시 ②내 세션 지문(`local_3fd8f6db`).
 *   `작업중` 같은 문구로 폴백하지 않는다. 그 줄이 **남의 트랙**이면 새 세션이 남의 작업을
 *   제 것으로 알고 이어받는다(F073 과 같은 형태의 사고). 모름은 모름으로 둔다.
 *
 * 🔴 ②를 뒤늦게 붙인 이유 (F165 · 2026-08-07 실사고): ①만 볼 때는 **해시가 없는 줄이 통째로
 *   사각지대**였다. 「양보 종결」처럼 코드 커밋이 하나도 안 나간 트랙이 그렇다 — 세션
 *   `a0b27c60` 의 인계문이 「내 줄을 못 찾았다, 정말 없으면 멈춰라」로 나갔는데 그 줄은
 *   보드 26번째 줄에 멀쩡히 있었다. 해시는 이 저장소의 *관행*이지 규칙이 아니고,
 *   지문은 board-guard 가 새 줄에 **기계로 요구**하므로 이제 규칙이다.
 */
function boardTrack(cwd, commits, sid) {
  let txt;
  try { txt = fs.readFileSync(path.join(String(cwd || '.'), 'docs', '세션보드.md'), 'utf8'); } catch (_) { return null; }
  const hashes = (commits || []).map((c) => String(c).split(' ')[0]).filter((h) => /^[0-9a-f]{7,40}$/.test(h));
  if (!hashes.length && !보드id.지문(sid)) return null;
  for (const line of txt.split('\n')) {
    if (line[0] !== '|') continue;
    const 해시로 = hashes.some((h) => line.indexOf(h) !== -1);
    if (!해시로 && !보드id.줄이말하나(line, sid)) continue;
    const c = line.split('|').map((s) => s.trim());
    if (c.length < 5) continue;
    return { track: c[2] || '', state: c[4] || '', 근거: 해시로 ? '해시' : '지문' };
  }
  return null;
}

/**
 * 주인을 **못 가리는** 보드 줄의 수 — 세션 지문도 커밋 해시도 안 적힌 줄 (마찰 F170).
 *
 * 왜 세나: `boardTrack` 이 null 일 때 옛 인계문은 「트랙 없이 끝났을 **가능성이 높다**,
 *   보드를 열어 확인하고 없으면 멈춰라」로 나갔다. 그런데 이 통로는 **이미 보드를 읽었다** —
 *   줄이 전부 지문이나 해시로 주인을 밝히고 있고 그중 내 것이 없으면 「내 트랙 없음」은 가능성이 아니라
 *   **사실**이고, 다음 세션이 보드를 다시 열 이유가 없다(CLAUDE.md: 잴 수 있는 건 잰다).
 *   남는 사각지대는 **주인을 밝힐 재료가 아무것도 없는 줄**뿐이라 그것만 센다.
 *
 * 🔴 처음엔 「지문 없는 줄」을 셌다가 실측에 반박당했다(2026-08-07): 실제 보드 18줄 중 **17줄**이
 *   지문이 없어서, 새 문구가 사실상 늘 「옛 줄 17개를 보라」= 보드 전문 읽기로 나갔다. 고친 게
 *   아무것도 없는 셈이다. 지문이 없어도 **커밋 해시**가 적힌 줄은 주인을 밝히고 있고, 그 해시로
 *   가리는 일은 `boardTrack` 이 이미 했다 — 못 가리는 줄은 **둘 다 없는 줄**이고 실측 **1줄**이었다.
 *   (CLAUDE.md 가드 맹점 ①: 사람이 실제로 쓰는 표기로 검사한다.)
 *
 * ⚠ 해시 판정은 `myCommits` 의 트레일러에 기댄다 — 트레일러가 없는 저장소(talk · F144)에선 내
 *   커밋이 목록에 안 들어와 내 줄이 「남의 해시 줄」로 보일 수 있다. 그래서 문구는 「없다」가 아니라
 *   **「지문이나 해시로 주인을 밝히고 있고 그중 내 것이 없다」**로 쓴다 — 아는 만큼만 말한다.
 *
 * ⚠ 데이터 줄만 센다 — 머리글·구분선도 `|` 로 시작한다. 날짜 칸으로 가른다(보드 1열 = 날짜).
 */
function 무주줄(cwd) {
  let txt;
  try { txt = fs.readFileSync(path.join(String(cwd || '.'), 'docs', '세션보드.md'), 'utf8'); } catch (_) { return null; }
  return txt.split('\n').filter((line) => {
    if (line[0] !== '|' || !/\b20\d\d-\d\d-\d\d\b/.test(line)) return false;
    if (보드id.줄의지문(line).length) return false;   // ← 지문 줄은 여기서 끝. 아래 해시 검사에 안 닿는다.
    return !/\b[0-9a-f]{7,40}\b/.test(line);
  }).length;
}

/**
 * 새 세션의 첫 메시지로 그대로 쓸 인계문.
 * 세션 간에 넘어가는 것은 **커밋·보드 줄·메모리 셋뿐**이므로(CLAUDE.md 세션 규약) 그 셋을 담는다.
 * 짧게 유지한다 — 이건 다음 세션의 컨텍스트에 실리는 비용이다.
 */
function buildHandoff(cwd, fallbackId, opts) {
  const o = opts || {};
  const sid = hostSessionId(fallbackId);
  const commits = myCommits(cwd, sid);
  const dirty = o.dirty === undefined ? dirtyCount(cwd) : o.dirty;
  const track = boardTrack(cwd, commits, sid);
  // 「내 줄 없음」이 **사실인지 모름인지** 가르는 재료 (F170). 0=사실 · >0=옛 줄만 확인 · null=보드 못 읽음.
  const 모호 = track ? 0 : 무주줄(cwd);

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
    // ⚠ 못 찾은 것을 「찾아라」로 번역하지 않는다 (실사고 2026-08-07 · 세션 d3bf3daf → 다음 세션).
    //   d3bf3daf 의 커밋은 인계문 수거·보드 아카이브뿐이라 보드 어디에도 그 해시가 없었다 —
    //   즉 **트랙 없이 끝난 세션**이었는데, 옛 문구는 「보드를 열어 **내 트랙 줄을 찾고** 이어라」로
    //   나가 다음 세션이 없는 줄을 뒤지게 만들었다. 없는 것을 찾으라고 시키면 그 자리는
    //   대개 손에 잡히는 뒷정리로 채워진다(그 자체는 보드 규칙 3 이 허용하지만, **인계는 아니다**).
    //
    // 🔴 F170 (2026-08-07 · 세션 셋이 연달아 탔다: 116b4059 → 83d5c0d2 → 그 다음). 옛 문구는
    //   여기서 **「멈춰라」**로 끝냈다. 그런데 트랙이 없는 세션에게 옳은 다음 수는 멈추는 게
    //   아니라 **새 트랙을 잡는 것**이다 — 「트랙 종결」과 「트랙 없음」이 한 문구로 나가는 바람에
    //   새 세션은 「내가 뭘 놓쳤나」로 읽고 커밋 트레일러·보드·장부를 처음부터 되훑었다.
    //   F168(폰 반입 「0건」이 두 성격)과 같은 모양이다.
    //   ⚠ 「장부 해소·종결이면 갈라 낸다」(장부의 처방 후보)는 **안 쓴다** — 두 갈래 다 다음 수가
    //   같아서(새 트랙) 커밋 제목 문자열을 맞춰 볼 이유가 없다. 갈라야 할 것은 종결 여부가 아니라
    //   **「없다」가 사실인가 모름인가**뿐이고, 그건 무주줄 수로 잰다.
    track
      ? '위 「상태/다음」에 적힌 다음 할 일부터 이어라. 열기 직전 `git log --oneline -10` 으로 ' +
        '그 사이 남이 손댔는지 보고, 관련 메모리를 읽은 뒤 시작한다. 이어갈 일이 없으면 그렇게 말하고 멈춰라.'
      : (모호 === 0
        ? '▶ **트랙 없이 끝난 세션이다** — 추정이 아니라 실측이다: `docs/세션보드.md` 의 줄이 ' +
          '전부 **세션 지문이나 커밋 해시로 주인을 밝히고 있고** 그중 ' +
          (보드id.지문(sid) ? `내 것(\`${보드id.지문(sid)}\`)은 ` : '내 것은 ') +
          '없다. **보드를 다시 열 필요 없다.**'
        : '▶ 내 보드 줄을 **못 찾았다** — ' + (모호 === null
          ? '`docs/세션보드.md` 를 못 읽었다(그래서 「없다」를 단정하지 않는다).'
          : `지문도 커밋 해시도 없어 주인을 못 가리는 줄이 **${모호}개** 남아 있다. ` +
            '**그 줄들만** 보고(나머지는 이미 남의 것으로 가려졌다), 내 것이 아니면 ' +
            '트랙 없이 끝난 세션이다.')) +
        ' 위 커밋이 내가 남긴 전부다. **멈추지 말고 새 트랙을 잡아라** — 장부 미해소·보드 ⏳·' +
        '결정 큐에서 고르고, 방향이 굵직하면 유호님께 판정안으로 올린다. ' +
        '남의 줄을 내 트랙으로 이어받지는 않는다(F073 · F165 · F170).',
  ].filter(Boolean).join('\n');
}

/** 화면용 — 인계문을 테두리로 감싼다(유호님이 눈으로 구별할 수 있게). */
function frame(msg) {
  return `── 다음 세션 인계문 ──\n${msg}\n──────────────────────`;
}

/**
 * 인계문 블록 **지시문** — 세션당 한 번만 나간다 (F122).
 *
 * 지시하는 훅이 둘(context-budget · track-boundary)인데 문구도 판정도 각자 적고 있었다.
 * 임계가 같은 값(300k)이라 한 세션에서 둘 다 울고, 서로를 몰라 블록이 두 번 나갔다
 * (유호님 08-06: "마지막쯤 한번, 마지막에 또 한번"). 문구는 여기 하나에서 파생시킨다 —
 * 두 곳에 적으면 한 쪽만 고쳐지고 증상은 조용히 「두 번 나감」이다(CLAUDE.md 등록층 ④).
 *
 * 두 번째로 부른 쪽에는 **블록을 주지 않는다.** 훅은 AI 가 실제로 화면에 냈는지 못 보지만
 * AI 는 제 출력을 보므로, 「아직 안 냈으면 지금 한 번」의 판단만 그쪽에 남긴다.
 */
function blockOrder(cwd, sessionId, 인계문) {
  const store = require(path.join(__dirname, 'handoff-store.js'));
  if (!store.claimBlock(cwd, sessionId)) {
    return {
      첫판: false,
      본문: '⚠ 인계문 블록은 **이 세션에서 이미 지시됐다**(다른 훅이 먼저 냈다 · F122). '
        + '아직 화면에 안 냈으면 지금 한 번 낸다 — **이미 냈으면 다시 붙이지 않는다.** '
        + '같은 블록이 두 번 나가면 유호님이 어느 것을 복사할지 알 수 없다.',
    };
  }
  return {
    첫판: true,
    본문: '**아래 인계문 전문을 코드 블록으로 화면에 그대로 옮긴다** — 파일 경로나 「자동 입력된다」 '
      + '안내로 **대체 금지**(복사할 실물이 화면에 있어야 한다 · 08-04 실측: 실물 없는 안내는 '
      + '유호님에게 「안 된다」로 보였다). 이 발화 뒤 커밋·보드가 더 진행됐으면 `node tools/인계문.js` 로 '
      + '새로 뽑아 그걸 붙인다. **세션당 한 블록만** — 아래는 지금 시점의 미리보기다.\n\n'
      + frame(인계문),
  };
}

/** 인계문이 쌓이는 파일. repo 안이라 **커밋하면 3계정 어디서든 보인다.** */
const 인계파일 = ['docs', '_ops', '인계문.md'];
/** 세션별 인계문이 사는 폴더 — **저장은 여기가 정본**이고 위 파일은 파생 목차다. */
const 인계폴더 = ['docs', '_ops', '인계문'];

/** 세션별 파일의 수명. handoff-store 의 바통 TTL 과 **같은 값**을 쓴다(새 기준을 만들지 않는다). */
const 인계_TTL_MS = 12 * 60 * 60 * 1000;

/** 목차에 본문을 그대로 펴 보이는 개수. 유호님의 「맨 위 블록을 복사」 습관을 그대로 둔다. */
const 목차_펼침 = 3;

/** 파일명에 쓸 수 있는 세션 id (handoff-store.safeId 와 같은 판정 — 뭉개면 서로를 덮는다). */
function 파일용id(sid8) {
  const 안전 = String(sid8 || '?').replace(/[^A-Za-z0-9_-]/g, '_');
  return 안전 === '' ? '_' : 안전;
}

/**
 * 옛 한 파일(칸 3개) 구조에서 **세션별 파일로 옮긴다.** 한 번만 일한다(이미 있으면 안 건드린다).
 *
 * ⚠ 이게 없으면 **바꾸는 순간 지금 살아있는 인계문 3개가 증발한다** — 목차를 폴더에서 파생시키는데
 *   폴더가 비어 있으니 첫 쓰기가 옛 블록을 통째로 밀어낸다. 구조를 고치는 변경이 그 구조가 지키던
 *   것을 부수는 자리다.
 */
function 옛목차이주(file, 폴더) {
  let 옛것 = '';
  try { 옛것 = fs.readFileSync(file, 'utf8'); } catch (_) { return 0; }
  let 옮김 = 0;
  for (const 조각 of 옛것.split(/^## /m).slice(1)) {
    const 블록 = ('## ' + 조각).trimEnd();
    const 첫줄 = 블록.split('\n', 1)[0];
    // `## 2026-08-05 00:05 · 세션 45fed745 · 사유` 만 받는다(「그 밖의 세션」 같은 머리는 거른다).
    const m = 첫줄.match(/^##\s+(\d{4})-(\d\d)-(\d\d)\s+(\d\d):(\d\d)\s+·\s+세션\s+([^\s·]+)/);
    if (!m) continue;
    const p = path.join(폴더, `${파일용id(m[6])}.md`);
    if (fs.existsSync(p)) continue; // 이미 옮겼거나 그 세션이 새로 썼다 — 덮지 않는다
    // 옛 머리의 시각은 **로컬**로 찍혀 있었다(위 writeHandoffFile 주석) — 같은 해석으로 되읽는다.
    const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime();
    try { fs.writeFileSync(p, `<!-- at:${at} -->\n${블록}\n`); 옮김 += 1; } catch (__) { /* 진행 */ }
  }
  return 옮김;
}

/** 세션별 파일 하나를 읽어 {at, 블록} 으로. 못 읽거나 형식이 아니면 null. */
function 인계읽기(p) {
  try {
    const t = fs.readFileSync(p, 'utf8');
    const m = t.match(/^<!--\s*at:(\d+)\s*-->\s*\n/);
    if (!m) return null;
    const 블록 = t.slice(m[0].length).trimEnd();
    if (!/^## /.test(블록)) return null;
    return { at: Number(m[1]), 블록 };
  } catch (_) { return null; }
}

/**
 * 인계문을 **파일로도** 남긴다.
 *
 * 왜 파일인가 (유호님 08-04: "새 세션에서 바로 이어서 할 수 있게 프롬프트나 텍스트파일을 전달"):
 *   바통(tmp json)은 새 창의 첫 메시지로 **자동 입력**되지만, 그 경로가 닿지 않는 자리가 있다 —
 *   다른 계정·폰 클라우드 세션·자동 입력이 실패한 경우. 그때 유호님이 **열어서 복사할 것**이 필요하다.
 *   tmp 는 유호님이 찾아갈 수 없는 자리라 repo 안에 둔다.
 *
 * 🔑 **저장은 세션별 파일, 화면은 파생 목차**(유호님 확정 08-05 · F099 본안).
 *   옛 구조는 한 파일에 **칸 3개**를 두고 최신을 맨 위에 꽂았다. 그래서 **쓰는 것 자체가 축출**이라,
 *   칸(3) 보다 살아있는 세션(실측 10)이 많은 이 환경에선 정상 종료만으로도 남의 인계문이 사라졌다
 *   (실측: 86초 만에 세 칸이 전부 갈렸다). handoff-store 가 이미 같은 교훈을 배웠는데
 *   (「바통이 전역 1개라 마지막에 쓴 세션이 이겼다」 → 세션별 파일) **사람이 읽는 사본만 안 받았다.**
 *   이제 세션은 **자기 파일만** 쓴다 — 남을 밀어낼 수 있는 경로가 구조적으로 없다.
 *
 * ⚠ 목차(`인계문.md`)는 **폴더에서 파생**시킨다(읽고-고쳐-쓰기가 아니다). 두 세션이 동시에 써도
 *   잃는 값이 없고(각자 파일은 그대로), 목차는 다음 쓰기가 바로잡는다. CLAUDE.md 「목록은
 *   하나에서 파생시킨다」의 적용 — 목차를 손으로 합치면 그 순간 축출이 되살아난다.
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
    const 뿌리 = wt.mainWorktree(String(cwd || '.'));
    const dir = path.join(뿌리, 인계파일[0], 인계파일[1]);
    const file = path.join(dir, 인계파일[2]);
    const 폴더 = path.join(뿌리, 인계폴더[0], 인계폴더[1], 인계폴더[2]);
    fs.mkdirSync(폴더, { recursive: true });

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

    // ⓪ 옛 구조(한 파일·칸 3개)에 남아 있던 인계문을 먼저 세션별 파일로 옮긴다 — 안 그러면
    //    이 변경이 착지하는 순간 살아있는 인계문 3개가 증발한다. 이미 옮겼으면 아무 일도 안 한다.
    옛목차이주(file, 폴더);

    // ① **내 파일만 쓴다.** 같은 세션이 여러 번 써도(🔴 도달→트랙 경계→종료) 자기 것을 덮을 뿐,
    //    남의 파일에는 손이 닿지 않는다 — 축출 경로가 구조적으로 없다.
    const 내파일 = path.join(폴더, `${파일용id(sid8)}.md`);
    const 지금 = Date.now();
    fs.writeFileSync(내파일, `<!-- at:${지금} -->\n${새블록}`);

    // ② 수명이 다한 남의 파일만 걷어낸다(TTL 은 바통과 같은 값). 살아있는 것은 몇 개든 남긴다.
    let 목록 = [];
    try { 목록 = fs.readdirSync(폴더).filter((f) => f.endsWith('.md')); } catch (_) { /* 진행 */ }
    const 모음 = [];
    for (const f of 목록) {
      const p = path.join(폴더, f);
      const r = 인계읽기(p);
      if (!r) continue;
      if (지금 - r.at > 인계_TTL_MS) { try { fs.unlinkSync(p); } catch (__) { /* 진행 */ } continue; }
      모음.push({ ...r, 이름: f });
    }
    모음.sort((a, b) => b.at - a.at);

    // ③ 목차는 **폴더에서 파생**시킨다 — 옛 목차 본문을 읽어 합치지 않는다(읽고-고쳐-쓰기가
    //    곧 축출이었다). 위 목차_펼침 개는 그대로 펴서 「맨 위를 복사」가 계속 통하게 하고,
    //    나머지는 링크로 남긴다 — **버리지 않는다.**
    const 펼침 = 모음.slice(0, 목차_펼침).map((x) => x.블록);
    const 나머지 = 모음.slice(목차_펼침)
      .map((x) => `- [${x.블록.split('\n', 1)[0].replace(/^##\s*/, '')}](${인계폴더[2]}/${x.이름})`);

    fs.writeFileSync(file,
      `# 다음 세션 인계문 (자동 생성 · 세션별 파일 ${모음.length}개)\n\n`
      + '> 새 창을 열면 맨 위 블록이 **자동으로 첫 메시지에 들어간다.** 자동 입력이 안 된 경우\n'
      + '> (다른 계정·폰) 맨 위 블록의 ``` 안을 통째로 복사해 새 창에 붙이면 그대로 이어진다.\n'
      + '> 이 파일은 **파생 목차**다 — 손으로 고치지 않는다. 저장 정본은 `_ops/인계문/` 의 세션별 파일이고,\n'
      + '> 여기 안 펴진 것도 **지워지지 않는다**(아래 목록에서 연다).\n'
      + '> `_ops/인계문/` 은 **git 에 넣는다**(⛔`.gitignore` 금지) — 안 넣으면 아래 링크가 다른 계정·폰에서\n'
      + '> 전부 깨진다. 새 세션 파일은 그 세션의 `/close` 때 커밋된다.\n\n'
      + 펼침.join('\n\n')
      + (나머지.length ? `\n\n## 그 밖의 세션 (${나머지.length}개)\n\n${나머지.join('\n')}\n` : '\n'));
    return file;
  } catch (_) { return null; }
}

module.exports = { dirtyCount, myCommits, hostSessionId, boardTrack, 무주줄, buildHandoff, frame, blockOrder, writeHandoffFile };
