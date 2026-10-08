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

test('a test broadcast ending before its scheduled start syncs its actual interval', async t => {
  for (const source of ['video', 'broadcast']) {
    const actualStartTime = '2026-09-27T23:40:00Z', actualEndTime = '2026-09-27T23:45:00Z';
    const fx = fixture(t, { request: async (resource, options, state) => {
      if (state.lifecycle !== 'complete') return;
      if (resource === 'videos') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL }, status: { privacyStatus: state.privacy, uploadStatus: 'processed' }, processingDetails: { processingStatus: 'succeeded' }, liveStreamingDetails: source === 'video' ? { actualStartTime, actualEndTime } : {} }] };
      if (resource === 'liveBroadcasts') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL, ...(source === 'broadcast' ? { actualStartTime, actualEndTime } : {}) }, status: { privacyStatus: state.privacy, lifeCycleStatus: state.lifecycle }, contentDetails: { boundStreamId: state.bound } }] };
    } });
    await fx.worker.prepare(SESSION);
    fx.worker.fetch = async (_url, options) => {
      const body = JSON.parse(options.body); fx.syncs.push(body);
      return new Response('{}', { status: Date.parse(body.ends_at) > Date.parse(body.starts_at) ? 200 : 400 });
    };
    fx.state.lifecycle = 'complete'; fx.advance();
    const result = await fx.worker.once();
    assert.deepEqual(result.failures, [], source);
    assert.equal(fx.syncs.at(-1).starts_at, actualStartTime, source);
    assert.equal(fx.syncs.at(-1).ends_at, actualEndTime, source);
    assert.equal(fx.worker.jobs()[0].status, 'ready');
  }
});

test('completed broadcasts wait for valid actual timestamps without inventing an interval', async t => {
  for (const timing of [
    {}, { actualEndTime: SESSION.endsAt }, { actualStartTime: SESSION.startsAt },
    { actualStartTime: 'invalid', actualEndTime: SESSION.endsAt },
    { actualStartTime: SESSION.endsAt, actualEndTime: SESSION.startsAt },
  ]) {
    let details = timing;
    const fx = fixture(t, { request: async (resource, _options, state) => {
      if (resource === 'videos' && state.lifecycle === 'complete') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL }, status: { privacyStatus: state.privacy, uploadStatus: 'processed' }, processingDetails: { processingStatus: 'succeeded' }, liveStreamingDetails: details }] };
    } });
    await fx.worker.prepare(SESSION);
    fx.state.lifecycle = 'complete'; fx.advance();
    const synced = fx.syncs.length;
    const result = await fx.worker.once();
    assert.equal(result.failures[0]?.error, 'BROADCAST_ACTUAL_TIMES_PENDING');
    assert.equal(fx.syncs.length, synced);
    assert.equal(fx.worker.jobs()[0].startsAt, SESSION.startsAt);
    assert.equal(fx.worker.jobs()[0].endsAt, SESSION.endsAt);
    assert.ok(fx.worker.jobs()[0].nextAttemptAt);
    details = { actualStartTime: SESSION.startsAt, actualEndTime: SESSION.endsAt };
    fx.advance();
    assert.deepEqual((await fx.worker.once()).failures, []);
    assert.equal(fx.worker.jobs()[0].status, 'ready');
  }
});

test('blocked originals reject sealing either replacement path without altering the original state', async t => {
  for (const flag of ['playbackBlocked', 'blockSyncError']) {
    for (const replacement of [false, true]) {
      const fx = fixture(t); await fx.worker.prepare(SESSION);
      const job = fx.worker.jobs()[0]; job.status = 'failed'; job[flag] = flag === 'playbackBlocked' ? true : 'SYNC_HTTP_503'; fx.worker.save(job);
      const original = fs.readFileSync(fx.worker.file(job), 'utf8');
      await assert.rejects(replacement ? fx.worker.replaceReplay(SESSION, fx.recording, { confirmedComplete: true })
        : seal(fx.config, SESSION, fx.recording, { fallback: true }), /BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY/);
      assert.equal(fs.readFileSync(fx.worker.file(job), 'utf8'), original);
      assert.equal(fs.readdirSync(fx.config.inboxDir).length, 0);
      assert.equal(fx.calls.filter(call => call.resource === 'raw').length, 0);
      assert.equal(fs.readFileSync(fx.recording, 'utf8'), 'closed recording');
    }
  }
});

