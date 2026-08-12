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
 *   ⑥ **줄 주인이 살아 있으면 옮기지 않는다**(마찰 F146, 2026-08-07 실사고).
 *      ①~⑤는 전부 「옮기는 행위가 줄을 잃지 않는가」였다. ⑥은 앞의 질문이다 —
 *      **지금 옮겨도 되는 줄인가.** 「✅종결」은 **그 세션이 끝났다는 뜻이 아니다**:
 *      종결로 적힌 줄을 보드 정리로 옮겼는데 그 트랙 파일 3건을 **0분 전에 편집 중인**
 *      세션이 있었다(되돌림 revert 2건). 줄을 잃은 세션은 다음 턴에 자기 트랙을 못 찾고
 *      「트랙 없음」으로 접힌다(F144) — 아카이브에 멀쩡히 있어도 인계문은 보드만 본다.
 *      판정 재료는 줄에 적힌 **커밋 해시**뿐이다 — 「만지는 파일」 칸은 산문이라 못 믿는다.
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
const 보드id = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'board-id.js'));

/* `SYNK_BOARD_ROOT` 는 `tools/board.js` 와 **같은 이름의 이음매**다 — 후보 찾기(아래 BOARD)를
 * 픽스처에서 재려면 이게 필요하다. `SYNK_BOARD` 는 파일을 곧장 주므로 후보 찾기를 건너뛴다:
 * 그 손잡이로만 시험하면 정작 「유령을 후보로 보는가」가 회귀에서 도달 불가가 된다. */
const ROOT = process.env.SYNK_BOARD_ROOT || path.resolve(__dirname, '..');
const ARCHIVE = process.env.SYNK_BOARD_ARCHIVE || path.join(ROOT, 'docs', '세션보드_아카이브.md');
const 보드lib = require(path.join(__dirname, 'lib', '보드.js'));
// 표 칸 가르기는 이 한 통로만 쓴다 — 날 `split('|')` 은 백틱 안 파이프에서 칸을 밀어낸다(F119).
const 표 = require(path.join(__dirname, 'lib', '표.js'));

/** 줄끝을 실측한다 — 섞여 있으면 많은 쪽을 따른다(앵커를 손으로 쓰지 않는 이유). */
function eolOf(text) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/(^|[^\r])\n/g) || []).length;
  return crlf >= lf && crlf > 0 ? '\r\n' : '\n';
}
/* 「표 줄인가」는 `tools/lib/보드.js` 하나에서 온다 — 여기 다시 적었던 판이 조립기와 갈려
 * 유령 줄(규격 밖이라 표에 안 뜨는 줄)을 낳았다(F322·F330·F331 · 사연은 그 파일 머리말). */
const isRow = 보드lib.표줄;
const rowsIn = (text) => text.split(/\r?\n/).filter(isRow);
/* 종료 코드는 **계약**이다: 0 옮겼다 · 1 못 옮겼다 · 6 원칙⑥(줄 주인이 아직 살아 있다).
 * 6 을 따로 판 이유(F278 · 2026-08-09): board-guard 가 「이 처방이 실제로 도는가」를 `--dry` 로
 * 물어보는데, 1 하나로는 **「board-move 가 거절했다」와 「board-move 가 아예 못 돌았다」**(아카이브
 * 없음·저장소 아님·경로 어긋남)를 못 가른다. 못 가르면 환경 고장이 「옮길 게 없다」로 읽혀
 * 상한이 조용히 풀린다 — 새는 방향이다. 글자(stderr 문구)로 가르지 않는 이유는 그게 곧
 * 두 번째 정의라서다(문구를 다듬는 순간 판정이 갈라진다). */
const die = (msg, code) => { console.error('[board-move] ' + msg); process.exit(code || 1); };

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const needle = args.filter((a) => a !== '--dry').join(' ').trim();
if (!needle) die('옮길 줄을 식별할 문구를 달라. 예: node tools/board-move.js "채번 락"');

