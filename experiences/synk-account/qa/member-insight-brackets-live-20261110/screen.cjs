'use strict';
// 회원 화면 「내 성향」 문장 낫표(2026-11-10) — 공개본과 후보(patch-live.cjs 출력)를 로그인한 화면에서 같은 순서로 몰아
// 보이는 글 · 자리 · 글꼴을 견준다. 모든 HTTP를 가로챈다: 합성 계정 · 합성 기록만 쓰고 실제 계정 · 서버 · synk.im은 부르지 않는다
// (공개본의 config.json도 합성 것으로 바꿔 준다). 쪽은 공개 주소와 같은 자리(/account/platform.html)에 놓는다.
// 쓰기: node screen.cjs <공개 사본 뿌리(account/ 와 social-conversion.js가 든 폴더)> <후보 폴더> <출력 폴더(없거나 빈 폴더)> [playwright 모듈 경로]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { ROOT } = require('./lib.cjs');
const { currentSummary, activityStore, libraryStore, understandingStore, memoryStore } = require(path.join(ROOT, 'desktop/tools/member-insight-fixture.cjs'));

const [liveRoot, candidateDir, outDir] = [2, 3, 4].map(n => process.argv[n] && path.resolve(process.argv[n]));
if (!outDir) { console.error('쓰기: node screen.cjs <공개 사본 뿌리> <후보 폴더> <출력 폴더> [playwright 모듈 경로]'); process.exit(2); }
const { chromium } = require(process.argv[5] || process.env.SYNK_PLAYWRIGHT || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

class Stop extends Error {}
const stop = message => { throw new Stop(message); };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const origin = 'https://platform.example.invalid', accountOrigin = 'https://account.example.invalid', pageUrl = origin + '/account/platform.html#benefits/insight';
const config = { version: 1, supabaseUrl: accountOrigin, supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://id.example.invalid/',
  clients: { platform: { clientId: 'synthetic-platform', redirectUri: origin + '/account/client.html?product=platform' } } };
const SWAPPED = ['/account/dist/platform.js', '/account/platform.html'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
const VIEWS = [[1440, 'day'], [390, 'night'], [320, 'day']];
const FACET = 'learning-topic:cafe-order';

// 낫표가 들어간 문장 아홉 자리(vellum-insight.cjs) — 후보 화면에 나온 줄을 이 꼴로 알아본다.
const SITES = [
  ['① 가장 많이 연습', /요즘은 「[^「」]+」[을를] 가장 많이 연습했어요\./],
  ['② 최근 혼자 해냄', /「[^「」]+」[을를] 최근 혼자 해냈어요\./],
  ['③ 하루 연습 · 표현 여럿', /「[^「」]+」 같은 \S+ \S+ 가지를 (도움 받으며 )?연습했어요\./],
  ['④ 하루 연습 · 표현 하나', /「[^「」]+」[을를] (도움 받으며 )?연습했어요\./],
  ['⑤ 더 배우고 싶다고 알림', /「[^「」]+」[을를] 더 배우고 싶다고 알려 줬어요\./],
  ['⑥ 연습에서 나온 것뿐', /「[^「」]+」[은는] 연습에서 나온 것뿐이라고 알려 줬어요\./],
  ['⑦ 지금은 아님', /「[^「」]+」[은는] 지금 배우고 싶은 게 아니라고 알려 줬어요\./],
  ['⑧ 기록 사실', /동안 「[^「」]+」[을를] \d+일에 걸쳐 \d+번 연습했어요\./],
  ['⑨ WORLD에서 고르기', /더 배우고 싶다고 한 「[^「」]+」 연습을 WORLD에서 골라 볼 수 있어요\./],
];
// 웹 플랫폼 화면이 실제로 찍는 자리 — 이 가운데 하나라도 화면에 안 나오면 멈춘다.
// ⑤⑥⑦⑧(memberUnderstandingLine)은 이 화면에서 항목의 line · evidenceLine 칸에 실려 형식 검사만 받고 글로는 찍히지 않는다
// (항목 줄은 제목 · 횟수 · 답 단추만 그린다). 그 넷의 문장은 patch-live.cjs가 후보 묶음 속 몸통으로 돌리는 단위 시험이 본다.
const REQUIRED = ['①', '②', '③', '④', '⑨'];

// 합성 요약: 대역의 것 그대로, 그리고 화면에 한 자리씩만 더 끌어내는 두 가지.
function webSummary(mode, owner) {
  if (mode === 'sparse-one') { const s = currentSummary('sparse-quality', owner), seen = s.summary.practice.observations; seen.topics = seen.topics.slice(0, 1); return s; }
  if (mode === 'strong') { // 지난 기간보다 혼자 답한 횟수가 늘지 않은 사람 — 「늘었어요」 대신 최근 혼자 해낸 항목이 머리말이 된다
    const s = currentSummary('enabled', owner), practice = s.summary.practice;
    practice.periods.previous = { ...practice.periods.previous, answered: 12, independent: 9, assisted: 3 };
    practice.periods.delta = { answered: 0, independent: -1, assisted: 1, activeDays: 1 };
    Object.assign(practice, { answered: 24, independent: 17, assisted: 7 });
    return s;
  }
  return currentSummary(mode, owner);
}

const report = { 만든날: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
  범위: '격리한 브라우저 · 합성 계정과 합성 기록 · 모든 HTTP 가로챔. 공개본과 후보를 같은 순서로 몰아 1440 · 390 · 320에서 견줌. 실제 계정 · 서버 · 공개 주소는 부르지 않음.',
  바탕: {}, 상태: [], 바뀐줄: [], 자리: {}, errors: [], unexpected: [], missing: [], 불러온묶음: {} };

async function open(browser, name, overlay) {
  const state = { owner: 'A', mode: 'enabled', calls: [], served: [], activity: activityStore(), library: libraryStore(), understanding: understandingStore(), memory: memoryStore() };
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
  context.on('page', page => page.on('pageerror', error => report.errors.push(name + ': ' + error.message)));
  await context.addInitScript(({ origin }) => { if (location.origin === origin) sessionStorage.setItem('synk.oauth.session.platform', JSON.stringify({ access_token: 'synthetic-A' })); }, { origin });
  await context.route('**/*', async route => {
    const request = route.request(), u = new URL(request.url());
    if (u.origin === accountOrigin) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, apikey, content-type, x-synk-product, x-synk-contract, x-synk-app-version' } });
      state.calls.push({ path: u.pathname, query: u.search, method: request.method() });
      if (u.pathname.endsWith('/synk-personal')) {
        const body = request.method() === 'POST' ? request.postDataJSON() : null, resource = body?.resource || u.searchParams.get('resource');
        if (!['member-insight', 'platform-library', 'member-understanding'].includes(resource) || body && !['save', 'delete'].includes(body.action) || body?.action === 'delete' && resource !== 'member-understanding') { report.unexpected.push(name + ': 예상 밖 쓰기 ' + u.pathname); return route.abort(); }
        const [store, prefix] = resource === 'member-insight' ? [state.activity, 'insight'] : resource === 'member-understanding' ? [state.understanding, 'understanding'] : [state.library, 'platform'];
        try { return route.fulfill({ json: store.request(state.owner, prefix + (body?.action === 'delete' ? 'Delete' : body ? 'Save' : 'Load'), body || {}) }); } catch { return route.fulfill({ status: 503, json: { ok: false, error: { code: 'SYNTHETIC_ACTIVITY_FAILURE' } } }); }
      }
      if (u.pathname.endsWith('/synk-learning') && (u.searchParams.get('view') === 'memory' || request.method() === 'POST')) {
        const body = request.method() === 'POST' ? request.postDataJSON() : null;
        if (body && !Array.isArray(body.memory)) { report.unexpected.push(name + ': 예상 밖 학습 쓰기 ' + u.pathname); return route.abort(); }
        try { return route.fulfill({ json: state.memory.request(state.owner, body ? 'memoryPost' : 'memoryGet', body ? { revision: body.revision, entries: body.memory } : { revision: Number(u.searchParams.get('revision')) }) }); } catch { return route.fulfill({ status: 503, json: { ok: false, error: { code: 'SYNTHETIC_MEMORY_FAILURE' } } }); }
      }
      if (request.method() !== 'GET') { report.unexpected.push(name + ': 예상 밖 쓰기 ' + u.pathname); return route.abort(); }
      if (u.searchParams.get('view') === 'atlas') return route.fulfill({ json: state.memory.apply(state.owner, webSummary(state.mode, state.owner)) });
      return route.fulfill({ json: { ok: true, account: { synk_user_id: 'synthetic-insight-' + state.owner, profile: { display_name: '합성 ' + state.owner } }, capabilities: { learningSync: true } } });
    }
    if (u.origin !== origin) { report.unexpected.push(name + ': ' + u.origin + u.pathname); return route.abort(); }
    if (u.pathname === '/desktop/releases/preview.json') return route.fulfill({ status: 503, json: { synthetic: true } });
    if (u.pathname === '/account/config.json') return route.fulfill({ json: config });
    if (u.pathname === '/account/client.html') return route.fulfill({ contentType: TYPES['.html'], body: '<!doctype html><meta charset="utf-8"><h1>합성 계정 관리</h1>' });
    const swapped = overlay && SWAPPED.includes(u.pathname), base = swapped ? candidateDir : liveRoot, target = path.resolve(base, '.' + decodeURIComponent(u.pathname));
    if (!target.startsWith(base + path.sep)) return route.fulfill({ status: 404, body: '' });
    try {
      const body = fs.readFileSync(target);
      if (SWAPPED.includes(u.pathname)) state.served.push({ 주소: u.pathname + u.search, sha256: sha(body), 후보폴더: !!swapped });
      return route.fulfill({ body, contentType: TYPES[path.extname(target)] || 'application/octet-stream' });
    } catch { report.missing.push(name + ': ' + u.pathname); return route.fulfill({ status: 404, body: '' }); }
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const cdp = await context.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  return { name, dir: overlay ? 'cand' : 'pub', context, page, cdp, state };
}

const ready = page => page.locator('[data-insight-status="ready"]').waitFor();
const atlasReads = state => state.calls.filter(call => call.query.includes('view=atlas')).length;
async function waitState(predicate) { for (let n = 0; n < 250; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); } stop('합성 상태를 기다리다 시간이 넘었다'); }
// 새로 불러오기가 일으킨 읽기를 기다린다 — 앞서 준비된 화면을 그 결과로 잘못 보지 않게.
async function learn({ page, state }, mode) {
  state.mode = mode; await page.setViewportSize({ width: 390, height: 900 });
  const before = atlasReads(state), action = page.locator('[data-insight-action="refresh"]');
  if (!await action.isVisible()) await page.locator('#mi2-why > summary').click();
  await action.click(); await waitState(() => atlasReads(state) > before); await ready(page);
}
async function answer({ page }, value, label) {
  const chip = `[data-insight-action="understanding-answer"][data-insight-facet="${FACET}"][data-insight-value="${value}"]`, row = `[data-insight-facet-row="${FACET}"]`;
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator(chip + ':not([disabled])').waitFor({ state: 'attached' });
  await page.evaluate(chip => { document.querySelector(chip).closest('details').open = true; }, chip);
  await page.locator(chip).click();
  await page.waitForFunction(([row, label]) => document.querySelector(row + ' .mi2-answer')?.innerText.includes(label), [row, label]);
}
const STEPS = [
  { name: '처음(접힌 채)', fold: true, kind: 'growth', go: async () => {} },
  { name: '모두 펼침', kind: 'growth', go: async () => {} },
  { name: '하루 연습 · 표현 여럿', kind: 'one-day', go: v => learn(v, 'sparse-quality') },
  { name: '하루 연습 · 표현 하나', kind: 'one-day', go: v => learn(v, 'sparse-one') },
  { name: '최근 혼자 해냄', kind: 'strong', go: v => learn(v, 'strong') },
  { name: '답: 더 배우고 싶어요', kind: 'growth', go: async v => { await learn(v, 'enabled'); await answer(v, 'interested', '더 배우고 싶어요'); await v.page.locator('.mi2-apps').waitFor({ state: 'attached' }); } },
  { name: '답: 연습에서 나온 것뿐이에요', kind: 'growth', go: v => answer(v, 'practice-only', '연습에서 나온 것뿐이에요') },
  { name: '답: 지금은 아니에요', kind: 'growth', go: v => answer(v, 'not-now', '지금은 아니에요') },
];

async function settle(page, width, theme, unfold) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(([theme, unfold]) => { document.documentElement.dataset.theme = theme; if (unfold) for (const fold of document.querySelectorAll('.member-insight details')) fold.open = true; window.scrollTo(0, 0); }, [theme, unfold]);
  await page.waitForFunction(() => document.getElementById('platform-message')?.hidden !== false, {}, { timeout: 8000 });
  await page.evaluate(() => document.fonts.ready);
}
const read = page => page.evaluate(() => {
  const view = document.querySelector('.member-insight'), edge = view.getBoundingClientRect().right;
  return { lines: view.innerText.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean), overflow: document.documentElement.scrollWidth > innerWidth,
    past: [...view.querySelectorAll('*')].filter(node => node.getBoundingClientRect().right > edge + .5 && node.getClientRects().length && !node.closest('.mi2-hidden')).map(node => node.tagName + '.' + node.className),
    height: Math.round(view.getBoundingClientRect().height), kind: document.querySelector('[data-mi2-kind]')?.dataset.mi2Kind || null };
});
// 그 줄을 그리는 가장 안쪽 요소 — 몇 줄로 접혔는지와 어떤 글꼴이 글자를 그렸는지 잰다.
const measure = (page, line) => page.evaluate(line => {
  const view = document.querySelector('.member-insight'), norm = text => text.replace(/\s+/g, ' ').trim();
  let found = null;
  for (const node of view.querySelectorAll('*')) if (node.getClientRects().length && norm(node.innerText || '') === line) found = node;
  if (!found) return null;
  const rects = [], walker = document.createTreeWalker(found, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) { const range = document.createRange(); range.selectNodeContents(text); rects.push(...[...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0)); }
  let rows = 0, bottom = -Infinity;
  for (const rect of rects.sort((a, b) => a.top - b.top)) { if (rect.top >= bottom - 2) rows++; bottom = Math.max(bottom, rect.bottom); }
  const box = found.getBoundingClientRect();
  for (const old of document.querySelectorAll('[data-qa-line]')) old.removeAttribute('data-qa-line');
  found.setAttribute('data-qa-line', '');
  return { 요소: found.tagName + (found.className ? '.' + found.className : ''), 줄: rows, 너비: Math.round(box.width), 높이: Math.round(box.height), 글자크기: getComputedStyle(found).fontSize };
}, line);
async function fonts({ cdp }) {
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 }), { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-qa-line]' });
  return Object.fromEntries((await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.map(font => [font.familyName + (font.isCustomFont ? '(웹)' : '(기기)'), font.glyphCount]));
}
// 후보 줄의 낫표를 벗기거나 작은따옴표로 되돌리면 공개본 줄이 되어야 한다 — 그 밖의 차이는 하나도 없다.
const unbracket = (line, wrap) => line.replace(/「([^「」]+)」/g, wrap);

