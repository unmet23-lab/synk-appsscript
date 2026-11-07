'use strict';
// PULSE 캐스팅북 실제 Chrome 회귀 — 공유 · 문의 · 넘기며 고르기.
// 10-18 GPT 가지 `codex/pulse-casting-fixes-20261018`(78447dc8b1)에서 그 가지의 화면 고침과 함께 만든 시험이다. 그 가지는 master에
// 합쳐지지 않아, 시험은 공용 작업본에 미추적으로만 남아 있었다. 11-06에 지금 캐스팅북(견본 목소리 11-03에 뺌 · 글 모양 고르기 10-26에 뺌 ·
// 상단 메뉴에서 「넘기며 고르기」를 보드의 「한 명씩」으로 옮김 · 영상으로 보기 11-05)에 맞췄고, 같은 날 화면 결함 셋(받은 패키지 재공유 ·
// 넘기며 고르기 이중 입력 · 상단 「문의하기」)을 그 가지와 같은 방법으로 지금 원고에 고쳤다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { createQaRun } = require('./lib/pulse-qa-evidence.cjs');
const ROOT = path.resolve(__dirname, '..');
const REL = 'docs/마케팅/PULSE_AI모델_캐스팅_20260930';
const DIR = path.join(ROOT, REL);
const read = file => fs.readFileSync(path.join(DIR, file), 'utf8');
const roster = JSON.parse(read('roster-v2.json')).models;
// 11-03 전에 나간 공유 주소는 셋째 자리에 목소리 번호가 있다. 지금 화면은 그 자리를 읽지 않고, 다시 공유하면 0으로 적는다.
const sharedHash = '#p-F02.1.0~F04.0.2';
const reshared = '#p-F02.1.0~F04.0.0';


// 원고 그대로 실행한다. build-site.cjs가 만드는 자료 꼴을 따르되 사진·영상은 무해한 SVG로 바꾸고, 실제 계정·바깥 주소는 쓰지 않는다.
function fixture() {
  const catalog = JSON.parse(read('catalog.json'));
  const wallBook = JSON.parse(read('wall.json'));
  const logic = require(path.join(DIR, 'site-src/casting-logic.js'));
  const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="24"><rect width="16" height="24" fill="#ddd"/></svg>');
  const shots = ['hero', 'angle-front', 'angle-left', 'angle-right', 'angle-back', 'exp-smile', 'exp-angry', 'exp-surprised', 'hair-1', 'hair-2', 'hair-3', 'fullbody', 'look-1', 'look-2', 'skin', 'hands', 'context'];
  const models = roster.map(m => {
    const extra = (catalog.models || {})[m.code] || {};
    const pub = { ...m, hair: m.hair.map(h => ({ label: h.label })), looks: m.looks.map(l => ({ label: l.label })),
      hero: { s: image, l: image, label: '기본' }, alt: null, shots: Object.fromEntries(shots.map(k => [k, { s: image, l: image, label: k }])),
      scenes: [], loop: null, stand: null, body: null, colors: [], tagged: [], face: extra.face || null,
      direction: extra.direction || null, bodyNote: extra.bodyNote || '', spec: false, shotCount: shots.length - 1,
      wall: { src: null, poster: image, line: wallBook.lines[m.code] || '' } };
    return Object.assign(pub, logic.tagModel(pub, catalog));
  });
  // 그룹 단체 컷은 굽지 않았으니 비운다 — 화면은 멤버 대표 사진을 이어 붙여 대신한다(빌드에 컷이 없을 때와 같다).
  const groups = (catalog.groups || []).map(g => ({ id: g.id, name: g.name, nameKo: g.nameKo || '', hanja: g.hanja || '', line: g.line || '', why: g.why || '', look: g.look || '',
    members: g.members.map(({ code, position, color, hex }) => ({ code, position, color, hex })), cuts: [] }));
  const data = { updated: catalog.updated, industries: catalog.industries, moods: catalog.moods, genderWords: catalog.genderWords || {}, compareShots: catalog.compareShots,
    shareBase: '', groups, models, wallOrder: wallBook.order, wallFirst: wallBook.first };
  const rep = { DATA: JSON.stringify(data).replace(/</g, '\\u003c'), LOGIC: read('site-src/casting-logic.js'), APP: read('site-src/app.js'),
    STYLE: read('site-src/style.css'), FONTS: '', FAVICON: image, LOGO: image };
  return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    read('site-src/template.html').replace(/@@([A-Z]+)@@/g, (_, key) => rep[key]) + '</html>';
}

