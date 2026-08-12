#!/usr/bin/env node
/* 보드껍데기정리 — 줄이 하나도 안 남은 세션 보드 파일을 치운다.
 *
 * 왜 있나 (실측 2026-08-12):
 *   `board-move` 는 완료 줄을 아카이브로 옮기면서 **줄만 빼고 파일을 남겼다.** 그래서
 *   `docs/_ops/보드/` 262개 중 데이터행이 있는 건 18개뿐이고, 0바이트 189 · 표 머리글만 55 가
 *   죽은 껍데기였다(93%). 그 껍데기는 조용하지 않다 — `board-guard` 는 PreToolUse 라 **파일을
 *   쓸 때마다** 이 폴더를 통째로 훑고, 그 훑기가 244개의 빈 파일을 매번 연다. 세션 수만큼
 *   곱해지는 값이라 「그냥 남은 파일」이 아니라 조율값이다.
 *
 *   ⚠ 앞으로 생기는 것은 `board-move` 가 그 자리에서 지운다(같은 커밋). 이 도구는 **이미 쌓인
 *   것**과, 이관을 안 거치고 남은 것(선언 없이 만들어진 파일)을 위한 자리다.
 *
 * 판정은 **여기 없다** — `tools/lib/보드.js` 의 `껍데기인가` 하나에서 온다. `board-move` 도 같은
 * 것을 쓴다. 두 곳에 적으면 갈라지고, 갈라진 쪽의 증상은 「지워도 되는 줄 알았다」다(F322 축).
 *
 * 지우는 도구라 **기본은 dry** 다. 그리고 건너뛴 것을 사유와 함께 **전량** 낸다 —
 * 「몇 개를 봤고 몇 개를 건너뛰었나」를 안 내면 0건과 미실행이 같은 모양이 된다(F207).
 *
 * 사용:
 *   node tools/보드껍데기정리.js            # 무엇을 지울지 보기만 한다(기본)
 *   node tools/보드껍데기정리.js --실행     # 지우고 **한 커밋**으로 못박는다
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.SYNK_BOARD_ROOT || path.resolve(__dirname, '..');
const 보드lib = require(path.join(__dirname, 'lib', '보드.js'));
/* ⚠ `ROOT` 가 아니라 `__dirname` 기준이다 — `SYNK_BOARD_ROOT` 는 **검사 대상 폴더**를 가리키는
 * 이음매지 코드가 사는 곳이 아니다. ROOT 기준으로 부르면 픽스처(`.claude` 없는 임시 저장소)에서
 * 통째로 죽고, 그러면 회귀가 정작 「지우는가」에 도달을 못 한다(board-move 도 같은 좌표를 쓴다). */
const 보드id = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'board-id.js'));

const 실행 = process.argv.slice(2).includes('--실행');

/* ⚠ `core.quotePath=false` 없으면 git 이 한글 경로를 8진 이스케이프로 뱉는다 — 이 저장소는
 * 경로가 전부 한글이라, 빼면 아래 목록이 **읽을 수 없는 채로** 뜬다(F045: 재는 층이 값을 깨뜨린다). */
const git = (args) => spawnSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: ROOT, encoding: 'utf8' });
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

const 폴더 = 보드lib.폴더(ROOT);
let 이름들;
try { 이름들 = fs.readdirSync(폴더).filter((n) => n.endsWith('.md')).sort(); } catch (e) {
  console.error(`[껍데기정리] 보드 폴더를 못 읽었다: ${폴더} (${e.code || e.message})`);
  process.exit(1);
}

/* 🔑 세션 조회 좌표는 **git 이 말하는 최상위**다 — `ROOT`(=`SYNK_BOARD_ROOT`) 를 그대로 넘기면
 * `projectKey` 가 어긋나 세션이 **0개**로 나오고, 그 0 은 「살아있는 세션 없음」과 구별되지
 * 않는다(F079). 새는 방향이 「전부 지운다」라 조용하다 — 회귀가 이 자리를 실제로 잡았다. */
const 최상위 = (() => { const r = git(['rev-parse', '--show-toplevel']); return r.status === 0 ? r.stdout.trim() : null; })();
const 저장소인가 = !!최상위;

/* 산 주인의 파일은 건드리지 않는다 — 빈 파일이라 잃을 내용은 없지만, 그 세션이 지금 선언을
 * 쓰는 중이면 `Edit` 이 「파일이 없다」로 죽는다. 새는 방향을 「건너뛴다」로 둔다.
 * `선언살았나` 지 `살았나` 가 아닌 이유는 board-move 원칙 ⑥ 머리말과 같다(F304). */
const 산지문 = (() => {
  if (!저장소인가) return new Set();
  try {
    const owner = require('./작업본소유자.js');
    return new Set(owner.세션들(최상위).filter(owner.선언살았나)
      .map((s) => 보드id.지문(s.sid)).filter(Boolean).map((f) => f.toLowerCase()));
  } catch (e) {
    /* 「검사를 못 했다」와 「아무도 안 살았다」가 같은 모양이면 안 된다 — 못 하면 **전부 건너뛴다**. */
    console.error(`  ⚠ 주인 생사 검사를 **못 했다**(${e.code || e.message}) — 이번엔 아무것도 지우지 않는다.`);
    return null;
  }
})();

