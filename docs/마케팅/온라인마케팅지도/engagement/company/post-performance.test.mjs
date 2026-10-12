import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { Store } from './store.mjs';
import { createPostPerformanceService, normalizePerformancePostUrl } from './post-performance.mjs';
import { collectChannel } from './collectors.mjs';

const BASE = '2026-10-10T00:00:00.000Z', ID = 'abcdefghijk', URL = `https://www.youtube.com/watch?v=${ID}`;
const atHours = hours => new Date(Date.parse(BASE) + hours * 3600000).toISOString();
function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'synk-post-performance-'));
  let store = new Store(directory), at = BASE, calls = 0;
  const owner = { id: 'owner', name: 'Owner', active: true, role: 'member', teamId: 'a' }, other = { id: 'other', active: true, role: 'member', teamId: 'b' }, viewer = { id: 'viewer', active: true, role: 'viewer', teamId: 'a' };
  for (const user of [owner, other, viewer]) store.put('users', user.id, user);
  const channel = { id: 'channel', platform: 'youtube', canonicalUrl: 'https://www.youtube.com/@synk', handle: 'synk', displayName: 'SYNK', ownerIds: [owner.id], teamId: 'a', active: true, connectionVersion: 1 };
  store.put('channels', channel.id, channel); store.setSecret(`channel:${channel.id}`, { apiKey: 'synthetic-key' });
  const collector = async (...args) => { calls++; return options.collector ? options.collector(...args) : { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 0, likes: 2 } }], coverage: { source: 'synthetic-official', unavailableMetrics: ['saves', 'reach'] } }; };
  const make = extra => createPostPerformanceService({ store, clock: () => at, collector, ...extra });
  let service = make();
  t.after(() => { store.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(directory.startsWith(join(tmpdir(), 'synk-post-performance-'))); rmSync(directory, { recursive: true, force: true }); });
  return { get store() { return store; }, get service() { return service; }, owner, other, viewer, channel, make,
    now: hours => { at = atHours(hours); }, calls: () => calls,
    register: input => service.register(owner, { channelId: channel.id, url: URL, publishedAt: BASE, ...input }).entry,
    restart: () => { store.close(); store = new Store(directory); service = make(); },
  };
}

