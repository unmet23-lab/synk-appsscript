// Before / after pictures of the SYNK ID sign-in screen for review (tools/검수묶음.mjs 준비 --캡처 <out dir>).
//   node experiences/synk-account/qa/login-one-form-20261111/capture.mjs <playwright module dir> <out dir> <before files dir> <after files dir>
// Each files dir holds a publishing candidate (id__index.html, id__style.css, id__dist__app.js — see run.mjs SYNK_QA_FILES).
// Writes <out dir>/전|후/<width>/<scene>.png + .txt (the page's words) and report.json (overflow, page errors).
// The page talks to run.mjs's synthetic servers (SYNK_QA_SERVE=1); the last-time hint is put into localStorage by hand,
// so no sign-in is needed for the pictures.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const [playwrightDir, outDir, beforeDir, afterDir] = process.argv.slice(2);
if (!playwrightDir || !outDir || !beforeDir || !afterDir) throw new Error('usage: capture.mjs <playwright module dir> <out dir> <before files dir> <after files dir>');
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
const here = path.dirname(fileURLToPath(import.meta.url));
const hint = method => JSON.stringify({ v: 2, method, ...(method === 'email' ? { email: 'member-a@synthetic.test' } : {}), masked: 'me***@synthetic.test', at: Date.now() });
const openEmail = async tab => { if (await tab.isVisible('#email-method') && !await tab.isVisible('#email-fields')) await tab.click('#email-method'); };
// The same steps on both pages; a step that the old page has no button for is simply the old page as it was.
const SCENES = [
  ['1-first-visit', async () => {}],
  ['2-email-way', async tab => { await openEmail(tab); }],
  ['3-wrong-password', async tab => { await openEmail(tab);await tab.fill('#email', 'member-a@synthetic.test');await tab.fill('#password', 'synthetic-wrong');await tab.click('#auth-submit');await tab.waitForFunction(() => /맞지 않아요/.test(document.getElementById('notice').textContent)); }],
  ['4-last-time-email', async () => {}, 'email'],
  ['5-last-time-google', async () => {}, 'google'],
  ['6-sign-up', async tab => { await tab.click('#switch-row [data-view="signup"]'); }],
  ['7-sign-up-email', async tab => { await tab.click('#switch-row [data-view="signup"]');await openEmail(tab); }],
  ['8-forgot-password', async tab => { await openEmail(tab);await tab.click('#forgot-row [data-view="recover"]'); }],
  // Signed in, an app on this PC asks to connect (run.mjs's device-1): before, the page handed the sign-in over at once;
  // now the card names the account and waits for the press.
  ['11-app-on-this-pc', async (tab, base) => { await openEmail(tab);await tab.fill('#email', 'member-a@synthetic.test');await tab.fill('#password', 'synthetic-pass-a1');await tab.click('#auth-submit');
    await tab.waitForSelector('#account-profile:not([hidden])');await tab.goto(base + '?authorization_id=device-1', { waitUntil: 'networkidle' });
    await tab.waitForFunction(() => location.port === '43999' || !document.getElementById('consent')?.hidden);await tab.waitForTimeout(500); }],
];
const ARRIVED = '<!doctype html><meta charset="utf-8"><title>synthetic arrival</title><main style="font:16px sans-serif;padding:32px">앱의 도착 주소로 넘어갔어요(합성). 누름 없이 여기까지 왔다면 자동 승인이에요.</main>';
const report = { made: new Date().toISOString(), scenes: [] };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome' });
async function serve(files, google, port) {
  const child = spawn(process.execPath, [path.join(here, 'run.mjs'), playwrightDir, path.join(outDir, '.serve')], { env: { ...process.env, SYNK_QA_SERVE: '1', SYNK_QA_PORT: String(port), SYNK_QA_AUTH_PORT: String(port + 1), SYNK_QA_FILES: path.resolve(files), SYNK_QA_GOOGLE: google ? 'on' : 'off' }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/`;
  for (let n = 0; n < 80; n++) { try { if ((await fetch(base)).ok) return { child, base }; } catch { /* not up yet */ } await new Promise(resolve => setTimeout(resolve, 100)); }
  child.kill();throw new Error('the synthetic servers did not start');
}
try {
  let port = 4871;
  for (const [side, files] of [['전', beforeDir], ['후', afterDir]]) for (const google of [true, false]) {
    const { child, base } = await serve(files, google, port);port += 2;
    try {
      for (const width of [1440, 390]) for (const [name, step, last] of google ? SCENES : [['9-without-google', async () => {}]]) {
        const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } });
        await context.route('http://127.0.0.1:43999/**', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: ARRIVED }));
        const tab = await context.newPage(), errors = [];
        tab.on('pageerror', error => errors.push(String(error).slice(0, 200)));
        tab.on('console', message => { if (message.type() === 'error' && !/atlas-learning|404|status of (?:400|401|403|422)/.test(message.text())) errors.push(message.text().slice(0, 200)); });
        if (last) await context.addInitScript(value => { localStorage.setItem('synk.id.recent-login.v1:/', value); }, hint(last));
        await tab.goto(base, { waitUntil: 'networkidle' });await tab.waitForSelector('#auth-panel:not([hidden])');
        await tab.waitForFunction(() => !document.getElementById('google-availability').textContent.includes('확인하고'));
        await step(tab, base);await tab.waitForTimeout(350);
        const dir = path.join(outDir, side, String(width));fs.mkdirSync(dir, { recursive: true });
        await tab.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
        fs.writeFileSync(path.join(dir, name + '.txt'), await tab.evaluate(() => document.querySelector('main').innerText));
        report.scenes.push({ side, width, name, google, overflow: await tab.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), errors });
        await context.close();
      }
    } finally { child.kill(); }
  }
} finally { await browser.close(); }
fs.rmSync(path.join(outDir, '.serve'), { recursive: true, force: true });
report.summary = { pictures: report.scenes.length, overflowing: report.scenes.filter(scene => scene.overflow > 0).length, withErrors: report.scenes.filter(scene => scene.errors.length).length };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
