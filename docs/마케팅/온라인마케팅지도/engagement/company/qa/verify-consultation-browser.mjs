// Browser check for the customer consultation page (/consultation/), logged out and logged in, 1440 and 390 px.
// Starts verify-consultation-fixture.mjs in its own temporary folder (synthetic customer SYNK ID and AI, disposable data),
// drives headless Chrome through the whole page, then stops the fixture (which removes its folder).
// Flow: first screen → write text → find on this device → confirm / correct / exclude → answer every question → summary and copy →
//       log in → find with AI → save → reload and the resume line → two windows conflict → delete AI answers → delete the draft →
//       clear the screen → log out → the failed-login return.
// Usage: node qa/verify-consultation-browser.mjs   (screenshots and each one's visible text (.txt) go to SYNK_CONSULTATION_QA_OUT
//        or a new temporary folder, never the repo)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), here = dirname(fileURLToPath(import.meta.url));
const { chromium } = require(process.env.MESSENGER_PLAYWRIGHT || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = process.env.SYNK_CONSULTATION_QA_OUT || mkdtempSync(join(tmpdir(), 'synk-consultation-qa-')), tag = 'after';
mkdirSync(out, { recursive: true });
const fixtureTemp = mkdtempSync(join(tmpdir(), 'synk-consultation-fixture-'));
const port = 47900 + Math.floor(Math.random() * 90);
const child = spawn(process.execPath, [join(here, 'verify-consultation-fixture.mjs'), String(port)], { env: { ...process.env, TEMP: fixtureTemp, TMP: fixtureTemp }, stdio: ['pipe', 'pipe', 'inherit'] });
const base = await new Promise((done, fail) => {
  let text = '';
  child.stdout.on('data', chunk => { text += chunk; const line = text.split(/\r?\n/).find(row => row.startsWith('{')); if (line) done(JSON.parse(line).base); });
  child.on('exit', code => fail(new Error('fixture exited ' + code)));
  setTimeout(() => fail(new Error('fixture did not start')), 30000);
});
const SAMPLE = '저는 프리미어로 4K 영상을 편집해요. 지금 컴퓨터는 램 16GB예요. 유튜브에 올릴 브이로그를 매주 두 편 만들어요.';
const ANSWERS = { owned: 'have', 'video.app': 'premiere', 'video.res': '4k', 'video.load': 'heavy', 'current.kind': 'laptop', 'current.ram': '16',
  'current.os': 'win11', 'current.feel': 'slow', place: 'both', os: 'win', budget: '150_250', multitask: 'heavy', photo: 'web', code: 'web' };
const report = { checks: [], shots: [], problems: [] };
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); if (!ok) console.log('FAIL', name, detail); };
const settle = (page, ms = 300) => page.waitForTimeout(ms);
// 알림은 요청이 끝난 뒤에 바뀐다 — 고정 대기 대신 기대한 글이 올 때까지(최대 5초) 기다린다. 끝내 다르면 그때 글을 찍는다.
async function noticeHas(page, want) {
  const ok = await page.waitForFunction(w => (document.querySelector('#notice')?.textContent || '').includes(w), want, { timeout: 5000 }).then(() => true, () => false);
  if (!ok) console.log('  알림:', await page.locator('#notice').textContent(), '· 기대:', want);
  return ok;
}

