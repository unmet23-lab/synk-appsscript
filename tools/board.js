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