(async () => {
  let pair = [], browser = null;
  try {
    const files = JSON.parse(fs.readFileSync(path.join(candidateDir, 'files.json'), 'utf8'));
    for (const file of files) {
      const live = sha(fs.readFileSync(path.join(liveRoot, file.공개경로))), next = sha(fs.readFileSync(path.join(candidateDir, file.공개경로)));
      if (live !== file.공개본.sha256 || next !== file.sha256) stop(`${file.공개경로}: 공개 사본이나 후보가 files.json과 다르다(공개 ${live.slice(0, 12)} · 후보 ${next.slice(0, 12)})`);
      report.바탕[file.공개경로] = { 공개본: live, 후보: next };
    }
    if (files.map(file => '/' + file.공개경로).sort().join() !== [...SWAPPED].sort().join()) stop('후보가 바꾸는 파일이 두 개(묶음 · 쪽)가 아니다');
    if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) stop('출력 폴더가 비어 있지 않다: ' + outDir);
    for (const dir of ['pub', 'cand']) fs.mkdirSync(path.join(outDir, dir), { recursive: true });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    pair = [await open(browser, '공개본', false), await open(browser, '후보', true)];
    for (const v of pair) { await v.page.goto(pageUrl); await ready(v.page); }
    const unique = new Map();
    for (const [n, step] of STEPS.entries()) {
      for (const v of pair) await step.go(v);
      const row = { 이름: step.name, 보기: [] }; report.상태.push(row);
      for (const [width, theme] of VIEWS) {
        const shots = [];
        for (const v of pair) { await settle(v.page, width, theme, !step.fold); shots.push(await read(v.page)); await v.page.screenshot({ path: path.join(outDir, v.dir, `${n}-${width}.png`), fullPage: true }); }
        const [a, b] = shots, where = `${step.name} ${width}`;
        if (width === 390) for (const [i, v] of pair.entries()) fs.writeFileSync(path.join(outDir, v.dir, `${n}-lines.txt`), shots[i].lines.join('\n') + '\n');
        if (a.kind !== b.kind || step.kind && b.kind !== step.kind) stop(`${where}: 머리말 종류가 다르다(공개본 ${a.kind} · 후보 ${b.kind} · 기대 ${step.kind})`);
        if (a.lines.length !== b.lines.length) stop(`${where}: 줄 수가 다르다(공개본 ${a.lines.length} · 후보 ${b.lines.length})`);
        if (b.overflow && !a.overflow) stop(`${where}: 후보에서만 가로로 넘친다`);
        if (JSON.stringify(a.past) !== JSON.stringify(b.past)) stop(`${where}: 칸 밖으로 나간 요소가 다르다(공개본 ${a.past.length} · 후보 ${b.past.length}) ${b.past.filter(node => !a.past.includes(node)).slice(0, 4).join(' ')}`);
        const view = { 너비: width, 테마: theme, 줄수: b.lines.length, 높이: [a.height, b.height], 가로넘침: [a.overflow, b.overflow], 칸밖: b.past.length, 바뀐줄: [] }; row.보기.push(view); row.종류 = b.kind;
        for (const [i, line] of b.lines.entries()) {
          if (line === a.lines[i]) continue;
          if (a.lines[i] !== unbracket(line, '$1') && a.lines[i] !== unbracket(line, '‘$1’')) stop(`${where}: 낫표 말고 다른 것이 바뀌었다\n  공개본 ${a.lines[i]}\n  후보   ${line}`);
          const sites = SITES.filter(([, shape]) => shape.test(line)).map(([site]) => site);
          if (!sites.length) stop(`${where}: 아홉 자리 어디에도 맞지 않는 줄이 바뀌었다\n  공개본 ${a.lines[i]}\n  후보   ${line}`);
          const seen = [];
          for (const [k, v] of pair.entries()) {
            const got = await measure(v.page, k ? line : a.lines[i]);
            if (!got) stop(`${where}: ${v.name} 화면에서 줄을 그리는 요소를 못 찾았다 — ${k ? line : a.lines[i]}`);
            got.글꼴 = await fonts(v);
            await v.page.locator('[data-qa-line]').screenshot({ path: path.join(outDir, v.dir, `${n}-${width}-line${view.바뀐줄.length}.png`) });
            seen.push(got);
          }
          const strange = Object.keys(seen[1].글꼴).filter(font => !(font in seen[0].글꼴));
          view.바뀐줄.push({ 공개본: a.lines[i], 후보: line, 자리: sites, 줄: [seen[0].줄, seen[1].줄], 요소: seen[1].요소, 글자크기: seen[1].글자크기, 글꼴: seen.map(got => got.글꼴), 새글꼴: strange });
          const key = a.lines[i] + '\n' + line, entry = unique.get(key) || { 공개본: a.lines[i], 후보: line, 자리: sites, 나온곳: [], 줄늘어난곳: [], 새글꼴: [] };
          entry.나온곳.push(where); if (seen[1].줄 > seen[0].줄) entry.줄늘어난곳.push(`${where}(${seen[0].줄}→${seen[1].줄}줄)`); for (const font of strange) if (!entry.새글꼴.includes(font)) entry.새글꼴.push(font);
          unique.set(key, entry);
        }
      }
      console.log(`${step.name}(${row.종류}): 바뀐 줄 ${row.보기.map(view => view.바뀐줄.length).join('/')} · 높이 ${row.보기.map(view => view.높이[1] - view.높이[0]).map(d => (d > 0 ? '+' : '') + d).join('/')}px(1440/390/320)`);
    }
    report.바뀐줄 = [...unique.values()];
    for (const [site] of SITES) report.자리[site] = report.바뀐줄.filter(entry => entry.자리.includes(site)).length;
    for (const v of pair) report.불러온묶음[v.name] = v.state.served;
    const loaded = (v, file) => v.state.served.filter(hit => hit.주소.startsWith(file));
    for (const [k, v] of pair.entries()) for (const file of files) {
      const hits = loaded(v, '/' + file.공개경로), want = k ? file.sha256 : file.공개본.sha256;
      if (!hits.length || hits.some(hit => hit.sha256 !== want || hit.후보폴더 !== !!k)) stop(`${v.name}: ${file.공개경로}를 기대한 판으로 불러오지 않았다 ${JSON.stringify(hits)}`);
      if (file.공개경로.endsWith('platform.js') && hits.some(hit => !hit.주소.endsWith('?v=' + want.slice(0, 12)))) stop(`${v.name}: 쪽이 부른 묶음 주소의 ?v= 가 묶음과 맞지 않는다 ${JSON.stringify(hits)}`);
    }
    const absent = REQUIRED.filter(site => !report.자리[SITES.find(([name]) => name.startsWith(site))?.[0]]);
    if (absent.length) stop('화면에 나와야 할 자리가 안 나왔다: ' + absent.join(', '));
    if (report.errors.length || report.unexpected.length || report.missing.length) stop(`쪽 오류 ${report.errors.length} · 가로채지 않은 요청 ${report.unexpected.length} · 없는 파일 ${report.missing.length}\n  ` + [...report.errors, ...report.unexpected, ...report.missing].slice(0, 8).join('\n  '));
    const shown = SITES.filter(([site]) => report.자리[site]).map(([site]) => site.slice(0, 1)).join(''), wrapped = report.바뀐줄.flatMap(entry => entry.줄늘어난곳), strange = [...new Set(report.바뀐줄.flatMap(entry => entry.새글꼴))];
    console.log(`바뀐 줄 ${report.바뀐줄.length}가지 — 모두 낫표만 다름 · 화면에 나온 자리 ${shown.length}/9(${shown})`);
    for (const entry of report.바뀐줄) console.log(`  ${entry.자리.map(site => site.slice(0, 1)).join('')} ${entry.공개본}\n    → ${entry.후보}`);
    console.log(`줄이 늘어난 곳 ${wrapped.length}${wrapped.length ? ': ' + wrapped.join(' · ') : ''} · 낫표 때문에 새로 쓰인 글꼴 ${strange.length ? strange.join(', ') : '없음'}`);
    console.log(`가로 넘침 · 칸 밖 요소 공개본과 같음(상태 ${STEPS.length} × 너비 ${VIEWS.length}) · 쪽 오류 0 · 가로채지 않은 요청 0 · 없는 파일 0`);
    report.ok = true;
  } catch (error) {
    report.ok = false; report.멈춤 = error instanceof Stop ? error.message : error.stack; process.exitCode = 1;
    console.error('멈춤: ' + report.멈춤);
    for (const v of pair) if (!v.page.isClosed()) fs.writeFileSync(path.join(outDir, v.dir, 'stopped.txt'), await v.page.evaluate(() => [location.href, document.querySelector('[data-insight-status]')?.dataset.insightStatus, document.querySelector('.member-insight')?.innerText,
      ...[...document.querySelectorAll('[data-insight-action]')].map(node => node.outerHTML.slice(0, node.outerHTML.indexOf('>') + 1))].join('\n')).catch(problem => String(problem)));
  } finally {
    if (browser) await browser.close();
    if (fs.existsSync(outDir)) fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
})();
