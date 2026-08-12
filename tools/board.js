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