test('post URLs canonicalize aliases and reject profiles, credentials and foreign origins', () => {
  assert.equal(normalizePerformancePostUrl(`https://youtu.be/${ID}?si=tracking`).canonicalUrl, URL);
  assert.equal(normalizePerformancePostUrl(`https://www.youtube.com/shorts/${ID}`).identity, `youtube:${ID}`);
  assert.equal(normalizePerformancePostUrl('https://www.instagram.com/reel/ABC_123/').identity, normalizePerformancePostUrl('https://www.instagram.com/p/ABC_123/').identity);
  assert.equal(normalizePerformancePostUrl('https://www.facebook.com/synk/videos/123456/').canonicalUrl, 'https://www.facebook.com/synk/videos/123456/');
  assert.equal(normalizePerformancePostUrl('https://www.facebook.com/reel/123456/').identity, normalizePerformancePostUrl('https://www.facebook.com/watch/?v=123456').identity);
  for (const url of ['https://youtube.com/@synk', 'http://youtube.com/watch?v=abcdefghijk', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://secret@youtube.com/watch?v=abcdefghijk', 'https://youtube.com:444/watch?v=abcdefghijk', 'https://youtube.com/shorts/abc%2fdef', 'https://tiktok.com/t/short']) assert.throws(() => normalizePerformancePostUrl(url), { status: 400 });
});

test('registration requires current channel authority and real past publication time', t => {
  const f = fixture(t);
  assert.throws(() => f.service.register(f.other, { channelId: 'channel', url: URL, publishedAt: BASE }), { status: 404 });
  assert.throws(() => f.service.register(f.viewer, { channelId: 'channel', url: URL, publishedAt: BASE }), { status: 404 });
  assert.throws(() => f.register({ publishedAt: atHours(1) }), { status: 400 });
  assert.throws(() => f.register({ publishedAt: '2026-02-30T00:00:00Z' }), { status: 400 });
  assert.throws(() => f.register({ publishedAt: '2026-10-10T00:00' }), { status: 400 });
  assert.throws(() => f.register({ url: 'https://www.instagram.com/p/ABC123/' }), { status: 400 });
  f.store.put('users', f.owner.id, { ...f.owner, active: false });
  assert.throws(() => f.register(), { status: 403 });
});

test('duplicate aliases preserve original publication and survive restart; visibility follows current channel', t => {
  const f = fixture(t), entry = f.register();
  const duplicate = f.service.register(f.owner, { channelId: 'channel', url: `https://youtu.be/${ID}`, publishedAt: BASE, title: 'replacement' });
  assert.equal(duplicate.existing, true); assert.equal(duplicate.entry.id, entry.id); assert.equal(duplicate.entry.title, '');
  f.restart(); assert.equal(f.service.list(f.owner).entries.length, 1); assert.equal(f.service.list(f.other).entries.length, 0);
  assert.equal(f.service.list(f.viewer).entries[0].canEdit, false);
  f.store.put('channels', 'channel', { ...f.channel, ownerIds: [f.other.id], teamId: 'b' });
  assert.equal(f.service.list(f.owner).entries.length, 0); assert.equal(f.service.list(f.other).entries.length, 1);
});

test('a legacy publication can link a verified format without resetting its original time or recorded metrics',t=>{
  const f=fixture(t),original=f.register({publicationPackageId:'legacy-package',title:'Original'});f.now(25);
  f.service.manualCheckpoint(f.owner,original.id,24,{metrics:{views:0},measuredAt:atHours(25)});
  const before=f.service.list(f.owner).entries[0];
  const linked=f.service.register(f.owner,{channelId:'channel',url:URL,publishedAt:atHours(24),publicationPackageId:'legacy-package',publicationFormat:'youtube-shorts',title:'Replacement'});
  assert.equal(linked.linked,true);assert.equal(linked.entry.publicationFormat,'youtube-shorts');assert.equal(linked.entry.publishedAt,before.publishedAt);assert.equal(linked.entry.title,'Original');assert.deepEqual(linked.entry.checkpoints,before.checkpoints);
  assert.throws(()=>f.register({publicationPackageId:'legacy-package',publicationFormat:'youtube-video'}),{status:409});
  assert.throws(()=>f.register({publicationPackageId:'different-package',publicationFormat:'youtube-shorts'}),{status:409});
  f.restart();assert.equal(f.service.list(f.owner).entries[0].publicationFormat,'youtube-shorts');
});

test('format metadata must match a linked package and the publication platform',t=>{
  const f=fixture(t);
  for(const input of [{publicationFormat:'youtube-shorts'},{publicationPackageId:'p',publicationFormat:'instagram-reels'},{publicationPackageId:'p',publicationFormat:'<invalid>'}])assert.throws(()=>f.register(input),{status:400});
  assert.equal(f.store.all('postPerformanceEntries').length,0);
});

test('due collection uses exact post identity and retains zero, null reasons and server observation', async t => {
  const f = fixture(t), entry = f.register();
  f.now(23); assert.equal((await f.service.collectDue()).checked, 0); assert.equal(f.calls(), 0);
  f.now(24.5); const summary = await f.service.collectDue(); assert.equal(summary.recorded, 1);
  const checkpoint = f.service.list(f.owner).entries[0].checkpoints[0];
  assert.equal(checkpoint.metrics.views, 0); assert.equal(checkpoint.metrics.saves, null); assert.match(checkpoint.unavailableReasons.saves, /제공하지/);
  assert.equal(checkpoint.observedAt, atHours(24.5)); assert.equal(checkpoint.recordedAt, atHours(24.5)); assert.equal(checkpoint.delayMinutes, 30); assert.equal(checkpoint.timing, 'late');
  assert.equal(checkpoint.source, 'api:synthetic-official'); assert.equal(checkpoint.attempts, 1); assert.equal(checkpoint.leaseToken, undefined);
  await f.service.collectDue({ user: f.owner, entryId: entry.id }); assert.equal(f.calls(), 1);
});

test('late registration and missed windows do not manufacture historic checkpoint snapshots', async t => {
  const f = fixture(t); f.now(50); const entry = f.register(); assert.equal(entry.checkpoints[0].status, 'missed');
  f.now(79); await f.service.collectDue();
  const checkpoints = f.service.list(f.owner).entries[0].checkpoints;
  assert.deepEqual(checkpoints.map(item => item.status), ['missed', 'missed']); assert.equal(f.calls(), 0); assert.equal(checkpoints[1].metrics.views, null);
});

test('manual observation distinguishes measured time and server recording time and prevents overwrites', t => {
  const f = fixture(t), entry = f.register();
  f.now(25); assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { measuredAt: atHours(23), metrics: { views: 5 } }), { status: 400 });
  assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { measuredAt: atHours(26), metrics: { views: 5 } }), { status: 400 });
  for (const value of [-1, '0', true, 1.5, Infinity]) assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { metrics: { views: value } }), { status: 400 });
  assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { metrics: {} }), { status: 400 });
  f.now(80);
  const checkpoint = f.service.manualCheckpoint(f.owner, entry.id, 24, { measuredAt: atHours(24), metrics: { views: 0, saves: 3 } }).entry.checkpoints[0];
  assert.equal(checkpoint.observedAt, atHours(24)); assert.equal(checkpoint.recordedAt, atHours(80)); assert.equal(checkpoint.recordingDelayMinutes, 56 * 60);
  assert.equal(checkpoint.source, 'manual'); assert.equal(checkpoint.metrics.views, 0); assert.equal(checkpoint.metrics.shares, null);
  assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { metrics: { views: 9 } }), { status: 409 });
});

