// SYNK ID A 한 칸(2026-11-11): every screen of the sign-in page and of 「내 SYNK 계정」 as pictures and measurements — from this
// checkout, or from another copy of experiences/synk-account (the page as published before the change: --root <dir>) —
// against synthetic Auth + account servers on 127.0.0.1. No real account, mail or password is involved.
//   node experiences/synk-account/qa/sid-a-20261111/scenes.mjs <playwright dir> <out dir> [--root <portal dir>] [--only id,id] [--widths 1440,390] [--no-extra]
// Pictures: <out>/<width>/<scene>.png (full page) and .txt (the page's words). report.json: per picture the horizontal overflow,
// text below 4.5:1 (3:1 for large text, placeholders included), controls under 44px, fonts · sizes · weights in use, page errors;
// per scene the overflow at 320 · 360 · 768 · 901 · 1024 · 1280 · 1920; the Tab order on the e-mail fields. A scene may also carry
// an expectation (where the keyboard is, which words a failure uses, where a status line sits, what another tab's sign-in leaves
// here) — checked at every width; a broken one is listed in report.summary.expectFailed.
// --live <url> (e.g. https://synk.im/id/): the published page itself — its own files and config — with every request to the account
// project answered by the synthetic servers here and every other origin cut off, so nothing reaches the production project or a
// real account. Scenes that need a registered app (consent · restart) are left out there.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), [playwrightDir, outDir] = args, option = name => { const i = args.indexOf(name);return i > 1 ? args[i + 1] : null; };
if (!playwrightDir || !outDir) throw new Error('usage: scenes.mjs <playwright dir> <out dir> [--root <portal dir>] [--only id,id] [--widths 1440,390] [--no-extra]');
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
const portalRoot = path.resolve(option('--root') || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const only = option('--only')?.split(',') || null, SHOT = (option('--widths') || '1440,390').split(',').map(Number), EXTRA = args.includes('--no-extra') ? [] : [320, 360, 768, 901, 1024, 1280, 1920];
fs.mkdirSync(outDir, { recursive: true });

// --- synthetic people (example.com — no real address) and the state each scene asks for -----------------------------------
const USERS = {
  a: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'yuna.kim@example.com', password: 'example-pass-1', identities: ['email'], name: '김유나' },
  g: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'minjun.lee@example.com', password: 'example-pass-2', identities: ['google'], name: '' },
  o: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', email: 'new.member@example.com', password: 'example-pass-3', identities: ['google'], name: '', onboarding: true },
  u: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', email: 'not.yet@example.com', password: 'example-pass-4', identities: ['email'], name: '', unconfirmed: true },
  // A long address (the longest a person is likely to have) for the wrap checks.
  l: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'a.very.long.member.name.for.layout.check@subdomain.example-university.example', password: 'example-pass-5', identities: ['email'], name: '긴 주소 회원' },
};
const fresh = () => ({ revoked: new Set(), google: true, learning: true, deleting: false, pendingEmail: '', manyPlaces: false, settingsDelay: 0, failRevoke: false, atlasDelay: 0, names: Object.fromEntries(Object.entries(USERS).map(([key, u]) => [key, u.name])) });
let state = fresh();
const now = () => Math.floor(Date.now() / 1000), ago = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const sessions = new Map(), RESET_TOKEN = 'pkce_' + 'a1'.repeat(28);
const userJson = key => { const u = USERS[key];return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, created_at: '2026-10-01T00:00:00Z', ...(key === 'a' && state.pendingEmail ? { new_email: state.pendingEmail } : {}),
  app_metadata: { provider: u.identities[0], providers: u.identities }, user_metadata: {}, identities: u.identities.map(provider => ({ id: u.id + provider, user_id: u.id, provider, identity_data: { email: u.email, sub: u.id }, created_at: '2026-10-01T00:00:00Z' })) }; };
const issue = key => { const access = 'example-access-' + crypto.randomUUID(), refresh = 'example-refresh-' + crypto.randomUUID();
  sessions.set(access, { key, refresh, live: true });return { access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, user: userJson(key) }; };
const PLACES = [['platform', 'Windows PC 앱', 30], ['world', 'iPhone · Safari', 60 * 26], ['messenger', 'Windows PC 앱', 60 * 50], ['platform', 'Chrome · macOS', 60 * 24 * 4], ['world', 'Galaxy · Chrome', 60 * 24 * 6], ['platform', 'Edge · Windows', 60 * 24 * 9],
  ['world', 'iPad · Safari', 60 * 24 * 12], ['messenger', 'Chrome · Windows', 60 * 24 * 15], ['platform', 'Firefox · Linux', 60 * 24 * 20]];
