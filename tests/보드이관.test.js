/* 보드→아카이브 이관 회귀 — 마찰 F046.
 *
 * 실사고: 손으로 짠 이관 스크립트가 ⓐ보드에서 삭제 + ⓑ아카이브에 삽입을 함께 했는데,
 * 아카이브가 CRLF라 `replace('\n---\n', …)` 앵커가 안 맞아 **ⓑ가 조용히 no-op**됐고
 * ⓐ만 성공해 줄이 통째로 사라졌다. 훅으로는 못 막는다(Bash+writeFileSync라 PreToolUse 미발화).
 *
 * 그래서 이 검사가 지키는 성질은 하나로 압축된다:
 *   **어떤 경로로 실패하든 줄이 「어디에도 없는」 상태가 되지 않는다.**
 *   (유실 대신 중복으로 실패해야 한다 — 중복은 보이고 무해하지만 유실은 조용하고 영구다.)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process'); // git 재현용 — node 자식은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

const TOOL = path.join(__dirname, '..', 'tools', 'board-move.js');
const ROW = '| 2026-08-04 | **옮길 트랙 갑** | a.js | 완료 |';

/** F046 조건 그대로: 보드는 LF, 아카이브는 **CRLF**. */
function mkFixture(boardEol = '\n', archiveEol = '\r\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardmove-'));
  const board = path.join(dir, '세션보드.md');
  const archive = path.join(dir, '세션보드_아카이브.md');
  fs.writeFileSync(board, [
    '# 세션보드', '', '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
    ROW, '| 2026-08-04 | **남을 트랙 을** | b.js | 진행중 |', '',
  ].join(boardEol), 'utf8');
  fs.writeFileSync(archive, [
    '# 세션보드 아카이브', '', '> 읽지 않는 파일.', '', '---', '',
    '| 2026-08-03 | **옛 트랙** | c.js | 완료 |', '',
  ].join(archiveEol), 'utf8');
  return { dir, board, archive };
}

function run(fx, args, 덧env = {}) {
  /* 통과코드 = 이 도구의 계약(0 옮겼다 / 1 못 옮겼다 / **6 원칙⑥ — 주인이 살아 있다**).
   * 6 은 F278 에서 팠다: board-guard 가 `--dry` 로 「이 처방이 실제로 도는가」를 묻는데,
   * 1 하나로는 거절과 「아예 못 돌았다」가 안 갈린다. 그 밖의 코드는 결과가 아니다. */
  return 훅띄우기([TOOL, ...args], {
    encoding: 'utf8',
    통과코드: [0, 1, 6],
    env: { ...process.env, SYNK_BOARD: fx.board, SYNK_BOARD_ARCHIVE: fx.archive, ...덧env },
  });
}
const read = (p) => fs.readFileSync(p, 'utf8');

/** 이 저장소가 절대 허용하지 않는 상태 = 줄이 양쪽 어디에도 없음. */
function assertNeverLost(fx, where) {
  const inBoard = read(fx.board).includes(ROW);
  const inArchive = read(fx.archive).includes(ROW);
  assert.ok(inBoard || inArchive, `줄이 유실됐다 (${where}) — 보드에도 아카이브에도 없다`);
}

test('CRLF 아카이브 + LF 보드에서 줄이 옮겨진다 (F046 조건 그대로)', () => {
  const fx = mkFixture();
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  assertNeverLost(fx, '정상 경로');
  assert.ok(read(fx.archive).includes(ROW), '아카이브에 안 들어갔다(F046의 조용한 no-op 재발)');
  assert.ok(!read(fx.board).includes(ROW), '보드에서 안 지워졌다');
  assert.ok(read(fx.board).includes('남을 트랙 을'), '남아야 할 줄까지 사라졌다');
});

test('아카이브 줄끝이 LF여도 동작한다 (줄끝을 실측하지 손으로 안 쓴다)', () => {
  const fx = mkFixture('\r\n', '\n');
  assert.equal(run(fx, ['옮길 트랙 갑']).status, 0);
  assertNeverLost(fx, '역방향 줄끝');
  assert.ok(read(fx.archive).includes(ROW));
  assert.ok(!read(fx.board).includes(ROW));
});

test('못 찾으면 아무것도 쓰지 않는다 (줄은 보드에 그대로)', () => {
  const fx = mkFixture();
  const before = { b: read(fx.board), a: read(fx.archive) };
  const r = run(fx, ['없는 문구 xyzzy']);
  assert.notEqual(r.status, 0, '못 찾았는데 성공으로 끝났다');
  assertNeverLost(fx, '미발견');
  assert.equal(read(fx.board), before.b, '보드가 변했다');
  assert.equal(read(fx.archive), before.a, '아카이브가 변했다');
});

test('여러 줄에 걸리면 거부한다 (엉뚱한 줄을 옮기지 않는다)', () => {
  const fx = mkFixture();
  const before = read(fx.board);
  const r = run(fx, ['2026-08-04']);           // 두 줄 모두에 있는 문구
  assert.notEqual(r.status, 0, '모호한데 그냥 옮겼다');
  assert.match(String(r.stderr), /줄에 걸린다/);
  assert.equal(read(fx.board), before, '거부인데 보드가 변했다');
});

