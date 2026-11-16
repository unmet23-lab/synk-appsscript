'use strict';
// 시안의 구(점 눈)를 아이콘 크기마다 그려 투명 바탕 PNG로 낸다.
// 쓰는 법: node docs/디자인/플랫폼_클라이언트_검정구_20261116/아이콘만들기.cjs [나갈 폴더]
// 나갈 폴더를 주지 않으면 이 폴더의 「아이콘」에 낸다. 서버 없이 시안 파일을 바로 연다. .ico와 .icns로 묶는 일은 PC 앱의 도구가 한다.
//
// 눈의 모습은 크기에 따라 둘이다.
// - 256까지는 둥근 점 둘이다. 점 묶음은 이 크기에서 점이 풀리지 않거나, 운영체제가 줄여 쓸 때 흐려져 눈이 사라진다.
// - 512와 1024는 점 묶음이다(앱 안의 큰 구와 같은 얼굴).
// - 「synk-1024-둥근점.png」는 줄여 쓰이는 원본(앱 창 아이콘처럼 1024 한 장을 운영체제가 줄이는 곳)에 쓴다.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(__dirname, '../../../node_modules/playwright'));

// tiny는 시안의 「작은 구의 눈」을 크기와 상관없이 고르는 값이다. 0.73은 64 크기에서 저절로 나오는 눈의 비율이다.
const ROUND = 0.73;
const JOBS = [
  ...[16, 20, 24, 32, 40, 48, 64].map(s => ({ s, tiny: 0, name: 'synk-' + s })),
  ...[128, 256].map(s => ({ s, tiny: ROUND, name: 'synk-' + s })),
  ...[512, 1024].map(s => ({ s, tiny: 0, name: 'synk-' + s })),
  { s: 1024, tiny: ROUND, name: 'synk-1024-둥근점' },
];
const out = path.resolve(process.argv[2] || path.join(__dirname, '아이콘'));
// 작은 크기는 테두리 1px만 남기고 꽉 채우고, 큰 크기는 둘레에 숨을 조금 둔다
const radius = s => s / 2 - (s <= 32 ? 1 : s * 0.035);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(pathToFileURL(path.join(__dirname, '검정구.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__orb);
  await page.evaluate(() => { document.getElementById('meta').style.visibility = 'hidden'; });
  for (const { s, tiny, name } of JOBS) {
    const r = radius(s);
    await page.evaluate(o => { window.__orb.at('rest', { eye: 'dot', r: o.r, tiny: o.tiny }); }, { r, tiny });
    await page.waitForTimeout(150);
    const shot = await page.screenshot({ clip: { x: 550 - s / 2, y: 550 - s / 2, width: s, height: s } });
    // 구 밖을 투명하게 오린다(가장자리는 부드럽게)
    const png = await page.evaluate(async ({ b64, s, r }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
      g.drawImage(img, 0, 0); g.globalCompositeOperation = 'destination-in';
      g.beginPath(); g.arc(s / 2, s / 2, r + 0.9, 0, Math.PI * 2); g.fill();
      return c.toDataURL('image/png').split(',')[1];
    }, { b64: shot.toString('base64'), s, r });
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(png, 'base64'));
  }
  await browser.close();
  if (errs.length) { console.error('시안에서 오류가 났다: ' + errs.join(' / ')); process.exit(1); }
  console.log('아이콘 그림 ' + JOBS.length + '장을 냈다: ' + out);
})();
