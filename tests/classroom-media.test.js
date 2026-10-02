'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker, ApiError, validateConfig, validateSession, seal, atomic } = require('../tools/classroom-media/worker');

const CHANNEL = `UC${'x'.repeat(22)}`;
const VIDEO = 'video000001';
const SESSION = { classId: '11111111-1111-4111-8111-111111111111', sessionKey: '2026-09-28T09:00', title: '반 1 수업', startsAt: '2026-09-28T00:00:00Z', endsAt: '2026-09-28T01:00:00Z' };

function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-classroom-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = {
    expectedChannelId: CHANNEL, stateDir: path.join(dir, 'state'), inboxDir: path.join(dir, 'inbox'), recordingsRoot: path.join(dir, 'recordings'),
    syncUrl: 'https://test.supabase.co/functions/v1/classroom-sync', anonKeyEnv: 'ANON',
    classes: [{ classId: SESSION.classId, playlistId: 'playlist000001', streamId: 'stream001', videoPrivacy: 'unlisted', syncKeyEnv: 'CLASS_KEY' }],
  };
  fs.mkdirSync(config.recordingsRoot);
  const calls = [], syncs = [], state = { privacy: 'unlisted', playlistPrivacy: 'unlisted', lifecycle: 'ready', processed: true, bound: 'stream001', playlistItems: false };
  const youtube = {
    async verifyIdentity() { calls.push({ resource: 'identity' }); },
    async request(resource, options = {}) {
      calls.push({ resource, ...options });
      if (overrides.request) {
        const custom = await overrides.request(resource, options, state);
        if (custom !== undefined) return custom;
      }
      if (resource === 'playlists') return { items: [{ snippet: { channelId: CHANNEL }, status: { privacyStatus: state.playlistPrivacy } }] };
      if (resource === 'liveStreams') return { items: [{ snippet: { channelId: CHANNEL } }] };
      if (resource === 'liveBroadcasts' && options.method === 'POST') return { id: VIDEO };
      if (resource === 'liveBroadcasts') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL }, status: { privacyStatus: state.privacy, lifeCycleStatus: state.lifecycle }, contentDetails: { boundStreamId: state.bound } }] };
      if (resource === 'liveBroadcasts/bind') { state.bound = options.query.streamId; return { id: VIDEO }; }
      if (resource === 'videos') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL }, status: { privacyStatus: state.privacy, uploadStatus: state.processed ? 'processed' : 'uploaded' }, processingDetails: { processingStatus: state.processed ? 'succeeded' : 'processing' }, liveStreamingDetails: state.lifecycle === 'complete' ? { actualEndTime: SESSION.endsAt } : {} }] };
      if (resource === 'playlistItems' && options.method === 'POST') { state.playlistItems = true; return { id: 'item1' }; }
      if (resource === 'playlistItems') return { items: state.playlistItems ? [{ id: 'item1' }] : [] };
      throw new Error(`Unexpected API ${resource}`);
    },
    async raw(url, options) {
      calls.push({ resource: 'raw', url, ...options });
      if (overrides.raw) return overrides.raw(url, options);
      if (options.method === 'POST') return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/session001' } });
      if (options.headers['content-range'].startsWith('bytes */')) return new Response(null, { status: 308 });
      return Response.json({ id: VIDEO }, { status: 201 });
    },
  };
  let time = Date.parse('2026-09-28T01:01:00Z');
  const dependencies = { youtube, env: { ANON: 'public-key', CLASS_KEY: 'a'.repeat(48) }, now: () => time, fetchImpl: async (url, options) => { syncs.push(JSON.parse(options.body)); return new Response('{}', { status: 200 }); } };
  const worker = new Worker(config, dependencies);
  const recording = path.join(config.recordingsRoot, 'lesson.mkv');
  fs.writeFileSync(recording, Buffer.from('closed recording'));
  return { dir, config, worker, calls, syncs, state, recording, dependencies, advance: (ms = 60000) => { time += ms; } };
}

