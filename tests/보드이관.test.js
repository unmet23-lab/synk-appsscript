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
const { spawnSync } = require('node:child_process');

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

function run(fx, args) {
  return spawnSync(process.execPath, [TOOL, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BOARD: fx.board, SYNK_BOARD_ARCHIVE: fx.archive },
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
  assert.match(String(r.stderr), /직접 커밋/, '무엇을 해야 하는지 안 알려준다');
  assertNeverLost(fx, '커밋 실패');
  assert.ok(read(fx.archive).includes(ROW), '커밋이 막혔다고 줄까지 잃으면 안 된다');
});

/* 이 커밋은 두 파일을 통째로 싣는다 — 이관 **전부터** 미커밋이던 게 있으면 남의 것일 수 있다(F073).
 * 양방향으로 잠근다: 깨끗하면 조용하고, 더러우면 무엇이 실렸는지 이름을 댄다.
 * (측정을 쓰기 **뒤**로 옮기면 내가 만든 변경까지 「원래 있던 것」으로 잡혀 경고가 늘 떠 무시하게 된다.) */
test('[F102] 함께 실리는 남의 미커밋을 이름으로 드러낸다 (깨끗하면 조용하다)', { skip: !hasGit && 'git 없음' }, () => {
  const clean = run(mkRepoFixture(), ['옮길 트랙 갑']);
  assert.doesNotMatch(String(clean.stdout), /함께 실린다/, '깨끗한데 경고가 떴다 — 늘 뜨는 경고는 안 읽힌다');

  const fx = mkRepoFixture();
  fs.writeFileSync(fx.archive, read(fx.archive) + '\n<!-- 남의 미커밋 -->\n', 'utf8');
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0, '이관 실패: ' + r.stderr);
  assert.match(String(r.stdout), /함께 실린다/, '남의 미커밋을 조용히 실었다');
  assert.match(String(r.stdout), /세션보드_아카이브\.md/, '무엇이 실렸는지 이름을 안 댔다');
});

test('[F102] 저장소 밖이면 「커밋 안 했다」를 **드러낸다** (통과와 미실행이 같은 모양이면 안 된다)', () => {
  const fx = mkFixture();                       // git 저장소가 아닌 임시폴더
  const r = run(fx, ['옮길 트랙 갑']);
  assert.equal(r.status, 0);
  assert.match(String(r.stdout), /커밋은 안 했다/, '커밋을 건너뛰고도 조용했다');
});
