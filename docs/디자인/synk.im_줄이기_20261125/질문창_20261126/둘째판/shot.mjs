import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('C:/Users/q1212/Documents/SYNK-appsscript/package.json');
const { chromium } = require('playwright');
const B = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1') + '/', root = B, OUT = B + 'shots/'; fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const s = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0].split('#')[0].slice(1)) || 'index.html', fp = path.join(root, f); if (!fs.existsSync(fp)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(fp)); }).listen(0);
const base = 'http://127.0.0.1:' + s.address().port + '/';
const br = await chromium.launch({ channel: 'chrome', headless: true });
const only = process.argv[2] || 'abc';
const W = (process.argv[3] || '1440,390').split(',').map(Number);
for (const w of W) for (const k of only) {
  const p = await br.newPage({ viewport: { width: w, height: w < 700 ? 844 : 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('response', r => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await p.goto(base + '#' + k, { waitUntil: 'load' }); await p.waitForTimeout(900);
  const shot = n => p.screenshot({ path: `${OUT}${k}-${w}-${n}.png` });
  await shot('1열림');
  if (k === 'a') {
    await p.click('#a-in'); await p.keyboard.type('유학 상담', { delay: 20 }); await p.waitForTimeout(500); await shot('2적는중');
    await p.keyboard.press('Enter'); await p.waitForTimeout(900); await shot('3답');
    await p.click('.a-back'); await p.click('.a-tab[data-tab="shift"]'); await p.waitForTimeout(600); await shot('4탭');
  } else if (k === 'b') {
    await p.click('#b-in'); await p.keyboard.type('유학', { delay: 20 }); await p.waitForTimeout(500); await shot('2적는중');
    await p.keyboard.press('Enter'); await p.waitForTimeout(900); await shot('3답');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.fill('#b-in', ''); await p.dispatchEvent('#b-in', 'input'); await p.waitForTimeout(300);
    await p.click('.b-opt >> text=한국 유학'); await p.waitForTimeout(600); await shot('4사업');
  } else {
    await p.click('.c-row >> nth=1'); await p.waitForTimeout(1000); await shot('2답');
    await p.fill('#c-in', '비용은 얼마인가요'); await p.dispatchEvent('#c-in', 'input'); await p.press('#c-in', 'Enter'); await p.waitForTimeout(1200); await shot('3이어묻기');
  }
  console.log(k, w, '넘침', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), '오류', errs.slice(0, 3));
  await p.close();
}
await br.close(); s.close();
