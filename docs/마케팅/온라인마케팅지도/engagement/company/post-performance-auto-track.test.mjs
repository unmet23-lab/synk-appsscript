import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { Store } from './store.mjs';
import { createPostPerformanceService } from './post-performance.mjs';
import { collectChannel } from './collectors.mjs';

// 집계가 찾은 새 공개 게시물 → 24·72시간 관측 자동 등록(10-20).
const BASE = '2026-10-20T00:00:00.000Z';
const atHours = hours => new Date(Date.parse(BASE) + hours * 3600000).toISOString();
const ok = value => ({ ok: true, status: 200, json: async () => value });

function fixture(t, { autoTrack = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'synk-post-auto-'));
  let at = atHours(30), calls = 0;
  const store = new Store(directory);
  const admin = { id: 'admin', name: 'Admin', active: true, role: 'admin', teamId: 'a' }, owner = { id: 'owner', name: 'Owner', active: true, role: 'member', teamId: 'a' };
  for (const user of [admin, owner]) store.put('users', user.id, user);
  const channel = (id, platform, handle, extra = {}) => ({ id, platform, handle, displayName: id, canonicalUrl: `https://example.invalid/${id}`, ownerIds: [owner.id], teamId: 'a', active: true, connectionVersion: 1, ...extra });
  const channels = [channel('yt', 'youtube', 'synk', { externalId: 'UCabcdefghijklmnopqrstuv' }), channel('ig', 'instagram', 'synk.mn'), channel('fb', 'facebook', 'synkworld'), channel('tt', 'tiktok', 'synk.tt'),
    channel('yt-off', 'youtube', 'off'), channel('yt-hidden', 'youtube', 'hidden', { hidden: true }), channel('yt-archived', 'youtube', 'archived', { active: false })];
  for (const row of channels) store.put('channels', row.id, row);
  store.setSecret('channel:yt', { apiKey: 'synthetic-key' });
  for (const id of ['ig', 'fb', 'tt', 'yt-hidden', 'yt-archived']) store.setSecret(`channel:${id}`, { accessToken: 'synthetic-token' });
  const collector = async (live, credentials, options) => { calls++; return { posts: store.all('posts').filter(post => post.channelId === live.id).map(post => ({ url: post.url, publishedAt: post.publishedAt, metrics: { views: 10, likes: 1 } })), coverage: { source: 'synthetic-official' } }; };
  const service = createPostPerformanceService({ store, clock: () => at, collector, autoTrack });
  t.after(() => { store.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); rmSync(directory, { recursive: true, force: true }); });
  let n = 0;
  const post = (channelId, url, hoursAgo, extra = {}) => { const id = `${channelId}:${++n}`; store.put('posts', id, { id, channelId, externalId: String(n), title: `post ${n}`, url, publishedAt: new Date(Date.parse(at) - hoursAgo * 3600000).toISOString(), source: `api:${store.get('channels', channelId).platform}`, unavailableAt: null, ...extra }); return id; };
  return { store, service, admin, owner, post, now: hours => { at = atHours(hours); }, calls: () => calls, entries: () => store.all('postPerformanceEntries') };
}

