#!/usr/bin/env node
'use strict';
/*
 * 검토화면.html을 아티팩트에 올릴 판으로 굽는다. SUIT · DM Mono · 그림 둘을 파일 안에 심는다.
 * 명조(Noto Serif KR)는 Google Fonts 줄을 그대로 둔다(아티팩트가 허용한다).
 * 쓰기: node docs/디자인/솔리오_사업계획서_검토화면_20261126/아티팩트판.cjs <나갈 파일>
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');
const 나갈곳 = process.argv[2];
if (!나갈곳) { console.error('나갈 파일 경로를 적어 주세요.'); process.exit(1); }
let 판 = fs.readFileSync(path.join(__dirname, '검토화면.html'), 'utf8');
const 바꾸기 = (찾을, 넣을) => { if (!판.includes(찾을)) throw new Error('원고에서 찾지 못했다: ' + 찾을.slice(0, 60)); 판 = 판.split(찾을).join(넣을); };
바꾸기("url(../../브랜드_폰트/DM_Mono/DMMono-Regular.ttf) format('truetype')", `url(data:font/ttf;base64,${fs.readFileSync(path.join(__dirname, '..', '..', '브랜드_폰트', 'DM_Mono', 'DMMono-Regular.ttf')).toString('base64')}) format('truetype')`);
for (const [그림, 꼴] of [['../솔리오_사업계획서_첫화면_20261123/그림/write.jpg', 'image/jpeg'], ['그림/orb.webp', 'image/webp']])
  바꾸기(`'${그림}'`, `'data:${꼴};base64,${fs.readFileSync(path.join(__dirname, ...그림.split('/'))).toString('base64')}'`);
const 면찾기 = /@font-face\{font-family:'SUIT Variable'[^}]*\}/;
if (!면찾기.test(판)) throw new Error('원고에서 SUIT @font-face 줄을 찾지 못했다.');
판 = 판.replace(면찾기, () => 폰트.면());
fs.mkdirSync(path.dirname(path.resolve(나갈곳)), { recursive: true });
fs.writeFileSync(나갈곳, 판);
console.log('구웠다: ' + 나갈곳 + ' (' + Math.round(Buffer.byteLength(판) / 1024) + 'KB)');
