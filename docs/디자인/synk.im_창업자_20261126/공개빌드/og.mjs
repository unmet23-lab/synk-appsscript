// 창업자 쪽 공유 그림(1200×630)을 찍어 이 폴더 og/에 둔다. 짓기.py를 한 번 돌린 뒤에 부르고, 찍은 뒤 짓기.py를 한 번 더 돌린다.
//   node og.mjs <짓기 출력 폴더>
// 출력에 없는 파일(공용 글꼴 · 파비콘)은 도구 전용 공개본 사본(origin/main)에서 읽는다. synk.im에는 부르지 않는다.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const require = createRequire(path.join(REPO, 'package.json'));
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2]);
const BARE = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const type = TYPES[path.extname(p)] || 'application/octet-stream';
  if (/^(assets\/v10\/visit-count\.js|social-conversion\.js)$/.test(p)) { res.writeHead(200, { 'content-type': type }); return res.end(''); }
  const local = path.join(OUT, p);
  let body = null;
  if (fs.existsSync(local) && fs.statSync(local).isFile()) body = fs.readFileSync(local);
  else { try { body = execFileSync('git', [`--git-dir=${BARE}`, 'show', `origin/main:${p}`], { maxBuffer: 1 << 28, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }); } catch { body = null; } }
  if (!body) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': type }); res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
fs.mkdirSync(path.join(HERE, 'og'), { recursive: true });
for (const [k, u] of [['ko', '/founder/'], ['en', '/en/founder/']]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(base + u, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // 첫 화면 그대로, 메뉴만 걷는다(공유 그림에는 누를 것이 없다)
  await page.addStyleTag({ content: '.nav{display:none!important}.hero{min-height:630px!important}' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(HERE, 'og', `founder-${k}.jpg`), type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await page.close();
}
await browser.close();
server.close();
console.log('og', path.join(HERE, 'og'));
