#!/usr/bin/env node
/* board-move — 세션보드의 완료 줄을 아카이브로 **잃지 않고** 옮긴다.
 *
 * 왜 있나 (마찰 F046, 2026-08-04 실사고):
 *   손으로 짠 이관 스크립트가 한 번에 두 일을 했다 — ⓐ보드에서 줄 삭제(splice)
 *   ⓑ아카이브에 삽입(`replace('\n---\n', …)`). 그런데 아카이브가 **CRLF**라 앵커
 *   `\n---\n`가 실제 텍스트 `\r\n---\r\n`과 안 맞아 **ⓑ가 조용히 no-op**됐고,
 *   ⓐ만 성공해 줄이 통째로 사라졌다. 발각 단서는 `git status`에 아카이브가
 *   **안 뜬 것** 하나뿐이었다(성공했다면 2파일이 떠야 한다).
 *
 *   ⚠ 이 실패는 **훅으로 못 막는다.** 도구가 Edit이 아니라 Bash+fs.writeFileSync라
 *   PreToolUse(board-guard 계열)가 애초에 발화하지 않는다. 그래서 「막는 가드」가 아니라
 *   **잘못 쓸 수 없는 공용 통로**로 옮긴다(CLAUDE.md 신뢰성 「3번째」 조항).
 *
 * 설계 원칙 3:
 *   ① **줄끝은 실측한다** — 파일마다 따로. 앵커 문자열을 손으로 쓰지 않는다.
 *   ② **쓰기 전에 메모리에서 검증한다** — 옮길 줄이 새 아카이브에 있고 새 보드에 없으며,
 *      행 수가 각각 ±1인지. 하나라도 어긋나면 **아무것도 쓰지 않는다.**
 *   ③ **아카이브를 먼저 쓰고, 다시 읽어 확인한 뒤에 보드에서 지운다.**
 *      순서가 핵심이다 — 중간에 죽으면 결과는 「양쪽에 다 있음」(눈에 보이고 무해)이지
 *      「어디에도 없음」(조용하고 영구)이 아니다. 유실 대신 중복으로 실패하게 만든다.
 *   ④ **쓰고 나서 스스로 커밋한다**(마찰 F102, 2026-08-05 실사고).
 *      ③의 「유실 대신 중복」 보장은 **단일 세션 전제**였다. 두 파일을 미커밋으로 두면
 *      보드 삭제는 **남의 커밋에 실려 나가고**(F073 형태) 아카이브 추가는 내 미커밋에만
 *      남아, 옮긴 줄이 **커밋된 어느 파일에도 없는** 창이 열린다 — 파일시스템은 중복인데
 *      git 은 유실이다. 커밋을 호출자에게 맡기면 잊는 자리라(그게 F102 였다) 통로에 묶는다.
 *
 * 사용:
 *   node tools/board-move.js "friction.js 채번 락"     # 이관 + 두 파일 즉시 커밋
 *   node tools/board-move.js "..." --dry               # 계획만 보고 쓰지 않는다
 *
 *   ⛔ `--no-commit` 같은 탈출구는 두지 않는다 — 그 구멍이 F102 자체다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BOARD = process.env.SYNK_BOARD || path.join(ROOT, 'docs', '세션보드.md');
const ARCHIVE = process.env.SYNK_BOARD_ARCHIVE || path.join(ROOT, 'docs', '세션보드_아카이브.md');

/** 줄끝을 실측한다 — 섞여 있으면 많은 쪽을 따른다(앵커를 손으로 쓰지 않는 이유). */
function eolOf(text) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/(^|[^\r])\n/g) || []).length;
  return crlf >= lf && crlf > 0 ? '\r\n' : '\n';
}
const isRow = (line) => /^\s*\|/.test(line) && !/^\s*\|\s*-+/.test(line) && !/^\s*\|\s*날짜\s*\|/.test(line);
const rowsIn = (text) => text.split(/\r?\n/).filter(isRow);
const die = (msg) => { console.error('[board-move] ' + msg); process.exit(1); };

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const needle = args.filter((a) => a !== '--dry').join(' ').trim();
if (!needle) die('옮길 줄을 식별할 문구를 달라. 예: node tools/board-move.js "채번 락"');