test('unconnected channels explicitly require manual input and do not fetch', async t => {
  const f = fixture(t); f.register(); f.store.deleteSecret('channel:channel'); f.now(24);
  assert.equal((await f.service.collectDue()).manualRequired, 1); assert.equal(f.calls(), 0);
  assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].status, 'manual-required');
});

test('automatic retries are bounded and do not expose provider error text', async t => {
  const f = fixture(t, { collector: async () => { throw Object.assign(new Error('Bearer secret-value access_token=secret'), { code: 'RATE_LIMITED', retryable: true }); } });
  f.register(); f.now(24); assert.equal((await f.service.collectDue()).retried, 1);
  f.now(24.01); await f.service.collectDue(); assert.equal(f.calls(), 1);
  f.now(24.1); await f.service.collectDue(); f.now(24.5); await f.service.collectDue(); f.now(25); await f.service.collectDue();
  assert.equal(f.calls(), 3); const checkpoint = f.service.list(f.owner).entries[0].checkpoints[0];
  assert.equal(checkpoint.status, 'manual-required'); assert.equal(checkpoint.attempts, 3); assert.equal(checkpoint.lastErrorCode, 'RATE_LIMITED');
  assert.doesNotMatch(JSON.stringify(checkpoint), /secret-value|access_token/);
});

test('missing exact post and mismatched publication time never borrow another post metrics', async t => {
  const f = fixture(t, { collector: async () => ({ posts: [{ url: `https://www.youtube.com/watch?v=zzzzzzzzzzz`, publishedAt: BASE, metrics: { views: 500 } }, { url: URL, publishedAt: atHours(-1), metrics: { views: 99 } }] }) });
  f.register(); f.now(24); await f.service.collectDue();
  const checkpoint = f.service.list(f.owner).entries[0].checkpoints[0]; assert.equal(checkpoint.metrics.views, null); assert.equal(checkpoint.lastErrorCode, 'PUBLISHED_AT_MISMATCH');
});

test('shared persistent lease batches a channel and prevents two service instances from fetching together', async t => {
  let release, started; const start = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { collector: async () => { started(); await gate; return { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 1 } }, { url: 'https://youtu.be/zzzzzzzzzzz', publishedAt: BASE, metrics: { views: 2 } }] }; } });
  f.register(); f.register({ url: 'https://youtu.be/zzzzzzzzzzz' }); f.now(24);
  const run = f.service.collectDue(); await start;
  const second = f.make(); await second.collectDue(); assert.equal(f.calls(), 1);
  release(); assert.equal((await run).recorded, 2); assert.equal(f.store.all('postPerformanceLocks').length, 0);
});

test('connection change and permission revocation during a request discard fetched response', async t => {
  let release, started; const start = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { collector: async () => { started(); await gate; return { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 100 } }] }; } });
  f.register(); f.now(24); const run = f.service.collectDue(); await start;
  f.store.put('channels', 'channel', { ...f.channel, connectionVersion: 2, collectionDisabled: true }); release(); await run;
  const checkpoint = f.service.list(f.owner).entries[0].checkpoints[0]; assert.equal(checkpoint.status, 'manual-required'); assert.equal(checkpoint.metrics.views, null);
});

test('expired persisted lease resumes after restart and a recording completed after the window stays missed', async t => {
  const f = fixture(t, { collector: async () => { f.now(31); return { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 100 } }] }; } });
  const entry = f.register(), row = f.store.get('postPerformanceEntries', entry.id);
  row.checkpoints[0] = { ...row.checkpoints[0], status: 'collecting', leaseToken: 'old', leaseUntil: atHours(24.1), attempts: 1 };
  f.store.put('postPerformanceEntries', row.id, row); f.store.put('postPerformanceLocks', 'channel', { id: 'channel', token: 'old', leaseUntil: atHours(24.1) });
  f.restart(); f.now(25); await f.service.collectDue(); const checkpoint = f.service.list(f.owner).entries[0].checkpoints[0];
  assert.equal(f.calls(), 1); assert.equal(checkpoint.status, 'missed'); assert.equal(checkpoint.metrics.views, null);
});

