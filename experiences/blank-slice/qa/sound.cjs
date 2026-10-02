'use strict';
// 손맛 소리 굽기: 시청 페이지(sound-lab.html)와 같은 합성으로 소리마다 WAV를 굽고(OfflineAudioContext), sound_check.py로 잰다.
// 쓰는 법: 서버를 켠 뒤  node experiences/blank-slice/qa/sound.cjs  → qa/sound/*.wav(git 제외) · qa/sound-results.json · qa/소리_스펙트럼.jpg
const path = require('node:path'), fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const OUT = path.join(__dirname, 'sound'); fs.mkdirSync(OUT, { recursive: true });

// [파일 이름, 시청 장면, 변형, 길이(초)]
const LIST = [
  ['kit-earn', 'kit:earn', null, 0.6], ['kit-achieve', 'kit:achieve', null, 0.8], ['kit-calm1', 'kit:calm1', null, 1],
  ...['felt', 'clean'].flatMap((v) => [
    [`${v}-slice-ok`, 'sliceOk', v, 0.6], [`${v}-slice-wrong`, 'sliceWrong', v, 0.6], [`${v}-slice-side`, 'sliceSide', v, 0.6],
    [`${v}-swing-soft`, 'swingSoft', v, 0.5], [`${v}-swing-hard`, 'swingHard', v, 0.5], [`${v}-launch`, 'launch', v, 0.5],
    [`${v}-flow`, 'flow', v, 2.4], [`${v}-combo`, 'combo', v, 5.2], [`${v}-wrong`, 'wrong', v, 1.6],
  ]),
  ['felt-stress', 'stress', 'felt', 1.2], ['clean-stress', 'stress', 'clean', 1.2], ['snap', 'snapOnly', null, 0.4], ['star', 'starOnly', null, 0.5], ['fill', 'fill', null, 0.6], ['stars', 'stars', null, 1.4],
];

const ONLY = (process.env.SOUND_ONLY || '').split(',').filter(Boolean);
const PICK = ONLY.length ? LIST.filter(([n]) => n === 'kit-earn' || ONLY.some((o) => n.includes(o))) : LIST;

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5217/sound-lab.html');
  await page.waitForFunction(() => window.__lab);
  for (const [name, scene, v, sec] of PICK) {
    const b64 = await page.evaluate(async ({ scene, v, sec }) => {
      const events = scene.startsWith('kit:') ? [{ t: 0.02, kind: 'kit', name: scene.slice(4) }] : window.__lab.SEQ[scene](v || 'felt');
      if (!scene.startsWith('kit:')) events.forEach((e) => { e.t += 0.02; });
      return window.__lab.render(events, sec);
    }, { scene, v, sec });
    fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.from(b64, 'base64'));
  }
  await browser.close();
  if (errors.length) { console.error(errors); process.exit(1); }
  const r = spawnSync('python', [path.join(__dirname, 'sound_check.py'), ...(ONLY.length ? ['--only', ...PICK.map(([n]) => n)] : [])], { encoding: 'utf8', stdio: 'inherit' });
  process.exit(r.status || 0);
})().catch((e) => { console.error(e); process.exit(1); });
