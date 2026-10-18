import { randomUUID, createHash } from 'node:crypto';
import { createVoiceUsage, voiceLimits, MEDIA_FRESH_MS } from './voice-usage.mjs';
import { createVoiceInvitations, defaultVoicePreferences, INVITATION_TTL_MS } from './voice-invitations.mjs';
import { createVoiceEncryption } from './voice-encryption.mjs';
import { createVoiceSharing } from './voice-sharing.mjs';

const LEASE_MS = 75000, CONNECT_MS = 45000, RECONNECT_MS = 30000, SYNC_MS = 5000;
const sessionKey = token => createHash('sha256').update(token).digest('hex');
const iso = value => value == null ? null : new Date(value).toISOString();

export function createVoiceService({ db, assert, validateRequestId, publish, enabled = false, provider, cleanupProvider, limits: inputLimits, now = Date.now, automaticSweep = true, invitationVisible, e2eeRequired = true }) {
  assert(typeof e2eeRequired === 'boolean', 500, '통화 암호화 설정을 확인해 주세요.');
  const limits = voiceLimits(inputLimits);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const table = name => Boolean(one("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", name));
  const fail = (code, status, message) => { try { assert(false, status, message); } catch (error) { error.code = code; throw error; } };
  let initialized = table('voice_admissions');
  const pending = () => initialized && (Boolean(one("SELECT 1 FROM voice_admissions WHERE state<>'ended'")) || (table('voice_orphans') && Boolean(one('SELECT 1 FROM voice_orphans'))));
  const capabilities = () => ({ enabled, mode: 'audio', capacity: limits.maxConcurrentParticipants, maxConcurrentParticipants: limits.maxConcurrentParticipants,
    heartbeatSeconds: 25, leaseSeconds: LEASE_MS / 1000, maxSessionSeconds: limits.maxSessionSeconds, connectTimeoutSeconds: CONNECT_MS / 1000,
    reconnectGraceSeconds: RECONNECT_MS / 1000, mediaState: true, resume: true, roomPolicy: true, usageEstimates: true, invitations: enabled, personalCallPreferences: enabled, invitationTtlSeconds: INVITATION_TTL_MS / 1000,
    screenShare: enabled, maxConcurrentScreenShares: 1, screenShareAudio: 'room-opt-in', camera: false, recording: false,
    encryption: { required: Boolean(enabled && e2eeRequired), mode: enabled && e2eeRequired ? 'application-managed-shared-key' : 'none', applicationServerTrusted: true, mediaVerified: false, metadataEncrypted: false },
    ...(!enabled ? { cleanupPending: Boolean(pending()) } : {}) });
  const defaultPolicy = () => ({ revision: 0, enabled: true, locked: false, maxParticipants: limits.maxConcurrentParticipants, memberCanSpeak: true, viewerCanJoin: false, screenShareEnabled: true, memberCanShare: true, screenAudioAllowed: false });
  if (!enabled && table('voice_invitations')) run("UPDATE voice_invitations SET state='cancelled',updated_at=? WHERE state IN ('pending','accepting')", now());
  const unavailable = () => fail('VOICE_DISABLED', 503, '통화 기능이 아직 연결되지 않았습니다.');
  if (!enabled && pending() && !provider) { try { provider = cleanupProvider?.(); } catch {} }
  if (!enabled && (!pending() || !provider)) {
    if (pending()) {
      run("UPDATE voice_admissions SET state='revoking',next_attempt_at=0 WHERE state='active'");
      console.error('[messenger] Voice cleanup requires the previous LiveKit server credentials; admissions remain blocked.');
    }
    return { capabilities, policyFor: defaultPolicy, sweep: async () => {}, close: async () => {}, channelState: () => ({ ...capabilities(), policy: defaultPolicy(), call: null }),
      current: () => ({ admission: null }), usage: async () => ({ enabled: false, limits, totals: null }), audit: () => [],
      preferences: defaultVoicePreferences, updatePreferences: unavailable, invitations: () => [], invitation: unavailable, invitationNotifications: () => [], readInvitationNotification: unavailable,
      invite: unavailable, respondInvitation: unavailable, acceptInvitation: unavailable,
      encryptionKey: unavailable, acknowledgeEncryption: unavailable, startShare: unavailable, stopShare: unavailable,
      join: unavailable, resume: unavailable, heartbeat: unavailable, leave: unavailable, updatePolicy: unavailable, reportUsage: unavailable, webhook: unavailable };
  }
  assert(provider && ['createRoom', 'issueToken', 'removeParticipant'].every(key => typeof provider[key] === 'function'), 500, '통화 서버 설정을 확인해 주세요.');
  if (enabled) assert(['listParticipants', 'verifyWebhook'].every(key => typeof provider[key] === 'function'), 500, '통화 상태 확인과 이벤트 인증 설정을 확인해 주세요.');
  if (enabled && e2eeRequired) assert(typeof provider.updatePermissions === 'function', 500, '암호화 통화의 미디어 권한 제어를 확인해 주세요.');
  assert(typeof provider.serverUrl === 'string', 500, '통화 서버 주소를 확인해 주세요.');
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_calls (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id), room_name TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, ended_at INTEGER);
    CREATE UNIQUE INDEX IF NOT EXISTS voice_call_current ON voice_calls(channel_id) WHERE ended_at IS NULL;
    CREATE TABLE IF NOT EXISTS voice_admissions (id TEXT PRIMARY KEY, call_id TEXT NOT NULL REFERENCES voice_calls(id), user_id TEXT NOT NULL REFERENCES users(id), session_key TEXT NOT NULL, request_id TEXT NOT NULL, joined_at INTEGER NOT NULL, lease_until INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('active','revoking','ended')), token_issued INTEGER NOT NULL DEFAULT 0, ended_at INTEGER, next_attempt_at INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,request_id));
    CREATE UNIQUE INDEX IF NOT EXISTS voice_user_active ON voice_admissions(user_id) WHERE state='active';
    CREATE INDEX IF NOT EXISTS voice_admission_cleanup ON voice_admissions(state,ended_at);
    CREATE TABLE IF NOT EXISTS voice_policies (channel_id TEXT PRIMARY KEY REFERENCES channels(id), revision INTEGER NOT NULL, enabled INTEGER NOT NULL, locked INTEGER NOT NULL, max_participants INTEGER NOT NULL, member_can_speak INTEGER NOT NULL, viewer_can_join INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS voice_orphans (call_id TEXT NOT NULL REFERENCES voice_calls(id), identity TEXT NOT NULL, first_seen_at INTEGER NOT NULL, metered_until INTEGER NOT NULL, next_attempt_at INTEGER NOT NULL, PRIMARY KEY(call_id,identity));
    CREATE TABLE IF NOT EXISTS voice_webhook_events (id TEXT PRIMARY KEY, call_id TEXT NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE, event TEXT NOT NULL, body_hash TEXT NOT NULL, created_at INTEGER NOT NULL, received_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS voice_audit (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id), actor_id TEXT, target_id TEXT, action TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL);
  `);
  for (const [name, fields] of Object.entries({
    voice_calls: { provider_room_sid: 'TEXT', last_sync_at: 'INTEGER', last_sync_ok: 'INTEGER NOT NULL DEFAULT 0', next_sync_at: 'INTEGER NOT NULL DEFAULT 0' },
    voice_admissions: { media_state: "TEXT NOT NULL DEFAULT 'connecting'", observed_at: 'INTEGER', connected_at: 'INTEGER', last_sid: 'TEXT', microphone_published: 'INTEGER NOT NULL DEFAULT 0', microphone_muted: 'INTEGER NOT NULL DEFAULT 1', metered_until: 'INTEGER NOT NULL DEFAULT 0', can_speak: 'INTEGER NOT NULL DEFAULT 1', deadline_at: 'INTEGER', reason: 'TEXT' },
    voice_policies: { screen_share_enabled: 'INTEGER NOT NULL DEFAULT 1', member_can_share: 'INTEGER NOT NULL DEFAULT 1', screen_audio_allowed: 'INTEGER NOT NULL DEFAULT 0' },
  })) {
    const columns = new Set(all(`PRAGMA table_info(${name})`).map(row => row.name));
    for (const [column, definition] of Object.entries(fields)) if (!columns.has(column)) db.exec(`ALTER TABLE ${name} ADD COLUMN ${column} ${definition}`);
  }
  initialized = true;
  run('UPDATE voice_admissions SET metered_until=joined_at WHERE metered_until=0');
  const usageMeter = createVoiceUsage({ db, now, limits, fail });
  const checks = new Map(), dirtyChannels = new Set(), shareStarts = new Set();
  let queue = Promise.resolve(), closed = false, timer, queuedSweep;
  function atomic(fn) {
    db.exec('SAVEPOINT voice_mutation');
    try { const result = fn(); db.exec('RELEASE voice_mutation'); return result; }
    catch (error) { db.exec('ROLLBACK TO voice_mutation; RELEASE voice_mutation'); throw error; }
  }
  // A process restart cannot restore an in-memory company-session check.
  // Keep its unverified time charged until explicit Cloud token revocation.
  atomic(() => {
    run("UPDATE voice_admissions SET media_state='unknown' WHERE state<>'ended'");
    usageMeter.meterAll();
    run("UPDATE voice_admissions SET state='revoking',reason='server_restarted',next_attempt_at=0 WHERE state='active'");
  });
  function serialized(fn) { const task = queue.then(fn); queue = task.catch(() => {}); return task; }
  const invitations = createVoiceInvitations({ db, now, fail, validateRequestId, available: activeFeature, publish, visible: invitationVisible });
  let encryption;
  const cleanupPending = () => Boolean(one("SELECT 1 FROM voice_admissions WHERE state='revoking'") || one('SELECT 1 FROM voice_orphans'));
  const sharing = createVoiceSharing({ db, now, fail, provider, validateRequestId, publish, invalidate, permissionFor: sharingPermission, encryptionReady: row => !e2eeRequired || encryption?.ready(row), meter: () => atomic(() => usageMeter.meterAll()) });
  encryption = createVoiceEncryption({ db, required: e2eeRequired, now, fail, provider, publish, invalidate, validate: () => validateActive(false), cleanupPending, fenceShares: sharing.fence });
  function available() { if (closed) fail('VOICE_STOPPING', 503, '통화 서버가 종료 중입니다. 다시 연결해 주세요.'); }
  function activeFeature() { available(); if (!enabled) fail('VOICE_DISABLED', 503, '통화 기능이 아직 연결되지 않았습니다.'); }
  function owns(row, userId, token) { return row && row.user_id === userId && row.session_key === sessionKey(token); }
  function auditEvent(channelId, action, actorId = null, targetId = null, reason = null) {
    run('INSERT INTO voice_audit VALUES(?,?,?,?,?,?,?)', randomUUID(), channelId, actorId, targetId, action, reason, now());
  }
  function policyFor(channelId) {
    const row = one('SELECT * FROM voice_policies WHERE channel_id=?', channelId);
    return row ? { revision: row.revision, enabled: Boolean(row.enabled), locked: Boolean(row.locked), maxParticipants: Math.min(row.max_participants, limits.maxConcurrentParticipants), memberCanSpeak: Boolean(row.member_can_speak), viewerCanJoin: Boolean(row.viewer_can_join), screenShareEnabled: Boolean(row.screen_share_enabled), memberCanShare: Boolean(row.member_can_share), screenAudioAllowed: Boolean(row.screen_audio_allowed) } : defaultPolicy();
  }
  function access(check, joining = false) {
    const value = check?.();
    const result = value === true ? { canJoin: true, canRemain: true, canSpeak: true, canModerate: false } : value;
    if (!result || result.canRemain !== true || (joining && result.canJoin !== true)) fail('VOICE_PERMISSION_DENIED', 403, '현재 대화방에서 통화에 참여할 수 없습니다.');
    return result;
  }
  function sharingPermission(row) {
    const permission = access(checks.get(row.id)), call = one('SELECT channel_id FROM voice_calls WHERE id=?', row.call_id), policy = policyFor(call.channel_id);
    const canShare = Boolean(permission.canShare && policy.enabled && policy.screenShareEnabled && (policy.memberCanShare || permission.canModerate));
    return { ...permission, canShare, canShareAudio: Boolean(canShare && permission.canShareAudio && policy.screenAudioAllowed) };
  }
  function changed(callId) {
    const call = one('SELECT * FROM voice_calls WHERE id=?', callId);
    if (!call) return;
    if (!one("SELECT 1 FROM voice_admissions WHERE call_id=? AND state<>'ended'", callId) && !one('SELECT 1 FROM voice_orphans WHERE call_id=?', callId)) run('UPDATE voice_calls SET ended_at=COALESCE(ended_at,?) WHERE id=?', now(), callId);
    publish('voice', call.channel_id);
  }
  function flushChanges() { const channels = [...dirtyChannels]; dirtyChannels.clear(); for (const channelId of channels) publish('voice', channelId); }
  function invalidate(row, reason) {
    if (row.state !== 'active') return;
    const call = one('SELECT channel_id FROM voice_calls WHERE id=?', row.call_id);
    atomic(() => {
      run("UPDATE voice_admissions SET state='revoking',reason=?,next_attempt_at=0 WHERE id=? AND state='active'", reason, row.id);
      auditEvent(call.channel_id, 'admission_ending', null, row.user_id, reason);
    });
    checks.delete(row.id);
    encryption?.fence(row.call_id); sharing.fence(row.call_id);
    dirtyChannels.add(call.channel_id);
  }
  function validateActive(mediaDeadlines = true) {
    for (const row of all("SELECT * FROM voice_admissions WHERE state='active'")) {
      let permission;
      try { permission = access(checks.get(row.id)); } catch {}
      const reason = !permission ? 'permission_revoked' : Boolean(row.can_speak) !== (permission.canSpeak === true) ? 'speech_permission_changed'
        : now() >= row.joined_at + limits.maxSessionSeconds * 1000 ? 'session_limit' : now() >= row.lease_until ? 'lease_expired'
          : mediaDeadlines && row.deadline_at && now() >= row.deadline_at ? (row.connected_at ? 'reconnect_timeout' : 'connect_timeout') : null;
      if (reason) invalidate(row, reason);
    }
  }
  function enforceBudget() {
    if (usageMeter.snapshot().exhausted) for (const row of all("SELECT * FROM voice_admissions WHERE state='active'")) invalidate(row, 'usage_limit');
  }
  async function drain(force = false) {
    for (const row of all("SELECT a.*,c.room_name FROM voice_admissions a JOIN voice_calls c ON c.id=a.call_id WHERE a.state='revoking' AND (?=1 OR a.next_attempt_at<=?)", force ? 1 : 0, now())) {
      try {
        if (row.token_issued) await provider.removeParticipant(row.room_name, row.id);
        atomic(() => { usageMeter.meterAll(); run("UPDATE voice_admissions SET state='ended',media_state='ended',ended_at=? WHERE id=?", now(), row.id); });
        changed(row.call_id);
      } catch { run('UPDATE voice_admissions SET next_attempt_at=? WHERE id=?', now() + 15000, row.id); }
    }
    for (const row of all('SELECT o.*,c.room_name FROM voice_orphans o JOIN voice_calls c ON c.id=o.call_id WHERE ?=1 OR o.next_attempt_at<=?', force ? 1 : 0, now())) {
      try {
        await provider.removeParticipant(row.room_name, row.identity);
        atomic(() => { usageMeter.meterAll(); run('DELETE FROM voice_orphans WHERE call_id=? AND identity=?', row.call_id, row.identity); }); changed(row.call_id);
      } catch { run('UPDATE voice_orphans SET next_attempt_at=? WHERE call_id=? AND identity=?', now() + 15000, row.call_id, row.identity); }
    }
  }
  async function reconcile(call) {
    let remote;
    try { remote = await provider.listParticipants(call.room_name); if (!Array.isArray(remote)) throw new Error('invalid snapshot'); }
    catch {
      atomic(() => {
        usageMeter.meterAll();
        run('UPDATE voice_calls SET last_sync_ok=-1,next_sync_at=? WHERE id=?', now() + SYNC_MS, call.id);
        for (const row of all("SELECT * FROM voice_admissions WHERE call_id=? AND state='active' AND media_state='connected'", call.id)) run("UPDATE voice_admissions SET media_state='reconnecting',deadline_at=COALESCE(deadline_at,?) WHERE id=?", now() + RECONNECT_MS, row.id);
      });
      publish('voice', call.channel_id); return;
    }
    atomic(() => usageMeter.meterAll());
    // Session checks may synchronize the company roster in its own transaction.
    // Run them outside a voice savepoint, then atomically apply voice changes.
    validateActive(false);
    const grants = new Map();
    for (const row of all("SELECT * FROM voice_admissions WHERE call_id=? AND state='active'", call.id)) {
      try { grants.set(row.id, sharing.permissions(row)); } catch { invalidate(row, 'permission_revoked'); }
    }
    const observedShares = [];
    atomic(() => {
      const stamp = now();
      run('UPDATE voice_calls SET last_sync_at=?,last_sync_ok=1,next_sync_at=? WHERE id=?', stamp, stamp + SYNC_MS, call.id);
      for (const row of all("SELECT * FROM voice_admissions WHERE call_id=? AND state='active'", call.id)) {
        const media = remote.find(participant => participant.identity === row.id && participant.state === 'ACTIVE');
        const pausing = e2eeRequired && encryption.summary(call.id).status === 'pausing';
        if (media && (encryption.invalidTracks(row, media.tracks) || !pausing && sharing.invalidTracks(row, media.tracks, grants.get(row.id)))) { invalidate(row, 'media_permission_violation'); continue; }
        if (!encryption.ready(row)) {
          // A paused transport may still be ACTIVE at the provider. It cannot
          // carry the new epoch until every participant has prepared its key.
          run("UPDATE voice_admissions SET media_state='securing',observed_at=?,microphone_published=0,microphone_muted=1 WHERE id=?", stamp, row.id);
          continue;
        }
        if (media) {
          const microphone = media.tracks.find(track => track.source === 'MICROPHONE');
          run("UPDATE voice_admissions SET media_state='connected',observed_at=?,connected_at=COALESCE(connected_at,?),last_sid=?,microphone_published=?,microphone_muted=?,deadline_at=NULL WHERE id=?", stamp, stamp, media.sid, microphone ? 1 : 0, !microphone || microphone.muted ? 1 : 0, row.id);
          observedShares.push([row, media.tracks]);
        } else {
          run("UPDATE voice_admissions SET media_state=?,observed_at=?,microphone_published=0,microphone_muted=1,deadline_at=COALESCE(deadline_at,?) WHERE id=?", row.connected_at ? 'reconnecting' : 'connecting', stamp, stamp + (row.connected_at ? RECONNECT_MS : CONNECT_MS), row.id);
        }
      }
      for (const media of remote) {
        if (media.state === 'DISCONNECTED' || one("SELECT 1 FROM voice_admissions WHERE id=? AND call_id=? AND state<>'ended'", media.identity, call.id)) continue;
        if (!one('SELECT 1 FROM voice_orphans WHERE call_id=? AND identity=?', call.id, media.identity)) {
          run('INSERT INTO voice_orphans VALUES(?,?,?,?,?)', call.id, media.identity, stamp, stamp, stamp);
          auditEvent(call.channel_id, 'unexpected_media', null, null, 'unadmitted_participant');
        }
      }
    });
    for (const [row, tracks] of observedShares) sharing.observe(row, tracks);
    flushChanges();
    publish('voice', call.channel_id);
  }
  async function sweepUnlocked(force = false) {
    atomic(() => usageMeter.meterAll()); validateActive(false); atomic(() => enforceBudget()); flushChanges(); invitations.reconcile();
    await encryption.reconcile();
    // Downgrade a previously authorized share before checking the next media
    // snapshot against its reduced grants. Stale screen tracks are cleaned by
    // the share protocol rather than mistaken for an unauthorized new upload.
    await sharing.reconcile();
    await drain(force);
    // At a media deadline, perform one final current-state lookup before ending
    // a transport that may have recovered between polling ticks. Session,
    // membership, lease and budget checks still run before and after the await.
    if (enabled && !closed) for (const call of all("SELECT * FROM voice_calls c WHERE c.ended_at IS NULL AND (c.next_sync_at<=? OR EXISTS(SELECT 1 FROM voice_admissions a WHERE a.call_id=c.id AND a.state='active' AND a.deadline_at<=?)) AND EXISTS(SELECT 1 FROM voice_admissions a WHERE a.call_id=c.id AND a.state='active')", now(), now())) await reconcile(call);
    atomic(() => usageMeter.meterAll()); validateActive(); atomic(() => enforceBudget()); flushChanges();
    await sharing.reconcile(); await encryption.reconcile(); flushChanges(); await drain();
    invitations.reconcile(); invitations.prune();
    atomic(() => {
      run('DELETE FROM voice_webhook_events WHERE received_at<?', now() - 7 * 86400000);
      run('DELETE FROM voice_audit WHERE created_at<?', now() - 30 * 86400000);
      run("DELETE FROM voice_admissions WHERE state='ended' AND ended_at<? AND NOT EXISTS(SELECT 1 FROM voice_invitations i WHERE i.sender_admission_id=voice_admissions.id OR i.admission_id=voice_admissions.id)", now() - 30 * 86400000);
      run('DELETE FROM voice_calls WHERE ended_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM voice_admissions a WHERE a.call_id=voice_calls.id) AND NOT EXISTS(SELECT 1 FROM voice_orphans o WHERE o.call_id=voice_calls.id) AND NOT EXISTS(SELECT 1 FROM voice_invitations i WHERE i.call_id=voice_calls.id)');
      const date = new Date(now()), oldest = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 12, 1)).toISOString().slice(0, 7);
      run('DELETE FROM voice_usage_months WHERE month<?', oldest);
    });
  }
  function rowState(row) {
    return { id: row.id, state: row.state, mediaState: row.state === 'ended' ? 'ended' : row.media_state,
      observedAt: iso(row.observed_at), reason: row.reason || null, leaseExpiresAt: iso(row.lease_until), sessionEndsAt: iso(row.joined_at + limits.maxSessionSeconds * 1000) };
  }
  function channelState(channelId) {
    const policy = policyFor(channelId);
    if (!enabled) return { ...capabilities(), policy, call: null };
    const call = one('SELECT * FROM voice_calls WHERE channel_id=? AND ended_at IS NULL', channelId);
    if (!call) return { ...capabilities(), policy, call: null };
    const fresh = Boolean(call.last_sync_ok === 1 && call.last_sync_at != null && now() - call.last_sync_at >= 0 && now() - call.last_sync_at <= MEDIA_FRESH_MS);
    const rows = all("SELECT * FROM voice_admissions WHERE call_id=? AND state<>'ended' ORDER BY joined_at,id", call.id);
    return { ...capabilities(), policy, call: { id: call.id, channelId, createdAt: iso(call.created_at), encryption: encryption.summary(call.id),
      sync: { status: fresh ? 'current' : call.last_sync_ok === -1 ? 'unavailable' : call.last_sync_at == null ? 'pending' : 'unavailable', observedAt: iso(call.last_sync_at) },
      reservations: rows.filter(row => row.state === 'active').map(row => ({ userId: row.user_id, leaseExpiresAt: iso(row.lease_until), mediaState: row.media_state })),
      participants: fresh ? rows.filter(row => row.media_state === 'connected').map(row => ({ userId: row.user_id, state: row.state === 'revoking' ? 'disconnecting' : 'connected', observedAt: iso(row.observed_at), microphone: { published: Boolean(row.microphone_published), muted: Boolean(row.microphone_muted) }, share: sharing.current(row.id) })) : [],
      cleanupPending: rows.some(row => row.state === 'revoking') || Boolean(one('SELECT 1 FROM voice_orphans WHERE call_id=?', call.id)) } };
  }
  function admissionResult(row) {
    activeFeature();
    // Encryption preparation and consent fences may have changed this row
    // since it was reserved. Return the same current state as current/SSE reads.
    row = one('SELECT * FROM voice_admissions WHERE id=?', row.id);
    if (!row || row.state !== 'active') fail('VOICE_ENDED', 410, '통화 연결이 종료되었습니다. 새로 참가해 주세요.');
    const call = one('SELECT * FROM voice_calls WHERE id=?', row.call_id);
    const security = encryption.summary(call.id, row.id);
    const base = { ...rowState(row), room: call.room_name, identity: row.id, serverUrl: provider.serverUrl, canSpeak: Boolean(row.can_speak), encryption: security, share: sharing.current(row.id) };
    if (!encryption.ready(row)) return { ...channelState(call.channel_id), admission: { ...base, token: null, tokenExpiresAt: null } };
    const credential = provider.issueToken(call.room_name, row.id, limits.maxConcurrentParticipants, sharing.permissions(row));
    assert(typeof credential.token === 'string' && credential.token.length > 0, 503, '통화 참가 정보를 만들지 못했습니다.');
    run('UPDATE voice_admissions SET token_issued=1 WHERE id=?', row.id);
    return { ...channelState(call.channel_id), admission: { ...base, token: credential.token, tokenExpiresAt: credential.expiresAt } };
  }
  function requireNoPending() { if (pending() && (one("SELECT 1 FROM voice_admissions WHERE state='revoking'") || one('SELECT 1 FROM voice_orphans'))) fail('VOICE_CLEANUP_PENDING', 503, '이전 통화 연결을 정리하고 있습니다. 잠시 후 다시 시도해 주세요.'); }
  function requireBudget() { if (usageMeter.snapshot().exhausted) fail('VOICE_USAGE_LIMIT', 409, '이번 달 통화 사용 한도에 도달했습니다. 관리자에게 확인해 주세요.'); }
  async function joinUnlocked({ channelId, userId, token, requestId, check, client }) {
    encryption.assertClient(client);
    requestId = validateRequestId(requestId, '통화 참가');
    activeFeature(); await sweepUnlocked(); const permission = access(check, true), policy = policyFor(channelId);
    if (!policy.enabled || policy.locked) fail('VOICE_PERMISSION_DENIED', 403, '이 대화방은 현재 새 통화 참가를 받지 않습니다.');
    requireNoPending(); requireBudget();
    let row = one('SELECT * FROM voice_admissions WHERE user_id=? AND request_id=?', userId, requestId);
    if (row && (!owns(row, userId, token) || row.state !== 'active' || one('SELECT channel_id FROM voice_calls WHERE id=?', row.call_id).channel_id !== channelId)) fail('VOICE_REQUEST_ENDED', 409, '이 참가 요청은 종료되었거나 다른 통화에 사용되었습니다. 새로 참가해 주세요.');
    if (!row) {
      if (one("SELECT 1 FROM voice_admissions WHERE user_id=? AND state='active'", userId)) fail('VOICE_ALREADY_JOINED', 409, '이미 다른 창이나 기기에서 통화 중입니다. 먼저 통화에서 나와 주세요.');
      if (one("SELECT COUNT(*) n FROM voice_admissions WHERE state<>'ended'").n >= limits.maxConcurrentParticipants) fail('VOICE_CAPACITY', 409, '현재 전체 통화 참여 인원이 가득 찼습니다.');
      let call = one('SELECT * FROM voice_calls WHERE channel_id=? AND ended_at IS NULL', channelId);
      if (call && one("SELECT COUNT(*) n FROM voice_admissions WHERE call_id=? AND state<>'ended'", call.id).n >= policy.maxParticipants) fail('VOICE_ROOM_CAPACITY', 409, '이 대화방의 통화 참여 인원이 가득 찼습니다.');
      atomic(() => {
        if (!call) {
          const id = randomUUID(); run('INSERT INTO voice_calls(id,channel_id,room_name,created_at) VALUES(?,?,?,?)', id, channelId, `synk-work-${id}`, now()); call = one('SELECT * FROM voice_calls WHERE id=?', id);
        }
        const id = randomUUID(), stamp = now();
        run("INSERT INTO voice_admissions(id,call_id,user_id,session_key,request_id,joined_at,lease_until,state,metered_until,can_speak,deadline_at) VALUES(?,?,?,?,?,?,?,'active',?,?,?)", id, call.id, userId, sessionKey(token), requestId, stamp, stamp + Math.min(LEASE_MS, limits.maxSessionSeconds * 1000), stamp, permission.canSpeak ? 1 : 0, stamp + CONNECT_MS);
        row = one('SELECT * FROM voice_admissions WHERE id=?', id);
      });
    }
    checks.set(row.id, check);
    const call = one('SELECT * FROM voice_calls WHERE id=?', row.call_id);
    try {
      // Keep the provider ceiling stable for the room lifetime; application
      // policy enforces a smaller per-channel seat limit on every admission.
      const room = await provider.createRoom(call.room_name, limits.maxConcurrentParticipants);
      activeFeature(); const latest = access(check, true);
      await encryption.reconcile(); access(check, true);
      if (one('SELECT state FROM voice_admissions WHERE id=?', row.id)?.state !== 'active') fail('VOICE_ENDED', 410, '통화 참가 준비가 종료되었습니다. 다시 참가해 주세요.');
      atomic(() => usageMeter.meterAll()); requireBudget();
      if (latest.canSpeak !== Boolean(row.can_speak)) fail('VOICE_PERMISSION_CHANGED', 409, '통화 권한이 변경되었습니다. 다시 참가해 주세요.');
      if (now() >= row.lease_until || now() >= row.deadline_at && row.media_state !== 'connected' || now() >= row.joined_at + limits.maxSessionSeconds * 1000) fail('VOICE_REQUEST_EXPIRED', 409, '통화 참가 시간이 지났습니다. 새로 참가해 주세요.');
      if (room?.sid) run('UPDATE voice_calls SET provider_room_sid=COALESCE(provider_room_sid,?) WHERE id=?', room.sid, call.id);
      const result = admissionResult(row); changed(call.id); return result;
    } catch (error) { invalidate(row, 'join_failed'); await sweepUnlocked(true); throw error; }
  }
  const join = input => serialized(() => joinUnlocked(input));
  function ownedActive(id, userId, token) {
    activeFeature();
    const row = one('SELECT * FROM voice_admissions WHERE id=?', id);
    if (!owns(row, userId, token)) fail('VOICE_NOT_FOUND', 404, '통화 참가 정보를 찾을 수 없습니다.');
    if (row.state !== 'active') fail('VOICE_ENDED', 410, '통화 연결이 종료되었습니다. 새로 참가해 주세요.');
    access(checks.get(id)); return row;
  }
  function sweep() {
    // Slow control requests must not let timer/roster invalidations fill the
    // queue ahead of heartbeats. Keep one pending pass; requests arriving after
    // it starts may still schedule one follow-up to observe newer changes.
    if (!queuedSweep) queuedSweep = serialized(() => { queuedSweep = null; return sweepUnlocked(); });
    return queuedSweep;
  }
  if (automaticSweep) { timer = setInterval(() => { void sweep().catch(() => {}); }, SYNC_MS); timer.unref(); }
  return {
    capabilities, policyFor, channelState, join, sweep,
    preferences: invitations.preferences,
    updatePreferences: invitations.updatePreferences,
    invitations: invitations.list,
    invitation: invitations.get,
    invitationNotifications: invitations.notifications,
    readInvitationNotification: invitations.read,
    invite(input) { return serialized(async () => { activeFeature(); await sweepUnlocked(); return invitations.create(input); }); },
    // These synchronous actions must not wait behind an in-flight media request.
    respondInvitation: invitations.respond,
    acceptInvitation(input) {
      return serialized(async () => {
        activeFeature(); encryption.assertClient(input.client); await sweepUnlocked();
        const row = invitations.claim(input);
        if (row.state === 'accepted') {
          const admission = ownedActive(row.admission_id, input.userId, input.token);
          requireNoPending(); requireBudget();
          return { ...admissionResult(admission), invitation: invitations.get(row.id, input.userId) };
        }
        const check = () => { invitations.guard(row.id); return access(input.check, true); };
        try {
          const result = await joinUnlocked({ channelId: row.channel_id, userId: input.userId, token: input.token, requestId: row.join_request_id, check, client: input.client });
          const invitation = invitations.complete(row.id, result.admission.id);
          // Future heartbeats need only the accepted session/room check. DND and
          // the caller leaving never revoke an already accepted conversation.
          checks.set(result.admission.id, input.check);
          return { ...result, invitation };
        } catch (error) {
          const admission = one('SELECT * FROM voice_admissions WHERE user_id=? AND request_id=?', input.userId, row.join_request_id);
          if (admission) invalidate(admission, 'invitation_failed');
          invitations.failed(row.id); await sweepUnlocked(true); throw error;
        }
      });
    },
    encryptionKey({ id, userId, token }) {
      return serialized(async () => { activeFeature(); await sweepUnlocked(); const row = ownedActive(id, userId, token); requireNoPending(); return encryption.keyFor(row); });
    },
    acknowledgeEncryption({ id, userId, token, input }) {
      return serialized(async () => {
        activeFeature(); await sweepUnlocked(); const row = ownedActive(id, userId, token); requireNoPending(); requireBudget();
        encryption.acknowledge(row, input); publish('voice', one('SELECT channel_id FROM voice_calls WHERE id=?', row.call_id).channel_id);
        return admissionResult(one('SELECT * FROM voice_admissions WHERE id=?', id));
      });
    },
    startShare({ id, userId, token, input }) {
      const intent = { id, cancelled: false }; shareStarts.add(intent);
      return serialized(async () => {
        activeFeature(); await sweepUnlocked(); const row = ownedActive(id, userId, token);
        if (intent.cancelled) { sharing.cancelStart(row, input); fail('VOICE_SHARE_CANCELLED', 409, '화면 공유 요청이 취소되었습니다.'); }
        requireNoPending(); requireBudget();
        try {
          const result = await sharing.start(row, input);
          if (intent.cancelled) fail('VOICE_SHARE_CANCELLED', 409, '화면 공유 요청이 취소되었습니다.');
          // Remote permission changes yield to logout/leave and consume real
          // lease time and usage. Check again before returning a broader JWT.
          atomic(() => usageMeter.meterAll()); validateActive(false); atomic(() => enforceBudget()); flushChanges();
          const latest = ownedActive(id, userId, token); requireNoPending(); requireBudget();
          return { ...result, ...admissionResult(latest) };
        }
        catch (error) { await sweepUnlocked(true); throw error; }
      }).finally(() => shareStarts.delete(intent));
    },
    async stopShare({ id, userId, token }) {
      activeFeature(); const row = ownedActive(id, userId, token);
      // Capture can end while the start request is still awaiting its initial
      // state lookup, before a durable share reservation exists.
      for (const intent of shareStarts) if (intent.id === id) intent.cancelled = true;
      sharing.stop(row);
      return serialized(async () => { await sweepUnlocked(); return { share: sharing.current(id), cleanupPending: Boolean(sharing.current(id)) }; });
    },
    current(userId, token) {
      const row = one('SELECT a.*,c.channel_id FROM voice_admissions a JOIN voice_calls c ON c.id=a.call_id WHERE a.user_id=? AND a.session_key=? ORDER BY a.joined_at DESC,a.rowid DESC LIMIT 1', userId, sessionKey(token));
      return { admission: row ? { ...rowState(row), channelId: row.channel_id, encryption: encryption.summary(row.call_id, row.id), share: sharing.current(row.id) } : null };
    },
    resume({ id, userId, token }) {
      return serialized(async () => { activeFeature(); await sweepUnlocked(); const row = ownedActive(id, userId, token); requireNoPending(); requireBudget(); return admissionResult(row); });
    },
    heartbeat({ id, userId, token }) {
      return serialized(async () => {
        activeFeature(); await sweepUnlocked(); const row = ownedActive(id, userId, token);
        const until = Math.min(now() + LEASE_MS, row.joined_at + limits.maxSessionSeconds * 1000);
        run('UPDATE voice_admissions SET lease_until=? WHERE id=?', until, id);
        return { admissionId: id, leaseExpiresAt: iso(until), mediaState: row.media_state, observedAt: iso(row.observed_at) };
      });
    },
    async leave({ id, userId, token }) {
      available();
      const leaving = one('SELECT * FROM voice_admissions WHERE id=?', id);
      if (!owns(leaving, userId, token)) fail('VOICE_NOT_FOUND', 404, '통화 참가 정보를 찾을 수 없습니다.');
      invitations.cancelFromAdmission(id);
      // Consent ends immediately, even while a provider request owns the queue.
      // Persist the fence now so that request cannot return another credential.
      atomic(() => { usageMeter.meterAll(); invalidate(leaving, 'left'); }); flushChanges();
      return serialized(async () => {
        available(); const row = one('SELECT * FROM voice_admissions WHERE id=?', id);
        if (!owns(row, userId, token)) fail('VOICE_NOT_FOUND', 404, '통화 참가 정보를 찾을 수 없습니다.');
        atomic(() => { usageMeter.meterAll(); invalidate(row, 'left'); }); await sweepUnlocked(true);
        return { ok: true, cleanupPending: one('SELECT state FROM voice_admissions WHERE id=?', id)?.state !== 'ended' };
      });
    },
    updatePolicy({ channelId, actorId, input, check }) {
      return serialized(async () => {
        activeFeature(); const permission = check();
        if (!permission?.canModerate) fail('VOICE_POLICY_FORBIDDEN', 403, '이 대화방의 통화 설정을 변경할 권한이 없습니다.');
        const allowed = ['revision', 'enabled', 'locked', 'maxParticipants', 'memberCanSpeak', 'viewerCanJoin', 'screenShareEnabled', 'memberCanShare', 'screenAudioAllowed'];
        if (!input || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key)) || !Number.isSafeInteger(input.revision) || Object.keys(input).length < 2) fail('VOICE_POLICY_INVALID', 400, '통화 설정 요청을 확인해 주세요.');
        const prior = policyFor(channelId);
        if (input.revision !== prior.revision) fail('VOICE_POLICY_CONFLICT', 409, '통화 설정이 변경되었습니다. 최신 설정을 다시 확인해 주세요.');
        for (const key of ['enabled', 'locked', 'memberCanSpeak', 'viewerCanJoin', 'screenShareEnabled', 'memberCanShare', 'screenAudioAllowed']) if (Object.hasOwn(input, key) && typeof input[key] !== 'boolean') fail('VOICE_POLICY_INVALID', 400, '통화 설정 요청을 확인해 주세요.');
        if (Object.hasOwn(input, 'maxParticipants') && (!Number.isSafeInteger(input.maxParticipants) || input.maxParticipants < 1 || input.maxParticipants > limits.maxConcurrentParticipants)) fail('VOICE_POLICY_INVALID', 400, '통화 참여 인원 설정을 확인해 주세요.');
        const next = { ...prior, ...input, revision: prior.revision + 1 };
        const call = one('SELECT id FROM voice_calls WHERE channel_id=? AND ended_at IS NULL', channelId);
        if (call && one("SELECT COUNT(*) n FROM voice_admissions WHERE call_id=? AND state<>'ended'", call.id).n > next.maxParticipants) fail('VOICE_ROOM_OCCUPIED', 409, '현재 참가 인원보다 작게 설정할 수 없습니다.');
        atomic(() => {
          run('INSERT INTO voice_policies VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(channel_id) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled,locked=excluded.locked,max_participants=excluded.max_participants,member_can_speak=excluded.member_can_speak,viewer_can_join=excluded.viewer_can_join,screen_share_enabled=excluded.screen_share_enabled,member_can_share=excluded.member_can_share,screen_audio_allowed=excluded.screen_audio_allowed', channelId, next.revision, +next.enabled, +next.locked, next.maxParticipants, +next.memberCanSpeak, +next.viewerCanJoin, +next.screenShareEnabled, +next.memberCanShare, +next.screenAudioAllowed);
          auditEvent(channelId, 'policy_changed', actorId, null, null);
        });
        await sweepUnlocked(); publish('voice', channelId); return channelState(channelId);
      });
    },
    audit(channelId, limit = 50) {
      return all('SELECT * FROM voice_audit WHERE channel_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?', channelId, limit).map(row => ({ id: row.id, action: row.action, actorId: row.actor_id, targetUserId: row.target_id, reason: row.reason, createdAt: iso(row.created_at) }));
    },
    usage() { return serialized(async () => { available(); atomic(() => usageMeter.meterAll()); return { enabled, totals: usageMeter.snapshot(), cleanupPending: Boolean(one("SELECT 1 FROM voice_admissions WHERE state='revoking'") || one('SELECT 1 FROM voice_orphans')) }; }); },
    reportUsage({ id, userId, token, input }) {
      return serialized(async () => { activeFeature(); await sweepUnlocked(); ownedActive(id, userId, token); const result = atomic(() => usageMeter.report(id, input, validateRequestId)); await sweepUnlocked(); return result; });
    },
    async webhook(raw, authorization) {
      activeFeature(); const event = provider.verifyWebhook(raw, authorization);
      return serialized(async () => {
        activeFeature();
        // Provider event IDs are opaque and case-sensitive. LiveKit Cloud also
        // sends EV_ IDs, so the UUID contract for client requests does not apply.
        const id = event?.id, created = Number(event?.createdAt ?? event?.created_at);
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) fail('VOICE_WEBHOOK_EVENT_INVALID', 400, '통화 이벤트 식별자를 확인해 주세요.');
        if (!Number.isSafeInteger(created) || created > now() / 1000 + 30 || typeof event.event !== 'string' || event.event.length > 80) fail('VOICE_WEBHOOK_EVENT_INVALID', 400, '통화 이벤트 형식을 확인해 주세요.');
        const call = typeof event.room?.name === 'string' && one('SELECT * FROM voice_calls WHERE room_name=? AND ended_at IS NULL', event.room.name);
        if (!call || created * 1000 < now() - 7 * 86400000 || (call.provider_room_sid && event.room.sid !== call.provider_room_sid)) return { accepted: true };
        const digest = createHash('sha256').update(raw).digest('hex'), prior = one('SELECT body_hash FROM voice_webhook_events WHERE id=?', id);
        if (prior && prior.body_hash !== digest) fail('VOICE_WEBHOOK_CONFLICT', 409, '통화 이벤트 식별자가 중복되었습니다.');
        if (prior) return { accepted: true };
        atomic(() => { run('INSERT INTO voice_webhook_events VALUES(?,?,?,?,?,?)', id, call.id, event.event, digest, created * 1000, now()); run('UPDATE voice_calls SET next_sync_at=0 WHERE id=?', call.id); });
        // Signed events are durable hints. Read current provider state instead of
        // replaying possibly delayed join/leave payloads into application truth.
        await sweepUnlocked(); return { accepted: true };
      });
    },
    async close() {
      closed = true; clearInterval(timer);
      encryption.close();
      await serialized(async () => {
        invitations.close();
        atomic(() => { usageMeter.meterAll(); for (const row of all("SELECT * FROM voice_admissions WHERE state='active'")) invalidate(row, 'server_stopped'); });
        flushChanges();
        await drain(true); checks.clear();
      });
    },
  };
}
