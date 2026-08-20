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
/* master 직접 커밋을 그 자리에서 미는 공용 통로 — 같은 판정을 두 곳에 적으면 갈라진다. */
const 동기 = require(path.join(__dirname, 'lib', 'master동기.js'));
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
/* 미추적 껍데기는 **건너뛰기로 끝나면 안 된다** (실측 2026-08-14: 08-10 에 생긴 0바이트 4개가
 * 나흘을 그대로 앉아 있었다 — 판정은 「껍데기」로 통과하는데 마지막 문에서만 막히니, 이 도구를
 * 부른 사람은 매번 「지울 것이 없다」만 읽고 돌아섰다).
 *   차단 자체는 옳다 — 미추적은 이력·stash·reflog 어디에도 없는 유일한 무보호 상태라 지우면
 *   비가역이다(F025). 틀린 것은 **처방이 없다**는 쪽이다: 사유만 있고 다음 손이 없으면 읽는 사람이
 *   2단 절차를 매번 새로 발명해야 하고, 발명이 필요한 처방은 아무도 안 따른다(F103 축).
 *   그래서 사유 옆에 「그대로 붙여 넣으면 통과하는」 명령을 낸다 — 그 명령을 이 가드에 되먹이면
 *   실제로 지워지는지까지 회귀가 잡는다(`tests/보드껍데기정리.test.js` · 맹점 ③). */
const 미추적것 = [];
for (const 이름 of 이름들) {
  const p = path.join(폴더, 이름);
  const 지문 = (/^(?:유물-)?([0-9a-f]{8})/i.exec(path.basename(이름, '.md')) || [])[1];
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { 건너뛴것.push([이름, `못 읽었다(${e.code})`]); continue; }

  if (!보드lib.껍데기인가(txt)) { 건너뛴것.push([이름, '줄이나 사람이 쓴 글이 남아 있다']); continue; }
  if (산지문 === null) { 건너뛴것.push([이름, '주인 생사 검사 불가']); continue; }
  /* 🔑 이름에서 지문을 못 읽으면 **주인을 못 가른다** → 건너뛴다. 그 자리를 「지문 없음 =
   * 검사 통과」로 두면 산 세션의 파일이 조용히 지워진다 — 모르면 막는 쪽이 이 도구의 계약이다.
   *
   * ⚠ **0건이라고 죽은 갈래가 아니다** (실측 2026-08-14 · 유호님 「어차피 손 못 대는 것
   *   아니냐」에 답하며 잰 것). `보드id.지문` 은 sid 앞 8자를 **그냥 자르는** 함수라 hex 를
   *   보장하지 않는다: `local_web-abc123-de` → `web-abc1` · `cloud_run42xyz` → `run42xyz`
   *   (재본 5개 중 4개가 non-hex). 지금 이 저장소의 sid 가 전부 UUID 라 hex 로 떨어지는
   *   것뿐이고 그 보장은 코드 어디에도 없다 — 그런 이름이 한 번 생기면 그 세션의 보드
   *   파일이 곧장 이리로 떨어지고, 그때 이 검사가 그 파일을 지킨다.
   *
   * 🔴 앞서 여기 「`보드id.지문` 의 익명 폴백은 일부러 hex 가 아니다(F288)」고 적혀 있었는데
   *   **어긋난 근거**였다: `지문('')` 은 그냥 `''` 이고, `'unknown'` 폴백은 `handoff-store.safeId`
   *   쪽이다(그건 심장박동 파일 이름이지 보드 파일 이름이 아니다). 근거가 틀리면 다음 사람이
   *   「그 폴백이 없어졌으니 이 갈래도 지우자」로 간다 — board-move.js 가 같은 자리에서
   *   경고하는 「거짓 근거가 정본이 된다」 그 모양이다. */
  if (!지문) { 건너뛴것.push([이름, '파일 이름에서 지문을 못 읽었다 — 주인을 못 가른다']); continue; }
  if (산지문.has(지문.toLowerCase())) { 건너뛴것.push([이름, '주인 세션이 살아 있다']); continue; }
  if (저장소인가) {
    if (git(['ls-files', '--error-unmatch', '--', rel(p)]).status !== 0) {
      건너뛴것.push([이름, '미추적 — git 이 모르는 파일이라 안 건드린다']); 미추적것.push(p); continue;
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

/* 처방은 **dry 에서도** 낸다 — 이 자리를 읽는 사람은 대개 `--실행` 없이 부른 사람이고,
 * 지울 것이 0개일 때가 바로 미추적만 남은 그 상태다(그때 조기 종료로 빠지므로 아래보다 먼저 낸다). */
if (미추적것.length) {
  const 인용 = 미추적것.map((p) => `"${rel(p)}"`).join(' ');
  console.log(`\n  🔒 미추적 껍데기 ${미추적것.length}개 — 지우기 전에 **이력에 담아야** 되돌릴 자리가 생긴다(F025):`);
  console.log(`       git add -- ${인용}`);
  console.log(`       git commit -m "docs: 보드 껍데기 ${미추적것.length}개를 이력에 담는다 — 삭제 전 보호" -- ${인용}`);
  console.log('     그 뒤 이 도구를 다시 부르면 지운다(위 두 줄이 그대로 이 검사를 통과한다).');
}

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
/* 커밋과 push 는 한 벌이다 — master 직접 커밋이라 안 밀면 좌초한다(tools/lib/master동기.js). */
console.log(동기.줄내기('껍데기정리', 동기.밀기(ROOT)));
