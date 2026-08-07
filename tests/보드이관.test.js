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
  // 통과코드 0·1 = 이 도구의 계약(0 옮겼다 / 1 못 옮겼다). 그 밖은 결과가 아니다.
  return 훅띄우기([TOOL, ...args], {
    encoding: 'utf8',
    통과코드: [0, 1],
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
    assert.match(String(r.stderr), /아직 살아 있다/, '왜 막혔는지 안 말한다');
    assert.match(String(r.stderr), new RegExp(해시), '어느 커밋이 걸렸는지 안 나온다');
    assert.match(String(r.stderr), /f146fake/, '누구 것인지 안 나온다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');

    // --dry 도 같은 답을 내야 한다 — 계획만 볼 때야말로 「옮겨도 되나」의 답이 필요하다.
    assert.notEqual(run(fx, ['살아있는 트랙 정', '--dry']).status, 0, '--dry 는 막히지 않았다');
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

test('[F146] 해시처럼 생긴 딴 것에는 안 걸린다 (없는 커밋으로 정상 이관을 막지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 박동 } = mk주인픽스처(남의sid, { 해시덮기: 'deadbee' });   // 7자 hex, 커밋 아님
  try {
    const r = run(fx, ['살아있는 트랙 정']);
    assert.equal(r.status, 0, '커밋도 아닌 문자열로 막았다: ' + r.stderr);
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
  } finally { 치우기(박동); }
});
