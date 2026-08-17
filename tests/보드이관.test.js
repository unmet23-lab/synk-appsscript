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
/* ⚠ 이 `read` 가 읽는 것은 **보드·아카이브 마크다운**이지 JS 원문이 아니다 — 아래 `!read(…).includes(…)`
 *   부정 단언들을 `코드만()` 으로 감싸지 않는다(갈래 ⓒ 비JS · 대기열 #Q72). 감싸면 렉서가 표 칸의
 *   `//`·`/*` 를 주석으로 읽어 줄을 지운다 → 「줄이 지워졌다」가 항상 참이 되어 **영원히 초록**이다. */
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
/* 🔴 아래 픽스처는 심장박동을 **디스크에 실제로 쓴다.** 그 좌표가 공유 폴더면 남의 sweep 이
 *   지우고(=「산 주인」이 「죽었다」로 보인다) 내 가짜 세션이 남의 판정에 섞인다 — 전량 실행에서만
 *   나는 거짓 적색이라 진짜 적색과 모양이 같다(실측 2026-08-15). 사유 전문 = tests/lib/상태격리.js */
const { 격리된store } = require('./lib/상태격리');
const store = 격리된store(__filename);
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

/* ── 마찰 F433 — 죽은 주인의 잔재 위에서 거절문이 **못 따를 처방**을 내밀었다 ────────
 * 위 F226 은 「내 잔재면 이어서 간다」만 열었다. 남의 잔재면 그대로 멈추는 게 맞는데(바로 위 시험),
 * 그때 옛 판이 내민 처방은 언제나 **「그 세션이 커밋한 뒤 다시 돌려라」 하나**였다. 그 주인이
 * 죽었으면 그 문장은 영원히 실행 불가고, 잠기는 것은 신고자 한 명이 아니라 **보드 정리 전체**다
 * — 만석이 안 풀리면 board-guard 가 모든 세션의 새 선언을 계속 막는다. 세션이 9~15개 도는
 * 이 저장소에서 lock 경합은 상시라 이 잠금도 상시고, 실측 2026-08-14 하루에 두 번 밟았다.
 * 출구(잔재 줄을 needle 로 한 번 더 돌리면 F226 경로로 이어서 커밋한다)는 **이미 있었는데
 * 처방에 안 적혀 있어** 아는 사람만 풀 수 있었다 — 아는 사람만 아는 출구는 없는 것과 같다.
 *
 * 지키는 성질 셋. ③이 없으면 「늘 새 문구를 낸다」가 초록이 되는데, 그건 생사를 **안 재는** 것과
 * 글자 하나 다르지 않다(그리고 산 주인의 줄을 치우라고 시켜 원칙 ⑥을 스스로 무너뜨린다):
 *   ① 잔재 주인이 **죽었으면** 실행 가능한 명령을 그 자리에 찍는다.
 *   ② 그 명령을 **되먹이면 실제로 통과하고 잠금이 풀린다**(F103 자기 처방 검사 — 문구만 갈고 끝내지 않는다).
 *   ③ 잔재 주인이 **살아 있으면** 옛 문구 그대로다.
 * ─────────────────────────────────────────────────────────────── */
const 남의sid433 = 'local_f433beef-1111-2222-3333-444455556666';
/* 재료는 **지문 하나**다(해시 0) — `local_f433beef` 는 `_` 때문에 해시 정규식의 `\b` 에 안 걸린다.
 * 일부러 그 모양으로 뒀다: 커밋이 아직 없는 트랙(양보·조사·판정안)이 F165 가 판 그 자리고,
 * 잔재 줄에서도 그쪽이 더 흔하다(죽은 세션은 대개 커밋 전에 죽는다). */
const 남의줄433 = '| 2026-08-05 | **남의 이관 병** | z.js | ✅종결 (`local_f433beef`) |';

/** 「남의 세션이 board-move 를 돌리다 ②커밋에서 죽었다」 = 아카이브에 삽입 + 미커밋 + **보드에 줄 그대로**.
 *  마지막 조건이 핵심이다 — 처방(그 줄을 needle 로 다시 돌리기)이 걸릴 자리가 거기라, 아카이브에만
 *  넣으면 시험이 실물과 다른 모양을 재게 된다. */
