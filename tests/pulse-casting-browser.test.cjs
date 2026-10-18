'use strict';
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
const sharedHash = '#p-F02.1.0~F04.0.2';

// 원고 그대로 실행한다. 사진만 무해한 SVG로 바꾸고 실제 계정·음성 API는 쓰지 않는다.
function fixture() {
  const catalog = JSON.parse(read('catalog.json'));
  const voices = JSON.parse(read('voices.json'));
  const logic = require(path.join(DIR, 'site-src/casting-logic.js'));
  const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="24"><rect width="16" height="24" fill="#ddd"/></svg>');
  const shots = ['hero', 'angle-front', 'angle-left', 'angle-right', 'angle-back', 'exp-smile', 'exp-angry', 'exp-surprised', 'hair-1', 'hair-2', 'hair-3', 'fullbody', 'look-1', 'look-2', 'skin', 'hands', 'context'];
  const models = roster.map(m => {
    const extra = catalog.models[m.code] || {};
    const pub = { ...m, hair: m.hair.map(h => ({ label: h.label })), looks: m.looks.map(l => ({ label: l.label })),
      hero: { s: image, l: image, label: '기본' }, shots: Object.fromEntries(shots.map(k => [k, { s: image, l: image, label: k }])),
      scenes: [], voices: voices.filter(v => v.name.startsWith(m.key + '-')).map(v => ({ label: v.label, note: v.note || '', text: v.text || '', src: '/unused.mp3', say: false })),
      motion: [], loop: null, stand: null, body: null, colors: [], tagged: [], face: extra.face || null,
      direction: extra.direction || null, bodyNote: extra.bodyNote || '', spec: false, script: '', shotCount: shots.length };
    return Object.assign(pub, logic.tagModel(pub, catalog));
  });
  const data = { ...catalog, say: null, shareBase: '', models };
  const rep = { DATA: JSON.stringify(data).replace(/</g, '\\u003c'), LOGIC: read('site-src/casting-logic.js'), APP: read('site-src/app.js'),
    STYLE: read('site-src/style.css'), FONTS: '', FAVICON: image, LOGO: image };
  return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    read('site-src/template.html').replace(/@@([A-Z]+)@@/g, (_, key) => rep[key]) + '</html>';
}

