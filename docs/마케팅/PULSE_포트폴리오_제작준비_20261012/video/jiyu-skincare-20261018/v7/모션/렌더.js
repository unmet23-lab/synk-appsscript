// 맑음 모션그래픽 층을 프레임마다 찍는다(2026-10-21, 한강 재촬영 v40 타이틀/렌더.js를 본뜸).
//   node 렌더.js <큐.json> <출력 폴더> [--초 15] [--보기 0.6,2.0,13.2 --bg <바탕 그림>]
//   → <출력 폴더>/%04d.png (투명 바탕 1080×1920 · 24fps) — 편집에서 화면 위에 얹는다
//   --보기: 그 시각들만 바탕 그림 위에 찍어 한 장(_보기.jpg)으로 모은다(모양 확인용, 프레임은 안 찍음)
//   --서체 <시안>: 모션.html의 서체 시안(명조 · 고딕 · 섞음)으로 찍는다(없으면 지금 판 SUIT, 10-22)
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

let root = __dirname;  // 저장소 뿌리(node_modules/playwright가 있는 곳)
while (!fs.existsSync(path.join(root, 'node_modules', 'playwright'))) {
  const up = path.dirname(root);
  if (up === root) throw new Error('node_modules/playwright를 못 찾았다');
  root = up;
}
const { chromium } = require(path.join(root, 'node_modules', 'playwright'));

const args = process.argv.slice(2);
const [cueFile, outDir] = args;
if (!cueFile || !outDir) { console.error('사용: node 렌더.js <큐.json> <출력 폴더> [--초 15] [--보기 시각,… --bg 그림]'); process.exit(2); }
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DUR = Number(opt('--초') || 15);
const FPS = 24;
const cues = JSON.parse(fs.readFileSync(cueFile, 'utf8'));
const html = path.join(__dirname, '모션.html');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.addInitScript(d => { window.M_CUES = d; }, cues);
  if (opt('--서체')) await page.addInitScript(d => { window.M_TYPE = d; }, opt('--서체'));
  page.on('console', m => { if (m.type() === 'error') console.log('페이지 오류:', m.text()); });
  const look = opt('--보기');
  const bg = opt('--bg');
  await page.goto(pathToFileURL(html).href + (bg ? `?bg=${encodeURIComponent(pathToFileURL(path.resolve(bg)).href)}` : ''));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  if (look) {
    const times = look.split(',').map(Number);
    const shots = [];
    for (const t of times) {
      await page.evaluate(x => window.seek(x), t);
      const p = path.join(outDir, `_보기_${String(t).replace('.', '_')}.png`);
      await page.screenshot({ path: p, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
      shots.push(p);
    }
    // 시각마다 찍은 판을 가로 한 줄로(높이 960)
    const sheet = path.join(outDir, '_보기.jpg');
    const inputs = shots.flatMap(s => ['-i', s]);
    const filt = shots.map((_, i) => `[${i}:v]scale=540:960[s${i}]`).join(';') + ';' + shots.map((_, i) => `[s${i}]`).join('') + `hstack=inputs=${shots.length}[v]`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filt, '-map', '[v]', '-q:v', '3', sheet]);
    console.log(sheet);
  } else {
    const n = Math.round(DUR * FPS);
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate(x => window.seek(x), i / FPS);
      await page.screenshot({ path: path.join(outDir, String(i).padStart(4, '0') + '.png'), omitBackground: true, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    }
    console.log(`${n}장 · ${((Date.now() - t0) / 1000).toFixed(0)}초 → ${outDir}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
