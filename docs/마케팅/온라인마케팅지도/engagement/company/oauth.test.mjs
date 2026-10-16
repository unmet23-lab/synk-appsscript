import test from 'node:test';
import assert from 'node:assert/strict';
import { providers, createAuthorization, exchangeCode, refreshCredentials, verifyYouTubePublishingConnection, OAuthError } from './oauth.mjs';

const DAY = 86_400_000;
const config = { clientId: 'fixture-client', clientSecret: 'fixture-secret', redirectUri: 'https://sns.example.test/api/oauth/youtube/callback' };
const flow = { ...config, code: 'fixture-code', state: 'fixture-state-01234567890123456789' };
const date = offset => new Date(Date.now() + offset).toISOString();
const failNetwork = async () => { assert.fail('This path must not call the provider'); };

test('comment OAuth is an explicit addition and verified unknown-expiry IG tokens do not refresh on first read',async()=>{
  const ig=new URL(createAuthorization('instagram',{...flow,comments:true})),fb=new URL(createAuthorization('facebook',{...flow,comments:true}));
  assert.ok(ig.searchParams.get('scope').includes('instagram_business_manage_comments'));assert.ok(fb.searchParams.get('scope').includes('pages_manage_engagement'));
  assert.ok(!ig.searchParams.get('scope').includes('manage_insights'));assert.ok(!fb.searchParams.get('scope').includes('read_insights'));
  assert.ok(new URL(createAuthorization('instagram',{...flow,comments:true,existingGrantedScopes:['instagram_business_manage_insights','forged']})).searchParams.get('scope').includes('manage_insights'));
  const token={accessToken:'synthetic-existing',authType:'instagram-login',metaIdentityVersion:1,expiresAt:null,expiryStatus:'not-provided'};
  assert.deepEqual(await refreshCredentials('instagram',token,{}, {fetchImpl:failNetwork}),token);
});

test('publishing OAuth requests the correct capability and preserves only allowlisted existing grants',()=>{
  const scopes=(platform,options)=>new URL(createAuthorization(platform,{...flow,...options})).searchParams.get('scope').split(/[ ,]+/);
  assert.deepEqual(scopes('instagram',{publishing:true}),['instagram_business_basic','instagram_business_content_publish']);
  assert.deepEqual(scopes('facebook',{publishing:true}),['pages_show_list','pages_read_engagement','pages_manage_posts']);
  assert.ok(!scopes('instagram',{publishing:true}).some(scope=>scope.includes('insights')));assert.ok(!scopes('facebook',{publishing:true}).includes('read_insights'));
  const combined=scopes('instagram',{publishing:true,comments:true,existingGrantedScopes:['instagram_business_manage_insights','forged_scope','pages_manage_posts']});
  for(const scope of ['instagram_business_basic','instagram_business_manage_comments','instagram_business_content_publish','instagram_business_manage_insights'])assert.ok(combined.includes(scope));
  assert.ok(!combined.includes('forged_scope'));assert.ok(!combined.includes('pages_manage_posts'));assert.equal(combined.length,new Set(combined).size);
  assert.ok(scopes('instagram',{comments:true,existingGrantedScopes:['instagram_business_content_publish']}).includes('instagram_business_content_publish'));
  const youtube=scopes('youtube',{publishing:true});assert.ok(youtube.includes('https://www.googleapis.com/auth/youtube.upload'));assert.ok(youtube.includes('https://www.googleapis.com/auth/youtube.readonly'));assert.ok(!youtube.includes('https://www.googleapis.com/auth/yt-analytics.readonly'));
  assert.ok(!scopes('youtube',{}).includes('https://www.googleapis.com/auth/youtube.upload'));assert.ok(!scopes('tiktok',{publishing:true}).includes('video.publish'));
});

