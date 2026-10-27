// 까몽 하나를 크게(정면 · 좌34) 찍는다 — experiences 폴더를 정적으로 띄운다.
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/펠트대조/shoot-kkamong.cjs <찍을 폴더> <이름 앞> [experiences 폴더] [추가 질의]
const path = require('node:path'), http = require('node:http'), fs = require('node:fs');
const repo = path.resolve(__dirname, '../../../../..');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve(process.argv[2]), tag = process.argv[3] || 'k', exp = path.resolve(process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : path.join(repo, 'experiences')), extra = process.argv[5] || '';
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json' };
const shot = fs.readFileSync(path.join(__dirname, 'kkamong-shot.mjs'), 'utf8').replace("'../../../../../experiences/synk-world-home/scene-assets/three.module.js'", "'/synk-world-home/scene-assets/three.module.js'");
(async () => {
  const server = http.createServer((q, s) => {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p === '/') { s.writeHead(200, { 'Content-Type': types['.html'] }); return s.end('<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="module" src="/__shot.mjs"></script>'); }
    if (p === '/__shot.mjs') { s.writeHead(200, { 'Content-Type': types['.mjs'] }); return s.end(shot); }
    const f = path.join(exp, p); if (!f.startsWith(exp) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
  }).listen(0);
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const [view, q] of [['front', 'yaw=0&pose=canon'], ['angle', 'yaw=-.62&pose=canon'], ['floor', 'yaw=.25']]) {
    const p = await b.newPage({ viewport: { width: 700, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`http://127.0.0.1:${server.address().port}/?${q}&${extra}`); await p.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 120000 }).catch(() => {});
    await p.screenshot({ path: path.join(out, `${tag}-${view}.png`) }); console.log(view, JSON.stringify(errs.slice(0, 3))); await p.close();
  }
  await b.close(); server.close();
})();
