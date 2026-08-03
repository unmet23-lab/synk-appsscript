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
 *
 * 사용:
 *   node tools/board-move.js "friction.js 채번 락"     # 그 문구가 든 줄 1개를 이관
 *   node tools/board-move.js "..." --dry               # 계획만 보고 쓰지 않는다
 */
'use strict';
const fs = require('fs');
const path = require('path');

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

/* 아카이브 **먼저** — 그리고 다시 읽어 확인한 뒤에야 보드에서 지운다.
 * 여기서 죽으면 양쪽에 다 있는 상태(중복=보이고 무해)로 남는다. 반대 순서는 유실이다. */
fs.writeFileSync(ARCHIVE, newArchive, 'utf8');
if (!fs.readFileSync(ARCHIVE, 'utf8').includes(row)) {
  die('아카이브에 쓴 뒤 다시 읽었는데 그 줄이 없다 — 보드는 건드리지 않았다(줄은 안전하다).');
}
fs.writeFileSync(BOARD, newBoard, 'utf8');
console.log('[board-move] 완료 — 아카이브 확인 후 보드에서 제거했다. git status에 2파일이 떠야 정상.');
