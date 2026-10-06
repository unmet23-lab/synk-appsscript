'use strict';
// 선생님이 돌아왔다 한 판을 처음부터 결과까지 실제로 한다(헤드리스 크롬, 진짜 음성 파일·진짜 저장).
// 순서: 입구(대사 음성 자동 끔) → 이야기 → 1장: 까몽이 종이를 쓰레기통에 버림(교실이 바뀌고 쪽지) → 힌트 → 되돌리기 → 서랍에 넣기 → 마린 과자
// → 2장: 꽃 부탁을 다시 듣기로 들은 뒤 옮기기, 편지 → 3장: 케이크·리본 → 새 글 셋(휴대폰은 하나를 끌어 놓기) → 결과 → 처음으로.
// 컴퓨터 장면은 1장 뒤에 새로고침해 이어 하기도 본다. 나머지 부탁은 친구 → 물건 → 놓을 곳을 눌러서 한다.
// 화면마다(컴퓨터·휴대폰·320px·움직임 줄이기) 장면을 찍고, 게임 화면이 한 화면인지(스크롤 없음)·가로 넘침·교실 단추가 교실 안에 있고
// 판에 가리지 않는지·이름표가 다른 것에 덮이지 않는지·결과·공통 코인·학습 기록·콘솔 오류를 확인한다.
// 쓰는 법: experiences 폴더를 정적 서버로 띄운 뒤(예: 5251)  node experiences/story-classroom/qa/play.cjs [desktop|phone|small|reduced]
//   주소를 바꾸려면 STORY_URL=http://127.0.0.1:5251/story-classroom/
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.STORY_URL || 'http://127.0.0.1:5251/story-classroom/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, ...PHONE },
  small: { viewport: { width: 320, height: 568 }, ...PHONE },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 기대값: 부탁 9개 중 첫 시도 8개(종이만 두 번째), 도움 없이 처음 해낸 부탁 7개(꽃은 다시 듣기로 들음)
// 공통 코인: 완주 15 + 도움 없이 첫 시도 비율 × 10(반올림) → 15 + round(70/9) = 23
const EXPECT = { total: 9, firstTry: 8, independent: 7, coins: 23 };

