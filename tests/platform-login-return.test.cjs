'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto'), { pathToFileURL } = require('node:url'), path = require('node:path');
const root = path.resolve(__dirname, '..'), now = 1800000000000;
const load = async () => {
  const core = await import(pathToFileURL(path.join(root, 'experiences/synk-account/src/core.mjs')));
  const entry = await import(pathToFileURL(path.join(root, 'experiences/synk-account/src/platform-login-return.mjs')));
  return { core, entry };
};
async function fixture() {
  const { core, entry } = await load(), values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const config = { configured: true, supabaseUrl: 'https://auth.example.test', clients: { platform: { clientId: 'platform-test-client', redirectUri: 'https://app.example.test/account/client.html?product=platform' } } };
  const start = async () => {
    await core.beginOAuth({ config, product: 'platform', storage, now, cryptoAPI: webcrypto });
    const pending = JSON.parse(storage.getItem('synk.oauth.pending.platform'));
    const intent = entry.rememberPlatformLogin(storage, { config, method: 'google', returnHash: '#solio/subscriptions', now });
    const url = new URL(config.clients.platform.redirectUri);
    url.searchParams.set('code', 'SYNTHETIC_CODE'); url.searchParams.set('state', pending.state);
    return { pending, intent, url };
  };
  return { core, entry, values, storage, config, start, ...await start() };
}
test('플랫폼 복귀: 실제 PKCE 콜백 소비 전 확인하고 교환 성공 뒤 의도를 한 번만 소비한다', async () => {
  const f = await fixture();
  const intent = f.entry.platformCallbackIntent({ ...f, product: 'platform', url: f.url.href, now });
  assert.ok(intent); assert.ok(f.storage.getItem('synk.oauth.pending.platform'));
  const fields = f.core.consumeCallback({ ...f, product: 'platform', url: f.url.href, now });
  assert.equal(fields.code, 'SYNTHETIC_CODE'); assert.equal(f.storage.getItem('synk.oauth.pending.platform'), null);
  assert.equal(f.entry.finishPlatformLogin(f.storage, intent, { now }), './platform.html#solio/subscriptions');
  assert.equal(f.storage.getItem(f.entry.PLATFORM_LOGIN_INTENT), null);
  assert.throws(() => f.entry.finishPlatformLogin(f.storage, intent, { now }));
  assert.ok(!JSON.stringify(intent).includes(f.pending.verifier));
  assert.ok(!JSON.stringify(intent).includes('SYNTHETIC_CODE'));
});
test('플랫폼 복귀: 다른 origin과 경로, 중복 및 임의 쿼리와 오류 응답을 거절한다', async () => {
  for (const mutate of [u => { u.host = 'other.example.test'; }, u => { u.pathname = '/wrong'; }, u => u.searchParams.append('state', u.searchParams.get('state')), u => u.searchParams.set('extra', 'x'), u => u.searchParams.set('error', 'access_denied'), u => { u.hash = 'token'; }]) {
    const f = await fixture(); mutate(f.url);
    assert.equal(f.entry.platformCallbackIntent({ ...f, product: 'platform', url: f.url.href, now }), null);
    assert.ok(f.storage.getItem('synk.oauth.pending.platform'), '실제 콜백 소비는 core만 한다');
  }
});
test('플랫폼 복귀: 저장된 의도는 외부 주소와 검색 및 인증값을 복귀 목적지에 넣지 않는다', async () => {
  const f = await fixture();
  assert.throws(() => f.entry.rememberPlatformLogin(f.storage, { config: f.config, method: 'email', returnHash: 'https://other.example.test/', now }));
  const intent = f.entry.rememberPlatformLogin(f.storage, { config: f.config, method: 'email', returnHash: '#library?q=SYNTHETIC_SECRET', now });
  assert.equal(intent.route, '#library'); assert.ok(!JSON.stringify(intent).includes('SYNTHETIC_SECRET'));
});
test('플랫폼 복귀: 만료되거나 미래인 시작 시각과 다른 설정의 클라이언트를 거절한다', async () => {
  for (const at of [now - 600001, now + 1]) {
    const f = await fixture(); f.pending.createdAt = at;
    f.storage.setItem('synk.oauth.pending.platform', JSON.stringify(f.pending));
    assert.throws(() => f.entry.rememberPlatformLogin(f.storage, { config: f.config, method: 'email', now }));
  }
  const f = await fixture(); f.config.clients.platform.clientId = 'different-client';
  assert.equal(f.entry.platformCallbackIntent({ ...f, product: 'platform', url: f.url.href, now }), null);
});
test('플랫폼 복귀: 이전 요청의 늦은 콜백이 새 요청의 의도를 지우지 않는다', async () => {
  const f = await fixture(), oldUrl = f.url.href, next = await f.start();
  const before = f.storage.getItem(f.entry.PLATFORM_LOGIN_INTENT);
  assert.notEqual(next.pending.state, f.pending.state);
  assert.equal(f.entry.platformCallbackIntent({ ...f, product: 'platform', url: oldUrl, now }), null);
  assert.equal(f.storage.getItem(f.entry.PLATFORM_LOGIN_INTENT), before);
});
test('플랫폼 복귀: 이전 토큰 교환 완료가 새 요청의 의도를 지우지 않는다', async () => {
  const f = await fixture(), captured = f.entry.platformCallbackIntent({ ...f, product: 'platform', url: f.url.href, now });
  f.core.consumeCallback({ ...f, product: 'platform', url: f.url.href, now });
  await f.start(); const before = f.storage.getItem(f.entry.PLATFORM_LOGIN_INTENT);
  assert.throws(() => f.entry.finishPlatformLogin(f.storage, captured, { now }));
  assert.equal(f.storage.getItem(f.entry.PLATFORM_LOGIN_INTENT), before);
});
test('플랫폼 복귀: 저장소가 막히면 목적지를 반환하지 않는다', async () => {
  const { entry } = await load(), storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(entry.platformCallbackIntent({ storage, product: 'platform', url: 'https://app.example.test/', now }), null);
  assert.throws(() => entry.finishPlatformLogin(storage, {}, { now }));
});