test('an authorized user cannot collect or manually write another channel through broad collection', async t => {
  const f = fixture(t), entry = f.register(); f.now(24);
  assert.equal((await f.service.collectDue({ user: f.other })).checked, 0); assert.equal(f.calls(), 0);
  await assert.rejects(f.service.collectDue({ user: f.other, entryId: entry.id }), { status: 404 });
  assert.throws(() => f.service.manualCheckpoint(f.viewer, entry.id, 24, { metrics: { views: 1 } }), { status: 404 });
});

test('comparison uses only same-channel earlier posts with matching valid checkpoints and excludes missing metrics', t => {
  const f = fixture(t), first = f.register(); f.now(24);
  f.service.manualCheckpoint(f.owner, first.id, 24, { metrics: { views: 10 } });
  f.now(26); const second = f.register({ url: 'https://youtu.be/zzzzzzzzzzz', publishedAt: atHours(26) });
  f.now(50); const recorded = f.service.manualCheckpoint(f.owner, second.id, 24, { metrics: { views: 20, likes: 5 } }).entry.checkpoints[0];
  assert.deepEqual(recorded.comparison.views, { sampleCount: 1, median: 10, delta: 10, deltaPercent: 100 });
  assert.deepEqual(recorded.comparison.likes, { sampleCount: 0, median: null, delta: null, deltaPercent: null });
  assert.equal(f.service.list(f.owner).entries[0].checkpoints[1].comparison.views.delta, null);
});

test('existing official collector is reused read-only with bounded channel scope and exact returned video', async t => {
  const requests = [], channelId = 'UCabcdefghijklmnopqrstuv';
  const fetchImpl = async (input, init = {}) => {
    const url = new globalThis.URL(input); requests.push({ url, method: init.method || 'GET' });
    assert.equal(url.origin, 'https://www.googleapis.com');
    const data = url.pathname.endsWith('/channels') ? { items: [{ id: channelId, snippet: { title: 'SYNK' }, statistics: {}, contentDetails: { relatedPlaylists: { uploads: 'uploads' } } }] }
      : url.pathname.endsWith('/playlistItems') ? { items: [{ contentDetails: { videoId: ID, videoPublishedAt: BASE } }] }
      : { items: [{ id: ID, snippet: { title: 'Exact', channelId, publishedAt: BASE }, statistics: { viewCount: '12', likeCount: '0' } }] };
    return { ok: true, status: 200, json: async () => data };
  };
  const f = fixture(t, { collector: (channel, credentials, options) => collectChannel(channel, credentials, { ...options, fetchImpl }) });
  f.register(); f.now(24); assert.equal((await f.service.collectDue()).recorded, 1);
  assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].metrics.views, 12);
  assert.ok(requests.length <= 4); assert.ok(requests.every(item => item.method === 'GET'));
});

test('session revocation while collecting discards provider result and releases lease', async t => {
  let release, started, allowed = true;
  const start = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { collector: async () => { started(); await gate; return { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 100 } }] }; } });
  const entry = f.register(); f.now(24);
  const job = f.service.collectDue({ user: f.owner, entryId: entry.id, authorize: () => { if (!allowed) throw new Error('expired'); } });
  await start; allowed = false; release(); await assert.rejects(job, { status: 401 });
  assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].metrics.views, null);
  assert.equal(f.store.all('postPerformanceLocks').length, 0);
});

test('stop aborts the in-flight official request and waits for cleanup without recording metrics', async t => {
  let started; const start = new Promise(resolve => { started = resolve; });
  const f = fixture(t, { collector: async (_channel, _credentials, { signal }) => {
    started(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    return { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 100 } }] };
  } });
  f.register(); f.now(24); const job = f.service.collectDue(); await start; await f.service.stop(); await job;
  assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].metrics.views, null);
  assert.equal(f.store.all('postPerformanceLocks').length, 0);
  await assert.rejects(f.service.collectDue(), { status: 503 });
});

test('paused entry is skipped and pausing during a fetch discards its response', async t => {
  let release, started; const start = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { collector: async () => { started(); await gate; return { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 100 } }] }; } });
  const entry = f.register(); f.service.setActive(f.owner, entry.id, false); f.now(24);
  await f.service.collectDue(); assert.equal(f.calls(), 0);
  f.service.setActive(f.owner, entry.id, true); const job = f.service.collectDue(); await start;
  f.service.setActive(f.owner, entry.id, false); release(); await job;
  assert.equal(f.service.list(f.owner).entries[0].active, false); assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].metrics.views, null);
});

