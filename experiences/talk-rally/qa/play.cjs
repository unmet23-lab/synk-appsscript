'use strict';
// 말 랠리 한 판을 처음부터 결과까지 실제로 친다(헤드리스 크롬, 진짜 시간·진짜 음성).
// 순서: 연습 → 맞힘 셋(세 번째 스매시) → 틀림(해설) → 기다리기(공이 라켓 앞에서 멈춰 기다림·다시 듣기·글로 보기 → 고르면 받아침) → 위로 긋기 → 숫자 키
// → 말하는 중 멈춤·이어 하기 → 나머지 맞힘 → 결과 → 처음으로. 공은 고를 때까지 기다려 준다(10-03 「공이 기다려 줘요」).
// 화면마다(컴퓨터·휴대폰·320px·움직임 줄이기) 장면을 찍고, 점수·랠리·스매시·학습 기록·저장·넘침·콘솔 오류를 확인한다.
// 그 밖의 장면: mute(소리를 끈 채 — 말이 글로, 평가하지 않음) · stall(소리 장치가 도중에 멈춤 — 멈춰 있지 않고 글로 보여 준 뒤 공을 침).
// 쓰는 법: node experiences/talk-rally/server.mjs 를 켠 뒤  node experiences/talk-rally/qa/play.cjs [desktop|phone|small|reduced|mute|stall]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.RALLY_URL || 'http://127.0.0.1:5221/';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, ...PHONE },
  small: { viewport: { width: 320, height: 568 }, ...PHONE },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 한 판 계획(본판 12개). ok=맞는 카드, wrong=틀린 카드, wait=공이 기다릴 때까지 고르지 않음. how: tap(카드 누르기)·swipe(위로 긋기)·key(숫자 키)
const PLAN = [
  { act: 'ok', how: 'tap', when: 'flight' }, { act: 'ok', how: 'tap', when: 'flight', fps: true }, { act: 'ok', how: 'tap', when: 'flight', shot: 'smash' },
  { act: 'wrong', how: 'tap', when: 'flight' }, { act: 'wait' },
  { act: 'ok', how: 'swipe', when: 'flight' }, { act: 'ok', how: 'key', when: 'talk' }, { act: 'ok', how: 'tap', when: 'flight', pause: true },
  { act: 'ok', how: 'tap', when: 'talk' }, { act: 'ok', how: 'tap', when: 'flight', shot: 'smash2' }, { act: 'ok', how: 'tap', when: 'flight' }, { act: 'ok', how: 'tap', when: 'flight' },
];
// 기대값: 맞힘 11 · 틀림 1. 랠리 1-2-3(스매시) / 끊김 / 1~8(3·6번째 스매시). 기다린 1개만 ‘빠르게!’(+50)가 없다
// → (150 + 170 + 240) + (100 + 170 + 240 + 210 + 230 + 300 + 250 + 250) = 560 + 1750
// 공통 코인: 끝까지 마친 판에 완주 15 + 정답 비율 × 10(반올림) → 11/12는 15 + 9 = 24
const EXPECT = { correct: 11, total: 12, stars: 2, bestRally: 8, score: 2310, smashAt: [2, 6, 9], quick: 10, coins: 24 };

