#!/usr/bin/env node
// 뼈대 시안 · 공개본을 같은 조건으로 찍는다(2026-11-10). 하늘이 시각에 따라 바뀌므로 시각을 박아 둔다(기본 05:20 = 11-10 공개본 맹검 때와 같은 노을).
//   node 찍기.cjs <d|m> <이름=경로[@세로위치,…]> …
//     d = 1440×900 · m = 390×844(2배). 세로위치는 px, 「#id」(그 요소가 메뉴 아래 88px에 오게), 「all」(화면 단위로 끝까지). 없으면 첫 화면만.
//   ORIGIN=http://127.0.0.1:4798 (기본) 또는 https://synk.im · OUTDIR=<폴더> · AT=HH:MM(서울)
//   Git Bash에서는 경로가 /로 시작하니 MSYS_NO_PATHCONV=1을 붙인다.
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const { 화면시험, 닫기 } = require(path.join(repo, 'tools', 'lib', '화면시험.cjs'));
const OUT = path.resolve(process.env.OUTDIR || path.join(os.tmpdir(), 'synk-skeleton-shoot'));
fs.mkdirSync(OUT, { recursive: true });
const [mode, ...targets] = process.argv.slice(2);
const VIEW = mode === 'm' ? { w: 390, h: 844, mobile: true, dpr: 2 } : { w: 1440, h: 900, mobile: false, dpr: 1 };
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:4798';
const AT = process.env.AT || '05:20';

화면시험({ 분: 8 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const t of targets) {
      const name = t.slice(0, t.indexOf('=')); let p = t.slice(t.indexOf('=') + 1), spots = ['0'];
      if (p.includes('@')) { spots = p.slice(p.indexOf('@') + 1).split(','); p = p.slice(0, p.indexOf('@')); }
      const ctx = await browser.newContext({ viewport: { width: VIEW.w, height: VIEW.h }, deviceScaleFactor: VIEW.dpr, isMobile: VIEW.mobile, hasTouch: VIEW.mobile, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror ' + String(e).slice(0, 200)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      await page.clock.setFixedTime(new Date(`2026-11-10T${AT}:00+09:00`));
      await page.goto(ORIGIN + p, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1800);
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      if (spots[0] === 'all') spots = Array.from({ length: Math.ceil(H / VIEW.h) }, (_, i) => String(i * VIEW.h));
      let n = 0;
      for (const s of spots) {
        const y = s.startsWith('#') ? await page.evaluate(sel => { const e = document.querySelector(sel); return e ? Math.max(0, Math.round(e.getBoundingClientRect().top + scrollY - 88)) : 0; }, s) : +s;
        await page.evaluate(yy => window.scrollTo({ top: yy, behavior: 'instant' }), y);
        await page.waitForTimeout(n ? 1300 : 500);
        await page.screenshot({ path: path.join(OUT, `${name}-${mode}-${String(n++).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 80 });
      }
      const over = await page.evaluate(() => ({ 가로넘침: document.documentElement.scrollWidth > innerWidth + 1, 화면수: +(document.documentElement.scrollHeight / innerHeight).toFixed(1) }));
      console.log(`${name}-${mode}: ${n}장 · ${over.화면수}화면 · 가로넘침 ${over.가로넘침} · 오류 ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
      await ctx.close();
    }
  } finally { await 닫기(browser); }
});
