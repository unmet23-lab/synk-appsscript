// 시안 세 갈래 × 장면 열넷 × 1440 · 390 을 찍고 잰다 — 가로 넘침 · 글 대비(4.5:1, 큰 글 3:1) · 실린 글꼴 · 쪽 오류.
//   node docs/디자인/SYNK_ID_로그인/시안_20261111/재기.mjs <playwright 폴더> <나갈 폴더> [a|b|c ...]
// 찍은 그림은 <나갈 폴더>/<갈래>/<폭>/<장면>.png, 잰 값은 report.json.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [pwDir, out, ...only] = process.argv.slice(2);
if (!pwDir || !out) throw new Error('usage: 재기.mjs <playwright dir> <out dir> [a|b|c ...]');
const { chromium } = createRequire(import.meta.url)(path.resolve(pwDir));
const here = path.dirname(fileURLToPath(import.meta.url));
const MOCKS = { a: 'a-한칸.html', b: 'b-카드.html', c: 'c-줄목록.html' };
const IDS = ['first', 'email', 'wrong', 'back-email', 'back-google', 'signup', 'signup-email', 'recover', 'reset', 'no-google', 'onboarding', 'consent', 'restart', 'account'];
const report = { made: new Date().toISOString(), shots: [] };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome' });
function audit() {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  const low = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();if (!t) continue;const el = n.parentElement, cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    let fg = parse(cs.color);if (!fg) continue;const bg = bgOf(el);
    if (fg.a < 1) fg = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const ratio = (Math.max(L(fg), L(bg)) + 0.05) / (Math.min(L(fg), L(bg)) + 0.05), size = parseFloat(cs.fontSize), big = size >= 24 || size >= 18.66 && +cs.fontWeight >= 700;
    const disabled = !!el.closest(':disabled');
    if (!disabled && ratio < (big ? 3 : 4.5)) low.push({ t: t.slice(0, 40), ratio: +ratio.toFixed(2), size });
  }
  const fams = new Set();document.querySelectorAll('body *').forEach(e => { if (e.childNodes.length && [...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) fams.add(getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '').trim()); });
  const sizes = new Set(), weights = new Set();document.querySelectorAll('body *').forEach(e => { if ([...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) { const cs = getComputedStyle(e);sizes.add(parseFloat(cs.fontSize));weights.add(+cs.fontWeight); } });
  return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), low, families: [...fams], loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '') + ' ' + f.weight), sizes: [...sizes].sort((a, b) => a - b), weights: [...weights].sort((a, b) => a - b), height: document.documentElement.scrollHeight };
}
try {
  for (const [key, file] of Object.entries(MOCKS)) {
    if (only.length && !only.includes(key)) continue;
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, deviceScaleFactor: 1 });
      const tab = await ctx.newPage(), errors = [];
      tab.on('pageerror', e => errors.push(String(e).slice(0, 200)));tab.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      const url = pathToFileURL(path.join(here, file)).href;
      await tab.goto(url + '#first', { waitUntil: 'load' });await tab.evaluate(() => document.fonts.ready);
      for (const id of IDS) {
        await tab.evaluate(h => { location.hash = h; }, id);await tab.waitForTimeout(120);await tab.evaluate(() => document.fonts.ready);
        const dir = path.join(out, key, String(width));fs.mkdirSync(dir, { recursive: true });
        await tab.screenshot({ path: path.join(dir, id + '.png'), fullPage: true });
        report.shots.push({ mock: key, width, id, ...(await tab.evaluate(audit)), errors: [...errors] });errors.length = 0;
      }
      await ctx.close();
    }
  }
} finally { await browser.close(); }
const bad = report.shots.filter(s => s.overflow || s.low.length || s.errors.length);
report.summary = { shots: report.shots.length, overflow: report.shots.filter(s => s.overflow).length, lowContrast: report.shots.filter(s => s.low.length).length, errors: report.shots.filter(s => s.errors.length).length, families: [...new Set(report.shots.flatMap(s => s.families))], sizes: [...new Set(report.shots.flatMap(s => s.sizes))].sort((a, b) => a - b), weights: [...new Set(report.shots.flatMap(s => s.weights))].sort((a, b) => a - b) };
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.summary));
for (const s of bad.slice(0, 20)) console.log(s.mock, s.width, s.id, 'overflow', s.overflow, 'low', JSON.stringify(s.low.slice(0, 3)), s.errors.slice(0, 2).join(' | '));
