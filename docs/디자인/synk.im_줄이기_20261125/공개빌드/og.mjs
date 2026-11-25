/* 후보 홈을 1200×630으로 열어 공유 그림을 찍는다. 쓰임: node og.mjs <후보 폴더>  (찍은 뒤 짓기.py를 다시 돌려 주소의 해시를 맞춘다) */
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const { chromium } = createRequire('C:/Users/q1212/Documents/SYNK-appsscript/package.json')('playwright');
const D = process.argv[2], T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const [k, u] of [['ko', ''], ['en', 'en/']]) {
  const p = await (await b.newContext({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-26T14:20:00+09:00'));
  await p.route(/visit-count|social-conversion|client\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await p.route(x => x.hostname === 'synk.im', r => { let f = new URL(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html'; const fp = path.join(D, f); fs.existsSync(fp) ? r.fulfill({ status: 200, contentType: T[path.extname(fp)], body: fs.readFileSync(fp) }) : r.fallback(); });
  await p.goto('https://synk.im/' + u, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(D, `assets/v12/og/home-${k}.jpg`), type: 'jpeg', quality: 86 });
}
await b.close();
