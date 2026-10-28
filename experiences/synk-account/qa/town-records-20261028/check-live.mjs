// patch-live.mjs's publishing candidate on the real pages — https://synk.im/id/ (the portal 「내 계정」) and
// https://synk.im/account/client.html?product=world (WORLD's account sheet) — in the installed Chrome. The candidate files go
// in with page.route and every request to the account project is answered here (a synthetic Auth, account server and town
// records route), so nothing reaches the production project or a real account.
//   node experiences/synk-account/qa/town-records-20261028/check-live.mjs <playwright module dir> <candidate dir> <out dir> [live]
// With `live` the published files stay: the baseline — the card is absent and the account screens still open.
// One JSON line per check; screenshots at 1440 and 390 go to <out dir>.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const [playwrightDir, candidateDir, outDir, mode = 'candidate'] = process.argv.slice(2);
if (!playwrightDir || !candidateDir || !outDir) throw new Error('usage: check-live.mjs <playwright module dir> <candidate dir> <out dir> [live]');
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
const project = 'https://qiwxeddwwnzkwalpsuty.supabase.co', live = mode === 'live';
fs.mkdirSync(outDir, { recursive: true });
const FILES = { '/id/dist/app.js': 'id__dist__app.js', '/id/style.css': 'id__style.css', '/account/dist/client.js': 'account__dist__client.js', '/account/style.css': 'account__style.css' };
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// --- synthetic account project ------------------------------------------------------------------------------------------
const USER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'member-a@synthetic.test', password: 'synthetic-pass-a1' };
let town = null, log = [], accountStatus = 'active';
function resetTown(state) {
  town = { state, revision: 7, bands: true, observed: true, feedback: true, consent: 'unasked',
    known: [['찻집 주인', '찻집 일', 'cafe-owner', '20749.tea-order'], ['연구원', '관찰 카드가 날려요', 'researcher', '20748.R1']], familiar: ['쟁반이 기울어요', '찻집 주인과 차를 골라요'] };
}
// The shape talk's records route sends (experiences/synk-town/town/records.mjs accountRecords), as preview.mjs fakes it.
function records() {
  if (town.state === 'unready') return { available: false };
  if (town.state === 'new') return { available: true, started: false };
  return { available: true, started: true, revision: town.revision, sections: [
    { id: 'known', title: '주민이 아는 나', empty: '주민이 기억하는, 같이 한 일이 아직 없어요.', rows: town.known.map(([name, title, npc, eventId]) => ({ text: `${name} · ${title} — 같이 했어요`, action: { type: 'MEMORY_FORGET', payload: { npc, eventId }, label: '잊어 주세요' } })) },
    { id: 'settings', title: '마을이 맞춰 둔 것', empty: '마을이 맞춰 둔 것이 아직 없어요.', rows: [
      town.bands ? { text: '내가 자주 오는 때에 맞춰 마을 자리를 채워요', action: { type: 'PREF_VISIT_BANDS', payload: { on: false }, label: '끄기' } } : { text: '자주 오는 때에 맞춰 마을 자리 채우기 · 꺼 둠', action: { type: 'PREF_VISIT_BANDS', payload: { on: true }, label: '켜기' } },
      ...(town.observed ? [{ text: '요즘 자주 한 생활 · 찻집 생활', action: { type: 'OBSERVED_CORRECT', payload: { family: 'cafe-life' }, label: '그때만 한 거예요' } }] : []),
      { text: '먼저 보여 줄 생활 · 찻집 생활' },
      ...(town.feedback ? [{ text: '내가 남긴 응답 · 찻집 주문 · 좋았어요', action: { type: 'FEEDBACK_REMOVE', payload: { eventId: 'E-5' }, label: '응답 지우기' } }] : [])], note: '단추가 없는 줄은 마을 안 이웃 수첩에서 바꿀 수 있어요.' },
    { id: 'familiar', title: '익숙한 생활', empty: '여러 번 함께한 생활이 여기에 모여요.', rows: town.familiar.map(text => ({ text })), note: '본 것 기록을 비우면 모두 다시 새 이야기로 보여요.',
      actions: [{ type: 'SEEN_CLEAR', payload: {}, label: '본 것 기록 비우기', confirm: '본 것 기록을 비울까요? 모두 다시 새 이야기로 보여요.' }] },
    { id: 'clear', title: '맞춤 기록 모두 비우기', lines: ['주민이 아는 나는 그대로 두고, 마을이 맞춰 둔 것과 익숙한 생활을 비워요.'],
      actions: [{ type: 'MEMORY_CLEAR', payload: {}, label: '비우기', confirm: '맞춤 기록을 모두 비울까요? 되돌릴 수 없어요.' }] }] };
}
const townAnswer = () => ({ ok: true, scope: 'synk-town-records', accountId: USER.id, records: records() });
function townCommand({ type, payload, expectedRevision }) {
  if (expectedRevision !== town.revision) return [409, { ok: false, error: { code: 'stale-command', message: 'stale' } }];
  if (type === 'MEMORY_FORGET') town.known = town.known.filter(row => row[3] !== payload.eventId);
  if (type === 'OBSERVED_CORRECT') town.observed = false;
  if (type === 'FEEDBACK_REMOVE') town.feedback = false;
  if (type === 'PREF_VISIT_BANDS') town.bands = payload.on === true;
  if (type === 'SEEN_CLEAR') town.familiar = [];
  if (type === 'MEMORY_CLEAR') { town.familiar = [];town.observed = false;town.feedback = false; }
  town.revision++;return [200, { ...townAnswer(), duplicate: false }];
}
const account = () => ({ ok: true, account: { synk_user_id: USER.id, status: accountStatus, profile: { display_name: '합성 회원 A' }, profile_revision: 1, providers: ['email'] }, memberships: [], entitlements: [],
  learning: { enabled: false, revision: 1 }, capabilities: { learningSync: true }, sessions: [{ id: 'a-current', product: 'platform', label: '', current: true, revoked: false, last_seen: new Date().toISOString() }],
  dataRequests: accountStatus === 'deletion-requested' ? [{ request_id: '77777777-7777-4777-8777-777777777777', kind: 'delete', status: 'pending', due_at: new Date(Date.now() + 6 * 86400000).toISOString() }] : [] });
