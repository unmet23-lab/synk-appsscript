'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { YouTube } = require('../tools/classroom-media/worker');

const CHANNEL = `UC${'x'.repeat(22)}`;
const API = 'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id';
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable';

function fixture({ api = async () => Response.json({ id: 'video000001' }), channel = CHANNEL, token } = {}) {
  const calls = [], authCalls = [], channelCalls = [];
  const youtube = new YouTube({ expectedChannelId: CHANNEL }, {
    credential: { clientId: 'test-client', clientSecret: 'test-secret', refreshToken: 'test-refresh' },
    fetchImpl: async (url, options = {}) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        authCalls.push({ url, options });
        return token ? token(authCalls.length) : Response.json({ access_token: `fresh-${authCalls.length}` });
      }
      if (new URL(url).pathname === '/youtube/v3/channels') {
        channelCalls.push({ url, options });
        return Response.json({ items: [{ id: typeof channel === 'function' ? channel(channelCalls.length) : channel }] });
      }
      calls.push({ url, options });
      return api(url, options, calls.length);
    },
  });
  youtube.token = 'cached'; youtube.tokenAt = Date.now();
  return { youtube, calls, authCalls, channelCalls };
}

test('401 refreshes once, verifies the channel, and replays a read with new authorization', async () => {
  const fx = fixture({ api: async (_url, _options, attempt) => attempt === 1 ? new Response(null, { status: 401 }) : Response.json({ items: [] }) });
  assert.deepEqual(await fx.youtube.request('liveStreams', { query: { part: 'id', id: 'stream001' } }), { items: [] });
  assert.equal(fx.calls.length, 2);
  assert.equal(fx.authCalls.length, 1);
  assert.equal(fx.channelCalls.length, 1);
  assert.equal(new Headers(fx.channelCalls[0].options.headers).get('authorization'), 'Bearer fresh-1');
  assert.deepEqual(fx.calls.map(call => call.options.headers.get('authorization')), ['Bearer cached', 'Bearer fresh-1']);
  assert.equal(fx.calls[0].url, fx.calls[1].url);
});

for (const resource of ['liveBroadcasts', 'playlistItems']) {
  test(`${resource} POST retries only after an explicit 401 with the same JSON body`, async () => {
    const fx = fixture({ api: async (_url, _options, attempt) => attempt === 1 ? new Response(null, { status: 401 }) : Response.json({ id: 'created-once' }) });
    const body = { snippet: { title: '수업 시험', playlistId: 'playlist000001' } };
    assert.deepEqual(await fx.youtube.request(resource, { method: 'POST', query: { part: 'snippet' }, body }), { id: 'created-once' });
    assert.equal(fx.calls.length, 2);
    for (const call of fx.calls) {
      assert.equal(call.options.method, 'POST');
      assert.equal(call.options.body, JSON.stringify(body));
      assert.equal(call.options.headers.get('content-type'), 'application/json');
    }
  });
}

test('resumable initiation retries explicit 401 and preserves upload metadata', async () => {
  const location = 'https://www.googleapis.com/upload/session001';
  const fx = fixture({ api: async (_url, _options, attempt) => new Response(null, attempt === 1 ? { status: 401 } : { status: 200, headers: { location } }) });
  const body = JSON.stringify({ status: { privacyStatus: 'unlisted' } });
  const response = await fx.youtube.raw(UPLOAD, { method: 'POST', body, headers: { 'x-upload-content-length': '8', 'content-type': 'application/json' } });
  assert.equal(response.headers.get('location'), location);
  assert.equal(fx.calls.length, 2);
  assert.ok(fx.calls.every(call => call.options.body === body && call.options.headers.get('x-upload-content-length') === '8'));
});

