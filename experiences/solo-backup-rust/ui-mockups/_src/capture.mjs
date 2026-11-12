// 시안 캡처 — node experiences/solo-backup-rust/ui-mockups/_src/capture.mjs <출력 폴더> [a|b …] [--화면 home,start-2] [--폭 1440,390]
// 화면마다 1440(창 1440×900) · 390(전체 길이)을 찍고, 가로 넘침 · 대비 낮은 글을 재서 report.json에 남긴다.
// Playwright는 이 작업본에 없으면 공용 작업본(tools/lib/공용작업본.js)의 것을 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCREENS } from './copy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch {
  const { 공용작업본 } = require(path.join(repo, 'tools/lib/공용작업본.js'));
  playwright = createRequire(path.join(공용작업본(repo), 'package.json'))('playwright');
}

const args = process.argv.slice(2);
const outDir = path.resolve(args[0] || '.');
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const keys = args.slice(1).filter((a) => a === 'a' || a === 'b');
const only = flag('--화면')?.split(',');
const widths = (flag('--폭') || '1440,390').split(',').map(Number);
const FILES = { a: 'a-확인서.html', b: 'b-눈금.html' };
fs.mkdirSync(outDir, { recursive: true });

const browser = await playwright.chromium.launch({ channel: 'chrome' });
const report = [];
for (const key of keys.length ? keys : ['a', 'b']) {
  const file = path.resolve(here, '..', FILES[key]);
  if (!fs.existsSync(file)) continue;
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w > 900 ? 900 : 844 }, deviceScaleFactor: w > 900 ? 1 : 2, reducedMotion: 'reduce' });
    const pg = await ctx.newPage();
    for (const [id] of SCREENS) {
      if (only && !only.includes(id)) continue;
      await pg.goto(pathToFileURL(file).href + `?cap#${id}`);
      await pg.evaluate(() => document.fonts.ready);
      await pg.waitForTimeout(80);
      const m = await pg.evaluate(() => {
        const doc = document.documentElement;
        const over = Math.max(doc.scrollWidth, document.body.scrollWidth) - innerWidth;
        // 대비: 보이는 글 요소마다 글자색 vs 가장 가까운 칠한 바탕
        const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const a = c.match(/[\d.]+/g); if (a && (a.length < 4 || +a[3] > 0.9)) return c; } return 'rgb(255,255,255)'; };
        const low = [];
        const scr = document.querySelector('.scr.on');
        for (const el of scr.querySelectorAll('*')) {
          if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const L1 = lum(cs.color), L2 = lum(bgOf(el)); if (L1 == null || L2 == null) continue;
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
          if (ratio < (big ? 3 : 4.5)) low.push({ t: el.textContent.trim().slice(0, 30), ratio: +ratio.toFixed(2), size: cs.fontSize });
        }
        const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family}:${f.weight}`);
        return { over, low, fonts, h: doc.scrollHeight };
      });
      // 좁은 창: 휴대폰 한 화면(아래 붙는 막대가 보이는 그대로) + 전체 길이(막대를 제자리에 둔 판)
      await pg.screenshot({ path: path.join(outDir, `${key}-${id}-${w}.png`) });
      if (w <= 900) {
        await pg.evaluate(() => document.body.classList.add('is-full'));
        await pg.screenshot({ path: path.join(outDir, `${key}-${id}-${w}-full.png`), fullPage: true });
        await pg.evaluate(() => document.body.classList.remove('is-full'));
      }
      report.push({ key, id, w, ...m });
      if (m.over > 0 || m.low.length) console.log(`! ${key} ${id} ${w}: 넘침 ${m.over}px · 낮은 대비 ${m.low.length}`, m.low.slice(0, 4));
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
console.log(`캡처 ${report.length}장 → ${outDir}`);
