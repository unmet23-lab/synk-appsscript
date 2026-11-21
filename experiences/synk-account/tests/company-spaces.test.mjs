import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPANY_SPACES_URL,
  acceptCompanySpaces,
  companySpacesHtml,
  emptyCompanySpaces,
  keepCompanySpaces,
  readCompanySpacesBody,
  requestCompanySpaces,
} from '../src/company-spaces.mjs';
import { createPlatformAccount } from '../src/platform-account.mjs';

// synk.im 홈 「회사 공간」 칸(유호님 11-21 「배정된 계정에만 링크」 · 「웅」): 조회 · 칸 조건 · 계정 관리자의 토큰 보관을 본다.
const account = '20000000-0000-4000-8000-000000000002';
const secondAccount = '60000000-0000-4000-8000-000000000006';
const body = (workspace, pulse) => ({ version: 1, accountMatch: true, workspace: { state: workspace, destination: '/' }, pulse: { state: pulse, destination: '/pulse-app/' } });
const reply = (status, value) => ({ status, redirected: false, text: async () => (typeof value === 'string' ? value : JSON.stringify(value)) });
const esc = value => String(value).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const signedIn = (accountId = account) => ({ status: 'signed-in', signedIn: true, accountId });

test('the company answer becomes only the assigned destinations, and any other shape becomes nothing', () => {
  assert.deepEqual(readCompanySpacesBody(body('assigned', 'assigned')), ['/', '/pulse-app/']);
  assert.deepEqual(readCompanySpacesBody(body('assigned', 'unassigned')), ['/']);
  assert.deepEqual(readCompanySpacesBody(body('unassigned', 'assigned')), ['/pulse-app/']);
  assert.deepEqual(readCompanySpacesBody(body('unassigned', 'unavailable')), []);
  for (const bad of [
    null, [], { ...body('assigned', 'assigned'), extra: 1 }, { ...body('assigned', 'assigned'), version: 2 }, { ...body('assigned', 'assigned'), accountMatch: false },
    { ...body('assigned', 'assigned'), workspace: { state: 'assigned', destination: '/elsewhere' } }, { ...body('assigned', 'assigned'), pulse: { state: 'owner', destination: '/pulse-app/' } },
    { ...body('assigned', 'assigned'), workspace: { state: 'assigned', destination: '/', more: 1 } }, { ...body('assigned', 'assigned'), workspace: { state: 'unavailable', destination: '/' } },
  ]) assert.equal(readCompanySpacesBody(bad), null, JSON.stringify(bad));
});