const ytId='UC'+'A'.repeat(22),ytOther='UC'+'B'.repeat(22),ytClock=()=> '2026-10-14T00:00:00.000Z';
const ytCredentials={accessToken:'synthetic-google-private',refreshToken:'synthetic-refresh-private',authType:'google-oauth',scope:'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload',expiresAt:'2026-10-14T01:00:00.000Z'};
test('YouTube publishing proof uses server-observed target and ownership with a header token',async()=>{
  const calls=[],fetchImpl=async(raw,options)=>{const url=new URL(raw);calls.push({url,options});return {ok:true,json:async()=>({items:[{id:ytId}]})};};let authorized=0;
  const result=await verifyYouTubePublishingConnection({channel:{handle:'@synk'},credentials:ytCredentials,clock:ytClock,fetchImpl,authorize:()=>authorized++});
  assert.deepEqual(result.identity,{id:ytId});assert.equal(result.credentials.accountId,ytId);assert.equal(result.credentials.permissionsVerifiedAt,ytClock());assert.equal(result.credentials.refreshToken,ytCredentials.refreshToken);assert.equal(ytCredentials.accountId,undefined);
  assert.equal(calls.length,2);assert.equal(calls[0].url.searchParams.get('forHandle'),'@synk');assert.equal(calls[1].url.searchParams.get('mine'),'true');assert.ok(authorized>=4);
  for(const {url,options} of calls){assert.equal(url.origin,'https://www.googleapis.com');assert.ok(!url.href.includes(ytCredentials.accessToken));assert.equal(options.headers.Authorization,'Bearer '+ytCredentials.accessToken);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');}
});

test('YouTube publishing refuses missing grants or invalid expiry before a network request',async()=>{
  for(const credentials of [{...ytCredentials,scope:'https://www.googleapis.com/auth/youtube.readonly'},{...ytCredentials,scope:'https://www.googleapis.com/auth/youtube.upload'},{...ytCredentials,accessToken:''},{...ytCredentials,expiresAt:null},{...ytCredentials,expiresAt:'2026-10-14T00:00:00.000Z'}])await assert.rejects(verifyYouTubePublishingConnection({channel:{externalId:ytId},credentials,clock:ytClock,fetchImpl:failNetwork}),OAuthError);
});

test('YouTube publishing rejects unrelated ownership, exchanged account mismatch and malformed targets',async()=>{
  for(const [target,owned,credentials] of [[ytOther,ytOther,ytCredentials],[ytId,ytOther,ytCredentials],[ytId,ytId,{...ytCredentials,accountId:ytOther}],['invalid-id','invalid-id',ytCredentials]]){
    let reads=0;const fetchImpl=async()=>({ok:true,json:async()=>({items:[{id:++reads===1?target:owned}]})});
    await assert.rejects(verifyYouTubePublishingConnection({channel:{externalId:ytId},credentials,clock:ytClock,fetchImpl}),{code:'YOUTUBE_ACCOUNT_MISMATCH'});
  }
});

test('YouTube proof honors authorization changes and never exposes provider error details',async()=>{
  let allowed=true,calls=0;const fetchImpl=async()=>{calls++;allowed=false;return {ok:true,json:async()=>({items:[{id:ytId}]})};};
  await assert.rejects(verifyYouTubePublishingConnection({channel:{externalId:ytId},credentials:ytCredentials,clock:ytClock,fetchImpl,authorize:()=>{if(!allowed)throw Error('synthetic-secret-detail');}}),error=>error instanceof OAuthError&&!error.message.includes('synthetic-secret-detail'));assert.equal(calls,1);
  for(const fetchImpl of [async()=>{throw Error('synthetic-google-private');},async()=>({ok:false,json:async()=>({error:'synthetic-google-private'})}),async()=>({ok:true,json:async()=>({items:null})})])await assert.rejects(verifyYouTubePublishingConnection({channel:{externalId:ytId},credentials:ytCredentials,clock:ytClock,fetchImpl}),error=>error instanceof OAuthError&&!error.message.includes('synthetic-google-private'));
  const controller=new AbortController();controller.abort();await assert.rejects(verifyYouTubePublishingConnection({channel:{externalId:ytId},credentials:ytCredentials,clock:ytClock,signal:controller.signal,fetchImpl:failNetwork}),{code:'YOUTUBE_CONNECTION_STOPPED'});
});
function fakeProvider(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), options });
    const payload = responses[calls.length - 1];
    assert.notEqual(payload, undefined, 'Unexpected provider request');
    return { ok: true, json: async () => payload };
  };
  return { calls, fetchImpl };
}