const boardText = fs.readFileSync(BOARD, 'utf8');
const archiveText = fs.readFileSync(ARCHIVE, 'utf8');
const boardEol = eolOf(boardText);
const archiveEol = eolOf(archiveText);

const boardLines = boardText.split(/\r?\n/);
const hits = boardLines.map((l, i) => ({ l, i })).filter((x) => isRow(x.l) && x.l.includes(needle));
if (!hits.length) die(`보드에서 "${needle}" 가 든 줄을 못 찾았다.`);
if (hits.length > 1) die(`"${needle}" 가 ${hits.length}줄에 걸린다 — 더 구체적인 문구를 달라:\n  ` +
  hits.map((h) => h.l.slice(0, 80)).join('\n  '));

const row = hits[0].l.replace(/\s+$/, '');

// ── 새 내용을 메모리에서 만든다 ────────────────────────────────────
const newBoard = boardLines.filter((_, i) => i !== hits[0].i).join(boardEol);

// 삽입 자리 = 첫 `---` 구분선 **다음**(아카이브 맨 위). 앵커는 실측한 줄끝으로 조립한다.
const archiveLines = archiveText.split(/\r?\n/);
const sep = archiveLines.findIndex((l) => /^\s*---\s*$/.test(l));
if (sep === -1) die('아카이브에서 `---` 구분선을 못 찾았다 — 구조가 바뀌었으면 이 도구를 먼저 고쳐라.');
const insertAt = archiveLines[sep + 1] === '' ? sep + 2 : sep + 1;
const newArchiveLines = archiveLines.slice();
newArchiveLines.splice(insertAt, 0, row);
const newArchive = newArchiveLines.join(archiveEol);

// ── 쓰기 전 검증 — 하나라도 어긋나면 아무것도 쓰지 않는다 ──────────
const problems = [];
if (!newArchive.includes(row)) problems.push('새 아카이브에 그 줄이 없다(삽입 실패 — F046이 바로 이것)');
if (newBoard.includes(row)) problems.push('새 보드에 그 줄이 남아 있다(삭제 실패)');
if (rowsIn(newArchive).length !== rowsIn(archiveText).length + 1) problems.push('아카이브 행 수가 +1이 아니다');
if (rowsIn(newBoard).length !== rowsIn(boardText).length - 1) problems.push('보드 행 수가 -1이 아니다');
if (problems.length) die('검증 실패 — 아무것도 쓰지 않았다:\n- ' + problems.join('\n- '));

console.log(`  옮길 줄: ${row.slice(0, 90)}${row.length > 90 ? '…' : ''}`);
console.log(`  보드 ${JSON.stringify(boardEol)} · 아카이브 ${JSON.stringify(archiveEol)} (실측)`);
if (dry) { console.log('[board-move] --dry — 쓰지 않았다.'); process.exit(0); }

/* ── git 자리를 **쓰기 전에** 잰다 ────────────────────────────────
 * 쓴 뒤에 재면 「내가 만든 더러움」과 「원래 있던 남의 미커밋」이 구분되지 않는다. */
/* ⚠ `core.quotePath=false` 없으면 git 이 한글 경로를 8진 이스케이프(`"\354\204\270…"`)로 뱉는다.
 * 이 저장소는 경로가 전부 한글이라, 빼면 아래 경고가 **읽을 수 없는 채로** 뜬다(F045 계열: 재는 층이 값을 깨뜨린다). */