test('the scheduled pass registers fresh public posts once with their collected format and skips the rest', async t => {
  const f = fixture(t);
  f.post('yt', 'https://www.youtube.com/watch?v=shortsAAAAA', 2, { publicationFormat: 'youtube-shorts' });
  f.post('yt', 'https://www.youtube.com/watch?v=videoBBBBBB', 5, { publicationFormat: 'youtube-video' });
  f.post('yt', 'https://www.youtube.com/watch?v=wrongCCCCCC', 6, { publicationFormat: 'instagram-reels' });
  f.post('ig', 'https://www.instagram.com/reel/REEL123/', 3, { publicationFormat: 'instagram-reels' });
  f.post('ig', 'https://www.instagram.com/p/FEED123/', 4, { publicationFormat: null });
  f.post('fb', 'https://www.facebook.com/reel/123456789/', 1);
  f.post('tt', 'https://www.tiktok.com/@synk.tt/video/7697944753341582613?is_from_webapp=1', 7);
  // 건너뛸 것: 24시간 지난 글, 아직 안 온 시각, 집계에서 사라진 글, 손으로 넣은 기록, 보존 기간이 끝난 글, Facebook 피드 글, 연결 없는·숨긴·보관 채널.
  f.post('yt', 'https://www.youtube.com/watch?v=oldDDDDDDDD', 25, { publicationFormat: 'youtube-shorts' });
  f.post('yt', 'https://www.youtube.com/watch?v=futureEEEEE', -1, { publicationFormat: 'youtube-shorts' });
  f.post('yt', 'https://www.youtube.com/watch?v=goneFFFFFFF', 2, { unavailableAt: atHours(29) });
  f.post('yt', 'https://www.youtube.com/watch?v=manualGGGGG', 2, { source: 'manual-import' });
  f.post('yt', 'https://www.youtube.com/watch?v=expiredHHHH', 2, { expiresAt: atHours(29) });
  f.post('fb', 'https://www.facebook.com/synkworld/posts/pfbid0abcdef', 2);
  f.post('yt-off', 'https://www.youtube.com/watch?v=offIIIIIIII', 2);
  f.post('yt-hidden', 'https://www.youtube.com/watch?v=hiddenJJJJJ', 2);
  f.post('yt-archived', 'https://www.youtube.com/watch?v=archivedKKK', 2);
  f.post('yt', 'not a url', 2);

  const summary = await f.service.collectDue();
  assert.equal(summary.autoRegistered, 7);
  const byUrl = Object.fromEntries(f.entries().map(row => [row.url, row]));
  assert.deepEqual(Object.keys(byUrl).sort(), [
    'https://www.facebook.com/reel/123456789/', 'https://www.instagram.com/p/FEED123/', 'https://www.instagram.com/p/REEL123/', 'https://www.tiktok.com/@synk.tt/video/7697944753341582613',
    'https://www.youtube.com/watch?v=shortsAAAAA', 'https://www.youtube.com/watch?v=videoBBBBBB', 'https://www.youtube.com/watch?v=wrongCCCCCC'].sort());
  assert.equal(byUrl['https://www.youtube.com/watch?v=shortsAAAAA'].publicationFormat, 'youtube-shorts');
  assert.equal(byUrl['https://www.youtube.com/watch?v=videoBBBBBB'].publicationFormat, 'youtube-video');
  assert.equal(byUrl['https://www.youtube.com/watch?v=wrongCCCCCC'].publicationFormat, null);
  assert.equal(byUrl['https://www.instagram.com/p/REEL123/'].publicationFormat, 'instagram-reels');
  assert.equal(byUrl['https://www.instagram.com/p/FEED123/'].publicationFormat, null);
  for (const row of f.entries()) {
    assert.equal(row.origin, 'auto'); assert.equal(row.createdBy, f.admin.id); assert.equal(row.publicationPackageId, null); assert.equal(row.active, true);
    assert.deepEqual(row.checkpoints.map(item => [item.hours, item.status]), [[24, 'pending'], [72, 'pending']]);
  }
  // 게시 직후(2시간)인 글은 24시간 관측이 아직이라 SNS를 부르지 않는다. 다음 회차도 새로 올리지 않는다.
  assert.equal(f.calls(), 0);
  assert.equal((await f.service.collectDue()).autoRegistered, 0);
  assert.equal(f.entries().length, 7);
});

test('auto tracking stays off unless enabled, never runs on a person-triggered check, and needs an active administrator', async t => {
  const off = fixture(t, { autoTrack: false });
  off.post('yt', 'https://www.youtube.com/watch?v=shortsAAAAA', 2);
  assert.equal((await off.service.collectDue()).autoRegistered, 0);
  assert.equal(off.entries().length, 0);

  const f = fixture(t);
  f.post('yt', 'https://www.youtube.com/watch?v=shortsAAAAA', 2);
  await f.service.collectDue({ user: f.admin });
  assert.equal(f.entries().length, 0);
  f.store.put('users', f.admin.id, { ...f.admin, active: false });
  assert.equal((await f.service.collectDue()).autoRegistered, 0);
  f.store.put('users', f.admin.id, f.admin);
  assert.equal((await f.service.collectDue()).autoRegistered, 1);
});

test('one pass registers at most twenty posts and the next pass continues', async t => {
  const f = fixture(t);
  for (let i = 0; i < 25; i++) f.post('yt', `https://www.youtube.com/watch?v=bulk${String(i).padStart(7, '0')}`, 1 + i / 10, { publicationFormat: 'youtube-shorts' });
  assert.equal((await f.service.collectDue()).autoRegistered, 20);
  assert.equal((await f.service.collectDue()).autoRegistered, 5);
  assert.equal(f.entries().length, 25);
});

test('an auto-tracked post is observed at 24 hours like any other registration', async t => {
  const f = fixture(t);
  f.now(0); f.post('yt', 'https://www.youtube.com/watch?v=shortsAAAAA', 0, { publicationFormat: 'youtube-shorts' });
  f.now(1); await f.service.collectDue();
  assert.equal(f.entries().length, 1); assert.equal(f.calls(), 0);
  f.now(24.2); const summary = await f.service.collectDue();
  assert.equal(summary.recorded, 1); assert.equal(f.calls(), 1);
  const checkpoint = f.entries()[0].checkpoints[0];
  assert.equal(checkpoint.status, 'recorded'); assert.equal(checkpoint.metrics.views, 10); assert.equal(checkpoint.source, 'api:synthetic-official');
});