async function run(browser, name, view) {
  const ctx = await browser.newContext(view), page = await ctx.newPage();
  const errors = [], shots = [], notes = [], fails = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const touch = !!view.hasTouch;
  const check = (ok, what) => { if (!ok) fails.push(what); };
  const S = () => page.evaluate(() => window.__story.state());
  const shot = async (label, opts = {}) => {
    const f = `play_${name}_${String(shots.length).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(OUT, f), ...opts }); shots.push(f);
  };
  async function waitFor(pred, what, { timeout = 15000, every = 40 } = {}) {
    const t0 = Date.now(); let s = null;
    while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(every); }
    throw new Error(`${name}: 기다림 초과 — ${what} ${JSON.stringify(s && { screen: s.screen, phase: s.phase, busy: s.busy, actor: s.actor, held: s.held })}`);
  }
  const idle = () => waitFor((s) => !s.busy, '옮기기 끝');
  const press = async (sel) => { if (touch) await page.tap(sel); else await page.click(sel); };

  // 한 화면·넘침·교실 단추 검사
  async function layout(label, { game = true } = {}) {
    const r = await page.evaluate((isGame) => {
      const vv = window.visualViewport, doc = document.documentElement;
      const out = { zoomed: innerWidth > (vv ? vv.width : innerWidth) + 1, wide: doc.scrollWidth > innerWidth + 1, tall: isGame && doc.scrollHeight > innerHeight + 1,
        sizes: [doc.scrollWidth, doc.scrollHeight, innerWidth, innerHeight], outside: [], covered: [], hidden: [], small: [] };
      if (!isGame) return out;
      const scene = document.querySelector('.scene').getBoundingClientRect(), sheet = document.querySelector('#sheet').getBoundingClientRect();
      const meet = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      for (const n of document.querySelectorAll('[data-actor],[data-object],[data-destination]')) {
        const b = n.getBoundingClientRect(), id = n.dataset.actor || n.dataset.object || n.dataset.destination;
        if (b.left < scene.left - 1 || b.right > scene.right + 1 || b.top < scene.top - 1 || b.bottom > scene.bottom + 1) out.outside.push(`${id} ${Math.round(b.left)},${Math.round(b.top)}~${Math.round(b.right)},${Math.round(b.bottom)}`);
        if (meet(b, sheet)) out.covered.push(id);
        // 이름표 가운데가 다른 단추에 덮이지 않는다
        const tag = n.querySelector(':scope > .name'); if (!tag) continue;
        const t = tag.getBoundingClientRect(), hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
        const owner = hit?.closest('[data-actor],[data-object],[data-destination]');
        if (owner !== n) out.hidden.push(`${id}←${owner ? owner.dataset.actor || owner.dataset.object || owner.dataset.destination : hit?.className || 'none'}`);
        const fs = parseFloat(getComputedStyle(tag).fontSize); if (fs < 13 || Math.max(b.width, b.height) < 36) out.small.push(`${id} ${fs}px ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
      // 이름표끼리 겹치지 않는다(가장자리까지)
      const tags = [...document.querySelectorAll('.stage .name')].map((t) => { const o = t.closest('[data-actor],[data-object],[data-destination]'); return { id: o.dataset.actor || o.dataset.object || o.dataset.destination, r: t.getBoundingClientRect() }; });
      out.overlap = [];
      for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
        const a = tags[i].r, c = tags[j].r, w = Math.min(a.right, c.right) - Math.max(a.left, c.left), h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (w > 2 && h > 2) out.overlap.push(`${tags[i].id}/${tags[j].id}`);
      }
      return out;
    }, game);
    check(!r.zoomed && !r.wide, `${label}: 가로 넘침/축소 ${JSON.stringify(r.sizes)}`);
    if (game) {
      check(!r.tall, `${label}: 게임 화면이 스크롤됨 ${JSON.stringify(r.sizes)}`);
      check(!r.outside.length, `${label}: 교실 밖 단추 ${r.outside.join(' | ')}`);
      check(!r.covered.length, `${label}: 판에 가린 단추 ${r.covered.join(', ')}`);
      check(!r.hidden.length, `${label}: 덮인 이름표 ${r.hidden.join(', ')}`);
      check(!r.small.length, `${label}: 작은 글자·누를 곳 ${r.small.join(', ')}`);
      check(!r.overlap.length, `${label}: 겹친 이름표 ${r.overlap.join(', ')}`);
    }
  }
  // 판의 부탁 문장이 고른 것과 맞는지: 고른 친구·물건을 둘 다 쓰는 열린 부탁이 딱 하나면 그 탭, 아니면 「지금 고른 것」 표시
  async function picksAgree(label) {
    const s = await S(), m = s.missions.find((x) => x.id === s.active);
    const fits = s.missions.filter((x) => !x.done && (!s.actor || x.actor === s.actor) && (!s.held || x.object === s.held));
    const tag = await page.evaluate(() => { const n = document.querySelector('#steps-label'); return n.hidden ? null : n.textContent; });
    const match = !m.done && (!s.actor || m.actor === s.actor) && (!s.held || m.object === s.held);
    if (fits.length === 1) check(s.active === fits[0].id, `${label}: 고른 것과 맞는 부탁 ${fits[0].id}인데 탭은 ${s.active}`);
    check(match ? tag === null : tag === '지금 고른 것', `${label}: 「지금 고른 것」 표시 ${JSON.stringify({ match, tag, active: s.active, actor: s.actor, held: s.held })}`);
    return s;
  }
  // 쪽지가 판 안에 다 보인다(안쪽 스크롤 없음)
  async function noteFits(label) {
    const r = await page.evaluate(() => {
      const note = document.querySelector('#note'), mid = document.querySelector('#ask-middle'), sheet = document.querySelector('#sheet');
      if (note.hidden) return { shown: false };
      const n = note.getBoundingClientRect(), m = mid.getBoundingClientRect(), p = sheet.getBoundingClientRect();
      return { shown: true, scroll: mid.scrollHeight - mid.clientHeight, inside: n.top >= m.top - 1 && n.bottom <= m.bottom + 1 && n.bottom <= p.bottom + 1, mode: note.className };
    });
    check(r.shown && r.scroll <= 1 && r.inside, `${label}: 쪽지가 판에 다 보이지 않음 ${JSON.stringify(r)}`);
    return r;
  }
  // 친구 → 물건 → 놓을 곳(가구는 이름표, 칠판도 이름표를 누른다)
  async function move(actor, object, destination, { shotPicks = null } = {}) {
    let s = await S();
    if (s.actor !== actor) { await press(`[data-actor="${actor}"]`); await waitFor((x) => x.actor === actor, `${actor} 고름`); await picksAgree(`${actor} 고름`); }
    s = await S();
    if (s.held !== object) { await press(`[data-object="${object}"]`); await waitFor((x) => x.held === object, `${object} 고름`); await picksAgree(`${actor}·${object} 고름`); }
    if (shotPicks) { await sleep(250); await layout(`${shotPicks} 고름`); await shot(shotPicks); }
    await press(`[data-destination="${destination}"] > .name`);
    await sleep(80); await idle(); await sleep(60);
    return S();
  }
  async function readUntil(phase, what, { beatShot = null } = {}) {
    for (let i = 0; i < 40; i++) {
      const s = await S();
      if (s.phase === phase && !s.busy) return s;
      if (['play', 'review', 'complete'].includes(s.phase) && s.phase !== phase) throw new Error(`${name}: ${what} 전에 ${s.phase}`);
      if (beatShot && s.phase === 'opening' && s.line === 3) { await sleep(700); await layout('이야기(선생님 등장)'); await shot(beatShot); beatShot = null; }
      await press('#dialogue-next'); await sleep(110);
    }
    throw new Error(`${name}: ${what}까지 넘기지 못함`);
  }
  const record = (s, id) => s.records.find((r) => r.id === id);

  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#start'); await sleep(900);
  await layout('입구', { game: false });
  const startVisible = await page.evaluate(() => { const b = document.querySelector('#start').getBoundingClientRect(); return b.bottom <= innerHeight + 1; });
  if (name === 'phone') check(startVisible, '입구: 휴대폰 첫 화면에 이야기 시작 단추');
  await shot('lobby');
  const coin0 = await page.evaluate(() => { const line = document.querySelector('#lobby .synk-collection-line');
    return { shown: !!line && !line.hidden && line.getBoundingClientRect().height > 0, text: line?.querySelector('[data-collection-balance]')?.textContent, href: line?.querySelector('[data-collection-garage]')?.getAttribute('href'), want: window.SynkPlayCollection?.garageHref }; });
  check(coin0.shown && coin0.text === '보유 0코인', `입구의 공통 코인 줄 ${JSON.stringify(coin0)}`);
  check(coin0.href === coin0.want, `차고 링크 ${coin0.href}`);
  // 대사 음성 자동을 끈다: 다시 듣기를 누른 부탁만 음성 도움으로 남는다
  await press('#voice-auto');
  check((await page.getAttribute('#voice-auto', 'aria-pressed')) === 'false', '대사 음성 자동 끄기');
  await press('#start');
  await waitFor((s) => s.screen === 'game' && s.phase === 'opening', '이야기 시작');
  await readUntil('play', '1장 부탁', { beatShot: 'story_beat' });

  /* 1장: 고른 것을 따라가는 탭 → 틀린 행동 → 쪽지 → 힌트 → 되돌리기 → 고치기 */
  await sleep(300); await layout('1장 부탁');
  // 마린을 고르면 마린의 부탁(과자)으로, 이어서 까몽의 종이를 고르면 맞는 부탁이 없어 「지금 고른 것」, 까몽으로 바꾸면 종이 부탁으로
  await press('[data-actor="marin"]'); await waitFor((x) => x.actor === 'marin', '마린 고름');
  let s = await picksAgree('마린 고름');
  check(s.active === 'cleanup-snacks', `마린을 고르면 과자 부탁 ${s.active}`);
  await press('[data-object="paper"]'); await waitFor((x) => x.held === 'paper', '종이 고름');
  s = await picksAgree('마린·종이(맞는 부탁 없음)');
  check(s.active === 'cleanup-snacks', `맞는 부탁이 없으면 탭은 그대로 ${s.active}`);
  await sleep(200); await shot('picks_mismatch');
  await press('[data-actor="kkamong"]'); await waitFor((x) => x.actor === 'kkamong', '까몽 고름');
  s = await picksAgree('까몽·종이');
  check(s.active === 'cleanup-paper', `까몽·종이를 고르면 종이 부탁 ${s.active}`);
  s = await move('kkamong', 'paper', 'bin', { shotPicks: 'request_picks' });
  check(s.scene.paper === 'bin', `종이가 쓰레기통으로 가지 않음 ${s.scene.paper}`);
  check(s.note?.type === 'wrong' && /되돌리기/.test(s.note.text), `틀림 쪽지 ${JSON.stringify(s.note)}`);
  check(record(s, 'cleanup-paper')?.firstCorrect === false, '종이 첫 응답이 틀림으로 남음');
  check(!(await page.evaluate(() => /[×✕✖✗]/.test(document.querySelector('#note').innerText))), '쪽지에 X 표시가 없음');
  await sleep(250); await layout('틀림 쪽지');
  const wrongFit = await noteFits('틀림 쪽지');
  // 넓은 판에서는 교실에서 일어난 일까지, 좁은 판(compact)에서는 반응 대사 → 고치는 법 한 줄
  if (!/compact/.test(wrongFit.mode || '')) check(/쓰레기통에 버렸어요/.test(s.note.text), `틀림 쪽지에 일어난 일 ${s.note.text}`);
  notes.push(`틀림 쪽지: ${(wrongFit.mode || '').replace('note ', '')}`);
  await shot('wrong_note');
  await press('#hint'); await sleep(120); s = await S();
  check(s.note?.type === 'hint' && /서랍/.test(s.note.text), `힌트 쪽지 ${JSON.stringify(s.note)}`);
  await noteFits('힌트 쪽지');
  await press('#undo'); await sleep(150); s = await S();
  check(s.scene.paper === 'floor' && s.held === 'paper' && s.actor === 'kkamong', `되돌리기 ${JSON.stringify({ paper: s.scene.paper, held: s.held, actor: s.actor })}`);
  await noteFits('되돌림 쪽지'); await picksAgree('되돌린 뒤');
  await press('[data-destination="drawer"] > .name'); await sleep(80); await idle(); await sleep(250);
  s = await S();
  check(s.completed.includes('cleanup-paper') && s.note?.type === 'right', `종이를 서랍에 넣기 ${JSON.stringify(s.note)}`);
  check(s.actor === null && s.active === 'cleanup-snacks', `맞힌 뒤 친구 선택을 비우고 다음 부탁으로 ${JSON.stringify({ actor: s.actor, active: s.active })}`);
  await noteFits('맞음 쪽지');
  const tick = await page.evaluate(() => [...document.querySelectorAll('.ask-tab')].map((t) => ({ text: t.textContent, done: t.classList.contains('done'), tick: !!t.querySelector('.tick') })));
  check(tick.some((t) => t.done && t.tick), `마친 부탁 탭에 체크 배지 ${JSON.stringify(tick)}`);
  const pop = await page.evaluate(() => ({ text: document.querySelector('#pop').textContent, shown: !document.querySelector('#pop').hidden }));
  check(pop.shown && pop.text === '부탁 완료!', `칭찬 글자 ${JSON.stringify(pop)}`);
  await layout('맞음 쪽지'); await shot('right');
  s = await move('marin', 'snacks', 'box');
  check(s.phase === 'outro' && s.completed.includes('cleanup-snacks'), `1장 끝 ${s.phase}`);

  if (name === 'desktop') {
    // 이어 하기: 새로고침 → 입구에 이어 하기 → 같은 자리
    const before = await S();
    await page.reload(); await page.waitForSelector('#start'); await sleep(700);
    check(await page.isVisible('#resume'), '새로고침 뒤 이어 하기 단추');
    await press('#voice-auto');
    await press('#resume');
    s = await waitFor((x) => x.screen === 'game', '이어 하기');
    check(s.phase === before.phase && JSON.stringify(s.scene) === JSON.stringify(before.scene) && s.completed.length === before.completed.length, `이어 하기 상태 ${s.phase} ${JSON.stringify(s.scene)}`);
    notes.push(`이어 하기: ${s.phase} · 장면 ${s.act + 1} · 마친 부탁 ${s.completed.length}`);
  }

  /* 2장: 꽃 부탁을 다시 듣기로 들은 뒤 옮긴다 */
  s = await readUntil('play', '2장 부탁');
  await sleep(250); await layout('2장 부탁');
  check(s.active === 'clue-flowers', `2장은 순서상 꽃 부탁부터 ${s.active}`);
  await press('#ask-replay');
  s = await waitFor((x) => x.records.find((r) => r.id === 'clue-flowers')?.audioHelpUsed, '다시 듣기 음성 시작', { timeout: 12000 });
  check(s.voice.id === 'mission-clue-flowers' || s.voice.state !== 'error', `다시 듣기 음성 ${JSON.stringify(s.voice)}`);
  notes.push(`다시 듣기: ${s.voice.state} ${s.voice.id || ''}`);
  s = await move('marin', 'flowers', 'table');
  check(s.completed.includes('clue-flowers'), '꽃을 책상에');
  check(record(s, 'clue-flowers').firstAudioHelpUsed === true && record(s, 'clue-flowers').firstCorrect === true, '꽃: 음성 도움을 받고 첫 시도에 해냄');
  s = await move('kkamong', 'letter', 'board');
  check(s.phase === 'outro', `2장 끝 ${s.phase}`);

  /* 3장 */
  s = await readUntil('play', '3장 부탁');
  await layout('3장 부탁');
  s = await move('kkamong', 'cake', 'table');
  s = await move('marin', 'ribbon', 'board');
  check(s.phase === 'outro' && s.completed.includes('surprise-ribbon'), `3장 끝 ${s.phase}`);
  check(await page.evaluate(() => document.querySelector('.board-spot').classList.contains('party')), '파티 장식(리본 줄)이 칠판에');

  /* 새 글 */
  s = await readUntil('review', '새 글');
  await sleep(300); await layout('새 글'); await shot('review');
  s = await move('kkamong', 'snacks', 'shelf');
  if (name === 'phone') {
    // 친구를 고른 뒤 종이를 상자로 끌어 놓는다
    await press('[data-actor="marin"]'); await waitFor((x) => x.actor === 'marin', '마린 고름');
    const from = await page.locator('[data-object="paper"] .art').boundingBox(), to = await page.locator('[data-destination="box"] > .name').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 14 }); await page.mouse.up();
    await sleep(80); await idle(); await sleep(60); s = await S();
    check(s.scene.paper === 'box' && s.completed.includes('review-paper'), `끌어 놓기 ${s.scene.paper}`);
    notes.push('새 글 종이: 끌어 놓기로 옮김');
  } else s = await move('marin', 'paper', 'box');
  s = await move('marin', 'cake', 'shelf');

  /* 결과 */
  await page.waitForSelector('#results:not([hidden])', { timeout: 8000 }); await sleep(1300);
  await layout('결과', { game: false });
  await shot('results'); await shot('results_full', { fullPage: true });
  const st = await page.evaluate(() => ({
    firstTry: +document.querySelector('#r-correct').textContent, total: +document.querySelector('#r-total').textContent,
    stars: document.querySelectorAll('#r-stars i.on').length, note: document.querySelector('#r-note').textContent,
    log: [...document.querySelectorAll('#r-log li')].map((li) => li.className), skills: [...document.querySelectorAll('#r-skills li')].map((li) => li.innerText.replace(/\s+/g, ' ')),
    next: document.querySelector('#r-next-reason').textContent, coins: document.querySelector('#r-coins').textContent,
    wallet: JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'),
  }));
  s = await S();
  check(s.completed.length === EXPECT.total && s.records.length === EXPECT.total && s.records.every((r) => r.completed), `부탁 ${s.records.filter((r) => r.completed).length}/${s.records.length} 완료`);
  check(st.firstTry === EXPECT.firstTry && st.total === EXPECT.total, `결과 첫 시도 ${st.firstTry}/${st.total}`);
  check(st.note.includes(`도움 없이 처음 해낸 부탁 ${EXPECT.independent}개`) && st.note.includes('힌트 1개') && st.note.includes('음성으로 들은 부탁 1개'), `결과 메모 ${st.note}`);
  check(st.log.filter((c) => c === 'ok').length === 8 && st.log.filter((c) => c === 'ko').length === 1, `결과 목록 ${st.log.join(',')}`);
  check(st.stars === 2, `별 ${st.stars}`);
  const coinsOk = st.coins === `공통 코인 +${EXPECT.coins} · 보유 ${EXPECT.coins}` || st.coins === '오늘의 완주 코인 10회분을 모두 받았어요.';
  check(coinsOk, `결과의 공통 코인 ${st.coins}`);
  const paid = Object.keys(st.wallet?.rewardedRounds || {});
  check(st.wallet?.coins === EXPECT.coins && paid.length === 1 && paid[0].startsWith('story-classroom:'), `공통 지갑 ${JSON.stringify({ coins: st.wallet?.coins, paid })}`);
  notes.push(`결과: 첫 시도 ${st.firstTry}/${st.total} · 별 ${st.stars} · ${st.note}`);
  notes.push(`공통 코인: ${st.coins}`);
  notes.push(`읽기 능력 줄: ${st.skills.join(' / ')}`);
  // 결과에서 부탁 다시 듣기는 복습이라 도움으로 세지 않는다
  const helpedBefore = s.records.filter((r) => r.audioHelpUsed).length;
  const say = await page.$('#r-log .say-again');
  if (say) { await say.click(); await sleep(1200); }
  s = await S();
  check(s.records.filter((r) => r.audioHelpUsed).length === helpedBefore, '결과의 다시 듣기가 도움으로 세어짐');
  // 학습 기록: 공통 기록에 이 게임 문항이 남는다
  const stored = await page.evaluate(() => { const keys = Object.keys(localStorage).filter((k) => k.startsWith('synk.atlas.learning.v1')); const raw = keys.map((k) => localStorage.getItem(k)).join(''); return (raw.match(/story-classroom\./g) || []).length; });
  check(stored > 0, '공통 학습 기록에 이야기 교실 문항이 없음');

  /* 처음으로 → 입구 잔액 */
  await press('#r-home'); await page.waitForSelector('#lobby:not([hidden])'); await sleep(400);
  const lobbyCoins = await page.textContent('#lobby [data-collection-balance]');
  check(lobbyCoins === `보유 ${EXPECT.coins}코인`, `입구 코인 잔액 ${lobbyCoins}`);

  /* 멈춤 창과 이야기 수첩(마친 이야기를 이어 하기로 열면 결과로 간다 → 새 판으로 연다) */
  await press('#start'); await waitFor((x) => x.screen === 'game', '두 번째 판');
  await press('#dialogue-next'); await sleep(120);
  await press('#pause'); await sleep(250);
  check(await page.evaluate(() => document.querySelector('#pause-dialog').open), '멈춤 창');
  await shot('pause');
  await press('#journal'); await sleep(250);
  const journal = await page.evaluate(() => document.querySelectorAll('#journal-lines li').length);
  check(journal >= 2, `이야기 수첩 줄 ${journal}`);
  await shot('journal');
  await press('#journal-close'); await sleep(150);
  await press('#pause-close'); await sleep(150);
  check(!(await page.evaluate(() => document.querySelector('#pause-dialog').open)), '멈춤 창 닫힘');
  await ctx.close();
  return { name, errors, fails, notes, shots };
}

