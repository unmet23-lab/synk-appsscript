// 링크드인 커버 HTML 원고 → PNG (2026-11-05)
// 원고는 1584×396 CSS 픽셀 판 하나. 2배(3168×792)로 찍어 「_2x.png」, 그것을 줄여 1배 「.png」를 낸다.
//   node docs/마케팅/링크드인커버_20261105/굽기_html.mjs <원고.html> <낼이름(확장자 없이)>
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const 폰트 = require('../../../tools/lib/브랜드폰트.js');
const [원고, 낼] = process.argv.slice(2);
if (!원고 || !낼) { console.error('사용: node 굽기_html.mjs <원고.html> <낼이름>'); process.exit(2); }

// 원고 안의 <!--폰트--> 자리에 SUIT Variable을 심는다(바깥 CDN 없이).
let html = fs.readFileSync(원고, 'utf8').replace('<!--폰트-->', 폰트.블록());
const 임시 = path.join(path.dirname(path.resolve(원고)), `._굽는중_${process.pid}.html`);
fs.writeFileSync(임시, html, 'utf8');

// Playwright 전용 브라우저는 깔려 있지 않다 — 설치된 크롬(없으면 엣지)으로 찍는다.
const 브라우저 = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
try {
  for (const [배, 꼬리] of [[2, '_2x'], [1, '']]) {
    const 쪽 = await 브라우저.newPage({ viewport: { width: 1584, height: 396 }, deviceScaleFactor: 배 });
    await 쪽.goto('file:///' + 임시.replace(/\\/g, '/'));
    await 쪽.evaluate(() => document.fonts.ready);
    await 쪽.waitForTimeout(300);
    await 쪽.screenshot({ path: `${낼}${꼬리}.png`, clip: { x: 0, y: 0, width: 1584, height: 396 } });
    await 쪽.close();
    console.log(`[굽기] ${낼}${꼬리}.png`);
  }
} finally {
  await 브라우저.close();
  fs.rmSync(임시, { force: true });
}
