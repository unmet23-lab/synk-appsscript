'use strict';
// 말 랠리 네 판을 이어서 친다(헤드리스 크롬, 진짜 시간·진짜 음성). 원고를 늘린 뒤(10-03 26개 → 46개) 새 말이 실제 판에 나오고,
// 처음에 틀린 사람도 다 맞히면 조금 어려운 말로 넘어가는지 본다.
// 1판(처음): 쉬운 말부터 — 이어지는 말은 일부러 틀린다. 2~4판: 아틀라스 필요 순서로 — 모두 맞힌다.
// 확인: 판마다 12개·두 학습 항목 4개 이상씩, 새 말과 조금 어려운 말이 나옴, 2판이 틀린 쪽(이어지는 말)을 앞에 둠,
// 3판 뒤 다음 판 이유가 ‘조금 어려운 이어지는 말’로 넘어가고 4판에 실제로 나옴(쉬운 말이 학습 항목마다 15개라서 — content.mjs),
// 음성 파일 응답이 모두 200, 결과 복습 12줄, 아틀라스 기록 수(서로 다른 말의 혼자 응답), 콘솔 오류 0,
// 공통 코인(판마다 완주 15 + 정답 비율 × 10: 8/12는 22, 다 맞히면 25 → 네 판 97).
// 쓰는 법: node experiences/talk-rally/server.mjs 를 켠 뒤  node experiences/talk-rally/qa/rounds.cjs [desktop|phone]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.RALLY_URL || 'http://127.0.0.1:5221/';
const VIEWS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
// 26개에서 늘린 말(10-03)
const ADDED = ['r07', 'r08', 'r09', 'r10', 'w09', 'w10', 'w11', 'w12', 'w13', 'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23'];
const ROUNDS = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(browser, name) {
  const ctx = await browser.newContext(VIEWS[name]), page = await ctx.newPage(), errors = [], fails = [], voice = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.url().includes('/assets/voice/')) voice.push({ url: r.url().split('/').pop(), status: r.status() }); });
  const S = () => page.evaluate(() => window.__rally.state());
  const check = (ok, what) => { if (!ok) fails.push(what); };
  async function waitFor(pred, what, timeout = 25000) {
    const t0 = Date.now(); let s = null;
    while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) return s; await sleep(25); }
    throw new Error(`${name}: 기다림 초과 — ${what} ${JSON.stringify(s && { index: s.index, practice: s.practice, cur: s.cur })}`);
  }
  const visible = (sel) => page.evaluate((q) => { const n = document.querySelector(q); return !!n && !n.hidden && n.getBoundingClientRect().height > 0; }, sel);
  const items = await (async () => { await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#btn-start'); await sleep(800);
    return page.evaluate(() => import((document.querySelector('script[type="module"][src]')?.src || '').includes('.mjs') ? './content.mjs' : './content.js').then((m) => m.ITEMS.map((x) => ({ id: x.id, kind: x.kind, skill: x.skill, difficulty: x.difficulty })))); })();
  const byId = new Map(items.map((x) => [x.id, x]));
  const t0 = Date.now();
  await page.click('#btn-start');
  // 연습: 빛나는(맞는) 카드
  let s = await waitFor((x) => x.practice && x.cur?.phase === 'talk', '연습');
  await page.evaluate((lane) => window.__rally.choose(lane), s.cur.options.indexOf(s.cur.answer));
  const rounds = [];
  for (let round = 1; round <= ROUNDS; round++) {
    s = await waitFor((x) => !x.practice && x.index === 0 && x.cur?.phase === 'talk' && x.results.length === 0, `${round}판 첫 말`);
    const queue = s.queue;
    for (let i = 0; i < queue.length; i++) {
      s = await waitFor((x) => x.index === i && x.cur && x.cur.choice == null && ['talk', 'flight'].includes(x.cur.phase), `${round}판 ${i + 1}번째 말`);
      const wrong = round === 1 && byId.get(s.cur.id).kind === 'follow';
      const lane = wrong ? s.cur.options.findIndex((o) => o !== s.cur.answer) : s.cur.options.indexOf(s.cur.answer);
      await page.evaluate((l) => window.__rally.choose(l), lane);
      if (wrong) {
        const t1 = Date.now(); while (!(await visible('#explain'))) { if (Date.now() - t1 > 15000) throw new Error(`${name}: 해설이 안 나옴 ${s.cur.id}`); await sleep(30); }
        await sleep(200); await page.click('#btn-next');
      }
    }
    const t1 = Date.now(); while (!(await visible('#results'))) { if (Date.now() - t1 > 30000) throw new Error(`${name}: ${round}판 결과가 안 나옴`); await sleep(50); }
    await sleep(600);
    const end = await S();
    const log = await page.evaluate(() => ({ rows: document.querySelectorAll('#r-log li').length, listen: document.querySelectorAll('#r-log .say-again').length,
      next: document.querySelector('#r-next-reason').textContent, correct: document.querySelector('#r-correct').textContent, coins: document.querySelector('#r-coins')?.textContent }));
    const kinds = queue.map((id) => byId.get(id));
    const skills = kinds.reduce((m, x) => (m[x.skill] = (m[x.skill] || 0) + 1, m), {});
    check(queue.length === 12 && new Set(queue).size === 12, `${round}판 12개 서로 다름 ${queue}`);
    check(Object.values(skills).length === 2 && Object.values(skills).every((n) => n >= 4), `${round}판 두 학습 항목 4개 이상씩 ${JSON.stringify(skills)}`);
    check(log.rows === 12 && log.listen === 12, `${round}판 결과 복습 ${JSON.stringify(log)}`);
    check(end.results.length === 12, `${round}판 결과 ${end.results.length}`);
    rounds.push({ round, queue, added: queue.filter((id) => ADDED.includes(id)), d2: kinds.filter((x) => x.difficulty === 2).length,
      follow: kinds.filter((x) => x.kind === 'follow').length, first4: queue.slice(0, 4), correct: log.correct, coins: log.coins, next: log.next });
    if (round < ROUNDS) await page.click('#r-again');
  }
  const seen = new Set(rounds.flatMap((r) => r.queue));
  const summary = await page.evaluate(() => window.__rally.summary());
  const answered = summary?.skills?.reduce((n, sk) => n + Object.values(sk.levels || {}).reduce((m, l) => m + Object.values(l.formats || {}).reduce((k, f) => k + (f.n || 0), 0), 0), 0);
  check(rounds.slice(1).some((r) => r.added.length > 0), `2~4판에 새 말이 나옴 ${JSON.stringify(rounds.map((r) => r.added))}`);
  check(rounds.slice(1).some((r) => r.d2 > 0), '2~4판에 조금 어려운 말이 나옴');
  // 1판에서 이어지는 말 4개를 틀려도 2·3판을 다 맞히면 조금 어려운 이어지는 말로 넘어간다(쉬운 말이 11개였을 땐 30일 동안 못 넘어갔다)
  check(rounds[2].next.includes('조금 어려운'), `3판 뒤 다음 판이 조금 어려운 말로 넘어감 — ${rounds[2].next}`);
  check(rounds[3].queue.some((id) => byId.get(id).kind === 'follow' && byId.get(id).difficulty === 2), `4판에 조금 어려운 이어지는 말 ${rounds[3].queue}`);
  check(rounds[1].first4.filter((id) => byId.get(id).kind === 'follow').length >= 3, `2판 앞쪽에 1판에서 틀린 쪽(이어지는 말) ${rounds[1].first4}`);
  check(rounds[0].queue.every((id) => byId.get(id).difficulty === 1), '1판(처음)은 쉬운 말만');
  check(voice.length > 0 && voice.every((v) => v.status === 200 || v.status === 206 || v.status === 304), `음성 응답 ${JSON.stringify(voice.filter((v) => ![200, 206, 304].includes(v.status)))}`);
  // 아틀라스는 같은 말(familyKey)의 첫 혼자 응답만, 학습 항목·난도 칸마다 최근 12개까지 센다(atlas/learning.js formatEvidence)
  const cells = [...seen].reduce((m, id) => { const x = byId.get(id), k = `${x.skill}/${x.difficulty}`; m[k] = (m[k] || 0) + 1; return m; }, {});
  const expected = Object.values(cells).reduce((n, c) => n + Math.min(12, c), 0);
  check(answered === expected, `아틀라스 기록 수 ${answered} ≠ ${expected}(서로 다른 말 ${seen.size})`);
  // 공통 코인: 판마다 한 번씩, 맞힌 비율대로
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null'));
  const want = rounds.reduce((n, r) => n + 15 + Math.round(10 * Number(r.correct) / 12), 0);
  check(wallet?.coins === want && Object.keys(wallet.rewardedRounds).length === ROUNDS, `공통 코인 ${wallet?.coins} ≠ ${want}(판 ${Object.keys(wallet?.rewardedRounds || {}).length})`);
  check(rounds.at(-1).coins === `공통 코인 +25 · 보유 ${want}`, `마지막 판의 코인 줄 ${rounds.at(-1).coins}`);
  check(!errors.length, `콘솔 오류 ${errors.join(' | ')}`);
  await ctx.close();
  return { name, seconds: Math.round((Date.now() - t0) / 1000), rounds, seen: seen.size, addedSeen: ADDED.filter((id) => seen.has(id)), voiceFiles: new Set(voice.map((v) => v.url)).size, fails };
}

(async () => {
  const which = process.argv.slice(2).filter((a) => VIEWS[a]);
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  let bad = 0;
  for (const name of which.length ? which : ['desktop']) {
    try { const r = await run(browser, name); bad += r.fails.length;
      console.log(JSON.stringify({ ...r, rounds: r.rounds.map((x) => ({ ...x, queue: x.queue.join(' '), first4: x.first4.join(' ') })) }, null, 1)); }
    catch (e) { bad += 1; console.log(`${name} 실패: ${e.message}`); }
  }
  await browser.close();
  console.log(bad ? `실패 ${bad}` : '통과');
  process.exit(bad ? 1 : 0);
})();
