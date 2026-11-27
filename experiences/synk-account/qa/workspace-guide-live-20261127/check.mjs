// 공개 주소를 열고 후보 platform.js만 끼워 1440 · 390에서 「PC 앱 받기」 · 「여는 법」 창 · 「도움말」 · Workspace 상세를 잰다(2026-11-27).
//   node check.mjs <후보 폴더 | -> <캡처 폴더>     후보 자리에 -를 주면 끼우지 않고 공개본을 잰다.
// 후보의 새 ?v= 주소는 부르지 않는다(공개 전에 부르면 CDN이 옛 내용을 그 주소로 묶는다). 라이브는 ?from=qa로 연다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [cand, shots] = process.argv.slice(2);
if (!shots) { console.error('쓰기: node check.mjs <후보 폴더 | -> <캡처 폴더>'); process.exit(2); }
fs.mkdirSync(shots, { recursive: true });
const swap = cand === '-' ? null : fs.readFileSync(path.join(cand, 'account/dist/platform.js'));
const OLD = ['설치 파일 준비', '그 안에서 골라 설치', 'PC 앱 안에서 설치하는 앱', 'Workspace는 PC 앱 안에서 설치', 'SYNK PC 앱 안에서 골라 설치', 'Workspace 앱을 이미 설치한'];
const browser = await chromium.launch({ channel: 'chrome' });
const result = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  if (swap) await context.route('https://synk.im/account/dist/platform.js*', route => route.fulfill({ body: swap, contentType: 'text/javascript; charset=utf-8' }));
  const page = await context.newPage(); const bad = [];
  page.on('pageerror', e => bad.push('오류 ' + e.message)); page.on('console', m => m.type() === 'error' && bad.push('콘솔 ' + m.text().slice(0, 160)));
  page.on('response', r => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
  page.on('requestfailed', r => bad.push('실패 ' + r.url()));
  await page.goto('https://synk.im/account/platform.html?from=qa', { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.mouse.click(w / 2, h / 2); await page.waitForTimeout(3500);
  await page.locator('text=로그인 없이 둘러보기').locator('visible=true').first().click(); await page.waitForTimeout(3000);
  await page.locator('text=플랫폼 홈으로 가기').locator('visible=true').first().click(); await page.waitForTimeout(2500);
  const measure = async (name, extra = {}) => {
    const m = await page.evaluate(old => {
      const body = document.querySelector('#page-content') || document.body;
      const text = body.innerText.replace(/\s+/g, ' ');
      return {
        over: document.documentElement.scrollWidth - innerWidth,
        brokenImages: [...document.images].filter(img => img.complete && img.currentSrc && img.naturalWidth === 0 && img.getBoundingClientRect().width > 0).map(img => img.currentSrc),
        oldWords: old.filter(word => document.body.innerText.includes(word)),
        text: text.slice(0, 600),
      };
    }, OLD);
    await page.screenshot({ path: path.join(shots, `${name}-${w}.png`) });
    await page.screenshot({ path: path.join(shots, `${name}-full-${w}.png`), fullPage: true });
    result.push({ name, w, ...m, bad: bad.splice(0), ...extra });
  };
  await page.evaluate(() => { location.hash = '#downloads'; }); await page.waitForTimeout(1800);
  await measure('downloads', { rows: await page.evaluate(() => [...document.querySelectorAll('.download-row')].map(row => row.innerText.replace(/\s+/g, ' '))) });
  const open = page.locator('.download-row button[data-action="install-info"]').first();
  if (await open.count()) { await open.scrollIntoViewIfNeeded(); await open.click(); await page.waitForTimeout(800);
    await measure('install-info', { dialog: await page.evaluate(() => [...document.querySelectorAll('dialog[open],[role="dialog"]')].map(d => d.innerText.replace(/\s+/g, ' ')).join(' | ')) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await page.evaluate(() => { location.hash = '#help'; }); await page.waitForTimeout(1500);
  await measure('help');
  await page.evaluate(() => { location.hash = '#app/messenger'; }); await page.waitForTimeout(1500);
  const tab = page.locator('#page-content button:has-text("설치 안내"),#page-content a:has-text("설치 안내")').first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(800); }
  await measure('app-messenger-requirements');
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(shots, 'check.json'), JSON.stringify(result, null, 1));
for (const r of result) console.log(JSON.stringify(r));
