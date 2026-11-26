// 셋째 판 시안 캡처: node shot.mjs <주소 바탕> <출력 폴더> [판…]
// 판마다 열림 · 적는 중 · 답, 1440×900과 390×844.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const require = createRequire('C:/Users/q1212/Documents/SYNK-appsscript/package.json');
const { chromium } = require('playwright');
const [base = 'http://localhost:4998/', out = 'shots', ...only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const looks = only.length ? only : ['a', 'b', 'c'];
const INPUT = { a: '#a-in', b: '#b-in', c: '#c-in' };
const TYPE = '유학 상담';
const br = await chromium.launch({ channel: 'chrome' });
for (const vp of [[1440, 900], [390, 844]]) {
  const ctx = await br.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: vp[0] < 500 ? 2 : 1, hasTouch: vp[0] < 500 });
  for (const k of looks) {
    const pg = await ctx.newPage();
    await pg.goto(base + '#' + k, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1200);
    const n = (s) => path.join(out, `${k}-${vp[0]}-${s}.png`);
    await pg.screenshot({ path: n('1열림') });
    await pg.click(INPUT[k]); await pg.keyboard.type(TYPE, { delay: 60 }); await pg.waitForTimeout(900);
    await pg.screenshot({ path: n('2적는중') });
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(1800);
    await pg.screenshot({ path: n('3답') });
    await pg.close();
  }
  await ctx.close();
}
await br.close();
console.log('ok');
