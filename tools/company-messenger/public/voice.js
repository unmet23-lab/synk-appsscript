// Workspace calls. The call lives in this persistent messenger document, apart
// from chat rendering, so switching rooms or workspace menus never recreates
// the SDK Room. Media tokens and E2EE keys are kept in memory only.
export const VOICE_PROTOCOL = 'synk-livekit-e2ee-v1';
const HEARTBEAT_MS = 25000, USAGE_MS = 60000, OWNER_MS = 5000, OWNER_STALE_MS = 12000;
const SDK_URL = new URL('./vendor/livekit-client/livekit-client.esm.js', import.meta.url).href;
const WORKER_URL = new URL('./vendor/livekit-client/livekit-client.e2ee.worker.js', import.meta.url).href;
const SCREEN_SHARE = 3, SCREEN_SHARE_AUDIO = 4;

const glyphs = {
  headset: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micOff: '<path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.4 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  screenStop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M9.5 7.5l5 5M14.5 7.5l-5 5"/>',
  userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 11-3.3M19 14v6M16 17h6"/>',
  leave: '<path d="M4.5 13.5c4.6-4.4 10.4-4.4 15 0l-2.1 2.4-3-1.3v-2.2a10 10 0 0 0-4.8 0v2.2l-3 1.3z"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
};
const glyph = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyphs[name] || glyphs.headset}</svg>`;

const PHASES = {
  preparing: '준비 중', joining: '참가 요청 중', securing: '암호화 준비 중', waiting: '다른 참가자 준비 대기',
  connecting: '연결 중', connected: '통화 중', reconnecting: '다시 연결 중', pausing: '키 교체 중',
  leaving: '나가는 중', ended: '통화 종료', recoverable: '연결 끊김',
};
const PARTICIPANT = { connected: '연결됨', connecting: '연결 중', securing: '암호화 준비 중', reconnecting: '다시 연결 중', unknown: '상태 확인 중' };
const REASONS = {
  left: '통화에서 나왔어요.',
  permission_revoked: '이 방의 통화 권한이 바뀌어 연결을 끝냈어요.',
  speech_permission_changed: '발언 권한이 바뀌었어요. 다시 참가해 주세요.',
  session_limit: '최대 통화 시간이 끝났어요.',
  lease_expired: '연결 확인이 끊겨 통화를 끝냈어요.',
  connect_timeout: '연결을 끝내지 못해 통화를 닫았어요.',
  reconnect_timeout: '다시 연결하지 못해 통화를 닫았어요.',
  usage_limit: '이번 달 통화 사용 한도에 도달했어요.',
  encryption_timeout: '모든 참가자의 암호화 준비가 제한 시간 안에 끝나지 않았어요.',
  encryption_pause_failed: '키 교체를 위한 연결 정리에 실패해 통화를 끝냈어요.',
  media_permission_violation: '허용되지 않은 미디어가 감지되어 연결을 끝냈어요.',
  share_stop_unconfirmed: '화면 공유 정리를 확인하지 못해 연결을 끝냈어요.',
  share_cleanup_failed: '화면 공유 정리를 확인하지 못해 연결을 끝냈어요.',
  server_restarted: '통화 서버가 다시 시작되어 연결을 끝냈어요.',
  server_stopped: '통화 서버가 멈춰 연결을 끝냈어요.',
  join_failed: '통화 참가를 끝내지 못했어요.',
  invitation_failed: '초대 수락을 끝내지 못했어요.',
  replaced: '다른 창에서 같은 통화를 이어받았어요.',
  auth: '로그인이 바뀌어 통화를 정리했어요.',
};
const SAFE_CODES = new Set(['VOICE_E2EE_REQUIRED', 'VOICE_ALREADY_JOINED', 'VOICE_CAPACITY', 'VOICE_ROOM_CAPACITY', 'VOICE_PERMISSION_DENIED', 'VOICE_CLEANUP_PENDING', 'VOICE_USAGE_LIMIT', 'VOICE_DISABLED', 'VOICE_SHARE_CAPACITY', 'VOICE_SHARE_FORBIDDEN', 'VOICE_SHARE_NOT_CONNECTED', 'VOICE_SHARE_REQUEST_ENDED', 'VOICE_SHARE_CANCELLED', 'VOICE_INVITATION_RATE_LIMIT']);

export function reasonText(reason) { return REASONS[reason] || '통화가 끝났어요.'; }
export function errorText(error) {
  if (!error) return '통화를 처리하지 못했어요.';
  if (!error.status) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  if (error.code === 'VOICE_E2EE_REQUIRED') return '암호화 통화를 지원하는 최신 화면에서 다시 참가해 주세요. 평문 연결은 쓰지 않아요.';
  return SAFE_CODES.has(error.code) || error.message ? error.message : '통화를 처리하지 못했어요.';
}

// Feature checks before any permission prompt or join request. A failed check
// stops here; there is no plaintext fallback.
export function voiceSupportProblem(win = globalThis) {
  if (!win.isSecureContext) return '보안 연결(HTTPS)에서만 통화할 수 있어요.';
  if (!win.navigator?.mediaDevices?.getUserMedia || typeof win.RTCPeerConnection !== 'function') return '이 브라우저는 통화를 지원하지 않아요. 최신 Chrome·Edge·Safari·Firefox에서 열어 주세요.';
  const sender = win.RTCRtpSender?.prototype;
  const transforms = Boolean(sender && 'createEncodedStreams' in sender) || typeof win.RTCRtpScriptTransform === 'function';
  if (typeof win.Worker !== 'function' || !win.crypto?.subtle || !transforms) return '이 브라우저는 암호화 통화를 지원하지 않아요. 최신 Chrome·Edge·Safari·Firefox에서 열어 주세요.';
  return '';
}

// base64url(HMAC-SHA256(UTF8(key), UTF8(proofContext))) with WebCrypto.
export async function e2eeProof(key, proofContext, subtle = globalThis.crypto.subtle) {
  const encoder = new TextEncoder();
  const hmac = await subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await subtle.sign('HMAC', hmac, encoder.encode(proofContext)));
  let binary = ''; for (const byte of mac) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Header label for a room. A stale or failed provider lookup is never shown
// as "nobody is here": seats may still be held while the state is unknown.
export function roomCallSummary(data) {
  const call = data?.call;
  if (!call) return { state: 'none', label: '통화', count: 0 };
  const reserved = call.reservations?.length || 0;
  if (call.sync?.status !== 'current') return { state: 'unknown', label: reserved ? `통화 확인 중 · ${reserved}자리` : '통화 확인 중', count: reserved };
  const connected = (call.participants || []).filter(row => row.state === 'connected').length;
  if (connected) return { state: 'live', label: `통화 중 ${connected}명`, count: connected };
  return { state: 'pending', label: reserved ? `통화 연결 중 ${reserved}명` : '통화', count: reserved };
}

// Seats come from the server; "connected" only from the last fresh provider
// observation. The caller's own row follows the local SDK phase.
export function callParticipants(call, members = [], meId, selfPhase) {
  const names = new Map(members.map(member => [member.id, member]));
  const fresh = call?.sync?.status === 'current';
  return (call?.reservations || []).map(seat => {
    const observed = fresh ? (call.participants || []).find(row => row.userId === seat.userId && row.state === 'connected') : null;
    const self = seat.userId === meId;
    const status = self && selfPhase ? selfPhase : observed ? 'connected' : !fresh ? 'unknown' : ['securing', 'reconnecting'].includes(seat.mediaState) ? seat.mediaState : 'connecting';
    const share = observed?.share && ['starting', 'sharing'].includes(observed.share.state) ? observed.share : null;
    return { userId: seat.userId, self, name: names.get(seat.userId)?.name || '동료', status,
      muted: observed ? !(observed.microphone?.published && observed.microphone.muted === false) : null, sharing: Boolean(share), shareAdmissionId: share?.admissionId || null };
  });
}

export function pendingIncoming(items, meId, now = Date.now()) {
  return (items || []).filter(item => item.toUserId === meId && item.state === 'pending' && item.alert && Date.parse(item.expiresAt) > now)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function publishAllowed(permissions, source) {
  if (!permissions?.canPublish) return false;
  const sources = permissions.canPublishSources || [];
  const names = { [SCREEN_SHARE]: ['screen_share', 'SCREEN_SHARE'], [SCREEN_SHARE_AUDIO]: ['screen_share_audio', 'SCREEN_SHARE_AUDIO'] }[source] || [];
  return sources.length === 0 || sources.some(item => item === source || names.includes(item));
}

export function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

let sdkLoading = null;
function loadSdk() { return sdkLoading ||= import(SDK_URL).catch(error => { sdkLoading = null; throw error; }); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const enc = value => encodeURIComponent(value);

export function createVoice(deps) {
  const { api, toast, esc, openModal, modal } = deps;
  // Tests inject a scripted SDK; browsers load the vendored build on first use.
  const sdkLoader = deps.loadSdk || loadSdk;
  const v = { caps: null, userId: null, gen: 0, rooms: new Map(), roomLoads: new Map(), roomTimers: new Map(), session: null, recover: null,
    invitations: [], prefs: null, otherTab: null, rung: new Set(), lastSummary: '', renderQueued: false, tick: null, owner: null,
    dockHtml: '', ringHtml: '', headerHtml: '', stageTrack: null, audioContext: null };
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('synk-workspace-voice') : null;
  const enabled = () => Boolean(v.caps?.enabled && v.userId);
  const me = () => v.userId;
  const memberName = userId => deps.members().find(member => member.id === userId)?.name || '동료';
  const channelOf = channelId => deps.channels().find(room => room.id === channelId);
  const channelName = channelId => channelOf(channelId)?.name || '대화방';
  const supportedRoom = room => Boolean(room && room.kind !== 'self' && !room.systemKey);
  const alive = s => Boolean(s && v.session === s && !s.ended && s.gen === v.gen);
  // A retried accept must reuse its first UUID; a new accept never revives an ended one.
  const acceptIds = new Map();
  const acceptRequestId = invitationId => { if (!acceptIds.has(invitationId)) acceptIds.set(invitationId, crypto.randomUUID()); return acceptIds.get(invitationId); };

  channel?.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.userId !== v.userId) return;
    if (data.type === 'owner') { v.otherTab = { admissionId: data.admissionId, at: Date.now() }; render(); }
    if (data.type === 'released') { v.otherTab = null; render(); }
  });

  // ── Room state ───────────────────────────────────────────────
  async function loadRoom(channelId) {
    if (!enabled() || !channelId) return null;
    if (v.roomLoads.has(channelId)) return v.roomLoads.get(channelId);
    const gen = v.gen;
    const task = (async () => {
      try {
        const data = await api(`/api/channels/${enc(channelId)}/voice`);
        if (gen !== v.gen) return null;
        v.rooms.set(channelId, { data, at: Date.now() });
        const s = v.session;
        if (s && s.channelId === channelId) syncFromRoom(s, data);
        render(); return data;
      } catch (error) {
        if (gen === v.gen && [403, 404].includes(error.status)) { v.rooms.delete(channelId); render(); }
        return null;
      } finally { v.roomLoads.delete(channelId); }
    })();
    v.roomLoads.set(channelId, task); return task;
  }
  function scheduleRoom(channelId, delay = 250) {
    clearTimeout(v.roomTimers.get(channelId));
    v.roomTimers.set(channelId, setTimeout(() => { v.roomTimers.delete(channelId); void loadRoom(channelId); }, delay));
  }
  function syncFromRoom(s, data) {
    s.permissions = data.permissions || s.permissions; s.policy = data.policy || s.policy;
    const call = data.call;
    if (!s.id || s.ended) return;
    if (!call || !call.reservations?.some(seat => seat.userId === me())) { void confirmEnded(s); return; }
    s.call = call;
    const before = `${s.serverEnc?.status}:${s.serverEnc?.epoch}`;
    if (call.encryption) s.serverEnc = { ...s.serverEnc, ...call.encryption };
    if (`${s.serverEnc?.status}:${s.serverEnc?.epoch}` !== before || ['waiting', 'pausing', 'securing'].includes(s.phase)) void drive(s);
  }

  // ── Session lifecycle ────────────────────────────────────────
  function newSession(fields) {
    return { id: null, channelId: null, requestId: null, invitationId: null, phase: 'preparing', detail: '', reason: '', permissions: null, policy: null, call: null,
      canSpeak: false, serverEnc: null, serverUrl: null, epoch: null, prepared: false, proof: null, pendingToken: null, needsPrepare: false, paused: false,
      room: null, worker: null, keyProvider: null, mic: null, micPublished: false, micMuted: false, micError: '', share: null, screen: null,
      audioBlocked: false, everConnected: false, startedAt: null, sessionEndsAt: null, ended: false, cleanupPending: false, sdk: null,
      driving: false, again: false, retryTimer: null, connectingRoom: null, failures: 0, ackedEpoch: null, heartbeat: null, usageTimer: null, usage: null, encryptionWarningAt: 0, gen: v.gen, ...fields };
  }
  function setPhase(s, phase, detail = '') { if (s.phase === phase && s.detail === detail) return; s.phase = phase; s.detail = detail; render(); }
  function adopt(s, result, { token = true } = {}) {
    if (!result) return;
    if (result.permissions) s.permissions = result.permissions;
    if (result.policy) s.policy = result.policy;
    if (Object.hasOwn(result, 'call') && s.channelId) {
      const { admission, invitation, share, ...state } = result;
      v.rooms.set(s.channelId, { data: { ...(v.rooms.get(s.channelId)?.data || {}), ...state }, at: Date.now() });
      if (state.call) s.call = state.call;
    }
    const admission = result.admission;
    if (!admission) return;
    s.id = admission.id; s.channelId ||= admission.channelId;
    if (typeof admission.canSpeak === 'boolean') s.canSpeak = admission.canSpeak;
    if (admission.encryption) s.serverEnc = admission.encryption;
    if (admission.serverUrl) s.serverUrl = admission.serverUrl;
    if (admission.sessionEndsAt) s.sessionEndsAt = admission.sessionEndsAt;
    // A media token is used once for the next Room connection, then dropped.
    if (token && admission.token) s.pendingToken = admission.token;
  }

  async function join(channelId, { muted = false, invitation = null } = {}) {
    if (v.session && !v.session.ended) { toast('이미 통화 중이에요. 지금 통화에서 나온 뒤 다시 시도해 주세요.', true); return; }
    if (v.recover) { toast('끊긴 통화가 있어요. 먼저 다시 연결하거나 나가 주세요.', true); return; }
    const problem = voiceSupportProblem();
    if (problem) { showUnsupported(problem); return; }
    const s = v.session = newSession({ channelId, micMuted: muted, requestId: invitation ? acceptRequestId(invitation.id) : crypto.randomUUID(), invitationId: invitation?.id || null });
    render();
    try { s.sdk = await sdkLoader(); } catch { return fail(s, '통화 도구를 불러오지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'); }
    if (!alive(s)) return;
    if (!s.sdk.isBrowserSupported() || !s.sdk.isE2EESupported()) return fail(s, '이 브라우저는 암호화 통화를 지원하지 않아요. 최신 Chrome·Edge·Safari·Firefox에서 열어 주세요.');
    setPhase(s, 'joining');
    const path = invitation ? `/api/voice/invitations/${enc(invitation.id)}/accept` : `/api/channels/${enc(channelId)}/voice/join`;
    const body = { requestId: s.requestId, client: { protocol: VOICE_PROTOCOL, supported: true } };
    let result;
    for (let attempt = 0; ; attempt++) {
      try { result = await api(path, { method: 'POST', body }); break; }
      catch (error) {
        // Retry only an unanswered request, with the same UUID.
        if (!error.status && attempt < 2 && alive(s)) { await wait(1500); continue; }
        if (!alive(s)) return;
        if (invitation) void refreshInvitations();
        return fail(s, errorText(error));
      }
    }
    if (!alive(s)) { if (result?.admission?.id) void api(`/api/voice/${enc(result.admission.id)}/leave`, { method: 'POST', body: {} }).catch(() => {}); return; }
    adopt(s, result);
    if (invitation) void refreshInvitations();
    if (result.admission?.encryption?.required !== true) { await leave({ reason: 'join_failed', silent: true }); toast('암호화가 준비되지 않은 통화라 연결하지 않았어요.', true); return; }
    startHeartbeat(s); claimTab(s);
    void drive(s);
  }

  async function recoverCall() {
    const admission = v.recover?.admission;
    if (!admission || (v.session && !v.session.ended)) return;
    const problem = voiceSupportProblem();
    if (problem) { showUnsupported(problem); return; }
    v.recover = null;
    const s = v.session = newSession({ id: admission.id, channelId: admission.channelId, serverEnc: admission.encryption || null, phase: 'securing' });
    render();
    try { s.sdk = await sdkLoader(); } catch { return fail(s, '통화 도구를 불러오지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'); }
    if (!alive(s)) return;
    if (!s.sdk.isBrowserSupported() || !s.sdk.isE2EESupported()) return fail(s, '이 브라우저는 암호화 통화를 지원하지 않아요.');
    startHeartbeat(s); claimTab(s); void loadRoom(s.channelId);
    void drive(s);
  }

  // One driver per session decides the next step from the latest known state.
  async function drive(s) {
    if (!alive(s) || !s.sdk || !s.id) return;
    if (s.driving) { s.again = true; return; }
    s.driving = true;
    try { do { s.again = false; await step(s); } while (s.again && alive(s)); }
    catch (error) { if (alive(s)) await flowError(s, error); }
    finally { s.driving = false; }
  }
  async function step(s) {
    clearTimeout(s.retryTimer);
    const enc0 = s.serverEnc || {};
    const rotating = enc0.status === 'pausing' || Boolean(enc0.epoch && s.epoch && enc0.epoch !== s.epoch);
    if (rotating) pauseLocal(s);
    if (s.room?.state === 'connected' && !rotating && s.prepared && enc0.epoch === s.epoch && enc0.status === 'ready') {
      setPhase(s, 'connected'); await ensureMic(s); return;
    }
    if (!s.prepared || s.needsPrepare || rotating || (enc0.epoch && enc0.epoch !== s.epoch)) {
      setPhase(s, s.everConnected && rotating ? 'pausing' : 'securing');
      let key;
      try { key = await api(`/api/voice/${enc(s.id)}/encryption/key`, { method: 'POST', body: {} }); }
      catch (error) {
        if (!alive(s)) return;
        // A new epoch is not available until old media has stopped everywhere.
        if (error.status === 409 || error.code === 'VOICE_CLEANUP_PENDING') { retry(s, 1500); return; }
        throw error;
      }
      if (!alive(s)) return;
      await prepare(s, key);
      if (!alive(s)) return;
    }
    // The ACK is resent until it succeeds; one failed request must not leave the
    // whole call waiting for this participant until the 30 s key deadline.
    if (s.ackedEpoch !== s.epoch) {
      if (!s.proof) { s.needsPrepare = true; retry(s, 500); return; }
      let ack;
      try { ack = await api(`/api/voice/${enc(s.id)}/encryption/ack`, { method: 'POST', body: { epoch: s.epoch, sdkEnabled: true, workerReset: true, proof: s.proof } }); }
      catch (error) {
        if (!alive(s)) return;
        if (error.code === 'VOICE_E2EE_ACK_INVALID') { s.needsPrepare = true; retry(s, 800); return; }
        if (!error.status || error.status === 409 || error.code === 'VOICE_CLEANUP_PENDING') { retry(s, 1500); return; }
        throw error;
      }
      if (!alive(s)) return;
      s.ackedEpoch = s.epoch; s.proof = null;
      adopt(s, ack);
    }
    if (!s.pendingToken) {
      const ready = s.serverEnc?.status === 'ready' && s.serverEnc.epoch === s.epoch;
      if (!ready) { setPhase(s, s.everConnected ? 'pausing' : 'waiting', s.serverEnc?.pendingParticipants ? `${s.serverEnc.pendingParticipants}명 준비 중` : ''); retry(s, 2500); return; }
      const resumed = await api(`/api/voice/${enc(s.id)}/resume`, { method: 'POST', body: {} });
      if (!alive(s)) return;
      adopt(s, resumed);
      if (!s.pendingToken) { retry(s, 1500); return; }
    }
    await connect(s);
  }
  function retry(s, delay) { clearTimeout(s.retryTimer); s.retryTimer = setTimeout(() => { if (alive(s)) void refreshSessionState(s).then(() => drive(s)); }, delay); }
  async function refreshSessionState(s) {
    try {
      const current = await api('/api/voice/current');
      if (!alive(s)) return;
      const admission = current.admission;
      if (!admission || admission.id !== s.id || admission.state !== 'active') { endSession(s, admission?.reason || 'lease_expired'); return; }
      if (admission.encryption) s.serverEnc = admission.encryption;
    } catch (error) { if (alive(s) && [401, 403].includes(error.status)) endSession(s, error.status === 401 ? 'auth' : 'permission_revoked'); }
  }
  async function flowError(s, error) {
    if ([404, 410].includes(error.status) || error.code === 'VOICE_ENDED') { await confirmEnded(s); return; }
    if (error.status === 401) { endSession(s, 'auth'); return; }
    if (error.status === 403) { await confirmEnded(s, 'permission_revoked'); return; }
    if (error.voiceFatal) { await leave({ silent: true }); toast(error.message, true); return; }
    // Transient network/provider failures recover through current/resume with
    // backoff; the server's connect/reconnect grace decides when the call ends.
    s.failures = (s.failures || 0) + 1;
    setPhase(s, s.everConnected ? 'reconnecting' : 'connecting', error.voiceConnect ? '통화 서버에 연결하지 못해 다시 시도하고 있어요.' : errorText(error));
    s.needsPrepare = s.needsPrepare || error.worker === true;
    retry(s, Math.min(15000, 2000 * 2 ** Math.min(3, s.failures - 1)));
  }

  async function prepare(s, keyResult) {
    teardownRoom(s);
    const { ExternalE2EEKeyProvider, Room } = s.sdk;
    const keyProvider = new ExternalE2EEKeyProvider();
    let worker;
    try { worker = new Worker(WORKER_URL); } catch { throw Object.assign(new Error('암호화 작업자를 시작하지 못해 연결하지 않았어요.'), { voiceFatal: true }); }
    const initialized = workerReady(worker);
    const room = new Room({ encryption: { keyProvider, worker }, adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(devicePreference('audioinput') ? { deviceId: devicePreference('audioinput') } : {}) },
      ...(devicePreference('audiooutput') ? { audioOutput: { deviceId: devicePreference('audiooutput') } } : {}) });
    // Tokens issued for an older Room or epoch are never reused.
    Object.assign(s, { room, worker, keyProvider, prepared: false, epoch: null, proof: null, ackedEpoch: null, pendingToken: null });
    bindRoom(s, room);
    try { await initialized; }
    catch { throw Object.assign(new Error('암호화 작업자를 준비하지 못해 연결하지 않았어요. 평문으로 연결하지 않아요.'), { voiceFatal: true }); }
    if (s.room !== room || !alive(s)) return;
    let key = keyResult.key;
    await keyProvider.setKey(key);
    await room.setE2EEEnabled(true);
    s.proof = await e2eeProof(key, keyResult.proofContext);
    key = null; keyResult.key = null; keyResult.challenge = null;
    Object.assign(s, { epoch: keyResult.epoch, prepared: true, paused: false, needsPrepare: false });
  }
  function workerReady(worker, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const done = (fn, value) => { clearTimeout(timer); worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError); fn(value); };
      const onMessage = event => { if (event.data?.kind === 'initAck') done(resolve); };
      const onError = () => done(reject, new Error('worker'));
      const timer = setTimeout(() => done(reject, new Error('worker timeout')), timeout);
      worker.addEventListener('message', onMessage); worker.addEventListener('error', onError);
    });
  }
  function bindRoom(s, room) {
    const E = s.sdk.RoomEvent;
    room.on(E.ConnectionStateChanged, state => {
      if (s.room !== room || !alive(s)) return;
      if (state === 'reconnecting' || state === 'signalReconnecting') setPhase(s, 'reconnecting');
      else if (state === 'connected' && s.prepared && !s.paused && s.serverEnc?.status === 'ready') setPhase(s, 'connected');
    });
    room.on(E.Disconnected, reason => {
      if (s.room !== room || !alive(s) || s.connectingRoom === room) return;
      // The SDK has already unpublished and stopped local tracks here.
      try { s.mic?.stop(); } catch {}
      Object.assign(s, { mic: null, micPublished: false, pendingToken: null }); detachAll(s);
      if (s.share) { const share = s.share; s.share = null; share.cancelled = true; stopTracks(share.tracks); void api(`/api/voice/${enc(s.id)}/share/stop`, { method: 'POST', body: {} }).catch(() => {}); }
      if (reason === s.sdk.DisconnectReason?.DUPLICATE_IDENTITY) { endSession(s, 'replaced'); return; }
      // The SDK already tried its own resume. Recover through current/resume, not a new join.
      setPhase(s, 'reconnecting', '연결이 끊겨 다시 연결하고 있어요.');
      retry(s, 1000);
    });
    room.on(E.TrackSubscribed, (track, publication, participant) => { if (s.room === room) attachRemote(s, track, participant); });
    room.on(E.TrackUnsubscribed, track => { if (s.room === room) detachTrack(s, track); });
    room.on(E.AudioPlaybackStatusChanged, () => { if (s.room === room) { s.audioBlocked = !room.canPlaybackAudio; render(); } });
    room.on(E.EncryptionError, () => { if (s.room === room) { s.encryptionWarningAt = Date.now(); render(); } });
    room.on(E.MediaDevicesError, error => { if (s.room === room) { s.micError = micErrorText(error); render(); } });
    room.on(E.LocalTrackUnpublished, publication => { if (s.room === room && publication.source === 'screen_share' && s.share?.state === 'live') void stopShare('unpublished'); });
    room.on(E.ActiveSpeakersChanged, speakers => { if (s.room === room) { s.selfSpeaking = speakers.some(participant => participant.isLocal); render(); } });
    for (const event of [E.ParticipantConnected, E.ParticipantDisconnected, E.TrackMuted, E.TrackUnmuted]) room.on(event, () => { if (s.room === room) render(); });
  }
  async function connect(s) {
    const room = s.room, token = s.pendingToken; s.pendingToken = null;
    if (!room || !token) return;
    setPhase(s, s.everConnected ? 'reconnecting' : 'connecting');
    if (room.state !== 'disconnected') await room.disconnect(false).catch(() => {});
    s.connectingRoom = room;
    try { await room.connect(s.serverUrl, token, { autoSubscribe: true }); }
    catch (error) { throw Object.assign(error, { voiceConnect: true }); }
    finally { if (s.connectingRoom === room) s.connectingRoom = null; }
    if (!alive(s) || s.room !== room) { void room.disconnect().catch(() => {}); return; }
    s.everConnected = true; s.startedAt ||= Date.now(); s.failures = 0;
    s.audioBlocked = !room.canPlaybackAudio;
    setPhase(s, 'connected');
    startUsage(s);
    await ensureMic(s);
  }
  async function ensureMic(s) {
    const room = s.room;
    if (!s.canSpeak || s.paused || s.micMuted || !room || room.state !== 'connected' || s.micPublished || s.micStarting) return;
    s.micStarting = true;
    try {
      if (s.mic?.mediaStreamTrack?.readyState === 'ended') { s.mic = null; }
      if (!s.mic) s.mic = await s.sdk.createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(devicePreference('audioinput') ? { deviceId: devicePreference('audioinput') } : {}) });
      if (!alive(s) || s.room !== room || s.paused || s.micMuted) { s.mic?.stop(); s.mic = null; return; }
      await room.localParticipant.publishTrack(s.mic, { source: s.sdk.Track.Source.Microphone, audioPreset: s.sdk.AudioPresets.speech, dtx: true, red: true, stopMicTrackOnMute: true });
      s.micPublished = true; s.micError = '';
    } catch (error) { s.micError = micErrorText(error); s.mic?.stop(); s.mic = null; }
    finally { s.micStarting = false; render(); }
  }
  function micErrorText(error) {
    const name = error?.name || error?.cause?.name || '';
    if (/NotAllowed|Permission/i.test(name) || /permission/i.test(error?.message || '')) return '마이크 권한이 꺼져 있어요. 주소창의 사이트 설정에서 마이크를 허용한 뒤 다시 켜 주세요.';
    if (/NotFound|Overconstrained/i.test(name)) return '사용할 수 있는 마이크를 찾지 못했어요. 장치를 연결한 뒤 다시 선택해 주세요.';
    if (/NotReadable/i.test(name)) return '다른 프로그램이 마이크를 쓰고 있어요. 그 프로그램을 닫고 다시 켜 주세요.';
    return '마이크를 켜지 못했어요. 장치를 확인해 주세요.';
  }
  // Key rotation: stop local publishing, keep the signal connection until the
  // next key arrives. Screen sharing ends and restarts only by user action.
  function pauseLocal(s) {
    if (s.paused) return;
    s.paused = true;
    if (s.share) void stopShare('rotation');
    if (s.mic && s.room) { try { void s.room.localParticipant.unpublishTrack(s.mic, true); } catch {} }
    try { s.mic?.stop(); } catch {}
    s.mic = null; s.micPublished = false; render();
  }
  function teardownRoom(s) {
    const { room, worker, mic, share } = s;
    Object.assign(s, { room: null, worker: null, keyProvider: null, mic: null, micPublished: false, prepared: false, proof: null });
    stopUsage(s); detachAll(s);
    if (share) { s.share = null; share.cancelled = true; stopTracks(share.tracks); }
    try { mic?.stop(); } catch {}
    if (room) { room.removeAllListeners(); void room.disconnect(true).catch(() => {}); }
    try { worker?.terminate(); } catch {}
  }
  function teardownSession(s) {
    clearTimeout(s.retryTimer); clearInterval(s.heartbeat); s.heartbeat = null;
    s.pendingToken = null;
    teardownRoom(s); releaseTab(s);
  }

  function startHeartbeat(s) {
    clearInterval(s.heartbeat);
    s.heartbeat = setInterval(() => void beat(s), HEARTBEAT_MS);
  }
  async function beat(s) {
    if (!alive(s) || !s.id) return;
    try { const result = await api(`/api/voice/${enc(s.id)}/heartbeat`, { method: 'POST', body: {} }); if (alive(s)) s.serverMediaState = result.mediaState; }
    catch (error) { if (alive(s) && [401, 403, 404, 410].includes(error.status)) await confirmEnded(s); }
  }
  async function confirmEnded(s, fallback = 'lease_expired') {
    if (!alive(s) || s.confirming) return;
    s.confirming = true;
    try {
      const current = await api('/api/voice/current').catch(error => ({ error }));
      if (!alive(s)) return;
      const admission = current.admission;
      if (admission && admission.id === s.id && admission.state === 'active') { if (admission.encryption) s.serverEnc = admission.encryption; void drive(s); return; }
      endSession(s, current.error?.status === 401 ? 'auth' : admission?.reason || fallback, { cleanupPending: admission?.state === 'revoking' });
    } finally { s.confirming = false; }
  }
  function endSession(s, reason, { cleanupPending = false } = {}) {
    if (v.session !== s || s.ended) return;
    s.ended = true; teardownSession(s);
    Object.assign(s, { phase: 'ended', reason, cleanupPending });
    if (reason !== 'auth') toast(reasonText(reason), reason !== 'left');
    render(); scheduleClear(s, 8000);
  }
  function fail(s, message) {
    if (v.session !== s) return;
    s.ended = true; teardownSession(s);
    Object.assign(s, { phase: 'ended', reason: 'join_failed', detail: message });
    toast(message, true); render(); scheduleClear(s, 6000);
  }
  function scheduleClear(s, delay) { setTimeout(() => { if (v.session === s && s.ended) { v.session = null; render(); } }, delay); }

  async function leave({ reason = 'left', silent = false } = {}) {
    const s = v.session;
    if (!s) { if (v.recover) return leaveRecovered(); return; }
    if (s.ended) { v.session = null; render(); return; }
    const id = s.id;
    s.ended = true; teardownSession(s);
    Object.assign(s, { phase: 'leaving', reason });
    render();
    if (id) {
      try { const result = await api(`/api/voice/${enc(id)}/leave`, { method: 'POST', body: {} }); s.cleanupPending = Boolean(result.cleanupPending); }
      catch (error) { if (![404, 410].includes(error.status)) s.detail = errorText(error); }
    }
    if (v.session !== s) return;
    s.phase = 'ended';
    if (!silent) toast(s.cleanupPending ? '통화에서 나왔어요. 연결 정리는 잠시 더 걸릴 수 있어요.' : '통화에서 나왔어요.');
    render(); scheduleClear(s, s.cleanupPending ? 6000 : 2500);
    if (s.channelId) scheduleRoom(s.channelId, 600);
  }
  async function leaveRecovered() {
    const admission = v.recover?.admission; if (!admission) return;
    v.recover = null; render();
    try { await api(`/api/voice/${enc(admission.id)}/leave`, { method: 'POST', body: {} }); toast('통화에서 나왔어요.'); }
    catch (error) { if (![404, 410].includes(error.status)) toast(errorText(error), true); }
    if (admission.channelId) scheduleRoom(admission.channelId, 600);
  }

  function toggleMute() {
    const s = v.session;
    if (!alive(s) || !s.canSpeak) return;
    s.micMuted = !s.micMuted;
    if (s.micMuted && s.mic) void s.mic.mute().catch(() => {});
    else if (!s.micMuted && s.mic && s.micPublished) void s.mic.unmute().catch(error => { s.micError = micErrorText(error); render(); });
    else if (!s.micMuted) void ensureMic(s);
    render();
  }

  // ── Usage reports: cumulative transport counters per Room connection ──
  function startUsage(s) { stopUsage(s); s.usage = { connectionId: crypto.randomUUID(), sequence: 0, sent: 0, received: 0 }; s.usageTimer = setInterval(() => void reportUsage(s), USAGE_MS); }
  function stopUsage(s) { clearInterval(s.usageTimer); s.usageTimer = null; }
  async function reportUsage(s) {
    const room = s.room;
    if (!alive(s) || !room || room.state !== 'connected' || !s.usage) return;
    const totals = await transportBytes(room).catch(() => null);
    if (!totals || !alive(s) || s.room !== room) return;
    if (totals.sent < s.usage.sent || totals.received < s.usage.received) s.usage = { connectionId: crypto.randomUUID(), sequence: 0, sent: 0, received: 0 };
    const usage = s.usage; usage.sequence += 1; usage.sent = totals.sent; usage.received = totals.received;
    try { await api(`/api/voice/${enc(s.id)}/usage`, { method: 'POST', body: { connectionId: usage.connectionId, sequence: usage.sequence, bytesSent: usage.sent, bytesReceived: usage.received } }); }
    catch (error) { if (error.code === 'VOICE_USAGE_COUNTER_RESET' && s.usage === usage) s.usage = { connectionId: crypto.randomUUID(), sequence: 0, sent: 0, received: 0 }; }
  }
  async function transportBytes(room) {
    const transports = [room.engine?.pcManager?.publisher, room.engine?.pcManager?.subscriber].filter(Boolean);
    let sent = 0, received = 0, found = false;
    for (const transport of transports) {
      const report = await transport.getStats?.();
      if (!report) continue;
      let local = null;
      report.forEach(stat => { if (stat.type === 'transport' && Number.isFinite(stat.bytesReceived)) local = { sent: (local?.sent || 0) + (stat.bytesSent || 0), received: (local?.received || 0) + stat.bytesReceived }; });
      if (!local) report.forEach(stat => { if (stat.type === 'candidate-pair' && stat.nominated && stat.state === 'succeeded') local = { sent: (local?.sent || 0) + (stat.bytesSent || 0), received: (local?.received || 0) + (stat.bytesReceived || 0) }; });
      if (local) { found = true; sent += local.sent; received += local.received; }
    }
    return found ? { sent: Math.floor(sent), received: Math.floor(received) } : null;
  }

  // ── Remote media ─────────────────────────────────────────────
  function sink() {
    let element = document.getElementById('voice-audio');
    if (!element) { element = document.createElement('div'); element.id = 'voice-audio'; element.hidden = true; document.body.append(element); }
    return element;
  }
  function attachRemote(s, track, participant) {
    if (track.kind === 'audio') { const element = track.attach(); element.dataset.voiceTrack = track.sid || ''; sink().append(element); return; }
    if (track.source === 'screen_share') { s.screen = { track, identity: participant.identity }; showStage(s); render(); }
  }
  function detachTrack(s, track) {
    for (const element of track.detach()) if (element.parentElement?.id === 'voice-audio') element.remove();
    if (s.screen?.track === track) { s.screen = null; showStage(s); render(); }
  }
  function detachAll(s) {
    for (const element of [...sink().children]) { try { element.srcObject = null; } catch {} element.remove(); }
    if (s.screen) { try { s.screen.track.detach(); } catch {} s.screen = null; showStage(s); }
  }
  function showStage(s) {
    const stage = document.getElementById('voice-stage');
    if (!stage) return;
    const video = stage.querySelector('video');
    const track = s?.screen?.track || null;
    if (v.stageTrack && v.stageTrack !== track) { try { v.stageTrack.detach(video); } catch {} }
    v.stageTrack = track;
    if (track && video) track.attach(video);
    stage.hidden = !track;
  }

  // ── Screen sharing: pick locally → server approval → encrypted publish ──
  async function startShare(withAudio = false) {
    const s = v.session;
    if (!alive(s) || s.phase !== 'connected' || s.share || !s.room) return;
    const perms = s.permissions || {};
    if (!perms.canShare) { toast('이 통화에서는 화면을 공유할 수 없어요.', true); return; }
    const share = { requestId: crypto.randomUUID(), state: 'picking', cancelled: false, tracks: [], withAudio: false };
    s.share = share; render();
    const { ScreenSharePresets, Track } = s.sdk;
    let tracks;
    try {
      tracks = await s.room.localParticipant.createScreenTracks({ audio: Boolean(withAudio && perms.canShareAudio), resolution: ScreenSharePresets.h720fps15.resolution, contentHint: 'detail', selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'exclude' });
    } catch (error) {
      if (s.share === share) s.share = null;
      render();
      if (!/NotAllowed|Abort/i.test(error?.name || '')) toast(/NotSupported|Unsupported|getDisplayMedia/i.test(`${error?.name} ${error?.message}`) ? '이 브라우저에서는 화면 공유를 쓸 수 없어요.' : '화면 공유를 시작하지 못했어요.', true);
      return;
    }
    // Picker cancellation or a superseded share never sends a start request.
    if (share.cancelled || s.share !== share || !alive(s)) { stopTracks(tracks); return; }
    const video = tracks.find(track => track.source === Track.Source.ScreenShare);
    let audio = tracks.find(track => track.source === Track.Source.ScreenShareAudio);
    if (audio && !(withAudio && perms.canShareAudio)) { audio.stop(); tracks = tracks.filter(track => track !== audio); audio = null; }
    share.tracks = tracks; share.withAudio = Boolean(audio); share.state = 'requesting';
    video?.mediaStreamTrack.addEventListener('ended', () => { if (s.share === share) void stopShare('browser'); });
    if (withAudio && !audio) toast('선택한 화면은 소리를 함께 보내지 않아요. 화면만 공유할게요.');
    render();
    try {
      const result = await api(`/api/voice/${enc(s.id)}/share/start`, { method: 'POST', body: { requestId: share.requestId, withAudio: share.withAudio } });
      if (share.cancelled || s.share !== share || !alive(s)) return;
      // The broader share token stays unused: the connected Room already got the grant.
      adopt(s, result, { token: false });
      share.state = 'publishing'; render();
      await publishPermission(s, share.withAudio ? [SCREEN_SHARE, SCREEN_SHARE_AUDIO] : [SCREEN_SHARE]);
      if (share.cancelled || s.share !== share || !alive(s)) return;
      await s.room.localParticipant.publishTrack(video, { source: Track.Source.ScreenShare, screenShareEncoding: ScreenSharePresets.h720fps15.encoding, simulcast: false });
      if (audio && !share.cancelled) await s.room.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio });
      if (share.cancelled || s.share !== share) return;
      share.state = 'live'; render();
    } catch (error) {
      if (share.cancelled || s.share !== share) return;
      await stopShare('error');
      toast(errorText(error), true);
    }
  }
  function publishPermission(s, sources, timeout = 10000) {
    const participant = s.room.localParticipant;
    const ready = () => sources.every(source => publishAllowed(participant.permissions, source));
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = (fn, value) => { clearTimeout(timer); participant.off(s.sdk.ParticipantEvent.ParticipantPermissionsChanged, check); fn(value); };
      const check = () => { if (ready()) done(resolve); };
      const timer = setTimeout(() => done(reject, Object.assign(new Error('화면 공유 권한이 아직 적용되지 않았어요. 다시 시도해 주세요.'), { status: 409 })), timeout);
      participant.on(s.sdk.ParticipantEvent.ParticipantPermissionsChanged, check);
    });
  }
  function stopTracks(tracks) { for (const track of tracks || []) { try { track.stop(); } catch {} } }
  async function stopShare(cause = 'user') {
    const s = v.session, share = s?.share;
    if (!share) return;
    share.cancelled = true; s.share = null;
    if (s.room) for (const track of share.tracks) { try { await s.room.localParticipant.unpublishTrack(track, true); } catch {} }
    stopTracks(share.tracks);
    render();
    // The picker never produced a start request; everything later is cancelled
    // on the server too, including a start still waiting for its response.
    if (share.state !== 'picking' && s.id && !s.ended) {
      try { await api(`/api/voice/${enc(s.id)}/share/stop`, { method: 'POST', body: {} }); } catch {}
      if (s.channelId) scheduleRoom(s.channelId, 400);
    }
    if (cause === 'browser') toast('화면 공유를 멈췄어요.');
  }

  // ── Invitations, ringing and personal call preferences ──────
  async function refreshInvitations() {
    if (!enabled()) return;
    const gen = v.gen;
    try { const result = await api('/api/voice/invitations'); if (gen !== v.gen) return; v.invitations = result.items || []; }
    catch { return; }
    ringNew(); render();
  }
  async function refreshPreferences() {
    if (!enabled()) return;
    const gen = v.gen;
    try { const result = await api('/api/voice/preferences'); if (gen === v.gen) v.prefs = result.preferences; } catch {}
  }
  function ringNew() {
    for (const item of pendingIncoming(v.invitations, me())) {
      const alertId = item.alert.id;
      if (v.rung.has(alertId)) continue;
      v.rung.add(alertId);
      if (!item.alert.soundEnabled || !claimRing(alertId)) continue;
      chime();
    }
  }
  function claimRing(alertId) {
    // One ring per alert across tabs of this browser profile.
    try {
      const key = `synk-voice-rung:${alertId}`;
      if (localStorage.getItem(key)) return false;
      localStorage.setItem(key, String(Date.now()));
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const name = localStorage.key(index);
        if (name?.startsWith('synk-voice-rung:') && Date.now() - Number(localStorage.getItem(name)) > 86400000) localStorage.removeItem(name);
      }
    } catch {}
    return true;
  }
  function chime() {
    try {
      v.audioContext ||= new AudioContext();
      const context = v.audioContext;
      void context.resume().catch(() => {});
      const start = context.currentTime + 0.02;
      [[880, 0], [660, 0.22], [880, 0.6], [660, 0.82]].forEach(([frequency, offset]) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start + offset); gain.gain.exponentialRampToValueAtTime(0.09, start + offset + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
        oscillator.connect(gain).connect(context.destination); oscillator.start(start + offset); oscillator.stop(start + offset + 0.2);
      });
    } catch {}
  }
  async function respond(invitationId, action) {
    const item = v.invitations.find(row => row.id === invitationId);
    if (!item) return;
    if (action === 'accept') {
      if (Date.parse(item.expiresAt) <= Date.now()) { toast('이미 끝난 초대예요.', true); void refreshInvitations(); return; }
      deps.openChannel(item.channelId);
      await join(item.channelId, { invitation: item });
      return;
    }
    try { await api(`/api/voice/invitations/${enc(invitationId)}/${action}`, { method: 'POST', body: {} }); }
    catch (error) { if (error.status !== 409) toast(errorText(error), true); }
    void refreshInvitations();
  }
  async function openInvitation(invitationId) {
    // An old notification is only a pointer; read the current invitation first.
    try {
      const { invitation } = await api(`/api/voice/invitations/${enc(invitationId)}`);
      const index = v.invitations.findIndex(row => row.id === invitation.id);
      if (index >= 0) v.invitations[index] = { ...v.invitations[index], ...invitation }; else v.invitations.push(invitation);
      if (invitation.state !== 'pending' || Date.parse(invitation.expiresAt) <= Date.now()) toast('이미 끝난 통화 초대예요. 필요하면 대화방에서 직접 참가해 주세요.');
      render();
    } catch (error) { toast(error.status === 404 ? '이 통화 초대를 더 이상 확인할 수 없어요.' : errorText(error), true); }
  }
  function inviteDialog() {
    const s = v.session;
    if (!alive(s) || !s.canSpeak) return;
    const room = channelOf(s.channelId);
    const seated = new Set((s.call?.reservations || []).map(seat => seat.userId));
    const candidates = deps.members().filter(member => member.id !== me() && room?.memberIds?.includes(member.id) && member.active !== false);
    const outgoing = new Map((v.invitations || []).filter(item => item.fromUserId === me() && item.state === 'pending' && Date.parse(item.expiresAt) > Date.now()).map(item => [item.toUserId, item]));
    openModal('동료 부르기', `<div class="voice-invite"><p class="voice-modal-copy">${esc(channelName(s.channelId))}에 있는 동료를 통화로 불러요. 상대가 수락해야 참가하고, 45초 뒤 자동으로 끝나요.</p>${candidates.length ? `<ul class="voice-invite-list">${candidates.map(member => { const pending = outgoing.get(member.id); return `<li><span class="voice-person-name">${esc(member.name)}</span>${seated.has(member.id) ? '<span class="voice-invite-state">통화 중</span>' : pending ? `<button type="button" class="button small" data-voice-invite-cancel="${esc(pending.id)}">부르는 중 · 취소</button>` : `<button type="button" class="button small primary" data-voice-invite="${esc(member.id)}">부르기</button>`}</li>`; }).join('')}</ul>` : '<p class="voice-modal-copy">이 방에서 부를 수 있는 동료가 없어요.</p>'}</div>`);
    modal.classList.add('voice-modal');
    modal.querySelector('.voice-invite')?.addEventListener('click', async event => {
      const invite = event.target.closest('[data-voice-invite]'), cancel = event.target.closest('[data-voice-invite-cancel]');
      if (invite) { invite.disabled = true; await sendInvite(invite.dataset.voiceInvite); if (modal.open) inviteDialog(); }
      if (cancel) { cancel.disabled = true; try { await api(`/api/voice/invitations/${enc(cancel.dataset.voiceInviteCancel)}/cancel`, { method: 'POST', body: {} }); } catch (error) { if (error.status !== 409) toast(errorText(error), true); } await refreshInvitations(); if (modal.open) inviteDialog(); }
    });
  }
  async function sendInvite(recipientId) {
    const s = v.session;
    if (!alive(s)) return;
    const requestId = crypto.randomUUID();
    for (let attempt = 0; attempt < 2; attempt++) {
      try { await api(`/api/channels/${enc(s.channelId)}/voice/invitations`, { method: 'POST', body: { requestId, recipientId } }); toast(`${memberName(recipientId)}님을 불렀어요. 45초 동안 기다려요.`); break; }
      catch (error) { if (!error.status && attempt === 0) { await wait(1200); continue; } toast(errorText(error), true); break; }
    }
    await refreshInvitations();
  }
  function preferencesDialog() {
    const prefs = v.prefs || { revision: 0, callNotifications: true, callSounds: true, doNotDisturb: false, doNotDisturbUntil: null };
    const until = prefs.doNotDisturb ? (prefs.doNotDisturbUntil ? `${new Date(prefs.doNotDisturbUntil).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}까지` : '직접 끌 때까지') : '꺼짐';
    openModal('통화 알림', `<form class="voice-prefs" id="voice-prefs"><label class="voice-toggle"><input type="checkbox" name="callNotifications" ${prefs.callNotifications ? 'checked' : ''}><span><strong>통화 초대 받기</strong><small>끄면 동료가 나를 통화로 부를 수 없어요. 직접 참가는 그대로 돼요.</small></span></label><label class="voice-toggle"><input type="checkbox" name="callSounds" ${prefs.callSounds ? 'checked' : ''}><span><strong>초대 소리</strong><small>끄면 소리 없이 화면에만 보여요. 이 경우 기기 푸시도 보내지 않아요.</small></span></label><fieldset class="voice-dnd"><legend>통화 방해 금지 <span class="voice-dnd-now">지금: ${esc(until)}</span></legend><p class="voice-modal-copy">켜 두는 동안 새 통화 초대를 받지 않아요. 이미 하고 있는 통화는 끊기지 않아요.</p><div class="voice-dnd-options">${[['off', '끄기'], ['30', '30분'], ['60', '1시간'], ['180', '3시간'], ['manual', '직접 끌 때까지']].map(([value, label]) => `<button type="button" class="button small${(value === 'off' && !prefs.doNotDisturb) || (value === 'manual' && prefs.doNotDisturb && !prefs.doNotDisturbUntil) ? ' primary' : ''}" data-voice-dnd="${value}">${label}</button>`).join('')}</div></fieldset><p class="form-error hidden" id="voice-prefs-error"></p></form>`);
    modal.classList.add('voice-modal');
    const form = modal.querySelector('#voice-prefs');
    const save = async patch => {
      form.querySelectorAll('input,button').forEach(element => { element.disabled = true; });
      try { const result = await api('/api/voice/preferences', { method: 'PATCH', body: { revision: v.prefs?.revision ?? 0, ...patch } }); v.prefs = result.preferences; toast('통화 알림 설정을 바꿨어요.'); }
      catch (error) { if (error.status === 409) await refreshPreferences(); toast(error.status === 409 ? '다른 창에서 설정이 바뀌어 최신 값으로 다시 열었어요.' : errorText(error), true); }
      if (modal.open) preferencesDialog();
    };
    form.addEventListener('change', event => { const input = event.target; if (input.type === 'checkbox') void save({ [input.name]: input.checked }); });
    form.addEventListener('click', event => {
      const button = event.target.closest('[data-voice-dnd]'); if (!button) return;
      const value = button.dataset.voiceDnd;
      void save(value === 'off' ? { doNotDisturb: false } : value === 'manual' ? { doNotDisturb: true, doNotDisturbUntil: null } : { doNotDisturb: true, doNotDisturbUntil: new Date(Date.now() + Number(value) * 60000).toISOString() });
    });
  }
  function policyDialog() {
    const s = v.session, channelId = s?.channelId || deps.selectedChannelId();
    const data = v.rooms.get(channelId)?.data, policy = data?.policy;
    if (!data?.permissions?.canModerate || !policy) return;
    const capacity = v.caps?.maxConcurrentParticipants || 4;
    const toggles = [['locked', '새 참가 잠그기', '지금 참가한 사람은 그대로 두고 새 참가만 막아요.'], ['memberCanSpeak', '구성원 발언 허용', '끄면 구성원은 듣기만 해요. 바뀐 사람은 다시 참가해야 해요.'], ['viewerCanJoin', '조회 전용 계정 듣기 허용', '조회 전용 계정이 듣기 전용으로 참가할 수 있어요.'], ['screenShareEnabled', '화면 공유 허용', '워크스페이스 전체에서 한 명만 동시에 공유할 수 있어요.'], ['memberCanShare', '구성원 화면 공유 허용', '끄면 방 관리자만 공유해요.'], ['screenAudioAllowed', '화면 소리 허용', '공유하는 사람이 고른 경우에만 탭·창 소리를 함께 보내요.']];
    openModal('이 방의 통화 설정', `<form class="voice-prefs" id="voice-policy">${toggles.map(([key, label, note]) => `<label class="voice-toggle"><input type="checkbox" name="${key}" ${policy[key] ? 'checked' : ''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('')}<label class="voice-select-row"><span>최대 인원</span><select name="maxParticipants">${Array.from({ length: capacity }, (_, index) => index + 1).map(count => `<option value="${count}" ${policy.maxParticipants === count ? 'selected' : ''}>${count}명</option>`).join('')}</select></label><p class="voice-modal-copy">워크스페이스 전체 동시 인원은 ${capacity}명이에요.</p></form>`);
    modal.classList.add('voice-modal');
    modal.querySelector('#voice-policy').addEventListener('change', async event => {
      const input = event.target, value = input.type === 'checkbox' ? input.checked : Number(input.value);
      try { const result = await api(`/api/channels/${enc(channelId)}/voice/policy`, { method: 'PATCH', body: { revision: policy.revision, [input.name]: value } }); v.rooms.set(channelId, { data: result, at: Date.now() }); if (s?.channelId === channelId) syncFromRoom(s, result); toast('통화 설정을 바꿨어요.'); }
      catch (error) { toast(errorText(error), true); await loadRoom(channelId); }
      if (modal.open) policyDialog();
      render();
    });
  }
  function infoDialog() {
    const s = v.session;
    const limit = v.caps?.maxSessionSeconds ? clock(v.caps.maxSessionSeconds * 1000) : '';
    openModal('통화 정보', `<dl class="voice-info"><dt>암호화</dt><dd>소리와 화면은 이 기기에서 암호화해 보내요. 키는 SYNK 서버가 만들고 관리하며, 통화 서비스 업체에는 보내지 않아요. 기기 간 실제 암호화 검증 결과로 표시하지 않아요.</dd><dt>기록</dt><dd>녹음·전사·카메라는 쓰지 않아요.</dd><dt>한도</dt><dd>워크스페이스 동시 ${esc(v.caps?.maxConcurrentParticipants ?? '')}명 · 화면 공유 1명 · 한 번에 최대 ${esc(limit)}</dd>${s?.sdk ? `<dt>통화 도구</dt><dd>LiveKit ${esc(s.sdk.version || '')}</dd>` : ''}</dl>`);
    modal.classList.add('voice-modal');
  }
  function moreDialog() {
    const s = v.session, data = v.rooms.get(s?.channelId || deps.selectedChannelId())?.data;
    openModal('통화 메뉴', `<div class="voice-menu">${alive(s) ? '<button type="button" class="voice-menu-item" data-voice-menu="devices">마이크·스피커 바꾸기</button>' : ''}<button type="button" class="voice-menu-item" data-voice-menu="prefs">통화 알림·방해 금지</button>${data?.permissions?.canModerate ? '<button type="button" class="voice-menu-item" data-voice-menu="policy">이 방의 통화 설정</button>' : ''}<button type="button" class="voice-menu-item" data-voice-menu="info">통화 정보</button></div>`);
    modal.classList.add('voice-modal');
    modal.querySelector('.voice-menu').addEventListener('click', event => {
      const item = event.target.closest('[data-voice-menu]'); if (!item) return;
      ({ devices: devicesDialog, prefs: preferencesDialog, policy: policyDialog, info: infoDialog })[item.dataset.voiceMenu]?.();
    });
  }

  // ── Devices and the pre-join check ──────────────────────────
  function devicePreference(kind) { try { return localStorage.getItem(`synk-voice-device:${kind}`) || ''; } catch { return ''; } }
  function saveDevice(kind, deviceId) { try { if (deviceId) localStorage.setItem(`synk-voice-device:${kind}`, deviceId); else localStorage.removeItem(`synk-voice-device:${kind}`); } catch {} }
  async function deviceOptions(kind) {
    const devices = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter(device => device.kind === kind);
    const chosen = devicePreference(kind);
    return devices.map((device, index) => `<option value="${esc(device.deviceId)}" ${device.deviceId === chosen ? 'selected' : ''}>${esc(device.label || `${kind === 'audioinput' ? '마이크' : '스피커'} ${index + 1}`)}</option>`).join('');
  }
  const outputSelectable = () => typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  async function devicesDialog() {
    const s = v.session;
    openModal('마이크·스피커', `<div class="voice-devices">${s?.canSpeak !== false ? `<label class="voice-select-row"><span>마이크</span><select id="voice-device-input"><option value="">기본 마이크</option>${await deviceOptions('audioinput')}</select></label>` : ''}${outputSelectable() ? `<label class="voice-select-row"><span>스피커</span><select id="voice-device-output"><option value="">기본 스피커</option>${await deviceOptions('audiooutput')}</select></label>` : '<p class="voice-modal-copy">이 브라우저는 스피커 선택을 지원하지 않아 기본 출력으로 들려요.</p>'}</div>`);
    modal.classList.add('voice-modal');
    modal.querySelector('#voice-device-input')?.addEventListener('change', async event => {
      saveDevice('audioinput', event.target.value);
      const current = v.session;
      if (alive(current) && current.room) await current.room.switchActiveDevice('audioinput', event.target.value || 'default').catch(error => { current.micError = micErrorText(error); render(); });
    });
    modal.querySelector('#voice-device-output')?.addEventListener('change', async event => {
      saveDevice('audiooutput', event.target.value);
      const current = v.session;
      if (alive(current) && current.room) await current.room.switchActiveDevice('audiooutput', event.target.value || 'default').catch(() => toast('스피커를 바꾸지 못했어요.', true));
    });
  }
  async function openPrejoin(channelId) {
    const problem = voiceSupportProblem();
    if (problem) { showUnsupported(problem); return; }
    void sdkLoader().catch(() => {});
    const data = v.rooms.get(channelId)?.data || await loadRoom(channelId);
    const perms = data?.permissions || {};
    if (!perms.canJoin) { toast(data?.policy?.locked ? '이 방은 지금 새 통화 참가를 받지 않아요.' : '이 대화방에서는 통화에 참여할 수 없어요.', true); return; }
    const summary = roomCallSummary(data);
    const speak = perms.canSpeak !== false;
    openModal('통화 참가', `<div class="voice-prejoin"><p class="voice-prejoin-room"><strong>${esc(channelName(channelId))}</strong><span>${esc(summary.state === 'none' ? '아직 통화 중인 사람이 없어요. 먼저 들어가 기다릴 수 있어요.' : summary.label)}</span></p>${speak ? `<label class="voice-select-row"><span>마이크</span><select id="voice-prejoin-mic"><option value="">기본 마이크</option></select></label><div class="voice-meter" aria-hidden="true"><span id="voice-meter-bar"></span></div><p class="voice-modal-copy" id="voice-prejoin-state" role="status">마이크를 확인하고 있어요.</p>` : '<p class="voice-modal-copy">이 방에서는 듣기 전용으로 참가해요. 마이크와 화면 공유는 쓰지 않아요.</p>'}${outputSelectable() ? `<label class="voice-select-row"><span>스피커</span><select id="voice-prejoin-speaker"><option value="">기본 스피커</option>${await deviceOptions('audiooutput')}</select></label>` : ''}<p class="voice-prejoin-note">${glyph('lock')}<span>소리와 화면은 기기에서 암호화해 보내요. 키는 SYNK 서버가 관리하고, 녹음·카메라는 쓰지 않아요.</span></p><div class="modal-actions">${speak ? '<button type="button" class="button" data-voice-prejoin="muted">음소거로 참가</button><button type="button" class="button primary" data-voice-prejoin="mic">마이크 켜고 참가</button>' : '<button type="button" class="button primary" data-voice-prejoin="listen">듣기 전용으로 참가</button>'}</div></div>`);
    modal.classList.add('voice-modal');
    const test = { stream: null, context: null, frame: 0, closed: false };
    const stopTest = () => { test.closed = true; cancelAnimationFrame(test.frame); stopTracks(test.stream?.getTracks()); test.stream = null; void test.context?.close().catch(() => {}); test.context = null; };
    const startTest = async () => {
      stopTest(); test.closed = false;
      const stateLine = modal.querySelector('#voice-prejoin-state'), select = modal.querySelector('#voice-prejoin-mic');
      try {
        const deviceId = devicePreference('audioinput');
        test.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
        if (test.closed || !modal.open) { stopTest(); return; }
        if (select && select.options.length <= 1) select.insertAdjacentHTML('beforeend', await deviceOptions('audioinput'));
        test.context = new AudioContext();
        const analyser = test.context.createAnalyser(); analyser.fftSize = 512;
        test.context.createMediaStreamSource(test.stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize), bar = modal.querySelector('#voice-meter-bar');
        const draw = () => { analyser.getByteTimeDomainData(samples); let peak = 0; for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128)); if (bar) bar.style.transform = `scaleX(${Math.min(1, peak / 64).toFixed(3)})`; test.frame = requestAnimationFrame(draw); };
        draw();
        if (stateLine) stateLine.textContent = '말해 보세요. 막대가 움직이면 마이크가 잘 들어가요.';
      } catch (error) {
        if (stateLine) stateLine.textContent = `${micErrorText(error)} 음소거로 참가해 들을 수는 있어요.`;
      }
    };
    modal.addEventListener('close', () => { stopTest(); modal.classList.remove('voice-modal'); }, { once: true });
    modal.querySelector('#voice-prejoin-mic')?.addEventListener('change', event => { saveDevice('audioinput', event.target.value); void startTest(); });
    modal.querySelector('#voice-prejoin-speaker')?.addEventListener('change', event => saveDevice('audiooutput', event.target.value));
    modal.querySelector('.voice-prejoin .modal-actions').addEventListener('click', event => {
      const button = event.target.closest('[data-voice-prejoin]'); if (!button) return;
      const mode = button.dataset.voicePrejoin;
      stopTest(); modal.close();
      void join(channelId, { muted: mode !== 'mic' });
    });
    if (speak) void startTest();
  }
  function showUnsupported(message) {
    openModal('통화를 열 수 없어요', `<div class="voice-unsupported"><p>${esc(message)}</p><p class="voice-modal-copy">암호화를 쓸 수 없는 환경에서는 평문으로 연결하지 않아요. 채팅과 파일은 그대로 쓸 수 있어요.</p></div>`);
    modal.classList.add('voice-modal');
  }

  // ── Tabs of the same browser profile ─────────────────────────
  function claimTab(s) {
    clearInterval(v.owner);
    const post = () => { if (alive(s) && s.id) channel?.postMessage({ type: 'owner', userId: v.userId, admissionId: s.id }); };
    post(); v.owner = setInterval(post, OWNER_MS);
  }
  function releaseTab(s) {
    clearInterval(v.owner); v.owner = null;
    if (s?.id) channel?.postMessage({ type: 'released', userId: v.userId, admissionId: s.id });
  }
  const otherTabActive = admissionId => Boolean(v.otherTab && Date.now() - v.otherTab.at < OWNER_STALE_MS && (!admissionId || v.otherTab.admissionId === admissionId));

  // ── Rendering ────────────────────────────────────────────────
  function render() {
    if (v.renderQueued) return;
    v.renderQueued = true;
    // setTimeout, not requestAnimationFrame: a hidden iframe pauses frames
    // but the workspace mini controls still need the current state.
    setTimeout(() => { v.renderQueued = false; renderNow(); }, 0);
  }
  function renderNow() {
    renderHeader(); renderDock(); renderRing(); postSummary(); syncTicker();
  }
  function selfPhase(s) { return s ? ({ connected: 'connected', reconnecting: 'reconnecting', securing: 'securing', waiting: 'securing', pausing: 'securing' }[s.phase] || 'connecting') : null; }
  function renderHeader() {
    const actions = document.querySelector('.header-actions');
    let button = document.getElementById('voice-room-button');
    const room = channelOf(deps.selectedChannelId());
    const show = enabled() && supportedRoom(room) && deps.selectedChannelId() === room?.id;
    if (!show) { button?.remove(); v.headerHtml = ''; return; }
    if (!actions) return;
    if (!button) { button = document.createElement('button'); button.type = 'button'; button.id = 'voice-room-button'; button.className = 'voice-room-button'; actions.prepend(button); button.addEventListener('click', () => onHeaderClick()); }
    const data = v.rooms.get(room.id)?.data, summary = roomCallSummary(data), s = v.session;
    const inThis = alive(s) && s.channelId === room.id;
    const canJoin = Boolean(data?.permissions?.canJoin);
    // The strip below carries the detailed phase; the header stays short on phones.
    const label = inThis ? (s.phase === 'connected' ? '통화 중' : ['reconnecting', 'pausing'].includes(s.phase) ? '다시 연결 중' : '연결 중') : summary.label;
    const html = `${glyph('headset')}<span>${esc(label)}</span>`;
    button.dataset.state = inThis ? 'mine' : summary.state;
    button.disabled = !inThis && !canJoin && summary.state === 'none';
    button.hidden = !data && !inThis;
    button.title = inThis ? '지금 이 방에서 통화 중이에요' : canJoin ? '이 방 통화에 참가' : '이 방 통화에 참여할 권한이 없어요';
    button.setAttribute('aria-label', inThis ? `${room.name} 통화 중` : `${room.name} ${summary.label}${canJoin ? ' · 참가하기' : ''}`);
    if (html !== v.headerHtml) { button.innerHTML = html; v.headerHtml = html; }
  }
  function onHeaderClick() {
    const room = channelOf(deps.selectedChannelId());
    if (!room) return;
    const s = v.session;
    if (alive(s)) {
      if (s.channelId === room.id) { document.getElementById('voice-dock')?.querySelector('[data-voice-action]')?.focus(); return; }
      toast(`${channelName(s.channelId)}에서 통화 중이에요. 그 통화에서 나온 뒤 참가해 주세요.`, true); return;
    }
    if (v.recover) { toast('끊긴 통화가 있어요. 위 안내에서 다시 연결하거나 나가 주세요.', true); return; }
    void openPrejoin(room.id);
  }
  function dockElement() {
    let dock = document.getElementById('voice-dock');
    const header = document.querySelector('.main-header');
    if (!header) return null;
    if (!dock) {
      dock = document.createElement('section'); dock.id = 'voice-dock'; dock.className = 'voice-dock'; dock.setAttribute('aria-label', '통화');
      dock.innerHTML = '<div class="voice-strip" id="voice-strip"></div><div class="voice-stage" id="voice-stage" hidden><video playsinline autoplay muted></video><div class="voice-stage-bar"><span id="voice-stage-title">공유 화면</span><button type="button" class="voice-icon-button" data-voice-action="fullscreen" aria-label="공유 화면 크게 보기" title="크게 보기">' + glyph('expand') + '</button></div></div>';
      header.insertAdjacentElement('afterend', dock);
      dock.addEventListener('click', event => { const button = event.target.closest('[data-voice-action]'); if (button) void dockAction(button.dataset.voiceAction, button); });
      v.dockHtml = '';
      showStage(v.session);
    }
    return dock;
  }
  function renderDock() {
    const s = v.session, recover = !s && v.recover;
    const dock = (s || recover) ? dockElement() : document.getElementById('voice-dock');
    if (!dock) return;
    if (!s && !recover) { dock.hidden = true; v.dockHtml = ''; return; }
    dock.hidden = false;
    const strip = dock.querySelector('#voice-strip');
    let html;
    if (recover) {
      const elsewhere = otherTabActive(recover.admission.id);
      dock.dataset.phase = 'recoverable';
      html = `<div class="voice-strip-main"><span class="voice-chip" data-tone="warn">연결 끊김</span><strong class="voice-room-name">${esc(channelName(recover.admission.channelId))}</strong></div><p class="voice-notice">${elsewhere ? '다른 탭에서 이 통화를 하고 있어요.' : '새로고침 등으로 연결이 끊긴 통화가 있어요. 다시 연결하면 마이크를 다시 확인해요.'}</p><div class="voice-controls" role="toolbar" aria-label="끊긴 통화">${elsewhere ? '' : '<button type="button" class="voice-button primary" data-voice-action="recover">다시 연결</button>'}<button type="button" class="voice-button danger" data-voice-action="leave">${glyph('leave')}<span>나가기</span></button></div>`;
    } else {
      dock.dataset.phase = s.phase;
      const room = s.channelId, call = s.call || v.rooms.get(room)?.data?.call;
      const people = callParticipants(call, deps.members(), me(), s.ended ? null : selfPhase(s));
      const sharing = people.find(person => person.sharing && !person.self);
      const live = s.phase === 'connected', ended = s.ended;
      const chip = { connected: ['live', '통화 중'], reconnecting: ['warn', '다시 연결 중'], pausing: ['warn', '키 교체 중'], ended: ['muted', '통화 종료'], leaving: ['muted', '나가는 중'] }[s.phase] || ['pending', PHASES[s.phase] || '준비 중'];
      const share = s.share, perms = s.permissions || {};
      const notices = [];
      if (s.phase === 'securing') notices.push('암호화 키를 받아 통화 도구를 준비하고 있어요.');
      if (s.phase === 'waiting') notices.push(`다른 참가자의 암호화 준비를 기다리고 있어요${s.detail ? ` · ${s.detail}` : ''}.`);
      if (s.phase === 'pausing') notices.push('참가자가 바뀌어 암호화 키를 바꾸는 중이에요. 잠시 소리가 끊겨요.');
      if (s.phase === 'reconnecting') notices.push(s.detail || '연결이 잠시 끊겨 다시 연결하고 있어요.');
      if (s.phase === 'connecting' && s.detail) notices.push(s.detail);
      if (ended) notices.push(s.detail || (s.reason ? reasonText(s.reason) : '통화가 끝났어요.') + (s.cleanupPending ? ' 연결 정리는 잠시 더 걸릴 수 있어요.' : ''));
      if (!ended && call && call.sync?.status !== 'current') notices.push('참가자 연결 상태를 확인하고 있어요. 표시가 잠시 늦을 수 있어요.');
      if (!ended && s.micError) notices.push(s.micError);
      if (!ended && s.audioBlocked && live) notices.push('브라우저가 소리 재생을 막았어요. ‘소리 켜기’를 눌러 주세요.');
      if (!ended && Date.now() - s.encryptionWarningAt < 15000) notices.push('일부 소리나 화면을 복호화하지 못했어요. 계속되면 나갔다가 다시 참가해 주세요.');
      if (!ended && share?.state === 'picking') notices.push('공유할 화면을 고르고 있어요.');
      if (!ended && share?.state === 'requesting') notices.push('화면 공유 승인을 받고 있어요.');
      if (!ended && share?.state === 'publishing') notices.push('승인된 화면을 암호화해 보내기 시작해요.');
      if (!ended && s.sessionEndsAt && Date.parse(s.sessionEndsAt) - Date.now() < 300000 && Date.parse(s.sessionEndsAt) > Date.now()) notices.push('5분 안에 최대 통화 시간이 끝나요.');
      const muted = !s.canSpeak || s.micMuted;
      const shareButton = !s.canSpeak || !perms.canShare || ended ? '' : share ? `<button type="button" class="voice-button active" data-voice-action="stop-share" aria-pressed="true">${glyph('screenStop')}<span>${share.state === 'live' ? '공유 중지' : '공유 취소'}</span></button>` : `<button type="button" class="voice-button" data-voice-action="share" ${live && !sharing ? '' : 'disabled'}${sharing ? ' title="다른 사람이 화면을 공유하고 있어요. 공유가 끝나면 시작할 수 있어요."' : ''} aria-pressed="false">${glyph('screen')}<span>화면 공유</span></button>`;
      html = `<div class="voice-strip-main"><span class="voice-chip" data-tone="${chip[0]}">${esc(chip[1])}</span><button type="button" class="voice-room-name" data-voice-action="open-room" title="통화 중인 대화방 열기">${esc(channelName(room))}</button>${s.startedAt && !ended ? `<time class="voice-elapsed" id="voice-elapsed">${clock(Date.now() - s.startedAt)}</time>` : ''}${ended ? '' : `<span class="voice-secure" title="소리와 화면은 기기에서 암호화돼요. 키는 SYNK 서버가 관리해요.">${glyph('lock')}<span>암호화</span></span>`}</div>`
        + `<ul class="voice-people" aria-label="참가자">${people.map(person => `<li class="voice-person" data-status="${person.status}"${person.self && s.selfSpeaking && !muted ? ' data-speaking="true"' : ''}><span class="voice-avatar" aria-hidden="true">${esc([...person.name][0] || '?')}</span><span class="voice-person-text"><span class="voice-person-name">${esc(person.self ? `${person.name} (나)` : person.name)}</span><span class="voice-person-state">${esc(person.self ? (PHASES[s.phase] || '') : PARTICIPANT[person.status] || '')}${person.sharing ? ' · 화면 공유' : ''}</span></span>${(person.self ? muted : person.muted) ? `<span class="voice-person-muted" title="마이크 꺼짐" aria-label="마이크 꺼짐">${glyph('micOff')}</span>` : ''}</li>`).join('')}</ul>`
        + (notices.length ? `<p class="voice-notice" role="status">${notices.map(esc).join(' ')}</p>` : '')
        + (ended ? `<div class="voice-controls"><button type="button" class="voice-button" data-voice-action="dismiss">닫기</button></div>` : `<div class="voice-controls" role="toolbar" aria-label="통화 조작">`
          + (s.canSpeak ? `<button type="button" class="voice-button${muted ? ' muted' : ''}" data-voice-action="mute" aria-pressed="${muted}">${glyph(muted ? 'micOff' : 'mic')}<span>${muted ? '마이크 켜기' : '마이크 끄기'}</span></button>` : '<span class="voice-chip" data-tone="muted">듣기 전용</span>')
          + (s.audioBlocked && live ? `<button type="button" class="voice-button primary" data-voice-action="audio">${glyph('speaker')}<span>소리 켜기</span></button>` : '')
          + shareButton
          + (s.canSpeak && v.caps?.invitations ? `<button type="button" class="voice-button" data-voice-action="invite" ${s.id ? '' : 'disabled'}>${glyph('userPlus')}<span>동료 부르기</span></button>` : '')
          + `<button type="button" class="voice-icon-button" data-voice-action="more" aria-label="통화 메뉴" title="통화 메뉴">${glyph('more')}</button>`
          + `<button type="button" class="voice-button danger" data-voice-action="leave">${glyph('leave')}<span>나가기</span></button></div>`);
      const title = dock.querySelector('#voice-stage-title');
      if (title) title.textContent = sharing ? `${sharing.name}님의 화면` : '공유 화면';
    }
    if (html !== v.dockHtml) {
      const focused = strip.contains(document.activeElement) ? document.activeElement.dataset.voiceAction : null;
      strip.innerHTML = html; v.dockHtml = html;
      if (focused) strip.querySelector(`[data-voice-action="${focused}"]`)?.focus({ preventScroll: true });
    }
  }
  async function dockAction(action, button) {
    const s = v.session;
    if (action === 'mute') return toggleMute();
    if (action === 'leave') return leave();
    if (action === 'recover') return recoverCall();
    if (action === 'dismiss') { if (s?.ended) { v.session = null; render(); } return; }
    // Screen audio is offered only where the room allows it; the browser
    // picker's own audio checkbox is the user's choice.
    if (action === 'share') return startShare(Boolean(s?.permissions?.canShareAudio));
    if (action === 'stop-share') return stopShare('user');
    if (action === 'invite') return inviteDialog();
    if (action === 'more') return moreDialog();
    if (action === 'audio') { await s?.room?.startAudio().catch(() => {}); if (s) { s.audioBlocked = !s.room?.canPlaybackAudio; render(); } return; }
    if (action === 'open-room') { const channelId = s?.channelId || v.recover?.admission.channelId; if (channelId) deps.openChannel(channelId); return; }
    if (action === 'fullscreen') { const stage = document.getElementById('voice-stage'); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void stage?.requestFullscreen?.().catch(() => toast('이 화면에서는 크게 보기를 쓸 수 없어요.', true)); return; }
    void button;
  }
  function renderRing() {
    let ring = document.getElementById('voice-ring');
    const incoming = enabled() ? pendingIncoming(v.invitations, me()) : [];
    const item = incoming[0];
    if (!item) { if (ring) { ring.hidden = true; ring.innerHTML = ''; } v.ringHtml = ''; return; }
    if (!ring) {
      ring = document.createElement('section'); ring.id = 'voice-ring'; ring.className = 'voice-ring'; ring.setAttribute('role', 'alertdialog'); ring.setAttribute('aria-live', 'assertive'); ring.setAttribute('aria-label', '통화 초대');
      document.body.append(ring);
      ring.addEventListener('click', event => { const button = event.target.closest('[data-voice-ring]'); if (button) { button.disabled = true; void respond(button.dataset.invitation, button.dataset.voiceRing); } });
    }
    const left = Math.max(0, Math.ceil((Date.parse(item.expiresAt) - Date.now()) / 1000));
    const busy = alive(v.session) || Boolean(v.recover);
    const html = `<span class="voice-ring-icon" aria-hidden="true">${glyph('phone')}</span><div class="voice-ring-text"><strong>${esc(memberName(item.fromUserId))}님이 통화에 불렀어요</strong><span>${esc(channelName(item.channelId))} · <span id="voice-ring-left">${left}</span>초 남음${incoming.length > 1 ? ` · 초대 ${incoming.length}개` : ''}</span>${busy ? `<small>${v.recover ? '끊긴 통화를 먼저 다시 연결하거나 나가 주세요.' : '수락하려면 지금 통화에서 먼저 나와 주세요.'}</small>` : ''}</div><div class="voice-ring-actions"><button type="button" class="voice-button" data-voice-ring="reject" data-invitation="${esc(item.id)}">거절</button><button type="button" class="voice-button primary" data-voice-ring="accept" data-invitation="${esc(item.id)}" ${busy ? 'disabled' : ''}>수락</button></div>`;
    ring.hidden = false;
    if (html.replace(/<span id="voice-ring-left">\d+<\/span>/, '') !== v.ringHtml.replace(/<span id="voice-ring-left">\d+<\/span>/, '')) { ring.innerHTML = html; v.ringHtml = html; }
    else { const counter = ring.querySelector('#voice-ring-left'); if (counter) counter.textContent = String(left); }
  }
  function syncTicker() {
    const needed = (alive(v.session) && v.session.startedAt) || pendingIncoming(v.invitations, me()).length || (v.invitations || []).some(item => item.fromUserId === me() && item.state === 'pending');
    if (needed && !v.tick) v.tick = setInterval(tick, 1000);
    if (!needed && v.tick) { clearInterval(v.tick); v.tick = null; }
  }
  function tick() {
    const s = v.session, elapsed = document.getElementById('voice-elapsed');
    if (elapsed && s?.startedAt) elapsed.textContent = clock(Date.now() - s.startedAt);
    const expired = (v.invitations || []).some(item => item.state === 'pending' && Date.parse(item.expiresAt) <= Date.now());
    if (expired) { v.invitations = v.invitations.filter(item => !(item.state === 'pending' && Date.parse(item.expiresAt) <= Date.now())); void refreshInvitations(); }
    renderRing(); postSummary(); syncTicker();
  }
  function summary() {
    const s = v.session, incoming = enabled() ? pendingIncoming(v.invitations, me())[0] : null;
    const people = s ? callParticipants(s.call || v.rooms.get(s.channelId)?.data?.call, deps.members(), me(), selfPhase(s)) : [];
    return {
      call: s ? { phase: s.phase, label: s.ended ? (s.detail || reasonText(s.reason)) : PHASES[s.phase] || '', ended: s.ended, channelId: s.channelId, channelName: channelName(s.channelId),
        people: people.length, canSpeak: s.canSpeak, muted: !s.canSpeak || s.micMuted, sharing: Boolean(s.share), sharingLive: s.share?.state === 'live', remoteSharing: people.find(person => person.sharing && !person.self)?.name || null,
        startedAt: s.startedAt, audioBlocked: Boolean(s.audioBlocked && s.phase === 'connected') } : v.recover ? { phase: 'recoverable', label: '연결이 끊긴 통화가 있어요', ended: false, channelId: v.recover.admission.channelId, channelName: channelName(v.recover.admission.channelId), people: 0, canSpeak: false, muted: true, sharing: false } : null,
      incoming: incoming ? { id: incoming.id, fromName: memberName(incoming.fromUserId), channelName: channelName(incoming.channelId), expiresAt: incoming.expiresAt, busy: alive(s) || Boolean(v.recover) } : null,
    };
  }
  function postSummary() {
    if (!deps.embedded) return;
    const value = summary(), text = JSON.stringify(value);
    if (text === v.lastSummary) return;
    v.lastSummary = text; deps.parentMessage('messenger:voice', { voice: value });
  }

  window.addEventListener('pagehide', () => {
    // The document is going away: stop capture and the SDK now. The admission
    // stays for current/resume after a refresh, within the server grace.
    const s = v.session;
    if (s && !s.ended) { s.ended = true; teardownSession(s); v.session = null; }
  });
  window.addEventListener('pageshow', event => { if (event.persisted && enabled()) void checkRecover(); });
  async function checkRecover() {
    const gen = v.gen;
    try {
      const current = await api('/api/voice/current');
      if (gen === v.gen && current.admission?.state === 'active' && !v.session) { v.recover = { admission: current.admission }; void loadRoom(current.admission.channelId); }
    } catch {}
    render();
  }

  return {
    async init(data) {
      this.dispose('auth', { silent: true });
      v.caps = data.voice || null; v.userId = data.user?.id || null; v.gen += 1;
      if (!enabled()) { render(); return; }
      const gen = v.gen;
      await Promise.all([refreshPreferences(), refreshInvitations()]);
      if (gen === v.gen) await checkRecover();
    },
    dispose(reason = 'auth', { silent = false } = {}) {
      const s = v.session;
      if (s && !s.ended) { s.ended = true; teardownSession(s); if (!silent && reason !== 'auth') toast(reasonText(reason), true); }
      v.session = null; v.recover = null; v.invitations = []; v.rooms.clear(); acceptIds.clear(); v.gen += 1;
      for (const timer of v.roomTimers.values()) clearTimeout(timer);
      v.roomTimers.clear(); clearInterval(v.tick); v.tick = null; clearInterval(v.owner); v.owner = null;
      document.getElementById('voice-ring')?.remove(); document.getElementById('voice-dock')?.remove(); document.getElementById('voice-room-button')?.remove();
      v.dockHtml = ''; v.ringHtml = ''; v.headerHtml = '';
      if (deps.embedded && v.lastSummary) { v.lastSummary = ''; deps.parentMessage('messenger:voice', { voice: { call: null, incoming: null } }); }
    },
    enabled,
    // Channel changes only refresh the room preview; the call itself is untouched.
    syncChannel(channelId) {
      if (!enabled()) return;
      const room = channelOf(channelId);
      if (supportedRoom(room)) { const cached = v.rooms.get(channelId); if (!cached || Date.now() - cached.at > 10000) void loadRoom(channelId); }
      render();
    },
    remount() { v.dockHtml = ''; v.headerHtml = ''; render(); },
    handleUpdate(update) {
      if (!enabled()) return;
      if (update.type === 'voice' && update.channelId) {
        if (update.channelId === deps.selectedChannelId() || update.channelId === v.session?.channelId || update.channelId === v.recover?.admission.channelId) scheduleRoom(update.channelId);
        else v.rooms.delete(update.channelId);
        return;
      }
      if (update.type === 'voice_invitation' || update.type === 'notification') { void refreshInvitations(); return; }
      if (update.type === 'voice_preferences') void refreshPreferences();
    },
    reconnected() {
      if (!enabled()) return;
      void refreshInvitations();
      for (const channelId of new Set([deps.selectedChannelId(), v.session?.channelId].filter(Boolean))) scheduleRoom(channelId, 100);
      if (alive(v.session)) void confirmEnded(v.session);
    },
    parentAction(data) {
      if (!enabled() || !data) return;
      if (data.action === 'mute') toggleMute();
      else if (data.action === 'leave') void leave();
      else if (data.action === 'stop-share') void stopShare('user');
      else if (data.action === 'open') { const channelId = v.session?.channelId || v.recover?.admission.channelId; if (channelId) deps.openChannel(channelId); }
      else if (data.action === 'accept' || data.action === 'reject') void respond(String(data.invitationId || ''), data.action);
    },
    // The pre-join check calls this; tests use it to skip the browser dialog.
    join: (channelId, options) => join(channelId, options),
    openInvitation,
    preferencesDialog,
    isInvitationNotification: item => item?.kind === 'voice_invitation' && item.voiceInvitation?.id,
  };
}

// Exposed for app.js, which tests also evaluate as a classic script.
if (typeof window !== 'undefined') window.SynkVoice = Object.freeze({ createVoice });
