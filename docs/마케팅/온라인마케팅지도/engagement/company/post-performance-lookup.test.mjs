import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Store } from './store.mjs';
import { createPostPerformanceService } from './post-performance.mjs';

const BASE = '2026-10-10T00:00:00.000Z', VIDEO = 'abcdefghijk', CHANNEL = 'UCabcdefghijklmnopqrstuv';
const URL = `https://www.youtube.com/watch?v=${VIDEO}`, hours = value => new Date(Date.parse(BASE) + value * 3600000).toISOString();
const response = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'synk-performance-lookup-')), store = new Store(directory);
  const owner = { id: 'owner', role: 'member', teamId: 'a', active: true }, viewer = { id: 'viewer', role: 'viewer', teamId: 'a', active: true }, other = { id: 'other', role: 'member', teamId: 'b', active: true };
  for (const user of [owner, viewer, other]) store.put('users', user.id, user);
  const channel = { id: 'channel', platform: 'youtube', externalId: CHANNEL, handle: 'synk', ownerIds: ['owner'], teamId: 'a', connectionVersion: 1, active: true, ...options.channel };
  store.put('channels', channel.id, channel); store.setSecret('channel:channel', options.credentials || { apiKey: 'synthetic-key' });
  let at = hours(1); const requests = [];
  const fetchImpl = async (input, init) => {
    const url = new globalThis.URL(input); requests.push({ url, init });
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.ok(init.signal);
    assert.ok(['https://www.googleapis.com', 'https://graph.instagram.com', 'https://graph.facebook.com'].includes(url.origin));
    return options.fetchImpl ? options.fetchImpl(url, init, requests.length) : response({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL, publishedAt: BASE, title: '첫 줄\n둘째 줄' }, contentDetails: { duration: 'PT1M' }, status: { privacyStatus: 'public' } }] });
  };
  const service = createPostPerformanceService({ store, clock: () => at, fetchImpl });
  t.after(async () => { await service.stop(); store.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(directory.startsWith(join(tmpdir(), 'synk-performance-lookup-'))); rmSync(directory, { recursive: true, force: true }); });
  return { store, service, channel, owner, viewer, other, requests, now: value => { at = hours(value); }, input: { channelId: channel.id, url: URL }, lookup: (input = {}, opts) => service.lookup(owner, { channelId: channel.id, url: URL, ...input }, opts), register: (input = {}, opts) => service.registerVerified(owner, { channelId: channel.id, url: URL, ...input }, opts) };
}

test('YouTube aliases use exact official video lookup with canonical URL, ownership, checkpoints and duplicate id', async t => {
  const f = fixture(t);
  assert.equal(f.service.list(f.owner).lookupAvailable, true);
  for (const url of [URL, `https://youtu.be/${VIDEO}?si=tracking`, `https://youtube.com/shorts/${VIDEO}`]) {
    const found = await f.lookup({ url });
    assert.equal(found.url, URL); assert.equal(found.externalId, VIDEO); assert.equal(found.ownerMatch, true);
    assert.equal(found.publishedAt, BASE); assert.equal(found.title, '첫 줄'); assert.equal(found.suggestedFormat, 'youtube-shorts');
    assert.deepEqual(found.checkpoints[24], { dueAt: hours(24), closesAt: hours(30), missed: false }); assert.equal(found.existingEntryId, null);
    assert.equal(f.requests.at(-1).url.pathname, '/youtube/v3/videos'); assert.equal(f.requests.at(-1).url.searchParams.get('id'), VIDEO);
  }
  const created = await f.register({ publicationFormat: 'youtube-shorts' });
  f.now(31);const found = await f.lookup(); assert.equal(found.existingEntryId, created.entry.id); assert.equal(found.checkpoints[24].missed, true); assert.equal(found.checkpoints[72].missed, false);
});

test('lookup rejects missing channels, viewers and foreign channels with 403 before requesting credentials', async t => {
  const f = fixture(t);
  for (const [user, channelId] of [[f.owner, 'missing'], [f.viewer, 'channel'], [f.other, 'channel']]) {
    await assert.rejects(f.service.lookup(user, { channelId, url: URL }), { status: 403 });
    await assert.rejects(f.service.registerVerified(user, { channelId, url: URL, publishedAt: BASE }), { status: 403 });
  }
  assert.equal(f.requests.length, 0);
});

test('invalid and cross-platform URLs cannot trigger a provider request', async t => {
  const f = fixture(t);
  for (const url of ['https://127.0.0.1/', 'https://youtube.com/@synk', 'https://example.com/redirect', 'https://www.instagram.com/p/ABC123/']) await assert.rejects(f.lookup({ url }), { status: 400 });
  assert.equal(f.requests.length, 0);
});

