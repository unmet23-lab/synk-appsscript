#!/usr/bin/env node
'use strict';
/*
 * 첫화면.html을 아티팩트에 올릴 판으로 굽는다.
 * 아티팩트는 문서 뼈대를 스스로 씌우고 바깥 글꼴과 그림 파일을 막는다.
 * 그래서 뼈대를 벗기고 SUIT · DM Mono · 그림(이 폴더의 그림과 블렌더 무대 층, 팀 고르기 7판의 그림)을 파일 안에 심는다.
 * 사무실 시안의 아티팩트판.cjs와 같은 방식이다.
 *
 * 쓰기: node docs/디자인/솔리오_사업계획서_첫화면_20261123/아티팩트판.cjs <나갈 파일>
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');

const 나갈곳 = process.argv[2];
if (!나갈곳) { console.error('나갈 파일 경로를 적어 주세요.'); process.exit(1); }
let 원고 = fs.readFileSync(path.join(__dirname, '첫화면.html'), 'utf8');

const 모노면 = /url\(\.\.\/\.\.\/브랜드_폰트\/DM_Mono\/DMMono-Regular\.ttf\) format\('truetype'\)/;
if (!모노면.test(원고)) throw new Error('원고에서 DM Mono @font-face 줄을 찾지 못했다.');
const 모노 = fs.readFileSync(path.join(__dirname, '..', '..', '브랜드_폰트', 'DM_Mono', 'DMMono-Regular.ttf')).toString('base64');
원고 = 원고.replace(모노면, () => `url(data:font/ttf;base64,${모노}) format('truetype')`);

const 무대 = ['plate', 'presenter', 'orb', 'judge0', 'judge1', 'judge2', 'paddle0', 'paddle1', 'paddle2'].map(n => `그림/무대/${n}.webp`);
const 그림들 = ['그림/write.jpg', ...무대,
  '../솔리오_첫계정고르기_20261121/그림/claude.jpg', '../솔리오_첫계정고르기_20261121/그림/gpt.jpg', '../솔리오_첫계정고르기_20261121/그림/custom.jpg'];
for (const 그림 of 그림들) {
  const 자리 = path.join(__dirname, ...그림.split('/'));
  if (!원고.includes(`'${그림}'`)) throw new Error('원고에서 그림 경로를 찾지 못했다: ' + 그림);
  const 바이트 = fs.readFileSync(자리).toString('base64');
  const 꼴 = 그림.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  원고 = 원고.split(`'${그림}'`).join(`'data:${꼴};base64,${바이트}'`);
}

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
