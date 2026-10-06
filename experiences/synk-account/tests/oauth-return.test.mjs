import test from 'node:test';
import assert from 'node:assert/strict';
import { isOAuthReturnNavigation } from '../oauth-return.mjs';
import { sharedAccountServer } from '../server-shared.mjs';

const base = 'http://127.0.0.1:4298/';
const config = { version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_publishable_fixture',
  portalUrl: 'https://id.example.test/', clients: { 'family-album': { clientId: 'fixture-family', redirectUri: base } } };
const headers = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
const allowed = (raw = '/?state=opaque-state&code=opaque-code', { method = 'GET', changes = {}, settings = config, key = 'family-album', target } = {}) =>
  isOAuthReturnNavigation({ method, url: raw, headers: { ...headers, ...changes } }, target || new URL(raw, base), settings, key);

test('registered root navigation permits approval and denial without server-side token or state access', () => {
  assert.equal(allowed(), true);
  assert.equal(allowed('/?error=access_denied&state=opaque-state'), true);
  assert.equal(allowed('/?state=opaque-state&error=access_denied&error_description=User+cancelled'), true);
  assert.equal(allowed(undefined, { changes: { origin: new URL(base).origin } }), true);
  // State correctness belongs to the existing browser transaction, not this navigation exception.
  assert.equal(allowed('/?state=unverified-state&code=unverified-code'), true);
});

test('only GET top-level document navigation receives the exception', () => {
  for (const method of ['HEAD', 'POST', 'OPTIONS', 'PUT']) assert.equal(allowed(undefined, { method }), false, method);
  for (const changes of [{ 'sec-fetch-mode': 'cors' }, { 'sec-fetch-mode': 'no-cors' }, { 'sec-fetch-mode': undefined },
    { 'sec-fetch-dest': 'iframe' }, { 'sec-fetch-dest': 'empty' }, { 'sec-fetch-dest': 'script' }, { 'sec-fetch-dest': undefined },
    { origin: 'https://id.example.test' }, { origin: 'null' }]) assert.equal(allowed(undefined, { changes }), false, JSON.stringify(changes));
});

test('root path and exact registered host port cannot be replaced or normalized into acceptance', () => {
  for (const raw of ['/index.html?state=s&code=c', '/app.mjs?state=s&code=c', '/api/account-config?state=s&code=c',
    '/assets/camera.webp?state=s&code=c', '/%2f?state=s&code=c', '/a/../?state=s&code=c',
    '/%2e/?state=s&code=c', '//127.0.0.1:4298/?state=s&code=c', base + '?state=s&code=c']) assert.equal(allowed(raw), false, raw);
  for (const target of ['http://localhost:4298/?state=s&code=c', 'http://127.0.0.1:4299/?state=s&code=c',
    'https://127.0.0.1:4298/?state=s&code=c', 'http://name:pass@127.0.0.1:4298/?state=s&code=c',
    base + '?state=s&code=c#fragment', base + '?state=s&code=other']) assert.equal(allowed('/?state=s&code=c', { target }), false, target);
});

test('missing config, different app and unsupported registered callbacks keep the gate closed', () => {
  for (const field of ['supabaseUrl', 'supabasePublishableKey', 'portalUrl']) assert.equal(allowed(undefined, { settings: { ...config, [field]: '' } }), false, field);
  for (const redirectUri of ['https://site.example.test/', 'http://192.168.1.4:4298/', base + 'index.html', base + '?mode=care', base + '#a']) {
    assert.equal(allowed(undefined, { settings: { ...config, clients: { 'family-album': { clientId: 'fixture', redirectUri } } } }), false, redirectUri);
  }
  assert.equal(allowed(undefined, { settings: { version: 1, clients: {} } }), false);
  assert.equal(allowed(undefined, { key: 'care' }), false);
});

test('response needs one nonempty state and exactly one code or error with no extra or duplicate fields', () => {
  for (const query of ['', 'state=s', 'code=c', 'state=&code=c', 'state=%20&code=c', 'state=s&code=', 'state=s&error=',
    'state=s&code=c&error=access_denied', 'state=s&state=s&code=c', 'state=s&code=c&code=c',
    'state=s&error=access_denied&error=access_denied', 'state=s&error=access_denied&error_description=a&error_description=b',
    'state=s&code=c&error_description=no', 'state=s&code=c&access_token=token', 'state=s&code=c&refresh_token=token',
    'state=s&code=c&next=other', 'state=s%00&code=c', 'state=s&error=denied&error_description=line%0abreak',
    'state=' + 's'.repeat(513) + '&code=c', 'state=s&code=' + 'c'.repeat(4097),
    'state=s&error=' + 'e'.repeat(257), 'state=s&error=denied&error_description=' + 'd'.repeat(2049),
    'state=s&code=' + 'c'.repeat(8192)]) assert.equal(allowed('/?' + query), false, query.slice(0, 100));
});

test('shared server uses validated app config and does not expose its server-only helper', async () => {
  const shared = sharedAccountServer({ config }); await shared.ready;
  const req = { method: 'GET', url: '/?state=s&code=c', headers };
  assert.equal(shared.allowsOAuthReturn(req, new URL(req.url, base), 'family-album'), true);
  assert.equal(shared.allowsOAuthReturn(req, new URL(req.url, base), 'path'), false);
  assert.equal(await shared.read('/synk-account/oauth-return.mjs'), null);
  const invalid = sharedAccountServer({ config: { ...config, supabasePublishableKey: 'sb_secret_invalid' } }); await invalid.ready;
  assert.equal(invalid.allowsOAuthReturn(req, new URL(req.url, base), 'family-album'), false);
});