test('YouTube foreign ownership is false and cannot be overridden by HTTP input', async t => {
  const f = fixture(t, { fetchImpl: () => response({ items: [{ id: VIDEO, snippet: { channelId: 'UCzzzzzzzzzzzzzzzzzzzzzz', publishedAt: BASE }, contentDetails: { duration: 'PT1M' } }] }) });
  const found = await f.lookup();assert.equal(found.ownerMatch, false); assert.equal(found.publishedAt, null); assert.match(found.reason, /달라요/);
  await assert.rejects(f.register({ publishedAt: BASE, ownerMatch: true, origin: 'external', publicationFormat: 'youtube-shorts' }), { status: 400 });
  assert.equal(f.store.all('postPerformanceEntries').length, 0);
});

test('unavailable connections, omitted videos and provider failures remain unknown without leaking errors', async t => {
  const f = fixture(t, { fetchImpl: () => { throw Error('Bearer synthetic-secret https://example.com/?access_token=synthetic-secret'); } });
  let found = await f.lookup(); assert.equal(found.ownerMatch, null); assert.doesNotMatch(JSON.stringify(found), /synthetic-secret|access_token|Bearer/);
  await assert.rejects(f.register({ publishedAt: BASE }), { status: 400 });
  f.store.deleteSecret('channel:channel'); const count = f.requests.length; found = await f.lookup(); assert.equal(found.ownerMatch, null); assert.equal(f.requests.length, count);
  const g = fixture(t, { fetchImpl: () => response({ items: [] }) }); assert.equal((await g.lookup()).ownerMatch, null);
});

test('platform time fills missing input, adjusts differences over five minutes and stores external format', async t => {
  const f = fixture(t), result = await f.register({ publishedAt: hours(.25), publicationFormat: 'youtube-shorts' });
  assert.equal(result.entry.publishedAt, BASE); assert.equal(result.publishedAtAdjusted, true); assert.equal(result.entry.origin, 'external'); assert.equal(result.entry.publicationFormat, 'youtube-shorts'); assert.equal(result.entry.publicationPackageId, null);
  const duplicate = await f.register({ url: `https://youtu.be/${VIDEO}`, publishedAt: BASE }); assert.equal(duplicate.existing, true); assert.equal(duplicate.entry.id, result.entry.id); assert.equal(f.store.all('postPerformanceEntries').length, 1);
  const g = fixture(t); assert.equal((await g.register()).entry.publishedAt, BASE);
  const h = fixture(t); const close = await h.register({ publishedAt: hours(5 / 60) }); assert.equal(close.entry.publishedAt, BASE); assert.equal(close.publishedAtAdjusted, undefined);
});

test('verified external format may link a previous registration without changing observation records', async t => {
  const f = fixture(t), before = f.service.register(f.owner, { ...f.input, publishedAt: BASE }).entry;
  const result = await f.register({ publicationFormat: 'youtube-video' });
  assert.equal(result.entry.id, before.id); assert.equal(result.linked, true); assert.equal(result.entry.origin, 'external'); assert.deepEqual(result.entry.checkpoints, before.checkpoints);
});

test('time absent from platform, future publication, mismatched format and private video are rejected', async t => {
  for (const values of [{ time: null }, { time: hours(2) }, { time: BASE, privacy: 'private' }]) {
    const f = fixture(t, { fetchImpl: () => response({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL, publishedAt: values.time }, status: { privacyStatus: values.privacy || 'public' } }] }) });
    await assert.rejects(f.register({ publishedAt: BASE }), { status: 400 });assert.equal(f.store.all('postPerformanceEntries').length, 0);
  }
  const f = fixture(t);await assert.rejects(f.register({ publicationFormat: 'instagram-reels' }), { status: 400 });
});

test('short address overrides duration suggestion and longer watch video suggests regular video', async t => {
  const f = fixture(t, { fetchImpl: () => response({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL, publishedAt: BASE }, contentDetails: { duration: 'PT10M' } }] }) });
  assert.equal((await f.lookup()).suggestedFormat, 'youtube-video');assert.equal((await f.lookup({ url: `https://youtube.com/shorts/${VIDEO}` })).suggestedFormat, 'youtube-shorts');
});

test('manual platforms keep explicit unknown lookup and continue manual registration', async t => {
  const f = fixture(t, { channel: { platform: 'threads', externalId: null } }), url = 'https://www.threads.com/@synk/post/ABC123';
  const found = await f.lookup({ url });assert.equal(found.ownerMatch, null);assert.equal(found.publishedAt, null);assert.match(found.reason, /직접/);
  const result = await f.register({ url, publishedAt: BASE, origin: 'external', ownerMatch: true });assert.equal(result.entry.origin, undefined);assert.equal(result.entry.publishedAt, BASE);assert.equal(f.requests.length, 0);
});

