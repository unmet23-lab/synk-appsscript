'use strict';
// 캐스팅북 「줄 세워 보기」를 실제 브라우저에서 잰다 — 터치 끌기 · 세로 스크롤 · 마우스 끌기 · 경로 · 프레임.
//   node docs/마케팅/PULSE_AI모델_캐스팅_20260930/줄세워보기_재기.cjs   (먼저 node build-site.cjs)
// 프레임은 390×844 배율 3 · CPU 6배 제한에서 터치로 넘기는 구간을 크롬 추적으로 떠, 움직이는 중에 버린 장을 센다(PipelineReporter STATE_DROPPED).
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));

const SITE = path.join(__dirname, 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'cc', 'benchmark'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, more = '') => { console.log(`${cond ? '통과' : '실패'}  ${name}${more ? ` — ${more}` : ''}`); if (!cond) fails++; };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(SITE, u === '/' ? 'index.html' : u);
      if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
const railState = (page) => page.evaluate(() => {
  const r = document.querySelector('#rail'), on = document.querySelector('.rf.on');
  return { sl: r.scrollLeft, slot: parseFloat(getComputedStyle(on).width), i: Number(on.dataset.i), y: window.scrollY, hash: location.hash, name: document.querySelector('.rp-name').textContent, solo: document.querySelector('#row-stage').classList.contains('solo') };
});