async function audit(page, name) {
  const a = await page.evaluate(() => {
    const vw = visualViewport?.width ?? innerWidth;
    const small = [], hidden = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, text = node.textContent.trim();
      if (!text || !/[가-힣]/.test(text)) continue;
      const el = node.parentElement; if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || el.closest('.sr,[hidden]')) continue;
      const size = parseFloat(cs.fontSize); if (size < 13) small.push(`${size}px «${text.slice(0, 24)}»`);
      if (/DM Mono/.test(cs.fontFamily.split(',')[0])) small.push(`mono «${text.slice(0, 24)}»`);
    }
    // 가로로 넘치는 요소(본문 폭 밖)
    const wide = [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 1; }).slice(0, 5).map(e => e.tagName + '.' + e.className);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, vw, small: small.slice(0, 8), wide };
  });
  const ok = a.scrollWidth <= a.innerWidth && a.innerWidth <= a.vw + 1 && !a.wide.length;
  check(`${name}: 가로 넘침 없음`, ok, JSON.stringify(a));
  check(`${name}: 한글 13px 이상·모노 아님`, !a.small.length, a.small.join(' | '));
}
async function shoot(page, name, full = true) {
  const file = join(out, `${tag}-${name}.png`);
  // 전체 높이 캡처는 맨 위에서(따라오는 캡슐·요약 판이 제자리에 찍히게)
  if (full) { await page.evaluate(() => scrollTo(0, 0)); await settle(page, 250); }
  await page.screenshot({ path: file, fullPage: full });
  // 같은 이름의 .txt에 그때 보이는 글 전체(검수 묶음에 그대로 넣는다)
  writeFileSync(file.replace(/\.png$/, '.txt'), await page.evaluate(() => document.body.innerText));
  report.shots.push(file);
}
async function confirmAll(page) {
  for (let i = 0; i < 12; i++) {
    const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-proposal] button')].find(x => x.textContent.trim() === '맞아요' && !x.disabled); if (!b) return false; b.click(); return true; });
    if (!clicked) return i; await settle(page, 150);
  }
  return 12;
}
async function answerAll(page) {
  let n = 0;
  for (let i = 0; i < 24; i++) {
    const card = page.locator('#question [data-question]');
    if (!await card.count()) break;
    const about = await card.getAttribute('data-question');
    const want = ANSWERS[about];
    const target = want ? card.locator(`[data-answer="${want}"]`) : card.locator('[data-answer]').first();
    await (await target.count() ? target.first() : card.locator('[data-answer]').first()).click();
    await settle(page, 200);
    const confirm = page.locator('#question .confirm');
    if (await confirm.count() && await confirm.isEnabled().catch(() => false)) { await confirm.click(); await settle(page, 200); }
    n++;
  }
  return n;
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const width of [1440, 390]) {
    const mobile = width < 700, W = `${width}`;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: 'ko-KR' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
    await context.route('https://identity.example.test/**', async route => {
      const u = new URL(route.request().url()), back = new URL(u.searchParams.get('redirect_uri'));
      back.searchParams.set('state', u.searchParams.get('state')); back.searchParams.set('code', '11111111-1111-4111-8111-111111111111');
      await route.fulfill({ status: 302, headers: { Location: back.href } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/customer/computer-draft')) errors.push(`${r.status()} ${r.url()}`); });
    page.on('dialog', d => d.accept());

    // 1 첫 화면(로그인 전)
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#login').disabled, null, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready); await settle(page, 400);
    check(`${W} 첫 화면: 포스터·빈 사양 칸`, await page.locator('#poster').isVisible() && (!await page.locator('#summary').isVisible()));
    check(`${W} 첫 화면: 여기부터 골라요`, await page.locator('#start-here').isVisible());
    check(`${W} 첫 화면: 질문 빈 안내`, (await page.locator('#question').textContent()).includes('하는 일을 고르면 여기서 질문이 시작돼요.'));
    check(`${W} 첫 화면: 저장 한 줄`, await page.locator('#save-out').isVisible() && (await page.locator('#save-out-text').textContent()).includes('SYNK ID로 로그인하면'));
    check(`${W} 첫 화면: AI 안내`, (await page.locator('#ai-status').textContent()).includes('AI로 찾기는 SYNK ID로 로그인하면'));
    await audit(page, `${W} 첫 화면`); await shoot(page, `${W}-first`);

    // 2 글로 쓰기 → 이 기기에서 찾기 → 맞아요/고치기/빼기
    await page.fill('#source-text', SAMPLE); await settle(page);
    check(`${W} 글 칸 글자 수`, (await page.locator('#text-count').textContent()).startsWith(`${SAMPLE.length} /`));
    await page.click('#local-extract'); await settle(page);
    const props = await page.locator('[data-proposal]').count();
    check(`${W} 찾은 조건이 보임`, props >= 2, String(props));
    check(`${W} 같은 문장은 한 묶음`, await page.locator('.pgroup').count() === 1);
    check(`${W} 보류 문장 접기`, (await page.locator('.held summary').textContent()).includes('확인이 더 필요한 문장'));
    // 고치기: 영상 크기를 FHD로 고쳤다가 다시 4K
    const resRow = page.locator('[data-proposal]').filter({ hasText: '영상 크기' });
    await resRow.locator('button', { hasText: '고치기' }).click(); await settle(page, 150);
    check(`${W} 고치기 칸 열림`, await resRow.locator('.fix').isVisible());
    await resRow.locator('select').selectOption({ label: 'FHD 이하' }); await resRow.locator('button', { hasText: '이 값으로' }).click(); await settle(page);
    check(`${W} 고친 값이 반영`, (await page.locator('[data-proposal]').filter({ hasText: '영상 크기' }).textContent()).includes('FHD 이하'));
    await shoot(page, `${W}-found`);
    const confirmed = await confirmAll(page);
    check(`${W} 맞아요 누른 만큼 반영`, (await page.locator('[data-proposal] .led').allTextContents()).filter(t => t === '반영했어요').length >= 2, String(confirmed));
    // 영상 크기는 다시 4K로
    const resRow2 = page.locator('[data-proposal]').filter({ hasText: '영상 크기' });
    await resRow2.locator('button', { hasText: '고치기' }).click(); await resRow2.locator('select').selectOption({ label: '4K 이상' }); await resRow2.locator('button', { hasText: '이 값으로' }).click(); await settle(page);
    check(`${W} 할 일 카드 반영(영상 편집)`, await page.locator('[data-use="video"]').getAttribute('aria-pressed') === 'true');
    check(`${W} 여기부터 칩 사라짐`, !await page.locator('#start-here').isVisible());
    // 3 질문 중 화면
    check(`${W} 질문 카드`, await page.locator('#question [data-question]').count() === 1);
    check(`${W} 질문 물건 그림`, await page.locator('#question .askcard .art').count() === 1);
    check(`${W} 임시 요약 칩`, (await page.locator('#completion').textContent()) === '임시 조건 포함');
    check(`${W} 임시엔 선 단추`, (await page.locator('#copy-summary').getAttribute('class')).includes('soft'));
    await audit(page, `${W} 질문 중`); await shoot(page, `${W}-asking`);
    const answered = await answerAll(page);
    check(`${W} 질문 끝까지`, answered >= 4 && !(await page.locator('#question [data-question]').count()), String(answered));
    check(`${W} 끝 카드`, (await page.locator('#question').textContent()).includes('필요한 조건을 모두 확인했어요'));
    check(`${W} 요약 칩 끝`, (await page.locator('#completion').textContent()) === '필요한 확인 끝');
    check(`${W} 요약 제목 마디`, await page.locator('#summary-title .part').count() >= 2);
    check(`${W} 흰 알약 복사`, (await page.locator('#copy-summary').getAttribute('class')).includes('primary'));
    check(`${W} AI 제공자 이름 없음`, !/OpenAI|GPT-6|Luna/i.test(await page.locator('body').innerText()));
    // 다시 고르기: 예산 바꾸기
    await page.click('#edit-answers summary'); await settle(page, 150);
    const budget = page.locator('#answer-editor fieldset').filter({ hasText: '예산' });
    await budget.locator('[data-answer="gt250"]').click(); await settle(page);
    check(`${W} 다시 고르기 반영`, await page.locator('#answer-editor fieldset').filter({ hasText: '예산' }).locator('[data-answer="gt250"]').getAttribute('aria-pressed') === 'true');
    await page.click('#edit-answers summary');
    // 복사
    await page.locator('#copy-summary').scrollIntoViewIfNeeded(); await page.click('#copy-summary'); await settle(page, 300);
    await page.waitForFunction(() => /복사했어요|자동 복사가 막혔어요/.test(document.querySelector('#notice').textContent), null, { timeout: 5000 }).catch(() => {});
    const noticeText = await page.locator('#notice').textContent();
    check(`${W} 복사 알림`, noticeText.includes('복사했어요') || noticeText.includes('자동 복사가 막혔어요'), noticeText);
    if (noticeText.includes('복사했어요')) check(`${W} 복사한 글`, (await page.evaluate(() => navigator.clipboard.readText())).includes('[내 상황]'));
    await audit(page, `${W} 요약`); await shoot(page, `${W}-summary`);
    if (mobile) {
      await page.evaluate(() => document.querySelector('#text').scrollIntoView({ block: 'start' })); await settle(page, 500);
      check(`${W} 아래 막대 보임`, await page.locator('#dock').isVisible());
      await shoot(page, `${W}-dock`, false);
      await page.evaluate(() => document.querySelector('#summary').scrollIntoView({ block: 'center' })); await settle(page, 500);
      check(`${W} 요약이 보이면 막대 숨김`, !await page.locator('#dock').isVisible());
    }

    // 4 로그인(쓰던 내용은 사라진다는 확인 → 수락) → AI로 찾기 → 저장
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#login');
    await page.waitForSelector('#logout:not([hidden])', { timeout: 15000 }); await settle(page, 600);
    check(`${W} 로그인: 이름 칩`, (await page.locator('#me').textContent()).includes('하늘 님'));
    check(`${W} 로그인: 저장 판`, await page.locator('#save-in').isVisible());
    await shoot(page, `${W}-login`);
    await page.fill('#source-text', SAMPLE); await settle(page, 300);
    check(`${W} 로그인: 동의 문장`, (await page.locator('#ai-status').textContent()).includes('외부 AI 서비스에 보내'));
    await page.click('#ai-extract');
    check(`${W} AI 진행 중 그만두기`, await page.locator('#ai-cancel').isVisible());
    await page.waitForSelector('[data-proposal]', { timeout: 20000 }); await settle(page, 500);
    check(`${W} AI 찾은 조건`, await page.locator('[data-proposal]').count() >= 3);
    check(`${W} AI 횟수 안내`, /오늘 \d번 더 쓸 수 있어요/.test(await page.locator('#ai-status').textContent()));
    await audit(page, `${W} AI로 찾기`); await shoot(page, `${W}-login-ai`);
    await confirmAll(page); await answerAll(page);
    await page.click('#save-draft'); await settle(page, 800);
    check(`${W} 저장 알림`, await noticeHas(page,'내 계정에 저장했어요'));
    check(`${W} 저장 상태`, (await page.locator('#draft-head').textContent()) === '저장한 상담이 있어요');
    await page.click('#privacy-panel summary'); await settle(page, 200);
    check(`${W} AI 답 보관 상태`, /보관 중인 AI 답 \d개/.test(await page.locator('#privacy-status').textContent()));
    await audit(page, `${W} 저장 뒤`); await shoot(page, `${W}-saved`);

    // 5 새로고침 → 불러오기 줄 → 불러오기
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#logout:not([hidden])', { timeout: 15000 }); await settle(page, 800);
    check(`${W} 불러오기 줄`, await page.locator('#resume').isVisible() && (await page.locator('#resume-text').textContent()).includes('저장한 상담이 있어요'));
    await shoot(page, `${W}-resume`, false);
    await page.click('#resume-load'); await settle(page, 800);
    check(`${W} 불러온 글`, (await page.inputValue('#source-text')) === SAMPLE);
    check(`${W} 불러온 요약`, await page.locator('#summary').isVisible());

    // 6 두 창 충돌: 둘째 창이 먼저 저장 → 첫 창 저장은 충돌 안내
    const other = await context.newPage(); other.on('dialog', d => d.accept());
    await other.goto(base, { waitUntil: 'domcontentloaded' }); await other.waitForSelector('#logout:not([hidden])', { timeout: 15000 }); await settle(other, 600);
    await other.click('#resume-load'); await settle(other, 600);
    await other.locator('[data-use="photo"]').click(); await settle(other, 200);
    await other.click('#save-draft'); await settle(other, 800);
    await other.close();
    await page.locator('[data-use="game"]').click(); await settle(page, 200);
    await page.click('#save-draft'); await settle(page, 900);
    check(`${W} 충돌 안내`, await noticeHas(page,'먼저 저장됐어요'));
    check(`${W} 충돌 상태 판`, (await page.locator('#draft-head').textContent()).includes('먼저 저장된 상담'));
    await shoot(page, `${W}-conflict`);
    await page.click('#load-draft'); await settle(page, 900);
    check(`${W} 충돌 뒤 불러오기`, await noticeHas(page,'불러왔어요') && await page.locator('[data-use="photo"]').getAttribute('aria-pressed') === 'true');

    // 7 AI 답 지우기 · 저장한 상담 지우기 · 화면 비우기 · 로그아웃
    await page.click('#privacy-panel summary').catch(() => {}); await settle(page, 200);
    if (!await page.locator('#delete-ai').isVisible()) { await page.click('#privacy-panel summary'); await settle(page, 200); }
    await page.click('#delete-ai'); await settle(page, 800);
    check(`${W} AI 답 지움`, await noticeHas(page,'보관된 AI 답을 지웠어요'));
    await page.click('#delete-draft'); await settle(page, 800);
    check(`${W} 저장한 상담 지움`, await noticeHas(page,'저장한 상담과 화면의 내용을 지웠어요') && (await page.inputValue('#source-text')) === '');
    await page.locator('[data-use="web"]').click(); await settle(page, 200);
    check(`${W} 비우기 단추 보임`, await page.locator('#reset-local').isVisible());
    await page.click('#reset-local'); await settle(page, 300);
    check(`${W} 화면 비움`, await noticeHas(page,'화면을 비웠어요') && await page.locator('#poster').isVisible());
    await page.click('#logout'); await settle(page, 800);
    check(`${W} 로그아웃`, await noticeHas(page,'로그아웃했어요') && await page.locator('#login').isVisible());

    // 8 로그인 실패로 돌아온 경우
    await page.goto(base + '?login=failed', { waitUntil: 'domcontentloaded' }); await settle(page, 600);
    check(`${W} 로그인 실패 안내`, await noticeHas(page,'로그인을 마치지 못했어요') && !page.url().includes('login=failed'));

    check(`${W} 콘솔 오류·실패 요청 없음`, !errors.length, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  child.stdin.write('stop\n');
  await new Promise(done => { child.once('exit', done); setTimeout(done, 10000); });
  if (resolve(dirname(fixtureTemp)) === resolve(tmpdir()) && basename(fixtureTemp).startsWith('synk-consultation-fixture-')) rmSync(fixtureTemp, { recursive: true, force: true });
}
writeFileSync(join(out, `${tag}-report.json`), JSON.stringify(report, null, 2));
const failed = report.checks.filter(c => !c.ok);
console.log(`checks ${report.checks.length - failed.length}/${report.checks.length} · screenshots ${out}`);
if (failed.length) process.exitCode = 1;
