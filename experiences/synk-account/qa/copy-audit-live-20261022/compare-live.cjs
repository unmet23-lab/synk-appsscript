// 공개 웹 플랫폼(https://synk.im/account/platform.html)의 보이는 줄을 경로마다 다른 판과 견준다(로그인 전, 1440·390).
//   node compare-live.cjs master            — 이 작업본 experiences/synk-account를 이 PC에서 띄운 master 판과 견준다
//                                              (이 PC 주소라 「이 PC에서 열기」·Workspace 웹 입구·다운로드 표는 주소 탓으로 다르다)
//   node compare-live.cjs candidate <폴더>   — 실제 공개 주소에서 후보 파일만 바꿔 끼워 견준다
//                                              (<폴더>의 account__dist__platform.js·account__platform.html·id__dist__app.js·id__index.html 중 있는 것)
// 라이브에만 있는 줄 = 공개에 남은 옛 글(또는 공개본에만 있는 화면), 다른 판에만 있는 줄 = 새 글(또는 미공개 기능). 콘솔 오류·가로 넘침도 센다.
// 2026-10-22 플랫폼 글 전수조사 공개 뒤 남은 옛 글을 찾고(master), 문자열 값만 얹은 후보를 확인할 때(candidate) 썼다 — synk-policy 7f62c9c.
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), https = require('node:https'), os = require('node:os');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [mode = 'master', dir] = process.argv.slice(2);
const LIVE = 'https://synk.im/account/platform.html', root = path.resolve(__dirname, '..', '..');
const routes = ['', '#discover', '#library', '#benefits', '#benefits/care', '#benefits/fortune', '#benefits/insight', '#benefits/ai-subscriptions', '#app/world', '#app/messenger', '#app/path', '#downloads', '#updates', '#settings'];
const files = { '/account/dist/platform.js': 'account__dist__platform.js', '/account/platform.html': 'account__platform.html', '/id/dist/app.js': 'id__dist__app.js', '/id/index.html': 'id__index.html', '/id/': 'id__index.html' };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const get = url => new Promise((resolve, reject) => https.get(url, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks))); }).on('error', reject));
async function collect(browser, base, width, prepare) {
  const page = await browser.newPage({ viewport: { width, height: width > 500 ? 1000 : 844 } });
  if (prepare) await prepare(page);
  const errors = [], overflow = [], out = {};
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
  await page.goto(base + '?probe=compare-' + Date.now(), { waitUntil: 'networkidle' });
  for (const r of routes) {
    await page.evaluate(h => { location.hash = h; }, r);
    await page.waitForTimeout(900);
    out[r || '#home'] = (await page.evaluate(() => document.body.innerText)).split(/\n+/).map(s => s.trim()).filter(s => s && /[가-힣]/.test(s));
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (extra > 0) overflow.push(r + ' ' + extra + 'px');
  }
  await page.close();
  return { out, errors, overflow };
}
(async () => {
  let base = LIVE, prepare = null, server = null;
  if (mode === 'master') {
    const config = await get('https://synk.im/account/config.json');
    server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/account\//, '') || 'platform.html';
      if (rel === 'config.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(config); }
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + server.address().port + '/account/platform.html';
  } else if (mode === 'candidate' && dir) {
    prepare = async page => {
      for (const [pathname, name] of Object.entries(files)) {
        const file = path.join(path.resolve(dir), name);
        if (!fs.existsSync(file)) continue;
        await page.route(url => { const u = new URL(url); return u.origin === 'https://synk.im' && u.pathname === pathname; }, route => route.fulfill({ status: 200, contentType: types[path.extname(name)], body: fs.readFileSync(file) }));
      }
    };
  } else throw Error('node compare-live.cjs master | candidate <폴더>');
  const browser = await chromium.launch({ channel: 'chrome' });
  const report = {};
  for (const width of [1440, 390]) {
    const live = await collect(browser, LIVE, width), other = await collect(browser, base, width, prepare);
    const changed = {};
    for (const r of Object.keys(live.out)) {
      const L = new Set(live.out[r]), O = new Set(other.out[r]);
      const liveOnly = [...L].filter(x => !O.has(x)), otherOnly = [...O].filter(x => !L.has(x));
      if (liveOnly.length || otherOnly.length) changed[r] = { liveOnly, otherOnly };
    }
    report[width] = { errors: { live: live.errors, [mode]: other.errors }, overflow: { live: live.overflow, [mode]: other.overflow }, routes: changed };
  }
  await browser.close(); server?.close();
  const file = path.join(os.tmpdir(), 'synk-account-compare-' + mode + '.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  for (const [width, v] of Object.entries(report)) {
    console.log('== ' + width + ' 오류 ' + JSON.stringify(v.errors) + ' 넘침 ' + JSON.stringify(v.overflow));
    for (const [r, d] of Object.entries(v.routes)) { console.log(' ' + r); for (const x of d.liveOnly) console.log('   - 라이브: ' + x.slice(0, 140)); for (const x of d.otherOnly) console.log('   + ' + mode + ': ' + x.slice(0, 140)); }
  }
  console.log('결과 ' + file);
})();