const git = (args, cwd) => spawnSync('git', ['-c', 'core.quotePath=false', ...args], { cwd, encoding: 'utf8' });
const topOf = (p) => { const r = git(['rev-parse', '--show-toplevel'], path.dirname(p)); return r.status === 0 ? r.stdout.trim() : null; };
const root = topOf(BOARD);
const inRepo = !!root && root === topOf(ARCHIVE);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const statusOf = () => (git(['status', '--porcelain', '--', rel(BOARD), rel(ARCHIVE)], root).stdout || '').trim();
/* 이관 전부터 더러웠다면 내 커밋이 **남의 미커밋까지** 싣는다(F073). 조용히 싣지 않고 드러낸다. */
const dirtyBefore = inRepo ? statusOf().split(/\r?\n/).filter(Boolean) : [];

/* 아카이브 **먼저** — 그리고 다시 읽어 확인한 뒤에야 보드에서 지운다.
 * 여기서 죽으면 양쪽에 다 있는 상태(중복=보이고 무해)로 남는다. 반대 순서는 유실이다. */
fs.writeFileSync(ARCHIVE, newArchive, 'utf8');
if (!fs.readFileSync(ARCHIVE, 'utf8').includes(row)) {
  die('아카이브에 쓴 뒤 다시 읽었는데 그 줄이 없다 — 보드는 건드리지 않았다(줄은 안전하다).');
}
fs.writeFileSync(BOARD, newBoard, 'utf8');

/* ── 그리고 **바로 커밋한다**(F102) ──────────────────────────────
 * 여기서 손을 떼면 파일시스템은 「양쪽에 다 있음」인데 git 은 「어디에도 없음」이 될 수 있다. */
if (!inRepo) {
  console.log('[board-move] 완료(파일) · ⚠ git 저장소 밖이라 **커밋은 안 했다** — 픽스처가 아니라면 지금 직접 커밋해라(F102).');
  process.exit(0);
}
const track = (row.match(/\*\*(.+?)\*\*/) || [null, needle])[1];
if (dirtyBefore.length) {
  console.log('[board-move] ⚠ 이관 전부터 미커밋이던 것이 이 커밋에 함께 실린다 — 남의 것일 수 있다(F073):');
  dirtyBefore.forEach((l) => console.log('    ' + l));
}
const msg = [
  `docs: 보드 — 「${track}」 완료 줄 아카이브로 이관`, '',
  'board-move 자동 커밋(F102) — 두 파일을 미커밋으로 두면 보드 삭제만 남의 커밋에',
  '실려 나가고 아카이브 추가는 내 미커밋에 남아, 옮긴 줄이 커밋된 어느 파일에도 없는',
  '창이 열린다. 쓰기와 커밋을 한 통로로 묶어 호출자가 잊을 수 없게 한다.',
].concat(dirtyBefore.length
  ? ['', '⚠ 아래는 이관 전부터 미커밋이라 함께 실렸다:', ...dirtyBefore.map((l) => '  ' + l)]
  : []).join('\n');
const c = git(['commit', '-m', msg, '--', rel(BOARD), rel(ARCHIVE)], root);
/* 커밋했다고 믿지 말고 결과를 본다 — 동시 세션에선 조용한 no-op 이 난다(F071). */
const left = statusOf();
if (left) {
  die('두 파일을 커밋하지 못했다 — **지금 직접 커밋해라**(이 상태로 세션이 끝나면 옮긴 줄이 사라진다 · F102):\n' +
    `  git commit -m "docs: 보드 이관" -- "${rel(BOARD)}" "${rel(ARCHIVE)}"\n` +
    '  남은 것: ' + left.split(/\r?\n/).join(' / ') + '\n' +
    '  git: ' + ((c.stderr || '') + (c.stdout || '')).trim().split(/\r?\n/).slice(0, 4).join(' / '));
}
console.log('[board-move] 완료 — 아카이브 확인 → 보드에서 제거 → **두 파일 커밋**까지 끝냈다(F102).');
