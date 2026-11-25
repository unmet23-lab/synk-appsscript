// 공개 주소를 열고 후보 파일만 끼워 1440 · 390에서 캡처와 오류 · 넘침 · PATH 링크를 잰다.
//   node check.mjs <후보 폴더 | -> <캡처 폴더>     후보 자리에 -를 주면 끼우지 않고 공개본을 잰다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [cand, shots] = process.argv.slice(2);
fs.mkdirSync(shots, { recursive: true });
const files = cand === '-' ? {} : {
  '/account/dist/platform.js': ['account/dist/platform.js', 'text/javascript'],
  '/path/': ['path/index.html', 'text/html'], '/en/path/': ['en/path/index.html', 'text/html'],
};
const APP = 'https://synk.im/path/app/';
const browser = await chromium.launch({ channel: 'chrome' });
const result = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('https://synk.im/**', route => {
    const hit = files[new URL(route.request().url()).pathname];
    return hit ? route.fulfill({ body: fs.readFileSync(path.join(cand, hit[0])), contentType: hit[1] + '; charset=utf-8' }) : route.continue();
  });
  const open = async url => {
    const page = await context.newPage(); const bad = [];
    page.on('pageerror', e => bad.push('오류 ' + e.message)); page.on('console', m => m.type() === 'error' && bad.push('콘솔 ' + m.text().slice(0, 160)));
    page.on('response', r => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(2500); return { page, bad };
  };
  const done = async (name, { page, bad }, extra = {}) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.screenshot({ path: path.join(shots, `${name}-${w}.png`) });
    result.push({ name, w, over, bad: [...bad], ...extra });
  };
  // 첫 화면 → 로그인 없이 둘러보기 → 시작할 서비스 선택
  let v = await open('https://synk.im/account/platform.html');
  await v.page.mouse.click(w / 2, h / 2); await v.page.waitForTimeout(3500);
  await v.page.locator('text=로그인 없이 둘러보기').locator('visible=true').first().click(); await v.page.waitForTimeout(3000);
  await done('portal', v, { text: await v.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 260)) });
  await v.page.locator('text=플랫폼 홈으로 가기').locator('visible=true').first().click(); await v.page.waitForTimeout(2500);
  await done('home', v, { pathLinks: await v.page.evaluate(() => [...document.querySelectorAll('#page-content a[href*="/path/"],#page-content [data-shortcut="path"]')].map(a => a.innerText.trim() + ' ' + (a.href || ''))), note: await v.page.evaluate(() => document.querySelector('.shelf-note')?.innerText) });
  for (const hash of ['#discover', '#app/path']) {
    await v.page.evaluate(x => { location.hash = x; }, hash); await v.page.waitForTimeout(1500);
    await done(hash.replace(/\W/g, ''), v, { pathLinks: await v.page.evaluate(() => [...document.querySelectorAll('#page-content a[href*="synk.im/path"]')].map(a => a.innerText.trim() + ' ' + a.href)) });
  }
  await v.page.screenshot({ path: path.join(shots, `apppath-full-${w}.png`), fullPage: true });
  await v.page.locator('#page-content button:has-text("이용 안내")').click(); await v.page.waitForTimeout(800);
  await done('apppath-guide', v);
  await v.page.screenshot({ path: path.join(shots, `apppath-guide-full-${w}.png`), fullPage: true });
  await v.page.close();
  // 포털의 PATH를 누르면 어디로 가나
  v = await open('https://synk.im/account/platform.html');
  await v.page.mouse.click(w / 2, h / 2); await v.page.waitForTimeout(3500);
  await v.page.locator('text=로그인 없이 둘러보기').locator('visible=true').first().click(); await v.page.waitForTimeout(3000);
  await v.page.locator('text=/^PATH$/').locator('visible=true').first().click(); await v.page.waitForTimeout(5000);
  await done('portal-click', v, { landed: v.page.url() });
  if (cand !== '-') assert.equal(v.page.url().split('#')[0], APP);
  await v.page.close();
  for (const [name, url] of [['path-ko', 'https://synk.im/path/'], ['path-en', 'https://synk.im/en/path/']]) {
    v = await open(url); await done(name, v, { links: await v.page.evaluate(() => [...document.querySelectorAll('a[href$="/path/app/"]')].map(a => a.innerText.trim() + ' ' + Math.round(a.getBoundingClientRect().width) + 'x' + Math.round(a.getBoundingClientRect().height))) });
    await v.page.evaluate(() => document.querySelector('#road-title').scrollIntoView({ block: 'start' })); await v.page.waitForTimeout(1500); await v.page.mouse.wheel(0, -100); await v.page.waitForTimeout(1200);
    await done(name + '-road', v); await v.page.close();
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(shots, 'check.json'), JSON.stringify(result, null, 1));
for (const r of result) console.log(JSON.stringify(r));
