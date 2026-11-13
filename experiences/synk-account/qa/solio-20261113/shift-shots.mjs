// SHIFT 쪽 솔리오 구역(2026-11-13) 화면 점검: 홈페이지 dist를 로컬 정적 서버로 띄워 /shift/ · /en/shift/를 1440×900 · 390×844로 열고,
// 솔리오 구역(#solio)이 묻기 뒤 · 알아 두실 것 앞에 있는지, 쪽 메뉴에 「솔리오」가 있는지, 가로 넘침 · 깨진 그림 · 콘솔 오류가 없는지 재고 찍는다.
// 바깥 주소 요청은 모두 막는다(질문창 Worker 등). 사용: node shift-shots.mjs <홈페이지 dist> <출력 폴더>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [,, rootArg, outArg] = process.argv;
if (!rootArg || !outArg) throw Error('사용: node shift-shots.mjs <홈페이지 dist> <출력 폴더>');
const root = path.resolve(rootArg), out = path.resolve(outArg);fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = process.env.SYNK_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const report = { checkedOn: new Date().toISOString(), root, checks: [], consoleErrors: [], pageErrors: [], blocked: 0, shots: [] };
for (const [lang, url] of [['ko', '/shift/'], ['en', '/en/shift/']]) for (const [width, height, scale] of [[1440, 900, 1], [390, 844, 2]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  await context.route(/^(?!http:\/\/127\.0\.0\.1:)/, route => { report.blocked++; return route.abort(); });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) report.consoleErrors.push(`${lang}-${width}: ${m.text()}`); });
  page.on('pageerror', e => report.pageErrors.push(`${lang}-${width}: ${e.message}`));
  await page.goto(base + url, { waitUntil: 'load' });await page.evaluate(() => document.fonts.ready);
  // 나타나기 움직임이 있는 쪽이라 끝까지 한 번 내려 모두 보이게 한 뒤 잰다.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('main section[id], section[id]')].map(node => node.id), solio = document.getElementById('solio');
    const order = ['contact', 'solio', 'know'].map(id => [...document.querySelectorAll('section')].findIndex(node => node.id === id || node.querySelector(`#${id}-title`) && id === 'know'));
    return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), hasSolio: !!solio, order, nav: [...document.querySelectorAll('.bar-nav a')].map(a => a.getAttribute('href')),
      link: solio?.querySelector('a.k-btn')?.getAttribute('href'), rows: solio ? [...solio.querySelectorAll('.k-next-row')].map(row => row.textContent.trim().slice(0, 40)) : [],
      images: [...document.images].filter(img => img.getAttribute('src') && img.loading !== 'lazy').every(img => img.complete && img.naturalWidth > 0), ids };
  });
  const tag = `${lang}-${width}`;
  report.checks.push({ name: 'shift-solio-' + tag, ok: !info.overflow && info.hasSolio && info.order[0] >= 0 && info.order[0] < info.order[1] && (info.order[2] < 0 || info.order[1] < info.order[2]) && info.nav.includes('#solio') && info.link === '/account/platform.html#solio' && info.rows.length === 2, ...info, ids: undefined });
  const shot = `shift-${tag}.png`;await page.locator('#solio').screenshot({ path: path.join(out, `shift-solio-${tag}.png`) });
  await page.screenshot({ path: path.join(out, shot), fullPage: true });report.shots.push(shot, `shift-solio-${tag}.png`);
  await context.close();
}
await browser.close();server.close();
report.ok = report.checks.every(c => c.ok) && !report.pageErrors.length && !report.consoleErrors.length;
fs.writeFileSync(path.join(out, 'shift-shots.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: report.ok, failed: report.checks.filter(c => !c.ok), pageErrors: report.pageErrors, consoleErrors: report.consoleErrors.slice(0, 5), blocked: report.blocked, shots: report.shots.length }, null, 2));
process.exitCode = report.ok ? 0 : 1;