/* 보드 정본은 `docs/_ops/보드/<지문>.md` 의 세션별 파일이다(F250) — 옮길 줄이 **어느 파일**에
 * 있는지부터 가른다. 아래 원칙 ①~⑥(줄끝 실측·아카이브 먼저·산주인 검사·깨끗할 때만 커밋)은
 * 그 파일 하나를 대상으로 그대로 돈다 — 파일이 좁아진 만큼 남의 줄을 건드릴 길이 사라졌다.
 * `SYNK_BOARD` 는 테스트 격리 이음매라 그대로 둔다(주면 그 파일 하나만 본다). */
const BOARD = process.env.SYNK_BOARD || (() => {
  /* 🔑 **유령 줄도 후보에 넣는다** (F322·F330·F331 · 2026-08-12). 옛 판은 `줄들`(엄격)만 봤고,
   * 그래서 규격 밖 줄은 이 도구가 **원리상 못 치웠다** — 그런데 그 줄이야말로 치워야 하는 것이다:
   * 표에 안 뜨니 주인 말고는 아무도 모르고, 주인이 죽으면 영원히 남는다. board-guard 가 만석일 때
   * 내미는 처방이 이 명령이라, 여기서 못 찾으면 처방이 못 따를 처방이 된다(F103).
   * 실측: `fe43f4b4.md:5`(✅종결·주인 사망)이 그 상태로 남아 있었다. */
  const 후보 = [...(보드lib.줄들(ROOT) || []), ...(보드lib.유령들(ROOT) || [])]
    .filter((r) => r.줄.includes(needle));
  if (!후보.length) die(`보드에서 "${needle}" 가 든 줄을 못 찾았다.`);
  const 파일들 = [...new Set(후보.map((r) => r.파일))];
  if (파일들.length > 1) {
    die(`"${needle}" 가 세션 파일 ${파일들.length}개에 걸린다 — 더 구체적인 문구를 달라:\n  ` + 파일들.join('\n  '));
  }
  return path.join(보드lib.폴더(ROOT), 파일들[0]);
})();

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
/* 🔴 F226 — **앞선 실행이 남긴 잔재를 다시 삽입하지 않는다.**
 * ①이 아카이브를 쓴 뒤 ②(단독 커밋)가 남의 `.git/index.lock` 에 막혀 죽으면 삽입만 된 채 남는다.
 * 그 상태로 재실행하면 아래 「행 수 +1」 검증은 **중복도 통과시킨다**(같은 줄이 두 번 실린다). */
const 이미있음 = archiveLines.some((l) => l.trim() === row.trim());
const newArchiveLines = archiveLines.slice();
if (!이미있음) newArchiveLines.splice(insertAt, 0, row);
const newArchive = newArchiveLines.join(archiveEol);

// ── 쓰기 전 검증 — 하나라도 어긋나면 아무것도 쓰지 않는다 ──────────
const problems = [];
if (!newArchive.includes(row)) problems.push('새 아카이브에 그 줄이 없다(삽입 실패 — F046이 바로 이것)');
if (newBoard.includes(row)) problems.push('새 보드에 그 줄이 남아 있다(삭제 실패)');
if (rowsIn(newArchive).length !== rowsIn(archiveText).length + (이미있음 ? 0 : 1)) {
  problems.push(`아카이브 행 수가 ${이미있음 ? '그대로가' : '+1이'} 아니다`);
}
if (rowsIn(newBoard).length !== rowsIn(boardText).length - 1) problems.push('보드 행 수가 -1이 아니다');
if (problems.length) die('검증 실패 — 아무것도 쓰지 않았다:\n- ' + problems.join('\n- '));