test('four classroom mappings must have different stream IDs and playlists', t => {
  const { config } = fixture(t);
  config.classes.push({ ...config.classes[0], classId: '22222222-2222-4222-8222-222222222222', playlistId: 'playlist000002' });
  assert.throws(() => validateConfig(config), /DUPLICATE_streamId/);
  config.classes[1].streamId = 'stream002';
  assert.doesNotThrow(() => validateConfig(config));
  config.classes[1].playlistId = config.classes[0].playlistId;
  assert.throws(() => validateConfig(config), /DUPLICATE_playlistId/);
});

test('no file is uploaded until an atomic recorder-completed manifest exists', async t => {
  const { config, worker, calls } = fixture(t);
  atomic(path.join(config.inboxDir, 'writing.ready.json.tmp'), SESSION);
  assert.deepEqual(await worker.once(), { results: [], failures: [] });
  assert.equal(calls.filter(call => call.resource === 'raw').length, 0);
});

test('sealed recording mutation is refused and original is preserved', async t => {
  const { config, worker, recording, calls } = fixture(t);
  await seal(config, SESSION, recording);
  fs.appendFileSync(recording, 'unexpected later bytes');
  const result = await worker.once();
  assert.equal(result.failures[0].error, 'SEALED_RECORDING_CHANGED');
  assert.equal(calls.filter(call => call.resource === 'raw').length, 0);
  assert.ok(fs.existsSync(recording));
});

test('public playlist blocks broadcast creation before any mutation', async t => {
  const { worker, state, calls } = fixture(t);
  state.playlistPrivacy = 'public';
  await assert.rejects(worker.prepare(SESSION), /PLAYLIST_NOT_OWNED_UNLISTED/);
  assert.equal(calls.filter(call => call.method === 'POST').length, 0);
});

test('prepare sets DVR/archive/automatic start-stop and is idempotent', async t => {
  const { worker, calls, syncs, state } = fixture(t);
  state.bound = null;
  await worker.prepare(SESSION);
  await worker.prepare(SESSION);
  const creates = calls.filter(call => call.resource === 'liveBroadcasts' && call.method === 'POST');
  assert.equal(creates.length, 1);
  assert.deepEqual(creates[0].body.contentDetails, { enableDvr: true, recordFromStart: true, enableAutoStart: true, enableAutoStop: true, monitorStream: { enableMonitorStream: false } });
  assert.equal(creates[0].body.status.privacyStatus, 'unlisted');
  assert.equal(calls.filter(call => call.resource === 'liveBroadcasts/bind').length, 1);
  assert.equal(calls.filter(call => call.resource === 'playlistItems' && call.method === 'POST').length, 1);
  assert.equal(syncs.at(-1).status, 'scheduled');
});

test('lost create response is not automatically retried; verified recovery reuses video', async t => {
  const fx = fixture(t, { request: async (resource, options) => {
    if (resource === 'liveBroadcasts' && options.method === 'POST') throw new ApiError('YOUTUBE_NETWORK_ERROR');
  } });
  await assert.rejects(fx.worker.prepare(SESSION), /YOUTUBE_NETWORK_ERROR/);
  await assert.rejects(fx.worker.prepare(SESSION), /BROADCAST_CREATE_AMBIGUOUS_MANUAL_RECOVERY/);
  assert.equal(fx.calls.filter(call => call.resource === 'liveBroadcasts' && call.method === 'POST').length, 1);
  await fx.worker.recover(SESSION, VIDEO);
  await fx.worker.once();
  assert.equal(fx.syncs.at(-1).youtube_video_id, VIDEO);
});

test('lost playlist insert response reconciles existing item without duplicate insert', async t => {
  let inserted = false;
  const fx = fixture(t, { request: async (resource, options) => {
    if (resource !== 'playlistItems') return;
    if (options.method === 'POST') { inserted = true; throw new ApiError('YOUTUBE_NETWORK_ERROR'); }
    return { items: inserted ? [{ id: 'existing' }] : [] };
  } });
  await assert.rejects(fx.worker.prepare(SESSION), /YOUTUBE_NETWORK_ERROR/);
  await fx.worker.prepare(SESSION);
  assert.equal(fx.calls.filter(call => call.resource === 'playlistItems' && call.method === 'POST').length, 1);
});

