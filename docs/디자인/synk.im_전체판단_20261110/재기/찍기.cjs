#!/usr/bin/env node
// synk.im 공개본(또는 다른 사이트)을 화면 단위로 찍고 잰다(2026-11-10 전체 판단).
//   node 찍기.cjs <d|m> <이름=경로 또는 주소> …   d = 1440×900 · m = 390×844(2배). 경로가 /로 시작하면 Git Bash에서는 MSYS_NO_PATHCONV=1을 붙인다.
//   OUTDIR=<폴더>(기본: 임시 폴더 synk-front-shoot) · ORIGIN=<기본 https://synk.im> · CAP=1이면 첫 화면만 찍고 끝까지 내려 잰 뒤 한눈 판 하나(sheet-all)를 낸다.
//   낸 것: <이름>-<d|m>-NN.jpg(화면마다) · sheet-<이름>-<d|m>.jpg(한눈 판) · <이름>-<d|m>.json(잰 값) · .txt(쪽 글 전부). 남의 사이트 그림은 저장소에 넣지 않는다.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const { 화면시험, 닫기 } = require(path.join(repo, 'tools', 'lib', '화면시험.cjs'));
const OUT = path.resolve(process.env.OUTDIR || path.join(os.tmpdir(), 'synk-front-shoot'));
fs.mkdirSync(OUT, { recursive: true });

const [mode, ...targets] = process.argv.slice(2);
const VIEW = mode === 'm' ? { w: 390, h: 844, mobile: true, dpr: 2, cap: 18 } : { w: 1440, h: 900, mobile: false, dpr: 1, cap: 16 };
if (process.env.CAP) VIEW.cap = +process.env.CAP;
const ORIGIN = process.env.ORIGIN || 'https://synk.im';

