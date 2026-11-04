'use strict';
// 게임 스킨의 :hover가 터치에서 탭 뒤에 남던 결함(2026-11-04) — 같은 게임을 스킨만 갈아 끼워 「전 · 후」를 같은 브라우저에서 잰다.
// 재는 것
//   터치(390 · hover 없음): 입구에 보이는 단추를 실제로 탭하고, 탭 전과 뒤의 box-shadow · background가 같은가(전 판은 흰 알약에 코랄 고리가 남는다)
//   마우스(1440): 같은 단추에 올렸을 때 전 · 후 값이 같은가, 시작 알약에 고리가 뜨는가
//   규칙 대조: 스킨 두 판을 브라우저 CSS 해석기로 펼쳐, 후 = 전 + 「:hover 규칙만 (hover:hover) 안으로」인가(화면에 안 나오는 단추까지 빠짐없이 덮는다)
//   LAB: 틀 없이 연 화면의 계산 스타일 · DOM · 픽셀이 같은가
//   화면 상태: 가로 넘침 · 깨진 그림 · 콘솔 오류 · 실패 요청
//
//   node docs/_ops/qa/world-skin-hover-20261104/터치고리재기.cjs [--바탕 <커밋>] [--게임 <이름…>] [--찍기 <폴더>]
//   node docs/_ops/qa/world-skin-hover-20261104/터치고리재기.cjs --공개본 [--후보 <공개 후보 폴더>]   실제 synk.im/world 위에서(후보는 그 파일만 끼운다, 공개본은 안 바꾼다)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../../../..');
const { 공용작업본 } = require(path.join(ROOT, 'tools/lib/공용작업본.js'));
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.join(ROOT, 'node_modules')] }));

const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const opt = (k, d) => (has(k) ? argv[argv.indexOf(k) + 1] : d);
const many = (k) => { const i = argv.indexOf(k); if (i < 0) return null; const out = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j += 1) out.push(argv[j]); return out; };
const PUBLIC = has('--공개본'), CANDIDATE = opt('--후보'), BASE_REF = opt('--바탕', 'HEAD'), SHOTS = opt('--찍기');
const GAMES = [['blank-slice', '#btn-start'], ['korean-racing', '#start'], ['korean-rhythm', '#start-button'], ['korean-runner', '#start'], ['order-rush', '#start'], ['talk-rally', '#btn-start']]
  .filter(([g]) => !many('--게임') || many('--게임').includes(g));
const LIVE = 'https://synk.im/world/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.json': 'application/json', '.glb': 'model/gltf-binary', '.txt': 'text/plain' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 틀에 viewport가 없으면 휴대폰 문맥에서 980폭으로 깔린 뒤 축소돼 게임이 넓은 화면 배치로 그려진다
const frameHtml = (src) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel=icon href="data:,"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="${src}" allow="autoplay"></iframe>`;

// 세션 사본에 없는 git 밖 그림 · 영상은 공용 작업본에서 받는다(재는 대상이 아니다)
const roots = [path.join(ROOT, 'experiences'), path.join(공용작업본(ROOT), 'experiences')];
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const frame = /^\/__frame__\/([a-z-]+)$/.exec(p);
  if (frame) { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end(frameHtml(`/${frame[1]}/index.html?qa=1`)); }
  for (const root of roots) {
    let t = path.join(root, p);
    if (!t.startsWith(root)) break;
    try {
      if (fs.statSync(t).isDirectory()) t = path.join(t, 'index.html');
      const body = fs.readFileSync(t);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(t)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(body);
    } catch { /* 다음 뿌리 */ }
  }
  res.writeHead(404).end('nf');
});

const gitShow = (rev, file) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
const fetchLive = async (rel) => { const r = await fetch(`${LIVE}${rel}?probe=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } }); return r.ok ? r.text() : null; };