test('PULSE: 공유·문의·스와이프 실제 Chrome 회귀', { timeout: 120_000 }, async t => {
  const { chromium } = require(require.resolve('playwright', { paths: [ROOT, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
  // 빌드 뒤에는 같은 동작을 생성된 HTML에서도 확인할 수 있다(site/는 git 밖 — 빌드한 작업본에서).
  const built = process.env.PULSE_QA_PAGE || '';
  assert.ok(['', 'index.html', 'artifact.html'].includes(built));
  const html = built ? read('site/' + built) : fixture();
  const run = createQaRun({ root: ROOT, label: 'pulse-casting-browser',
    sources: [REL + '/site-src', REL + '/roster-v2.json', REL + '/catalog.json', REL + '/wall.json', 'tests/pulse-casting-browser.test.cjs', ...(built ? [REL + '/site/' + built] : [])],
    target: { product: 'PULSE casting', page: built || 'current source with inert media' }, synthetic: true });
  const checks = [];
  const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
    if (built) {
      const file = path.resolve(DIR, 'site', '.' + new URL(req.url, 'http://local').pathname);
      if (file.startsWith(path.join(DIR, 'site') + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const type = { '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream';
        res.writeHead(200, { 'content-type': type }); return fs.createReadStream(file).pipe(res);
      }
    }
    res.writeHead(404); res.end();
  });
  let browser;
  t.after(async () => {
    await browser?.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    run.finish({ ok: checks.length > 0 && checks.every(check => check.ok), checks });
    console.log('PULSE 브라우저 근거: ' + path.relative(ROOT, run.manifestPath));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  run.update({ target: { url }, runtime: { browser: browser.version() } });

  async function withPage(pkg, fn, options = {}, ask = '') {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference', ...options });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => route.request().url().startsWith(url) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.addInitScript(({ pkg, ask }) => {
      localStorage.setItem('pulse-casting-v3', JSON.stringify({ pkg, sel: { M01: { hair: 2 } }, ask }));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } } });
    }, { pkg, ask });
    try { await fn(page); assert.deepEqual(errors, [], '브라우저 실행 오류가 없어야 한다'); }
    finally { await context.close(); }
  }
  async function check(name, fn) {
    await t.test(name, async () => {
      try { await fn(); checks.push({ name, ok: true }); }
      catch (error) { checks.push({ name, ok: false, error: error.message }); throw error; }
    });
  }
  const position = (page, n) => page.waitForFunction(n => document.querySelector('#deck-n')?.textContent.startsWith(n + ' /'), n);
  const pkgOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('pulse-casting-v3')).pkg);
  const copiedHash = page => page.evaluate(() => new URL(window.__copied).hash);
  // 부드러운 스크롤이 끝까지 가서 문의 글이 화면 위쪽에 섰는지(scroll-margin-top 76px, 문서 끝이면 끝까지)
  const inquiryVisible = page => page.waitForFunction(() => {
    const r = document.querySelector('#inq')?.getBoundingClientRect();
    if (!r) return false;
    const target = Math.min(r.top + scrollY - 76, document.documentElement.scrollHeight - innerHeight);
    return r.top >= 0 && r.top < innerHeight - 100 && Math.abs(scrollY - target) < 3;
  });
  const toSwipe = page => page.locator('.filters a.tg[href="#swipe"]'); // 보드 보기 고르기의 「한 명씩」

  await check('받은 패키지는 옛 주소의 모델·헤어를 보이고, 내 패키지의 공유 링크는 담은 모델·헤어를 담는다', async () => {
    await withPage(['M01'], async page => {
      await page.goto(url + sharedHash);
      assert.deepEqual(await page.locator('.comp-card').evaluateAll(els => els.map(el => el.dataset.code)), ['F02', 'F04']);
      assert.match(await page.locator('.comp-card[data-code="F02"] .cc-pick').innerText(), /^헤어\s+2 · /);
      await page.locator('.bar-right a.pkg').click();
      await page.locator('.comp-card[data-code="M01"]').waitFor();
      await page.locator('[data-act="share-link"]').click();
      assert.equal(await copiedHash(page), '#p-M01.2.0');
    });
  });

  await check('받은 패키지 재공유는 내 패키지와 무관하게 받은 모델·헤어를 유지한다', async () => {
    for (const own of [[], ['M01']]) await withPage(own, async page => {
      await page.goto(url + sharedHash);
      await page.locator('.comp-card').first().waitFor();
      await page.locator('[data-act="share-link"]').click();
      assert.equal(await copiedHash(page), reshared, '내 패키지 ' + JSON.stringify(own));
    });
  });

  await check('받은 패키지에서 빈 내 패키지로 이동해도 문의 글에 받은 모델이 섞이지 않는다', async () => {
    await withPage([], async page => {
      await page.goto(url + sharedHash);
      await page.locator('.comp-card').first().waitFor();
      await page.locator('.bar-right a.pkg').click();
      await page.getByRole('heading', { name: '아직 담은 모델이 없어요' }).waitFor();
      assert.equal(await page.locator('#view').getAttribute('data-shared'), '');
      const inquiry = await page.locator('#inq-text').inputValue();
      assert.doesNotMatch(inquiry, /F02|F04/);
      assert.match(inquiry, /\[찾는 모델\]/);
      assert.deepEqual(await pkgOf(page), []);
    });
  });

  await check('스와이프 애니메이션 중 빠른 클릭·혼합 클릭·방향키는 한 카드만 결정한다', async () => {
    for (const inputs of [['yes', 'yes'], ['no', 'no'], ['yes', 'no'], ['right', 'right'], ['left', 'left']]) {
      await withPage([], async page => {
        await page.goto(url + '#swipe');
        await page.locator('#dcard').waitFor();
        const first = await page.locator('[data-act="deck-yes"]').evaluate(el => el.previousElementSibling.getAttribute('href').slice(3));
        // 같은 프레임의 입력 두 개: 240ms 애니메이션 사이에 둘 다 들어오게 한다.
        await page.evaluate(inputs => {
          for (const input of inputs) {
            if (input === 'right' || input === 'left') document.dispatchEvent(new KeyboardEvent('keydown', { key: input === 'right' ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
            else document.querySelector('[data-act="deck-' + input + '"]').click();
          }
        }, inputs);
        await page.waitForTimeout(400);
        assert.match(await page.locator('#deck-n').innerText(), /^2 \/ /, inputs.join(','));
        assert.deepEqual(await pkgOf(page), ['yes', 'right'].includes(inputs[0]) ? [first] : []);
        await page.locator('[data-act="deck-yes"]').click();
        await position(page, 3);
      });
    }
  });

  await check('스와이프 결정 직후 다른 화면에 갔다 돌아와도 예전 타이머가 다음 모델을 넘기지 않는다', async () => {
    await withPage([], async page => {
      await page.goto(url + '#swipe');
      await page.locator('#dcard').waitFor();
      await page.evaluate(() => { document.querySelector('[data-act="deck-yes"]').click(); location.hash = '#board'; });
      await page.locator('#q').waitFor();
      await toSwipe(page).click();
      await page.waitForTimeout(400);
      assert.match(await page.locator('#deck-n').innerText(), /^2 \/ /);
      assert.equal((await pkgOf(page)).length, 1);
    });
  });

  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const dragRight = async page => {
    const box = await page.locator('#dcard').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 150, y, { steps: 5 }); await page.mouse.up();
  };

  // 11-07: 그룹 두 팀 칸이 휴대폰에서 약 1,000pt라 질문을 넣어도 앞에 세운 모델이 그 아래에 묻혔다 — 질문이 있으면 그룹 칸은 모델 목록 뒤로 간다
  const boardOrder = page => page.evaluate(() => {
    const teams = document.querySelector('.teams'), first = document.querySelector('.board .tile'), q = document.querySelector('#q');
    const top = el => Math.round(el.getBoundingClientRect().top + scrollY);
    return { atTop: teams.nextElementSibling?.matches('.filters') === true, atEnd: teams.previousElementSibling?.id === 'board-body', late: teams.classList.contains('late'),
      rank: first.querySelector('.rank')?.textContent || '', teamsFirst: top(teams) < top(first), gap: top(first) - Math.round(q.getBoundingClientRect().bottom + scrollY),
      hint: [...document.querySelectorAll('#heard .gh a')].map(a => a.getAttribute('href')).join(' ') };
  });
  const ask = async (page, text) => {
    await page.fill('#q', text);
    // 160ms 늦춘 뒤 save() → drawBoard()가 한 번에 돈다 — 저장된 글이 바뀌면 그리기도 끝난 것이다
    await page.waitForFunction(text => JSON.parse(localStorage.getItem('pulse-casting-v3')).ask === text, text);
    return boardOrder(page);
  };
  await check('휴대폰 폭에서 광고 내용을 적으면 그룹 칸이 모델 목록 뒤로 가고, 지우면 거르기 줄 위로 돌아온다', async () => {
    await withPage([], async page => {
      await page.goto(url + '#board');
      await page.locator('.teams .team').first().waitFor();
      let o = await boardOrder(page);
      assert.ok(o.atTop && !o.late && o.teamsFirst && !o.rank, '질문이 없으면 보드는 그대로(머리 → 그룹 칸 → 거르기 → 모델) ' + JSON.stringify(o));
      await page.fill('#q', '딸기 라떼 신메뉴');
      await page.locator('#heard', { hasText: '앞에 세웠어요' }).waitFor();
      o = await boardOrder(page);
      assert.ok(o.atEnd && o.late && !o.teamsFirst && o.rank === '01', '앞에 세운 01번이 그룹 칸보다 앞 ' + JSON.stringify(o));
      assert.ok(o.gap < 500, '질문 칸에서 01번까지 한 화면 안(지금 ' + o.gap + 'px)');
      await page.screenshot({ path: path.join(run.out, 'board-ask-mobile.png') });
      await page.locator('[data-act="ask-clear"]').click();
      o = await boardOrder(page);
      assert.ok(o.atTop && !o.late && o.teamsFirst, '지우면 제자리 ' + JSON.stringify(o));
      assert.equal(await page.evaluate(() => document.activeElement.id), 'q');
      await page.locator('[data-act="eg"]').first().click();
      assert.ok((await boardOrder(page)).atEnd, '예시 낱말을 눌러도 목록 뒤');
      // 그룹을 찾는 뜻이 분명한 글이면 그룹 칸이 찾는 답이라 제자리(추천 낱말표에 없어 0명이어도 입구가 남게 — 11-07 Fable P2)
      for (const text of ['걸그룹', '보이그룹 광고', 'K-pop', 'OUTBLUE', '오팔린 같은 느낌', '아이돌 화장품']) {
        o = await ask(page, text);
        assert.ok(o.atTop && !o.late && o.teamsFirst && !o.hint, '「' + text + '」은 그룹 칸 제자리 ' + JSON.stringify(o));
      }
      // 맨 「그룹」은 「타겟 그룹」과 「그룹 화장품」을 낱말로 못 가르니 칸은 목록 뒤로, 들은 말 줄에 그룹 입구 한 줄(11-07 다시 검수 P2 셋)
      for (const text of ['타겟 그룹 20대 여성 화장품', '그룹 레슨 필라테스', '그룹웨어 협업 앱', '그룹 화장품 광고']) {
        o = await ask(page, text);
        assert.ok(o.atEnd && o.late && o.rank === '01' && o.hint === '#g-OPALIN #g-OUTBLUE', '「' + text + '」은 목록 뒤 + 그룹 입구 ' + JSON.stringify(o));
      }
      o = await ask(page, '그룹 광고');
      assert.ok(o.atEnd && o.late && o.hint === '#g-OPALIN #g-OUTBLUE', '「그룹 광고」(추천 0명)도 목록 뒤 + 그룹 입구 ' + JSON.stringify(o));
      // 띄어 쓴 「아이 돌봄」은 아이돌이 아니다 — 육아 추천이 서고 그룹 칸은 목록 뒤, 입구 줄 없음
      o = await ask(page, '아이 돌봄 서비스 앱');
      assert.ok(o.atEnd && o.late && o.rank === '01' && !o.hint, '「아이 돌봄 서비스 앱」은 목록 뒤 ' + JSON.stringify(o));
      o = await ask(page, '딸기 라떼 신메뉴');
      assert.ok(o.atEnd && !o.hint, '그룹 말을 지우고 다른 광고 내용이면 다시 목록 뒤 · 입구 줄 없음 ' + JSON.stringify(o));
      // 한 글자씩 적는 동안 그룹 칸은 한 번만 옮긴다(첫 글자) — 160ms 늦춤보다 느리게 쳐 글자마다 다시 그린다
      await page.locator('[data-act="ask-clear"]').click();
      await page.evaluate(() => { window.__teamMoves = 0; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('teams')) window.__teamMoves++; }).observe(document.querySelector('#view'), { childList: true }); });
      await page.locator('#q').pressSequentially('타겟 그룹 20대 여성 화장품', { delay: 220, timeout: 20_000 });
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('pulse-casting-v3')).ask === '타겟 그룹 20대 여성 화장품');
      assert.equal(await page.evaluate(() => window.__teamMoves), 1, '적는 동안 그룹 칸이 오가지 않는다');
      assert.ok((await boardOrder(page)).atEnd);
    }, phone);
    await withPage([], async page => {
      await page.goto(url + '#board');
      await page.locator('.teams .team').first().waitFor();
      const o = await boardOrder(page);
      assert.ok(o.atEnd && o.late && o.rank === '01', '저장된 광고 내용으로 다시 열어도 그룹 칸은 목록 뒤 ' + JSON.stringify(o));
      // 모델 북에 갔다 돌아와도 같은 짜임(돌아온 자리 boardY가 맞게)
      await page.locator('.board .tile .tile-open').first().click();
      await page.locator('.book-head').waitFor();
      await page.goBack();
      await page.locator('#q').waitFor();
      assert.ok((await boardOrder(page)).atEnd);
    }, phone, '딸기 라떼 신메뉴');
  });

  await check('휴대폰 폭에서 오른쪽으로 끌면 한 명을 담고 다음 모델로 간다', async () => {
    await withPage([], async page => {
      await page.goto(url + '#swipe');
      await page.locator('#dcard').waitFor();
      const first = await page.locator('[data-act="deck-yes"]').evaluate(el => el.previousElementSibling.getAttribute('href').slice(3));
      await dragRight(page);
      await position(page, 2);
      assert.deepEqual(await pkgOf(page), [first]);
      await page.screenshot({ path: path.join(run.out, 'swipe-mobile.png') });
    }, phone);
  });

  await check('휴대폰 폭에서 드래그 직후 버튼을 눌러도 한 카드만 처리한다', async () => {
    await withPage([], async page => {
      await page.goto(url + '#swipe');
      await page.locator('#dcard').waitFor();
      await dragRight(page);
      await page.evaluate(() => document.querySelector('[data-act="deck-no"]').click());
      await page.waitForTimeout(400);
      assert.match(await page.locator('#deck-n').innerText(), /^2 \/ /);
      assert.equal((await pkgOf(page)).length, 1);
    }, phone);
  });

  await check('움직임 줄이기에서는 연속 결정·마지막 카드·처음부터 다시가 정상 동작한다', async () => {
    await withPage([], async page => {
      await page.goto(url + '#swipe');
      await page.locator('#dcard').waitFor();
      for (let n = 1; n <= roster.length; n++) await page.locator('[data-act="deck-yes"]').click();
      await page.getByRole('heading', { name: roster.length + '명을 패키지에 담았어요' }).waitFor();
      assert.equal((await pkgOf(page)).length, roster.length);
      await page.locator('[data-act="deck-restart"]').click();
      await position(page, 1);
    }, { reducedMotion: 'reduce' });
  });

  await check('문의하기는 다른 화면에서 누르면 패키지 문의 글로 이동하고, 패키지의 「문의 글 보기」는 받은 조합의 문의 글로 간다', async () => {
    await withPage(roster.map(m => m.code), async page => {
      await page.goto(url + '#pkg-inq');
      await inquiryVisible(page);
      await page.screenshot({ path: path.join(run.out, 'inquiry-own.png') });
      await page.locator('.bar-nav [data-nav="board"]').click();
      await page.locator('#q').waitFor();
      await page.locator('.bar-right a.cta').click();
      await inquiryVisible(page);
      assert.equal(await page.evaluate(() => location.hash), '#pkg-inq');
      await page.goto(url + sharedHash);
      await page.locator('.comp-card').first().waitFor();
      await page.waitForFunction(() => [...document.images].every(img => img.complete));
      await page.locator('.pk-head [data-act="to-inq"]').click();
      await inquiryVisible(page);
      assert.equal(await page.evaluate(() => location.hash), sharedHash);
      const inquiry = await page.locator('#inq-text').inputValue();
      assert.match(inquiry, /F02/); assert.match(inquiry, /F04/); assert.doesNotMatch(inquiry, /M01/);
    });
  });

  await check('문의하기는 같은 주소(#pkg-inq)에서 다시 눌러도 문의 글로 이동한다', async () => {
    await withPage(roster.map(m => m.code), async page => {
      await page.goto(url + '#pkg-inq');
      await inquiryVisible(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('.bar-right a.cta').click();
      await inquiryVisible(page);
      assert.equal(await page.evaluate(() => location.hash), '#pkg-inq');
      await page.screenshot({ path: path.join(run.out, 'inquiry-repeated.png') });
    });
  });

  await check('받은 패키지에서 상단 문의하기를 눌러도 받은 조합의 문의 글로 간다', async () => {
    await withPage(['M01'], async page => {
      await page.goto(url + sharedHash);
      await page.locator('.comp-card').first().waitFor();
      // Ctrl · ⌘ 클릭(새 탭)도 받은 조합으로 열리게 두 단추의 주소가 그 조합의 문의 글을 가리킨다
      const sharedInq = '#p-F02.1.0~F04.0.0-inq';
      assert.equal(await page.locator('.bar-right a.cta').getAttribute('href'), sharedInq);
      assert.equal(await page.locator('.pk-head [data-act="to-inq"]').getAttribute('href'), sharedInq);
      await page.waitForFunction(() => [...document.images].every(img => img.complete));
      await page.locator('.bar-right a.cta').click();
      await inquiryVisible(page);
      assert.equal(await page.evaluate(() => location.hash), sharedHash);
      const inquiry = await page.locator('#inq-text').inputValue();
      assert.match(inquiry, /F02/); assert.match(inquiry, /F04/); assert.doesNotMatch(inquiry, /M01/);
      await page.screenshot({ path: path.join(run.out, 'inquiry-shared.png') });
      // 그 주소를 새로 열면 받은 조합의 문의 글이고, 다른 화면으로 가면 상단 문의하기는 다시 내 패키지 문의 글을 가리킨다
      await page.goto(url + sharedInq);
      await inquiryVisible(page);
      assert.match(await page.locator('#inq-text').inputValue(), /F02/);
      await page.locator('.bar-nav [data-nav="board"]').click();
      await page.locator('#q').waitFor();
      assert.equal(await page.locator('.bar-right a.cta').getAttribute('href'), '#pkg-inq');
    });
  });
});