console.log(`  옮길 줄: ${row.slice(0, 90)}${row.length > 90 ? '…' : ''}`);
/* 유령을 치울 때는 **유령이었다고 말한다** — 조용히 옮기면 「보드에 있던 줄을 옮겼다」로 읽히고,
 * 규격 밖이었다는 사실(=다음 세션이 같은 모양을 베낄 위험)이 아무 데도 안 남는다.
 * 원문 그대로 옮긴다 — 아카이브는 역사라, 여기서 모양을 고치면 옛 기록을 개서하는 것이다. */
const 옮길유령사유 = 보드lib.유령사유(row);
if (옮길유령사유.length) {
  console.log('  ⚠ 이 줄은 **유령**이었다 — 표에는 안 뜨는데 파일엔 있던 줄이다(F322·F330·F331):');
  옮길유령사유.forEach((s) => console.log(`      ↳ ${s}`));
  console.log('    아카이브에는 **원문 그대로** 넣는다(역사를 개서하지 않는다).');
}
if (이미있음) console.log('  ↻ 아카이브에 그 줄이 **이미 있다**(앞선 실행의 잔재) — 다시 삽입하지 않는다(F226).');
console.log(`  보드 ${JSON.stringify(boardEol)} · 아카이브 ${JSON.stringify(archiveEol)} (실측)`);

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

/* ── ⛔ 줄 주인이 살아 있으면 아무것도 하지 않는다 (원칙 ⑥ · F146) ──────
 * 「살아있음」 판정은 **작업본소유자에서 그대로 가져온다** — 여기 다시 적으면 두 도구가
 * 서로 다른 생사를 보게 되고, 갈라진 쪽의 증상은 언제나 「통과」다(F111 이 같은 이유로 그 함수를 쓴다).
 * `--dry` 도 여기를 지난다 — 계획만 볼 때야말로 「옮겨도 되나」의 답이 필요하다.
 *
 * 🔴 재료가 **셋**이고 성질이 다르다 (F165 · F242 · F246). 여기서 새는 방향은 언제나
 *   「통과=남의 줄을 옮김」이므로, 인계문과 달리 **의심되면 멈춘다.** 다만 반대로 틀리면
 *   내 종결 줄이 영원히 안 옮겨져 보드 상한을 먹으므로, 재료를 늘리기 전에 **오염부터 뺀다.**
 *
 *   ① **파일 이름** (F246 · F250 이후). 보드 정본이 세션별 파일이 된 뒤로 「누가 이 줄을
 *      썼나」는 추론할 필요가 없다 — `docs/_ops/보드/<지문>.md` 의 이름이 곧 주인이다.
 *      셋 중 유일하게 **정확**하고, 커밋이 하나도 없는 트랙에도 있다.
 *      🔑 **그래서 ① 이 나를 가리키면 ②③ 은 아예 안 본다**(F288). 좌표가 이미 답을 냈는데
 *         추론을 덧대면 추론만 틀릴 수 있다 — 아래 「좌표가 추론을 이긴다」 절.
 *   ② **줄에 적힌 지문**(`local_302d8acd` · F165). 해시가 없는 트랙(양보·조사·판정안)의
 *      유일한 재료였다. 실측 2026-08-08: 보드·아카이브 333행 중 지문이 **상태 칸 밖에만**
 *      있는 행은 0 이라, 줄 전체를 봐도 오염이 없다 — 그대로 둔다.
 *   ③ **상태 칸의 커밋 해시**(F146·F242) — 줄 전체가 아니라 **상태 칸만** 본다(F246).
 *      줄 전체를 긁으면 원인 설명에 배경으로 인용한 남의 커밋까지 주인으로 센다. 실측:
 *      재료 있는 203행 중 **18행**이 그 형태였고, 처방이 「그 세션이 끝난 뒤 다시 돌려라」라
 *      내 세션에선 실행할 수 없다(F103 축). 작업 커밋이 적히는 자리는 규약상 상태 칸이다.
 *      ⚠ 좁히기는 **미탐 방향**이라 ① 이 그 자리를 메운다 — 옛 단일 파일 시절 행 4개는
 *        작업 해시를 「만지는 파일」 칸에 적었는데, 세션별 파일에서는 이름이 그걸 대신한다. */