const accountData = key => { const u = USERS[key], places = state.manyPlaces ? PLACES : PLACES.slice(0, 3);return { ok: true,
  account: { synk_user_id: 'SYNK-' + u.id.slice(0, 8).toUpperCase() + '-EXAMPLE', status: state.deleting ? 'deletion-requested' : 'active', profile: state.names[key] ? { display_name: state.names[key] } : {}, profile_revision: 1, providers: u.identities },
  memberships: key === 'a' ? [{ kind: 'staff', role: 'teacher', staff_id: 'example-staff' }] : [], entitlements: key === 'a' ? [{ key: 'platform-basic', product: 'platform', valid_until: '2027-03-31T00:00:00Z' }] : [],
  learning: { enabled: key === 'a' && state.learning && !state.deleting, revision: 1 }, capabilities: { learningSync: true },
  sessions: [{ id: `${key}-current`, product: 'platform', label: 'Chrome · Windows', current: true, revoked: false, last_seen: ago(0) }, ...places.map(([product, label, minutes], i) => ({ id: `${key}-p${i}`, product, label, current: false, revoked: state.revoked.has(`${key}-p${i}`), last_seen: ago(minutes) })),
    ...(state.manyPlaces ? [0, 1, 2, 3].map(i => ({ id: `${key}-r${i}`, product: 'world', label: '', current: false, revoked: true, last_seen: ago(60 * 24 * 30) })) : [])],
  dataRequests: state.deleting ? [{ kind: 'delete', status: 'pending', request_id: '00000000-0000-4000-8000-000000000001', requested_at: ago(60 * 24), due_at: new Date(Date.now() + 6 * 86400000).toISOString() }] : [] }; };
const atlas = key => { const on = key === 'a' && state.learning && !state.deleting;return { ok: true, shared: on ? 'practice-and-settings' : 'declared-only', learning: { enabled: on, revision: 1 }, summary: {
  presentation: on ? { support: 'step', textSize: 'large' } : null, reasons: key === 'a' ? ['travel', 'life'] : [], forReasons: [],
  practice: on ? { answered: 18, independent: 12, assisted: 4, skills: [{ line: '최근 놓친 「듣고 세부 정보 찾기」를 조금 더 연습해 봐요.' }, { line: '「낱말 듣기」를 최근 혼자 해냈어요. 가볍게 이어가요.' }] } : { answered: 0, independent: 0, assisted: 0, skills: [] } } }; };
const town = key => ({ ok: true, scope: 'synk-town-records', accountId: accountData(key).account.synk_user_id, records: key !== 'a' ? { available: true, started: false } : { available: true, started: true, revision: 7, sections: [
  { id: 'known', title: '주민이 아는 나', empty: '주민이 기억하는, 같이 한 일이 아직 없어요.', rows: [['찻집 주인', '찻집 일', 'cafe-owner', '20749.tea-order'], ['연구원', '관찰 카드가 날려요', 'researcher', '20748.R1']].map(([name, title, npc, eventId]) => ({ text: `${name} · ${title} — 같이 했어요`, action: { type: 'MEMORY_FORGET', payload: { npc, eventId }, label: '잊어 주세요' } })) },
  { id: 'settings', title: '마을이 맞춰 둔 것', empty: '마을이 맞춰 둔 것이 아직 없어요.', rows: [{ text: '내가 자주 오는 때에 맞춰 마을 자리를 채워요', action: { type: 'PREF_VISIT_BANDS', payload: { on: false }, label: '끄기' } }, { text: '덜 추천하는 생활 · 비 오는데 바깥에 비품이', action: null }], note: '단추가 없는 줄은 마을 안 이웃 수첩에서 바꿀 수 있어요.' },
  { id: 'familiar', title: '익숙한 생활', empty: '여러 번 함께한 생활이 여기에 모여요.', rows: [{ text: '쟁반이 기울어요' }, { text: '찻집 주인과 공방 주인의 이야기' }], note: '본 것 기록을 비우면 모두 다시 새 이야기로 보여요.', actions: [{ type: 'SEEN_CLEAR', payload: {}, label: '본 것 기록 비우기', confirm: '본 것 기록을 비울까요?' }] },
  { id: 'clear', title: '맞춤 기록 모두 비우기', lines: ['요즘 자주 한 생활, 남긴 응답, 본 것 기록을 비워요. 직접 정한 설정과 마을의 일은 그대로예요.'], actions: [{ type: 'MEMORY_CLEAR', payload: {}, label: '비우기', confirm: '맞춤 기록을 모두 비울까요?' }] }] } });