test('a queued replacement cannot overwrite a later safety block and succeeds only after recovery', async t => {
  for (const flag of ['playbackBlocked', 'blockSyncError']) {
    for (const replacement of [false, true]) {
      const fx = fixture(t); await fx.worker.prepare(SESSION);
      const job = fx.worker.jobs()[0]; job.status = 'failed'; fx.worker.save(job);
      await seal(fx.config, SESSION, fx.recording, { fallback: true, replaceReplay: replacement, confirmedComplete: true });
      job[flag] = flag === 'playbackBlocked' ? true : 'SYNC_HTTP_503'; fx.worker.save(job);
      const original = fs.readFileSync(fx.worker.file(job), 'utf8');
      assert.equal((await fx.worker.ingest())[0]?.error, 'BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY');
      assert.equal(fs.readFileSync(fx.worker.file(job), 'utf8'), original);
      assert.equal(fx.calls.filter(call => call.resource === 'raw').length, 0);
      assert.equal(fs.readFileSync(fx.recording, 'utf8'), 'closed recording');
      delete job[flag]; fx.worker.save(job);
      assert.deepEqual(await fx.worker.ingest(), []);
      assert.equal(fx.worker.jobs()[0].source, 'upload');
      assert.equal(fx.worker.jobs()[0].replacedLiveVideoId, VIDEO);
    }
  }
});

test('saving a local backup for a blocked live preserves the block and does not replace its video', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  const job = fx.worker.jobs()[0]; job.playbackBlocked = true; fx.worker.save(job);
  await seal(fx.config, SESSION, fx.recording);
  assert.deepEqual(await fx.worker.ingest(), []);
  assert.equal(fx.worker.jobs()[0].source, 'live');
  assert.equal(fx.worker.jobs()[0].videoId, VIDEO);
  assert.equal(fx.worker.jobs()[0].playbackBlocked, true);
  assert.equal(fx.calls.filter(call => call.resource === 'raw').length, 0);
});

test('sync exposes only known conflicts and never returns arbitrary server error content', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  const job = fx.worker.jobs()[0], original = { ...job };
  let sequence = original.syncSequence;
  for (const [body, expected] of [
    [JSON.stringify({ error: { code: 'STALE_SYNC_SEQUENCE' } }), 'STALE_SYNC_SEQUENCE'],
    [JSON.stringify({ error: { code: 'SECRET_SERVER_DETAIL' } }), 'SYNC_HTTP_409'],
    ['not-json SECRET_SERVER_DETAIL', 'SYNC_HTTP_409'],
  ]) {
    fx.worker.fetch = async () => new Response(body, { status: 409 });
    await assert.rejects(fx.worker.sync(job, 'ready'), error => error.code === expected);
    assert.deepEqual(fx.worker.jobs()[0], { ...original, syncSequence: ++sequence });
  }
});

test('permanent sync rejection pauses durably and explicit reviewed retry preserves identity and sequence', async t => {
  for (const code of ['VIDEO_ALREADY_LINKED', 'SESSION_IDENTITY_CONFLICT', 'STALE_STATE', 'BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY']) {
    const fx = fixture(t); await fx.worker.prepare(SESSION);
    fx.state.lifecycle = 'live'; fx.advance();
    let attempts = 0;
    fx.worker.fetch = async () => { attempts++; return Response.json({ error: { code } }, { status: 409 }); };
    const result = await fx.worker.once();
    assert.equal(result.failures[0].error, code);
    assert.equal(result.paused[0].error, code);
    const job = fx.worker.jobs()[0];
    assert.equal(job.syncPaused.code, code); assert.equal(job.nextAttemptAt, undefined);
    assert.equal(job.syncSequence, 2); assert.equal(attempts, 1);
    const restarted = new Worker(fx.config, fx.dependencies);
    const called = fx.calls.length, synced = fx.syncs.length;
    fx.advance(24 * 60 * 60 * 1000);
    assert.equal((await restarted.once()).paused.length, 1);
    assert.equal(fx.calls.length, called); assert.equal(fx.syncs.length, synced);
    assert.equal(restarted.nextDelay(), restarted.pollInterval());
    await assert.rejects(restarted.prepare(SESSION), /SYNC_MANUAL_REVIEW_REQUIRED/);
    await assert.rejects(restarted.recover(SESSION, VIDEO), /SYNC_MANUAL_REVIEW_REQUIRED/);
    await assert.rejects(restarted.retrySync(SESSION, false), /SYNC_REVIEW_CONFIRMATION_REQUIRED/);
    assert.equal(restarted.jobs()[0].syncSequence, 2);
    assert.equal((await restarted.retrySync(SESSION, true)).retryQueued, true);
    assert.equal(restarted.jobs()[0].videoId, VIDEO); assert.equal(restarted.jobs()[0].syncSequence, 2);
    assert.equal(restarted.jobs()[0].lastError, code, 'manual acknowledgement is not successful sync');
    assert.deepEqual((await restarted.once()).failures, []);
    assert.equal(restarted.jobs()[0].syncSequence, 3); assert.equal(restarted.jobs()[0].syncPaused, undefined);
    assert.equal(restarted.jobs()[0].lastError, undefined);
  }
});

