#!/usr/bin/env node
'use strict';
/*
 * 사무실.html을 아티팩트에 올릴 판으로 굽는다.
 * 아티팩트는 문서 뼈대를 스스로 씌우고 바깥 글꼴 파일을 막는다.
 * 그래서 뼈대를 벗기고 SUIT를 파일 안에 심는다(검정 구 시안의 아티팩트판.cjs와 같은 방식).
 *
 * 쓰기: node docs/디자인/솔리오_사무실_20261119/아티팩트판.cjs <나갈 파일> [--문서]
 * --문서: 뼈대를 벗기지 않고 <!doctype html>부터 온전한 문서로 굽는다.
 *         뼈대를 씌우지 않는 게시 도구(claude-artifacts의 publish_files · publish_version)에 쓴다(2026-11-21).
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');

const 인자 = process.argv.slice(2);
const 문서로 = 인자.includes('--문서');
// --원고 <같은 폴더의 html>: 사무실.html 말고 다른 시안(경쟁사.html 등)을 굽는다(2026-11-23)
const 원고자리 = 인자.indexOf('--원고');
const 원고이름 = 원고자리 >= 0 ? 인자[원고자리 + 1] : '사무실.html';
const 나갈곳 = 인자.find((a, i) => a !== '--문서' && a !== '--원고' && !(원고자리 >= 0 && i === 원고자리 + 1));
if (!나갈곳 || !원고이름 || /[\\/]/.test(원고이름)) {
  console.error('나갈 파일 경로를 적어 주세요. 원고는 같은 폴더의 파일 이름만 받습니다.');
  process.exit(1);
}
let 원고 = fs.readFileSync(path.join(__dirname, 원고이름), 'utf8');
// DM Mono를 상대 경로로 부르는 원고는 그 글꼴도 파일 안에 심는다(아티팩트는 바깥 글꼴을 막는다)
const 모노면 = /url\(\.\.\/\.\.\/브랜드_폰트\/DM_Mono\/DMMono-Regular\.ttf\) format\('truetype'\)/;
if (모노면.test(원고)) {
  const 모노 = fs.readFileSync(path.join(__dirname, '..', '..', '브랜드_폰트', 'DM_Mono', 'DMMono-Regular.ttf')).toString('base64');
  원고 = 원고.replace(모노면, () => `url(data:font/ttf;base64,${모노}) format('truetype')`);
}
const 머리 = 원고.match(/<head>([\s\S]*?)<\/head>/i)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const 몸 = 원고.match(/<body>([\s\S]*?)<\/body>/i)[1];
const 면찾기 = /@font-face\{font-family:'SUIT Variable'[^}]*\}/;
if (!면찾기.test(머리)) throw new Error('원고에서 SUIT @font-face 줄을 찾지 못했다.');

const 판 = 문서로
  ? 원고.replace(면찾기, () => 폰트.면()).trim() + '\n'
  : (머리.replace(면찾기, () => 폰트.면()) + 몸).trim() + '\n';
fs.mkdirSync(path.dirname(path.resolve(나갈곳)), { recursive: true });
fs.writeFileSync(나갈곳, 판);
console.log('구웠다: ' + 나갈곳 + ' (' + Math.round(Buffer.byteLength(판) / 1024) + 'KB)');