function mk남의잔재픽스처({ 산주인 = false } = {}) {
  const fx = mkRepoFixture();
  fs.writeFileSync(fx.board, read(fx.board).replace(ROW, ROW + '\n' + 남의줄433), 'utf8');
  git(fx.dir, 'commit', '-q', '-m', 'board', '--', '세션보드.md');
  fs.writeFileSync(fx.archive, read(fx.archive) + 남의줄433 + '\r\n', 'utf8');   // ← 삽입만, 미커밋
  let 박동 = null;
  if (산주인) {
    /* 좌표는 board-move 가 보는 것과 **같은 방법으로** 만든다(mk주인픽스처 머리말과 같은 이유). */
    const 최상위 = git(fx.dir, 'rev-parse', '--show-toplevel').stdout.trim();
    박동 = path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(남의sid433)}.json`);
    fs.mkdirSync(store.stateDir(), { recursive: true });
    fs.writeFileSync(박동, JSON.stringify({ touched: [] }), 'utf8');
  }
  return { fx, 박동 };
}

test('[F433] 잔재 주인이 **죽었으면** 거절문이 실행 가능한 명령을 준다', { skip: !hasGit && 'git 없음' }, () => {
  const { fx } = mk남의잔재픽스처();
  const before = { b: read(fx.board), a: read(fx.archive) };

  const r = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(r.status, 0, '남의 잔재 위에 그냥 커밋했다 — F102 가 열렸다');
  assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
  assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
  assert.match(String(r.stderr), /주인은 \*\*죽었다\*\*/, '생사를 안 재고 옛 문구만 낸다 — F433 재현');
  assert.match(String(r.stderr), /board-move\.js "남의 이관 병"/, '어느 줄부터 치우면 되는지 안 준다');
  assert.doesNotMatch(String(r.stderr), /그 세션이 커밋한 뒤 다시 돌려라/,
    '죽은 주인에게 「기다려라」를 아직 낸다 — 그 처방은 영원히 실행 불가다');
});

test('[F433] 잔재에 **내 것이 섞여 있어도** 처방은 남의 줄만 가리킨다', { skip: !hasGit && 'git 없음' }, () => {
  /* 🔑 이 시험이 따로 있는 이유 = **위 시험에서는 이 단언이 원리상 못 실패한다.** 처음엔 위에
   *   「내 줄은 처방에 안 든다」를 같이 걸었는데, 그 픽스처의 아카이브 차분엔 내 줄이 애초에
   *   없어서(내 줄은 보드에만 있다) 변이를 심어도 초록이었다 — 실측으로 잡았다. 차분에 **둘 다**
   *   올라오는 모양은 여기(F226 내 잔재 + 남의 삽입)뿐이고, 그게 실물에서도 가장 흔한 꼴이다. */
  const fx = mk잔재픽스처();                                   // ① 내 잔재(ROW 가 아카이브에 미커밋)
  fs.writeFileSync(fx.archive, read(fx.archive) + 남의줄433 + '\r\n', 'utf8');   // ② 그 위에 남의 삽입

  const r = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(r.status, 0, '남의 삽입이 섞였는데 그냥 커밋했다');
  assert.match(String(r.stderr), /board-move\.js "남의 이관 병"/, '진짜 막고 있는 남의 줄을 안 가리킨다');
  assert.doesNotMatch(String(r.stderr), /board-move\.js "옮길 트랙 갑"/,
    '지금 막힌 바로 그 명령을 다시 돌리라고 한다 — 원 없는 처방이 진짜 과녁을 가린다');
});

test('[F433·F103] 그 처방을 **되먹이면 통과하고 잠금이 풀린다** (자기 처방을 자기가 막지 않는지)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx } = mk남의잔재픽스처();
  /* 🔑 문구를 여기서 **재현하지 않는다** — 거절문이 실제로 내민 명령을 그대로 뽑아 되먹인다
   *   (tests/board-guard.test.js 의 만석 처방 시험과 같은 축). 시험이 처방을 다시 적으면
   *   도구가 딴 문구를 내도 초록이라, 정작 「따를 수 있나」를 아무도 안 재게 된다. */
  const 처방 = (String(run(fx, ['옮길 트랙 갑']).stderr).match(/board-move\.js "([^"]+)"/) || [])[1];
  assert.ok(처방, '거절문에서 실행할 명령을 못 뽑았다');

  const r2 = run(fx, [처방]);
  assert.equal(r2.status, 0, '거절문이 시킨 명령을 그 가드가 다시 막는다 — F103 그 모양: ' + r2.stderr);
  assert.ok(atHead(fx, '세션보드_아카이브.md').includes(남의줄433), '처방이 돌았는데 잔재가 커밋 안 됐다');
  assert.ok(!read(fx.board).includes(남의줄433), '처방이 돌았는데 보드에서 안 빠졌다');

  /* 알맹이는 여기다 — **원래 막혀 있던 이관이 이제 열려야** 신고가 닫힌다(문구만 고친 게 아니다). */
  const r3 = run(fx, ['옮길 트랙 갑']);
  assert.equal(r3.status, 0, '잔재를 치웠는데도 여전히 막힌다 — 잠금이 안 풀렸다: ' + r3.stderr);
  assertNeverLost(fx, 'F433 처방 뒤');
  assert.ok(atHead(fx, '세션보드_아카이브.md').includes(ROW), '내 줄이 아카이브에 커밋 안 됐다');
});

test('[F433] 잔재 주인이 **살아 있으면** 옛 문구 그대로다 (생사를 재는지 — 늘 새 문구면 안 재는 것과 같다)', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 박동 } = mk남의잔재픽스처({ 산주인: true });
  try {
    const before = { b: read(fx.board), a: read(fx.archive) };
    const r = run(fx, ['옮길 트랙 갑']);
    assert.notEqual(r.status, 0, '살아있는 주인의 잔재 위에 커밋했다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
    assert.match(String(r.stderr), /그 세션이 커밋한 뒤 다시 돌려라/, '산 주인인데 기다리라고 안 한다');
    assert.doesNotMatch(String(r.stderr), /board-move\.js "남의 이관 병"/,
      '산 주인의 줄을 치우라고 시킨다 — 그 처방을 따르면 원칙⑥이 스스로 무너진다');
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

/* ── 마찰 F288 — **좌표가 답을 냈는데 추론이 거부한다** ────────────────────────
 * F246 은 인용을 「트랙 칸이냐 상태 칸이냐」로 갈랐다. 그 좁히기가 못 본 조합이 하나 남는다:
 *   **내 파일**(= 좌표가 이미 「내 줄」이라 말한다) × **상태 칸의 남의 해시**.
 * 이 조합이 나쁜 이유는 세션 규약이 정확히 그것을 **시키기** 때문이다 —
 * 「조율 사실을 커밋 메시지나 보드에 1줄 남긴다」. 규약을 따르면 원칙 ⑥ 이 내 완료 줄을
 * 가두고, 처방(「그 세션이 끝난 뒤 다시 돌려라」)은 내 세션에서 실행할 수 없다. 남는 출구는
 * 근거를 지우는 것뿐이라 정보가 깎인다(F103 축 — 08-09 에 실제로 그렇게 우회했다).
 *
 * 🔑 지키는 성질 = **좌표가 나를 가리키면 추론(②③)은 안 본다. 남을 가리키면 그대로 막는다.**
 *   새는 방향이 「통과」인 자리라, 여는 쪽 1건마다 봉인 2건을 같이 건다. */

test('[F288] 내 파일의 줄은 상태 칸에 남의 해시를 **인용**해도 옮겨진다', { skip: !hasGit && 'git 없음' }, () => {
  const { fx, 줄, 해시, 박동들 } = mk인용픽스처((h) =>
    `| 2026-08-09 | **F288 내 트랙 정** | a.js | ✅종결 — ⚠남의 적색 1건(\`${h[남의sid246]}\`)이 게이트를 막는다 |`,
  { 파일이름: `${지문of(내sid246)}.md` });
  try {
    const r = run(fx, ['F288 내 트랙 정'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.equal(r.status, 0,
      '규약이 시킨 인용에 내 종결 줄이 갇혔다 — F288 재현(출구가 「근거를 지운다」뿐이다): ' + r.stderr);
    assert.ok(!read(fx.board).includes(줄), '내 종결 줄이 보드에 그대로다');
    assert.ok(read(fx.archive).includes(줄), '아카이브에 안 들어갔다');
    /* 🔴 인용한 해시가 **아카이브까지 살아서** 가야 우회(근거 삭제)가 안 일어난다.
     *   줄만 옮기고 근거가 사라지면 이 수리는 F103 을 못 막은 것이다. */
    assert.match(read(fx.archive), new RegExp(해시[남의sid246]), '인용한 근거가 이관 중에 사라졌다');
    assert.ok(해시[남의sid246] !== 해시[내sid246], '픽스처가 두 커밋을 안 갈랐다 — 이 검사는 미측정이다');
  } finally { 박동들.forEach(치우기); }
});

test('[F288] 좌표가 **남**을 가리키면 내 해시를 인용해도 안 열린다', { skip: !hasGit && 'git 없음' }, () => {
  /* 여는 조건을 「내 지문이 줄 어딘가에 있다」로 잡으면 이 줄이 통과한다 — 남의 파일에 사는
   * 남의 트랙인데 내 커밋을 배경으로 인용했을 뿐이다. 좌표는 **파일 이름** 하나뿐이다. */
  const { fx, 줄, 해시, 박동들 } = mk인용픽스처((h) =>
    `| 2026-08-09 | **F288 남의 트랙 무**(내가 고친 부분 \`${h[내sid246]}\` — 배경) | a.js | 🔵착수 |`,
  { 파일이름: `${지문of(남의sid246)}.md` });
  try {
    const before = { b: read(fx.board), a: read(fx.archive) };
    const r = run(fx, ['F288 남의 트랙 무'], { CLAUDE_CODE_HOST_SESSION_ID: 내sid246 });
    assert.equal(r.status, 6, '남의 파일인데 내 해시 인용만으로 열렸다 — F246·F146 을 되열었다');
    assert.match(String(r.stderr), new RegExp(지문of(남의sid246)), '누구 것인지 안 나온다');
    assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
    assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
  } finally { 박동들.forEach(치우기); }
});

/* 🔴 이 셋째 검사는 **한 번 거짓 초록이었다** — 그 이력을 남긴다.
 *   처음엔 「빈 id 면 `지문('')` 이 `''` 라 열림 조건이 falsy 가 된다」를 근거로 적었는데,
 *   변이 M3(`파일지문 === 내지문 || !내지문`)을 넣어도 회귀가 **하나도 안 빨개졌다**.
 *   재니 `safeId('')` 가 `''` 가 아니라 `'unknown'` 을 낸다 — 즉 그 갈래는 도달 불가능하고,
 *   검사는 「내가 세운 가드」가 아니라 **딴 것**이 막아 준 덕에 초록이었다.
 *   실제로 막는 것은 **표기 층**이다: 폴백이 hex 가 아니라, hex 8자리만 뽑는 `파일지문` 과
 *   원리적으로 같아질 수 없다. 그래서 아래는 그 전제를 **직접** 못박는다 — 폴백이 언젠가
 *   `''` 나 hex 로 바뀌면 그날 여기가 빨개진다(그때가 `내지문 &&` 벨트가 일하는 날이다). */
test('[F288] 빈 세션 id 는 「전부 내 파일」이 아니다 (폴백이 hex 가 아니라서다)', { skip: !hasGit && 'git 없음' }, () => {
  const store2 = require('../.claude/hooks/lib/handoff-store.js');
  const 보드id2 = require('../.claude/hooks/lib/board-id.js');
  const 폴백 = 보드id2.지문(store2.safeId(''));
  assert.ok(폴백, '빈 id 의 폴백이 빈 문자열이다 — `파일지문` 이 없는 줄과 구별이 사라진다');
  assert.ok(!/^[0-9a-f]{8}$/i.test(폴백),
    `빈 id 폴백이 hex 8자리(${폴백})다 — 같은 이름의 보드 파일이 생기면 남의 파일이 「내 것」으로 열린다`);

  /* 표기 층 논증을 끝까지 잇는다 — 그 폴백이 **어떤 보드 파일 이름도** 될 수 없어야 한다. */
  const { fx, 줄, 박동들 } = mk인용픽스처(() =>
    '| 2026-08-09 | **F288 빈 id 트랙 기** | a.js | 🔵착수 — 커밋 아직 없음 |',
  { 파일이름: `${지문of(남의sid246)}.md` });
  try {
    const r = run(fx, ['F288 빈 id 트랙 기'], { CLAUDE_CODE_HOST_SESSION_ID: '' });
    assert.equal(r.status, 6, '빈 id 로 남의 파일이 열렸다 — 좌표 검사가 자기 전제를 안 봤다');
    assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
  } finally { 박동들.forEach(치우기); }
});

/* ───────────────────────────────────────────────────────────────
 * 조율값 — 이관이 **커밋 2개**를 쓰고 **빈 파일을 남겼다** (2026-08-12).
 *
 * 실측 08-12: 하루 커밋 449건 중 보드·인계문 장부가 290건(65%)이고, 세션당 장부 커밋이
 * 08-07 의 2.2 에서 4.7 로 두 배가 됐다. 그중 이관 하나가 **커밋 2개**(선기록+제거)를 쓴다.
 * 그리고 줄을 뺀 파일이 그대로 남아 보드 폴더 262개 중 244개가 껍데기가 됐다(0바이트 189·
 * 머리글뿐 55). 껍데기는 조용하지 않다 — `board-guard` 는 PreToolUse 라 **파일을 쓸 때마다**
 * 그 폴더를 통째로 훑는다.
 *
 * 지키는 성질 둘. 위 F102·F083 이 지키는 「어떤 실패로도 줄이 유실되지 않는다」를 **깎지 않은
 * 채로**여야 한다는 게 전제다 — 그래서 이 절은 그 회귀들 다음에 온다.
 *   ① 정상 경로의 커밋은 **1개**고, 그 하나에 두 파일이 다 들어 있다(원자).
 *   ② 줄이 다 빠지면 파일을 지운다 — 단 **유령·사람이 쓴 글이 남아 있으면 안 지운다.**
 * ─────────────────────────────────────────────────────────────── */

const 커밋수 = (fx) => Number(git(fx.dir, 'rev-list', '--count', 'HEAD').stdout.trim());
/** 그 커밋이 만진 파일 — 한글 경로가 8진 이스케이프로 나오면 대조가 통째로 어긋난다(F045 계열). */
const 커밋한파일 = (fx, ref = 'HEAD') =>
  git(fx.dir, '-c', 'core.quotePath=false', 'show', '--name-only', '--format=', ref)
    .stdout.trim().split(/\r?\n/).filter(Boolean).sort();

/** 보드에 데이터행이 **ROW 하나뿐**인 판 — 옮기면 껍데기만 남는 자리다. */
function mk막줄Fixture(꼬리 = []) {
  const fx = mkRepoFixture();
  fs.writeFileSync(fx.board, [
    '# 세션보드', '', '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|',
    ROW, ...꼬리, '',
  ].join('\n'), 'utf8');
  git(fx.dir, 'commit', '-q', '-m', '한 줄만', '--', '세션보드.md');
  return fx;
}

test('[조율값] 이관이 **커밋 1개**로 끝난다 (선기록+제거 2벌이 아니다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();
  const before = 커밋수(fx);
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  assert.equal(커밋수(fx) - before, 1,
    `이관에 커밋이 ${커밋수(fx) - before}개 나갔다 — 세션당 장부 값이 그만큼 곱해진다`);
  assert.deepEqual(커밋한파일(fx), ['세션보드.md', '세션보드_아카이브.md'],
    '한 커밋에 두 파일이 함께 들어 있어야 원자다(하나만 들어 있으면 F102 창이 다시 열린다)');
  assertNeverLost(fx, '원자 커밋');
});

