'use strict';
// 시연 영상: 실제 게임을 자동으로 진행하며 화면을 녹화하고, 게임 안에서 목소리가 시작된 시각에 맞춰 구운 목소리를 입힌다.
// 쓰는 법: node experiences/entry-check/server.mjs 를 켠 뒤  node experiences/entry-check/qa/demo.cjs [연수|도서관]
// 결과: qa/demo/<이름>.mp4 (H.264 + AAC). 효과음(도장·차임)은 녹음되지 않고 목소리만 들어간다.
const path = require('node:path'), fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.ENTRY_URL || 'http://127.0.0.1:5215/';
const GAME = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'demo'); fs.mkdirSync(OUT, { recursive: true });
const which = process.argv[2] || '연수';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZE = { width: 1280, height: 800 };

async function waitVoice(page, ms = 9000) {   // 지금 말이 끝날 때까지(최대 ms)
  const t = Date.now();
  while (Date.now() - t < ms) { if (await page.evaluate(() => document.querySelector('#talk').hidden && !document.querySelector('#coach-replay').classList.contains('speaking') && !document.querySelector('.fb-reply').classList.contains('speaking'))) break; await sleep(150); }
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: SIZE } });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(URL_BASE + '?qa');
  if (which === '도서관') {
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('synk.entry-check.v1', JSON.stringify({ v: 1, stars: { pool: 3 }, plays: 1, tutorial: true, doneDay: null, motion: true })); });
    await page.reload(); await page.waitForSelector('.venue'); await sleep(1200);
    await page.click('.venue >> nth=1'); await sleep(600); await waitVoice(page); await sleep(500);
    await page.click('#btn-begin');
    for (let g = 0; g < 3; g++) {
      await sleep(900); await waitVoice(page); await sleep(700);
      const st = await page.evaluate(() => window.__entry.state().cur);
      if (st.answer === 'pass') await page.click('#btn-pass');
      else { await page.click('#btn-reject'); await sleep(700); await page.click(`#notice .rule[data-rule="${st.answer}"]`); }
      await sleep(600); await waitVoice(page); await sleep(900);
      await page.click('#btn-next');
    }
    await sleep(2500);
  } else {
    await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#rec-start'); await sleep(1500);
    await page.click('#rec-start'); await sleep(600); await waitVoice(page); await sleep(400);
    await page.click('#btn-begin');
    const next = async () => { await sleep(500); await waitVoice(page); await sleep(500); await page.click('#coach-next'); };
    await sleep(900); await next(); await next(); await next();              // 1~3
    await sleep(600); await waitVoice(page); await sleep(400); await page.click('#btn-pass');   // 4
    await sleep(800); await waitVoice(page); await sleep(500); await page.click('#btn-next');   // 5
    await sleep(900); await next(); await next();                             // 6~7
    await sleep(600); await waitVoice(page); await sleep(400); await page.click('#btn-reject');  // 8
    await sleep(800); await waitVoice(page); await sleep(400); await page.click('#notice .rule[data-rule="food"]');   // 9
    await sleep(800); await waitVoice(page); await sleep(500); await page.click('#btn-next');   // 10
    await sleep(900); await next(); await sleep(600); await waitVoice(page); await sleep(500); await page.click('#coach-next');   // 11~12
    await sleep(2000);
  }
  const times = await page.evaluate(() => window.__entry.voiceTimes());
  const video = page.video();
  await context.close(); await browser.close();
  const webm = await video.path();
  // 목소리 길을 만든다: 각 목소리를 시작 시각만큼 밀어 섞는다
  const inputs = [], filters = [];
  times.forEach(([id, at], i) => {
    const f = path.join(GAME, 'assets', 'voice', `${id}.mp3`);
    if (!fs.existsSync(f)) return;
    inputs.push('-i', f);
    const ms = Math.max(0, at - t0);
    filters.push(`[${inputs.length / 2}:a]adelay=${ms}|${ms}[a${i}]`);
  });
  const labels = filters.map((f) => f.match(/\[a\d+\]$/)[0]).join('');
  const fc = `${filters.join(';')};${labels}amix=inputs=${filters.length}:normalize=0:dropout_transition=0,volume=1.0[aout]`;
  const out = path.join(OUT, `${which}.mp4`);
  // 첫 1.2초는 페이지가 그려지기 전 흰 화면이라 자른다(소리도 같은 만큼 잘려 맞물림이 유지된다)
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, ...inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[aout]', '-ss', '1.2',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr.slice(-800));
  fs.rmSync(webm, { force: true });
  console.log(`${path.relative(GAME, out)} · 목소리 ${filters.length}줄 · ${(fs.statSync(out).size / 1048576).toFixed(1)}MB`);
})().catch((e) => { console.error(e); process.exit(1); });