test('resumable restart queries accepted server bytes and uploads only the remainder', async t => {
  let accepted = 0, failFirstChunk = true;
  const fx = fixture(t, { raw: async (url, options) => {
    if (options.method === 'POST') return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/session001' } });
    const range = options.headers['content-range'];
    if (range.startsWith('bytes */')) return new Response(null, { status: 308, headers: accepted ? { range: `bytes=0-${accepted - 1}` } : {} });
    const match = range.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    assert.equal(Number(match[1]), accepted);
    accepted = Number(match[2]) + 1;
    if (failFirstChunk) { failFirstChunk = false; throw new ApiError('YOUTUBE_NETWORK_ERROR'); }
    return Response.json({ id: VIDEO }, { status: 201 });
  } });
  fs.writeFileSync(fx.recording, Buffer.alloc(8 * 1024 * 1024 + 13, 7));
  await seal(fx.config, SESSION, fx.recording);
  const first = await fx.worker.once();
  assert.equal(first.failures[0].error, 'YOUTUBE_NETWORK_ERROR');
  fx.advance();
  const restarted = new Worker(fx.config, fx.dependencies);
  assert.equal((await restarted.once()).failures.length, 0);
  assert.equal(fx.calls.filter(call => call.resource === 'raw' && call.method === 'POST').length, 1);
  assert.equal(accepted, 8 * 1024 * 1024 + 13);
  assert.equal(fx.syncs.at(-1).status, 'ready');
  assert.ok(fs.existsSync(fx.recording));
});

test('lost final upload response is recovered by status query without duplicate video', async t => {
  let finished = false;
  const fx = fixture(t, { raw: async (url, options) => {
    if (options.method === 'POST') return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/session001' } });
    if (options.headers['content-range'].startsWith('bytes */')) return finished ? Response.json({ id: VIDEO }, { status: 201 }) : new Response(null, { status: 308 });
    finished = true; throw new ApiError('YOUTUBE_NETWORK_ERROR');
  } });
  await seal(fx.config, SESSION, fx.recording);
  await fx.worker.once(); fx.advance();
  await new Worker(fx.config, fx.dependencies).once();
  assert.equal(fx.calls.filter(call => call.resource === 'raw' && call.body instanceof Buffer).length, 1);
  assert.equal(fx.calls.filter(call => call.resource === 'raw' && call.method === 'POST').length, 1);
  assert.equal(fx.syncs.at(-1).status, 'ready');
});

test('unprocessed upload never becomes ready and processing is rechecked', async t => {
  const fx = fixture(t); fx.state.processed = false;
  await seal(fx.config, SESSION, fx.recording);
  await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'processing');
  fx.state.processed = true; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'ready');
});

test('private upload is not published ready even if processing succeeded', async t => {
  const fx = fixture(t); fx.state.privacy = 'private';
  await seal(fx.config, SESSION, fx.recording);
  const result = await fx.worker.once();
  assert.equal(result.failures[0].error, 'VIDEO_NOT_OWNED_EXPECTED_PRIVACY');
  assert.ok(fx.syncs.every(item => item.status === 'failed'));
});

test('live archive becomes replay on the same video ID and local recording stays backup', async t => {
  const fx = fixture(t);
  await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'live'; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'live');
  await seal(fx.config, SESSION, fx.recording);
  fx.state.lifecycle = 'complete'; fx.state.processed = false; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'processing');
  fx.state.processed = true; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'ready');
  assert.equal(new Set(fx.syncs.map(item => item.youtube_video_id)).size, 1);
  assert.equal(fx.calls.filter(call => call.resource === 'raw').length, 0);
  assert.ok(fs.existsSync(fx.recording));
});

test('same stream cannot prepare a second class session before the first ends', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  await assert.rejects(fx.worker.prepare({ ...SESSION, sessionKey: 'next-session' }), /CLASS_HAS_UNFINISHED_LIVE/);
});