const instagram = { channel: { platform: 'instagram', externalId: '1784001', handle: 'synk' }, credentials: { accessToken: 'synthetic-instagram', authType: 'instagram-login', accountId: '1784001', metaIdentityVersion: 1 } };
test('Instagram checks token identity and owned media permalink for both reel and p aliases', async t => {
  const f = fixture(t, { ...instagram, fetchImpl: (url, init) => {
    assert.equal(url.origin, 'https://graph.instagram.com');assert.equal(url.searchParams.has('access_token'), false); assert.ok(init.headers.Authorization);
    if (url.pathname.endsWith('/me')) return response({ id: '1234', user_id: '1784001', username: 'synk' });
    assert.equal(url.pathname, '/v26.0/1784001/media'); assert.equal(url.searchParams.get('fields'), 'id,permalink,timestamp,media_product_type,caption');
    return response({ data: [{ id: 'media-id', permalink: 'https://www.instagram.com/reel/ABC123/', timestamp: BASE, media_product_type: 'REELS', caption: '첫 캡션\n다음 줄' }] });
  } });
  for (const url of ['https://instagram.com/reel/ABC123/', 'https://instagram.com/p/ABC123/']) {
    const found = await f.lookup({ url }); assert.equal(found.ownerMatch, true);assert.equal(found.url, 'https://www.instagram.com/p/ABC123/');assert.equal(found.suggestedFormat, 'instagram-reels');assert.equal(found.title, '첫 캡션');
  }
  const saved = await f.register({ url: 'https://instagram.com/reel/ABC123/', publicationFormat: 'instagram-reels' });assert.equal(saved.entry.origin, 'external');assert.equal(saved.entry.publishedAt, BASE);
});

test('Instagram feed does not become a reel and an unrelated token cannot assert ownership', async t => {
  const f = fixture(t, { ...instagram, fetchImpl: url => response(url.pathname.endsWith('/me') ? { id: '1234', user_id: '1784001', username: 'synk' } : { data: [{ id: '1', permalink: 'https://instagram.com/p/ABC123/', timestamp: BASE, media_product_type: 'FEED' }] }) });
  assert.equal((await f.lookup({ url: 'https://instagram.com/p/ABC123/' })).suggestedFormat, null);
  const g = fixture(t, { ...instagram, fetchImpl: () => response({ id: '1234', user_id: '1784999', username: 'other' }) });
  assert.equal((await g.lookup({ url: 'https://instagram.com/p/ABC123/' })).ownerMatch, null);assert.equal(g.requests.length, 1);
});

test('Instagram paging is bounded, ignores arbitrary next URLs and does not call missing posts foreign', async t => {
  const f = fixture(t, { ...instagram, fetchImpl: (url, _init, count) => response(url.pathname.endsWith('/me') ? { id: '1234', user_id: '1784001', username: 'synk' } : { data: [], paging: { next: 'https://attacker.invalid/steal', cursors: { after: `page-${count}` } } }) });
  const found = await f.lookup({ url: 'https://instagram.com/p/ABC123/' });assert.equal(found.ownerMatch, null);assert.match(found.reason, /최근 게시물/);assert.equal(f.requests.length, 4);
  assert.ok(f.requests.every(item => item.url.origin === 'https://graph.instagram.com'));assert.equal(f.requests[2].url.searchParams.get('after'), 'page-2');
});

test('permission, connection and session changes during lookup prevent registration', async t => {
  for (const change of ['permission', 'connection', 'session']) {
    let release, started, allowed = true;const gate = new Promise(resolve => { release = resolve; }), start = new Promise(resolve => { started = resolve; });
    const f = fixture(t, { fetchImpl: async () => { started();await gate;return response({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL, publishedAt: BASE } }] }); } });
    const authorize = () => { if (!allowed) throw Object.assign(Error('로그인을 확인해 주세요.'), { status: 401 }); };
    const pending = f.register({}, { authorize });await start;
    if (change === 'permission') f.store.put('users', 'owner', { ...f.owner, role: 'viewer' });
    if (change === 'connection') f.store.put('channels', 'channel', { ...f.channel, connectionVersion: 2 });
    if (change === 'session') allowed = false;
    release();await assert.rejects(pending, { status: change === 'permission' ? 403 : change === 'connection' ? 409 : 401 });assert.equal(f.store.all('postPerformanceEntries').length, 0);
  }
});

test('lookup uses bearer instead of query key and rejects oversized provider response safely', async t => {
  const f = fixture(t, { credentials: { accessToken: 'synthetic-oauth', apiKey: 'synthetic-key' }, fetchImpl: () => new Response('x'.repeat(1024 * 1024 + 1), { status: 200 }) });
  const found = await f.lookup();assert.equal(found.ownerMatch, null);assert.equal(f.requests[0].url.searchParams.has('key'), false);assert.ok(f.requests[0].init.headers.Authorization);
});

test('stop aborts a lookup and leaves no registration', async t => {
  let started;const start = new Promise(resolve => { started = resolve; });
  const f = fixture(t, { fetchImpl: async (_url, init) => { started();await new Promise(resolve => init.signal.addEventListener('abort', resolve, { once: true }));throw Error('aborted'); } });
  const pending = f.register(); const rejected = assert.rejects(pending, { status: 503 });await start;await f.service.stop();await rejected;assert.equal(f.store.all('postPerformanceEntries').length, 0);
});
