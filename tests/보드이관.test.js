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