const 산주인 = (() => {
  if (!inRepo) return [];                                    // 저장소 밖 픽스처엔 커밋도 세션도 없다
  // 칸을 못 가르면(형식이 바뀌면) 옛 재료인 줄 전체로 떨어진다 — 폴백은 언제나 더 많이 보는 쪽.
  const 상태칸 = 표.칸나누기(row)[3] || row;
  const 해시들 = [...new Set(상태칸.match(/\b[0-9a-f]{7,40}\b/g) || [])];
  const 지문들 = 보드id.줄의지문(row);
  // `유물-` 은 수거된 세션 파일의 접두다(그 세션이 살아 있으면 여전히 그 세션 줄이다 · F252 축).
  const 파일지문 = (/^(?:유물-)?([0-9a-f]{8})$/i.exec(path.basename(BOARD, '.md')) || [])[1];
  if (!해시들.length && !지문들.length && !파일지문) return [];
  let owner; let store;
  try {
    owner = require('./작업본소유자.js');
    store = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));
  } catch (e) {
    /* 「검사를 못 했다」와 「통과했다」가 같은 모양이면 안 된다 — 조용히 넘기지 않고 말한다. */
    console.error(`  ⚠ 주인 생사 검사를 **못 했다**(${e.code || e.message}) — 원칙 ⑥이 이번엔 안 돌았다.`);
    return [];
  }
  const 나 = store.safeId(process.env.CLAUDE_CODE_HOST_SESSION_ID || '');
  const 산 = new Map(owner.세션들(root).filter(owner.살았나).map((s) => [s.sid, s]));
  if (!산.size) return [];
  /* 🔑 **좌표가 추론을 이긴다** (F288 · 2026-08-09). 보드 정본이 세션별 파일인 이상
   *   `보드/<내 지문>.md` 안의 줄은 **정의상 내 줄이다** — 남의 트랙은 거기 살 수 없다
   *   (`board-guard` 가 「내 파일에만 쓴다」를 기계로 막는다). 그러므로 이 파일의 상태 칸에
   *   적힌 남의 해시·지문은 소유 근거가 아니라 **인용**이고, ②③ 은 여기서 잴 것이 없다.
   *
   * ■ 무엇이 실제로 벌어졌나 — 세션 규약은 그 인용을 **시킨다**(「조율 사실을 커밋 메시지나
   *   보드에 1줄 남긴다」). 규약대로 남의 적색 커밋을 상태 칸에 적었더니 원칙 ⑥ 이 내 완료
   *   줄을 가뒀고(exit 6 · 「이 줄을 쓴 세션이 아직 살아 있다」), 처방은 「그 세션이 끝난 뒤
   *   다시 돌려라」라 내 세션에선 실행할 수 없다. 막힌 사람에게 남는 출구는 **근거를 지우는
   *   것**뿐이라 정보가 깎인다 — F103 그 모양이다(실제로 그렇게 우회했다).
   *   조건을 하나씩 바꿔 대조하니 물린 것은 **커밋 해시**였다: 해시만 지우자 통과했고,
   *   같은 줄에 남아 있던 지문 문자열은 영향이 0이었다.
   *
   * 🚫 **재제안 금지 — 「주인 표식에서 커밋 해시를 통째로 뺀다」**(F177·F242 가 각각 반박했다).
   *   옛 단일 보드(`세션보드.md`)와 형제 저장소 트랙은 그 재료로 산다. 여기서 끄는 것은
   *   **좌표가 이미 답을 준 파일 안에서만**이고, 좌표가 없는 줄은 ②③ 이 그대로 지킨다.
   * ⚠ **빈 id 가 「전부 내 파일」이 되면 안 된다.** 실측 2026-08-09 — 그것을 실제로 막는 것은
   *   아래 `내지문 &&` 가 **아니라** `safeId('')` = `'unknown'` 이다: 그 폴백은 hex 가 아니라,
   *   hex 8자리만 뽑는 `파일지문` 과 **원리적으로** 같아질 수 없다. 그래서 `내지문 &&` 는 지금
   *   도달 불가능한 벨트다 — 폴백이 언젠가 `''` 나 hex 로 바뀌면 그때 일한다. 그 전제
   *   (폴백 ≠ hex8)를 회귀가 직접 못박는다(`tests/보드이관.test.js` F288 셋째).
   *   🔴 여기 「빈 id 는 내지문이 falsy 라 안전하다」고 적으면 **거짓 근거**가 정본이 된다 —
   *      변이 M3(`|| !내지문`)이 회귀를 하나도 안 빨갛게 만든 것이 그 증거다. */
  const 내지문 = 보드id.지문(나);
  if (내지문 && 파일지문 === 내지문) return [];
  /* 🔴 해시는 **형제 저장소에서도** 찾는다 (F242 · 2026-08-08). 이 저장소에서만 `rev-parse` 하면
   *   talk 커밋 해시가 「해시처럼 생긴 딴 것」과 **같은 모양**(status!==0)이라 조용히 버려진다.
   *   이 프로젝트는 트랙 절반이 talk 작업이라 그 사각은 예외가 아니라 상시다 — 실측 2026-08-08:
   *   보드 「게임 4모듈」 줄은 지문 0 + 해시 전부 talk 이라 산주인 0 이었는데 주인은 25분 전 박동.
   *   F165 가 메운 사각(해시가 아예 없는 줄)의 옆 칸이고, 새는 방향은 여기서도 「통과」다.
   *   목록은 handoff-store 하나에서 파생시킨다(여기 좌표를 다시 적으면 갈라진다). */
  const 저장소들 = [{ 뿌리: root, 저장소: null }, ...store.siblings(root)];
  const 걸린것 = new Map();
  for (const h of 해시들) {
    for (const { 뿌리, 저장소 } of 저장소들) {
      if (git(['rev-parse', '--verify', '--quiet', `${h}^{commit}`], 뿌리).status !== 0) continue;  // 여기 것이 아니다
      const sid = ((git(['log', '-1', '--format=%(trailers:key=Session-Id,valueonly)', h], 뿌리).stdout || '')
        .trim().split(/\r?\n/)[0] || '').trim();
      /* 내 줄은 내가 옮긴다(/close 의 정상 경로) · 트레일러가 없으면 남이라고 단정하지 않는다. */
      if (sid && sid !== 나 && 산.has(sid) && !걸린것.has(sid)) {
        걸린것.set(sid, `${h}${저장소 ? `(${저장소})` : ''} ← ${owner.짧게(sid)}·${산.get(sid).분}분 전`);
      }
      break;                                                  // 이 저장소가 그 해시를 안다 — 더 뒤질 필요 없다
    }
  }
  /* 줄이 스스로 말하는 지문 — 커밋이 아직 하나도 없는 세션의 유일한 재료다. */
  const 산지문 = new Map([...산.values()].map((s) => [보드id.지문(s.sid), s]));
  /* ① 파일 이름 = 주인 (F246). 추론이 아니라 좌표라, 위 둘이 전부 비어도 답이 있다. */
  const 파일주인 = 파일지문 && 산지문.get(파일지문);
  if (파일주인 && 파일지문 !== 보드id.지문(나) && !걸린것.has(파일주인.sid)) {
    걸린것.set(파일주인.sid,
      `이 줄이 사는 파일 \`${path.basename(BOARD)}\` ← ${owner.짧게(파일주인.sid)}·${파일주인.분}분 전`);
  }
  for (const f of 지문들) {
    const s = 산지문.get(f);
    if (!s || 보드id.지문(s.sid) === 보드id.지문(나) || 걸린것.has(s.sid)) continue;
    걸린것.set(s.sid, `줄에 적힌 지문 \`${f}\` ← ${owner.짧게(s.sid)}·${s.분}분 전`);
  }
  return [...걸린것.values()];
})();
if (산주인.length) {
  die('이 줄을 쓴 세션이 **아직 살아 있다**(원칙 ⑥ · F146) — 옮기면 그 세션이 다음 턴에 자기 트랙을 잃는다.\n' +
    '  **아무것도 쓰지 않았다** — 줄은 보드에 그대로다.\n' +
    산주인.map((t) => '  · ' + t).join('\n') + '\n' +
    '  「✅종결」은 그 세션이 끝났다는 뜻이 아니다. 그 세션이 끝난 뒤 다시 돌려라.\n' +
    '  내 줄인데 막혔다면 환경변수 CLAUDE_CODE_HOST_SESSION_ID 가 비었는지 본다(비면 내 커밋도 남의 것으로 보인다).',
    6);
}