test('explicit nonretryable responses pause with a sanitized code while transient conflicts retry', async t => {
  for (const [status, body, paused] of [
    [409, { error: { code: 'SECRET_SERVER_DETAIL', retryable: false } }, true],
    [503, { error: { retryable: true } }, false],
    [409, { error: { code: 'STALE_SYNC_SEQUENCE' } }, false],
  ]) {
    const fx = fixture(t); await fx.worker.prepare(SESSION); fx.advance();
    fx.worker.fetch = async () => Response.json(body, { status });
    await fx.worker.once(); const job = fx.worker.jobs()[0];
    assert.equal(!!job.syncPaused, paused);
    assert.equal(!!job.nextAttemptAt, !paused);
    assert.doesNotMatch(JSON.stringify(job), /SECRET_SERVER_DETAIL/);
  }
});

test('early OBS completion ingests actual recording times and preserves independent live schedule', async t => {
  for (const existingLive of [false, true]) {
    const fx = fixture(t); if (existingLive) await fx.worker.prepare(SESSION);
    const startsAt = '2026-09-27T23:40:00Z', endsAt = '2026-09-27T23:45:00Z';
    atomic(path.join(fx.config.inboxDir, 'early.ready.json'), { ...SESSION, startsAt, endsAt, file: fx.recording, completion: 'obs-recording-stopped' });
    assert.deepEqual(await fx.worker.ingest(), []);
    const job = fx.worker.jobs()[0];
    assert.equal(job.recording.startsAt, startsAt); assert.equal(job.recording.endsAt, endsAt);
    assert.equal(job.source, existingLive ? 'live' : 'upload');
    assert.equal(job.startsAt, existingLive ? SESSION.startsAt : startsAt);
    assert.equal(job.endsAt, existingLive ? SESSION.endsAt : endsAt);
    assert.deepEqual(await fx.worker.ingest(), [], 'repeated scan remains idempotent');
    assert.equal(fs.readFileSync(fx.recording, 'utf8'), 'closed recording');
  }
});

test('upload initiation auth-refresh rejection clears pending, but an uncertain request preserves it', async t => {
  for (const status of [401, 0, 503]) {
    const fx = fixture(t, { raw: async () => { throw new ApiError(status === 401 ? 'YOUTUBE_AUTH_REFRESH_FAILED' : 'YOUTUBE_NETWORK_ERROR', status); } });
    await seal(fx.config, SESSION, fx.recording); await fx.worker.ingest();
    await assert.rejects(fx.worker.upload(fx.worker.jobs()[0]));
    const job = fx.worker.jobs()[0];
    assert.equal(!!job.createPending, status !== 401);
    assert.equal(job.videoId, undefined); assert.equal(job.uploadUrl, undefined);
    assert.equal(fs.readFileSync(fx.recording, 'utf8'), 'closed recording');
  }
});

test('paused live accepts its local backup but rejects queued replacement without erasing pause', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  const job = fx.worker.jobs()[0]; job.status = 'failed'; job.syncPaused = { code: 'VIDEO_ALREADY_LINKED', status: 409, at: SESSION.startsAt }; fx.worker.save(job);
  await seal(fx.config, SESSION, fx.recording); assert.deepEqual(await fx.worker.ingest(), []);
  assert.equal(fx.worker.jobs()[0].recording.file, fs.realpathSync(fx.recording));
  await seal(fx.config, SESSION, fx.recording, { fallback: true });
  assert.equal((await fx.worker.ingest())[0].error, 'SYNC_MANUAL_REVIEW_REQUIRED');
  assert.deepEqual(fx.worker.jobs()[0].syncPaused, job.syncPaused);
  assert.equal(fx.worker.jobs()[0].videoId, VIDEO);
});

test('sync sequence is saved before a lost response and advances after a worker restart', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  const job = fx.worker.jobs()[0], previousSync = job.syncedAt;
  assert.equal(job.syncSequence, 1); assert.equal(fx.syncs[0].sync_sequence, 1);
  fx.worker.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.sync_sequence, 2);
    assert.equal(JSON.parse(fs.readFileSync(fx.worker.file(job), 'utf8')).syncSequence, 2);
    throw new Error('response timed out after server acceptance');
  };
  await assert.rejects(fx.worker.sync(job, 'live'), /SYNC_NETWORK_ERROR/);
  assert.equal(fx.worker.jobs()[0].status, 'scheduled');
  assert.equal(fx.worker.jobs()[0].syncedAt, previousSync);
  const restarted = new Worker(fx.config, { ...fx.dependencies, fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body); fx.syncs.push(body);
    assert.equal(body.sync_sequence, 3);
    assert.equal(JSON.parse(fs.readFileSync(fx.worker.file(job), 'utf8')).syncSequence, 3);
    return new Response('{}');
  } });
  await restarted.sync(restarted.jobs()[0], 'live');
  assert.equal(restarted.jobs()[0].syncSequence, 3);
  assert.equal(restarted.jobs()[0].status, 'live');
});

