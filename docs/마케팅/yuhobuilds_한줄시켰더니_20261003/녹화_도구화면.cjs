// 실제 「AI 직원 매뉴얼 만들기」(synk.im/builds/ → /builds/manual/) 화면을 휴대폰 크기로 한 장면씩 찍는다.
// 배포 전이라 로컬 미리보기(docs/마케팅/맞춤도구/serve.mjs, http://127.0.0.1:4391)를 찍는다. 배포 뒤에는 BASE만 https://synk.im 으로 바꾼다.
// 결과는 assets/media/tool/ 의 PNG(390×844 배율 3 = 1170×2532)와 녹화기록.json. 다시 찍기: node 녹화_도구화면.cjs
// 영상(index.html)이 쓰는 것은 01_start.webp 하나다(끝 화면). PNG에서 폭 880 webp로 줄여 쓴다.
// 예시 답은 영상 실화와 같다: SNS 게시물 / 올리기 직전까지 / 사실·숫자·외국어 뜻·링크 / 다섯 개 모두 / Claude.
// 영상 안의 도구 장면은 이 사진들을 그대로 보여 준다(화면을 다시 그리거나 꾸미지 않는다).
const path = require('path');
const fs = require('fs');
const os = require('os');

const PUP = 'C:/Users/q1212/AppData/Local/npm-cache/_npx/37e4d3eba3b975f7/node_modules/puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:4391';
const OUT = path.join(__dirname, 'assets', 'media', 'tool');
const ANSWERS = { task: 'sns', finish: 'ready', checks: ['facts', 'lang', 'links'], stops: ['spend', 'account', 'publish', 'delete', 'mywords'], ai: 'claude' };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const puppeteer = require(PUP);
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-manual-rec-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--lang=ko-KR', '--hide-scrollbars', '--force-color-profile=srgb'] });
  const log = { url: `${BASE}/builds/`, answers: ANSWERS, recordedAt: new Date().toISOString(), viewport: '390x844@3', shots: [] };
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    // synk.im/builds/ 로 들어와 도구로 넘어가는지부터 본다.
    await page.goto(`${BASE}/builds/`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('[data-action="begin"]');
    await page.evaluate(() => document.fonts.ready);
    await wait(500);
    const tap = async sel => { await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.click(sel); await wait(250); };
    const top = async () => { await page.evaluate(() => window.scrollTo(0, 0)); await wait(250); };
    const shot = async (id, note) => {
      const file = path.join(OUT, `${id}.png`);
      await page.screenshot({ path: file });
      const state = await page.evaluate(() => {
        const box = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 3)); };
        return { path: location.pathname, heading: (document.querySelector('#q') || {}).textContent || '', scrollY: Math.round(window.scrollY), overflowX: document.documentElement.scrollWidth - window.innerWidth,
          rect: { heading: box('#q'), tip: box('.tip'), picked: box('.picked:not([hidden])'), manual: box('.copybox.main'), resultTop: box('.r-top') } };
      });
      log.shots.push({ id, note, ...state });
      console.log(id, JSON.stringify(state));
    };

    await shot('01_start', '첫 화면(synk.im/builds/에서 넘어옴)');
    await tap('[data-action="begin"]');
    await top();
    await shot('02_q1', '첫 질문(맡길 일)');
    await tap(`[data-opt="${ANSWERS.task}"]`);
    // 고른 뒤 한 줄과 ‘왜 묻는지’ 팁이 함께 보이게 내린다.
    await page.evaluate(() => { const p = document.querySelector('.picked'); const y = p.getBoundingClientRect().top + window.scrollY - 150; window.scrollTo(0, Math.max(0, y)); });
    await wait(300);
    await shot('02_q1_tip', '첫 질문에서 SNS 게시물을 고른 뒤 한 줄과 팁');
    await tap('[data-action="next"]');
    await tap(`[data-opt="${ANSWERS.finish}"]`);
    await tap('[data-action="next"]');
    for (const id of ANSWERS.checks) await tap(`[data-opt="${id}"]`);
    await tap('[data-action="next"]');
    await top();
    await shot('03_q4', '질문 4: 추천대로 다섯 개가 체크된 상태');
    await tap('[data-action="next"]');
    await tap(`[data-opt="${ANSWERS.ai}"]`);
    await tap('[data-action="next"]');
    await page.waitForSelector('.r-top');
    await wait(400);
    await top();
    await shot('04_result_top', '결과 머리');
    // 10-06 밤 v4: 결과 머리 아래가 ‘01 써 보기’(가게 정보 → 쓰는 방법 둘 → 단계마다 단추)다. 매뉴얼 전문은 접혀 있다.
    await page.evaluate(() => { const el = document.querySelector('.pathseg'); const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.top + window.scrollY - 110)); });
    await wait(400);
    await shot('05_result_use', '01 써 보기: 쓰는 방법 탭과 바로 써 보기 첫 단계');
    await page.evaluate(() => { const d = document.querySelector('.peek'); if (d) d.open = true; const el = document.querySelector('.copybox.main'); const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.top + window.scrollY - (window.innerHeight - r.height) / 2)); });
    await wait(400);
    // 덤: 매뉴얼 창 안을 ‘끝내기 전 검수’부터 보이게 내린 장면
    // 줄바꿈까지 같은 그림자 상자로 ‘[끝내기 전 검수]’의 실제 높이를 잰다.
    await page.evaluate(() => {
      const t = document.querySelector('#t-manual');
      const cs = getComputedStyle(t);
      const div = document.createElement('div');
      for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'wordBreak', 'overflowWrap', 'tabSize']) div.style[p] = cs[p];
      Object.assign(div.style, { position: 'absolute', left: '-9999px', top: '0', visibility: 'hidden', boxSizing: 'border-box', width: `${t.clientWidth}px`, whiteSpace: 'pre-wrap' });
      div.textContent = t.value.slice(0, t.value.indexOf('[끝내기 전 검수]'));
      const mark = document.createElement('span'); mark.textContent = '['; div.appendChild(mark);
      document.body.appendChild(div);
      t.scrollTop = Math.max(0, mark.offsetTop - parseFloat(cs.paddingTop));
      div.remove();
    });
    await wait(300);
    await shot('06_result_manual_rules', '매뉴얼 창 안: 끝내기 전 검수와 사람 차례');
    await page.screenshot({ path: path.join(OUT, 'zz_fullpage.png'), fullPage: true });
    log.errors = errors;
    log.answersSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.tool.builds.manual') || 'null'));
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, '녹화기록.json'), JSON.stringify(log, null, 2));
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error(e); process.exit(1); });