// 배치 점검(node qa/play.cjs sweep): 여러 화면 크기에서 이야기 끝까지(정답 hook으로 빨리) 가며 장면마다 교실 단추·이름표를 본다
const SWEEP = { small: [320, 568, true], se: [375, 667, true], android: [360, 780, true], pixel: [412, 915, true], tabletTall: [768, 1024, true], tabletWide: [1024, 768, false], landscape: [844, 390, true], desktopSmall: [1280, 720, false] };
async function runSweep(browser) {
  const out = { name: 'sweep', errors: [], fails: [], notes: [], shots: [] };
  for (const [key, [width, height, touch]] of Object.entries(SWEEP)) {
    if (process.argv[3] && process.argv[3] !== key) continue;   // node qa/play.cjs sweep small — 한 크기만
    const ctx = await browser.newContext({ viewport: { width, height }, ...(touch ? PHONE : {}), reducedMotion: 'reduce' }), page = await ctx.newPage();
    page.on('pageerror', (e) => out.errors.push(`${key}: ${e}`)); page.on('console', (m) => { if (m.type() === 'error') out.errors.push(`${key}: ${m.text()}`); });
    await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#start'); await sleep(500);
    await page.click('#voice-auto'); await page.click('#start'); await sleep(300);
    // 교실 단추가 교실 안·판 밖에 있고 이름표가 겹치지 않는지, 쪽지가 있으면 판 안에 다 보이는지(안쪽 스크롤 없음)
    const inspect = (stamp) => page.evaluate(() => {
      const doc = document.documentElement, scene = document.querySelector('.scene').getBoundingClientRect(), sheet = document.querySelector('#sheet').getBoundingClientRect(), bad = [];
      if (doc.scrollHeight > innerHeight + 1 || doc.scrollWidth > innerWidth + 1) bad.push(`스크롤 ${doc.scrollWidth}×${doc.scrollHeight}`);
      const meet = (a, b, m = 1) => a.left < b.right - m && a.right > b.left + m && a.top < b.bottom - m && a.bottom > b.top + m;
      const tags = [];
      for (const n of document.querySelectorAll('[data-actor],[data-object],[data-destination]')) {
        const b = n.getBoundingClientRect(), id = n.dataset.actor || n.dataset.object || n.dataset.destination;
        if (b.left < scene.left - 1 || b.right > scene.right + 1 || b.top < scene.top - 1 || b.bottom > scene.bottom + 1) bad.push(`교실 밖 ${id}`);
        if (meet(b, sheet)) bad.push(`판에 가림 ${id}`);
        const t = n.querySelector(':scope > .name'); if (!t) continue;
        const r = t.getBoundingClientRect(); tags.push([id, r]);
        // 이름표 가운데를 누르면 그 단추가 눌린다(다른 단추가 덮으면 탭이 막힌다)
        const owner = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-actor],[data-object],[data-destination]');
        if (owner !== n) bad.push(`덮인 이름표 ${id}←${owner?.dataset.id || '없음'}`);
      }
      for (let a = 0; a < tags.length; a++) for (let c = a + 1; c < tags.length; c++) if (meet(tags[a][1], tags[c][1], 2)) bad.push(`겹친 이름표 ${tags[a][0]}/${tags[c][0]}`);
      const note = document.querySelector('#note'), mid = document.querySelector('#ask-middle');
      if (!note.hidden && !document.querySelector('#ask').hidden) {
        const n = note.getBoundingClientRect(), m = mid.getBoundingClientRect();
        if (mid.scrollHeight > mid.clientHeight + 1 || n.top < m.top - 1 || n.bottom > m.bottom + 1) bad.push(`쪽지 잘림(${note.className}) ${mid.scrollHeight}/${mid.clientHeight}`);
      }
      return { bad, layout: window.__story.geometry()?.layout };
    }).then((r) => { if (r.bad.length) out.fails.push(`${key} ${width}×${height} ${stamp}: ${r.bad.join(', ')}`); return r; });
    const click = (q) => page.evaluate((sel) => document.querySelector(sel).click(), q);
    // 움직임 줄이기에서는 모든 전환이 0.01ms라 바꾼 자리가 몇 프레임 늦게 그려진다(헤드리스 실측) → 두 프레임 + 150ms 뒤 잰다
    const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))));
    const seen = new Set(); let moves = 0;
    for (let i = 0; i < 80; i++) {
      const s = await page.evaluate(() => window.__story.state());
      if (s.screen === 'results') break;
      if (['play', 'review'].includes(s.phase)) {
        const stamp = `${s.phase}${s.act}:${s.completed.length}`;
        if (!seen.has(stamp)) {
          seen.add(stamp);
          const r = await inspect(stamp);
          if (!out.notes.some((n) => n.startsWith(key))) out.notes.push(`${key} ${width}×${height}: 배치 ${r.layout}`);
          if (s.completed.length === 4 && s.phase === 'play') { const f = `sweep_${key}.png`; await page.screenshot({ path: path.join(OUT, f) }); out.shots.push(f); }
          if (stamp === 'play0:0') {
            // 1장에서 한 번 틀리고(종이 → 쓰레기통) 쪽지·힌트·되돌림 쪽지가 판에 다 보이는지
            await click('[data-actor="kkamong"]'); await click('[data-object="paper"]'); await click('[data-destination="bin"]');
            await page.waitForFunction(() => !window.__story.state().busy); await settle();
            await inspect('틀림 쪽지'); const f = `sweep_${key}_wrong.png`; await page.screenshot({ path: path.join(OUT, f) }); out.shots.push(f);
            await click('#hint'); await settle(); await inspect('힌트 쪽지');
            await click('#undo'); await settle(); await inspect('되돌림 쪽지');
          }
        }
        await page.evaluate(() => window.__story.solve()); moves++;
        await page.waitForFunction(() => !window.__story.state().busy); await settle();
        if (['play', 'review'].includes((await page.evaluate(() => window.__story.state())).phase)) await inspect(`맞음 쪽지 ${moves}`);
      } else await page.evaluate(() => window.__story.advance());
      await sleep(30);
    }
    const end = await page.evaluate(() => ({ screen: window.__story.state().screen, wide: document.documentElement.scrollWidth > innerWidth + 1 }));
    if (end.screen !== 'results' || end.wide) out.fails.push(`${key}: 결과까지 못 감 또는 가로 넘침 ${JSON.stringify(end)} (옮기기 ${moves})`);
    await ctx.close();
  }
  return out;
}

(async () => {
  const pick = process.argv[2];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const all = [];
  if (pick === 'sweep') {
    const r = await runSweep(browser); all.push(r);
    console.log(`\n■ sweep: ${r.fails.length ? `문제 ${r.fails.length}` : '통과'} · 콘솔 오류 ${r.errors.length}`);
    for (const f of r.fails) console.log('  ✗', f);
    for (const e of r.errors.slice(0, 5)) console.log('  ! ', e);
    for (const n of r.notes) console.log('  ·', n);
    await browser.close();
    process.exit(r.fails.length || r.errors.length ? 1 : 0);
  }
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