const TOWN_FIRST = { state: { revision: 7 }, commands: [{ id: 'C-1' }], events: [{ id: 'E-1' }], exportAt: '2026-10-28T00:00:00.000Z', afterCommand: 'C-1', afterEvent: 'E-1', hasMore: true };
const CORS = { 'Access-Control-Allow-Origin': 'https://synk.im', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*', 'x-supabase-api-version': '2024-01-01' };
async function answer(route) {
  const request = route.request(), url = new URL(request.url()), method = request.method();
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
  let body = {};try { body = request.postData() ? JSON.parse(request.postData()) : {}; } catch { body = Object.fromEntries(new URLSearchParams(request.postData() || '')); }
  const headers = await request.allHeaders();
  log.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), product: headers['x-synk-product'] || null, body });
  const json = (status, data) => route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const session = () => ({ access_token: 'synthetic-access-' + crypto.randomUUID(), refresh_token: 'synthetic-refresh-' + crypto.randomUUID(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, created_at: '2026-10-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [] } });
  if (url.pathname === '/auth/v1/settings') return json(200, { external: { email: true, google: true }, disable_signup: false });
  if (url.pathname === '/auth/v1/token') return json(200, session());
  if (url.pathname === '/auth/v1/user') return json(200, session().user);
  if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS, body: '' });
  if (url.pathname === '/functions/v1/synk-town/records') {
    // The route answers only an active account (a deletion request in its grace closes the records).
    if (accountStatus !== 'active') return json(403, { ok: false, error: { code: 'ACCOUNT_UNAVAILABLE', message: 'account unavailable' } });
    if (town.state === 'fail') return json(503, { ok: false, error: { code: 'TOWN_UNAVAILABLE', message: 'synthetic outage' } });
    if (method === 'GET') return json(200, townAnswer());
    const [status, data] = townCommand(body);return json(status, data);
  }
  if (url.pathname === '/functions/v1/synk-account') {
    const view = url.searchParams.get('view');
    if (view === 'registration') return json(200, { ok: true, registration: { required: false, completed: true, phoneVerificationRequired: false } });
    if (view === 'atlas') return json(200, { ok: true, shared: 'declared-only', learning: { enabled: false, revision: 1 }, summary: { reasons: ['travel'], presentation: null, practice: { answered: 6, independent: 2, assisted: 4, skills: [] }, forReasons: [] } });
    if (view === 'export') return json(200, { ok: true, account: account().account, events: [], cursor: 0, until: 0, hasMore: false, eventMeta: [], myInfo: { profile: { display_name: '합성 회원 A' } }, town: TOWN_FIRST });
    if (view === 'town-export') return json(200, { ok: true, scope: 'synk-town-data', town: { commands: [{ id: 'C-2' }], events: [{ id: 'E-2' }], afterCommand: 'C-2', afterEvent: 'E-2', hasMore: false } });
    if (method === 'POST' && body.action === 'delete-cancel') { accountStatus = 'active';return json(200, { ok: true }); }
    if (method === 'POST') return json(200, { ok: true, current: false, refreshRevoked: true, legacyAccessGuard: true });
    return json(200, account());
  }
  return json(404, { ok: false, error: { code: 'NOT_FOUND', message: 'not in this check' } });
}

