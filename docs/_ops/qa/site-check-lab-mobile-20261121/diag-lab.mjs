// 진단(2026-11-21): synk.im 배포 점검에서 /lab/ 휴대폰 그림만 회차마다 「흔들림」(잇단 두 장이 바이트로 같지 않음)인 까닭을
// 점검과 같은 실행기(ubuntu-24.04, playwright 1.62.1, SwiftShader)에서 가른다. visual.mjs의 capturePage와 같은 순서로 열고
// (움직임 줄이기 · 고정 시각 · settle · 영상 숨김 · 캔버스와 iframe 가림), 여섯 장을 모두 PNG로 찍어 잇단 장이 다른 띠와
// 그 자리의 요소, 장 사이의 DOM 변화 · 돌고 있는 애니메이션을 site-check-artifacts/diag.json에 남긴다.
// 처음으로 다른 두 장은 그림으로도 남긴다(site-check-artifacts/<쪽>-<기기>-r<회>-s<장>.png).
import fs from 'node:fs';
import {settle, hideVideos, tilesOf, VISUAL_DEVICES, FIXED_TIME, MAX_HEIGHT} from './visual.mjs';

const {chromium} = await import('playwright');
const base = process.env.SITE_BASE || 'https://synk.im';
const out = 'site-check-artifacts';
fs.mkdirSync(out, {recursive: true});
const ROUTES = JSON.parse(process.env.DIAG_ROUTES || '[["/lab/","mobile",6],["/en/lab/","mobile",3],["/lab/","desktop",2]]');
const WARM = JSON.parse(process.env.DIAG_WARM || '[]');
// 바꿔 볼 CSS([이름, CSS]) — 쪽을 연 바로 뒤 CSSOM(adoptedStyleSheets)으로 얹는다(CSP가 style 태그를 막아도 먹는다)
const VARIANTS = JSON.parse(process.env.DIAG_VARIANTS || '[["그대로",""]]');   // 점검처럼 앞서 찍어 둘 쪽([쪽, 기기]) — 브라우저가 쪽을 여럿 지난 뒤의 상태를 흉내 낸다
const SHOTS = 6, GAP = 500;
const browser = await chromium.launch({headless: true, ...(process.env.PW_CHANNEL ? {channel: process.env.PW_CHANNEL} : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});

// 쪽 스크립트보다 먼저 돈다: resize와 DOM 변화를 시각과 함께 남긴다(찍기 전에 비운다)
function probe() {
  window.__log = [];
  const t0 = performance.now();
  const note = (k, x) => { if (window.__log.length < 400) window.__log.push({t: Math.round(performance.now() - t0), k, x}); };
  addEventListener('resize', () => note('resize', `${innerWidth}x${innerHeight}`));
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(list => {
      for (const m of list) {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!el) continue;
        const id = `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className ?? '').split(' ').slice(0, 2).join('.')}`;
        const v = m.attributeName === 'style' || m.attributeName === 'class' ? String(el.getAttribute(m.attributeName)).slice(0, 100) : '';
        note('mut', `${m.type} ${id} ${m.attributeName || ''} ${v}`.trim());
      }
    }).observe(document.documentElement, {subtree: true, attributes: true, childList: true, characterData: true});
  });
}

const state = page => page.evaluate(() => {
  const log = window.__log.splice(0);
  const anims = document.getAnimations().filter(a => a.playState === 'running').slice(0, 12).map(a => {
    const t = a.effect?.target;
    return `${a.constructor.name} ${t ? `${t.tagName?.toLowerCase()}.${String(t.className?.baseVal ?? t.className ?? '').split(' ')[0]}` : '-'} ${a.animationName || a.transitionProperty || ''}`;
  });
  const imgs = [...document.images].filter(i => !i.complete).length;
  return {log, anims, pendingImgs: imgs, res: performance.getEntriesByType('resource').length, scrollY};
});

// 잇단 두 PNG가 다른 띠(행 20px 안은 한 띠). 기기 화소 그대로
const bandsOf = (page, a, b) => page.evaluate(async ({a, b}) => {
  const load = s => createImageBitmap(new Blob([Uint8Array.from(atob(s), c => c.charCodeAt(0))], {type: 'image/png'}), {colorSpaceConversion: 'none', premultiplyAlpha: 'none'});
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return {size: [ia.width, ia.height, ib.width, ib.height]};
  const W = ia.width, H = ia.height;
  const px = bm => { const g = new OffscreenCanvas(W, H).getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, W, H).data; };
  const da = px(ia), db = px(ib);
  const bands = []; let total = 0;
  for (let y = 0; y < H; y++) {
    let mx = 0, x0 = -1, x1 = -1, n = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d) { n++; if (d > mx) mx = d; if (x0 < 0) x0 = x; x1 = x; }
    }
    if (!n) continue;
    total += n;
    const l = bands[bands.length - 1];
    if (l && y - l.y1 <= 20) { l.y1 = y; l.x0 = Math.min(l.x0, x0); l.x1 = Math.max(l.x1, x1); l.max = Math.max(l.max, mx); l.n += n; }
    else bands.push({y0: y, y1: y, x0, x1, max: mx, n});
  }
  return {total, bands: bands.slice(0, 30)};
}, {a: a.toString('base64'), b: b.toString('base64')});