test('provider readiness requires both client values and never exposes credentials', async () => {
  assert(providers().every(provider => provider.configured === false));
  const states = providers({ youtube: config, instagram: { clientId: 'id-only' }, tiktok: { clientSecret: 'secret-only' } });
  assert.equal(states.find(provider => provider.id === 'youtube').configured, true);
  assert.equal(states.find(provider => provider.id === 'instagram').configured, false);
  assert.equal(states.find(provider => provider.id === 'tiktok').configured, false);
  assert(!JSON.stringify(states).includes(config.clientId));
  assert(!JSON.stringify(states).includes(config.clientSecret));
  assert.equal(providers(new Map([['provider:facebook', config]])).find(provider => provider.id === 'facebook').configured, true);
  assert.throws(() => createAuthorization('youtube', { ...flow, clientId: '' }), { code: 'provider_not_configured' });
  await assert.rejects(() => exchangeCode('youtube', { ...flow, clientSecret: '' }, { fetchImpl: failNetwork }), { code: 'provider_not_configured' });
});

test('read-only OAuth scopes and provider parameter families stay separate', () => {
  const expected = {
    youtube: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
    instagram: ['instagram_business_basic', 'instagram_business_manage_insights'],
    facebook: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
    tiktok: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'],
  };
  for (const [platform, scopes] of Object.entries(expected)) {
    const url = new URL(createAuthorization(platform, flow));
    assert.deepEqual(url.searchParams.get('scope').split(platform === 'youtube' ? ' ' : ','), scopes);
    assert.equal(url.searchParams.get('state'), flow.state);
    assert.equal(url.searchParams.get('redirect_uri'), flow.redirectUri);
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get(platform === 'tiktok' ? 'client_key' : 'client_id'), flow.clientId);
    assert.equal(url.searchParams.has('client_secret'), false);
    assert.equal(url.searchParams.has('code_challenge'), false);
  }
  const google = new URL(createAuthorization('youtube', flow));
  assert.equal(google.searchParams.get('access_type'), 'offline');
  assert(google.searchParams.get('prompt').includes('consent'));
  const instagram = new URL(createAuthorization('instagram', flow));
  assert.equal(instagram.hostname, 'www.instagram.com');
  assert.equal(instagram.searchParams.get('enable_fb_login'), '0');
});

test('callback URLs reject remote HTTP, credentials, fragments and malformed URLs', () => {
  for (const redirectUri of ['not a URL', 'http://sns.example.test/callback', 'https://user:password@sns.example.test/callback', 'https://sns.example.test/callback#fragment', 'javascript:alert(1)']) {
    assert.throws(() => createAuthorization('youtube', { ...flow, redirectUri }), OAuthError);
  }
  for (const platform of ['youtube', 'facebook']) {
    assert.doesNotThrow(() => createAuthorization(platform, { ...flow, redirectUri: `http://127.0.0.1:4191/api/oauth/${platform}/callback` }));
  }
  for (const platform of ['instagram', 'tiktok']) {
    assert.throws(() => createAuthorization(platform, { ...flow, redirectUri: `http://localhost:4191/api/oauth/${platform}/callback` }), { code: 'https_required' });
  }
  for (const platform of ['unknown', '__proto__', 'constructor']) assert.throws(() => createAuthorization(platform, flow), { code: 'unsupported_provider' });
  assert.throws(() => createAuthorization('youtube', { ...flow, state: 'short' }), { code: 'invalid_state' });
});

