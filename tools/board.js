#!/usr/bin/env node
/* board — 세션별 파일에서 **조립한** 보드 표를 낸다.
 *
 * 정본은 `docs/_ops/보드/<지문>.md` 들이고 합쳐진 표는 디스크에 없다(F250 · tools/lib/보드.js).
 * 옛 `docs/세션보드.md` 를 열던 자리를 이 명령이 대신한다.
 */
'use strict';

const path = require('path');
const 보드 = require(path.join(__dirname, 'lib', '보드.js'));

const ROOT = process.env.SYNK_BOARD_ROOT || path.resolve(__dirname, '..');
const 표 = 보드.텍스트(ROOT);

if (표 === null) {
  console.error(`[board] 보드 폴더가 없다: ${보드.폴더(ROOT)}`);
  console.error('  → 첫 선언이라면 그 폴더에 `<내 지문 8자리>.md` 를 만들어 표 행 한 줄을 쓴다.');
  process.exit(1);
}

process.stdout.write(표);

/* 유령 줄 — 표에는 안 뜨는데 **자리는 먹는** 줄(F322·F330·F331 · 사연 = tools/lib/보드.js).
 * 표만 내면 이 줄은 영원히 안 보인다: 쓴 세션은 「선언했다」고 믿고, 다음 세션은 상한이
 * 왜 넘쳤는지 모른 채 물려받은 위반을 안고 시작한다. **stdout 이 아니라 stderr** 로 낸다 —
 * 이 명령의 표를 파싱하는 자리가 있어서, 표 아래 글자를 붙이면 그쪽이 새 줄을 만난다. */
const 유령 = 보드.유령들(ROOT) || [];
if (유령.length) {
  console.error(`\n⚠ 유령 줄 ${유령.length}건 — 위 표에 **없는데** board-guard 는 세는 줄이다(상한을 먹는다):`);
  for (const g of 유령) {
    console.error(`  · ${g.파일}:${g.줄번호}  ${g.줄.replace(/\s+/g, ' ').slice(0, 60)}…`);
    g.사유.forEach((s) => console.error(`      ↳ ${s}`));
  }
  console.error('  → 주인이 살아 있으면 **그 세션이** 자기 파일에서 규격대로 고친다(남의 파일 편집은 F073).');
  console.error('    죽었고 완료 줄이면: node tools/board-move.js "<그 줄의 유일 문구>"');
}

/* 주인 없는 줄 — 표에서는 산 줄과 **글자 하나 다르지 않은데** 마감 시점에서 굳은 줄이다.
 * 이 줄의 「▶다음」·「🎫」는 그 뒤 남이 해버렸어도 그대로 남는다(사연 = tools/lib/보드.js).
 * 유령과 같은 이유로 **stderr** 다 — 표를 파싱하는 곳이 넷이라 stdout 에는 한 글자도 안 붙인다. */
const 주인없음 = 보드.주인없는줄들(ROOT);
if (주인없음 === null) {
  /* 「0건」과 갈라 말한다 — 못 잰 것을 조용히 통과시키면 이 경고는 가장 필요한 날 사라진다(F207). */
  console.error('\n⚠ 줄 주인의 생사를 **못 쟀다**(「주인 없는 줄 0건」이 아니다) — 🎫 를 집기 전에 실물을 직접 연다.');
} else if (주인없음.length) {
  const 티켓 = 주인없음.filter((r) => r.이어받기);
  /* 「끝났다」고 단정하지 않는다 — 판정 재료는 **마감 도장**(SessionEnd)이지 죽음이 아니고,
   * 도장 찍은 세션도 도구를 다시 부르면 되살아난다(track-collision 이 도장을 지운다).
   * 그래도 경고는 유효하다: 마감을 선언한 순간부터 그 줄은 아무도 갱신하지 않는다. */
  console.error(`\n⚠ 주인이 **마감을 선언한** 줄 ${주인없음.length}건 — 그 시점에서 갱신이 멈췄다:`);
  for (const r of 주인없음) {
    console.error(`  · ${r.지문 || r.파일}  ${r.줄.replace(/\s+/g, ' ').slice(0, 72)}…`);
  }
  if (티켓.length) {
    console.error(`\n  🎫 그중 ${티켓.length}건이 이어받기 일감을 남겼다 — **집기 전에 실물을 직접 연다.**`);
    console.error('     「남이 이미 해버린 일」과 「내가 더 할 일」은 이 표에서 같은 모양이다:');
    console.error('       파일을 신설하라는 일감이면 그 파일이 이미 있는지 · 배포·검수면 그 커밋이 이미 나갔는지.');
  }
  console.error('  → 완료 줄이면: node tools/board-move.js "<그 줄의 유일 문구>" (산 주인의 줄은 그 도구가 거절한다)');
}
