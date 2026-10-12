// 면접실 방 준비 시점 검증: 시작→첫 질문까지 시간, 시작 때 3D 방 파일 요청 여부,
// 면접 중 처음 「방 둘러보기」(자동 일시정지→둘러보기→Esc→계속), 완료 뒤 둘러보기 화면.
// 사용: node flow-room.mjs <out> <scenario: flat|mid> [quality] [width] [overlayRoot|-]
import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [,, out = 'flow-room', scenario = 'flat', quality = '4k', vwArg = '1440', overlayRoot = '-'] = process.argv;
const vw = Number(vwArg), vh = vw < 600 ? 844 : 900;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 600 ? 2 : 1, colorScheme: 'dark', locale: 'ko-KR' });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
if (overlayRoot !== '-') {
  await ctx.route('https://synk.im/path/**', async (route) => {
    const url = new URL(route.request().url());
    const file = overlayRoot + decodeURIComponent(url.pathname);
    if (fs.existsSync(file) && fs.statSync(file).isFile() && !file.endsWith('.mp4')) return route.fulfill({ status: 200, contentType: types[path.extname(file)], body: fs.readFileSync(file) });
    return route.continue();
  });
}
const page = await ctx.newPage();
const log = [];
const t0 = Date.now();
let clickAt = 0;
const note = (m) => { const line = `${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`; log.push(line); console.log(line); };
const requests = [];
page.on('request', (r) => { const u = r.url().split('?')[0]; if (/three\.(module|core)\.js|room\/|room-reference-4k|room-poster-4k/.test(u)) requests.push({ t: Date.now() - t0, file: u.split('/').slice(-2).join('/') }); });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) note(`console ${m.type()}: ${m.text().slice(0, 160)}`); });
page.on('pageerror', (e) => note('pageerror ' + e.message.slice(0, 160)));
const state = () => page.evaluate(() => ({ phase: document.body.dataset.phase, label: document.getElementById('phase-label')?.textContent, turn: document.getElementById('turn-label')?.textContent, status: document.getElementById('status')?.textContent?.slice(0, 70), vr: document.getElementById('vr-status')?.textContent?.slice(0, 60), videos: [...document.querySelectorAll('#film-stage video')].map((v) => ({ src: (v.currentSrc || '').split('/').pop(), t: Number(v.currentTime.toFixed(2)), paused: v.paused, op: v.style.opacity })) }));
const waitPhase = async (wanted, limitMs, tag) => {
  const until = Date.now() + limitMs;
  while (Date.now() < until) {
    const s = await state();
    if (s.phase === 'error') { note(`${tag} ERROR STATE: ${JSON.stringify(s).slice(0, 400)}`); throw new Error('error phase at ' + tag); }
    if (wanted(s)) { note(`${tag} reached: ${JSON.stringify(s).slice(0, 260)}`); return s; }
    await page.waitForTimeout(250);
  }
  const s = await state(); note(`${tag} TIMEOUT: ${JSON.stringify(s).slice(0, 400)}`);
  await page.screenshot({ path: path.join(out, `timeout-${tag}.png`) });
  throw new Error('timeout ' + tag);
};
const previewOpen = () => page.waitForFunction(() => { const m = document.getElementById('vr-stage'); return m && !m.hidden && [...m.querySelectorAll('button')].some((b) => !b.hidden && b.textContent.includes('드래그')); }, null, { timeout: 90000 });
const result = { scenario, quality, width: vw, overlay: overlayRoot !== '-' };
try {
  await page.goto('https://synk.im/path/interview/film/rehearsal.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.selectOption('#quality', quality); await page.waitForTimeout(400);
  clickAt = Date.now() - t0;
  await page.click('#start'); note('start clicked');
  const playing = await waitPhase((s) => s.label === '첫 번째 질문' && s.videos.some((v) => !v.paused && v.op === '1' && v.t > 0.3), 180000, 'question-playing');
  result.startToQuestionMs = Date.now() - t0 - clickAt;
  result.roomRequestsBeforeQuestion = requests.filter((r) => r.t < Date.now() - t0).length;
  if (scenario === 'fail') {
    // 방 만들기가 실패하면: 면접은 멈춘 채 안내가 나오고, 「이어서 진행」으로 계속할 수 있어야 한다.
    await page.route('**/vendor/three.module.js', (route) => route.abort());
    await page.waitForTimeout(1200);
    await page.click('#room-preview'); note('room preview clicked (three.js blocked)');
    await waitPhase((s) => s.phase === 'paused', 5000, 'auto-paused');
    await page.waitForFunction(() => document.getElementById('vr-status').textContent.includes('준비하지 못했습니다'), null, { timeout: 30000 });
    result.failure = await page.evaluate(() => ({ vr: document.getElementById('vr-status').textContent, pauseDisabled: document.getElementById('pause').disabled, pauseLabel: document.getElementById('pause').textContent, previewHidden: document.getElementById('vr-stage').hidden }));
    note('failure ' + JSON.stringify(result.failure));
    await page.click('#pause'); note('resume clicked');
    await waitPhase((s) => s.phase !== 'paused', 20000, 'resumed-after-failure');
  }
  if (scenario === 'mid') {
    await page.waitForTimeout(1500);
    const before = requests.length;
    await page.click('#room-preview'); note('room preview clicked mid-question');
    await waitPhase((s) => s.phase === 'paused', 5000, 'auto-paused');
    // 방을 처음 만드는 동안에는 재개·다시 열기가 막혀야 한다.
    const guard = await page.evaluate(() => ({ pauseDisabled: document.getElementById('pause').disabled, previewDisabled: document.getElementById('room-preview').disabled, vr: document.getElementById('vr-status').textContent }));
    await page.evaluate(() => document.getElementById('pause').click());
    await page.waitForTimeout(400);
    result.resumeDuringBuild = { ...guard, phaseAfterTry: (await state()).phase };
    note('resume during build ' + JSON.stringify(result.resumeDuringBuild));
    await previewOpen(); note('preview open');
    result.afterOpen = await page.evaluate(() => ({ pauseDisabled: document.getElementById('pause').disabled, previewDisabled: document.getElementById('room-preview').disabled }));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, `mid-preview-${vw}.png`) });
    result.roomRequestsOnPreview = requests.length - before;
    await page.keyboard.press('Escape'); note('Esc');
    await page.waitForTimeout(800);
    const s = await state(); result.afterEsc = { phase: s.phase, previewHidden: await page.evaluate(() => document.getElementById('vr-stage').hidden) };
    note('after Esc ' + JSON.stringify(result.afterEsc));
    await page.click('#pause'); note('resume clicked');
    await waitPhase((s) => s.phase !== 'paused' && s.videos.some((v) => !v.paused && v.op === '1'), 20000, 'resumed');
  }
  await waitPhase((s) => s.label === '답변 중' && s.turn?.startsWith('1'), 180000, 'answer1');
  if (scenario === 'mid') {
    // 이미 만든 방은 면접 중에 다시 열어도 멈추지 않는다.
    await page.click('#room-preview'); await previewOpen(); await page.waitForTimeout(1200);
    const s = await state(); result.secondOpenPhase = s.phase; note('second open phase ' + s.phase);
    await page.screenshot({ path: path.join(out, `mid-preview2-${vw}.png`) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
  await page.fill('#answer', '요양원 봉사활동에서 어르신 식사를 직접 도와드린 경험이 있습니다. 천천히 드시도록 기다리고 상태를 살폈습니다.');
  await page.click('#submit'); note('answer1 submitted');
  await waitPhase((s) => s.label === '답변 중' && s.turn?.startsWith('2'), 240000, 'answer2');
  await page.fill('#answer', '식사 전후로 삼킴 상태를 확인하고, 이상이 있으면 바로 간호사에게 보고했습니다.');
  await page.click('#submit'); note('answer2 submitted');
  await waitPhase((s) => s.label === '면접 종료', 240000, 'complete');
  result.completeAtMs = Date.now() - t0 - clickAt;
  await page.waitForTimeout(1000);
  // 완료 뒤 둘러보기: 회색 화면이 아니라 마지막 장면이 보여야 한다(실패 시나리오는 three.js를 막았으니 건너뛴다).
  if (scenario !== 'fail') {
    const before = requests.length;
    await page.click('#room-preview'); await previewOpen(); await page.waitForTimeout(2500);
    result.roomRequestsAfterComplete = requests.length - before;
    const box = await page.locator('#vr-stage canvas').boundingBox();
    await page.screenshot({ path: path.join(out, `complete-preview-${vw}.png`), clip: box });
    note('complete preview captured');
  }
  result.ok = true;
} catch (e) { note('ERROR ' + e.message); result.ok = false; result.error = e.message; }
result.requests = requests.map((r) => ({ ...r, t: r.t - clickAt }));
fs.writeFileSync(path.join(out, `result-${scenario}-${quality}-${vw}.json`), JSON.stringify(result, null, 1));
fs.writeFileSync(path.join(out, `log-${scenario}-${quality}-${vw}.txt`), log.join('\n'));
console.log(JSON.stringify({ ...result, requests: result.requests.length }));
await browser.close();
