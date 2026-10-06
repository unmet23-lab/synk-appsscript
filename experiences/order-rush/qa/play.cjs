'use strict';
// 주문 폭주 한 판을 처음부터 결과까지 실제로 한다(헤드리스 크롬, 진짜 시간·진짜 음성).
// 한가한 오픈 8개: 1번은 틀리게 서빙 → 손님이 다른 조건을 말함 → 고쳐서 서빙, 2번은 다시 듣기, 3번은 글로 보기, 4번은 키보드(⌫·1~6·Q·Space),
// 5번은 주문을 듣는 중에 멈춤·이어 하기, 나머지는 재료 쿠션을 눌러 맞게 서빙 → 결과(공통 코인) → 처음으로.
// 화면마다(컴퓨터 1440×900·휴대폰 390×844·작은 휴대폰 320×568·움직임 줄이기 1280×800) 장면을 찍고 점수·기록·코인·넘침·화면 밖 조작부·콘솔 오류를 본다.
// 휴대폰 장면에서는 이어서 점심 러시를 잠깐 한다: 듣는 동안·멈춘 동안 시간이 멈추는지, 줄 선 손님 표로 손님 바꾸기, 처음으로 나가면 코인이 없는지.
// 쓰는 법: experiences 폴더를 정적 서버로 띄운 뒤(예: node serve.cjs experiences 5241)
//   node experiences/order-rush/qa/play.cjs [desktop|phone|small|reduced]   (주소는 RUSH_URL, 기본 http://127.0.0.1:5241/order-rush/)
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.RUSH_URL || 'http://127.0.0.1:5241/order-rush/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, ...PHONE },
  small: { viewport: { width: 320, height: 568 }, ...PHONE },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 맞힘 7(1번은 고쳐서) · 콤보 1~8 → 110+120+130+140+150+160+160+160. 공통 코인: 완주 15 + 첫 서빙 7/8 × 10(반올림 9) = 24
const EXPECT = { orders: 8, firstOk: 7, score: 1130, best: 8, stars: 2, coins: 24, accuracy: '88%' };
const KEY = { coffee: '1', tea: '2', milk: '3', ice: '4', sugar: '5', cold: '6', add: 'q' };

