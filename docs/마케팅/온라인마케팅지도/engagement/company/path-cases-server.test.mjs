import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { Store } from './store.mjs';
import { recordWorkspaceOwner } from './workspace-owner.mjs';
import { customerIdentityConfig, createCustomerIdentity } from './customer-identity.mjs';
import { pathStudentIdentityConfig } from './path-student-identity.mjs';
import { ticketPayload, briefHashInput, CASE_CONSENT_VERSION } from '../../../../../experiences/path-app/ask-shape.mjs';
import { readCases } from '../../../../../experiences/path-app/ask-flow.mjs';

// 지어낸 계정 · 토큰만 쓴다. 토큰은 서명 없는 합성 꼴이고, 받을지는 가짜 중앙이 정한다(실제 서버는 중앙 확인을 거친다).
const issuer = 'https://identity.example.test', KEY = 'synthetic-path-case-ticket-key-0123456789abcdef';
const PATH_CLIENT = 'path-app-fixture', CUSTOMER_CLIENT = 'customer-browser-fixture';
const baseEnv = { PATH_CASES_ENABLED: 'true', PATH_CASES_ALLOW: '*', PATH_CASE_TICKET_KEY: KEY, PATH_STUDENT_CLIENT_ID: PATH_CLIENT, SYNK_ID_CUSTOMER_SUPABASE_URL: issuer,
  SYNK_ID_CUSTOMER_ACCOUNT_API_URL: issuer + '/functions/v1/synk-account', SYNK_ID_CUSTOMER_PUBLISHABLE_KEY: 'sb_publishable_synthetic_fixture', SYNK_ID_CUSTOMER_CLIENT_ID: CUSTOMER_CLIENT };
const synthetic = claims => 'synthetic.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.fixture';
const brief = { situation: '몽골 학생이 2027년 3월 학부 입학을 준비해요.', wants: '원서 서류를 함께 준비해 주세요.', ai_done: [{ text: '한국어 조건을 안내했어요.', cites: ['prog-jbnu-ug'] }],
  open: ['추천서를 누구에게 받을지'], tasks: [{ do: '원서 서류 목록을 함께 확인하기', why: '학생 사정에 맞춘 판단이 필요해요.', by: '2027-01-15' }] };

async function fixture(t, { env = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'synk-path-cases-http-'));
  const accounts = new Map(), central = [];
  const fetcher = async (url, init) => {
    central.push(String(url));
    const token = String(init.headers.Authorization || '').slice(7), claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    const account = accounts.get(claims.sub);
    if (!account) return new Response(null, { status: 401 });
    return Response.json({ ok: true, account: { synk_user_id: account.synkUserId, status: account.status, profile: { display_name: '지어낸 학생' } }, sessions: [{ id: randomUUID(), current: true, revoked: false, product: 'platform' }] });
  };
  const app = createCompanyApp({ dataDir: root, port: 0, allowTestHost: true, schedule: false, synkCustomerIdentityConfig: null, pathCasesEnv: { ...baseEnv, ...env }, pathStudentIdentityFetch: fetcher });
  const address = await app.start(), base = 'http://127.0.0.1:' + address.port, users = {}, cookies = {};
  const make = (name, role, memberships) => { const row = app.store.createUser({ name, email: name + '@path-http.example.test', role }); const next = memberships ? { ...row, workspaceProfile: { version: 1, memberships, duties: [], revision: 1 } } : row; app.store.put('users', row.id, next); users[name] = next; cookies[name] = app.store.mint('session', row.id, { csrfToken: 'synthetic-csrf' }, 10); };
  make('owner', 'admin'); make('admin', 'admin'); make('operations', 'member', [{ company: 'PATH', role: 'operations' }]); make('counselor', 'member', [{ company: 'PATH', role: 'counselor' }]);
  recordWorkspaceOwner(app.store, users.owner, { at: new Date().toISOString(), setBy: 'test' });
  t.after(async () => { await app.stop(); assert.equal(dirname(resolve(root)), resolve(tmpdir())); await rm(root, { recursive: true, force: true }); });
  function student(status = 'active') {
    const sub = randomUUID(), synkUserId = randomUUID(); accounts.set(sub, { synkUserId, status });
    const claims = { iss: issuer + '/auth/v1', client_id: PATH_CLIENT, sub, exp: Math.floor(Date.now() / 1000) + 3600 };
    return { sub, synkUserId, token: synthetic(claims), customerToken: synthetic({ ...claims, client_id: CUSTOMER_CLIENT }) };
  }
  async function studentRequest(path, { token, method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, data: text ? JSON.parse(text) : null };
  }
  async function staff(path, { user = 'owner', body, headers = {} } = {}) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: 'synk_company_session=' + cookies[user], 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', ...(body === undefined ? {} : { Origin: app.origin, 'X-CSRF-Token': 'synthetic-csrf', 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  function handoff(who) {
    const ticket = { sub: who.synkUserId, kind: 'act', exp: Date.now() + 9 * 60000, nonce: randomUUID(), brief_hash: createHash('sha256').update(briefHashInput(brief, '2027-01-15')).digest('hex') };
    ticket.sig = createHmac('sha256', KEY).update(ticketPayload(ticket)).digest('base64url');
    return { mode: 'handoff', request_id: randomUUID(), lang: 'mn', consent: CASE_CONSENT_VERSION, ticket, brief_ko: brief, brief_student: brief, deadline: '2027-01-15', edits: [], note: null };
  }
  return { app, base, users, cookies, central, student, studentRequest, staff, handoff };
}
const corsOnly = headers => {
  assert.equal(headers.get('access-control-allow-origin'), 'https://synk.im');
  assert.equal(headers.get('access-control-allow-credentials'), null);
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.equal(headers.get('set-cookie'), null);
};

