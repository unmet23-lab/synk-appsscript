#!/usr/bin/env node
// 뼈대 관문 감사(2026-11-10): 보이는 글 덩어리 가운데 단계 밖 크기 · 넷 밖 굵기 · 모노 · 영문 대문자를 어디에 있는지와 함께 적는다. 재는 법은 ../../synk.im_전체판단_20261110/재기/찍기.cjs와 같다.
//   node 글자감사.cjs <d|m> <경로> …      ORIGIN=http://127.0.0.1:4798(기본)
const path = require('node:path');
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const { 화면시험, 닫기 } = require(path.join(repo, 'tools', 'lib', '화면시험.cjs'));
const [mode, ...paths] = process.argv.slice(2);
const VIEW = mode === 'm' ? { w: 390, h: 844, mobile: true, dpr: 2 } : { w: 1440, h: 900, mobile: false, dpr: 1 };
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:4798';
const 단계 = mode === 'm' ? [13, 15, 17, 19, 22, 27, 33] : [13, 15, 17, 21, 28, 40, 64];
const 굵기 = ['400', '500', '600', '700'];

화면시험({ 분: 6 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const p of paths) {
      const ctx = await browser.newContext({ viewport: { width: VIEW.w, height: VIEW.h }, deviceScaleFactor: VIEW.dpr, isMobile: VIEW.mobile, hasTouch: VIEW.mobile, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + p, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += VIEW.h) { await page.evaluate(yy => scrollTo({ top: yy, behavior: 'instant' }), y); await page.waitForTimeout(350); }
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(400);
      const r = await page.evaluate(({ 단계, 굵기 }) => {
        const clean = s => (s || '').replace(/\s+/g, ' ').trim();
        const vis = e => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 1 && b.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
        const where = e => { const out = []; for (let x = e, i = 0; x && x !== document.body && i < 3; x = x.parentElement, i++) out.unshift(x.tagName.toLowerCase() + (x.className && typeof x.className === 'string' ? '.' + x.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return out.join(' > '); };
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), seen = new Set();
        const size = {}, weight = {}, bad = {}, mono = {}, upper = {}; let n = 0;
        while (w.nextNode()) {
          const t = w.currentNode, tx = clean(t.nodeValue); if (!tx) continue; const e = t.parentElement; if (!e || seen.has(e) || !vis(e)) continue; seen.add(e); n++;
          const cs = getComputedStyle(e), s = Math.round(parseFloat(cs.fontSize)), wt = cs.fontWeight;
          size[s] = (size[s] || 0) + 1; weight[wt] = (weight[wt] || 0) + 1;
          const key = where(e);
          if (!단계.includes(s) || !굵기.includes(wt)) { const k = `${s}px/${wt} ${key}`; (bad[k] ||= []).push(tx.slice(0, 16)); }
          if (/mono|courier|consol/i.test(cs.fontFamily.split(',')[0])) (mono[key] ||= []).push(tx.slice(0, 12));
          if (!/[가-힣]/.test(tx) && /[A-Z]{3,}/.test(tx) && tx === tx.toUpperCase() || (cs.textTransform === 'uppercase' && !/[가-힣]/.test(tx))) (upper[key] ||= []).push(tx.slice(0, 14));
        }
        const btn = {}; [...document.querySelectorAll('a,button')].filter(vis).forEach(e => { const cs = getComputedStyle(e); if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px') { const k = cs.borderTopLeftRadius; (btn[k] ||= []).push(where(e).split(' > ').pop()); } });
        const short = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length + ' · ' + [...new Set(v)].slice(0, 3).join(' | ')]));
        return { 글덩어리: n, 크기: size, 굵기: weight, 단계밖: short(bad), 모노: short(mono), 영문대문자: short(upper), 단추모서리: short(btn), 화면수: +(document.documentElement.scrollHeight / innerHeight).toFixed(1), 글자: clean(document.body.innerText).length, 준비중: (document.body.innerText.match(/준비 중|준비하고 있/g) || []).length };
      }, { 단계, 굵기 });
      console.log(`\n===== ${p} (${mode}) — ${r.화면수}화면 · ${r.글자}자 · 글 덩어리 ${r.글덩어리} · 크기 ${Object.keys(r.크기).length}단계 · 굵기 ${Object.keys(r.굵기).length}가지 · 모노 ${Object.values(r.모노).reduce((s, v) => s + +v.split(' · ')[0], 0)} · 영문 대문자 ${Object.values(r.영문대문자).reduce((s, v) => s + +v.split(' · ')[0], 0)} · 준비 중 ${r.준비중}`);
      console.log('크기', JSON.stringify(r.크기), '굵기', JSON.stringify(r.굵기));
      for (const k of ['단계밖', '모노', '영문대문자', '단추모서리']) { console.log(`-- ${k}`); for (const [a, b] of Object.entries(r[k])) console.log(`  ${a}  ← ${b}`); }
      await ctx.close();
    }
  } finally { await 닫기(browser); }
});
