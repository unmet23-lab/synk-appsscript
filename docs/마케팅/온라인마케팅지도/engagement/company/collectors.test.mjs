import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_CAPABILITIES, CollectorError, normalizeChannelUrl, collectChannel, collectYoutubeWindows } from './collectors.mjs';

const CHANNEL_ID = 'UCabcdefghijklmnopqrstuv';
const OTHER_CHANNEL = 'UCzyxwvutsrqponmlkjihgfe';
const VIDEO_A = 'abcdefghijk';
const VIDEO_B = 'lmnopqrstuv';
const ok = value => ({ ok: true, status: 200, json: async () => value });
const fail = (status, value) => ({ ok: false, status, json: async () => value });
const youTubeChannel = (extra = {}) => ({ id: CHANNEL_ID, snippet: { title: 'SYNK 테스트' }, statistics: { subscriberCount: '0', viewCount: '300', videoCount: '2' }, contentDetails: { relatedPlaylists: { uploads: 'UPLOADS' } }, ...extra });
const video = (id, stats = {}) => ({ id, snippet: { channelId: CHANNEL_ID, title: id, publishedAt: '2026-09-01T10:00:00Z', thumbnails: { medium: { url: 'https://i.ytimg.com/test.jpg' } } }, statistics: { viewCount: '100', likeCount: '0', ...stats } });

test('normalizes known channel URLs and strips tracking data', () => {
  assert.deepEqual(normalizeChannelUrl('http://m.youtube.com/@Synk/shorts?feature=shared#x'), { platform: 'youtube', canonicalUrl: 'https://www.youtube.com/@Synk', externalId: null, handle: 'Synk', label: 'Synk' });
  assert.equal(normalizeChannelUrl(`https://www.youtube.com/channel/${CHANNEL_ID}/videos`).externalId, CHANNEL_ID);
  assert.equal(normalizeChannelUrl('instagram.com/Synk.MN/?igsh=abc').canonicalUrl, 'https://www.instagram.com/synk.mn/');
  assert.equal(normalizeChannelUrl('https://m.facebook.com/profile.php?id=12345&x=y').externalId, '12345');
  assert.equal(normalizeChannelUrl('https://www.facebook.com/pages/Example/12345').canonicalUrl, 'https://www.facebook.com/profile.php?id=12345');
  assert.equal(normalizeChannelUrl('https://www.tiktok.com/@Synk.MN').handle, 'synk.mn');
  assert.equal(normalizeChannelUrl('https://www.youtube.com/@싱크').handle, '싱크');
  assert.equal(normalizeChannelUrl('https://twitter.com/SYNK').platform, 'x');
  assert.equal(normalizeChannelUrl('https://vk.ru/synk').canonicalUrl, 'https://vk.com/synk');
});

test('rejects arbitrary hosts, credentials, local hosts, ports, media URLs and unsafe paths', () => {
  for (const value of ['https://127.0.0.1/channel', 'http://localhost:9000', 'https://instagram.com.evil.test/synk', 'https://instagram.com@evil.test/synk', 'https://user:pass@instagram.com/synk', 'file:///etc/passwd', 'https://instagram.com:8443/synk', 'https://www.instagram.com/p/abc', 'https://www.tiktok.com/@synk/video/123', 'https://youtube.com/watch?v=abcdefghijk', 'https://youtube.com/@a%2Fb', 'https://youtu.be/abcdefghijk', 'https://www.instagram.com/accounts', 'https://instagram.com/synk\\foo', 'https://example.org/']) {
    assert.throws(() => normalizeChannelUrl(value), error => error.code === 'INVALID_CHANNEL_URL', value);
  }
});

test('manual-only and missing credentials fail before any network call', async () => {
  let requests = 0;
  const fetchImpl = async () => { requests++; throw new Error('unexpected'); };
  await assert.rejects(collectChannel('https://vk.com/synk', {}, { fetchImpl }), error => error.code === 'MANUAL_ONLY');
  await assert.rejects(collectChannel('https://youtube.com/@synk', {}, { fetchImpl }), error => error.code === 'CONNECTION_REQUIRED');
  await assert.rejects(collectChannel({ platform: 'youtube', url: 'https://www.instagram.com/synk' }, {}, { fetchImpl }), error => error.code === 'ACCOUNT_MISMATCH');
  assert.equal(requests, 0);
  assert.equal(PLATFORM_CAPABILITIES.find(platform => platform.id === 'vk').mode, 'manual');
});

