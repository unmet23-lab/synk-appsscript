// SYNK TOWN's 「마을 기록」 card (W6c) on the synk.im portal 「내 계정」 and WORLD's account sheet, in a real Chrome against the
// synthetic preview (preview.html — no sign-in, account server or network):
//   node experiences/synk-account/qa/town-records-20261028/qa.mjs <playwright module dir> <out dir>
// Every state the route can answer (entered · switch on · consent given with the switch off · academy · never entered · tables
// not ready · read failed) at 1440 and 390, with the forget, clear (asks once more) and 자세히 controls. One JSON line per check.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const [playwrightDir, outDir] = process.argv.slice(2);
if (!playwrightDir || !outDir) throw new Error('usage: qa.mjs <playwright module dir> <out dir>');
const require = createRequire(import.meta.url), { chromium } = require(path.resolve(playwrightDir));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), origin = 'http://127.0.0.1:4280';
await fs.mkdir(outDir, { recursive: true });
const results = [];
const check = (name, ok, details = {}) => { results.push({ name, ok: !!ok, ...details });console.log(JSON.stringify({ name, ok: !!ok, ...details })); };
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome', headless: true });
async function open(surface, mode, width) {
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } }), errors = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === '/learning-hub/atlas-learning.js') return route.fulfill({ status: 200, body: await fs.readFile(path.resolve(root, '../learning-hub/atlas-learning.js')), contentType: 'application/javascript' });
    if (url.origin !== origin || !url.pathname.startsWith('/synk-account/')) { errors.push('network ' + url.href);return route.abort(); }
    const target = path.resolve(root, decodeURIComponent(url.pathname.slice('/synk-account/'.length)) || 'index.html');
    if (!target.startsWith(root + path.sep)) return route.fulfill({ status: 404, body: '' });
    try { await route.fulfill({ status: 200, body: await fs.readFile(target), contentType: TYPES[path.extname(target)] || 'application/octet-stream' }); }
    catch { errors.push('404 ' + url.pathname);await route.fulfill({ status: 404, body: '' }); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error).slice(0, 200)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 200)); });
  await page.goto(`${origin}/synk-account/preview.html?account=${surface === 'world' ? 'world' : 'portal'}&town=${mode}`);
  const card = surface === 'world' ? '#account .town-card' : '#account .town-block';
  await page.waitForSelector(`${card} .town-records:not([data-phase=loading])`, { timeout: 15000 });
  return { context, page, errors, card };
}
const overflowOf = page => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
const cardText = (page, card) => page.locator(card).innerText();
try {
  const states = {
    entered: ['주민이 아는 나', '찻집 주인 · 찻집 일 — 같이 했어요', '마을이 맞춰 둔 것', '단추가 없는 줄은', '익숙한 생활', '맞춤 기록 모두 비우기'],
    switch: ['마을을 낫게 하는 데 쓰는 기록', '쓰지 않고 있어요. 안 써도 마을은 똑같아요.', '좋아요', '자세히'],
    granted: ['쓰고 있어요. 30일이 지나면 지워요.', '그만 쓰기'],
    academy: ['학원 소속 계정에는 묻지 않아요.'],
    new: ['싱크타운에 들어가면'], unready: ['마을 기록은 아직 쓸 수 없어요.'], fail: ['마을 기록을 불러오지 못했어요.', '다시 불러오기'],
  };
  for (const surface of ['portal', 'world']) for (const [mode, expected] of Object.entries(states)) for (const width of mode === 'entered' || mode === 'switch' ? [1440, 390] : [1440]) {
    const { context, page, errors, card } = await open(surface, mode, width);
    const text = await cardText(page, card), overflow = await overflowOf(page), shot = `${surface}-${mode}-${width}.png`;
    await page.locator(card).screenshot({ path: path.join(outDir, shot) });
    const absent = mode === 'switch' ? [] : mode === 'granted' ? ['좋아요'] : ['좋아요', '그만 쓰기'];
    check(`${surface} ${mode} ${width}: the card reads as the route says`, expected.every(line => text.includes(line)) && absent.every(line => !text.includes(line)) && overflow === 0 && !errors.length,
      { overflow, errors, screenshot: shot, ...(expected.every(line => text.includes(line)) ? {} : { text: text.slice(0, 300) }) });
    if (mode === 'new' || mode === 'unready' || mode === 'academy') check(`${surface} ${mode}: no rights button on this state`, await page.locator(`${card} [data-town]:not([data-town$=".more"])`).count() === (mode === 'academy' ? 7 : 0), {});
    if (mode === 'entered' && width === 1440) {
      await page.click(`${card} [data-town="known.r0"]`);await page.waitForFunction(selector => /그 주민의 기억에서 뺐어요/.test(document.querySelector(selector).textContent), card);
      check(`${surface}: 잊어 주세요 takes the row out`, !(await cardText(page, card)).includes('찻집 주인 · 찻집 일'), {});
      await page.click(`${card} [data-town="clear.a0"]`);await page.waitForSelector('dialog[open]');await page.screenshot({ path: path.join(outDir, `${surface}-clear-confirm-1440.png`) });
      const dialog = await page.locator('dialog[open]').innerText();
      await page.click('dialog[open] button[value=cancel]');await page.waitForTimeout(100);
      check(`${surface}: 비우기 asks once more and cancelling keeps everything`, dialog.includes('맞춤 기록을 모두 비울까요?') && (await cardText(page, card)).includes('쟁반이 기울어요'), {});
      await page.click(`${card} [data-town="clear.a0"]`);await page.waitForSelector('dialog[open]');await page.click('dialog[open] button[value=ok]');
      await page.waitForFunction(selector => /맞춤 기록을 모두 비웠어요/.test(document.querySelector(selector).textContent), card);
      check(`${surface}: confirmed 비우기 empties the personal records`, !(await cardText(page, card)).includes('쟁반이 기울어요') && !errors.length, { errors });
      // The keyboard stays on the control after the card redraws.
      await page.focus(`${card} [data-town="settings.r0"]`);await page.keyboard.press('Enter');await page.waitForFunction(selector => /자주 오는 때에 맞추지 않아요/.test(document.querySelector(selector).textContent), card);
      check(`${surface}: the visit-bands switch turns off by keyboard and keeps the focus`, await page.evaluate(() => document.activeElement?.dataset?.town) === 'settings.r0', {});
      await page.locator(card).screenshot({ path: path.join(outDir, `${surface}-entered-after-1440.png`) });
    }
    if (mode === 'switch' && width === 1440) {
      await page.click(`${card} [data-town="eval.more"]`);const open = await cardText(page, card);
      check(`${surface}: 자세히 opens the whole consent text`, open.includes('무엇을 위해') && open.includes('30일이 지나면 지웁니다') && open.includes('자세히 접기'), {});
      await page.click(`${card} [data-town="eval.a0"]`);await page.waitForFunction(selector => /쓰기 시작했어요/.test(document.querySelector(selector).textContent), card);
      check(`${surface}: 좋아요 grants and the row becomes 그만 쓰기`, (await cardText(page, card)).includes('그만 쓰기'), {});
      await page.locator(card).screenshot({ path: path.join(outDir, `${surface}-switch-after-1440.png`) });
    }
    if (mode === 'fail') {
      check(`${surface}: a failed read offers to try again`, await page.locator(`${card} [data-town="retry"]`).count() === 1, {});
    }
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(outDir, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2) + '\n');
process.exitCode = results.every(row => row.ok) ? 0 : 1;
