// 고객 SNS 게시물 검토(/social-review) 브라우저 점검(2026-10-23). verify-social-review-fixture.mjs를 제 임시 폴더로 띄우고
// (실제 회사 서버 코드·임시 SQLite·가짜 SNS 공급자), 헤드리스 Chrome으로 장면마다 1440·390을 찍은 뒤 흐름을 눌러 본다.
// 확인: 가로 넘침 · 한글 13px 미만 · 한글에 모노 글꼴 · 브랜드 글꼴(SUIT·SYNK Latin·DM Mono)을 받아 씀(SUIT는 preload로 한 번)과 글꼴 CSP 거절 없음 ·
//       콘솔 오류(거둔 링크·고친 뒤 닫힌 옛 링크의 410 한 번씩만 예상) · 실패 요청 · 누를 때만 파일 받기 ·
//       빈 의견 막기와 그 안내 자리 · 이름 칸 Enter가 승인이 되지 않음 · 수정 요청/승인 뒤 상태 · 답한 뒤에도 펼친 영상 유지 · 닫힌 링크 ·
//       고친 판(10-24)의 바뀐 곳 칩·판·그때 의견·「전/후」·낱말 표시·카드 안 표·게시물에서 보기·좁은 화면 접기.
// 쓰는 법: node qa/verify-social-review-browser.mjs   (그림과 보이는 글(.txt)은 SYNK_SOCIAL_REVIEW_QA_OUT 또는 새 임시 폴더로 — 저장소에는 안 쓴다)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), here = dirname(fileURLToPath(import.meta.url));
const { chromium } = require(process.env.MESSENGER_PLAYWRIGHT || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = process.env.SYNK_SOCIAL_REVIEW_QA_OUT || mkdtempSync(join(tmpdir(), 'synk-social-review-qa-'));
mkdirSync(out, { recursive: true });
const fixtureTemp = mkdtempSync(join(tmpdir(), 'synk-social-review-fixture-run-'));
const port = 47950 + Math.floor(Math.random() * 40);
const child = spawn(process.execPath, [join(here, 'verify-social-review-fixture.mjs'), String(port)], { env: { ...process.env, TEMP: fixtureTemp, TMP: fixtureTemp }, stdio: ['pipe', 'pipe', 'inherit'] });
const { links } = await new Promise((done, fail) => {
  let text = '';
  child.stdout.on('data', chunk => { text += chunk; const line = text.split(/\r?\n/).find(row => row.startsWith('{')); if (line) done(JSON.parse(line)); });
  child.on('exit', code => fail(new Error('fixture exited ' + code)));
  setTimeout(() => fail(new Error('fixture did not start')), 90000);
});
const report = { at: new Date().toISOString(), checks: [], shots: [] };
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); if (!ok) console.log('FAIL', name, detail); };
const VIEWS = { 1440: { viewport: { width: 1440, height: 900 } }, 390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const browser = await chromium.launch({ channel: 'chrome' });

async function open(scene, width) {
  const context = await browser.newContext({ ...VIEWS[width], locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(), problems = { console: [], failed: [], requests: [] };
  page.on('console', message => { if (message.type() === 'error') problems.console.push(message.text()); });
  page.on('pageerror', error => problems.console.push(String(error)));
  page.on('requestfailed', request => problems.failed.push(request.url()));
  page.on('request', request => { if (request.url().includes('/api/social-review/')) problems.requests.push(new URL(request.url()).pathname); });
  await page.goto(links[scene], { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('review-notice')?.hidden, null, { timeout: 15000 }).catch(() => {});
  return { context, page, problems };
}
async function audit(page, name) {
  const a = await page.evaluate(() => {
    const small = [], mono = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, text = node.textContent.trim();
      if (!text || !/[가-힣]/.test(text)) continue;
      const el = node.parentElement; if (!el || el.closest('[hidden]') || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el), size = parseFloat(cs.fontSize);
      if (size < 13) small.push(`${size}px «${text.slice(0, 20)}»`);
      if (/mono|consolas|menlo|courier/i.test(cs.fontFamily.split(',')[0])) mono.push(`«${text.slice(0, 20)}»`);
    }
    const width = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > width + 1 && !e.closest('.media.is-strip'); }).slice(0, 5).map(e => e.tagName + '.' + e.className);
    return { scrollWidth: document.documentElement.scrollWidth, width, small: small.slice(0, 6), mono: mono.slice(0, 6), wide };
  });
  check(`${name}: 가로 넘침 없음`, a.scrollWidth <= a.width && !a.wide.length, JSON.stringify(a));
  check(`${name}: 한글 13px 이상`, !a.small.length, a.small.join(' | '));
  check(`${name}: 한글에 모노 글꼴 없음`, !a.mono.length, a.mono.join(' | '));
}
// 글꼴은 고객 상담과 같은 /consultation/assets/ 파일이다(CSP font-src 'self', 10-24). 막히면 기기 글꼴로 조용히 바뀌므로 받은 상태를 본다.
async function fonts(page, name, problems) {
  const f = await page.evaluate(async () => { await document.fonts.ready;
    return { suit: document.fonts.check('16px "SUIT Variable"'), faces: [...document.fonts].map(face => ({ family: face.family.replace(/["']/g, ''), weight: face.weight, status: face.status })),
      suitFetches: performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname === '/consultation/assets/SUIT-Variable.woff2').map(entry => entry.initiatorType) }; });
  const loaded = family => f.faces.some(face => face.family === family && face.status === 'loaded'), faces = JSON.stringify(f.faces);
  check(`${name}: SUIT 글꼴을 받아 씀`, f.suit && loaded('SUIT Variable'), faces);
  // HTML의 preload가 CSS보다 먼저 받고, CSS의 @font-face가 그 받은 것을 그대로 쓴다(crossorigin이 어긋나면 두 번 받는다)
  check(`${name}: SUIT는 preload로 한 번만 받음`, f.suitFetches.length === 1 && f.suitFetches[0] === 'link', f.suitFetches.join(','));
  check(`${name}: SYNK Latin·DM Mono도 받음`, loaded('SYNK Latin') && loaded('DM Mono'), faces);
  check(`${name}: 글꼴 받기 실패 없음`, !f.faces.some(face => face.status === 'error'), faces);
  check(`${name}: 글꼴 CSP 거절 없음`, !problems.console.some(text => /font/i.test(text) && /Content Security Policy/i.test(text)), problems.console.join(' | '));
}
async function shot(page, name) {
  const file = join(out, name + '.png');
  await page.screenshot({ path: file, fullPage: true });
  writeFileSync(join(out, name + '.txt'), await page.evaluate(() => document.body.innerText));
  report.shots.push(file);
}

// 1) 장면마다 처음 화면(파일을 열기 전), 1440·390
for (const scene of ['daily', 'customer', 'approved', 'optional', 'long', 'revoked', 'revised', 'before', 'notoken']) for (const width of [1440, 390]) {
  const { context, page, problems } = await open(scene, width), name = `${scene}-${width}`;
  await audit(page, name); await fonts(page, name, problems); await shot(page, name);
  const expectedConsole = ['revoked', 'before'].includes(scene) ? 1 : 0;
  check(`${name}: 콘솔 오류 ${expectedConsole}개`, problems.console.length === expectedConsole && problems.console.every(text => /410/.test(text)), problems.console.join(' | '));
  check(`${name}: 실패 요청 없음`, !problems.failed.length, problems.failed.join(' | '));
  if (scene !== 'notoken') check(`${name}: 열 때 검토 요청은 open 하나(파일은 누를 때만)`, problems.requests.length === 1 && problems.requests[0] === '/api/social-review/open', problems.requests.join(','));
  else check(`${name}: 열쇠가 없으면 요청하지 않음`, !problems.requests.length, problems.requests.join(','));
  if (['revoked', 'before', 'notoken'].includes(scene)) check(`${name}: 닫힌 링크 머리`, (await page.textContent('#review-heading')) === '검토 링크를 열 수 없어요');
  if (!['revised', 'before', 'revoked', 'notoken'].includes(scene)) check(`${name}: 첫 판에는 바뀐 곳 판·칩이 없음`, !(await page.$('.changes')) && !(await page.$('.fact-diff')));
  await context.close();
}

// 1-1) 고친 판(10-24): 머리 칩 → 바뀐 곳 판(그때 의견 · 접힌 항목) → 펼친 「전/후」와 낱말 표시 → 카드 안 표 → 「게시물에서 보기」, 답한 뒤에도 펼친 채
for (const width of [1440, 390]) {
  const { context, page, problems } = await open('revised', width), name = `revised-${width}`;
  const facts = await page.textContent('#review-facts'), sheet = await page.textContent('.changes');
  check(`${name}: 머리 칩 「바뀐 곳 5」`, facts.includes('바뀐 곳 5'), facts);
  check(`${name}: 판 제목과 견준 판`, sheet.includes('지난 판과 바뀐 곳') && sheet.includes('수정을 요청한 판(버전 1)과 견줬어요'), sheet.slice(0, 160));
  check(`${name}: 그때 남긴 의견 둘`, sheet.includes('두 번째 사진은 원두가') && sheet.includes('가격 문구는 빼 주세요'));
  const summaries = await page.$$eval('.change summary', list => list.map(s => s.textContent)), groups = await page.$$eval('.change-group', list => list.map(g => g.textContent));
  check(`${name}: 게시물 전체 다음에 계정 소제목 하나`, summaries[0].startsWith('올라가는 때') && groups.length === 1 && groups[0] === '모루 커피 · 인스타그램', summaries[0] + ' / ' + groups.join(' | '));
  for (const want of ['문구뺀 줄 1', '사진 2 바뀜', '첫 댓글', '문구 2 고침', '10월'])
    check(`${name}: 바뀐 곳 「${want}」`, summaries.some(text => text.includes(want)), summaries.join(' | '));
  check(`${name}: 다섯 항목은 처음에 접혀 있음`, (await page.$$eval('.change details', list => list.filter(d => d.open).length)) === 0);
  if (width === 390) {
    check(`${name}: 좁은 화면은 셋까지만 먼저`, (await page.$$eval('li.change', list => list.filter(li => !li.hidden).length)) === 3);
    await page.click('text=바뀐 곳 5개 모두 보기');
    check(`${name}: 모두 보기를 누르면 다섯`, (await page.$$eval('li.change', list => list.filter(li => !li.hidden).length)) === 5);
  } else check(`${name}: 넓은 화면은 다섯 모두`, !(await page.$('text=바뀐 곳 5개 모두 보기')) && (await page.$$eval('li.change', list => list.filter(li => !li.hidden).length)) === 5);
  await page.click('.change-label:text-is("문구")');
  const removed = await page.$$eval('.change details[open] .diff-row.is-removed', rows => rows.map(r => r.textContent));
  check(`${name}: 뺀 가격 줄이 「전」으로`, removed.some(text => text.startsWith('전') && text.includes('가격은 한 상자 1만 2천 원이에요.')), removed.join(' | '));
  await page.click('.change-label:text-is("반복 게시 문구")');
  const words = await page.$$eval('.change details[open] del, .change details[open] ins', list => list.map(n => n.tagName + ':' + n.textContent));
  check(`${name}: 반복 문구의 낱말만 칠함(92도면 → 90도면)`, words.includes('DEL:92도면') && words.includes('INS:90도면'), words.join(' | '));
  const marks = await page.$$eval('.post .tag, .post .frame-tag, .when h2 .tag', list => list.map(n => n.textContent));
  for (const want of ['바뀐 사진', '문구 바뀜', '바뀜']) check(`${name}: 카드 안 표 「${want}」`, marks.includes(want), marks.join(' | '));
  await audit(page, name + '-open'); await shot(page, name + '-open');
  await page.click('.change details[open] .view-post >> nth=0'); await page.waitForTimeout(700);
  const focus = await page.evaluate(() => { const a = document.activeElement, r = a?.getBoundingClientRect(); return { tag: a?.tagName, cls: a?.className, top: r?.top, h: innerHeight }; });
  check(`${name}: 「게시물에서 보기」로 그 카드에 초점·화면 안`, focus.tag === 'ARTICLE' && focus.cls === 'post' && focus.top >= -2 && focus.top < focus.h, JSON.stringify(focus));
  await page.click('.fact-diff button'); await page.waitForTimeout(700);
  const back = await page.evaluate(() => { const a = document.activeElement, r = a?.getBoundingClientRect(); return { cls: a?.className, top: r?.top }; });
  check(`${name}: 머리 칩으로 바뀐 곳 판에`, /changes/.test(back.cls || '') && back.top >= -2 && back.top < 200, JSON.stringify(back));
  await page.fill('#review-comment', '바뀐 곳 확인했어요.'); await page.click('button[value="comment"]');
  await page.waitForFunction(() => document.getElementById('review-result')?.textContent.includes('저장'), null, { timeout: 15000 }).catch(() => {});
  check(`${name}: 답한 뒤에도 바뀐 곳 판을 다시 그리지 않음(펼친 항목 그대로)`, (await page.$$eval('.change details', list => list.filter(d => d.open).length)) === 2 && (await page.textContent('#review-result')).includes('의견을 저장했어요'));
  check(`${name}: 콘솔 오류 없음`, !problems.console.length, problems.console.join(' | '));
  await context.close();
}

// 2) 고객 장면 390: 여러 장 사진 띠를 펼치고 반복 문구·설정이 보이는지
{
  const { context, page } = await open('customer', 390);
  const buttons = await page.$$('#review-content button.load');
  check('customer-390: 파일 보기 단추 셋(사진 둘·영상 하나)', buttons.length === 3, String(buttons.length));
  for (const button of buttons) { await button.click(); await page.waitForTimeout(300); }
  await page.waitForFunction(() => document.querySelectorAll('#review-content img[src^="blob:"],#review-content video[src^="blob:"]').length === 3, null, { timeout: 15000 }).catch(() => {});
  check('customer-390: 세 파일이 blob으로 보임', (await page.$$eval('#review-content img[src^="blob:"],#review-content video[src^="blob:"]', list => list.length)) === 3);
  const text = await page.textContent('#review-content');
  for (const want of ['문구 2', '문구 3', '함께 보내는 설정', '첫 댓글', '7일마다 올려요 · 처음을 포함해 모두 3번', '모루 커피 2곳']) check(`customer-390: 「${want}」`, text.includes(want));
  await audit(page, 'customer-390-media'); await shot(page, 'customer-390-media');
  await context.close();
}

// 3) 유호님 장면 390: 영상 펼치기 → 빈 의견 막기 → 이름 칸 Enter → 수정 요청 → 승인
{
  const { context, page, problems } = await open('daily', 390);
  for (const button of await page.$$('#review-content button.load')) { await button.click(); await page.waitForTimeout(300); }
  await page.waitForFunction(() => document.querySelectorAll('#review-content video[src^="blob:"]').length === 2, null, { timeout: 15000 }).catch(() => {});
  check('daily-390: 영상 둘이 펼쳐짐', (await page.$$eval('#review-content video[src^="blob:"]', list => list.length)) === 2);
  const before = problems.requests.length;
  await page.click('button[value="comment"]');
  check('daily-390: 빈 의견은 보내지 않음', problems.requests.length === before);
  check('daily-390: 안내가 답하기 칸 안에', await page.isVisible('#review-form-error') && !(await page.isVisible('#review-error')), await page.textContent('#review-form-error'));
  check('daily-390: 초점이 의견 칸으로', await page.evaluate(() => document.activeElement?.id === 'review-comment'));
  await page.fill('#review-name', '유호'); await page.press('#review-name', 'Enter'); await page.waitForTimeout(400);
  check('daily-390: 이름 칸 Enter는 승인이 되지 않음', problems.requests.length === before && (await page.textContent('#review-facts')).includes('검토 전'));
  await page.fill('#review-comment', '첫 2초 자막이 조금 빨라요.\n0.5초만 늦춰 주세요.');
  await page.click('button[value="reject"]');
  await page.waitForFunction(() => document.getElementById('review-result')?.textContent.includes('저장'), null, { timeout: 15000 }).catch(() => {});
  check('daily-390: 수정 요청 저장', (await page.textContent('#review-result')).includes('수정 요청을 저장했어요'));
  check('daily-390: 머리 상태가 수정 요청됨', (await page.textContent('#review-facts')).includes('수정 요청됨'));
  check('daily-390: 의견 흐름에 수정 요청', (await page.textContent('#review-feedback')).includes('0.5초만 늦춰 주세요'));
  check('daily-390: 답한 뒤에도 영상이 그대로', (await page.$$eval('#review-content video[src^="blob:"]', list => list.length)) === 2);
  check('daily-390: 의견 칸이 비워짐', (await page.inputValue('#review-comment')) === '');
  await audit(page, 'daily-390-rejected'); await shot(page, 'daily-390-rejected');
  await page.click('button[value="approve"]');
  await page.waitForFunction(() => document.getElementById('review-facts')?.textContent.includes('승인됨'), null, { timeout: 15000 }).catch(() => {});
  check('daily-390: 승인 뒤 상태', (await page.textContent('#review-facts')).includes('승인됨') && (await page.textContent('#review-result')).includes('승인을 저장했어요'));
  check('daily-390: 콘솔 오류 없음', !problems.console.length, problems.console.join(' | '));
  await shot(page, 'daily-390-approved');
  await context.close();
}

// 4) 결정 막대(390, 필수 아닌 장면 — 답하기 전): 처음엔 떠 있고, 답하기 칸에 닿으면 비키고, 막대에서 승인하면 칸으로 내려가 결과를 보인다
{
  const { context, page, problems } = await open('optional', 390);
  check('optional-390: 처음엔 결정 막대가 보임', await page.isVisible('#review-dock'));
  const shield = await page.evaluate(() => { const dock = document.getElementById('review-dock').getBoundingClientRect(); return dock.bottom <= innerHeight && dock.top > innerHeight - 120; });
  check('optional-390: 막대는 화면 아래에', shield);
  await page.$eval('#review-form', el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
  check('optional-390: 답하기 칸이 보이면 막대가 비킴', !(await page.isVisible('#review-dock')));
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
  check('optional-390: 위로 가면 막대가 다시', await page.isVisible('#review-dock'));
  await page.click('#review-dock-approve');
  await page.waitForFunction(() => document.getElementById('review-facts')?.textContent.includes('승인됨'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  const box = await page.$eval('#review-form', el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; });
  check('optional-390: 막대 승인 → 저장 결과가 보이는 칸으로', (await page.textContent('#review-result')).includes('승인을 저장했어요') && box.top < box.h && box.bottom > 0, JSON.stringify(box));
  check('optional-390: 승인 뒤 막대 없음', !(await page.isVisible('#review-dock')));
  check('optional-390: 콘솔 오류 없음', !problems.console.length, problems.console.join(' | '));
  await shot(page, 'optional-390-dock-approved');
  await context.close();
}
{
  const { context, page } = await open('daily', 1440);
  check('daily-1440: 넓은 화면엔 결정 막대 없음', !(await page.isVisible('#review-dock')));
  await context.close();
}

// 5) 넓은 화면에서 답하기 칸이 따라오는지(1440, 긴 장면)
{
  const { context, page } = await open('long', 1440);
  await page.mouse.wheel(0, 2400); await page.waitForTimeout(400);
  const box = await page.$eval('#review-form', el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  check('long-1440: 내려도 답하기 칸이 화면 안', box.top >= 0 && box.top < 60 && box.bottom <= 900, JSON.stringify(box));
  await context.close();
}

await browser.close();
child.stdin.write('stop\n');
await new Promise(done => child.on('exit', done));
const failed = report.checks.filter(c => !c.ok);
report.summary = { checks: report.checks.length, failed: failed.length };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, ...report.summary }));
if (failed.length) process.exitCode = 1;