const 지울것 = [];
const 건너뛴것 = [];
for (const 이름 of 이름들) {
  const p = path.join(폴더, 이름);
  const 지문 = (/^(?:유물-)?([0-9a-f]{8})/i.exec(path.basename(이름, '.md')) || [])[1];
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { 건너뛴것.push([이름, `못 읽었다(${e.code})`]); continue; }

  if (!보드lib.껍데기인가(txt)) { 건너뛴것.push([이름, '줄이나 사람이 쓴 글이 남아 있다']); continue; }
  if (산지문 === null) { 건너뛴것.push([이름, '주인 생사 검사 불가']); continue; }
  /* 🔑 이름에서 지문을 못 읽으면 **주인을 못 가른다** → 건너뛴다. `보드id.지문` 의 익명 폴백은
   * 일부러 hex 가 아니라(F288), 그런 이름은 여기 정규식에 안 걸린다. 그 자리를 「지문 없음 =
   * 검사 통과」로 두면 산 세션의 파일이 조용히 지워진다 — 모르면 막는 쪽이 이 도구의 계약이다. */
  if (!지문) { 건너뛴것.push([이름, '파일 이름에서 지문을 못 읽었다 — 주인을 못 가른다']); continue; }
  if (산지문.has(지문.toLowerCase())) { 건너뛴것.push([이름, '주인 세션이 살아 있다']); continue; }
  if (저장소인가) {
    if (git(['ls-files', '--error-unmatch', '--', rel(p)]).status !== 0) {
      건너뛴것.push([이름, '미추적 — git 이 모르는 파일이라 안 건드린다']); continue;
    }
    if ((git(['status', '--porcelain', '--', rel(p)]).stdout || '').trim()) {
      건너뛴것.push([이름, '미커밋 변경이 있다']); continue;
    }
  }
  지울것.push(p);
}

/* 분모부터 낸다 — 「0건」과 「안 돌았다」가 같은 모양이면 안 된다(F207). */
console.log(`[껍데기정리] 보드 파일 ${이름들.length}개 · 지울 껍데기 ${지울것.length}개 · 건너뜀 ${건너뛴것.length}개`);
const 사유별 = new Map();
for (const [, 사유] of 건너뛴것) 사유별.set(사유, (사유별.get(사유) || 0) + 1);
for (const [사유, n] of [...사유별].sort((a, b) => b[1] - a[1])) console.log(`    건너뜀 ${String(n).padStart(3)}  ${사유}`);

if (!지울것.length) { console.log('  → 지울 것이 없다.'); process.exit(0); }

if (!실행) {
  console.log('  지울 파일(앞 20개):');
  지울것.slice(0, 20).forEach((p) => console.log('    · ' + rel(p)));
  if (지울것.length > 20) console.log(`    … 그리고 ${지울것.length - 20}개 더`);
  console.log('  → 보기만 했다. 실제로 지우려면: node tools/보드껍데기정리.js --실행');
  process.exit(0);
}

for (const p of 지울것) fs.unlinkSync(p);

if (!저장소인가) {
  console.log(`[껍데기정리] ${지울것.length}개 지웠다 · ⚠ git 저장소 밖이라 **커밋은 안 했다**.`);
  process.exit(0);
}

/* 경로를 못 박아 **한 커밋**으로 담는다 — `git add` 를 따로 하면 그 틈에 남의 스테이징이 얹힌다. */
const c = git(['commit', '-m',
  `docs: 보드 껍데기 ${지울것.length}개 정리 — 줄이 안 남은 세션 파일\n\n` +
  'board-move 가 완료 줄만 빼고 파일을 남겨 쌓인 것들이다(앞으로는 그쪽이 같은 커밋에서 지운다).\n' +
  'board-guard 는 PreToolUse 라 파일을 쓸 때마다 이 폴더를 통째로 훑는다 — 껍데기는 그 훑기의 값이다.',
  '--', ...지울것.map(rel)]);
const 남음 = (git(['status', '--porcelain', '--', ...지울것.map(rel)]).stdout || '').trim();
if (남음) {
  console.error(`[껍데기정리] ${지울것.length}개 지웠지만 **커밋이 안 됐다** — 파일은 이미 사라졌으니 지금 커밋해라:`);
  console.error('  git commit -m "docs: 보드 껍데기 정리" -- <위 경로들>');
  console.error('  git: ' + ((c.stderr || '') + (c.stdout || '')).trim().split(/\r?\n/).slice(0, 4).join(' / '));
  process.exit(1);
}
console.log(`[껍데기정리] 완료 — ${지울것.length}개를 **한 커밋**으로 지웠다.`);
