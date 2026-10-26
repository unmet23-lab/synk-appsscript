// 몽글 대조 판을 열어 기본 길 지문(비교 커밋 == 지금)과 전후 그림을 찍는다.
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/펠트대조/shoot-mongle.cjs <시제품 출력 폴더> <찍을 폴더>
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
  const run = async (name, page, query) => {
    const p = await b.newPage({ viewport: { width: 1000, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`${url}${page}?${query}`); await p.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 90000 });
    result[name] = { ...(await p.evaluate(() => __mongle)), errs }; await p.locator('#stage').screenshot({ path: path.join(out, `${name}.png`) }); await p.close();
  };
  await run('head-base', 'mongle-head.html', ''); await run('cur-base', 'mongle-cur.html', ''); await run('cur-diorama', 'mongle-cur.html', 'felt=diorama');
  await run('head-base-bare', 'mongle-head.html', 'neck='); await run('cur-base-bare', 'mongle-cur.html', 'neck='); await run('cur-diorama-bare', 'mongle-cur.html', 'neck=&felt=diorama');
  await run('cur-base-back', 'mongle-cur.html', 'yaw=3.3'); await run('cur-diorama-back', 'mongle-cur.html', 'felt=diorama&yaw=3.3');
  for (const [k, v] of Object.entries(result)) { const { rows, ...rest } = v; console.log(k, JSON.stringify({ rows, ...rest })); }
  console.log('몽글 기본 길 구조 같음:', result['head-base'].structure === result['cur-base'].structure && result['head-base-bare'].structure === result['cur-base-bare'].structure,
    '· 화소 같음:', result['head-base'].pixels === result['cur-base'].pixels && result['head-base-bare'].pixels === result['cur-base-bare'].pixels);
  await b.close(); server.close();
})();