test('[조율값] 마지막 줄이면 **빈 껍데기를 남기지 않는다** (파일째 지운다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk막줄Fixture();
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  assert.ok(read(fx.archive).includes(ROW), '줄이 아카이브에 없다 — 지우기 전에 유실됐다');
  assert.ok(!fs.existsSync(fx.board), '줄이 다 빠졌는데 껍데기 파일이 남았다(244개가 이렇게 쌓였다)');
  assert.notEqual(git(fx.dir, 'show', 'HEAD:세션보드.md').status, 0,
    '파일 삭제가 커밋에 안 담겼다 — 작업본만 지우면 다음 체크아웃에서 되살아난다');
  assert.match(String(r.stdout), /빈 보드 파일을 남기지 않고 지운다/, '지웠다는 사실을 안 알렸다');
});

test('[조율값] 줄이 **남아 있으면** 파일을 지우지 않는다', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();                      // 데이터행 2개 — 하나 빼도 하나 남는다
  assert.equal(run(fx, ['옮길 트랙 갑']).status, 0);
  assert.ok(fs.existsSync(fx.board), '아직 줄이 남았는데 파일을 지웠다');
  assert.ok(read(fx.board).includes('남을 트랙 을'), '남아야 할 줄이 사라졌다');
});

/* 🔑 `표줄` 은 **넓은** 판정이라 유령까지 센다(F322·F330·F331). 유령을 「데이터행이 아니니 빈
 * 파일」로 읽어 조용히 지우면 그건 유령보다 나쁘다 — 유령은 적어도 파일에 남아 있었다. */