test('YouTube follows upload pagination, resolves handles, and distinguishes zero from unavailable metrics', async () => {
  const calls = [];
  const fetchImpl = async (raw, options) => {
    const url = new URL(raw); calls.push(url);
    assert.equal(url.origin, 'https://www.googleapis.com');
    assert.equal(options.redirect, 'error');
    if (url.pathname.endsWith('/channels')) { assert.equal(url.searchParams.get('forHandle'), 'synk'); return ok({ items: [youTubeChannel()] }); }
    if (url.pathname.endsWith('/playlistItems')) return ok(url.searchParams.has('pageToken') ? { items: [{ contentDetails: { videoId: VIDEO_B } }] } : { items: [{ contentDetails: { videoId: VIDEO_A } }], nextPageToken: 'next-page' });
    if (url.pathname.endsWith('/videos')) return ok({ items: [video(VIDEO_A), video(VIDEO_B, { commentCount: '0' })] });
    throw new Error('unexpected');
  };
  const result = await collectChannel('https://youtube.com/@synk', { apiKey: 'TEST_ONLY_KEY' }, { fetchImpl });
  assert.equal(result.channel.followers, 0);
  assert.equal(result.channel.views, 300);
  assert.equal(result.posts.length, 2);
  assert.deepEqual(result.posts[0].metrics, { views: 100, likes: 0, comments: null, shares: null, saves: null, reach: null });
  assert.equal(result.posts[1].metrics.comments, 0);
  assert.equal(result.coverage.status, 'complete');
  assert.equal(result.coverage.pagesFetched, 2);
  assert.equal(result.coverage.ownerAuthorized, false);
  assert.equal(result.coverage.period, 'lifetime');
  assert.equal(calls.length, 4);
  assert.ok(!JSON.stringify(result).includes('TEST_ONLY_KEY'));
});

test('YouTube video details are batched at 50 without silently dropping the remainder', async () => {
  const ids = Array.from({ length: 51 }, (_, i) => `v${String(i).padStart(10, '0')}`);
  const detailBatches = [];
  const fetchImpl = async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith('/channels')) return ok({ items: [youTubeChannel()] });
    if (url.pathname.endsWith('/playlistItems')) return ok(url.searchParams.has('pageToken') ? { items: [{ contentDetails: { videoId: ids[50] } }] } : { items: ids.slice(0, 50).map(videoId => ({ contentDetails: { videoId } })), nextPageToken: '2' });
    const batch = url.searchParams.get('id').split(','); detailBatches.push(batch);
    return ok({ items: batch.map(id => video(id)) });
  };
  const result = await collectChannel(`https://youtube.com/channel/${CHANNEL_ID}`, { apiKey: 'fixture' }, { fetchImpl });
  assert.equal(result.posts.length, 51);
  assert.deepEqual(detailBatches.map(batch => batch.length), [50, 1]);
});

test('YouTube configured cap and inaccessible videos are explicit partial coverage', async () => {
  let playlistCalls = 0;
  const fetchImpl = async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith('/channels')) return ok({ items: [youTubeChannel({ statistics: { hiddenSubscriberCount: true, subscriberCount: '999', viewCount: '0' } })] });
    if (url.pathname.endsWith('/playlistItems')) { playlistCalls++; return ok({ items: [{ contentDetails: { videoId: VIDEO_A } }, { contentDetails: { videoId: VIDEO_B } }], nextPageToken: 'more' }); }
    return ok({ items: [] });
  };
  const result = await collectChannel('https://youtube.com/@synk', { apiKey: 'fixture', maxPosts: 1 }, { fetchImpl });
  assert.equal(result.coverage.status, 'partial');
  assert.equal(result.coverage.hasMore, true);
  assert.equal(result.coverage.omittedPosts, 1);
  assert.equal(result.channel.followers, null);
  assert.equal(result.channel.views, 0);
  assert.equal(playlistCalls, 1);
  assert.ok(result.warnings.some(warning => warning.includes('한 번에 모으는 한도')));
});

test('YouTube refuses mismatched owner OAuth before collecting any uploads', async () => {
  let calls = 0;
  await assert.rejects(collectChannel('https://youtube.com/@synk', { accessToken: 'FIXTURE_TOKEN' }, { fetchImpl: async raw => {
    calls++;
    const url = new URL(raw);
    return ok({ items: url.searchParams.has('mine') ? [{ id: OTHER_CHANNEL }] : [youTubeChannel()] });
  } }), error => error.code === 'ACCOUNT_MISMATCH');
  assert.equal(calls, 2);
});

test('YouTube owner OAuth adds Analytics shares and marks the delayed report period', async () => {
  const fetchImpl = async (raw, options) => {
    const url = new URL(raw);
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    if (url.origin === 'https://youtubeanalytics.googleapis.com') {
      assert.equal(url.searchParams.get('filters'), `video==${VIDEO_A},${VIDEO_B}`);
      return ok({ columnHeaders: [{ name: 'video' }, { name: 'shares' }], rows: [[VIDEO_A, 0], [VIDEO_B, 12]] });
    }
    if (url.pathname.endsWith('/channels')) return ok({ items: url.searchParams.has('mine') ? [{ id: CHANNEL_ID }] : [youTubeChannel()] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: [{ contentDetails: { videoId: VIDEO_A } }, { contentDetails: { videoId: VIDEO_B } }] });
    return ok({ items: [video(VIDEO_A), video(VIDEO_B)] });
  };
  const result = await collectChannel('https://youtube.com/@synk', { accessToken: 'fixture-token', accountId: CHANNEL_ID }, { fetchImpl });
  assert.equal(result.coverage.ownerAuthorized, true);
  assert.equal(result.posts[0].metrics.shares, 0);
  assert.equal(result.posts[1].metrics.shares, 12);
  assert.equal(result.coverage.metricPeriods.shares.lagged, true);
  assert.ok(!result.coverage.unavailableMetrics.includes('shares'));
});

