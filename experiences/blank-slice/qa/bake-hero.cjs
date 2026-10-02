'use strict';
// 입구 그림 굽기: 게임의 3D 펠트 조각(물·빵·옷·책)을 실제 무대에서 던져 꼭대기에서 멈추고, 배경 없이 찍는다(0원).
// 쓰는 법: 서버를 켠 뒤  node experiences/blank-slice/qa/bake-hero.cjs  → assets/hero-pieces.webp
const path = require('node:path'), fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:5217/?qa');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 1, practiced: true, slow: false, best: null })); });
  await page.reload(); await page.waitForSelector('#btn-start');
  await page.click('#btn-start'); await sleep(400);
  await page.addStyleTag({ content: '.arena{background:transparent!important}.arena::after,.sentence,.tip,.pop,.explain,.game-bar{display:none!important}body,.game{background:transparent!important}' });
  await page.evaluate(() => {
    window.__slice.hold();
    const st = window.__slice.stage(); st.clear(); st.setShowNumbers(false); st.setTopPx(40);
    st.toss([{ word: '빵', n: 1 }, { word: '물', n: 2 }, { word: '옷', n: 3 }, { word: '책', n: 4 }], { hang: 3.6, highlight: 1 });
  });
  await sleep(1850);   // 꼭대기 근처
  await page.evaluate(() => window.__slice.stage().pause(true));
  await sleep(200);
  const raw = path.join(__dirname, 'shots', 'hero-raw.png'); fs.mkdirSync(path.dirname(raw), { recursive: true });
  await page.locator('#arena').screenshot({ path: raw, omitBackground: true });
  await browser.close();
  const out = path.join(__dirname, '..', 'assets', 'hero-pieces.webp');
  const py = [
    'from PIL import Image', 'import sys',
    'im = Image.open(sys.argv[1]).convert("RGBA")',
    'bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()',
    'im = im.crop((max(0,bbox[0]-20), max(0,bbox[1]-20), min(im.width,bbox[2]+20), min(im.height,bbox[3]+20)))',
    'im.thumbnail((1100, 1100), Image.LANCZOS)',
    'im.save(sys.argv[2], "WEBP", quality=90, alpha_quality=100, method=6)',
    'print(im.size)',
  ].join('\n');
  const r = spawnSync('python', ['-c', py, raw, out], { encoding: 'utf8' });
  console.log(r.stdout.trim(), r.stderr.trim().slice(-300), '→', path.relative(process.cwd(), out));
})().catch((e) => { console.error(e); process.exit(1); });
