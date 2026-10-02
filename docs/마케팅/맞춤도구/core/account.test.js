'use strict';
// core/account.js — SYNK 계정에서 고른 설정만 불러오고, 토큰은 남기지 않는다.
// 실행: node --test "docs/마케팅/맞춤도구/core/account.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createHash } = require('node:crypto');

const FILE = path.join(__dirname, 'account.js');
const storage = () => { const data = new Map(); return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
function page(href) {
  const url = new URL(href), assigned = [], replaced = [];
  const location = { get href() { return url.href; }, get origin() { return url.origin; }, get pathname() { return url.pathname; }, get hash() { return url.hash; },
    assign: to => assigned.push(to) };
  const history = { replaceState: (_s, _t, to) => { replaced.push(to); const next = new URL(to, url); url.search = next.search; url.hash = next.hash; } };
  Object.assign(globalThis, { location, history, sessionStorage: storage(), localStorage: storage() });
  delete require.cache[require.resolve(FILE)];
  require(FILE);
  return { api: globalThis.SynkToolAccount, assigned, replaced, url };
}
const b64url = buffer => Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function server({ presentation = { support: 'step', textSize: 'large', explanation: 'brief' }, tokenStatus = 200, atlasStatus = 200 } = {}) {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/oauth/token')) return new Response(JSON.stringify(tokenStatus === 200 ? { access_token: 'secret-token-123', refresh_token: 'refresh-456', expires_in: 3600 } : { error: 'invalid_grant' }), { status: tokenStatus });
    if (url.includes('/functions/v1/synk-account?view=atlas')) return new Response(JSON.stringify(atlasStatus === 200 ? { ok: true, shared: 'practice-and-settings', summary: { presentation, reasons: ['travel'], practice: { answered: 3 } } } : { ok: false, error: { code: 'AUTH_REQUIRED' } }), { status: atlasStatus });
    if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
    throw new Error(`unexpected ${url}`);
  };
  return { calls, fetcher };
}

test('only the registered synk.im tool pages offer it; a preview or another page does not', () => {
  assert.equal(page('https://synk.im/brief/computer/').api.available(), true);
  assert.equal(page('https://synk.im/brief/meeting/').api.available(), true);
  assert.equal(page('http://127.0.0.1:4391/brief/computer/').api.available(), false);
  assert.equal(page('https://synk.im/brief/computer/index.html').api.available(), false);
});

test('begin goes to SYNK login with PKCE (S256) and remembers only the one-time verifier in this tab', async () => {
  const { api, assigned } = page('https://synk.im/brief/computer/');
  await api.begin();
  const to = new URL(assigned[0]);
  assert.equal(to.origin + to.pathname, 'https://qiwxeddwwnzkwalpsuty.supabase.co/auth/v1/oauth/authorize');
  const pending = JSON.parse(globalThis.sessionStorage.getItem('synk.tool.account.pending'));
  assert.deepEqual(Object.fromEntries([...to.searchParams].filter(([k]) => k !== 'state' && k !== 'code_challenge')),
    { response_type: 'code', client_id: api.CONFIG.clientId, redirect_uri: 'https://synk.im/brief/computer/', code_challenge_method: 'S256', scope: 'openid' });
  assert.equal(to.searchParams.get('state'), pending.state);
  assert.equal(to.searchParams.get('code_challenge'), b64url(createHash('sha256').update(pending.verifier).digest()));
  assert.equal(globalThis.localStorage.data.size, 0, 'nothing is kept on the device before the person signs in');
});

