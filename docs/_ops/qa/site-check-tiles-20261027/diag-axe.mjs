// 진단(2026-10-27): 배포 점검 6단계에서 /path/ 휴대폰의 axe scrollable-region-focusable이 나눠 찍기 뒤에만 난 까닭을
// 점검과 같은 실행기(ubuntu-24.04, playwright 1.62.1, SwiftShader)에서 가른다. 흐름마다 새 context로 쪽을 열어
// resize · 화면 보임 · 가로 칸 tabindex 변화를 기록하고 axe를 돌린다. 결과는 site-check-artifacts/diag.json.
// visual.mjs는 고칠 판(찍은 쪽 안에서 잇기)이고, 옛 잇기(새 쪽을 열어 잇기)는 아래 stitchInNewPage로 둔다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {settle, tilesOf, stableShot, stitchJpeg, replayResize, runAxe, VISUAL_DEVICES, FIXED_TIME, MAX_HEIGHT, JPEG_QUALITY} from './visual.mjs';

const require = createRequire(import.meta.url);
// 손으로 돌릴 때는 check.mjs처럼 PLAYWRIGHT_MODULE · AXE_SOURCE로 준다.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const axeSource = fs.readFileSync(process.env.AXE_SOURCE || require.resolve('axe-core/axe.min.js'), 'utf8');
const base = 'https://synk.im';
const out = 'site-check-artifacts';
fs.mkdirSync(out, {recursive: true});
const browser = await chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
const mobile = VISUAL_DEVICES.find(d => d.key === 'mobile');

// 쪽 스크립트보다 먼저 돈다: resize · 보임 · 초점과 가로 칸 tabindex 바뀜을 그때의 크기·칸 폭과 함께 남긴다.
function probe() {
  window.__log = [];
  const t0 = performance.now();
  const cells = () => [...document.querySelectorAll('[data-scroll-x]')].map(e => `${e.scrollWidth}/${e.clientWidth}/${e.getAttribute('tabindex')}`);
  const note = kind => window.__log.push({t: Math.round(performance.now() - t0), kind, w: innerWidth, h: innerHeight, vis: document.visibilityState, cells: cells()});
  addEventListener('resize', () => note('resize'));
  document.addEventListener('visibilitychange', () => note('visibility'));
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(() => note('tabindex')).observe(document.documentElement, {subtree: true, attributes: true, attributeFilter: ['tabindex']});
  });
  window.__note = note;
}

const options = (page, type, clip) => ({type, ...(type === 'jpeg' ? {quality: JPEG_QUALITY} : {}), fullPage: true, animations: 'disabled', caret: 'hide',
  mask: [page.locator('video, canvas, iframe')], maskColor: '#FF00FF', clip});
const full = ({page, width, height}) => stableShot(page, () => page.screenshot(options(page, 'jpeg', {x: 0, y: 0, width, height})));
const pieces = ({page, width, height}) => stableShot(page, async () => {
  const parts = [];
  for (const t of tilesOf(height, mobile.options.deviceScaleFactor)) parts.push(await page.screenshot(options(page, 'png', {x: 0, y: t.y, width, height: t.height})));
  return parts;
});
async function stitchInNewPage(tiles) {
  const page = await browser.newPage();
  try {
    const data = await page.evaluate(async ({tiles, quality}) => {
      const images = await Promise.all(tiles.map(b64 => createImageBitmap(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], {type: 'image/png'}),
        {colorSpaceConversion: 'none', premultiplyAlpha: 'none'})));
      const canvas = document.createElement('canvas');
      canvas.width = images[0].width;
      canvas.height = images.reduce((sum, image) => sum + image.height, 0);
      const g = canvas.getContext('2d');
      let y = 0;
      for (const image of images) { g.drawImage(image, 0, y); y += image.height; }
      return canvas.toDataURL('image/jpeg', quality / 100).split(',')[1];
    }, {tiles: tiles.map(b => b.toString('base64')), quality: JPEG_QUALITY});
    return Buffer.from(data, 'base64');
  } finally { await page.context().close(); }
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
const bytes = {};
const blank = async () => { const p = await browser.newPage(); await p.evaluate(() => 1); await p.context().close(); };
const axe = async page => { await page.evaluate(() => window.__note('axe')); return runAxe(page, axeSource); };

