// 한글 단계 화면 점검: 헤드리스 크롬으로 입구 → 이유 한 줄 → 만나기 → 문항 꼴(시범 포함) → 오답과 회차 안 재출제 → 마무리 → 다시 열기,
// 그리고 둘째 판: 받침을 배우는 사람(받침 만나기 · 짝 고르기 · 몽글에게 가르쳐 주기 · 받침 조각) → 졸업 장면 → 졸업 뒤 몸풀기.
// 소리 없이(?qa=silent) 흐름만 본다. 소리를 실제로 듣는 확인은 사람 귀로 따로 한다.
// node experiences/hangul-stage/qa/flow.cjs [http://127.0.0.1:5240/]  (서버: node experiences/hangul-stage/server.mjs)
const path = require('node:path');
const fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const BASE = (process.argv[2] || 'http://127.0.0.1:5240/').replace(/\/?$/, '/');
const OUT = __dirname;
const results = [];
const shot = (page, name, width, opts = {}) => (width === 390 || /^(home|listen_pick)$/.test(name)
  ? page.screenshot({ path: path.join(OUT, `${name}-${width}.jpg`), type: 'jpeg', quality: 78, ...opts }) : null);
const has = (name, width) => fs.existsSync(path.join(OUT, `${name}-${width}.jpg`));
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '통과' : '실패'}  ${name}${detail ? ` — ${detail}` : ''}`); };

async function overflow(page) {
  return page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth, vv: innerWidth - (visualViewport?.width || innerWidth) }));
}
async function waitReady(page) {
  // 시범이 도는 동안 무대는 inert다. 끝날 때까지 기다린다.
  await page.waitForFunction(() => !document.getElementById('stage').inert, null, { timeout: 15000 });
}
const shots390 = width => width === 390;
async function playSession(page, { width, shots, wrongOnce, started = false, end = '#finish:not([hidden])' }) {
  let wrongDone = !wrongOnce, types = new Set(), demos = 0, retries = 0, steps = 0, sums = 0, finalsBuilt = 0, teachShown = 0;
  const met = [], order = [];
  if (!started) {
    await page.click('#start');
    await page.waitForSelector('#session:not([hidden]) .reason');
    if (shots) await shot(page, 'reason', width);
    await page.click('#dock .felt-cta');
  }
  for (let guard = 0; guard < 60; guard += 1) {
    if (await page.locator(end).count() || await page.locator('#finish:not([hidden])').count()) break;
    await waitReady(page);
    const step = await page.evaluate(() => window.__hangulQA.step());
    if (!step) break;
    steps += 1;
    if (step.kind === 'meet') {
      met.push(step.letter);
      if (shots && /^f-/.test(step.letter) && !has('meet-final', width)) {
        sums += await page.locator('.meet.final .sum').count();
        await shot(page, 'meet-final', width, { fullPage: true });
      }
      if (shots && !has('meet', width)) {
        // 따라 쓰기 칸에 실을 한 번 그어 본다.
        const box = await page.locator('.trace canvas').boundingBox();
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.3); await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55, { steps: 8 }); await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.72, { steps: 8 }); await page.mouse.up();
        await shot(page, 'meet', width, { fullPage: true });
      }
      await page.click('#dock .felt-cta');
      continue;
    }
    const item = step.item;
    types.add(item.type); order.push(item.type); if (item.again) retries += 1;
    const demoBefore = await page.evaluate(() => window.__hangulQA.progress().demoSeen.length);
    const goWrong = !wrongDone && item.type === 'listen_pick' && !item.check && item.target.letter;
    if (item.type === 'listen_pick' || item.type === 'pair' || item.type === 'teach') {
      if (item.type === 'teach') teachShown += await page.locator('.teach .held').count();
      if (shots && item.type !== 'listen_pick' && !has(item.type, width)) await shot(page, item.type, width);
      const idx = goWrong ? item.options.findIndex(o => o.text !== item.target.text) : item.options.findIndex(o => o.text === item.target.text);
      await page.locator('.options .opt').nth(idx).click();
      if (goWrong) wrongDone = true;
    } else if (item.type === 'see_pick') {
      await page.locator('.options .opt').nth(item.options.findIndex(o => o.text === item.target.text)).click();
      await page.click('#dock .felt-cta');
    } else if (item.type === 'build') {
      const g = id => ({ 'c-g': 'ㄱ', 'c-n': 'ㄴ', 'c-d': 'ㄷ', 'c-r': 'ㄹ', 'c-m': 'ㅁ', 'c-b': 'ㅂ', 'c-s': 'ㅅ', 'c-j': 'ㅈ', 'c-h': 'ㅎ' })[id];
      await page.locator('.piece-row').nth(0).locator('.piece').nth(item.pieces.consonants.indexOf(item.target.consonant)).click();
      await page.locator('.piece-row').nth(1).locator('.piece').nth(item.pieces.vowels.indexOf(item.target.vowel)).click();
      if (item.pieces.finals) {
        await page.locator('.piece-row.finals .piece').nth(item.pieces.finals.indexOf(item.target.final)).click();
        finalsBuilt += 1;
        if (shots && !has('build-final', width)) await shot(page, 'build-final', width);
      }
      if (shots && !item.pieces.finals && !has('build', width)) await shot(page, 'build', width);
      await page.click('#dock .felt-cta');
      void g;
    } else if (item.type === 'match') {
      if (shots && !has('match', width)) await shot(page, 'match', width);
      for (let i = 0; i < item.sounds.length; i += 1) {
        await page.locator('.match .col').nth(0).locator('.card').nth(i).click();
        await page.locator('.match .col').nth(1).locator('.card').nth(item.cards.findIndex(c => c.letter === item.sounds[i].letter)).click();
        await page.waitForTimeout(220);
      }
    }
    await page.waitForSelector('#dock .say');
    const demoAfter = await page.evaluate(() => window.__hangulQA.progress().demoSeen.length);
    if (demoAfter > demoBefore) demos += 1;
    if (shots && !has(`${item.type}${goWrong ? '-wrong' : ''}`, width)) await shot(page, `${item.type}${goWrong ? '-wrong' : ''}`, width);
    const ov = await overflow(page);
    if (ov.doc > 0 || ov.body > 0 || ov.vv > 0) check(`${width}px 넘침 없음(${item.type})`, false, JSON.stringify(ov));
    await page.click('#dock .felt-cta');
  }
  return { types: [...types], demos, retries, steps, sums, finalsBuilt, teachShown, met, order };
}

(async () => {
  for (const name of fs.readdirSync(OUT)) if (name.endsWith('.jpg')) fs.unlinkSync(path.join(OUT, name));
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', r => { if (!r.url().startsWith(BASE)) requests.push(r.url()); });
    const missing = [];
    page.on('response', r => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${BASE}?qa=silent`);
    await page.waitForSelector('#home:not([hidden])');
    await page.evaluate(() => document.fonts.ready);
    check(`${width}px 입구가 열림`, await page.locator('#start').isEnabled(), await page.textContent('#start-label'));
    const ov = await overflow(page);
    check(`${width}px 입구 넘침 없음`, ov.doc <= 0 && ov.body <= 0 && ov.vv <= 0, JSON.stringify(ov));
    await shot(page, 'home', width, { fullPage: true });
    const first = await playSession(page, { width, shots: true, wrongOnce: true });
    check(`${width}px 첫 회차 끝까지`, await page.locator('#finish:not([hidden])').count() === 1, `단계 ${first.steps}`);
    check(`${width}px 첫 회차 꼴`, first.types.length >= 3, first.types.join(','));
    const seen = await page.evaluate(() => window.__hangulQA.progress().demoSeen);
    check(`${width}px 처음 나온 꼴마다 시범이 한 번씩`, first.types.every(t => seen.includes(t)) && new Set(seen).size === seen.length, `시범 ${seen.join(',')} / 꼴 ${first.types.join(',')}`);
    check(`${width}px 틀린 글자를 회차 안에서 한 번 더`, first.retries >= 1, `다시 ${first.retries}`);
    await shot(page, 'finish', width);
    const p = await page.evaluate(() => window.__hangulQA.progress());
    const met = Object.entries(p.letters).filter(([, l]) => l.state !== 'unmet').map(([id]) => id);
    check(`${width}px 진도 저장(만난 글자)`, met.length >= 3, met.join(','));
    // 아틀라스 공통 기록에 한글 단계 문항이 남았는가(이 기기의 공통 키).
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.atlas.learning.v1.device') || 'null'));
    const presented = (log?.events || []).filter(e => e.type === 'practice.presented');
    const skills = [...new Set(presented.map(e => e.measure?.skillId))];
    check(`${width}px 아틀라스 기록`, presented.length >= 10 && skills.every(s => /^ko\.hangul\./.test(s)), `문항 ${presented.length}, 기술 ${skills.join(',')}`);
    const attempts = (log?.events || []).filter(e => e.type === 'practice.attempted').length;
    check(`${width}px 아틀라스 응답`, attempts >= 10, `응답 ${attempts}`);
    // 다시 열면 진도가 이어진다.
    await page.click('#done');
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const tiles = await page.locator('#box .tile:not(.unmet)').count();
    check(`${width}px 다시 열면 글자 상자에 만난 글자`, tiles >= 3, `타일 ${tiles}`);
    check(`${width}px 다시 열면 「한 번 더」`, (await page.textContent('#start-label')) === '한 번 더');
    const second = await playSession(page, { width, shots: false, wrongOnce: false });
    check(`${width}px 둘째 회차 끝까지`, await page.locator('#finish:not([hidden])').count() === 1, `단계 ${second.steps}, 꼴 ${second.types.join(',')}`);
    // 자음까지 배운 사람(U1·U2를 만남, 2단): 음절 만들기와 U3 새 글자가 나와야 한다.
    await page.click('#done');
    await page.evaluate(key => {
      const at = new Date(Date.now() - 86400000).toISOString(), day = at.slice(0, 10);
      const letters = {};
      for (const id of ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i', 'c-g', 'c-n', 'c-d', 'c-r', 'c-m']) letters[id] = { state: 'learning', best: 'learning', streak: 1, streakSessions: ['x'], step: 1, due: at, lapses: 0, seen: 3, correct: 3, lastAt: at, metAt: at };
      localStorage.setItem(key, JSON.stringify({ v: 1, letters, pairs: {}, recent: Array.from({ length: 20 }, () => ({ ok: true })), sessions: [{ day, sessionNo: 0, total: 10, independent: 10 }], difficulty: 2, trend: 0, amount: 10, skipped: false, demoSeen: ['listen_pick', 'see_pick', 'match'] }));
    }, await page.evaluate(() => window.__hangulQA.key));
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const third = await playSession(page, { width, shots: true, wrongOnce: false });
    const p3 = await page.evaluate(() => window.__hangulQA.progress());
    check(`${width}px 자음을 배운 사람: 음절 만들기와 그 시범`, third.types.includes('build') && p3.demoSeen.filter(t => t === 'build').length === 1, `꼴 ${third.types.join(',')}`);
    check(`${width}px 자음을 배운 사람: U3 새 글자를 만남`, ['c-b', 'c-s', 'c-ng'].some(id => p3.letters[id] && p3.letters[id].state !== 'unmet'), Object.keys(p3.letters).join(','));
    await shot(page, 'finish-consonants', width);

    // ── 둘째 판 ──
    const TYPES = ['listen_pick', 'see_pick', 'build', 'match'];
    const U14 = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i', 'c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s', 'c-ng', 'c-j', 'c-h', 'v-ya', 'v-yeo', 'v-yo', 'v-yu', 'v-ae', 'v-e'];
    const U6 = ['f-n', 'f-r', 'f-m', 'f-ng'], U7 = ['f-g', 'f-d', 'f-b', 'f-s', 'f-j'];
    const seed = (key, extra) => page.evaluate(([key, extra]) => {
      const ago = d => new Date(Date.now() - d * 86400000).toISOString();
      const letters = {};
      for (const [ids, state, due] of extra.groups) for (const id of ids) letters[id] = { state, best: state, streak: state === 'mastered' ? 3 : 1, streakSessions: ['a', 'b'].slice(0, state === 'mastered' ? 2 : 1),
        step: state === 'mastered' ? 4 : 1, due: ago(due), lapses: 0, seen: 4, correct: 4, lastAt: ago(1), metAt: ago(5) };
      localStorage.setItem(key, JSON.stringify({ v: 1, letters, pairs: extra.pairs || {}, recent: Array.from({ length: 20 }, () => ({ ok: true })), sessions: [], difficulty: extra.difficulty, trend: 0,
        amount: 10, skipped: false, demoSeen: extra.demoSeen, wordStreak: extra.wordStreak || 0, graduated: null }));
    }, [key, extra]);
    const key = await page.evaluate(() => window.__hangulQA.key);
    // 받침 ㄴㄹㅁㅇ을 배우는 중이고 어제 ㄴ/ㅇ 받침을 헷갈린 사람(2단). 오늘은 짝 고르기로 시작하고, 복습에 가르쳐 주기가 들며, 받침 ㄱ·ㄷ을 새로 만난다.
    await page.click('#done');
    await seed(key, { groups: [[U14, 'mastered', -3], [U6, 'learning', 1]], pairs: { 'f-n|f-ng': { wrong: 1, lastAt: new Date(Date.now() - 86400000).toISOString() } }, difficulty: 2, demoSeen: TYPES });
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const groups = await page.locator('#box .box-group').count(), finalTiles = await page.locator('#box .tile.final:not(.unmet)').count();
    check(`${width}px 글자 상자가 모음·자음·받침으로 나뉨`, groups === 3 && finalTiles === 4, `묶음 ${groups}, 받침 타일 ${finalTiles}`);
    if (width === 390) await shot(page, 'home-finals', width, { fullPage: true });
    await page.click('#start');
    await page.waitForSelector('#session:not([hidden]) .reason');
    const reasonText = await page.textContent('.reason p'), finalChips = await page.locator('.reason .chip.final').count();
    check(`${width}px 받침 회차의 이유 한 줄이 헷갈린 받침 짝을 가리킴`, /헷갈린/.test(reasonText) && finalChips === 2, `${reasonText} · 받침 칩 ${finalChips}`);
    if (shots390(width)) await shot(page, 'reason-final', width);
    await page.click('#dock .felt-cta');
    const fourth = await playSession(page, { width, shots: true, wrongOnce: false, started: true });
    const p4 = await page.evaluate(() => window.__hangulQA.progress());
    check(`${width}px 받침 회차: 짝 고르기로 시작`, fourth.order[0] === 'pair', fourth.order.join(','));
    check(`${width}px 받침 회차: 몽글에게 가르쳐 주기(몽글이 든 글자가 보임)`, fourth.types.includes('teach') && fourth.teachShown >= 1, `꼴 ${fourth.types.join(',')}`);
    check(`${width}px 받침 회차: 짝·가르쳐 주기의 시범이 한 번씩`, ['pair', 'teach'].every(t => p4.demoSeen.filter(x => x === t).length === 1), p4.demoSeen.join(','));
    check(`${width}px 받침 회차: 받침 ㄱ·ㄷ을 만나기 카드로(아 + 받침 → 음절)`, fourth.met.some(id => U7.includes(id)) && fourth.sums >= 1, `만남 ${fourth.met.join(',')}`);
    await shot(page, 'finish-finals', width);

    // 졸업 직전인 사람: 핵심 글자를 다 만났고 최근 스무 문항을 다 맞혔고 낱말을 이어서 다섯 번 읽었다. 이 회차를 다 맞히면 졸업 장면이 나온다.
    await page.click('#done');
    await seed(key, { groups: [[U14, 'mastered', -3], [U6, 'mastered', -3], [U7, 'learning', 1]], difficulty: 3, wordStreak: 5,
      demoSeen: [...TYPES, 'pair', 'teach', 'build_final'] });
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const fifth = await playSession(page, { width, shots: true, wrongOnce: false, end: '#graduation:not([hidden])' });
    const graduated = await page.locator('#graduation:not([hidden])').count();
    const p5 = await page.evaluate(() => window.__hangulQA.progress());
    check(`${width}px 졸업: 회차 끝에 졸업 장면`, graduated === 1 && !!p5.graduated, `단계 ${fifth.steps}, 꼴 ${fifth.types.join(',')}, 받침 음절 만들기 ${fourth.finalsBuilt + fifth.finalsBuilt}`);
    const words = await page.locator('#grad-words .example').count();
    check(`${width}px 졸업 장면: 읽을 수 있는 받침 낱말과 명패`, words >= 3 && (await page.locator('#grad-plate .cell').count()) === 8, `낱말 ${words}`);
    const ovg = await overflow(page);
    check(`${width}px 졸업 장면 넘침 없음`, ovg.doc <= 0 && ovg.body <= 0 && ovg.vv <= 0, JSON.stringify(ovg));
    await shot(page, 'graduation', width, { fullPage: true });
    await page.click('#grad-done');
    await page.waitForSelector('#home:not([hidden])');
    check(`${width}px 졸업 뒤 입구: 몸풀기`, (await page.textContent('#start-label')) === '몸풀기' && (await page.textContent('#hero-title')) === '한글을 읽어요' && await page.locator('#amounts-block').isHidden(),
      `${await page.textContent('#start-label')} · ${await page.textContent('#hero-title')}`);
    if (width === 390) await shot(page, 'home-graduated', width);
    const sixth = await playSession(page, { width, shots: false, wrongOnce: false });
    check(`${width}px 졸업 뒤 몸풀기는 다섯 문항 이하`, await page.locator('#finish:not([hidden])').count() === 1 && sixth.order.length <= 5, `문항 ${sixth.order.length}: ${sixth.order.join(',')}`);
    check(`${width}px 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '));
    check(`${width}px 없는 파일 요청 없음`, missing.length === 0, missing.slice(0, 3).join(' | '));
    check(`${width}px 바깥 요청 없음`, requests.length === 0, requests.slice(0, 3).join(' | '));
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'flow-result.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2) + '\n');
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 통과`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