test('--dry는 계획만 내고 쓰지 않는다', () => {
  const fx = mkFixture();
  const before = { b: read(fx.board), a: read(fx.archive) };
  assert.equal(run(fx, ['옮길 트랙 갑', '--dry']).status, 0);
  assert.equal(read(fx.board), before.b);
  assert.equal(read(fx.archive), before.a);
});

/* ───────────────────────────────────────────────────────────────
 * 마찰 F102 — 이관이 **세션 경계에서 절단**된다.
 *
 * 위 5건은 전부 저장소 **밖** 임시폴더라 커밋 경로를 한 번도 밟지 않는다.
 * 그 상태로 「초록」이면 통과와 미실행이 같은 모양이다(CLAUDE.md 신뢰성).
 * 그래서 여기서부터는 **진짜 git 저장소 픽스처**로 커밋까지 못박는다.
 *
 * 지키는 성질: 파일시스템만 맞추고 끝내지 않는다 —
 *   **이관 뒤 두 파일이 커밋돼 있거나, 아니면 시끄럽게 실패한다.**
 *   (미커밋으로 남으면 보드 삭제는 남의 커밋에 실려 나가고 아카이브 추가는
 *    내 미커밋에만 남아, 옮긴 줄이 커밋된 어느 파일에도 없게 된다.)
 * ─────────────────────────────────────────────────────────────── */

const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

/** 위 픽스처와 같은 두 파일을, 이번엔 커밋된 git 저장소 안에 놓는다. */
function mkRepoFixture() {
  const fx = mkFixture('\n', '\r\n');
  git(fx.dir, 'init', '-q');
  git(fx.dir, 'config', 'user.email', 'test@synk.local');
  git(fx.dir, 'config', 'user.name', 'boardmove-test');
  git(fx.dir, 'config', 'commit.gpgsign', 'false');
  git(fx.dir, 'add', '--', '세션보드.md', '세션보드_아카이브.md');
  git(fx.dir, 'commit', '-q', '-m', 'fixture');
  return fx;
}
/** HEAD 시점의 파일 내용 — 「커밋됐나」는 작업본이 아니라 여기서 본다. */
const atHead = (fx, name) => git(fx.dir, 'show', `HEAD:${name}`).stdout;

test('[F102] 저장소 안에서는 이관이 **커밋까지** 끝난다 (미커밋으로 안 남긴다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  assertNeverLost(fx, '저장소 경로');

  // 작업본이 아니라 **커밋된 내용**으로 판정한다.
  assert.ok(atHead(fx, '세션보드_아카이브.md').includes(ROW), '아카이브 추가가 커밋에 안 들어갔다(F102의 절반)');
  assert.ok(!atHead(fx, '세션보드.md').includes(ROW), '보드 삭제가 커밋에 안 들어갔다');

  const left = git(fx.dir, 'status', '--porcelain', '--', '세션보드.md', '세션보드_아카이브.md').stdout.trim();
  assert.equal(left, '', '이관 뒤에도 미커밋이 남았다 — 세션이 끝나면 이 줄이 사라진다:\n' + left);
});

test('[F102] 커밋이 실패하면 **조용히 성공하지 않는다** (줄은 그대로 살아 있다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();
  const hook = path.join(fx.dir, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', 'utf8');
  fs.chmodSync(hook, 0o755);

  const r = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(r.status, 0, '커밋이 막혔는데 성공(0)으로 끝났다 — 호출자가 F102 창을 못 본다');
  assert.match(String(r.stderr), /git commit -m/, '무엇을 쳐야 하는지 안 알려준다');
  assertNeverLost(fx, '커밋 실패');
  // 아카이브 선기록이 커밋 못 됐으면 **보드는 아예 안 건드린다** — 그래야 남이 보드를 커밋해도 안 잃는다.
  assert.ok(read(fx.board).includes(ROW), '아카이브가 커밋 안 됐는데 보드에서 지웠다 — 그 순간부터 남의 커밋에 실려 나간다');
  assert.ok(read(fx.archive).includes(ROW), '커밋이 막혔다고 줄까지 잃으면 안 된다');
});

/* ⛔ 보드는 **상시** 여러 세션이 더럽히는 파일이다(실측 08-05 01:04: 한 순간에 6개 세션).
 * 두 파일을 함께 자동 커밋하면 그 커밋이 곧 **남의 선언 수거**가 된다(F073 역방향).
 * 그래서 보드는 깨끗할 때만 커밋한다 — 안 해도 안전하다(아카이브가 이미 커밋돼 최악이 중복). */
