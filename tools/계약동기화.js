#!/usr/bin/env node
/**
 * 계약 파일을 형제 저장소에 같은 바이트로 넣는다 (계약/수집_교정_계약.json)
 *
 * 왜 있나 — 이 파일의 `고치는_법`은 프로즈였다: "두 저장소 모두에 같은 바이트로 넣는다".
 *   그리고 c1 시절 실제로 갈라졌다(픽스처 「불변」이 한쪽에만 있었고 양쪽 회귀가 둘 다 못 봤다).
 *   손복사는 6KB JSON을 사람이 옮기는 일이라 언젠가 한 글자가 어긋난다 — 기계로 옮긴다.
 *
 * 정본 = 이 저장소. 형제(SYNK-talk)는 언제나 사본이다.
 *   tests/계약.test.js 가 **탐지**를 지고, 이 도구가 **수정**을 진다(탐지와 수정이 같은 손이면 둘 다 못 믿는다).
 *
 * 쓰는 법:
 *   node tools/계약동기화.js           형제에 덮어쓴다
 *   node tools/계약동기화.js --check   같은지만 보고 다르면 종료코드 1 (고치지 않는다)
 *
 * ⚠ 형제가 이 기계에 없으면 **조용히 통과시키지 않고** 그 사실을 말하고 끝낸다(종료코드 0).
 *   CI엔 형제가 없다 — 통과와 미실행이 같은 모양이면 안 된다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const 상대경로 = path.join('계약', '수집_교정_계약.json');
const 정본 = path.join(REPO, 상대경로);
const 형제 = path.join(REPO, '..', 'SYNK-talk', 상대경로);

// 줄바꿈만 정규화한다 — 이 저장소는 autocrlf=true 라 CRLF일 수 있고, 형제는 언제나 LF다.
// 거짓 경보를 내는 가드는 곧 꺼진다. 줄바꿈 차이는 계약의 분열이 아니다(회귀도 같은 기준).
const 읽기 = (p) => fs.readFileSync(p, 'utf8');
const 정규화 = (s) => s.replace(/\r\n/g, '\n');

function main(argv) {
  const check = argv.includes('--check');

  if (!fs.existsSync(정본)) {
    console.error(`정본이 없다: ${정본}`);
    return 2;
  }
  if (!fs.existsSync(형제)) {
    console.log(`형제 저장소 SYNK-talk가 이 기계에 없다 — 동기화 건너뜀 (${형제})`);
    return 0;
  }

  const 원 = 읽기(정본);
  if (정규화(읽기(형제)) === 정규화(원)) {
    console.log('계약 동일 ✓ (줄바꿈 제외)');
    return 0;
  }

  if (check) {
    console.error('계약이 갈라졌다 — `node tools/계약동기화.js` 로 형제에 정본을 넣어라');
    console.error(`  정본: ${정본}\n  형제: ${형제}`);
    return 1;
  }

  // 형제는 언제나 LF다(SYNK-talk .gitattributes `* text=auto eol=lf`).
  // CRLF를 그대로 밀어넣으면 그쪽 커밋마다 전 줄이 바뀐 것으로 보인다.
  fs.writeFileSync(형제, 정규화(원), 'utf8');
  console.log(`형제에 정본을 넣었다 → ${형제}`);
  console.log('⚠ 형제 저장소에서도 커밋해야 계약이 계약이 된다.');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main };
