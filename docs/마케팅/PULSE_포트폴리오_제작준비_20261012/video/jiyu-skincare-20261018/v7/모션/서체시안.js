// 맑음 모션그래픽 · 서체 시안 비교(2026-10-22, 유호님 「폰트나 모델얼굴같은게 좀 많이 부족해보이는데」 → 「웅 폰트 시안부터 만들어줘」).
//   node 서체시안.js <큐.json> <출력 폴더> <시안,…> <시각=바탕 그림> …
//   예: node 서체시안.js 큐_가편집.json <폴더> 기본,명조,고딕,섞음 2.3=K2.png 3.9=P3_0022.png 13.6=P9_0038.png
//   → <폴더>/<시안>_<시각>.png(1080×1920, 바탕 위 글자 층), <폴더>/_서체시안_<시각>.jpg(칸 = 시안, 왼쪽 위에 이름)
// 바탕은 글자가 없는 그 장면의 원본 프레임(블렌더 프레임 · 사람 정지컷)을 준다 — 가편집 영상의 프레임엔 지금 글자가 이미 박혀 있다.
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

const [cueFile, outDir, typeList, ...sceneArgs] = process.argv.slice(2);
if (!cueFile || !outDir || !typeList || !sceneArgs.length) {
  console.error('사용: node 서체시안.js <큐.json> <출력 폴더> <시안,…> <시각=바탕 그림> …');
  process.exit(2);
}
const cues = JSON.parse(fs.readFileSync(cueFile, 'utf8'));
const types = typeList.split(',');
const scenes = sceneArgs.map(s => { const i = s.indexOf('='); return { t: Number(s.slice(0, i)), bg: path.resolve(s.slice(i + 1)) }; });
const html = pathToFileURL(path.join(__dirname, '모션.html')).href;
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
  const shots = {};
  for (const ty of types) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await page.addInitScript(d => { window.M_CUES = d; }, cues);
    page.on('console', m => { if (m.type() === 'error') console.log('페이지 오류:', m.text()); });
    await page.goto(ty === '기본' ? html : `${html}?type=${encodeURIComponent(ty)}`);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
    for (const { t, bg } of scenes) {
      await page.evaluate(async ({ src, name }) => {
        const img = document.getElementById('bg');
        img.src = src;
        img.style.display = 'block';
        await img.decode();
        let tag = document.getElementById('시안이름');
        if (!tag) {
          tag = document.createElement('div');
          tag.id = '시안이름';
          Object.assign(tag.style, { position: 'absolute', left: '24px', top: '24px', padding: '6px 16px', borderRadius: '8px', zIndex: 9,
            background: 'rgba(20,20,20,0.78)', color: '#fff', font: "500 34px 'SUIT'" });
          document.getElementById('stage').appendChild(tag);
        }
        tag.textContent = name;
      }, { src: pathToFileURL(bg).href, name: ty === '기본' ? '지금(SUIT)' : ty });
      await page.evaluate(x => window.seek(x), t);
      const p = path.join(outDir, `${ty}_${String(t).replace('.', '_')}.png`);
      await page.screenshot({ path: p, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
      (shots[t] = shots[t] || []).push(p);
    }
    await page.close();
  }
  await browser.close();
  // 장면마다 시안을 가로 한 줄로(칸 540×960)
  for (const { t } of scenes) {
    const ps = shots[t];
    const sheet = path.join(outDir, `_서체시안_${String(t).replace('.', '_')}.jpg`);
    const filt = ps.map((_, i) => `[${i}:v]scale=540:960,pad=548:960:0:0:0x121212[s${i}]`).join(';') + ';' +
      ps.map((_, i) => `[s${i}]`).join('') + `hstack=inputs=${ps.length}[v]`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...ps.flatMap(s => ['-i', s]), '-filter_complex', filt, '-map', '[v]', '-q:v', '2', sheet]);
    console.log(sheet);
  }
})().catch(e => { console.error(e); process.exit(1); });