test('live heartbeat, safety block, and unblock all use increasing request sequences', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'live'; fx.advance(); await fx.worker.once();
  fx.state.privacy = 'public'; fx.advance(); await fx.worker.once();
  assert.equal(fx.worker.jobs()[0].playbackBlocked, true);
  fx.state.privacy = 'unlisted'; fx.advance(); await fx.worker.once();
  assert.deepEqual(fx.syncs.map(row => row.sync_sequence), [1, 2, 3, 4]);
  assert.deepEqual(fx.syncs.map(row => row.playback_blocked), [false, false, true, false]);
  assert.equal(fx.worker.jobs()[0].syncSequence, 4);
});

test('fallback and full replay preserve the session sequence while replacing the upload job', async t => {
  for (const replacement of [false, true]) {
    const fx = fixture(t); await fx.worker.prepare(SESSION);
    const old = fx.worker.jobs()[0]; old.status = replacement ? 'ready' : 'failed'; old.syncSequence = 41; fx.worker.save(old);
    await seal(fx.config, SESSION, fx.recording, { fallback: true, replaceReplay: replacement, confirmedComplete: true });
    assert.deepEqual(await fx.worker.ingest(), []);
    assert.equal(fx.worker.jobs()[0].syncSequence, 41);
    assert.equal(fx.worker.jobs()[0].source, 'upload');
    assert.deepEqual((await fx.worker.once()).failures, []);
    assert.equal(fx.syncs.at(-1).sync_sequence, 42);
    assert.equal(fx.worker.jobs()[0].syncSequence, 42);
  }
});

test('legacy sequences start at one while invalid or exhausted sequences fail before sending', async t => {
  for (const initial of [undefined, 0]) {
    const fx = fixture(t), job = { ...SESSION, source: 'live', status: 'scheduled', videoId: VIDEO, syncSequence: initial };
    fx.worker.save(job); await fx.worker.sync(job, 'scheduled');
    assert.equal(fx.syncs[0].sync_sequence, 1); assert.equal(fx.worker.jobs()[0].syncSequence, 1);
  }
  for (const value of [null, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER]) {
    const fx = fixture(t), job = { ...SESSION, source: 'live', status: 'scheduled', videoId: VIDEO, syncSequence: value };
    fx.worker.save(job); const before = fs.readFileSync(fx.worker.file(job), 'utf8');
    const error = value === Number.MAX_SAFE_INTEGER ? /SYNC_SEQUENCE_EXHAUSTED/ : /SYNC_SEQUENCE_INVALID/;
    await assert.rejects(fx.worker.sync(job, 'scheduled'), error);
    await assert.rejects(fx.worker.prepare(SESSION), error);
    await assert.rejects(fx.worker.upload(job), error);
    assert.equal(fx.syncs.length, 0); assert.equal(fx.calls.length, 0);
    assert.equal(fs.readFileSync(fx.worker.file(job), 'utf8'), before);
  }
  const fx = fixture(t), job = { ...SESSION, source: 'live', status: 'scheduled', videoId: VIDEO, syncSequence: Number.MAX_SAFE_INTEGER - 1 };
  fx.worker.save(job); await fx.worker.sync(job, 'scheduled');
  assert.equal(fx.syncs[0].sync_sequence, Number.MAX_SAFE_INTEGER);
  await assert.rejects(fx.worker.sync(job, 'scheduled'), /SYNC_SEQUENCE_EXHAUSTED/);
  assert.equal(fx.syncs.length, 1);
});

test('prepare, recovery, and retry-create preserve request sequences; a new session starts at one', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  await fx.worker.prepare(SESSION); assert.equal(fx.worker.jobs()[0].syncSequence, 2);
  await fx.worker.recover(SESSION, VIDEO); assert.equal(fx.worker.jobs()[0].syncSequence, 2);
  const job = fx.worker.jobs()[0]; delete job.videoId; job.createPending = true; fx.worker.save(job);
  await fx.worker.retryCreate(SESSION, true); assert.equal(fx.worker.jobs()[0].syncSequence, 2);
  await fx.worker.prepare(SESSION); assert.equal(fx.worker.jobs()[0].syncSequence, 3);
  const ended = fx.worker.jobs()[0]; ended.status = 'ready'; fx.worker.save(ended);
  await fx.worker.prepare({ ...SESSION, sessionKey: 'next-separate-session' });
  assert.equal(fx.syncs.at(-1).sync_sequence, 1);
});