// 스킨 두 판(전 · 후)을 고른다
async function skins(g) {
  if (PUBLIC) {
    const before = await fetchLive(`${g}/world-skin.css`);
    if (before == null) return null;
    const file = CANDIDATE && path.join(CANDIDATE, 'world', g, 'world-skin.css');
    return { before, after: file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : before };
  }
  return { before: gitShow(BASE_REF, `experiences/${g}/world-skin.css`), after: fs.readFileSync(path.join(ROOT, 'experiences', g, 'world-skin.css'), 'utf8') };
}

async function open(browser, g, start, variant, css, options, { lab = false } = {}) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage(), errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) failed.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120)}`); });
  if (lab) await page.addInitScript(() => {
    Math.random = () => 0.42;
    const fill = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) => { if (a instanceof Uint32Array) { a.fill(123456789); return a; } return fill(a); };
    try { localStorage.clear(); } catch { /* 저장 못 함 */ }
  });
  await page.route('**/world-skin.css*', (route) => route.fulfill({ contentType: 'text/css', body: css }));
  const origin = PUBLIC ? 'https://synk.im' : `http://127.0.0.1:${server.address().port}`;
  const gameUrl = PUBLIC ? `/world/${g}/index.html?qa=1` : `/${g}/index.html?qa=1`;
  if (PUBLIC) {
    await page.route(`${LIVE}__hover_frame__/**`, (route) => route.fulfill({ contentType: TYPES['.html'], body: frameHtml(gameUrl) }));
    if (CANDIDATE && variant === '후') await page.route(`${LIVE}**`, async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
      const file = path.join(CANDIDATE, rel);
      if (!/world-skin\.css$/.test(rel) && !/__hover_frame__/.test(rel) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
      return route.fallback();
    });
  }
  const url = lab ? origin + gameUrl : PUBLIC ? `${LIVE}__hover_frame__/${g}` : `${origin}/__frame__/${g}`;
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  const fr = () => (lab ? page.mainFrame() : page.frames().find((f) => f.url().includes(`/${g}/index.html`)));
  let ready = false;
  for (let i = 0; i < 160 && !ready; i += 1) {
    ready = await fr()?.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }, start).catch(() => false);
    if (!ready) await sleep(250);
  }
  await page.waitForTimeout(1600);
  return { ctx, page, fr, errors, failed, ready };
}

// 입구에 보이는 단추를 고른다(겉모습 · 눌림을 재는 대상). 다른 처리기가 게임을 시작하지 못하게 사건을 먼저 끊는다 — 브라우저의 :hover 상태는 그대로 바뀐다
const pick = async (fr, start) => fr().evaluate((startSel) => {
  for (const t of ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) window.addEventListener(t, (e) => { e.stopImmediatePropagation(); if (t === 'click') e.preventDefault(); }, { capture: true });
  const seen = new Set(), out = [];
  for (const sel of [startSel, '.felt-cta', '.chip-btn', '.sound-toggle', '.song', '.mode', '.disc-btn']) {
    let n = 0;
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el) || el.disabled || n >= 2) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 8 || r.height < 8 || cs.visibility === 'hidden' || +cs.opacity < 0.05 || r.bottom <= 0 || r.top >= innerHeight) continue;
      seen.add(el); n += 1;
      el.dataset.hv = String(out.length);
      out.push({ i: out.length, sel, id: el.id || null });
    }
  }
  return out;
}, start);
const look = (fr, i) => fr().evaluate((n) => { const el = document.querySelector(`[data-hv="${n}"]`), cs = getComputedStyle(el); return { hover: el.matches(':hover'), shadow: cs.boxShadow, bg: cs.backgroundColor }; }, i);