test('PULSE: 공유·문의·스와이프 실제 Chrome 회귀', { timeout: 90_000 }, async t => {
  const { chromium } = require(require.resolve('playwright', { paths: [ROOT, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
  // 빌드 뒤에는 같은 동작을 생성된 HTML에서도 확인할 수 있다.
  const built = process.env.PULSE_QA_PAGE || '';
  assert.ok(['', 'index.html', 'artifact.html'].includes(built));
  const html = built ? read('site/' + built) : fixture();
  const run = createQaRun({ root: ROOT, label: 'pulse-casting-browser',
    sources: [REL + '/site-src', REL + '/roster-v2.json', REL + '/catalog.json', REL + '/voices.json', 'tests/pulse-casting-browser.test.cjs', ...(built ? [REL + '/site/' + built] : [])],
    target: { product: 'PULSE casting', page: built || 'current source with inert media' }, synthetic: true });
  const checks = [];
  const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
    if (built) {
      const file = path.resolve(DIR, 'site', '.' + new URL(req.url, 'http://local').pathname);
      if (file.startsWith(path.join(DIR, 'site') + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const type = { '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' }[path.extname(file)] || 'application/octet-stream';
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

  async function withPage(pkg, fn, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference', ...options });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => route.request().url().startsWith(url) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.addInitScript(pkg => {
      localStorage.setItem('pulse-casting-v3', JSON.stringify({ pkg, sel: { M01: { hair: 2, voice: 1 } }, ask: '', format: 'kmong' }));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } } });
    }, pkg);
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
  const inquiryVisible = page => page.waitForFunction(() => {
    const r = document.querySelector('#inq')?.getBoundingClientRect();
    if (!r) return false;
    const target = Math.min(r.top + scrollY - 76, document.documentElement.scrollHeight - innerHeight);
    return r.top >= 0 && r.top < innerHeight - 100 && Math.abs(scrollY - target) < 3;
  });

  await check('받은 패키지 재공유는 내 패키지와 무관하게 모델·헤어·목소리를 유지한다', async () => {
    for (const own of [[], ['M01']]) await withPage(own, async page => {
      await page.goto(url + sharedHash);
      assert.deepEqual(await page.locator('.comp-card').evaluateAll(els => els.map(el => el.dataset.code)), ['F02', 'F04']);
      await page.locator('[data-act="share-link"]').click();
      assert.equal(await page.evaluate(() => new URL(window.__copied).hash), sharedHash);
      if (own.length) {
        await page.locator('.bar-right a.pkg').click();
        await page.locator('[data-act="share-link"]').click();
        assert.equal(await page.evaluate(() => new URL(window.__copied).hash), '#p-M01.2.1');
      }
    });
  });

  await check('받은 패키지에서 빈 내 패키지로 이동한 뒤 글 모양을 바꿔도 이전 모델이 섞이지 않는다', async () => {
    await withPage([], async page => {
      await page.goto(url + sharedHash);
      await page.locator('.comp-card').first().waitFor();
      await page.locator('.bar-right a.pkg').click();
      await page.getByRole('heading', { name: '아직 담은 모델이 없어요' }).waitFor();
      assert.equal(await page.locator('#view').getAttribute('data-shared'), '');
      for (const format of ['order', 'kmong']) {
        await page.locator('[data-act="format"][data-v="' + format + '"]').click();
        assert.doesNotMatch(await page.locator('#inq-text').inputValue(), /F02|F04/);
        assert.match(await page.locator('#inq-text').inputValue(), /찾는 모델/);
      }
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
      await page.locator('[data-act="ask-clear"], #q').first().waitFor();
      await page.locator('[data-nav="swipe"]').click();
      await page.waitForTimeout(400);
      assert.match(await page.locator('#deck-n').innerText(), /^2 \/ /);
      assert.equal((await pkgOf(page)).length, 1);
    });
  });

  await check('휴대폰 폭에서 드래그 직후 버튼을 눌러도 한 카드만 처리한다', async () => {
    await withPage([], async page => {
      await page.goto(url + '#swipe');
      const card = page.locator('#dcard');
      await card.waitFor();
      const box = await card.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 150, y, { steps: 5 }); await page.mouse.up();
      await page.evaluate(() => document.querySelector('[data-act="deck-no"]').click());
      await page.waitForTimeout(400);
      assert.match(await page.locator('#deck-n').innerText(), /^2 \/ /);
      assert.equal((await pkgOf(page)).length, 1);
      await page.screenshot({ path: path.join(run.out, 'swipe-mobile.png') });
    }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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

  await check('문의하기는 같은 주소에서 다시 눌러도 문의 글로 이동하며 받은 조합을 유지한다', async () => {
    await withPage(roster.map(m => m.code), async page => {
      await page.goto(url + '#pkg-inq');
      await inquiryVisible(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('.bar-right a.cta').click();
      await inquiryVisible(page);
      assert.equal(await page.evaluate(() => location.hash), '#pkg-inq');
      await page.screenshot({ path: path.join(run.out, 'inquiry-repeated.png') });
      await page.locator('[data-nav="board"]').click();
      await page.locator('#q').waitFor();
      await page.locator('.bar-right a.cta').click();
      await inquiryVisible(page);
      await page.goto(url + sharedHash);
      await page.locator('.comp-card').first().waitFor();
      await page.waitForFunction(() => [...document.images].every(img => img.complete));
      await page.locator('.bar-right a.cta').click();
      await inquiryVisible(page);
      assert.equal(await page.evaluate(() => location.hash), sharedHash);
      const inquiry = await page.locator('#inq-text').inputValue();
      assert.match(inquiry, /F02/); assert.match(inquiry, /F04/); assert.doesNotMatch(inquiry, /M01/);
      await page.screenshot({ path: path.join(run.out, 'inquiry-shared.png') });
    });
  });
});
