// 옷 맞음 판을 묶어 열고(v3 · 펠트 판 몽글 × 옷 하나씩 · 몇 가지 겹쳐 입기), 뚫림 표와 앞 · 뒤 그림을 낸다.
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/펠트대조/shoot-wardrobe.cjs <찍을 폴더>
const path = require('node:path'), http = require('node:http'), fs = require('node:fs');
const repo = path.resolve(__dirname, '../../../../..'), home = path.join(repo, 'experiences/synk-world-home');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const esbuild = require(path.join(repo, 'node_modules/esbuild'));
const out = path.resolve(process.argv[2]); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
(async () => {
  // Bundled next to the WORLD home folder's assets, so the avatar's import.meta.url finds its felt and textile images.
  const bundle = path.join(home, `wardrobe-fit.__check_${process.pid}.js`);
  await esbuild.build({ entryPoints: [path.join(__dirname, 'wardrobe-fit.mjs')], bundle: true, format: 'esm', outfile: bundle, target: 'es2022' });
  const server = http.createServer((q, s) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p === '/') { s.writeHead(200, { 'Content-Type': types['.html'] }); return s.end(`<!doctype html><meta charset="utf-8"><body><script type="module" src="/${path.basename(bundle)}"></script>`); }
    const f = path.join(home, p); if (!f.startsWith(home) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
  }).listen(0);
  try {
    const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const p = await b.newPage({ viewport: { width: 400, height: 400 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`http://127.0.0.1:${server.address().port}/`); await p.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 600000 });
    const r = await p.evaluate(() => __fit);
    for (const [k, url] of Object.entries(r.shots)) fs.writeFileSync(path.join(out, k.replace(/\|/g, '__') + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(out, 'fit.json'), JSON.stringify(r.items, null, 1));
    const rows = {}; for (const it of r.items) (rows[it.outfit] ??= {})[it.version] = it;
    console.log('옷 | v3 뚫림% (깊이 12mm+%) 최대mm 평균 뜸mm | 펠트 판 뚫림% (깊이) 최대mm 평균 뜸mm');
    for (const [id, v] of Object.entries(rows)) console.log(`${id} | ${v.v3.insidePct} (${v.v3.deepPct}) ${v.v3.maxInMm} ${v.v3.meanGapMm} | ${v.felt.insidePct} (${v.felt.deepPct}) ${v.felt.maxInMm} ${v.felt.meanGapMm}`);
    console.log('오류:', JSON.stringify(errs.slice(0, 5)));
    await b.close();
  } finally { server.close(); fs.rmSync(bundle, { force: true }); }
})();
