'use strict';
// 입구 그림 굽기: 실제 3D 해안도로와 내 차(코스트 GT·마린)를 한 번 그려 assets/lobby-coast.webp(1280×800)와 -720.webp로 남긴다.
// 레이스 화면을 카드 없이 띄우고(?qa heroPose) 캔버스만 찍는다. 각도를 바꿔 보려면 HERO_POSE='{"s":520,...}'.
// 쓰는 법: (experiences 폴더를 정적 서버로 띄운 뒤) node experiences/korean-racing/qa/capture-hero.cjs [주소] [--try]
//   --try: assets 대신 qa/shots/hero-try-*.png 로 여러 각도를 찍어 비교만 한다.
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5281/korean-racing/';
const TRY = process.argv.includes('--try');
const ROOT = path.join(__dirname, '..'), SHOTS = path.join(__dirname, 'shots');
const POSES = TRY ? [
  { name: 'a', s: 1100, offset: 1.7, side: -5.4, back: -7.8, height: 1.5, look: 1.35, fov: 34, rivalsAt: [-20, -38] },
  { name: 'b', s: 1100, offset: 1.7, side: -6.0, back: -8.5, height: 1.6, look: 1.5, fov: 33, rivalsAt: [-20, -38] },
  { name: 'c', s: 1080, offset: 1.4, side: -5.0, back: -7.4, height: 1.35, look: 1.25, fov: 35, rivalsAt: [-18, -36] },
  { name: 'd', s: 1120, offset: 1.7, side: -5.8, back: -8.2, height: 1.7, look: 1.2, fov: 34, rivalsAt: [-22, -40] },
] : [JSON.parse(process.env.HERO_POSE || '{"name":"final","s":1120,"offset":1.7,"side":-5.8,"back":-8.2,"height":1.7,"look":1.2,"fov":34,"rivalsAt":[-22,-40]}')];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1064 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_BASE + '?qa');
  await page.waitForFunction(() => window.__racing?.snapshot().ready, null, { timeout: 120000 });
  await page.addStyleTag({ content: '.qa-clean #game .game-bar,.qa-clean .top-stack,.qa-clean .lane-tags,.qa-clean .dash,.qa-clean .pop{display:none!important}' });
  for (const pose of POSES) {
    await page.evaluate((p) => window.__racingQA.heroPose(p), pose);
    await page.waitForTimeout(2500);   // 나무·도시의 가까운 상세가 차오르게
    const file = TRY ? path.join(SHOTS, `hero-try-${pose.name}.png`) : path.join(SHOTS, 'hero-capture.png');
    await page.locator('#world canvas').screenshot({ path: file });
    console.log('찍음', file);
  }
  if (errors.length) console.log('오류', errors);
  await browser.close();
  if (!TRY) {
    // 캔버스(1600×1064)에서 16:10을 잘라(위를 조금 더 잘라 차와 수평선을 가운데로) 1280×800·720×450 webp로(색 손실 압축, 품질 84)
    const { execFileSync } = require('node:child_process');
    const py = `from PIL import Image\nim=Image.open(r'${path.join(SHOTS, 'hero-capture.png')}').convert('RGB')\n` +
      `w,h=im.size\nch=round(w/1.6)\ny0=round((h-ch)*.58)\nim=im.crop((0,y0,w,y0+ch))\n` +
      `im.resize((1280,800),Image.LANCZOS).save(r'${path.join(ROOT, 'assets', 'lobby-coast.webp')}','WEBP',quality=84,method=6)\n` +
      `im.resize((720,450),Image.LANCZOS).save(r'${path.join(ROOT, 'assets', 'lobby-coast-720.webp')}','WEBP',quality=82,method=6)\nprint('ok')`;
    console.log(execFileSync('python', ['-c', py]).toString());
  }
})();
