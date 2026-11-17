// 글 밑 배경(글을 숨기고 찍은 쇼릴 + 그늘)의 밝기로 대비를 잰다: node contrast.cjs <기준> <쪽> <폭x높이> <out.json> t1 t2 ...
// 후보 CSS를 라이브 쪽에 끼워 재려면 환경 변수 CSS=<pulse-v12.css 경로>를 준다(그 파일로 /assets/v10/pulse-v12.css 요청을 바꿔 준다).
// 글 상자마다 배경 화소의 상대 휘도 분포에서 밝은 쪽 90번째 값을 쓰고, 글 색(제목 #f2efe9 · 머리글 ink-3 · 작품 줄 ink)과의 대비비를 낸다.
const { chromium } = require('playwright');
const fs = require('node:fs');
const [base, pg, vp, out, mode, ...ts] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mode === 'mobile', hasTouch: mode === 'mobile', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (process.env.CSS) await page.route(/\/assets\/v10\/pulse-v12\.css/, r => r.fulfill({ body: fs.readFileSync(process.env.CSS), contentType: 'text/css; charset=utf-8' }));
  await page.goto(base + '/' + pg.replace(/^\/+/, '') + '?probe=' + Date.now(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => { const v = document.querySelector('.pv-reel'); return v && v.readyState >= 2; }, null, { timeout: 30000 });
  const boxes = await page.evaluate(() => {
    const out = {};
    const tr = (k, el) => { if (!el || getComputedStyle(el).display === 'none') return; const r = document.createRange(); r.selectNodeContents(el); out[k] = [...r.getClientRects()].filter(q => q.width > 2).map(q => ({ x: q.left, y: q.top, w: q.width, h: q.height })); out[k + ':color'] = getComputedStyle(el.querySelector('span') || el).color; };
    tr('label', document.querySelector('.pv-copy .label'));
    tr('title', document.querySelector('.pv-h1'));
    tr('now', document.querySelector('.pv-now strong'));
    tr('price', document.querySelector('.pv-side .k-pv-price'));
    return out;
  });
  await page.addStyleTag({ content: '.pv-hall-in{visibility:hidden!important}' });
  const res = [];
  for (const t of ts) {
    await page.evaluate(async t => {
      const v = document.querySelector('.pv-reel'); v.pause();
      await new Promise(r => { v.addEventListener('seeked', r, { once: true }); v.currentTime = +t; });
      await new Promise(r => setTimeout(r, 450));
    }, t);
    const png = await page.screenshot();
    fs.writeFileSync(`${out}.bg-${t}.png`, png);
    res.push({ t: +t, file: `${out}.bg-${t}.png` });
  }
  fs.writeFileSync(out, JSON.stringify({ vp: [w, h], boxes, shots: res }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
