// 줄 세우기 판을 열어 기본 길 지문(비교 커밋 == 지금, PC · 휴대폰)과 전후 그림을 찍는다.
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/펠트대조/shoot.cjs <시제품 출력 폴더> <찍을 폴더>
const path = require('node:path'), http = require('node:http'), fs = require('node:fs');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
(async () => {
  const server = http.createServer((q, s) => { const p = decodeURIComponent(new URL(q.url, 'http://x').pathname), f = path.join(root, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f)); }).listen(0);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const result = {};
  const run = async (name, page, query, vp) => {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`${url}${page}?${query}`); await p.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 60000 });
    result[name] = { ...(await p.evaluate(() => __lineup)), errs };
    await p.locator('#stage').screenshot({ path: path.join(out, `${name}.png`) }); await p.close();
  };
  const vp = { width: 1400, height: 700 };
  await run('head-base', 'lineup-head.html', '', vp);
  await run('cur-base', 'lineup-cur.html', '', vp);
  await run('cur-diorama', 'lineup-cur.html', 'felt=diorama', vp);
  await run('head-base-mobile', 'lineup-head.html', 'mobile=1', vp);
  await run('cur-base-mobile', 'lineup-cur.html', 'mobile=1', vp);
  await run('cur-diorama-mobile', 'lineup-cur.html', 'mobile=1&felt=diorama', vp);
  // Close-up: three residents at twice the size, the scale a phone player sees on a zoomed photo.
  const close = 'zoom=2&w=1380&h=600&bx=120&by=560&ids=cafe-owner,companion,researcher';
  await run('head-base-close', 'lineup-head.html', close, { width: 1400, height: 700 });
  await run('cur-diorama-close', 'lineup-cur.html', close + '&felt=diorama', { width: 1400, height: 700 });
  for (const [k, v] of Object.entries(result)) { const { rows, ...rest } = v; console.log(k, JSON.stringify({ rows, ...rest })); }
  console.log('휴대폰 기본 길 구조 같음:', result['head-base-mobile'].structure === result['cur-base-mobile'].structure, '· 화소 같음:', result['head-base-mobile'].pixels === result['cur-base-mobile'].pixels);
  console.log('기본 길 구조 같음:', result['head-base'].structure === result['cur-base'].structure, '· 화소 같음:', result['head-base'].pixels === result['cur-base'].pixels);
  await b.close(); server.close();
})();