test('the lookup sends only the platform login and the expected account, without cookies, and reads the fixed answer', async () => {
  const calls = [];
  const result = await requestCompanySpaces({ fetch: async (url, init) => { calls.push({ url, init }); return reply(200, body('assigned', 'unassigned')); }, token: 'synthetic-access', expectedAccountId: account });
  assert.deepEqual(result, { destinations: ['/'] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, COMPANY_SPACES_URL);
  const { init } = calls[0];
  assert.equal(init.method, 'POST');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
  assert.equal(init.cache, 'no-store');
  assert.deepEqual(init.headers, { Authorization: 'Bearer synthetic-access', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(init.body), { expectedAccountId: account });
  assert.ok(!JSON.stringify(result).includes('synthetic-access'));
});

test('the lookup turns failures into a code and never into assignments', async () => {
  const run = fetcher => requestCompanySpaces({ fetch: fetcher, token: 't', expectedAccountId: account });
  assert.deepEqual(await run(async () => reply(401, { error: { code: 'AUTH_REQUIRED', retryable: false } })), { code: 'AUTH_REQUIRED' });
  assert.deepEqual(await run(async () => reply(403, { error: { code: 'CLIENT_FORBIDDEN', retryable: false } })), { code: 'CLIENT_FORBIDDEN' });
  assert.deepEqual(await run(async () => reply(409, { error: { code: 'ACCOUNT_MISMATCH', retryable: false } })), { code: 'ACCOUNT_MISMATCH' });
  assert.deepEqual(await run(async () => reply(500, { error: { code: 'not a code <b>' } })), { code: 'TEMPORARY_UNAVAILABLE' });
  assert.deepEqual(await run(async () => reply(200, '{')), { code: 'TEMPORARY_UNAVAILABLE' });
  assert.deepEqual(await run(async () => reply(200, { ...body('assigned', 'assigned'), extra: true })), { code: 'TEMPORARY_UNAVAILABLE' });
  assert.deepEqual(await run(async () => reply(200, 'x'.repeat(5000))), { code: 'TEMPORARY_UNAVAILABLE' });
  assert.deepEqual(await run(async () => ({ status: 200, redirected: true, text: async () => JSON.stringify(body('assigned', 'assigned')) })), { code: 'TEMPORARY_UNAVAILABLE' });
  assert.deepEqual(await run(async () => { throw new TypeError('Failed to fetch'); }), { code: 'TEMPORARY_UNAVAILABLE' });
  assert.deepEqual(await requestCompanySpaces({ fetch: async () => assert.fail('no request without a token'), token: '', expectedAccountId: account }), { code: 'INVALID_INPUT' });
});

test('the block shows only for the signed-in account the lookup answered, with only known destinations', () => {
  const workspaceHref = (href, identity) => `${href}#expect=${identity.accountId}`;
  const spaces = acceptCompanySpaces({ accountKey: account, destinations: ['/', '/pulse-app/', '/elsewhere', '/'] });
  assert.deepEqual(spaces, { accountId: account, destinations: ['/', '/pulse-app/'] });
  const html = companySpacesHtml(spaces, signedIn(), { esc, workspaceHref });
  assert.match(html, /<h2 id="company-spaces-title">회사 공간<\/h2>/);
  assert.match(html, new RegExp(`href="https://workspace.synk.im/#expect=${account}" data-company-space="workspace">Workspace<`));
  assert.match(html, /href="https:\/\/workspace.synk.im\/pulse-app\/" data-company-space="pulse">PULSE</);
  assert.equal(companySpacesHtml(spaces, signedIn(secondAccount), { esc, workspaceHref }), '', 'another account never sees these shortcuts');
  assert.equal(companySpacesHtml(spaces, { ...signedIn(), status: 'loading' }, { esc, workspaceHref }), '');
  assert.equal(companySpacesHtml(spaces, { ...signedIn(), signedIn: false }, { esc, workspaceHref }), '');
  assert.equal(companySpacesHtml(acceptCompanySpaces({ accountKey: account, destinations: [] }), signedIn(), { esc, workspaceHref }), '', 'no assignment, no block');
  assert.doesNotMatch(companySpacesHtml(acceptCompanySpaces({ accountKey: account, destinations: ['/pulse-app/'] }), signedIn(), { esc, workspaceHref }), /data-company-space="workspace"/);
  assert.deepEqual(acceptCompanySpaces({ destinations: ['/'] }), emptyCompanySpaces());
});

test('the block empties on sign-out or another account and survives the same account', () => {
  const spaces = acceptCompanySpaces({ accountKey: account, destinations: ['/'] });
  assert.deepEqual(keepCompanySpaces(spaces, 'signed-out', null), emptyCompanySpaces());
  assert.deepEqual(keepCompanySpaces(spaces, 'signed-in', signedIn(secondAccount)), emptyCompanySpaces());
  assert.equal(keepCompanySpaces(spaces, 'signed-in', signedIn()), spaces);
  assert.equal(keepCompanySpaces(spaces, 'loading', null), spaces, 'a refresh in progress keeps the same account block');
});

// 실제 계정 관리자: 묶인 계정의 토큰으로만 묻고, 만료면 한 번 새로 받아 다시 묻고, 그사이 계정이 바뀌면 결과를 버린다.
async function accountFixture(t, respond) {
  const key = 'synk.oauth.session.platform', calls = [], refreshes = [];
  const values = new Map([[key, JSON.stringify({ access_token: 'access-1', refresh_token: 'refresh-1' })]]);
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const manager = createPlatformAccount({
    config: { configured: true, clients: { platform: { clientId: 'synthetic-client', redirectUri: 'https://synthetic.invalid/platform' } }, accountApiUrl: 'https://synthetic.invalid', supabasePublishableKey: 'synthetic-key' },
    storage,
    accountFactory: () => ({ load: async () => ({ ok: true, account: { synk_user_id: account, profile: { display_name: '합성 회원' } }, onboarding: { purpose: 'none' }, capabilities: { learningSync: false } }) }),
    requestToken: async (_config, form) => { refreshes.push(form.refresh_token); return { access_token: 'access-2', refresh_token: 'refresh-2' }; },
    fetcher: async (url, init) => { calls.push({ url, token: init.headers.Authorization }); return respond(calls.length, { url, init, values, key }); },
  });
  t.after(() => manager.stop());
  await manager.refresh();
  assert.equal(manager.isAccountBound(account), true);
  return { manager, calls, refreshes, values, key };
}

test('the account manager asks with its bound platform login and returns only destinations', async t => {
  const f = await accountFixture(t, () => reply(200, body('assigned', 'assigned')));
  assert.deepEqual(await f.manager.companySpaces(account), ['/', '/pulse-app/']);
  assert.deepEqual(f.calls, [{ url: COMPANY_SPACES_URL, token: 'Bearer access-1' }]);
  assert.equal(typeof f.manager.accessToken, 'undefined', 'the manager exposes no token');
});

test('an expired platform login is renewed once, and a second refusal leaves no block', async t => {
  const f = await accountFixture(t, n => n === 1 ? reply(401, { error: { code: 'AUTH_REQUIRED', retryable: false } }) : reply(200, body('unassigned', 'assigned')));
  assert.deepEqual(await f.manager.companySpaces(account), ['/pulse-app/']);
  assert.deepEqual(f.calls.map(call => call.token), ['Bearer access-1', 'Bearer access-2']);
  assert.deepEqual(f.refreshes, ['refresh-1']);
  const g = await accountFixture(t, () => reply(401, { error: { code: 'AUTH_REQUIRED', retryable: false } }));
  assert.equal(await g.manager.companySpaces(account), null);
  assert.equal(g.calls.length, 2);
  const h = await accountFixture(t, () => reply(503, { error: { code: 'TEMPORARY_UNAVAILABLE', retryable: true } }));
  assert.equal(await h.manager.companySpaces(account), null);
  assert.equal(h.calls.length, 1, 'only an expired login is retried');
});

test('another account or a session replaced during the lookup gets nothing', async t => {
  const f = await accountFixture(t, () => assert.fail('no request for another account'));
  await assert.rejects(f.manager.companySpaces(secondAccount), { code: 'ACCOUNT_CHANGED' });
  for (const change of ['replacement', 'malformed', 'removed']) {
    const g = await accountFixture(t, (_n, { values, key }) => {
      if (change === 'replacement') values.set(key, JSON.stringify({ access_token: 'other-access', refresh_token: 'other-refresh' }));
      else if (change === 'malformed') values.set(key, '{');
      else values.delete(key);
      return reply(200, body('assigned', 'assigned'));
    });
    await assert.rejects(g.manager.companySpaces(account), { code: 'ACCOUNT_CHANGED' }, change);
  }
});
