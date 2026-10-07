'use strict';
// 바람길 한 판을 처음부터 결과·듣기 확인까지 실제로 달린다(헤드리스 크롬, 실제 WebGL·실제 MP3).
// 기다림만 줄인다: ?qa 훅이 게임 시간을 빨리 감고(같은 0.05초 걸음으로 나눈다), 부탁마다 계획대로 움직인다(ok·text·miss).
// 입력은 키·단추와 같은 길(action)로 넣고, 글로 보기·멈춤·이어 하기·움직이기 단추·듣기 확인의 보기는 진짜로 누른다.
// 화면마다(컴퓨터·휴대폰·320px·움직임 줄이기) 장면을 찍고, 몽글이 달리는 쪽을 보는지(흐름 표본), 쪽 넘김·가로 넘침,
// 단추·위 막대가 화면 안인지, 3D가 실제로 그려지는지, 결과의 공통 코인 줄, 학습 기록, 콘솔 오류를 확인한다.
// 그 밖의 장면: voicefail(목소리를 받을 수 없으면 달리기를 시작하지 않고 다시 준비 창을 띄운다).
// 쓰는 법: 정적 서버로 experiences/를 띄운 뒤  node experiences/korean-runner/qa/play.cjs [desktop|phone|small|reduced|voicefail]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.RUNNER_URL || 'http://127.0.0.1:5271/korean-runner/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, ...PHONE },
  small: { viewport: { width: 320, height: 568 }, ...PHONE },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TEXT_AT = 2, MISS_AT = 3, FAST = 2.5;   // 셋째 부탁은 글로 보고 해내고, 넷째 부탁은 놓친다. 나머지는 해낸다

