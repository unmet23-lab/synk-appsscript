#!/usr/bin/env node
// synk.im 쪽마다 움직임(내리며 움직인 요소 수 · 전환) · 누를 것 · 스크립트를 잰다(2026-11-10 전체 판단). node 움직임.cjs
const path = require('node:path');
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const { 화면시험, 닫기 } = require(path.join(repo, 'tools', 'lib', '화면시험.cjs'));
화면시험({ 분: 5 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const p of ['/', '/lab/', '/shift/', '/pulse/', '/path/', '/atlas/']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      const page = await ctx.newPage();
      await page.goto('https://synk.im' + p, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const early = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
      await page.waitForTimeout(2600);
      const r = await page.evaluate(async () => {
        const H = document.documentElement.scrollHeight, VH = innerHeight;
        let moved = 0, maxRun = 0;
        const seen = new Set();
        for (let y = 0; y < H; y += VH * 0.5) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise(r => setTimeout(r, 180));
          const run = document.getAnimations().filter(a => a.playState === 'running');
          maxRun = Math.max(maxRun, run.length);
          run.forEach(a => { const t = a.effect && a.effect.target; if (t && !seen.has(t)) { seen.add(t); moved++; } });
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
        const all = [...document.querySelectorAll('body *')];
        const withTransition = all.filter(e => { const d = getComputedStyle(e).transitionDuration; return d && d.split(',').some(x => parseFloat(x) > 0); }).length;
        const reveal = document.querySelectorAll('.reveal,[data-reveal]').length;
        const sticky = all.filter(e => getComputedStyle(e).position === 'sticky').length;
        const interactive = { button: document.querySelectorAll('button').length, a: document.querySelectorAll('a[href]').length, input: document.querySelectorAll('input,textarea,select').length, details: document.querySelectorAll('details').length, video: document.querySelectorAll('video').length, audio: document.querySelectorAll('audio').length };
        const scripts = [...document.scripts].map(s => (s.src || '').split('/').slice(-1)[0]).filter(Boolean);
        const anims = [...new Set(document.getAnimations().map(a => a.animationName || (a.constructor && a.constructor.name)))].slice(0, 12);
        const cursor = getComputedStyle(document.body).cursor;
        const vt = !!document.querySelector('meta[name="view-transition"]') || [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.cssText.includes('@view-transition')); } catch { return false; } });
        return { 스크롤하며움직인요소: moved, 한번에최대: maxRun, 전환있는요소: withTransition, 전체요소: all.length, reveal, sticky, 누를것: interactive, 스크립트: scripts, 애니이름: anims, 쪽전환: vt };
      });
      console.log(p, '첫 0.4초 움직임', early, JSON.stringify(r));
      await ctx.close();
    }
  } finally { await 닫기(browser); }
});
