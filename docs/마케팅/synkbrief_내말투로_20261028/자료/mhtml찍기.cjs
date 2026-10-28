// 저장한 ChatGPT 대화(MHTML)를 휴대폰 폭으로 다시 그려 대화 부분만 찍는다 — 스크립트는 돌지 않고 저장된 DOM · CSS만 그린다
// 쓰는 법: node mhtml찍기.cjs <저장한.mhtml> <나갈.png> [폭=430] — 나온 그림의 아래 빈칸은 따로 잘라 낸다(10-28 Y19 시안).
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', 'playwright'));
const [,, 입력, 출력, 폭 = '430'] = process.argv;
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const w = Number(폭);
  const p = await b.newPage({ viewport: { width: w, height: 7000 }, deviceScaleFactor: 1080 / w });
  await p.goto('file:///' + 입력.replace(/\\/g, '/'), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  // 개인 것(왼쪽 목록 · 계정 이름)과 아래 입력칸은 가리고 대화만 남긴다
  const 정보 = await p.evaluate(() => {
    for (const s of ['nav', '[data-testid="left-sidebar"]', '#stage-slideover-sidebar', 'aside']) document.querySelectorAll(s).forEach(e => (e.style.display = 'none'));
    document.querySelectorAll('form, #thread-bottom-container, [data-testid="composer"]').forEach(e => (e.style.display = 'none'));
    for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/(auto|scroll|hidden)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) { e.style.overflow = 'visible'; e.style.height = 'auto'; e.style.maxHeight = 'none'; } }
    document.documentElement.style.height = 'auto'; document.body.style.height = 'auto';
    for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (cs.height && /^(100vh|100dvh)$/.test(e.style.height)) e.style.height = 'auto'; }
    const 대화 = document.querySelector('main') || document.body;
    return { 글: 대화.innerText.slice(0, 120), 높이: document.scrollingElement.scrollHeight };
  });
  console.log(JSON.stringify(정보));
  await p.screenshot({ path: 출력, fullPage: true });
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
