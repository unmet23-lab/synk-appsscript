// 「내 PC 이사 목록」 실제 화면을 휴대폰 크기(390×844, 배율 3 = 1170×2532)로 찍어 영상 폴더에 webp로 둔다.
// 영상: docs/마케팅/yuhobuilds_노트북이사_20261017/ (끝 장면 「같은 PDF → 서로 다른 결과」). 화면을 다시 그리거나 꾸미지 않는다.
// 배포 전이라 로컬 미리보기(node docs/마케팅/맞춤도구/serve.mjs, http://127.0.0.1:4391)를 찍는다. 배포 뒤에는 BASE=https://synk.im.
// 본보기: docs/마케팅/yuhobuilds_한줄시켰더니_20261003/녹화_도구화면.cjs
// 결과: assets/media/tool/*.webp, tool-results.json(세 사람 결과의 제목과 ①~④ 첫 줄 — 화면에 실제로 나온 글 그대로), 녹화기록.json
// 다시 찍기: node "docs/마케팅/맞춤도구/move/캡처_영상용.cjs"  (puppeteer-core 위치는 PUP 환경 변수로 바꿀 수 있다)
const path = require('path');
const fs = require('fs');
const os = require('os');

const PUP = process.env.PUP || (() => {
  const root = path.join(os.homedir(), 'AppData/Local/npm-cache/_npx');
  for (const d of fs.existsSync(root) ? fs.readdirSync(root) : []) { const p = path.join(root, d, 'node_modules/puppeteer-core'); if (fs.existsSync(p)) return p; }
  return 'puppeteer-core';
})();
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:4391';
const OUT = path.join(__dirname, '../../yuhobuilds_노트북이사_20261017/assets/media/tool');
// 영상의 세 사람(기획.md · 유호님 요청 10-17)
const PEOPLE = [
  { name: '가', who: 'AI 앱·코딩 도구', answers: { how: 'cloud', uses: ['ai', 'code'], old: 'keep2w' }, note: '클라우드 · AI 앱+코딩 도구 · 2주 보관' },
  { name: '나', who: '영상·디자인·사진', answers: { how: 'ssd', uses: ['creative', 'media'], old: 'sell' }, note: '외장 SSD · 영상·디자인+사진·영상 파일 많음 · 바로 판매' },
  { name: '다', who: '문서·웹', answers: { how: 'unsure', uses: ['docs'], old: 'keep' }, note: '아직 모름 · 문서·웹 위주 · 계속 씀' },
];
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const puppeteer = require(PUP);
  const sharp = require(path.join(__dirname, '../../../../desktop/node_modules/sharp'));
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-move-rec-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--lang=ko-KR', '--hide-scrollbars', '--force-color-profile=srgb'] });
  const log = { url: `${BASE}/builds/move/`, recordedAt: new Date().toISOString(), viewport: '390x844@3', shots: [], errors: [] };
  const results = { tool: '내 PC 이사 목록', url: 'https://synk.im/builds/move/', recordedAt: log.recordedAt, source: `${BASE}/builds/move/ (로컬 미리보기, 빌드 dist/builds/move)`, people: [] };
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => log.errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text()); });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const tap = async sel => { await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.click(sel); await wait(220); };
    const top = async () => { await page.evaluate(() => window.scrollTo(0, 0)); await wait(250); };
    const shot = async (id, note) => {
      await page.evaluate(() => document.fonts.ready);
      await wait(150);
      const png = await page.screenshot({ type: 'png' });
      const file = path.join(OUT, `${id}.webp`);
      await sharp(png).webp({ quality: 90 }).toFile(file);
      const state = await page.evaluate(() => ({ path: location.pathname + location.hash.slice(0, 12), heading: ((document.querySelector('#q') || {}).textContent || '').trim(), scrollY: Math.round(window.scrollY), overflowX: document.documentElement.scrollWidth - window.innerWidth }));
      log.shots.push({ id, note, file: path.relative(path.join(__dirname, '../../'), file).replace(/\\/g, '/'), ...state });
      console.log(id, JSON.stringify(state));
    };
    const fresh = async () => {
      await page.goto(`${BASE}/builds/move/`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
      await page.goto(`${BASE}/builds/move/`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForSelector('[data-action="begin"]');
    };
    const answer = async a => {
      await tap('[data-action="begin"]');
      await tap(`[data-opt="${a.how}"]`); await tap('[data-action="next"]');
      for (const u of a.uses) await tap(`[data-opt="${u}"]`);
      await tap('[data-action="next"]');
      await tap(`[data-opt="${a.old}"]`); await tap('[data-action="next"]');
      await page.waitForSelector('.r-top');
      await wait(300);
    };

    // 첫 화면과 질문 셋(가의 답을 고른 상태 — 고른 뒤 한 줄이 보인다)
    await fresh();
    await shot('01_start', '첫 화면');
    await tap('[data-action="begin"]'); await top();
    await shot('02_q1', '질문 1 · 어떻게 옮기나요(고르기 전)');
    await tap(`[data-opt="${PEOPLE[0].answers.how}"]`); await top();
    await shot('02_q1_picked', '질문 1 · 클라우드를 고른 뒤');
    await tap('[data-action="next"]');
    for (const u of PEOPLE[0].answers.uses) await tap(`[data-opt="${u}"]`);
    await top();
    await shot('03_q2', '질문 2 · 이 컴퓨터로 하는 일(AI 앱 + 코딩 도구)');
    await tap('[data-action="next"]');
    await tap(`[data-opt="${PEOPLE[0].answers.old}"]`); await top();
    await shot('04_q3', '질문 3 · 옛 컴퓨터(2주쯤 보관)');

    // 세 사람의 결과: 머리, ①~④가 시작하는 곳
    for (const [i, p] of PEOPLE.entries()) {
      await fresh();
      await answer(p.answers);
      await top();
      const tag = `0${5 + i}_result_${['ga', 'na', 'da'][i]}`;
      await shot(`${tag}_top`, `${p.name} · ${p.note} · 결과 머리`);
      // ① 절대 두고 가면 안 되는 것이 화면 위쪽에 오게
      await page.evaluate(() => { const h = [...document.querySelectorAll('section.block>h2')].find(x => x.textContent.includes('① 절대')); const y = h.getBoundingClientRect().top + window.scrollY - 84; window.scrollTo(0, y); });
      await wait(300);
      await shot(`${tag}_must`, `${p.name} · ① 절대 두고 가면 안 되는 것`);
      const read = await page.evaluate(() => {
        const h1 = document.querySelector('.r-top h1');
        const sec = label => { const h = [...document.querySelectorAll('section.block>h2')].find(x => x.textContent.includes(label)); const b = h && h.parentElement.querySelector('ul.checks li b'); return b ? [...b.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('src'))).map(n => n.textContent).join('').trim() : null; };
        return {
          title: h1 ? h1.innerText.replace(/\n+/g, ' ').trim() : null,
          titleLines: h1 ? h1.innerText.split('\n').map(s => s.trim()).filter(Boolean) : [],
          sub: (document.querySelector('.r-top > p:not(.rec)') || {}).textContent || null,
          first: { '①': sec('① 절대'), '②': sec('② 두고'), '③': sec('③ 옮긴'), '④': sec('④ 끝났는지') },
          art: ((document.querySelector('.r-top .shot img') || {}).getAttribute ? document.querySelector('.r-top .shot img').getAttribute('src') : null),
        };
      });
      results.people.push({ name: p.name, who: p.who, answers: p.answers, note: p.note, ...read, shots: [`${tag}_top.webp`, `${tag}_must.webp`] });
    }
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(OUT, 'tool-results.json'), JSON.stringify(results, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, '녹화기록.json'), JSON.stringify(log, null, 2) + '\n');
  console.log('오류', log.errors.length, log.errors.slice(0, 5));
})().catch(e => { console.error(e); process.exit(1); });