async function measure(page) {
  return page.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    const VH = innerHeight, VW = innerWidth, H = document.documentElement.scrollHeight;
    const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
    const abs = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
    const heads = [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(e => { const cs = getComputedStyle(e), a = abs(e); return `${e.tagName} @${(a.y / VH).toFixed(1)} ${Math.round(parseFloat(cs.fontSize))}px/${cs.fontWeight} ${cs.fontFamily.split(',')[0].replace(/"/g, '')} | ${clean(e.innerText).slice(0, 90)}`; });
    // 글자 스타일 분포
    const fam = {}, size = {}, weight = {}; let mono = 0, upper = 0, textEls = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode; if (!clean(t.nodeValue)) continue; const e = t.parentElement; if (!e || seen.has(e) || !vis(e)) continue; seen.add(e); textEls++;
      const cs = getComputedStyle(e); const f = cs.fontFamily.split(',')[0].replace(/"/g, '').trim(); const n = clean(t.nodeValue).length;
      fam[f] = (fam[f] || 0) + n; size[Math.round(parseFloat(cs.fontSize))] = (size[Math.round(parseFloat(cs.fontSize))] || 0) + 1; weight[cs.fontWeight] = (weight[cs.fontWeight] || 0) + 1;
      if (/mono|courier|consol/i.test(cs.fontFamily.split(',')[0])) mono++;
      const tx = clean(t.nodeValue); if (!/[가-힣]/.test(tx) && /[A-Z]{3,}/.test(tx) && tx === tx.toUpperCase() || (cs.textTransform === 'uppercase' && !/[가-힣]/.test(tx))) upper++;
    }
    const media = [...document.querySelectorAll('img,video,canvas,svg')].filter(vis).map(e => { const a = abs(e); return { t: e.tagName, ...a, src: (e.currentSrc || e.src || '').split('/').slice(-1)[0].slice(0, 50), nat: e.tagName === 'IMG' ? `${e.naturalWidth}x${e.naturalHeight}` : e.tagName === 'VIDEO' ? `${e.videoWidth}x${e.videoHeight}` : '', playing: e.tagName === 'VIDEO' ? (!e.paused && e.readyState > 2) : undefined, fit: getComputedStyle(e).objectFit }; }).filter(m => m.w * m.h > 12000);
    const first = media.filter(m => m.y < VH && m.t !== 'SVG');
    const firstArea = first.reduce((s, m) => s + Math.max(0, Math.min(m.x + m.w, VW) - Math.max(m.x, 0)) * Math.max(0, Math.min(m.y + m.h, VH) - Math.max(m.y, 0)), 0) / (VW * VH);
    const btns = [...document.querySelectorAll('a,button')].filter(vis);
    const firstBtns = btns.filter(e => { const a = abs(e); return a.y < VH && a.y + a.h > 0; }).map(e => clean(e.innerText || e.getAttribute('aria-label')).slice(0, 24)).filter(Boolean);
    const radius = {}; btns.forEach(e => { const cs = getComputedStyle(e); if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px') { const r = cs.borderTopLeftRadius; radius[r] = (radius[r] || 0) + 1; } });
    const secs = [...document.querySelectorAll('main > *, body > footer, body > header')].filter(e => e.getBoundingClientRect().height > 40).map(e => { const a = abs(e); const bg = getComputedStyle(e).backgroundColor; return `${e.tagName.toLowerCase()}#${e.id || ''}.${e.className.toString().split(' ').slice(0, 2).join('.')} @${(a.y / VH).toFixed(1)}+${(a.h / VH).toFixed(1)}화면 ${clean(e.innerText).length}자 bg ${bg}`; });
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const bytes = res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav?.transferSize || 0);
    const byType = {}; res.forEach(r => { const k = r.initiatorType + ':' + ((r.name.split('?')[0].match(/\.(\w+)$/) || [])[1] || ''); byType[k] = (byType[k] || 0) + (r.transferSize || 0); });
    const lcp = (window.__lcp || 0);
    const top = Object.entries;
    return {
      제목: document.title, 화면수: +(H / VH).toFixed(1), 글자: clean(document.body.innerText).length, 머리글: heads,
      글꼴: Object.fromEntries(top(fam).sort((a, b) => b[1] - a[1]).slice(0, 8)), 크기단계: Object.keys(size).length, 크기: Object.fromEntries(top(size).sort((a, b) => b[1] - a[1]).slice(0, 14)), 굵기: weight, 모노: mono, 영문대문자: upper, 글덩어리: textEls,
      첫화면: { 그림면적: +(firstArea * 100).toFixed(1), 그림: first.map(m => `${m.t} ${m.w}x${m.h}@${m.x},${m.y} ${m.src} ${m.nat}${m.playing !== undefined ? (m.playing ? ' ▶' : ' ■') : ''}`), 누를것: firstBtns },
      영상: media.filter(m => m.t === 'VIDEO').map(m => `${m.src} 원본 ${m.nat} → 화면 ${m.w}x${m.h} @${(m.y / VH).toFixed(1)}화면 ${m.playing ? '▶' : '■'} ${m.fit}`),
      큰그림: media.filter(m => m.t === 'IMG' && m.w > 300).map(m => `${m.src} 원본 ${m.nat} → ${m.w}x${m.h} @${(m.y / VH).toFixed(1)}`).slice(0, 40),
      캔버스: media.filter(m => m.t === 'CANVAS').length, 단추모서리: radius, 구역: secs,
      속도: { 응답ms: Math.round(nav?.responseStart || 0), DOMms: Math.round(nav?.domContentLoadedEventEnd || 0), loadms: Math.round(nav?.loadEventEnd || 0), LCPms: Math.round(lcp), 전송KB: Math.round(bytes / 1024), 요청수: res.length, 유형KB: Object.fromEntries(top(byType).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, Math.round(v / 1024)])) },
      가로스크롤: document.documentElement.scrollWidth > VW + 1,
    };
  });
}

