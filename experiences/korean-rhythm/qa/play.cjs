'use strict';
// 말의 리듬 한 곡을 처음부터 결과까지 실제 화면으로 친다(헤드리스 크롬, 진짜 음원·내레이션·캔버스).
// 기다림만 줄인다: ?qa 훅(window.__rhythm)으로 노트를 자동으로 치고(실제 입력 함수로, 판정은 그대로), 문제마다 맞게/틀리게 답하고,
// 문제 사이의 긴 박자 구간과 문장을 다 들은 뒤의 생각할 시간을 건너뛴다(music.seek). 문장 자체는 끝까지 듣는다(학습 기록의 ‘끝까지 들음’).
// 순서: 입구(코인 줄·차고 링크) → 무대 열기 → 박자 몇 개 → 멈춤·이어 하기 → 문제 1 맞힘 → 문제 2 틀림 → 문제 3 글로 보기 + 맞힘
// → 문제 4·5 맞힘 → 곡 끝(자연스러운 끝) → 결과(공통 코인 +N · 보유 N, 문장 목록, 듣기 기록, 새 문장 확인) → 처음으로(잔액).
// 확인: 게임 화면에서 페이지 스크롤 없음, 가로 넘침·확대 없음(scrollWidth ≤ innerWidth, innerWidth ≤ visualViewport.width),
// O·X 단추와 HUD가 화면 안, 캔버스가 실제로 그려짐(빈 픽셀이 아님), 콘솔 오류 0. 프레임 시각에 기대지 않게 상태를 기다려서 본다.
// 쓰는 법: experiences 폴더를 정적 서버로 띄운 뒤(예: 5261)  node experiences/korean-rhythm/qa/play.cjs [desktop|phone|small|reduced]
//   주소는 RHYTHM_URL(기본 http://127.0.0.1:5261/korean-rhythm/)
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.RHYTHM_URL || 'http://127.0.0.1:5261/korean-rhythm/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, ...PHONE },
  small: { viewport: { width: 320, height: 568 }, ...PHONE },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 문제 다섯: 맞힘 · 틀림 · 글로 보고 맞힘 · 맞힘 · 맞힘 → 맞힌 문장 4 / 5, 혼자 해낸 응답 4(글로 본 문제는 도움 받은 답)
const PLAN = ['right', 'wrong', 'right', 'right', 'right'];
const TEXT_AT = 2;
const EXPECT = { correct: 4, total: 5, independent: 4, coins: 15 + Math.round((10 * 4) / 5) };   // 완주 15 + 정답 비율 × 10