function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-classroom-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = {
    expectedChannelId: CHANNEL, stateDir: path.join(dir, 'state'), inboxDir: path.join(dir, 'inbox'), recordingsRoot: path.join(dir, 'recordings'),
    syncUrl: 'https://test.supabase.co/functions/v1/classroom-sync', anonKeyEnv: 'ANON',
    classes: [{ classId: SESSION.classId, playlistId: 'playlist000001', streamId: 'stream001', videoPrivacy: 'unlisted', syncKeyEnv: 'CLASS_KEY' }],
  };
  fs.mkdirSync(config.recordingsRoot);
  const calls = [], syncs = [], state = { privacy: 'unlisted', playlistPrivacy: 'unlisted', lifecycle: 'ready', processed: true, bound: 'stream001', playlistItems: false,
    streamStatus: 'active', streamHealth: 'good', streamIssues: [], reusable: true };
  const youtube = {
    async verifyIdentity() { calls.push({ resource: 'identity' }); },
    async request(resource, options = {}) {
      calls.push({ resource, ...options });
      if (overrides.request) {
        const custom = await overrides.request(resource, options, state);
        if (custom !== undefined) return custom;
      }
      if (resource === 'playlists') return { items: [{ snippet: { channelId: CHANNEL }, status: { privacyStatus: state.playlistPrivacy } }] };
      if (resource === 'liveStreams') return { items: options.query.id.split(',').map(id => ({ id, snippet: { channelId: CHANNEL },
        status: { streamStatus: state.streamStatus, healthStatus: { status: state.streamHealth, configurationIssues: state.streamIssues } }, contentDetails: { isReusable: state.reusable } })) };
      if (resource === 'liveBroadcasts' && options.method === 'POST') return { id: VIDEO };
      if (resource === 'liveBroadcasts') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL }, status: { privacyStatus: state.privacy, lifeCycleStatus: state.lifecycle }, contentDetails: { boundStreamId: state.bound } }] };
      if (resource === 'liveBroadcasts/bind') { state.bound = options.query.streamId; return { id: VIDEO }; }
      if (resource === 'videos') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL }, status: { privacyStatus: state.privacy, uploadStatus: state.processed ? 'processed' : 'uploaded' }, processingDetails: { processingStatus: state.processed ? 'succeeded' : 'processing' }, liveStreamingDetails: state.lifecycle === 'complete' ? { actualStartTime: SESSION.startsAt, actualEndTime: SESSION.endsAt } : {} }] };
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

test('full replay replacement requires confirmation, an ended live, and a closed recorder', async t => {
  const fx = fixture(t);
  await assert.rejects(fx.worker.replaceReplay(SESSION, fx.recording), /COMPLETE_RECORDING_CONFIRMATION_REQUIRED/);
  await assert.rejects(fx.worker.replaceReplay(SESSION, fx.recording, { confirmedComplete: true }), /REPLAY_REQUIRES_ENDED_LIVE/);
  await fx.worker.prepare(SESSION);
  await assert.rejects(fx.worker.replaceReplay(SESSION, fx.recording, { confirmedComplete: true }), /REPLAY_REQUIRES_ENDED_LIVE/);
  const job = fx.worker.jobs()[0]; job.status = 'ready'; fx.worker.save(job);
  fs.writeFileSync(`${fx.worker.activeFile(SESSION)}.in-use`, 'recording');
  await assert.rejects(fx.worker.replaceReplay(SESSION, fx.recording, { confirmedComplete: true }), /OBS_RECORDING_IN_PROGRESS/);
  assert.equal(fs.readdirSync(fx.config.inboxDir).length, 0);
});

