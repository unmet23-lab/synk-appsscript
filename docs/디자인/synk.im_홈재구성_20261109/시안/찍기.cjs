#!/usr/bin/env node
// 시안 · 공개본 찍기와 재기(2026-11-09). 쓰기: node 찍기.cjs <주소> <저장 폴더> [접두어] — 1440×900 · 1280×720 · 390×844에서 첫 화면과 쪽 전체, 구역 길이 · 글자 수 · 콘솔 오류 · 넘침을 잰다.
const path = require('node:path');
const fs = require('node:fs');
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));

(async () => {
  const [url, out, pre = 'a'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};
  for (const [w, h, name, mobile] of [[1440, 900, 'd', false], [1280, 720, 's', false], [390, 844, 'm', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('requestfailed', r => failed.push(r.url().slice(0, 120)));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, `${pre}-${name}-first.png`) });
    await page.screenshot({ path: path.join(out, `${pre}-${name}-full.jpg`), fullPage: true, type: 'jpeg', quality: 80 });
    report[name] = await page.evaluate(() => {
      const clean = s => (s || '').replace(/\s+/g, ' ').trim();
      const VH = innerHeight, H = document.documentElement.scrollHeight;
      const secs = [...document.querySelectorAll('main > *, body > footer')].filter(e => e.getBoundingClientRect().height > 40).map(e => { const r = e.getBoundingClientRect(); return `${e.id || e.className.toString().split(' ')[0]} ${Math.round(r.top + scrollY)}+${Math.round(r.height)} (${clean(e.innerText).length}자)`; });
      const over = [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.hs-map,.hs-stages,.gate-sky,.gate-roof,[aria-hidden="true"]'); }).slice(0, 6).map(e => e.tagName + '.' + e.className.toString().slice(0, 30));
      const nav = [...document.querySelectorAll('header .bar-inner a, header .bar-inner button')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().width > 0).map(e => clean(e.innerText || e.getAttribute('aria-label'))).filter(Boolean);
      return { 화면수: +(H / VH).toFixed(1), 높이: H, 글자: clean(document.body.innerText).length, 구역: secs, 넘침: over, 메뉴: nav, 가로스크롤: document.documentElement.scrollWidth > innerWidth };
    });
    report[name].오류 = errors.slice(0, 6); report[name].실패요청 = failed.slice(0, 6);
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})();