화면시험({ 분: 9 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const t of targets) {
      const name = t.slice(0, t.indexOf('=')), p = t.slice(t.indexOf('=') + 1); const url = p.startsWith('http') ? p : ORIGIN + p;
      let ctx;
      try {
      ctx = await browser.newContext({ viewport: { width: VIEW.w, height: VIEW.h }, deviceScaleFactor: VIEW.dpr, isMobile: VIEW.mobile, hasTouch: VIEW.mobile, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror ' + String(e).slice(0, 160)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
      page.on('requestfailed', r => errors.push('요청실패 ' + r.url().slice(0, 100)));
      await page.addInitScript(() => { try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {} });
      const key = `${name}-${mode}`;
      await page.goto(url, { waitUntil: p.startsWith('http') ? 'domcontentloaded' : 'load', timeout: 45000 });
      if (p.startsWith('http')) await page.waitForTimeout(2500);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `${key}-t0.jpg`), type: 'jpeg', quality: 72 });
      await page.waitForTimeout(2600);
      const first = await measure(page);
      const VH = VIEW.h; const H = await page.evaluate(() => document.documentElement.scrollHeight);
      const n = Math.min(VIEW.cap, Math.ceil(H / VH));
      for (let i = 0; i < n; i++) {
        await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), i * VH);
        await page.waitForTimeout(i === 0 ? 300 : 1100);
        await page.screenshot({ path: path.join(OUT, `${key}-${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 72 });
      }
      if (VIEW.cap === 1) { for (let i = 1; i < 45; i++) { const more = await page.evaluate(y => { window.scrollTo({ top: y, behavior: 'instant' }); return y < document.documentElement.scrollHeight; }, i * VH * 1.4); await page.waitForTimeout(140); if (!more) break; } }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(400);
      const all = await measure(page);
      const text = await page.evaluate(() => document.body.innerText);
      const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))].slice(0, 120));
      fs.writeFileSync(path.join(OUT, `${key}.txt`), text);
      fs.writeFileSync(path.join(OUT, `${key}.json`), JSON.stringify({ 주소: url, 찍은장: n, 전체화면수: +(H / VH).toFixed(1), 처음: first.첫화면, 처음속도: first.속도, 잰값: all, 오류: errors.slice(0, 10), 링크: links }, null, 1));
      console.log(`${key}: ${n}장 / ${(H / VH).toFixed(1)}화면 / ${all.글자}자 / 오류 ${errors.length}`);
      } catch (e) { console.log(name + ': 실패 ' + String(e).split(/\n/)[0].slice(0, 140)); }
      finally { if (ctx) await ctx.close().catch(() => {}); }
    }
    if (VIEW.cap === 1) {
      const c2 = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
      const sh = await c2.newPage();
      const tiles = targets.map(t => t.slice(0, t.indexOf('='))).filter(n => fs.existsSync(path.join(OUT, `${n}-${mode}-00.jpg`)));
      const tw = VIEW.mobile ? 244 : 496, cols = VIEW.mobile ? 6 : 3;
      fs.writeFileSync(path.join(OUT, '_all.html'), `<body style="margin:0;background:#777;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:4px;padding:4px">${tiles.map(n => `<div style="position:relative"><img src="file:///${OUT.replace(/\\/g, '/')}/${n}-${mode}-00.jpg" style="width:${tw}px;display:block"><b style="position:absolute;left:0;top:0;background:#ff0;color:#000;padding:1px 5px">${n}</b></div>`).join('')}</div></body>`);
      await sh.goto('file:///' + path.join(OUT, '_all.html').replace(/\\/g, '/')); await sh.waitForTimeout(600);
      await sh.screenshot({ path: path.join(OUT, `sheet-all-${mode}.jpg`), fullPage: true, type: 'jpeg', quality: 80 });
      await c2.close();
      return;
    }
    // 한눈 판: 쪽마다 한 장
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    const sheet = await ctx.newPage();
    for (const t of targets) {
      const name = t.split('=')[0]; const key = `${name}-${mode}`;
      const files = fs.readdirSync(OUT).filter(f => new RegExp(`^${key}-\\d\\d\\.jpg$`).test(f)).sort();
      const tw = VIEW.mobile ? 244 : 496, cols = VIEW.mobile ? 6 : 3;
      const html = `<body style="margin:0;background:#777;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:4px;padding:4px">${files.map((f, i) => `<div style="position:relative"><img src="file:///${OUT.replace(/\\/g, '/')}/${f}" style="width:${tw}px;display:block"><b style="position:absolute;left:0;top:0;background:#ff0;color:#000;padding:1px 5px">${i + 1}</b></div>`).join('')}</div></body>`;
      const hp = path.join(OUT, `_${key}.html`); fs.writeFileSync(hp, html);
      await sheet.goto('file:///' + hp.replace(/\\/g, '/')); await sheet.waitForTimeout(500);
      await sheet.screenshot({ path: path.join(OUT, `sheet-${key}.jpg`), fullPage: true, type: 'jpeg', quality: 78 });
    }
    await ctx.close();
  } finally { await 닫기(browser); }
});
