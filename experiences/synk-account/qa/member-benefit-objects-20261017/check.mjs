// 웹 플랫폼 회원 혜택 포스터(2026-10-17) 화면 점검: 물건이 칩·큰 글자와 겹치지 않는지, 그림이 화면에서 늘어나지 않는지,
// 가로 넘침·한글 13px 미만·빠진 파일·콘솔 오류가 없는지 재고, 밤·낮 캡처를 남긴다.
// 사용: node check.mjs <플랫폼 주소(…/platform.html)> <출력 폴더> [--shots]
// 주소는 로컬 정적 서버(qa/platform-weight-20261013/static-serve.mjs)로 띄운 작업본을 가리킨다. 외부 서비스는 부르지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Playwright는 Codex 런타임에 든 것을 쓴다(현장 노트 시험·화면 확인). 다른 자리면 SYNK_PLAYWRIGHT에 index.mjs 경로를 준다.
const { chromium } = await import(pathToFileURL(process.env.SYNK_PLAYWRIGHT || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);

const [,, pageUrl, outDir, ...flags] = process.argv;
if (!pageUrl || !outDir) throw Error('사용: node check.mjs <platform.html 주소> <출력 폴더> [--shots]');
const shots = flags.includes('--shots');
fs.mkdirSync(outDir, { recursive: true });

const DETAILS = ['insight', 'subscriptions', 'care', 'fortune', 'rehearsal', 'family-album'];
const VIEWS = ['#benefits', ...DETAILS.map(id => `#benefits/${id}`), '#home', '#discover'];
// [폭, 높이, 배율] — 1366×768·1280×720은 낮은 창, 390·320은 휴대폰.
const SIZES = [[2560, 1440, 2], [1920, 1080, 1], [1440, 900, 2], [1366, 768, 1], [1280, 720, 1], [1024, 800, 2], [900, 800, 2], [768, 1024, 2], [390, 844, 3], [320, 640, 2]];
const report = { checkedOn: new Date().toISOString(), pageUrl, views: [], need: {}, problems: [] };

function measure() {
  const out = { overflow: innerWidth > visualViewport.width + 1 || document.documentElement.scrollWidth > innerWidth + 1, posters: [], small: [], weights: [] };
  const alpha = new Map();
  const cloud = new Map();
  const points = img => { // 알파 40 넘는 실제 그림 점(원본 6px 간격, 0~1 비율)
    if (cloud.has(img.currentSrc)) return cloud.get(img.currentSrc);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, list = [];
    for (let y = 0; y < c.height; y += 6) for (let x = 0; x < c.width; x += 6) if (d[(y * c.width + x) * 4 + 3] > 40) list.push([x / c.width, y / c.height]);
    cloud.set(img.currentSrc, list); return list;
  };
  const bbox = img => { // 알파 40 넘는 실제 그림 영역(접지 그림자의 옅은 끝은 뺀다), 원본 비율 0~1
    if (alpha.has(img.currentSrc)) return alpha.get(img.currentSrc);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const box = { l: x0 / c.width, t: y0 / c.height, r: (x1 + 2) / c.width, b: (y1 + 2) / c.height }; alpha.set(img.currentSrc, box); return box;
  };
  const drawn = img => { // 회전 전 상자 → contain + object-position → 실제 그림 영역 → 회전한 네 모서리의 외접 상자
    const saved = img.style.transform; img.style.transform = 'none';
    const r = img.getBoundingClientRect(), cs = getComputedStyle(img); img.style.transform = saved;
    const pl = parseFloat(cs.paddingLeft), pt = parseFloat(cs.paddingTop), pr = parseFloat(cs.paddingRight), pb = parseFloat(cs.paddingBottom);
    const w = r.width - pl - pr, h = r.height - pt - pb, s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s, [px, py] = cs.objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const x = r.left + pl + (w - dw) * px, y = r.top + pt + (h - dh) * py, a = bbox(img);
    const box = { l: x + a.l * dw, t: y + a.t * dh, r: x + a.r * dw, b: y + a.b * dh };
    const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform), [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
    const pts = [[box.l, box.t], [box.r, box.t], [box.l, box.b], [box.r, box.b]].map(([X, Y]) => { const p = m.transformPoint(new DOMPoint(X - r.left - ox, Y - r.top - oy)); return [p.x + r.left + ox, p.y + r.top + oy]; });
    const map = ([X, Y]) => { const p = m.transformPoint(new DOMPoint(X - r.left - ox, Y - r.top - oy)); return [p.x + r.left + ox, p.y + r.top + oy]; };
    const cloudPts = points(img).map(([u, v]) => map([x + u * dw, y + v * dh]));
    return { l: Math.min(...pts.map(p => p[0])), r: Math.max(...pts.map(p => p[0])), t: Math.min(...pts.map(p => p[1])), b: Math.max(...pts.map(p => p[1])), dw, dh, cloud: cloudPts };
  };
  const ctx = document.createElement('canvas').getContext('2d');
  const glyph = (el, pseudo) => { // 큰 한글의 실제 글자 윗선·아랫선(줄 상자가 아니라 글리프)
    const cs = getComputedStyle(el, pseudo); const text = pseudo ? cs.content.replace(/^["']|["']\s*\/.*$|["']$/g, '').replace(/\\A/g, '') : el.textContent;
    if (!text || cs.display === 'none' || cs.content === 'none' && pseudo) return null;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const t = ctx.measureText(text), fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || fs;
    let top, left;
    if (pseudo && cs.position === 'absolute') { const host = el.getBoundingClientRect(); top = host.bottom - parseFloat(cs.bottom) - lh; left = host.left + parseFloat(cs.left); }
    else if (pseudo) { // 흐름 안 ::before — 부모 안 첫 글자 줄
      const host = el.getBoundingClientRect();
      left = host.left; top = getComputedStyle(el).flexDirection === 'column' ? host.top : host.bottom - lh;
    } else { const r = el.getBoundingClientRect(); top = r.top; left = r.left; }
    const base = top + (lh - (t.fontBoundingBoxAscent + t.fontBoundingBoxDescent)) / 2 + t.fontBoundingBoxAscent;
    return { l: left, r: left + t.width, t: base - t.actualBoundingBoxAscent, b: base + t.actualBoundingBoxDescent, text };
  };
  const posters = [
    ['card', '.benefit-card .benefit-art', el => glyph(el, '::after'), el => [el.querySelector('.benefit-status'), el.querySelector('.benefit-index')]],
    ['hero', '.benefit-hero-art', el => glyph(el, '::before'), el => [el.querySelector('.benefit-index')]],
    ['detail', '.benefit-detail-hero', el => glyph(el.querySelector('.benefit-detail-title'), '::before'), el => el.querySelectorAll('.benefit-detail-top>*')],
    ['insight', '.member-insight .mi-hero.has-art', el => glyph(el.querySelector('h1')), el => el.querySelectorAll('.mi-hero-top>*')],
    ['app', '.app-card[class*="benefit-"] .app-art', el => glyph(el, '::after'), el => [el.querySelector('span')]],
    ['quick', '.quick-card[data-shortcut]', el => glyph(el, '::before'), () => null],
  ];
  for (const [kind, selector, wordOf, chipOf] of posters) for (const el of document.querySelectorAll(selector)) {
    const img = el.querySelector('img'); if (!img || !img.complete || !img.naturalWidth || !img.getClientRects().length) continue;
    const o = drawn(img), w = wordOf(el), chips = [...(chipOf(el) || [])].filter(Boolean).map(n => n.getBoundingClientRect()).filter(b => b.width);
    const xOverlap = (a, b) => a && b && Math.min(a.r, b.r ?? b.right) - Math.max(a.l, b.l ?? b.left) > 0;
    out.posters.push({ kind, id: el.closest('[class*="benefit-"],[data-shortcut]')?.className || '', src: img.currentSrc.split('/').pop(),
      // 큰 글자: 글자 가로 범위 안의 그림 점 가운데 가장 낮은 점과 글자 윗선의 거리. 칩: 칩 가로 범위 안의 가장 높은 그림 점과 칩 아랫선의 거리.
      gapWord: (() => { if (!w) return null; const ys = o.cloud.filter(([X]) => X >= w.l && X <= w.r).map(p => p[1]); return ys.length ? Math.round(w.t - Math.max(...ys)) : null; })(), word: w?.text,
      gapChip: (() => { const gaps = chips.map(b => { const ys = o.cloud.filter(([X]) => X >= b.left - 2 && X <= b.right + 2).map(p => p[1]); return ys.length ? Math.min(...ys) - b.bottom : null; }).filter(v => v !== null); return gaps.length ? Math.round(Math.min(...gaps)) : null; })(),
      need: Math.ceil(Math.max(o.dw, 1) * devicePixelRatio), needH: Math.ceil(o.dh * devicePixelRatio), natural: img.naturalWidth });
  }
  for (const img of document.querySelectorAll('.benefit-related img')) if (img.naturalWidth) { const o = drawn(img); out.posters.push({ kind: 'related', src: img.currentSrc.split('/').pop(), need: Math.ceil(o.dw * devicePixelRatio), needH: Math.ceil(o.dh * devicePixelRatio), natural: img.naturalWidth, gapWord: null, gapChip: null }); }
  const region = '.benefit-hero,.benefit-collection,.benefit-home-collection,.benefit-card,.benefit-detail-hero,.benefit-availability,.benefit-how,.benefit-more,.benefit-promise,.member-insight,.back-link';
  const walker = document.createTreeWalker(document.getElementById('page-content') || document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement; if (!/[가-힣]/.test(node.textContent) || !el.closest(region) || el.closest('.sr-only,[hidden]')) continue;
    if (!el.getClientRects().length) continue; const cs = getComputedStyle(el), size = parseFloat(cs.fontSize);
    if (size < 13 - .01) out.small.push({ text: node.textContent.trim().slice(0, 24), size, cls: el.className });
  }
  for (const sel of ['.benefit-hero h1', '.benefit-copy h2', '.benefit-detail-hero h1', '.benefit-how h2', '.benefit-promise h2', '.benefit-kicker', '.benefit-copy>p', '.benefit-card .benefit-status']) { const el = document.querySelector(sel); if (el) out.weights.push([sel, getComputedStyle(el).fontWeight, getComputedStyle(el).fontSize]); }
  return out;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
// 「담음」 판은 기기 라이브러리에 혜택 넷을 담고 즐겨찾기·최근 선택까지 채워, 둘러보기 카드와 홈 바로가기에 나오는 혜택 물건도 잰다.
const SAVED = ['care', 'fortune', 'rehearsal', 'family-album'];
const LIBRARY = { version: 1, saved: SAVED, favorites: SAVED, recent: SAVED.map((id, i) => ({ id, at: 1760000000000 - i * 60000, mode: 'web' })), rememberRecent: true, compact: false, collections: { learn: [], work: [] } };
for (const [theme, seeded] of [['night', false], ['day', false], ['night', true]]) for (const [width, height, scale] of SIZES) {
  if ((theme === 'day' || seeded) && ![1440, 390].includes(width)) continue;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, locale: 'ko-KR', colorScheme: theme === 'day' ? 'light' : 'dark', isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block' });
  await context.addInitScript(([value, library]) => { try { localStorage.setItem('synk.platform.theme', value); if (library) localStorage.setItem('synk.platform.device-library.v1', JSON.stringify(library)); } catch {} }, [theme, seeded ? LIBRARY : null]);
  // SYNK_CANDIDATE_DIR: 공개 전 후보. 실제 https://synk.im/ 주소를 열되, 그 폴더에 같은 경로의 파일이 있으면 그 바이트를 돌려준다(현장 노트 배포·공개).
  if (process.env.SYNK_CANDIDATE_DIR) await context.route('https://synk.im/**', async route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, ''), file = path.join(process.env.SYNK_CANDIDATE_DIR, rel);
    if (rel && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ body: fs.readFileSync(file), contentType: ({ '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream' });
    return route.continue();
  });
  const page = await context.newPage(), problems = [];
  page.on('response', r => { if (r.status() >= 400 && !/config\.json$|desktop\/releases\/preview\.json$/.test(r.url())) problems.push(`${r.status()} ${r.url().split('/synk-account/')[1] || r.url()}`); });
  page.on('pageerror', e => problems.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/config\.json|404/.test(m.text())) problems.push('console ' + m.text().slice(0, 160)); });
  for (const view of seeded ? ['#home', '#library'] : VIEWS) {
    await page.goto(pageUrl + (view === '#home' ? '' : view), { waitUntil: 'networkidle' });
    if (view !== '#home') { await page.evaluate(v => { if (location.hash !== v) location.hash = v; }, view); await page.waitForTimeout(150); }
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => { await Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))); });
    const result = await page.evaluate(measure);
    const row = { theme: seeded ? theme + ' 담음' : theme, width, height, scale, view, ...result };
    report.views.push(row);
    for (const p of result.posters) { const key = p.src; report.need[key] = Math.max(report.need[key] || 0, p.need); report.need[key + ' (높이)'] = Math.max(report.need[key + ' (높이)'] || 0, p.needH); }
    if (result.overflow) report.problems.push(`${theme} ${width} ${view}: 가로 넘침`);
    for (const p of result.posters) {
      if (p.gapWord !== null && p.gapWord < 4) report.problems.push(`${theme} ${width}×${height} ${view} ${p.kind} ${p.src}: 물건과 「${p.word}」 사이 ${p.gapWord}px`);
      if (p.gapChip !== null && p.gapChip < 2) report.problems.push(`${theme} ${width}×${height} ${view} ${p.kind} ${p.src}: 물건과 칩 사이 ${p.gapChip}px`);
    }
    for (const s of result.small) report.problems.push(`${theme} ${width} ${view}: 한글 ${s.size}px 「${s.text}」(${s.cls})`);
    if (shots && [1440, 390].includes(width)) {
      const name = `${theme}${seeded ? '-saved' : ''}-${width}-${view.slice(1).replace('/', '_')}`;
      const full = view === '#benefits' || view === '#home';
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(outDir, name + '.png'), fullPage: full, clip: full ? undefined : { x: 0, y: 0, width, height: Math.min(height, width < 600 ? 844 : 900) } });
    }
  }
  for (const p of problems) report.problems.push(`${theme} ${width}: ${p}`);
  await context.close();
}
await browser.close();
report.problems = [...new Set(report.problems)];
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
const gaps = report.views.flatMap(v => v.posters.map(p => ({ ...p, at: `${v.theme} ${v.width}×${v.height} ${v.view}` })));
const minOf = key => gaps.filter(p => p[key] !== null).sort((a, b) => a[key] - b[key])[0];
console.log('화면', report.views.length, '· 포스터', gaps.length, '· 문제', report.problems.length);
console.log('가장 좁은 물건–큰 글자', JSON.stringify(minOf('gapWord')));
console.log('가장 좁은 물건–칩', JSON.stringify(minOf('gapChip')));
console.log('필요 픽셀(가로·높이 최대)', JSON.stringify(report.need));
for (const p of report.problems.slice(0, 40)) console.log(' -', p);