test('[F102] 보드에 남의 미커밋이 있으면 **보드는 커밋하지 않는다** (남의 선언을 수거하지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();
  const 남의선언 = '| 2026-08-05 | **남의 트랙 병** | z.js | 진행중 |';
  fs.writeFileSync(fx.board, read(fx.board).replace(ROW, ROW + '\n' + 남의선언), 'utf8');

  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  assertNeverLost(fx, '보드 경합');

  // 아카이브는 **커밋됐다** — 이게 유실 방지의 전부다.
  assert.ok(atHead(fx, '세션보드_아카이브.md').includes(ROW), '아카이브 선기록이 커밋 안 됐다');
  // 보드는 커밋 안 됐고, 남의 선언이 내 커밋에 실려가지 않았다.
  assert.ok(!atHead(fx, '세션보드.md').includes(남의선언), '남의 미커밋 선언이 내 커밋에 실려 나갔다(F073)');
  assert.match(String(r.stdout), /보드 삭제는 커밋하지 않았다/, '건너뛴 사실을 안 알렸다');
  // 한글 경로가 8진 이스케이프(`"\354\204\270…"`)로 나오면 이 저장소에선 경고가 읽히지 않는다.
  assert.match(String(r.stdout), /세션보드\.md/, '어느 파일이 걸렸는지 읽을 수 있게 안 나온다');
});

/* 아카이브가 더러우면 **아무것도 쓰지 않는다** — 커밋하면 남의 삽입을 함께 실어가고,
 * 안 쓰고 멈추면 줄은 보드에 그대로라 잃을 게 없다. */
test('[F102] 아카이브에 남의 미커밋이 있으면 **아무것도 쓰지 않고** 멈춘다', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();
  const 남의삽입 = read(fx.archive) + '| 2026-08-05 | **남의 이관 병** | z.js | 완료 |\n';
  fs.writeFileSync(fx.archive, 남의삽입, 'utf8');
  const before = read(fx.board);

  const r = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(r.status, 0, '남의 미커밋 위에 그냥 커밋했다');
  assert.equal(read(fx.board), before, '거부인데 보드가 변했다');
  assert.equal(read(fx.archive), 남의삽입, '거부인데 아카이브에 내 줄을 섞었다');
  assertNeverLost(fx, '아카이브 경합');
});

/* 🔑 F083 — 신고 조건 그대로: 「보드 삭제만 커밋되고 아카이브 추가는 미커밋」.
 * 그 상태가 **만들어질 수 없어야** 한다. 판정은 순서로 한다 —
 * 보드에서 지워진 시점에 아카이브 선기록은 이미 커밋돼 있다. */
test('[F102·F083] 보드 삭제가 커밋된 판에서 아카이브 추가가 미커밋인 상태는 만들어지지 않는다', { skip: !hasGit && 'git 없음' }, () => {
  for (const 판 of ['깨끗', '보드더러움']) {
    const fx = mkRepoFixture();
    if (판 === '보드더러움') fs.writeFileSync(fx.board, read(fx.board) + '| 2026-08-05 | **남** | z.js | 진행중 |\n', 'utf8');
    const r = run(fx, ['옮길 트랙 갑']);
    assert.equal(r.status, 0, `[${판}] 이관 실패: ` + r.stderr);

    const 보드에서지워졌다 = !atHead(fx, '세션보드.md').includes(ROW) || !read(fx.board).includes(ROW);
    if (보드에서지워졌다) {
      assert.ok(atHead(fx, '세션보드_아카이브.md').includes(ROW),
        `[${판}] 보드에서 지워졌는데 아카이브 추가가 **커밋 안 됐다** — 남이 보드를 커밋하면 그 줄은 사라진다`);
    }
  }
});

test('[F102] 저장소 밖이면 「커밋 안 했다」를 **드러낸다** (통과와 미실행이 같은 모양이면 안 된다)', () => {
  const fx = mkFixture();                       // git 저장소가 아닌 임시폴더
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0);
  assert.match(String(r.stdout), /커밋은 안 했다/, '커밋을 건너뛰고도 조용했다');
});

/* ───────────────────────────────────────────────────────────────
 * 마찰 F146 — **「✅종결」은 그 세션이 끝났다는 뜻이 아니다.**
 *
 * 실사고 2026-08-07: 보드가 17/18줄이라 「✅전부 종결」로 적힌 줄을 아카이브로 옮겼는데,
 * 그 트랙 파일 3건을 **0분 전에 편집 중인** 세션이 있었다(되돌림 revert 2건).
 * 위 F046·F102 검사는 전부 「옮기는 행위가 줄을 잃는가」만 봤다 — **옮겨도 되는 줄인가**는
 * 아무도 안 물었다. 줄을 잃은 세션은 다음 턴에 자기 트랙을 못 찾고 접힌다(F144):
 * 인계문은 아카이브가 아니라 **보드**만 보므로, 옮겨진 줄은 그 세션에게 유실과 같다.
 *
 * 지키는 성질: **줄에 적힌 커밋의 세션이 아직 살아 있으면 아무것도 쓰지 않는다.**
 * 탐지력은 여기 픽스처가 진다 — 실저장소는 살아있는 세션이 매번 달라 초록이 우연이 된다.
 * ─────────────────────────────────────────────────────────────── */
const store = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));
const 남의sid = 'local_f146fake-1111-2222-3333-444455556666';