test('[조율값] **유령**이 남아 있으면 안 지운다 (규격 밖 줄을 조용히 버리지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const 유령줄 = '| 08-04 | **유령 트랙** | x.js | 완료 |';   // 날짜가 두 자리 = 조립기가 못 읽는다
  const fx = mk막줄Fixture([유령줄]);
  assert.equal(run(fx, ['옮길 트랙 갑']).status, 0);
  assert.ok(fs.existsSync(fx.board), '유령만 남았는데 파일째 지웠다 — 그 줄은 어디에도 안 남는다');
  assert.ok(read(fx.board).includes(유령줄), '유령 줄이 사라졌다');
});

test('[조율값] **사람이 쓴 글**이 남아 있으면 안 지운다', { skip: !hasGit && 'git 없음' }, () => {
  const 메모 = '메모: 이 트랙은 개원 뒤 다시 본다';
  const fx = mk막줄Fixture([메모]);
  assert.equal(run(fx, ['옮길 트랙 갑']).status, 0);
  assert.ok(fs.existsSync(fx.board), '내 것이 아닌 글이 있는데 파일째 지웠다');
  assert.ok(read(fx.board).includes(메모), '남의 메모가 사라졌다');
});

/* 옛 판은 실패 자리에 「아카이브만 커밋된 중복」을 남겼고 재실행은 F226 잔재 경로로만 살았다.
 * 원자 판은 되돌려서 **정상 경로**로 재실행되게 한다 — 되돌리지 않으면 보드에 줄이 없어
 * 다음 실행이 「못 찾았다」로 죽고, 처방이 못 따를 처방이 된다(F103). */
test('[조율값] 커밋이 실패하면 보드를 **원문으로 되돌린다** (재실행이 정상 경로로 간다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();
  const before = read(fx.board);
  const hook = path.join(fx.dir, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', 'utf8');
  fs.chmodSync(hook, 0o755);

  const r = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(r.status, 0, '커밋이 막혔는데 성공으로 끝났다');
  assert.equal(read(fx.board), before, '보드를 안 되돌렸다 — 재실행이 「못 찾았다」로 죽는다');
  assertNeverLost(fx, '원자 실패');

  fs.unlinkSync(hook);                                   // 막던 것을 치우고 그대로 다시 돌린다
  const r2 = run(fx, ['옮길 트랙 갑']);
  assert.equal(r2.status, 0, '되돌린 뒤 재실행이 안 된다(F103 — 못 따를 처방): ' + r2.stderr);
  assert.ok(atHead(fx, '세션보드_아카이브.md').includes(ROW), '재실행이 아카이브를 커밋 안 했다');
  assert.ok(!atHead(fx, '세션보드.md').includes(ROW), '재실행이 보드 제거를 커밋 안 했다');
});

test('[조율값] 되돌리기는 **지운 파일도 되살린다** (껍데기 갈래가 롤백에서 새지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk막줄Fixture();
  const before = read(fx.board);
  const hook = path.join(fx.dir, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', 'utf8');
  fs.chmodSync(hook, 0o755);

  const r = run(fx, ['옮길 트랙 갑']);
  assert.notEqual(r.status, 0, '커밋이 막혔는데 성공으로 끝났다');
  assert.ok(fs.existsSync(fx.board), '커밋이 실패했는데 지운 보드를 안 되살렸다 — 줄이 작업본에서 사라진다');
  assert.equal(read(fx.board), before, '되살렸는데 내용이 원문이 아니다');
});

/* ═══ 원칙 ⑦ — 「주인이 죽었다」를 「일이 끝났다」로 번역하지 않는다 (F397 · 2026-08-13) ═══
 * 실사고: `18537b29` 가 죽은 세션 `0ba9d4da` 의 줄을 아카이브로 옮겼는데 그 줄의 상태 칸은
 * `▶작업중 — /deploy 진입` 이었고, 그 트랙이 밀던 v9.228 은 라이브에 한 바이트도 안 나갔다.
 * 아카이브로 들어간 미완 트랙은 보드에도 인계문에도 안 뜨니 다음 세션이 원리상 못 줍는다.
 *
 * 🔑 탐지력은 **여기 픽스처가** 진다 — 실저장소는 살아있는 세션이 매번 달라 초록이 우연이 된다.
 *   그리고 거짓양성 세 갈래(내 줄·완료 줄·이름 없는 보드)를 각각 못박는다: 이 가드가 새는 방향은
 *   「통과」지만, **틀린 방향으로 조이면 board-guard 의 만석 처방이 통째로 죽는다**(F103·F278). */
const 남의sid397 = 'local_f397dead-9999-8888-7777-666655554444';
const 지문397 = 'f397dead';
const 딴세션397 = 'local_11112222-aaaa-bbbb-cccc-dddddddddddd';

/** 보드 파일 이름이 **지문 꼴**인 픽스처 — 원칙 ⑦ 의 주인 판정은 파일 이름이 좌표다(F246). */
function mk지문보드픽스처(상태 = '▶작업중 — /deploy 진입') {
  const fx = mkFixture();
  const board = path.join(fx.dir, `${지문397}.md`);
  const 줄 = `| 2026-08-13 | **미완 트랙 무** | a.js | ${상태} |`;
  fs.writeFileSync(board, [
    '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', 줄, '',
  ].join('\n'), 'utf8');
  return { fx: { ...fx, board }, 줄 };
}

