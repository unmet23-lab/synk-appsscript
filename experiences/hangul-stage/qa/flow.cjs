// 한글 단계 화면 점검: 헤드리스 크롬으로 입구 → 이유 한 줄 → 만나기 → 문항 꼴(시범 포함) → 오답과 회차 안 재출제 → 마무리 → 다시 열기,
// 그리고 둘째 판: 받침을 배우는 사람(받침 만나기 · 짝 고르기 · 몽글에게 가르쳐 주기 · 받침 조각) → 졸업 장면 → 졸업 뒤 몸풀기,
// 노래로 배우기(모음 댄스 · 그 아 가 · 받침 노래 · 겹모음 댄스 — 소리 없이 노래 시각만 옮겨 그려 글자가 켜지는지 본다).
// 소리 없이(?qa=silent) 흐름만 본다. 소리를 실제로 듣는 확인은 사람 귀로 따로 한다.
// node experiences/hangul-stage/qa/flow.cjs [http://127.0.0.1:5240/]  (서버: node experiences/hangul-stage/server.mjs)
const path = require('node:path');
const fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const BASE = (process.argv[2] || 'http://127.0.0.1:5240/').replace(/\/?$/, '/');
const OUT = __dirname;
const results = [];
// 캡처: 그림 파일을 다른 프로그램(미리보기·백신)이 잠깐 붙잡으면 쓰기가 UNKNOWN으로 실패한다 — 잠시 뒤 다시 쓰고, 그래도 안 되면 점검은 이어 간다.
async function shot(page, name, width, opts = {}) {
  if (!(width === 390 || /^(home|listen_pick)$/.test(name))) return;
  const buf = await page.screenshot({ type: 'jpeg', quality: 78, ...opts });
  const file = path.join(OUT, `${name}-${width}.jpg`);
  for (let i = 0; i < 4; i += 1) {
    try { fs.writeFileSync(file, buf); return; } catch (e) { if (i === 3) { console.log(`캡처 못 씀 ${name}-${width}: ${e.code}`); return; } await new Promise(r => setTimeout(r, 400)); }
  }
}
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
  let wrongDone = !wrongOnce, types = new Set(), demos = 0, retries = 0, steps = 0, sums = 0, finalsBuilt = 0, teachShown = 0, mnemonics = 0, derives = 0, finalMnemonics = 0;
  const met = [], order = [], tense = [], compound = [];
  const text = sel => page.evaluate(s => document.querySelector(s)?.textContent || '', sel);
  const imgReady = () => page.waitForFunction(() => { const i = document.querySelector('.meet .mnemonic img'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 3000 }).then(() => true, () => false);
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
      if (/^c-(k|t|p|ch)$/.test(step.letter)) {
        derives += await page.locator('.meet .derive').count();
        if (shots && !has('meet-aspirated', width)) await shot(page, 'meet-aspirated', width, { fullPage: true });
      }
      if (/^c-/.test(step.letter)) {
        const ok = await page.waitForFunction(() => { const i = document.querySelector('.meet .mnemonic img'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 3000 }).then(() => true, () => false);
        if (ok) mnemonics += 1;
        if (shots && ok && !has('meet-consonant', width)) await shot(page, 'meet-consonant', width, { fullPage: true });
      }
      // 된소리: 「ㄱ + ㄱ = ㄲ」(같은 글자 조각), 세 소리 견주기(가 · 카 · 까), 그림 연상의 강조 음절.
      if (/^c-(kk|tt|pp|ss|jj)$/.test(step.letter)) {
        tense.push({ letter: step.letter, twin: await page.locator('.meet .derive .twin-piece').count(), trio: await page.locator('.meet .trio .example').count(),
          word: await text('.meet .mnemonic .mn-word'), bold: await text('.meet .mnemonic .mn-word b') });
        if (shots && !has('meet-tense', width)) await shot(page, 'meet-tense', width, { fullPage: true });
      }
      // 겹모음: 「ㅗ + ㅏ = ㅘ」(눌러 듣는 글자 셋), 그 모음이 든 음절의 강조, 소리 길잡이 한 줄.
      if (/^v-(wa|wo|wi|ui|oe|wae|we|ye|yae)$/.test(step.letter)) {
        const pic = await page.locator('.meet .mnemonic').count() ? await imgReady() : null;
        compound.push({ letter: step.letter, derive: await page.locator('.meet .derive .example').count(), stroke: await page.locator('.meet .derive .stroke-piece').count(),
          bold: await text('.meet .mnemonic .mn-word b'), note: await text('.meet .note'), pic });
        if (shots && pic && !has('meet-compound', width)) await shot(page, 'meet-compound', width, { fullPage: true });
      }
      if (/^f-/.test(step.letter) && await page.locator('.meet .mnemonic').count()) {
        const ok = await page.waitForFunction(() => { const i = document.querySelector('.meet .mnemonic img'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 3000 }).then(() => true, () => false);
        if (ok) finalMnemonics += 1;
      }
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
  return { types: [...types], demos, retries, steps, sums, finalsBuilt, teachShown, met, order, mnemonics, derives, finalMnemonics, tense, compound };
}

(async () => {
  for (const name of fs.readdirSync(OUT)) if (name.endsWith('.jpg')) { try { fs.unlinkSync(path.join(OUT, name)); } catch { /* 잠긴 캡처는 덮어쓴다 */ } }
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
    // 노래로 배우기: 첫 화면의 노래 네 곡(모음 댄스 · 그 아 가 · 받침 노래 · 겹모음 댄스). 노래 화면은 노래 시각에 맞춰 글자를 켠다.
    const songCards = await page.locator('#songs .song-card').count();
    check(`${width}px 첫 화면에 노래 네 곡`, songCards === 4, `노래 ${songCards}`);
    await page.locator('#songs .song-card').nth(0).click();
    await page.waitForSelector('#song:not([hidden])');
    const v1 = await page.evaluate(() => window.__hangulQA.songAt(12.3)); // 「오른쪽 아!」의 「아」는 12.21초(10-09 목소리로 잰 값)
    const vowelOk = v1.kind === 'vowel' && v1.step === 0 && await page.locator('#song-stage .song-tile.big.on').count() === 1 && await page.locator('#song-stage .move.right').count() === 1;
    check(`${width}px 모음 댄스 12.3초: ㅏ가 켜지고 오른쪽 화살표`, vowelOk, JSON.stringify(v1));
    if (width === 390) await shot(page, 'song-vowel', width);
    const v2 = await page.evaluate(() => window.__hangulQA.songAt(22.3));
    check(`${width}px 모음 댄스 후렴: 여섯 모음을 차례로`, v2.kind === 'sweep' && v2.step >= 1 && await page.locator('#song-stage .song-tile.on').count() === 1, JSON.stringify(v2));
    await page.locator(`#song-stage [data-i="${v2.step}"]`).click();
    const lit = await page.locator(`#song-stage [data-i="${v2.step}"].hit`).count();
    const hint = await page.textContent('#song-hint');
    check(`${width}px 따라 누르기: 켜진 글자를 누르면 빛남(점수 없음)`, lit === 1 && /눌러/.test(hint), `빛남 ${lit} · ${hint}`);
    const ovs = await overflow(page);
    check(`${width}px 노래 화면 넘침 없음`, ovs.doc <= 0 && ovs.body <= 0 && ovs.vv <= 0, JSON.stringify(ovs));
    await page.click('#song-close');
    await page.waitForSelector('#home:not([hidden])');
    await page.locator('#songs .song-card').nth(1).click();
    await page.waitForSelector('#song:not([hidden])');
    const g1 = await page.evaluate(() => window.__hangulQA.songAt(14.75));
    const g2 = await page.evaluate(() => window.__hangulQA.songAt(15.05));
    const blendText = await page.textContent('#song-stage .song-blend');
    check(`${width}px 그 아 가 15초: ㄱ + ㅏ = 가 세 걸음`, g1.kind === 'blend' && g1.step === 0 && g2.step >= 1 && /ㄱ/.test(blendText) && /가/.test(blendText), `${JSON.stringify(g1)} ${JSON.stringify(g2)}`);
    const songPic = await page.waitForFunction(() => { const i = document.querySelector('#song-stage .song-mn'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 3000 }).then(() => true, () => false);
    check(`${width}px 그 아 가 합치기 장면에 자음 그림`, songPic);
    if (width === 390) await shot(page, 'song-blend', width);
    // 떠올리기(10-09 노래 v4): 「그 더하기 아는?」 뒤 쉼 한 마디 동안 결과 칸은 「?」, 「가!」(35.08초)에 켜진다
    const q1 = await page.evaluate(() => window.__hangulQA.songAt(34.0));
    const askShown = await page.locator('#song-stage .part.ask .song-tile .ask-q').isVisible() && !(await page.locator('#song-stage .part.ask .song-tile .ask-a').isVisible());
    const askLine = await page.textContent('#song-line');
    if (width === 390) await shot(page, 'song-ask', width);
    const q2 = await page.evaluate(() => window.__hangulQA.songAt(35.3));
    const answered = await page.locator('#song-stage .part.ask .song-tile .ask-a').isVisible();
    check(`${width}px 그 아 가 떠올리기: 쉼 동안 ?, 노래가 부르면 가`, q1.step === 1 && askShown && askLine === '그 더하기 아는?' && q2.step === 2 && answered && (await page.textContent('#song-line')).endsWith('가!'), `${JSON.stringify(q1)} ${askLine} ${JSON.stringify(q2)}`);
    const g3 = await page.evaluate(() => window.__hangulQA.songAt(44.8)); // 쉼 두 마디(4.8초) 뒤로 밀린 후렴
    check(`${width}px 그 아 가 후렴: 가 나 다 라 마 바 사`, g3.kind === 'sweep' && (await page.textContent('#song-stage .song-row')).includes('가나다라마바사'), JSON.stringify(g3));
    if (width === 390) await shot(page, 'song-sweep', width);
    const g4 = await page.evaluate(() => window.__hangulQA.songAt(63.3));
    check(`${width}px 그 아 가 둘째 절: 가 거 고 구 그 기`, g4.kind === 'sweep' && (await page.textContent('#song-stage .song-row')).includes('가거고구그기'), JSON.stringify(g4));
    // 재생: 단추를 누르면 노래가 흐르고(범위 요청을 받는 서버라야 옮기기·흐름이 된다), 화면은 노래 시각을 따라간다. 실제 소리는 사람 귀로 확인한다.
    await page.click('#song-play');
    // 헤드리스 크롬은 소리 장치가 늦게 깨는 때가 있어, 4초 안에 안 흐르면 멈췄다 한 번 더 누른다.
    let flowed = await page.waitForFunction(() => window.__hangulQA.songTime() > 0.3, null, { timeout: 4000 }).then(() => true, () => false);
    if (!flowed) { await page.click('#song-play'); await page.click('#song-play'); flowed = await page.waitForFunction(() => window.__hangulQA.songTime() > 0.3, null, { timeout: 6000 }).then(() => true, () => false); }
    // 참고값: 헤드리스의 소리 장치는 깨는 게 들쭉날쭉해(10-05 같은 판에서 통과·실패가 번갈았다) 통과·실패로 세지 않는다. 실제 재생은 사람 귀로 확인했다(10-05 유호님).
    console.log(`참고  ${width}px 노래가 헤드리스에서 흐름: ${flowed ? '예' : '아니오'} (시각 ${await page.evaluate(() => window.__hangulQA.songTime())})`);
    await page.evaluate(() => window.__hangulQA.songSeek(17.6));
    await page.waitForTimeout(300);
    const stageNow = await page.textContent('#song-stage');
    check(`${width}px 재생 중 화면이 노래 시각을 따라감(17.6초로 옮기면 ㄷ + ㅏ = 다)`, stageNow.includes('ㄷ') && stageNow.includes('다'), `${await page.evaluate(() => window.__hangulQA.songTime())} ${stageNow}`);
    await page.click('#song-play');
    await page.click('#song-close');
    await page.waitForSelector('#home:not([hidden])');
    // 받침 노래(10-08): 「아 + ㄴ = 안」 세 걸음(받침 칸에 받침 표시·받침 소리 「은」), 「사 + ㄴ = 산」엔 낱말 그림, 후렴은 받침 음절 줄.
    await page.locator('#songs .song-card').nth(2).click();
    await page.waitForSelector('#song:not([hidden])');
    const b1 = await page.evaluate(() => window.__hangulQA.songAt(11.3));
    const batText = await page.textContent('#song-stage .song-blend');
    const finalMark = await page.locator('#song-stage .song-tile.final').count();
    check(`${width}px 받침 노래 11초: 아 + ㄴ = 안 세 걸음(받침 소리 「은」)`, b1.kind === 'batchim' && b1.step === 1 && /아/.test(batText) && /ㄴ/.test(batText) && /은/.test(batText) && finalMark === 1, `${JSON.stringify(b1)} ${batText}`);
    const b2 = await page.evaluate(() => window.__hangulQA.songAt(16.4));
    const wordPic = await page.waitForFunction(() => { const i = document.querySelector('#song-stage .song-mn'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 3000 }).then(() => true, () => false);
    check(`${width}px 받침 노래 16초: 사 + ㄴ = 산(결과 칸 위에 낱말 그림)`, b2.kind === 'batchim' && b2.step === 2 && wordPic && (await page.textContent('#song-stage .song-blend')).includes('산'), JSON.stringify(b2));
    if (width === 390) await shot(page, 'song-batchim', width);
    const b3 = await page.evaluate(() => window.__hangulQA.songAt(31.0));
    check(`${width}px 받침 노래 후렴: 안 알 암 앙 산 물 밤 강`, b3.kind === 'sweep' && (await page.textContent('#song-stage .song-row')).includes('안알암앙산물밤강'), JSON.stringify(b3));
    await page.click('#song-close');
    await page.waitForSelector('#home:not([hidden])');
    // 겹모음 댄스(10-09): 「오 + 아 = 와」 세 걸음, 떠올리기 「오 더하기 아는? … 와!」, 후렴 와 워 위 의, 2절 「고 + 아 = 과」.
    await page.locator('#songs .song-card').nth(3).click();
    await page.waitForSelector('#song:not([hidden])');
    const c1 = await page.evaluate(() => window.__hangulQA.songAt(7.1));
    const cmpText = await page.textContent('#song-stage .song-blend');
    check(`${width}px 겹모음 댄스 7초: 오 + 아 = 와 세 걸음`, c1.kind === 'compound' && c1.step === 2 && /오/.test(cmpText) && /아/.test(cmpText) && /와/.test(cmpText), `${JSON.stringify(c1)} ${cmpText}`);
    const c2 = await page.evaluate(() => window.__hangulQA.songAt(13.0));
    const cAsk = await page.locator('#song-stage .part.ask .song-tile .ask-q').isVisible() && (await page.textContent('#song-line')) === '오 더하기 아는?';
    if (width === 390) await shot(page, 'song-compound-ask', width);
    const c3 = await page.evaluate(() => window.__hangulQA.songAt(15.4));
    check(`${width}px 겹모음 댄스 떠올리기: 쉼 동안 ?, 15.3초에 와`, c2.step === 1 && cAsk && c3.step === 2 && await page.locator('#song-stage .part.ask .song-tile .ask-a').isVisible(), `${JSON.stringify(c2)} ${JSON.stringify(c3)}`);
    const c4 = await page.evaluate(() => window.__hangulQA.songAt(22.0));
    check(`${width}px 겹모음 댄스 후렴: 와 워 위 의`, c4.kind === 'sweep' && (await page.textContent('#song-stage .song-row')).includes('와워위의'), JSON.stringify(c4));
    const c5 = await page.evaluate(() => window.__hangulQA.songAt(31.5));
    check(`${width}px 겹모음 댄스 2절: 고 + 아 = 과`, c5.kind === 'compound' && (await page.textContent('#song-stage .song-blend')).includes('과'), JSON.stringify(c5));
    if (width === 390) await shot(page, 'song-compound', width);
    const ovc = await overflow(page);
    check(`${width}px 겹모음 댄스 화면 넘침 없음`, ovc.doc <= 0 && ovc.body <= 0 && ovc.vv <= 0, JSON.stringify(ovc));
    await page.click('#song-close');
    await page.waitForSelector('#home:not([hidden])');
    const first = await playSession(page, { width, shots: true, wrongOnce: true });
    check(`${width}px 첫 회차 끝까지`, await page.locator('#finish:not([hidden])').count() === 1, `단계 ${first.steps}`);
    check(`${width}px 첫 회차 꼴`, first.types.length >= 3, first.types.join(','));
    const seen = await page.evaluate(() => window.__hangulQA.progress().demoSeen);
    check(`${width}px 처음 나온 꼴마다 시범이 한 번씩`, first.types.every(t => seen.includes(t)) && new Set(seen).size === seen.length, `시범 ${seen.join(',')} / 꼴 ${first.types.join(',')}`);
    check(`${width}px 틀린 글자를 회차 안에서 한 번 더`, first.retries >= 1, `다시 ${first.retries}`);
    await shot(page, 'finish', width);
    const finishSong = await page.textContent('#finish-song-label');
    check(`${width}px 마무리에 노래로 복습(모음만 배운 날은 모음 댄스)`, finishSong.includes('모음 댄스'), finishSong);
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
    // 회차 끝 30초 장단: 만난 글자(ㅏㅓㅗ)만 켜지고, 안 만난 글자(ㅜㅡㅣ)는 옅다. 구간 끝에서 아는 글자 수를 보인다.
    await page.click('#finish-song');
    await page.waitForSelector('#song:not([hidden])');
    const reviewTitle = await page.textContent('#song-title');
    const startAt = await page.evaluate(() => window.__hangulQA.songTime());
    const r1 = await page.evaluate(() => window.__hangulQA.songAt(22.3));
    const unmetIdx = await page.$$eval('#song-stage [data-i].unmet', ns => ns.map(n => Number(n.dataset.i)));
    const litOn = await page.locator('#song-stage [data-i].on').count();
    check(`${width}px 회차 끝 장단: 30초 복습, 만난 글자만 켜짐`, /30초 복습/.test(reviewTitle) && startAt >= 11 && r1.kind === 'sweep' && unmetIdx.join(',') === '3,4,5' && litOn === 1,
      `${reviewTitle} · 시작 ${startAt} · 옅은 칸 ${unmetIdx.join(',')} · 켜짐 ${litOn}`);
    if (width === 390) await shot(page, 'song-review', width);
    const r2 = await page.evaluate(() => window.__hangulQA.songAt(42.0));
    const endText = await page.textContent('#song-stage');
    check(`${width}px 회차 끝 장단: 구간 끝에서 멈추고 아는 글자 수`, r2.done && endText.includes('아는 글자 3개'), endText);
    await page.click('#song-close');
    await page.waitForSelector('#home:not([hidden])');
    // 다시 열면 진도가 이어진다.
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
    check(`${width}px 자음 만나기 카드에 그림 연상(글자 모양이 든 그림과 낱말)`, third.mnemonics >= 1, `그림 ${third.mnemonics}`);
    check(`${width}px 자음을 배운 사람: U3 새 글자를 만남`, ['c-b', 'c-s', 'c-ng'].some(id => p3.letters[id] && p3.letters[id].state !== 'unmet'), Object.keys(p3.letters).join(','));
    await shot(page, 'finish-consonants', width);

    // ── 둘째 판 ──
    const TYPES = ['listen_pick', 'see_pick', 'build', 'match'];
    const U14 = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i', 'c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s', 'c-ng', 'c-j', 'c-h', 'v-ya', 'v-yeo', 'v-yo', 'v-yu', 'v-ae', 'v-e'];
    const U5 = ['c-k', 'c-t', 'c-p', 'c-ch'], U6 = ['f-n', 'f-r', 'f-m', 'f-ng'], U7 = ['f-g', 'f-d', 'f-b', 'f-s', 'f-j'];
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
    // 거센소리를 배우는 사람(U1~U4를 익힘): 오늘 ㅋㅌㅍ을 만나고, 만나기 카드에 「ㄱ + 획 = ㅋ」과 그림 연상(캣타워)이 붙는다.
    await seed(key, { groups: [[U14, 'mastered', -3]], difficulty: 2, demoSeen: TYPES });
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const asp = await playSession(page, { width, shots: true, wrongOnce: false });
    check(`${width}px 거센소리: 「ㄱ + 획 = ㅋ」 만나기 카드와 그림 연상`, asp.met.some(id => U5.includes(id)) && asp.derives >= 1 && asp.mnemonics >= 1, `만남 ${asp.met.join(',')} · 획 더하기 ${asp.derives} · 그림 ${asp.mnemonics}`);
    await page.click('#done');
    await seed(key, { groups: [[U14, 'mastered', -3], [U5, 'mastered', -3], [U6, 'learning', 1]], pairs: { 'f-n|f-ng': { wrong: 1, lastAt: new Date(Date.now() - 86400000).toISOString() } }, difficulty: 2, demoSeen: TYPES });
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
    check(`${width}px 받침 만나기 카드에 받침으로 끝나는 낱말 그림(책 = 채 + ㄱ)`, fourth.finalMnemonics >= 1, `그림 ${fourth.finalMnemonics}`);
    check(`${width}px 받침 회차: 받침 ㄱ·ㄷ을 만나기 카드로(아 + 받침 → 음절)`, fourth.met.some(id => U7.includes(id)) && fourth.sums >= 1, `만남 ${fourth.met.join(',')}`);
    const finishFinal = await page.textContent('#finish-song-label');
    check(`${width}px 받침을 다룬 날 마무리 노래는 받침 노래`, finishFinal.includes('받침 노래'), finishFinal);
    await shot(page, 'finish-finals', width);

    // ── 셋째 판: 된소리·겹모음(U8·U9) ──
    const U8 = ['c-kk', 'c-tt', 'c-pp', 'c-ss', 'c-jj'], U9 = ['v-wa', 'v-wo', 'v-wi', 'v-ui', 'v-oe', 'v-wae', 'v-we', 'v-ye', 'v-yae'];
    const ALL_DEMOS = [...TYPES, 'pair', 'teach', 'build_final'];
    // 된소리를 배우는 사람(U1~U7을 익힘): 오늘 ㄲㄸㅃ을 만나고, 만나기 카드에 「ㄱ + ㄱ = ㄲ」·세 소리(가 · 카 · 까)·그림 연상(꿀)이 붙는다.
    await page.click('#done');
    await seed(key, { groups: [[U14, 'mastered', -3], [U5, 'mastered', -3], [U6, 'mastered', -3], [U7, 'mastered', -3]], difficulty: 2, demoSeen: ALL_DEMOS });
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const tz = await playSession(page, { width, shots: true, wrongOnce: false });
    const kk = tz.tense.find(t => t.letter === 'c-kk');
    check(`${width}px 된소리: 「ㄱ + ㄱ = ㄲ」·세 소리(가 · 카 · 까)·그림 연상(꿀)`, !!kk && kk.twin === 1 && kk.trio === 3 && kk.bold === '꿀' && tz.mnemonics >= 1,
      `만남 ${tz.met.join(',')} · ${JSON.stringify(tz.tense)}`);
    // 겹모음을 배우는 사람(U1~U8을 익힘): 오늘 ㅘㅝㅟ를 만나고, 「ㅗ + ㅏ = ㅘ」와 사과의 「과」, 「오와 아를 빨리 이어 말하면 와」가 붙는다.
    await page.click('#done');
    await seed(key, { groups: [[U14, 'mastered', -3], [U5, 'mastered', -3], [U6, 'mastered', -3], [U7, 'mastered', -3], [U8, 'mastered', -3]], difficulty: 2, demoSeen: ALL_DEMOS });
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const road = await page.evaluate(() => [...document.querySelectorAll('#road li')].map(li => li.getAttribute('aria-label')));
    check(`${width}px 한글 길에 된소리·겹모음 단원`, road.length === 10 && road.some(l => /된소리 · 다 익힘/.test(l)) && road.some(l => /겹모음 · 지금/.test(l)) && road.some(l => /첫 문장 · 준비 중/.test(l)), road.join(' | '));
    if (width === 390) await shot(page, 'home-late', width, { fullPage: true });
    const cz = await playSession(page, { width, shots: true, wrongOnce: false });
    const wa = cz.compound.find(t => t.letter === 'v-wa');
    check(`${width}px 겹모음: 「ㅗ + ㅏ = ㅘ」·그림 연상(사과의 「과」)·소리 길잡이`, !!wa && wa.derive === 3 && wa.bold === '과' && wa.pic === true && /오와 아를 빨리/.test(wa.note),
      `만남 ${cz.met.join(',')} · ${JSON.stringify(cz.compound)}`);
    // 소리가 같은 모음: ㅚ를 만난 사람이 ㅙ를 만나면 「ㅚ와 ㅙ는 소리가 같아요」, ㅖ는 「ㅔ + 획」.
    await page.click('#done');
    await seed(key, { groups: [[U14, 'mastered', -3], [U5, 'mastered', -3], [U6, 'mastered', -3], [U7, 'mastered', -3], [U8, 'mastered', -3], [U9.slice(0, 5), 'mastered', -3]], difficulty: 2, demoSeen: ALL_DEMOS });
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    const sz = await playSession(page, { width, shots: false, wrongOnce: false });
    const wae = sz.compound.find(t => t.letter === 'v-wae'), ye = sz.compound.find(t => t.letter === 'v-ye');
    check(`${width}px 겹모음: 소리가 같은 ㅚ·ㅙ는 그렇게 짚고, ㅖ는 「ㅔ + 획」`, !!wae && /ㅚ와 ㅙ는 소리가 같아요/.test(wae.note) && (!ye || ye.stroke === 1),
      `만남 ${sz.met.join(',')} · ${JSON.stringify(sz.compound)}`);

    // 졸업 직전인 사람: 핵심 글자를 다 만났고 최근 스무 문항을 다 맞혔고 낱말을 이어서 다섯 번 읽었다. 이 회차를 다 맞히면 졸업 장면이 나온다.
    await page.click('#done');
    await seed(key, { groups: [[U14, 'mastered', -3], [U5, 'mastered', -3], [U6, 'mastered', -3], [U7, 'learning', 1]], difficulty: 3, wordStreak: 5,
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