// --- pages ---------------------------------------------------------------------------------------------------------------
const results = [];
const check = (name, ok, details = {}) => { results.push({ name, ok: !!ok, ...details });console.log(JSON.stringify({ name, ok: !!ok, ...details })); };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome', headless: true });
const SURFACES = {
  portal: { url: 'https://synk.im/id/', card: '#account .town-block', product: 'platform' },
  world: { url: 'https://synk.im/account/client.html?product=world', card: '#account .town-card', product: 'world' },
};
async function open(surface, state, width, status = 'active') {
  resetTown(state);log = [];accountStatus = status;
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 }, acceptDownloads: true }), errors = [], { url } = SURFACES[surface];
  if (surface === 'world') await context.addInitScript(() => { if (location.origin === 'https://synk.im') sessionStorage.setItem('synk.oauth.session.world', JSON.stringify({ access_token: 'synthetic-world-access', refresh_token: 'synthetic-world-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 })); });
  await context.route(`${project}/**`, answer);
  await context.route(request => { const u = new URL(request); return u.origin === 'https://synk.im' && Object.hasOwn(FILES, u.pathname); }, async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (live) return route.continue();
    await route.fulfill({ status: 200, headers: { 'Content-Type': TYPES[path.extname(pathname)], 'Cache-Control': 'no-store' }, body: fs.readFileSync(path.join(candidateDir, FILES[pathname])) });
  });
  await context.route(request => { const u = new URL(request); return u.origin !== 'https://synk.im' && u.origin !== project && !/^(?:data|blob):/.test(u.protocol); }, route => route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error).slice(0, 200)));
  page.on('console', message => { if (message.type() === 'error' && !/status of (?:403|404|409|503)|ERR_FAILED|net::ERR/.test(message.text())) errors.push(message.text().slice(0, 200)); });
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}probe=w6c-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  if (surface === 'portal') { await page.waitForSelector('#auth-panel:not([hidden])');await page.fill('#email', USER.email);await page.fill('#password', USER.password);await page.click('#auth-submit');await page.waitForSelector('#account-profile:not([hidden])'); }
  await page.waitForSelector('#account:not([hidden])', { timeout: 20000 });
  return { context, page, errors };
}
// The card shows a line before the read that follows it goes out: wait for the request itself.
const until = async (test, ms = 8000) => { for (const end = Date.now() + ms; Date.now() < end; await new Promise(resolve => setTimeout(resolve, 100))) if (test()) return true;return test(); };
const overflow = page => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
const settle = async (page, card) => { await page.waitForSelector(`${card} .town-records:not([data-phase=loading])`, { timeout: 15000 }); };
try {
  for (const surface of Object.keys(SURFACES)) {
    const { card, product } = SURFACES[surface];
    if (live) {
      const { context, page, errors } = await open(surface, 'entered', 1440);await page.waitForTimeout(1500);
      check(`${surface} live: the account opens and has no town card`, await page.locator(card).count() === 0 && !log.some(row => row.path.endsWith('/synk-town/records')) && !errors.length, { errors, screenshot: await page.screenshot({ path: path.join(outDir, `${surface}-live-1440.png`), fullPage: true }).then(() => `${surface}-live-1440.png`) });
      await context.close();continue;
    }
    for (const width of [1440, 390]) {
      const { context, page, errors } = await open(surface, 'entered', width);await settle(page, card);
      const text = await page.locator(card).innerText(), read = log.find(row => row.path.endsWith('/synk-town/records') && row.method === 'GET');
      await page.locator(card).scrollIntoViewIfNeeded();
      check(`${surface} ${width}: the card reads as the route says, asked as ${product}`, ['마을 기록', '주민이 아는 나', '찻집 주인 · 찻집 일 — 같이 했어요', '마을이 맞춰 둔 것', '익숙한 생활', '맞춤 기록 모두 비우기', '단추가 없는 줄은'].every(line => text.includes(line))
        && read?.product === product && await overflow(page) === 0 && !errors.length, { product: read?.product, overflow: await overflow(page), errors, screenshot: await page.locator(card).screenshot({ path: path.join(outDir, `${surface}-entered-${width}.png`) }).then(() => `${surface}-entered-${width}.png`) });
      await page.screenshot({ path: path.join(outDir, `${surface}-page-${width}.png`), fullPage: true });
      if (width === 1440) {
        await page.click(`${card} [data-town="known.r0"]`);await page.waitForFunction(selector => /그 주민의 기억에서 뺐어요/.test(document.querySelector(selector)?.textContent || ''), card);
        const sent = log.filter(row => row.method === 'POST' && row.path.endsWith('/synk-town/records'));
        check(`${surface}: 잊어 주세요 sends the rights command at the card's revision and redraws`, sent.length === 1 && sent[0].body.type === 'MEMORY_FORGET' && sent[0].body.payload?.eventId === '20749.tea-order' && sent[0].body.expectedRevision === 7 && typeof sent[0].body.id === 'string' && sent[0].product === product
          && !(await page.locator(card).innerText()).includes('찻집 주인 · 찻집 일'), { body: sent[0]?.body });
        await page.click(`${card} [data-town="clear.a0"]`);await page.waitForSelector('dialog[open]');await page.screenshot({ path: path.join(outDir, `${surface}-clear-confirm-1440.png`) });
        await page.click('dialog[open] button[value=cancel]');await page.waitForTimeout(200);
        const keptAfterCancel = log.filter(row => row.method === 'POST' && row.path.endsWith('/synk-town/records')).length === 1 && (await page.locator(card).innerText()).includes('쟁반이 기울어요');
        await page.click(`${card} [data-town="clear.a0"]`);await page.waitForSelector('dialog[open]');await page.click('dialog[open] button[value=ok]');
        await page.waitForFunction(selector => /맞춤 기록을 모두 비웠어요/.test(document.querySelector(selector)?.textContent || ''), card);
        check(`${surface}: 비우기 asks once more, cancel keeps everything, ok clears`, keptAfterCancel && log.filter(row => row.method === 'POST' && row.path.endsWith('/synk-town/records')).at(-1)?.body.type === 'MEMORY_CLEAR' && !(await page.locator(card).innerText()).includes('쟁반이 기울어요'), {});
        // A revision another screen moved first: the card reads again and says so.
        town.revision += 5;await page.click(`${card} [data-town="settings.r0"]`);await page.waitForFunction(selector => /다른 곳에서 먼저 바뀌었어요/.test(document.querySelector(selector)?.textContent || ''), card);
        check(`${surface}: a stale revision reads the card again`, await until(() => log.filter(row => row.method === 'GET' && row.path.endsWith('/synk-town/records')).length >= 2), {});
        const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('button', { hasText: '연습 기록 내려받기' }).first().click()]);
        const file = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        check(`${surface}: the download carries 내 정보 and the whole town (both pages)`, file.scope === 'connected-learning-records' && file.myInfo?.profile?.display_name === '합성 회원 A' && file.town?.commands?.length === 2 && file.town.events.length === 2 && !('hasMore' in file.town)
          && log.some(row => row.query.view === 'town-export' && row.query.afterCommand === 'C-1' && row.query.at === TOWN_FIRST.exportAt), { keys: Object.keys(file), town: file.town && Object.keys(file.town) });
        check(`${surface}: no page errors`, !errors.length, { errors });
      }
      await context.close();
    }
    // A deletion request in its grace closes the card; cancelling it on the same screen reads the card again (Argon E1).
    { const { context, page, errors } = await open(surface, 'entered', 1440, 'deletion-requested');await settle(page, card);
      const closed = await page.locator(card).innerText();
      await page.locator('button', { hasText: '삭제 요청 취소' }).first().click();
      const reopened = await page.waitForFunction(selector => /주민이 아는 나/.test(document.querySelector(selector)?.textContent || ''), card, { timeout: 15000 }).then(() => true, () => false);
      check(`${surface}: a deletion request closes the card and cancelling it on the same screen opens the card again`, closed.includes('계정 삭제를 요청한 동안에는 마을 기록을 볼 수 없어요.') && !closed.includes('주민이 아는 나')
        && reopened && log.some(row => row.body?.action === 'delete-cancel') && !errors.length, { errors, screenshot: await page.locator(card).screenshot({ path: path.join(outDir, `${surface}-after-cancel-1440.png`) }).then(() => `${surface}-after-cancel-1440.png`) });
      await context.close(); }
    for (const [state, line] of [['new', '싱크타운에 들어가면'], ['unready', '마을 기록은 아직 쓸 수 없어요.'], ['fail', '마을 기록을 불러오지 못했어요.']]) {
      const { context, page, errors } = await open(surface, state, 1440);await settle(page, card);
      const text = await page.locator(card).innerText(), buttons = await page.locator(`${card} [data-town]:not([data-town="retry"])`).count();
      let retried = true;
      if (state === 'fail') { town.state = 'entered';await page.click(`${card} [data-town="retry"]`);await page.waitForFunction(selector => /주민이 아는 나/.test(document.querySelector(selector)?.textContent || ''), card).catch(() => { retried = false; }); }
      check(`${surface} ${state}: ${line}${state === 'fail' ? ' — and 다시 불러오기 reads it' : ''}`, text.includes(line) && buttons === 0 && retried && !errors.length, { errors, screenshot: await page.locator(card).screenshot({ path: path.join(outDir, `${surface}-${state}-1440.png`) }).then(() => `${surface}-${state}-1440.png`) });
      await context.close();
    }
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(outDir, `results-${mode}.json`), JSON.stringify({ at: new Date().toISOString(), mode, results }, null, 2) + '\n');
process.exitCode = results.every(row => row.ok) ? 0 : 1;
