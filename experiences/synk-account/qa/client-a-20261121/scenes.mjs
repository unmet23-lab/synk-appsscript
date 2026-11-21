// WORLD 앱 창(client.html?product=world)을 PC 앱 다리(window.synkDesktop)를 흉내 내어 장면마다 찍고 잰다.
// 작업본 experiences/synk-account를 https://synk.im/account/ 자리에 그대로 싣는다. 계정 · 로그인 요청은 모두 합성이고 바깥으로 나가지 않는다.
// node experiences/synk-account/qa/client-a-20261121/scenes.mjs <playwright 폴더> <나갈 폴더> [장면,…] [--live]
//   --live: 작업본 대신 공개본 https://synk.im/ 을 그대로 연다(바깥 요청은 계정 · 로그인 합성만 막음).
//   --후보 <폴더>: --live와 함께, <폴더>/account/… 에 있는 파일은 공개본 대신 그 파일로 돌려준다(공개 전 후보 확인 — 새 ?v= 주소가 synk.im에 닿지 않는다).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const account = path.join(root, 'experiences/synk-account');
const hub = path.join(root, 'experiences/learning-hub');
const args = process.argv.slice(2);
const live = args.includes('--live');
const candIndex = args.indexOf('--후보'), candidate = candIndex >= 0 ? path.resolve(args[candIndex + 1]) : null;
const [playwrightDir, outArg, only] = args.filter((a, i) => !a.startsWith('--') && !(candIndex >= 0 && i === candIndex + 1));
if (!playwrightDir || !outArg) { console.error('usage: scenes.mjs <playwright 폴더> <나갈 폴더> [장면,…] [--live]'); process.exit(2); }
const out = path.resolve(outArg);fs.mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
import { SCENES, answer, bridge } from './synthetic.mjs';
const names = only ? only.split(',') : Object.keys(SCENES);
const WIDTHS = [1440, 390];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
function local(dir, rel) {
  const file = path.join(dir, decodeURIComponent(rel));
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  return { body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' };
}
const report = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const name of names) {
    const scene = SCENES[name];if (!scene) throw new Error(`장면 없음: ${name}`);
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: width > 600 ? 1000 : 844 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
      const errors = [], unknown = [], external = [], sheets = [];
      await context.exposeBinding('__synthRequest', (_src, op, params) => answer(scene, op, params, unknown));
      await context.addInitScript(bridge, { auth: scene.auth });
      await context.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (u.pathname.endsWith('.css')) sheets.push(u.pathname);
        if (!live && u.origin === 'https://synk.im' && u.pathname.startsWith('/account/')) {
          const hit = local(account, u.pathname.slice('/account/'.length));
          return hit ? route.fulfill({ status: 200, headers: { 'Content-Type': hit.contentType }, body: hit.body }) : route.fulfill({ status: 404, body: '' });
        }
        if (!live && u.origin === 'https://synk.im' && u.pathname.startsWith('/learning-hub/')) {
          const hit = local(hub, u.pathname.slice('/learning-hub/'.length));
          return hit ? route.fulfill({ status: 200, headers: { 'Content-Type': hit.contentType }, body: hit.body }) : route.fulfill({ status: 404, body: '' });
        }
        if (u.origin === 'https://synk.im' && live && candidate) {
          const hit = local(candidate, u.pathname.slice(1));
          if (hit) return route.fulfill({ status: 200, headers: { 'Content-Type': hit.contentType }, body: hit.body });
        }
        if (u.origin === 'https://synk.im' && live) return route.continue();
        if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
        external.push(u.origin + u.pathname);
        return route.fulfill({ status: 404, body: '' });
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(String(e.message || e)));
      page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      await page.goto('https://synk.im/account/client.html?product=world', { waitUntil: 'load' });
      await page.waitForTimeout(name.startsWith('signed-in') || name === 'load-fail' ? 1800 : 700);
      await page.evaluate(() => document.fonts?.ready);
      const file = `${name}-${width}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      const m = await page.evaluate(() => {
        const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const small = [...document.querySelectorAll('button,a,input,select,summary,label.toggle')].filter(visible).filter(el => { const r = el.getBoundingClientRect();return r.height < 44 && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline') && !(el.tagName === 'INPUT' && el.closest('label') && el.closest('label').getBoundingClientRect().height >= 44); }).map(el => `${el.tagName.toLowerCase()}「${(el.textContent || el.value || '').trim().slice(0, 24)}」${Math.round(el.getBoundingClientRect().height)}`);
        const texts = [...document.querySelectorAll('body *')].filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
        const sizes = [...new Set(texts.map(el => getComputedStyle(el).fontSize))].sort();
        const weights = [...new Set(texts.map(el => getComputedStyle(el).fontWeight))].sort();
        const fonts = [...new Set(texts.map(el => getComputedStyle(el).fontFamily.split(',')[0].trim()))];
        const odd = texts.filter(el => { const c = getComputedStyle(el);return !['13px', '15px', '17px', '22px', '34px'].includes(c.fontSize) || !['400', '600'].includes(c.fontWeight); }).map(el => `${el.tagName.toLowerCase()}.${el.className}「${el.textContent.trim().slice(0, 20)}」${getComputedStyle(el).fontSize}/${getComputedStyle(el).fontWeight}`).slice(0, 12);
        const imgs = [...document.querySelectorAll('*')].filter(visible).filter(el => /url\(/.test(getComputedStyle(el).backgroundImage)).map(el => el.className || el.tagName).slice(0, 12);
        return { overflow, small, sizes, weights, fonts, odd, felt: imgs, notice: document.getElementById('notice')?.textContent || '', connect: document.getElementById('connect')?.hidden ? null : document.getElementById('connect')?.textContent };
      });
      if (process.env.DUMP) fs.writeFileSync(path.join(out, `${name}-${width}.html`), await page.evaluate(() => document.body.outerHTML));
      report.push({ scene: name, width, file, errors, sheets: [...new Set(sheets)], unknown: [...new Set(unknown)], external: [...new Set(external)], ...m });
      await context.close();
    }
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
for (const r of report) console.log(`${r.scene} ${r.width} 넘침 ${r.overflow} · 44 미만 ${r.small.length} · 크기 ${r.sizes.join('/')} · 굵기 ${r.weights.join('/')} · 글꼴 ${r.fonts.join('/')} · 그림바탕 ${r.felt.length} · 오류 ${r.errors.length}${r.odd.length ? ' · 벗어난 글 ' + r.odd.join(' ') : ''}${r.unknown.length ? ' · 없는 요청 ' + r.unknown.join(',') : ''}${r.external.length ? ' · 바깥 ' + r.external.length : ''} · 스타일 ${r.sheets.join(',')}`);
