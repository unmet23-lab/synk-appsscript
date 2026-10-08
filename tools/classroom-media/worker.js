'use strict';

// No dependencies. Credentials and resumable URLs stay on the classroom PC.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readCredential, youtubeChannel, googleAccessToken } = require('../lib/sns-publisher');

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
// Lowercase also prevents active-file collisions on case-insensitive Windows.
const ROOM_ID = /^[a-z0-9_-]{1,60}$/;
const STREAM_ID = /^[A-Za-z0-9_-]{3,100}$/;
const REPO = path.resolve(__dirname, '../..');
const CHUNK = 8 * 1024 * 1024;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const key = session => crypto.createHash('sha256').update(`${session.classId}\n${session.sessionKey}`).digest('hex');
const inside = (root, file) => { const rel = path.relative(root, file); return !rel.startsWith('..') && !path.isAbsolute(rel); };

function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}

function validateConfig(config) {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(config.expectedChannelId || '')) throw new Error('EXPECTED_CHANNEL_ID_REQUIRED');
  const sync = new URL(config.syncUrl);
  if (sync.protocol !== 'https:' || sync.pathname !== '/functions/v1/classroom-sync' || sync.search || sync.username || sync.password) throw new Error('INVALID_SYNC_URL');
  if (!config.anonKeyEnv || !Array.isArray(config.classes) || !config.classes.length) throw new Error('INVALID_CONFIG');
  for (const field of ['stateDir', 'inboxDir', 'recordingsRoot']) {
    if (!path.isAbsolute(config[field] || '') || inside(REPO, path.resolve(config[field]))) throw new Error(`${field}_MUST_BE_OUTSIDE_REPO`);
  }
  const seen = { classId: new Set(), playlistId: new Set(), streamId: new Set(), roomId: new Set() };
  if (config.rooms !== undefined && (!Array.isArray(config.rooms) || !config.rooms.length)) throw new Error('INVALID_ROOMS_CONFIG');
  for (const room of config.rooms || []) {
    if (!ROOM_ID.test(room.roomId || '') || !STREAM_ID.test(room.streamId || '')) throw new Error('INVALID_ROOM_CONFIG');
    for (const field of ['roomId', 'streamId']) {
      if (seen[field].has(room[field])) throw new Error(`DUPLICATE_${field}`);
      seen[field].add(room[field]);
    }
  }
  for (const cls of config.classes) {
    if (!UUID.test(cls.classId || '') || !/^[A-Za-z0-9_-]{10,100}$/.test(cls.playlistId || '') || (!config.rooms?.length && !cls.streamId) || (cls.streamId !== undefined && !STREAM_ID.test(cls.streamId)) || !cls.syncKeyEnv || !['private', 'unlisted'].includes(cls.videoPrivacy)) throw new Error('INVALID_CLASS_CONFIG');
    for (const field of ['classId', 'playlistId', ...(cls.streamId ? ['streamId'] : [])]) {
      if (seen[field].has(cls[field])) throw new Error(`DUPLICATE_${field}`);
      seen[field].add(cls[field]);
    }
  }
  return config;
}

function validateSession(session, config) {
  if (!config.classes.some(c => c.classId === session.classId)) throw new Error('UNKNOWN_CLASS');
  if (!/^[\w.:+-]{1,120}$/.test(session.sessionKey || '') || typeof session.title !== 'string' || !session.title.trim() || [...session.title].length > 100 || /[<>]/.test(session.title)) throw new Error('INVALID_SESSION');
  for (const field of ['startsAt', 'endsAt']) {
    if (field === 'endsAt' && session[field] == null) continue;
    if (typeof session[field] !== 'string' || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(session[field]) || !Number.isFinite(Date.parse(session[field]))) throw new Error(`INVALID_${field}`);
  }
  if (session.endsAt && Date.parse(session.endsAt) <= Date.parse(session.startsAt)) throw new Error('INVALID_END_TIME');
  binding(session, config);
  return { classId: session.classId, sessionKey: session.sessionKey, ...(session.roomId ? { roomId: session.roomId } : {}), title: session.title, startsAt: session.startsAt, endsAt: session.endsAt || null };
}

function binding(session, config) {
  const cls = config.classes.find(c => c.classId === session.classId);
  if (!cls) throw new Error('UNKNOWN_CLASS');
  let streamId;
  if (session.roomId !== undefined && session.roomId !== null) {
    if (typeof session.roomId !== 'string' || !ROOM_ID.test(session.roomId)) throw new Error('INVALID_ROOM_ID');
    const room = config.rooms?.find(r => r.roomId === session.roomId);
    if (!room) throw new Error('UNKNOWN_ROOM');
    streamId = room.streamId;
  } else {
    if (!cls.streamId) throw new Error('SESSION_ROOM_REQUIRED');
    streamId = cls.streamId;
  }
  if (session.streamId && session.streamId !== streamId) throw new Error('SESSION_STREAM_CONFIG_CHANGED');
  return streamId;
}

function sameRoom(previous, session, config) {
  if ((previous.roomId || null) !== (session.roomId || null) || binding(previous, config) !== binding(session, config)) throw new Error('SESSION_ROOM_CONFLICT');
}