function cancelledUrl(f) {
  const url = new URL(f.config.clients.platform.redirectUri);
  url.searchParams.set('state', f.pending.state);
  url.searchParams.set('error', 'access_denied');
  return url;
}

test('플랫폼 취소: 등록 callback에서 정적 경로로 돌아가고 공급자 설명 대신 일회성 안내만 남긴다', async () => {
  const f = await fixture(), url = cancelledUrl(f);
  url.searchParams.set('error_description', 'SYNTHETIC_PROVIDER_PRIVATE_DETAIL');
  const captured = f.entry.platformErrorCallbackIntent({ ...f, url: url.href, product: 'platform', now });
  assert.ok(captured);
  assert.equal(f.entry.finishPlatformErrorReturn(f.storage, captured, { now }), './platform.html#solio/subscriptions');
  assert.equal(f.storage.getItem('synk.oauth.pending.platform'), null);
  assert.equal(f.storage.getItem(f.entry.PLATFORM_LOGIN_INTENT), null);
  const saved = JSON.stringify([...f.values]);
  for (const privateValue of [f.pending.verifier, f.pending.state, 'SYNTHETIC_PROVIDER_PRIVATE_DETAIL']) assert.ok(!saved.includes(privateValue));
  const notice = f.entry.takePlatformLoginNotice(f.storage, { now });
  assert.equal(notice.kind, 'cancelled');
  assert.equal(typeof notice.message, 'string');
  assert.ok(notice.message.length > 0);
  assert.ok(!JSON.stringify(notice).includes('SYNTHETIC_PROVIDER_PRIVATE_DETAIL'));
  assert.equal(f.entry.takePlatformLoginNotice(f.storage, { now }), null);
  assert.throws(() => f.entry.finishPlatformErrorReturn(f.storage, captured, { now }));
});

test('플랫폼 취소: 혼합 성공값과 중복 키, 임의 목적지, 다른 제품은 현재 요청을 소비하지 않는다', async () => {
  const mutations = [
    url => url.searchParams.set('code', 'SYNTHETIC_CODE'),
    url => url.searchParams.append('error', 'access_denied'),
    url => url.searchParams.append('state', url.searchParams.get('state')),
    url => url.searchParams.set('product', 'world'),
    url => url.searchParams.set('return', 'https://other.example.test/'),
    url => { url.host = 'other.example.test'; },
    url => { url.pathname = '/different-callback'; },
    url => { url.hash = 'invite=SYNTHETIC_PRIVATE'; },
  ];
  for (const mutate of mutations) {
    const f = await fixture(), url = cancelledUrl(f), pendingBefore = f.storage.getItem('synk.oauth.pending.platform');
    mutate(url);
    assert.equal(f.entry.platformErrorCallbackIntent({ ...f, url: url.href, product: 'platform', now }), null);
    assert.equal(f.storage.getItem('synk.oauth.pending.platform'), pendingBefore);
    assert.equal(f.storage.getItem(f.entry.PLATFORM_LOGIN_NOTICE), null);
  }
});

