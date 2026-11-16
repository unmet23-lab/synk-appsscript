'use strict';
// 화면 캡처 · 점검 — dist/를 작은 로컬 서버로 띄우고 Chrome으로 모든 화면 × 창 크기를 찍는다.
//   node test-support/ui-shots.cjs <출력 폴더> [--폭 1080x820,760x640] [--화면 home,restore]
// 엔진 대신 window.__TAURI__ 흉내가 예시 상태(ui/engine-fixtures.js)를 돌려준다(브리지는 진짜 bridge.js가 돈다).
// 잰 것(report.json): 가로 넘침, 채운 알약이 첫 화면 안에 있는지, 화면 글 검사(T18), 쪽 오류, 글꼴이 실렸는지, 작은 글의 대비 4.5:1.
// 먼저 node scripts/stage-ui.cjs 로 dist/를 만든다. Playwright가 이 작업본에 없으면 공용 작업본의 것을 쓴다.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const APP = path.resolve(__dirname, '..');
const DIST = path.join(APP, 'dist');
const REPO = path.resolve(APP, '..', '..');
const args = process.argv.slice(2);
const out = path.resolve(args[0] || 'ui-shots');
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const sizes = (flag('--폭') || '1080x820,760x640').split(',').map((s) => s.split('x').map(Number));
const only = flag('--화면')?.split(',');