if (dry) { console.log('[board-move] --dry — 쓰지 않았다.'); process.exit(0); }

/* 이관 **전부터** 더러웠는지 잰다. 쓴 뒤에 재면 내가 만든 더러움과 구분되지 않는다. */
const archiveDirty = inRepo ? dirtyOf(ARCHIVE) : '';
const boardDirty = inRepo ? dirtyOf(BOARD) : '';

/* ⛔ 아카이브에 남의 미커밋이 있으면 **아무것도 쓰지 않고** 멈춘다.
 * 여기서 커밋하면 남의 삽입을 함께 실어간다(F073 역방향). 안 쓰고 멈추면 줄은 보드에 그대로라 안전하다.
 *
 * 🔴 단 **내 앞선 실행의 잔재는 예외다**(F226 · F103 축). ①이 쓴 뒤 ②(단독 커밋)가 남의
 * `.git/index.lock` 에 막혀 죽으면 삽입만 된 채 미커밋으로 남는데, 이 검사가 그것을 「남의 것」으로
 * 읽어 **이후 모든 재실행이 거부**됐다 — 즉 만석 처방(board-guard 가 내주는 이 명령)이 첫 실패 한 번에
 * 통째로 죽는다. 이 저장소는 세션 9~15개가 동시에 도는 게 일상이라 lock 경합은 예외가 아니다.
 * 가르는 재료는 HEAD 대비 차분이다 — **추가가 옮기려던 그 줄 하나, 삭제 0**(남의 삽입이면 딴 줄이 뜬다). */