test('confirmed full replay replaces a ready archive once and preserves the old backup across restarts', async t => {
  const replacementVideo = 'video000002';
  const fx = fixture(t, {
    raw: async (_url, options) => options.method === 'POST'
      ? new Response(null, { headers: { location: 'https://www.googleapis.com/upload/replacement' } })
      : options.headers['content-range'].startsWith('bytes */') ? new Response(null, { status: 308 }) : Response.json({ id: replacementVideo }),
    request: async (resource, options) => resource === 'videos' && options.query.id === replacementVideo
      ? { items: [{ id: replacementVideo, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', uploadStatus: 'processed' }, processingDetails: { processingStatus: 'succeeded' } }] } : undefined,
  });
  await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'complete'; fx.advance(); await fx.worker.once();
  assert.equal(fx.worker.jobs()[0].status, 'ready');
  await seal(fx.config, SESSION, fx.recording);
  assert.deepEqual(await fx.worker.ingest(), []);
  const full = path.join(fx.config.recordingsRoot, 'complete-lesson.mkv');
  fs.writeFileSync(full, 'operator-verified full recording');
  const first = await fx.worker.replaceReplay(SESSION, full, { confirmedComplete: true });
  assert.deepEqual(await fx.worker.replaceReplay(SESSION, full, { confirmedComplete: true }), first);
  assert.equal((await fx.worker.once()).failures.length, 0);
  assert.equal(fx.syncs.at(-1).youtube_video_id, replacementVideo);
  assert.equal(fx.syncs.at(-1).replace_replay, true);
  assert.equal(fx.syncs.at(-1).source, 'upload');
  const job = fx.worker.jobs()[0];
  assert.equal(job.replacedLiveVideoId, VIDEO);
  assert.equal(job.supersededRecording.file, fs.realpathSync(fx.recording));
  assert.equal(job.status, 'ready');
  const restarted = new Worker(fx.config, fx.dependencies);
  assert.equal((await restarted.once()).failures.length, 0);
  assert.deepEqual(await restarted.replaceReplay(SESSION, full, { confirmedComplete: true }), first);
  assert.equal(fx.calls.filter(call => call.resource === 'raw' && call.method === 'POST').length, 1);
  assert.ok(fs.existsSync(fx.recording)); assert.ok(fs.existsSync(full));
  assert.equal(fs.readdirSync(fx.config.inboxDir).filter(file => file.endsWith('.ready.json')).length, 2);
});

test('a full replay manifest cannot replace an active live and changed sealed bytes never upload', async t => {
  const fx = fixture(t);
  await fx.worker.prepare(SESSION);
  const job = fx.worker.jobs()[0]; job.status = 'ready'; fx.worker.save(job);
  const { manifest } = await fx.worker.replaceReplay(SESSION, fx.recording, { confirmedComplete: true });
  job.status = 'live'; fx.worker.save(job);
  assert.equal((await fx.worker.ingest())[0].error, 'REPLAY_REQUIRES_ENDED_LIVE');
  job.status = 'ready'; fx.worker.save(job);
  fs.appendFileSync(fx.recording, 'changed');
  assert.equal((await fx.worker.ingest())[0].error, 'SEALED_RECORDING_CHANGED');
  assert.ok(fs.existsSync(manifest));
  assert.equal(fx.calls.filter(call => call.resource === 'raw').length, 0);
});

test('a queued fallback cannot silently take priority over an accepted full replay', async t => {
  const fx = fixture(t);
  await fx.worker.prepare(SESSION);
  const job = fx.worker.jobs()[0]; job.status = 'failed'; fx.worker.save(job);
  const fallbackManifest = await seal(fx.config, SESSION, fx.recording, { fallback: true });
  const full = path.join(fx.config.recordingsRoot, 'complete.mkv'); fs.writeFileSync(full, 'complete lesson');
  await assert.rejects(fx.worker.replaceReplay(SESSION, full, { confirmedComplete: true }), /PENDING_FALLBACK_REQUIRES_REVIEW/);
  assert.equal(fs.readdirSync(fx.config.inboxDir).filter(file => file.endsWith('.replacement.ready.json')).length, 0);
  assert.equal(fx.worker.jobs()[0].source, 'live');
  assert.ok(fs.existsSync(fallbackManifest));
  // After operator review and archiving the earlier request, queue the full replay.
  fs.renameSync(fallbackManifest, `${fallbackManifest}.operator-archived`);
  await fx.worker.replaceReplay(SESSION, full, { confirmedComplete: true });
  assert.deepEqual(await fx.worker.ingest(), []);
  assert.equal(fx.worker.jobs()[0].recording.file, fs.realpathSync(full));
  assert.equal(fx.worker.jobs()[0].replaceReplay, true);
  assert.ok(fs.existsSync(fx.recording));
});

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
  assert.ok(fx.syncs.every(item => item.status === 'processing' && item.playback_blocked === true));
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
  fx.state.lifecycle = 'ready'; // A newly created broadcast is independent of the ended one.
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

test('steady four-class heartbeat batches video, broadcast, and fresh stream health into three GETs', async t => {
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
  assert.equal(fx.calls.length, 3);
  assert.deepEqual(fx.calls.map(call => call.resource).sort(), ['liveBroadcasts', 'liveStreams', 'videos']);
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
    if (resource === 'videos') return { items: options.query.id.split(',').map(id => ({ id, snippet: { channelId: CHANNEL }, status: { privacyStatus: 'unlisted', uploadStatus: fx.state.processed ? 'processed' : 'uploaded' }, processingDetails: { processingStatus: fx.state.processed ? 'succeeded' : 'processing' }, liveStreamingDetails: broadcasts.get(id)?.status.lifeCycleStatus === 'complete' ? { actualStartTime: SESSION.startsAt, actualEndTime: SESSION.endsAt } : {} })) };
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

test('temporary privacy failure blocks playback without terminalizing live, then recovers on the next poll', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'live'; fx.advance(); await fx.worker.once();
  fx.state.privacy = 'public'; fx.advance();
  assert.equal((await fx.worker.once()).failures[0].error, 'VIDEO_NOT_OWNED_EXPECTED_PRIVACY');
  assert.equal(fx.syncs.at(-1).status, 'live'); assert.equal(fx.syncs.at(-1).playback_blocked, true);
  const blocked = fx.worker.jobs()[0];
  assert.equal(blocked.status, 'live'); assert.equal(blocked.playbackBlocked, true);
  assert.ok(blocked.nextAttemptAt); assert.equal(fx.worker.nextDelay(), 60000);
  fx.state.privacy = 'unlisted'; fx.advance();
  const result = await fx.worker.once();
  assert.equal(result.failures.length, 0); assert.equal(result.results[0].status, 'live');
  assert.equal(fx.syncs.at(-1).playback_blocked, false);
  assert.equal(fx.worker.jobs()[0].playbackBlocked, false);
  assert.equal(fx.worker.jobs()[0].lastError, undefined);
  assert.ok(fx.syncs.every(row => row.status !== 'failed'));
});

test('a ready replay with temporary privacy damage is rechecked promptly and recovers without a lifecycle reset', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'complete'; fx.advance(); await fx.worker.once();
  assert.equal(fx.worker.jobs()[0].status, 'ready');
  fx.state.privacy = 'public'; fx.advance(24 * 60 * 60 * 1000); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'ready'); assert.equal(fx.syncs.at(-1).playback_blocked, true);
  assert.equal(fx.worker.nextDelay(), 60000);
  fx.state.privacy = 'unlisted'; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'ready'); assert.equal(fx.syncs.at(-1).playback_blocked, false);
});

test('changed broadcast binding is blocked and can recover on the same live video', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'live'; fx.advance(); await fx.worker.once();
  fx.state.bound = 'differentStream'; fx.advance();
  assert.equal((await fx.worker.once()).failures[0].error, 'LIVE_MAPPING_INVALID');
  assert.equal(fx.syncs.at(-1).status, 'live'); assert.equal(fx.syncs.at(-1).playback_blocked, true);
  fx.state.bound = 'stream001'; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).status, 'live'); assert.equal(fx.syncs.at(-1).playback_blocked, false);
  assert.equal(new Set(fx.syncs.map(row => row.youtube_video_id)).size, 1);
});