test('학생 경로 CORS: synk.im 하나만, OPTIONS · 상태 · 오류 답에도 싣고 자격 증명은 허용하지 않는다', async t => {
  const f = await fixture(t);
  const preflight = await fetch(f.base + '/api/path-student/cases', { method: 'OPTIONS', headers: { Origin: 'https://synk.im', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 204); corsOnly(preflight.headers);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  const status = await f.studentRequest('/api/path-student/status', { headers: { Origin: 'https://synk.im' } });
  assert.equal(status.status, 200); assert.deepEqual(status.data, { open: true }); corsOnly(status.headers);
  const anonymous = await f.studentRequest('/api/path-student/cases', { headers: { Origin: 'https://synk.im' } });
  assert.equal(anonymous.status, 401); assert.deepEqual([anonymous.data.ok, anonymous.data.error.code], [false, 'PATH_STUDENT_REJECTED']); corsOnly(anonymous.headers);
  const evil = await f.studentRequest('/api/path-student/status', { headers: { Origin: 'https://evil.example.test' } });
  assert.equal(evil.status, 403); corsOnly(evil.headers);
  // 직원 쿠키는 읽지 않는다.
  const cookie = await f.studentRequest('/api/path-student/cases', { headers: { Cookie: 'synk_company_session=' + f.cookies.owner } });
  assert.equal(cookie.status, 401); corsOnly(cookie.headers);
  const missing = await f.studentRequest('/api/path-student/nothing'); assert.equal(missing.status, 404); corsOnly(missing.headers);
  assert.equal(f.central.length, 0, '로그인 없는 요청은 중앙을 부르지 않는다');
});

test('두 방향 토큰 거절: 고객 상담 토큰은 PATH 경로에서, PATH 토큰은 고객 상담에서 받지 않는다', async t => {
  const f = await fixture(t), s = f.student();
  const customer = await f.studentRequest('/api/path-student/cases', { token: s.customerToken });
  assert.equal(customer.status, 401); assert.equal(f.central.length, 0, 'client_id가 다르면 중앙 확인 전에 거절');
  for (const claims of [{ iss: 'https://other.example.test/auth/v1' }, { exp: 1 }, { sub: 'not-a-uuid' }]) {
    const base = JSON.parse(Buffer.from(s.token.split('.')[1], 'base64url'));
    assert.equal((await f.studentRequest('/api/path-student/cases', { token: synthetic({ ...base, ...claims }) })).status, 401);
  }
  assert.equal(f.central.length, 0);
  const ok = await f.studentRequest('/api/path-student/cases', { token: s.token });
  assert.equal(ok.status, 200); assert.equal(ok.data.ok, true); assert.deepEqual(ok.data.cases, []); assert.equal(f.central.length, 1);
  const suspended = f.student('suspended');
  assert.equal((await f.studentRequest('/api/path-student/cases', { token: suspended.token })).status, 401);
  // 고객 상담 경로는 Bearer를 받지 않는다(쿠키 세션만).
  const me = await fetch(f.base + '/api/customer/me', { headers: { Authorization: 'Bearer ' + s.token } });
  assert.notEqual((await me.json().catch(() => ({}))).authenticated, true);
  // 스위치 이름을 다른 클라이언트와 같게 두면 설정이 서지 않는다.
  assert.throws(() => pathStudentIdentityConfig({ ...baseEnv, PATH_STUDENT_CLIENT_ID: CUSTOMER_CLIENT }));
});

test('고객 상담 로그인은 PATH 앱 client_id 토큰을 거절한다(customer-identity verify)', async t => {
  const origin = 'https://company.example.test', directory = mkdtempSync(join(tmpdir(), 'synk-path-customer-'));
  const config = customerIdentityConfig({ ...baseEnv, SYNK_ID_CUSTOMER_REDIRECT_URI: origin + '/api/customer/synk-id/callback' });
  const sub = randomUUID(), pathToken = synthetic({ iss: issuer + '/auth/v1', client_id: PATH_CLIENT, sub, exp: Math.floor(Date.now() / 1000) + 3600 });
  const fetcher = async url => String(url).endsWith('/oauth/token') ? Response.json({ access_token: pathToken, refresh_token: 'synthetic-refresh', token_type: 'bearer' })
    : Response.json({ ok: true, account: { synk_user_id: randomUUID(), status: 'active', profile: {} }, sessions: [{ id: randomUUID(), current: true, revoked: false, product: 'platform' }] });
  const store = new Store(directory), identity = createCustomerIdentity({ store, origin, config, fetch: fetcher });
  t.after(async () => { await identity.close(); identity.dispose(); store.close(); rmSync(directory, { recursive: true, force: true }); });
  const jar = new Map(), sink = () => { const headers = new Map(); return { setHeader: (k, v) => headers.set(k.toLowerCase(), v), getHeader: k => headers.get(k.toLowerCase()) }; };
  const request = () => ({ headers: { origin, cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') }, socket: { remoteAddress: '127.0.0.1' } });
  const apply = res => { for (const row of res.getHeader('Set-Cookie') || []) { const pair = row.split(';')[0], i = pair.indexOf('='); if (pair.slice(i + 1)) jar.set(pair.slice(0, i), pair.slice(i + 1)); } };
  const started = sink(), begin = identity.start(request(), started); apply(started);
  const url = new URL(config.redirectUri); url.search = new URLSearchParams({ state: new URL(begin.authorizationUrl).searchParams.get('state'), code: 'synthetic-code' });
  await assert.rejects(identity.callback(request(), sink(), url), { status: 401 });
});

test('HTTP 왕복: 학생이 보내고 · 담당이 보고 · 오늘 할 일에는 링크만 · operations와 다른 관리자는 거절 · Bearer는 저장하지 않는다', async t => {
  const f = await fixture(t), s = f.student();
  const made = await f.studentRequest('/api/path-student/cases', { token: s.token, method: 'POST', body: f.handoff(s), headers: { Origin: 'https://synk.im' } });
  assert.equal(made.status, 201, JSON.stringify(made.data)); assert.equal(made.data.ok, true); corsOnly(made.headers);
  const id = made.data.case.id;
  const conflict = await f.studentRequest('/api/path-student/cases', { token: s.token, method: 'POST', body: f.handoff(s) });
  assert.equal(conflict.status, 409); assert.equal(conflict.data.ok, false); assert.equal(conflict.data.error.code, 'CASE_OPEN_EXISTS'); assert.equal(conflict.data.error.case_id, id); corsOnly(conflict.headers);
  const list = await f.staff('/api/path-cases');
  assert.equal(list.status, 200); assert.equal(list.data.items[0].id, id); assert.equal(list.data.items[0].wants, brief.wants);
  for (const user of ['operations', 'admin']) assert.equal((await f.staff('/api/path-cases', { user })).status, 403, user);
  assert.equal((await f.staff('/api/path-cases', { user: 'counselor' })).data.items.length, 0);
  // fetch는 Sec-Fetch-Mode를 스스로 정하므로 node:http로 머리말을 그대로 보낸다(최상위 이동 흉내 포함).
  const { request } = await import('node:http');
  const rawGet = headers => new Promise((done, fail) => { const r = request(f.base + '/api/path-cases/' + id, { headers: { Cookie: 'synk_company_session=' + f.cookies.owner, ...headers } }, res => { res.resume(); done(res.statusCode); }); r.on('error', fail); r.end(); });
  for (const headers of [{}, { 'Sec-Fetch-Site': 'none' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate' }]) assert.equal(await rawGet(headers), 403, JSON.stringify(headers));
  assert.equal(await rawGet({ 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors' }), 200);
  // GET은 읽기만 한다(새 상담 그대로). 여는 것은 POST /open(CSRF)이 「보는 중」으로 바꾼다.
  assert.equal((await f.staff('/api/path-cases/' + id)).data.case.status, 'new');
  const detail = await f.staff('/api/path-cases/' + id + '/open', { body: {} });
  assert.equal(detail.data.case.status, 'reviewing');
  // CSRF · 출처가 맞아야 쓴다.
  assert.equal((await f.staff('/api/path-cases/' + id + '/close', { body: { revision: detail.data.case.revision }, headers: { 'X-CSRF-Token': 'bad' } })).status, 403);
  const reply = await f.staff('/api/path-cases/' + id + '/reply', { body: { revision: detail.data.case.revision, request_id: randomUUID(), text: '서류 목록을 보내 드릴게요.' } });
  assert.equal(reply.status, 200); assert.equal(reply.data.case.status, 'answered');
  const mine = await f.staff('/api/company-work/mine');
  assert.equal(mine.status, 200); assert.equal(mine.data.pathCases.length, 1);
  assert.equal(mine.data.pathCases[0].href, '/?tab=workroom&section=tools&tool=path-cases&caseId=' + id);
  assert.doesNotMatch(JSON.stringify(mine.data), /원서 서류|사정에 맞춘/);
  const back = await f.studentRequest('/api/path-student/cases', { token: s.token });
  assert.equal(back.data.ok, true); assert.equal(back.data.cases[0].status, 'answered'); assert.equal(back.data.cases[0].unread, 1);
  assert.equal(back.data.cases[0].wants, brief.wants); assert.match(back.data.cases[0].created_at, /^\d{4}-/); assert.deepEqual(Object.keys(back.data.cases[0].messages[0]).sort(), ['at', 'from', 'id', 'text']);
  // PATH 앱의 readCases가 이 답을 그대로 받는다.
  const seen = readCases(back.data);
  assert.equal(seen.length, 1); assert.equal(seen[0].id, id); assert.equal(seen[0].unread, 1); assert.equal(seen[0].wants, brief.wants); assert.equal(seen[0].messages.at(-1).from, 'staff');
  assert.equal((await f.studentRequest('/api/path-student/cases/' + id + '/read', { token: s.token, method: 'POST', body: {} })).data.case.unread, 0);
  const rows = f.app.store.db.prepare('SELECT body FROM documents').all().map(row => row.body).join('\n');
  assert.ok(!rows.includes(s.token) && !rows.includes(s.token.split('.')[1]), 'Bearer는 저장하지 않는다');
  assert.ok(!rows.includes('원서 서류 목록'), '건 본문은 암호화해 둔다');
  assert.equal((await f.studentRequest('/api/path-student/cases/' + id, { token: s.token, method: 'DELETE' })).data.deleted, true);
  assert.equal((await f.staff('/api/path-cases')).data.items.length, 0);
  const html = await (await fetch(f.base + '/')).text();
  assert.match(html, /path-cases\.js/); assert.match(html, /path-cases\.css/);
  assert.equal((await fetch(f.base + '/path-cases.js')).status, 200);
});

test('스위치가 꺼지면 새 건은 503으로 막고 학생 읽기는 된다(HTTP)', async t => {
  const f = await fixture(t, { env: { PATH_CASES_ENABLED: 'false' } }), s = f.student();
  assert.deepEqual((await f.studentRequest('/api/path-student/status')).data, { open: false });
  const refused = await f.studentRequest('/api/path-student/cases', { token: s.token, method: 'POST', body: f.handoff(s) });
  assert.equal(refused.status, 503); assert.equal(refused.data.error.code, 'PATH_CASES_CLOSED'); corsOnly(refused.headers);
  assert.equal((await f.studentRequest('/api/path-student/cases', { token: s.token })).status, 200);
});

test('화면 원천: 머리 문장 · 문의 접수 옆 자리 · PATH 권한일 때만 보이는 메뉴', () => {
  const source = readFileSync(new URL('./public/path-cases.js', import.meta.url), 'utf8'), maker = readFileSync(new URL('./public/maker-tools.js', import.meta.url), 'utf8');
  assert.match(source, /입학 · 비자 결과를 약속하지 않아요\. 학생과의 연락은 이 상담함에서만 해요/);
  assert.match(maker, /\['inquiries','문의 접수','desk'\],\['path-cases','PATH 상담함','desk'\]/);
  assert.match(maker, /row\[0\]==='path-cases'\?typeof pathCasesVisible==='function'&&pathCasesVisible\(\)/);
});
