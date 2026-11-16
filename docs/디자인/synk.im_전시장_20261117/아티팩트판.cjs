#!/usr/bin/env node
'use strict';
/*
 * 전시장.html을 claude.ai 페이지에 올릴 판으로 굽는다.
 * 그 페이지는 문서 뼈대를 스스로 씌우고, 바깥 주소의 글꼴 · 그림 · 영상을 막는다.
 * 그래서 뼈대를 벗기고, SUIT를 파일 안에 심고, 그림과 영상은 함께 올릴 폴더(assets)로 모은다.
 *
 * 쓰기: node docs/디자인/synk.im_전시장_20261117/아티팩트판.cjs <나갈 폴더> [PULSE 쇼릴 mp4]
 *   나갈 폴더에 「SYNK-전시장-홈-시안.html」과 assets/가 생긴다.
 *   PULSE 쇼릴(7.4MB)은 저장소에 두지 않는다. 공개 주소에서 받은 파일의 경로를 둘째 인자로 주면
 *   assets/pulse-reel.mp4로 옮겨 싣고, 주지 않으면 그 방은 멈춘 그림(포스터)만 보인다.
 */
const fs = require('node:fs');
const path = require('node:path');
const 폰트 = require('../../../tools/lib/브랜드폰트.js');

const [나갈폴더, 쇼릴] = process.argv.slice(2);
if (!나갈폴더) { console.error('나갈 폴더 경로를 적어 주세요.'); process.exit(1); }

const 원고 = fs.readFileSync(path.join(__dirname, '전시장.html'), 'utf8');
const 뿌리 = 원고.match(/<html([^>]*)>/i)[1];
const 머리 = 원고.match(/<head>([\s\S]*?)<\/head>/i)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const 몸짝 = 원고.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
let 몸 = 몸짝[2];

// 뼈대를 벗기면 <html>과 <body>에 적어 둔 값이 사라진다. 첫 줄에서 다시 적는다.
const 값 = (글, 이름) => { const m = 글.match(new RegExp(이름 + '="([^"]*)"')); if (!m) throw new Error('원고에 ' + 이름 + '가 없다.'); return m[1]; };
const 첫줄 = '<script>(function(){var r=document.documentElement;r.lang=' + JSON.stringify(값(뿌리, 'lang')) + ';r.dataset.sky=' + JSON.stringify(값(뿌리, 'data-sky')) + ';r.dataset.gate=' + JSON.stringify(값(뿌리, 'data-gate')) + ';document.body.dataset.at=' + JSON.stringify(값(몸짝[1], 'data-at')) + ';})();</script>\n';

const 면찾기 = /@font-face\{font-family:'SUIT Variable'[^}]*\}/;
if (!면찾기.test(머리)) throw new Error('원고에서 SUIT @font-face 줄을 찾지 못했다.');

// PULSE 쇼릴: 바깥 주소 대신 함께 올리는 파일을 쓴다.
const 쇼릴찾기 = /src="https:\/\/synk\.im\/assets\/v10\/[^"]+\.mp4" data-src-local="(assets\/[^"]+)"/;
const 쇼릴짝 = 몸.match(쇼릴찾기);
if (!쇼릴짝) throw new Error('원고에서 PULSE 쇼릴 줄을 찾지 못했다.');
몸 = 몸.replace(쇼릴찾기, () => (쇼릴 ? 'src="' + 쇼릴짝[1] + '"' : ''));

const 남은바깥 = [...(머리 + 몸).matchAll(/(?:src|poster)="(https?:[^"]+)"|url\((https?:[^)]+)\)/g)].map(m => m[1] || m[2]);
if (남은바깥.length) throw new Error('바깥 주소에서 받는 것이 남았다: ' + 남은바깥.join(', '));

const 판 = (머리.replace(면찾기, () => 폰트.면()) + 첫줄 + 몸).trim() + '\n';
const 자산 = path.join(나갈폴더, 'assets');
fs.mkdirSync(자산, { recursive: true });
const 쪽 = path.join(나갈폴더, 'SYNK-전시장-홈-시안.html');
fs.writeFileSync(쪽, 판);

const 쓰는것 = new Set([...판.matchAll(/assets\/([A-Za-z0-9._-]+)/g)].map(m => m[1]));
let 합 = 0; const 없는것 = [];
for (const 이름 of [...쓰는것].sort()) {
  const 원본 = 이름 === path.basename(쇼릴짝[1]) ? 쇼릴 : path.join(__dirname, 'assets', 이름);
  if (!원본 || !fs.existsSync(원본)) { 없는것.push(이름); continue; }
  fs.copyFileSync(원본, path.join(자산, 이름)); 합 += fs.statSync(원본).size;
}
if (없는것.length) throw new Error('쪽이 쓰는데 없는 파일: ' + 없는것.join(', '));
console.log('구웠다: ' + 쪽 + ' (' + Math.round(Buffer.byteLength(판) / 1024) + 'KB) · 함께 올릴 파일 ' + 쓰는것.size + '개 ' + (합 / 1048576).toFixed(1) + 'MB' + (쇼릴 ? '' : ' · 쇼릴 없이'));
console.log(JSON.stringify([...쓰는것].sort().map(n => 'assets/' + n)));
