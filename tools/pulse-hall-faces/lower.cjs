// 첫 화면 밖의 의뢰 단추(가운데 구역 · 문의 칸)가 기준 판과 같은지 크기마다 견준다(11-18).
// 첫 화면 규칙을 쪽 전체 클래스(.btn.pv-cta)로 쓰면 아래 구역의 같은 단추에도 걸린다 — 잉크 · 상자 도구는 첫 화면만 보므로 이것으로 따로 본다.
// node tools/pulse-hall-faces/lower.cjs <기준 주소> <견줄 주소> <mobile|desktop> <크기 목록 파일 또는 폭x높이,...>
//   예: node tools/pulse-hall-faces/lower.cjs https://synk.im http://127.0.0.1:4836 mobile tools/pulse-hall-faces/data/sizes-mid.txt
// 후보 CSS만 바꿔 보려면 견줄 주소에 기준 주소를 그대로 주고 환경 변수 CSS=<pulse-v12.css 경로>를 준다(견줄 쪽에만 끼운다).
// 견주는 값: 폭 · 부모 안 자리 · margin · grid-area · 맞춤 · translate · transform. 다르면 앞 8개를 보이고 끝 코드 1.
const { chromium } = require('playwright');
const fs = require('node:fs');
const [baseA, baseB, mode, list] = process.argv.slice(2);
const sizes = (fs.existsSync(list) ? fs.readFileSync(list, 'utf8') : list).split(/[\s,]+/).filter(Boolean).map(s => s.split('x').map(Number));
const mob = mode === 'mobile';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const res = {};
  for (const [nm, base] of [['A', baseA], ['B', baseB]]) for (const pg of ['/pulse/', '/en/pulse/']) {
    const ctx = await b.newContext({ viewport: { width: sizes[0][0], height: sizes[0][1] }, isMobile: mob, hasTouch: mob });
    const p = await ctx.newPage();
    if (nm === 'B' && process.env.CSS) await p.route(/\/assets\/v10\/pulse-v12\.css/, r => r.fulfill({ body: fs.readFileSync(process.env.CSS), contentType: 'text/css; charset=utf-8' }));
    await p.goto(base + pg, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    for (const [w, h] of sizes) {
      await p.setViewportSize({ width: w, height: h });
      await p.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [w, h]);
      res[`${nm} ${pg} ${w}x${h}`] = await p.evaluate(() => [...document.querySelectorAll('.btn.pv-cta')].filter(e => !e.closest('.pv-hall')).map(e => {
        const cs = getComputedStyle(e), r = e.getBoundingClientRect(), pr = e.parentElement.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.left - pr.left), Math.round(r.top - pr.top), cs.margin, cs.gridArea, cs.alignSelf, cs.justifySelf, cs.translate, cs.transform].join(' ');
      }).join(' | '));
    }
    await ctx.close();
  }
  await b.close();
  let diff = 0, n = 0;
  for (const k of Object.keys(res)) if (k.startsWith('A ')) {
    n++;
    const other = res['B ' + k.slice(2)];
    if (other !== res[k]) { diff++; if (diff <= 8) console.log('다름', k.slice(2), '\n  기준', res[k], '\n  견줄', other); }
  }
  console.log(`견준 것 ${n} · 다름 ${diff}`);
  process.exit(diff ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