/** 트랙 커밋(Session-Id 트레일러) + 그 해시가 박힌 보드 줄 + 심장박동 파일. */
function mk주인픽스처(sid, { 분전 = 0, 해시덮기 = null, 지문줄 = false } = {}) {
  const fx = mkRepoFixture();
  fs.writeFileSync(path.join(fx.dir, 'a.js'), '// 트랙 산출물\n', 'utf8');
  git(fx.dir, 'add', '--', 'a.js');
  git(fx.dir, 'commit', '-q', '-m', `트랙 커밋\n\nSession-Id: ${sid}`);
  const 해시 = git(fx.dir, 'rev-parse', '--short', 'HEAD').stdout.trim();
  /* 지문줄 = **커밋 해시가 한 글자도 없는** 줄. 양보·조사·판정안 트랙의 실제 모양이고,
   * F165 이전에는 이런 줄이 원칙 ⑥ 검사를 통째로 지나갔다(재료가 없으니 모른다 → 통과). */
  const 줄 = 지문줄
    ? `| 2026-08-07 | **살아있는 트랙 정** | a.js | 작업중 (\`local_${sid.replace(/^local_/, '').slice(0, 8)}\`) — 커밋 아직 없음 |`
    : `| 2026-08-07 | **살아있는 트랙 정** | a.js | ✅종결(${해시덮기 || 해시}) |`;
  fs.writeFileSync(fx.board, read(fx.board).replace(ROW, 줄), 'utf8');
  git(fx.dir, 'commit', '-q', '-m', 'board', '--', '세션보드.md');

  /* 심장박동 = track-collision 이 쌓는 상태 파일의 mtime. 좌표는 board-move 가 보는 것과
   * **같은 방법으로** 만든다(git 이 말하는 최상위 경로 → projectKey) — 손으로 맞추면
   * 키가 어긋나 세션이 0개가 되고, 그 0 은 「살아있는 세션 없음」과 구별되지 않는다(F079). */
  const 최상위 = git(fx.dir, 'rev-parse', '--show-toplevel').stdout.trim();
  const 박동 = path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(sid)}.json`);
  fs.mkdirSync(store.stateDir(), { recursive: true });
  fs.writeFileSync(박동, JSON.stringify({ touched: [] }), 'utf8');
  if (분전) { const t = (Date.now() - 분전 * 60000) / 1000; fs.utimesSync(박동, t, t); }
  return { fx, 줄, 해시, 박동 };
}
const 치우기 = (박동) => { try { fs.unlinkSync(박동); } catch (_) { /* 이미 없으면 됐다 */ } };

test('[F146] 줄 주인 세션이 살아 있으면 **아무것도 쓰지 않는다**', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 해시, 박동 } = mk주인픽스처(남의sid);
  try {
    const before = { b: read(fx.board), a: read(fx.archive) };
    const r = run(fx, ['살아있는 트랙 정']);
    assert.notEqual(r.status, 0, '살아있는 세션의 줄을 그냥 옮겼다 — F146 재현');
    /* 🔑 F278 — 거절은 **6** 으로 말한다. board-guard 가 `--dry` 로 처방 실행 가능성을 묻는데,
     *   1(못 돌았다)과 같은 코드면 환경 고장이 「옮길 게 없다」로 읽혀 상한이 조용히 풀린다.
     *   글자 대신 코드로 못박는 이유: 문구를 다듬는 순간 판정이 두 곳으로 갈라진다. */
    assert.equal(r.status, 6, '원칙⑥ 거절이 전용 종료 코드로 안 나온다 — board-guard 가 못 가른다');
    assert.match(String(r.stderr), /아직 살아 있다/, '왜 막혔는지 안 말한다');
    assert.match(String(r.stderr), new RegExp(해시), '어느 커밋이 걸렸는지 안 나온다');
    assert.match(String(r.stderr), /f146fake/, '누구 것인지 안 나온다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');

    /* --dry 도 같은 답을 내야 한다 — 계획만 볼 때야말로 「옮겨도 되나」의 답이 필요하다.
     * board-guard 가 처방을 거르는 통로가 **바로 이것**이라(F278) 코드까지 같아야 한다. */
    assert.equal(run(fx, ['살아있는 트랙 정', '--dry']).status, 6, '--dry 가 원칙⑥을 6 으로 안 말한다');
  } finally { 치우기(박동); }
});

test('[F146] **내 세션**의 줄은 그대로 옮긴다 (/close 정상 경로를 막지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동 } = mk주인픽스처(남의sid);
  try {
    const r = run(fx, ['살아있는 트랙 정'], { CLAUDE_CODE_HOST_SESSION_ID: 남의sid });
    assert.equal(r.status, 0, '내 줄인데 막혔다 — 이 가드가 /close 를 잠근다: ' + r.stderr);
    assert.ok(!read(fx.board).includes(줄), '내 줄이 안 옮겨졌다');
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 치우기(박동); }
});

test('[F146] 심장박동이 멎은 세션의 줄은 옮긴다 (죽은 트랙까지 잠그지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동 } = mk주인픽스처(남의sid, { 분전: 90 });
  try {
    const r = run(fx, ['살아있는 트랙 정']);
    assert.equal(r.status, 0, '죽은 세션의 줄까지 막았다 — 보드가 영원히 안 줄어든다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 치우기(박동); }
});

/* ── 마찰 F165 — 원칙 ⑥이 **가장 잃기 쉬운 줄**을 못 보고 있었다 ────────────
 * ⑥의 재료가 「줄에 적힌 커밋 해시」뿐이라, 아직 아무것도 커밋하지 않은 세션(=선언만 한
 * 트랙)과 코드 커밋이 안 나가는 트랙(양보·조사·판정안)의 줄은 검사를 그냥 지나갔다.
 * F146 을 막으라고 세운 가드가 정작 그 사고가 가장 나기 쉬운 자리에서 눈을 감고 있었다. */
const 남의sid165 = 'local_f165beef-1111-2222-3333-444455556666';

test('[F165] 해시가 없어도 **줄에 적힌 지문**으로 산 주인을 본다', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동 } = mk주인픽스처(남의sid165, { 지문줄: true });
  try {
    const before = { b: read(fx.board), a: read(fx.archive) };
    const r = run(fx, ['살아있는 트랙 정']);
    assert.notEqual(r.status, 0, '🔴 해시 없는 줄이 그냥 지나갔다 — 커밋 전 세션의 줄이 통째로 사각지대다');
    assert.match(String(r.stderr), /f165beef/, '누구 것인지 안 나온다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
  } finally { 치우기(박동); }
});

test('[F165] 지문 주인이 죽었으면 옮긴다 (지문을 잠금장치로 쓰지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동 } = mk주인픽스처(남의sid165, { 지문줄: true, 분전: 90 });
  try {
    const r = run(fx, ['살아있는 트랙 정']);
    assert.equal(r.status, 0, '죽은 세션의 지문 줄까지 막았다 — 보드가 영원히 안 줄어든다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 치우기(박동); }
});

test('[F165] **내 지문**이 적힌 줄은 그대로 옮긴다 (/close 정상 경로)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동 } = mk주인픽스처(남의sid165, { 지문줄: true });
  try {
    const r = run(fx, ['살아있는 트랙 정'], { CLAUDE_CODE_HOST_SESSION_ID: 남의sid165 });
    assert.equal(r.status, 0, '내 줄인데 막혔다 — 이 가드가 /close 를 잠근다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 치우기(박동); }
});

/* ───────────────────────────────────────────────────────────────
 * 마찰 F226 — **이 도구가 자기 실패의 잔재에 스스로 영구 차단된다**(F103 축).
 *
 * 실사고 2026-08-07 21:35: 보드 만석(18/18)이라 board-move 를 돌렸는데 ②(아카이브 단독 커밋)가
 * 남의 `.git/index.lock` 에 막혀 죽었다. 그 시점 파일 상태 = **아카이브에 내 줄이 미커밋**.
 * 그런데 「아카이브가 더러우면 아무것도 쓰지 않는다」(F102)가 그 잔재를 **남의 미커밋으로 읽어**
 * 이후 재실행이 5회 전패했다 — 만석 처방(board-guard 가 내주는 바로 이 명령)이 첫 실패 한 번에
 * 통째로 죽는다. 죽는 조건도 흔하다: 세션 9~15개가 동시에 도는 저장소라 lock 경합은 일상이다.
 * 곁들여, 실패문 처방대로 손으로 커밋하고 재실행하면 「행 수 +1」 검증이 **중복도 통과시켰다.**
 *
 * 지키는 성질 둘:
 *   ① 내 잔재 위에서는 **이어서 끝까지 간다**(사람이 되돌려 주지 않아도 만석이 풀린다).
 *   ② 그래도 같은 줄이 **두 번 실리지 않는다**.
 * ─────────────────────────────────────────────────────────────── */

/** F226 상태를 그대로 만든다 — ②커밋만 막아 「아카이브에 삽입 + 미커밋 + 보드에 줄 그대로」를 남긴다. */
function mk잔재픽스처() {
  const fx = mkRepoFixture();
  const hook = path.join(fx.dir, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', 'utf8');
  fs.chmodSync(hook, 0o755);
  const first = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(first.status, 0, '커밋이 막혔는데 성공했다 — 잔재 조건이 안 만들어진다');
  fs.unlinkSync(hook);                        // lock 이 풀린 뒤 = 재실행 조건
  return fx;
}

test('[F226] 내 잔재 위에서 재실행이 **끝까지 간다** (만석 처방이 첫 실패로 죽지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk잔재픽스처();
  assert.ok(read(fx.archive).includes(ROW), '잔재 조건 미성립 — 아카이브에 삽입이 없다');
  assert.ok(read(fx.board).includes(ROW), '잔재 조건 미성립 — 보드에서 이미 지워졌다');

  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '🔴 내가 남긴 잔재를 남의 미커밋으로 읽고 거부했다 — F226 재현: ' + r.stderr);
  assertNeverLost(fx, 'F226 재실행');
  assert.ok(atHead(fx, '세션보드_아카이브.md').includes(ROW), '재실행인데 아카이브가 커밋 안 됐다');
  assert.ok(!atHead(fx, '세션보드.md').includes(ROW), '재실행인데 보드 삭제가 커밋 안 됐다');
  // ② 「행 수 +1」 검증은 중복을 통과시킨다 — 실제로 몇 번 실렸는지를 센다.
  assert.equal(read(fx.archive).split(ROW).length - 1, 1, '같은 줄이 아카이브에 두 번 실렸다');
});

test('[F226] 잔재에 **남의 삽입**이 섞이면 여전히 멈춘다 (예외가 F102 를 열지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk잔재픽스처();
  fs.writeFileSync(fx.archive, read(fx.archive) + '| 2026-08-05 | **남의 이관 병** | z.js | 완료 |\n', 'utf8');
  const before = { b: read(fx.board), a: read(fx.archive) };

  const r = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(r.status, 0, '남의 미커밋 위에 그냥 커밋했다 — F226 예외가 F102 를 열었다');
  assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
  assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
  assertNeverLost(fx, 'F226 + 남의 삽입');
});

test('[F146] 해시처럼 생긴 딴 것에는 안 걸린다 (없는 커밋으로 정상 이관을 막지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동 } = mk주인픽스처(남의sid, { 해시덮기: 'deadbee' });   // 7자 hex, 커밋 아님
  try {
    const r = run(fx, ['살아있는 트랙 정']);
    assert.equal(r.status, 0, '커밋도 아닌 문자열로 막았다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 치우기(박동); }
});

/* ── 마찰 F242 — 해시가 **형제 저장소** 것이면 원칙 ⑥이 통째로 꺼진다 ────────────
 * 위 F146 검사가 `rev-parse` 를 이 저장소에서만 돌려서, talk 커밋 해시는 「해시처럼 생긴
 * 딴 것」(바로 위 테스트)과 **같은 모양**(status!==0)으로 버려졌다. 지문마저 없으면 재료가
 * 둘 다 비어 산주인 0 → 통과다. 이 프로젝트는 트랙 절반이 talk 작업이라(보드 줄 절반이
 * 「SYNK-talk: …」로 시작한다) 그 사각은 예외가 아니라 상시였다 — 실측 2026-08-08:
 * 보드 「게임 4모듈」 줄이 정확히 그 모양이었고 주인은 25분 전 박동으로 살아 있었다.
 * 형제는 이 기계에만 있으므로 탐지력은 **여기 픽스처가 진다**(`SYNK_OWNER_SIBLINGS` 격리). */
const 남의sid242 = 'local_f242cafe-1111-2222-3333-444455556666';

/** 트랙 커밋이 **형제 저장소에만** 있고 줄엔 지문이 없는, F242 그대로의 모양. */
function mk형제픽스처(sid, { 분전 = 0 } = {}) {
  const fx = mkRepoFixture();
  const 형제 = path.join(fx.dir, 'talk');
  fs.mkdirSync(형제);
  git(형제, 'init', '-q');
  git(형제, 'config', 'user.email', 'test@synk.local');
  git(형제, 'config', 'user.name', 'boardmove-test');
  git(형제, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(형제, 'b.js'), '// talk 산출물\n', 'utf8');
  git(형제, 'add', '--', 'b.js');
  git(형제, 'commit', '-q', '-m', `talk 트랙 커밋\n\nSession-Id: ${sid}`);
  const 해시 = git(형제, 'rev-parse', '--short', 'HEAD').stdout.trim();
  /* 지문 0 + 해시는 형제 것 — 두 재료가 **동시에** 비는 그 조합이다(F202 가 예고한 자리). */
  const 줄 = `| 2026-08-08 | **살아있는 talk 트랙 무** | SYNK-talk: b.js | ✅종결(talk ${해시}) |`;
  fs.writeFileSync(fx.board, read(fx.board).replace(ROW, 줄), 'utf8');
  git(fx.dir, 'commit', '-q', '-m', 'board', '--', '세션보드.md');

  const 최상위 = git(fx.dir, 'rev-parse', '--show-toplevel').stdout.trim();
  const 박동경로 = (s) => path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(s)}.json`);
  const 박동들 = [박동경로(sid)];
  fs.mkdirSync(store.stateDir(), { recursive: true });
  fs.writeFileSync(박동들[0], JSON.stringify({ touched: [] }), 'utf8');
  if (분전) {
    const t = (Date.now() - 분전 * 60000) / 1000;
    fs.utimesSync(박동들[0], t, t);
    /* 🔴 산 세션이 **하나도 없으면** 검사가 `!산.size` 에서 조기 반환해 `산.has(sid)` 갈래에
     *   도달조차 못 한다 — 그 초록은 「통과」가 아니라 **미측정**이다(변이 ③이 그것을 드러냈다:
     *   `산.has` 를 통째로 지워도 회귀가 안 빨개졌다). 그래서 주인이 **아닌** 산 세션을 하나
     *   세워 분모를 만든다. 이 갈래는 공용이라 여기서 재면 해시·지문 두 통로 다 덮인다. */
    박동들.push(박동경로('local_f242a11e-9999-8888-7777-666655554444'));
    fs.writeFileSync(박동들[1], JSON.stringify({ touched: [] }), 'utf8');
  }
  return { fx, 줄, 해시, 박동들, env: { SYNK_OWNER_SIBLINGS: './talk' } };
}

