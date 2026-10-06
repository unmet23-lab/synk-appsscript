'use strict';
// 손맛 소리 굽기: 시청 페이지(sound-lab.html)와 같은 합성으로 장면마다 WAV를 굽고(OfflineAudioContext), sound_check.py로 잰다.
// 쓰는 법: node experiences/talk-rally/server.mjs 를 켠 뒤  node experiences/talk-rally/qa/sound.cjs  → qa/sound/*.wav(git 제외) · qa/sound-results.json · qa/소리_스펙트럼.jpg
const path = require('node:path'), fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const OUT = path.join(__dirname, 'sound'); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.RALLY_URL || 'http://127.0.0.1:5221/';
// [파일 이름, 장면, 길이(초)] — kit:·voice:는 파일 하나 그대로
const LIST = [
  ['kit-earn', 'kit:earn', 0.6], ['kit-achieve', 'kit:achieve', 0.8], ['kit-calm1', 'kit:calm1', 1], ['voice-f01', 'voice:f01', 1.2], ['voice-r06', 'voice:r06', 1.8],
  ['hit-ok', 'hitOk', 0.5], ['quick', 'quick', 0.6], ['hit-wrong', 'hitWrong', 0.4], ['smash', 'smash', 0.9], ['opponent', 'opponent', 0.3],
  ['bounce-near', 'bounceNear', 0.2], ['bounce-far', 'bounceFar', 0.2], ['swing-soft', 'swingSoft', 0.4], ['swing-hard', 'swingHard', 0.4],
  ['exchange', 'exchange', 4.4], ['wrong', 'wrong', 1.9], ['rally', 'rally', 5.6], ['stress', 'stress', 1.8], ['stars', 'stars', 1.4],
  // 안내 음성(2026-10-07): 하나씩, 결과 장면(성취·별·안내), 시작 안내 뒤 몽글의 첫 말
  ['narr-intro', 'narr:intro', 4.2], ['narr-practice', 'narr:practice-done', 2.6], ['narr-daily', 'narr:daily-intro', 4.4], ['narr-best', 'narr:daily-best', 1.9],
  ['narr-r3', 'narr:result-3', 3.0], ['narr-r2', 'narr:result-2', 1.5], ['narr-r1', 'narr:result-1', 3.0], ['narr-r0', 'narr:result-0', 2.8],
  ['results', 'results', 3.9], ['intro-then-line', 'introThenLine', 5.6],
];
(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + 'sound-lab.html');
  await page.waitForFunction(() => window.__lab);
  for (const [name, scene, sec] of LIST) {
    const b64 = await page.evaluate(async ({ scene, sec }) => {
      const m = /^(kit|voice|narr):(.+)$/.exec(scene);
      const events = m ? [{ t: 0.02, kind: m[1], name: m[2] }] : window.__lab.SEQ[scene]().map((e) => ({ ...e, t: e.t + 0.02 }));
      return window.__lab.render(events, sec);
    }, { scene, sec });
    fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.from(b64, 'base64'));
  }
  await browser.close();
  if (errors.length) { console.error(errors); process.exit(1); }
  const r = spawnSync('python', [path.join(__dirname, 'sound_check.py')], { encoding: 'utf8', stdio: 'inherit' });
  process.exit(r.status || 0);
})().catch((e) => { console.error(e); process.exit(1); });