test('missing YouTube Analytics scope retains base metrics with visible partial coverage', async () => {
  const fetchImpl = async raw => {
    const url = new URL(raw);
    if (url.origin === 'https://youtubeanalytics.googleapis.com') return fail(403, { error: { code: 403, message: 'SECRET_TOKEN' } });
    if (url.pathname.endsWith('/channels')) return ok({ items: url.searchParams.has('mine') ? [{ id: CHANNEL_ID }] : [youTubeChannel()] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: [{ contentDetails: { videoId: VIDEO_A } }] });
    return ok({ items: [video(VIDEO_A)] });
  };
  const result = await collectChannel('https://youtube.com/@synk', { accessToken: 'fixture-token' }, { fetchImpl });
  assert.equal(result.posts[0].metrics.views, 100);
  assert.equal(result.posts[0].metrics.shares, null);
  assert.equal(result.coverage.status, 'partial');
  assert.ok(!JSON.stringify(result).includes('SECRET_TOKEN'));
});

test('YouTube readonly owner scope fetches Analytics shares with the report period', async () => {
  const calls = [];
  const fetchImpl = async (raw, options) => {
    const url = new URL(raw); calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    if (url.origin === 'https://youtubeanalytics.googleapis.com') {
      assert.ok(calls.some(call => call.searchParams.get('mine') === 'true'));
      assert.equal(url.searchParams.get('ids'), `channel==${CHANNEL_ID}`);
      assert.equal(url.searchParams.get('metrics'), 'shares');
      assert.equal(url.searchParams.get('filters'), `video==${VIDEO_A}`);
      return ok({ columnHeaders: [{ name: 'shares' }], rows: [[7]] });
    }
    if (url.pathname.endsWith('/channels')) return ok({ items: url.searchParams.has('mine') ? [{ id: CHANNEL_ID }] : [youTubeChannel()] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: [{ contentDetails: { videoId: VIDEO_A } }] });
    return ok({ items: [video(VIDEO_A)] });
  };
  const result = await collectChannel('https://youtube.com/@synk', { accessToken: 'fixture-token', accountId: CHANNEL_ID, scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload' }, { fetchImpl });
  assert.equal(calls.filter(url => url.origin === 'https://youtubeanalytics.googleapis.com').length, 1);
  assert.equal(result.coverage.ownerAuthorized, true);
  assert.equal(result.posts[0].metrics.shares, 7);
  assert.deepEqual(result.coverage.metricPeriods.shares, { source: 'youtube-analytics-api-v2', startDate: '2005-01-01', requestedEndDate: calls.at(-1).searchParams.get('endDate'), lagged: true });
  assert.ok(!result.coverage.unavailableMetrics.includes('shares'));
});

test('YouTube public readers still skip owner Analytics despite an accepted token scope', async () => {
  const calls = [];
  const fetchImpl = async raw => {
    const url = new URL(raw); calls.push(url);
    assert.equal(url.origin, 'https://www.googleapis.com');
    assert.equal(url.searchParams.has('mine'), false);
    if (url.pathname.endsWith('/channels')) return ok({ items: [youTubeChannel()] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: [{ contentDetails: { videoId: VIDEO_A } }] });
    return ok({ items: [{ ...video(VIDEO_A), status: { privacyStatus: 'public' } }] });
  };
  const result = await collectChannel('https://youtube.com/@synk', { accessToken: 'fixture-token', scope: 'https://www.googleapis.com/auth/youtube.readonly', publicOnly: true }, { fetchImpl });
  assert.equal(calls.length, 3);
  assert.equal(result.posts.length, 1);
  assert.equal(result.coverage.ownerAuthorized, false);
  assert.equal(result.posts[0].metrics.shares, null);
  assert.deepEqual(result.coverage.metricPeriods, {});
  assert.ok(result.coverage.unavailableMetrics.includes('shares'));
});

test('YouTube upload-only owner scope does not claim Analytics report access', async () => {
  const calls = [];
  const fetchImpl = async raw => {
    const url = new URL(raw); calls.push(url);
    assert.equal(url.origin, 'https://www.googleapis.com');
    if (url.pathname.endsWith('/channels')) return ok({ items: url.searchParams.has('mine') ? [{ id: CHANNEL_ID }] : [youTubeChannel()] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: [{ contentDetails: { videoId: VIDEO_A } }] });
    return ok({ items: [video(VIDEO_A)] });
  };
  const result = await collectChannel('https://youtube.com/@synk', { accessToken: 'fixture-token', scope: 'https://www.googleapis.com/auth/youtube.upload' }, { fetchImpl });
  assert.equal(calls.length, 4);
  assert.equal(result.coverage.ownerAuthorized, true);
  assert.equal(result.posts[0].metrics.shares, null);
  assert.deepEqual(result.coverage.metricPeriods, {});
  assert.ok(result.coverage.unavailableMetrics.includes('shares'));
});

test('a single YouTube video uses the basic filtered Analytics report without top-video dimensions', async () => {
  const result = await collectChannel('https://youtube.com/@synk', { accessToken: 'fixture' }, { fetchImpl: async raw => {
    const url = new URL(raw);
    if (url.origin === 'https://youtubeanalytics.googleapis.com') {
      assert.equal(url.searchParams.has('dimensions'), false);
      assert.equal(url.searchParams.get('filters'), `video==${VIDEO_A}`);
      return ok({ columnHeaders: [{ name: 'shares' }], rows: [[7]] });
    }
    if (url.pathname.endsWith('/channels')) return ok({ items: url.searchParams.has('mine') ? [{ id: CHANNEL_ID }] : [youTubeChannel()] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: [{ contentDetails: { videoId: VIDEO_A } }] });
    return ok({ items: [video(VIDEO_A)] });
  } });
  assert.equal(result.posts[0].metrics.shares, 7);
  assert.equal(result.coverage.status, 'complete');
});

test('API and network errors never expose raw tokens or request URLs and do not retry', async () => {
  let count = 0;
  const collect = fetchImpl => collectChannel('https://youtube.com/@synk', { apiKey: 'TOP_SECRET_TOKEN' }, { fetchImpl });
  await assert.rejects(collect(async () => { count++; return fail(403, { error: { errors: [{ reason: 'quotaExceeded' }], message: 'TOP_SECRET_TOKEN' } }); }), error => error instanceof CollectorError && error.code === 'RATE_LIMITED' && !String(error).includes('TOP_SECRET_TOKEN'));
  await assert.rejects(collect(async () => { count++; throw new Error('https://example.test/?key=TOP_SECRET_TOKEN'); }), error => error.code === 'NETWORK_ERROR' && !JSON.stringify(error).includes('TOP_SECRET_TOKEN') && !String(error).includes('example.test'));
  assert.equal(count, 2);
});

test('pre-cancelled collections make no external request', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(collectChannel('https://youtube.com/@synk', { apiKey: 'fixture' }, { signal: controller.signal, fetchImpl: async () => { calls++; return ok({}); } }), error => error.code === 'CANCELLED');
  assert.equal(calls, 0);
});

test('TikTok validates username and follows numeric cursor pagination', async () => {
  const cursors = [];
  const fetchImpl = async (raw, options) => {
    const url = new URL(raw);
    assert.equal(url.origin, 'https://open.tiktokapis.com');
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    if (url.pathname === '/v2/user/info/') return ok({ data: { user: { open_id: 'fixture-openid', username: 'Synk.MN', display_name: 'SYNK', follower_count: 0, likes_count: 5, video_count: 2 } }, error: { code: 'ok' } });
    const body = JSON.parse(options.body); cursors.push(body.cursor);
    return ok({ data: { videos: [{ id: body.cursor ? '2' : '1', create_time: 1750000000, title: 'Test', view_count: 0, like_count: 0, comment_count: 1, share_count: 2 }], has_more: !body.cursor, cursor: 123 }, error: { code: 'ok' } });
  };
  const result = await collectChannel('https://tiktok.com/@synk.mn', { accessToken: 'fixture-token' }, { fetchImpl });
  assert.deepEqual(cursors, [undefined, 123]);
  assert.equal(result.channel.followers, 0);
  assert.equal(result.channel.views, null);
  assert.equal(result.posts.length, 2);
  assert.equal(result.posts[0].metrics.shares, 2);
  assert.equal(result.posts[0].metrics.saves, null);
  assert.equal(result.coverage.status, 'complete');
});

test('TikTok account mismatch and missing profile scope do not collect another account', async () => {
  for (const user of [{ open_id: 'other', username: 'other' }, { open_id: 'same' }]) {
    let calls = 0;
    await assert.rejects(collectChannel('https://tiktok.com/@synk', { accessToken: 'fixture' }, { fetchImpl: async () => { calls++; return ok({ data: { user } }); } }), error => ['ACCOUNT_MISMATCH', 'AUTH_REQUIRED'].includes(error.code));
    assert.equal(calls, 1);
  }
});

test('TikTok cap and repeated cursor mark partial instead of looping', async () => {
  let calls = 0;
  const result = await collectChannel('https://tiktok.com/@synk', { accessToken: 'fixture', maxPosts: 1 }, { fetchImpl: async raw => {
    calls++;
    if (new URL(raw).pathname.includes('/user/')) return ok({ data: { user: { open_id: 'fixture', username: 'synk' } } });
    return ok({ data: { videos: [{ id: '1', create_time: 0 }], cursor: 1, has_more: true } });
  } });
  assert.equal(calls, 2);
  assert.equal(result.coverage.hasMore, true);
  assert.equal(result.coverage.status, 'partial');
});

test('Instagram direct login uses fixed graph host, binds identity, and retains missing insight values', async () => {
  const hosts = [];
  const fetchImpl = async raw => {
    const url = new URL(raw); hosts.push(url.origin);
    if (url.pathname.endsWith('/me')) return ok({ id: '1234', username: 'Synk', name: 'SYNK', followers_count: 0, media_count: 1 });
    if (url.pathname.endsWith('/media')) return ok({ data: [{ id: '9999', caption: 'First', timestamp: '2026-09-20T00:00:00Z', like_count: 0, comments_count: 1, permalink: 'https://www.instagram.com/p/test/' }] });
    return ok({ data: [{ name: 'views', values: [{ value: 0 }] }, { name: 'shares', total_value: { value: 3 } }, { name: 'saved', values: [{ value: 0 }] }] });
  };
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', authType: 'instagram-login', graphHost: 'http://127.0.0.1', accountId: '1234' }, { fetchImpl });
  assert.ok(hosts.every(host => host === 'https://graph.instagram.com'));
  assert.equal(result.channel.followers, 0);
  assert.deepEqual(result.posts[0].metrics, { views: 0, likes: 0, comments: 1, shares: 3, saves: 0, reach: null });
  assert.equal(result.coverage.status, 'partial');
  assert.equal(result.coverage.ownerAuthorized, true);
});

test('Instagram direct login distinguishes canonical user_id from the app-scoped id',async()=>{
  const calls=[],result=await collectChannel('https://instagram.com/synk',{accessToken:'synthetic',authType:'instagram-login',accountId:'100',appScopedId:'900',metaIdentityVersion:1},{fetchImpl:async raw=>{const url=new URL(raw);calls.push(url.pathname);return url.pathname.endsWith('/me')?ok({id:'900',user_id:'100',username:'synk'}):ok({data:[]});}});
  assert.equal(result.channel.externalId,'100');assert.ok(calls.includes('/v26.0/100/media'));
});

test('Instagram unsupported combined insights falls back by metric, without guessing zero', async () => {
  const requestedMetrics = [];
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '1234' }, { fetchImpl: async raw => {
    const url = new URL(raw);
    assert.equal(url.origin, 'https://graph.facebook.com');
    if (url.pathname.endsWith('/1234')) return ok({ id: '1234', username: 'synk' });
    if (url.pathname.endsWith('/media')) return ok({ data: [{ id: '9999' }] });
    const name = url.searchParams.get('metric'); requestedMetrics.push(name);
    if (name.includes(',') || name === 'saved') return fail(400, { error: { code: 100 } });
    return ok({ data: [{ name, values: [{ value: 0 }] }] });
  } });
  assert.equal(requestedMetrics.length, 5);
  assert.equal(result.posts[0].metrics.views, 0);
  assert.equal(result.posts[0].metrics.saves, null);
  assert.equal(result.posts[0].publishedAt, null);
});

