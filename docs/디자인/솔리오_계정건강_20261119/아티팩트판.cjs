#!/usr/bin/env node
'use strict';
/*
 * 계정건강.html을 아티팩트에 올릴 판으로 굽는다.
 * 아티팩트는 문서 뼈대를 스스로 씌우고 바깥 파일(글꼴, 자료.js)을 막는다.
 * 그래서 뼈대를 벗기고 SUIT와 자료를 파일 안에 심는다(사무실 시안의 아티팩트판.cjs와 같은 방식).
 *
 * 쓰기: node docs/디자인/솔리오_계정건강_20261119/아티팩트판.cjs <나갈 파일>
 * 자료가 낡았으면 먼저 `node docs/디자인/솔리오_계정건강_20261119/자료만들기.cjs`를 돌린다.
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');

const 나갈곳 = process.argv[2];
if (!나갈곳) {
  console.error('나갈 파일 경로를 적어 주세요.');
  process.exit(1);
}
const 원고 = fs.readFileSync(path.join(__dirname, '계정건강.html'), 'utf8');
const 자료 = fs.readFileSync(path.join(__dirname, '자료.js'), 'utf8');
const 머리 = 원고.match(/<head>([\s\S]*?)<\/head>/i)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const 몸 = 원고.match(/<body>([\s\S]*?)<\/body>/i)[1];
const 면찾기 = /@font-face\{font-family:'SUIT Variable'[^}]*\}/;
const 자료찾기 = '<script src="자료.js"></script>';
if (!면찾기.test(머리)) throw new Error('원고에서 SUIT @font-face 줄을 찾지 못했다.');
if (!몸.includes(자료찾기)) throw new Error('원고에서 자료.js를 부르는 줄을 찾지 못했다.');

const 판 = (머리.replace(면찾기, () => 폰트.면()) + 몸.replace(자료찾기, () => '<script>' + 자료.replace(/<\/script/gi, '<\\/script') + '</script>')).trim() + '\n';
fs.mkdirSync(path.dirname(path.resolve(나갈곳)), { recursive: true });
fs.writeFileSync(나갈곳, 판);
console.log('구웠다: ' + 나갈곳 + ' (' + Math.round(Buffer.byteLength(판) / 1024) + 'KB)');