test('failed block sync retains the local playback block and retries safely', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'live'; fx.advance(); await fx.worker.once();
  const fetch = fx.worker.fetch;
  fx.worker.fetch = async () => new Response('{}', { status: 503 });
  fx.state.privacy = 'public'; fx.advance(); await fx.worker.once();
  const blocked = fx.worker.jobs()[0];
  assert.equal(blocked.status, 'live'); assert.equal(blocked.playbackBlocked, true);
  assert.equal(blocked.blockSyncError, 'SYNC_HTTP_503');
  fx.worker.fetch = fetch; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).playback_blocked, true);
  fx.state.privacy = 'unlisted'; fx.advance(); await fx.worker.once();
  assert.equal(fx.syncs.at(-1).playback_blocked, false);
  assert.equal(fx.worker.jobs()[0].blockSyncError, undefined);
});

test('verify permits idle classrooms without input, but refuses non-reusable or invalid streams before creation', async t => {
  const fx = fixture(t); fx.state.streamStatus = 'inactive'; fx.state.streamHealth = 'noData';
  const verified = await fx.worker.verify();
  assert.equal(verified.streamChecks[0].streamStatus, 'inactive');
  assert.equal(verified.streamChecks[0].healthStatus, 'noData');
  await assert.doesNotReject(fx.worker.prepare(SESSION));
  fx.state.reusable = false; fx.calls.length = 0;
  await assert.rejects(fx.worker.verify(), /STREAM_NOT_REUSABLE/);
  await assert.rejects(fx.worker.prepare(SESSION), /STREAM_NOT_REUSABLE/);
  assert.equal(fx.calls.filter(call => call.method === 'POST').length, 0);
  fx.state.reusable = undefined;
  await assert.rejects(fx.worker.verify(), /STREAM_REUSABLE_UNKNOWN/);
  fx.state.reusable = true; fx.state.streamStatus = 'error';
  await assert.rejects(fx.worker.verify(), /STREAM_ERROR/);
  fx.state.streamStatus = 'created';
  await assert.rejects(fx.worker.verify(), /STREAM_NOT_READY/);
});

