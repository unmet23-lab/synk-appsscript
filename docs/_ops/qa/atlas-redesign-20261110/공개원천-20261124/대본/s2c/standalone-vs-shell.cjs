'use strict';
// 혼자 여는 홈(생활 묶음 content/life-standalone.mjs — brand-opening/home.html이 셸 없이 home.mjs만 부름)과 셸 홈(app-shell)을
// 같은 손님 상태로 띄워 390 · 1440에서 찍는다(설계 주인 11-20 18:30 「혼자 여는 홈과 셸 홈의 화면 대조를 공개 검수 묶음에」).
// home.html은 공개본에 없으므로 master 원천을 synk.im/world/brand-opening/home.html 자리에 내준다(이 대조에서만). 나머지는 덧씌움 폴더 → 라이브.
//   node standalone-vs-shell.cjs <결과 폴더> <덧씌움 폴더…>
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/q1212/Documents/SYNK-appsscript/node_modules'] }));
const [OUT, ...OVER] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const HOME_HTML = fs.readFileSync('D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5/experiences/brand-opening/home.html');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE_TIME = Date.parse('2026-11-21T10:00:00+09:00');
async function shot(kind, width, height) {
  const browser = await chromium.launch({ executablePath: 'C:/Users/q1212/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(({ seed, base }) => {
    let s = seed >>> 0; Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const RealDate = Date, t0 = performance.now(), now = () => base + Math.floor(performance.now() - t0);
    function FakeDate(...a) { if (!new.target) return new RealDate(now()).toString(); return a.length ? new RealDate(...a) : new RealDate(now()); }
    FakeDate.prototype = RealDate.prototype; FakeDate.now = now; FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC; Object.setPrototypeOf(FakeDate, RealDate); globalThis.Date = FakeDate;
  }, { seed: 20261121, base: BASE_TIME });
  const loaded = new Set(), errors = [];
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname !== 'synk.im') return route.abort('blockedbyclient');
    if (!['GET', 'HEAD'].includes(req.method())) return route.abort('blockedbyclient');
    const rel = decodeURIComponent(u.pathname).replace(/^\//, '');
    if (rel === 'world/brand-opening/home.html') return route.fulfill({ status: 200, contentType: TYPES['.html'], body: HOME_HTML });
    for (const root of OVER) { const f = path.join(root, rel); if (fs.existsSync(f) && fs.statSync(f).isFile()) { loaded.add(rel); return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  const reqs = new Set(); page.on('request', r => { const u = new URL(r.url()); if (u.hostname === 'synk.im') reqs.add(u.pathname); });
  await page.goto(kind === 'shell' ? 'https://synk.im/world/?opening=off' : 'https://synk.im/world/brand-opening/home.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let round = 0; round < 14; round++) {
    await sleep(1500);
    const s = await page.evaluate(() => ({ lang: !!document.querySelector('[data-lang-picker]'), hangul: !!document.querySelector('dialog[open] [data-first-hangul]'), tutor: !!document.querySelector('.tutor-option'), ready: document.querySelector('.world-shell')?.dataset.entry === 'ready' })).catch(() => ({}));
    if (s.lang) { await page.locator('[data-lang-choice="ko"]').click().catch(() => {}); await page.locator('[data-lang-confirm]').click().catch(() => {}); continue; }
    if (s.hangul) { await page.locator('dialog[open] [data-first-hangul="reads"]').click().catch(() => {}); continue; }
    if (s.tutor) { await page.locator('.tutor-option[data-tutor-id="mongle"]').first().click().catch(() => {}); await page.locator('.tutor-primary').first().click().catch(() => {}); await sleep(600); await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(() => {}); continue; }
    if (s.ready) break;
  }
  await sleep(3000);
  const tag = `${kind}-${width}`;
  const text = async () => (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ').trim();
  const out = { kind, width, home: await text() };
  await page.screenshot({ path: path.join(OUT, `${tag}-홈.png`) });
  await page.locator('.world-nav [data-view="packs"]').first().click({ timeout: 5000 }).catch(() => {});
  await sleep(3000);
  out.packs = await text();
  await page.screenshot({ path: path.join(OUT, `${tag}-배우기.png`) });
  out.lifeBundle = [...reqs].some(p => p.endsWith('content/life-standalone.mjs'));
  out.shellModules = [...reqs].filter(p => /\/world\/(life-ui|life-progress|world-learning-ui)\.mjs$/.test(p));
  out.errors = errors;
  out.overlay = [...loaded].sort();
  await browser.close();
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(out, null, 1));
  return out;
}
(async () => {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const a = await shot('shell', w, h), b = await shot('standalone', w, h);
    const words = s => new Set(s.split(' '));
    const diff = (x, y) => { const X = words(x), Y = words(y); return { onlyShell: [...X].filter(t => !Y.has(t)).slice(0, 30), onlyStandalone: [...Y].filter(t => !X.has(t)).slice(0, 30) }; };
    console.log(`${w}: 셸 생활 묶음 ${a.lifeBundle} · 셸 모듈 ${a.shellModules.length} / 혼자 생활 묶음 ${b.lifeBundle} · 오류 ${a.errors.length}/${b.errors.length}`);
    console.log('  홈 글 같음', a.home === b.home, JSON.stringify(diff(a.home, b.home)).slice(0, 600));
    console.log('  배우기 글 같음', a.packs === b.packs, JSON.stringify(diff(a.packs, b.packs)).slice(0, 600));
  }
})();
