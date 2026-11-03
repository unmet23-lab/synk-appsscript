'use strict';
// 운전석 까몽 확인 캡처(2026-11-04). experiences 폴더를 정적 서버로 띄운 뒤:
//   KKAMONG_ORIGIN=http://127.0.0.1:5288 node experiences/korean-racing/qa/kkamong-wings-20261104/capture.cjs [출력 접두어]
// view.html을 헤드리스 크롬(실제 WebGL)으로 열어 혼자 · 차에 앉힌 까몽을 여러 각도에서 PNG로 남긴다.
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const ORIGIN = process.env.KKAMONG_ORIGIN || 'http://127.0.0.1:5288';
const prefix = process.argv[2] || 'after';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const SHOTS = {
  'solo-front': 'yaw=0&pitch=4',
  'solo-r34': 'yaw=-38&pitch=6',   // 정본 우34: 얼굴이 화면 오른쪽을 본다(카메라가 캐릭터 왼쪽 앞)
  'solo-l34': 'yaw=38&pitch=6',
  'solo-side': 'yaw=90&pitch=4',
  'solo-back': 'yaw=180&pitch=8',
  'solo-back34': 'yaw=145&pitch=14',
  'gt-chase': 'car=gt&yaw=180&pitch=14&dist=4.2&fov=34',
  'gt-side': 'car=gt&yaw=90&pitch=10&dist=3.6',
  'gt-front34': 'car=gt&yaw=35&pitch=12&dist=3.6',
  'gt-back34': 'car=gt&yaw=140&pitch=18&dist=3.4',
  'open-back34': 'car=open&yaw=140&pitch=18&dist=3.4',
  'rally-back34': 'car=rally&yaw=140&pitch=18&dist=3.4',
  'rally-side': 'car=rally&yaw=90&pitch=10&dist=3.6',
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const only = process.env.KKAMONG_ONLY ? process.env.KKAMONG_ONLY.split(',') : null;
  let stats = null;
  for (const [name, query] of Object.entries(SHOTS)) {
    if (only && !only.includes(name)) continue;
    await page.goto(`${ORIGIN}/korean-racing/qa/kkamong-wings-20261104/view.html?${query}`);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
    stats = await page.evaluate(() => window.stats);
    await page.locator('canvas').screenshot({ path: path.join(OUT, `${prefix}-${name}.png`) });
    console.log('saved', `${prefix}-${name}.png`);
  }
  console.log(JSON.stringify({ stats, errors }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