async function run(browser, name, view) {
  const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = [], shots = [], notes = [], fails = [], sounds = [];
  const takeSounds = async () => { sounds.push(...await page.evaluate(() => window.__rally.sound.take())); return sounds; };
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (label, opts = {}) => { const f = `play_${name}_${String(shots.length).padStart(2, '0')}_${label}.png`; await page.screenshot({ path: path.join(OUT, f), ...opts }); shots.push(f); };
  const S = () => page.evaluate(() => window.__rally.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  async function waitFor(pred, what, { timeout = 20000, every = 25 } = {}) {
    const t0 = Date.now(); let s = null;
    while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(every); }
    throw new Error(`${name}: 기다림 초과 — ${what} ${JSON.stringify(s && { index: s.index, practice: s.practice, cur: s.cur })}`);
  }
  const visible = (sel) => page.evaluate((q) => { const n = document.querySelector(q); return !!n && !n.hidden && n.getBoundingClientRect().height > 0; }, sel);
  async function waitVisible(sel, timeout = 8000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await visible(sel)) return; await sleep(30); } throw new Error(`${name}: ${sel}가 나오지 않음`); }
  // 넘침: 가로 스크롤·휴대폰 축소(innerWidth > visualViewport.width), 보이는 판이 화면 밖으로 나가는지
  async function fit(label, panels = []) {
    const r = await page.evaluate((sels) => {
      const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
      const outOf = sels.map((q) => { const n = document.querySelector(q); if (!n || n.hidden) return null; const b = n.getBoundingClientRect();
        return b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1 ? `${q} ${Math.round(b.left)},${Math.round(b.top)}~${Math.round(b.right)},${Math.round(b.bottom)} (화면 ${Math.round(vw)}×${Math.round(vh)})` : null; }).filter(Boolean);
      return { zoomed: innerWidth > vw + 1, wide: document.documentElement.scrollWidth > innerWidth + 1, outOf };
    }, panels);
    check(!r.zoomed && !r.wide, `${label}: 가로 넘침/축소 ${JSON.stringify(r)}`);
    check(!r.outOf.length, `${label}: 화면 밖 ${r.outOf.join(' | ')}`);
  }
  async function pickCard(word, how) {
    const s = await S(), lane = s.cur.options.indexOf(word);
    if (how === 'key') await page.keyboard.press(String(lane + 1));
    else if (how === 'swipe') {
      const a = await page.evaluate(() => { const r = document.querySelector('#arena').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.45 }; });
      const dx = [-90, 0, 90][lane];
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + dx * 0.5, a.y - 50, { steps: 3 }); await page.mouse.move(a.x + dx, a.y - 110, { steps: 3 }); await page.mouse.up();
    } else await page.click(`#cards .card.l${lane}`);
    return lane;
  }

  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#btn-start'); await sleep(900);
  // 점수 글자는 0.9초 동안 나타났다 사라진다. 바깥에서 한 번 재면 무거운 실행에서 늦게 재므로, 페이지 안에서 떠 있는 동안 가장 진한 불투명도를 남긴다
  await page.evaluate(() => {
    window.__pops = [];
    const n = document.querySelector('#pop');
    new MutationObserver(() => {
      if (!n.classList.contains('go')) return;
      const rec = { text: n.textContent, kind: n.dataset.kind || '', max: 0 }, t0 = performance.now(); window.__pops.push(rec);
      const f = () => { rec.max = Math.max(rec.max, +getComputedStyle(n).opacity); if (performance.now() - t0 < 900 && !n.hidden) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }).observe(n, { attributes: true, attributeFilter: ['class'] });
  });
  const lastPop = (kind) => page.evaluate((k) => [...window.__pops].reverse().find((r) => r.kind === k) || null, kind);
  await page.evaluate(() => window.__rally.sound.start());
  await fit('입구(시작 단추가 첫 화면에)', ['#btn-start']); await shot('lobby');
  // 공통 코인: 입구에 잔액과 차고 링크(새 브라우저라 0). 공개 주소(/try/…)에서는 레이싱 차고로 이어진다
  const coin0 = await page.evaluate(() => { const line = document.querySelector('#lobby .synk-collection-line'); return { shown: !!line && !line.hidden && line.getBoundingClientRect().height > 0,
    text: line?.querySelector('[data-collection-balance]')?.textContent, href: line?.querySelector('[data-collection-garage]')?.getAttribute('href'), want: window.SynkPlayCollection?.garageHref, path: location.pathname }; });
  check(coin0.shown && coin0.text === '보유 0코인', `입구의 공통 코인 줄 ${JSON.stringify(coin0)}`);
  check(coin0.href === coin0.want && (!coin0.path.startsWith('/try/') || coin0.href === '/try/racing/?garage=1'), `차고 링크 ${coin0.href}`);
  const t0 = Date.now();
  await page.click('#btn-start');

  // 연습: 빛나는 카드만 받는다(다른 카드는 안내만)
  let s = await waitFor((x) => x.practice && x.cur?.phase === 'talk', '연습 시작');
  notes.push(`시작 단추 → 첫 말 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  await shot('practice_talk'); await fit('연습', ['#cards']);
  const hintOk = await page.evaluate(() => { const h = document.querySelector('#cards .card.hint'); return !!h && h.querySelector('.say').textContent; });
  check(hintOk === s.cur.answer, `연습 빛나는 카드 ${hintOk} ≠ ${s.cur.answer}`);
  const wrongWord = s.cur.options.find((w) => w !== s.cur.answer);
  await pickCard(wrongWord, 'tap'); await sleep(150);
  check((await S()).cur.choice == null, '연습에서 틀린 카드가 받아들여짐');
  check((await page.textContent('#tip')).includes('빛나는 카드'), '연습 틀린 카드 안내');
  s = await waitFor((x) => x.cur?.phase === 'flight', '연습 공');
  await pickCard(s.cur.answer, 'tap');
  await waitFor((x) => !x.practice && x.index === 0 && x.cur?.phase === 'talk', '본판 첫 말', { timeout: 25000 });
  check((await page.evaluate(() => window.__rally.progress().practiced)) === true, '연습 기록 저장');

  // 본판 12개
  const flows = [];
  for (let i = 0; i < PLAN.length; i++) {
    const p = PLAN[i];
    s = await waitFor((x) => x.index === i && ['talk', 'flight'].includes(x.cur?.phase), `${i + 1}번째 말`, { timeout: 25000 });
    flows.push((await page.evaluate(() => window.__rally.flow()))?.flight ?? null);
    if (p.pause) {
      s = await waitFor((x) => x.index === i && x.cur?.phase === 'talk', `${i + 1}번째 말하는 중`);
      await page.click('#pause'); await sleep(250);
      check(await page.evaluate(() => document.querySelector('#pause-dialog').open), '멈춤 창');
      await shot('pause');
      await sleep(900);
      check((await S()).cur.phase === 'talk', '멈춘 동안 공이 나가지 않는다');
      await page.click('#resume');
      await sleep(120);
      const voices = (await takeSounds()).filter((e) => e.kind === 'voice' && e.name === s.cur.id).length;
      check(voices === 2, `이어 하면 몽글이 처음부터 다시 말한다(이 말의 음성 ${voices}번)`);
    }
    if (p.act === 'wait') {
      // 고르지 않고 기다린다: 공이 라켓 앞에서 멈춰 기다리고(시간 초과 없음), 위쪽에 안내·다시 듣기·글로 보기가 나온다
      s = await waitFor((x) => x.index === i && x.cur?.waiting, `${i + 1}번째 공이 기다림`, { timeout: 25000 });
      await waitVisible('#wait'); await sleep(1500);
      const still = await S();
      check(still.index === i && still.cur.phase === 'flight' && still.cur.choice == null, `기다리는 동안 공이 넘어감 ${JSON.stringify(still.cur)}`);
      check(await page.evaluate(() => window.__rally.stage().holding()), '공이 라켓 앞에서 기다리지 않음');
      await fit('공이 기다림', ['#wait', '#cards']); await shot('wait');
      await page.click('#wait-replay'); await sleep(300);
      await page.click('#wait-slow');
      let slow = null, waitedMs = 0;
      for (let k = 0; k < 30; k++) { await sleep(50); waitedMs += 50; slow = await page.evaluate(() => window.__rally.sound.slow()); if (slow?.time > 0) break; }
      notes.push(`천천히 듣기: 누른 뒤 ${waitedMs}ms 안에 재생(미리 불러 둠) · ${slow?.rate}배`);
      check(slow && slow.rate === 0.75 && !slow.paused && slow.time > 0, `천천히 듣기(0.75배)가 나오지 않음 ${JSON.stringify(slow)}`);
      await page.click('#wait-text'); await sleep(200);
      check(await visible('#wait-line'), '글로 보기: 몽글의 말이 나옴');
      check(!(await visible('#wait-text')), '글로 본 뒤에는 글로 보기 단추를 거둔다');
      await shot('wait_text');
      const t0 = Date.now();
      await pickCard(still.cur.answer, 'tap');
      await waitFor((x) => (x.index === i && x.cur?.phase !== 'flight') || x.index > i, `${i + 1}번째 기다린 공 받아치기`, { every: 10 });
      const ms = Date.now() - t0;
      notes.push(`기다리던 공: 고른 뒤 받아치기까지 ${ms}ms(누르기 포함)`);
      check(ms < 900, `기다리던 공을 고른 뒤 받아치기가 늦음 ${ms}ms`);
      check(!(await visible('#wait')), '고르면 기다림 안내를 거둔다');
      continue;
    }
    if (p.when === 'flight') s = await waitFor((x) => x.index === i && x.cur?.phase === 'flight', `${i + 1}번째 공`);
    await sleep(p.when === 'flight' ? 260 + (i % 3) * 180 : 80);
    s = await S();
    const word = p.act === 'ok' ? s.cur.answer : s.cur.options.find((w) => w !== s.cur.answer);
    await pickCard(word, p.how);
    if (p.how === 'swipe') {
      const st2 = await page.evaluate(() => window.__rally.stage().strokeInfo());
      check(st2 && st2.ended && st2.ok && st2.n >= 3, `긋기 자국(금빛)이 남지 않음 ${JSON.stringify(st2)}`);
    }
    await sleep(60);
    check((await S()).cur.choice != null, `${i + 1}번째: ${p.how}로 고른 대답이 받아들여지지 않음`);
    if (i === 0) {
      await sleep(200); await shot('chosen'); await fit('카드 고름', ['#cards']);
      await waitFor((x) => x.index > 0 || (x.index === 0 && x.cur?.phase !== 'flight'), '첫 공 받아치기', { every: 10 });
      await sleep(950);
      const pop = await lastPop('quick');
      check(pop && pop.text.startsWith('빠르게!') && pop.max > 0.8, `빠르게 점수 글자(가장 진한 순간) ${JSON.stringify(pop)}`);
    }
    if (p.fps) {
      const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = (now) => { n += 1; if (now - t < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
      notes.push(`공이 나는 동안 초당 그림 ${fps}장(헤드리스)`);
    }
    if (p.shot) {
      await waitFor((x) => x.index === i && x.cur?.phase !== 'flight' && x.cur?.phase !== 'talk', `${i + 1}번째 받아치기`, { every: 10 });
      // 점수 글자가 실제로 보이는지(움직임 줄이기에서도): 페이지 안에서 잰 가장 진한 불투명도
      await sleep(120); await shot(p.shot); await sleep(850);
      const pop = await lastPop('smash');
      check(pop && pop.text.includes('스매시') && pop.max > 0.8, `${i + 1}번째 스매시 점수 글자가 안 보임 ${JSON.stringify(pop)}`);
    }
    if (p.act === 'wrong') {
      await waitVisible('#explain'); await sleep(300);
      await fit('틀림 해설', ['#explain']); await shot('wrong_explain');
      const b0 = (await takeSounds()).length;
      await page.click('#x-replay'); await sleep(250);
      check((await takeSounds()).slice(b0).some((e) => e.kind === 'voice' && e.name === s.cur.id), '해설에서 다시 듣기가 몽글의 말을 틀지 않음');
      check((await page.$$('#cards .card.right')).length === 1 || !(await visible('#cards')), '틀림: 맞는 카드 표시');
      await page.click('#btn-next');
    }
  }

  // 순간 맞춤: 판 내내 살아 있고 배율은 1.3~0.9 안(놓친 뒤에는 느려질 수 있고, 일찍 바르게 받아치면 빨라질 수 있다)
  check(flows.every((f) => typeof f === 'number' && f >= 0.9 && f <= 1.3), `순간 맞춤 배율 ${flows.join(',')}`);
  notes.push(`공이 오는 시간 배율(순간 맞춤, 말마다): ${flows.join(' → ')}`);

  // 결과
  await waitVisible('#results', 30000); await sleep(1300);
  check((await page.evaluate(() => window.__rally.flow())) === null, '결과에서 순간 맞춤을 닫는다');
  await fit('결과', []); await shot('results'); await shot('results_full', { fullPage: true });
  const st = await page.evaluate(() => ({
    correct: +document.querySelector('#r-correct').textContent, total: +document.querySelector('#r-total').textContent,
    stars: document.querySelectorAll('#r-stars i.on').length, note: document.querySelector('#r-note').textContent,
    log: [...document.querySelectorAll('#r-log li')].map((li) => li.className), skills: [...document.querySelectorAll('#r-skills li')].map((li) => li.innerText.replace(/\s+/g, ' ')),
    next: document.querySelector('#r-next-reason').textContent,
  }));
  const fin = await S();
  const sayBtns = await page.$$('#r-log .say-again');
  check(sayBtns.length === 12, `복습 듣기 단추 ${sayBtns.length}개`);
  if (sayBtns.length) {
    const b1 = (await takeSounds()).length;
    await sayBtns[0].click(); await sleep(250);
    check((await takeSounds()).slice(b1).some((e) => e.kind === 'voice' && e.name === fin.results[0]?.itemId), '복습에서 듣기가 그 말을 틀지 않음');
  }
  check(st.correct === EXPECT.correct && st.total === EXPECT.total, `결과 맞힘 ${st.correct}/${st.total}`);
  check(st.stars === EXPECT.stars, `별 ${st.stars}`);
  check(fin.score === EXPECT.score, `점수 ${fin.score} ≠ ${EXPECT.score}`);
  check(st.note.includes(`최고 랠리 ${EXPECT.bestRally}번`) && st.note.includes(`빠른 대답 ${EXPECT.quick}번`) && st.note.includes('다시 듣기·글로 보기를 쓴 말 1개'), `결과 메모 ${st.note}`);
  check(st.log.filter((c) => c === 'ok').length === 11 && st.log.filter((c) => c === 'ko').length === 1, `결과 목록 ${st.log.join(',')}`);
  // 공통 코인: 결과에 받은 코인이 나오고, 지갑에는 이 판 하나만 남는다(연습 공·틀린 답은 따로 세지 않는다)
  const coin = await page.evaluate(() => ({ text: document.querySelector('#r-coins')?.textContent, shown: !document.querySelector('#results .synk-collection-line')?.hidden,
    wallet: JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null') }));
  const paid = Object.keys(coin.wallet?.rewardedRounds || {});
  check(coin.shown && coin.text === `공통 코인 +${EXPECT.coins} · 보유 ${EXPECT.coins}`, `결과의 공통 코인 ${coin.text}`);
  check(coin.wallet?.coins === EXPECT.coins && paid.length === 1 && paid[0].startsWith('talk-rally:'), `공통 지갑 ${JSON.stringify({ coins: coin.wallet?.coins, paid })}`);
  notes.push(`공통 코인: ${coin.text}`);
  const impacts = await page.evaluate(() => window.__rally.impacts());
  const smashIdx = impacts.slice(1).map((x, k) => (x.smash ? k : -1)).filter((k) => k >= 0);   // 첫 번째는 연습
  check(impacts.length === 13, `받아치기 ${impacts.length}번(연습 + 12, 놓침 없음)`);
  check(JSON.stringify(smashIdx) === JSON.stringify(EXPECT.smashAt), `스매시 위치 ${smashIdx}`);
  // 공마다 기다림·빠르게(w=기다린 뒤, q=빠르게, -=그 밖) — 부하로 누르기가 늦어 공이 기다리기 시작하면 여기서 드러난다
  check(impacts.slice(1).filter((x) => x.waited).length === 1, `기다린 뒤 받아친 공은 하나 ${impacts.slice(1).map((x) => (x.waited ? 'w' : x.quick ? 'q' : '-')).join('')}`);
  const prog = await page.evaluate(() => window.__rally.progress());
  check(prog.plays === 1 && prog.practiced && prog.best?.score === EXPECT.score && prog.best?.rally === EXPECT.bestRally, `저장 ${JSON.stringify(prog)}`);
  const sum = await page.evaluate(() => window.__rally.summary());
  const fmt = (id) => { const sk = sum?.skills?.find((x) => x.id === id); return Object.entries(sk?.levels || {}).map(([d, l]) => { const f = l.formats?.['single-choice']; return f ? `난도${d}: ${f.status} n${f.n} 맞${f.correct}${f.assisted ? ` 도움${f.assisted}` : ''}` : `난도${d}: -`; }).join(', '); };
  const nTotal = (sum?.skills || []).filter((x) => x.id.startsWith('ko.listening.')).reduce((a, sk) => a + Object.values(sk.levels || {}).reduce((b, l) => b + (l.formats?.['single-choice']?.n || 0), 0), 0);
  notes.push(`학습 기록 — 세부: ${fmt('ko.listening.detail')} / 핵심: ${fmt('ko.listening.main')}`);
  check(nTotal === 11, `혼자 고른 듣기 응답 수 ${nTotal} ≠ 11(기다리며 다시 듣기·글로 보기를 쓴 1개는 도움 응답)`);
  const stored = await page.evaluate(() => { try { const keys = Object.keys(localStorage).filter((k) => k.startsWith('synk.atlas.learning.v1')), raw = keys.map((k) => localStorage.getItem(k)).join(''); return { keys, bytes: raw.length, mine: (raw.match(/talk-rally\./g) || []).length }; } catch (e) { return String(e); } });
  check(stored.mine > 0, `공통 학습 기록에 말 랠리 문항이 없음 ${JSON.stringify(stored)}`);
  await takeSounds();
  const count = (k, n) => sounds.filter((e) => e.kind === k && e.name === n).length;
  check(!sounds.some((e) => e.kind === 'sfx' && e.name === 'hit' && e.opts?.correct === false && e.opts?.smash), '틀림에 스매시 소리');
  notes.push(`소리: 음성 ${sounds.filter((e) => e.kind === 'voice').length}(연습·12개·멈춤 뒤 다시·다시 듣기·해설·복습) · 천천히 ${sounds.filter((e) => e.kind === 'voice-slow').length} · 획득(빠르게) ${count('kit', 'earn')} · 몽글 침 ${count('sfx', 'opponent')} · 튀김 ${count('sfx', 'bounce')} · 받아치기 ${count('sfx', 'hit')} · 휙 ${count('sfx', 'swing')} · 별 ${count('sfx', 'star')} · 성취 ${count('kit', 'achieve')}`);
  notes.push(`결과 능력 줄: ${st.skills.join(' / ')}`);
  notes.push(`다음 판: ${st.next}`);

  // 처음으로 → 입구에 추천 이유·최고 기록
  await page.click('#r-home'); await waitVisible('#lobby'); await sleep(400);
  const lobby = await page.evaluate(() => ({ reason: document.querySelector('#l-reason').textContent, best: document.querySelector('#best-line').hidden ? '' : document.querySelector('#best-line').textContent,
    coins: document.querySelector('#lobby [data-collection-balance]')?.textContent }));
  check(lobby.best === `최고 ${EXPECT.score}점 · 랠리 ${EXPECT.bestRally}번`, `입구 최고 기록 ${lobby.best}`);
  check(lobby.coins === `보유 ${EXPECT.coins}코인`, `입구 코인 잔액 ${lobby.coins}`);
  notes.push(`둘째 판 입구: ${lobby.reason}`);
  await shot('lobby_again');
  await ctx.close();
  return { name, errors, fails, notes, shots };
}

/** 소리를 끈 채로: 몽글의 말이 글로 나오고(말 길이만큼 읽을 시간), 그 답은 평가하지 않는다. 연습 + 두 개 뒤 멈춤 → 처음으로. */
async function runMute(browser) {
  const ctx = await browser.newContext(VIEWS.phone), page = await ctx.newPage(), errors = [], shots = [], notes = [], fails = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const S = () => page.evaluate(() => window.__rally.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  const waitFor = async (pred, what, timeout = 20000) => { const t0 = Date.now(); let s = null; while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(25); } throw new Error(`mute: 기다림 초과 — ${what}`); };
  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#btn-start'); await sleep(700);
  await page.click('#lobby [data-sound-toggle]');
  check(await page.evaluate(() => !document.querySelector('#sound-note').hidden && localStorage.getItem('synk.talk-rally.sound') === 'off'), '소리 끔 안내·저장');
  await page.click('#btn-start');
  let s = await waitFor((x) => x.practice && x.cur?.phase === 'talk', '연습');
  check((await page.textContent('#tip')).includes('안녕하세요?'), '연습: 몽글의 말이 글로');
  s = await waitFor((x) => x.cur?.phase === 'flight', '연습 공');
  await page.click(`#cards .card.l${s.cur.options.indexOf(s.cur.answer)}`);
  for (let i = 0; i < 2; i++) {
    s = await waitFor((x) => !x.practice && x.index === i && x.cur?.phase === 'talk', `${i + 1}번째 말`);
    const t0 = Date.now(), line = await page.evaluate((id) => import((document.querySelector('script[type="module"][src]')?.src || '').includes('.mjs') ? './content.mjs' : './content.js').then((m) => m.ITEMS.find((x) => x.id === id).line), s.cur.id);
    check((await page.textContent('#tip')) === `몽글: “${line}”`, `${i + 1}번째: 몽글의 말이 글로 ${await page.textContent('#tip')}`);
    if (i === 0) { await page.screenshot({ path: path.join(OUT, 'play_mute_00_text.png') }); shots.push('play_mute_00_text.png'); }
    s = await waitFor((x) => x.cur?.phase === 'flight', `${i + 1}번째 공`);
    notes.push(`‘${line}’(${line.length}자) 읽을 시간 약 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
    await page.click(`#cards .card.l${s.cur.options.indexOf(s.cur.answer)}`);
  }
  await waitFor((x) => x.index === 2 && x.cur?.phase === 'talk', '세 번째 말');
  await page.click('#pause'); await sleep(200); await page.click('#quit'); await sleep(300);
  const sum = await page.evaluate(() => window.__rally.summary());
  const n = (sum?.skills || []).reduce((a, sk) => a + Object.values(sk.levels || {}).reduce((b, l) => b + (l.formats?.['single-choice']?.n || 0), 0), 0);
  check(n === 0, `소리 끔 응답이 혼자 해낸 기록으로 셈 ${n}`);
  const st = await S();
  check(st.results.length === 2 && st.results.every((r) => r.correct === true && r.recorded === false), `소리 끔 결과 ${JSON.stringify(st.results)}`);
  check(await page.evaluate(() => !document.querySelector('#lobby').hidden), '처음으로 돌아옴');
  // 공통 코인: 끝까지 마치지 않고 나가면 받지 않는다
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'));
  check(!wallet || (wallet.coins === 0 && !Object.keys(wallet.rewardedRounds || {}).length), `그만둔 판에 코인 ${JSON.stringify(wallet && { coins: wallet.coins })}`);
  check((await page.textContent('#lobby [data-collection-balance]')) === '보유 0코인', '그만둔 뒤 입구 잔액');
  await ctx.close();
  return { name: 'mute', errors, fails, notes, shots };
}

/**
 * 소리 장치가 도중에 멈춤: 말이 끝났다는 신호가 오지 않아도 몽글의 말에서 멈춰 있지 않는다(audio.mjs VOICE_GUARD).
 * 첫 말은 정상 → 둘째 말 도중 소리 시계를 세운다(말 길이 + 1.5초쯤 뒤 그 말을 글로 보여 주고 공을 친다, 그 답은 평가하지 않는다)
 * → 셋째 말은 소리가 막힌 채라 처음부터 글로 → 소리를 되살리면 넷째 말은 다시 소리로 나오고 앞의 글은 지워진다.
 */
async function runStall(browser) {
  const ctx = await browser.newContext(VIEWS.phone), page = await ctx.newPage(), errors = [], shots = [], notes = [], fails = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // 게임이 쓰는 소리 길(AudioContext)을 잡아 둔다
  await page.addInitScript(() => { const start = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__audio = this.context; return start.apply(this, a); }; });
  const S = () => page.evaluate(() => window.__rally.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  const waitFor = async (pred, what, timeout = 20000) => { const t0 = Date.now(); let s = null; while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(25); } throw new Error(`stall: 기다림 초과 — ${what} ${JSON.stringify(s && { index: s.index, cur: s.cur })}`); };
  const lineOf = (id) => page.evaluate((x) => import((document.querySelector('script[type="module"][src]')?.src || '').includes('.mjs') ? './content.mjs' : './content.js').then((m) => m.ITEMS.find((y) => y.id === x).line), id);
  const tipNow = () => page.evaluate(() => { const n = document.querySelector('#tip'); return n.hidden ? null : n.textContent; });
  const answer = async (s) => page.click(`#cards .card.l${s.cur.options.indexOf(s.cur.answer)}`);
  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#btn-start'); await sleep(700);
  await page.click('#btn-start');
  let s = await waitFor((x) => x.practice && x.cur?.phase === 'flight', '연습 공');
  await answer(s);
  // 1) 첫 말: 소리로 끝까지
  s = await waitFor((x) => !x.practice && x.index === 0 && x.cur?.phase === 'flight', '첫 공', 25000);
  await answer(s);
  // 2) 둘째 말: 말하는 도중 소리 시계가 선다
  s = await waitFor((x) => x.index === 1 && x.cur?.phase === 'talk', '둘째 말');
  const t0 = Date.now(), line2 = await lineOf(s.cur.id);
  check((await tipNow()) === null, `소리로 나오는 말에 글이 보임: ${await tipNow()}`);
  await sleep(250); await page.evaluate(() => window.__audio.suspend());
  s = await waitFor((x) => x.index === 1 && x.cur?.phase === 'flight', '소리가 멈춘 말 뒤의 공(멈춰 있으면 안 된다)', 9000);
  const waited = (Date.now() - t0) / 1000;
  check(waited > 1.5 && waited < 4.2, `멈춘 말을 넘기기까지 ${waited.toFixed(1)}초(말 길이 + 1.5초쯤이어야 함)`);
  check((await tipNow()) === `몽글: “${line2}”`, `멈춘 말을 글로 보여 주지 않음: ${await tipNow()}`);
  notes.push(`소리가 멈춘 말 ‘${line2}’: ${waited.toFixed(1)}초 뒤 글로 보여 주고 공을 침`);
  await page.screenshot({ path: path.join(OUT, 'play_stall_00_text.png') }); shots.push('play_stall_00_text.png');
  await answer(s);
  // 3) 셋째 말: 소리 길이 막힌 채 → 처음부터 글로
  s = await waitFor((x) => x.index === 2 && x.cur?.phase === 'talk', '셋째 말');
  const line3 = await lineOf(s.cur.id);
  check((await tipNow()) === `몽글: “${line3}”`, `소리가 막힌 말이 글로 나오지 않음: ${await tipNow()}`);
  s = await waitFor((x) => x.index === 2 && x.cur?.phase === 'flight', '셋째 공');
  await page.evaluate(() => window.__audio.resume());   // 소리가 돌아온다
  await answer(s);
  // 4) 넷째 말: 다시 소리로, 앞의 글은 지워진다
  s = await waitFor((x) => x.index === 3 && x.cur?.phase === 'talk', '넷째 말');
  await sleep(150);
  check((await tipNow()) === null, `소리가 돌아온 뒤에도 앞의 글이 남음: ${await tipNow()}`);
  s = await waitFor((x) => x.index === 3 && x.cur?.phase === 'flight', '넷째 공');
  await answer(s);
  await waitFor((x) => x.index === 4 && x.cur?.phase === 'talk', '다섯째 말');
  await page.click('#pause'); await sleep(200); await page.click('#quit'); await sleep(300);
  const st = await S();
  check(st.results.length === 4 && st.results.map((r) => r.recorded).join() === 'true,false,false,true', `혼자 들은 답만 기록(1·4번째): ${st.results.map((r) => r.recorded).join()}`);
  check(st.results.map((r) => r.helped).join() === 'false,true,true,false', `글로 본 말은 도움으로: ${st.results.map((r) => r.helped).join()}`);
  const sum = await page.evaluate(() => window.__rally.summary());
  const n = (sum?.skills || []).reduce((a, sk) => a + Object.values(sk.levels || {}).reduce((b, l) => b + (l.formats?.['single-choice']?.n || 0), 0), 0);
  check(n === 2, `혼자 해낸 듣기 응답 수 ${n} ≠ 2`);
  await ctx.close();
  return { name: 'stall', errors, fails, notes, shots };
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
  for (const [name, scene] of [['mute', runMute], ['stall', runStall]]) {
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
  fs.writeFileSync(path.join(__dirname, 'play-results.json'), JSON.stringify(all, null, 2));
  process.exit(all.some((r) => r.fails.length || r.errors.length) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