test('Meta pagination uses only returned cursors and never fetches a returned next URL', async () => {
  const urls = [];
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '1234' }, { fetchImpl: async raw => {
    const url = new URL(raw); urls.push(url);
    if (url.pathname.endsWith('/1234')) return ok({ id: '1234', username: 'synk' });
    if (url.pathname.endsWith('/media')) return ok(url.searchParams.has('after') ? { data: [] } : { data: [], paging: { next: 'http://127.0.0.1/private', cursors: { after: 'http://127.0.0.1/private' } } });
    throw new Error('unexpected');
  } });
  assert.ok(urls.every(url => url.origin === 'https://graph.facebook.com'));
  assert.equal(urls.at(-1).searchParams.get('after'), 'http://127.0.0.1/private');
  assert.equal(result.coverage.pagesFetched, 2);
});

test('Facebook user login selects owned page across pages and keeps page tokens private', async () => {
  const tokens = [];
  const result = await collectChannel('https://facebook.com/synk', { accessToken: 'FIXTURE_USER_TOKEN', authType: 'facebook-user' }, { fetchImpl: async (raw, options) => {
    const url = new URL(raw); tokens.push(options.headers.Authorization);
    if (url.pathname.endsWith('/me/accounts')) return ok(url.searchParams.has('after') ? { data: [{ id: '123', username: 'SYNK', link: 'https://facebook.com/profile.php?id=123', access_token: 'FIXTURE_PAGE_TOKEN' }] } : { data: [{ id: '456', username: 'else', access_token: 'OTHER_PAGE_TOKEN' }], paging: { next: 'https://graph.facebook.com/ignored', cursors: { after: 'next' } } });
    if (url.pathname.endsWith('/me')) return ok({ id: '123', username: 'synk', name: 'SYNK', followers_count: 20, fan_count: 12, link: 'https://facebook.com/profile.php?id=123' });
    if(url.pathname.endsWith('/videos'))return ok({data:[]});
    assert.ok(url.searchParams.get('fields').includes('reactions.type(LIKE)'));
    return ok({ data: [{ id: '123_999', message: 'First', created_time: '2026-09-20T00:00:00Z', reactions: { summary: { total_count: 0 } }, comments: { summary: { total_count: 2 } }, shares: { count: 0 } }] });
  } });
  assert.deepEqual(tokens, ['Bearer FIXTURE_USER_TOKEN', 'Bearer FIXTURE_USER_TOKEN', 'Bearer FIXTURE_PAGE_TOKEN', 'Bearer FIXTURE_PAGE_TOKEN','Bearer FIXTURE_PAGE_TOKEN']);
  assert.deepEqual(result.posts[0].metrics, { views: null, likes: 0, comments: 2, shares: 0, saves: null, reach: null });
  assert.equal(result.channel.followers, 20);
  assert.ok(!JSON.stringify(result).includes('TOKEN'));
});