test('coming back: the chosen settings are read, the token is used once, logged out and kept nowhere', async () => {
  const { api } = page('https://synk.im/brief/computer/');
  await api.begin();
  const { state } = JSON.parse(globalThis.sessionStorage.getItem('synk.tool.account.pending'));
  const back = page(`https://synk.im/brief/computer/?code=abc&state=${state}#r=keep`);
  globalThis.sessionStorage.setItem('synk.tool.account.pending', JSON.stringify({ ...JSON.parse(JSON.stringify({ verifier: 'v-123', state, redirectUri: 'https://synk.im/brief/computer/', createdAt: Date.now() })) }));
  const cloud = server();
  const result = await back.api.finish({ fetcher: cloud.fetcher });
  assert.deepEqual(result, { status: 'loaded', presentation: { support: 'step', textSize: 'large', explanation: 'brief' }, shared: true });
  assert.equal(back.url.search, '', 'the code and state leave the address bar');
  assert.equal(back.url.hash, '#r=keep', 'a shared result link stays');
  const [token, atlas, logout] = cloud.calls;
  assert.equal(new URLSearchParams(token.init.body).get('code_verifier'), 'v-123');
  assert.equal(new URLSearchParams(token.init.body).get('redirect_uri'), 'https://synk.im/brief/computer/');
  assert.equal(atlas.init.headers.Authorization, 'Bearer secret-token-123');
  assert.equal(atlas.init.headers['X-SYNK-Product'], 'platform');
  assert.match(logout.url, /\/auth\/v1\/logout\?scope=local$/);
  const everything = JSON.stringify([...globalThis.localStorage.data, ...globalThis.sessionStorage.data]);
  assert.ok(!everything.includes('secret-token') && !everything.includes('refresh-456'), 'no token is stored anywhere');
  assert.ok(!everything.includes('travel') && !everything.includes('answered'), 'only the chosen settings are kept');
  assert.deepEqual(back.api.read().presentation, { support: 'step', textSize: 'large', explanation: 'brief' });
  assert.deepEqual(back.api.describe(back.api.read().presentation), ['단계별 도움', '큰 글씨', '짧은 설명']);
  back.api.forget();
  assert.equal(back.api.read(), null);
});

test('a different state, an old request or a cancelled login changes nothing and calls no server', async () => {
  const cases = [
    [{ verifier: 'v', state: 'mine', redirectUri: 'https://synk.im/brief/computer/', createdAt: Date.now() }, '?code=abc&state=theirs', 'failed'],
    [{ verifier: 'v', state: 's', redirectUri: 'https://synk.im/brief/computer/', createdAt: Date.now() - 11 * 60000 }, '?code=abc&state=s', 'failed'],
    [{ verifier: 'v', state: 's', redirectUri: 'https://synk.im/brief/computer/', createdAt: Date.now() }, '?error=access_denied&state=s', 'denied'],
    [null, '?code=abc&state=s', 'failed'],
  ];
  for (const [pending, query, status] of cases) {
    const back = page(`https://synk.im/brief/computer/${query}`);
    if (pending) globalThis.sessionStorage.setItem('synk.tool.account.pending', JSON.stringify(pending));
    const cloud = server();
    assert.equal((await back.api.finish({ fetcher: cloud.fetcher })).status, status, query);
    assert.equal(cloud.calls.length, 0);
    assert.equal(back.api.read(), null);
  }
  assert.equal(await page('https://synk.im/brief/computer/').api.finish({ fetcher: server().fetcher }), null, 'an ordinary visit is not a return from login');
});

test('only known settings are kept; anything else from the server is dropped', async () => {
  const back = page('https://synk.im/brief/meeting/?code=abc&state=s');
  globalThis.sessionStorage.setItem('synk.tool.account.pending', JSON.stringify({ verifier: 'v', state: 's', redirectUri: 'https://synk.im/brief/meeting/', createdAt: Date.now() }));
  const result = await back.api.finish({ fetcher: server({ presentation: { support: 'step', textSize: 'huge', age: 40, motion: 'reduced' } }).fetcher });
  assert.deepEqual(result.presentation, { support: 'step', motion: 'reduced' });
  const failed = page('https://synk.im/brief/meeting/?code=abc&state=s');
  globalThis.sessionStorage.setItem('synk.tool.account.pending', JSON.stringify({ verifier: 'v', state: 's', redirectUri: 'https://synk.im/brief/meeting/', createdAt: Date.now() }));
  const cloud = server({ atlasStatus: 401 });
  assert.equal((await failed.api.finish({ fetcher: cloud.fetcher })).status, 'failed');
  assert.ok(cloud.calls.some(c => c.url.includes('/auth/v1/logout')), 'a failed read still ends the login');
});