const DEVICE = 'http://127.0.0.1:43999/synk/oauth/messenger/callback';
const send = (res, status, body, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'x-supabase-api-version': '2024-01-01', ...extra });res.end(body === undefined ? '' : JSON.stringify(body)); };
const fail = (res, status, code, message) => send(res, status, { code, error_code: code, msg: message, message });
const auth = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Max-Age': '600' });res.end();return; }
  const url = new URL(req.url, 'http://127.0.0.1');let body = '';for await (const chunk of req) body += chunk;const data = body ? JSON.parse(body) : {};
  const session = sessions.get((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (url.pathname === '/auth/v1/settings') { if (state.settingsDelay) await new Promise(resolve => setTimeout(resolve, state.settingsDelay));return send(res, 200, { external: { email: true, google: state.google }, disable_signup: false }); }
  const connect = url.pathname.match(/^\/auth\/v1\/oauth\/authorizations\/([\w-]+)(\/consent)?$/);
  if (connect) {
    if (!session?.live) return fail(res, 401, 'session_not_found', 'Session not found');
    if (connect[1] !== 'device-1') return fail(res, 404, 'oauth_authorization_not_found', 'authorization not found');
    if (!connect[2]) return send(res, 200, { authorization_id: 'device-1', client: { id: 'example-desktop', name: 'SYNK Workspace' }, redirect_uri: DEVICE, scope: 'openid email profile', user: { id: USERS[session.key].id, email: USERS[session.key].email } });
    return send(res, 200, { redirect_url: DEVICE + '?error=access_denied&state=example' });
  }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'password') {
      const key = Object.keys(USERS).find(k => USERS[k].email === data.email);
      if (!key || USERS[key].password !== data.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      if (USERS[key].unconfirmed) return send(res, 400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      return send(res, 200, issue(key));
    }
    const old = [...sessions].find(([, s]) => s.refresh === data.refresh_token && s.live);if (!old) return fail(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
    old[1].live = false;return send(res, 200, issue(old[1].key));
  }
  if (url.pathname === '/auth/v1/verify' && data.token_hash === RESET_TOKEN) return send(res, 200, issue('a'));
  if (url.pathname === '/auth/v1/user') { if (!session?.live) return fail(res, 401, 'session_not_found', 'Session not found');if (req.method === 'PUT' && data.email) state.pendingEmail = data.email;return send(res, 200, userJson(session.key)); }
  if (url.pathname === '/auth/v1/logout') { if (session) session.live = false;res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });res.end();return; }
  if (['/auth/v1/recover', '/auth/v1/resend'].includes(url.pathname)) return send(res, 200, {});
  if (url.pathname === '/auth/v1/signup') return send(res, 200, { id: crypto.randomUUID(), email: data.email, confirmation_sent_at: new Date().toISOString(), identities: [{ provider: 'email' }] });
  if (!url.pathname.startsWith('/functions/v1/')) return send(res, 404, { code: 'not_found' });
  if (!session?.live) return send(res, 401, { ok: false, error: { code: 'AUTH_REQUIRED' } });
  const key = session.key, view = url.searchParams.get('view');
  if (url.pathname === '/functions/v1/synk-town/records') return send(res, 200, town(key));
  if (view === 'registration') return send(res, 200, { ok: true, registration: USERS[key].onboarding ? { required: true, completed: false, phoneVerificationRequired: true } : { required: false, completed: true, phoneVerificationRequired: false } });
  if (view === 'atlas') { if (state.atlasDelay) await new Promise(resolve => setTimeout(resolve, state.atlasDelay));return send(res, 200, atlas(key)); }
  if (req.method === 'POST') {
    if (state.failRevoke && data.action === 'revoke-session') return send(res, 503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE' } });
    if (data.action === 'revoke-session') state.revoked.add(data.session_id);
    if (data.action === 'profile-update') state.names[key] = data.profile?.display_name || '';
    if (data.action === 'learning-consent') state.learning = data.enabled === true;
    if (data.action === 'delete-request') state.deleting = true;
    if (data.action === 'delete-cancel') state.deleting = false;
    return send(res, 200, { ok: true, current: false, refreshRevoked: true, legacyAccessGuard: true, request: { due_at: new Date(Date.now() + 7 * 86400000).toISOString() } });
  }
  return send(res, 200, accountData(key));
});
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
let config = null;
const portal = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname === '/config.json') { res.writeHead(200, { 'Content-Type': 'application/json' });res.end(JSON.stringify(config));return; }
  const file = path.join(portalRoot, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(portalRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404);res.end('missing');return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });res.end(fs.readFileSync(file));
});
const LIVE = option('--live');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const authPort = await listen(auth), portalPort = await listen(portal), base = `http://127.0.0.1:${portalPort}/`, authBase = `http://127.0.0.1:${authPort}`;
const liveProject = LIVE ? new URL((await (await fetch(new URL('config.json?probe=' + Date.now(), LIVE))).json()).supabaseUrl).origin : null;
config = { version: 1, supabaseUrl: authBase, accountApiUrl: authBase, supabasePublishableKey: 'sb_publishable_example_local', portalUrl: base, learningUrl: base,
  clients: {}, authorizationClients: [{ product: 'messenger', clientId: 'example-desktop', redirectUris: [DEVICE] }] };