async function touch(browser, g, start, variant, css) {
  const s = await open(browser, g, start, variant, css, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const fr = s.fr, row = { ready: s.ready, hoverNone: await fr().evaluate(() => matchMedia('(hover:hover)').matches === false), items: [] };
  for (const it of await pick(fr, start)) {
    const rest = await look(fr, it.i);
    await s.page.frameLocator('iframe.game-frame').locator(`[data-hv="${it.i}"]`).tap({ force: true, timeout: 8000 }).catch(() => {});
    await s.page.waitForTimeout(520);
    const after = await look(fr, it.i);
    row.items.push({ ...it, tapped: after.hover, rest: { shadow: rest.shadow, bg: rest.bg }, after: { shadow: after.shadow, bg: after.bg }, stuck: after.shadow !== rest.shadow || after.bg !== rest.bg });
    if (SHOTS && it.i === 0) { fs.mkdirSync(SHOTS, { recursive: true }); await s.page.screenshot({ path: path.join(SHOTS, `${g}-390-터치-탭뒤-${variant}.png`) }); }
  }
  row.state = await state(s, fr);
  await s.ctx.close();
  return row;
}
async function mouse(browser, g, start, variant, css) {
  const s = await open(browser, g, start, variant, css, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const fr = s.fr, row = { ready: s.ready, hoverHover: await fr().evaluate(() => matchMedia('(hover:hover)').matches), items: [] };
  for (const it of await pick(fr, start)) {
    await s.page.frameLocator('iframe.game-frame').locator(`[data-hv="${it.i}"]`).hover({ force: true, timeout: 8000 }).catch(() => {});
    await s.page.waitForTimeout(420);
    const on = await look(fr, it.i);
    row.items.push({ ...it, on });
    if (SHOTS && it.i === 0) { fs.mkdirSync(SHOTS, { recursive: true }); await s.page.screenshot({ path: path.join(SHOTS, `${g}-1440-마우스-올림-${variant}.png`) }); }
  }
  row.state = await state(s, fr);
  await s.ctx.close();
  return row;
}
// 가로 넘침(휴대폰 흉내는 통째로 축소되므로 visualViewport도) · 깨진 그림 · 콘솔 오류 · 실패 요청
const state = async (s, fr) => ({
  frameWidth: await fr().evaluate(() => innerWidth),
  pageOverflow: await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || innerWidth > (visualViewport?.width ?? innerWidth) + 1),
  ...(await fr().evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1 || innerWidth > (visualViewport?.width ?? innerWidth) + 1,
    brokenImages: [...document.images].filter((i) => i.complete && !i.naturalWidth && i.getAttribute('src')).map((i) => i.getAttribute('src').slice(0, 80)),
  }))),
  errors: [...new Set(s.errors)].slice(0, 6),
  failed: [...new Set(s.failed)].slice(0, 8),
});

// 규칙 대조: 브라우저 해석기로 두 판을 펼친다
async function ruleProof(browser, before, after) {
  const page = await (await browser.newContext()).newPage();
  const flat = await page.evaluate(([a, b]) => {
    const walk = (rules, media) => [...rules].flatMap((r) => (r instanceof CSSMediaRule ? walk(r.cssRules, [...media, r.media.mediaText]) : r instanceof CSSStyleRule ? [{ sel: r.selectorText, css: r.style.cssText, media }] : []));
    const read = (t) => { const s = new CSSStyleSheet(); s.replaceSync(t); return walk(s.cssRules, []); };
    return [read(a), read(b)];
  }, [before, after]);
  await page.context().close();
  const isGate = (m) => /\(hover:\s*hover\)/.test(m), RESET = /\.dialog-toggles \.chip-btn:is\(:hover,\s*:active\)$/;
  const key = (r) => JSON.stringify([r.sel, r.css, r.media.filter((m) => !isGate(m))]);
  // 전 판의 「눌림 · hover를 함께 칠하는 줄」은 눌림 + hover 둘로 펼쳐 견준다
  const expanded = flat[0].flatMap((r) => { const m = /^(.*):is\(:hover,\s*:active\)$/.exec(r.sel); return m && !RESET.test(r.sel) ? [{ ...r, sel: `${m[1]}:active` }, { ...r, sel: `${m[1]}:hover` }] : [r]; });
  const a = expanded.map(key), b = flat[1].map(key);
  let same = a.length === b.length;
  for (let i = 0; same && i < a.length; i += 1) same = a[i] === b[i];
  const hoverAfter = flat[1].filter((r) => r.sel.includes(':hover'));
  const outside = hoverAfter.filter((r) => !r.media.some(isGate) && !RESET.test(r.sel)).map((r) => r.sel);
  const gatedPlain = flat[1].filter((r) => r.media.some(isGate) && !r.sel.includes(':hover')).map((r) => r.sel);
  return { rules: flat[1].length, hover: hoverAfter.length, gated: hoverAfter.filter((r) => r.media.some(isGate)).length, sameOtherwise: same, outside, gatedPlain };
}

