#!/usr/bin/env node
// 학습자 칸 시안 · 공개본을 같은 조건으로 찍는다(2026-11-16).
//   node 찍기.cjs <d|m> <낼 폴더> <이름=주소> …
//   d = 1440×900(1배), m = 390×844(2배). 이름마다:
//     <이름>-<d|m>-first.png  학습자 칸 머리가 메뉴 아래에 온 첫눈 한 화면
//     <이름>-<d|m>-sec.png    학습자 칸 전체(요소 그림)
//     <이름>-m-1.png, -2.png …  (휴대폰만) 학습자 칸을 화면 단위로 자른 것 — 긴 그림 한 장은 맹검에서 글자가 뭉개졌다(6단계)
//     <이름>-<d|m>.json       칸 높이 · 쪽 본문 길이(질문창 「무엇이든 물어보세요」 앞까지, 화면 수) · 가로 넘침 · 콘솔 오류
const path = require('node:path'), fs = require('node:fs');
const repo = 'C:/Users/q1212/Documents/SYNK-appsscript';
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const [mode, OUT, ...targets] = process.argv.slice(2);
const V = mode === 'm' ? { w: 390, h: 844, mobile: true, dpr: 2 } : { w: 1440, h: 900, mobile: false, dpr: 1 };
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const t of targets) {
      const name = t.slice(0, t.indexOf('=')), url = t.slice(t.indexOf('=') + 1);
      const ctx = await browser.newContext({ viewport: { width: V.w, height: V.h }, deviceScaleFactor: V.dpr, isMobile: V.mobile, hasTouch: V.mobile, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push('pageerror ' + String(e).slice(0, 200)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      await page.clock.setFixedTime(new Date('2026-11-16T15:00:00+09:00'));
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(() => { for (const i of document.querySelectorAll('img')) i.loading = 'eager'; });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.querySelectorAll('#learner img')].filter(i => i.offsetParent).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 20000 }).catch(() => errors.push('그림을 다 못 읽음'));
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const s = document.getElementById('learner'), r = s.getBoundingClientRect();
        const ask = [...document.querySelectorAll('h2,h3,p,label,span')].find(e => /무엇이든 물어보세요/.test(e.textContent) && e.offsetParent);
        const block = ask ? ask.closest('section') || ask : null;
        const bar = document.querySelector('.bar'), bb = bar ? bar.getBoundingClientRect().bottom : 0;
        return { top: r.top + scrollY, h: r.height, page: document.documentElement.scrollHeight, body: block ? block.getBoundingClientRect().top + scrollY : null, over: document.documentElement.scrollWidth - innerWidth, bar: bb };
      });
      m.bodyScreens = m.body ? +(m.body / V.h).toFixed(2) : null; m.errors = errors;
      const gap = V.mobile ? 64 : 76; // 메뉴 아래
      await page.evaluate(y => scrollTo(0, y), Math.max(0, m.top - gap));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${name}-${mode}-first.png`) });
      await page.locator('#learner').screenshot({ path: path.join(OUT, `${name}-${mode}-sec.png`) });
      if (V.mobile) {
        const step = V.h - gap - 40; let i = 1;
        for (let y = m.top - gap; y < m.top + m.h - 60; y += step, i++) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${name}-m-${i}.png`) }); }
        m.slices = i - 1;
      }
      fs.writeFileSync(path.join(OUT, `${name}-${mode}.json`), JSON.stringify(m, null, 1));
      console.log(name, mode, JSON.stringify(m));
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
