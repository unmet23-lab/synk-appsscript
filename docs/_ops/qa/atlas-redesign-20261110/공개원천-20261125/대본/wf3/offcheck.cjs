'use strict';
// 선택 공개 1단계 후보의 꺼진 판 확인(설계 주인 11-20): 라이브 synk.im/world/ 위에 후보 파일만 덮어 띄우고(page.route),
// 새 모듈 22개 · /atlas/ 요청 · IndexedDB 열기가 0인지, 라이브 그대로 띄운 것과 요청 · 콘솔 오류 · 화면 글이 같은지 본다. 공개본은 바꾸지 않는다.
//   node offcheck.cjs <후보 폴더(…/new)> <결과 폴더>
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/q1212/Documents/SYNK-appsscript/node_modules'] }));
const CAND = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]);
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const NEW = ['world-atlas-next.mjs', 'world-practice-next.mjs', 'world-today.mjs', 'world-position-next.mjs', 'world-diagnostic-next.mjs', 'world-mock-next.mjs', 'world-position-next-view.mjs', 'world-plan-next.mjs', 'world-lookback-next.mjs', 'world-me-next.mjs', 'world-month-answer.mjs', 'world-old-engine-doors.mjs', 'world-atlas-game.mjs', 'kit/atlas-next.mjs'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(view, overlay, start = '/world/') {
  const browser = await chromium.launch({ executablePath: 'C:/Users/q1212/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, locale: 'ko-KR', serviceWorkers: 'block' });
  // LS='{"열쇠":"값",…}' — 두 판 모두 첫 문서가 돌기 전에 이 기기 저장소를 채운다(서울행을 끝낸 손님 같은 상태를 똑같이 놓는다 — 설계 주인 11-20).
  if (process.env.LS) await ctx.addInitScript(entries => {
    try { if (location.hostname === 'synk.im' && !sessionStorage.getItem('__lsSeeded')) { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v); sessionStorage.setItem('__lsSeeded', '1'); } } catch { /* 저장소 없음 */ }
  }, JSON.parse(process.env.LS));
  await ctx.addInitScript(() => {
    window.__idbOpens = [];
    try {
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name, ...rest) => { window.__idbOpens.push(String(name)); return open(name, ...rest); };
    } catch { /* indexedDB 없음 */ }
  });
  const page = await ctx.newPage();
  const requests = [], errors = [], failed = [], fromCandidate = new Set();
  page.on('request', r => requests.push(r.url().replace(/\?.*$/, '')));
  page.on('pageerror', e => errors.push('pageerror ' + String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); });
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(/\?.*$/, '')}`); });
  if (overlay) await page.route('https://synk.im/world/**', async route => {
    const u = new URL(route.request().url()), rel = decodeURIComponent(u.pathname).replace(/^\/world\//, '');
    const file = path.join(CAND, 'world', rel);
    if (rel && fs.existsSync(file) && fs.statSync(file).isFile()) { fromCandidate.add(rel); return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
    return route.continue();
  });
  await page.goto('https://synk.im' + start, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(9000);
  const tag = `${start.replace(/[^a-z0-9]+/gi, '_')}${view.width}-${overlay ? 'cand' : 'live'}`;
  await page.screenshot({ path: path.join(OUT, `${tag}-0첫화면.png`) });
  // 화면 글 = 본 문서 + 모든 틀(서울 도착 iframe 등)의 글
  const text = async () => {
    const parts = [];
    for (const f of page.frames()) { try { parts.push((await f.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ').trim()); } catch { parts.push('(못 읽음)'); } }
    return parts.join(' | ').slice(0, 6000);
  };
  const steps = [{ name: '첫 화면', text: await text() }];
  if (start !== '/world/') { const idb0 = await page.evaluate(() => window.__idbOpens || []).catch(() => ['(읽지 못함)']); await browser.close(); return finish(view, overlay, start, requests, errors, failed, fromCandidate, steps, idb0); }
  // 여는 화면 → 서울 도착(iframe) 흐름을 같은 규칙으로 걷는다: 틀마다 보이는 단추 가운데 소리 · 언어 · 건너뛰기 밖의 첫 단추(없으면 건너뛰기)를 누른다.
  try { await page.getByText('CLICK TO START').first().click({ timeout: 10000 }); } catch { /* 여는 화면이 없으면 그대로 */ }
  await sleep(5000);
  steps.push({ name: '시작', text: await text() });
  await page.screenshot({ path: path.join(OUT, `${tag}-1시작.png`) });
  for (let i = 0; i < 12; i++) {
    let clicked = null;
    for (const f of [...page.frames()].reverse()) {
      clicked = await f.evaluate(() => {
        const skip = /소리|한국어|English|본문으로|^$/;
        const all = [...document.querySelectorAll('button, a, [role=button], [data-action], [data-choice]')].filter(b => {
          const r = b.getBoundingClientRect(); const s = getComputedStyle(b);
          return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && !b.disabled && r.bottom > 0 && r.top < innerHeight;
        });
        const label = b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const pick = all.find(b => !skip.test(label(b)) && !/건너뛰기/.test(label(b))) || all.find(b => /건너뛰기/.test(label(b)));
        if (!pick) return null; const name = label(pick); pick.click(); return name;
      }).catch(() => null);
      if (clicked) break;
    }
    if (!clicked) break;
    await sleep(3500);
    await page.screenshot({ path: path.join(OUT, `${tag}-${i + 2}.png`) });
    steps.push({ name: `누름 ${i + 1}: ${clicked}`, text: await text() });
  }
  const idb = await page.evaluate(() => window.__idbOpens || []).catch(() => ['(읽지 못함)']);
  await browser.close();
  return finish(view, overlay, start, requests, errors, failed, fromCandidate, steps, idb);
}
function finish(view, overlay, start, requests, errors, failed, fromCandidate, steps, idb) {
  const newHits = requests.filter(u => NEW.some(n => u.endsWith('/' + n)));
  const atlasHits = requests.filter(u => /^https:\/\/synk\.im\/atlas\//.test(u));
  return { view: `${start} ${view.width}x${view.height}`, overlay, requests: [...new Set(requests)].sort(), newHits, atlasHits, idb, errors, failed, fromCandidate: [...fromCandidate].sort(), steps };
}

(async () => {
  const views = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
  const out = [];
  // STARTS=쉼표로 가른 시작 주소(기본: 여는 화면 · 초대 쪽 둘). 초대 쪽의 시작 단추는 /world/?drama=1&invite=1&lang=en|mn 으로 간다.
  const starts = process.env.STARTS ? process.env.STARTS.split(',') : ['/world/', '/world/invite/en', '/world/invite/mn'];
  for (const start of starts) for (const view of views) for (const overlay of [false, true]) out.push(await run(view, overlay, start));
  fs.writeFileSync(path.join(OUT, 'offcheck.json'), JSON.stringify(out, null, 1));
  for (const start of starts) for (const view of views) {
    const key = `${start} ${view.width}x${view.height}`;
    const live = out.find(r => r.view === key && !r.overlay), cand = out.find(r => r.view === key && r.overlay);
    const onlyCand = cand.requests.filter(u => !live.requests.includes(u)), onlyLive = live.requests.filter(u => !cand.requests.includes(u));
    console.log(`== ${cand.view}: 후보에서 받은 파일 ${cand.fromCandidate.length}개(${cand.fromCandidate.join(' ')})`);
    console.log(`   새 모듈 요청 ${cand.newHits.length} · /atlas/ 요청 ${cand.atlasHits.length} · IndexedDB 열기 ${JSON.stringify(cand.idb)} (라이브 ${JSON.stringify(live.idb)})`);
    console.log(`   후보에만 있는 요청 ${onlyCand.length}: ${onlyCand.slice(0, 8).join(' ')} · 라이브에만 ${onlyLive.length}: ${onlyLive.slice(0, 8).join(' ')}`);
    console.log(`   오류 후보 ${cand.errors.length} · 라이브 ${live.errors.length} · 실패 요청 후보 ${cand.failed.length} · 라이브 ${live.failed.length}`);
    for (const e of cand.errors.filter(e => !live.errors.includes(e)).slice(0, 5)) console.log('   후보에만 오류:', e);
    for (let i = 0; i < Math.max(live.steps.length, cand.steps.length); i++) {
      const a = live.steps[i], b = cand.steps[i];
      console.log(`   ${i}. ${b?.name || '-'} / ${a?.name || '-'} — 화면 글 ${a && b && a.text === b.text ? '같음' : '다름'}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
