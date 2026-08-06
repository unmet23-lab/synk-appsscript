#!/usr/bin/env node
/**
 * 홈페이지 시안 빌드 — 템플릿 + 마스코트 2장 → 자립형 HTML 1개.
 *
 *   node docs/홈페이지_시안/빌드.js [출력경로]
 *
 * 출력은 외부 의존이 폰트 CDN 2곳뿐이라 파일 하나만 보내도 열린다
 * (그래서 친구·검수자 전달이 첨부 1개로 끝난다).
 * 마스코트를 바꿀 때는 webp 2장만 갈아끼우고 다시 돌린다 — HTML 을 손대지 않는다.
 */
const fs = require('fs');
const path = require('path');

const 여기 = __dirname;
const 템플릿 = path.join(여기, '시안.tpl.html');
const 그림 = { __DOT__: '마스코트_점눈.webp', __SMILE__: '마스코트_웃음.webp' };
const 출력 = process.argv[2] || path.join(여기, '시안.html');

let html = fs.readFileSync(템플릿, 'utf8');
for (const [자리, 파일] of Object.entries(그림)) {
  const b64 = fs.readFileSync(path.join(여기, 파일)).toString('base64');
  html = html.replace(자리, 'data:image/webp;base64,' + b64);
}

// 자리표시자가 남아 있으면 그림이 안 박힌 판이 나간다 — 조용히 지나가지 않게 막는다
const 남은 = Object.keys(그림).filter(자리 => html.includes(자리));
if (남은.length) throw new Error('자리표시자 미치환: ' + 남은.join(', '));

fs.writeFileSync(출력, html);
console.log(`${출력} · ${(html.length / 1024).toFixed(0)}KB`);