// 띠 가운데(CSS 화소)에 겹친 요소 가운데 가장 안쪽 여섯과 그리기 특성
const whoAt = (page, pts) => page.evaluate(pts => pts.map(([x, y]) => {
  const hits = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    const top = r.top + scrollY, left = r.left + scrollX;
    if (r.width && r.height && left <= x && x <= left + r.width && top <= y && y <= top + r.height) hits.push(el);
  }
  return {x, y, deep: hits.slice(-6).map(el => {
    const cs = getComputedStyle(el);
    const f = [cs.willChange !== 'auto' && `wc:${cs.willChange}`, cs.transform !== 'none' && `tf:${cs.transform.slice(0, 40)}`, cs.filter !== 'none' && `filter:${cs.filter}`,
      cs.mixBlendMode !== 'normal' && `blend:${cs.mixBlendMode}`, +cs.opacity < 1 && `op:${cs.opacity}`, ['fixed', 'sticky'].includes(cs.position) && cs.position,
      cs.backfaceVisibility === 'hidden' && 'backface', cs.transformStyle === 'preserve-3d' && '3d', el.tagName === 'IMG' && `img:${(el.currentSrc || '').split('/').pop()}`].filter(Boolean).join(' ');
    return `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className ?? '').split(' ').slice(0, 2).join('.')} ${f}`.trim();
  })};
}), pts);

async function capture(route, device, {keep = true, tag = '', css = ''} = {}) {
  const context = await browser.newContext({...device.options, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'ko-KR', timezoneId: 'Asia/Seoul'});
  try {
    await context.clock.setFixedTime(new Date(FIXED_TIME));
    await context.addInitScript(probe);
    const page = await context.newPage();
    await page.goto(base + route, {waitUntil: 'load', timeout: 90000});
    if (css) await page.evaluate(css => { const s = new CSSStyleSheet(); s.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }, css);
    await settle(page);
    await hideVideos(page);
    const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0));
    const clipHeight = Math.min(height, MAX_HEIGHT);
    const width = device.options.viewport.width, scale = device.options.deviceScaleFactor;
    const common = {fullPage: true, animations: 'disabled', caret: 'hide', mask: [page.locator('canvas, iframe')], maskColor: '#FF00FF'};
    const tiles = tilesOf(clipHeight, scale);
    const shoot = async () => { const parts = []; for (const t of tiles) parts.push(await page.screenshot({type: 'png', ...common, clip: {x: 0, y: t.y, width, height: t.height}})); return parts; };
    await state(page);   // settle까지의 기록은 버린다
    const shots = [], between = [];
    for (let i = 0; i < SHOTS; i++) {
      if (i) await page.waitForTimeout(GAP);
      const t = Date.now();
      shots.push(await shoot());
      between.push({ms: Date.now() - t, ...(await state(page))});
    }
    if (!keep) return null;
    const pairs = [];
    let saved = false;
    for (let i = 1; i < SHOTS; i++) {
      const same = shots[i].every((b, j) => b.equals(shots[i - 1][j]));
      if (same) { pairs.push({pair: `${i - 1}-${i}`, same}); continue; }
      const tileDiffs = [];
      for (let j = 0; j < tiles.length; j++) {
        if (shots[i][j].equals(shots[i - 1][j])) continue;
        const d = await bandsOf(page, shots[i - 1][j], shots[i][j]);
        const pts = (d.bands || []).slice(0, 8).map(b => [Math.round((b.x0 + b.x1) / 2 / scale), Math.round(tiles[j].y + (b.y0 + b.y1) / 2 / scale)]);
        tileDiffs.push({tile: j, tileY: tiles[j].y, ...d, who: pts.length ? await whoAt(page, pts) : []});
      }
      pairs.push({pair: `${i - 1}-${i}`, same, tiles: tileDiffs});
      if (!saved) {
        saved = true;
        const slug = route.replace(/^\/+|\/+$/g, '').replace(/\//g, '~') || 'home';
        for (const k of [i - 1, i]) shots[k].forEach((b, j) => fs.writeFileSync(`${out}/${slug}-${device.key}-${tag}-s${k}${tiles.length > 1 ? `-t${j}` : ''}.png`, b));
      }
    }
    const stableAt = pairs.findIndex(p => p.same);
    return {route, device: device.key, tag, height, tiles: tiles.length, unstableInCheck: stableAt < 0, stableAtPair: stableAt < 0 ? null : pairs[stableAt].pair, between, pairs};
  } finally { await context.close(); }
}

const result = {when: new Date().toISOString(), chromium: browser.version(), warm: WARM.length, runs: []};
for (const [route, key] of WARM) {
  try { await capture(route, VISUAL_DEVICES.find(d => d.key === key), {keep: false}); } catch (e) { console.log('warm', route, String(e).slice(0, 120)); }
}
for (const [vname, css] of VARIANTS) for (const [route, key, times] of ROUTES) {
  const device = VISUAL_DEVICES.find(d => d.key === key);
  for (let r = 0; r < times; r++) {
    try {
      const x = await capture(route, device, {tag: `v${VARIANTS.findIndex(v => v[0] === vname)}r${r}`, css});
      x.variant = vname;
      result.runs.push(x);
      const diffs = x.pairs.filter(p => !p.same);
      console.log(`[${vname}] ${route} ${key} r${r}: 점검이면 ${x.unstableInCheck ? '흔들림' : `안정(${x.stableAtPair})`} · 다른 쌍 ${diffs.length}/${x.pairs.length}`
        + diffs.slice(0, 2).map(p => ` | ${p.pair}: ` + p.tiles.map(t => (t.bands || []).slice(0, 4).map(b => `y${b.y0}-${b.y1} x${b.x0}-${b.x1} max${b.max} n${b.n}`).join(', ')).join(' / ')).join(''));
    } catch (e) {
      result.runs.push({variant: vname, route, device: key, r, error: String(e).slice(0, 300)});
      console.log(route, key, r, '오류', String(e).slice(0, 200));
    }
    fs.writeFileSync(`${out}/diag.json`, JSON.stringify(result, null, 1));
  }
}
await browser.close();