test('Facebook numeric URL requires the matching page and does not infer absent shares', async () => {
  const result = await collectChannel('https://facebook.com/profile.php?id=123', { accessToken: 'fixture' }, { fetchImpl: async raw => new URL(raw).pathname.endsWith('/me') ? ok({ id: '123', followers_count: 0 }) : ok({ data: [{ id: '123_456' }] }) });
  assert.equal(result.posts[0].metrics.shares, null);
  assert.equal(result.channel.followers, 0);
  await assert.rejects(collectChannel('https://facebook.com/profile.php?id=123', { accessToken: 'fixture' }, { fetchImpl: async () => ok({ id: '456' }) }), error => error.code === 'ACCOUNT_MISMATCH');
});

test('Meta rate limit halts optional insights without request storm or exposing error payloads', async () => {
  let insightCalls = 0;
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '1234' }, { fetchImpl: async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith('/1234')) return ok({ id: '1234', username: 'synk' });
    if (url.pathname.endsWith('/media')) return ok({ data: [{ id: '1' }, { id: '2' }] });
    insightCalls++;
    return fail(400, { error: { code: 4, message: 'FIXTURE_SECRET' } });
  } });
  assert.equal(insightCalls, 1);
  assert.equal(result.posts.length, 2);
  assert.equal(result.coverage.status, 'partial');
  assert.ok(!JSON.stringify(result).includes('FIXTURE_SECRET'));
});