async function fingerprint(file, root) {
  const realFile = fs.realpathSync(file), realRoot = fs.realpathSync(root);
  if (!inside(realRoot, realFile)) throw new Error('RECORDING_OUTSIDE_ROOT');
  const before = fs.statSync(realFile);
  if (!before.isFile() || before.size <= 0) throw new Error('EMPTY_RECORDING');
  const hash = crypto.createHash('sha256');
  for await (const bytes of fs.createReadStream(realFile)) hash.update(bytes);
  const after = fs.statSync(realFile);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('RECORDING_STILL_CHANGING');
  return { file: realFile, size: after.size, mtimeMs: after.mtimeMs, sha256: hash.digest('hex') };
}

// Call only from a recording-completed event / after the recorder has closed the file.
async function seal(config, session, file, { fallback = false, replaceReplay = false, confirmedComplete = false } = {}) {
  const valid = validateSession(session, config);
  if (!valid.endsAt) throw new Error('RECORDING_END_TIME_REQUIRED');
  const stateFile = path.join(config.stateDir, `${key(valid)}.json`);
  const previousJob = fs.existsSync(stateFile) ? read(stateFile) : null;
  if (previousJob) sameRoom(previousJob, valid, config);
  if ((fallback || replaceReplay) && (previousJob?.playbackBlocked || previousJob?.blockSyncError)) throw new Error('BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY');
  if (replaceReplay) {
    if (!confirmedComplete) throw new Error('COMPLETE_RECORDING_CONFIRMATION_REQUIRED');
    const retry = previousJob?.source === 'upload' && previousJob.replaceReplay;
    if (!retry && !(previousJob?.source === 'live' && ['processing', 'ready', 'failed'].includes(previousJob.status))) throw new Error('REPLAY_REQUIRES_ENDED_LIVE');
    // Preserve an earlier fallback for operator review before accepting a full
    // replay; inbox filename order must not silently choose a partial recording.
    if (!retry && fs.existsSync(path.join(config.inboxDir, `${key(valid)}.fallback.ready.json`))) throw new Error('PENDING_FALLBACK_REQUIRES_REVIEW');
    const active = path.join(config.stateDir, valid.roomId ? `active-room-${valid.roomId}.json` : `active-${valid.classId}.json`);
    if (fs.existsSync(`${active}.in-use`)) throw new Error('OBS_RECORDING_IN_PROGRESS');
    fallback = true;
  }
  const recording = await fingerprint(file, config.recordingsRoot);
  const manifest = { ...valid, ...recording, fallback, ...(replaceReplay ? { replaceReplay: true } : {}), completion: 'recorder-closed' };
  const target = path.join(config.inboxDir, `${key(valid)}${replaceReplay ? '.replacement' : fallback ? '.fallback' : ''}.ready.json`);
  if (fs.existsSync(target)) {
    const previous = read(target);
    sameRoom(previous, valid, config);
    if (previous.sha256 !== recording.sha256 || previous.fallback !== fallback || !!previous.replaceReplay !== replaceReplay || path.resolve(previous.file) !== path.resolve(recording.file)) throw new Error('MANIFEST_ALREADY_EXISTS');
  } else atomic(target, manifest);
  return target;
}

class ApiError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}

function nextSyncSequence(job) {
  const current = job.syncSequence === undefined ? 0 : job.syncSequence;
  if (!Number.isSafeInteger(current) || current < 0) throw new ApiError('SYNC_SEQUENCE_INVALID');
  if (current === Number.MAX_SAFE_INTEGER) throw new ApiError('SYNC_SEQUENCE_EXHAUSTED');
  return current + 1;
}

class YouTube {
  constructor(config, { fetchImpl = fetch, credential } = {}) { this.config = config; this.fetch = fetchImpl; this.credential = credential; }
  async verifyIdentity() {
    this.credential ||= readCredential(this.config.credentialAccount || 'lab-youtube', { allowLegacy: false });
    if (!this.credential) throw new ApiError('YOUTUBE_CREDENTIAL_MISSING');
    const { channel, token } = await youtubeChannel(this.credential, this.fetch);
    if (channel.id !== this.config.expectedChannelId) throw new ApiError('CHANNEL_MISMATCH');
    this.token = token.accessToken; this.tokenAt = Date.now();
  }
  async headers() {
    if (!this.token) await this.verifyIdentity();
    if (Date.now() - this.tokenAt > 40 * 60 * 1000) {
      this.token = (await googleAccessToken(this.credential, this.fetch)).accessToken; this.tokenAt = Date.now();
    }
    return { authorization: `Bearer ${this.token}` };
  }
  async raw(url, options = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.googleapis.com' || parsed.username || parsed.password) throw new ApiError('UNSAFE_GOOGLE_URL');
    try { return await this.fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { ...await this.headers(), ...options.headers } }); }
    catch { throw new ApiError('YOUTUBE_NETWORK_ERROR'); }
  }
  async request(resource, { method = 'GET', query = {}, body } = {}) {
    const url = `https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams(query)}`;
    const response = await this.raw(url, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new ApiError(`YOUTUBE_HTTP_${response.status}`, response.status);
    return response.json();
  }
}