async function run(browser, name, view) {
  const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = [], shots = [], notes = [], fails = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (label, opts = {}) => { const f = `play_${name}_${String(shots.length).padStart(2, '0')}_${label}.png`; await page.screenshot({ path: path.join(OUT, f), ...opts }); shots.push(f); };
  const S = () => page.evaluate(() => window.__rush.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  async function waitFor(pred, what, { timeout = 20000, every = 40 } = {}) {
    const t0 = Date.now(); let s = null;
    while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(every); }
    throw new Error(`${name}: 기다림 초과 — ${what} ${JSON.stringify(s && { screen: s.screen, current: s.current, queue: s.queue })}`);
  }
  const visible = (sel) => page.evaluate((q) => { const n = document.querySelector(q); return !!n && !n.hidden && n.getBoundingClientRect().height > 0; }, sel);
  // 넘침: 가로 스크롤·휴대폰 축소(innerWidth > visualViewport.width), 그리고 조작부가 화면 안에 있는지
  async function fit(label, panels = []) {
    const r = await page.evaluate((sels) => {
      const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
      const outOf = sels.map((q) => { const n = document.querySelector(q); if (!n || n.hidden) return `${q} 없음`; const b = n.getBoundingClientRect();
        return b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1 ? `${q} ${Math.round(b.left)},${Math.round(b.top)}~${Math.round(b.right)},${Math.round(b.bottom)} (화면 ${Math.round(vw)}×${Math.round(vh)})` : null; }).filter(Boolean);
      return { zoomed: innerWidth > vw + 1, wide: document.documentElement.scrollWidth > innerWidth + 1, outOf };
    }, panels);
    check(!r.zoomed && !r.wide, `${label}: 가로 넘침/축소 ${JSON.stringify(r)}`);
    check(!r.outOf.length, `${label}: 화면 밖 ${r.outOf.join(' | ')}`);
  }
  const GAME_KEYS = ['#serve', '#pause', '.ingredients', '#cup-tabs', '#remove-cup', '#bubble', '#bench'];
  // 재료 쿠션 누르기(tap) 또는 키보드(key)
  async function press(how, what) {
    if (how === 'key') await page.keyboard.press(KEY[what]);
    else await page.click(what === 'add' ? '#add-cup' : `[data-ingredient="${what}"]`);
  }
  /** 컵을 비우고 recipe대로 담는다. flipTemp면 첫 컵의 온도만 반대로(틀린 서빙). */
  async function build(recipe, { how = 'tap', flipTemp = false } = {}) {
    let s = await S();
    if (how === 'key') { for (let k = 0; k < s.cups.length; k++) await page.keyboard.press('Backspace'); }
    else { if (s.cups.length > 1) await page.click('#remove-cup'); await page.click('#remove-cup'); }
    s = await S();
    check(s.cups.length === 1 && !s.cups[0].base && !s.cups[0].ice, `컵 비우기 ${JSON.stringify(s.cups)}`);
    for (const [i, c] of recipe.entries()) {
      if (i > 0) await press(how, 'add');
      await press(how, c.base);
      if (c.milk) await press(how, 'milk');
      const cold = flipTemp && i === 0 ? c.temp !== 'cold' : c.temp === 'cold';
      if (cold) await press(how, c.ice === false || (flipTemp && i === 0) ? 'cold' : 'ice');
      if (c.sugar === true) await press(how, 'sugar');
    }
  }
  const serveBy = async (how) => { if (how === 'key') await page.keyboard.press('Space'); else await page.click('#serve'); };

  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#start'); await sleep(900);
  await fit('입구(시작 단추가 첫 화면에)', ['#start']); await shot('lobby');
  // 공통 코인: 입구에 잔액과 차고 링크(새 브라우저라 0)
  const coin0 = await page.evaluate(() => { const line = document.querySelector('#lobby .synk-collection-line');
    return { shown: !!line && !line.hidden && line.getBoundingClientRect().height > 0, text: line?.querySelector('[data-collection-balance]')?.textContent,
      href: line?.querySelector('[data-collection-garage]')?.getAttribute('href'), want: window.SynkPlayCollection?.garageHref }; });
  check(coin0.shown && coin0.text === '보유 0코인', `입구의 공통 코인 줄 ${JSON.stringify(coin0)}`);
  check(coin0.href === coin0.want, `차고 링크 ${coin0.href}`);
  check(await page.evaluate(() => document.querySelector('[data-mode="practice"]').getAttribute('aria-pressed') === 'true'), '한가한 오픈이 기본');
  const t0 = Date.now();
  await page.click('#start');

  for (let i = 0; i < EXPECT.orders; i++) {
    const uid = i + 1;
    let s = await waitFor((x) => x.screen === 'game' && !x.celebrating && x.current?.uid === uid, `${uid}번째 손님`, { timeout: 25000 });
    if (i === 0) notes.push(`문 열기 → 첫 손님 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
    const recipe = s.current.recipe;
    if (i === 0) {
      // 듣는 중: 말풍선에 점 셋, 조작부는 화면 안에
      await waitFor((x) => x.current?.voice === 'playing', '첫 주문 재생', { every: 20 });
      await sleep(250); await shot('listening'); await fit('주문 듣는 중', GAME_KEYS);
      check(await visible('#b-dots'), '듣는 중 점 셋');
    }
    if (i === 4) {
      // 듣는 중에 멈춤 → 이어 하기: 멈춘 동안 음성이 멈추고, 이어 하면 끝까지 들은 것으로 남는다
      await waitFor((x) => x.current?.uid === uid && x.current.voice === 'playing', `${uid}번째 주문 재생`, { every: 20 });
      await page.click('#pause'); await sleep(250);
      check(await page.evaluate(() => document.querySelector('#pause-dialog').open), '멈춤 창');
      await shot('pause');
      await sleep(900);
      check(!(await S()).current.heard, '멈춘 동안 주문이 끝나 버림');
      await page.click('#resume');
    }
    s = await waitFor((x) => x.current?.uid === uid && ((x.current.heard && x.current.voice === 'ready') || x.current.voice === 'error'), `${uid}번째 주문 듣기`, { timeout: 15000 });
    if (s.current.voice === 'error') {   // 소리 장치가 멈춰 끝 신호 지킴이 넘겼다: 다시 듣기(아직 첫 듣기)
      notes.push(`${uid}번째 주문: 재생이 멈춰 다시 듣기를 눌렀어요`);
      await page.click('#listen');
      s = await waitFor((x) => x.current?.uid === uid && x.current.heard && x.current.voice === 'ready', `${uid}번째 주문 다시 듣기`, { timeout: 15000 });
    }
    check(s.current.audioCompleted, `${uid}번째: 끝까지 들음`);
    if (i === 1) {
      // 다시 듣기: 다시 재생되고, 들은 주문은 들은 채로 남는다
      await page.click('#listen');
      await waitFor((x) => x.current?.voice === 'playing', '다시 듣기 재생', { every: 20 });
      check((await S()).current.heard, '다시 듣는 중에도 들은 주문');
      await waitFor((x) => x.current?.voice === 'ready', '다시 듣기 끝', { timeout: 15000 });
    }
    if (i === 2) {
      // 글로 보기: 말풍선에 주문 문장
      await page.click('#show-text'); await sleep(200);
      const text = await page.evaluate(() => document.querySelector('#order-text').textContent);
      check(await visible('#order-text'), '글로 보기: 문장이 보임');
      const order = await page.evaluate((id) => import((document.querySelector('script[type="module"][src]')?.src || '').includes('.mjs') ? './core.mjs' : './core.js').then((m) => m.ORDERS.find((o) => o.id === id)?.text), s.current.id);
      check(text === `“${order}”`, `글로 보기 문장 ${text} ≠ ${order}`);
      await shot('text');
    }
    const how = i === 3 ? 'key' : 'tap';
    if (i === 0) {
      // 틀리게: 첫 컵의 온도만 반대로 → 손님이 다른 조건을 말한다(빨간 표시 없음) → 고쳐서 다시
      await build(recipe, { flipTemp: true });
      await sleep(450); await shot('building'); await fit('컵에 담는 중', GAME_KEYS);
      await serveBy('tap');
      s = await waitFor((x) => !!x.current?.note, '다른 조건 안내');
      await sleep(300);
      check(await visible('#b-note'), '다른 조건이 말풍선에');
      check(/따뜻하게|차갑게|얼음|두 잔|다르/.test(s.current.note), `다른 조건 문구 ${s.current.note}`);
      await shot('wrong'); await fit('다르게 서빙', GAME_KEYS);
      notes.push(`틀린 서빙 안내: ${s.current.note}`);
    }
    await build(recipe, { how });
    await serveBy(how);
    s = await waitFor((x) => x.celebrating || x.done || x.screen === 'results', `${uid}번째 서빙`, { every: 15 });
    if (i === 0) {
      await sleep(120);
      check(await page.evaluate(() => document.querySelector('#bubble').classList.contains('right')), '맞으면 체크 배지');
      await shot('right');
    }
  }

  // 결과
  await waitFor((x) => x.screen === 'results', '결과', { timeout: 15000 });
  await sleep(1300);
  await fit('결과', []); await shot('results'); await shot('results_full', { fullPage: true });
  const fin = await S();
  const st = await page.evaluate(() => ({
    correct: +document.querySelector('#r-correct').textContent, total: +document.querySelector('#r-total').textContent,
    stars: document.querySelectorAll('#r-stars i.on').length, note: document.querySelector('#r-note').textContent,
    log: [...document.querySelectorAll('#r-log li')].map((li) => li.className), say: document.querySelectorAll('#r-log .say-again').length,
    metrics: document.querySelector('#result-metrics').textContent, learning: document.querySelector('#result-learning').textContent,
    flow: document.querySelector('#result-flow').hidden ? null : [...document.querySelectorAll('#result-flow li')].map((li) => li.textContent),
    coins: document.querySelector('#r-coins').textContent, review: !document.querySelector('#review-start').hidden,
  }));
  check(st.correct === EXPECT.firstOk && st.total === EXPECT.orders, `결과 ${st.correct}/${st.total}`);
  check(st.stars === EXPECT.stars, `별 ${st.stars}`);
  check(fin.score === EXPECT.score && fin.best === EXPECT.best, `점수 ${fin.score}·콤보 ${fin.best}`);
  check(st.note.includes(`서빙 점수 ${EXPECT.score}점`) && st.note.includes('글로 확인한 주문 1개'), `결과 메모 ${st.note}`);
  check(st.log.filter((c) => c === 'ok').length === 7 && st.log.filter((c) => c === 'ko').length === 1, `주문 줄 ${st.log.join(',')}`);
  check(st.say === EXPECT.orders, `다시 듣기 단추 ${st.say}개`);
  check(st.metrics.includes(EXPECT.accuracy), `첫 제출 정확도 ${st.metrics}`);
  check(st.review, '새 주문 연습 단추');
  // 기록: 글로 본 주문만 글 도움, 첫 서빙 결과는 1번만 틀림
  check(fin.records.map((r) => r.help).join() === 'false,false,true,false,false,false,false,false', `글 도움 기록 ${fin.records.map((r) => r.help).join()}`);
  check(fin.records.map((r) => r.first).join() === 'false,true,true,true,true,true,true,true', `첫 서빙 ${fin.records.map((r) => r.first).join()}`);
  // 공통 코인: 결과에 받은 코인, 지갑에는 이 판 하나
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'));
  const paid = Object.keys(wallet?.rewardedRounds || {});
  check(st.coins === `공통 코인 +${EXPECT.coins} · 보유 ${EXPECT.coins}`, `결과의 공통 코인 ${st.coins}`);
  check(wallet?.coins === EXPECT.coins && paid.length === 1 && paid[0].startsWith('order-rush:'), `공통 지갑 ${JSON.stringify({ coins: wallet?.coins, paid })}`);
  // 혼자 해낸 응답: 끝까지 듣고 도움 없이 낸 첫 서빙 6개(1번의 틀린 첫 서빙 포함, 다시 듣기·글로 보기를 쓴 2·3번은 도움)
  const sum = await page.evaluate(() => window.synkCafe.learning);
  check(sum?.independent === 6, `혼자 해낸 응답 ${sum?.independent} ≠ 6`);
  notes.push(`공통 코인: ${st.coins}`);
  notes.push(`학습 기록: 혼자 해낸 응답 ${sum?.independent} · 결과 이유 “${st.learning}”`);
  if (st.flow) notes.push(`이번 영업에서 맞춘 것: ${st.flow.join(' / ')}`);
  // 복습 듣기
  const b0 = await page.evaluate(() => document.querySelector('#r-log .say-again') && true);
  if (b0) { await page.click('#r-log .say-again'); await sleep(300); }
  // 처음으로 → 입구 잔액
  await page.click('#home'); await page.waitForSelector('#lobby:not([hidden])'); await sleep(400);
  check((await page.textContent('#lobby [data-collection-balance]')) === `보유 ${EXPECT.coins}코인`, '입구 코인 잔액');
  await shot('lobby_again');
  if (name === 'phone') await rushSmoke(page, { shot, S, check, waitFor, visible, fit, notes });
  if (name === 'small') await muteSmoke(page, { shot, S, check, waitFor, visible, notes });
  await ctx.close();
  return { name, errors, fails, notes, shots };
}

/** 점심 러시 잠깐: 듣는 동안·멈춘 동안 시간이 멈추고, 줄 선 손님 표로 손님을 바꾸고, 처음으로 나가면 코인이 없다. */
async function rushSmoke(page, { shot, S, check, waitFor, visible, fit, notes }) {
  await page.click('[data-mode="rush"]'); await sleep(200);
  check((await page.textContent('#l-title')).includes('90초'), '점심 러시 제목');
  await shot('rush_lobby');
  await page.click('#start');
  let s = await waitFor((x) => x.screen === 'game' && x.current?.voice === 'playing', '러시 첫 주문', { timeout: 20000, every: 20 });
  const tA = s.time; await sleep(700); s = await S();
  check(s.current.voice !== 'playing' || s.time === tA, `듣는 동안 시간이 흐름 ${tA} → ${s.time}`);
  s = await waitFor((x) => x.current?.heard, '러시 첫 주문 듣기', { timeout: 15000 });
  check((await page.textContent('#g-count-label')) === '시간', '러시 HUD 시간');
  check(await visible('#b-patience'), '지금 손님 기다림 막대');
  // 줄 선 손님이 올 때까지 기다린다(시간이 흐른다)
  s = await waitFor((x) => x.queue.length >= 2, '두 번째 손님', { timeout: 40000, every: 100 });
  await waitFor((x) => x.current?.voice !== 'playing', '첫 손님 다시 듣기 끝', { timeout: 8000 });
  await sleep(300);
  check(await visible('#queue .ticket'), '줄 선 손님 표');
  await fit('점심 러시: 줄 선 손님', ['#serve', '#pause', '#queue', '#bubble', '.ingredients']);
  await shot('rush_queue');
  // 멈춘 동안 시간이 흐르지 않는다
  await page.click('#pause'); await sleep(200);
  const tP = (await S()).time; await sleep(1200);
  check((await S()).time === tP, '멈춘 동안 시간이 흐름');
  await page.click('#resume');
  // 줄 선 손님 표를 누르면 그 손님 주문으로
  const before = (await S()).current.uid;
  await page.click('#queue .ticket'); await sleep(400);
  s = await S();
  check(s.current.uid !== before, `손님 바꾸기 ${before} → ${s.current.uid}`);
  await shot('rush_switch');
  notes.push(`점심 러시: 줄 ${s.queue.length}명, 남은 시간 ${await page.textContent('#g-count')}초`);
  // 처음으로 나가면 코인 없음
  await page.click('#pause'); await sleep(200); await page.click('#quit'); await sleep(400);
  check(await page.evaluate(() => !document.querySelector('#lobby').hidden), '러시에서 처음으로');
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'));
  check(wallet?.coins === EXPECT.coins && Object.keys(wallet?.rewardedRounds || {}).length === 1, `그만둔 판에 코인 ${JSON.stringify(wallet && { coins: wallet.coins })}`);
}

/** 소리를 끈 채로: 주문이 처음부터 글로 나오고(글 도움), 다시 듣기는 숨는다. 멈춤 창에서 다시 켜면 다시 듣기가 돌아온다. 처음으로 나가면 코인 없음. */
async function muteSmoke(page, { shot, S, check, waitFor, visible, notes }) {
  await page.click('#lobby .sound-toggle'); await sleep(150);
  check(await visible('#sound-note'), '소리 끔 안내');
  check(await page.evaluate(() => localStorage.getItem('synk.order-rush.sound') === 'off'), '소리 끔 저장');
  await page.click('#start');
  let s = await waitFor((x) => x.screen === 'game' && x.current?.textShown, '소리 끔: 주문이 글로', { timeout: 10000 });
  check(s.current.voice === null && !s.current.heard && s.current.help, `소리 끔 주문 상태 ${JSON.stringify(s.current)}`);
  check(!(await visible('#listen')), '소리 끔: 다시 듣기 숨김');
  await sleep(450); await shot('mute_text');   // 손님이 들어오는 0.36초가 지난 뒤
  // 멈춤 창에서 소리를 다시 켜면 다시 듣기가 돌아온다
  await page.click('#pause'); await sleep(200);
  await page.click('#pause-dialog [data-sound-toggle]'); await sleep(100);
  check((await page.textContent('#pause-dialog [data-sound-toggle]')) === '소리 켜짐', '멈춤 창 소리 칩');
  await page.click('#resume'); await sleep(200);
  check(await visible('#listen'), '소리를 켜면 다시 듣기');
  await page.click('#pause'); await sleep(200); await page.click('#quit'); await sleep(300);
  s = await S();
  check(s.screen === 'lobby' && s.records.length === 1 && s.records[0].first === null, `소리 끔 판을 그만둠 ${JSON.stringify(s.records)}`);
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'));
  check(wallet?.coins === EXPECT.coins, `그만둔 판에 코인 ${wallet?.coins}`);
  notes.push('소리 끔: 주문을 글로 보여 주고(글 도움), 다시 켜면 다시 듣기가 돌아옴');
}

(async () => {
  const pick = process.argv[2];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
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
  fs.writeFileSync(path.join(__dirname, 'play-results.json'), JSON.stringify(all, null, 2));
  process.exit(all.some((r) => r.fails.length || r.errors.length) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