const 내잔재뿐 = () => {
  const r = git(['show', `HEAD:${rel(ARCHIVE)}`], root);
  if (r.status !== 0) return false;
  const 빼기 = (a, b) => {
    const m = new Map();
    for (const l of b) m.set(l, (m.get(l) || 0) + 1);
    return a.filter((l) => { const n = m.get(l) || 0; return n ? (m.set(l, n - 1), false) : true; });
  };
  const 있던것 = r.stdout.split(/\r?\n/).map((l) => l.trim());
  const 지금것 = archiveText.split(/\r?\n/).map((l) => l.trim());
  const 더해진것 = 빼기(지금것, 있던것);
  return 빼기(있던것, 지금것).length === 0 && 더해진것.length === 1 && 더해진것[0] === row.trim();
};
if (archiveDirty && !내잔재뿐()) {
  die('아카이브에 이관 전부터 **남의** 미커밋이 있다 — 내 커밋이 그것을 실어가므로 **아무것도 쓰지 않았다**:\n' +
    '  ' + archiveDirty.split(/\r?\n/).join('\n  ') + '\n' +
    '  그 세션이 커밋한 뒤 다시 돌려라(줄은 보드에 그대로 있어 잃을 게 없다).');
}
if (archiveDirty) console.log('  ↻ 그 미커밋은 **내 앞선 실행의 잔재**다(추가 1줄·삭제 0) — 이어서 커밋한다(F226).');

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