test('resumable chunk 401 recovery preserves exact Buffer bytes and range headers', async () => {
  const fx = fixture({ api: async (_url, _options, attempt) => new Response(null, { status: attempt === 1 ? 401 : 308 }) });
  const body = Buffer.from([0, 255, 128, 1]);
  const response = await fx.youtube.raw(`${UPLOAD}&upload_id=test`, { method: 'PUT', body, headers: new Headers({ 'content-range': 'bytes 0-3/4', 'content-length': '4' }) });
  assert.equal(response.status, 308);
  assert.equal(fx.calls.length, 2);
  for (const call of fx.calls) {
    assert.equal(call.options.body, body);
    assert.equal(call.options.headers.get('content-range'), 'bytes 0-3/4');
    assert.equal(call.options.headers.get('content-length'), '4');
    assert.equal(call.options.method, 'PUT');
  }
});

test('resumable status probe with no body can recover once from 401', async () => {
  const fx = fixture({ api: async (_url, _options, attempt) => new Response(null, { status: attempt === 1 ? 401 : 308 }) });
  assert.equal((await fx.youtube.raw(UPLOAD, { method: 'PUT', headers: { 'content-range': 'bytes */4', 'content-length': '0' } })).status, 308);
  assert.equal(fx.calls.length, 2);
  assert.ok(fx.calls.every(call => call.options.body === undefined && call.options.headers.get('content-range') === 'bytes */4'));
});

test('a second 401 stops and invalidates the token so the next call does not reuse it', async () => {
  const fx = fixture({ api: async (_url, _options, attempt) => attempt <= 2 ? new Response(null, { status: 401 }) : Response.json({ items: [] }) });
  await assert.rejects(fx.youtube.request('videos'), error => error.code === 'YOUTUBE_HTTP_401' && error.status === 401);
  assert.equal(fx.calls.length, 2);
  assert.equal(fx.authCalls.length, 1);
  assert.equal(fx.youtube.token, null);
  assert.deepEqual(await fx.youtube.request('videos'), { items: [] });
  assert.equal(fx.authCalls.length, 2);
  assert.equal(fx.channelCalls.length, 2);
  assert.equal(fx.calls[2].options.headers.get('authorization'), 'Bearer fresh-2');
});

test('channel mismatch prevents POST replay and keeps the known 401 rejection', async () => {
  const fx = fixture({ channel: `UC${'y'.repeat(22)}`, api: async () => new Response(null, { status: 401 }) });
  await assert.rejects(fx.youtube.request('liveBroadcasts', { method: 'POST', body: {} }), error => error.code === 'CHANNEL_MISMATCH' && error.status === 401);
  assert.equal(fx.calls.length, 1);
  assert.equal(fx.youtube.token, null);
  assert.equal(fx.youtube.identityPromise, null);
});

test('failed refresh returns a sanitized known rejection and discards the old token', async () => {
  const fx = fixture({ token: async () => Response.json({ error: { message: 'private provider details' } }, { status: 400 }), api: async () => new Response(null, { status: 401 }) });
  await assert.rejects(fx.youtube.request('playlistItems', { method: 'POST', body: {} }), error => error.code === 'YOUTUBE_AUTH_REFRESH_FAILED' && error.status === 401 && !error.message.includes('private'));
  assert.equal(fx.calls.length, 1);
  assert.equal(fx.authCalls.length, 1);
  assert.equal(fx.channelCalls.length, 0);
  assert.equal(fx.youtube.token, null);
});

for (const method of ['POST', 'PUT']) {
  test(`${method} network failure is never replayed or treated as an authentication rejection`, async () => {
    const fx = fixture({ api: async () => { throw new Error('connection lost after write'); } });
    await assert.rejects(fx.youtube.raw(UPLOAD, { method, body: 'recording bytes' }), error => error.code === 'YOUTUBE_NETWORK_ERROR' && error.status === 0);
    assert.equal(fx.calls.length, 1);
    assert.equal(fx.authCalls.length, 0);
  });
}