test('failed live can explicitly fall back to upload but active live cannot', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  await seal(fx.config, SESSION, fx.recording, { fallback: true });
  const pending = await fx.worker.once();
  assert.equal(pending.failures[0].error, 'FALLBACK_REQUIRES_FAILED_LIVE');
  fx.state.lifecycle = 'revoked'; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'failed');
  fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).source, 'upload');
  assert.equal(fx.syncs.at(-1).status, 'ready');
});

test('another worker lock prevents concurrent mutations', async t => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.config.stateDir, 'worker.lock'), '{"pid":123}');
  await assert.rejects(fx.worker.once(), /WORKER_LOCKED/);
  assert.equal(fx.calls.length, 0);
});

test('private class requests private broadcasts and reports expected privacy without invitation claim', async t => {
  const fx = fixture(t);
  fx.config.classes[0].videoPrivacy = 'private'; fx.state.privacy = 'private';
  await fx.worker.prepare(SESSION);
  const create = fx.calls.find(call => call.resource === 'liveBroadcasts' && call.method === 'POST');
  assert.equal(create.body.status.privacyStatus, 'private');
  assert.equal(fx.syncs.at(-1).youtube_privacy_status, 'private');
  assert.equal(Object.hasOwn(fx.syncs.at(-1), 'private_access_confirmed_at'), false);
});

test('ended broadcast in archive processing does not block next class session', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'complete'; fx.state.processed = false; fx.advance();
  await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'processing');
  await assert.doesNotReject(fx.worker.prepare({ ...SESSION, sessionKey: 'next-session' }));
  assert.equal(fx.calls.filter(call => call.resource === 'liveBroadcasts' && call.method === 'POST').length, 2);
});

test('definite playlist 429 rejection is retried rather than frozen as ambiguous', async t => {
  let reject = true;
  const fx = fixture(t, { request: async (resource, options) => {
    if (resource === 'playlistItems' && options.method === 'POST' && reject) { reject = false; throw new ApiError('YOUTUBE_HTTP_429', 429); }
  } });
  await assert.rejects(fx.worker.prepare(SESSION), /YOUTUBE_HTTP_429/);
  await assert.doesNotReject(fx.worker.prepare(SESSION));
  assert.equal(fx.calls.filter(call => call.resource === 'playlistItems' && call.method === 'POST').length, 2);
});

test('definite broadcast 403 rejection can be retried after permission repair', async t => {
  let reject = true;
  const fx = fixture(t, { request: async (resource, options) => {
    if (resource === 'liveBroadcasts' && options.method === 'POST' && reject) { reject = false; throw new ApiError('YOUTUBE_HTTP_403', 403); }
  } });
  await assert.rejects(fx.worker.prepare(SESSION), /YOUTUBE_HTTP_403/);
  await assert.doesNotReject(fx.worker.prepare(SESSION));
});

test('upload initiation 429 is retried with no duplicate committed video', async t => {
  let rejected = false;
  const fx = fixture(t, { raw: async (url, options) => {
    if (options.method === 'POST') {
      if (!rejected) { rejected = true; return new Response(null, { status: 429 }); }
      return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/session001' } });
    }
    if (options.headers['content-range'].startsWith('bytes */')) return new Response(null, { status: 308 });
    return Response.json({ id: VIDEO }, { status: 201 });
  } });
  await seal(fx.config, SESSION, fx.recording);
  assert.equal((await fx.worker.once()).failures[0].error, 'UPLOAD_INIT_HTTP_429');
  fx.advance(); assert.equal((await fx.worker.once()).failures.length, 0);
  assert.equal(fx.syncs.at(-1).status, 'ready');
});