// --- the scenes: same steps on any copy of the page ------------------------------------------------------------------------
const hint = method => JSON.stringify({ v: 2, method, ...(method === 'email' ? { email: USERS.a.email } : {}), masked: 'yu***@example.com', at: Date.now() });
const openEmail = async tab => { if (await tab.isVisible('#email-method') && !await tab.isVisible('#email')) await tab.click('#email-method'); };
const signIn = async (tab, key, waitFor = '#account-profile:not([hidden])') => { await openEmail(tab);await tab.fill('#email', USERS[key].email);await tab.fill('#password', USERS[key].password);await tab.click('#auth-submit');if (waitFor) await tab.waitForSelector(waitFor); };
const settledAccount = async tab => { await tab.waitForLoadState('networkidle');await tab.waitForTimeout(300); };
const SCENES = [
  ['first', '로그인 첫 방문', async () => {}],
  ['email', '이메일을 고름', openEmail],
  ['wrong', '틀린 비밀번호', async tab => { await openEmail(tab);await tab.fill('#email', USERS.a.email);await tab.fill('#password', 'example-wrong');await tab.click('#auth-submit');await tab.waitForFunction(() => /맞지 않아요/.test(document.getElementById('notice').textContent)); }],
  ['back-email', '다시 옴 · 이메일', async () => {}, { hint: 'email' }],
  ['back-google', '다시 옴 · Google', async () => {}, { hint: 'google' }],
  ['signup', '가입 · 방법 고르기', async tab => { await tab.click('#switch-row [data-view="signup"]'); }],
  ['signup-email', '가입 · 이메일', async tab => { await tab.click('#switch-row [data-view="signup"]');await openEmail(tab); }],
  ['sent', '가입 메일 보냄', async tab => { await tab.click('#switch-row [data-view="signup"]');await openEmail(tab);await tab.fill('#email', 'hana.park@example.com');await tab.fill('#password', 'example-pass-9');await tab.check('#signup-age');await tab.click('#auth-submit');await tab.waitForFunction(() => /가입 확인 메일을 요청했어요/.test(document.getElementById('notice').textContent)); }],
  ['recover', '비밀번호를 잊었어요', async tab => { await openEmail(tab);await tab.click('#forgot-row [data-view="recover"]'); }],
  ['recover-sent', '재설정 메일 보냄', async tab => { await openEmail(tab);await tab.click('#forgot-row [data-view="recover"]');await tab.fill('#email', USERS.a.email);await tab.click('#auth-submit');await tab.waitForFunction(() => /재설정 메일을 요청했어요/.test(document.getElementById('notice').textContent)); }],
  ['reset-link', '메일 링크 · 한 번 누르기', async () => {}, { query: `?view=reset&token_hash=${RESET_TOKEN}&type=recovery` }],
  ['reset', '새 비밀번호', async tab => { await tab.click('#auth-submit');await tab.waitForSelector('#password-confirm-label:not([hidden])'); }, { query: `?view=reset&token_hash=${RESET_TOKEN}&type=recovery` }],
  ['no-google', 'Google을 못 쓸 때', async () => {}, { set: { google: false } }],
  ['unconfirmed', '이메일 확인 전 로그인', async tab => { await signIn(tab, 'u', '#resend-confirm:not([hidden])'); }],
  ['onboarding', 'Google 첫 가입 마무리', async tab => { await signIn(tab, 'o', '#google-onboarding:not([hidden])'); }],
  ['consent', '앱 연결 · 이 PC 앱', async (tab, url) => { await signIn(tab, 'a');await tab.goto(url + '?authorization_id=device-1', { waitUntil: 'networkidle' });await tab.waitForSelector('#consent:not([hidden])'); }],
  ['restart', '앱 연결 다시 시작', async (tab, url) => { await signIn(tab, 'a');await tab.goto(url + '?authorization_id=gone-1', { waitUntil: 'networkidle' });await tab.waitForSelector('#connection-restart:not([hidden])'); }],
  ['account', '내 SYNK 계정', async tab => { await signIn(tab, 'a');await settledAccount(tab); }],
  ['account-places', '내 계정 · 로그인한 곳 여럿', async tab => { await signIn(tab, 'a');await settledAccount(tab); }, { set: { manyPlaces: true } }],
  ['account-name', '내 계정 · 이름 바꾸기', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('[data-key="name-edit"]'); }],
  ['account-email', '내 계정 · 이메일 바꾸기', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('#email-form-toggle'); }],
  ['account-password', '내 계정 · 비밀번호 바꾸기', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('#password-form-toggle'); }],
  ['account-pending', '내 계정 · 새 이메일 확인 대기', async tab => { await signIn(tab, 'a');await settledAccount(tab); }, { set: { pendingEmail: 'yuna.new@example.com' } }],
  ['account-google', '내 계정 · Google로만 가입', async tab => { await signIn(tab, 'g');await settledAccount(tab); }],
  ['account-deleting', '내 계정 · 삭제 요청됨', async tab => { await signIn(tab, 'a');await settledAccount(tab); }, { set: { deleting: true } }],
  ['account-confirm', '내 계정 · 삭제 확인 창', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('[data-key="delete"]');await tab.waitForSelector('dialog.portal-confirm[open]'); }],
  ['google-checking', 'Google 확인이 늦을 때(1.2초)', async tab => { await tab.waitForTimeout(1200); }, { set: { settingsDelay: 5000 }, checking: true }],
  ['consent-long', '앱 연결 · 긴 이메일 주소', async (tab, url) => { await signIn(tab, 'l');await tab.goto(url + '?authorization_id=device-1', { waitUntil: 'networkidle' });await tab.waitForSelector('#consent:not([hidden])'); }],
  ['account-long', '내 계정 · 긴 이메일 주소', async tab => { await signIn(tab, 'l');await settledAccount(tab);await tab.click('#password-form-toggle'); }],
  ['account-row-error', '내 계정 · 로그아웃시키기 실패', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('[data-key="session:a-p0"]');await tab.waitForSelector('.row-error'); }, { set: { failRevoke: true }, expect: rowSays('로그아웃시키지 못했어요. 다시 눌러 주세요.') }],
  ['account-password-error', '내 계정 · 새 비밀번호 두 칸이 다름', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('#password-form-toggle');await tab.fill('#current-password', 'example-pass-1');await tab.fill('#new-password', 'example-next-1');await tab.fill('#new-password-confirm', 'example-next-2');await tab.click('#password-change-submit');await tab.waitForFunction(() => /서로 달라요/.test(document.getElementById('security-status').textContent)); },
    { expect: async tab => tab.evaluate(() => { const n = document.getElementById('notice');return n.getAttribute('data-kind') === 'success' ? [`위 알림이 남음: ${n.textContent.trim().slice(0, 30)}`] : []; }) }],
  // The learning summary arrives after a failed name save (render('main') redraws the blocks, not the profile): still one line.
  // Spaces only — an empty field is stopped by the browser (required) before the page sees it.
  ['account-name-error', '내 계정 · 공백만 넣은 이름 저장(요약이 늦게 옴)', async tab => { await signIn(tab, 'a');await tab.click('[data-key="name-edit"]');await tab.fill('#profile-name-input', '   ');await tab.click('[data-key="name-save"]');await tab.waitForSelector('.row-error');await tab.waitForTimeout(3200); }, { set: { atlasDelay: 2500 } }],
  ['signed-out', '로그아웃한 뒤', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('[data-action="sign-out"]');await tab.waitForFunction(() => /로그아웃했어요/.test(document.getElementById('notice').textContent)); }],
  // 11-12 next round (r5 follow-ups and 「로그인 방법 한 쌍」 ①).
  ['account-name-cancel', '내 계정 · 이름 고치기를 키보드로 취소', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.focus('[data-key="name-edit"]');await tab.keyboard.press('Enter');await tab.waitForSelector('#profile-name-input');await tab.focus('[data-key="name-cancel"]');await tab.keyboard.press('Enter');await tab.waitForSelector('[data-key="name-edit"]'); },
    { expect: focusOn('name-edit') }],
  ['account-name-saved', '내 계정 · 이름을 Enter로 저장', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.focus('[data-key="name-edit"]');await tab.keyboard.press('Enter');await tab.waitForSelector('#profile-name-input');await tab.fill('#profile-name-input', '김유나 선생님');await tab.keyboard.press('Enter');await tab.waitForFunction(() => /이름을 바꿨어요/.test(document.getElementById('notice').textContent));await settledAccount(tab); },
    { expect: focusOn('name-edit') }],
  ['account-success-then-fail', '내 계정 · 학습 기록 연결을 끈 뒤 로그아웃시키기 실패', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('[data-key="learning"]');await tab.waitForFunction(() => /학습 기록 연결을 껐어요/.test(document.getElementById('notice').textContent));await settledAccount(tab);await tab.click('[data-key="session:a-p0"]');await tab.waitForSelector('.row-error'); },
    { set: { failRevoke: true }, expect: async tab => [...await rowSays('로그아웃시키지 못했어요. 다시 눌러 주세요.')(tab), ...await tab.evaluate(() => { const n = document.getElementById('notice');return n.textContent.trim() || n.getAttribute('data-kind') === 'success' ? [`위 알림이 남음: ${n.getAttribute('data-kind')} ${n.textContent.trim().slice(0, 30)}`] : []; })] }],
  ['account-password-changed', '내 계정 · 비밀번호를 바꾼 뒤', async tab => { await signIn(tab, 'a');await settledAccount(tab);await tab.click('#password-form-toggle');await tab.fill('#current-password', USERS.a.password);await tab.fill('#new-password', 'example-next-1');await tab.fill('#new-password-confirm', 'example-next-1');await tab.click('#password-change-submit');await tab.waitForFunction(() => /비밀번호를 바꿨어요/.test(document.getElementById('security-status').textContent));await tab.waitForTimeout(300); },
    { expect: async tab => tab.evaluate(() => { const status = document.getElementById('security-status'), toggle = document.getElementById('password-form-toggle'), mail = document.getElementById('password-mail')?.parentElement, problems = [];
      if (status.previousElementSibling?.id !== 'password-change-form') problems.push(`상태 줄 앞: ${status.previousElementSibling?.id || status.previousElementSibling?.className}`);
      const s = status.getBoundingClientRect(), t = toggle.getBoundingClientRect(), m = mail?.getBoundingClientRect();
      if (!(s.top >= t.bottom - 1 && (!m || s.bottom <= m.top + 1))) problems.push(`상태 줄 자리 ${Math.round(s.top)} · 단추 끝 ${Math.round(t.bottom)} · 메일 줄 ${Math.round(m?.top)}`);
      if (document.activeElement !== toggle) problems.push(`초점: ${document.activeElement?.id || document.activeElement?.tagName}`);return problems; }) }],
  // Another tab of the same browser signs in; this tab (the login screen, or an account another tab then leaves) follows it.
  ['other-tab-sign-in', '다른 탭에서 로그인한 뒤 이 탭', async (tab, url) => { const other = await tab.context().newPage();await other.goto(tab.url(), { waitUntil: 'networkidle' });await signIn(other, 'a');await tab.waitForSelector('#account-profile:not([hidden])', { timeout: 8000 }).catch(() => {});await settledAccount(tab);await other.close(); },
    { expect: signedInAs('a') }],
  ['other-tab-switch', '다른 탭에서 로그아웃하고 다른 회원으로 로그인한 뒤 이 탭', async (tab, url) => { await signIn(tab, 'a');await settledAccount(tab);const other = await tab.context().newPage();await other.goto(tab.url(), { waitUntil: 'networkidle' });await other.waitForSelector('#account-profile:not([hidden])');await settledAccount(other);await other.click('[data-action="sign-out"]');await other.waitForSelector('#auth-panel:not([hidden])');await tab.waitForSelector('#auth-panel:not([hidden])', { timeout: 8000 }).catch(() => {});await signIn(other, 'g');await tab.waitForFunction(email => document.querySelector('.profile-email')?.textContent === email, USERS.g.email, { timeout: 8000 }).catch(() => {});await settledAccount(tab);await other.close(); },
    { expect: signedInAs('g') }],
  // The case the 11-11 review reproduced (10 of 11): this tab waits on an app-connection card; another tab signs out and signs in as
  // someone else. This tab must not fall to 「로그인 상태를 확인하지 못했어요」 — it shows the card again for the new account.
  ['other-tab-consent', '앱 연결 카드에서 기다리는 동안 다른 탭이 다른 회원으로 로그인', async (tab, url) => { await signIn(tab, 'a');await tab.goto(url + '?authorization_id=device-1', { waitUntil: 'networkidle' });await tab.waitForSelector('#consent:not([hidden])');const other = await tab.context().newPage();await other.goto(url, { waitUntil: 'networkidle' });await other.waitForSelector('#account-profile:not([hidden])');await settledAccount(other);await other.click('[data-action="sign-out"]');await other.waitForSelector('#auth-panel:not([hidden])');await signIn(other, 'g');await tab.waitForFunction(email => document.getElementById('consent-account')?.textContent.includes(email) || /확인하지 못했어요/.test(document.getElementById('notice').textContent), USERS.g.email, { timeout: 8000 }).catch(() => {});await tab.waitForTimeout(300);await other.close(); },
    { expect: async tab => tab.evaluate(email => { const problems = [], note = document.getElementById('notice').textContent;if (/확인하지 못했어요/.test(note)) problems.push(`알림: ${note.slice(0, 40)}`);
      if (document.getElementById('consent').hidden || !document.getElementById('consent-account')?.textContent.includes(email)) problems.push(`카드: ${document.getElementById('consent').hidden ? '닫힘' : document.getElementById('consent-account')?.textContent.slice(0, 40)}`);return problems; }, USERS.g.email) }],
  // A browser whose tabs keep their own session (site data blocked: the SDK keeps the session in each tab's memory, the sign-in
  // event still reaches the other tabs — Fable r2 P1). This tab holds 김유나; another tab signs in as 이민준. This tab must not draw
  // 이민준's account over 김유나's session (every later request would go as 김유나) — it stays, or closes as before.
  ['other-tab-separate', '탭마다 따로 로그인하는 브라우저 · 다른 탭이 다른 회원으로 로그인', async (tab, url) => { await signIn(tab, 'a');await settledAccount(tab);const other = await tab.context().newPage();await other.goto(tab.url(), { waitUntil: 'networkidle' });await signIn(other, 'g');await tab.waitForTimeout(3000);await other.close(); },
    { blockStorage: true, expect: async tab => tab.evaluate(email => { const shown = document.querySelector('.profile-email')?.textContent;return !document.getElementById('account-profile').hidden && shown === email ? [`이 탭이 다른 회원 계정을 그림: ${shown}`] : []; }, USERS.g.email) }],
];
function focusOn(key) { return async tab => tab.evaluate(want => document.activeElement?.dataset?.key === want ? [] : [`초점: ${document.activeElement?.dataset?.key || document.activeElement?.id || document.activeElement?.tagName}`], key); }
function rowSays(text) { return async tab => tab.evaluate(want => { const rows = [...document.querySelectorAll('.row-error')].map(node => node.textContent.trim());return rows.length === 1 && rows[0] === want ? [] : [`줄 안 알림: ${JSON.stringify(rows)}`]; }, text); }
function signedInAs(key) { return async tab => tab.evaluate(email => { const problems = [], note = document.getElementById('notice').textContent;
  if (document.getElementById('account-profile').hidden) problems.push('내 계정이 안 열림');if (document.querySelector('.profile-email')?.textContent !== email) problems.push(`보이는 계정: ${document.querySelector('.profile-email')?.textContent}`);
  if (/확인하지 못했어요/.test(note)) problems.push(`알림: ${note.slice(0, 40)}`);return problems; }, USERS[key].email); }
