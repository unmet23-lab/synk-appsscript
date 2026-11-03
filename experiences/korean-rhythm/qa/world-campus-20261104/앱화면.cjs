'use strict';
// 말의 리듬 캠퍼스 판(2026-11-04) — 실제 WORLD 앱(이 PC 시범 서버) 안에서 「놀이」 → 게임 틀 → 입구 → 놀이 → 결과를 찍고, 몽글 흔적을 잰다:
// 틀 안 모든 문서의 그림(<img> · 배경) 이름, 받은 요청 이름, 보이는 글 · 숨은 글에서 까몽 · 몽글 · 마린 · mongle · 펠트 낱말을 찾는다.
// 새 손님(기기 기록)으로 처음 실행(언어 · 한글 · 튜터)을 지난다. 체험 판(손님)이라 한 곡이다. 넘침 · 콘솔 오류 · 실패한 요청도 본다.
//   node experiences/korean-rhythm/qa/world-campus-20261104/앱화면.cjs   (WORLD 앱 시범 서버를 이 스크립트가 띄우고 끝에 내린다 · 찍은 것은 공용 작업본 .tmp/rhythm-world-20261104/앱화면/)
//   이미 뜬 서버를 쓰려면 WORLD_URL=http://127.0.0.1:<포트>. 형제 저장소 자리는 SYNK_TALK_ROOT(기본 ../SYNK-talk).
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../../../..');
const PORT = 4298;
const BASE = process.env.WORLD_URL || `http://127.0.0.1:${PORT}`;
async function startServer() {
  if (process.env.WORLD_URL) return null;
  const talk = process.env.SYNK_TALK_ROOT || path.resolve(공용작업본(ROOT), '..', 'SYNK-talk');
  const child = spawn(process.execPath, ['experiences/synk-world-app/server.mjs'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, SYNK_TALK_ROOT: talk, SYNK_WORLD_PORT: String(PORT) } });
  for (let i = 0; i < 100; i += 1) { try { const r = await fetch(`${BASE}/mobile.html`); if (r.ok) return child; } catch { /* 아직 */ } await new Promise((res) => setTimeout(res, 200)); }
  child.kill();
  throw Error('WORLD 앱 시범 서버가 뜨지 않았다');
}
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'rhythm-world-20261104', '앱화면');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MASCOT = /mongle|몽글|까몽|kkamong|gamong|마린|marin\b|maru|kit\/felt\//i;

