// 선배 소개 시안을 저절로 돌려 휴대폰 화면만 차례로 찍는다(11-17). 내 눈으로 먼저 보고, 낯선 시험관에게 보일 띠를 만든다.
//   node 찍기.cjs [b-yuna] [b-taeo] [a-yuna] [a-taeo]   → 공용 작업본 .tmp/senior-intro/찍기/<이름>/NN.jpg · 띠.jpg
// 0.6초마다 찍고, 앞 장과 달라진 장만 남긴다. 소리는 끄고 돌린다(목소리 길이만큼은 그대로 기다린다).
const path = require('node:path'), fs = require('node:fs'), { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const { chromium } = require(path.join(뿌리, 'node_modules', 'playwright'));
const 공용 = 공용작업본(뿌리);
const 시안 = path.join(공용, '.tmp', 'senior-intro', '시안', 'index.html');
const 밖 = path.join(공용, '.tmp', 'senior-intro', '찍기');
const 판 = {
  'b-yuna': { 꼬리: '?auto=yuna&order=ty&mute=1', 초: 64 },
  'b-taeo': { 꼬리: '?auto=taeo&order=yt&mute=1', 초: 66 },
  'a-yuna': { 꼬리: '?v=a&auto=yuna&order=ty&mute=1', 초: 15 },
  'a-taeo': { 꼬리: '?v=a&auto=taeo&order=yt&mute=1', 초: 15 },
};
(async () => {
  const 고른 = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(판);
  const b = await chromium.launch({ channel: 'chrome' });
  for (const 이름 of 고른) {
    const p = 판[이름]; if (!p) { console.error('모르는 판', 이름); continue; }
    const dir = path.join(밖, 이름); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(pathToFileURL(시안).href + p.꼬리);
    await page.evaluate(() => document.fonts.ready);
    const frame = page.locator('#frame');
    let 앞 = null, n = 0; const t0 = Date.now();
    while (Date.now() - t0 < p.초 * 1000) {
      const buf = await frame.screenshot({ type: 'jpeg', quality: 86 });
      // 달라진 장만 남긴다 — 파일 크기와 바이트 표본으로 거칠게 견준다
      let 다름 = !앞 || Math.abs(buf.length - 앞.length) > 앞.length * 0.012;
      if (!다름) { let d = 0; for (let i = 2000; i < Math.min(buf.length, 앞.length); i += 97) if (buf[i] !== 앞[i]) d++; 다름 = d > Math.min(buf.length, 앞.length) / 97 * 0.55; }
      if (다름) { n += 1; fs.writeFileSync(path.join(dir, `${String(n).padStart(2, '0')}_${((Date.now() - t0) / 1000).toFixed(1)}s.jpg`), buf); 앞 = buf; }
      await page.waitForTimeout(600);
    }
    await ctx.close();
    const 장 = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
    console.log(이름, '남긴 장', 장.length, '오류', errs.length ? errs.slice(0, 3) : '없음');
  }
  await b.close();
})();