async function phone(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/index.html#row`);
  await page.waitForSelector('.rf.on .rf-s.ready');
  await sleep(500);
  const cdp = await ctx.newCDPSession(page);
  // 진짜 손가락처럼 터치를 보낸다 — 브라우저 스크롤 · 관성 · snap이 그대로 돈다
  const swipe = async (x, y, dx, dy, ms = 260) => {
    const steps = Math.max(6, Math.round(ms / 16));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let k = 1; k <= steps; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * k / steps, y: y + dy * k / steps }] });
      await sleep(16);
    }
    await sleep(180); // 자동 터치를 움직이는 채로 놓으면 관성이 시작되지 않아 칸에 안 멈춘다(스크립트 없는 칸에서도 같다) — 멈췄다 놓는다
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  const a = await railState(page);
  ok('처음에 셋째가 가운데', a.i === 2 && Math.abs(a.sl - a.i * a.slot) < 1, `${a.name}, 칸 ${a.slot}px`);
  const box = await page.locator('#rail').boundingBox();
  const midY = box.y + box.height / 2;

  await swipe(320, midY, -a.slot * 1.6, 0);
  await sleep(1200);
  const b = await railState(page);
  ok('터치로 옆으로 끌면 넘어가고 칸에 맞게 멈춘다', b.i > a.i && Math.abs(b.sl - b.i * b.slot) < 1.5, `${a.i} → ${b.i}, 남은 어긋남 ${(b.sl - b.i * b.slot).toFixed(1)}px`);
  ok('옆으로 끄는 동안 페이지가 세로로 움직이지 않는다', b.y === a.y);
  const name = await page.locator('.rp-name').textContent();
  ok('패널이 가운데 사람을 따라온다', name === b.name);

  await swipe(195, midY, 0, -220);
  await sleep(600);
  const c = await railState(page);
  ok('줄 위에서 세로로 끌면 페이지가 내려가고 줄은 그대로다', c.y > 50 && c.i === b.i, `내려감 ${c.y}px`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await sleep(800);

  await page.tap('.rf.on .rf-a');
  await sleep(700);
  const d = await railState(page);
  ok('가운데를 누르면 크게 보기', d.solo && d.hash === `#row-${d.name.split(' ')[1]}`, d.hash);
  ok('번호 점 셋', await page.locator('.pin').count() === 3);
  await page.locator('.pin[data-v="body"]').tap();
  await sleep(300);
  ok('번호 점을 누르면 패널이 그 내용으로', (await page.locator('#rp-body').innerText()).includes('등신'));
  await page.goBack();
  await sleep(500);
  const e = await railState(page);
  ok('뒤로 가기가 크게 보기만 닫는다', !e.solo && e.hash === '#row' && e.i === d.i);
  ok('가로 넘침 없음', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  // 끝까지: 마지막 사람도 가운데에 올 수 있다
  await page.evaluate(() => document.querySelector('#rail').scrollTo({ left: 1e6 })); await sleep(700);
  const end = await page.evaluate(() => ({ i: Number(document.querySelector('.rf.on').dataset.i), n: document.querySelectorAll('.rf').length, center: (() => { const r = document.querySelector('.rf.on').getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2); })() }));
  ok('마지막 사람이 가운데에 선다', end.i === end.n - 1 && end.center < 2, `어긋남 ${end.center.toFixed(1)}px`);
  await page.evaluate(() => document.querySelector('#rail').scrollTo({ left: 0 })); await sleep(700);

  // 프레임: CPU 6배 제한. PC가 바쁠 때도 뜻이 있게, 스크립트 없는 기존 사진 띠(모델 북)를 같은 손놀림으로 재서 바닥값으로 삼는다
  const FR = (x) => x.args?.chrome_frame_reporter || x.args?.frame_reporter;
  const trace = async (fn) => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await sleep(300);
    await browser.startTracing(page, { categories: CATS });
    await fn();
    const buf = await browser.stopTracing();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const ev = (JSON.parse(buf.toString()).traceEvents) || [];
    const reports = ev.filter((x) => x.name === 'PipelineReporter' && (x.ph === 'b' || x.ph === 'X') && FR(x));
    const drop = reports.filter((x) => FR(x).state === 'STATE_DROPPED' && FR(x).affects_smoothness);
    const sum = {};
    for (const x of ev) if (x.ph === 'X' && x.dur && /^(FireAnimationFrame|FunctionCall|UpdateLayoutTree|Layout|PrePaint|Paint|Layerize|Commit)$/.test(x.name)) sum[x.name] = (sum[x.name] || 0) + x.dur / 1000;
    return { n: reports.length, drop: drop.length, pct: 100 * drop.length / Math.max(1, reports.length), sum: Object.entries(sum).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · ') };
  };
  const moves = async (y) => { for (const dx of [-260, -260, 260, -300, -260, 260]) { await swipe(dx < 0 ? 340 : 50, y, dx, 0, 220); await sleep(500); } };
  const row = await trace(() => moves(midY));
  const shots = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('cut.webp')).length);
  console.log(`줄 — 보고 ${row.n}장 · 버림 ${row.drop}장(${row.pct.toFixed(1)}%) · 선명한 판 받음 ${shots}장 · ${row.sum}`);
  await page.evaluate(() => { location.hash = '#m-F02'; });
  await page.waitForSelector('#strip'); await sleep(1500);
  const sb = await page.locator('#strip').boundingBox();
  const base2 = await trace(() => moves(sb.y + sb.height / 2));
  console.log(`바닥값(모델 북 사진 띠) — 보고 ${base2.n}장 · 버림 ${base2.drop}장(${base2.pct.toFixed(1)}%)`);
  console.log('프레임 숫자는 PC가 한가할 때만 견준다 — 부하 100%에서는 줄 21% · 바닥값 7%까지 흔들렸고, 한가할 때는 줄 5.6% · 바닥값 5.9%였다(11-04 Fable). 그래서 합격 · 실패로 치지 않는다');
  ok('화면 오류 없음(휴대폰)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function desktop(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/index.html#row`);
  await page.waitForSelector('.rf.on .rf-s.ready');
  await sleep(400);
  const a = await railState(page);
  const box = await page.locator('#rail').boundingBox();
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++) { await page.mouse.move(box.x + box.width * 0.7 - k * 30, y); await sleep(16); }
  const mid = await page.evaluate(() => document.querySelector('#rail').scrollLeft);
  await sleep(150); // 멈췄다 놓기 — 관성 없음
  await page.mouse.up();
  await sleep(800);
  const b = await railState(page);
  ok('마우스로 끌면 손을 따라오고(튀지 않고) 놓으면 칸에 멈춘다', Math.abs(mid - (a.sl + 360)) < 3 && Math.abs(b.sl - b.i * b.slot) < 1, `끄는 중 ${Math.round(mid - a.sl)}px, ${a.i} → ${b.i}`);
  ok('끌고 놓아도 크게 보기가 열리지 않는다', !b.solo && b.hash === '#row');
  ok('끈 뒤 snap이 되살아난다', (await page.evaluate(() => document.querySelector('#rail').style.scrollSnapType)) === '');
  // 옆 사람을 누르면 가운데로
  const nb = await page.locator(`.rf[data-i="${b.i + 1}"] .rf-a`).boundingBox();
  await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height * 0.4);
  await sleep(800);
  const c = await railState(page);
  ok('옆 사람을 누르면 가운데로 온다', c.i === b.i + 1 && !c.solo);
  // 키보드
  await page.locator('#rail').focus();
  await page.keyboard.press('ArrowRight'); await sleep(700);
  ok('화살표 키로 넘어간다', (await railState(page)).i === c.i + 1);
  await page.keyboard.press('Tab');
  ok('탭은 가운데 사람으로 간다', await page.evaluate(() => document.activeElement.closest('.rf')?.classList.contains('on')));
  await page.keyboard.press('Enter'); await sleep(600);
  const s = await railState(page);
  ok('엔터로 크게 보기, 초점은 닫기로', s.solo && (await page.evaluate(() => document.activeElement.id)) === 'row-close');
  await page.keyboard.press('Escape'); await sleep(500);
  const t = await railState(page);
  ok('Esc로 닫으면 그 사람에게 초점', !t.solo && t.hash === '#row' && await page.evaluate(() => document.activeElement.closest('.rf')?.classList.contains('on')));
  // 크게 보기에서 넘겨도 초점이 닫기로 튀지 않는다 · 거르면 주소도 줄로 · 줄 밖에서 놓아도 끌기가 끝난다
  await page.evaluate(() => { location.hash = '#row-F05'; }); await sleep(600);
  await page.locator('#row-next').focus();
  await page.keyboard.press('Enter'); await sleep(400);
  const afterNext = await railState(page);
  ok('크게 보기에서 다음 단추를 눌러도 초점이 그대로', (await page.evaluate(() => document.activeElement.id)) === 'row-next' && afterNext.solo);
  ok('다음을 누르면 패널이 바로 그 사람', afterNext.hash.endsWith(afterNext.name.split(' ')[1]));
  await page.selectOption('select[data-f="age"]', { index: 1 }); await sleep(400);
  const filtered = await railState(page);
  ok('크게 보기에서 거르면 줄로 돌아가고 주소도 줄', !filtered.solo && filtered.hash === '#row');
  await page.selectOption('select[data-f="age"]', { index: 0 }); await sleep(400);
  const rb = await page.locator('#rail').boundingBox();
  const before = await page.evaluate(() => document.querySelector('#rail').scrollLeft);
  await page.mouse.move(rb.x + rb.width - 3, rb.y + rb.height / 2);
  await page.mouse.down(); await page.mouse.move(rb.x + rb.width + 40, rb.y + 2, { steps: 1 }); await page.mouse.up();
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2, { steps: 6 }); await sleep(300);
  ok('줄 밖에서 놓은 뒤 커서만 지나가면 줄이 끌려오지 않는다', Math.abs((await page.evaluate(() => document.querySelector('#rail').scrollLeft)) - before) < 200 && !(await page.evaluate(() => document.querySelector('#rail').classList.contains('is-dragging'))));
  await sleep(600);
  await page.locator('.rf.on .rf-a').focus();
  const was = (await railState(page)).i;
  await page.keyboard.press('ArrowRight'); await sleep(700);
  ok('사람에 초점을 두고 화살표로 넘기면 초점도 새 가운데로', await page.evaluate(() => document.activeElement.closest('.rf')?.classList.contains('on')) && (await railState(page)).i === was + 1);
  // 창 크기가 바뀌어도 보던 사람 그대로 · 크게 보기는 선명하게
  await page.evaluate(() => { location.hash = '#row-F10'; }); await sleep(500);
  await page.evaluate(() => { location.hash = '#row'; }); await sleep(500);
  const held = (await railState(page)).name;
  const seen = [];
  for (const [width, height] of [[1300, 820], [1000, 640], [1440, 900]]) { await page.setViewportSize({ width, height }); await sleep(500); const r = await railState(page); seen.push(r.name); ok(`창 ${width}×${height}에서 칸에 맞게 선다`, Math.abs(r.sl - r.i * r.slot) < 1.5, `어긋남 ${(r.sl - r.i * r.slot).toFixed(1)}px`); }
  ok('창 크기가 바뀌어도 보던 사람이 가운데', seen.every((n) => n === held), seen.join(' → '));
  await page.evaluate(() => { location.hash = '#row-F10'; }); await sleep(700);
  await page.setViewportSize({ width: 1200, height: 760 }); await sleep(600); await page.setViewportSize({ width: 1440, height: 900 }); await sleep(800);
  const soloNow = await page.evaluate(() => { const on = document.querySelector('.rf.on'); return { code: location.hash, name: document.querySelector('.rp-name').textContent, sharp: getComputedStyle(on.querySelector('.rf-s')).opacity, thumbs: [...document.querySelectorAll('.rp-cuts img')].every((i) => i.getAttribute('src')) }; });
  ok('크게 보기에서 창 크기를 바꿔도 그 사람이 선명', soloNow.name.includes('F10') && Number(soloNow.sharp) > 0.99 && soloNow.thumbs, JSON.stringify(soloNow));
  await page.evaluate(() => { location.hash = '#row'; }); await sleep(500);
  // 다른 화면을 다녀와도 그 사람
  const who = (await railState(page)).name;
  await page.locator('.rp-acts a').click(); await sleep(400);
  ok('모델 북으로 간다', (await page.evaluate(() => location.hash)).startsWith('#m-'));
  await page.goBack(); await page.waitForSelector('.rf.on'); await sleep(400);
  ok('뒤로 오면 보던 사람이 가운데', (await railState(page)).name === who);
  // 주소로 바로 들어오기 · 닫기가 사이트 밖으로 나가지 않는다
  await page.goto(`${base}/index.html#row-F08`); await page.reload(); await page.waitForSelector('.rf.on'); await sleep(500);
  const g = await railState(page);
  ok('주소로 바로 크게 보기', g.solo && g.name.includes('F08'));
  await page.locator('#row-close').click(); await sleep(400);
  const h = await railState(page);
  ok('바로 들어와도 닫기는 줄로', !h.solo && h.hash === '#row' && h.name.includes('F08'));
  // 거르기 · 보드 복귀
  await page.selectOption('select[data-f="gender"]', '남'); await sleep(400);
  ok('거르면 줄이 줄어든다', await page.locator('.rf').count() < 21 && await page.evaluate(() => /조건/.test(document.querySelector('#row-note').textContent)));
  await page.locator('[data-act="row-clear"]').click(); await sleep(300);
  ok('조건 지우기', await page.locator('.rf').count() === 21);
  await page.locator('.rp-acts [data-act="pkg"]').click(); await sleep(200);
  ok('패키지에 담긴다', (await page.locator('#pkg-n').textContent()) === '1');
  await page.evaluate(() => { location.hash = '#board'; }); await sleep(500);
  ok('보드가 그대로 뜬다', await page.locator('.tile').count() === 21);
  await page.evaluate(() => { location.hash = '#lineup'; }); await sleep(300);
  ok('키 순서가 그대로 뜬다', await page.locator('.lu-fig').count() === 21);
  await page.evaluate(() => { location.hash = '#swipe'; }); await sleep(300);
  ok('한 명씩 넘기기가 그대로 뜬다', await page.locator('#dcard').count() === 1);
  ok('화면 오류 없음(PC)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
  // 움직임 줄이기
  const calm = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
  const p2 = await calm.newPage();
  await p2.goto(`${base}/index.html#row`); await p2.waitForSelector('.rf.on .rf-s.ready'); await sleep(400);
  const scales = await p2.evaluate(() => [...document.querySelectorAll('.rf')].slice(0, 5).map((f) => f.style.transform));
  ok('움직임 줄이기에서는 크기 차이가 없다', new Set(scales).size === 1, scales[0]);
  await calm.close();
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  try { await phone(browser, base); await desktop(browser, base); } finally { await browser.close(); srv.close(); }
  console.log(fails ? `실패 ${fails}건` : '전부 통과');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
