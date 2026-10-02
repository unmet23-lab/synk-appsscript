import test from 'node:test';
import assert from 'node:assert/strict';
import { collectChannel } from './collectors.mjs';

const since = '2026-09-20T00:00:00.000Z', until = '2026-09-27T00:00:00.000Z';
const old = '2026-09-19T23:59:59.000Z', fresh = '2026-09-25T08:00:00.000Z';
const opts = fetchImpl => ({ recentSince: since, now: until, fetchImpl });
const ok = value => ({ ok: true, status: 200, json: async () => value });
const ytId = 'UCabcdefghijklmnopqrstuv', videoId = 'abcdefghijk';
const ytChannel = { id: ytId, snippet: { title: 'SYNK' }, statistics: { videoCount: '1000' }, contentDetails: { relatedPlaylists: { uploads: 'UUfixture' } } };
const igMedia = (id, timestamp = fresh) => ({ id: String(id), timestamp, caption: 'Test', permalink: `https://instagram.com/p/${id}/`, like_count: 0 });
const tikVideo = (id, at) => ({ id: String(id), create_time: Date.parse(at) / 1000, view_count: 0 });

test('recent window rejects invalid dates and limits before fetching', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return ok({}); };
  for (const options of [{ recentSince: 'bad' }, { recentSince: until, now: since }, { recentSince: since, maxPosts: 0 }, { recentSince: since, maxPages: -2 }]) {
    await assert.rejects(collectChannel('https://youtube.com/@synk', { apiKey: 'fixture' }, { ...options, fetchImpl }), error => error.code === 'INVALID_CONFIG');
  }
  assert.equal(calls, 0);
});

test('old YouTube first page stops cheaply and marks unverified ordering as partial', async () => {
  let calls = 0;
  const result = await collectChannel('https://youtube.com/@synk', { apiKey: 'fixture' }, opts(async raw => {
    calls++;
    if (new URL(raw).pathname.endsWith('/channels')) return ok({ items: [ytChannel] });
    assert.ok(new URL(raw).pathname.endsWith('/playlistItems'));
    return ok({ items: [{ contentDetails: { videoId, videoPublishedAt: old } }], nextPageToken: 'older' });
  }));
  assert.equal(calls, 2);
  assert.deepEqual(result.posts, []);
  assert.equal(result.coverage.scope, 'recent');
  assert.equal(result.coverage.hasMore, true);
  assert.equal(result.coverage.status, 'partial');
  assert.equal(result.coverage.recent.uncertainOrder, true);
});

test('YouTube filters by video publication date, including the exact interval boundaries', async () => {
  const ids = ['abcdefghijk', 'bcdefghijkl', 'cdefghijklm', 'defghijklmn'];
  const dates = [since, until, old, '2026-09-27T00:00:01Z'];
  const result = await collectChannel('https://youtube.com/@synk', { apiKey: 'fixture' }, opts(async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith('/channels')) return ok({ items: [ytChannel] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: ids.map(videoId => ({ contentDetails: { videoId } })) });
    return ok({ items: ids.map((id, i) => ({ id, snippet: { channelId: ytId, publishedAt: dates[i] }, statistics: { viewCount: '0' } })) });
  }));
  assert.deepEqual(result.posts.map(post => post.externalId), ids.slice(0, 2));
  assert.equal(result.posts[0].metrics.views, 0);
  assert.equal(result.posts[0].metrics.likes, null);
  assert.equal(result.coverage.period, 'lifetime');
  assert.equal(result.coverage.recent.complete, true);
});

test('TikTok documented descending order permits a complete recent window after an old page', async () => {
  let listCalls = 0;
  const result = await collectChannel('https://tiktok.com/@synk', { accessToken: 'fixture' }, opts(async raw => {
    if (new URL(raw).pathname.includes('/user/')) return ok({ data: { user: { open_id: 'fixture', username: 'synk' } } });
    listCalls++;
    return ok({ data: { videos: [tikVideo('1', old)], has_more: true, cursor: 123 } });
  }));
  assert.equal(listCalls, 1);
  assert.equal(result.posts.length, 0);
  assert.equal(result.coverage.status, 'complete');
  assert.equal(result.coverage.hasMore, false);
});