test('[F397] 남의 죽은 세션의 **작업중** 줄은 아카이브로 안 옮긴다', () => {
  const { fx, 줄 } = mk지문보드픽스처();
  const before = { b: read(fx.board), a: read(fx.archive) };
  const r = run(fx, ['미완 트랙 무'], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.notEqual(r.status, 0, '미완인 남의 줄을 그냥 옮겼다 — F397 재현(미완이 완료의 얼굴로 굳는다)');
  assert.match(String(r.stderr), /원칙 ⑦|F397/, '왜 막혔는지 안 말한다');
  assert.match(String(r.stderr), new RegExp(지문397), '누구 줄인지 안 나온다');
  assert.match(String(r.stderr), /--미완확인/, '탈출구를 안 내민다 — 못 따를 처방이 된다(F103)');
  assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
  assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
  assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
});

test('[F397] `--dry` 도 같은 답을 낸다 (계획만 볼 때야말로 답이 필요하다)', () => {
  const { fx } = mk지문보드픽스처();
  const r = run(fx, ['미완 트랙 무', '--dry'], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.notEqual(r.status, 0, '--dry 가 원칙 ⑦ 을 안 말한다 — 계획이 실행과 갈린다');
});

test('[F397·거짓양성] **내 줄**이면 작업중이어도 옮긴다 (/close 를 잠그지 않는다)', () => {
  const { fx, 줄 } = mk지문보드픽스처();
  const r = run(fx, ['미완 트랙 무'], { CLAUDE_CODE_HOST_SESSION_ID: 남의sid397 });
  assert.equal(r.status, 0, '내 줄인데 막혔다 — 이 가드가 /close 를 잠근다: ' + r.stderr);
  assert.ok(read(fx.archive).includes(줄), '내 줄이 아카이브에 안 들어갔다');
});

test('[F397·거짓양성] 남의 줄이어도 **완료**면 그대로 옮긴다 (board-guard 처방을 안 죽인다)', () => {
  const { fx, 줄 } = mk지문보드픽스처('✅종결 — 라이브 반영까지 끝');
  const r = run(fx, ['미완 트랙 무'], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.equal(r.status, 0, '완료 줄을 막았다 — board-guard 의 만석 처방이 통째로 죽는다(F278): ' + r.stderr);
  assert.ok(read(fx.archive).includes(줄), '완료 줄이 아카이브에 안 들어갔다');
});

test('[F397·거짓양성] 보드 이름이 지문 꼴이 아니면 이 검사는 **안 돈다**', () => {
  const fx = mkFixture();
  fs.writeFileSync(fx.board, read(fx.board).replace(ROW,
    '| 2026-08-04 | **옮길 트랙 갑** | a.js | ▶작업중 |'), 'utf8');
  const r = run(fx, ['옮길 트랙 갑'], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.equal(r.status, 0, '주인을 못 가르는 보드까지 막았다 — 오탐은 이 도구를 안 쓰게 만든다: ' + r.stderr);
});

test('[F397·자기처방] `--미완확인 "사유"` 를 붙이면 **실제로 지나간다** (F103 — 처방이 도는지 본다)', () => {
  const { fx, 줄 } = mk지문보드픽스처();
  const r = run(fx, ['미완 트랙 무', '--미완확인', '커밋 abc1234 열어 잔여 0 확인'],
    { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.equal(r.status, 0, '거절이 시킨 그 명령이 안 돈다 — 우회가 정상 통로가 된다: ' + r.stderr);
  assert.ok(read(fx.archive).includes(줄), '--미완확인 인데 아카이브에 안 들어갔다');
});

/* ── F407 — 「근거를 달아 다시 돌려라」가 **근거를 달면 튕기던** 자리 (2026-08-14) ─────────
 * 옛 판은 needle 을 「`--dry`·`--미완확인` 을 뺀 나머지 전부」로 조립했다. 그래서 거절문을 그대로
 * 따라 근거를 붙이면 그 근거까지 검색 문구가 되어 **「줄을 못 찾았다」**로 죽었다 — 성공하는
 * 유일한 통로가 근거를 버리는 쪽이었고, 그래서 근거는 어디에도 안 남았다(정확히 F103).
 * 🔑 탐지력은 아래 ①이 진다 — 옛 판에서 이 시험은 status 1 로 **적색**이다. */

test('[F407·탐지] 사유를 붙여도 **문구 검색이 오염되지 않는다** (옛 판은 「못 찾았다」로 튕겼다)', () => {
  const { fx, 줄 } = mk지문보드픽스처();
  const r = run(fx, ['미완 트랙 무', '--미완확인', '커밋 abc1234 열어 잔여 0 확인'],
    { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.doesNotMatch(String(r.stderr), /못 찾았다/,
    '사유가 needle 로 새어 들어갔다 — F407 재현(처방을 따르면 실패한다)');
  assert.equal(r.status, 0, '사유를 붙였더니 죽었다: ' + r.stderr);
  assert.ok(read(fx.archive).includes(줄), '사유를 붙였더니 아카이브에 안 들어갔다');
});

test('[F407] `--미완확인=사유` 꼴도 같은 답을 낸다', () => {
  const { fx, 줄 } = mk지문보드픽스처();
  const r = run(fx, ['미완 트랙 무', '--미완확인=커밋 abc1234 열어 잔여 0 확인'],
    { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.equal(r.status, 0, '= 꼴이 안 돈다: ' + r.stderr);
  assert.ok(read(fx.archive).includes(줄), '= 꼴인데 아카이브에 안 들어갔다');
});

test('[F407] **사유 없는** `--미완확인` 은 거절하고 아무것도 안 쓴다', () => {
  const { fx, 줄 } = mk지문보드픽스처();
  const before = { b: read(fx.board), a: read(fx.archive) };
  const r = run(fx, ['미완 트랙 무', '--미완확인'], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.notEqual(r.status, 0,
    '사유 없이 지나갔다 — 「주인이 죽었으니 옮긴다」와 같아지고 원칙 ⑦ 이 무력해진다(F397)');
  assert.match(String(r.stderr), /F407/, '왜 막혔는지 안 말한다');
  assert.equal(read(fx.board), before.b, '거부인데 보드가 변했다');
  assert.equal(read(fx.archive), before.a, '거부인데 아카이브가 변했다');
  assert.ok(read(fx.board).includes(줄), '거부인데 줄이 보드에서 사라졌다');
});

/** 원칙 ⑦ 이 걸리는 조건(파일 이름 = **남의** 지문)을 **커밋된 저장소** 안에 세운다 —
 *  「사유가 실제로 남았나」는 저장소 안에서만 잴 수 있다(픽스처 밖에선 커밋 자체가 없다). */
function mk지문repo픽스처(상태 = '▶작업중 — /deploy 진입') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardmove-'));
  const board = path.join(dir, `${지문397}.md`);
  const archive = path.join(dir, '세션보드_아카이브.md');
  const 줄 = `| 2026-08-13 | **미완 트랙 무** | a.js | ${상태} |`;
  fs.writeFileSync(board, [
    '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', 줄, '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(archive, [
    '# 세션보드 아카이브', '', '> 읽지 않는 파일.', '', '---', '',
    '| 2026-08-03 | **옛 트랙** | c.js | 완료 |', '',
  ].join('\r\n'), 'utf8');
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@synk.local');
  git(dir, 'config', 'user.name', 'boardmove-test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'add', '--', `${지문397}.md`, '세션보드_아카이브.md');
  git(dir, 'commit', '-q', '-m', 'fixture');
  return { fx: { dir, board, archive }, 줄 };
}

/* F407 의 **본론**. 위 시험들은 「사유가 받아들여지나」까지고, 신고문이 아픈 자리는 그 다음이다 —
 * 「성공하는 통로가 근거를 버리는 쪽이라 **근거가 어디에도 안 남는다**」. 안 재면 이 기록은
 * 조용히 끊길 수 있고, 끊긴 증상은 적색이 아니라 **초록**이다(CLAUDE.md 맹점 ④). */
test('[F407·기록] 사유가 **이관 커밋 메시지에** 남는다', { skip: !hasGit && 'git 없음' }, () => {
  const { fx } = mk지문repo픽스처();
  const 사유 = '커밋 abc1234 열어 잔여 0 확인';
  const r = run(fx, ['미완 트랙 무', '--미완확인', 사유], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  const msg = git(fx.dir, 'log', '-1', '--format=%B').stdout;
  assert.ok(msg.includes(사유), '사유가 커밋 메시지에 안 남았다 — 근거가 어디에도 없다(F407):\n' + msg);
  assert.match(msg, /F407|미완확인 사유/, '어느 통로로 남은 근거인지 안 적힌다');
});

test('[F407·거짓양성] **평범한 이관**의 커밋엔 사유 줄이 안 붙는다', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mkRepoFixture();
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  assert.doesNotMatch(git(fx.dir, 'log', '-1', '--format=%B').stdout, /미완확인 사유/,
    '미완확인을 안 썼는데 사유 줄이 붙었다 — 커밋 메시지가 거짓을 말한다');
});

/* 자기 처방 되먹임 — CLAUDE.md 가드 맹점 ③. 차단 사유가 **시키는 명령을 그대로 뽑아**
 * 그 가드에 되먹여 통과하는지 본다. 손으로 옮겨 적으면 그건 처방이 아니라 내 해석이다. */
test('[F407·자기처방] 사유 없음 거절문이 **내미는 명령을 그대로** 돌리면 지나간다', () => {
  const { fx, 줄 } = mk지문보드픽스처();
  const r = run(fx, ['미완 트랙 무', '--미완확인'], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  const m = String(r.stderr).match(/node tools\/board-move\.js\s+"([^"]+)"\s+--미완확인\s+"([^"]+)"/);
  assert.ok(m, '거절문이 그대로 돌릴 명령을 안 내민다 — 못 따를 처방이다(F103): ' + r.stderr);
  const r2 = run(fx, [m[1], '--미완확인', m[2]], { CLAUDE_CODE_HOST_SESSION_ID: 딴세션397 });
  assert.equal(r2.status, 0, '거절문이 내민 그 명령이 안 돈다 — 우회가 정상 통로가 된다: ' + r2.stderr);
  assert.ok(read(fx.archive).includes(줄), '처방대로 했는데 아카이브에 안 들어갔다');
});

/* ── ⑧ 잔재 닫기 — 「옮김은 끝났고 커밋만 안 됐다」 (F572 · 2026-08-17 실사고) ────────────
 *
 * 원칙⑤ 거절문이 내미는 F433 처방(「잔재 줄부터 마저 옮겨라」)이 실물로 튕겼다. 잔재를 남긴
 * 세션이 **보드 삭제까지 작업본에 쓰고** 죽으면 그 줄은 보드에 없어서 needle 이 못 찾는다 —
 * 이 도구가 스스로 「남는 사각」이라 적어둔 그 판이고, 그날 완료 줄 5건이 3시간 갇혔다.
 *
 * ⚠ 여기서 새는 방향은 **「통과」**다: 게이트가 느슨하면 남의 보드 편집이 이 커밋에 실린다(F073).
 *   그래서 픽스처는 「닫히나」와 **「안 닫혀야 할 때 안 닫히나」를 같은 무게로** 잰다.
 * 🔑 게이트는 주인의 생사가 아니라 **차분의 모양**이다 — 옮길 줄이 아예 없으니 원칙⑥과 다른
 *   질문이고, 모양 검사가 더 세다(죽은 세션도 보드 파일에 딴 편집을 남길 수 있다).
 */

const 잔재줄 = '| 2026-08-05 | **잔재 트랙 병** | z.js | ✅종결 `deadbea7` |';
/* 문구가 위 줄과 **겹치도록** 지었다(「병」 ⊂ 「병정」) — 모호 게이트를 재려면 겹쳐야 한다. */
const 잔재줄둘 = '| 2026-08-05 | **잔재 트랙 병정** | v.js | ✅종결 `deadbea7` |';
const 산줄 = '| 2026-08-05 | **도는 트랙 정** | y.js | ▶작업중 |';

/** 실사고 상태를 그대로 짓는다: 아카이브 +1줄 / 보드 −1줄이 **둘 다 미커밋**.
 *  ⚠ 이름을 `mk잔재픽스처` 로 하면 **위 F226 픽스처와 충돌한다**(함수 선언은 호이스팅되어 뒤가
 *    이긴다) — 그 판에서 F226·F433 세 시험이 조용히 내 픽스처를 불러 빨개졌다. 실측으로 밟았다. */
function mk보드삭제잔재픽스처({ 보드에도남김 = false, 보드에딴편집 = false, 아카이브에서삭제 = false, 둘째잔재 = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardmove-f572-'));
  const 보드폴더 = path.join(dir, 'docs', '_ops', '보드');
  fs.mkdirSync(보드폴더, { recursive: true });
  const board = path.join(보드폴더, 'deadbea7.md');
  const archive = path.join(dir, 'docs', '세션보드_아카이브.md');

  const 머리 = ['<!-- 세션 보드 정본 조각 -->', ''];
  const 잔재들 = 둘째잔재 ? [잔재줄, 잔재줄둘] : [잔재줄];
  fs.writeFileSync(board, [...머리, ...잔재들, 산줄, ''].join('\n'), 'utf8');
  fs.writeFileSync(archive, ['# 아카이브', '', '---', '', '| 2026-08-03 | **옛 트랙** | c.js | 완료 |', ''].join('\r\n'), 'utf8');

  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@synk.local');
  git(dir, 'config', 'user.name', 'boardmove-test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'fixture');

  // ── 여기부터가 「중단된 board-move」의 작업본 상태다 ──
  const 아카이브줄들 = fs.readFileSync(archive, 'utf8').split('\r\n');
  const sep = 아카이브줄들.findIndex((l) => /^\s*---\s*$/.test(l));
  아카이브줄들.splice(sep + 2, 0, ...잔재들);
  fs.writeFileSync(archive, 아카이브줄들.join('\r\n'), 'utf8');

  if (아카이브에서삭제) {   // 장부유실 방향 — 손을 대면 안 되는 판
    fs.writeFileSync(archive,
      fs.readFileSync(archive, 'utf8').replace('| 2026-08-03 | **옛 트랙** | c.js | 완료 |\r\n', ''), 'utf8');
  }
  if (!보드에도남김) {      // 보드 삭제까지 이미 작업본에 썼다 = 실사고 그 모양
    const 남은것 = [...머리,
      ...(보드에딴편집 ? [산줄, '| 2026-08-05 | **새 선언 무** | x.js | ▶작업중 |'] : [산줄]), ''];
    fs.writeFileSync(board, 남은것.join('\n'), 'utf8');
  }
  return { dir, board, archive };
}

/** 잔재 경로는 `SYNK_BOARD` 를 **안** 넘긴다 — 처방문의 명령이 그렇게 돈다(사람이 손으로 친다). */
function run잔재(fx, args) {
  return 훅띄우기([TOOL, ...args], {
    encoding: 'utf8',
    통과코드: [0, 1, 6, 7],
    env: {
      ...process.env,
      SYNK_BOARD_ROOT: fx.dir,
      SYNK_BOARD_ARCHIVE: fx.archive,
      SYNK_BOARD: '',
      CLAUDE_CODE_HOST_SESSION_ID: 'local_11111111-2222-3333-4444-555566667777',
    },
  });
}
const at잔재HEAD = (fx, rel) => git(fx.dir, 'show', `HEAD:${rel}`).stdout;

test('[F572] 보드 줄이 이미 사라진 잔재를 **닫는다** — 옛 판은 「못 찾았다」로 튕겼다', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처();
  const r = run잔재(fx, ['잔재 트랙 병']);
  assert.equal(r.status, 7, '잔재를 닫았으면 7 이어야 한다(0 은 「그 줄을 옮겼다」는 뜻이다): ' + r.stderr);
  assert.ok(at잔재HEAD(fx, 'docs/세션보드_아카이브.md').includes('잔재 트랙 병'), '아카이브 추가가 커밋에 안 들어갔다');
  assert.ok(!at잔재HEAD(fx, 'docs/_ops/보드/deadbea7.md').includes('잔재 트랙 병'), '보드 삭제가 커밋에 안 들어갔다');
  assert.ok(at잔재HEAD(fx, 'docs/_ops/보드/deadbea7.md').includes('도는 트랙 정'), '남아야 할 줄까지 사라졌다');
  const 남은것 = git(fx.dir, 'status', '--porcelain').stdout.trim();
  assert.equal(남은것, '', '닫았는데 미커밋이 남았다 — 세션이 끝나면 또 잠근다:\n' + 남은것);
});

test('[F572·자기처방] 원칙⑤ 거절문이 **내미는 명령을 그대로** 돌리면 지나간다 (F103 되먹임)', { skip: !hasGit && 'git 없음' }, () => {
  /* 그날 실물 순서 그대로: ①다른 줄을 옮기려다 원칙⑤에 막힌다 ②거절문이 내민 명령을 그대로 친다.
   * 손으로 옮겨 적지 않고 **stderr 에서 뽑아** 되먹인다 — 옮겨 적으면 그건 처방이 아니라 내 해석이다. */
  const fx = mk보드삭제잔재픽스처();
  fs.appendFileSync(fx.board, '| 2026-08-05 | **옮기려는 트랙 기** | w.js | ✅종결 |\n', 'utf8');
  git(fx.dir, 'commit', '-q', '-m', '새 완료 줄', '--', 'docs/_ops/보드/deadbea7.md');

  const 막힘 = run잔재(fx, ['옮기려는 트랙 기']);
  assert.notEqual(막힘.status, 0, '아카이브가 더러운데 옮겨졌다 — 원칙⑤가 죽었다');
  const m = String(막힘.stderr).match(/node tools\/board-move\.js\s+"([^"]+)"/);
  assert.ok(m, '거절문이 그대로 돌릴 명령을 안 내민다(F433): ' + 막힘.stderr);

  const r2 = run잔재(fx, [m[1]]);
  assert.equal(r2.status, 7, '거절문이 내민 그 명령이 안 돈다 — 우회가 정상 통로가 된다(F103): ' + r2.stderr);
  assert.ok(at잔재HEAD(fx, 'docs/세션보드_아카이브.md').includes('잔재 트랙 병'), '처방대로 했는데 안 담겼다');
});

test('[F572] 보드 파일에 **잔재 삭제가 아닌 변경**이 섞이면 아무것도 쓰지 않는다 (남의 편집을 안 실어간다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처({ 보드에딴편집: true });
  const 전 = git(fx.dir, 'rev-parse', 'HEAD').stdout.trim();
  const r = run잔재(fx, ['잔재 트랙 병']);
  assert.notEqual(r.status, 7, '남의 새 선언이 섞였는데 닫았다 — 그게 F073 이다');
  assert.match(String(r.stderr), /잔재 삭제가 아닌/, '무엇이 걸렸는지 이름을 안 댄다');
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD').stdout.trim(), 전, '거절인데 커밋이 생겼다');
  assert.ok(read(fx.board).includes('새 선언 무'), '남의 편집이 사라졌다');
});

test('[F572] 아카이브에서 **빠진** 행이 있으면 손을 안 댄다 (장부유실 방향은 잔재가 아니다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처({ 아카이브에서삭제: true });
  const 전 = git(fx.dir, 'rev-parse', 'HEAD').stdout.trim();
  const r = run잔재(fx, ['잔재 트랙 병']);
  assert.notEqual(r.status, 7, '장부에서 행이 빠진 판을 닫았다 — 그 상태를 커밋으로 굳히면 안 된다');
  assert.match(String(r.stderr), /빠진|장부유실/, '왜 안 닫는지 안 말한다');
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD').stdout.trim(), 전, '거절인데 커밋이 생겼다');
});

test('[F572] 보드 줄이 **아직 남아 있으면** 정상 이관 경로가 그대로 열린다 (F226 자리를 안 막는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처({ 보드에도남김: true });
  const r = run잔재(fx, ['잔재 트랙 병']);
  assert.ok([0, 7].includes(r.status), '보드에 줄이 살아 있는데 막혔다: ' + r.stderr);
  assert.ok(at잔재HEAD(fx, 'docs/세션보드_아카이브.md').includes('잔재 트랙 병'), '어느 경로로든 아카이브엔 담겨야 한다');
});

test('[F572] `--dry` 는 계획만 내고 **커밋하지 않는다**', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처();
  const 전 = git(fx.dir, 'rev-parse', 'HEAD').stdout.trim();
  const r = run잔재(fx, ['잔재 트랙 병', '--dry']);
  assert.equal(r.status, 0, '--dry 는 0 이어야 한다: ' + r.stderr);
  assert.match(String(r.stdout), /이미 아카이브에 옮겨져 있다/, '무엇을 하려는지 안 말한다');
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD').stdout.trim(), 전, '--dry 인데 커밋했다');
});

/* 🔴 아래 둘은 **변이가 낸 구멍을 메운 것**이다 — 「모호한 문구도 닫는다」로 망가뜨렸는데 61건이
 * 전부 초록이었다(2026-08-17 실측). 게이트 ②(needle 이 정확히 1줄)에 회귀가 없었다. */
test('[F572] needle 이 잔재 **여러 줄**에 걸리면 거절한다 (엉뚱한 잔재를 닫지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처({ 둘째잔재: true });
  const 전 = git(fx.dir, 'rev-parse', 'HEAD').stdout.trim();
  const r = run잔재(fx, ['잔재 트랙 병']);        // 「병」과 「병정」 둘 다에 걸린다
  assert.notEqual(r.status, 7, '모호한 문구로 닫았다 — 어느 잔재를 닫은 것인지 말할 수 없다');
  assert.match(String(r.stderr), /잔재 \d+줄에 걸린다|더 구체적인/, '왜 안 닫는지·무엇을 하라는지 안 말한다');
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD').stdout.trim(), 전, '거절인데 커밋이 생겼다');
});

test('[F572] 잔재가 둘이어도 **문구를 좁히면** 닫힌다 (모호 거절이 막다른 길이 아니다 · F103)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처({ 둘째잔재: true });
  const r = run잔재(fx, ['잔재 트랙 병정']);      // 둘째 것만 가리킨다
  assert.equal(r.status, 7, '좁힌 문구로도 안 닫히면 모호 거절이 못 따를 처방이 된다: ' + r.stderr);
  /* 아카이브 커밋은 더해진 행 **전부**를 싣는다 — 「한 줄만 닫는다」는 원리상 불가능하다(도구 주석 그대로). */
  const 담김 = git(fx.dir, 'show', 'HEAD:docs/세션보드_아카이브.md').stdout;
  assert.ok(담김.includes('잔재 트랙 병정'), '가리킨 잔재가 안 담겼다');
  assert.ok(담김.includes('잔재 트랙 병'), '같은 파일의 더해진 행은 함께 실린다 — 그 원리를 회귀로 못박는다');
});

test('[F572·거짓양성] 잔재가 **없으면** 원래 거절문 그대로다 (없는 문구를 닫힘으로 번역하지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처({ 보드에도남김: true });
  git(fx.dir, 'commit', '-q', '-m', '아카이브 정리', '--', 'docs/세션보드_아카이브.md');   // 잔재를 없앤다
  const r = run잔재(fx, ['없는 문구 xyzzy']);
  assert.equal(r.status, 1, '못 찾은 것은 1 이어야 한다');
  assert.match(String(r.stderr), /못 찾았다/, '원래 거절문이 사라졌다');
});

/* 🔴 아래 둘도 **변이가 낸 구멍을 메운 것**이다 (2026-08-17 실측 · `local_cc683bbf`).
 * 위 넷은 «닫기 전» 게이트(모양 검사 셋)를 물었는데, **«커밋한 뒤»의 두 게이트에는 회귀가 0**이었다:
 *   ①`if (c.status !== 0)` 커밋 실패 ②`if (빠진것.length)` 착지 확인 — 둘 다 지워도 63건이 전부 초록.
 * 그 둘이 지키는 것은 F571 과 같은 축이다: **판정이 아니라 「사유가 화면까지 오나」.** 잔재 닫기는
 * `보드수거` 가 자동으로 부르는 자리라(SessionStart), 여기서 거짓 「완료」가 나면 안 담긴 줄이
 * «담김»으로 세어지고 그 줄은 보드에도 아카이브에도 없이 사라진다.
 *
 * ⚠ **①은 「exit≠7」만으로는 안 잡힌다** — 커밋 실패를 무시해도 바로 뒤 ②가 붙잡아 exit 1 로 죽기
 *   때문이다. 다만 그때 화면에 오는 사유가 「이 도구를 먼저 고쳐라」로 **바뀐다**: 원인은 남의
 *   pre-commit 훅인데 도구 탓으로 번역된다(F571 이 3시간을 태운 바로 그 모양). 그래서 이 시험은
 *   상태 코드가 아니라 **사유의 «신원»**을 못박는다. */
test('[F572] 잔재를 담는 **커밋이 막히면** 그 사유가 그대로 온다 (도구 탓으로 번역하지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처();
  const hook = path.join(fx.dir, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', 'utf8');
  fs.chmodSync(hook, 0o755);
  const 전 = git(fx.dir, 'rev-parse', 'HEAD').stdout.trim();

  const r = run잔재(fx, ['잔재 트랙 병']);
  assert.notEqual(r.status, 7, '커밋이 막혔는데 「닫았다」(7)로 끝났다 — 보드수거가 안 담긴 줄을 담김으로 센다');
  assert.match(String(r.stderr), /커밋이 실패했다/, '커밋이 막힌 사실이 화면에 안 온다(F571 축)');
  assert.doesNotMatch(String(r.stderr), /이 도구를 먼저 고쳐라/,
    '남의 훅이 막은 것을 **도구 결함**으로 번역했다 — 다음 사람이 엉뚱한 곳을 판다');
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD').stdout.trim(), 전, '커밋이 막혔는데 커밋이 생겼다');
  assert.ok(read(fx.archive).includes('잔재 트랙 병'), '실패인데 작업본의 잔재가 사라졌다 — 재실행할 재료가 없어진다');
});

/* ②의 시나리오 = 「커밋은 **성공**했는데 그 줄이 HEAD 에 안 실렸다」. 억지 상황이 아니라 이 도구가
 * 스스로 방어하는 자리이고(주석: 「커밋됐나는 작업본이 아니라 커밋된 내용으로 판정한다」),
 * pre-commit 훅이 임시 인덱스(`$GIT_INDEX_FILE`)에서 경로를 빼면 실제로 그 모양이 난다 — 실측했다. */
test('[F572] 커밋은 됐는데 **HEAD 에 잔재가 없으면** 완료라고 말하지 않는다 (작업본으로 판정 안 한다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk보드삭제잔재픽스처();
  const hook = path.join(fx.dir, '.git', 'hooks', 'pre-commit');
  // 커밋 자체는 통과시키되(exit 0) 아카이브만 이 커밋에서 빼낸다 — 「초록인데 안 실렸다」를 만든다.
  fs.writeFileSync(hook,
    '#!/bin/sh\ngit rm --cached -q --force -- docs/세션보드_아카이브.md 2>/dev/null || true\nexit 0\n', 'utf8');
  fs.chmodSync(hook, 0o755);

  const r = run잔재(fx, ['잔재 트랙 병']);
  assert.notEqual(r.status, 7, '아카이브가 HEAD 에 안 실렸는데 「닫았다」(7)로 끝났다 — 줄이 조용히 사라진다');
  assert.match(String(r.stderr), /HEAD 판에 .*없다|아카이브의 HEAD/,
    '무엇이 안 실렸는지 이름을 안 댄다');
  assert.ok(!git(fx.dir, 'show', 'HEAD:docs/세션보드_아카이브.md').stdout.includes('잔재 트랙 병'),
    '픽스처가 성립 안 했다 — 아카이브가 그대로 실렸으면 이 시험은 아무것도 안 잰다');
});