function audit() {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/);if (!m) return null;const p = m[1].split(',').map(Number);return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lin = v => { v /= 255;return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b), ratioOf = (fg, bg) => (Math.max(L(fg), L(bg)) + 0.05) / (Math.min(L(fg), L(bg)) + 0.05);
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor);if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  const shown = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && +cs.opacity !== 0 && !el.closest('[inert]'); };
  const low = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim(), el = n.parentElement;if (!t || !el || el.closest('script,style') || !shown(el)) continue;
    const cs = getComputedStyle(el);let fg = parse(cs.color);if (!fg) continue;const bg = bgOf(el);
    if (fg.a < 1) fg = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const size = parseFloat(cs.fontSize), big = size >= 24 || size >= 18.66 && +cs.fontWeight >= 700;
    // A disabled control (Google that cannot be used, a button while its request runs) is faded on purpose.
    if (!el.closest('[data-off="true"],button:disabled') && ratioOf(fg, bg) < (big ? 3 : 4.5)) low.push({ t: t.slice(0, 40), ratio: +ratioOf(fg, bg).toFixed(2), size });
  }
  for (const input of document.querySelectorAll('input[placeholder]')) { if (!shown(input) || input.value) continue;const c = parse(getComputedStyle(input, '::placeholder').color);if (c && ratioOf(c, bgOf(input)) < 4.5) low.push({ t: '자리 글 ' + input.placeholder, ratio: +ratioOf(c, bgOf(input)).toFixed(2) }); }
  const sizes = new Set(), weights = new Set(), fams = new Set();
  document.querySelectorAll('body *').forEach(e => { if (shown(e) && [...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) { const cs = getComputedStyle(e);sizes.add(parseFloat(cs.fontSize));weights.add(+cs.fontWeight);fams.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()); } });
  // Controls: a link inside a sentence keeps its line height (WCAG 2.5.8 inline exception); everything else is 44px or more.
  const small = [];
  for (const el of document.querySelectorAll('button,a[href],summary,label.toggle,select,input')) {
    if (!shown(el) || el.matches('p a, li a') && !el.matches('.sb-btn') || el.matches('input[type=checkbox]')) continue;
    const r = el.getBoundingClientRect();if (r.height < 43.5 || r.width < 43.5) small.push(`${(el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 18)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const gaps = [];
  for (const b of document.querySelectorAll('.method-btn')) { const badge = b.querySelector('.recent-badge'), label = b.querySelector('.method-label');if (!badge || badge.hidden || !label || !shown(badge)) continue;const range = document.createRange();range.selectNodeContents(label);gaps.push(Math.round(badge.getBoundingClientRect().left - range.getBoundingClientRect().right)); }
  // The same words drawn twice (the page line and a copy beside a button) — both visible.
  const said = [...document.querySelectorAll('.notice')].filter(shown).map(node => node.textContent.trim()).filter(Boolean), twice = said.filter((text, i) => said.indexOf(text) !== i);
  return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), low, small, gaps, twice, families: [...fams], sizes: [...sizes].sort((a, b) => a - b), weights: [...weights].sort((a, b) => a - b), height: document.documentElement.scrollHeight };
}
const report = { made: new Date().toISOString(), root: portalRoot, shots: [], widths: [], tab: null };
const browser = await chromium.launch({ channel: process.env.SYNK_QA_CHANNEL || 'chrome' });
const LIVE_SKIP = new Set(['consent', 'restart', 'consent-long', 'other-tab-consent']);
async function relay(route) {
  const request = route.request(), target = new URL(request.url()), method = request.method();
  const headers = Object.fromEntries(Object.entries(request.headers()).filter(([name]) => ['authorization', 'apikey', 'content-type', 'x-client-info', 'x-supabase-api-version', 'x-synk-contract', 'x-synk-product', 'x-synk-app-version'].includes(name)));
  const response = await fetch(authBase + target.pathname + target.search, { method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? undefined : request.postData() ?? undefined });
  return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
}
async function run(id, width, step, opts = {}) {
  state = { ...fresh(), ...(opts.set || {}) };for (const s of sessions.values()) s.live = false;
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 }, deviceScaleFactor: SHOT.includes(width) ? 2 : 1 });
  await context.route('http://127.0.0.1:43999/**', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>example arrival</title>' }));
  if (LIVE) await context.route('**/*', route => { const url = new URL(route.request().url());if (url.origin === liveProject) return relay(route);if (url.origin === new URL(LIVE).origin || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();return route.abort(); });
  if (opts.blockStorage) await context.addInitScript(() => { for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); });
  if (opts.hint) await context.addInitScript(([value, key]) => { localStorage.setItem(key, value); }, [hint(opts.hint), 'synk.id.recent-login.v1:' + (LIVE ? new URL(LIVE).pathname : '/')]);
  const tab = await context.newPage(), errors = [];
  tab.on('pageerror', error => errors.push(String(error).slice(0, 200)));
  tab.on('console', message => { if (message.type() === 'error' && !/atlas-learning|404|status of (?:400|401|403|422)/.test(message.text())) errors.push(message.text().slice(0, 200)); });
  // A scene that looks at Google still being looked up must not wait for the network to go quiet (the settings answer is held back).
  await tab.goto((LIVE || base) + (opts.query || ''), { waitUntil: opts.checking ? 'domcontentloaded' : 'networkidle' });await tab.waitForSelector('#auth-panel:not([hidden]), #account-profile:not([hidden])');
  if (!opts.checking) await tab.waitForFunction(() => !(document.getElementById('google-availability')?.textContent || '').includes('확인하고'));
  await step(tab, base);await tab.mouse.move(1, 1);await tab.waitForTimeout(250);await tab.evaluate(() => document.fonts.ready);
  return { context, tab, errors };
}
try {
  for (const [id, name, step, opts] of SCENES) {
    if (only && !only.includes(id) || LIVE && LIVE_SKIP.has(id)) continue;
    for (const width of [...SHOT, ...EXTRA]) {
      const { context, tab, errors } = await run(id, width, step, opts);
      try {
        const expect = opts?.expect ? await opts.expect(tab) : [];
        const a = { ...await tab.evaluate(audit), expect };
        if (SHOT.includes(width)) {
          const dir = path.join(outDir, String(width));fs.mkdirSync(dir, { recursive: true });
          await tab.screenshot({ path: path.join(dir, id + '.png'), fullPage: true });
          fs.writeFileSync(path.join(dir, id + '.txt'), await tab.evaluate(() => document.body.innerText));
          report.shots.push({ id, name, width, ...a, errors: [...errors] });
        } else report.widths.push({ id, width, overflow: a.overflow, gaps: a.gaps, errors: errors.length, expect });
        if (id === 'email' && width === SHOT[0]) {
          await tab.focus('#email');const order = ['email'];
          for (let i = 0; i < 5; i++) { await tab.keyboard.press('Tab');order.push(await tab.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim().slice(0, 14))); }
          report.tab = order;
        }
      } finally { await context.close(); }
    }
  }
} finally { await browser.close();auth.close();portal.close(); }
const uniq = list => [...new Set(list)];
report.summary = { shots: report.shots.length, overflow: report.shots.filter(s => s.overflow).map(s => `${s.width} ${s.id} +${s.overflow}`), lowContrast: report.shots.filter(s => s.low.length).map(s => `${s.width} ${s.id} ${JSON.stringify(s.low.slice(0, 2))}`),
  smallTargets: report.shots.filter(s => s.small.length).map(s => `${s.width} ${s.id} ${s.small.slice(0, 4).join(' / ')}`), saidTwice: report.shots.filter(s => s.twice.length).map(s => `${s.width} ${s.id} ${s.twice[0].slice(0, 40)}`),
  errors: report.shots.filter(s => s.errors.length).map(s => `${s.width} ${s.id} ${s.errors[0]}`).concat(report.widths.filter(s => s.errors).map(s => `${s.width} ${s.id}`)),
  otherWidthsOverflow: report.widths.filter(s => s.overflow).map(s => `${s.width} ${s.id} +${s.overflow}`), expectFailed: report.shots.concat(report.widths).filter(s => s.expect?.length).map(s => `${s.width} ${s.id} ${s.expect.join(' / ')}`), badgeGapMin: Math.min(...report.shots.concat(report.widths).flatMap(s => s.gaps), 999),
  families: uniq(report.shots.flatMap(s => s.families)), sizes: uniq(report.shots.flatMap(s => s.sizes)).sort((a, b) => a - b), weights: uniq(report.shots.flatMap(s => s.weights)).sort((a, b) => a - b), tab: report.tab };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report.summary, null, 1));
