'use strict';
// 말 랠리 캠퍼스 판(2026-11-04) — 시안에 안 나오는 길을 실제로 돌린다: 움직임 줄이기 · 소리 끔 · 영상 도중 멈춤 → 이어 하기 · 멈춤 → 처음으로 → 다시 시작 · 하루 도전.
// 게임 틀(같은 출처 .game-frame)을 ?qa로 띄우고 __rally로 맞는 칸을 고른다. 멈춘 판 · 오류 · 남은 영상 · 음악이 있으면 실패로 끝난다.
//   node experiences/talk-rally/qa/world-campus-20261104/경로시험.cjs
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const FRAME = '<!doctype html><meta charset=utf-8><style>html,body{margin:0;height:100%}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" allow="autoplay" src="/talk-rally/index.html?qa=1"></iframe>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const serve = () => new Promise((resolve) => {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
    let file = path.join(EXP, u);
    if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(file));
  });
  srv.listen(0, '127.0.0.1', () => resolve(srv));
});

async function open(browser, base, { reducedMotion = 'no-preference', wide = false } = {}) {
  const ctx = await browser.newContext({ viewport: wide ? { width: 1280, height: 720 } : { width: 390, height: 844 }, reducedMotion });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'load' });
  const fr = () => page.frames().find((f) => f.url().includes('/talk-rally/'));
  for (let i = 0; i < 200; i += 1) { if (await fr()?.evaluate(() => !!window.__rally && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
  const h = {
    page, ctx, errors, fr,
    cur: () => fr().evaluate(() => window.__rally.state().cur),
    st: () => fr().evaluate(() => { const s = window.__rally.state(); return { index: s.index, rally: s.rally, score: s.score, practice: s.practice, world: window.__rally.world(), over: !document.querySelector('#results').hidden, explain: !!document.querySelector('#btn-next')?.offsetParent, clipsOn: [...document.querySelectorAll('.w-clip')].filter((v) => !v.hidden).length, clipPaused: [...document.querySelectorAll('.w-clip')].filter((v) => !v.hidden).map((v) => v.paused) }; }),
    click: (sel) => fr().evaluate((q) => document.querySelector(q).click(), sel),
    start: async () => { await h.click('#btn-start'); await sleep(500); },
    /** 지금 공을 고른다(말 도중이어도 된다). 카드가 뜰 때까지 기다린다. */
    pick: async (ok = true, wait = 300) => {
      for (let i = 0; i < 260; i += 1) {
        const st = await h.st();
        if (st.over) return 'over';
        if (st.explain) { await h.click('#btn-next'); await sleep(200); continue; }
        const c = await h.cur();
        if (c && c.choice == null && (c.phase === 'talk' || c.phase === 'flight')) {
          await sleep(wait);
          const lane = ok ? c.options.indexOf(c.answer) : c.options.findIndex((o) => o !== c.answer);
          await fr().evaluate((n) => window.__rally.choose(n), lane);
          return c.id;
        }
        await sleep(100);
      }
      return null;
    },
  };
  return h;
}

const fails = [];
const check = (name, ok, note = '') => { console.log(`${ok ? '통과' : '실패'} · ${name}${note ? ' · ' + note : ''}`); if (!ok) fails.push(name); };

(async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });

  // ① 움직임 줄이기: 영상을 틀지 않고 판을 끝까지 돈다
  {
    const h = await open(browser, base, { reducedMotion: 'reduce' });
    await h.start();
    let sawClip = false, ids = [];
    for (let i = 0; i < 16; i += 1) {
      const id = await h.pick(true, 200); if (id === 'over' || !id) break;
      ids.push(id);
      for (let k = 0; k < 12; k += 1) { const s = await h.st(); if (s.clipsOn) sawClip = true; await sleep(100); }
    }
    await sleep(1500);
    const s = await h.st();
    check('움직임 줄이기: 영상 없이 판이 끝난다', !sawClip && s.over && !h.errors.length, `공 ${ids.length} · 끝 ${s.over} · 오류 ${h.errors.length} ${h.errors[0] || ''}`);
    await h.ctx.close();
  }
  // ② 소리 끔: 말이 글로 나오고 판이 끝까지 돈다
  {
    const h = await open(browser, base);
    await h.click('.sound-toggle');   // 입구의 소리 끄기 단추
    await h.start();
    const tip = await (async () => { for (let i = 0; i < 40; i += 1) { const t = await h.fr().evaluate(() => [...document.querySelectorAll('.tip,#tip')].map((x) => x.textContent).join('')); if (/태오/.test(t)) return t; await sleep(100); } return ''; })();
    let n = 0;
    for (let i = 0; i < 16; i += 1) { const id = await h.pick(true, 250); if (id === 'over' || !id) break; n += 1; await sleep(1100); }
    await sleep(1500);
    const s = await h.st();
    check('소리 끔: 말이 글로 나오고 판이 끝난다', !!tip && s.over && !h.errors.length, `글 「${tip.slice(0, 30)}」 · 공 ${n} · 끝 ${s.over} · 오류 ${h.errors.length} ${h.errors[0] || ''}`);
    await h.ctx.close();
  }
  // ③ 영상 도중 멈춤 → 이어 하기, 멈춤 → 처음으로 → 다시 시작
  {
    const h = await open(browser, base);
    await h.start();
    await h.pick(true, 200);   // 연습
    await sleep(2500);
    let hitPause = false;
    for (let i = 0; i < 4 && !hitPause; i += 1) {
      await h.pick(true, 200);
      for (let k = 0; k < 40; k += 1) { const s = await h.st(); if (s.clipsOn && s.world?.clip && /hit/.test(s.world.clip)) { hitPause = true; break; } await sleep(50); }
      if (!hitPause) await sleep(1200);
    }
    await h.click('#pause'); await sleep(300);
    let s = await h.st();
    check('영상 도중 멈춤: 영상이 함께 멈춘다', hitPause && s.clipPaused.length > 0 && s.clipPaused.every(Boolean), JSON.stringify({ hitPause, paused: s.clipPaused }));
    const before = s.index;
    await sleep(1200);
    await h.click('#resume'); await sleep(400);
    s = await h.st();
    const playing = s.clipPaused.length === 0 || s.clipPaused.every((x) => !x);
    check('이어 하기: 영상이 이어 돈다', playing, JSON.stringify(s.clipPaused));
    await sleep(800);
    const id = await h.pick(true, 200);
    check('이어 하기 뒤 판이 이어진다', !!id, `공 ${before} → ${(await h.st()).index}`);
    await h.click('#pause'); await sleep(200);
    await h.click('#quit'); await sleep(900);
    s = await h.st();
    const lobby = await h.fr().evaluate(() => !document.querySelector('#lobby').hidden);
    check('처음으로: 입구로 오고 영상이 안 남는다', lobby && s.clipsOn === 0, `입구 ${lobby} · 영상 ${s.clipsOn} · 음악 ${JSON.stringify(s.world?.music)}`);
    await sleep(1200);
    await h.start();
    const again = await h.pick(true, 200);
    check('다시 시작이 된다', !!again && !h.errors.length, `공 ${again} · 오류 ${h.errors.length} ${h.errors[0] || ''}`);
    await h.ctx.close();
  }
  // ④ 하루 도전: 같은 흐름으로 돈다(카드 순서가 정해져 있다)
  {
    const h = await open(browser, base, { wide: true });
    await h.click('#btn-daily'); await sleep(600);
    let n = 0;
    for (let i = 0; i < 16; i += 1) { const id = await h.pick(true, 250); if (id === 'over' || !id) break; n += 1; await sleep(1300); }
    await sleep(1500);
    const s = await h.st();
    check('하루 도전: 넓은 화면에서 판이 끝난다', s.over && !h.errors.length, `공 ${n} · 끝 ${s.over} · 오류 ${h.errors.length} ${h.errors[0] || ''}`);
    await h.ctx.close();
  }
  // ⑤ 이어지는 랠리에서 말 도중 멈춤: 이어 하면 공이 태오 라켓에서 새로 날아와 말이 끝나기 전에 라켓 앞에 멈추지 않는다 · 멈춘 채 처음으로 나가면 입구에 말소리가 안 남는다
  {
    const h = await open(browser, base);
    await h.start();
    await h.pick(true, 200);   // 연습
    await sleep(2500);
    await h.pick(true, 200);   // 첫 공을 맞혀 이어지는 랠리로
    const talking = async () => { for (let i = 0; i < 120; i += 1) { const c = await h.cur(); if (c && c.phase === 'talk' && c.choice == null && (await h.st()).world?.voices > 0) return c; await sleep(50); } return null; };
    let c = await talking();
    await sleep(350);
    await h.click('#pause'); await sleep(1400);
    await h.click('#resume');
    let early = false, flew = false;
    for (let i = 0; i < 120; i += 1) {
      const x = await h.cur();
      if (x?.phase === 'flight') { flew = true; break; }
      if (x?.waiting || !(await h.fr().evaluate(() => document.querySelector('#wait')?.hidden ?? true))) early = true;
      await sleep(50);
    }
    check('랠리 말 도중 멈춤 → 이어 하기: 말이 끝나기 전에 공이 멈춰 서지 않는다', !!c && flew && !early, `말 ${c?.id} · 다 들음 ${flew} · 먼저 닿음 ${early}`);
    await h.pick(true, 200);
    c = await talking();
    await sleep(300);
    await h.click('#pause'); await sleep(300);
    await h.click('#quit'); await sleep(700);
    const left = await h.fr().evaluate(() => ({ voices: window.__rally.world()?.voices, speech: !document.querySelector('#speech')?.hidden, lobby: !document.querySelector('#lobby').hidden }));
    check('말 도중 멈춤 → 처음으로: 입구에 말소리가 안 남는다', !!c && left.lobby && left.voices === 0 && !left.speech && !h.errors.length, JSON.stringify(left));
    await h.ctx.close();
  }
  await browser.close(); srv.close();
  console.log(fails.length ? `실패 ${fails.length}: ${fails.join(' · ')}` : '모두 통과');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