async function run(browser, name, view) {
  const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = [], shots = [], notes = [], fails = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (label, opts = {}) => { const f = `play_${name}_${String(shots.length).padStart(2, '0')}_${label}.png`; await page.screenshot({ path: path.join(OUT, f), ...opts }); shots.push(f); };
  const S = () => page.evaluate(() => window.__rhythm.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  async function waitFor(pred, what, { timeout = 30000, every = 40 } = {}) {
    const t0 = Date.now(); let s = null;
    while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(every); }
    throw new Error(`${name}: 기다림 초과 — ${what} ${JSON.stringify(s && { screen: s.screen, time: s.time, phase: s.phase, loading: s.loading, paused: s.paused })}`);
  }
  const visible = (sel) => page.evaluate((q) => { const n = document.querySelector(q); return !!n && !n.hidden && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none'; }, sel);
  // 넘침·스크롤·화면 밖: 게임 화면은 한 화면에 고정(스크롤 없음)
  async function fit(label, panels = [], { noScroll = false } = {}) {
    const r = await page.evaluate(({ sels, noScroll }) => {
      const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight, de = document.documentElement;
      const outOf = sels.flatMap((q) => [...document.querySelectorAll(q)]).filter((n) => !n.hidden && n.getBoundingClientRect().height > 0).map((n) => {
        const b = n.getBoundingClientRect();
        return b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1 ? `${n.id || n.className} ${Math.round(b.left)},${Math.round(b.top)}~${Math.round(b.right)},${Math.round(b.bottom)} (화면 ${Math.round(vw)}×${Math.round(vh)})` : null;
      }).filter(Boolean);
      return { zoomed: innerWidth > vw + 1, wide: de.scrollWidth > innerWidth + 1, scroll: noScroll ? de.scrollHeight > innerHeight + 1 || scrollY > 0 : false, outOf, sw: de.scrollWidth, sh: de.scrollHeight, iw: innerWidth, ih: innerHeight };
    }, { sels: panels, noScroll });
    check(!r.zoomed && !r.wide, `${label}: 가로 넘침/확대 ${JSON.stringify(r)}`);
    check(!r.scroll, `${label}: 게임 화면이 스크롤됨 ${JSON.stringify(r)}`);
    check(!r.outOf.length, `${label}: 화면 밖 ${r.outOf.join(' | ')}`);
  }
  // 캔버스가 실제로 그려졌는지: 격자로 픽셀을 읽어 불투명한 칸과 색의 가짓수를 센다(빈 캔버스·단색이면 실패)
  const painted = () => page.evaluate(() => {
    const cv = document.querySelector('#stage'), c = cv.getContext('2d'), W = cv.width, H = cv.height, seen = new Set(); let solid = 0, n = 0;
    for (let y = 4; y < H; y += Math.max(1, Math.floor(H / 40))) for (let x = 4; x < W; x += Math.max(1, Math.floor(W / 24))) {
      const d = c.getImageData(x, y, 1, 1).data; n += 1; if (d[3] > 200) solid += 1; seen.add(`${d[0] >> 4},${d[1] >> 4},${d[2] >> 4}`);
    }
    return { W, H, solid: solid / n, colors: seen.size };
  });
  const HUD = ['#game .hud .pill', '#pause-button', '#pad-0', '#pad-1'];

  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#start-button'); await sleep(900);
  // 판정 글자(.pop)가 보이는지: 페이지 안에서 떠 있는 동안 가장 진한 불투명도를 남긴다(움직임 줄이기에서도 보여야 한다)
  await page.evaluate(() => {
    window.__pops = [];
    for (const n of document.querySelectorAll('.pop')) new MutationObserver(() => {
      if (!n.classList.contains('go')) return;
      const rec = { text: n.textContent, max: 0 }, t0 = performance.now(); window.__pops.push(rec);
      const f = () => { rec.max = Math.max(rec.max, +getComputedStyle(n).opacity); if (performance.now() - t0 < 700 && !n.hidden) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }).observe(n, { attributes: true, attributeFilter: ['class'] });
  });
  await fit('입구', ['#start-button']);
  await shot('lobby');
  const coin0 = await page.evaluate(() => { const line = document.querySelector('#lobby .synk-collection-line'); return { shown: !!line && !line.hidden && line.getBoundingClientRect().height > 0,
    text: line?.querySelector('[data-collection-balance]')?.textContent, href: line?.querySelector('[data-collection-garage]')?.getAttribute('href'), want: window.SynkPlayCollection?.garageHref }; });
  check(coin0.shown && coin0.text === '보유 0코인', `입구의 공통 코인 줄 ${JSON.stringify(coin0)}`);
  check(coin0.href === coin0.want, `차고 링크 ${coin0.href} ≠ ${coin0.want}`);
  const tiles = await page.evaluate(() => [...document.querySelectorAll('#track-grid .song')].map((b) => ({ title: b.querySelector('.song-title')?.textContent, pressed: b.getAttribute('aria-pressed') })));
  check(tiles.length === 3 && tiles.filter((t) => t.pressed === 'true').length === 1, `곡 타일 ${JSON.stringify(tiles)}`);
  notes.push(`곡 타일: ${tiles.map((t) => `${t.title}${t.pressed === 'true' ? '(고름)' : ''}`).join(' · ')}`);

  // 무대 열기
  await page.evaluate((plan) => { window.__rhythm.autoplay(true); window.__rhythm.plan(plan); }, PLAN);
  const t0 = Date.now();
  await page.click('#start-button');
  let s = await waitFor((x) => x.screen === 'game' && !x.loading && x.time > -2.5, '곡 시작', { timeout: 45000 });
  notes.push(`무대 열기 → 시작 카운트 ${((Date.now() - t0) / 1000).toFixed(1)}초(음원·문장 받기 포함)`);
  check(await visible('#countdown') || s.time >= 0, '시작 전 네 박자 셈이 보이지 않음');
  await waitFor((x) => x.time > 3.5 && x.hits >= 3, '첫 노트들을 침', { timeout: 30000 });
  await fit('게임(박자)', HUD, { noScroll: true });
  const px = await painted();
  check(px.solid > 0.9 && px.colors > 30, `캔버스가 그려지지 않음 ${JSON.stringify(px)}`);
  notes.push(`캔버스 ${px.W}×${px.H} 불투명 ${(px.solid * 100).toFixed(0)}% · 색 ${px.colors}가지`);
  await shot('playing');

  // 멈춤 → 시간이 멈춘다 → 이어 하기
  await page.click('#pause-button');
  await page.waitForFunction(() => document.querySelector('#pause-dialog').open, null, { timeout: 5000 });
  const p1 = (await S()).time; await sleep(600); const p2 = await S();
  check(p2.paused && Math.abs(p2.time - p1) < 0.05, `멈춘 동안 시간이 흐름 ${p1} → ${p2.time}`);
  await shot('pause');
  await page.click('#resume-button');
  await waitFor((x) => !x.paused, '이어 하기');
  check(!(await page.evaluate(() => document.querySelector('#pause-dialog').open)), '이어 한 뒤에도 멈춤 창이 열려 있음');

  // 문제 다섯
  for (let i = 0; i < PLAN.length; i += 1) {
    s = await S();
    const q = s.questions[i];
    if (s.time < q.showTime - 1.6) await page.evaluate((t) => window.__rhythm.seek(t), q.showTime - 1.1);
    await waitFor((x) => x.phase === 'listening', `${i + 1}번 문제 듣기`, { timeout: 20000 });
    check(!(await visible('#q-say')), `${i + 1}번: 글로 보기 전에는 문장이 보이면 안 됨`);
    if (i === TEXT_AT) {
      await sleep(400);
      await page.click('#q-text-btn');
      await sleep(150);
      const say = await page.evaluate(() => document.querySelector('#q-say').textContent);
      check(await visible('#q-say') && say.length > 8, `글로 보기: 문장이 나오지 않음 “${say}”`);
      check(!(await visible('#q-text-btn')), '글로 본 뒤에는 글로 보기 단추를 거둔다');
      check((await S()).questions[i].texted, '글로 보기가 도움으로 남지 않음');
      await fit('문제 카드(글로 보기)', ['#phrase-card', ...HUD], { noScroll: true });
      await shot('question_text');
    }
    // 문장을 끝까지 들은 뒤(끝까지 들음 기록), 생각할 시간만 건너뛴다
    s = await waitFor((x) => x.questions[i].delivered === 'completed', `${i + 1}번 문장을 끝까지 들음`, { timeout: 20000 });
    if (s.time < q.answerOpen - 0.8) await page.evaluate((t) => window.__rhythm.seek(t), q.answerOpen - 0.5);
    await waitFor((x) => x.phase === 'answer' || x.phase === 'answered', `${i + 1}번 답할 때`, { timeout: 12000 });
    if (i === 0) {
      await sleep(Math.max(0, (q.time - q.answerOpen) * 500));
      const ask = await page.evaluate(() => document.querySelector('#q-ask').textContent);
      check(ask.includes('맞으면 O'), `답할 때의 안내 “${ask}”`);
      await fit('문제 카드(답할 때)', ['#phrase-card', ...HUD], { noScroll: true });
      await shot('question');
    }
    s = await waitFor((x) => x.phase === 'answered' || x.questions[i].state !== 'pending', `${i + 1}번 답`, { timeout: 12000, every: 25 });
    const got = s.questions[i];
    check(got.state === 'answered' && got.correct === (PLAN[i] === 'right'), `${i + 1}번 답 ${JSON.stringify(got)}`);
    if (i === 1) {
      await sleep(120);
      const card = await page.evaluate(() => ({ ask: document.querySelector('#q-ask').textContent, result: document.querySelector('#phrase-card').dataset.result,
        right: [...document.querySelectorAll('.pad.right')].map((b) => b.id), redX: !!document.querySelector('.qcard .mark-x, .pad.wrong') }));
      check(card.result === 'ko' && card.ask === '다시 들어 봐요' && card.right.length === 1 && !card.redX, `틀림 표시 ${JSON.stringify(card)}`);
      await shot('wrong');
    }
  }

  // 곡 끝: 끝 바로 앞으로 건너뛰고 자연스럽게 끝나기를 기다린다(코인은 이때만)
  s = await S();
  await page.evaluate((t) => window.__rhythm.seek(t), s.duration - 2.5);
  await page.waitForFunction(() => window.__rhythm.state().screen === 'results', null, { timeout: 20000 });
  await page.waitForFunction(() => { const t = document.querySelector('#r-coins')?.textContent || ''; return t && !t.includes('모으고 있어요'); }, null, { timeout: 8000 }).catch(() => {});
  await sleep(1300);
  await fit('결과', ['#r-coins']);
  await shot('results'); await shot('results_full', { fullPage: true });
  const res = await page.evaluate(() => ({
    correct: +document.querySelector('#r-correct').textContent, total: +document.querySelector('#r-total').textContent, stars: document.querySelectorAll('#r-stars i.on').length,
    coins: document.querySelector('#r-coins').textContent, coinLine: !document.querySelector('#results .synk-collection-line').hidden,
    log: [...document.querySelectorAll('#review-list li')].map((li) => ({ cls: li.className, text: li.innerText.replace(/\s+/g, ' ') })),
    skills: [...document.querySelectorAll('#r-skills li')].map((li) => li.innerText.replace(/\s+/g, ' ')),
    note: document.querySelector('#result-learning-note').textContent, timing: document.querySelector('#result-timing').textContent,
    next: document.querySelector('#r-next-reason').textContent, wallet: JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'),
  }));
  check(res.correct === EXPECT.correct && res.total === EXPECT.total, `결과 맞힘 ${res.correct}/${res.total}`);
  check(res.coinLine && (res.coins === `공통 코인 +${EXPECT.coins} · 보유 ${EXPECT.coins}` || res.coins.includes('오늘의 완주 코인')), `결과의 공통 코인 “${res.coins}”`);
  const paid = Object.keys(res.wallet?.rewardedRounds || {});
  check(paid.length === 1 && paid[0].startsWith('rhythm:'), `공통 지갑 ${JSON.stringify({ coins: res.wallet?.coins, paid })}`);
  check(res.log.length === 5 && res.log.filter((l) => l.cls === 'ok').length === 4 && res.log.filter((l) => l.cls === 'ko').length === 1, `문장 목록 ${res.log.map((l) => l.cls).join(',')}`);
  check(res.log[TEXT_AT]?.text.includes('글로 봄'), `글로 본 문장 표시 ${res.log[TEXT_AT]?.text}`);
  check(res.note.includes(`새 응답 ${EXPECT.independent}개`), `학습 기록 문구 “${res.note}”`);
  notes.push(`결과: ${res.correct}/${res.total} · 별 ${res.stars} · ${res.coins}`);
  notes.push(`듣기 기록: ${res.skills.join(' / ')} · ${res.note}${res.timing ? ` · ${res.timing}` : ''}`);
  notes.push(`다음 곡: ${res.next}`);
  const pops = await page.evaluate(() => window.__pops);
  check(pops.length > 0 && pops.some((p) => p.max > 0.8), `판정 글자가 보이지 않음 ${JSON.stringify(pops.slice(0, 3))}`);
  notes.push(`판정 글자 ${pops.length}번(${[...new Set(pops.map((p) => p.text))].join('·')})`);

  // 결과에서 문장 다시 듣기 → 새 문장 확인(먼저 듣고 O·X)
  await page.click('#review-list li .say-again');
  await sleep(400);
  check(await page.evaluate(() => window.synkRhythm.audio()?.state === 'running'), '다시 듣기가 소리를 틀지 않음');
  await page.click('#recall-button');
  await page.waitForFunction(() => [...document.querySelectorAll('#recall-options .ox')].some((b) => !b.disabled), null, { timeout: 15000 });
  const before = await page.evaluate(() => document.querySelector('#recall-sentence').textContent);
  check(!before, `새 문장을 듣기 전에 글이 보임 “${before}”`);
  await page.click('#recall-options .ox.o');
  await sleep(200);
  const recall = await page.evaluate(() => ({ sentence: document.querySelector('#recall-sentence').textContent, feedback: document.querySelector('#recall-feedback').textContent, right: document.querySelectorAll('#recall-options .ox.right').length }));
  check(recall.sentence.length > 4 && recall.feedback && recall.right === 1, `새 문장 확인 ${JSON.stringify(recall)}`);
  notes.push(`새 문장 확인: ${recall.feedback}`);
  await shot('results_recall', { fullPage: true });

  // 처음으로 → 입구 잔액
  await page.click('#back-button');
  await page.waitForFunction(() => !document.querySelector('#lobby').hidden, null, { timeout: 5000 });
  await sleep(300);
  const bal = await page.evaluate(() => document.querySelector('#lobby [data-collection-balance]')?.textContent);
  check(bal === `보유 ${EXPECT.coins}코인` || res.coins.includes('오늘의 완주 코인'), `입구 코인 잔액 ${bal}`);
  await ctx.close();
  return { name, errors, fails, notes, shots };
}

(async () => {
  const pick = process.argv[2];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const all = [];
  for (const [name, view] of Object.entries(VIEWS)) {
    if (pick && pick !== name) continue;
    const t = Date.now();
    try { const r = await run(browser, name, view); r.sec = Math.round((Date.now() - t) / 1000); all.push(r); }
    catch (e) { all.push({ name, errors: [], fails: [String(e.message || e)], notes: [], shots: [] }); }
    const r = all[all.length - 1];
    console.log(`\n■ ${name}${r.sec ? ` (${r.sec}초)` : ''}: ${r.fails.length ? `문제 ${r.fails.length}` : '통과'} · 콘솔 오류 ${r.errors.length}`);
    for (const f of r.fails) console.log('  ✗', f);
    for (const e of r.errors.slice(0, 5)) console.log('  ! ', e);
    for (const n of r.notes) console.log('  ·', n);
  }
  await browser.close();
  if (!pick) fs.writeFileSync(path.join(__dirname, 'play-results.json'), JSON.stringify(all, null, 2));
  process.exit(all.some((r) => r.fails.length || r.errors.length) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
