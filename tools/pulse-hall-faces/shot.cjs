// 쇼릴을 그 초에 세운 실제 첫 화면: node tools/pulse-hall-faces/shot.cjs <기준 주소> <out 폴더> <mobile|desktop> <ko|en> <폭x높이> t1 t2 ...
// 후보 CSS를 라이브 쪽에 끼워 재려면 환경 변수 CSS=<pulse-v12.css 경로>를 준다(그 파일로 /assets/v10/pulse-v12.css 요청을 바꿔 준다).
// 화면 상자(쇼릴 · 글)도 json으로 남겨 얼굴 상자를 겹쳐 그린다.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const [base, outDir, mode, lang, vp, ...ts] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number); const mobile = mode === 'mobile';
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (process.env.CSS) await page.route(/\/assets\/v10\/pulse-v12\.css/, r => r.fulfill({ body: fs.readFileSync(process.env.CSS), contentType: 'text/css; charset=utf-8' }));
  await page.goto(base + (lang === 'en' ? '/en/pulse/' : '/pulse/') + '?probe=' + Date.now(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => { const v = document.querySelector('.pv-reel'); return v && v.readyState >= 2; }, null, { timeout: 60000 });
  const out = [];
  for (const t of ts) {
    const info = await page.evaluate(async t => {
      const v = document.querySelector('.pv-reel');
      v.pause();
      await new Promise(r => { v.addEventListener('seeked', r, { once: true }); v.currentTime = +t; });
      const data = JSON.parse(document.querySelector('[data-reel-data]').textContent);
      let cur = data.timeline[0]; for (const s of data.timeline) if (+t >= s.at) cur = s;
      const wk = data.works[cur.work]; const now = document.querySelector('[data-now]');
      const at = wk.title.indexOf('「'); const strong = document.createElement('strong');
      if (at > 0) strong.append(wk.title.slice(0, at), Object.assign(document.createElement('span'), { textContent: wk.title.slice(at) })); else strong.textContent = wk.title;
      now.replaceChildren(strong, Object.assign(document.createElement('span'), { textContent: wk.sub }));
      now.classList.remove('swap');
      await new Promise(r => setTimeout(r, 500));
      const b = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      return { reel: b(v), src: v.getAttribute('src'), ct: v.currentTime };
    }, t);
    const file = `${lang}-${w}x${h}-${t}.png`;
    await page.screenshot({ path: path.join(outDir, file) });
    out.push({ t: +t, file, ...info });
  }
  fs.writeFileSync(path.join(outDir, `${lang}-${w}x${h}.json`), JSON.stringify(out));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