class Worker {
  constructor(config, { youtube, fetchImpl = fetch, env = process.env, now = () => Date.now() } = {}) {
    this.config = validateConfig(config); this.yt = youtube || new YouTube(config, { fetchImpl }); this.fetch = fetchImpl; this.env = env; this.now = now;
    this.verifiedFiles = new Map();
    this.classVerifiedAt = new Map(); this.streamVerifiedAt = new Map(); this.identityVerifiedAt = null;
    this.videoSnapshot = new Map(); this.broadcastSnapshot = new Map(); this.streamSnapshot = new Map();
    this.verifiedStreams = new Map();
    fs.mkdirSync(config.stateDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(config.inboxDir, { recursive: true, mode: 0o700 });
  }
  file(session) { return path.join(this.config.stateDir, `${key(session)}.json`); }
  save(job) { atomic(this.file(job), job); }
  cls(job) { const cls = this.config.classes.find(c => c.classId === job.classId); if (!cls) throw new ApiError('UNKNOWN_CLASS'); return cls; }
  stream(job) { return binding(job, this.config); }
  activeFile(session) { return path.join(this.config.stateDir, session.roomId ? `active-room-${session.roomId}.json` : `active-${session.classId}.json`); }
  assertRoomAvailable(session) {
    if (fs.existsSync(`${this.activeFile(session)}.in-use`)) throw new ApiError('OBS_RECORDING_IN_PROGRESS');
    const streamId = this.stream(session);
    for (const other of this.jobs()) {
      if (key(other) === key(session)) { sameRoom(other, session, this.config); continue; }
      if (other.source === 'live' && !['processing', 'ready', 'failed'].includes(other.status) && this.stream(other) === streamId) {
        throw new ApiError(session.roomId ? 'ROOM_HAS_UNFINISHED_LIVE' : 'CLASS_HAS_UNFINISHED_LIVE');
      }
    }
  }
  armUnlocked(session) {
    const valid = validateSession(session, this.config);
    this.assertRoomAvailable(valid);
    const existing = fs.existsSync(this.file(valid)) ? read(this.file(valid)) : null;
    if (existing?.recording || existing?.status === 'ready') throw new ApiError('SESSION_RECORDING_ALREADY_COMPLETED');
    const target = this.activeFile(valid);
    atomic(target, { ...valid, streamId: this.stream(valid), manifestName: key(valid) });
    // OBS may atomically claim the previous active file between our first check
    // and this write. Never leave another class armed beside its in-use snapshot.
    if (fs.existsSync(`${target}.in-use`)) {
      if (fs.existsSync(target) && read(target).manifestName === key(valid)) fs.unlinkSync(target);
      throw new ApiError('OBS_RECORDING_IN_PROGRESS');
    }
    return { armed: true, activeSessionFile: target, inboxDir: this.config.inboxDir };
  }
  async arm(session) { return this.locked(async () => this.armUnlocked(session)); }
  async replaceReplay(session, file, { confirmedComplete = false } = {}) {
    return this.locked(async () => ({ manifest: await seal(this.config, session, file, { replaceReplay: true, confirmedComplete }) }));
  }
  async locked(task) {
    const lock = path.join(this.config.stateDir, 'worker.lock');
    let fd;
    try { fd = fs.openSync(lock, 'wx', 0o600); } catch { throw new ApiError('WORKER_LOCKED_CHECK_PID_BEFORE_REMOVING_LOCK'); }
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date(this.now()).toISOString() }));
    try { return await task(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  async ensureIdentity(force = false) {
    if (!force && this.identityVerifiedAt !== null && this.now() - this.identityVerifiedAt < 10 * 60 * 1000) return;
    await this.yt.verifyIdentity(); this.identityVerifiedAt = this.now();
  }
  async verifyClass(cls, force = false) {
    const verifiedAt = this.classVerifiedAt.get(cls.classId);
    if (!force && verifiedAt !== undefined && this.now() - verifiedAt < 10 * 60 * 1000) return;
    const playlist = (await this.yt.request('playlists', { query: { part: 'snippet,status', id: cls.playlistId } })).items?.[0];
    if (playlist?.snippet?.channelId !== this.config.expectedChannelId || playlist?.status?.privacyStatus !== 'unlisted') throw new ApiError('PLAYLIST_NOT_OWNED_UNLISTED');
    this.classVerifiedAt.set(cls.classId, this.now());
  }
  async verifyStream(streamId, force = false, { requireActive = false } = {}) {
    const verifiedAt = this.streamVerifiedAt.get(streamId);
    const cached = !force && verifiedAt !== undefined && this.now() - verifiedAt < 10 * 60 * 1000;
    const stream = this.streamSnapshot.has(streamId) ? this.streamSnapshot.get(streamId)
      : cached ? this.verifiedStreams.get(streamId)
        : (await this.yt.request('liveStreams', { query: { part: 'snippet,status,contentDetails', id: streamId } })).items?.[0];
    const details = { streamStatus: stream?.status?.streamStatus || 'unknown', healthStatus: stream?.status?.healthStatus?.status || 'noData',
      reusable: stream?.contentDetails?.isReusable ?? null, checkedAt: new Date(this.now()).toISOString(),
      issues: (stream?.status?.healthStatus?.configurationIssues || []).map(issue => ({ type: issue.type, severity: issue.severity })) };
    const reject = code => { const error = new ApiError(code); error.streamHealth = details; throw error; };
    if (stream?.snippet?.channelId !== this.config.expectedChannelId) reject('STREAM_NOT_OWNED');
    if (details.reusable !== true) reject(details.reusable === false ? 'STREAM_NOT_REUSABLE' : 'STREAM_REUSABLE_UNKNOWN');
    if (details.streamStatus === 'error') reject('STREAM_ERROR');
    if (details.streamStatus === 'created') reject('STREAM_NOT_READY');
    if (details.healthStatus === 'bad' || details.issues.some(issue => issue.severity === 'error')) reject('STREAM_HEALTH_ERROR');
    // An idle classroom has no media yet. Once YouTube calls the broadcast live,
    // receiving input and current health data are both required for its heartbeat.
    if (requireActive && details.streamStatus !== 'active') reject('STREAM_NOT_ACTIVE');
    if (requireActive && !['good', 'ok'].includes(details.healthStatus)) reject('STREAM_HEALTH_NO_DATA');
    if (!['active', 'inactive', 'ready'].includes(details.streamStatus)) reject('STREAM_STATUS_UNKNOWN');
    this.verifiedStreams.set(streamId, stream);
    this.streamVerifiedAt.set(streamId, this.now());
    return details;
  }
  async verify() {
    this.streamSnapshot.clear();
    await this.ensureIdentity(true);
    for (const cls of this.config.classes) await this.verifyClass(cls, true);
    const streamChecks = [];
    for (const streamId of new Set([...(this.config.rooms || []).map(r => r.streamId), ...this.config.classes.map(c => c.streamId).filter(Boolean)])) streamChecks.push({ streamId, ...await this.verifyStream(streamId, true) });
    return { verifiedClasses: this.config.classes.length, verifiedRooms: this.config.rooms?.length || 0, streamChecks };
  }
  async sync(job, status, { playbackBlocked = false } = {}) {
    const cls = this.cls(job), secret = this.env[cls.syncKeyEnv], anon = this.env[this.config.anonKeyEnv];
    if (!secret || secret.length < 32 || !anon) throw new ApiError('SYNC_ENV_MISSING');
    // Reserve the sequence durably before sending. A lost response must never
    // cause the same request number to be reused after a retry or process restart.
    job.syncSequence = nextSyncSequence(job); this.save(job);
    const body = { class_id: job.classId, session_key: job.sessionKey, sync_sequence: job.syncSequence, title: job.title, starts_at: job.startsAt, ends_at: job.endsAt, status, playback_blocked: playbackBlocked, ...(job.replaceReplay ? { replace_replay: true } : {}), youtube_video_id: job.videoId, youtube_playlist_id: cls.playlistId, youtube_channel_id: this.config.expectedChannelId, youtube_privacy_status: cls.videoPrivacy, source: job.source };
    let response;
    try { response = await this.fetch(this.config.syncUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'content-type': 'application/json', apikey: anon, 'x-classroom-key': secret }, body: JSON.stringify(body) }); }
    catch { throw new ApiError('SYNC_NETWORK_ERROR'); }
    if (!response.ok) {
      // Only a known, non-sensitive server code may replace the generic error.
      const failure = response.status === 409 ? await response.json().catch(() => null) : null;
      const code = ['BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY', 'STALE_SYNC_SEQUENCE'].includes(failure?.error?.code)
        ? failure.error.code : `SYNC_HTTP_${response.status}`;
      throw new ApiError(code, response.status);
    }
    job.status = status; job.playbackBlocked = playbackBlocked; job.syncedAt = new Date(this.now()).toISOString(); this.save(job);
  }
  async video(job) {
    const video = this.videoSnapshot.has(job.videoId) ? this.videoSnapshot.get(job.videoId) : (await this.yt.request('videos', { query: { part: 'snippet,status,processingDetails,liveStreamingDetails', id: job.videoId } })).items?.[0];
    if (!video || video.snippet?.channelId !== this.config.expectedChannelId || video.status?.privacyStatus !== this.cls(job).videoPrivacy) throw new ApiError('VIDEO_NOT_OWNED_EXPECTED_PRIVACY');
    return video;
  }
  async broadcast(job) {
    return this.broadcastSnapshot.has(job.videoId) ? this.broadcastSnapshot.get(job.videoId) : (await this.yt.request('liveBroadcasts', { query: { part: 'snippet,status,contentDetails', id: job.videoId } })).items?.[0];
  }
  async refreshSnapshots(jobs) {
    this.videoSnapshot.clear(); this.broadcastSnapshot.clear(); this.streamSnapshot.clear();
    for (const [resource, candidates, target, part] of [
      ['videos', jobs.filter(j => j.videoId).map(j => j.videoId), this.videoSnapshot, 'snippet,status,processingDetails,liveStreamingDetails'],
      ['liveBroadcasts', jobs.filter(j => j.source === 'live' && j.videoId).map(j => j.videoId), this.broadcastSnapshot, 'snippet,status,contentDetails'],
      ['liveStreams', jobs.filter(j => j.source === 'live' && !['ready', 'failed'].includes(j.status)).map(j => this.stream(j)), this.streamSnapshot, 'snippet,status,contentDetails'],
    ]) {
      const unique = [...new Set(candidates)];
      for (let index = 0; index < unique.length; index += 50) {
        const ids = unique.slice(index, index + 50);
        const data = await this.yt.request(resource, { query: { part, id: ids.join(',') } });
        for (const id of ids) target.set(id, null);
        for (const item of data.items || []) target.set(item.id, item);
      }
    }
  }
  async playlist(job) {
    if (job.playlistAdded) return;
    const cls = this.cls(job);
    const existing = await this.yt.request('playlistItems', { query: { part: 'id', playlistId: cls.playlistId, videoId: job.videoId, maxResults: '50' } });
    if (existing.items?.length) { job.playlistAdded = true; delete job.playlistPending; this.save(job); return; }
    // A lost insert response may take time to appear in list. Never blind-repeat it.
    if (job.playlistPending) throw new ApiError('PLAYLIST_INSERT_AMBIGUOUS_MANUAL_REVIEW');
    job.playlistPending = true; this.save(job);
    try {
      await this.yt.request('playlistItems', { method: 'POST', query: { part: 'snippet' }, body: { snippet: { playlistId: cls.playlistId, resourceId: { kind: 'youtube#video', videoId: job.videoId } } } });
    } catch (error) {
      if (definiteRejection(error)) { delete job.playlistPending; this.save(job); }
      throw error;
    }
    job.playlistAdded = true; delete job.playlistPending; this.save(job);
  }
  async prepare(session, { arm = false } = {}) {
    return this.locked(async () => {
      const valid = validateSession(session, this.config), cls = this.cls(valid);
      // These local checks must precede every external mutation, including create.
      this.assertRoomAvailable(valid);
      let job = fs.existsSync(this.file(valid)) ? read(this.file(valid)) : { ...valid, streamId: this.stream(valid), source: 'live', status: 'scheduled' };
      sameRoom(job, valid, this.config);
      if (job.source !== 'live') throw new ApiError('SESSION_ALREADY_UPLOAD');
      if (['processing', 'ready'].includes(job.status)) throw new ApiError('BROADCAST_ALREADY_ENDED');
      if (arm && (job.recording || job.status === 'ready')) throw new ApiError('SESSION_RECORDING_ALREADY_COMPLETED');
      nextSyncSequence(job);
      this.videoSnapshot.clear(); this.broadcastSnapshot.clear(); this.streamSnapshot.clear();
      await this.ensureIdentity(); await this.verifyClass(cls); await this.verifyStream(this.stream(job), true);
      if (!job.videoId) {
        if (job.createPending) throw new ApiError('BROADCAST_CREATE_AMBIGUOUS_MANUAL_RECOVERY');
        this.assertRoomAvailable(valid);
        job.createPending = true; this.save(job);
        let created;
        try {
          created = await this.yt.request('liveBroadcasts', { method: 'POST', query: { part: 'snippet,status,contentDetails' }, body: {
            snippet: { title: job.title, scheduledStartTime: job.startsAt, ...(job.endsAt ? { scheduledEndTime: job.endsAt } : {}) },
            status: { privacyStatus: cls.videoPrivacy },
            contentDetails: { enableDvr: true, recordFromStart: true, enableAutoStart: true, enableAutoStop: true, monitorStream: { enableMonitorStream: false } },
          } });
        } catch (error) {
          if (definiteRejection(error)) { delete job.createPending; this.save(job); }
          throw error;
        }
        if (!VIDEO_ID.test(created.id || '')) throw new ApiError('BROADCAST_RESPONSE_INVALID');
        job.videoId = created.id; delete job.createPending; this.save(job);
      }
      await this.finishPrepare(job);
      return { sessionKey: job.sessionKey, ...(job.roomId ? { roomId: job.roomId } : {}), videoId: job.videoId, status: job.status, ...(arm ? this.armUnlocked(valid) : {}) };
    });
  }
  async finishPrepare(job) {
    this.assertRoomAvailable(job);
    job.streamHealth = await this.verifyStream(this.stream(job), true);
    const broadcast = await this.broadcast(job);
    if (broadcast?.snippet?.channelId !== this.config.expectedChannelId || broadcast?.status?.privacyStatus !== this.cls(job).videoPrivacy) throw new ApiError('BROADCAST_NOT_OWNED_EXPECTED_PRIVACY');
    const video = await this.video(job);
    if (['complete', 'revoked'].includes(broadcast.status?.lifeCycleStatus) || broadcast.snippet?.actualEndTime || video.liveStreamingDetails?.actualEndTime) throw new ApiError('BROADCAST_ALREADY_ENDED');
    const expected = this.stream(job);
    if (broadcast.contentDetails?.boundStreamId !== expected) {
      if (broadcast.contentDetails?.boundStreamId) throw new ApiError('BROADCAST_BOUND_TO_OTHER_CLASS');
      await this.yt.request('liveBroadcasts/bind', { method: 'POST', query: { part: 'id,contentDetails', id: job.videoId, streamId: expected } });
      this.broadcastSnapshot.delete(job.videoId);
    }
    await this.playlist(job);
    job.prepared = true; this.save(job);
    await this.poll(job);
  }
  jobs() { return fs.readdirSync(this.config.stateDir).filter(f => /^[a-f0-9]{64}\.json$/.test(f)).map(f => read(path.join(this.config.stateDir, f))); }
  pollInterval() { return Math.max(30000, Math.min(60000, Number(this.config.pollIntervalMs) || 60000)); }
  dueAt(job) {
    // Sending the next media chunk is independent of status/heartbeat polling.
    let due = 0;
    if (job.videoId && job.syncedAt) {
      const cadence = !job.playbackBlocked && ['ready', 'failed'].includes(job.status) ? 24 * 60 * 60 * 1000 : this.pollInterval();
      due = Date.parse(job.syncedAt) + cadence;
    }
    return Math.max(due, job.nextAttemptAt || 0);
  }
  nextDelay() {
    // Check newly completed recordings at least once per status interval. While
    // upload chunks remain, continue after one second without polling live APIs.
    const waits = this.jobs().map(job => Math.max(1000, this.dueAt(job) - this.now()));
    return Math.min(this.pollInterval(), ...waits);
  }
  async ingest() {
    const failures = [];
    for (const filename of fs.readdirSync(this.config.inboxDir).filter(f => f.endsWith('.ready.json'))) {
      try {
        const manifest = read(path.join(this.config.inboxDir, filename));
        const valid = validateSession(manifest, this.config);
        if (!valid.endsAt || !['recorder-closed', 'obs-recording-stopped'].includes(manifest.completion)) throw new ApiError('RECORDING_COMPLETION_REQUIRED');
        const old = fs.existsSync(this.file(valid)) ? read(this.file(valid)) : null;
        if (old) sameRoom(old, valid, this.config);
        const replacement = manifest.replaceReplay === true;
        const replacingLive = replacement && old?.source === 'live' && ['processing', 'ready', 'failed'].includes(old.status);
        if (replacement && !manifest.fallback) throw new ApiError('REPLAY_REQUIRES_ENDED_LIVE');
        // The original may have become blocked after this manifest was sealed.
        // Keep its identity until recovery is reflected on the server, too.
        if (old?.source === 'live' && manifest.fallback && (old.playbackBlocked || old.blockSyncError)) throw new ApiError('BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY');
        // Keep the original manifest and file as evidence. Once an explicit full
        // replay replaces it, that exact older backup must not overwrite the job.
        if (!replacement && old?.replaceReplay && old.supersededRecording &&
            path.resolve(old.supersededRecording.file) === path.resolve(manifest.file) &&
            (!manifest.sha256 || old.supersededRecording.sha256 === manifest.sha256)) continue;
        if (old?.recording) {
          if (!replacingLive && (path.resolve(old.recording.file) !== path.resolve(manifest.file) || (manifest.sha256 && old.recording.sha256 !== manifest.sha256))) throw new ApiError('SESSION_RECORDING_CONFLICT');
          if (!replacingLive && !(old.source === 'live' && manifest.fallback && old.status === 'failed')) {
            if (replacement && !old.replaceReplay) throw new ApiError('REPLAY_REQUIRES_ENDED_LIVE');
            continue;
          }
        }
        if (replacement && !replacingLive) throw new ApiError('REPLAY_REQUIRES_ENDED_LIVE');
        const recording = await fingerprint(manifest.file, this.config.recordingsRoot);
        if (manifest.sha256 && (manifest.sha256 !== recording.sha256 || manifest.size !== recording.size)) throw new ApiError('SEALED_RECORDING_CHANGED');
        if (old?.source === 'live' && !manifest.fallback) {
          old.recording = recording; old.endsAt = valid.endsAt; old.backupOnly = true; this.save(old); continue;
        }
        if (old?.source === 'live' && manifest.fallback && old.status !== 'failed' && !replacingLive) throw new ApiError('FALLBACK_REQUIRES_FAILED_LIVE');
        if (old && old.source !== 'live') throw new ApiError('SESSION_ALREADY_EXISTS');
        if (old) nextSyncSequence(old);
        const job = { ...valid, streamId: this.stream(valid), source: 'upload', status: 'processing', recording, ...(old ? { replacedLiveVideoId: old.videoId, syncSequence: old.syncSequence ?? 0 } : {}), ...(replacement ? { replaceReplay: true, ...(old.recording ? { supersededRecording: old.recording } : {}) } : {}) };
        this.save(job);
      } catch (error) { failures.push({ manifest: filename, error: safeCode(error) }); }
    }
    return failures;
  }
  async verifyRecording(file) {
    const stat = fs.statSync(file.file), cached = this.verifiedFiles.get(file.file);
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs && cached.sha256 === file.sha256) return;
    const actual = await fingerprint(file.file, this.config.recordingsRoot);
    if (actual.sha256 !== file.sha256 || actual.size !== file.size) throw new ApiError('SEALED_RECORDING_CHANGED');
    this.verifiedFiles.set(file.file, actual);
  }
  async upload(job) {
    nextSyncSequence(job);
    const file = job.recording;
    await this.verifyRecording(file);
    if (!job.uploadUrl) {
      if (job.createPending) throw new ApiError('UPLOAD_CREATE_AMBIGUOUS_MANUAL_RECOVERY');
      job.createPending = true; this.save(job);
      const response = await this.yt.raw('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false', { method: 'POST', headers: { 'content-type': 'application/json', 'x-upload-content-type': 'application/octet-stream', 'x-upload-content-length': String(file.size) }, body: JSON.stringify({ snippet: { title: job.title, categoryId: '27' }, status: { privacyStatus: this.cls(job).videoPrivacy } }) });
      if (!response.ok) {
        const error = new ApiError(`UPLOAD_INIT_HTTP_${response.status}`, response.status);
        if (definiteRejection(error)) { delete job.createPending; this.save(job); }
        throw error;
      }
      const url = response.headers.get('location');
      if (!url || new URL(url).hostname !== 'www.googleapis.com' || new URL(url).protocol !== 'https:') throw new ApiError('UPLOAD_LOCATION_INVALID');
      job.uploadUrl = url; delete job.createPending; this.save(job);
    }
    // Always query the server after restart/network failure; local offsets are not authority.
    let response = await this.yt.raw(job.uploadUrl, { method: 'PUT', headers: { 'content-length': '0', 'content-range': `bytes */${file.size}` } });
    let offset = await this.uploadResponse(job, response);
    if (job.videoId) return;
    const fd = fs.openSync(file.file, 'r');
    try {
      // One chunk per tick bounds time spent away from the live heartbeat loop.
      if (offset < file.size) {
        const buffer = Buffer.alloc(Math.min(CHUNK, file.size - offset));
        if (fs.readSync(fd, buffer, 0, buffer.length, offset) !== buffer.length) throw new ApiError('RECORDING_READ_TRUNCATED');
        response = await this.yt.raw(job.uploadUrl, { method: 'PUT', headers: { 'content-type': 'application/octet-stream', 'content-length': String(buffer.length), 'content-range': `bytes ${offset}-${offset + buffer.length - 1}/${file.size}` }, body: buffer });
        const next = await this.uploadResponse(job, response);
        if (job.videoId) return;
        if (next <= offset) throw new ApiError('UPLOAD_NO_PROGRESS');
        return;
      }
      throw new ApiError('UPLOAD_FINAL_RESPONSE_PENDING');
    } finally { fs.closeSync(fd); }
  }
  async uploadResponse(job, response) {
    if (response.status === 200 || response.status === 201) {
      const body = await response.json();
      if (!VIDEO_ID.test(body.id || '')) throw new ApiError('UPLOAD_RESPONSE_INVALID');
      job.videoId = body.id; delete job.uploadUrl; delete job.createPending; this.save(job); return null;
    }
    if (response.status === 404 || response.status === 410) throw new ApiError('UPLOAD_SESSION_EXPIRED_MANUAL_RECOVERY');
    if (response.status !== 308) throw new ApiError(`UPLOAD_HTTP_${response.status}`, response.status);
    const range = response.headers.get('range');
    if (range && !/^bytes=0-\d+$/.test(range)) throw new ApiError('UPLOAD_RANGE_INVALID');
    const offset = range ? Number(range.split('-')[1]) + 1 : 0;
    if (offset > job.recording.size) throw new ApiError('UPLOAD_RANGE_INVALID');
    job.uploadedBytes = offset; this.save(job); return offset;
  }
  async poll(job) {
    const video = await this.video(job);
    await this.playlist(job);
    let status;
    if (['failed', 'rejected', 'deleted'].includes(video.status?.uploadStatus) || ['failed', 'terminated'].includes(video.processingDetails?.processingStatus)) status = 'failed';
    else if (job.source === 'live') {
      const broadcast = await this.broadcast(job);
      if (!broadcast || broadcast.status?.privacyStatus !== this.cls(job).videoPrivacy || broadcast.contentDetails?.boundStreamId !== this.stream(job)) throw new ApiError('LIVE_MAPPING_INVALID');
      const life = broadcast.status?.lifeCycleStatus;
      if (life === 'live') { job.streamHealth = await this.verifyStream(this.stream(job), true, { requireActive: true }); status = 'live'; }
      else if (life === 'revoked') status = 'failed';
      else if (life === 'complete' || video.liveStreamingDetails?.actualEndTime || broadcast.snippet?.actualEndTime) {
        // An early test can end before the scheduled start. Use only the actual
        // interval reported by YouTube; missing metadata is retried, not guessed.
        const actualTime = field => [video.liveStreamingDetails?.[field], broadcast.snippet?.[field]].find(value =>
          typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)));
        const startsAt = actualTime('actualStartTime'), endsAt = actualTime('actualEndTime');
        if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) throw new ApiError('BROADCAST_ACTUAL_TIMES_PENDING');
        job.startsAt = startsAt; job.endsAt = endsAt;
        status = video.status?.uploadStatus === 'processed' && video.processingDetails?.processingStatus === 'succeeded' ? 'ready' : 'processing';
      } else { job.streamHealth = await this.verifyStream(this.stream(job), true); status = 'scheduled'; }
    } else status = video.status?.uploadStatus === 'processed' && video.processingDetails?.processingStatus === 'succeeded' ? 'ready' : 'processing';
    await this.sync(job, status);
  }
  async once() {
    return this.locked(async () => {
      const failures = await this.ingest(), results = [];
      const available = this.jobs().filter(job => this.dueAt(job) <= this.now());
      const activeLives = available.filter(job => job.source === 'live' && !['ready', 'failed'].includes(job.status));
      const remainder = available.filter(job => !activeLives.includes(job)).sort((a, b) => (a.lastAttemptAt || 0) - (b.lastAttemptAt || 0)).slice(0, 2);
      const batch = [...activeLives, ...remainder];
      try {
        if (batch.length) { await this.ensureIdentity(); await this.refreshSnapshots(batch); }
      } catch (error) {
        // Shared metadata/auth requests fail before the per-job loop. Persist the
        // same backoff as an individual failure so watch cannot spin each second.
        for (const job of batch) { await this.recordFailure(job, error); failures.push({ sessionKey: job.sessionKey, error: job.lastError }); }
        return { results, failures };
      }
      await Promise.all(batch.map(async job => {
        job.lastAttemptAt = this.now(); this.save(job);
        try {
          await this.verifyClass(this.cls(job));
          if (job.source === 'live' && !job.prepared) {
            if (!job.videoId) throw new ApiError('BROADCAST_CREATE_AMBIGUOUS_MANUAL_RECOVERY');
            await this.finishPrepare(job);
          } else {
            if (!job.videoId) await this.upload(job);
            if (job.videoId) await this.poll(job);
          }
          job.attempts = 0; delete job.nextAttemptAt; delete job.lastError; delete job.blockSyncError; this.save(job);
          results.push({ sessionKey: job.sessionKey, status: job.status });
        } catch (error) {
          await this.recordFailure(job, error);
          failures.push({ sessionKey: job.sessionKey, error: job.lastError });
        }
      }));
      return { results, failures };
    });
  }
  async recordFailure(job, error) {
    job.lastAttemptAt = this.now(); job.attempts = (job.attempts || 0) + 1; job.lastError = safeCode(error);
    job.nextAttemptAt = this.now() + Math.min(300000, 5000 * 2 ** Math.min(job.attempts, 6));
    if (error.streamHealth) job.streamHealth = error.streamHealth;
    const blockPlayback = job.videoId && /NOT_OWNED_(?:UNLISTED|EXPECTED_PRIVACY)|LIVE_MAPPING_INVALID|BROADCAST_BOUND_TO_OTHER_CLASS|^STREAM_/.test(job.lastError);
    if (blockPlayback) job.playbackBlocked = true;
    this.save(job);
    if (blockPlayback) {
      // A repairable safety check must never move the lesson to terminal failed.
      // Keep the desired block locally even when the status service is unreachable.
      try { await this.sync(job, job.status, { playbackBlocked: true }); delete job.blockSyncError; }
      catch (syncError) { job.blockSyncError = safeCode(syncError); }
      this.save(job);
    }
  }
  async recover(session, videoId) {
    return this.locked(async () => {
      const valid = validateSession(session, this.config);
      if (!VIDEO_ID.test(videoId || '') || !fs.existsSync(this.file(valid))) throw new ApiError('RECOVERY_JOB_REQUIRED');
      const job = read(this.file(valid));
      sameRoom(job, valid, this.config);
      if (job.videoId && job.videoId !== videoId) throw new ApiError('RECOVERY_VIDEO_CONFLICT');
      nextSyncSequence(job);
      this.videoSnapshot.clear(); this.broadcastSnapshot.clear(); this.streamSnapshot.clear();
      await this.ensureIdentity(true); await this.verifyClass(this.cls(job), true); await this.verifyStream(this.stream(job), true);
      job.videoId = videoId; await this.video(job);
      // Live recovery additionally validates stream ownership and binding before saving.
      if (job.source === 'live') {
        const broadcast = (await this.yt.request('liveBroadcasts', { query: { part: 'snippet,status,contentDetails', id: videoId } })).items?.[0];
        if (!broadcast || broadcast.snippet?.channelId !== this.config.expectedChannelId || broadcast.status?.privacyStatus !== this.cls(job).videoPrivacy || (broadcast.contentDetails?.boundStreamId && broadcast.contentDetails.boundStreamId !== this.stream(job))) throw new ApiError('RECOVERY_LIVE_MISMATCH');
      }
      delete job.createPending; delete job.uploadUrl; delete job.nextAttemptAt; delete job.syncedAt; this.save(job);
      return { recovered: true, sessionKey: job.sessionKey, videoId };
    });
  }
  async retryCreate(session, confirmedNoVideo) {
    if (!confirmedNoVideo) throw new ApiError('MANUAL_STUDIO_REVIEW_REQUIRED');
    return this.locked(async () => {
      const valid = validateSession(session, this.config);
      const job = read(this.file(valid));
      sameRoom(job, valid, this.config);
      if (job.videoId || (!job.createPending && !/UPLOAD_SESSION_EXPIRED/.test(job.lastError || ''))) throw new ApiError('RETRY_CREATE_NOT_APPLICABLE');
      nextSyncSequence(job);
      delete job.createPending; delete job.uploadUrl; delete job.uploadedBytes; delete job.nextAttemptAt;
      this.save(job);
      return { clearedPending: true, sessionKey: job.sessionKey };
    });
  }
}

function safeCode(error) { return /^[A-Z][A-Z0-9_]+$/.test(error?.message || '') ? error.message : 'LOCAL_OPERATION_FAILED'; }
function definiteRejection(error) { return error.status >= 400 && error.status < 500 && error.status !== 408; }

module.exports = { Worker, YouTube, ApiError, validateConfig, validateSession, seal, fingerprint, atomic, key, safeCode };