test('Facebook post performance keeps video views; channel and post-only metric lists stay separate', () => {
  const capability = id => PLATFORM_CAPABILITIES.find(platform => platform.id === id);
  assert.ok(capability('facebook').metrics.includes('views'));
  assert.deepEqual(capability('youtube').metrics, ['followers', 'views', 'likes', 'comments', 'shares'], 'the channel screen still lists only channel collection metrics');
  assert.deepEqual(capability('youtube').laggedMetrics, ['shares', 'averageWatchSeconds', 'averageViewPct', 'subscribersGained', 'subscribersLost']);
  assert.deepEqual(capability('instagram').postMetrics, ['earlyRetention3sPct', 'averageWatchSeconds']);
});

const reelFetch = (insights, seen = []) => async raw => {
  const url = new URL(raw);
  if (url.pathname.endsWith('/1234')) return ok({ id: '1234', username: 'synk' });
  if (url.pathname.endsWith('/media')) return ok({ data: [{ id: '501', media_product_type: 'REELS', timestamp: '2026-10-18T07:00:00Z', permalink: 'https://www.instagram.com/reel/AAA111/' }, { id: '502', media_product_type: 'FEED', timestamp: '2026-10-18T08:00:00Z', permalink: 'https://www.instagram.com/p/BBB222/' }, { id: '503', media_product_type: 'REELS', timestamp: '2026-10-18T09:00:00Z', permalink: 'https://www.instagram.com/reel/CCC333/' }] });
  const id = url.pathname.split('/').at(-2), metric = url.searchParams.get('metric'); seen.push([id, metric]);
  return insights(id, metric.split(','));
};

test('Instagram reels add the estimated 3-second retention and millisecond watch time only for reels', async () => {
  const seen = [], value = { views: 900, reach: 700, shares: 3, saved: 4, reels_skip_rate: 38.2, ig_reels_avg_watch_time: 7530 };
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '1234' }, { fetchImpl: reelFetch((id, names) => ok({ data: names.filter(name => !(id === '503' && name === 'reels_skip_rate')).map(name => ({ name, values: [{ value: value[name] }] })) }), seen) });
  assert.deepEqual(seen.map(([id, metric]) => [id, metric.split(',').length]), [['501', 6], ['502', 4], ['503', 6]], 'feed posts never ask for reel-only metrics');
  const [reel, feed, reelWithoutSkip] = result.posts;
  assert.equal(reel.metrics.earlyRetention3sPct, 61.8); assert.equal(reel.metrics.averageWatchSeconds, 7.53);
  assert.deepEqual(reel.metricDetails, { earlyRetention3sPct: { derivedFrom: 'reels_skip_rate', rawValue: 38.2, rawUnit: 'percent', estimated: true }, averageWatchSeconds: { derivedFrom: 'ig_reels_avg_watch_time', rawValue: 7530, rawUnit: 'milliseconds' } });
  assert.deepEqual(feed.metrics, { views: 900, likes: null, comments: null, shares: 3, saves: 4, reach: 700 }); assert.equal(feed.metricDetails, undefined);
  assert.equal(reelWithoutSkip.metrics.earlyRetention3sPct, null, 'an empty insight is unknown, not 100% retention');
  assert.equal(reelWithoutSkip.metrics.averageWatchSeconds, 7.53); assert.deepEqual(Object.keys(reelWithoutSkip.metricDetails), ['averageWatchSeconds']);
});