test('optional PKCE is encoded, while invalid challenge and API version are rejected', () => {
  const challenge = 'a'.repeat(43);
  for (const platform of ['youtube', 'tiktok']) {
    const url = new URL(createAuthorization(platform, { ...flow, challenge }));
    assert.equal(url.searchParams.get('code_challenge'), challenge);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  }
  assert.throws(() => createAuthorization('tiktok', { ...flow, challenge: '<invalid>' }), { code: 'invalid_pkce' });
  assert.throws(() => createAuthorization('facebook', { ...flow, apiVersion: '../other' }), { code: 'invalid_api_version' });
});

test('Google code exchange uses form encoding, offline token and optional verifier', async () => {
  const mock = fakeProvider([{ access_token: 'google-access', refresh_token: 'google-refresh', expires_in: 3600, scope: 'https://www.googleapis.com/auth/youtube.readonly' }]);
  const result = await exchangeCode('youtube', { ...flow, verifier: 'verifier-value' }, mock);
  const call = mock.calls[0];
  assert.equal(call.url.href, 'https://oauth2.googleapis.com/token');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.redirect, 'error');
  assert.equal(call.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(call.options.body.get('grant_type'), 'authorization_code');
  assert.equal(call.options.body.get('code_verifier'), 'verifier-value');
  assert.equal(result.authType, 'google-oauth');
  assert.equal(result.refreshToken, 'google-refresh');
  assert(Date.parse(result.expiresAt) > Date.now() + 3_500_000);
  assert.equal(result.scope, 'https://www.googleapis.com/auth/youtube.readonly');
});

test('Google refresh keeps old refresh token and granted scope when provider omits them', async () => {
  const current = { accessToken: 'old', refreshToken: 'retained-refresh', scope: 'granted', expiresAt: date(-1000), accountId: 'UC-fixture' };
  const mock = fakeProvider([{ access_token: 'new-google', expires_in: 3600 }]);
  const updated = await refreshCredentials('youtube', current, config, mock);
  assert.equal(mock.calls[0].options.body.get('grant_type'), 'refresh_token');
  assert.equal(mock.calls[0].options.body.get('refresh_token'), current.refreshToken);
  assert.equal(updated.refreshToken, current.refreshToken);
  assert.equal(updated.scope, 'granted');
  assert.equal(updated.accountId, 'UC-fixture');
  assert.equal(current.accessToken, 'old');
  await assert.rejects(() => refreshCredentials('youtube', { ...current, refreshToken: null }, config, { fetchImpl: failNetwork }), { code: 'reconnect_required' });
});

test('healthy tokens do not produce unnecessary token requests', async () => {
  const current = { accessToken: 'healthy', expiresAt: date(30 * DAY), issuedAt: date(-DAY) };
  for (const platform of ['youtube', 'instagram', 'facebook', 'tiktok']) {
    assert.deepEqual(await refreshCredentials(platform, current, {}, { fetchImpl: failNetwork }), current);
  }
});

test('Instagram exchanges short token with multipart then uses the long-lived token', async () => {
  const mock = fakeProvider([{ data: [{ access_token: 'short-instagram', user_id: '12345678901234567', permissions: ['instagram_business_basic'] }] }, { access_token: 'long-instagram', expires_in: 5_184_000 }]);
  const result = await exchangeCode('instagram', flow, mock);
  assert(mock.calls[0].options.body instanceof FormData);
  assert.equal(mock.calls[0].url.href, 'https://api.instagram.com/oauth/access_token');
  assert.equal(mock.calls[1].url.origin, 'https://graph.instagram.com');
  assert.equal(mock.calls[1].url.searchParams.get('grant_type'), 'ig_exchange_token');
  assert.equal(mock.calls[1].url.searchParams.get('access_token'), 'short-instagram');
  assert.equal(result.accessToken, 'long-instagram');
  assert.equal(result.refreshToken, null);
  assert.equal(result.accountId, '12345678901234567');
  assert.equal(result.authType, 'instagram-login');
  assert.equal(result.graphHost, 'graph.instagram.com');
});