test('TikTok recent pagination respects the hard page budget even with large caller limits', async () => {
  let listCalls = 0;
  const result = await collectChannel('https://tiktok.com/@synk', { accessToken: 'fixture' }, { ...opts(async raw => {
    if (new URL(raw).pathname.includes('/user/')) return ok({ data: { user: { open_id: 'fixture', username: 'synk' } } });
    listCalls++;
    return ok({ data: { videos: [tikVideo(listCalls, fresh)], has_more: true, cursor: listCalls } });
  }), maxPages: 10000, maxPosts: 10000 });
  assert.equal(listCalls, 3);
  assert.equal(result.posts.length, 3);
  assert.equal(result.coverage.recent.maxPages, 3);
  assert.equal(result.coverage.recent.maxPosts, 100);
  assert.equal(result.coverage.status, 'partial');
});

test('Instagram requests no insights for old or undated media and does not pretend the window is complete', async () => {
  let calls = 0;
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '123' }, opts(async raw => {
    calls++;
    if (new URL(raw).pathname.endsWith('/123')) return ok({ id: '123', username: 'synk' });
    assert.ok(new URL(raw).pathname.endsWith('/media'));
    return ok({ data: [igMedia(1, old), igMedia(2, null)] });
  }));
  assert.equal(calls, 2);
  assert.equal(result.posts.length, 0);
  assert.equal(result.coverage.recent.invalidDates, 1);
  assert.equal(result.coverage.status, 'partial');
});

test('Instagram frequent insights are capped at 25 and skip costly metric fallback', async () => {
  let insightCalls = 0;
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '123' }, opts(async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith('/123')) return ok({ id: '123', username: 'synk' });
    if (url.pathname.endsWith('/media')) return ok({ data: Array.from({ length: 40 }, (_, i) => igMedia(i + 1)) });
    insightCalls++;
    assert.ok(url.searchParams.get('metric').includes(','));
    return { ok: false, status: 400, json: async () => ({ error: { code: 100 } }) };
  }));
  assert.equal(insightCalls, 25);
  assert.equal(result.posts.length, 40);
  assert.equal(result.posts[0].metrics.likes, 0);
  assert.equal(result.posts[0].metrics.views, null);
  assert.equal(result.coverage.recent.insightsSkipped, 15);
  assert.equal(result.coverage.status, 'partial');
});

test('Instagram optional rate error returns safe cooldown metadata while preserving base metrics', async () => {
  let insightCalls = 0;
  const result = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '123' }, opts(async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith('/123')) return ok({ id: '123', username: 'synk' });
    if (url.pathname.endsWith('/media')) return ok({ data: [igMedia(1), igMedia(2)] });
    insightCalls++;
    return { ok: false, status: 400, json: async () => ({ error: { code: 4, message: 'SECRET' } }) };
  }));
  assert.equal(insightCalls, 1);
  assert.equal(result.posts.length, 2);
  assert.deepEqual(result.coverage.collectionError, { code: 'RATE_LIMITED', status: 400, retryable: true });
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});

test('Facebook filters recent posts without invented metrics and conservatively marks old-page stop', async () => {
  let listCalls = 0;
  const result = await collectChannel('https://facebook.com/profile.php?id=123', { accessToken: 'fixture' }, opts(async raw => {
    if (new URL(raw).pathname.endsWith('/me')) return ok({ id: '123' });
    listCalls++;
    return ok({ data: [{ id: '123_1', created_time: old, permalink_url: 'https://facebook.com/123/posts/1' }], paging: { next: 'https://graph.facebook.com/next', cursors: { after: 'next' } } });
  }));
  assert.equal(listCalls, 1);
  assert.equal(result.posts.length, 0);
  assert.equal(result.channel.followers, null);
  assert.equal(result.coverage.status, 'partial');
  assert.equal(result.coverage.recent.uncertainOrder, true);
});

test('recent identity checks still reject a mismatched connected account', async () => {
  let calls = 0;
  await assert.rejects(collectChannel('https://instagram.com/synk', { accessToken: 'fixture', accountId: '123' }, opts(async () => {
    calls++;
    return ok({ id: '999', username: 'other' });
  })), error => error.code === 'ACCOUNT_MISMATCH');
  assert.equal(calls, 1);
});