test('steady four-class heartbeat batches videos and broadcasts into two GETs', async t => {
  const fx = fixture(t, { request: async (resource, options) => {
    if (resource === 'videos') return { items: options.query.id.split(',').map(id => ({ id, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', uploadStatus: 'uploaded' }, processingDetails: { processingStatus: 'processing' } })) };
    if (resource === 'liveBroadcasts' && !options.method) return { items: options.query.id.split(',').map(id => ({ id, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', lifeCycleStatus: 'live' }, contentDetails: { boundStreamId: `stream00${id.at(-1)}` } })) };
  } });
  fx.config.classes = [1, 2, 3, 4].map(n => ({ ...fx.config.classes[0], classId: `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`, playlistId: `playlist00000${n}`, streamId: `stream00${n}` }));
  for (const [index, cls] of fx.config.classes.entries()) {
    fx.worker.save({ ...SESSION, classId: cls.classId, sessionKey: `session${index}`, source: 'live', status: 'live', prepared: true, playlistAdded: true, videoId: `video00000${index + 1}` });
  }
  await fx.worker.once();
  fx.calls.length = 0; fx.advance(60000);
  const result = await fx.worker.once();
  assert.equal(result.results.length, 4); assert.equal(result.failures.length, 0);
  assert.equal(fx.calls.length, 2);
  assert.deepEqual(fx.calls.map(call => call.resource).sort(), ['liveBroadcasts', 'videos']);
  assert.ok(fx.calls.every(call => call.query.id.split(',').length === 4));
});

test('upload continues every second while live metadata polling remains once per minute', async t => {
  const liveId = 'live0000001';
  let accepted = 0;
  const fx = fixture(t, {
    request: async (resource, options) => {
      if (resource === 'videos') return { items: options.query.id.split(',').map(id => ({ id, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', uploadStatus: 'uploaded' }, processingDetails: { processingStatus: 'processing' } })) };
      if (resource === 'liveBroadcasts') return { items: [{ id: liveId, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', lifeCycleStatus: 'live' }, contentDetails: { boundStreamId: 'stream001' } }] };
    },
    raw: async (url, options) => {
      if (options.method === 'POST') return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/session001' } });
      if (!options.headers['content-range'].startsWith('bytes */')) {
        const match = options.headers['content-range'].match(/^bytes (\d+)-(\d+)\/(\d+)$/);
        assert.equal(Number(match[1]), accepted);
        accepted = Number(match[2]) + 1;
      }
      return new Response(null, { status: 308, headers: accepted ? { range: `bytes=0-${accepted - 1}` } : {} });
    },
  });
  fx.worker.save({ ...SESSION, sessionKey: 'live-session', source: 'live', status: 'live', prepared: true, playlistAdded: true, videoId: liveId });
  fs.writeFileSync(fx.recording, Buffer.alloc(8 * 1024 * 1024 * 5, 7));
  await seal(fx.config, { ...SESSION, sessionKey: 'recording-session' }, fx.recording);
  await fx.worker.once();
  assert.equal(fx.worker.nextDelay(), 1000);
  fx.calls.length = 0;
  for (let tick = 0; tick < 2; tick++) {
    fx.advance(1000); await fx.worker.once();
    assert.equal(fx.worker.nextDelay(), 1000);
  }
  assert.equal(accepted, 24 * 1024 * 1024);
  assert.equal(fx.calls.filter(call => ['videos', 'liveBroadcasts'].includes(call.resource)).length, 0);
  assert.equal(fx.syncs.filter(item => item.source === 'live').length, 1);
  fx.advance(58000); await fx.worker.once();
  assert.equal(fx.calls.filter(call => ['videos', 'liveBroadcasts'].includes(call.resource)).length, 2);
  assert.equal(fx.syncs.filter(item => item.source === 'live').length, 2);
  assert.equal(accepted, 32 * 1024 * 1024);
});

test('fast upload cadence respects persisted failure backoff', async t => {
  const fx = fixture(t, { raw: async () => { throw new ApiError('YOUTUBE_NETWORK_ERROR'); } });
  await seal(fx.config, SESSION, fx.recording);
  await fx.worker.once();
  assert.equal(fx.worker.nextDelay(), 10000);
  const networkCalls = fx.calls.filter(call => call.resource === 'raw').length;
  fx.advance(1000); await fx.worker.once();
  assert.equal(fx.calls.filter(call => call.resource === 'raw').length, networkCalls);
  assert.equal(fx.worker.nextDelay(), 9000);
});

function roomFixture(t) {
  const broadcasts = new Map();
  const fx = fixture(t, { request: async (resource, options) => {
    if (resource === 'liveBroadcasts' && options.method === 'POST') {
      const id = `roomvid${String(broadcasts.size + 1).padStart(4, '0')}`;
      broadcasts.set(id, { id, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', lifeCycleStatus: 'ready' }, contentDetails: {} });
      return { id };
    }
    if (resource === 'liveBroadcasts/bind') {
      broadcasts.get(options.query.id).contentDetails.boundStreamId = options.query.streamId;
      return { id: options.query.id };
    }
    if (resource === 'liveBroadcasts') return { items: options.query.id.split(',').map(id => broadcasts.get(id)).filter(Boolean) };
    if (resource === 'videos') return { items: options.query.id.split(',').map(id => ({ id, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', uploadStatus: fx.state.processed ? 'processed' : 'uploaded' }, processingDetails: { processingStatus: fx.state.processed ? 'succeeded' : 'processing' } })) };
    if (resource === 'playlistItems') return options.method === 'POST' ? { id: 'item' } : { items: [] };
  } });
  delete fx.config.classes[0].streamId;
  fx.config.classes.push({ ...fx.config.classes[0], classId: '22222222-2222-4222-8222-222222222222', playlistId: 'playlist000002' });
  fx.config.rooms = [{ roomId: 'room-1', streamId: 'roomStream1' }, { roomId: 'room-2', streamId: 'roomStream2' }];
  validateConfig(fx.config);
  return { ...fx, broadcasts, first: { ...SESSION, roomId: 'room-1' }, second: { ...SESSION, classId: fx.config.classes[1].classId, sessionKey: 'next-class', roomId: 'room-1' } };
}

test('rooms separate physical streams from class playlists and require a known session room', t => {
  const fx = roomFixture(t);
  assert.doesNotThrow(() => validateConfig(fx.config));
  assert.equal(validateSession(fx.first, fx.config).roomId, 'room-1');
  assert.throws(() => validateSession(SESSION, fx.config), /SESSION_ROOM_REQUIRED/);
  assert.throws(() => validateSession({ ...SESSION, roomId: 'missing' }, fx.config), /UNKNOWN_ROOM/);
  assert.throws(() => validateSession({ ...SESSION, roomId: 'ROOM-1' }, fx.config), /INVALID_ROOM_ID/);
  const upper = structuredClone(fx.config); upper.rooms[1].roomId = 'ROOM-1';
  assert.throws(() => validateConfig(upper), /INVALID_ROOM_CONFIG/);
  fx.config.rooms[1].streamId = fx.config.rooms[0].streamId;
  assert.throws(() => validateConfig(fx.config), /DUPLICATE_streamId/);
});

test('a different class cannot reserve an occupied room before any external call', async t => {
  const fx = roomFixture(t); const first = await fx.worker.prepare(fx.first);
  fx.calls.length = 0;
  await assert.rejects(fx.worker.prepare(fx.second, { arm: true }), /ROOM_HAS_UNFINISHED_LIVE/);
  assert.equal(fx.calls.length, 0);
  fx.broadcasts.get(first.videoId).status.lifeCycleStatus = 'live';
  fx.advance(); await fx.worker.once(); fx.calls.length = 0;
  await assert.rejects(fx.worker.prepare(fx.second), /ROOM_HAS_UNFINISHED_LIVE/);
  assert.equal(fx.calls.length, 0);
});

test('ended class in processing releases its room while the next class uses its own playlist', async t => {
  const fx = roomFixture(t); const first = await fx.worker.prepare(fx.first);
  fx.broadcasts.get(first.videoId).status.lifeCycleStatus = 'complete'; fx.state.processed = false;
  fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'processing');
  const second = await fx.worker.prepare(fx.second, { arm: true });
  assert.notEqual(first.videoId, second.videoId);
  const binds = fx.calls.filter(call => call.resource === 'liveBroadcasts/bind');
  assert.deepEqual(binds.map(call => call.query.streamId), ['roomStream1', 'roomStream1']);
  const playlists = fx.calls.filter(call => call.resource === 'playlistItems' && call.method === 'POST');
  assert.deepEqual(playlists.map(call => call.body.snippet.playlistId), ['playlist000001', 'playlist000002']);
  assert.equal(second.activeSessionFile, path.join(fx.config.stateDir, 'active-room-room-1.json'));
});

test('separate physical rooms can prepare simultaneous classes with separate fixed streams', async t => {
  const fx = roomFixture(t);
  await fx.worker.prepare(fx.first);
  await fx.worker.prepare({ ...fx.second, roomId: 'room-2' });
  assert.deepEqual(fx.calls.filter(call => call.resource === 'liveBroadcasts/bind').map(call => call.query.streamId), ['roomStream1', 'roomStream2']);
});

test('room arming can switch classes before recording but in-use blocks both arm and prepare', async t => {
  const fx = roomFixture(t);
  const first = await fx.worker.arm(fx.first);
  const second = await fx.worker.arm(fx.second);
  assert.equal(first.activeSessionFile, second.activeSessionFile);
  assert.equal(JSON.parse(fs.readFileSync(second.activeSessionFile, 'utf8')).classId, fx.second.classId);
  fs.renameSync(second.activeSessionFile, `${second.activeSessionFile}.in-use`);
  const original = fs.readFileSync(`${second.activeSessionFile}.in-use`, 'utf8');
  await assert.rejects(fx.worker.arm(fx.first), /OBS_RECORDING_IN_PROGRESS/);
  await assert.rejects(fx.worker.prepare(fx.first, { arm: true }), /OBS_RECORDING_IN_PROGRESS/);
  assert.equal(fx.calls.length, 0);
  assert.equal(fs.readFileSync(`${second.activeSessionFile}.in-use`, 'utf8'), original);
  assert.equal(fs.existsSync(second.activeSessionFile), false);
});

test('recorded session room identity cannot be changed by arm, prepare, seal, or manifest replay', async t => {
  const fx = roomFixture(t);
  const manifestPath = await seal(fx.config, fx.first, fx.recording);
  assert.deepEqual(await fx.worker.ingest(), []);
  const changed = { ...fx.first, roomId: 'room-2' };
  await assert.rejects(fx.worker.arm(changed), /SESSION_ROOM_CONFLICT/);
  await assert.rejects(fx.worker.prepare(changed), /SESSION_ROOM_CONFLICT/);
  await assert.rejects(seal(fx.config, changed, fx.recording), /SESSION_ROOM_CONFLICT/);
  assert.equal(fx.calls.length, 0);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  atomic(manifestPath, { ...manifest, roomId: 'room-2' });
  assert.equal((await fx.worker.ingest())[0].error, 'SESSION_ROOM_CONFLICT');
  assert.equal(fx.worker.jobs()[0].roomId, 'room-1');
});

test('changing a saved room stream mapping cannot silently rebind a session', async t => {
  const fx = roomFixture(t); await fx.worker.prepare(fx.first);
  fx.config.rooms[0].streamId = 'changedStream'; fx.calls.length = 0;
  await assert.rejects(fx.worker.prepare(fx.first), /SESSION_STREAM_CONFIG_CHANGED/);
  assert.equal(fx.calls.length, 0);
});

test('legacy class stream configuration keeps the existing class active-file path', async t => {
  const fx = fixture(t);
  const result = await fx.worker.prepare(SESSION, { arm: true });
  assert.equal(result.activeSessionFile, path.join(fx.config.stateDir, `active-${SESSION.classId}.json`));
  const active = JSON.parse(fs.readFileSync(result.activeSessionFile, 'utf8'));
  assert.equal(active.streamId, 'stream001');
  assert.equal(Object.hasOwn(active, 'roomId'), false);
});