test('a rejected reel-only metric query keeps the basic insights and stops asking for reel metrics in that collection', async () => {
  const seen = [];
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '1234' }, { recentSince: '2026-10-18T00:00:00Z', now: '2026-10-19T00:00:00Z', fetchImpl: reelFetch((id, names) => names.includes('reels_skip_rate') ? fail(400, { error: { code: 100, message: 'FIXTURE_SECRET metric' } }) : ok({ data: names.map(name => ({ name, values: [{ value: 5 }] })) }), seen) });
  assert.deepEqual(seen.map(([id, metric]) => [id, metric.split(',').length]), [['501', 6], ['501', 4], ['502', 4], ['503', 4]]);
  assert.equal(result.posts[0].metrics.views, 5); assert.equal(result.posts[0].metrics.earlyRetention3sPct, null); assert.equal(result.posts[2].metrics.averageWatchSeconds, null);
  assert.ok(result.warnings.some(warning => warning.includes('릴스 건너뛴 비율')));
  assert.ok(!JSON.stringify(result).includes('FIXTURE_SECRET'));
});

test('an impossible reel skip rate is never turned into retention', async () => {
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '1234' }, { fetchImpl: reelFetch(() => ok({ data: [{ name: 'views', values: [{ value: 1 }] }, { name: 'reels_skip_rate', values: [{ value: 140 }] }] })) });
  assert.equal(result.posts[0].metrics.earlyRetention3sPct, null); assert.equal(result.posts[0].metricDetails, undefined);
});

const windowFetch = (reports, calls = []) => async (raw, options) => {
  const url = new URL(raw); calls.push(url);
  assert.equal(options.headers.Authorization, 'Bearer window-token'); assert.equal(options.redirect, 'error');
  if (url.origin === 'https://youtubeanalytics.googleapis.com') return reports(url);
  if (url.pathname.endsWith('/channels')) return ok({ items: [{ id: CHANNEL_ID }] });
  throw new Error('unexpected ' + url.pathname);
};
const windowVideos = [{ externalId: VIDEO_A, startDate: '2026-10-17', endDate: '2026-10-19' }, { externalId: VIDEO_B, startDate: '2026-10-18', endDate: '2026-10-20' }];
const windowHeaders = ['views', 'averageViewDuration', 'averageViewPercentage', 'shares', 'subscribersGained', 'subscribersLost'].map(name => ({ name, columnType: 'METRIC', dataType: name === 'averageViewPercentage' ? 'FLOAT' : 'INTEGER' }));

test('YouTube window reports read fixed Pacific dates per owned video and keep looping averages above 100%', async () => {
  const calls = [];
  const result = await collectYoutubeWindows(`https://youtube.com/channel/${CHANNEL_ID}`, { accessToken: 'window-token', accountId: CHANNEL_ID, scope: 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly' }, { videos: windowVideos, fetchImpl: windowFetch(url => {
    assert.equal(url.searchParams.get('ids'), `channel==${CHANNEL_ID}`); assert.equal(url.searchParams.has('dimensions'), false);
    assert.equal(url.searchParams.get('metrics'), 'views,averageViewDuration,averageViewPercentage,shares,subscribersGained,subscribersLost');
    return url.searchParams.get('filters') === `video==${VIDEO_A}` ? ok({ kind: 'youtubeAnalytics#resultTable', columnHeaders: windowHeaders, rows: [[629, 24, 112.4, 7, 3, 0]] }) : ok({ kind: 'youtubeAnalytics#resultTable', columnHeaders: windowHeaders, rows: [[40, 11, 35.5, 0, 0, 1]] });
  }, calls) });
  assert.ok(calls.some(url => url.searchParams.get('mine') === 'true'), 'ownership is checked before any report');
  assert.deepEqual(calls.filter(url => url.origin === 'https://youtubeanalytics.googleapis.com').map(url => [url.searchParams.get('startDate'), url.searchParams.get('endDate')]), [['2026-10-17', '2026-10-19'], ['2026-10-18', '2026-10-20']]);
  assert.equal(result.source, 'youtube-analytics-api-v2'); assert.equal(result.timeZone, 'America/Los_Angeles');
  assert.deepEqual(result.videos[0], { externalId: VIDEO_A, startDate: '2026-10-17', endDate: '2026-10-19', status: 'ready', views: 629, metrics: { averageWatchSeconds: 24, averageViewPct: 112.4, shares: 7, subscribersGained: 3, subscribersLost: 0 } });
  assert.equal(result.videos[1].metrics.subscribersLost, 1); assert.ok(!JSON.stringify(result).includes('window-token'));
});

test('an unprocessed or empty window report is empty, never zeros, and one rejected video does not stop the others', async () => {
  let call = 0;
  const result = await collectYoutubeWindows(`https://youtube.com/channel/${CHANNEL_ID}`, { accessToken: 'window-token' }, { videos: [...windowVideos, { externalId: 'cdefghijklm', startDate: '2026-10-18', endDate: '2026-10-20' }], fetchImpl: windowFetch(() => {
    call++;
    if (call === 1) return ok({ kind: 'youtubeAnalytics#resultTable', columnHeaders: windowHeaders });
    if (call === 2) return ok({ kind: 'youtubeAnalytics#resultTable', columnHeaders: windowHeaders, rows: [[0, 0, 0, 0, 0, 0]] });
    return fail(400, { error: { code: 400, errors: [{ reason: 'badRequest' }], message: 'FIXTURE_SECRET' } });
  }) });
  assert.deepEqual(result.videos.map(video => [video.status, video.metrics]), [['empty', undefined], ['empty', undefined], ['error', undefined]]);
  assert.equal(result.videos[1].views, 0); assert.ok(!JSON.stringify(result).includes('FIXTURE_SECRET'));
});

