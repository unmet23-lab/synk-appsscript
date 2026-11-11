// 시안 세 갈래 × 장면 열다섯을 찍고 잰다.
//   node docs/디자인/SYNK_ID_로그인/시안_20261111/재기.mjs <playwright 폴더> <나갈 폴더> [a|b|c ...]
// 1440 · 390: 그림 + 가로 넘침 · 글 대비(4.5:1, 큰 글 3:1 — 자리 글 포함) · 실린 글꼴 · 크기 · 굵기 · 누르는 칸(44px 미만) · 쪽 오류.
// 320 · 360 · 768 · 901 · 1024 · 1280 · 1920: 가로 넘침과 「최근 사용」 표 ↔ 단추 글 겹침만(그림 없음).
// Tab 순서: 이메일을 고른 장면에서 이메일 칸 → 비밀번호 칸 → 보기 → 잊었어요 차례인지(잊었어요가 비밀번호 칸보다 먼저 오면 안 된다).
// 그림은 <나갈 폴더>/<갈래>/<폭>/<장면>.png, 잰 값은 report.json.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [pwDir, out, ...only] = process.argv.slice(2);
if (!pwDir || !out) throw new Error('usage: 재기.mjs <playwright dir> <out dir> [a|b|c ...]');
const { chromium } = createRequire(import.meta.url)(path.resolve(pwDir));
const here = path.dirname(fileURLToPath(import.meta.url));
const MOCKS = { a: 'a-한칸.html', b: 'b-선반.html', c: 'c-두줄인사.html' };
const IDS = ['first', 'email', 'wrong', 'back-email', 'back-google', 'signup', 'signup-email', 'sent', 'recover', 'reset', 'no-google', 'onboarding', 'consent', 'restart', 'account'];
const SHOT = [1440, 390], EXTRA = [320, 360, 768, 901, 1024, 1280, 1920];
const report = { made: new Date().toISOString(), shots: [], widths: [], tab: {} };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome' });
function audit() {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  const ratioOf = (fg, bg) => (Math.max(L(fg), L(bg)) + 0.05) / (Math.min(L(fg), L(bg)) + 0.05);
  const shown = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity !== 0; };
  const low = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();if (!t) continue;const el = n.parentElement;if (!shown(el) || el.closest('script,style')) continue;const cs = getComputedStyle(el);
    let fg = parse(cs.color);if (!fg) continue;const bg = bgOf(el);
    if (fg.a < 1) fg = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const size = parseFloat(cs.fontSize), big = size >= 24 || size >= 18.66 && +cs.fontWeight >= 700;
    // 꺼 둔 Google 단추(쓸 수 없을 때)는 글이 흐려도 그 뜻이라 뺀다
    if (!el.closest('[data-off]') && ratioOf(fg, bg) < (big ? 3 : 4.5)) low.push({ t: t.slice(0, 40), ratio: +ratioOf(fg, bg).toFixed(2), size });
  }
  for (const input of document.querySelectorAll('input[placeholder]')) { if (!shown(input) || input.value) continue;const c = parse(getComputedStyle(input, '::placeholder').color);if (c && ratioOf(c, bgOf(input)) < 4.5) low.push({ t: '자리 글 ' + input.placeholder, ratio: +ratioOf(c, bgOf(input)).toFixed(2) }); }
  const sizes = new Set(), weights = new Set(), fams = new Set();
  document.querySelectorAll('body *').forEach(e => { if (shown(e) && [...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) { const cs = getComputedStyle(e);sizes.add(parseFloat(cs.fontSize));weights.add(+cs.fontWeight);fams.add(cs.fontFamily.split(',')[0].replace(/"/g, '').trim()); } });
  // 누르는 칸: 단추 · 링크 · 접기 머리 · 체크(그 이름표 넓이)
  const small = [];
  for (const el of document.querySelectorAll('button,a[href],summary,label.toggle,select')) { if (!shown(el) || el.matches('p a')) continue; // 문장 속 링크는 글줄 높이 그대로(WCAG 2.5.8 문장 속 예외)
   const r = el.getBoundingClientRect();if (r.height < 43.5 || r.width < 43.5) small.push(`${(el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 16)} ${Math.round(r.width)}×${Math.round(r.height)}`); }
  // 「최근 사용」 표와 단추 글의 틈
  const gaps = [];
  for (const b of document.querySelectorAll('.method-btn')) { const badge = b.querySelector('.recent-badge'), label = b.querySelector('.method-label');if (!badge || badge.hidden || !label) continue;const range = document.createRange();range.selectNodeContents(label);gaps.push(Math.round(badge.getBoundingClientRect().left - range.getBoundingClientRect().right)); }
  return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), low, small, gaps, families: [...fams], sizes: [...sizes].sort((a, b) => a - b), weights: [...weights].sort((a, b) => a - b), height: document.documentElement.scrollHeight };
}
try {
  for (const [key, file] of Object.entries(MOCKS)) {
    if (only.length && !only.includes(key)) continue;
    const url = pathToFileURL(path.join(here, file)).href;
    for (const width of [...SHOT, ...EXTRA]) {
      const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, deviceScaleFactor: 1 });
      const tab = await ctx.newPage(), errors = [];
      tab.on('pageerror', e => errors.push(String(e).slice(0, 200)));
      tab.on('console', m => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text().slice(0, 200)); }); // 글꼴 · 선반 그림의 첫 주소(비교 쪽 폴더)는 저장소에 없어 둘째로 넘어간다
      await tab.goto(url + '#first', { waitUntil: 'load' });await tab.evaluate(() => document.fonts.ready);
      for (const id of IDS) {
        await tab.evaluate(h => { location.hash = h; }, id);await tab.waitForTimeout(120);await tab.evaluate(() => document.fonts.ready);
        const a = await tab.evaluate(audit);
        if (SHOT.includes(width)) {
          const dir = path.join(out, key, String(width));fs.mkdirSync(dir, { recursive: true });
          await tab.waitForFunction(() => [...document.images].every(i => i.complete));
          await tab.screenshot({ path: path.join(dir, id + '.png'), fullPage: true });
          report.shots.push({ mock: key, width, id, ...a, errors: [...errors] });
        } else report.widths.push({ mock: key, width, id, overflow: a.overflow, gaps: a.gaps });
        errors.length = 0;
      }
      if (width === 1440) {
        await tab.evaluate(() => { location.hash = 'email'; });await tab.waitForTimeout(120);
        await tab.focus('#email');const order = ['email'];
        for (let i = 0; i < 4; i++) { await tab.keyboard.press('Tab');order.push(await tab.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim().slice(0, 12))); }
        report.tab[key] = order;
      }
      await ctx.close();
    }
  }
} finally { await browser.close(); }
const uniq = a => [...new Set(a)];
report.summary = {
  shots: report.shots.length, overflow: report.shots.filter(s => s.overflow).length, lowContrast: report.shots.filter(s => s.low.length).length, smallTargets: report.shots.filter(s => s.small.length).length, errors: report.shots.filter(s => s.errors.length).length,
  otherWidthsOverflow: report.widths.filter(s => s.overflow).map(s => `${s.mock} ${s.width} ${s.id} +${s.overflow}`), badgeGapMin: Math.min(...report.shots.concat(report.widths).flatMap(s => s.gaps), 999),
  families: uniq(report.shots.flatMap(s => s.families)), sizes: uniq(report.shots.flatMap(s => s.sizes)).sort((a, b) => a - b), weights: uniq(report.shots.flatMap(s => s.weights)).sort((a, b) => a - b), tab: report.tab,
};
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.summary));
for (const s of report.shots.filter(s => s.overflow || s.low.length || s.small.length || s.errors.length).slice(0, 24)) console.log(s.mock, s.width, s.id, 'overflow', s.overflow, 'low', JSON.stringify(s.low.slice(0, 3)), 'small', JSON.stringify(s.small.slice(0, 5)), s.errors.slice(0, 2).join(' | '));
