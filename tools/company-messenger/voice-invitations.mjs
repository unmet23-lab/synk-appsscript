import { randomUUID, createHash } from 'node:crypto';

export const INVITATION_TTL_MS = 45000;
const key = token => createHash('sha256').update(token).digest('hex');
const iso = stamp => stamp == null ? null : new Date(stamp).toISOString();
export const defaultVoicePreferences = () => ({ revision: 0, callNotifications: true, callSounds: true, doNotDisturb: false, doNotDisturbUntil: null });

// Invitations are consent requests for an existing call, never membership grants.
// Everything here is synchronous: cancel/DND can fence an acceptance while the
// media provider is awaiting I/O on the voice service's serialized queue.
export function createVoiceInvitations({ db, now, fail, validateRequestId, available, publish, visible = () => false }) {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL, call_notifications INTEGER NOT NULL, call_sounds INTEGER NOT NULL, dnd INTEGER NOT NULL, dnd_until INTEGER);
    CREATE TABLE IF NOT EXISTS voice_invitations (
      id TEXT PRIMARY KEY, call_id TEXT NOT NULL REFERENCES voice_calls(id), channel_id TEXT NOT NULL REFERENCES channels(id),
      sender_id TEXT NOT NULL REFERENCES users(id), recipient_id TEXT NOT NULL REFERENCES users(id), sender_admission_id TEXT NOT NULL REFERENCES voice_admissions(id),
      sender_session TEXT NOT NULL, request_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','accepting','accepted','rejected','cancelled','expired','unavailable','failed')),
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, read_at INTEGER,
      accept_session TEXT, accept_request_id TEXT, join_request_id TEXT, admission_id TEXT REFERENCES voice_admissions(id),
      UNIQUE(sender_id,request_id));
    CREATE INDEX IF NOT EXISTS voice_invitation_parties ON voice_invitations(recipient_id,state,created_at);
    CREATE INDEX IF NOT EXISTS voice_invitation_rate ON voice_invitations(sender_id,created_at);
  `);
  // A restart loses the original session and lifecycle callbacks. Never ring or
  // complete a persisted request using a newly logged-in session instead.
  run("UPDATE voice_invitations SET state='cancelled',updated_at=? WHERE state IN ('pending','accepting')", now());
  const checks = new Map();
  function preference(userId) {
    const row = one('SELECT * FROM voice_preferences WHERE user_id=?', userId);
    if (!row) return defaultVoicePreferences();
    const dnd = Boolean(row.dnd && (row.dnd_until == null || row.dnd_until > now()));
    return { revision: row.revision, callNotifications: Boolean(row.call_notifications), callSounds: Boolean(row.call_sounds),
      doNotDisturb: dnd, doNotDisturbUntil: dnd ? iso(row.dnd_until) : null };
  }
  function notify(row) {
    // Targeted invalidations contain no invite, preference, or media credentials.
    publish('voice_invitation', null, row.sender_id);
    publish('voice_invitation', null, row.recipient_id);
    publish('notification', null, row.recipient_id);
  }
  function finish(row, state) {
    if (!['pending', 'accepting'].includes(row.state)) return;
    run('UPDATE voice_invitations SET state=?,updated_at=? WHERE id=? AND state IN (\'pending\',\'accepting\')', state, now(), row.id);
    checks.delete(row.id); notify(row);
  }
  function live(row) {
    if (row.expires_at <= now()) return 'expired';
    const sender = one('SELECT * FROM voice_admissions WHERE id=?', row.sender_admission_id);
    const call = one('SELECT * FROM voice_calls WHERE id=?', row.call_id);
    if (!sender || sender.state !== 'active' || sender.lease_until <= now() || sender.call_id !== row.call_id || !call || call.ended_at != null) return 'cancelled';
    const callbacks = checks.get(row.id);
    try {
      const source = callbacks?.sender();
      if (!source || source.canRemain !== true || source.canSpeak !== true || callbacks.recipient()?.canJoin !== true) return 'unavailable';
    } catch { return 'unavailable'; }
    const pref = preference(row.recipient_id);
    if (!pref.callNotifications || pref.doNotDisturb) return 'unavailable';
    const busy = one("SELECT id,request_id FROM voice_admissions WHERE user_id=? AND state<>'ended'", row.recipient_id);
    if (busy && !(row.state === 'accepting' && busy.request_id === row.join_request_id)) return 'unavailable';
    return null;
  }
  function reconcile() {
    for (const row of all("SELECT * FROM voice_invitations WHERE state IN ('pending','accepting')")) {
      const state = live(row); if (state) finish(row, state);
    }
  }
  function shape(row, userId) {
    return { id: row.id, callId: row.call_id, channelId: row.channel_id, fromUserId: row.sender_id, toUserId: row.recipient_id,
      state: row.state, createdAt: iso(row.created_at), expiresAt: iso(row.expires_at), updatedAt: iso(row.updated_at),
      ...(row.recipient_id === userId && row.state === 'pending' ? { alert: { id: row.id, expiresAt: iso(row.expires_at), soundEnabled: preference(userId).callSounds } } : {}) };
  }
  function owned(id, userId) {
    const row = one('SELECT * FROM voice_invitations WHERE id=?', id);
    if (!row || ![row.sender_id, row.recipient_id].includes(userId) || !visible(userId, row.channel_id)) fail('VOICE_INVITATION_NOT_FOUND', 404, '통화 초대를 찾을 수 없습니다.');
    return row;
  }
  function rate(senderId, recipientId) {
    const stamp = now();
    const count = (sql, ...args) => one(sql, ...args).n;
    if (count('SELECT COUNT(*) n FROM voice_invitations WHERE sender_id=? AND created_at>?', senderId, stamp - 60000) >= 5 ||
        count('SELECT COUNT(*) n FROM voice_invitations WHERE sender_id=? AND created_at>?', senderId, stamp - 3600000) >= 30 ||
        count('SELECT COUNT(*) n FROM voice_invitations WHERE recipient_id=? AND created_at>?', recipientId, stamp - 300000) >= 10 ||
        one('SELECT 1 FROM voice_invitations WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) AND created_at>?', senderId, recipientId, recipientId, senderId, stamp - 60000)) {
      fail('VOICE_INVITATION_RATE_LIMIT', 429, '잠시 후 다시 통화 초대를 보내 주세요.');
    }
  }
  return {
    reconcile, preferences: preference,
    updatePreferences(userId, input) {
      available();
      const allowed = ['revision', 'callNotifications', 'callSounds', 'doNotDisturb', 'doNotDisturbUntil'];
      if (!input || Array.isArray(input) || Object.keys(input).length < 2 || Object.keys(input).some(field => !allowed.includes(field)) || !Number.isSafeInteger(input.revision)) fail('VOICE_PREFERENCES_INVALID', 400, '통화 알림 설정을 확인해 주세요.');
      const prior = preference(userId);
      if (input.revision !== prior.revision) fail('VOICE_PREFERENCES_CONFLICT', 409, '알림 설정이 변경되었습니다. 최신 설정을 다시 확인해 주세요.');
      for (const field of ['callNotifications', 'callSounds', 'doNotDisturb']) if (Object.hasOwn(input, field) && typeof input[field] !== 'boolean') fail('VOICE_PREFERENCES_INVALID', 400, '통화 알림 설정을 확인해 주세요.');
      if (Object.hasOwn(input, 'doNotDisturbUntil') && input.doNotDisturbUntil !== null && (!((input.doNotDisturb ?? prior.doNotDisturb) === true) || typeof input.doNotDisturbUntil !== 'string')) fail('VOICE_PREFERENCES_INVALID', 400, '방해 금지와 종료 시간을 함께 확인해 주세요.');
      const next = { ...prior, ...input, revision: prior.revision + 1 };
      if (!next.doNotDisturb) next.doNotDisturbUntil = null;
      else if (Object.hasOwn(input, 'doNotDisturb') && !Object.hasOwn(input, 'doNotDisturbUntil')) next.doNotDisturbUntil = null;
      const until = next.doNotDisturbUntil == null ? null : Date.parse(next.doNotDisturbUntil);
      if (next.doNotDisturbUntil !== null && (typeof next.doNotDisturbUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(next.doNotDisturbUntil) || !Number.isFinite(until) || until <= now() || until > now() + 7 * 86400000)) fail('VOICE_PREFERENCES_INVALID', 400, '방해 금지 종료는 시간대를 포함해 지금부터 7일 이내로 설정해 주세요.');
      run('INSERT INTO voice_preferences VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,call_notifications=excluded.call_notifications,call_sounds=excluded.call_sounds,dnd=excluded.dnd,dnd_until=excluded.dnd_until', userId, next.revision, +next.callNotifications, +next.callSounds, +next.doNotDisturb, until);
      reconcile(); publish('voice_preferences', null, userId); return preference(userId);
    },
    create({ channelId, userId, recipientId, token, requestId, check, recipientCheck }) {
      available(); requestId = validateRequestId(requestId, '통화 초대');
      const prior = one('SELECT * FROM voice_invitations WHERE sender_id=? AND request_id=?', userId, requestId);
      if (prior) {
        if (prior.channel_id !== channelId || prior.recipient_id !== recipientId || prior.sender_session !== key(token)) fail('VOICE_INVITATION_CONFLICT', 409, '이미 다른 초대에 사용한 요청입니다.');
        owned(prior.id, userId); reconcile(); return { created: false, invitation: shape(one('SELECT * FROM voice_invitations WHERE id=?', prior.id), userId) };
      }
      if (userId === recipientId) fail('VOICE_INVITATION_INVALID', 400, '초대할 동료를 선택해 주세요.');
      const permission = check();
      if (permission?.canRemain !== true || permission.canSpeak !== true) fail('VOICE_INVITATION_FORBIDDEN', 403, '통화에 참여한 발언자만 동료를 초대할 수 있습니다.');
      // Membership checks precede rate/availability responses, including for admins.
      if (!visible(recipientId, channelId)) fail('VOICE_INVITATION_NOT_FOUND', 404, '이 대화방에서 초대할 동료를 찾을 수 없습니다.');
      const sender = one("SELECT a.* FROM voice_admissions a JOIN voice_calls c ON c.id=a.call_id WHERE a.user_id=? AND a.session_key=? AND a.state='active' AND c.channel_id=? AND c.ended_at IS NULL", userId, key(token), channelId);
      if (!sender) fail('VOICE_INVITATION_CALL_REQUIRED', 409, '먼저 이 대화방의 통화에 참여해 주세요.');
      rate(userId, recipientId);
      const id = randomUUID(), stamp = now();
      run("INSERT INTO voice_invitations(id,call_id,channel_id,sender_id,recipient_id,sender_admission_id,sender_session,request_id,state,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'pending',?,?,?)", id, sender.call_id, channelId, userId, recipientId, sender.id, key(token), requestId, stamp, stamp + INVITATION_TTL_MS, stamp);
      checks.set(id, { sender: check, recipient: recipientCheck });
      let row = one('SELECT * FROM voice_invitations WHERE id=?', id);
      const blocked = live(row) || (one("SELECT 1 FROM voice_invitations WHERE recipient_id=? AND id<>? AND state IN ('pending','accepting')", recipientId, id) ? 'unavailable' : null);
      if (blocked) finish(row, blocked); else notify(row);
      row = one('SELECT * FROM voice_invitations WHERE id=?', id);
      return { created: true, invitation: shape(row, userId) };
    },
    list(userId) {
      reconcile();
      return all('SELECT * FROM voice_invitations WHERE sender_id=? OR recipient_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100', userId, userId)
        .filter(row => visible(userId, row.channel_id)).map(row => shape(row, userId));
    },
    get(id, userId) { reconcile(); return shape(owned(id, userId), userId); },
    respond({ id, userId, action }) {
      available(); reconcile(); const row = owned(id, userId);
      if (action === 'cancel' ? row.sender_id !== userId : row.recipient_id !== userId) fail('VOICE_INVITATION_NOT_FOUND', 404, '통화 초대를 찾을 수 없습니다.');
      const state = action === 'cancel' ? 'cancelled' : 'rejected';
      if (row.state !== state && !['pending', 'accepting'].includes(row.state)) fail('VOICE_INVITATION_ENDED', 409, '이미 처리되었거나 종료된 통화 초대입니다.');
      finish(row, state); return { invitation: shape(one('SELECT * FROM voice_invitations WHERE id=?', id), userId) };
    },
    claim({ id, userId, token, requestId }) {
      available(); reconcile(); requestId = validateRequestId(requestId, '통화 수락'); const row = owned(id, userId);
      if (row.recipient_id !== userId) fail('VOICE_INVITATION_NOT_FOUND', 404, '통화 초대를 찾을 수 없습니다.');
      if (row.state === 'accepted') {
        if (row.accept_session !== key(token) || row.accept_request_id !== requestId) fail('VOICE_INVITATION_CLAIMED', 409, '다른 창이나 기기에서 이미 수락한 초대입니다.');
        return row;
      }
      if (row.state !== 'pending') fail('VOICE_INVITATION_ENDED', 409, '이미 처리되었거나 종료된 통화 초대입니다.');
      run("UPDATE voice_invitations SET state='accepting',accept_session=?,accept_request_id=?,join_request_id=?,updated_at=? WHERE id=? AND state='pending'", key(token), requestId, randomUUID(), now(), id);
      return one('SELECT * FROM voice_invitations WHERE id=?', id);
    },
    guard(id) {
      reconcile(); const row = one('SELECT * FROM voice_invitations WHERE id=?', id);
      if (!row || row.state !== 'accepting') fail('VOICE_INVITATION_ENDED', 409, '초대가 취소되었거나 더 이상 수락할 수 없습니다.');
    },
    complete(id, admissionId) {
      this.guard(id);
      run("UPDATE voice_invitations SET state='accepted',admission_id=?,updated_at=? WHERE id=? AND state='accepting'", admissionId, now(), id);
      checks.delete(id); const row = one('SELECT * FROM voice_invitations WHERE id=?', id); notify(row); return shape(row, row.recipient_id);
    },
    failed(id) { const row = one('SELECT * FROM voice_invitations WHERE id=?', id); if (row) finish(row, 'failed'); },
    cancelFromAdmission(admissionId) {
      for (const row of all("SELECT * FROM voice_invitations WHERE sender_admission_id=? AND state IN ('pending','accepting')", admissionId)) finish(row, 'cancelled');
    },
    notifications(userId) {
      reconcile();
      return all("SELECT * FROM voice_invitations WHERE recipient_id=? AND state='pending' ORDER BY created_at DESC", userId).filter(row => visible(userId, row.channel_id)).map(row => ({
        id: `voice:${row.id}`, kind: 'voice_invitation', title: '동료의 통화 초대', createdAt: iso(row.created_at), readAt: iso(row.read_at),
        voiceInvitation: shape(row, userId), expiresAt: iso(row.expires_at), pushEligible: preference(userId).callSounds,
      }));
    },
    read(userId, notificationId) {
      const row = owned(notificationId.slice('voice:'.length), userId);
      if (row.recipient_id !== userId) fail('VOICE_INVITATION_NOT_FOUND', 404, '통화 초대를 찾을 수 없습니다.');
      run('UPDATE voice_invitations SET read_at=COALESCE(read_at,?) WHERE id=?', now(), row.id);
    },
    prune() { run("DELETE FROM voice_invitations WHERE state NOT IN ('pending','accepting') AND updated_at<?", now() - 30 * 86400000); },
    close() { for (const row of all("SELECT * FROM voice_invitations WHERE state IN ('pending','accepting')")) finish(row, 'cancelled'); checks.clear(); },
  };
}