for (const status of [403, 429, 500, 503]) {
  test(`HTTP ${status} is returned without refreshing or replaying an unsafe POST`, async () => {
    const fx = fixture({ api: async () => new Response(null, { status }) });
    await assert.rejects(fx.youtube.request('liveBroadcasts', { method: 'POST', body: {} }), error => error.status === status);
    assert.equal(fx.calls.length, 1);
    assert.equal(fx.authCalls.length, 0);
  });
}

test('a lost response on the authenticated POST retry remains ambiguous and is not sent a third time', async () => {
  const fx = fixture({ api: async (_url, _options, attempt) => {
    if (attempt === 1) return new Response(null, { status: 401 });
    throw new Error('response lost after create');
  } });
  await assert.rejects(fx.youtube.request('liveBroadcasts', { method: 'POST', body: {} }), error => error.code === 'YOUTUBE_NETWORK_ERROR' && error.status === 0);
  assert.equal(fx.calls.length, 2);
  assert.equal(fx.authCalls.length, 1);
});

test('concurrent 401 responses share one refresh and channel verification', async () => {
  let releaseOld;
  const bothOld = new Promise(resolve => { releaseOld = resolve; });
  let oldCalls = 0;
  const fx = fixture({ api: async (_url, options) => {
    if (options.headers.get('authorization') === 'Bearer cached') {
      if (++oldCalls === 2) releaseOld();
      await bothOld;
      return new Response(null, { status: 401 });
    }
    return Response.json({ items: [] });
  } });
  await Promise.all([fx.youtube.request('videos'), fx.youtube.request('liveStreams')]);
  assert.equal(fx.calls.length, 4);
  assert.equal(fx.authCalls.length, 1);
  assert.equal(fx.channelCalls.length, 1);
});

test('concurrent initial authorization also shares one refresh', async () => {
  const fx = fixture(); fx.youtube.token = null;
  await Promise.all([fx.youtube.verifyIdentity(), fx.youtube.verifyIdentity(), fx.youtube.request('videos')]);
  assert.equal(fx.authCalls.length, 1);
  assert.equal(fx.channelCalls.length, 1);
  assert.equal(fx.calls.length, 1);
});

test('expiry refresh rechecks the channel and sends no request on mismatch', async () => {
  const fx = fixture({ channel: `UC${'y'.repeat(22)}` });
  fx.youtube.tokenAt = Date.now() - 41 * 60 * 1000;
  await assert.rejects(fx.youtube.request('videos'), error => error.code === 'CHANNEL_MISMATCH');
  assert.equal(fx.calls.length, 0);
  assert.equal(fx.youtube.token, null);
});

test('caller-supplied authorization cannot override the verified token before or after refresh', async () => {
  for (const headers of [{ Authorization: 'Bearer wrong' }, new Headers({ authorization: 'Bearer wrong' }), [['AUTHORIZATION', 'Bearer wrong']]]) {
    const fx = fixture({ api: async (_url, _options, attempt) => new Response(null, { status: attempt === 1 ? 401 : 200 }) });
    await fx.youtube.raw(API, { headers });
    assert.deepEqual(fx.calls.map(call => call.options.headers.get('authorization')), ['Bearer cached', 'Bearer fresh-1']);
  }
});

test('a stream body is never replayed after 401 because it may have been consumed', async () => {
  const fx = fixture({ api: async () => new Response(null, { status: 401 }) });
  const body = Readable.from('recording');
  try {
    assert.equal((await fx.youtube.raw(UPLOAD, { method: 'POST', body, duplex: 'half' })).status, 401);
    assert.equal(fx.calls.length, 1);
    assert.equal(fx.authCalls.length, 1);
  } finally { body.destroy(); }
});

test('unsafe URLs are rejected before sending credentials or attempting refresh', async () => {
  const fx = fixture();
  await assert.rejects(fx.youtube.raw('https://example.test/upload'), error => error.code === 'UNSAFE_GOOGLE_URL');
  assert.equal(fx.calls.length, 0);
  assert.equal(fx.authCalls.length, 0);
});
