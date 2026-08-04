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
 *   ④ **③을 파일 층에서 git 층으로 올린다**(마찰 F102, 2026-08-05 실사고).
 *      ③의 「유실 대신 중복」 보장은 **단일 세션 전제**였다. 이 저장소의 보장 경계는
 *      파일시스템이 아니라 **커밋**이라, 두 파일이 미커밋이면 보드 삭제만 **남의 커밋에
 *      실려 나가고**(F073) 아카이브 추가는 내 미커밋에 남아 — 파일시스템은 중복인데
 *      git 은 유실이다. 그래서 순서를 이렇게 못박는다:
 *        아카이브 쓰기 → **아카이브만 단독 커밋** → 확인 → 그 **뒤에야** 보드에서 지운다.
 *      보드 삭제를 작업본에 쓰는 것 자체가 위험한 행위다(그 순간부터 남이 실어갈 수 있다).
 *   ⑤ **보드는 깨끗할 때만 커밋한다.** `세션보드.md` 는 상시 여러 세션이 더럽히고
 *      (실측 08-05 01:04: 한 순간에 6개 세션) 자동 커밋이 곧 **남의 선언 수거**가 된다.
 *      안 해도 안전하다 — 아카이브가 이미 커밋됐으니 최악은 눈에 보이는 중복이다.
 *      아카이브가 더러우면 아예 **아무것도 쓰지 않고** 멈춘다(줄은 보드에 그대로).
 *
 * 사용:
 *   node tools/board-move.js "friction.js 채번 락"     # 이관 + 커밋(아카이브 먼저)
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
const dirtyOf = (p) => (git(['status', '--porcelain', '--', rel(p)], root).stdout || '').trim();
/** 「커밋됐나」는 작업본이 아니라 **커밋된 내용**으로 판정한다(F071: 조용한 no-op 이 난다). */
const headHas = (p, s) => { const r = git(['show', `HEAD:${rel(p)}`], root); return r.status === 0 && r.stdout.includes(s); };
const track = (row.match(/\*\*(.+?)\*\*/) || [null, needle])[1];
const commit = (p, subject, body) => git(['commit', '-m', `${subject}\n\n${body}`, '--', rel(p)], root);

/* 이관 **전부터** 더러웠는지 잰다. 쓴 뒤에 재면 내가 만든 더러움과 구분되지 않는다. */
const archiveDirty = inRepo ? dirtyOf(ARCHIVE) : '';
const boardDirty = inRepo ? dirtyOf(BOARD) : '';

/* ⛔ 아카이브에 남의 미커밋이 있으면 **아무것도 쓰지 않고** 멈춘다.
 * 여기서 커밋하면 남의 삽입을 함께 실어간다(F073 역방향). 안 쓰고 멈추면 줄은 보드에 그대로라 안전하다. */
if (archiveDirty) {
  die('아카이브에 이관 전부터 미커밋이 있다 — 내 커밋이 남의 것을 실어가므로 **아무것도 쓰지 않았다**:\n' +
    '  ' + archiveDirty.split(/\r?\n/).join('\n  ') + '\n' +
    '  그 세션이 커밋한 뒤 다시 돌려라(줄은 보드에 그대로 있어 잃을 게 없다).');
}

/* ── ① 아카이브를 쓰고 **아카이브만 단독 커밋**한다 ────────────────
 * 순서가 곧 durability 다. 이 저장소의 보장 경계는 파일시스템이 아니라 **git 커밋**이고,
 * 보드 삭제를 작업본에 쓰는 순간 그 삭제는 **남의 커밋에 실려 나갈 수 있다**(F073).
 * 그래서 아카이브가 **커밋되기 전에는 보드를 건드리지 않는다** — 그 사이에 무슨 일이 나도
 * 최악이 「양쪽에 다 있음」(중복=보이고 무해)이지 「어디에도 없음」(조용하고 영구)이 아니다.
 * 원칙 ③(아카이브 먼저)을 파일 층에서 git 층으로 올린 것이다. */
fs.writeFileSync(ARCHIVE, newArchive, 'utf8');
if (!fs.readFileSync(ARCHIVE, 'utf8').includes(row)) {
  die('아카이브에 쓴 뒤 다시 읽었는데 그 줄이 없다 — 보드는 건드리지 않았다(줄은 안전하다).');
}

if (!inRepo) {
  fs.writeFileSync(BOARD, newBoard, 'utf8');
  console.log('[board-move] 완료(파일) · ⚠ git 저장소 밖이라 **커밋은 안 했다** — 픽스처가 아니라면 지금 직접 커밋해라(F102).');
  process.exit(0);
}

const ca = commit(ARCHIVE, `docs: 보드 아카이브 — 「${track}」 완료 줄 선기록`,
  ['board-move 자동 커밋(F102) — 보드에서 지우기 **전에** 아카이브를 먼저 못박는다.',
    '이 커밋이 있어야 보드 삭제가 남의 커밋에 실려 나가도 최악이 「중복」이지 유실이 아니다.'].join('\n'));
if (!headHas(ARCHIVE, row)) {
  die('아카이브 추가가 커밋되지 않았다 — **보드는 건드리지 않았다**(줄은 보드에 그대로라 안전하다):\n' +
    `  git commit -m "docs: 보드 아카이브 선기록" -- "${rel(ARCHIVE)}"\n` +
    '  git: ' + ((ca.stderr || '') + (ca.stdout || '')).trim().split(/\r?\n/).slice(0, 4).join(' / '));
}

/* ── ② 아카이브가 **커밋된 것을 확인한 뒤에야** 보드에서 지운다 ──── */
fs.writeFileSync(BOARD, newBoard, 'utf8');

/* 보드는 상시 여러 세션이 더럽히는 파일이다(실측 08-05 01:04: 한 순간에 6개 세션).
 * 그래서 **깨끗할 때만** 커밋한다 — 더러우면 내 커밋이 남의 선언을 통째로 수거한다.
 * 안 해도 안전하다: 아카이브가 이미 커밋됐으니 최악은 눈에 보이는 중복이다. */
if (boardDirty) {
  console.log('[board-move] 완료 — 아카이브 **선기록 커밋** 후 보드에서 제거했다.');
  console.log('  ⚠ 보드에 이관 전부터 남의 미커밋이 있어 **보드 삭제는 커밋하지 않았다**(남의 선언을 수거하지 않는다):');
  boardDirty.split(/\r?\n/).forEach((l) => console.log('    ' + l));
  console.log('  그대로 둬도 안전하다 — 아카이브가 이미 커밋돼 최악이 「중복」이다.');
  process.exit(0);
}
const cb = commit(BOARD, `docs: 보드 — 「${track}」 완료 줄 제거(아카이브 이관 완료)`,
  'board-move 자동 커밋(F102) — 아카이브 선기록이 커밋된 뒤에만 실행된다.');
const left = dirtyOf(BOARD);
if (left) {
  die('보드 삭제를 커밋하지 못했다 — 아카이브는 이미 커밋됐으니 **줄은 안전하다**(지금은 중복 상태):\n' +
    `  git commit -m "docs: 보드 이관" -- "${rel(BOARD)}"\n` +
    '  남은 것: ' + left.split(/\r?\n/).join(' / ') + '\n' +
    '  git: ' + ((cb.stderr || '') + (cb.stdout || '')).trim().split(/\r?\n/).slice(0, 4).join(' / '));
}
console.log('[board-move] 완료 — 아카이브 선기록 커밋 → 보드에서 제거 → 보드 커밋(F102).');