async function traces(gameFrame) {
  return gameFrame.evaluate(() => {
    const out = { visibleImages: [], domImages: [], text: [], pseudo: [] };
    for (const el of document.querySelectorAll('img')) {
      const src = el.getAttribute('src') || '';
      out.domImages.push(src);
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden') out.visibleImages.push(src);
    }
    for (const el of document.querySelectorAll('*')) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && /url\(/.test(bg) && !/^url\("data:/.test(bg) && el.getBoundingClientRect().width > 0) out.visibleImages.push(bg);
      for (const side of ['::before', '::after']) {   // 가상 요소의 그림(펠트 체크 등) — 보이는 요소에 붙은 것만
        const ps = getComputedStyle(el, side);
        if (ps.content !== 'none' && /url\(/.test(ps.backgroundImage) && !/^url\("data:/.test(ps.backgroundImage) && el.getBoundingClientRect().width > 0) out.pseudo.push(`${el.tagName}.${el.className}${side} ${ps.backgroundImage.slice(-40)}`);
      }
    }
    const body = document.body.innerText || '';   // 보이는 글
    for (const word of ['몽글', '까몽', '마린', '펠트', '크림색', 'LAB']) if (body.includes(word)) out.text.push(word);
    return out;
  });
}

async function run(name, view) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2, hasTouch: view.width < 700, isMobile: view.width < 700 });
  await ctx.addInitScript(() => { try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch { /* 저장 못 함 */ } });
  const page = await ctx.newPage(), errors = [], failed = [], requests = [], notes = {};
  page.setDefaultTimeout(25000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/world\/bootstrap$/.test(new URL(r.url()).pathname)) failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (label) => { await page.mouse.move(2, 2).catch(() => {}); await page.screenshot({ path: path.join(OUT, `${name}_${label}.png`) }); };
  await page.goto(`${BASE}/${view.width < 700 ? 'mobile' : 'desktop'}.html?opening=off`);
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await sleep(1200);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=rhythm]');
  notes.cardImage = await page.locator('[data-game=rhythm] img').getAttribute('src');
  notes.locked = await page.locator('[data-game=rhythm]').getAttribute('data-locked') !== null;
  await shot('01_놀이');
  const before = requests.length;
  await page.locator('[data-game=rhythm]').click();
  await page.waitForSelector('.game-frame');
  const f = page.frameLocator('.game-frame');
  await f.locator('#start-button').waitFor();
  await sleep(2200);
  notes.host = await f.locator('html').getAttribute('data-host');
  const handle = await page.locator('.game-frame').elementHandle();
  const frame = await handle.contentFrame();
  notes.lobby = await traces(frame);
  await shot('02_입구');
  notes.lobbyOverflow = await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  // 앱 쪽 곁 튜터(게임 틀 바깥 — 마스코트 사진 · 말풍선 · 조작 연습)도 없어야 한다
  notes.tutorOutside = await page.evaluate(() => ({ companion: document.querySelectorAll('#panel-content .game-tutor').length, practice: document.querySelectorAll('dialog.tutor-practice').length, window: !!window.__synkGameTutor }));
  await f.locator('#start-button').click();
  await sleep(6500);
  await shot('03_놀이');
  notes.play = await traces(frame);
  await f.locator('#pause-button').click();
  await sleep(500);
  await shot('04_멈춤');
  notes.pauseKeys = await f.locator('#pause-dialog [data-w-keys]').textContent();
  await f.locator('#leave-button').click();
  await sleep(1200);
  await shot('05_입구로');
  // 결과까지: 앱 안 틀을 ?qa로 다시 열어(같은 틀 · 같은 앱) 자동 연주 + 건너뛰기로 곡 끝을 본다
  await frame.goto(frame.url().split('?')[0] + '?qa=1');
  await f.locator('#start-button').waitFor();
  await sleep(1500);
  await f.locator('#start-button').click();
  await frame.waitForFunction(() => window.__rhythm?.state().screen === 'game' && window.__rhythm.state().time > -2, null, { timeout: 40000 });
  await frame.evaluate(() => { window.__rhythm.autoplay(true); window.__rhythm.plan(['right', 'right', 'right', 'right', 'right']); });
  await frame.waitForFunction(() => window.__rhythm.state().time > 5, null, { timeout: 40000 });
  const q0 = await frame.evaluate(() => window.__rhythm.state().questions[0]);
  await frame.evaluate((t) => window.__rhythm.seek(t), q0.answerOpen - 0.2);
  await sleep(1500);
  await shot('06_답');
  const dur = await frame.evaluate(() => window.__rhythm.state().duration);
  await frame.evaluate((t) => window.__rhythm.seek(t), dur - 3);
  await frame.waitForFunction(() => window.__rhythm.state().screen === 'results', null, { timeout: 30000 });
  await sleep(3800);
  await shot('07_결과');
  notes.results = await traces(frame);
  notes.resultsTitle = await frame.evaluate(() => document.getElementById('result-title')?.textContent);
  notes.resultsOverflow = await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await frame.evaluate(() => document.scrollingElement.scrollTo(0, document.scrollingElement.scrollHeight));
  await sleep(300);
  await shot('08_결과아래');
  const seen = requests.slice(before);
  notes.gameRequests = seen.length;
  notes.mascotRequests = [...new Set(seen.filter((p) => MASCOT.test(p)))];
  notes.feltRequests = [...new Set(seen.filter((p) => /felt/.test(p)))];
  await browser.close();
  return { name, view, notes, errors, failed };
}

(async () => {
  const server = await startServer();
  const out = [];
  for (const [name, view] of [['390', { width: 390, height: 844 }], ['1280', { width: 1280, height: 800 }]]) {
    try { out.push(await run(name, view)); } catch (error) { out.push({ name, error: String(error) }); }
  }
  server?.kill();
  fs.writeFileSync(path.join(OUT, '앱화면.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, out }, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
})();
