'use strict';
// 입장 검사 캠퍼스 판(2026-11-04) — 실제 WORLD 앱(이 PC 시범 서버) 안에서 「놀이」 잠김 → 싱크타운 카페 첫 방문 → 열림 → 게임 틀 → 입구 → 근무 → 결과 → 동네로를 찍고,
// 틀 안 그림 · 받은 요청 · 글에서 까몽 · 몽글 · 마린 · 펠트 흔적을 잰다. 새 손님(기기 기록)으로 처음 실행(언어 · 한글 · 튜터)을 지난다. 넘침 · 콘솔 오류 · 실패한 요청도 본다.
//   node experiences/entry-check/qa/world-campus-20261104/앱화면.cjs   (시범 서버를 이 스크립트가 띄우고 끝에 내린다 · 찍은 것은 공용 작업본 .tmp/entry-check-world-20261104/앱화면/)
//   이미 뜬 서버 · 라이브를 보려면 WORLD_URL=<주소>. 형제 저장소 자리는 SYNK_TALK_ROOT(기본 ../SYNK-talk).
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const { spawn } = require('node:child_process');
const { 화면시험, 닫기 } = require('../../../../tools/lib/화면시험.cjs');   // 전체 시간 한도 · 어떻게 끝나든 브라우저까지 끝낸다(tests/화면시험관문.test.js)
const ROOT = path.resolve(__dirname, '../../../..');
const PORT = 4299;
const BASE = process.env.WORLD_URL || `http://127.0.0.1:${PORT}`;
async function startServer() {
  if (process.env.WORLD_URL) return null;
  const talk = process.env.SYNK_TALK_ROOT || path.resolve(공용작업본(ROOT), '..', 'SYNK-talk');
  const child = spawn(process.execPath, ['experiences/synk-world-app/server.mjs'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, SYNK_TALK_ROOT: talk, SYNK_WORLD_PORT: String(PORT) } });
  for (let i = 0; i < 150; i += 1) { try { const r = await fetch(`${BASE}/mobile.html`); if (r.ok) return child; } catch { /* 아직 */ } await new Promise((res) => setTimeout(res, 200)); }
  child.kill();
  throw Error('WORLD 앱 시범 서버가 뜨지 않았다');
}
const OUT = path.join(공용작업본(ROOT), '.tmp', 'entry-check-world-20261104', '앱화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MASCOT = /mongle|몽글|까몽|kkamong|gamong|마린|marin\b|maru|kit\/felt\/|assets\/felt\//i;

function traces(gameFrame) {
  return gameFrame.evaluate(() => {
    const out = { visibleImages: [], text: [], pseudo: [] };
    for (const el of document.querySelectorAll('img')) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden') out.visibleImages.push(el.getAttribute('src') || '');
    }
    for (const el of document.querySelectorAll('*')) {
      if (el.getBoundingClientRect().width <= 0) continue;
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && /url\(/.test(bg) && !/^url\("data:/.test(bg)) out.visibleImages.push(bg);
      for (const side of ['::before', '::after']) {
        const ps = getComputedStyle(el, side);
        if (ps.content !== 'none' && /url\(/.test(ps.backgroundImage) && !/^url\("data:/.test(ps.backgroundImage)) out.pseudo.push(`${el.tagName}.${el.className}${side} ${ps.backgroundImage.slice(0, 90)}`);
      }
    }
    const body = document.body.innerText || '';
    for (const word of ['몽글', '까몽', '마린', '펠트', '크림색', 'LAB', '보리', '구리', '토순']) if (body.includes(word)) out.text.push(word);
    return out;
  });
}
const mascotOnly = (t) => ({ images: [...new Set([...t.visibleImages, ...t.pseudo].filter((x) => MASCOT.test(x)))], text: t.text });

async function run(name, view) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2, hasTouch: view.width < 700, isMobile: view.width < 700 });
  const page = await ctx.newPage(), errors = [], failed = [], requests = [], notes = {};
  page.setDefaultTimeout(25000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(new URL(r.url()).pathname)) failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (label) => { await page.mouse.move(2, 2).catch(() => {}); await page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }); };
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  // 「놀이」: 처음에는 입장 검사가 잠겨 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=entry]');
  notes.lockedBefore = await page.locator('[data-game=entry]').getAttribute('data-locked') !== null;
  notes.lockText = (await page.locator('[data-game=entry] .play-lock').textContent())?.trim();
  notes.cardImage = await page.locator('[data-game=entry] img').first().getAttribute('src');
  await page.locator('[data-game=entry]').scrollIntoViewIfNeeded();
  await shot('01_놀이_잠김');
  await page.locator('[data-game=entry]').click({ force: true });   // 잠긴 카드를 눌러도 게임이 열리면 안 된다
  await sleep(500);
  notes.lockedStaysHome = (await page.locator('.game-frame').count()) === 0;
  await page.locator('#panel-close').click();
  await sleep(500);
  // 싱크타운 카페 첫 방문(qa/cafe-browser.cjs의 순서)
  await page.evaluate(() => document.querySelector('[data-view=cafe]').click());
  await page.locator('.felt-button[data-life-lesson=cafe-apply]').click();
  const next = async () => { if (await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count()) await page.locator('[data-life-cafe-mode=read]').click(); await page.locator('[data-life-cafe-next]:not([disabled])').click(); await sleep(700); };
  const choose = async (id) => { await page.locator(`[data-life-cafe-choice=${id}]:not([disabled])`).click(); await sleep(700); };
  await next(); await choose('b'); await next(); await choose('c'); await next(); await next(); await choose('a'); await next();
  notes.cafeResult = (await page.locator('#panel-title').textContent())?.trim();
  await page.locator('#panel-close').click();
  await sleep(600);
  // 「놀이」: 이제 열려 있다
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=entry]');
  notes.lockedAfter = await page.locator('[data-game=entry]').getAttribute('data-locked') !== null;
  await page.locator('[data-game=entry]').scrollIntoViewIfNeeded();
  await shot('02_놀이_열림');
  const before = requests.length;
  await page.locator('[data-game=entry]').click();
  await page.waitForSelector('.game-frame');
  const f = page.frameLocator('.game-frame');
  await f.locator('#rec-start').waitFor();
  await sleep(1800);
  notes.host = await f.locator('html').getAttribute('data-host');
  const frame = await (await page.locator('.game-frame').elementHandle()).contentFrame();
  notes.lobby = mascotOnly(await traces(frame));
  notes.lobbyOverflow = await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  notes.tutorOutside = await page.evaluate(() => ({ companion: document.querySelectorAll('#panel-content .game-tutor').length, practice: document.querySelectorAll('dialog.tutor-practice').length }));
  await shot('03_입구');
  // 처음 근무: 연수(글로만, 몽글 목소리 없음)를 한 번 보고 건너뛴다
  await f.locator('#rec-start').click();
  await sleep(1200);
  await shot('04_근무전안내');
  notes.brief = mascotOnly(await traces(frame));
  await f.locator('#btn-begin').click();
  await sleep(2200);
  await shot('05_연수');
  notes.coach = await frame.evaluate(() => !document.querySelector('#coach').hidden);
  notes.tutorialLine = await frame.evaluate(() => document.querySelector('#coach')?.innerText?.slice(0, 80));
  if (notes.coach) await f.locator('#coach-skip').click();
  await sleep(1600);
  await shot('06_첫손님');
  notes.play = mascotOnly(await traces(frame));
  // 잠깐 멈춤
  await f.locator('#pause').click();
  await sleep(400);
  await shot('07_멈춤');
  await frame.evaluate(() => document.querySelector('#pause-dialog [data-close], #pause-dialog #resume, #pause-dialog button')?.click());
  await sleep(500);
  // 끝까지: 시험 창구로 지금 손님을 읽어 앱 안에서 근무를 마친다(틀을 ?qa로 다시 열고 같은 계정 기록으로)
  await frame.goto(frame.url().split('?')[0] + '?qa=1');
  await f.locator('#rec-start').waitFor();
  await sleep(1200);
  await f.locator('#rec-start').click();
  await sleep(900);
  await f.locator('#btn-begin').click();
  await sleep(1400);
  let last = null, n = 0;
  for (let g = 0; g < 14; g += 1) {
    if (await frame.evaluate(() => !document.querySelector('#results').hidden)) break;
    if (await frame.evaluate(() => !document.querySelector('#coach').hidden)) { await frame.evaluate(() => document.querySelector('#coach-skip')?.click()); await sleep(400); }
    let cur = null;
    for (let i = 0; i < 80; i += 1) { cur = await frame.evaluate(() => window.__entry.state().cur); if (cur?.id && cur.id !== last && !cur.done) break; await sleep(100); }
    if (!cur?.id || cur.id === last) break;
    last = cur.id; n += 1;
    await sleep(700);
    if (cur.answer === 'pass') await f.locator('#btn-pass').click();
    else { await f.locator('#btn-reject').click(); await sleep(350); await f.locator(`#notice .rule[data-rule="${cur.answer}"]`).click(); }
    await sleep(1400);
    if (n === 1) { await shot('08_판정'); notes.verdict = mascotOnly(await traces(frame)); notes.mood = await frame.evaluate(() => window.__entry.world()?.mood); }
    await f.locator('#btn-next').click();
    await sleep(800);
  }
  notes.guests = n;
  await f.locator('#results:not([hidden])').waitFor({ timeout: 8000 });
  await sleep(2600);
  await shot('09_결과');
  notes.results = mascotOnly(await traces(frame));
  notes.resultsOverflow = await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  notes.stampCard = await frame.evaluate(() => document.querySelectorAll('.w-stampcard li').length);
  notes.expressions = await frame.evaluate(() => document.querySelectorAll('.w-expr li').length);
  notes.progress = await frame.evaluate(() => { const p = window.__entry.progress(); return { plays: p.plays, stars: p.stars }; });
  await frame.evaluate(() => document.scrollingElement.scrollTo(0, 620));
  await sleep(300);
  await shot('10_결과아래');
  const seen = requests.slice(before);
  notes.gameRequests = seen.length;
  notes.mascotRequests = [...new Set(seen.filter((p) => MASCOT.test(p)))];
  // 「우리 동네로」로 게임에서 나온다
  await f.locator('#w-room').click();
  await sleep(1200);
  notes.leftGame = (await page.locator('.game-frame').count()) === 0;
  await shot('11_동네로');
  return { name, view, notes, errors, failed };
  } finally { await 닫기(browser); }
}

화면시험({ 분: 20 }, async () => {
  const server = await startServer();
  const out = [];
  for (const [name, view] of [['390', { width: 390, height: 844 }], ['1280', { width: 1280, height: 800 }]]) {
    try { out.push(await run(name, view)); } catch (error) { out.push({ name, error: String(error) }); }
  }
  server?.kill();
  fs.writeFileSync(path.join(OUT, '앱화면.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, out }, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
});
