// 시안을 찍는다. node shot.mjs <주소 경로> <이름> [d|m] [기다림ms] [스크립트]
// 넘침 · 13px 미만 한글 · 콘솔 오류 · 실패 요청을 재고 저장소 밖 폴더에 그림을 남긴다.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
const HOME = homedir().replaceAll('\\', '/');
const require = createRequire(`${HOME}/Documents/SYNK-appsscript/package.json`);
const { chromium } = require('playwright');
const [urlPath, name, mode = 'd', wait = '2500', act = ''] = process.argv.slice(2);
const OUT = `${HOME}/Documents/synk-vendor/pulse-rebuild-20261104/shots/`; mkdirSync(OUT, { recursive: true });
const BASE = process.env.SIAN_BASE || 'http://127.0.0.1:4793';
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle'] });
const viewport = mode === 'm' ? { width: 390, height: 844 } : mode === 'l' ? { width: 1280, height: 720 } : { width: 1440, height: 900 };
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'ko-KR', isMobile: mode === 'm', hasTouch: mode === 'm' });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror ' + e.message.slice(0, 240)));
page.on('console', (m) => { if (m.type() === 'error') problems.push('console ' + m.text().slice(0, 240)); });
page.on('requestfailed', (r) => { if (!/\.mp4/.test(r.url())) problems.push('failed ' + r.url().slice(-80)); });
page.on('response', (r) => { if (r.status() >= 400) problems.push(r.status() + ' ' + r.url().slice(-90)); });
await page.goto(BASE + urlPath, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(Number(wait));
const snap = async (suffix = '') => {
  await page.screenshot({ path: `${OUT}${mode}-${name}${suffix}.jpg`, type: 'jpeg', quality: 82 });
  const m = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, bad = [];
    const wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.right > vw + 1 && r.width > 0 && r.height > 0 && s.position !== 'fixed' && !el.closest('[data-allow-overflow],.stage,.films,.wall,.sheetwall'); }).slice(0, 3).map((el) => String(el.className || el.tagName).slice(0, 30));
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (!/[가-힣]/.test(t)) continue; const el = w.currentNode.parentElement; if (!el || el.closest('.sr,[aria-hidden=true]')) continue; const s = getComputedStyle(el), r = el.getBoundingClientRect(); if (r.width && parseFloat(s.fontSize) < 13) bad.push(`${s.fontSize} ${t.slice(0, 14)}`); }
    const texts = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.01; };
    while (tw.nextNode()) { const t = tw.currentNode.textContent.trim(); if (t.length < 2) continue; const el = tw.currentNode.parentElement; if (!el || el.closest('.sr') || !vis(el)) continue; texts.push({ n: t.split(/\s+/).length, fs: Math.round(parseFloat(getComputedStyle(el).fontSize)) }); }
    const media = [...document.querySelectorAll('video,img,canvas,svg')].filter(vis).map((el) => { const r = el.getBoundingClientRect(); const x = Math.max(0, r.left), y = Math.max(0, r.top), X = Math.min(vw, r.right), Y = Math.min(vh, r.bottom); return Math.round(Math.max(0, X - x) * Math.max(0, Y - y) / (vw * vh) * 100); }).sort((a, b) => b - a);
    return { sw: document.documentElement.scrollWidth, wide, bad: bad.slice(0, 5), sizes: [...new Set(texts.map((t) => t.fs))].sort((a, b) => b - a), words: texts.reduce((a, t) => a + t.n, 0), media: media.slice(0, 2), vids: [...document.querySelectorAll('video')].map((v) => `${v.paused ? 'P' : 'R'}${v.readyState}`).join(',') };
  });
  console.log(`${mode}-${name}${suffix}`, JSON.stringify(m));
};
await snap();
if (act) { const fn = new Function('page', 'snap', `return (async()=>{${act}})()`); await fn(page, snap); }
if (problems.length) console.log('PROBLEMS', problems.join(' | '));
await browser.close();
process.exit(0);