test('window reports need an owner Analytics grant: API keys, public readers and upload-only tokens make no request', async () => {
  for (const credentials of [{ apiKey: 'fixture' }, { accessToken: 'window-token', publicOnly: true }, { accessToken: 'window-token', scope: 'https://www.googleapis.com/auth/youtube.upload' }, { accessToken: 'window-token', scope: 'https://www.googleapis.com/auth/youtube.force-ssl' }]) {
    let calls = 0;
    await assert.rejects(collectYoutubeWindows('https://youtube.com/@synk', credentials, { videos: windowVideos, fetchImpl: async () => { calls++; return ok({}); } }), error => error.code === 'AUTH_REQUIRED' && /YouTube 분석/.test(error.message));
    assert.equal(calls, 0);
  }
  await assert.rejects(collectYoutubeWindows('https://instagram.com/synk', { accessToken: 'window-token' }, { videos: windowVideos, fetchImpl: async () => ok({}) }), error => error.code === 'MANUAL_ONLY');
});

test('the actual insufficient-scope 403 from YouTube Analytics on every video is missing permission and leaks nothing', async () => {
  // 10-20 LAB 채널(youtube.force-ssl 자격)에서 받은 응답 모양 그대로다.
  const denied = { error: { code: 403, message: 'Request had insufficient authentication scopes. FIXTURE_SECRET', errors: [{ message: 'Insufficient Permission', domain: 'global', reason: 'insufficientPermissions' }], status: 'PERMISSION_DENIED' } };
  let reports = 0;
  await assert.rejects(collectYoutubeWindows(`https://youtube.com/channel/${CHANNEL_ID}`, { accessToken: 'window-token' }, { videos: windowVideos, fetchImpl: windowFetch(() => { reports++; return fail(403, denied); }) }), error => error.code === 'AUTH_REQUIRED' && error.status === 403 && !JSON.stringify(error).includes('FIXTURE_SECRET') && !String(error).includes('window-token'));
  assert.equal(reports, 2, 'every video is asked before calling it a missing grant');
});

test('window reports refuse a token that does not own the registered channel and drop malformed requests before fetching', async () => {
  await assert.rejects(collectYoutubeWindows(`https://youtube.com/channel/${CHANNEL_ID}`, { accessToken: 'window-token' }, { videos: windowVideos, fetchImpl: async raw => { const url = new URL(raw); return ok({ items: url.searchParams.has('mine') ? [{ id: OTHER_CHANNEL }] : [{ id: CHANNEL_ID }] }); } }), error => error.code === 'ACCOUNT_MISMATCH');
  let calls = 0;
  const result = await collectYoutubeWindows(`https://youtube.com/channel/${CHANNEL_ID}`, { accessToken: 'window-token' }, { videos: [{ externalId: 'bad id', startDate: '2026-10-17', endDate: '2026-10-19' }, { externalId: VIDEO_A, startDate: '2026-10-19', endDate: '2026-10-17' }, { externalId: VIDEO_B, startDate: '10/17', endDate: '2026-10-19' }], fetchImpl: async () => { calls++; return ok({}); } });
  assert.deepEqual(result.videos, []); assert.equal(calls, 0);
});

test('a 403 for one video after Analytics answered another is that video\'s error, not a missing grant', async () => {
  let call = 0;
  const result = await collectYoutubeWindows(`https://youtube.com/channel/${CHANNEL_ID}`, { accessToken: 'window-token' }, { videos: [...windowVideos, { externalId: 'cdefghijklm', startDate: '2026-10-18', endDate: '2026-10-20' }], fetchImpl: windowFetch(() => {
    call++;
    return call === 2 ? fail(403, { error: { code: 403, errors: [{ reason: 'forbidden' }], message: 'FIXTURE_SECRET' } }) : ok({ kind: 'youtubeAnalytics#resultTable', columnHeaders: windowHeaders, rows: [[50, 10, 40, 1, 0, 0]] });
  }) });
  assert.deepEqual(result.videos.map(video => [video.status, video.errorCode]), [['ready', undefined], ['error', 'AUTH_REQUIRED'], ['ready', undefined]]);
  assert.ok(!JSON.stringify(result).includes('FIXTURE_SECRET'));
});

test('a basic-metric 400 never turns off reel metrics for the rest of the collection', async () => {
  const seen = [];
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '1234' }, { recentSince: '2026-10-18T00:00:00Z', now: '2026-10-19T00:00:00Z', fetchImpl: reelFetch((id, names) => id === '501' ? fail(400, { error: { code: 100 } }) : ok({ data: names.map(name => ({ name, values: [{ value: name === 'reels_skip_rate' ? 20 : 5 }] })) }), seen) });
  assert.deepEqual(seen.map(([id, metric]) => [id, metric.split(',').length]), [['501', 6], ['501', 4], ['502', 4], ['503', 6]]);
  assert.equal(result.posts[0].metrics.views, null); assert.equal(result.posts[2].metrics.earlyRetention3sPct, 80);
  assert.ok(!result.warnings.some(warning => warning.includes('릴스 건너뛴 비율')));
});