test('manual supplements fill only missing fields and preserve original API provenance with separate clocks', async t => {
  const f = fixture(t), entry = f.register(); f.now(24); await f.service.collectDue(); f.now(28);
  const checkpoint = f.service.manualCheckpoint(f.owner, entry.id, 24, { measuredAt: atHours(25), metrics: { saves: 0, averageWatchSeconds: 5.25, completionRatePct: 72.5, earlyRetention3sPct: 80, toolVisits: 3 } }).entry.checkpoints[0];
  assert.equal(checkpoint.source, 'api:synthetic-official'); assert.equal(checkpoint.observedAt, atHours(24)); assert.equal(checkpoint.recordedAt, atHours(24));
  assert.equal(checkpoint.metrics.views, 0); assert.equal(checkpoint.metrics.saves, 0); assert.equal(checkpoint.metrics.completionRatePct, 72.5);
  assert.equal(checkpoint.metricProvenance.views.source, 'api:synthetic-official');
  assert.deepEqual(checkpoint.metricProvenance.averageWatchSeconds, { source: 'manual', observedAt: atHours(25), recordedAt: atHours(28), unit: 'seconds', timing: 'late', measurementWindowMissed: false });
  assert.equal(checkpoint.supplements.length, 1); assert.equal(checkpoint.supplements[0].metrics.views, undefined); assert.equal(checkpoint.unavailableReasons.saves, undefined);
  assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { metrics: { views: 0 } }), { status: 409 });
  assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { metrics: { saves: 1 } }), { status: 409 });
  f.restart(); assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].supplements.length, 1);
});

test('manual percentages have bounded units and unsupported provider retention is never inferred', async t => {
  const f = fixture(t, { collector: async () => ({ posts: [{ url: URL, publishedAt: BASE, metrics: { views: 5, earlyRetention3sPct: 99 } }] }) });
  const entry = f.register(); f.now(24); await f.service.collectDue();
  assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].metrics.earlyRetention3sPct, null);
  for (const metrics of [{ completionRatePct: 101 }, { earlyRetention3sPct: -1 }, { averageWatchSeconds: -1 }, { toolVisits: 1.5 }]) assert.throws(() => f.service.manualCheckpoint(f.owner, entry.id, 24, { metrics }), { status: 400 });
  const response = f.service.manualCheckpoint(f.owner, entry.id, 24, { metrics: { earlyRetention3sPct: 100, averageWatchSeconds: 0.25 } });
  assert.equal(response.entry.checkpoints[0].metrics.earlyRetention3sPct, 100);
});

test('comparisons exclude mixed provenance, different observation delays and out-of-window supplements', async t => {
  const f = fixture(t), first = f.register(); f.now(24); await f.service.collectDue();
  f.service.manualCheckpoint(f.owner, first.id, 24, { metrics: { toolVisits: 10 } });
  f.now(26); const second = f.register({ url: 'https://youtu.be/zzzzzzzzzzz', publishedAt: atHours(26) });
  f.now(50); let checkpoint = f.service.manualCheckpoint(f.owner, second.id, 24, { metrics: { views: 20 } }).entry.checkpoints[0];
  assert.equal(checkpoint.comparison.views.sampleCount, 0, 'manual and API observations do not mix');
  f.now(51); checkpoint = f.service.manualCheckpoint(f.owner, second.id, 24, { metrics: { toolVisits: 20 } }).entry.checkpoints[0];
  assert.equal(checkpoint.comparison.toolVisits.sampleCount, 0, 'one-hour timing difference does not become a comparable 24h result');
  f.now(52); const third = f.register({ url: 'https://youtu.be/yyyyyyyyyyy', publishedAt: atHours(52) });
  f.now(83); checkpoint = f.service.manualCheckpoint(f.owner, third.id, 24, { metrics: { toolVisits: 30 } }).entry.checkpoints[0];
  assert.equal(checkpoint.measurementWindowMissed, true); assert.equal(checkpoint.comparison.toolVisits.sampleCount, 0);
});

test('a caller losing channel access during collection cannot save another creators response', async t => {
  let release, started; const start = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { collector: async () => { started(); await gate; return { posts: [{ url: URL, publishedAt: BASE, metrics: { views: 100 } }] }; } });
  const entry = f.register(); f.store.put('users', f.other.id, { ...f.other, role: 'admin' }); f.now(24);
  const job = f.service.collectDue({ user: f.other, entryId: entry.id }); await start;
  f.store.put('users', f.other.id, { ...f.other, role: 'member' }); release(); await assert.rejects(job, { status: 401 });
  assert.equal(f.service.list(f.owner).entries[0].checkpoints[0].metrics.views, null);
});
