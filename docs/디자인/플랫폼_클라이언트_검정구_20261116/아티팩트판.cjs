#!/usr/bin/env node
'use strict';
/*
 * 검정구.html을 아티팩트에 올릴 판으로 굽는다.
 * 아티팩트는 문서 뼈대를 스스로 씌우고 바깥 글꼴 파일을 막는다.
 * 그래서 뼈대를 벗기고 SUIT를 파일 안에 심는다.
 *
 * 쓰기: node docs/디자인/플랫폼_클라이언트_검정구_20261116/아티팩트판.cjs <나갈 파일>
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');

const 나갈곳 = process.argv[2];
if (!나갈곳) {
  console.error('나갈 파일 경로를 적어 주세요.');
  process.exit(1);
}
const 원고 = fs.readFileSync(path.join(__dirname, '검정구.html'), 'utf8');
const 머리 = 원고.match(/<head>([\s\S]*?)<\/head>/i)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const 몸 = 원고.match(/<body>([\s\S]*?)<\/body>/i)[1];
const 면찾기 = /@font-face\{font-family:'SUIT Variable'[^}]*\}/;
if (!면찾기.test(머리)) throw new Error('원고에서 SUIT @font-face 줄을 찾지 못했다.');

const 판 = (머리.replace(면찾기, () => 폰트.면()) + 몸).trim() + '\n';
fs.mkdirSync(path.dirname(path.resolve(나갈곳)), { recursive: true });
fs.writeFileSync(나갈곳, 판);
console.log('구웠다: ' + 나갈곳 + ' (' + Math.round(Buffer.byteLength(판) / 1024) + 'KB)');
