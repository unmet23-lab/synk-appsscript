// 첫 화면 글 상자를 여러 크기에서 잰다(한 쪽을 한 번 열고 창 크기만 바꾼다).
// 후보 CSS를 라이브 쪽에 끼워 재려면 환경 변수 CSS=<pulse-v12.css 경로>를 준다(그 파일로 /assets/v10/pulse-v12.css 요청을 바꿔 준다).
// node tools/pulse-hall-faces/sweep.cjs <기준 주소> <out.json> <mobile|desktop> <크기 목록 파일 또는 폭x높이,...>
// 작품 줄(.pv-now)은 작품 넷 각각의 글로 바꿔 잰다(그 작품의 컷 프레임과만 견준다).
const { chromium } = require('playwright');
const fs = require('node:fs');
const [base, out, mode, list] = process.argv.slice(2);
const sizes = (fs.existsSync(list) ? fs.readFileSync(list, 'utf8') : list).split(/[\s,]+/).filter(Boolean).map(s => s.split('x').map(Number));
const mobile = mode === 'mobile';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const res = [];
  for (const pg of ['/pulse/', '/en/pulse/']) {
    const ctx = await browser.newContext({ viewport: { width: sizes[0][0], height: sizes[0][1] }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    if (process.env.CSS) await page.route(/\/assets\/v10\/pulse-v12\.css/, r => r.fulfill({ body: fs.readFileSync(process.env.CSS), contentType: 'text/css; charset=utf-8' }));
    await page.goto(base + pg + '?probe=' + Date.now(), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [w, h]);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await page.evaluate(() => {
        const box = r => ({ x: r.left, y: r.top, w: r.width, h: r.height });
        const shown = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
        const textRects = el => {
          const out = [];
          if (!el || !shown(el)) return out;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            if (!n.textContent.trim() || !shown(n.parentElement)) continue;
            const r = document.createRange(); r.selectNodeContents(n);
            for (const q of r.getClientRects()) if (q.width > 0 && q.height > 0) out.push(box(q));
          }
          return out;
        };
        const q = s => document.querySelector(s);
        const hall = q('.pv-hall'), reel = q('.pv-reel'), now = q('.pv-now');
        const data = JSON.parse(q('[data-reel-data]').textContent);
        const keep = now.innerHTML;
        const nowBy = {};
        for (const [k, wk] of Object.entries(data.works)) {
          const at = wk.title.indexOf('「');
          const strong = document.createElement('strong');
          if (at > 0) strong.append(wk.title.slice(0, at), Object.assign(document.createElement('span'), { textContent: wk.title.slice(at) })); else strong.textContent = wk.title;
          now.replaceChildren(strong, Object.assign(document.createElement('span'), { textContent: wk.sub }));
          nowBy[k] = textRects(now);
        }
        now.innerHTML = keep;
        const parts = {
          label: textRects(q('.pv-copy .label')),
          title: textRects(q('.pv-h1')),
          lead: textRects(q('.pv-hall .lead')),
          price: textRects(q('.pv-side .k-pv-price')),
          cta: shown(q('.btn.pv-cta')) ? [box(q('.btn.pv-cta').getBoundingClientRect())] : [],
          index: [...document.querySelectorAll('.pv-index button')].filter(shown).map(b => box(b.getBoundingClientRect())),
        };
        return {
          hall: box(hall.getBoundingClientRect()), reel: box(reel.getBoundingClientRect()),
          tall: matchMedia('(max-aspect-ratio: 4/5)').matches,
          src: reel.getAttribute('src'), poster: reel.getAttribute('poster'),
          h1px: parseFloat(getComputedStyle(q('.pv-h1')).fontSize),
          titleLines: new Set(textRects(q('.pv-h1')).map(r => Math.round(r.y))).size,
          parts, nowBy, timeline: data.timeline, total: data.total,
          scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight,
        };
      });
      res.push({ vp: [w, h], page: pg, ...m });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(res));
  console.log('잰 것', res.length);
})().catch(e => { console.error(e); process.exit(1); });