function playwright() {
  try { return require('playwright'); } catch {
    const { 공용작업본 } = require(path.join(REPO, 'tools/lib/공용작업본.js'));
    return require('node:module').createRequire(path.join(공용작업본(REPO), 'package.json'))('playwright');
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// 화면마다 쓸 예시 상태
const CASES = [
  ['home', 'home'], ['home-run', 'home'], ['home-partial', 'home'], ['home-missing', 'home'], ['home-mass', 'home'], ['home-moved', 'home'],
  ['home-overdue', 'home'], ['home-credential', 'home'], ['home-health', 'home'], ['home-paused', 'home'], ['home-off', 'home'], ['home-probe', 'home'], ['home-error', 'home'],
  ['start', 'start-1'], ['home', 'start-2'], ['home', 'start-3'], ['home', 'restore'], ['home-partial', 'partial'], ['home-partial', 'partial-std'],
  ['home', 'move-0'], ['home', 'move-1'], ['home', 'move-2'], ['home', 'move-3'], ['home', 'move-4'],
  ['home', 'undo-1'], ['home', 'undo-2'], ['home', 'undo-3'], ['home', 'lost'], ['home', 'lost-2'], ['home', 'code'], ['home-mass', 'mass-list'], ['home', 'drawer'],
];
const CATALOG = {
  profile: 'b2', token: 't', fileCount: 12480, totalBytes: 19756849561, query: '견적', offset: 0, total: 5, loading: false,
  selection: { revision: 3, count: 3, bytes: 6396314 },
  rows: [
    { id: '1', name: '견적서_1112_최종.pdf', source: 'C:\\Users\\studio\\Documents', path: '/견적/견적서_1112_최종.pdf', size: 1258291, mtime: '2026-11-12T10:00:00+09:00', selected: true },
    { id: '2', name: '견적서_1112_최종.hwp', source: 'C:\\Users\\studio\\Documents', path: '/견적/견적서_1112_최종.hwp', size: 90112, mtime: '2026-11-12T10:00:00+09:00', selected: true },
    { id: '3', name: '견적 참고 사진.jpg', source: 'C:\\Users\\studio\\Pictures', path: '/현장/견적 참고 사진.jpg', size: 5033164, mtime: '2026-11-09T10:00:00+09:00', selected: true },
    { id: '4', name: '견적 양식.xlsx', source: 'C:\\Users\\studio\\Documents', path: '/양식/견적 양식.xlsx', size: 47104, mtime: '2026-10-02T10:00:00+09:00', selected: false },
    { id: '5', name: '2026 견적 모음.zip', source: 'D:\\Projects', path: '/보관/2026 견적 모음.zip', size: 222298112, mtime: '2026-09-30T10:00:00+09:00', selected: false },
  ],
};

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/가 없습니다. 먼저 node scripts/stage-ui.cjs');
  const { STATES, NOW } = await import(pathToFileURL(path.join(APP, 'ui/engine-fixtures.js')).href);
  const { findBanned } = await import(pathToFileURL(path.join(APP, 'ui/banned-words.js')).href);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright().chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
  const report = [];
  for (const [w, hgt] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, reducedMotion: args.includes('--움직임') ? 'no-preference' : 'reduce', locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    await ctx.addInitScript((initial) => {
      // 엔진 흉내 — getState는 예시 상태, onState는 구독만 받는다. 그 밖의 호출은 가짜 성공(시험이 엔진에 보내지 않는다)
      window.__TAURI__ = { core: { invoke: async (_n, { method }) => (method === 'getState' ? { ok: true, value: initial } : { ok: false, error: 'x', code: 'FIXTURE' }) }, event: { listen: async () => () => {} } };
    }, STATES.home);
    const pg = await ctx.newPage();
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await pg.goto(base);
    await pg.waitForFunction(() => window.__wb && document.fonts.status === 'loaded');
    for (const [stateName, screen] of CASES) {
      const name = screen === 'home' ? stateName : screen;
      if (only && !only.includes(name)) continue;
      const before = errors.length;
      await pg.evaluate(({ screen, state, now, catalog }) => {
        if (screen === 'drawer') window.__wb.show('home', { state, now, still: true, drawer: true });
        else window.__wb.show(screen, { state, now, still: true, catalog: screen === 'restore' ? catalog : null });
      }, { screen, state: STATES[stateName], now: NOW, catalog: CATALOG });
      await pg.waitForTimeout(120);
      const m = await pg.evaluate(() => {
        const vw = innerWidth, vh = innerHeight, room = document.getElementById('room');
        const main = [...document.querySelectorAll('#room .pill.main, .drawer .lnk')][0];
        const r = main ? main.getBoundingClientRect() : null;
        const over = [...document.querySelectorAll('#stage *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width && (b.right > vw + 1 || b.left < -1) && getComputedStyle(el).position !== 'fixed'; }).map((el) => el.className || el.tagName).slice(0, 5);
        // 작은 글의 대비(검정 바탕) — 글자색 알파를 바탕에 섞어 잰다
        const lum = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const low = [];
        for (const el of document.querySelectorAll('#stage p, #stage span, #stage h4, #stage button, #stage b, #stage em, #stage label')) {
          if (!el.textContent.trim() || el.closest('[hidden]') || el.closest('.cg.hide')) continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
          const s = getComputedStyle(el); if (s.visibility === 'hidden' || +s.opacity === 0) continue;
          const m2 = s.color.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/); if (!m2) continue;
          let bg = [0, 0, 0]; if (el.closest('.pill.main')) bg = [243, 241, 236];
          const a = m2[4] === undefined ? 1 : +m2[4];
          const rgb = [+m2[1], +m2[2], +m2[3]].map((c, i) => c * a + bg[i] * (1 - a));
          const L1 = 0.2126 * lum(rgb[0]) + 0.7152 * lum(rgb[1]) + 0.0722 * lum(rgb[2]), L2 = 0.2126 * lum(bg[0]) + 0.7152 * lum(bg[1]) + 0.0722 * lum(bg[2]);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(s.fontSize), big = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700);
          if (ratio < (big ? 3 : 4.5)) low.push(`${el.textContent.trim().slice(0, 24)} ${ratio.toFixed(2)}`);
        }
        return { screen: document.getElementById('stage').dataset.screen, scrollW: document.documentElement.scrollWidth, vw, roomScroll: room.scrollHeight > room.clientHeight + 2, mainBottom: r ? Math.round(r.bottom) : null, vh, over, low: low.slice(0, 6), font: document.fonts.check('16px "SUIT Variable"'), webgl: !!document.getElementById('orb').getContext };
      });
      const text = await pg.evaluate(() => window.__wb.text());
      const banned = findBanned(text);
      const file = `${name}_${w}x${hgt}.png`;
      await pg.screenshot({ path: path.join(out, file) });
      fs.writeFileSync(path.join(out, file.replace(/\.png$/, '.txt')), text);
      // 검수 묶음(tools/검수묶음.mjs --캡처)이 읽는 꼴로도 둔다: 후/<창 폭>/<화면>.png · .txt
      const rv = path.join(out, '검수', '후', String(w)); fs.mkdirSync(rv, { recursive: true });
      fs.copyFileSync(path.join(out, file), path.join(rv, `${name}.png`)); fs.writeFileSync(path.join(rv, `${name}.txt`), text);
      const issues = [];
      if (m.scrollW > m.vw) issues.push(`가로 넘침 ${m.scrollW}`);
      if (m.over.length) issues.push(`창 밖 요소 ${m.over.join(' · ')}`);
      if (m.mainBottom !== null && m.mainBottom > m.vh) issues.push(`주 단추가 첫 화면 밖(${m.mainBottom} > ${m.vh})`);
      if (banned.length) issues.push(`화면 글 검사 걸림: ${banned.join(', ')}`);
      if (!m.font) issues.push('SUIT 글꼴이 실리지 않음');
      if (m.low.length) issues.push(`대비 낮음: ${m.low.join(' / ')}`);
      if (errors.length > before) issues.push(`쪽 오류: ${errors.slice(before).join(' / ')}`);
      report.push({ name, size: `${w}x${hgt}`, file, ...m, banned, issues });
      console.log(`${issues.length ? '✗' : '✓'} ${name} ${w}x${hgt}${issues.length ? ` — ${issues.join(' | ')}` : ''}`);
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.issues.length);
  console.log(`화면 ${report.length}장 · 걸림 ${bad.length}장 → ${out}`);
  process.exitCode = bad.length ? 1 : 0;
})().catch((e) => { console.error(e.stack || e.message); process.exitCode = 2; });
