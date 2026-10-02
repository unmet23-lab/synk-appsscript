// 실제 「내 이름 한글로」(https://synk.im/name/) 화면을 휴대폰 크기로 한 장면씩 찍는다.
// 결과는 assets/media/tool/ 의 PNG(1170×2532)와 녹화기록.json. 다시 찍기: node 녹화_도구화면.cjs
// 영상 안의 도구 장면은 이 사진들을 그대로 순서대로 보여 준다(화면을 다시 그리거나 꾸미지 않는다).
const path = require('path');
const fs = require('fs');

const PUP = 'C:/Users/q1212/AppData/Local/npm-cache/_npx/37e4d3eba3b975f7/node_modules/puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'https://synk.im/name/';
const NAME = 'Хулан';
const OUT = path.join(__dirname, 'assets', 'media', 'tool');

(async () => {
  const puppeteer = require(PUP);
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'synk-name-rec-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profile,
    args: ['--lang=mn-MN', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const log = { url: URL, name: NAME, recordedAt: new Date().toISOString(), viewport: '390x844@3', shots: [] };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 600));
    const shot = async (id, note) => {
      const file = path.join(OUT, `${id}.png`);
      await page.screenshot({ path: file });
      const state = await page.evaluate(() => {
        // 화면 안 위치(사진 픽셀 = CSS 픽셀 × 3). 영상에서 이 자리를 잘라 보여 준다
        const box = (id) => {
          const el = document.getElementById(id);
          if (!el || el.hidden) return null;
          const r = el.getBoundingClientRect();
          return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 3));
        };
        return {
          lang: document.body.getAttribute('data-lang'),
          input: document.getElementById('src').value,
          result: document.getElementById('out').hidden ? '' : document.getElementById('outk').textContent,
          alt: document.getElementById('alt').hidden ? '' : document.getElementById('alt').textContent.replace(/\s+/g, ' ').trim(),
          card: !document.getElementById('card').hidden,
          scrollY: window.scrollY,
          rect: { src: box('src'), outk: box('outk'), alt: box('alt'), card: box('card') },
        };
      });
      log.shots.push({ id, note, ...state });
      console.log(id, JSON.stringify(state));
    };

    await shot('00_start', '처음 화면(몽골어)');
    await page.focus('#src');
    await new Promise((r) => setTimeout(r, 300));
    await shot('01_focus', '입력칸 누름');
    let i = 0;
    for (const ch of NAME) {
      i += 1;
      await page.keyboard.type(ch);
      await new Promise((r) => setTimeout(r, 160));
      await shot(`0${i + 1}_type${i}`, `「${NAME.slice(0, i)}」까지 입력`);
    }
    // 펠트 카드: 입력 0.35초 뒤에 그린다. 그림 불러오기까지 넉넉히 기다린다
    await new Promise((r) => setTimeout(r, 1800));
    await shot('08_card', '펠트 카드까지 나온 화면');
    // 카드가 보이도록 아래로(같은 화면을 스크롤만)
    const cardTop = await page.evaluate(() => {
      const el = document.getElementById('card');
      return el && !el.hidden ? el.getBoundingClientRect().top + window.scrollY : null;
    });
    if (cardTop != null) {
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 120)), cardTop);
      await new Promise((r) => setTimeout(r, 500));
      await shot('09_card_scrolled', '펠트 카드가 보이게 스크롤');
    }
    await page.screenshot({ path: path.join(OUT, 'zz_fullpage.png'), fullPage: true });
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, '녹화기록.json'), JSON.stringify(log, null, 2));
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
})().catch((e) => { console.error(e); process.exit(1); });
