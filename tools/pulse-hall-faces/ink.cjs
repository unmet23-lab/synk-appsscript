// 첫 화면 글 잉크 그림: 쇼릴 · 그늘 · 글 그림자를 끄고 검은 바탕에 글만 찍는다(첫 화면 높이만).
// 후보 CSS를 라이브 쪽에 끼워 재려면 환경 변수 CSS=<pulse-v12.css 경로>를 준다(그 파일로 /assets/v10/pulse-v12.css 요청을 바꿔 준다).
// node tools/pulse-hall-faces/ink.cjs <기준 주소> <out 폴더> <mobile|desktop> <크기 목록 파일 또는 폭x높이,...> [시작 크기(회전 시험) 폭x높이]
// 시작 크기를 주면 그 크기로 쪽을 연 뒤 목록 크기로 바꾼다(창 · 기기 돌리기와 같다). 쪽 하나로 목록을 차례로 돈다.
// 글 칸은 낱낱이 잰다(머리글 · 제목 · 소개 줄 · 작품 줄 · 단추 · 값 안내 · 번호 줄) — 오른쪽 칸 상자(.pv-side)는 display:contents일 때 0×0이라 쓰지 않는다(11-17 검수 F3).
// 작품 줄은 작품 넷의 이름을 차례로 넣어 따로 찍고, inkhit.py가 그 이름을 그 작품 컷의 프레임하고만 견준다(11-17 검수 F4). 작품 줄이 숨은 크기는 한 장만 찍는다.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const [base, outDir, mode, list, start] = process.argv.slice(2);
const sizes = (fs.existsSync(list) ? fs.readFileSync(list, 'utf8') : list).split(/[\s,]+/).filter(Boolean).map(s => s.split('x').map(Number));
const mobile = mode === 'mobile';
fs.mkdirSync(outDir, { recursive: true });
const CSS = `.pv-reel{visibility:hidden!important}.pv-hall::after{display:none!important}.pv-hall,.pv-hall-in{background:#000!important}
.pv-hall *{text-shadow:none!important;animation:none!important;transition:none!important}`;
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const meta = [];
  for (const pg of ['/pulse/', '/en/pulse/']) {
    const first = start ? start.split('x').map(Number) : sizes[0];
    const ctx = await browser.newContext({ viewport: { width: first[0], height: first[1] }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    if (process.env.CSS) await page.route(/\/assets\/v10\/pulse-v12\.css/, r => r.fulfill({ body: fs.readFileSync(process.env.CSS), contentType: 'text/css; charset=utf-8' }));
    await page.goto(base + pg + '?probe=' + Date.now(), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: CSS });
    await page.waitForTimeout(300);
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [w, h]);
      // 쇼릴을 멈춰 둔다 — 돌면 pulse-v12.js가 컷이 바뀔 때 작품 줄을 그 작품으로 다시 칠해 넣은 이름을 덮는다(판을 다시 고르면 play를 부르니 크기마다 멈춘다)
      await page.evaluate(() => { document.querySelector('.pv-reel')?.pause(); scrollTo(0, 0); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
      await page.evaluate(() => document.querySelector('.pv-reel')?.pause());
      const m = await page.evaluate(() => {
        const q = s => document.querySelector(s), b = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
        const shown = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
        const parts = {}, zero = [];
        for (const [k, s] of [['label', '.pv-copy .label'], ['title', '.pv-h1'], ['lead', '.pv-hall .lead'], ['cta', '.btn.pv-cta'], ['price', '.pv-side .k-pv-price'], ['index', '.pv-index']]) {
          const e = q(s); if (!e || !shown(e)) continue; const r = b(e); if (r.w * r.h < 1) zero.push(k); else parts[k] = r;
        }
        const reel = q('.pv-reel'), now = q('[data-now]');
        const data = JSON.parse(q('[data-reel-data]').textContent);
        return { reel: b(reel), hall: b(q('.pv-hall')), parts, zero, nowShown: !!(now && shown(now)), works: Object.keys(data.works), timeline: data.timeline,
          tall: matchMedia('(max-aspect-ratio: 4/5)').matches, src: reel.getAttribute('src'), poster: reel.getAttribute('poster'), h1px: parseFloat(getComputedStyle(q('.pv-h1')).fontSize) };
      });
      if (m.zero.length) console.warn(`경고 ${pg} ${w}x${h}: 보이는데 크기가 0인 글 칸 ${m.zero.join(', ')}`);
      const L = pg.includes('/en/') ? 'en' : 'ko';
      const files = {}, nowBoxes = {};
      for (const key of (m.nowShown ? m.works : [null])) {
        if (key) nowBoxes[key] = await page.evaluate(key => new Promise(res => {
          const data = JSON.parse(document.querySelector('[data-reel-data]').textContent), wk = data.works[key], now = document.querySelector('[data-now]');
          const at = wk.title.indexOf('「'), strong = document.createElement('strong');
          if (at > 0) strong.append(wk.title.slice(0, at), Object.assign(document.createElement('span'), { textContent: wk.title.slice(at) })); else strong.textContent = wk.title;
          now.replaceChildren(strong, Object.assign(document.createElement('span'), { textContent: wk.sub }));
          requestAnimationFrame(() => requestAnimationFrame(() => { const r = now.getBoundingClientRect(); res({ x: r.left, y: r.top, w: r.width, h: r.height }); }));
        }), key);
        const file = `${L}-${w}x${h}${key ? '-' + key : ''}.png`;
        await page.screenshot({ path: path.join(outDir, file), clip: { x: 0, y: 0, width: w, height: h } });
        if (key) files[key] = file; else for (const k2 of m.works) files[k2] = file;
      }
      const file = files[m.works[0]];
      delete m.zero;
      meta.push({ vp: [w, h], page: pg, file, files, nowBoxes, ...m });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta));
  console.log('찍은 것', meta.length);
})().catch(e => { console.error(e); process.exit(1); });