// LAB: 틀 없이 연 화면
const SNAP = () => {
  const props = ['display', 'position', 'width', 'height', 'top', 'left', 'margin', 'padding', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'border-radius', 'box-shadow', 'opacity', 'transform', 'filter', 'visibility', 'gap'];
  const styles = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.tagName === 'CANVAS' || (el.closest('[hidden]') && el.tagName !== 'DIALOG')) continue;
    const cs = getComputedStyle(el);
    styles.push(el.tagName + (el.id ? `#${el.id}` : '') + '|' + props.map((p) => cs.getPropertyValue(p)).join('|'));
  }
  return { styles, body: document.body.innerHTML, host: document.documentElement.dataset.host || null };
};
async function labShot(browser, g, start, variant, css, view) {
  const s = await open(browser, g, start, variant, css, { viewport: view, deviceScaleFactor: 1, reducedMotion: 'reduce' }, { lab: true });
  await s.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await s.page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))]));
  await s.page.waitForTimeout(900);
  const snap = await s.page.evaluate(SNAP);
  const png = await s.page.screenshot({ fullPage: true });
  await s.ctx.close();
  return { ...snap, png };
}
// CSS 차이라면 찍을 때마다 같은 곳이 다르다. 바쁜 PC에서 늦게 뜬 조각 · 3D 판처럼 한 번만 갈리는 차이는 다시 찍어 가른다(같은 스킨끼리 견줘도 그렇게 갈렸다).
async function lab(browser, g, start, css) {
  if (css.before === css.after) return [];   // 같은 판 — 바뀐 것이 없다
  const norm = (t) => t.replace(/http:\/\/127\.0\.0\.1:\d+/g, '');
  const out = [];
  for (const view of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    let row = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const a = await labShot(browser, g, start, '전', css.before, view), b = await labShot(browser, g, start, '후', css.after, view);
      row = { view: `${view.width}x${view.height}`, host: b.host, styleDiff: a.styles.filter((x, i) => norm(x) !== norm(b.styles[i] ?? '')).length + Math.abs(a.styles.length - b.styles.length), dom: norm(a.body) === norm(b.body) ? 0 : 1, png: Buffer.compare(a.png, b.png) === 0 ? 0 : 1, attempt };
      if (!row.styleDiff && !row.dom && !row.png) break;
    }
    out.push(row);
  }
  return out;
}