test('플랫폼 취소: 늦은 A 오류와 이미 분류한 A 취소 모두 새 B 의도와 PKCE 상태를 보존한다', async () => {
  const f = await fixture(), url = cancelledUrl(f);
  const old = f.entry.platformErrorCallbackIntent({ ...f, url: url.href, product: 'platform', now });
  assert.ok(old);
  await f.start();
  const before = JSON.stringify([...f.values]);
  assert.equal(f.entry.platformErrorCallbackIntent({ ...f, url: url.href, product: 'platform', now }), null);
  assert.throws(() => f.entry.finishPlatformErrorReturn(f.storage, old, { now }));
  assert.equal(JSON.stringify([...f.values]), before);
});

test('플랫폼 계정 확인: 사전 승인 URL과 state 없는 details를 각각 현재 PKCE 요청에 묶는다', async () => {
  const f = await fixture();
  const authorized = f.entry.matchPlatformPreauthorizedRedirect({ ...f, targetUrl: f.url.href, now });
  assert.ok(authorized);
  assert.equal(authorized.approveUrl, f.url.href);
  const details = { client_id: f.config.clients.platform.clientId, redirect_uri: f.config.clients.platform.redirectUri };
  const awaiting = f.entry.matchPlatformAuthorizationDetails({ ...f, details, now });
  assert.ok(awaiting);
  for (const matched of [authorized, awaiting]) {
    const cancel = new URL(matched.cancelUrl);
    assert.equal(cancel.origin + cancel.pathname, 'https://app.example.test/account/client.html');
    assert.deepEqual([...cancel.searchParams.keys()].sort(), ['error', 'product', 'state']);
    assert.equal(cancel.searchParams.get('product'), 'platform');
    assert.equal(cancel.searchParams.get('state'), f.pending.state);
    assert.equal(cancel.searchParams.get('error'), 'access_denied');
  }
});

test('플랫폼 계정 확인: 다른 client와 redirect, 늦은 요청, 만료 결속은 자동 확인 대상으로 삼지 않는다', async () => {
  const f = await fixture(), oldUrl = f.url.href;
  const good = { client_id: f.config.clients.platform.clientId, redirect_uri: f.config.clients.platform.redirectUri };
  for (const details of [
    { ...good, client_id: 'different-client' },
    { ...good, client: { id: 'different-client' } },
    { ...good, redirect_uri: 'https://other.example.test/account/client.html?product=platform' },
    { ...good, redirect_uri: good.redirect_uri + '&product=platform' },
  ]) assert.equal(f.entry.matchPlatformAuthorizationDetails({ ...f, details, now }), null);
  assert.equal(f.entry.matchPlatformAuthorizationDetails({ ...f, details: good, now: now + 600001 }), null);
  await f.start();
  assert.equal(f.entry.matchPlatformPreauthorizedRedirect({ ...f, targetUrl: oldUrl, now }), null);
});

test('플랫폼 로그인 힌트: 짧은 요청 시간창과 callback 부재, 다른 제품의 최신 요청 부재가 모두 필요하다', async () => {
  const f = await fixture();
  const args = { ...f, authorizationId: 'synthetic-authorization', requestSeen: now + 500, now: now + 1000, url: 'https://app.example.test/id/?authorization_id=synthetic-authorization' };
  const hint = f.entry.resolvePlatformPortalEntryHint(args);
  assert.equal(hint.method, 'google');
  assert.equal(hint.state, f.pending.state);
  for (const patch of [
    { hadCallback: true }, { requestSeen: now - 1 }, { requestSeen: now + 1001 },
    { requestSeen: now + 120001, now: now + 120001 },
    { url: args.url + '&error=access_denied' }, { url: args.url + '#access_token=SYNTHETIC' },
    { url: args.url + '&view=reset' },
  ]) assert.equal(f.entry.resolvePlatformPortalEntryHint({ ...args, ...patch }), null);
  f.storage.setItem('synk.oauth.pending.world', JSON.stringify({ createdAt: now + 500 }));
  assert.equal(f.entry.resolvePlatformPortalEntryHint(args), null);
});

test('플랫폼 로그인 힌트: 이메일과 가입 의도는 같은 요청에 결속된 표시 힌트로 돌아온다', async () => {
  for (const method of ['email', 'signup']) {
    const f = await fixture();
    f.entry.rememberPlatformLogin(f.storage, { config: f.config, method, returnHash: '#account', now });
    const hint = f.entry.resolvePlatformPortalEntryHint({ ...f, url: 'https://app.example.test/id/?authorization_id=synthetic-authorization', authorizationId: 'synthetic-authorization', requestSeen: now, now });
    assert.equal(hint.method, method);
    assert.equal(hint.state, f.pending.state);
    assert.ok(!JSON.stringify(hint).includes(f.pending.verifier));
  }
});