test('a workspace publication or a person adopts an auto-tracked post without losing its observations', async t => {
  const f = fixture(t);
  f.now(0); f.post('yt', 'https://www.youtube.com/watch?v=shortsAAAAA', 0, { publicationFormat: 'youtube-shorts' });
  f.now(1); await f.service.collectDue();
  f.now(24.2); await f.service.collectDue();
  const before = f.entries()[0];
  assert.equal(before.checkpoints[0].status, 'recorded');

  // 게시 묶음의 형식이 영상 길이로 짐작한 형식을 이긴다. 409 없이 이어받고 관측은 그대로다.
  const adopted = f.service.register(f.owner, { channelId: 'yt', url: 'https://youtu.be/shortsAAAAA', publishedAt: before.publishedAt, publicationPackageId: 'pkg-1', publicationFormat: 'youtube-video', title: '묶음 제목' });
  assert.equal(adopted.existing, true); assert.equal(adopted.linked, true);
  const row = f.entries()[0];
  assert.equal(row.id, before.id); assert.equal(row.origin, undefined); assert.equal(row.publicationPackageId, 'pkg-1'); assert.equal(row.publicationFormat, 'youtube-video');
  assert.equal(row.createdBy, f.owner.id); assert.equal(row.title, '묶음 제목'); assert.equal(row.publishedAt, before.publishedAt);
  assert.deepEqual(row.checkpoints, before.checkpoints);
  // 이어받은 뒤에는 보통 기록과 같다 — 다른 묶음은 막는다.
  assert.throws(() => f.service.register(f.owner, { channelId: 'yt', url: 'https://youtu.be/shortsAAAAA', publishedAt: before.publishedAt, publicationPackageId: 'pkg-2', publicationFormat: 'youtube-video' }), { status: 409 });

  // 사람이 형식 없이 등록하면 짐작한 형식을 남긴다.
  f.now(30); f.post('yt', 'https://www.youtube.com/watch?v=secondLLLLL', 1, { publicationFormat: 'youtube-shorts' });
  await f.service.collectDue();
  const second = f.service.register(f.owner, { channelId: 'yt', url: 'https://www.youtube.com/watch?v=secondLLLLL', publishedAt: atHours(29) });
  assert.equal(second.linked, true); assert.equal(second.entry.publicationFormat, 'youtube-shorts'); assert.equal(f.store.get('postPerformanceEntries', second.entry.id).origin, undefined);
});

test('collectors pass the post format the comparisons need without extra requests', async () => {
  const youtubeCalls = [];
  const youtube = await collectChannel('https://youtube.com/@synk', { apiKey: 'TEST_ONLY_KEY' }, { fetchImpl: async raw => {
    const url = new URL(raw); youtubeCalls.push(url.pathname);
    if (url.pathname.endsWith('/channels')) return ok({ items: [{ id: 'UCabcdefghijklmnopqrstuv', snippet: { title: 'SYNK' }, statistics: { videoCount: '3' }, contentDetails: { relatedPlaylists: { uploads: 'UPLOADS' } } }] });
    if (url.pathname.endsWith('/playlistItems')) return ok({ items: ['shortsAAAAA', 'videoBBBBBB', 'unknownCCCC'].map(videoId => ({ contentDetails: { videoId } })) });
    assert.equal(url.searchParams.get('part'), 'snippet,statistics,status,contentDetails');
    const item = (id, duration) => ({ id, snippet: { channelId: 'UCabcdefghijklmnopqrstuv', title: id, publishedAt: '2026-10-19T10:00:00Z' }, statistics: { viewCount: '1' }, ...(duration ? { contentDetails: { duration } } : {}) });
    return ok({ items: [item('shortsAAAAA', 'PT2M59S'), item('videoBBBBBB', 'PT3M1S'), item('unknownCCCC', null)] });
  } });
  assert.deepEqual(youtube.posts.map(post => post.publicationFormat), ['youtube-shorts', 'youtube-video', null]);
  assert.equal(youtubeCalls.length, 3);

  const instagram = await collectChannel('https://instagram.com/synk', { accessToken: 'fixture', authType: 'instagram-login', accountId: '1234' }, { fetchImpl: async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith('/me')) return ok({ id: '1234', username: 'synk', name: 'SYNK', followers_count: 0, media_count: 2 });
    if (url.pathname.endsWith('/media')) return ok({ data: [
      { id: '1', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-10-19T00:00:00Z', permalink: 'https://www.instagram.com/reel/REEL123/' },
      { id: '2', media_type: 'IMAGE', media_product_type: 'FEED', timestamp: '2026-10-18T00:00:00Z', permalink: 'https://www.instagram.com/p/FEED123/' }] });
    return ok({ data: [] });
  } });
  assert.deepEqual(instagram.posts.map(post => post.publicationFormat), ['instagram-reels', null]);
});