test('[F242] 해시가 **형제 저장소** 것이어도 산 주인을 본다', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 해시, 박동들, env } = mk형제픽스처(남의sid242);
  try {
    const before = { b: read(fx.board), a: read(fx.archive) };
    const r = run(fx, ['살아있는 talk 트랙 무'], env);
    assert.notEqual(r.status, 0, '형제 저장소 커밋이라 원칙 ⑥이 통째로 꺼졌다 — F242 재현');
    assert.match(String(r.stderr), /아직 살아 있다/, '왜 막혔는지 안 말한다');
    assert.match(String(r.stderr), new RegExp(해시), '어느 커밋이 걸렸는지 안 나온다');
    assert.match(String(r.stderr), /talk/, '**어느 저장소** 것인지 안 나온다 — 그 해시를 찾을 곳을 못 준다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
    assert.notEqual(run(fx, ['살아있는 talk 트랙 무', '--dry'], env).status, 0, '--dry 는 막히지 않았다');
  } finally { 박동들.forEach(치우기); }
});

test('[F242] 형제 해시라도 주인이 죽었으면 옮긴다 (만석을 새로 만들지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동들, env } = mk형제픽스처(남의sid242, { 분전: 90 });
  try {
    /* 주인은 죽었지만 **딴 산 세션이 있다** — 그래야 `산.has` 갈래를 실제로 지난다(위 주석). */
    assert.equal(박동들.length, 2, '분모(산 세션)를 안 세웠다 — 이 검사는 미측정이 된다');
    const r = run(fx, ['살아있는 talk 트랙 무'], env);
    assert.equal(r.status, 0, '죽은 세션의 talk 줄까지 막았다 — 보드가 영원히 안 줄어든다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 박동들.forEach(치우기); }
});

/* ── 마찰 F246 — ⑥이 「내 작업 커밋」과 「배경으로 인용한 남의 커밋」을 안 가른다 ────────
 * F242 는 재료가 **없어서** 틀렸고, 이건 재료가 **너무 많아서** 틀린다. 줄 전체에서 해시를
 * 긁으면 원인 설명에 배경으로 적은 남의 커밋("`46897fe` 로 고쳤지만…")까지 주인이 되어,
 * 내 종결 줄이 영원히 안 옮겨진다. 처방이 「그 세션이 끝난 뒤 다시 돌려라」라 내 세션에선
 * 실행할 수 없고(F103 축), 못 옮긴 줄은 보드 상한을 먹어 다음 세션의 선언을 막는다.
 * 새는 방향은 F242 와 반대(시끄러운 미이관)지만, 막히는 쪽도 결국 공유판을 잠근다.
 *
 * 좁히기는 **미탐 방향**이라 그 자리를 ① 파일 이름이 진다 — 보드 정본이 세션별 파일이 된
 * 뒤로(F250) 줄의 주인은 추론 대상이 아니라 좌표다. 두 성질을 따로 못박는다. */
const 남의sid246 = 'local_f246aabb-1111-2222-3333-444455556666';
const 내sid246 = 'local_a1b2c3d4-9999-8888-7777-666655554444';
const 지문of = (sid) => sid.replace(/^local_/, '').slice(0, 8);

/** 두 세션의 커밋을 만들고, 부르는 쪽이 조립한 줄을 보드에 심는다.
 *  `파일이름` 을 주면 보드 파일을 그 이름으로 옮긴다(F250 의 세션별 파일 모양). */
function mk인용픽스처(줄만들기, { 파일이름 = null, 죽은 = [] } = {}) {
  const fx = mkRepoFixture();
  const 해시 = {};
  for (const sid of [남의sid246, 내sid246]) {
    const 이름 = `${지문of(sid)}.js`;
    fs.writeFileSync(path.join(fx.dir, 이름), '// 트랙 산출물\n', 'utf8');
    git(fx.dir, 'add', '--', 이름);
    git(fx.dir, 'commit', '-q', '-m', `트랙 커밋\n\nSession-Id: ${sid}`);
    해시[sid] = git(fx.dir, 'rev-parse', '--short', 'HEAD').stdout.trim();
  }
  const 줄 = 줄만들기(해시);
  fs.writeFileSync(fx.board, read(fx.board).replace(ROW, 줄), 'utf8');
  let 보드이름 = '세션보드.md';
  if (파일이름) {
    fs.renameSync(fx.board, path.join(fx.dir, 파일이름));
    fx.board = path.join(fx.dir, 파일이름);
    보드이름 = 파일이름;
    git(fx.dir, 'add', '--', '세션보드.md', 파일이름);
  }
  git(fx.dir, 'commit', '-q', '-m', 'board', '--', 보드이름, '세션보드.md');

  /* 두 세션 다 살려 둔다 — 주인이 아닌 산 세션이 있어야 `!산.size` 조기반환에 가려지지 않는다
   * (F242 주석의 그 자리 · 변이 ③이 드러낸 미측정). `죽은` 에 넣은 것만 박동을 뒤로 민다. */
  const 최상위 = git(fx.dir, 'rev-parse', '--show-toplevel').stdout.trim();
  fs.mkdirSync(store.stateDir(), { recursive: true });
  const 박동들 = [남의sid246, 내sid246].map((sid) => {
    const p = path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(sid)}.json`);
    fs.writeFileSync(p, JSON.stringify({ touched: [] }), 'utf8');
    if (죽은.includes(sid)) { const t = (Date.now() - 90 * 60000) / 1000; fs.utimesSync(p, t, t); }
    return p;
  });
  return { fx, 줄, 해시, 박동들 };
}

test('[F246] 트랙 칸의 **배경 인용** 해시로는 안 막는다 (내 종결 줄이 옮겨진다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 해시, 박동들 } = mk인용픽스처((h) =>
    `| 2026-08-08 | **F246 종결 트랙 기**(원인은 \`${h[남의sid246]}\` 가 고쳤다 — 배경) | a.js | ✅종결(${h[내sid246]}) |`);
  try {
    const r = run(fx, ['F246 종결 트랙 기'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.equal(r.status, 0,
      '배경으로 인용한 남의 커밋에 막혔다 — F246 재현(처방 「그 세션이 끝난 뒤」는 내 세션에서 실행 불가): ' + r.stderr);
    assert.ok(!read(fx.board).includes(줄), '내 종결 줄이 보드에 그대로다');
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
    assert.ok(해시[남의sid246] !== 해시[내sid246], '픽스처가 두 커밋을 안 갈랐다 — 이 검사는 미측정이다');
  } finally { 박동들.forEach(치우기); }
});

test('[F246] **상태 칸**의 남의 해시는 여전히 막는다 (좁히기가 F146 을 안 연다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 해시, 박동들 } = mk인용픽스처((h) =>
    `| 2026-08-08 | **F246 남의 트랙 경** | a.js | ✅종결(${h[남의sid246]}) |`);
  try {
    const before = { b: read(fx.board), a: read(fx.archive) };
    const r = run(fx, ['F246 남의 트랙 경'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.notEqual(r.status, 0, '상태 칸의 남의 커밋까지 통과시켰다 — 좁히기가 F146 을 되열었다');
    assert.match(String(r.stderr), new RegExp(해시[남의sid246]), '어느 커밋이 걸렸는지 안 나온다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
  } finally { 박동들.forEach(치우기); }
});

test('[F246] 칸을 못 가르는 줄이면 **줄 전체**로 떨어진다 (좁히기가 침묵으로 안 끝난다)', { skip: !hasGit && 'git 없음' }, () => {
  /* 폴백은 언제나 더 많이 보는 쪽이다 — 형식이 바뀌어 상태 칸을 못 집으면 해시가 0건이 되고,
   * 그 0 은 「주인 없음」과 같은 모양이라 살아있는 세션의 줄이 조용히 옮겨진다. */
  const { fx, 줄, 해시, 박동들 } = mk인용픽스처((h) => `| **F246 칸 없는 줄 무** ✅종결(${h[남의sid246]}) |`);
  try {
    const r = run(fx, ['F246 칸 없는 줄 무'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.notEqual(r.status, 0, '칸을 못 갈랐다고 재료를 통째로 버렸다 — 산 주인의 줄이 옮겨진다');
    assert.match(String(r.stderr), new RegExp(해시[남의sid246]), '어느 커밋이 걸렸는지 안 나온다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
  } finally { 박동들.forEach(치우기); }
});

test('[F246] 해시도 지문도 없어도 **파일 이름**이 산 주인을 말한다', { skip: !hasGit && 'git 없음' }, () => {
  /* 좁히기가 만드는 미탐 자리 — 옛 단일 파일 시절엔 작업 해시를 「만지는 파일」 칸에 적은
   * 행이 실제로 있었다(실측 4행). 세션별 파일에서는 이름이 그 자리를 대신한다. */
  const { fx, 줄, 박동들 } = mk인용픽스처(() =>
    '| 2026-08-08 | **F246 선언만 한 트랙 신** | a.js | 🔵착수 — 커밋 아직 없음 |',
  { 파일이름: `${지문of(남의sid246)}.md` });
  try {
    const before = { b: read(fx.board), a: read(fx.archive) };
    const r = run(fx, ['F246 선언만 한 트랙 신'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.notEqual(r.status, 0, '재료가 셋 다 비어 통과했다 — 살아있는 세션의 선언 줄을 옮긴다(F146 그 사고)');
    assert.match(String(r.stderr), /아직 살아 있다/, '왜 막혔는지 안 말한다');
    assert.match(String(r.stderr), new RegExp(지문of(남의sid246)), '누구 것인지 안 나온다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
  } finally { 박동들.forEach(치우기); }
});

test('[F246] 파일 이름이 **내 지문**이면 그대로 옮긴다 (/close 정상 경로)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동들 } = mk인용픽스처(() =>
    '| 2026-08-08 | **F246 내 트랙 임** | a.js | ✅종결 — 커밋 없음 |',
  { 파일이름: `${지문of(내sid246)}.md` });
  try {
    const r = run(fx, ['F246 내 트랙 임'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.equal(r.status, 0, '내 파일의 내 줄인데 막혔다 — 이 재료가 /close 를 잠근다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 박동들.forEach(치우기); }
});

test('[F246] 파일 이름 주인이 죽었으면 옮긴다 (이름을 잠금장치로 쓰지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동들 } = mk인용픽스처(() =>
    '| 2026-08-08 | **F246 죽은 트랙 계** | a.js | ✅종결 — 커밋 없음 |',
  { 파일이름: `${지문of(남의sid246)}.md`, 죽은: [남의sid246] });
  try {
    const r = run(fx, ['F246 죽은 트랙 계'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.equal(r.status, 0, '죽은 세션의 파일까지 막았다 — 보드가 영원히 안 줄어든다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 박동들.forEach(치우기); }
});