test('Instagram refresh works without refreshToken and respects age/expiry', async () => {
  const current = { accessToken: 'old-instagram', issuedAt: date(-2 * DAY), expiresAt: date(2 * DAY), authType: 'instagram-login' };
  const mock = fakeProvider([{ access_token: 'refreshed-instagram', expires_in: 5_184_000 }]);
  const updated = await refreshCredentials('instagram', current, {}, mock);
  assert.equal(mock.calls[0].url.pathname, '/refresh_access_token');
  assert.equal(mock.calls[0].url.searchParams.get('grant_type'), 'ig_refresh_token');
  assert.equal(mock.calls[0].url.searchParams.get('access_token'), current.accessToken);
  assert.equal(updated.accessToken, 'refreshed-instagram');
  assert.equal(updated.refreshToken, null);
  const fresh = { ...current, issuedAt: date(-60_000) };
  assert.deepEqual(await refreshCredentials('instagram', fresh, { force: true }, { fetchImpl: failNetwork }), fresh);
  await assert.rejects(() => refreshCredentials('instagram', { ...current, expiresAt: date(-1000) }, {}, { fetchImpl: failNetwork }), { code: 'reconnect_required' });
});

test('Facebook returns a user token, exchanges long-lived token, and requires reconnect on expiry', async () => {
  const mock = fakeProvider([{ access_token: 'short-facebook', expires_in: 3600 }, { access_token: 'long-facebook', expires_in: 5_184_000 }]);
  const result = await exchangeCode('facebook', flow, mock);
  assert.equal(mock.calls[1].url.searchParams.get('grant_type'), 'fb_exchange_token');
  assert.equal(mock.calls[1].url.searchParams.get('fb_exchange_token'), 'short-facebook');
  assert.equal(result.authType, 'facebook-user');
  assert.equal(result.refreshToken, null);
  await assert.rejects(() => refreshCredentials('facebook', { ...result, expiresAt: date(-1000) }, config, { fetchImpl: failNetwork }), { code: 'reconnect_required' });
});

test('TikTok exchanges client_key and saves rotating refresh token and expiry', async () => {
  const mock = fakeProvider([
    { access_token: 'tiktok-access', refresh_token: 'old-refresh', expires_in: 86400, refresh_expires_in: 31_536_000, open_id: 'tiktok-user', scope: 'user.info.basic,video.list' },
    { access_token: 'new-tiktok-access', refresh_token: 'rotated-refresh', expires_in: 86400, refresh_expires_in: 30_000_000, open_id: 'tiktok-user' },
  ]);
  const result = await exchangeCode('tiktok', flow, mock);
  assert.equal(mock.calls[0].options.body.get('client_key'), config.clientId);
  assert.equal(mock.calls[0].options.body.has('client_id'), false);
  assert.equal(result.accountId, 'tiktok-user');
  const updated = await refreshCredentials('tiktok', { ...result, expiresAt: date(-1000) }, config, mock);
  assert.equal(mock.calls[1].options.body.get('refresh_token'), 'old-refresh');
  assert.equal(updated.refreshToken, 'rotated-refresh');
  assert(Date.parse(updated.refreshExpiresAt) > Date.now() + 29_999_000_000);
  await assert.rejects(() => refreshCredentials('tiktok', { ...updated, expiresAt: date(-1000), refreshExpiresAt: date(-1000) }, config, { fetchImpl: failNetwork }), { code: 'reconnect_required' });
});