test('live health is checked each polling cycle and blocks missing audio, lost input, or absent health data', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'live'; fx.advance(); await fx.worker.once();
  const cases = [
    { streamStatus: 'error', streamHealth: 'good', streamIssues: [], code: 'STREAM_ERROR' },
    { streamStatus: 'active', streamHealth: 'bad', streamIssues: [{ type: 'noAudioStream', severity: 'error' }], code: 'STREAM_HEALTH_ERROR' },
    { streamStatus: 'inactive', streamHealth: 'noData', streamIssues: [], code: 'STREAM_NOT_ACTIVE' },
    { streamStatus: 'active', streamHealth: 'noData', streamIssues: [], code: 'STREAM_HEALTH_NO_DATA' },
  ];
  for (const sample of cases) {
    Object.assign(fx.state, sample); fx.calls.length = 0; fx.advance();
    const failed = await fx.worker.once();
    assert.equal(failed.failures[0].error, sample.code);
    assert.equal(fx.calls.filter(call => call.resource === 'liveStreams').length, 1);
    assert.equal(fx.syncs.at(-1).status, 'live'); assert.equal(fx.syncs.at(-1).playback_blocked, true);
    assert.equal(fx.worker.jobs()[0].streamHealth.healthStatus, sample.streamHealth);
    Object.assign(fx.state, { streamStatus: 'active', streamHealth: 'good', streamIssues: [] }); fx.advance();
    assert.equal((await fx.worker.once()).failures.length, 0);
    assert.equal(fx.syncs.at(-1).playback_blocked, false);
  }
  fx.state.streamHealth = 'ok'; fx.state.streamIssues = [{ type: 'videoBitrateLow', severity: 'warning' }]; fx.advance();
  assert.equal((await fx.worker.once()).failures.length, 0);
  assert.equal(fx.worker.jobs()[0].streamHealth.issues[0].severity, 'warning');
});

test('finished replays do not depend on the input health of the next class using the room', async t => {
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'complete'; fx.advance(); await fx.worker.once();
  fx.state.streamStatus = 'error'; fx.state.streamHealth = 'bad';
  fx.advance(24 * 60 * 60 * 1000);
  assert.equal((await fx.worker.once()).failures.length, 0);
  assert.equal(fx.syncs.at(-1).status, 'ready'); assert.equal(fx.syncs.at(-1).playback_blocked, false);
});

test('shared metadata failure persists exponential backoff and diagnostic state across worker restart', async t => {
  let outage = false;
  const fx = fixture(t, { request: async resource => { if (outage && resource === 'videos') throw new ApiError('YOUTUBE_HTTP_503', 503); } });
  await fx.worker.prepare(SESSION); fx.state.lifecycle = 'live'; fx.advance(); await fx.worker.once();
  outage = true; fx.advance();
  const failed = await fx.worker.once();
  assert.equal(failed.failures[0].error, 'YOUTUBE_HTTP_503');
  let job = fx.worker.jobs()[0];
  assert.equal(job.attempts, 1); assert.equal(job.lastError, 'YOUTUBE_HTTP_503'); assert.ok(job.lastAttemptAt);
  assert.equal(fx.worker.nextDelay(), 10000);
  const restarted = new Worker(fx.config, fx.dependencies), calls = fx.calls.length;
  fx.advance(1000); assert.deepEqual(await restarted.once(), { results: [], failures: [] });
  assert.equal(fx.calls.length, calls); assert.equal(restarted.nextDelay(), 9000);
  fx.advance(9000); await restarted.once();
  assert.equal(restarted.jobs()[0].attempts, 2); assert.equal(restarted.nextDelay(), 20000);
  outage = false; fx.advance(20000);
  assert.equal((await restarted.once()).failures.length, 0);
  job = restarted.jobs()[0]; assert.equal(job.status, 'live'); assert.equal(job.attempts, 0); assert.equal(job.lastError, undefined);
});

test('prepare refuses a finished broadcast instead of arming an already ended lesson', async t => {
  for (const terminal of ['complete', 'revoked']) {
    const fx = fixture(t); await fx.worker.prepare(SESSION);
    fx.state.lifecycle = terminal; fx.calls.length = 0;
    await assert.rejects(fx.worker.prepare(SESSION, { arm: true }), /BROADCAST_ALREADY_ENDED/);
    assert.equal(fx.calls.filter(call => call.method === 'POST').length, 0);
    assert.equal(fs.existsSync(fx.worker.activeFile(SESSION)), false);
  }
  const fx = fixture(t); await fx.worker.prepare(SESSION);
  fx.state.lifecycle = 'complete'; fx.advance(); await fx.worker.once(); fx.calls.length = 0;
  await assert.rejects(fx.worker.prepare(SESSION), /BROADCAST_ALREADY_ENDED/);
  assert.equal(fx.calls.length, 0);
});

test('prepare checks actual video end time even if broadcast lifecycle has not caught up', async t => {
  let ended = false;
  const fx = fixture(t, { request: async (resource, options) => {
    if (ended && resource === 'videos') return { items: [{ id: VIDEO, snippet: { channelId: CHANNEL },
      status: { privacyStatus: 'unlisted', uploadStatus: 'processed' }, liveStreamingDetails: { actualEndTime: SESSION.endsAt } }] };
  } });
  await fx.worker.prepare(SESSION); ended = true; fx.calls.length = 0;
  await assert.rejects(fx.worker.prepare(SESSION, { arm: true }), /BROADCAST_ALREADY_ENDED/);
  assert.equal(fs.existsSync(fx.worker.activeFile(SESSION)), false);
  assert.equal(fx.calls.filter(call => call.method === 'POST').length, 0);
});
