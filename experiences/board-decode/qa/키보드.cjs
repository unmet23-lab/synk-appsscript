'use strict';
// 게시판 해독을 키보드만으로 돌려 본다(2026-11-04 아르곤 화면 검수 지적에서): 화면을 다시 그려도 포커스가 문서 맨 앞으로 튀지 않는지, Esc가 어디서든 듣는지,
// 수첩 · 장면이 뜨면 뒤로 Tab이 새지 않는지, 판 도중 수첩에 맞힌 말이 보이는지, 화면 읽기 글이 빠지지 않는지, 전환 중에 판이 바뀌지 않는지.
//   node experiences/board-decode/qa/키보드.cjs
const path = require('node:path'), { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const PORT = Number(process.env.BOARD_QA_PORT || 5219), BASE = `http://127.0.0.1:${PORT}/index.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], check = (name, ok, more = '') => { console.log(`${ok ? 'ok ' : 'XX '} ${name}${ok || !more ? '' : ` — ${more}`}`); if (!ok) fails.push(name); };

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  let browser;
  try {
    await sleep(700);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const open = async (query) => {
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(() => { try { localStorage.clear(); } catch { /* 빈 저장 */ } });
      await page.goto(`${BASE}?${query}`);
      await sleep(250);
      return { page, errors };
    };
    const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) + '|' + (a.getAttribute('data-w') || a.getAttribute('data-memo') || a.getAttribute('data-panel') || '') : ''; });
    const inClue = (page) => page.evaluate(() => !!document.activeElement?.closest?.('.clue'));
    const inPanel = (page) => page.evaluate(() => !!document.activeElement?.closest?.('.panel'));
    const right = (page) => page.evaluate(() => { const s = window.__board.state(); const list = s.phase === 'patch' ? s.patchOrder : s.order[s.slot]; const k = ['f1', 'f2'][s.slot]; return list.findIndex((o) => (s.phase === 'patch' ? o.ok === true : o.ok === s.fork[k])); });
    const pressAnswer = async (page) => { await page.focus(`[data-reply="${await right(page)}"]`); await page.keyboard.press('Enter'); };

    { // 단서 카드
      const { page, errors } = await open('seed=7&round=laundry&auto=1');
      const word = await page.locator('.w').first().getAttribute('data-w');
      await page.focus('.w >> nth=0'); await page.keyboard.press('Enter'); await sleep(120);
      check('말을 누르면 단서 카드가 열린다', await page.locator('.clue').count() === 1);
      check('단서 카드로 포커스가 들어간다', await inClue(page), await active(page));
      await page.keyboard.press('Tab');
      check('Tab은 단서 카드 안의 단추로 간다', await inClue(page), await active(page));
      const memo = await page.locator('[data-memo]').first().getAttribute('data-memo');
      await page.focus('[data-memo] >> nth=0'); await page.keyboard.press('Enter'); await sleep(120);
      check('연필 메모를 고른 뒤 포커스가 그 뜻에 남는다', (await active(page)).endsWith(`|${memo}`), await active(page));
      await page.keyboard.press('Escape'); await sleep(120);
      check('Esc로 단서 카드가 닫힌다', await page.locator('.clue').count() === 0);
      check('닫으면 포커스가 그 말로 돌아간다', (await active(page)).endsWith(`|${word}`), await active(page));
      await page.focus('[data-sound]'); await page.keyboard.press('Enter'); await sleep(80);
      check('소리 단추는 눌러도 포커스가 남는다', await page.evaluate(() => document.activeElement?.hasAttribute('data-sound')), await active(page));
      check('오류 없음(단서 카드)', !errors.length, errors.join(' / '));
      await page.close();
    }
    { // 수첩 · 장면
      const { page, errors } = await open('seed=7&round=laundry&auto=1');
      await page.focus('.book-btn'); await page.keyboard.press('Enter'); await sleep(120);
      check('수첩이 열리면 포커스가 안으로 들어간다', await inPanel(page), await active(page));
      check('수첩 뒤 화면은 키보드로 닿지 않는다', await page.evaluate(() => document.querySelector('.game').inert === true));
      for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab');
      check('Tab을 여러 번 눌러도 게시판 말에 닿지 않는다', await page.evaluate(() => !document.activeElement?.closest?.('.game')), await active(page));
      await page.focus('.tabs [data-panel="album"]'); await page.keyboard.press('Enter'); await sleep(120);
      check('앨범으로 바꿔도 포커스가 안에 남는다', await inPanel(page), await active(page));
      await page.keyboard.press('Escape'); await sleep(120);
      check('Esc로 수첩이 닫힌다', await page.locator('.panel').count() === 0);
      check('닫으면 포커스가 수첩 단추로 돌아간다', await page.evaluate(() => document.activeElement?.classList.contains('book-btn')), await active(page));
      check('닫으면 뒤 화면이 다시 살아난다', await page.evaluate(() => document.querySelector('.game').inert === false));
      const wrong = await page.evaluate(() => { const s = window.__board.state(); return s.order[0].findIndex((o) => o.ok !== s.fork.f1); });
      await page.focus(`[data-reply="${wrong}"]`); await page.keyboard.press('Enter'); await sleep(150);
      check('틀림 장면으로 포커스가 간다', await page.evaluate(() => document.activeElement?.classList.contains('scene')), await active(page));
      check('틀림 장면 뒤 화면은 키보드로 닿지 않는다', await page.evaluate(() => document.querySelector('.game').inert === true));
      await page.keyboard.press('Escape'); await sleep(120);
      check('Esc로 틀림 장면이 닫히고 답장으로 돌아간다', await page.evaluate(() => document.activeElement?.classList.contains('opt')), await active(page));
      check('오류 없음(수첩)', !errors.length, errors.join(' / '));
      await page.close();
    }
    { // 한 판을 키보드로 끝까지, 판 도중 수첩, 화면 읽기 글
      const { page, errors } = await open('seed=7&round=laundry&auto=1');
      await sleep(120);
      const openLine = await page.evaluate(() => window.__board.state().open);
      check('첫 인사가 화면 읽기 글에 든다', (await page.textContent('#live')).includes(openLine), await page.textContent('#live'));
      await pressAnswer(page); await sleep(500);
      const after = await page.evaluate(() => window.__board.state().after);
      check('첫 칸 맞힌 뒤 반응이 화면 읽기 글에 든다', (await page.textContent('#live')).includes(after), await page.textContent('#live'));
      check('맞히면 포커스가 다음 답장으로 간다', await page.evaluate(() => document.activeElement?.classList.contains('opt')), await active(page));
      const got = await page.evaluate(() => window.__board.state().got);
      await page.click('.book-btn'); await sleep(120);
      const list = await page.locator('.panel .nb b').allTextContents();
      check('판 도중 수첩에 방금 맞힌 말이 보인다', got.every((w) => list.includes(w)), `${got} / ${list}`);
      await page.keyboard.press('Escape'); await sleep(120);
      await pressAnswer(page); await sleep(1000);
      check('정정 쪽지 뒤 포커스가 답장으로 간다', await page.evaluate(() => document.activeElement?.classList.contains('opt')), await active(page));
      await pressAnswer(page); await sleep(1000);
      check('끝 화면에 닿는다', await page.evaluate(() => window.__board.view() === 'end'));
      check('끝 화면으로 포커스가 간다', await page.evaluate(() => !!document.activeElement?.closest?.('.end')), await active(page));
      await page.focus('[data-peek] >> nth=0');
      const title = await page.locator('[data-peek]').first().getAttribute('data-peek');
      await page.keyboard.press('Enter'); await sleep(150);
      await page.keyboard.press('Escape'); await sleep(150);
      check('엿보기를 닫으면 그 칸으로 돌아간다', await page.evaluate(() => document.activeElement?.getAttribute('data-peek')) === title, await active(page));
      check('오류 없음(한 판)', !errors.length, errors.join(' / '));
      await page.close();
    }
    { // 앱 설정: 효과음 · 진동을 끄면 게임도 따른다
      const run = async (off) => {
        const page = await ctx.newPage();
        await page.addInitScript((keys) => {
          try { localStorage.clear(); for (const k of keys) localStorage.setItem(k, 'false'); } catch { /* 빈 저장 */ }
          window.__buzz = 0; navigator.vibrate = () => { window.__buzz += 1; return true; };
          window.__played = 0;
          const raw = window.AudioContext.prototype.createOscillator, buf = window.AudioContext.prototype.createBufferSource;
          window.AudioContext.prototype.createOscillator = function count() { window.__played += 1; return raw.call(this); };
          window.AudioContext.prototype.createBufferSource = function count() { window.__played += 1; return buf.call(this); };
        }, off ? ['synk.world.sound', 'synk.world.haptic'] : []);
        await page.goto(`${BASE}?seed=7&round=laundry&auto=1`); await sleep(250);
        const before = await page.evaluate(() => window.__played);
        await page.click(`[data-reply="${await right(page)}"]`); await sleep(500);
        const out = await page.evaluate((b) => ({ buzz: window.__buzz, sfx: window.__played - b, button: document.querySelectorAll('[data-sound]').length }), before);
        await page.close();
        return out;
      };
      const on = await run(false), off = await run(true);
      check('앱 설정이 켜져 있으면 소리 · 진동이 난다', on.buzz > 0 && on.sfx > 0, JSON.stringify(on));
      check('앱에서 효과음 · 진동을 끄면 게임도 조용하다', off.buzz === 0 && off.sfx === 0, JSON.stringify(off));
      check('앱에서 효과음을 끄면 게임의 소리 단추가 나오지 않는다', on.button === 1 && off.button === 0, JSON.stringify([on.button, off.button]));
    }
    { // 끝 화면 · 위 바
      const { page } = await open('seed=7&round=laundry&auto=1&lang=en');
      check('영어 화면의 위 바에 한국어 시각이 없다', !/[가-힣]/.test(await page.textContent('.where')), await page.textContent('.where'));
      await page.close();
      const end = await open('seed=7&round=laundry&auto=1');
      for (let i = 0; i < 2; i += 1) { await end.page.click(`[data-reply="${await right(end.page)}"]`); await sleep(1300); }
      await end.page.click(`[data-reply="${await right(end.page)}"]`); await sleep(1100);
      check('끝 화면에 다르게 답한 장면이 여섯 칸 다 나온다', await end.page.locator('[data-peek]').count() === 6, String(await end.page.locator('[data-peek]').count()));
      check('끝 화면 단추가 한 화면 안에 들어온다(390 × 844)', await end.page.evaluate(() => document.querySelector('[data-next]').getBoundingClientRect().bottom <= innerHeight), await end.page.evaluate(() => document.querySelector('[data-next]').getBoundingClientRect().bottom));
      await end.page.close();
    }
    { // 앨범은 끝 화면에서 엿본 그 글을 다시 보여 준다 · 저장에 없는 그림값은 없다
      const page = await ctx.newPage();
      await page.addInitScript(() => { try { localStorage.setItem('synk.board-decode.v1:device', JSON.stringify({ v: 1, album: { '놓친 콘서트': { pic: 'scene-concert', line: '엿본 그 글' } } })); } catch { /* 빈 저장 */ } });
      await page.goto(`${BASE}?seed=7`); await sleep(200);
      await page.click('.lobby-links [data-panel="album"]'); await sleep(120);
      await page.click('[data-album="놓친 콘서트"]'); await sleep(150);
      check('앨범에서 열면 끝 화면에서 본 글이 나온다', (await page.textContent('.scene')).includes('엿본 그 글'), await page.textContent('.scene'));
      await page.close();
    }
    { // 입구: 전환 중 판 바꾸기, 완료 표시, 잘못된 주소
      const { page, errors } = await open('seed=7');
      const first = await page.locator('[aria-pressed="true"][data-pick]').getAttribute('data-pick');
      const other = await page.locator('[aria-pressed="false"][data-pick]').first().getAttribute('data-pick');
      await page.evaluate((id) => { document.querySelector('[data-tear="1"]').click(); document.querySelector(`[data-pick="${id}"]`).click(); }, other);
      await sleep(400);
      check('뜯는 동안 다른 판을 눌러도 처음 고른 판이 열린다', await page.evaluate(() => window.__board.state()?.roundId) === first, await page.evaluate(() => window.__board.state()?.roundId));
      check('오류 없음(입구)', !errors.length, errors.join(' / '));
      await page.close();
      const bad = await open('seed=7&round=nope&auto=1');
      check('없는 판 주소는 오류 없이 입구로 간다', !bad.errors.length && await bad.page.evaluate(() => window.__board.view() === 'intro') , bad.errors.join(' / '));
      await bad.page.close();
      const done = await ctx.newPage();
      await done.addInitScript(() => { try { localStorage.setItem('synk.board-decode.v1:device', JSON.stringify({ v: 1, done: { laundry: 1 } })); } catch { /* 빈 저장 */ } });
      await done.goto(`${BASE}?seed=7`); await sleep(200);
      check('끝낸 판은 글자로도 알려 준다', (await done.locator('[data-pick="laundry"]').getAttribute('aria-label') || '').length > (await done.locator('[data-pick="laundry"]').textContent()).length, await done.locator('[data-pick="laundry"]').getAttribute('aria-label'));
      await done.close();
    }
  } finally {
    await browser?.close();
    server.kill();
  }
  console.log(fails.length ? `✗ ${fails.length}건 실패` : '✓ 키보드 시험 통과');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