test('provider HTTP errors, invalid JSON and fetch failures never expose secrets or URLs', async () => {
  const secretText = `${config.clientSecret} access_token=fixture-token https://example.invalid/?code=fixture-code`;
  const failures = [
    async () => { throw new Error(secretText); },
    async () => ({ ok: false, json: async () => ({ error: 'invalid_grant', error_description: secretText }) }),
    async () => ({ ok: true, json: async () => { throw new Error(secretText); } }),
    async () => ({ ok: true, json: async () => ({ message: secretText }) }),
  ];
  for (const fetchImpl of failures) {
    await assert.rejects(() => exchangeCode('youtube', flow, { fetchImpl }), error => {
      assert(error instanceof OAuthError);
      assert.equal(error.cause, undefined);
      assert(!error.stack.includes(config.clientSecret));
      assert(!error.message.includes('fixture-token'));
      assert(!error.message.includes('example.invalid'));
      return true;
    });
  }
});

test('HTTP 429 is retryable rate limiting before any provider response body is read', async () => {
  let jsonCalls = 0;
  await assert.rejects(() => exchangeCode('youtube', flow, { fetchImpl: async () => ({
    ok: false, status: 429,
    json: async () => { jsonCalls++; throw new Error('HTML fixture-secret'); },
  }) }), error => {
    assert.equal(error.code, 'rate_limited');
    assert.equal(error.retryable, true);
    assert.equal(error.status, 429);
    assert(!error.message.includes('fixture-secret'));
    return true;
  });
  assert.equal(jsonCalls, 0);
});

test('HTTP 5xx token refresh outages remain retryable even when the response would be HTML', async () => {
  for (const status of [500, 502, 503, 504, 599]) {
    let jsonCalls = 0;
    await assert.rejects(() => refreshCredentials('youtube', { accessToken: 'old-fixture', refreshToken: 'refresh-fixture', expiresAt: date(-1000) }, config, { fetchImpl: async () => ({
      ok: false, status,
      json: async () => { jsonCalls++; throw new Error('<html>fixture-secret</html>'); },
    }) }), error => {
      assert.equal(error.code, 'oauth_unavailable');
      assert.equal(error.retryable, true);
      assert.equal(error.status, status);
      assert.equal(error.cause, undefined);
      assert(!error.stack.includes('fixture-secret'));
      return true;
    });
    assert.equal(jsonCalls, 0);
  }
});

test('explicit temporary provider payload errors do not incorrectly require account reconnection', async () => {
  for (const status of [200, 400]) {
    for (const errorPayload of ['temporarily_unavailable', 'server_error', { code: 'temporarily_unavailable', message: 'fixture-secret' }]) {
      await assert.rejects(() => exchangeCode('youtube', flow, { fetchImpl: async () => ({ ok: status === 200, status, json: async () => ({ error: errorPayload, error_description: 'fixture-secret' }) }) }), error => {
        assert.equal(error.code, 'oauth_unavailable');
        assert.equal(error.retryable, true);
        assert(!error.message.includes('fixture-secret'));
        return true;
      });
    }
  }
});

test('explicit provider rate-limit payloads use the same cooldown code as HTTP 429', async () => {
  for (const errorPayload of ['rate_limit_exceeded', 'too_many_requests', { code: 'rate_limited' }]) {
    await assert.rejects(() => exchangeCode('tiktok', flow, { fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: errorPayload }) }) }), error => {
      assert.equal(error.code, 'rate_limited');
      assert.equal(error.retryable, true);
      return true;
    });
  }
});

test('invalid grant, invalid client and permission failures keep the nonretrying auth result', async () => {
  for (const [status, providerError] of [[400, 'invalid_grant'], [401, 'invalid_client'], [403, 'access_denied'], [400, { code: 190, message: 'fixture-secret' }]]) {
    await assert.rejects(() => refreshCredentials('youtube', { accessToken: 'old-fixture', refreshToken: 'revoked-fixture', expiresAt: date(-1000) }, config, { fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: providerError, error_description: 'fixture-secret' }) }) }), error => {
      assert.equal(error.code, 'token_exchange_failed');
      assert.notEqual(error.retryable, true);
      assert(!error.message.includes('fixture-secret'));
      return true;
    });
  }
});
