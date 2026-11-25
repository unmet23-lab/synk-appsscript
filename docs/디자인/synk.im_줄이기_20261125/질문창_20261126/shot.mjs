import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('C:/Users/q1212/Documents/SYNK-appsscript/package.json');
const { chromium } = require('playwright');
const B = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1') + '/', root = B, OUT = B + 'shots/'; fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const s = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0].split('#')[0].slice(1)) || 'index.html', fp = path.join(root, f); if (!fs.existsSync(fp)) { r.writeHead(404); return r.end(); } const b = fs.readFileSync(fp); r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); }).listen(0);
const base = 'http://127.0.0.1:' + s.address().port + '/';
const br = await chromium.launch({ channel: 'chrome', headless: true });
const only = process.argv[2];
for (const [w, h] of [[1440, 900], [390, 844]]) for (const k of ['a', 'b', 'c']) {
  if (only && !only.includes(k)) continue;
  const p = await br.newPage({ viewport: { width: w, height: h } }); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('response', r => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await p.goto(base + '#' + k, { waitUntil: 'load' }); await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + `${k}-${w}-0.png` });
  const sel = { a: '#a-in', b: '#b-in', c: '#c-in' }[k];
  if (k === 'a') { await p.fill(sel, '유학 상담은 어떻게 받나요'); await p.dispatchEvent(sel, 'input'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + `${k}-${w}-1적는중.png` }); }
  else { await p.fill(sel, '유학 상담은 어떻게 받나요'); await p.dispatchEvent(sel, 'input'); }
  await p.press(sel, 'Enter'); await p.waitForTimeout(1600);
  await p.screenshot({ path: OUT + `${k}-${w}-2답.png` });
  await p.evaluate(() => document.querySelector('.sheet').scrollTo(0, 0)); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + `${k}-${w}-3위.png` });
  if (k === 'c') { await p.click('.c-book.c-shift'); await p.waitForTimeout(800); await p.screenshot({ path: OUT + `${k}-${w}-4책.png` }); }
  if (k === 'b') { await p.click('.b-item >> nth=0 >> .b-q'); await p.waitForTimeout(900); await p.evaluate(() => document.querySelector('.sheet').scrollTo(0, 0)); await p.screenshot({ path: OUT + `${k}-${w}-4첫질문.png` }); }
  console.log(k, w, '넘침', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), '오류', errs.slice(0, 3));
  await p.close();
}
await br.close(); s.close();
