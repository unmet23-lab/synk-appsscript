#!/usr/bin/env node
'use strict';
/*
 * 대화.html을 아티팩트에 올릴 판으로 굽는다.
 * 아티팩트는 문서 뼈대를 스스로 씌우고 바깥 글꼴 파일을 막는다. 그래서 뼈대를 벗기고 SUIT와 DM Mono를 파일 안에 심는다.
 * 사무실 그림은 PC 앱의 모듈을 부르므로, 부르는 자리를 ./renderer/로 바꾼다. 올릴 때 desktop/renderer의 네 파일을 함께 올린다:
 *   renderer/office-floor.mjs · office-model.mjs · solio-today.mjs · subscriptions-model.mjs
 * 쓰기: node docs/디자인/솔리오_사무실대화_20261124/아티팩트판.cjs <나갈 파일>
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');

const 나갈곳 = process.argv[2];
if (!나갈곳) { console.error('나갈 파일 경로를 적어 주세요.'); process.exit(1); }
let 원고 = fs.readFileSync(path.join(__dirname, '대화.html'), 'utf8');

const 수트면 = /@font-face\{font-family:'SUIT';[^}]*\}/;
const 모노면 = /url\(\.\.\/\.\.\/브랜드_폰트\/DM_Mono\/DMMono-Regular\.ttf\) format\('truetype'\)/;
const 모듈 = "from '../../../desktop/renderer/office-floor.mjs'";
for (const [이름, 찾기] of [['SUIT 글꼴 줄', 수트면], ['DM Mono 글꼴 줄', 모노면]]) if (!찾기.test(원고)) throw new Error(이름 + '을 원고에서 찾지 못했다.');
if (!원고.includes(모듈)) throw new Error('사무실 그림 모듈을 부르는 줄을 원고에서 찾지 못했다.');

// 사무실 그림 모듈이 캔버스에 쓰는 글꼴 이름이 SUIT라, 심는 글꼴도 그 이름으로 둔다
원고 = 원고.replace(수트면, () => 폰트.면().replace("font-family:'SUIT Variable'", "font-family:'SUIT'"));
const 모노 = fs.readFileSync(path.join(__dirname, '..', '..', '브랜드_폰트', 'DM_Mono', 'DMMono-Regular.ttf')).toString('base64');
원고 = 원고.replace(모노면, () => `url(data:font/ttf;base64,${모노}) format('truetype')`);
원고 = 원고.replace(모듈, "from './renderer/office-floor.mjs'");

const 머리 = 원고.match(/<head>([\s\S]*?)<\/head>/i)[1].replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
const 몸 = 원고.match(/<body>([\s\S]*?)<\/body>/i)[1];
const 판 = (머리 + 몸).trim() + '\n';
fs.mkdirSync(path.dirname(path.resolve(나갈곳)), { recursive: true });
fs.writeFileSync(나갈곳, 판);
console.log('구웠다: ' + 나갈곳 + ' (' + Math.round(Buffer.byteLength(판) / 1024) + 'KB)');