const verdict = (g, r) => {
  const bad = [];
  if (!r.touch.후.hoverNone) bad.push('터치 문맥인데 hover:hover');
  const tapped = r.touch.후.items.filter((x) => x.tapped);
  if (!tapped.length) bad.push('탭이 닿은 단추가 없다');
  for (const x of tapped) if (x.stuck) bad.push(`탭 뒤 흔적 ${x.id || x.sel}: ${x.rest.shadow} → ${x.after.shadow} / ${x.rest.bg} → ${x.after.bg}`);
  if (!r.mouse.후.hoverHover) bad.push('마우스 문맥인데 hover 없음');
  r.mouse.후.items.forEach((x, i) => { const y = r.mouse.전.items[i]; if (!y || y.on.shadow !== x.on.shadow || y.on.bg !== x.on.bg) bad.push(`마우스 hover가 달라짐 ${x.id || x.sel}`); });
  const cta = r.mouse.후.items[0];
  if (!cta || !cta.on.hover || !/0px 0px 0px 5px/.test(cta.on.shadow)) bad.push('마우스 올렸을 때 시작 알약 고리가 없다');
  if (r.rules && (!r.rules.sameOtherwise || r.rules.outside.length || r.rules.gatedPlain.length)) bad.push(`규칙 대조 ${JSON.stringify(r.rules)}`);
  for (const v of r.lab || []) if (v.host || v.styleDiff || v.dom || v.png) bad.push(`LAB 차이 ${JSON.stringify(v)}`);
  for (const [k, st, w] of [['터치', r.touch.후.state, 390], ['마우스', r.mouse.후.state, 1440]]) { if (st.frameWidth !== w) bad.push(`${k} 틀 폭 ${st.frameWidth}`); if (st.overflow || st.pageOverflow) bad.push(`${k} 가로 넘침`); if (st.brokenImages.length) bad.push(`${k} 깨진 그림 ${st.brokenImages}`); if (st.errors.length) bad.push(`${k} 오류 ${st.errors}`); if (st.failed.length) bad.push(`${k} 실패 요청 ${st.failed}`); }
  return bad;
};

server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = { mode: PUBLIC ? (CANDIDATE ? '공개본 + 후보' : '공개본') : `작업본 (바탕 ${BASE_REF})`, at: new Date().toISOString(), games: {} };
  let badCount = 0;
  for (const [g, start] of GAMES) {
    const css = await skins(g);
    if (!css) { report.games[g] = { skipped: '공개본에 아직 없다' }; console.log(`${g}: 공개본에 아직 없어 건너뜀`); continue; }
    const r = { touch: {}, mouse: {} };
    r.rules = css.before === css.after ? null : await ruleProof(browser, css.before, css.after);
    for (const v of ['전', '후']) {
      const text = v === '전' ? css.before : css.after;
      r.touch[v] = await touch(browser, g, start, v, text);
      r.mouse[v] = await mouse(browser, g, start, v, text);
    }
    if (!PUBLIC) r.lab = await lab(browser, g, start, css);
    r.bad = verdict(g, r);
    badCount += r.bad.length;
    report.games[g] = r;
    const cta = (x) => x.items[0] || {};
    console.log(`${g}: 터치 탭 뒤 ${cta(r.touch.전).after?.shadow} → ${cta(r.touch.후).after?.shadow} | 마우스 고리 ${/5px/.test(cta(r.mouse.전).on?.shadow)} → ${/5px/.test(cta(r.mouse.후).on?.shadow)} | 탭 닿음 ${r.touch.후.items.filter((x) => x.tapped).length}/${r.touch.후.items.length} | 규칙 ${r.rules ? `${r.rules.gated}/${r.rules.hover} 안, 나머지 같음 ${r.rules.sameOtherwise}` : '같은 판'} | LAB ${(r.lab || []).map((v) => `${v.view} 스타일${v.styleDiff} DOM${v.dom} 픽셀${v.png}(${v.attempt}회)`).join(' · ') || (PUBLIC ? '안 잼' : '같은 판')} | 문제 ${r.bad.length ? JSON.stringify(r.bad) : 0}`);
  }
  await browser.close(); server.close();
  report.ok = badCount === 0;
  const out = path.join(공용작업본(ROOT), '.tmp', 'world-skin-hover-20261104', `결과-${PUBLIC ? (CANDIDATE ? '후보' : '공개본') : '작업본'}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
  console.log(`${report.ok ? '통과' : `문제 ${badCount}건`} · ${out}`);
  process.exitCode = report.ok ? 0 : 1;
});