async function run(browser, name, view) {
  const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = [], shots = [], notes = [], fails = [];
  const touch = !!view.hasTouch;
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (label, opts = {}) => { const f = `play_${name}_${String(shots.length).padStart(2, '0')}_${label}.png`; await page.screenshot({ path: path.join(OUT, f), ...opts }); shots.push(f); };
  const S = () => page.evaluate(() => window.__runner.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  async function waitFor(pred, what, { timeout = 30000, every = 40 } = {}) {
    const t0 = Date.now(); let s = null;
    while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(every); }
    throw new Error(`${name}: 기다림 초과 — ${what} ${JSON.stringify(s && { screen: s.screen, d: Math.round(s.distance), cur: s.current, card: s.card })}`);
  }
  const press = async (sel) => { if (touch) await page.tap(sel); else await page.click(sel); };
  // 넘침: 가로 스크롤·휴대폰 축소(innerWidth > visualViewport.width)·쪽 넘김, 보이는 판이 화면 밖으로 나가는지
  async function fit(label, panels = [], { noScroll = false } = {}) {
    const r = await page.evaluate((sels) => {
      const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
      const outOf = sels.map((q) => { const n = document.querySelector(q); if (!n || n.hidden) return null; const b = n.getBoundingClientRect();
        return b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1 ? `${q} ${Math.round(b.left)},${Math.round(b.top)}~${Math.round(b.right)},${Math.round(b.bottom)} (화면 ${Math.round(vw)}×${Math.round(vh)})` : null; }).filter(Boolean);
      const se = document.scrollingElement;
      return { zoomed: innerWidth > vw + 1, wide: se.scrollWidth > innerWidth + 1, tall: se.scrollHeight > innerHeight + 1, scrolled: scrollY, outOf };
    }, panels);
    check(!r.zoomed && !r.wide, `${label}: 가로 넘침/축소 ${JSON.stringify(r)}`);
    if (noScroll) check(!r.tall && r.scrolled === 0, `${label}: 게임 화면이 쪽으로 넘침 ${JSON.stringify(r)}`);
    check(!r.outOf.length, `${label}: 화면 밖 ${r.outOf.join(' | ')}`);
  }
  // 글자 크기 11px 이상(보이는 글자만)
  async function smallText(label) {
    const tiny = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((n) => {
      if (!n.childNodes.length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return false;
      const b = n.getBoundingClientRect(); if (!b.width || !b.height) return false;
      const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none' || n.closest('[hidden]') || n.closest('.sr')) return false;
      return parseFloat(cs.fontSize) < 11;
    }).map((n) => `${n.tagName}.${n.className}:${getComputedStyle(n).fontSize}`).slice(0, 5));
    check(!tiny.length, `${label}: 11px보다 작은 글자 ${tiny.join(', ')}`);
  }

  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#start'); await sleep(1200);
  await fit('입구(시작 단추가 첫 화면에)', ['#start']); await smallText('입구'); await shot('lobby');
  const coin0 = await page.evaluate(() => { const line = document.querySelector('#lobby .synk-collection-line'); return { shown: !!line && !line.hidden && line.getBoundingClientRect().height > 0,
    text: line?.querySelector('[data-collection-balance]')?.textContent, href: line?.querySelector('[data-collection-garage]')?.getAttribute('href'), want: window.SynkPlayCollection?.garageHref }; });
  check(coin0.shown && coin0.text === '보유 0코인', `입구의 공통 코인 줄 ${JSON.stringify(coin0)}`);
  check(coin0.href === coin0.want, `차고 링크 ${coin0.href}`);

  // ── 한 판 ──
  // 점수 글자(#pop)는 0.9초만 떠 있다: 뜰 때마다 화면 안에서 글·그때 카드 단계·자리를 적어 둔다(찍는 데 걸리는 시간과 상관없이 보려고)
  await page.evaluate(() => {
    const p = document.querySelector('#pop'); window.__qaPops = [];
    new MutationObserver(() => {
      if (p.hidden) return;
      const x = parseFloat(p.style.left), y = parseFloat(p.style.top);
      window.__qaPops.push({ text: p.textContent, phase: document.querySelector('#say').dataset.phase, x, y, inside: x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight });
    }).observe(p, { attributes: true, attributeFilter: ['hidden', 'class'], childList: true, characterData: true, subtree: true });
  });
  const t0 = Date.now();
  await press('#start');
  await waitFor((s) => s.running && s.screen === 'game', '달리기 시작');
  notes.push(`시작 단추 → 달리기 ${((Date.now() - t0) / 1000).toFixed(1)}초(목소리 16개·3D 준비 포함)`);
  await page.evaluate(([text, miss]) => { const plan = []; plan[text] = 'text'; plan[miss] = 'miss'; window.__runner.plan(plan); window.__runner.auto(true); window.__runner.fast(1); }, [TEXT_AT, MISS_AT]);
  // 첫 부탁: 바람이 말하는 중
  let s = await waitFor((x) => x.current && x.card?.phase === 'listening', '첫 부탁을 듣는 중');
  await sleep(350); await fit('달리기(첫 부탁)', ['#moves', '.hud', '#say', '#pause-button'], { noScroll: true }); await smallText('달리기'); await shot('running_instruction');
  check(s.card.line === '잘 들어 보세요' && !s.card.texted, `듣는 중 카드 ${JSON.stringify(s.card)}`);
  const said = await page.evaluate(() => document.querySelector('#say').textContent);
  check(!said.includes(s.current.text), '듣는 중에는 부탁의 글을 보이지 않는다');
  // 3D가 실제로 그려지고, 몽글은 달리는 쪽을 보며, 길·풍경·표시선은 같은 거리만큼 +Z로 온다
  const sample = await page.evaluate(() => window.__runner.sample());
  check(sample && sample.drawn > sample.n * 0.4 && sample.colors > 10, `3D 그림이 비었음 ${JSON.stringify(sample)}`);
  const m1 = await page.evaluate(() => window.__runner.motion()); await sleep(400); const m2 = await page.evaluate(() => window.__runner.motion());
  const dd = m2.distance - m1.distance, wrap = (v, L) => ((v % L) + L) % L;
  check(dd > 1, `거리가 늘지 않음 ${dd}`);
  check(m2.forward.z < -0.9, `몽글이 달리는 쪽(-Z)을 보지 않음 ${JSON.stringify(m2.forward)}`);
  check(Math.abs(wrap(m2.roadTexelZ - m1.roadTexelZ, m2.roadMeters) - wrap(dd, m2.roadMeters)) < 0.02, `길 결 흐름 ${m2.roadTexelZ - m1.roadTexelZ} vs ${dd}`);
  check(Math.abs(wrap(m2.sceneryZ[3] - m1.sceneryZ[3], m2.loop) - wrap(dd, m2.loop)) < 0.02, `풍경 흐름 ${m2.sceneryZ[3] - m1.sceneryZ[3]} vs ${dd}`);
  if (m1.event && m2.event && m1.event.d === m2.event.d) check(Math.abs((m2.event.z - m1.event.z) - dd) < 0.02, `표시선 흐름 ${m2.event.z - m1.event.z} vs ${dd}`);
  notes.push(`흐름 표본: ${dd.toFixed(2)}m 달리는 동안 길 결·풍경·표시선 모두 +Z로 같은 거리, 몽글 정면 z=${m2.forward.z.toFixed(3)} · 그림 칸 ${sample.drawn}/${sample.n}·색 ${sample.colors}`);

  // 첫 부탁 해냄: 카드에 펠트 체크 + ‘좋아요!’ — 점수 글자는 지금 떠 있는지가 아니라 뜰 때 적어 둔 기록으로 본다(기록이 늦으면 1.5초까지 기다린다)
  s = await waitFor((x) => x.card?.phase === 'done', '첫 부탁 해냄');
  await sleep(160); await shot('success');
  const popOk = await page.waitForFunction(() => window.__qaPops[0], null, { timeout: 1500 }).then((h) => h.jsonValue()).catch(() => null);
  check(popOk && popOk.text.startsWith('좋아요') && popOk.phase === 'done' && popOk.inside, `해냄 점수 글자 ${JSON.stringify(popOk)}`);

  // 움직이기 입력: 부탁 사이에 실제 키(컴퓨터)·펠트 단추(휴대폰)로 길을 바꾼다
  await page.evaluate(() => window.__runner.auto(false));
  const lane0 = (await S()).lane, first = lane0 === 0 ? 'right' : 'left';
  if (touch) await page.tap(`.move[data-action="${first}"]`); else await page.keyboard.press(first === 'left' ? 'ArrowLeft' : 'ArrowRight');
  await sleep(150); const lane1 = (await S()).lane;
  check(lane1 === lane0 + (first === 'left' ? -1 : 1), `${touch ? '펠트 단추' : '키'}로 길 바꾸기 ${lane0}→${lane1}`);
  if (touch) await page.tap(`.move[data-action="${first === 'left' ? 'right' : 'left'}"]`); else await page.keyboard.press(first === 'left' ? 'ArrowRight' : 'ArrowLeft');
  await sleep(150); check((await S()).lane === lane0, '되돌아오기');
  await page.evaluate((k) => { window.__runner.auto(true); window.__runner.fast(k); }, FAST);

  // 셋째 부탁: 글로 보기(진짜로 누름) → 그 부탁의 글이 카드에, 도움으로 남는다
  s = await waitFor((x) => x.current?.index === TEXT_AT, '글로 볼 부탁');
  await page.evaluate(() => window.__runner.fast(1));
  await waitFor((x) => x.card && !x.card.texted && ['listening', 'move'].includes(x.card.phase), '글로 보기 단추');
  await press('#say-text'); await sleep(200);
  s = await S();
  check(s.current?.texted && s.card?.texted && s.card.line.includes(s.current.text), `글로 보기: 부탁의 글 ${JSON.stringify(s.card)}`);
  check(!(await page.evaluate(() => !document.querySelector('#say-text').hidden)), '글로 본 뒤에는 단추를 거둔다');
  await fit('글로 보기', ['#say', '#moves'], { noScroll: true }); await shot('text_help');
  // 넷째 부탁: 놓침 → 무엇을 부탁했는지 종이 쪽지(빨간 X 없음)
  s = await waitFor((x) => x.current?.index === MISS_AT, '놓칠 부탁');
  const missText = s.current.text;
  s = await waitFor((x) => x.card?.phase === 'missed', '놓친 부탁 쪽지');
  await sleep(150); await fit('놓친 부탁', ['#say'], { noScroll: true }); await shot('miss_note');
  check(s.card.line.includes(missText) && /동작|가까이/.test(s.card.hint), `놓친 부탁 쪽지 ${JSON.stringify(s.card)}`);
  // 멈춤: 시간·목소리가 함께 멈추고, 이어 하면 그대로 이어진다
  await page.evaluate(() => window.__runner.fast(1));
  await press('#pause-button'); await sleep(250);
  check(await page.evaluate(() => document.querySelector('#pause-dialog').open), '멈춤 창');
  const e0 = (await S()).elapsed; await sleep(700); const e1 = (await S()).elapsed;
  check(e1 === e0, `멈춘 동안 시간이 흐름 ${e0}→${e1}`);
  await fit('멈춤', ['#pause-dialog']); await shot('pause');
  await press('#resume'); await sleep(200);
  check(!(await S()).paused, '이어 하기');
  await page.evaluate((k) => window.__runner.fast(k), FAST);

  // ── 결과 ──
  await waitFor((x) => x.screen === 'results', '결과 화면', { timeout: 120000, every: 120 });
  await sleep(1500);
  await fit('결과', []); await smallText('결과'); await shot('results'); await shot('results_full', { fullPage: true });
  const fin = await S();
  const res = await page.evaluate(() => ({ correct: +document.querySelector('#r-correct').textContent, total: +document.querySelector('#r-total').textContent,
    title: document.querySelector('#r-title').textContent, stars: document.querySelectorAll('#r-stars i.on').length, note: document.querySelector('#r-note').textContent,
    log: [...document.querySelectorAll('#r-log li')].map((li) => ({ cls: li.className, text: li.innerText.replace(/\s+/g, ' ') })),
    skills: [...document.querySelectorAll('#r-skills li')].map((li) => li.innerText.replace(/\s+/g, ' ')),
    coins: document.querySelector('#r-coins').textContent, coinShown: !document.querySelector('#results .synk-collection-line').hidden,
    wallet: JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null') }));
  const total = fin.answers.length, correct = fin.answers.filter((a) => a.correct).length;
  check(fin.reason === 'tour' && res.title === '도착!', `90초 완주 ${fin.reason} ${res.title}`);
  check(res.correct === correct && res.total === total && total >= 7, `결과 숫자 ${res.correct}/${res.total} (기록 ${correct}/${total})`);
  check(correct === total - 1, `계획대로: 하나만 놓침 (${correct}/${total} ${fin.answers.map((a) => (a.correct ? 'o' : 'x')).join('')})`);
  check(res.log.length === total && res.log.filter((l) => l.cls === 'ko').length === 1, `부탁 목록 ${res.log.map((l) => l.cls).join(',')}`);
  check(res.log.filter((l) => l.text.includes('글로 봄')).length === 1, '글로 본 부탁 하나가 목록에 표시');
  check(fin.answers.filter((a) => a.texted).length === 1, '글로 본 부탁 기록');
  const want = 15 + Math.round(10 * correct / total);
  check(res.coinShown && (res.coins === `공통 코인 +${want} · 보유 ${want}` || res.coins.includes('10회분')), `결과의 공통 코인 ${res.coins} (기대 +${want})`);
  const paid = Object.keys(res.wallet?.rewardedRounds || {});
  check(res.wallet?.coins === want && paid.length === 1 && paid[0].startsWith('runner:'), `공통 지갑 ${JSON.stringify({ coins: res.wallet?.coins, paid })}`);
  check(res.skills.length === 3, `듣기 능력 줄 ${res.skills.length}`);
  notes.push(`결과: ${res.title} ${res.correct}/${res.total} · 별 ${res.stars} · ${res.note} · ${res.coins}`);
  notes.push(`부탁 흐름: ${fin.answers.map((a) => `${a.id}${a.correct ? '' : '✗'}${a.texted ? '(글)' : ''}`).join(' · ')}`);
  // 학습 기록: 달리기 동작은 모두 ‘평가하지 않음’, 글로 본 부탁은 도움
  const sum = await page.evaluate(() => window.__runner.summary());
  check(sum && sum.independent === 0, `달리기 동작이 혼자 해낸 듣기 기록이 됨 ${sum?.independent}`);
  check((sum?.counts?.unassessed || 0) >= total, `평가하지 않음 기록 ${sum?.counts?.unassessed} < ${total}`);
  // 다시 듣기: 그 부탁의 MP3
  await page.click('#r-log li:first-child .say-again'); await sleep(450);
  const v = (await S()).voice;
  check(v && v.id === fin.answers[0].id, `결과의 다시 듣기 ${JSON.stringify(v)}`);

  // ── 듣기 확인(달린 뒤): 끝까지 들은 뒤에만 고를 수 있고, 맞힘·틀림·맞힘 ──
  await page.click('#result-listening-check');
  await page.waitForFunction(() => document.querySelector('#listening-check-dialog').open);
  for (let q = 0; q < 3; q++) {
    const locked = await page.evaluate(() => [...document.querySelectorAll('#check-choices button')].every((b) => b.disabled));
    check(locked, `듣기 확인 ${q + 1}: 끝까지 듣기 전에 고를 수 없다`);
    await page.waitForFunction(() => !!document.querySelector('#check-choices button:not(:disabled)'), null, { timeout: 20000 });
    if (q === 0) { await sleep(150); await fit('듣기 확인', ['#listening-check-dialog', '#check-next']); await smallText('듣기 확인'); await shot('check_question'); }
    // 판 안에서도 옆으로 넘치지 않는다(WORLD 확인 도구의 runner-dialog-fits-mobile과 같은 잣대) · 보기 카드가 판 안에 든다
    const inner = await page.evaluate(() => { const d = document.querySelector('#listening-check-dialog'), r = d.getBoundingClientRect();
      return { sw: d.scrollWidth, cw: d.clientWidth, sl: d.scrollLeft, cards: [...d.querySelectorAll('#check-choices button')].map((b) => { const c = b.getBoundingClientRect(); return c.left >= r.left - 1 && c.right <= r.right + 1; }) }; });
    check(inner.sw <= inner.cw + 2 && inner.sl === 0 && inner.cards.every(Boolean), `듣기 확인 ${q + 1}: 판 안 가로 넘침 ${JSON.stringify(inner)}`);
    const st = await page.evaluate(() => window.__runner.check());
    const pick = q === 1 ? (st.correct + 1) % 3 : st.correct;
    await page.click(`#check-choices button:nth-child(${pick + 1})`); await sleep(200);
    const fb = await page.evaluate(() => ({ text: document.querySelector('#check-feedback').textContent, right: document.querySelectorAll('#check-choices .right').length, chosen: document.querySelectorAll('#check-choices .chosen').length,
      next: document.querySelector('#check-next span').textContent }));
    check(fb.right === 1 && fb.chosen === 1 && fb.text.startsWith(q === 1 ? '다시 확인해요.' : '맞았어요.') && fb.text.includes('혼자 답한 기록'), `듣기 확인 ${q + 1} 피드백 ${JSON.stringify(fb)}`);
    if (q === 0) { await fit('듣기 확인 답', ['#listening-check-dialog']); await shot('check_answered'); }
    if (q === 2) { check(fb.next === '확인 마치기' && fb.text.includes('3문제 중 2문제'), `마지막 문제 ${JSON.stringify(fb)}`); await shot('check_done'); }
    await page.click('#check-next'); await sleep(200);
  }
  check(!(await page.evaluate(() => document.querySelector('#listening-check-dialog').open)), '듣기 확인을 마치면 판이 닫힌다');
  const sum2 = await page.evaluate(() => window.__runner.summary());
  check(sum2.independent === 3, `듣기 확인 셋이 혼자 해낸 듣기 기록 ${sum2.independent}`);
  const skills2 = await page.evaluate(() => [...document.querySelectorAll('#r-skills li')].map((li) => li.innerText.replace(/\s+/g, ' ')));
  notes.push(`듣기 능력 줄(확인 전): ${res.skills.join(' / ')}`);

  // 처음으로 → 입구 잔액·최고 거리
  await page.click('#result-home'); await page.waitForSelector('#lobby:not([hidden])'); await sleep(400);
  const lobby = await page.evaluate(() => ({ coins: document.querySelector('#lobby [data-collection-balance]').textContent, best: document.querySelector('#best-line').hidden ? '' : document.querySelector('#best-line').textContent }));
  check(lobby.coins === `보유 ${want}코인`, `입구 코인 잔액 ${lobby.coins}`);
  check(/^최고 거리 [\d,]+m$/.test(lobby.best), `입구 최고 거리 ${lobby.best}`);
  // 그만둔 판은 코인을 받지 않는다
  await press('#start'); await waitFor((x) => x.running, '둘째 판');
  await sleep(600); await press('#pause-button'); await sleep(250); await press('#back-home'); await sleep(400);
  const wallet2 = await page.evaluate(() => JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'));
  check(wallet2?.coins === want && Object.keys(wallet2.rewardedRounds || {}).length === 1, `그만둔 판에 코인 ${wallet2?.coins}`);
  check(await page.evaluate(() => !document.querySelector('#lobby').hidden), '그만두면 입구로');
  await ctx.close();
  return { name, errors, fails, notes, shots };
}

/** 목소리를 받을 수 없으면(MP3가 없음) 달리기를 시작하지 않고 ‘소리 다시 준비하기’ 창을 띄운다(읽기로 바꾸지 않는다). */
async function runVoiceFail(browser) {
  const ctx = await browser.newContext(VIEWS.phone), page = await ctx.newPage(), errors = [], shots = [], notes = [], fails = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const check = (ok, what) => { if (!ok) fails.push(what); };
  await page.route('**/assets/voice/*.mp3', (route) => route.abort());
  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#start'); await sleep(800);
  await page.tap('#start');
  await page.waitForFunction(() => document.querySelector('#audio-dialog').open, null, { timeout: 20000 });
  const s = await page.evaluate(() => window.__runner.state());
  check(!s.running && !s.current, `목소리 없이 달리기가 시작됨 ${JSON.stringify({ running: s.running })}`);
  await page.screenshot({ path: path.join(OUT, 'play_voicefail_00_dialog.png') }); shots.push('play_voicefail_00_dialog.png');
  await page.unroute('**/assets/voice/*.mp3');
  await page.tap('#audio-retry');
  await page.waitForFunction(() => window.__runner.state().running, null, { timeout: 20000 });
  check(!(await page.evaluate(() => document.querySelector('#audio-dialog').open)), '다시 준비하면 창이 닫히고 달린다');
  notes.push('MP3를 막으면 시작하지 않고 다시 준비 창 → 막은 것을 풀고 다시 준비하면 달린다');
  await ctx.close();
  return { name: 'voicefail', errors, fails, notes, shots };
}

(async () => {
  const pick = process.argv[2];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  const all = [];
  const scenes = [...Object.entries(VIEWS).map(([name, view]) => [name, (b) => run(b, name, view)]), ['voicefail', runVoiceFail]];
  for (const [name, scene] of scenes) {
    if (pick && pick !== name) continue;
    const t = Date.now();
    try { const r = await scene(browser); r.sec = Math.round((Date.now() - t) / 1000); all.push(r); }
    catch (e) { all.push({ name, errors: [], fails: [String(e.message || e)], notes: [], shots: [] }); }
    const r = all[all.length - 1];
    console.log(`\n■ ${name}${r.sec ? ` (${r.sec}초)` : ''}: ${r.fails.length ? `문제 ${r.fails.length}` : '통과'} · 콘솔 오류 ${r.errors.length}`);
    for (const f of r.fails) console.log('  ✗', f);
    for (const e of r.errors.slice(0, 5)) console.log('  ! ', e);
    for (const n of r.notes) console.log('  ·', n);
  }
  await browser.close();
  if (!pick) fs.writeFileSync(path.join(__dirname, 'play-results.json'), JSON.stringify(all, null, 2) + '\n');
  process.exit(all.some((r) => r.fails.length || r.errors.length) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
