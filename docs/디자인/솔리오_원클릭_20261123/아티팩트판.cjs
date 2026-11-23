#!/usr/bin/env node
'use strict';
/*
 * 원클릭.html을 아티팩트에 올릴 온전한 문서로 굽는다.
 * 아티팩트는 바깥 글꼴 파일을 막으므로 SUIT와 DM Mono 400을 파일 안에 심는다(사무실 스킨 시안의 아티팩트판.cjs와 같은 방식).
 *
 * 쓰기: node docs/디자인/솔리오_원클릭_20261123/아티팩트판.cjs <나갈 파일>
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');

// --조각: 문서 뼈대(doctype · html · head · body)를 벗긴다. 뼈대를 스스로 씌우는 게시 도구(Claude Code의 Artifact)에 쓴다
const 조각 = process.argv.includes('--조각');
const 나갈곳 = process.argv.slice(2).find(a => a !== '--조각');
if (!나갈곳) { console.error('나갈 파일 경로를 적어 주세요.'); process.exit(1); }
let 판 = fs.readFileSync(path.join(__dirname, '원클릭.html'), 'utf8');
const 모노 = n => fs.readFileSync(path.join(__dirname, '..', '..', '브랜드_폰트', 'DM_Mono', n)).toString('base64');
for (const n of ['DMMono-Regular.ttf']) {
  const 자리 = `url(../../브랜드_폰트/DM_Mono/${n}) format('truetype')`;
  if (!판.includes(자리)) throw new Error(n + ' 글꼴 줄을 찾지 못했다.');
  판 = 판.replace(자리, () => `url(data:font/ttf;base64,${모노(n)}) format('truetype')`);
}
const 면찾기 = /@font-face\{font-family:'SUIT Variable'[^}]*\}/;
if (!면찾기.test(판)) throw new Error('SUIT @font-face 줄을 찾지 못했다.');
판 = 판.replace(면찾기, () => 폰트.면());
if (조각) {
  const 머리 = 판.match(/<head>([\s\S]*?)<\/head>/i)[1].replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
  판 = (머리 + 판.match(/<body>([\s\S]*?)<\/body>/i)[1]).trim() + '\n';
}
fs.mkdirSync(path.dirname(path.resolve(나갈곳)), { recursive: true });
fs.writeFileSync(나갈곳, 판);
console.log('구웠다: ' + 나갈곳 + ' (' + Math.round(Buffer.byteLength(판) / 1024) + 'KB)');
