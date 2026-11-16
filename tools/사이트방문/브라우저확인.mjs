// synk.im 사이트 방문 기록(SYNK-website site-v10/visit-count.js)을 빌드한 쪽에서 실제 브라우저로 확인한다(2026-11-17).
// synk.im 이름을 로컬 서버로 돌리고, 설문지로 가는 요청은 붙잡아 내용만 읽고 보내지 않는다. 바깥으로는 아무것도 나가지 않는다.
//   node tools/사이트방문/브라우저확인.mjs <SYNK-website의 dist 폴더>
// 이 PC의 Playwright에 판이 맞는 브라우저가 없으면 SYNK_PLAYWRIGHT_CHROMIUM에 실행 파일 경로를 준다.
// 떠날 때의 요청은 Playwright route가 못 봐서, 쪽 안에서 보낸 몸을 synk.im 저장소에 같이 적어 읽는다(현장 노트 시험_화면확인).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const dist = process.argv[2];
if (!dist || !fs.existsSync(path.join(dist, 'index.html'))) { console.error('쓰는 법: node tools/사이트방문/브라우저확인.mjs <dist 폴더>'); process.exit(2); }
const types = { '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(path.resolve(dist)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ ...(process.env.SYNK_PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.SYNK_PLAYWRIGHT_CHROMIUM } : {}), args: [`--host-resolver-rules=MAP synk.im 127.0.0.1:${port}`] });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
async function session() {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
    const f = window.fetch;
    window.fetch = function (url, opts) {
      try { if (String(url).includes('/formResponse')) { const k = 'qa.sent'; const a = JSON.parse(localStorage.getItem(k) || '[]'); a.push(String(opts && opts.body && opts.body.get ? opts.body.get('entry.1246660192') : '')); localStorage.setItem(k, JSON.stringify(a)); } } catch {}
      return f.apply(this, arguments);
    };
  });
  const forms = [], outside = [];
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'docs.google.com' && u.pathname.endsWith('/formResponse')) {
      const body = new URLSearchParams(route.request().postData() || '');
      forms.push({ form: u.pathname.split('/')[4], fields: [...body.keys()], record: body.get('entry.1246660192') });
      return route.fulfill({ status: 200, body: '' });
    }
    if (u.hostname === 'synk.im' || u.hostname === '127.0.0.1') return route.continue();
    outside.push(u.hostname);
    if (route.request().isNavigationRequest()) return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>outside</p>' });
    return route.abort();
  });
  return { ctx, forms, outside };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = {};

// 1. 검색에서 홈으로 → 4초 → 사이트 안 링크로 PULSE → 질문창에 글 → 광고 의뢰 누름
{
  const { ctx, forms, outside } = await session();
  const page = await ctx.newPage();
  await page.goto(`http://synk.im:${port}/`, { referer: 'https://www.google.com/', waitUntil: 'load' });
  await wait(4600);
  const afterWait = forms.length;
  await page.mouse.wheel(0, 20000); await wait(600);
  await Promise.all([page.waitForURL('**/pulse/'), page.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === '/pulse/'); a.click(); })]);
  await page.waitForLoadState('load');
  await page.mouse.wheel(0, 400); await wait(800);
  const box = await page.$('#question-form input, #question-form textarea');
  if (box) { await box.fill('제 이름은 홍길동이고 010-1234-5678입니다'); await page.keyboard.press('Enter'); await wait(800); }
  await page.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(a => a.href.startsWith('https://workspace.synk.im/pulse-app/')); a.removeAttribute('target'); a.click(); });
  await wait(1500);
  const reader = await ctx.newPage();
  let err = null; await reader.goto(`http://synk.im:${port}/robots.txt`).catch(e => { err = String(e).slice(0, 200); });
  if (err) out.readerError = err;
  const sentInPage = await reader.evaluate(() => JSON.parse(localStorage.getItem('qa.sent') || '[]'));
  out.flow = { arrivedAfter4s: afterWait, seenByRoute: forms.length, forms, sentInPage, outside: [...new Set(outside)] };
  await ctx.close();
}
// 2. 로컬 주소(synk.im이 아님)에서는 아무것도 보내지 않고 Clarity도 부르지 않는다
{
  const { ctx, forms, outside } = await session();
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/pulse/`, { waitUntil: 'load' });
  await page.mouse.wheel(0, 3000); await wait(4600);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' }); await wait(500);
  out.local = { forms: forms.length, outside: [...new Set(outside)] };
  await ctx.close();
}
// 3. 보기만 하고 2초 만에 떠나면 세지 않는다 · ?from=qa는 세지 않는다
{
  const { ctx, forms } = await session();
  const page = await ctx.newPage();
  await page.goto(`http://synk.im:${port}/en/`, { waitUntil: 'load' }); await wait(2000);
  await page.goto(`http://synk.im:${port}/lab/?from=qa`, { waitUntil: 'load' }); await page.mouse.wheel(0, 3000); await wait(4600);
  await page.goto('about:blank'); await wait(500);
  out.quick = { forms: forms.length };
  await ctx.close();
}
await browser.close(); server.close();
console.log(JSON.stringify(out, null, 1));
