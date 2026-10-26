// WORLD의 실제 옷장 무대(wardrobe-stage)와 집 장면(living-home-scene)을 정적으로 띄워 몇 가지 차림으로 찍는다.
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/펠트대조/shoot-world.cjs <찍을 폴더> [폰|-] [experiences 폴더, 기본 저장소의 것]
const path = require('node:path'), http = require('node:http'), fs = require('node:fs');
const repo = path.resolve(__dirname, '../../../../..'), exp = path.resolve(process.argv[4] || path.join(repo, 'experiences'));
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve(process.argv[2]), phone = process.argv[3] === '폰'; fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.hdr': 'application/octet-stream' };
const page = (which, slots, dyes) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#e9dfd0}#host{position:fixed;inset:0}</style><div id="host"></div>
<script type="module">
const slots=${JSON.stringify(slots)},dyes=${JSON.stringify(dyes)},host=document.getElementById('host'),errs=[];addEventListener('error',e=>errs.push(String(e.message)));
try{
 ${which === 'wardrobe'
    ? `const {mountWardrobeStage}=await import('/synk-world-home/wardrobe-stage.mjs');const stage=await mountWardrobeStage(host,{slots,dyes,reducedMotion:true,onError:e=>errs.push(String(e?.message||e))});window.__stage=stage;`
    : `const {mountLivingHomeScene}=await import('/synk-world-home/living-home-scene.mjs');let ready;const p=new Promise(r=>ready=r);const scene=await mountLivingHomeScene(host,{slots,dyes,reducedMotion:true,quality:'balanced',onReady:()=>ready(),onError:e=>errs.push(String(e?.message||e))});await Promise.race([p,new Promise(r=>setTimeout(r,20000))]);window.__scene=scene;`}
}catch(e){errs.push(String(e?.stack||e));}
await new Promise(r=>setTimeout(r,2500));window.__errs=errs;document.documentElement.dataset.ready='1';
</script>`;
(async () => {
  let current = '';
  const server = http.createServer((q, s) => {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p === '/') { s.writeHead(200, { 'Content-Type': types['.html'] }); return s.end(current); }
    const f = path.join(exp, p); if (!f.startsWith(exp) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
  }).listen(0);
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const looks = [['none', {}, {}], ['scarf', { neck: 'mongle-scarf-first-steps' }, {}], ['knit-scarf', { body: 'mongle-knit-butter', neck: 'mongle-scarf-first-steps' }, {}],
    ['cape-muffler', { body: 'mongle-rain-cape', neck: 'mongle-wool-muffler' }, {}], ['overall-bandana', { body: 'mongle-corduroy-overall', neck: 'mongle-bandana-meadow' }, {}],
    ['hanbok-silk-dyed', { body: 'mongle-hanbok-vest', neck: 'mongle-silk-neckerchief' }, { body: ['#a06a8c', '#e6c9a8'] }]];
  const report = [];
  for (const which of ['wardrobe', 'home']) for (const [name, slots, dyes] of which === 'home' ? looks.slice(0, 3) : looks) {
    current = page(which, slots, dyes);
    const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 860 }, deviceScaleFactor: phone ? 2 : 1 });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`http://127.0.0.1:${server.address().port}/`); await p.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 120000 });
    const inner = await p.evaluate(() => window.__errs);
    await p.screenshot({ path: path.join(out, `${which}-${name}${phone ? '-phone' : ''}.png`) });
    report.push({ which, name, errs: [...inner, ...errs].filter(e => !/favicon/.test(e)).slice(0, 4) }); await p.close();
  }
  for (const r of report) console.log(JSON.stringify(r));
  await b.close(); server.close();
})();