const FLOWS = {
  'A 옛: 한 번에 찍기 → axe': async x => { await full(x); return axe(x.page); },
  'B 처음 판(f05a681): 나눠 찍기 → 새 쪽 잇기 → axe': async x => { const r = await pieces(x); await stitchInNewPage(r.image); return axe(x.page); },
  'C 지금 판(b9313a5): 나눠 찍기 → axe → 새 쪽 잇기': async x => { const r = await pieces(x); const v = await axe(x.page); await stitchInNewPage(r.image); return v; },
  'D 나눠 찍기 → 빈 쪽 열고 닫기 → axe': async x => { await pieces(x); await blank(); return axe(x.page); },
  'E 찍기 없이 빈 쪽 열고 닫기 → axe': async x => { await blank(); return axe(x.page); },
  'H 고칠 판: 나눠 찍기 → 같은 쪽 잇기 → axe': async x => { const r = await pieces(x); await stitchJpeg(x.page, r.image); return axe(x.page); },
  'I 고칠 판(실제 순서): 나눠 찍기 → axe → 같은 쪽 잇기': async x => { const r = await pieces(x); const v = await axe(x.page); await stitchJpeg(x.page, r.image); return v; },
  'K 고칠 판 2: 나눠 찍기 → resize 바로잡기 → axe → 같은 쪽 잇기': async x => { const r = await pieces(x); await replayResize(x.page); const v = await axe(x.page); await stitchJpeg(x.page, r.image); return v; },
  'J 바이트 견줌: 나눠 찍기 → axe → 같은 쪽 잇기 · 새 쪽 잇기': async x => {
    const r = await pieces(x); const v = await axe(x.page);
    const a = await stitchJpeg(x.page, r.image), b = await stitchInNewPage(r.image);
    bytes[x.route] = {같은쪽: sha(a), 새쪽: sha(b), 같음: a.equals(b), 크기: [a.length, b.length]};
    return v;
  },
};

const results = [];
for (const [route, repeat] of JSON.parse(process.env.DIAG_ROUTES || '[["/path/", 3], ["/en/path/", 1], ["/pulse/", 1]]')) for (const [name, flow] of Object.entries(FLOWS).filter(([n]) => !process.env.DIAG_FLOWS || process.env.DIAG_FLOWS.includes(n[0]))) for (let i = 0; i < repeat; i++) {
  const context = await browser.newContext({...mobile.options, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'ko-KR', timezoneId: 'Asia/Seoul'});
  try {
    await context.clock.setFixedTime(new Date(FIXED_TIME));
    await context.addInitScript(probe);
    const page = await context.newPage();
    await page.goto(base + route, {waitUntil: 'load', timeout: 90000});
    await settle(page);
    const cssHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0));
    await page.evaluate(() => window.__note('ready'));
    const violations = await flow({page, route, width: mobile.options.viewport.width, height: Math.min(cssHeight, MAX_HEIGHT)});
    const srf = violations.find(v => v.id === 'scrollable-region-focusable');
    await page.evaluate(() => window.__note('end'));
    const log = await page.evaluate(() => window.__log);
    const r = {route, flow: name, i, cssHeight, srf: srf ? srf.count : 0, log};
    results.push(r);
    const at = k => log.filter(e => e.kind === k).at(-1);
    console.log(`${route} ${name} #${i}: srf ${r.srf} · resize ${log.filter(e => e.kind === 'resize').length}회 · tabindex 바뀜 ${log.filter(e => e.kind === 'tabindex').length}회 · axe 때 ${JSON.stringify(at('axe'))}`);
    for (const e of log.filter(e => e.kind !== 'ready')) console.log(`    ${e.t}ms ${e.kind} ${e.w}x${e.h} ${e.vis} [${e.cells.join(' | ')}]`);
  } catch (error) {
    results.push({route, flow: name, i, error: String(error).split('\n')[0]});
    console.log(`${route} ${name} #${i}: 오류 ${String(error).split('\n')[0]}`);
  } finally { await context.close(); }
}
const version = browser.version();
await browser.close();
fs.writeFileSync(path.join(out, 'diag.json'), JSON.stringify({chromium: version, bytes, results}, null, 1) + '\n');
console.log('\n## 요약');
console.log(`잇기 바이트: ${JSON.stringify(bytes)}`);
for (const name of Object.keys(FLOWS)) {
  const rs = results.filter(r => r.flow === name);
  console.log(`${name}: ${rs.map(r => `${r.route}#${r.i}=${r.error ? '오류' : r.srf}`).join(' ')}`);
}
